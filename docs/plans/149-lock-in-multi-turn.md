# Plan 149 — Famille Lock-in multi-turn

**Statut : done** (revu plan-reviewer + game-designer + move-pattern-designer 2026-07-04)
**Créé : 2026-07-04**
**Objectif : 464 → 469 moves** (5 nouveaux + 1 redesign : Colère/`outrage` existait déjà) — **livré**

## Résumé

Famille des moves « verrouillés » : le lanceur est forcé de répéter le move 2-3 tours,
puis subit une Confusion. Adaptation grille + CT :

- **Déplacement libre** pendant le verrou — seul le CHOIX du move est forcé (comme Provoc/Encore).
- **Ciblage** : le joueur choisit librement sa cible chaque tour parmi les cibles légales ;
  l'IA cible l'ennemi le plus proche (`findClosestEnemy` existe).
- **Ball'Glace** n'est PAS un lock-in canon : dans ce projet Roulade est un snowball **volontaire**
  (`RolloutStreak`). Ball'Glace en est un pur clone Glace → data seule, aucune méca nouvelle.
- **Brouhaha** : verrou 3 tours SANS confusion + **aura mobile anti-sommeil r3** autour du lanceur
  (bloque le sommeil + réveille les dormeurs dans le rayon). Sonore.

## 6 moves

| Move (FR) | id EN | Type | Cat. | BP | Ciblage | Lock-in |
|-----------|-------|------|------|----|---------| ------- |
| **Mania** | `thrash` | Normal | Phys | 120 | Single 1-1 contact | 2-3t → Confusion |
| **Danse Fleurs** | `petal-dance` | Plante | Spé | 120 | Single 1-2 | 2-3t → Confusion |
| **Colère** | `outrage` | Dragon | Phys | 120 | Single 1-1 contact | 2-3t → Confusion (**redesign**) |
| **Grand Courroux** | `raging-fury` | Feu | Phys | 120 | Single 1-1 | 2-3t → Confusion |
| **Brouhaha** | `uproar` | Normal | Spé | 90 | Cône 1-3 sonore | 3t, PAS de confusion + aura anti-sommeil r3 |
| **Ball'Glace** | `ice-ball` | Glace | Phys | 30 | Dash 2 (snowball) | — (clone Roulade volontaire) |

> Ciblages **figés** par `move-pattern-designer`. Brouhaha = `randomNormal` canon = cible unique
> (pas d'AoE ; l'aspect « zone sonore » est porté par l'aura anti-sommeil r3, séparée du ciblage
> des dégâts). Grand Courroux n'a pas le flag `contact` canon (Gen 9) mais reste Single 1-1 par
> cohérence de famille. Ball'Glace = clone exact de Roulade (`Dash maxDistance 2`).

## Décisions design (validées humain 2026-07-04)

1. Déplacement libre, move verrouillé.
2. Joueur choisit sa cible (IA = plus proche).
3. Brouhaha : aura anti-sommeil dans un **rayon r3 Manhattan autour du lanceur** (mobile), pas toute l'arène.
4. Confusion conservée en fin de verrou.

## Infra core

### Fichiers enums/types à modifier

| Fichier | Ajout |
|---------|-------|
| `enums/battle-event-type.ts` | `LockInStarted` |
| `types/battle-event.ts` (`ProtectionReason`) | `UproarNoise` |
| `types/move-definition.ts` | `lockIn?` + `uproarAura?` |
| `types/pokemon-instance.ts` | `lockInMoveId?` + `lockInTurnsRemaining?` |

### Types

- `PokemonInstance.lockInMoveId?: string` + `lockInTurnsRemaining?: number` — **champ dédié**
  (⚠️ correction plan-reviewer : NE PAS réutiliser `lockedMoveId`, déjà utilisé par charge 2 tours
  et le verrou Choix via hook → risque de collision). Nouvelle branche de filtre.
