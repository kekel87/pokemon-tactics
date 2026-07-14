# Plan 159 — IA compétente sur « Le Mur » (ring-out par recul) + passe heuristiques haut-impact + carte dispo

> **Statut** : done
> **Créé** : 2026-07-14
> **Clôturé** : 2026-07-14
> **Décisions humain** : (1) passe heuristiques IA = **sous-ensemble haut-impact d'abord**, itératif ; (2) heuristiques sur **tous** les niveaux via poids gradués (archi actuelle : scoring identique, la difficulté module `randomWeight`/`topN`, PAS de branches par difficulté) ; (3) **la glace n'est PAS décorative** — la carte « Le Mur » existe pour la mécanique **recul → glissade sur glace → chute du mur = KO** (ring-out). L'IA doit la maîtriser.

## Diagnostic empirique (agent `ai-player`, 6 combats 3v3, pipeline IA réel)

- **Carte valide** (`validateTiledMap` → 0 erreur, test permanent vert). Vrai **mur pyramidal** : centre (x=5-10, y=6-9) `height` 4.0-4.5 ; falaises abruptes infranchissables x=2-13 ; **seules rampes praticables x=0-1 et x=14-15**. Terrain neige (bords) + **glace** (partout ailleurs) + 4 **obstacles** (4,4)(11,4)(4,11)(11,11). Combat sain (6/6 vainqueurs, franchissement par les rampes, pas de stall).
- **Mécanique ring-out confirmée dans le code** :
  - Recul (`EffectKind.Knockback`) pousse la cible de `distance` tuiles ; le bord de carte **bloque** (`KnockbackBlocked "edge"`, jamais de sortie de carte).
  - Atterrir plus bas → `calculateFallDamage(heightDiff)` : `heightDiff` ≥4 = **100% PV (KO sec)**, =3 = 66%, =2 = 33%, ≤1 = 0. Le drop plateau→sol (≈4) = **KO garanti par chute**.
  - Atterrir sur terrain infranchissable (Obstacle/DeepWater/Lave) → `LethalTerrainKo` (KO instantané). 4 obstacles sur la carte.
  - Sur **glace** (non immunisé) → `performIceSlide` : glisse dans la même direction jusqu'à bord / obstacle (impact) / collision (dégâts mutuels) / fin de glace. Prolonge une poussée distance-1 sur tout le plateau → peut faire tomber du mur.
  - Immunités : type Glace ou Volant → pas de glissade ni chute (`isFlying`).
- **Moves à recul (`Knockback`, distance 1)** : **Draco-Queue** (`dragon-tail`), **Coud'Krâne** (`skull-bash`), **Draco-Charge** (`dragon-rush`).
- **L'IA n'a AUCUNE notion du ring-out** : `action-scorer.ts` score ces moves sur leurs seuls dégâts directs, ignore le déplacement/chute/glissade résultants.

### Autres défauts IA (secondaires, spécifiques relief)
- **Bug `estimateDamage`** : calcule hauteur/terrain/facing depuis `attacker.position` (BattleEngine.ts:395/402/411), pas depuis la position candidate du lookahead → l'IA sous-évalue grimper le plateau pour tirer en hauteur.
- **Lookahead sans ligne de vue** : `evaluateAttacksFromPosition` compare seulement `manhattanDistance ≤ getMoveMaxReach`, jamais `hasLineOfSight`/`heightBlocks` → « sniper fantôme » à travers le mur.
- **Oscillation** (mineur, 2/6 runs) : ciblage « plus proche » sans mémoire.

---

## Volet A — IA maîtrise le ring-out du Mur *(priorité, raison d'être de la carte)*

