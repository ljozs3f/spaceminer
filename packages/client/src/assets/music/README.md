# Music

The soundtrack is fixed (there is no choice in the sound settings, only the volumes and mute). Two files are
picked up here by name at build time (`src/audio/MusicPlayer.ts`); any of `.ogg`, `.mp3`, `.m4a`, `.flac`,
`.wav` works:

| File        | Plays                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `loading.*` | the intro, the loading screens and the menu                                                                      |
| `game.*`    | in a sector; while pirates attack it opens up (a lowpass opens, a little louder), during the wave alarm it ducks |

The silence an encoder leaves at the start and end of a file is cut from the loop. Where a file is missing the
built-in soundtrack plays instead (`src/audio/songs/sentinelExpanse.ts`, played by `SongPlayer.ts`).

Pixabay does not allow automated downloads, so the files are downloaded by hand: open each source page below,
press Download, and save the file here under the name in the first column.

Only add music whose license allows it (CC0, CC-BY with the credit below, or the Pixabay Content License), and
record every file here. The Pixabay Content License allows the use in the game without credit, but not
redistributing the files on their own.

## Credits

| File          | Title                                                                | Author  | License                 | Source                                                                                                     |
| ------------- | -------------------------------------------------------------------- | ------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `loading.mp3` | Space Signal; Sci-fi Space Loop; Video Game Sound Track Royalty free | blemlin | Pixabay Content License | https://pixabay.com/music/beats-space-signal-sci-fi-space-loop-video-game-sound-track-royalty-free-331712/ |
| `game.mp3`    | Galactic Arcade                                                      | kissan4 | Pixabay Content License | https://pixabay.com/music/electronic-galactic-arcade-441548/                                               |
