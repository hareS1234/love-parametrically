import type { PrintScene, SceneShape } from '../geometry/types';
import { n, pathToString } from '../geometry/types';

const escapeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));

function paint(shape: SceneShape): string {
  const values: string[] = [];
  if (shape.fill !== undefined) values.push(`fill="${escapeText(shape.fill)}"`); else if (shape.kind !== 'text') values.push('fill="none"');
  if (shape.stroke !== undefined) values.push(`stroke="${escapeText(shape.stroke)}"`);
  if (shape.strokeWidth !== undefined) values.push(`stroke-width="${n(shape.strokeWidth)}"`);
  if (shape.opacity !== undefined) values.push(`opacity="${n(shape.opacity)}"`);
  if (shape.dash) values.push(`stroke-dasharray="${shape.dash.map(n).join(' ')}"`);
  if (shape.lineCap) values.push(`stroke-linecap="${shape.lineCap}"`);
  if (shape.lineJoin) values.push(`stroke-linejoin="${shape.lineJoin}"`);
  return values.join(' ');
}

function serializeShape(shape: SceneShape): string {
  const attributes = paint(shape);
  if (shape.kind === 'path') return `<path d="${pathToString(shape.commands)}" ${attributes}/>`;
  if (shape.kind === 'circle') return `<circle cx="${n(shape.center[0])}" cy="${n(shape.center[1])}" r="${n(shape.radius)}" ${attributes}/>`;
  if (shape.kind === 'ellipse') return `<ellipse cx="${n(shape.center[0])}" cy="${n(shape.center[1])}" rx="${n(shape.rx)}" ry="${n(shape.ry)}"${shape.rotation ? ` transform="rotate(${n(shape.rotation * 180 / Math.PI)} ${n(shape.center[0])} ${n(shape.center[1])})"` : ''} ${attributes}/>`;
  if (shape.kind === 'line') return `<line x1="${n(shape.from[0])}" y1="${n(shape.from[1])}" x2="${n(shape.to[0])}" y2="${n(shape.to[1])}" ${attributes}/>`;
  const family = shape.fontFamily === 'mono' ? 'ui-monospace,monospace' : shape.fontFamily === 'sans' ? 'system-ui,sans-serif' : 'Newsreader,Georgia,serif';
  return `<text x="${n(shape.point[0])}" y="${n(shape.point[1])}" font-size="${n(shape.fontSize)}" font-family="${family}" text-anchor="${shape.align === 'center' ? 'middle' : shape.align === 'right' ? 'end' : 'start'}"${shape.italic ? ' font-style="italic"' : ''} ${attributes}>${escapeText(shape.text)}</text>`;
}

export function serializeSvg(scene: PrintScene): string {
  const body = scene.shapes.map(serializeShape).join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">\n  <rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/>\n  ${body}\n</svg>\n`;
}
