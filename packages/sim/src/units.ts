import { TICK_RATE } from './config/simulation';

/** Uses only Math.sqrt, which IEEE 754 defines exactly, so every platform computes the same result. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Center of a grid cell in continuous coordinates. */
export function cellCenter(cell: number): number {
  return cell + 0.5;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

/** Converts a per-second amount (ore, damage, movement) to the amount for one tick. */
export function perTick(perSecond: number): number {
  return perSecond / TICK_RATE;
}

/** Ticks between two events that happen `perSecond` times a second (may be fractional). */
export function intervalTicks(perSecond: number): number {
  return TICK_RATE / perSecond;
}

/** Distances closer than this count as equal, so range checks are not thrown off by floating point rounding. */
export const DISTANCE_EPSILON = 1e-9;
