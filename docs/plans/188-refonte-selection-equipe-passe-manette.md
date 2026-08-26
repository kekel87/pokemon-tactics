# Plan 188 — Refonte de l'écran de sélection d'équipe + passe manette (Team Builder & modales)

> **Statut** : done (2026-08-26) — recette humaine terminée, **5 scénarios sur 5 validés** (clavier et manette Switch Pro), code-review traitée. Reste : gate CI, commit définitif.
> **Créé** : 2026-08-25
> **Phase** : hors phase — chantier issu de la validation du Lot 2 (plan 184)
> **Cadre** : `docs/next.md` § Reporté, « Chantier dédié : refonte de l'écran de sélection d'équipe » (ouvert 2026-08-21) + volet manette demandé le 2026-08-25
> **Dépend de** : plan 184 (couche d'actions logiques, navigation spatiale du focus, `isClaimedByFocusedControl`), plan 186 (magasin de bindings, `data-nav-skip`), plan 187 (extraction de panneaux, pile de registrations)

## Motivation

Deux problèmes distincts, réunis parce qu'ils partagent une cause : **l'entrée clavier/manette a été câblée par-dessus des écrans conçus à la souris.**

**Volet 1 — l'écran de sélection d'équipe.** Le câblage du Lot 2 a rendu visibles trois défauts qui ne sont pas des défauts d'entrée mais de **conception d'écran** (retour humain 2026-08-21) : les formats de combat sont un niveau de plus à comprendre, la bascule Humain / IA ne dit pas ce qu'elle change, et le comportement du joueur actif est illisible. L'humain a explicitement demandé un plan à part plutôt qu'un rafistolage au coup par coup.

**Volet 2 — le Team Builder et ses modales.** Jamais éprouvés à la manette. L'audit (2026-08-25, ci-dessous) montre que **les trois sélecteurs sont morts au pad** : on ouvre le sélecteur de Pokemon et on ne peut rien choisir, ni filtrer, ni même refermer la modale. C'est plus grave que le volet 1 — c'est une impasse, pas une gêne.

## Audit — état constaté (2026-08-25)

### Écran de sélection d'équipe (`packages/app/src/ui/dom/screens/team-select-screen.ts`, 297 l.)

Mise en page actuelle : `ts-header` (`Retour` + titre + `<select>` de format) / `ts-main` en trois colonnes (`ts-players-column[side=left]`, `ts-team-list` centrale, `ts-players-column[side=right]` si plus de 6 joueurs) / `ts-footer` (case `Placement auto`, `Régénérer IA`, `Lancer`).

| Symptôme (retour humain) | Cause dans le code |
|---|---|
| Les formats sont un niveau de plus | `createFormatPickerElement` (`ui/team-select/FormatPicker.ts`) produit un `<select>` natif dans le header. Le choix est **replié** : le format actif n'est lisible qu'en ouvrant la liste. C'est aussi le pire contrôle possible au pad — `activateFocusedControl()` fait `.click()`, ce qui n'ouvre pas la liste native d'un `<select>` de façon fiable |
| Humain / IA ne dit pas ce que ça change | `ts-player-cell-controller` (`PlayerCell.ts`) est un `<button>` qui bascule son propre texte. Aucun libellé de conséquence, aucune icône, aucun des deux états n'est visible tant qu'on n'a pas cliqué pour voir l'autre |
| Le joueur actif est illisible | `activeSlotIndex` est une variable interne de l'écran, matérialisée par `data-active` sur une cellule qui est un `<div role="button" tabindex="0">`. Elle est **indépendante du focus DOM** que le plan 184 a introduit : la liste centrale assigne à `activeSlotIndex`, pas à la cellule focalisée. Deux curseurs coexistent à l'écran et se contredisent |

Effet de bord de la structure : `focusInDirection` (navigation spatiale) fait ce qu'elle peut sur une mise en page 2D à contrôles hétérogènes (case à cocher, `<select>`, `<div>` faux boutons, `<button>`), mais c'est la structure qui devrait guider.

### Team Builder et modales

Le socle du plan 184 est sain et n'est pas remis en cause : `focusInDirection` fait de la navigation spatiale, `focusableControls()` se restreint au `dialog[open]` quand il y en a un, et `isClaimedByFocusedControl` (`input/keyboard-source.ts:53`) arbitre correctement `<select>` / slider / champ texte.

⚠️ **Cet audit s'est trompé sur les écrans eux-mêmes.** Il affirmait que `TeamEditView`, `EditLeftPanel`, `EditRightPanel`, `SlotCardsRow`, `TeamCard` et `MyTeamsView` « utilisent de vrais `<button>` / `<input>` / `<select>`, ils sont navigables » — conclusion tirée d'un **comptage de créations d'éléments**, pas d'un examen de **quels** contrôles portent l'action. Trois familles étaient des `<div>` cliquables, et le test humain du 2026-08-26 l'a montré : ligne d'objet, lignes de capacité, lignes du menu des builds. Corrigé par la décision #838. La leçon vaut au-delà de ce plan : compter les `createElement("button")` ne dit rien de la navigabilité d'un écran.

Les trous sont concentrés sur les **modales** et sur le **chemin manette** :

| # | Trou | Détail |
|---|---|---|
| **A** | **Les sélecteurs sont morts au pad** | `PokemonPickerModal`, `MovePickerModal`, `ItemPickerModal` : les chips de filtre (`tb-filter-chip`) et les lignes de résultat (`tb-list-row`, cartes de la grille de Pokemon) sont des `<div>` **sans `tabindex`**. Le sélecteur de `focusableControls()` ne matche que `button:not(:disabled), input…, select…, textarea…, [tabindex='0']` → dans une modale de sélection, **seuls le champ de recherche et le `×` sont atteignables**. Rien à choisir, rien à filtrer |
| **B** | **B ne ferme pas une modale** | `bindScreenInput.cancel` (`ui/dom/screens/elements.ts`) retourne `false` dès qu'un `dialog[open]` existe, en laissant volontairement `Échap` au `<dialog>` natif. Au clavier c'est correct ; **à la manette il n'y a pas d'`Échap`** — donc aucune sortie. Combiné à **A**, on entre dans une modale et on y reste |
| **C** | **Le pad ignore l'arbitrage du contrôle focalisé** | `isClaimedByFocusedControl` n'est appelé que dans le chemin clavier (`input/input-system.ts:98`, via `event.target`). Le chemin manette ne le consulte pas. Conséquences : un slider SP (`<input type="range">`, `EditRightPanel.ts:156`) voit ← → déplacer le focus au lieu de régler la valeur, donc est **inréglable au pad** ; le `<select>` de Nature (`EditLeftPanel.ts:344`) ne s'ouvre pas |
| **D** | **Cul-de-sac à l'ouverture** | `focusSearchUnlessTouch` (`ui/team/picker-focus.ts`) met le focus dans le champ de recherche. Le test porte sur `(pointer: coarse)`, donc une manette sur desktop **prend le focus texte** — où elle ne peut pas taper. On entre dans la modale déjà coincé |
| **E** | **Les onglets de la modale Showdown sont morts au pad** | Trouvé par la revue de plan, vérifié : `ShowdownIoModal.ts:25-31` construit les onglets `Importer` / `Exporter` en `<div class="tb-showdown-tab">` avec un `click` — non focalisables, donc **impossible de basculer d'onglet au pad**. Aggravant : l'état désactivé est posé en style en ligne (`importTab.style.pointerEvents = "none"`, `:141-144`), pas par un attribut `disabled` — donc la conversion en `<button>` doit aussi porter la désactivation sur l'attribut, seul moyen pour que `focusableControls()` l'exclue via son `:not(:disabled)` |
| **F** | **Chaque interaction détruit le focus** | Trouvé en vérifiant la revue de conception, non signalé par les deux revues. `render()` (`team-select-screen.ts`) fait `root.replaceChildren(buildHeader(), buildMain(), buildFooter())` — un **rebuild complet** — et il est appelé par *toutes* les mutations d'état : `setActive`, `toggleController`, `assignTeam`, `onFormatChange`, `refreshAllAi`. `.claude/rules/html.md:58-59` interdit précisément ça (« un handler qui reconstruit tout son sous-arbre éjecte le focus vers `<body>` : au clavier ou à la manette, la navigation repart de zéro »). **Conséquence aujourd'hui** : basculer Humain / IA au pad renvoie le focus au `<body>`, il faut re-naviguer depuis le début. **Conséquence pour ce plan** : le segment de #831 est fait pour être pressé souvent, et les segments de format aussi — les livrer sur ce `render()` les rendrait pires que le bouton qu'ils remplacent |

Vérifié au passage : `ClearTeamConfirmModal` et `DeleteConfirmModal` n'ont que de vrais `<button>` — rien à y faire.

Le `<dialog>` partagé (`packages/ui-dom/src/Modal.ts`) est correct : `showModal()`, piège de focus natif, restauration du focus précédent à la fermeture. Rien à y refaire côté structure.

**Acquis gratuit pour l'étape A** : `gamepad-source.ts` fait déjà **répéter une direction maintenue** (`REPEAT_DELAY_FRAMES = 23`, puis toutes les 6 frames ≈ 380 ms d'attente puis une cadence de 100 ms). Un ← maintenu sur un slider produira donc une glissade correcte **sans code de maintien à écrire** — c'est précisément le modèle d'entrée continu qui manque au clavier pour le panoramique caméra (`docs/next.md` § Reporté), et qui existe déjà côté manette.

