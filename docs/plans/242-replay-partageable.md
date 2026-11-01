# Plan 242 — Replay de combat partageable

**Statut** : done (2026-11-01) — recette humaine validée. Raisonnement et décisions au graphe : `plan-242`, `plan-242-implementation`, `decision-1180` à `decision-1187`.
**Origine** : choix de l'humain au `/next` du 2026-10-15, après discussion. Reprend l'idée 2 de
`idee-mode-spectateur-et-mode-replay`. Le **spectateur en direct** est écarté (« too much », à
reconsidérer si des joueurs le demandent) — il n'entre pas dans ce plan.

## Écarts au plan (livré le 2026-11-01)

Le texte ci-dessous, rédigé le 2026-10-15, décrit l'intention ; ce qui suit dit ce qui a été livré
différemment (la plupart de ces écarts viennent des retours de recette).

| Plan | Livré | Décision |
|---|---|---|
| Pas en arrière : détruire le combat affiché et le remonter | Reconstruction **sur place** jusqu'à l'action N (`fastForwardBattle`) : la scène, la carte et la musique restent, seuls les billboards et le chrome sont refaits (« segments » avec leur `AbortSignal`, `ChromeInsetProbe.forgetChrome`). Le remontage complet faisait un écran de chargement à chaque recul | `decision-1183` |
| Export autorisé en ligne à l'écran de victoire | **Hors ligne seulement** : en ligne, un abandon, un chrono ou une déconnexion finit la partie sans trace dans le journal, le replay s'arrêterait sans vainqueur. **Levé le 2026-11-01 par le plan 243** : les abandons sont enregistrés et rejoués, l'export est offert en ligne aussi | `decision-1184`, remplacée par `decision-1188` (plan 243) |
| Bouton de copie sur l'écran de victoire **et** dans le menu pause ; fichier `.json` proposé seulement si le code est trop long | Section « Replay » du dialogue de victoire (titre, avertissement gris, « Copier le code » + « Télécharger » toujours ensemble), fichier `.txt`. **Pas de bouton dans le menu pause** | `decision-1181`, `decision-1185` |
| Vitesse ×0,5 · ×1 · ×2 · ×4, « point le plus lourd du lot » : aucun réglage n'existait | L'hypothèse était fausse : l'horloge de combat `combatClock.setSlowMotion` (déjà utilisée par l'atelier des attaques) porte la vitesse, aucune file d'animation à modifier. Plus **clic droit = ralentir** (retour de recette) | `decision-1182` |
| (non prévu) | Journal de combat **ouvert par défaut** en replay, sauf sous le seuil étroit (mesuré à 568×320) | `decision-1186` |
| (non prévu) | Récapitulatif de victoire **sans durée** pour un replay : `getElapsedMs` et `durationMs` deviennent facultatifs | `decision-1185` |
| Libellé « Revoir un combat » | Tenu | — |

Confirmé tel que prévu : format `PTR1.` + enveloppe versionnée, `deflate-raw` + base64url sans
dépendance, refus d'un `buildVersion` différent, pas de lien partageable (`decision-1180`,
`decision-1181`), lecture par le chemin d'un tour distant, brouillard désactivé (`decision-1182`).
Ajouté à la revue de code : la carte d'un code est validée contre le registre et chargée par l'URL du
registre. Le spectateur en direct reste écarté (`decision-1187`).

## Objectif

Permettre de copier un combat fini sous forme de code court, de le recoller ailleurs (Discord, issue)
et de le rejouer à l'écran avec une barre de lecture, sans rien relancer côté moteur.

## Ce que tu verras à l'écran

- À la fin d'un combat (écran de victoire) et dans le menu pause : un bouton **« Copier le code du
  replay »**. Le code est une courte chaîne de texte, collable dans Discord ou une issue. Si le code
  dépasse la taille voulue (voir Pièges), un bouton **« Télécharger le replay »** (fichier `.json`)
  est proposé à côté.
