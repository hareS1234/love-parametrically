export class CameraError extends Error {
  constructor(message: string, public code: 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'play') { super(message); }
}

export class CameraManager {
  private generation = 0;
  private stream: MediaStream | null = null;

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    const request = ++this.generation;
    if (!window.isSecureContext) throw new CameraError('Hand mode needs HTTPS or the provided loopback address.', 'insecure');
    if (!navigator.mediaDevices?.getUserMedia || typeof Worker === 'undefined') throw new CameraError('This browser cannot start hand mode. Use the mouse or keyboard.', 'unsupported');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      throw new CameraError(name === 'NotAllowedError' ? 'Camera permission was declined. Use the mouse or keyboard.' : 'The camera is busy or unavailable. Retry or use the mouse.', name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
    if (request !== this.generation) { this.stopStream(stream); throw new DOMException('Camera request became obsolete.', 'AbortError'); }
    this.stop();
    this.generation = request;
    this.stream = stream;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try { await video.play(); }
    catch { this.stop(); throw new CameraError('Retry to start camera playback, or use the mouse.', 'play'); }
    return stream;
  }

  stop(): void {
    this.generation += 1;
    if (this.stream) this.stopStream(this.stream);
    this.stream = null;
  }

  private stopStream(stream: MediaStream): void { stream.getTracks().forEach((track) => track.stop()); }
  isRunning(): boolean { return Boolean(this.stream?.getTracks().some((track) => track.readyState === 'live')); }
  getStream(): MediaStream | null { return this.stream; }
}
