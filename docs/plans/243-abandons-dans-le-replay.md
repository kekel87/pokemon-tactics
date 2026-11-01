# Plan 243 — Les abandons dans le replay

**Statut** : done (2026-11-01) — raisonnement et décisions au graphe : `plan-243`, `plan-243-implementation`, `decision-1188` à `decision-1190`.
**Origine** : retour de l'humain sur le plan 242 (« le replay doit se comporter comme le jeu »). Le
partage avait été réservé aux parties hors ligne (`decision-1184`) parce qu'un abandon ne laisse pas
de trace dans les données rejouées : ce plan corrige la cause et lève la restriction.

## Écarts au plan (livré le 2026-11-01)

Le texte ci-dessous, rédigé avant le dev, décrit l'intention ; ce qui suit dit ce qui a été livré
différemment ou n'a pas été fait.

| Plan | Livré |
|---|---|
| Forme des événements d'un abandon rejoué laissée ouverte (« même observateur ou second callback ») | **Même observateur** : `ReplayActionObserver` reçoit aussi les événements d'un abandon |
| Recette : partie en ligne à 3 avec abandon au milieu, puis abandon final | L'e2e (`e2e/tests/dom/online-replay.spec.ts`) joue un **duel** en ligne gagné par abandon final : copie du code, rejeu jusqu'à la victoire. Le cas à 3 camps est couvert par les tests core (`replay-runner.forfeit.test.ts`), pas par la recette en ligne. Recette faite par Claude à la demande de l'humain, qui n'a pas testé à la main |
| « Vérifier qu'en replay `applyForfeit` ne relance ni télémétrie ni salon » | Pas de résultat consigné pour cette vérification |

Confirmé tel que prévu : règle unique `dueForfeit` (eager), `forfeits` omis quand vide, `format: 1`
inchangé, `isReplayData` validant les abandons, section Replay masquée pour une partie interrompue,
sauvegarde de reprise portant les abandons (`decision-1188`, `decision-1189`). Limites assumées :
`decision-1190`.

## Ce que tu verras à l'écran

- En fin de partie **en ligne**, la section « Replay » (copier / télécharger) apparaît aussi, quelle
  que soit la façon dont la partie s'est finie.
- En revoyant une partie où un joueur a abandonné, s'est déconnecté ou a manqué trop de tours, ses
  Pokémon tombent K.O. **au même moment que dans la partie**, avec la même ligne de journal
  (« X quitte la partie »).
- À 3 joueurs ou plus, le replay continue après l'abandon jusqu'au vrai vainqueur, au lieu de
  s'arrêter au milieu.
- Le pas en arrière et le pas en avant franchissent l'abandon sans accroc.

## Constat (vérifié dans le code le 2026-11-01)

- `BattleEngine.forfeit()` (`packages/core/src/battle/BattleEngine.ts:1291`) met K.O. toute l'équipe
  et émet `PlayerForfeited`, mais **n'enregistre rien** dans `recordedActions` (la seule écriture est
  l.1422, dans `submitAction`). Choix assumé du plan 201, quand le journal ne servait qu'à la reprise.
- Les trois fins hors tour — abandon volontaire, absence (déconnexion ou tours manqués), états
  divergents **en 3 camps et plus** — passent par `forfeit()` (`online-battle.ts`, via
  `applyForfeit` de l'orchestrateur, `battle-orchestrator.ts:2271`).
- 🔴 **Une quatrième fin hors tour existe** : `interruptBattle()` (`battle-orchestrator.ts:3333`),
  appelée par `online-battle.ts` (~l.619) quand une divergence d'état tombe en 1v1. Elle termine
  l'écran en « Partie interrompue » **sans** passer par le moteur : ni `PlayerForfeited`, ni
  `BattleEnded`, ni trace dans le journal. Le plan doit dire ce qu'on fait de cette fin (voir
  « À trancher », point 3).
- Rejouer sans l'abandon : les Pokémon du partant restent debout, le moteur attend son tour, l'action
  suivante appartient à un autre joueur → refusée → le replay s'arrête.
