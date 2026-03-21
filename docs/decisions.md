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
| 13 | 2026-03-19 | Développeur principal | **Claude Code** | Le créateur supervise, review, et guide. Claude Code écrit le code. |
| 14 | 2026-03-19 | Linter/Formatter | **Biome** | Remplace ESLint + Prettier + Stylelint. Plus rapide, une seule config. Utilisé par PokeRogue. |
| 15 | 2026-03-19 | Plans d'exécution | **`plans/xxx-name.md`** | Numérotés, avec statut. Conservés comme historique. |
| 16 | 2026-03-19 | Roster POC | **Bulbizarre, Salamèche, Carapuce, Roucoul** | 4 Pokemon simples, 4 types (Plante, Feu, Eau, Normal/Vol). Suffisant pour valider les mécaniques. Movesets détaillés dans `docs/roster-poc.md`. |
| 17 | 2026-03-19 | Caméra | **Fixe + zoom (non contrôlable par l'user)** | Rotation 4 angles (style FFTA) en phase ultérieure. |
| 18 | 2026-03-19 | Taille de grille POC | **12x12** | Taille variable par map à terme. 12x12 = bon compromis pour jusqu'à 12 créatures. |
| 19 | 2026-03-19 | Monorepo | **pnpm workspaces seul** | Pas de Nx pour l'instant. On ajoutera si le besoin se présente (partie serveur multi ?). |
| 20 | 2026-03-19 | Sprites | **PMDCollab/SpriteCollab** | 8 directions, animations riches (Walk, Idle, Attack, Hurt...), ~48x48+, Gen 1-9. Pipeline : AnimData.xml → Phaser atlas JSON. Placeholders pour le POC, vrais sprites en Phase 1. |
| 21 | 2026-03-20 | Formule de dégâts | **Base officielle + surcharges tactiques** | Formule Pokemon comme socle, avec couche de surcharge (hauteur, orientation, terrain). Override possible par capacité pour l'équilibrage. |
| 22 | 2026-03-20 | Précision / esquive | **Système Pokemon + modificateurs terrain** | Précision × évasion (base Pokemon) + bonus/malus terrain (herbe, glace, hauteur). Surchargeable. |
| 23 | 2026-03-20 | PP | **Oui, conservés** | PP des attaques maintenus. Surchargeables pour l'équilibrage. Possibilité de basculer vers un système de points d'action (style FFTA) si les PP ne fonctionnent pas. |
| 24 | 2026-03-20 | KO / élimination | **Style FFTA : countdown** | 0 PV = KO + countdown (3 tours ?). Countdown à 0 = éliminé définitivement. Rappel / capacités de revival possibles. |
| 25 | 2026-03-20 | Déplacement diagonal | **Non** | 4 directions uniquement (style FFTA / Fire Emblem). |
| 26 | 2026-03-20 | Blocage tiles | **Oui, sauf exceptions** | Les créatures bloquent le passage des ennemis. Alliés traversent. Exceptions : Vol, Spectre, Lévitation. |
| 27 | 2026-03-20 | Dégâts de chute | **Oui** | Chute = dégâts proportionnels à la hauteur. Poids pourrait influencer les dégâts (à tester). Vol/Lévitation immunisés. |
| 28 | 2026-03-20 | Brouillard de guerre | **Non** | Visibilité totale pour tous les joueurs. |
| 29 | 2026-03-20 | Alliances FFA | **Non** | FFA = chacun pour soi. Pas d'alliances dynamiques. Mode équipe = format séparé. |
| 30 | 2026-03-20 | Taille d'équipe | **Configurable par format** | Base = 6v6. Défini avant le combat. Exemples : 1v1v1v1, 3v3, etc. |
| 31 | 2026-03-20 | Système d'équilibrage | **Surcharge (override) par couche** | Données officielles → surcharge globale tactique → surcharge par capacité/talent/objet. Permet d'itérer sans toucher à la base. |
| 32 | 2026-03-20 | Inspiration principale | **FFTA** (pas FFT) | Le créateur a joué à FFTA, pas FFT. Références ajustées. |
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
| 63 | 2026-03-21 | KO POC | **Définitif** (écart temporaire décision #24) | Pour le POC, KO = retiré du jeu. Le countdown FFTA (décision #24) sera implémenté en Phase 1. Le champ `koCountdown` existe déjà sur `PokemonInstance`. |
| 64 | 2026-03-21 | Vampigraine POC | **Permanent + rupture définitive** (écart décision #34) | Pour le POC, Leech Seed est permanent (comme Pokemon), brisé par KO ou distance > maxRange. La décision #34 prévoyait 3 tours max — on y reviendra si le drain permanent est trop fort. |
| 65 | 2026-03-21 | Statuts POC | **1 seul à la fois** | Comme Pokemon : 1 statut majeur max. Confusion (volatile) hors scope POC. |
| 66 | 2026-03-21 | Paralysie tactique | **Bloque le déplacement, pas l'attaque** | Proc 25% : le Pokemon ne peut pas bouger (move) ni dash, mais peut attaquer sur place (use_move non-dash). Différent de Pokemon classique (bloque tout). -50% initiative permanent. |
| 67 | 2026-03-21 | Effect architecture | **Handler registry** (écart pattern switch) | Remplace le switch case dans `effect-processor.ts` par une `EffectHandlerRegistry` (Map<EffectKind, EffectHandler>). Ajouter un effet = enregistrer un handler. Inspiré de Pokemon Showdown. |
| 68 | 2026-03-21 | Phases de tour | **StartTurn → Action → EndTurn** | Pipeline de phases avec handlers enregistrables par priorité. Status ticks en StartTurn, drain en EndTurn. Extensible pour météo, terrain, abilities. |
| 69 | 2026-03-21 | Valeurs des ticks de statut POC | **Burn 1/16 HP/tour, Poison 1/8 HP/tour, Sleep 1-3 tours, Freeze 20% dégel/tour, Paralysie 25% proc** | Calqué sur les valeurs Pokemon. Paralysie : proc bloque move+dash, pas use_move non-dash. -50% initiative permanent sur paralysé. |
| 70 | 2026-03-21 | Validation core headless | **Validé par deux combats IA headless** | IA Random (58 rounds) et IA Smart (67 rounds) : boucle tourne, KO gérés, victoire détectée, aucun crash. Le core est prêt pour le renderer. |
| 71 | 2026-03-21 | `getLegalActions` comme filtre IA | **`getLegalActions()` doit être utilisé par toute IA avant de choisir une attaque** | Les tests headless ont montré qu'une IA qui attaque sans vérifier les cibles valides gaspille tous ses PP. `getLegalActions` expose déjà les positions valides et permet de savoir si une cible est à portée. |

---

## Questions ouvertes

| # | Question | Notes | Priorité |
|---|----------|-------|----------|
| 1 | Formules dérivées | Vitesse/Poids → Mouvement/Saut/Initiative. Attention : Hâte (+2 Vit) ne doit pas être OP si Initiative = Vitesse. | Phase 1 |
| 4 | Dégâts de chute & Poids | Le poids influence-t-il les dégâts de chute ? Plus lourd = plus de dégâts au sol ? À tester. | Phase 2 |
| 5 | Countdown KO | Combien de tours avant élimination définitive ? 3 tours (FFTA) ? Ajustable ? | Phase 1 |
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
