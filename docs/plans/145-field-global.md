# Plan 145 — Field global (Gravité, Vent Arrière, Zone Étrange, Zone Magique)

**Statut : DONE (livré 2026-07-02)**
**Phase 4 — Mécaniques restantes, famille « Field global ».**

## But

4 moves d'effet « pleine arène » du canon, **relocalisés** selon la philo projet (tout est positionnel ; seule la météo reste full-arène). 440 → **444 moves**.

| Move (FR / id) | Type / cat. | Effet relocalisé | Modèle | Learners G1 |
|----------------|-------------|------------------|--------|-------------|
| **Gravité** (`gravity`) | Psy / Statut | Dans la zone : Volants cloués au sol + précision ×5/3 contre une cible en zone | Zone diamant | 12 |
| **Vent Arrière** (`tailwind`) | Vol / Statut | Vent directionnel global : `orientation == D` → ctGain ×1.5 | Champ global directionnel | 15 |
| **Zone Étrange** (`wonder-room`) | Psy / Statut | Dans la zone : Déf ↔ Déf Spé échangées | Zone diamant | 11 |
| **Zone Magique** (`magic-room`) | Psy / Statut | Dans la zone : objets tenus neutralisés | Zone diamant | 5 |

Tous ont des porteurs légaux Gen 1 (aucun drop). Source learners : `data-miner` 2026-06-29.

---

## Partie A — les 3 zones diamant (Gravité / Zone Étrange / Zone Magique)

**Décision de forme** : mirror exact de Distorsion (plan 130) — diamant Manhattan **r3** figé au cast, centré sur le lanceur, décompte « tours du lanceur » + horloge fantôme (survit au KO), re-cast au même épicentre = remplace, ailleurs = coexiste. L'effet s'applique aux Pokémon **debout sur une case couverte**.

### Infra commune — zone générique paramétrée

Plutôt que 3 systèmes copiés, **un seul** type de zone discriminé par `kind`, calqué sur `DistortionZone` :

```ts
// types/field-global-zone.ts
export const FieldGlobalKind = {
  Gravity: "gravity",
  WonderRoom: "wonder-room",
  MagicRoom: "magic-room",
} as const;
export type FieldGlobalKind = (typeof FieldGlobalKind)[keyof typeof FieldGlobalKind];

export interface FieldGlobalZone {
  kind: FieldGlobalKind;
  casterId: string;
  tiles: Position[];
  anchor: Position;
  remainingTurns: number;
}
```

- `state.fieldGlobalZones: FieldGlobalZone[]` (nouveau champ BattleState, init `[]` partout).
- `field-global-system.ts` (mirror `distortion-system.ts`) : `postFieldGlobalZone(state, caster, kind)`, `isInFieldGlobalZone(state, position, kind)`, `decrementFieldGlobalTimer(state, casterId)`. Réutilise `enumerateZoneTiles`. Constantes `FIELD_GLOBAL_DURATION = 5`, `FIELD_GLOBAL_RADIUS = 3`.
- Re-cast **même épicentre + même kind** = remplace (refresh timer). Épicentre différent ou kind différent = coexiste. (deux kinds peuvent se superposer sur la même case.)
- 1 `EffectKind.PostFieldGlobal` + handler `handle-post-field-global.ts` (lit `effect.fieldGlobalKind`, pose, émet `FieldGlobalPosted { kind }`).
- Tick : `fieldGlobalDecrementHandler` (end-turn, même priorité band que distortion ~268), + `hasEnvironmentalEffectSetBy` / `tickGhostTurn` étendus. `FieldGlobalExpired { kind }` à l'expiry.
- **Preview** : `selfPreviewRadius` retourne `FIELD_GLOBAL_RADIUS` pour un move `PostFieldGlobal` → diamant r3 affiché au cast.

### Sémantique par kind (locus de lecture)

**Gravité** — pour un Pokémon sur case couverte :
1. **Cloué au sol** : `isEffectivelyFlying` doit retourner `false`. Comme la signature `(pokemon, types)` ne porte pas l'état et a ~47 sites d'appel, on ajoute un helper `isGroundedByGravity(state, pokemon)` (dans `effective-flying.ts`) et on le combine aux **3 sites exacts** qui comptent pour le clouage (NE PAS réécrire les 47 sites) : `grounded = !isEffectivelyFlying(...) || isGroundedByGravity(state, mon)` à
   - **immunité Sol** (effectiveness) dans `damage-calculator.ts`,
   - **hazards au sol** dans `entry-hazard-system.ts`,
   - **knockback** dans `handle-knockback.ts`.
