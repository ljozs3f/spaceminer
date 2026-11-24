import * as Phaser from 'phaser';
import type { EventBus, GameEvents } from '../events';
import type { GameSession } from '../game/GameSession';
import { CELL_SIZE, GameScene } from './GameScene';

export function createPhaserGame(
  parent: HTMLElement,
  session: GameSession,
  bus: EventBus<GameEvents>,
): Phaser.Game {
  const { width, height } = session.state.level;
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: width * CELL_SIZE,
    height: height * CELL_SIZE,
    backgroundColor: '#05070f',
    banner: false,
    // all sound goes through the app's AudioEngine, Phaser needs no audio context of its own
    audio: { noAudio: true },
    // several textures in one WebGL batch drew rotated sprites in pieces (seen with SwiftShader); one texture
    // per batch avoids that, at the cost of a few more draw calls
    render: { maxTextures: 1 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new GameScene(session, bus),
  });
}
