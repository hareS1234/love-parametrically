import { describe, expect, it } from 'vitest';
import type { FlowerV1, Species } from '../src/data/schema';
import { speciesPreset } from '../src/geometry/species';
import { shapeBloomFromDrag, wrapBloomRotation } from '../src/interaction/bloomShape';

const flower = (species: Species): FlowerV1 => {
  const range = speciesPreset[species].aspect;
  return {
    id: `shape-${species}`,
    seed: 42,
    species,
    stem: [[512, 640], [500, 530], [490, 410], [480, 300]],
    bloomRotation: 3.12,
    bloomAspect: (range[0] + range[1]) / 2,
    sizeMultiplier: 1,
    order: 0,
  };
};

describe('petal shaping', () => {
  it('uses the final displacement without changing the seed, stem, or size', () => {
    const original = flower('cosmos');
    const shaped = shapeBloomFromDrag(original, [480, 300], [560, 252]);
    expect(shaped.seed).toBe(original.seed);
    expect(shaped.stem).toBe(original.stem);
    expect(shaped.sizeMultiplier).toBe(original.sizeMultiplier);
    expect(shaped.bloomRotation).not.toBe(original.bloomRotation);
    expect(shaped.bloomAspect).toBeGreaterThan(original.bloomAspect);
    expect(shapeBloomFromDrag(original, [480, 300], [560, 252])).toEqual(shaped);
  });

  it.each<Species>(['cosmos', 'wild-rose', 'chamomile'])('clamps %s width at both ends', (species) => {
    const original = flower(species);
    const range = speciesPreset[species].aspect;
    expect(shapeBloomFromDrag(original, [0, 0], [0, -10_000]).bloomAspect).toBe(range[1]);
    expect(shapeBloomFromDrag(original, [0, 0], [0, 10_000]).bloomAspect).toBe(range[0]);
  });

  it('wraps turn values into the stored range', () => {
    expect(wrapBloomRotation(Math.PI * 5)).toBeCloseTo(-Math.PI);
    expect(wrapBloomRotation(-Math.PI * 4)).toBeCloseTo(0);
  });
});
