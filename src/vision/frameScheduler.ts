export interface WorkerHandResult {
  type: 'RESULT'; sessionId: number; frameId: number; capturedAtMs: number; completedAtMs: number;
  result: { landmarks: Array<Array<{ x: number; y: number; z: number }>>; handednesses: Array<Array<{ categoryName: string; score: number }>> };
}

interface SchedulerOptions {
  video: HTMLVideoElement;
  worker: Worker;
  sessionId: number;
  onResult: (result: WorkerHandResult, ageMs: number) => void;
  onStall: () => void;
  onFrameSubmitted?: (frameId: number) => void;
  onStale?: (ageMs: number) => void;
}

export class FrameScheduler {
  private running = false;
  private inFlight = false;
  private frameId = 0;
  private lastAccepted = -1;
  private lastVideoTime = -1;
  private lastSubmitAt = 0;
  private raf = 0;
  private videoCallback = 0;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  constructor(private options: SchedulerOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.options.worker.addEventListener('message', this.onMessage);
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.options.worker.removeEventListener('message', this.onMessage);
    cancelAnimationFrame(this.raf);
    if ('cancelVideoFrameCallback' in this.options.video && this.videoCallback) this.options.video.cancelVideoFrameCallback(this.videoCallback);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    this.inFlight = false;
  }

  private onMessage = (event: MessageEvent<WorkerHandResult | { type: string; sessionId: number; frameId?: number }>) => {
    const message = event.data;
    if (message.sessionId !== this.options.sessionId) return;
    if (message.type !== 'RESULT' || !('result' in message)) {
      if (message.type === 'FRAME_ERROR') {
        this.inFlight = false; this.clearWatchdog(); this.consecutiveErrors += 1;
        if (this.consecutiveErrors >= 3) { this.running = false; this.options.onStall(); }
        else this.schedule();
      }
      return;
    }
    if (message.frameId <= this.lastAccepted) return;
    this.inFlight = false;
    this.clearWatchdog();
    this.consecutiveErrors = 0;
    const age = performance.timeOrigin + performance.now() - message.capturedAtMs;
    if (age <= 200) { this.lastAccepted = message.frameId; this.options.onResult(message, age); }
    else this.options.onStale?.(age);
    this.schedule();
  };

  private clearWatchdog() { if (this.watchdog) clearTimeout(this.watchdog); this.watchdog = null; }

  private schedule(): void {
    if (!this.running) return;
    const video = this.options.video;
    if ('requestVideoFrameCallback' in video) {
      this.videoCallback = video.requestVideoFrameCallback(() => void this.submit());
    } else {
      this.raf = requestAnimationFrame(() => void this.submit());
    }
  }

  private async submit(): Promise<void> {
    if (!this.running) return;
    const now = performance.timeOrigin + performance.now();
    if (this.inFlight || this.options.video.currentTime === this.lastVideoTime || now - this.lastSubmitAt < 1000 / 24) { this.schedule(); return; }
    this.lastVideoTime = this.options.video.currentTime;
    this.lastSubmitAt = now;
    this.inFlight = true;
    const frameId = ++this.frameId;
    try {
      this.options.onFrameSubmitted?.(frameId);
      const bitmap = await createImageBitmap(this.options.video);
      if (!this.running) { bitmap.close(); return; }
      this.options.worker.postMessage({ type: 'FRAME', sessionId: this.options.sessionId, frameId, capturedAtMs: now, bitmap }, [bitmap]);
      this.watchdog = setTimeout(() => { this.inFlight = false; this.running = false; this.options.onStall(); }, 2000);
    } catch {
      this.inFlight = false;
      this.schedule();
    }
  }
}
