---
paths: packages/renderer/**
---

- Toutes les couleurs doivent etre dans `constants.ts` -- pas de hex inline dans les composants
- Toutes les profondeurs (depth) doivent etre dans `constants.ts` avec le prefixe DEPTH_
- Les nouvelles constantes visuelles doivent etre documentees dans `docs/design-system.md`
- Le renderer importe le core via `@pokemon-tactic/core` -- jamais de chemin relatif vers packages/core
- Lire `docs/design-system.md` avant d'ajouter des couleurs ou modifier l'UI
