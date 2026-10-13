# Plan 241 — Sprite de Métamorph transformé, et menu de combat quand on ne joue pas

**Statut** : done (2026-10-13)
**Origine** : deux retours de l'humain du 2026-10-12, relevés en jouant pendant la recette du plan 240
(`retour-2026-10-12-imposteur-sprite-reste-metamorph`,
`retour-2026-10-12-pas-de-menu-pause-en-combat-ia-seules`). Choisis au `/next` du 2026-10-13, avant
la release v2026.10.4.

## Ce que tu verras à l'écran

- Un Métamorph dont Imposteur s'est déclenché porte le sprite du Pokémon copié, **aussi après un
  rechargement de la page ou une reprise de partie** (aujourd'hui il y revient à sa forme de base,
  avec les attaques copiées).
- Même correction pour Morphing lancé par Mew, et pour la poupée de Clonage : après une reprise, un
  Pokémon protégé par son clone réaffiche bien la poupée.
- Dans un combat où **aucun joueur local n'a plus de Pokémon en jeu** — combat entre IA seules, ou
  toi éliminé qui regardes les IA finir — le bouton du menu de combat reste actif, `Start` et `Échap`
  l'ouvrent à tout moment, et tu peux quitter. La caméra, le zoom et le journal répondent aussi.
- Le menu **ne suspend pas** le combat, comme partout ailleurs : les IA continuent de jouer derrière.
- Rien ne change dans un combat où tu joues : pendant une animation, le menu reste refusé.

## Diagnostic (lu dans le code le 2026-10-13)

### Sprite transformé

1. **Reprise** — `spawnBillboardsFromState` (`packages/app/src/babylon/combat-screen.ts`) crée chaque
   sprite depuis `pokemon.definitionId`. `resumeBattle` draine les événements de démarrage et le
   rejeu dans le seul journal : `Transformed` et `SubstitutePosted` ne sont jamais présentés, donc
   `board.setSpecies` / `board.setSubstitute` ne sont jamais appelés. L'état de jeu porte bien
   `transformState` et `substituteHp` ; le plateau ne les lit pas. Cause certaine du symptôme après
   un rechargement.
2. **Course entre `load()` et les écritures d'atlas — confirmée par construction, déclenchement rare
   sur le placement.** `DirectionalBillboard.load()` (`packages/render-babylon/src/directional-billboard.ts:322-329`)
   écrit `baseAtlas` après son `await` et lie l'atlas sans regarder `substituteActive`. `setSpecies`
   (`:438-450`) et `setSubstitute` (`:412-430`) n'attendent pas `load()`. Si la fin de `load()` arrive
   après celle de `setSpecies`, la forme de base repart par-dessus : c'est le symptôme rapporté.
   - Ordre réel (vérifié) : le `load()` de Métamorph part à `addPokemon` au placement
     (`combat-scene.ts:1122-1126`, `placement-flow.ts`), donc bien avant `orchestrator.start()`.
     Sur le placement humain, la fenêtre est pratiquement fermée.
   - Fenêtre ouverte : spawn et `start()` dans le même tick. `runBattle` appelle `orchestrator.start()`
     (`combat-screen.ts:1267`) et `start()` draine les événements de démarrage (Imposteur émet
     `Transformed` dans `startupEvents`, `ability-definitions.ts:1050-1077`) ; la file les traite
     en synchrone (`AnimationQueue.enqueue`, `battle-orchestrator.ts:2289-2295`, pas de `await`
     avant `Transformed`). Le bac à sable (`sandbox-studio.ts:103` puis `:121`) et l'atelier des
     moves sont dans ce cas.
   - Le prétexte « l'atlas de l'ennemi copié est en cache » est partiel : `preloadCombatSprites`
     (`view-core/src/sprite-preload.ts`) pré-mint l'URL blob et parse le JSON, mais ne fait pas
     décoder la texture Babylon. La course reste donc une question d'ordre de fin de décodage.
   - **La cause du symptôme sur un démarrage normal n'est pas établie.** Reproduire (e2e ou pas à pas)
     avant de la déclarer. La reprise, elle, n'a aucune écriture d'atlas après coup (voir décision 1).
   `setSubstitute` a la même forme : sur la reprise, la poupée posée après `addPokemon` est exposée à
   la même course.

L'humain n'a pas dit si le bug a été vu après un rechargement ou sur un combat lancé normalement :
le plan couvre les deux chemins.

### Menu de combat

`BattleOrchestrator` range la phase `animating` dans le contexte d'entrée `locked`, qui coupe tout
(`input-router.ts`) et grise le bouton du menu (`combat-screen.ts`, `refreshCombatMenuButton`). Un
tour d'IA enchaîne `animating` → `refreshUI` → `animating` sans jamais passer par une phase de menu :
sans tour humain, le contexte ne quitte jamais `locked`. Le plan 187 (décision 14) justifiait le
refus par « les verrous durent moins d'une seconde » — faux dès qu'aucun humain ne joue.

