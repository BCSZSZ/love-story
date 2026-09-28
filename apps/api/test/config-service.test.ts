import { describe, expect, it } from 'vitest';
import { cloneRuntimeConfig } from '@tls/model-config';
import { ConfigService, MemoryConfigStore, checksumRuntimeConfig } from '../src/config-store';

function nextBundle(version: string) {
  const config = cloneRuntimeConfig();
  config.configBundleVersion = version;
  config.catalog.catalogVersion = `catalog-${version}`;
  config.model.catalogVersion = config.catalog.catalogVersion;
  config.model.modelVersion = `model-${version}`;
  return config;
}

describe('configuration service', () => {
  it('rejects changing the kind of a published field', async () => {
    const service = new ConfigService(new MemoryConfigStore());
    const config = nextBundle('bundle-test-kind');
    config.catalog.fields.find((field) => field.id === 'age')!.kind = 'enum';
    const result = await service.validate(config);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'published_kind_changed' }));
  });

  it('uses revision CAS and atomically changes the active pointer on publish', async () => {
    const store = new MemoryConfigStore();
    const service = new ConfigService(store);
    const config = nextBundle('bundle-test-publish');
    const checksum = checksumRuntimeConfig(config);
    const draft = await service.createDraft(config, checksum, 'admin-sub');
    expect(draft?.status).toBe('draft');
    expect(await service.publish(config.configBundleVersion, 99, 'admin-sub')).toBeUndefined();
    const published = await service.publish(config.configBundleVersion, draft!.revision, 'admin-sub');
    expect(published?.status).toBe('published');
    expect((await service.getActive()).config.configBundleVersion).toBe(config.configBundleVersion);
    expect(await service.replaceDraft(config, checksum, published!.revision, 'admin-sub')).toBeUndefined();
  });

  it('detects checksum mismatch server-side', async () => {
    const service = new ConfigService(new MemoryConfigStore());
    const result = await service.validate(nextBundle('bundle-test-checksum'), '0'.repeat(64));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'checksum_mismatch' }));
  });

  it('protects fields from every published version after rolling back the active pointer', async () => {
    const store = new MemoryConfigStore();
    const service = new ConfigService(store);
    const withNewField = nextBundle('bundle-test-history');
    withNewField.catalog.fields.push({
      id: 'published_later', label: '后来发布的问题', group: withNewField.catalog.groups[0]!.id,
      kind: 'enum', status: 'active', selfControl: 'single_choice', requirementControl: 'acceptable_multi_choice',
      allowedOperators: ['in'], requiredSelf: false, sensitive: false, sourceItem: 'test', note: '',
      scoreEnabled: false, presets: [], options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }],
    });
    withNewField.model.fields.published_later = {
      distribution: { kind: 'categorical', mass: { yes: 0.5, no: 0.5 } },
      score: { kind: 'excluded', weight: 0 },
    };
    const draft = await service.createDraft(withNewField, checksumRuntimeConfig(withNewField), 'admin-sub');
    await service.publish(withNewField.configBundleVersion, draft!.revision, 'admin-sub');
    await service.activate('config-bundle-demo-2.0.0', 'admin-sub');

    const candidateAfterRollback = nextBundle('bundle-test-after-rollback');
    const result = await service.validate(candidateAfterRollback);
    const definitions = await service.publishedDefinitions();
    expect(definitions.fields.published_later).toEqual({ kind: 'enum', optionIds: ['no', 'yes'] });
    expect(result.issues).toContainEqual(expect.objectContaining({
      path: 'catalog.fields.published_later',
      code: 'published_field_removed',
    }));
  });
});
