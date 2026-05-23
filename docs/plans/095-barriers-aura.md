# Plan 095 — Barrières (Light Screen / Reflect) — aura mobile

> Statut : **done**
> Créé : 2026-05-22
> Livré : 2026-05-23
> Auteur : Claude
> Spec source : `docs/roadmap.md:173`
> Révisions : plan-reviewer + game-designer + best-practices 2026-05-22

## Objectif

Implémenter deux moves de barrière canon avec un twist tactique : **l'aura suit le lanceur** (rayon r3 Manhattan autour du caster) au lieu d'être team-wide statique comme dans Showdown. Reflect réduit les dégâts Phys ×0.5, Light Screen réduit les dégâts Spé ×0.5. L'aura s'applique au caster + alliés dans le rayon ; les ennemis sont exclus. Brick Break devient stratégique : ×2 contre le lanceur direct (casse toutes ses auras), dégâts normaux Reflect ×0.5 si applicable contre un allié protégé sans cassure.

**Aurora Veil dropped v1** (0 learner Gen 1 roster, reporté post-Z-A integration avec Alolan Ninetales — voir backlog).

Livraison :
- 2 moves data (`reflect`, `light-screen`)
- Nouveau champ `BattleState.screens: ScreenAura[]` (1 caster peut tenir Reflect ET Light Screen simultanément)
- Hook `damage-calculator` : multiplicateur ×0.5 si target dans aura caster-allié-de-target et catégorie matche
- Brick Break réécrit avec branche custom (×2 + break vs caster uniquement)
- Light Clay item (durée 5 → 8 tours, ajout à la pose si tenu)
- Aura visuelle renderer : cercle pulse sous caster + indicateur HUD overlay
- i18n FR/EN, tests unit + intégration, build/lint/typecheck verts

## Pourquoi maintenant

- Roadmap Phase 4 — barrières sont la mécanique d'équipe canonique manquante après météo (plan 084) et avant champs/terrains.
- Pattern "field state avec décrément end-of-round" déjà éprouvé par météo (plan 084) → réutilisable pour `screens`.
- Brick Break déjà data (`tactical.ts:740`) mais branche custom triviale — à enrichir.
- 0 ability nouvelle, 0 statut nouveau. Mécanique self-contained, faible risque régression.

## Hors scope

- **Mist** (move qui bloque stat changes) — pas un screen, mécanique différente, plan séparé.
- **Safeguard** (immunité statuts majeurs équipe) — pareil, mécanique défensive séparée, possible bundle futur "Team Protections".
- **Infiltrator** ability — bypass screens. 0 learner Gen 1 roster, reporté Phase 9 abilities avancées.
- **Crystal Veil / hazards** — Gen 9, hors roster.
- **Brick Break vs Steel/Rock immunités canon** — Brick Break en Gen 9 brise screens même sur immune, on garde ce comportement (immune target = dégâts 0 mais break aura quand même).
- **Aurora Veil** — dropped v1 entièrement (0 learner Gen 1 roster). Backlog ajout : "Aurora Veil v2 post-intégration Z-A (Alolan Ninetales)".

## Décisions actées

### 1. Rayon de l'aura

**r3 Manhattan** autour du caster (forme diamant, ~25 tiles). Décision révisée post-playtest visuel : Chebyshev (r3 = 49 tiles carré 7×7) couvrait quasi tout l'espace tactique et la forme "carrée" était dissonante en iso. Manhattan donne un diamant centré sur le caster avec ~25 tiles, plus lisible et "cercle-like" en iso (canon range moves projet).

### 2. Granularité bénéficiaires

**Caster + alliés (`playerId === caster.playerId`) dont la position est dans `manhattanDistance ≤ 3` du caster vivant**.

- Caster KO → aura disparaît immédiatement (entrée `screens` supprimée dans `handleKo`).
- Ennemis dans le rayon : exclus (pas de réduction).
- 2 lanceurs même équipe → 2 entries séparées dans `screens` keyed par casterId. Un Pokemon peut être couvert par les deux (overlap autorisé) → reste ×0.5 (pas de cumul ×0.25, multiplicateurs idempotents).
- Allié dans 2 auras Reflect (= 2 lanceurs alliés) → reste ×0.5.

### 3. Aurora Veil — dropped v1

0 learner Gen 1 roster (index `pokemon-by-move.aurora-veil` = 9 learners tous Gen 7+ hors roster). Économie ~4h implem+tests. Reprend post-Z-A (Alolan Ninetales). `ScreenKind` core garde uniquement `Reflect` + `LightScreen` v1, sans branche `AuroraVeil`.

