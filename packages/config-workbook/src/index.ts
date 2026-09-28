import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  canonicalJson,
  parseRuntimeConfigBundle,
  type CatalogField,
  type ConfigValidationIssue,
  type Distribution,
  type RuntimeConfigBundle,
  type ScoreDefinition,
} from '@tls/domain';
import { normalizeRuntimeConfig, validateRuntimeConfig } from '@tls/model-config';

export const WORKBOOK_TEMPLATE_VERSION = 'tls-config-workbook-1';
export const WORKBOOK_MAX_BYTES = 5 * 1024 * 1024;
export const WORKBOOK_MAX_DATA_ROWS = 10_000;

const SHEETS = [
  'README', 'Manifest', 'Cities', 'Fields', 'Options', 'NumericBuckets', 'Presets',
  'RelativePresets', 'ScoreKnots', 'ReachTiers', 'ReachBoosts', 'StrictnessLevels',
] as const;

type SheetName = (typeof SHEETS)[number];

export interface WorkbookIssue {
  sheet: string;
  row: number;
  column: string;
  errorCode: string;
  message: string;
}

export interface WorkbookImportResult {
  ok: boolean;
  issues: WorkbookIssue[];
  config?: RuntimeConfigBundle;
  checksum?: string;
}

/** Removes representation-only differences so workbook round trips have a stable checksum. */
export function normalizeConfigBundle(config: RuntimeConfigBundle): RuntimeConfigBundle {
  return normalizeRuntimeConfig(config);
}

const columns: Record<Exclude<SheetName, 'README'>, string[]> = {
  Manifest: [
    'templateVersion', 'schemaVersion', 'bundleVersion', 'noticeVersion', 'catalogVersion', 'modelVersion',
    'fxVersion', 'language', 'dataStatus', 'basePopulation', 'adultFraction', 'cityResidualMass',
    'currencyBase', 'cnyPerCny', 'cnyPerJpy', 'currencyStatus', 'notes',
  ],
  Cities: ['cityId', 'label', 'titleLabel', 'status', 'isDefault', 'order', 'populationMass'],
  Fields: [
    'fieldId', 'groupId', 'groupLabel', 'label', 'kind', 'selfControl', 'requirementControl',
    'allowedOperators', 'status', 'order', 'sensitive', 'requiredSelf', 'sourceItem', 'note',
    'unit', 'minimum', 'maximum', 'step', 'scoreEnabled', 'scoreWeight',
  ],
  Options: ['fieldId', 'optionId', 'label', 'enabled', 'order', 'populationMass', 'scoreValue'],
  NumericBuckets: ['fieldId', 'bucketId', 'from', 'toExclusive', 'mass', 'order'],
  Presets: ['fieldId', 'presetId', 'label', 'operator', 'value', 'min', 'max', 'valuesCsv', 'order', 'enabled'],
  RelativePresets: [
    'fieldId', 'presetId', 'label', 'sourceFieldId', 'comparison', 'offset', 'minOffset',
    'maxOffset', 'order', 'enabled',
  ],
  ScoreKnots: ['fieldId', 'value', 'score', 'order'],
  ReachTiers: ['tierId', 'label', 'people', 'isDefault', 'order', 'enabled'],
  ReachBoosts: ['boostId', 'label', 'incrementRate', 'order', 'enabled'],
  StrictnessLevels: ['levelId', 'label', 'coefficient', 'order', 'isDefault'],
};

function styleSheet(sheet: ExcelJS.Worksheet, widths: Record<string, number> = {}): void {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF71584B' } };
  header.alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, sheet.columnCount) } };
  for (const column of sheet.columns) {
    const key = String(column.key ?? '');
    column.width = widths[key] ?? 18;
  }
}

function addTableSheet(workbook: ExcelJS.Workbook, name: Exclude<SheetName, 'README'>): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 20 } });
  sheet.columns = columns[name].map((key) => ({ header: key, key }));
  return sheet;
}

function enabled(status: 'active' | 'retired' | undefined): boolean {
  return status !== 'retired';
}

