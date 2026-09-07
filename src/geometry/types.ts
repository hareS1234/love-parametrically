import type { Vec2 } from '../data/schema';

export type PathCommand =
  | { op: 'M' | 'L'; point: Vec2 }
  | { op: 'C'; c1: Vec2; c2: Vec2; point: Vec2 }
  | { op: 'Z' };

interface Paint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: readonly number[];
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'bevel' | 'miter';
  role?: string;
}

export type SceneShape =
  | (Paint & { kind: 'path'; commands: PathCommand[] })
  | (Paint & { kind: 'circle'; center: Vec2; radius: number })
  | (Paint & { kind: 'ellipse'; center: Vec2; rx: number; ry: number; rotation?: number })
  | (Paint & { kind: 'line'; from: Vec2; to: Vec2 })
  | (Paint & { kind: 'text'; point: Vec2; text: string; fontSize: number; fontFamily?: 'serif' | 'sans' | 'mono'; align?: 'left' | 'center' | 'right'; italic?: boolean });

export interface Scene {
  width: number;
  height: number;
  shapes: SceneShape[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PrintScene extends Scene {
  background: string;
}

export function n(value: number): string {
  const normalized = Math.abs(value) < 0.00005 ? 0 : Math.round(value * 10_000) / 10_000;
  return normalized.toFixed(4);
}

export function pathToString(commands: PathCommand[]): string {
  return commands.map((command) => {
    if (command.op === 'Z') return 'Z';
    if (command.op === 'C') return `C ${n(command.c1[0])} ${n(command.c1[1])} ${n(command.c2[0])} ${n(command.c2[1])} ${n(command.point[0])} ${n(command.point[1])}`;
    return `${command.op} ${n(command.point[0])} ${n(command.point[1])}`;
  }).join(' ');
}
