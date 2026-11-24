import type { AsteroidSize, BuildingLevel, BuildingType, EnemyType, TurretType } from '@space-miner/sim';

/**
 * Sprites cut from the generated sheets by `make sprites` (scripts/sprites.ts). Every file is optional:
 * without one, the game draws a shape instead.
 */
const FILES = import.meta.glob<string>('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Sprite name (file name without .png) to URL. */
export const SPRITE_URLS: ReadonlyMap<string, string> = new Map(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]),
);

export const BACKGROUND_SPRITE = 'background';

function existing(...names: string[]): string | undefined {
  return names.find((name) => SPRITE_URLS.has(name));
}

/** The level's own sprite when there is one, otherwise the building's. */
export function buildingSprite(type: BuildingType, level: BuildingLevel): string | undefined {
  return existing(`building-${type}-${String(level)}`, `building-${type}`);
}

export function shipSprite(type: EnemyType): string | undefined {
  return existing(`ship-${type}`);
}

export function projectileSprite(type: TurretType): string | undefined {
  return existing(`projectile-${type}`);
}

/** Asteroids of a size have several variants; the id picks one, so an asteroid always looks the same. */
export function asteroidSprite(size: AsteroidSize, id: number): string | undefined {
  const variants = [...SPRITE_URLS.keys()].filter((name) => name.startsWith(`asteroid-${size}-`)).sort();
  return variants[id % Math.max(1, variants.length)];
}

export function spriteUrl(name: string | undefined): string | undefined {
  return name === undefined ? undefined : SPRITE_URLS.get(name);
}
