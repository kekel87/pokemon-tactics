#!/usr/bin/env bash
# Gate CI local — mirror commande BLOQUANTE de CLAUDE.md.
# Fail-fast. Affiche fix suggéré sur erreur.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2

MODE="${1:-full}"

step() {
  local name="$1"
  shift
  echo ""
  echo "▶ $name"
  echo "  $ $*"
  if ! "$@"; then
    echo ""
    echo "✗ FAIL: $name"
    case "$name" in
      lint:fix) echo "  fix: lance \`pnpm lint:fix\` puis examine les erreurs restantes (Biome)";;
      build)    echo "  fix: lis l'erreur tsc/vite, souvent typecheck cascade";;
      typecheck) echo "  fix: lis l'erreur tsc, vérifie packages/*/tsconfig.json";;
      test)     echo "  fix: \`pnpm test\` localement, isole le test cassé avec --reporter=verbose";;
      test:integration) echo "  fix: \`pnpm test:integration\` localement";;
    esac
    exit 1
  fi
}

case "$MODE" in
  fast)
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "test"            pnpm test
    ;;
  full|"")
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "build"           pnpm build
    step "test"            pnpm test
    step "test:integration" pnpm test:integration
    ;;
  slow)
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "build"           pnpm build
    step "test:all"        pnpm test:all
    ;;
  *)
    echo "Usage: $0 [fast|full|slow]"
    exit 2
    ;;
esac

echo ""
echo "✓ Gate CI ($MODE) OK"
