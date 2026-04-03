export const Language = {
  French: "fr",
  English: "en",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export interface Translations {
  "action.move": string;
  "action.attack": string;
  "action.item": string;
  "action.wait": string;
  "action.status": string;
  "action.cancel": string;
  "battle.player1": string;
  "battle.player2": string;
  "battle.round": string;
  "battle.wins": string;
  "battle.restart": string;
  "attack.selectTarget": string;
  "attack.confirm": string;
  "stat.atk": string;
  "stat.def": string;
  "stat.spA": string;
  "stat.spD": string;
  "stat.spd": string;
  "stat.acc": string;
  "stat.eva": string;
  "pattern.single": string;
  "pattern.self": string;
  "pattern.line": string;
  "pattern.cone": string;
  "pattern.slash": string;
  "pattern.cross": string;
  "pattern.zone": string;
  "pattern.dash": string;
  "pattern.blast": string;
  "move.power": string;
  "move.accuracy": string;
  "move.range": string;
  "placement.instruction": string;
  "sandbox.reset": string;
  "sandbox.copyUrl": string;
  "sandbox.player": string;
  "sandbox.dummy": string;
  "sandbox.pokemon": string;
  "sandbox.move": string;
  "sandbox.status": string;
  "sandbox.volatile": string;
  "sandbox.direction": string;
  "sandbox.level": string;
  "sandbox.statsFrom": string;
  "sandbox.hpPercent": string;
  "sandbox.base": string;
  "sandbox.computed": string;
  "sandbox.none": string;
  "sandbox.custom": string;
  "sandbox.passive": string;
  "status.burned": string;
  "status.poisoned": string;
  "status.badlyPoisoned": string;
  "status.paralyzed": string;
  "status.frozen": string;
  "status.asleep": string;
  "status.confused": string;
  "status.seeded": string;
  "status.trapped": string;
  "direction.north": string;
  "direction.east": string;
  "direction.south": string;
  "direction.west": string;
  "battle.miss": string;
  "battle.immune": string;
  "battle.extremelyEffective": string;
  "battle.superEffective": string;
  "battle.notVeryEffective": string;
  "battle.mostlyIneffective": string;
  "battle.confused": string;
  "battle.blocked": string;
  "battle.hits": string;
  "battle.recharge": string;
  "battle.statUp": string;
  "battle.statDown": string;
}

export type TranslationKey = keyof Translations;
