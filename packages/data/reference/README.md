# Pokemon Reference Knowledge Base

Base de connaissance Pokemon exhaustive (Gen 1-9, 1025 especes + 308 formes).
Utilisee comme reference par Claude pour eviter les fetches Showdown/Bulbapedia/PokeAPI a chaque question.

**Date de generation** : 2026-04-12
**Sources** : Pokemon Showdown (stats, moves, learnsets) + PokeAPI v2 (noms FR, flavor text, metadata)

## Contenu

| Fichier | Entrees | Taille | Description |
|---------|---------|--------|-------------|
| `pokemon.json` | 1025 especes + 308 formes | 3.6 MB | Stats, types, abilities, learnsets (latest gen), evolutions, flavor text EN/FR |
| `moves.json` | 850 moves | 0.9 MB | Power, accuracy, PP, flags, target, secondary effects, descriptions EN/FR |
| `abilities.json` | 311 abilities | 0.2 MB | Descriptions EN/FR, generation |
| `items.json` | 948 items | 0.5 MB | Category, descriptions EN/FR, fling, price |
| `type-chart.json` | 18 types | 7 KB | Table 18x18 (attacker x defender = multiplier) |
| `indexes/` | 19 fichiers | 1.2 MB | Index inverses pour requetes rapides |

**Total** : ~6.4 MB (reference) + ~1.2 MB (indexes)

## Index disponibles

### Moves (9)
- `moves-by-type.json` — par type d'attaque
- `moves-by-category.json` — physical / special / status
- `moves-by-flag.json` — sound, contact, bullet, punch, etc.
- `moves-by-target.json` — normal, allAdjacent, self, etc.
- `moves-by-secondary-status.json` — burn, paralysis, sleep, etc.
- `moves-by-stat-change.json` — atk+1, def-1, spe+2, etc.
- `moves-by-power-bracket.json` — status, 1-40, 41-70, 71-90, 91-110, 111+
- `moves-by-priority.json` — +4, +1, 0, -1, -6, etc.
- `moves-by-generation.json` — par generation d'introduction

### Pokemon (8)
- `pokemon-by-type.json` — par type (inclut les formes)
- `pokemon-by-ability.json` — par ability
- `pokemon-by-move.json` — **learnset inverse** : pour un move, qui l'apprend
- `pokemon-by-generation.json` — par generation d'introduction
- `pokemon-by-flag.json` — legendary, mythical, ultraBeast, paradox
- `pokemon-by-top-stat.json` — par stat dominant (hp, atk, def, spa, spd, spe)
- `pokemon-by-bst-bracket.json` — par bracket BST (<350, 350-450, 450-525, 525-600, 600+)
- `pokemon-with-mega.json` — liste des especes avec forme Mega

### Items & Abilities (2)
- `items-by-category.json` — berry, heldItem, mega-stone, etc.
- `abilities-by-flag.json` — breakable, ignorable, unsuppressable

## Exclusions

- **Gigantamax** : toutes les formes Gmax exclues
- **Z-Moves** : moves et Z-crystals exclus
- **Terastallisation** : Tera shards exclus
- **Sprites** : pas d'URLs de sprites (sauf `cry` pour l'audio)
- **Oeufs** : pas d'eggGroups, eggCycles, egg moves
- **Learnsets historiques** : latest gen only (Gen 9 SV), pas d'historique par jeu

Seule mecanique extra conservee : **Megaevolution**.

## Regenerer

```bash
npx tsx packages/data/scripts/build-reference.ts
```

Options :
- `--fetch-only` : telecharger les sources sans transformer
- `--skip-fetch` : utiliser le cache existant (rapide, ~3s)

Le cache est dans `packages/data/.cache/` (gitignored). Premiere execution : ~5 min (fetches PokeAPI). Executions suivantes avec cache : ~3s.

## Schema des entites

Voir les exemples dans `docs/plans/048-pokedex-reference-knowledge-base.md`.