- Dans le menu principal : une entrée **« Replay »** (libellé à trancher, voir Risques) avec un champ
  pour **coller un code**, et un bouton pour **charger un fichier** en repli — le fichier produit par
  « Télécharger le replay » est celui qu'on recharge.
- Le combat se rejoue **à l'écran, avec les animations**, sans que personne ne joue. Une barre de
  lecture : **lecture / pause, pas en avant, pas en arrière, vitesse (×0,5 · ×1 · ×2 · ×4)**.
- Un code produit par une **autre version du jeu** n'est pas rejoué de travers : un message clair dit
  « replay d'une ancienne version ».
- Rien ne change dans un combat ordinaire.

## Décisions déjà prises avec l'humain

1. **Format par entrées + version**, pas par événements (façon Showdown) : un code court, quitte à ce
   qu'un vieux code expire au patch. Format versionné dès le départ pour qu'un export par événements
   puisse s'ajouter plus tard sans rien casser. Les entrées sont exactement le type existant
   `BattleReplay` (`{ seed, actions }`, `packages/core/src/types/battle-replay.ts`), produit par
   `BattleEngine.exportReplay()` : le code l'enveloppe, il n'en redéfinit pas le contenu.
2. **Pas en arrière = repartir du début et rejouer vite**, sans animation (c'est ce que fait Showdown,
   et ce que fait déjà `resumeBattle`). Pas de machinerie de « défaire ».
3. **Code collable en priorité.** Un lien n'est **pas** fiable sur itch.io (le jeu tourne dans une
   iframe, la query string de la page parent n'y est pas transmise — fils du forum itch.io). Pas de
   lien dans ce plan.
4. **Compression native** : `CompressionStream('deflate-raw')` puis base64url. Aucune dépendance
   nouvelle (sinon : consulter l'humain avant).

## Points d'appui déjà dans le code (lus le 2026-10-15)

- `packages/app/src/app/battle-persistence.ts` : la sauvegarde de reprise porte déjà
  `{ mapUrl, setup, placementTeams, placements, seed, actions, buildVersion }` (plus `elapsedMs`, propre
  à la reprise, inutile ici), et `isValidSave` **jette** une sauvegarde d'un autre `buildVersion`. Le
  replay réutilise ces mêmes champs et cette garde.
- `packages/app/src/babylon/battle-resume.ts` : `buildBattle(inputs, map)` — le chemin partagé par la
  partie vive et la reprise — et `resumeBattle`.
- `packages/core/src/battle/replay-runner.ts` : `runReplay`, avec observateur d'actions.
- `packages/app/src/babylon/combat-screen.ts` : `runResolvedBattle`, et le point d'accroche
  `BattleOrchestrator["onTurnReady"]` (`wireScoredAi`) : un contrôleur reçoit le Pokémon actif et
  soumet son action. **Un lecteur de replay est un contrôleur de plus** qui soumet l'action suivante
  du journal, pour tous les camps.
- Contexte d'entrée `spectating` (plan 241) : la vue et le menu répondent, aucun geste de jeu.

## Conception

### 1. Format du code (core, pur — tests pendant le dev)

`ReplayCode` : `{ format: 1, buildVersion, mapUrl, setup, placementTeams, placements, seed, actions }`.
Sérialisation JSON → `deflate-raw` → base64url, préfixé d'un marqueur court (`PTR1.`) pour détecter
« ce n'est pas un code de replay » sans erreur obscure.

À trancher en dev, **par mesure** sur de vrais combats : dictionnaires d'identifiants courts avant
compression, ou JSON direct. On ne l'écrit que si le gain mesuré le justifie.

Où : fonctions pures d'encodage/décodage dans `packages/app` (le `setup` est un type d'app) ; la
compression est asynchrone (`CompressionStream`), donc l'API est asynchrone.

### 2. Capture

