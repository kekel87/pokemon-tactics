import type { Direction, Position } from "@pokemon-tactic/core";
import { HighlightKind } from "../enums/highlight-kind.js";
import type {
  AttackPreviewKind,
  BoardHighlight,
  BoardView,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
  SemiInvulnerableDisplay,
} from "../game/battle-orchestrator.js";
import type { CombatPokemonHandle, CombatScene } from "./combat-scene.js";

const HIGHLIGHT_KIND: Readonly<Record<BoardHighlight, HighlightKind>> = {
  move: HighlightKind.Move,
  attack: HighlightKind.Attack,
  retreat: HighlightKind.Retreat,
  enemy: HighlightKind.EnemyRange,
};

const PREVIEW_KIND: Readonly<Record<AttackPreviewKind, HighlightKind>> = {
  buff: HighlightKind.PreviewBuff,
  attack: HighlightKind.PreviewAttack,
  blast: HighlightKind.PreviewBlast,
};

/**
 * `BoardView` adapter over the Babylon combat scene (plan 120 step 7b). It maps
 * the orchestrator's engine-agnostic board operations onto the scene + the
 * per-Pokémon billboard handles produced during placement (keyed by core
 * instance id, e.g. "p1-pikachu"). The direction picker reuses the in-engine
 * voxel arrows (décision #487).
 */
export function createBattleBoardView(
  combat: CombatScene,
  handles: ReadonlyMap<string, CombatPokemonHandle>,
): BoardView {
  let activePokemonId: string | null = null;
  let previewFlashIds: readonly string[] = [];
  let damageEstimateIds: readonly string[] = [];

  return {
    setHighlights: (kind, tiles) => combat.setTileHighlights(HIGHLIGHT_KIND[kind], tiles),
    setOutline: (tiles, beneficial) => combat.setTileOutline(tiles, beneficial),
    clearHighlights: () => combat.clearHighlights(),
    showPreview: (kind, tiles) => combat.setTileHighlights(PREVIEW_KIND[kind], tiles),
    clearPreview: () => {
      combat.setTileHighlights(HighlightKind.PreviewBuff, []);
      combat.setTileHighlights(HighlightKind.PreviewAttack, []);
      combat.setTileHighlights(HighlightKind.PreviewBlast, []);
    },
    moveTo: (pokemonId, tile) => handles.get(pokemonId)?.moveTo(tile),
    moveAlongPath: (pokemonId, path, options) =>
      handles.get(pokemonId)?.moveAlongPath(path, options) ?? Promise.resolve(),
    playAttack: (pokemonId, direction, animationName) =>
      handles.get(pokemonId)?.playAttack(direction, animationName) ?? Promise.resolve(),
    impactGlide: (pokemonId, tile, options) =>
      handles.get(pokemonId)?.impactGlide(tile, options) ?? Promise.resolve(),
    impactShake: (pokemonId) => handles.get(pokemonId)?.impactShake() ?? Promise.resolve(),
    setFacing: (pokemonId, direction) => handles.get(pokemonId)?.setFacing(direction),
    setActive: (pokemonId) => {
      if (activePokemonId === pokemonId) {
        return;
      }
      if (activePokemonId) {
        handles.get(activePokemonId)?.setActive(false);
      }
      activePokemonId = pokemonId;
      if (pokemonId) {
        handles.get(pokemonId)?.setActive(true);
      }
    },
    flashDamage: (pokemonId) => handles.get(pokemonId)?.flashDamage(),
    setPreviewFlash: (pokemonIds) => {
      for (const id of previewFlashIds) {
        if (!pokemonIds.includes(id)) {
          handles.get(id)?.setPreviewFlash(false);
        }
      }
      for (const id of pokemonIds) {
        handles.get(id)?.setPreviewFlash(true);
      }
      previewFlashIds = [...pokemonIds];
    },
    setDamageEstimates: (estimates) => {
      const nextIds = estimates.map((estimate) => estimate.pokemonId);
      for (const id of damageEstimateIds) {
        if (!nextIds.includes(id)) {
          handles.get(id)?.showDamageEstimate(null);
        }
      }
      for (const estimate of estimates) {
        handles.get(estimate.pokemonId)?.showDamageEstimate({
          min: estimate.min,
          max: estimate.max,
          label: estimate.label,
          immune: estimate.immune,
        });
      }
      damageEstimateIds = nextIds;
    },
    updateHp: (pokemonId, currentHp, maxHp) => handles.get(pokemonId)?.updateHp(currentHp, maxHp),
    updateStatus: (pokemonId, statusType) => handles.get(pokemonId)?.updateStatus(statusType),
    setConfusionWobble: (pokemonId, active) => handles.get(pokemonId)?.setConfusionWobble(active),
    setKnockedOut: (pokemonId, knockedOut) => handles.get(pokemonId)?.setKnockedOut(knockedOut),
    setSemiInvulnerable: (pokemonId, state: SemiInvulnerableDisplay) =>
      handles.get(pokemonId)?.setSemiInvulnerable(state),
    setSubstitute: (pokemonId, active) => handles.get(pokemonId)?.setSubstitute(active),
    setHudVisible: (pokemonId, visible) => handles.get(pokemonId)?.setHudVisible(visible),
    koAnimationDurationMs: (pokemonId) => handles.get(pokemonId)?.koAnimationDurationMs() ?? 0,
    setFieldTerrains: (zones) => combat.setFieldTerrains(zones),
    setAuraIndicators: (pokemonId, indicators) =>
      handles.get(pokemonId)?.setLeftIndicators(indicators),
    setAuraGroundIcons: (cells, symbols) => combat.setAuraGroundIcons(cells, symbols),
    panCameraTo: (tile: Position) => combat.panCameraTo(tile),
    showDirectionPicker: (
      center: Position,
      initial: Direction,
      callbacks: DirectionPickerCallbacks,
    ): DirectionPickerHandle => combat.showDirectionPicker(center, initial, callbacks),
  };
}
