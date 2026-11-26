import type { AsteroidFieldConfig } from '@space-miner/sim';
import * as Phaser from 'phaser';

/**
 * The living part of the background, drawn over the background image: a soft nebula behind every asteroid
 * field, two layers of twinkling stars drifting slowly at different speeds, a few bright stars with a glint,
 * and now and then a shooting star. Textures are painted on canvases at start, so no image files are
 * needed. Positions are in pixels.
 */

export const GLOW_TEXTURE = 'fx-glow';
const STAR_TEXTURE = 'fx-star';
const GLINT_TEXTURE = 'fx-glint';

const STAR_TINTS = [0xffffff, 0xffffff, 0xd6e4ff, 0xb5cdff, 0xffe9cc, 0xe6d6ff] as const;

interface StarLayerConfig {
  readonly count: number;
  /** Parallax: how much the layer follows the view when it pans (1: like the map). */
  readonly scrollFactor: number;
  readonly scale: readonly [min: number, max: number];
  readonly alpha: readonly [min: number, max: number];
  /** Drift in pixels per second. */
  readonly speed: number;
}

const FAR_STARS: StarLayerConfig = {
  count: 150,
  scrollFactor: 0.35,
  scale: [0.1, 0.22],
  alpha: [0.25, 0.6],
  speed: 1.6,
};
const NEAR_STARS: StarLayerConfig = {
  count: 55,
  scrollFactor: 0.6,
  scale: [0.2, 0.38],
  alpha: [0.45, 0.9],
  speed: 4.2,
};
const GLINTS = 7;
/** Direction the stars drift in (normalized below). */
const DRIFT = { x: -1, y: 0.22 } as const;

/** Nebula colors (r, g, b): cool tones behind the warm asteroids. */
const NEBULA_PALETTES: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [40, 190, 220],
    [70, 100, 255],
  ],
  [
    [150, 80, 255],
    [225, 70, 190],
  ],
  [
    [80, 110, 255],
    [160, 80, 255],
  ],
  [
    [40, 200, 190],
    [140, 90, 255],
  ],
];

interface Star {
  readonly image: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly alpha: number;
  readonly twinkle: number;
  readonly phase: number;
}

interface Cloud {
  readonly image: Phaser.GameObjects.Image;
  readonly phase: number;
  readonly spin: number;
}

interface ShootingStar {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly length: number;
}

