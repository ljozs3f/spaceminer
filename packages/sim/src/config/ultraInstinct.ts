/**
 * Ultra Instinct: a player's buildings work many times better for a few seconds. Mines mine faster, solar
 * panels make more energy, turrets fire faster, repair drones fly and repair faster, and the buildings
 * take less damage, each by `multiplier`. After it ends it recharges before it can be used again.
 */
export const ULTRA_INSTINCT_CONFIG = {
  multiplier: 10,
  durationSeconds: 10,
  /** Seconds from the end of one to when the next can start. */
  rechargeSeconds: 120,
} as const;
