# Décisions & Questions ouvertes — Pokemon Tactics

> Log des décisions prises et questions à trancher.
> Pour le game design, voir [game-design.md](game-design.md).
> Pour l'architecture, voir [architecture.md](architecture.md).

---

## Décisions prises

| # | Date | Question | Décision | Contexte |
|---|------|----------|----------|----------|
| 1 | 2026-03-19 | Système de tour | **Initiative individuelle** (FFT-like) | Basée sur Vitesse/Poids. Plus tactique que le tour par équipe. |
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
| 16 | 2026-03-19 | Roster POC | **Bulbizarre, Salamèche, Carapuce, Roucoul** | 4 Pokemon simples, 4 types (Plante, Feu, Eau, Normal/Vol). Suffisant pour valider les mécaniques. |
| 17 | 2026-03-19 | Caméra | **Fixe + zoom (non contrôlable par l'user)** | Rotation 4 angles (style FFT) en phase ultérieure. |
| 18 | 2026-03-19 | Taille de grille POC | **12x12** | Taille variable par map à terme. 12x12 = bon compromis pour jusqu'à 12 créatures. |
| 19 | 2026-03-19 | Monorepo | **pnpm workspaces seul** | Pas de Nx pour l'instant. On ajoutera si le besoin se présente (partie serveur multi ?). |
| 20 | 2026-03-19 | Sprites | **PMDCollab/SpriteCollab** | 8 directions, animations riches (Walk, Idle, Attack, Hurt...), ~48x48+, Gen 1-9. Pipeline : AnimData.xml → Phaser atlas JSON. Placeholders pour le POC, vrais sprites en Phase 1. |

---

## Questions ouvertes

| # | Question | Notes | Priorité |
|---|----------|-------|----------|
| 1 | Formules dérivées | Vitesse/Poids → Mouvement/Saut/Initiative. Attention : Hâte (+2 Vit) ne doit pas être OP si Initiative = Vitesse. | Phase 1 |
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
