import type { BattleState, PokemonDefinition } from "@pokemon-tactic/core";
import {
  DEPTH_TIMELINE,
  TEAM_COLOR_PLAYER_1,
  TEAM_COLOR_PLAYER_2,
  TIMELINE_ACTIVE_BORDER_COLOR,
  TIMELINE_ACTIVE_BORDER_WIDTH,
  TIMELINE_ACTIVE_SIZE,
  TIMELINE_BORDER_WIDTH,
  TIMELINE_ENTRY_SIZE,
  TIMELINE_ENTRY_SPACING,
  TIMELINE_X,
  TIMELINE_Y,
  TYPE_COLORS,
} from "../constants";

export class TurnTimeline {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(TIMELINE_X, TIMELINE_Y);
    this.container.setDepth(DEPTH_TIMELINE);
  }

  update(state: BattleState, pokemonDefinitions: Map<string, PokemonDefinition>): void {
    this.clearEntries();

    let y = 0;

    for (let i = 0; i < state.turnOrder.length; i++) {
      const pokemonId = state.turnOrder[i];
      if (!pokemonId) {
        continue;
      }

      const pokemon = state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.currentHp <= 0) {
        continue;
      }

      const isActive = i === state.currentTurnIndex;
      const definition = pokemonDefinitions.get(pokemon.definitionId);
      const primaryType = definition?.types[0] ?? "normal";
      const typeColor = TYPE_COLORS[primaryType] ?? 0xa0a0a0;
      const teamColor = pokemon.playerId === "player-1" ? TEAM_COLOR_PLAYER_1 : TEAM_COLOR_PLAYER_2;

      const entry = this.createEntry(y, typeColor, teamColor, isActive);
      this.container.add(entry);
      this.entries.push(entry);

      const entrySize = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
      y += entrySize + TIMELINE_ENTRY_SPACING;
    }
  }

  destroy(): void {
    this.clearEntries();
    this.container.destroy();
  }

  private createEntry(
    y: number,
    typeColor: number,
    teamColor: number,
    isActive: boolean,
  ): Phaser.GameObjects.Container {
    const size = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
    const radius = size / 2;

    const graphics = this.scene.add.graphics();

    graphics.fillStyle(typeColor, 1);
    graphics.fillCircle(0, 0, radius);

    const borderColor = isActive ? TIMELINE_ACTIVE_BORDER_COLOR : teamColor;
    const borderWidth = isActive ? TIMELINE_ACTIVE_BORDER_WIDTH : TIMELINE_BORDER_WIDTH;
    graphics.lineStyle(borderWidth, borderColor, 1);
    graphics.strokeCircle(0, 0, radius);

    return this.scene.add.container(0, y + radius, [graphics]);
  }

  private clearEntries(): void {
    for (const entry of this.entries) {
      entry.destroy();
    }
    this.entries = [];
  }
}
