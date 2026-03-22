# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-22 (Maintenance infra, doc, agents — aucune mécanique de jeu modifiée)
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 0 — POC (en cours de développement)

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (69 décisions), roadmap, references, methodology, roster POC, glossaire
- 19 agents + 7 skills Claude Code en place (`.claude/`)
- **Plan 001 terminé** : monorepo setup (pnpm workspaces, TypeScript bundler, Vite, Vitest, Biome)
- **Plan 002 terminé** :
  - 11 const object enums (TargetingKind, Direction, EffectTarget...)
  - 16 interfaces/types (1 fichier = 1 type)
  - Classe Grid avec helpers spatiaux
  - 7 targeting resolvers (single, self, cone, cross, line, dash, zone)
  - Traversée alliés/Vol/Spectre implémentée
  - Mocks centralisés (MockPokemon avec les 4 Pokemon du roster)
- **Plan 003 terminé** :
  - `TurnManager` : initiative, ordre des tours, cycle des rounds, gestion des KO
  - `BattleEngine` : `getLegalActions` (BFS pathfinding), `submitAction` (move + skip_turn), event system (on/off/emit), `getGameState`
  - `packages/data` : nouveau package avec 4 Pokemon, 16 moves complets (targeting + effects), type chart 18x18, overrides tactical/balance, deepMerge, loadData()
  - `validate.ts` : validation des données au startup (targeting, effects, ids uniques, ranges, PP...)
  - `ActionError` enum : codes d'erreur typés
  - `Accuracy`/`Evasion` ajoutés à `StatName`
  - `MockBattle` : mocks centralisés pour les tests battle
  - `vitest.config.ts` : ajout `resolve.tsconfigPaths` natif
  - 117 tests, 100% coverage maintenu
- **Plan 004 terminé** :
  - `stat-modifier.ts` : multiplicateurs de stages (-6 à +6), `getStatMultiplier`, `getEffectiveStat`, `clampStages`, `isMajorStatus`
  - `damage-calculator.ts` : formule Pokemon Gen 5+, STAB (1.5x), type effectiveness, burn penalty (-50% dégâts physiques)
  - `accuracy-check.ts` : accuracy/evasion stages, random check (100% accuracy = toujours touche)
  - `effect-processor.ts` : 4 processors — `processDamage`, `processStatus`, `processStatChange`, `processLink`
  - `BattleEngine.executeUseMove` : pipeline complet `resolveTargeting` → accuracy check → `processEffects` → émission d'events
  - `BattleEngine.getLegalActions` : retourne les `use_move` avec positions valides pour les 7 targeting patterns
  - Test d'intégration combat complet : Charmander Ember vs Bulbasaur Razor Leaf
  - 172 tests, 100% coverage maintenu
- **Plan 005 terminé** :
  - `EffectHandlerRegistry` : handler registry pour les effets (remplace switch case)
  - Pipeline de phases de tour : `StartTurn` → `Action` → `EndTurn`
  - Initiative dynamique : ordre des tours recalculé à chaque round
- **Plan 006 terminé** :
  - `statusTickHandler` : burn (1/16 HP/tour), poison (1/8 HP/tour), sleep (1-3 tours), freeze (20% dégel/tour), paralysie (25% proc bloque move+dash)
  - `linkDrainHandler` : drain Vampigraine permanent en EndTurn, rupture par KO source ou distance > maxRange
  - `handleKo` : retrait du turn order, libération de la tile, rupture des liens, idempotent
  - `checkVictory` : dernière équipe debout gagne, `BattleEnded` émis, combat verrouillé
  - `ActionError.BattleOver` ajouté
  - Handlers enregistrés dans le constructeur `BattleEngine`
  - **224 tests**, 100% coverage maintenu
  - 6 tests d'intégration battle-loop : poison tue, sleep+drain, paralysie, initiative dynamique, battleOver
- **Tests headless IA** (scripts temporaires, supprimés après validation) :
  - Combat IA Random : Player 1 gagne (Bulbasaur+Squirtle vs Charmander+Pidgey) en 58 rounds — boucle tourne, KO gérés, victoire détectée, pas de crash
  - Combat IA Smart : Player 2 gagne (Charmander+Squirtle vs Bulbasaur+Pidgey) en 67 rounds — bug heuristique détecté (PP grillés sans cible), corrigeable via `getLegalActions`
  - **Core validé de bout en bout** : la boucle de combat complète fonctionne en headless

- **Maintenance 2026-03-22** :
  - Fix infra : remplacement `vite-tsconfig-paths` par `resolve.tsconfigPaths` natif (Vite 8), dépendance supprimée
  - Terminologie : "créature" → "Pokemon" (18 occurrences, 9 fichiers), "créateur" → "l'humain" dans doc et agents
  - README réécrit pour repo public : description du jeu, disclaimers Nintendo + IA, sources et crédits, diagramme mermaid orchestration agents
  - Agents améliorés : `code-reviewer` (propose titre de commit), `doc-keeper` (checklist systématique, maintenance sources README), `dependency-manager` (détection deprecation warnings build + test)
  - Orchestration agents dans `CLAUDE.md` revue : chaînes d'agents documentées, déclencheurs plus explicites
  - Style de commit : titre seul, pas de corps

- **Plan 007 — Renderer POC** (in-progress, étapes 1-6 sur 8 terminées) :
  - Bootstrap Phaser 4 RC6 + BattleScene
  - Grille isométrique 12x12 avec conversion coords grid ↔ screen
  - Sprites placeholder : cercles colorés par type, noms, barres PV
  - Sélection + highlight tiles (bleu=déplacement, rouge=attaque)
  - Déplacement animé par clic sur tile bleue
  - Ciblage d'attaque via boutons UI colorés par type avec PP
  - Hot-seat 2 joueurs fonctionnel
  - Bouton Skip Turn, indicateur de round/tour
  - Queue d'animations séquentielles
  - Fix core : imports manquants PokemonType dans BattleEngine, TypeChart re-export dans effect-handler-registry
  - Fix bug : hover pendant animation causait l'affichage de l'UI du prochain Pokemon (séparation hover/highlight en deux layers Graphics distincts)
  - Code review : tous les bloquants corrigés (HighlightKind enum, constantes tween, readonly, isoGrid→isometricGrid, PP redondant, magic numbers)

### Prochaine étape
- **Plan 008 — Move + Act FFTA-like** (ready) : permettre Move+Act dans le même tour, EndTurn remplace SkipTurn

### Standards de code établis
- Pas d'abréviations, variables nommées comme leur type
- Const object enum pattern (`as const` + type dérivé)
- 1 fichier = 1 interface, séparation enums/types/grid/battle
- Pas de commentaires (sauf algo complexe)
- Mocks : `abstract class` + `static readonly` + données pures (pas de helpers)
- Tests : comportement uniquement, const enums (pas de string literals)
- Coverage 100% sur le core (threshold bloquant)

### Questions ouvertes (non bloquantes pour le POC)
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids) — Phase 1
- Movesets POC : Bombe-Beurk trop forte, Salamèche trop faible (feedback game-designer) — Sludge Bomb inflige 112 dégâts sur Pidgey (40 HP), ratio 2.8x à surveiller
- Countdown KO FFTA (décision #24) — prévu Phase 1, `koCountdown` déjà sur `PokemonInstance`
- Friendly fire fréquent avec IA random (pas de bug, comportement attendu mais à garder en tête pour l'équilibrage)
- PP system : une IA sans filtre de cible gaspille ses PP — `getLegalActions` peut servir de garde-fou
