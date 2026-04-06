# Plan 014 — Patterns slash et blast + mise à jour tactical.ts

> **Statut** : done
> **Créé** : 2026-03-27
> **Prérequis** : aucun (les specs sont dans docs/reflexion-patterns-attaques.md, décisions #108-109-110)

---

## Contexte

Le roster actuel utilise 7 targeting patterns. Deux patterns manquent pour exprimer correctement les movesets :
- **slash** : les 3 cases directement devant le lanceur, aucun paramètre (Tranch'Herbe, Cru-Aile)
- **blast** : projectile + explosion circulaire à distance (Bombe-Beurk, Ball'Ombre)

8 moves ont un pattern incorrect dans `tactical.ts` et attendent ces 2 patterns pour être corrigés (décision #110).

---

## Étapes

### Étape 1 — Ajouter `Slash` et `Blast` aux enums et types

- [x] `packages/core/src/enums/targeting-kind.ts` — ajouter `Slash: "slash"` et `Blast: "blast"`
- [x] `packages/core/src/types/targeting-pattern.ts` — ajouter les deux variantes au type union :
  - `{ kind: TargetingKind.Slash }` — aucun paramètre, touche toujours les 3 cases devant
  - `{ kind: TargetingKind.Blast; range: RangeConfig; radius: number }` — range = portée de lancer, radius = taille explosion

### Étape 2 — Implémenter `resolveSlash` + routing switch

- [x] Ajouter `resolveSlash` dans `packages/core/src/grid/targeting.ts`
- [x] Ajouter `case TargetingKind.Slash` dans le `switch` de `resolveTargeting`

**Logique :**
- Détermine la direction du caster vers la cible (`directionFromTo`)
- Calcule la case en face (distance 1) dans cette direction (`stepInDirection`)
- Ajoute les 2 cases perpendiculaires adjacentes à la case en face (`getPerpendicularOffsets`)
- Résultat : 3 cases (face + 2 perpendiculaires)
- Filtre les cases hors grille

```
    T T T       (T = case touchée)
      L         (L = lanceur, face vers le haut)
```

**Note :** `getValidTargetPositions` retourne uniquement les 4 positions cardinales pour Slash (comme Line/Cone), donc la cible ne peut jamais être en diagonale.

**Cas limites :**
- Caster au bord de la grille → certaines cases filtrées, l'attaque touche 1 ou 2 cases

- [x] Tests (`packages/core/src/grid/targeting.integration.test.ts`) :
  - Slash au centre → 3 cases
  - Slash dans un coin → 1-2 cases (bord de grille)
  - Slash dans chaque direction cardinale → positions correctes

### Étape 3 — Implémenter `resolveBlast` + routing switch

- [x] Ajouter `resolveBlast` dans `packages/core/src/grid/targeting.ts`
- [x] Ajouter `case TargetingKind.Blast` dans le `switch` de `resolveTargeting`

**Logique :**
- Vérifie que `targetPosition` est dans la portée (`range.min` à `range.max`) via `manhattanDistance`
- Si hors portée → `[]`
- Calcule toutes les cases dans un rayon `radius` autour de `targetPosition` (même logique que `resolveZone` mais centrée sur target)

**Différences avec les patterns existants :**
- vs `zone` : centré sur target (pas sur caster), avec vérification de portée
- vs `cross` : forme circulaire (losange manhattan), pas en +

- [x] Tests :
  - Blast range 2-4 radius 1 au centre → 5 cases (losange)
  - Blast range 2-4 radius 2 au centre → 13 cases (losange r2)
  - Blast hors portée (distance < min ou > max) → []
  - Blast en bord de grille radius 1 → cases filtrées
  - Blast en bord de grille radius 2 → cases filtrées
  - Blast radius 0 → 1 case (équivalent single)

### Étape 4 — Intégrer dans `BattleEngine.getValidTargetPositions`

- [x] `packages/core/src/battle/BattleEngine.ts` — ajouter 2 cases dans le `switch` :
  - `Slash` → `getFourDirectionPositions` (comme Line/Cone — le joueur choisit une direction)
  - `Blast` → `getTilesInRange(targeting.range.min, targeting.range.max)` (comme Single/Cross — le joueur choisit une case dans la portée)

### Étape 5 — Mise à jour validation

- [x] `packages/core/src/battle/validate.ts` — ajouter validation :
  - `blast.radius >= 0`
  - `blast.range.min <= blast.range.max` (déjà couvert par le check existant sur `"range" in targeting`)

### Étape 6 — Mettre à jour `tactical.ts` avec les 8 changements de pattern

- [x] `packages/data/src/overrides/tactical.ts`

| # | Move | Pattern actuel | Nouveau pattern |
|---|------|---------------|-----------------|
| 1 | Tranch'Herbe (Razor Leaf) | `single 1-2` | `slash` |
| 2 | Poudre Dodo (Sleep Powder) | `single 1-2` | `zone r1` |
| 3 | Bombe-Beurk (Sludge Bomb) | `cross 2-4 s3` | `blast 2-4 r1` |
| 4 | Bulles d'O (Bubble Beam) | `cross 1-2 s3` | `cone 1-2 w3` |
| 5 | Tornade (Gust) | `single 1-3` | `cone 1-3 w3` |
| 6 | Cru-Aile (Wing Attack) | `single 1` | `slash` |
| 7 | Ampleur (Magnitude) | `zone r1` | `zone r2` |
| 8 | Ball'Ombre (Shadow Ball) | `cross 2-4 s3` | `blast 2-4 r1` |

### Étape 7 — Tests d'intégration BattleEngine

- [x] Tests dans `packages/core/src/grid/targeting.integration.test.ts` (ou fichier battle dédié) :
  - `resolveTargeting` route correctement vers `resolveSlash` et `resolveBlast`
  - `getLegalActions` retourne des positions valides pour un move slash et un move blast
  - `executeUseMove` avec slash : 3 cases touchées, dégâts appliqués aux occupants
  - `executeUseMove` avec blast + effet statut (poison) : vérifie que le statut s'applique à **tous** les Pokemon dans le rayon, pas juste la case ciblée

---

## Fichiers impactés (résumé)

| Package | Fichier | Type de changement |
|---------|---------|-------------------|
| core | `enums/targeting-kind.ts` | ajout 2 valeurs |
| core | `types/targeting-pattern.ts` | ajout 2 variantes union |
| core | `grid/targeting.ts` | ajout 2 resolvers + 2 cases switch |
| core | `battle/BattleEngine.ts` | ajout 2 cases dans `getValidTargetPositions` |
| core | `battle/validate.ts` | validation blast.radius |
| core | `grid/targeting.integration.test.ts` | tests slash + blast + intégration |
| data | `overrides/tactical.ts` | 8 changements de pattern |

---

## Ce qui n'est PAS dans ce plan

- Knockback, warp, ground (Phase 1+ ultérieur)
- Self-damage / recul (Voltacle etc.)
- Mise à jour renderer (le renderer utilise `getLegalActions`, pas de changement nécessaire)
- Mise à jour `roster-poc.md` → sera fait par `doc-keeper` après implémentation
- Équilibrage des dégâts/stats (sujet séparé)

---

## Risques

- **Poudre Dodo zone r1** = AoE sommeil centré sur soi. Friendly fire inclus. Puissant mais risqué — cohérent avec la philosophie FFTA.
- **Ampleur zone r2 sur Racaillou** — 13 cases + Racaillou tanky. Compensé par sa vitesse basse (agit tard) et le friendly fire.
