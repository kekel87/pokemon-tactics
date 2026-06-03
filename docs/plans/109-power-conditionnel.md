# Plan 109 — Power conditionnel (moteur `dynamicPower` + 12 moves state-only)

> Statut : **done** (2026-06-03)
> Créé : 2026-06-03
> Phase : 4 — Gameplay Pokemon complet
> Prérequis : aucun (state-only)

## Objectif

Introduire un **moteur générique de puissance dynamique** (`dynamicPower`) : la puissance d'un move
est recalculée au moment du hit à partir de l'état de combat, au lieu d'être figée dans la reference.

Pattern miroir exact de `resolveWeatherBallMove` (`handle-damage.ts:30`) : on **clone le `MoveDefinition`
avec un `power` recalculé** avant l'appel à `calculateDamageWithCrit`.

Ce plan livre le moteur réutilisable + **12 moves dont la formule ne lit que de l'état déjà présent**
sur `PokemonInstance` (statut, stat stages, HP, objet tenu, vitesse). Zéro nouvelle donnée, zéro
nouveau tracking.

### Hors scope (follow-ups dédiés)

`docs/roadmap.md` regroupe ces familles ; chacune devient un mini-plan après celui-ci :

- **Stat-source** — Bodypress (`body-press`, utilise Déf), Tricherie (`foul-play`, Atq cible) → override stat d'attaque dans `damage-calculator`.
- **Poids** — Coup Bas (`low-kick`), Éco-Sphère (`grass-knot`), Tacle Lourd (`heavy-slam`), Choc Thermique (`heat-crash`) → porter `weightkg` sur `PokemonInstance` (présent en reference, absent de l'instance).
- **Timing** — Repli (`avalanche`), Vendetta (`payback`), Revanche (`revenge`), Pied Voltige (`stomping-tantrum`) → tracking per-tour (frappé / a agi avant / dernier move échoué).
- **Compteurs** — Poing Rageur (`rage-fist`), Écho (`echoed-voice`), Chœur (`round`), Dernier Recours (`last-resort`), Représailles (`retaliate`) → compteurs persistants.
- **Terrain** — Volt Croisé (`rising-voltage`), Force Ajoutée n'est PAS terrain… → `expanding-force`, Telluri-Pulse (`terrain-pulse`) → après le plan Champs/Terrains.

Hors-roster (non learnable Gen 1, ignorés) : `power-trip`, `last-respects`, `fishious-rend`, `bolt-beak`, `eruption`.
Déjà livré : `weather-ball` (plan 084).

## Les 12 moves

Tous learnable par le roster (vérifié via `reference/indexes/pokemon-by-move.json`). Base power
issue de `reference/moves.json` (alignée Champions).

| Move (FR) | id | Cat / Type | Base | Formule de puissance |
|-----------|----|-----------|------|----------------------|
| Façade | `facade` | Phys / Normal | 70 | ×2 si statut majeur sur soi (Brûlure/Poison/Poison grave/Paralysie). **+ ignore la baisse d'Atk de Brûlure** (canon). |
| Châtiment | `hex` | Spé / Spectre | 65 | ×2 si la cible a un statut majeur. |
| Choc Venin | `venoshock` | Spé / Poison | 65 | ×2 si la cible est empoisonnée (Poison ou Poison grave). |
| Acrobatie | `acrobatics` | Phys / Vol | 55 | ×2 si le lanceur ne tient aucun objet (`heldItemId` absent). |
| Force Ajoutée | `stored-power` | Spé / Psy | 20 | `20 + 20 × (somme des crans de stat **positifs** du lanceur)`. |
| Boule Élek | `electro-ball` | Spé / Élec | null | Selon ratio `vitesse soi / vitesse cible` : ≥4→150, ≥3→120, ≥2→80, ≥1→60, sinon 40. |
| Gyroballe | `gyro-ball` | Phys / Acier | null | `min(150, floor(25 × vitesse cible / vitesse soi + 1))`. Cas limite `vitesse soi = 0 → 1`. ⚠️ le `+1` est canon (vérifié reference). |
| Gigotage | `flail` | Phys / Normal | null | Selon HP% bas du lanceur (table 48èmes, voir plus bas). |
| Contre | `reversal` | Phys / Combat | null | Même table HP% que Gigotage. |
| Saumure | `brine` | Spé / Eau | 65 | ×2 si HP cible ≤ 50%. |
| Pression Extrême | `hard-press` | Phys / Acier | null | `max(1, floor(100 × HP cible / HP max cible))` → 1..100. |
| Giclédo | `water-spout` | Spé / Eau | 150 | `max(1, floor(150 × HP soi / HP max soi))`. |

**Table HP% (Gigotage / Contre)** — `p = floor(48 × currentHp / maxHp)` :
`p ≤ 1 → 200`, `≤ 4 → 150`, `≤ 9 → 100`, `≤ 16 → 80`, `≤ 32 → 40`, sinon `20`.

> ⚠️ `electro-ball`/`gyro-ball`/`flail`/`reversal`/`hard-press` ont `power: null` en reference →
> `loadMovesFromReference` produit `power: 0` → `calculateDamageWithCrit` **return 0 dégâts si
> `move.power === 0`** (`damage-calculator.ts:47`). Le resolver DOIT donc poser un `power > 0`
> avant l'appel (exactement comme `resolveWeatherBallMove`). Sécurité : si une formule donne 0,
> clamp à 1.

## Architecture

### Core — nouveau moteur

1. **`packages/core/src/enums/dynamic-power-kind.ts`** — const object pattern :
   `SelfStatusDouble, TargetStatusDouble, TargetPoisonedDouble, NoHeldItemDouble, StoredPower,
   SpeedRatio, SpeedRatioInverse, LowHpSelf, TargetHpHalfDouble, TargetHpScaled, SelfHpScaled`.
   **Exports `index.ts`** : `DynamicPowerKind`, `DynamicPowerSpec`, `resolveDynamicPower` (publics —
   data lit le type/enum, damage-calculator + handle-damage appellent le resolver).

2. **`packages/core/src/types/dynamic-power-spec.ts`** — `interface DynamicPowerSpec { kind: DynamicPowerKind }`
   (pas de params pour ce batch ; champ ouvert pour extension future). 1 fichier = 1 type.

3. **`MoveDefinition.dynamicPower?: DynamicPowerSpec`** (`packages/core/src/types/move-definition.ts`).

4. **`packages/core/src/battle/dynamic-power-system.ts`** — registry de resolvers (pas de `switch`,
   conforme `.claude/rules/core.md`). `Map<DynamicPowerKind, DynamicPowerResolver>` où
   `DynamicPowerResolver = (input: { move, attacker, target }) => number`.
   Export `resolveDynamicPower(move, attacker, target): MoveDefinition` :
   - si `!move.dynamicPower` → retourne `move` inchangé ;
   - sinon clone `{ ...move, power: max(1, resolver(...)) }`.
   Vitesse effective via `getEffectiveStat(combatStats.speed, statStages.speed)` (`stat-modifier.ts`).
   Statut via `attacker.statusEffects` / `target.statusEffects` (enum `StatusType`).

5. **Application au hit** — `handle-damage.ts` `dealSingleHit` : appeler `resolveDynamicPower` sur le
   move **après** `resolveWeatherBallMove` (mutuellement exclusifs en pratique), avant
   `calculateDamageWithCrit`. Chaîner : `const resolvedMove = resolveDynamicPower(resolveWeatherBallMove(context.move, weather), attacker, target)`.
   **Multi-hit** : `dealSingleHit` est appelé par hit, donc la puissance est re-résolvée à chaque coup.
   Pour les 12 moves de ce batch (aucun n'est multi-hit), comportement neutre. Documenter que la
   résolution est par-hit (cohérent si un futur multi-hit a une formule HP-dépendante).

6. **Application à l'estimation** — `damage-calculator.ts` `estimateDamage` : résoudre `dynamicPower`
   en tête (clone) avant les calculs min/max. **Indispensable** : l'IA (`action-scorer`) et la preview
   dégâts renderer passent par `estimateDamage` ; sans ça `stored-power` (base 20) ou `electro-ball`
   (base 0) seraient massivement sous-évalués.

7. **Façade ignore la baisse d'Atk de Brûlure** — `damage-calculator.ts:65-70` halve l'Atk si brûlé.
   Exemption via flag déclaratif **`MoveDefinition.ignoresBurnAttackDrop?: boolean`** (D1) : la
   condition de halving devient `isBurned && isPhysical && !gutsIgnoresBurn && !move.ignoresBurnAttackDrop`.
   `facade` porte le flag dans `tacticalOverrides`. Passthrough `load-data` + `TacticalOverride`.

### Data

8. **`TacticalOverride`** (`packages/data/src/overrides/tactical.ts`) : ajouter `dynamicPower?: DynamicPowerSpec`
   et `ignoresBurnAttackDrop?: boolean`.

9. **12 entrées** dans `tacticalOverrides` : `{ targeting: <pattern>, effects: [{ kind: Damage }], dynamicPower: { kind: ... } }`.
   `facade` porte en plus `ignoresBurnAttackDrop: true`. Portées (`targeting`) assignées via l'agent
   `move-pattern-designer` au lancement (la plupart = Single mêlée/portée courte ;
   `electro-ball`/`gyro-ball`/`water-spout` = projectiles → portée moyenne ; `water-spout` canon =
   tous ennemis adjacents → Cone/Zone à confirmer).

10. **Passthrough loader** — `load-data.ts:60` (bloc de spread conditionnel) : ajouter
    `...(merged.dynamicPower ? { dynamicPower: merged.dynamicPower } : {})` et
    `...(merged.ignoresBurnAttackDrop ? { ignoresBurnAttackDrop: true } : {})`.

11. **i18n** — noms EN dans `packages/data/src/i18n/moves.en.json` si absents (FR présents en reference).
    Vérifier les 12 ids.

### Renderer (léger)

12. **`MoveTooltip`** — tag `⚡ Puissance variable` quand `move.dynamicPower` présent (i18n
    `moveTooltip.tag.dynamicPower` FR/EN). La preview dégâts est déjà correcte (passe par `estimateDamage`).

### IA

13. **`action-scorer` lit `move.power` brut à 3 endroits** (`move.power === 0` pour distinguer
    self-stat moves / skip scoring dégâts / skip threat-detection). Avec `power: 0` en reference pour
    `electro-ball`/`gyro-ball`/`flail`/`reversal`/`hard-press`, ces checks classeraient à tort ces moves
    comme « sans dégâts ». **Fix** : helper `getEffectivePowerFloor(move): number` (retourne `move.power`,
    ou `1` si `move.dynamicPower` présent) utilisé aux 3 call sites. Le scoring fin reste correct via
    `estimateDamage` (qui résout `dynamicPower`) — le floor sert juste à ne pas exclure le move.
    Grep `action-scorer` / `scored-ai` pour recenser tous les `move.power` bruts avant impl.

## Tests

⚠️ Le garde-fou `move-test-coverage.test.ts` (plan 108) **échoue la CI** si un move implémenté n'a
pas de fichier `packages/core/src/battle/moves/<id>.test.ts`. Les 12 fichiers sont **obligatoires**.

1. **`dynamic-power-system.test.ts`** (unit) — un cas par resolver : seuils, clamp à 1, ratio vitesse
   (égalité, extrêmes), table HP%, somme stages positifs (ignore négatifs).
   **Sanity** : chaque resolver retourne toujours `≥ 1` après clamp (aucun edge case ne renvoie 0/négatif).
   **Gyroballe** : tester `vitesse soi = 0 → 1` et le `+1` (vitesses égales → `floor(25+1)=26`).
2. **12 fichiers `moves/<id>.test.ts`** (positionnels bout-en-bout, règle plan 108) : touche/touche pas
   + puissance effective via dégâts comparés (état actif vs inactif). Ex : `facade` inflige ~2× plus
   si le lanceur est empoisonné ; `brine` ~2× si cible ≤50% HP.
3. **`estimateDamage`** — couvrir qu'il reflète `dynamicPower` (au moins 1 cas, ex `stored-power` boosté).
4. Compteur de moves dans `BattleEngine.integration.test.ts` : **330 → 342** (vérifier
   `loadData().moves.length` réel avant, asserter le total exact).
5. **Golden replay** (`golden-replay.test.ts`, figé plan 107) : les 12 moves ne sont pas dans
   `GOLDEN_MOVESETS` → zéro impact attendu. Vérifier juste que le test passe au gate. Note : si un jour
   un move à `dynamicPower` entre dans le golden replay, ses dégâts deviennent état-dépendants → régénérer.

## Décisions actées

- **D1 — Façade / burn drop** ✅ : flag déclaratif `MoveDefinition.ignoresBurnAttackDrop?: boolean`
  (réutilisable, data-driven). Cf. archi #7.
- **D2 — `DynamicPowerSpec`** ✅ : `interface DynamicPowerSpec { kind: DynamicPowerKind }` (extensible
  pour params futurs : seuils custom, multiplicateurs).
- **D3 — Portées** : déléguée à `move-pattern-designer` au lancement de l'exécution (pas figée ici).

## Étapes d'exécution (ordre)

1. Enum + type + champ `MoveDefinition` + `dynamic-power-system.ts` + registry resolvers.
2. Tests unit `dynamic-power-system.test.ts` (test-first).
3. Brancher `resolveDynamicPower` dans `handle-damage` + `estimateDamage` + exemption burn Façade (D1).
4. Data : `TacticalOverride.dynamicPower` + 12 entrées + passthrough `load-data` + i18n EN.
5. 12 fichiers `moves/<id>.test.ts` + ajustement compteur intégration.
6. Renderer : tag `MoveTooltip` + i18n.
7. Gate CI : `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

## Fichiers touchés (prévision)

**Core** : `enums/dynamic-power-kind.ts` (new), `types/dynamic-power-spec.ts` (new),
`types/move-definition.ts` (`dynamicPower?` + `ignoresBurnAttackDrop?`), `battle/dynamic-power-system.ts` (new),
`battle/handlers/handle-damage.ts`, `battle/damage-calculator.ts` (estimate + exemption burn),
`ai/action-scorer.ts` (helper `getEffectivePowerFloor`), `index.ts` (exports),
`battle/dynamic-power-system.test.ts` (new), 12× `battle/moves/<id>.test.ts` (new).

**Data** : `overrides/tactical.ts`, `load-data.ts`, `i18n/moves.en.json`,
`team/__tests__/...` si compteur, `BattleEngine.integration.test.ts` (compteur).

**Renderer** : `MoveTooltip`, i18n FR/EN (`moveTooltip.tag.dynamicPower`).

## Suivi roadmap / docs

- `docs/roadmap.md` : cocher la sous-partie « Power conditionnel » correspondant aux 12 livrés, noter
  les familles restantes en follow-ups.
- `STATUS.md` + `docs/next.md` : total moves 330 → 342, plan 109 done.
- `docs/implementations.md` : 12 moves + mécanique `dynamicPower`.
- `docs/decisions.md` : D1/D2 actées.
</content>
</invoke>
