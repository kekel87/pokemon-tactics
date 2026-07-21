---
status: done
created: 2026-07-21
updated: 2026-07-21
---

# Plan 165 — IA CT-aware (heuristique KO-protégé)

> **Décision humain** : approche **A** (heuristique, pas de lookahead). Le backlog disait « nécessite
> lookahead multi-tour » ; l'analyse montre qu'un facteur CT **protégeant la composante KO** suffit pour
> le cas principal, sans simulation. B (lookahead 1-ply) reste un levier futur pour l'anticipation de
> l'IA difficile, à ouvrir **seulement** si un playtest le réclame.
> **Suite de** : plan 068 (étape 2 différée). Toutes les modifs dans `packages/core/src/ai/action-scorer.ts`.

## Contexte — pourquoi le fix naïf (plan 068) a échoué

Le scorer IA est **greedy monoronde** : à chaque tour il note chaque action et joue la meilleure, sans
anticiper. Le CT (Charge Time) — coût de temps d'une action, qui détermine à quelle fréquence on rejoue —
est **ignoré** par le scoring.

Plan 068 étape 2 avait tenté `score *= CT_REFERENCE_COST / ctCost`. Résultat : **combats >5000 tours** en
charge. Cause : la division frappait *tout* le score, **y compris la composante KO** (`killPotential = 10`).
Un KO lent devenait moins bien noté qu'un chip rapide → l'IA spammait des moves faibles → aucun camp ne
retirait de menace → combats interminables.

## Insight de design

Un KO retire une menace **définitivement** — c'est un *step-change*, pas un débit. Il doit valoir sa pleine
valeur quel que soit le coût CT. Seul le **chip / utilitaire** (un *débit*) mérite une pondération par CT.

De plus, `damageScore × (ref/cost)` est **proportionnel aux dégâts-par-CT** : `damageScore ∝ ratio` (part de
PV infligée), donc `damageScore × ref/cost ∝ ratio/cost`. La pondération multiplicative range donc
correctement les moves par efficacité tempo — un gros move qui inflige plus n'est pas injustement pénalisé,
car ses dégâts supérieurs sont déjà dans `damageScore`.

## Formule retenue

```
ctFactor(move) = min(1, CT_REFERENCE_COST / computeMoveCost(move.pp, move.power, move.effectTier))
                 // CT_REFERENCE_COST = 500 (coût minimum) → cost 500 = 1.0, 600 = 0.83, 700 = 0.71, 900 = 0.55
                 // min(1, …) : on ne PÉNALISE que les coûts > 500, jamais de bonus (pas d'inflation de score)

finalScore =
  securesKo ? rawScore                 // KO (dégât direct OU ring-out létal) : pleine valeur, jamais divisé
            : rawScore <= 0 ? rawScore // scores négatifs / nuls : pas de re-scaling (friendly fire, garde-fous)
                            : rawScore * ctFactor
```

## Périmètre (v1)

Pondération CT appliquée au **chemin générique de dégâts/statut** (`scoreUseMove`, l'assemblage final
lignes ~406-608) — le chemin de **loin le plus fréquent** : chaque attaque standard (Lame de Roche vs
Éboulement vs Séisme…), statut infligé à l'ennemi. C'est là que le choix de tempo compte le plus.

**Hors périmètre v1** (exemptés, scoring bespoke conservé — suivi possible plan futur) :
- Branches à `return` anticipé : OHKO (Guillotine), Explosion/Destruction, Tout ou Rien, Souvenir, Vœu Soin,
  Croc Fatal, Balance/Effort, Transform, Buée Noire, stat-manip. Kill-or-nothing / sacrifice / utilitaire
  niche — leur note bespoke reflète déjà l'engagement.
- Self-buffs (Danse-Lames…) et moves alliés : `scoreSelfMove` / `scoreAllyTargetMove` return anticipés.
- Déplacement (`scoreMove`) et EndTurn : pas de coût de move offensif, hors sujet CT ici.

**Pas de champ par profil** : `CT_REFERENCE_COST` est une const module (signal partagé par easy/medium/hard,
cohérent avec « scoring commun à tous les niveaux »). Une sensibilité CT par difficulté serait du scope creep.

## Étapes

1. **Const** : `CT_REFERENCE_COST = 500` + import `computeMoveCost` depuis `../battle/ct-costs`.
2. **`scoreDamagingMove`** → retourne `{ score, securesKo }`. `securesKo = true` si une cible touchée a
   `estimate.min >= target.currentHp && !cannotKo` (même condition que le crédit KO existant). Un seul
   appelant (ligne ~410).
3. **`scoreKnockbackRingOut`** → retourne `{ score, securesLethalKo }`. `securesLethalKo = true` si une issue
   d'éjection est `lethal`. Un seul appelant (ligne ~537).
4. **Chemin générique** : accumuler `securesKo` depuis (2) et (4) ; à la fin, `return applyCtWeight(score, securesKo, move)`.
5. **`applyCtWeight(score, securesKo, move)`** : implémente la formule ci-dessus.
6. **Tests** `action-scorer.test.ts`, describe « CT-aware scoring (plan 165) » :
   - 2 attaques dégâts ≈ égaux non-létaux, CT 500 vs 900 → l'IA préfère CT 500.
   - Move lent (CT 900) qui **tue** > move rapide (CT 500) qui ne tue pas (KO exempté).
   - Ring-out létal (move à recul) exempté : préféré à un chip rapide.
   - Score négatif (friendly fire) non re-scalé.
7. **Test de régression charge** : un combat 6v6 CT ne dépasse pas un plafond de tours raisonnable (garde
   anti-drag). Réutiliser / étendre un scénario CT existant si présent.
8. Gate CI.

## Fichiers touchés

- `packages/core/src/ai/action-scorer.ts` — const, `applyCtWeight`, signatures `scoreDamagingMove` /
  `scoreKnockbackRingOut`, application au chemin générique.
- `packages/core/src/ai/action-scorer.test.ts` — nouveaux tests.
- `docs/ai-system.md` — lever la limitation « CT non intégré au scoring », documenter l'heuristique.

## Agents

| Moment | Agent |
|--------|-------|
| Après impl | `core-guardian` (core touché) + `code-reviewer` |
| Tests | `test-writer` (unitaires + scénario charge) |
| Fin | `doc-keeper` + `commit-message` |

## Bilan (2026-07-21)

Livré tel que planifié — const `CT_REFERENCE_COST = 500` + `applyCtWeight(score, securesKo, move)` dans
`packages/core/src/ai/action-scorer.ts`, appliqué au chemin générique de `scoreUseMove`. `securesKo`
accumulé depuis `scoreDamagingMove` (dégât direct) et `scoreKnockbackRingOut` (ring-out létal) — jamais
divisé. Scores ≤ 0 non re-scalés. Périmètre v1 respecté (branches à return anticipé exemptées, cf ci-dessus).

**Tests** : 3 unitaires (`action-scorer.test.ts`, describe « CT-aware scoring (plan 165) ») + 1 scénario
de régression charge (`scenarios/ct-scoring-anti-drag.scenario.test.ts`, 6v6 CT, 8 seeds) — 83 à 303 actions
par combat, plafond garde-fou 1000 (≈3× la marge au-dessus du pire cas sain observé, 5× sous le drag
historique >5000). Gate CI verte : unit + intégration 3879 tests, plus le scénario anti-drag.

`docs/ai-system.md` mis à jour (§ Pondération CT — heuristique KO-protégé, limitation levée).
