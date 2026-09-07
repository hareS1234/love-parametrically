import type { Vec2 } from '../data/schema';

export type InputMode = 'mouse' | 'hands' | 'keyboard';

export type SceneInputEvent =
  | { type: 'hover'; ownerId: string; point: Vec2; timeMs: number }
  | { type: 'press'; ownerId: string; point: Vec2; timeMs: number }
  | { type: 'move'; ownerId: string; point: Vec2; timeMs: number }
  | { type: 'release'; ownerId: string; point: Vec2; timeMs: number }
  | { type: 'suspend'; ownerId: string; timeMs: number }
  | { type: 'cancel'; ownerId: string; reason: string; timeMs: number };

export interface SceneControllerContract {
  handle(event: SceneInputEvent): void;
  cancelActive(reason: string): void;
}
