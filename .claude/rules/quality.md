# Règles qualité — lint et conventions

## Règles Biome

- **Jamais désactiver règle Biome sans accord humain.** Présenter options (désactiver vs corriger) avant d'agir.
- Règle `nursery` = API instable, pas mauvaise. Évaluer utilité avant d'écarter.
- Gate CI: `biome ci packages/` — warnings = erreurs. Zéro warning autorisé.
- Toute règle activée/désactivée → documenter dans `docs/decisions.md`.

## Conventions de nommage

- Maps, layers Tiled, identifiants terrain : **kebab-case** (ex: `spawns-1v1`, `tall-grass`, `deep-water`).
- Clés TypeScript correspondant à identifiants externes (Tiled, terrain) : kebab-case (guillemets : `"tall-grass"`, `"spawns-1v1"`).
- Constantes TypeScript : `CONSTANT_CASE`.
- Types et classes : `PascalCase`.

## Zéro tolérance aux warnings

- **Régler warnings immédiatement** — pas d'accumulation.
- Warning difficile à corriger : signaler à l'humain, décider ensemble (corriger, supprimer, ou `biome-ignore` justifié).
- `// biome-ignore` sans justification métier claire interdit.