- `MoveDefinition.lockIn?: { minTurns: number; maxTurns: number; confuseOnEnd: boolean }`
  - Mania/Danse Fleurs/Colère/Grand Courroux : `{ 2, 3, true }`
  - Brouhaha : `{ 3, 3, false }`
- `MoveDefinition.uproarAura?: boolean` — active l'aura anti-sommeil r3 (Brouhaha uniquement).

**Filtre** : ajouter dans `getLegalActions` (~809) ET la garde `submitAction` (~1330), à côté du
filtre `lockedMoveId` existant :
`if (currentPokemon.lockInMoveId !== undefined && moveId !== currentPokemon.lockInMoveId) continue;`

### Module `battle/lock-in.ts`

```ts
const LOCK_IN_MIN = 2, LOCK_IN_MAX = 3;
export function isLockInMove(move): boolean            // !!move.lockIn
export function beginOrContinueLockIn(caster, move, random): { justEnded: boolean }
```

`beginOrContinueLockIn` (appelé **après la résolution complète** du move dans `executeUseMove`,
exécuté quel que soit le hit — un whiff consomme quand même un tour de verrou, canon) :
1. Si `lockInMoveId !== move.id` (pas déjà verrouillé sur ce move) → tirer
   `turns ∈ [minTurns, maxTurns]` (fixe si min===max), poser `lockInTurnsRemaining = turns`,
   `lockInMoveId = move.id`, émettre `LockInStarted`.
2. **Décrémenter APRÈS** (post-résolution) `lockInTurnsRemaining`.
3. Si `<= 0` → effacer `lockInTurnsRemaining` + `lockInMoveId` → `justEnded = true`.

Arithmétique (validée plan-reviewer) : verrou 2 → cast1 pose 2 puis décr→1 ; cast2 décr→0 = fin.
Soit **2 casts forcés** exactement. ✓

Confusion : **immédiatement** après (même passe `executeUseMove`, pas différée), si
`justEnded && move.lockIn.confuseOnEnd` → poser volatile `Confused` sur le lanceur (durée via
`rules`, comme `handleStatus`) + émettre `StatusApplied`. Immunité Terrain Brumeux respectée si
le lanceur y est (réutiliser le check existant). Note : la confusion de ce système est « soft »
(pas de dégâts self, cf. game-design §7m) → downside = perte de tempo. Choix assumé, à documenter
dans `decisions.md`.

### Intégration BattleEngine

- Appel de `beginOrContinueLockIn` dans `executeUseMove` **après** la résolution réussie du move,
  près de `recordLastUsedMove` (~1895). Indépendant de `lastUsedMoveId`.
- **Cleanup KO** (`handleKo` ~3195) : ajouter `pokemon.lockInMoveId = undefined` +
  `pokemon.lockInTurnsRemaining = undefined` (à côté du `lockedMoveId = undefined` existant).

### Module `battle/uproar-aura.ts` (Brouhaha)

- `isUproarLocked(p): boolean` = `(p.lockInTurnsRemaining ?? 0) > 0 && p.lockInMoveId === "uproar"`.
- `isUnderNoSleepAura(state, position): boolean` = un Pokémon non-KO `isUproarLocked` à distance
  Manhattan ≤ 3 de `position`. **Aucun gate grounded** (sonore, indépendant du terrain — corrige
  l'ambiguïté plan-reviewer : ≠ Terrain Brumeux qui exige grounded).
- Réveil : **au 1er cast** de Brouhaha (dans `beginOrContinueLockIn`, quand `LockInStarted` est
  émis pour un move `uproarAura`) → réveiller les dormeurs (`Asleep`) dans le rayon r3 (retirer le
  statut + émettre `StatusRemoved`). Les casts suivants n'ont pas besoin de re-réveiller (le blocage
  aura empêche tout nouveau sommeil pendant la durée).