### 4. Durée

**5 tours par défaut, 8 tours si caster tient Light Clay au moment de la pose**.

- Snapshot à la pose : `screen.remainingRounds` initialisé à 5 ou 8 selon `caster.heldItemId === HeldItemId.LightClay`.
- Décrement +1 par end-of-round (mirror weather `lastTickRound`).
- À 0 → entry supprimée + event `ScreenDissipated`.

### 5. Stockage état

```ts
// packages/core/src/types/screen-aura.ts (nouveau fichier)
import type { ScreenKind } from "../enums/screen-kind";

export interface ScreenAura {
  kind: ScreenKind;           // Reflect | LightScreen
  casterPokemonId: string;
  remainingRounds: number;
  postedRound: number;        // pour debug / replay
}

// packages/core/src/enums/screen-kind.ts (nouveau)
export const ScreenKind = {
  Reflect: "reflect",
  LightScreen: "light-screen",
} as const;
export type ScreenKind = (typeof ScreenKind)[keyof typeof ScreenKind];

// BattleState étendu :
screens: Map<string, ScreenAura>;  // key = casterPokemonId
```

**Décision** : 1 caster = 1 aura active à la fois. Repose écrase. Cohérent gameplay : choix entre Reflect ou Light Screen.

### 6. Brick Break

Logique simplifiée : **uniquement vs caster** d'une aura.

