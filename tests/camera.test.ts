// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CameraManager } from '../src/vision/camera';

describe('camera lifecycle', () => {
  it('stops every late track after the request is cancelled', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class Worker {} });
    let resolveStream!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>((resolve) => { resolveStream = resolve; });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => pending) } });
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop, readyState: 'live' }] } as unknown as MediaStream;
    const video = { play: vi.fn(async () => undefined), pause: vi.fn(), srcObject: null, muted: false, playsInline: false } as unknown as HTMLVideoElement;
    const manager = new CameraManager();
    const request = manager.start(video);
    manager.stop();
    resolveStream(stream);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });
});
