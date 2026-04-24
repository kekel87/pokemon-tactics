# Règles qualité — lint et conventions

## Règles Biome

- **Ne jamais désactiver une règle Biome sans l'accord explicite de l'humain.** Présenter les options (désactiver vs corriger) avec le raisonnement avant d'agir.
- Une règle dans le groupe `nursery` = API instable, pas mauvaise règle. Évaluer son utilité avant de l'écarter.
- Le gate CI est `biome ci packages/` — traite les warnings comme des erreurs. Zéro warning autorisé.
- Toute nouvelle règle activée ou désactivée doit être documentée dans `docs/decisions.md`.

## Conventions de nommage

- Les noms de maps, layers Tiled, et identifiants terrain : **kebab-case** (ex: `spawns-1v1`, `tall-grass`, `deep-water`).
- Les clés d'objets TypeScript qui correspondent à des identifiants externes (Tiled, terrain) doivent aussi être en kebab-case (avec guillemets : `"tall-grass"`, `"spawns-1v1"`).
- Les constantes TypeScript : `CONSTANT_CASE`.
- Les types et classes : `PascalCase`.

## Zéro tolérance aux warnings

- **Régler les warnings immédiatement** — ne pas les laisser s'accumuler.
- Si un warning est difficile à corriger : le signaler à l'humain et décider ensemble (corriger, supprimer le code, ou `biome-ignore` justifié).
- Un `// biome-ignore` sans justification métier claire est interdit.
