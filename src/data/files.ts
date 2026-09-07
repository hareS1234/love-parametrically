import type { BouquetV1 } from './schema';
import { parseBouquet } from './schema';

export const MAX_RECIPE_BYTES = 64 * 1024;

function compatibilityMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  if (object.format !== 'love-parametrically') return 'This file belongs to another app.';
  if (object.schemaVersion !== 1) return `This bouquet uses unsupported schema version ${String(object.schemaVersion)}.`;
  if (object.geometryVersion !== 'botanical-v1') return `This bouquet needs unsupported geometry version ${String(object.geometryVersion)}.`;
  if (object.randomVersion !== 'mulberry32-v1') return `This bouquet needs unsupported random version ${String(object.randomVersion)}.`;
  return null;
}

export async function readBouquetFile(file: Blob): Promise<BouquetV1> {
  if (file.size > MAX_RECIPE_BYTES) throw new Error('This bouquet file is larger than the 64 KiB limit.');
  let value: unknown;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error('This bouquet file contains invalid JSON.'); }
  const compatibility = compatibilityMessage(value);
  if (compatibility) throw new Error(compatibility);
  const result = parseBouquet(value);
  return structuredClone(result);
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export function serializeRecipe(recipe: BouquetV1): string {
  const validated = parseBouquet(recipe);
  const portable: BouquetV1 = {
    format: validated.format,
    schemaVersion: validated.schemaVersion,
    geometryVersion: validated.geometryVersion,
    randomVersion: validated.randomVersion,
    id: validated.id,
    createdAt: validated.createdAt,
    palette: validated.palette,
    flowers: [...validated.flowers].sort((a, b) => a.order - b.order).map((flower) => ({ ...flower, stem: flower.stem.map((point) => point.map(round) as unknown as readonly [number, number]) as unknown as BouquetV1['flowers'][number]['stem'], bloomRotation: round(flower.bloomRotation), bloomAspect: round(flower.bloomAspect), sizeMultiplier: round(flower.sizeMultiplier) })),
    dedication: { ...validated.dedication },
  };
  return `${JSON.stringify(portable, null, 2)}\n`;
}

export function safeFilename(date: string, extension: string, name?: string): string {
  const normalizedName = name?.normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  return `bouquet-${date}${normalizedName ? `-${normalizedName}` : ''}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
