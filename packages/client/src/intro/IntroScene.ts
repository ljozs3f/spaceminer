import type { SoundEffect } from '../audio/effects';
import type { WarpField } from './WarpField';

/**
 * The intro, about ten seconds on the warp field's canvas: the drive spools up, jumps, the tunnel, the drop
 * out into an asteroid belt, a pirate raid shot down by turrets out of view, then the title (drawn by the
 * component in HTML over the canvas). Times are seconds from the start; sounds are cued to the picture.
 */

export const INTRO = {
  /** The jump into hyperspace: the rendered warpIn sound has its jump at 2.12 s. */
  jump: 2.12,
  /** Dropping out into the belt. */
  arrive: 3.5,
  /** The title comes in. */
  title: 6.7,
  /** The intro is over. */
  end: 10.2,
} as const;

export type IntroPhase = 'spool' | 'tunnel' | 'belt' | 'title';

export interface IntroImages {
  readonly background: HTMLImageElement | null;
  readonly asteroids: readonly HTMLImageElement[];
  readonly raider: HTMLImageElement | null;
}

interface Cue {
  readonly at: number;
  readonly sound: SoundEffect;
  /** Screen x (0 to 1) the sound comes from. */
  readonly x?: number;
}

const CUES: readonly Cue[] = [
  { at: 0, sound: 'warpIn' },
  { at: INTRO.arrive, sound: 'warpOut' },
  { at: 4.75, sound: 'laser', x: 0.1 },
  { at: 4.9, sound: 'laser', x: 0.1 },
  { at: 5.05, sound: 'laser', x: 0.1 },
  { at: 5.2, sound: 'laser', x: 0.1 },
  { at: 5.32, sound: 'explosionSmall', x: 0.55 },
  { at: 5.45, sound: 'missileLaunch', x: 0.05 },
  { at: 6.05, sound: 'missileImpact', x: 0.38 },
  { at: 6.1, sound: 'explosionMedium', x: 0.38 },
];

interface Rock {
  readonly image: HTMLImageElement;
  readonly x: number;
  readonly y: number;
  readonly born: number;
  readonly life: number;
  readonly spin: number;
}

interface Raider {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly start: number;
  readonly duration: number;
  /** When it is shot down (Infinity: it escapes). */
  readonly dies: number;
}

/** Positions are fractions of the screen. */
const RAIDERS: readonly Raider[] = [
  { from: { x: 1.1, y: 0.28 }, to: { x: -0.1, y: 0.42 }, start: 4.3, duration: 2.6, dies: 5.32 },
  { from: { x: 1.15, y: 0.36 }, to: { x: -0.1, y: 0.5 }, start: 4.45, duration: 2.5, dies: 6.05 },
  { from: { x: 1.1, y: 0.22 }, to: { x: -0.15, y: 0.3 }, start: 4.6, duration: 2.3, dies: Infinity },
];

/** Laser bolts: fired from the bottom left at a raider; they take BOLT_SECONDS to arrive. */
const BOLTS: readonly { readonly at: number; readonly raider: number }[] = [
  { at: 4.75, raider: 0 },
  { at: 4.9, raider: 0 },
  { at: 5.05, raider: 0 },
  { at: 5.2, raider: 0 },
];
const BOLT_SECONDS = 0.14;
const MISSILE = { launch: 5.45, hit: 6.05, raider: 1 } as const;
const TURRET = { x: 0.04, y: 1.02 } as const;

export class IntroScene {
  private nextCue = 0;
  private readonly rocks: Rock[] = [];
  private readonly sparks: { x: number; y: number; vx: number; vy: number; born: number }[] = [];
  private readonly blasts: { x: number; y: number; born: number; size: number }[] = [];
  private readonly exploded = new Set<number>();

  constructor(
    private readonly field: WarpField,
    private readonly images: IntroImages,
    private readonly onSound: (sound: SoundEffect, pan: number) => void,
  ) {}

  phase(t: number): IntroPhase {
    if (t < INTRO.jump) return 'spool';
    if (t < INTRO.arrive) return 'tunnel';
    if (t < INTRO.title) return 'belt';
    return 'title';
  }