- Si `target.id` est dans `state.screens` (target est elle-même caster d'aura) → multiplicateur ×2 + flag `breakAura: true` (cible elle-même). Brick Break ignore le screen pour son propre hit (canon Showdown break-then-hit) puis casse l'aura.
- Sinon → dégâts normaux. Reflect/Light Screen continuent de réduire ×0.5 normalement si applicable. Aucune cassure.

Brick Break breaks screen même si target meurt du hit (canon parité).

Décision révisée post-plan : l'auteur de l'aura est la cible logique pour la briser, pas les bénéficiaires (simplifie la logique, force le joueur à cibler le caster, évite cas ambigus de double-protection).

### 7. Type d'effet pour la pose

Nouveau `EffectKind.PostScreen` :

```ts
{ kind: EffectKind.PostScreen, screen: ScreenKind.Reflect }
```

Handler `handle-post-screen.ts` :
- Compute durée (5 ou 8 selon Light Clay).
- Insère/écrase entry `state.screens.set(caster.id, { ... })`.
- Émet event `ScreenPosted { caster, kind, durationRounds }`.

### 8. Damage modifier intégration

Dans `damage-calculator.ts`, après modifiers existants (weather, facing, height, type) :

```ts
const screenMultiplier = computeScreenMultiplier(target, attacker, move, state);
damage = Math.floor(damage * screenMultiplier);
```

`computeScreenMultiplier(target, attacker, move, state)` :
- Itère `state.screens.values()`.
- Pour chaque aura : caster = `state.pokemon.get(aura.casterPokemonId)`. Skip si caster KO ou absent.
- Si `caster.teamId !== target.teamId` → skip (aura ennemie).
- Si `chebyshevDistance(caster.position, target.position) > 3` → skip (out of range).
- Match catégorie :
  - `Reflect` & move.category === Physical → ×0.5
  - `LightScreen` & move.category === Special → ×0.5
- Critiques **percent** les screens (canon Gen 6+) — si `isCrit === true`, multiplicateur ignoré.
- Multiplicateurs ne se cumulent pas (return early sur premier match valide). Per-catégorie : un move Phys n'examine que les Reflect actifs ; pas de confusion avec Light Screen.

Retourne 1.0 ou 0.5.

### 9. Light Clay item

Nouveau `HeldItemId.LightClay` ajouté à l'enum + entry items.json existante (`reference/items.json:light-clay`).

Handler `handle-light-clay.ts` :
- Hook `onMoveUsed` (à créer si absent) : si move résout `PostScreen` effect, item modifie durée à 8 (sinon défaut 5).
- Alternative simple : `handle-post-screen.ts` lit directement `caster.heldItemId === HeldItemId.LightClay` au moment de la pose. Pas besoin de nouveau hook.

**Décision** : check inline dans `handle-post-screen`, pas de nouveau hook. Light Clay devient un cas spécial documenté du handler.

### 10. Renderer

L'aura est rattachée au lanceur, pas team-wide → l'affichage suit le lanceur. Pas de HUD top-bar.

#### 10a. Sprite indicators stackés à gauche barre HP (MVP)

Côté **gauche** de la barre HP, on accumule les indicateurs volatiles. Convention : `chargingIndicator` ⚡ (plan 094) déjà côté gauche → on stack à sa droite (ou gauche, à confirmer pendant impl) selon ordre prédéfini.

- **Stack order (gauche → droite)** : `chargingIndicator ⚡` → `screenIndicator 🛡` → futurs indicateurs.
- Nouvelle constante `LEFT_INDICATOR_SLOT_OFFSET` = espacement horizontal entre slots.
- Chaque indicator se place via `LEFT_INDICATOR_BASE_X + slotIndex × LEFT_INDICATOR_SLOT_OFFSET`.
- Refactor préalable mineur de `chargingIndicator` pour utiliser ce système de slots, sinon collision dès qu'un caster est en charge ET porte une aura.

**Caster d'aura — indicateur fort** :
- Icône bouclier "plein" + compteur tours : `"🛡 {remainingRounds}"`.
- Couleur selon kind (jaune Reflect / cyan Light Screen).
- API `PokemonSprite.setScreenIndicator(kind: ScreenKind | null, remainingRounds: number, role: "caster")`.

**Allié protégé — indicateur faible** :
- Même icône bouclier mais **style outline / alpha réduit** (~0.5) — visuellement distinct du caster.
- **Pas de compteur** sur les alliés (compteur uniquement chez le caster, source de vérité).
- API `PokemonSprite.setScreenIndicator(kind: ScreenKind | null, remainingRounds: 0, role: "protected")`.
- Update à chaque fois que la situation change : caster bouge, allié bouge (entre/sort r3), allié spawn/KO, aura posée/dissipée/cassée. Recompute logique partagée `computeProtectedAlliesForAura(state, aura)` → renderer applique diff.

#### 10b. Aura visuelle = icônes transparentes au hover du caster (révisé)

Pas de highlight color permanent sur les tiles (collision visuelle avec range mouvement / range move). À la place : **icônes** (🛡️ Reflect / ✨ Light Screen) en alpha 0.35 au centre de chaque tile de la zone Manhattan r3, **affichées uniquement quand le joueur survole le caster** (hover).

- `IsometricGrid.showScreenAuraHoverIcons(positions, symbol)` / `hideScreenAuraHoverIcons()`.
- `GameController.showAuraHoverFor(pokemonId)` / `hideAuraHover()` câblés depuis BattleScene hover handler.
- Icônes en `Phaser.GameObjects.Text`, fontSize `SCREEN_HOVER_AURA_FONT_SIZE = 16`, alpha `SCREEN_HOVER_AURA_ALPHA = 0.35`.
- Depth : `DEPTH_RAISED_TILE_BASE + isoLadder + DEPTH_SCREEN_HIGHLIGHT_ISO_OFFSET` (au-dessus tile, sous sprites).

#### 10c. InfoPanel badge (MVP)

- Nouveau badge dans la liste volatiles du caster : libellé `"{kind} {t}t"` (sans le mot "Aura").
- Sur **alliés protégés** : badge `"{kind}"` sans compteur (compteur reste chez le caster, source unique de vérité).
- Style identique aux badges volatiles existants.

#### 10d. Events handlés `GameController`

- `ScreenPosted` :
  - `casterSprite.setScreenIndicator(kind, durationRounds, "caster")`
  - Create `ScreenTileHighlight(casterId, kind)`
  - Recompute alliés protégés → `setScreenIndicator(kind, 0, "protected")` sur chacun
  - Float text "[move name]!" sur caster (couleur teamColor)
  - InfoPanel refresh
- `ScreenDissipated` / `ScreenBroken` :
  - `casterSprite.setScreenIndicator(null, 0, "caster")`
  - Destroy tile highlight
  - Tous alliés précédemment protégés → `setScreenIndicator(null, 0, "protected")`
  - Si Broken : flash blanc sur caster + log custom
- `PokemonMoved` (caster d'aura OU allié de caster d'aura) :
  - Si caster d'aura : `ScreenTileHighlight.update(newPosition)` + recompute alliés protégés
  - Si allié : recompute son flag protected (entré/sorti du rayon)
- `RoundStarted` (decrement) : sync `setScreenIndicator(kind, remainingRounds, "caster")` pour update compteur.
- Sur KO d'allié protégé : son indicateur disparaît avec son sprite (auto).
- Sur KO caster : ScreenDissipated déjà émis par core, gère tout.

### 11. IA scoring

- Pose : score haute valeur si :
  - `roundNumber ≤ 3` (early game)
  - ≥ 2 alliés vivants à r3
  - Pas déjà d'aura active du caster (pas d'écrasement gratuit)
  - Aurora Veil : seulement si weather === Snow
