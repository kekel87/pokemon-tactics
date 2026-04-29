import type { RosterEntry } from "./roster-entry";

export const rosterPoc: RosterEntry[] = [
  {
    id: "bulbasaur",
    abilityId: "overgrow",
    movepool: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"],
  },
  {
    id: "charmander",
    abilityId: "blaze",
    movepool: ["ember", "scratch", "smokescreen", "dragon-breath"],
  },
  {
    id: "squirtle",
    abilityId: "torrent",
    movepool: ["water-gun", "tackle", "withdraw", "bubble-beam"],
  },
  {
    id: "pidgey",
    abilityId: "keen-eye",
    movepool: ["gust", "quick-attack", "sand-attack", "wing-attack"],
  },
  {
    id: "pikachu",
    abilityId: "static",
    movepool: ["thunderbolt", "thunder-wave", "double-team", "volt-tackle"],
  },
  {
    id: "machop",
    abilityId: "guts",
    movepool: ["karate-chop", "seismic-toss", "bulk-up", "rock-smash"],
  },
  {
    id: "abra",
    abilityId: "synchronize",
    movepool: ["psybeam", "confusion", "kinesis", "calm-mind"],
  },
  {
    id: "gastly",
    abilityId: "levitate",
    movepool: ["lick", "hypnosis", "night-shade", "minimize"],
  },
  {
    id: "geodude",
    abilityId: "sturdy",
    movepool: ["rock-throw", "magnitude", "defense-curl", "rollout"],
  },
  {
    id: "growlithe",
    abilityId: "intimidate",
    movepool: ["bite", "flamethrower", "agility", "flame-wheel"],
  },
  {
    id: "jigglypuff",
    abilityId: "cute-charm",
    movepool: ["pound", "sing", "body-slam", "stockpile"],
  },
  {
    id: "seel",
    abilityId: "thick-fat",
    movepool: ["aurora-beam", "blizzard", "headbutt", "icy-wind"],
  },
  {
    id: "eevee",
    abilityId: "adaptability",
    movepool: ["bite", "quick-attack", "growl", "double-team"],
  },
  { id: "tentacool", abilityId: "clear-body", movepool: ["water-gun", "acid", "toxic", "wrap"] },
  {
    id: "nidoran-m",
    abilityId: "poison-point",
    movepool: ["poison-sting", "double-kick", "roar", "supersonic"],
  },
  {
    id: "meowth",
    abilityId: "technician",
    movepool: ["scratch", "fury-swipes", "growl", "agility"],
  },
  {
    id: "magnemite",
    abilityId: "magnet-pull",
    movepool: ["thunderbolt", "thunder-wave", "flash", "iron-defense"],
  },
  {
    id: "sandshrew",
    abilityId: "sand-veil",
    movepool: ["slash", "scratch", "earthquake", "sand-attack"],
  },
  {
    id: "lickitung",
    abilityId: "own-tempo",
    movepool: ["lick", "hyper-beam", "growl", "dragon-tail"],
  },
  {
    id: "kangaskhan",
    abilityId: "early-bird",
    movepool: ["mega-punch", "scratch", "swords-dance", "body-slam"],
  },
  {
    id: "dummy",
    movepool: ["protect", "detect", "counter", "endure"],
    custom: {
      name: "Dummy",
      types: ["normal"],
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      weight: 10.0,
    },
  },
];