export async function exportConfigWorkbook(config: RuntimeConfigBundle): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '东京·爱情故事配置后台';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = false;

  const readme = workbook.addWorksheet('README');
  readme.addRows([
    ['东京·爱情故事｜配置交换工作簿'],
    [`模板版本：${WORKBOOK_TEMPLATE_VERSION}`],
    ['比例统一使用 0～1 小数，例如 20% 写为 0.2。'],
    ['只接受 .xlsx；不得使用公式、宏、外部链接或自定义代码。'],
    ['导入只创建配置草稿，不会自动发布。所有数字均为演示配置。'],
    ['已发布 fieldId 与问题类型不可改写；下线旧问题请将 status 改为 retired。'],
  ]);
  readme.getColumn(1).width = 95;
  readme.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF71584B' } };

  const manifest = addTableSheet(workbook, 'Manifest');
  manifest.addRow({
    templateVersion: WORKBOOK_TEMPLATE_VERSION,
    schemaVersion: config.schemaVersion,
    bundleVersion: config.configBundleVersion,
    noticeVersion: config.noticeVersion,
    catalogVersion: config.catalog.catalogVersion,
    modelVersion: config.model.modelVersion,
    fxVersion: config.model.currency.rateVersion,
    language: config.catalog.language,
    dataStatus: config.model.status,
    basePopulation: config.model.basePopulation,
    adultFraction: config.model.adultFraction,
    cityResidualMass: config.cityResidualMass,
    currencyBase: config.model.currency.base,
    cnyPerCny: config.model.currency.demoCnyPerUnit.CNY,
    cnyPerJpy: config.model.currency.demoCnyPerUnit.JPY,
    currencyStatus: config.model.currency.status,
    notes: '演示配置；非真实人口统计。',
  });

  const cities = addTableSheet(workbook, 'Cities');
  config.cities.forEach((city, index) => cities.addRow({
    cityId: city.id, label: city.label, titleLabel: city.titleLabel, status: city.status,
    isDefault: city.id === config.defaultCityId, order: index + 1, populationMass: city.populationMass,
  }));

  const fields = addTableSheet(workbook, 'Fields');
  const options = addTableSheet(workbook, 'Options');
  const buckets = addTableSheet(workbook, 'NumericBuckets');
  const presets = addTableSheet(workbook, 'Presets');
  const relativePresets = addTableSheet(workbook, 'RelativePresets');
  const scoreKnots = addTableSheet(workbook, 'ScoreKnots');
  const groupLabels = new Map(config.catalog.groups.map((group) => [group.id, group.label]));

  config.catalog.fields.forEach((field, fieldIndex) => {
    const configured = config.model.fields[field.id];
    const score = configured?.score;
    fields.addRow({
      fieldId: field.id,
      groupId: field.group,
      groupLabel: groupLabels.get(field.group) ?? field.group,
      label: field.label,
      kind: field.kind,
      selfControl: field.selfControl,
      requirementControl: field.requirementControl,
      allowedOperators: field.allowedOperators.join(','),
      status: field.status,
      order: fieldIndex + 1,
      sensitive: field.sensitive,
      requiredSelf: field.requiredSelf,
      sourceItem: field.sourceItem,
      note: field.note,
      unit: field.unit,
      minimum: field.minimum,
      maximum: field.maximum,
      step: field.step,
      scoreEnabled: score?.kind !== 'excluded',
      scoreWeight: score?.weight ?? 0,
    });
    const distribution = configured?.distribution;
    (field.options ?? []).forEach((option, optionIndex) => {
      const mass = distribution?.kind === 'categorical' || distribution?.kind === 'independent_tags'
        ? distribution.mass[option.id]
        : undefined;
      const scoreValue = score?.kind === 'category_map' ? score.values[option.id] : undefined;
      options.addRow({
        fieldId: field.id, optionId: option.id, label: option.label, enabled: enabled(option.status),
        order: optionIndex + 1, populationMass: mass, scoreValue,
      });
    });
    if (distribution?.kind === 'bucket_uniform_discrete') {
      distribution.buckets.forEach((bucket, index) => buckets.addRow({
        fieldId: field.id, bucketId: `${field.id}_bucket_${index + 1}`, from: bucket.from,
        toExclusive: bucket.toExclusive, mass: bucket.mass, order: index + 1,
      }));
    }
    field.presets.forEach((preset, index) => presets.addRow({
      fieldId: field.id, presetId: preset.id, label: preset.label, operator: preset.op, value: preset.value,
      min: preset.min, max: preset.max, valuesCsv: preset.values?.join(','), order: index + 1,
      enabled: enabled(preset.status),
    }));
    (field.relativePresets ?? []).forEach((preset, index) => relativePresets.addRow({
      fieldId: field.id, presetId: preset.id, label: preset.label,
      sourceFieldId: preset.sourceFieldId ?? field.id,
      comparison: preset.minOffset !== undefined ? 'between' : preset.operator,
      offset: preset.offset, minOffset: preset.minOffset, maxOffset: preset.maxOffset,
      order: index + 1, enabled: enabled(preset.status),
    }));
    if (score?.kind === 'piecewise_linear') {
      score.knots.forEach((knot, index) => scoreKnots.addRow({
        fieldId: field.id, value: knot.value, score: knot.score, order: index + 1,
      }));
    }
  });

  const reachTiers = addTableSheet(workbook, 'ReachTiers');
  config.reachTiers.forEach((tier, index) => reachTiers.addRow({
    tierId: tier.id, label: tier.label, people: tier.people, isDefault: tier.isDefault,
    order: index + 1, enabled: tier.status === 'active',
  }));
  const reachBoosts = addTableSheet(workbook, 'ReachBoosts');
  config.reachBoosts.forEach((boost, index) => reachBoosts.addRow({
    boostId: boost.id, label: boost.label, incrementRate: boost.incrementRate,
    order: index + 1, enabled: boost.status === 'active',
  }));
  const strictness = addTableSheet(workbook, 'StrictnessLevels');
  config.strictnessLevels.forEach((level, index) => strictness.addRow({
    levelId: level.id, label: level.label, coefficient: level.coefficient,
    order: index + 1, isDefault: level.isDefault,
  }));

  for (const name of SHEETS.slice(1)) styleSheet(workbook.getWorksheet(name)!);
  ['adultFraction', 'cityResidualMass', 'populationMass', 'incrementRate', 'coefficient'].forEach((key) => {
    for (const sheet of workbook.worksheets) {
      const column = sheet.columns.find((candidate) => candidate.key === key);
      if (column) column.numFmt = '0.000000';
    }
  });
  const output = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(output as ArrayBuffer);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

