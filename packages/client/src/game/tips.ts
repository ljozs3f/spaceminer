import {
  BUILDING_SALE,
  ENEMY_CONFIG,
  energyEfficiency,
  findById,
  findPlayer,
  getBuildingEnergy,
  getBuildingStats,
  isUltraInstinctActive,
  nextBuildingLevel,
  ULTRA_INSTINCT_CONFIG,
  type Asteroid,
  type Building,
  type BuildingType,
  type Enemy,
  type PlayerId,
  type ReadonlyGameState,
} from '@space-miner/sim';
import type { MapTarget } from '../events';
import { asteroidColor } from '../phaser/asteroidLook';
import { BUILDINGS, cssColor, describeStats, ENEMIES, formatValue } from './presentation';
import type { TipContent, TipStat } from './tooltip';
import type { BuildingView, HudView, UltraInstinctView } from './views';

/** What the tooltips of the game say: the build bar, the HUD, Ultra Instinct and the objects on the map. */

const MAX_LEVEL = 3;
const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large' } as const;
const COLORS = {
  ore: '#ffb347',
  energy: '#f5d442',
  danger: '#ff5c6c',
  mined: '#ffc861',
  ultra: '#bfe3ff',
  ui: '#40c4ff',
} as const;

const percent = (fraction: number): string => `${String(Math.floor(fraction * 100))}%`;
const clock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

/** A building of the build bar, at level 1: what it does, what it costs, and whether there is ore for it. */
export function buildCardTip(type: BuildingType, key: number, ore: number): TipContent {
  const info = BUILDINGS[type];
  const { cost, maxHp } = getBuildingStats(type, 1);
  return {
    title: info.name,
    subtitle: `Key ${String(key)}`,
    text: info.details,
    stats: [
      { label: 'Cost', value: `${String(cost)} ore` },
      { label: 'Hit points', value: String(maxHp) },
      ...describeStats(type, 1),
    ],
    ...(ore < cost && { warning: `${String(Math.ceil(cost - ore))} more ore needed` }),
    hint: `Press ${String(key)} or click it, then click a free cell on the map`,
    color: cssColor(info.color),
  };
}

export function ultraInstinctTip(view: UltraInstinctView): TipContent {
  const { multiplier, durationSeconds, rechargeSeconds } = ULTRA_INSTINCT_CONFIG;
  let subtitle = 'Ready';
  if (view.active) subtitle = `On · ${String(view.secondsLeft)} s left`;
  else if (!view.ready) subtitle = 'Recharging';
  return {
    title: 'Ultra Instinct',
    subtitle,
    text:
      `For ${String(durationSeconds)} seconds every building works ${String(multiplier)} times better: ` +
      'mines dig faster, solar panels make more energy, turrets fire faster, drones repair faster, and ' +
      `the buildings take ${String(multiplier)} times less damage.`,
    stats: [
      { label: 'Boost', value: `×${String(multiplier)}` },
      { label: 'Lasts', value: `${String(durationSeconds)} s` },
      { label: 'Recharge', value: clock(rechargeSeconds) },
    ],
    ...(!view.active && !view.ready && { warning: `Ready again in ${clock(view.secondsLeft)}` }),
    ...(view.ready && { hint: 'Press I or click it. Save it for the big waves.' }),
    color: COLORS.ultra,
  };
}

export function oreTip(hud: HudView): TipContent {
  return {
    title: 'Ore',
    subtitle: String(Math.floor(hud.ore)),
    text:
      'The only currency: buildings and upgrades cost ore. Mines dig it out of the asteroids, destroyed ' +
      'pirates pay a bounty, and selling a building pays part of it back.',
    stats: [{ label: 'From the mines', value: `+${formatValue(hud.oreRate)} / s` }],
    ...(hud.oreRate === 0 && { warning: 'No mine is mining: build one right next to an asteroid' }),
    color: COLORS.ore,
  };
}

