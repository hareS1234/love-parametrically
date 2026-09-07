import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { BouquetV1, FlowerV1, Palette, Species, Vec2 } from '../data/schema';
import { blossomRadius, speciesPreset } from '../geometry/species';
import type { GeometryView } from '../render/livingGeometry';
import type { GrowthSnapshot, GrowthState, SceneController } from '../interaction/controller';
import type { InputMode } from '../input/adapters';
import type { StudioState, StudioStore } from './store';
import { removeFlower, updateFlower } from './store';
import { DedicationFields } from './DedicationFields';
import { Stage, type StageHandle } from './Stage';

export interface GeometryDiagnostics {
  ratio: number | null;
  ageMs: number | null;
  history: Array<{ time: number; ratio: number }>;
}

const speciesLabels: Record<Species, string> = { cosmos: 'Cosmos', 'wild-rose': 'Wild rose', chamomile: 'Chamomile' };
const speciesOrder: Species[] = ['cosmos', 'wild-rose', 'chamomile'];
const paletteLabels: Record<Palette, string> = { 'rose-letter': 'A little blush', 'late-summer': 'Late summer', 'ink-garden': 'An ink garden' };

interface Props {
  state: StudioState;
  store: StudioStore;
  controller: SceneController;
  growth: GrowthSnapshot;
  species: Species;
  onSpecies(species: Species): void;
  inputMode: InputMode;
  onMode(mode: InputMode): void;
  geometryView: GeometryView;
  onGeometryView(view: GeometryView): void;
  cameraRunning: boolean;
  cameraUnderlay: boolean;
  onCameraUnderlay(value: boolean): void;
  stageRef: RefObject<StageHandle | null>;
  diagnostics: GeometryDiagnostics;
  onFinish(): void;
  sensitivity: number;
  onSensitivity(value: number): void;
  onRecalibrate(): void;
  cameraPaused: boolean;
  cameraError: string | null;
  onResumeCamera(): void;
}

