# Plan 220 — Le malus de déplacement devient une division

**Statut** : done
**Origine** : `backlog-malus-deplacement-marais-trop-punitif` (retour de l'humain, partie avec son frère, 2026-09-21).
Règle arrêtée en discussion le 2026-10-03.

## Ce que tu verras à l'écran

- Un Pokemon qui entre dans l'eau, le sable ou la neige voit sa portée de déplacement multipliée par ¾ (arrondi en dessous) : mvt 2/3/4/5 → 1/2/3/3 cases.
- Dans le marais, la portée est divisée par deux (arrondi en dessous) : mvt 2/3/4/5 → 1/1/2/2. Plus personne n'est bloqué, on fait toujours au moins 1 case.
- Le malus est payé **une fois** par déplacement, pas à chaque case ; si le trajet touche eau et marais, seul le plus fort compte.
- La fiche d'info de case affiche `🥾 ×¾` / `🥾 ×½` au lieu de `🥾 −1` / `🥾 −2`.
- Immunités inchangées (Poison/Acier/Vol dans le marais, Eau/Vol dans l'eau, etc.), Poison à l'arrêt dans le marais inchangé.

## La règle

> Si le trajet **entre** dans au moins une case de terrain pénalisé (non immunisé), le budget de déplacement devient
> `max(1, floor(mouvement × facteur))`, où `facteur` est le **plus petit** facteur des cases pénalisées entrées.
> Chaque case coûte ensuite 1. Sans case pénalisée entrée : budget = mouvement, inchangé.

| Terrain | Facteur |
|---|---|
| Eau, sable, neige | 3/4 |
| Marais | 1/2 |

- Case de **départ** : jamais comptée (on paie en entrant, comme aujourd'hui). Partir du marais vers la terre ferme est libre.
- Plancher `max(1, …)` seulement si `mouvement ≥ 1` (un Pokemon à 0 reste à 0).
- Facteurs 0.5 / 0.75 : exacts en binaire, pas de dérive flottante.
- **Malus rétroactif sur tout le trajet, accepté par l'humain (2026-10-03)** : une case pénalisée isolée en bout de chemin
  réduit le budget entier. Sur une flaque isolée, mvt ≥ 5 perd 2 cases (contre 1 avant) ; sur une grande étendue, la règle est
  bien plus douce. Paliers écrasés dans le marais (2=3, 4=5, 6=7) : connu, accepté.

## Changements

### Core (`packages/core`)

1. `battle/terrain-effects.ts` : `MOVEMENT_PENALTY` (additif) remplacé par `MOVEMENT_FACTOR` (`Water/Sand/Snow: 0.75`, `Swamp: 0.5`).
   `getMovementPenalty` → `getMovementFactor(terrain, types, isFlying): number` (1 si immunisé ou terrain neutre).
   Nouvelle fonction pure exportée `getMovementBudget(movement, factor): number` (le plancher y vit ; `getMovementBudget(0, f) = 0`).
2. `BattleEngine.getReachableTiles` (~l. 3165) : l'état du BFS devient `(position, pire facteur rencontré)`.
   Le `visited` est indexé par `x,y,facteur` (au plus 3 états par case). Un voisin est accepté si
   `steps + 1 ≤ movementBudget(movement, min(facteurCourant, facteurVoisin))`.
   Un chemin plus long mais moins pénalisé peut ouvrir des cases qu'un chemin court dans le marais n'atteint pas — d'où l'état composé.
   **Dédoublonner le résultat par case de destination** (une case peut sortir de file sous 2-3 facteurs) : garder un seul
   `ReachableTile` par position, dont le chemin passe la validation.
3. Validation de chemin (~l. 3421) : on accumule le pire facteur des cases entrées, puis `path.length ≤ budget` → sinon `PathTooLong`.
   Même sémantique que le BFS (une seule source de vérité : `getMovementBudget`).
4. `index.ts` : export renommé.

### View-core / app

5. `view-core/src/battle-views.ts` (~l. 569) : la fiche de case lit `getMovementFactor` ; texte `×¾` / `×½`.
6. i18n `tileInfo.movementPenalty` (fr/en/types) : « Déplacement ×{factor} » / « Movement ×{factor} ».

### Réseau

7. `packages/network/src/protocol.ts` : `NETWORK_VERSION` 15 → 16 (règle de déplacement changée, deux versions ne doivent pas jouer ensemble).

### Docs

8. `docs/game-design.md` § Types de terrain : lignes eau/sable/neige/marais + la règle ci-dessus.

## Tests (core, pendant le dev)

- `terrain-effects.test.ts` : facteurs par terrain, immunités → 1, `getMovementBudget` (table mvt 2..7 × facteur, plancher, mvt 0).
- `BattleEngine.terrain-movement.test.ts` réécrit sur la nouvelle règle :
  ligne droite de marais mvt 2/3/4/5 → 1/1/2/2 ; eau → 1/2/3/3 ; trajet eau puis marais → facteur ½ ;
  départ dans le marais vers terre ferme → pas de malus ; chemin de contournement plus long sans malus préféré au court dans le marais ;
  immun Poison dans le marais → portée pleine ; validation `PathTooLong` cohérente avec le BFS ;
  **pas de doublon de position** dans `getReachableTiles` ; **tout chemin renvoyé par le BFS passe la validation de déplacement**.
- Autres tests core touchés (`terrain-integration`, etc.) ajustés s'ils encodent l'ancien coût additif.

## Hors périmètre

- Valeurs de la carte Tourbière (pas de retouche de map).
- IA : elle consomme les actions légales du core, rien à changer. Pas de banc (`pnpm ai:bench`) dans ce lot.
- Prévisualisation du coût restant pendant le survol (le budget n'est pas affiché aujourd'hui, pas ajouté ici).
