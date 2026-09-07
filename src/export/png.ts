import type { PrintScene, SceneShape } from '../geometry/types';

function pathOnContext(context: CanvasRenderingContext2D, shape: Extract<SceneShape, { kind: 'path' }>) {
  context.beginPath();
  for (const command of shape.commands) {
    if (command.op === 'M') context.moveTo(...command.point);
    else if (command.op === 'L') context.lineTo(...command.point);
    else if (command.op === 'C') context.bezierCurveTo(...command.c1, ...command.c2, ...command.point);
    else context.closePath();
  }
}

function applyPaint(context: CanvasRenderingContext2D, shape: SceneShape) {
  context.globalAlpha = shape.opacity ?? 1;
  context.fillStyle = shape.fill ?? 'transparent';
  context.strokeStyle = shape.stroke ?? 'transparent';
  context.lineWidth = shape.strokeWidth ?? 1;
  context.lineCap = shape.lineCap ?? 'butt';
  context.lineJoin = shape.lineJoin ?? 'miter';
  context.setLineDash(shape.dash ? [...shape.dash] : []);
}

export function drawPrint(context: CanvasRenderingContext2D, scene: PrintScene): void {
  context.save();
  context.fillStyle = scene.background;
  context.fillRect(0, 0, scene.width, scene.height);
  for (const shape of scene.shapes) {
    context.save(); applyPaint(context, shape);
    if (shape.kind === 'path') { pathOnContext(context, shape); if (shape.fill && shape.fill !== 'none') context.fill(); if (shape.stroke) context.stroke(); }
    else if (shape.kind === 'circle') { context.beginPath(); context.arc(...shape.center, shape.radius, 0, Math.PI * 2); if (shape.fill) context.fill(); if (shape.stroke) context.stroke(); }
    else if (shape.kind === 'ellipse') { context.beginPath(); context.ellipse(...shape.center, shape.rx, shape.ry, shape.rotation ?? 0, 0, Math.PI * 2); if (shape.fill) context.fill(); if (shape.stroke) context.stroke(); }
    else if (shape.kind === 'line') { context.beginPath(); context.moveTo(...shape.from); context.lineTo(...shape.to); context.stroke(); }
    else {
      context.font = `${shape.italic ? 'italic ' : ''}${shape.fontSize}px ${shape.fontFamily === 'mono' ? 'ui-monospace, monospace' : shape.fontFamily === 'sans' ? 'system-ui, sans-serif' : 'Newsreader, Georgia, serif'}`;
      context.textAlign = shape.align === 'center' ? 'center' : shape.align === 'right' ? 'right' : 'left';
      context.textBaseline = 'alphabetic';
      context.fillText(shape.text, ...shape.point);
    }
    context.restore();
  }
  context.restore();
}

export async function renderPng(scene: PrintScene): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 2400; canvas.height = 3000;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  context.scale(3, 3);
  drawPrint(context, scene);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
}

export async function renderThumbnail(scene: PrintScene): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 300;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable.');
  context.scale(0.3, 0.3); drawPrint(context, scene);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Thumbnail creation failed.')), 'image/png'));
}