export function Studio({ state, store, controller, growth, species, onSpecies, inputMode, onMode, geometryView, onGeometryView, cameraRunning, cameraUnderlay, onCameraUnderlay, stageRef, diagnostics, onFinish, sensitivity, onSensitivity, onRecalibrate, cameraPaused, cameraError, onResumeCamera }: Props) {
  const selected = state.recipe.flowers.find((flower) => flower.id === state.selectedId) ?? null;
  const [moveMode, setMoveMode] = useState(false);
  const [sizeDraft, setSizeDraft] = useState(selected?.sizeMultiplier ?? 1);
  const [aspectDraft, setAspectDraft] = useState(selected?.bloomAspect ?? 0.9);
  const [rotationDraft, setRotationDraft] = useState(selected?.bloomRotation ?? 0);
  const keyboardPoint = useRef<Vec2>([512, 440]);
  const flowerInProgress = growth.state === 'growing' || growth.state === 'shaping' || growth.state === 'suspended';
  const liveInstruction = /[.!?]$/.test(growth.instruction) ? growth.instruction : `${growth.instruction}.`;
  useEffect(() => {
    setSizeDraft(selected?.sizeMultiplier ?? 1);
    setAspectDraft(selected?.bloomAspect ?? 0.9);
    setRotationDraft(selected?.bloomRotation ?? 0);
  }, [selected?.id, selected?.sizeMultiplier, selected?.bloomAspect, selected?.bloomRotation]);

  useEffect(() => {
    if (inputMode === 'keyboard' && growth.state === 'shaping' && !growth.ownerId) stageRef.current?.focus();
  }, [growth.ownerId, growth.state, inputMode, stageRef]);

  const overlap = useMemo(() => {
    const last = state.recipe.flowers.at(-1);
    if (!last) return false;
    return state.recipe.flowers.slice(0, -1).some((flower) => {
      const distance = Math.hypot(flower.stem[3][0] - last.stem[3][0], flower.stem[3][1] - last.stem[3][1]);
      return distance < Math.min(blossomRadius(flower), blossomRadius(last)) * 1.12;
    });
  }, [state.recipe]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !inField) {
        event.preventDefault();
        if (flowerInProgress) controller.cancelActive('Flower cancelled.');
        else event.shiftKey ? store.redo() : store.undo();
        return;
      }
      if (inField) return;
      if (event.key === 'Escape' && flowerInProgress) { event.preventDefault(); controller.cancelActive('Flower cancelled.'); return; }
      if (growth.state === 'growing' && growth.ownerId === 'keyboard') {
        const multiplier = event.shiftKey ? 3 : 1;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          const [x, y] = keyboardPoint.current;
          keyboardPoint.current = [x + (event.key === 'ArrowLeft' ? -8 * multiplier : event.key === 'ArrowRight' ? 8 * multiplier : 0), y + (event.key === 'ArrowUp' ? -8 * multiplier : event.key === 'ArrowDown' ? 8 * multiplier : 0)];
          controller.handle({ type: 'move', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: performance.now() });
        } else if (event.key === 'Enter') { event.preventDefault(); controller.handle({ type: 'release', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: performance.now() }); }
        return;
      }
      if (growth.state === 'shaping' && growth.preview && (!growth.ownerId || growth.ownerId === 'keyboard')) {
        const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrows.includes(event.key) && event.key !== 'Enter') return;
        event.preventDefault();
        const now = performance.now();
        if (!growth.ownerId) {
          keyboardPoint.current = growth.preview.stem[3];
          controller.handle({ type: 'press', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: now });
          stageRef.current?.focus();
        }
        if (arrows.includes(event.key)) {
          const multiplier = event.shiftKey ? 3 : 1;
          const [x, y] = keyboardPoint.current;
          keyboardPoint.current = [x + (event.key === 'ArrowLeft' ? -8 * multiplier : event.key === 'ArrowRight' ? 8 * multiplier : 0), y + (event.key === 'ArrowUp' ? -8 * multiplier : event.key === 'ArrowDown' ? 8 * multiplier : 0)];
          controller.handle({ type: 'move', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: now + 1 });
        } else controller.handle({ type: 'release', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: now + 1 });
        return;
      }
      if (selected && moveMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 24 : 8;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        const targetX = Math.min(854, Math.max(170, selected.stem[3][0] + dx));
        const targetY = Math.min(510, Math.max(130, selected.stem[3][1] + dy));
        const actualDx = targetX - selected.stem[3][0]; const actualDy = targetY - selected.stem[3][1];
        const p2: Vec2 = [selected.stem[2][0] + actualDx, Math.min(selected.stem[1][1] - 0.0001, Math.max(targetY + 0.0001, selected.stem[2][1] + actualDy))];
        store.transact('Move flower head', (recipe) => updateFlower(recipe, selected.id, { stem: [selected.stem[0], selected.stem[1], p2, [targetX, targetY]] }));
      } else if (selected && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); store.transact('Remove flower', (recipe) => removeFlower(recipe, selected.id)); store.select(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [controller, flowerInProgress, growth, moveMode, selected, stageRef, store]);

  const plantKeyboard = () => {
    onMode('keyboard'); keyboardPoint.current = [512, 440];
    controller.handle({ type: 'press', ownerId: 'keyboard', point: [512, 620], timeMs: performance.now() });
    controller.handle({ type: 'move', ownerId: 'keyboard', point: keyboardPoint.current, timeMs: performance.now() + 1 });
  };

  const selectAt = (point: Vec2) => {
    const hit = [...state.recipe.flowers].reverse().find((flower) => Math.hypot(point[0] - flower.stem[3][0], point[1] - flower.stem[3][1]) <= blossomRadius(flower) + 12);
    store.select(hit?.id ?? null); setMoveMode(false);
  };

  const commitDedication = (dedication: BouquetV1['dedication']) => {
    if (JSON.stringify(dedication) !== JSON.stringify(state.recipe.dedication)) store.transact('Edit dedication', (recipe) => ({ ...recipe, dedication }));
  };

  const keepBloomShape = () => {
    if (growth.state !== 'shaping' || growth.ownerId || !growth.preview) return;
    const now = performance.now();
    controller.handle({ type: 'press', ownerId: 'controls', point: growth.preview.stem[3], timeMs: now });
    controller.handle({ type: 'release', ownerId: 'controls', point: growth.preview.stem[3], timeMs: now + 1 });
  };

  const commitShapeControls = () => {
    if (!selected) return;
    store.transact('Shape flower', (recipe) => updateFlower(recipe, selected.id, { sizeMultiplier: sizeDraft, bloomAspect: aspectDraft, bloomRotation: rotationDraft }));
  };

  const aspectBounds = selected ? speciesPreset[selected.species].aspect : [0.8, 1] as const;
  const guidance = stageGuidance(inputMode, growth.state, Boolean(growth.ownerId));

  return (
    <main className="studio-main">
      <section className="studio-workarea">
        <div className="artwork-panel">
          <div className="stage-topline">
            <div><span className={`mode-dot ${cameraRunning && !cameraPaused ? 'is-live' : ''}`} />{inputMode === 'hands' ? cameraPaused || !cameraRunning ? 'Hand mode paused' : 'Hand mode' : inputMode === 'keyboard' ? 'Keyboard mode' : 'Pointer mode'}</div>
            <div className="view-switch" role="group" aria-label="Geometry display">
              <button aria-pressed={geometryView === 'studio'} onClick={() => onGeometryView('studio')}>Studio</button>
              <button aria-pressed={geometryView === 'expanded'} onClick={() => onGeometryView('expanded')}>Geometry</button>
              <button aria-pressed={geometryView === 'clean'} onClick={() => onGeometryView('clean')}>Clean view</button>
            </div>
          </div>
          <Stage
            ref={stageRef} recipe={state.recipe} preview={growth.preview} selected={selected} geometryView={geometryView}
            showSeed={state.recipe.flowers.length < 7 && growth.state === 'ready'} cameraUnderlay={cameraUnderlay}
            controller={controller} growthState={growth.state} inputLabel={inputMode === 'hands' ? 'Estimated hand' : inputMode === 'keyboard' ? 'Keyboard' : 'Pointer'}
            onSelect={selectAt} moveSelected={moveMode} pointerEnabled={inputMode !== 'hands'}
            onMoveCommit={(flower) => store.transact('Move flower head', (recipe) => updateFlower(recipe, flower.id, { stem: flower.stem }))}
          />
          <div className="stage-instruction">
            <span className="instruction-index">{growth.state === 'ready' ? '1.' : growth.state === 'growing' ? '2.' : growth.state === 'shaping' || growth.state === 'suspended' ? '3.' : '-'}</span>
            <div><strong>{state.recipe.flowers.length >= 7 && growth.state === 'ready' ? 'Your vase is full.' : growth.instruction}</strong><small id="stage-guidance">{guidance}</small></div>
            {growth.state === 'shaping' && <div className="shape-actions">{!growth.ownerId && <button onClick={keepBloomShape}>Keep this shape</button>}<button onClick={() => controller.cancelActive('Flower cancelled.')}>Cancel flower</button></div>}
          </div>
          {overlap && <button className="overlap-nudge" onClick={() => { const last = state.recipe.flowers.at(-1); if (last) { store.select(last.id); setMoveMode(true); } }}>Blooms are close. Move this bloom?</button>}
          {geometryView === 'expanded' && <GeometryDrawer selected={selected ?? growth.preview} diagnostics={diagnostics} />}
        </div>

        <aside className="inspector" aria-label="Bouquet controls">
          <div className="inspector-section">
            <div className="section-heading"><span>Flowers</span><span>{state.recipe.flowers.length} / 7</span></div>
            <div className="species-grid" role="group" aria-label="Flower species">
              {speciesOrder.map((key, index) => <button id={`species-${key}`} key={key} className={`species-card species-${key}`} aria-pressed={species === key} onClick={() => onSpecies(key)} onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault(); const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                const next = speciesOrder[(index + delta + speciesOrder.length) % speciesOrder.length]; onSpecies(next); document.getElementById(`species-${next}`)?.focus();
              }}><span className="species-mark" />{speciesLabels[key]}</button>)}
            </div>
            {state.recipe.flowers.length > 0 && <div className="flower-list" aria-label="Flower list">{state.recipe.flowers.map((flower) => <button key={flower.id} aria-pressed={flower.id === selected?.id} onClick={() => { store.select(flower.id); setMoveMode(false); }}>{flower.order + 1}. {speciesLabels[flower.species]}</button>)}</div>}
            {inputMode === 'keyboard' && <button className="primary-button full-button" disabled={state.recipe.flowers.length >= 7 || growth.state !== 'ready'} onClick={plantKeyboard}>Plant</button>}
          </div>

          <div className="inspector-section">
            <div className="section-heading"><span>Colors</span></div>
            <div className="palette-list">{(Object.keys(paletteLabels) as Palette[]).map((key) => <button key={key} aria-pressed={state.recipe.palette === key} onClick={() => store.transact('Change palette', (recipe) => ({ ...recipe, palette: key }))}><span className={`palette-swatch swatch-${key}`} />{paletteLabels[key]}</button>)}</div>
          </div>

          <div className="inspector-section selected-controls">
            <div className="section-heading"><span>Selected flower</span></div>
            {selected ? <>
              <p className="selected-name">{speciesLabels[selected.species]} <span>#{selected.order + 1}</span></p>
              <div className="ordinary-controls">
                <button aria-pressed={moveMode} onClick={() => setMoveMode((value) => !value)}>Move</button>
                <button onClick={() => { store.transact('Remove flower', (recipe) => removeFlower(recipe, selected.id)); store.select(null); }}>Remove</button>
                <label>Size <input type="range" min="0.75" max="1.25" step="0.01" value={sizeDraft} onChange={(event) => setSizeDraft(Number(event.target.value))} onPointerUp={commitShapeControls} onBlur={commitShapeControls} /></label>
                <label>Width <input type="range" min={aspectBounds[0]} max={aspectBounds[1]} step="0.001" value={aspectDraft} onChange={(event) => setAspectDraft(Number(event.target.value))} onPointerUp={commitShapeControls} onBlur={commitShapeControls} /></label>
                <label>Turn <input type="range" min={-Math.PI} max={Math.PI} step="0.01" value={rotationDraft} onChange={(event) => setRotationDraft(Number(event.target.value))} onPointerUp={commitShapeControls} onBlur={commitShapeControls} /></label>
                <button onClick={() => { store.select(null); setMoveMode(false); }}>Done</button>
              </div>
              <div className="layer-controls"><button disabled={selected.order === state.recipe.flowers.length - 1} onClick={() => reorder(state.recipe, selected.id, 1, store)}>Bring forward</button><button disabled={selected.order === 0} onClick={() => reorder(state.recipe, selected.id, -1, store)}>Send backward</button></div>
            </> : <p className="empty-selection">Choose a flower to move, resize, or remove it.</p>}
          </div>

          <div className="inspector-section dedication-inspector">
            <div className="section-heading"><span>Note</span></div>
            <DedicationFields value={state.recipe.dedication} onCommit={commitDedication} compact />
          </div>

          <div className="inspector-section session-controls">
            <div className="section-heading"><span>Input</span></div>
            <div className="input-mode-buttons"><button aria-pressed={inputMode === 'mouse'} onClick={() => onMode('mouse')}>Pointer</button><button aria-pressed={inputMode === 'keyboard'} onClick={() => onMode('keyboard')}>Keyboard</button>{cameraRunning && <button aria-pressed={inputMode === 'hands'} onClick={() => onMode('hands')}>Hands</button>}</div>
            {cameraRunning && <label className="switch-label"><input type="checkbox" checked={cameraUnderlay} onChange={(event) => onCameraUnderlay(event.target.checked)} /> Camera underlay</label>}
            {cameraPaused && <button className="primary-button full-button" onClick={onResumeCamera}>Resume camera</button>}
            <label className="sensitivity-label">Sensitivity<select value={sensitivity} onChange={(event) => onSensitivity(Number(event.target.value))}><option value="75">Calm</option><option value="50">Standard</option><option value="35">Responsive</option></select></label>
            {cameraRunning && <button className="recalibrate-button" onClick={onRecalibrate}>Recalibrate</button>}
          </div>
        </aside>
      </section>
      <footer className="studio-footer">
        <div><button className="footer-button" disabled={!state.canUndo || flowerInProgress} onClick={store.undo}>↶ Undo</button><button className="footer-button" disabled={!state.canRedo || flowerInProgress} onClick={store.redo}>↷ Redo</button></div>
        <button className="primary-button" disabled={state.recipe.flowers.length === 0 || flowerInProgress} onClick={onFinish}>Finish bouquet <span aria-hidden="true">→</span></button>
      </footer>
      {state.saveError && <div className="save-recovery" role="alert"><span>{state.saveError}</span><button onClick={onFinish} disabled={state.recipe.flowers.length === 0}>Save a file</button></div>}
      {cameraError && <div className="camera-recovery" role="alert"><span>{cameraError}</span><button onClick={onRecalibrate}>Retry hands</button></div>}
      <div className="sr-live" aria-live="polite" aria-atomic="true">{liveInstruction} Bouquet contains {state.recipe.flowers.length} {state.recipe.flowers.length === 1 ? 'flower' : 'flowers'}.</div>
    </main>
  );
}

