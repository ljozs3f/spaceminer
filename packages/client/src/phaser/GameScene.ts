import {
  asteroidCenter,
  BUILDING_TYPES,
  findAsteroidAt,
  findAt,
  findById,
  getBuildingStats,
  validateCommand,
  type AsteroidSize,
  type BuildingLevel,
  type BuildingType,
  type EnemyType,
  type EntityId,
  type TurretType,
} from '@space-miner/sim';
import * as Phaser from 'phaser';
import type { EventBus, GameEvents } from '../events';
import type { GameSession, Point } from '../game/GameSession';
import { BUILDINGS, ENEMIES, rangeOf } from '../game/presentation';
import {
  asteroidSprite,
  BACKGROUND_SPRITE,
  buildingSprite,
  projectileSprite,
  shipSprite,
  SPRITE_URLS,
} from '../game/sprites';
import { Effects } from './Effects';
import { SpriteLayer } from './SpriteLayer';

/** Pixels per grid cell. */
export const CELL_SIZE = 32;

const COLORS = {
  grid: 0x16203a,
  asteroid: 0x8a6a4a,
  asteroidEdge: 0x5a4430,
  crater: 0x6b5038,
  laserShot: 0x9ff0ff,
  missileShot: 0xffa94d,
  valid: 0x5cff8a,
  invalid: 0xff5c5c,
  selection: 0xffffff,
  hpBack: 0x2a1015,
  hpFront: 0x6dff8e,
  pip: 0xffffff,
} as const;

/** Drawing order, back to front. */
const DEPTH = {
  background: 0,
  grid: 1,
  asteroids: 2,
  buildings: 3,
  effects: 4,
  placement: 5,
  projectiles: 6,
  enemies: 7,
  overlay: 10,
} as const;

/** Sprite sizes in cells (sprites are square, with a small margin around the object). */
const SPRITE_SIZE = {
  // upgraded buildings are drawn a little bigger, so the growth shows on the map
  building: { 1: 0.9, 2: 1, 3: 1.12 },
  asteroid: { small: 0.65, medium: 0.95, large: 2 },
  ship: { raider: 0.75, gunship: 1, dreadnought: 1.5 },
  projectile: { laser: 0.45, missile: 0.5 },
} as const satisfies {
  building: Record<BuildingLevel, number>;
  asteroid: Record<AsteroidSize, number>;
  ship: Record<EnemyType, number>;
  projectile: Record<TurretType, number>;
};

/** Radius in cells of the shapes drawn when an asteroid has no sprite (large ones cover 2 × 2 cells). */
const ASTEROID_RADIUS: Readonly<Record<AsteroidSize, number>> = { small: 0.28, medium: 0.42, large: 0.9 };

/** Mined asteroids shrink down to this share of their size. */
const MINED_OUT_SCALE = 0.55;

/** Lasers turn towards their target at this speed (radians per second). */
const TURRET_TURN_SPEED = 9;
/** How long a new building takes to appear (ms). */
const BUILD_MS = 380;

/**
 * Draws the game and turns pointer and keyboard input into bus events. It reads the state through the
 * session and changes it only by sending commands. Objects are drawn with the sprites from game/sprites.ts
 * and with simple shapes where a sprite is missing; bars, selection and effects go on an overlay.
 */
export class GameScene extends Phaser.Scene {
  private overlay!: Phaser.GameObjects.Graphics;
  private layers!: {
    asteroids: SpriteLayer;
    buildings: SpriteLayer;
    projectiles: SpriteLayer;
    enemies: SpriteLayer;
  };
  private placementGhost!: Phaser.GameObjects.Image;
  private placing: BuildingType | null = null;
  private selectedId: EntityId | null = null;
  private hoveredCell: Point | null = null;
  private effects!: Effects;
  /** Where each laser points (radians), turned smoothly towards its target. */
  private readonly turretAngles = new Map<EntityId, number>();
  /** Where each pirate ship last fired: a ship that stands and fires faces its target. */
  private readonly firingAngles = new Map<EntityId, number>();
  /** Buildings seen so far with their level, to notice new and upgraded ones. */
  private readonly knownBuildings = new Map<EntityId, { level: number; builtMs: number }>();
  private frameMs = 0;

  constructor(
    private readonly session: GameSession,
    private readonly bus: EventBus<GameEvents>,
  ) {
    super('game');
  }

