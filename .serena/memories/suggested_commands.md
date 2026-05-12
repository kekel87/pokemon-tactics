# Commandes principales

## Gate CI (BLOQUANT avant commit)
```bash
pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration
```

## Dev
```bash
pnpm dev                  # Lance renderer Phaser
pnpm dev --port 4242      # Port custom (utile pour dashboard U-A)
```

## Tests
```bash
pnpm test                 # Unitaires Vitest
pnpm test:integration     # Tests scénario
pnpm test --filter=core   # Tests du package core seulement
```

## Lint / format
```bash
pnpm lint:fix             # Biome fix auto
pnpm lint                 # Check only
pnpm typecheck            # tsc --noEmit
```

## Build
```bash
pnpm build                # Build tous packages
```

## Données Pokemon
```bash
pnpm data:update          # Régénère packages/data/reference/*.json depuis Showdown
pnpm extract-sprites      # Télécharge sprites PMDCollab (lit sprite-config.json)
```

## Replay
```bash
pnpm regenerate-golden-replay   # Régénère replay attendu (après changement mécanique)
```

## Outils Linux courants
```bash
ls / grep / find          # Standard GNU
git status / git diff / git log    # Lecture seule (humain gère versioning)
gh pr / gh issue / gh release      # GitHub CLI
```

## Hook RTK
Toutes commandes dev sont réécrites auto : `git status` → `rtk git status` (60-90% économie tokens, 0 overhead).

## Git INTERDITS (bloqués par hook PreToolUse)
- `git commit`, `git push`, `git add`
- `git reset`, `git rebase`, `git merge`, `git checkout`
- Tout install global (`npm install -g`, `npm i -g`)
