import { useEffect, useMemo, useRef, useState } from 'react';
import type { BouquetV1 } from '../data/schema';
import { buildBouquetScene } from '../geometry/scene';
import type { Scene } from '../geometry/types';
import { buildHandShapes } from '../render/livingGeometry';
import { renderScene } from '../render/svg';
import { CameraError, CameraManager } from '../vision/camera';
import { FrameScheduler, type WorkerHandResult } from '../vision/frameScheduler';

const diagnosticRecipe: BouquetV1 = {
  format: 'love-parametrically', schemaVersion: 1, geometryVersion: 'botanical-v1', randomVersion: 'mulberry32-v1',
  id: 'phase-0-cosmos', createdAt: '2026-09-05T12:00:00.000Z', palette: 'rose-letter',
  flowers: [{ id: 'flower-phase-0', seed: 2147483647, species: 'cosmos', stem: [[512, 640], [478, 534], [452, 420], [470, 298]], bloomRotation: 0.18, bloomAspect: 0.94, sizeMultiplier: 1, order: 0 }],
  dedication: { to: '', from: '', note: '', displayDate: null },
};

type CameraState = 'idle' | 'requesting' | 'loading-model' | 'running' | 'error';

export function PhaseZeroDiagnostics() {
  const flowerSvg = useRef<SVGSVGElement>(null);
  const handSvg = useRef<SVGSVGElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const manager = useMemo(() => new CameraManager(), []);
  const workerRef = useRef<Worker | null>(null);
  const schedulerRef = useRef<FrameScheduler | null>(null);
  const sessionRef = useRef(0);
  const lastMetricPaint = useRef(0);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [message, setMessage] = useState('Camera is off.');
  const [handCount, setHandCount] = useState(0);
  const [resultAge, setResultAge] = useState<number | null>(null);
  const [frameId, setFrameId] = useState<number | null>(null);
  const [syntheticCheck, setSyntheticCheck] = useState<'pending' | 'pass' | 'fail'>('pending');

  const stopCamera = () => {
    schedulerRef.current?.stop(); schedulerRef.current = null;
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'CLOSE', sessionId: sessionRef.current });
      workerRef.current.terminate(); workerRef.current = null;
    }
    manager.stop();
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
    if (handSvg.current) renderScene(handSvg.current, { width: 1024, height: 768, bounds: { minX: 0, minY: 0, maxX: 1024, maxY: 768 }, shapes: [] });
    setCameraState('idle'); setMessage('Camera stopped.');
    setHandCount(0); setResultAge(null); setFrameId(null);
  };

  useEffect(() => {
    if (flowerSvg.current) renderScene(flowerSvg.current, buildBouquetScene(diagnosticRecipe));
    const first = JSON.stringify(buildBouquetScene(diagnosticRecipe));
    const deterministic = Array.from({ length: 100 }, () => JSON.stringify(buildBouquetScene(diagnosticRecipe))).every((value) => value === first);
    setSyntheticCheck(deterministic ? 'pass' : 'fail');
    return () => {
      schedulerRef.current?.stop();
      workerRef.current?.terminate();
      manager.stop();
    };
  }, [manager]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.hidden && manager.isRunning()) timer = setTimeout(stopCamera, 5000);
      else if (timer) { clearTimeout(timer); timer = null; }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  });

  const startCamera = async () => {
    if (!video.current || cameraState === 'requesting' || cameraState === 'loading-model') return;
    stopCamera();
    setCameraState('requesting'); setMessage('Waiting for camera permission. Stop any time.');
    try {
      await manager.start(video.current);
      setCameraState('loading-model'); setMessage('Loading the local hand model.');
      const sessionId = ++sessionRef.current;
      const assetBase = new URL(import.meta.env.BASE_URL, window.location.href);
      const workerUrl = new URL('generated/hand-worker.js', assetBase);
      const modelUrl = new URL('models/hand_landmarker.task', assetBase).href;
      const wasmRootUrl = new URL('wasm/', assetBase).href;
      const worker = new Worker(workerUrl);
      workerRef.current = worker;
      const onWorkerMessage = (event: MessageEvent<{ type: string; sessionId: number; message?: string }>) => {
        const data = event.data;
        if (data.sessionId !== sessionId) return;
        if (data.type === 'ERROR') {
          setCameraState('error'); setMessage(data.message ?? 'The hand model could not initialize.');
          schedulerRef.current?.stop(); manager.stop();
        }
        if (data.type === 'READY' && video.current) {
          setCameraState('running'); setMessage('Hand model is running locally.');
          const scheduler = new FrameScheduler({
            video: video.current, worker, sessionId,
            onResult: (result: WorkerHandResult, ageMs: number) => {
              const shapes = buildHandShapes(result.result.landmarks.map((landmarks, index) => ({ id: `result-${index}`, landmarks, ratio: Number.NaN, ageMs, captured: false })), false);
              const scene: Scene = { width: 1024, height: 768, bounds: { minX: 0, minY: 0, maxX: 1024, maxY: 768 }, shapes };
              if (handSvg.current) renderScene(handSvg.current, scene);
              const now = performance.now();
              if (now - lastMetricPaint.current >= 250) {
                lastMetricPaint.current = now; setHandCount(result.result.landmarks.length); setResultAge(ageMs); setFrameId(result.frameId);
              }
            },
            onStall: () => { setCameraState('error'); setMessage('The hand worker stopped. Retry or continue without the camera.'); manager.stop(); },
          });
          schedulerRef.current = scheduler; scheduler.start();
        }
      };
      worker.addEventListener('message', onWorkerMessage);
      worker.postMessage({ type: 'INIT', sessionId, modelUrl, wasmRootUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setCameraState('error'); setMessage(error instanceof CameraError ? error.message : 'Camera startup failed.');
    }
  };

  return (
    <main className="diagnostic-shell">
      <header className="diagnostic-header">
        <div><p className="eyebrow">Love, Parametrically</p><h1>Camera and geometry lab</h1></div>
        <span className={`status-pill status-${cameraState}`}>{cameraState.replace('-', ' ')}</span>
      </header>

      <section className="diagnostic-grid" aria-label="Camera and geometry diagnostics">
        <article className="paper-card camera-card">
          <div className="card-heading"><div><span className="step-number">1</span><h2>Camera and worker</h2></div><p>One local frame at a time</p></div>
          <div className="diagnostic-camera">
            <div className="calibrated-video"><video ref={video} muted playsInline /></div>
            <svg ref={handSvg} className="hand-overlay" viewBox="0 0 1024 768" preserveAspectRatio="xMidYMid meet" aria-label="Estimated hand landmarks" />
            {cameraState !== 'running' && <div className="camera-placeholder"><span>Bring up to two hands into view</span><small>Keep them inside the outlined area.</small></div>}
          </div>
          <div className="camera-actions">
            <button className="primary-button" onClick={startCamera} disabled={cameraState === 'requesting' || cameraState === 'loading-model'}>{cameraState === 'error' ? 'Retry camera' : 'Start camera check'}</button>
            <button className="secondary-button" onClick={stopCamera} disabled={cameraState === 'idle'}>Camera off</button>
          </div>
          <p className="status-copy" role="status" aria-live="polite">{message}</p>
          <dl className="metrics">
            <div><dt>Detected hands</dt><dd>{cameraState === 'running' ? handCount : '-'} / 2</dd></div>
            <div><dt>Accepted frame</dt><dd>{frameId ?? '-'}</dd></div>
            <div><dt>Result age</dt><dd>{resultAge === null ? '-' : `${resultAge.toFixed(1)} ms`}</dd></div>
            <div><dt>Freshness gate</dt><dd>≤ 200 ms</dd></div>
          </dl>
        </article>

        <article className="paper-card flower-card">
          <div className="card-heading"><div><span className="step-number">2</span><h2>Versioned geometry</h2></div><p>botanical-v1</p></div>
          <div className="cosmos-sheet"><svg ref={flowerSvg} className="cosmos-preview" aria-label="Deterministic seeded cosmos flower" /></div>
          <dl className="metrics geometry-metrics">
            <div><dt>Geometry</dt><dd>botanical-v1</dd></div>
            <div><dt>Random</dt><dd>mulberry32-v1</dd></div>
            <div><dt>Seed</dt><dd>2147483647</dd></div>
            <div><dt>100× replay</dt><dd className={syntheticCheck === 'pass' ? 'check-pass' : ''}>{syntheticCheck}</dd></div>
          </dl>
        </article>
      </section>

      <footer className="diagnostic-footer">
        <p><strong>Small test bench.</strong> Use this page to check the camera and seeded drawing.</p>
        <p>Assets stay local. The app discards each camera frame after checking it.</p>
      </footer>
    </main>
  );
}
