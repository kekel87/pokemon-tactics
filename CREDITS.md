# Credits

Pokemon Tactics is a non-commercial fan project. It is not affiliated with, endorsed, or approved by
Nintendo, Game Freak, Creatures, or The Pokémon Company. Pokémon and all associated names are
trademarks of their respective owners.

The in-game Credits screen (main menu → Credits) carries the same attributions.

## Pokémon sprites & portraits

**Source:** [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab) — browse at
<https://sprites.pmdcollab.org>
**License:** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (Attribution-NonCommercial 4.0
International)

The sprites and portraits come from the PMDCollab community repository, originally based on the
Pokémon Mystery Dungeon artwork by CHUNSOFT / Spike Chunsoft, with many contributions from community
artists. Each Pokémon's artists are listed in its `credits.txt` on SpriteCollab; `pnpm extract-sprites`
downloads it alongside the sprites, and only the packed bundle (`sprites.bin`, `sprites-manifest.json`,
`portraits.png`) ships with the game.

License terms: non-commercial use only, with attribution to PMDCollab and the original artists.

## Terrain tileset

Custom isometric tiles generated from Pokémon Mystery Dungeon textures — same source as the sprites.

## Move effects

**Source:** [PMDCollab/RawAsset](https://github.com/PMDCollab/RawAsset) — the particle assets of
[Pokémon Mystery Dungeon Origins](https://github.com/audinowho/PMDODump)

The attack effect particles (impacts, projectiles, smoke, rings, beams) come from PMD Origins' raw
assets, themselves taken from the Pokémon Mystery Dungeon games (© Nintendo, Creatures, GAME FREAK,
Spike Chunsoft). They carry no license of their own. They are downloaded by `pnpm build-move-effects`
and only the packed sheet `move-effects.png` ships with the game.

## Held-item icons

**Source:** [Pokémon Showdown](https://play.pokemonshowdown.com) — the item icon sheet
(`sprites/itemicons-sheet.png`)

The 24×24 item icons are sliced from Pokémon Showdown's sheet, itself derived from the official games
(© Nintendo, Creatures, GAME FREAK). They carry no license of their own. They are downloaded by
`pnpm extract-item-icons` and only the packed sheet `item-icons.png` ships with the game.

## Type, category and status icons

**Source:** [Poképédia](https://www.pokepedia.fr) — the icons of Pokémon Legends: Z-A

The type, move category and status icons are downloaded from Poképédia (`scripts/download-type-icons.ts`,
`scripts/download-status-icons.ts`) and come from the official game (© Nintendo, Creatures, GAME FREAK).

## Font

"Pokémon Emerald Pro" by crystalwalrein — [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
<https://fontstruct.com/fontstructions/show/832818>

## Interface

- Controller and keyboard glyphs: "Input Prompts Pixel 1-Bit" by Kenney —
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/) —
  <https://kenney.nl/assets/input-prompts-pixel-1-bit>
- Cursors and magnifiers: "Cursor Pixel Pack" by Kenney —
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/) — <https://kenney.nl/assets/cursor-pixel-pack>

## Code

Developed with the assistance of Claude (Anthropic).
