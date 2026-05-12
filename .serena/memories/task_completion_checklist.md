# Checklist fin de tâche

## Gate CI (BLOQUANT — toujours avant commit)

```bash
pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration
```

**Tout doit passer**. Zéro warning Biome autorisé.

## Chaînes d'agents par contexte

### Fin de plan
1. `core-guardian` (si core touché) — vérifie 0 dep UI
2. `code-reviewer` — review qualité
3. `doc-keeper` — met à jour STATUS.md, decisions.md, implementations.md, README.md
4. Proposer `visual-tester` (si renderer touché) — test Playwright
5. Gate CI
6. `commit-message` — propose conventional commit

### Hors plan (changement significatif)
1. `code-reviewer` (si significatif)
2. `doc-keeper` (si doc impactée)
3. Gate CI
4. `commit-message`

### Fin de session
1. `session-closer` — met à jour STATUS.md + backlog (croise git log + backlog.md, marque bugs résolus)
2. Gate CI
3. `commit-message`

## Après batch Pokemon (checklist visuelle 6 points)
1. Moves visibles dans sandbox
2. Limite 4 moves respectée par Pokemon
3. Noms FR corrects en UI
4. Ordre Pokédex respecté dans roster
5. Icônes statut affichées correctement
6. Textes flottants abilities émis (Blaze/Torrent/Overgrow, AbilityActivated jaune doré)

## Sprites (obligatoire après chaque batch Pokemon)
```bash
# Update sprite-config.json puis :
pnpm extract-sprites
```

## Reporté / différé → `docs/next.md`
Section "Reporté / à refaire". Maintenue par Claude. Humain lit via `/next`.