Le journal d'actions existe déjà pendant le combat. Il faut le **garder à la fin** : la sauvegarde de
reprise est supprimée à la victoire. Le code est construit depuis les mêmes entrées qui alimentent
`runResolvedBattle` (`inputs` + journal), disponibles à l'écran de victoire et au menu pause.

### 3. Lecteur

- Charge le code, vérifie `format` et `buildVersion`, charge la carte depuis `mapUrl` (opération
  asynchrone, à prévoir dans le flux d'entrée), reconstruit via `buildBattle(inputs, map)`.
- **Le lecteur ne relance jamais l'IA** : il soumet les actions du journal telles quelles, pour tous les
  camps. Les compteurs du filet anti-répétition (`repetition-guard.ts`, hors `BattleState`) ne servent
  donc pas au replay ; c'est une raison de plus de ne jamais recalculer un choix d'IA.
- Mode `spectating` en permanence (plan 241) ; contrôleur de lecture qui soumet l'action `i` quand
  l'orchestrateur est au repos et que la lecture est active.
- **Pas en avant** : soumet une action puis met en pause. **Vitesse** : multiplicateur sur la file
  d'animations. Vérifié le 2026-10-15 : aucun réglage de vitesse d'animation n'existe (recherche
  `speed|Speed` dans `combat-screen.ts`, `animationSpeed|timeScale|playbackSpeed|setSpeed` dans
  `packages/`) : c'est à construire, et c'est le point le plus lourd du lot.
- **Pas en arrière** : détruit le combat affiché, reconstruit, rejoue les `i-1` premières actions via
  `runReplay`/`resumeBattle` sans animation, remonte les sprites depuis l'état (chemin
  `spawnBillboardsFromState`, déjà corrigé au plan 241 pour les formes transformées).

### 4. Entrée « Replay » du menu

Champ de collage, validation, messages d'erreur distincts : pas un code / format inconnu / version
différente / journal rejeté par le moteur.

### 5. Multi-entrée (`.claude/rules/multi-input.md`)

Nouveaux contrôles : barre de lecture, champ de collage, bouton de copie. Les 4 axes sont obligatoires
(clavier, manette, tactile, responsive) avec la recette de mesure.

## Pièges connus à vérifier

- **Combat en ligne** : `setup.localSeat` est défini et les places distantes sont rabattues sur
  `human`. Les deux pairs ont le journal complet, donc le replay est possible, mais il faut vérifier
  que `buildBattle` reproduit le même combat (règle `reviveDefeatedCamps` dérivée de `localSeat`) —
  un replay doit se rejouer **comme la partie d'origine**, pas comme un combat local. Si ce n'est pas
  net, restreindre la v1 aux combats locaux et le dire.
- **Brouillard de guerre / informations cachées — TRANCHÉ (game-designer, 2026-10-15)** : le replay
  montre **tout** (fog désactivé, mode « lecture complète » déjà prévu côté vue). Un avertissement
  s'affiche au bouton de copie : « le code révèle toute l'équipe (objets, talents, attaques) ». Pas de
  point de vue par camp en v1 (serveur autoritaire, Phase 7). **Copier un code en cours de combat** :
  autorisé en local, **réservé à l'écran de victoire en ligne** (sinon l'adversaire verrait les cachés
  de l'autre camp avant la fin).
- **Taille du code** : mesurer avant de promettre « tient dans un message Discord » (limite 2000
  caractères). Le repli fichier existe pour ça.
- **`resumeBattle` jette un combat déjà fini** (anti soft-lock) : un replay est, par nature, un combat
  fini. Le replay ne doit **pas** passer par ce garde — utiliser `buildBattle` + `runReplay`, ou
  factoriser proprement.
- **Libellé « Replay » déjà pris** : `combat-screen.ts` (`onReplay`, l.682) désigne déjà « Replay » au
  sens « recommencer la partie » (dialogue de victoire, `canReplay`). Deux « Replay » dans l'interface
  se contredisent. Libellé retenu pour la nouvelle entrée : **« Revoir un combat »** (jamais « Replay » seul).
