# Sandbox Configs

Fichiers de configuration pour le mode sandbox.

## Usage

```bash
# Config par defaut
pnpm dev:sandbox

# Depuis un fichier
pnpm dev:sandbox packages/data/sandbox-configs/charizard-test.json

# JSON inline
pnpm dev:sandbox '{"pokemon":"charizard","moves":["flamethrower"]}'
```

## Format

Voir `SandboxConfig` dans `packages/view-core/src/sandbox-config.ts` ; `pnpm sandbox:check <fichier ou json>` vérifie qu'une config construit le combat voulu.

Le JSON peut etre partiel — les champs manquants utilisent les valeurs par defaut (merge avec `DEFAULT_SANDBOX_CONFIG`). Par exemple `{"pokemon":"charmander"}` suffit.