  preload(): void {
    for (const [name, url] of SPRITE_URLS) this.load.image(name, url);
  }

  create(): void {
    this.drawBackground();
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.effects = new Effects(this, DEPTH.effects, CELL_SIZE);
    // the starting buildings are already standing
    for (const building of this.session.state.buildings) {
      this.knownBuildings.set(building.id, { level: building.level, builtMs: Number.NEGATIVE_INFINITY });
    }
    this.layers = {
      asteroids: new SpriteLayer(this, DEPTH.asteroids),
      buildings: new SpriteLayer(this, DEPTH.buildings),
      projectiles: new SpriteLayer(this, DEPTH.projectiles),
      enemies: new SpriteLayer(this, DEPTH.enemies),
    };
    this.placementGhost = this.add
      .image(0, 0, '__DEFAULT')
      .setDepth(DEPTH.placement)
      .setAlpha(0.55)
      .setVisible(false);
    this.input.mouse?.disableContextMenu();

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.hoveredCell = this.cellAt(pointer);
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.hoveredCell = null;
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.onKeyDown(event);
    });

    const unsubscribers = [
      this.bus.on('placement:select', (type) => {
        this.placing = type;
        if (type !== null) this.select(null);
      }),
      this.bus.on('sim:events', (events) => {
        this.effects.onEvents(events, this.time.now);
        for (const event of events) {
          if (event.type === 'enemyFired') {
            this.firingAngles.set(
              event.enemyId,
              Math.atan2(event.targetY - event.y, event.targetX - event.x) + Math.PI / 2,
            );
          }
        }
      }),
    ];
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    });
  }

  override update(_time: number, deltaMs: number): void {
    const alpha = this.session.advance(deltaMs);
    this.frameMs = deltaMs;
    this.overlay.clear();
    this.drawAsteroids();
    this.drawBuildings(alpha);
    this.drawEnemies(alpha);
    this.drawProjectiles(alpha);
    this.effects.draw(this.session.state, this.session.playerId, this.time.now);
    this.forgetRemoved();
    this.drawPlacementPreview();
    for (const layer of Object.values(this.layers)) layer.sweep();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      this.bus.emit('placement:select', null);
      this.select(null);
      return;
    }
    const cell = this.cellAt(pointer);
    if (!cell) return;
    if (this.placing !== null) {
      this.bus.emit('command', {
        type: 'placeBuilding',
        playerId: this.session.playerId,
        buildingType: this.placing,
        x: cell.x,
        y: cell.y,
      });
      return;
    }
    const { buildings, asteroids } = this.session.state;
    const building = findAt(buildings, cell.x, cell.y);
    const asteroid = findAsteroidAt(asteroids, cell.x, cell.y);
    if (building?.ownerId === this.session.playerId) this.select(building.id);
    else this.select(asteroid?.id ?? null);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.bus.emit('placement:select', null);
      this.select(null);
      return;
    }
    const type = BUILDING_TYPES[Number(event.key) - 1];
    if (type) this.bus.emit('placement:select', type);
  }

  private select(id: EntityId | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.bus.emit('selection:change', id);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Point | null {
    const x = Math.floor(pointer.worldX / CELL_SIZE);
    const y = Math.floor(pointer.worldY / CELL_SIZE);
    const { width, height } = this.session.state.level;
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }

  /** The background image (scaled to cover the map) and the grid, fainter over the image. */
  private drawBackground(): void {
    const width = this.session.state.level.width * CELL_SIZE;
    const height = this.session.state.level.height * CELL_SIZE;
    const hasImage = SPRITE_URLS.has(BACKGROUND_SPRITE);
    if (hasImage) {
      const image = this.add.image(width / 2, height / 2, BACKGROUND_SPRITE).setDepth(DEPTH.background);
      image.setScale(Math.max(width / image.width, height / image.height));
    }
    const grid = this.add.graphics().setDepth(DEPTH.grid);
    grid.lineStyle(1, COLORS.grid, hasImage ? 0.45 : 1);
    for (let x = 0; x <= this.session.state.level.width; x++)
      grid.lineBetween(x * CELL_SIZE, 0, x * CELL_SIZE, height);
    for (let y = 0; y <= this.session.state.level.height; y++)
      grid.lineBetween(0, y * CELL_SIZE, width, y * CELL_SIZE);
  }

  private drawAsteroids(): void {
    const g = this.overlay;
    for (const asteroid of this.session.state.asteroids) {
      const center = asteroidCenter(asteroid);
      const x = center.x * CELL_SIZE;
      const y = center.y * CELL_SIZE;
      // asteroids shrink as they are mined
      const scale = MINED_OUT_SCALE + (1 - MINED_OUT_SCALE) * (asteroid.ore / asteroid.initialOre);
      const sprite = asteroidSprite(asteroid.size, asteroid.id);
      const fullRadius = sprite
        ? (SPRITE_SIZE.asteroid[asteroid.size] * CELL_SIZE) / 2
        : ASTEROID_RADIUS[asteroid.size] * CELL_SIZE;
      if (sprite) {
        // every asteroid is turned its own way, so the few variants look like many
        const rotation = hash(asteroid.id) * Math.PI * 2;
        this.layers.asteroids.draw(asteroid.id, sprite, x, y, fullRadius * 2 * scale, rotation);
      } else {
        drawAsteroidShape(g, asteroid.id, asteroid.size, x, y, fullRadius * scale);
      }
      if (asteroid.id === this.selectedId) {
        g.lineStyle(2, COLORS.selection, 0.9).strokeCircle(x, y, fullRadius + 3);
      }
    }
  }

  private drawBuildings(alpha: number): void {
    const g = this.overlay;
    const now = this.time.now;
    for (const building of this.session.state.buildings) {
      const { x, y } = cellCenterPx(building);
      const grow = this.buildProgress(building.id, building.level, x, y, BUILDINGS[building.type].color, now);
      const sprite = buildingSprite(building.type, building.level);
      if (sprite) {
        const size = SPRITE_SIZE.building[building.level] * CELL_SIZE * grow;
        const rotation =
          building.type === 'laser' ? this.aim(building.id, building.targetId, x, y, alpha) : 0;
        this.layers.buildings.draw(building.id, sprite, x, y, size, rotation);
      } else drawBuildingShape(g, building.type, x, y, 1);

      // level pips
      g.fillStyle(0x000000, 0.55).fillRoundedRect(x - 10, y + CELL_SIZE * 0.36 - 3.5, 20, 7, 3);
      g.fillStyle(COLORS.pip, 0.95);
      for (let i = 0; i < building.level; i++) g.fillCircle(x - 6 + i * 6, y + CELL_SIZE * 0.36, 2);

      const { maxHp } = getBuildingStats(building.type, building.level);
      if (building.hp < maxHp) drawHpBar(g, x, y - CELL_SIZE * 0.5, building.hp / maxHp);

      if (building.id === this.selectedId) {
        g.lineStyle(2, COLORS.selection, 0.9).strokeRect(
          x - CELL_SIZE / 2 + 1,
          y - CELL_SIZE / 2 + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2,
        );
        const range = rangeOf(building.type, building.level);
        if (range !== undefined) g.lineStyle(1, COLORS.selection, 0.35).strokeCircle(x, y, range * CELL_SIZE);
      }
    }
  }

  private drawEnemies(alpha: number): void {
    const g = this.overlay;
    for (const enemy of this.session.state.enemies) {
      const { x, y } = this.interpolate(enemy, alpha);
      const sprite = shipSprite(enemy.type);
      let halfHeight: number;
      if (sprite) {
        const size = SPRITE_SIZE.ship[enemy.type] * CELL_SIZE;
        this.layers.enemies.draw(
          enemy.id,
          sprite,
          x,
          y,
          size,
          this.heading(enemy) ?? this.firingAngles.get(enemy.id) ?? null,
        );
        halfHeight = size * 0.4;
      } else {
        halfHeight = drawShipShape(g, enemy.type, x, y);
      }
      if (enemy.hp < enemy.maxHp) drawHpBar(g, x, y - halfHeight - 5, enemy.hp / enemy.maxHp);
    }
  }

  private drawProjectiles(alpha: number): void {
    const g = this.overlay;
    for (const projectile of this.session.state.projectiles) {
      const { x, y } = this.interpolate(projectile, alpha);
      const sprite = projectileSprite(projectile.type);
      if (sprite) {
        const size = SPRITE_SIZE.projectile[projectile.type] * CELL_SIZE;
        this.layers.projectiles.draw(projectile.id, sprite, x, y, size, this.heading(projectile));
      } else if (projectile.type === 'laser') {
        g.fillStyle(COLORS.laserShot, 1).fillCircle(x, y, 2.5);
      } else {
        g.fillStyle(COLORS.missileShot, 1).fillCircle(x, y, 4);
      }
    }
  }

  /**
   * Scale of a building while it appears: new buildings grow in with a ring of light, upgraded ones get a
   * ring too. Returns 1 once it stands.
   */
  private buildProgress(
    id: EntityId,
    level: number,
    x: number,
    y: number,
    color: number,
    now: number,
  ): number {
    const known = this.knownBuildings.get(id);
    if (known?.level !== level) {
      this.knownBuildings.set(id, { level, builtMs: known ? known.builtMs : now });
      this.effects.addBuildRing(x, y, color, now, known !== undefined);
    }
    const progress = Math.min(1, (now - (this.knownBuildings.get(id)?.builtMs ?? now)) / BUILD_MS);
    return easeOutBack(progress);
  }

  /** Drops what the scene remembers about buildings and ships that are gone. */
  private forgetRemoved(): void {
    const { buildings, enemies } = this.session.state;
    if (this.firingAngles.size > enemies.length + 50) {
      const alive = new Set(enemies.map((enemy) => enemy.id));
      for (const id of this.firingAngles.keys()) if (!alive.has(id)) this.firingAngles.delete(id);
    }
    if (this.knownBuildings.size > buildings.length + 50) {
      const standing = new Set(buildings.map((building) => building.id));
      for (const id of this.knownBuildings.keys()) {
        if (standing.has(id)) continue;
        this.knownBuildings.delete(id);
        this.turretAngles.delete(id);
      }
    }
  }

  /** Rotation of a laser: turned smoothly towards where its target is, kept when it has none. */
  private aim(id: EntityId, targetId: EntityId | null, x: number, y: number, alpha: number): number {
    const current = this.turretAngles.get(id) ?? 0;
    const target = targetId === null ? undefined : findById(this.session.state.enemies, targetId);
    if (!target) return current;
    const at = this.interpolate(target, alpha);
    const wanted = Math.atan2(at.y - y, at.x - x) + Math.PI / 2;
    const difference = Phaser.Math.Angle.Wrap(wanted - current);
    const maxTurn = (TURRET_TURN_SPEED * this.frameMs) / 1000;
    const angle = current + Math.max(-maxTurn, Math.min(maxTurn, difference));
    this.turretAngles.set(id, angle);
    return angle;
  }

  private drawPlacementPreview(): void {
    this.placementGhost.setVisible(false);
    if (this.placing === null || this.hoveredCell === null) return;
    const g = this.overlay;
    const { x: cellX, y: cellY } = this.hoveredCell;
    const valid =
      validateCommand(this.session.state, {
        type: 'placeBuilding',
        playerId: this.session.playerId,
        buildingType: this.placing,
        x: cellX,
        y: cellY,
      }) === null;
    const color = valid ? COLORS.valid : COLORS.invalid;
    const { x, y } = cellCenterPx(this.hoveredCell);

    const sprite = buildingSprite(this.placing, 1);
    if (sprite) {
      const size = SPRITE_SIZE.building[1] * CELL_SIZE;
      this.placementGhost.setTexture(sprite).setPosition(x, y).setDisplaySize(size, size).setVisible(true);
    } else {
      drawBuildingShape(g, this.placing, x, y, 0.5);
    }
    g.lineStyle(2, color, 0.9).strokeRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    const range = rangeOf(this.placing, 1);
    if (range !== undefined) {
      g.fillStyle(color, 0.08).fillCircle(x, y, range * CELL_SIZE);
      g.lineStyle(1, color, 0.6).strokeCircle(x, y, range * CELL_SIZE);
    }
  }

  /** Pixel position of a moving object between the previous and the current tick. */
  private interpolate(
    object: { readonly id: EntityId; readonly x: number; readonly y: number },
    alpha: number,
  ): Point {
    const previous = this.session.previousPosition(object.id) ?? object;
    return {
      x: (previous.x + (object.x - previous.x) * alpha) * CELL_SIZE,
      y: (previous.y + (object.y - previous.y) * alpha) * CELL_SIZE,
    };
  }

  /** Rotation that turns an up-pointing sprite towards where the object moves; null while it stands still. */
  private heading(object: { readonly id: EntityId; readonly x: number; readonly y: number }): number | null {
    const previous = this.session.previousPosition(object.id);
    if (!previous) return null;
    const dx = object.x - previous.x;
    const dy = object.y - previous.y;
    if (dx * dx + dy * dy < 1e-8) return null;
    return Math.atan2(dy, dx) + Math.PI / 2;
  }
}

