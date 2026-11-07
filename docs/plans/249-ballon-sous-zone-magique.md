# Plan 249 : Ballon sous Zone Magique, et le statut « en l'air » jugé case par case

**Statut** : done

| Écart au plan | Raison |
|---|---|
| Pose de zone : comparaison avant / après le sort au lieu d'un cas par type de zone | Passe altitude de `/simplify` |
| `terrainTypesAt` partagé entre moteur, tick de terrain, IA et éjection | `/simplify` et `/relire-code` |
| Cases de Téléport et aperçu de dégâts jugés sur la case concernée | `/relire-code` |
| Magma jugé case par case sur tout le trajet (le premier survol arrêtait la boucle) | `/relire-code`, majeur, test vu rouge |
**Ouvert le** : 2026-11-07, solde `backlog-ballon-ignore-zone-magique`
**Bloque la release ?** : non

## Ce que tu verras à l'écran

- Un Pokémon avec un Ballon, debout dans une Zone Magique, touche le sol : son sprite se pose, il subit les
  pièges au sol (Picots, Pics Toxik, Toile Gluante) et les champs (Champ Herbu, Champ Électrifié). Hors de
  la zone, il lévite de nouveau ; le Ballon n'est pas consommé.
- En préparant un déplacement, les cases de lave ou d'eau profonde situées dans une Zone Magique (pour un
  porteur de Ballon) ou dans une Gravité (pour tout Pokémon volant ou en lévitation) ne sont plus proposées :
  on ne peut plus s'y arrêter ni les survoler.
- Sur un trajet qui entre dans une Zone Magique ou en sort, chaque piège compte selon la case : celui posé
  dans la zone se déclenche, celui posé hors zone est survolé. Même règle pour un Pokémon volant et la
  Gravité.
- Une Zone Magique posée sur un porteur de Ballon au-dessus de la lave le fait tomber tout de suite, comme
  la Gravité aujourd'hui.

## Constat

Règle officielle (Showdown) : sous Zone Magique, `hasItem` renvoie faux, donc le Ballon ne compte plus pour
`isGrounded`. Chez nous :

- L'immunité Sol des dégâts passe par `effectiveHeldItem` (`effect-processor.ts`) : déjà correcte. Le Ballon
  n'éclate pas non plus dans la zone (`handle-damage.ts`, objet neutralisé).
- Le statut « en l'air » passe par `isEffectivelyFlying` (`effective-flying.ts`), qui lit `heldItemId` sans
  l'état du combat.
- Un déplacement juge ce statut une fois, à la case de départ (`getReachableTiles`, `validateMovePath`,
  `executeMove` dans `BattleEngine.ts`). Une zone traversée en cours de route est ignorée : l'aperçu propose
  une case de lave mortelle. Le même défaut existe déjà pour la Gravité.

## Ce qu'on fait

1. `effective-flying.ts` : `isEffectivelyFlying(state, pokemon, types, position)` lit le Ballon sauf si la
   case est dans une Zone Magique ; `isAirborneAt` y ajoute Gravité et Anti-Air (`isEffectivelyGrounded`,
   qui prend aussi une case). Les appelants du core qui oubliaient Gravité ou Anti-Air (champs,
   téléportation forcée, recul, IA de déplacement) passent par `isAirborneAt`.
2. `BattleEngine` : déplacement jugé case par case. Entrer sur une case, s'y arrêter, la pénalité de
   terrain, Magma et pièges se jugent au statut sur cette case ; franchir un dénivelé en volant exige d'être
   en l'air sur les deux cases. Les atterrissages (recul, retraite) se jugent sur la case d'arrivée.
3. Pose d'une Zone Magique : même traitement immédiat que la Gravité pour un porteur de Ballon qui perd sa
   lévitation (`applyGravityGroundingOnCast` généralisé).
4. Renderer (`battle-orchestrator.ts`) : la pose du sprite suit le statut complet, et se rafraîchit aussi à
   la pose d'une Zone Magique.
5. IA : `isAirborneIgnoringGravity` devient sensible à la Zone Magique (immunité Sol, valeur de Gravité et
   d'Anti-Air), le score de déplacement juge le terrain d'arrivée au statut de la case d'arrivée.
6. `docs/game-design.md` : une ligne pour la règle du Ballon sous Zone Magique et le jugement par case.

## Hors périmètre

- Vol Magnétik et Lévitation ne sont pas des objets : la Zone Magique ne les touche pas.
- Ruée (dash) et trajectoire d'un recul : statut jugé au départ, comme aujourd'hui.
- Animation de marche : un volant qui entre dans une Gravité garde son vol plané jusqu'à l'arrivée.

## Critères

- `typecheck` vert, tests du core verts.
- `effective-flying.test.ts` : Ballon dans la zone au sol, hors zone en l'air ; Lévitation et type Vol
  inchangés dans la zone.
- Tests moteur : (a) un porteur de Ballon qui entre sur des Picots situés dans une Zone Magique perd des PV,
  sans la zone non ; (b) une case de lave dans une Zone Magique n'est pas dans les cases atteignables du
  porteur, hors zone oui ; (c) même chose pour un Pokémon volant et une Gravité ; (d) poser une Zone
  Magique sur un porteur au-dessus de la lave le met K.O. ; (e) dans la zone, un coup non Sol ne fait pas
  éclater le Ballon.
