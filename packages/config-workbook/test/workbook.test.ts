import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { cloneRuntimeConfig, defaultRuntimeConfig } from '@tls/model-config';
import { checksumConfig, exportConfigWorkbook, importConfigWorkbook } from '../src/index';

describe('configuration workbook', () => {
  it('round-trips the complete normalized bundle with an identical checksum', async () => {
    const before = await checksumConfig(defaultRuntimeConfig);
    const bytes = await exportConfigWorkbook(defaultRuntimeConfig);
    const imported = await importConfigWorkbook(bytes, 'bundle.xlsx');
    expect(imported.ok).toBe(true);
    expect(imported.issues).toEqual([]);
    expect(imported.checksum).toBe(before);
    expect(imported.config?.catalog.fields).toHaveLength(62);
  });

  it('rejects formula cells without partially importing the workbook', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportConfigWorkbook(defaultRuntimeConfig) as never);
    workbook.getWorksheet('Cities')!.getCell('G2').value = { formula: '1+1', result: 2 };
    const output = await workbook.xlsx.writeBuffer();
    const result = await importConfigWorkbook(new Uint8Array(output as ArrayBuffer), 'formula.xlsx');
    expect(result.ok).toBe(false);
    expect(result.config).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({ sheet: 'Cities', row: 2, column: 'populationMass', errorCode: 'UNSAFE_CELL' }));
  });

  it('rejects unsafe cells even outside data tables and rejects unknown columns', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportConfigWorkbook(defaultRuntimeConfig) as never);
    workbook.getWorksheet('README')!.getCell('A8').value = { formula: 'HYPERLINK("https://example.invalid")', result: 'link' };
    workbook.getWorksheet('Cities')!.getCell('H1').value = 'unexpected';
    workbook.getWorksheet('Cities')!.getCell('H2').value = 'value';
    const output = await workbook.xlsx.writeBuffer();
    const result = await importConfigWorkbook(new Uint8Array(output as ArrayBuffer), 'unsafe.xlsx');
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ sheet: 'README', row: 8, errorCode: 'UNSAFE_CELL' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ sheet: 'Cities', row: 1, column: 'unexpected', errorCode: 'UNKNOWN_COLUMN' }));
  });

  it('rejects an invalid categorical mass total', async () => {
    const invalid = cloneRuntimeConfig();
    const distribution = invalid.model.fields.gender!.distribution;
    if (distribution.kind !== 'categorical') throw new Error('test fixture changed');
    distribution.mass.female = 0.1;
    const result = await importConfigWorkbook(await exportConfigWorkbook(invalid), 'invalid.xlsx');
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ errorCode: 'mass_sum' }));
  });

  it('accepts only .xlsx', async () => {
    const result = await importConfigWorkbook(new Uint8Array(), 'config.xlsm');
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.errorCode).toBe('FILE_TYPE');
  });

  it('rejects a macro payload even when the file is renamed to .xlsx', async () => {
    const archive = await JSZip.loadAsync(await exportConfigWorkbook(defaultRuntimeConfig));
    archive.file('xl/vbaProject.bin', new Uint8Array([1, 2, 3]));
    const disguised = await archive.generateAsync({ type: 'uint8array' });
    const result = await importConfigWorkbook(disguised, 'disguised.xlsx');
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.errorCode).toBe('UNSAFE_PACKAGE');
  });
});
