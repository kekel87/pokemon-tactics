# Plan 113 — B1 « Quasi-prêt » (6 moves quick-win)

> **Statut : done** (2026-06-05)
> Livré : 6 moves, 4 extensions moteur, 28 tests positionnels. Gate CI verte (2430 unit + 269 intégration). Total moves 348 → 354.
> Phase 4 — mécaniques complexes. Premier batch de la roadmap maître **plan 112** (vague 1).
> Suite des moteurs `dynamicPower` (109) / stat-source (110) / poids (111).

## Objectif

Livrer **6 moves** « quasi-prêts » : chacun ne demande qu'une **petite extension** du moteur existant, pas de gros système. Premier batch concret après la roadmap 112.

Mécaniques wiki vérifiées (Bulbapedia, gen 8/9) — voir tableau effets.

## Décision de scope (validée humain 2026-06-05)

3 moves initialement listés dans B1 sont **mis de côté** (pas droppés) : **Frustration**, **Retour**, **Puissance Cachée**. Raison : officiellement **inutilisables en gen 8/9** ("This move can't be used"), puissance dérivée d'un système de bonheur absent en tactique, learners = données TM legacy (lignées Roucool/Rattata/Piafabec/Paras). → On les revisitera selon ce que fera **Pokémon Champions** (maj future). Ils restent au pool (différés), pas exclus comme Téra-Explosion.

## Moves livrés (6)

Noms FR officiels (source `reference/moves.json` `names.fr`) :

| FR | ID EN | Type | Cat | BP | Acc | Pattern | Mécanique |
|----|-------|------|-----|----|----|---------|-----------|
| **Choc Psy** | `psyshock` | Psy | Spé | 80 | 100 | Single 1-4 | frappe **Déf physique** cible |
| **Frappe Psy** | `psystrike` | Psy | Spé | 100 | 100 | Single 1-4 | frappe **Déf physique** cible (signature Mewtwo) |
| **Lyophilisation** | `freeze-dry` | Glace | Spé | 70 | 100 | Single 1-4 | **×2 sur type Eau** + gel 10 % |
| **Triple Axel** | `triple-axel` | Glace | Phys | 20→40→60 | 90 | Single 1-1 | 1-3 coups, puissance croissante, précision **par coup** |
| **Pied Voltige** | `high-jump-kick` | Combat | Phys | 130 | 90 | Single 1-1 | **crash ½ PV max** si raté |
| **Talon-Marteau** | `axe-kick` | Combat | Phys | 120 | 90 | Single 1-1 | confusion 30 % + **crash ½ PV max** si raté |

Learners roster confirmés : Choc Psy 14, Frappe Psy 1 (Mewtwo), Lyophilisation 1 (Artikodin), Triple Axel 4 (Lamantine/Lippoutou/Artikodin/Mew), Pied Voltige + Talon-Marteau 1 (Kicklee).

## Extensions moteur (4)

### 1. Override Défense — Choc Psy / Frappe Psy

Spécial mais utilise la **Déf physique** de la cible (Atq Spé lanceur / Déf cible). Reste « spécial » pour le reste (STAB, Light Screen, etc. — aucune autre logique à toucher en gen 1).

- **`MoveDefinition.hitsPhysicalDefense?: boolean`** + miroir `TacticalOverride`.
- `damage-calculator.ts` ~l.88 :
  ```ts
  const usesPhysicalDefense = isPhysical || move.hitsPhysicalDefense === true;
  const defenseStat = usesPhysicalDefense ? defender.combatStats.defense : defender.combatStats.spDefense;
  const defenseStage = usesPhysicalDefense ? defender.statStages.defense : defender.statStages.spDefense;
  ```
- `handle-damage.ts` ~l.97 (`defenseStat` pour boost météo) : appliquer le même override (`resolvedMove.hitsPhysicalDefense` → `StatName.Defense`).
- Stages : on prend la Déf **effective de la cible avec ses crans** (parité Showdown standard).

### 2. Override type-efficacité — Lyophilisation

