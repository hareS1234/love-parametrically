import type { Vec2 } from '../data/schema';

export interface NormalizedLandmark { x: number; y: number; z?: number }
export const ACTIVE_REGION = { left: 0.12, right: 0.88, top: 0.1, bottom: 0.9 } as const;

export function activeRegionSourceRect(width: number, height: number, region = ACTIVE_REGION) {
  return {
    x: (1 - region.right) * width,
    y: region.top * height,
    width: (region.right - region.left) * width,
    height: (region.bottom - region.top) * height,
  };
}

export function rawToStage(landmark: NormalizedLandmark, region = ACTIVE_REGION): Vec2 {
  const mirroredX = 1 - landmark.x;
  return [1024 * (mirroredX - region.left) / (region.right - region.left), 768 * (landmark.y - region.top) / (region.bottom - region.top)];
}

export function imagePoint(landmark: NormalizedLandmark, width: number, height: number): Vec2 {
  return [landmark.x * width, landmark.y * height];
}

export function clientToStage(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Vec2 {
  const scale = Math.min(rect.width / 1024, rect.height / 768);
  const offsetX = (rect.width - 1024 * scale) / 2;
  const offsetY = (rect.height - 768 * scale) / 2;
  return [(clientX - rect.left - offsetX) / scale, (clientY - rect.top - offsetY) / scale];
}

export function pointInActiveRegion(point: Vec2): boolean {
  return point[0] >= 0 && point[0] <= 1024 && point[1] >= 0 && point[1] <= 768;
}
