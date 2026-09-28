import { useEffect, useMemo, useState } from 'react';
import type {
  CatalogField,
  ConfigValidationIssue,
  ConfigVersionMetadata,
  PublishedConfigDefinitions,
  RuntimeConfigBundle,
} from '@tls/domain';
import { cloneRuntimeConfig, validateRuntimeConfig } from '@tls/model-config';
import { computeRuntimeConfigChecksum } from './runtime-config';
import { useAdminAuth } from './admin-auth';

type Tab = 'overview' | 'fields' | 'reach' | 'strictness' | 'release';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '配置概览' },
  { id: 'fields', label: '条件管理' },
  { id: 'reach', label: '城市与圈层' },
  { id: 'strictness', label: '放宽档位' },
  { id: 'release', label: '导入、导出与发布' },
];

interface AdminPageProps {
  fallbackConfig: RuntimeConfigBundle;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Input({ value, onChange, type = 'text', step }: { value: string | number; onChange: (value: string) => void; type?: string; step?: string }) {
  return <input type={type} step={step} value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
}

function localIssues(config: RuntimeConfigBundle): ConfigValidationIssue[] {
  return validateRuntimeConfig(config).issues;
}

function nextId(prefix: string, used: Iterable<string>): string {
  const existing = new Set(used);
  let index = 1;
  while (existing.has(`${prefix}_${index}`)) index += 1;
  return `${prefix}_${index}`;
}

function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): void {
  const index = items.findIndex((item) => item.id === id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= items.length) return;
  const [item] = items.splice(index, 1);
  items.splice(destination, 0, item!);
}

interface ConfigDiffEntry {
  area: string;
  id: string;
  change: '新增' | '删除' | '修改';
}

function diffCollection<T extends { id: string }>(area: string, before: T[], after: T[]): ConfigDiffEntry[] {
  const left = new Map(before.map((item) => [item.id, item]));
  const right = new Map(after.map((item) => [item.id, item]));
  return [...new Set([...left.keys(), ...right.keys()])].flatMap<ConfigDiffEntry>((id): ConfigDiffEntry[] => {
    const previous = left.get(id);
    const next = right.get(id);
    if (!previous) return [{ area, id, change: '新增' as const }];
    if (!next) return [{ area, id, change: '删除' as const }];
    return JSON.stringify(previous) === JSON.stringify(next) ? [] : [{ area, id, change: '修改' as const }];
  });
}

function diffRuntimeConfig(before: RuntimeConfigBundle, after: RuntimeConfigBundle): ConfigDiffEntry[] {
  const entries: ConfigDiffEntry[] = [];
  if (before.configBundleVersion !== after.configBundleVersion) entries.push({ area: '版本', id: 'configBundleVersion', change: '修改' });
  if (before.catalog.catalogVersion !== after.catalog.catalogVersion) entries.push({ area: '版本', id: 'catalogVersion', change: '修改' });
  if (before.model.modelVersion !== after.model.modelVersion) entries.push({ area: '版本', id: 'modelVersion', change: '修改' });
  entries.push(...diffCollection('问题定义', before.catalog.fields, after.catalog.fields));
  const modelIds = new Set([...Object.keys(before.model.fields), ...Object.keys(after.model.fields)]);
  for (const id of modelIds) {
    const left = before.model.fields[id];
    const right = after.model.fields[id];
    if (!left) entries.push({ area: '比例/评分', id, change: '新增' });
    else if (!right) entries.push({ area: '比例/评分', id, change: '删除' });
    else if (JSON.stringify(left) !== JSON.stringify(right)) entries.push({ area: '比例/评分', id, change: '修改' });
  }
  entries.push(...diffCollection('城市', before.cities, after.cities));
  entries.push(...diffCollection('圈层', before.reachTiers, after.reachTiers));
  entries.push(...diffCollection('助力', before.reachBoosts, after.reachBoosts));
  entries.push(...diffCollection('放宽档位', before.strictnessLevels, after.strictnessLevels));
  if (before.cityResidualMass !== after.cityResidualMass) entries.push({ area: '城市', id: 'residualMass', change: '修改' });
  return entries;
}

