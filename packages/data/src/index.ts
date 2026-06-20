export { AnimationCategory, moveAnimationCategory } from "./base/animation-category";
export { getMoveName, getPokemonName } from "./i18n/index";
export { itemHandlers } from "./items/item-definitions";
export type { GameData } from "./load-data";
export { loadAllPokemonTypes, loadData } from "./load-data";
export { pocArena, sandboxArena } from "./maps/index";
export type { OpSet } from "./op-sets/load-op-sets";
export { getAllOpSets, getOpSetsForPokemon } from "./op-sets/load-op-sets";
export { playablePokemon } from "./playable/playable-pokemon";
export type {
  PlayablePokemonCustom,
  PlayablePokemonEntry,
} from "./playable/playable-pokemon-entry";
export type {
  CatalogAbility,
  CatalogItem,
  CatalogMove,
  CatalogPokemonAbilities,
  TeamBuilderRegistry,
} from "./team/index";
export {
  buildTeamBuilderRegistry,
  getCatalogAbilities,
  getCatalogItems,
  getCatalogMoves,
  getPokemonAbilities,
  isAbilityImplemented,
  isItemImplemented,
  isMoveImplemented,
  isPokemonImplemented,
} from "./team/index";
export { getLegalMoves, initializeLearnsetResolver } from "./team/learnset-resolver";
export type {
  DecorationObject,
  ElevationLayer,
  ParseResult,
  TiledGidDecoded,
  TiledMap,
  TiledMapValidation,
  TiledTileset,
} from "./tiled/index";
export { DecorationKind, decodeTiledGid, parseTiledMap, validateTiledMap } from "./tiled/index";
export { typeChart } from "./type-chart";
