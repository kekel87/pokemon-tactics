# Plan 138 — Talents Tier C (batch 17 nouveaux talents)

> **Statut** : `implémenté`
> **Branche/worktree** : `talents` (port 5183)
> **Scope** : Groupe A (Engrais/Brasier/Torrent/Essaim) **déjà implémenté** via `pinchBooster` → 17 nouveaux handlers (B météo-dégâts + C cheap + D medium). **78→95 talents.**
> **Décision design** : Force Soleil = ×1.5 moves spéciaux, **cumul plein** avec le boost météo Feu (×2.25 sur Feu spécial au Soleil — canonique, validé humain 2026-06-22). Contrepoids : perte 1/8 PV/tour au soleil + coût CT.

## Contexte

77 talents implémentés (Tier A plan 136, Tier B plan 137). 40 portés par ≥1 des 151 Gen 1 restent. Triage par coût moteur :

- **A. Pinch type-boost (4)** : Engrais/Brasier/Torrent/Essaim — ×1.5 puissance du type quand PV ≤ 1/3.
- **B. Météo-dégâts (5)** : Force Soleil/Force Sable/Peau Sèche/Feuille Garde/Envelocape — **thread `Weather` dans le contexte de dégâts** (le chantier moteur promis plan 137).
- **C. Réactif/stat cheap (6)** : Armurouillée/Pieds Confus/Pied Véloce/Anti-Bruit/Télécharge/Peau Miracle.
- **D. Medium (6)** : Agitation/Analyste/Puanteur/Suintement/Boom Final/Infiltration.

### Déféré hors batch (raison technique)
- **Sans Limite** (sheer-force) et **Sérénité** (serene-grace) : manipulent « l'effet secondaire » d'un move. Le moteur **n'a pas d'objet secondaire** (les effets sont une liste `EffectKind` avec chance par-effet, sans notion uniforme de primaire/secondaire). Les implémenter exige d'abord une **abstraction « effet secondaire »** → plan dédié ultérieur. Reclassés depuis « medium ».
- Reste (run-away/pickup/harvest/frisk/anticipation/forewarn = overworld/info ; imposter/mold-breaker/neutralizing-gas = plans séparés ; gluttony/unnerve/sticky-hold = couplage objet ; arena-trap/healer/friend-guard/damp = niche faible valeur 1v1) : hors batch.

## Les 21 talents

### A — Pinch type-boost (`onDamageModify` attaquant, hooks existants)
Factory `pinchTypeBoost(abilityId, type)` : si `isAttacker` && `move.type === type` && `self.currentHp / self.maxHp ≤ 1/3` → ×1.5 (sinon 1). `DamageModifyContext` expose déjà `move` + `self` (PV). Zéro moteur.

| FR | id | Type | Porteurs |
|----|-----|------|----------|
| Engrais | overgrow | Plante | Bulbizarre line |
| Brasier | blaze | Feu | Salamèche line |
| Torrent | torrent | Eau | Carapuce line |
| Essaim | swarm | Insecte | Dardargnan, Insécateur |

### B — Météo-dégâts (nécessite `weather` dans les contextes)
| FR | id | Effet | Mécanisme |
|----|-----|-------|-----------|
| Force Soleil | solar-power | Plein Soleil : ×1.5 AtqSpé (moves spé) **et** perd 1/8 PV max en fin de tour | `onDamageModify` (`weather===Sun` && move spécial → 1.5) + `onEndTurn` (weather===Sun → dégât 1/8) |
| Force Sable | sand-force | Tempête de Sable : ×1.3 aux moves Roche/Sol/Acier (+ immunité chip sable) | `onDamageModify` (`weather===Sandstorm` && move.type ∈ {Rock,Ground,Steel} → 1.3). Immunité chip = `blocksIndirectDamage`-like via weather (réutilise pattern overcoat ci-dessous) |
| Peau Sèche | dry-skin | Pluie : soin 1/8 fin de tour ; Soleil : perte 1/8 ; Feu reçu ×1.25 ; (immunité Eau → soin) | `onEndTurn` (Rain heal / Sun loss) + `onDamageModify` défenseur (move Feu → 1.25). **Immunité Eau→soin** = `onTypeImmunity` Eau (miroir water-absorb déjà implémenté) |
| Feuille Garde | leaf-guard | Plein Soleil : bloque l'infliction de statut majeur | `onStatusBlocked` (`weather===Sun` → blocked) |
| Envelocape | overcoat | Immunité moves Poudre + chip météo (sable/neige) | `onMoveImmunity` (move.flags.powder → blocked) + immunité chip météo en fin de tour |

