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
      test:scenario) echo "  fix: \`pnpm test:scenario\` localement ; alias @pokemon-tactic/* resolus via tsconfigPaths — l'include du tsconfig racine doit couvrir scenarios/";;
      e2e)      echo "  fix: \`pnpm test:e2e\` localement ; harness Playwright (DOM + scène Babylon). Pas en CI (WebGL headless instable)";;
    esac
    echo ""
    echo "CI VERDICT: fail — $name ($MODE)"
    echo "suggestion: /goal /ci-gate passes (CI VERDICT: pass), or stop after 15 turns"
    exit 1
  fi
}

# Lance le tour des écrans EN PARALLÈLE des vérifications statiques.
#
# Motif (2026-09-05) : le tour est bloqué sur un navigateur, pas sur le processeur, pendant que
# lint/typecheck/vitest saturent des cœurs. Les enchaîner additionne deux attentes qui ne se
# disputent presque rien ; les superposer rend le tour gratuit en temps de mur.
#
# La sortie du tour est mise de côté et n'est rejouée qu'en cas d'échec : sinon elle s'entrelacerait
# avec celle de tsc, et un rapport illisible ne vaut pas mieux qu'une absence de rapport.
E2E_TOUR_LOG="$(mktemp -t ci-gate-tour-XXXXXX.log)"
E2E_TOUR_PID=""

# Une étape qui échoue sort par `exit 1` depuis `step`, sans repasser par `await_screen_tour` : sans
# ce filet, le tour survivrait au gate, garderait son navigateur ouvert et son serveur Vite en
# arrière-plan. On ne tue QUE le process qu'on a lancé soi-même.
cleanup_screen_tour() {
  if [[ -n "$E2E_TOUR_PID" ]] && kill -0 "$E2E_TOUR_PID" 2>/dev/null; then
    kill "$E2E_TOUR_PID" 2>/dev/null || true
    wait "$E2E_TOUR_PID" 2>/dev/null || true
  fi
  rm -f "$E2E_TOUR_LOG"
}
trap cleanup_screen_tour EXIT

start_screen_tour() {
  npx playwright test e2e/tests/smoke >"$E2E_TOUR_LOG" 2>&1 &
  E2E_TOUR_PID=$!
  echo ""
  echo "▶ tour des écrans (en parallèle, PID $E2E_TOUR_PID)"
}

await_screen_tour() {
  [[ -n "$E2E_TOUR_PID" ]] || return 0
  echo ""
  echo "▶ tour des écrans — attente"
  if wait "$E2E_TOUR_PID"; then
    tail -n 3 "$E2E_TOUR_LOG"
    rm -f "$E2E_TOUR_LOG"
    return 0
  fi
  echo ""
  echo "✗ FAIL: tour des écrans"
  tail -n 40 "$E2E_TOUR_LOG"
  echo "  fix: \`npx playwright test e2e/tests/smoke\` — un écran ne monte plus, ou la navigation ne revient plus"
  echo ""
  echo "CI VERDICT: fail — tour des écrans ($MODE)"
  echo "suggestion: /goal /ci-gate passes (CI VERDICT: pass), or stop after 15 turns"
  rm -f "$E2E_TOUR_LOG"
  exit 1
}

case "$MODE" in
  fast)
    start_screen_tour
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "test"            pnpm test
    step "test:integration" pnpm test:integration
    await_screen_tour
    ;;
  full|"")
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "build"           pnpm build
    step "test"            pnpm test
    step "test:integration" pnpm test:integration
    step "test:scenario"   pnpm test:scenario
    step "e2e"             pnpm test:e2e:affected
    ;;
  slow)
    step "lint:fix"        pnpm lint:fix
    step "typecheck"       pnpm typecheck
    step "build"           pnpm build
    step "test:all"        pnpm test:all
    step "e2e"             pnpm test:e2e
    ;;
  *)
    echo "Usage: $0 [fast|full|slow]"
    exit 2
    ;;
esac

echo ""
echo "✓ Gate CI ($MODE) OK"
echo "CI VERDICT: pass — $MODE"
