import { describe, expect, it } from 'vitest';
import type { FlowerV1 } from '../src/data/schema';
import { SceneController, type GrowthSnapshot } from '../src/interaction/controller';

function harness() {
  const committed: FlowerV1[] = []; let last: GrowthSnapshot | null = null;
  const controller = new SceneController({ getSpecies: () => 'cosmos', getFlowerCount: () => committed.length, commit: (flower) => committed.push(flower), publish: (snapshot) => { last = snapshot; } });
  return { controller, committed, get last() { return last; } };
}

describe('growth transaction state machine', () => {
  it('pointer cancellation removes the preview without commit (LP-09)', () => {
    const test = harness(); test.controller.handle({ type: 'hover', ownerId: 'pointer', point: [512, 620], timeMs: 0 }); test.controller.handle({ type: 'press', ownerId: 'pointer', point: [512, 620], timeMs: 121 }); test.controller.handle({ type: 'move', ownerId: 'pointer', point: [450, 400], timeMs: 200 }); test.controller.handle({ type: 'cancel', ownerId: 'pointer', reason: 'synthetic cancel', timeMs: 220 });
    expect(test.committed).toHaveLength(0); expect(test.controller.getSnapshot().state).toBe('ready');
  });

  it('short growth cancels without consuming a flower (LP-10)', () => {
    const test = harness(); test.controller.handle({ type: 'hover', ownerId: 'pointer', point: [512, 620], timeMs: 0 }); test.controller.handle({ type: 'press', ownerId: 'pointer', point: [512, 620], timeMs: 121 }); test.controller.handle({ type: 'release', ownerId: 'pointer', point: [512, 550], timeMs: 250 });
    expect(test.committed).toHaveLength(0); expect(test.controller.getSnapshot().preview).toBeNull();
  });

  it('missing input suspends and never commits as a release (LP-06)', () => {
    const test = harness(); test.controller.handle({ type: 'hover', ownerId: 'hand-1', point: [512, 620], timeMs: 0 }); test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [512, 620], timeMs: 121 }); test.controller.handle({ type: 'move', ownerId: 'hand-1', point: [480, 350], timeMs: 220 }); test.controller.handle({ type: 'suspend', ownerId: 'hand-1', timeMs: 430 });
    expect(test.controller.getSnapshot().state).toBe('suspended'); expect(test.committed).toHaveLength(0);
    test.controller.tick(2500); expect(test.controller.getSnapshot().state).toBe('ready'); expect(test.committed).toHaveLength(0);
  });

  it('sets the stem before shaping and commits once after the second gesture', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'pointer', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'pointer', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'pointer', point: [480, 350], timeMs: 240 });
    test.controller.handle({ type: 'release', ownerId: 'pointer', point: [480, 350], timeMs: 300 });
    expect(test.controller.getSnapshot().state).toBe('shaping');
    expect(test.committed).toHaveLength(0);

    const before = test.controller.getSnapshot().preview!;
    test.controller.handle({ type: 'press', ownerId: 'pointer', point: before.stem[3], timeMs: 400 });
    test.controller.handle({ type: 'move', ownerId: 'pointer', point: [before.stem[3][0] + 80, before.stem[3][1] - 42], timeMs: 480 });
    const shaped = test.controller.getSnapshot().preview!;
    expect(shaped.bloomRotation).not.toBe(before.bloomRotation);
    expect(shaped.bloomAspect).not.toBe(before.bloomAspect);
    test.controller.handle({ type: 'release', ownerId: 'pointer', point: [before.stem[3][0] + 80, before.stem[3][1] - 42], timeMs: 520 });
    expect(test.controller.getSnapshot().state).toBe('blooming');
    expect(test.committed).toEqual([shaped]);
  });

  it('keeps the seeded bloom when the second gesture does not move', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'pointer', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'pointer', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'pointer', point: [500, 360], timeMs: 220 });
    test.controller.handle({ type: 'release', ownerId: 'pointer', point: [500, 360], timeMs: 280 });
    const before = structuredClone(test.controller.getSnapshot().preview!);
    test.controller.handle({ type: 'press', ownerId: 'pointer', point: before.stem[3], timeMs: 360 });
    test.controller.handle({ type: 'release', ownerId: 'pointer', point: before.stem[3], timeMs: 390 });
    expect(test.committed).toEqual([before]);
  });

  it('recovers a paused petal gesture without a jump', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'hand-1', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'hand-1', point: [470, 330], timeMs: 220 });
    test.controller.handle({ type: 'release', ownerId: 'hand-1', point: [470, 330], timeMs: 280 });
    const center = test.controller.getSnapshot().preview!.stem[3];
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: center, timeMs: 360 });
    test.controller.handle({ type: 'move', ownerId: 'hand-1', point: [center[0] + 24, center[1] - 18], timeMs: 430 });
    const paused = structuredClone(test.controller.getSnapshot().preview!);
    test.controller.handle({ type: 'suspend', ownerId: 'hand-1', timeMs: 460 });
    expect(test.controller.getSnapshot().state).toBe('suspended');
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [center[0] + 24, center[1] - 18], timeMs: 520 });
    expect(test.controller.getSnapshot().preview).toEqual(paused);
    test.controller.handle({ type: 'release', ownerId: 'hand-1', point: [center[0] + 24, center[1] - 18], timeMs: 550 });
    expect(test.committed).toEqual([paused]);
  });

  it('cancels an unfinished flower during petal shaping', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'pointer', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'pointer', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'pointer', point: [500, 350], timeMs: 220 });
    test.controller.handle({ type: 'release', ownerId: 'pointer', point: [500, 350], timeMs: 280 });
    test.controller.cancelActive('Flower cancelled.');
    expect(test.controller.getSnapshot().state).toBe('ready');
    expect(test.controller.getSnapshot().preview).toBeNull();
    expect(test.committed).toHaveLength(0);
  });

  it('ignores a different owner during petal shaping', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'hand-1', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'hand-1', point: [480, 340], timeMs: 220 });
    test.controller.handle({ type: 'release', ownerId: 'hand-1', point: [480, 340], timeMs: 280 });
    const center = test.controller.getSnapshot().preview!.stem[3];
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: center, timeMs: 360 });
    const before = structuredClone(test.controller.getSnapshot().preview!);
    test.controller.handle({ type: 'move', ownerId: 'hand-2', point: [center[0] + 80, center[1] - 50], timeMs: 420 });
    test.controller.handle({ type: 'release', ownerId: 'hand-2', point: [center[0] + 80, center[1] - 50], timeMs: 450 });
    expect(test.controller.getSnapshot().preview).toEqual(before);
    expect(test.committed).toHaveLength(0);
    test.controller.handle({ type: 'release', ownerId: 'hand-1', point: center, timeMs: 480 });
    expect(test.committed).toHaveLength(1);
  });

  it('ignores a press that arrives after recovery timed out', () => {
    const test = harness();
    test.controller.handle({ type: 'hover', ownerId: 'hand-1', point: [512, 620], timeMs: 0 });
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [512, 620], timeMs: 121 });
    test.controller.handle({ type: 'move', ownerId: 'hand-1', point: [480, 340], timeMs: 220 });
    test.controller.handle({ type: 'suspend', ownerId: 'hand-1', timeMs: 300 });
    test.controller.handle({ type: 'press', ownerId: 'hand-1', point: [480, 340], timeMs: 2401 });
    expect(test.controller.getSnapshot().state).toBe('ready');
    expect(test.controller.getSnapshot().preview).toBeNull();
    expect(test.committed).toHaveLength(0);
  });

  it('selects, then moves, an existing bloom through the shared hand event contract', () => {
    const flower: FlowerV1 = { id: 'existing', seed: 1, species: 'cosmos', stem: [[512, 640], [500, 530], [490, 410], [480, 300]], bloomRotation: 0, bloomAspect: 0.9, sizeMultiplier: 1, order: 0 };
    let selectedId: string | null = null; const moves: FlowerV1[] = [];
    const controller = new SceneController({ getSpecies: () => 'cosmos', getFlowerCount: () => 1, getFlowers: () => [flower], getSelectedId: () => selectedId, selectFlower: (id) => { selectedId = id; }, previewMove: () => undefined, commitMove: (value) => { moves.push(value); }, commit: () => undefined, publish: () => undefined });
    controller.handle({ type: 'press', ownerId: 'hand-1', point: [480, 300], timeMs: 0 });
    expect(selectedId).toBe('existing');
    controller.handle({ type: 'press', ownerId: 'hand-1', point: [480, 300], timeMs: 200 });
    controller.handle({ type: 'move', ownerId: 'hand-1', point: [510, 280], timeMs: 240 });
    controller.handle({ type: 'release', ownerId: 'hand-1', point: [510, 280], timeMs: 300 });
    expect(moves[0].stem[3]).toEqual([510, 280]);
  });
});
