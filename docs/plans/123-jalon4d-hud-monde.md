# Plan 123 — Jalon 4d : HUD monde + tweens d'impact (parité combat)

> **Statut : ✅ 4d TERMINÉ + phase de recette TERMINÉE** (7 sous-paliers + 5 correctifs 3D, 2026-06-12) — parité Babylon ↔ Phaser atteinte (combat **+ Sandbox Studio**).
> Worktree `phase5-babylon`, port 5220. Iso-Phaser atteint → recette validée → J5.
> Run autonome (humain : « finis jusqu'à l'iso-Phaser »). Chaîne par sous-palier :
> bonne pratique (mirror Phaser) → code → code-review → simplify → ci-gate → commit.

## Objectif

Combler les derniers écarts de **parité combat** entre le renderer Babylon et Phaser,
hors chrome (4b) et anims de base (4c) : les éléments HUD ancrés au **monde** (barres PV
+ icônes statut par sprite) et les **tweens d'impact** (knockback/glissade glace) qui
snapaient encore. Team Builder + Team Select sont déjà réels (4a étapes 4-5).

Référence Phaser : `sprites/PokemonSprite.ts` (HP bar + status icon) et
`game/GameController.animateEvent` (Knockback/IceSlide/KnockbackBlocked).

## Sous-paliers (1 commit chacun)

### 4d-1 — Barres PV monde + icônes statut ✅ (2026-06-12)
- `babylon/babylon-sprite-overlays.ts` : gestionnaire DOM HP bar + icône statut par
  sprite dans `.ui-world`, reprojeté chaque frame via `projectAnchors` (lecture/écriture
  batch, comme les pills Champs). L'ancre tête suit le sprite qui glisse (`headPosition`
  relu par frame = `root.position` + `spriteTopOffsetY`). Fill teinté équipe, ratio PV ;
  icône statut depuis `STATUS_ASSET_KEY` (`/assets/ui/statuses/icon-*.png`).
- `combat-scene` : overlay attaché par billboard dans `createBillboard`, projeté dans la
  render loop, disposé dans `removePokemon` + dispose scène. `CombatPokemonHandle` gagne
  `updateHp`/`updateStatus` ; `setKnockedOut` masque l'overlay (parité `markKnockedOut`).
- `battle-board-view` + `battle-orchestrator` : `BoardView.updateHp`/`updateStatus`,
  poussés dans `syncBoard` (tous les Pokémon vivants) + drain live du PV cible sur
  `DamageDealt` (en phase avec le flash). `constants.teamColorByIndex` (résolveur réutilisable).
- CSS `components/sprite-overlay.css` (+ import `index.css`).
- Review : Critical corrigé (import CSS manquant → overlay non stylé), Minor corrigé
  (chemin icône statut absolu `/assets/...`).

### 4d-2 — Tweens d'impact (knockback / glissade glace) ✅ (2026-06-12)
- `combat-scene.impactGlide(entry, to, hurt)` : glisse vers une tuile unique **sans
  changer le facing** (poussé, pas marche), pose Hurt optionnelle, réutilise
  `tweenRootPosition` (leak-safe via `onDisposeObservable`). `impactShake(entry)` : pose
  Hurt + oscillation X amortie puis retour au repos (constantes `BABYLON_KNOCKBACK_SHAKE_*`).
  Ports `CombatPokemonHandle.impactGlide`/`impactShake`.
- `battle-orchestrator.applyEvents` : `KnockbackApplied`/`IceSlideApplied` → `impactGlide`
  (hurt sur knockback) + `syncBoard` ; `KnockbackBlocked` → `impactShake`. Les deux events
  retirés de `BOARD_EVENT_TYPES` (gérés explicitement, plus de snap).
- **Parité confirmée** : `Teleported` + `HitAndRunRetreat` utilisent `updatePosition`
  (snap) **aussi côté Phaser** → le snap Babylon était déjà correct, pas de changement.

### 4d-3 — Flow « confirmer l'attaque » + flash de prévisualisation ✅ (2026-06-12)
- **Découverte** : Phaser a `battleConfig.confirmAttack: true` par défaut → le flow confirm
  est **parité-requise** (pas un choix différé). `BATTLE_CONFIRM_ATTACK` passé `false → true`.
- `directional-billboard.setPreviewFlash(active)` : pulse sinus émissif soutenu (blanc↔gris
  `BABYLON_PREVIEW_FLASH_DIM_EMISSIVE` sur `BABYLON_PREVIEW_FLASH_PERIOD_MS`) marquant une cible
  verrouillée — équivalent Babylon du blink alpha Phaser. Cède au flash dégâts + KO ; restaure
  l'émissif de base à l'arrêt ; zéro alloc/frame.
- `battle-orchestrator` : champ `previewTiles` suivi dans showEntryPreview/updateAttackPreview ;
  `tryPickTarget` (branche confirm) flashe les occupants vivants du footprint (`previewOccupantIds`) ;
  `resolveAttack` + `enterAttackTarget` éteignent le flash (tous les sorties de la phase confirm
  tracées — pas de sprite bloqué clignotant). `BoardView.setPreviewFlash(ids)` diff-tracké dans l'adaptateur.
