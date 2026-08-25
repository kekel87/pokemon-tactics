# Plan 186 — Écran de remapping (clavier & manette)

> **Statut** : done (2026-08-25 — livré et **validé à la main** : écran, remapping, journal, manette et anneau de focus)
> **Créé** : 2026-08-24
> **Phase** : hors phase — chantier de contrôle issu de la validation du Lot 2 (plan 184)
> **Cadre** : `docs/next.md` § Reporté, « Chantier dédié : écran de remapping » (ouvert 2026-08-21, découplé de la légende le 2026-08-24 une fois le plan 185 livré)
> **Dépend de** : plan 184 (couche d'actions logiques `packages/app/src/input/`), plan 185 (`key-legend.ts`, qui relit déjà la table de bindings au lieu de la retaper)

## Motivation

Depuis le Lot 2, le jeu se joue entièrement au clavier et à la manette — mais **aucune touche n'est réassignable** (décision assumée du plan 184 : bindings fixes, l'écran de remapping dans un plan dédié). Trois trous concrets en découlent :

1. **Le joueur ne peut rien changer.** Les bindings sont un `Record` en dur dans `keyboard-source.ts`. Un joueur gaucher, un clavier QWERTZ/Dvorak, un joueur qui veut `Espace` ailleurs : rien à faire.
2. **La manette non standard est inutilisable.** `pollGamepad` sort immédiatement si `pad.mapping !== "standard"` — et Firefox renvoie une chaîne **vide** pour tout pad absent de sa table interne, y compris un pad physiquement standard (Bugzilla #952773, #1542893). Le commentaire du plan 184 renvoie explicitement ce cas « au futur écran de remapping » : c'est ici. Une capture de bouton résout le problème par construction, puisqu'elle lit l'index réellement pressé au lieu de le supposer.
3. **La découvrabilité s'arrête à la caméra.** La légende du plan 185 annonce rotation et zoom ; le reste des touches n'est écrit nulle part. Un écran de contrôles est aussi la **liste** des contrôles — même quand le joueur n'y change rien.

## Décisions actées (humain, 2026-08-24)

| # | Question | Décision |
|---|---|---|
| 1 | Périmètre appareils | **Clavier + manette.** Le tactile reste hors périmètre (gestes, pas de bindings discrets). |
| 2 | Emplacement | **Écran dédié « Contrôles »**, atteint depuis Réglages. 23 actions ne tiennent pas dans une ligne label/bouton. |
| 3 | Modèle de saisie | **Capture** : on active la case, l'écran dit « appuyez sur une touche », la frappe suivante est prise. |
| 4 | Conflit | **Échange automatique.** La touche quitte son ancienne action, qui reste avec un slot vide signalé — jamais de dialogue, jamais d'état invalide. |

### Décisions de conception qui découlent des 4 ci-dessus (à valider en revue de plan)

| # | Point | Choix | Pourquoi |
|---|---|---|---|
| 5 | Nombre de bindings par action | **2 slots** (principal / secondaire) | C'est exactement ce que fait déjà la table par défaut : flèches **+** ZQSD, `Digit1` **+** `Numpad1`. Une grille `action × 2` se lit d'un coup d'œil ; une liste ouverte demanderait des boutons « ajouter/retirer ». |
| 6 | `NumpadEnter` | **Perdu** (Confirmer garde `Espace` + `Entrée`) | Seule action à 3 bindings par défaut. Régression assumée et minuscule ; réassignable par le joueur, ce qui est précisément le sujet du plan. |
| 7 | Forme d'un binding clavier | `{ code, shift }` | Généralise les 3 bindings déjà modifiés par Maj (`Tab`, `PageUp`, `PageDown`, table `SHIFTED_BINDINGS`) au lieu de les laisser hors du remapping. La détection de conflit compare la **paire**, donc `Tab` et `Maj+Tab` ne se marchent pas dessus. |
| 8 | `Échap` / bouton B pendant une capture | **Annulent la capture**, donc **ne sont pas assignables** | Il faut une sortie inconditionnelle, sinon une capture ratée piège le joueur. Conséquence : Annuler garde `Échap` et B en dur ; c'est la seule paire non remappable. **Rendu** : la ligne *Annuler* affiche ses deux touches en gris, non focalisables, et la mention « fixe » remplace le bouton de capture — pas de cadenas ni d'icône d'interdiction (aucune tuile garantie dans la feuille Kenney, et un mot est plus clair qu'un pictogramme à 16 px). |
| 9 | Ce que la manette expose au remapping | **Boutons seulement** | Le d-pad → curseur, le stick droit → pan, le maintien de Y → défilement sont **structurels** (axes, maintien), pas des bindings. Les remapper demanderait un modèle d'entrée différent, hors sujet ici. |
| 10 | Capture clavier | Passe par **l'`InputSystem`**, pas par un `addEventListener` de plus | Le plan 184 a supprimé cinq écouteurs `keydown` éparpillés ; en rajouter un pour cet écran rejouerait exactement le problème. `InputSystem` gagne un mode capture consulté par son écouteur unique. |
| 11 | Persistance | Clé `pt-bindings` séparée de `pt-settings`, avec un champ `version` | Forme et cycle de vie différents (un schéma de bindings migre ; une bascule booléenne, non). Une clé à part permet un « Réinitialiser » qui ne touche pas la langue ni le plein écran. |
| 12 | Ce qui est stocké | Les **écarts** au défaut, pas la table entière | Un défaut qui change (nouvelle action, meilleure touche) doit atteindre un joueur qui a déjà sauvegardé. Stocker la table entière la fige au jour de la sauvegarde. |

