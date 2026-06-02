# Plan 107 — Content Batch G6 (11 moves « simples ratés » des batches G)

> Statut : **done**
> Créé : 2026-06-02
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer` (2026-06-02).

## Objectif

Livrer le **Content Batch G6** — les 11 derniers moves « simples » du roster Gen 1 dont la mécanique est **déjà supportée** (recharge, charge 2 tours, multi-hit, flinch, debuff stat, no-op) mais qui avaient échappé aux batches G1–G5. Clôt la couverture des moves simples du roster pour le Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent, auto-généré depuis reference). Données canon auto-mergées depuis reference. Pas de sprite, OP sets non touchés. **Aucune mécanique nouvelle.**

## Encodages réutilisés (tous existants)

- **recharge** : `recharge: true` (modèle Ultralaser/`hyper-beam`).
- **charge 2 tours** : `twoTurnCharge: true` (+ `sunSkipsCharge: true` pour les moves Plante solaires, modèle Lance-Soleil/`solar-beam`).
- **chargeEffects** : effet self au tour de charge (modèle Crâne Armure/`skull-bash` Déf +1).
- **multi-hit** : `hits: 2` (modèle Double-Pied/`double-kick`).
- **flinch secondaire** : `{ kind: Status, status: Flinch, chance: 30 }` (plan 094).
- **debuff ennemi** : `{ kind: StatChange, stat, stages: -1, target: Targets }` (modèle Gros'Yeux/`leer`).
- **never-miss** : `bypassAccuracy: true` (reference `accuracy: null` = touche garantie).
- **no-op** : `effects: []` (modèle Téléport/`teleport`).
- Flags fournis par la reference — **non redéclarés** (un override `flags` écrase la reference, cf. backlog aerial-ace).

## Scope final — 11 moves

### Dégâts (9) — shapes via `move-pattern-designer`
| move (FR) | id | type | cat | BP | shape | spécial |
|-----------|----|------|-----|----|-------|---------|
| Force | strength | Normal | phys | 80 | `Single 1-1` | — |
| Écrasement | stomp | Normal | phys | 65 | `Single 1-1` | Flinch 30% |
| Double Baffe | dual-chop | Dragon | phys | 40 | `Single 1-1` | `hits: 2` |
| Rafale Feu | blast-burn | Feu | spé | 150 | `Line 5` | `recharge` |
| Végé-Attaque | frenzy-plant | Plante | spé | 150 | `Line 5` | `recharge` |
| Giga Impact | giga-impact | Normal | phys | 150 | `Dash 3` | `recharge` (contact → dash, pas Line) |
| Hydroblast | hydro-cannon | Eau | spé | 150 | `Line 5` | `recharge` |
| Lame Solaire | solar-blade | Plante | phys | 125 | `Single 1-1` | `twoTurnCharge` + `sunSkipsCharge` (lame contact, pas faisceau) |
| Laser Météore | meteor-beam | Roche | spé | 120 | `Line 5` | `twoTurnCharge` + `chargeEffects` AtqSpé +1 self |

**Divergences justifiées** : Giga Impact = `Dash 3` (flag `contact` + sémantique « charge », vs Ultralaser sans contact = Line) ; Lame Solaire = `Single 1-1` (flags `contact`+`slicing` = balayage mêlée, vs Lance-Soleil faisceau Line 5).

### Statut / no-op (2)
| move (FR) | id | type | cat | shape | effet |
|-----------|----|------|-----|-------|-------|
| Camaraderie | play-nice | Normal | statut | `Single 1-3` | Atq -1 cible + `bypassAccuracy` (never-miss canon) |
| Trempette | splash | Normal | statut | `Self` | aucun (`effects: []`, no-op) |

## Étapes

1. Ajouter 11 entrées `tacticalOverrides` (bloc `// --- Content Batch G6 moves ---`) dans `packages/data/src/overrides/tactical.ts` (avant `};` ligne 2451).
2. Ajouter 11 noms EN dans `packages/data/src/i18n/moves.en.json` (alpha-triés, FR déjà présent).
3. Corriger le count moves dans `BattleEngine.integration.test.ts` (319 → 330).
4. Roadmap + STATUS + next.md : G6 done.
5. Gate CI (build + lint + typecheck + test + integration).
6. Vérif sandbox visuelle (humain décide).

## Vérif

- 11 moves chargent via `loadData()` (330 moves total) sans `Missing tactical override`.
- Force/Écrasement/Double Baffe melee Single ; nukes recharge Line 5 ; Giga Impact Dash ; charges solaires sun-skip ; Laser Météore boost AtqSpé au tour 1 ; Camaraderie touche toujours (bypassAccuracy) + baisse Atq ; Trempette no-op.
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests (sauf count moves 319→330).