export class Backdrop {
  private readonly stars: Star[] = [];
  private readonly clouds: Cloud[] = [];
  private readonly streaks: Phaser.GameObjects.Graphics;
  private shootingStar: ShootingStar | null = null;
  private nextShootingStarMs: number;
  private readonly random: () => number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    fields: readonly AsteroidFieldConfig[],
    cellSize: number,
    depth: { readonly nebula: number; readonly stars: number },
    seed: number,
  ) {
    this.random = mulberry32(seed);
    createTextures(scene);
    fields.forEach((field, index) => {
      this.addNebula(field, index, cellSize, depth.nebula);
    });
    this.addStars(FAR_STARS, depth.stars);
    this.addStars(NEAR_STARS, depth.stars);
    this.addGlints(depth.stars);
    this.streaks = scene.add
      .graphics()
      .setDepth(depth.stars)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(FAR_STARS.scrollFactor);
    this.nextShootingStarMs = 3000 + this.random() * 5000;
  }

  update(nowMs: number): void {
    const seconds = nowMs / 1000;
    const driftLength = Math.hypot(DRIFT.x, DRIFT.y);
    for (const star of this.stars) {
      const travelled = star.speed * seconds;
      const x = wrap(star.x + (DRIFT.x / driftLength) * travelled, this.width);
      const y = wrap(star.y + (DRIFT.y / driftLength) * travelled, this.height);
      const shimmer = 0.5 + 0.5 * Math.sin(seconds * star.twinkle + star.phase);
      star.image.setPosition(x, y).setAlpha(star.alpha * (0.45 + 0.55 * shimmer));
    }
    for (const cloud of this.clouds) {
      // the nebulae breathe and turn, very slowly
      cloud.image.setAlpha(0.75 + 0.15 * Math.sin(seconds * 0.25 + cloud.phase));
      cloud.image.setRotation(cloud.phase + seconds * cloud.spin);
    }
    this.drawShootingStar(nowMs);
  }

  /** A cloud of soft, overlapping color blobs and wisps behind an asteroid field. */
  private addNebula(field: AsteroidFieldConfig, index: number, cellSize: number, depth: number): void {
    const random = this.random;
    const radius = (field.radius + 3.2) * cellSize;
    const size = Math.ceil(radius * 2.4);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const palette = NEBULA_PALETTES[index % NEBULA_PALETTES.length] ?? [];
    const center = size / 2;
    ctx.globalCompositeOperation = 'lighter';

    // large soft blobs
    for (let i = 0; i < 6; i++) {
      const [r, g, b] = palette[i % palette.length] ?? [120, 120, 255];
      const angle = random() * Math.PI * 2;
      const distance = random() * radius * 0.45;
      const x = center + Math.cos(angle) * distance;
      const y = center + Math.sin(angle) * distance;
      const blobRadius = radius * (0.45 + random() * 0.45);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, blobRadius);
      const alpha = 0.07 + random() * 0.05;
      gradient.addColorStop(0, `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`);
      gradient.addColorStop(0.5, `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha * 0.45)})`);
      gradient.addColorStop(1, `rgba(${String(r)}, ${String(g)}, ${String(b)}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    // long, soft wisps give the cloud some structure: radial gradients squashed into streaks
    for (let i = 0; i < 9; i++) {
      const [r, g, b] = palette[(i + 1) % palette.length] ?? [120, 120, 255];
      const angle = random() * Math.PI * 2;
      const distance = random() * radius * 0.55;
      const length = radius * (0.35 + random() * 0.4);
      const alpha = 0.04 + random() * 0.05;
      ctx.save();
      ctx.translate(center + Math.cos(angle) * distance, center + Math.sin(angle) * distance);
      ctx.rotate(random() * Math.PI);
      ctx.scale(1, 0.12 + random() * 0.18);
      const wisp = ctx.createRadialGradient(0, 0, 0, 0, 0, length);
      wisp.addColorStop(0, `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`);
      wisp.addColorStop(1, `rgba(${String(r)}, ${String(g)}, ${String(b)}, 0)`);
      ctx.fillStyle = wisp;
      ctx.beginPath();
      ctx.arc(0, 0, length, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // a dusting of tiny stars inside the cloud
    for (let i = 0; i < 40; i++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius * 0.8;
      ctx.fillStyle = `rgba(255, 255, 255, ${String(0.15 + random() * 0.35)})`;
      ctx.beginPath();
      ctx.arc(
        center + Math.cos(angle) * distance,
        center + Math.sin(angle) * distance,
        0.4 + random() * 0.7,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // the outer edge fades out completely, so no square shows
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(center, center, radius * 0.5, center, center, size / 2);
    mask.addColorStop(0, 'rgba(0, 0, 0, 1)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);

    const key = `fx-nebula-${String(index)}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addCanvas(key, canvas);
    const image = this.scene.add
      .image((field.x + 0.5) * cellSize, (field.y + 0.5) * cellSize, key)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.clouds.push({
      image,
      phase: random() * Math.PI * 2,
      spin: (random() < 0.5 ? -1 : 1) * (0.004 + random() * 0.004),
    });
  }

  private addStars(config: StarLayerConfig, depth: number): void {
    const random = this.random;
    for (let i = 0; i < config.count; i++) {
      const image = this.scene.add
        .image(0, 0, STAR_TEXTURE)
        .setDepth(depth)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(config.scrollFactor)
        .setScale(between(random(), config.scale))
        .setTint(STAR_TINTS[Math.floor(random() * STAR_TINTS.length)] ?? 0xffffff);
      this.stars.push({
        image,
        x: random() * this.width,
        y: random() * this.height,
        speed: config.speed * (0.8 + random() * 0.4),
        alpha: between(random(), config.alpha),
        // most stars shimmer slowly, a few flicker
        twinkle: random() < 0.15 ? 3 + random() * 4 : 0.4 + random() * 1.4,
        phase: random() * Math.PI * 2,
      });
    }
  }

  private addGlints(depth: number): void {
    const random = this.random;
    for (let i = 0; i < GLINTS; i++) {
      const image = this.scene.add
        .image(0, 0, GLINT_TEXTURE)
        .setDepth(depth)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(NEAR_STARS.scrollFactor)
        .setScale(0.35 + random() * 0.35)
        .setTint(STAR_TINTS[Math.floor(random() * STAR_TINTS.length)] ?? 0xffffff);
      this.stars.push({
        image,
        x: random() * this.width,
        y: random() * this.height,
        speed: NEAR_STARS.speed,
        alpha: 0.75 + random() * 0.25,
        twinkle: 0.5 + random() * 0.8,
        phase: random() * Math.PI * 2,
      });
    }
  }

  private drawShootingStar(nowMs: number): void {
    const g = this.streaks;
    g.clear();
    if (!this.shootingStar && nowMs >= this.nextShootingStarMs) {
      const random = this.random;
      // falling to the left or to the right, 20 to 45 degrees below the horizon
      const angle = 0.35 + random() * 0.45;
      const speed = 650 + random() * 350;
      this.shootingStar = {
        x: this.width * (0.15 + random() * 0.7),
        y: this.height * random() * 0.5,
        dx: Math.cos(angle) * speed * (random() < 0.5 ? -1 : 1),
        dy: Math.sin(angle) * speed,
        startMs: nowMs,
        durationMs: 650 + random() * 450,
        length: 90 + random() * 80,
      };
      this.nextShootingStarMs = nowMs + 7000 + random() * 11000;
    }
    const star = this.shootingStar;
    if (!star) return;
    const progress = (nowMs - star.startMs) / star.durationMs;
    if (progress >= 1) {
      this.shootingStar = null;
      return;
    }
    const seconds = (nowMs - star.startMs) / 1000;
    const headX = star.x + star.dx * seconds;
    const headY = star.y + star.dy * seconds;
    const speed = Math.hypot(star.dx, star.dy);
    const fade = Math.sin(progress * Math.PI);
    const segments = 10;
    for (let i = 0; i < segments; i++) {
      const from = i / segments;
      const to = (i + 1) / segments;
      g.lineStyle(2.2 * (1 - from), 0xdde8ff, 0.75 * fade * (1 - from)).lineBetween(
        headX - (star.dx / speed) * star.length * from,
        headY - (star.dy / speed) * star.length * from,
        headX - (star.dx / speed) * star.length * to,
        headY - (star.dy / speed) * star.length * to,
      );
    }
    g.fillStyle(0xffffff, 0.9 * fade).fillCircle(headX, headY, 1.6);
  }
}

