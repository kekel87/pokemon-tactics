# Plan 106 — Content Batch G5 (23 moves pure stat-change + pure statut)

> Statut : **done**
> Créé : 2026-06-02
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer` + revue directeur créatif (2026-06-02).

## Objectif

Livrer le **Content Batch G5** — dernier batch G : moves Gen 1 learnable par le roster, **pur stat-change OU pur statut (aucun dégât)**, shape + effets déjà supportés, **aucune mécanique nouvelle**. Clôt la couverture des moves « simples » du roster pour le Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` (`targeting` + `effects[]` [+ `effectTier`] [+ `targetsAlly`]) + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent, auto-généré depuis reference). Données canon (type/category/accuracy/pp/flags/names) auto-mergées depuis reference. Pas de sprite, OP sets non touchés.

## Encodages réutilisés (tous existants — zéro nouveau handler)

- **Debuff ennemi** : `{ kind: EffectKind.StatChange, stat: StatName.X, stages: -N, target: EffectTarget.Targets }` (modèle Grondement/growl). `handle-stat-change` applique blocages Mist/Substitut automatiquement (`isEnemyDebuff = target !== Self && stages < 0`).
- **Buff self** : `{ ..., target: EffectTarget.Self }` (modèle Danse-Lames/swords-dance, Frein/defense-curl).
- **Buff allié** : flag `targetsAlly: true` + `Single {min:1,max:1}` (resolver filtre tiles alliés adjacents) + effets `target: EffectTarget.Targets` positifs (modèle resolver Relais/baton-pass, mais effet StatChange générique).
- **Statut** : `{ kind: EffectKind.Status, status: StatusType.X, chance: 100 }` (modèle Onde Folie/confuse-ray).
- **Stat-boost ennemi + confusion** (Vantardise/Flatterie) : `StatChange target:Targets stages:+N` (non bloqué — pas un debuff) puis `Status Confused`.
- **EffectTier** (impacte coût CT via `computeMoveCost`) : debuffs ennemi = aucun (parité growl) ; buff self +1 simple = aucun (parité defense-curl) ; buff +2 = `MajorBuff` (parité agility) ; double buff = `DoubleBuff` (parité bulk-up) ; tout statut = `MajorStatus`.
- Flags (sound/powder…) fournis par la reference — **non redéclarés** (un override `flags` écrase la reference, cf. backlog aerial-ace).

## Décisions directeur (2026-06-02)

- **Defer hors G5** (mécanique core absente) : **Dépit** (`spite`, réduit PP — pas d'`EffectKind` PP-reduction), **Venimprégne** (`venom-drench`, conditionnel cible empoisonnée), **Influx Magnétik** (`magnetic-flux`, gate Plus/Minus + buff multi-allié), **Grondement** (`howl`, buff multi-allié Gen8+). → mini-plans dédiés ultérieurs. Scope G5 réduit 27 → **23 moves**.
- **Patterns** (agent `move-pattern-designer`, revus) : single-cible canon → `Single` ; « tous ennemis adjacents » canon (cris/regards de groupe) → `Cone` ; danse/poudre AoE rayonnante → `Zone r1` (parité Poudre Dodo/sleep-powder déjà `Zone r1`).
- **Noms FR corrigés** depuis reference (`names.fr`) vs énoncé initial : Regard Touchant (baby-doll-eyes), Strido-Son (metal-sound), Poliroche (rock-polish), Doux Baiser (sweet-kiss), Vantardise (swagger), Rengorgement (work-up), Ondes Étranges (eerie-impulse).
- **Coaching** retenu via `targetsAlly` (buff allié Atq/Déf +1, premier buff-stat-allié générique du projet).

## Scope final — 23 moves

### Stat — debuffs ennemi (12)
| move (FR) | id | shape | effet |
|-----------|----|-------|-------|
| Grimace | scary-face | `Single 1-3` | Vit -2 |
| Charme | charm | `Single 1-3` | Atq -2 |
| Croco Larme | fake-tears | `Single 1-3` | DéfSpé -2 |
| Ondes Étranges | eerie-impulse | `Single 1-3` | AtqSpé -2 |
| Strido-Son | metal-sound | `Single 1-3` | DéfSpé -2 |
| Regard Touchant | baby-doll-eyes | `Single 1-3` | Atq -1 |
| Confidence | confide | `Single 1-3` | AtqSpé -1 |
| Chatouille | tickle | `Single 1-2` | Atq -1 ET Déf -1 |
| Gros'Yeux | leer | `Cone 1-3` | Déf -1 |
| Mimi-Queue | tail-whip | `Cone 1-3` | Déf -1 |
| Doux Parfum | sweet-scent | `Cone 1-3` | Esquive -2 |
| Sécrétion | string-shot | `Cone 1-2` | Vit -2 |

### Stat — buffs self / allié (4)
| move (FR) | id | shape | effet | tier |
|-----------|----|-------|-------|------|
| Armure | harden | `Self` | Déf +1 (self) | — |
| Rengorgement | work-up | `Self` | Atq +1 ET AtqSpé +1 (self) | DoubleBuff |
| Poliroche | rock-polish | `Self` | Vit +2 (self) | MajorBuff |
| Coaching | coaching | `Single 1-1` `targetsAlly` | Atq +1 ET Déf +1 (allié) | DoubleBuff |

### Statut (7) — tier `MajorStatus`
| move (FR) | id | shape | effet |
|-----------|----|-------|-------|
| Poudre Toxik | poison-powder | `Zone r1` | Empoisonnement 100% |
| Para-Spore | stun-spore | `Zone r1` | Paralysie 100% |
| Gaz Toxik | poison-gas | `Cone 1-2` | Empoisonnement 100% |
| Doux Baiser | sweet-kiss | `Single 1-1` | Confusion 100% |
| Danse Folle | teeter-dance | `Zone r1` | Confusion 100% |
| Vantardise | swagger | `Single 1-3` | cible Atq +2 + Confusion 100% |
| Flatterie | flatter | `Single 1-3` | cible AtqSpé +1 + Confusion 100% |

## Étapes

1. Ajouter 23 entrées `tacticalOverrides` (bloc `// --- Content Batch G5 moves ---`) dans `packages/data/src/overrides/tactical.ts`.
2. Ajouter 23 noms EN dans `packages/data/src/i18n/moves.en.json` (clés alpha-triées, FR déjà présent).
3. Corriger le count moves dans `BattleEngine.integration.test.ts` (296 → 319).
4. Roadmap + STATUS + next.md : G5 done (dernier batch G), defer spite/venom-drench/magnetic-flux/howl notés.
5. Gate CI (build + lint + typecheck + test + integration).
6. Vérif sandbox visuelle (humain décide).

## Vérif

- 23 moves chargent via `loadData()` (319 moves total, ex-296) sans `Missing tactical override`.
- Targeting/effets corrects (Cone pour debuffs « tous ennemis » ; Zone r1 poudres + Danse Folle ; coaching `targetsAlly` buffe l'allié adjacent ; Vantardise/Flatterie non bloqués par Mist/Sub car boost non-négatif).
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests (sauf count moves attendu 296→319).
- Defer documenté : spite, venom-drench, magnetic-flux, howl restent hors roster implémenté.
