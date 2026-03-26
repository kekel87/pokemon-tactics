# Décisions & Questions ouvertes — Pokemon Tactics

> Log des décisions prises et questions à trancher.
> Pour le game design, voir [game-design.md](game-design.md).
> Pour l'architecture, voir [architecture.md](architecture.md).

---

## Décisions prises

| # | Date | Question | Décision | Contexte |
|---|------|----------|----------|----------|
| 1 | 2026-03-19 | Système de tour | **Initiative individuelle** (FFTA-like) | Basée sur Vitesse/Poids. Plus tactique que le tour par équipe. |
| 2 | 2026-03-19 | Friendly fire | **Oui** | AoE touche les alliés. Force le positionnement. |
| 3 | 2026-03-19 | Format joueurs | **Hot-seat**, jusqu'à 12 joueurs | Style Civilization. Équipes ou FFA. Réseau plus tard. |
| 4 | 2026-03-19 | Stats de base | **Stats officielles Pokemon** | On adapte les formules, pas les stats. |
| 5 | 2026-03-19 | Stats dérivées | **Calculées depuis Vitesse + Poids** | Mouvement, Saut, Initiative. Formules à définir. |
| 6 | 2026-03-19 | Formule de dégâts | **Formule Pokemon officielle** comme base | Adaptée au contexte tactique (terrain, hauteur...). |
| 7 | 2026-03-19 | Architecture | **Moteur découplé du rendu** | Core TS pur. Permet AI, tests headless, changement de renderer. |
| 8 | 2026-03-19 | AI-playable | **Oui** | IA classique + LLM + MCP server. Pour tests, équilibrage, solo. |
| 9 | 2026-03-19 | Replay | **Oui** | Log d'actions déterministe (seed + actions). |
| 10 | 2026-03-19 | Navigateur | **Oui** — web natif | Comme PokeRogue. Pas d'export WASM, du vrai web. |
| 11 | 2026-03-19 | Versionning | **Git** | Conventional commits. |
| 12 | 2026-03-19 | Stack | **TypeScript + Phaser 4** | Core TS pur + Phaser 4 pour le rendu. Monorepo pnpm. API compatible Phaser 3. |
| 13 | 2026-03-19 | Développeur principal | **Claude Code** | L'humain supervise, review, et guide. Claude Code écrit le code. |
| 14 | 2026-03-19 | Linter/Formatter | **Biome** | Remplace ESLint + Prettier + Stylelint. Plus rapide, une seule config. Utilisé par PokeRogue. |
| 15 | 2026-03-19 | Plans d'exécution | **`plans/xxx-name.md`** | Numérotés, avec statut. Conservés comme historique. |
| 16 | 2026-03-19 | Roster POC | **Bulbizarre, Salamèche, Carapuce, Roucoul** | 4 Pokemon simples, 4 types (Plante, Feu, Eau, Normal/Vol). Suffisant pour valider les mécaniques. Movesets détaillés dans `docs/roster-poc.md`. |
| 17 | 2026-03-19 | Caméra | **Fixe + zoom (non contrôlable par l'user)** | Rotation 4 angles (style FFTA) en phase ultérieure. |
| 18 | 2026-03-19 | Taille de grille POC | **12x12** | Taille variable par map à terme. 12x12 = bon compromis pour jusqu'à 12 Pokemon. |
| 19 | 2026-03-19 | Monorepo | **pnpm workspaces seul** | Pas de Nx pour l'instant. On ajoutera si le besoin se présente (partie serveur multi ?). |
| 20 | 2026-03-19 | Sprites | **PMDCollab/SpriteCollab** | 8 directions, animations riches (Walk, Idle, Attack, Hurt...), ~48x48+, Gen 1-9. Pipeline : AnimData.xml → Phaser atlas JSON. Placeholders pour le POC, vrais sprites en Phase 1. |
| 21 | 2026-03-20 | Formule de dégâts | **Base officielle + surcharges tactiques** | Formule Pokemon comme socle, avec couche de surcharge (hauteur, orientation, terrain). Override possible par capacité pour l'équilibrage. |
| 22 | 2026-03-20 | Précision / esquive | **Système Pokemon + modificateurs terrain** | Précision × évasion (base Pokemon) + bonus/malus terrain (herbe, glace, hauteur). Surchargeable. |
| 23 | 2026-03-20 | PP | **Oui, conservés** | PP des attaques maintenus. Surchargeables pour l'équilibrage. Possibilité de basculer vers un système de points d'action (style FFTA) si les PP ne fonctionnent pas. |
| 24 | 2026-03-24 | KO / élimination | **KO définitif, corps reste sur la tile** | 0 PV = KO définitif. Le Pokemon reste sur sa tile (bloque le passage). Seule capacité de revival : Second Souffle (Revival Blessing, 1 PP). Pas de countdown FFTA. |
| 25 | 2026-03-20 | Déplacement diagonal | **Non** | 4 directions uniquement (style FFTA / Fire Emblem). |
| 26 | 2026-03-20 | Blocage tiles | **Oui, sauf exceptions** | Les Pokemon bloquent le passage des ennemis. Alliés traversent. Exceptions : Vol, Spectre, Lévitation. |
| 27 | 2026-03-20 | Dégâts de chute | **Oui** | Chute = dégâts proportionnels à la hauteur. Poids pourrait influencer les dégâts (à tester). Vol/Lévitation immunisés. |
| 28 | 2026-03-20 | Brouillard de guerre | **Non** | Visibilité totale pour tous les joueurs. |
| 29 | 2026-03-20 | Alliances FFA | **Non** | FFA = chacun pour soi. Pas d'alliances dynamiques. Mode équipe = format séparé. |
| 30 | 2026-03-20 | Taille d'équipe | **Configurable par format** | Base = 6v6. Défini avant le combat. Exemples : 1v1v1v1, 3v3, etc. |
| 31 | 2026-03-20 | Système d'équilibrage | **Surcharge (override) par couche** | Données officielles → surcharge globale tactique → surcharge par capacité/talent/objet. Permet d'itérer sans toucher à la base. |
| 32 | 2026-03-20 | Inspiration principale | **FFTA** (pas FFT) | L'humain a joué à FFTA, pas FFT. Références ajustées. |
| 33 | 2026-03-20 | Attaques de priorité | **Deviennent des attaques Dash** | Dash en ligne droite (X tiles) + frappe le premier ennemi. Combine déplacement et attaque. Plus tactique que "agir en premier". |
| 34 | 2026-03-20 | Vampigraine | **Lien à distance + durée limitée** | Drain fonctionne tant que cible à ≤ X tiles du lanceur, max 3 tours. Surchargeable. |
| 35 | 2026-03-20 | Dracosouffle | **Pattern cône** (pas ligne) | Souffle de dragon = cône devant le lanceur. |
| 36 | 2026-03-20 | Brouillard | **Zone self (portée 0)** | Zone centrée sur le lanceur, pas à distance. |
| 37 | 2026-03-20 | Attaques : architecture | **Composition Targeting + Effects** | Chaque attaque = pattern de ciblage (discriminated union) + liste d'effets. Déclaratif, pas de code par attaque. Nouveau kind = nouveau resolver. |
| 38 | 2026-03-20 | Core sync / Renderer async | **Core synchrone, renderer async** | `submitAction()` est sync, émet des events. L'IA joue à pleine vitesse. Le renderer gère sa propre queue d'animations. |
| 39 | 2026-03-20 | Core → Renderer : events | **Événements (observer pattern)** | Le core émet des BattleEvents. Le renderer souscrit et anime. Les mêmes events alimentent les replays. |
| 40 | 2026-03-20 | Surcharges : structure | **3 couches : base → tactical → balance** | base = données Pokemon pures. tactical = targeting/effects. balance = tweaks numériques. DeepMerge au startup. |
| 41 | 2026-03-20 | Validation données | **Oui, au startup** | Validateur qui vérifie la complétude des entités finales après merge. Léger (une fois au boot). |
| 42 | 2026-03-20 | Référence principale | **Pokemon Conquest** (DS) | LA référence directe : Pokemon + tactical sur grille. "Ça, mais mieux." |
| 43 | 2026-03-20 | Module resolution | **`bundler`** (pas `NodeNext`) | Vite gère le bundling. Pas d'extensions `.js` dans les imports. Aligné avec Angular/Nx. |
| 44 | 2026-03-20 | tsconfig | **Un seul base + extends** | Pas de project references, pas de `composite`, pas de `dist/` intermédiaires. Path aliases centralisés dans `tsconfig.base.json`. Pattern Nx. |
| 45 | 2026-03-20 | Structure core | **Flat par responsabilité (option B)** | enums/, types/, grid/, battle/. On restructurera par domaine quand la complexité le justifiera (Phase 1-2). |
| 46 | 2026-03-20 | Const object enum | **Pattern `as const` + type dérivé** | Pas d'enum TS natif, pas de switch sur strings. Toujours le pattern `{ Key: "value" } as const`. |
| 47 | 2026-03-20 | Nommage variables | **Même nom que le type** | `traversalContext: TraversalContext`, `position: Position`. Pas d'abréviations. |
| 48 | 2026-03-20 | Commentaires | **Non sauf algo complexe** | Le code doit être lisible sans commentaires. |
| 49 | 2026-03-20 | Coverage | **Core uniquement, exclut types/enums/barrels/tests** | Coverage sur le comportement, pas sur les déclarations. |
| 50 | 2026-03-20 | Coverage threshold | **100% sur le core** | Statements, branches, functions, lines. Le core est de la logique pure, chaque chemin doit être testé. |
| 51 | 2026-03-20 | Mocks | **`abstract class` + `static readonly` + données pures** | Pas de helper de création (`createInstance`). Les mocks sont des données explicites. Variations via spread dans le test. |
| 52 | 2026-03-20 | Biome `noStaticOnlyClass` | **Désactivé pour testing/mocks** | Les `abstract class MockX` sont un pattern délibéré (prévient l'instanciation, regroupe les mocks). Désactivé via override Biome sur `**/testing/**` et `**/mocks/**`. |
| 53 | 2026-03-20 | Utils extraits | **`utils/` pour les fonctions pures transversales** | `manhattanDistance`, `directionFromTo`, `stepInDirection`, `getPerpendicularOffsets` — fonctions math/géométrie réutilisables, pas liées à un domaine spécifique. |
| 54 | 2026-03-20 | Niveaux de test | **4 niveaux : unit, intégration, scénario, E2E** | Unit (*.test.ts, 100% coverage), intégration (*.integration.test.ts, pas de threshold), scénario (*.scenario.test.ts, combats headless), E2E (Playwright, séparé). |
| 55 | 2026-03-20 | Vitest projects | **`test.projects` dans vitest.config.ts** | Vitest 4 a deprecaté `vitest.workspace.ts`. Utiliser `projects` avec `name` pour filtrer via `--project`. |
| 56 | 2026-03-20 | `Accuracy`/`Evasion` dans `StatName` | **Ajoutés en tant que stats à part entière** | Smokescreen et Sand-Attack corrigeaient les modificateurs sur la mauvaise stat. `Accuracy` et `Evasion` doivent être dans `StatName` pour que `stat_change` fonctionne correctement. |
| 57 | 2026-03-20 | Codes d'erreur | **`ActionError` enum** (pas des strings) | Les erreurs de `submitAction` sont typées via le const enum `ActionError`. Permet au compilateur de valider les cas d'erreur et à l'IA de les traiter sans comparer des chaînes. |
| 58 | 2026-03-20 | `MockBattle` centralisé | **Dans `testing/`**, pas de helpers inline dans les tests | Les tests d'intégration et de scénario utilisent `MockBattle` (état initial minimal préconstruit). Cohérent avec le pattern `MockPokemon` déjà en place. |
| 59 | 2026-03-20 | `deepMerge` et arrays | **Les arrays sont remplacés, pas concaténés** | Un override qui fournit un array `effects` remplace entièrement le tableau de base. Évite les effets doublés non intentionnels lors d'un merge multi-couches. |
| 60 | 2026-03-20 | `TurnManager` source de vérité | **`TurnManager` est maître, `BattleState` est synchronisé après** | `BattleState.turnOrder` et `currentTurnIndex` sont mis à jour par `BattleEngine` après chaque mutation du `TurnManager`, pas avant. Évite les incohérences d'état. |
| 61 | 2026-03-20 | Commentaires dans les tests | **Autorisés dans intégration/scénario, avec parcimonie** | Les tests unitaires restent sans commentaires. Les tests d'intégration et de scénario peuvent avoir des commentaires de structure. Les scénarios utilisent un bloc Gherkin (Given/When/Then) en commentaire d'en-tête. |
| 62 | 2026-03-21 | Système de tour POC | **Round-robin** | Chaque Pokemon joue 1x par round, ordre recalculé à chaque round (initiative effective). Le système CT (style FFTA, vitesse = fréquence d'action) est prévu pour Phase 1+ — plus intéressant tactiquement mais plus complexe à implémenter et équilibrer. |
| 63 | 2026-03-24 | KO POC | **Définitif** (aligné décision #24) | KO = définitif, le corps reste sur la tile et bloque le passage. Pas de countdown. `koCountdown` supprimé de `PokemonInstance`. |
| 64 | 2026-03-21 | Vampigraine POC | **Permanent + rupture définitive** (écart décision #34) | Pour le POC, Leech Seed est permanent (comme Pokemon), brisé par KO ou distance > maxRange. La décision #34 prévoyait 3 tours max — on y reviendra si le drain permanent est trop fort. |
| 65 | 2026-03-21 | Statuts POC | **1 seul à la fois** | Comme Pokemon : 1 statut majeur max. Confusion (volatile) hors scope POC. |
| 66 | 2026-03-21 | Paralysie tactique | **Bloque le déplacement, pas l'attaque** | Proc 25% : le Pokemon ne peut pas bouger (move) ni dash, mais peut attaquer sur place (use_move non-dash). Différent de Pokemon classique (bloque tout). -50% initiative permanent. |
| 67 | 2026-03-21 | Effect architecture | **Handler registry** (écart pattern switch) | Remplace le switch case dans `effect-processor.ts` par une `EffectHandlerRegistry` (Map<EffectKind, EffectHandler>). Ajouter un effet = enregistrer un handler. Inspiré de Pokemon Showdown. |
| 68 | 2026-03-21 | Phases de tour | **StartTurn → Action → EndTurn** | Pipeline de phases avec handlers enregistrables par priorité. Status ticks en StartTurn, drain en EndTurn. Extensible pour météo, terrain, abilities. |
| 69 | 2026-03-21 | Valeurs des ticks de statut POC | **Burn 1/16 HP/tour, Poison 1/8 HP/tour, Sleep 1-3 tours, Freeze 20% dégel/tour, Paralysie 25% proc** | Calqué sur les valeurs Pokemon. Paralysie : proc bloque move+dash, pas use_move non-dash. -50% initiative permanent sur paralysé. |
| 70 | 2026-03-21 | Validation core headless | **Validé par deux combats IA headless** | IA Random (58 rounds) et IA Smart (67 rounds) : boucle tourne, KO gérés, victoire détectée, aucun crash. Le core est prêt pour le renderer. |
| 71 | 2026-03-21 | `getLegalActions` comme filtre IA | **`getLegalActions()` doit être utilisé par toute IA avant de choisir une attaque** | Les tests headless ont montré qu'une IA qui attaque sans vérifier les cibles valides gaspille tous ses PP. `getLegalActions` expose déjà les positions valides et permet de savoir si une cible est à portée. |
| 72 | 2026-03-22 | Style de commit | **Titre seul, jamais de corps** | Un commit = une ligne. Le titre du commit conventionnel suffit. Pas de `git commit -m "..." -m "..."`. Garder l'historique lisible d'un coup d'œil. |
| 73 | 2026-03-22 | Code-reviewer : titre de commit | **Toujours proposer un titre de commit après une review** | Le code-reviewer termine systématiquement sa review en proposant un titre de commit conventionnel prêt à copier-coller. |
| 74 | 2026-03-22 | README public | **Disclaimers Nintendo + IA obligatoires** | Le README mentionne explicitement : fan project non affilié à Nintendo/Game Freak, assets sous licence SpriteCollab, code généré par Claude Code (Anthropic). |
| 75 | 2026-03-22 | Move+Act par tour | **FFTA-like : Move + Act + EndTurn** | Chaque tour permet un Move (une fois) + un Act (une fois) dans n'importe quel ordre. Le tour se termine uniquement sur EndTurn explicite. Remplace SkipTurn. |
| 76 | 2026-03-22 | Dash après Move | **Autorisé (option A)** | Un Dash consomme l'Act, pas le Move. Move→Dash et Dash→Move sont tous deux permis. Après Move 4 tiles + Dash 3 tiles = 7 tiles de portée + frappe. Accepté car seul Roucoul a un dash dans le POC — à surveiller si trop fort à mesure que le roster s'agrandit. |
| 77 | 2026-03-22 | Overlay UI renderer | **BattleUIScene séparée de BattleScene** | L'UI (menus, panels, timeline) est une scène Phaser distincte lancée en overlay sur BattleScene. Communication via event `uiReady`. Évite les conflits de depth et de camera entre le jeu et l'UI. |
| 78 | 2026-03-22 | ActionMenu : Zone vs Container | **Zone Phaser en coordonnées absolues** | Les containers imbriqués en Phaser créent des problèmes de depth et de coordonnées. L'ActionMenu utilise des `Phaser.GameObjects.Zone` avec coordonnées absolues sur la scène UI. |
| 79 | 2026-03-22 | screenToGrid : round vs floor | **`Math.round` au lieu de `Math.floor`** | `Math.floor` causait une erreur de hit detection d'une demi-tile en isométrique. `Math.round` corrige la détection de clic sur les tiles. |
| 80 | 2026-03-22 | Canvas dans container dédié | **`#game-container`** | Le canvas Phaser est monté dans un div `#game-container` plutôt que directement dans `document.body`. Facilite le layout CSS et l'éventuel resize. |
| 81 | 2026-03-22 | Depth renderer | **Système centralisé dans `constants.ts`** | Toutes les valeurs de depth (grille, sprites, UI, menus) sont des constantes nommées dans `constants.ts`. Évite les magic numbers et les conflits de rendu entre composants. |
| 82 | 2026-03-22 | Noms Pokemon dans l'UI | **Capitalisés, retirés des sprites** | Les noms sont capitalisés dans tous les affichages UI. Ils sont retirés au-dessus des sprites (le panel info et la timeline suffisent) pour désencombrer la grille. |
| 83 | 2026-03-24 | `PlayerId` const enum | **`PlayerId` (Player1/Player2) remplace les string literals** | `"player-1"` / `"player-2"` comparés en dur dans l'UI et le core étaient des string literals fragiles. Remplacés par un const object enum `PlayerId` (`Player1`, `Player2`). Cohérent avec le pattern établi (décision #46). |
| 84 | 2026-03-24 | Vive-Attaque `maxDistance` | **2 tiles (réduit de 3 à 2)** | La portée de 3 tiles était documentée dans game-design.md et roster-poc.md mais l'implémentation corrigée la fixe à 2. Décision retenue : 2 tiles pour Vive-Attaque. À ajuster pour d'autres moves dash si besoin via le système d'override. |
| 85 | 2026-03-24 | Dash déplace le caster | **Oui — le caster se déplace vers la case ciblée** | Après un `UseMove` dash, le caster se déplace vers la tile d'impact (ou juste devant un ennemi bloquant). Cela ajoute un repositionnement tactique intrinsèque au dash. |
| 86 | 2026-03-24 | Dash ne consomme pas `hasMoved` | **Le dash consomme `hasActed`, pas `hasMoved`** | Décision #76 confirmée et précisée : un dash consomme l'Act. Le Move reste disponible après un dash. Move→Dash et Dash→Move sont tous deux permis. Permet un double repositionnement (dash + déplacement). |
| 87 | 2026-03-24 | Dash dans le vide | **Autorisé — repositionnement sans frappe** | Un dash peut cibler une case vide (aucun ennemi sur le chemin). Le caster se déplace jusqu'à la case ciblée, aucun dégât infligé. Consomme `hasActed` mais pas `hasMoved`. Permet de se repositionner rapidement via une action dash, au coût de l'Act du tour. |
| 88 | 2026-03-24 | Pipeline sprites | **Script one-shot `scripts/extract-sprites.ts`** (hors packages) | Le pipeline d'extraction PMDCollab n'est pas packagé dans le jeu. C'est un outil de build autonome (Node.js, devDependencies root) qui génère des assets statiques dans `public/`. Déclenché manuellement via `pnpm extract-sprites`. |
| 89 | 2026-03-24 | Clés d'animation Phaser | **`{pokemonId}-{anim}-{direction}`** (ex : `bulbasaur-idle-south`) | Convention pour nommer les frames/animations Phaser. Permet un lookup direct sans map, compatible avec l'extension future vers 8 directions. |
| 90 | 2026-03-24 | Fallback sprites | **Cercle coloré si atlas absent** | `PokemonSprite` tente de charger l'atlas PMDCollab et revient silencieusement aux cercles colorés si l'atlas n'est pas disponible. Robustesse pour les nouveaux Pokemon non encore extractés. |
| 91 | 2026-03-24 | Setup Phaser injecté | **`BattleSetup` injecté dans `GameController`** (au lieu d'être créé dedans) | `BattleScene.createBattle()` est maintenant déplacé dans `BattleScene` et le setup est injecté dans `GameController`. Meilleure séparation des responsabilités : BattleScene gère le cycle de vie Phaser, GameController gère l'orchestration. |
| 92 | 2026-03-24 | Roster cible | **151 premiers Pokemon (Gen 1)** | Le jeu se limite aux 151 Pokemon de la Gen 1 pour le moment. Le pipeline de sprites PMDCollab supporte déjà l'extraction par Pokemon — il suffit d'étendre la config. |
| 93 | 2026-03-24 | Revival | **Seule capacité : Second Souffle (Revival Blessing), 1 PP** | La seule façon de ranimer un Pokemon KO est Second Souffle (1 PP). Pas de countdown, pas d'objet Rappel. Le KO est quasi-définitif — la revival est rare et coûteuse. |
| 94 | 2026-03-24 | Replay & fixtures visuelles | **Replay Showdown-like avec navigation next/prev** | Le système de replay (état initial sérialisé + log d'actions) servira aussi de base pour les fixtures de test visuel. Une fixture = un replay pausé à un moment donné. Permet au visual-tester de charger un état spécifique via `?fixture=post-ko` sans rejouer 20 tours. À implémenter avec le replay (Phase 1). |
| 95 | 2026-03-25 | `EndTurn` direction | **Direction obligatoire** (plus optionnelle) | `direction?: Direction` → `direction: Direction`. `getLegalActions` génère 4 actions `EndTurn`. Le joueur choisit toujours sa direction avant de terminer son tour. |
| 96 | 2026-03-25 | Orientation initiale | **Vers le centre de la grille** via `directionFromTo` | Au lieu de `Direction.South` fixe, chaque Pokemon regarde le centre de la grille au spawn. Centre = `{ x: Math.floor(width / 2), y: Math.floor(height / 2) }`. |
| 97 | 2026-03-25 | DirectionPicker — sprites vs Graphics | **Spritesheet `arrows.png`** (pas de dessin programmatique) | Le DirectionPicker utilise un spritesheet d'assets visuels pour les flèches au lieu de `Phaser.GameObjects.Graphics`. Plus robuste, plus facile à personnaliser visuellement. |
| 98 | 2026-03-25 | Détection direction — quadrants | **Quadrants cardinaux écran** (croix horizontale/verticale) | La direction est déterminée par la position de la souris dans les 4 quadrants formés par les axes horizontal et vertical passant par le sprite, pas les diagonales isométriques. Plus intuitif en vue iso. |
| 99 | 2026-03-25 | Carte porte les zones de spawn | **`MapDefinition` avec dimensions libres, tiles, formats supportés, zones de spawn arbitraires (`Position[]`)** | Les positions de spawn ne sont plus codées en dur dans `BattleSetup`. Chaque carte déclare les formats qu'elle supporte et les zones de spawn par équipe (tiles arbitraires, pas des rectangles). |
| 100 | 2026-03-25 | Formats de combat explicites | **2p (6v6 max), 3p (4v4v4), 4p (3v3v3v3), 6p (2v2x6), 12p (1x12). 12 Pokemon max toujours.** | Chaque carte déclare les formats supportés via `MapFormat { teamCount, maxPokemonPerTeam, spawnZones[] }`. |
| 101 | 2026-03-25 | Alternance placement | **Serpent : P1-P2-P2-P1-P1-P2...** | Plus équitable que l'alternance simple (l'avantage informationnel s'inverse à chaque paire). Mode random aussi disponible. Placement blind hors scope. |
| 102 | 2026-03-25 | Repositionnement pendant placement | **Uniquement le Pokemon placé durant l'alternance courante** | `undoLastPlacement()` dans `PlacementPhase` retire le dernier placement. Pas de repositionnement d'un Pokemon placé lors d'un tour précédent. |
| 103 | 2026-03-25 | Direction au placement | **Choix obligatoire après chaque placement** (réutilise `DirectionPicker`). Random → auto vers le centre. | Cohérent avec la direction de fin de tour (décision #95). Le `DirectionPicker` est réutilisé tel quel. |
| 104 | 2026-03-25 | `PlayerController` | **Nouveau const enum : `Human` / `Ai`** | Permet au `GameController` de savoir si un joueur est humain ou IA pendant la phase de placement. L'IA place ses Pokemon de façon random instantanée. Servira aussi pour le tour de jeu (pas uniquement le placement). |
| 105 | 2026-03-25 | Sprites — transition placement → combat | **Sprites de placement détruits, recréés par `BattleSetup`** | Les sprites créés pendant la phase de placement sont détruits à la transition. `BattleSetup` recrée les sprites avec les positions finales. Plus simple que le transfert, pas de sprites orphelins. |
| 106 | 2026-03-25 | Seed de placement | **Injectable dans `PlacementPhase`** pour reproductibilité du mode random | Si `randomSeed` fourni, utilise un PRNG déterministe (mulberry32, pas de dépendance externe). Si absent, `Math.random()`. Sera intégré dans le système de replay (décision #94). |
| 107 | 2026-03-25 | `PlacementPhase` — périmètre | **Objet core indépendant, créé avant `BattleEngine`** | `PlacementPhase` orchestre le placement sans dépendance UI. `BattleEngine` est créé après avec les positions finales (`PlacementEntry[]`). Les deux objets n'ont pas de couplage direct. |
| 108 | 2026-03-26 | Nouveau pattern : slash / arc frontal | **`slash` — touche les 3 cases devant le lanceur (face + 2 diagonales adjacentes)** | Les attaques de balayage (Tranch'Herbe, Cru-Aile) évoquent un mouvement d'arc. Le pattern `single` ne rend pas compte de cette forme. À implémenter dans le core avant de mettre à jour les movesets. |
| 109 | 2026-03-26 | Nouveau pattern : blast | **`blast` — projectile à distance qui explose en cercle (`range` + `radius`)** | Les bombes explosent en cercle, pas en croix. `cross` reste pertinent pour les ondes (Éclate-Roc, Ombre Nuit). `blast` = portée de lancer + rayon d'explosion circulaire. Différent de `zone` (centré sur soi) et de `cross` (forme en +). |
| 110 | 2026-03-26 | Révision patterns — 8 attaques du roster | **Tranch'Herbe→slash, Poudre Dodo→zone r1, Bombe-Beurk→blast r2, Bulles d'O→cone, Tornade→cone, Cru-Aile→slash, Ampleur→zone r2** (7 changements + Poudre Dodo) | Décision issue du document `docs/reflexion-patterns-attaques.md`. Les patterns actuels (`tactical.ts`) ne correspondent pas à l'image mentale de l'attaque. Changements effectifs après implémentation de `slash` et `blast`. |
| 111 | 2026-03-26 | Patterns cross maintenus | **`cross` reste pour Éclate-Roc et Ombre Nuit** | Les ondes et explosions diffuses gardent la forme en croix. `blast` (cercle) remplace `cross` uniquement pour les vrais projectiles explosifs. |
| 112 | 2026-03-26 | Nouvelles mécaniques identifiées | **knockback, warp, ground (zones persistantes), self-damage** | Documentées dans `docs/reflexion-patterns-attaques.md`. Ce sont des **flags/effets** sur le move, pas des patterns de ciblage. À implémenter en Phase 1+, après les patterns `slash` et `blast`. |
| 115 | 2026-03-25 | Scope plan 013 — nombre de joueurs | **2 joueurs uniquement** (modèle prêt pour N) | `MapFormat` et `PlacementPhase` supportent N équipes, mais l'implémentation se limite à 2 joueurs (contrainte `PlayerId` actuel). Le refactor N joueurs est prévu en plan 014. |
| 116 | 2026-03-26 | Format de combat par défaut | **6v6** | La carte `poc-arena` implémente le format 6v6 avec zones de spawn centrées sur les bords opposés (haut/bas). 12 Pokemon max sur la grille 12x12. |
| 117 | 2026-03-26 | URL param `?random` | **Mode placement random activable via URL** | `?random` dans l'URL déclenche `PlacementMode.Random` pour un démarrage instantané sans phase de placement interactive. Utile pour le développement et les tests visuels rapides. |
| 118 | 2026-03-26 | Info panel — comportement hover | **Retour au Pokemon actif quand le hover quitte la grille** | L'info panel affiche les stats du Pokemon sous la souris pendant le hover. Quand la souris quitte la grille, il revient automatiquement au Pokemon dont c'est le tour. |
| 119 | 2026-03-26 | Status icons dans la timeline | **Pastilles colorées** par type de statut dans la turn timeline | Chaque statut majeur (brûlure, poison, paralysie, gel, sommeil) a une couleur distincte. La pastille apparaît à côté du portrait dans la timeline quand le Pokemon est affecté. |
| 120 | 2026-03-26 | Stat change indicators | **Flèches ↑↓ colorées** dans l'info panel | Les modificateurs de stats actifs sont affichés sous forme de flèches colorées (vert montée, rouge descente) dans l'info panel du Pokemon sélectionné. |
| 121 | 2026-03-26 | Movesets 8 nouveaux Pokemon | **À valider par l'humain** — implémentés fonctionnellement, pas encore équilibrés | Les 32 nouveaux moves des 8 Pokemon (Pikachu → Otaria) sont dans `packages/data`. Ils couvrent les patterns Line, Dash supplémentaires, et le statut Gel. L'équilibrage (puissances, PP, ranges tactiques) est à revoir avec l'humain avant validation. |

---

## Questions ouvertes

| # | Question | Notes | Priorité |
|---|----------|-------|----------|
| 1 | Formules dérivées | Vitesse/Poids → Mouvement/Saut/Initiative. Attention : Hâte (+2 Vit) ne doit pas être OP si Initiative = Vitesse. | Phase 1 |
| 4 | Dégâts de chute & Poids | Le poids influence-t-il les dégâts de chute ? Plus lourd = plus de dégâts au sol ? À tester. | Phase 2 |
| 5 | ~~Countdown KO~~ | Résolu décision #24 : pas de countdown, KO définitif. Corps reste sur la tile. Seule revival : Second Souffle (1 PP). | ~~Phase 1~~ |
| 6 | PP ou Points d'action ? | Les PP fonctionnent-ils dans un contexte tactique ? Sinon passer à un système de points d'action style FFTA. Tests headless : une IA sans filtre de cible gaspille ses PP (bug IA, pas bug PP). Les PP fonctionnent correctement côté core. À évaluer côté équilibrage en Phase 1. | Phase 1 |
| 7 | ~~Durée des statuts~~ | Résolu décision #65 : 1 statut majeur, durées Pokemon (sleep 1-3, freeze 20%/tour, burn/poison/paralysis permanent). | ~~Phase 1~~ |
| 8 | ~~Stacking des statuts~~ | Résolu décision #65 : 1 seul à la fois pour le POC. | ~~Phase 1~~ |
| 10 | Système CT (FFTA) vs Round-robin | Round-robin pour le POC (décision #62). Le CT est plus tactique (vitesse = fréquence d'action, coût CT variable par move), mais risques : vitesse trop forte, petits moves (PP élevés) trop avantageux car coût CT faible. Idée : corrélation PP ↔ coût CT (peu de PP = move puissant = coût CT élevé). Voir aussi Mystery Dungeon Travel Speed (x0.5 à x4). À évaluer en Phase 1 avec les tests headless de balancing. | Phase 1 |
| 9 | Interaction statut/terrain | Brûlure guérie par eau ? Gel facilité sur glace ? | Phase 2 |
| 2 | HD-2D avancé | Quand migrer ? **Babylon.js** (built-in DoF/bloom/tilt-shift, écrit en TS, NullEngine) vs **Three.js** (plus léger, plus grande communauté). Spike comparatif prévu. | Phase 4 |
| 3 | Agents & Skills Claude Code | Quels agents/skills custom créer ? Proposition faite, à valider et affiner au fil du dev. | Phase 0 |

---

## Décisions écartées

| Option | Raison de l'élimination |
|--------|------------------------|
| Godot + C# | **Pas d'export web** avec Godot .NET. Bloquant. |
| Godot + GDScript | GDScript lié à Godot → découplage core/rendu impossible. Web limité (Compatibility renderer uniquement, pas de shaders avancés). |
| Phaser 3 | Phaser 4 RC6 est API-compatible et c'est l'avenir. Autant partir dessus pour un nouveau projet. |
| ESLint + Prettier | Biome fait les deux en un, plus rapide, moins de config. |
| Tour par équipe | Moins tactique que l'initiative individuelle. |
| Nx | Overkill pour 3-4 packages. pnpm workspaces suffit. À reconsidérer si partie serveur multi. |
| Bun (pour l'instant) | Très prometteur (runtime TS natif, bundler, test runner, package manager = moins de deps). Encore jeune, quelques incompatibilités. **À reconsidérer plus tard** — pourrait remplacer pnpm + Vite + Vitest d'un coup. |
| Roster large pour le POC | 4 Pokemon suffisent pour valider les mécaniques. On élargira en Phase 1. |
