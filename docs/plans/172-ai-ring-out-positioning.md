# Plan 172 — IA : positionnement pour le ring-out (Phase 2 du plan 159)

> **Statut** : done
> **Créé** : 2026-07-24
> **Clos** : 2026-07-24
> **Origine** : plan 159 volets A3 (offensif) + A4 (défensif), différés. `docs/next.md` § À faire.

## Résultats de validation

Implémenté conforme au design ci-dessous. `BattleEngine.predictKnockback` étendu avec le
4ᵉ paramètre optionnel `attackerPosition?` (rétrocompat totale). A3 (`evaluateAttacksFromPosition`)
et A4 (`evaluateKnockbackVulnerability`, appelée depuis `scoreMove`) codés selon les décisions de
tuning actées (lethal-only des deux côtés, heuristiques communes à tous les niveaux de difficulté).
Tests unitaires A3/A4 verts, typecheck monorepo vert. Gate CI full à confirmer à la prochaine passe.

## Contexte

Plan 159 (Phase 1) a donné à l'IA la maîtrise du ring-out **quand la géométrie fonctionne déjà depuis sa case** : `scoreKnockbackRingOut` évalue le recul (Draco-Queue / Coud'Krâne / Draco-Charge) depuis la **position actuelle** de l'attaquant et crédite un KO par chute/glissade/terrain létal. Elle ne se déplace pas encore *exprès* pour aligner l'éjection, et ne fuit pas les positions où elle-même serait éjectée.

Deux volets différés :
- **A3 offensif** — manœuvrer pour aligner ennemi/bord/soi (bouger vers une case d'où le recul devient un ring-out).
- **A4 défensif** — éviter de stationner en bord quand un ennemi porte un move à recul qui m'éjecterait.

## État du code (repères)

- `packages/core/src/battle/knockback-prediction.ts` : `predictKnockbackOutcome({ attackerPosition, target, distance, grid, targetTypes, state })` — **pur, accepte déjà une position d'attaquant arbitraire**. Rien à changer côté prédicteur.
- `packages/core/src/battle/BattleEngine.ts:846` `predictKnockback(attackerId, target, distance)` — wrapper qui lit `attacker.position`. **À étendre** avec un `attackerPosition?` optionnel.
- `packages/core/src/ai/action-scorer.ts` :
  - `scoreKnockbackRingOut(...)` (l.718) — offensif depuis la position actuelle (Phase 1), inchangé.
  - `scoreMove(...)` (l.2458) — score une destination de déplacement : `positioning` + pénalité terrain dangereux + `evaluateAttacksFromPosition`.
  - `evaluateAttacksFromPosition(...)` (l.2507) — meilleure attaque **depuis** la destination (dégâts/KO/type), déjà LoS-aware (`hasLineOfSightFrom`) et hauteur-aware (`estimateDamage(..., fromPosition)`). **C'est le point d'ancrage naturel d'A3** (modèle Move+Act : la valeur de la case inclut ce qu'on y fait ensuite).

## A0 — Extension moteur (base commune)

`BattleEngine.predictKnockback` gagne un 4ᵉ paramètre optionnel `attackerPosition?: Position` :
```ts
predictKnockback(attackerId, target, distance, attackerPosition?): KnockbackOutcome | null
```
Défaut = `attacker.position` (rétrocompat totale, tous les appels Phase 1 inchangés). Passé tel quel à `predictKnockbackOutcome`.

Pour A4, la cible évaluée est **soi-même déplacé** : on prédit avec un clone superficiel `{ ...self, position: destination }` (le prédicteur ne lit de la cible que `position` / types / PV / flying, tous valides sur un clone). Aucun état muté.

## A3 — Positionnement offensif

Dans `evaluateAttacksFromPosition`, **gate coût** : ne rien faire si `pokemon` ne connaît aucun move à recul (`EffectKind.Knockback`) — cas ultra-majoritaire, coût nul.

