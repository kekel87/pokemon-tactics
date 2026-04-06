---
status: done
created: 2026-03-21
updated: 2026-03-21
---

# Plan 006 — Boucle de combat complète

## Objectif

En s'appuyant sur l'architecture extensible du Plan 005 (phases de tour, effect registry, initiative dynamique), implémenter les mécaniques de combat : status ticks, drain Vampigraine, KO, et condition de victoire. À la fin de ce plan, un combat se joue de bout en bout jusqu'à un vainqueur.

## Contexte

Le Plan 005 a posé :
- `EffectHandlerRegistry` : système pluggable pour les effets de move
- `TurnPipeline` : phases StartTurn / EndTurn avec handlers enregistrables
- `getEffectiveInitiative` + recalcul dynamique à chaque round
- `endCurrentTurn` + boucle while dans `advanceTurn`
- `ActiveLink.remainingTurns: number | null` (null = permanent)

Le pipeline est vide — aucun handler StartTurn/EndTurn n'est enregistré. Ce plan les ajoute.

Le filtrage `restrictActions` pour la paralysie (bloque Move + dash) est déjà implémenté dans `BattleEngine.getLegalActions`. `TurnManager.removePokemon()` existe aussi. Ce plan les utilise et les teste.

### Décisions prises
- **Sommeil** : comme Pokemon — 1-3 tours aléatoire, décompte en début de tour, réveil = peut agir ce tour
- **KO** : définitif pour le POC (pas de countdown FFTA)
- **Brûlure** : 1/16 HP max en début de tour
- **Poison** : 1/8 HP max en début de tour
- **Gel** : 20% dégel en début de tour. Gelé = ne peut pas agir
- **Paralysie tactique** : 25% proc en début de tour. Proc = ne peut pas se déplacer ni dash, peut attaquer sur place
- **1 seul statut à la fois** (comme Pokemon)
- **Vampigraine** : permanent, brisé par KO ou distance > maxRange. Rupture définitive
- **Badly Poisoned / Confusion** : hors scope POC

## Étapes

### Étape 1 — Status tick handlers (StartTurn)

Enregistrer des handlers StartTurn dans le `TurnPipeline` pour chaque statut :

**Fichier** : `packages/core/src/battle/handlers/status-tick-handler.ts`

Un seul handler qui dispatch selon le statut du Pokemon actif :

```ts
function statusTickHandler(pokemonId: string, state: BattleState): PhaseResult
```

Logique (opère sur `pokemon.statusEffects[0]` — un seul statut) :
- **Burned** : inflige `Math.max(1, Math.floor(pokemon.maxHp / 16))` → émet `DamageDealt`, potentiellement `PokemonKo` (avec `countdownStart: 0` — KO définitif POC). `skipAction: false` (le Pokemon joue quand même)
- **Poisoned** : inflige `Math.max(1, Math.floor(pokemon.maxHp / 8))` → idem (même `PokemonKo.countdownStart: 0`)
- **Asleep** : décrément `remainingTurns`. Si 0 → retire le statut, émet `StatusRemoved`, `skipAction: false`. Sinon `skipAction: true`
- **Frozen** : roll 20%. Si dégel → retire, émet `StatusRemoved`, `skipAction: false`. Sinon `skipAction: true`
- **Paralyzed** : roll 25%. Si proc → `skipAction: false, restrictActions: true`. Sinon tout normal

Enregistrement dans le constructeur de `BattleEngine` :
```ts
this.turnPipeline.registerStartTurn(statusTickHandler, 100);
```

**Tests** :
- Burn inflige 1/16 max HP, min 1
- Burn KO sur le tour du Pokemon brûlé → handleKo appelé, tour terminé proprement
- Poison inflige 1/8 max HP
- Burn/Poison KO → `pokemonFainted: true`
- Sleep décrément, réveille à 0 → `skipAction: false`
- Sleep encore endormi → `skipAction: true`
- Freeze dégel 20% (mock Math.random)
- Freeze gelé → `skipAction: true`
- Paralysis proc 25% → `restrictActions: true`
- Pas de statut → résultat neutre

### Étape 2 — Link drain handler (EndTurn)

Enregistrer un handler EndTurn pour le drain des liens actifs :

