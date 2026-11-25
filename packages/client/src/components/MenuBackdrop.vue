<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { BACKGROUND_SPRITE, SPRITE_URLS } from '../game/sprites';

/**
 * The menu's moving background on a canvas: the map's background image drifting slowly, two layers of
 * twinkling stars, asteroids tumbling past at different depths, now and then a shooting star. The view
 * leans a little towards the mouse (parallax). Everything is normalized to the window, so it fills any size.
 */

interface Star {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly size: number;
  readonly twinkle: number;
  readonly phase: number;
}

interface Rock {
  readonly image: HTMLImageElement;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  rotation: number;
  readonly spin: number;
  /** 0 (far, small, dim) to 1 (near, big). */
  readonly depth: number;
}

const STARS = 260;
const ROCKS = 9;

const canvas = useTemplateRef('canvas');
let frame = 0;
let lastMs = 0;
let width = 0;
let height = 0;
let background: HTMLImageElement | null = null;
const stars: Star[] = [];
const rocks: Rock[] = [];
const lean = { x: 0, y: 0, targetX: 0, targetY: 0 };
let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
let nextShootingMs = 2500;

function image(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;
  const element = new Image();
  element.src = url;
  return element;
}

function resize(): void {
  const element = canvas.value;
  if (!element) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  width = element.clientWidth;
  height = element.clientHeight;
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  element.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function onPointerMove(event: PointerEvent): void {
  lean.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
  lean.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
}

function wrap(value: number, size: number, margin: number): number {
  const span = size + margin * 2;
  return ((((value + margin) % span) + span) % span) - margin;
}

function draw(nowMs: number): void {
  frame = requestAnimationFrame(draw);
  const ctx = canvas.value?.getContext('2d');
  if (!ctx || width === 0) return;
  const seconds = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  const t = nowMs / 1000;
  lean.x += (lean.targetX - lean.x) * Math.min(1, seconds * 2.5);
  lean.y += (lean.targetY - lean.y) * Math.min(1, seconds * 2.5);

  ctx.fillStyle = '#04060d';
  ctx.fillRect(0, 0, width, height);

  // the background image, a little larger than the window, drifting and leaning
  if (background?.complete && background.naturalWidth > 0) {
    const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight) * 1.12;
    const w = background.naturalWidth * scale;
    const h = background.naturalHeight * scale;
    const x = (width - w) / 2 + Math.sin(t * 0.05) * width * 0.02 - lean.x * 14;
    const y = (height - h) / 2 + Math.cos(t * 0.04) * height * 0.02 - lean.y * 10;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(background, x, y, w, h);
    ctx.globalAlpha = 1;
  }

  // stars: the nearer ones drift faster and lean further
  ctx.globalCompositeOperation = 'lighter';
  for (const star of stars) {
    const x = wrap(star.x * width - t * (4 + star.depth * 14) - lean.x * star.depth * 28, width, 4);
    const y = wrap(star.y * height + t * star.depth * 3 - lean.y * star.depth * 20, height, 4);
    const shimmer = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * star.twinkle + star.phase));
    ctx.globalAlpha = (0.25 + star.depth * 0.65) * shimmer;
    ctx.fillStyle = star.depth > 0.8 ? '#e3ecff' : '#b9c9ff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // a shooting star now and then
  if (!shooting && nowMs > nextShootingMs) {
    shooting = {
      x: width * (0.2 + Math.random() * 0.7),
      y: height * Math.random() * 0.4,
      vx: -(500 + Math.random() * 400),
      vy: 220 + Math.random() * 200,
      life: 0,
    };
    nextShootingMs = nowMs + 5000 + Math.random() * 9000;
  }
  if (shooting) {
    shooting.life += seconds;
    shooting.x += shooting.vx * seconds;
    shooting.y += shooting.vy * seconds;
    const fade = Math.sin(Math.min(1, shooting.life / 0.9) * Math.PI);
    const tail = ctx.createLinearGradient(
      shooting.x,
      shooting.y,
      shooting.x - shooting.vx * 0.22,
      shooting.y - shooting.vy * 0.22,
    );
    tail.addColorStop(0, `rgba(230, 240, 255, ${String(0.85 * fade)})`);
    tail.addColorStop(1, 'rgba(230, 240, 255, 0)');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tail;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shooting.x, shooting.y);
    ctx.lineTo(shooting.x - shooting.vx * 0.22, shooting.y - shooting.vy * 0.22);
    ctx.stroke();
    if (shooting.life > 0.9) shooting = null;
  }
  ctx.globalCompositeOperation = 'source-over';

  // asteroids tumbling past, the far ones small and dim
  for (const rock of rocks) {
    rock.x += rock.vx * seconds;
    rock.y += rock.vy * seconds;
    rock.rotation += rock.spin * seconds;
    if (!rock.image.complete || rock.image.naturalWidth === 0) continue;
    const size = 26 + rock.depth * 120;
    const x = wrap(rock.x - lean.x * rock.depth * 40, width, size);
    const y = wrap(rock.y - lean.y * rock.depth * 30, height, size);
    ctx.save();
    ctx.globalAlpha = 0.35 + rock.depth * 0.6;
    ctx.translate(x, y);
    ctx.rotate(rock.rotation);
    ctx.drawImage(rock.image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

onMounted(() => {
  background = image(SPRITE_URLS.get(BACKGROUND_SPRITE));
  for (let i = 0; i < STARS; i++) {
    const depth = Math.random() ** 1.6;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      depth,
      size: 0.4 + depth * 1.3,
      twinkle: 0.5 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const rockImages = [...SPRITE_URLS.entries()]
    .filter(([name]) => name.startsWith('asteroid-'))
    .map(([, url]) => image(url))
    .filter((element): element is HTMLImageElement => element !== null);
  resize();
  for (let i = 0; i < ROCKS && rockImages.length > 0; i++) {
    const depth = i / (ROCKS - 1);
    rocks.push({
      image: rockImages[i % rockImages.length] ?? (rockImages[0] as HTMLImageElement),
      x: Math.random() * width,
      y: Math.random() * height,
      vx: -(6 + depth * 26) * (0.7 + Math.random() * 0.6),
      vy: (Math.random() - 0.3) * (3 + depth * 8),
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (0.2 + (1 - depth) * 0.3),
      depth,
    });
  }
  // the far rocks first, the near ones over them
  rocks.sort((a, b) => a.depth - b.depth);
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove);
  lastMs = performance.now();
  frame = requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('resize', resize);
  window.removeEventListener('pointermove', onPointerMove);
});
</script>

<template>
  <canvas ref="canvas" class="menu-backdrop" aria-hidden="true" />
</template>
