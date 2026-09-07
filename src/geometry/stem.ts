import type { Vec2 } from '../data/schema';

export const ROOT: Vec2 = [512, 640];

export interface PathSample { point: Vec2; timeMs: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (value: number) => Math.round(value * 10_000) / 10_000;
const rounded = (point: Vec2): Vec2 => [round(point[0]), round(point[1])];

export function appendSample(samples: PathSample[], point: Vec2, timeMs: number): PathSample[] {
  const previous = samples.at(-1);
  if (previous && distance(previous.point, point) < 4 && timeMs - previous.timeMs < 50) return samples;
  const next = [...samples, { point, timeMs }];
  return next.length <= 96 ? next : resampleByArcLength(next, 96);
}

export function resampleByArcLength(samples: PathSample[], count: number): PathSample[] {
  if (samples.length <= count) return samples;
  const distances = [0];
  for (let index = 1; index < samples.length; index += 1) distances.push(distances[index - 1] + distance(samples[index - 1].point, samples[index].point));
  const total = distances.at(-1) ?? 0;
  if (total === 0) return [samples[0]];
  const result: PathSample[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = (total * index) / (count - 1);
    let upper = distances.findIndex((item) => item >= target);
    if (upper <= 0) { result.push(samples[0]); continue; }
    const lower = upper - 1;
    const span = distances[upper] - distances[lower] || 1;
    const q = (target - distances[lower]) / span;
    result.push({
      point: [samples[lower].point[0] + (samples[upper].point[0] - samples[lower].point[0]) * q, samples[lower].point[1] + (samples[upper].point[1] - samples[lower].point[1]) * q],
      timeMs: samples[lower].timeMs + (samples[upper].timeMs - samples[lower].timeMs) * q,
    });
  }
  return result;
}

function meanXByArcThird(samples: PathSample[], c0: Vec2, first: boolean): number | null {
  if (samples.length < 4) return null;
  const totals = [0];
  for (let index = 1; index < samples.length; index += 1) totals.push(totals[index - 1] + distance(samples[index - 1].point, samples[index].point));
  const total = totals.at(-1) ?? 0;
  if (total < 12) return null;
  const points = samples.filter((_, index) => first ? totals[index] <= total / 3 : totals[index] >= total * 2 / 3);
  return points.reduce((sum, sample) => sum + sample.point[0] - c0[0], 0) / Math.max(1, points.length);
}

export function provisionalTip(start: Vec2, cursor: Vec2): Vec2 {
  const dx = clamp(cursor[0] - start[0], -270, 270);
  const height = clamp(start[1] - cursor[1], 0, 430);
  return [clamp(ROOT[0] + dx, 170, 854), clamp(ROOT[1] - height, 130, 640)];
}

export function fitStem(samples: PathSample[], c0: Vec2, cursor: Vec2): readonly [Vec2, Vec2, Vec2, Vec2] {
  const tip = provisionalTip(c0, cursor);
  const height = ROOT[1] - tip[1];
  const fallbackDelta = tip[0] - ROOT[0];
  const a = meanXByArcThird(samples, c0, true) ?? fallbackDelta / 3;
  const b = meanXByArcThird(samples, c0, false) ?? (fallbackDelta * 2) / 3;
  const p1y = ROOT[1] - 0.35 * height;
  let p2y = tip[1] + 0.3 * height;
  p2y = Math.min(p1y - 0.0001, Math.max(tip[1] + 0.0001, p2y));
  return [
    ROOT,
    rounded([ROOT[0] + clamp(a, -0.35 * height, 0.35 * height), p1y]),
    rounded([ROOT[0] + clamp(b, -0.65 * height, 0.65 * height), p2y]),
    rounded(tip),
  ];
}

export function cubicPoint(stem: readonly [Vec2, Vec2, Vec2, Vec2], t: number): Vec2 {
  const [p0, p1, p2, p3] = stem;
  const u = 1 - t;
  return [u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0], u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1]];
}

export function cubicTangent(stem: readonly [Vec2, Vec2, Vec2, Vec2], t: number): Vec2 {
  const [p0, p1, p2, p3] = stem;
  const u = 1 - t;
  return [3 * u ** 2 * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t ** 2 * (p3[0] - p2[0]), 3 * u ** 2 * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t ** 2 * (p3[1] - p2[1])];
}
