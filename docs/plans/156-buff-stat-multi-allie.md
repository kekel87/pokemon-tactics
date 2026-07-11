# Plan 156 — Buff de stat multi-allié (Grondement + Magné-Contrôle) — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-07-11
> Terminé : 2026-07-11
> Auteur : Claude
> Dépend de : G5 (Coaching, `targetsAlly` single-allié), plan 116 B2 (life-dew `HealTarget.radius` = pattern buff-allié-radius), plan 146 (`pokemonInRadius`), plan 153 (`effectiveAbilityId`).
> Débloque : ferme l'item roadmap « Buff de stat multi-allié (~2) » → Phase 4 résidus.

## Objectif

Étendre le buff de stat allié du single-cible (Coaching) à un **AoE auto-centré sur le lanceur** (self + alliés en zone). 2 moves :

- **Grondement** (`howl`, Normal Statut) — Attaque +1 au lanceur + alliés en zone. Learnable Gen 1 : **Feunard, Arcanin, Caninos** → in-pool, fonctionnel.
- **Magné-Contrôle** (`magnetic-flux`, Électrik Statut) — Déf + Déf.Spé +1 au lanceur + alliés en zone **ayant le talent Plus ou Minus**. Learnable Gen 1 : Électrode, Zapdos → in-pool **mais no-op** (0 Pokemon Gen 1 n'a Plus/Minus, talents Gen 3). **Codé par complétude** (décision humaine 2026-07-11) : marchera dès que Plus/Minus arriveront.

## Décisions verrouillées (humain 2026-07-11)

1. **Rayon Grondement** = **zone diamant Manhattan r2** auto-centrée sur le lanceur (compromis entre le « adjacent allies » canon et les zones étalées de la grille).
2. **Magné-Contrôle** = **fidèle** : gate talent Plus/Minus conservé → no-op actuel, pas de réinterprétation. UX : Électrode/Zapdos ont le move, il fizzle tant que personne n'a Plus/Minus.
3. Nom FR officiel = **Magné-Contrôle** (i18n `moves.fr.json`), PAS « Influx Magnétik » (roadmap corrigée).

## Design technique — réutilise `StatChange` (0 nouveau EffectKind)

Mirror exact de `HealTarget.radius` (life-dew) : `targeting: { kind: Self }` + effet à `radius`.

### Core

- **`effect.ts`** — étendre la variante `StatChange` :
  - `radius?: number` — quand présent, au lieu de `target`, applique à **tous les mons vivants du même `playerId` dans le diamant Manhattan `radius`** centré sur le lanceur (inclut le lanceur, distance 0). Mirror life-dew.
  - `abilityGate?: string[]` — quand présent, filtre les récipiendaires du rayon à ceux dont `effectiveAbilityId(p)` ∈ gate (Magné-Contrôle : `["plus", "minus"]`).
- **`handle-stat-change.ts`** — nouvelle branche en tête : si `effect.radius !== undefined`, calcule `affectedPokemon` = filtre `state.pokemon` (vivant + même équipe + `manhattanDistance ≤ radius` + gate talent optionnel). Sinon comportement actuel (`Self`/`Targets`). Buff (stages > 0, `isEnemyDebuff = false`) → saute tout le blocage Brume/Clone/talent (déjà le cas). Émet un `StatChanged` par récipiendaire.

### Data

- **`tactical.ts`** :
  - `howl`: `targeting: Self`, effet `StatChange` Attaque +1 `radius: 2`, `effectTier: MajorBuff`.
  - `magnetic-flux`: `targeting: Self`, 2 effets `StatChange` (Défense +1, SpéDéfense +1) `radius: 2` + `abilityGate: ["plus","minus"]`, `effectTier: DoubleBuff`.

### AI

- **`action-scorer.ts`** `scoreSelfMove` : nouvelle branche pour `StatChange` avec `radius` → score par nombre d'alliés (incl. self) dans le rayon × valeur de buff (mirror life-dew radius-heal à la ligne ~884). Magné-Contrôle : score 0 si aucun allié-en-rayon ne passe le gate (évite un blunder visible).

### i18n / renderer

- Noms FR/EN déjà présents (Grondement/Howl, Magné-Contrôle/Magnetic Flux).
- Targeting `Self` → aucune sélection de cible (auto). Les events `StatChanged` sont déjà animés par le renderer.
- MoveTooltip : tag existant des buffs suffit ; option tag « zone alliés » différée si non trivial.

### Tests

- `packages/core/src/battle/moves/howl.test.ts` : buff Attaque +1 lanceur + alliés en r2, pas les alliés hors r2, pas les ennemis.
- `packages/core/src/battle/moves/magnetic-flux.test.ts` : no-op si personne n'a Plus/Minus ; buff Déf/DéfSpé +1 sur un allié `abilityId: "plus"` en rayon (prouve que l'infra gate marche pour le futur).
- Meta-test `move-test-coverage` : 2 nouveaux moves → 2 fichiers test obligatoires.

## Périmètre exclu

- Talents Plus/Minus (Gen 3) — non implémentés, hors scope.
- Grondement (`howl`) réinterprétation dégât/priorité — aucune, c'est un pur buff statut.
- Réinterprétation Magné-Contrôle sans gate — rejetée (décision 2).

## Compteur

498 → ~~500 moves~~ (déjà à 500 après plan 155) → **500 → 502 moves.**
