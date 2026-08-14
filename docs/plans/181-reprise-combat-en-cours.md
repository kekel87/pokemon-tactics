# Plan 181 — Reprise d'un combat en cours (lot 180-c)

- **Statut** : `done` — livré et validé en human-testing le 2026-08-14 (3 scénarios : reprise après rechargement, effacement à la fin du combat, menu à 6 entrées sur petit écran)
- **Date** : 2026-08-14
- **Origine** : lot **180-c** du [plan 180](./180-comportement-plateforme-mobile.md), laissé `draft` comme « plan à part, gros, review core ». Retour humain n°4 du 2026-08-06 sur téléphone réel : *« le téléphone se met en veille et ça recharge le site »*. Les lots 180-a/180-b ont traité tout ce qui pouvait l'être sans toucher au combat (plein écran, Wake Lock, reprise du **menu** courant) ; un combat en cours reste perdu au rechargement, et c'est le seul vrai remède au retour n°4.
- **Prépare aussi** : la reprise en **multijoueur** (rechargement ou perte de connexion) — voir § Préparation Phase 7, demandée par l'humain à l'ouverture du chantier.

## Le problème réel

Sur téléphone, le navigateur **décharge l'onglet** sous pression mémoire (écran verrouillé, bascule d'application). Aucune API web ne l'empêche — c'est une décision de l'OS/navigateur, et le Wake Lock du 180-b ne couvre que la veille, pas la décharge. La seule réponse robuste est de **survivre au rechargement**, pas de l'éviter. 180-b l'a fait pour les écrans de menu ; il reste le combat, qui est justement la session longue.

## Approche retenue : rejouer le journal d'actions, pas sérialiser l'état

Le plan 180 supposait qu'il fallait « sérialiser l'état du moteur ». **L'audit du code montre qu'il existe déjà tout ce qu'il faut pour ne pas le faire** :

| Brique existante | Fichier |
|---|---|
| `BattleReplay { seed, actions }` | `packages/core/src/types/battle-replay.ts` |
| `BattleEngine.exportReplay()` — seed + toutes les actions validées | `packages/core/src/battle/BattleEngine.ts:390` |
| Enregistrement d'une action **à chaque `submitAction` réussi** (humain **et** IA) | `BattleEngine.ts:1296` |
| `runReplay(replay, createEngine)` — rejoue un journal sur un moteur neuf | `packages/core/src/battle/replay-runner.ts` |
| PRNG de combat injecté et **seedé** (`createPrng(seed)`) | `BattleSetup.ts:266`, `utils/prng.ts` |
| Test golden : le même seed + les mêmes actions redonnent le même combat | `battle/golden-replay.test.ts` |

La sauvegarde est donc **`{ setup + seed + actions }`**, et la reprise reconstruit le moteur puis rejoue les actions. Conséquences :

- **Exact par construction.** L'état du PRNG, les jauges de Charge Time, les compteurs (`toxicCounter`, paliers de Stockage, `usedDefenseCurl`), les révélations du fog (plan 176), les hazards, les frappes différées : tout se reconstruit, parce que c'est le même code qui les a produits la première fois. Rien à énumérer, donc rien à oublier — le mode d'échec classique d'une sérialisation manuelle (un champ ajouté six mois plus tard qu'on oublie dans le sérialiseur) est **structurellement absent**.
- **Aucune surface core nouvelle à écrire.** Le moteur n'a pas besoin d'un `serialize()`/`deserialize()`, ni d'un PRNG à compteur (le nôtre est une fermeture, non sérialisable en l'état).
- L'IA n'a **pas** besoin d'être déterministe : on rejoue ses **actions enregistrées**, pas ses décisions. (Son PRNG est aujourd'hui `createPrng(Date.now())` — `combat-screen.ts:372` — et le reste.)

### Alternative écartée : sérialiser `BattleState`

