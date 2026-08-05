# Plan 179 — Responsive + dette mobile

- **Statut** : `done` (2026-08-06) — implémentation + code-review + e2e livrées. Validation humaine **partielle** : combat, Team Builder, sélecteurs et orientation validés sur téléphone réel ; dialog de victoire et rendu 4K jamais vus (voir § Clôture)
- **Date** : 2026-08-05
- **Phase** : 6.5 « Client jouable : contrôles & UI » — **Lot 3**, item « Responsive + dette mobile »
- **Plan-cadre** : [173](./173-phase-client-jouable-ui-controles.md)
- **Recherche préalable** : agent `best-practices` (A→G), 2026-08-05 — conclusions vérifiées dans le code avant reprise ici

## Clôture (2026-08-06)

Reprise terminée : `test-writer` (18 tests — `e2e/pages/responsive.ts`, `e2e/tests/combat/responsive-chrome.spec.ts`, `e2e/tests/dom/responsive-screens.spec.ts`, `e2e/tests/dom/responsive-team-builder.spec.ts`), `code-reviewer` (12 points corrigés, dont un seuil divergent entre media queries inclusives et container queries exclusives), `doc-keeper`. Décisions #733–#737 (`docs/decisions.md`), architecture `docs/architecture.md` § 5i, convention de second référentiel `docs/design-system.md`.

**Écrans manquants au tableau ci-dessous, tranchés depuis** : choix de carte / Team Builder / 3 sélecteurs / sélection d'équipe validés ; **écran de placement** corrigé (labels sous la barre de gestes, cf. `docs/test-plan.md` §8.5 — le `.pl-roster` à 0×0 signalé ci-dessous ne s'est pas reproduit) ; sélecteur d'objet et modale Showdown couverts par les mêmes correctifs génériques (tokens compacts, filtres en défilement) que les 2 autres pickers. **Restent jamais vus** : dialog de victoire, rendu 4K — 2 points ouverts consignés dans `docs/next.md` (paddings non scalés de l'indicateur de tour / pastille d'instruction / dialog de victoire).

**Accès mobile réel** : tranché en tunnel de dev (`PT_TUNNEL=1`, `docs/references/test-sur-telephone.md`) — la box isole les appareils Wi-Fi entre eux, pas de fix côté serveur possible.

## Reprise (arrêt de session 2026-08-05 au soir, historique)

**Où on en est** : tout est implémenté et le gate local passe (lint, typecheck, build, 3686 unit, 383 integration). Commit **WIP `8d13d58`** = point de restauration. La **validation humaine écran par écran n'est pas terminée** — c'est là qu'il faut reprendre.

