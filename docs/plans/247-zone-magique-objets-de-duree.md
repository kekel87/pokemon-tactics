# Plan 247 : Zone Magique neutralise aussi Lumargile et Champ'Duit

**Statut** : done

| Écart au plan | Raison |
|---|---|
| `enumerateZoneTiles` sort dans `zone-tiles.ts` | Passe altitude de `/simplify` : cycle d'import avec `field-global-system.ts` |
| Option `prepareState` de `buildMoveTestEngine` | Le test Sécheresse doit poser la Zone Magique avant le début du combat |
| Recette non faite | Refusée par l'humain |
**Ouvert le** : 2026-11-06, solde `backlog-zone-magique-lumargile-champduit-et-roche-chaude`
**Bloque la release ?** : non

## Ce que tu verras à l'écran

- Un Pokémon debout dans une Zone Magique qui pose Mur Lumière ou Protection avec une Lumargile obtient
  5 tours d'écran, pas 8. Hors de la zone, toujours 8.
- Un Pokémon debout dans une Zone Magique qui pose un champ (Champ Herbu, Champ Électrifié, Champ Brumeux,
  Champ Psychique) avec un Champ'Duit obtient 5 tours, pas 8. Hors de la zone, toujours 8.
- Le build « Sun Setter » de Feunard est celui de Smogon : talent Sécheresse, Roche Chaude, Ball'Météo,
  Encore, Vœu Soin, Feu Follet. Il pose 8 tours de soleil dès le début du combat.

## Constat

Règle officielle vérifiée dans Showdown : les durées d'écran (`lightclay`), de champ (`terrainextender`) et
de météo (`heatrock`…) passent par `Pokemon.hasItem`, qui renvoie faux sous Zone Magique (`ignoringItem`).
Chez nous, Zone Magique est une zone au sol : le Pokémon qui s'y tient a son objet neutralisé
(`isHeldItemSuppressed`).

- `handle-set-weather.ts` respecte déjà la règle.
- `auraDurationForCaster` (`aura-system.ts`) et `fieldTerrainDurationForCaster` (`field-terrain-system.ts`)
  lisent `caster.heldItemId` sans la vérifier.
- Sécheresse au début du combat (`BattleEngine.ts`, `weatherAutoSetter`) lit aussi l'objet directement. Sans
  effet aujourd'hui (aucune zone n'existe au début du combat) : alignement préventif, demandé par l'humain.
- `ninetales-sun-setter` dans `op-sets.json` porte Torche et aucune attaque de météo : la Roche Chaude ne
  sert jamais. Set Smogon SV OU : Drought, Heat Rock, Timid, Weather Ball / Overheat, Encore, Healing
  Wish, Will-O-Wisp.

## Ce qu'on fait

1. Un helper commun dans `field-global-system.ts` renvoie l'objet tenu, ou `undefined` s'il est neutralisé ;
   `handle-set-weather.ts` l'adopte.
2. `auraDurationForCaster(state, caster, kind)` et `fieldTerrainDurationForCaster(state, caster)` passent par
   ce helper. Appelants mis à jour.
3. `BattleEngine` : Sécheresse et les autres talents météo d'entrée passent aussi par ce helper.
4. `docs/game-design.md` §8e : la règle Zone Magique couvre aussi Lumargile et Champ'Duit.
5. `op-sets.json`, `ninetales-sun-setter` : `ability: drought`, `heldItemId: heat-rock`, `nature: timid`,
   `moveIds: [weather-ball, encore, healing-wish, will-o-wisp]`, `statSpread: {hp: 31, speed: 31}`
   (convention des sets : 31 sur les deux stats visées), notes réécrites.

## Tests (core)

- Lumargile : 8 tours hors zone, 5 tours lanceur dans une Zone Magique.
- Champ'Duit : 8 tours hors zone, 5 tours lanceur dans une Zone Magique.
- Sécheresse avec Roche Chaude : 8 tours (test existant), et 5 si l'objet est neutralisé.
- Le test de légalité des builds (`op-sets-legality.test.ts`) reste vert avec le nouveau set de Feunard.

## À regarder en recette

Ce set est le premier build à porter Vœu Soin : `scoreReviveOrHeal` ne compte aucun coût de sacrifice pour le
soin d'un vivant (contrairement à `scoreMemento`). Si l'IA sacrifie Feunard trop tôt, décision à prendre
avec l'humain.

## Hors périmètre

Le reste de `backlog-replay-codes-points-mineurs`.
