import type { FlowerV1, Species, Vec2 } from '../data/schema';
import { randomStream } from './random';
import { cubicPoint, cubicTangent } from './stem';
import type { PathCommand, SceneShape } from './types';

export interface PaletteColors {
  petals: readonly [string, string, string];
  accent: string;
  stem: string;
}

export const paletteColors = {
  'rose-letter': { petals: ['#ebc2c5', '#c98799', '#f5dede'], accent: '#7b293e', stem: '#536249' },
  'late-summer': { petals: ['#f2d6a2', '#d5a2a5', '#f5e8ca'], accent: '#ad6d3a', stem: '#66714f' },
  'ink-garden': { petals: ['#faf5eb', '#e5ded0', '#f0e6d8'], accent: '#4a3934', stem: '#625f4b' },
} as const satisfies Record<string, PaletteColors>;

export const speciesPreset = {
  cosmos: { petals: 8, radius: [52, 76], aspect: [0.84, 1], leaves: 2, centerDots: [26, 40], width: 0.42 },
  'wild-rose': { petals: 5, radius: [46, 66], aspect: [0.88, 1], leaves: 3, centerDots: [18, 28], width: 0.56 },
  chamomile: { petals: 18, radius: [34, 48], aspect: [0.82, 0.96], leaves: 2, centerDots: [35, 55], width: 0.25 },
} as const;

const lerp = (a: number, b: number, q: number) => a + (b - a) * q;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function rotate(point: Vec2, angle: number, center: Vec2): Vec2 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [center[0] + point[0] * cosine - point[1] * sine, center[1] + point[0] * sine + point[1] * cosine];
}

export function blossomConstruction(flower: FlowerV1): { axes: Array<{ from: Vec2; to: Vec2 }>; representative: { base: Vec2; c1: Vec2; c2: Vec2; shoulder: Vec2 } } {
  const preset = speciesPreset[flower.species];
  const radius = blossomRadius(flower);
  const random = randomStream(flower.seed, 'petals');
  const axes: Array<{ from: Vec2; to: Vec2 }> = [];
  let representative: { base: Vec2; c1: Vec2; c2: Vec2; shoulder: Vec2 } | null = null;
  for (let index = 0; index < preset.petals; index += 1) {
    const angle = (Math.PI * 2 * index) / preset.petals + flower.bloomRotation + (random() - 0.5) * 0.11;
    const length = radius * lerp(0.93, 1.07, random());
    const width = radius * preset.width * flower.bloomAspect * lerp(0.94, 1.06, random());
    random(); random();
    axes.push({ from: flower.stem[3], to: rotate([0, -length], angle, flower.stem[3]) });
    if (!representative) representative = { base: flower.stem[3], c1: rotate([-0.7 * width, -0.2 * length], angle, flower.stem[3]), c2: rotate([-1.05 * width, -0.74 * length], angle, flower.stem[3]), shoulder: rotate([-0.35 * width, -0.94 * length], angle, flower.stem[3]) };
  }
  return { axes, representative: representative! };
}

function petalCommands(center: Vec2, angle: number, length: number, halfWidth: number, species: Species): PathCommand[] {
  const tipInset = species === 'cosmos' ? 0.9 : species === 'wild-rose' ? 0.96 : 1;
  const local = (x: number, y: number) => rotate([x, -y], angle, center);
  const commands: PathCommand[] = [
    { op: 'M', point: local(0, 0) },
    { op: 'C', c1: local(-0.7 * halfWidth, 0.2 * length), c2: local(-1.05 * halfWidth, 0.74 * length), point: local(-0.35 * halfWidth, 0.94 * length) },
  ];
  if (species === 'cosmos') {
    commands.push(
      { op: 'C', c1: local(-0.19 * halfWidth, 0.99 * length), c2: local(-0.1 * halfWidth, 1.01 * length), point: local(0, tipInset * length) },
      { op: 'C', c1: local(0.1 * halfWidth, 1.01 * length), c2: local(0.19 * halfWidth, 0.99 * length), point: local(0.35 * halfWidth, 0.94 * length) },
    );
  } else {
    commands.push({ op: 'C', c1: local(-0.1 * halfWidth, 1.03 * length), c2: local(0.1 * halfWidth, 1.03 * length), point: local(0.35 * halfWidth, 0.94 * length) });
  }
  commands.push(
    { op: 'C', c1: local(1.05 * halfWidth, 0.74 * length), c2: local(0.7 * halfWidth, 0.2 * length), point: local(0, 0) },
    { op: 'Z' },
  );
  return commands;
}

function vein(center: Vec2, angle: number, length: number): PathCommand[] {
  return [
    { op: 'M', point: rotate([0, -4], angle, center) },
    { op: 'C', c1: rotate([-1.5, -length * 0.28], angle, center), c2: rotate([1.5, -length * 0.52], angle, center), point: rotate([0, -length * 0.77], angle, center) },
  ];
}

function leafCommands(center: Vec2, angle: number, length: number, width: number): PathCommand[] {
  const local = (x: number, y: number) => rotate([x, -y], angle, center);
  return [
    { op: 'M', point: local(0, 0) },
    { op: 'C', c1: local(-width, length * 0.22), c2: local(-width * 0.72, length * 0.8), point: local(0, length) },
    { op: 'C', c1: local(width * 0.72, length * 0.8), c2: local(width, length * 0.22), point: local(0, 0) },
    { op: 'Z' },
  ];
}