- Blocage sommeil : dans `handle-status.ts` (branche `Asleep`, à côté du check Terrain Électrifié
  ~195) : `if (status === Asleep && isUnderNoSleepAura(state, target.position)) → StatusBlocked`
  reason `ProtectionReason.UproarNoise` (nouveau).

> Ball'Glace vs `rolloutStreak` (plan-reviewer §7) : aucune collision — `rolloutStreak` ne bump que
> pour les moves `RolloutStreak` et sur `lastUsedMoveId` ; le verrou lock-in vit sur `lockInMoveId`,
> indépendant. Ball'Glace n'active jamais de verrou (pas de `lockIn`).

### Ball'Glace (data seule)

Override `tactical.ts` miroir de `rollout` : `Dash maxDistance 2` + `dynamicPower { kind: RolloutStreak }`,
type Glace, physique, BP base 30. Aucune méca nouvelle (réutilise `rollout-streak.ts`).

## Data — `packages/data/src/overrides/tactical.ts`

- **Redesign `outrage`** : retirer l'effet `Status Confused chance 100 Self` immédiat → ajouter `lockIn { 2, 3, true }`.
- **Ajouter** `thrash`, `petal-dance`, `raging-fury` (Single/Line selon pattern) + `lockIn`.
- **Ajouter** `uproar` : `lockIn { 3, 3, false }` + `uproarAura: true` + flag sonore (`bypasssub`/sound depuis reference).
- **Ajouter** `ice-ball` : clone `rollout`.

## Renderer

- **InfoPanel** : badge volatile « Déchaîné {n}t » si `lockInTurnsRemaining > 0` ; variante « Brouhaha {n}t » si move = `uproar`.
- **BattleLogFormatter** : cas `LockInStarted`, `StatusBlocked` reason `UproarNoise`, confusion de fin (déjà géré via StatusApplied).
- **MoveTooltip** : tags « 🔁 Verrouillé 2-3t (Confusion) », « 🔊 Sonore », Brouhaha « 🔊 Anti-sommeil r3 ».
- **Aura Brouhaha** : réutiliser le système d'indicateurs d'aura (barrières/Requiem) — icône hover 🔊 sur les tuiles r3. Idempotent sur PokemonMoved/TurnEnded (aura mobile).

## AI (`action-scorer.ts`)

- Les moves 120 BP passent déjà par `scoreDamagingMove` (joués pour les dégâts) → fonctionnels.
- Garde-fou minimal : pas de sur-valorisation ; ne rien scorer de spécial si déjà verrouillé (choix imposé de toute façon).
- **Reporté** (passe IA groupée) : valoriser l'engagement du verrou (committer 2-3 tours sur une cible sûre),
  Brouhaha comme déni de sommeil. Non bloquant.

## i18n FR/EN

Nouvelles clés : badges lock-in / Brouhaha (InfoPanel), lignes journal (`LockInStarted`, sommeil bloqué Brouhaha),
tags tooltip.

## Tests

- **Unit** : `lock-in.test.ts` (roll min/max, décrément, fin → confusion, Brouhaha sans confusion, cleanup KO),
  `uproar-aura.test.ts` (blocage r3 + hors r3, réveil dormeurs).
- **Move tests** (obligatoire, meta-test coverage) : `thrash`, `petal-dance`, `outrage` (redesign),
  `raging-fury`, `uproar`, `ice-ball`.
- Gate CI complet.

## Hors scope / reporté

- Interruption du verrou sans confusion (cible immunisée, disruption) — le verrou va au bout puis confusion. Déviation canon mineure assumée.
- e2e Playwright (piloter le verrou via UI) — reporté, non bloquant (logique en unit).
- Heuristiques IA fines — reporté passe groupée.

## Résultat (2026-07-04)

5 moves nouveaux + 1 redesign (Colère/`outrage` existait déjà), **464 → 469 moves**. Décisions #611–#616 (`docs/decisions.md`).
