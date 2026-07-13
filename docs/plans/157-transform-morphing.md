---
numero: 157
titre: Morphing / Imposteur / Métamorph (batch B-META)
statut: done
date: 2026-07-12
famille: transform
depends_on: [128, 135, 143, 146, 153, 099, 144]
decisions: [647, 648, 649, 650, 651, 652, 653, 654, 655, 656, 657, 658, 659]
---

# Plan 157 — Morphing, Imposteur, Métamorph (batch B-META)

## Livré

Batch clos et validé (human-testing OK, 2026-07-12). **502 → 503 moves** (Morphing/`transform`,
Mew), **+1 talent** (Imposteur/`imposter`), **150 → 151 Pokemon jouables** (Métamorph/Ditto,
dernier Gen 1 manquant). Architecture : champ unique `pokemon-instance.ts` `transformState`
(snapshot stats/types/moves/talent/poids/genre) + priorité `override spécifique > transformState >
espèce` (#656) ; helpers `effectiveCombatStats`/`effectiveMoveIds`/`effectiveWeight`/
`effectiveGender` + extension `effectiveAbilityId`/`resolveBaseTypes`/`effectiveBaseSpeed` ; reset
au KO. Morphing = Statut Single **r3** (portée étendue au playtest, #658), PV/niveau inchangés,
échoue sur Clone/déjà-transformé/cible Imposteur. Imposteur = auto-morph à l'entrée sur l'ennemi le
plus proche. Métamorph = entrée roster `custom` (movepool `[transform]`, genderless, stats 48
partout). Type copié pilote pleinement le terrain (#659). Renderer : swap sprite via event
`Transformed` + port `setSpecies`. IA : garde-fou `scoreTransformApplication` (#657). Sprite Ditto
0132 extrait, bundle repacké (152 sprites). **Reporté** : e2e (`test-writer`), heuristiques IA
fines.

## Contexte & objectif

Batch de 3 items liés autour de la copie d'identité :

1. **Morphing** (`transform`, Normal, Statut, cible `normal`) — le lanceur devient une
   copie de la cible : stats de combat, crans de stats, types, 4 moves, talent, poids,
   genre, sprite. Niveau et PV du lanceur **inchangés**. Appris par **Mew** dans notre
   roster → livrable immédiatement.
2. **Imposteur** (`imposter`, talent) — déclenche Morphing à l'entrée en combat sur un
   adversaire. Mécaniquement identique au move.
3. **Métamorph** (Ditto, `ditto`, dex 132) — seul Gen 1 exclu du roster (plan 135).
   Porteur naturel d'Imposteur. Nécessite extraction sprite + entrée roster.

Ref canon (Showdown, `packages/data/reference/moves.json`) : `Morphing` / `Transform`,
`longDescription` confirme « current stats, stat stages, types, moves, Ability, weight,
gender, and sprite are copied ; user's level and HP remain the same ». Échoue sur Substitut,
si lanceur OU cible déjà transformé, ou derrière une Illusion.

### État du code exploré (points d'ancrage)

- Système d'overrides runtime par instance : `packages/core/src/types/pokemon-instance.ts`
  (`abilityIdOverride`/`abilitySuppressed`, `typeOverride`, `speedStatOverride`,
  `substituteHp`, `combatStats`, `statStages`, `moveIds`, `weight`, `gender`). Tous
  « persist rest of battle, cleared on KO ».
- Helpers effective : `effectiveAbilityId` (`effective-ability.ts`), `resolveBaseTypes`
  (`effective-flying.ts`), `effectiveBaseSpeed` (`effective-base-speed.ts`).
- Construction d'instance : `packages/view-core/src/BattleSetup.ts` (`createPokemonInstance`
  → `computeCombatStats`, `currentHp/maxHp = combatStats.hp`, `derivedStats`).
- `combatStats` lu directement (hors tests) dans ~5 fichiers : `damage-calculator.ts` (5×),
  `dynamic-power-system.ts`, `future-sight-system.ts` (2×), `handlers/handle-heal-by-target-stat.ts`,
  `handlers/handle-set-weather.ts`.
- Coût CT d'un move = `computeMoveCost(move.pp, move.power, move.effectTier)` résolu par
  `moveRegistry.get(moveId)`. **Aucun système de PP réel** (plan 128) → copier les `moveIds`
  suffit, le coût suit la définition du move copié.
- CT tempo = `getCtGainForPokemon` → `effectiveBaseSpeed(pokemon)` = base stat 1-255,
  **pas** `combatStats.speed`. Morphing doit donc router la base-speed de la cible via
  `effectiveBaseSpeed`.
- Cleanup KO : `BattleEngine.ts handleKo` reset explicitement `typeOverride`,
  `speedStatOverride`, `abilityIdOverride`, `abilitySuppressed`, etc.
- Substitut gate : `shouldSubstituteBlock(attacker, target, move)` (`substitute-system.ts`).
- Talents « à l'entrée » : `triggerBattleStart` (`BattleEngine.ts`) itère les mons et appelle
  `ability.onBattleStart(context)`. Modèle exact = `trace` (`ability-definitions.ts`) qui choisit
  un ennemi et copie. `BattleStartContext` = `{ self, state, pokemonTypesMap }` — **pas de PRNG**
  (Trace prend le plus proche).
- Renderer sprite : billboard bind l'atlas via `getResolvedAtlas(pokemonId)` (`combat-scene.ts`) ;
  swap Substitut via `billboard.setSubstitute(active)` (`directional-billboard.ts`) piloté par
  events dans `battle-orchestrator.ts`. Le port expose `setSubstitute` (`ports.ts`).
- Roster : `packages/data/src/playable/playable-pokemon.ts` (Ditto absent, commentaire explicite),
  `PlayablePokemonEntry`, loader `loaders/load-pokemon.ts` (ability = `ability1` ; movepool dérivé
  du learnset ∩ implémenté). Sprites : `scripts/sprite-config.json` (**0132 Ditto manquant**),
  `pnpm extract-sprites` puis `pnpm pack-sprites`.
- Ditto ref (`pokemon.json`) : stats 48 partout, poids 4.0, types `[normal]`, `ability1: limber`
  / `hidden: imposter`, `learnset.levelUp: []` (Transform hors levelUp, gag canon).

## Canon vs adaptation grille

| Aspect canon | Adaptation Pokemon Tactics |
|---|---|
| Copie stats actuelles (Atq/Déf/AtqSpé/DéfSpé/Vit) | Copie `combatStats` sauf HP ; via `transformState.combatStats` |
| Copie PV max ? **Non** (garde ses PV) | `maxHp`/`currentHp` du lanceur **inchangés** (#649) |
| Copie crans de stats | Snapshot `statStages` à l'instant du cast, diverge ensuite (#650) |
| Copie types | `transformState.types` (prioritaire sur `typeOverride`/espèce) |
| Copie talent | `transformState.abilityId` |
| Copie 4 moves, 5 PP chacun | Copie `moveIds` ; coût CT = def du move copié (pas de PP réel) (#651) |
| Copie poids + genre | `transformState.weight` / `.gender` |
| Copie sprite | Event `Transformed` → renderer bind l'atlas de la cible |
| Vitesse copiée → tempo | `effectiveBaseSpeed` route la base-speed cible → `ctGain` (#647) |
| Échoue sur Substitut / déjà-transformé / Illusion | Substitut + déjà-transformé (2 sens) ; Illusion hors-scope (non implémentée) (#653) |
| Réversion au switch-out | Pas de switch dans ce jeu → réversion **au KO seulement** (#648) |
| Imposteur : cible « celle d'en face » (slot adverse en miroir, **déterministe** — le champ « random » de la description est un raccourci ; Showdown + jeux principaux = positionnel) | Cible **l'ennemi le plus proche** (Chebyshev min) = traduction grille fidèle de « celui d'en face » (#652) |

## Décisions design

### #647 — Vitesse copiée pilote le tempo CT (+ portée de déplacement)
La copie de la Vitesse change le `ctGain` du morphé (cohérent : Morphing copie tout le kit de
combat). **Tranché : oui.** `effectiveBaseSpeed` consulte `speedStatOverride` puis
`transformState.baseSpeed` (= `target.baseStats.speed`, échelle 1-255) puis `baseStats.speed`
(priorité #656). `derivedStats.movement` recalculé au cast via
`computeMovement(effectiveBaseSpeed(pokemon), stageVit)`. **Conséquence tactique explicite :** la
**portée de déplacement** change aussi (le mouvement dérive de la Vitesse) — un Métamorph lent qui
copie un mon rapide gagne d'un coup sa mobilité, pas seulement son tempo. Bénéfice assumé du move.

### #648 — Réversion au KO uniquement
Pas de banc / switch-out (téléport forcé conserve l'instance). **Reco :** reset de
`transformState` dans `handleKo` uniquement, aligné sur tous les autres overrides. Pas de
réversion ailleurs.

### #649 — PV non copiés
**Reco : confirmé.** `maxHp`/`currentHp` restent ceux du lanceur. Un Métamorph 50 PV qui copie
un Léviator garde 50 PV max mais prend Atq/Déf/… du Léviator. `transformState.combatStats` ne
contient pas de HP consommé (le `combatStats.hp` copié est ignoré par le calcul de dégâts ;
`maxHp` reste la source de vérité pour la barre).

### #650 — Crans de stats en snapshot
Canon = snapshot à l'instant du cast, puis évolution indépendante. **Reco :** copie directe
`caster.statStages = { ...target.statStages }` au cast (pas de live-link, pas de helper — les
crans sont mutés en place ensuite comme n'importe quel mon).

### #651 — Moves copiés + coût CT
**Reco :** les 4 `moveIds` de la cible remplacent les slots via `transformState.moveIds` (helper
`effectiveMoveIds`). Coût CT lu depuis la **définition** du move copié
(`computeMoveCost(move.pp, move.power, move.effectTier)`) → fonctionne sans PP réel. Les listes
historiques par-instance (`usedMoveIds`, `grudgeLockedMoveIds`, `lockInMoveId`, Choice) ne sont
**pas** touchées (référencent d'anciens ids, inertes).

### #652 — Talent copié + interaction Imposteur
**Reco :** talent copié dans `transformState.abilityId`. **Priorité (décision #656, « manip
écrase ») :** `abilityIdOverride` prime **sur** `transformState.abilityId` — mais au cast,
`applyTransform` **purge** `caster.abilityIdOverride`/`abilitySuppressed` pré-existants, si bien
que juste après Morphing le talent effectif = celui copié, et un Échange/Soucigraine **ultérieur**
repose un `abilityIdOverride` qui gagne. **Cible = l'ennemi le plus proche** (Chebyshev min, `onBattleStart`) : choix **canon-fidèle** —
le canon copie « celui d'en face » (slot adverse en miroir, déterministe ; le « random » des
descriptions est un raccourci), ce qui se traduit sur la grille par l'adverse le plus proche. Pas
un repli technique. Imposteur : le Ditto porte `imposter`, transforme à
l'entrée, prend le talent de la cible → son propre `imposter` n'est plus l'effective ability →
**ne re-déclenche pas**. Garde-fous anti-boucle (2) : (a) `onBattleStart` d'Imposteur early-return
si `self.transformState` déjà défini ; (b) dans `applyTransform`, si le talent résolu
`targetAbilityId = effectiveAbilityId(target) === "imposter"` → `MoveFailed` et abort (on ne copie
jamais un talent Imposteur, quel que soit le porteur — vaut aussi pour le move Morphing).

### #653 — Gates d'échec
Ordre des gates dans `handleTransform` (émet `MoveFailed` si l'un échoue) :
1. Cible absente / KO (`target.currentHp <= 0`).
2. `shouldSubstituteBlock(caster, target, move)` → Substitut protège la cible.
3. `caster.transformState !== undefined` → lanceur déjà transformé.
4. `target.transformState !== undefined` → cible déjà transformée.
5. Illusion : **non applicable** (mécanique non implémentée — noter et ignorer).

### #654 — Métamorph : inclus dans ce batch (décision humaine)
**Tranché : inclure Ditto jouable dans ce plan.** Dernière phase (contenu), mais livrée dans le
même batch. Coût : extraction sprite 0132 + entrée roster `custom` (movepool `[transform]`, talent
`imposter`) + validation team acceptant un movepool de taille 1. Aucune nouvelle mécanique core —
repose entièrement sur Morphing + Imposteur des phases précédentes.

### #656 — « Manip écrase » : override spécifique prime sur le morph (décision humaine)
Une manipulation ultérieure (Détrempage, Échange, Soucigraine, Permuvitesse, Buée Noire…) visant
un mon **déjà transformé** doit **écraser** la facette correspondante du morph, pas être masquée.
Conséquence architecturale : dans les helpers effective, l'**override spécifique prime sur
`transformState`** (ordre `override > transformState > base`), et `applyTransform` **purge** les
overrides spécifiques pré-existants du lanceur au cast (pour que le morph soit la couche active
immédiatement après). Voir la table de priorité (#655) et les points de vigilance.

### #655 — Architecture : champ unique `transformState`
**Reco (fortement) :** un seul champ snapshot centralise le paquet copié, le cleanup KO et le
gate « déjà transformé », plutôt que d'éparpiller la copie sur `typeOverride` + `abilityIdOverride`
+ `speedStatOverride` (risque de demi-transformations si un Échange/Détrempage ultérieur écrasait
un seul override).

```ts
// pokemon-instance.ts
transformState?: {
  /** Espèce copiée — pilote le swap de sprite (renderer) + le gate "déjà transformé". */
  definitionId: string;
  /** Stats de combat copiées (HP ignoré : maxHp/currentHp restent au lanceur, #649). */
  combatStats: BaseStats;
  /** Base-speed cible (échelle 1-255) pour le tempo CT via effectiveBaseSpeed (#647). */
  baseSpeed: number;
  /** Types copiés (prioritaire sur typeOverride / espèce). `[]` = typeless. */
  types: PokemonType[];
  /** Talent effectif copié au cast (peut être undefined). */
  abilityId?: string;
  /** Les 4 moves copiés (remplacent les slots d'action, #651). */
  moveIds: string[];
  weight: number;
  gender: PokemonGender;
};
```

**Ordre de priorité (décision #656, « manip écrase ») — 4 tiers explicites, dans cet ordre :**
`(1) abilitySuppressed → undefined` (talent scellé domine tout) ; `(2) override spécifique`
(`abilityIdOverride`/`typeOverride`/`speedStatOverride`) ; `(3) transformState` (la couche morph) ;
`(4) espèce/base`. Le morph est une **couche de fond** ; une manip ultérieure (Détrempage, Échange,
Permuvitesse…) repose son override spécifique (tier 2) qui gagne sur le morph (tier 3).

**Périmètre de purge au cast :** `applyTransform` purge **uniquement les 4 champs d'override qui ont
une facette morph parallèle** (`typeOverride`, `abilityIdOverride`, `abilitySuppressed`,
`speedStatOverride` → `undefined`) — pour que le morph soit la couche active immédiatement après le
cast. **Tous les autres volatiles/états du lanceur PERSISTENT inchangés** (Substitut actif, crans
via snapshot #650, statuts majeurs, pièges…). Le KO reste seul responsable du reset complet.

| Helper | Fichier | Nouvelle lecture (override spécifique prime) |
|---|---|---|
| `effectiveAbilityId` | `battle/effective-ability.ts` | `if (abilitySuppressed) undefined; else if (abilityIdOverride) abilityIdOverride; else if (transformState) transformState.abilityId; else abilityId` — **piège `??`** : ne pas chaîner `?? abilityId` en queue (casserait un morphé en mon sans talent). Ternaire sur présence de `transformState`. |
| `resolveBaseTypes` | `battle/effective-flying.ts` | `typeOverride ?? transformState?.types ?? map.get(definitionId) ?? []` |
| `effectiveBaseSpeed` | `battle/effective-base-speed.ts` | `speedStatOverride ?? transformState?.baseSpeed ?? baseStats.speed` |
| `effectiveCombatStats` **(nouveau)** | `battle/effective-combat-stats.ts` | `transformState?.combatStats ?? combatStats` (pas d'override spécifique concurrent) — router les ~5 sites de lecture directe |
| `effectiveMoveIds` **(nouveau)** | `battle/effective-move-ids.ts` | `transformState?.moveIds ?? moveIds` — router `getLegalActions` / `submitAction` |
| `weight` / `gender` | `effectiveWeight` / `effectiveGender` (nouveaux ou inline) | `transformState?.weight ?? weight` (3 sites `dynamic-power-system`), `transformState?.gender ?? gender` (Attraction + IA) |
| `statStages` | — | pas de helper : snapshot direct au cast (#650). Une manip de crans (Buée Noire, Boost…) ultérieure mute en place → « écrase » naturellement. |

### #657 — Garde-fou IA obligatoire (pas différé)
`EffectKind.Transform` ne matche aucune branche de `ai/action-scorer.ts` → Morphing serait scoré 0
(mort côté IA + risque de dépenser le palier CT le plus lourd, 900, pour copier un mon plus faible).
**Tranché : implémenter `scoreTransformApplication` dans ce plan** (étape 7), gaté sur l'écart de
total de stats (cible vs soi), `-1` si la cible n'est pas nettement plus forte. Pas de report en
passe IA groupée (contrairement aux autres familles Misc) — le contresens 900 CT le rend bloquant.

### #658 — Portée de Morphing : r3 (playtest)
r1 jugé trop limitant en test humain → `Single` range 1-3. Reste un coût CT lourd (900) et une
cible unique.

### #659 — Le type copié s'applique PLEINEMENT au terrain (playtest)
Décision humaine : un morphé hérite **complètement** du comportement terrain de ses types copiés —
un morphé en Léviator (Eau/Vol) **lévite/nage** (lave OK, eau profonde OK, pas de poison marais, pas
de malus déplacement marais/sable). Aucune décorrélation : tous les chemins terrain du core passent
déjà par `effectiveTypesOf` (= `resolveBaseTypes`, transform-aware) + `isEffectivelyFlying`
(transform-aware). Aucun code dédié requis — la copie des types via `transformState.types` suffit.
(Une première tentative de « morphé toujours au sol » a été explicitement rejetée au playtest.)

## Architecture core

### 1. Nouveau champ + helpers
- `pokemon-instance.ts` : ajout `transformState?` (JSDoc dans le style des autres overrides —
  « persists rest of battle, cleared on KO »).
- `battle/effective-combat-stats.ts` (nouveau) : `effectiveCombatStats(pokemon)`.
- `battle/effective-move-ids.ts` (nouveau) : `effectiveMoveIds(pokemon)`.
- `battle/effective-weight.ts` + `battle/effective-gender.ts` (nouveaux, ou inline si 1-2 sites).
- Extension de `effective-ability.ts`, `effective-flying.ts`, `effective-base-speed.ts`.

### 2. Routage des lectures existantes
- `combatStats` → `effectiveCombatStats` dans : `damage-calculator.ts` (5 sites),
  `dynamic-power-system.ts`, `future-sight-system.ts` (2 sites), `handle-heal-by-target-stat.ts`,
  `handle-set-weather.ts`.
- `moveIds` → `effectiveMoveIds` dans les sites d'action de `BattleEngine.ts` — **auditer
  chacun** : les gates Rancune / Désactivation / lock-in doivent continuer sur les moves copiés.
- `weight` → `effectiveWeight` dans `dynamic-power-system.ts` (Grosse Puissance / Fracasser).
- `gender` → `effectiveGender` dans `handle-attract.ts` et `ai/action-scorer.ts`.

### 3. EffectKind + handler
- `enums/effect-kind.ts` : `Transform: "transform"`.
- `types/effect.ts` : variante `{ kind: EffectKind.Transform }` (sans param).
- `battle/handlers/transform/apply-transform.ts` (nouveau) — routine partagée move + talent :
  construit `transformState`, snapshot `statStages`, recalcule `derivedStats.movement`, émet
  `Transformed { pokemonId, intoDefinitionId, moveIds }`.
- `battle/handlers/transform/handle-transform.ts` (nouveau) — `EffectHandler` : gates #653,
  résout `targetAbilityId = effectiveAbilityId(target)` + types via `resolveBaseTypes(target)`,
  délègue à `applyTransform`. Renvoie `MoveFailed` sinon.
- `battle/effect-processor.ts` : `registry.register(EffectKind.Transform, handleTransform)`.

### 4. Event
- `enums/battle-event-type.ts` : `Transformed: "transformed"`.
- `types/battle-event.ts` : `{ type, pokemonId, intoDefinitionId, moveIds }`.

### 5. Cleanup KO
- `BattleEngine.ts handleKo` (près des resets existants) : `pokemon.transformState = undefined;`
  `statStages`/`derivedStats` mutés au cast sont sans objet sur un mort (aucune revive ; re-vérifier
  si une revive apparaît un jour — cf. Vœu Soin/Second Souffle plan 147).

### 6. Imposteur (talent)
- `data/src/abilities/ability-definitions.ts` : `AbilityHandler { id: "imposter", onBattleStart }`
  calqué sur `trace`. Choisit l'ennemi vivant **le plus proche** (Chebyshev, #652), early-return si
  `self.transformState` déjà défini, aucune cible, cible sous Substitut, cible déjà transformée, ou
  talent cible = `imposter`. Appelle la routine partagée `applyTransform` (vérifier que
  `ability-definitions.ts` peut importer ce helper core ; sinon exposer un point d'entrée neutre).
- Registre : enregistrer `imposter`. Émettre `AbilityActivated` + `Transformed`.
- `onBattleStart` renvoie `BattleEvent[]` empilés dans `startupEvents` — vérifier que le renderer
  joue le swap sprite sur ces events de démarrage.

### 7. Renderer (sprite swap)
- `render-ports/src/ports.ts` : méthode port `setSpecies(pokemonId, definitionId)` (miroir de
  `setSubstitute`).
- `render-babylon/src/directional-billboard.ts` : `setSpecies(definitionId)` calqué sur
  `setSubstitute` — `loadAtlas(getResolvedAtlas(definitionId))` puis `bindActiveAtlas`. L'atlas de
  la cible est **déjà chargé** (elle est sur le terrain) → pas de FOUC, cache réutilisé.
- `render-babylon/src/combat-scene.ts` : câbler `setSpecies` dans le handle (près de `setSubstitute`).
- `view-core/src/battle-orchestrator.ts` : brancher `BattleEventType.Transformed` (près de
  `SubstitutePosted`) → `this.board.setSpecies(...)` puis `syncBoard()`.
- **Interaction Substitut** : le billboard stocke `currentSpecies` (= `transformState.definitionId`
  après un `setSpecies`, sinon l'espèce d'origine). `setSubstitute(true)` affiche le doll ; au break,
  restaurer le sprite de `currentSpecies` (**pas** l'espèce d'origine) sinon le mon « démorphe »
  visuellement au break du Substitut.

### 8. Métamorph roster (Phase 9, #654)
- `scripts/sprite-config.json` : ajouter `{ "number": "0132", "name": "ditto" }`.
- `pnpm extract-sprites` (Ditto) puis `pnpm pack-sprites` (régénère atlas + bundle).
- Roster — le pipeline (`load-pokemon.ts`) ne sait pas donner `imposter` (prend
  `ability1 = limber`) ni forcer un movepool (learnset Ditto vide). Options :
  - **(a) entrée `custom`** (recommandé, zéro tweak pipeline) :
    ```ts
    { id: "ditto", custom: { name: "Métamorph", types: ["normal"],
      baseStats: { hp:48, attack:48, defense:48, spAttack:48, spDefense:48, speed:48 },
      weight: 4.0, movepool: ["transform"], abilityId: "imposter" } }
    ```
  - (b) étendre `PlayablePokemonEntry` avec `abilityIdOverride` + `movepoolOverride` — plus lourd,
    à réserver si d'autres cas surgissent.
- Vérifier la validation team (Ditto = 1 seul move → movepool de taille 1 accepté).

## Découpage en étapes

**Core d'abord, test-first, puis renderer, puis Imposteur, puis Métamorph.**

1. **Champ + helpers.** `transformState` ; helpers effective (nouveaux `effectiveCombatStats`,
   `effectiveMoveIds`, `effectiveWeight`, `effectiveGender` ; extension de
   `effectiveAbilityId`/`resolveBaseTypes`/`effectiveBaseSpeed`). Tests unitaires de chaque helper
   (priorité `transformState` > override spécifique > base ; cas `types: []`, `abilityId: undefined`).
2. **Routage des lectures.** Remplacer les lectures directes `combatStats`/`moveIds`/`weight`/`gender`
   par les helpers. Tests de non-régression (suites existantes inchangées).
3. **EffectKind + handler + event.** `Transform`, `apply-transform.ts`, `handle-transform.ts`,
   enregistrement, event `Transformed`, cleanup KO. Tests unitaires du handler.
4. **Data move.** `overrides/tactical.ts` : `transform: { targeting: Single r1,
   effects: [{ kind: EffectKind.Transform }] }`. i18n déjà présent. Vérifier `transform` dans le
   movepool de **Mew**.
5. **Renderer.** Port `setSpecies`, billboard, combat-scene, orchestrator sur `Transformed`.
   Vérifier interaction Substitut ↔ espèce morphée.
6. **Imposteur.** `AbilityHandler` `imposter` (`onBattleStart` → `applyTransform`), enregistrement,
   garde-fous. Tests : Ditto (via `abilityOverrides`) transforme à l'entrée sur l'ennemi le plus
   proche ; pas de double-déclenchement ; prend le talent de la cible.
7. **Garde-fou IA (obligatoire, pas différé — #657).** `scoreTransformApplication` dans
   `ai/action-scorer.ts`, calqué sur `scoreDisableApplication`/`scoreTauntApplication` : gaté sur
   l'écart de total de stats (cible vs soi) — score positif seulement si la cible est nettement plus
   forte, sinon **`-1`** pour exclure l'action (comme `scoreHpManipulation`). Évite le contresens
   « dépenser 900 CT pour copier un mon plus faible / l'ennemi le plus proche par défaut ». Test
   unitaire dédié (morphe une menace = score > 0 ; morphe un mon plus faible = exclu).
8. **Intégration + e2e** (voir Tests).
9. **Métamorph roster (#654, inclus).** sprite-config `0132` + `extract-sprites`/`pack-sprites` +
   entrée `custom` (movepool `[transform]`, talent `imposter`) + validation team taille-1. e2e
   visuel Ditto (placement → Imposteur swap sprite à l'entrée).
10. **Doc / STATUS / décisions #647-#657.**

## Tests

### Unitaires (`packages/core`)
- Helpers effective : priorité `transformState`, cas typeless / sans talent.
- `handle-transform` : copie complète ; PV inchangés (Métamorph 50 PV → Léviator garde 50 PV, prend
  son Atq) ; crans snapshot (modifier les crans de la cible après cast → morphé inchangé) ; moves
  copiés → `effectiveMoveIds` = cible ; coût CT du move copié = def cible ; poids/genre copiés ;
  base-speed → `ctGain` (#647).
- Gates #653 : Substitut (MoveFailed) ; lanceur déjà transformé ; cible déjà transformée ; cible dont
  le talent effectif = `imposter` → MoveFailed (#652).
- Verrou inerte : un morphé sortant d'un move verrouillé (Rancune / lock-in / Choix) peut agir car
  l'ancien moveId n'est plus dans `effectiveMoveIds` (intentionnel — l'assertion le documente).
- KO : `transformState` reset ; mon suivant reçoit un état propre.
- Imposteur : déclenche une fois, ennemi le plus proche, refuse cible `imposter`, ne re-déclenche pas.
- Interaction ability-manip : Échange/Détrempage/Soucigraine sur un mon **transformé** → documenter
  le comportement (transformState prime → override spécifique masqué ; test l'assertant).

### Intégration (`tests:integration`)
- Mew utilise Morphing sur un Léviator ennemi puis attaque : dégâts avec les stats du Léviator, STAB
  Eau/Vol, tempo CT du Léviator.
- Golden replay : régénérer si l'ajout du move/talent modifie une séquence.

### e2e (`playwright`, `e2e/`)
- Recette visuelle : Mew morphe → le sprite affiché devient celui de la cible ; barre de PV reste
  celle de Mew ; menu de moves montre les moves copiés.
- (Phase 9) Ditto jouable : placement, entrée en combat → Imposteur swap immédiat du sprite.

## Points de vigilance / interactions

- **Clone / Substitut (plan 099).** Gate #653 via `shouldSubstituteBlock`. Renderer : au break du
  Substitut le `baseAtlas` doit refléter l'espèce **morphée** (stocker l'espèce courante côté
  billboard sinon démorphe visuel).
- **Type-manip (plan 143) — « manip écrase » (#656).** `resolveBaseTypes` : `typeOverride` prime
  sur `transformState.types`. Conversion/Détrempage **après** Morphing **écrase** le type du morphé
  (repose `typeOverride`). Le cast de Morphing purge le `typeOverride` pré-existant du lanceur et
  copie les types **effectifs** de la cible. Tester les deux ordres.
- **Ability-manip (plan 153) — « manip écrase » (#656).** `effectiveAbilityId` : `abilityIdOverride`
  prime sur `transformState.abilityId`. Cast purge `abilityIdOverride`/`abilitySuppressed` du lanceur.
  Piège `??` quand talent copié `undefined` → ternaire sur présence de `transformState`.
- **Permuvitesse (plan 146) — « manip écrase » (#656).** `speedStatOverride` prime sur
  `transformState.baseSpeed`. Cast purge `speedStatOverride` du lanceur ; un Permuvitesse ultérieur
  repose l'override qui gagne.
- **Distorsion / tempo CT (plan 130).** `getCtGainForPokemon` passe déjà par `effectiveBaseSpeed` →
  la base-speed copiée traverse l'inversion Distorsion + le ×1.5 Vent Arrière sans effort.
- **Mimique / move-copy (plan 144).** Morphing copie les 4 slots ; les états par-instance
  (`pendingCalledMove`, `lockInMoveId`, `usedMoveIds`, Choice, Rancune-lock) ne sont **pas**
  transférés. Vérifier que les gates lock/Choice s'appliquent sur `effectiveMoveIds`.
- **`abilityFirstTriggered`.** Le morphé prend un nouveau talent en cours de combat : s'il a un
  `onBattleStart` (Intimidation…), il ne se re-déclenche **pas** (parité canon). Ne pas relancer
  les checks battle-start sur un morphing.

## OP sets / IA (garde-fous)

- **Mew** : `transform` déjà légal. Pas d'OP set dédié ; Morphing situationnel. IA : `EffectKind.Transform`
  ne matche **aucune** branche de scoring existante → score 0 par défaut (mort côté IA + risque de gâcher
  900 CT). **Corrigé par `scoreTransformApplication` (étape 7, #657)** — gaté sur l'écart de stats, `-1`
  si la cible n'est pas nettement plus forte.
- **Placement multi-mons (question ouverte, hors scope #157)** : Imposteur cible « le plus proche »
  (#652). En multi-mons, si le placement au spawn donne au joueur une agentivité réelle sur l'ordre,
  c'est un levier tactique bilatéral sain ; si le placement est auto-assigné, Imposteur devient un
  match-up quasi déterminé par la topologie. Lien Imposteur↔système de spawn **non documenté**
  (`docs/game-design.md`) — à creuser au playtest, pas tranché ici.
- **Métamorph** (Phase 9) : movepool = `["transform"]` ; stats 48 partout → aucun risque d'OP.
  Imposteur fait tout à l'entrée ; l'IA pilote ensuite le morphé avec les moves copiés.
- **Anti-boucle Imposteur** : refus de copier un talent `imposter` (sinon Ditto vs Ditto).
