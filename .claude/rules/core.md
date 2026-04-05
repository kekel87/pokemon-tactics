---
globs: packages/core/**
---

- Aucun import de Phaser, DOM, window, document, setTimeout, requestAnimationFrame
- Aucune dépendance dans package.json (dependencies doit rester vide)
- Tout export public doit etre teste unitairement
- Utiliser les mocks de `packages/core/src/testing/` pour les tests, jamais de mocks inline
- Les enums suivent le const object pattern (`as const` + type derive)
- 1 fichier = 1 interface/type
- Les effets de moves sont des handlers enregistres, pas des switch/case
