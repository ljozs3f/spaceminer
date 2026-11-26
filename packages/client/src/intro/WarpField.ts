/**
 * Stars flying at the viewer on a 2D canvas: at speed 0 they drift, at 1 they stretch into hyperspace
 * streaks around a glowing tunnel. The intro and the sector loading screen draw on it; `flash` whites the
 * screen out for a jump.
 */

interface Star {
  x: number;
  y: number;
  /** Depth: 1 far, towards 0 near. */
  z: number;
  hue: number;
}

const STARS = 520;
/** Depth units per second at speed 0 and at speed 1. */
const DRIFT = 0.04;
const WARP = 3.2;

export class WarpField {
  /** Where the speed is heading (0 to 1); `speed` follows it smoothly. */
  target = 0.04;
  speed = 0.04;
  /** How fast `speed` follows `target` (per second). */
  ease = 2.5;
  private flashLevel = 0;
  private width = 0;
  private height = 0;
  private readonly stars: Star[] = [];
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    for (let i = 0; i < STARS; i++) this.stars.push(newStar(false));
    this.resize();
  }

  get context(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  get size(): { readonly width: number; readonly height: number } {
    return { width: this.width, height: this.height };
  }

  resize(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Whites the screen out (1: fully), fading over a few tenths of a second. */
  flash(level = 1): void {
    this.flashLevel = Math.max(this.flashLevel, level);
  }

  /** Clears the canvas and draws the stars. */
  draw(seconds: number): void {
    const { ctx, width, height } = this;
    if (!ctx || width === 0) return;
    this.speed += (this.target - this.speed) * Math.min(1, seconds * this.ease);
    const speed = this.speed;
    const cx = width / 2;
    const cy = height / 2;
    const focal = Math.max(width, height) * 0.45;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, width, height);

    // the tunnel: a blue-violet glow that opens up at speed
    if (speed > 0.15) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, focal * 1.3);
      const a = Math.min(1, (speed - 0.15) / 0.85);
      glow.addColorStop(0, `rgba(190, 220, 255, ${String(0.28 * a)})`);
      glow.addColorStop(0.25, `rgba(90, 110, 255, ${String(0.16 * a)})`);
      glow.addColorStop(0.7, `rgba(120, 40, 200, ${String(0.08 * a)})`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const advance = seconds * (DRIFT + speed * WARP);
    // at speed the streaks reach back this far in depth
    const trail = 0.004 + speed * 0.22;
    for (const star of this.stars) {
      star.z -= advance;
      if (star.z <= 0.03) Object.assign(star, newStar(true));
      const x = cx + (star.x / star.z) * focal;
      const y = cy + (star.y / star.z) * focal;
      if (x < -50 || y < -50 || x > width + 50 || y > height + 50) {
        Object.assign(star, newStar(true));
        continue;
      }
      const tailZ = Math.min(1.2, star.z + trail);
      const tx = cx + (star.x / tailZ) * focal;
      const ty = cy + (star.y / tailZ) * focal;
      const near = 1 - star.z;
      const alpha = Math.min(1, near * 1.3) * (0.55 + 0.45 * Math.min(1, speed * 3));
      ctx.strokeStyle = `hsla(${String(star.hue)}, 90%, ${String(78 + near * 20)}%, ${String(alpha)})`;
      ctx.lineWidth = 0.6 + near * (1.6 + speed * 1.6);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x + 0.01, y + 0.01);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (this.flashLevel > 0.002) {
      ctx.fillStyle = `rgba(235, 245, 255, ${String(Math.min(1, this.flashLevel))})`;
      ctx.fillRect(0, 0, width, height);
      this.flashLevel *= Math.exp(-seconds * 4.5);
    }
  }
}

/** far: a new star at the back; otherwise anywhere in depth (the first ones). */
function newStar(far: boolean): Star {
  // a few stars right in the middle would sit still and look like dust on the screen
  let x = 0;
  let y = 0;
  while (Math.hypot(x, y) < 0.04) {
    x = (Math.random() * 2 - 1) * 1.2;
    y = (Math.random() * 2 - 1) * 0.8;
  }
  return { x, y, z: far ? 0.9 + Math.random() * 0.3 : 0.1 + Math.random(), hue: 200 + Math.random() * 60 };
}
