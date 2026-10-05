# Plan 228 — Modifier son équipe sans quitter l'écran de sélection

**Statut** : done
**Origine** : `backlog-éditer-son-équipe-depuis-le-salon-en-ligne-2026-09-03`, retenu par l'humain au
`/next` du 2026-10-05 (« peut-être plus tard » au cadrage du Lot B1).

## Ce que tu verras à l'écran

1. Sur ta carte de joueur, à côté de l'équipe choisie, un bouton **« Modifier »**.
2. Il ouvre l'éditeur d'équipe **par-dessus** l'écran : le salon en ligne reste ouvert, ta place
   gardée, les autres joueurs ne voient rien bouger.
3. Au retour, la carte montre l'équipe modifiée (nom, portraits), et c'est cette version qui part
   en combat — chez toi comme chez les autres pairs.
4. Dans la liste « Choisir une équipe », une ligne **« Nouvelle équipe »** : elle ouvre l'éditeur
   sur une équipe vide, assignée à ta place au retour.
5. Même chose en local (hot-seat) : c'est le même écran.

## Constat dans le code

- `SCREEN_TRANSITIONS` ne relie pas `team-select` à `team-edit`, et une transition détruirait
  l'état de l'écran (camps, format, réglages). D'où la **surcouche**, pas une navigation.
- `TeamEditView` est déjà autonome (`teamId`, `onBack`), chargement et sauvegarde compris :
  réutilisable tel quel.
- **La surcouche est une `Modal` (ui-dom) en variante `fullscreen`** — porteur nu, sans en-tête, ajoutée au plan (revue `/simplify`) pour hériter du démontage synchrone et d'Échap repris en main —, donc un `<dialog>` sur `document.body` — pas
  dans `root`, que `render()` vide à chaque re-rendu provoqué par le salon. Ce choix branche tout
  l'existant sans une ligne d'entrée en plus : `focusInDirection` et `closeOpenModal` visent le
  `<dialog>` ouvert le plus haut, donc les flèches restent dans l'éditeur, B (manette) ferme la
  modale du dessus, Échap (clavier) passe par la fermeture native (décision #822). Les sélecteurs de
  l'éditeur (Pokémon, capacités…) sont eux-mêmes des `<dialog>` : ils s'empilent au-dessus et se
  ferment en premier. **Pas de `bindScreenInput`** dans la surcouche : l'inscription de l'écran de
  sélection suffit, une seconde doublerait la gestion du retour.
- Le démontage passe par `onClose` de la `Modal`, quel que soit le chemin (Échap, B, bouton retour
  de l'éditeur qui appelle `close()`).
- **Sauvegarde identique à « Mes équipes »** : même `TeamEditView`, même stockage (`saveTeam`,
  différé de 300 ms). `destroy()` vide ce différé (`saveDebouncer.flush()`), donc à la fermeture :
  **destroy d'abord, relecture ensuite**, sinon la dernière frappe serait perdue.
- `slot.assignedTeam` est une copie. `assignTeamToSlot(slot, index, teamId)` **relit lui-même** le
  stockage (`loadTeam`) : le rappeler au retour, puis `announceSelection`, sinon le `start` partirait
  avec l'ancienne version. Aucune suppression d'équipe n'est possible depuis l'éditeur : pas de cas « équipe disparue » à
  traiter.

## Étapes

1. **`team-select-screen.ts`** — `openTeamEditor(slotIndex, teamId)` : ignoré si un éditeur est déjà
   ouvert ; `new Modal({ size: "fullscreen" })`, y monte `TeamEditView` (`onBack` → `close()`),
   focus sur le premier contrôle si la navigation est au focus. `onClose` : `destroy()`, puis
   `applyTeam` (assignation + annonce + rendu, tronc commun avec le choix d'équipe), focus rendu au
   bouton « Modifier ». `dispose()` de l'écran ferme l'éditeur (éjection vers le lobby, lancement par
   l'hôte) **sans** réannoncer au salon. **`ui-dom/Modal`** : variante `fullscreen`.
2. **`PlayerCell.ts`** — bouton « Modifier » (`data-testid="player-team-edit-button"`) visible si
   l'équipe est **sauvegardée** (pas aléatoire) et `teamEditable` — donc aussi pour l'hôte sur les
   lignes IA dont il compose l'équipe ; callback `onEditTeam(teamId)`.
3. **`TeamPickerModal.ts`** — bouton « + Nouvelle équipe » au-dessus de la liste :
   au clic, ferme la modale, crée et sauvegarde une équipe vide, l'assigne à la place, ouvre
   l'éditeur dessus. La création de `MyTeamsView.createNewTeam` (privée) est extraite en helper
   partagé dans `team/` plutôt que dupliquée (zéro code mort, pas de copie).
4. **i18n** — clé `teamSelect.players.edit` (fr/en/es) ; « Nouvelle équipe » réutilise `teamBuilder.newTeam` ;
   le message de liste vide renvoie au nouveau bouton au lieu du menu principal.
5. **Passe multi-entrée** (`.claude/rules/multi-input.md`) : 5 scénarios mesurés à la main.
   - **Clavier** : bouton « Modifier » atteint par flèches (`focusInDirection`), activé par Entrée,
     éditeur fermé par Échap, focus revient au bouton. Modales internes (sélecteur Pokémon) fermées
     par Échap sans fermer l'éditeur.
   - **Manette** : bouton atteint par directions spatiales, ouvert par A, éditeur fermé par B, focus
     restauré.
   - **Tactile** : bouton atteint, tapé, hit-area mesurée (min 30 px sous `pointer: coarse`).
     Éditeur intérieur (SlotCardsRow, EditLeftPanel) fonctionnel au toucher sans survol.
   - **Responsive** : téléphone portrait (568×320), paysage (667×375), tablette (1024×768). L'éditeur
     ne déborde pas, boutons restent tapables.

## Hors périmètre

- **État « Prêt » en ligne** : rien de neuf. Aujourd'hui déjà, on peut changer d'équipe en étant
  « Prêt » (`canEditSlot` ne regarde pas l'état prêt, `setSeatSelection` ne le remet pas à zéro).
  « Modifier » suit la même règle. Si l'hôte lance pendant qu'un invité édite, l'invité part avec
  la dernière version annoncée — celle d'avant l'ouverture de l'éditeur.