Sinon, pour chaque move à recul × chaque ennemi à portée + LoS depuis `fromPosition` :
- `outcome = engine.predictKnockback(pokemon.id, enemy, distance, fromPosition)`.
- `outcome.lethal` → `ringOutScore = killPotential` (× 1.5 si `enemy === highestThreatEnemy`, cohérent Phase 1).
- **Décision de tuning #1** : chute partielle non létale depuis une case candidate → **ignorée** (le chip est déjà crédité depuis la position actuelle par `scoreKnockbackRingOut` ; le rajouter à chaque destination gonflerait le bruit de déplacement). Lethal-only côté positionnement.
- Repli sur soi : le prédicteur intègre déjà la direction attaquant→cible depuis `fromPosition`, donc bouger d'un côté ou de l'autre de l'ennemi change réellement l'issue → l'IA choisit la case qui aligne le vide.
- Fold dans `bestAttackScore` (même échelle que les KO directs) → soumis au `× 0.8` existant en sortie.

Friendly-fire : les 3 moves sont mono-cible ; garde symétrique (si un allié serait éjecté létalement depuis `fromPosition`, on n'attribue pas le bonus) conservée par prudence, coût négligeable.

## A4 — Sécurité défensive

Nouvelle fonction `evaluateKnockbackVulnerability(self, fromPosition, enemies, moveRegistry, engine, weights): number` (retour ≤ 0), appelée dans `scoreMove` et ajoutée au score de la destination.

**Gate coût** : ne rien faire si aucun ennemi ne connaît de move à recul.

Sinon, pour chaque ennemi porteur d'un move à recul dont la portée atteint `fromPosition` (manhattan ≤ reach **et** `hasLineOfSightFrom(enemy.position, fromPosition)`) :
- `outcome = engine.predictKnockback(enemy.id, { ...self, position: fromPosition }, distance, enemy.position)`.
- `outcome.lethal` (chute/glissade/terrain fatal ≥ PV) → pénalité.

**Décision de tuning #2 (à valider)** : pénalité = `−killPotential` **seulement quand l'éjection est létale** (perdre le mon). Décisive mais ne se déclenche que sur un vrai risque de mort — pas un évitement mou des bords qui rendrait l'IA passive. Le mon acceptera une case-bord si aucun ennemi n'a de recul, ou si le recul ne le tue pas.

> Volontairement **pas** de pénalité pour un recul non létal (repositionnement subi mais survivable) : trop de bruit, et l'IA a d'autres leviers.

## Décisions humaines à trancher avant code

1. **Offensif : lethal-only** depuis les cases candidates (recommandé) vs inclure aussi le chip de chute partielle.
2. **Défensif : `−killPotential` sur éjection létale uniquement** (recommandé, décisif mais ciblé) vs pénalité graduée incluant les reculs non létaux (plus prudent, risque d'IA passive).
3. Cohérence Phase 159 : **heuristiques communes à tous les niveaux** (pas de branche par difficulté). Reconduit.

## Tests

- **Unit** (`knockback-prediction.test.ts`) : `predictKnockback` avec `attackerPosition` explicite ≠ position réelle → issue calculée depuis la case fournie.
- **Unit** (`action-scorer.test.ts`) :
  - A3 : mon avec Draco-Queue, ennemi tel que le recul depuis la case actuelle **ne** ring-out **pas**, mais depuis une case adjacente candidate **si** → la destination alignante score > les autres.
  - A4 : deux destinations équivalentes en attaque, l'une exposant à un ring-out létal adverse → l'autre score plus haut.
- **Intégration** : scénario mini sur « Le Mur » (seedé) — l'IA se déplace pour éjecter / évite le bord fatal.
- **e2e** : reporté `test-writer` après validation (harness N-vs-N `scored`, plan 167).

## Human-testing

1. **Offensif** : ennemi près du vide mais pas aligné depuis la case IA ; l'IA se déplace pour aligner puis pousse (KO chute) au lieu d'une frappe faible sur place.
2. **Défensif** : IA à move faible près d'un bord, ennemi avec Draco-Queue à portée → l'IA quitte le bord au lieu d'y rester.

## Gate

CI full (l'e2e escalade auto sur diff `packages/core`).
