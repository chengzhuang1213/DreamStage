export interface SeedRng {
  state: number;
  next: () => number;
}

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function createSeedRng(seedOrState: string | number): SeedRng {
  let state = typeof seedOrState === 'number' ? seedOrState >>> 0 : hashSeed(seedOrState);
  if (state === 0) {
    state = 1;
  }

  return {
    get state() {
      return state >>> 0;
    },
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

export function rngInt(rng: SeedRng, min: number, max: number) {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function rngPick<T>(rng: SeedRng, items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(rng.next() * items.length)] ?? null;
}

export function rngShuffle<T>(rng: SeedRng, items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function rngSample<T>(rng: SeedRng, items: T[], count: number): T[] {
  return rngShuffle(rng, items).slice(0, count);
}

export function createRandomSeed() {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Date.now() >>> 0;
    bytes[1] = Math.imul(Date.now() >>> 0, 2654435761) >>> 0;
  }
  return `${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}
