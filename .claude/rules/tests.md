---
paths: "**/*.test.ts"
---

- Pas de commentaires dans les tests unitaires. Commentaires OK (avec parcimonie) dans les tests d'integration/scenario
- Bloc Gherkin pour les tests scenario (Given/When/Then)
- Utiliser les factories de `packages/core/src/testing/` -- jamais de mocks inline
- `buildMoveTestEngine` pour les tests de moves
- Les fichiers de test sont a cote du fichier teste (meme dossier)
- Nommage : `{fichier}.test.ts`
