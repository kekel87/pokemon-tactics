# Plan 094 — Charge moves visibles (Skull Bash / Sky Attack / Razor Wind)

> Statut : **done**
> Livré : 2026-05-22
> Créé : 2026-05-22
> Auteur : Claude
> Révisions : plan-reviewer + game-designer 2026-05-22 — solar-blade dropped (aucun learner roster), razor-wind = Cone r3, sky-attack flinch 30% gardé, AI heuristique skull-bash backlog.

## Objectif

Ajouter 3 moves 2-tours canon manquants (skull-bash, sky-attack, razor-wind) + rendre visible l'état de charge actuellement opaque côté joueur. Solar-blade dropped (audit game-designer : aucun Pokemon roster ne l'apprend en Gen 1). Aujourd'hui, solar-beam et les 6 TP moves utilisent `chargingMove` + event `MoveCharging`, mais hors TP (sprite caché en semi-invul), seul un float text T1 prévient le joueur. Au T2 le joueur ne sait plus quel Pokemon est en charge à part en relisant le log.

Livraison :
- 3 moves data nouveaux (Gen 1)
- Indicateur "charging" persistant sur sprite (texte Unicode `⚡` à droite barre HP, parité visuelle avec `statusIcon`)
- Badge volatile `Charge {moveName}` dans `InfoPanel`
- Tag `2 tours` dans `MoveTooltip` quand `move.twoTurnCharge`
- Champ optionnel `chargeEffects?: Effect[]` sur `MoveDefinition` pour T1 side-effect (Skull Bash Def↑)
- i18n FR/EN, tests intégration par move, build/lint/typecheck verts

## Pourquoi maintenant

- Plans 088 (Teleport) + 093 (Baton Pass) ont normalisé la mécanique `twoTurnCharge` et la lifecycle `chargingMove`. Reste à exposer côté UI.
- 4 moves dispo dans `packages/data/reference/moves.json`. Aucune ability/mechanic neuve nécessaire (sauf `chargeEffects` simple pour skull-bash).
- Sans cue persistant, mode CT (skip rapide entre tours) cache complètement l'état charge entre T1 et T2.

## Hors scope

- **Aura/glow shader sur sprite** : rendu visuel poussé (halo coloré par type) reporté à refonte renderer ou Phase 3.5 Babylon.
- **Marqueur timeline** (icône sur slot du caster en charge) : reporté plan dédié `TurnTimeline`.
- **Razor-wind multi-ennemis canon** : Razor Wind Gen 1 spread move (tous les ennemis). v1 = pattern `Cone` ou `Slash` (à trancher Étape 1, défaut Cone r3) — parité tactique, pas multi-tous.
- **Geomancy / freeze-shock / ice-burn / meteor-beam / electro-shot** : autres charges hors roster Gen 1 ou mécaniques exotiques (weather steal, type extra). Reportés Phase 9.
- **Indicateur ⚡ caché sur TP moves** : HP bar + status icon + ⚡ sont enfants du `container`, alors que `setSemiInvulnerable` cache uniquement `sprite ?? circle`. Donc ⚡ reste visible pendant fly/dig/bounce/phantom-force/shadow-force/dive — comportement souhaité.

## Décisions actées