function cellCenterPx(cell: Point): Point {
  return { x: (cell.x + 0.5) * CELL_SIZE, y: (cell.y + 0.5) * CELL_SIZE };
}

function drawBuildingShape(
  g: Phaser.GameObjects.Graphics,
  type: BuildingType,
  x: number,
  y: number,
  alpha: number,
): void {
  const size = CELL_SIZE * 0.8;
  const half = size / 2;
  g.fillStyle(BUILDINGS[type].color, alpha).fillRoundedRect(x - half, y - half, size, size, 5);
  g.fillStyle(0x0b1020, alpha * 0.85);
  switch (type) {
    case 'mine':
      g.fillTriangle(x, y - half * 0.6, x + half * 0.5, y + half * 0.3, x - half * 0.5, y + half * 0.3);
      break;
    case 'solar':
      g.fillRect(x - half * 0.6, y - half * 0.6, half * 0.5, half * 0.5);
      g.fillRect(x + half * 0.1, y - half * 0.6, half * 0.5, half * 0.5);
      g.fillRect(x - half * 0.6, y - half * 0.05, half * 0.5, half * 0.5);
      g.fillRect(x + half * 0.1, y - half * 0.05, half * 0.5, half * 0.5);
      break;
    case 'laser':
      g.fillCircle(x, y - half * 0.1, half * 0.35);
      break;
    case 'missile':
      g.fillRect(x - half * 0.5, y - half * 0.55, half * 0.35, half * 0.9);
      g.fillRect(x + half * 0.15, y - half * 0.55, half * 0.35, half * 0.9);
      break;
  }
}

