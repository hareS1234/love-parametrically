import { useSyncExternalStore } from 'react';
import type { BouquetV1, FlowerV1 } from '../data/schema';
import { createEmptyBouquet } from '../data/schema';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface StudioState {
  recipe: BouquetV1;
  revision: number;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
}

export interface StudioStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StudioState;
  transact(label: string, update: (recipe: BouquetV1) => BouquetV1): void;
  replace(recipe: BouquetV1): void;
  select(id: string | null): void;
  undo(): void;
  redo(): void;
  markSaving(): void;
  markSaved(revision: number): void;
  markSaveError(message: string): void;
  setAutosave(callback: ((recipe: BouquetV1, revision: number) => void) | null): void;
}

const clone = (recipe: BouquetV1): BouquetV1 => structuredClone(recipe);

export function createStudioStore(initial = createEmptyBouquet()): StudioStore {
  let state: StudioState = { recipe: initial, revision: 0, selectedId: null, canUndo: false, canRedo: false, saveStatus: 'idle', saveError: null };
  const undoStack: BouquetV1[] = [];
  const redoStack: BouquetV1[] = [];
  const listeners = new Set<() => void>();
  let autosave: ((recipe: BouquetV1, revision: number) => void) | null = null;
  const emit = () => listeners.forEach((listener) => listener());
  const setState = (patch: Partial<StudioState>) => { state = { ...state, ...patch }; emit(); };
  const scheduleSave = () => autosave?.(clone(state.recipe), state.revision);

  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot() { return state; },
    transact(_label, update) {
      const previous = clone(state.recipe);
      const next = update(clone(state.recipe));
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      undoStack.push(previous);
      if (undoStack.length > 50) undoStack.shift();
      redoStack.length = 0;
      state = { ...state, recipe: next, revision: state.revision + 1, canUndo: true, canRedo: false, saveStatus: 'saving', saveError: null };
      emit();
      scheduleSave();
    },
    replace(recipe) {
      undoStack.length = 0;
      redoStack.length = 0;
      state = { ...state, recipe: clone(recipe), revision: state.revision + 1, selectedId: null, canUndo: false, canRedo: false, saveStatus: 'saving', saveError: null };
      emit();
      scheduleSave();
    },
    select(id) { setState({ selectedId: id }); },
    undo() {
      const previous = undoStack.pop();
      if (!previous) return;
      redoStack.push(clone(state.recipe));
      state = { ...state, recipe: previous, revision: state.revision + 1, canUndo: undoStack.length > 0, canRedo: true, saveStatus: 'saving', saveError: null };
      emit();
      scheduleSave();
    },
    redo() {
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(clone(state.recipe));
      state = { ...state, recipe: next, revision: state.revision + 1, canUndo: true, canRedo: redoStack.length > 0, saveStatus: 'saving', saveError: null };
      emit();
      scheduleSave();
    },
    markSaving() { setState({ saveStatus: 'saving', saveError: null }); },
    markSaved(revision) { if (revision === state.revision) setState({ saveStatus: 'saved', saveError: null }); },
    markSaveError(message) { setState({ saveStatus: 'error', saveError: message }); },
    setAutosave(callback) { autosave = callback; },
  };
}

export function useStudioStore(store: StudioStore): StudioState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function addFlower(recipe: BouquetV1, flower: FlowerV1): BouquetV1 {
  if (recipe.flowers.length >= 7) return recipe;
  return { ...recipe, flowers: [...recipe.flowers, { ...flower, order: recipe.flowers.length }] };
}

export function updateFlower(recipe: BouquetV1, id: string, update: Partial<FlowerV1>): BouquetV1 {
  return { ...recipe, flowers: recipe.flowers.map((flower) => flower.id === id ? { ...flower, ...update } : flower) };
}

export function removeFlower(recipe: BouquetV1, id: string): BouquetV1 {
  return { ...recipe, flowers: recipe.flowers.filter((flower) => flower.id !== id).map((flower, order) => ({ ...flower, order })) };
}
