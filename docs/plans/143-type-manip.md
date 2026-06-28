# Plan 143 — Famille Type manip (mutation runtime du type)

**Statut** : done
**Date** : 2026-06-28
**Worktree suggéré** : `type-manip`
**Périmètre** : 5 moves — 429 → 434

## Objectif

Implémenter la mutation runtime du type d'un Pokémon en combat. Première
fonctionnalité du core qui **change les types d'une instance** après le boot
(jusqu'ici les types étaient figés à `PokemonDefinition.types`).

Moves livrés (in-pool Gen 1, learners confirmés dans le roster) :

| FR | ID | Cat | Cible | Effet |
|----|----|----|-------|-------|
| Conversion | `conversion` | Statut | self | self → type du **1er move** de son movepool (canon Gen 4+) |
| Conversion 2 | `conversion-2` | Statut | ennemi r1 | self → type qui **résiste** au dernier move de la cible |
| Copie-Type | `reflect-type` | Statut | r1 | self → **copie** les types effectifs de la cible |
| Détrempage | `soak` | Statut (Eau) | ennemi r1 | cible → **Eau pur** |
| Flamme Ultime | `burn-up` | Spé 130 Feu | ennemi (offensif) | dégâts **puis** self **perd le type Feu** |

**Hors-scope** : Téra Explosion (`tera-blast`) — nécessite la Téracristallisation
(Gen 9) inexistante dans le jeu. Décision humaine 2026-06-28.

Learners roster : Conversion/Conversion 2 → Porygon ; Copie-Type → Tentacruel,
Ectoplasma, Mew ; Détrempage → Psykokwak, Akwakwak, Poissirène… (~10) ;
Flamme Ultime → Arcanin.

## Cœur du chantier — centraliser la lecture des types

**Problème** : `BattleEngine.pokemonTypesMap` est clé par **definitionId**, pas
par instance. Un override de type doit donc être **par-instance**, via un champ
dédié sur `PokemonInstance`, et toutes les lectures de type doivent passer par un
**seul point** qui applique l'override.

### Étape 1 — champ d'instance

`PokemonInstance.typeOverride?: PokemonType[]`
(`packages/core/src/types/pokemon-instance.ts`)

- Mirror du pattern `substituteHp` / `chargingMove` (champ dédié optionnel).
- **Un seul override à la fois** : un nouveau cast écrase le précédent.
- **Persistance** : jusqu'à la fin du combat (pas de switch dans le jeu — la
  téléportation forcée garde la même instance, donc l'override survit). Non
  retiré par soin/Refresh.
- `[]` (tableau vide) = **sans type** (cas mono-Feu après Flamme Ultime) — valeur
  distincte de `undefined` (= pas d'override).

### Étape 2 — point de lecture unique

**Ne PAS surcharger `getEffectiveTypes` avec l'override** : cette fonction
applique le filtre Roost, et tous les sites ne veulent pas le filtre Roost (le
damage calc ne l'applique pas aujourd'hui → le mélanger risquerait une
régression Roost). On sépare les deux responsabilités :

Nouveau resolver **override-aware** (dans `effective-flying.ts` ou un petit
module `effective-types.ts`) :

```ts
// base type d'une instance, override prioritaire sur la définition
export function resolveBaseTypes(
  pokemon: PokemonInstance,
  pokemonTypesMap: Map<string, PokemonType[]>,
): PokemonType[] {
  return pokemon.typeOverride ?? pokemonTypesMap.get(pokemon.definitionId) ?? [];
}
```

`getEffectiveTypes(pokemon, baseTypes)` reste inchangé (filtre Roost) ; ses
appelants lui passeront désormais `resolveBaseTypes(...)` comme base.

**Audit complet — les 22 sites de `pokemonTypesMap.get(...definitionId)` à
router via `resolveBaseTypes`** (`grep -rn "pokemonTypesMap.get" packages/core/src`) :

| Fichier:ligne | Rôle |
|---|---|
| `BattleEngine.ts:323-324` | attacker/defender types damage calc |
| `BattleEngine.ts:419` | `getPokemonTypes()` (helper public) |
| `BattleEngine.ts:446` | `resolveEffectiveMove` casterTypes |
| `BattleEngine.ts:471` | barrière dash (Psychic terrain) |
| `BattleEngine.ts:819` | (à confirmer au refacto) |
| `BattleEngine.ts:925` | casterTypes effet |
| `BattleEngine.ts:1200` | (à confirmer) |
| `BattleEngine.ts:1237` | defenderTypes |
| `BattleEngine.ts:1318,1321` | `attackerTypes` + `targetTypesMap` EffectContext |
| `BattleEngine.ts:1905,1945` | entry hazards |
| `BattleEngine.ts:2127,2229,2325` | lectures terrain |
| `BattleEngine.ts:2515` | selfTypes |
| `BattleEngine.ts:2583` | attackerTypes |
| `handlers/terrain-tick-handler.ts:107` | terrain end-turn |
| `handlers/field-terrain-tick-handler.ts:32` | field terrain end-turn |
| `handlers/weather-tick-handler.ts:68` | météo end-turn |
| `future-sight-system.ts:138` | defenderTypes Prescience |

Les 4 handlers/systèmes hors-engine reçoivent déjà `pokemonTypesMap` en dep →
ils appellent `resolveBaseTypes(pokemon, pokemonTypesMap)`. **Zéro lecture
directe `pokemonTypesMap.get` résiduelle après refacto** (vérif grep en clôture).
C'est la partie risquée → tests de régression STAB / efficacité / terrain /
hazards / météo.

### Étape 3 — exposer le lookup de type de move aux handlers

`moveRegistry: Map<string, MoveDefinition>` existe déjà (`BattleEngine.ts:142`).
L'injecter dans `EffectContext` (interface réelle vue par les handlers,
`effect-handler-registry.ts:22`), propagé depuis `ProcessContext`
(`effect-processor.ts:59`) sous forme minimale :
`moveTypeOf: (moveId: string) => PokemonType | undefined`.

**Conversion n'a PAS besoin d'une definitions map** (l'engine n'en stocke pas) :
le « 1er move » canon = `caster.moveIds[0]` (le moveset actif de l'instance,
`PokemonInstance.moveIds` ligne 38). On résout son type via `moveTypeOf`.
Conversion 2 lit `target.lastUsedMoveId` (déjà tracké par `recordLastUsedMove`)
puis `moveTypeOf`.

## EffectKinds + handlers

Nouveaux `EffectKind` (`packages/core/src/enums/effect-kind.ts`) :

| EffectKind | Move | Comportement |
|-----------|------|-------------|
| `ConvertSelfType` | Conversion | `caster.typeOverride = [moveTypeOf(movepool[0])]` |
| `ConvertResistType` | Conversion 2 | `caster.typeOverride = [type tiré au PRNG parmi ceux qui résistent/immunisent `moveTypeOf(target.lastUsedMoveId)`]` |
| `CopyTargetType` | Copie-Type | `caster.typeOverride = getEffectiveTypes(target)` |
| `SoakType` | Détrempage | `target.typeOverride = [Water]` |
| `RemoveType` | Flamme Ultime | `caster.typeOverride = currentTypes.filter(t => t !== effect.type)` |

**Architecture handlers** — règle `core.md` : 1 EffectKind = 1 handler enregistré
(pas de switch/case géant). Soit 5 handlers
(`handle-convert-self-type.ts`, `handle-convert-resist-type.ts`,
`handle-copy-target-type.ts`, `handle-soak-type.ts`, `handle-remove-type.ts`),
soit un dossier `handlers/type-change/` regroupant les 5 + un helper partagé
`applyTypeOverride(pokemon, types) → BattleEvent[]` (pousse l'override + émet
`TypeChanged`). Enregistrés dans `effect-processor.ts` (mirror familles récentes).
`moveTypeOf` injecté dans `EffectContext`.

**Conditions d'échec (parité canon) → émettre `MoveFailed`** (event existant,
`battle-event-type.ts:80`) :
- **Conversion** : échoue si `moveTypeOf(caster.moveIds[0])` est **déjà** un des
  types effectifs du lanceur (`resolveBaseTypes`), ou si `moveIds[0]`/son type
  est introuvable. (Cas Porygon avec Conversion en slot 1 → type Normal sur
  Pokémon déjà Normal = échec, canon Gen 4+.)
