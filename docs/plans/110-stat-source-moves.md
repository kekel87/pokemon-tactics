# Plan 110 — Moves stat-source (Bodypress + Tricherie)

> Statut : **done** (2026-06-04)
> Créé : 2026-06-04
> Phase : 4 — Gameplay Pokemon complet
> Prérequis : aucun (state-only — stats déjà sur `PokemonInstance`)
> Reviews : plan-reviewer + game-designer + move-pattern-designer (2026-06-04) — patterns Single 1-1 confirmés, crit normal confirmé, points canon intégrés.

## Objectif

Première famille « mécanique complexe » post-plan 109. Introduire l'**override de la stat
offensive** dans le calcul de dégâts : un move peut calculer ses dégâts à partir d'une stat
autre que l'Attaque/Atq.Spé du lanceur.

2 moves livrés (roster Gen 1 bien couvert) :

| Move (FR) | id | Cat / Type | BP / Acc / PP | Stat offensive utilisée |
|-----------|----|-----------|---------------|--------------------------|
| **Bodypress** | `body-press` | Phys / Combat | 80 / 100 / 10 | **Défense du lanceur** (+ crans de Déf du lanceur) |
| **Tricherie** | `foul-play` | Phys / Ténèbres | 95 / 100 / 15 | **Attaque de la cible** (+ crans d'Atq de la cible) |

Les deux restent **physiques** : la défense côté défenseur reste la Déf physique normale, le crit
fonctionne normalement, STAB calculé sur le type du lanceur, type-chart inchangé.

> **Crit normal (confirmé)** : la reference donne `critRatio: 1` (= baseline Showdown), mais
> `packages/data/src/loaders/load-moves.ts` **ne propage PAS** `critRatio`. Il n'est posé que via
> override `tactical.ts` explicite (les 6 high-crit le posent à `1` → stage 1 = 1/8). On **ne pose
> donc PAS** `critRatio` sur Bodypress/Tricherie → crit normal (stage 0 = 1/24), identique à Croc'
> Fatal (`crunch`). Aucune crainte de crit ×élevé sur un mur Déf.

### Pattern miroir

Exactement comme `dynamicPower` (plan 109) clone le move avec un `power` recalculé, ici on ajoute
un **champ déclaratif** `attackStatSource` lu **dans `calculateDamageWithCrit`** au moment de
choisir `attackStat` / `attackStage` (lignes 57-64 actuelles). Zéro nouvelle donnée d'instance,
zéro tracking, state-only.

### Hors scope (familles suivantes, mini-plans dédiés)

Inchangé vs roadmap : Poids (`weightkg` sur instance), Timing (tracking per-tour), Compteurs
(compteurs persistants), Terrain (après plan Champs/Terrains). Voir `docs/next.md`.

## Canon (vérifié Bulbapedia)

- **Bodypress** : utilise la **Défense** du lanceur (stat brute + crans de Défense) à la place de
  l'Attaque pour le calcul. C'est un move **physique** (défenseur = Déf physique). Affecté par la
  Brûlure du lanceur (halving Atk physique → ici sur la Déf utilisée). Empoigne-Roc / autres
  modificateurs de Déf du lanceur s'appliquent.
- **Tricherie** : utilise l'**Attaque de la cible** (stat brute + crans d'Atq de la cible) à la
  place de l'Attaque du lanceur. Les crans d'Atq **du lanceur sont ignorés**. Physique. Affecté
  par la Brûlure **du lanceur** (le statut du lanceur halve toujours, canon). Edge-case crit :
  canon ignore les crans d'Atq **négatifs de la cible** sur crit — **non implémenté v1**
  (simplification, aligné sur le fait que le code actuel n'ajuste pas non plus les crans d'attaque
  sur crit ; documenté comme déviation mineure).

### Interactions canon supplémentaires (audit game-designer)

- **Bagarre (`guts`)** : ×1.5 Atk si statut majeur. Bodypress ignore l'Atk du lanceur → Bagarre
  **ne doit PAS** booster Bodypress. À auditer : le hook `onDamageModify` de Bagarre lit-il l'Atk
  ou multiplie-t-il après coup ? Couvrir par un test (lanceur Bagarre + statut + Bodypress = pas de
  ×1.5).
- **Tricherie bloquée par Clonage** (`substitute`) : Tricherie a le flag `contact`, pas `bypasssub`
  → absorbée par le Clonage (déjà géré plan 099). **Couvrir dans le test positionnel** `foul-play`.
- **Tricherie + lanceur confus redirigé sur allié** : si la confusion redirige l'attaque vers un
  allié, `defender` devient l'allié → la stat offensive empruntée = Atq de l'**allié**. Comportement
  émergent acceptable (canon), pas de code dédié. Note de vigilance test.