- **Les abandons ne sont pas dans la sauvegarde de reprise non plus.** `persist()` écrit
  `currentReplayData()` (`combat-screen.ts:1492`) : tout ce qui n'est pas dans `exportReplay()`
  manque à la reprise. Une reprise après abandon rejoue sans l'abandon et diverge (même symptôme).

## Approche

### Core

- `BattleReplay` gagne `forfeits?: ReplayForfeit[]`, avec
  `ReplayForfeit = { afterAction: number; playerId: string; reason?: ForfeitReason }` —
  `afterAction` = `actionLogLength` au moment de l'abandon (nombre d'actions appliquées).
- Facultatif : les replays dorés (`golden-replay.test.ts` ne compare que `runReplay` sur un fichier),
  les sauvegardes et les codes existants restent valides tels quels.
- `exportReplay()` **omet** le champ quand la liste est vide (`{ seed, actions }` inchangé pour
  toute partie sans abandon) : ce n'est pas du cosmétique, les JSON comparés (`duplicated-execution`,
  codes déjà partagés) ne doivent pas bouger.
- `forfeit()` enregistre l'entrée **après succès seulement** (les refus — `BattleOver`,
  `InvalidAction` pour camp déjà éliminé — ne sont pas enregistrés).
- Règle de rejeu retenue (voir « À trancher », point 1) : **après chaque action appliquée, et avant la
  première, `runReplay` applique les abandons dont `afterAction` égale le nombre d'actions appliquées,
  dans l'ordre du tableau**. Conséquence : un abandon d'indice `n` est visible dès que le rang `n` est
  atteint. Un journal tronqué à `n` actions applique donc exactement les abandons `≤ n` : **aucun
  filtre à écrire dans `fastForwardBattle`**, mais ne pas réintroduire une règle « après la dernière »
  distincte — elle ferait appliquer en double ou à tort les abandons au bord de la troncature.