Glace fait **×2 sur Eau** (au lieu ×0.5), multiplié normalement sur le 2e type (Eau/Vol → ×4).

- **`MoveDefinition.typeEffectivenessOverride?: { against: PokemonType; multiplier: number }`** + miroir override.
- `getTypeEffectiveness(moveType, defenderTypes, typeChart, override?)` : 4e param optionnel. Dans la boucle, si `defType === override.against` → utiliser `override.multiplier` au lieu de la valeur du chart.
- **Router `move.typeEffectivenessOverride` sur TOUS les call sites** (sinon dégâts ≠ message d'efficacité) :
  - `damage-calculator.ts:76` (calc principal) + `:281` (`estimateDamage` preview).
  - `handle-damage.ts:162` (test super-efficace) + `:177` (effectiveness event/message) → `context.move.typeEffectivenessOverride`.
  - `effect-processor.ts:92` (effectiveness) → idem.
- Vérifier que `damage-estimate.test.ts` couvre l'override (le tooltip dégâts doit afficher « super efficace » sur Eau).

### 3. Multi-hit à puissance croissante + précision par coup — Triple Axel

1-3 coups, puissance 20/40/60, **chaque coup** re-teste la précision (90 %), s'arrête au 1er raté ; les dégâts déjà infligés restent.

- **`Effect.Damage.escalatingHitPower?: number[]`** (ex. `[20,40,60]`) → `hitCount = length`, puissance du coup `i` = `escalatingHitPower[i]`.
- **`MoveDefinition.perHitAccuracy?: boolean`** (+ miroir override) : dans la boucle multi-hit (`handle-damage.ts` ~l.377), **coup 0** = passe le gate précision move complet déjà appliqué en amont (`BattleEngine` l.953, sinon la cible ne serait pas dans `targets`) → frappe sans re-roll. **Coups 1+** = re-roll précision avant chaque coup ; échec → `break` (stop), **pas de crash**.
- `dealSingleHit` reçoit l'index du coup → clone le move avec `power = escalatingHitPower[index]`.
- **Simplification assumée** (à valider game-designer) : la re-roll par coup utilise `move.accuracy` brut (pas evasion/talents) — `checkAccuracy` complet vit dans `BattleEngine`, pas dans le handler. Acceptable pour un kick à 90 %.
- Émettre `MultiHitComplete` avec le nombre réel de coups (déjà géré).

### 4. Crash si raté — Pied Voltige / Talon-Marteau

Si le move **ne connecte pas**, le lanceur perd **½ PV max** (arrondi bas). Déclencheurs canon : raté précision, bloqué par Protection, cible immunisée (type ×0).

- **`MoveDefinition.crashOnMiss?: { fraction: number }`** (`0.5`) + miroir override.
- Flag « connecté » : `handle-damage` pose `context.shared.moveConnected = true` dès qu'un coup inflige des dégâts réels (efficacité > 0, non bloqué Protection). `BattleEngine.executeMove`, après résolution effets : si `move.crashOnMiss` et **non connecté** → appliquer `floor(maxHp × fraction)` au lanceur, émettre `DamageDealt {recoil:true}` + `PokemonKo` si PV ≤ 0.
- Couvre les 3 cas canon (raté = `targets` vide ; Protection/immunité = `moveConnected` jamais posé).
- Réutilise le pattern d'event de `handle-recoil.ts`. **N'applique PAS** `blocksRecoil`/`blocksIndirectDamage` — le crash est un auto-dégât de chute, pas du recoil de contact ; canon = Bourdon ne le bloque pas (**validé game-designer**).

## Effets data (`tactical.ts`)

```ts
psyshock: { targeting: Single 1-4, effects: [Damage], hitsPhysicalDefense: true },
"psystrike": { idem, hitsPhysicalDefense: true },
"freeze-dry": { Single 1-4, effects: [Damage, Status Frozen 10%], typeEffectivenessOverride: { against: Water, multiplier: 2 } },
"triple-axel": { Single 1-1, effects: [Damage escalatingHitPower:[20,40,60]], perHitAccuracy: true },
"high-jump-kick": { Single 1-1, effects: [Damage], crashOnMiss: { fraction: 0.5 } },
"axe-kick": { Single 1-1, effects: [Damage, Status Confusion 30%], crashOnMiss: { fraction: 0.5 } },
```

> Triple Axel : `power` reference = 20 mais c'est l'`escalatingHitPower` qui pilote. Vérifier que `move.power` n'écrase pas. Confusion/Gel : vérifier enums exacts (`StatusType.Confusion` volatile vs status).

## Tests (test-writer)

1 fichier `{id}.test.ts` par move :
- **psyshock / psystrike** : dégâts calculés sur Déf (pas DéfSpé) — monter DéfSpé cible très haut, vérifier dégâts ≈ formule Déf physique. Light Screen n'affecte pas (Reflect oui ? gen 1 sans screens en combat — sauter).
- **freeze-dry** : ×2 vs cible Eau pure ; ×4 vs Eau/Vol ; ×1 vs Eau/Acier ; gel 10 % seedé.
- **triple-axel** : 3 coups puissance 20/40/60 (seed full hit) ; stop au 2e coup (seed miss coup 2) ; 1 seul coup (miss coup 1 → move rate, pas de crash).
- **high-jump-kick** : connecte = pas de crash ; raté (seed) = lanceur perd ½ PV max ; cible Spectre (immunité Combat) = crash.
- **axe-kick** : crash si raté ; confusion 30 % seedée ; crash + dégât.

## Étapes

1. `test-writer` : specs des 6 moves (échouent d'abord).
2. Enums/types : `hitsPhysicalDefense`, `typeEffectivenessOverride`, `Effect.Damage.escalatingHitPower`, `perHitAccuracy`, `crashOnMiss` sur `MoveDefinition` + `TacticalOverride` + `Effect`.
3. `damage-calculator.ts` : override Défense + `getTypeEffectiveness` 4e param + callers preview.
4. `handle-damage.ts` : escalating power + précision par coup + flag `moveConnected`.
5. `BattleEngine.ts` : crash-on-miss post-résolution.
6. Data `packages/data/src/overrides/tactical.ts` : 6 entrées + noms EN (`moves.en.json` si besoin).
7. Tooltip renderer + i18n : clés FR/EN dans `packages/data/src/i18n/` (vérifier d'abord si tags auto-générés via flags move). Tags : « frappe la Défense », « ×2 sur Eau », « crash si raté **ou immunité** », « 1-3 coups (puissance croissante) ». Le tag crash doit mentionner l'immunité (cf risque game-designer).
8. Gate CI verte.
9. `implementations.md` : 348 → **354**. `plan 112` B1 : marquer 6 livrés + 3 différés (watch Champions).

## Risques / surveillance (game-designer)

- **Per-hit accuracy simplifiée** (move.accuracy brut, sans evasion/herbe haute) : accepté pour ce batch. Si l'herbe haute devient fréquente sur les maps → backlog « brancher la re-roll par coup sur `checkAccuracy` complet ».
- **Crash + tooltip immunité** : l'UI doit communiquer « crash si cible immunisée », pas seulement « si raté » (sinon expérience frustrante quand le joueur ne connaît pas le type adverse). Couvert étape 7.
- **Frappe Psy Mewtwo** (100 BP sur Déf physique, Atq Spé déjà énorme) : risque d'équilibrage en 6v6 sans clause légendaire. Mitigation : OP sets différés ; surveiller en playtest.
- **Lyophilisation × terrain Glace/Neige vs Eau/Vol** : multiplicateur cumulé jusqu'à ~×4.6 sur Artikodin. Fort mais légende — surveiller, pas bloquant.
- **Terrain Glace + crash** : crash = `DamageDealt {recoil}` sans déplacement → pas de glissade. Confirmer en test.

## Hors-scope

- OP sets utilisant ces moves (Mewtwo Frappe Psy, etc.) : ajout différé au batch contenu si besoin.