## Décisions de cadrage (humain, 2026-08-25)

Les quatre premiers arbitrages ont été tranchés avant rédaction ; #834 et #835 le sont après les deux revues, qui ont exposé un coût et un libellé que le cadrage initial n'avait pas vus.

### #830 — Les formats deviennent une rangée de segments toujours visible

Le `<select>` du header devient une rangée de boutons-segments (`1v1  2v2  3v3  4v4`), l'actif surligné. Le format cesse d'être un niveau replié : il est **lu en permanence**, et un appui suffit à le changer. Bénéfice d'entrée gratuit : ce sont des `<button>` ordinaires, donc le cas particulier du `<select>` au pad disparaît de cet écran.

Rejeté : fusionner le format dans l'écran de sélection de carte (la grille de cartes gonflerait d'un facteur égal au nombre de formats) ; dériver le format du nombre de joueurs ajoutés (imposerait que chaque carte accepte tous les effectifs, ce que les `objectgroups` de spawns par format ne garantissent pas — cf. `spawns-1v1`… un layer par format).

### #831 — Humain / IA est un segment à deux états, les deux visibles

`ts-player-cell-controller` cesse d'être un bouton qui bascule son texte. Il devient un segment `🎮 Humain | 🤖 IA` où **les deux états sont affichés en permanence**, l'actif surligné. On voit ce qu'on choisit avant de le choisir, au lieu de deviner ce que le bouton va devenir.

