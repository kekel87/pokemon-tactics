---
status: done
created: 2026-04-01
updated: 2026-04-01
---

# Plan 025 — Tests d'intégration par move

## Objectif

Créer un fichier de test d'intégration par move (56 fichiers) dans `packages/core/src/battle/moves/`, testant chaque move de bout en bout sur une grille 6x6. Core only, pas de renderer.

Scope final étendu en cours de plan : 9 fichiers de mécaniques transversales dans `packages/core/src/battle/mechanics/`, gaps comblés dans les tests existants, et nettoyage des doublons entre les fichiers d'intégration.

## Contexte

Le core a 333 tests unitaires avec 100% de coverage, mais les tests d'intégration existants (`battle-loop.integration.test.ts`, `BattleEngine.integration.test.ts`) couvrent des scénarios transversaux (poison qui tue, sleep+drain, paralysie) sans tester chaque move individuellement. Avec 56 moves et 9 patterns différents, on veut garantir que chaque move se comporte correctement de bout en bout : portée, effets, interactions avec les défenses.

Les tests défensifs du plan 023 ont introduit un pattern Gherkin dans `handle-defensive.test.ts` — les tests move peuvent s'en inspirer pour les scénarios complexes.

## Étapes

- [ ] Étape 1 — Créer le helper `buildMoveTestEngine` dans `packages/core/src/testing/`
  - Nouveau fichier `packages/core/src/testing/build-move-test-engine.ts`
  - Charge `loadData()` une fois (pas de cache — Vitest isole les modules par fichier)
  - Crée un engine sur grille 6x6 (`MockBattle.stateFrom(pokemon, 6, 6)`)
  - Construit la `pokemonTypesMap` à partir de `data.pokemon`
  - Signature : `buildMoveTestEngine(pokemon: PokemonInstance[]): { engine: BattleEngine; state: BattleState; data: ReturnType<typeof loadData> }`
  - Exporter depuis `packages/core/src/testing/index.ts`

- [ ] Étape 2 — Batch 1 : moves Single target (dégâts purs + statuts)
  - Fichiers : `scratch.test.ts`, `tackle.test.ts`, `pound.test.ts`, `headbutt.test.ts`, `bite.test.ts`, `karate-chop.test.ts`, `seismic-toss.test.ts`, `rock-throw.test.ts`, `confusion.test.ts`, `ember.test.ts`, `water-gun.test.ts`, `thunder-wave.test.ts`, `hypnosis.test.ts`, `kinesis.test.ts`, `lick.test.ts`
  - Template pour chaque fichier :
    - Hit à portée max : dégâts > 0 sur la cible
    - Miss hors portée : `submitAction` retourne `ActionError.OutOfRange` ou move absent de `getLegalActions`
    - Statut/stat change le cas échéant : vérifier `statusEffects` ou `statStages` après le hit (mock `Math.random` à 0 pour forcer le proc)

- [ ] Étape 3 — Batch 2 : moves Self (buffs stat)
  - Fichiers : `withdraw.test.ts`, `bulk-up.test.ts`, `double-team.test.ts`, `minimize.test.ts`, `defense-curl.test.ts`, `calm-mind.test.ts`, `agility.test.ts`, `stockpile.test.ts`
  - Template :
    - Utiliser le move sur soi-même : `statStages` augmenté correctement
    - Les stages s'accumulent sur 2 utilisations
    - Le move est toujours disponible dans `getLegalActions` (ciblage self, pas de portée)

- [ ] Étape 4 — Batch 3 : moves AoE directionnels (Cone, Line, Slash)
  - Fichiers : `gust.test.ts`, `bubble-beam.test.ts`, `sand-attack.test.ts`, `dragon-breath.test.ts`, `sing.test.ts`, `blizzard.test.ts`, `icy-wind.test.ts`, `razor-leaf.test.ts`, `wing-attack.test.ts`, `psybeam.test.ts`, `thunderbolt.test.ts`, `flamethrower.test.ts`, `aurora-beam.test.ts`
  - Template :
    - Positionner 2 ennemis dans le cône/ligne/slash : les deux prennent des dégâts
    - Positionner 1 ennemi hors du cône : pas de dégâts
    - Statut/stat change le cas échéant (blizzard freeze, icy-wind -Speed, aurora-beam -Attack)

- [ ] Étape 5 — Batch 4 : moves AoE centrés (Zone, Cross, Blast)
  - Fichiers : `sleep-powder.test.ts`, `smokescreen.test.ts`, `magnitude.test.ts`, `sludge-bomb.test.ts`, `rock-smash.test.ts`, `night-shade.test.ts`
  - Template Zone/Cross :
    - Cibles dans le rayon : toutes affectées
    - Cible hors rayon : non affectée
  - Template Blast :
    - Cibler position entre caster et ennemi : dégâts sur les cibles dans l'explosion
    - Cibler derrière un défenseur avec Protect : Blast contourne Protect (logique `targetPosition` pour Protect)

