# Plan 183 — Contrôles tactiles (Lot 1)

> **Statut** : done (2026-08-19 — livré, validé sur téléphone réel)
> **Créé** : 2026-08-19
> **Phase** : 6.5 « Client jouable », Lot 1 (contrôles tactiles) — **le lot qui justifie la phase**
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` § « Lot 1 — Contrôles tactiles »
> **Recherche préalable** : agent `best-practices`, 2026-08-19 (8 points, sources en fin de document). Cadrage antérieur : `docs/plans/180-comportement-plateforme-mobile.md` §E (lecture de `pokerogue/src/touch-controls.ts`).

## Motivation

**Seul retour de vrais utilisateurs de tout le backlog** : les proches de l'humain ont dit le jeu **injouable sur mobile**, et la douleur précisée (2026-07-24) est bien celle des **contrôles**. Le Lot 3 (l'UI) est clos depuis le plan 182 ; ce lot est la raison d'être de la phase.

**Le point dur n'est pas le pinch, c'est le survol.** La cartographie du 2026-08-19 donne l'état réel :

| Interaction | Mécanisme actuel | Au doigt |
|---|---|---|
| Sélection de tuile | `pointerup` sans drag → `pickTile` | ✅ marche déjà |
| Pan caméra | 1 pointeur glissé → `panByPixels` | ✅ marche déjà |
| Zoom | `wheel` seul (3 crans discrets) | ❌ inaccessible |
| Rotation caméra | `keydown` ←/→ seul | ❌ inaccessible |
| **InfoPanel, panneau de case, portée ennemie, prévision de combat** | tous pilotés par `onTileHover` (`battle-orchestrator.ts:294`) | ❌ **invisibles** |
| **Annuler une action en cours** | Échap seul, sauf le sous-menu d'attaque qui a un bouton | ❌ **5 phases sur 6 sans issue** |

Conséquence : **tout le Lot 3 qu'on vient de livrer** (plans 174→178 : InfoPanel enrichi, prévision de combat, info de case, tooltip d'attaque) **n'existe pas au doigt**, parce qu'il n'y a jamais de `pointermove` sans pression sur un écran tactile. Ce lot ne consiste donc pas à « ajouter le pinch » : il consiste à **donner au doigt une intention d'inspection**, puis à rendre atteignables le zoom, la rotation et l'annulation.

La dernière ligne du tableau est le trou le plus grave, découvert en cours de rédaction : **une fois une action engagée, le joueur mobile ne peut plus revenir en arrière** — il doit aller au bout ou subir. Détail et remède en §F.

## Acquis — ce qui est déjà bon, à ne pas retoucher

Vérifié dans le code, pour ne pas rouvrir de chasse :

- `#game-canvas { touch-action: none }` (`game-overlay.css:36`) : c'est **le bon choix** pour un canvas de jeu qui gère lui-même pan/pinch (reco MDN pour ce cas précis). Le plan 180 §E avait déjà mis en garde contre l'étendre au chrome DOM (ça tuerait le défilement du journal) — la règle est bien scopée au seul canvas.
- `#game-overlay { pointer-events: none }` avec chaque contrôle qui repasse à `auto` : pattern correct pour laisser les zones vides retomber sur le canvas.
- `--target-min` sous `@media (pointer: coarse)` : livré au plan 179.
- `viewport-fit=cover` posé (`index.html`), prérequis `env(safe-area-inset-*)`.
- `overflow: hidden` sur la racine → pas de pull-to-refresh Android à neutraliser.
- La caméra **se recentre déjà seule** sur le Pokemon actif à chaque tour (`battle-orchestrator.ts:518` → `panCameraTo(active.position)`), donc un pan raté se corrige au tour suivant.

## Décisions humaines (2026-08-19)

