# Plan 189 — Panoramique clavier, menu de combat au placement, découvrabilité du défilement

> **Statut** : done (2026-08-26) — livré et **validé à la main, scénario par scénario** : clavier avec et sans pavé numérique (secours `Maj`+flèches), menu du placement (ouverture `☰` et `Échap` sans rien à annuler, les quatre entrées, les deux confirmations), glyphes sous les deux boutons et bloc de la timeline, glyphes de défilement du journal au débordement. **Six défauts trouvés et corrigés pendant la recette**, en plus de l'implémentation initiale. Décisions #843–#848, révisions de #807/#811/#791 (`docs/decisions.md`). Point resté **ouvert, non tranché** : la légende de contrôles caméra suit désormais la timeline (colonne latérale de l'ordre de jeu) quand sa case active se vide en prévisualisation de coût CT, ce que la décision #798 excluait — test e2e volontairement laissé rouge, voir `docs/next.md` § Reporté.
> **Créé** : 2026-08-26
> **Phase** : hors phase — solde les trois trous restants de `docs/next.md` § Reporté avant release
> **Cadre** : `docs/next.md` § Reporté / backlog technique, trois items ouverts par la recette du Lot 2
> **Dépend de** : plan 184 (couche d'actions logiques, `InputSystem`), plan 185 (légende de contrôles), plan 186 (magasin de bindings, écran de contrôles), plan 187 (menu de combat)

## Motivation

Trois trous restent ouverts après la clôture de la Phase 6.5. Ils sont réunis ici parce qu'ils sont
de la **même famille** — contrôles et découvrabilité, tous nés de la même session de recette — et
qu'ils partagent leurs fichiers (`bindings-store.ts`, `control-legend.ts`, `combat-screen.ts`). Trois
plans auraient demandé trois gates et trois recettes humaines pour un seul périmètre.

| Volet | Trou | Origine |
|---|---|---|
| **A** | Au clavier seul, la caméra ne se **déplace pas** : le panoramique n'existe qu'au stick droit et au glissé du doigt. | Sorti du plan 186 (décisions #807, #811) |
| **B** | Aucune sortie ni accès aux Paramètres pendant la **phase de placement** : le menu de combat naît après. | Sorti du plan 187 |
| **C** | Rien n'indique que la **liste d'ordre de jeu (timeline CT)** défile. | Revue design du plan 185, non traité |

## Décisions actées (humain, 2026-08-26)

| # | Question | Décision |
|---|---|---|
| 1 | Touches du panoramique clavier | **Pavé numérique** `Numpad8/2/4/6`, **remappables**. |
| 2 | Claviers sans pavé numérique | **Jeu de secours `Maj`+flèches**, **non remappable** — un portable doit pouvoir paner sans passer par l'écran de contrôles. |
| 3 | Collision `Numpad1/2/3` | **Libérés du zoom.** Les crans de zoom gardent `Digit1/2/3`, qui suffisent. Le pavé numérique devient « la caméra », la rangée de chiffres « les crans de zoom ». |
| 4 | Entrées du menu pendant le placement | **Reprendre / Paramètres / Recommencer / Quitter.** Pas d'« Abandonner » : il purge une sauvegarde qui n'existe pas encore à ce stade. |
| 5 | « Quitter » depuis le placement | **Avec confirmation** — les placements déjà faits sont perdus. |
| 6 | Forme de la découvrabilité du défilement | **Des glyphes de touche**, pas un indicateur graphique. Ni fondu ni chevrons sur les listes. |
| 7 | Découvrabilité de la timeline CT | Bloc de glyphes sous la légende de contrôles caméra, séparé par un petit espace, aligné sur la même grille. **Affiché en permanence** : la liste déborde **toujours**, même en 4K. |
| 8 | Découvrabilité du journal | La touche qui l'**ouvre** s'affiche **sous son bouton**. Les touches qui le **font défiler** s'affichent **dedans**, et **seulement quand il déborde** (contrairement à la timeline, il est vide en début de combat). |
| 9 | Découvrabilité du menu de combat | `Start` / `Échap` s'affichent **sous le bouton `☰`**, par la même règle. |
| 10 | Règle générale qui en découle | **Un bouton du chrome porte le glyphe de sa touche sous lui.** C'est la règle, pas trois cas particuliers — tout bouton ajouté plus tard s'y conforme. |

## Ce qui existe déjà — et qu'il ne faut pas réécrire

Vérifié à la lecture du code, 2026-08-26. Trois de ces points changent l'ampleur du travail :

- **Les 4 actions du panoramique existent** (`logical-action.ts:32-35`) et le routeur les traite déjà
  (`input-router.ts:146-155`, pas de `GAMEPAD_PAN_STEP_PX` = −8 px/frame). Le volet A n'ajoute donc
  **aucune action** et ne touche pas au routeur : il ajoute une *source*.
- **Le modèle continu existe côté manette** (`gamepad-source.ts:220-231`, boucle `requestAnimationFrame`
  de `startGamepadPolling`). Le volet A en est le miroir clavier, pas une invention.
- **« Recommencer » repart DÉJÀ au placement**, et le placement auto le rend invisible. `replay`
  (`combat-screen.ts:1273`) fait `teardown()` + `mountContent(host, params)`, qui refait
  `mountPlacement` ; depuis une reprise, `combat-screen.ts:1222` re-monte sans `resume`, donc même
  branche. Mais `team-select-screen.ts:48` coche **« Placement auto » par défaut**, et
  `placement-flow.ts:501` place alors tout d'un coup avant d'appeler `finish()` — sans phase
  interactive. **Rien à corriger** (question O1, tranchée).
- **Le point d'accrochage du menu au placement existe déjà** : `placement-flow.ts:496` porte
  `openCombatMenu: () => false`, avec le commentaire « le trou préexiste à ce plan et part en
  § Reporté ». Le volet B le branche au lieu de le créer.

## Volet A — panoramique caméra au clavier

### A1. Le modèle d'entrée continu

`input-system.ts` n'écoute que `keydown`, sans répétition : un appui produit **une** action. Un
panoramique a besoin d'être réémis tant que la touche est tenue. C'est exactement ce que la manette
fait déjà, et c'est le seul comportement continu du jeu — `logical-action.ts:29-30` le documente.

**Implémentation** : un jeu de codes maintenus + une boucle `requestAnimationFrame` dans une nouvelle
`keyboard-hold-source.ts`, à côté de `keyboard-source.ts` (qui reste la *lecture d'un événement*, sa
seule responsabilité aujourd'hui) :

- `keydown` sur une touche dont l'action est continue → ajout au jeu ; la boucle démarre si elle dort.
- `keyup` → retrait ; la boucle s'arrête quand le jeu se vide (pas de `rAF` qui tourne pour rien).
- **`blur` et `visibilitychange` vident le jeu.** Sans ça, `Alt+Tab` pendant un appui laisse une touche
  « collée » : le `keyup` part à l'autre fenêtre et la caméra dérive toute seule au retour.
- **Le contrôle focalisé est arbitré à l'ajout**, pas à chaque frame : `isClaimedByFocusedControl` est
  consulté au `keydown` comme pour toute autre touche. Un champ texte focalisé ne fait donc jamais
  paner. Si le focus change *pendant* le maintien, le `keyup` nettoie — écart assumé, il demande de
  changer de focus sans relâcher la touche.
**Où elle s'accroche** (précisé après revue de plan) : le plan 184 a réduit l'app à **un seul**
écouteur `keydown`, et ce plan n'en ajoute pas un second. Le découpage est donc :
`input-system.ts` reste le **propriétaire des écouteurs** — il alimente la source depuis son `onKeyDown`
existant, et enregistre les trois écouteurs qui n'existaient pas encore (`keyup`, `blur`,
`visibilitychange`) ; `keyboard-hold-source.ts` ne possède que **l'état et la boucle** (le jeu de
codes tenus, le démarrage/arrêt du `rAF`, l'émission). Aucune des deux ne lit le DOM que l'autre
écoute.

- **Amplitude** : le clavier est tout-ou-rien là où le stick est analogique. Un appui vaut donc
  l'amplitude pleine (`GAMEPAD_PAN_STEP_PX`), renommé en `PAN_STEP_PX` puisqu'il cesse d'être propre
  à la manette.

### A2. Les bindings

Dans `bindings-store.ts` :

1. **Le panoramique devient remappable.** Retirer les 4 actions de l'`Exclude` de `RemappableAction`
   (ligne 51) et **réécrire le commentaire qui les excluait** (lignes 43-48) : sa justification
   (« une touche qu'on lui assignerait ne ferait rien ») tombe avec le volet A1.
2. **Défauts clavier** : `Numpad8` / `Numpad2` / `Numpad4` / `Numpad6`, slot 0.
3. **Défauts manette** : `null` — le panoramique est le **stick droit**, un axe. Nouvelle liste
   `GAMEPAD_STICK_ACTIONS`, sur le modèle de `GAMEPAD_AXIS_ACTIONS` : annoncé dans l'écran de
   contrôles, jamais assignable à un bouton. `acceptsGamepadBinding` l'exclut.
4. **Zoom** : `ZoomLevel1/2/3` passent de `[Digit1, Numpad1]` à `[Digit1, null]` (idem 2 et 3).
5. **Jeu de secours fixe** : nouvelle table `FALLBACK_KEY_BINDINGS` (`Maj+ArrowUp/Down/Left/Right` →
   les 4 actions de panoramique), fusionnée dans `keyboardLookup()` **en repli uniquement**.

> ⚠️ **Le repli ne gagne jamais contre un binding du joueur.** Si quelqu'un assigne `Maj+↑` à une autre
> action, c'est son assignation qui s'applique — sinon le jeu lui volerait sa touche en silence. La
> table de secours n'est donc consultée que lorsque le lookup principal ne répond rien.
>
> Aucune collision aujourd'hui : les défauts n'utilisent `Maj` que sur `Tab` (cible précédente) et
> `PageUp`/`PageDown` (journal). Les `Maj`+flèches sont libres.

Le secours est **non remappable et non capturable** : il ne passe pas par `assign()`, l'écran de
contrôles l'affiche en lecture seule. Ce n'est pas le mécanisme de `FIXED_ACTIONS` (qui dit « cette
*action* ne se réassigne pas ») mais un second jeu qui **coexiste** avec le binding remappable —
concept neuf, à nommer explicitement dans le module.

### A3. Ce que ça rouvre

Les décisions **#807 et #811** avaient sorti le panoramique du remappage *et* de l'écran de contrôles
parce qu'il n'existait qu'au stick. Elles sont **révisées** : les 4 actions reviennent dans l'écran de
contrôles (`controls-panel.ts` / `controls-screen.ts`) et dans la légende. `docs/decisions.md` porte
la révision, pas une décision neuve qui contredirait l'ancienne sans le dire.

**Livré en deux temps.** L'écran de contrôles à l'implémentation ; la **légende** le 2026-08-27, après
coup — les 4 entrées auraient triplé la largeur d'une ligne, et le dessin d'action n'était pas tranché.
Forme retenue : **un** dessin (croix de déplacement, feuille des curseurs colonne 5 ligne 0, choisie
par l'humain) suivi des **quatre** touches, au lieu d'une entrée par direction comme la rotation et le
zoom — leur dessin change avec la direction, la croix dit déjà les quatre sens. À la manette la ligne
bascule vers le stick droit à 4 directions ; au doigt elle disparaît, le plateau s'y fait glisser à
deux doigts.

## Volet B — menu de combat pendant le placement

### B1. Pourquoi il n'existe pas

`combat-screen.ts:304-310` le dit : le menu naît dans `runBattle`, « la seule fonction qui possède à
la fois le `screenLayer`, les deux sorties du chrome et la registration d'entrée du combat ». Le
placement est monté **avant**, par `mountPlacement` → `startPlacementFlow`. Pendant qu'on pose ses
Pokemon : pas de bouton `☰`, `Start` inerte, aucune sortie, aucun accès aux Paramètres.

### B2. Une seconde instance, avec ses propres sorties

`mountContent` monte une deuxième `createCombatMenu` pour la durée du placement, détruite quand
`runBattle` prend la main (le combat monte la sienne — jamais deux vivantes à la fois) :

| Entrée | Comportement | Confirmation |
|---|---|---|
| Reprendre | Referme. Indispensable au doigt, qui n'a ni `Échap` ni `B`. | — |
| Paramètres | Les mêmes panneaux réutilisables que le plan 187 (décision 4). | — |
| Recommencer | Remet le placement à zéro (`teardown()` + `mountContent(host, params)`). | **Oui** — détruit les placements faits |
| Quitter | `navigate("main-menu")`. Aucune sauvegarde à purger : le combat n'a pas commencé. | **Oui** (décision 5) |

Pas d'« Abandonner » : il purge une sauvegarde qui n'existe pas encore. Une entrée qui mènerait au
même endroit que « Quitter » n'apprendrait rien au joueur.

### B3. Les deux entrées, et le conflit d'`Échap`

- **Bouton `☰`** : la rangée haut-droite (`createBattleLogRow`) naît elle aussi dans `runBattle`. Le
  placement a besoin de sa propre rangée réduite — `☰` et le plein écran, **pas** le journal (aucun
  journal pendant le placement).
- **`Start` / `Échap`** : `placement-flow.ts:400` a déjà sa registration d'entrée ; il suffit d'y
  ajouter `openCombatMenu`.
- ⚠️ **`Échap` sert déjà à défaire le dernier placement** (`undoLastPlacement`). Même règle qu'en
  combat, donc : `Échap` ouvre le menu **seulement quand il n'a rien à annuler** — le miroir exact de
  `orchestrator.onEscape() || combatMenu.open()` (`combat-screen.ts:559`).

## Volet C — découvrabilité : un glyphe de touche sous chaque contrôle

### C1. La règle, plutôt que trois cas

Le retour humain du 2026-08-26 a élargi le périmètre, et c'est ce qui le rend cohérent : au lieu de
traiter la timeline seule, **chaque bouton du chrome porte le glyphe de sa touche sous lui**, et chaque
liste qui défile annonce ses touches de défilement. Un joueur qui découvre un bouton découvre son
raccourci au même endroit, sans manuel et sans aller voir l'écran de contrôles.

| Cible | Ce qui s'affiche | Où | Quand |
|---|---|---|---|
| Ordre de jeu (timeline CT) | défilement (`Page↑`/`Page↓`, `R3+↑/↓` au pad) | bloc sous la légende caméra | **toujours** (décision 7) |
| Bouton Journal | ouverture (`J`) | sous le bouton | toujours |
| Journal ouvert | défilement (`Maj+Page↑/↓`) | dedans | **seulement s'il déborde** (décision 8) |
| Bouton `☰` Menu | `Start` / `Échap` | sous le bouton | toujours |

### C2. Ce qu'on ne fera pas

`turn-timeline.css:43` masque la barre de défilement **volontairement** : « it read as a stray
right-edge border on hover ». Le remède ne peut donc pas être de la rendre visible. Fondu et chevrons
ont été écartés au profit des glyphes.

### C3. Le bloc de la timeline

`control-legend.ts` dessine déjà deux lignes sous la boussole (rotation, zoom), chaque entrée étant un
couple `[dessin][touche]`, positionnées depuis la mesure partagée de `chrome-insets.ts`. On y ajoute un
**troisième bloc**, séparé des deux premiers par un petit espace, même grille :

- deux nouveaux rôles `ScrollTimelineUp` / `ScrollTimelineDown` dans `Role` + `ROLE_DRAWING` ;
- à la manette, `data-input-source` fait basculer les caps vers le geste `R3 + ↑/↓`, déjà déclaré dans
  `GAMEPAD_GESTURE_ACTIONS` — le mécanisme existe, il n'y a que la ligne à ajouter.

Affiché en permanence (décision 7) : la capture du 2026-08-26 montre plus de trente vignettes coupées
net en bas de l'écran, et l'humain confirme que ça déborde même en 4K. Aucune condition à calculer.

### C4. Les glyphes sous les boutons

La rangée est construite par `createBattleLogRow` (`battle-log.ts:62`), qui n'est aujourd'hui qu'un
`append` de ses enfants. Chaque bouton gagne un glyphe **sous** lui — même feuille Kenney, même échelle
que la légende, pour que les deux zones se lisent comme un seul système.

⚠️ **Le glyphe du menu ne se lit pas dans son binding.** `OpenCombatMenu` n'a **aucun défaut clavier**
(`DEFAULT_BINDINGS` : `[null, null]`) — c'est `Échap` qui l'ouvre, *quand il n'a rien à annuler*, et
`Échap` est le binding de `Cancel`. Donc : afficher la touche de `OpenCombatMenu` **si le joueur en a
assigné une**, sinon celle de `Cancel`. Écrire `Escape` en dur ferait mentir la légende dès le premier
remappage.

**Où ce repli vit** (précisé après revue de plan) : dans `key-legend.ts`, côté app, avec le reste de la
résolution position → caractère. Une fonction dédiée (`openCombatMenuKey()`) plutôt qu'un `??` chez
l'appelant : la règle « `OpenCombatMenu`, sinon `Cancel` » est une **règle de produit**, pas un détail
d'affichage, et deux appelants (le glyphe du bouton et l'écran de contrôles) doivent en donner la même
réponse. `ui-dom` reste ignorant des bindings, comme le plan 185 l'a établi — il reçoit un caractère.

⚠️ **`Échap` promet du conditionnel.** Il n'ouvre le menu que lorsqu'il n'a rien à annuler. Le glyphe
l'annonce quand même, sans quoi le joueur ne trouverait jamais le raccourci — mais c'est un écart
assumé entre ce qui est dessiné et ce qui se produit à cet instant précis.

### C5. Le défilement dans le journal, seulement au débordement

« Je ne sais pas comment » (humain, 2026-08-26) — la mesure est `scrollHeight > clientHeight` sur
`.bl-list`, réévaluée quand le contenu change (le journal réécrit sa liste à chaque entrée) et à un
`ResizeObserver` pour le redimensionnement de la fenêtre. Pas de sondage par frame.

L'asymétrie avec la timeline (permanent) est **voulue et justifiée** : la timeline déborde toujours,
le journal est **vide** en début de combat et annoncerait un contrôle qui ne fait rien.

### C6. Les tuiles — relevées le 2026-08-26, l'obstacle est ailleurs

Relevé sur `packages/app/public/assets/ui/input-prompts/tilemap-1bit.png` (34 × 24 tuiles de 16 px),
crops vérifiés à l'œil :

| Glyphe | Colonne | Ligne | Largeur |
|---|---|---|---|
| `ESC` | 17 | 0 | **1 tuile** |
| `PAGE↑` | **23-24** | 6 | **2 tuiles** |
| `PAGE↓` | **25-26** | 6 | **2 tuiles** |

Les glyphes existent donc tous : la crainte du cap vierge tombe. Ce qui reste est un **obstacle de
rendu**, pas de contenu.

> ⚠️ **Il faut supporter les capuchons de 2 tuiles — ce qui RÉVISE la décision #791.**
> `docs/references/kenney-input-prompts-tileset.md` (§ Capuchons) déclare aujourd'hui : « Touches de
> plus d'une tuile (Entrée, Espace « grand format », retour arrière, ALT/TAB/CTRL/SHIFT) :
> **inutilisables** par un masque d'une tuile — c'est pourquoi le tenant-lieu générique est la barre
> d'espace « petit format » ». `keyCap()` et le CSS masquent un carré de 16 × 16.
> Le remède : une variante de capuchon **large**, dont le masque fait 32 × 16 et dont la boîte suit —
> `--cl-cap-span` (1 ou 2), lu par le CSS pour la largeur *et* pour la fenêtre du masque. La décision
> #791 reste vraie pour ce qu'elle visait (un cap large ne rentre pas dans un masque d'une tuile) ;
> ce plan lève la limite au lieu de la contourner, et la doc du tileset doit être corrigée en
> conséquence — sans quoi elle continuerait d'annoncer un trou qui n'existe plus.

### C7. Le glyphe manette du menu de combat

⚠️ **`SL` / `SR` ne conviennent pas** (retour humain 2026-08-26, à écarter explicitement) : ce sont les
gâchettes **latérales d'un Joy-Con détaché**, tenu à l'horizontale pour jouer à deux. Une manette
Switch Pro — celle de la recette — n'en a pas. Les dessiner pour « Start » désignerait un bouton que
le joueur n'a pas sous les doigts.

Le bouton du menu est l'index **9** en mapping standard W3C, dont le nom change avec le constructeur :
`+` sur Switch, Menu sur Xbox, Options sur PlayStation. La feuille couvre les deux registres (famille
relevée : `+` / `−` et les boutons génériques `≡` / `⋯`, lignes 20-23 — **colonnes exactes à relever à
l'étape E2**, comme le plan 185 l'a fait pour les capuchons).

**Choix** : `isNintendoLayout()` existe déjà (`gamepad-source.ts:61`, il sert à l'échange A/B) — le
glyphe suit donc le pad détecté, `+` sur Nintendo et `≡` ailleurs, plutôt qu'un dessin unique qui
serait faux sur la moitié du matériel.

## Questions ouvertes — résolues le 2026-08-26

| # | Question | Résolution |
|---|---|---|
| **O1** | « Recommencer » du menu de combat ne semble pas repasser par le placement. | **Pas un bug.** Le menu repart bien au placement (`combat-screen.ts:1273`) — mais **« Placement auto » est coché par défaut** (`team-select-screen.ts:48`, `let autoPlacement = true`), et `placement-flow.ts:501` place alors tout d'un coup puis appelle `finish()` sans phase interactive. Le placement a lieu, il est simplement instantané. **Rien à corriger** ; voir la note de conception ci-dessous. |
| **O2** | Le bloc annonce-t-il aussi le journal ? | **Oui, mais ailleurs** : sous son propre bouton, pas dans la légende caméra — ce qui a fait naître la règle générale de la décision 10. |
| **O3** | Bloc permanent ou conditionnel ? | **Permanent pour la timeline** (elle déborde toujours, 4K comprise), **conditionnel pour le journal** (vide en début de combat). |

### Note de conception issue de O1 (hors périmètre, à trancher un jour)

« Placement auto » coché par défaut rend la phase de placement **invisible au premier lancement** : un
joueur qui découvre le jeu ne sait pas qu'elle existe, et le volet B lui offre un menu pendant une
phase qu'il ne verra jamais. Ce n'est pas un bug et ce plan n'y touche pas — mais le défaut mérite
d'être rediscuté quand la question du premier contact reviendra.

## Étapes

| Étape | Contenu | Fichiers principaux |
|---|---|---|
| **A** | Modèle d'entrée continu au clavier | `input/keyboard-hold-source.ts` (neuf), `input/input-system.ts` |
| **B** | Bindings : panoramique remappable, numpad, secours fixe, zoom libéré | `input/bindings-store.ts`, `input/input-router.ts` (renommage du pas) |
| **C** | Écran de contrôles + légende : les 4 actions reviennent | `ui/dom/panels/controls-panel.ts`, `ui/dom/screens/controls-screen.ts`, `input/key-legend.ts` |
| **D** | Menu de combat pendant le placement | `babylon/combat-screen.ts`, `babylon/placement-flow.ts`, `ui/dom/combat-menu.ts` |
| **E1** | Bloc de glyphes de défilement de la timeline | `ui-dom/control-legend.ts`, `ui-dom/styles/control-legend.css` |
| **E2** | Glyphes sous les boutons Journal et `☰` Menu | `ui-dom/battle-log.ts`, `ui-dom/combat-menu-button.ts`, `babylon/combat-screen.ts` |
| **E3** | Glyphes de défilement dans le journal, au débordement | `ui-dom/battle-log.ts`, `ui-dom/styles/battle-log.css` |
| **F** | Tests, recette humaine, doc — voir le détail ci-dessous | — |

### Détail de l'étape F (précisé après revue de plan)

Trois corrections de doc sont **nommées**, pour qu'aucune ne se décide au moment de l'écrire :

| Fichier | Correction |
|---|---|
| `docs/decisions.md` | **#807 et #811** : ajouter une section « Révisé au plan 189 » **sous les décisions existantes**, sans réécrire leur texte d'origine — leur raisonnement était juste au moment où il a été tenu (le panoramique n'existait qu'en continu), c'est sa **prémisse** qui a changé. Une décision neuve qui les contredirait en silence rendrait l'historique illisible. |
| `docs/decisions.md` | **#791** : même forme. Le tenant-lieu générique reste la barre d'espace pour tout ce qui n'a pas de capuchon ; ce qui est levé, c'est l'impossibilité de dessiner un capuchon **large**. |
| `docs/references/kenney-input-prompts-tileset.md` | § **Capuchons de touches** : remplacer la phrase « Touches de plus d'une tuile … **inutilisables** par un masque d'une tuile » par le support `--cl-cap-span`, et **consigner le relevé du 2026-08-26** dans la table des tuiles (`ESC` (17, 0) 1 tuile ; `PAGE↑` (23-24, 6) 2 tuiles ; `PAGE↓` (25-26, 6) 2 tuiles) + les colonnes de `+` / `−` / `≡` relevées à l'étape E2. Sans ça la doc continuerait d'annoncer un trou refermé, et le prochain plan referait le relevé. |

Plus les mises à jour habituelles : `docs/test-plan.md` (cases 🤖/👁 et §11), `docs/next.md`, `STATUS.md`.

## Risques

- **La touche collée** (A1) est le piège classique du modèle continu : `blur`/`visibilitychange` sont
  dans le périmètre, pas une amélioration ultérieure.
- **Deux menus vivants à la fois** (B2) : si le menu du placement survit à `runBattle`, deux
  registrations d'entrée se disputent `Start`. Le passage de relais doit être testé, pas supposé.
- **Le capuchon large** (C6) : les glyphes existent, mais `PAGE↑`/`PAGE↓` font 2 tuiles et le rendu
  n'en sait dessiner qu'une. Retomber sur le cap vierge « parce que ça ne rentre pas » livrerait un
  volet C muet. La décision #791 est levée, pas contournée — et la doc du tileset corrigée avec.
- **Le glyphe manette faux** (C7) : `SL`/`SR` désigneraient un bouton absent d'une Switch Pro.
- **La légende devient un système, plus une exception** (décision 10) : quatre zones doivent partager
  échelle, feuille et espacement, sinon le chrome se lit comme quatre bricolages voisins.
- **Régression du zoom** (A2) : `Numpad1/2/3` disparaissent des défauts. Un joueur qui les utilisait
  perd son raccourci sans rien avoir remappé — à annoncer dans le changelog de release.

## Tests

- **Unitaires** : `keyboard-hold-source` (ajout/retrait, arrêt de boucle, purge au `blur`), repli
  `FALLBACK_KEY_BINDINGS` battu par un binding du joueur, `acceptsGamepadBinding` sur les actions de
  stick, absence de `Numpad1/2/3` dans les défauts, glyphe du menu qui suit `OpenCombatMenu` puis
  retombe sur `Cancel`, détection de débordement du journal.
- **e2e** : panoramique au maintien d'une touche du pavé numérique ; menu du placement (ouverture par
  `☰` et par `Échap` sans rien à annuler, les quatre entrées, les deux confirmations) ; présence des
  glyphes sous les deux boutons et du bloc de la timeline ; apparition des glyphes de défilement du
  journal **seulement** une fois qu'il déborde.
- **Recette humaine** : clavier **avec et sans pavé numérique** (le secours est là pour ça), manette
  Switch Pro filaire, doigt sur téléphone réel. ⚠️ Décocher « Placement auto » à la sélection d'équipe
  pour que la phase de placement soit visible — sinon le volet B ne peut pas être testé.