function stageGuidance(inputMode: InputMode, state: GrowthState, captured: boolean): string {
  if (state === 'ready') return inputMode === 'hands' ? 'Pinch the seed.' : inputMode === 'keyboard' ? 'Choose Plant.' : 'Press the seed.';
  if (state === 'growing') return inputMode === 'hands' ? 'Lift, then open your fingers to set the stem.' : inputMode === 'keyboard' ? 'Use the arrows, then press Enter.' : 'Drag upward, then release.';
  if (state === 'shaping') {
    if (inputMode === 'hands') return captured ? 'Move sideways to turn. Move up or down to change the width. Open when done.' : 'Pinch the flower again.';
    if (inputMode === 'keyboard') return 'Use the arrows to change width and turn. Press Enter when done.';
    return captured ? 'Move sideways to turn. Move up or down to change the width. Release when done.' : 'Press the flower and drag.';
  }
  if (state === 'suspended') return 'Return to the last point and start again.';
  return 'The whole flower is saved as one step.';
}

function reorder(recipe: BouquetV1, id: string, delta: number, store: StudioStore) {
  const flower = recipe.flowers.find((item) => item.id === id); if (!flower) return;
  const other = recipe.flowers.find((item) => item.order === flower.order + delta); if (!other) return;
  store.transact('Reorder flower', (current) => ({ ...current, flowers: current.flowers.map((item) => item.id === flower.id ? { ...item, order: other.order } : item.id === other.id ? { ...item, order: flower.order } : item) }));
}