**Ordre de reprise** (l'humain a rappelé que le human-testing passe AVANT e2e et les autres agents) :

1. **Finir la validation des écrans** à 851×393 (téléphone Android en paysage) — captures dans `.screenshots/` (répertoire gitignoré, local) :
   | Écran | Capture | État |
   |---|---|---|
   | Combat | `iter2-combat-851x393.png` | ✅ validé après 2 itérations (menu réduit, InfoPanel réduit, timeline agrandie) |
   | Portrait téléphone | `impl-179-portrait-prompt.png` | ✅ « j'aime bcp » |
   | Tablette portrait | `iter2-tablette-portrait-821x1180.png` | ✅ jouable (overlay désactivé ≥600px) |
   | Choix de carte | `iter3-map-select-851x393.png` | 🕓 corrigé, **à valider** |
   | Team Builder (édition) | `iter3-team-edit-851x393.png` | 🕓 corrigé, **à valider** |
   | Sélecteur de Pokemon | `iter3-pokemon-picker-851x393.png` | 🕓 corrigé, **à valider** |
   | Sélecteur de capacité | `iter3-move-picker-851x393.png` | 🕓 corrigé, **à valider** |
   | Menu principal | `val-01-menu-principal.png` | 🕓 vérifié sans défaut, **à valider** |
   | Paramètres | `val-02-parametres.png` | 🕓 idem |
   | Crédits | `val-03-credits.png` | 🕓 idem (tient juste) |
   | Sélection d'équipe | `val-04-team-select-AVANT.png` | 🕓 vérifié sans défaut réel (les « débordements » détectés étaient le contenu du conteneur défilant `.ts-team-list`) |
   | **Écran de placement** | — | ❌ **jamais vu** : `pl-roster` restait 0×0 même avec « Placement auto » décoché. À investiguer, `placement.css` a 4 valeurs px non scalées |
   | **Sélecteur d'objet** | — | ❌ jamais vu (`ItemPickerModal`) |
   | **Modale Showdown** | — | ❌ jamais vue |
   | **Dialog de victoire** | — | ❌ jamais vue (hérite l'échelle du chrome, a priori OK) |
2. Puis, dans l'ordre : `test-writer` (e2e) → `code-reviewer` → `doc-keeper` → **re-test humain** → `/ci-gate` (avec e2e) → `/commit` qui **amende** `8d13d58`.

**Travail non committé sur le disque** (test-writer, arrêté en cours de route à la demande de l'humain — à reprendre, pas à jeter) :
- `e2e/pages/responsive.ts`, `e2e/tests/combat/responsive-chrome.spec.ts`, `e2e/tests/dom/responsive-screens.spec.ts` (nouveaux, non relus)
- `data-testid` ajoutés à `OrientationPrompt.ts` (`orientation-prompt`) et `MovePickerModal.ts` (`move-type-filter`) — additifs, sans risque
- Sa sonde jetable `e2e/tests/dom/zz-probe.spec.ts` a été **supprimée** (test mort)

**Accès mobile par le réseau local impossible** : serveur, pare-feu et adressage vérifiés bons — c'est la box qui **isole les appareils Wi-Fi entre eux**. Contournement retenu : **tunnel de dev**, procédure complète et pièges dans `docs/references/test-sur-telephone.md`. L'émulation d'appareil des devtools reste utile pour les dimensions, mais ne teste ni le toucher réel ni l'encoche.

**Chantier à ouvrir séparément** : ressusciter le système d'échelle `--tb-px` du Team Builder (inerte en production, voir la note dans `team-builder-overlay.css`) — rescalerait l'écran à toutes les tailles, 4K comprise, donc décision visuelle à part.

## Décisions humaines d'entrée (tranchées 2026-08-05, ne pas rouvrir)

1. **Paysage forcé** sur mobile : overlay « tourne ton écran » en portrait, **un seul layout scalé**. Pas de layout portrait alternatif.
2. **Cible min-width = 360px**.
3. **Sandbox Studio hors périmètre responsive** — outil de dev. `sandbox-studio.css` non touché.
4. **Pas de plancher de font-size par élément** — écarté le 2026-07-23. Voir §E pour la nuance validée par la recherche (plancher autorisé sur la *hit-area invisible*, pas sur le rendu).

### Validées sur prévisualisation visuelle (2026-08-05)

Prévisualisations injectées en devtools (jetables, rien de committé) et arbitrées sur captures :

5. **Zoom mobile = ×1,5** → écran de référence **1280×720** sous le seuil. Captures comparées : `zoom-x1.5-ref1280.png`, `zoom-x1.7-ref1152.png`, `zoom-x1.9-ref1024.png`, `zoom-x2.25-ref854.png`. Motif : garde le plus de terrain visible.
6. **Menu d'actions : taille de maquette 34px** (compromis retenu contre les 40px qui auraient reproduit exactement l'aspect mobile actuel). Aligné sur le nom du Pokemon de l'InfoPanel (33px de maquette) → **cohérent avec les tokens existants**, le menu ne devient pas le plus gros texte du chrome. Conséquences assumées : téléphone paysage **18px** (au lieu des 22px actuels, jugés préférables mais non alignables sans casser le design system), 1600×900 → 28px, 1920 → 34px, 4K → 68px. Corrige au passage le fait que ce menu est aujourd'hui le **seul** élément du chrome qui ne profite jamais de la place disponible sur grand écran.
7. **Timeline : aucun changement dans ce plan** — voir la correction au § Diagnostic.

## Diagnostic mesuré

Relevé 2026-08-05, chrome de combat réel (sandbox 3v3, panneau du studio masqué pour retrouver une scène plein écran), viewport **846×392** = paysage mobile type, `--ui-scale = 0.3625`. Capture : `.screenshots/mobile-landscape-chrome-844x390.png`.

### Cause racine : le seuil du second référentiel ne se déclenche jamais en paysage

Le projet a **déjà** le bon pattern (« second référentiel de design », équivalent du *Reference Resolution* d'Unity), implémenté dans **3 composants** :

| Fichier | Variable | Seuil |
|---|---|---|
| `packages/ui-dom/src/styles/info-panel.css:585` | `--ip-px` : `100cqw/1920` → `100cqw/768` | `@container stage (width < 768px)` |
| `packages/ui-dom/src/styles/weather-hud.css:65` | `--wh-px` idem | idem |
| `packages/app/src/styles/team-builder-overlay.css:101` | `--tb-px` idem | idem |

**Le seuil est sur la _largeur_, à 768px. Un téléphone en paysage fait ~844 de large.** Donc `width < 768px` **ne matche pas** — le second référentiel reste inerte exactement dans le cas qu'on veut traiter. En paysage, la dimension discriminante est la **hauteur** (390), pas la largeur (667→956 selon le modèle).

Vérification arithmétique sur l'InfoPanel à 846 de large : `--ip-px = 846/1920 = 0.44px` → panneau `300 × 0.44 = 132px` (mesuré 144), chip de type `20 × 0.44 ≈ 8.8px` (mesuré 8.8px). Avec le référentiel 768 il ferait `846/768 = 1.1px` → panneau 330px, chip 22px. Le mécanisme fonctionne, **son seuil est juste calibré pour le portrait** alors que la décision produit est le paysage forcé.

### Trois systèmes de dimensionnement cohabitent

| Système | Formule | Second référentiel ? | Consommateurs |
|---|---|---|---|
| **1. `--ui-scale`** (JS, `game-stage.ts:71`) | `min(w/1920, h/1080)` | ❌ aucun | journal, timeline, `battle-chrome`, tooltip d'attaque, chips de type/statut |
| **2. `--xx-px`** (CSS, container query) | `100cqw/1920` | ✅ mais seuil largeur 768 (inerte en paysage) | InfoPanel, HUD météo, Team Builder |
| **3. Tokens fixes** | `--font-size-md: 22px` | ❌ ne scale pas du tout | `.tb-btn` (menu d'actions), `.bc-top`/`.bc-turn` |

Le système 1 est piloté par la hauteur en paysage (`390/1080 = 0.36` < `846/1920 = 0.44`) — c'est déjà le bon axe. Le système 2 ne regarde que la largeur. Incohérence d'architecture non documentée dans `docs/decisions.md`.

### Constats individuels

| # | Constat mesuré | Cause | Gravité |
|---|---|---|---|
| 1 | **Menu d'actions non scalé** : `.tb-btn` 115×37, `font-size: 22px` ; indicateur de tour `.bc-top`/`.bc-turn` 97×37, 22px | Système 3 (tokens fixes du Team Builder) | 🔴 **La « dette mobile » du 2026-07-24** : garde sa taille desktop pendant que tout rétrécit ×0.36 |
| 2 | ~~**Timeline hors écran**~~ — **CONSTAT FAUX, retiré** (voir encadré ci-dessous) | Artefact de mesure | — |
| 3 | **Bouton du journal injouable** : `.bl-burger` **13×13 px**, font 7.8px | Système 1 sans plancher de hit-area | 🔴 13px vs 24px minimum WCAG 2.2 SC 2.5.8 |
| 4 | **Textes illisibles** : chip de type 8.8px, `.ti-terrain` 10.5px, `.ip-name` 14.5px | Seuil du second référentiel inerte (cause racine) | 🟠 |
| 5 | **`viewport-fit=cover` absent** (`packages/app/index.html:5`) | Jamais posé | 🔴 **Aggravé par le paysage forcé** : sans lui, Safari **letterboxe** (bandes noires) sur iPhone à encoche, et tous les `env(safe-area-inset-*)` résolvent à `0px`. En paysage l'encoche passe sur le *côté* (`-left`/`-right`) |
| 6 | **`Modal.ts:62` monte ses dialogs sur `document.body`** | Parenté DOM, **pas** le top-layer | 🟠 Correction de mon analyse initiale : le top-layer **n'interrompt pas** l'héritage des custom properties (csswg-drafts #6939) ; c'est `document.body.appendChild` qui sort le dialog de `#game-stage`. `battle-chrome.ts` (`showVictory`) monte bien dans le stage et hériterait `--ui-scale` — il ne l'utilise simplement pas |
| 7 | **`100vh` legacy** sur `#game-root` (inline, `index.html`) redondant avec `position:fixed; inset:0` de `game-overlay.css:10` | Historique | 🟠 |
| 8 | Aucun `@media` dans le chrome, aucun `pointer: coarse`, aucun `env(safe-area-*)`, aucune gestion d'orientation | Jamais construit | 🟠 |

### Correction — la timeline ne déborde pas

Le constat 2 initial (« 6 vignettes hors écran ») était un **artefact de ma méthode de mesure** : je comptais comme « hors viewport » des enfants simplement défilés hors du cadre d'un conteneur défilant. Vérifié dans le code et à l'exécution :

- `.tt-list` (`turn-timeline.css:28-47`) est un conteneur défilant **par conception** : `overflow-y: auto`, `flex: 1 1 auto`, `min-block-size: 0`, barre de défilement masquée volontairement (commentaire : *« it read as a stray right-edge border on hover »*). `.tt-timeline` est un enfant flex de `.bc-left-col` qui « shrinks to leave room for the info panel pinned below (so the visible card count adapts to the stage height and the strip never overlaps the panel) ».
- Mesuré à 844×390 : `scrollHeight 1268` / `clientHeight 192`, **49 vignettes dont 7 visibles**, bas de la bande à `237px`, InfoPanel à `245px` — la bande est bornée et ne chevauche rien.

Donc rien à réparer, et **« compresser » aurait été nuisible** : 49 vignettes dans 350px = 7px chacune.

Le vrai sujet mobile de la timeline (portraits à 13px, 7/49 visibles, défilement molette/glissé sans barre visible) est un problème de **lisibilité et d'input tactile** → traité par le zoom ×1,5 pour la lisibilité, et renvoyé au **Lot 1 (tactile)** pour le geste de défilement.

> ⚠️ Limite du relevé : Chrome refuse de redimensionner une fenêtre sous ~500px de large — **360px n'a pas été mesuré par redimensionnement**. Chiffres pris à 846 et 501. Vérification à 360 en émulation d'appareil + téléphone réel de l'humain au human-testing.

## Approche

### A. Overlay d'orientation — « incitation par obstruction », pas un verrou
`@media (orientation: portrait)` + `pointer: coarse` → overlay plein écran masquant le jeu. **C'est la pratique dominante des jeux web**, pas un pis-aller : `screen.orientation.lock()` exige le fullscreen, et **iOS Safari ne supporte pas du tout l'API Screen Orientation** (le Fullscreen API n'existe que sur iPad, pas iPhone). Lock API + champ `orientation` du manifeste PWA = bonus best-effort en `try/catch`, jamais une dépendance.

À acter dans `docs/decisions.md` : le terme « verrouillage paysage » est trompeur — sur iPhone Safari rien n'empêche la rotation, l'overlay **obstrue** seulement.

### B. Recalibrer le second référentiel sur la hauteur — **validé : 1280×720, seuil hauteur, implémentation B1**
Ne pas inventer un mécanisme : **généraliser celui qui existe** et corriger son seuil.

1. Basculer le seuil de `width < 768px` vers un seuil de **hauteur** (`height < 500px`, à calibrer) — c'est ce qui discrimine réellement un téléphone en paysage (hauteurs 360→430) d'un desktop.
2. Porter le pattern aux composants du système 1 (journal, timeline, `battle-chrome`, tooltip, chips), pour ne pas laisser l'InfoPanel grossir ×2.5 pendant que la timeline reste à son ratio 1920.

Deux implémentations possibles, à trancher :

| | Où | Avantage | Inconvénient |
|---|---|---|---|
| **B1** | Bascule de `DESIGN_REFERENCE_WIDTH/HEIGHT` dans `game-stage.ts` sous un seuil (1920×1080 → 1280×720, même ratio 16:9) | **Un seul seuil pour tout le chrome**, cohérence garantie, corrige le système 1 d'un coup | Ne corrige pas le système 2 (les 3 `--xx-px` gardent leur seuil largeur) → il faut aligner les deux |
| **B2** | Répliquer le `@container stage (height < …)` dans chaque CSS du système 1 | CSS pur, homogène avec les 3 composants existants | Réplication dans ~6 fichiers, dérive possible (chacun son seuil) |

**Retenu : B1** — bascule dans `game-stage.ts` (1920×1080 → **1280×720**, même ratio 16:9) sous un seuil de **hauteur**, + réalignement des 3 seuils du système 2 sur le même critère et la même référence (ils sont aujourd'hui à `width < 768px` / référence 768, soit ×2,5 — incohérent avec le ×1,5 retenu). Seuil unique documenté dans `docs/design-system.md` comme convention à copier.

**Tension à documenter honnêtement** : le second référentiel introduit un **palier discret** — le chrome grossit d'un coup en franchissant le seuil, pas continûment. Ce n'est techniquement pas le plancher par-élément refusé le 2026-07-23 (rien ne cesse de scaler, la maquette reste homothétique, seul le point zéro du calcul change), mais c'est une rupture de continuité qu'il faut nommer pour ne pas la confondre plus tard.

**Écarté** : `clamp()` sur `--ui-scale` lui-même. Ça ferait dépasser le chrome de la taille du stage à petit écran (débordement ou chevauchement des panneaux) — le `min()` actuel garantit l'inverse.

### C. Menu d'actions et indicateur de tour sur le système scalé (constat 1) — **validé : maquette 34px**
`.tb-btn` est partagé Team Builder ↔ chrome de combat : **ne pas le convertir globalement**. Redéfinir ses tokens de taille localement dans le contexte du chrome (`.bc-root .tb-btn` ou modificateur dédié), avec une **taille de maquette de 34px** (alignée sur le nom du Pokemon de l'InfoPanel, 33px). Idem `.bc-top`/`.bc-turn`. Padding proportionnel à la même échelle.

### D. Timeline — rien à faire
Constat 2 retiré (faux). Voir § Correction. Lisibilité couverte par le zoom (B), geste de défilement tactile renvoyé au Lot 1.

### E. Plancher sur les hit-areas seulement (constat 3)
WCAG 2.2 SC 2.5.8 prévoit explicitement la **« spacing exception »** : une cible peut être visuellement plus petite que 24×24 si sa zone d'interaction atteint ce total. Donc :

- taille **visuelle** → continue de scaler (cohérent « tout scale ») ;
- **hit-area** → plancher absolu (24px WCAG minimum, 44px recommandé Apple / 48px Material) via padding transparent ou `min-block-size`/`min-inline-size` sur la zone cliquable, sous `@media (pointer: coarse)`.

**Le rendu à l'écran ne change pas** — c'est ce qui distingue ça du plancher de font-size refusé. À acter en décision.

Piège : un hit-area élargi ne doit pas chevaucher son voisin — sur un HUD dense ça peut demander d'espacer légèrement en absolu, donc un vrai micro-changement de layout, pas qu'une astuce CSS.

### F. Dialogs (constat 6)
Auditer les dialogs qui doivent scaler avec le jeu → les monter **dans `#game-stage`** (comme `battle-chrome.ts` le fait déjà) au lieu de `document.body`. Pas besoin d'un nouveau mécanisme ni de `--stage-scale` sur `:root` si la parenté est corrigée. Les modales hors combat (Team Builder) peuvent légitimement rester sur leurs tokens fixes.

⚠️ Piège de spec : les **container queries ne traversent pas** la frontière top-layer (`@container stage` ne matchera pas depuis un dialog promu), alors que les **custom properties héritées, si**. Donc pour un dialog, `--ui-scale` hérité est le seul canal fiable — pas `--xx-px` en `cqw`.

### G. Fondations viewport (constats 5, 7)
1. `viewport-fit=cover` au meta viewport — no-op sans usage d'`env()`, donc sans risque de régression, et **prérequis strict** pour tout le reste.
2. `env(safe-area-inset-left/right)` sur les panneaux ancrés aux bords **latéraux** (le cas paysage, pas `-top` comme la majorité des tutos), en `max(<design>, env(…))`. Canvas plein écran, insets sur les panneaux uniquement (*full-bleed + HUD offset*).
3. Supprimer le `100vh`/`100vw` inline de `#game-root` (`position:fixed; inset:0` suffit déjà). **Ne pas** passer en `dvh` : `dvh` se recalcule pendant l'animation de la barre d'URL → rafale de `ResizeObserver` → un resize moteur Babylon par frame. `svh` si une unité est nécessaire.

### H. Dette notée, non engagée ici
`--ui-scale` n'est **jamais relu en JS** (vérifié : zéro `getPropertyValue("--ui-scale")` dans le repo) — son calcul pourrait devenir du CSS pur (`min(100cqw/1920, 100cqh/1080)`, `container-type: size` déjà posé sur `#game-stage` en `game-overlay.css:26`), le `ResizeObserver` restant uniquement pour le resize Babylon. Gain de cohérence, **pas urgent** ; à ne pas mélanger avec ce chantier si B1 est retenu (B1 a justement besoin du JS).

## Hors périmètre

- **Sandbox Studio** (décision humaine).
- **Contrôles tactiles** (pinch, pan 2 doigts, tap-to-inspect, boutons de rotation) → **Lot 1**. Ce plan pose la fondation CSS, pas l'input.
- **Caméra adaptative selon la taille de carte** — écarté le 2026-07-22 (décision #706).
- **a11y** (headings/aria/focus + lint a11y Biome) et **auras** → items Lot 3 distincts.

## Étapes

1. ⬜ **Présenter à l'humain le choix B (seuil + B1/B2) et le rendu attendu, obtenir le go** — règle « Présenter avant d'agir ».
2. ⬜ Fondations G : `viewport-fit=cover`, purge du `100vh`, safe-area latérale.
3. ⬜ B : recalibrer le second référentiel sur la hauteur + aligner les 3 seuils existants. Vérification visuelle 360 / 390 / 846 / 1920 / 4K en émulation.
4. ⬜ C : menu d'actions + indicateur de tour.
5. ⬜ D : borner la timeline.
6. ⬜ E : planchers de hit-area sous `pointer: coarse`.
7. ⬜ F : parenté DOM des dialogs de combat.
8. ⬜ A : overlay d'orientation.
9. ⬜ Décisions à acter dans `docs/decisions.md` : palier discret du second référentiel vs plancher refusé ; plancher hit-area autorisé / plancher visuel interdit ; « obstruction » ≠ « verrouillage » ; seuil unique documenté dans `docs/design-system.md`.
10. ⬜ Human-testing (dont **téléphone réel**), e2e, gate CI.

## Risques

- **Régression desktop/4K** : toucher au référentiel de `--ui-scale` touche *tous* les écrans. `packages/app/src/styles/tokens-parity.test.ts` existe mais ne couvre pas l'échelle. Vérification 4K obligatoire (l'humain est sur 4K, et « app trop petite » est un retour connu).
- **`.tb-btn` partagé** : une modification globale casse le Team Builder. Cibler par contexte.
- **Calibrage du seuil de hauteur** : trop haut, il attrape des fenêtres desktop courtes et grossit le chrome à tort ; trop bas, il rate des téléphones. À valider sur plusieurs tailles réelles.
- **Paysage forcé sur iPhone Safari** : aucun verrou technique possible, seule l'obstruction visuelle. Risque produit assumé par la décision humaine, documenté.