- Les événements produits par un abandon rejoué (`PlayerForfeited`, `PokemonKo`, `BattleEnded`) doivent
  **sortir par l'observateur** (`ReplayActionObserver`, aujourd'hui appelé seulement par action) :
  `fastForwardBattle` les pousse dans `logEvents`, et `resumeBattle` repère `BattleEnded` dans ce flux.
  Décider la forme (événements de l'abandon passés au même observateur, ou second callback).
- Tests core d'abord : abandon enregistré et rejoué à la bonne place ; abandon à l'indice 0 ; abandon
  après la dernière action (partie qui se finit) ; deux abandons au même indice (ordre) ; abandon
  refusé (partie finie, camp déjà éliminé) absent de `forfeits` ; abandon du partant pendant son tour ;
  partie à 3 qui continue jusqu'au vainqueur ; rejeu tronqué à `n` ; replay sans `forfeits` inchangé
  (JSON identique).

### App

- `ReplayData` gagne `forfeits?` ; `currentReplayData()` (`combat-screen.ts:1492`) le recopie depuis
  `exportReplay()`. `BattleResumeSave` en hérite (il étend `ReplayData`) : la sauvegarde de reprise
  porte les abandons sans autre changement de schéma.
- `isReplayData` (`replay-code.ts:104`) valide `forfeits` : tableau optionnel, chaque entrée avec
  `playerId` présent dans `placementTeams`, `reason` absent ou valeur de `ForfeitReason`, `afterAction`
  entier dans `[0, actions.length]`, tableau **trié** par `afterAction` croissant.
- 🔴 **La signature change**, contrairement à ce que dit l'ancien plan : `fastForwardBattle(inputs,
  actions, map)` et `resumeBattle(inputs, actions, map)` (`battle-resume.ts:103,120`) prennent un
  tableau d'actions. Il faut leur passer le replay complet (`{ seed, actions, forfeits }`). Appelants à
  mettre à jour : `startResumedBattle` (`combat-screen.ts:1774`), le segment de `startReplayBattle`
  (`combat-screen.ts:1884`), `battle-resume.integration.test.ts` et `mock-battle-resume.ts`.
- `fastForwardBattle` transmet le tout à `runReplay` (pas en arrière et reprise en profitent).
- Lecture (`replay-driver.ts`) : le pilote doit aussi livrer les abandons. Points de vigilance :
  - `applyForfeit` **ne doit pas être appelé de façon synchrone dans `onTurnReady`** (le pilote y est
    déjà appelé par l'orchestrateur) : même précaution que le premier tour de `deliver`
    (`queueMicrotask`, `combat-screen.ts:1902`).
  - Le pilote tient un curseur sur les abandons déjà appliqués, distinct du curseur d'actions.
- 🔴 **Fin de lecture à revoir** : aujourd'hui `onActionCommitted` (`combat-screen.ts:1939`) arrête le
  pilote dès que `actionLogLength >= total`. Un abandon d'indice `total` (partie à 3 qui se termine
  sur un abandon, le cas exact de la puce « fin ») ne serait jamais livré. Condition à écrire :
  « journal épuisé **et** abandons épuisés ». `deliverNext` (`replay-driver.ts:50`) traite
  `action === undefined` comme fin : il doit d'abord vider les abandons restants.
- Compteur de la barre : `refreshBar` lit `actionLogLength` (`combat-screen.ts:1850`) et `total =
  data.actions.length` (l.1824). Les abandons n'avancent pas le compteur (voir point 2).
- `replayExport` proposé en ligne comme hors ligne : la condition `localSeat === undefined` tombe
  (`combat-screen.ts:1672`). Le commentaire juste au-dessus (« en ligne, … le replay s'arrêterait sans
  vainqueur ») devient faux et doit être réécrit.
- Format du code : `format: 1` inchangé (champ facultatif). Un code d'un autre build est déjà refusé
  par `buildVersion` (`replay-code.ts:161`), donc aucun ancien lecteur ne rejoue faux un code avec
  abandons.

## Hors périmètre

- Bouton de copie dans le menu pause (écart assumé du plan 242).
- Tout changement du protocole réseau : chaque pair applique déjà l'abandon, il l'enregistrera aussi.
  Chaque pair exporte **son** journal local : l'ordre des abandons est celui de son moteur.

## Tranché (2026-11-01, recommandations retenues — choix techniques sans effet de jeu)

1. **Rang au repos : eager.** Un abandon d'indice `n` est visible dès le rang `n`, comme dans la partie.
2. **Barre** : `total` = actions seules ; un abandon part tout seul quand son rang est atteint (y compris
   l'abandon final, après la dernière action).
3. **Partie interrompue** (divergence 1v1, `interruptBattle`) : **pas de section Replay**. Il n'y a ni
   fin ni vainqueur à montrer, et le journal local est justement celui dont on doute.
4. **Pas en arrière** : reculer de `n+1` à `n` garde l'abandon `n` ; de `n` à `n-1` le retire.

Limites assumées (avis `game-designer`) :
- Le message réseau d'abandon ne porte pas d'indice d'action : deux pairs peuvent exporter des replays
  qui diffèrent sur la dernière action autour d'un abandon. Écart déjà présent en partie, hors
  périmètre.
- Lien du Destin et Rancune s'appliquent à un abandon comme à tout K.O. (choix du plan 201) ; le replay
  le rend seulement visible. Pas de changement ici.
- Vérifier qu'en replay `applyForfeit` ne relance ni télémétrie ni salon.

## Critères de complétion

- Les tests core listés ci-dessus passent ; `golden-replay` et `duplicated-execution` inchangés.
- Recette : partie en ligne à 3 avec abandon au milieu, puis abandon final → replay identique à la
  partie (K.O., journal, vainqueur), pas en arrière franchit l'abandon.
- Reprise d'une partie sauvegardée après un abandon : la partie reprend sans divergence.

## Dépendances

- Plan 242 (replay de combat partageable) : ce plan lève sa restriction « hors ligne seulement ».
- `decision-1184` (partage hors ligne seulement) est remplacée par `decision-1188`.