- [ ] Étape 6 — Batch 5 : moves Dash (repositionnement)
  - Fichiers : `quick-attack.test.ts`, `volt-tackle.test.ts`, `rollout.test.ts`, `flame-wheel.test.ts`
  - Template :
    - Dash vers ennemi adjacent : dégâts + caster repositionné devant l'ennemi
    - Dash vers case vide : repositionnement sans dégâts
    - Dash n'utilise pas `hasMoved` : Move + Dash et Dash + Move tous deux permis
    - Statut le cas échéant (flame-wheel burn, volt-tackle damage)

- [ ] Étape 7 — Batch 6 : moves Link (Vampigraine)
  - Fichier : `leech-seed.test.ts`
  - Template :
    - Appliquer Leech Seed sur cible : `activeLinks` contient un lien LeechSeed
    - EndTurn : drain appliqué (cible perd HP, source gagne HP)
    - Source KO : lien rompu
    - Cible hors portée (`maxRange`) : lien rompu

- [ ] Étape 8 — Batch 7 : moves défensifs
  - Fichiers : `protect.test.ts`, `detect.test.ts`, `wide-guard.test.ts`, `quick-guard.test.ts`, `counter.test.ts`, `mirror-coat.test.ts`, `metal-burst.test.ts`, `endure.test.ts`
  - Template Protect/Detect :
    - Activer Protect face à l'ennemi : attaque Single bloquée (`DefenseActivated` event)
    - Attaque depuis le côté ou derrière : Protect ne bloque pas
  - Template Wide Guard :
    - Activer Wide Guard : attaque AoE (Zone, Cross, Cone, Slash, Blast) bloquée
    - Attaque Single non bloquée par Wide Guard
  - Template Counter/Mirror Coat :
    - Activer Counter, subir attaque physique : riposte x2 sur l'attaquant
    - Activer Mirror Coat, subir attaque spéciale : riposte x2 sur l'attaquant
  - Template Endure :
    - HP à 1, subir attaque fatale : survivre à 1 HP
    - Endure deux tours de suite : bloqué (spam check)

## Structure des fichiers de test

Tous les fichiers dans `packages/core/src/battle/moves/`.

Pattern d'import standard pour chaque fichier :

```typescript
import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

// buildEngine local (charge les vraies données, grille 6x6)
function buildEngine(pokemon: ...) { ... }
```

Les `vi.spyOn(Math, "random")` ne sont utilisés que pour forcer les procs de statut/accuracy. Les tests de hit/miss positionnels ne nécessitent pas de mock (portée résolue géométriquement).

## Critères de complétion

- 56 fichiers `.test.ts` créés dans `packages/core/src/battle/moves/`
- 9 fichiers `.test.ts` créés dans `packages/core/src/battle/mechanics/`
- `pnpm test` passe avec 100% coverage (threshold maintenu)
- Chaque move a au moins : 1 test "touche à portée" + 1 test "ne touche pas hors portée" + 1 test par effet secondaire
- Chaque mécanique transversale couverte de bout en bout (STAB, type chart, statuts, PP, friendly fire)
- Le helper `buildMoveTestEngine` est exporté depuis `packages/core/src/testing/index.ts`
- Aucun test inline dans les fichiers (mocks dans `testing/`)
- Zéro doublons entre `mechanics/` et les fichiers d'intégration existants (`battle-loop.integration.test.ts`, `BattleEngine.integration.test.ts`)

## Résultat final

- **534 tests unitaires** (91 fichiers) + **48 tests intégration** (4 fichiers) = **582 tests**
- 56 fichiers `battle/moves/` + 9 fichiers `battle/mechanics/` = 65 nouveaux fichiers de test
- `test-writer.md` mis à jour : maintenance par move et mechanics, templates par pattern
- `CLAUDE.md` mis à jour : déclencheur "Ajout/suppression/modif d'un move → test-writer"

## Risques / Questions

- **Coverage threshold** : les 56 nouveaux fichiers de test ne doivent pas créer de branches non couvertes dans le core. Si un effet de move n'est testé nulle part dans le core existant, l'étape correspondante doit couvrir ce gap.
- **`Math.random` mocks** : certains tests nécessitent des séquences précises de mocks (accuracy + status chance + durée sleep). Documenter l'ordre des appels dans un commentaire au-dessus du mock, comme dans `battle-loop.integration.test.ts`.
- **Moves avec accuracy < 100%** : les tests de "touche à portée" doivent mocker `Math.random` à 0 pour garantir le hit. Ne pas tester le miss aléatoire (non déterministe).
- **56 fichiers en batch** : les étapes 2 à 8 peuvent être exécutées en sessions séparées. L'ordre recommandé est : Étape 1 → n'importe quel batch, mais les tests défensifs (Étape 8) sont plus complexes et peuvent s'appuyer sur les helpers des étapes précédentes.

## Dépendances

- **Prérequis** : Plan 023 terminé (8 moves défensifs + handlers), Plan 024 terminé (infrastructure stable)
- **Ce plan débloque** : review des movesets par l'humain (les tests révèlent les déséquilibres), ajout de nouveaux moves Phase 1 (stat changes, confusion) avec tests d'emblée
