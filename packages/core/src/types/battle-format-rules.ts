/**
 * Les règles qu'un FORMAT de partie impose au combat, indépendamment de la carte.
 *
 * 🔴 **Délibérément séparé de `MapFormat`**, qui ne porte que de la géométrie (`teamCount`,
 * `maxPokemonPerTeam`, `spawnZones`) et vient des données de carte. Un format de jeu doit être
 * jouable sur N'IMPORTE QUELLE carte : mélanger les deux enfermerait une Little Cup dans les cartes
 * qui l'auraient déclarée. Arbitrage de l'humain, 2026-09-18.
 *
 * ## Le vocabulaire vient de Pokemon Showdown, vérifié à la source
 *
 * `sim/dex-formats.ts` distingue SIX axes de niveau, et la distinction qui compte est celle-ci :
 *
 * | Axe | Effet | Quand |
 * |---|---|---|
 * | `minLevel` / `maxLevel` / `maxTotalLevel` | **REFUSENT** une équipe | à la construction d'équipe |
 * | `adjustLevel` | **RÉÉCRIT** les niveaux, ne refuse jamais | à la construction du combat |
 * | `adjustLevelDown` | ne rabaisse que ceux au-dessus | idem |
 * | `defaultLevel` | niveau posé quand l'équipe n'en dit rien | idem |
 *
 * Pokemon Stadium s'exprime entièrement dans ce vocabulaire, ce qui confirme les axes : Poké Cup =
 * niveaux 50-55 avec somme ≤ 155 ; Prime Cup = tout le monde au niveau 100 ; Petit Cup = 25-30,
 * somme ≤ 80, non évolués. Deux conceptions indépendantes qui tombent sur les mêmes axes.
 *
 * ## Ce qui est implémenté ici, et ce qui ne l'est pas
 *
 * **Seul `adjustLevel` existe** : c'est ce dont le mode Combat a besoin (« tout le monde à 50 »,
 * exactement le modèle VGC). Les cinq autres axes sont des règles de VALIDATION D'ÉQUIPE, qui
 * relèvent du constructeur d'équipe et non du combat — les ajouter ici sans constructeur qui les
 * lise serait du décor. Les noms sont déjà ceux de Showdown pour que l'ajout soit additif.
 */
export interface BattleFormatRules {
  /**
   * Ramène TOUS les Pokemon du combat à ce niveau, quels que soient les leurs. Absent → chacun
   * garde le sien (mode Aventure).
   *
   * Ne REFUSE jamais une équipe, il la réécrit : c'est ce qui le distingue d'un `maxLevel`, qui
   * rejetterait un Pokemon trop haut au lieu de l'abaisser.
   */
  adjustLevel?: number;
}