### Décisions issues de la revue design (humain, 2026-08-25)

| # | Point | Décision |
|---|---|---|
| 13 | Les 4 actions de **panoramique caméra** n'ont aucune touche clavier et ne peuvent pas en avoir (l'`InputSystem` est en `keydown`, sans maintien) | **Lignes grisées, non éditables**, mention « stick droit uniquement ». Pas de panoramique clavier dans ce plan : une touche assignée là ne ferait rien en combat — un **binding fantôme**, pire que l'absence de binding. Le trou reste réel (au clavier seul la caméra ne se déplace pas) et part en § Reporté de `docs/next.md`. |
| 14 | `MenuNext` / `MenuPrevious` sont **mortes** : déclarées dans `logical-action.ts`, produites par aucune source, lues par aucun consommateur (vérifié, 2026-08-25 — les menus DOM naviguent par `CursorUp`/`CursorDown` + `focus-navigation.ts`) | **Supprimées** à l'étape B, où les tables sont déjà réécrites (règle projet « code mort : zéro tolérance »). Sans ça, l'écran ouvrirait deux lignes sans aucun binding sur les deux appareils. **Le compte d'actions passe de 25 à 23.** |
| 15 | Un slot `null` n'a pas toujours le même sens | **Deux états distincts, deux rendus.** *Vide de naissance* (l'action n'a jamais eu de second binding — le cas de la majorité) → tiret neutre, aucune alerte. *Vidé par un échange* → tiret **rouge + astérisque** (repère non-couleur) et message nommant ce qui est parti. Sans cette distinction, l'écran s'ouvre avec une quinzaine de cases rouges avant que le joueur ait touché à quoi que ce soit : le signal ne veut plus rien dire, et l'écran a l'air cassé au premier lancement. L'état « délogé » vit **en mémoire de session**, pas en persistance : après un rechargement, un slot vide est un slot vide. |
| 16 | Sortir d'une capture sans clavier ni manette | **Un bouton « Annuler » visible pendant la capture**, en plus d'`Échap`/B. La décision 1 sort le *remapping* tactile du périmètre — pas le droit de refermer une porte ouverte par un doigt curieux. Sans ça, un joueur tactile qui tape une case reste bloqué sur « Appuyez sur une touche » sans aucune issue. |