Même piège, non signalé mais identique : un humain **éliminé** dans un combat local à trois camps ou
plus, qui choisit « Continuer à regarder » pendant que les IA finissent.

## Décisions de conception

1. **Le plateau repris se construit depuis l'état effectif.** `spawnBillboardsFromState`
   (`combat-screen.ts:1635-1650`) ne lit que `pokemon.definitionId` et ne pose ni `setSpecies` ni
   `setSubstitute` ; `resumeBattle` (`battle-resume.ts:112-118`) ne garde les `Transformed` et
   `SubstitutePosted` que pour le journal (`combat-screen.ts:950-952`), et `start()` n'a plus rien à
   drainer. Diagnostic 1 **confirmé**.
   - L'atlas du sprite vient de l'espèce effective : `transformState?.definitionId ?? definitionId`.
   - **Champ dédié, pas `pokemonId`.** `CombatSceneSpawn.pokemonId` (`render-ports/src/combat-scene.ts:107-108`)
     est aussi renvoyé par le hook e2e de scène (`render-babylon/src/combat-scene.ts:689`) et lu par
     `e2e/capture/combat-pad.ts`. Y mettre l'espèce copiée ferait diverger reprise et partie vive
     (le hook, lui, ne change pas sur `setSpecies`). Ajouter un champ d'apparence (ex.
     `appearanceDefinitionId`) qui ne sert qu'à l'atlas.
   - **Poupée à la construction, pas après coup.** `DirectionalBillboardOptions.substituteAtlas`
     existe déjà (`directional-billboard.ts:108`) ; ajouter un drapeau d'état initial (ex.
     `startsSubstituted`) lu par `load()`. Ainsi la reprise ne fait ni `setSpecies` ni
     `setSubstitute` après `addPokemon`, et la course du diagnostic 2 n'est pas en jeu.
   - **Helper du core : il existe mais n'est pas exporté.** `hasSubstitute` (`core/src/battle/substitute-system.ts:5`)
     n'est pas dans `packages/core/src/index.ts` (les autres `effective*` le sont, lignes 55-58).
     Il faut une ligne d'export. `view-core/src/battle-views.ts:365` recopie aujourd'hui le test
     (`substituteHp !== undefined && substituteHp > 0`) : ne pas le recopier dans le nouveau code.
   - Vaut aussi pour le bac à sable et l'atelier des moves, qui passent par la même fonction.
2. **Le billboard sérialise ses changements d'atlas derrière son chargement — seulement pour les
   chemins sans délai (bac à sable, atelier) et les écritures concurrentes.** Pour la reprise, la
   décision 1 suffit. Forme : `load()` garde sa promesse ; `setSpecies` et `setSubstitute` l'attendent
   avant d'écrire `baseAtlas` ; `load()` tient compte de `substituteActive` au moment où il lie.
   Pas de file générique : une promesse de chargement gardée et attendue.