- Brick Break : prio target dans aura active (allié-protégé ou caster lui-même). Bonus +30% score si target porte aura, +60% si caster est target d'aura ET range 1.

### 12. i18n FR/EN

Clés nouvelles :
- `screen.kind.reflect` (réutilise nom move `reflect` = "Protection" FR / "Reflect" EN)
- `screen.kind.lightScreen` (réutilise nom move `light-screen` = "Mur Lumière" FR / "Light Screen" EN)
- `screen.kind.auroraVeil` (réutilise nom move `aurora-veil` = "Voile Aurore" FR / "Aurora Veil" EN)
- `screen.posted` (`{caster} pose {kind} ({turns} tours)` / `{caster} sets up {kind} ({turns} turns)`)
- `screen.dissipated` (`L'aura {kind} de {caster} se dissipe` / `{caster}'s {kind} aura faded`)
- `screen.broken` (`{breaker} brise l'aura {kind} de {caster} !` / `{breaker} broke {caster}'s {kind} aura!`)
- `screen.requiresSnow` (`Voile Aurore nécessite la Neige` / `Aurora Veil requires Snow`)
- `infoPanel.aura.caster` (`{kind} {turns}t` — format inclut compteur)
- `infoPanel.aura.protected` (`{kind}` — pas de compteur côté protégé)
- `item.light-clay` (déjà dans items i18n)

## Étapes

### Étape 1 — Core enums + types
1. `packages/core/src/enums/screen-kind.ts` — const object Reflect/LightScreen.
2. `packages/core/src/types/screen-aura.ts` — interface ScreenAura.
3. Étendre `BattleState` avec `screens: Map<string, ScreenAura>` (init Map vide partout : `BattleEngine` constructor, `loadBattleState` si existe, snapshot/restore replay).
4. Nouveaux events :
   - `BattleEventType.ScreenPosted` + variant `{ casterId, kind, durationRounds }`
   - `BattleEventType.ScreenDissipated` + variant `{ casterId, kind, reason: "expired" | "casterKo" }`
   - `BattleEventType.ScreenBroken` + variant `{ casterId, kind, breakerId, breakerMoveId }`
5. Tests unit `screens-state.test.ts` (insertion, écrasement même caster, decrement, suppression à 0, suppression sur caster KO).

### Étape 2 — EffectKind + handler PostScreen
1. Ajouter `EffectKind.PostScreen` (`packages/core/src/enums/effect-kind.ts`).
2. Étendre union `Effect` avec `{ kind: PostScreen, screen: ScreenKind }`.
3. Handler `packages/core/src/battle/effect-handlers/handle-post-screen.ts` :
   - Durée 5 ou 8 (Light Clay).
   - `state.screens.set(caster.id, { kind, casterPokemonId: caster.id, remainingRounds, postedRound: state.roundNumber })`.
   - Émet `ScreenPosted`.
4. Enregistrer handler dans `effect-handler-registry.ts`.
5. Tests unit `handle-post-screen.test.ts` (3 tests : Reflect, Light Screen, Light Clay).

### Étape 3 — Damage modifier
1. `packages/core/src/battle/screens.ts` (nouveau fichier) :
   - `computeScreenMultiplier(target, attacker, move, state, isCrit): number`
   - `getActiveAurasProtectingTarget(state, target): ScreenAura[]` (helper, utilisé aussi par Brick Break)
   - `getAurasOfCaster(state, casterId): ScreenAura | undefined`
2. Intégrer appel dans `damage-calculator.ts` après modifiers existants. Passer `isCrit` au signature.
3. Tests unit `screens.test.ts` (10+ scénarios : reflect réduit Phys, LS réduit Spé, out-of-range, ennemi exclu, crit percent, KO caster, multi-aura overlap, target alliée caster, caster lui-même protégé, Reflect ignore Spé / LS ignore Phys).

