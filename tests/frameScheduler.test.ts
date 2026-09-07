// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FrameScheduler, type WorkerHandResult } from '../src/vision/frameScheduler';

class FakeWorker extends EventTarget {
  postMessage = vi.fn();
}

describe('frame scheduler identity and age gates', () => {
  it('ignores old sessions, stale results, and older accepted frames (LP-07)', () => {
    const worker = new FakeWorker(); const accepted = vi.fn(); const stale = vi.fn();
    const video = { currentTime: 1, requestVideoFrameCallback: vi.fn(() => 1), cancelVideoFrameCallback: vi.fn() } as unknown as HTMLVideoElement;
    const scheduler = new FrameScheduler({ video, worker: worker as unknown as Worker, sessionId: 7, onResult: accepted, onStale: stale, onStall: vi.fn() });
    scheduler.start();
    const now = performance.timeOrigin + performance.now();
    const result = (sessionId: number, frameId: number, capturedAtMs = now): WorkerHandResult => ({ type: 'RESULT', sessionId, frameId, capturedAtMs, completedAtMs: now, result: { landmarks: [], handednesses: [] } });
    worker.dispatchEvent(new MessageEvent('message', { data: result(6, 1) }));
    worker.dispatchEvent(new MessageEvent('message', { data: result(7, 2, now - 500) }));
    worker.dispatchEvent(new MessageEvent('message', { data: result(7, 3) }));
    worker.dispatchEvent(new MessageEvent('message', { data: result(7, 2) }));
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(stale).toHaveBeenCalledTimes(1);
    expect(accepted.mock.calls[0][0].frameId).toBe(3);
    scheduler.stop();
  });
});