interface RowReader {
  sheet: string;
  row: number;
  raw: Record<string, unknown>;
}

function primitive(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function scanUnsafeCells(sheet: ExcelJS.Worksheet, issues: WorkbookIssue[]): void {
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const value = primitive(cell.value);
      if (typeof value === 'object' && value !== null) {
        issues.push({
          sheet: sheet.name,
          row: rowNumber,
          column: cell.address || String(columnNumber),
          errorCode: 'UNSAFE_CELL',
          message: '公式、超链接、富文本和外部引用不允许导入。',
        });
      }
    });
  });
}

function validateColumns(sheet: ExcelJS.Worksheet, name: Exclude<SheetName, 'README'>, issues: WorkbookIssue[]): void {
  const actual: string[] = [];
  sheet.getRow(1).eachCell((cell) => {
    const value = primitive(cell.value);
    if (typeof value === 'string' && value.trim()) actual.push(value.trim());
  });
  const expected = new Set(columns[name]);
  for (const header of actual) {
    if (!expected.has(header)) issues.push({ sheet: name, row: 1, column: header, errorCode: 'UNKNOWN_COLUMN', message: `${header} 不是允许的列。` });
  }
  const actualSet = new Set(actual);
  for (const header of expected) {
    if (!actualSet.has(header)) issues.push({ sheet: name, row: 1, column: header, errorCode: 'MISSING_COLUMN', message: `缺少必需列 ${header}。` });
  }
}

function readRows(sheet: ExcelJS.Worksheet, issues: WorkbookIssue[]): RowReader[] {
  const headers = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, column) => {
    const value = primitive(cell.value);
    if (typeof value === 'string' && value.trim()) headers.set(column, value.trim());
  });
  const rows: RowReader[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw: Record<string, unknown> = {};
    let hasValue = false;
    for (const [columnNumber, header] of headers) {
      const value = primitive(row.getCell(columnNumber).value);
      if (typeof value === 'object' && value !== null) {
        issues.push({
          sheet: sheet.name, row: rowNumber, column: header, errorCode: 'UNSAFE_CELL',
          message: '公式、超链接、富文本和外部引用不允许导入。',
        });
        continue;
      }
      if (value !== undefined && value !== '') hasValue = true;
      raw[header] = value;
    }
    if (hasValue) rows.push({ sheet: sheet.name, row: rowNumber, raw });
  }
  return rows;
}

function issue(rows: RowReader[], row: number, column: string, errorCode: string, message: string): WorkbookIssue {
  return { sheet: rows[0]?.sheet ?? 'Workbook', row, column, errorCode, message };
}

