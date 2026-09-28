import { useEffect, useMemo, useState } from 'react';
import type { RuntimeConfigBundle } from '@tls/domain';
import { createRuntimeEngine, formatExpectedCount, type RuntimeEngine } from '@tls/engine';
import { FieldCard, answeredCountForGroup } from './FieldCard';
import { ResultPage } from './ResultPage';
import { AdminPage } from './AdminPage';
import {
  draftStorageKey,
  getManagedRecords,
  hasMeaningfulContent,
  removeManagedRecord,
  useDraft,
  type ManagedRecord,
  type SaveStatus,
} from './draft';
import { useCloudSave } from './save';
import { useRuntimeConfig } from './runtime-config';

type Route = '/' | '/form' | '/result' | '/privacy' | '/admin';

const SAVE_LABEL: Record<SaveStatus, string> = {
  local: '本机已保存', pending: '本机已保存 · 待上传', uploading: '正在上传', saved: '云端已保存',
  failed: '上传失败 · 本机已保存', conflict: '云端版本冲突', expired: '记录已到期', disabled: '仅本次页面有效',
};

function currentRoute(): Route {
  const callback = new URLSearchParams(window.location.search);
  if (callback.has('state') && (callback.has('code') || callback.has('error'))) return '/admin';
  const value = window.location.hash.replace(/^#/, '') || '/';
  return ['/form', '/result', '/privacy', '/admin'].includes(value) ? value as Route : '/';
}

function navigate(route: Route): void {
  window.location.hash = route;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

function CityPicker({ config, cityId, onChange }: { config: RuntimeConfigBundle; cityId: string; onChange: (id: string) => void }) {
  return (
    <label className="city-picker">
      <span className="sr-only">匹配城市</span>
      <select value={cityId} onChange={(event) => onChange(event.target.value)}>
        {config.cities.filter((city) => city.status === 'active').map((city) => <option value={city.id} key={city.id}>{city.label}</option>)}
      </select>
      <small>双方同城</small>
    </label>
  );
}

function Header({ config, cityId, onCity }: { config: RuntimeConfigBundle; cityId: string; onCity: (id: string) => void }) {
  const city = config.cities.find((entry) => entry.id === cityId);
  return (
    <header className="site-header">
      <div className="brand-with-city"><a href="#/" className="brand">{city?.titleLabel ?? city?.label ?? '同城'}·爱情故事</a><CityPicker config={config} cityId={cityId} onChange={onCity} /></div>
      <nav aria-label="主导航"><a href="#/form">开始估算</a><a href="#/privacy">数据说明</a></nav>
    </header>
  );
}

function Home({ hasDraft, cityLabel, onNew }: { hasDraft: boolean; cityLabel: string; onNew: () => void }) {
  return (
    <main className="home">
      <section className="hero">
        <span className="eyebrow">匿名条件估算器 · {cityLabel}双方同城</span>
        <h1>每多一个条件，<br />候选范围会怎样变化？</h1>
        <p>逐项填写自己的情况，再选择对另一半的要求与松紧度。这里展示条件叠加的影响，不是真人匹配，也不是现实人口结论。</p>
        <div className="starting-number" aria-label="八十亿演示起点"><strong>8,000,000,000</strong><span>演示起点 · 成年人与匹配城市各应用一次</span></div>
        <div className="hero-actions">
          {hasDraft && <button type="button" className="primary-button" onClick={() => navigate('/form')}>继续上次</button>}
          <button type="button" className={hasDraft ? 'secondary-button' : 'primary-button'} onClick={() => { if (hasDraft) onNew(); navigate('/form'); }}>{hasDraft ? '新建一次' : '开始估算'}</button>
        </div>
      </section>
      <section className="notice-card"><h2>开始前请了解</h2><ul><li>只估算当前选择的真实城市，城市同时代表双方现居地。</li><li>仅供成年人使用；成年比例与城市比例都只应用一次。</li><li>填写内容与结果默认匿名上传一年；普通用户无需账号。</li><li>所有数字均为固定演示系数，不是真实统计，也不评价任何人的价值。</li></ul><a href="#/privacy">查看完整数据与隐私说明</a></section>
    </main>
  );
}

function Summary({ engine, computed, enabledCount, saveStatus, saveMessage, onRetry, onResult }: {
  engine: RuntimeEngine;
  computed: ReturnType<RuntimeEngine['evaluate']>;
  enabledCount: number;
  saveStatus: SaveStatus;
  saveMessage?: string;
  onRetry: () => void;
  onResult: () => void;
}) {
  return (
    <aside className="summary-panel">
      <span className="eyebrow">同城条件池</span><strong className="summary-panel__number">{formatExpectedCount(computed.population)}</strong>
      <span className="model-badge">圈层内 {formatExpectedCount(computed.population.reachable)}</span>
      <dl><div><dt>成年人范围</dt><dd>{(engine.config.model.adultFraction * 100).toFixed(0)}% · 不可取消</dd></div><div><dt>已启用要求</dt><dd>{enabledCount} 项</dd></div><div><dt>自身条件分</dt><dd>{computed.scores.own.score === null ? '—' : computed.scores.own.score.toFixed(1)}</dd></div><div><dt>对方要求分</dt><dd>{computed.scores.requirements.score === null ? '—' : computed.scores.requirements.score.toFixed(1)}</dd></div></dl>
      {computed.population.partial && <p className="summary-issue">阶段性结果 · {computed.population.issues.length} 项待补充</p>}
      <div className={`save-status save-status--${saveStatus}`}><span aria-hidden="true" /><div><strong>{SAVE_LABEL[saveStatus]}</strong>{saveMessage && <small>{saveMessage}</small>}</div></div>
      {(saveStatus === 'failed' || saveStatus === 'conflict') && <button type="button" className="text-button" onClick={onRetry}>重试上传</button>}
      <button type="button" className="primary-button summary-panel__action" onClick={onResult}>查看完整结果</button>
    </aside>
  );
}

function FieldGroupSection({ group, groupIndex, engine, draft, setOwn, setRequirement }: {
  group: RuntimeConfigBundle['catalog']['groups'][number];
  groupIndex: number;
  engine: RuntimeEngine;
  draft: ReturnType<typeof useDraft>['draft'];
  setOwn: ReturnType<typeof useDraft>['setOwn'];
  setRequirement: ReturnType<typeof useDraft>['setRequirement'];
}) {
  const [open, setOpen] = useState(groupIndex < 4);
  const fields = engine.config.catalog.fields.filter((field) => field.status === 'active' && field.group === group.id);
  const count = answeredCountForGroup(group.id, draft, engine);
  return (
    <details className="field-group" id={`group-${group.id}`} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary><div><span>{String(groupIndex + 1).padStart(2, '0')}</span><h2>{group.label}</h2></div><small>{count}/{fields.length} 项已填写或启用</small></summary>
      <div className="field-group__content">{fields.map((field) => <FieldCard key={field.id} field={field} engine={engine} draft={draft} onOwn={setOwn} onRequirement={setRequirement} />)}</div>
    </details>
  );
}

function FormPage({ engine, draft, computed, setOwn, setRequirement, retry, onResult, completionMessage, configMessage }: {
  engine: RuntimeEngine;
  draft: ReturnType<typeof useDraft>['draft'];
  computed: ReturnType<RuntimeEngine['evaluate']>;
  setOwn: ReturnType<typeof useDraft>['setOwn'];
  setRequirement: ReturnType<typeof useDraft>['setRequirement'];
  retry: () => void;
  onResult: () => void;
  completionMessage?: string;
  configMessage?: string;
}) {
  const enabledCount = engine.fieldOrder.filter((fieldId) => engine.isRequirementEnabled(draft.requirements[fieldId])).length;
  const city = engine.citiesById[draft.matchCityId];
  return (
    <main className="form-page">
      <div className="mobile-summary"><div><span>同城条件池</span><strong>{formatExpectedCount(computed.population)}</strong></div><div><span>圈层内</span><strong>{formatExpectedCount(computed.population.reachable)}</strong></div><small>{SAVE_LABEL[draft.saveStatus]}</small></div>
      <div className="group-nav" aria-label="字段分组">{engine.config.catalog.groups.map((group) => <button type="button" key={group.id} onClick={() => document.getElementById(`group-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{group.label}</button>)}</div>
      {(completionMessage || configMessage || !draft.cityConfirmed) && <div className="issue-banner form-issue" role="alert">{!draft.cityConfirmed ? '旧草稿已迁移：请在页首确认一次匹配城市后再完成或上传。' : completionMessage ?? configMessage}</div>}
      <div className="form-layout"><div className="field-groups">
        <section className="adult-step"><div><span>基础范围</span><h2>成年人 · {city?.label ?? draft.matchCityId}同城</h2></div><strong>{engine.config.model.basePopulation.toLocaleString('zh-CN')} × {(engine.config.model.adultFraction * 100).toFixed(0)}% × {((city?.populationMass ?? 0) * 100).toFixed(3)}%</strong><p>成年人比例与城市比例各应用一次；匹配城市同时代表双方现居地。</p></section>
        {engine.config.catalog.groups.map((group, groupIndex) => <FieldGroupSection key={group.id} group={group} groupIndex={groupIndex} engine={engine} draft={draft} setOwn={setOwn} setRequirement={setRequirement} />)}
        <button type="button" className="primary-button mobile-result-button" onClick={onResult}>查看完整结果</button>
      </div><Summary engine={engine} computed={computed} enabledCount={enabledCount} saveStatus={draft.saveStatus} saveMessage={draft.saveMessage} onRetry={retry} onResult={onResult} /></div>
    </main>
  );
}

function PrivacyPage({ draft, onClear, onDelete }: { draft: ReturnType<typeof useDraft>['draft']; onClear: () => void; onDelete: () => Promise<void> }) {
  const [deleteMessage, setDeleteMessage] = useState<string>();
  const [managedRecords, setManagedRecords] = useState(getManagedRecords);
  const deleteManaged = async (record: ManagedRecord) => {
    const response = await fetch(`/api/v1/records/${encodeURIComponent(record.recordId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${record.managementToken}` } });
    if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error('delete_failed');
    removeManagedRecord(record.recordId); setManagedRecords(getManagedRecords());
  };
  return (
    <main className="privacy-page"><span className="eyebrow">数据说明</span><h1>匿名不等于没有边界</h1><p className="lead">我们不要求姓名、联系方式、照片、精确地址或账号。管理员后台只管理模型配置，不能读取匿名答卷。</p>
      <div className="privacy-grid"><section><h2>保存什么</h2><p>结构化答案、匹配城市、圈层、要求、配置版本与服务端复算结果。不会保存 token 明文、自由文本或设备指纹。</p></section><section><h2>保存多久</h2><p>自首次云端创建起一个公历年，编辑不会续期。</p></section><section><h2>怎样管理</h2><p>本机随机凭据只用于修改或删除这次匿名记录；清除后无法找回。</p></section><section><h2>配置后台</h2><p>管理员使用 Cognito 登录，只能管理配置；匿名记录 API 与配置 API 使用隔离权限。</p></section></div>
      <section className="data-actions"><h2>本次测试</h2><p>记录 ID：<code>{draft.recordId}</code></p><div><button type="button" className="secondary-button" onClick={() => { onClear(); navigate('/'); }}>仅清除本机数据</button><button type="button" className="danger-button" disabled={draft.acceptedRevision === 0 || draft.saveStatus === 'uploading'} onClick={() => { if (!window.confirm('删除后无法恢复。确定删除本次云端记录吗？')) return; void onDelete().then(() => setDeleteMessage('云端记录已删除，本机副本也已清除。')).catch(() => setDeleteMessage('删除失败；管理凭据仍保留，可稍后重试。')); }}>删除本次云端记录</button></div>{deleteMessage && <p role="status">{deleteMessage}</p>}</section>
      {managedRecords.length > 0 && <section className="data-actions"><h2>以前的新建测试</h2><div className="managed-records">{managedRecords.map((record) => <div key={record.recordId}><code>{record.recordId}</code><button type="button" className="text-button" onClick={() => void deleteManaged(record).catch(() => setDeleteMessage('旧记录删除失败。'))}>删除云端记录</button></div>)}</div></section>}
    </main>
  );
}

export function App() {
  const route = useRoute();
  const draftState = useDraft();
  const { draft, setOwn, setRequirement, setRequirements, setMatchCity, setReach, adoptConfig, markCompleted, setSaveStatus, acceptSave, newDraft, clearLocal } = draftState;
  const pinned = draft.acceptedRevision > 0 || hasMeaningfulContent(draft) || draft.localUpdatedAt !== draft.localCreatedAt || !draft.cityConfirmed;
  const runtime = useRuntimeConfig(pinned ? draft.configBundleVersion : undefined);
  const engine = useMemo(() => createRuntimeEngine(runtime.config, runtime.checksum), [runtime.checksum, runtime.config]);
  const configMatchesDraft = runtime.config.configBundleVersion === draft.configBundleVersion && runtime.checksum === draft.configChecksum;
  useEffect(() => { if (!pinned && runtime.source !== 'fallback') adoptConfig(runtime.config, runtime.checksum); }, [adoptConfig, pinned, runtime.checksum, runtime.config, runtime.source]);
  const computed = useMemo(() => engine.evaluate(draft, engine.context), [draft, engine]);
  const cloudEnabled = configMatchesDraft && draft.cityConfirmed;
  const { retry, cancel } = useCloudSave({ draft, enabled: cloudEnabled, setStatus: setSaveStatus, accept: acceptSave });
  const [completionMessage, setCompletionMessage] = useState<string>();
  const [multiTabNotice, setMultiTabNotice] = useState(false);
  const city = engine.citiesById[draft.matchCityId] ?? engine.config.cities.find((entry) => entry.status === 'active');

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => { if (event.key === draftStorageKey) setMultiTabNotice(true); };
    window.addEventListener('storage', handleStorage); return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const goToResult = () => {
    if (!draft.cityConfirmed) { setCompletionMessage('请先确认匹配城市。'); navigate('/result'); return; }
    if (computed.population.issues.length) { setCompletionMessage(`仍有 ${computed.population.issues.length} 项待补充或修正，当前结果可以查看，但不能标记为已完成。`); navigate('/result'); return; }
    setCompletionMessage(undefined); markCompleted(); navigate('/result');
  };
  const deleteCloud = async () => {
    cancel();
    const response = await fetch(`/api/v1/records/${encodeURIComponent(draft.recordId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${draft.managementToken}` } });
    if (!response.ok && response.status !== 404) throw new Error('delete_failed');
    clearLocal(runtime.config, runtime.checksum);
  };

  if (route === '/admin') return <><AdminPage fallbackConfig={runtime.config} /><footer className="site-footer"><span>配置后台</span><span>不读取匿名答卷</span></footer></>;

  return (
    <><Header config={engine.config} cityId={draft.matchCityId} onCity={setMatchCity} />
      {multiTabNotice && <div className="multi-tab" role="status">同一次测试在另一个标签页发生了变化。为避免覆盖，请保留一个标签页继续。<button type="button" onClick={() => setMultiTabNotice(false)}>知道了</button></div>}
      {route === '/' && <Home hasDraft={hasMeaningfulContent(draft)} cityLabel={city?.label ?? '同城'} onNew={() => { cancel(); newDraft(runtime.config, runtime.checksum); }} />}
      {route === '/form' && <FormPage engine={engine} draft={draft} computed={computed} setOwn={setOwn} setRequirement={setRequirement} retry={retry} onResult={goToResult} completionMessage={completionMessage} configMessage={!configMatchesDraft ? runtime.message : runtime.loading ? '正在确认配置版本…' : runtime.message} />}
      {route === '/result' && <ResultPage draft={draft} engine={engine} scores={computed.scores} onApplyRequirements={setRequirements} onApplyReach={setReach} onBack={() => navigate('/form')} />}
      {route === '/privacy' && <PrivacyPage draft={draft} onClear={() => clearLocal(runtime.config, runtime.checksum)} onDelete={deleteCloud} />}
      <footer className="site-footer"><span>{city?.titleLabel ?? city?.label ?? '同城'}·爱情故事</span><span>{engine.config.configBundleVersion} · 演示参数／非真实人口统计</span></footer>
    </>
  );
}