function GeometryDrawer({ selected, diagnostics }: { selected: FlowerV1 | null; diagnostics: GeometryDiagnostics }) {
  const validHistory = diagnostics.history.slice(-96);
  const path = validHistory.length > 1 ? validHistory.map((item, index) => `${index === 0 ? 'M' : 'L'} ${(index / (validHistory.length - 1)) * 210} ${54 - Math.min(1, item.ratio) * 48}`).join(' ') : '';
  return <aside className="geometry-drawer" aria-label="Geometry values"><div className="geometry-title"><span>Geometry numbers</span><small>Live values</small></div><dl><div><dt>Pinch ratio</dt><dd>{diagnostics.ratio?.toFixed(3) ?? '-'}</dd></div><div><dt>Result age</dt><dd>{diagnostics.ageMs === null ? '-' : `${diagnostics.ageMs.toFixed(1)} ms`}</dd></div>{selected && <><div><dt>Petal width</dt><dd>{selected.bloomAspect.toFixed(3)}</dd></div><div><dt>Bloom turn</dt><dd>{Math.round(selected.bloomRotation * 180 / Math.PI)}°</dd></div><div><dt>Flower size</dt><dd>{selected.sizeMultiplier.toFixed(2)}</dd></div></>}{selected?.stem.map((point, index) => <div key={index}><dt>P{index}</dt><dd>{point[0].toFixed(1)}, {point[1].toFixed(1)}</dd></div>)}</dl><svg viewBox="0 0 210 58" aria-label="Pinch ratio over the last four seconds"><line x1="0" y1="39.6" x2="210" y2="39.6" /><line x1="0" y1="32.4" x2="210" y2="32.4" /><path d={path} /></svg><p>0.30 presses. 0.45 releases.</p></aside>;
}
