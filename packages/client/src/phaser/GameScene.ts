import {
  asteroidCenter,
  BUILDING_TYPES,
  findAsteroidAt,
  findAt,
  findById,
  getBuildingStats,
  isUltraInstinctActive,
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
  DRONE_SPRITE,
  projectileSprite,
  shipSprite,
  SPRITE_URLS,
} from '../game/sprites';
import { asteroidColor, asteroidMotion, hash, mixColors } from './asteroidLook';
import { Backdrop, GLOW_TEXTURE } from './Backdrop';
import { CameraController } from './CameraController';
import { Effects, type DroneVisual } from './Effects';
import { createMineRig, partMotion, type MineRig } from './mineRig';
import { SpriteLayer } from './SpriteLayer';

/** Pixels per grid cell. */
export const CELL_SIZE = 32;

const COLORS = {
  grid: 0x16203a,
  asteroidEdge: 0x2a2420,
  laserShot: 0x9ff0ff,
  missileShot: 0xffa94d,
  valid: 0x5cff8a,
  invalid: 0xff5c5c,
  selection: 0xffffff,
  hpBack: 0x2a1015,
  hpFront: 0x6dff8e,
  /** The hit point bar of a building that drones are repairing. */
  hpRepair: 0x4cf2c4,
  pip: 0xffffff,
  /** Ultra Instinct: the silver-blue aura around the buildings and its brighter sparks. */
  aura: 0x9fd4ff,
  auraCore: 0xeef8ff,
} as const;

/** Drawing order, back to front. */
const DEPTH = {
  background: 0,
  nebula: 0.5,
  stars: 0.8,
  grid: 1,
  asteroidGlow: 1.5,
  asteroids: 2,
  asteroidShine: 2.1,
  buildings: 3,
  buildingParts: 3.05,
  effects: 4,
  placement: 5,
  projectiles: 6,
  drones: 6.5,
  enemies: 7,
  overlay: 10,
} as const;

/** Parallax: the background and the stars move less than the map when the view pans. */
const SCROLL_FACTOR = { background: 0.85 } as const;

/** Sprite sizes in cells (sprites are square, with a small margin around the object). */
const SPRITE_SIZE = {
  // upgraded buildings are drawn a little bigger, so the growth shows on the map
  building: { 1: 0.9, 2: 1, 3: 1.12 },
  asteroid: { small: 0.65, medium: 0.95, large: 2 },
  ship: { raider: 0.75, gunship: 1, dreadnought: 1.5 },
  projectile: { laser: 0.45, missile: 0.5 },
  drone: { flying: 0.36, docked: 0.27 },
} as const satisfies {
  building: Record<BuildingLevel, number>;
  asteroid: Record<AsteroidSize, number>;
  ship: Record<EnemyType, number>;
  projectile: Record<TurretType, number>;
  drone: Record<'flying' | 'docked', number>;
};

/** Radius in cells of the shapes drawn when an asteroid has no sprite (large ones cover 2 × 2 cells). */
const ASTEROID_RADIUS: Readonly<Record<AsteroidSize, number>> = { small: 0.28, medium: 0.42, large: 0.9 };

/** Size of an asteroid's ore glow, relative to the asteroid. */
const ASTEROID_GLOW_SCALE = 1.9;

/** Lasers turn towards their target at this speed (radians per second). */
const TURRET_TURN_SPEED = 9;
/** How long a new building takes to appear (ms). */
const BUILD_MS = 380;
/** A press that moves further than this (screen pixels) is a drag that pans the map, not a click. */
const DRAG_PX = 6;
/** How fast a mine's arms start and stop working (per second). */
const MINE_WORK_EASE = 3;
/** Keys that pan the map. */
const PAN_KEYS: Readonly<Record<string, string>> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
};

/**
 * Draws the game and turns pointer and keyboard input into bus events. It reads the state through the
 * session and changes it only by sending commands. Objects are drawn with the sprites from game/sprites.ts
 * and with simple shapes where a sprite is missing; bars, selection and effects go on an overlay.
 */
