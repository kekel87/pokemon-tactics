# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-20 (Plan 003 implémenté)
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 0 — POC (en cours de développement)

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (61 décisions), roadmap, references, methodology, roster POC, glossaire
- 19 agents + 7 skills Claude Code en place (`.claude/`)
- **Plan 001 terminé** : monorepo setup (pnpm workspaces, TypeScript bundler, Vite, Vitest, Biome)
- **Plan 002 terminé** :
  - 11 const object enums (TargetingKind, Direction, EffectTarget...)
  - 16 interfaces/types (1 fichier = 1 type)
  - Classe Grid avec helpers spatiaux
  - 7 targeting resolvers (single, self, cone, cross, line, dash, zone)
  - Traversée alliés/Vol/Spectre implémentée
  - Mocks centralisés (MockPokemon avec les 4 Pokemon du roster)
- **Plan 003 implémenté** (en attente du commit) :
  - `TurnManager` : initiative, ordre des tours, cycle des rounds, gestion des KO
  - `BattleEngine` : `getLegalActions` (BFS pathfinding), `submitAction` (move + skip_turn), event system (on/off/emit), `getGameState`
  - `packages/data` : nouveau package avec 4 Pokemon, 16 moves complets (targeting + effects), type chart 18x18, overrides tactical/balance, deepMerge, loadData()
  - `validate.ts` : validation des données au startup (targeting, effects, ids uniques, ranges, PP...)
  - `ActionError` enum : codes d'erreur typés
  - `Accuracy`/`Evasion` ajoutés à `StatName`
  - `MockBattle` : mocks centralisés pour les tests battle
  - `vitest.config.ts` : ajout `resolve.tsconfigPaths` natif
  - **117 tests**, 100% coverage maintenu

### Prochaine étape
- **Plan 004** : résolution des effets d'attaque (damage, status, stat_change, link)

### Standards de code établis
- Pas d'abréviations, variables nommées comme leur type
- Const object enum pattern (`as const` + type dérivé)
- 1 fichier = 1 interface, séparation enums/types/grid/battle
- Pas de commentaires (sauf algo complexe)
- Mocks : `abstract class` + `static readonly` + données pures (pas de helpers)
- Tests : comportement uniquement, const enums (pas de string literals)
- Coverage 100% sur le core (threshold bloquant)

### Questions ouvertes (non bloquantes pour le POC)
- Durée/stacking des effets de statut
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids)
- `linkType: string` à typer avec un enum avant Plan 003
- Movesets POC : Bombe-Beurk trop forte, Salamèche trop faible (feedback game-designer)
