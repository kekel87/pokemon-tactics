# Plan 103 — Content Batch G2 (23 moves dégâts spécial + multi-hit)

> Statut : **done**
> Créé : 2026-06-01
> Livré : 2026-06-01
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer` + revue case-par-case directeur créatif, `docs/reflexion-patterns-attaques.md`.

## Objectif

Livrer le **Content Batch G2** : moves Gen 1 learnable par le roster, dégâts spécial + multi-hit, **shape + effet déjà supporté, aucune mécanique nouvelle**. Couverture exhaustive movepools pour Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` (`targeting` + `effects[]` + `bypassAccuracy?`) + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent, auto-généré depuis reference). Données canon (power/type/category/accuracy/flags/critRatio/names) auto-mergées depuis reference. Pas de sprite, OP sets non touchés.

Multi-hit déjà supporté (`EffectKind.Damage` champ `hits: number | {min,max}` + `getHitCount` dans `handle-damage.ts`, cf. double-kick/fury-swipes) → zéro méca nouvelle.

## Scope final — 23 moves

Le batch roadmap listait 28 moves. **5 retirés** après revue avec le directeur créatif (riders nécessitant une méca non codée → plans dédiés, pas de version dégâts-purs neutrée) :

| move retiré | raison | report |
|-------------|--------|--------|
| psyshock / psystrike | dégâts spé calculés sur Déf **physique** cible | plan dédié « dégâts spé sur Déf physique » |
| alluring-voice | confusion si cible boostée ce tour (secondaire conditionnel) | plan « secondaire conditionnel si cible boostée » |
| burning-jealousy | brûle si cible boostée ce tour (secondaire conditionnel) | idem |
| triple-axel | 3 hits power escaladant 20/40/60 (escalade multi-hit) | batch « escalade multi-hit » |

Décision directeur (2026-06-01) : contrairement à G1 (riders différés livrés en dégâts purs in-batch), ces 5 sont **sortis de G2** et traités dans un plan dédié avec leur vraie mécanique. Ajoutés à la roadmap.

## Patterns (23 moves) — shapes validés case-par-case (2026-06-01)

Proposés par `move-pattern-designer`, **revus un par un avec le directeur créatif**. Libertés grid assumées (AoE sur nukes, Blast météore, Cône « voix/wave »).

**Flags** : sound/bullet/pulse fournis par la reference — **non redéclarés** dans l'override (un override `flags` écrase la reference, cf. backlog aerial-ace). Never-miss canon (accuracy null) → `bypassAccuracy: true`.

### Spéciaux (13)
| move (FR) | shape | rider |
|-----------|-------|-------|
| Météores (swift) | `Blast` r1 portée 1-5 | bypassAccuracy |
| Draco-Choc (dragon-pulse) | `Line 4` | — |
| Éclat Magique (dazzling-gleam) | `Zone r2` | — |
| Mégaphone (hyper-voice) | `Cône 1-3` | sound (reference) |
| Surchauffe (overheat) | `Zone r2` | SpA -2 self |
| Onde Vide (vacuum-wave) | `Dash 2` (priorité) | — |
| Tempête Verte (leaf-storm) | `Cône 1-3` | SpA -2 self |
| Aurasphère (aura-sphere) | `Single 1-4` | bypassAccuracy |
| Feuille Magik (magical-leaf) | `Slash` | bypassAccuracy |
| Rayon Gemme (power-gem) | `Line 3` | — |
| Voix Enjôleuse (disarming-voice) | `Cône 1-2` | bypassAccuracy + sound |
| Draco-Météore (draco-meteor) | `Blast` r1 portée 1-5 | SpA -2 self |
| Onde de Choc (shock-wave) | `Cône 1-2` | bypassAccuracy |

### Multi-hit (10)
| move (FR) | shape | hits + rider |
|-----------|-------|--------------|
| Double Volée (dual-wingbeat) | `Single 1` | hits 2 |
| Boule Roc (rock-blast) | `Single 1-3` | hits 2-5 (bullet ref) |
| Rafale Écailles (scale-shot) | `Single 1-3` | hits 2-5 + Def-1/Spe+1 self |
| Balle Graine (bullet-seed) | `Single 1-3` | hits 2-5 (bullet ref) |
| Coup Double (double-hit) | `Single 1` | hits 2 |
| Dard-Nuée (pin-missile) | `Single 1-2` | hits 2-5 |
| Furie (fury-attack) | `Single 1` | hits 2-5 |
| Charge Os (bone-rush) | `Single 1-2` | hits 2-5 |
| Chute Glace (icicle-crash) | `Single 1-3` | **mono-hit** + Flinch 30% (mal classé multi-hit en roadmap) |
| Plumo-Queue (tail-slap) | `Single 1` | hits 2-5 |

## Étapes

1. ✅ Ajouter 23 entrées `tacticalOverrides` (bloc `// --- Content Batch G2 moves ---`).
2. ✅ Ajouter 23 noms EN dans `i18n/moves.en.json` (FR déjà présent).
3. Roadmap : G2 done, reporter les 5 sortis dans les batches mécaniques.
4. Gate CI (build + lint + typecheck + test + integration).
5. Vérif sandbox visuelle (humain décide).

## Vérif

- ✅ 23 moves chargent via `loadData()` (236 moves total, ex-213) sans `Missing tactical override`.
- ✅ Targeting/effects/bypassAccuracy corrects (overheat/leaf-storm/draco-meteor SpA-2 self, scale-shot Def-1/Spe+1, icicle-crash Flinch 30%).
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests.
