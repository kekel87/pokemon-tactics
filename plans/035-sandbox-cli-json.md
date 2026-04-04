---
status: done
created: 2026-04-04
updated: 2026-04-04
---

# Plan 035 — Sandbox CLI : suppression query params + accès JSON

## Objectif

Supprimer tous les query params URL (sandbox, random) et remplacer par un accès CLI dev uniquement avec config JSON. Mettre à jour les outils, agents et UI associés.

## Contexte

Le mode sandbox est accessible via `?sandbox=...` dans l'URL (plan 023). Avant la publication (Phase 2), cet accès public doit être retiré. Le sandbox reste dans le code mais n'est plus accessible qu'en dev via CLI.

Ce plan débloque le plan 036 (Menu principal) qui pourra poser un flow de boot propre sans query params.

## Décisions

1. **Accès sandbox** : uniquement via `pnpm dev:sandbox` (variable d'environnement Vite `VITE_SANDBOX`).
2. **Config JSON** : fichier existant ou inline, transmis via `VITE_SANDBOX_CONFIG`.
3. **Export JSON** : le bouton "Copier URL" dans SandboxPanel devient "Exporter JSON" (copie dans le presse-papier).
4. **Agent `sandbox-url`** : renommé `sandbox-json`, génère des commandes CLI au lieu d'URLs.
5. **`SandboxConfig.ts`** : conservé (utilisé par SandboxSetup, SandboxPanel, mocks).
6. **Config par défaut** : quand `pnpm dev:sandbox` est lancé sans argument, utilise la config par défaut de `SandboxSetup.ts` (déjà existante).
7. **Script racine** : `pnpm dev:sandbox` depuis la racine du monorepo délègue à `packages/renderer`.

## Design

### Accès CLI

```bash
# Sans config (config par défaut, éditable via panels)
pnpm dev:sandbox

# Avec un fichier JSON
pnpm dev:sandbox sandbox-configs/dracaufeu-test.json

# Avec du JSON inline
pnpm dev:sandbox '{"pokemon":"charizard","moves":["flamethrower","slash"]}'
```

Le script `packages/renderer/scripts/sandbox.js` :
1. Lit `process.argv[2]` — si absent → pas de config initiale
2. Détecte si c'est un chemin fichier (existence sur disque) ou du JSON inline (commence par `{`)
3. Lance Vite avec `VITE_SANDBOX=true` et optionnellement `VITE_SANDBOX_CONFIG=<json>`

### Export JSON (remplace Copier URL)

Le bouton "Copier URL" dans SandboxPanel → "Exporter JSON" :
- Copie la config actuelle en JSON formaté dans le presse-papier
- Le JSON exporté est directement réutilisable en CLI
- Mise à jour i18n : `sandbox.copyUrl` → `sandbox.exportJson` dans `types.ts` et les deux locales

### Fichiers de config exemple

Créer `sandbox-configs/` à la racine du monorepo :
- `default.json` — config par défaut (Dracaufeu vs Dummy)
- `README.md` — format attendu et exemples

## Risques / Questions

- **Taille JSON en env var** : les configs sandbox sont petites (~500 chars max), pas de risque de dépassement shell
- **Compatibilité Windows** : les guillemets simples pour le JSON inline ne fonctionnent pas sur `cmd.exe`. Documenter l'alternative fichier JSON. PowerShell fonctionne.
- **CI** : `VITE_SANDBOX` n'est jamais défini en CI, le mode sandbox ne peut pas se déclencher accidentellement

## Étapes

### Étape 1 — Supprimer tous les query params URL

- Supprimer `parseSandboxQueryParams()` et son usage dans `BattleScene.ts` et `TeamSelectScene.ts`
- Supprimer `sandbox-query-params.ts` et `sandbox-query-params.test.ts`
- `SandboxConfig.ts` reste (utilisé par les panels sandbox)
- Nettoyer les imports
- `pnpm build && pnpm test`

### Étape 2 — Boot conditionnel via variable d'environnement

- Créer `packages/renderer/src/env.d.ts` avec les types pour `VITE_SANDBOX` et `VITE_SANDBOX_CONFIG`
- Dans `main.ts` : si `import.meta.env.VITE_SANDBOX` → démarrer sur `BattleScene` en mode sandbox (config par défaut de SandboxSetup ou parsée depuis `VITE_SANDBOX_CONFIG`)
- Si non défini : démarrer sur `TeamSelectScene` (flow existant, sera remplacé par `MainMenuScene` dans le plan 036)
- Ajouter script `"dev:sandbox": "VITE_SANDBOX=true vite"` dans `packages/renderer/package.json`
- Ajouter script `"dev:sandbox": "pnpm --filter @pokemon-tactic/renderer dev:sandbox"` dans le `package.json` racine
- `pnpm build && pnpm test`

### Étape 3 — Script CLI avec parsing JSON file/inline

- Créer `packages/renderer/scripts/sandbox.js` (Node script)
  - Lit `process.argv[2]`
  - Si absent → lance Vite avec `VITE_SANDBOX=true` uniquement
  - Si le fichier existe sur disque → lit le contenu, injecte `VITE_SANDBOX_CONFIG=<json>`
  - Si commence par `{` → utilise tel quel comme `VITE_SANDBOX_CONFIG`
  - Sinon → erreur avec message d'aide
  - Lance Vite via `child_process.execSync` ou `execa`
- Mettre à jour le script `dev:sandbox` dans `packages/renderer/package.json` : `"node scripts/sandbox.js"`
- `pnpm build && pnpm test`

### Étape 4 — Remplacement "Copier URL" par "Exporter JSON" dans SandboxPanel

- Renommer clé i18n `sandbox.copyUrl` → `sandbox.exportJson` dans `types.ts`, `en.ts`, `fr.ts`
- Modifier `SandboxPanel.ts` : le bouton copie la config actuelle en `JSON.stringify(config, null, 2)` dans le presse-papier
- Supprimer toute logique de construction d'URL dans SandboxPanel
- `pnpm build && pnpm test`

### Étape 5 — Fichiers de config exemple

- Créer `sandbox-configs/default.json`
- Créer `sandbox-configs/README.md` (format JSON attendu, exemples CLI)

### Étape 6 — Mise à jour agents et doc

- Renommer `.claude/agents/sandbox-url.md` → `.claude/agents/sandbox-json.md`
- Refactorer le prompt : génère des commandes `pnpm dev:sandbox '{...}'` au lieu d'URLs
- Mettre à jour `CLAUDE.md` table des agents (`sandbox-url` → `sandbox-json`)
- Mettre à jour la doc sandbox dans `docs/architecture.md` si mentionné
- Déclencher `agent-manager` pour auditer la cohérence

## Critères de complétion

- Aucun query param URL (`?sandbox`, `?random`) n'a d'effet
- `pnpm dev:sandbox` lance le sandbox avec config par défaut
- `pnpm dev:sandbox config.json` lance le sandbox avec la config du fichier
- `pnpm dev:sandbox '{...}'` lance le sandbox avec du JSON inline
- Le bouton dans SandboxPanel exporte du JSON valide et réutilisable en CLI
- Agent `sandbox-json` fonctionnel et documenté
- `CLAUDE.md` à jour
- Tous les tests passent, build OK