### A1. Prédicteur pur partagé `battle/knockback-prediction.ts`
Extraire la géométrie de `handle-knockback.ts` (déplacement + glissade + chute + terrain létal) dans une fonction **pure, sans mutation** :
```ts
interface KnockbackOutcome {
  readonly finalPosition: Position;       // où la cible finit
  readonly fallDamage: number;            // dégâts de chute cumulés (chute + glissade)
  readonly lethal: boolean;               // KO garanti (terrain létal, ou fallDamage ≥ currentHp)
  readonly slideCollisionId: string | null; // collision avec un mon pendant la glissade
}
function predictKnockback(
  attackerPos: Position, target: PokemonInstance, distance: number,
  grid: Grid, targetTypes: PokemonType[], state: BattleState,
): KnockbackOutcome | null;  // null si la poussée est bloquée d'emblée (edge/occupé)
```
**`handle-knockback.ts` refactoré pour appeler ce prédicteur** (source unique, zéro dérive). Le handler garde l'émission d'events + mutation ; le prédicteur ne fait que calculer la trajectoire/issue. Tests unit existants (`knockback.test.ts`, `mechanics/knockback.test.ts`) doivent rester verts (garantie de non-régression du refactor).
Coût : O(distance + longueur_glissade) par appel — borné par la taille de la grille, négligeable.

### A2. Scoring IA du recul
Dans `scoreUseMove`, brancher quand `move.effects` contient `EffectKind.Knockback` :
- Pour chaque **ennemi** touché : `predictKnockback(...)`.
  - `lethal` → `killPotential` (× 1.5 si la cible est `highestThreatEnemy`, cf. primitives).
  - sinon → dégâts directs (chemin normal) **+** `fallDamage / maxHp × killPotential × 0.5` (bonus chute partielle).
- Pour chaque **allié** potentiellement touché (moves AoE ; les 3 actuels sont mono-cible, mais garder la garde) : `lethal` sur un allié → **malus dur** `-killPotential`.
- **Direction** : le recul pousse la cible dans la direction attaquant→cible (`getKnockbackDirection`). Le prédicteur intègre déjà cette direction, donc le score reflète la géométrie réelle depuis la position **actuelle** de l'attaquant.

### A3. Positionnement pour le ring-out — **Phase 2 (différé)**
Manœuvrer pour aligner ennemi/bord/soi (simuler le recul depuis chaque destination candidate dans `evaluateAttacksFromPosition`) est puissant mais coûteux et complexe. **Différé** : en Phase 1 l'IA joue le ring-out quand la géométrie fonctionne déjà depuis sa case ; elle ne se déplace pas encore *exprès* pour le préparer. Noté `docs/next.md`.

### A4. Sécurité défensive (ne pas se faire éjecter) — **Phase 2 (différé)**
Éviter de stationner en bord de plateau quand un ennemi porte un move à recul. Nécessite de prédire le recul adverse. Différé.

---

## Volet B — Correctness du lookahead (relief) *(complète A, secondaire)*

- **B1** : ajouter param `attackerPosition?: Position` à `BattleEngine.estimateDamage`. Quand fourni, `attackerHeight` (L395), `attackerTerrain` (L402) **et** l'origine passée à `getAttackOrigin` (L411) se calculent depuis cette position au lieu de `attacker.position`. Défaut inchangé (rétrocompat, tous les appels existants). `evaluateAttacksFromPosition` passe `fromPosition`.
- **B2** : dans `evaluateAttacksFromPosition`, avant de compter un ennemi frappable depuis `fromPosition`, vérifier la ligne de vue / le blocage hauteur via un helper moteur `engine.canReachTargetFrom(fromPosition, targetPosition, move)` (réutilise la logique LoS/hauteur de `resolveEffectiveTargeting`, pas un raycasting neuf). Rejette les positions « sniper fantôme ». Comportement si aucun ennemi n'a de LoS depuis la destination : le bonus d'attaque du lookahead tombe à 0 (pas de fallback Manhattan côté lookahead — le fallback Manhattan reste uniquement dans `closestDistanceToEnemies` pour le repositionnement).
- **B3** : avantage hauteur explicite = **PAS** de constante dédiée (émergent de B1). Réévaluer seulement si le playtest montre que l'IA n'exploite pas le plateau.

---

## Volet C — Passe heuristiques haut-impact (trimmé)

