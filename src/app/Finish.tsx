import { useEffect, useMemo, useState } from 'react';
import type { BouquetV1 } from '../data/schema';
import { buildBouquetScene } from '../geometry/scene';
import { noteFits, layoutPrint, createBrowserMeasure } from '../export/printLayout';
import { recipeFingerprint } from '../export/fingerprint';
import { renderPng } from '../export/png';
import { serializeSvg } from '../export/svg';
import { downloadBlob, safeFilename, serializeRecipe } from '../data/files';
import { DedicationFields } from './DedicationFields';
import { ScenePreview } from './ScenePreview';
import type { StudioStore } from './store';

export function Finish({ recipe, store, onBack, onFinished }: { recipe: BouquetV1; store: StudioStore; onBack(): void; onFinished(print: ReturnType<typeof layoutPrint>): Promise<void> | void }) {
  const scene = useMemo(() => buildBouquetScene(recipe), [recipe]);
  const [fingerprint, setFingerprint] = useState('calculating…');
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printScene = useMemo(() => layoutPrint(recipe, scene, undefined, fingerprint === 'calculating…' ? undefined : fingerprint), [recipe, scene, fingerprint]);
  useEffect(() => { void recipeFingerprint(recipe).then(setFingerprint); }, [recipe]);

  const date = recipe.dedication.displayDate ?? recipe.createdAt.slice(0, 10);
  const measuredPrint = async () => { await document.fonts.ready; return layoutPrint(recipe, scene, createBrowserMeasure(), fingerprint === 'calculating…' ? undefined : fingerprint); };
  const perform = async (action: (print: ReturnType<typeof layoutPrint>) => Promise<void> | void) => {
    try { setError(null); const exactPrint = await measuredPrint(); await action(exactPrint); await onFinished(exactPrint); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed. Your bouquet is still open.'); }
  };
  const commitDedication = (dedication: BouquetV1['dedication']) => {
    if (JSON.stringify(dedication) !== JSON.stringify(recipe.dedication)) store.transact('Edit dedication', (current) => ({ ...current, dedication }));
  };

  return (
    <main className="finish-page">
      <section className="finish-preview-column">
        <button className="back-button" onClick={onBack}>← Back to bouquet</button>
        <div className="print-mat"><ScenePreview scene={printScene} className="print-preview" label="Portrait botanical print preview" /></div>
      </section>
      <aside className="finish-panel">
        <h1>Add a dedication</h1>
        <p className="finish-intro">Add a name or note, then save it.</p>
        <DedicationFields value={recipe.dedication} onCommit={commitDedication} />
        {!noteFits(recipe.dedication.note) && <p className="form-error">This note will not fit the four-line print area. Please make it a little shorter.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="export-actions">
          <button className="primary-button" disabled={!noteFits(recipe.dedication.note)} onClick={() => void perform(async (exactPrint) => downloadBlob(await renderPng(exactPrint), safeFilename(date, 'png', recipe.dedication.to)))}>Save image</button>
          <button className="secondary-button" disabled={!noteFits(recipe.dedication.note)} onClick={() => void perform((exactPrint) => downloadBlob(new Blob([serializeSvg(exactPrint)], { type: 'image/svg+xml;charset=utf-8' }), safeFilename(date, 'svg', recipe.dedication.to)))}>Save SVG</button>
          <button className="secondary-button" onClick={() => void perform(() => downloadBlob(new Blob([serializeRecipe(recipe)], { type: 'application/json;charset=utf-8' }), safeFilename(date, 'bouquet.json', recipe.dedication.to)))}>Save bouquet file</button>
        </div>
        <button className="formula-toggle" aria-expanded={formulaOpen} onClick={() => setFormulaOpen((value) => !value)}>The formula <span>{formulaOpen ? '−' : '+'}</span></button>
        {formulaOpen && <div className="formula-card"><p><span>Geometry</span> botanical-v1</p><p><span>Random</span> mulberry32-v1</p><p><span>Palette</span> {recipe.palette}</p><p><span>Flowers</span> {recipe.flowers.map(formatFlower).join('\n')}</p><p><span>Fingerprint</span> {fingerprint.slice(0, 12)}</p><small>The second gesture can change petal width and turn.</small></div>}
        <p className="svg-note">PNG keeps the intended type and colors. SVG keeps the exact paths. Other apps may replace the font.</p>
      </aside>
    </main>
  );
}

const formatStem = (stem: BouquetV1['flowers'][number]['stem']) => stem.map((point, index) => `P${index}(${point[0].toFixed(1)},${point[1].toFixed(1)})`).join(' ');
const formatFlower = (flower: BouquetV1['flowers'][number]) => `${flower.species} · seed ${flower.seed}\nwidth ${flower.bloomAspect.toFixed(3)} · turn ${Math.round(flower.bloomRotation * 180 / Math.PI)}° · size ${flower.sizeMultiplier.toFixed(2)}\n${formatStem(flower.stem)}`;
