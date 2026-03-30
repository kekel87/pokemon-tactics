# Références & Projets d'inspiration — Pokemon Tactics

> Projets open source et ressources pour s'inspirer.

---

## Jeux d'inspiration directe

| Jeu | Intérêt pour le projet |
|-----|------------------------|
| **Pokemon** (toutes gens) | Base : types, stats, capacités, talents, objets |
| **Pokemon Conquest** (DS) | **LA référence directe** — Pokemon + tactical RPG sur grille. Fusion types Pokemon + gameplay tactique. Le projet veut faire "ça, mais mieux". Étudier : comment ils adaptent les attaques à la grille, le système de portée, le lien guerrier-Pokemon. |
| **Final Fantasy Tactics Advance** (GBA) | Référence principale gameplay : grille, initiative, AoE, KO countdown, dénivelés. L'humain a joué à FFTA (pas à FFT original ni au remaster). Référence de second ordre pour l'UI. |
| **Final Fantasy Tactics: The Ivalice Chronicles** (PC/PS5, 2024) | Remaster de FFT avec timeline CT permanente côté gauche, UI modernisée et lisible. Référence directe pour la timeline d'ordre des tours (plan 009) et le panel d'info Pokemon. L'humain n'y a pas joué — référence visuelle uniquement (captures/vidéos). |
| **Fire Emblem** (à partir de Advance / GBA) | Déplacements 4 directions, positionnement tactique, blocage |
| **Advance Wars** (GBA/DS) | Tactique grille, simplicité du gameplay, lisibilité |
| **Dofus** (PC) | Tactical RPG MMO sur grille, AoE, portées, points d'action — référence secondaire |
| **Triangle Strategy** (Switch) | **Référence visuelle principale** pour le style HD-2D (sprites 2D + terrain 3D + éclairage). À étudier en priorité pour le rendu. |
| **Le Donjon de Naheulbeuk : L'Amulette du Désordre** (PC) | Tactical RPG avec humour, positionnement, AoE, friendly fire |
| **Pokemon Mystery Dungeon** (série DS/3DS/Switch) | Roguelike tactique Pokemon. Intérêt : système de Travel Speed (vitesse = fréquence d'action, de x0.5 à x4), PP conservés avec attaque de base gratuite, exploration de donjons avec 400+ Pokemon. Rescue Team DX (Switch) est le remake le plus accessible. |

---

## Projets open source clés à étudier

### 1. Pokemon Showdown (sim/) — Architecture moteur de combat
- **URL :** https://github.com/smogon/pokemon-showdown
- **Stars :** ~5 500 | **Tech :** TypeScript, Node.js
- **Pourquoi c'est important :**
  Le `sim/` est un **package npm installable** (`npm install pokemon-showdown`) qui tourne sans UI.
  C'est le gold standard du moteur de combat Pokemon découplé.
  - API par stream de texte : on envoie `>p1 move 1`, ça émet des updates
  - PRNG déterministe (`prng.ts`) pour replays et tests — exactement ce qu'on veut
  - Type chart, formule de dégâts, toutes les données Pokemon en TypeScript
  - Mods par génération (`data/mods/`) pour varier les règles
- **À étudier :** `sim/battle.ts`, `sim/prng.ts`, `data/typechart.ts`, `data/moves.ts`, structure du `sim/`

### 2. PokeRogue — Stack Phaser + TS + Vitest
- **URL :** https://github.com/pagefaultgames/pokerogue
- **Stars :** ~5 600 | **Tech :** TypeScript, Phaser 3, Vite, Vitest, Biome, pnpm
- **Pourquoi c'est important :**
  Même stack que nous. Référence directe pour :
  - **Architecture "Phase"** : chaque action de jeu (commande, animation, capture...) est une classe Phase. Un PhaseManager orchestre la séquence. Pattern puissant pour le tour par tour.
  - **Données Pokemon** : espèces, formes, moves, abilities sous `src/data/` avec typage TS riche
  - **Tests** : Vitest avec coverage extensive, mocks Phaser canvas, structure miroir de `src/`
  - **Assets séparés** : sprites/audio dans un repo à part (submodule git)
  - **Biome** comme linter/formatter (alternative à ESLint+Prettier)
- **À étudier :** `src/phases/`, `src/data/`, `test/`, `src/battle.ts`

### 3. Grid Engine — Librairie grille isométrique
- **URL :** https://github.com/Annoraaq/grid-engine
- **Stars :** ~270 | **Tech :** TypeScript
- **Pourquoi c'est important :**
  Librairie mature de déplacement sur grille avec support **isométrique ET orthogonal**.
  Fonctionne **standalone** (sans Phaser) ou avec Phaser 3. Pathfinding A*, collisions, multi-tile.
  Apache 2.0. 117 releases. Plugin Chrome DevTools.
- **Potentiel :** Utilisable directement comme couche grille/mouvement, ou à étudier pour l'architecture.

### 4. ts-online-game-template — Monorepo Phaser + pnpm
- **URL :** https://github.com/ASteinheiser/ts-online-game-template
- **Stars :** ~30 | **Tech :** TypeScript, Phaser, React, pnpm, Turborepo
- **Pourquoi c'est important :**
  Le seul exemple trouvé de **monorepo Phaser + pnpm workspaces** avec un package `core-game` partagé.
  Structure : `apps/` (jeu, API, web) + `packages/` (core-game, ui, configs).
- **À étudier :** structure monorepo, comment le `core-game` est partagé entre client et serveur.

---

## Projets secondaires

### Tactical RPGs web

| Projet | Stars | Tech | Intérêt |
|--------|-------|------|---------|
| [MedievalWar](https://github.com/tranchikhang/MedievalWar) | 39 | JS, Phaser 3 | Jeu tactique Fire Emblem-like en Phaser. Pathfinding, mouvement grille, IA. |
| [phaser-tbs](https://github.com/mattbgold/phaser-tbs) | 12 | TS, Phaser | Tactique tour par tour. Architecture models/services/controllers. DI avec Inversify. |
| [tactical-rpg](https://github.com/sviridoff/tactical-rpg) | 28 | TS, React | Clone Fire Emblem Heroes web. TypeScript, démo jouable. |
| [TinyWarsClient](https://github.com/Babygogogo/TinyWarsClient) | 40 | TS | Clone Advance Wars navigateur. Multi joueur. |
| [TicTac (Three.js)](https://github.com/chongdashu/threejs-tactics-game) | ~10 | TS, Three.js, Vite | FFT-like avec menus contextuels, élévation terrain, IA. Référence Three.js pour phase HD-2D future. |

### Isométrique Phaser

| Projet | Stars | Tech | Intérêt |
|--------|-------|------|---------|
| [phaser3-plugin-isometric](https://github.com/sebashwa/phaser3-plugin-isometric) | 174 | JS, Phaser 3 | Plugin isométrique mature avec angles de projection ajustables. |
| [phaser-isometric-engine](https://github.com/FelipeIzolan/phaser-isometric-engine) | 6 | TS, Phaser 3, Vite | Moteur iso léger. Grille 3D (x,y,z), conversion coordonnées, tri profondeur. |

### Autres

| Projet | Stars | Tech | Intérêt |
|--------|-------|------|---------|
| [PokemonTacticalRolePlay](https://github.com/SinlessDevil/PokemonTacticalRolePlay) | 19 | C#, Unity | Quelqu'un a tenté la même fusion Pokemon + Tactique ! Auto-battler avec Utility AI. |
| [godot-tactical-rpg](https://github.com/ramaureirac/godot-tactical-rpg) | 884 | GDScript | Le plus populaire tactical RPG open source. Patterns de game design transférables. |

---

## Patterns architecturaux à retenir

### De Pokemon Showdown :
- **Moteur = package npm indépendant** — importable, testable, sans UI
- **PRNG déterministe** — seed fixe = résultat reproductible = replays + tests fiables
- **Stream-based API** — le moteur reçoit des commandes texte, émet des events

### De PokeRogue :
- **Phase pattern** — chaque étape du jeu est une Phase (classe) avec `start()` et `end()`. Le PhaseManager les enchaîne. Parfait pour le tour par tour.
- **Données typées** — les Pokemon, moves, abilities sont des objets TypeScript riches, pas juste du JSON brut
- **Biome** — alternative tout-en-un à ESLint + Prettier (plus rapide, moins de config)

### De Grid Engine :
- **Standalone first** — la grille fonctionne sans renderer. On branche Phaser par-dessus.
- **Pathfinding intégré** — A* avec support obstacles, multi-tile, isométrique

### Du monorepo template :
- **Package `core-game` partagé** — même logique côté client et serveur (ou IA headless)

---

## Traductions Pokemon

- [pokemon-showdown-fr](https://github.com/Sykless/pokemon-showdown-fr) — Traductions françaises des noms de Pokemon, moves, abilities, statuts. Source prévue pour le système i18n (Phase 2).

---

## Ressources documentation

- [Phaser 3 API docs](https://docs.phaser.io/)
- [Phaser 3 examples](https://phaser.io/examples)
- [Formule de dégâts Pokemon](https://bulbapedia.bulbagarden.net/wiki/Damage)
- [Tableau des types Pokemon](https://bulbapedia.bulbagarden.net/wiki/Type/Type_chart)
- [FFT Mechanics (CT system)](https://finalfantasy.fandom.com/wiki/Battle_system_(Tactics))
- [Grid Engine docs](https://annoraaq.github.io/grid-engine/)
- [Babylon.js docs](https://doc.babylonjs.com/) — Moteur 3D TypeScript-first, candidat pour le renderer HD-2D
- [Babylon.js Playground](https://playground.babylonjs.com/) — Exemples interactifs
- [Babylon.js post-processing (DoF, bloom)](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/usePostProcesses)
- [Awesome Claude Code Subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — Collection d'agents spécialisés

### Sprites

- [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab) — Sprites PMD avec animations riches (Walk, Idle, Attack, Hurt, 8 directions). Notre source de sprites. Viewer : [sprites.pmdcollab.org](https://sprites.pmdcollab.org/)
- [PokeSprite](https://github.com/msikma/pokesprite) — Box/menu sprites (icônes PC). Utile pour l'UI, pas pour la map.
- [PokeAPI/sprites](https://github.com/PokeAPI/sprites) — Sprites de combat, artwork officiel. Utile pour un Pokédex.
- [Pokepedia](https://www.pokepedia.fr/) — Type icons Légendes Pokémon Z-A, 36x36px sans texte (18 types). Utilisés dans l'UI du sous-menu attaque. Également : status icons ZA — icônes 52x36px et miniatures 172x36px pour les 7 statuts majeurs (brûlure, gel, paralysie, poison, poison grave, sommeil, K.O.). Utilisés dans TurnTimeline, sprites grille et InfoPanel.
- [Bulbagarden Archives](https://archives.bulbagarden.net/) — Category icons Sword & Shield (Physical/Special/Status). Utilisés dans le MoveTooltip.
- [Spriters Resource HGSS](https://www.spriters-resource.com/ds_dsi/pokemonheartgoldsoulsilver/) — Overworld HGSS 32x32 (écarté : pas d'animation d'attaque).
- [TexturePacker](https://www.codeandweb.com/texturepacker) — Outil pour générer des atlas Phaser (JSON + PNG). Alternative gratuite : [free-tex-packer.com](https://free-tex-packer.com/app/)