2. **Précision ×5/3** : appliquée dans `checkAccuracy` quand le **défenseur** est en zone Gravité (la cible est plaquée → plus dure à esquiver). Multiplicatif, cumulable avec les modificateurs précision objets/talents.
3. **Moves aériens/saut désactivés** (canon, validé humain) : un lanceur debout dans une zone Gravité ne peut pas utiliser un move « aérien ». Règle dérivée — pas de liste à maintenir :
   - tout move avec `semiInvulnerableState === SemiInvulnerableState.Flying` → bloqué (chope **Vol**/`fly` + **Rebond**/`bounce`, future-proof).
   - + flag explicite `disabledUnderGravity?: boolean` sur les moves de saut/lévitation → tagué sur **Pied Voltige**/`high-jump-kick` (seul cas actuel ; futurs Saut/Vol Magnétik hériteront).
   - **Tunnel** (`dig`, Burrowing) et **Plongée** (`dive`, Diving) **restent jouables** (au sol/sous l'eau, pas aériens — canon-correct). Spectroforce/Manœuvre Ombre (Vanished) idem.
   - Filtre dans `getLegalActions` + garde `submitAction` : si `isInFieldGlobalZone(state, caster.position, Gravity)` et move aérien → exclu/refusé. (Move déjà en cours de charge T1 : laisser finir T2 — ne pas interrompre un Vol amorcé ; bloquer seulement le déclenchement T1.)

**Zone Étrange** (`wonder-room`) — pour un Pokémon **défenseur** sur case couverte : dans `damage-calculator.ts`, **échanger les stats défensives** (Déf ↔ Déf Spé). Un coup physique tape alors la Déf Spé et inversement. Les crans suivent leur slot d'origine (canon Gen 6+ : seules les bases swappent, le cran reste collé à son emplacement). Locus précis (corrigé revue) : swapper **`defenseStat` ET `defenseStage`** (les deux ensemble, ~l109-114) **avant** l'appel `getEffectiveStat` (~l138-139), si `isInFieldGlobalZone(state, defender.position, WonderRoom)`. Ainsi le cran reste appliqué au bon slot après swap des bases.

**Zone Magique** (`magic-room`) — pour un porteur sur case couverte : **tous les effets d'objet tenu sont supprimés**. ⚠️ Les modificateurs d'objet sont **inlinés sur 5-6 sites** (pas un dispatch unique) : `getCtGainForPokemon`, `accuracy-check.ts`, `damage-calculator.ts`, immunité dégâts météo (`weather-tick-handler.ts`), handlers consommables (baies/herbe). → Créer **un helper unique** `getActiveHeldItem(state, pokemon): HeldItemId | undefined` (retourne `undefined` si le porteur est dans une zone Magique) et router **tous** ces sites de lecture d'objet à travers lui (réduit la surface d'oubli). L'objet reste tenu (pas consommé), juste inerte tant que le porteur est dans la zone.

---

## Partie B — Vent Arrière (`tailwind`) — champ global directionnel

**Pas une zone, pas team-scoped : un vent directionnel unique partagé.**