| Sujet | Décision | Raison |
|---|---|---|
| **Confirmation au doigt** | ~~Tap en deux temps généralisé~~ **ABANDONNÉ en cours de test (2026-08-19)**. Un tap **agit du premier coup** et alimente le survol au passage, donc les panneaux d'info et la prévision apparaissent quand même. Souris inchangée. | Mesuré sur le vrai flux : le jeu a **déjà** sa propre étape de confirmation (choisir une cible ouvre la prévision, il faut re-cliquer), donc empiler la mienne portait une attaque à **4 taps** contre 2 clics à la souris. « Trop lourd, 2 taps pour tout » (humain). Redondance que je n'avais pas vue en proposant le deux-temps. |
| **Viser un pattern directionnel** | Seule exception : cône/ligne/fauche/charge **s'ouvrent avec leur cône déjà affiché** (direction du lanceur), puis **retaper la même direction lance**, une autre direction re-vise. Arbitré dans l'orchestrateur, pas dans le renderer. | Sans défaut affiché la phase s'ouvrait sur un plateau vide (« on comprend pas ce qu'il faut faire », humain). Et la comparaison doit porter sur la **direction**, pas sur la case — plusieurs cases partagent une direction, donc une comparaison de cases refusait de valider un cône déjà à l'écran. Seul l'orchestrateur connaît la direction, d'où le déplacement de l'arbitrage. |
| **Orientation en fin de tour** | Même règle : retaper la même orientation valide, en changer l'affiche. | Bug trouvé sur téléphone : je comparais un booléen « a déjà tapé » et non la direction, donc changer d'avis validait la nouvelle orientation au lieu de la montrer. |
| **Zoom au pinch** | Le pinch **saute de cran en cran** dans les 3 niveaux existants (`ZOOM_LEVELS = [0.7, 1.1, 1.8]`), au-delà d'un seuil d'écartement. Pas de zoom continu. | Cohérence stricte avec la molette et le clavier : une seule notion de zoom dans tout le jeu, une seule chose à tester. |
| **Rotation caméra** | **La boussole devient tapable**, et tourne **toujours dans le même sens**. Aucun bouton on-screen ajouté. | La boussole est déjà à l'écran en permanence et signifie déjà « orientation ». Un sens unique évite de couper une cible déjà petite en deux moitiés de moins de 44 px. 4 taps = tour complet. |
| **Taille et ancrage de la boussole** | **Repris de la première case de la timeline** : même côté, coin **haut-gauche** posé au coin haut-droit du portrait, 6 px d'écart. Mesuré à l'exécution (`ui-dom/chrome-insets.ts`). | ~~Point de bascule mobile + ×0,6~~ et ~~ancrage par le centre~~ écartés après **trois** dérives constatées sur téléphone : derrière la timeline, puis flottante dans le vide, puis glissant de 12 px dès que sa taille changeait (un centre fixe avec une demi-largeur variable **déplace** les bords). Se calquer sur le portrait supprime tout nombre choisi à l'œil : aucun point de bascule, aucun multiplicateur. |
| **Zone tapable de la boussole** | **Proxy de picking invisible** contre-scalé pour rester à ~59 px CSS quelle que soit la taille visible. | L'aiguille fait ~17 px de large : trop fine à taper. Taille visible ≠ zone tapable (« hit slop »), ce qui permet de la rétrécir sans la rendre intapable. |
| **Recentrage manuel** | **Aucun contrôle.** | Le recentrage automatique par tour existe déjà (voir Acquis). |
| **Annulation au doigt** | **Le bouton « Annuler » est étendu aux 6 phases annulables**, au même endroit que celui du sous-menu d'attaque, câblé sur le `onEscape` existant. Les deux phases qui vident l'écran gardent désormais une ligne d'instruction + le bouton. | Échap n'existe pas au doigt : **5 phases sur 6 étaient sans issue sur mobile**. Le bouton et son libellé existent déjà, donc on étend au lieu d'inventer. Corrige aussi le desktop, où Échap n'est découvrable nulle part. |
| **Assets Kenney** | **Pas dans ce lot.** | Sans bouton de caméra on-screen, il n'y a aucune icône à produire (le bouton « Annuler » est textuel, comme l'existant). Le sujet repart au Lot 2 pour les glyphes de manette, où le choix de style (64×64 vs 1-bit) devra être tranché. |
| **Overlay tactile masquable** | **Sans objet pour ce lot**, et ce n'est pas un report : le cadre 173 demandait que l'overlay tactile expose un point d'accroche pour être masqué quand une manette prend le relais. En choisissant la boussole plutôt que des boutons, **ce lot ne crée aucun overlay tactile** — donc rien à masquer. La boussole est un élément de HUD permanent, pas un contrôle tactile : elle reste pertinente et tapable même quand une manette est active. Le Lot 2 n'a donc aucun point d'accroche à récupérer ici. | Le cas « mobile + manette USB-C » du cadre 173 reste couvert : il n'y a plus de sticks parasites à cacher puisqu'on n'en ajoute aucun. |
| **Type de caméra** | On **garde** la `TargetCamera` orthographique custom ; pinch et pan codés à la main. | `ArcRotateCameraPointersInput` est typé `ICameraInput<ArcRotateCamera>` : inutilisable ici. Migrer vers une `ArcRotateCamera` pour récupérer le pinch « gratuit » casserait le snap 90°, le dimetric ortho, l'easing, et l'`azimuth` que consomment le billboardage des sprites et la boussole. Coût de détachement des inputs actuels : **nul**, aucun n'a jamais été attaché. |

