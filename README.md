# Pokemon Tactics

Un jeu de combat tactique sur grille isométrique fusionnant **Pokemon** et **Final Fantasy Tactics**, en style **HD-2D**.

## Concept

- Combats tactiques sur grille avec dénivelés, AoE, terrains interactifs
- Système Pokemon : 4 attaques, 1 talent, 1 objet tenu, stats officielles
- Jusqu'à 12 créatures / 12 joueurs (hot-seat, équipes ou free-for-all)
- Jouable en navigateur, par des humains ou des IA

## Stack technique

| | |
|---|---|
| Langage | TypeScript (strict) |
| Moteur de jeu | Core pur TypeScript (zero dépendance UI) |
| Rendu | Phaser 4 (2D isométrique) → Three.js plus tard (HD-2D) |
| Tests | Vitest (core) + Playwright (rendu) |
| Bundler | Vite |
| Linter/Formatter | Biome |
| Monorepo | pnpm workspaces |

## Structure

```
packages/
  core/        → Moteur de jeu pur (logique, calculs, grille)
  renderer/    → Interface graphique (Phaser)
  ai-player/   → Joueurs IA (classique, LLM, MCP)
  data/        → Données Pokemon (JSON)
docs/          → Documentation du projet
plans/         → Plans d'exécution numérotés
```

## Documentation

- [Game Design](docs/game-design.md) — Vision, règles de combat, mécaniques
- [Architecture](docs/architecture.md) — Architecture technique, stack, principes
- [Décisions](docs/decisions.md) — Log des décisions prises et questions ouvertes
- [Roadmap](docs/roadmap.md) — Phases de développement, POC → polish
- [Méthodologie](docs/methodology.md) — Comment on travaille (humain + Claude Code)
- [Références](docs/references.md) — Projets open source d'inspiration

## Développement

```bash
pnpm install
pnpm dev          # Lance le jeu en dev (Vite)
pnpm test         # Lance les tests (Vitest)
pnpm test:e2e     # Tests visuels (Playwright)
```

---

*Projet personnel — en développement*