export class GameScene extends Phaser.Scene {
  private overlay!: Phaser.GameObjects.Graphics;
  private layers!: {
    asteroidGlow: SpriteLayer;
    asteroids: SpriteLayer;
    asteroidShine: SpriteLayer;
    buildings: SpriteLayer;
    projectiles: SpriteLayer;
    drones: SpriteLayer;
    enemies: SpriteLayer;
  };
  /** The moving parts of the mines, one layer per part (two arms, the level 3 bottom drill). */
  private partLayers: SpriteLayer[] = [];
  private readonly mineRigs = new Map<BuildingLevel, MineRig>();
  /** How hard each mine is working, 0 to 1, eased so the arms start and stop smoothly. */
  private readonly mineWork = new Map<EntityId, number>();
  private camera!: CameraController;
  private grid!: Phaser.GameObjects.Graphics;
  private gridZoom = 0;
  /** The press in progress: where it started and whether it has become a drag. */
  private press: {
    button: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
  } | null = null;
  private pointerInside = false;
  private placementGhost!: Phaser.GameObjects.Image;
  private placing: BuildingType | null = null;
  private selectedId: EntityId | null = null;
  private hoveredCell: Point | null = null;
  private effects!: Effects;
  private backdrop!: Backdrop;
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
    const { level, seed } = this.session.state;
    this.camera = new CameraController(this.cameras.main, level.width * CELL_SIZE, level.height * CELL_SIZE);
    this.drawBackground();
    this.backdrop = new Backdrop(
      this,
      level.width * CELL_SIZE,
      level.height * CELL_SIZE,
      level.asteroidFields,
      CELL_SIZE,
      { nebula: DEPTH.nebula, stars: DEPTH.stars },
      seed,
    );
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.effects = new Effects(this, DEPTH.effects, CELL_SIZE);
    // the starting buildings are already standing
    for (const building of this.session.state.buildings) {
      this.knownBuildings.set(building.id, { level: building.level, builtMs: Number.NEGATIVE_INFINITY });
    }
    this.layers = {
      asteroidGlow: new SpriteLayer(this, DEPTH.asteroidGlow, Phaser.BlendModes.ADD),
      asteroids: new SpriteLayer(this, DEPTH.asteroids),
      asteroidShine: new SpriteLayer(this, DEPTH.asteroidShine, Phaser.BlendModes.ADD),
      buildings: new SpriteLayer(this, DEPTH.buildings),
      projectiles: new SpriteLayer(this, DEPTH.projectiles),
      drones: new SpriteLayer(this, DEPTH.drones),
      enemies: new SpriteLayer(this, DEPTH.enemies),
    };
    // the mines' moving parts, cut from the level sprites they were measured on
    for (const mineLevel of [1, 2, 3] as const) {
      const sprite = buildingSprite('mine', mineLevel);
      const rig =
        sprite === `building-mine-${String(mineLevel)}` ? createMineRig(this, sprite, mineLevel) : undefined;
      if (rig) this.mineRigs.set(mineLevel, rig);
    }
    const parts = Math.max(0, ...[...this.mineRigs.values()].map((rig) => rig.parts.length));
    this.partLayers = Array.from({ length: parts }, () => new SpriteLayer(this, DEPTH.buildingParts));
    this.placementGhost = this.add
      .image(0, 0, '__DEFAULT')
      .setDepth(DEPTH.placement)
      .setAlpha(0.55)
      .setVisible(false);
    this.input.mouse?.disableContextMenu();