/** Returns the half height of the shape, for placing the hit point bar. */
function drawShipShape(g: Phaser.GameObjects.Graphics, type: EnemyType, x: number, y: number): number {
  const { color, size } = ENEMIES[type];
  const r = CELL_SIZE * size;
  g.fillStyle(color, 1);
  switch (type) {
    case 'raider':
      g.fillTriangle(x, y - r, x + r, y + r, x - r, y + r);
      break;
    case 'gunship':
      g.fillTriangle(x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8);
      g.fillRect(x - r * 0.25, y - r * 0.2, r * 0.5, r);
      break;
    case 'dreadnought':
      g.fillRoundedRect(x - r, y - r * 0.7, r * 2, r * 1.4, r * 0.35);
      g.fillStyle(0x0b1020, 0.6).fillRect(x - r * 0.6, y - r * 0.15, r * 1.2, r * 0.3);
      break;
  }
  return r;
}

function drawAsteroidShape(
  g: Phaser.GameObjects.Graphics,
  id: EntityId,
  size: AsteroidSize,
  x: number,
  y: number,
  radius: number,
): void {
  g.fillStyle(COLORS.asteroid, 1).fillCircle(x, y, radius);
  g.lineStyle(2, COLORS.asteroidEdge, 1).strokeCircle(x, y, radius);
  g.fillStyle(COLORS.crater, 1);
  const count = { small: 1, medium: 2, large: 4 }[size];
  for (let i = 0; i < count; i++) {
    const angle = hash(id * 7 + i) * Math.PI * 2;
    const distance = (0.2 + 0.4 * hash(id * 13 + i)) * radius;
    g.fillCircle(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      (0.12 + 0.12 * hash(id * 17 + i)) * radius,
    );
  }
}

/** 0 to 1 with a small overshoot at the end, for things that pop into place. */
function easeOutBack(t: number): number {
  const c = 1.7;
  return t >= 1 ? 1 : 0.4 + 0.6 * (1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2);
}

/** A number in [0, 1) that depends only on n: stable looks for every entity, frame after frame. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawHpBar(g: Phaser.GameObjects.Graphics, centerX: number, top: number, fraction: number): void {
  const width = CELL_SIZE * 0.8;
  g.fillStyle(COLORS.hpBack, 1).fillRect(centerX - width / 2, top, width, 3);
  g.fillStyle(COLORS.hpFront, 1).fillRect(centerX - width / 2, top, width * Math.max(0, fraction), 3);
}