- État : `state.tailwind?: { direction: Direction, remainingTurns: number }` (nouveau champ BattleState, optionnel). **Un seul actif** ; re-cast (par n'importe quelle équipe) **remplace** (direction + reset 5t).
- Direction choisie au cast parmi N/S/E/O (réutilise l'input directionnel existant — voir Renderer).
- **Effet** : tout Pokémon (les 2 équipes) dont l'orientation alignée == `tailwind.direction` reçoit **ctGain ×1.5** (validé humain — équivalent d'une Hâte +2 permanente, lisible, ne bypass pas le plafond log de la courbe CT ; ×2 jugé trop snowball par game-designer).
  - Locus : `BattleEngine.getCtGainForPokemon(id)` (~l3004, source unique, déjà le point d'inversion Distorsion → la timeline `predictCtTimeline` reflète gratuitement le boost).
  - **Snapshot à la frontière de tour** : l'alignement est évalué sur l'orientation **au début/fin du tour** du Pokémon, pas recalculé mid-turn.
  - ⚠️ **Audit pré-impl OBLIGATOIRE** (revue) : `grep -rn "\.orientation\s*=" packages/core/src/battle/` pour lister les chemins qui mutent `orientation`. Si l'orientation ne change QUE sur les actions/déplacements propres du mon → lire `pokemon.orientation` directement suffit (stable entre deux tours). **Si un effet réoriente un mon hors de son tour** (knockback, poussée, slide glace…) → ajouter un champ `ctOrientationSnapshot: Direction` sur `PokemonInstance`, figé à chaque frontière de tour, et lire celui-là dans `getCtGainForPokemon`.
- **Durée** : décompte **round-global** (après que tous les Pokémon ont joué), PAS « tours du lanceur » — effet neutre non possédé. ⚠️ (revue) la météo décrémente en réalité « tours du lanceur » → ne PAS piggyback dessus. Créer un `tailwindDecrementHandler` **distinct**, dispatché à la phase de fin-de-round (localiser la phase end-of-round dans `BattleEngine.ts`). `TailwindEnded` à l'expiry.
- **Cumul** : ×1.5 Vent Arrière **après** le modificateur Distorsion (un mon en zone Distorsion ET aligné au vent : on inverse d'abord la vitesse, puis ×1.5 sur le gain résultant). Ordre à figer dans `getCtGainForPokemon`.

### Affichage Vent Arrière

HUD type **météo** (`WeatherHud` top-center), mais **flèche de direction** à la place de l'icône météo + compteur de tours. Réutilise le composant flèche directionnelle existant (picker direction moteur, plan 120). Pas de pill in-world (effet global, pas localisé).

---

## Fichiers touchés (estimation)

**Core**
- `types/field-global-zone.ts` (+ index), `enums/field-global-kind.ts`
- `battle/field-global-system.ts` (+ index)
- `enums/effect-kind.ts` (`PostFieldGlobal`), `enums/battle-event-type.ts` (`FieldGlobalPosted`/`Expired`, `TailwindSet`/`Ended`)
- `types/battle-event.ts`, `types/effect.ts` (`fieldGlobalKind` + `tailwindDirection`), `types/battle-state.ts` (`fieldGlobalZones`, `tailwind?`)
- `battle/handlers/handle-post-field-global.ts`, `handle-set-tailwind.ts`
- `battle/handlers/field-global-tick-handler.ts`, `tailwind-tick-handler.ts`
- `battle/effect-processor.ts` (register 2 handlers), `battle/BattleEngine.ts` (ctGain ×1.5 Vent Arrière ~l3004 APRÈS Distorsion + `tailwindDecrementHandler` end-of-round + `hasEnvironmentalEffectSetBy` ~l3267 étendu aux `fieldGlobalZones` pour ghost clock + register)
- `battle/damage-calculator.ts` (swap `defenseStat`+`defenseStage` Zone Étrange avant `getEffectiveStat` ~l138 + lecture objet via `getActiveHeldItem`)
- `battle/accuracy-check.ts` (~l85-93 : ×5/3 Gravité si défenseur en zone ; déjà reçoit `state`)
- `battle/effective-flying.ts` (helper `isGroundedByGravity(state, pokemon)`) + 3 sites : `damage-calculator.ts` (immunité Sol), `entry-hazard-system.ts`, `handle-knockback.ts`
- **helper unique** `getActiveHeldItem(state, pokemon)` (nouveau fichier, ex. `battle/item-suppression.ts`) routé sur les 5-6 sites de lecture d'objet (ctGain, accuracy, damage, immunité météo, consommables) pour Zone Magique
- `getLegalActions` + `submitAction` (filtre moves aériens sous Gravité)
- `ai/action-scorer.ts` (scoring des 4 — voir IA)
- `testing/build-test-engine.ts` (~l116) : `fieldGlobalZones: []` + `tailwind: undefined` dès la construction de base
- `index.ts` : **exporter** `field-global-zone`, `field-global-kind`, `field-global-system` (checklist : tout nouveau fichier core exporté)

**Data** : `overrides/tactical.ts` (4 moves), `op-sets/op-sets.json` (sets pertinents : porteur Vent Arrière oiseau, Gravité Magnéton, etc. — `data-miner`).

**Renderer** : `render-ports` + `combat-scene.ts` (3e instance `createFieldTerrains` pour les zones field-global, couleurs distinctes par kind), `battle-board-view.ts`, `battle-orchestrator.ts` (`refreshFieldGlobalVisuals` + `refreshTailwindHud`), `view-core/constants.ts` (couleurs zones), input direction réutilisé pour Vent Arrière (`select_direction` façon Dash/picker), `WeatherHud` étendu (mode flèche), `BattleLogFormatter.ts`, `move-tooltip.ts` (tags).

**i18n** : `app/i18n/{fr,en,types}.ts` (`gravity.posted`, `wonderRoom.posted`, `magicRoom.posted`, `tailwind.set`, tooltips).

**Init state** : `BattleSetup` + `testing/build-test-engine.ts` + toutes les fixtures (`fieldGlobalZones: []`, `tailwind` absent).

---

## IA (`scoreSelfMove`)

- **Zones (Gravité/Étrange/Magique)** : mirror Distorsion — `-1` si une zone du même kind du lanceur est déjà active sous lui ; sinon `weights.statChanges × setterDurabilityMultiplier × (nb cibles affectées avec bénéfice)`. Heuristiques fines (Gravité vs ennemi Volant, Zone Magique vs objet ennemi de valeur, Zone Étrange vs profil défensif) → **passe IA dédiée** (lot type-manip / item-interaction), notées dans `docs/next.md`. Score de base raisonnable pour que l'IA les joue parfois.
- **Vent Arrière** : bonus si des alliés sont orientés (ou orientables) vers une direction utile + menace de vitesse ennemie. v1 = score modéré ; raffinage → passe IA dédiée.

---

## Tests

- `field-global-system.test.ts` : post/replace même épicentre+kind, coexistence kinds, `isInFieldGlobalZone`, décompte caster-only + expiry + ghost.
- `moves/gravity.test.ts` : Volant en zone touché par Sol, précision ×5/3 vs cible en zone, **Vol/Rebond/Pied Voltige interdits si lanceur en zone** (Tunnel/Plongée OK), expiry 5t lanceur.
- `moves/wonder-room.test.ts` : swap Déf/DéfSpé en damage calc (coup physique tape DéfSpé), hors zone normal.
- `moves/magic-room.test.ts` : objet inerte en zone (ex. Choix/Orbe), redevient actif hors zone, non consommé.
- `moves/tailwind.test.ts` : ctGain ×1.5 si orientation alignée via `predictCtTimeline`, pas de boost si orienté autrement, remplacement direction, expiry round-based, cumul avec Distorsion.
- Intégration : 1 scénario par move + e2e (test-writer + `docs/test-plan.md` §5/§11).

---

## Revue intégrée (2026-06-29)

`plan-reviewer` + `game-designer` passés. Ajustements intégrés ci-dessus :
- **Vent Arrière ×2 → ×1.5** (game-designer, validé humain).
- **Audit `orientation` pré-impl** + fallback `ctOrientationSnapshot` (plan-reviewer).
- **`getActiveHeldItem` helper unique** pour Zone Magique (5-6 sites inlinés, plan-reviewer).
- **`tailwindDecrementHandler` distinct end-of-round** (pas piggyback météo, plan-reviewer).
- **Swap Zone Étrange** = `defenseStat`+`defenseStage` avant `getEffectiveStat` (plan-reviewer).
- **3 sites `isGroundedByGravity`** précisés + init fixtures + exports `index.ts`.
- À vérifier pendant l'impl : `selfPreviewRadius` Distorsion existe bien côté renderer et est réutilisable.
- IA : stubs baseline (copie `PostDistortion` + `TailwindSet`), raffinage → `docs/next.md`.

Verdict game-designer : Gravité + Zone Étrange = meilleur potentiel tactique immédiat ; Zone Magique propre mais contre-méta situationnel ; famille cohérente. Aucun blocage.

## Hors scope / différé

- Heuristiques IA fines des 4 moves → passe IA dédiée (`docs/next.md`).
- Téra / changements de type self (déjà couverts plan 143).

## Décisions (#591–#594, voir docs/decisions.md)

- #591 Field global relocalisé (3 zones diamant + 1 vent directionnel), pas full-arène — cohérence projet.
- #592 Gravité : `isGroundedByGravity` sur 3 sites exacts (pas réécriture des 47 appels `isEffectivelyFlying`).
- #593 Vent Arrière = vent directionnel unique global, ctGain **×1.5** (révisé depuis ×2, validé game-designer) sur `orientation == D`, snapshot frontière de tour, décompte round-based, HUD flèche.
- #594 Zone Magique : helper unique `getActiveHeldItem` ; Zone Étrange : swap `defenseStat`+`defenseStage` ensemble.
- Zone générique paramétrée `FieldGlobalKind` plutôt que 3 systèmes copiés.

## Livraison (2026-07-02)

4 moves livrés : Gravité, Zone Étrange, Zone Magique, Vent Arrière. **440 → 444 moves.** Boussole 3D always-on + HUD flèche Vent Arrière ajoutés hors périmètre move (support visuel). Voir `docs/implementations.md`, `STATUS.md`, `docs/roadmap.md` (Phase 4 → famille close).
