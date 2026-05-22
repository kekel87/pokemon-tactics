const SKULL_BASH_LEARNERS: readonly string[] = [
  "charizard",
  "blastoise",
  "beedrill",
  "raticate",
  "fearow",
  "arbok",
  "raichu",
  "sandslash",
  "nidoqueen",
  "nidoking",
  "clefable",
  "ninetales",
  "wigglytuff",
  "parasect",
  "persian",
  "golduck",
  "primeape",
  "arcanine",
  "poliwrath",
  "alakazam",
  "machamp",
  "tentacruel",
  "rapidash",
  "slowbro",
  "farfetch-d",
  "dodrio",
  "dewgong",
  "gengar",
  "onix",
  "hypno",
  "electrode",
  "marowak",
  "hitmonlee",
  "hitmonchan",
  "lickitung",
  "rhydon",
  "chansey",
  "tangela",
  "kangaskhan",
  "seadra",
  "seaking",
  "starmie",
  "mr-mime",
  "scyther",
  "jynx",
  "electabuzz",
  "magmar",
  "tauros",
  "gyarados",
  "lapras",
  "vaporeon",
  "jolteon",
  "flareon",
  "porygon",
  "omastar",
  "kabutops",
  "snorlax",
  "dragonite",
  "mewtwo",
  "mew",
];

const RAZOR_WIND_LEARNERS: readonly string[] = [
  "butterfree",
  "beedrill",
  "pidgeot",
  "fearow",
  "golbat",
  "venomoth",
  "farfetch-d",
  "scyther",
  "articuno",
  "zapdos",
  "moltres",
  "dragonite",
  "mew",
];

const EXTRA_MOVES_BY_POKEMON: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const add = (pokemonId: string, moveId: string): void => {
    let set = map.get(pokemonId);
    if (set === undefined) {
      set = new Set<string>();
      map.set(pokemonId, set);
    }
    set.add(moveId);
  };
  for (const id of SKULL_BASH_LEARNERS) {
    add(id, "skull-bash");
  }
  for (const id of RAZOR_WIND_LEARNERS) {
    add(id, "razor-wind");
  }
  return map;
})();

export function getExtraLearnsetMoves(pokemonId: string): ReadonlySet<string> {
  return EXTRA_MOVES_BY_POKEMON.get(pokemonId) ?? new Set<string>();
}
