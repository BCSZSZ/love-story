import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { canonicalJson, type FieldId, type ScoreResult } from '@tls/domain';
import { formatExactExpected, formatExpectedCount, type RuntimeEngine } from '@tls/engine';
import type { Draft } from './draft';

interface ResultPageProps {
  draft: Draft;
  engine: RuntimeEngine;
  scores: { own: ScoreResult; requirements: ScoreResult };
  onApplyRequirements: (requirements: Draft['requirements']) => void;
  onApplyReach: (tierId: string, boostIds: string[]) => void;
  onBack: () => void;
}

function Score({ title, result }: { title: string; result: ScoreResult }) {
  return (
    <div className="score-panel">
      <span>{title}</span>
      <strong>{result.score === null ? '—' : result.score.toFixed(1)}</strong>
      <small>按已填写且可评分的 {result.presentScorableCount}/{result.totalScorableCount} 项计算</small>
    </div>
  );
}

function ResultPair({
  cityLabel,
  population,
  preview = false,
}: {
  cityLabel: string;
  population: ReturnType<RuntimeEngine['estimate']>;
  preview?: boolean;
}) {
  return (
    <div className={`result-pair ${preview ? 'result-pair--preview' : ''}`}>
      <article>
        <span>{cityLabel}同城条件池</span>
        <strong>{formatExpectedCount(population)}</strong>
        <small>同城成年人按条件覆盖率估算</small>
      </article>
      <article>
        <span>圈层内预计可触达</span>
        <strong>{formatExpectedCount(population.reachable)}</strong>
        <small>有效可触达规模 {population.effectiveReach.toLocaleString('zh-CN')} 人</small>
      </article>
    </div>
  );
}

function ShareCard({
  draft,
  engine,
  scores,
  hidden,
}: {
  draft: Draft;
  engine: RuntimeEngine;
  scores: ResultPageProps['scores'];
  hidden: Set<FieldId>;
}) {
  const population = engine.estimate(draft, engine.context);
  const city = engine.citiesById[draft.matchCityId];
  const tier = engine.reachTiersById[draft.reach.tierId];
  const boosts = draft.reach.boostIds.map((id) => engine.reachBoostsById[id]?.label).filter(Boolean);
  const requirements = engine.fieldOrder.filter((fieldId) => {
    const requirement = draft.requirements[fieldId];
    return requirement?.state === 'required' && engine.strictnessFor(requirement) > 0;
  });
  const visible = requirements.filter((fieldId) => !hidden.has(fieldId));
  return (
    <div className="share-card" aria-label="导出结果卡片">
      <span className="share-card__eyebrow">{city?.titleLabel ?? city?.label ?? '同城'}·爱情故事</span>
      <h2>我的条件叠加结果</h2>
      <div className="share-card__result-pair">
        <div><span>同城条件池</span><strong>{formatExpectedCount(population)}</strong></div>
        <div><span>圈层内预计可触达</span><strong>{formatExpectedCount(population.reachable)}</strong></div>
      </div>
      <p className="share-card__sub">
        {tier?.label ?? draft.reach.tierId} · 基础 {population.baseReach.toLocaleString('zh-CN')} 人
        {boosts.length ? ` · ${boosts.join('＋')}` : ' · 未开启助力'}
      </p>
      <div className="share-card__scores">
        <div><span>自身条件分</span><strong>{scores.own.score === null ? '—' : scores.own.score.toFixed(1)}</strong></div>
        <div><span>对方要求分</span><strong>{scores.requirements.score === null ? '—' : scores.requirements.score.toFixed(1)}</strong></div>
      </div>
      <div className="share-card__requirements">
        <h3>对方要求 · {requirements.length} 项</h3>
        {visible.length ? visible.map((fieldId) => {
          const requirement = draft.requirements[fieldId]!;
          const strictness = requirement.state === 'required' ? engine.strictnessById[requirement.strictnessLevelId]?.label : undefined;
          return (
            <div key={fieldId}>
              <span>{engine.fieldsById[fieldId]?.label ?? fieldId}</span>
              <b>{engine.describeRequirement(fieldId, requirement)}{strictness ? ` · ${strictness}` : ''}</b>
            </div>
          );
        }) : <p>未展示具体要求</p>}
        {hidden.size > 0 && <p className="share-card__hidden">部分条件已隐藏（{hidden.size} 项）</p>}
      </div>
      <p className="share-card__disclaimer">演示圈层，并非真实好友数或平台用户数；放松强度不会改写年龄、金额或类别端点。</p>
      <footer>
        <span>{draft.configBundleVersion} · {draft.configChecksum.slice(0, 12)}…</span>
        <strong>演示参数／非真实人口统计</strong>
      </footer>
    </div>
  );
}

async function renderCard(node: HTMLElement): Promise<string> {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const width = node.offsetWidth || 540;
  const height = node.scrollHeight || node.offsetHeight;
  const ratio = Math.max(1, Math.min(2, Math.sqrt(16_000_000 / Math.max(1, width * height))));
  return toPng(node, { pixelRatio: ratio, cacheBust: true, backgroundColor: '#f7f5f0', width, height, style: { margin: '0' } });
}

