# Data Miner — Connaissances acquises

> Lire avant de commencer. Evite les re-fetches inutiles.
> Mettre a jour apres chaque session.

## URLs stables des sources

### Pokemon Showdown (raw GitHub)
- Pokedex : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts`
- Moves : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts`
- Learnsets : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts`
- Type chart : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/typechart.ts`

### Pokemon Showdown mod Champions (override partiel)
- Base : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/`
- Fichiers : `moves.ts`, `abilities.ts`, `items.ts`, `learnsets.ts`, `formats-data.ts`, `conditions.ts`
- Format : `{ id: { inherit: true, ...champsModifies } }` - IDs Showdown lowercase-concat
- Appliqué automatiquement par `pnpm data:update` (voir `docs/process-data-update.md`)
- Statuts transcrits à la main dans `packages/data/scripts/fetch-champions.ts` -> `CHAMPIONS_STATUS_MANUAL`

### PokeAPI v2
- Pokemon : `https://pokeapi.co/api/v2/pokemon/{id-or-name}`
- Move : `https://pokeapi.co/api/v2/move/{id-or-name}`
- Noms francais : champ `names` avec `language.name === "fr"`

### PMDCollab (sprites)
- Portraits : `https://sprites.pmdcollab.org/portrait/`
- Sprites : `https://sprites.pmdcollab.org/sprite/`

## Conventions de nommage

| Source | Format | Exemple |
|--------|--------|---------|
| Showdown | lowercase sans separateurs | `leechseed`, `sludgebomb` |
| Notre projet | kebab-case | `leech-seed`, `sludge-bomb` |
| PokeAPI | kebab-case | `leech-seed` |

## Gotchas de parsing Showdown

- Les fichiers sont du TypeScript, pas du JSON — parser avec regex ou eval
- Les IDs sont en lowercase sans tirets ni espaces
- Les categories sont `Physical`, `Special`, `Status` avec majuscule
- Le champ `target` indique le ciblage 2v2 (utile pour move-pattern-designer)
- `basePower: 0` = move de statut (pas de degats)

## Pokemon deja dans packages/data/

Limite du roster : 151 premiers Pokemon (Gen 1) — decision #92.
20 Pokemon jouables actuellement. Voir `docs/roster-poc.md` pour la liste.

## Formules

- Stats niveau 50 : `computeStatAtLevel(base, level, isHp)` dans `packages/core/src/battle/stat-calculator.ts`
- IV=0, EV=0 (pas d'IV/EV dans le jeu)
- HP formula : `floor((2 * base * level) / 100) + level + 10`
- Other stats : `floor((2 * base * level) / 100) + 5`
