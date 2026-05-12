import type { HeldItemId } from "../enums/held-item-id";
import type { Nature } from "../enums/nature";
import { PokemonGender } from "../enums/pokemon-gender";
import { spToEv } from "./sp-ev-conversion";
import type { TeamSet } from "./team-set";

export interface ShowdownExportRegistry {
  getPokemonName(pokemonId: string): string;
  getAbilityName(abilityId: string): string;
  getItemName(itemId: HeldItemId): string;
  getMoveName(moveId: string): string;
}

const STAT_LABELS: Array<{ key: keyof ReturnType<typeof spToEv>; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "Atk" },
  { key: "defense", label: "Def" },
  { key: "spAttack", label: "SpA" },
  { key: "spDefense", label: "SpD" },
  { key: "speed", label: "Spe" },
];

function formatNature(nature: Nature): string {
  return nature.charAt(0).toUpperCase() + nature.slice(1);
}

function formatGender(gender: PokemonGender | undefined): string {
  if (gender === PokemonGender.Male) {
    return " (M)";
  }
  if (gender === PokemonGender.Female) {
    return " (F)";
  }
  return "";
}

export function exportTeamToShowdown(team: TeamSet, registry: ShowdownExportRegistry): string {
  const blocks: string[] = [];
  for (const slot of team.slots) {
    const speciesName = registry.getPokemonName(slot.pokemonId);
    const genderLabel = formatGender(slot.gender);
    const itemSuffix =
      slot.heldItemId === undefined ? "" : ` @ ${registry.getItemName(slot.heldItemId)}`;

    const evSpread = spToEv(slot.statSpread);
    const evParts: string[] = [];
    for (const { key, label } of STAT_LABELS) {
      const value = evSpread[key] ?? 0;
      if (value > 0) {
        evParts.push(`${value} ${label}`);
      }
    }

    const lines: string[] = [];
    lines.push(`${speciesName}${genderLabel}${itemSuffix}`);
    lines.push(`Ability: ${registry.getAbilityName(slot.ability)}`);
    lines.push("Level: 50");
    if (evParts.length > 0) {
      lines.push(`EVs: ${evParts.join(" / ")}`);
    }
    lines.push(`${formatNature(slot.nature)} Nature`);
    for (const moveId of slot.moveIds) {
      lines.push(`- ${registry.getMoveName(moveId)}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}
