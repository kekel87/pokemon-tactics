# Plan 116 — B2 « Soin » (11 moves)

> **Statut : done** (livré 2026-06-07)
> Vague 1 de la roadmap maître **plan 112**. Dernier batch de la vague 1 (après B1/113, B3/115).
> Total moves visé : 371 → **382** (+11).
> Décisions de scope + adaptations tactiques validées humain 2026-06-07 (voir ci-dessous).

## Objectif

Livrer **11 moves de soin**. Le jeu a très peu de soin aujourd'hui (Soin/Synthèse/Repos/Atterrissage + drains + Restes). Ce batch ouvre un vrai **rôle support healer** : soin ciblé à distance, soin de zone alliée, soin différé télécommandé, soin sur la durée, et soin de statut d'équipe.

Le cœur du batch = **généralisation du soin** : aujourd'hui `EffectKind.HealSelf` ne soigne que le lanceur. On ajoute un soin qui cible **la cible résolue du move** (allié OU ennemi), un soin **de zone alliée**, un soin **sur la durée** (HoT volatile) et un soin **différé** qui suit le Pokemon.

Mécaniques wiki vérifiées (Bulbapedia gen 8/9) — voir tableau.

## Moves livrés (11)

Noms FR officiels (source `reference/moves.json` `names.fr`).

| FR | ID EN | Type | Cat | Pattern | Mécanique (adaptée grille) |
|----|-------|------|-----|---------|----------------------------|
| **É-Coque** | `soft-boiled` | Normal | Statut | Self | Soin **50 %** PV max du lanceur |
| **Paresse** | `slack-off` | Normal | Statut | Self | Soin **50 %** PV max du lanceur |
| **Racines** | `ingrain` | Plante | Statut | Self | Volatile **HoT 1/8** PV max/tour **si immobile ce tour** + **ancrage** (perd l'immunité Vol/Lévitation/Vol Magnétik tant qu'actif) |
| **Anneau Hydro** | `aqua-ring` | Eau | Statut | Self | Volatile **HoT 1/16** PV max/tour **inconditionnel** |
| **Vibra Soin** | `heal-pulse` | Psy | Statut | Single 1-4 | Soin **50 %** PV max de la **cible** (allié **ou ennemi** — risque assumé) |
| **Fontaine de Vie** | `life-dew` | Eau | Statut | Zone (rayon lanceur) | Soin **25 %** PV max de **tous les alliés** dans le rayon |
| **Vœu** | `wish` | Normal | Statut | Single allié 1-3 (soi inclus) | Soin **différé** = **50 % PV max du lanceur**, appliqué au **prochain tour** de la cible, **suit le Pokemon** |
| **Aromathérapie** | `aromatherapy` | Plante | Statut | Zone (rayon lanceur) | Guérit les **statuts majeurs** de tous les alliés dans le rayon |
| **Vole-Force** | `strength-sap` | Plante | Statut | Single 1-3 | Soin du lanceur **= valeur d'Attaque effective de la cible** + **Atq cible −1** |
| **Dévorêve** | `dream-eater` | Psy | Spé | Single 1-3 | Dégâts (100 BP) + **drain 0,5**, utilisable **seulement si la cible dort** (échoue sinon) |
| **Boule Pollen** | `pollen-puff` | Insecte | Spé | **Blast r1** (bombe, portée 1-4, explosion r1) | Bombe de pollen : **chaque ennemi** dans l'explosion subit des dégâts (90 BP), **chaque allié** est soigné **50 %** PV max (gate `appliesIf` par cible). *(Ajusté playtest 2026-06-07 : « boule de pollen explosive » → pattern Blast, pas Single.)* |

> Learners roster : à confirmer via le script de learnsets avant de figer les patterns (`move-pattern-designer` valide). Candidats probables : É-Coque/Paresse/Vœu → **Leveinard** (Chansey, ~310 PV niv. 50)/Ronflex/Mélodelfe ; Racines/Aromathérapie/Vole-Force → Plante (Empiflor a `strength-sap`) ; Dévorêve → Psy/Spectre ; Boule Pollen → Insecte ; Vibra Soin → support Psy ; Fontaine de Vie → Eau. (Blissey/Leuphorie = Gen 2, **hors roster Gen 1**.)