    // the pointer may already be over the map when the game starts, before any "game over" (pointer in) event
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointerInside = true;
      this.onPointerMove(pointer);
    });
    this.input.on(Phaser.Input.Events.GAME_OVER, () => {
      this.pointerInside = true;
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointerInside = false;
      this.hoveredCell = null;
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.press = {
        button: pointer.button,
        x: pointer.x,
        y: pointer.y,
        lastX: pointer.x,
        lastY: pointer.y,
        dragging: false,
      };
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.onPointerUp(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.press = null;
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        // a mouse wheel notch is about 100; trackpads send many small steps
        this.camera.zoomBy(Math.max(-2, Math.min(2, -dy / 100)), pointer.x, pointer.y);
      },
    );
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.onKeyDown(event);
    });
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
      const direction = PAN_KEYS[event.key.toLowerCase()];
      if (direction) this.camera.hold(direction, false);
    });
    // a window that loses the focus never sees the keys go up
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      for (const direction of new Set(Object.values(PAN_KEYS))) this.camera.hold(direction, false);
    });

    const unsubscribers = [
      this.bus.on('placement:select', (type) => {
        this.placing = type;
        if (type !== null) this.select(null);
      }),
      // the UI can clear the selection too (the popup's close button)
      this.bus.on('selection:change', (id) => {
        this.selectedId = id;
      }),
      // Ultra Instinct flares up: a silver-blue flash and a jolt
      this.bus.on('command:applied', (command) => {
        if (command.type !== 'ultraInstinct') return;
        this.cameras.main.flash(420, 200, 230, 255);
        this.cameras.main.shake(260, 0.005);
      }),
      this.bus.on('view:zoom', (action) => {
        if (action === 'reset') this.camera.reset();
        else this.camera.zoomBy(action === 'in' ? 1 : -1);
      }),
      this.bus.on('sim:events', (events) => {
        this.effects.onEvents(events, this.time.now);
        for (const event of events) {
          if (event.type === 'waveStarted') this.onWaveStarted();
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
    this.bus.emit('view:change', this.camera.view);
  }

  override update(_time: number, deltaMs: number): void {
    const alpha = this.session.advance(deltaMs);
    this.frameMs = deltaMs;
    if (this.camera.update(deltaMs)) {
      this.bus.emit('view:change', this.camera.view);
      if (this.camera.view.zoom !== this.gridZoom) this.drawGrid();
    }
    const pointer = this.input.activePointer;
    this.hoveredCell = this.pointerInside ? this.cellAt(pointer) : null;
    this.overlay.clear();
    this.backdrop.update(this.time.now);
    this.drawAsteroids();
    this.drawBuildings(alpha);
    this.drawEnemies(alpha);
    this.drawProjectiles(alpha);
    this.effects.draw(this.session.state, this.session.playerId, this.time.now);
    this.effects.drawDrones(this.drawDrones(alpha), this.time.now);
    this.forgetRemoved();
    this.drawPlacementPreview();
    for (const layer of [...Object.values(this.layers), ...this.partLayers]) layer.sweep();
  }

  /** A press that moves far enough pans the map (with any button); hovering updates the placement preview. */
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (!press || !pointer.isDown) return;
    if (!press.dragging && Math.hypot(pointer.x - press.x, pointer.y - press.y) > DRAG_PX)
      press.dragging = true;
    if (press.dragging) this.camera.drag(pointer.x - press.lastX, pointer.y - press.lastY);
    press.lastX = pointer.x;
    press.lastY = pointer.y;
  }

  /** A click (a press that did not drag): the left button builds or selects, the right one cancels. */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    this.press = null;
    if (!press || press.dragging) return;
    if (press.button === 2) {
      this.bus.emit('placement:select', null);
      this.select(null);
      return;
    }
    if (press.button !== 0) return;
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
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'escape') {
      this.bus.emit('placement:select', null);
      this.select(null);
      return;
    }
    const direction = PAN_KEYS[key];
    if (direction) {
      this.camera.hold(direction, true);
      return;
    }
    if (key === '+' || key === '=') this.camera.zoomBy(1);
    else if (key === '-') this.camera.zoomBy(-1);
    else if (key === '0') this.camera.reset();
    const type = BUILDING_TYPES[Number(event.key) - 1];
    if (type) this.bus.emit('placement:select', type);
  }

  /** The new ships are on the map edges: mark where they come in, and the view shudders. */
  private onWaveStarted(): void {
    const { enemies, level } = this.session.state;
    for (const enemy of enemies) {
      const toEdge = Math.min(enemy.x, enemy.y, level.width - enemy.x, level.height - enemy.y);
      if (toEdge < 0.5) this.effects.addIncoming(enemy.x, enemy.y, level.width, level.height, this.time.now);
    }
    this.cameras.main.shake(280, 0.004);
  }

  private select(id: EntityId | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.bus.emit('selection:change', id);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Point | null {
    const world = this.camera.toWorld(pointer.x, pointer.y);
    const x = Math.floor(world.x / CELL_SIZE);
    const y = Math.floor(world.y / CELL_SIZE);
    const { width, height } = this.session.state.level;
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }

  /** The background image (scaled to cover the map, with a little parallax) and the grid. */
  private drawBackground(): void {
    const width = this.session.state.level.width * CELL_SIZE;
    const height = this.session.state.level.height * CELL_SIZE;
    if (SPRITE_URLS.has(BACKGROUND_SPRITE)) {
      const image = this.add
        .image(width / 2, height / 2, BACKGROUND_SPRITE)
        .setDepth(DEPTH.background)
        .setScrollFactor(SCROLL_FACTOR.background);
      image.setScale(Math.max(width / image.width, height / image.height));
    }
    this.grid = this.add.graphics().setDepth(DEPTH.grid);
    this.drawGrid();
  }

  /** The grid lines stay one screen pixel thin at every zoom. */
  private drawGrid(): void {
    const { width, height } = this.session.state.level;
    const { zoom } = this.camera.view;
    this.gridZoom = zoom;
    const grid = this.grid.clear();
    grid.lineStyle(1 / zoom, COLORS.grid, SPRITE_URLS.has(BACKGROUND_SPRITE) ? 0.45 : 1);
    for (let x = 0; x <= width; x++) grid.lineBetween(x * CELL_SIZE, 0, x * CELL_SIZE, height * CELL_SIZE);
    for (let y = 0; y <= height; y++) grid.lineBetween(0, y * CELL_SIZE, width * CELL_SIZE, y * CELL_SIZE);
  }

  /**
   * Asteroids drift and spin a little (asteroidLook.ts). Their ore color shows how much is left: a rich
   * asteroid glows in its color, a mined one fades to grey; the size stays the same.
   */
  private drawAsteroids(): void {
    const g = this.overlay;
    const now = this.time.now;
    for (const asteroid of this.session.state.asteroids) {
      const center = asteroidCenter(asteroid);
      const motion = asteroidMotion(asteroid.id, asteroid.size, now);
      const x = center.x * CELL_SIZE + motion.dx;
      const y = center.y * CELL_SIZE + motion.dy;
      const color = asteroidColor(asteroid.id, asteroid.ore / asteroid.initialOre);
      const sprite = asteroidSprite(asteroid.size, asteroid.id);
      const radius = sprite
        ? (SPRITE_SIZE.asteroid[asteroid.size] * CELL_SIZE) / 2
        : ASTEROID_RADIUS[asteroid.size] * CELL_SIZE;
      const pulse = 0.85 + 0.15 * Math.sin(now / 900 + hash(asteroid.id) * 6.3);
      if (color.glow > 0.01) {
        this.layers.asteroidGlow
          .draw(asteroid.id, GLOW_TEXTURE, x, y, radius * 2 * ASTEROID_GLOW_SCALE, null)
          .setTint(color.ore)
          .setAlpha(0.32 * color.glow * pulse);
      }
      if (sprite) {
        this.layers.asteroids
          .draw(asteroid.id, sprite, x, y, radius * 2, motion.rotation)
          .setTint(color.tint)
          .setAlpha(color.alpha);
        // the ore shines through the rock: the same sprite once more, added in the ore color
        if (color.glow > 0.01) {
          this.layers.asteroidShine
            .draw(asteroid.id, sprite, x, y, radius * 2, motion.rotation)
            .setTint(color.ore)
            .setAlpha(0.4 * color.glow * pulse);
        }
      } else {
        drawAsteroidShape(g, asteroid.id, asteroid.size, x, y, radius, color.tint, color.alpha);
      }
      if (asteroid.id === this.selectedId) {
        g.lineStyle(2, COLORS.selection, 0.9).strokeCircle(x, y, radius + 3);
      }
    }
  }

  private drawBuildings(alpha: number): void {
    const g = this.overlay;
    const now = this.time.now;
    const { state } = this.session;
    const boosted = new Set(
      state.players.filter((player) => isUltraInstinctActive(state, player)).map((player) => player.id),
    );
    const repairing = new Set(
      this.session.state.drones.flatMap((drone) =>
        drone.repairing && drone.targetId !== null ? [drone.targetId] : [],
      ),
    );
    for (const building of this.session.state.buildings) {
      const { x, y } = cellCenterPx(building);
      const grow = this.buildProgress(building.id, building.level, x, y, BUILDINGS[building.type].color, now);
      const sprite = buildingSprite(building.type, building.level);
      const rig = building.type === 'mine' ? this.mineRigs.get(building.level) : undefined;
      if (sprite) {
        const size = SPRITE_SIZE.building[building.level] * CELL_SIZE * grow;
        const rotation =
          building.type === 'laser' ? this.aim(building.id, building.targetId, x, y, alpha) : 0;
        this.layers.buildings.draw(building.id, rig?.body ?? sprite, x, y, size, rotation);
        if (rig) this.drawMineParts(building.id, building.targetId !== null, rig, x, y, size);
      } else drawBuildingShape(g, building.type, x, y, 1);
      if (boosted.has(building.ownerId)) this.drawAura(building.id, x, y, now);

      // level pips
      g.fillStyle(0x000000, 0.55).fillRoundedRect(x - 10, y + CELL_SIZE * 0.36 - 3.5, 20, 7, 3);
      g.fillStyle(COLORS.pip, 0.95);
      for (let i = 0; i < building.level; i++) g.fillCircle(x - 6 + i * 6, y + CELL_SIZE * 0.36, 2);

      const { maxHp } = getBuildingStats(building.type, building.level);
      if (building.hp < maxHp) {
        drawHpBar(
          g,
          x,
          y - CELL_SIZE * 0.5,
          building.hp / maxHp,
          repairing.has(building.id) ? COLORS.hpRepair : COLORS.hpFront,
        );
      }

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

  /** Ultra Instinct: a silver-blue aura flickers around the building, and sparks of it rise. */
  private drawAura(id: EntityId, x: number, y: number, now: number): void {
    const g = this.overlay;
    const seconds = now / 1000;
    const phase = hash(id) * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(seconds * 7 + phase);
    const radius = CELL_SIZE * (0.5 + 0.06 * pulse);
    g.fillStyle(COLORS.aura, 0.06 + 0.05 * pulse).fillCircle(x, y, radius + 3);
    g.lineStyle(2, COLORS.aura, 0.35 + 0.35 * pulse).strokeCircle(x, y, radius);
    g.lineStyle(1, COLORS.auraCore, 0.55 * (1 - pulse)).strokeCircle(x, y, radius * 0.84);
    const sparks = 4;
    for (let i = 0; i < sparks; i++) {
      const rise = (seconds * 0.9 + i / sparks + hash(id + i)) % 1;
      const angle = phase + i * 1.7;
      const sparkX = x + Math.cos(angle) * CELL_SIZE * 0.34;
      const sparkY = y + CELL_SIZE * 0.35 - rise * CELL_SIZE * 0.95;
      g.fillStyle(COLORS.auraCore, 0.85 * (1 - rise)).fillCircle(sparkX, sparkY, 0.6 + 1.6 * (1 - rise));
    }
  }

  /**
   * The arms of a mine dig while it mines (and the level 3 bottom drill pumps), easing in and out. They are
   * drawn over the body, each turned around its joint.
   */
  private drawMineParts(
    id: EntityId,
    working: boolean,
    rig: MineRig,
    x: number,
    y: number,
    size: number,
  ): void {
    const current = this.mineWork.get(id) ?? 0;
    const step = Math.min(1, (this.frameMs / 1000) * MINE_WORK_EASE);
    const work = current + ((working ? 1 : 0) - current) * step;
    this.mineWork.set(id, work < 0.001 ? 0 : work);
    const seconds = this.time.now / 1000;
    const phase = hash(id) * Math.PI * 2;
    rig.parts.forEach((part, index) => {
      const motion = partMotion(part, work, seconds, phase);
      const px = x + (part.originX - 0.5) * size;
      const py = y + (part.originY - 0.5) * size + (part.motion === 'pump' ? (motion / 128) * size : 0);
      this.partLayers[index]
        ?.draw(id, part.texture, px, py, size, part.motion === 'swing' ? motion : 0)
        .setOrigin(part.originX, part.originY);
    });
  }

  /**
   * Repair drones: docked ones rest on their hive, the others hover a little while they fly and work. Returns
   * where each one is drawn, for the effects (welding beams, sparks, thrusters).
   */
  private drawDrones(alpha: number): DroneVisual[] {
    const now = this.time.now;
    const visuals: DroneVisual[] = [];
    for (const drone of this.session.state.drones) {
      const at = this.interpolate(drone, alpha);
      const heading = this.heading(drone);
      const target =
        drone.targetId === null ? undefined : findById(this.session.state.buildings, drone.targetId);
      const docked = !target && heading === null;
      const bob = docked ? 0 : Math.sin(now / 260 + drone.id) * 1.3;
      const sway = drone.repairing ? Math.cos(now / 170 + drone.id * 2) * 1 : 0;
      const x = at.x + sway;
      const y = at.y + bob;
      let rotation: number | null = heading;
      if (docked) rotation = Math.PI / 2 + (drone.slot * Math.PI * 2) / 3 + Math.PI / 2;
      else if (drone.repairing && target) {
        const center = cellCenterPx(target);
        rotation = Math.atan2(center.y - y, center.x - x) + Math.PI / 2;
      }
      const size = (docked ? SPRITE_SIZE.drone.docked : SPRITE_SIZE.drone.flying) * CELL_SIZE;
      if (SPRITE_URLS.has(DRONE_SPRITE))
        this.layers.drones.draw(drone.id, DRONE_SPRITE, x, y, size, rotation);
      else this.overlay.fillStyle(COLORS.hpRepair, 1).fillCircle(x, y, size / 3);
      visuals.push({
        id: drone.id,
        x,
        y,
        state: docked ? 'docked' : drone.repairing ? 'repairing' : 'flying',
        heading: rotation,
        target: target ? cellCenterPx(target) : null,
      });
    }
    return visuals;
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
        this.mineWork.delete(id);
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
    case 'repair':
      g.fillRect(x - half * 0.15, y - half * 0.55, half * 0.3, half * 1.1);
      g.fillRect(x - half * 0.55, y - half * 0.15, half * 1.1, half * 0.3);
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
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha).fillCircle(x, y, radius);
  g.lineStyle(2, COLORS.asteroidEdge, alpha).strokeCircle(x, y, radius);
  g.fillStyle(mixColors(color, 0x000000, 0.25), alpha);
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

function drawHpBar(
  g: Phaser.GameObjects.Graphics,
  centerX: number,
  top: number,
  fraction: number,
  color: number = COLORS.hpFront,
): void {
  const width = CELL_SIZE * 0.8;
  g.fillStyle(COLORS.hpBack, 1).fillRect(centerX - width / 2, top, width, 3);
  g.fillStyle(color, 1).fillRect(centerX - width / 2, top, width * Math.max(0, fraction), 3);
}
