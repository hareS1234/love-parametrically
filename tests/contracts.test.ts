import { describe, expect, it } from 'vitest';
import { parseBouquet } from '../src/data/schema';
import { noteFits } from '../src/export/printLayout';
import { buildBouquetScene, makeConstructionShapes } from '../src/geometry/scene';
import { fitStem } from '../src/geometry/stem';
import { layoutPrint } from '../src/export/printLayout';
import { serializeSvg } from '../src/export/svg';
import { buildHandShapes } from '../src/render/livingGeometry';
import { MAX_RECIPE_BYTES, readBouquetFile } from '../src/data/files';
import { fixtureRecipe } from './fixtures/recipes';

describe('recipe and export contracts', () => {
  it('rejects unknown or prototype-bearing properties (LP-14)', () => {
    const unknown = JSON.parse(JSON.stringify({ ...fixtureRecipe, schemaVersion: 99 }));
    expect(() => parseBouquet(unknown)).toThrow();
    const polluted = JSON.parse(JSON.stringify(fixtureRecipe).replace('"format"', '"__proto__":{"polluted":true},"format"'));
    expect(() => parseBouquet(polluted)).toThrow();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('rejects calendar-shaped dates that do not exist', () => {
    expect(() => parseBouquet({ ...fixtureRecipe, dedication: { ...fixtureRecipe.dedication, displayDate: '2026-02-31' } })).toThrow(/real calendar date/);
  });

  it('rejects a single dedication word wider than the print box', () => {
    expect(noteFits('x'.repeat(160))).toBe(false);
  });

  it('rejects oversized files and reports unknown renderer versions before construction', async () => {
    await expect(readBouquetFile(new Blob([new Uint8Array(MAX_RECIPE_BYTES + 1)]))).rejects.toThrow(/64 KiB/);
    await expect(readBouquetFile(new Blob([JSON.stringify({ ...fixtureRecipe, geometryVersion: 'botanical-v2' })]))).rejects.toThrow(/unsupported geometry version botanical-v2/);
  });

  it('escapes dedication HTML and emits no executable or external SVG content (LP-15, LP-22)', () => {
    const svg = serializeSvg(layoutPrint(fixtureRecipe, buildBouquetScene(fixtureRecipe)));
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toMatch(/<script|foreignObject|(?:href|src)=["']https?:|onload=/i);
    expect(svg).not.toContain('estimated-hand');
  });

  it('construction points exactly use the stored stem controls (LP-20)', () => {
    const flower = fixtureRecipe.flowers[0];
    const construction = makeConstructionShapes(flower.stem, 55);
    const dots = construction.filter((shape) => shape.kind === 'circle').map((shape) => shape.center);
    expect(dots).toEqual(flower.stem);
  });

  it('keeps every print geometry coordinate finite and inside the SVG viewBox', () => {
    const print = layoutPrint(fixtureRecipe, buildBouquetScene(fixtureRecipe));
    const points = print.shapes.flatMap((shape) => {
      if (shape.kind === 'path') return shape.commands.flatMap((command) => command.op === 'Z' ? [] : command.op === 'C' ? [command.c1, command.c2, command.point] : [command.point]);
      if (shape.kind === 'line') return [shape.from, shape.to];
      if (shape.kind === 'text') return [shape.point];
      return [shape.center];
    });
    expect(points.flat().every(Number.isFinite)).toBe(true);
    expect(points.every(([x, y]) => x >= 0 && x <= print.width && y >= 0 && y <= print.height)).toBe(true);
  });

  it('does not fabricate a hand when none is supplied (LP-21)', () => expect(buildHandShapes([], true)).toEqual([]));

  it('bounds pathological stem input and keeps control y monotone (LP-11)', () => {
    const samples = Array.from({ length: 200 }, (_, index) => ({ point: [index % 2 ? -10000 : 10000, 620 - index * 17] as const, timeMs: index * 10 }));
    const stem = fitStem(samples, [512, 620], [10000, -9000]);
    expect(stem.flat().every(Number.isFinite)).toBe(true);
    expect(stem[0][1]).toBeGreaterThan(stem[1][1]); expect(stem[1][1]).toBeGreaterThan(stem[2][1]); expect(stem[2][1]).toBeGreaterThan(stem[3][1]);
    expect(stem[3][0]).toBeLessThanOrEqual(854); expect(stem[3][1]).toBeGreaterThanOrEqual(130);
  });
});
