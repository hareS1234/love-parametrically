import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

type InitMessage = { type: 'INIT'; sessionId: number; modelUrl: string; wasmRootUrl: string };
type FrameMessage = { type: 'FRAME'; sessionId: number; frameId: number; capturedAtMs: number; bitmap: ImageBitmap };
type CloseMessage = { type: 'CLOSE'; sessionId: number };
type Incoming = InitMessage | FrameMessage | CloseMessage;

const worker = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: HandLandmarker | null = null;
let sessionId = -1;

function installSameOriginNetworkBoundary() {
  const nativeFetch = worker.fetch.bind(worker);
  const guardedFetch: typeof fetch = (input, init) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    let requestedUrl: URL;
    try {
      requestedUrl = new URL(rawUrl, worker.location.href);
    } catch {
      return Promise.reject(new TypeError('The vision worker rejected an invalid asset URL.'));
    }

    const isNetworkRequest = requestedUrl.protocol === 'http:' || requestedUrl.protocol === 'https:';
    if (isNetworkRequest && requestedUrl.origin !== worker.location.origin) {
      return Promise.reject(new TypeError('The vision worker only permits same-origin asset requests.'));
    }
    return nativeFetch(input, init);
  };

  Object.defineProperty(worker, 'fetch', { configurable: false, writable: false, value: guardedFetch });
}

installSameOriginNetworkBoundary();

async function initialize(message: InitMessage) {
  landmarker?.close();
  landmarker = null;
  sessionId = message.sessionId;
  try {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    if (sessionId !== message.sessionId) return;
    const fileset = await FilesetResolver.forVisionTasks(message.wasmRootUrl);
    if (sessionId !== message.sessionId) return;
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
      baseOptions: { modelAssetPath: message.modelUrl, delegate: 'CPU' },
    });
    worker.postMessage({ type: 'READY', sessionId });
  } catch (error) {
    worker.postMessage({ type: 'ERROR', sessionId: message.sessionId, message: error instanceof Error ? error.message : 'The hand model could not start.' });
  }
}

function serializableResult(result: HandLandmarkerResult) {
  return {
    landmarks: result.landmarks.map((hand) => hand.map(({ x, y, z }) => ({ x, y, z }))),
    handednesses: result.handedness.map((items) => items.map(({ categoryName, score }) => ({ categoryName, score }))),
  };
}

worker.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'INIT') { await initialize(message); return; }
  if (message.type === 'CLOSE') {
    if (message.sessionId === sessionId) { landmarker?.close(); landmarker = null; sessionId = -1; }
    return;
  }
  const { bitmap } = message;
  try {
    if (!landmarker || message.sessionId !== sessionId) return;
    const result = landmarker.detectForVideo(bitmap, message.capturedAtMs);
    worker.postMessage({ type: 'RESULT', sessionId, frameId: message.frameId, capturedAtMs: message.capturedAtMs, completedAtMs: performance.timeOrigin + performance.now(), result: serializableResult(result) });
  } catch (error) {
    worker.postMessage({ type: 'FRAME_ERROR', sessionId: message.sessionId, frameId: message.frameId, message: error instanceof Error ? error.message : 'Frame inference failed.' });
  } finally {
    bitmap.close();
  }
};
