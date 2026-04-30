# Décisions & Questions ouvertes — Pokemon Tactics

> Log des décisions prises et questions à trancher.
> Pour game design, voir [game-design.md](game-design.md).
> Pour architecture, voir [architecture.md](architecture.md).

---

## Décisions prises

| # | Date | Question | Décision | Contexte |
|---|------|----------|----------|----------|
| 1 | 2026-03-19 | Système de tour | **Initiative individuelle** (FFTA-like) | Basée sur Vitesse/Poids. Plus tactique que tour par équipe. |
| 2 | 2026-03-19 | Friendly fire | **Oui** | AoE touche alliés. Force positionnement. |
| 3 | 2026-03-19 | Format joueurs | **Hot-seat**, jusqu'à 12 joueurs | Style Civilization. Équipes ou FFA. Réseau plus tard. |
| 4 | 2026-03-19 | Stats de base | **Stats officielles Pokemon** | On adapte formules, pas les stats. |
| 5 | 2026-03-19 | Stats dérivées | **Mouvement = paliers base speed (décisions #179-181). Initiative = combat speed. Saut = 1.** | Mouvement basé sur base speed + stages. Poids écarté. Saut fixe à 1. |
| 6 | 2026-03-19 | Formule dégâts | **Formule Pokemon officielle** comme base | Adaptée au contexte tactique (terrain, hauteur). |
| 7 | 2026-03-19 | Architecture | **Moteur découplé du rendu** | Core TS pur. Permet IA, tests headless, changement renderer. |
| 8 | 2026-03-19 | AI-playable | **Oui** | IA classique + LLM + MCP server. Pour tests, équilibrage, solo. |
| 9 | 2026-03-19 | Replay | **Oui** | Log d'actions déterministe (seed + actions). |
| 10 | 2026-03-19 | Navigateur | **Oui** — web natif | Comme PokeRogue. Pas d'export WASM. |
| 11 | 2026-03-19 | Versionning | **Git** | Conventional commits. |
| 12 | 2026-03-19 | Stack | **TypeScript + Phaser 4** | Core TS pur + Phaser 4 rendu. Monorepo pnpm. API compatible Phaser 3. |
| 13 | 2026-03-19 | Développeur principal | **Claude Code** | L'humain supervise, review, guide. Claude Code écrit le code. |
| 14 | 2026-03-19 | Linter/Formatter | **Biome** | Remplace ESLint + Prettier. Plus rapide, une config. Utilisé par PokeRogue. |
| 15 | 2026-03-19 | Plans d'exécution | **`docs/plans/xxx-name.md`** | Numérotés, avec statut. Conservés comme historique. |
| 16 | 2026-03-19 | Roster POC | **Bulbizarre, Salamèche, Carapuce, Roucoul** | 4 Pokemon, 4 types. Suffisant pour valider mécaniques. |
| 17 | 2026-03-19 | Caméra | **Fixe + zoom** | Rotation 4 angles (FFTA) en phase ultérieure. |
| 18 | 2026-03-19 | Taille grille POC | **12x12** | Variable par map à terme. 12x12 = bon compromis jusqu'à 12 Pokemon. |
| 19 | 2026-03-19 | Monorepo | **pnpm workspaces seul** | Pas de Nx. À ajouter si besoin serveur multi. |
| 20 | 2026-03-19 | Sprites | **PMDCollab/SpriteCollab** | 8 directions, animations riches, Gen 1-9. Pipeline AnimData.xml → Phaser atlas JSON. |
| 21 | 2026-03-20 | Formule dégâts | **Base officielle + surcharges tactiques** | Formule Pokemon socle, couche de surcharge (hauteur, orientation, terrain). Override possible par capacité. |
| 22 | 2026-03-20 | Précision / esquive | **Système Pokemon + modificateurs terrain** | Précision × évasion + bonus/malus terrain. Surchargeable. |
| 23 | 2026-03-20 | PP | **Oui, conservés** | PP maintenus. Surchargeables. Possibilité de basculer vers points d'action si PP ne fonctionnent pas. |
| 24 | 2026-03-24 | KO / élimination | **KO définitif, corps reste sur tile** | 0 PV = KO définitif. Bloque passage. Seule revival : Second Souffle (1 PP). |
| 25 | 2026-03-20 | Déplacement diagonal | **Non** | 4 directions uniquement (style FFTA / Fire Emblem). |
| 26 | 2026-03-20 | Blocage tiles | **Oui, sauf exceptions** | Pokemon bloquent ennemis. Alliés traversent. Exceptions : Vol, Spectre, Lévitation. |
| 27 | 2026-03-20 | Dégâts de chute | **Oui** | Proportionnels à hauteur. Vol/Lévitation immunisés. |
| 28 | 2026-03-20 | Brouillard de guerre | **Non** | Visibilité totale. |
| 29 | 2026-03-20 | Alliances FFA | **Non** | FFA = chacun pour soi. Mode équipe = format séparé. |
| 30 | 2026-03-20 | Taille d'équipe | **Configurable par format** | Base = 6v6. Défini avant combat. |
| 31 | 2026-03-20 | Système d'équilibrage | **Surcharge (override) par couche** | Base → tactical → balance. DeepMerge au startup. |
| 32 | 2026-03-20 | Inspiration principale | **FFTA** (pas FFT) | L'humain a joué FFTA. Références ajustées. |
| 33 | 2026-03-20 | Attaques de priorité | **Dash en ligne droite** | Combine déplacement et attaque. Plus tactique que "agir en premier". |
| 34 | 2026-03-20 | Vampigraine | **Lien à distance + durée limitée** | Drain tant que cible ≤ X tiles, max 3 tours. Surchargeable. |
| 35 | 2026-03-20 | Dracosouffle | **Pattern cône** | Souffle = cône devant lanceur. |
| 36 | 2026-03-20 | Brouillard | **Zone self (portée 0)** | Centrée sur lanceur, pas à distance. |
| 37 | 2026-03-20 | Attaques : architecture | **Composition Targeting + Effects** | Chaque attaque = pattern ciblage + liste effets. Déclaratif. Nouveau kind = nouveau resolver. |
| 38 | 2026-03-20 | Core sync / Renderer async | **Core synchrone, renderer async** | `submitAction()` sync, émet events. IA joue à pleine vitesse. Renderer gère queue animations. |
| 39 | 2026-03-20 | Core → Renderer : events | **Événements (observer pattern)** | Core émet BattleEvents. Renderer souscrit et anime. Alimentent aussi replays. |
| 40 | 2026-03-20 | Surcharges : structure | **3 couches : base → tactical → balance** | DeepMerge au startup. |
| 41 | 2026-03-20 | Validation données | **Oui, au startup** | Léger, une fois au boot. |
| 42 | 2026-03-20 | Référence principale | **Pokemon Conquest** (DS) | LA référence directe. "Ça, mais mieux." |
| 43 | 2026-03-20 | Module resolution | **`bundler`** | Vite gère bundling. Pas d'extensions `.js`. Aligné Angular/Nx. |
| 44 | 2026-03-20 | tsconfig | **Un seul base + extends** | Pas de project references. Path aliases dans `tsconfig.base.json`. Pattern Nx. |
| 45 | 2026-03-20 | Structure core | **Flat par responsabilité** | enums/, types/, grid/, battle/. Restructurer par domaine si complexité le justifie. |
| 46 | 2026-03-20 | Const object enum | **Pattern `as const` + type dérivé** | Pas d'enum TS natif, pas de switch sur strings. |
| 47 | 2026-03-20 | Nommage variables | **Même nom que le type** | `traversalContext: TraversalContext`. Pas d'abréviations. |
| 48 | 2026-03-20 | Commentaires | **Non sauf algo complexe** | Code lisible sans commentaires. |
| 49 | 2026-03-20 | Coverage | **Core uniquement, exclut types/enums/barrels/tests** | Coverage sur comportement, pas déclarations. |
| 50 | 2026-03-20 | Coverage threshold | **100% sur core** | Logique pure — chaque chemin testé. |
| 51 | 2026-03-20 | Mocks | **`abstract class` + `static readonly` + données pures** | Pas de helper de création. Mocks = données explicites. Variations via spread. |
| 52 | 2026-03-20 | Biome `noStaticOnlyClass` | **Désactivé pour testing/mocks** | `abstract class MockX` = pattern délibéré (prévient instanciation). Désactivé via override sur `**/testing/**` et `**/mocks/**`. |
| 53 | 2026-03-20 | Utils extraits | **`utils/` pour fonctions pures transversales** | `manhattanDistance`, `directionFromTo`, `stepInDirection`, `getPerpendicularOffsets`. |
| 54 | 2026-03-20 | Niveaux de test | **4 niveaux : unit, intégration, scénario, E2E** | Unit (*.test.ts, 100%), intégration (*.integration.test.ts), scénario (*.scenario.test.ts), E2E (Playwright). |
| 55 | 2026-03-20 | Vitest projects | **`test.projects` dans vitest.config.ts** | Vitest 4 a deprecaté `vitest.workspace.ts`. |
| 56 | 2026-03-20 | `Accuracy`/`Evasion` dans `StatName` | **Ajoutés comme stats à part entière** | Smokescreen/Sand-Attack corrigeaient mauvaise stat. |
| 57 | 2026-03-20 | Codes d'erreur | **`ActionError` enum** | Typés, pas des strings. Compilateur valide les cas. |
| 58 | 2026-03-20 | `MockBattle` centralisé | **Dans `testing/`**, pas inline | Tests d'intégration et scénario utilisent `MockBattle`. Cohérent avec `MockPokemon`. |
| 59 | 2026-03-20 | `deepMerge` et arrays | **Arrays remplacés, pas concaténés** | Override qui fournit `effects` remplace entièrement le tableau de base. |
| 60 | 2026-03-20 | `TurnManager` source de vérité | **`TurnManager` maître, `BattleState` synchronisé après** | Évite incohérences d'état. |
| 61 | 2026-03-20 | Commentaires tests | **Autorisés dans intégration/scénario, avec parcimonie** | Tests unitaires sans commentaires. Scénarios utilisent bloc Gherkin. |
| 62 | 2026-03-21 | Système de tour POC | **Round-robin** | CT prévu Phase 1+. Plus intéressant tactiquement mais plus complexe. |
| 63 | 2026-03-24 | KO POC | **Définitif** (aligné #24) | `koCountdown` supprimé. |
| 64 | 2026-03-21 | Vampigraine POC | **Permanent + rupture définitive** | Pour POC, permanent (comme Pokemon), brisé par KO ou distance > maxRange. |
| 65 | 2026-03-21 | Statuts POC | **1 seul à la fois** | 1 statut majeur max. |
| 66 | 2026-03-21 | Paralysie tactique | **Bloque déplacement, pas attaque** | Proc 25% : pas de move/dash, peut attaquer sur place. -50% initiative permanent. |
| 67 | 2026-03-21 | Effect architecture | **Handler registry** | Remplace switch case dans `effect-processor.ts`. Ajouter effet = enregistrer handler. Inspiré Showdown. |
| 68 | 2026-03-21 | Phases de tour | **StartTurn → Action → EndTurn** | Pipeline phases avec handlers par priorité. Status ticks StartTurn, drain EndTurn. |
| 69 | 2026-03-21 | Valeurs ticks statut POC | **Burn 1/16, Poison 1/8, Sleep 1-3t, Freeze 20%/t, Paralysie 25% proc** | Valeurs Pokemon. Paralysie bloque move+dash. -50% initiative permanent. |
| 70 | 2026-03-21 | Validation core headless | **Validé par 2 combats IA headless** | IA Random (58 rounds), IA Smart (67 rounds). Core prêt pour renderer. |
| 71 | 2026-03-21 | `getLegalActions` comme filtre IA | **Toute IA doit utiliser `getLegalActions()` avant de choisir** | Tests headless : IA sans filtre gaspille PP. `getLegalActions` expose positions valides. |
| 72 | 2026-03-22 | Style commit | **Titre seul, jamais de corps** | Un commit = une ligne. Historique lisible d'un coup d'œil. |
| 73 | 2026-03-22 | Code-reviewer : titre commit | **Toujours proposer titre commit après review** | |
| 74 | 2026-03-22 | README public | **Disclaimers Nintendo + IA obligatoires** | Fan project non affilié. Assets CC BY-NC 4.0. Code généré par Claude Code. |
| 75 | 2026-03-22 | Move+Act par tour | **FFTA-like : Move + Act + EndTurn** | Move une fois + Act une fois dans n'importe quel ordre. Fin sur EndTurn explicite. Remplace SkipTurn. |
| 76 | 2026-03-22 | Dash après Move | **Autorisé** | Dash consomme Act, pas Move. Move→Dash et Dash→Move permis. À surveiller si trop fort. |
| 77 | 2026-03-22 | Overlay UI renderer | **BattleUIScene séparée de BattleScene** | Évite conflits depth/camera. Communication via event `uiReady`. |
| 78 | 2026-03-22 | ActionMenu : Zone vs Container | **Zone Phaser en coordonnées absolues** | Containers imbriqués → problèmes depth/coords. |
| 79 | 2026-03-22 | screenToGrid : round vs floor | **`Math.round`** | `Math.floor` causait erreur hit detection d'une demi-tile en iso. |
| 80 | 2026-03-22 | Canvas dans container | **`#game-container`** | Facilite layout CSS et resize. |
| 81 | 2026-03-22 | Depth renderer | **Centralisé dans `constants.ts`** | Toutes valeurs depth = constantes nommées. Évite magic numbers. |
| 82 | 2026-03-22 | Noms Pokemon dans UI | **Capitalisés, retirés des sprites** | Panel info et timeline suffisent. Désencombre grille. |
| 83 | 2026-03-24 | `PlayerId` const enum | **`PlayerId` remplace string literals** | `"player-1"` fragile. Const object enum cohérent avec pattern #46. |
| 84 | 2026-03-24 | Vive-Attaque `maxDistance` | **2 tiles** | 3 tiles documenté mais 2 retenu. Ajustable via override. |
| 85 | 2026-03-24 | Dash déplace caster | **Oui** | Repositionnement tactique intrinsèque. |
| 86 | 2026-03-24 | Dash ne consomme pas `hasMoved` | **Dash consomme `hasActed`, pas `hasMoved`** | Décision #76 confirmée. Double repositionnement possible (dash + déplacement). |
| 87 | 2026-03-24 | Dash dans le vide | **Autorisé** | Repositionnement sans frappe. Consomme Act, pas Move. |
| 88 | 2026-03-24 | Pipeline sprites | **Script one-shot `scripts/extract-sprites.ts`** | Outil build autonome, génère assets statiques dans `public/`. `pnpm extract-sprites`. |
| 89 | 2026-03-24 | Clés d'animation Phaser | **`{pokemonId}-{anim}-{direction}`** | Convention lookup direct. Compatible 8 directions. |
| 90 | 2026-03-24 | Fallback sprites | **Cercle coloré si atlas absent** | Robustesse pour nouveaux Pokemon non encore extraits. |
| 91 | 2026-03-24 | Setup Phaser injecté | **`BattleSetup` injecté dans `GameController`** | Meilleure séparation responsabilités. |
| 92 | 2026-03-24 | Roster cible | **151 premiers Pokemon (Gen 1)** | |
| 93 | 2026-03-24 | Revival | **Seule capacité : Second Souffle (1 PP)** | KO quasi-définitif. Revival rare et coûteuse. |
| 94 | 2026-03-24 | Replay & fixtures visuelles | **Replay Showdown-like avec navigation next/prev** | Fixture = replay pausé. `?fixture=post-ko` pour visual-tester. |
| 95 | 2026-03-25 | `EndTurn` direction | **Direction obligatoire** | `getLegalActions` génère 4 actions `EndTurn`. |
| 96 | 2026-03-25 | Orientation initiale | **Vers centre grille** via `directionFromTo` | Centre = `{ x: floor(width/2), y: floor(height/2) }`. |
| 97 | 2026-03-25 | DirectionPicker — sprites vs Graphics | **Spritesheet `arrows.png`** | Plus robuste, personnalisable visuellement. |
| 98 | 2026-03-25 | Détection direction — quadrants | **Quadrants cardinaux écran** | Plus intuitif en vue iso. |
| 99 | 2026-03-25 | Carte porte zones spawn | **`MapDefinition` avec dimensions libres, tiles, formats, zones spawn arbitraires** | Spawns plus codés en dur dans `BattleSetup`. |
| 100 | 2026-03-25 | Formats de combat | **2p (6v6 max), 3p (4v4v4), 4p (3v3x4), 6p (2v2x6), 12p (1x12). Max 12 Pokemon.** | Chaque carte déclare formats supportés via `MapFormat`. |
| 101 | 2026-03-25 | Alternance placement | **Serpent : P1-P2-P2-P1-P1-P2...** | Plus équitable que alternance simple. |
| 102 | 2026-03-25 | Repositionnement placement | **Uniquement le Pokemon placé durant l'alternance courante** | `undoLastPlacement()` — pas de retour sur tours précédents. |
| 103 | 2026-03-25 | Direction au placement | **Choix obligatoire après chaque placement** | `DirectionPicker` réutilisé. Random → auto vers centre. |
| 104 | 2026-03-25 | `PlayerController` | **`Human` / `Ai`** | IA place aléatoirement. Sert aussi pour tour de jeu. |
| 105 | 2026-03-25 | Sprites placement → combat | **Sprites placement détruits, recréés par `BattleSetup`** | Plus simple que transfert. |
| 106 | 2026-03-25 | Seed placement | **Injectable dans `PlacementPhase`** | PRNG déterministe si seed fourni. Intégré dans système replay. |
| 107 | 2026-03-25 | `PlacementPhase` — périmètre | **Objet core indépendant, créé avant `BattleEngine`** | Pas de couplage direct entre les deux. |
| 108 | 2026-03-26 | Nouveau pattern : slash | **`slash` — touche 3 cases devant (face + 2 diagonales)** | Attaques de balayage (Tranch'Herbe, Cru-Aile). |
| 109 | 2026-03-26 | Nouveau pattern : blast | **`blast` — projectile qui explose en cercle (range + radius)** | Bombes explosent en cercle. Différent de `zone` (self) et `cross` (forme +). |
| 110 | 2026-03-26 | Révision patterns — 8 attaques | **Tranch'Herbe→slash, Poudre Dodo→zone r1, Bombe-Beurk→blast r2, Bulles d'O→cone, Tornade→cone, Cru-Aile→slash, Ampleur→zone r2** | Patterns actuels ne correspondent pas à l'image mentale de l'attaque. |
| 111 | 2026-03-26 | Patterns cross maintenus | **`cross` reste pour Éclate-Roc et Ombre Nuit** | |
| 112 | 2026-03-26 | Nouvelles mécaniques identifiées | **knockback, warp, ground (zones persistantes), self-damage** | Flags/effets, pas patterns. Phase 1+. |
| 115 | 2026-03-25 | Scope plan 013 | **2 joueurs uniquement** | `MapFormat` et `PlacementPhase` supportent N équipes. Refactor N joueurs = plan 014. |
| 116 | 2026-03-26 | Format de combat par défaut | **6v6** | `poc-arena` avec zones spawn bords opposés. |
| 117 | 2026-03-26 | URL param `?random` | **Mode placement random** | Utile pour dev et tests visuels rapides. |
| 118 | 2026-03-26 | Info panel hover | **Retour au Pokemon actif quand souris quitte grille** | |
| 119 | 2026-03-26 | Status icons timeline | **Pastilles colorées par type de statut** | |
| 120 | 2026-03-26 | Stat change indicators | **Flèches ↑↓ colorées dans info panel** | |
| 121 | 2026-03-26 | Movesets 8 nouveaux Pokemon | **À valider par l'humain** | 32 nouveaux moves fonctionnels, équilibrage à revoir. |
| 122 | 2026-03-26 | Niveau des Pokemon | **Niveau 50, sans IV/EV** | `computeStatAtLevel(base, 50)`. HP trop bas avec baseStats directes. |
| 123 | 2026-03-27 | Cross self-centered | **`cross` sans paramètre `range`** — toujours centré sur caster | Night Shade et Éclate-Roc MAJ. |
| 124 | 2026-03-27 | Cône sans `width` | **`width` supprimé** — largeur = `distance * 2 - 1` | Paramètre redondant. |
| 125 | 2026-03-27 | Source type icons | **Pokepedia ZA** | 36x36px sans texte. PokeAPI SV avait texte inséré. |
| 126 | 2026-03-27 | Source category icons | **Bulbagarden SV** | `PhysicalIC_SV.png`, `SpecialIC_SV.png`, `StatusIC_SV.png`. |
| 127 | 2026-03-27 | Tooltip grille dynamique | **Adaptée au pattern réel, minimum 3x3** | |
| 128 | 2026-03-27 | Portée dans tooltip | **Affichée uniquement pour Single (range>1) et Blast** | Omise pour self, mêlée, zone, slash, cross, line. |
| 129 | 2026-03-27 | Single deux modes | **Mêlée (range=1) vs distance (range>1)** dans grille tooltip | |
| 130 | 2026-03-30 | Pas de warning friendly fire | **Pas de couleur spéciale pour alliés dans AoE** | Friendly fire = pilier game design. Preview + clignotement suffisent. |
| 131 | 2026-03-30 | Couleurs preview AoE | **Rouge = dégâts, Bleu = buff, Outline = portée** | |
| 132 | 2026-03-30 | Source status icons | **Pokepedia ZA** | 2 formats : 52x36 (sprite) et 172x36 (label). |
| 133 | 2026-03-30 | HP bar 3 couleurs FFTIC | **Vert >60%, Jaune 30-60%, Rouge <=30%** | `HP_COLOR_HIGH`, `HP_COLOR_MEDIUM`, `HP_COLOR_LOW`. |
| 134 | 2026-03-30 | Badges stat changes style Showdown | **Fond bleu (buff) / rouge (debuff), coins arrondis, texte blanc** | `STAT_BADGE_BUFF_COLOR`, `STAT_BADGE_DEBUFF_COLOR`. |
| 135 | 2026-03-30 | Animation Sleep synchronisée | **`setStatusAnimation(isAsleep)`, déclenché via StatusApplied/StatusRemoved** | |
| 136 | 2026-03-30 | Random roll formule dégâts | **Facteur aléatoire x0.85–1.00** | Aligné formule Pokemon officielle. Variance ±15%. |
| 137 | 2026-03-30 | `estimateDamage` — API publique | **`BattleEngine.estimateDamage(attackerId, moveId, defenderId)` → `{ min, max, effectiveness }`** | UI et IA connaissent fourchette avant exécution. |
| 138 | 2026-03-31 | Mode Sandbox | **1 Pokemon joueur vs 1 Dummy configurable sur micro-carte 6x6** | Pour tester mécaniques rapidement. |
| 139 | 2026-03-31 | Roster élargi (Phase 1) | **Reporté — sandbox d'abord** | |
| 140 | 2026-03-31 | Tests intégration moves | **Un fichier par move, scénarios positionnels** | Style Gherkin. Systématique pour chaque nouveau move. |
| 141 | 2026-03-31 | Moves défensifs — durée | **"Jusqu'au prochain tour du lanceur", sauf Prévention (1 coup). Disparaît si lanceur KO.** | |
| 142 | 2026-03-31 | Abri / Détection — directionnel | **Bloque face et côtés. Dos vulnérable. Pas de spam penalty.** | Adaptation tactique majeure vs Pokemon base (omnidirectionnel). |
| 143 | 2026-03-31 | Garde Large — portée | **Bloque AoE dans rayon 2 tiles, protège alliés dans ce rayon.** | Localisée (pas toute l'équipe). Disparaît si lanceur KO. |
| 144 | 2026-03-31 | Prévention / Quick Guard | **Bloque prochaine attaque reçue, toute direction. Consommé en 1 coup.** | Omnidirectionnel mais 1 usage. Complément à Abri. |
| 145 | 2026-03-31 | Riposte / Voile Miroir / Fulmifer | **Rendent sur chaque attaque reçue pendant durée. x2 ou x1.5. Pas de renvoi si KO du coup.** | Restent actifs pendant toute durée (pas seulement premier coup). |
| 146 | 2026-03-31 | Ténacité / Endure | **Pas tomber sous 1 PV. Pas 2 tours de suite. Ne bloque pas dégâts indirects.** | Spam penalty conservé (contrairement à Abri). |
| 147 | 2026-04-01 | Commit message — responsabilité | **Agent `commit-message` dédié** | Séparé de `code-reviewer`. Appelé par `session-closer`. |
| 148 | 2026-04-01 | Agent `sandbox-url` | **Génère URLs sandbox depuis description langage naturel** | Évite de mémoriser query params. |
| 150 | 2026-04-02 | Stockage statuts volatils | **`volatileStatuses: VolatileStatus[]` sur `PokemonInstance`** | Séparé des statuts majeurs. Extensible. |
| 151 | 2026-04-02 | Compteur toxic | **`toxicCounter: number` sur `PokemonInstance`** | Démarre à 0, incrémenté à chaque tick, plafond 15. |
| 152 | 2026-04-02 | Bind via LinkType | **Extension `LinkType.Bind` via `EffectKind.Link`** | Ajout `immobilize?` et `drainToSource?` sur `ActiveLink`. |
| 153 | 2026-04-02 | Confusion interception | **Dans `submitAction`, avant `executeUseMove`** | Modifie action soumise puis exécute normalement. |
| 154 | 2026-04-02 | Knockback + corps KO | **Bloqué** | Corps KO = tile non-stoppable. Cohérent avec plan 011. |
| 155 | 2026-04-02 | Confusion réutilise StatusType | **`StatusType.Confused` réutilisé** | Distinction majeur/volatil = par stockage, pas par enum. |
| 156 | 2026-04-02 | Recharge | **Flag `recharging: boolean` sur `PokemonInstance`** | Bloque `use_move` dans `getLegalActions`. Reset en fin de tour. |
| 157 | 2026-04-02 | Flash — pattern zone | **Zone r2** | Flash = omnidirectionnel → cône inadapté. Friendly fire compensatoire. |
| 158 | 2026-04-02 | Draco-Queue — pattern slash | **Slash** | Mouvement de queue balaie arc devant lanceur. Knockback sur chaque cible. |
| 159 | 2026-04-02 | Tranche — pattern slash | **Slash** | Balayage d'épée = arc frontal. |
| 160 | 2026-04-02 | Jackpot → Combo-Griffe pour Miaouss | **Combo-Griffe (multi-hit 2-5)** | Plus intéressant tactiquement. |
| 161 | 2026-04-02 | Ligotage (Wrap) | **Empêche Move, pas Act. Dégâts 1/16/tour. Contact requis.** | Contre-point à la mobilité. Infrastructure `LinkType.Bind`. |
| 162 | 2026-04-02 | Confusion — pas de self-hit | **Redirection vers allié, pas vers soi** | Plus intéressant tactiquement (friendly fire). |
| 163 | 2026-04-02 | Architecture IA — scoring découplé | **`action-scorer.ts` séparé de `scored-ai.ts`** | Scoring (logique métier) découplé du sélecteur (algorithme). Testables indépendamment. |
| 164 | 2026-04-02 | Profils IA Medium et Hard | **Clones d'Easy dans ce plan** | Affinement Phase 2. |
| 165 | 2026-04-02 | IA Easy — bruit top-3 | **`randomWeight = 0.4`** | 40% chance action sous-optimale dans top 3. `randomWeight=0` = optimal pur, `=1` = aléatoire pur. |
| 166 | 2026-04-02 | `AiTeamController` dans renderer | **Dans `packages/renderer/`** | Orchestration tour complet dépend de `onTurnReady`. Scoring/sélection restent dans core. |
| 167 | 2026-04-02 | IA dans core, extraction Phase 5 | **Reporter à Phase 5** | ~5 fichiers, ~150 lignes. Pas assez de masse pour package séparé. |
| 168 | 2026-04-03 | i18n — solution maison | **~70 lignes : `t()`, `setLanguage()`, `detectLanguage()`, persistance localStorage** | 2 langues, <300 clés. `i18next` surdimensionné. |
| 169 | 2026-04-03 | i18n — core i18n-free | **Core émet events avec IDs. Renderer traduit.** | Core ne dépend jamais d'une langue. |
| 170 | 2026-04-03 | i18n — noms Pokemon/moves dans `packages/data` | **`getMoveName(id, lang)` et `getPokemonName(id, lang)`** | Noms = données JSON, pas clés UI. Accessibles par autres consommateurs (IA, CLI). |
| 171 | 2026-04-03 | i18n — `Language` dans renderer uniquement | **`packages/data` accepte `string`** | Évite dépendance cyclique `data → renderer`. |
| 172 | 2026-04-03 | i18n — changement langue = restart scène | **`setLanguage()` puis `scene.restart()`** | `.setText()` nécessiterait refs à chaque Text. Restart plus simple. |
| 173 | 2026-04-03 | Vampigraine — simplification | **Statut `Seeded` avec `sourceId`. Drain 1/8, heal lanceur. Pas de maxRange.** | Système `ActiveLink` avec distance = over-engineered. |
| 174 | 2026-04-03 | Piège (Trapped) — simplification | **Statut "Trapped" : immobilise + 1/8 HP/tour pendant N tours.** | Remplace `LinkType.Bind`. Sortie par knockback ou dash reçu. |
| 175 | 2026-04-03 | Moves piège — catalogue | **10 moves piège dans Pokemon. Tous : 1/8 HP/tour, 4-5t, immobilise.** | Visuels différents, mécaniquement identiques. |
| 176 | 2026-04-03 | Rapid Spin — retire vampigraine et pièges | **Rapid Spin retire statuts `Seeded` et `Trapped`** | À implémenter quand Rapid Spin ajouté. |
| 177 | 2026-04-03 | Coups critiques — plan dédié | **Mécanique core manquante.** | Formule, multiplicateur, "Critical hit!", intégration pipeline. |
| 178 | 2026-04-03 | Niveaux d'efficacité — 5 paliers Champions | **x4 "Extremely effective", x2 "Super effective", x0.5 "Not very effective", x0.25 "Mostly ineffective", x0 "No effect"** | Inspiré Pokemon Champions. Affichés post-attaque aussi (pas seulement preview). |
| 179 | 2026-04-03 | Mouvement — basé sur base speed | **`effectiveSpeed = floor(baseSpeed × stageMultiplier)` → paliers move 2–7** | Base speed fixe par espèce → mouvement constant quel que soit niveau. |
| 180 | 2026-04-03 | Mouvement — paliers | **Move 2 (≤20) / 3 (21-45) / 4 (46-85) / 5 (86-170) / 6 (171-340) / 7 (≥341). Plancher 2, plafond 7.** | Inspiré Pokemon Conquest + FFT. |
| 181 | 2026-04-03 | Mouvement — pas d'influence poids | **Poids n'affecte pas mouvement** | Ronflex serait injouable. Aucune référence ne dérive mouvement du poids. |
| 182 | 2026-04-03 | Stats et mécaniques — versions récentes | **Stats, formules, attaques, talents de Gen 9 / Scarlet-Violet** | Roster limité Gen 1 mais données = valeurs les plus récentes. |
| 183 | 2026-04-03 | TeamSelectScene — écran de départ | **Arrive directement sur `TeamSelectScene`** | Pas de menu principal pour l'instant. |
| 184 | 2026-04-03 | Team Select — pas de restriction inter-équipes | **Mirror match autorisé** | Doublon interdit uniquement au sein d'une même équipe. |
| 185 | 2026-04-03 | Team Select — IA vs IA spectateur | **Placement auto + combat sans input humain** | `PlacementMode.Random`. GameController gère déjà ce cas. |
| 186 | 2026-04-03 | Team Select — preload portraits uniquement | **`preloadPortraitsOnly()` dans `SpriteLoader`** | Atlas complets chargés par `BattleScene`. Cache Phaser partagé. |
| 187 | 2026-04-03 | Team Select — sandbox bypass | **`parseSandboxQueryParams()` dans `TeamSelectScene.create()`** | Passe directement à `BattleScene` si `?sandbox`. |
| 188 | 2026-04-03 | Team Select — couleurs slots par équipe | **Bleu J1, Rouge J2** | Cohérence avec InfoPanel et zones spawn. |
| 189 | 2026-04-03 | Team Select — zones spawn colorées | **Zones spawn colorées bleu/rouge** | `IsometricGrid.highlightTilesWithColor` utilise couleur équipe. |
| 190 | 2026-04-03 | Team Select — bouton Auto | **Chaque clic génère nouvelle équipe aléatoire complète** | Pas de fill progressif. Explore compositions différentes. |
| 191 | 2026-04-03 | Team Select — bouton Vider | **Réinitialise équipe à 0 Pokemon** | Complément naturel d'Auto. |
| 192 | 2026-04-03 | Team Select — toggle Placement auto/manuel | **Toggle global** | S'applique à toutes équipes humaines. IA = toujours auto. |
| 193 | 2026-04-03 | Écran victoire — bouton Retour | **Ramène à `TeamSelectScene`** | En plus de "Rejouer". Permet changer équipe sans recharger. |
| 194 | 2026-04-03 | Team Select — grille portraits 82px | **82×82px** | 64px trop petit sur 4K. Compromis lisibilité/densité. |
| 195 | 2026-04-05 | Classification moves pour animations | **3 catégories : `Contact`, `Shoot`, `Charge`** — `AnimationCategory` | Catégorie physique/spéciale/statut insuffisante pour animations. 73 moves classifiés. |
| 196 | 2026-04-05 | Animation par catégorie | **Contact→Attack, Shoot→Shoot, Charge→Charge, fallback Attack** | Charmander et Sandshrew n'ont pas Shoot (404 PMDCollab). |
| 197 | 2026-04-05 | Direction dynamique | **Sprite tourne à chaque step du pathfinding** | Lecture visuelle naturelle du chemin. |
| 198 | 2026-04-05 | Direction avant attaque | **Depuis `pokemon.orientation` dans `BattleState`** | Core = source de vérité. Renderer lit état au moment de `MoveStarted`. |
| 199 | 2026-04-05 | Extraction sprites — exclusion sans PNG | **Script exclut entrées `AnimData.xml` dont PNG absent** | Évite clés sans frame → warnings runtime. |
| 200 | 2026-04-05 | `MoveStarted` event — champ `direction` | **`direction: Direction` ajouté à `MoveStarted`** | En mode IA, events reçus après toutes actions — orientation finale ≠ direction d'attaque. |
| 201 | 2026-04-05 | Self-target — pas de rotation | **Move self-target ne change pas orientation** | Gardes orientation courante. |
| 202 | 2026-04-05 | Formats multi-équipes supportés | **2, 3, 4, 6 ou 12 équipes** — max 12 Pokemon simultanément | Divisent exactement 12. |
| 203 | 2026-04-05 | Taille équipe calculée automatiquement | **maxPokemonPerTeam = 12 / teamCount** | |
| 204 | 2026-04-05 | TEAM_COLORS — 12 couleurs | **`TEAM_COLORS[12]` dans `constants.ts`** | Remplace ternaires `player1 ? BLUE : RED`. |
| 205 | 2026-04-05 | Layout TeamSelectScene — 2 colonnes | **Encadrés empilés verticalement en 2 colonnes** | Colonne gauche reçoit équipe supplémentaire si impair. |
| 206 | 2026-04-05 | Bouton "Remplir IA" | **Un bouton global remplit toutes équipes non validées avec IA aléatoires** | |
| 207 | 2026-04-05 | poc-arena 12×20 | **`width: 12, height: 20`** | 12×12 trop petite pour 3+ équipes. |
| 208 | 2026-04-05 | `IsometricGrid` — grille rectangulaire | **`gridWidth` et `gridHeight` distincts** | Nécessaire pour carte 12×20. |
| 209 | 2026-04-06 | Multijoueur — P2P WebRTC via PeerJS | **Pas de serveur dédié.** | Zéro coût, tour par tour (pas de contrainte latence), données minuscules. |
| 210 | 2026-04-06 | Multijoueur — exécution dupliquée | **Chaque joueur fait tourner son propre BattleEngine avec même seed.** | Pas de host = pas de triche. PRNG seedé + core déterministe. |
| 211 | 2026-04-06 | Multijoueur — détection triche | **Action reçue validée contre `getLegalActions()`. 3 illégales = forfait.** | Jeu à information complète → seule triche = actions illégales. |
| 212 | 2026-04-06 | Multijoueur — détection désync | **Comparaison périodique hash `BattleState`.** | Resync via replay si divergence. |
| 213 | 2026-04-06 | Versioning — CalVer | **`2026.4.1`, `2026.4.2`** (année, mois, incrément) | Plus parlant que semver pour jeu. |
| 214 | 2026-04-06 | Deploy — GitHub Pages sur release | **Build Vite déployé via GitHub Actions sur release.** | Gratuit, simple. Pas à chaque push. |
| 215 | 2026-04-07 | Analytics — Goatcounter | **Injecté via plugin Vite en production uniquement** | Sans cookies, conforme RGPD. |
| 216 | 2026-04-07 | HP bar — couleur par équipe | **HP bar = couleur équipe** (remplace gradient vert/jaune/rouge) | Meilleure lisibilité multi-équipes. `TEAM_COLORS[playerIndex]`. |
| 217 | 2026-04-07 | Preview dégâts — noir semi-transparent | **Noir semi-transparent** (remplace rouge garanti + rouge possible) | Rouge preview se confondait avec HP bar équipe 2. `DAMAGE_PREVIEW_COLOR`. |
| 218 | 2026-04-07 | Raccourcis clavier Espace et C | **Espace → end turn / C → recentrer** | Convention standard tactical RPGs PC. |
| 219 | 2026-04-07 | Badge statut — border blanc | **`setStrokeStyle` blanc sur rectangles badges** | Meilleur contraste sur fond sombre. |
| 220 | 2026-04-08 | Mode pixel art Phaser | **`roundPixels: true` + `setFilter(NEAREST)` manuel** | `pixelArt: true` écarté — applique NEAREST aux textures texte. |
| 221 | 2026-04-08 | Portraits — pas de `applyPortraitFilters()` | **Sans `pixelArt: true`, portraits restent en LINEAR** | |
| 222 | 2026-04-08 | Grille — TILE_WIDTH 64→32 | **Tiles divisées par 2, zoom × 2 en compensation** | Tiles 64×32 + scale 2 = rendu 128×64 — double de ce que tileset attendait. |
| 223 | 2026-04-08 | Police — Pokemon Emerald Pro | **`FONT_FAMILY = "Pokemon Emerald Pro, monospace"` dans `constants.ts`** | Fallback `monospace` jusqu'à intégration TTF. 14 fichiers migrés. |
| 224 | 2026-04-08 | TerrainType — 11 valeurs | **Normal, TallGrass, Obstacle, Water, DeepWater, Magma, Lava, Ice, Sand, Snow, Swamp** | Effets gameplay = plan séparé. |
| 225 | 2026-04-08 | Suppression `isPassable` | **Passabilité → `isTerrainPassable(terrain)`** | Flag booléen redondant. Terrain porte déjà l'information. |
| 226 | 2026-04-08 | Parser Tiled dans `packages/data` | **`parseTiledMap`, `validateTiledMap`, `loadTiledMap`** — zéro dépendance Phaser | Fonctions pures, testables. Chargement via `fetch`. |
| 227 | 2026-04-08 | Tilesets externes .tsj | **Parser accepte .tmj embarqué ET .tsj externe** | |
| 228 | 2026-04-08 | Coordonnées spawns iso | **Conversion coords pixel Tiled → coords grille iso** | Tient compte orientation `staggered`/`isometric`. |
| 229 | 2026-04-08 | `pnpm dev:map` | **`MapPreviewScene`** — charge carte via `loadTiledMap`, grille sans combat | Zoom molette, pan clic+drag, R pour recharger. |
| 230 | 2026-04-09 | Hauteur tiles — demi-tiles | **`TileState.height` est `number`** — 0, 0.5, 1, 1.5, 2, 3… | Demi-tile = unité de saut par défaut. |
| 231 | 2026-04-09 | Pathfinding asymétrique | **Montée ≤ 0.5 autorisée, montée > 0.5 bloquée. Descente libre. Vol libre.** | Hauteurs tactiquement significatives. Rampes = seul chemin vers hauteurs. |
| 232 | 2026-04-09 | Blocage mêlée par hauteur | **Mêlée bloquée si `|heightDiff| ≥ 2`** | Asymétrie défensive forte pour positions élevées. |
| 233 | 2026-04-09 | Bonus hauteur dégâts | **±10%/niveau, plafonds +50%/-30%**, supprimé si `ignoresHeight: true` | +50% (pas +100%) évite exploitation systématique. Malus -30% plus faible que bonus. |
| 234 | 2026-04-09 | Dégâts chute — paliers | **diff ≤ 1 → 0, diff 2 → 33%, diff 3 → 66%, diff ≥ 4 → 100%.** `Math.floor(diff)`. | Demi-tiles (diff=1.5 → palier 1) ne déclenchent pas dégâts. |
| 235 | 2026-04-09 | Endure ne protège pas chute | **Ténacité ne protège PAS dégâts de chute** | Dommage environnemental, pas une attaque. |
| 236 | 2026-04-09 | Dash dans le vide — dégâts | **Move Dash/Charge sur tile plus basse applique dégâts de chute à l'attaquant** | Vol immunisé. |
| 237 | 2026-04-09 | `TILE_ELEVATION_STEP = 8` | **8px par niveau de hauteur** (`y -= height * 8`) dans `gridToScreen` | Empirique : dénivelés lisibles sans dépasser hauteur sprite. |
| 238 | 2026-04-11 | Règle blocage LoS par hauteur | **`heightBlocks(obstacle, ref) = obstacle > ref + 1`**, `ref = min(hauteur attaquant, hauteur cible)` | `min` corrige cas tireur sur plateau → cible en contrebas. `withinHeightReach` pour moves bypass-LoS (sound, zone+ground). |
| 239 | 2026-04-11 | `MoveFlags` — aligné Showdown | **`MoveFlags` sur `MoveDefinition.flags`. `ignoresLineOfSight` dérivé** : `flags.sound === true \|\| (pattern === 'zone' && type === 'ground')` | Pas de flag custom maison. Séisme/Ampleur ignorent LoS naturellement. |
| 240 | 2026-04-11 | `moveFlags` — fichier mapping séparé | **`packages/data/src/base/move-flags.ts`** appliqué dans `load-data.ts` | Ajouter flags inline = toucher 74+ fichiers. Fichier centralisé = un seul endroit. |
| 241 | 2026-04-12 | Knowledge base Pokemon | **JSON dans `packages/data/reference/`**, toutes gens, EN+FR, 19 index inversés | Évite fetches Showdown/PokeAPI. Exclusions : Gmax, Z-Moves, Tera, sprites. |
| 242 | 2026-04-13 | magma = terrain solide | **`magma` = roche volcanique marchable. `lava` = liquide en fusion.** | Sheet PMD magma-cavern a deux zones distinctes. |
| 243 | 2026-04-13 | Tileset externalisé `.tsj` partagé | **Un seul `tileset.tsj`** référencé par tous `.tmj` | Modifier tile = un seul endroit. Sans .tsj = 24 .tmj à éditer manuellement. |
| 244 | 2026-04-13 | Auto-détection X0 dans script Python | **Script scan première ligne verticale de pixels cyan** pour X0 de grille PMD | Sheet `magma-cavern` a Y0 décalé. Auto-détection évite calibrage manuel. |
| 245 | 2026-04-14 | Immunité terrain — Vol uniquement plan 051 | **Immunité terrain portée par type `Flying` uniquement.** Lévitation = talent Phase 4. | Pokemon avec Lévitation sans type Vol (ex: Magnéti) = immunité incorrecte jusqu'à Phase 4. Acceptable pour POC. |
| 246 | 2026-04-14 | Évasion tall_grass | **+1 bonus d'évasion virtuel dans `checkAccuracy`** — aucun statStage modifié | Implémentation initiale (statStages +1 EndTurn) cumulative → bonus infini. Virtuel = idempotent. |
| 247 | 2026-04-14 | KO létal terrain | **Atterrir sur `lava`/`deep_water` sans immunité = KO immédiat** (`LethalTerrainKo`) | Knockback dans lave = fatal. Renderer : "Fondu!" / "Noyé!". |
| 248 | 2026-04-14 | Orientation — scope | **Affecte uniquement dégâts** — pas évasion, pas résistance statuts | Évasion directionnelle = complexité sans gain. |
| 249 | 2026-04-14 | Orientation — 3 zones et valeurs | **Face ×0.85 (-15%), Flanc ×1.0, Dos ×1.15 (+15%)** | Symétrie ±15% simple. 3 zones cardinales. |
| 250 | 2026-04-14 | Orientation — origine Blast | **Origine = épicentre** (position impact), pas position lanceur | Cohérent avec check directionnel Abri. |
| 251 | 2026-04-14 | Undo déplacement — condition | **`hasMoved === true && preMoveSnapshot !== null`** | Move→Attack : snapshot vidé. Attack→Move : snapshot intact, undo possible. |
| 252 | 2026-04-14 | Undo déplacement — effets terrain | **Brûlure magma acquise pendant déplacement retirée lors undo** | Effets = conséquences du déplacement. |
| 253 | 2026-04-14 | Undo déplacement — UI | **Bouton "Annuler déplacement" remplace "Déplacement"** | Même slot. "Déplacement" revient disponible après undo. |
| 254 | 2026-04-15 | Adoption système CT | **ChargeTimeTurnSystem remplace round-robin** Phase 3 | Vitesse = fréquence d'action. Coût variable. |
| 255 | 2026-04-15 | Coexistence CT / Round-robin | **Les deux coexistent via `TurnSystem`. Sélectable par `BattleConfig.turnSystem`.** | A/B testing en sandbox. |
| 256 | 2026-04-15 | Paramètres CT | **ctGain V3, PP+Power floor, effectTier dans tacticalOverrides** | PP et power suivent Champions automatiquement. effectTier = décision game design stable. |
| 257 | 2026-04-15 | Immunité statut par type + feedback | **Table officielle dans `handle-status.ts`**. `StatusImmune` émis → renderer affiche "Immune". | Bug playtest CT (Fantominus empoisonné). Sans event, immunité silencieuse. |
| 258 | 2026-04-15 | Ombrage flancs uniformisé | **`LEFT_BRIGHTNESS = RIGHT_BRIGHTNESS = 0.65`** dans script Python | Uniformiser flancs supprime raccord au prix d'un rendu légèrement plus plat. |
| 259 | 2026-04-15 | Queue textes flottants | **`targetId?` sur `showBattleText`** + map `{targetId → nextSpawnAt}`. `BATTLE_TEXT_QUEUE_DELAY_MS = 700` | "Queue temporelle" retenue vs "stack vertical". Textes apparaissent au même endroit à intervalle. |
| 260 | 2026-04-15 | Damage preview | **`damageEstimateGraphics` créé une fois dans constructeur.** `clear()` + redraw. Alphas 0.55/0.85. | Root cause : `HP_BAR_HEIGHT=2` → height=0 → rectangle invisible. |
| 261 | 2026-04-15 | `isKnockedOut` dans `PokemonSprite` | **Flag posé dans `playFaintAndStay`**, early-return dans méthodes anim. | Handlers post-KO relançaient Idle. Flag centralise garde. |
| 262 | 2026-04-15 | Handler `TerrainStatusApplied` renderer | **Nouveau case dans `GameController.handleEvent`** | Core émettait event mais aucun handler → icône statut jamais mise à jour. |
| 264 | 2026-04-15 | Statuts Champions runtime | **`StatusRules` injecté dans `BattleEngine`**. `DEFAULT_STATUS_RULES` = Champions. `loadStatusRulesFromReference` dans data. | Plan 056 livrait JSON sans consumer. Ce plan referme la boucle. |
| 263 | 2026-04-15 | Pokemon Champions = source de vérité | **Pipeline Showdown Gen 9 + mod Champions**. `pnpm data:update` + `pnpm data:diff`. | `reference/*.json` contient directement valeurs Champions. |
| 265 | 2026-04-17 | Pivot 2D-HD | **Abandon renderer Phaser 4 iso 2D. Cible : 2D-HD style Triangle Strategy** | Occlusion propre + rotation caméra structurellement impossibles en iso 2D Phaser. |
| 266 | 2026-04-17 | ~~Stack 3D : Three.js (plan 062)~~ — **voir #267** | ~~**Three.js choisi**~~ | **Rouverts par spike Babylon.** |
| 267 | 2026-04-18 | Spike Babylon.js parallèle (plan 063) | **Plan 063 spike Babylon.js sur branche dédiée** sur 8 points critiques | Tooling Babylon (Inspector v2, GUI, MCP) sous-pesé dans décision #266. |
| 268 | 2026-04-18 | Pivot 2D-HD = nouvelle phase, après Phase 3 | **Phase 3 continue sans occlusion X-ray. Rewrite = nouvelle phase après Phase 3.** | Terminer Phase 3 sur renderer stable puis rebuild. |
| 269 | 2026-04-18 | **Stack 2D-HD finale : Babylon.js 8** | **Babylon.js retenu** après spike 063. Bundle gzip : 273 kB vs Three.js 129 kB (2.1×, absorbable). `skipLibCheck: true` (7 erreurs TS `@babylonjs/inspector`). Tous 8 points critiques passent. | Inspector v2 a servi 3× dans spike. GUI natif évite overlay HTML. Bundle 2× accepté. |
| 270 | 2026-04-18 | Ghost traverse obstacles | **Ghost traverse toute tile `TerrainType.Obstacle` mais ne peut pas s'y arrêter.** Priorité Vol > Ghost. | Règle unique. "Ghost traverse un mur de maison → traverse un arbre." |
| 271 | 2026-04-18 | Décorations et obstacles : layer `decorations` | **`MapDefinition` inchangé.** Parser extrait `decorationData: readonly number[]` — consommé renderer uniquement. Herbe haute auto-placée par renderer. | Préserve "core ne connaît pas Tiled". Sépare pipeline décos (PixelLab) du terrain (Python). |
| 272 | 2026-04-20 | Phase 3.5 + 3.6 déplacées après Phase 7 | **Conditionnées par réussite plan 065. Si fade per-sprite acceptable → Phase 4 d'abord.** | Coût d'opportunité rewrite maintenant trop élevé vs livrer gameplay. |
| 273 | 2026-04-21 | Orientation initiale spawns FFA multi-centre | **Chaque zone pointe vers voisin le plus proche** (Chebyshev entre barycentres). | Multi-centre → toutes équipes pointent vers même point si barycentre global. Voisin = duels frontaux adjacents. |
| 274 | 2026-04-21 | Multi-format obligatoire dans `validateTiledMap` | **`REQUIRED_TEAM_COUNTS = [2,3,4,6,12]`. Absence = erreur dure.** Option `requireAllFormats`. Dev maps (`/maps/dev/`) exemptées. | Force cohérence dès génération. Évite régressions silencieuses. |
| 275 | 2026-04-21 | Zones spawn = blocs contigus | **Barème hardcoded** : tc=2→15, tc=3→10, tc=4→8, tc=6→5, tc=12→3. Symétrie dure. | **Remplacée par #276.** |
| 276 | 2026-04-21 soir | Format spawn pivot : 1 objectgroup par format | **5 objectgroups** : `spawns_1v1`, `spawns_3p`, `spawns_4p`, `spawns_6p`, `spawns_12p`. `teamCount` déduit du nom. Objet porte juste `teamIndex`. Fallback legacy `parseLegacySpawnsLayer`. | Deux itérations agent level-designer = zones chevauchantes, tokens consommés. Humain remplit manuellement dans Tiled. |
| 277 | 2026-04-25 | Wiki GitHub bilingue — Option A | **Pages EN sans préfixe, pages FR avec noms français.** Chaque page = lien bascule `🇬🇧 English \| 🇫🇷 Français`. | Standard wikis jeux avec communauté FR/EN. |
| 278 | 2026-04-25 | Version auto-injectée via `git describe` | **`MainMenuScene` lit `__APP_VERSION__`** injecté par Vite `define` depuis `git describe --tags --always --dirty`. | Plus de bump manuel. Suffixe `-dirty`/`-N-gXXX` visible en dev. |
| 279 | 2026-04-29 | Pattern émission `AbilityActivated` hooks passifs | **Return type unifié** : `BlockResult { blocked, events }` / `DurationModifyResult { duration, events }`. Chaque ability émet ses propres events. | Pattern Showdown. Call-site agrège, ne décide pas. Future-proof. |
| 280 | 2026-04-29 | Genre des Pokemon — modèle de données | **`PokemonInstance.gender: PokemonGender` (Male/Female/Genderless)** rolled à la création depuis `PokemonDefinition.genderRatio`. `genderRatio` exposé via loaders depuis `reference/pokemon.json`. Custom roster entries (dummy) → `genderless`. | Plan 071. Donnée déjà dans reference, juste pas exposée. Genderless pour entrées custom non-canon. |
| 281 | 2026-04-29 | Roll genre — déterminisme | **`createPokemonInstance` accepte `rng: () => number` + `genderOverride?: PokemonGender`**. Caller fournit `BattleSetupConfig.genderRng` (PRNG seedé) et `genderOverrides[pokemonId]`. Fallback `Math.random`. | Plan 071. Replay déterministe : seed plumbing ; futur Team Builder : override par entrée roster. |
| 282 | 2026-04-29 | Cute Charm — règle de genre | **Genre opposé non-genderless requis** (rule Showdown). Si self ou attacker est genderless, ou si même genre → ne déclenche pas. | Plan 071. Plan 069 ignorait cette condition (bug latent). Conforme Bulbapedia/Showdown. |
| 283 | 2026-04-29 | Affichage genre — UI | **Symboles Unicode `♂` / `♀`** colorés (`#5fa8ff` / `#ff7fb4`) à droite du nameText InfoPanel. Genderless → aucun symbole. | Plan 071. Style FFTA/PokeRogue. Pas d'icône sprite — Unicode suffit, économe en assets. |
| 280 | 2026-04-29 | Suppression `onAccuracyModify` | **`onAccuracyModify` retiré de `AbilityHandler`** — `sand-veil` dormant jusqu'à Phase 9 météo. | Code mort supprimé. Ré-implémenté quand `sandstormActive` ajouté à `BattleState`. |
| 281 | 2026-04-29 | Buffer startup events | **`BattleEngine.startupEvents`. `consumeStartupEvents()`. `rerunBattleStartChecks()`.** Renderer appelle `consumeStartupEvents()` dans `BattleSetup` après création sprites. | Sans buffer, events constructeur = perdus (aucun listener branché). |
| 284 | 2026-04-29 | Natures — modèle de données | **`PokemonInstance.nature: Nature` (25 valeurs)** rolled à la création via `rollNature(rng)`. Pas de fichier `reference/natures.json` — table en dur dans `nature-modifier.ts` (immutable, jamais update). | Plan 072. Comme type chart, donnée canon Gen 3+ stable. |
| 285 | 2026-04-29 | Roll nature — distribution | **Roll uniforme sur 25 natures** via `Math.floor(rng() * 25)`. Pas de pondération. Variance ±10 % sur stats assumée comme bruit canon Pokemon. | Plan 072. Option A retenue (vs neutre par défaut). Activer Team Builder = futur plan, le joueur choisira. |
| 286 | 2026-04-29 | Formule nature | **`computeCombatStats(baseStats, level, nature?)`** applique `floor(stat × 1.1)` sur boost et `floor(stat × 0.9)` sur lowered, après calcul stat-at-level. HP **jamais** affecté (canon Gen 3+). Paramètre optionnel pour rétrocompat tests existants. | Plan 072. Formule canon Bulbapedia. |
| 287 | 2026-04-29 | `BattleSetupConfig.genderRng` → `creationRng` | **`creationRng` partagé** : ordre rolls verrouillé `gender → nature` pour stabilité replay. Ajout `natureOverrides?: Record<string, Nature>` (parallèle à `genderOverrides`, prêt Team Builder). | Plan 072. Un seul PRNG = replay déterministe avec ordre stable. |
| ~~288~~ | 2026-04-30 | ~~Affichage nature — UI~~ | **Reporté à la refonte InfoPanel** — mécanique core livrée plan 072 (`PokemonInstance.nature` rolled, applique modificateur stats), affichage UI différé. Pas d'i18n nature, pas de constante couleur. À reprendre quand InfoPanel revu globalement. | Décision humain 2026-04-30. Affichage hors-scope plan 072. |

---

## Questions ouvertes

| # | Question | Notes | Priorité |
|---|----------|-------|----------|
| ~~1~~ | ~~Formules dérivées~~ | Résolu décisions #179-181 : Mouvement = paliers base speed (2–7). Initiative = combat speed. Saut = 1. | ~~Phase 1~~ |
| 4 | Dégâts de chute & Poids | Poids influence-t-il dégâts de chute ? | Phase 2 |
| ~~5~~ | ~~Countdown KO~~ | Résolu #24 : pas de countdown, KO définitif. | ~~Phase 1~~ |
| 6 | PP ou Points d'action ? | PP fonctionnent correctement côté core. À évaluer équilibrage Phase 1. | Phase 1 |
| ~~7~~ | ~~Durée des statuts~~ | Résolu #65. | ~~Phase 1~~ |
| ~~8~~ | ~~Stacking des statuts~~ | Résolu #65. | ~~Phase 1~~ |
| ~~10~~ | ~~Système CT vs Round-robin~~ | Résolu #254-256. | ~~Phase 1~~ |
| 9 | Interaction statut/terrain | Brûlure guérie par eau ? Gel facilité sur glace ? | Phase 2 |
| ~~2~~ | ~~HD-2D avancé~~ | Résolu #265-266 : pivot 2D-HD, Babylon retenu, Phase 3.5 repoussée après Phase 7. | ~~Phase 4~~ |
| 3 | Agents & Skills Claude Code | Quels agents/skills custom créer ? | Phase 0 |

---

## Décisions écartées

| Option | Raison |
|--------|--------|
| Godot + C# | Pas d'export web avec Godot .NET. Bloquant. |
| Godot + GDScript | GDScript lié à Godot → découplage core/rendu impossible. Web limité. |
| Phaser 3 | Phaser 4 RC6 API-compatible, c'est l'avenir. |
| ESLint + Prettier | Biome fait les deux en un, plus rapide. |
| Tour par équipe | Moins tactique que initiative individuelle. |
| Nx | Overkill pour 3-4 packages. pnpm workspaces suffit. |
| Bun | Très prometteur mais encore jeune. À reconsidérer. |
| Roster large pour POC | 4 Pokemon suffisent pour valider mécaniques. |
