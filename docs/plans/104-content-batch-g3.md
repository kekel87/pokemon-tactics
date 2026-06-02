# Plan 104 — Content Batch G3 (24 moves dégâts + secondaire statut/flinch/confusion)

> Statut : **done**
> Créé : 2026-06-02
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer` + revue case-par-case directeur créatif.

## Objectif

Livrer le **Content Batch G3** : moves Gen 1 learnable par le roster, **dégâts + secondaire (statut majeur / flinch / confusion)**, shape + effet déjà supportés, **aucune mécanique nouvelle**. Couverture exhaustive movepools pour Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` (`targeting` + `effects[]`) + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent, auto-généré depuis reference). Données canon (power/type/category/accuracy/flags/critRatio/names) auto-mergées depuis reference. Pas de sprite, OP sets non touchés.

Encodage secondaire = modèle `body-slam` (dégâts-first, pas d'`effectTier`) : `{ kind: EffectKind.Status, status: StatusType.X, chance: N }`. Statuts utilisés : `Burned`/`Poisoned`/`Paralyzed`/`Frozen` (majeurs), `Confused`/`Flinch` (volatils) — tous existants. Multi-hit absent de ce batch.

## Scope final — 24 moves (sur 27 roadmap)

**3 retirés** après revue directeur créatif (2026-06-02) — riders identité forte nécessitant une méca non codée → plans dédiés (parité décision G2 psyshock) :

| move retiré (FR) | raison | report |
|------------------|--------|--------|
| Lyophilisation (freeze-dry) | super-efficace vs Eau (override table de types) | plan dédié « override type-chart » |
| Ronflement (snore) | utilisable seulement si lanceur endormi (gate d'usage) | plan dédié « gate sommeil » (lien Repos) |
| Talon-Marteau (axe-kick) | crash 50% dégâts sur soi si raté | batch « crash on miss » (avec supercell-slam / hi-jump-kick) |

**Flags** : sound/wind/pulse/bullet/slicing/distance/contact fournis par la reference — **non redéclarés** dans l'override (un override `flags` écrase la reference, cf. backlog aerial-ace). critRatio (Poison Croix, Queue-Poison) fourni par reference.

### Spéciaux (14)
| move (FR) | id | type | shape | secondaire |
|-----------|----|----|-------|-----------|
| Vibraqua | water-pulse | Eau | `Zone r1` | Confused 20% |
| Canicule | heat-wave | Feu | `Cone 1-3` | Burned 10% |
| Sable Ardent | scorching-sands | Sol | `Zone r1` | Burned 30% |
| Vibrobscur | dark-pulse | Tén. | `Zone r1` | Flinch 20% |
| Vent Violent | hurricane | Vol | `Cone 1-3` | Confused 30% |
| Ébullition | scald | Eau | `Single 1-3` | Burned 30% |
| Éclair | thunder-shock | Élec | `Single 1-3` | Paralyzed 10% |
| Élecanon | zap-cannon | Élec | `Line 4` | Paralyzed 100% |
| Feu d'Enfer | inferno | Feu | `Zone r2` | Burned 100% |
| Poudreuse | powder-snow | Glace | `Cone 1-2` | Frozen 10% |
| Détritus | sludge | Poison | `Single 1-3` | Poisoned 30% |
| Purédpois | smog | Poison | `Cone 1-2` | Poisoned 40% |
| Extrasenseur | extrasensory | Psy | `Single 1-4` | Flinch 10% |
| Ouragan | twister | Dragon | `Cone 1-2` | Flinch 20% |

### Physiques (10)
| move (FR) | id | type | shape | secondaire |
|-----------|----|----|-------|-----------|
| Psykoud'Boul | zen-headbutt | Psy | `Single 1` | Flinch 20% |
| Direct Toxik | poison-jab | Poison | `Single 1` | Poisoned 30% |
| Tête de Fer | iron-head | Acier | `Single 1` | Flinch 20% |
| Détricanon | gunk-shot | Poison | `Blast 2-4 r1` | Poisoned 30% |
| Poison Croix | cross-poison | Poison | `Slash` | Poisoned 10% |
| Draco-Charge | dragon-rush | Dragon | `Dash 3` + **Knockback 1** | Flinch 20% |
| Étincelle | spark | Élec | `Single 1` | Paralyzed 30% |
| Étonnement | astonish | Spectre | `Single 1` | Flinch 30% |
| Frotte-Frimousse | nuzzle | Élec | `Single 1` | Paralyzed 100% |
| Queue-Poison | poison-tail | Poison | `Slash` | Poisoned 10% |

## Décisions directeur (2026-06-02)

- **Vibraqua + Vibrobscur (pulse)** → `Zone` (et non Line/Single). Rayon `r1` tranché (60/80 BP, Zone r2 trop fort avec Confusion/Flinch).
- **Sable Ardent** → `Zone r1` (gabarit lava-plume ; 70 BP < Séisme, différencié par puissance).
- **Purédpois** → `Cone 1-2` (gaz qui se disperse en éventail).
- **Draco-Charge** → seul move éligible knockback (charge/ram single-target Dash, famille skull-bash/Draco-Queue). + `Knockback distance: 1`. Les vents (Vent Violent/Ouragan) restent AoE pur (knockback multi-cible bancal).
- Ébullition (scald) oubliée de la passe pattern-designer, rajoutée : `Single 1-3` (projectile eau, profil Détritus).

## Étapes

1. Ajouter 24 entrées `tacticalOverrides` (bloc `// --- Content Batch G3 moves ---`) dans `packages/data/src/overrides/tactical.ts`.
2. Ajouter 24 noms EN dans `packages/data/src/i18n/moves.en.json` (FR déjà présent).
3. Roadmap + STATUS : G3 done, reporter les 3 sortis dans les batches/plans mécaniques.
4. Gate CI (build + lint + typecheck + test + integration). Corriger le count de moves dans `BattleEngine.integration.test.ts` (236 → 260).
5. Vérif sandbox visuelle (humain décide).

## Vérif

- 24 moves chargent via `loadData()` (260 moves total, ex-236) sans `Missing tactical override`.
- Targeting/effects corrects (statuts 100% : zap-cannon/inferno/nuzzle ; Draco-Charge knockback ; Zone r1 pulse).
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests (sauf le count moves attendu).
