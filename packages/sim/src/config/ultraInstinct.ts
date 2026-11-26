/**
 * Ultra Instinct: a player's buildings work many times better for a few seconds. Mines mine faster, solar
 * panels make more energy, turrets fire faster, repair drones fly and repair faster, and the buildings
 * take less damage, each by `multiplier`. It has a price: right after it the buildings burn out, and for a
 * few seconds they work `burnoutDivisor` times worse at all of these (and take that many times the
 * damage). Then it recharges before it can be used again.
 */
export const ULTRA_INSTINCT_CONFIG = {
  multiplier: 10,
  durationSeconds: 10,
  /** The burnout right after it: this many times worse, for this long. */
  burnoutDivisor: 5,
  burnoutSeconds: 5,
  /** Seconds from the end of one to when the next can start; the burnout is part of it. */
  rechargeSeconds: 120,
} as const;