## Décisions de scope & adaptations tactiques (validées humain 2026-06-07)

1. **Découpage** : **1 seul plan 116** (les moves partagent la généralisation du soin → cohérent).
2. **Vœu** : cible un **allié (ou soi)**, soin **différé d'un tour** = **50 % PV max du lanceur** (figé à la pose), appliqué au **prochain tour de la cible**, et **suit le Pokemon** (pas la tuile). Move support clé vu la rareté du soin. Portée de pose **r3**. Fenêtre de punition d'1 tour assumée comme garde-fou.
3. **Fontaine de Vie + Aromathérapie** : **rayon autour du lanceur** (récompense le placement groupé), pas « toute l'équipe ». Rayon **Manhattan r2**. Ciblage = Self, mais le **renderer affiche le diamant de rayon** (preview bleue) à la sélection — `GameController.getSelfRadiusEffect` (ajusté playtest 2026-06-07 : l'humain veut voir la zone d'effet).
4. **Racines** vs **Anneau Hydro** : montants **différenciés** — Racines **1/8** (conditionnel « immobile »), Anneau Hydro **1/16** (inconditionnel). Sinon Racines serait strictement pire tant que B20 n'existe pas.
5. **Racines — soin conditionnel au mouvement** : le tick end-turn ne soigne **que si le Pokemon n'a pas bougé ce tour** (déplacement volontaire **ou** knockback subi → pas de soin ce tour-là, mais le volatile **persiste**). Flavor « tu t'enracines pour régén, mais figé = exposé » (très FFTA).
6. **Racines — ancrage** : tant que le volatile est actif, le Pokemon **perd ses immunités liées au vol** (type Vol immunisé au Sol, talent **Lévitation**, futur **Vol Magnétik**/Magnet Rise) → il devient ciblable au sol et soumis au terrain. **Garde son type Vol défensif** (contrairement à Atterrissage/roost qui le retire). Forward : objet **Grosse Racines** (Big Root, +30 % soin HoT/drain) à prévoir dans un futur batch objet.
7. **Vibra Soin** : soin **à distance**, **pas sur soi**, peut cibler **les ennemis aussi** (« faut faire attention ^^ ») — le joueur peut se tromper de camp.
8. **Dévorêve** : échoue (aucun dégât) si la cible **n'est pas endormie** — gate côté usage + résolution.
9. **Boule Pollen** : effet conditionnel selon le camp de la cible (allié → soin, ennemi → dégâts), implémenté via le mécanisme `appliesIf` posé en **B3 (plan 115)**.
10. **PP — pas de garde-fou** (humain 2026-06-07) : le système de PP va être **retiré bientôt** avec l'ancien mode de tours round-based (cf. roadmap). On **n'ajoute aucun override PP** anti-stall. Si stall en playtest, on régule par les autres garde-fous (rayon, délai Vœu, immobilité Racines) ou l'équilibrage post-suppression PP.

## Systèmes moteur à construire

### 1. Soin de cible générique — `EffectKind.HealTarget`

Aujourd'hui `EffectKind.HealSelf` soigne `context.attacker` (`handle-heal-self.ts:28-50`). On ajoute **`EffectKind.HealTarget { percent }`** qui soigne `context.target` de `floor(target.maxHp * percent)` (clamp `maxHp - currentHp`, jamais d'overheal), émet `BattleEventType.HpRestored`.

- Utilisé par **Vibra Soin** (0.5), **Fontaine de Vie** (0.25, appliqué à chaque allié de la zone), **Boule Pollen** branche alliée (0.5, gardée par `appliesIf: target_is_ally`).
- `HealSelf` reste pour les self-heals (É-Coque, Paresse) — pas de churn inutile.
- **Substitute** : le soin de cible n'est **pas** bloqué par le Clone (on soigne les PV réels, pas une attaque). `HealTarget` n'emprunte **pas** le routage de `handle-damage` (`shouldSubstituteBlock`) → aucun risque d'absorption par le sub. Flag réf `heal`/`bypasssub` cohérent. (Dévorêve, lui, passe par `Damage` → le sub bloque le drain comme tout move offensif, parité.)