- **Aléatoire de présentation** : tout aléa non seedé côté rendu (cris, variations d'effets) est sans
  incidence sur le moteur, mais un replay ne sera pas identique « au pixel ».

## Tests

- **Core / pur (pendant le dev)** : aller-retour encodage/décodage ; rejet d'un code tronqué, d'un
  marqueur absent, d'un `format` inconnu, d'un `buildVersion` différent ; un journal rejoué reproduit
  l'état final de la partie d'origine.
- **Après la recette (menu de finalisation)** : e2e du menu Replay et de la barre de lecture,
  incluant le pas en arrière ; passe multi-entrée mesurée.

## Étapes

- [x] Étape 1 — Codec `ReplayCode` : encodage `BattleReplay` + métadonnées → JSON → `deflate-raw` →
  base64url, préfixe `PTR1.`, décodage avec rejets distincts (pas un code, format inconnu, version
  différente, tronqué). Mesurer la taille sur 3 vrais combats avant de trancher le dictionnaire.
- [x] Étape 2 — Capture : garder le journal à la fin de combat, bouton « Copier le code » sur l'écran de
  victoire et dans le menu pause, repli « Télécharger le replay » si le code est trop long.
- [x] Étape 3 — Lecteur : chargement (code ou fichier), `buildBattle` avec la carte de `mapUrl`,
  contrôleur de lecture branché sur `onTurnReady`, lecture / pause et pas en avant.
- [x] Étape 4 — Vitesse ×0,5 · ×1 · ×2 · ×4 : réglage de la file d'animations (aucun existant, voir
  Points d'appui). Probablement à scinder si la file ne se laisse pas accélérer simplement.
- [x] Étape 5 — Pas en arrière : reconstruction sans animation des `i-1` premières actions, remontée des
  sprites via `spawnBillboardsFromState`.
- [x] Étape 6 — Entrée « Replay » du menu : champ de collage, chargement de fichier, messages d'erreur.
- [x] Étape 7 — Barre de lecture et bouton de copie : 4 axes d'interface (`multi-input.md`), passe mesurée.

## Critères de complétion

- Un code copié après un combat local, collé dans le menu d'un autre poste (même build), se rejoue
  jusqu'à la même issue que la partie d'origine.
- Un code d'une autre version affiche « replay d'une ancienne version » ; un code tronqué ou non reconnu
  affiche un message distinct.
- Pas en arrière et vitesse fonctionnent pendant la lecture ; un combat ordinaire ne change pas.
- Tests core verts ; e2e du menu Replay et de la barre de lecture passent après recette.

## Risques / Questions

- **Libellé de l'entrée menu** : « Revoir un combat » (« Replay » est déjà pris : recommencer).
- **Emplacement du codec** : `packages/app` (le `setup` est un type d'app), donc hors du périmètre
  « tests pendant le dev, core seulement » de `CLAUDE.md` : ses tests s'écrivent au menu de
  finalisation, après la recette.
- **Brouillard de guerre** : tranché, tout est montré (voir Pièges).
- **Taille du code** : inconnue tant que l'étape 1 n'a pas mesuré de vrais combats.
- Pièges détaillés : combat en ligne, `resumeBattle`, aléa de présentation, libellé « Replay ».

## Dépendances

- Plan 241 (contexte `spectating`) : présent dans le code (`spectating` trouvé dans `combat-screen.ts` et
  `input-router.ts`), requis par le lecteur.
- Ce plan ne débloque rien dans l'immédiat ; l'idée de tutoriel commenté (`idee-tutoriel-replay-commente`)
  s'appuiera dessus plus tard.

## Hors périmètre

Spectateur en direct · lien partageable · replays par événements (survivant aux patchs) · base de
replays en ligne · commentaires sur un replay (voir `idee-tutoriel-replay-commente`).
