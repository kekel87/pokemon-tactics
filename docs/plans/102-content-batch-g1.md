# Plan 102 — Content Batch G1 (40 moves dégâts pur physique)

> Statut : **done**
> Créé : 2026-05-31
> Livré : 2026-05-31
> Auteur : Claude
> Spec source : `packages/data/reference/moves.json` (Champions), patterns via agent `move-pattern-designer`, `docs/reflexion-patterns-attaques.md`.

## Objectif

Livrer les 40 moves du **Content Batch G1** (cf. roadmap, analyse 2026-05-31) : moves Gen 1 learnable par le roster, dégâts physiques, **shape + effet déjà supporté, aucune mécanique nouvelle**. Couverture exhaustive movepools pour Team Builder libre.

Chaque move = 1 entrée `tacticalOverrides` (`targeting` + `effects[]`) + 1 entrée nom EN dans `i18n/moves.en.json` (FR déjà présent). Données canon (power/type/category/accuracy/flags/critRatio/names) auto-mergées depuis reference. Pas de sprite. OP sets optionnels → **non touchés** (coverage, pas curation).

## Contrainte de scope — riders complexes différés

Certains moves ont un rider canon nécessitant une mécanique non encore codée (cf. section "moves complexes" roadmap). Conformément au scope G1 ("aucune méca nouvelle"), ils sont livrés en **dégâts purs** ; le rider est différé au batch mécanique correspondant :

| move | rider canon différé | batch cible |
|------|--------------------|-------------|
| throat-chop | bloque moves `sound` 2 tours | Contrôle moves |
| lash-out | ×2 si stats baissées ce tour | Power conditionnel |
| temper-flare | ×2 si move précédent a échoué | Power conditionnel |
| fury-cutter | power escalade sur répétition | Power conditionnel |
| ice-spinner | retire le terrain actif | Champs/Terrains |
| steel-roller | retire terrain, échoue si aucun | Champs/Terrains |
| supercell-slam | crash dégâts self si miss | Crash on miss |
| fell-stinger | Atk +3 si KO | Misc volatile |
| psychic-fangs | casse Reflect/Light Screen | (extension Casse-Brique) |
| raging-bull | casse écrans + type selon forme | (extension Casse-Brique) |
| poltergeist | échoue si cible sans objet | Item interaction |
| pay-day | éparpille des pièces (no battle effect — jamais implémenté) | — |

## Patterns + effects (40 moves) — shapes validés par l'humain (2026-05-31)

Patterns proposés par `move-pattern-designer` puis **revus case par case avec le directeur créatif**. Décisions ci-dessous = canon (champ `target` reference, 38/40 = `normal`/adjacent) + libertés grid assumées (portées projectiles, charges Dash) validées.

Riders **supportés** : self-StatChange (chance ou 100%), secondary Status, Flinch. Never-miss → `bypassAccuracy`. Priorité Gen → `Dash` (gap-close).

### Dégâts purs (shape uniquement)
- `Single 1` : mega-kick, high-horsepower, ice-spinner, temper-flare, fury-cutter, slam, psychic-fangs, horn-attack, fell-stinger, throat-chop, lash-out, **shadow-punch** (+bypassAccuracy)
- `Single 1-2` : peck, power-whip, vine-whip, **smart-strike** (+bypassAccuracy), **megahorn** (corne qui empale)
- `Single 1-3` (tir/projectile à distance) : **seed-bomb** (canon mono-cible, pas d'AoE), pay-day, poltergeist
- `Slash` (arc frontal) : x-scissor, cut
- `Zone r1` (allAdjacent, friendly fire) : **brutal-swing**
- `Dash 2` (priorité / charge) : aqua-jet, mach-punch, bullet-punch, **ice-shard** (priorité), **raging-bull** (plaquage)
- `Dash 3` (charge longue) : supercell-slam, steel-roller

### Dégâts + self StatChange
- `trailblaze` (Dash 3) : Speed +1 self (100%)
- `flame-charge` (Dash 3) : Speed +1 self (100%)
- `superpower` (Single 1) : Atk -1 + Def -1 self (100%)
- `hammer-arm` (Single 1) : Speed -1 self (100%)
- `steel-wing` (Slash) : Def +1 self (10%)
- `metal-claw` (Single 1) : Atk +1 self (10%)
- `meteor-mash` (Single 1) : Atk +1 self (20%)

### Dégâts + status secondaire (fangs `bite`)
- `fire-fang` (Single 1) : Burned 10% + Flinch 10%
- `thunder-fang` (Single 1) : Paralyzed 10% + Flinch 10%
- `ice-fang` (Single 1) : Frozen 10% + Flinch 10%

**Note canon** : toutes ces attaques sont `target: normal` (adjacent) en canon, sauf brutal-swing (`allAdjacent` → Zone r1) et peck (`any`). Les portées 1-2 / 1-3 et les Dash sont des adaptations grid validées pour la profondeur tactique (précédents : Vive-Attaque Dash 2, Roue de Feu Dash 3, projectiles spéciaux ranged).

## Étapes

1. Ajouter les 40 entrées `tacticalOverrides` (bloc commenté `// --- Content Batch G1 moves ---`).
2. Ajouter 40 noms EN dans `i18n/moves.en.json` (FR déjà présent).
3. Gate CI (build + lint + typecheck + test + integration).
4. Vérif sandbox visuelle (humain décide).

## Vérif

- 40 moves chargent sans `Missing tactical override` / `not found in reference`.
- Team Builder : moves passent `isMoveImplemented` (dérivé keys tacticalOverrides).
- Pas de régression count tests (aucun assert de comptage moves).
