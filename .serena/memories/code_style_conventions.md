# Conventions code

## Langues
- **Code** : anglais (variables, fonctions, types, commentaires)
- **Doc** : français
- **Messages joueur** : noms FR Pokemon/moves/talents (ex : Arbok, Crocs Venin, Pose Spore). IDs en anglais dans le code.

## TypeScript
- `strict: true`, pas de `any` implicite, pas de `as` abusif
- 1 fichier = 1 interface/type
- Enums via **const object pattern** : `as const` + type derivé
- ESM modules

## Nommage
- **Pas d'abréviations** : `traversalContext` pas `ctx`, `pokemonInstance` pas `pkmn`
- Maps Tiled, layers, terrain : `kebab-case` (`spawns-1v1`, `tall-grass`)
- Constantes TypeScript : `CONSTANT_CASE`
- Types et classes : `PascalCase`

## Core (`packages/core/`) — règles strictes
- Aucun import Phaser, DOM, window, document, setTimeout, requestAnimationFrame
- Aucune dépendance dans package.json (dependencies doit rester vide)
- Tout export public testé unitairement
- Mocks via `packages/core/src/testing/` (jamais inline)
- Effets de moves = handlers enregistrés, jamais switch/case

## Renderer (`packages/renderer/`)
- Couleurs et depths dans `constants.ts` (pas de hex inline)
- Depths préfixées `DEPTH_`
- Import core via `@pokemon-tactic/core` (pas chemin relatif)
- Documenter nouvelles constantes visuelles dans `docs/design-system.md`

## Tests (`*.test.ts`)
- Tests unitaires : pas de commentaires
- Tests scénario/intégration : bloc Gherkin (Given/When/Then), commentaires OK
- Factories de `packages/core/src/testing/` (jamais mocks inline)
- `buildMoveTestEngine` pour tests moves
- Fichiers test à côté du fichier testé : `{fichier}.test.ts`

## Edit > Write
- Préférer Edit à Write
- Gros fichiers : petits Edit successifs, pas Write massif
- Code mort : **zéro tolérance** (fonctions/branches/imports inutilisés interdits)

## Biome
- **Jamais désactiver règle Biome sans accord humain explicite**
- `// biome-ignore` sans justification métier interdit
- Zéro warning autorisé (gate CI fail sur warnings)

## Commits
- Conventional commits : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **Titre seul, jamais corps** — humain colle que la première ligne
- Contexte/pourquoi → `STATUS.md` ou plan en cours
