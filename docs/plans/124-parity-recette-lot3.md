# Plan 124 — Recette parité Babylon (lot 3) : audit 5-passes

> **Statut : `done`** — 2026-06-13
>
> Issu d'un audit de parité Phaser→Babylon en 5 passes parallèles (orchestration, sprite/anim, grille/occlusion, HUD/UI, mining tests+git). Triage **actionnable** des écarts réels restants après le lot 2.
>
> Plans liés : [`119-parity-checklist.md`](119-parity-checklist.md) (inventaire DoD exhaustif), [`119-phase5-babylon-master.md`](119-phase5-babylon-master.md).
>
> **Méthode de traitement** : top-down, un item à la fois. Pour chaque : (1) confirmer le gap sur Babylon, (2) discuter avec l'humain, (3) corriger, (4) valider, (5) suivant. Cocher au fur et à mesure.
>
> **Légende statut** : `[ ]` à traiter · `[~]` en cours · `[x]` corrigé+validé · `[–]` écarté (décision : hors-scope/assumé/backlog).

---

## 🔴 BLOQUANT

- [x] **B1 — Overlay Clonage (`substitute`)** : sprite bascule sur sprite-substitut quand posté, dégâts encaissés par le clone, retour au sprite à la brisure.
  - Phaser : `PokemonSprite.ts:518-535` (`setSubstituteOverlay`/`getEffectiveSpriteId`) + events `SubstitutePosted/Damaged/Broken` (`GameController.ts:1867-1905`).
  - Babylon : aucun handler ; `BoardView` n'a pas de swap d'atlas ; le billboard charge un seul atlas. Déclenchable en sandbox via `dummyMove=substitute` (Clonage). FR : **Clonage**.

## 🟠 MOYEN — vrais manques fonctionnels

- [–] **M1 — Pose Sommeil** *(écarté 2026-06-13)* : `Sleep` n'existe que pour **une seule direction** dans chaque atlas (variable selon le Pokemon) ; afficher la pose imposerait de verrouiller/résoudre la direction, trop tordu pour le gain. **Non traité sur Phaser non plus** (même limite SpriteLoader). Décision humaine : on oublie.
  - Phaser : `PokemonSprite.ts:368-380` (`setStatusAnimation`), câblé `GameController.ts:1364,1377,1407`.
  - Babylon : reste en `Idle` ; le billboard sait jouer Sleep (`directional-billboard.ts:46-55`) mais `BoardView` n'expose pas `setStatusAnimation` ; `syncBoard` ne pose que l'icône.
- [x] **M2 — Pose `Hurt` sur dégât simple** (flash rouge **+** anim Hurt).
  - Phaser : `PokemonSprite.ts:768-786` → `playAnimationOnce("Hurt")`.
  - Babylon : `flashDamage` ne fait que le flash émissif (`directional-billboard.ts:576-579`) ; Hurt seulement au knockback/impact (`combat-scene.ts:865,890`).
- [–] **M3 — Orientation directionnelle** *(écarté 2026-06-13)* : `directionFromTo` (quadrant grille) est camera-correct sous rotation et équivalent au quadrant écran de Phaser à caméra fixe. Porter le quadrant écran régresserait sous rotation. Décision humaine : garder le bearing grille actuel, rien à changer.
  - Phaser : `GameController.ts:563-569` (`getDirectionFromScreenPosition`), wiring `BattleScene.ts:496-498`.
  - Babylon : `updateAttackPreview` / `resolveTargetAction` utilisent `directionFromTo` cellule→cellule (`battle-orchestrator.ts:1248`). Ressenti différent. **Choix design à trancher.**
- [x] **M4 — Outline portée complète move soutien/soi** (zone autour caster quand aucun allié proche) + **bonus** : outline bleu pour effet bénéfique.
  - Phaser : `GameController.ts:896-910` (`getTilesInRange`).
  - Babylon : `enterAttackTarget` (`battle-orchestrator.ts:594-598`) n'outline que les tuiles cibles occupées. Soin allié sans cible → aucune zone visible.