### Étape 4 — Decrement end-of-round + caster KO
1. Dans `BattleEngine.endRound` (ou équivalent — endTurn quand `roundNumber` incrémente), après weather tick : itère `state.screens.entries()`, décrément `remainingRounds`, supprime entry à 0, émet `ScreenDissipated { reason: "expired" }`.
2. Dans `handleKo` : supprime `state.screens.get(casterId)` si présent, émet `ScreenDissipated { reason: "casterKo" }`.
3. Tests intégration `screens-lifecycle.integration.test.ts` (3 scénarios : decrement normal, KO caster, Light Clay 8 tours).

### Étape 5 — Brick Break réécriture
1. Modifier `tactical.ts:brick-break` → ajouter effect `{ kind: EffectKind.BreakScreen }` avant `EffectKind.Damage` ? Ou inline dans Damage handler ?
2. **Approche retenue** : nouveau modifier dans `damage-calculator.ts` qui détecte `move.id === "brick-break"` et applique ×2 ou ×1.5 selon contexte. Émet event `ScreenBroken` post-damage.
3. Branche dans `damage-calculator` (helper séparé `applyBrickBreakModifier`) :
   - Si target est caster d'au moins une aura → ×2, breakAuraCasterId = target.id (casse toutes les auras du caster)
   - Sinon → ×1.0, pas de cassure (dégâts normaux ; Reflect ×0.5 toujours appliqué si applicable)
   - Apply ×2 ou ×1.0, set flag.
4. Post-damage (effect-processor) : si flag breakAura set, `state.screens.delete(breakAuraId)` + émet `ScreenBroken`.
5. Tests intégration `brick-break-screens.integration.test.ts` (4 scénarios : vs caster mêlée, vs allié protégé, sans aura, target meurt mais aura cassée).