- **Conversion 2** : échoue si `target.lastUsedMoveId` absent **ou** si le move
  est sans type (typeless, p.ex. cible ayant joué une attaque typeless).
- **Copie-Type** : échoue si les types effectifs de la cible sont **vides**
  (cible sans type, p.ex. après Flamme Ultime mono-Feu).
- **Détrempage** : échoue si la cible est déjà **Eau pur** (lecture override
  effectif, pas la définition). **Bloqué par le Clone** (Substitut) : gate via
  `shouldSubstituteBlock(attacker, target, move)` (Détrempage n'a ni flag
  `sound` ni `bypasssub`) → `StatusBlocked`/no-op comme les autres statuts cible.
- **Flamme Ultime** : échoue si le lanceur **n'est pas de type Feu**. Mono-Feu →
  `typeOverride = []` (sans type). Les dégâts s'appliquent avant le retrait
  (deux effects séquencés sur le move : `Damage` puis `RemoveType` self — le
  `effect-processor` boucle les effects en ordre, `effect-processor.ts:61`).

## Targeting (`packages/core/src/battle/tactical.ts`)

- Conversion : self (pattern self existant).
- Conversion 2, Copie-Type, Détrempage : Single r1.
- Flamme Ultime : Single offensif standard (portée move référence).

Vérifier/ajouter les entrées dans la table de patterns. Move-pattern-designer si
doute sur la portée.

## Events + renderer + i18n

- Event `TypeChanged { pokemonId, newTypes, reason }`
  (reason : `conversion` | `conversion-2` | `reflect-type` | `soak` | `burn-up`).
- `BattleLogFormatter` : cas par reason. Ex. « Porygon devient de type Glace ! »,
  « Arcanin perd son type Feu ! ». Noms de type FR.