function stringValue(row: RowReader, key: string, issues: WorkbookIssue[], required = true): string | undefined {
  const value = row.raw[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value !== undefined && value !== null && value !== '') return String(value).trim();
  if (required) issues.push({ sheet: row.sheet, row: row.row, column: key, errorCode: 'REQUIRED', message: `${key} 不能为空。` });
  return undefined;
}

function numberValue(row: RowReader, key: string, issues: WorkbookIssue[], required = true): number | undefined {
  const value = row.raw[key];
  const parsed = typeof value === 'number' ? value : value === undefined || value === '' ? Number.NaN : Number(value);
  if (Number.isFinite(parsed)) return parsed;
  if (required) issues.push({ sheet: row.sheet, row: row.row, column: key, errorCode: 'NUMBER', message: `${key} 必须是有限数字。` });
  return undefined;
}

function boolValue(row: RowReader, key: string, issues: WorkbookIssue[], defaultValue = false): boolean {
  const value = row.raw[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true' || value === '是') return true;
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false' || value === '否' || value === undefined || value === '') return false;
  issues.push({ sheet: row.sheet, row: row.row, column: key, errorCode: 'BOOLEAN', message: `${key} 必须是 TRUE/FALSE。` });
  return defaultValue;
}

function ordered(rows: RowReader[]): RowReader[] {
  return [...rows].sort((left, right) => Number(left.raw.order ?? left.row) - Number(right.raw.order ?? right.row));
}

function grouped(rows: RowReader[], key: string): Map<string, RowReader[]> {
  const result = new Map<string, RowReader[]>();
  for (const row of ordered(rows)) {
    const id = String(row.raw[key] ?? '');
    result.set(id, [...(result.get(id) ?? []), row]);
  }
  return result;
}

function mapValidationIssue(configIssue: ConfigValidationIssue): WorkbookIssue {
  return { sheet: 'NormalizedConfig', row: 0, column: configIssue.path, errorCode: configIssue.code, message: configIssue.message };
}

export async function checksumConfig(config: RuntimeConfigBundle): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(normalizeConfigBundle(config)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function importConfigWorkbook(input: ArrayBuffer | Uint8Array, fileName = 'config.xlsx'): Promise<WorkbookImportResult> {
  const issues: WorkbookIssue[] = [];
  if (!fileName.toLowerCase().endsWith('.xlsx') || /\.(xlsm|xls)$/i.test(fileName)) {
    return { ok: false, issues: [{ sheet: 'Workbook', row: 0, column: 'file', errorCode: 'FILE_TYPE', message: '只接受不含宏的 .xlsx 文件。' }] };
  }
  const byteLength = input instanceof Uint8Array ? input.byteLength : input.byteLength;
  if (byteLength > WORKBOOK_MAX_BYTES) {
    return { ok: false, issues: [{ sheet: 'Workbook', row: 0, column: 'file', errorCode: 'FILE_TOO_LARGE', message: '文件不能超过 5 MiB。' }] };
  }
  try {
    const archive = await JSZip.loadAsync(input);
    const unsafePart = Object.keys(archive.files).find((name) =>
      /(^|\/)vbaProject\.bin$/i.test(name) || /^xl\/externalLinks\//i.test(name) || /^xl\/connections\.xml$/i.test(name),
    );
    if (unsafePart) {
      return { ok: false, issues: [{ sheet: 'Workbook', row: 0, column: unsafePart, errorCode: 'UNSAFE_PACKAGE', message: '工作簿包含宏或外部数据连接。' }] };
    }
  } catch {
    return { ok: false, issues: [{ sheet: 'Workbook', row: 0, column: 'file', errorCode: 'INVALID_XLSX', message: '无法解析工作簿容器。' }] };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(input as never);
  } catch {
    return { ok: false, issues: [{ sheet: 'Workbook', row: 0, column: 'file', errorCode: 'INVALID_XLSX', message: '无法解析工作簿。' }] };
  }
  const unexpected = workbook.worksheets.map((sheet) => sheet.name).filter((name) => !SHEETS.includes(name as SheetName));
  for (const name of unexpected) issues.push({ sheet: name, row: 0, column: '', errorCode: 'UNKNOWN_SHEET', message: '工作簿包含不允许的 sheet。' });
  const rows = new Map<SheetName, RowReader[]>();
  let totalRows = 0;
  for (const name of SHEETS) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) {
      issues.push({ sheet: name, row: 0, column: '', errorCode: 'MISSING_SHEET', message: `缺少 ${name} sheet。` });
      rows.set(name, []);
      continue;
    }
    scanUnsafeCells(sheet, issues);
    if (name === 'README') continue;
    validateColumns(sheet, name, issues);
    const read = readRows(sheet, issues);
    rows.set(name, read);
    totalRows += read.length;
  }
  if (totalRows > WORKBOOK_MAX_DATA_ROWS) issues.push({ sheet: 'Workbook', row: 0, column: '', errorCode: 'TOO_MANY_ROWS', message: '数据行不能超过 10,000。' });
  const manifestRows = rows.get('Manifest') ?? [];
  if (manifestRows.length !== 1) issues.push(issue(manifestRows, 0, '', 'MANIFEST_COUNT', 'Manifest 必须且只能有一行数据。'));
  const manifest = manifestRows[0];
  if (!manifest || issues.some((entry) => ['UNSAFE_CELL', 'MISSING_SHEET', 'UNKNOWN_SHEET', 'MISSING_COLUMN', 'UNKNOWN_COLUMN', 'TOO_MANY_ROWS'].includes(entry.errorCode))) {
    return { ok: false, issues };
  }

  const templateVersion = stringValue(manifest, 'templateVersion', issues);
  if (templateVersion !== WORKBOOK_TEMPLATE_VERSION) {
    issues.push({ sheet: 'Manifest', row: manifest.row, column: 'templateVersion', errorCode: 'TEMPLATE_VERSION', message: '工作簿模板版本不受支持。' });
  }
  const fieldRows = ordered(rows.get('Fields') ?? []);
  const optionRows = grouped(rows.get('Options') ?? [], 'fieldId');
  const bucketRows = grouped(rows.get('NumericBuckets') ?? [], 'fieldId');
  const presetRows = grouped(rows.get('Presets') ?? [], 'fieldId');
  const relativeRows = grouped(rows.get('RelativePresets') ?? [], 'fieldId');
  const knotRows = grouped(rows.get('ScoreKnots') ?? [], 'fieldId');
  const groups = new Map<string, string>();
  const fields: CatalogField[] = [];
  const modelFields: RuntimeConfigBundle['model']['fields'] = {};

  for (const row of fieldRows) {
    const fieldId = stringValue(row, 'fieldId', issues);
    const groupId = stringValue(row, 'groupId', issues);
    const groupLabel = stringValue(row, 'groupLabel', issues);
    const label = stringValue(row, 'label', issues);
    const kind = stringValue(row, 'kind', issues);
    if (!fieldId || !groupId || !groupLabel || !label || !kind) continue;
    groups.set(groupId, groupLabel);
    const fieldOptions = ordered(optionRows.get(fieldId) ?? []).map((optionRow) => ({
      id: stringValue(optionRow, 'optionId', issues) ?? '',
      label: stringValue(optionRow, 'label', issues) ?? '',
      status: boolValue(optionRow, 'enabled', issues, true) ? 'active' as const : 'retired' as const,
    })).filter((option) => option.id && option.label);
    const fieldPresets = ordered(presetRows.get(fieldId) ?? []).map((presetRow) => {
      const operator = stringValue(presetRow, 'operator', issues, false);
      const values = stringValue(presetRow, 'valuesCsv', issues, false)?.split(',').map((value) => value.trim()).filter(Boolean);
      return {
        ...(stringValue(presetRow, 'presetId', issues, false) ? { id: stringValue(presetRow, 'presetId', issues, false)! } : {}),
        label: stringValue(presetRow, 'label', issues) ?? '',
        ...(values?.length ? { values } : {}),
        ...(operator ? { op: operator as 'gte' | 'lte' | 'between' } : {}),
        ...(numberValue(presetRow, 'value', issues, false) !== undefined ? { value: numberValue(presetRow, 'value', issues, false)! } : {}),
        ...(numberValue(presetRow, 'min', issues, false) !== undefined ? { min: numberValue(presetRow, 'min', issues, false)! } : {}),
        ...(numberValue(presetRow, 'max', issues, false) !== undefined ? { max: numberValue(presetRow, 'max', issues, false)! } : {}),
        status: boolValue(presetRow, 'enabled', issues, true) ? 'active' as const : 'retired' as const,
      };
    }).filter((preset) => preset.label);
    const fieldRelativePresets = ordered(relativeRows.get(fieldId) ?? []).map((relativeRow) => {
      const comparison = stringValue(relativeRow, 'comparison', issues, false);
      return {
        ...(stringValue(relativeRow, 'presetId', issues, false) ? { id: stringValue(relativeRow, 'presetId', issues, false)! } : {}),
        label: stringValue(relativeRow, 'label', issues) ?? '',
        ...(stringValue(relativeRow, 'sourceFieldId', issues, false) ? { sourceFieldId: stringValue(relativeRow, 'sourceFieldId', issues, false)! } : {}),
        ...(comparison && comparison !== 'between' ? { operator: comparison as 'gte' | 'lte' } : {}),
        ...(numberValue(relativeRow, 'offset', issues, false) !== undefined ? { offset: numberValue(relativeRow, 'offset', issues, false)! } : {}),
        ...(numberValue(relativeRow, 'minOffset', issues, false) !== undefined ? { minOffset: numberValue(relativeRow, 'minOffset', issues, false)! } : {}),
        ...(numberValue(relativeRow, 'maxOffset', issues, false) !== undefined ? { maxOffset: numberValue(relativeRow, 'maxOffset', issues, false)! } : {}),
        status: boolValue(relativeRow, 'enabled', issues, true) ? 'active' as const : 'retired' as const,
      };
    }).filter((preset) => preset.label);
    const field: CatalogField = {
      id: fieldId,
      label,
      group: groupId,
      kind: kind as CatalogField['kind'],
      status: stringValue(row, 'status', issues) as CatalogField['status'],
      selfControl: stringValue(row, 'selfControl', issues) ?? '',
      requirementControl: stringValue(row, 'requirementControl', issues) ?? '',
      allowedOperators: (stringValue(row, 'allowedOperators', issues) ?? '').split(',').map((value) => value.trim()).filter(Boolean),
      requiredSelf: boolValue(row, 'requiredSelf', issues),
      sensitive: boolValue(row, 'sensitive', issues),
      sourceItem: stringValue(row, 'sourceItem', issues, false) ?? '',
      note: stringValue(row, 'note', issues, false) ?? '',
      scoreEnabled: boolValue(row, 'scoreEnabled', issues),
      presets: fieldPresets,
      ...(fieldOptions.length ? { options: fieldOptions } : {}),
      ...(fieldRelativePresets.length ? { relativePresets: fieldRelativePresets } : {}),
      ...(stringValue(row, 'unit', issues, false) ? { unit: stringValue(row, 'unit', issues, false)! } : {}),
      ...(numberValue(row, 'minimum', issues, false) !== undefined ? { minimum: numberValue(row, 'minimum', issues, false)! } : {}),
      ...(numberValue(row, 'maximum', issues, false) !== undefined ? { maximum: numberValue(row, 'maximum', issues, false)! } : {}),
      ...(numberValue(row, 'step', issues, false) !== undefined ? { step: numberValue(row, 'step', issues, false)! } : {}),
    };
    fields.push(field);

    let distribution: Distribution;
    if (kind === 'number') {
      distribution = {
        kind: 'bucket_uniform_discrete',
        buckets: ordered(bucketRows.get(fieldId) ?? []).map((bucketRow) => ({
          from: numberValue(bucketRow, 'from', issues) ?? 0,
          toExclusive: numberValue(bucketRow, 'toExclusive', issues) ?? 0,
          mass: numberValue(bucketRow, 'mass', issues) ?? 0,
        })),
      };
    } else {
      distribution = {
        kind: kind === 'tags' ? 'independent_tags' : 'categorical',
        mass: Object.fromEntries(ordered(optionRows.get(fieldId) ?? []).map((optionRow) => [
          stringValue(optionRow, 'optionId', issues) ?? '',
          numberValue(optionRow, 'populationMass', issues) ?? 0,
        ]).filter(([id]) => id)),
      };
    }
    const scoreEnabled = boolValue(row, 'scoreEnabled', issues);
    let score: ScoreDefinition = { kind: 'excluded', weight: 0 };
    if (scoreEnabled && kind === 'number') {
      score = {
        kind: 'piecewise_linear',
        weight: numberValue(row, 'scoreWeight', issues) ?? 0,
        knots: ordered(knotRows.get(fieldId) ?? []).map((knotRow) => ({
          value: numberValue(knotRow, 'value', issues) ?? 0,
          score: numberValue(knotRow, 'score', issues) ?? 0,
        })),
      };
    } else if (scoreEnabled) {
      score = {
        kind: 'category_map',
        weight: numberValue(row, 'scoreWeight', issues) ?? 0,
        values: Object.fromEntries(ordered(optionRows.get(fieldId) ?? []).map((optionRow) => [
          stringValue(optionRow, 'optionId', issues) ?? '',
          numberValue(optionRow, 'scoreValue', issues) ?? 0,
        ]).filter(([id]) => id)),
      };
    }
    modelFields[fieldId] = { distribution, score };
  }

  const cityRows = ordered(rows.get('Cities') ?? []);
  const defaultCities = cityRows.filter((row) => boolValue(row, 'isDefault', issues));
  const configCandidate = {
    schemaVersion: stringValue(manifest, 'schemaVersion', issues),
    configBundleVersion: stringValue(manifest, 'bundleVersion', issues),
    noticeVersion: stringValue(manifest, 'noticeVersion', issues),
    catalog: {
      schemaVersion: stringValue(manifest, 'schemaVersion', issues),
      catalogVersion: stringValue(manifest, 'catalogVersion', issues),
      language: stringValue(manifest, 'language', issues),
      groups: [...groups].map(([id, label]) => ({ id, label })),
      fields,
    },
    model: {
      schemaVersion: stringValue(manifest, 'schemaVersion', issues),
      modelVersion: stringValue(manifest, 'modelVersion', issues),
      catalogVersion: stringValue(manifest, 'catalogVersion', issues),
      status: stringValue(manifest, 'dataStatus', issues),
      basePopulation: numberValue(manifest, 'basePopulation', issues),
      adultFraction: numberValue(manifest, 'adultFraction', issues),
      currency: {
        base: stringValue(manifest, 'currencyBase', issues),
        demoCnyPerUnit: {
          CNY: numberValue(manifest, 'cnyPerCny', issues),
          JPY: numberValue(manifest, 'cnyPerJpy', issues),
        },
        status: stringValue(manifest, 'currencyStatus', issues),
        rateVersion: stringValue(manifest, 'fxVersion', issues),
      },
      fields: modelFields,
    },
    cities: cityRows.map((row) => ({
      id: stringValue(row, 'cityId', issues), label: stringValue(row, 'label', issues),
      titleLabel: stringValue(row, 'titleLabel', issues),
      status: stringValue(row, 'status', issues), populationMass: numberValue(row, 'populationMass', issues),
    })),
    cityResidualMass: numberValue(manifest, 'cityResidualMass', issues),
    defaultCityId: defaultCities[0] ? stringValue(defaultCities[0], 'cityId', issues) : '',
    reachTiers: ordered(rows.get('ReachTiers') ?? []).map((row) => ({
      id: stringValue(row, 'tierId', issues), label: stringValue(row, 'label', issues),
      people: numberValue(row, 'people', issues), isDefault: boolValue(row, 'isDefault', issues),
      status: boolValue(row, 'enabled', issues, true) ? 'active' : 'retired',
    })),
    reachBoosts: ordered(rows.get('ReachBoosts') ?? []).map((row) => ({
      id: stringValue(row, 'boostId', issues), label: stringValue(row, 'label', issues),
      incrementRate: numberValue(row, 'incrementRate', issues),
      status: boolValue(row, 'enabled', issues, true) ? 'active' : 'retired',
    })),
    strictnessLevels: ordered(rows.get('StrictnessLevels') ?? []).map((row) => ({
      id: stringValue(row, 'levelId', issues), label: stringValue(row, 'label', issues),
      coefficient: numberValue(row, 'coefficient', issues), isDefault: boolValue(row, 'isDefault', issues),
    })),
  };
  if (issues.length) return { ok: false, issues };
  let config: RuntimeConfigBundle;
  try {
    config = parseRuntimeConfigBundle(configCandidate);
  } catch (error) {
    return {
      ok: false,
      issues: [{ sheet: 'NormalizedConfig', row: 0, column: '', errorCode: 'SCHEMA', message: error instanceof Error ? error.message : '配置结构无效。' }],
    };
  }
  const validation = validateRuntimeConfig(config);
  if (validation.issues.length) return { ok: false, issues: validation.issues.map(mapValidationIssue) };
  return { ok: true, issues: [], config, checksum: await checksumConfig(config) };
}