Rejeté : ajouter une phrase de conséquence sous le segment (hauteur de cellule, et le segment lui-même suffit une fois les deux états visibles) ; fixer le type à l'ajout du joueur (dépendait du format dérivé, écarté par #830).

### #832 — La notion de « joueur actif » est supprimée : chaque cellule ouvre le sélecteur d'équipe

C'est la décision structurante du volet 1. `activeSlotIndex` disparaît, la liste d'équipes centrale permanente disparaît de `ts-main`. Activer une cellule de joueur ouvre une **modale de choix d'équipe** ; on choisit, elle se ferme, l'équipe est posée sur cette cellule.

Pourquoi : le défaut « le comportement du joueur actif est illisible » n'est pas un défaut de rendu du curseur, c'est **deux curseurs pour un seul geste**. Le focus DOM (plan 184) et `activeSlotIndex` (plan 120) désignent tous deux « la cellule concernée » et peuvent diverger à l'écran. En supprimant l'un, la contradiction devient impossible à écrire — pas seulement moins visible. Le pattern est déjà celui des trois sélecteurs du Team Builder, donc il ne coûte pas un concept de plus au joueur.

Conséquence assumée : on perd la **lecture d'ensemble** (voir toutes les équipes disponibles et leurs badges d'assignation en même temps que les joueurs). Les badges d'assignation migrent dans la modale, qui est le seul endroit où ils informent une décision.

