---
paths: packages/data/**
---

- Les IDs sont en kebab-case (`leech-seed`, pas `leechSeed`)
- Les noms francais et anglais sont obligatoires pour chaque Pokemon et move
- **Communication humain = noms FR officiels OBLIGATOIRES** (tableaux, menus, listes). JAMAIS l'ID EN seul. ID EN entre parentheses si precision technique. Source `names.fr` dans `reference/moves.json`. Regle dure CLAUDE.md, rappelee >10x.
- Les stats de base sont les stats officielles Pokemon (verifiables sur Bulbapedia/Showdown)
- Le roster est limite aux 151 premiers Pokemon (Gen 1) -- decision #92
- Avant de chercher des donnees Pokemon sur Showdown/Bulbapedia/PokeAPI, consulter `packages/data/reference/*.json` et `reference/indexes/` (knowledge base locale, voir `reference/README.md`)
- Les valeurs dans `reference/*.json` sont **alignees Pokemon Champions** (pas Gen 9 classique). Si un test asserte `pp === X`, verifier que X est la valeur Champions (voir moves.json).
- Ne jamais editer `reference/*.json` a la main. Regenerer via `pnpm data:update` (voir `docs/process-data-update.md`).
- Les statuts Champions (paralysie 12.5%, gel 25%/3t, sommeil sample([2,3,3])) sont dans `reference/champions-status.json` -- consomme par le core (plan 057).
