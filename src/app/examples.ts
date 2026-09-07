import type { BouquetV1 } from '../data/schema';

export const exampleBouquet: BouquetV1 = {
  format: 'love-parametrically', schemaVersion: 1, geometryVersion: 'botanical-v1', randomVersion: 'mulberry32-v1',
  id: 'bouquet-example-landing', createdAt: '2026-09-05T12:00:00.000Z', palette: 'rose-letter',
  flowers: [
    { id: 'example-cosmos', seed: 19088743, species: 'cosmos', stem: [[512, 640], [450, 520], [405, 386], [414, 267]], bloomRotation: -0.18, bloomAspect: 0.94, sizeMultiplier: 1.02, order: 0 },
    { id: 'example-rose', seed: 2309737967, species: 'wild-rose', stem: [[512, 640], [534, 516], [565, 365], [578, 226]], bloomRotation: 0.3, bloomAspect: 0.95, sizeMultiplier: 1.05, order: 1 },
    { id: 'example-chamomile', seed: 4275878552, species: 'chamomile', stem: [[512, 640], [491, 547], [500, 455], [505, 345]], bloomRotation: 0.08, bloomAspect: 0.9, sizeMultiplier: 0.94, order: 2 },
  ],
  dedication: { to: '', from: '', note: '', displayDate: null },
};