Primitives partagées à ajouter dans `ai/threat-detection.ts` (signatures + coûts figés) :
```ts
// Meilleur dégât estimé de l'ennemi sur `self` (boucle ses moves) — O(M) par ennemi.
function bestEnemyDamageAgainst(enemy, self, engine): number;
// L'ennemi le plus menaçant = max bestEnemyDamageAgainst — O(N×M). N,M ≤ ~24, négligeable/tour.
function highestThreatEnemy(enemies, self, engine): PokemonInstance | null;
// Un move de l'ennemi nous met KO ? (bestEnemyDamageAgainst ≥ self.currentHp) — O(N×M).
function wouldKoUs(enemies, self, engine): boolean;
// Cible « en forme » : currentHp / maxHp ≥ ratio (défaut 0.7).
function isHealthyTarget(mon, ratio?): boolean;
```

Familles (garde-fou → valorisation) :
1. **OHKO** (`scoreOhko`) : conserver le socle (précision × valeur KO × (0.5+PV)), ajouter **×1.5 déni de menace** si la cible ∈ `highestThreatEnemy` ou `wouldKoUs`. Malus immunité + friendly-fire conservés.
2. **Malédiction** (`curse`, branche Spectre = DoT illimité) : valoriser fort contre `isHealthyTarget` (le DoT 25%/tour rentabilise le sacrifice 50% PV du lanceur), neutre/négatif si cible déjà basse **ou** si NOUS sommes bas (< 50% PV). (Nom FR = **Malédiction**, pas « Malédiction Spectre ».)
3. **Transform** (`scoreTransformApplication`) : à gap stat-total comparable, **préférer copier `highestThreatEnemy`** (copier le sweeper adverse > un tank équivalent).
4. **Crit-manip** (Puissance/Affilage, branche `hasCritSetup`) : le lookahead monoronde ne voit pas la séquence crit→finisher ; garder donc la branche explicite mais la **conditionner à la présence d'un gros move offensif au moveset** (sinon le crit ne paiera pas) ; neutraliser si aucun move offensif.
5. **Item-interaction** (Sabotage/Larcin/Tour de Magie/Passe-Passe) : valoriser selon l'objet **effectif** de la cible (voler/assommer un objet à fort impact) ; neutre si la cible n'a pas d'objet.

> **Différé Phase 2** (garde-fou actuel conservé) : Bâillement (setup avant finisher allié — demande un lookahead allié), Vol Magnétik (échappatoire Sol — demande détection de menace Sol), Faux-Chage/Poursuite fins, et les 10 familles restantes + objets 158.

