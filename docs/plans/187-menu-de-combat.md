# Plan 187 — Menu de combat

> **Statut** : done (2026-08-25) — validé à la main scénario par scénario : flux d'attaque non régressé (`Échap` cran par cran), modale (quatre niveaux), Paramètres → Contrôles, manette, les trois sorties (Reprendre / Abandonner / Quitter), bouton tactile
> **Créé** : 2026-08-25
> **Phase** : hors phase — dernier chantier issu de la validation du Lot 2 / du plan 186
> **Cadre** : `docs/next.md` § Reporté, « Chantier dédié : menu de combat (pause) » (ouvert 2026-08-25)
> **Dépend de** : plan 184 (couche d'actions logiques, pile de registrations de l'`InputSystem`), plan 186 (magasin de bindings, écran de contrôles), plan 181 (sauvegarde de reprise)

## Motivation

L'écran de contrôles du plan 186 n'est atteignable que **depuis le menu principal**. Un joueur qui découvre en pleine partie que sa touche tombe mal doit **quitter le combat** pour la changer — et, avec la sémantique actuelle de « Retour au menu », **perdre la partie** pour aller régler une touche. Le même trou vaut pour la langue, la prévisualisation de dégâts et le plein écran.

Symétriquement, un combat en cours n'a **aucune sortie** autre que la fin du combat : ni « quitter », ni « recommencer », tant que le dialogue de victoire n'est pas apparu.

`Start` a été laissé libre exprès par le plan 186, en prévision de ce menu.

## Ce n'est PAS une pause — décision de cadrage (humain, 2026-08-25)

**Rien n'est suspendu.** Le combat continue de tourner derrière la surcouche : l'IA joue, les animations se déroulent, et le futur chronomètre du multijoueur tournera. En ligne, une pause est impossible — autant n'avoir **qu'un seul comportement**, validé dès le solo, plutôt qu'un mécanisme de suspension qu'il faudrait retirer en Phase 7.

Conséquences concrètes :

