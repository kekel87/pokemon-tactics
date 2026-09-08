import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { MockBattle, MockPokemon } from "../testing";
import { buildMoveTestEngine } from "../testing/build-move-test-engine";
import type { Action } from "../types/action";
import { createPrng } from "../utils/prng";
import type { BattleEngine } from "./BattleEngine";

/**
 * Exécution dupliquée : deux moteurs, même graine, même suite d'actions (plan 201, Lot B2).
 *
 * 🔴 **Ce que ce fichier garde, et pourquoi il vaut plus qu'il n'y paraît.** Le combat en réseau n'a
 * aucun arbitre : chaque pair fait tourner sa copie du moteur et valide les actions reçues contre son
 * propre `getLegalActions()`. Trois refus consécutifs éliminent un camp. Donc **tout le barème repose
 * sur le déterminisme bit-à-bit** — et un seul `Math.random` résiduel dans un chemin consommateur
 * d'aléa (peur, confusion, jets de statut) produirait une divergence *systématique*, toujours sur le
 * même joueur, jusqu'à son élimination en trois tours. Le symptôme serait indiscernable d'une triche.
 *
 * Demandé par l'agent `game-designer` en revue du plan 201, et écrit après une revue de code qui a
 * relevé son absence. Il ne coûte aucun navigateur : deux moteurs dans le même processus.
 *
 * ⚠️ **Où est réellement le filet, mesuré et non supposé.** Rouge-vert fait en construisant le
 * second moteur sur `SEED + 1` : **un seul** de ces tests échoue alors, celui de la confusion. Les
 * autres séquences ne consomment pas assez d'aléa pour diverger — elles gardent l'accord de
 * `getLegalActions()` et du journal, ce qui a sa valeur, mais ce n'est pas le même filet. Toute
 * séquence ajoutée ici devrait donc passer par un chemin qui TIRE, sans quoi elle rassure à tort.
 */

const ATTACKER = "p1-attacker";
const DEFENDER = "p2-defender";

const SEED = 4242;

function twoEngines(): readonly [BattleEngine, BattleEngine] {
  const build = (): BattleEngine =>
    buildMoveTestEngine(
      [
        MockPokemon.fresh(MockBattle.player1Fast, {
          id: ATTACKER,
          playerId: PlayerId.Player1,
          position: { x: 1, y: 1 },
          moveIds: ["confuse-ray", "fake-out", "disable", "scratch"],
        }),
        MockPokemon.fresh(MockBattle.player2Slow, {
          id: DEFENDER,
          playerId: PlayerId.Player2,
          position: { x: 1, y: 2 },
          moveIds: ["scratch", "taunt"],
        }),
      ],
      { random: createPrng(SEED) },
    ).engine;
  return [build(), build()];
}

/** La liste des actions légales, réduite à des clés comparables. */
function legalKeys(engine: BattleEngine, playerId: string): string[] {
  return engine
    .getLegalActions(playerId)
    .map((action) => JSON.stringify(action))
    .sort();
}

function activeOf(engine: BattleEngine): { id: string; playerId: string; hp: number } {
  const state = engine.getGameState(PlayerId.Player1);
  const active = state.pokemon.get(state.activePokemonId);
  return {
    id: active?.id ?? "",
    playerId: active?.playerId ?? "",
    hp: active?.currentHp ?? -1,
  };
}

/**
 * Rejoue une action sur les DEUX moteurs, comme le réseau le fait : chacun la soumet à sa propre
 * copie. Affirme après chaque coup que les deux racontent la même chose — c'est la comparaison qui
 * attraperait un aléa non maîtrisé, pas la seule égalité finale.
 */
function playOnBoth(engines: readonly [BattleEngine, BattleEngine], action: Action): void {
  const [left, right] = engines;
  const actingPlayer = activeOf(left).playerId;

  const leftResult = left.submitAction(actingPlayer, action);
  const rightResult = right.submitAction(actingPlayer, action);

  // 🔴 Sans ceci, une suite d'actions toutes REFUSÉES ferait passer chaque comparaison ci-dessous
  // pour la mauvaise raison : deux moteurs qui ne font rien sont trivialement d'accord.
  expect(leftResult.success).toBe(true);
  expect(rightResult.success).toBe(leftResult.success);
  expect(JSON.stringify(rightResult.events)).toBe(JSON.stringify(leftResult.events));
  expect(right.actionLogLength).toBe(left.actionLogLength);
  expect(activeOf(right)).toEqual(activeOf(left));
  expect(legalKeys(right, PlayerId.Player1)).toEqual(legalKeys(left, PlayerId.Player1));
  expect(legalKeys(right, PlayerId.Player2)).toEqual(legalKeys(left, PlayerId.Player2));
}