`BattleState` est de la donnée simple (`grid`, `Map<string, PokemonInstance>`, zones, hazards), mais l'état de combat **ne s'y limite pas** : le PRNG est une fermeture, et `BattleEngine` porte de l'état privé hors `state` (`chargeTimeTurnSystem`, `confusionChecked`, `flinchedThisTurn`, `battleOver`, `startupEvents`). Il faudrait donc : un PRNG à compteur, un contrat de sérialisation sur le moteur, une migration à chaque nouveau champ de `PokemonInstance`, et une revue core lourde. Pour un gain unique : ne pas payer le coût du rejeu. Or ce coût est négligeable (§ Risques). Écarté.

## Décisions tranchées avec l'humain (2026-08-14)

| Question | Décision | Pourquoi |
|---|---|---|
| **Comment reprendre ?** | **Entrée « Reprendre le combat » au menu principal**, visible seulement si une sauvegarde valide existe. Pas de reprise silencieuse dans le combat, pas de modale au boot. | Prévisible : le boot reste le menu, le joueur décide. Une remontée silencieuse en plein combat surprend, et une modale à chaque sortie de veille ajoute une friction au cas le plus fréquent. |
| **Journal de combat au retour ?** | **Reconstruit intégralement** : les events renvoyés par chaque action rejouée sont repassés dans le journal. | On revient après une coupure sans savoir où on en était ; le journal est précisément ce qui le raconte. Le panneau plafonne déjà à 50 lignes (`MAX_LOG_ENTRIES`), donc un long combat ne le fait pas exploser. |
| **Granularité de sauvegarde ?** | **Après chaque action validée** (déplacement, attaque, fin de tour). | Gratuit avec le rejeu (on ajoute une action et on réécrit quelques Ko) et plus précis qu'une borne de tour : un rechargement au milieu d'un tour restaure le Pokemon déjà déplacé, attaque non jouée. |

## Invariants à tenir