export function energyTip(hud: HudView): TipContent {
  const short = hud.efficiency < 1;
  return {
    title: 'Energy',
    subtitle: `${percent(hud.efficiency)} power`,
    text:
      'Solar panels make it; mines, turrets and hives use it. When they use more than the panels make, ' +
      'they all work at the covered share.',
    stats: [
      { label: 'Made', value: formatValue(hud.energyProduced) },
      { label: 'Used', value: formatValue(hud.energyConsumed), ...(short && { tone: 'bad' as const }) },
      { label: 'Power', value: percent(hud.efficiency), tone: short ? 'bad' : 'good' },
    ],
    ...(short && { warning: 'Build solar panels: everything works slower' }),
    color: short ? COLORS.danger : COLORS.energy,
  };
}

export function minedTip(hud: HudView): TipContent {
  const left = Math.max(0, hud.goalFraction - hud.minedFraction);
  return {
    title: 'Mined ore',
    subtitle: percent(hud.minedFraction),
    text: `Mine ${percent(hud.goalFraction)} of the sector's ore to win. Bounties do not count.`,
    stats: [
      { label: 'Mined', value: percent(hud.minedFraction) },
      { label: 'Goal', value: percent(hud.goalFraction) },
      { label: 'Still to go', value: left > 0 ? percent(left) : 'done', ...(left === 0 && { tone: 'good' }) },
    ],
    color: COLORS.mined,
  };
}

/** from: where the pirates come from, in words ("every side", "the east"). */
export function waveTip(hud: HudView, from: string): TipContent {
  return {
    title: `Wave ${String(hud.wavesSpawned + 1)}`,
    subtitle: `in ${clock(hud.secondsToNextWave)}`,
    text: `Pirates come from ${from}. They fly to your nearest building; every wave is bigger than the last.`,
    stats: hud.nextWave.map((group) => ({
      label: `${String(group.count)} × ${ENEMIES[group.type].name}`,
      value: `${String(Math.round(group.maxHp))} HP each`,
    })),
    color: COLORS.danger,
  };
}

export function attackTip(hud: HudView): TipContent {
  return {
    title: 'Under attack',
    subtitle: `${String(hud.enemies)} ${hud.enemies === 1 ? 'ship' : 'ships'}`,
    text: 'Pirate ships are on the map. Your turrets fire at the ones in their range; point at a ship to see it.',
    color: COLORS.danger,
  };
}

export function sellTip(building: BuildingView): TipContent {
  return {
    title: 'Sell',
    text:
      `Pays back ${percent(BUILDING_SALE.refundFraction)} of everything spent on it (placing and ` +
      'upgrades), less if it is damaged.',
    stats: [{ label: 'You get', value: `+${String(building.sellValue)} ore`, tone: 'good' }],
    ...(!building.sellable && { warning: 'Your last building cannot be sold' }),
    color: COLORS.ore,
  };
}

/** A plain tooltip for a button: what it does and its key. */
export function buttonTip(title: string, hint?: string, text?: string): TipContent {
  return { title, ...(text && { text }), ...(hint && { hint }), color: COLORS.ui };
}

/** The tooltip of the object under the pointer on the map; null when it is gone. */
export function mapTip(state: ReadonlyGameState, playerId: PlayerId, target: MapTarget): TipContent | null {
  switch (target.kind) {
    case 'building': {
      const building = findById(state.buildings, target.id);
      return building ? buildingTip(state, playerId, building) : null;
    }
    case 'asteroid': {
      const asteroid = findById(state.asteroids, target.id);
      return asteroid ? asteroidTip(state, asteroid) : null;
    }
    case 'enemy': {
      const enemy = findById(state.enemies, target.id);
      return enemy ? enemyTip(enemy) : null;
    }
  }
}