- [x] **M5 — Preview CT timeline du move pendant ciblage/confirm** (réordonnancement) + refonte timeline responsive (voir journal). *Highlight/scroll CT → M6.*
  - Phaser : `GameController.ts:840-856`, `2256-2266` (`computeCtSequence(moveId)`).
  - Babylon : `refreshTimeline` (`battle-orchestrator.ts:467-473`) ignore le moveId ; `buildTimelineView` (`battle-views.ts:261`) n'a pas de param highlight/preview.
- [–] **M6 — Icône statut sur entrées Timeline + highlight/scroll** *(écarté 2026-06-13)* : icône statut sur la timeline non voulue (humain). Highlight/scroll devenu moot — l'actif est épinglé en haut + plus gros dans la refonte M5.
  - Phaser : `TurnTimeline.ts:310-315,407-433` (`createStatusIcon`), `79-85` (`scrollToHighlight`).
  - Babylon : `TimelineEntryView` (`battle-views.ts:219-230`) sans champ statut ; `turn-timeline.ts` (DOM) ne rend pas d'icône. Highlight CT marqué « deferred 4b-5 » (`turn-timeline.ts:11-12`).
- [x] **M7 — MoveCancelled** : beat/repositionnement au moment exact de l'annulation. *(accepté sur base code — repro sandbox délicate)*
  - Phaser : `GameController.ts:1171-1186`.
  - Babylon : pas de handler dans `applyEvents` ; corrigé indirectement par `syncBoard` final, sans le beat. `MoveCancelled` absent de `BOARD_EVENT_TYPES`.