## Conception

### A. Suivi multi-pointeurs

L'état d'entrée de `combat-scene.ts` est aujourd'hui **scalaire** (`dragging`, `pressStartX/Y`, `previousPointerX/Y`), pensé pour une souris. Il passe à un `Map<pointerId, {x, y}>` tenu à jour dans `onPointerDown` / `onPointerMove`, purgé dans `onPointerUp` **et dans un nouveau `onPointerCancel`** (absent aujourd'hui).

- `pointercancel` n'est **pas** un détail : l'OS peut annuler un pointeur en cours (bascule d'application, geste système intercepté). Sans lui, un doigt reste fantôme dans la table, et le pinch suivant calcule sa distance depuis une position périmée → saut.
- `setPointerCapture(event.pointerId)` sur le canvas au `pointerdown` pour que le glissé continue de recevoir les événements même si le doigt sort du canvas.
- `pointercancel` force `wasClick = false` : un geste annulé ne doit jamais valider une action.

### B. Seuil tap / glissé, par type de pointeur

`PICK_DRAG_THRESHOLD_PX = 5` (`packages/view-core/src/constants.ts`) est calibré souris. Au doigt, un tap « immobile » bouge de quelques pixels : à 5 px, des taps légitimes deviennent des glissés.

→ Seuil dérivé de `event.pointerType` **au moment du `pointerdown`**, mémorisé avec `pressStartX/Y` : **5 px** pour `mouse` / `pen`, **10 px** pour `touch`. Pas de nouvelle constante globale par type — une seule constante tactile ajoutée à côté de l'existante.

### C. Un tap agit — sauf pour viser une direction

Écrit d'abord comme un tap en deux temps généralisé (une machine à états comparant les cases), puis
**refait** après mesure sur le vrai flux : le jeu a déjà son étape de confirmation, donc l'empiler
doublait tout. Le module de tap par cases a été supprimé, il n'avait plus de raison d'être.

```
souris / stylet          → inchangé (survol continu, clic simple)
doigt, cas général       → survol + clic dans le même geste  (donc panneaux d'info alimentés)
doigt, pattern direction → tap changeant la direction   = affiche le cône
                           tap gardant la direction     = lance
                           (défaut affiché à l'entrée de la phase = 1 tap suffit si tu l'acceptes)
doigt, orientation       → même règle, dans le sélecteur de direction
```

Deux points structurants :

- **La comparaison est directionnelle, pas par case.** Plusieurs cases donnent la même direction ;
  comparer les cases refusait de valider un cône déjà affiché tant qu'on ne retapait pas exactement
  la même case. C'est ce qui a fait remonter l'arbitrage dans l'orchestrateur : lui seul connaît la
  direction (`directionFromTo`, `previewDirection`), le renderer ne transmet que la **source** du
  press (`"touch"` / `"pointer"`) via `onTileClick`.
- **Le survol part avec le clic sur tactile.** C'est ce qui fait apparaître InfoPanel, panneau de
  case, portée ennemie et prévision de dégâts au doigt — l'objet même du lot.

### D. Pinch → crans de zoom

Sur exactement 2 pointeurs actifs :

- Distance entre les deux → comparée à la distance de référence ; au-delà d'un **seuil d'écartement** (ratio, pas delta absolu — un ratio est indépendant de l'échelle courante et ne dérive pas), on appelle `rotateByStep`-équivalent du zoom, c'est-à-dire un cran via l'API existante, puis on **réarme la distance de référence** sur la distance courante.
- **Piège n°1, à traiter explicitement** : au passage 2 doigts → 1 doigt (ou 1 → 2), la distance et le centroïde de référence sont **recalculés à neuf**. Les laisser traîner entre deux configurations différentes est la cause classique du saut de zoom quand un doigt se lève.
- Le déplacement du **centroïde** des deux doigts alimente `panByPixels` → pan et zoom cohabitent dans le même geste, comme le fait `multiTouchPanAndZoom` de Babylon. Pas d'ancrage précis du zoom sur le centroïde : avec un zoom à crans, l'ancrage exact n'a pas de sens, et il demanderait une projection écran→monde qui n'existe pas côté caméra (`projectWorld` fait l'inverse).

### E. Boussole tapable

`babylon-compass.ts` : mesh voxel `.glb` épinglé en haut-gauche, groupe de rendu HUD, `isPickable = false`, **taille en pixels constante** (le calcul fait s'annuler `renderHeight` et `verticalSpan`, donc la boussole fait le même nombre de pixels à toute résolution et tout zoom).

- **Proxy de picking** : boîte invisible (`isVisible = false`) parentée à la racine de la boussole, dimensionnée pour ≥ 44 px CSS. `scene.pick` avec un **prédicat dédié** la trouve malgré son invisibilité — un prédicat remplace les contrôles de visibilité par défaut de Babylon, exactement comme `isTileMesh` le fait déjà dans `pickTile`. Le mesh visible reste `isPickable = false`.
- **Ordre de résolution dans `onPointerUp`** : boussole **d'abord**, tuile ensuite, avec sortie anticipée. Sinon le rayon traverse et sélectionne la tuile derrière la boussole. Idem pour le survol, qui ne doit pas déplacer le curseur quand le pointeur est sur la boussole.
- **Sens unique** : un tap = `rotateByStep(1)`. Le clavier ←/→ garde ses **deux** sens, inchangé.
- **Taille sur mobile** : `COMPASS_SIZE_SCALE` devient conditionnel au point de bascule « petit écran » du chrome. Valeur de départ ~36 px (contre ~59 px aujourd'hui), **à ajuster au test humain** — c'est un réglage visuel, pas une valeur à figer depuis un calcul.
- Le pixel constant est calculé en pixels de framebuffer ; `new Engine(canvas, false, {...})` ne passe pas `adaptToDeviceRatio` (défaut `false`) → niveau de mise à l'échelle matérielle 1, donc framebuffer = pixels CSS. Le raisonnement en px CSS ci-dessus est valide.

### F. Annulation atteignable au doigt

Trou identifié le 2026-08-19 en cours de rédaction, **plus large que le tactile** : `onEscape` (`battle-orchestrator.ts:253`) gère correctement les six phases annulables, mais rien ne permet de le déclencher sans clavier.

| Phase | Rendu chrome actuel | Annulable au doigt ? |
|---|---|---|
| `attack_submenu` | liste des attaques + bouton « Annuler » (`battle-chrome.ts:194`) | ✅ déjà |
| `select_attack_target` | `showSelectedMove` → nom de l'attaque + ligne d'instruction | ❌ |
| `confirm_attack` | idem | ❌ |
| `select_retreat_target` | idem | ❌ |
| `select_move_destination` | `hideMenus()` → **écran vide** (`battle-orchestrator.ts:558`) | ❌ |
| `select_direction` | `hideMenus()` → **écran vide** (`battle-orchestrator.ts:1081`) | ❌ |

→ **Étendre le bouton existant**, pas en créer un autre :

- `showSelectedMove` ajoute un bouton « Annuler » sous la ligne d'instruction, câblé sur `onEscape` — même composant, même libellé `action.cancel`, même position que dans le sous-menu d'attaque.
- `select_move_destination` et `select_direction` cessent d'appeler `hideMenus()` : elles affichent une ligne d'instruction + le bouton.
- Le bouton doit respecter `--target-min` sous `pointer: coarse` (déjà en place pour `.bc-btn`, à vérifier).
- `action_menu` **n'est volontairement pas dans le tableau** : c'est la phase racine, il n'y a rien à annuler (`onEscape` y tombe en `default` et ne fait rien, ce qui est correct).

**Chaîne complète des deux nouvelles instructions** — le plan initial ne parlait que des clés i18n, ce qui sous-estimait le travail. La ligne d'instruction passe par un type sémantique, pas par une chaîne :

1. `packages/render-ports/src/ports.ts:239` — `BattleInstruction` est une **union à 3 variantes** (`"selectTarget" | "confirm" | "selectRetreat"`), à étendre de deux : destination et orientation. C'est ce type qui garde la machine à états libre des clés i18n.
2. `packages/ui-dom/src/battle-chrome.ts:26` — `INSTRUCTION_KEY` mappe chaque variante vers sa clé ; deux entrées à ajouter.
3. `packages/app/src/i18n/types.ts` — deux clés dans l'interface `Translations` (typée, donc les locales incomplètes échouent au typecheck).
4. `packages/app/src/i18n/locales/` — les deux traductions, FR et EN.

Bénéfice au-delà du tactile : Échap n'est **découvrable nulle part** aujourd'hui, y compris à la souris.

### G. Styles des contrôles tactiles

Aucun bouton ajouté par ce lot, mais un manque à corriger sur les boutons icônes existants (`.fs-btn`) avant qu'un contrôle passe en appui maintenu : ni `user-select: none` ni `-webkit-touch-callout: none` (callout iOS « Copier / Rechercher » au maintien long). Correction locale, sans nouveau token tant que ce n'est pas réutilisé.

## Étapes

1. **Table de pointeurs + `pointercancel`** (A) — refonte de l'état scalaire de `combat-scene.ts`, `setPointerCapture`. Aucun changement de comportement souris attendu : filet e2e existant.
2. **Seuil par type de pointeur** (B).
3. **Comportement du tap** (C) — un tap agit ; visée directionnelle arbitrée dans l'orchestrateur ; sélecteur de direction comparant la direction. Le gros du lot, et la partie refaite après test humain.
4. **Pinch → crans** (D).
5. **Boussole tapable + proxy + taille mobile** (E).
6. **Annulation atteignable** (F) — bouton « Annuler » étendu aux 6 phases + 2 clés i18n. Indépendant du reste : livrable et testable seul.
7. **Styles tactiles** (G).
8. **Tests** — unitaires sur la machine à états du tap en deux temps (logique pure, extractible de `combat-scene.ts` pour être testable sans Babylon) ; e2e sur le harnais existant.

   ⚠️ Playwright pilote le jeu par le **hook de scène** (`installE2eSceneHook`), dont `clickTile` / `hoverTile` appellent `clickHandler` / `hoverHandler` **directement** — ils court-circuitent donc toute cette couche.

   **Décision révisée (2026-08-19, review du plan)** : on **n'y touche pas**. `clickTile` / `hoverTile` gardent leur sémantique de court-circuit, donc les ~419 tests e2e existants sont **intacts par construction**. On **ajoute** à côté une méthode distincte (`tapTile`, nom à confirmer) qui synthétise un vrai `pointerdown` / `pointerup` tactile et traverse la couche d'entrée réelle — seuls les nouveaux tests du tap en deux temps l'utilisent. Isole complètement le risque au lieu de le répartir sur toute la suite.

   L'étape 6 (annulation), elle, est du DOM pur → couverte par le harnais existant sans rien changer.

   **Cahier de recette** (`docs/test-plan.md`) à mettre à jour dans la même étape : §11 (inventaire e2e) pour les nouvelles assertions du tap en deux temps, et un cas de choix d'orientation au doigt (2 taps) distinct du chemin clavier.
9. **Test humain sur téléphone réel** — le seul juge de ce lot.

## Risques / points ouverts

- ~~Survie de la machine à états du tap aux transitions inattendues.~~ **Sans objet** : il n'y a plus d'état de tap à faire survivre. Un tap agit immédiatement, et la seule mémoire restante est la direction visée (`touchAimedDirection`), remise à zéro à l'entrée de la phase de ciblage. Le risque a disparu avec la simplification, pas été traité.
- **Mélange clavier + doigt dans le sélecteur d'orientation** : la règle du tap en deux temps ne s'applique qu'aux événements `touch`, le clavier garde son chemin direct. Un joueur qui alterne les deux dans la même phase devrait être cohérent, mais ça ne se vérifie qu'au test humain.
- **Couplage implicite avec le Lot 2** : le tactile est codé en direct dans `combat-scene.ts`, donc le Lot 2 devra rapatrier la machine à états derrière la couche d'actions logiques, et non l'envelopper. Dette assumée, conforme à la reco du cadre 173 (ne pas sur-architecturer avant d'en avoir besoin) — mais c'est bien une dette, pas un choix neutre.
- **`onTileClick` en phase `confirm_attack` valide l'attaque quelle que soit la tuile cliquée** (`battle-orchestrator.ts:239`). Comportement **conservé sciemment** (décision humaine 2026-08-19) : à la souris c'est un raccourci de confirmation rapide, et les deux garde-fous de ce lot le rendent inoffensif au doigt — le tap en deux temps fait qu'un tap ailleurs recadre au lieu de valider, et le bouton « Annuler » (F) donne une sortie explicite. Noté pour ne pas le rouvrir sans raison.
- **Le tap en deux temps double le nombre de gestes** pour agir sur mobile. C'est le prix de l'inspection ; à valider au test humain, et à réévaluer si ça donne une impression de lourdeur.
- La **couche d'entrée device-agnostique** (actions logiques, source active « last-input-wins ») reste au **Lot 2**, conformément à la reco du plan-cadre 173. Ce lot code le tactile en direct dans `combat-scene.ts` ; le Lot 2 devra le rapatrier derrière la couche.

## Fichiers touchés

- `packages/render-babylon/src/combat-scene.ts` — table de pointeurs, `pointercancel`, seuil par type, tap en deux temps, pinch, résolution boussole
- `packages/render-babylon/src/babylon-compass.ts` — proxy de picking, taille conditionnelle
- `packages/render-babylon/src/babylon-picking.ts` — prédicat de picking de la boussole
- `packages/view-core/src/constants.ts` — `PICK_DRAG_THRESHOLD_TOUCH_PX` (10) et `PINCH_ZOOM_STEP_RATIO`
- `packages/view-core/src/battle-orchestrator.ts` — les 2 phases qui vident le chrome affichent instruction + annulation
- `packages/render-ports/src/ports.ts` — `BattleInstruction` étendu de 2 variantes
- `packages/render-ports/src/combat-scene.ts` — `TilePointerSource`, porté par `onTileClick`
- `packages/ui-dom/src/chrome-insets.ts` — **nouveau** : mesure la première case de la timeline (taille + ancrage de la boussole)
- `packages/ui-dom/src/battle-chrome.ts` — bouton « Annuler » dans `showSelectedMove`, + 2 entrées dans `INSTRUCTION_KEY`
- `packages/app/src/i18n/types.ts` + `packages/app/src/i18n/locales/` — 2 clés d'instruction (destination, orientation), FR et EN
- `packages/ui-dom/src/styles/fullscreen-button.css` — `user-select` / `-webkit-touch-callout`
- `packages/render-babylon/src/e2e-debug-hook.ts` — **ajout** de `tapTile`, qui traverse la couche d'entrée ; `clickTile` / `hoverTile` inchangés
- `docs/test-plan.md` — §11 + cas d'orientation au doigt (étape 8)

## Sources

Pointer Events : [MDN Multi-touch interaction](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction) · [MDN exemple pinch/zoom](https://mdn.github.io/dom-examples/pointerevents/Pinch_zoom_gestures.html) · [W3C Pointer Events niveau 3](https://www.w3.org/TR/pointerevents3/)
Gestes natifs : [MDN `touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) · [MDN `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
Babylon : [`ArcRotateCameraPointersInput` (source)](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/Inputs/arcRotateCameraPointersInput.ts) · [Custom Camera Inputs](https://babylonjs.medium.com/looking-at-custom-camera-inputs-becb492f09fc)
Cibles tactiles : [WCAG 2.2 SC 2.5.8](https://wcag22aa.org/new-criteria/target-size/) · [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) · [Material 3](https://m3.material.io/foundations/overview/principles)
Projet : `docs/plans/180-comportement-plateforme-mobile.md` §E · [PokeRogue `touch-controls.ts`](https://github.com/pagefaultgames/pokerogue/blob/main/src/touch-controls.ts)

## Bilan — ce que le test humain a corrigé

Trois de mes choix de conception n'ont pas survécu au téléphone, et c'est la partie utile de ce plan :

1. **Le tap en deux temps généralisé** était redondant avec l'étape de confirmation que le jeu a
   déjà. Je ne l'avais pas vu en le proposant ; le compte de taps (4 contre 2) l'a montré d'un coup.
2. **La boussole** a dérivé trois fois avant d'être calée sur la première case de la timeline. Chaque
   tentative reposait sur une constante à moi (point de bascule, multiplicateur, dégagement) ; aucune
   ne tenait, parce qu'un objet 3D épinglé en pixels ne peut pas s'accorder avec une mise en page
   flex sans mesurer celle-ci. Deux bogues au passage : un `Math.max` avec l'ancienne position fixe
   qui **annulait silencieusement** la mesure, et un ancrage par le centre qui déplaçait les bords
   dès que la taille changeait.
3. **L'annulation** n'était pas au périmètre initial. Elle a été découverte en rédigeant le plan
   (5 phases sur 6 sans issue au doigt) et c'est le gain le plus net du lot.

Vérification à retenir : sur le téléphone de test, `getRenderWidth()` **ne** vaut **pas** les pixels
CSS (ratio ~2), alors qu'il les vaut sur Chromium de bureau. Toute position d'élément de scène
alignée sur une mesure DOM doit convertir explicitement.
