import type { AsteroidSize, EntityId } from '@space-miner/sim';

/**
 * How asteroids look on the map, shared by the scene (the rocks) and the effects (the mining beams that end
 * on them). Asteroids keep their cells in the game; on screen they drift a little around them and spin
 * slowly. Each has a warm ore color that fades to a pale grey as it is mined, so the color shows what is
 * left; the size stays the same.
 */

/** Ore colors: close to each other, so they read as one resource. */
const ORE_COLORS = [0xffb347, 0xffcf5c, 0xff9a5a] as const;
/** What a mined-out asteroid fades to: a pale, cold grey. */
const DEPLETED_COLOR = 0x9aa1ad;

/** Spin in radians per second (before the direction): small rocks turn faster than large ones. */
const SPIN: Readonly<Record<AsteroidSize, number>> = { small: 0.2, medium: 0.12, large: 0.06 };
/** How far an asteroid drifts from its place, in pixels. */
const DRIFT_PX: Readonly<Record<AsteroidSize, number>> = { small: 2.4, medium: 1.9, large: 1.3 };

export interface AsteroidMotion {
  /** Offset from the asteroid's place, in pixels. */
  readonly dx: number;
  readonly dy: number;
  readonly rotation: number;
}

export function asteroidMotion(id: EntityId, size: AsteroidSize, nowMs: number): AsteroidMotion {
  const seconds = nowMs / 1000;
  const direction = hash(id * 3.1) < 0.5 ? -1 : 1;
  const spin = SPIN[size] * (0.6 + 0.8 * hash(id * 5.7)) * direction;
  const drift = DRIFT_PX[size];
  return {
    dx: Math.sin(seconds / (2.6 + 1.8 * hash(id * 7.3)) + hash(id) * 6.3) * drift,
    dy: Math.cos(seconds / (3.1 + 1.6 * hash(id * 9.1)) + hash(id * 2.2) * 6.3) * drift,
    rotation: hash(id) * Math.PI * 2 + seconds * spin,
  };
}

export interface AsteroidColor {
  /** The asteroid's own ore color, full strength. */
  readonly ore: number;
  /** Multiply tint of the rock: the ore color while full, grey when mined out. */
  readonly tint: number;
  readonly alpha: number;
  /** Strength of the additive ore glow on and around the rock (0 when mined out). */
  readonly glow: number;
}

/** remaining: share of the ore left, 0 to 1. */
export function asteroidColor(id: EntityId, remaining: number): AsteroidColor {
  const ore = ORE_COLORS[Math.floor(hash(id * 11.3) * ORE_COLORS.length)] ?? ORE_COLORS[0];
  const fraction = Math.min(1, Math.max(0, remaining));
  return {
    ore,
    tint: mixColors(DEPLETED_COLOR, lighten(ore, 0.35), fraction),
    alpha: 0.45 + 0.55 * fraction,
    glow: fraction,
  };
}

/** Linear mix of two 0xRRGGBB colors: t = 0 gives a, 1 gives b. */
export function mixColors(a: number, b: number, t: number): number {
  const channel = (shift: number): number => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

function lighten(color: number, amount: number): number {
  return mixColors(color, 0xffffff, amount);
}

/** A number in [0, 1) that depends only on n: stable looks for every entity, frame after frame. */
export function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
