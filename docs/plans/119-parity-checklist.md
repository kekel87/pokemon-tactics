# Plan 119 (annexe) — Checklist de parité renderer (Phaser → Babylon)

> **Statut : `living document`** — 2026-06-09
>
> **Avancement : 49 / 315 items cochés** (J1 : terrain/sprites/offsets, J2b : InfoPanel base, J3a : hauteurs/caméra/occlusion/silhouette, J3b : picking + surbrillances move/attack/retreat/enemy + outline + curseur hover, J3c : curseur FFTA billboard 2D + 4 variantes H, J3d-partiel : anims looping/one-shot/resting/FlyingIdle-synthèse/glide volants/pulse/flash/KO/semi-invul, J3e-déco : rochers/arbres/tall-grass billboards + occlusion + herbe ALPHABLEND, J3e-Champs : fill+contour GreasedLine+pastille DOM fill+contour+4 types).
>
> But : inventaire exhaustif de TOUT ce que le renderer Phaser actuel fait côté utilisateur, pour servir de Definition-of-Done à la réécriture Babylon.js (Phase 5). Aucune feature ne doit être oubliée pendant la migration.
>
> Plan parent : [`119-phase5-babylon-master.md`](119-phase5-babylon-master.md).
>
> **Convention** : `- [ ]` = feature non encore portée. `(2D-iso, à repenser en 3D)` = item intrinsèquement lié à la projection isométrique 2D, à reconcevoir plutôt que copier. Fichier source entre `backticks`. Noms FR officiels pour les moves/talents.

---

## 1. Scènes & navigation

Scènes Phaser réelles (`main.ts`, dossier `scenes/`).

