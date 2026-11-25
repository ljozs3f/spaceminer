/**
 * Cuts the generated sprite sheets in art/ into one PNG per object in src/assets/sprites/, and copies the
 * background there.
 *
 * Objects are found by their outlines (connected opaque pixels) and assigned to grid cells by their centers,
 * so the generated grid does not have to be exact, and an object made of several pieces (a missile and its
 * flame) stays together. A sheet whose objects stand on a nearly opaque glow instead of a transparent
 * background gets that glow removed first (see SheetSpec.backdrop). Each sprite is trimmed, its edges
 * cleaned (faint haze removed, edge colors taken from the inside so no colored fringe shows on the map),
 * centered on a square and scaled down with area averaging.
 *
 * Run: make sprites
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

interface SheetSpec {
  readonly file: string;
  readonly columns: number;
  readonly rows: number;
  /** Sprite name and output size in pixels per cell, left to right, top to bottom. */
  readonly cells: readonly (readonly [name: string, size: number])[];
  /**
   * For a sheet with a glow behind every object instead of a transparent background: the glow gets almost
   * opaque near the object, the object itself is a little more opaque still. Pixels at least `opaqueFrom`
   * opaque are the objects; see removeBackdrop.
   */
  readonly backdrop?: { readonly opaqueFrom: number };
}

/** Sprites are made at about 4 pixels per screen pixel of a 32 px cell, so they stay sharp when scaled up. */
const SHEETS: readonly SheetSpec[] = [
  {
    file: 'sheet.png',
    columns: 4,
    rows: 4,
    cells: [
      ['building-mine', 128],
      ['building-solar', 128],
      ['building-laser', 128],
      ['building-missile', 128],
      ['ship-raider', 96],
      ['ship-gunship', 128],
      ['ship-dreadnought', 192],
      ['projectile-laser', 64],
      ['projectile-missile', 64],
      ['asteroid-small-a', 96],
      ['asteroid-small-b', 96],
      ['asteroid-medium-a', 128],
      ['asteroid-medium-b', 128],
      ['asteroid-medium-c', 128],
      ['asteroid-large-a', 256],
      ['asteroid-large-b', 256],
    ],
  },
  {
    // optional: one sprite per building level (columns: building types, rows: levels 1 to 3)
    file: 'buildings.png',
    columns: 4,
    rows: 3,
    cells: [1, 2, 3].flatMap((level) =>
      ['mine', 'solar', 'laser', 'missile'].map(
        (type) => [`building-${type}-${String(level)}`, 128] as const,
      ),
    ),
    // this sheet came with a grey glow behind each building (alpha up to about 249; the buildings: 250+)
    backdrop: { opaqueFrom: 250 },
  },
  {
    // optional: the Mender Hive at levels 1 to 3, in place of the one painted in code (generatedSprites.ts);
    // add `backdrop` if the sheet comes with a glow behind the buildings like buildings.png
    file: 'hive.png',
    columns: 3,
    rows: 1,
    cells: [1, 2, 3].map((level) => [`building-repair-${String(level)}`, 128] as const),
  },
];

const BACKGROUND = 'background.png';

/** Pixels at least this opaque make up the objects; fainter ones only count as their soft edge. */
const SOLID_ALPHA = 64;
/** Fainter pixels are haze and are dropped. */
const HAZE_ALPHA = 24;
/** Pixels this opaque are inside an object; edge pixels take their color from them. */
const INNER_ALPHA = 230;
/** Pieces smaller than this (in pixels) are specks and are dropped. */
const MIN_PIECE = 200;
/** How far (in pixels) the soft edge around the solid pixels is kept. */
const EDGE = 2;
/** How far (in pixels) an edge pixel looks for inner pixels to take its color from. */
const DEFRINGE_RADIUS = 3;

interface Image {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

interface Piece {
  readonly label: number;
  readonly count: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const artDir = new URL('../art/', import.meta.url);
const outDir = new URL('../src/assets/sprites/', import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const sheet of SHEETS) {
  const path = new URL(sheet.file, artDir);
  if (!existsSync(path)) {
    console.log(`${sheet.file}: not found, skipped`);
    continue;
  }
  const image = readPng(path);
  cutSheet(sheet.backdrop ? removeBackdrop(image, sheet.backdrop.opaqueFrom) : image, sheet);
}
if (existsSync(new URL(BACKGROUND, artDir))) {
  copyFileSync(new URL(BACKGROUND, artDir), new URL(BACKGROUND, outDir));
  console.log(`${BACKGROUND}: copied`);
}

function cutSheet(image: Image, sheet: SheetSpec): void {
  const { labels, pieces } = findPieces(image);
  const cellWidth = image.width / sheet.columns;
  const cellHeight = image.height / sheet.rows;
  sheet.cells.forEach(([name, size], index) => {
    const column = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    const own = pieces.filter(
      (piece) =>
        Math.floor(piece.centerX / cellWidth) === column && Math.floor(piece.centerY / cellHeight) === row,
    );
    if (own.length === 0) {
      console.log(`${sheet.file}: no object for ${name}`);
      return;
    }
    const sprite = scaleDown(square(defringe(cutOut(image, labels, own))), size);
    writeFileSync(new URL(`${name}.png`, outDir), writePng(sprite));
    console.log(`${sheet.file}: ${name} (${String(own.length)} piece(s)) -> ${String(size)} px`);
  });
}

/**
 * Makes the objects of a sheet with a glow behind them fully opaque and the glow transparent. The glow is a
 * little less opaque than the objects, even where an object encloses it (between gun barrels).
 */
function removeBackdrop(image: Image, opaqueFrom: number): Image {
  const data = new Uint8Array(image.data);
  for (let at = 3; at < data.length; at += 4) data[at] = (data[at] ?? 0) >= opaqueFrom ? 255 : 0;
  return { width: image.width, height: image.height, data };
}

/** Connected groups of solid pixels (8-neighbourhood), without specks. */
function findPieces(image: Image): { labels: Int32Array; pieces: Piece[] } {
  const { width, height, data } = image;
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const pieces: Piece[] = [];
  let next = 1;
  for (let start = 0; start < width * height; start++) {
    if (labels[start] !== 0 || (data[start * 4 + 3] ?? 0) < SOLID_ALPHA) continue;
    const label = next++;
    let size = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;
    labels[start] = label;
    stack[size++] = start;
    while (size > 0) {
      const pixel = stack[--size] ?? 0;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      count++;
      sumX += x;
      sumY += y;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (labels[neighbour] !== 0 || (data[neighbour * 4 + 3] ?? 0) < SOLID_ALPHA) continue;
          labels[neighbour] = label;
          stack[size++] = neighbour;
        }
      }
    }
    if (count >= MIN_PIECE) {
      pieces.push({ label, count, centerX: sumX / count, centerY: sumY / count, left, top, right, bottom });
    }
  }
  return { labels, pieces };
}

