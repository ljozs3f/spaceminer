import type { EntityId } from '@space-miner/sim';
import type * as Phaser from 'phaser';

/** One image per entity, kept in sync with the game state: drawn every frame, removed when not drawn. */
export class SpriteLayer {
  private readonly images = new Map<EntityId, Phaser.GameObjects.Image>();
  private readonly drawn = new Set<EntityId>();

  /** blendMode: a Phaser.BlendModes value, e.g. ADD for glows. */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly blendMode?: number,
  ) {}

  /**
   * rotation: radians, or null to keep the current one (a ship that stops keeps its heading). Returns the
   * image, for tint and alpha.
   */
  draw(
    id: EntityId,
    texture: string,
    x: number,
    y: number,
    size: number,
    rotation: number | null,
  ): Phaser.GameObjects.Image {
    let image = this.images.get(id);
    if (!image) {
      image = this.scene.add.image(x, y, texture).setDepth(this.depth);
      if (this.blendMode !== undefined) image.setBlendMode(this.blendMode);
      this.images.set(id, image);
    } else if (image.texture.key !== texture) {
      image.setTexture(texture);
    }
    image.setPosition(x, y).setDisplaySize(size, size);
    if (rotation !== null) image.setRotation(rotation);
    this.drawn.add(id);
    return image;
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
