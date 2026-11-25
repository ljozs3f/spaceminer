/**
 * Sprites painted in code, for what the sprite sheets do not have: the Mender Hive (levels 1 to 3) and its
 * repair drone. They follow the look of the sheet's buildings: dark armor plates with bevels and seams,
 * lit by the building's color. A sprite file with the same name replaces them (see sprites.ts).
 */

const SIZE = 128;
const DRONE_SIZE = 64;
const MINT = '#4cf2c4';
const MINT_LIGHT = '#c9fff0';
const OUTLINE = '#07090c';

/** Sprite name to a data URL, painted on first use. */
export function generatedSprites(): ReadonlyMap<string, string> {
  if (typeof document === 'undefined') return new Map();
  return new Map([
    [
      'building-repair-1',
      paint(SIZE, (ctx) => {
        paintHive(ctx, 1);
      }),
    ],
    [
      'building-repair-2',
      paint(SIZE, (ctx) => {
        paintHive(ctx, 2);
      }),
    ],
    [
      'building-repair-3',
      paint(SIZE, (ctx) => {
        paintHive(ctx, 3);
      }),
    ],
    ['drone', paint(DRONE_SIZE, paintDrone)],
  ]);
}

function paint(size: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  draw(ctx);
  return canvas.toDataURL('image/png');
}

/**
 * A hexagonal hive: armor plates around a recessed deck, a glowing core with a repair cross, and one drone
 * bay per level where the drones dock (at the dock points of the simulation, a third of a turn apart).
 */
function paintHive(ctx: CanvasRenderingContext2D, level: 1 | 2 | 3): void {
  const c = SIZE / 2;
  const radius = [42, 47, 52][level - 1] ?? 42;
  ctx.translate(c, c);

  // a soft mint glow under the hive
  const under = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.18);
  under.addColorStop(0, 'rgba(76, 242, 196, 0.35)');
  under.addColorStop(1, 'rgba(76, 242, 196, 0)');
  ctx.fillStyle = under;
  ctx.fillRect(-c, -c, SIZE, SIZE);

  // level 3: emitters on the three corners between the drone bays
  if (level === 3) {
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 3);
      plate(ctx, -5, -radius - 9, 10, 14, 3);
      glowBar(ctx, -2, -radius - 7, 4, 7);
      ctx.restore();
    }
  }

  // outer armor
  hexagon(ctx, radius + 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  hexagon(ctx, radius);
  const armor = ctx.createLinearGradient(-radius, -radius, radius, radius);
  armor.addColorStop(0, '#7d8590');
  armor.addColorStop(0.45, '#4a515b');
  armor.addColorStop(1, '#22272e');
  ctx.fillStyle = armor;
  ctx.fill();

  // seams between the plates, from the corners inwards
  ctx.strokeStyle = 'rgba(7, 9, 12, 0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.stroke();
  }
  // bevel: light on the top left, shade on the bottom right
  hexagon(ctx, radius - 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // rivets beside the seams
  ctx.fillStyle = 'rgba(15, 18, 22, 0.8)';
  for (let i = 0; i < 6; i++) {
    for (const side of [-0.14, 0.14]) {
      const angle = (i * Math.PI) / 3 + side;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * 0.88, Math.sin(angle) * radius * 0.88, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // light strips on the plates (centered on the corners): more with every level
  const strips =
    [
      [0, 3],
      [0, 2, 3, 5],
      [0, 1, 2, 3, 4, 5],
    ][level - 1] ?? [];
  for (const corner of strips) {
    ctx.save();
    // local -y now points at the corner
    ctx.rotate(Math.PI / 6 + (corner * Math.PI) / 3 + Math.PI / 2);
    glowBar(ctx, -6, -radius * 0.82, 12, 3.5);
    ctx.restore();
  }

  // the recessed deck
  const deckRadius = radius * 0.64;
  hexagon(ctx, deckRadius + 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  hexagon(ctx, deckRadius);
  const deck = ctx.createRadialGradient(-6, -6, 2, 0, 0, deckRadius);
  deck.addColorStop(0, '#3b424b');
  deck.addColorStop(1, '#161a1f');
  ctx.fillStyle = deck;
  ctx.fill();

  // drone bays, where the drones dock (drawn about a cell wide, docks 0.2 cells out)
  const displayCells = [0.9, 1, 1.12][level - 1] ?? 1;
  const dock = (0.2 / displayCells) * SIZE;
  for (let slot = 0; slot < level; slot++) {
    const angle = Math.PI / 2 + (slot * Math.PI * 2) / 3;
    const x = Math.cos(angle) * dock;
    const y = Math.sin(angle) * dock;
    ctx.beginPath();
    ctx.arc(x, y, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1317';
    ctx.fill();
    ctx.strokeStyle = MINT;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // landing lights
    for (let i = 0; i < 4; i++) {
      const light = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(light) * 5, y + Math.sin(light) * 5, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = MINT_LIGHT;
      ctx.fill();
    }
  }

  // the core with its repair cross
  const coreRadius = 9 + level;
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.9);
  core.addColorStop(0, 'rgba(201, 255, 240, 1)');
  core.addColorStop(0.35, 'rgba(76, 242, 196, 0.95)');
  core.addColorStop(0.6, 'rgba(30, 150, 120, 0.5)');
  core.addColorStop(1, 'rgba(76, 242, 196, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius + 2.5, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 40, 34, 0.85)';
  const arm = coreRadius * 0.62;
  const thickness = coreRadius * 0.36;
  ctx.fillRect(-thickness / 2, -arm, thickness, arm * 2);
  ctx.fillRect(-arm, -thickness / 2, arm * 2, thickness);
}

/** A small quad-rotor drone pointing up, with a mint eye at the front. */
function paintDrone(ctx: CanvasRenderingContext2D): void {
  const c = DRONE_SIZE / 2;
  ctx.translate(c, c);
  const rotors: readonly (readonly [number, number])[] = [
    [-17, -17],
    [17, -17],
    [-17, 17],
    [17, 17],
  ];
  ctx.lineCap = 'round';
  for (const [x, y] of rotors) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = '#59616b';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  for (const [x, y] of rotors) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190, 220, 230, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3037';
    ctx.fill();
  }
  // body
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  const body = ctx.createLinearGradient(-11, -11, 11, 11);
  body.addColorStop(0, '#9aa3ae');
  body.addColorStop(0.5, '#5a626c');
  body.addColorStop(1, '#2b3138');
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  // the eye at the front and a stripe of light
  const eye = ctx.createRadialGradient(0, -5, 0, 0, -5, 7);
  eye.addColorStop(0, MINT_LIGHT);
  eye.addColorStop(0.5, MINT);
  eye.addColorStop(1, 'rgba(76, 242, 196, 0)');
  ctx.beginPath();
  ctx.arc(0, -5, 7, 0, Math.PI * 2);
  ctx.fillStyle = eye;
  ctx.fill();
  ctx.fillStyle = MINT;
  ctx.fillRect(-5, 4, 10, 2.5);
}

function hexagon(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (i * Math.PI) / 3;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, '#6d7580');
  gradient.addColorStop(1, '#2a3037');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = gradient;
  ctx.fill();
}

/** A strip of mint light with a glow around it. */
function glowBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.shadowColor = MINT;
  ctx.shadowBlur = 6;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = MINT;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillRect(x + 1, y + h * 0.3, w - 2, Math.max(0.8, h * 0.25));
  ctx.restore();
}