### C — Réactif/stat cheap
| FR | id | Hook | Effet |
|----|-----|------|-------|
| Armurouillée | weak-armor | `onAfterDamageReceived` | touché par move **physique** → Déf −1, Vitesse +2 |
| Pieds Confus | tangled-feet | `onEvasionModify` (défenseur) | ×0.5 précision entrante si le porteur est **confus** (≈ +esquive) |
| Pied Véloce | quick-feet | `statusSpeedBoost` (nouveau, CT) | ×1.5 Vitesse si statut majeur (mirror `weatherSpeedBoost`) |
| Anti-Bruit | soundproof | `onMoveImmunity` | immunité aux moves `flags.sound` |
| Télécharge | download | `onBattleStart` (mirror drought/onBattleStart existant) | à l'entrée : compare Déf/DéfSpé de l'adversaire le plus proche → +1 à l'Atk (si Déf ≤ DéfSpé) ou +1 AtqSpé |
| Peau Miracle | wonder-skin | `onEvasionModify` (défenseur) | moves **statut** entrants : précision ramenée à 50 % (×0.5 si move.category===Status) |

### D — Medium
| FR | id | Hook / moteur | Effet |
|----|-----|---------------|-------|
| Agitation | hustle | `onDamageModify` (×1.5 phys) + `onAccuracyModify` ability (nouveau, ×0.8 phys) | +50 % Atk physique, −20 % précision physique |
| Analyste | analytic | `onDamageModify` attaquant + ordre d'action | ×1.3 si le porteur agit **après** la cible (réutilise `lastActedAtAction`, cf fishious-rend) |
| Puanteur | stench | `onAfterDamageDealt` + `random` | 10 % d'apeurer la cible sur un move offensif |
| Suintement | liquid-ooze | hook dans `handle-drain` (nouveau `onDrainAttempt` défenseur) | quand on draine le porteur → l'attaquant **subit** les dégâts au lieu de soigner |
| Boom Final | aftermath | `onAfterDamageReceived` (existant) | si le porteur **est K.O.** par un move **contact** → l'attaquant perd 1/4 PV max |
| Infiltration | infiltrator | bypass dans defense-check / screens | ignore Abri-substitut, Mur Lumière/Protection, Voile Sacré, Brume de la cible |

## Changements moteur (isolés, ~6)

