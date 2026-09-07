import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { StageHandle } from '../app/Stage';
import type { GeometryDiagnostics } from '../app/Studio';
import type { SceneController } from '../interaction/controller';
import { PinchDetector } from '../input/pinch';
import { TrackAssociator, type HandObservation } from '../input/tracks';
import { pointInActiveRegion } from '../input/coordinates';
import type { LivingHand } from '../render/livingGeometry';
import { CameraError, CameraManager } from './camera';
import { FrameScheduler, type WorkerHandResult } from './frameScheduler';

type TrackingPhase = 'setup' | 'studio';
type TrackingStatus = 'idle' | 'requesting' | 'loading model' | 'ready' | 'running' | 'paused' | 'error';

export interface HandTrackingApi {
  setupVideoRef: RefObject<HTMLVideoElement | null>;
  status: TrackingStatus;
  error: string | null;
  practiceComplete: boolean;
  handVisible: boolean;
  running: boolean;
  paused: boolean;
  diagnostics: GeometryDiagnostics;
  startSetup(): Promise<void>;
  attachStudio(): Promise<void>;
  stop(): void;
}

export function useHandTracking(controller: SceneController, stageRef: RefObject<StageHandle | null>, cursorTauMs = 50): HandTrackingApi {
  const setupVideoRef = useRef<HTMLVideoElement>(null);
  const manager = useMemo(() => new CameraManager(), []);
  const workerRef = useRef<Worker | null>(null);
  const schedulerRef = useRef<FrameScheduler | null>(null);
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef<TrackingPhase>('setup');
  const sessionRef = useRef(0);
  const associator = useRef(new TrackAssociator());
  const detectors = useRef(new Map<string, PinchDetector>());
  const detectorLastSeen = useRef(new Map<string, number>());
  const lastHands = useRef<LivingHand[]>([]);
  const missingSince = useRef<number | null>(null);
  const history = useRef<Array<{ time: number; ratio: number }>>([]);
  const lastPublish = useRef(0);
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [handVisible, setHandVisible] = useState(false);
  const [hasCameraSession, setHasCameraSession] = useState(false);
  const handVisibleRef = useRef(false);
  const [diagnostics, setDiagnostics] = useState<GeometryDiagnostics>({ ratio: null, ageMs: null, history: [] });
  const recoveryOpenSince = useRef(new Map<string, number>());
  const recoveryEligible = useRef(new Set<string>());
  const cursorTauRef = useRef(cursorTauMs); cursorTauRef.current = cursorTauMs;

  const stopScheduler = () => { schedulerRef.current?.stop(); schedulerRef.current = null; };

  const processResult = useCallback((message: WorkerHandResult, ageMs: number) => {
    const now = message.capturedAtMs;
    const observations: HandObservation[] = message.result.landmarks.map((landmarks, index) => ({ landmarks, handedness: message.result.handednesses[index]?.[0]?.categoryName, handednessScore: message.result.handednesses[index]?.[0]?.score }));
    const activeId = controller.getSnapshot().ownerId;
    const associated = associator.current.update(observations, now, activeId);
    const visibleNow = associated.tracks.length > 0;
    if (visibleNow !== handVisibleRef.current) { handVisibleRef.current = visibleNow; setHandVisible(visibleNow); }
    const living: LivingHand[] = [];
    let representativeRatio: number | null = null;
    if (associated.tracks.length === 0) {
      missingSince.current ??= now;
      const missingFor = now - missingSince.current;
      if (activeId && missingFor >= 200) controller.handle({ type: 'suspend', ownerId: activeId, timeMs: now });
      living.push(...lastHands.current.map((hand) => ({ ...hand, paused: true, ageMs })));
    } else {
      missingSince.current = null;
      for (const track of associated.tracks) {
        detectorLastSeen.current.set(track.id, now);
        let detector = detectors.current.get(track.id);
        if (!detector) { detector = new PinchDetector(cursorTauRef.current); detectors.current.set(track.id, detector); }
        detector.setCursorTau(cursorTauRef.current);
        const output = detector.update({ landmarks: track.landmarks, sourceWidth: currentVideoRef.current?.videoWidth || 640, sourceHeight: currentVideoRef.current?.videoHeight || 480, timeMs: now, resultAgeMs: ageMs });
        representativeRatio ??= Number.isFinite(output.ratio) ? output.ratio : null;
        living.push({ id: track.id, landmarks: track.landmarks, ratio: output.ratio, ageMs, captured: activeId === track.id });
        if (!output.valid || !pointInActiveRegion(output.point)) {
          if (activeId === track.id) controller.handle({ type: 'suspend', ownerId: track.id, timeMs: now });
          continue;
        }
        if (phaseRef.current === 'setup') {
          if (output.edge === 'press') setPracticeComplete(true);
          continue;
        }
        if (associated.ambiguousActive && activeId) { controller.handle({ type: 'suspend', ownerId: activeId, timeMs: now }); continue; }
        if (controller.getSnapshot().state === 'suspended') {
          if (!output.pressed && output.ratio >= 0.45) {
            const since = recoveryOpenSince.current.get(track.id) ?? now; recoveryOpenSince.current.set(track.id, since);
            if (now - since >= 90) recoveryEligible.current.add(track.id);
          } else if (output.edge !== 'release') recoveryOpenSince.current.delete(track.id);
          if (output.edge === 'release') recoveryEligible.current.add(track.id);
          if (output.edge === 'press' && associated.tracks.length === 1 && recoveryEligible.current.has(track.id)) {
            recoveryEligible.current.delete(track.id); recoveryOpenSince.current.delete(track.id);
            controller.handle({ type: 'press', ownerId: track.id, point: output.point, timeMs: now });
          }
          continue;
        }
        if (output.edge === 'press') controller.handle({ type: 'press', ownerId: track.id, point: output.point, timeMs: now });
        else if (output.edge === 'move') controller.handle({ type: 'move', ownerId: track.id, point: output.point, timeMs: now });
        else if (output.edge === 'release') controller.handle({ type: 'release', ownerId: track.id, point: output.point, timeMs: now });
        else if (!output.pressed) controller.handle({ type: 'hover', ownerId: track.id, point: output.point, timeMs: now });
      }
      lastHands.current = living;
    }
    for (const [id, lastSeen] of detectorLastSeen.current) {
      if (id !== activeId && now - lastSeen > 2500) { detectorLastSeen.current.delete(id); detectors.current.delete(id); }
    }
    stageRef.current?.updateHands(living);
    controller.tick(now);
    if (representativeRatio !== null) {
      history.current.push({ time: now, ratio: representativeRatio });
      history.current = history.current.filter((item) => now - item.time <= 4000);
    }
    if (performance.now() - lastPublish.current >= 250) {
      lastPublish.current = performance.now();
      setDiagnostics({ ratio: representativeRatio, ageMs, history: [...history.current] });
    }
  }, [controller, stageRef]);

  const startScheduler = useCallback((video: HTMLVideoElement, worker: Worker, sessionId: number) => {
    stopScheduler(); currentVideoRef.current = video;
    const scheduler = new FrameScheduler({ video, worker, sessionId, onResult: processResult, onFrameSubmitted: () => stageRef.current?.captureCameraFrame(), onStale: () => { const ownerId = controller.getSnapshot().ownerId; const now = performance.timeOrigin + performance.now(); if (ownerId) controller.handle({ type: 'suspend', ownerId, timeMs: now }); controller.tick(now); }, onStall: () => { stopScheduler(); workerRef.current?.terminate(); workerRef.current = null; sessionRef.current += 1; manager.stop(); setHasCameraSession(false); setStatus('error'); setError('Hand tracking stopped. Retry or use the mouse. Your bouquet is still open.'); controller.cancelActive('Hand worker stalled.'); } });
    schedulerRef.current = scheduler; scheduler.start();
  }, [controller, manager, processResult]);

  const stop = useCallback(() => {
    stopScheduler();
    if (workerRef.current) { workerRef.current.postMessage({ type: 'CLOSE', sessionId: sessionRef.current }); workerRef.current.terminate(); workerRef.current = null; }
    manager.stop(); setHasCameraSession(false); controller.cancelActive('Camera was turned off.'); associator.current.reset(); detectors.current.clear(); detectorLastSeen.current.clear(); recoveryOpenSince.current.clear(); recoveryEligible.current.clear(); lastHands.current = []; history.current = [];
    stageRef.current?.updateHands([]); stageRef.current?.clearCameraFrame(); handVisibleRef.current = false; setHandVisible(false); setStatus('idle'); setError(null); setDiagnostics({ ratio: null, ageMs: null, history: [] });
    if (setupVideoRef.current) setupVideoRef.current.srcObject = null;
  }, [controller, manager, stageRef]);

  const startSetup = useCallback(async () => {
    const video = setupVideoRef.current; if (!video) return;
    stop(); phaseRef.current = 'setup'; setPracticeComplete(false); setStatus('requesting'); setError(null);
    try {
      await manager.start(video); setHasCameraSession(true);
      const sessionId = ++sessionRef.current;
      setStatus('loading model');
      const assetBase = new URL(import.meta.env.BASE_URL, window.location.href);
      const worker = new Worker(new URL('generated/hand-worker.js', assetBase)); workerRef.current = worker;
      worker.addEventListener('message', (event: MessageEvent<{ type: string; sessionId: number; message?: string }>) => {
        if (event.data.sessionId !== sessionId) return;
        if (event.data.type === 'READY') { setStatus('ready'); startScheduler(video, worker, sessionId); }
        else if (event.data.type === 'ERROR') { worker.terminate(); if (workerRef.current === worker) workerRef.current = null; manager.stop(); setHasCameraSession(false); setStatus('error'); setError(event.data.message ?? 'The local hand model could not start.'); }
      });
      worker.postMessage({ type: 'INIT', sessionId, modelUrl: new URL('models/hand_landmarker.task', assetBase).href, wasmRootUrl: new URL('wasm/', assetBase).href });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setStatus('error'); setError(reason instanceof CameraError ? reason.message : 'Camera startup failed.');
    }
  }, [manager, startScheduler, stop]);

  const attachStudio = useCallback(async () => {
    const video = stageRef.current?.getVideo(); const worker = workerRef.current; const stream = manager.getStream();
    if (!video || !worker || !stream) { setStatus('error'); setError('The camera session ended. Retry hands or use the mouse.'); return; }
    phaseRef.current = 'studio'; video.srcObject = stream; video.muted = true; video.playsInline = true;
    try { await video.play(); } catch { setStatus('error'); setError('Camera playback stopped. Retry hands or use the mouse.'); return; }
    startScheduler(video, worker, sessionRef.current); setStatus('running');
  }, [manager, stageRef, startScheduler]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const visibility = () => {
      if (document.hidden) {
        controller.cancelActive('The tab was hidden.'); stopScheduler(); setStatus('paused');
        stageRef.current?.updateHands(lastHands.current.map((hand) => ({ ...hand, paused: true })));
        timer = setTimeout(() => { stop(); setStatus('paused'); }, 5000);
      } else if (timer) { clearTimeout(timer); timer = null; }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [controller, manager, stageRef, stop]);

  useEffect(() => stop, [stop]);
  return { setupVideoRef, status, error, practiceComplete, handVisible, running: hasCameraSession, paused: status === 'paused', diagnostics, startSetup, attachStudio, stop };
}
