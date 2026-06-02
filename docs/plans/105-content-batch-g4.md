# Plan 105 — Content Batch G4 (36 moves dégâts + stat-drop / high-crit / recoil / drain)

> Statut : **done**
> Créé : 2026-06-02
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer` + revue directeur créatif (2026-06-02).

## Objectif

Livrer le **Content Batch G4** : moves Gen 1 learnable par le roster, **dégâts + (stat-drop secondaire / high-crit / recoil / drain)**, shape + effets déjà supportés, **aucune mécanique nouvelle**. Couverture exhaustive movepools pour Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` (`targeting` + `effects[]`) + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent, auto-généré depuis reference). Données canon (power/type/category/accuracy/flags/critRatio/names) auto-mergées depuis reference. Pas de sprite, OP sets non touchés.

## Encodages réutilisés (tous existants — zéro nouveau handler)

- **Stat-drop secondaire** : `{ kind: EffectKind.StatChange, stat: StatName.X, stages: -N, target: EffectTarget.Targets, chance: N }` (modèle crunch/aurora-beam).
- **Recoil** : `{ kind: EffectKind.Recoil, fraction: N }` (modèle double-edge 1/3).
- **Drain** : `{ kind: EffectKind.Drain, fraction: N }` (modèle giga-drain 0.5).
- **High-crit** : `critRatio` fourni par la reference → **juste `{ kind: EffectKind.Damage }`**, aucun override de crit (parité Poison Croix G3).
- Flags (sound/slicing/contact…) fournis par la reference — **non redéclarés** (un override `flags` écrase la reference, cf. backlog aerial-ace).

## Décisions directeur (2026-06-02)

- **Recoil rammers → Dash 3** : Bélier (`take-down`), Rapace (`brave-bird`), Éclair Fou (`wild-charge`), Aquatacle (`wave-crash`) → `Dash maxDistance:3`, par cohérence avec Tacle Volt (`volt-tackle`) / Boutefeu (`flare-blitz`) / Nitrocharge (`flame-charge`) déjà en Dash 3. **Martobois (`wood-hammer`) reste `Single r1`** (coup de masse stationnaire, pas une charge).
- **Tunnelier (`drill-run`) → `Line length:2`** : accent sur la vrille perforante linéaire (pas un coup mêlée simple).
- **AoE canon → Zone/Cone/Slash** : Piétisol (`bulldoze`) Zone r1 ; Ocroupi (`muddy-water`) + Toile Élek (`electroweb`) Zone r2 ; Aboiement (`snarl`) Cone 1-3 ; Survinsecte (`struggle-bug`) Cone 1-2 ; Abattage (`breaking-swipe`) + Tranch'Air (`air-cutter`) Slash.

## Scope final — 36 moves

### Recoil (5)
| move (FR) | id | type | shape | effet |
|-----------|----|----|-------|-------|
| Bélier | take-down | Normal | `Dash 3` | Recoil 1/4 |
| Éclair Fou | wild-charge | Élec | `Dash 3` | Recoil 1/4 |
| Rapace | brave-bird | Vol | `Dash 3` | Recoil 1/3 |
| Aquatacle | wave-crash | Eau | `Dash 3` | Recoil 1/3 |
| Martobois | wood-hammer | Plante | `Single 1` | Recoil 1/3 |

### Drain (3)
| move (FR) | id | type | shape | effet |
|-----------|----|----|-------|-------|
| Vampi-Poing | drain-punch | Combat | `Single 1` | Drain 0.5 |
| Vole-Vie | absorb | Plante | `Single 1-2` | Drain 0.5 |
| Vampibaiser | draining-kiss | Fée | `Single 1` | Drain 0.75 |

### High-crit (6) — juste Damage, critRatio reference
| move (FR) | id | type | shape |
|-----------|----|----|-------|
| Lame de Roc | stone-edge | Roche | `Single 1-2` |
| Tunnelier | drill-run | Sol | `Line 2` |
| Griffe Ombre | shadow-claw | Spectre | `Single 1` |
| Tranch'Air | air-cutter | Vol | `Slash` |
| Coupe Psycho | psycho-cut | Psy | `Slash` |
| Tranche-Nuit | night-slash | Tén. | `Slash` |

### Stat-drop secondaire (22)
| move (FR) | id | type | cat | shape | secondaire |
|-----------|----|----|-----|-------|-----------|
| Piétisol | bulldoze | Sol | Phys | `Zone r1` | Vit -1 100% |
| Tomberoche | rock-tomb | Roche | Phys | `Single 1-3` | Vit -1 100% |
| Balayette | low-sweep | Combat | Phys | `Single 1` | Vit -1 100% |
| Bond | pounce | Insecte | Phys | `Single 1` | Vit -1 100% |
| Tir de Boue | mud-shot | Sol | Spé | `Single 1-3` | Vit -1 100% |
| Toile Élek | electroweb | Élec | Spé | `Zone r2` | Vit -1 100% |
| Furie-Bond | lunge | Insecte | Phys | `Single 1` | Atk -1 100% |
| Abattage | breaking-swipe | Dragon | Phys | `Slash` | Atk -1 100% |
| Douche Froide | chilling-water | Eau | Spé | `Single 1-3` | Atk -1 100% |
| Câlinerie | play-rough | Fée | Phys | `Single 1` | Atk -1 10% |
| Aqua-Brèche | liquidation | Eau | Phys | `Single 1` | Déf -1 20% |
| Coqui-Lame | razor-shell | Eau | Phys | `Slash` | Déf -1 50% |
| Éclate Griffe | crush-claw | Normal | Phys | `Single 1` | Déf -1 50% |
| Telluriforce | earth-power | Sol | Spé | `Single 1-3` | DéfSpé -1 10% |
| Bourdon | bug-buzz | Insecte | Spé | `Single 1-3` | DéfSpé -1 10% |
| Bombe Acide | acid-spray | Poison | Spé | `Single 1-3` | DéfSpé -2 100% |
| Ravage Rampant | skitter-smack | Insecte | Phys | `Single 1` | AtqSpé -1 100% |
| Aboiement | snarl | Tén. | Spé | `Cone 1-3` | AtqSpé -1 100% |
| Feu Ensorcelé | mystical-fire | Feu | Spé | `Single 1-3` | AtqSpé -1 100% |
| Survinsecte | struggle-bug | Insecte | Spé | `Cone 1-2` | AtqSpé -1 100% |
| Coud'Boue | mud-slap | Sol | Spé | `Single 1-2` | Préc -1 100% |
| Ocroupi | muddy-water | Eau | Spé | `Zone r2` | Préc -1 30% |

## Étapes

1. Ajouter 36 entrées `tacticalOverrides` (bloc `// --- Content Batch G4 moves ---`) dans `packages/data/src/overrides/tactical.ts`.
2. Ajouter 36 noms EN dans `packages/data/src/i18n/moves.en.json` (FR déjà présent).
3. Roadmap + STATUS + next.md : G4 done.
4. Corriger le count moves dans `BattleEngine.integration.test.ts` (260 → 296).
5. Gate CI (build + lint + typecheck + test + integration).
6. Vérif sandbox visuelle (humain décide).

## Vérif

- 36 moves chargent via `loadData()` (296 moves total, ex-260) sans `Missing tactical override`.
- Targeting/effects corrects (recoil rammers Dash 3 ; drill-run Line 2 ; AoE Zone/Cone/Slash ; high-crit = Damage seul, crit via reference).
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests (sauf le count moves attendu 260→296).
