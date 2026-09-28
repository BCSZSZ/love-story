import { describe, expect, it } from 'vitest';
import { cloneRuntimeConfig, defaultRuntimeConfig, validateRuntimeConfig } from '../src/index';

describe('runtime configuration validation', () => {
  it('accepts the packaged v2 configuration', () => {
    expect(validateRuntimeConfig(defaultRuntimeConfig).issues).toEqual([]);
  });

  it('requires active categorical options, rather than retired history, to sum to one', () => {
    const config = cloneRuntimeConfig();
    const field = config.catalog.fields.find((candidate) => candidate.id === 'gender')!;
    const retired = field.options![0]!;
    retired.status = 'retired';
    const distribution = config.model.fields.gender!.distribution;
    if (distribution.kind !== 'categorical') throw new Error('fixture changed');
    const active = field.options!.filter((option) => option.status !== 'retired');
    const activeTotal = active.reduce((sum, option) => sum + distribution.mass[option.id]!, 0);
    for (const option of active) distribution.mass[option.id] = distribution.mass[option.id]! / activeTotal;

    expect(validateRuntimeConfig(config).issues).toEqual([]);
  });

  it('rejects numeric buckets that do not cover the complete configured domain', () => {
    const config = cloneRuntimeConfig();
    const distribution = config.model.fields.age!.distribution;
    if (distribution.kind !== 'bucket_uniform_discrete') throw new Error('fixture changed');
    distribution.buckets[0]!.from += 1;

    expect(validateRuntimeConfig(config).issues).toContainEqual(expect.objectContaining({ code: 'bucket_coverage' }));
  });

  it('rejects presets that reference an inactive or unknown option', () => {
    const config = cloneRuntimeConfig();
    const field = config.catalog.fields.find((candidate) => candidate.id === 'hukou')!;
    field.presets[0]!.values = ['not_an_option'];

    expect(validateRuntimeConfig(config).issues).toContainEqual(expect.objectContaining({ code: 'invalid_preset' }));
  });
});
