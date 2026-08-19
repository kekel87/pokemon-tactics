---
paths: packages/core/**
---

- Aucun import de Phaser, DOM, window, document, setTimeout, requestAnimationFrame
- Aucune dépendance dans package.json (dependencies doit rester vide)
- Tout export public doit etre teste unitairement
- Utiliser les mocks de `packages/core/src/testing/` pour les tests, jamais de mocks inline
- `BattleEngine` retombe sur `Math.random()` réel si aucun `random` n'est fourni (seam de test délibéré). Tout test qui affirme un résultat dépendant d'un jet (coup réussi, critique, dégâts) doit épingler l'aléa (`vi.spyOn(Math, "random").mockReturnValue(...)` + `afterEach(() => vi.restoreAllMocks())`) ou passer un `random` seedé (`createPrng`) au harnais — jamais laisser retomber sur le vrai `Math.random()` en affirmant un résultat précis (flaky ~2-5% par run, voir décisions #759-#760)
- Les enums suivent le const object pattern (`as const` + type derive)
- 1 fichier = 1 interface/type
- Les effets de moves sont des handlers enregistres, pas des switch/case
