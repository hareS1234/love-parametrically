import type { BouquetV1 } from '../data/schema';
import type { PrintScene, Scene } from '../geometry/types';
import { transformScene } from '../geometry/scene';

export type Measure = (text: string, fontSize: number, fontFamily: 'serif' | 'sans' | 'mono') => number;
const fallbackMeasure: Measure = (text, size, family) => [...text].length * size * (family === 'mono' ? 0.61 : family === 'serif' ? 0.48 : 0.53);

export function wrapWords(text: string, maxWidth: number, fontSize: number, measure: Measure = fallbackMeasure, maximumLines = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, fontSize, 'serif') <= maxWidth) current = candidate;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.slice(0, maximumLines);
}

export function noteFits(text: string, measure: Measure = fallbackMeasure): boolean {
  const lines = wrapWords(text, 688, 27, measure, 5);
  return lines.length <= 4
    && lines.every((line) => measure(line, 27, 'serif') <= 688)
    && lines.join(' ').length === text.trim().replace(/\s+/g, ' ').length;
}

export function createBrowserMeasure(): Measure {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return fallbackMeasure;
  return (text, fontSize, family) => {
    context.font = `${fontSize}px ${family === 'mono' ? 'ui-monospace, monospace' : family === 'sans' ? 'system-ui, sans-serif' : 'Newsreader, Georgia, serif'}`;
    return context.measureText(text).width;
  };
}

export function layoutPrint(recipe: BouquetV1, scene: Scene, measure: Measure = fallbackMeasure, fingerprint?: string): PrintScene {
  const region = { left: 90, top: 150, right: 710, bottom: 745 };
  const sceneWidth = Math.max(1, scene.bounds.maxX - scene.bounds.minX);
  const sceneHeight = Math.max(1, scene.bounds.maxY - scene.bounds.minY);
  const scale = Math.min((region.right - region.left) / sceneWidth, (region.bottom - region.top) / sceneHeight);
  const x = region.left + ((region.right - region.left) - sceneWidth * scale) / 2 - scene.bounds.minX * scale;
  const y = region.top + ((region.bottom - region.top) - sceneHeight * scale) / 2 - scene.bounds.minY * scale;
  const shapes = [
    { kind: 'text' as const, point: [56, 68] as const, text: 'Love, Parametrically', fontSize: 18, fontFamily: 'serif' as const, fill: '#7b293e' },
    { kind: 'text' as const, point: [744, 68] as const, text: `Arrangement / ${recipe.flowers.length} ${recipe.flowers.length === 1 ? 'flower' : 'flowers'}`, fontSize: 10, fontFamily: 'mono' as const, align: 'right' as const, fill: '#6d6258' },
    { kind: 'line' as const, from: [56, 86] as const, to: [744, 86] as const, stroke: '#d8cdbb', strokeWidth: 1 },
    ...transformScene(scene, scale, [x, y] as const),
  ];
  if (recipe.dedication.to) shapes.push({ kind: 'text' as const, point: [56, 825] as const, text: `For ${recipe.dedication.to}`, fontSize: 19, fontFamily: 'serif' as const, italic: true, fill: '#7b293e' });
  wrapWords(recipe.dedication.note, 688, 27, measure).forEach((line, index) => shapes.push({ kind: 'text' as const, point: [56, 858 + index * 31] as const, text: line, fontSize: 27, fontFamily: 'serif' as const, fill: '#322824' }));
  const signature = [recipe.dedication.from ? `From ${recipe.dedication.from}` : '', recipe.dedication.displayDate ?? ''].filter(Boolean).join(' · ');
  if (signature) shapes.push({ kind: 'text' as const, point: [744, 930] as const, text: signature, fontSize: 12, fontFamily: 'sans' as const, align: 'right' as const, fill: '#6d6258' });
  if (fingerprint) shapes.push({ kind: 'text' as const, point: [56, 957] as const, text: `botanical-v1 / ${fingerprint.slice(0, 12)}`, fontSize: 10, fontFamily: 'mono' as const, fill: '#6d6258' });
  return { width: 800, height: 1000, background: '#f6f1e7', shapes, bounds: { minX: 0, minY: 0, maxX: 800, maxY: 1000 } };
}
