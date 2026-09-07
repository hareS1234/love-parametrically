import { describe, expect, it } from 'vitest';
import { addFlower, createStudioStore, removeFlower } from '../src/app/store';
import { SerializedSaveQueue } from '../src/data/archive';
import { fixtureRecipe } from './fixtures/recipes';
import type { BouquetV1 } from '../src/data/schema';

describe('transactional store', () => {
  it('undo removes one complete flower transaction and redo restores it (LP-12)', () => {
    const store = createStudioStore(fixtureRecipe);
    store.transact('Remove flower', (recipe) => removeFlower(recipe, 'fixture-rose'));
    expect(store.getSnapshot().recipe.flowers).toHaveLength(1);
    store.undo(); expect(store.getSnapshot().recipe.flowers).toHaveLength(2);
    store.redo(); expect(store.getSnapshot().recipe.flowers).toHaveLength(1);
  });

  it('serializes saves so a slower old revision cannot finish after the latest one (LP-13)', async () => {
    const queue = new SerializedSaveQueue();
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    let storedRevision = 0;
    const oldSave = queue.enqueue(async () => { await oldGate; storedRevision = 1; });
    const latestSave = queue.enqueue(async () => { storedRevision = 2; });
    await Promise.resolve();
    expect(storedRevision).toBe(0);
    releaseOld();
    await Promise.all([oldSave, latestSave]);
    expect(storedRevision).toBe(2);
  });

  it('keeps the hard seven-flower limit without disabling edits', () => {
    let recipe: BouquetV1 = { ...fixtureRecipe, flowers: [] };
    for (let index = 0; index < 8; index += 1) recipe = addFlower(recipe, { ...fixtureRecipe.flowers[0], id: `flower-${index}`, order: index });
    expect(recipe.flowers).toHaveLength(7);
    expect(removeFlower(recipe, 'flower-3').flowers).toHaveLength(6);
  });
});