1. **Le journal d'actions est la seule source de vérité.** On ne persiste **jamais** d'état dérivé (PV, positions, jauges). Tout ce qui est dérivé se recalcule ; tout ce qui est persisté doit être une entrée du moteur.
2. **Le chemin de production reste déterministe.** Une seule entropie par combat (le `seed` tiré au démarrage), aucun `Math.random` sur le chemin livré. **Ce n'est pas encore vrai** : `createBattleFromPlacements` retombe sur `creationRng = Math.random` (`BattleSetup.ts:186`) quand l'appelant n'en fournit pas, et le chemin live n'en fournit pas. Les genres non fixés par le Team Builder sont donc tirés hors seed → un genre pourrait **changer à la reprise** (et le genre n'est pas cosmétique : Attraction en dépend). **Corrigé dans ce plan** en passant `creationRng: createPrng(seed)` côté live, ce qui aligne le chemin live sur le sandbox et sur le commentaire déjà présent dans le code.
3. **Une sauvegarde qu'on ne sait pas rejouer est jetée, jamais devinée.** Version de sauvegarde ou build différents, rejeu qui lève, combat déjà terminé → on efface et on n'affiche pas l'entrée de reprise. Jamais de demi-restauration.
4. **La reprise ne rejoue rien à l'écran.** Les events du rejeu alimentent le **journal seul** — pas les textes flottants, pas les animations, pas la caméra. Sinon la reprise rediffuserait tout le combat en dégâts volants.

## Étapes

### 1. Core — rien à ajouter, deux points à vérifier

- [ ] Vérifier que `runReplay` convient tel quel au chemin de reprise (il déduit le `playerId` de l'acteur courant et lève si une action est rejetée). Si un besoin de rejeu **silencieux** apparaît (renvoyer un échec plutôt que lever), l'ajouter comme variante — sans toucher `runReplay`, utilisé par le golden.
- [ ] Faire remonter les events du rejeu : `runReplay` les jette aujourd'hui. Ajouter un rappel optionnel `onAction?(events)` (ou renvoyer les events agrégés) pour alimenter la reconstruction du journal. Export public → test unitaire obligatoire (`.claude/rules/core.md`).

### 2. `packages/app` — la sauvegarde

- [ ] Nouveau `packages/app/src/app/battle-persistence.ts`, voisin de `screen-persistence.ts` (même famille, même style : `try/catch` autour de `localStorage`, validation à la lecture sans `as`).
  - Clé `pt-battle-resume`.
  - Charge utile versionnée :

    ```ts
    interface BattleResumeSave {
      version: number;        // schéma de la sauvegarde
      buildVersion: string;   // __APP_VERSION__ au moment de la sauvegarde
      mapUrl: string;
      setup: CombatSetup;             // équipes + format + autoPlacement
      placementTeams: PlacementTeam[];
      placements: PlacementEntry[];   // positions + orientations résolues
      seed: number;
      actions: Action[];
      savedAt: number;
    }
    ```

  - `saveBattleProgress` / `loadBattleProgress` / `clearBattleProgress`. La lecture **valide** (version, build, formes) et renvoie `null` sinon.
  - **Pas de péremption temporelle** ici, contrairement à `screen-persistence` (1 h) : un combat en cours est un engagement, pas un écran laissé derrière soi. Il ne disparaît qu'à la fin du combat, au retour au menu, ou sur incompatibilité.
  - Interface exposée sous forme de **port** (`load` / `save` / `clear`), pour que le multijoueur remplace le magasin sans toucher l'écran de combat (§ Préparation Phase 7).
- [ ] Invalidation sur changement de build : `buildVersion` comparé à `__APP_VERSION__` (déjà injecté par `vite.config.ts`). Une mise à jour du jeu peut changer un move ou une formule ; un rejeu dériverait alors silencieusement. On préfère perdre la reprise que restaurer un combat faux.

### 3. `packages/view-core` — le point d'accroche

- [ ] `BattleOrchestratorConfig` gagne `onActionCommitted?: () => void`, appelé après chaque grossissement du journal d'actions du moteur : après un `submitAction` réussi (`battle-orchestrator.ts:1117`) **et** après le retour du crochet IA (`refreshUI`, `:519` — l'IA soumet ses actions elle-même dans `AiTeamController.playTurn`).
- [ ] L'app y branche `saveBattleProgress(...engine.exportReplay())`. L'orchestrateur ne connaît **ni** `localStorage` **ni** le format de sauvegarde (le core et view-core restent sans dépendance plateforme).

### 4. `packages/app` — la reprise

- [ ] `ScreenParamsById["combat"]` gagne `resume?: BattleResumeSave`. Avec `resume`, `mountContent` **contourne la phase de placement** :
  1. `loadTiledMap(mapUrl)` → `MapDefinition`.
  2. `createBattleFromPlacements({ map, teams: placementTeams, placements, seed, creationRng: createPrng(seed), ...buildTeamOverrides({ teams: setup.teams }) })` — exactement l'appel du chemin live (`combat-screen.ts:396`), avec les placements persistés au lieu de ceux que le joueur venait de poser.
  3. Rejouer `actions` sur ce moteur, en collectant les events.
  4. Faire apparaître un billboard par Pokemon **depuis l'état du moteur** (positions courantes, K.O. compris) — le chemin sandbox fait déjà exactement ça (`combat-screen.ts:491-499`), à réutiliser plutôt qu'à réécrire.
  5. `runBattle({ ..., initialLogEvents })` : les events sont poussés dans **`battleLog.report`** seul, jamais dans le `feedback` composé (invariant 4), avant `orchestrator.start()`.
- [ ] `runBattle` gagne `initialLogEvents?: readonly BattleEvent[]`. Le reste (chrome, fog `enemyInfoHidden: true`, `humanPlayerIds`, câblage IA) est **identique au chemin live** — la reprise ne doit pas devenir un second chemin de combat.
- [ ] Effacement de la sauvegarde : sur `BattleEventType.BattleEnded` (observé dans le `feedback`) et sur `onExit` (retour au menu). Un « Replay » (re-montage interne, `combat-screen.ts:759`) repart d'un combat neuf → efface aussi.
- [ ] La route de dev `?combat=1` et le studio sandbox **ne participent pas** : entrées explicites de développement, elles restent déterministes (même règle qu'en 180-b).

### 5. Menu principal — l'entrée de reprise

- [ ] `main-menu-screen.ts` : première entrée **« Reprendre le combat »**, affichée seulement si `loadBattleProgress()` renvoie une sauvegarde valide, au-dessus de « Combat ». Elle navigue vers `combat` avec `{ mapUrl, setup, resume }`.
- [ ] Ligne secondaire ou libellé indiquant **de quoi il s'agit** (nom de la carte), pour qu'on sache ce qu'on reprend. Pas d'aperçu, pas de compteur de tours : l'information utile est « il y a un combat, reprends-le ».
- [ ] `aria-pressed` n'a pas lieu d'être ici (bouton d'action, pas bascule), mais l'entrée suit les mêmes règles que les autres (`.claude/rules/html.md`, focus clavier, cible tactile ≥ 30px sous `pointer: coarse` — plan 179).
- [ ] Cohérence avec 180-b : la reprise d'**écran** ramène au menu principal, où l'entrée est visible. Les deux mécanismes se complètent au lieu de se concurrencer.

### 6. Tests

- [ ] **Unitaire** (`packages/app`) : `battle-persistence.test.ts` — aller-retour, rejet d'une version inconnue, rejet d'un `buildVersion` différent, rejet d'un JSON corrompu, `clear`. ⚠️ Utiliser un stub `localStorage` — trois stubs faits main existent déjà dans ce package (dette notée au plan 180) ; **converger vers un helper partagé** ici plutôt que d'en ajouter un quatrième.
- [ ] **Unitaire** (`packages/core`) : le rappel d'events du rejeu (export public → test obligatoire).
- [ ] **Intégration** : combat joué N actions → `exportReplay()` → moteur reconstruit + rejeu → état final **identique** (PV, positions, statuts, jauges CT, compteurs). C'est le test qui garantit l'invariant 1.
- [x] **e2e** (`test-writer`) : `combat/battle-resume.spec.ts` — combat réel joué (2 actions) → la clé existe et grossit → rechargement → l'entrée « Reprendre le combat — Arène Simple » est là, en tête → clic → le combat remonte sans repasser par le placement, journal reconstruit à l'identique, même Pokemon actif et mêmes PV, même compte d'actions. `dom/battle-resume-menu.spec.ts` — les rejets (aucune sauvegarde, autre build, schéma inconnu, JSON corrompu) : aucune entrée, aucune exception au boot. Section **§6.11** créée dans `docs/test-plan.md`.
  - ⚠️ **Non automatisable** : « victoire → l'entrée disparaît ». Les deux seuls points d'entrée de l'effacement (event `BattleEnded`, boutons de la modale de victoire) exigent de terminer un combat du chemin de production — équipes aléatoires, 12 Pokemon sur la carte, IA adverse : ni court ni déterministe. Et le sandbox, qui sait finir un combat en un coup (`DUEL_LETHAL`), ne participe pas à la persistance. Reste 👁 au cahier, `clear()` couvert en unit.
  - La sauvegarde de fixture n'est pas forgée à la main : le spec la fait **produire par un vrai combat** et la laisse survivre au rechargement (`buildVersion` du build servi + placements cohérents avec la carte, impossibles à deviner). Seuls les cas de REJET, qui n'ont pas besoin d'être rejouables, utilisent une charge utile écrite.

## Risques et parades

| Risque | Parade |
|---|---|
| **Dérive de contenu** (un move rééquilibré change le rejeu) | `buildVersion` : sauvegarde jetée à toute mise à jour du jeu. Perte de la reprise, jamais un combat faux. |
| **Coût du rejeu** au retour | Le golden fait 52 actions ; un combat 6v6 en fait quelques centaines. Le rejeu est du core pur, sans rendu ni animation (~1 ms/action). À **mesurer** pendant l'implémentation ; si ça dépasse ~1 s, l'afficher derrière le voile de chargement déjà présent (`showLoadingOverlay`). |
| **Genre tiré hors seed** → combat différent à la reprise | Invariant 2 : `creationRng` seedé côté live. |
| **Rejeu qui lève** (bug, données changées) | Attrapé : sauvegarde effacée, retour au menu sans entrée de reprise. Jamais de demi-restauration. |
| **Sauvegarde grossissante** | Une action est un petit objet JSON ; quelques centaines ≈ quelques dizaines de Ko, très en dessous du quota `localStorage`. Écriture protégée par `try/catch` (quota, mode privé) : perdre la reprise est sans gravité. |
| **Le chemin de reprise devient un second chemin de combat** qui dérive du live | Il réutilise `createBattleFromPlacements` + `runBattle` tels quels ; seules la construction des billboards et le journal initial diffèrent. |

## Préparation Phase 7 — reprise en multijoueur (rechargement ou perte de connexion)

Demandé par l'humain à l'ouverture du chantier : **noter dès maintenant ce que ce plan prépare, et ce qu'il ne résout pas.**

Ce que le choix « journal d'actions » offre gratuitement au multijoueur : c'est **exactement la forme dont un serveur autoritaire a besoin**. Le serveur détient le `seed` et ajoute chaque action validée ; un client qui revient (rechargement, réseau coupé, application tuée) demande le journal au serveur et le rejoue — **le même chemin de reprise que le solo**, seul le magasin change (`localStorage` → serveur). D'où le port `load/save/clear` de l'étape 2 : le brancher ailleurs ne doit rien coûter à l'écran de combat.

Trois invariants à ne pas casser d'ici là : (1) journal seul, jamais d'état dérivé persisté ; (2) moteur déterministe, une seule entropie par combat ; (3) le combat reconstructible depuis une entrée **sérialisable** (carte + équipes + placements + seed).

Ce que ce plan ne résout **pas** pour le multijoueur, à traiter en Phase 7 :

- **Autorité.** Un journal côté client est falsifiable. Le serveur doit valider chaque action (`getLegalActions` côté serveur), pas faire confiance au client.
- **Identité de la carte.** On persiste un `mapUrl` ; un protocole réseau veut un **identifiant stable** de carte (`MAPS_REGISTRY`), pas une URL dépendante de la base de déploiement (piège déjà rencontré au 180-a avec les URLs du manifeste).
- **Politique de déconnexion** : fenêtre de reconnexion, horloge de tour pendant l'absence, abandon vs pause quand l'adversaire ne revient pas. Rien de tout ça n'existe.
- **Seed de l'IA.** `createPrng(Date.now())` (`combat-screen.ts:372`) suffit en solo puisqu'on rejoue les actions ; un serveur qui **re-simule** exigerait un seed fourni par le serveur.
- **Fog côté serveur.** `getGameState` reste un passthrough (décision #728) : le fog est appliqué à la vue. Un client modifié lirait l'état complet. Redaction par perspective = serveur autoritaire, déjà renvoyée en Phase 7.
- **Version de protocole.** Le `buildVersion` de la sauvegarde locale devient un contrôle de compatibilité client/serveur.

## Découpage

| Lot | Contenu | Coût |
|---|---|---|
| **181-a** | Persistance (module + port + invariant `creationRng` seedé) + crochet `onActionCommitted` + sauvegarde à chaque action | moyen |
| **181-b** | Chemin de reprise (moteur reconstruit, rejeu, billboards, journal reconstruit) + entrée « Reprendre le combat » au menu | moyen |
| **181-c** | Tests (unit, intégration, e2e) + cahier de recette | petit |

Un seul chantier, livré d'un trait : 181-a sans 181-b ne se teste pas, et l'inverse n'existe pas.
