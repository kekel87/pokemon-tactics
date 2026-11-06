# Plan 246 : un replay refusé le dit au joueur

**Statut** : done

| Écart au plan | Raison |
|---|---|
| Libellés des messages réécrits | Proposition de game-designer : « journal » était du jargon |
| Le message s'efface au clic sur « Revoir un combat » | Relecture `/relire-code` : il restait sous la fenêtre d'import |
**Ouvert le** : 2026-11-06, solde `backlog-replay-code-refuse-sans-message`
**Bloque la release ?** : non

## Ce que tu verras à l'écran

- Un code de replay bien formé mais dont le journal est rejeté par le moteur ramène au menu principal avec
  le message « Ce replay ne peut pas être rejoué : une de ses actions est impossible (code modifié ou autre
  version du jeu). ».
- Si c'est le chargement qui échoue (carte, sprites, réseau coupé), le menu affiche « Le replay n'a pas pu
  se charger. Vérifie ta connexion et réessaie. ».
- Le message se traduit si on change de langue et disparaît dès qu'on quitte le menu ; un replay valide
  se lance exactement comme avant.

## Constat

`combat-screen.ts`, branche `replayData` : le `catch` ne couvre que le chargement et ne fait qu'un
`console.warn` avant de revenir au menu. Le journal, lui, n'est jamais vérifié en entier : le lecteur
démarre à l'action 0, et une action rejetée en cours de lecture (`submitRemoteAction` → `"rejected"`)
arrête juste le pilote, sans rien dire. Le plan 242 §4 prévoyait un message pour « journal rejeté par
le moteur ».

## Ce qu'on fait

1. **Vérifier tout le journal avant de lancer la lecture.** Dans le `try` de la branche replay, après le
   chargement de la carte, appeler une fois `fastForwardBattle(inputs, data, map)` (pur, sans rendu) :
   le moteur étant déterministe, si le rejeu complet passe, la lecture animée passera aussi. Une erreur
   levée là est classée « rejeté » ; toute autre erreur du `try` est classée « chargement ».
2. **Paramètre de retour au menu.** `ScreenParamsById["main-menu"]` devient
   `{ readonly replayFailure: ReplayFailure } | undefined`, même modèle que `lobby.refusal` (plan 209).
   `ReplayFailure` = `rejected | loadFailed`, à côté de `ReplayCodeError` dans `replay-code.ts`.
3. **Le menu affiche la cause**, dans le même élément `mn-error` que l'échec de reprise, avec un
   `data-testid="replay-error"`.
4. **i18n** : `replay.error.rejected` et `replay.error.loadFailed` en fr, en, es.

Le `console.warn` reste : il garde la cause technique pour le débogage.

## Hors périmètre

Les points de `backlog-replay-codes-points-mineurs` (garde de version, liste noire, préfixe, guillemets,
plafond de longueur).

## Critères de complétion

- Recette 1 : un code dont une action est falsifiée (cible hors portée), produit en console, ramène au
  menu avec le message « rejeté » (`data-testid="replay-error"`).
- Recette 2 : un code valide, copié après un combat local, se rejoue jusqu'à l'écran de victoire.
- `pnpm typecheck` vert.
