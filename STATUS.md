# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-20
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 0 — POC (en cours de développement)

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (52 décisions), roadmap, references, methodology, roster POC
- 19 agents + 7 skills Claude Code en place (`.claude/`)
- **Plan 001 terminé** : monorepo setup (pnpm workspaces, TypeScript bundler, Vite, Vitest, Biome)
- **Plan 002 en cours (étapes 1-6 sur 10)** :
  - 11 const object enums (TargetingKind, Direction, EffectTarget...)
  - 16 interfaces/types (1 fichier = 1 type)
  - Classe Grid avec helpers spatiaux
  - 7 targeting resolvers (single, self, cone, cross, line, dash, zone)
  - Traversée alliés/Vol/Spectre implémentée
  - Mocks centralisés (MockPokemon avec les 4 Pokemon du roster)
  - 41 tests, **100% coverage** (threshold bloquant)

### Prochaine étape
- **Plan 002 étapes 7-10** : BattleEngine minimal, données POC dans packages/data, validation au startup, export API publique

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
