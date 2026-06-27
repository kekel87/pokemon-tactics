# Plan 142 — Item interaction (manipulation d'objet tenu)

> **Statut** : `done` (2026-06-27)
> **Branche/worktree** : `item-interaction` (port 5205)
> **Scope** : famille Phase 4 « Item interaction » — **12 moves** + infra core objets consommables/retirables + 2 baies débloquées (Lansat/Frista) + talent Glu débloqué. **411 → 423 moves.**
> **Suite de** : familles Phase 4 (Hazards plan 131, Contrôle 132, Delayed 133, Power conditionnel 134) ; session objets tenus (plans v2026.6.4).

## Contexte

`docs/roadmap.md` §Phase 4 : « **Item interaction (~12)** — Sabotage/`knock-off`, Larcin/`thief` + Implore/`covet`, Tour de Magie/`trick` + Passe-Passe/`switcheroo`, Dégommage/`fling`, Picore/`pluck` + Piqûre/`bug-bite`, Calcination/`incinerate`, Gaz Corrosif/`corrosive-gas`, Recyclage/`recycle`, Éructation/`belch`. **Prérequis : système objets consommables/retirables en combat.** »

État actuel du système objets (audit) :
- Objet tenu = `PokemonInstance.heldItemId?: HeldItemId`. ~103 objets implémentés via `HeldItemHandler` (hooks `onDamageModify`, `onAfterDamageReceived`, `onEndTurn`…).
- Consommation = simple `heldItemId = undefined` (4 sites : `effect-processor.ts` ×2, `handle-damage.ts` ×2). **Aucune mémoire** de ce qui a été consommé.
- **Manquant** : mémoire de l'objet consommé (Recyclage), flag « a mangé une baie » (Éructation), distinction *consommé* (recyclable) vs *retiré/volé* (non recyclable), table fling power (Dégommage), helpers de transfert d'objet, volatile crit-stage (Lansat — `damage-calculator.ts` ne lit que `move.critRatio` + `item.onCritStageBoost`, pas de stage persistant).

Décisions humain (2026-06-27) : **1 seul plan, tout d'un trait, 1 commit final** ; **inclure Lansat/Frista** (l'infra les débloque).

## Décisions de design (à valider humain)

