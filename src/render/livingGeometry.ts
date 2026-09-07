import type { Vec2 } from '../data/schema';
import type { NormalizedLandmark } from '../input/coordinates';
import { rawToStage } from '../input/coordinates';
import type { SceneShape } from '../geometry/types';

export type GeometryView = 'studio' | 'expanded' | 'clean';
export const HAND_CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]] as const;

export interface LivingHand {
  id: string;
  landmarks: NormalizedLandmark[];
  ratio: number;
  ageMs: number;
  captured: boolean;
  paused?: boolean;
}

export function buildHandShapes(hands: LivingHand[], expanded: boolean): SceneShape[] {
  const shapes: SceneShape[] = [];
  for (const hand of hands) {
    const mapped = hand.landmarks.map((landmark) => rawToStage(landmark));
    for (const chain of HAND_CHAINS) for (let index = 1; index < chain.length; index += 1) {
      shapes.push({ kind: 'line', from: mapped[chain[index - 1]], to: mapped[chain[index]], stroke: '#7b293e', strokeWidth: 1.25, opacity: hand.paused ? 0.14 : 0.32, role: 'estimated-hand' });
    }
    mapped.forEach((point, index) => {
      shapes.push({ kind: 'circle', center: point, radius: index === 4 || index === 8 ? 6 : 4, fill: '#f6f1e7', stroke: '#7b293e', strokeWidth: 1.1, opacity: hand.paused ? 0.22 : index === 4 || index === 8 ? 0.85 : 0.55, role: 'estimated-hand' });
      if (expanded) shapes.push({ kind: 'text', point: labelPoint(point, index, mapped[8]), text: String(index), fontSize: 10, fontFamily: 'mono', fill: '#7b293e', opacity: 0.76, role: 'estimated-hand' });
    });
    const thumb = mapped[4]; const index = mapped[8];
    const midpoint: Vec2 = [(thumb[0] + index[0]) / 2, (thumb[1] + index[1]) / 2];
    shapes.push({ kind: 'line', from: thumb, to: index, stroke: '#7b293e', strokeWidth: 2, opacity: hand.paused ? 0.2 : 0.85, role: 'pinch' });
    shapes.push({ kind: 'circle', center: midpoint, radius: hand.captured ? 13 : 8, fill: 'none', stroke: '#7b293e', strokeWidth: 1.7, opacity: 0.85, role: 'pinch' });
    shapes.push({ kind: 'text', point: [midpoint[0] + 16, midpoint[1] - 12], text: hand.paused ? 'Tracking paused' : 'Pinch', fontSize: 12, fontFamily: 'mono', fill: '#7b293e', role: 'pinch' });
  }
  return shapes;
}

function labelPoint(point: Vec2, index: number, bloom: Vec2): Vec2 {
  const awayX = point[0] < bloom[0] ? -14 : 8;
  const awayY = index % 2 === 0 ? -7 : 12;
  return [point[0] + awayX, point[1] + awayY];
}
