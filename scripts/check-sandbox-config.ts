// Vérifie sans navigateur qu'une config sandbox construit le combat voulu (skill /recette).
// Usage : pnpm sandbox:check '<json>'   (ou un chemin vers un fichier .json)
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { playablePokemon } from "../packages/data/src/playable/playable-pokemon.js";
import { loadTiledMapSync } from "../packages/data/src/testing/load-tiled-map-sync.js";
import { parseTiledMap } from "../packages/data/src/tiled/parse-tiled-map.js";
import { createSandboxBattle, sandboxInstanceId } from "../packages/view-core/src/SandboxSetup.js";
import { normalizeSandboxConfig } from "../packages/view-core/src/sandbox-config.js";

const argument = process.argv[2] ?? "{}";
const raw = existsSync(argument) ? readFileSync(argument, "utf8") : argument;
const config = normalizeSandboxConfig(JSON.parse(raw));
const mapPath = resolve("packages/app/public", config.mapUrl ?? "");
const parsed = parseTiledMap(loadTiledMapSync(mapPath));
if (!parsed.ok) {
  throw new Error(`Carte illisible : ${mapPath}`);
}
const map = parsed.map;
const battle = createSandboxBattle(config, map);
const playable = new Set(playablePokemon.map((entry) => entry.id));
const problems: string[] = [];

config.teams.forEach((team, teamIndex) => {
  team.members.forEach((member, memberIndex) => {
    const id = sandboxInstanceId(teamIndex, memberIndex, member.pokemon);
    const instance = battle.state.pokemon.get(id);
    if (!instance) {
      problems.push(`${member.pokemon} absent du combat`);
      return;
    }
    if (member.pokemon !== "dummy" && !playable.has(member.pokemon)) {
      problems.push(`${member.pokemon} hors du roster jouable`);
    }
    for (const move of [...(member.moves ?? []), member.defensiveMove ?? undefined]) {
      if (move && !battle.moveDefinitions.has(move)) {
        problems.push(`${member.pokemon} : move inconnu ${move}`);
      }
    }
    const { x, y } = instance.position;
    const wanted = member.position;
    if (wanted && (wanted.x !== x || wanted.y !== y)) {
      problems.push(`${member.pokemon} posé en (${x},${y}) au lieu de (${wanted.x},${wanted.y})`);
    }
    const height = map.tiles[y]?.[x]?.height;
    console.log(
      `équipe ${teamIndex + 1} (${team.control}) ${member.pokemon} en (${x},${y}) hauteur ${height}, face ${instance.orientation}, moves ${instance.moveIds.join(", ")}`,
    );
  });
});

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`PROBLÈME ${problem}`);
  }
  process.exit(1);
}
console.log(`CHARGÉ SANS ERREUR sur ${config.mapUrl}`);
