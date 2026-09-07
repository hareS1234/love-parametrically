import { useEffect, useMemo, useRef, useState } from 'react';
import type { BouquetV1, Species } from '../data/schema';
import { createEmptyBouquet, createId } from '../data/schema';
import { ArchiveRepository, createDebouncedAutosave, type LocalBouquetRecord } from '../data/archive';
import { readBouquetFile } from '../data/files';
import { SceneController, type GrowthSnapshot } from '../interaction/controller';
import type { InputMode } from '../input/adapters';
import type { GeometryView } from '../render/livingGeometry';
import { useHandTracking } from '../vision/useHandTracking';
import { addFlower, createStudioStore, useStudioStore } from './store';
import { Landing } from './Landing';
import { CameraSetup } from './CameraSetup';
import { Header } from './Header';
import { Studio } from './Studio';
import { Finish } from './Finish';
import { Recipient } from './Recipient';
import { ArchiveView } from './ArchiveView';
import { PhaseZeroDiagnostics } from './PhaseZeroDiagnostics';
import type { StageHandle } from './Stage';
import { renderThumbnail } from '../export/png';
import type { PrintScene } from '../geometry/types';

type Screen = 'landing' | 'setup' | 'studio' | 'finish' | 'archive' | 'recipient';

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('diagnostic') === 'phase0') return <PhaseZeroDiagnostics />;
  return <ProductApp />;
}

