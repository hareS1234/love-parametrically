import { useMemo } from 'react';
import { buildBouquetScene } from '../geometry/scene';
import { exampleBouquet } from './examples';
import { ScenePreview } from './ScenePreview';

export function Landing({ onHands, onMouse, onOpen }: { onHands(): void; onMouse(): void; onOpen(): void }) {
  const scene = useMemo(() => buildBouquetScene(exampleBouquet), []);
  return (
    <main className="landing-page">
      <section className="landing-content">
        <ScenePreview scene={scene} className="landing-bouquet" label="An illustrated three-flower bouquet" />
        <h1>A small bouquet,<br />grown by hand.</h1>
        <p className="landing-description">Draw each stem, shape its petals, and send the bouquet to somebody.</p>
        <div className="landing-actions">
          <button className="primary-button" onClick={onHands}>Grow with my hands</button>
          <button className="secondary-button" onClick={onMouse}>Use my mouse</button>
        </div>
        <button className="text-button" onClick={onOpen}>Open a bouquet</button>
      </section>
      <footer className="landing-footer"><span>Love, Parametrically</span><span>Runs on this device.</span></footer>
    </main>
  );
}