  /** Draws the frame at `t` seconds into the intro; `seconds`: since the last frame. */
  draw(t: number, seconds: number): void {
    this.cueSounds(t);
    this.steerField(t);
    this.field.draw(seconds);
    const ctx = this.field.context;
    if (!ctx || t < INTRO.arrive) return;
    const { width, height } = this.field.size;
    const since = t - INTRO.arrive;

    // the belt: the background fades in behind slowly approaching rocks
    const { background } = this.images;
    if (background?.complete && background.naturalWidth > 0) {
      const zoom = 1.08 + since * 0.012;
      const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight) * zoom;
      ctx.globalAlpha = Math.min(0.85, since / 1.2);
      ctx.drawImage(
        background,
        (width - background.naturalWidth * scale) / 2,
        (height - background.naturalHeight * scale) / 2,
        background.naturalWidth * scale,
        background.naturalHeight * scale,
      );
      ctx.globalAlpha = 1;
    }
    this.drawRocks(ctx, t, width, height);
    this.drawFight(ctx, t, width, height);
    // the title reads better over a darker picture
    if (t > INTRO.title) {
      ctx.fillStyle = `rgba(3, 5, 12, ${String(Math.min(0.45, (t - INTRO.title) * 0.4))})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private cueSounds(t: number): void {
    while (this.nextCue < CUES.length) {
      const cue = CUES[this.nextCue];
      if (!cue || cue.at > t) break;
      this.nextCue++;
      // a cue more than a moment late (a slow frame, a hidden tab) is skipped rather than played out of sync
      if (t - cue.at < 0.25) this.onSound(cue.sound, ((cue.x ?? 0.5) * 2 - 1) * 0.7);
    }
  }

  private steerField(t: number): void {
    const { field } = this;
    if (t < INTRO.jump) {
      field.target = 0.04 + 0.4 * (t / INTRO.jump) ** 2;
      field.ease = 3;
    } else if (t < INTRO.arrive) {
      if (field.target < 1) {
        field.flash(1);
        field.speed = 1;
      }
      field.target = 1;
    } else if (field.target > 0.1) {
      field.flash(0.85);
      field.speed = 0.12;
      field.target = 0.015;
      field.ease = 1.5;
    }
  }

  private drawRocks(ctx: CanvasRenderingContext2D, t: number, width: number, height: number): void {
    const { asteroids } = this.images;
    if (asteroids.length === 0) return;
    // a new rock every half second, drifting out of the depth towards the edges
    while (this.rocks.length < Math.floor((t - INTRO.arrive) / 0.45) + 4) {
      const image = asteroids[this.rocks.length % asteroids.length];
      if (!image) break;
      const angle = Math.random() * Math.PI * 2;
      this.rocks.push({
        image,
        x: Math.cos(angle) * (0.25 + Math.random() * 0.5),
        y: Math.sin(angle) * (0.2 + Math.random() * 0.4),
        // the first few are already on their way
        born: this.rocks.length < 4 ? t - Math.random() * 3 : t,
        life: 5 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 0.8,
      });
    }
    const focal = Math.max(width, height) * 0.45;
    for (const rock of this.rocks) {
      const age = (t - rock.born) / rock.life;
      if (age < 0 || age > 1 || !rock.image.complete) continue;
      const z = 1.3 - age * 0.85;
      const size = (focal * 0.14) / z;
      const x = width / 2 + (rock.x / z) * focal;
      const y = height / 2 + (rock.y / z) * focal;
      ctx.save();
      ctx.globalAlpha = Math.min(1, age * 4) * Math.min(1, (1 - age) * 6) * 0.95;
      ctx.translate(x, y);
      ctx.rotate(rock.spin * (t - rock.born));
      ctx.drawImage(rock.image, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  private drawFight(ctx: CanvasRenderingContext2D, t: number, width: number, height: number): void {
    const size = Math.min(width, height) * 0.075;
    RAIDERS.forEach((raider, index) => {
      const u = (t - raider.start) / raider.duration;
      if (u < 0 || u > 1) return;
      const at = raiderAt(raider, t);
      if (t >= raider.dies) {
        if (!this.exploded.has(index)) {
          this.exploded.add(index);
          this.explode(at.x * width, at.y * height, t, index === MISSILE.raider ? 1.5 : 1);
        }
        return;
      }
      const heading = Math.atan2(
        (raider.to.y - raider.from.y) * height,
        (raider.to.x - raider.from.x) * width,
      );
      // the engine glow behind it
      const back = {
        x: at.x * width - Math.cos(heading) * size * 0.45,
        y: at.y * height - Math.sin(heading) * size * 0.45,
      };
      const glow = ctx.createRadialGradient(back.x, back.y, 0, back.x, back.y, size * 0.6);
      glow.addColorStop(0, 'rgba(255, 170, 90, 0.9)');
      glow.addColorStop(1, 'rgba(255, 90, 40, 0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(back.x - size, back.y - size, size * 2, size * 2);
      ctx.globalCompositeOperation = 'source-over';
      const { raider: image } = this.images;
      ctx.save();
      ctx.translate(at.x * width, at.y * height);
      // ship sprites point up
      ctx.rotate(heading + Math.PI / 2);
      if (image?.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = '#ff8a4d';
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 3, size / 2);
        ctx.lineTo(-size / 3, size / 2);
        ctx.fill();
      }
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // laser bolts from a turret out of view
    for (const bolt of BOLTS) {
      const u = (t - bolt.at) / BOLT_SECONDS;
      const raider = RAIDERS[bolt.raider];
      if (!raider || u < 0 || u > 1.6) continue;
      const target = raiderAt(raider, bolt.at + BOLT_SECONDS);
      const head = Math.min(1, u);
      const tail = Math.max(0, u - 0.45);
      const lerp = (k: number, a: number, b: number): number => a + (b - a) * k;
      ctx.strokeStyle = `rgba(140, 240, 255, ${String(u > 1 ? 1.6 - u : 1)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#40c4ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(lerp(tail, TURRET.x, target.x) * width, lerp(tail, TURRET.y, target.y) * height);
      ctx.lineTo(lerp(head, TURRET.x, target.x) * width, lerp(head, TURRET.y, target.y) * height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // the missile: an arc with a smoke trail
    const m = (t - MISSILE.launch) / (MISSILE.hit - MISSILE.launch);
    const target = RAIDERS[MISSILE.raider];
    if (target && m >= 0 && m <= 1) {
      const end = raiderAt(target, MISSILE.hit);
      const point = (k: number): { x: number; y: number } => ({
        x: (TURRET.x + (end.x - TURRET.x) * k) * width,
        y: (TURRET.y + (end.y - TURRET.y) * k - Math.sin(k * Math.PI) * 0.12) * height,
      });
      for (let k = Math.max(0, m - 0.35); k < m; k += 0.02) {
        const p = point(k);
        ctx.fillStyle = `rgba(255, 190, 120, ${String(((k - (m - 0.35)) / 0.35) * 0.35)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + (m - k) * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      const head = point(m);
      ctx.fillStyle = '#fff1d6';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // explosions: a white-hot core, a fireball, a shock ring and sparks
    for (const blast of this.blasts) {
      const age = t - blast.born;
      if (age > 1.2) continue;
      const radius = size * blast.size * (0.6 + age * 3.2);
      const fire = ctx.createRadialGradient(blast.x, blast.y, 0, blast.x, blast.y, radius);
      const fade = Math.max(0, 1 - age / 0.9);
      fire.addColorStop(0, `rgba(255, 250, 230, ${String(fade)})`);
      fire.addColorStop(0.3, `rgba(255, 190, 90, ${String(0.85 * fade)})`);
      fire.addColorStop(1, 'rgba(255, 80, 30, 0)');
      ctx.fillStyle = fire;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 210, 150, ${String(Math.max(0, 0.7 - age))})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, size * blast.size * (0.5 + age * 5), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const spark of this.sparks) {
      const age = t - spark.born;
      if (age > 1) continue;
      const drag = (1 - Math.exp(-age * 3)) / 3;
      const x = spark.x + spark.vx * drag;
      const y = spark.y + spark.vy * drag;
      ctx.strokeStyle = `rgba(255, 220, 160, ${String(1 - age)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - spark.vx * 0.02, y - spark.vy * 0.02);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private explode(x: number, y: number, t: number, size: number): void {
    this.blasts.push({ x, y, born: t, size });
    for (let i = 0; i < 22 * size; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 450;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: t });
    }
  }
}

function raiderAt(raider: Raider, t: number): { x: number; y: number } {
  const u = Math.min(1, Math.max(0, (t - raider.start) / raider.duration));
  // a gentle weave
  return {
    x: raider.from.x + (raider.to.x - raider.from.x) * u,
    y: raider.from.y + (raider.to.y - raider.from.y) * u + Math.sin(u * Math.PI * 2) * 0.02,
  };
}