### Étape 6 — Light Clay item
1. Ajouter `HeldItemId.LightClay` à l'enum `packages/core/src/enums/held-item-id.ts`.
2. Pas de nouveau handler. Lecture inline dans `handle-post-screen.ts`.
3. Ajouter Light Clay à la liste `items` data (vérifier si déjà présent dans `reference/items.json` — oui, juste lier au système d'items implémentés).
4. Marquer Light Clay comme implémenté dans `implementation-flags.ts`.
5. Test intégration `light-clay.integration.test.ts` (1 scénario : pose Reflect avec Light Clay → durée 8 tours).

### Étape 7 — Data moves
1. `tactical.ts` : ajouter `reflect`, `light-screen` :

   ```ts
   reflect: {
     targeting: { kind: TargetingKind.Self },
     effects: [{ kind: EffectKind.PostScreen, screen: ScreenKind.Reflect }],
   },
   "light-screen": {
     targeting: { kind: TargetingKind.Self },
     effects: [{ kind: EffectKind.PostScreen, screen: ScreenKind.LightScreen }],
   },
   ```

2. Vérifier `reference/moves.json` pour BP/Acc/PP/Type — ces moves sont statut (BP=0, Acc=—, PP variable). Pas d'override BP/Acc nécessaire.
3. Marquer comme implémentés dans `implementation-flags.ts`.
4. **Aucun ajout movepool manuel** : learnset Champions Gen 9 expose déjà reflect (238 learners) et light-screen (304 learners) sur le roster Gen 1. Confirmer post-Étape 7 via inspection movepool dérivé (plan 087).

### Étape 8 — Refactor stacking left indicators
1. Constantes `constants.ts` : `LEFT_INDICATOR_BASE_X` (position du premier slot), `LEFT_INDICATOR_SLOT_OFFSET` (espacement), `LEFT_INDICATOR_BASE_Y`.
2. Refactor `chargingIndicator` (plan 094) pour utiliser slot 0 du système.
3. `screenIndicator` utilisera slot 1.
4. Tests : sprite avec charging + screen → pas de collision visuelle.

### Étape 9 — Renderer sprite screen indicator (MVP)
1. Constantes `SCREEN_INDICATOR_FONT_SIZE`, `SCREEN_REFLECT_COLOR`, `SCREEN_LIGHT_SCREEN_COLOR`, `SCREEN_PROTECTED_ALPHA = 0.5`.
2. API `PokemonSprite.setScreenIndicator(kind: ScreenKind | null, remainingRounds: number, role: "caster" | "protected")` :
   - Stocke ref `this.screenIndicator: Phaser.GameObjects.Text | null`.
   - `null` → destroy + clear ref.
   - Sinon : icône bouclier + label. `role === "caster"` : label `"🛡{remainingRounds}"`, alpha 1.0. `role === "protected"` : label `"🛡"` (pas de compteur), alpha `SCREEN_PROTECTED_ALPHA`.
   - Position : slot 1 du système left-indicators.
3. `destroy()` / `playFaintAndStay()` / KO handler appellent `setScreenIndicator(null, 0, "caster")`.

### Étape 10 — Renderer tile highlight (MVP)
1. `packages/renderer/src/screens/ScreenTileHighlight.ts` :
   - Constructor `(scene, casterId, kind, initialPosition)` — crée `Phaser.GameObjects.Graphics` rempli sur les tiles dans r3 Chebyshev de `initialPosition`.
   - `update(newPosition)` clear + redraw sur le nouveau set de tiles.
   - `destroy()` retire de la scène.
2. Constantes `SCREEN_HIGHLIGHT_ALPHA = 0.25`, `SCREEN_HIGHLIGHT_RADIUS_TILES = 3`, `SCREEN_HIGHLIGHT_DEPTH` (entre tiles et sprites).
3. Couleurs par kind ou bleu unifié `#88bbff` MVP (à trancher impl visuelle).
4. Overlap multi-auras : si une tile est dans 2 auras alliées, peint deux fois (alpha additif natif Phaser).
5. Registry `scene.screenHighlights: Map<casterId, ScreenTileHighlight>` géré par GameController.

### Étape 11 — Renderer InfoPanel badge (MVP)
1. Helper `getScreenBadge(pokemonId, state)` dans `InfoPanel.ts` :
   - Retourne `{ key: "infoPanel.aura.caster", params: { kind, turns } }` si pokemonId est caster d'une aura active.
   - Retourne `{ key: "infoPanel.aura.protected", params: { kind } }` si pokemonId est allié protégé (au moins une aura alliée le couvre).
   - Si caster ET aussi protégé par un autre allié : afficher 2 badges (un par aura distinct).
2. Style badge identique aux autres volatiles. Style "protected" légèrement atténué (border dashed ou alpha 0.7).
3. Refresh via `refreshFromState` standard.

### Étape 12 — Renderer GameController câblage
1. Helper partagé `computeProtectedAlliesForAura(state, aura): string[]` (retourne IDs alliés vivants dans r3 du caster, hors caster lui-même).
2. Case `ScreenPosted` :
   - `casterSprite.setScreenIndicator(event.kind, event.durationRounds, "caster")`
   - Create `ScreenTileHighlight(casterId, kind, casterPosition)`, store in `scene.screenHighlights`.
   - Compute protected allies → pour chacun `setScreenIndicator(kind, 0, "protected")`.
   - Float text "[move name]!" sur caster (couleur teamColor).
   - InfoPanel refresh.
3. Case `ScreenDissipated` / `ScreenBroken` :
   - Récupère casterId, kind.
   - `casterSprite.setScreenIndicator(null, 0, "caster")`.
   - Destroy tile highlight, remove entry.
   - Compute protected allies (avant suppression de l'aura) → pour chacun `setScreenIndicator(null, 0, "protected")`. **Attention** : si l'allié est protégé par une autre aura encore active, recompute son status et set le bon indicator.
   - Si Broken : flash blanc sur caster + log custom.
   - InfoPanel refresh.
4. Case `PokemonMoved` :
   - Si moved pokemon est caster d'une aura : `ScreenTileHighlight.update(newPosition)` + recompute protected allies (diff old/new set, update setters).
   - Si moved pokemon n'est pas caster : pour chaque aura alliée active, recompute si moved pokemon est protégé maintenant (entré ou sorti du rayon) → update indicator.
5. Case `RoundStarted` (decrement) : itère screens actives, sync `setScreenIndicator(kind, remainingRounds, "caster")` pour update compteur.
6. Sur KO allié protégé : son indicateur disparaît avec son sprite (auto via destroy).
7. Sur KO caster : ScreenDissipated déjà émis par core → flux normal.

### Étape 13 — i18n FR/EN
1. Ajouter clés dans `packages/renderer/src/i18n/locales/fr.ts` et `en.ts` + `types.ts` (TranslationKey union) :
   - `screen.kind.reflect`, `screen.kind.lightScreen`
   - `screen.posted`, `screen.dissipated`, `screen.broken`
   - `infoPanel.aura.caster`, `infoPanel.aura.protected`
2. BattleLogFormatter : 3 nouveaux cases (ScreenPosted/Dissipated/Broken).

### Étape 14 — Sandbox config
1. Étendre `SandboxConfig` avec `screens?: { kind: ScreenKind; casterTeam: "player" | "dummy"; remainingRounds: number }[]` pour seed états au boot.
2. Sandbox panel UI : (Phase 2 polish, hors MVP — pas dans ce plan).

### Étape 15 — IA scoring
1. Étendre `action-scorer.ts` :
   - Pose screen : `scoreScreenPosting(caster, screenKind, state)`.
   - Brick Break vs aura : modifier score si target est dans aura active.
2. Tests scoring `ai-screens.scoring.test.ts` (3 scénarios : pose t1 vs t6, brick break prio target aura).

### Étape 16 — OP sets
1. Lancer `pnpm op-sets:analyze` pour voir si des sets curés référencent reflect/light-screen — si oui, marquer comme dispo (déjà implem).
2. Ajouter manuellement 2-3 OP sets exemples avec screens (ex: Alakazam barrier-supporter avec reflect + light-screen + recover + psychic).
3. Pas obligatoire pour le plan, mais valoriser le contenu.

### Étape 17 — Tests + Gate CI
1. Tests unit : ~22 nouveaux (screens-state, screens.ts modifier, handle-post-screen, brick-break modifier, action-scorer).
2. Tests intégration : 5 fichiers (screens-lifecycle, reflect, light-screen, brick-break-screens, brick-break-dual-aura, light-clay) — ~13 scénarios. Inclut **test explicite Brick Break vs cible double-protected** (cible porte sa propre aura ET dans aura d'allié — assertion : ×2 + casse seulement la sienne).
3. `pnpm test` + `pnpm test:integration` + `pnpm typecheck` + `pnpm lint` + `pnpm build`.
4. Régénérer golden replay si seed déterministe touche (peu probable, screens optionnels par défaut).
5. Smoke test sandbox via visual-tester (humain valide).

### Étape 18 — Docs
1. `docs/implementations.md` : +2 moves, +1 item.
2. `docs/decisions.md` : entries pour rayon r3, granularité aura mobile, durée Light Clay, Aurora Veil dropped v1, Brick Break ×2/×1.5 design.
3. `docs/next.md` + `STATUS.md` post-impl.
4. `docs/abilities-system.md` : pas touché (pas d'ability).
5. Backlog : ajouter "Aurora Veil v2 post-Z-A", "Mist / Safeguard" et "Sandbox panel screens config" si pertinent.

## Critères d'acceptation

- [ ] 2 moves jouables (reflect, light-screen) en sandbox
- [ ] Indicateur sprite caster (icône bouclier + compteur tours) visible à gauche barre HP, stack avec chargingIndicator ⚡
- [ ] Indicateur sprite allié protégé (icône bouclier sans compteur, alpha 0.5) visible à gauche barre HP
- [ ] Tiles dans r3 du caster highlight bleu unifié `#88bbff` alpha 0.25, suit caster en déplacement
- [ ] Alliés entrent/sortent du rayon → indicateur protected apparaît/disparaît en temps réel
- [ ] InfoPanel affiche badge `"{kind} {t}t"` caster et `"{kind}"` allié protégé
- [ ] ×0.5 dégâts Phys via Reflect, ×0.5 Spé via Light Screen
- [ ] Crits percent les screens (×1.0 sur target protégée si crit)
- [x] Brick Break vs caster d'aura (any distance) → dégâts ×2 + toutes les auras du caster supprimées
- [x] Brick Break vs allié-protégé (non-caster) → dégâts normaux (Reflect ×0.5 si applicable), aucune cassure
- [x] Brick Break vs target hors aura → dégâts normaux, aucune aura touchée
- [x] Brick Break vs caster avec Reflect + Light Screen actifs → ×2 + casse les 2 auras (1 ScreenBroken event par kind)
- [ ] Light Clay → durée 8 tours au lieu de 5
- [ ] Caster KO → aura disparaît immédiatement (event ScreenDissipated)
- [ ] Décrément +1 par round, suppression à 0 (event ScreenDissipated)
- [ ] 1 caster = 1 aura : repose écrase l'ancienne
- [ ] BattleLog affiche pose/dissipation/cassure en FR + EN
- [ ] CI verte : ≥1600 unit + ≥215 intégration + build + lint + typecheck

## Risques / questions

- **Performance damage-calc** : itération `state.screens.values()` à chaque hit. État rarement > 2-3 auras simultanées → négligeable. Bench si > 1ms par hit (improbable).
- **Brick Break canon vs nous** : canon Showdown casse les screens **du target side** quelle que soit la distance ou la cible spécifique. Nous on lie au target précis (caster ou protégé direct). Trade-off design accepté : plus tactique, force le joueur à identifier qui porter l'aura. Documenter dans `docs/decisions.md`.
- **Double caster même équipe** : 2 alliés posent Reflect → 2 entries dans Map. Pokemon entre les deux auras → reste ×0.5 (idempotent), pas de cumul ×0.25. Bug potentiel si on cumule par erreur — assertion test.
- **Repose même caster** : si A pose Reflect puis Light Screen, l'ancienne entry est écrasée. Souhaité gameplay (force choix tactique) — documenter.
- **Brick Break ×2 vs caster fragile** : Alakazam/Abra peuvent être OHKO par Machoc Brick Break STAB×2 dès la pose. C'est l'intention (punir le caster fragile = force à le cacher). Surveiller en playtest, ajuster à ×1.75 si OHKO systématique.
- **Light Clay + Chansey/Mr. Mime** : Light Screen 8 tours sur tank Spé extrême → quasi-immortel face attaques Spé pendant 60-70% partie. Counter-play unique = Brick Break (Machoc/Hitmonchan/etc. présents dans roster). Surveiller dominance playtest.
- **Indicateur caster vs protégé : double rôle** : si A pose Reflect et est dans aura B de Light Screen allié → A affiche 2 indicateurs (caster Reflect + protected LightScreen). Slot system left-indicators doit gérer plusieurs slots libres ou InfoPanel uniquement (sprite indicator priorisé sur le rôle "caster" si conflit). Décision : sprite shows caster role, InfoPanel montre les deux badges.
- **Targeting Self pour screens** : on utilise `TargetingKind.Self` car pas de tile-target. Verifier que `getValidTargetPositions` retourne bien la case du caster et que le résolveur n'affiche pas de portée AoE. Mirror weather setters (sunny-day etc.).
- **Critique percent screens** : nécessite que `damage-calculator` sache si le hit est crit AVANT d'appliquer le screen multiplier. Ordre actuel : crit calculé dans damage-calculator. Pass `isCrit` en arg à `computeScreenMultiplier`. Test dédié.
- **Sandbox seed états** : étape 12 optionnelle dans ce plan. Si on l'omet, on teste seulement via combat live (pose puis observe).
- **Brick Break interactions weird** :
  - Si target porte aura ET est dans aura d'allié (double protection caster-of-own + allié-protected) → ×2 (priorité caster direct). Casse une seule des deux ? Décision : casse seulement la sienne. L'aura de l'allié reste. Documenter.
  - Si target hors aura mais dans range mêlée d'un caster-aura ennemi adjacent → Brick Break ne touche pas le caster (target = un autre Pokemon), pas de bonus.

## Dépendances

- Plan 084 (Weather) — DONE — fournit pattern field state + Snow detection
- Plan 073 (Held Items) — DONE — fournit HeldItemHandler infrastructure
- Plan 087 (Playable Pokemon refactor) — DONE — learnset dérive auto

## Estimation

- Étapes 1-7 (core + data) : ~5h (drop Aurora Veil = -1h)
- Étapes 8-12 (renderer indicators + tile highlight + InfoPanel + câblage) : ~5h (refactor chargingIndicator stacking + diff alliés protégés sur PokemonMoved = +1h vs initial 4h)
- Étapes 13-14 (i18n + sandbox config) : ~1h
- Étapes 15-16 (IA + OP sets) : ~1.5h
- Étapes 17-18 (tests + docs) : ~2h

Total estimé : ~14-15h. Plan medium-large.

## OP sets cibles (post-impl, optionnel)

Top 5 candidats curation Smogon/CoupCritique (game-designer review) :
- **Mr. Mime** (canon support-barrier Gen 1) : Reflect + Light Screen + Recover/Substitute + Psychic. Held : Light Clay.
- **Hypno** (tank Psy contrôle) : Reflect/Light Screen + Hypnosis + Body Slam + Confuse Ray. Held : Light Clay.
- **Alakazam** (fragile glass-cannon mage) : Reflect + Recover + Psychic + Focus Blast. Held : Light Clay (compensé fragilité).
- **Lapras** (tank Eau/Glace + utility) : Light Screen + Ice Beam + Surf + Body Slam. Held : Light Clay ou Leftovers.
- **Chansey** (tank HP/SpD extrême) : Light Screen + Soft-Boiled + Toxic + Seismic Toss. Held : Light Clay (warning : forteresse Spé quasi-indestructible — surveillance balance).