- **D1 — Distinction consommé vs retiré.** Nouveau champ `PokemonInstance.consumedItemId?: HeldItemId`, posé **uniquement** quand un objet est consommé par son propre effet (baie mangée, gemme utilisée). Sabotage/Larcin/Gaz Corrosif/Calcination/Dégommage **retirent** l'objet sans le poser dans `consumedItemId` → **non recyclables** par la victime (canon). Recyclage ne restaure que `consumedItemId`.
- **D2 — Vol = mains vides requises.** Larcin/Implore ne volent que si l'attaquant n'a pas d'objet (`attacker.heldItemId === undefined`). Sinon : dégâts seuls, pas de vol (canon Showdown).
- **D3 — Échange inconditionnel.** Tour de Magie/Passe-Passe échangent les objets même si l'un des deux est vide (canon : l'un peut finir les mains vides). Échouent si **les deux** sont vides.
- **D4 — Sabotage ×1.5.** Boost ×1.5 appliqué **seulement** si la cible porte un objet retirable, puis retrait. Flag `knockOffBoost` lu dans `damage-calculator.ts`.
- **D5 — Bloqué par Substitut.** Tous les moves touchant l'objet de la cible (Sabotage retrait / Larcin / Implore / Tour de Magie / Passe-Passe / Picore / Piqûre / Calcination / Gaz Corrosif) **ne peuvent pas affecter l'objet à travers un Clonage actif** (parité canon : item-manip ne passe pas le Substitut). Les dégâts de Sabotage/Larcin/etc. frappent le Clone normalement ; seul l'effet objet est annulé.
- **D6 — Dégommage (Fling) avec effets secondaires (validé humain 2026-06-27).** Puissance = `FLING_POWER[heldItemId]` (table canon, créée en data) ; échoue si pas d'objet ; objet **retiré** (consommé côté lanceur, non recyclable). **Effets secondaires des objets lancés inclus** via table `FLING_EFFECT: Partial<Record<HeldItemId, FlingSecondary>>` (canon, objets de notre pool) : Orbe Flamme → Brûlure cible, Orbe Toxique → Poison Grave cible, Roche Royale/Croc Rasoir → Flinch cible, **baie lancée → la cible la mange** (applique son effet à la cible + pose `ateBerryThisBattle` cible). Objet sans entrée `FLING_POWER` → move échoue.
- **D7 — Éructation (Belch) gate.** Flag `PokemonInstance.ateBerryThisBattle?: boolean` (jamais reset), posé quand le mon mange une baie (consommation propre **ou** via Picore/Piqûre sur un ennemi). Move échoue (filtré dans `getLegalActions` + gardé `submitAction`) si `!ateBerryThisBattle`. Spé Poison 120 BP.
- **D8 — Picore/Piqûre.** Dégâts + si la cible porte une **baie**, le lanceur la **mange** (applique l'effet de la baie au lanceur via le handler `onAfterDamageReceived`/`onEndTurn` réutilisé), retire la baie de la cible, pose `ateBerryThisBattle` sur le lanceur. Cible sans baie → dégâts seuls.
- **D9 — Calcination.** Dégâts + détruit la **baie ou gemme** de la cible (retirée, **aucun effet** — différent de Picore qui la mange). Cible sans baie/gemme → dégâts seuls.
- **D10 — Gaz Corrosif (validé humain 2026-06-27).** Move statut, retire l'objet de la cible (tout objet retirable). Ciblage **Single 1-3** (adaptation grid retenue ; pas d'AoE).
- **D11 — Crit-stage volatile.** Nouveau `PokemonInstance.critStageBoost?: number` (persistant, cleared au KO), lu dans `damage-calculator.ts` en plus de `move.critRatio` + `item.onCritStageBoost`. Sert Lansat (et future Puissance/Affilage). Lansat = baie pincement ≤25% PV → `critStageBoost += 2`.
- **D12 — Talent Glu (`sticky-hold`) débloqué (validé humain 2026-06-27).** L'infra de retrait/vol rend Glu trivial : bloque tout retrait/vol/échange d'objet du porteur. Plan 141 l'avait explicitement reporté pour cette raison → **inclus ici**. Émet `AbilityActivated` au blocage. Porteurs Gen-1 : lignée Tadmorv/Grotadmorv, Otaria/Lamantine (hidden).

## Clarifications post-revue (plan-reviewer + game-designer, 2026-06-27)

