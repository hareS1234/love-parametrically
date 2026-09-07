import type { BouquetV1, Vec2 } from '../data/schema';
import { blossomConstruction, blossomRadius, buildFlowerShapes, paletteColors } from './species';
import type { PathCommand, Scene, SceneShape } from './types';

const vaseBack: PathCommand[] = [
  { op: 'M', point: [432, 598] },
  { op: 'C', c1: [444, 612], c2: [450, 686], point: [466, 722] },
  { op: 'C', c1: [482, 741], c2: [542, 741], point: [558, 722] },
  { op: 'C', c1: [574, 686], c2: [580, 612], point: [592, 598] },
  { op: 'Z' },
];

const vaseLip: PathCommand[] = [
  { op: 'M', point: [431, 598] },
  { op: 'C', c1: [462, 584], c2: [562, 584], point: [593, 598] },
  { op: 'C', c1: [562, 615], c2: [462, 615], point: [431, 598] },
  { op: 'Z' },
];

function blossomBounds(recipe: BouquetV1): Scene['bounds'] {
  if (recipe.flowers.length === 0) return { minX: 420, minY: 580, maxX: 604, maxY: 744 };
  return recipe.flowers.reduce((bounds, flower) => {
    const radius = blossomRadius(flower);
    const [x, y] = flower.stem[3];
    return { minX: Math.min(bounds.minX, x - radius), minY: Math.min(bounds.minY, y - radius), maxX: Math.max(bounds.maxX, x + radius), maxY: Math.max(bounds.maxY, y + radius) };
  }, { minX: 420, minY: 120, maxX: 604, maxY: 744 });
}

export function buildBouquetScene(recipe: BouquetV1): Scene {
  if (recipe.geometryVersion !== 'botanical-v1' || recipe.randomVersion !== 'mulberry32-v1') {
    throw new Error('No renderer is registered for this bouquet version.');
  }
  const palette = paletteColors[recipe.palette];
  const shapes: SceneShape[] = [
    { kind: 'ellipse', center: [512, 738], rx: 118, ry: 13, fill: '#322824', opacity: 0.08, role: 'vase-shadow' },
    { kind: 'path', commands: vaseBack, fill: '#ede3d2', stroke: '#7b293e', strokeWidth: 1.4, role: 'vase-back' },
  ];
  const ordered = [...recipe.flowers].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const flower of ordered) shapes.push(...buildFlowerShapes(flower, palette));
  shapes.push(
    { kind: 'path', commands: vaseLip, fill: '#f6ead8', stroke: '#7b293e', strokeWidth: 1.4, role: 'vase-front' },
    { kind: 'path', commands: [
      { op: 'M', point: [466, 642] },
      { op: 'C', c1: [490, 652], c2: [534, 648], point: [559, 633] },
    ], fill: 'none', stroke: '#c98799', strokeWidth: 0.8, opacity: 0.55, role: 'vase-mark' },
  );
  return { width: 1024, height: 768, shapes, bounds: blossomBounds(recipe) };
}

export function makeConstructionShapes(stem: readonly [Vec2, Vec2, Vec2, Vec2], radius: number, selected = false): SceneShape[] {
  const shapes: SceneShape[] = [
    { kind: 'path', commands: [{ op: 'M', point: stem[0] }, { op: 'L', point: stem[1] }, { op: 'L', point: stem[2] }, { op: 'L', point: stem[3] }], fill: 'none', stroke: '#77846a', strokeWidth: 1.25, opacity: 0.78, dash: [7, 6], role: 'construction' },
    { kind: 'line', from: stem[2], to: stem[3], stroke: '#77846a', strokeWidth: 1, opacity: 0.6, role: 'construction' },
    { kind: 'ellipse', center: stem[3], rx: radius, ry: radius, fill: 'none', stroke: selected ? '#7b293e' : '#77846a', strokeWidth: selected ? 1.5 : 1, dash: [6, 5], opacity: 0.72, role: 'construction' },
  ];
  stem.forEach((point, index) => {
    shapes.push({ kind: 'circle', center: point, radius: index === 0 || index === 3 ? 3.4 : 4.2, fill: '#f6f1e7', stroke: '#536249', strokeWidth: 1.2, role: 'construction' });
    shapes.push({ kind: 'text', point: [point[0] + (index === 2 ? -25 : 8), point[1] + (index === 3 ? -9 : -7)], text: `P${index}`, fontSize: 12, fontFamily: 'mono', fill: '#536249', role: 'construction' });
  });
  return shapes;
}

