import type { BouquetV1 } from '../../src/data/schema';

export const fixtureRecipe: BouquetV1 = {
  format: 'love-parametrically', schemaVersion: 1, geometryVersion: 'botanical-v1', randomVersion: 'mulberry32-v1',
  id: 'fixture-bouquet', createdAt: '2026-09-05T12:00:00.000Z', palette: 'rose-letter',
  flowers: [
    { id: 'fixture-cosmos', seed: 123456789, species: 'cosmos', stem: [[512, 640], [480, 535], [449, 430], [460, 340]], bloomRotation: 0.18, bloomAspect: 0.94, sizeMultiplier: 1, order: 0 },
    { id: 'fixture-rose', seed: 987654321, species: 'wild-rose', stem: [[512, 640], [530, 520], [566, 402], [590, 285]], bloomRotation: -0.24, bloomAspect: 0.92, sizeMultiplier: 1.04, order: 1 },
  ],
  dedication: { to: 'You', from: 'Me', note: 'For the ordinary Tuesday <script>alert(1)</script>.', displayDate: '2026-09-05' },
};
