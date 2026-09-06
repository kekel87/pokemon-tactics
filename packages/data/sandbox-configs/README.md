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

Voir `SandboxConfig` dans `packages/view-core/src/sandbox/` (déplacé au refactor des paquets, plans 125-126).

Le JSON peut etre partiel — les champs manquants utilisent les valeurs par defaut (merge avec `DEFAULT_SANDBOX_CONFIG`). Par exemple `{"pokemon":"charmander"}` suffit.
