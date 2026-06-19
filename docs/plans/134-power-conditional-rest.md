# Plan 134 — Power conditionnel : familles restantes

**Statut : implémenté + tests verts (2026-06-19)**

Clôt la famille « Power conditionnel » de la Phase 4. 3 moves hors-pool (signatures
sans learner Gen 1 — couverture exhaustive du Team Builder libre, pas d'OP set).

## Moves

| Nom FR | ID | Type / cat | Targeting | DynamicPowerKind |
|--------|-----|-----------|-----------|------------------|
| Hommage Posthume | `last-respects` | Spectre / Phys (50) | Single 1-1 | `AllyFaintCountScaled` |
| Branchicrok | `fishious-rend` | Eau / Phys (80) | Single 1-1 | `TargetIdleSinceLastAction` |
| Prise de Bec | `bolt-beak` | Électrik / Phys (80) | Single 1-1 | `TargetIdleSinceLastAction` |

## Mécaniques

- **`AllyFaintCountScaled`** — `move.power × (1 + alliés KO)`. Compte les Pokémon de
  `battleState.pokemon` ayant le même `playerId`, `currentHp ≤ 0`, hors lanceur. Sans
  `battleState` (preview tooltip) → puissance de base.
- **`TargetIdleSinceLastAction`** — ×2 si `target.lastActedAtAction ≤ attacker.lastActedAtAction`
  (cible fraîche ou pas encore rejouée depuis la dernière action du lanceur). Adaptation
  Charge-Temps du « frappe en premier » de Showdown — **choix humain : tempo-based**
  (vs vitesse ou alpha-strike). Cible jamais agie (`undefined`) → ×2.

## Implémentation

- `enums/dynamic-power-kind.ts` : 2 entrées.
- `battle/dynamic-power-system.ts` : 2 resolvers + helper `faintedAllyCount`.
- `data/overrides/tactical.ts` : 3 entrées (Single 1-1, `EffectKind.Damage`, `dynamicPower`).
- Tag tooltip générique « ⚡ Puissance variable » (présence de `dynamicPower`, pas d'i18n nouvelle).
- Pas d'OP set (hors-pool). Pas de changement renderer/IA (scoring dégâts générique via `getEffectivePowerFloor`).

## Tests

- `dynamic-power-system.test.ts` : 8 cas unit (AllyFaintCount ×4, TargetIdle ×4).
- `moves/{last-respects,fishious-rend,bolt-beak}.test.ts` : positionnels (portée + dégâts, scaling KO pour Hommage Posthume).
- `move-test-coverage.test.ts` vert (3 moves reconnus, zéro orphelin).

408 → **411 moves**. Famille Power conditionnel **close**.
