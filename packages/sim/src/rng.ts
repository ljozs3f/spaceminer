/**
 * Mulberry32: a small seeded PRNG whose whole state is one 32-bit integer, so it lives in the game state
 * and survives JSON serialization.
 */
export interface RngHolder {
  rngState: number;
}

export function seedRngState(seed: number): number {
  return seed >>> 0;
}

/** Uniform in [0, 1). */
export function nextRandom(holder: RngHolder): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform integer in [min, max]. */
export function randomInt(holder: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextRandom(holder) * (max - min + 1));
}
