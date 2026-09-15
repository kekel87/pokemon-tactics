import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Vœu Soin (healing-wish), reinvented as « Second Souffle » for the grid (no switch-in to heal). The
 * caster sacrifices itself (self-KO handled engine-side via `selfKo`) and, in exchange, acts on the
 * occupant of the targeted tile:
 *  - a KO'd occupant is REVIVED to `revivePercent` of its max HP (50%), status cleared;
 *  - a living occupant is HEALED to `healPercent` of its max HP (100%), status cleared;
 *  - an empty tile / no occupant → the move whiffs (the caster still faints).
 *
 * Any occupant is a valid target — ally or enemy, alive or KO (the player's choice, even a poor one).
 * A living occupant is preferred over a buried KO'd one (a corpse whose tile was re-taken cannot be
 * revived under the new occupant — see docs/plans/147).
 */
export function handleReviveOrHeal(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.ReviveOrHeal }>;
  const { x, y } = context.targetPosition;

  const occupants = [...context.state.pokemon.values()].filter(
    (pokemon) => pokemon.position.x === x && pokemon.position.y === y,
  );
  // A living occupant wins over a buried KO'd one sharing the tile.
  const target: PokemonInstance | undefined =
    occupants.find((pokemon) => pokemon.currentHp > 0) ?? occupants[0];

  if (!target) {
    return [{ type: BattleEventType.ReviveOrHealFailed, casterId: context.attacker.id }];
  }

  /*
   * Un camp entièrement à terre ne se fait pas ramener (plan 210, lot D0, décision #1047).
   *
   * Le prédicat ne consulte AUCUN état « éliminé » ou « forfaité » : la cible K.O. n'est réanimable
   * que si son camp compte, hors elle-même, au moins un autre Pokemon vivant. Un camp qui a forfaité
   * y tombe tout seul — le forfait met déjà tous ses Pokemon à 0 PV — donc rien à mémoriser.
   *
   * Réanimer son propre dernier coéquipier reste permis : le lanceur est vivant et compte pour son
   * camp. Seul le ciblage d'un camp TIERS déjà rayé est fermé, ce qui remet le code en conformité
   * avec `docs/game-design.md` §9 (« ressuscite un allié KO »), plus étroit que « ally or enemy »
   * depuis toujours.
   */
  if (target.currentHp <= 0 && context.state.reviveDefeatedCamps === false) {
    const campHasSurvivor = [...context.state.pokemon.values()].some(
      (pokemon) =>
        pokemon.playerId === target.playerId && pokemon.id !== target.id && pokemon.currentHp > 0,
    );
    if (!campHasSurvivor) {
      return [{ type: BattleEventType.ReviveOrHealFailed, casterId: context.attacker.id }];
    }
  }

  const revived = target.currentHp <= 0;
  const percent = revived ? effect.revivePercent : effect.healPercent;
  const newHp = Math.min(target.maxHp, Math.max(1, Math.floor(target.maxHp * percent)));

  target.currentHp = newHp;
  target.statusEffects = [];
  target.volatileStatuses = [];
  target.toxicCounter = 0;

  return [
    {
      type: BattleEventType.PokemonRevived,
      pokemonId: target.id,
      casterId: context.attacker.id,
      hp: newHp,
      revived,
    },
  ];
}
