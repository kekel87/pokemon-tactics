# Plan 175 — Preview de combat (prévision de dégâts détaillée)

> **Statut** : ready (validé humain 2026-07-25, après `plan-reviewer` + `game-designer` + `best-practices`)
> **Créé** : 2026-07-25
> **Phase** : 6.5 « Client jouable », Lot 3 (compléter l'UI). Suite des plans 174 (InfoPanel allié) et 177 (panneau d'info de case).
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` — § « Preview combat (à la validation de cible) ».

## Alignement avec le cadre

Le plan 173 (Phase 6.5 client jouable) demande sous « Preview combat » :
- ✅ Prévision de dégâts (`min–max + %` + indicateur K.O.) — **couvert par Étapes 1–4 & 6**
- ✅ Barre de vie prédite (fantôme) + portrait cible — **couvert par Étape 5 & 8**
- ✅ Résumé attaque (type, effet, proba secondaire, précision, crit) — **couvert par Étape 5 & 6**
- ✅ Modificateurs (efficacité type, dos +15%, surplomb hauteur) — **couvert par Étapes 1–4 & 6**
- ✅ AoE (cycle + alerte allié) — **couvert par Étapes 7–10 & 12**

**Ce plan répond entièrement à la demande du cadre 173.**

## Motivation

Le joueur valide une attaque presque à l'aveugle. Aujourd'hui, à la confirmation, il obtient **un seul chiffre flottant** au-dessus de la barre PV de la cible : `min–max` (+ suffixe dos), ou « Immunisé ». Il ne sait pas :

- si le coup **met K.O.** — il doit comparer mentalement la fourchette aux PV restants ;
- **quelle proportion** des PV part (un « 42–50 » ne veut rien dire sans le total) ;
- s'il va **rater** (précision effective jamais montrée nulle part) ;
- **pourquoi** ce chiffre (efficacité de type ? dos ? surplomb ? terrain ?) ;
- s'il **touche un allié** dans une zone d'effet.

C'est le cœur tactique du jeu, et c'est le trou le plus visible du Lot 3.

## Décisions humaines actées (2026-07-25)

1. **Emplacement — swap avec le panneau de case.** Le `TileInfoPanel` (plan 177) cède sa place au panneau de preview dans la rangée `.bc-infopanel-row` pendant la phase de confirmation, puis revient. Pas de 3ᵉ panneau permanent (encombrement mobile).
2. **Déclenchement — à la confirmation seulement.** Le panneau apparaît quand la cible est verrouillée (`inputState.phase === "confirm_attack"`), exactement comme les labels in-world actuels. Pas de calcul au survol.
3. **Valeurs exactes maintenant.** Pas de fourchette élargie par le fog : le gating d'info ennemie n'existe pas encore (plan 176) et le local/sandbox est plein-info. `min–max` = la fourchette de roll canon (0.85–1.0), rien d'autre. Le passage en plage se fera au plan 176 avec le reste du fog.
4. **AoE — cible focus + cycle.** Le panneau détaille **une** cible à la fois ; un contrôle fait défiler les cibles de la zone. Les labels in-world restent affichés sur **toutes** les cibles simultanément (comportement actuel inchangé).
5. **Critique en `%` arrondi à l'entier** (`6 %`, `13 %`, `50 %`) — pas de décimale. Arbitrage d'un désaccord entre agents : `game-designer` voulait des crans qualitatifs (le jeu pense en crans), `best-practices` rappelait que le `%` est le standard du genre depuis Fire Emblem *Thracia 776*. L'arrondi supprime la fausse précision sans quitter le standard. « Garanti » / « Impossible » restent des marqueurs textuels distincts, jamais `100 %` / `0 %`.
6. **Verdict K.O. nuancé — mais seulement si la source de survie est connue du joueur.** Voir § dédié ci-dessous.
7. **Segment fantôme en dégradé** de `min` à `max` : plein jusqu'à `min` (la perte certaine), estompé jusqu'à `max` (la zone de roll).
8. **Corriger `docs/game-design.md` §2 dans ce plan.** Le doc affirme encore « Pas de brouillard de guerre — chaque joueur voit tout » alors que la roadmap et l'architecture actent déjà le plan 176 de révélation progressive. Deux specs incompatibles ne doivent pas coexister pendant qu'on code le 175 (nouvelle étape 12).

### Verdict K.O. — garde-fous de survie à 1 PV

Le verdict dérivé de `min`/`max` vs PV **ment** face aux mécaniques de survie à 1 PV, invisibles au calcul de dégâts. Trois sources déterministes existent en jeu (vérifié dans `handle-damage.ts` / `defense-check.ts`) :

| Source | Type | Condition | Connue du joueur ? |
|--------|------|-----------|--------------------|
| **Ténacité** (`endure`) | move → `activeDefense` / `endureAtOne` | posé par une action du tour | **toujours** — le joueur a vu l'action, badge visible |
| **Fermeté** (`sturdy`) | talent | cible à PV max | aujourd'hui oui ; gaté au plan 176 |
| **Ceinture Force** (`focus-sash`) | objet tenu | cible à PV max | aujourd'hui oui ; gaté au plan 176 |

**Règle actée (humain, 2026-07-25)** : le verdict n'est nuancé que si la source est **connue du joueur**. Concrètement, le builder teste la même condition de visibilité que celle qui gouverne l'affichage du talent/objet dans l'InfoPanel — pas l'état réel du core. Aujourd'hui (pas de fog) cela revient à « toujours », mais **le prédicat doit être écrit dès maintenant** pour que le plan 176 n'ait qu'à le rebrancher : sinon le panneau révélerait une Ceinture Force que le fog est censé cacher. Un flag `revealedItem` existe déjà sur `PokemonInstance` (plan 163, Fouille) — c'est le point d'accroche naturel.

Rendu : `MET K.O. — sauf Ceinture Force`. Quand la source est inconnue, **aucune mention** et le verdict reste catégorique (assumé : le fog implique de se tromper parfois).

**Bandeau** (`focus-band`) est **hors garde-fou** : sa survie est probabiliste, pas déterministe — le nuancer transformerait tout verdict en « peut-être », pour un objet qui échoue le plus souvent.

### Point à valider en human-testing — le contrôle de cycle

Le cycle arrive **avant** la couche d'input device-agnostique (Lot 2). Proposition, à confirmer à l'écran :

- **Chevrons `◀ ▶` dans l'en-tête du panneau** — cliquables à la souris, tapables au doigt, focusables au clavier. C'est le seul mécanisme qui marche sur les trois entrées sans rien câbler de neuf.
- **+ `Tab` / `Shift+Tab`** pendant la phase de confirmation, pour le clavier (le focus DOM tombe naturellement sur les chevrons).
- Le compteur `2/3` est affiché à côté des chevrons.
- Panneau **masqué et cycle inerte** quand il n'y a qu'une seule cible (cas majoritaire).

Quand la couche d'input du Lot 2 arrivera, `cycle-target` deviendra une action logique et les chevrons resteront comme affordance tactile.

## Constat carto (2026-07-25)

### Ce qui existe déjà

- **`BattleEngine.estimateDamage(attackerId, moveId, defenderId, targetPosition?, attackerPosition?)`** (`packages/core/src/battle/BattleEngine.ts` l.386) — calcule déjà **tout** ce qui compte pour les dégâts : morphs de move (Force Nature, Champlification), multiplicateurs de champ (BP + dégâts), modificateur de hauteur, bonus de type du terrain de l'attaquant, modificateur de dos, talents, objets. Retourne `DamageEstimate { min, max, effectiveness, facingModifier }` (`packages/core/src/types/damage-estimate.ts`).
- **Chaîne d'affichage in-world complète** : `battle-orchestrator.ts` `buildDamageEstimates()` (l.805) → port `board.setDamageEstimates()` → `battle-board-view.ts` → `babylon-sprite-hud.ts` `showDamageEstimate()`. Gaté par `context.isDamagePreviewEnabled()` (réglage *Prévisualisation dégâts*, `packages/app/src/settings/index.ts`).
- **Empreinte de zone** : `this.previewTiles` est déjà la liste exacte des cases touchées au moment de la confirmation ; `previewOccupantIds()` (l.791) donne déjà les occupants vivants — **alliés inclus** (c'est la base de l'alerte tir allié, il n'y a rien à recalculer).
- **Rangée de panneaux** : `.bc-infopanel-row` dans `battle-chrome.ts` (l.96) contient `[infoPanel, tileInfoPanel]` — le point d'insertion du swap.
- **Gabarit de composant** : `tile-info-panel.ts` + son builder `buildTileInfoView` (`battle-views.ts` l.564) + son view-model `TileInfoData` (`render-ports/src/view-models.ts` l.141). Le plan 175 mirroir cette architecture (view-model localisé côté view-core, composant DOM bête).
- **Assets d'icônes** : `assets/ui/types/<type>.png` (18 types) et `assets/ui/statuses/icon-*.png` déjà utilisés par le plan 177.

### Ce qui manque (les 4 trous réels)

- **Trou #1 — `DamageEstimate` est trop pauvre.** Il expose `effectiveness` et `facingModifier`, mais **pas** `heightModifier` ni `terrainModifier` (calculés dans `BattleEngine.estimateDamage` puis jetés), ni le move résolu après morph (Force Nature change le type affiché !).
- **Trou #2 — aucune précision effective calculable.** `checkAccuracy()` (`packages/core/src/battle/accuracy-check.ts`) mélange le calcul et le tirage RNG : elle calcule `effectiveAccuracy` (crans Précision/Esquive, talents, objets, Gravité ×5/3, override météo, Verrouillage, `bypassAccuracy`) puis renvoie un `boolean`. **Rien de pur n'est exposé.**
- **Trou #3 — aucune chance de critique calculable.** `getCritChance(stage)` est privée à `damage-calculator.ts` (l.21-25), et le cumul des crans (`move.critRatio` + objet + `critStageBoost` volatil + `alwaysCrit`/`guaranteedCritArmed` + immunité `preventsCrit`) vit **inline** dans `calculateDamage` (l.158-166).
- **Trou #4 — pas de view-model ni de composant.** Rien côté `render-ports` / `view-core` / `ui-dom`.

## Périmètre — contenu du panneau

Pour la cible en focus :

| Bloc | Contenu | Source | Affiché quand |
|------|---------|--------|---------------|
| **En-tête** | Portrait + nom de la cible, chevrons `◀ ▶` + compteur `n/N` | `previewOccupantIds()` | toujours ; chevrons si N > 1 |
| **Alerte tir allié** | Bandeau/teinte d'avertissement si la cible en focus est un allié (ou le lanceur) | comparaison d'équipe | si allié dans l'empreinte |
| **Barre de vie prédite** | Barre PV actuelle + morceau retiré en **fantôme** : plein jusqu'à `min`, **dégradé** jusqu'à `max` | `min`/`max` + `currentHp`/`maxHp` | si dégâts > 0 |
| **Dégâts** | `min–max` **et** `%` des PV max (« 42–50 · 31–37 % ») | idem | si dégâts > 0 |
| **Verdict K.O.** | « Met K.O. » (si `min ≥ currentHp`) / « Peut mettre K.O. » (si `max ≥ currentHp > min`) / « Laisse ~X % », **+ garde-fou de survie à 1 PV si connu** (§ dédié) | idem + Ténacité / Fermeté / Ceinture Force | si dégâts > 0 |
| **Sans effet** | Marqueur d'immunité (aligné sur le vocabulaire visuel du plan 177) | `effectiveness === 0` | si immunisé |
| **Précision** | `%` effectif, ou glyphe « touche à coup sûr » si ≥ 100 / `bypassAccuracy` / Verrouillage | **nouveau** `effectiveAccuracy` | toujours (move offensif ou statut) |
| **Critique** | `%` **arrondi à l'entier** ; « Garanti » si forcé ; « Impossible » si `preventsCrit` — jamais `100 %` / `0 %` | **nouveau** `effectiveCritChance` | si move à dégâts |
| **Effet secondaire** | Icône de l'effet + sa `chance` % (statut, baisse de stat, recul…) | `effect.chance` (`types/effect.ts`) | si le move en porte |
| **Modificateurs** | Chips : efficacité de type (`×2`, `×0.5`…), dos (`+15 %`), hauteur (`↑`/`↓` + facteur), terrain (`×1.15`) | `effectiveness`, `facingModifier`, **nouveaux** `heightModifier`/`terrainModifier` | chaque chip si ≠ 1 |

**Langage visuel** : identique au plan 177 — icônes + chiffres courts, quasi zéro texte, réutilisation des assets `assets/ui/types/*` et `assets/ui/statuses/*`. Les glyphes non couverts restent des **émoji placeholder**, remplacés au point d'icônes commun (piste game-icons.net, noté au plan 177). Pas de nouveau pack introduit ici.

**Gating** : tout le panneau est soumis au réglage **Prévisualisation dégâts** existant (le réglage UI dans Settings). Off = le panneau ne s'affiche pas, le `TileInfoPanel` reste seul dans la rangée. Cohérent avec les labels in-world (qui sont aussi gatés par `context.isDamagePreviewEnabled()`). À l'étape 7, vérifier cette condition avant d'appeler `chrome.updateCombatPreview(...)`.

## Architecture et patterns réutilisés (plans 174 & 177)

Le plan 175 suit les **mêmes patterns** que 174 et 177 :
- **View-model pur** (`CombatPreviewData`) : énumère toutes les données, sans aucune dépendance au core. Tous les calculs (formatage %, verdict, chips) sont faits dans le **builder** (étape 6), côté `view-core`.
- **Builder pur** (`buildCombatPreviewView`) : accède au core via `context` (pré-résolu, pas de tirage RNG), retourne un `CombatPreviewData` complètement rempli, testable unitairement.
- **Composant DOM bête** (`createCombatPreviewPanel`) : reçoit le view-model, le rend tel quel, zéro logique, zéro accès core.
- **Orchestrateur** : câble le builder au port (méthode `updateCombatPreview`), gère le cycle via callback.

**CSS tokens partagés** : `--ip-px` (réutilisé de 174), couleurs équipes `--team-N` (existants), aucun nouveau token.

## Extensions core nécessaires

Trois ajouts **purs** (aucune dépendance UI, testables unitairement — voir `.claude/rules/core.md`) :

1. **Enrichir `DamageEstimate`** (`packages/core/src/types/damage-estimate.ts`) : ajouter `heightModifier`, `terrainModifier`, `resolvedMoveType` (après morph Force Nature / Champlification), `resolvedPower`. Champs **ajoutés**, aucun retiré → les ~15 appelants IA (`action-scorer.ts`, `threat-detection.ts`) ne bougent pas.
2. **Extraire `computeEffectiveAccuracy(...)`** de `checkAccuracy` (`accuracy-check.ts`) : fonction pure retournant le `%` effectif (ou `null` pour « touche à coup sûr » : `bypassAccuracy`, Verrouillage armé, ≥ 100 %). `checkAccuracy` devient `computeEffectiveAccuracy(...)` + tirage RNG — **zéro changement de comportement**, refactor à iso-résultat couvert par les tests existants. ⚠️ `consumeLockedOn` **mute** l'attaquant : la fonction pure doit *lire* le volatil `LockedOn` sans le consommer, la consommation reste dans `checkAccuracy`.
3. **Exposer `effectiveCritChance(attacker, defender, move, itemRegistry?, abilityRegistry?, state?)`** (nouveau fichier `packages/core/src/battle/crit-chance.ts`) : sort le cumul de crans + `getCritChance` de `calculateDamage` (l.158-166) et l'expose ; `calculateDamage` l'appelle à la place de son calcul inline. Renvoie `0` si `preventsCrit`, `1` si forcé.

Puis **`BattleEngine.previewMove(attackerId, moveId, defenderId, targetPosition?)`** : agrège `estimateDamage` + accuracy + crit en un seul `MovePreview` — un seul point d'entrée pour le view-core, pas trois appels dispersés.

## Étapes

- [ ] **Étape 1 — Core, précision pure.** Extraire `computeEffectiveAccuracy` d'`accuracy-check.ts` (garder `checkAccuracy` iso-comportement, `consumeLockedOn` non déplacé). Tests unitaires : crans, talents, objets, Gravité, override météo, `bypassAccuracy`, Verrouillage.
- [ ] **Étape 2 — Core, critique pure.** Créer `crit-chance.ts` + `effectiveCritChance`, brancher `calculateDamage` dessus. Tests : crans cumulés, `alwaysCrit`, `guaranteedCritArmed`, `preventsCrit`.
- [ ] **Étape 3 — Core, `DamageEstimate` enrichi.** Ajouter les 4 champs, les remplir dans `BattleEngine.estimateDamage` (valeurs déjà calculées sur place, juste propagées). Vérifier qu'aucun appelant IA ne casse.
- [ ] **Étape 4 — Core, `previewMove`.** Créer `MovePreview` interface dans `packages/core/src/types/` (ou ajouter à `damage-estimate.ts`) : agrège `DamageEstimate` + `effectiveAccuracy` + `effectiveCritChance`. Créer méthode `BattleEngine.previewMove(attackerId, moveId, defenderId, targetPosition?, attackerPosition?)` qui l'appelle et l'expose. Tests unitaires : tous les cas d'accuracy/crit (0%, 100%, forcé, impossible) + move sans dégâts (status).
- [ ] **Étape 5 — View-model.** `CombatPreviewData` interface dans `render-ports/src/view-models.ts` : structure réutilisant les patterns de `TileInfoData` (aucun type core qui fuit, tout pré-résolu). Champs : `focusIndex` (index cible en focus), `totalTargets` (nombre total de cibles, pour le compteur), `targetName`, `targetLevel`, `targetPortraitUrl`, `targetTeam`, `hpCurrent`, `hpMax`, `damageMin`, `damageMax`, `effectiveness`, `verdictLabel`, `precisionPercent` (null si bypass), `critChancePercent` (null si impossible/garanti), `critLabel?` (« Garanti »/« Impossible »), `effectSecondaryChance`, `isAlly`, `modifierChips[]` (type, facing, height, terrain, chacun avec icon URL + label + value), `effectChip?` (effect icon + name + chance %). + signature `updateCombatPreview(view: CombatPreviewData | null)` sur le port `BattleChrome` (`ports.ts`).
- [ ] **Étape 6 — Builder.** `buildCombatPreviewView(context, state, attackerId, moveId, targets, focusIndex)` dans `view-core/src/battle-views.ts` (ajouter si nécessaire). Appelle `engine.previewMove()` pour chaque cible, remplir `CombatPreviewData` avec : verdict K.O. (« Met K.O. » si `min >= currentHp`, « Peut mettre K.O. » si `max >= currentHp > min`, sinon « Laisse ~X% »), **+ garde-fou de survie à 1 PV** (Ténacité / Fermeté / Ceinture Force) suffixé au verdict **uniquement si la source est connue du joueur** — écrire le prédicat de visibilité dès maintenant, même s'il renvoie toujours `true` sans fog (cf. § « Verdict K.O. — garde-fous »), chips modificateurs (`×1.15` type, `+15%` dos, hauteur, terrain), précision `%` (ou null/label si bypass/100%), critique `%` **arrondi à l'entier** ou label (`Garanti`/`Impossible`), effet secondaire avec chance %, drapeau allié (`isAlly` == true). Tests unitaires : K.O. garanti/possible/survie, **garde-fou Ceinture Force à PV max (connu → suffixe, inconnu → verdict nu)**, **Bandeau qui ne déclenche AUCUN garde-fou**, immunité, allié, précision 0%/100%, critique garanti/impossible, **arrondi du `%` de critique**.
- [ ] **Étape 7 — Orchestrateur.** Dans `battle-orchestrator.ts` `tryPickTarget()` (l.768) : à l'entrée en `confirm_attack`, construire la liste de cibles (à partir de `previewOccupantIds()`), poser `focusIndex = 0` sur la cible principale, appeler `chrome.updateCombatPreview(...)`. Nettoyer dans `resolveAttack()` (l.848) et à l'annulation. Méthode `cycleCombatPreviewTarget(delta)` (nouvelle, privée) : recalcule et remonte le view-model via `chrome.updateCombatPreview()`, **sans** rejouer la sélection ni modifier `tryPickTarget`.
- [ ] **Étape 8 — Composant DOM.** `packages/ui-dom/src/combat-preview-panel.ts` — `createCombatPreviewPanel(config, onCycleTarget)` → `{ element, update(view), show(), hide(), destroy() }`, bête. En-tête : portrait + nom cible + chevrons `◀ ▶` + compteur `{focusIndex+1}/{totalTargets}` (chevrons et compteur masqués si `totalTargets <= 1`). **Zone tactile des chevrons ≥ 44×44 px** (padding autour du glyphe, pas le glyphe seul — standards iOS 44pt / Android 48dp, le jeu est mobile-first). Barre PV prédite : segment fantôme **plein jusqu'à `min`, dégradé jusqu'à `max`** (CSS `linear-gradient` sur la portion `min`→`max`), teinte distincte de la barre restante. Callback chevrons : appelle `onCycleTarget(+1)` ou `onCycleTarget(-1)`. + `styles/combat-preview-panel.css` (tokens `--ip-px` partagés, largeur alignée sur `tile-info-panel`).
- [ ] **Étape 9 — Swap dans le chrome.** `battle-chrome.ts` : créer `createCombatPreviewPanel()` (ligne ~92-95), ajouter à `.bc-infopanel-row`, mutuellement exclusif du `TileInfoPanel` (utiliser `element.hidden = true/false` pour les deux). Vérifier qu'aucune des deux transitions ne fait sauter la hauteur de la rangée (la hauteur est pilotée par `infoPanel.element`). Ajouter `combatPreviewPanel.update()` au cas `confirm_attack` dans `tryPickTarget()`. **Import CSS à ajouter dans `babylon-boot.ts`** (piège du plan 177 : l'app importe chaque CSS ui-dom individuellement, pas via `styles/index.css`).
- [ ] **Étape 10 — Clavier.** Câbler `Tab`/`Shift+Tab` pendant `confirm_attack` → `cycleCombatPreviewTarget(+1)` / `cycleCombatPreviewTarget(-1)`. Le focus des chevrons est géré naturellement (ils sont des `<button>` focusables). Cas single-target : le panneau existe mais le cycle est inerte (les chevrons ne s'affichent pas, cf. Étape 8). Ne doit pas casser `Escape` (annuler) ni `Espace`/`Entrée` (confirmer), déjà câblés dans `combat-screen.ts`.
- [ ] **Étape 11 — i18n.** Clés FR + EN dans `packages/app/src/i18n/locales/{fr,en}.ts` : 
  - Verdicts K.O. : `combatPreview.verdict.guaranteedKo` (« Met K.O. »), `combatPreview.verdict.possibleKo` (« Peut mettre K.O. »), `combatPreview.verdict.survives` (« Laisse ~{percent}% »)
  - Précision/Critique : `combatPreview.accuracy` (« Précision »), `combatPreview.accuracy.guaranteed` (« Touche à coup sûr »), `combatPreview.crit` (« Critique »), `combatPreview.crit.guaranteed` (« Garanti »), `combatPreview.crit.impossible` (« Impossible »)
  - Alerte allié : `combatPreview.allyTarget` (« Tir allié »), `combatPreview.allyTargetWarning` (« Allie en danger »)
  - Modificateurs : `combatPreview.modifier.type` (« Efficacité »), `combatPreview.modifier.facing` (« Dos »), `combatPreview.modifier.height` (« Hauteur »), `combatPreview.modifier.terrain` (« Terrain »)
  - Effet secondaire : `combatPreview.secondaryEffect` (« Effet »)
  - Cycle (affichage) : `combatPreview.targetCount` (« {current}/{total} »). **Noms FR officiels** pour tout move/talent/statut cité.
- [x] **Étape 12 — Doc : lever la contradiction sur le brouillard de guerre.** ✅ **Fait au cadrage (2026-07-25).** `docs/game-design.md` §2 réécrit : la règle « pas de brouillard de guerre » est restreinte au **spatial** (positions, terrain, hauteur, effets de case restent publics) ; l'information sur les Pokemon adverses (stats exactes, talent, objet, PV) devient **partielle et révélée à l'usage**, stats de base publiques en plage min–max, mise en œuvre au plan 176. **Décision #720** ajoutée à `docs/decisions.md`.
- [ ] **Étape 13 — Human-testing.** Scénarios ci-dessous. **Valider en particulier l'affordance du cycle**, la lisibilité du dégradé fantôme et la taille tactile des chevrons.
- [ ] **Étape 14 — e2e** (`test-writer`) : nouvelle section `docs/test-plan.md` + spec Playwright (K.O. garanti, garde-fou Ceinture Force, immunité, AoE multi-cibles + cycle, tir allié, réglage off).
- [ ] **Étape 15 — Cleanup** : zéro code mort, zéro `any`, lint vert.

## Scénarios de human-testing prévus

1. **K.O. garanti** — attaquant fort vs cible affaiblie : verdict « Met K.O. », barre fantôme vidée.
2. **K.O. possible** — fourchette à cheval sur les PV restants : verdict distinct du précédent.
3. **Immunité** — attaque Normal sur un Spectre : marqueur « sans effet », pas de barre fantôme.
4. **Modificateurs empilés** — attaque depuis un surplomb, dans le dos, sur terrain à bonus de type : les 3 chips + l'efficacité visibles ensemble.
5. **AoE + tir allié** — move de zone couvrant un allié : cycle entre les cibles, alerte sur l'allié.
6. **Précision dégradée** — cible avec Esquive montée : `%` effectif < précision de base du move.
7. **Réglage off** — *Prévisualisation dégâts* désactivé : ni panneau, ni labels in-world, le panneau de case reste.
8. **Garde-fou de survie** — cible à PV max tenant une Ceinture Force, coup létal : le verdict porte la mention « sauf Ceinture Force ». Vérifier ensuite avec un **Bandeau** à la place : aucune mention (survie probabiliste).

## Hors périmètre

- **Fog / plage élargie contre stats ennemies cachées** → plan 176 (`getGameState` par perspective). Décision #3 ci-dessus. ⚠️ **Le plan 176 doit inclure une passe de révision de CE panneau**, pas seulement des view-models d'InfoPanel — voir § dédié ci-dessous.
- **Tooltips type chart** (table d'efficacité dépliable) — item Lot 3 distinct ; ici on affiche seulement le multiplicateur résultant.
- **Preview de déplacement** (coût de trajet, cases atteignables) — non demandé, relève du Lot 1/tactile.
- **Dialog Status détaillée** — reste le repli du cadre 173, construit seulement si le mobile déborde.
- **Pack d'icônes définitif** — point commun avec le plan 177, émoji placeholder d'ici là.
- **Rendu in-world enrichi** (barre fantôme sur la barre PV 3D) — le label in-world actuel n'est pas touché ; l'enrichissement 3D relèverait d'un plan de rendu à part (`best-practices` requis). **Dette UX à noter** : Fire Emblem et *Into the Breach* placent la prévision **sur l'unité**, pas dans un panneau latéral ; notre joueur fera un aller-retour visuel scène ↔ panneau. Non bloquant, à garder au radar roadmap.

## Legs au plan 176 — ce panneau est un vecteur de fuite d'information

Analyse `game-designer` (2026-07-25). Le plan 175 affiche des valeurs exactes **par décision** (§ Décisions #3), mais il faut acter que **presque tout le panneau sauf les chips géométriques** est bâti sur des données que le plan 176 s'apprête à cacher — et plusieurs sont consultables **au repos**, sans même lancer l'attaque :

| Bloc | Donnée gatée au 176 | Nature de la fuite |
|------|---------------------|--------------------|
| Chip **efficacité de type** | **type exact de la cible** | La pire : révèle le type sans jamais attaquer. Contournement complet du fog par simple verrouillage de cible. |
| **Barre fantôme** + `%` des PV | `currentHp`/`maxHp` exacts | Barre exacte calculée sur une valeur censée être masquée. |
| **Verdict K.O.** | idem | Divulgation de PV exacts déguisée en texte — pire que le chiffre, il donne la conclusion. |
| **Précision effective** | crans d'Esquive, talents, objets défensifs | Le delta avec la précision de base du move laisse **déduire** un talent/objet caché. |
| **Critique « Impossible »** | talent de la cible (Coque Armure, Muscle Coque) | Révèle un talent anti-critique sans coup porté. |
| **Effet secondaire `%`** | talents défensifs modifiant la chance | Un `%` inattendu trahit un talent caché. |
| Chips **dos / hauteur / terrain** | — | **Aucun problème** : position et terrain sont publics sur le plateau 3D. |

**Question de design à trancher au lancement du 176, pas par défaut** : le panneau de preview est-il un outil **privilégié exempté de fog** (le joueur en a besoin pour décider, quitte à affaiblir la dissimulation), ou bascule-t-il en **estimations dégradées** tant que la cible n'a pas été scoutée ? Deux arbitrages valides, aucun acté dans `docs/decisions.md` à ce jour.

## Critères de complétion

- ✅ Panneau affiche **tous les éléments du tableau Périmètre** (En-tête + portrait + cible, alerte allié, barre prédite, dégâts %, verdict K.O., sans effet, précision, critique, effet secondaire, modificateurs).
- ✅ **Cycle AoE** fonctionne : chevrons cliquables/Tab, compteur `N/M` exact, saut entre cibles sans rejeu de `tryPickTarget`.
- ✅ **Gating « Prévisualisation dégâts »** : panneau OFF = absent, TileInfoPanel reste seul. ON = panneau visible, TileInfoPanel masqué (`.hidden`).
- ✅ **Aucun code mort**, lint Biome vert, zéro `any` implicite, TypeScript strict.
- ✅ **Tests** : unitaires core (4 étapes) + builder (étape 6) + e2e scénarios clés (étape 13) + human-testing validé.
- ✅ **Desktop responsive** : layout `.bc-infopanel-row` ne déborde pas, hauteur stable.
- ✅ **Noms FR officiels** : tous les moves/talents/statuts affichés en FR.

## Dépendances

**Bloquants avant ce plan** :
- Plan 174 (InfoPanel enrichi allié) — patterns view-model, builder, composant, CSS réutilisés ici.
- Plan 177 (TileInfoPanel) — architecture confirmée, patterns chips réutilisés, points icônes alignés.
- Cadre 173 (Phase 6.5) — périmètre et décisions actées.

**Débloqués après** :
- Plan 176 (affichage ennemi + fog) : peut utiliser le `previewMove` du plan 175 pour afficher des plages (avec variabilité stats ennemies).
- Lot 1 (tactile) : utilise l'orchestrateur du plan 175 pour le cycle au doigt (chevrons cliquables).

**Indépendants** :
- Autres items Lot 3 (tooltips type chart, info terrain, auras, responsive).

## Risques

- **Refactor `checkAccuracy`** (étape 1) : fonction chaude touchée par beaucoup de tests. Mitigation : extraction à iso-comportement, suite unit complète avant/après, `consumeLockedOn` explicitement non déplacé (c'est le seul effet de bord).
- **`DamageEstimate` élargi** (étape 3) : ~15 appelants IA. Mitigation : champs **ajoutés** uniquement, jamais retirés ni renommés.
- **Swap de panneaux** (étape 9) : risque de saut de hauteur de la rangée entre les deux panneaux. Mitigation : hauteur de rangée pilotée par l'InfoPanel Pokemon (déjà le cas au plan 177), les deux panneaux secondaires s'y alignent.
- **`Tab` en phase de confirmation** (étape 10) : conflit possible avec la navigation au clavier native du navigateur. À arbitrer en human-testing — repli : `A`/`E` ou `←`/`→` (⚠️ `←`/`→` sont déjà la rotation caméra).
