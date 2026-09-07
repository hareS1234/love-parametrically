import { describe, expect, it, vi } from 'vitest';
import type { BouquetV1 } from '../src/data/schema';
import { buildBouquetScene } from '../src/geometry/scene';
import { mulberry32, MULBERRY32_TEST_VECTOR } from '../src/geometry/random';
import { layoutPrint } from '../src/export/printLayout';
import { serializeSvg } from '../src/export/svg';

const recipe: BouquetV1 = {
  format: 'love-parametrically', schemaVersion: 1, geometryVersion: 'botanical-v1', randomVersion: 'mulberry32-v1', id: 'test-bouquet',
  createdAt: '2026-09-05T12:00:00.000Z', palette: 'rose-letter',
  flowers: [{ id: 'flower-1', seed: 2147483647, species: 'cosmos', stem: [[512, 640], [480, 535], [449, 430], [460, 340]], bloomRotation: 0.18, bloomAspect: 0.94, sizeMultiplier: 1, order: 0 }],
  dedication: { to: '', from: '', note: '', displayDate: null },
};

describe('versioned geometry', () => {
  it('matches the checked-in mulberry32-v1 test vector', () => {
    const random = mulberry32(MULBERRY32_TEST_VECTOR.seed);
    expect(Array.from({ length: 5 }, random)).toEqual(MULBERRY32_TEST_VECTOR.firstFive);
  });

  it('renders one seeded cosmos identically 100 times without global randomness', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random must not be used'); });
    const expected = JSON.stringify(buildBouquetScene(recipe));
    const expectedSvg = serializeSvg(layoutPrint(recipe, buildBouquetScene(recipe)));
    for (let index = 0; index < 100; index += 1) {
      const scene = buildBouquetScene(recipe);
      expect(JSON.stringify(scene)).toBe(expected);
      expect(serializeSvg(layoutPrint(recipe, scene))).toBe(expectedSvg);
    }
    randomSpy.mockRestore();
  });

  it('keeps every other flower stable when one seed changes (LP-02)', () => {
    const twoFlowerRecipe: BouquetV1 = {
      ...recipe,
      flowers: [
        recipe.flowers[0],
        { ...recipe.flowers[0], id: 'flower-2', seed: 123456789, species: 'wild-rose', stem: [[512, 640], [530, 520], [566, 402], [590, 285]], bloomAspect: 0.92, order: 1 },
      ],
    };
    const changed: BouquetV1 = { ...twoFlowerRecipe, flowers: twoFlowerRecipe.flowers.map((flower) => flower.id === 'flower-1' ? { ...flower, seed: flower.seed + 1 } : flower) };
    const originalShapes = buildBouquetScene(twoFlowerRecipe).shapes;
    const changedShapes = buildBouquetScene(changed).shapes;
    const untouched = (shapes: typeof originalShapes) => shapes.filter((shape) => !shape.role?.startsWith('flower:flower-1'));
    const altered = (shapes: typeof originalShapes) => shapes.filter((shape) => shape.role?.startsWith('flower:flower-1'));
    expect(untouched(changedShapes)).toEqual(untouched(originalShapes));
    expect(altered(changedShapes)).not.toEqual(altered(originalShapes));
  });

  it('never falls through to a different geometry renderer for a v1 recipe (LP-03)', () => {
    const expected = buildBouquetScene(recipe);
    expect(() => buildBouquetScene({ ...recipe, geometryVersion: 'botanical-v2' } as unknown as BouquetV1)).toThrow(/No renderer/);
    expect(buildBouquetScene(recipe)).toEqual(expected);
  });
});
