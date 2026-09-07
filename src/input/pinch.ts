import type { Vec2 } from '../data/schema';
import { imagePoint, rawToStage, type NormalizedLandmark } from './coordinates';

export interface PinchSample {
  landmarks: NormalizedLandmark[];
  sourceWidth: number;
  sourceHeight: number;
  timeMs: number;
  resultAgeMs: number;
}

export type PinchEdge = 'press' | 'move' | 'release' | 'cancel' | null;

export interface PinchOutput {
  edge: PinchEdge;
  pressed: boolean;
  ratio: number;
  point: Vec2;
  valid: boolean;
}

const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const smooth = (previous: number, sample: number, dtMs: number, tauMs: number) => previous + (1 - Math.exp(-dtMs / tauMs)) * (sample - previous);

export class PinchDetector {
  private pressed = false;
  private filteredRatio: number | null = null;
  private filteredPoint: Vec2 | null = null;
  private lastTime: number | null = null;
  private dwellStart: number | null = null;
  private dwellKind: 'press' | 'release' | null = null;
  private rearmAt = 0;

  constructor(private cursorTauMs = 50) {}

  setCursorTau(tauMs: number): void { this.cursorTauMs = tauMs; }

  update(sample: PinchSample): PinchOutput {
    const invalid = (): PinchOutput => ({ edge: null, pressed: this.pressed, ratio: this.filteredRatio ?? Number.NaN, point: this.filteredPoint ?? [0, 0], valid: false });
    if (sample.resultAgeMs > 200 || sample.landmarks.length < 18) return invalid();
    const thumb = sample.landmarks[4];
    const index = sample.landmarks[8];
    const p5 = imagePoint(sample.landmarks[5], sample.sourceWidth, sample.sourceHeight);
    const p17 = imagePoint(sample.landmarks[17], sample.sourceWidth, sample.sourceHeight);
    const palmWidth = distance(p5, p17);
    const minimumPalm = 28 * (sample.sourceWidth / 640);
    const thumbPoint = imagePoint(thumb, sample.sourceWidth, sample.sourceHeight);
    const indexPoint = imagePoint(index, sample.sourceWidth, sample.sourceHeight);
    const rawRatio = distance(thumbPoint, indexPoint) / palmWidth;
    if (![rawRatio, thumb.x, thumb.y, index.x, index.y].every(Number.isFinite) || palmWidth < minimumPalm) return invalid();

    const mappedThumb = rawToStage(thumb);
    const mappedIndex = rawToStage(index);
    const rawPoint: Vec2 = [(mappedThumb[0] + mappedIndex[0]) / 2, (mappedThumb[1] + mappedIndex[1]) / 2];
    const gap = this.lastTime === null ? 0 : sample.timeMs - this.lastTime;
    if (this.lastTime === null || gap > 250) {
      this.filteredRatio = rawRatio;
      this.filteredPoint = rawPoint;
      this.dwellStart = null;
      this.dwellKind = null;
    } else {
      this.filteredRatio = smooth(this.filteredRatio ?? rawRatio, rawRatio, gap, 30);
      this.filteredPoint = [smooth(this.filteredPoint?.[0] ?? rawPoint[0], rawPoint[0], gap, this.cursorTauMs), smooth(this.filteredPoint?.[1] ?? rawPoint[1], rawPoint[1], gap, this.cursorTauMs)];
      if (gap > 100) { this.dwellStart = null; this.dwellKind = null; }
    }
    this.lastTime = sample.timeMs;
    const desired = !this.pressed && (this.filteredRatio ?? 1) <= 0.3 ? 'press' : this.pressed && (this.filteredRatio ?? 0) >= 0.45 ? 'release' : null;
    let edge: PinchEdge = this.pressed ? 'move' : null;
    if (desired && (desired !== 'press' || sample.timeMs >= this.rearmAt)) {
      if (this.dwellKind !== desired) { this.dwellKind = desired; this.dwellStart = sample.timeMs; }
      if (this.dwellStart !== null && sample.timeMs - this.dwellStart >= 90) {
        this.pressed = desired === 'press';
        edge = desired;
        if (desired === 'release') this.rearmAt = sample.timeMs + 180;
        this.dwellStart = null;
        this.dwellKind = null;
      }
    } else if (!desired) {
      this.dwellStart = null;
      this.dwellKind = null;
    }
    return { edge, pressed: this.pressed, ratio: this.filteredRatio ?? rawRatio, point: this.filteredPoint ?? rawPoint, valid: true };
  }

  cancel(): PinchOutput {
    const wasPressed = this.pressed;
    this.reset();
    return { edge: wasPressed ? 'cancel' : null, pressed: false, ratio: Number.NaN, point: [0, 0], valid: false };
  }

  reset(): void {
    this.pressed = false;
    this.filteredRatio = null;
    this.filteredPoint = null;
    this.lastTime = null;
    this.dwellStart = null;
    this.dwellKind = null;
    this.rearmAt = 0;
  }
}

export function calculatePinchRatio(landmarks: NormalizedLandmark[], sourceWidth: number, sourceHeight: number): number {
  return distance(imagePoint(landmarks[4], sourceWidth, sourceHeight), imagePoint(landmarks[8], sourceWidth, sourceHeight)) / distance(imagePoint(landmarks[5], sourceWidth, sourceHeight), imagePoint(landmarks[17], sourceWidth, sourceHeight));
}
