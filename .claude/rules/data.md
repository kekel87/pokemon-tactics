---
globs: packages/data/**
---

- Les IDs sont en kebab-case (`leech-seed`, pas `leechSeed`)
- Les noms francais et anglais sont obligatoires pour chaque Pokemon et move
- Les stats de base sont les stats officielles Pokemon (verifiables sur Bulbapedia/Showdown)
- Le roster est limite aux 151 premiers Pokemon (Gen 1) -- decision #92
- Avant de chercher des donnees Pokemon sur Showdown/Bulbapedia/PokeAPI, consulter `packages/data/reference/*.json` et `reference/indexes/` (knowledge base locale, voir `reference/README.md`)