- **Bandeau Choix (`choice-band`) sur la cible** : n'affecte PAS Tricherie (le `onDamageModify`
  item s'applique côté lanceur, pas côté stat empruntée). Canon. Pas d'action, juste vérifier que le
  hook item ne s'applique pas côté défenseur.

## Architecture

### Core

1. **`packages/core/src/enums/attack-stat-source.ts`** — const object pattern :
   ```ts
   export const AttackStatSource = {
     /** Use the user's Defense stat + Defense stages (body-press). */
     UserDefense: "user_defense",
     /** Use the target's Attack stat + Attack stages (foul-play). */
     TargetAttack: "target_attack",
   } as const;
   export type AttackStatSource = (typeof AttackStatSource)[keyof typeof AttackStatSource];
   ```
   Export public dans `index.ts` (data lit l'enum pour `tactical.ts`, le calculator le consomme).

2. **`packages/core/src/types/move-definition.ts`** — nouveau champ optionnel :
   ```ts
   /** Override the offensive stat used in the damage formula (body-press, foul-play). */
   attackStatSource?: AttackStatSource;
   ```

3. **`packages/core/src/battle/damage-calculator.ts`** — `calculateDamageWithCrit`, refonte du
   bloc lignes 57-64 :
   - Calcul par défaut inchangé (physique → Atk lanceur, spécial → Atq.Spé lanceur).
   - Si `move.attackStatSource === UserDefense` : `attackStat = attacker.combatStats.defense`,
     `attackStage = attacker.statStages.defense`.
   - Si `move.attackStatSource === TargetAttack` : `attackStat = defender.combatStats.attack`,
     `attackStage = defender.statStages.attack`.
   - `isPhysical` reste piloté par `move.category` (les deux sont `Physical` → défense côté
     défenseur = Déf physique, et le bloc Brûlure ligne 66-71 continue de s'appliquer puisqu'il
     lit `attacker.statusEffects` + `isPhysical`). **Pas de changement burn nécessaire** : Bodypress
     halve sa Déf utilisée (canon), Tricherie halve l'Atk empruntée selon le statut du lanceur (canon).
   - Helper local `resolveAttackStat(move, attacker, defender, isPhysical)` retournant
     `{ stat, stage }` pour garder la fonction lisible.

   Aucun nouveau paramètre de signature (le champ vit sur `move`, déjà passé). `estimateDamage`
   (IA + preview) bénéficie automatiquement — il appelle `calculateDamage` → `calculateDamageWithCrit`.

### Data

4. **`packages/data/src/.../tactical.ts`** (overrides tactiques) — 2 entrées :
   - `body-press` : `{ targeting: Single 1-1, attackStatSource: UserDefense, effects: [Damage] }`,
     type Combat, cat Phys, BP 80. Pattern : melee Single contact (à confirmer via
     `move-pattern-designer`).
   - `foul-play` : `{ targeting: Single 1-1, attackStatSource: TargetAttack, effects: [Damage] }`,
     type Ténèbres, cat Phys, BP 95, contact. Pattern Single (confirmer).

5. **`packages/data/src/i18n/moves.en.json`** — ajouter noms EN si absents (`Body Press`,
   `Foul Play`).

6. **🔴 Anomalie reference à corriger** : `reference/moves.json` donne `names.fr = "Big Splash"`
   pour `body-press` (faux — nom officiel FR = **Bodypress**). `foul-play` = "Tricherie" (OK).
   Vérifier `i18n/moves.fr.json` ; si le FR vient de reference, corriger la source ou ajouter
   override FR `Bodypress`. Lancer `data-miner` pour confirmer/fixer proprement.

### Renderer

7. **`MoveTooltip`** — nouveau tag descriptif (i18n) :
   - Bodypress : « Dégâts basés sur la Défense »
   - Tricherie : « Dégâts basés sur l'Attaque de la cible »
   Helper `attackStatSource` → clé i18n. Tags FR/EN.

### IA

8. `estimateDamage` route déjà le bon stat → le scoring agressif voit la vraie menace **sans code
   IA dédié**. Vérifier qu'aucun chemin de scoring ne lit `attacker.combatStats.attack` en dur pour
   estimer ces moves (sinon Bodypress sur un mur Déf serait sous-évalué). Audit rapide
   `action-scorer` / `aggressive-ai` / `threat-detection` — si lecture stat brute, basculer sur
   `estimateDamage`.

## Tests (test-writer, test-first)

Règle dure plan 108 : **1 fichier test positionnel par move**.

- `packages/core/src/battle/moves/body-press.test.ts` — touche/touche pas selon position +
  **dégâts calculés depuis la Défense** (mon haute Déf / basse Atk fait plus de dégâts que son Atk
  ne le permettrait ; crans de Déf +2 augmentent les dégâts ; crans d'Atq du lanceur sans effet).
- `packages/core/src/battle/moves/foul-play.test.ts` — dégâts depuis l'**Atq de la cible** (cible
  haute Atq → gros dégâts même si lanceur faible Atq ; +2 Atq cible augmente ; crans d'Atq lanceur
  sans effet ; cible avec Atq abaissée → dégâts réduits).
- Unit `damage-calculator` : `resolveAttackStat` les 3 cas (défaut / UserDefense / TargetAttack),
  + interaction Brûlure (lanceur brûlé → halving s'applique aux deux moves).
- Meta-test `move-test-coverage` reste vert (2 nouveaux fichiers = 2 nouveaux moves).
- `BattleEngine.integration.test.ts` : bump count moves (342 → 344).

## Décisions (tranchées post-review)

1. **Patterns tactiques** : ✅ **Single 1-1 contact** pour les deux (validé `move-pattern-designer` :
   Bodypress = écrasement corporel melee, famille Plaquage/Coup d'Boule ; Tricherie = saisie/retournement
   au corps-à-corps, famille Croc'/Tranche). Pas de range étendu.
2. **Crit ignore crans Atq négatifs cible (Tricherie)** : ✅ **différé** (déviation mineure documentée,
   cohérent avec le code crit actuel qui n'ajuste pas les crans d'attaque sur crit).
3. **Fix nom FR `body-press`** : ✅ **override i18n FR** `Bodypress` (un seul mot, nom officiel).
   reference + `i18n/moves.fr.json` donnent tous deux "Big Splash" (bug). Override sûr, pas de re-fetch.
   + ligne backlog signalant le bug reference.
4. **OP sets** : ✅ **optionnel, post-impl** — 2-3 sets (Bodypress sur mur Déf type Tortank/Ronflex ;
   Tricherie sur lanceur Ténèbres ciblant physiques Atq haute). Pas bloquant.

> ⚠️ **Correction game-designer** : Tricherie punit les **attaquants physiques à haute Atq**
> (Rhinoféros, Mackogneur, Kangourex post-Danse-Lames), **pas** les attaquants spéciaux frêles
> (Alakazam/Ectoplasma ont une Atq faible → Tricherie y est inefficace). Le tag tooltip et les OP
> sets doivent refléter ce cas d'usage.

## Étapes

- [ ] Créer `packages/core/src/enums/attack-stat-source.ts` (const object pattern) + export `index.ts`
- [ ] Ajouter `attackStatSource?: AttackStatSource` à `MoveDefinition`
- [ ] **Audit IA** — grep `combatStats.attack` / `combatStats.spAttack` hardcodé dans
      `action-scorer` / `aggressive-ai` / `threat-detection`. Vérifier que Bodypress/Tricherie sont
      évalués via `estimateDamage` (route auto la bonne stat), pas via lecture stat brute. Corriger si besoin.
- [ ] Refactor `calculateDamageWithCrit` lignes 57-64 + helper `resolveAttackStat(move, attacker, defender, isPhysical)` → `{ stat, stage }` (3 cas : défaut / UserDefense / TargetAttack)
- [ ] Audit hook Bagarre (`guts`) : confirmer qu'il ne booste pas Bodypress (Atk lanceur ignorée)
- [ ] Tests unit `damage-calculator.test.ts` : `resolveAttackStat` 3 cas + interaction Brûlure (lanceur brûlé → halving)
- [ ] Data : `body-press` + `foul-play` dans `tactical.ts` (Single 1-1 contact, **pas de critRatio**)
- [ ] Data : override i18n FR `Bodypress` + EN si absent + backlog bug reference "Big Splash"
- [ ] Tests positionnels :
      - `packages/core/src/battle/moves/body-press.test.ts` (position + dégâts depuis Déf + crans Déf +2 + crans Atq lanceur sans effet)
      - `packages/core/src/battle/moves/foul-play.test.ts` (dégâts depuis Atq cible + cible +2/-stage Atq + crans Atq lanceur sans effet + **bloqué par Clonage**)
- [ ] Renderer `MoveTooltip` : tags FR/EN ("Dégâts basés sur la Défense" / "…sur l'Attaque de la cible")
- [ ] Bump count moves `BattleEngine.integration.test.ts` (342 → 344) + vérifier `move-test-coverage` vert
- [ ] (Optionnel) 2-3 OP sets
- [ ] CI gate : lint + typecheck + build + test + test:integration

## Estimation

~Petit. 1 enum + 1 champ + 1 bloc calculator + 2 entrées data + 1 fix i18n + tags tooltip + tests.
Aucun nouveau système, aucune donnée d'instance, pas de tracking. Moteur calculator déjà en place.
