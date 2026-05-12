# OP Sets — curated competitive sets

Base de données d'équipes/sets compétitifs pour les 81 Pokemon du roster Gen 1.

## Fichier

`op-sets.json` — data brute curée. **Ne pas éditer le `reference/*.json`** : c'est ici qu'on stocke les sets pratiqués IRL.

## Schema

Voir `docs/plans/082-op-sets-curation-gap-analysis.md` — `OpSetEntry`.

Champs :
- `id` (kebab-case, unique, convention `{pokemonId}-{role}`)
- `pokemonId` (kebab-case, doit exister dans roster)
- `name` (libellé humain)
- `role?` (physical-sweeper / special-sweeper / wallbreaker / tank / support / pivot / stallbreaker / lead)
- `ability` (Showdown kebab-case)
- `heldItemId?` (Showdown kebab-case, `null` = pas d'item)
- `nature` (Showdown lowercase, ex: `timid`, `adamant`)
- `moveIds` (kebab-case, 1-4 moves)
- `statSpread` (Partial<Record<HP/Atk/Def/SpA/SpD/Spe, number>> en SP — total ≤66, max 32/stat)
- `gender?` (`male` | `female` | `genderless` | `null`)
- `source` (`smogon` | `coupcritique` | `custom`)
- `sourceUrl?`
- `notes?`

## Sourcing — conventions

### Smogon (anglais, gen 9 SV puis fallback)
- URL pattern : `https://www.smogon.com/dex/sv/pokemon/{lowercase-id}/`
- Tiers : Ubers, OU, UU, RU, NU, PU (priorité Ubers > OU)
- Fallback Gen ancien : `rb`, `gs`, `rs`, `dp`, `bw`, `xy`, `sm`, `ss`
- Format : copier output `Import to PS!` (Showdown text)

### CoupCritique (FR, communauté)
- URL : `https://coupcritique.fr/pokedex/{id}/sets`
- Sets RMT communauté, FR → conversion noms EN via i18n `data` package

### Custom (fallback)
- Quand sourcing externe vide ou incompatible roster
- Base : movepool actuel `roster-poc.ts`
- `source: "custom"` obligatoire, `sourceUrl` omis

## Cible volumétrie

- ≥81 sets (≥1 par Pokemon roster, sécurité)
- Cible globale : **150-200 sets** (1 obligatoire + 0-2 alt rôles différents)

## Conventions kebab-case

Tous les IDs (move/ability/item/Pokemon) en kebab-case Showdown-réversible via `toShowdownId(kebab)` :
- `fire-blast` ↔ `fireblast`
- `heavy-duty-boots` ↔ `heavydutyboots`

## Validation

`pnpm op-sets:analyze` (plan 082 étape 3) vérifie :
- schema conforme
- pas de duplicate `id`
- kebab-case réversible
- chaque mon roster a ≥1 set
- exit 0 si OK, 1 si malformé

Le script **ne bloque pas** sur IDs non implémentés Champions (gap analysis = but).

## Hors scope

- Loader runtime → plan 084
- "Apply set" UI builder → plan 085
- VGC / Doubles / Random Battles → singles only
