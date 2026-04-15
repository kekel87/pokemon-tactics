# Processus de mise à jour des données Pokemon

> Champions est la source de vérité du jeu. Showdown Gen 9 fournit la base,
> Champions override par-dessus (PP, puissance, effets, learnsets).

## Quand lancer

- Un nouveau patch Pokemon Champions est sorti
- Initialisation d'un environnement de dev (pas de `reference/` ou cache périmé)
- Ajout d'un nouveau Pokemon au roster POC (besoin de sa data)
- Doute sur la fraîcheur des données

## Workflow

```bash
# 1. Mettre à jour les données (fetch + override Champions + write)
pnpm data:update

# 2. Voir le diff humainement reviewable
pnpm data:diff

# 3. Review, puis commit
git add packages/data/reference/
git commit -m "data: update reference from Champions <date>"
```

## Variantes

```bash
# Utiliser le cache local existant (plus rapide, ~3s)
pnpm data:update:skip-fetch

# Ne fetch que, sans transformer (pour debugger le fetch)
pnpm data:update:fetch-only
```

Cache local : `packages/data/.cache/` (gitignored). Premier run : ~5 min (fetches PokeAPI). Runs suivants avec cache : ~3s.

## Sources

| Donnée | Source | URL |
|---|---|---|
| Base stats, types, abilities | Showdown Gen 9 | `play.pokemonshowdown.com/data/pokedex.json` |
| Moves (power, accuracy, flags, pp, secondary) | Showdown Gen 9 | `play.pokemonshowdown.com/data/moves.json` |
| Learnsets (base) | Showdown Gen 9 | `play.pokemonshowdown.com/data/learnsets.json` |
| Abilities | Showdown Gen 9 | `play.pokemonshowdown.com/data/abilities.json` |
| Items | Showdown Gen 9 | `play.pokemonshowdown.com/data/items.json` |
| Type chart | Showdown Gen 9 | `play.pokemonshowdown.com/data/typechart.json` |
| Noms FR + flavor text | PokeAPI | `pokeapi.co/api/v2/` |
| **Override Champions** (moves, learnsets, abilities, items) | Showdown mod | `raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/` |
| **Statuts Champions** (paralysie 12.5%, gel, sommeil) | Transcription manuelle | `CHAMPIONS_STATUS_MANUAL` dans `fetch-champions.ts` |

### Pourquoi PokeAPI pas Champions pour les noms FR ?

PokeAPI a un endpoint `version-group/32` pour Champions mais les données sont vides à ce jour (PokeAPI est toujours en retard de plusieurs mois sur les nouvelles sorties). Les noms FR restent sur Gen 9 via PokeAPI — acceptable car la grande majorité des moves/Pokemon existent déjà.

## Fichiers produits

```
packages/data/reference/
├── pokemon.json              # Espèces + formes, stats/types/abilities/learnsets Champions
├── moves.json                # Moves avec overrides Champions (power, pp, maxPp, secondary, etc.)
├── abilities.json            # Abilities avec descriptions Champions si différentes
├── items.json                # Items (PokeAPI base)
├── type-chart.json           # Table 18x18
├── champions-status.json     # Règles de statuts Champions (consommé par plan 057)
├── indexes/                  # 19 index inversés régénérés
└── schema/                   # Schemas JSON (non régénérés)
```

**Convention** : `reference/*.json` contient directement les valeurs Champions. Pas de couche supplémentaire côté loaders. Les tests qui assertent sur des valeurs spécifiques (PP, power) doivent utiliser les valeurs Champions.

## Cas d'échec

| Symptôme | Cause probable | Solution |
|---|---|---|
| `HTTP 404 for https://raw.githubusercontent.com/.../champions/moves.ts` | Showdown a déplacé/renommé le mod | Vérifier manuellement l'URL + MAJ `CHAMPIONS_BASE` dans `fetch-champions.ts` |
| `Warning: N override(s) target IDs not in our base` | Champions introduit un move/item nouveau absent de Gen 9 Showdown | Ajouter manuellement à la base (hors scope de ce pipeline) ou accepter |
| Tests `golden-replay` divergent | Les PP/power Champions changent l'ordre CT d'un replay | Régénérer le snapshot après validation humaine : `pnpm replay:generate` |
| `champions-status.json` pas à jour | Nouveau patch Champions change un taux de statut | MAJ manuelle de `CHAMPIONS_STATUS_MANUAL` dans `fetch-champions.ts` après lecture de `conditions.ts` |

## Limitations connues

- **Noms FR** absents pour les moves/items/pokemon introduits en Champions et pas encore dans PokeAPI → fallback sur EN
- **Items Champions-exclusifs** (nouvelles mega-stones, etc.) ignorés s'ils ne sont pas dans la base PokeAPI
- **Stats des espèces** : Champions n'override pas les stats aujourd'hui, on garde Gen 9. Si ça change, ajuster `parseChampionsPokemon` dans `fetch-champions.ts`
- **Logique TS Showdown** (`onHit`, `onTry`, etc.) non transférée — on ne garde que la data, pas les fonctions

## MAJ manuelle de `CHAMPIONS_STATUS_MANUAL`

Seul champ qui nécessite une intervention humaine lors d'un patch Champions. Procédure :

1. Aller sur `https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/conditions.ts`
2. Chercher les entrées `par`, `slp`, `frz`
3. Noter les valeurs de `randomChance(a, b)`, `sample([...])`, `startTime = N`
4. MAJ `CHAMPIONS_STATUS_MANUAL` dans `packages/data/scripts/fetch-champions.ts`
5. Commit avec message `data: update Champions status rules from conditions.ts <date>`

Événement rare (quelques fois par an au maximum).
