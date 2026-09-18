/*
 * Rebuilds a battle from a saved action log (plan 181).
 *
 * The whole trick: a battle is `{ map + teams + placements + seed + actions }`. Feed those back to the
 * very function that built it live (`createBattleFromPlacements`) and replay the actions, and every
 * derived value — HP, Charge Time gauges, status counters, revealed items, hazards, PRNG position —
 * lands exactly where the player left it. Nothing is copied, so nothing can be forgotten.
 *
 * Lives apart from `combat-screen.ts` so the resume path is reviewable on its own, and so the screen
 * keeps its single job: wiring a built battle to the renderer.
 */

import type {
  Action,
  BattleEvent,
  MapDefinition,
  PlacementEntry,
  PlacementTeam,
} from "@pokemon-tactic/core";
import { BattleEventType, createPrng, DEFAULT_BATTLE_LEVEL, runReplay } from "@pokemon-tactic/core";
import { type BattleSetupResult, createBattleFromPlacements } from "@pokemon-tactic/view-core";
import type { CombatSetup } from "../app/screens";
import { buildTeamOverrides } from "../team/build-overrides.js";

/** Everything needed to rebuild a battle's starting position — the inputs, never derived state. */
export interface BattleInputs {
  setup: CombatSetup;
  placementTeams: PlacementTeam[];
  placements: PlacementEntry[];
  seed: number;
}

/**
 * Build the engine for a battle's starting position. Shared by the live path (right after placement)
 * and the resume path, so the two can never drift: a resumed battle is built by the same call that
 * built it the first time.
 *
 * `creationRng` is seeded here, deliberately. `createBattleFromPlacements` otherwise falls back to
 * `Math.random` for the rolls the Team Builder does not pin (gender), which would (a) put a
 * non-deterministic draw on the shipped path and (b) let a resumed battle hand a Pokémon the other
 * gender — not cosmetic, Attraction reads it.
 */
export function buildBattle(inputs: BattleInputs, map: MapDefinition): BattleSetupResult {
  return createBattleFromPlacements({
    map,
    teams: inputs.placementTeams,
    placements: inputs.placements,
    seed: inputs.seed,
    creationRng: createPrng(inputs.seed),
    /*
     * Vœu Soin ne ramène pas un camp entièrement à terre quand la partie est EN LIGNE (plan 210,
     * lot D0, décision #1047) : là-bas le camp ressuscité a peut-être déjà quitté le salon, et sa
     * place redeviendrait vivante sans personne pour la jouer. En local l'humain le garde ouvert.
     *
     * 🔴 Dérivé ICI, dans le chemin que la partie vive et la reprise PARTAGENT — c'est ce que
     * promet l'en-tête de cette fonction, et c'est structurel : une reprise qui reconstruirait le
     * combat avec l'autre règle divergerait de la partie qu'elle prétend restaurer, et en ligne
     * cette divergence se paierait en forfait sur la somme de contrôle.
     *
     * `localSeat` est le drapeau « partie en ligne », salon vivant ou non — même invariant que
     * `localPlayerIds` côté écran (décision #1038), et il vient de la même source.
     */
    reviveDefeatedCamps: inputs.setup.localSeat === undefined,
    /*
     * Le mode Combat ramène tout le monde au niveau 50 — le « parité 50 » façon VGC, dit ici
     * explicitement au lieu d'être une constante recopiée dans la formule de dégâts (plan 215).
     * Le jour où l'Aventure arrivera, c'est ce champ qu'elle omettra pour laisser chaque Pokemon
     * à son niveau.
     *
     * 🔴 Posé ICI pour la même raison structurelle que `reviveDefeatedCamps` juste au-dessus :
     * c'est le chemin que la partie vive et la reprise PARTAGENT. Une reprise qui reconstruirait
     * le combat sans cette règle rebâtirait des niveaux différents et divergerait du journal
     * qu'elle rejoue — en ligne, ça se paierait en forfait sur la somme de contrôle.
     */
    formatRules: { adjustLevel: DEFAULT_BATTLE_LEVEL },
    ...buildTeamOverrides({ teams: inputs.setup.teams }),
  });
}

export interface ResumedBattle {
  battle: BattleSetupResult;
  /**
   * Everything the battle narrated before the reload, in order — startup events first, then each
   * replayed action's events. Meant for the battle log ONLY: replaying them through the full feedback
   * path would re-spawn every damage number of the whole battle over the sprites.
   */
  logEvents: BattleEvent[];
}

/**
 * Rebuild a battle and fast-forward it through its saved actions.
 *
 * Throws if the log cannot be replayed (rejected action, changed data) or if it turns out to describe
 * a FINISHED battle. Callers are expected to treat either as "no save": drop it and go back to the
 * menu rather than restore something half-right.
 *
 * Why a finished battle can even reach here: the save is written the instant an action is accepted,
 * while the victory is only noticed once the animation queue drains it. A tab discarded in between —
 * the very scenario this feature exists for — leaves a save whose last action ended the battle. It
 * replays cleanly, so nothing else would reject it, and the resumed battle would offer an action menu
 * with no legal action and no victory dialog: a soft-lock.
 */
export function resumeBattle(
  inputs: BattleInputs,
  actions: Action[],
  map: MapDefinition,
): ResumedBattle {
  const battle = buildBattle(inputs, map);
  // Drained in the same order as the live path (the orchestrator does it in `start()`), so the
  // entry-time abilities are applied and logged before the first replayed action, and `start()` finds
  // nothing left to animate on resume.
  const logEvents: BattleEvent[] = [...battle.engine.consumeStartupEvents()];

  runReplay(
    { seed: inputs.seed, actions },
    () => battle.engine,
    (events) => logEvents.push(...events),
  );

  if (logEvents.some((event) => event.type === BattleEventType.BattleEnded)) {
    throw new Error("Resume failed: the saved battle is already over");
  }
  return { battle, logEvents };
}
