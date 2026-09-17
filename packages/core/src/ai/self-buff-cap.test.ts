import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEngine } from "../battle/BattleEngine";
import { TurnPipeline } from "../battle/turn-pipeline";
import { ActionKind } from "../enums/action-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import { MockMove } from "../testing/mock-move";
import { MockPokemon, ZERO_STAT_STAGES } from "../testing/mock-pokemon";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import { createPrng } from "../utils/prng";
import { scoreAction } from "./action-scorer";
import { HARD_PROFILE } from "./ai-profiles";

const ONDE_BOREALE: MoveDefinition = MockMove.fresh(MockMove.physical, {
  id: "aurora-beam",
  name: "Aurora Beam",
  effects: [
    {
      kind: EffectKind.StatChange,
      stat: StatName.Attack,
      stages: -1,
      target: EffectTarget.Targets,
    },
  ],
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
});

const ARMURE: MoveDefinition = MockMove.fresh(MockMove.status, {
  id: "iron-defense",
  name: "Iron Defense",
  effects: [
    {
      kind: EffectKind.StatChange,
      stat: StatName.Defense,
      stages: 2,
      target: EffectTarget.Self,
    },
  ],
});

function noterArmure(cranDefense: number): number {
  const lanceur = MockPokemon.fresh(MockPokemon.base, {
    id: "lanceur",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: [ARMURE.id],
    statStages: { ...ZERO_STAT_STAGES, [StatName.Defense]: cranDefense },
  });
  const ennemi = MockPokemon.fresh(MockPokemon.base, {
    id: "ennemi",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 4 },
  });

  const state: BattleState = MockBattle.stateFrom([lanceur, ennemi]);

  const donnees = loadData();
  const registry = new Map<string, MoveDefinition>(donnees.moves.map((move) => [move.id, move]));
  registry.set(ARMURE.id, ARMURE);
  const types = new Map<string, PokemonType[]>(donnees.pokemon.map((p) => [p.id, p.types]));

  const engine = new BattleEngine(
    state,
    registry,
    typeChart,
    types,
    new TurnPipeline(),
    createPrng(1),
    1,
  );

  /*
   * APRÈS le moteur, et pas avant : son constructeur amorce l'horloge de tour et écrase
   * `activePokemonId`. Posé avant, le Pokemon noté était l'ENNEMI — donc un lanceur à crans neutres,
   * et le test mesurait autre chose que ce qu'il annonce.
   */
  state.activePokemonId = lanceur.id;

  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: lanceur.id,
      moveId: ARMURE.id,
      targetPosition: { x: 0, y: 0 },
    },
    state,
    registry,
    engine,
    HARD_PROFILE,
  );
}

describe("montée de stat sur soi — la valeur décroît vers le plafond (plan 214)", () => {
  /*
   * 🔴 Ce que ce fichier empêche de revenir, et c'est un bug de JEU, pas de code.
   *
   * Mesuré au banc (`pnpm ai:bench`) : en miroir, jusqu'à 8 parties sur 40 ne se terminaient JAMAIS,
   * et les crans montaient à +6 dans les six affrontements — Facile contre Facile compris. Observé en
   * direct : Racaillou à `Déf 120 ➜ 480`, tout le monde à 100 % de PV, plus personne capable de
   * blesser personne.
   *
   * La cause était que `scoreSelfMove` ne lisait jamais le cran courant : relancer Armure au plafond
   * valait autant qu'au premier lancer, donc l'IA le rejouait indéfiniment.
   */
  it("un buff sur une stat neutre vaut quelque chose", () => {
    expect(noterArmure(0)).toBeGreaterThan(0);
  });

  it("🔴 un buff AU PLAFOND est écarté, pas seulement dévalué", () => {
    /*
     * Négatif et non nul : `pickScoredAction` ne garde dans son `topN` que les actions dont le score
     * est `>= 0`. À zéro, l'action restait candidate et pouvait encore être piochée.
     */
    expect(noterArmure(6)).toBeLessThan(0);
  });

  it("vaut moins près du plafond qu'à cran neutre", () => {
    expect(noterArmure(5)).toBeLessThan(noterArmure(0));
  });

  it("décroît de façon monotone à mesure que la stat monte", () => {
    const scores = [0, 2, 4, 5].map(noterArmure);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] as number);
    }
  });
});

function noterOndeBoreale(cranAttaqueEnnemi: number): number {
  const lanceur = MockPokemon.fresh(MockPokemon.base, {
    id: "lanceur",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: [ONDE_BOREALE.id],
  });
  const ennemi = MockPokemon.fresh(MockPokemon.base, {
    id: "ennemi",
    playerId: PlayerId.Player2,
    position: { x: 0, y: 2 },
    statStages: { ...ZERO_STAT_STAGES, [StatName.Attack]: cranAttaqueEnnemi },
  });

  const state: BattleState = MockBattle.stateFrom([lanceur, ennemi]);

  const donnees = loadData();
  const registry = new Map<string, MoveDefinition>(donnees.moves.map((move) => [move.id, move]));
  registry.set(ONDE_BOREALE.id, ONDE_BOREALE);
  const types = new Map<string, PokemonType[]>(donnees.pokemon.map((p) => [p.id, p.types]));

  const engine = new BattleEngine(
    state,
    registry,
    typeChart,
    types,
    new TurnPipeline(),
    createPrng(1),
    1,
  );
  state.activePokemonId = lanceur.id;

  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: lanceur.id,
      moveId: ONDE_BOREALE.id,
      targetPosition: { x: 0, y: 2 },
    },
    state,
    registry,
    engine,
    HARD_PROFILE,
  );
}

describe("baisse de stat chez l'ennemi — la valeur décroît vers le plancher (plan 214)", () => {
  /*
   * 🔴 Le symétrique du plafond, trouvé en INSTRUMENTANT les parties sans fin qui restaient.
   *
   * Deux Lamantine en miroir, tous deux à pleine vie et à `Attaque = -6` : ils s'étaient mutuellement
   * baissé l'Attaque jusqu'au plancher avec Onde Boréale, plus personne ne pouvait blesser personne,
   * et l'IA continuait de relancer des baisses qui ne changeaient plus rien.
   *
   * Les dégâts du move restent crédités à part : seul le bonus de MALUS est annulé, donc Onde Boréale
   * reste jouable sur une cible saturée — simplement plus pour son malus.
   */
  it("vaut plus contre une cible à Attaque neutre que contre une cible au plancher", () => {
    expect(noterOndeBoreale(-6)).toBeLessThan(noterOndeBoreale(0));
  });

  it("décroît de façon monotone à mesure que la cible descend", () => {
    const scores = [0, -2, -4, -6].map(noterOndeBoreale);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] as number);
    }
  });
});