/** The pieces with a soft edge of EDGE pixels around them; everything else, and the haze, is transparent. */
function cutOut(image: Image, labels: Int32Array, pieces: readonly Piece[]): Image {
  const own = new Set(pieces.map((piece) => piece.label));
  const left = Math.max(0, Math.min(...pieces.map((piece) => piece.left)) - EDGE);
  const top = Math.max(0, Math.min(...pieces.map((piece) => piece.top)) - EDGE);
  const right = Math.min(image.width - 1, Math.max(...pieces.map((piece) => piece.right)) + EDGE);
  const bottom = Math.min(image.height - 1, Math.max(...pieces.map((piece) => piece.bottom)) + EDGE);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = left + x;
      const sy = top + y;
      if (!nearPiece(labels, image.width, image.height, sx, sy, own)) continue;
      const from = (sy * image.width + sx) * 4;
      const alpha = image.data[from + 3] ?? 0;
      if (alpha < HAZE_ALPHA) continue;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

function nearPiece(
  labels: Int32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  own: ReadonlySet<number>,
): boolean {
  for (let dy = -EDGE; dy <= EDGE; dy++) {
    for (let dx = -EDGE; dx <= EDGE; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && own.has(labels[ny * width + nx] ?? 0))
        return true;
    }
  }
  return false;
}

/** Edge pixels take the average color of the inner pixels around them, so no fringe color shows. */
function defringe(image: Image): Image {
  const { width, height, data } = image;
  const result = new Uint8Array(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const alpha = data[at + 3] ?? 0;
      if (alpha === 0 || alpha >= INNER_ALPHA) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -DEFRINGE_RADIUS; dy <= DEFRINGE_RADIUS; dy++) {
        for (let dx = -DEFRINGE_RADIUS; dx <= DEFRINGE_RADIUS; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const near = (ny * width + nx) * 4;
          if ((data[near + 3] ?? 0) < INNER_ALPHA) continue;
          r += data[near] ?? 0;
          g += data[near + 1] ?? 0;
          b += data[near + 2] ?? 0;
          n++;
        }
      }
      if (n > 0) result.set([r / n, g / n, b / n], at);
    }
  }
  return { width, height, data: result };
}

/** Centers the image on a transparent square with a small margin. */
function square(image: Image): Image {
  const side = Math.ceil(Math.max(image.width, image.height) * 1.04) + 2;
  const data = new Uint8Array(side * side * 4);
  const offsetX = Math.floor((side - image.width) / 2);
  const offsetY = Math.floor((side - image.height) / 2);
  for (let y = 0; y < image.height; y++) {
    const from = y * image.width * 4;
    data.set(image.data.subarray(from, from + image.width * 4), ((offsetY + y) * side + offsetX) * 4);
  }
  return { width: side, height: side, data };
}

/** Area-averaging downscale with premultiplied alpha, so transparent pixels do not darken the edges. */
function scaleDown(image: Image, size: number): Image {
  const scale = image.width / size;
  const data = new Uint8Array(size * size * 4);
  for (let ty = 0; ty < size; ty++) {
    const y0 = ty * scale;
    const y1 = y0 + scale;
    for (let tx = 0; tx < size; tx++) {
      const x0 = tx * scale;
      const x1 = x0 + scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weights = 0;
      for (let sy = Math.floor(y0); sy < Math.min(image.height, Math.ceil(y1)); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.min(image.width, Math.ceil(x1)); sx++) {
          const weight = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0));
          const at = (sy * image.width + sx) * 4;
          const alpha = (image.data[at + 3] ?? 0) / 255;
          r += (image.data[at] ?? 0) * alpha * weight;
          g += (image.data[at + 1] ?? 0) * alpha * weight;
          b += (image.data[at + 2] ?? 0) * alpha * weight;
          a += alpha * weight;
          weights += weight;
        }
      }
      if (a > 0) data.set([r / a, g / a, b / a, (a / weights) * 255], (ty * size + tx) * 4);
    }
  }
  return { width: size, height: size, data };
}

function writePng(image: Image): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png);
}

function readPng(path: URL): Image {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}