3. **Sans joueur local en jeu, `animating` vaut `watching`, pas `locked`.** Le contexte `watching`
   existe déjà pour le tour distant (plan 201) : il laisse passer la vue (caméra, zoom, journal,
   timeline) et le menu de combat, et refuse tout geste de jeu. La règle : aucun camp de
   `localPlayerIds ?? humanPlayerIds` n'a de Pokémon vivant (liste vide comprise). Vérifié : les
   seules phases touchées sont `animating` ; `waiting_remote` reste `watching`.
   - **Ne pas réutiliser `isLocalPlayer`** (`battle-orchestrator.ts:870-873`) : une liste vide y vaut
     « tout le monde est local », l'inverse de la règle ici. Écrire un prédicat dédié (« un camp local
     a un Pokémon vivant »).
   - **Notification : c'est le point qui casse le plan tel qu'écrit.** `setInputState`
     (`battle-orchestrator.ts:636-672`) compare la carte de phase précédente et suivante. En combat IA
     seule, la phase reste `animating` → `animating` (`refreshUI` `:1338`), donc aucune notification ;
     `inputContext` côté écran (`combat-screen.ts:898`) reste `locked` et le bouton reste grisé. Même
     cas après élimination : le dernier local meurt pendant une animation, et « Continuer à regarder »
     ne rafraîchit rien. La phase initiale elle-même est `animating` (`battle-orchestrator.ts:378`).
     **Correction :** garder le dernier contexte notifié (`notifiedContext`, initial `locked` comme
     `combat-screen.ts:898`), notifier quand il change, et réévaluer en tête de `refreshUI`
     (`:1278`) — là l'état est définitif après `applyEvents`. `inputContext()` reste la lecture
     directe du routeur (`input-router.ts:185` la lit à chaque action).
   - **Le bouton** : il suit la notification (`combat-screen.ts:1083-1087`), donc la correction
     ci-dessus le concerne. Il n'est grisé que sur `locked` (`:900`).
   - **`Échap` : ne passe PAS aujourd'hui.** `input-router.ts:256-259` rend `false` pour tout geste non
     directionnel en `watching`, donc `Cancel` n'atteint jamais `menu().cancel()`
     (`combat-screen.ts:1248-1262`). `Start` (`OpenCombatMenu`) passe déjà : `handleViewAction` le
     traite avant (`input-router.ts:149`, testé `input-router.test.ts:280`). Au clavier, `OpenCombatMenu`
     n'a pas de défaut (`bindings-store.ts:180`) : `Échap` est le seul chemin clavier.
     - **Décision humaine requise.** Le routeur ne distingue pas `animating` IA-seule de `waiting_remote`
       (tour distant en ligne) : laisser passer `Cancel` en `watching` ouvre aussi le menu pendant
       un tour distant. Ça contredit le test contrat `input-router.test.ts:304-308` et le commentaire
       `input-router.ts:197` (« jamais Annuler ni le menu »). Options : (a) accepter Échap → menu
       pendant un tour distant, (b) un contexte distinct (ex. `spectating`) réservé au seul cas
       « aucun local vivant ».
     - Dans les deux cas, `onEscape()` rend `false` en `animating` (`battle-orchestrator.ts:709-711`) :
       rien à annuler, on ouvre le menu.
   - Le chrono de tour, la suspension, la télémétrie : inchangés, ils lisent la phase et non le
     contexte (`setTurnClockSuspended`, `:654`).
   - **Autres lecteurs de `locked`** : `battle-orchestrator.test.ts:639-641` (« is locked before the
     first turn » : `setup([])` sans humain deviendrait `watching` — test à réécrire, intentionnel) ;
     `input-router.test.ts:157` (contexte factice, sans effet) ; `combat-screen.ts:1099` (nettoyage du
     curseur, déjà prévu pour `watching`, donc sans effet). Aucun lecteur dans `e2e/`.
4. **Le curseur de case en spectateur pendant une animation.** `watching` autorise le curseur au
   clavier et à la manette (`input-router.ts:241`), alors que `onTileHover` se fige pendant `animating`
   (souris, `battle-orchestrator.ts:739`). Règle : pendant `animating`, le curseur ne bouge pour aucun
   appareil. **Le consommateur ne lit pas la phase** : `board.moveCursor` (`combat-screen.ts:1152-1172`)
   n'a aucune garde. Il faut une lecture de phase exposée par l'orchestrateur (aujourd'hui seul
   `inputContext()` est public) et la garde côté écran.

### Arbitrages du 2026-10-13 (humain, après revue)

- **`Échap` : option (b), « spectateur seulement ».** Un contexte d'entrée de plus, `spectating`,
  réservé au cas « aucun camp local n'a de Pokémon vivant » pendant `animating`. Il laisse passer la
  vue (caméra, zoom, journal, timeline), `OpenCombatMenu` et `Cancel` (→ ouverture du menu), et rien
  d'autre : ni curseur de case, ni inspection, ni geste de jeu. `watching` (tour distant) ne change
  pas, et son test contrat (`input-router.test.ts:304-308`) reste vrai. Partout où la décision 3
  dit « `watching` », lire « `spectating` ».
- **Conséquence sur la décision 4** : le curseur étant refusé par le routeur en `spectating`, aucune
  lecture de phase n'est à exposer par l'orchestrateur. Le nettoyage du curseur à l'entrée
  (`combat-screen.ts:1099`) s'étend à `spectating`.
- **Information cachée (avis `game-designer`)** : le plan ne change pas ce qu'on voit. Sans joueur
  local, les panneaux lisent le camp qui joue ; un joueur éliminé garde la vue de son ancien camp
  (`viewerPlayerId`). Invariant à ne pas toucher. Le fog ne cache jamais l'espèce : afficher le
  sprite copié à la reprise ne révèle rien de plus qu'en partie vive.
- **Cas de test ajouté** : reprise avec un Pokémon transformé **et** sous Clonage, puis casse de la
  poupée — le sprite restauré est celui de l'espèce copiée (§ 7k).

## Étapes

1. Core : une seule ligne, l'export de `hasSubstitute` (`core/src/battle/substitute-system.ts`) dans
   `packages/core/src/index.ts` (décision 1). Pas de changement de logique. Test core : le module
   est déjà couvert par les tests existants de `substitute-system` ; vérifier avant d'en ajouter un
   (règle « tout export public est testé »).
2. `spawnBillboardsFromState` : champ d'apparence + espèce effective + état initial de poupée
   (décision 1). Le fake `CombatScene` se construit depuis l'interface `render-ports`, sans Babylon.
