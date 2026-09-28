import { createHash, randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  canonicalJson,
  type ConfigValidationIssue,
  type ConfigVersionMetadata,
  type PublishedConfigDefinitions,
  type RuntimeConfigBundle,
} from '@tls/domain';
import {
  DEFAULT_CONFIG_CHECKSUM,
  defaultRuntimeConfig,
  normalizeRuntimeConfig,
  validateRuntimeConfig,
} from '@tls/model-config';

export interface StoredConfigVersion extends ConfigVersionMetadata {
  bodyKey: string;
}

export interface LoadedConfigVersion {
  config: RuntimeConfigBundle;
  metadata: ConfigVersionMetadata;
}

export interface ConfigStore {
  getActive(): Promise<LoadedConfigVersion>;
  getVersion(version: string): Promise<LoadedConfigVersion | undefined>;
  listVersions(): Promise<ConfigVersionMetadata[]>;
  createDraft(config: RuntimeConfigBundle, checksum: string, actor: string): Promise<ConfigVersionMetadata | undefined>;
  replaceDraft(config: RuntimeConfigBundle, checksum: string, expectedRevision: number, actor: string): Promise<ConfigVersionMetadata | undefined>;
  publish(version: string, expectedRevision: number, expectedActiveVersion: string, actor: string): Promise<ConfigVersionMetadata | undefined>;
  activate(version: string, actor: string): Promise<ConfigVersionMetadata | undefined>;
}

const seedMetadata: ConfigVersionMetadata = {
  configBundleVersion: defaultRuntimeConfig.configBundleVersion,
  revision: 1,
  status: 'published',
  checksum: DEFAULT_CONFIG_CHECKSUM,
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
  createdBy: 'packaged-seed',
  publishedAt: '2026-09-28T00:00:00.000Z',
};

export function checksumRuntimeConfig(config: RuntimeConfigBundle): string {
  return createHash('sha256').update(canonicalJson(normalizeRuntimeConfig(config))).digest('hex');
}

function cloneLoaded(value: LoadedConfigVersion): LoadedConfigVersion {
  return structuredClone(value);
}

export class MemoryConfigStore implements ConfigStore {
  private readonly versions = new Map<string, LoadedConfigVersion>([[
    defaultRuntimeConfig.configBundleVersion,
    { config: defaultRuntimeConfig, metadata: seedMetadata },
  ]]);
  private activeVersion = defaultRuntimeConfig.configBundleVersion;

  async getActive(): Promise<LoadedConfigVersion> {
    return cloneLoaded(this.versions.get(this.activeVersion)!);
  }

  async getVersion(version: string): Promise<LoadedConfigVersion | undefined> {
    const result = this.versions.get(version);
    return result ? cloneLoaded(result) : undefined;
  }

  async listVersions(): Promise<ConfigVersionMetadata[]> {
    return [...this.versions.values()].map((entry) => structuredClone(entry.metadata)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createDraft(config: RuntimeConfigBundle, checksum: string, actor: string): Promise<ConfigVersionMetadata | undefined> {
    if (this.versions.has(config.configBundleVersion)) return undefined;
    const now = new Date().toISOString();
    const metadata: ConfigVersionMetadata = {
      configBundleVersion: config.configBundleVersion,
      revision: 1,
      status: 'draft',
      checksum,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
    };
    this.versions.set(config.configBundleVersion, { config: structuredClone(config), metadata });
    return structuredClone(metadata);
  }

  async replaceDraft(config: RuntimeConfigBundle, checksum: string, expectedRevision: number, _actor: string): Promise<ConfigVersionMetadata | undefined> {
    const current = this.versions.get(config.configBundleVersion);
    if (!current || current.metadata.status !== 'draft' || current.metadata.revision !== expectedRevision) return undefined;
    const metadata: ConfigVersionMetadata = {
      ...current.metadata,
      revision: expectedRevision + 1,
      checksum,
      updatedAt: new Date().toISOString(),
    };
    this.versions.set(config.configBundleVersion, { config: structuredClone(config), metadata });
    return structuredClone(metadata);
  }

  async publish(version: string, expectedRevision: number, expectedActiveVersion: string, _actor: string): Promise<ConfigVersionMetadata | undefined> {
    const current = this.versions.get(version);
    if (
      !current || current.metadata.status !== 'draft' || current.metadata.revision !== expectedRevision ||
      this.activeVersion !== expectedActiveVersion
    ) return undefined;
    const now = new Date().toISOString();
    const metadata: ConfigVersionMetadata = {
      ...current.metadata,
      revision: expectedRevision + 1,
      status: 'published',
      updatedAt: now,
      publishedAt: now,
    };
    this.versions.set(version, { config: current.config, metadata });
    this.activeVersion = version;
    return structuredClone(metadata);
  }

  async activate(version: string, _actor: string): Promise<ConfigVersionMetadata | undefined> {
    const current = this.versions.get(version);
    if (!current || current.metadata.status !== 'published') return undefined;
    this.activeVersion = version;
    return structuredClone(current.metadata);
  }
}

function isConditionalFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error &&
    (error.name === 'ConditionalCheckFailedException' || error.name === 'TransactionCanceledException');
}

export class DynamoS3ConfigStore implements ConfigStore {
  private readonly dynamo: DynamoDBDocumentClient;
  private readonly s3: S3Client;