/** The soft textures of the backdrop and the glows, painted once per game. */
function createTextures(scene: Phaser.Scene): void {
  paint(scene, GLOW_TEXTURE, 128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  paint(scene, STAR_TEXTURE, 32, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  paint(scene, GLINT_TEXTURE, 64, (ctx, size) => {
    const c = size / 2;
    const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.45);
    core.addColorStop(0, 'rgba(255, 255, 255, 1)');
    core.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
    core.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);
    // the four rays of a bright star
    for (const [w, h] of [
      [size, 1.6],
      [1.6, size],
    ] as const) {
      const ray = ctx.createRadialGradient(c, c, 0, c, c, c);
      ray.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      ray.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = ray;
      ctx.fillRect(c - w / 2, c - h / 2, w, h);
    }
  });
}

function paint(
  scene: Phaser.Scene,
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  draw(ctx, size);
  scene.textures.addCanvas(key, canvas);
}

function between(t: number, [min, max]: readonly [number, number]): number {
  return min + (max - min) * t;
}

/** Wraps a coordinate into 0..size, with a small margin so stars leave the edge before they come back. */
function wrap(value: number, size: number): number {
  const margin = 8;
  const span = size + margin * 2;
  return ((((value + margin) % span) + span) % span) - margin;
}

/** A small seeded PRNG for the client's looks (the simulation has its own). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
