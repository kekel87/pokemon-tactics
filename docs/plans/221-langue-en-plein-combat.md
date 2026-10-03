# Plan 221 — Changer la langue en plein combat

**Statut** : done
**Origine** : `agenda-langue-menu-pause-combat` (note de l'humain, 2026-10-03). Portée arrêtée le 2026-10-03 :
**bascule immédiate de tout l'écran**, contre l'option « différée à la fin du combat ».
**Renverse** la décision #828 (2026-08-25), dont la condition de réouverture — journal migré en i18n — est remplie
depuis le plan 190.

## Ce que tu verras à l'écran

- Menu de combat → Paramètres : le bouton **FR / EN** est de retour, au placement comme en combat, hors ligne comme en ligne.
- Un clic : en fermant le menu, **tout** l'écran est dans la nouvelle langue — journal (y compris les lignes déjà écrites),
  barre d'actions, sous-menu d'attaques, fiches Pokemon / case / prévision, bandeau de tour, boutons, panneau de placement.
- Le journal garde sa position de défilement ; une visée ou un sous-menu ouvert est retrouvé intact.
- Seuls les textes flottants **déjà en l'air** au moment du clic finissent dans l'ancienne langue (ils durent ~1 s).
- En ligne, chaque joueur garde sa langue : rien ne transite par le réseau.

## Constat (cartographie du 2026-10-03, 25 surfaces)

- **Traducteurs déjà vivants** : `uiConfig.translate`, `presentationContext.translate`, `PLACEMENT_UI_CONFIG` appellent `t()` à chaque usage.
- **Cause commune du figement** : `combat-screen.ts:736` capture `const language = getLanguage()` une fois ; il nourrit
  `pokemonNameOf`, `abilityNameOf`, `itemNameOf`, le `getMoveName` et le `language` du journal.
- **Figés, du code à écrire** : lignes du journal (texte DOM, aucun événement gardé), titre du journal, noms d'attaques du
  chrome (`battle-chrome.ts:185` capture `config.getLanguage()`), libellés des boutons plein écran / menu de combat,
  libellé du chrono de placement en ligne.
- **Vivants au prochain rendu, à pousser** : menu d'actions, ligne d'instruction, bandeau de tour, info-bulle d'attaque
  (causes contextuelles construites à l'entrée du sous-menu), fiches info / curseur / case, prévision de combat, météo /
  Vent Arrière, roster et panneau d'attente du placement.
- **Déjà vivants / sans objet** : menu de combat lui-même, avis de connexion, chrono (chiffres), frise (portraits),
  étiquette d'estimation dans la scène, dialogue de victoire (inatteignable : le bouton menu est grisé sous une modale).
- **Hors périmètre** : panneau sandbox du studio (outil de dev), repli AZERTY/QWERTY des capuchons de touche
  (`key-legend.ts:114`, ne sert que sans `navigator.keyboard`).

## Changements

### 1. Le bouton revient
`ui/dom/panels/settings-panel.ts` : retrait de la garde `if (!embedded)` et de son commentaire (#828). Le panneau se
reconstruit déjà sur changement de langue.

### 2. Résolveurs vivants
`babylon/combat-screen.ts` : suppression de la capture ; chaque résolveur lit `getLanguage()` à l'appel.
`BattleLogContext.language` (ui-dom) devient lu à chaque formatage (accesseur dans le littéral, interface inchangée si
possible ; sinon `getLanguage: () => Language`).

### 3. Journal réécrivable
`ui-dom/src/battle-log.ts` : le journal garde les `BattleEvent` reçus (pas de plafond aujourd'hui — on reste ainsi) et
expose `relocalize()` : titre retraduit, `list.replaceChildren()`, re-`report` de chaque événement, défilement restauré
(collé en bas s'il l'était, sinon même ratio). Les événements de reprise (`initialLogEvents`) passent par le même chemin.

### 4. Chrome et orchestrateur
- `battle-chrome.ts` : `config.getLanguage()` lu à chaque usage (noms d'attaques, `alt` des types).
- `battle-orchestrator.ts` : nouvelle méthode publique `relocalize()` — `updateTurnInfo`, `refresh*Panel`,
  `refreshCombatPreview`, puis ré-entrée de la phase d'entrée courante (menu d'actions / sous-menu / attaque choisie)
  **sans** passer par `refreshUI()`, qui déclenche `onTurnReady` (crochet IA / pair distant).
- Boutons plein écran et menu de combat : `setLabel()` (ou réaffectation `aria-label` / `title`).

### 5. Placement
`PlacementChrome` / `PlacementFlow` : abonnement propre, désabonné dans leurs `dispose()` ; relance `showRoster(...)`,
`refreshWaitingPanel()`, libellé du chrono de placement, libellés des boutons.

### 6. Un seul abonnement par phase
`runBattle` : `onLanguageChange(() => { battleLog.relocalize(); orchestrator.relocalize(); …labels })`, désabonné sur
`signal` abort. Idem placement (§5). La bascule s'exécute pendant que le menu est ouvert : le plateau derrière est déjà
retraduit à la fermeture.

## Hors périmètre

- Aucun changement du core ni du protocole : `NETWORK_VERSION` inchangé.
- Pas de 3ᵉ langue.

## Tests (après recette, au menu)

- e2e : en combat, ouvrir le menu → Paramètres → basculer → vérifier menu d'actions, titre et lignes **anciennes** du
  journal en EN ; idem au placement.
- Unitaire ui-dom : `relocalize()` du journal réécrit les lignes existantes et préserve l'ordre.
- Retrait d'aucun test existant (aucun n'asserte l'absence du bouton en combat).

## Multi-entrée

Contrôle réintroduit dans un panneau existant : passe mesurée clavier / manette / tactile / responsive
(`.claude/rules/multi-input.md`) — focus conservé sur le bouton après reconstruction du panneau embarqué.

## Docs

Décision nouvelle renversant #828 (doc-keeper, au menu).
