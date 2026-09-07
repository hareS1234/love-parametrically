import { useEffect, useMemo, useState } from 'react';
import type { BouquetV1 } from '../data/schema';
import { buildBouquetScene } from '../geometry/scene';
import { layoutPrint, createBrowserMeasure } from '../export/printLayout';
import { recipeFingerprint } from '../export/fingerprint';
import { renderPng } from '../export/png';
import { downloadBlob, safeFilename } from '../data/files';
import { ScenePreview } from './ScenePreview';

export function Recipient({ recipe, onMakeOne }: { recipe: BouquetV1; onMakeOne(): void }) {
  const [revealed, setRevealed] = useState(false);
  const [immediate, setImmediate] = useState(false);
  const [formula, setFormula] = useState(false);
  const [fingerprint, setFingerprint] = useState('calculating…');
  const scene = useMemo(() => buildBouquetScene(recipe), [recipe]);
  const print = useMemo(() => layoutPrint(recipe, scene, undefined, fingerprint === 'calculating…' ? undefined : fingerprint), [recipe, scene, fingerprint]);
  useEffect(() => { const frame = requestAnimationFrame(() => setRevealed(true)); void recipeFingerprint(recipe).then(setFingerprint); return () => cancelAnimationFrame(frame); }, [recipe]);
  const date = recipe.dedication.displayDate ?? recipe.createdAt.slice(0, 10);
  return (
    <main className="recipient-page">
      <section className={`recipient-sheet ${revealed ? 'is-revealed' : ''} ${immediate ? 'show-immediately' : ''}`}>
        <p className="recipient-wordmark">Love, Parametrically</p>
        <div className="recipient-art"><ScenePreview scene={scene} className="recipient-bouquet" label={`A bouquet of ${recipe.flowers.length} flowers`} /></div>
        <div className="recipient-dedication">
          {recipe.dedication.to && <p className="recipient-to">For {recipe.dedication.to},</p>}
          <blockquote>{recipe.dedication.note || 'A small bouquet, grown by hand.'}</blockquote>
          <p>{recipe.dedication.from ? `From ${recipe.dedication.from}` : ''}{recipe.dedication.displayDate ? `${recipe.dedication.from ? ' | ' : ''}${recipe.dedication.displayDate}` : ''}</p>
        </div>
      </section>
      <aside className="recipient-actions">
        <h1>Your bouquet</h1>
        <button className="text-button" onClick={() => setImmediate(true)}>Show immediately</button>
        <button className="primary-button" onClick={() => void document.fonts.ready.then(() => renderPng(layoutPrint(recipe, scene, createBrowserMeasure(), fingerprint))).then((blob) => downloadBlob(blob, safeFilename(date, 'png', recipe.dedication.to)))}>Save image</button>
        <button className="formula-toggle" aria-expanded={formula} onClick={() => setFormula((value) => !value)}>The formula <span>{formula ? '−' : '+'}</span></button>
        {formula && <div className="formula-card"><p><span>Arrangement</span> {recipe.flowers.length} flowers</p><p><span>Palette</span> {recipe.palette}</p>{recipe.flowers.map((flower) => <p key={flower.id}><span>{flower.species}</span> seed {flower.seed}<br />width {flower.bloomAspect.toFixed(3)} · turn {Math.round(flower.bloomRotation * 180 / Math.PI)}° · size {flower.sizeMultiplier.toFixed(2)}<br />{formatStem(flower.stem)}</p>)}<p><span>Fingerprint</span> {fingerprint.slice(0, 12)}</p></div>}
        <button className="secondary-button" onClick={onMakeOne}>Make one</button>
        <p className="recipient-privacy">Opening this gift never starts a camera.</p>
      </aside>
    </main>
  );
}

const formatStem = (stem: BouquetV1['flowers'][number]['stem']) => stem.map((point, index) => `P${index}(${point[0].toFixed(1)},${point[1].toFixed(1)})`).join(' ');
