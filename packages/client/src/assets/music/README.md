# Music

Without files the game plays its built-in soundtrack (`src/audio/song.ts`, played by `SongPlayer.ts`). Files put
here replace it. They are picked up by name at build time (`src/audio/MusicPlayer.ts`); any of `.ogg`, `.mp3`,
`.m4a`, `.flac`, `.wav` works.

| File       | Plays                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------- |
| `menu.*`   | in the menus                                                                                 |
| `calm.*`   | in game while no pirates are on the map                                                      |
| `battle.*` | in game while pirates attack (crossfaded with `calm`; without it, `calm` plays all the time) |

Only add music whose license allows it (CC0, or CC-BY with the credit below), and record every file here.

## Credits

| File | Title | Author | License | Source |
| ---- | ----- | ------ | ------- | ------ |
