# Plan 219 — Les portées visibles sur l'eau et le marais

**Statut** : done
**Origine** : `backlog-portees-invisibles-terrain-liquide` (retour de l'humain, partie avec son frère, 2026-09-21)

## Ce que tu verras à l'écran

- Sur l'eau, le marais, l'eau profonde et la lave, les cases de déplacement (bleu) et d'attaque (rouge) se voient comme sur l'herbe.
- La hauteur de la surbrillance ne change pas (même hauteur que la terre, choix de l'humain) : seul l'ordre de dessin change.
- Les zones de déploiement et les aperçus (attaque, soin, bonus) suivent la même règle.
- Rien ne change sur la terre ferme.

## Diagnostic (mesuré le 2026-10-03)

- Hauteurs : toutes les cases liquides des cartes (Tourbière, Arène navale, Volcan) sont à `height = 1`. La surbrillance
  (0,866) est donc **au-dessus** de la nappe (0,72) : la hauteur n'est pas en cause.
- Capture sandbox Tourbière, portée de Florizarre : bleu visible sur l'herbe, **absent sur le marais**.
- Cause : la surface translucide des liquides est rendue dans `BABYLON_SPRITE_RENDERING_GROUP` (groupe 2), donc
  **après** les surbrillances (groupe 0) ; le marais (alpha 0,9) les recouvre.

## Correctif

- `createTileHighlights` reçoit `isLiquidAt` (déjà calculé dans `combat-scene.ts`).
- Un remplissage posé sur une case liquide passe dans le groupe 2, avec `alphaIndex` au-dessus de la nappe :
  `BABYLON_LIQUID_HIGHLIGHT_ALPHA_INDEX = 2` pour portées et zones de déploiement, `BABYLON_TILE_PREVIEW_ALPHA_INDEX = 3`
  pour les aperçus (ils restent au-dessus des portées).
- Le contour de portée (un seul mesh GreasedLine, seule trace de la portée d'attaque) suit la même règle dès qu'il
  touche une case liquide — trouvé en recette (« la zone rouge et le contour rouge, ça ne va pas »).
- Vérifié à l'écran après correctif : la portée apparaît sur le marais.
- Recette humaine 2026-10-03 : 4 scénarios validés, 1 retour (contour rouge), contraste rouge/marais jugé OK.

## Hors périmètre

- Le malus de déplacement du marais (`backlog-malus-deplacement-marais-trop-punitif`), qui attend un arbitrage de l'humain.
- Hauteur des surbrillances : inchangée.
- Champs (terrains actifs) et pièges d'entrée sur liquide : même défaut possible, non traité sauf constat en recette.
- Aucun changement du core.

## Recette (scénarios)

1. Tourbière : portée de déplacement et d'attaque de Florizarre sur le marais et l'eau profonde.
2. Arène navale : portée sur l'eau peu profonde et profonde.
3. Volcan : portée sur la lave.
4. Rotation de caméra : la surbrillance reste lisible sous tous les angles ; un Pokémon dans l'eau n'est pas masqué par elle.

## Tests (menu de finalisation)

- e2e visuel éventuel (Tourbière), décidé au menu.
