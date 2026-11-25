import type { BuildingLevel } from '@space-miner/sim';
import type * as Phaser from 'phaser';

/**
 * Moving parts of the mine sprites: the drill arms swing around their shoulders while the mine works, and the
 * bottom drill of the level 3 mine pumps. The parts are cut out of the sprite at start (polygons in the
 * sprite's 128 px space, measured on building-mine-1..3.png; the right arm mirrors the left one). The body
 * keeps a darkened copy of each part, so where a part moves away it shows as a shadow, not a hole.
 */

const SPRITE_PX = 128;

interface PartShape {
  /** Outline of the part in sprite pixels. */
  readonly polygon: readonly (readonly [number, number])[];
  /** The joint it moves around, in sprite pixels. */
  readonly pivot: readonly [number, number];
  /** 'swing': turns around the pivot (an arm); 'pump': moves up and down (a drill). */
  readonly motion: 'swing' | 'pump';
  /** Also add the part mirrored left to right (the other arm). */
  readonly mirrored: boolean;
}

/** The left arms; the right ones are mirrored. Measured on the sprites cut from art/buildings.png. */
const SHAPES: Readonly<Record<BuildingLevel, readonly PartShape[]>> = {
  1: [
    {
      polygon: [
        [0, 66],
        [18, 52],
        [50, 52],
        [53, 70],
        [33, 80],
        [30, 112],
        [0, 112],
      ],
      pivot: [48, 61],
      motion: 'swing',
      mirrored: true,
    },
  ],
  2: [
    {
      polygon: [
        [0, 64],
        [18, 52],
        [46, 52],
        [47, 67],
        [31, 74],
        [31, 108],
        [0, 108],
      ],
      pivot: [43, 59],
      motion: 'swing',
      mirrored: true,
    },
  ],
  3: [
    {
      polygon: [
        [0, 70],
        [16, 56],
        [50, 54],
        [52, 70],
        [34, 78],
        [33, 112],
        [0, 112],
      ],
      pivot: [47, 60],
      motion: 'swing',
      mirrored: true,
    },
    {
      polygon: [
        [53, 98],
        [75, 98],
        [75, 127],
        [53, 127],
      ],
      pivot: [64, 98],
      motion: 'pump',
      mirrored: false,
    },
  ],
};

export interface RigPart {
  readonly texture: string;
  /** Pivot as a fraction of the sprite (Phaser origin). */
  readonly originX: number;
  readonly originY: number;
  readonly motion: 'swing' | 'pump';
  /** 1 for a left arm, -1 for a mirrored right one: they swing towards each other. */
  readonly side: 1 | -1;
}

export interface MineRig {
  /** The sprite with its moving parts darkened. */
  readonly body: string;
  readonly parts: readonly RigPart[];
}

/**
 * Cuts the moving parts out of a loaded mine sprite into textures of their own. Returns undefined when the
 * sprite is not loaded (the mine then stays one piece).
 */
export function createMineRig(
  scene: Phaser.Scene,
  sprite: string,
  level: BuildingLevel,
): MineRig | undefined {
  if (!scene.textures.exists(sprite)) return undefined;
  const source = scene.textures.get(sprite).getSourceImage();
  if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) return undefined;
  const width = source.width;
  const height = source.height;
  const scale = width / SPRITE_PX;
  const shapes = SHAPES[level].flatMap((shape) =>
    shape.mirrored
      ? [
          { shape, side: 1 as const },
          { shape, side: -1 as const },
        ]
      : [{ shape, side: 1 as const }],
  );

  const outline = (ctx: CanvasRenderingContext2D, shape: PartShape, side: 1 | -1): void => {
    ctx.beginPath();
    shape.polygon.forEach(([x, y], index) => {
      const px = (side === 1 ? x : SPRITE_PX - x) * scale;
      if (index === 0) ctx.moveTo(px, y * scale);
      else ctx.lineTo(px, y * scale);
    });
    ctx.closePath();
  };

  const parts: RigPart[] = shapes.map(({ shape, side }, index) => {
    const key = `${sprite}-part-${String(index)}`;
    const canvas = canvasOf(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      outline(ctx, shape, side);
      ctx.clip();
      ctx.drawImage(source, 0, 0);
    }
    replaceTexture(scene, key, canvas);
    const pivotX = side === 1 ? shape.pivot[0] : SPRITE_PX - shape.pivot[0];
    return {
      texture: key,
      originX: pivotX / SPRITE_PX,
      originY: shape.pivot[1] / SPRITE_PX,
      motion: shape.motion,
      side,
    };
  });

  const body = `${sprite}-body`;
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, 0, 0);
    // the parts' places are darkened, keeping the sprite's alpha
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(4, 6, 9, 0.72)';
    for (const { shape, side } of shapes) {
      outline(ctx, shape, side);
      ctx.fill();
    }
  }
  replaceTexture(scene, body, canvas);
  return { body, parts };
}

/**
 * How a part is moved at a moment: radians for an arm, sprite pixels down for a drill. `work` is 0 (resting)
 * to 1 (mining): the arms dig rhythmically with a fast drilling shake on top.
 */
export function partMotion(part: RigPart, work: number, seconds: number, phase: number): number {
  if (work <= 0) return 0;
  const dig = 0.5 + 0.5 * Math.sin(seconds * Math.PI * 2 * 0.9 + phase + (part.side === 1 ? 0 : Math.PI));
  const shake = Math.sin(seconds * Math.PI * 2 * 14 + phase * 3);
  if (part.motion === 'pump') return work * (1.5 + 2.5 * dig + 0.5 * shake);
  // a left arm swings counterclockwise (in and down, towards the rock), a right one clockwise
  return -part.side * work * (0.03 + 0.11 * dig + 0.012 * shake);
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function replaceTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}
