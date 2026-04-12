import type { RosterEntry } from "./roster-entry";

export const rosterPoc: RosterEntry[] = [
  { id: "bulbasaur", movepool: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"] },
  { id: "charmander", movepool: ["ember", "scratch", "smokescreen", "dragon-breath"] },
  { id: "squirtle", movepool: ["water-gun", "tackle", "withdraw", "bubble-beam"] },
  { id: "pidgey", movepool: ["gust", "quick-attack", "sand-attack", "wing-attack"] },
  { id: "pikachu", movepool: ["thunderbolt", "thunder-wave", "double-team", "volt-tackle"] },
  { id: "machop", movepool: ["karate-chop", "seismic-toss", "bulk-up", "rock-smash"] },
  { id: "abra", movepool: ["psybeam", "confusion", "kinesis", "calm-mind"] },
  { id: "gastly", movepool: ["lick", "hypnosis", "night-shade", "minimize"] },
  { id: "geodude", movepool: ["rock-throw", "magnitude", "defense-curl", "rollout"] },
  { id: "growlithe", movepool: ["bite", "flamethrower", "agility", "flame-wheel"] },
  { id: "jigglypuff", movepool: ["pound", "sing", "body-slam", "stockpile"] },
  { id: "seel", movepool: ["aurora-beam", "blizzard", "headbutt", "icy-wind"] },
  { id: "eevee", movepool: ["bite", "quick-attack", "growl", "double-team"] },
  { id: "tentacool", movepool: ["water-gun", "acid", "toxic", "wrap"] },
  { id: "nidoran-m", movepool: ["poison-sting", "double-kick", "roar", "supersonic"] },
  { id: "meowth", movepool: ["scratch", "fury-swipes", "growl", "agility"] },
  { id: "magnemite", movepool: ["thunderbolt", "thunder-wave", "flash", "iron-defense"] },
  { id: "sandshrew", movepool: ["slash", "scratch", "earthquake", "sand-attack"] },
  { id: "lickitung", movepool: ["lick", "hyper-beam", "growl", "dragon-tail"] },
  { id: "kangaskhan", movepool: ["mega-punch", "scratch", "swords-dance", "body-slam"] },
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
