import type { Scene, SceneShape } from '../geometry/types';
import { n, pathToString } from '../geometry/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function setPaint(element: SVGElement, shape: SceneShape): void {
  if (shape.fill !== undefined) element.setAttribute('fill', shape.fill);
  else if (shape.kind !== 'text') element.setAttribute('fill', 'none');
  if (shape.stroke !== undefined) element.setAttribute('stroke', shape.stroke);
  if (shape.strokeWidth !== undefined) element.setAttribute('stroke-width', n(shape.strokeWidth));
  if (shape.opacity !== undefined) element.setAttribute('opacity', n(shape.opacity));
  if (shape.dash) element.setAttribute('stroke-dasharray', shape.dash.map(n).join(' '));
  if (shape.lineCap) element.setAttribute('stroke-linecap', shape.lineCap);
  if (shape.lineJoin) element.setAttribute('stroke-linejoin', shape.lineJoin);
  if (shape.role) element.setAttribute('data-role', shape.role);
  element.setAttribute('vector-effect', 'non-scaling-stroke');
}

function createShape(shape: SceneShape, existingRoles: Set<string>, flowerOrder: number, flowerCount: number): SVGElement {
  let element: SVGElement;
  if (shape.kind === 'path') {
    element = document.createElementNS(SVG_NS, 'path');
    element.setAttribute('d', pathToString(shape.commands));
  } else if (shape.kind === 'circle') {
    element = document.createElementNS(SVG_NS, 'circle');
    element.setAttribute('cx', n(shape.center[0])); element.setAttribute('cy', n(shape.center[1])); element.setAttribute('r', n(shape.radius));
  } else if (shape.kind === 'ellipse') {
    element = document.createElementNS(SVG_NS, 'ellipse');
    element.setAttribute('cx', n(shape.center[0])); element.setAttribute('cy', n(shape.center[1])); element.setAttribute('rx', n(shape.rx)); element.setAttribute('ry', n(shape.ry));
    if (shape.rotation) element.setAttribute('transform', `rotate(${n(shape.rotation * 180 / Math.PI)} ${n(shape.center[0])} ${n(shape.center[1])})`);
  } else if (shape.kind === 'line') {
    element = document.createElementNS(SVG_NS, 'line');
    element.setAttribute('x1', n(shape.from[0])); element.setAttribute('y1', n(shape.from[1])); element.setAttribute('x2', n(shape.to[0])); element.setAttribute('y2', n(shape.to[1]));
  } else {
    element = document.createElementNS(SVG_NS, 'text');
    element.setAttribute('x', n(shape.point[0])); element.setAttribute('y', n(shape.point[1]));
    element.setAttribute('font-size', n(shape.fontSize));
    element.setAttribute('font-family', shape.fontFamily === 'mono' ? 'ui-monospace, monospace' : shape.fontFamily === 'sans' ? 'system-ui, sans-serif' : 'Newsreader, Georgia, serif');
    element.setAttribute('text-anchor', shape.align === 'center' ? 'middle' : shape.align === 'right' ? 'end' : 'start');
    if (shape.italic) element.setAttribute('font-style', 'italic');
    element.textContent = shape.text;
  }
  setPaint(element, shape);
  if (shape.role?.startsWith('flower:')) {
    const revealDelay = flowerCount > 1 ? flowerOrder * (400 / (flowerCount - 1)) : 0;
    const revealDuration = flowerCount > 1 ? 800 : 1200;
    element.style.setProperty('--flower-reveal-delay', `${n(revealDelay)}ms`);
    element.style.setProperty('--flower-reveal-duration', `${revealDuration}ms`);
  }
  if (shape.role?.startsWith('flower:') && !existingRoles.has(shape.role)) {
    element.classList.add('shape-entering');
    const petalIndex = shape.role.match(/:petal:(\d+)$/)?.[1];
    if (petalIndex) element.style.setProperty('--petal-enter-delay', `${Math.min(230, Number(petalIndex) * 18)}ms`);
  }
  return element;
}

export function renderScene(svg: SVGSVGElement, scene: Scene): void {
  svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const existingRoles = new Set([...svg.querySelectorAll('[data-role]')].map((element) => element.getAttribute('data-role') ?? ''));
  const flowerOrders = new Map<string, number>();
  scene.shapes.forEach((shape) => {
    const flowerId = shape.role?.match(/^flower:([^:]+)/)?.[1];
    if (flowerId && !flowerOrders.has(flowerId)) flowerOrders.set(flowerId, flowerOrders.size);
  });
  const fragment = document.createDocumentFragment();
  scene.shapes.forEach((shape) => {
    const flowerId = shape.role?.match(/^flower:([^:]+)/)?.[1];
    fragment.append(createShape(shape, existingRoles, flowerId ? flowerOrders.get(flowerId)! : 0, flowerOrders.size));
  });
  svg.replaceChildren(fragment);
}