**Fichier** : `packages/core/src/battle/handlers/link-drain-handler.ts`

```ts
function linkDrainHandler(pokemonId: string, state: BattleState): PhaseResult
```

Logique :
- Pour chaque `ActiveLink` où `targetId === pokemonId` :
  - Si source KO → retire le lien, émet `LinkBroken`
  - Si distance > maxRange → retire le lien, émet `LinkBroken`
  - Sinon : drain = `Math.max(1, Math.floor(target.maxHp * link.drainFraction))`
    - Inflige dégâts à la cible → émet `LinkDrained`
    - Soigne la source (cap maxHp)
    - Si cible KO → émet `PokemonKo` (countdownStart: 0), `pokemonFainted: true`
- Collecter les liens à supprimer pendant l'itération, puis les retirer après (collect-then-delete pour éviter mutation pendant itération)
- `LinkDrained` event couvre les deux côtés : `amount` = dégâts infligés à la cible = HP soignés à la source

Enregistrement dans le constructeur de `BattleEngine` :
```ts
this.turnPipeline.registerEndTurn(linkDrainHandler, 100);
```

**Tests** :
- Drain inflige les dégâts et soigne la source
- Drain ne soigne pas au-delà de maxHp
- Drain KO → `pokemonFainted: true`
- Lien brisé si distance > maxRange
- Lien brisé si source KO
- Lien permanent : remainingTurns null → pas de countdown
- Pas de liens → résultat neutre

### Étape 3 — KO handling

**Dans** `BattleEngine.ts` — implémenter le `handleKo` (stub posé au Plan 005) :

- Retire le Pokemon du turn order via `turnManager.removePokemon()`
- Libère la tile (`grid.setOccupant(position, null)`)
- Brise tous les liens restants dont ce Pokemon est source ou cible → émet `LinkBroken` pour chacun (idempotent : ne réémet pas si le lien a déjà été brisé par un handler)
- Le Pokemon reste dans `state.pokemon` (historique) avec `currentHp = 0`
- Le champ `koCountdown` (déjà présent sur `PokemonInstance`) reste `null` — non utilisé pour le POC (KO = définitif). Ce champ sera activé quand on implémentera le countdown FFTA en Phase 1+
- Émet `PokemonEliminated`

**Intégration** :
- Appelé quand `PhaseResult.pokemonFainted === true` (depuis statusTickHandler ou linkDrainHandler)
- Appelé après `executeUseMove` quand `processEffects` produit des `PokemonKo` events

**Tests** :
- Pokemon KO retiré du turn order
- Pokemon KO libère sa tile
- Pokemon KO brise ses liens (source et cible)
- Pokemon KO ne peut plus être ciblé
- KO pendant le tour d'un autre Pokemon → le tour continue

### Étape 4 — Condition de victoire

**Dans** `BattleEngine.ts`

```ts
private checkVictory(): string | null
```

- Collecte les `playerId` avec au moins 1 Pokemon `currentHp > 0`
- Si un seul joueur reste → émet `BattleEnded { winnerId }`, flag `battleOver = true`
- `getLegalActions` retourne `[]` si `battleOver`
- `submitAction` retourne `ActionError.BattleOver` si `battleOver`

**Appeler `checkVictory`** après chaque `handleKo`.

**Nouveau ActionError** : `BattleOver`

**Tests** :
- 1v1 : KO adverse → BattleEnded
- 2v1 : KO d'un seul → pas de BattleEnded
- Draw : deux derniers Pokemon KO dans le même round → premier KO déclenche la victoire (pas de draw pour le POC)
- getLegalActions après BattleEnded → []
- submitAction après BattleEnded → erreur

### Étape 5 — Paralysie : vérifier et tester le filtrage existant

Le filtrage `restrictActions` est déjà implémenté dans `BattleEngine.getLegalActions` (Plan 005). Cette étape vérifie le comportement et ajoute les tests manquants.

**Tests** :
- Paralysie proc → pas de Move ni dash dans getLegalActions
- Paralysie proc → use_move non-dash présent
- Paralysie pas proc → toutes les actions disponibles
- Après le tour paralysé, le flag `restrictActions` est réinitialisé au tour suivant

### Étape 6 — Tests d'intégration

**Fichier** : `packages/core/src/battle/battle-loop.integration.test.ts`

