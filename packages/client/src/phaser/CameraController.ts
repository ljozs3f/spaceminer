import type * as Phaser from 'phaser';

/**
 * Zoom and pan of the map. The wheel zooms towards the cursor, the zoom buttons and the +/- keys towards the
 * middle of the view; dragging (any mouse button) and the arrow or WASD keys pan. At zoom 1 the whole map
 * is in view. Zooming is eased, so it glides instead of jumping. All positions here are in pixels: world
 * pixels for the map, game-canvas pixels for the screen.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3.5;
/** Each wheel notch or zoom step multiplies the zoom by this. */
const ZOOM_STEP = 1.25;
/** How fast the zoom glides to its target (per second, exponential). */
const ZOOM_EASE = 14;
/** Keyboard panning, in screen pixels per second. */
const PAN_SPEED = 700;

/** What part of the map is in view: its top left corner in world pixels and the zoom. */
export interface MapView {
  readonly left: number;
  readonly top: number;
  readonly zoom: number;
}

export class CameraController {
  private zoom = MIN_ZOOM;
  private targetZoom = MIN_ZOOM;
  /** The screen point that stays on the same spot of the map while the zoom glides. */
  private focus: { x: number; y: number } = { x: 0, y: 0 };
  private left = 0;
  private top = 0;
  private readonly held = new Set<string>();

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.focus = { x: camera.width / 2, y: camera.height / 2 };
    this.apply();
  }

  get view(): MapView {
    return { left: this.left, top: this.top, zoom: this.zoom };
  }

  /** The map point under a screen point. */
  toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: this.left + screenX / this.zoom, y: this.top + screenY / this.zoom };
  }

  /** steps > 0 zooms in, < 0 out; around the screen point given (default: the middle of the view). */
  zoomBy(steps: number, screenX = this.camera.width / 2, screenY = this.camera.height / 2): void {
    this.targetZoom = clamp(this.targetZoom * ZOOM_STEP ** steps, MIN_ZOOM, MAX_ZOOM);
    this.focus = { x: screenX, y: screenY };
  }

  reset(): void {
    this.targetZoom = MIN_ZOOM;
  }

  /** Moves the view by a drag of the given screen pixels (the map follows the pointer). */
  drag(dx: number, dy: number): void {
    this.left -= dx / this.zoom;
    this.top -= dy / this.zoom;
    this.clampView();
    this.apply();
  }

  /** Keys held for panning: 'left', 'right', 'up' or 'down'. */
  hold(direction: string, down: boolean): void {
    if (down) this.held.add(direction);
    else this.held.delete(direction);
  }

  /** Advances the zoom glide and the keyboard panning. Returns true when the view changed. */
  update(deltaMs: number): boolean {
    const before = this.view;
    const seconds = deltaMs / 1000;
    if (this.zoom !== this.targetZoom) {
      const anchor = this.toWorld(this.focus.x, this.focus.y);
      const eased = this.zoom + (this.targetZoom - this.zoom) * Math.min(1, seconds * ZOOM_EASE);
      this.zoom = Math.abs(eased - this.targetZoom) < 0.002 ? this.targetZoom : eased;
      // keep the map point under the focus where it was
      this.left = anchor.x - this.focus.x / this.zoom;
      this.top = anchor.y - this.focus.y / this.zoom;
    }
    const pan = (PAN_SPEED * seconds) / this.zoom;
    if (this.held.has('left')) this.left -= pan;
    if (this.held.has('right')) this.left += pan;
    if (this.held.has('up')) this.top -= pan;
    if (this.held.has('down')) this.top += pan;
    this.clampView();
    this.apply();
    const after = this.view;
    return before.left !== after.left || before.top !== after.top || before.zoom !== after.zoom;
  }

  private clampView(): void {
    this.left = clamp(this.left, 0, this.mapWidth - this.camera.width / this.zoom);
    this.top = clamp(this.top, 0, this.mapHeight - this.camera.height / this.zoom);
  }

  /** Phaser zooms around the middle of the camera: its scroll is offset from the view's corner. */
  private apply(): void {
    const { width, height } = this.camera;
    this.camera.setZoom(this.zoom);
    this.camera.setScroll(
      this.left - (width / 2) * (1 - 1 / this.zoom),
      this.top - (height / 2) * (1 - 1 / this.zoom),
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
