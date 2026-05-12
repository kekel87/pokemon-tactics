# Plan 079 — Token Optimization Setup

**Statut** : Draft
**Créé** : 2026-05-12
**Objectif** : Réduire consommation tokens par tour (~5k économisés) sans perdre capacité.

---

## Contexte

Setup actuel : Serena MCP, U-A MCP, RTK, Caveman skill installés. CLAUDE.md projet 130 lignes + 5 rules files + MEMORY.md 28 entrées + hook caveman réinjecté chaque tour = ~17k tokens préambule.

Sources recherche :
- [tipsforclaude](https://tipsforclaude.com/tips/rules-directory-conditional/) — rules conditional loading via `paths:` frontmatter
- [claudefa.st](https://claudefa.st/blog/guide/mechanics/rules-directory) — sans frontmatter, chargé toujours
- [Serena docs](https://oraios.github.io/serena/02-usage/050_configuration.html) — onboarding obligatoire
- [MindStudio MCP overhead](https://www.mindstudio.ai/blog/claude-code-mcp-server-token-overhead) — schemas deferred par défaut OK
- [Caveman GitHub](https://github.com/JuliusBrussee/caveman) — flag file, pas réinjection par tour
- [bridgers.agency](https://bridgers.agency/en/blog/claude-mem-review-architecture-alternatives) — Memory MCP rentable >50 entrées seulement

---

## Diagnostic

| Source bloat | Coût/tour | Cause |
|--------------|-----------|-------|
| `.claude/rules/*.md` tous chargés | ~2.2k | Pas de frontmatter `paths:` |
| Hook caveman réinjecté | ~800 | UserPromptSubmit verbeux |
| CLAUDE.md projet | ~2.5k | 130 lignes verboses |
| MEMORY.md 28 entries | ~1.2k | Descriptions longues |
| RTK.md global | ~600 | 29 lignes pour 1 cmd |
| U-A "stale" hook | ~500 | SessionStart force lecture |
| Skills list (~30) | ~2.5k | Skills jamais utilisés inclus |
| Agents schema (30 agents) | ~3-5k | Descriptions agents projet dans tool Agent |

**Total préambule** : **~17-20k tokens**. **Cible** : ~10-12k.

---

## Phase 1 — Quick wins (gratuit, sans risque)

### 1.1 Frontmatter conditionnel sur rules

Ajouter en tête de chaque rule sauf `quality.md` (transversal) :

```yaml
---
paths: "packages/core/**/*.ts"
---
```

- `core.md` → `packages/core/**/*.ts`
- `data.md` → `packages/data/**`
- `renderer.md` → `packages/renderer/**`
- `renderer-babylon.md` → `packages/renderer-babylon-spike/**`
- `tests.md` → `**/*.test.ts`
- `quality.md` → sans frontmatter

**Gain** : -1.5k tokens quand tour porte sur 1 seul package.

### 1.2 Compresser CLAUDE.md projet

Via skill `/caveman:compress docs/CLAUDE.md`. Backup auto `.original.md`.

**Gain** : ~-1k tokens/tour.

### 1.3 Compresser RTK.md global

Réduire à 5 lignes : commandes meta + ref.

**Gain** : -400 tokens/tour.

### 1.4 Compresser MEMORY.md entries

Descriptions → 1 ligne stricte. Fusionner doublons.

**Gain** : -400 tokens/tour.

---

## Phase 2 — Hook tuning

### 2.1 Raccourcir caveman UserPromptSubmit hook

Actuel : 800 tokens de rappel.
Cible : `CAVEMAN ACTIVE (full)` une ligne.

Modif via `update-config` skill ou édition `~/.claude/settings.json`.

**Gain** : -700 tokens/tour.

### 2.2 Désactiver U-A SessionStart hook

Si auto-update fonctionne via post-commit (à vérifier), pas besoin de SessionStart prompt.

**Gain** : -500 tokens/session.

### 2.3 Audit skills installés

Désinstaller : `fewer-permission-prompts`, `keybindings-help`, `claude-api`, `simplify`, `loop` (si pas utilisé), `schedule` (si pas utilisé), `init`.

**Gain** : -1k tokens/tour.

### 2.4 Audit agents projet (30 actuellement)

Coût caché : descriptions agents listées dans schema du tool `Agent` → **~3-5k tokens préambule**.

#### Doublons à dédupliquer

Garder version `-knowledge` (utilise U-A graph) OU base, jamais les deux :
- `data-miner` vs `data-miner-knowledge`
- `debugger` vs `debugger-knowledge`
- `move-pattern-designer` vs `move-pattern-designer-knowledge`
- `visual-tester` vs `visual-tester-knowledge`

**Décision pendante humain** : version `-knowledge` partout si U-A graph à jour.

#### Candidats suppression selon usage récent

Auditer fréquence appel via `git log --all --grep "subagent"` ou souvenir humain :

| Agent | Usage typique | Garder si... |
|-------|---------------|--------------|
| `feedback-triager` | Issues GitHub | Issues actives |
| `wiki-keeper` | Wiki public | Wiki maintenu |
| `publisher` | Release GitHub | Releases régulières |
| `release-drafter` | Changelog | Idem |
| `ci-setup` | Setup pipeline | Modifs CI à venir |
| `dependency-manager` | Audit deps | Audit régulier |
| `visual-analyst` | `/inspire` | Recherche visuelle active |
| `balancer` | N combats headless | Phase 5 (équilibrage) |
| `performance-profiler` | Perf | Avant release |
| `core-guardian` | Vérif core découplé | Modifs core fréquentes |
| `level-designer` | Cartes Tiled | Nouvelles maps |

Candidats virage immédiat (si pas utilisé Phase 4 actuelle) : `feedback-triager`, `wiki-keeper`, `publisher`, `release-drafter`, `ci-setup`, `balancer`, `level-designer`, `visual-analyst`.

**Gain** : -8 agents × ~150 tokens = **~1.2k tokens préambule**.

#### Garder absolument

`code-reviewer`, `doc-keeper`, `test-writer`, `commit-message`, `session-closer`, `plan-reviewer`, `game-designer`, `data-miner` (ou knowledge), `debugger` (ou knowledge), `move-pattern-designer` (ou knowledge), `visual-tester` (ou knowledge), `asset-manager`, `best-practices`, `ai-player`, `sandbox-json`.

= ~15 agents core. **Gain total Phase 2.4** : 30 → 15 agents = **~2.2k tokens**.

---

## Phase 3 — Setup Serena complet

### 3.1 Onboarding

Lancer `mcp__serena__onboarding` une fois. Génère `.serena/memories/` :
- Architecture overview
- Conventions
- Points d'entrée
- Stack technique

**Coût upfront** : ~5k tokens.
**Payback** : symbol lookup direct (LSP) > Read fichier entier. Économies par tour quand exploration code.

### 3.2 Règle Serena obligatoire

Ajouter dans `core.md` (déjà conditionné `paths:`) :

```markdown
## Exploration code TS

Avant Read/Grep/Edit fichier `.ts` >100 lignes :
1. `mcp__serena__find_symbol` localisation
2. `mcp__serena__get_symbols_overview` vue fichier
3. `mcp__serena__find_referencing_symbols` cross-refs
```

---

## Phase 4 — Audit MCP servers

Lancer `claude mcp list`. Désactiver serveurs non utilisés depuis 2 semaines.

Candidats désactivation selon phase projet :
- `chrome-devtools` si pas debug perf
- `pixellab` si pas génération asset
- `playwright` si pas test visuel
- `babylon-mcp` si pas renderer Babylon

Garder toujours : `serena`, `understand-anything`, `context7`, `github`.

**Gain** : Selon serveurs virés, ~500-1000 tokens/tour.

---

## Ce qu'on ne fait PAS

- ❌ **Migration vers Memory MCP** (claude-mem) : non rentable à 28 entrées (~3.5k overhead vs 1.2k MEMORY.md actuel). Rentable >50-100 entrées.
- ❌ **Compression aggressive `.claude/rules/`** : déjà compactes, gain marginal après frontmatter.

---

## Ordre d'exécution proposé

1. **Phase 1.1** (frontmatter rules) — 2 min, 0 risque
2. **Phase 2.1** (raccourcir caveman hook) — 5 min, 0 risque
3. **Phase 1.2** (compresser CLAUDE.md) — 5 min, backup auto
4. **Phase 1.4** (compresser MEMORY.md) — 10 min
5. **Phase 1.3** (compresser RTK.md) — 2 min
6. **Phase 3** (Serena onboarding) — interactif, à toi de lancer
7. **Phase 2.3** (audit skills) — toi
8. **Phase 4** (audit MCP) — toi
9. **Phase 2.2** (U-A SessionStart) — si vérification confirme inutile

---

## Phase 5 — Test & validation

### 5.1 Baseline avant changements

Mesurer état initial :

```bash
# Compter tokens préambule actuel
claude --debug 2>&1 | grep -i "context\|tokens" | head -20

# Ou via /cost dans session Claude Code
# Note : /cost affiche tokens cumulés session, pas par tour
```

Capturer dans `docs/plans/079-baseline.md` :
- Tokens préambule initial (`/cost` au tour 1)
- Tokens après 5 tours simple (avg/tour)
- Tokens après 1 commit Pokemon batch (test U-A hook)

### 5.2 Tests post-changement (par phase)

Après **chaque phase**, lancer scénarios identiques et comparer :

#### Scénario A — Tour simple (lecture code)
1. Démarrer session fraîche
2. Demander : "Lis `packages/core/src/move/handlers/damage.ts` et résume"
3. Mesurer tokens préambule + tokens tour
4. Attendu Phase 1.1 : rules `core.md` chargé seulement (pas renderer-babylon etc.)

#### Scénario B — Tour cross-package
1. Session fraîche
2. Demander : "Quelle est la chaîne renderer ↔ core pour afficher dégâts ?"
3. Vérifier que rules `core.md` + `renderer.md` se chargent ensemble
4. Vérifier comportement frontmatter `paths:` cumul

#### Scénario C — Hook U-A déclenché
1. Faire un commit fictif modifiant 1 fichier `.ts` (toi)
2. Démarrer session fraîche
3. Compter tokens injectés par SessionStart hook
4. Si je lance auto-update → mesurer coût agents

#### Scénario D — Serena vs Read
1. Tour 1 : "Trouve toutes les références à `BattleEngine`" via Read/Grep
2. Tour 2 (session fraîche) : même question, forcer Serena `find_referencing_symbols`
3. Comparer tokens consommés

### 5.3 Régression fonctionnelle

Vérifier que les changements ne cassent pas les workflows :

- [ ] `/next` fonctionne (lit docs/next.md + STATUS)
- [ ] `/review-local` fonctionne
- [ ] Caveman reste actif après plusieurs tours
- [ ] Rules conditionnelles se chargent au bon moment (test Scénario A/B)
- [ ] Serena `find_symbol` retourne résultats (post-onboarding)
- [ ] U-A graph requêtable via `/understand-chat`
- [ ] RTK hook réécrit toujours commandes (`git status` → `rtk git status`)

### 5.4 Rapport final

Document `docs/plans/079-results.md` avec :

| Métrique | Avant | Après | Δ |
|----------|-------|-------|---|
| Préambule tokens | ~17k | ? | ? |
| Tour simple moyen | ? | ? | ? |
| Tour cross-package | ? | ? | ? |
| Coût hook U-A (stale) | ~150 | ? | ? |
| Coût hook U-A (commit batch) | 1-10k | ? | ? |
| Serena onboarding (one-shot) | N/A | ~5k | upfront |

Si gain < 20% sur tour simple → analyser pourquoi, ajuster.

---

## Mesure d'impact

Avant/après : compter tokens préambule via `/cost` ou inspecter `claude --debug`.

Cible : ~12k tokens préambule (vs 17k actuel) = **-30%**.
