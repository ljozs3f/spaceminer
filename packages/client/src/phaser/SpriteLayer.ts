import type { EntityId } from '@space-miner/sim';
import type * as Phaser from 'phaser';

/** One image per entity, kept in sync with the game state: drawn every frame, removed when not drawn. */
export class SpriteLayer {
  private readonly images = new Map<EntityId, Phaser.GameObjects.Image>();
  private readonly drawn = new Set<EntityId>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  /** rotation: radians, or null to keep the current one (a ship that stops keeps its heading). */
  draw(id: EntityId, texture: string, x: number, y: number, size: number, rotation: number | null): void {
    let image = this.images.get(id);
    if (!image) {
      image = this.scene.add.image(x, y, texture).setDepth(this.depth);
      this.images.set(id, image);
    } else if (image.texture.key !== texture) {
      image.setTexture(texture);
    }
    image.setPosition(x, y).setDisplaySize(size, size);
    if (rotation !== null) image.setRotation(rotation);
    this.drawn.add(id);
  }

  /** Removes the images of the entities that were not drawn since the last sweep. */
  sweep(): void {
    for (const [id, image] of this.images) {
      if (this.drawn.has(id)) continue;
      image.destroy();
      this.images.delete(id);
    }
    this.drawn.clear();
  }
}