- [ ] Scène `LoadingScene` — boot + transition vers MainMenu (ou TeamSelect en sandbox) `scenes/LoadingScene.ts`
- [ ] Scène `MainMenuScene` — titre "POKEMON TACTICS", 5 boutons `scenes/MainMenuScene.ts`
- [ ] Scène `BattleModeScene` — sous-menu mode (Local / En ligne / Tutoriel) `scenes/BattleModeScene.ts`
- [ ] Scène `MapSelectScene` — liste de cartes + détails + footer `scenes/MapSelectScene.ts`
- [ ] Scène `MapSelectPreviewScene` — rendu live de la carte sélectionnée (sous-viewport) `scenes/MapSelectPreviewScene.ts` (2D-iso, à repenser en 3D)
- [ ] Scène `TeamSelectScene` — assignation équipes par slot joueur (DOM) `scenes/TeamSelectScene.ts`
- [ ] Scène `MyTeamsScene` — liste des équipes sauvegardées (Team Builder home, DOM) `scenes/MyTeamsScene.ts`
- [ ] Scène `TeamEditScene` — éditeur d'équipe (DOM) `scenes/TeamEditScene.ts`
- [ ] Scène `BattleScene` — orchestration combat (grille, sprites, input, caméra) `scenes/BattleScene.ts`
- [ ] Scène `BattleUIScene` — surcouche UI combat (lancée en parallèle de BattleScene) `scenes/BattleUIScene.ts`
- [ ] Scène `SettingsScene` — réglages (langue, preview dégâts, curseur) `scenes/SettingsScene.ts`
- [ ] Scène `CreditsScene` — crédits / disclaimer / attributions `scenes/CreditsScene.ts`
- [ ] Scène `MapPreviewScene` — outil de preview map dédié (route `?map=<path>`) `scenes/MapPreviewScene.ts` (2D-iso, à repenser en 3D)
- [ ] Scène `MapPreviewUIScene` — HUD du preview map (info carte/format/curseur) `scenes/MapPreviewUIScene.ts`
- [ ] Mode boot sandbox (`?VITE_SANDBOX`) : scenes restreintes `[Loading, TeamSelect, Battle, BattleUI]` `main.ts`, `sandbox-boot.ts`
- [ ] Mode boot map preview (`?map=`) : scenes `[MapPreview, MapPreviewUI]` uniquement `main.ts`
- [ ] Transition MainMenu → BattleMode → MapSelect → TeamSelect → Loading → Battle (chaîne complète)
- [ ] Transition MainMenu → MyTeams → TeamEdit (Team Builder)
- [ ] Bouton "Retour" sur chaque scène secondaire (BattleMode/MapSelect/Settings/Credits → précédent)
- [ ] BattleScene `scene.restart()` (rejouer le même combat depuis l'overlay victoire) `ui/BattleUI.ts`
- [ ] BattleScene `scene.stop()` + retour MainMenu depuis l'overlay victoire `ui/BattleUI.ts`
- [ ] Redémarrage de scène au changement de langue (MainMenu, Settings, BattleScene) `scenes/MainMenuScene.ts`, `scenes/BattleScene.ts`
- [ ] Événement custom `uiReady` (BattleUIScene → BattleScene) pour séquencer la création `scenes/BattleUIScene.ts`
- [ ] Config Phaser : `Scale.FIT` + `CENTER_BOTH`, `roundPixels`, `backgroundColor`, parent `#game-container` `main.ts`
- [ ] Chargement explicite de la police `PokemonEmeraldPro` via FontFace API avant Phaser `main.ts`

---

## 2. Rendu combat — terrain, grille, hauteurs

`grid/IsometricGrid.ts`, `grid/iso-math.ts`, `grid/DecorationsLayer.ts`, `grid/OcclusionFader.ts`. La quasi-totalité est 2D-iso → reconception 3D.

- [ ] Projection grille → écran isométrique (diamants) `grid/iso-math.ts` (2D-iso, à repenser en 3D)
- [x] Rendu des tuiles depuis tile data Tiled multi-couches d'élévation, triées par élévation `grid/IsometricGrid.ts` (2D-iso) — ✅ J1
- [ ] Décodage GID Tiled avec flip H/V par tuile `grid/IsometricGrid.ts`
- [ ] Filtre NEAREST sur tileset + textures décorations (pixel-art net) `scenes/BattleScene.ts`, `IsometricGrid.ts`
- [x] Hauteurs de tuiles (heightData) — décalage vertical par `height * TILE_ELEVATION_STEP` (2D-iso) — ✅ J3a (empilage elevationLayers)
- [ ] Pentes / rampes (slopeData, `isSlopeAt`) — affecte animation de déplacement
- [ ] Données de terrain par tuile (terrainData) — `getTileTerrain`
- [ ] Grille fallback (diamants graphiques) si tileset absent `drawFallbackGrid` `IsometricGrid.ts`
- [ ] Profondeur (depth-sort) iso : `DEPTH_POKEMON_BASE + (x+y)*MAX_ELEVATION + height` — règle centrale du tri visuel (2D-iso, à repenser en 3D)
- [x] Types de terrain visuels rendus via tuiles : herbe, eau, eau profonde, lave, magma, marais, sable, neige, obstacle, herbe-haute `core/TerrainType` — ✅ J1 (base)
- [x] Couche de décorations : objets (rochers/arbres) avec footprint WxH, anchor, heightUnits `grid/DecorationsLayer.ts` — ✅ J3e-déco (`babylon-decorations.ts` — billboards `BILLBOARDMODE_Y`, footprint centré, `BABYLON_DECORATION_FOOT_DROP`)
- [x] Placement sprite décoration au bas-centre du diamant de la cellule "avant" du footprint `DecorationsLayer.ts` — ✅ J3e-déco (centré footprint, bottom-anchor descendu vers sommet-avant de la tile)
- [x] Herbe haute (`tall-grass`) rendue comme décoration auto sur tuiles non occupées par objet `DecorationsLayer.ts` — ✅ J3e-déco (ALPHABLEND + disableDepthWrite + `BABYLON_GRASS_ALPHA_INDEX` → n'occulte rien, couvre l'ombre)
- [ ] Mode preview décorations : alpha réduit quand sélection de cible/déplacement actif `setPreviewMode` `DecorationsLayer.ts`
- [ ] Debug footprint des décorations (diamants colorés, option sandbox) `DecorationsLayer.ts`
- [ ] Hauteur de picking ≠ hauteur de rendu (on clique la base d'une déco, curseur dessiné au sommet) `rebuildPickingHeightData` `IsometricGrid.ts`
- [ ] Occlusion fade : décorations/tuiles surélevées deviennent semi-transparentes quand un Pokemon passe derrière `grid/OcclusionFader.ts` (2D-iso, à repenser en 3D — en 3D = occlusion naturelle/depth-test) — reconçu en occlusion native depth-buffer (J3a, décision #473)
- [ ] Détection overlap rect écran + comparaison de depth pour décider du fade `OcclusionFader.ts` (2D-iso) — reconçu en occlusion native depth-buffer (J3a, décision #473)
- [ ] `updateAll` chaque frame depuis `BattleScene.update()` sur les cibles Pokemon vivants `GameController.collectLiveOcclusionTargets` — reconçu en occlusion native depth-buffer (J3a, décision #473)

---

## 2bis. Rendu Champs (plan 117 sur main)

Features de rendu des Champs (zones de terrain dynamiques, plan 117) à implémenter en J3e.

- [x] Rendu zone de Champ : tiles Manhattan, contour GreasedLine couleur-Champ + fill alpha standard 0.3 (`babylon-field-terrains.ts`) — ✅ J3e-Champs (décision #483 : blend standard retenu vs additif 2D)
- [x] Pastille compteur au centre-ancre de la zone, positionnée par frame via projection DOM (`world-projection.ts`) — ✅ J3e-Champs (décision #485 : DOM projeté `.field-terrain-pill`, opacity 0.5)
- [x] 4 Champs visuellement distincts : Herbu / Électrifié / Brumeux / Psychique — ✅ J3e-Champs (couleur + couleur équipe par zone)
- [ ] Barrière Champ Psychique : feedback visuel d'impact anti-dash (mur) — **différé J4** (couplé moteur/FSM)
- [x] Multi-zones coexistantes : chaque zone son contour + sa pastille — ✅ J3e-Champs (démo 2 zones disjointes)

---

## 3. Rendu combat — curseur, surbrillances, previews

`grid/IsometricGrid.ts` (highlights), `ui/HoverCursor.ts`, `GameController.ts` (orchestration). 2D-iso pour le placement, logique de portée portable.

- [x] Curseur de tuile (diamant pulsant, stroke coloré) suit la souris `showCursor` — ✅ J3b (curseur hover quad Babylon)
- [ ] Variante curseur "alt" (couleur différente) quand ambiguïté de picking + Alt pressé `IsometricGrid.ts`, `BattleScene.ts`
- [x] Curseur de survol FFTA (billboard 2D facing caméra, flotte au-dessus de la tuile / levé à la tête si Pokemon présent) `babylon-hover-cursor.ts` — ✅ J3c (décision #479)
- [x] 4 variantes de curseur de survol cyclables touche H, persistées localStorage `HOVER_CURSOR_OPTIONS` — ✅ J3c
- [x] Surbrillance tuiles de déplacement (bleu) `HighlightKind.Move` — ✅ J3b (`babylon-tile-highlights.ts`)
- [x] Surbrillance tuiles d'attaque (rouge) `HighlightKind.Attack` — ✅ J3b
- [x] Surbrillance tuiles de retraite (Hit&Run, cyan) `HighlightKind.Retreat` — ✅ J3b
- [x] Surbrillance "portée ennemie" (orange) au survol d'un ennemi `showEnemyRange` / `clearEnemyRange` — ✅ J3b
- [x] Outline de portée (contour de zone atteignable, edges externes seulement) `highlightTilesOutline` — ✅ J3b
- [ ] Preview de cible (fill coloré buff vs attaque) qui suit le curseur `showPreview` / `clearPreview`
- [ ] Preview directionnelle (Cône/Ligne/Slash/Dash) selon angle souris vs caster `handleTileHover`
- [ ] Preview tuile d'impact "Blast" (interception, couleur dédiée) `computeBlastImpactTile`
- [ ] Preview self-cast radius (life-dew/aromatherapie : diamant Manhattan autour du caster) `getSelfRadiusEffect`
- [ ] Surbrillance zones de spawn pendant placement (couleur équipe, alpha selon active/occupé/autre) `highlightSpawnZones`
- [ ] Flash de preview sur les sprites ciblés en phase confirm (alpha yoyo) `startPreviewFlash` / `stopPreviewFlash`
- [ ] Icônes d'aura d'équipe au survol (texte emoji répartis sur les tuiles de la zone d'aura) `showTeamAuraHoverIcons` (2D-iso)
- [ ] Layout des icônes d'aura selon le nombre (1 à 6 positions) `getAuraHoverOffsets` `IsometricGrid.ts`

---

## 4. Sprites & animations Pokemon

`sprites/PokemonSprite.ts`, `sprites/SpriteLoader.ts`, `game/movement-animation.ts`. Sprites 2D PMD — en 3D, repenser en billboards ou modèles, mais TOUS les états/feedbacks doivent exister.

- [ ] Chargement atlas PMD par Pokemon (atlas.png + atlas.json + offsets.json + portrait) `SpriteLoader.preloadPokemonAssets`
- [ ] Création des animations Phaser depuis le meta atlas (par direction) `createPokemonAnimations`
- [x] 4 directions PMD mappées depuis `core/Direction` (South→SouthWest, etc.) `CORE_TO_PMD_DIRECTION` — ✅ J3d (mux 8-dir vs caméra, `directional-billboard.ts`)
- [x] Animation Idle (boucle, repos par défaut) — ✅ J3d (`LOOPING_ANIMATIONS`, `setAnimation`)
- [x] Animation Walk (boucle, déplacement à plat / rampe) — ✅ J3d (looping)
- [ ] Animation Hop (one-shot, saut entre hauteurs) `movement-animation.selectMovementAnimation`
- [ ] Animation Attack (contact) `processEvent MoveStarted`
- [ ] Animation Shoot (moves à distance, catégorie `AnimationCategory.Shoot`)
- [ ] Animation Charge (moves de charge, catégorie `AnimationCategory.Charge`)
- [ ] Animation Hurt (one-shot, dégâts subis) `flashDamage`, knockback
- [x] Animation Faint (one-shot, KO) + reste figé assombri `playFaintAndStay` — ✅ J3d (`playOnce` → freeze pour Faint/KO, `setKnockedOut`)
- [x] Animation Sleep (sommeil) `setStatusAnimation` — ✅ J3d (`LOOPING_ANIMATIONS` Sleep, looping)
- [x] Animation glide volants : `FlyingIdle` synthétique (frames 0-1 de FlapAround), fallback `Hover`/`Special10`/`Walk` `FLYING_GLIDE_ANIMATION_CANDIDATES` — ✅ J3d (`synthesizeFlyingIdle`, `FLYING_GLIDE_CANDIDATES`, `playFirstAvailable`, décision #480)
- [x] Fallback animation volant = **Walk** (pas Hop) pour Pokemon sans anim — ✅ J3d (décision #480 tranche Walk ; annule feedback playtest 2026-04 "Hop")
- [x] Resting animation contextuelle : glide si Pokemon volant sur terrain spécial, sinon Idle `setRestingAnimation`, `applyLandingRestingAnimation` — ✅ J3d (`setRestingAnimation`)
- [x] Ne jamais réinitialiser une anim looping de même clé (évite reset Walk frame 0 par tile) `playAnimation` — ✅ J3d (`setAnimation` : pas de reset sur même clé)
- [ ] Cercle de couleur fallback (par type) si pas d'atlas `drawCircle` `PokemonSprite.ts`
- [x] Ombre portée (ellipse semi-transparente sous le sprite, suit footOffset) `drawShadow` — ✅ J1/J3a
- [x] Offsets sprite (footOffsetY / headOffsetY) depuis offsets.json `getSpriteOffsets` — ✅ J1
- [x] Scale sprite + filtre NEAREST `PokemonSprite` constructeur — ✅ J1
- [x] Billboard directionnel : sprite face caméra + mux direction par azimut caméra (8 directions PMD→4 directions jouables) — ✅ J1
- [x] Silhouette X-ray des Pokémon occultés (2e plane couleur équipe, depthFunction GREATER) — ✅ J3a (décision #474)
- [ ] Barre de HP au-dessus du sprite (couleur équipe, bordure, fond) `drawHpBar` — (J4 : HUD DOM world-space)
- [ ] Masquage barre de HP pendant sélection de direction `setHpBarVisible` — (J4)
- [x] Pulse du sprite actif (respiration emissive) `startPulse` / `setActive` — ✅ J3d (`setActive`, période `BABYLON_PULSE_PERIOD_MS = 900`)
- [ ] Wobble de confusion (angle yoyo) `setConfusionWobble` — **différé** : conflit billboard Y-lock (pass 3D-depth dédié)
- [ ] Indicateur de charge (⚡) sur Pokemon en train de charger `setChargingIndicator` — (J4)
- [ ] Pile d'indicateurs gauche (auras 🛡️✨🌫️🕊️ + charge), layout en slots, compteur de tours `setLeftIndicators` / `relayoutIndicators` — (J4)
- [ ] Icône de statut (brûlé/gelé/paralysé/empoisonné/gravement empoisonné/endormi) au-dessus du sprite `updateStatus`, `STATUS_ASSET_KEY` — (J4)
- [ ] Overlay Substitut (`SUBSTITUTE_SPRITE_ID = dummy`) — remplace le sprite par celui du substitut `setSubstituteOverlay` — **différé** (pass 3D-depth dédié)
- [x] États semi-invulnérables : Vol (sprite levé `BABYLON_SEMI_INVULNERABLE_LIFT = 1.5` tiles + glide / Creuse = caché mais ombre gardée) `setSemiInvulnerable` — ✅ J3d (`setSemiInvulnerable`, `SemiInvulnerableDisplay`, décision #481)
- [x] Flash de dégâts (clignotement emissive gris `BABYLON_DAMAGE_FLASH_DIM_EMISSIVE = 0.25`) `flashDamage` — ✅ J3d
- [x] Teinte KO (assombrissement) + freeze sprite au faint `darkenSprite` — ✅ J3d (`setKnockedOut`)
- [ ] Envelope de profondeur d'attaque (sprite passe au-dessus des tuiles hautes voisines le temps de l'anim) `playAttackAnimation`, `maxTileDepthInRadius` — **différé** (pass 3D-depth dédié)

---

## 5. Animations de déplacement & impacts

`PokemonSprite.animateMoveTo`, `GameController` (tweens d'événements), `game/movement-animation.ts`.

- [ ] Déplacement le long d'un chemin tuile par tuile, direction recalculée à chaque pas `animateAlongPath`
- [ ] Tween linéaire pour déplacement plat / traversée de rampe `animateMoveTo` (non-jump)
- [ ] Tween de saut (Hop) avec easing par axe (montée rapide / descente tardive) `animateMoveTo` (isJump)
- [ ] Durées différenciées : marche sol, vol (plus lent), saut (plus long) `selectMovementDuration`
- [ ] Détection jump vs walk (delta hauteur ≠ 0 et pas de rampe) `isJumpStep`
- [ ] Mode glide volant : continue FlyingIdle sans interrompre le battement d'ailes `getFlyingAnimationMode`
- [ ] Fantômes (Ghost) traversent les obstacles à hauteur constante `animateAlongPath`
- [ ] Knockback : tween vers tuile cible + anim Hurt, depth recalculé à l'arrivée `KnockbackApplied`
- [ ] Knockback bloqué : shake horizontal (yoyo, repeat) + anim Hurt `KnockbackBlocked`
- [ ] Glissade sur glace : tween linéaire vers tuile finale `IceSlideApplied`
- [ ] Téléportation : repositionnement instantané + reset semi-invul `Teleported`
- [ ] Retraite Hit&Run : repositionnement + resting anim `HitAndRunRetreat`
- [ ] Dash : déplacement le long du chemin (`PokemonDashed`)
- [ ] Annulation de move : reset position/direction/statut/semi-invul `MoveCancelled`

---

## 6. Textes flottants de combat (BattleText)

`ui/BattleText.ts`, orchestré par `GameController.processEvent`. Chaque libellé est une couleur dédiée (`constants.ts`).

- [ ] Texte flottant générique : drift vertical + fade-out `showBattleText`
- [ ] File d'attente par cible (`acquireSpawnDelay`) — beats séquencés, multi-hit empilés `BattleText.ts`
- [ ] Délai explicite partagé (dégâts + label d'efficacité sur le même beat, stagger Y)
- [ ] Reset de l'état de stagger en début de combat `resetStaggerState`
- [ ] Dégâts `-N` (couleur damage)
- [ ] Soin `+N` (couleur heal) — DamageDealt négatif, HpRestored, WishHealed
- [ ] "Immunisé" (effectiveness 0) `BATTLE_TEXT_COLOR_IMMUNE`
- [ ] "KO" (recul létal) `BATTLE_TEXT_COLOR_KO`
- [ ] Efficacité : Extrêmement efficace / Super efficace / Pas très efficace / Vraiment inefficace (4 seuils, couleurs)
- [ ] "Raté" (MoveMissed) `BATTLE_TEXT_COLOR_MISS`
- [ ] "Critique" (CriticalHit)
- [ ] Stat ↑/↓ avec nom de stat abrégé + nombre de niveaux (StatChanged) couleurs buff/debuff
- [ ] "Confus" (ConfusionTriggered)
- [ ] "Séduit" (InfatuationTriggered)
- [ ] "Apeuré" / Flinch (Flinched)
- [ ] "Bloqué" (DefenseTriggered + blocked)
- [ ] "× N coups" (MultiHitComplete)
- [ ] "Rechargement" (RechargeStarted)
- [ ] Dégâts de chute "Chute -N" (FallDamageDealt) couleur fall
- [ ] Dégâts d'impact mur "Impact -N" (WallImpactDealt)
- [ ] Dégâts de terrain "Terrain -N" (TerrainDamageDealt)
- [ ] Dégâts météo (WeatherDamage)
- [ ] KO terrain létal : "Fondu" (lave) / "Noyé" (eau) (LethalTerrainKo)
- [ ] Nom de talent activé (AbilityActivated) couleur ability
- [ ] Nom d'objet activé (HeldItemActivated) / "objet consommé" (HeldItemConsumed)
- [ ] Label de charge flottant (ex: "Rayon Solaire") (MoveCharging) `getChargingFloatLabel`
- [ ] Statut immunisé / météo empêche le gel (StatusImmune)
- [ ] Aura posée (Reflet / Mur Lumière / Brume / Rune Protect) (AuraPosted) `AURA_POSTED_KEY`
- [ ] Aura cassée (AuraBroken) + flash
- [ ] Stat/statut bloqué par aura (Brume/Rune Protect/Substitut) (StatChangeBlocked/StatusBlocked) `AURA_BLOCKED_KEY`
- [ ] Substitut posé/endommagé/cassé/échoué (Substitute*) avec nom du Pokemon
- [ ] Provoc bloque (TauntBlocked), Entrave (MoveDisabled), Encore (MoveEncored)
- [ ] Entrave/Encore bloqué/échoué (DisableBlocked/EncoreBlocked/DisableFailed/EncoreFailed)

---

## 7. UI combat — ActionMenu & sous-menus

`ui/ActionMenu.ts`, orchestré par `GameController`.

- [ ] Menu d'action principal : Déplacer / Attaquer / Objet (désactivé) / Attendre / Statut (désactivé) `ActionMenu.show`
- [ ] Entrée "Annuler déplacement" remplace "Déplacer" quand un undo est possible `canUndoMove`
- [ ] Désactivation visuelle (alpha) des entrées indisponibles `ACTION_MENU_DISABLED_ALPHA`
- [ ] Hover background sur entrées actives `pointerover`/`pointerout`
- [ ] Sous-menu d'attaque : liste des moves avec icône de type, nom, PP (sauf CT) `showAttackSubmenu`
- [ ] Crop du nom de move si trop long `createMoveItem`
- [ ] Move désactivé si PP=0 ou pas de cible (`hasTargets`)
- [ ] Tags de blocage move : Provoc / Entrave / Encore (tooltip explicatif) `resolveBlockedTagKey`
- [ ] Masquage des PP en mode Charge-Time (TurnSystemKind.ChargeTime)
- [ ] En-tête "Sélectionner cible" + move sélectionné affiché (icône type + nom + PP) `showSelectedMove`
- [ ] Mise à jour de l'instruction (ex: "Confirmer l'attaque") `updateInstruction`
- [ ] Entrée "Annuler" (retour sous-menu) `onCancel`

---

## 8. UI combat — MoveTooltip

`ui/MoveTooltip.ts`, `ui/pattern-preview.ts`.

- [ ] Tooltip move au survol : icône catégorie (physique/spécial/statut) `CATEGORY_TEXTURE`
- [ ] Puissance + précision (avec "—" si nul)
- [ ] Nom du pattern de ciblage + portée (Single/Self/Line/Cone/Slash/Cross/Zone/Dash/Blast/Teleport/Hit&Run) `PATTERN_TRANSLATION_KEYS`
- [ ] Grille de prévisualisation du pattern (cellules Target/Dash/Caster/Empty colorées) `drawPatternGrid`, `buildPatternPreview`
- [ ] Tag charge 2 tours (+ variante "soleil saute la charge")
- [ ] Tags spéciaux : puissance dynamique, source de stat (défense/attaque cible), frappe la défense physique, super vs eau, coups escaladants, crash si raté, soin sur la durée, Vœu, soigne statut d'équipe, soin par stat cible, requiert cible endormie
- [ ] Tags flags : sonore (sound), ignore substitut (bypasssub)
- [ ] Tag de blocage (Provoc/Entrave/Encore) coloré
- [ ] Positionnement adaptatif du tooltip (au-dessus du menu, clamp en bas)

---

## 9. UI combat — InfoPanel

`ui/InfoPanel.ts`.

- [x] Panneau info Pokemon (fond couleur équipe, bordure) `drawBackground` — ✅ J2b (démonstrateur)
- [x] Portrait du Pokemon `updatePortrait` — ✅ J2b (démonstrateur)
- [x] Nom + niveau + symbole de genre (♂ bleu / ♀ rose) `updateGenderText` — ✅ J2b (démonstrateur)
- [x] Barre de HP (couleur équipe) + texte HP courant/max `drawHpBar` — ✅ J2b (démonstrateur)
- [ ] Label de statut (image) à droite de la barre HP `updateStatusLabel`
- [x] Badges de stat stages (Atk/Def/SpA/SpD/Spe/Acc/Eva, +N/-N, couleur buff/debuff) `updateBadges` — ✅ J2b (démonstrateur)
- [ ] Badges volatils : Provoc/Entrave/Encore (avec tours restants) `addBadge`
- [ ] Badges volatils : Confus, Séméçon, Piégé, Séduit, Intimidé, Verrouillage, Chargé, Racines, Anneau Hydro `VOLATILE_LABELS`
- [ ] Badge "charge en cours" avec nom du move `pokemon.chargingMove`
- [ ] Badge Substitut (HP du substitut)
- [ ] Badge Vœu en attente (`pendingWish`)
- [ ] Badges d'aura : caster (Reflet/Mur Lumière/Brume/Rune Protect + tours) et protégé `addAuraBadges`
- [ ] Update au survol d'un Pokemon (ennemi inclus), retour à l'actif sinon `BattleScene.handleTileHover`

---

## 10. UI combat — TurnTimeline (timeline CT prédictive)

`ui/TurnTimeline.ts`.

- [ ] Timeline verticale d'ordre de tour `TurnTimeline`
- [ ] Mode Round-Robin : actif + restants + séparateur de round suivant (alpha réduit pour déjà-joués) `updateRoundRobin`
- [ ] Mode Charge-Time : séquence prédictive (`predictCtTimeline`) avec barres de CT `updateCt` (2D mais portable)
- [ ] Entrée active agrandie (taille + bordure dédiée)
- [ ] Bordure colorée par équipe sur chaque entrée
- [ ] Portrait Pokemon dans chaque entrée (fallback couleur de type si absent)
- [ ] Barre de jauge CT (remplissage proportionnel à CT_THRESHOLD) `renderEntry`
- [ ] Icône de statut sur l'entrée
- [ ] Highlight d'une entrée (prévisualisation du move sélectionné, bordure jaune) `isHighlighted`
- [ ] Entrée "tail" (...) si le Pokemon highlighté sort de la fenêtre visible `renderTailEntry`
- [ ] Scroll molette sur la zone timeline `setupScrollZone`
- [ ] Scroll auto vers le highlight (`scrollToHighlight`) + reset (`resetScroll`)
- [ ] Recalcul de la séquence CT lors de la sélection d'un move (preview de l'impact sur l'ordre) `GameController.enterConfirmAttack`

---

## 11. UI combat — BattleLog

`ui/BattleLogPanel.ts`, `ui/BattleLogFormatter.ts`.

- [ ] Panneau journal de combat (coin haut-droit), collapsable (burger ☰) `BattleLogPanel`
- [ ] Vue repliée (icône compacte) vs dépliée (liste + barre replay)
- [ ] Lignes de log avec word-wrap + couleur par type d'événement
- [ ] Pastille de couleur d'équipe en début de ligne `getTeamColor`
- [ ] Clic sur une ligne → pan caméra vers le Pokemon concerné `onPokemonClick` / `setupBattleLogClickHandler`
- [ ] Scroll molette dans le corps du log `setupScrollInput`
- [ ] Auto-scroll vers le bas à chaque nouvelle entrée `scrollToBottom`
- [ ] Limite d'entrées (FIFO) `BATTLE_LOG_MAX_ENTRIES`
- [ ] Barre de boutons replay (|◁ ◁◁ ▷ ▷▷ ▷|) — actuellement désactivés/placeholder `REPLAY_BUTTON_LABELS`
- [ ] Formatage de chaque type d'événement core → message FR (contexte noms Pokemon/move/talent/objet) `BattleLogFormatter.ts`

---

## 12. UI combat — autres HUD

- [ ] BattleUI : texte d'info de tour (Round N — Joueur — Pokemon) en haut `ui/BattleUI.ts`
- [ ] WeatherHud : icône + label + tours restants (Soleil/Pluie/Tempête de Sable/Neige) `ui/WeatherHud.ts`, masqué si pas de météo
- [ ] Overlay de victoire DOM : texte gagnant + boutons Rejouer / Retour menu `ui/BattleUI.showVictory`
- [ ] LanguageToggle flottant (bouton FR/EN) en combat → restart scène `ui/LanguageToggle.ts`
- [ ] PlacementRosterPanel : barre haute pendant le placement (instruction joueur + portraits cliquables + check placés + bouton Terminer) `ui/PlacementRosterPanel.ts`

---

## 13. UI combat — DirectionPicker & prévisualisation dégâts

- [ ] DirectionPicker : 4 flèches (anim arrows) autour du Pokemon, sélection par angle souris `ui/DirectionPicker.ts` (2D-iso pour le placement)
- [ ] Preview de direction en live (sprite tourne) `onPreview`
- [ ] Confirmation au clic / annulation à Échap `onConfirm` / `onCancel`
- [ ] DirectionPicker utilisé en fin de tour (orientation finale) ET en placement (orientation initiale)
- [ ] Preview de dégâts (réglage activable) : overlay sur la barre HP de la cible (zone garantie vs possible) `PokemonSprite.showDamageEstimate`
- [ ] Texte de dégâts estimés (range min-max + modificateur de face en %) `showDamageText`
- [ ] "Immunisé" si effectiveness 0 dans le preview
- [ ] Estimation via `engine.estimateDamage`, déclenchée en phase confirm `GameController.showDamageEstimates`

---

## 14. Caméra & input

`scenes/BattleScene.ts`, `scenes/camera-bounds.ts`.

- [x] Zoom 3 niveaux (overview / medium / close) molette + touches +/-/numpad `ZOOM_LEVELS`, `changeZoom` — ✅ J3a (zoom continu)
- [ ] Tween de zoom (Sine.easeInOut) `changeZoom`
- [x] Pan caméra flèches directionnelles (vitesse inversement proportionnelle au zoom) `BattleScene.update` — ✅ J3a
- [x] Rotation caméra par snaps 90° (touches ←/→) + recentrage caméra — ✅ J3a
- [ ] Bornes de caméra calculées selon taille grille + élévation max `computeCameraBounds` (2D-iso)
- [ ] Suivi/recentrage sur Pokemon actif (touche C + auto à chaque tour) `recenterOnActivePokemon`
- [ ] Pan auto vers l'actif au refresh UI (Sine.easeInOut, 400ms) `GameController.refreshUI`
- [ ] Pan vers Pokemon au clic sur log `setupBattleLogClickHandler`
- [x] Picking multi-niveaux : ray-cast 3D, surface frontale visible → coordonnée grille via `metadata.tile`, "colonne la plus haute gagne" gratuit — ✅ J3b (`babylon-picking.ts`, décision #477)
- [x] Désambiguïsation Alt : **non portée** — en 3D, rotation caméra (J3a) révèle les cellules cachées (décision #477). `preferLower`/`hasPickingAmbiguity` 2D-iso inutiles. — ✅ J3b (reconception)
- [x] Détection touche Alt : **non portée** — rotation caméra remplace (décision #477). — ✅ J3b (reconception)
- [x] Clic tuile → `onTileClick` callback (`combat-scene.ts`), distinct du pan via seuil drag `BABYLON_PICK_DRAG_THRESHOLD_PX` — ✅ J3b
- [x] Hover tuile → `onTileHover` + curseur highlight — ✅ J3b
- [ ] Touche Échap : annulation contextuelle (retraite→cible→sous-menu→menu→undo placement) `handleEscapeKey`
- [ ] Touche Espace : terminer le tour (depuis le menu d'action) `handleSpaceKey`
- [ ] Undo de déplacement (action `UndoMove`) `handleUndoMove`
- [ ] Blocage des inputs pendant les animations (`isAnimating`) `handleTileClick`, pointermove

---

## 15. Phases de combat & orchestration

`game/GameController.ts`, `game/BattleSetup.ts`, `game/SandboxSetup.ts`, `game/AnimationQueue.ts`, `game/AiTeamController.ts`, `game/DummyAiController.ts`.

- [ ] Phase de placement alternée (joueur place ses Pokemon un par un avec direction) `startPlacement` / `enterPlacement`
- [ ] Placement aléatoire/auto (option autoPlacement ou tous-IA) `autoPlaceAll`
- [ ] Sprites temporaires pendant le placement `placementSprites`
- [ ] Bouton "Terminer" placement quand minimum atteint `canFinishPlayer`
- [ ] Undo de placement (Échap retire le dernier) `undoLastPlacement`
- [ ] Transition placement → combat (création sprites depuis state) `transitionToBattle`
- [ ] File d'animation séquentielle des événements `AnimationQueue`, `processEvents`
- [ ] Machine à états d'input (placement / action_menu / select_move / attack_submenu / select_target / confirm / retreat / direction / animating / battle_over) `InputState`
- [ ] IA d'équipe (profil EASY, PRNG seedé) qui joue son tour `AiTeamController`
- [ ] IA dummy sandbox (move/direction fixés) `DummyAiController`
- [ ] `onTurnReady` : délègue le tour à l'IA, séquence les events, ou ouvre le menu joueur `refreshUI`
- [ ] Événements de démarrage de combat (météo initiale, talents d'entrée) `processStartupEvents`
- [ ] Fin de combat : état battle_over + overlay victoire `BattleEnded`
- [ ] Système de tour Round-Robin ET Charge-Time `TurnSystemKind` (choisi en TeamSelect)
- [ ] Rafraîchissement des auras visuelles (indicateurs gauche) après déplacement/fin de tour `refreshAuraVisuals`
- [ ] Hover d'aura d'équipe (icônes sur tuiles) au survol du caster `showAuraHoverFor` / `hideAuraHover`

---

## 16. Team Builder (DOM — `MyTeamsScene`, `TeamEditScene`, `ui/team/`)

Entièrement DOM, peu lié au moteur de rendu — mais à conserver tel quel ou réintégrer.

- [ ] Liste des équipes sauvegardées (cartes), tri par date `MyTeamsScene`, `ui/team/TeamCard.ts`
- [ ] État vide (message d'invite) `renderTeams`
- [ ] Nouvelle équipe / Générer aléatoire `createNewTeam` / `generateRandom`
- [ ] Éditer / Supprimer (modal confirmation) / Exporter une équipe `ui/team/DeleteConfirmModal.ts`
- [ ] Persistance localStorage des équipes `team/team-storage.ts`
- [ ] Éditeur : nom éditable, compteur de slots, indicateur "sauvegardé" (debounce) `TeamEditScene`
- [ ] Rangée de 6 slots cliquables (ouvre picker Pokemon) + clear par slot `ui/team/SlotCardsRow.ts`
- [ ] Picker Pokemon (modal, recherche, exclusion des déjà choisis) `ui/team/PokemonPickerModal.ts`
- [ ] Panneau gauche : portrait, nom, genre (toggle ♂/♀), types, niveau `ui/team/EditLeftPanel.ts`
- [ ] Sélection de talent (radio, talents non implémentés grisés + tooltip) `renderAbilitySection`
- [ ] Sélection d'objet (modal picker) `ui/team/ItemPickerModal.ts`
- [ ] Sélection de nature (25 natures, select) `renderNatureSection`
- [ ] Liste des 4 moves (picker par slot) `ui/dom/MovesList.ts`, `ui/team/MovePickerModal.ts`
- [ ] "Set OP" : application de sets prédéfinis (dropdown) `getOpSetsByPokemonId`
- [ ] Panneau droite : répartition de stats (statSpread), combat stats calculées, presets `ui/team/EditRightPanel.ts`
- [ ] Presets de stats (sweeper phys/spé, tank phys/spé, reset) `PRESETS`
- [ ] Import/Export format Showdown `ui/team/ShowdownIoModal.ts`
- [ ] Génération d'équipe aléatoire `team/team-generator.ts`

---

## 17. Team Select (DOM — `TeamSelectScene`, `ui/team-select/`)

- [ ] Header : retour, titre + nom de carte, sélecteur de format `ui/team-select/FormatPicker.ts`
- [ ] Colonnes de joueurs (1 ou 2 colonnes si >6 slots) `ui/team-select/PlayersColumn.ts`
- [ ] Cellule joueur : label, pastille couleur, toggle Humain/IA, nom d'équipe assignée, état actif `ui/team-select/PlayerCell.ts`
- [ ] Liste centrale des équipes sauvegardées + entrée "aléatoire", badges des joueurs assignés `ui/team-select/TeamList.ts`, `TeamListItem.ts`
- [ ] Footer : toggle placement auto, sélecteur système de tour (CT/RR), bouton "Rafraîchir IA", bouton "Lancer" `TeamSelectScene.buildFooter`
- [ ] IA reçoit une équipe aléatoire éphémère par défaut `generateRandomTeam`
- [ ] Mémorisation de la dernière sélection humaine (localStorage) `team/last-selection.ts`
- [ ] Validation "lançable" (tous les slots ont une équipe) `isLaunchable`
- [ ] Préchargement des sprites engagés avant le combat `extractEngagedPokemonIds`, `buildEngagedSpritesQueue`

---

## 18. Sandbox Studio (`ui/SandboxPanel.ts`, `sandbox-boot.ts`)

- [ ] Boot sandbox via `?VITE_SANDBOX` / `VITE_SANDBOX_CONFIG` JSON `sandbox-boot.ts`
- [ ] DOM studio : header, colonnes joueur/dummy, bande de combat `initSandboxStudioDom`
- [ ] Panneau joueur : Pokemon (picker), talent, objet, HP%, statut, statut volatil, stat stages, position X/Y, direction, 4 moves `buildPlayerPanel`
- [ ] Panneau dummy : idem + contrôle IA/joueur, move défensif passif, auto-fill moves `buildDummyPanel`
- [ ] Bande de combat : sélection de map sandbox (9 maps), météo (+ tours), debug footprint, reset, export/import JSON `buildBattleStrip`
- [ ] Export config → presse-papier JSON / import depuis presse-papier `copyJson` / `importJson`
- [ ] Reset sandbox sans rechargement (re-init grille/sprites en place) `BattleScene.resetSandbox`
- [ ] Chargement à la volée des assets Pokemon manquants `ensurePokemonAssetsLoaded`
- [ ] Positions résolues réinjectées dans le panneau après création `setResolvedPositions`
- [ ] Overlay Substitut affiché si dummy/joueur a un substitut au spawn `BattleScene`

---

## 19. Loading, FOUC, i18n, settings, analytics

- [ ] LoadingScene générique : queue d'assets paramétrable + scène suivante `scenes/LoadingScene.ts`
- [ ] LoadingOverlay : fond, label, barre de progression, compteur fichiers, tips rotatifs `ui/LoadingOverlay.ts`
- [ ] Tips de chargement aléatoires (sans répétition immédiate) `i18n/loading-tips.ts`
- [ ] Attente `document.fonts.ready` avant transition (évite FOUC police) `LoadingScene.create`
- [ ] Fade-out de l'overlay de chargement `fadeOut`
- [ ] Préchargement assets UI partagés (boot initial) `scenes/preload-shared.ts`, `preload-pokemon.ts`
- [ ] i18n FR/EN : `t()`, `getLanguage`, `setLanguage`, persistance, abonnement `onLanguageChange` `i18n/index.ts`
- [ ] Locales FR & EN complètes `i18n/locales/fr.ts`, `en.ts`
- [ ] Settings persistés : langue, preview de dégâts on/off, curseur de survol `settings/index.ts`
- [ ] Analytics GoatCounter via pixel beacon (itch/ghp), no-op en dev `analytics/analytics.ts`
- [ ] Events trackés : game-loaded, main-menu, battle-mode, team-builder, map-select, battle-start, battle-end

---

## 20. Edge-cases & détails faciles à oublier

- [ ] Pokemon sans atlas → cercle de couleur de type (et tout le pipeline doit rester fonctionnel)
- [ ] Pokemon sans portrait → fallback couleur de type dans Timeline & PlacementRoster
- [ ] Animation Faint absente → freeze sur première frame Idle + assombrissement (pas bloqué sur Hurt) `playFaintAndStay`
- [ ] Garde `isKnockedOut` : bloque tout changement d'anim/direction/wobble après KO `PokemonSprite`
- [ ] Multi-hit : beats de dégâts empilés via la file de spawn par cible
- [ ] Dégâts absorbés par substitut → pas de flash sur le sprite réel, juste update info panel `DamageDealt absorbedBySubstitute`
- [ ] Recul létal (`recoil` + HP 0) → "KO" au lieu du nombre de dégâts
- [ ] Pokemon volant spawn sur terrain spécial → resting glide dès le départ `BattleScene` (eau/lave/obstacle/etc.)
- [ ] Self-cast vs ciblage (move targetsAllyOrSelf sur sa propre tuile) `handleTileHover isSelfCast`
- [ ] Charge T1 (move 2 tours) : preview = caster lui-même, pas de ciblage `isChargeT1`
- [ ] Soleil saute la charge (Rayon Solaire sous soleil) → pas de phase de charge `isChargeT1 sunSkipsCharge`
- [ ] Moves alliés/self : outline de toute la portée (sinon zone vide si pas d'allié) `enterAttackTarget`
- [ ] Hit&Run : phase de sélection de tuile de retraite après confirmation `enterRetreatSelection`, fallback si aucune tuile
- [ ] Curseur dessiné au sommet d'une déco mais picking à la base `showCursor` vs `screenToGrid`
- [ ] Profondeur recalculée à l'arrivée pour knockback/glissade/saut (sinon Pokemon sous le terrain)
- [ ] Mode preview décorations désactive temporairement le fader d'occlusion (sinon écrasé) `setPreviewMode`
- [ ] Pulse du sprite actif réinitialisé proprement (scale 1) au stop `stopPulse`
- [ ] DirectionPicker enregistre/retire ses propres listeners pointer/clavier (pas de fuite) `DirectionPicker.hide`
- [ ] BattleScene `update()` met à jour l'occlusion CHAQUE frame (pas seulement sur event)
- [ ] Map preview : fade-out instant + fade-in à chaque changement de sélection (évite flash noir) `MapSelectPreviewScene.loadMap`
- [ ] Filtre NEAREST réappliqué après chaque chargement de tileset/décorations dans chaque scène concernée
- [ ] Police canvas chargée explicitement (FontFace) car le canvas ne déclenche pas le CSS font-loading `main.ts`

---

## Récapitulatif (compte d'items)

| Section | Items |
|---------|-------|
| 1. Scènes & navigation | 24 |
| 2. Rendu combat — terrain/grille/hauteurs | 20 |
| 2bis. Rendu Champs | 5 |
| 3. Rendu combat — curseur/surbrillances/previews | 16 |
| 4. Sprites & animations Pokemon | 32 |
| 5. Animations déplacement & impacts | 13 |
| 6. Textes flottants de combat | 30 |
| 7. UI combat — ActionMenu | 12 |
| 8. UI combat — MoveTooltip | 8 |
| 9. UI combat — InfoPanel | 11 |
| 10. UI combat — TurnTimeline | 12 |
| 11. UI combat — BattleLog | 10 |
| 12. UI combat — autres HUD | 5 |
| 13. UI combat — DirectionPicker & preview dégâts | 8 |
| 14. Caméra & input | 18 |
| 15. Phases de combat & orchestration | 18 |
| 16. Team Builder | 19 |
| 17. Team Select | 9 |
| 18. Sandbox Studio | 9 |
| 19. Loading/FOUC/i18n/settings/analytics | 12 |
| 20. Edge-cases & détails | 24 |
| **Total** | **315** |
