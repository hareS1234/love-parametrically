import type { FlowerV1, Species, Vec2 } from '../data/schema';
import { createId, createSeed } from '../data/schema';
import { randomStream } from '../geometry/random';
import { blossomRadius } from '../geometry/species';
import { appendSample, fitStem, type PathSample } from '../geometry/stem';
import { speciesPreset } from '../geometry/species';
import type { SceneControllerContract, SceneInputEvent } from '../input/adapters';
import { shapeBloomFromDrag } from './bloomShape';

export type GrowthState = 'ready' | 'growing' | 'shaping' | 'suspended' | 'blooming';

export interface GrowthSnapshot {
  state: GrowthState;
  preview: FlowerV1 | null;
  instruction: string;
  ownerId: string | null;
  suspendedAt: number | null;
}

interface ControllerOptions {
  getSpecies: () => Species;
  getFlowerCount: () => number;
  commit: (flower: FlowerV1) => void;
  publish: (snapshot: GrowthSnapshot) => void;
  getFlowers?: () => readonly FlowerV1[];
  getSelectedId?: () => string | null;
  selectFlower?: (id: string | null) => void;
  previewMove?: (flower: FlowerV1 | null) => void;
  commitMove?: (flower: FlowerV1) => void;
}

const SEED_ZONE = { minX: 448, maxX: 576, minY: 570, maxY: 678 };
const inSeedZone = ([x, y]: Vec2) => x >= SEED_ZONE.minX && x <= SEED_ZONE.maxX && y >= SEED_ZONE.minY && y <= SEED_ZONE.maxY;

export class SceneController implements SceneControllerContract {
  private snapshot: GrowthSnapshot = { state: 'ready', preview: null, instruction: 'Start at the seed', ownerId: null, suspendedAt: null };
  private hoverEnteredAt: number | null = null;
  private c0: Vec2 | null = null;
  private samples: PathSample[] = [];
  private consumed = false;
  private bloomTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt: number | null = null;
  private durationHintShown = false;
  private moveCapture: { ownerId: string; flower: FlowerV1; start: Vec2; moved: boolean } | null = null;
  private shapeCapture: { origin: Vec2; base: FlowerV1; lastPoint: Vec2; moved: boolean } | null = null;
  private shapeRecoveryPoint: Vec2 | null = null;
  private suspendedFrom: 'growing' | 'shaping' | null = null;

  constructor(private options: ControllerOptions) {}

  getSnapshot(): GrowthSnapshot { return this.snapshot; }

  private publish(patch: Partial<GrowthSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.options.publish(this.snapshot);
  }

  handle(event: SceneInputEvent): void {
    if (event.type === 'cancel') { this.cancelActive(event.reason); return; }
    if (this.moveCapture) { this.handleMove(event); return; }
    if (this.tick(event.timeMs)) return;
    if (this.snapshot.state === 'ready') {
      if (event.type === 'hover') {
        if (inSeedZone(event.point)) this.hoverEnteredAt ??= event.timeMs;
        else this.hoverEnteredAt = null;
        return;
      }
      if (event.type === 'press') {
        const keyboard = event.ownerId === 'keyboard';
        if (this.options.getFlowerCount() < 7 && inSeedZone(event.point) && (keyboard || (this.hoverEnteredAt !== null && event.timeMs - this.hoverEnteredAt >= 120))) {
          this.begin(event.ownerId, event.point, event.timeMs);
          return;
        }
        this.beginFlowerEdit(event.ownerId, event.point);
      }
      return;
    }
    if (this.snapshot.state === 'suspended') {
      if (event.type === 'press' && this.snapshot.preview && this.suspendedFrom === 'growing' && Math.hypot(event.point[0] - this.snapshot.preview.stem[3][0], event.point[1] - this.snapshot.preview.stem[3][1]) <= 64) {
        this.c0 = [event.point[0] - (this.snapshot.preview.stem[3][0] - 512), event.point[1] - (this.snapshot.preview.stem[3][1] - 640)];
        this.samples = [{ point: event.point, timeMs: event.timeMs }];
        this.startedAt = event.timeMs; this.suspendedFrom = null;
        this.publish({ state: 'growing', ownerId: event.ownerId, instruction: 'Grow the stem', suspendedAt: null });
      } else if (event.type === 'press' && this.snapshot.preview && this.suspendedFrom === 'shaping' && this.shapeRecoveryPoint && Math.hypot(event.point[0] - this.shapeRecoveryPoint[0], event.point[1] - this.shapeRecoveryPoint[1]) <= 64) {
        this.shapeCapture = { origin: event.point, base: structuredClone(this.snapshot.preview), lastPoint: event.point, moved: false };
        this.shapeRecoveryPoint = event.point; this.startedAt = event.timeMs; this.suspendedFrom = null;
        this.publish({ state: 'shaping', ownerId: event.ownerId, instruction: 'Turn and open the petals', suspendedAt: null });
      }
      return;
    }
    if (this.snapshot.state === 'shaping') {
      this.handleBloomShape(event);
      return;
    }
    if (this.snapshot.state !== 'growing' || event.ownerId !== this.snapshot.ownerId || !this.c0) return;
    if (event.type === 'suspend') {
      this.suspendedFrom = 'growing';
      this.publish({ state: 'suspended', instruction: 'Bring your hand back', suspendedAt: event.timeMs });
      return;
    }
    if (event.type === 'move') this.update(event.point, event.timeMs);
    if (event.type === 'release') this.finishStem(event.point, event.timeMs);
  }

