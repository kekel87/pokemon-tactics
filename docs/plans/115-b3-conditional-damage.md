# Plan 115 — B3 « Dégâts conditionnels » (17 moves)

> **Statut : done** (livré 2026-06-06)
> Vague 1 de la roadmap maître **plan 112**. Suite des moteurs `dynamicPower` (109) / stat-source (110) / poids (111) / B1 (113).
> Total moves visé : 354 → **371** (+17).
> Décisions de scope + modèle temporel validés humain 2026-06-06 (voir ci-dessous).

## Objectif

Livrer **17 moves** dont la puissance ou l'effet dépend de l'**état récent du combat** (a-t-on été touché, la cible a-t-elle pris des dégâts, un allié est-il tombé, qu'a joué mon équipe juste avant) ou d'un **compteur** (fois touché, moves utilisés).

Le gros du batch = **extension du moteur `dynamicPower`**. La nouveauté centrale est **architecturale** : on remplace toute notion de « ce tour » par une **horloge d'actions model-agnostic**, parce que le jeu a deux loops de combat et qu'on va bientôt supprimer le round-based.

Mécaniques wiki vérifiées (Bulbapedia gen 8/9) — voir tableau.

## Contexte architectural — « ce tour » n'existe pas en CT

`BattleEngine` a **deux** boucles de tour :

- **`advanceTurn`** (round-based) : tout le monde agit 1× → `roundNumber++` en fin de round. `executeEndTurn` tourne par-Pokémon.
- **`advanceTurnCt`** (CT / ATB FFTA) : **un seul** acteur agit quand sa jauge CT franchit 1000. `state.turnOrder = [actorId]` (1 élément). **`roundNumber` n'incrémente jamais.** `executeEndTurn` tourne après **chaque action d'acteur**.

En CT, **il n'y a pas de "tour" partagé** où chaque camp joue une fois. Le temps se mesure en **actions individuelles**. Donc toute condition Pokémon formulée « ce tour » / « tour précédent » doit être **retraduite en termes d'actions**, sinon elle casse à la suppression annoncée du round mode.

### Décision (validée humain 2026-06-06) : horloge d'actions

On introduit un primitif temporel **indépendant du mode** :

- **`BattleState.actionCounter: number`** — compteur monotone, **+1 à chaque action complétée** (identique round mode et CT). C'est la seule plomberie nécessaire.
- **Stamps par-mon** sur `PokemonInstance` = « valeur de `actionCounter` quand tel évènement a eu lieu ».
- **Stamps par-équipe** sur `BattleState` pour les conditions cross-acteur.

La traduction des conditions Pokémon devient une **comparaison de deux entiers**, sans aucune notion de tour :

| Move | Condition Pokémon | Traduction par actions (canon préservé) |
|------|-------------------|------------------------------------------|
| Avalanche / Vendetta | touché avant d'agir ce tour | `lastDamagedByEnemyAtAction > lastActedAtAction` (touché par un ennemi depuis ma dernière action) |
| Assurance | cible déjà blessée ce tour | `target.lastDamagedAtAction > target.lastActedAtAction` |
| Voix Envoûtante / Feu Envieux | stat cible montée ce tour | `target.hasFreshStatBoost === true` — **flag dédié** (pas une comparaison de stamps : le boost et l'action de setup partagent le même `actionCounter`, donc `>` échouerait sur l'auto-boost) |
| Vengeance | allié KO tour précédent | `team.lastAllyFaintAtAction > attacker.lastActedAtAction` |
| **Écho** | +40 si utilisé tours consécutifs (par n'importe qui) | **ramp si la dernière action de mon équipe était Écho** (`team.lastTeamActionMoveId === echoed-voice` → `echoStreak++`, sinon reset 1), cap 200 |
| **Chant Canon** | ×2 si un allié a joué Round ce tour | **×2 (une fois) si la dernière action de mon équipe était Chant Canon** (`team.lastTeamActionMoveId === round`) |

> Insight humain : « si je sais lire ma dernière action, je sais lire la dernière action de mon équipe ». Pokémon dit « ce tour » uniquement parce que les alliés jouent dans le même tour → en CT on remplace par **« l'action d'équipe précédente »**. Écho devient un crescendo qui passe d'un mon à l'autre, Chant Canon un combo binaire. Plus tactique, 100 % model-agnostic.

> Ce primitif sera **réutilisé par B7** (multi-tour), **B9** (payback / Représailles / Poursuite), **B10** (timers Bâillement / Requiem). B3 est le bon moment pour le poser.

### Référence Pokémon Showdown (best-practices 2026-06-06)

Showdown (turn-based strict) maintient des flags par-Pokémon resetés dans `Battle.endTurn()` : `attackedBy[].thisTurn`, `hurtThisTurn`, `statsRaisedThisTurn`, `moveThisTurnResult`/`moveLastTurnResult` (rotation), `timesAttacked` (cumulatif, jamais reset sauf switch) ; sur `Side` : `faintedThisTurn`/`faintedLastTurn`. Écho = pseudo-weather `field` (multiplier ×1..5, `duration: 2`). Chant Canon = `effectState.roundCount`. Chargeur = volatile retiré sur move Élec. Baston = `5 + floor(baseAtk/10)` par allié (`!fainted && !status`, self inclus).

**Notre modèle = stamps `actionCounter` (« approche A » de la reco)** plutôt que des flags reset par-tour : il n'y a pas de `endTurn()` global en CT, donc on remplace « ce tour » par « depuis ma dernière action » via comparaison de stamps. Divergences assumées :
- **Avalanche/Vendetta** : Showdown vérifie « touché **par la cible** » ; nous = « touché **par un ennemi** depuis ma dernière action » (adaptation grille multi-ennemis).
- **`hasFreshStatBoost`** : inclut les auto-boosts (parité `statsRaisedThisTurn` — Feu Envieux/Voix Envoûtante doivent punir un Danse-Lames perso). On ne filtre **pas** `source !== self`.
- **Écho / Chant Canon** : reskin « action d'équipe précédente » (choix créatif humain) au lieu du scope field-global de Showdown.
- **Chargeur** : aligné Showdown (persiste jusqu'au move Élec).
- **Trépignement** : Showdown distingue Protection (`null`, pas de ×2) d'un raté (`false`, ×2). Nous : `lastMoveFailed` = « move n'a pas connecté » (raté/immunité/Protection tous comptés). Divergence mineure documentée (la Protection compte comme échec).

## Moves livrés (17)

Noms FR officiels (source `reference/moves.json` `names.fr`).

| FR | ID EN | Type | Cat | BP | Acc | Prio | Pattern | Mécanique (adaptée actions) |
|----|-------|------|-----|----|----|----|---------|-----------|
| **Avalanche** | `avalanche` | Glace | Phys | 60→**120** | 100 | **-4** | **Slash** | ×2 si touché par un ennemi depuis ma dernière action |
| **Vendetta** | `revenge` | Combat | Phys | 60→**120** | 100 | **-4** | Single 1-1 | ×2 si touché par un ennemi depuis ma dernière action |
| **Assurance** | `assurance` | Ténèbres | Phys | 60→**120** | 100 | 0 | Single 1-1 | ×2 si la cible a subi des dégâts depuis sa dernière action |
| **Voix Envoûtante** | `alluring-voice` | Fée | Spé | 80 | 100 | 0 | **Cone 1-2** | **Confusion** si stats cible montées depuis sa dernière action |
| **Feu Envieux** | `burning-jealousy` | Feu | Spé | 70 | 100 | 0 | **Cone 1-2** | **Brûlure** si stats cible montées depuis sa dernière action |
| **Écho** | `echoed-voice` | Normal | Spé | 40→**200** | 100 | 0 | **Cone 1-3** | +40/cran si dernière action d'équipe = Écho (crescendo), cap 200 |
| **Chant Canon** | `round` | Normal | Spé | 60→**120** | 100 | 0 | **Cone 1-3** | ×2 (une fois) si dernière action d'équipe = Chant Canon |
| **Poing de Colère** | `rage-fist` | Spectre | Phys | 50→**350** | 100 | 0 | Single 1-1 | +50 × `timesHit` (cap +6) — compteur pur, model-agnostic |
| **Vengeance** | `retaliate` | Normal | Phys | 70→**140** | 100 | 0 | Single 1-1 | ×2 si un allié est tombé depuis ma dernière action |
| **Trépignement** | `stomping-tantrum` | Sol | Phys | 75→**150** | 100 | 0 | Single 1-1 | ×2 si mon move précédent a échoué — historique perso |
| **Ronflement** | `snore` | Normal | Spé | 50 | 100 | 0 | **Cone 1-3** | utilisable **seulement endormi** + Flinch 30 % (sonore) |
| **Dernier Recours** | `last-resort` | Normal | Phys | **140** | 100 | 0 | Single 1-1 | utilisable si **tous les autres moves utilisés ≥ 1×** |
| **Chargeur** | `charge` | Élec | Statut | — | — | 0 | Self | DéfSpé **+1** + prochain move Élec **×2** (volatile « jusqu'à ma prochaine action ») |
| **Baston** | `beat-up` | Ténèbres | Phys | *(multi)* | 100 | 0 | Single 1-1 | 1 coup/allié sain, pow/coup = `floor(Atk_base allié /10)+5` |
| **Aire d'Herbe** | `grass-pledge` | Plante | Spé | 80 | 100 | 0 | Single 1-1 | dégâts simples (combo champ différé B4) |
| **Aire de Feu** | `fire-pledge` | Feu | Spé | 80 | 100 | 0 | Single 1-1 | dégâts simples (combo champ différé B4) |
| **Aire d'Eau** | `water-pledge` | Eau | Spé | 80 | 100 | 0 | Single 1-1 | dégâts simples (combo champ différé B4) |

> Learners roster : à confirmer via le script de learnsets avant de figer les patterns (`move-pattern-designer` valide).

## Décisions de scope (validées humain 2026-06-06)

1. **Aires (Gages)** → v1 = move Spé 80 plat sans combo. Combo 2-Gages (150 + champ) **différé B4**.
2. **Baston** → inclus B3 (multi-hit équipe).
3. **Feu Envieux** → Cone 1-2 (AoE canon « tous ennemis adjacents »).
4. **Écho / Chant Canon** → adaptés via « action d'équipe précédente » (voir contexte archi), livrés en B3.
5. **Réordonnancement de tour de Chant Canon** (allié Round joue juste après) → non pertinent sur grille, **skip**.
6. **Targeting (revu 2026-06-06)** : **Avalanche → Slash** (éventail frontal r1, contre mêlée AoE) ; **Voix Envoûtante → Cone 1-2** ; **Écho / Chant Canon / Ronflement → Cone 1-3** (famille sonore = Cône, pas Zone → pas de friendly fire). Vendetta + Assurance restent **Single 1-1**.
7. **Exception sommeil (Ronflement, futur Blabla Dodo)** : un mon endormi qui détient un move `requiresAsleep` jouable obtient un **tour restreint** (ce move OU wait, **pas de déplacement**) au lieu d'être skippé. Sans move éligible → tour sauté comme avant. Implémenté : `BattleEngine.canActWhileAsleep` (override du skip dans les 2 loops) + `getLegalActions` filtre (seuls les `requiresAsleep` + EndTurn quand endormi, Move retiré). Débloque Ronflement (sinon inerte) et prépare Blabla Dodo.

> **Note prio** : la priorité (-4 Avalanche/Vendetta) n'est pas modélisée par le moteur (CT/round par initiative, pas de champ priority). L'adaptation « touché depuis ma dernière action » ne dépend pas de la prio → mécanique correcte sans elle.

## Couche de tracking — où poser chaque stamp

### Stamps par-mon (`PokemonInstance`)

| Champ | Sémantique | Posé par |
|-------|-----------|----------|
| `lastActedAtAction?: number` | `actionCounter` quand le mon a complété sa dernière action | fin de `executeUseMove` / fin d'action |
| `lastDamagedAtAction?: number` | a subi n'importe quels dégâts | `handle-damage` |
| `lastDamagedByEnemyAtAction?: number` | a subi des dégâts d'un **ennemi** (`attacker.id !== target.id` et camps ≠) | `handle-damage` |
| `hasFreshStatBoost?: boolean` | a un boost de stat **non encore encaissé** : mis `true` sur toute hausse, remis `false` au **début de la prochaine action du mon** | hausse → `handle-stat-change` ; reset → début d'action (`executeStartTurn` / reset `turnState`) |
| `timesHit?: number` | nb de coups encaissés depuis l'entrée (**compteur pur**, jamais reset) | `handle-damage` |
| `lastMoveFailed?: boolean` | dernier move résolu = échec (raté / Protection / immunité) | `BattleEngine` post-résolution |
| `usedMoveIds?: string[]` | ids de moves utilisés ≥ 1× | fin de `executeUseMove` (à côté de `lastUsedMoveId` existant) |

### Stamps par-équipe (`BattleState`)

| Champ | Sémantique | Posé par |
|-------|-----------|----------|
| `actionCounter: number` | horloge monotone +1/action | incrémenté **une fois par action complète** (PAS par hit) : `endCurrentTurn` (round) ET `endCurrentTurnCt` après `ctSystem.onActionComplete()` (CT). Test système prouve l'équivalence. |
| `lastAllyFaintAtAction: Record<playerId, number>` | `actionCounter` du dernier KO d'un mon de l'équipe | `handleKo` |
| `lastTeamActionMoveId: Record<playerId, string \| undefined>` | move de la dernière action complétée par l'équipe | fin de `executeUseMove` |
| `echoStreak: number` | cran de crescendo d'Écho courant | `executeUseMove` (echoed-voice) |

> **Plus de reset « début de tour ».** Les conditions ne lisent jamais un flag booléen volatile : elles comparent un stamp à `lastActedAtAction`. Un stamp ancien (antérieur à ma dernière action) compte automatiquement comme « pas récent ». Rien à nettoyer end-turn → robuste aux deux loops.

> `lastMoveFailed` réutilise le flag `moveConnected` du plan 113 (échec = move résolu sans hit connecté). **Vérifier à l'étape 3 que `moveConnected` existe bien dans le code** (sinon le poser).
> `timesHit` : incrémenté dans `handle-damage` à chaque dégât encaissé. **Jamais reset end-turn** ; initialisé à 0 à l'entrée en combat / switch ; lecture défensive `attacker.timesHit ?? 0`.
> **Assurance** : la réf exclut du doublement les dégâts de confusion / Malédiction / Partage de Douleur. L'adaptation `lastDamagedAtAction` ne fait pas cette nuance (tout dégât compte). Acceptable en tactique — documenté, non bloquant.

## Extensions moteur — par groupe

### 1. `DynamicPowerKind` — nouveaux kinds

Le résolveur actuel ne reçoit que `(move, attacker, target)`. On **étend `DynamicPowerInput`** avec `battleState?: BattleState` (les resolvers existants l'ignorent). `resolveDynamicPower(move, attacker, target, battleState?)` prend un 4e param optionnel. `getEffectivePowerFloor` (IA hors combat) inchangé.

> **Propagation `battleState`** : `handle-damage` a le contexte → passe `battleState` (résolution réelle correcte). **`damage-calculator.estimateDamage` (preview tooltip) n'a PAS de `battleState`** → les kinds dépendant de l'état (les 4 réactifs + Écho/Chant Canon) **fallback sur `move.power` de base** dans la preview. Acceptable : le tooltip affiche la puissance plancher, le vrai calcul applique le bonus. À documenter dans le tag tooltip (« puissance variable »). Les kinds purs (`TimesHitScaled`, `PreviousMoveFailedDouble`, réactifs lisant les stamps du mon) se résolvent dès qu'on a `attacker`/`target` → OK en preview.

| Kind | Lecture | Moves |
|------|---------|-------|
| `DamagedByEnemySinceLastAction` | stamps `attacker` | Avalanche, Vendetta |
| `TargetDamagedSinceLastAction` | stamps `target` | Assurance |
| `TimesHitScaled` | `move.power + 50 * min(6, attacker.timesHit ?? 0)` | Poing de Colère |
| `AllyFaintedSinceLastAction` | `battleState` + stamps `attacker` | Vengeance |
| `PreviousMoveFailedDouble` | `attacker.lastMoveFailed` | Trépignement |
| `EchoCrescendo` | `battleState.echoStreak` → `min(200, 40 * echoStreak)` | Écho |
| `TeamPreviousMoveDouble` | `battleState.lastTeamActionMoveId[attacker.playerId] === move.id` | Chant Canon |

> **Chargeur ×2** : implémenté **inline dans `dealSingleHit`** (et non via un `DynamicPowerKind`), car le ×2 doit s'appliquer à **n'importe quel** move Élec du lanceur, pas à un move spécifiquement tagué. Si l'attaquant a le volatile `Charged` et que `move.type === Electric` → puissance ×2. Le volatile est retiré dans `executeUseMove` après le move Élec (parité Showdown). 7 nouveaux `DynamicPowerKind` au total.

> `TeamPreviousMoveDouble` est générique (compare au move courant) → réutilisable. Pour Écho, la mise à jour du `echoStreak` (incrément/reset) se fait à l'**exécution** du move (dans `executeUseMove`), pas dans le resolver : quand un mon lance Écho, si `lastTeamActionMoveId[team] === 'echoed-voice'` → `echoStreak = min(5, echoStreak + 1)` sinon `echoStreak = 1`. Le resolver lit ensuite la valeur.

### 2. Effet secondaire conditionnel « cible a un boost frais »

Voix Envoûtante (Confusion) + Feu Envieux (Brûlure). Secondaire qui ne s'applique **que si** `target.hasFreshStatBoost === true` (boost non encore encaissé — fenêtre = jusqu'à la prochaine action de la cible ; gère l'auto-boost, contrairement à un `>` de stamps).

- **Décidé (game-designer 2026-06-06)** : champ `Effect.appliesIf?: ConditionKind` où `ConditionKind` est une **union TypeScript stricte** (`"target_boosted_recently" | …`), pas une string libre. Plus léger qu'un `EffectKind` dédié par move, type-safe, extensible (B5–B10 ajouteront des conditions à l'union). Les deux moves sont fonctionnellement identiques (même condition, statut appliqué différent) → un kind par move = sur-ingénierie.
- Pas de jet de proba — la condition gate l'effet (100 % si vraie). Réf : `secondary.chance: 100`, `volatileStatus: null` (l'effet est dans la longDescription, pas le secondaire générique) → implémenter via `appliesIf`, pas via le secondaire standard.

### 3. Gates d'usage (`getLegalActions` + garde `executeUseMove`)

- **Ronflement** : retiré si le lanceur n'est pas `Asleep`. + Flinch 30 %. Sound move (bypass Substitute, cf. flags réf + plan 099).
- **Dernier Recours** : retiré si `usedMoveIds` ne contient pas tous les autres moves du moveset (≥ 1 chacun). Garde défensive dans `executeUseMove`.
- Nouveaux flags `MoveDefinition` + miroir `TacticalOverride` : `requiresAsleep`, `requiresAllOtherMovesUsed`.

### 4. Chargeur — volatile + multiplicateur Élec

- DéfSpé +1 (effet stat standard) **self**.
- Volatile `charged` posé sur le lanceur. **Décidé (alignement Showdown 2026-06-06)** : le volatile persiste **jusqu'à l'usage d'un move de type Électrik** (alors ×2 puis retiré). Les moves non-Élec et les déplacements **ne le consomment pas** (parité Showdown `condition.onAfterMove` : `removeVolatile('charge')` seulement si `move.type === 'Electric'`). Évite toute subtilité « prochaine action » en CT, plus fidèle.
- ×2 Élec appliqué **inline dans `dealSingleHit`** (pas un `DynamicPowerKind` — sinon il faudrait taguer chaque move Élec). Retrait du volatile dans `executeUseMove` post-move.
- `StatusType.Charged` ajouté (volatile), non tické par le timed-volatile handler → persiste jusqu'au retrait manuel.

### 5. Baston (Beat Up) — multi-hit basé équipe

- Puissance `null` en réf → pilotée par l'effet.
- 1 coup par membre vivant de l'équipe **sans statut majeur** (lanceur inclus s'il est sain).
- Pow du coup `i` = `floor(baseAttack(allié_i) / 10) + 5`, **type Ténèbres / physique**, **calcul de dégât séparé par coup** (STAB/efficacité sur le type Dark, pas le type de l'allié — parité Showdown gen 5+).
- `baseAttack` = stat Attaque **de base de l'espèce** de l'allié (source `PokemonDefinition`).
- Nouvel `Effect.Damage.teamBeatUp?: boolean` (ou `EffectKind.BeatUp`) : énumère l'équipe, génère N hits, émet `MultiHitComplete` (N réel).
- **Substitute / Protection par coup** : chaque coup se résout comme un hit normal (test protection/sub du target par coup). Un coup bloqué échoue sans dégât, **n'interrompt pas** les coups suivants.
- `actionCounter` n'incrémente **qu'une fois** pour le move complet, pas par coup (cf. point d'incrément).

## Effets data (`tactical.ts`)

```ts
avalanche:        { Single 1-1, prio -4, effects: [Damage], dynamicPower: { kind: DamagedByEnemySinceLastAction } },
revenge:          { Single 1-1, prio -4, effects: [Damage], dynamicPower: { kind: DamagedByEnemySinceLastAction } },
assurance:        { Single 1-1, effects: [Damage], dynamicPower: { kind: TargetDamagedSinceLastAction } },
"alluring-voice": { Single 1-1, effects: [Damage, Status Confusion appliesIf:target_boosted_recently], sound },
"burning-jealousy":{ Cone 1-2, effects: [Damage, Status Burned appliesIf:target_boosted_recently] },
"echoed-voice":   { Single 1-1, effects: [Damage], dynamicPower: { kind: EchoCrescendo }, sound },
round:            { Single 1-1, effects: [Damage], dynamicPower: { kind: TeamPreviousMoveDouble }, sound },
"rage-fist":      { Single 1-1, effects: [Damage], dynamicPower: { kind: TimesHitScaled } },
retaliate:        { Single 1-1, effects: [Damage], dynamicPower: { kind: AllyFaintedSinceLastAction } },
"stomping-tantrum":{ Single 1-1, effects: [Damage], dynamicPower: { kind: PreviousMoveFailedDouble } },
snore:            { Single 1-1, effects: [Damage, Status Flinch 30%], requiresAsleep: true, sound },
"last-resort":    { Single 1-1, effects: [Damage], requiresAllOtherMovesUsed: true },
charge:           { Self, effects: [StatChange SpDefense +1, PostCharge volatile] },
"beat-up":        { Single 1-1, effects: [Damage teamBeatUp] },
"grass-pledge":   { Single 1-1, effects: [Damage] },
"fire-pledge":    { Single 1-1, effects: [Damage] },
"water-pledge":   { Single 1-1, effects: [Damage] },
```

> Flags `sound`/`bypasssub`/`contact` auto-chargés depuis la réf (loader `extractFlags`), pas besoin de les poser dans l'override. Chargeur Élec ×2 : appliqué inline dans `dealSingleHit`, pas via un kind.

## IA (scoring)

- Conditionnels dégâts : scorer sur la **puissance effective courante** (helper qui évalue la condition via stamps + `actionCounter`). Au minimum ne pas sous-évaluer quand la condition est remplie.
- Voix Envoûtante / Feu Envieux : bonus si la cible a `hasFreshStatBoost === true`.
- Ronflement : géré par légalité (illégal si éveillé).
- Dernier Recours : géré par légalité.
- Chargeur : `scoreSelfMove` modéré (setup) ; bonus si le lanceur a un move Élec fort.
- Baston : somme des dégâts estimés des coups.

## Renderer + i18n

- Tags `MoveTooltip` (FR/EN) auto-générés : « ×2 si touché récemment », « ×2 si cible déjà blessée », « Confusion/Brûlure si cible boostée », « +50 par coup encaissé », « ×2 si allié tombé », « ×2 si échec précédent », « crescendo (jusqu'à 200) », « ×2 si allié vient de jouer Chant Canon », « seulement endormi », « après tous les autres moves », « prochain move Élec ×2 », « 1 coup par allié », « 🔊 Sonore (ignore Clone) » selon flags.
- `BattleLogFormatter` : Chargeur (volatile), Baston (multi-hit), Écho (crescendo monte), gels d'usage si affichés.
- Indicateur volatile `charged` (InfoPanel badge + icône, mutualiser indicateurs plan 095).
- i18n : nouvelles clés FR/EN.

## Tests (test-writer)

1 fichier `{id}.test.ts` par move + tests système. **Tester dans les deux loops** (round + CT) au moins pour 1 move réactif (Avalanche) et 1 move équipe (Écho) afin de prouver le model-agnosticisme.

- **avalanche / revenge** : pas de hausse si pas touché ; ×2 si touché par ennemi depuis ma dernière action ; le stamp ancien (avant ma dernière action) ne compte pas.
- **assurance** : ×2 si la cible a été blessée depuis qu'elle a joué ; ×1 sinon.
- **alluring-voice / burning-jealousy** : effet **seulement** si `target.hasFreshStatBoost`. Cas clés : (a) **auto-boost** — la cible fait Danse-Lames puis est frappée avant de rejouer → effet appliqué (prouve que le `>` de stamps aurait échoué) ; (b) cible boostée puis ayant rejoué → flag périmé, pas d'effet ; (c) buff d'un allié sur la cible → effet appliqué. Feu Envieux : Cone touche 2 cibles.
- **echoed-voice** : 40 → 80 → 120 quand l'équipe enchaîne Écho ; reset à 40 si une autre action d'équipe s'intercale ; cap 200.
- **round** : 120 si l'action d'équipe précédente = Chant Canon ; 60 sinon ; ne stacke pas.
- **rage-fist** : 50 ; +50 après 1 coup ; cap +6 (350).
- **retaliate** : ×2 si un allié est tombé depuis ma dernière action ; ×1 sinon.
- **stomping-tantrum** : ×2 si move précédent raté/immunisé ; ×1 si connecté.
- **snore** : illégal éveillé ; légal + Flinch 30 % seedé si endormi.
- **last-resort** : illégal tant que les autres moves pas tous utilisés ; légal ensuite.
- **charge** : DéfSpé +1 + prochain Élec ×2 ; consommé ; non-Élec non boosté.
- **beat-up** : N coups = N alliés sains ; pow/coup = `floor(baseAtk/10)+5` ; allié statué exclu.
- **grass/fire/water-pledge** : dégâts simples 80, pas de combo (v1).
- **charge (CT)** : Chargeur → action `Move` (déplacement) → move Élec : le ×2 s'applique encore (le volatile survit aux non-`useMove`).
- **Système** : `dynamic-power-system.test.ts` étendu (nouveaux kinds + lecture `battleState`) ; test `actionCounter` incrémente identiquement dans les deux loops, **une fois par action** (vérifier avec Baston multi-hit : +1 et non +N) ; test des stamps ; **Poing de Colère testé round ET CT** (compteur pur model-agnostic).

## Étapes

1. `test-writer` : specs des 17 moves + système (échouent d'abord).
2. **Primitif temporel** : `BattleState.actionCounter` + `this.state.actionCounter++` au point exact de fin d'action — `endCurrentTurn` (round) et `endCurrentTurnCt` après `ctSystem.onActionComplete()` (CT). **Une fois par action complète, jamais par hit.** Stamps par-équipe (`lastAllyFaintAtAction`, `lastTeamActionMoveId`, `echoStreak`).
3. **Stamps + flags par-mon** : champs `PokemonInstance` + écriture dans `handle-damage`, `handle-stat-change`, `executeUseMove`, `BattleEngine` post-résolution, `handleKo`. `usedMoveIds`. **`hasFreshStatBoost`** : set sur hausse (`handle-stat-change`), **reset au début d'action** (point commun aux deux loops : reset `turnState` / `executeStartTurn`).
4. **Types/flags** : 8 `DynamicPowerKind`, `MoveDefinition`/`TacticalOverride` (`requiresAsleep`, `requiresAllOtherMovesUsed`, `Effect.appliesIf`, `Effect.Damage.teamBeatUp`).
5. **`dynamic-power-system.ts`** : resolvers + `DynamicPowerInput.battleState` + 4e param `resolveDynamicPower` ; propager `battleState`.
6. **Effet conditionnel** `appliesIf` + **Baston** multi-hit + **Chargeur** volatile + ×2 Élec inline (`dealSingleHit`).
7. **`getLegalActions`** : gates Ronflement / Dernier Recours.
8. Data `tactical.ts` : 17 entrées + noms EN.
9. IA scoring.
10. Renderer tooltips/log/indicateur + i18n FR/EN.
11. Gate CI verte.
12. `implementations.md` : 354 → **371**. `plan 112` B3 : 17 livrés, combo Gages → renvoi B4.

## Risques / surveillance (game-designer)

- **Avalanche/Vendetta prio -4** : agissent en dernier → condition « touché depuis ma dernière action » quasi toujours vraie. Canon, puissance effective ~120 fiable. Surveiller en playtest (la grille change le contexte de menace).
- **Poing de Colère cap 350** : très fort en fin de partie ; canon. ⚠️ Le game-designer a compté 0 learner sur l'ancien roster POC 20 mons (`roster-poc.md`, concept mort plan 087). **Recompter sur le roster 80 jouables** — Férosinge (Primeape) est Gen 1 et probablement jouable → learners > 0. Confirmer à l'étape 7.
- **Baston** : interaction Substitute/Protection par coup + coût calcul (N hits). Vérifier perf et parité.
- **Écho crescendo cross-équipe** : en 6v6, plusieurs mons peuvent enchaîner → montée rapide. Conforme à l'intention, surveiller équilibrage.
- **`appliesIf` générique** : valider la lisibilité (game-designer tranche champ générique vs `EffectKind` dédié, étape 6).
- **Combo Gages absent v1** : tooltip ne doit **pas** promettre de combo.
- **actionCounter dans les deux loops** : bien incrémenter au **même point logique** (fin d'action) côté round ET CT, sinon les stamps divergent. Couvert par test système.

## Hors-scope

- Combo 2-Gages (champ Marais/Arc-en-ciel/Mer de Feu + 150 BP) → **B4** (terrains).
- Réordonnancement de tour de Chant Canon → **skip** (non pertinent grille).
- OP sets utilisant ces moves → différé au besoin.
- **IA scoring Baston** : `estimateDamage` calcule un seul hit à puissance de base (0 en réf) → l'IA sous-évalue Baston et ne le jouera quasi jamais. Suivi à part si Baston entre dans des OP sets IA (calcul de la somme team-based dans `estimateDamage`). Non bloquant (peu de learners, qualité IA seulement).
