export type Random = () => number;

export function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function fnv1a(value: string): number {
  let state = 2166136261;
  for (const byte of new TextEncoder().encode(value)) {
    state ^= byte;
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state >>> 0;
}

export function randomStream(seed: number, name: 'petals' | 'leaves' | 'pollen' | 'ink'): Random {
  return mulberry32(fnv1a(`${seed >>> 0}/${name}`));
}

export const MULBERRY32_TEST_VECTOR = {
  seed: 1,
  firstFive: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849],
} as const;
