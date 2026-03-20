# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-20
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 0 — POC (design terminé, aucun code)

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (41 décisions), roadmap, references, methodology, roster POC
- 4 Pokemon définis avec movesets détaillés (`docs/roster-poc.md`)
- Architecture technique validée : targeting+effects, events core→renderer, surcharges 3 couches, validation startup
- Agents et skills Claude Code en place (`.claude/`)

### Prochaine étape
- **Plan 001** : setup monorepo (pnpm workspaces, tsconfig, Vite, Vitest, Biome) + premiers modèles core

### Questions ouvertes (non bloquantes pour le POC)
- Durée/stacking des effets de statut
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids)
- Dégâts de chute influencés par le poids ?
- PP vs points d'action (à tester après premiers combats)

### Décisions clés récentes
- Attaques = composition Targeting + Effects (déclaratif)
- Core synchrone, renderer async (events)
- Surcharges en 3 couches : base → tactical → balance
- Attaques de priorité → attaques Dash
- Vampigraine = lien à distance + durée limitée
- KO = countdown style FFTA
- Pas de diagonale, pas de fog of war