export function AdminPage({ fallbackConfig }: AdminPageProps) {
  const auth = useAdminAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState(() => cloneRuntimeConfig(fallbackConfig));
  const [baseline, setBaseline] = useState(() => cloneRuntimeConfig(fallbackConfig));
  const [metadata, setMetadata] = useState<ConfigVersionMetadata>();
  const [versions, setVersions] = useState<ConfigVersionMetadata[]>([]);
  const [activeVersion, setActiveVersion] = useState(fallbackConfig.configBundleVersion);
  const [selectedFieldId, setSelectedFieldId] = useState(fallbackConfig.catalog.fields[0]?.id ?? '');
  const [message, setMessage] = useState('尚未从服务端载入配置。');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<ConfigValidationIssue[]>([]);
  const [newField, setNewField] = useState({ id: '', label: '', kind: 'enum' as CatalogField['kind'] });
  const [newOption, setNewOption] = useState({ id: '', label: '' });
  const [newCity, setNewCity] = useState({ id: '', label: '', titleLabel: '', populationMass: '0.001' });
  const [newTier, setNewTier] = useState({ id: '', label: '', people: '2000' });
  const [newBoost, setNewBoost] = useState({ id: '', label: '', incrementRate: '0.25' });
  const [publishedDefinitions, setPublishedDefinitions] = useState<PublishedConfigDefinitions>(() => ({
    fields: Object.fromEntries(fallbackConfig.catalog.fields.map((field) => [
      field.id,
      { kind: field.kind, optionIds: (field.options ?? []).map((option) => option.id) },
    ])),
    cityIds: fallbackConfig.cities.map((city) => city.id),
    reachTierIds: fallbackConfig.reachTiers.map((tier) => tier.id),
    reachBoostIds: fallbackConfig.reachBoosts.map((boost) => boost.id),
  }));
  const publishedFieldIds = useMemo(() => new Set(Object.keys(publishedDefinitions.fields)), [publishedDefinitions]);
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(baseline), [baseline, config]);
  const configDiff = useMemo(() => diffRuntimeConfig(baseline, config), [baseline, config]);
  const selectedField = config.catalog.fields.find((field) => field.id === selectedFieldId);

  const loadVersion = async (version: string) => {
    const response = await auth.adminFetch(`/api/admin/v1/configs/${encodeURIComponent(version)}/export`);
    if (!response.ok) throw new Error('load_failed');
    const payload = await response.json() as { config: RuntimeConfigBundle; metadata: ConfigVersionMetadata };
    setConfig(cloneRuntimeConfig(payload.config));
    setBaseline(cloneRuntimeConfig(payload.config));
    setMetadata(payload.metadata);
    setSelectedFieldId(payload.config.catalog.fields[0]?.id ?? '');
    setIssues([]);
    setMessage(`已载入 ${version}。`);
  };

  const refresh = async () => {
    if (!auth.authenticated) return;
    setBusy(true);
    try {
      const response = await auth.adminFetch('/api/admin/v1/configs');
      if (!response.ok) throw new Error('list_failed');
      const payload = await response.json() as { activeVersion: string; versions: ConfigVersionMetadata[]; publishedDefinitions: PublishedConfigDefinitions };
      setVersions(payload.versions);
      setActiveVersion(payload.activeVersion);
      setPublishedDefinitions(payload.publishedDefinitions);
      await loadVersion(payload.activeVersion);
    } catch {
      setMessage('读取配置列表失败；本机编辑内容没有上传。');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (auth.authenticated) void refresh(); }, [auth.authenticated]);

  const mutate = (recipe: (next: RuntimeConfigBundle) => void) => {
    setConfig((current) => {
      const next = cloneRuntimeConfig(current);
      recipe(next);
      return next;
    });
    setMessage('尚未发布：变更只在当前页面内。');
  };

  const updateVersion = (key: 'bundle' | 'catalog' | 'model', value: string) => mutate((next) => {
    if (key === 'bundle') next.configBundleVersion = value;
    if (key === 'catalog') {
      next.catalog.catalogVersion = value;
      next.model.catalogVersion = value;
    }
    if (key === 'model') next.model.modelVersion = value;
  });

  const addQuestion = () => {
    const id = newField.id.trim();
    const label = newField.label.trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(id) || !label || config.catalog.fields.some((field) => field.id === id)) {
      setMessage('新增失败：fieldId 必须唯一，并使用小写字母、数字或下划线。');
      return;
    }
    mutate((next) => {
      const common = {
        id, label, group: next.catalog.groups[0]!.id, kind: newField.kind, status: 'active' as const,
        selfControl: newField.kind === 'number' ? 'number_input' : newField.kind === 'tags' ? 'multi_choice' : 'single_choice',
        requirementControl: newField.kind === 'number' ? 'range_and_presets' : 'acceptable_multi_choice',
        allowedOperators: newField.kind === 'number' ? ['gte', 'lte', 'between'] : [newField.kind === 'tags' ? 'any_of' : 'in'],
        requiredSelf: false, sensitive: false, sourceItem: label,
        note: '管理员新增的演示问题；非真实人口统计。', scoreEnabled: false, presets: [],
      };
      if (newField.kind === 'number') {
        next.catalog.fields.push({ ...common, kind: 'number', minimum: 0, maximum: 100, step: 1 });
        next.model.fields[id] = {
          distribution: { kind: 'bucket_uniform_discrete', buckets: [{ from: 0, toExclusive: 101, mass: 1 }] },
          score: { kind: 'excluded', weight: 0 },
        };
      } else {
        const options = [{ id: 'option_a', label: '选项A' }, { id: 'option_b', label: '选项B' }];
        next.catalog.fields.push({ ...common, kind: newField.kind, options });
        next.model.fields[id] = {
          distribution: { kind: newField.kind === 'tags' ? 'independent_tags' : 'categorical', mass: { option_a: 0.5, option_b: 0.5 } },
          score: { kind: 'excluded', weight: 0 },
        };
      }
    });
    setSelectedFieldId(id);
    setNewField({ id: '', label: '', kind: 'enum' });
  };

  const removeQuestion = (fieldId: string) => mutate((next) => {
    const field = next.catalog.fields.find((candidate) => candidate.id === fieldId);
    if (!field) return;
    if (publishedFieldIds.has(fieldId)) field.status = 'retired';
    else {
      next.catalog.fields = next.catalog.fields.filter((candidate) => candidate.id !== fieldId);
      delete next.model.fields[fieldId];
      setSelectedFieldId(next.catalog.fields[0]?.id ?? '');
    }
  });

  const moveQuestion = (fieldId: string, direction: -1 | 1) => mutate((next) => {
    moveById(next.catalog.fields, fieldId, direction);
  });

  const addOption = (fieldId: string) => {
    const optionId = newOption.id.trim();
    const label = newOption.label.trim();
    const field = config.catalog.fields.find((candidate) => candidate.id === fieldId);
    if (!field || field.kind === 'number' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(optionId) || !label || field.options?.some((option) => option.id === optionId)) {
      setMessage('新增选项失败：optionId 必须唯一，只能使用字母、数字、下划线或连字符。');
      return;
    }
    mutate((next) => {
      const target = next.catalog.fields.find((candidate) => candidate.id === fieldId)!;
      (target.options ??= []).push({ id: optionId, label, status: 'active' });
      const configured = next.model.fields[fieldId]!;
      if (configured.distribution.kind !== 'bucket_uniform_discrete') configured.distribution.mass[optionId] = 0;
      if (configured.score.kind === 'category_map') configured.score.values[optionId] = 50;
    });
    setNewOption({ id: '', label: '' });
  };

  const removeOption = (fieldId: string, optionId: string) => mutate((next) => {
    const field = next.catalog.fields.find((candidate) => candidate.id === fieldId)!;
    const option = field.options?.find((candidate) => candidate.id === optionId);
    if (!option) return;
    if (publishedDefinitions.fields[fieldId]?.optionIds.includes(optionId)) {
      option.status = 'retired';
      return;
    }
    field.options = field.options?.filter((candidate) => candidate.id !== optionId);
    const configured = next.model.fields[fieldId]!;
    if (configured.distribution.kind !== 'bucket_uniform_discrete') delete configured.distribution.mass[optionId];
    if (configured.score.kind === 'category_map') delete configured.score.values[optionId];
    for (const preset of field.presets) {
      if (preset.values) preset.values = preset.values.filter((value) => value !== optionId);
    }
  });

  const setScoreEnabled = (fieldId: string, enabled: boolean) => mutate((next) => {
    const field = next.catalog.fields.find((candidate) => candidate.id === fieldId)!;
    field.scoreEnabled = enabled;
    if (!enabled) {
      next.model.fields[fieldId]!.score = { kind: 'excluded', weight: 0 };
    } else if (field.kind === 'number') {
      next.model.fields[fieldId]!.score = {
        kind: 'piecewise_linear', weight: 1,
        knots: [{ value: field.minimum ?? 0, score: 0 }, { value: field.maximum ?? 100, score: 100 }],
      };
    } else if (field.kind === 'enum') {
      next.model.fields[fieldId]!.score = {
        kind: 'category_map', weight: 1,
        values: Object.fromEntries((field.options ?? []).map((option) => [option.id, 50])),
      };
    }
  });

  const addPreset = (fieldId: string) => mutate((next) => {
    const field = next.catalog.fields.find((candidate) => candidate.id === fieldId)!;
    if (field.kind === 'number') {
      field.presets.push({ label: '新数值预设', op: 'gte', value: field.minimum ?? 0, status: 'active' });
    } else {
      const first = field.options?.find((option) => option.status !== 'retired');
      field.presets.push({
        id: nextId('preset', field.presets.map((preset) => preset.id).filter((id): id is string => Boolean(id))),
        label: '新选项预设', values: first ? [first.id] : [], status: 'active',
      });
    }
  });

  const addRelativePreset = (fieldId: string) => mutate((next) => {
    const field = next.catalog.fields.find((candidate) => candidate.id === fieldId)!;
    const relativePresets = field.relativePresets ??= [];
    relativePresets.push({
      id: nextId('relative', relativePresets.map((preset) => preset.id).filter((id): id is string => Boolean(id))),
      label: '新相对预设', sourceFieldId: field.id, operator: 'gte', offset: 0, status: 'active',
    });
  });

  const addCity = () => {
    const id = newCity.id.trim();
    const label = newCity.label.trim();
    const titleLabel = newCity.titleLabel.trim();
    const mass = Number(newCity.populationMass);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(id) || !label || !titleLabel || !Number.isFinite(mass) || mass <= 0 || config.cities.some((city) => city.id === id)) {
      setMessage('新增城市失败：请填写唯一小写 ID、城市名、标题名和大于 0 的比例。');
      return;
    }
    mutate((next) => { next.cities.push({ id, label, titleLabel, populationMass: mass, status: 'active' }); });
    setNewCity({ id: '', label: '', titleLabel: '', populationMass: '0.001' });
  };

  const removeCity = (cityId: string) => mutate((next) => {
    const city = next.cities.find((candidate) => candidate.id === cityId);
    if (!city) return;
    if (publishedDefinitions.cityIds.includes(cityId)) city.status = 'retired';
    else next.cities = next.cities.filter((candidate) => candidate.id !== cityId);
  });

  const addTier = () => {
    const id = newTier.id.trim();
    const label = newTier.label.trim();
    const people = Number(newTier.people);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(id) || !label || !Number.isInteger(people) || people <= 0 || config.reachTiers.some((tier) => tier.id === id)) {
      setMessage('新增圈层失败：请填写唯一小写 ID、名称和正整数人数。');
      return;
    }
    mutate((next) => { next.reachTiers.push({ id, label, people, status: 'active', isDefault: false }); });
    setNewTier({ id: '', label: '', people: '2000' });
  };

  const removeTier = (tierId: string) => mutate((next) => {
    const tier = next.reachTiers.find((candidate) => candidate.id === tierId);
    if (!tier) return;
    if (publishedDefinitions.reachTierIds.includes(tierId)) tier.status = 'retired';
    else next.reachTiers = next.reachTiers.filter((candidate) => candidate.id !== tierId);
  });

  const addBoost = () => {
    const id = newBoost.id.trim();
    const label = newBoost.label.trim();
    const rate = Number(newBoost.incrementRate);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(id) || !label || !Number.isFinite(rate) || rate < 0 || config.reachBoosts.some((boost) => boost.id === id)) {
      setMessage('新增助力失败：请填写唯一小写 ID、名称和非负增幅。');
      return;
    }
    mutate((next) => { next.reachBoosts.push({ id, label, incrementRate: rate, status: 'active' }); });
    setNewBoost({ id: '', label: '', incrementRate: '0.25' });
  };

  const removeBoost = (boostId: string) => mutate((next) => {
    const boost = next.reachBoosts.find((candidate) => candidate.id === boostId);
    if (!boost) return;
    if (publishedDefinitions.reachBoostIds.includes(boostId)) boost.status = 'retired';
    else next.reachBoosts = next.reachBoosts.filter((candidate) => candidate.id !== boostId);
  });

  const runValidation = async () => {
    setBusy(true);
    try {
      const checksum = await computeRuntimeConfigChecksum(config);
      const response = await auth.adminFetch('/api/admin/v1/configs/validate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config, checksum }),
      });
      const payload = await response.json() as { issues?: ConfigValidationIssue[]; checksum?: string };
      setIssues(payload.issues ?? []);
      setMessage(response.ok ? `服务端校验通过 · checksum ${payload.checksum?.slice(0, 12)}…` : `服务端校验未通过（${payload.issues?.length ?? 0} 项）。`);
      return response.ok;
    } catch {
      const found = localIssues(config);
      setIssues(found);
      setMessage(`服务端校验失败；本机校验发现 ${found.length} 项问题，未创建草稿。`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!(await runValidation())) return;
    setBusy(true);
    try {
      const checksum = await computeRuntimeConfigChecksum(config);
      const replacing = metadata?.status === 'draft' && metadata.configBundleVersion === config.configBundleVersion;
      const response = await auth.adminFetch(
        replacing ? `/api/admin/v1/configs/${encodeURIComponent(config.configBundleVersion)}` : '/api/admin/v1/configs',
        {
          method: replacing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config, checksum, ...(replacing ? { revision: metadata.revision } : {}) }),
        },
      );
      const payload = await response.json() as { metadata?: ConfigVersionMetadata; error?: { message?: string } };
      if (!response.ok || !payload.metadata) throw new Error(payload.error?.message ?? 'save_failed');
      setMetadata(payload.metadata);
      setBaseline(cloneRuntimeConfig(config));
      setMessage('配置草稿已保存到服务端，但尚未发布。');
      await refreshListOnly();
    } catch (error) {
      setMessage(error instanceof Error ? `草稿保存失败：${error.message}` : '草稿保存失败。');
    } finally {
      setBusy(false);
    }
  };

  const refreshListOnly = async () => {
    const response = await auth.adminFetch('/api/admin/v1/configs');
    if (!response.ok) return;
    const payload = await response.json() as { activeVersion: string; versions: ConfigVersionMetadata[]; publishedDefinitions: PublishedConfigDefinitions };
    setVersions(payload.versions);
    setActiveVersion(payload.activeVersion);
    setPublishedDefinitions(payload.publishedDefinitions);
  };

  const publish = async () => {
    if (!metadata || metadata.status !== 'draft') return;
    setBusy(true);
    try {
      const response = await auth.adminFetch(`/api/admin/v1/configs/${encodeURIComponent(metadata.configBundleVersion)}/publish`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: metadata.revision }),
      });
      const payload = await response.json() as { metadata?: ConfigVersionMetadata; error?: { message?: string } };
      if (!response.ok || !payload.metadata) throw new Error(payload.error?.message ?? 'publish_failed');
      setMetadata(payload.metadata);
      setBaseline(cloneRuntimeConfig(config));
      setActiveVersion(metadata.configBundleVersion);
      setMessage('发布成功：当前激活指针已原子切换到新版本。');
      await refreshListOnly();
    } catch (error) {
      setMessage(error instanceof Error ? `发布失败：${error.message}；旧激活版本保持不变。` : '发布失败；旧激活版本保持不变。');
    } finally {
      setBusy(false);
    }
  };

  const activate = async (version: string) => {
    setBusy(true);
    try {
      const response = await auth.adminFetch(`/api/admin/v1/configs/${encodeURIComponent(version)}/activate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
      if (!response.ok) throw new Error('activate_failed');
      setActiveVersion(version);
      setMessage(`已把完整激活指针切换到 ${version}；历史内容未被改写。`);
      await refreshListOnly();
    } catch {
      setMessage('回滚/激活失败；当前线上版本保持不变。');
    } finally { setBusy(false); }
  };

  const exportWorkbook = async () => {
    setBusy(true);
    try {
      const { exportConfigWorkbook } = await import('@tls/config-workbook');
      const buffer = await exportConfigWorkbook(config);
      const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${config.configBundleVersion}-${timestamp}.xlsx`);
      setMessage('已生成新的 .xlsx；没有覆盖或上传原文件。');
    } catch { setMessage('Excel 导出失败，配置状态没有改变。'); }
    finally { setBusy(false); }
  };

  const importWorkbook = async (file: File) => {
    setBusy(true);
    try {
      const { importConfigWorkbook } = await import('@tls/config-workbook');
      const result = await importConfigWorkbook(await file.arrayBuffer(), file.name);
      if (!result.ok || !result.config) {
        setIssues(result.issues.map((entry) => ({ path: `${entry.sheet}/${entry.row}/${entry.column}`, code: entry.errorCode, message: entry.message })));
        setMessage(`Excel 预检失败（${result.issues.length} 项）；未产生服务端写入。`);
        return;
      }
      setConfig(result.config);
      setSelectedFieldId(result.config.catalog.fields[0]?.id ?? '');
      setIssues([]);
      setMessage(`Excel 浏览器预检通过 · checksum ${result.checksum?.slice(0, 12)}…；尚未保存或发布。`);
    } catch { setMessage('Excel 解析失败；原文件没有上传或修改。'); }
    finally { setBusy(false); }
  };

  if (!auth.authenticated) {
    return (
      <main className="admin-page admin-login">
        <span className="eyebrow">管理员专用</span><h1>配置后台</h1>
        <p>普通用户不需要登录。后台只管理配置，不能查看或搜索匿名答卷。</p>
        {auth.status === 'loading' || auth.status === 'exchanging' ? <p>正在准备安全登录…</p> : (
          <button type="button" className="primary-button" disabled={!auth.settings?.authorizationEndpoint} onClick={() => void auth.login()}>使用 Cognito 登录</button>
        )}
        {auth.message && <div className="issue-banner">{auth.message}</div>}
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div><span className="eyebrow">config-admin · {auth.status === 'local' ? '本机开发模式' : 'Cognito 会话'}</span><h1>配置后台</h1></div>
        <div><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={busy}>刷新</button><button type="button" className="text-button" onClick={auth.logout}>退出</button></div>
      </header>
      <nav className="admin-tabs" aria-label="后台栏目">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
      <div className={`admin-status ${message.includes('失败') || message.includes('未通过') ? 'admin-status--error' : ''}`} role="status"><strong>{busy ? '处理中' : dirty ? '尚未发布' : metadata?.status === 'published' ? '已发布版本' : '当前状态'}</strong><span>{message}</span></div>

      {tab === 'overview' && (
        <section className="admin-panel">
          <h2>版本与校验状态</h2>
          <div className="admin-metrics"><div><span>线上激活</span><strong>{activeVersion}</strong></div><div><span>当前编辑</span><strong>{config.configBundleVersion}</strong></div><div><span>revision</span><strong>{metadata?.revision ?? '未保存'}</strong></div><div><span>问题</span><strong>{config.catalog.fields.filter((field) => field.status === 'active').length}</strong></div></div>
          <div className="admin-form-grid">
            <label>配置包版本<Input value={config.configBundleVersion} onChange={(value) => updateVersion('bundle', value)} /></label>
            <label>目录版本<Input value={config.catalog.catalogVersion} onChange={(value) => updateVersion('catalog', value)} /></label>
            <label>模型版本<Input value={config.model.modelVersion} onChange={(value) => updateVersion('model', value)} /></label>
            <label>通知版本<Input value={config.noticeVersion} onChange={(value) => mutate((next) => { next.noticeVersion = value; })} /></label>
          </div>
          <p className="helper">一次新发布应使用新的配置包、目录和模型版本。历史发布版本保持只读。</p>
          <button type="button" className="secondary-button" onClick={() => void runValidation()} disabled={busy}>运行共享校验</button>
        </section>
      )}

      {tab === 'fields' && (
        <section className="admin-panel field-admin-layout">
          <aside>
            <h2>问题</h2>
            <input type="search" placeholder="按名称或 ID 查找" aria-label="搜索问题" onChange={(event) => {
              const query = event.currentTarget.value.toLowerCase();
              const found = config.catalog.fields.find((field) => `${field.id}${field.label}`.toLowerCase().includes(query));
              if (found) setSelectedFieldId(found.id);
            }} />
            <div className="admin-field-list">{config.catalog.fields.map((field) => <button key={field.id} type="button" className={field.id === selectedFieldId ? 'active' : ''} onClick={() => setSelectedFieldId(field.id)}><span>{field.label}</span><small>{field.id} · {field.status}</small></button>)}</div>
          </aside>
          <div>
            <div className="new-question"><h3>新增问题</h3><Input value={newField.id} onChange={(value) => setNewField((current) => ({ ...current, id: value }))} /><Input value={newField.label} onChange={(value) => setNewField((current) => ({ ...current, label: value }))} /><select value={newField.kind} onChange={(event) => setNewField((current) => ({ ...current, kind: event.target.value as CatalogField['kind'] }))}><option value="enum">互斥枚举</option><option value="number">数值/区间</option><option value="tags">独立标签</option></select><button type="button" onClick={addQuestion}>新增</button></div>
            {selectedField && (() => {
              const configured = config.model.fields[selectedField.id]!;
              const publishedOptions = new Set(publishedDefinitions.fields[selectedField.id]?.optionIds ?? []);
              return (
                <div className="field-editor">
                  <div className="section-heading">
                    <div><span className="eyebrow">{selectedField.id} · {selectedField.kind}</span><h2>{selectedField.label}</h2></div>
                    <div className="admin-row-actions">
                      <button type="button" className="text-button" onClick={() => moveQuestion(selectedField.id, -1)}>上移</button>
                      <button type="button" className="text-button" onClick={() => moveQuestion(selectedField.id, 1)}>下移</button>
                      <button type="button" className="danger-button" onClick={() => removeQuestion(selectedField.id)}>{publishedFieldIds.has(selectedField.id) ? '在新版本中停用' : '删除未发布问题'}</button>
                    </div>
                  </div>
                  <div className="admin-form-grid">
                    <label>题名<Input value={selectedField.label} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.label = value; })} /></label>
                    <label>分组<select value={selectedField.group} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.group = event.target.value; })}>{config.catalog.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
                    <label>状态<select value={selectedField.status} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></label>
                    <label>说明<Input value={selectedField.note} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.note = value; })} /></label>
                    <label>自身控件模板<code>{selectedField.selfControl}</code></label>
                    <label>要求控件模板<code>{selectedField.requirementControl}</code></label>
                    <label>允许运算符<code>{selectedField.allowedOperators.join(', ')}</code></label>
                    <label className="admin-check">敏感问项<input type="checkbox" checked={selectedField.sensitive} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.sensitive = event.target.checked; })} /></label>
                  </div>

                  {selectedField.kind === 'number' && <div className="admin-form-grid">
                    <label>单位<Input value={selectedField.unit ?? ''} onChange={(value) => mutate((next) => { const field = next.catalog.fields.find((item) => item.id === selectedField.id)!; if (value) field.unit = value; else delete field.unit; })} /></label>
                    <label>minimum<Input type="number" value={selectedField.minimum ?? 0} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.minimum = Number(value); })} /></label>
                    <label>maximum<Input type="number" value={selectedField.maximum ?? 100} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.maximum = Number(value); })} /></label>
                    <label>step<Input type="number" value={selectedField.step ?? 1} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.step = Number(value); })} /></label>
                  </div>}

                  <div className="score-admin">
                    <h3>双方共用评分</h3>
                    {selectedField.kind === 'tags' ? <p className="helper">独立标签当前不支持评分；仍完整参与筛选。</p> : <>
                      <label className="toggle-row"><input type="checkbox" checked={selectedField.scoreEnabled} onChange={(event) => setScoreEnabled(selectedField.id, event.target.checked)} /><span>启用同一套自身/要求评分</span></label>
                      {configured.score.kind !== 'excluded' && <label className="inline-control">评分权重<Input type="number" step="0.1" value={configured.score.weight} onChange={(value) => mutate((next) => { const score = next.model.fields[selectedField.id]!.score; if (score.kind !== 'excluded') score.weight = Number(value); })} /></label>}
                    </>}
                  </div>

                  {selectedField.kind !== 'number' ? <>
                    <div className="section-heading"><h3>选项、比例与分值</h3><small>active 互斥选项比例合计必须为 1；标签比例各自在 0～1。</small></div>
                    <table className="admin-table"><thead><tr><th>optionId</th><th>显示名</th><th>启用</th><th>人口比例</th><th>分值</th><th>操作</th></tr></thead><tbody>{(selectedField.options ?? []).map((option) => {
                      const mass = configured.distribution.kind !== 'bucket_uniform_discrete' ? configured.distribution.mass[option.id] ?? 0 : 0;
                      const score = configured.score.kind === 'category_map' ? configured.score.values[option.id] ?? 0 : '';
                      return <tr key={option.id}><td><code>{option.id}</code></td><td><Input value={option.label} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.options!.find((item) => item.id === option.id)!.label = value; })} /></td><td><input type="checkbox" checked={option.status !== 'retired'} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.options!.find((item) => item.id === option.id)!.status = event.target.checked ? 'active' : 'retired'; })} /></td><td><Input type="number" step="0.000001" value={mass} onChange={(value) => mutate((next) => { const distribution = next.model.fields[selectedField.id]!.distribution; if (distribution.kind !== 'bucket_uniform_discrete') distribution.mass[option.id] = Number(value); })} /></td><td>{score === '' ? '—' : <Input type="number" value={score} onChange={(value) => mutate((next) => { const definition = next.model.fields[selectedField.id]!.score; if (definition.kind === 'category_map') definition.values[option.id] = Number(value); })} />}</td><td><span className="admin-row-actions"><button type="button" className="text-button" aria-label={`${option.label}上移`} onClick={() => mutate((next) => { moveById(next.catalog.fields.find((field) => field.id === selectedField.id)!.options!, option.id, -1); })}>↑</button><button type="button" className="text-button" aria-label={`${option.label}下移`} onClick={() => mutate((next) => { moveById(next.catalog.fields.find((field) => field.id === selectedField.id)!.options!, option.id, 1); })}>↓</button><button type="button" className="text-button" onClick={() => removeOption(selectedField.id, option.id)}>{publishedOptions.has(option.id) ? '停用' : '删除'}</button></span></td></tr>;
                    })}</tbody></table>
                    <div className="admin-add-row"><Input value={newOption.id} onChange={(value) => setNewOption((current) => ({ ...current, id: value }))} /><Input value={newOption.label} onChange={(value) => setNewOption((current) => ({ ...current, label: value }))} /><button type="button" onClick={() => addOption(selectedField.id)}>新增选项</button></div>
                  </> : <>
                    <div className="section-heading"><h3>数值桶与人口比例</h3><button type="button" className="text-button" onClick={() => mutate((next) => { const distribution = next.model.fields[selectedField.id]!.distribution; if (distribution.kind !== 'bucket_uniform_discrete') return; const last = distribution.buckets.at(-1); const step = selectedField.step ?? 1; distribution.buckets.push({ from: last?.toExclusive ?? selectedField.minimum ?? 0, toExclusive: (last?.toExclusive ?? selectedField.minimum ?? 0) + step, mass: 0 }); })}>新增数值桶</button></div>
                    <table className="admin-table"><thead><tr><th>from</th><th>toExclusive</th><th>mass</th><th>操作</th></tr></thead><tbody>{configured.distribution.kind === 'bucket_uniform_discrete' ? configured.distribution.buckets.map((bucket, index) => <tr key={`${bucket.from}-${index}`}><td><Input type="number" value={bucket.from} onChange={(value) => mutate((next) => { const target = next.model.fields[selectedField.id]!.distribution; if (target.kind === 'bucket_uniform_discrete') target.buckets[index]!.from = Number(value); })} /></td><td><Input type="number" value={bucket.toExclusive} onChange={(value) => mutate((next) => { const target = next.model.fields[selectedField.id]!.distribution; if (target.kind === 'bucket_uniform_discrete') target.buckets[index]!.toExclusive = Number(value); })} /></td><td><Input type="number" step="0.000001" value={bucket.mass} onChange={(value) => mutate((next) => { const target = next.model.fields[selectedField.id]!.distribution; if (target.kind === 'bucket_uniform_discrete') target.buckets[index]!.mass = Number(value); })} /></td><td><button type="button" className="text-button" onClick={() => mutate((next) => { const target = next.model.fields[selectedField.id]!.distribution; if (target.kind === 'bucket_uniform_discrete') target.buckets.splice(index, 1); })}>删除</button></td></tr>) : null}</tbody></table>
                  </>}

                  <div className="section-heading"><h3>固定预设</h3><button type="button" className="text-button" onClick={() => addPreset(selectedField.id)}>新增预设</button></div>
                  <table className="admin-table"><thead><tr><th>ID</th><th>名称</th><th>{selectedField.kind === 'number' ? '运算符' : '选项ID（逗号分隔）'}</th><th>数值/下限</th><th>上限</th><th>状态</th><th>操作</th></tr></thead><tbody>{selectedField.presets.map((preset, index) => <tr key={`${preset.id ?? preset.label}-${index}`}><td>{selectedField.kind === 'number' ? '—' : <Input value={preset.id ?? ''} onChange={(value) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!; if (value) target.id = value; else delete target.id; })} />}</td><td><Input value={preset.label} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!.label = value; })} /></td><td>{selectedField.kind === 'number' ? <select value={preset.op ?? 'gte'} onChange={(event) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!; target.op = event.target.value as 'gte' | 'lte' | 'between'; if (target.op === 'between') { delete target.value; target.min ??= selectedField.minimum ?? 0; target.max ??= selectedField.maximum ?? 100; } else { delete target.min; delete target.max; target.value ??= selectedField.minimum ?? 0; } })}><option value="gte">gte</option><option value="lte">lte</option><option value="between">between</option></select> : <Input value={(preset.values ?? []).join(',')} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!.values = value.split(',').map((entry) => entry.trim()).filter(Boolean); })} />}</td><td>{selectedField.kind === 'number' && <Input type="number" value={preset.op === 'between' ? preset.min ?? 0 : preset.value ?? 0} onChange={(value) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!; if (target.op === 'between') target.min = Number(value); else target.value = Number(value); })} />}</td><td>{selectedField.kind === 'number' && preset.op === 'between' && <Input type="number" value={preset.max ?? 0} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!.max = Number(value); })} />}</td><td><select value={preset.status ?? 'active'} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.presets[index]!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></td><td><button type="button" className="text-button" onClick={() => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.presets.splice(index, 1); })}>删除</button></td></tr>)}</tbody></table>

                  {selectedField.kind === 'number' && <>
                    <div className="section-heading"><h3>相对预设</h3><button type="button" className="text-button" onClick={() => addRelativePreset(selectedField.id)}>新增相对预设</button></div>
                    <table className="admin-table"><thead><tr><th>ID</th><th>名称</th><th>引用问题</th><th>方式</th><th>offset/min</th><th>max</th><th>状态</th><th>操作</th></tr></thead><tbody>{(selectedField.relativePresets ?? []).map((preset, index) => {
                      const mode = preset.minOffset !== undefined ? 'between' : preset.operator ?? 'gte';
                      return <tr key={`${preset.id ?? preset.label}-${index}`}><td><Input value={preset.id ?? ''} onChange={(value) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!; if (value) target.id = value; else delete target.id; })} /></td><td><Input value={preset.label} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!.label = value; })} /></td><td><select value={preset.sourceFieldId ?? selectedField.id} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!.sourceFieldId = event.target.value; })}>{config.catalog.fields.filter((field) => field.kind === 'number').map((field) => <option key={field.id} value={field.id}>{field.label} ({field.id})</option>)}</select></td><td><select value={mode} onChange={(event) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!; const nextMode = event.target.value; if (nextMode === 'between') { delete target.operator; delete target.offset; target.minOffset ??= 0; target.maxOffset ??= 0; } else { delete target.minOffset; delete target.maxOffset; target.operator = nextMode as 'gte' | 'lte'; target.offset ??= 0; } })}><option value="gte">gte</option><option value="lte">lte</option><option value="between">between</option></select></td><td><Input type="number" value={mode === 'between' ? preset.minOffset ?? 0 : preset.offset ?? 0} onChange={(value) => mutate((next) => { const target = next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!; if (mode === 'between') target.minOffset = Number(value); else target.offset = Number(value); })} /></td><td>{mode === 'between' && <Input type="number" value={preset.maxOffset ?? 0} onChange={(value) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!.maxOffset = Number(value); })} />}</td><td><select value={preset.status ?? 'active'} onChange={(event) => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets![index]!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></td><td><button type="button" className="text-button" onClick={() => mutate((next) => { next.catalog.fields.find((field) => field.id === selectedField.id)!.relativePresets!.splice(index, 1); })}>删除</button></td></tr>;
                    })}</tbody></table>
                  </>}

                  {configured.score.kind === 'piecewise_linear' && <>
                    <div className="section-heading"><h3>数值评分折点</h3><button type="button" className="text-button" onClick={() => mutate((next) => { const score = next.model.fields[selectedField.id]!.score; if (score.kind === 'piecewise_linear') score.knots.push({ value: selectedField.maximum ?? 100, score: 50 }); })}>新增折点</button></div>
                    <table className="admin-table"><thead><tr><th>value</th><th>score</th><th>操作</th></tr></thead><tbody>{configured.score.knots.map((knot, index) => <tr key={`${knot.value}-${index}`}><td><Input type="number" value={knot.value} onChange={(value) => mutate((next) => { const score = next.model.fields[selectedField.id]!.score; if (score.kind === 'piecewise_linear') score.knots[index]!.value = Number(value); })} /></td><td><Input type="number" value={knot.score} onChange={(value) => mutate((next) => { const score = next.model.fields[selectedField.id]!.score; if (score.kind === 'piecewise_linear') score.knots[index]!.score = Number(value); })} /></td><td><button type="button" className="text-button" onClick={() => mutate((next) => { const score = next.model.fields[selectedField.id]!.score; if (score.kind === 'piecewise_linear') score.knots.splice(index, 1); })}>删除</button></td></tr>)}</tbody></table>
                  </>}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {tab === 'reach' && (
        <section className="admin-panel">
          <h2>匹配城市</h2><p className="helper">用户可见项必须是具体真实城市；residual 只在模型内部保留。</p>
          <table className="admin-table"><thead><tr><th>ID</th><th>城市</th><th>标题</th><th>质量</th><th>默认</th><th>状态</th><th>操作</th></tr></thead><tbody>{config.cities.map((city) => <tr key={city.id}><td><code>{city.id}</code></td><td><Input value={city.label} onChange={(value) => mutate((next) => { next.cities.find((item) => item.id === city.id)!.label = value; })} /></td><td><Input value={city.titleLabel} onChange={(value) => mutate((next) => { next.cities.find((item) => item.id === city.id)!.titleLabel = value; })} /></td><td><Input type="number" step="0.000001" value={city.populationMass} onChange={(value) => mutate((next) => { next.cities.find((item) => item.id === city.id)!.populationMass = Number(value); })} /></td><td><input type="radio" name="default-city" checked={config.defaultCityId === city.id} onChange={() => mutate((next) => { next.defaultCityId = city.id; })} /></td><td><select value={city.status} onChange={(event) => mutate((next) => { next.cities.find((item) => item.id === city.id)!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></td><td><span className="admin-row-actions"><button type="button" className="text-button" aria-label={`${city.label}上移`} onClick={() => mutate((next) => { moveById(next.cities, city.id, -1); })}>↑</button><button type="button" className="text-button" aria-label={`${city.label}下移`} onClick={() => mutate((next) => { moveById(next.cities, city.id, 1); })}>↓</button><button type="button" className="text-button" onClick={() => removeCity(city.id)}>{publishedDefinitions.cityIds.includes(city.id) ? '停用' : '删除'}</button></span></td></tr>)}</tbody></table>
          <div className="admin-add-row admin-add-row--city"><Input value={newCity.id} onChange={(value) => setNewCity((current) => ({ ...current, id: value }))} /><Input value={newCity.label} onChange={(value) => setNewCity((current) => ({ ...current, label: value }))} /><Input value={newCity.titleLabel} onChange={(value) => setNewCity((current) => ({ ...current, titleLabel: value }))} /><Input type="number" step="0.000001" value={newCity.populationMass} onChange={(value) => setNewCity((current) => ({ ...current, populationMass: value }))} /><button type="button" onClick={addCity}>新增真实城市</button></div>
          <label className="inline-control">不可选 residual 质量<Input type="number" step="0.000001" value={config.cityResidualMass} onChange={(value) => mutate((next) => { next.cityResidualMass = Number(value); })} /></label>
          <h2>可触达圈层</h2><table className="admin-table"><thead><tr><th>ID</th><th>名称</th><th>人数</th><th>默认</th><th>状态</th><th>操作</th></tr></thead><tbody>{config.reachTiers.map((tier) => <tr key={tier.id}><td><code>{tier.id}</code></td><td><Input value={tier.label} onChange={(value) => mutate((next) => { next.reachTiers.find((item) => item.id === tier.id)!.label = value; })} /></td><td><Input type="number" value={tier.people} onChange={(value) => mutate((next) => { next.reachTiers.find((item) => item.id === tier.id)!.people = Number(value); })} /></td><td><input type="radio" name="default-tier" checked={tier.isDefault} onChange={() => mutate((next) => { next.reachTiers.forEach((item) => { item.isDefault = item.id === tier.id; }); })} /></td><td><select value={tier.status} onChange={(event) => mutate((next) => { next.reachTiers.find((item) => item.id === tier.id)!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></td><td><span className="admin-row-actions"><button type="button" className="text-button" aria-label={`${tier.label}上移`} onClick={() => mutate((next) => { moveById(next.reachTiers, tier.id, -1); })}>↑</button><button type="button" className="text-button" aria-label={`${tier.label}下移`} onClick={() => mutate((next) => { moveById(next.reachTiers, tier.id, 1); })}>↓</button><button type="button" className="text-button" onClick={() => removeTier(tier.id)}>{publishedDefinitions.reachTierIds.includes(tier.id) ? '停用' : '删除'}</button></span></td></tr>)}</tbody></table>
          <div className="admin-add-row"><Input value={newTier.id} onChange={(value) => setNewTier((current) => ({ ...current, id: value }))} /><Input value={newTier.label} onChange={(value) => setNewTier((current) => ({ ...current, label: value }))} /><Input type="number" value={newTier.people} onChange={(value) => setNewTier((current) => ({ ...current, people: value }))} /><button type="button" onClick={addTier}>新增圈层</button></div>
          <h2>助力项</h2><table className="admin-table"><thead><tr><th>ID</th><th>名称</th><th>固定增幅</th><th>状态</th><th>操作</th></tr></thead><tbody>{config.reachBoosts.map((boost) => <tr key={boost.id}><td><code>{boost.id}</code></td><td><Input value={boost.label} onChange={(value) => mutate((next) => { next.reachBoosts.find((item) => item.id === boost.id)!.label = value; })} /></td><td><Input type="number" step="0.01" value={boost.incrementRate} onChange={(value) => mutate((next) => { next.reachBoosts.find((item) => item.id === boost.id)!.incrementRate = Number(value); })} /></td><td><select value={boost.status} onChange={(event) => mutate((next) => { next.reachBoosts.find((item) => item.id === boost.id)!.status = event.target.value as 'active' | 'retired'; })}><option value="active">active</option><option value="retired">retired</option></select></td><td><span className="admin-row-actions"><button type="button" className="text-button" aria-label={`${boost.label}上移`} onClick={() => mutate((next) => { moveById(next.reachBoosts, boost.id, -1); })}>↑</button><button type="button" className="text-button" aria-label={`${boost.label}下移`} onClick={() => mutate((next) => { moveById(next.reachBoosts, boost.id, 1); })}>↓</button><button type="button" className="text-button" onClick={() => removeBoost(boost.id)}>{publishedDefinitions.reachBoostIds.includes(boost.id) ? '停用' : '删除'}</button></span></td></tr>)}</tbody></table>
          <div className="admin-add-row"><Input value={newBoost.id} onChange={(value) => setNewBoost((current) => ({ ...current, id: value }))} /><Input value={newBoost.label} onChange={(value) => setNewBoost((current) => ({ ...current, label: value }))} /><Input type="number" step="0.01" value={newBoost.incrementRate} onChange={(value) => setNewBoost((current) => ({ ...current, incrementRate: value }))} /><button type="button" onClick={addBoost}>新增助力</button></div>
        </section>
      )}

      {tab === 'strictness' && (
        <section className="admin-panel"><h2>五档约束强度</h2><p>系数必须严格递减，端点固定为 1 和 0，默认档必须为 1。</p><table className="admin-table"><thead><tr><th>ID</th><th>名称</th><th>系数</th><th>默认</th></tr></thead><tbody>{config.strictnessLevels.map((level) => <tr key={level.id}><td><code>{level.id}</code></td><td><Input value={level.label} onChange={(value) => mutate((next) => { next.strictnessLevels.find((item) => item.id === level.id)!.label = value; })} /></td><td><Input type="number" step="0.1" value={level.coefficient} onChange={(value) => mutate((next) => { next.strictnessLevels.find((item) => item.id === level.id)!.coefficient = Number(value); })} /></td><td><input type="radio" name="default-level" checked={level.isDefault} onChange={() => mutate((next) => { next.strictnessLevels.forEach((item) => { item.isDefault = item.id === level.id; }); })} /></td></tr>)}</tbody></table><button type="button" className="secondary-button" onClick={() => { const found = localIssues(config); setIssues(found); setMessage(found.length ? `本机校验发现 ${found.length} 项问题。` : '本机单调性与结构校验通过；发布前仍会执行服务端校验。'); }}>检查单调性</button></section>
      )}

      {tab === 'release' && (
        <section className="admin-panel release-grid">
          <article className="release-history"><h2>当前差异预览</h2>{configDiff.length ? <><p>相对于已载入/已保存基线共有 {configDiff.length} 项语义差异；保存草稿不会自动发布。</p><div className="config-diff">{configDiff.slice(0, 100).map((entry, index) => <span key={`${entry.area}-${entry.id}-${index}`}><b>{entry.change}</b> {entry.area} · <code>{entry.id}</code></span>)}</div>{configDiff.length > 100 && <small>其余 {configDiff.length - 100} 项请通过 Excel 或服务端校验结果复核。</small>}</> : <p>当前编辑内容与基线一致。</p>}</article>
          <article><h2>Excel 导入</h2><p>只在浏览器读取 `.xlsx` 单元格值；有任一错误时整份失败，不产生服务端写入。</p><label className="file-button">选择 .xlsx<input type="file" accept=".xlsx" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importWorkbook(file); event.currentTarget.value = ''; }} /></label></article>
          <article><h2>Excel 导出</h2><p>生成新文件并包含配置版本和 UTC 时间，不覆盖导入原件。</p><button type="button" className="secondary-button" onClick={() => void exportWorkbook()} disabled={busy}>导出当前编辑版</button></article>
          <article><h2>保存草稿</h2><p>先运行浏览器与服务端双重校验；保存成功仍不会影响普通用户。</p><button type="button" className="secondary-button" onClick={() => void saveDraft()} disabled={busy}>验证并保存草稿</button></article>
          <article><h2>正式发布</h2><p>发布会原子切换当前激活指针。失败时旧版本继续服务。</p><button type="button" className="primary-button" disabled={busy || metadata?.status !== 'draft' || dirty} onClick={() => void publish()}>发布已保存草稿</button></article>
          <article className="release-history"><h2>历史版本与回滚</h2>{versions.map((version) => <div key={version.configBundleVersion}><div><strong>{version.configBundleVersion}</strong><small>{version.status} · rev {version.revision} · {version.checksum.slice(0, 12)}…</small></div><button type="button" className="text-button" onClick={() => void loadVersion(version.configBundleVersion)}>查看/导出</button>{version.status === 'published' && version.configBundleVersion !== activeVersion && <button type="button" className="text-button" onClick={() => void activate(version.configBundleVersion)}>激活此完整版本</button>}{version.configBundleVersion === activeVersion && <span>当前线上</span>}</div>)}</article>
        </section>
      )}

      {issues.length > 0 && <section className="admin-issues"><h2>校验问题（{issues.length}）</h2>{issues.slice(0, 100).map((entry, index) => <div key={`${entry.path}-${index}`}><code>{entry.path}</code><strong>{entry.code}</strong><span>{entry.message}</span></div>)}</section>}
    </main>
  );
}