export function makeBlossomConstructionShapes(flower: BouquetV1['flowers'][number]): SceneShape[] {
  const construction = blossomConstruction(flower);
  const shapes: SceneShape[] = construction.axes.map((axis) => ({ kind: 'line', from: axis.from, to: axis.to, stroke: '#77846a', strokeWidth: 0.75, opacity: 0.34, dash: [4, 5], role: 'construction' }));
  const rep = construction.representative;
  shapes.push(
    { kind: 'line', from: rep.base, to: rep.c1, stroke: '#536249', strokeWidth: 0.9, opacity: 0.62, role: 'construction' },
    { kind: 'line', from: rep.c2, to: rep.shoulder, stroke: '#536249', strokeWidth: 0.9, opacity: 0.62, role: 'construction' },
    { kind: 'circle', center: rep.c1, radius: 2.8, fill: '#f6f1e7', stroke: '#536249', strokeWidth: 0.9, role: 'construction' },
    { kind: 'circle', center: rep.c2, radius: 2.8, fill: '#f6f1e7', stroke: '#536249', strokeWidth: 0.9, role: 'construction' },
  );
  return shapes;
}

export function makeBloomShapingShapes(flower: BouquetV1['flowers'][number]): SceneShape[] {
  const [x, y] = flower.stem[3];
  const radius = Math.max(54, blossomRadius(flower) * 0.86);
  const turn = Math.round(flower.bloomRotation * 180 / Math.PI);
  return [
    { kind: 'line', from: [x - radius, y], to: [x + radius, y], stroke: '#7b293e', strokeWidth: 1, opacity: 0.62, dash: [4, 5], role: 'bloom-shape-guide' },
    { kind: 'line', from: [x, y - radius], to: [x, y + radius], stroke: '#7b293e', strokeWidth: 1, opacity: 0.62, dash: [4, 5], role: 'bloom-shape-guide' },
    { kind: 'circle', center: flower.stem[3], radius: 4.2, fill: '#f6f1e7', stroke: '#7b293e', strokeWidth: 1.2, role: 'bloom-shape-guide' },
    { kind: 'text', point: [x + radius + 7, y + 4], text: 'turn', fontSize: 10, fontFamily: 'mono', fill: '#7b293e', role: 'bloom-shape-guide' },
    { kind: 'text', point: [x + 7, y - radius - 7], text: 'width', fontSize: 10, fontFamily: 'mono', fill: '#7b293e', role: 'bloom-shape-guide' },
    { kind: 'text', point: [x - radius, y + radius + 17], text: `width ${flower.bloomAspect.toFixed(2)} / turn ${turn}°`, fontSize: 10, fontFamily: 'mono', fill: '#6d6258', role: 'bloom-shape-guide' },
  ];
}

export function transformScene(scene: Scene, scale: number, offset: Vec2): SceneShape[] {
  const point = (value: Vec2): Vec2 => [offset[0] + value[0] * scale, offset[1] + value[1] * scale];
  return scene.shapes.map((shape): SceneShape => {
    if (shape.kind === 'path') return { ...shape, commands: shape.commands.map((command) => command.op === 'Z' ? command : command.op === 'C' ? { ...command, c1: point(command.c1), c2: point(command.c2), point: point(command.point) } : { ...command, point: point(command.point) }), strokeWidth: shape.strokeWidth === undefined ? undefined : shape.strokeWidth * scale };
    if (shape.kind === 'circle') return { ...shape, center: point(shape.center), radius: shape.radius * scale, strokeWidth: shape.strokeWidth === undefined ? undefined : shape.strokeWidth * scale };
    if (shape.kind === 'ellipse') return { ...shape, center: point(shape.center), rx: shape.rx * scale, ry: shape.ry * scale, strokeWidth: shape.strokeWidth === undefined ? undefined : shape.strokeWidth * scale };
    if (shape.kind === 'line') return { ...shape, from: point(shape.from), to: point(shape.to), strokeWidth: shape.strokeWidth === undefined ? undefined : shape.strokeWidth * scale };
    return { ...shape, point: point(shape.point), fontSize: shape.fontSize * scale, strokeWidth: shape.strokeWidth === undefined ? undefined : shape.strokeWidth * scale };
  });
}
