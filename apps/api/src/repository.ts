import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SnapshotComputed } from '@tls/domain';

export interface StoredRecord {
  recordId: string;
  tokenHash: string;
  revision: number;
  payloadHash: string;
  state: 'draft' | 'completed';
  schemaVersion: string;
  configBundleVersion?: string;
  configChecksum?: string;
  catalogVersion: string;
  modelVersion: string;
  fxVersion: string;
  noticeVersion: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt: number;
  deletedAt?: string;
  snapshot?: SnapshotComputed;
}

export interface RecordRepository {
  get(recordId: string): Promise<StoredRecord | undefined>;
  create(record: StoredRecord): Promise<boolean>;
  replace(record: StoredRecord, expectedRevision: number, expectedTokenHash: string, nowEpoch: number): Promise<boolean>;
  tombstone(record: StoredRecord, expectedRevision: number, expectedTokenHash: string): Promise<boolean>;
}

export class MemoryRecordRepository implements RecordRepository {
  protected readonly records = new Map<string, StoredRecord>();

  async get(recordId: string): Promise<StoredRecord | undefined> {
    return structuredClone(this.records.get(recordId));
  }

  async create(record: StoredRecord): Promise<boolean> {
    if (this.records.has(record.recordId)) return false;
    this.records.set(record.recordId, structuredClone(record));
    await this.afterMutation();
    return true;
  }

  async replace(
    record: StoredRecord,
    expectedRevision: number,
    expectedTokenHash: string,
    nowEpoch: number,
  ): Promise<boolean> {
    const current = this.records.get(record.recordId);
    if (
      !current ||
      current.revision !== expectedRevision ||
      current.tokenHash !== expectedTokenHash ||
      current.deletedAt ||
      current.expiresAt <= nowEpoch
    ) {
      return false;
    }
    this.records.set(record.recordId, structuredClone(record));
    await this.afterMutation();
    return true;
  }

  async tombstone(record: StoredRecord, expectedRevision: number, expectedTokenHash: string): Promise<boolean> {
    const current = this.records.get(record.recordId);
    if (!current || current.revision !== expectedRevision || current.tokenHash !== expectedTokenHash || current.deletedAt) {
      return false;
    }
    this.records.set(record.recordId, structuredClone(record));
    await this.afterMutation();
    return true;
  }

  protected async afterMutation(): Promise<void> {}
}

export class FileRecordRepository extends MemoryRecordRepository {
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string) {
    super();
  }

  static async open(filePath: string): Promise<FileRecordRepository> {
    const repository = new FileRecordRepository(filePath);
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as StoredRecord[];
      for (const record of parsed) repository.records.set(record.recordId, record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return repository;
  }

  protected override async afterMutation(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify([...this.records.values()], null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    await this.writeChain;
  }
}

function isConditionalFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'ConditionalCheckFailedException';
}

export class DynamoRecordRepository implements RecordRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, private readonly tableName: string) {
    this.client = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async get(recordId: string): Promise<StoredRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { recordId }, ConsistentRead: true }),
    );
    return response.Item as StoredRecord | undefined;
  }

  async create(record: StoredRecord): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression: 'attribute_not_exists(recordId)',
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }

  async replace(
    record: StoredRecord,
    expectedRevision: number,
    expectedTokenHash: string,
    nowEpoch: number,
  ): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression:
            'attribute_exists(recordId) AND revision = :revision AND tokenHash = :tokenHash AND attribute_not_exists(deletedAt) AND expiresAt > :now',
          ExpressionAttributeValues: {
            ':revision': expectedRevision,
            ':tokenHash': expectedTokenHash,
            ':now': nowEpoch,
          },
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }

  async tombstone(record: StoredRecord, expectedRevision: number, expectedTokenHash: string): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression:
            'attribute_exists(recordId) AND revision = :revision AND tokenHash = :tokenHash AND attribute_not_exists(deletedAt)',
          ExpressionAttributeValues: {
            ':revision': expectedRevision,
            ':tokenHash': expectedTokenHash,
          },
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }
}