1. **Nouveau champ optionnel `chargeEffects?: Effect[]`** sur `MoveDefinition`. Appliqués au caster pendant la branche `twoTurnCharge && !isFiringCharged` dans `BattleEngine.useMove`, juste après émission `MoveCharging`. Pipeline classique `effect-processor` réutilisé avec `caster` comme target. Pas de check accuracy (auto-hit self).
1bis. **Nouveau statut volatile `StatusType.Flinch`** dans `packages/core/src/types/status-type.ts`. Sémantique : appliqué sur cible suite à hit avec secondary `Flinch` (chance %). Au prochain `startTurn` du flinched Pokemon, `restrictActions = true` (peut tourner direction mais pas Move/UseMove) ou simplement skip turn (à trancher impl — Showdown = skip full action). Décision : **skip Move + UseMove + Undo**, EndTurn (avec direction) reste autorisé. Volatile retiré en fin de tour victime (durée 1 tour). Émis via event `BattleEventType.Flinched` (nouveau) côté core + handler renderer (float text + i18n). Nécessite : enum, handler `handle-flinch.ts`, branche `getLegalActions`, branche `processSecondaryEffects`, retrait fin tour, i18n FR/EN ("Flinched" / "A bronché"), test unit + intégration.
2. **3 moves data** dans `packages/data/src/overrides/tactical.ts` :

   | Move | Type | BP | Acc | Ciblage | Charge T1 | Notes T2 |
   |------|------|----|----|----|----|----|
   | skull-bash | Normal | 130 | 100 | Single r1 | `chargeEffects: [Def +1 self]` | Fire damage |
   | sky-attack | Flying | 140 | 90 | Single r2 | none | `critRatio: 1` + secondary Flinch 30% |
   | razor-wind | Normal | 80 | 100 | Cone r3 | none | `critRatio: 1` |

   Razor-wind pattern fixé **Cone r3** (game-designer 2026-05-22) — narrative aérien + distinctif du roster (Slash existe sur Tranch'Herbe/Cru-Ailes).

3. **Renderer — indicateur sprite** :
   - Nouveau `PokemonSprite.setChargingIndicator(moveId: string | null)` : ajoute/retire `Phaser.GameObjects.Text` `"⚡"` (font `FONT_FAMILY`, taille = `STATUS_SPRITE_ICON_SCALE` calibré) à droite de la barre HP, miroir de `statusIcon` mais offset X opposé. Pas d'image asset.
   - Position : `HP_BAR_WIDTH / 2 + CHARGING_INDICATOR_OFFSET_X` (nouvelle constante `constants.ts`, valeur miroir négatif de `STATUS_SPRITE_ICON_OFFSET_X`). Si conflit visuel avec statusIcon (les deux à droite), tester puis ajuster (statusIcon droite, charging gauche au-dessus barre).
   - `GameController` :
     - Au battle init (`refreshUI` ou équivalent), parcourt `state.pokemon` et appelle `setChargingIndicator(p.chargingMove?.moveId ?? null)` pour synchroniser.
     - `MoveCharging` event → `setChargingIndicator(moveId)` (en plus du float text + semi-invul existants).
     - `MoveStarted` event → si caster a `chargingMove === undefined` après cette frame (T2 fire ou cancel), `setChargingIndicator(null)`. Tester via lecture state post-emit. Alternative : nouveau event `MoveChargingCleared` côté core émis dans la branche `isFiringCharged`. Choix : **lire state** (zéro touche core, parité event-driven minimal).
     - `PokemonKo` / `PokemonEliminated` event → `setChargingIndicator(null)` (sécurité, sprite déjà détruit dans Eliminated).
4. **InfoPanel — badge volatile** :
   - Étendre la boucle `VOLATILE_LABELS` dans `InfoPanel.ts:209` pour traiter `pokemon.chargingMove` comme un volatile artificiel.
   - Format badge : `"Charge {moveName}"` via clé i18n `status.charging` avec param `{move}`. Nom move résolu via `getMoveName(chargingMove.moveId, getLanguage())`.
   - Ordre d'affichage : avant volatile statuses existants, ou bout de liste (à trancher visuellement, défaut : bout).
5. **MoveTooltip — tag 2 tours** :
   - Étendre le tooltip pour ajouter une ligne `"⏱ 2 tours"` (i18n `move.tooltip.twoTurnCharge`) si `move.twoTurnCharge === true`. Variante `"⏱ 2 tours (instant Soleil)"` (i18n `move.tooltip.twoTurnChargeSunSkip`) si `sunSkipsCharge === true`.
   - Constantes couleur réutilisent `BATTLE_TEXT_COLOR_INFO` ou nouvelle `MOVE_TOOLTIP_HINT_COLOR` dans `constants.ts`. À trancher pendant impl visuelle.
6. **i18n clés nouvelles** (FR/EN) :
   - `status.charging` (template `Charge {move}` / `Charging {move}`)
   - `move.tooltip.twoTurnCharge` (`2 tours` / `2-turn charge`)
   - `move.tooltip.twoTurnChargeSunSkip` (`2 tours (instant Soleil)` / `2-turn charge (instant in Sun)`)
   - `move.charging.skull-bash` / `move.charging.sky-attack` / `move.charging.razor-wind` / `move.charging.solar-blade` : float labels T1 spécifiques (style "Rayonne!" pour solar-beam). Décision : labels par défaut = nom du move (pas de label custom v1 sauf solar-blade qui réutilise pattern solar-beam). Skip les 4 entrées custom v1, le fallback `getMoveName` gère.
7. **AI scoring** : aucun changement spécifique. Les 4 moves nouveaux sont exposés via learnset standard (plan 087 dérivé). `lockedMoveId` lors de la T1 contraint déjà l'IA à fire T2 sans re-choix. À auditer pendant impl : l'IA évalue-t-elle `useMove(skull-bash)` T1 sans pénalité (puisque pas de hit ce tour) ? Si trop joué, prévoir patch backlog post-livraison.
8. **Tests intégration** : 4 nouveaux fichiers `packages/core/src/battle/moves/{skull-bash,sky-attack,razor-wind,solar-blade}.test.ts` (1 par move, scénarios T1 charge + T2 fire + lockedMoveId + skull-bash Def↑ T1 + solar-blade sun-skip).

## Étapes

### Étape 1 — Flinch core ✅ DONE
1. ✅ `StatusType.Flinch` ajouté (`packages/core/src/enums/status-type.ts`).
2. ✅ `BattleEventType.Flinched` ajouté (`packages/core/src/enums/battle-event-type.ts`) + variant `BattleEvent` (`packages/core/src/types/battle-event.ts`).
3. ✅ Flinch ajouté à `VOLATILE_STATUSES` set + duration handler retourne 1 (`packages/core/src/battle/handlers/handle-status.ts`). Pas de nouvel EffectKind — réutilise `EffectKind.Status` chance % comme thunder-punch.
4. ✅ `BattleEngine.processFlinch` (mirror `processConfusion`) : retire volatile au startTurn de la victime, émet `Flinched` + `StatusRemoved`, set `flinchedThisTurn = true`.
5. ✅ `getLegalActions` exclut Move + UseMove + UndoMove quand `flinchedThisTurn` ; EndTurn reste autorisé.
6. ✅ `submitAction` early-return `InvalidAction` si flinchedThisTurn + action Move/UseMove/UndoMove. Refactor merge `confusionEvents` dans `result.events` pour toutes les branches (EndTurn inclus).
7. ✅ Tests unit `packages/core/src/battle/mechanics/flinch-status.test.ts` (4 tests, all pass). CI verte : 1570 unit + 211 intégration.

### Étape 2 — Data + Core `chargeEffects`
1. Étendre `MoveDefinition` (`packages/core/src/types/move-definition.ts`) avec `chargeEffects?: Effect[]`.
2. Dans `BattleEngine.useMove` (branche T1 charge, après `emit(chargingEvent)` et avant `return`), si `move.chargeEffects` défini, exécuter pipeline `processEffects` sur le caster en self-target. Pas d'accuracy check. Tests unit isolés sur la branche.
3. Ajouter les 4 moves dans `tactical.ts` (voir tableau §2). Trancher pattern razor-wind (Cone r3 par défaut). Vérifier `loadData()` les charge sans warning.
4. Ajouter movepool entries via OP sets ou learnset si manquant — décider après inspection : si déjà dans learnset Champions, rien à faire (héritage plan 087). Sinon, ajouter dans op-sets pour les Pokemon roster qui les apprennent canon.
5. Tests intégration 4 fichiers (skull-bash Def↑ T1, sky-attack flinch+crit T2, razor-wind pattern AoE T2, solar-blade sun-skip).

### Étape 3 — Renderer indicateur sprite
1. Constante `CHARGING_INDICATOR_OFFSET_X` dans `constants.ts` (mirror status icon, ajustée visuellement). Constante `CHARGING_INDICATOR_FONT_SIZE` aussi.
2. API `PokemonSprite.setChargingIndicator(moveId: string | null)` dans `PokemonSprite.ts`, parité avec `setStatusIcon`. Symbol `⚡`. Stocker ref `this.chargingIndicator: Phaser.GameObjects.Text | null`.
3. `destroy()` / `playFaintAndStay()` / KO handler appellent `setChargingIndicator(null)`.
4. `GameController.handleEvent` :
   - `case MoveCharging`: appelle `sprite.setChargingIndicator(event.moveId)` après le float text.
   - Après chaque event, check si caster d'un MoveCharging précédent n'a plus `chargingMove` → clear. Implémentation simple : à chaque `MoveStarted` / `MoveEnded`, lire `state.pokemon.get(attackerId)?.chargingMove` et synchro.
5. Battle init (`refreshUI` ou place équivalente) : itère sprites, sync indicateur depuis state. Couvre cas sandbox reload mi-charge.

### Étape 4 — InfoPanel badge
1. Étendre boucle existante `for (const volatile of pokemon.volatileStatuses)` ou injecter une entrée avant. Préférer : helper `getChargingLabel(pokemon)` qui retourne `{ key: "status.charging", params: { move: moveName } } | null`, intégré au rendu badges.
2. Style identique aux autres badges volatiles (border, color, padding).
3. Garder readonly — le badge disparaît dès que `chargingMove` clear (via `refreshFromState` standard).

### Étape 5 — MoveTooltip 2-tours
1. Localiser méthode rendu lignes dans `MoveTooltip.ts`.
2. Ajouter ligne conditionnelle après lignes BP/accuracy/PP : si `move.twoTurnCharge`, append `"⏱ 2 tours"` (ou variante sun-skip).
3. Style : couleur secondaire, pas en gras.

### Étape 6 — i18n FR/EN
1. Ajouter clés `status.charging`, `move.tooltip.twoTurnCharge`, `move.tooltip.twoTurnChargeSunSkip` dans `packages/renderer/src/i18n/locales/fr.ts` + `en.ts` + `types.ts` (TranslationKey union).
2. Vérifier `getChargingFloatLabel` (`GameController.ts:122`) — peut-être ajouter entrée pour solar-blade qui mirror solar-beam ("Rayonne!"). À trancher : v1 reste fallback `getMoveName` pour les 4 nouveaux, solar-blade peut hériter solar-beam pattern (clé `move.charging.solar-blade`).

### Étape 7 — Tests + Gate CI
1. 4 tests intégration moves (skull-bash Def↑ T1, sky-attack high-crit T2, razor-wind AoE T2, solar-blade sun-skip parité solar-beam).
2. Test unit `PokemonSprite.setChargingIndicator` (mock Phaser scene, vérifier création/destruction Text). Optionnel selon coverage existant des autres setters sprite.
3. `pnpm test` (1566 unit attendu +4 nouveaux ≈ 1570) + `pnpm test:integration` (devrait rester stable).
4. `pnpm typecheck` + `pnpm lint` + `pnpm build`.
5. Régénérer golden replay si seed déterministe touche (probable non, mais vérifier `regenerate-golden-replay.ts`).

### Étape 8 — Docs
1. Mettre à jour `docs/implementations.md` (+4 moves).
2. Entrée `docs/decisions.md` : design `chargeEffects` + choix scope (drop flinch sky-attack, drop AoE multi razor-wind).
3. `docs/next.md` + `STATUS.md` post-impl.
4. Backlog : ajouter "Flinch core (sky-attack T2 30%)" comme tâche future.

## Critères d'acceptation

- [ ] 4 moves jouables en sandbox (charge T1, fire T2, lockedMoveId verrouille bien)
- [ ] skull-bash T1 émet `StatStageChange Def +1 self` + caster bien Def↑ stage en state
- [ ] sky-attack T2 critRatio actif + flinch 30% appliqué sur cible (sky-attack victime perd Move/UseMove tour suivant)
- [ ] razor-wind T2 pattern AoE (Cone r3 défaut) frappe ennemis dans cone, friendly fire géré standard
- [ ] solar-blade sous Soleil : skip charge, fire instant (parité solar-beam)
- [ ] Indicateur `⚡` visible sur sprite caster T1→T2 pour TOUS les 11 charge moves (solar-beam, solar-blade, skull-bash, sky-attack, razor-wind, fly, dig, bounce, phantom-force, shadow-force, dive) — y compris pendant semi-invul (HP bar reste visible)
- [ ] InfoPanel badge "Charge {move}" visible quand `chargingMove` défini
- [ ] MoveTooltip affiche "2 tours" sur les 11 moves charge + variante sun-skip sur solar-beam/solar-blade
- [ ] Volatile Flinch retire d'office après 1 tour victime, jamais persistant
- [ ] CI verte : 1570+ unit + 215+ intégration + build + lint + typecheck

## Risques / questions

- **Conflit visuel statusIcon vs chargingIndicator** : les deux à droite barre HP. Validation visuelle requise mi-impl. Plan B : indicateur à gauche.
- **`chargeEffects` granularité** : v1 = self-target only. Si un futur move nécessite chargeEffects sur cible (rare), étendre via flag. Pas de risque immédiat.
- **AI scoring T1 inutile** : si IA pose skull-bash T1 sans valoriser le boost Def, comportement greedy peut être sous-optimal. Audit après impl, patch séparé si problème.
- **Flinch cible déjà KO** : sky-attack fatal → pas de flinch (non-fatal hit only, vérifié dans processSecondaryEffects).
- **Flinch + CT system** : à vérifier — si le tour victime arrive après cleanup standard, le volatile pourrait être retiré avant qu'elle joue. Audit Étape 1.
- **Razor-wind Cone vs Slash** : à trancher Étape 1 avec game-designer (recommandé Cone r3 défaut).

## Dépendances

- Plan 088 (Teleport + `twoTurnCharge`) — DONE
- Plan 093 (Baton Pass) — DONE
- Plan 087 (Playable Pokemon refactor — learnset dérive auto) — DONE