### 2. Soin sur la durée (HoT) — volatiles + handler end-turn

- Deux volatiles **persistants** (non tickés-décrémentés) : `StatusType.Ingrain` (Racines), `StatusType.AquaRing` (Anneau Hydro). **Décidé** : posés via un **`EffectKind` dédié `PostHealOverTime { kind: Ingrain | AquaRing }`** (cohérent avec le pattern `PostSubstitute`/`PostAura`/`PostCharge` existant, plus type-safe qu'un `Status` volatile détourné). Le volatile a `remainingTurns: undefined` → non décrémenté par `timed-volatile` (comme `Charged` plan 115).
- Nouveau handler end-turn **`hot-tick-handler.ts`** (priorité ~**250**, après Graine/`seeded` 200, avant pièges 300) :
  - `AquaRing` présent → soigne `max(1, floor(maxHp/16))`, émet `HpRestored`.
  - `Ingrain` présent : si **`pokemon.movedThisTurn === true`** → **déracinement** : le volatile `Ingrain` est **retiré** (`StatusRemoved`), pas de soin ce tour. Sinon → soigne `max(1, floor(maxHp/8))`, émet `HpRestored`. **(Ajusté playtest 2026-06-07 : se déplacer ou subir un knockback arrache les racines — Racines disparaît, il faut le relancer. Plus lisible que « persiste mais ne soigne pas ».)**
  - Cumulable (un mon peut tenir les deux). Clamp `maxHp`.
- **`movedThisTurn?: boolean`** sur `PokemonInstance` : mis `true` à **tout changement de position** — déplacement volontaire (`BattleEngine.ts:1256`), **knockback subi** (`handle-knockback.ts:207`) **et glissade sur glace** (`performIceSlide`, `handle-knockback.ts:107`). **Reset au début de chaque tour** dans `executeStartTurn` (exactement le même point que le reset `hasFreshStatBoost` du plan 115). Le reset (start-turn) précède le tick HoT (end-turn, prio 250) du même acteur → ordre correct : un mon qui ne bouge pas de tout son tour conserve `movedThisTurn = false` jusqu'au tick.
- **Ancrage Racines** : `effective-flying.ts` — `isEffectivelyFlying` retourne `false` si le mon a le volatile `Ingrain` (grounding). **Ne pas** toucher `getEffectiveTypes` (Racines garde son type Vol défensif). Étendre `isEffectivelyFlying` pour qu'il prenne aussi en compte `Ingrain` à côté de `isRoosted`. Couvre l'immunité Sol, Lévitation (déjà lue dans `isEffectivelyFlying`), terrain.
- **`handleKo`** : nettoyer les volatiles (déjà fait pour `volatileStatuses` plan 101) — vérifier que Ingrain/AquaRing partent au KO.

### 3. Soin différé — Vœu

- Champ par-mon **`pendingWish?: { healAmount: number; castAtAction: number }`** sur `PokemonInstance`. `healAmount = floor(caster.maxHp * 0.5)` **figé à la pose**. `castAtAction = state.actionCounter` **au moment de la pose** (valeur AVANT l'incrément de fin d'action du plan 115).
- **Déclenchement** : dans `executeStartTurn` de la cible, si `pendingWish && state.actionCounter > pendingWish.castAtAction` → soigne `min(healAmount, maxHp - currentHp)`, émet `HpRestored`, efface `pendingWish`. Suit le Pokemon (stocké sur le mon, pas la tuile).
- **Pourquoi `>` (pas `>=`) à `castAtAction`** : `actionCounter` s'incrémente **en fin d'action** (plan 115). Le start-turn de l'action de pose est déjà passé ; la **prochaine** action complétée par n'importe qui incrémente `actionCounter` → au prochain start-turn de la cible, `actionCounter > castAtAction` est vrai. Garantit « **prochain tour de la cible**, jamais le tour de la pose » dans les **deux loops** (round + CT). Cas auto-Vœu (cible = lanceur) : son start-turn courant est antérieur à la pose → ne déclenche pas ; déclenche au tour suivant. **Couvert par test système round + CT obligatoire** (cf. risques).
- **Écrasement** : une nouvelle pose de Vœu sur un mon ayant déjà un `pendingWish` non déclenché **remplace** (pas de stack) — parité Showdown.
- **KO** : `handleKo` efface `pendingWish`.
- Cible : allié OU soi (`targetsAlly: true`, pas d'ennemi), portée r3.

### 4. Guérison de statut d'équipe — `EffectKind.CureTeamStatus`

- Aromathérapie : énumère les **alliés vivants dans le rayon** (Manhattan r2 autour du lanceur, **lanceur inclus**), vide leur `statusEffects` (statuts **majeurs** : Brûlure/Poison/Paralysie/Sommeil/Gel). Émet `StatusRemoved` par statut guéri.
- **Ne touche pas** les volatiles (confusion, etc.) — parité (Heal Bell/Aromatherapy = statut majeur seul).
- Réutilise l'énumération de zone alliée de **Fontaine de Vie** (même helper « alliés dans rayon r2 »).

### 5. Soin basé sur une stat — Vole-Force

- **`EffectKind.HealByTargetStat { stat: StatKind }`** : soigne le lanceur de la **valeur de stat effective de la cible** (Attaque, crans de stat inclus) — pas un % ni un montant fixe. Réutilise le calcul de stat effective (`derivedStats` + stages) déjà présent pour le damage-calc.
- Effets du move : `[{ HealByTargetStat: Attack }, { StatChange Attack -1 (cible) }]`. **Ordre** : soin d'abord (lit l'Atq avant la baisse), baisse ensuite.
- **Échec partiel** : si l'Atq de la cible est déjà à −6, la baisse échoue mais le soin s'applique quand même (parité). Si le lanceur est déjà à PV plein, le soin = 0 mais la baisse s'applique.
- Type Plante, statut, `acc: 100` (le seul move de soin du batch avec un jet de précision).
- Interaction **Mist/Safeguard** (plan 098) : la baisse d'Atq est bloquée si la cible est protégée → réutilise `isProtectedFromStatDecrease`.

### 6. Gate « cible endormie » — Dévorêve

- Nouveau flag **`requiresTargetAsleep?: boolean`** (`MoveDefinition` + miroir `TacticalOverride`). Pendant `b3` on a posé `requiresAsleep` (lanceur) ; ici c'est **côté cible**.
- **Résolution** : si la cible n'a pas le statut `Asleep` → le move **échoue** (aucun dégât, aucun drain), émet un évènement d'échec (`MoveFailed`/réutiliser le canal d'échec existant). Garde dans la résolution d'effet (pas seulement `getLegalActions` : la cible peut se réveiller entre la sélection et la résolution).
- Si endormie → Dégâts (100 BP) + Drain 0.5 standard (`EffectKind.Damage` + `EffectKind.Drain`, déjà existants).

### 7. Effet conditionnel selon le camp — Boule Pollen

- Réutilise le mécanisme **`Effect.appliesIf?: ConditionKind`** introduit en **B3 (plan 115)**. On **étend le const-object `ConditionKind`** (`packages/core/src/enums/condition-kind.ts`) avec deux entrées : `TargetIsAlly: "target_is_ally"` et `TargetIsEnemy: "target_is_enemy"`. L'évaluateur de condition gagne deux cas (`attacker.playerId === target.playerId` ⇒ ally).
- Effets : `[{ Damage, appliesIf: target_is_enemy }, { HealTarget 0.5, appliesIf: target_is_ally }]`. La condition gate chaque effet (pas de proba).
- Targeting : Single 1-4, `targetsAlly: true` (peut viser allié ou ennemi). Flag `bullet` (réf).

## Couche de données (`tactical.ts`)

```ts
"soft-boiled":  { Self, effects: [HealSelf 0.5] },
"slack-off":    { Self, effects: [HealSelf 0.5] },
ingrain:        { Self, effects: [PostHealOverTime Ingrain] },
"aqua-ring":    { Self, effects: [PostHealOverTime AquaRing] },
"heal-pulse":   { Single 1-4, targetsAlly: true, effects: [HealTarget 0.5] },
"life-dew":     { Zone rayon r2 alliés, effects: [HealTarget 0.25 (par allié)] },
wish:           { Single 1-3 allié/soi, targetsAlly: true, effects: [PostWish 0.5 caster maxHp] },
aromatherapy:   { Zone rayon r2 alliés, effects: [CureTeamStatus] },
"strength-sap": { Single 1-3, acc 100, effects: [HealByTargetStat Attack, StatChange Attack -1 (cible)] },
"dream-eater":  { Single 1-3, requiresTargetAsleep: true, effects: [Damage, Drain 0.5] },
"pollen-puff":  { Single 1-4, targetsAlly: true,
                  effects: [Damage appliesIf:target_is_enemy, HealTarget 0.5 appliesIf:target_is_ally] },
```

> Flags `heal`/`bypasssub`/`bullet`/`pulse` auto-chargés depuis la réf (loader `extractFlags`). Volatiles HoT et Vœu = `EffectKind` dédiés (`PostHealOverTime`, `PostWish`), décidé (cf. système 2 & 3). **Pas d'override PP** (décision #10).

## Stamps / champs `PokemonInstance` ajoutés

| Champ | Sémantique | Posé par | Reset |
|-------|-----------|----------|-------|
| `movedThisTurn?: boolean` | a changé de position ce tour (déplacement ou knockback) | `BattleEngine` (move action) + `handle-knockback` | début de tour (`executeStartTurn`) |
| `pendingWish?: { healAmount; castAtAction }` | soin différé Vœu en attente | `executeUseMove` (wish) | déclenchement (start-turn cible) / `handleKo` |

> Volatiles `Ingrain`/`AquaRing` vivent dans `volatileStatuses` (pas de nouveau champ). Pas de décrément (handler `timed-volatile` ne les tique pas — comme `Charged` du plan 115).

## IA (scoring)

- **Self-heal (É-Coque/Paresse)** : `scoreSelfMove` proportionnel aux PV manquants (fort si HP bas, ~0 si plein) — réutiliser le scoring de Soin/Synthèse existant.
- **Vibra Soin** : **cibler un allié blessé** (jamais un ennemi). Score ∝ PV manquants de l'allié ; **interdire/0** sur cible ennemie (sinon l'IA soigne l'adversaire).
- **Fontaine de Vie** : score ∝ somme des PV manquants des alliés dans le rayon ; bonus si ≥2 alliés blessés groupés.
- **Vœu** : score modéré (setup) ; bonus si l'allié ciblé est sous menace mais pas encore au tapis ; malus si cible déjà pleine.
- **Aromathérapie** : score ∝ nombre d'alliés statués dans le rayon ; ~0 si aucun.
- **Racines / Anneau Hydro** : setup ; bonus si HP < ~60 % et pas déjà actif ; Racines pénalisé si l'IA compte se déplacer (synergie « rester sur place »).
- **Vole-Force** : bonus si cible à forte Atq **et** lanceur blessé (double valeur soin + debuff) ; lit l'Atq effective de la cible pour estimer le soin.
- **Dévorêve** : géré par légalité (illégal/échec si cible éveillée) ; bon combo après un move de sommeil.
- **Boule Pollen** : choisir la meilleure cible — allié blessé (soin) **ou** ennemi (dégâts) selon le contexte, prendre le max des deux scores.

## Renderer + i18n

- Évènement `HpRestored` déjà géré (floating text vert + log). `StatusRemoved` déjà géré (Aromathérapie).
- **Indicateurs volatils HoT** : badges InfoPanel `Racines` / `Anneau Hydro` (mutualiser le système d'indicateurs plan 095) + icône 💧/🌿. Badge `Vœu (1t)` pour `pendingWish`.
- **MoveTooltip** (FR/EN) tags auto : « Soin 50 % », « Soin 25 % alliés (rayon) », « Régén 1/8 par tour (si immobile) », « Régén 1/16 par tour », « Soin différé (50 % PV max) », « Guérit les statuts d'équipe », « Soin = Attaque de la cible + Atq −1 », « Seulement si la cible dort », « Soin allié / dégâts ennemi », « ⚠ Peut soigner un ennemi » (Vibra Soin / Boule Pollen sur ennemi → c'est l'inverse, attention au libellé).
- **BattleLogFormatter** : Vœu (pose + déclenchement différé), HoT tick (Racines/Anneau Hydro), Aromathérapie (statuts guéris), Vole-Force (soin + baisse), Boule Pollen (branche soin vs dégâts), échec Dévorêve si éveillé.
- i18n : nouvelles clés FR/EN (noms FR officiels obligatoires).

## Tests (test-writer)

1 fichier `{id}.test.ts` par move + tests système. **Tester HoT + Vœu dans les deux loops** (round + CT) pour prouver le model-agnosticisme (réutilise l'horloge d'actions plan 115).

- **soft-boiled / slack-off** : soin 50 % ; clamp pas d'overheal ; 0 si déjà plein.
- **heal-pulse** : soigne un allié à distance 50 % ; **soigne aussi un ennemi si ciblé** (test du risque) ; pas de self.
- **life-dew** : tous les alliés du rayon r2 soignés 25 % ; allié hors rayon non soigné ; ennemis non soignés.
- **ingrain** : HoT 1/8 si pas bougé ; **pas de tick le tour où le mon bouge** (déplacement) ; **pas de tick si knockback subi** ; volatile persiste ; **ancrage** : un Vol/Lévitation devient ciblable par un move Sol et soumis au terrain pendant Racines, mais garde son type Vol en défense.
- **aqua-ring** : HoT 1/16 inconditionnel (tick même après déplacement).
- **wish** : soin = 50 % PV max **du lanceur** (pas de la cible) ; déclenché au **prochain tour de la cible**, **pas avant** ; suit le mon s'il a bougé ; écrasement (pas de stack) ; effacé au KO ; **testé round ET CT**.
- **aromatherapy** : guérit les statuts majeurs des alliés du rayon ; ne touche pas les volatiles ; ennemis non affectés ; ~no-op si personne n'est statué.
- **strength-sap** : soin = Atq effective de la cible (crans inclus) ; Atq cible −1 ; soin appliqué même si Atq déjà −6 ; baisse bloquée par Brume/Rune Protect.
- **dream-eater** : échec (0 dégât) si cible éveillée ; dégâts + drain 0,5 si endormie ; échec aussi si la cible se réveille avant résolution.
- **pollen-puff** : allié ciblé → soin 50 %, **aucun dégât** ; ennemi ciblé → dégâts 90 BP, **aucun soin**.
- **Système** : `hot-tick-handler` (ordre de priorité, cumul Ingrain+AquaRing, clamp) ; `movedThisTurn` posé/reset aux bons points ; `EffectKind.HealTarget` clamp ; extension union `ConditionKind` (`target_is_ally`/`target_is_enemy`).

## Étapes

1. `test-writer` : specs des 11 moves + système (échouent d'abord).
2. **Champs `PokemonInstance`** : `movedThisTurn`, `pendingWish`. Écriture `movedThisTurn` (déplacement `BattleEngine` + `handle-knockback`), reset start-turn. `handleKo` nettoie `pendingWish` + volatiles HoT.
3. **Volatiles HoT** : `StatusType.Ingrain` / `StatusType.AquaRing` (status-type enum) ; `remainingTurns: undefined`, non tickés par `timed-volatile`. Ancrage : `effective-flying.ts` (`isEffectivelyFlying` retourne `false` si Ingrain — **pas** `getEffectiveTypes`).
4. **Effets dédiés** (handlers enregistrés, pas de switch — `core.md`) : `EffectKind.HealTarget`, `EffectKind.CureTeamStatus`, `EffectKind.HealByTargetStat`, `EffectKind.PostHealOverTime { kind }`, `EffectKind.PostWish { fraction }`. Étendre l'union `Effect`.
5. **Flags / conditions** : `requiresTargetAsleep` (`MoveDefinition` + `TacticalOverride`). Ajout `ConditionKind.TargetIsAlly`/`TargetIsEnemy` + 2 cas dans l'évaluateur ; support `appliesIf` sur `HealTarget` (le `Damage` l'a déjà, plan 115). **Vérifier** que le resolver `Single` honore `targetsAlly` (filtrage allié/ennemi — déjà utilisé par Baton Pass plan 093 / le confirmer pour Vibra Soin/Vœu/Boule Pollen).
6. **Handler end-turn** `hot-tick-handler.ts` (priorité 250) + enregistrement `TurnPipeline` (`BattleEngine`). **Déclenchement Vœu** dans `executeStartTurn`.
7. **`getLegalActions`** : gate Dévorêve (retiré/illégal si aucune cible endormie à portée) + garde résolution.
8. **Zone alliée** : helper « alliés vivants dans rayon r2 » (Fontaine de Vie + Aromathérapie). Résolution multi-cibles du soin.
9. Data `tactical.ts` : 11 entrées + noms EN. (Pas d'override PP — décision #10.)
10. IA scoring.
11. Renderer indicateurs/tooltips/log + i18n FR/EN.
12. Gate CI verte.
13. `implementations.md` : 371 → **382**. `plan 112` B2 : 11 livrés. Note **Grosse Racines** (Big Root) → futur batch objet.

## Risques / surveillance (game-designer)

- **Soin global du jeu** : ce batch augmente nettement la disponibilité du soin (peu présent jusqu'ici). Surveiller que les combats ne s'éternisent pas (stall). Garde-fous : Vœu = délai 1 tour, Fontaine/Aromathérapie = rayon (placement requis ⇒ exposé au friendly-fire AoE existant : Séisme/Ampleur), Racines = immobilité. (PP **retirés** — pas un levier, cf. décision #10 + roadmap.)
- **Vœu télécommandé fort** : 50 % PV max d'un lanceur costaud (**Leveinard** ~310 PV niv. 50, Ronflex) sur n'importe quel allié. Intentionnellement fort (rareté du soin). Coût-opportunité : Leveinard a 5 Atq / 35 AtqSpé ⇒ chaque Vœu = un tour sans pression. **Si une unité devient indestructible en playtest** (parties > ~20 rounds), ajustement naturel : % à 40 % **ou** borner à `min(PV max lanceur, PV max cible)`.
- **Cumul Racines + Anneau Hydro** sur un même mon = 3/16 PV/tour (immobile). Coûte 2 slots + 2 tours d'install, PP-limité. Acceptable POC ; **si dégénéré, rendre les 2 volatiles mutuellement exclusifs** (ne pas décider maintenant).
- **Vole-Force sur cible boostée** : soin = Atq effective (stages inclus) ⇒ ~200 PV sur une cible Danse-Lames +2. Canon (fort). Surveiller ; si retournement systématique, plafonner le soin à ~2× PV max du lanceur.
- **Vibra Soin / Boule Pollen sur le mauvais camp** : le joueur peut soigner un ennemi par erreur. Voulu (skill expression) mais l'IA ne doit **jamais** le faire (légalité/scoring).
- **Racines ancrage** : interaction future avec **Vol Magnétik** (B10) et déplacement forcé (**B20**) — l'ancrage anti-knockback canon n'est **pas** implémenté ici (pas de système de knockback-immunité), seul le grounding de type l'est. Documenté, cohérent.
- **`movedThisTurn` aux deux loops** : bien poser/reset au même point logique round + CT (couvert par test système).
- **`HealByTargetStat`** : lit l'Atq **effective** (stages) de la cible — vérifier la source de stat partagée avec le damage-calc pour éviter une divergence.
- **`pendingWish` + horloge d'actions** : le `readyAtAction` doit garantir « prochain tour de la cible » dans les deux loops sans déclencher trop tôt (le tour même de la pose). Test dédié round + CT.

## Hors-scope

- **Grosse Racines** (Big Root, +30 % soin HoT/drain) → futur batch objet.
- **Ancrage anti-knockback / no-flee canon de Racines** → dépend de B20 (déplacement forcé) ; ici seul le grounding de type.
- **Soin Floral** (`floral-healing`) / **Selve Salvatrice** (`jungle-healing`) → hors pool roster Gen 1 (non listés B2).
- OP sets utilisant ces moves → différé au besoin.