## Ce que ce plan ne fait pas

- **Pas de profils** (« mon setup manette » / « mon setup clavier » nommés) — un jeu de bindings par appareil, point.
- **Pas de remapping tactile** (voir décision 1).
- **Pas de remapping des axes** (voir décision 9).
- **Pas de refonte de l'écran Réglages** — une ligne de plus, rien d'autre. La refonte de l'écran de sélection d'équipe reste un chantier distinct (`docs/next.md`).
- **Pas de traitement du trou « la timeline CT défile sans le dire »** (relevé par la revue du plan 185) : c'est un problème d'indicateur visuel, pas de binding. Reste en § Reporté.
- **Pas de panoramique caméra au clavier** (décision 13). Le trou est réel — au clavier seul, la caméra ne se déplace pas — mais le combler demande un maintien de touche dans l'`InputSystem`, donc un modèle d'entrée continu qui n'existe pas encore. **À reporter en § Reporté de `docs/next.md` à la clôture de ce plan.**

## Architecture

### Le magasin de bindings — `packages/app/src/input/bindings-store.ts` (nouveau)

Une seule source de vérité pour « quelle entrée déclenche quelle `LogicalAction` », lue par les trois consommateurs existants (source clavier, source manette, légende) et écrite par le seul écran de contrôles.

```ts
/** Une touche : position physique + état de Maj. Deux slots par action. */
export interface KeyBinding { code: string; shift: boolean }

export interface BindingSet {
  /** Index 0 = principal, 1 = secondaire ; `null` = slot vide (conflit résolu par échange). */
  keyboard: Readonly<Record<LogicalAction, readonly (KeyBinding | null)[]>>;
  /** Index de bouton en *mapping standard* W3C, avant échange Nintendo. */
  gamepad: Readonly<Record<LogicalAction, readonly (number | null)[]>>;
}
```