Scénario 1 — Poison tue :
```gherkin
Given Charmander (team A) et Bulbasaur (team B) sur une grille 8x8
And Bulbasaur a le statut Poisoned
When les deux joueurs skip leurs tours pendant plusieurs rounds
Then le poison inflige 1/8 HP à Bulbasaur à chaque début de tour
And quand Bulbasaur tombe KO, BattleEnded est émis avec team A gagnant
```

Scénario 2 — Sleep + drain (2 rounds minimum) :
```gherkin
Given Bulbasaur (team A) et Charmander (team B) sur une grille 8x8
When Round 1 : Bulbasaur utilise Sleep Powder sur Charmander
And Round 2 : Bulbasaur utilise Leech Seed sur Charmander (Charmander dort, skip)
Then Charmander est endormi et drainé chaque fin de tour
And Charmander ne peut pas agir pendant le sommeil
And le drain soigne Bulbasaur
And quand Charmander se réveille, il peut agir normalement
```

Scénario 3 — Paralysie tactique :
```gherkin
Given Charmander (team A) et Bulbasaur (team B) sur une grille 8x8
And Bulbasaur est paralysé
When la paralysie proc (mock Math.random)
Then getLegalActions ne contient pas de Move ni de UseMove dash
But getLegalActions contient Razor Leaf
And au round suivant l'ordre reflète le -50% initiative
```

Scénario 4 — Initiative dynamique :
```gherkin
Given Pokemon A (initiative 100) et Pokemon B (initiative 80)
And A joue toujours avant B au round 1
When Pokemon A est paralysé (initiative effective 50)
Then au round 2, B (80) joue avant A (50)
```

### Étape 7 — Nettoyage et documentation

- Vérifier 100% coverage
- Documenter dans `decisions.md` :
  - KO définitif pour le POC (écart décision #24 qui prévoit un countdown FFTA)
  - Vampigraine permanent + rupture définitive hors range (écart décision #34 qui prévoyait une durée limitée de 3 tours)
  - Recalcul de l'ordre des tours à chaque round
  - 1 seul statut à la fois pour le POC

## Agents à lancer

| Étape | Agents |
|-------|--------|
| Après étapes 1-2 | `test-writer` + `core-guardian` |
| Après étape 3-4 | `core-guardian` (modif BattleEngine) |
| Après étape 6 | `game-designer` pour équilibre |
| Après étape 7 | `code-reviewer` + `doc-keeper` |

## Critères de complétion

- Burn/Poison infligent des dégâts en début de tour (via TurnPipeline handler)
- Sleep 1-3 tours, décompte correct, réveil = peut agir
- Freeze 20% dégel/tour
- Paralysis proc : move + dash bloqués, attaque sur place OK
- Paralysis -50% initiative visible à chaque round
- Vampigraine drain permanent en fin de tour, soigne la source
- Pokemon KO retiré définitivement (grille, turn order, liens)
- Condition de victoire : dernière équipe debout gagne
- `BattleEnded` émis, combat verrouillé après
- 100% coverage
- Tests d'intégration : combat bout en bout

## Risques

- **Math.random** : mock dans les tests, seed viendra avec le replay
- **Boucle infinie** : si tous les Pokemon sont sleep/freeze, garde-fou dans la boucle while (skip de round)
- **Ordre burn → action → drain** : burn peut tuer avant l'action, drain peut tuer après. L'ordre est gameplay-significant et verrouillé par la priorité des handlers dans le pipeline
- **Double émission `LinkBroken`** : les handlers (linkDrainHandler) et `handleKo` peuvent tous deux briser des liens. `handleKo` ne brise que les liens restants (idempotent) pour éviter les doublons
- **Mutation pendant itération** : `linkDrainHandler` collecte les liens à supprimer puis les retire après la boucle (collect-then-delete pattern)
- **BadlyPoisoned / Confusion** : hors scope, les enums existent, ignorés pour le POC

## Dépendances

- **Avant ce plan** : Plan 005 (phases de tour, effect registry, initiative dynamique)
- **Ce plan débloque** :
  - Renderer POC (combat complet à afficher)
  - IA random (joue jusqu'à la victoire)
  - Phase 1 (multi-Pokemon, hot-seat)