export function blossomRadius(flower: FlowerV1): number {
  const preset = speciesPreset[flower.species];
  const height = 640 - flower.stem[3][1];
  return lerp(preset.radius[0], preset.radius[1], clamp((height - 120) / 310, 0, 1)) * flower.sizeMultiplier;
}

export function buildFlowerShapes(flower: FlowerV1, palette: PaletteColors): SceneShape[] {
  const shapes: SceneShape[] = [];
  const role = `flower:${flower.id}`;
  const stemCommands: PathCommand[] = [
    { op: 'M', point: flower.stem[0] },
    { op: 'C', c1: flower.stem[1], c2: flower.stem[2], point: flower.stem[3] },
  ];
  shapes.push({ kind: 'path', commands: stemCommands, fill: 'none', stroke: palette.stem, strokeWidth: 2.2, lineCap: 'round', role: `${role}:stem` });
  shapes.push({ kind: 'path', commands: stemCommands, fill: 'none', stroke: '#aab19d', strokeWidth: 0.7, opacity: 0.72, role: `${role}:stem-highlight` });

  const leafRandom = randomStream(flower.seed, 'leaves');
  const leafTs = flower.species === 'wild-rose' ? [0.3, 0.44, 0.57] : [0.3, 0.57];
  leafTs.forEach((baseT, index) => {
    const t = clamp(baseT + (leafRandom() - 0.5) * 0.035, 0.2, 0.7);
    const point = cubicPoint(flower.stem, t);
    const tangent = cubicTangent(flower.stem, t);
    const stemAngle = Math.atan2(tangent[1], tangent[0]);
    const side = index % 2 === 0 ? -1 : 1;
    const angle = stemAngle + side * lerp(0.62, 1.04, leafRandom());
    const familyScale = flower.species === 'chamomile' ? 0.72 : flower.species === 'wild-rose' ? 1.05 : 0.9;
    const length = lerp(38, 70, leafRandom()) * familyScale * flower.sizeMultiplier;
    const width = lerp(11, 23, leafRandom()) * familyScale;
    shapes.push({ kind: 'path', commands: leafCommands(point, angle, length, width), fill: palette.stem, stroke: '#3f4b38', strokeWidth: 0.85, opacity: 0.84, role: `${role}:leaf:${index}` });
    shapes.push({ kind: 'line', from: point, to: rotate([0, -length * 0.85], angle, point), stroke: '#dfe2d4', strokeWidth: 0.65, opacity: 0.62, role: `${role}:leaf-vein:${index}` });
  });

  const center = flower.stem[3];
  const radius = blossomRadius(flower);
  const preset = speciesPreset[flower.species];
  const petalRandom = randomStream(flower.seed, 'petals');
  for (let index = 0; index < preset.petals; index += 1) {
    const angle = (Math.PI * 2 * index) / preset.petals + flower.bloomRotation + (petalRandom() - 0.5) * 0.11;
    const length = radius * lerp(0.93, 1.07, petalRandom());
    const width = radius * preset.width * flower.bloomAspect * lerp(0.94, 1.06, petalRandom());
    const fill = palette.petals[Math.floor(petalRandom() * palette.petals.length) % palette.petals.length];
    shapes.push({ kind: 'path', commands: petalCommands(center, angle, length, width, flower.species), fill, stroke: palette.accent, strokeWidth: 0.9 + petalRandom() * 0.2, opacity: flower.species === 'chamomile' ? 0.94 : 0.83, lineJoin: 'round', role: `${role}:petal:${index}` });
    shapes.push({ kind: 'path', commands: vein(center, angle, length), fill: 'none', stroke: palette.accent, strokeWidth: 0.6, opacity: 0.3, role: `${role}:petal-vein:${index}` });
  }

  const pollenRandom = randomStream(flower.seed, 'pollen');
  const dotCount = Math.round(lerp(preset.centerDots[0], preset.centerDots[1], pollenRandom()));
  const centerRadius = radius * (flower.species === 'chamomile' ? 0.37 : 0.25);
  const phi = Math.PI * (3 - Math.sqrt(5));
  const seededRotation = pollenRandom() * Math.PI * 2;
  shapes.push({ kind: 'circle', center, radius: centerRadius * 1.08, fill: flower.species === 'chamomile' ? '#d8a44c' : '#f0c778', stroke: palette.accent, strokeWidth: 0.8, role: `${role}:center` });
  for (let index = 0; index < dotCount; index += 1) {
    const r = centerRadius * Math.sqrt((index + 0.5) / dotCount);
    const angle = index * phi + seededRotation;
    shapes.push({ kind: 'circle', center: [center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r], radius: lerp(1.05, 2.2, pollenRandom()), fill: index % 3 === 0 ? palette.accent : '#bb8b42', opacity: 0.92, role: `${role}:pollen:${index}` });
  }
  if (flower.species === 'wild-rose') {
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + seededRotation;
      shapes.push({ kind: 'line', from: [center[0] + Math.cos(angle) * centerRadius * 0.5, center[1] + Math.sin(angle) * centerRadius * 0.5], to: [center[0] + Math.cos(angle) * centerRadius * 1.35, center[1] + Math.sin(angle) * centerRadius * 1.35], stroke: palette.accent, strokeWidth: 0.7, opacity: 0.7, role: `${role}:stamen:${index}` });
    }
  }
  return shapes;
}