1. **`DamageModifyContext += weather: Weather`** — `handle-damage.ts` a déjà `activeWeather` (l.120) avant l'appel `calculateDamageWithCrit` (l.186). Ajouter un param trailing `weather: Weather = Weather.None` à `calculateDamageWithCrit` **et** au wrapper `calculateDamage` (~l.245-266, qui redélègue), passer `weather` dans les **4 builds** de `DamageModifyContext` de `calculateDamageWithCrit` (l.148-195). Default `None` → callers de test inchangés. **Requis : solar-power, sand-force, dry-skin.**
2. **`StatusBlockContext += weather: Weather`** — call-site unique `handle-status.ts:123`, threadé depuis `context.state`/`getEffectiveWeather`. **Requis : leaf-guard.**
3. **Nouveau hook `onMoveImmunity?(ctx: MoveImmunityContext): BlockResult`** (`ctx = { self, move }`) — invoqué au gate d'immunité de move dans `effect-processor.ts` (~l.126, juste à côté de `onTypeImmunity`, **avant** que les dégâts/effets soient appliqués). Si `blocked`, la cible est exclue de l'effet (même chemin que l'immunité de type) + émet `AbilityActivated`. **Requis : soundproof (sound), overcoat (powder).**
4. **Nouveau champ déclaratif `statusSpeedBoost?: { multiplier: number }`** — dans `initiative-calculator.ts` (l.25, mirror `weatherSpeedBoost`) + le call-site CT de `BattleEngine` : applique le multiplicateur si le porteur a un statut majeur. **Requis : quick-feet.**
5. **Nouveau hook ability `onAccuracyModify?(ctx: { self, target, move }): number`** (retourne un **multiplicateur**, ex ×0.8) — `accuracy-check.ts:61` invoque déjà `onAccuracyModify` côté **objet** ; ajouter le pendant **ability** au même call-site, multiplié séparément (pas de double comptage objet/ability). Signature identique au hook objet. **Requis : hustle (×0.8 phys).**
6. **Nouveau hook `onDrainAttempt?(ctx): { redirect: boolean; events }`** côté **défenseur (drainé)** dans `handle-drain.ts` — si présent et `redirect`, l'attaquant subit `lastDamageDealt * fraction` au lieu de soigner. **Requis : liquid-ooze.**

> **Analyste — accès à l'ordre d'action** : `DamageModifyContext` n'expose pas l'index d'action courant. Soit ajouter `state: BattleState` au contexte (et comparer `opponent.lastActedAtAction` à l'action en cours, comme fishious-rend le fait dans `dynamicPower`), soit exposer un booléen pré-calculé `targetAlreadyActed`. À trancher en impl (préférence : `targetAlreadyActed: boolean` dans le ctx, calculé au call-site qui a déjà l'info — moins invasif que tout `state`).

**Sans moteur nouveau** : A (pinch, ctx existant), aftermath (onAfterDamageReceived + check K.O.), analytic (lastActedAtAction), stench (onAfterDamageDealt), weak-armor/tangled-feet/wonder-skin (hooks existants), download (onBattleStart existant), dry-skin immunité Eau (onTypeImmunity existant).

> **Note infiltrator** : pas de nouveau hook unique — flag `infiltratorBypass` lu aux points existants (Abri-substitut dans `handle-post-substitute`/`defense-check`, screens dans le calcul `screenMultiplier`, Voile Sacré/Brume dans `handle-status`). Le plus dispersé du batch ; à implémenter en dernier, intégration point par point.

## Émission d'événements
- A / weak-armor / download : `AbilityActivated` + `StatChanged`.
- solar-power / dry-skin fin de tour : `AbilityActivated` + `HpRestored`/dégât (miroir regenerator / vie perdue).
- leaf-guard / soundproof / overcoat : `AbilityActivated` quand `blocked === true` (convention plan 136).
- sand-force / hustle / analytic : `onDamageModify`/`onAccuracyModify` silencieux (convention multiplicateur).
- stench : `AbilityActivated` + pose `Flinch` quand le tirage passe.
- aftermath / liquid-ooze : `AbilityActivated` + dégât sur l'attaquant.

## Tests (test-first par mécanique)
`packages/core/src/battle/abilities.integration.test.ts` — 1 bloc par talent : effet gameplay + émission `AbilityActivated` quand visible. + tests unitaires ciblés pour les 6 changements moteur (weather dans damage ctx, onMoveImmunity, statusSpeedBoost, onAccuracyModify ability, onDrainAttempt).

## Ordre d'implémentation
1. Changements moteur 1-6 (+ tests unitaires moteur, core-guardian).
2. Factory A + 4 handlers.
3a. B (5), C (6), D sauf Infiltration (5) — handlers data sur hooks existants/nouveaux.
3b. **Infiltration en dernier** : flag `infiltratorBypass` câblé point par point (Abri-substitut, screens, Voile Sacré, Brume) — le plus dispersé, isolé pour limiter le risque.
4. e2e (3-4 scénarios observables : pinch boost, soleil Force Soleil, Anti-Bruit bloque un move sonore, Boom Final recul).
5. Gate complet + commit.

## Décisions de design à acter (decisions.md)
- **Pied Véloce + statut auto-induit** : sain pour les statuts subis ; surveiller le combo « se brûler volontairement + ×1.5 Vitesse » quand le roster d'objets consommables s'élargira. À documenter, pas bloquant.
- **Force Soleil empilement météo** : voir question tranchée avec l'humain (cf en-tête après validation).

## Exclus (rappel)
Sans Limite + Sérénité → plan « modèle effet secondaire ». Brise Moule/Gaz Inhibiteur/Imposteur → plans séparés. Overworld/info-pure → non pertinents (jeu = info complète).