  begin(ownerId: string, point: Vec2, timeMs: number): void {
    const species = this.options.getSpecies();
    const seed = createSeed();
    const petalRandom = randomStream(seed, 'petals');
    const preset = speciesPreset[species];
    this.c0 = point;
    this.samples = [{ point, timeMs }];
    this.consumed = false;
    this.startedAt = timeMs;
    this.durationHintShown = false;
    this.shapeCapture = null; this.shapeRecoveryPoint = null; this.suspendedFrom = null;
    this.publish({
      state: 'growing', ownerId, instruction: 'Grow the stem', suspendedAt: null,
      preview: {
        id: createId('flower'), seed, species,
        stem: fitStem(this.samples, point, point),
        bloomRotation: -Math.PI + petalRandom() * Math.PI * 2,
        bloomAspect: preset.aspect[0] + petalRandom() * (preset.aspect[1] - preset.aspect[0]),
        sizeMultiplier: 1, order: this.options.getFlowerCount(),
      },
    });
  }

  private update(point: Vec2, timeMs: number): void {
    if (!this.snapshot.preview || !this.c0) return;
    this.samples = appendSample(this.samples, point, timeMs);
    this.publish({ preview: { ...this.snapshot.preview, stem: fitStem(this.samples, this.c0, point) }, instruction: this.durationHintShown ? 'Set the stem when ready' : 'Grow the stem' });
  }

  private beginFlowerEdit(ownerId: string, point: Vec2): void {
    const flowers = this.options.getFlowers?.() ?? [];
    const hit = [...flowers].reverse().find((flower) => Math.hypot(point[0] - flower.stem[3][0], point[1] - flower.stem[3][1]) <= blossomRadius(flower) + 12);
    if (!hit) { this.options.selectFlower?.(null); return; }
    if (this.options.getSelectedId?.() !== hit.id) { this.options.selectFlower?.(hit.id); return; }
    this.moveCapture = { ownerId, flower: structuredClone(hit), start: point, moved: false };
    this.publish({ ownerId, instruction: 'Move this bloom' });
  }

  private handleMove(event: SceneInputEvent): void {
    const capture = this.moveCapture;
    if (!capture || event.ownerId !== capture.ownerId) return;
    if (event.type === 'suspend') { this.cancelMove('Tracking paused. Flower unchanged.'); return; }
    if (event.type === 'move') {
      const dx = event.point[0] - capture.start[0]; const dy = event.point[1] - capture.start[1];
      if (Math.hypot(dx, dy) >= 1) capture.moved = true;
      const targetX = Math.min(854, Math.max(170, capture.flower.stem[3][0] + dx));
      const targetY = Math.min(510, Math.max(130, capture.flower.stem[3][1] + dy));
      const actualDx = targetX - capture.flower.stem[3][0]; const actualDy = targetY - capture.flower.stem[3][1];
      const p2: Vec2 = [capture.flower.stem[2][0] + actualDx, Math.min(capture.flower.stem[1][1] - 0.0001, Math.max(targetY + 0.0001, capture.flower.stem[2][1] + actualDy))];
      this.options.previewMove?.({ ...capture.flower, stem: [capture.flower.stem[0], capture.flower.stem[1], p2, [targetX, targetY]] });
    }
    if (event.type === 'release') {
      const preview = capture.moved ? this.currentMovePreview(event.point) : null;
      if (preview) this.options.commitMove?.(preview);
      this.cancelMove('Start at the seed');
    }
  }

  private currentMovePreview(point: Vec2): FlowerV1 {
    const capture = this.moveCapture!;
    const dx = point[0] - capture.start[0]; const dy = point[1] - capture.start[1];
    const targetX = Math.min(854, Math.max(170, capture.flower.stem[3][0] + dx));
    const targetY = Math.min(510, Math.max(130, capture.flower.stem[3][1] + dy));
    const actualDx = targetX - capture.flower.stem[3][0]; const actualDy = targetY - capture.flower.stem[3][1];
    const p2: Vec2 = [capture.flower.stem[2][0] + actualDx, Math.min(capture.flower.stem[1][1] - 0.0001, Math.max(targetY + 0.0001, capture.flower.stem[2][1] + actualDy))];
    return { ...capture.flower, stem: [capture.flower.stem[0], capture.flower.stem[1], p2, [targetX, targetY]] };
  }