  constructor(
    dynamoClient: DynamoDBClient,
    private readonly tableName: string,
    private readonly bucketName: string,
    s3Client = new S3Client({}),
  ) {
    this.dynamo = DynamoDBDocumentClient.from(dynamoClient, { marshallOptions: { removeUndefinedValues: true } });
    this.s3 = s3Client;
  }

  private versionKey(version: string): string {
    return `VERSION#${version}`;
  }

  private async metadata(version: string): Promise<StoredConfigVersion | undefined> {
    if (version === defaultRuntimeConfig.configBundleVersion) {
      const override = await this.dynamo.send(new GetCommand({ TableName: this.tableName, Key: { configKey: this.versionKey(version) }, ConsistentRead: true }));
      return override.Item as StoredConfigVersion | undefined;
    }
    const response = await this.dynamo.send(new GetCommand({ TableName: this.tableName, Key: { configKey: this.versionKey(version) }, ConsistentRead: true }));
    return response.Item as StoredConfigVersion | undefined;
  }

  async getActive(): Promise<LoadedConfigVersion> {
    const pointer = await this.dynamo.send(new GetCommand({ TableName: this.tableName, Key: { configKey: 'ACTIVE' }, ConsistentRead: true }));
    if (typeof pointer.Item?.configBundleVersion !== 'string') {
      return { config: structuredClone(defaultRuntimeConfig), metadata: structuredClone(seedMetadata) };
    }
    const loaded = await this.getVersion(pointer.Item.configBundleVersion);
    if (!loaded) throw new Error('ACTIVE_CONFIG_UNAVAILABLE');
    return loaded;
  }