- 2 tests : verrou confirm (1er clic verrouille, 2e soumet) + Échap éteint le flash.
- **Écart assumé (parité)** : un tap sans survol préalable (tactile) ne flashe pas — même
  dépendance que Phaser (`currentPreviewTiles` issu du survol). Théorique sur desktop.

### 4d-4 — Preview dégâts numérique ✅ (2026-06-12)
- `babylon-sprite-overlays` : la barre PV gagne 2 bandes noires (`.sprite-hp-damage-possible`
  0.55 / `-guaranteed` 0.85, alphas = Phaser `DAMAGE_ESTIMATE_ALPHA_*`) assombrissant les PV
  qui seraient perdus, + un nombre centré au-dessus (`.sprite-damage-text`, gris si immunisé).
  `setDamageEstimate({min,max,label,immune}|null)` calcule les bandes depuis currentHp/maxHp
  (port de `drawDamagePreview`). Position % inline (runtime).
- `battle-orchestrator.buildDamageEstimates` : en phase confirm (setting `damagePreview` on),
  pour chaque ennemi vivant du footprint → `engine.estimateDamage(active, move, cible, targetPos)`,
  formate `min-max (+/-X%)` ou « Aucun effet ». `BoardView.setDamageEstimates` diff-tracké ;
  éteint aux mêmes sorties que le flash (resolveAttack/enterAttackTarget). Helpers purs
  `formatDamageRange`/`formatFacingSuffix`. Test : `setDamageEstimates` appelé à l'entrée confirm.

### 4d-5 — Nuance movement-animation (Hop/glide/rampe par pas) ✅ (2026-06-12)
- `babylon/load-tiled-map` expose `slopeData` (depuis `parseTiledMap`, row-major width×height).
- `combat-scene` : lookup `movementMap` {width,height,heightAt,terrainAt,isSlopeAt} capturé au
  load. `moveBillboardAlongPath` réécrit en **port de `GameController.animateAlongPath`** : par
  pas, calcule `MovementStep` {heightDiff, isRamp (pente), isFlying, terrainType} et délègue au
  module pur `game/movement-animation` (`selectMovementAnimation` Walk/Hop, `getFlyingAnimationMode`
  → glide candidates, `selectMovementDuration`, `isJumpStep` arc). Ghost garde sa hauteur au-dessus
  d'un obstacle. `applyLandingRestingAnimation` : volant atterrissant sur terrain spécial garde le glide.
- **Parité corrigée** : `PokemonDashed` ne force plus le Hop (Phaser utilise la même logique par-pas
  pour Moved ET Dashed) ; un volant plane désormais (avant : Walk plat) ; un saut de hauteur déclenche
  Hop (avant : Walk sur tout le chemin). `BoardView.moveAlongPath` options `{jump}` → `{isFlying,isGhost}`
  (calculés via `engine.getPokemonTypes`).

### 4d-6 — Wobble confusion ✅ (2026-06-12)
- **Best-practices web** (agent) : un mesh `billboardMode` ignore son propre `rotation.z` ; un enfant
  non-billboard d'un **pivot billboard** garde son roll local. Solution retenue.
- `directional-billboard` : insertion de `spritePivot` (TransformNode `BILLBOARDMODE_Y`, parent root)
  entre root et `plane` ; le plan devient enfant non-billboard et porte le wobble sur `rotation.z`
  (sinus ±5° sur `BABYLON_CONFUSION_WOBBLE_PERIOD_MS`). Silhouette X-ray laissée inchangée (risque
  divisé ; désync invisible hors confusion). `setKnockedOut` stoppe le wobble (parité). `setConfusionWobble`.
- `battle-orchestrator.syncBoard` : `setConfusionWobble` depuis `volatileStatuses` (StatusType.Confused),
  state-based comme Phaser. Port `BoardView`/handle. Code-review a tracé la source Babylon : facing/
  depth/lift/scaling/silhouette-coïncidence/hide/dispose tous préservés en jeu normal.

### 4d-7 — Sandbox Studio (parité outil dev) ✅ (2026-06-12)
- `combat-screen.mountSandboxStudio` : owns le chrome éditeur (`SandboxPanel` — déjà DOM pur, zéro Phaser)
  + le cycle game-stage/combat-scene, sans menus ni placement. Chaque changement de config tear-down +
  re-mount depuis le nouveau config (mirror `BattleScene.resetSandbox`) ; le panneau est recréé à chaque
  remount. `startSandboxBattle` gagne `onPositionsResolved` → `panel.setResolvedPositions` (X/Y résolus).
