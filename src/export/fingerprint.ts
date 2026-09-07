import type { BouquetV1 } from '../data/schema';

const canonicalNumber = (value: number) => (Math.round(value * 10_000) / 10_000).toFixed(4);

export function canonicalRenderingPayload(recipe: BouquetV1): string {
  return JSON.stringify({
    geometryVersion: recipe.geometryVersion,
    randomVersion: recipe.randomVersion,
    palette: recipe.palette,
    flowers: [...recipe.flowers].sort((a, b) => a.order - b.order).map((flower) => ({
      seed: flower.seed >>> 0, species: flower.species,
      stem: flower.stem.map((point) => point.map(canonicalNumber)),
      bloomRotation: canonicalNumber(flower.bloomRotation), bloomAspect: canonicalNumber(flower.bloomAspect), sizeMultiplier: canonicalNumber(flower.sizeMultiplier), order: flower.order,
    })),
  });
}

export async function recipeFingerprint(recipe: BouquetV1): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRenderingPayload(recipe)));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