- **C1 — Mécanisme Lansat (D11).** La baie pose le boost via `onAfterDamageReceived` + `onEndTurn` (pattern `pinchStatBerry` existant) : à ≤25% PV, écrit `holder.critStageBoost = (holder.critStageBoost ?? 0) + 2`, émet l'event, consomme (recyclable). `damage-calculator.ts` ajoute `attacker.critStageBoost ?? 0` au calcul de stage existant.
- **C2 — Flag `MoveDefinition.requiresEatenBerry?: boolean`** ajouté (Éructation). Filtré dans `getLegalActions` + gardé `submitAction`.
- **C3 — Substitut (D5).** Guard centralisé `isSubstituteActive(mon)` (helper) appelé en tête de chaque effet item-manip ciblant un ennemi : si actif → skip l'effet objet (les dégâts amont ont déjà frappé le Clone normalement). Émet rien (silencieux, comme un blocage).
- **C4 — `ateBerryThisBattle` posé par TOUTE baie mangée**, y compris Baie Sitrus (≤50% PV) — pas seulement les baies pincement. C'est voulu (débloque Éructation naturellement).
- **C5 — Gaz Corrosif `effectTier`** : `MajorBuff` (≈600 CT floor) — retrait d'objet permanent = désavantage majeur, évite le spam. Aligné sur le calibrage statut lourd.
- **C6 — Bandeau/Mouchoir Choix volé** : le verrou (`onMoveLock`) s'applique au **premier move casté après le vol** (comportement naturel du hook existant, pas de traitement spécial).
- **C7 — Boucle Recyclage** : le coût CT du move (statut) est le seul frein (pas de cap de cycles) — parité avec le modèle « PP = poids CT » du projet. Test d'intégration dédié pour vérifier que le tempo rend la boucle viable mais non triviale.
- **C8 — Edge baies bénéfiques lancées** (Dégommage d'une Baie Sitrus/Lansat/Frista sur un ennemi → la cible en bénéficie) : comportement assumé, **test d'intégration dédié** pour éviter une régression silencieuse.

## Ordre d'implémentation

1. **Infra core** : champs `PokemonInstance` (`consumedItemId`, `ateBerryThisBattle`, `critStageBoost`) ; helpers `held-item-transfer.ts` (+ `isSubstituteActive` réutilisé/exposé) ; refacto des 4 sites de consommation vers `consumeHeldItem` (**+ test unitaire du helper isolé AVANT branchement**) ; lecture `critStageBoost` dans `damage-calculator.ts` ; flags `MoveDefinition` (`knockOffBoost`, `requiresEatenBerry`).
2. **Tables data** : `FLING_POWER` + `FLING_EFFECT` (sourcer canon, objets du pool) ; events + i18n FR/EN + `BattleLogFormatter`.
3. **EffectKind + handlers** : 7 handlers enregistrés ; tests par move.
4. **Moves dégâts** : Sabotage, Larcin/Implore, Picore/Piqûre, Calcination, Éructation.
5. **Moves statut** : Tour de Magie/Passe-Passe, Gaz Corrosif, Recyclage.
6. **Dégommage** (table power + secondaires).
7. **Baies** Lansat/Frista.
8. **Talent Glu**.
9. **IA** (`action-scorer.ts`), **OP sets** (data-miner), **tests intégration + e2e**, `docs/test-plan.md`.

## Architecture core

### 1. Mémoire d'objet (`PokemonInstance`)
Nouveaux champs :
- `consumedItemId?: HeldItemId` — dernier objet consommé par son effet (D1).
- `ateBerryThisBattle?: boolean` — a mangé ≥1 baie (D7).
- `critStageBoost?: number` — stage de crit persistant (D11).

`handleKo` : clear `critStageBoost` (les autres persistent — `consumedItemId` survit pour Recyclage post-réveil, `ateBerryThisBattle` est un fait de partie).

### 2. Helpers de transfert (`packages/core/src/battle/held-item-transfer.ts`, NOUVEAU)
Source unique de vérité, **émettent les events**, respectent Glu (D12) et Substitut (D5) :
- `consumeHeldItem(mon, { recyclable })` — pose `consumedItemId` si `recyclable`, `ateBerryThisBattle` si baie, vide `heldItemId`. **Remplace les 4 sites `heldItemId = undefined` de consommation** (refacto, zéro régression attendue).
- `removeHeldItem(target, attacker?)` — retrait non recyclable (Sabotage/Gaz Corrosif/Calcination). Bloqué par Glu.
- `stealHeldItem(attacker, target)` — vol si mains vides (D2). Bloqué par Glu cible.
- `swapHeldItems(a, b)` — échange (D3). Bloqué par Glu de l'un ou l'autre.
- `recycleConsumedItem(mon)` — restaure `consumedItemId → heldItemId`, clear `consumedItemId`.

### 3. EffectKind + handlers
Nouveaux `EffectKind` (+ `handle-*.ts` enregistrés dans `effect-processor.ts`) :
| EffectKind | Move(s) | Comportement |
|---|---|---|
| `RemoveItem` | Sabotage (post-dégâts), Gaz Corrosif | retrait non recyclable ; flag `knockOff` pour le ×1.5 amont |
| `StealItem` | Larcin, Implore | dégâts puis vol si mains vides |
| `SwapItems` | Tour de Magie, Passe-Passe | échange |
| `FlingItem` | Dégommage | puissance = table fling, retire objet lanceur |
| `EatTargetBerry` | Picore, Piqûre | mange la baie de la cible (effet au lanceur) |
| `BurnTargetItem` | Calcination | détruit baie/gemme cible (aucun effet) |
| `RecycleItem` | Recyclage | restaure objet consommé |

Sabotage = `effects: [{Damage, knockOffBoost:true}, {RemoveItem, knockOff:true}]`. Larcin/Implore = `[{Damage}, {StealItem}]`. Picore/Piqûre = `[{Damage}, {EatTargetBerry}]`. Calcination = `[{Damage}, {BurnTargetItem}]`. Éructation = `[{Damage}]` + flag move `requiresEatenBerry`. Recyclage/Tour de Magie/Passe-Passe/Gaz Corrosif = statut.

`knockOffBoost` : flag `MoveDefinition` lu dans `damage-calculator.ts` (×1.5 si cible a objet retirable, D4).
`requiresEatenBerry` : flag move filtré dans `getLegalActions` + gardé `submitAction` (D7).

### 4. Table fling power (`packages/data`)
`FLING_POWER: Partial<Record<HeldItemId, number>>` — valeurs canon pour les objets de notre pool (baies 10, orbes 30, gemmes 10, Loupe 30, etc.). Pas d'entrée → Dégommage échoue.

### 5. Baies Lansat/Frista (`packages/core/src/battle/items/`)
- Lansat (`lansat-berry`) : factory pincement (réutilise le pattern `pinchStatBerry`), effet `critStageBoost += 2` (D11), `isBerry: true`.
- Frista (`starf-berry`) : pincement → +2 sur une stat **aléatoire** (PRNG du moteur, déterministe seedé). `isBerry: true`.

## Events / i18n / UI
Nouveaux `BattleEvent` : `ItemRemoved`, `ItemStolen`, `ItemsSwapped`, `BerryEatenByEnemy`, `ItemBurned`, `ItemRecycled`, `ItemFlung`, `MoveFailedNoItem`, `MoveFailedNoBerry`, `ItemTransferBlocked` (Glu). Clés i18n FR/EN, cas `BattleLogFormatter`. Tags `MoveTooltip` (« retire l'objet », « vole l'objet », « échange l'objet », « nécessite une baie mangée »…). Aucun rendu moteur nouveau (effet purement logique + journal).

## IA (`action-scorer.ts`)
Heuristiques légères : Sabotage/Larcin/Gaz Corrosif = bonus si la cible porte un objet à valeur ; Larcin/Implore = bonus si mains vides ; Recyclage = légal/utile si `consumedItemId` présent ; Éructation = filtré si pas de baie mangée ; Dégommage = bonus selon fling power de l'objet tenu ; Tour de Magie/Passe-Passe = situationnel (refiler Choice/Orbe — v1 simple, faible priorité).

## OP sets
data-miner : porteurs Gen-1 pertinents (Sabotage très répandu — leads physiques ; Larcin sur fragiles ; Tour de Magie sur murs Choice-trick). Mettre à jour `docs/op-sets-gap-analysis.md` si besoin.

## Tests
- Unit : 1 fichier/move (`battle/moves/{id}.test.ts`) + `held-item-transfer.test.ts` + `lansat-berry.test.ts` / `starf-berry.test.ts` + Glu (`abilities.integration.test.ts`).
- Intégration : vol/échange/retrait bout-en-bout, Recyclage après baie mangée, Éructation gate, Dégommage par fling power, Picore mange baie + applique effet, Substitut bloque l'item-manip (D5), Glu bloque (D12).
- e2e : ≥1 scénario pilotable (ex. Larcin vole, Recyclage restaure, Éructation après baie) + MAJ `docs/test-plan.md`.

## Différés (notés backlog)
- Carton Rouge / Bouton Fuite (réaction au coup → switch/repositionnement forcé) — **hors scope**, prérequis = mécanisme de switch forcé, pas l'item-manip. Reste différé.

## Récap chiffres
- **411 → 423 moves** (+12).
- **+2 baies** (Lansat, Frista).
- **+1 talent** (Glu) → talents 103 → 104.
- OP sets : +N (data-miner).
