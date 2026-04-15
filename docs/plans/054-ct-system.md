---
status: done
created: 2026-04-15
updated: 2026-04-15
---

# Plan 054 — Système CT (Charge Time)

## Objectif

Remplacer le round-robin par un système CT (Charge Time) où la vitesse détermine la fréquence d'action, et le coût CT varie par type d'action. Les deux systèmes coexistent derrière une interface `TurnSystem` sélectionnable via `BattleConfig`.

## Contexte

Design finalisé dans `docs/reflexion-systeme-ct.md` (décisions #254-256).

Paramètres retenus :
- `ctGain = floor((30 + floor(20 × ln(baseStat + 1))) × softMult(stages × 0.7))`
- CT départ = 600, seuil action = 1000, 1 acteur par tick
- `ctCost = max(ppCost(pp), powerFloor(power), effectFloor(effectTier))`
- `effectTier` dans `tacticalOverrides`, PP et power depuis les données

Coûts actions de base :
- Wait = 350, Move seul = 400, Move+Attaque = move + atk - 150
- Attaque 20PP = 500, 16PP = 600, 12PP = 700, 8PP = 900
- powerFloor : ≥70 → 600, ≥90 → 700, ≥110 → 900
- effectTier : `reactive` = 500 fixe, `major-status` = floor 700, `major-buff` = floor 600, `double-buff` = floor 550

## Étapes

### Étape 1 — Interface TurnSystem dans le core

Créer `packages/core/src/battle/TurnSystem.ts` :

```typescript
export interface TurnSystem {
  getNextActorId(): string;
  onActionComplete(pokemonId: string, actionCost: number): void;
  onPokemonKO(pokemonId: string): void;
}
```

Créer `packages/core/src/enums/turn-system-kind.ts` :
```typescript
export const TurnSystemKind = { RoundRobin: 'round-robin', ChargeTime: 'charge-time' } as const;
export type TurnSystemKind = typeof TurnSystemKind[keyof typeof TurnSystemKind];
```

Ajouter `turnSystem?: TurnSystemKind` dans `BattleConfig` (défaut `'round-robin'`).

### Étape 2 — RoundRobinTurnSystem

Extraire la logique de `TurnManager` dans `packages/core/src/battle/RoundRobinTurnSystem.ts` implémentant `TurnSystem`. Le `TurnManager` existant est gardé tel quel (ne pas casser les tests) — `RoundRobinTurnSystem` est une façade mince qui délègue à `TurnManager`.

Tests : les tests existants de `TurnManager` couvrent déjà le comportement — vérifier qu'ils passent toujours.

### Étape 3 — Helpers coût CT

Créer `packages/core/src/battle/ct-costs.ts` :
- `ppCost(pp: number): number`
- `powerFloor(power: number | undefined): number`
- `effectFloor(tier: EffectTier | undefined): number`
- `computeCtCost(move: MoveData, override: TacticalOverride): number`

Ajouter le type `EffectTier` dans `packages/core/src/enums/effect-tier.ts` :
```typescript
export const EffectTier = {
  Reactive: 'reactive',
  MajorStatus: 'major-status',
  MajorBuff: 'major-buff',
  DoubleBuff: 'double-buff',
} as const;
```

Ajouter `effectTier?: EffectTier` dans `TacticalOverride`.

Tests unitaires pour `ct-costs.ts` (tous les paliers, les cas max, les moves sans power).

### Étape 4 — effectTier dans tacticalOverrides

Mettre à jour `packages/data/src/overrides/tactical.ts` avec les `effectTier` des moves non-offensifs :

| effectTier | Moves |
|-----------|-------|
| `reactive` | protect, detect, wide-guard, quick-guard, counter, mirror-coat, metal-burst, endure |
| `major-status` | thunder-wave, hypnosis, sing, sleep-powder, toxic |
| `major-buff` | swords-dance, agility, iron-defense, minimize |
| `double-buff` | calm-mind, bulk-up, withdraw, stockpile |

### Étape 5 — ChargeTimeTurnSystem

Créer `packages/core/src/battle/ChargeTimeTurnSystem.ts` :

```typescript
export class ChargeTimeTurnSystem implements TurnSystem {
  private ctMap: Map<string, number>;          // pokemonId → CT actuel
  private readonly threshold = 1000;
  private readonly startCt = 600;

  constructor(pokemonIds: string[], getSpeed: (id: string) => number) { ... }

  tick(): void { /* +ctGain pour tous les vivants */ }
  getNextActorId(): string { /* tick() jusqu'à CT ≥ threshold, retourne le + haut CT */ }
  onActionComplete(pokemonId: string, cost: number): void { /* CT -= cost */ }
  onPokemonKO(pokemonId: string): void { /* retire de ctMap */ }

  getCtSnapshot(): Record<string, number> { /* pour le renderer timeline */ }
}
```

`ctGain(baseStat, stages)` = formule V3 (voir paramètres ci-dessus).

Tests unitaires : ratio Pikachu/Geodude neutre ≈ 1.50×, Agility +2 → Δ+2 actions sur 20, Shuckle/Regieleki ratio ≤ 1.5×, burn punit les rapides, KO retire du système.

### Étape 6 — Intégration dans BattleEngine

Dans `BattleEngine` :
- Injecter `TurnSystem` au lieu de `TurnManager` directement
- Factory dans `BattleEngine` : `BattleConfig.turnSystem === 'charge-time'` → crée `ChargeTimeTurnSystem`, sinon `RoundRobinTurnSystem`
- `onActionComplete` appelé après chaque `submitAction` réussie avec le coût calculé par `computeCtCost`
- `onPokemonKO` appelé depuis le handler de KO existant

### Étape 7 — Timeline renderer (CT mode)

Dans `packages/renderer/` :
- `ChargeTimeTurnSystem.getCtSnapshot()` expose l'état CT courant
- La timeline affiche les barres CT (progression vers le seuil) au lieu de l'ordre round-robin
- Nouveau event `BattleEventKind.CtUpdated` émis par le core après chaque tick (optionnel si le renderer peut interroger l'état directement)

### Étape 8 — Tests scénario de régression

Ajouter un test scénario `ct-system.scenario.test.ts` :
- Combat 6v6 complet en mode CT sans crash
- Ratio actions entre 2 Pokemon de vitesses différentes dans la cible (1.3-1.6×)
- Statuts (burn, para) pénalisent correctement les rapides

## Flow de maintenance — Nouveaux moves et MAJ Champions

Ce flow s'applique à chaque fois qu'un move est ajouté/modifié dans le jeu.

### Ajout d'un nouveau move offensif

1. `data-miner` — extrait PP et puissance depuis la référence locale (`packages/data/reference/`) ou PokeAPI/Champions si absent
2. Coût CT calculé automatiquement par `computeCtCost` (PP + powerFloor) — **pas d'intervention manuelle**
3. `test-writer` — crée le fichier de test d'intégration du move
4. `game-designer` — vérifie que le coût calculé est cohérent avec le ressenti tactique

### Ajout d'un nouveau move non-offensif (status, buff, défensif)

1. `data-miner` — extrait les données de base
2. **Décision manuelle obligatoire** : game-designer assigne l'`effectTier` dans `tacticalOverrides`
   - Consulter la table des tiers dans `docs/reflexion-systeme-ct.md`
   - Si le move ne rentre dans aucun tier → PP seul suffit (laisser `effectTier` absent)
3. `test-writer` — crée le test d'intégration
4. `game-designer` — valide l'équilibre

### MAJ Champions (PP ou puissance changent)

1. Mettre à jour les données dans `packages/data/reference/` ou `balance-v1.ts` (PP overrides)
2. `computeCtCost` recalcule automatiquement le coût — **aucune autre intervention**
3. `game-designer` — vérifie les moves potentiellement déséquilibrés (ceux proches d'un palier de coût)
4. `balancer` — lance N combats headless si plusieurs moves sont impactés simultanément

### MAJ Champions (effets changent)

1. Mettre à jour `tacticalOverrides` (effects array)
2. Si l'effet change de catégorie (ex: move qui devient sleep au lieu de para) → revoir l'`effectTier`
3. `game-designer` — valide
4. `test-writer` — met à jour le test d'intégration du move

### Règle `.claude/rules/` associée

Ajouter dans `.claude/rules/core.md` (ou créer `.claude/rules/ct-costs.md`) :
> Quand on ajoute un move non-offensif dans `tactical.ts`, toujours vérifier si un `effectTier` doit être attribué. Consulter la table des tiers dans `docs/reflexion-systeme-ct.md`.

## Agents déclenchés

| Moment | Agent |
|--------|-------|
| Après étape 3 (ct-costs.ts) | `core-guardian` |
| Après étape 5 (ChargeTimeTurnSystem) | `core-guardian` + `test-writer` |
| Après étape 6 (BattleEngine) | `core-guardian` + `code-reviewer` |
| Après étape 7 (renderer) | `visual-tester` |
| Fin du plan | `doc-keeper` + `commit-message` |
| Nouveau move ajouté (maintenance) | `data-miner` + `test-writer` + `game-designer` |
| MAJ Champions PP/power (maintenance) | `game-designer` (+ `balancer` si impacts multiples) |

## Fichiers impactés

**Nouveaux :**
- `packages/core/src/battle/TurnSystem.ts`
- `packages/core/src/battle/RoundRobinTurnSystem.ts`
- `packages/core/src/battle/ChargeTimeTurnSystem.ts`
- `packages/core/src/battle/ct-costs.ts`
- `packages/core/src/enums/turn-system-kind.ts`
- `packages/core/src/enums/effect-tier.ts`
- `packages/core/src/battle/ct-costs.test.ts`
- `packages/core/src/battle/ChargeTimeTurnSystem.test.ts`
- `packages/core/src/battle/ct-system.scenario.test.ts`

**Modifiés :**
- `packages/core/src/battle/BattleEngine.ts` — injection TurnSystem, appel onActionComplete/onPokemonKO
- `packages/core/src/types/battle-config.ts` — champ `turnSystem`
- `packages/data/src/overrides/tactical.ts` — champ `effectTier` sur les moves concernés
- `packages/renderer/` — timeline CT (étape 7)
- `packages/core/src/index.ts` — exports des nouveaux types publics
