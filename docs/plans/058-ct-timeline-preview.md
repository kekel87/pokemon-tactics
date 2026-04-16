# Plan 058 — Preview CT Timeline au confirm attack

**Statut : done**
**Date : 2026-04-16**
**Dépend de : plan 054 (CT system)**

## Contexte

En mode Charge Time, le joueur ne sait pas ou son Pokemon retombera dans la timeline apres avoir utilise un move. Cette info est cruciale pour la decision tactique ("est-ce que ce move puissant va me faire attendre longtemps ?").

## Decision de design

- Afficher la preview **au confirm attack** (pas au hover du menu) — moins de calculs, plus pertinent car le joueur est deja en mode evaluation.
- La timeline actuelle montre les CT courants. La preview montre ou le Pokemon actif retomberait apres l'action, et qui joue ensuite.
- Style : entries "ghost" semi-transparentes sous un separateur, montrant les N prochains tours predits.

## Architecture

### Core

`BattleEngine.predictCtTimeline(moveId: string, count: number): CtTimelineEntry[]`

1. Calcule le `moveCost` via `computeMoveCost(move.pp, move.power, move.effectTier)`
2. Calcule le `actionCost` via `computeCtActionCost(hasMoved, hasActed=true, moveCost)` — on simule "le joueur a utilise ce move"
3. Clone le `ctSnapshot` + applique `actionCost` au Pokemon actif
4. Simule tick par tick (meme algo que `ChargeTimeTurnSystem.getNextActorId`) jusqu'a avoir `count` acteurs
5. Retourne `CtTimelineEntry[]` = `{ pokemonId: string; ct: number }[]`

Le `hasMoved` vient du turnState interne — le joueur a peut-etre deja bouge.

### Renderer

`TurnTimeline` recoit un parametre optionnel `ctPreview?: CtTimelineEntry[]` dans `update()`.

Quand `ctPreview` est fourni :
1. Affiche les entries courantes comme aujourd'hui (Pokemon tries par CT desc)
2. Ajoute un separateur "Apres action"
3. Affiche les entries predites en alpha reduit (ghost), avec les barres CT mises a jour

`GameController.enterConfirmAttack()` :
1. Si mode CT + damagePreview actif, appelle `engine.predictCtTimeline(moveId, 6)`
2. Passe le resultat a `turnTimeline.update(state, definitions, ctPreview)`

`GameController.clearPreviewState()` : passe `undefined` comme ctPreview → la timeline revient a son etat normal.

## Etapes

### Etape 1 — Core : type `CtTimelineEntry` + methode `predictCtTimeline`

**Fichiers :**
- `packages/core/src/types/ct-timeline-entry.ts` — nouveau type
- `packages/core/src/battle/BattleEngine.ts` — nouvelle methode publique `predictCtTimeline`
- `packages/core/src/index.ts` — export du type

**Type :**
```typescript
export interface CtTimelineEntry {
  pokemonId: string;
  ct: number;
}
```

**Methode `predictCtTimeline(moveId: string, count: number): CtTimelineEntry[]` :**
- Guard : si pas en mode CT ou `count <= 0`, retourne `[]`
- Recupere le move depuis `moveRegistry`, calcule `moveCost`
- Calcule `actionCost` avec `computeCtActionCost(this.turnState.hasMoved, true, moveCost)`
- Clone le snapshot : `Object.entries(this.chargeTimeTurnSystem.getCtSnapshot())` dans une Map locale (getCtSnapshot retourne un `Record<string, number>`)
- Applique `actionCost` au Pokemon actif dans le clone
- Boucle de simulation : tick tous les CT += gain, quand un depasse threshold → push dans le resultat, soustraire `CT_WAIT` comme fallback et continuer (on ne connait pas les moves futurs des adversaires — meme approche que FFX)
- Retourne les `count` premiers entries
- Exclure les Pokemon KO (`currentHp <= 0`) de la simulation

**Exports :** ajouter `export type * from "./ct-timeline-entry"` dans `packages/core/src/types/index.ts` + re-export `CtTimelineEntry` dans `packages/core/src/index.ts`

**Tests :** `packages/core/src/battle/BattleEngine.predict-ct.test.ts` (convention : a cote du fichier teste)
- Predict retourne [] si round-robin
- Predict retourne les bons acteurs dans l'ordre
- Un move cher (900 CT) fait reculer le Pokemon actif loin dans la prediction
- Un move leger (500 CT) le fait revenir vite
- Pokemon KO ne figurent pas dans la prediction

### Etape 2 — Renderer : `TurnTimeline` accepte une preview CT

**Fichiers :**
- `packages/renderer/src/ui/TurnTimeline.ts` — parametre `ctPreview` dans `update()`, nouveau rendu ghost
- `packages/renderer/src/constants.ts` — constantes ghost (alpha, couleur separateur)

**Changements `TurnTimeline` :**
- `update(state, definitions, ctPreview?)` — passe `ctPreview` a `updateCt()`
- `updateCt(state, definitions, ctPreview?)` :
  - Rendu normal (entries triees par CT) — inchange
  - Si `ctPreview` fourni : separateur + entries ghost
- Nouvelle methode `renderGhostEntry(y, pokemon, definitions, ct)` :
  - Meme layout que `renderEntry` mais avec alpha reduit (ex: 0.45) et teinte bleutee
  - Barre CT mise a jour avec la valeur predite
- Separateur "preview" avec icone ou label discret (ligne + texte petit)

**Constantes :**
- `TIMELINE_GHOST_ALPHA = 0.45`
- `TIMELINE_PREVIEW_SEPARATOR_COLOR = 0x6688cc`

### Etape 3 — Renderer : integration dans `GameController`

**Fichiers :**
- `packages/renderer/src/game/GameController.ts`

**Changements :**
- `enterConfirmAttack(moveId, action)` : si `state.turnSystemKind === TurnSystemKind.ChargeTime`, appelle `this.engine.predictCtTimeline(moveId, 6)`, puis `this.turnTimeline.update(this.state, this.pokemonDefinitions, ctPreview)`
- `clearPreviewState()` : **ajouter** `this.turnTimeline.update(this.state, this.pokemonDefinitions)` (sans preview → reset la timeline a l'etat normal — cet appel n'existe pas aujourd'hui dans clearPreviewState)
- `handleEscapeKey` dans le cas `confirm_attack` : le `clearPreviewState()` existant suffit (il appellera le nouveau reset timeline)
- Les appels existants a `turnTimeline.update(state, definitions)` ailleurs ne changent pas (parametre optionnel)

### Etape 4 — UX : i18n + separateur

**Fichiers :**
- `packages/renderer/src/i18n/fr.ts` + `en.ts` — cle `timeline.afterAction` ("Apres action" / "After action")

Le separateur de preview utilise cette cle.

## Non-scope

- Pas de preview au hover des moves dans le menu (trop de calculs, moins pertinent)
- Pas de prediction du mouvement futur des ennemis
- Pas de simulation des effets de vitesse (Paralysie qui changerait le CT gain) — on utilise les gains actuels
- Le nombre de tours predits (6) est hardcode, pas configurable

## Risques

- **Performance** : la simulation clone un snapshot + tick en boucle. Pour 12 Pokemon et 6 tours predits, c'est ~100 iterations max. Negligeable.
- **Precision** : la prediction ne tient pas compte des effets de statut futurs (un Pokemon pourrait etre paralyse et perdre son tour). C'est acceptable — FFX fait pareil.