/**
 * Choisit l'action à jouer **dans la liste légale du moteur de gauche** : l'attaque demandée si elle
 * y figure pour l'acteur courant, sinon une fin de tour.
 *
 * 🔴 Écrit ainsi après un échec de ce fichier. Les suites codées en dur supposaient qui a la main —
 * or le barème CT rend la main à qui il veut, donc la moitié des actions partaient illégales et
 * chaque comparaison passait pour la mauvaise raison : deux moteurs qui refusent tout sont
 * trivialement d'accord. Choisir dans la liste légale rend l'illégalité impossible par construction.
 */
function chooseAction(engine: BattleEngine, moveId: string): Action {
  const active = activeOf(engine);
  const legal = engine.getLegalActions(active.playerId);
  const wanted = legal.find(
    (action) => action.kind === ActionKind.UseMove && action.moveId === moveId,
  );
  if (wanted !== undefined) {
    return wanted;
  }
  const wait = legal.find((action) => action.kind === ActionKind.EndTurn);
  if (wait === undefined) {
    throw new Error(`aucune action légale pour ${active.playerId}`);
  }
  return wait;
}

describe("exécution dupliquée — deux moteurs, même graine", () => {
  it("rendent la même liste d'actions légales avant le premier coup", () => {
    const [left, right] = twoEngines();

    expect(legalKeys(right, PlayerId.Player1)).toEqual(legalKeys(left, PlayerId.Player1));
    expect(activeOf(right)).toEqual(activeOf(left));
  });

  it("restent d'accord sur une suite d'attaques et d'attentes", () => {
    const engines = twoEngines();

    for (let turn = 0; turn < 6; turn += 1) {
      playOnBoth(engines, chooseAction(engines[0], "scratch"));
    }

    const [left, right] = engines;
    expect(left.actionLogLength).toBe(6);
    expect(JSON.stringify(right.exportReplay())).toBe(JSON.stringify(left.exportReplay()));
  });

  /**
   * Onde Folie pose la confusion, dont la résolution consomme l'aléa **à chaque début de tour** de
   * la cible (`advanceTurn` → `processConfusion`). C'est le chemin le plus fréquemment consommateur
   * du moteur, donc celui où un `Math.random` égaré ferait le plus de dégâts.
   */
  it("restent d'accord à travers la confusion, qui tire à chaque tour", () => {
    const engines = twoEngines();

    playOnBoth(engines, chooseAction(engines[0], "confuse-ray"));
    for (let turn = 0; turn < 8; turn += 1) {
      playOnBoth(engines, chooseAction(engines[0], "aucune"));
    }

    const [left, right] = engines;
    expect(left.actionLogLength).toBe(9);
    expect(JSON.stringify(right.exportReplay())).toBe(JSON.stringify(left.exportReplay()));
  });

  /**
   * Bluff pose la peur, Entrave et Provoc verrouillent le choix d'attaque. Les trois **retirent des
   * entrées** de `getLegalActions()` : si les deux moteurs n'en retiraient pas les mêmes, le pair
   * receveur refuserait une action que l'émetteur croit légale — le refus injuste que le barème ne
   * sait pas distinguer d'une divergence.
   */
  it("retirent les mêmes actions quand un verrou de choix s'applique", () => {
    const engines = twoEngines();

    playOnBoth(engines, chooseAction(engines[0], "fake-out"));
    playOnBoth(engines, chooseAction(engines[0], "aucune"));
    playOnBoth(engines, chooseAction(engines[0], "disable"));
    playOnBoth(engines, chooseAction(engines[0], "taunt"));

    const [left, right] = engines;
    expect(legalKeys(right, PlayerId.Player2)).toEqual(legalKeys(left, PlayerId.Player2));
    expect(JSON.stringify(right.exportReplay())).toBe(JSON.stringify(left.exportReplay()));
  });

  it("aboutissent au même verdict quand un camp abandonne", () => {
    const engines = twoEngines();
    playOnBoth(engines, chooseAction(engines[0], "scratch"));

    const [left, right] = engines;
    const leftForfeit = left.forfeit(PlayerId.Player2);
    const rightForfeit = right.forfeit(PlayerId.Player2);

    expect(rightForfeit.success).toBe(leftForfeit.success);
    expect(JSON.stringify(rightForfeit.events)).toBe(JSON.stringify(leftForfeit.events));
  });

  /**
   * Le garde-fou du garde-fou : deux graines DIFFÉRENTES doivent produire des flux d'aléa
   * différents. Sans cette assertion, un moteur qui aurait cessé de consommer l'aléa du tout ferait
   * passer tous les tests ci-dessus pour la mauvaise raison.
   */
  it("divergent bien quand les graines diffèrent — sinon les tests ci-dessus ne prouvent rien", () => {
    const draws = (seed: number): number[] => {
      const random = createPrng(seed);
      return [random(), random(), random()];
    };

    expect(draws(SEED)).not.toEqual(draws(SEED + 1));
    expect(draws(SEED)).toEqual(draws(SEED));
  });
});