export function ResultPage({ draft, engine, scores, onApplyRequirements, onApplyReach, onBack }: ResultPageProps) {
  const applied = useMemo(() => engine.evaluate(draft, engine.context), [draft, engine]);
  const [previewRequirements, setPreviewRequirements] = useState<Draft['requirements']>(() => structuredClone(draft.requirements));
  const [previewTierId, setPreviewTierId] = useState(draft.reach.tierId);
  const [previewBoostIds, setPreviewBoostIds] = useState<string[]>(draft.reach.boostIds);
  const previewInput = useMemo(() => ({
    ...draft,
    requirements: previewRequirements,
    reach: { tierId: previewTierId, boostIds: previewBoostIds },
  }), [draft, previewBoostIds, previewRequirements, previewTierId]);
  const preview = useMemo(() => engine.evaluate(previewInput, engine.context), [engine, previewInput]);
  const requirementsDirty = canonicalJson(previewRequirements) !== canonicalJson(draft.requirements);
  const reachDirty = previewTierId !== draft.reach.tierId || canonicalJson([...previewBoostIds].sort()) !== canonicalJson([...draft.reach.boostIds].sort());
  const anyDirty = requirementsDirty || reachDirty;
  const suggestions = useMemo(() => engine.generateRelaxations(previewInput, engine.context).slice(0, 3), [engine, previewInput]);
  const [hidden, setHidden] = useState<Set<FieldId>>(new Set());
  const [imagePreview, setImagePreview] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const city = engine.citiesById[draft.matchCityId];
  const configuredRequirements = engine.fieldOrder.filter((fieldId) => previewRequirements[fieldId]?.state === 'required');
  const appliedEnabled = engine.fieldOrder.filter((fieldId) => engine.isRequirementEnabled(draft.requirements[fieldId]));

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const changeLevel = (fieldId: string, levelId: string) => {
    setPreviewRequirements((current) => {
      const requirement = current[fieldId];
      if (requirement?.state !== 'required') return current;
      return { ...current, [fieldId]: { ...requirement, strictnessLevelId: levelId } };
    });
  };
  const toggleBoost = (boostId: string) => setPreviewBoostIds((current) => current.includes(boostId)
    ? current.filter((id) => id !== boostId)
    : [...current, boostId]);
  const toggleHidden = (fieldId: FieldId) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
    return next;
  });
  const makePng = async () => {
    if (!cardRef.current) throw new Error('Share card is unavailable.');
    setExporting(true);
    try {
      const dataUrl = await renderCard(cardRef.current);
      setImagePreview(dataUrl);
      return dataUrl;
    } finally {
      setExporting(false);
    }
  };
  const download = async () => {
    const dataUrl = await makePng();
    const anchor = document.createElement('a');
    anchor.download = `love-story-${draft.matchCityId}-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.href = dataUrl;
    anchor.click();
  };
  const share = async () => {
    const dataUrl = await makePng();
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'love-story.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: `${city?.titleLabel ?? '同城'}·爱情故事｜估算结果`, files: [file] });
  };

  return (
    <main className="result-page">
      <button type="button" className="back-link" onClick={onBack}>← 返回修改条件</button>
      <section className="result-hero">
        <span className="eyebrow">已应用结果 · {city?.label ?? draft.matchCityId}</span>
        <h1>两个范围，同一条件覆盖率</h1>
        <ResultPair cityLabel={city?.label ?? '同城'} population={applied.population} />
        <p>同城条件池精确期望值：{formatExactExpected(applied.population)}。所有数字都是演示系数，不是真实人口或社交图谱。</p>
        {applied.population.partial && <div className="issue-banner">阶段性结果，有 {applied.population.issues.length} 项待补充或修正。</div>}
        <p className="neutral-note">演示圈层，并非真实好友数或平台用户数。不同助力可能重叠，当前按固定增幅估算。</p>
      </section>

      <section className="score-grid" aria-label="两侧评分">
        <Score title="自身条件分" result={scores.own} />
        <Score title="对方要求分" result={scores.requirements} />
      </section>

      <section className="result-section">
        <div className="section-heading">
          <div><span className="eyebrow">现实触达范围</span><h2>你的可触达圈层</h2></div>
          <p>助力按基础圈层加法叠加，并以同城成年人规模封顶。</p>
        </div>
        <div className="reach-tier-grid">
          {engine.config.reachTiers.filter((tier) => tier.status === 'active').map((tier) => (
            <button key={tier.id} type="button" className={previewTierId === tier.id ? 'choice choice--active' : 'choice'} onClick={() => setPreviewTierId(tier.id)}>
              <span>{tier.label}</span><small>{tier.people.toLocaleString('zh-CN')} 人</small>
            </button>
          ))}
        </div>
        <div className="boost-grid">
          {engine.config.reachBoosts.filter((boost) => boost.status === 'active').map((boost) => (
            <label key={boost.id} className="toggle-row">
              <input type="checkbox" checked={previewBoostIds.includes(boost.id)} onChange={() => toggleBoost(boost.id)} />
              <span>{boost.label}</span><strong>+{(boost.incrementRate * 100).toLocaleString('zh-CN')}%</strong>
            </label>
          ))}
        </div>
        {reachDirty && (
          <div className="preview-panel">
            <span className="eyebrow">圈层预览 · 尚未应用</span>
            <ResultPair cityLabel={city?.label ?? '同城'} population={preview.population} preview />
            <button type="button" className="primary-button" onClick={() => onApplyReach(previewTierId, previewBoostIds)}>应用到本次结果</button>
            <button type="button" className="text-button" onClick={() => { setPreviewTierId(draft.reach.tierId); setPreviewBoostIds(draft.reach.boostIds); }}>放弃圈层预览</button>
          </div>
        )}
      </section>

      <section className="result-section">
        <div className="section-heading">
          <div><span className="eyebrow">五档排除强度</span><h2>条件松紧度</h2></div>
          <p>具体年龄、金额和类别不变；这里只放松排除强度。0.4～1.0 不改变要求分，0 才移除评分项。</p>
        </div>
        {configuredRequirements.length ? (
          <div className="strictness-list">
            {configuredRequirements.map((fieldId) => {
              const requirement = previewRequirements[fieldId];
              if (requirement?.state !== 'required') return null;
              const rowPopulation = engine.estimate({
                ...draft,
                requirements: { ...draft.requirements, [fieldId]: requirement },
              }, engine.context);
              return (
                <article key={fieldId} className="strictness-row">
                  <div><strong>{engine.fieldsById[fieldId]?.label ?? fieldId}</strong><small>{engine.describePredicate(fieldId, requirement.predicate)}</small></div>
                  <div className="segmented" role="group" aria-label={`${engine.fieldsById[fieldId]?.label ?? fieldId}约束强度`}>
                    {engine.config.strictnessLevels.map((level) => (
                      <button key={level.id} type="button" aria-pressed={requirement.strictnessLevelId === level.id} className={requirement.strictnessLevelId === level.id ? 'active' : ''} onClick={() => changeLevel(fieldId, level.id)}>
                        {level.label}<small>{Math.round(level.coefficient * 100)}%</small>
                      </button>
                    ))}
                  </div>
                  <span>{formatExpectedCount(rowPopulation)} · 圈层 {formatExpectedCount(rowPopulation.reachable)}</span>
                </article>
              );
            })}
          </div>
        ) : <p className="empty-state">当前没有已设置的具体条件。请返回填写页选择条件后再调整强度。</p>}

        {suggestions.length > 0 && (
          <div className="quick-suggestions">
            <h3>影响最大的三项</h3>
            <p>每条只移动到相邻下一档，并加入当前预览，不会直接保存。</p>
            {suggestions.map((suggestion) => (
              <button key={suggestion.fieldId} type="button" onClick={() => changeLevel(suggestion.fieldId, suggestion.proposedLevelId)}>
                <span>{suggestion.label}</span>
                <strong>{formatExpectedCount(suggestion.after)} · 圈层 {formatExpectedCount(suggestion.reachableAfter)}</strong>
              </button>
            ))}
          </div>
        )}
        {requirementsDirty && (
          <div className="preview-panel">
            <span className="eyebrow">多项合并预览 · 尚未应用</span>
            <ResultPair cityLabel={city?.label ?? '同城'} population={preview.population} preview />
            <button type="button" className="primary-button" onClick={() => onApplyRequirements(previewRequirements)}>应用这些调整</button>
            <button type="button" className="text-button" onClick={() => setPreviewRequirements(structuredClone(draft.requirements))}>放弃预览</button>
          </div>
        )}
        {anyDirty && <p className="pending-reminder" role="status">有尚未应用的预览；已应用结果和云端草稿还没有改变。</p>}
      </section>

      <section className="result-section export-section">
        <div className="section-heading">
          <div><span className="eyebrow">完整纵向图片</span><h2>导出结果卡片</h2></div>
          <p>图片只使用已应用结果；自身详细答案默认不进入图片。</p>
        </div>
        {appliedEnabled.length > 0 && (
          <div className="hide-options">
            {appliedEnabled.map((fieldId) => (
              <label key={fieldId}>
                <input type="checkbox" checked={!hidden.has(fieldId)} onChange={() => toggleHidden(fieldId)} />
                显示{engine.fieldsById[fieldId]?.label ?? fieldId}
              </label>
            ))}
          </div>
        )}
        <div className="share-card-frame" ref={cardRef}><ShareCard draft={draft} engine={engine} scores={scores} hidden={hidden} /></div>
        <div className="export-actions">
          <button type="button" className="primary-button" disabled={exporting} onClick={() => void download()}>{exporting ? '正在生成…' : '下载 PNG'}</button>
          {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" className="secondary-button" disabled={exporting} onClick={() => void share()}>系统分享</button>}
        </div>
        {imagePreview && <details className="image-preview" open><summary>图片预览（移动端可长按保存）</summary><img src={imagePreview} alt={`${city?.titleLabel ?? '同城'}·爱情故事结果卡片预览`} /></details>}
      </section>
    </main>
  );
}
