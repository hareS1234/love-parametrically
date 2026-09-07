import { z } from 'zod';

export const SPECIES = ['cosmos', 'wild-rose', 'chamomile'] as const;
export const PALETTES = ['rose-letter', 'late-summer', 'ink-garden'] as const;

export type Species = (typeof SPECIES)[number];
export type Palette = (typeof PALETTES)[number];
export type Vec2 = readonly [number, number];

export interface FlowerV1 {
  id: string;
  seed: number;
  species: Species;
  stem: readonly [Vec2, Vec2, Vec2, Vec2];
  bloomRotation: number;
  bloomAspect: number;
  sizeMultiplier: number;
  order: number;
}

export interface BouquetV1 {
  format: 'love-parametrically';
  schemaVersion: 1;
  geometryVersion: 'botanical-v1';
  randomVersion: 'mulberry32-v1';
  id: string;
  createdAt: string;
  palette: Palette;
  flowers: FlowerV1[];
  dedication: {
    to: string;
    from: string;
    note: string;
    displayDate: string | null;
  };
}

const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
const finite = z.number().finite();
const vec2 = z.tuple([finite, finite]);
const codePoints = (maximum: number) => (value: string) => [...value].length <= maximum;
const isoInstant = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const calendarDatePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const calendarDate = (value: string) => calendarDatePattern.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const flowerBase = z.object({
  id: z.string().regex(idPattern),
  seed: z.number().int().min(0).max(0xffffffff),
  species: z.enum(SPECIES),
  stem: z.tuple([vec2, vec2, vec2, vec2]),
  bloomRotation: finite.min(-Math.PI).max(Math.PI),
  bloomAspect: finite,
  sizeMultiplier: finite.min(0.75).max(1.25),
  order: z.number().int().min(0).max(6),
}).strict();

const dedicationSchema = z.object({
  to: z.string().transform((s) => s.trim()).refine(codePoints(48), 'To must be 48 characters or fewer.'),
  from: z.string().transform((s) => s.trim()).refine(codePoints(48), 'From must be 48 characters or fewer.'),
  note: z.string().transform((s) => s.trim()).refine(codePoints(160), 'The note must be 160 characters or fewer.'),
  displayDate: z.union([z.string().refine(calendarDate, 'Display date must be a real calendar date.'), z.null()]),
}).strict();

const bouquetBase = z.object({
  format: z.literal('love-parametrically'),
  schemaVersion: z.literal(1),
  geometryVersion: z.literal('botanical-v1'),
  randomVersion: z.literal('mulberry32-v1'),
  id: z.string().regex(idPattern),
  createdAt: z.string().refine(isoInstant, 'createdAt must be an ISO instant.'),
  palette: z.enum(PALETTES),
  flowers: z.array(flowerBase).min(1).max(7),
  dedication: dedicationSchema,
}).strict();

const validateBouquetRelations = (recipe: z.infer<typeof bouquetBase>, ctx: z.RefinementCtx) => {
  const ids = new Set<string>();
  const orders = new Set<number>();
  recipe.flowers.forEach((flower, index) => {
    if (ids.has(flower.id)) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'id'], message: 'Flower IDs must be unique.' });
    if (orders.has(flower.order)) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'order'], message: 'Flower order values must be unique.' });
    ids.add(flower.id);
    orders.add(flower.order);

    const [p0, p1, p2, p3] = flower.stem;
    if (p0[0] !== 512 || p0[1] !== 640) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'stem', 0], message: 'Stem root must be [512,640].' });
    if (!(p0[1] > p1[1] && p1[1] > p2[1] && p2[1] > p3[1])) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'stem'], message: 'Stem y coordinates must be strictly monotone.' });
    if (p3[0] < 170 || p3[0] > 854 || p3[1] < 130 || p3[1] > 510) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'stem', 3], message: 'Blossom center is outside the arrangement bounds.' });
    for (const [pointIndex, point] of flower.stem.entries()) {
      if (point[0] < 170 || point[0] > 854 || point[1] < 130 || point[1] > 640) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'stem', pointIndex], message: 'Stem control point is outside the documented bounds.' });
    }

    const [minAspect, maxAspect] = flower.species === 'cosmos' ? [0.84, 1] : flower.species === 'wild-rose' ? [0.88, 1] : [0.82, 0.96];
    if (flower.bloomAspect < minAspect || flower.bloomAspect > maxAspect) ctx.addIssue({ code: 'custom', path: ['flowers', index, 'bloomAspect'], message: `Aspect must be between ${minAspect} and ${maxAspect} for ${flower.species}.` });
  });
  if (orders.size === recipe.flowers.length && [...orders].some((order) => order >= recipe.flowers.length)) {
    ctx.addIssue({ code: 'custom', path: ['flowers'], message: 'Flower order values must run from zero to flower count minus one.' });
  }
};

export const bouquetSchema = bouquetBase.superRefine(validateBouquetRelations);
export const draftSchema = bouquetBase.extend({ flowers: z.array(flowerBase).max(7) }).strict().superRefine(validateBouquetRelations);

export function parseBouquet(value: unknown): BouquetV1 {
  return bouquetSchema.parse(value) as BouquetV1;
}

export function parseDraft(value: unknown): BouquetV1 {
  return draftSchema.parse(value) as BouquetV1;
}

export function createEmptyBouquet(id = createId('bouquet')): BouquetV1 {
  return {
    format: 'love-parametrically',
    schemaVersion: 1,
    geometryVersion: 'botanical-v1',
    randomVersion: 'mulberry32-v1',
    id,
    createdAt: new Date().toISOString(),
    palette: 'rose-letter',
    flowers: [],
    dedication: { to: '', from: '', note: '', displayDate: null },
  };
}

export function createId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