- `sandbox-boot.initSandboxStudioDom(host?)` généralisé : Phaser passe `#game-container`, Babylon passe
  `#game-root`. `sandbox-studio.css` ajoute `body[data-sandbox] #game-root` (fixed-fullscreen → flex child
  entre header et colonnes éditeur). `babylon-boot` : `sandboxBootConfig.enabled` → `mountSandboxStudio`
  (config env `?? DEFAULT_SANDBOX_CONFIG`), remplace l'ancien `mountSandboxCombat` (supprimé).

### Statut : ✅ 4d TERMINÉ — parité atteinte (combat + Sandbox Studio). Iso-Phaser → phase test/retours.

### Port DOM→moteur (phase retours — commit 9d1f731) — décision #487 appliquée

Réalisé pendant la phase de retours playtest, après la clôture du Jalon 4d.

**Modules supprimés** : `babylon-sprite-overlays.ts` (DOM `.ui-world` + `projectAnchors`). CSS supprimés : `sprite-overlay.css`, `floating-text.css`.

**Modules introduits** :
- `babylon-sprite-hud.ts` — barre PV (DynamicTexture `roundRect` NEAREST + scaling monde), icône statut (plane aspect-correct), preview dégâts (bandes canvas + nombre texte).
- `babylon-text-plane.ts` — helper DynamicTexture NEAREST partagé (texte flottant + HUD).
- `babylon-champ-pill.ts` — badge compteur Champ billboardé (remplace DOM `.field-terrain-pill`).

Texte flottant et pastille Champ portés en moteur aussi. Anchor billboardé (`BILLBOARDMODE_ALL`) parenté au sprite root.

**Tunings phase retours** : `BATTLE_TEXT_DURATION_MS` 3500 → 1000 ; `BATTLE_TEXT_QUEUE_DELAY_FACTOR = 0.5` (nouveau, `QUEUE_DELAY_MS` désormais dérivé) ; `BABYLON_FLOATING_TEXT_LIFT` 1.5 → 1.0. Centrage caméra sur milieu map. Police `PokemonEmeraldPro` sur `body` (contrôles natifs héritent).

Param `worldLayer` retiré de `combat-scene`. Best-practices Babylon (agent) : quads/DynamicTexture, pas `@babylonjs/gui` ni `linkWithMesh`.

## Gate

CI standard par sous-palier. `core-guardian` non requis (renderer only). Repasse gate
complète humaine à l'iso-Phaser.

## Phase de recette (post-iso-Phaser) — corrections terrain 3D

Correctifs identifiés lors de la recette visuelle sur le worktree `phase5-babylon`.
Tous amendés dans le commit squash Phase 5.

### Saut de falaise / chute ✅ (`combat-scene.ts`)

Easing vertical asymétrique par axe : `jumpVerticalProgress` + `BABYLON_JUMP_VERTICAL_LEAD = 0.45`. Le sprite monte dans la première moitié du pas (≤ lead) et descend dans la seconde, évitant ainsi la pénétration du flanc d'une falaise — pénétration invisible en Phaser 2D mais visible via la silhouette X-ray en 3D. `impactGlide` (knockback off-cliff) utilise le même arc. `BABYLON_MOVE_JUMP_ARC` supprimée. Décision #492.

### Hauteur curseur sur décorations ✅ (`combat-scene.ts`, `babylon-decorations.ts`)

`decorationHeightAt` expose la hauteur art rendu d'une décoration (worldHeight − `BABYLON_DECORATION_FOOT_DROP`). `surfaceHeightAt` (terrain + déco) utilisé par `tileWorldTop`, highlights et mouvement. Curseur posé sur le dessus de la déco ; volants montent au-dessus. Décision #493.

### Self/AoE confirmables n'importe où ✅ (`battle-orchestrator.ts`)

`resolveTargetAction` : les patterns statiques (Self, Cross, Zone) centrés sur le lanceur confirment sur tout clic (parité Phaser `resolveAttackAction`). Aucun changement core.

### Auras (Murs) — rendu in-engine ✅ (`babylon-sprite-hud.ts`, `babylon-aura-ground-icons.ts` NOUVEAU)

- Icônes à gauche de la barre de vie (`setLeftIndicators`), triées par tours restants.
- Icônes au sol au survol du lanceur (`babylon-aura-ground-icons.ts`) : pivot billboardé par tuile, layout croix, groupe sprite pour occlusion par les Pokemon, masquées sur tuiles occupées.
- Câblage orchestrator : `refreshAuraVisuals` (mise à jour permanente) + `showAuraHoverFor` (survol).
- Constantes : `BABYLON_HUD_AURA_*` (barre de vie) et `BABYLON_AURA_HOVER_*` (sol).
- Décision #494.

### Champs (field terrains) — dédup + pastille centrée ✅ (`babylon-field-terrains.ts`, `babylon-champ-pill.ts`)

- `refreshFieldTerrainVisuals` : dédup overlap (tuile peinte par le Champ le plus récent ; bordures recalculées ; zones non superposées).
- Pastille `babylon-champ-pill.ts` : centrage via `measureText` ; groupe sprite pour occlusion ; lift 0.6 → 0.25.
- Décision #495.

## Hors scope

- Suppression Phaser → **J5**.
