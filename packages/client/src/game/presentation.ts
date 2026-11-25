import {
  getBuildingStats,
  MAP_EDGES,
  type BuildingLevel,
  type BuildingType,
  type EnemyType,
  type MapEdge,
  type RejectionReason,
  type WaveConfig,
} from '@space-miner/sim';

/** Display data shared by the Phaser scene and the Vue UI. */
export const BUILDINGS: Readonly<
  Record<BuildingType, { readonly name: string; readonly color: number; readonly description: string }>
> = {
  mine: { name: 'Mine', color: 0x8be04e, description: 'Pulls ore from nearby asteroids' },
  solar: { name: 'Solar', color: 0xf5d442, description: 'Powers mines and turrets' },
  laser: { name: 'Laser', color: 0x40c4ff, description: 'Fast, short-range defense' },
  missile: { name: 'Missile', color: 0xc77dff, description: 'Long-range splash salvos' },
  repair: { name: 'Mender Hive', color: 0x4cf2c4, description: 'Drones repair nearby buildings' },
};

/** size: relative to a grid cell. */
export const ENEMIES: Readonly<
  Record<EnemyType, { readonly name: string; readonly color: number; readonly size: number }>
> = {
  raider: { name: 'Raider', color: 0xff8a4d, size: 0.22 },
  gunship: { name: 'Gunship', color: 0xff4d5e, size: 0.32 },
  dreadnought: { name: 'Dreadnought', color: 0xe040fb, size: 0.46 },
};

/** Difficulty pips shown for a level. */
export const MAX_DIFFICULTY = 5;

/** What the menu and the loading screen say about each level; difficulty: 1 to MAX_DIFFICULTY. */
export const LEVEL_INFO: Readonly<Record<string, { readonly blurb: string; readonly difficulty: number }>> = {
  'quiet-belt': { blurb: 'A calm belt close to home. Learn the ropes.', difficulty: 1 },
  'scattered-drift': { blurb: 'The ore lies far apart and the pirates come sooner.', difficulty: 2 },
  maelstrom: { blurb: 'Rich fields deep in pirate space. Heavy ships, early.', difficulty: 2 },
  'twin-reefs': { blurb: 'Two rich reefs out east, and raids from the north and the south.', difficulty: 3 },
  'iron-ring': {
    blurb: 'Your base sits in the eye of a ring of rock. They come from every side.',
    difficulty: 3,
  },
  'ember-shoals': {
    blurb: 'A shoal of small rocks and swarms of raiders. Missile splash pays off.',
    difficulty: 3,
  },
  'leviathan-deep': {
    blurb: 'On the east rim, far from home. Dreadnoughts come early and often.',
    difficulty: 4,
  },
  'crimson-reach': {
    blurb: 'Every raid comes out of the east, straight through the richest rock.',
    difficulty: 4,
  },
  'corsair-gate': {
    blurb: 'Pinned in a corner by the corsairs: gunships from the first wave.',
    difficulty: 5,
  },
  'event-horizon': { blurb: 'The last stand. Everything they have, from every side.', difficulty: 5 },
};

const EDGE_NAMES: Readonly<Record<MapEdge, string>> = {
  top: 'the north',
  right: 'the east',
  bottom: 'the south',
  left: 'the west',
};

/** Where a level's pirates come from, in words: "every side", "the east", "the north and the south". */
export function describeSpawnEdges(waves: WaveConfig): string {
  const edges = waves.spawnEdges ?? MAP_EDGES;
  if (MAP_EDGES.every((edge) => edges.includes(edge))) return 'every side';
  const names = MAP_EDGES.filter((edge) => edges.includes(edge)).map((edge) => EDGE_NAMES[edge]);
  return names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${String(names.at(-1))}`;
}

/** Shown while a sector loads. */
export const TIPS: readonly string[] = [
  'Mines only reach the asteroids in their range: put them right next to the rock.',
  'Below 100% power everything slows down. Watch the energy meter and build solar panels in time.',
  'Destroyed pirates pay a bounty, so a strong defense keeps paying when the asteroids run dry.',
  'Upgrading (U) is often better than building new: more range, more damage, more hit points.',
  'Missiles splash: one salvo can break a whole swarm of raiders.',
  'A Mender Hive between your turrets keeps them alive through the long waves.',
  'Sell mines whose asteroids are empty: you get part of the ore back.',
  'Red markers on the map edge show where a wave comes in.',
  'Esc or P pauses the game. Take a breath, plan, then go on.',
  'The wave timer shows what the next wave brings: hover the ship icons for their hit points.',
];

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export const REJECTION_MESSAGES: Readonly<Record<RejectionReason, string>> = {
  gameOver: 'The game is over.',
  unknownPlayer: 'Unknown player.',
  unknownBuildingType: 'Unknown building.',
  outOfBounds: 'Outside the map.',
  cellOccupied: 'That cell is taken.',
  cellHasAsteroid: 'Cannot build on an asteroid.',
  insufficientOre: 'Not enough ore.',
  buildingNotFound: 'That building no longer exists.',
  notOwner: 'That building is not yours.',
  maxLevel: 'Already at the highest level.',
  lastBuilding: 'Your last building cannot be sold.',
};

export interface StatLine {
  readonly label: string;
  readonly value: string;
}

export function describeStats(type: BuildingType, level: BuildingLevel): StatLine[] {
  switch (type) {
    case 'mine': {
      const stats = getBuildingStats(type, level);
      return [
        { label: 'Ore / s', value: format(stats.orePerSecond) },
        { label: 'Range', value: format(stats.range) },
        { label: 'Energy use', value: format(stats.energyUse) },
      ];
    }
    case 'solar':
      return [{ label: 'Energy output', value: format(getBuildingStats(type, level).energyOutput) }];
    case 'laser':
    case 'missile': {
      const stats = getBuildingStats(type, level);
      return [
        // a salvo shows as "3 × 25": three missiles of 25 damage each
        {
          label: 'Damage',
          value: stats.salvo > 1 ? `${String(stats.salvo)} × ${format(stats.damage)}` : format(stats.damage),
        },
        { label: type === 'missile' ? 'Salvos / s' : 'Shots / s', value: format(stats.shotsPerSecond) },
        { label: 'Range', value: format(stats.range) },
        ...(stats.splashRadius > 0 ? [{ label: 'Splash', value: format(stats.splashRadius) }] : []),
        { label: 'Energy use', value: format(stats.energyUse) },
      ];
    }
    case 'repair': {
      const stats = getBuildingStats(type, level);
      return [
        { label: 'Drones', value: String(stats.drones) },
        { label: 'Repair / s', value: `${String(stats.drones)} × ${format(stats.repairPerSecond)}` },
        { label: 'Range', value: format(stats.range) },
        { label: 'Energy use', value: format(stats.energyUse) },
      ];
    }
  }
}

/** Range of a building type, for range circles (undefined: the type has no range). */
export function rangeOf(type: BuildingType, level: BuildingLevel): number | undefined {
  return type === 'solar' ? undefined : getBuildingStats(type, level).range;
}

function format(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(value < 1 ? 2 : 1).replace(/0$/, '');
}
