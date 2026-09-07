import { describe, expect, it } from 'vitest';
import { PinchDetector, calculatePinchRatio } from '../src/input/pinch';
import type { NormalizedLandmark } from '../src/input/coordinates';
import { activeRegionSourceRect, clientToStage, rawToStage } from '../src/input/coordinates';
import { buildHandShapes } from '../src/render/livingGeometry';
import { TrackAssociator } from '../src/input/tracks';

function hand(ratio: number, width = 640, height = 480): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.55, z: 0 }));
  const palmPixels = 128;
  landmarks[5] = { x: 0.4, y: 0.6 }; landmarks[17] = { x: 0.6, y: 0.6 };
  const gapNormalized = ratio * palmPixels / width;
  landmarks[4] = { x: 0.5 - gapNormalized / 2, y: 0.42 };
  landmarks[8] = { x: 0.5 + gapNormalized / 2, y: 0.42 };
  void height;
  return landmarks;
}

const sample = (ratio: number, timeMs: number) => ({ landmarks: hand(ratio), sourceWidth: 640, sourceHeight: 480, timeMs, resultAgeMs: 20 });

describe('pinch hysteresis and coordinates', () => {
  it('does not chatter while ratios oscillate between thresholds (LP-04)', () => {
    const detector = new PinchDetector();
    const edges = [0.32, 0.43, 0.34, 0.41, 0.33, 0.42].map((ratio, index) => detector.update(sample(ratio, index * 40)).edge).filter(Boolean);
    expect(edges).toEqual([]);
  });

  it('emits exactly two presses after confirmed releases and re-arm (LP-05)', () => {
    const detector = new PinchDetector();
    const sequence = [[0.2, 0], [0.2, 95], [0.6, 190], [0.6, 285], [0.6, 470], [0.2, 500], [0.2, 595], [0.2, 690]] as const;
    const edges = sequence.map(([ratio, time]) => detector.update(sample(ratio, time)).edge);
    expect(edges.filter((edge) => edge === 'press')).toHaveLength(2);
    expect(edges.filter((edge) => edge === 'release')).toHaveLength(1);
  });

  it('cancellation during a pinch never becomes a release (LP-06)', () => {
    const detector = new PinchDetector(); detector.update(sample(0.2, 0)); detector.update(sample(0.2, 95));
    expect(detector.cancel().edge).toBe('cancel');
  });

  it('uses image pixels so equivalent physical geometry has the same ratio (LP-16)', () => {
    const one = hand(0.3, 640, 480);
    const two = hand(0.3, 1280, 720);
    two[5] = { x: 0.45, y: 0.6 }; two[17] = { x: 0.55, y: 0.6 };
    const desiredGap = 0.3 * 128 / 1280;
    two[4] = { x: 0.5 - desiredGap / 2, y: 0.42 }; two[8] = { x: 0.5 + desiredGap / 2, y: 0.42 };
    expect(calculatePinchRatio(one, 640, 480)).toBeCloseTo(calculatePinchRatio(two, 1280, 720), 10);
  });

  it('maps mirrored calibration and letterboxed CSS coordinates (LP-17)', () => {
    expect(rawToStage({ x: 0.5, y: 0.5 })[0]).toBeCloseTo(512);
    expect(rawToStage({ x: 0.5, y: 0.5 })[1]).toBeCloseTo(384);
    expect(clientToStage(500, 400, { left: 100, top: 50, width: 800, height: 700 })).toEqual([512, 384]);
  });

  it('uses one crop and mirror mapping for the hand overlay and camera frame (LP-19)', () => {
    expect(activeRegionSourceRect(640, 480)).toEqual({ x: 76.8, y: 48, width: 486.4, height: 384 });
    const landmarks = hand(0.5);
    const shapes = buildHandShapes([{ id: 'hand-1', landmarks, ratio: 0.5, ageMs: 20, captured: false }], false);
    const firstJoint = shapes.find((shape) => shape.kind === 'circle' && shape.role === 'estimated-hand');
    expect(firstJoint?.kind).toBe('circle');
    if (firstJoint?.kind === 'circle') expect(firstJoint.center).toEqual(rawToStage(landmarks[0]));
  });
});

describe('two-hand association', () => {
  it('preserves IDs when the observation array order swaps (LP-08)', () => {
    const associator = new TrackAssociator();
    const left = { landmarks: hand(0.5).map((point) => ({ ...point, x: point.x - 0.22 })) };
    const right = { landmarks: hand(0.5).map((point) => ({ ...point, x: point.x + 0.22 })) };
    const first = associator.update([left, right], 0, null).tracks;
    const second = associator.update([right, left], 50, first[0].id);
    expect(second.ambiguousActive).toBe(false);
    expect(second.tracks.find((track) => track.id === first[0].id)?.landmarks[0].x).toBeCloseTo(left.landmarks[0].x);
  });

  it('suspends ownership when two candidates are equally plausible (LP-08)', () => {
    const associator = new TrackAssociator();
    const original = { landmarks: hand(0.5) };
    const activeId = associator.update([original], 0, null).tracks[0].id;
    const ambiguous = associator.update([{ landmarks: hand(0.5) }, { landmarks: hand(0.5) }], 50, activeId);
    expect(ambiguous.ambiguousActive).toBe(true);
  });

  it('keeps an application hand ID across a brief missing frame', () => {
    const associator = new TrackAssociator();
    const original = { landmarks: hand(0.5) };
    const first = associator.update([original], 0, null).tracks[0];
    expect(associator.update([], 50, first.id).tracks).toHaveLength(0);
    expect(associator.update([original], 100, first.id).tracks[0].id).toBe(first.id);
  });
});
