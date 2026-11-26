# Music

The soundtrack is fixed (there is no choice in the sound settings, only the volumes and mute). Two files are
picked up here by name at build time (`src/audio/MusicPlayer.ts`); any of `.ogg`, `.mp3`, `.m4a`, `.flac`,
`.wav` works:

| File        | Plays                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `loading.*` | the intro, the loading screens and the menu                                                                      |
| `game.*`    | in a sector; while pirates attack it opens up (a lowpass opens, a little louder), during the wave alarm it ducks |

The silence an encoder leaves at the start and end of a file is cut from the loop. Where a file is missing the
built-in soundtrack plays instead: "Nebula Rites" in the menu, "Sentinel Expanse" in game (`src/audio/songs/`,
played by `SongPlayer.ts`).

Pixabay does not allow automated downloads, so the files are downloaded by hand: open each source page below,
press Download, and save the file here under the name in the first column.

Only add music whose license allows it (CC0, CC-BY with the credit below, or the Pixabay Content License), and
record every file here and in `src/credits.ts` (the credits page). The Pixabay Content License allows the use
in the game without credit, but not redistributing the files on their own.

## Credits

| File          | Title         | Author    | License                 | Source                                                     |
| ------------- | ------------- | --------- | ----------------------- | ---------------------------------------------------------- |
| `loading.mp3` | Space         | Sub_Clair | Pixabay Content License | https://pixabay.com/music/ambient-space-627616/            |
| `game.mp3`    | Sci-Fi Action | leberch   | Pixabay Content License | https://pixabay.com/music/main-title-sci-fi-action-248039/ |

## Alternatives

Picked by their tags and popularity on Pixabay. If one of the above does not fit, one of these can take its
place (then its row above and its entry in `src/credits.ts` change with it):

| For           | Title                   | Author         | Source                                                           |
| ------------- | ----------------------- | -------------- | ---------------------------------------------------------------- |
| `loading.mp3` | Sci-Fi Ambient          | leberch        | https://pixabay.com/music/ambient-sci-fi-ambient-589945/         |
| `loading.mp3` | Sci-Fi Ambient          | AtlasAudio     | https://pixabay.com/music/ambient-sci-fi-ambient-587603/         |
| `game.mp3`    | Futuristic Sci Fi Music | YevhenAstafiev | https://pixabay.com/music/action-futuristic-sci-fi-music-639260/ |
| `game.mp3`    | Space War               | The_Mountain   | https://pixabay.com/music/main-title-space-war-131612/           |

Earlier picks, dropped: "Space Signal" by blemlin (loading) and "Galactic Arcade" by kissan4 (game).

## Ultra Instinct

The Ultra Instinct music is not a file here: it plays from YouTube with the official embedded player
("Ultra Instinct Rush (HQ Cover)" by PokéMixr92, original theme by Norihito Sumitomo,
https://www.youtube.com/watch?v=oGUGQRKygp4), see `src/audio/YouTubeMusic.ts`. The cover's author does
not allow re-uploads, so it must not be downloaded into this folder. The same goes for the music of the
burnout after it ("Jiren's Tremendous Power (Epic Rock Cover)" by Friedrich Habetler, original theme by
Norihito Sumitomo, https://www.youtube.com/watch?v=tNW9lmujZxU): his covers are claimed on YouTube wherever
they are re-uploaded.