  async getVersion(version: string): Promise<LoadedConfigVersion | undefined> {
    const metadata = await this.metadata(version);
    if (!metadata) {
      return version === defaultRuntimeConfig.configBundleVersion
        ? { config: structuredClone(defaultRuntimeConfig), metadata: structuredClone(seedMetadata) }
        : undefined;
    }
    const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucketName, Key: metadata.bodyKey }));
    const text = await object.Body?.transformToString('utf-8');
    if (!text) return undefined;
    const validation = validateRuntimeConfig(JSON.parse(text));
    if (!validation.bundle || validation.issues.length) return undefined;
    if (checksumRuntimeConfig(validation.bundle) !== metadata.checksum) return undefined;
    return { config: validation.bundle, metadata };
  }

  async listVersions(): Promise<ConfigVersionMetadata[]> {
    const list: ConfigVersionMetadata[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const response = await this.dynamo.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(configKey, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'VERSION#' },
        ProjectionExpression: 'configBundleVersion, revision, #status, checksum, createdAt, updatedAt, createdBy, publishedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      list.push(...(response.Items ?? []) as ConfigVersionMetadata[]);
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    if (!list.some((entry) => entry.configBundleVersion === seedMetadata.configBundleVersion)) list.push(seedMetadata);
    return list.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createDraft(config: RuntimeConfigBundle, checksum: string, actor: string): Promise<ConfigVersionMetadata | undefined> {
    if (config.configBundleVersion === defaultRuntimeConfig.configBundleVersion) return undefined;
    const now = new Date().toISOString();
    const bodyKey = `drafts/${config.configBundleVersion}/1.json`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: bodyKey,
      Body: canonicalJson(normalizeRuntimeConfig(config)),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    }));
    const metadata: StoredConfigVersion = {
      configBundleVersion: config.configBundleVersion,
      revision: 1,
      status: 'draft',
      checksum,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      bodyKey,
    };
    try {
      await this.dynamo.send(new PutCommand({
        TableName: this.tableName,
        Item: { configKey: this.versionKey(config.configBundleVersion), ...metadata },
        ConditionExpression: 'attribute_not_exists(configKey)',
      }));
      return metadata;
    } catch (error) {
      if (isConditionalFailure(error)) return undefined;
      throw error;
    }
  }

  async replaceDraft(config: RuntimeConfigBundle, checksum: string, expectedRevision: number, _actor: string): Promise<ConfigVersionMetadata | undefined> {
    const current = await this.metadata(config.configBundleVersion);
    if (!current || current.status !== 'draft' || current.revision !== expectedRevision) return undefined;
    const revision = expectedRevision + 1;
    const bodyKey = `drafts/${config.configBundleVersion}/${revision}.json`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: bodyKey,
      Body: canonicalJson(normalizeRuntimeConfig(config)),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    }));
    const metadata: StoredConfigVersion = {
      ...current,
      revision,
      checksum,
      bodyKey,
      updatedAt: new Date().toISOString(),
    };
    try {
      await this.dynamo.send(new PutCommand({
        TableName: this.tableName,
        Item: { configKey: this.versionKey(config.configBundleVersion), ...metadata },
        ConditionExpression: 'revision = :revision AND #status = :draft',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':revision': expectedRevision, ':draft': 'draft' },
      }));
      return metadata;
    } catch (error) {
      if (isConditionalFailure(error)) return undefined;
      throw error;
    }
  }

  async publish(version: string, expectedRevision: number, expectedActiveVersion: string, actor: string): Promise<ConfigVersionMetadata | undefined> {
    const current = await this.metadata(version);
    if (!current || current.status !== 'draft' || current.revision !== expectedRevision) return undefined;
    const now = new Date().toISOString();
    const revision = expectedRevision + 1;
    try {
      await this.dynamo.send(new TransactWriteCommand({ TransactItems: [
        {
          Update: {
            TableName: this.tableName,
            Key: { configKey: this.versionKey(version) },
            UpdateExpression: 'SET #status = :published, revision = :next, updatedAt = :now, publishedAt = :now',
            ConditionExpression: 'revision = :expected AND #status = :draft',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':published': 'published', ':draft': 'draft', ':next': revision, ':expected': expectedRevision, ':now': now,
            },
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: { configKey: 'ACTIVE', configBundleVersion: version, checksum: current.checksum, updatedAt: now },
            ConditionExpression: expectedActiveVersion === defaultRuntimeConfig.configBundleVersion
              ? 'attribute_not_exists(configKey) OR configBundleVersion = :expectedActive'
              : 'configBundleVersion = :expectedActive',
            ExpressionAttributeValues: { ':expectedActive': expectedActiveVersion },
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: { configKey: `AUDIT#${now}#${randomUUID()}`, action: 'publish', configBundleVersion: version, actor, checksum: current.checksum, createdAt: now },
          },
        },
      ] }));
      return { ...current, revision, status: 'published', updatedAt: now, publishedAt: now };
    } catch (error) {
      if (isConditionalFailure(error)) return undefined;
      throw error;
    }
  }

  async activate(version: string, actor: string): Promise<ConfigVersionMetadata | undefined> {
    const loaded = await this.getVersion(version);
    const current = loaded?.metadata;
    if (!current || current.status !== 'published') return undefined;
    const now = new Date().toISOString();
    await this.dynamo.send(new TransactWriteCommand({ TransactItems: [
      {
        Put: {
          TableName: this.tableName,
          Item: { configKey: 'ACTIVE', configBundleVersion: version, checksum: current.checksum, updatedAt: now },
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: { configKey: `AUDIT#${now}#${randomUUID()}`, action: 'activate', configBundleVersion: version, actor, checksum: current.checksum, createdAt: now },
        },
      },
    ] }));
    return current;
  }
}

export class ConfigService {
  constructor(private readonly store: ConfigStore) {}

  async publishedDefinitions(): Promise<PublishedConfigDefinitions> {
    const versions = await this.store.listVersions();
    const published = await Promise.all(
      versions
        .filter((metadata) => metadata.status === 'published')
        .map((metadata) => this.store.getVersion(metadata.configBundleVersion)),
    );
    const fieldOptions = new Map<string, Set<string>>();
    const definitions: PublishedConfigDefinitions = {
      fields: {},
      cityIds: [],
      reachTierIds: [],
      reachBoostIds: [],
    };
    const cityIds = new Set<string>();
    const reachTierIds = new Set<string>();
    const reachBoostIds = new Set<string>();
    for (const loaded of published) {
      if (!loaded) throw new Error('PUBLISHED_CONFIG_UNAVAILABLE');
      for (const field of loaded.config.catalog.fields) {
        definitions.fields[field.id] ??= { kind: field.kind, optionIds: [] };
        const options = fieldOptions.get(field.id) ?? new Set<string>();
        for (const option of field.options ?? []) options.add(option.id);
        fieldOptions.set(field.id, options);
      }
      for (const city of loaded.config.cities) cityIds.add(city.id);
      for (const tier of loaded.config.reachTiers) reachTierIds.add(tier.id);
      for (const boost of loaded.config.reachBoosts) reachBoostIds.add(boost.id);
    }
    for (const [fieldId, options] of fieldOptions) definitions.fields[fieldId]!.optionIds = [...options].sort();
    definitions.cityIds = [...cityIds].sort();
    definitions.reachTierIds = [...reachTierIds].sort();
    definitions.reachBoostIds = [...reachBoostIds].sort();
    return definitions;
  }

