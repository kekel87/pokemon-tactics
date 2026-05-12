# Pokemon Tactics — Vue d'ensemble

## Objectif
Jeu combat tactique fusion Pokemon × Final Fantasy Tactics Advance. Grille isométrique, tour par tour, AI-playable.

## Phase actuelle
**Phase 4 — Gameplay Pokemon complet**. Roster Gen 1 complet : **81 Pokemon jouables** (plan 079 terminé 2026-05-12). 143 moves, 52 abilities, 5+ mécanismes core étendus.

## Architecture
- **Monorepo pnpm workspaces**
- **Core découplé du rendu** : `packages/core/` (logique pure, zéro dep UI), `packages/data/` (Pokemon/moves/abilities), `packages/renderer/` (Phaser 4), `packages/ai-player/`
- **Spike Babylon** : `packages/renderer-babylon-spike/` (Phase 3.5 repoussée après Phase 7)

## Rôles
- **Humain** : directeur créatif, architecte, reviewer. Ne code pas. Profil Angular/TS expérimenté.
- **Claude Code** : dev principal autonome. Valide design avec humain avant d'agir sur changements structurels.

## Continuité
Humain peut revenir après 1 mois. Sources de vérité pour reprendre :
- `STATUS.md` — "on en était où ?"
- `docs/plans/` — plans numérotés (079 dernier terminé, 080 token-optimization en draft)
- `docs/next.md` — agenda persistant (`/next`)
- `docs/backlog.md` — bugs + feedback playtest

## Décision majeure récente
2026-04-20 (décision #272) : rewrite renderer Babylon (Phase 3.5) **repoussé après Phase 7 Multijoueur**. Priorité gameplay → équilibrage → social → multi.