- Aucun état « en pause » n'existe dans l'orchestrateur, donc aucune reprise à orchestrer à la fermeture. La surcouche est **purement de l'interface**.
- Le nom est « **Menu de combat** » (`battle menu`), jamais « Pause » : le libellé ne doit pas promettre ce que le jeu ne fait pas.
- Le combat peut **se terminer pendant** que le menu est ouvert (l'IA achève le dernier Pokemon du joueur). Traité explicitement à l'étape D.

## Décisions actées (humain, 2026-08-25)

| # | Question | Décision |
|---|---|---|
| 1 | Nature | **Surcouche** sur un combat qui continue. Pas de pause (voir ci-dessus). |
| 2 | Entrées | **Reprendre / Paramètres / Recommencer / Abandonner / Quitter**, dans cet ordre (humain, 2026-08-25). « Reprendre » referme — indispensable au doigt, qui n'a ni `Échap` ni `B`. |
| 3 | Deux sorties, pas une (**révisé pendant le test humain, 2026-08-25**) | **« Abandonner »** détruit la partie (purge de la sauvegarde de reprise), **derrière une confirmation**. **« Quitter »** rend la main au menu principal **en gardant la partie reprenable**, **sans confirmation** — rien n'est perdu, et une confirmation sur une action réversible use le réflexe jusqu'à ce qu'on valide sans lire, y compris devant l'abandon. « Recommencer » détruit aussi, donc confirme aussi. ⚠️ La première version de ce plan n'offrait **que** l'abandon : c'est exactement le trou que la revue design avait prédit (« pourquoi le jeu sait sauvegarder mon combat, mais son propre menu ne me le propose jamais ? »), que j'avais rangé à tort en simple observation de playtest, et que le test humain a fait remonter au premier passage. |
| 3b | Où vit « Quitter » | **Seulement là où une sauvegarde existe.** `onQuitKeepingSave` est optionnel et n'est fourni que quand `onBattleClosed` l'est — c'est-à-dire par le seul vrai combat, jamais par le studio sandbox. Là-bas l'entrée ne s'affiche pas, plutôt que de promettre une reprise sans rien à reprendre. Ça referme l'incohérence relevée par la revue : jusqu'ici **fermer l'onglet** préservait la partie alors que le menu ne le proposait nulle part — le chemin accidentel devient un choix explicite. |
| 4 | Accès aux Paramètres | **Extraire des panneaux réutilisables** montés par l'écran **et** par la surcouche. |
| 5 | Entrée tactile | **Un nouveau bouton**, dans la rangée haut-droite, **entre le plein écran et le journal**. Choix de l'icône délégué à Claude, quitte à changer celle du journal. |

### Décisions de conception qui découlent des 5 ci-dessus (à valider en revue de plan)

| # | Point | Choix | Pourquoi |
|---|---|---|---|
| 6 | Comment le menu prend l'entrée | Il **empile sa propre registration** sur la pile de l'`InputSystem` | La pile existe déjà et son sommet est l'actif (plan 184). Le menu devient donc l'unique consommateur pendant qu'il est ouvert, **sans toucher une ligne** des consommateurs du combat et sans inventer de priorité à arbitrer. |
| 7 | `Échap` ↔ *Annuler* | **On fait remonter la vérité de l'annulation** : rien annulé → le menu s'ouvre | Aujourd'hui les deux `cancel` du combat renvoient `true` **inconditionnellement**, même quand `orchestrator.onEscape()` n'a rien fait (son `default:` ne couvre ni le menu d'actions racine ni le plateau au repos). Rendre le booléen honnête est plus juste qu'une liste de phases en dur, et couvre le plateau au repos comme le menu racine. **Le placement reste hors périmètre** (voir « Ce que ce plan ne fait pas ») ; ses deux `cancel` renvoient déjà `false` quand il n'y a rien à défaire, donc le jour où le menu y sera étendu il n'y aura rien à corriger là-bas. ⚠️ C'est un **changement de comportement**, pas une pure addition : aujourd'hui `Échap` au menu d'actions racine ne produit rien de perceptible, demain il ouvre une modale. Bénin et plus logique que le silence actuel (revue design 2026-08-25), mais à annoncer comme tel au test humain. |
| 8 | Une action logique dédiée | `OpenCombatMenu`, `Start` à la manette, **aucune touche clavier par défaut** | Elle apparaît dans l'écran de contrôles (donc **découvrable** et remappable), et `Start` est le bouton que le plan 186 a gardé libre. Pas de défaut clavier parce qu'`Échap` fait déjà le travail par la retombée #7 — un second défaut clavier serait une deuxième vérité à maintenir. Le joueur peut lui en assigner une. |
| 9 | Où vit la modale dans le DOM | Dans le `screenLayer` du `GameStage`, comme le dialogue de victoire | Elle meurt avec l'écran de combat. Montée sur `document.body` (ce que fait `Modal.ts` du Team Builder), un combat quitté en laisserait une derrière lui. |
| 10 | `Échap` natif du `<dialog>` | **Neutralisé** (`event.preventDefault()` sur `cancel`) | Sinon une frappe d'`Échap` ferme la modale **et** produit l'action logique `Cancel` — soit exactement le double traitement que le plan 184 a supprimé, ici en pire : la fermeture native déclencherait la retombée #7, qui rouvrirait le menu. Une seule porte : l'action logique. |
| 11 | Niveaux | Une **pile de niveaux** dans la surcouche : menu → Paramètres → Contrôles → confirmation | `Cancel` **dépile d'un cran** ; au dernier cran il referme. Sans pile explicite, `Échap` dans les Contrôles ramènerait au combat en sautant les Paramètres. |
| 12 | Priorité de `Cancel` dans la surcouche | capture de touche > dépiler un niveau > refermer | La capture du plan 186 a déjà sa sortie inconditionnelle (`InputSystem.beginCapture`, décision 8 du plan 186) et elle doit rester la première servie, sinon configurer une touche referme l'écran. |
| 13 | `Recommencer` en ligne | **Pas de drapeau multijoueur aujourd'hui** | Le multi n'existe pas : un drapeau `isOnline` serait du code mort non testable (règle projet). Le bouton est visible dans tous les chemins actuels (placement, reprise, sandbox), et le masquer sera une ligne le jour où la Phase 7 apporte un état de session à interroger. |
| 14 | Ouverture pendant `locked` | **Refusée**, comme toute autre action | `locked` (animation en cours) coupe déjà tout le routeur. Y faire une exception demanderait de rouvrir la question « que se passe-t-il si le joueur quitte au milieu d'une animation » pour un gain nul : les verrous durent moins d'une seconde. |
| 15 | Ouverture pendant le dialogue de victoire | **Refusée** | La victoire porte déjà ses propres sorties (Rejouer / Retour au menu). Deux modales empilées n'ont aucun sens, et `focusableControls()` ne saurait laquelle servir. |
| 15b | Ouvrir le menu ne doit **rien** annuler | Une visée en cours, un choix d'orientation ouvert, une cible sélectionnée : tout est **retrouvé intact** à la fermeture | C'est la conséquence heureuse de la décision 6 (on empile, on ne démonte rien) et il faut la **tenir explicitement**, pas la constater : « j'ouvre le menu par erreur en pleine visée » ne doit jamais coûter le choix en cours — c'est précisément ce qui distingue `Start` d'`Échap`, qui lui remonte d'un cran. Couvert par un test (relevé par la revue design 2026-08-25). |
| 16 | Icônes de la rangée | Le menu prend le **burger `☰`**, le journal passe à **`▤`** | `☰` est le glyphe conventionnel de « menu » ; il est aujourd'hui dépensé sur le repli du journal, qui est un **panneau de texte** et que `▤` (cadre + lignes) décrit mieux. Le burger est par ailleurs déjà **étiqueté** dans le journal (il jouxte le titre « Journal »), alors que le nouveau bouton est **icône seule** : c'est lui qui a le plus besoin du glyphe le moins ambigu. Glyphes texte, comme `⛶` et `☰` aujourd'hui — aucun asset, et ils partiront ensemble au futur « pack d'icônes cohérent » noté au plan 177. |

### Décisions issues des deux revues (2026-08-25)

| # | Point | Décision |
|---|---|---|
| 17 | Le libellé de confirmation | **Un texte par action, pas un gabarit commun.** Quitter → « Abandonner ce combat et retourner au menu principal ? » ; Recommencer → « Recommencer ce combat depuis le placement ? La progression de cette tentative sera perdue. » Un gabarit unique (« la partie en cours sera perdue ») est *vrai* pour les deux mais **imprécis** pour Recommencer : rien n'y est définitivement perdu — même carte, mêmes équipes — c'est la **tentative** qui saute, pas la partie (revue design). |
| 18 | Le bouton `☰` pendant `locked` | **Désactivé visuellement** le temps du verrou. Au clavier et à la manette, une touche inerte ne se remarque pas ; un bouton tactile qui n'a **aucun** retour se fait taper trois fois de suite et se lit comme un bug (revue design). Le seul cas où l'appareil impose un état visuel que les autres n'ont pas. |
| 19 | Qui crée la modale, et quand | **`runBattle`**, juste après le chrome dont elle réutilise `onExit` / `onReplay`, et détruite par le `signal` d'abandon comme les autres écouteurs de cette fonction. Elle n'est donc **jamais** passée en paramètre : elle naît et meurt dans la seule fonction qui possède à la fois le `screenLayer`, les deux sorties et la registration d'entrée du combat (question soulevée par la revue de plan). |
| 20 | Comment la victoire referme le menu | En **décorant** `showVictory` au seul endroit où le chrome est remis à l'orchestrateur (`combat-screen.ts`, l. 387) : `showVictory: (winnerId) => { combatMenu.close(); chrome.showVictory(winnerId); }`. `BattleOrchestrator` reçoit le chrome comme dépendance (l. 243) et l'appelle en un point unique (`battle-orchestrator.ts`, l. 1892) — la décoration est donc exhaustive, sans que le menu ait à écouter les événements du combat ni que `view-core` apprenne son existence (question soulevée par la revue de plan). |
| 21 | Annuler une capture de touche depuis la modale | **Rien à faire — hypothèse infirmée par la revue de code (2026-08-25).** Le premier jet ajoutait un `cancelCapture?(): boolean` sur `Panel`, appelé en tête du `cancel` de la modale. Il était **inatteignable** : pendant une capture, aucune action logique n'atteint le routeur — l'écouteur clavier de l'`InputSystem` intercepte la frappe avant `resolveKeyboardAction`, et le sondeur de manette « ne route RIEN ». `Échap` et `B` partent donc droit dans le puits de capture, qui porte déjà sa sortie inconditionnelle (plan 186 décision 8). Le membre d'interface, son implémentation et sa branche de garde ont été **supprimés** (règle « code mort : zéro tolérance ») ; la garantie de la décision 12 tient sans eux, et un commentaire dans `panels/panel.ts` dit pourquoi le contrat ne la porte pas. |

### Décisions issues de la revue de code (2026-08-25)

| # | Point | Décision |
|---|---|---|
| 22 | **Régression trouvée par la revue** : `Échap` détruisait le dialogue de victoire | **Un garde `isModalOpen()` en tête des deux `cancel`.** La phase `battle_over` est en contexte `menu`, donc `Échap` y atteignait mon `cancel` ; `onEscape()` renvoyait `false` (rien à annuler) et `open()` refusait (décision 15) — donc `cancel` renvoyait `false`, le routeur ne faisait pas `preventDefault()`, et la fermeture **native** d'`Échap` emportait Rejouer / Retour au menu. `showVictory` n'étant appelé qu'une fois, l'écran de résultat était perdu pour de bon. C'est le `return true` inconditionnel d'avant ce plan qui masquait le problème : rendre le booléen honnête a découvert une touche que personne ne réclamait plus. **La leçon** : le plan avait identifié l'étape B comme le risque n°1 et listé les phases à tester — `battle_over` n'était pas dans la liste. |
| 23 | La **langue** n'est pas proposée en cours de combat | **La ligne est retirée du panneau quand il est embarqué.** `runBattle` résout les noms via une langue capturée une fois, et surtout les lignes **déjà écrites** du journal sont du texte DOM figé : basculer en pleine partie donnerait un journal mi-français mi-anglais. Rendre la résolution « vivante » ne suffirait même pas — il faudrait re-render tout l'historique, c'est-à-dire le chantier « migration i18n du journal de combat » déjà en attente. Mieux vaut ne pas offrir le bouton que livrer deux langues à l'écran. ⚠️ Ça **réduit** ce que la motivation de ce plan annonçait (« le même trou vaut pour la langue ») : à rouvrir quand le journal sera migré. |
| 24 | Le bouton `☰` en fin de combat | **Une seule règle, deux appelants.** Le bouton n'est actif que si le menu peut réellement s'ouvrir : hors verrou d'animation **et** sans autre modale. Deux `setEnabled` indépendants marchaient par chance de l'ordre d'exécution (`enterBattleOver` change le contexte **avant** d'ouvrir la victoire) — une seule fonction relue par les deux endroits enlève cette dépendance. |

## Ce que ce plan ne fait pas

- **Pas de pause** (décision 1). Ni suspension de l'IA, ni gel des animations, ni chronomètre arrêté.
- **Pas de sauvegardes multiples ni de créneaux nommés.** « Quitter » garde LA partie en cours reprenable, au même emplacement unique que la reprise du plan 181 — quitter un second combat écrase le premier, comme aujourd'hui.
- **Pas de refonte des Paramètres ni des Contrôles.** L'étape C est une **extraction sans changement de comportement** — les e2e existants de ces deux écrans doivent rester verts sans être touchés.
- **Pas de panoramique caméra au clavier** (reste en § Reporté, décisions #807/#811).
- **Pas de traitement du trou « la timeline CT défile sans le dire »** (reste en § Reporté).
- **Pas de menu pendant la phase de placement.** Le chrome de combat — et donc la rangée qui portera le bouton `☰`, les deux sorties `onExit` / `onReplay` et la registration d'entrée — naît dans `runBattle`, c'est-à-dire **après** le placement. Y étendre le menu demanderait une seconde instance, avec ses propres sorties, montée par `createCombatScreen`. Le trou est réel (pendant le placement, aucune sortie n'existe — c'est déjà vrai aujourd'hui, ce plan ne le crée pas) et **part en § Reporté de `docs/next.md`** à la clôture.
- **Pas de nouvelle entrée dans la légende du plan 185.** Cette légende décrit la **caméra**, autour de la boussole ; y greffer une ligne « menu » élargirait son sujet. Le bouton `☰` est sa propre annonce, et l'écran de contrôles liste l'action.

## Architecture

### La surcouche — `packages/app/src/ui/dom/combat-menu.ts` (nouveau)

```ts
export interface CombatMenuOptions {
  /** `screenLayer` du GameStage — la modale meurt avec l'écran de combat (décision 9). */
  host: HTMLElement;
  /** Abandonne la partie et rend la main au menu principal (le `onExit` du chrome). */
  onQuit: () => void;
  /** Abandonne et relance le même combat (le `onReplay` du chrome). */
  onRestart: () => void;
}

export interface CombatMenu {
  /** Ignoré si déjà ouvert, si un autre `dialog` est ouvert (décision 15). */
  open(): void;
  /** Referme, quel que soit le niveau courant. Appelé aussi par la victoire (étape D). */
  close(): void;
  readonly isOpen: boolean;
  dispose(): void;
}
```

- Un `<dialog>` par ouverture, `showModal()`, retiré à la fermeture — même cycle de vie que le dialogue de victoire, dont il partage l'ancrage.
- **Ouvrir empile une registration** (`context: () => "screen"`, un `menu` seul, pas de `board`) ; refermer la dépile (décision 6). Pendant ce temps le routeur ne voit plus les consommateurs du combat : ni curseur, ni caméra, ni zoom. C'est voulu — le plateau est derrière la modale.
- La registration ne réutilise **pas** `bindScreenInput` : ce dernier abandonne `Cancel` dès qu'un `dialog[open]` existe (« une modale possède `Échap` »), et ici la modale **c'est nous**. Elle reprend son `focusMove` / `confirm` (`focusInDirection`, `activateFocusedControl` — la navigation est déjà piégée dans le `dialog` par `focusableControls()`), et écrit son propre `cancel` : la pile de niveaux (décisions 11-12).
- `event.preventDefault()` sur l'événement `cancel` du `<dialog>` (décision 10).

### Les niveaux

| Niveau | Contenu | `Cancel` |
|---|---|---|
| `menu` | Reprendre · Paramètres · Recommencer · Quitter | referme |
| `settings` | `createSettingsPanel` (étape C) | → `menu` |
| `controls` | `createControlsPanel` (étape C) | capture en cours → l'annule ; sinon → `settings` |
| `confirm` | « Quitter ? / Recommencer ? La partie en cours sera perdue » + Confirmer / Annuler | → `menu` |

Un seul `<dialog>` dont on remplace le corps, pas quatre modales empilées : `showModal()` sur une modale déjà ouverte lève, et le focus doit rester piégé dans un seul conteneur.

### Les panneaux réutilisables (étape C)

`settings-screen.ts` (131 l.) et `controls-screen.ts` (474 l.) portent aujourd'hui **à la fois** la mise en page et le fait d'être un écran plein cadre (`mn-screen`, `bindScreenInput`, `navigate`). On sépare :

```
ui/dom/panels/settings-panel.ts   createSettingsPanel({ onOpenControls }): Panel
ui/dom/panels/controls-panel.ts   createControlsPanel(): Panel
```

`Panel = { element: HTMLElement; dispose(): void; cancelCapture?(): boolean }` — le troisième membre n'existe que sur le panneau des Contrôles (décision 21). Ce qui reste dans les deux `*-screen.ts` : le titre, le bouton « Retour », `bindScreenInput`, et le `navigate` — l'enveloppe écran, rien de plus. La surcouche monte le **même** panneau, avec son propre retour.

**Contrainte de non-régression** : aucun `data-testid` ne change, aucun e2e de Réglages ou de Contrôles n'est modifié. Si un test doit bouger, c'est que ce n'est plus une extraction.

### La retombée d'`Échap` (étape B)

`BattleOrchestrator.onEscape(): void` devient `onEscape(): boolean` — « ai-je annulé quelque chose ? ». Son `switch` renvoie `true` dans chaque branche qui change de phase, `false` au `default:`. Les deux `cancel` de `combat-screen.ts` cessent de renvoyer `true` en dur et propagent ce booléen ; quand il est `false`, ils ouvrent le menu.

Côté `placement-flow.ts` : **rien à changer, et rien à brancher** — le placement est hors périmètre (pas de chrome à cette phase, donc pas de menu). Ses deux `cancel` sont déjà honnêtes (`return false` quand `!placing`), ce qui veut dire que l'extension future n'aura rien à y corriger.

### L'action logique (étape A)

- `LogicalAction.OpenCombatMenu` dans `logical-action.ts`.
- `DEFAULT_BINDINGS` : `keyboard: [null, null]`, `gamepad: [9, null]` (`Start` en mapping standard W3C).
- `BoardInputConsumer.openCombatMenu(): boolean` — le consommateur plateau est fourni par les **deux** registrations en combat (bataille et placement) et par aucun écran de menu, donc la route est exacte par construction. Traitée dans `handleViewAction` du routeur, donc bloquée par `locked` comme tout le reste (décision 14).
- Une section de l'écran de contrôles l'accueille (`controls.group.*`) — à trancher : ligne isolée « Menu de combat » ou rattachement à « Curseur & menus ». Proposition : **« Curseur & menus »**, pour ne pas ouvrir une section à une ligne.

## Étapes

**A — L'action logique.** `OpenCombatMenu`, défaut `Start`, `openCombatMenu` sur `BoardInputConsumer`, route dans `input-router.ts`, ligne dans l'écran de contrôles. Branché sur un `() => false` provisoire — l'étape A ne doit **rien** ouvrir, elle câble le chemin. Tests : `bindings-store` (le défaut porte bien `Start`), `input-router` (l'action atteint le plateau, et pas en `locked`), `key-legend`/écran de contrôles (la ligne s'affiche, remappable).

**B — La vérité de l'annulation.** `onEscape(): boolean` dans `battle-orchestrator.ts` + propagation dans les deux `cancel` de `combat-screen.ts`. Tests : `battle-orchestrator.test.ts` — `false` en menu d'actions racine, `true` depuis un sous-menu / une visée / un choix d'orientation. C'est le point le plus à risque de régression du plan : `Échap` est aujourd'hui la sortie de tout le flux d'attaque.

**C — Extraction des panneaux.** `settings-panel.ts`, `controls-panel.ts`, les deux écrans deviennent des enveloppes. Aucun `data-testid` déplacé. Gate vert **sans toucher un e2e** — vérifié faisable : aucun test e2e ne sélectionne par la hiérarchie des écrans (`grep` de `mn-screen` / `controls-screen` dans `e2e/` : zéro occurrence), ils ciblent tous les `data-testid` directement.

**D — La surcouche.** `combat-menu.ts`, ses quatre niveaux, sa registration, la neutralisation du `cancel` natif. Créée par `runBattle` — le point unique par lequel passent les trois chemins de combat (placement, reprise, sandbox) — sur les `onExit` / `onReplay` déjà là, décorant `showVictory` au passage (décisions 19-20). Trois cas de bord à couvrir par test : la victoire qui survient **menu ouvert** (le menu se referme, la victoire prend la main), `open()` refusé quand un `dialog` est déjà ouvert, et **une visée en cours retrouvée intacte** à la fermeture (décision 15b).

**E — L'entrée tactile.** Bouton icône seule `☰` (`aria-label` traduit), inséré entre le plein écran et le journal dans `createBattleLogRow` ; le burger du journal passe à `▤`. Toujours visible, y compris en plein écran — contrairement au bouton de plein écran, il a toujours quelque chose à offrir, et rien dans `battle-log.css` ne masque `.bl-log-row` en plein écran (vérifié). **Désactivé pendant `locked`** (décision 18). Clés i18n FR/EN (`combatMenu.*`).

**F — Tests & doc.** e2e (ouverture au clavier depuis le menu racine, `Échap` annule toujours dans un sous-menu, `Échap` menu ouvert referme **sans rouvrir**, chemin Paramètres → Contrôles → retour, confirmation de Quitter, bouton tactile), cahier `docs/test-plan.md`, `docs/decisions.md`, `docs/next.md` (dont les deux reports : menu pendant le placement, et le point d'observation de playtest ci-dessous), `docs/plans/README.md`.

## Ce que la revue design avait vu juste

Elle signalait que la sauvegarde de reprise persistait tant qu'on ne cliquait pas sur Quitter/Recommencer, donc qu'un joueur découvrirait qu'il préserve sa partie en **fermant l'onglet** plutôt qu'en utilisant le menu — et posait la question : « pourquoi le jeu sait sauvegarder mon combat, mais son propre menu ne me le propose jamais ? ». Je l'avais classée en observation de playtest. **Le test humain l'a fait remonter au premier passage** : décisions 3 et 3b. La leçon vaut d'être écrite — une tension de conception nommée par une revue est un défaut, pas une curiosité à observer.

Second point à ne pas oublier en Phase 7 : quand le chronomètre multijoueur existera, ouvrir le menu **grignotera le temps du joueur sans le dire**. C'est le prix explicite du cadrage « un seul comportement dès le solo » — il faudra probablement une pastille « le temps continue » sur la modale à ce moment-là.

## Risques

| Risque | Parade |
|---|---|
| **`Échap` régresse dans le flux d'attaque** (étape B touche la sortie de toutes les phases) | Tests d'orchestrateur phase par phase **avant** de brancher l'ouverture du menu, et scénario de test humain dédié : entrer dans une attaque, viser, choisir une orientation, et vérifier qu'`Échap` remonte cran par cran **sans** ouvrir le menu. |
| **L'extraction des panneaux dérive en refonte** | Critère d'arrêt écrit : aucun `data-testid` modifié, aucun e2e touché. |
| **Double traitement d'`Échap` sur le `<dialog>`** | Décision 10, couverte par un test e2e : `Échap` menu ouvert referme et **ne rouvre pas**. |
| **Le combat se termine menu ouvert** | Étape D, test dédié. |