  async validate(configValue: unknown, expectedChecksum?: string): Promise<{
    config?: RuntimeConfigBundle;
    checksum?: string;
    issues: ConfigValidationIssue[];
  }> {
    const validation = validateRuntimeConfig(configValue);
    if (!validation.bundle) return { issues: validation.issues };
    const config = validation.bundle;
    const issues: ConfigValidationIssue[] = [...validation.issues];
    const published = await this.publishedDefinitions();
    const candidateFields = new Map(config.catalog.fields.map((field) => [field.id, field]));
    for (const [fieldId, publishedField] of Object.entries(published.fields)) {
      const candidate = candidateFields.get(fieldId);
      if (!candidate) {
        issues.push({ path: `catalog.fields.${fieldId}`, code: 'published_field_removed', message: '已发布问题必须保留并通过 retired 下线。' });
      } else if (candidate.kind !== publishedField.kind) {
        issues.push({ path: `catalog.fields.${fieldId}.kind`, code: 'published_kind_changed', message: '已发布问题的数据类型不能原地改写。' });
      } else {
        const candidateOptionIds = new Set((candidate.options ?? []).map((option) => option.id));
        for (const optionId of publishedField.optionIds) {
          if (!candidateOptionIds.has(optionId)) {
            issues.push({ path: `catalog.fields.${fieldId}.options.${optionId}`, code: 'published_option_removed', message: '已发布选项必须保留并通过 retired 下线。' });
          }
        }
      }
    }
    const preserveIds = (publishedIds: string[], candidateIds: Set<string>, path: string, noun: string) => {
      for (const id of publishedIds) {
        if (!candidateIds.has(id)) issues.push({ path: `${path}.${id}`, code: 'published_id_removed', message: `已发布${noun}必须保留并通过 retired 下线。` });
      }
    };
    preserveIds(published.cityIds, new Set(config.cities.map((city) => city.id)), 'cities', '城市');
    preserveIds(published.reachTierIds, new Set(config.reachTiers.map((tier) => tier.id)), 'reachTiers', '圈层');
    preserveIds(published.reachBoostIds, new Set(config.reachBoosts.map((boost) => boost.id)), 'reachBoosts', '助力项');
    const checksum = checksumRuntimeConfig(config);
    if (expectedChecksum && checksum !== expectedChecksum) {
      issues.push({ path: 'checksum', code: 'checksum_mismatch', message: '客户端与服务端规范化配置 checksum 不一致。' });
    }
    return issues.length ? { config, checksum, issues } : { config, checksum, issues: [] };
  }

  getActive(): Promise<LoadedConfigVersion> { return this.store.getActive(); }
  getVersion(version: string): Promise<LoadedConfigVersion | undefined> { return this.store.getVersion(version); }
  listVersions(): Promise<ConfigVersionMetadata[]> { return this.store.listVersions(); }

  async createDraft(configValue: unknown, expectedChecksum: string | undefined, actor: string): Promise<ConfigVersionMetadata | undefined> {
    const result = await this.validate(configValue, expectedChecksum);
    if (!result.config || !result.checksum || result.issues.length) return undefined;
    return this.store.createDraft(result.config, result.checksum, actor);
  }

  async replaceDraft(configValue: unknown, expectedChecksum: string | undefined, revision: number, actor: string): Promise<ConfigVersionMetadata | undefined> {
    const result = await this.validate(configValue, expectedChecksum);
    if (!result.config || !result.checksum || result.issues.length) return undefined;
    return this.store.replaceDraft(result.config, result.checksum, revision, actor);
  }

  async publish(version: string, revision: number, actor: string): Promise<ConfigVersionMetadata | undefined> {
    const loaded = await this.store.getVersion(version);
    if (!loaded) return undefined;
    const expectedActiveVersion = (await this.store.getActive()).config.configBundleVersion;
    const validation = await this.validate(loaded.config, loaded.metadata.checksum);
    if (validation.issues.length) return undefined;
    return this.store.publish(version, revision, expectedActiveVersion, actor);
  }

  activate(version: string, actor: string): Promise<ConfigVersionMetadata | undefined> {
    return this.store.activate(version, actor);
  }
}