- **InfoPanel** : badges de type doivent refléter `getEffectiveTypes` (override).
  Vérifier que l'InfoPanel lit les types effectifs et non `definition.types`.
- `MoveTooltip` : tag générique « Change le type » (et « Retire le type Feu »
  pour Flamme Ultime).
- i18n FR/EN pour les nouvelles clés (log + tooltip).
- Flottant optionnel au changement (réutiliser le système de flottants existant)
  — non bloquant, à l'appréciation.

## Cleanup

- `handleKo` : `pokemon.typeOverride = undefined` (reset à la mort, comme
  `substituteHp`).
- Téléportation forcée (`ejectToSpawn`) : **conserver** l'override (même
  instance, pas un switch).

## IA

Heuristiques dédiées **différées** (cohérent avec les autres moves utilitaires —
voir `docs/next.md` § Reporté) :
- Flamme Ultime est un move offensif → déjà joué via le scoring dégâts standard
  (le retrait de type Feu est un downside mineur non modélisé).
- Conversion / Conversion 2 / Copie-Type / Détrempage : scorés en statuts
  génériques. L'IA ne raisonne pas sur l'avantage défensif du nouveau type.
- **À reporter** dans `docs/next.md` § Reporté : passe IA type-manip (Conversion 2
  pour résister à une menace, Détrempage pour neutraliser un STAB ennemi).

## Tests

Core intégration (1 fichier par move ou `type-manip.test.ts` groupé) :
- override appliqué → STAB recalculé (ex. Porygon Conversion → move du nouveau
  type bénéficie du STAB).
- override appliqué → efficacité défensive recalculée (Détrempage sur cible Feu →
  prend ×2 de l'Eau).
- Détrempage échoue sur Eau pur ; **bloqué par le Clone** (Substitut).
- Flamme Ultime échoue si lanceur non-Feu ; mono-Feu → sans type ; dégâts avant
  retrait.
- Conversion échoue si le type du 1er move est déjà un type du lanceur.
- Conversion 2 échoue sans `lastUsedMoveId` **ou** dernier move typeless ; type
  choisi résiste bien.
- Copie-Type copie les types effectifs (y compris un **override existant** de la
  cible) ; échoue si la cible est sans type.
- `handleKo` reset l'override (`BattleEngine.ts:2744`, à côté de `substituteHp`).
- **Régression** : terrain (immunité Vol→Eau après Détrempage change l'éligibilité
  terrain), entry hazard, immunités de statut suivent l'override.

e2e Playwright : scénario §5.26 dans `docs/test-plan.md` (changement de type
observable via badges InfoPanel + ligne de journal).

## OP sets

Optionnel : variantes Porygon (Conversion / Conversion 2), Arcanin (Flamme
Ultime), Ectoplasma/Tentacruel (Copie-Type). À l'appréciation — non bloquant.

## Décisions à journaliser (`docs/decisions.md`, à partir de #581)

- #581 : Téra Explosion hors-scope (pas de Téracristallisation).
- #582 : `typeOverride` = champ d'instance unique, persistant fin de combat,
  `[]` = sans type, reset au KO.
- #583 : Conversion = type du 1er move du movepool (canon Gen 4+).
- #584 : Conversion 2 = cible ennemi r1, type tiré PRNG parmi ceux résistant au
  dernier move de la cible ; échoue si la cible n'a pas agi.
- #585 : Flamme Ultime applique les dégâts avant le retrait du type Feu ; échoue
  si non-Feu ; mono-Feu → sans type.
- #586 : Conditions d'échec type-manip (Conversion si type déjà porté, Copie-Type
  si cible sans type, Conversion 2 si dernier move typeless) ; Détrempage bloqué
  par le Clone (Substitut) comme les autres statuts cible.

## Notes de review (plan-reviewer + game-designer, 2026-06-28)

- **Conversion = `moveIds[0]`** (moveset actif de l'instance), pas la définition
  movepool → aucun besoin de definitions map côté engine.
- **22 sites** de lecture de type à router (liste Étape 2), pas 11.
- Copie-Type sur Tentacruel : **Tentacruel est dans le roster** (ligne 33 de
  `playable-pokemon.ts`), Copie-Type sur sa lignée. Tentacool ne l'apprend pas →
  la dérivation de movepool l'exclut automatiquement, rien à forcer.
- **À surveiller en playtest (non bloquant)** : combo Détrempage → attaque
  super-efficace sur cible immobilisée (×0.5 → ×2 possible). Requiert 2 tours +
  r1 → pas de garde-fou en amont, noter dans `docs/next.md`.
- Lévitation (talent) survit à Détrempage (immunité Sol indépendante du type) —
  comportement accepté, pas un bug.

## Checklist clôture

- [ ] `pnpm build && lint:fix && typecheck && test && test:integration` verts
- [ ] Audit `pokemonTypesMap.get` → 0 lecture directe résiduelle
- [ ] `docs/implementations.md` (5 moves, compteur 429 → 434)
- [ ] `docs/next.md` (fait récemment + report IA type-manip)
- [ ] `docs/plans/README.md` (entrée 143)
- [ ] `docs/decisions.md` (#581–#585)
</content>
</invoke>
