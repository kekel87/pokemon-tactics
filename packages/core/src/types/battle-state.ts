import type { PlayerId } from "../enums/player-id";
import type { Weather } from "../enums/weather";
import type { DistortionZone } from "./distortion-zone";
import type { EntryHazardCell } from "./entry-hazard-cell";
import type { FieldGlobalZone } from "./field-global-zone";
import type { FieldZone } from "./field-zone";
import type { PendingStrike } from "./pending-strike";
import type { PokemonInstance } from "./pokemon-instance";
import type { Tailwind } from "./tailwind";
import type { TeamAura } from "./team-aura";
import type { TileState } from "./tile-state";

export interface BattleState {
  grid: TileState[][];
  pokemon: Map<string, PokemonInstance>;
  /** Id of the Pokemon whose turn it currently is (Charge Time scheduler). */
  activePokemonId: string;
  ctSnapshot?: Record<string, number>;
  weather: Weather;
  weatherTurnsRemaining: number;
  weatherSetterPokemonId?: string;
  auras: TeamAura[];
  /** Painted field-terrain zones ("Champs", B4). Multiple coexist; latest wins per tile on overlap. */
  fieldTerrains: FieldZone[];
  /** Trick Room ("Distorsion") zones: inside one, CT tempo is inverted (slow acts first). */
  distortionZones: DistortionZone[];
  /** Localized "field global" zones (Gravité / Zone Étrange / Zone Magique). Multiple coexist. */
  fieldGlobalZones: FieldGlobalZone[];
  /** The single active directional wind (Vent Arrière / tailwind), if any. */
  tailwind?: Tailwind;
  /** Entry-hazard traps (Picots / Pièges de Roc / Pics Toxik / Toile Gluante). Permanent until removed. */
  entryHazards: EntryHazardCell[];
  /** Tile-bound delayed strikes scheduled by future-moves (Prescience). Resolve after a caster-turn delay. */
  pendingStrikes: PendingStrike[];
  /**
   * Monotonic action clock. Incremented exactly once per completed action by the Charge Time turn
   * loop. Per-mon stamps on `PokemonInstance` reference this value so "this turn"-style conditions
   * (and effect durations counted on the setter's own turns) become integer comparisons.
   */
  actionCounter?: number;
  /** Per-team `actionCounter` of the last time one of the team's mons fainted (Retaliate). */
  lastAllyFaintAtAction?: Partial<Record<PlayerId, number>>;
  /** Per-team move id of the team's most recently completed action (Echoed Voice / Round). */
  lastTeamActionMoveId?: Partial<Record<PlayerId, string>>;
  /** Current Echoed Voice crescendo step (1..5); ramps while the team chains Echoed Voice. */
  echoStreak?: number;
  /**
   * Vœu Soin peut-il ramener le dernier mort d'un camp entièrement à terre ? (plan 210, lot D0)
   *
   * 🔴 **Porté par l'état, et pas par le constructeur du moteur, à dessein.** `BattleEngine` a déjà
   * dix paramètres positionnels ; un onzième booléen serait illisible, et passer à un objet
   * d'options refondrait tous les appelants. Ici, le gestionnaire d'effet lit `context.state` et
   * n'a rien d'autre à recevoir — et l'option entre dans la somme de contrôle du réseau, donc les
   * pairs restent d'accord sans un mot de protocole en plus.
   *
   * 🔴 **`packages/core` ne sait pas ce qu'est « en ligne », et ne doit pas l'apprendre.** Ce champ
   * parle de camps vaincus, jamais de réseau. C'est l'application qui le pose : faux en ligne, vrai
   * en local (décision #1047, arbitrage humain — « en multi local, ça peut être marrant »).
   *
   * Défaut `undefined`, lu comme **vrai** : c'est le comportement historique, et le seul chemin qui
   * a besoin de le restreindre est le combat en ligne, qui le pose explicitement.
   */
  reviveDefeatedCamps?: boolean;
  /**
   * Move id of the most recently executed move by ANY Pokemon on the field (Photocopie / copycat).
   * Records the move actually executed — never a metamove (a call-move source is filtered out).
   */
  lastMoveUsedGlobally?: string;
}