3. Billboard : `load()` garde sa promesse, `setSpecies`/`setSubstitute` l'attendent, `load()`
   respecte `substituteActive` (décision 2). Le drapeau d'état initial (décision 1) doit être lu ici.
   Aucun test de billboard n'existe (`packages/render-babylon/src` n'a aucun `*.test.ts`) : la
   vérification passe par la recette ou un e2e, pas par un test unitaire Babylon.
4. Orchestrateur : prédicat « un camp local a un Pokémon vivant » ; `notifiedContext` ; réévaluation
   en tête de `refreshUI` ; lecture de phase exposée pour la garde du curseur (décisions 3 et 4).
   **Attendre la décision humaine sur `Échap` pendant un tour distant avant d'écrire le routeur**
   (décision 3).
5. Routeur et écran : `Cancel` en `watching` selon l'option retenue ; garde de curseur pendant
   `animating` (décisions 3 et 4). Mettre à jour `input-router.test.ts:304-308` selon l'option.
6. Passe multi-entrée mesurée (`.claude/rules/multi-input.md`) : le menu de combat s'ouvre à la
   souris, au doigt (bouton), au clavier (`Échap`) et à la manette (`Start`) dans un combat entre IA.
7. `/simplify`, typecheck.

## Recette (4 scénarios)

1. Combat normal avec un Métamorph (Imposteur) face à un ennemi : il porte le sprite copié dès
   l'entrée en combat.
2. Même combat, rechargement de la page après quelques actions, reprise : Métamorph porte toujours le
   sprite copié ; un Pokémon sous Clonage réaffiche la poupée.
3. Combat entre IA seules : ouvrir le menu de combat pendant qu'elles jouent (bouton, `Échap`,
   `Start`), tourner la caméra, puis quitter.
4. Combat où tu joues : pendant une animation, le menu reste refusé et le bouton grisé — rien n'a
   bougé.

## Tests (au menu de finalisation, après la recette)

- Unitaire : `spawnBillboardsFromState` avec un Pokémon transformé et un Pokémon sous clone ;
  orchestrateur — contexte émis en combat sans joueur local, et après élimination du dernier local.
- e2e : reprise d'un combat avec Métamorph transformé (`mechanics-transform.spec.ts`) ; ouverture du
  menu de combat dans un combat entre IA.

## Hors périmètre

- Une vraie pause qui suspend le combat (décision #819 : le menu n'est pas une pause).
- Ouvrir le menu pendant une animation dans un combat où l'humain joue (décision 14 du plan 187).
- Les oublis ci-dessous : signalés à la revue du 2026-10-13, non traités ici, à trancher à part.
  - Cri joué : `speciesOf` (`combat-screen.ts:654` → `audio/battle-audio.ts:135`) lit `definitionId`.
    Un Métamorph copié crie avec sa propre voix, en partie vive comme en reprise.
  - Nom, portrait de l'info panel et timeline : `battle-views.ts:512`, `:519`, `:766` lisent
    `definitionId`, alors que les types lisent `transformState` (`battle-views.ts:231`). Le nom
    « Mew » pendant Morphing est **voulu et testé** (`e2e/tests/combat/mechanics-transform.spec.ts:47-51`) ;
    l'incohérence avec les types reste à arbitrer (`game-designer`).
  - Reprise : `combat-screen.ts:1795` attend `activeCombat.ready` (la scène), pas les `load()` des
    billboards que couvre `whenReady` (`render-babylon/src/combat-scene.ts:1118`). Le placement n'attend
    pas non plus `whenReady` (`:1861`). Le plan reste caché jusqu'au bind, donc pas de flash blanc ;
    un sprite peut arriver après le voile.
  - Analytics : `analytics/battle-telemetry.ts:27` (`speciesOf`), non visuel.
  - Hook e2e de scène : `render-babylon/src/combat-scene.ts:689` rapporte `entry.pokemonId` (voir décision 1).

## Risques / Questions ouvertes

- **Cause du symptôme en démarrage normal non établie** (diagnostic 2) : la course est réelle par
  construction, mais elle n'est pas le chemin du placement humain. Reproduire avant de la déclarer
  corrigée. Si le bug persiste après les étapes 2 et 3, il a une autre cause.
- **Notification du contexte** : sans la correction de décision 3, le bouton reste grisé en combat IA
  seule. C'est le point le plus facile à rater à la recette (scénario 3).
- **Tests Babylon** : aucun test de billboard n'existe. Le test de spawn se fait avec un fake de
  `CombatScene` (interface `render-ports`).

## Dépendances

- Aucune dépendance de plan.
- Débloque : rien d'autre. Les oublis listés en « Hors périmètre » sont des candidats au backlog
  après la release, sur accord de l'humain.