- `DEFAULT_BINDINGS` reprend **exactement** la table du plan 184, réécrite par action (aujourd'hui elle est indexée par touche). C'est une transposition, pas un changement de comportement : le gate doit rester vert sans toucher un test de `keyboard-source`.
- **Les variantes Maj ne sont pas un cas particulier** : `Maj+Tab` et `Tab` servent deux actions **différentes**, donc chacune range son binding dans son propre slot 0. Aucune action ne porte « la même position avec deux valeurs de Maj ». Concrètement : `CycleTargetNext: [{ code: "Tab", shift: false }, null]`, `CycleTargetPrevious: [{ code: "Tab", shift: true }, null]`, `ScrollLogUp: [{ code: "PageUp", shift: false }, null]`, `ScrollTimelineUp: [{ code: "PageUp", shift: true }, null]`, idem `PageDown`. Le test de transposition de l'étape A couvre ces 6 paires nommément — ce sont les seules que l'ancienne forme rangeait dans des tables séparées, donc les seules qu'une transposition peut perdre en silence.
- **Côté manette, même transposition** : `BUTTON_ACTIONS` (`index → action`) devient `gamepad` (`action → index[]`), et `DPAD_ACTIONS` **reste où il est** — le d-pad n'est pas remappable (décision 9), il n'entre donc pas dans le magasin. Même test de fidélité que pour le clavier.
- Les tables de recherche (`code → action`) sont **dérivées** du jeu de bindings et mises en cache à chaque écriture — l'entrée est sur le chemin chaud (chaque frappe, chaque frame de poll), il n'est pas question d'y balayer un `Record` d'actions.
- `assign(action, slot, binding)` applique l'**échange** : si la touche est prise ailleurs, elle est retirée de son ancien couple (action, slot) — qui devient `null` — avant d'être posée. Retourne l'action délogée, pour que l'écran puisse la signaler.
- `reset()` et `resetAction(action)`.
- Persistance : `{ version: 1, keyboard: {…écarts…}, gamepad: {…écarts…} }` sous `pt-bindings`. Au chargement, `{ ...DEFAULT_BINDINGS, ...écarts }` par action. Une action inconnue (binding sauvegardé d'une version antérieure) est **ignorée puis purgée** à la première écriture — pas de résidu qui traîne d'une version à l'autre.
- **Politique de migration** (le reviewer l'a relevée comme non écrite) : un défaut qui change atteint tout joueur **qui n'avait pas personnalisé cette action** ; celui qui l'avait personnalisée **garde son choix**, y compris si le défaut a bougé. C'est le comportement voulu — une personnalisation explicite prime sur un défaut révisé, et la remettre d'office serait la trahir. **Aucune table de correspondance ancien → nouveau** n'est prévue : `version` est réservé à un changement de **forme** du fichier sauvegardé, pas à un changement de défauts.

### Lecture par les sources existantes

- `keyboard-source.ts` : `resolveKeyboardAction(event)` cesse de lire ses constantes de module et interroge la table dérivée. La **fonction pure** garde une variante prenant les tables en paramètre, comme aujourd'hui, pour que les tests unitaires n'aient pas besoin d'un magasin. `KEYBOARD_BINDINGS` / `SHIFTED_BINDINGS` / `UNSHIFTED_BINDINGS` disparaissent au profit de `DEFAULT_BINDINGS` (code mort : zéro tolérance).
- `gamepad-source.ts` : `pollGamepad(pad, state)` gagne un troisième paramètre (table `index → action`), défaut = table courante du magasin. L'**échange Nintendo reste avant** la recherche : c'est un fait matériel, pas une préférence (commentaire déjà en place, à conserver mot pour mot).
- `key-legend.ts` : `boundCode()` interroge le magasin. Rien d'autre à faire — le plan 185 a déjà fait passer la légende par la table plutôt que par des lettres retapées, précisément pour ce plan. **La légende suit donc le remapping gratuitement.** Elle est construite au montage du combat, et les bindings ne changent que depuis l'écran Réglages : pas besoin d'un rafraîchissement à chaud.

### Le mode capture — `InputSystem`

```ts
/** Entrée brute lue pendant une capture — jamais routée, jamais convertie en LogicalAction. */
export type CapturedInput =
  | { kind: "key"; code: string; shift: boolean }
  | { kind: "pad"; index: number };

/** Intercepte la prochaine entrée brute au lieu de la router. Retourne l'annulation. */
beginCapture(sink: (captured: CapturedInput) => void): () => void;
```

`CapturedInput` vit dans `bindings-store.ts` avec `KeyBinding` (même sujet : la forme d'une entrée physique), **pas** dans `logical-action.ts`, qui décrit l'exact opposé — ce que l'entrée *veut dire* une fois résolue.

- Tant qu'une capture est active, l'écouteur `keydown` unique **court-circuite** le routeur : `preventDefault()`, puis `sink({ kind: "key", code, shift })` — sauf `Escape`, qui annule la capture.
- `Ctrl` / `Alt` / `Meta` restent refusés (règle du plan 184 : ils appartiennent au navigateur et à l'OS). Une frappe qui les porte est ignorée, capture toujours en cours.
- Côté manette, le poller consulte le même mode : il émet l'**index brut** du premier bouton pressé (`{ kind: "pad", index }`) au lieu de router, et le bouton B (index logique 1, après échange Nintendo) annule.
- ⚠️ Le poller ne tourne que si un pad est connecté (`gamepadconnected`), et `getGamepads()` reste vide avant le premier geste. Une capture manette sur un pad jamais touché n'aura donc rien à lire : l'écran affiche la ligne manette **en attente** plutôt que de prétendre qu'aucun pad n'existe.
- 🔴 **Point à traiter pour la manette non standard** (trou n°2 de la motivation) : `pollGamepad` sort à `mapping !== "standard"`. En mode capture il doit **quand même lire les boutons** — sinon un pad Firefox non reconnu ne peut littéralement pas être configuré. Et hors capture, un pad non standard n'est routé **que si** le joueur a enregistré des bindings manette personnalisés. Sans ça, on retomberait sur les indices devinés que le plan 184 refusait à juste titre.

### L'écran — `packages/app/src/ui/dom/screens/controls-screen.ts` (nouveau)

- `ScreenId` gagne `"controls"` ; `SCREEN_TRANSITIONS` gagne `settings: ["main-menu", "controls"]` et `controls: ["settings"]`. Retour = `Échap` via `bindScreenInput`, comme tous les écrans de menu. ⚠️ `Échap` est aussi l'annulation de capture : la capture est vérifiée **avant** le retour d'écran, sinon la première capture ratée éjecte le joueur de l'écran.
- Réglages gagne une ligne `Contrôles` → bouton `Configurer` → `navigate("controls")`.
- Mise en page : une grille en 3 colonnes (**Action**, **Principal**, **Secondaire**), groupée par sections. Chaque case est un `<button>` : sa légende est le caractère de la touche (via `key-legend.ts`, qui sait déjà que `KeyQ` se dessine `A` en AZERTY) ou le nom du bouton manette.
- Bascule **Clavier / Manette** en tête d'écran, qui échange le jeu de colonnes. Une seule grille visible à la fois : 23 actions × 2 appareils × 2 slots ne tiennent sur aucun écran, et encore moins sur un téléphone. **Onglet ouvert par défaut = dernier appareil utilisé**, lu sur le `tracker` de l'`InputSystem` — la même règle « dernier appareil gagne » qui pilote déjà les glyphes.
- Un binding **modifié par le joueur** porte un repère discret (point) qui le distingue du défaut : l'écran sert aussi de référence à quelqu'un qui a oublié y avoir touché.
- Case en capture : libellé remplacé par « … », ligne d'aide « Appuyez sur une touche », **bouton « Annuler » visible** (décision 16). Une seule case en capture à la fois.
- Après un échange, la ligne de l'action délogée passe en **vidé par un échange** (tiret rouge + astérisque, décision 15) et un message nomme ce qui s'est passé : « `A` a quitté *Rotation caméra à gauche* ». Sans ce message, l'échange est silencieux et le joueur découvre la perte en combat.
- Boutons `Réinitialiser cette section` et `Tout réinitialiser`, **cliquables à la souris et au doigt**, pas seulement atteignables par la navigation au focus : c'est le filet de secours de quelqu'un qui vient justement de casser ses touches de curseur.

#### Sections et libellés (issus de la revue design, 2026-08-25)

Le groupe « Actions » du premier jet est renommé **Ciblage** : une fois Confirmer et Annuler rangés avec le curseur (c'est le même réflexe), il ne contenait plus que le cycle de cible — et personne ne cherche « comment passer à la cible suivante » dans une section appelée « Actions ».

| # | Section | Actions | Libellés FR |
|---|---|---|---|
| 1 | **Curseur & menus** | `cursor-up/down/left/right`, `confirm`, `cancel` | Haut · Bas · Gauche · Droite · Confirmer · Annuler *(fixe)* |
| 2 | **Ciblage** | `cycle-target-next/previous` | Cible suivante · Cible précédente |
| 3 | **Caméra** | `rotate-camera-left/right`, `pan-camera-up/down/left/right` | Rotation caméra à gauche · Rotation caméra à droite · Panoramique caméra — haut / bas / gauche / droite *(grisées, décision 13)* |
| 4 | **Zoom** | `zoom-in`, `zoom-out`, `zoom-level-1/2/3` | Zoom avant · Zoom arrière · Niveau de zoom 1 / 2 / 3 |
| 5 | **Panneaux** | `scroll-log-up/down`, `scroll-timeline-up/down` | Journal de combat — haut / bas · Chronologie CT — haut / bas |

« Journal de combat » reprend `log.title` déjà présent dans `fr.ts`, et « CT » est déjà exposé au joueur (`move.ctCost`) — aucun jargon nouveau.
- Navigation clavier/manette : la grille est faite de `<button>`, donc `focus-navigation.ts` (navigation spatiale du plan 184) la traverse sans code spécifique. **À vérifier à la main** : une grille de cette densité est le premier vrai test de la navigation spatiale.
- Responsive : sous la largeur d'un téléphone, la grille passe en **une colonne de cartes** (action en titre, ses deux slots dessous) — même approche que le plan 179.

## Étapes

### A — Magasin de bindings (aucun changement visible)

**Fichiers** : `packages/app/src/input/bindings-store.ts` (nouveau), `packages/app/src/input/bindings-store.test.ts` (nouveau), `packages/app/src/input/index.ts` (export).

Types (`KeyBinding`, `BindingSet`, `CapturedInput`), `DEFAULT_BINDINGS` transposée depuis le plan 184, tables dérivées + cache, `assign` avec échange, `reset`/`resetAction`, chargement/écriture `pt-bindings`.
`assign` retourne le couple (action, slot) délogé, et le magasin garde la liste des slots **vidés par un échange depuis le chargement** — état de session, jamais persisté (décision 15). C'est ce qui permet à l'écran de ne pas peindre en rouge les slots vides de naissance.
Tests unitaires : transposition fidèle aux défauts du plan 184 — **chaque paire touche→action de l'ancienne table se retrouve, les 6 variantes Maj nommément** —, transposition manette (`BUTTON_ACTIONS`), échange (la touche part de l'ancienne action, slot laissé `null`), aller-retour de persistance, écart sur action inconnue ignoré puis purgé, défaut révisé qui atteint le joueur non personnalisé et **ne réécrit pas** celui qui l'a personnalisé (décision 12).

### B — Les sources lisent le magasin

**Fichiers** : `keyboard-source.ts`, `gamepad-source.ts`, `key-legend.ts`, `logical-action.ts` (tous dans `packages/app/src/input/`).

**Suppression des deux actions mortes** (décision 14) : `MenuNext` / `MenuPrevious` quittent `logical-action.ts`. Vérifier au passage qu'aucun `Record<LogicalAction, …>` exhaustif ne casse — `CURSOR_ACTION_DIRECTION` est `Partial`, mais le compilateur est le juge.

`KEYBOARD_BINDINGS` / `SHIFTED_BINDINGS` / `UNSHIFTED_BINDINGS` et `BUTTON_ACTIONS` sont **supprimées** — leur contenu vit désormais dans `DEFAULT_BINDINGS`, et les tables de recherche que consultaient ces sources sont celles dérivées par le magasin. `DPAD_ACTIONS`, `SCROLL_BY_CURSOR_ACTION`, `NINTENDO_SWAPPED_BUTTONS` **restent** : structurels, hors remapping. `pollGamepad` gagne son 3ᵉ paramètre (table `index → action`).
**Aucun comportement ne change** : le gate doit passer sans qu'on retouche un test de comportement d'entrée. C'est le filet de sécurité de l'étape A.

### C — Mode capture

**Fichiers** : `input-system.ts`, `gamepad-source.ts` (sink brut), `input-system.test.ts` (nouveau ou étendu), `gamepad-source.test.ts`.

`beginCapture` dans `input-system.ts`, lecture brute côté clavier et côté manette, annulation par `Échap` / B, refus de `Ctrl`/`Alt`/`Meta`, lecture des pads non standard **en capture uniquement**.
Tests unitaires : capture qui court-circuite le routeur, annulation, frappe à modificateur ignorée sans clore la capture, `pollGamepad` en capture sur `mapping: ""`.

### D — Écran Contrôles

**Fichiers** : `packages/app/src/ui/dom/screens/controls-screen.ts` (nouveau), `packages/app/src/ui/dom/screens/settings-screen.ts` (une ligne `Contrôles` → `navigate("controls")`), `packages/app/src/app/screens.ts` (`ScreenId` + `ScreenParamsById` + `SCREEN_TRANSITIONS`), `packages/app/src/babylon-boot.ts` (le registre d'écrans, ligne `settings: () => createSettingsScreen(navigate)`), `packages/app/src/i18n/locales/fr.ts` et `en.ts`, `packages/app/src/styles/` (grille dédiée à côté de `menu-screens.css`).

**Nommage i18n** : clés plates comme le reste du fichier — `controls.title`, `controls.device.keyboard`, `controls.slot.primary`, `controls.capturePrompt`, `controls.swapped`, `controls.fixed`, `controls.resetSection`, `controls.resetAll`, une section par groupe (`controls.group.camera`…), et **un libellé par action** en `controls.action.<valeur de LogicalAction en camelCase>` (`controls.action.rotateCameraLeft`). La valeur de l'action est en kebab-case (`"rotate-camera-left"`) : la clé la recamelise plutôt que d'introduire des points supplémentaires dans un espace de noms déjà plat.

État vide signalé, message d'échange, réinitialisations.

### E — Manette non standard hors capture

**Fichiers** : `gamepad-source.ts`, `bindings-store.ts` (un `hasCustomGamepadBindings()`).

Routage d'un pad `mapping !== "standard"` **si et seulement si** des bindings manette personnalisés existent. C'est ce qui débloque le Switch Pro sous Firefox.
⚠️ **Cette étape n'est pas indépendante de C** : elle se sert de la lecture brute des pads non standard ouverte par le mode capture — sans capture, un tel pad ne peut pas être configuré, donc la condition d'activation ne peut jamais devenir vraie. Elle est séparée pour rester **coupable identifiable** si un pad se met à agir de travers, pas parce qu'elle serait exécutable seule. Enchaîner C → D → E, jamais E avant D (il faut pouvoir configurer le pad pour tester E).

### F — Tests e2e + recette

- Écran : capture d'une touche, échange (l'ancienne action se vide **et** le message apparaît), réinitialisation, persistance au rechargement de page, **annulation de capture par le bouton « Annuler »** (décision 16, le seul chemin qu'un joueur tactile puisse emprunter), et **aucune case rouge à l'ouverture d'un écran vierge** (décision 15 — c'est la régression la plus facile à réintroduire).
- Combat : une touche caméra réassignée fait bien tourner la caméra, **et la légende du plan 185 affiche la nouvelle lettre** — le lien légende ↔ bindings est la partie la plus facile à casser en silence.
- `docs/test-plan.md` : nouvelle section (écran de contrôles + réassignation), cases 🤖 pour tout ce qui précède. Restent 👁 : la capture **manette** (Playwright ne pilote pas `navigator.getGamepads()`, limite déjà actée au plan 184) et le confort de la navigation spatiale dans la grille.

## Risques et pièges

| Risque | Parade |
|---|---|
| La transposition de la table par défaut perd un binding en silence | Test unitaire de l'étape A qui compare la table dérivée à l'ancienne table du plan 184, paire par paire, avant sa suppression |
| `Échap` fait double emploi (annuler la capture / quitter l'écran) | Capture testée **avant** le retour d'écran ; couvert par un test e2e |
| Le joueur se rend le jeu injouable (Confirmer sans aucun slot) | L'échange laisse toujours l'autre slot ; `Tout réinitialiser` est visible en permanence. **Pas** de garde « au moins un binding » : elle interdirait des états transitoires normaux pendant la reconfiguration |
| Un pad non standard mal routé en étape E | Routage conditionné à l'existence de bindings personnalisés ; étape isolée |
| La navigation spatiale rame dans une grille dense | Vérification humaine explicite en recette ; c'est un écran, pas le combat — un ajustement de `focus-navigation` reste possible sans toucher au reste |
| Le chemin chaud d'entrée ralentit | Tables dérivées mises en cache à l'écriture, jamais recalculées à la frappe ni à la frame |

## Validation

Recette humaine, scénario par scénario (mode interactif) : réassigner une touche caméra et la voir dans la légende ; provoquer un échange et lire le message ; recharger la page ; réinitialiser ; reconfigurer un bouton manette et jouer un tour avec. **Commit WIP avant la chaîne de finalisation, re-test humain après**, commit définitif en amendement (règle dure `CLAUDE.md`).

## Ce que la validation humaine a changé (2026-08-25)

Le test scénario par scénario a remis en cause une partie du design écrit ci-dessus. Ce qui suit est ce
qui a été **livré**, et prime sur les sections antérieures là où les deux divergent (décisions #810-816).

| Retour | Livré |
|---|---|
| « Pas juste trois colonnes ? » | **Une seule table** Principal / Secondaire / Manette. Les onglets par appareil sont supprimés — l'alignement devient structurel, et la question de l'onglet par défaut disparaît. |
| « Pas besoin de secondaire pour la manette » | Colonne manette à **un** slot (`BindingCell = 0 | 1 | "pad"`). |
| « On s'en fout du panoramique » | Ses 4 lignes quittent l'écran ; il reste la bascule **« Inverser le stick droit »** (`pt-settings`, pas `pt-bindings` — c'est une préférence, pas un binding). |
| « C'est quoi Ciblage ? » | Section **« Prévisualisation AoE »** : ces touches ne choisissent pas la cible d'une attaque, elles choisissent **quel dégât on lit** parmi les Pokemon touchés. |
| « La chronologie est plus importante que le journal » | `Page ↑/↓` → **Barre d'ordre de jeu** ; `Maj+Page ↑/↓` → Journal. |
| « Un raccourci pour ouvrir/fermer le journal » | Action **`ToggleBattleLog`** (`J`), qui actionne le repli déjà présent du panneau, et section **Journal de combat** dédiée. |
| Libellés sur une ligne | « Scroll haut / bas », « Afficher/Masquer », colonne d'action en `vmin` et `white-space: nowrap`. |
| « Petit scroll sur mon 4K » | Rythme vertical resserré **et** plafonds des `clamp()` relevés : l'écran ne défile ni en 4K ni en 1440p. ⚠️ Bug trouvé au passage — la colonne était dimensionnée en `ch`, unité qui se résout sur la police du **conteneur** (16 px) et non sur celle des libellés. |
| « À la manette, ne pas aller sur les colonnes clavier » | `data-nav-skip="gamepad"` + filtre par source dans `focus-navigation.ts`. |

### Deux bugs de manette trouvés par la validation

1. **Manette muette sous Firefox.** `pollGamepad` refusait tout pad dont `mapping !== "standard"` (garde-fou du plan 184) — or Firefox renvoie une chaîne **vide** pour une Switch Pro pourtant standard. Aucun focus, jamais. On route désormais toujours avec les indices standard ; une erreur se corrige dans cet écran (décision #813).
2. **Anneau de focus invisible.** Le focus *était* posé (presser A changeait la langue), mais `:focus-visible` suit la modalité de la dernière interaction et ignore la manette. `[data-input-source="gamepad"] :focus` complète la règle (décision #814). ⚠️ Chromium masque ce défaut — une assertion sur l'`outline` calculé passe avec ou sans le correctif.
3. **Poller qui s'éteignait trop tôt** : délai de grâce + démarrage de rattrapage (décision #815).

## Suite

Le **menu de combat (pause)** — `Start`/`Échap` → quitter, Paramètres, Recommencer en solo — est noté en § Reporté de `docs/next.md`. C'est lui qui rendra cet écran atteignable sans quitter la partie.
