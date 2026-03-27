# Desinstallation Mistral Vibe

## 1. Vibe CLI

```bash
pip uninstall mistral-vibe
# ou si installe via pipx :
pipx uninstall mistral-vibe
```

## 2. Config globale

```bash
rm -rf ~/.vibe/
```

## 3. Fichiers dans le projet

```bash
rm -rf .vibe/
```

## 4. Variables d'environnement

Retirer de `~/.config/fish/config.fish` :

```fish
# Lignes a supprimer :
set -gx MISTRAL_API_KEY "..."
set -gx CONTEXT7_API_KEY "..."
set -gx PIXELLAB_SECRET "..."
```
