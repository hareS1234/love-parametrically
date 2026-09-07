import type { FlowerV1, Vec2 } from '../data/schema';
import { speciesPreset } from '../geometry/species';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function wrapBloomRotation(angle: number): number {
  const turn = Math.PI * 2;
  const wrapped = ((angle + Math.PI) % turn + turn) % turn - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

export function shapeBloomFromDrag(flower: FlowerV1, origin: Vec2, point: Vec2): FlowerV1 {
  const preset = speciesPreset[flower.species];
  const dx = point[0] - origin[0];
  const dy = point[1] - origin[1];
  const rotation = flower.bloomRotation + clamp(dx / 160, -1, 1) * Math.PI / preset.petals;
  const aspectRange = preset.aspect[1] - preset.aspect[0];
  const aspect = flower.bloomAspect - dy * aspectRange / 120;
  return {
    ...flower,
    bloomRotation: wrapBloomRotation(rotation),
    bloomAspect: clamp(aspect, preset.aspect[0], preset.aspect[1]),
  };
}