Rejeté : lier `activeSlotIndex` au focus DOM (garde la lecture d'ensemble, mais garde aussi une mise en page 2D à deux panneaux, précisément ce que la navigation directionnelle générique traverse mal) ; garder la mécanique et renforcer le visuel (laisse les deux curseurs).

### #833 — La passe manette est traitée en entier, cahier de recette compris

Les quatre trous **A / B / C / D** sont dans le périmètre, et la suite e2e + `docs/test-plan.md` sont étendus pour couvrir la navigation au pad dans les sélecteurs. Motif : le trou **A** est exactement le genre de régression qu'aucun test ne voyait — des `<div>` non focalisables passent tout le gate.

### #834 — Après une sélection d'équipe, le focus va au prochain camp non assigné

Écart **assumé** à `.claude/rules/html.md:51-52` (« après fermeture, le focus revient à l'élément déclencheur »).

Motif : #832 supprime l'avance automatique de camp que faisait `assignTeam` (`team-select-screen.ts:89-98`, `activeSlotIndex += 1`). Sans compensation, configurer les camps à la main passe de N gestes à ~2N — et le vrai maximum est **12 camps**, pas 4. La convention `<dialog>` vise la modale **refermée sans rien faire** : le focus revient là où on était parce que rien n'a bougé. Ici l'action a **abouti** et a déplacé le travail d'un cran ; renvoyer le focus au camp qu'on vient de remplir ferait re-parcourir la liste à chaque fois.

Portée exacte : uniquement sur **sélection réussie**. Une modale fermée par `Échap`, par B ou par le `×` rend le focus au camp déclencheur, comme la convention l'exige — c'est le cas « rien n'a bougé », et c'est le même code que les trois sélecteurs du Team Builder.

Rejeté : respecter la convention et assumer la perte (le multi-local à beaucoup de camps est précisément le mode que la Phase 7 va servir) ; une assignation en lot dans la modale (ajoute un contrôle et un concept pour contourner un problème de focus).

### #835 — Les libellés de format deviennent `2J × 6`, sous un libellé de rangée « Joueurs × Pokemon »

Les libellés actuels sont `2v6  3v4  4v3  6v2  12v1` — vérifié, identiques sur les 9 cartes (`buildFormatKey` = `` `${teamCount}v${maxPokemonPerTeam}` ``, et `maxPokemonPerTeam = min(cases de la zone de spawn, floor(12 / camps))`, où c'est le second terme qui mord partout). Ils portent la bonne information — 2 joueurs à 6 Pokemon, 3 à 4, 4 à 3, 6 à 2, 12 à 1 — mais `2v6` **se lit** « deux contre six », un affrontement déséquilibré.

Nouvelle forme : `2J × 6`, `3J × 4`, `4J × 3`, `6J × 2`, `12J × 1`, la rangée étant titrée « Joueurs × Pokemon » (le libellé qui rend le `J` lisible sans légende séparée). Le `×` lève l'ambiguïté du `v`, l'ordre joueurs-puis-Pokemon est conservé, et la forme tient sur un segment étroit — donc sur téléphone, où la rangée de #830 doit rentrer.

C'est dans le périmètre parce que #830 réécrit `FormatPicker` de toute façon, et parce que rendre les formats **visibles en permanence** est précisément ce qui expose le libellé. `buildFormatKey` reste inchangé : c'est une **clé** (elle identifie le format dans `formatKey` et voyage jusqu'au `CombatSetup`), pas un libellé. Seul le `label` de `FormatOption` change.

Rejeté : la convention Pokemon (`6v6`, `4v4v4`, `3v3v3v3`) — juste et familière jusqu'à 4 camps, mais `2v2v2v2v2v2` est illisible et 12 camps ne s'écrit pas du tout, ce qui imposerait deux vocabulaires ; le libellé sur deux lignes (`2 joueurs` / `6 Pokemon`) — le plus explicite, mais coûte de la hauteur dans le header que le responsive du plan 179 s'est employé à préserver.

## Périmètre

**Dans le périmètre**

- Refonte de `team-select-screen.ts` et de ses composants `ui/team-select/*` selon #830, #831, #832.
- Nouvelle modale de choix d'équipe (réutilise `Modal` de `ui-dom`).
- Focalisabilité des chips de filtre et des lignes / cartes de résultat des trois sélecteurs (**A**), et des onglets de la modale Showdown (**E**).
- Fermeture d'un `<dialog>` par l'action logique `Cancel`, donc par B au pad (**B**).
- Arbitrage du contrôle focalisé sur le chemin manette : sliders et `<select>` (**C**).
- Focus d'entrée de modale dépendant de la source d'entrée active (**D**).
- e2e + `docs/test-plan.md`.

**Hors périmètre**

- Refonte visuelle du Team Builder lui-même (ses écrans sont navigables ; seules ses modales et ses deux contrôles récalcitrants sont traités).
- Résurrection de l'échelle `--tb-px` / `@container stage` du Team Builder (`docs/next.md` § À faire — chantier séparé, décision visuelle qui mérite sa propre validation).
- Panoramique caméra au clavier (`docs/next.md` § Reporté — demande un modèle d'entrée continu qui n'existe pas).
- Le format « choisi avec la carte » et le format « dérivé du nombre de joueurs » (écartés par #830).

### #836 — Sur un contrôle focalisable, « sélectionné » se peint en BLEU, le jaune reste le focus

Trouvé au test humain (2026-08-25) : le segment actif était rempli de `--color-accent` (jaune) et
l'anneau de focus est jaune **et tracé à l'intérieur** de l'élément — donc invisible sur un contrôle
jaune. « On perd où on est. »

`docs/design-system.md:55` disait « Jaune = focus, curseur, **sélection active** » : une couleur pour
deux signaux. La ligne est amendée. Sur tout contrôle qui peut prendre le focus, l'état sélectionné
passe au bleu des boutons (`--color-btn-bg` / `--color-btn-border`). Le jaune reste l'accent partout
où le focus n'existe pas : curseur de tuile, surbrillances au sol, titres, timeline CT.

Ce n'est pas un langage inventé : `map-select.css:77` peignait **déjà** la carte sélectionnée en
`--color-btn-bg`, sur une liste qui se navigue au focus. Les quatre autres endroits s'alignent sur ce
précédent (segments, chips de filtre, onglets Showdown, cartes de slot) — dont trois étaient
antérieurs au plan, mais que l'étape B venait de rendre atteignables au focus.

### #837 — La préservation du focus au re-rendu est un helper PARTAGÉ, pas un correctif par écran

Retour humain 2026-08-26 : « quand je change le genre d'un Pokemon ça perd le focus et repart d'en
haut, et c'est comme ça à peu près partout sur l'écran ». Le trou F n'était donc pas propre à l'écran
de sélection d'équipe — il est structurel, le projet reconstruisant ses sous-arbres à chaque
changement d'état. `.claude/rules/html.md` l'interdisait déjà et citait un cas connu.

`packages/app/src/ui/dom/preserve-focus.ts` retient une **adresse logique** (`data-testid` + rang
parmi ses homonymes, à défaut rang parmi les focalisables) et la résout après reconstruction — une
référence serait inutile, le nœud n'existant plus. Un contrôle disparu ne récupère rien, ce qui est
voulu : mieux vaut un focus perdu qu'un focus posé au hasard.

Le code ad hoc écrit à l'étape C pour l'écran de sélection d'équipe est **supprimé** au profit de ce
helper — il en était la première version.

### #838 — Les contrôles du panneau d'édition passent en `<button>`

Erreur d'audit reconnue : le plan affirmait que « les écrans eux-mêmes utilisent de vrais
`button`/`input`, ils sont navigables », conclusion tirée d'un comptage de créations d'éléments et non
d'un examen de **quels** contrôles portent l'action. Trois familles étaient des `<div>` cliquables,
donc invisibles au focus, ce que le test humain a montré : la ligne d'**objet** (la navigation sautait
de Talent à Nature), les 4 lignes de **capacité**, et les lignes du menu des **builds** (on l'ouvrait
sans pouvoir y entrer).

### #839 — La Nature devient une liste maison, le `<select>` natif disparaît

Retour humain 2026-08-26 : « le select de Nature me capture, les touches du haut et du bas servent à
choisir, c'est bizarre, j'aimerais pouvoir l'ouvrir. » Le compromis de l'étape A (↑ ↓ changeaient
l'option **en place**, sans dérouler) évitait le piège de la liste native — qu'une manette ne sait ni
parcourir ni quitter — mais produisait un contrôle qui ne se comportait comme rien d'autre dans le jeu.

`NaturePickerModal` est une liste dans un `<dialog>`, du même geste que les sélecteurs de Pokemon, de
capacité et d'objet. Trois **colonnes** (nom · hausse · baisse) et non un libellé unique
`« Rigide (+Atk, -AtkSp) »`, qui revenait à la ligne au milieu d'un mot. Couleurs de l'InfoPanel,
par le même attribut `data-nature` que `info-panel.css`. Source de vérité : `getNatureEffect` du core,
jamais une chaîne traduite qu'on découperait. Filtres par stat augmentée. **Branchée aussi dans le
sandbox**, dont le `<select>` gardait le même défaut — avec sa ligne « Aléatoire » conservée.

Conséquence : les libellés i18n des 25 natures perdent leur `(+Atk, -AtkSp)`, devenu redondant.

### #840 — Pas de saisie de texte à la manette ; les champs texte sont sautés

Décision humaine 2026-08-26, contre un clavier virtuel à l'écran et contre une molette de caractères.
Les champs de recherche des trois sélecteurs et le nom d'équipe portent `data-nav-skip="gamepad"` (le
mécanisme du plan 186) : la navigation au pad ne s'y arrête plus du tout. Le filtrage passe par les
chips, et l'équipe garde son nom par défaut, renommable au clavier.

Contrepartie assumée : renommer une équipe reste un geste clavier-souris.

### #841 — « Remplir IA » est supprimé

Décision humaine 2026-08-26 : le bouton n'a plus de sens. Passer un camp en IA lui assigne déjà une
équipe aléatoire (#831), et la ligne « 🎲 Aléatoire » de la modale la rejoue camp par camp.

Ménage complet derrière : `refresh-ai-teams.ts` et son test supprimés, la clé
`teamSelect.actions.refreshAi` retirée — et `teamSelect.fillAi`, trouvée **déjà morte** avant ce plan.
Le type `SlotForRefresh`, seule chose encore utile du fichier, est **déplacé** dans `slot-state.ts`
sous le nom `SlotState` : garder un fichier pour un type aurait laissé un nom qui ne décrit plus rien.

### #842 — Une exception d'un consommateur ne tue plus la manette

Bug trouvé le 2026-08-26 et de portée bien plus large que son symptôme. `applyToControl` appelait
`stepUp` **détaché de son receveur**, ce qui lève `Illegal invocation`. L'exception remontait jusqu'à
`poll`, dont la chaîne `requestAnimationFrame` n'était alors jamais replanifiée — et comme `frame`
gardait son ancien identifiant, `start()` refusait de la relancer. **Une seule erreur d'écran tuait
donc la manette entière jusqu'au rechargement.**

Deux correctifs, pas un : l'appel comme méthode, **et** un `try/catch` autour de `emit` dans
`gamepad-source.ts` qui journalise et poursuit la boucle. Le second est le vrai : sans lui, n'importe
quel bug futur d'un consommateur pourra à nouveau éteindre l'appareil.

Le symptôme rapporté était « les curseurs de PS ne bougent pas et je reste bloqué dessus » — un
diagnostic très éloigné de la cause, et c'est précisément ce que le silence de l'exception a coûté.

## Étapes

Ordre choisi pour que **le volet 2 passe en premier** : il débloque une impasse (rien de sélectionnable au pad), et ses correctifs (focalisabilité, sortie de modale, focus d'entrée) sont **utilisés** par la nouvelle modale de choix d'équipe du volet 1. L'inverse ferait naître cette modale avec les mêmes trous.

### Étape A — Sortie de modale au pad, et arbitrage du contrôle focalisé (trous B + C)

Le plus petit changement qui lève l'impasse, et le seul qui touche la couche d'entrée partagée — donc à faire seul, avec ses tests, avant que quoi que ce soit d'autre ne s'appuie dessus.

1. **`Cancel` ferme le `<dialog>` ouvert.** Dans `bindScreenInput.cancel` (`ui/dom/screens/elements.ts`), remplacer le refus actuel par : s'il y a un `dialog[open]`, le fermer et consommer l'action **uniquement quand la source active est la manette** ; au clavier, continuer de rendre la main au `cancel` natif du `<dialog>`. Motif du test de source : réclamer la touche au clavier reproduirait le double traitement d'`Échap` que la décision #822 a écarté (fermeture native **plus** action logique).
2. **L'arbitrage du contrôle focalisé vaut aussi au pad.** `isClaimedByFocusedControl` prend aujourd'hui un `EventTarget` issu du `KeyboardEvent`. L'appeler depuis le chemin manette avec `document.activeElement` : les règles écrites au plan 184 (« un contrôle garde l'axe qu'il utilise, la couche prend l'autre ») sont indépendantes de la source, seule leur *cible* diffère. Là où l'axe est revendiqué par le contrôle, la couche laisse passer — et pour un slider, cela veut dire que le pad doit **produire l'effet natif lui-même** (un appui de pad n'est pas un événement clavier, exactement le motif de `activateFocusedControl` au plan 184) : incrémenter / décrémenter la valeur et émettre un `input`.
3. **`<select>` au pad.** `Confirm` sur un `<select>` focalisé : `.click()` n'ouvre pas la liste native de façon fiable. Ne pas chercher à l'ouvrir — appliquer la même logique d'axe que le clavier : ↑ ↓ changent l'option **sélectionnée** en place (et émettent `change`), ← → sortent du contrôle. Le joueur n'a jamais besoin de voir la liste déroulée. Cela couvre la Nature (`EditLeftPanel.ts:344`) et tout `<select>` futur, y compris ceux hors Team Builder.

Tests : unitaires sur `isClaimedByFocusedControl` déjà en place ; ajouter la table de vérité côté pad (slider ← →, `<select>` ↑ ↓, champ texte inerte au pad) et la fermeture de modale par source.

### Étape B — Les modales deviennent navigables (trous A + D + E)

1. **Chips de filtre focalisables.** Les `tb-filter-chip` des trois sélecteurs deviennent de vrais `<button type="button">` — pas des `<div tabindex="0">`. Motif : un chip *est* un bouton bascule, le `<div>` était un raccourci de rendu ; le `<button>` apporte l'activation native au clavier gratuitement, là où `[tabindex='0']` aurait exigé un `keydown` par chip (ce que `PlayerCell` fait aujourd'hui, et qu'on supprime à l'étape C).
2. **Lignes et cartes de résultat focalisables.** Idem pour `tb-list-row` (capacités, objets) et les cartes de la grille de Pokemon. À vérifier au passage : le CSS de ces classes suppose des `<div>` (reset de `button` à prévoir — `appearance`, `font`, `text-align`, `background`), et `docs/design-system.md` avant de toucher aux couleurs d'état focus.
3. **Focus d'entrée selon la source (trou D).** `focusSearchUnlessTouch` devient une décision à trois cas au lieu de deux : souris → champ de recherche (confort inchangé), doigt → rien (le clavier virtuel recouvrirait la modale — motif d'origine, 2026-08-06), **manette → premier résultat** (elle ne peut pas taper ; entrer sur le champ serait un cul-de-sac). La source est déjà publiée par l'`InputSystem` sur `#game-root` (`dataset.inputSource`, utilisée par `focusableControls`).
4. **Onglets de la modale Showdown** (trou **E**). `importTab` / `exportTab` deviennent des `<button type="button">`, et la désactivation de l'onglet `Importer` passe du style en ligne (`pointerEvents`, `opacity`) à l'attribut `disabled` — c'est ce qui la rend lisible par `focusableControls()` (`:not(:disabled)`) au lieu d'un contrôle atteignable mais inerte. L'opacité reste, portée par le CSS via `:disabled`.
5. **Vérifier la navigation dans une grille dense.** La grille de Pokemon est un pavage de plusieurs colonnes : c'est le premier cas où `focusInDirection` et sa `CROSS_AXIS_PENALTY` s'appliquent à beaucoup d'éléments homogènes. Mesurer avant de conclure ; ne toucher à la pénalité que si le comportement observé le justifie, et pas au jugé. Si un ajustement s'avère nécessaire, il sort de ce plan : la pénalité est partagée par tous les écrans, la retoucher ici la reviendrait pour le combat et les menus sans que ce plan les ait testés.

**Périmètre des modales du Team Builder** : les trois sélecteurs (Pokemon, capacité, objet) **plus** la modale Showdown pour ses seuls onglets. Les deux modales de confirmation (`ClearTeamConfirmModal`, `DeleteConfirmModal`) sont déjà navigables — vérifié, elles n'ont que de vrais `<button>`. Le *contenu* de la modale Showdown (deux `<textarea>`) reste hors périmètre : un pad ne saisit pas de texte, et l'import/export Showdown est un geste clavier-souris par nature.

### Étape C — Refonte de l'écran de sélection d'équipe (#830, #831, #832)

0. **Préalable — le focus doit survivre au re-rendu** (trou **F**). Rien d'autre dans cette étape n'a de sens avant : les deux nouveaux segments sont faits pour être pressés souvent, et sur le `render()` actuel chaque appui renvoie le focus au `<body>`. Deux voies, à trancher à l'écriture : soit `render()` cesse de tout reconstruire (mise à jour ciblée des attributs `data-state` et des libellés, la structure restant en place), soit il mémorise le contrôle focalisé et le refocalise après reconstruction. Préférer la **première** : la seconde est un pansement que `.claude/rules/html.md:58-59` décrit comme le symptôme, et elle rate le cas où le contrôle focalisé n'existe plus après reconstruction. Filet : un test qui presse le segment Humain / IA et vérifie que `document.activeElement` est toujours ce segment.
1. **Formats en segments** (#830). `FormatPicker.ts` produit une rangée de `<button>` au lieu d'un `<select>` ; l'actif porte **`data-state="active"`**, pas `data-active`. Motif : `.claude/rules/css.md:45-46` impose `[data-state]` et interdit un `.active` nu ; le précédent le plus proche est `.tb-filter-chip` (`picker.css`), qui s'y conforme. L'écran de sélection d'équipe utilise aujourd'hui `data-active` sur `ts-player-cell` (`team-select.css:111`), un écart existant — ce plan crée deux segments neufs, autant ne pas le propager. Le `<label>` + `<span>` de libellé restent.
2. **Segment Humain / IA** (#831). `PlayerCell.ts` : `ts-player-cell-controller` devient deux `<button>` dans un conteneur segmenté, l'actif surligné, chacun avec son icône. Deux boutons plutôt qu'un seul bouton à deux libellés : c'est ce qui rend les deux états visibles **et** ce qui permet de désigner directement celui qu'on veut, sans passer par l'autre.
3. **Suppression du joueur actif** (#832). `activeSlotIndex`, `setActive`, `buildCentralList` et l'appel à `createTeamListElement` quittent `team-select-screen.ts`. La cellule cesse d'être un `<div role="button" tabindex="0">` avec son `keydown` maison : elle devient un `<button>` dont l'activation ouvre la modale de choix d'équipe. La colonne unique remplace les deux colonnes (`useTwoColumns` / `half` disparaissent) — sans liste centrale, l'espace horizontal n'a plus à être partagé, et une colonne unique est ce que la navigation directionnelle lit le mieux.
4. **Modale de choix d'équipe.** Nouveau composant sur `Modal` de `ui-dom`, alimenté par les entrées que `buildCentralList` construisait déjà (`listTeams()` trié par `updatedAt`, plus la ligne « Aléatoire »). Réutilise `TeamList` / `TeamListItem` **tels quels** — ils produisent déjà de vrais `<button>` (`ts-team-row-button`), donc ils sont navigables sans retouche, y compris au pad après l'étape A. Les badges d'assignation (`computeBadgesByTeamId`) migrent ici ; ils itèrent déjà sur **tous** les camps, donc ouvrir la modale de n'importe quel camp rend la vue d'ensemble entière — ce n'est pas un badge par camp à recalculer.
5. **Avance au prochain camp non assigné** (#834). Sur sélection **réussie** seulement : la modale se ferme et le focus va au premier camp encore vide (à défaut, il reste au camp traité). Une fermeture par `Échap`, par B ou par le `×` rend le focus au déclencheur, comme la convention l'exige. Un test par voie de sortie — c'est la distinction « l'action a abouti » vs « rien n'a bougé » qui porte tout l'écart assumé, donc elle doit être vérifiée, pas seulement écrite.
6. **Libellés de format** (#835). Dans `FormatPicker`, `label` devient `` `${teamCount}J × ${maxPokemonPerTeam}` `` et le libellé de la rangée passe à « Joueurs × Pokemon » (clé i18n à ajouter, FR + EN). `buildFormatKey` **ne change pas** : c'est la clé qui voyage jusqu'au `CombatSetup`, la toucher casserait `formatKey` sans rien apporter.
7. **Footer inchangé** (`Placement auto`, `Régénérer IA`, `Lancer`). Il fonctionne : la case à cocher est atteignable depuis le plan 184, le bouton `Lancer` reste désactivé tant que `isLaunchable()` est faux.

**Couplages e2e à mettre à jour** — relevés et vérifiés avant de coder. Il y en a **six**, et le plus coûteux n'est pas un sélecteur mais une **sémantique** :

| # | Couplage | Nature de la rupture |
|---|---|---|
| 1 | `e2e/pages/screens.ts:56` — `humanToggle = getByRole("button", { name: "Humain", exact: true })`, utilisé par `combat/normal-game.spec.ts:27`, `combat/platform-chrome.spec.ts:73`, `dom/screens.spec.ts:119` | **Rupture de sémantique, pas de sélecteur.** Le POM documente « Toggle the Player 1 slot from Human → AI » : aujourd'hui un seul bouton bascule, donc cliquer « Humain » **donne le camp à l'IA**. Avec le segment de #831, cliquer « Humain » ne fait plus que confirmer l'état déjà actif — les 3 specs doivent viser le bouton « IA ». Le sélecteur reste valide, le test devient faux **silencieusement** : c'est le couplage à traiter en premier |
| 2 | `e2e/pages/screens.ts:47-52` — `randomTeam = getByRole("button", { name: "🎲 Aléatoire" })`, utilisé par `combat/battle-resume.spec.ts:47`, `combat/combat-menu.spec.ts:475` | La ligne « Aléatoire » migre dans la modale (#832). Le POM doit d'abord **ouvrir** la cellule du joueur. Son commentaire (« assigns a random team to the ACTIVE slot, which is slot 1 on arrival ») décrit une notion que #832 supprime |
| 3 | `e2e/pages/responsive.ts:178` — `TEAM_SELECT_SCROLLERS = ".ts-team-list"`, utilisé par `dom/responsive-screens.spec.ts:173` | Le défilement mesuré est celui de la liste d'équipes, qui n'est plus sur l'écran mais dans la modale. La mesure se déplace, ou l'écran obtient un autre scroller (la colonne de joueurs) |
| 4 | `e2e/tests/dom/screens.spec.ts:97` — `.ts-format-picker-select` | Disparaît avec le `<select>` (#830) |
| 5 | `e2e/tests/dom/responsive-screens.spec.ts:177,181` — `.ts-team-row-portrait` | Migre dans la modale ; le test doit l'ouvrir pour mesurer |
| 6 | `e2e/pages/responsive.ts:176` — commentaire de `TEAM_SELECT_ROOT` (« slots on the left, saved teams on the right ») | Commentaire périmé par la colonne unique |

⚠️ La revue de plan avait conclu « aucun autre couplage, les tests en `getByRole` sont résilients ». Vérification faite, c'est faux pour les couplages 1, 2 et 3 : `getByRole` protège du renommage de classe CSS, pas d'un changement de **ce que le geste fait**. Le couplage 1 en particulier passerait le gate en vert tout en testant l'inverse de ce qu'il annonce.

### Étape D — Tests et cahier de recette (#833)

- e2e : navigation au pad dans les trois sélecteurs (atteindre un chip, atteindre un résultat, sélectionner, refermer par `Cancel`), réglage d'un slider SP au pad, changement de Nature au pad, parcours complet du nouvel écran de sélection d'équipe au pad (format → Humain/IA → équipe via la modale → `Lancer`).
- `docs/test-plan.md` : sections mises à jour, cases 🤖 pour tout ce qui précède, 👁 pour ce qui reste du ressort de l'œil (rendu du segment actif, densité de la grille de Pokemon).
- Le harnais e2e simule-t-il une source manette ? À vérifier avant de promettre les cases 🤖 : la `Gamepad API` n'est pas pilotable directement par Playwright. Si le seul levier est de forcer `dataset.inputSource` et d'injecter des actions logiques, le dire dans le plan de test plutôt que de laisser croire à un vrai pad. Conventions : `.claude/rules/e2e.md`.

### Étape E — La préservation du focus devient partagée (#837)

`packages/app/src/ui/dom/preserve-focus.ts`, branché sur `TeamEditView`, les trois sélecteurs,
`MyTeamsView`, `NaturePickerModal` et l'écran de sélection d'équipe — dont le code ad hoc de l'étape C
est supprimé au profit du helper.

### Étape F — Les contrôles du panneau d'édition passent en `<button>` (#838)

Ligne d'objet (`tb-input-clickable`), 4 lignes de capacité (`MovesList`), lignes du menu des builds
(`tb-set-op-row`). Chaque conversion avec sa remise à zéro CSS (`appearance`, `font-size`,
`font-family`, `text-align`, `width`).

### Étape G — Le bug qui tuait la manette (#842)

`applyToControl` appelait `stepUp` détaché de son receveur → `Illegal invocation` → boucle du poller
morte. Corrigé à la source **et** filet dans `gamepad-source.ts`. Le test e2e retiré la veille faute
de cause établie est rétabli et passe.

### Étape H — Nature en liste, et pas de saisie au pad (#839, #840)

`NaturePickerModal` (trois colonnes, couleurs de l'InfoPanel, filtres par stat, ligne « Aléatoire »
pour le sandbox) remplace le `<select>` dans le Team Builder **et** dans le sandbox. Les champs texte
portent `data-nav-skip="gamepad"`.

### Étape I — Suppression de « Remplir IA » (#841)

Bouton, helper, test, deux clés i18n et une classe CSS orpheline. `SlotForRefresh` migre en `SlotState`
dans `slot-state.ts`.

## Risques

| Risque | Traitement |
|---|---|
| **Toucher la couche d'entrée partagée** (étape A) casse le combat, le menu de combat ou l'écran de contrôles | Étape A isolée, avec ses tests, avant tout le reste. Le point sensible est le même que celui de la décision #827 : rendre un `cancel` honnête révèle qui réclamait la touche. Vérifier les deux `cancel` du combat et le `<dialog>` du menu de combat (plan 187) après le changement |
| **Chips / lignes en `<button>`** casse le rendu CSS des trois sélecteurs | Reset de `button` explicite ; `docs/design-system.md` consulté avant de toucher aux couleurs ; contrôle visuel humain sur les trois modales |
| **La perte de la lecture d'ensemble** des équipes gêne à l'usage (assumée par #832) | Plus petit que craint, vérifié : `computeBadgesByTeamId` itère sur **tous** les camps, donc ouvrir la modale de n'importe quel camp rend la vue d'ensemble entière ; et chaque cellule garde le nom de son équipe affiché en permanence (`ts-player-cell-team`). Ce qui disparaît est la liste des équipes *disponibles*, pas la lecture des assignations faites. Aucun garde-fou n'est perdu au passage : `assignTeamToSlot` (`slot-state.ts:120`) n'a **jamais** empêché d'assigner la même équipe à deux camps — les badges sont informatifs, pas bloquants |
| **Le vrai maximum est 12 camps, pas 4** | Vérifié : les **9** cartes jouables déclarent toutes `spawns_12p` (12 objets, 1 par camp), et `SPAWN_LAYER_TO_TEAM_COUNT` (`packages/data/src/tiled/parse-spawns-layer.ts:5`) donne `teamCount ∈ {2, 3, 4, 6, 12}`. La validation humaine doit donc inclure le **format à 12 camps** — c'est là que la colonne unique de l'étape C.3 (12 cartes empilées au lieu de 6+6) et la perte de l'enchaînement d'assignation se verront, pas en 3v3 |
| **`.ts-team-row-portrait` mesuré par le responsive e2e** migre dans un `<dialog>` | Repéré avant de coder ; le test ouvre la modale, ou la mesure se déplace |
| **`humanToggle` passe au vert en testant l'inverse** (couplage e2e n°1) : le sélecteur survit à #831, le geste change de sens | Le seul risque du chantier qui ne se voit **pas** au gate. À traiter en premier dans l'étape C, avant même de regarder le rendu — et à vérifier en relisant ce que les 3 specs concernées croient prouver, pas seulement en les faisant passer |

## Validation

Test humain interactif, un scénario à la fois (règle CLAUDE.md `human-testing`), au clavier **et** à la manette Switch Pro filaire — c'est la configuration qui a servi à valider le plan 184, donc la seule qui compare. Ordre : étape A seule (rien ne doit régresser en combat), puis les sélecteurs, puis l'écran refondu.

Commit WIP avant la chaîne de finalisation, re-test humain après, commit définitif en amendement (garde-fou du plan 166).