function buildingTip(state: ReadonlyGameState, playerId: PlayerId, building: Building): TipContent {
  const info = BUILDINGS[building.type];
  const { maxHp } = getBuildingStats(building.type, building.level);
  const player = findPlayer(state.players, building.ownerId);
  const efficiency = player ? energyEfficiency(player) : 1;
  const usesEnergy = getBuildingEnergy(building.type, building.level).consumed > 0;
  const boosted = player !== undefined && isUltraInstinctActive(state, player);
  const repairing = state.drones.some((drone) => drone.repairing && drone.targetId === building.id);
  const stats: TipStat[] = [
    {
      label: 'Hit points',
      value: `${String(Math.ceil(building.hp))} / ${String(maxHp)}`,
      ...(building.hp < maxHp * 0.35 && { tone: 'bad' as const }),
    },
    ...describeStats(building.type, building.level),
  ];
  const status = buildingStatus(state, building, repairing);
  if (status) stats.push(status);
  const next = nextBuildingLevel(building.level);
  let hint: string | undefined;
  if (building.ownerId === playerId) {
    hint =
      next === null
        ? 'Click it to sell it'
        : `Click it to upgrade (${String(getBuildingStats(building.type, next).cost)} ore) or sell it`;
  }
  return {
    title: info.name,
    subtitle: `Level ${String(building.level)} of ${String(MAX_LEVEL)}${boosted ? ' · Ultra Instinct' : ''}`,
    text: info.details,
    stats,
    ...(usesEnergy && efficiency < 1 && { warning: `Low power: works at ${percent(efficiency)}` }),
    ...(hint && { hint }),
    color: cssColor(info.color),
  };
}

/** What the building is doing right now. */
function buildingStatus(state: ReadonlyGameState, building: Building, repaired: boolean): TipStat | null {
  if (repaired) return { label: 'Status', value: 'Being repaired', tone: 'good' };
  switch (building.type) {
    case 'mine':
      return building.targetId === null
        ? { label: 'Status', value: 'Idle: no ore in range', tone: 'bad' }
        : { label: 'Status', value: 'Mining', tone: 'good' };
    case 'laser':
    case 'missile':
      return { label: 'Status', value: building.targetId === null ? 'Watching' : 'Firing' };
    case 'repair': {
      const out = state.drones.filter((drone) => drone.hiveId === building.id && drone.targetId !== null);
      return {
        label: 'Status',
        value: out.length > 0 ? `${String(out.length)} drones out` : 'Drones docked',
      };
    }
    case 'solar':
      return null;
  }
}

function asteroidTip(state: ReadonlyGameState, asteroid: Asteroid): TipContent {
  const remaining = asteroid.ore / asteroid.initialOre;
  const mines = state.buildings.filter(
    (building) => building.type === 'mine' && building.targetId === asteroid.id,
  ).length;
  const empty = asteroid.ore <= 0;
  let hint: string | undefined;
  if (!empty && mines === 0) hint = 'Build a mine right next to it to mine it';
  return {
    title: `${SIZE_NAMES[asteroid.size]} asteroid`,
    subtitle: empty ? 'Mined out' : `${percent(remaining)} ore left`,
    text: empty
      ? 'Nothing left in it. Sell the mines that were mining it to get some ore back.'
      : 'Its ore glows in its color, fading to grey as it is mined.',
    stats: [
      { label: 'Ore left', value: `${String(Math.ceil(asteroid.ore))} / ${String(asteroid.initialOre)}` },
      { label: 'Mines on it', value: String(mines), ...(mines > 0 && { tone: 'good' as const }) },
    ],
    ...(hint && { hint }),
    color: cssColor(asteroidColor(asteroid.id, remaining).ore),
  };
}

function enemyTip(enemy: Enemy): TipContent {
  const info = ENEMIES[enemy.type];
  const stats = ENEMY_CONFIG[enemy.type];
  return {
    title: info.name,
    subtitle: 'Pirate ship',
    text: info.details,
    stats: [
      {
        label: 'Hit points',
        value: `${String(Math.ceil(enemy.hp))} / ${String(Math.round(enemy.maxHp))}`,
        ...(enemy.hp < enemy.maxHp * 0.35 && { tone: 'good' as const }),
      },
      {
        label: 'Damage',
        value: `${formatValue(stats.damage)} × ${formatValue(stats.attacksPerSecond)} / s`,
      },
      { label: 'Speed', value: `${formatValue(stats.speed)} cells / s` },
      { label: 'Bounty', value: `${String(stats.bounty)} ore`, tone: 'good' },
    ],
    color: cssColor(info.color),
  };
}