  private cancelMove(instruction: string): void {
    this.moveCapture = null; this.options.previewMove?.(null); this.publish({ ownerId: null, instruction });
  }

  private finishStem(point: Vec2, timeMs: number): void {
    this.update(point, timeMs);
    const preview = this.snapshot.preview;
    if (!preview || this.consumed) return;
    const height = 640 - preview.stem[3][1];
    if (height < 120) { this.cancelActive('That sprout needs a little more height.'); return; }
    const finalPreview = preview.stem[3][1] > 510 ? { ...preview, stem: [preview.stem[0], preview.stem[1], [preview.stem[2][0], Math.min(preview.stem[1][1] - 0.0001, preview.stem[2][1] - (preview.stem[3][1] - 510))] as Vec2, [preview.stem[3][0], 510] as Vec2] as const } : preview;
    this.c0 = null; this.samples = []; this.hoverEnteredAt = null; this.startedAt = null; this.durationHintShown = false; this.suspendedFrom = null;
    this.publish({ state: 'shaping', preview: finalPreview, ownerId: null, instruction: 'Shape the flower', suspendedAt: null });
  }

  private handleBloomShape(event: SceneInputEvent): void {
    const preview = this.snapshot.preview;
    if (!preview) { this.reset('Start at the seed'); return; }
    if (!this.snapshot.ownerId) {
      if (event.type !== 'press') return;
      if (Math.hypot(event.point[0] - preview.stem[3][0], event.point[1] - preview.stem[3][1]) > blossomRadius(preview) + 24) {
        this.publish({ instruction: 'Start on the flower' });
        return;
      }
      this.shapeCapture = { origin: event.point, base: structuredClone(preview), lastPoint: event.point, moved: false };
      this.shapeRecoveryPoint = event.point; this.startedAt = event.timeMs;
      this.publish({ ownerId: event.ownerId, instruction: 'Turn and open the petals' });
      return;
    }
    if (event.ownerId !== this.snapshot.ownerId) return;
    if (event.type === 'suspend') {
      this.shapeRecoveryPoint = this.shapeCapture?.lastPoint ?? this.shapeRecoveryPoint;
      this.shapeCapture = null; this.suspendedFrom = 'shaping';
      this.publish({ state: 'suspended', instruction: 'Bring your hand back to the flower', suspendedAt: event.timeMs });
      return;
    }
    if (event.type === 'move') this.updateBloomShape(event.point);
    if (event.type === 'release') {
      this.updateBloomShape(event.point);
      this.commitBloom();
    }
  }

  private updateBloomShape(point: Vec2): void {
    const capture = this.shapeCapture;
    if (!capture) return;
    capture.lastPoint = point; this.shapeRecoveryPoint = point;
    if (!capture.moved && Math.hypot(point[0] - capture.origin[0], point[1] - capture.origin[1]) < 4) return;
    capture.moved = true;
    this.publish({ preview: shapeBloomFromDrag(capture.base, capture.origin, point), instruction: 'Turn and open the petals' });
  }

  private commitBloom(): void {
    const preview = this.snapshot.preview;
    if (!preview || this.consumed) return;
    this.consumed = true;
    this.shapeCapture = null; this.shapeRecoveryPoint = null; this.suspendedFrom = null; this.startedAt = null;
    this.publish({ state: 'blooming', ownerId: null, instruction: 'Flower added' });
    this.options.commit(preview);
    this.bloomTimer = setTimeout(() => this.reset('Start at the seed'), 850);
  }

  tick(timeMs: number): boolean {
    if (this.snapshot.state === 'growing' && this.startedAt !== null) {
      const duration = timeMs - this.startedAt;
      if (duration >= 20_000) { this.suspendedFrom = 'growing'; this.publish({ state: 'suspended', instruction: 'Regrip or cancel this flower', suspendedAt: timeMs }); return true; }
      if (duration >= 15_000 && !this.durationHintShown) { this.durationHintShown = true; this.publish({ instruction: 'Set the stem when ready' }); }
    }
    if (this.snapshot.state === 'suspended' && this.snapshot.suspendedAt !== null && timeMs - this.snapshot.suspendedAt > 2000) {
      this.cancelActive('Tracking was lost. Flower cancelled.');
      return true;
    }
    return false;
  }

  cancelActive(reason: string): void {
    if (this.moveCapture) { this.cancelMove(reason || 'Start at the seed'); return; }
    if (this.snapshot.state === 'ready') return;
    this.reset(reason || 'Start at the seed');
  }

  private reset(instruction: string): void {
    if (this.bloomTimer) clearTimeout(this.bloomTimer);
    this.bloomTimer = null;
    this.c0 = null;
    this.samples = [];
    this.hoverEnteredAt = null;
    this.consumed = false;
    this.startedAt = null;
    this.durationHintShown = false;
    this.shapeCapture = null;
    this.shapeRecoveryPoint = null;
    this.suspendedFrom = null;
    this.publish({ state: 'ready', preview: null, ownerId: null, suspendedAt: null, instruction });
  }
}