- [x] **M8 — TerrainStatusApplied → icône statut** (empoisonnement marais en fin de tour). *(validé : Tortank empoisonné en finissant son tour dans un marais)*
  - Source : core `terrain-tick-handler.test.ts`, archive:153-155.
  - Babylon : pas de handler dédié ; icône mise à jour seulement au `syncBoard` de fin de batch (= bug Phaser d'origine partiellement reproduit). Pas dans `BOARD_EVENT_TYPES`.
- [x] **M9 — LethalTerrainKo** : HP bar drainée à 0 (visible) avant KO sur push terrain létal. *(validé : Draco-Queue → dummy poussé dans l'eau profonde, barre vidée puis KO)*
  - Source : archive:66-69.
  - Babylon : pas de `handleKo` ni forçage HP→0 ni ordre garanti ; KO générique via `syncBoard` qui masque l'overlay. Risque freeze/HP qui ne descend pas.
- [x] **M10 — Animation curseur** : bob vertical FFTA (2.5px, 1000ms) sur le curseur flottant au survol, au lieu du pulse alpha Phaser. *(validé)*
  - Phaser : `IsometricGrid.ts:637-644` (`CURSOR_PULSE_MIN/MAX_ALPHA`).
  - Babylon : `setCursor` (`babylon-tile-highlights.ts:279-309`) statique ; `BabylonHoverCursor` ne pulse pas non plus.

## 🟡 COSMÉTIQUE

- [x] **K1 — Ombre pas masquée au KO** : `setKnockedOut` → `shadow.setEnabled(!knockedOut)`. *(validé)*
- [x] **K2 — HP bar visible pendant le picker de direction** : `setHudVisible` (handle/BoardView) ; masqué à `enterDirection`, restauré confirm/cancel. *(validé)*
- [x] **K3 — Label « KO! » sur coup à recul létal** : float `floating-text-content.ts` → `t("battle.ko")` si `event.recoil && getCurrentHp(target)===0` (getCurrentHp ajouté au contexte). *(code OK, testable avec recul létal)*
- [x] **K4 — Timing anim Faint** : KO traité explicitement dans `applyEvents` → attend `koAnimationDurationMs` (durée réelle du Faint via `animationDurationMs("Faint")`) au lieu de 180ms fixes. *(code OK)*
- [x] **K5 — Outline tuile caster charge T1** : `showEntryPreview` charge-T1 → `setOutline([caster], true)` (contour bleu wind-up). *(code OK, testable)*
- [–] **K6 — `showVictory` n° de round** *(caduc 2026-06-13)* : l'overlay victoire DOM affiche déjà le round via `lastRound` tracké par `updateTurnInfo` (`battle-chrome.ts:235`). Pas de gap.
- [–] **K7 — Champs blend ADD→ALPHABLEND** *(gardé actuel)* : humain garde le blend normal 0.3 (zones ne se chevauchent jamais).
- [x] **K8 — Hover actif pendant l'animation** : `onTileHover` early-return si phase `animating` (parité Phaser). *(code OK)*
- [–] **K9 — Flash dégât émissif vs alpha** *(gardé actuel)* : humain garde l'émissif (choix assumé).

## 🔵 À VÉRIFIER visuellement — pas d'écart de code certain, valider en jeu

- [x] **V1 — B6** : enveloppe profondeur attaque par rayon (`maxTileDepthInRadius` Phaser `PokemonSprite.ts:549-586`) vs biais foot-depth fixe Babylon. Risque clip attaque longue portée près mur plus haut hors rayon.
- [x] **V2 — B9** : ombre reste au sol pendant état Vol semi-invulnérable (Phaser découple sprite↑/ombre↓ `PokemonSprite.ts:469-478` ; Babylon parente l'ombre au root).
- [x] **V3 — C13/C23** : sémantique hauteur déco (dessinée vs `heightUnits`) + ancrage rocher 2×2/arbre (Phaser ancre cellule avant, Babylon centre footprint).
- [x] **V4 — C14** : `hasPickingAmbiguity` orphelin — vérifier qu'aucun consommateur n'attend encore une désambiguïsation 2D côté Babylon.
- [x] **V5 — C21** : layout cross aura 1→6 (offsets exacts `getAuraHoverOffsets`) reproduit par `setAuraGroundIcons`.
- [x] **V6 — D4** : amplitude/durée wobble confusion (`CONFUSION_WOBBLE_*`) sur le billboard.
- [x] **V7 — D7** : lisibilité flèche active du picker (glow émissif vs dim) sous caméra dimétrique.
- [x] **V8 — D10** : 4 couleurs de cellule du tooltip DOM (`data-cell` CSS) = `TOOLTIP_CELL_COLOR_*`.
- [x] **V9 — E21** : **Vampigraine** (`leech-seed`) drain HP reflété sur barre + statut volatile au spawn (`syncBoard` ne montre que `statusEffects[0]`).
- [x] **V10 — E25** : preview de dégâts sur HP bar (réécrite `babylon-sprite-hud.ts`) au survol d'attaque.

---

## Journal de traitement

### Bonus — Pan caméra smooth ✅ 2026-06-13
- Retour humain : la caméra se **téléportait** au recentrage sur le Pokemon actif. Fix : `cameraTargetGoal` lerpé vers `cameraTarget` dans la boucle de rendu (`BABYLON_CAMERA_PAN_LERP`/`_EPSILON`), 1er centrage snap (pas de slide depuis l'origine). Validé live.

### M1 — Pose Sommeil ❌ écarté 2026-06-13
- `Sleep` n'existe que pour 1 direction par atlas (variable selon Pokemon) ; verrouiller la direction trop tordu pour le gain. Non traité sur Phaser non plus. Changements reverté entièrement (billboard/combat-scene/orchestrateur/board-view/test).

### M3 — Orientation directionnelle ❌ écarté 2026-06-13
- `directionFromTo` (quadrant grille) camera-correct sous rotation, équivalent au quadrant écran Phaser à caméra fixe. Porter régresserait sous rotation. Garder l'actuel.

### M4 — Outline portée soutien/soi ✅ 2026-06-13
- **Fix** : `battle-orchestrator.enterAttackTarget` — moves `targetsAlly`/`targetsAllyOrSelf` outline `getTilesInRange(caster, minRange, max)` (minRange 0 si allié-ou-soi). **Bonus humain** : flag `beneficial` threadé BoardView→`setTileOutline`→`setOutline(color)` → outline **bleu** (`TILE_PREVIEW_BUFF_COLOR`) pour bénéfique vs rouge offensif.
- **Validation** : sandbox Vœu (`wish`, allié/soi portée 1-3) sans allié — contour de portée bleu autour de Florizarre. Typecheck + tests verts.

### M5 — Preview CT timeline + refonte responsive ✅ 2026-06-13
- **Fix core** : `refreshTimeline(previewMoveId?)` → `predictCtTimeline(slots, moveId)` ; appelé avec moveId à `enterAttackTarget` (preview du réordonnancement), reset à `enterActionMenu`/`enterAttackSubmenu`.
- **Sandbox** : ajout `turnSystemKind` à SandboxConfig (le vrai jeu shippe en Charge-Time, plan 054) pour pouvoir tester le mode CT.
- **Refonte timeline (retours humains)** : (a) timeline + info panel dans une **colonne flex gauche** (`.bc-left-col`) → la timeline rétrécit pour laisser la place à l'info panel (count adaptatif + scroll), plus de débordement ; info panel passé en enfant flex (`margin-block-start:auto`) au lieu d'`absolute`. (b) barre CT **bleue** (`#44aaff`, tokens `--color-timeline-ct[-bg]`, miroir `TIMELINE_CT_BAR_COLOR`). (c) entries **alignées à gauche**. (d) **sans fond ni bordure**. (e) scrollbar masquée (molette/drag conservés).
- **Validation** : sandbox CT, preview réordonne au choix de move, responsive au resize, pas de chevauchement, CT bleu, aligné gauche, pas de fond.

### M6 — Icône statut timeline ❌ écarté 2026-06-13
- Humain : statut déjà assez lisible sur le sprite (HUD monde), pas besoin sur la timeline. Highlight/scroll moot (actif épinglé en haut + plus gros depuis refonte M5). Ajout `statusType` reverté.

### M7 — MoveCancelled ✅ 2026-06-13 (base code)
- **Fix** : `MoveCancelled` ajouté à `BOARD_EVENT_TYPES` → `syncBoard()` + beat au moment de l'annulation (clear ⚡ via refreshAuraVisuals, atterrissage semi-invuln, snap position/facing) au lieu du seul sync final. Accepté sur base code (repro 1v1 délicate : faut incapaciter un lanceur en charge avant T2).

### M8 — TerrainStatusApplied → icône statut ✅ 2026-06-13
- **Fix** : `TerrainStatusApplied` ajouté à `BOARD_EVENT_TYPES` → syncBoard met à jour l'icône statut au beat de l'event (vs sync final). Validé : Tortank empoisonné en finissant son tour dans un marais (sandbox flat tous-terrains).

### M9 — LethalTerrainKo ✅ 2026-06-13
- **Fix** : `FallDamageDealt` ajouté à la branche HP-update de `applyEvents` (avec WallImpact/TerrainDamage) → la barre se draine à 0 + flash avant le `PokemonKo` suivant (events séquentiels, pas le bug d'ordre Phaser). Validé : Draco-Queue pousse le dummy dans l'eau profonde, barre vidée puis KO.

### M10 — Animation curseur ✅ 2026-06-13
- **Fix** : `babylon-hover-cursor.ts` — bob vertical idle (oscillation Y du root, `onBeforeRenderObservable`) sur le curseur FFTA flottant, au lieu du pulse alpha Phaser (mieux adapté à un curseur flottant). Réglé après retour humain : amplitude 2.5px, période 1000ms.

### K4 — détail fix Faint 2026-06-13
- Au-delà du timing : le Faint était **figé frame 0** (le handle jouait Faint puis `setKnockedOut(true)` bloquait l'avance des frames). Refonte : `billboard.setKnockedOut` joue le Faint **une fois** sur l'edge KO ; `update()` laisse le one-shot avancer jusqu'à sa dernière frame (figé par `freezeOnComplete`), gate l'Idle d'un KO sans Faint. Handle ne joue plus Faint (évite double-play / restart par syncBoard).
- ⚠️ Sprites **sans frames Faint** (venusaur, blastoise) → aucune chute possible (manque data PMD), indépendant du fix. Validé sur dummy (a Faint).

### Tier cosmétique K ✅/– 2026-06-13
- **K1** ombre off au KO (`setKnockedOut` → `shadow.setEnabled`). **K2** HUD masqué pendant picker direction (`setHudVisible` handle/BoardView, masqué `enterDirection`, restauré confirm/cancel). **K3** label « K.O.! » sur recul létal (float `getCurrentHp` au contexte). **K4** KO attend la durée réelle du Faint (`koAnimationDurationMs`, KO sorti de BOARD_EVENT_TYPES + branche explicite). **K5** contour bleu wind-up charge T1. **K8** hover figé pendant `animating`.
- **Caduc/gardé** : K6 (round déjà affiché via `lastRound`), K7 (blend Champs gardé normal), K9 (flash émissif gardé).
- Validés live : K1, K2. Code OK testables : K3 (recul létal), K4 (KO), K5 (charge T1), K8 (hover pendant attaque).

### M2 — Pose Hurt sur dégât ✅ 2026-06-13
- **Fix** : `directional-billboard.ts` `flashDamage()` joue aussi `playOnce("Hurt")` (si pas KO + atlas porte Hurt pour la direction). Comme `applyEvents` appelle `flashDamage` à chaque `DamageDealt` (y compris chaque tic multi-coups, ligne 969), Hurt rejoue par tic, aligné avec le `-N` flottant + le step de barre.
- **Validation** : sandbox Stalactite (`icicle-spear`, multi-coups) sur dummy — Hurt à chaque tic, synchro floats + barre. Single + multi OK.

### Bonus post-recette — R1/R2/R3 ✅ 2026-06-13

- **R1 — Pan caméra bloqué après déplacement** : la caméra se téléportait en fin de tween de déplacement et écrasait le drag libre. Fix : `combat-scene.ts` — le drag manuel écrit dans `cameraTargetGoal` de sorte que le lerp d'auto-pan ne ramène plus la caméra sur le dernier Pokemon actif quand l'utilisateur a pané manuellement.
- **R2 — Pile météo chevauche le banner de tour** : `.wh-hud` (météo) et le banner "Round N — Joueur…" étaient tous deux centrés en haut, se superposant. Fix : `battle-chrome.ts` + `battle-chrome.css` — les deux éléments regroupés dans un wrapper `.bc-top` (flex-column, top-center) ; positionnement `absolute` retiré de `weather-hud.css`.
- **R3 — Bouton "Retour au menu" en combat collisionnait avec le burger BattleLog** : tous deux en top-right. Décision humaine : **supprimer** le bouton placeholder debug (plan 120) — la sortie mid-combat n'est possible que par victoire/défaite. Fix : import `t` mort + règle CSS `.mn-combat-back` retirés de `combat-screen.ts` et `menu-screens.css`.

### B1 — Overlay Clonage ✅ 2026-06-13
- **Décision** : porter maintenant (humain), design atlas hot-swap interne au billboard (vs billboard dummy séparé).
- **Fix** : `directional-billboard.ts` — atlas-dépendant encapsulé en `AtlasBundle` (texture/frames/durations/offsets) ; `loadAtlas()` réutilisable ; `setSubstitute(active)` charge le doll `dummy` (lazy) et bascule l'atlas actif via `bindActiveAtlas()`. `combat-scene.ts` — URLs substitut + handle `setSubstitute`. `battle-board-view.ts` + `battle-orchestrator.ts` (BoardView) — relais `setSubstitute`. `applyEvents` — `SubstitutePosted`→doll+updateHp, `SubstituteDamaged`→flash, `SubstituteBroken`→sprite réel. Floats déjà branchés (mapper partagé `floating-text-content.ts`).
- **Validation** : sandbox `dummyMove=substitute`, Florizarre/Charge — bascule sprite→mannequin à la pose, flash+`-N` sur le clone, retour au vrai sprite à la brisure. Typecheck + build + tests (16/16) verts.