**Note oscillation** : les heuristiques de reciblage (OHKO déni, Malédiction) recalculent la cible/tour sur un scorer stateless → risque d'amplifier l'oscillation observée. On **ne** traite pas la mémoire de cible ici (changement d'archi), mais on **surveille explicitement** en human-testing ; si visible, ticket dédié.

---

## Volet D — Rendre « Le Mur » disponible

Ajouter au `MAPS_REGISTRY` (`packages/app/src/maps/maps-registry.ts`) :
- `id: "le-mur"`, `url: "assets/maps/le-mur.tmj"`, `size: "16×16"`.
- `displayName: { fr: "Le Mur", en: "The Wall" }`.
- `description` FR : « Un mur de glace pyramidal domine le centre. Poussez vos adversaires dans le vide : sur la glace, ils glissent — et du haut du mur, la chute est fatale. » / EN équivalent.
- `tags: ["glace", "dénivelé", "chute"]`.

Test e2e : Le Mur apparaît dans la sélection + charge sans erreur.

---

## Séquencement & gate
1. **Volet A1** (prédicteur pur + refactor handler, tests knockback verts) → base.
2. **Volet A2** (scoring recul).
3. **Volet B** (fix estimateDamage + LoS lookahead).
4. **Volet C** (primitives + 5 familles).
5. **Volet D** (registre).
6. Gate CI full.

## Human-testing (1 scénario par item observable)
- **Ring-out** : IA face à un ennemi au bord du plateau + Draco-Queue/Coud'Krâne/Draco-Charge au moveset → l'IA pousse dans le vide (KO chute) plutôt qu'une frappe faible. Config : Dummy en bord de mur, IA avec move à recul.
- **Glissade** : recul sur glace qui charrie la cible jusqu'à la chute.
- **Hauteur** (B) : IA grimpe le plateau pour tirer en surplomb.
- **OHKO déni** : IA vise `highestThreatEnemy` au lieu de la cible la plus faible.
- **Malédiction** : IA la joue sur cible haute PV, pas sur cible basse.
- **Transform** : IA copie le sweeper.

## Décisions actées
- **D1** : glace = mécanique intentionnelle (ring-out), on la garde. ✅
- **D2** (`checkSpawnConnectivity` ignore la hauteur — angle mort validation) : **différé** `docs/next.md` (ne mord pas Le Mur ; utile pour l'éditeur de cartes futur).
- **D3** (oscillation / mémoire de cible) : **différé** — surveillance human-testing.

## Résultats de validation (headless, 2026-07-14)
- **Tous les volets livrés** (A1/A2, B1/B2/B3, C, D). Aucune branche par difficulté ajoutée — les heuristiques sont communes à tous les niveaux (décision humaine du plan).
- **A1** : `packages/core/src/battle/knockback-prediction.ts` (`predictKnockbackOutcome`, `resolveKnockbackDestination`, `resolveIceSlide`, `getKnockbackDirection`, `ICE_SLIDE_COLLISION_HEIGHT`) extrait de `handle-knockback.ts`, source unique. **31 tests knockback/chute verts, zéro régression** du refactor.
- **A2** : `scoreKnockbackRingOut` (`action-scorer.ts`) valorise Draco-Queue/Coud'Krâne/Draco-Charge quand la prédiction indique une chute/terrain létal pour l'ennemi. En validation (agent `ai-player`) : score du move à recul ring-out **× 9,4** vs l'alternative sans recul sur la même cible. Malus dur conservé si un allié serait éjecté.
- **B1/B2** : `BattleEngine.estimateDamage` accepte `attackerPosition?` (hauteur/terrain/facing recalculés depuis la case candidate) + garde `hasLineOfSightFrom` dans `evaluateAttacksFromPosition` (élimine les positions « sniper fantôme »). En validation : l'IA grimpe désormais le plateau du Mur pour tirer en surplomb, estimation de dégâts **× ~1,9** en faveur de la position en hauteur vs rester au sol.
- **C** : primitives `threat-detection.ts` (`bestEnemyDamageAgainst`, `highestThreatEnemy`, `wouldKoUs`, `isHealthyTarget`) + 5 familles (OHKO déni de menace, Malédiction ciblage PV élevés, Transform préférence sweeper, crit-manip conditionné à un move offensif, item-interaction valorisée si objet effectif présent).
- **D** : « Le Mur » (`le-mur.tmj`, 16×16) ajoutée au `MAPS_REGISTRY` — mur pyramidal central praticable uniquement par les rampes latérales, glace partout ailleurs. Distincte de l'ancienne carte `le-mur` du plan 066 (remplacée par la Toundra en 2026-04-24) : celle-ci est neuve, conçue spécifiquement pour le ring-out.
- **Human-testing validé** sur les 6 scénarios listés (ring-out, glissade, hauteur, OHKO déni, Malédiction, Transform).
- **Gate CI full vert** (build, lint, typecheck, unit, intégration, e2e).

### Anomalies pré-existantes signalées (hors périmètre 159)
- Test `magic-room`/Life Orb flaky (jets PRNG non seedés dans ce test) — reporté `docs/next.md`.
- `BattleEngine.getLegalActions` n'exclut pas un acteur qui viendrait de s'auto-KO par recul (soumet un `EndTurn` à vide) — garde `currentHp > 0` manquante, reporté `docs/next.md`.

## Reporté
- Volet A3/A4 (positionnement offensif/défensif pour le ring-out) → Phase 2.
- Heuristiques familles hors haut-impact + objets 158 → Phase 2.
- e2e Playwright des nouvelles heuristiques → via `test-writer` après validation.
- Anomalies pré-existantes signalées ci-dessus (test flaky, `getLegalActions` garde manquante) → non bloquantes, hors périmètre de ce plan.