function ProductApp() {
  const store = useMemo(() => createStudioStore(createEmptyBouquet()), []);
  const state = useStudioStore(store);
  const stateRef = useRef(state); stateRef.current = state;
  const speciesRef = useRef<Species>('cosmos');
  const stageRef = useRef<StageHandle>(null);
  const growthRef = useRef<GrowthSnapshot>({ state: 'ready', preview: null, instruction: 'Start at the seed', ownerId: null, suspendedAt: null });
  const lastGrowthPaint = useRef(0);
  const [growth, setGrowth] = useState(growthRef.current);
  const [species, setSpeciesState] = useState<Species>('cosmos');
  const [screen, setScreen] = useState<Screen>('landing');
  const [inputMode, setInputMode] = useState<InputMode>('mouse');
  const [geometryView, setGeometryView] = useState<GeometryView>('studio');
  const [cameraUnderlay, setCameraUnderlay] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [recipient, setRecipient] = useState<BouquetV1 | null>(null);
  const [archiveRecords, setArchiveRecords] = useState<LocalBouquetRecord[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<LocalBouquetRecord | null>(null);
  const [collisionRecipe, setCollisionRecipe] = useState<BouquetV1 | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const repository = useMemo(() => new ArchiveRepository(), []);

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  const controller = useMemo(() => new SceneController({
    getSpecies: () => speciesRef.current,
    getFlowerCount: () => stateRef.current.recipe.flowers.length,
    getFlowers: () => stateRef.current.recipe.flowers,
    getSelectedId: () => stateRef.current.selectedId,
    selectFlower: (id) => store.select(id),
    previewMove: (flower) => stageRef.current?.updateMovedFlower(flower),
    commitMove: (flower) => store.transact('Move flower head', (recipe) => ({ ...recipe, flowers: recipe.flowers.map((item) => item.id === flower.id ? flower : item) })),
    commit: (flower) => store.transact('Grow flower', (recipe) => addFlower(recipe, flower)),
    publish: (snapshot) => {
      const previous = growthRef.current; growthRef.current = snapshot; stageRef.current?.updatePreview(snapshot.preview);
      const now = performance.now();
      if (snapshot.state !== previous.state || snapshot.ownerId !== previous.ownerId || snapshot.instruction !== previous.instruction || now - lastGrowthPaint.current >= 250) { lastGrowthPaint.current = now; setGrowth(snapshot); }
    },
  }), [store]);
  const tracking = useHandTracking(controller, stageRef, sensitivity);

  useEffect(() => {
    const autosave = createDebouncedAutosave(repository, store.markSaving, store.markSaved, store.markSaveError);
    store.setAutosave(autosave);
    return () => store.setAutosave(null);
  }, [repository, store]);

  useEffect(() => {
    if (screen === 'setup' && tracking.status === 'idle') void tracking.startSetup();
    if (screen === 'studio' && inputMode === 'hands' && tracking.status === 'ready') void tracking.attachStudio();
  }, [inputMode, screen, tracking]);

  useEffect(() => {
    const cancelForResize = () => controller.cancelActive('The stage resized. The unfinished action was cancelled.');
    window.addEventListener('resize', cancelForResize);
    return () => window.removeEventListener('resize', cancelForResize);
  }, [controller]);

  const setSpecies = (value: Species) => { speciesRef.current = value; setSpeciesState(value); };
  const changeMode = (mode: InputMode) => {
    controller.cancelActive('Start at the seed');
    if (mode === 'hands' && !tracking.running) { setScreen('setup'); return; }
    if (inputMode === 'hands' && mode !== 'hands') tracking.stop();
    setInputMode(mode);
  };
  const goHome = () => { controller.cancelActive('Returned home.'); tracking.stop(); setInputMode('mouse'); setScreen('landing'); };
  const startMouse = () => { tracking.stop(); setInputMode('mouse'); setScreen('studio'); };
  const startHands = () => { setInputMode('hands'); setScreen('setup'); };
  const continueHands = () => { setInputMode('hands'); setScreen('studio'); };
  const finish = () => { controller.cancelActive('Bouquet finished.'); tracking.stop(); setInputMode('mouse'); setScreen('finish'); };

  const refreshArchive = async () => { try { setArchiveRecords(await repository.list()); } catch { setArchiveRecords([]); } };
  const openArchive = () => { controller.cancelActive('Archive opened.'); void refreshArchive(); setScreen('archive'); };
  const triggerImport = () => { setImportError(null); fileInput.current?.click(); };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const recipe = await readBouquetFile(file);
      const existing = await repository.get(recipe.id);
      if (existing && JSON.stringify(existing.recipe) !== JSON.stringify(recipe)) { setCollisionRecipe(recipe); return; }
      setRecipient(existing?.recipe ?? recipe); setScreen('recipient');
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : 'This bouquet could not be opened.'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const openAsCopy = () => {
    if (!collisionRecipe) return;
    const copy = { ...collisionRecipe, id: createId('bouquet'), createdAt: new Date().toISOString() };
    setCollisionRecipe(null); setRecipient(copy); setScreen('recipient');
  };

  const saveLabel = state.saveStatus === 'saving' ? 'Saving…' : state.saveStatus === 'saved' ? 'Saved' : state.saveStatus === 'error' ? 'Not saved' : '';
  const chromeVisible = screen !== 'landing' && screen !== 'setup' && screen !== 'recipient';

  return (
    <div className={`product-shell screen-${screen}`}>
      {chromeVisible && <Header cameraRunning={tracking.running} saveLabel={saveLabel} onHome={goHome} onArchive={openArchive} onHelp={() => { controller.cancelActive('Help opened.'); setHelpOpen(true); }} onCameraOff={tracking.stop} />}
      {screen === 'landing' && <Landing onHands={startHands} onMouse={startMouse} onOpen={triggerImport} />}
      {screen === 'setup' && <CameraSetup videoRef={tracking.setupVideoRef} status={tracking.status === 'requesting' ? 'Waiting for camera permission.' : tracking.status === 'loading model' ? 'Loading the local hand model.' : tracking.status === 'ready' ? tracking.handVisible ? 'Hand found. Try a slow pinch.' : 'Model ready. Put one hand in the box.' : 'Preparing hand mode.'} ready={tracking.practiceComplete} handVisible={tracking.handVisible} practiceComplete={tracking.practiceComplete} error={tracking.error} onContinue={continueHands} onMouse={startMouse} onRetry={() => void tracking.startSetup()} onStop={goHome} />}
      {screen === 'studio' && <Studio state={state} store={store} controller={controller} growth={growth} species={species} onSpecies={setSpecies} inputMode={inputMode} onMode={changeMode} geometryView={geometryView} onGeometryView={setGeometryView} cameraRunning={tracking.running} cameraUnderlay={cameraUnderlay} onCameraUnderlay={setCameraUnderlay} stageRef={stageRef} diagnostics={tracking.diagnostics} onFinish={finish} sensitivity={sensitivity} onSensitivity={setSensitivity} onRecalibrate={() => { tracking.stop(); setInputMode('hands'); setScreen('setup'); }} cameraPaused={tracking.paused} cameraError={tracking.error} onResumeCamera={() => { tracking.stop(); setInputMode('hands'); setScreen('setup'); }} />}
      {screen === 'finish' && <Finish recipe={state.recipe} store={store} onBack={() => setScreen('studio')} onFinished={async (print: PrintScene) => repository.save(state.recipe, state.revision, true, await renderThumbnail(print))} />}
      {screen === 'archive' && <ArchiveView records={archiveRecords} onBack={() => setScreen('studio')} onOpen={(record) => { store.replace(record.recipe); setInputMode('mouse'); setScreen('studio'); }} onDelete={setDeleteRecord} />}
      {screen === 'recipient' && recipient && <Recipient recipe={recipient} onMakeOne={() => { setRecipient(null); store.replace(createEmptyBouquet()); setInputMode('mouse'); setScreen('studio'); }} />}
      <input ref={fileInput} className="visually-hidden" type="file" accept=".json,.bouquet.json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} />
      {importError && <Dialog title="Could not open file" onClose={() => setImportError(null)}><p>{importError}</p><button className="primary-button" onClick={triggerImport}>Choose another file</button></Dialog>}
      {collisionRecipe && <Dialog title="Duplicate bouquet file" onClose={() => setCollisionRecipe(null)}><p>A different bouquet already uses this ID. The saved copy will stay unchanged.</p><button className="primary-button" onClick={openAsCopy}>Open as a new copy</button></Dialog>}
      {deleteRecord && <Dialog title="Delete bouquet" onClose={() => setDeleteRecord(null)}><p>This removes the browser copy. Files you exported will stay on disk.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setDeleteRecord(null)}>Keep it</button><button className="danger-button" onClick={() => void repository.delete(deleteRecord.id).then(() => { setDeleteRecord(null); void refreshArchive(); })}>Delete</button></div></Dialog>}
      {helpOpen && <Dialog title="Grow a flower" onClose={() => setHelpOpen(false)}><ol className="help-list"><li>Choose Cosmos, Wild rose, or Chamomile.</li><li>Pinch or press the seed and draw the stem.</li><li>Let go, then pinch or press the flower.</li><li>Move sideways to turn it. Move up or down to change the petal width.</li></ol><p>With a keyboard, use the arrows and Enter for each step. Press Escape to cancel the unfinished flower.</p></Dialog>}
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', listener); return () => { document.removeEventListener('keydown', listener); previous?.focus(); }; }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button ref={closeRef} aria-label="Close dialog" title="Close" onClick={onClose}>×</button></div>{children}</section></div>;
}
