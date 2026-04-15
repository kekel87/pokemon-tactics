import {
  BattleEventType,
  DefensiveKind,
  StatName,
  StatusType,
  TerrainType,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import {
  BattleLogColors,
  type BattleLogContext,
  type BattleLogEntry,
  formatBattleEvent,
} from "./BattleLogFormatter";

const frContext: BattleLogContext = {
  getPokemonName: (id) => (id === "pika" ? "Pikachu" : id === "bulba" ? "Bulbizarre" : id),
  getMoveName: (id) => (id === "thunderbolt" ? "Tonnerre" : id),
  language: "fr",
};

const enContext: BattleLogContext = {
  ...frContext,
  getPokemonName: (id) => (id === "pika" ? "Pikachu" : id === "bulba" ? "Bulbasaur" : id),
  getMoveName: (id) => (id === "thunderbolt" ? "Thunderbolt" : id),
  language: "en",
};

describe("BattleLogFormatter", () => {
  describe("TurnStarted", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.TurnStarted, pokemonId: "pika", roundNumber: 1 },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Tour de Pikachu");
      expect(result.color).toBe(BattleLogColors.turn);
      expect(result.pokemonIds).toEqual(["pika"]);
    });

    it("formats in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.TurnStarted, pokemonId: "pika", roundNumber: 1 },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu's turn");
    });
  });

  describe("MoveStarted", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.MoveStarted, attackerId: "pika", moveId: "thunderbolt" },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu utilise Tonnerre !");
      expect(result.color).toBe(BattleLogColors.move);
      expect(result.pokemonIds).toEqual(["pika"]);
    });

    it("formats in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.MoveStarted, attackerId: "pika", moveId: "thunderbolt" },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu used Thunderbolt!");
    });
  });

  describe("DamageDealt", () => {
    it("formats damage in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 42, effectiveness: 1 },
        frContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe("Bulbizarre perd 42 PV !");
      expect(result[0].color).toBe(BattleLogColors.damage);
    });

    it("formats damage in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 42, effectiveness: 1 },
        enContext,
      ) as BattleLogEntry[];
      expect(result[0].message).toBe("Bulbasaur lost 42 HP!");
    });

    it("adds super effective line for effectiveness >= 2", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 80, effectiveness: 2 },
        frContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(2);
      expect(result[1].message).toContain("Super efficace");
      expect(result[1].color).toBe(BattleLogColors.effectiveness);
    });

    it("adds extremely effective line for effectiveness >= 4", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 120, effectiveness: 4 },
        enContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(2);
      expect(result[1].message).toContain("Extremely effective");
    });

    it("adds not very effective line for effectiveness <= 0.5", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 10, effectiveness: 0.5 },
        frContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(2);
      expect(result[1].message).toContain("Pas très efficace");
    });

    it("adds barely effective line for effectiveness <= 0.25", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 5, effectiveness: 0.25 },
        enContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(2);
      expect(result[1].message).toContain("Barely effective");
    });

    it("returns null for immune (effectiveness === 0)", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 0, effectiveness: 0 },
        frContext,
      );
      expect(result).toBeNull();
    });

    it("does not add effectiveness line for neutral damage", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.DamageDealt, targetId: "bulba", amount: 30, effectiveness: 1 },
        frContext,
      ) as BattleLogEntry[];
      expect(result).toHaveLength(1);
    });
  });

  describe("MoveMissed", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.MoveMissed, attackerId: "pika", targetId: "bulba" },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu rate son attaque !");
      expect(result.color).toBe(BattleLogColors.miss);
    });

    it("formats in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.MoveMissed, attackerId: "pika", targetId: "bulba" },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu's attack missed!");
    });
  });

  describe("StatusApplied", () => {
    it("formats burn in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusApplied, targetId: "bulba", status: StatusType.Burned },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbizarre est brûlé !");
      expect(result.color).toBe(BattleLogColors.status);
    });

    it("formats sleep in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusApplied, targetId: "pika", status: StatusType.Asleep },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu fell asleep!");
    });

    it("formats seeded in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusApplied, targetId: "bulba", status: StatusType.Seeded },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbizarre est infecté par Vampigraine !");
    });
  });

  describe("StatusRemoved", () => {
    it("formats wake up in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusRemoved, targetId: "pika", status: StatusType.Asleep },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu se réveille !");
    });

    it("formats confusion end in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusRemoved, targetId: "pika", status: StatusType.Confused },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu snapped out of confusion");
    });
  });

  describe("StatusImmune", () => {
    it("formats in French with the target name", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusImmune, targetId: "pika", status: StatusType.Paralyzed },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Ça n'affecte pas Pikachu...");
      expect(result.color).toBe(BattleLogColors.status);
      expect(result.pokemonIds).toEqual(["pika"]);
    });

    it("formats in English with the target name", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatusImmune, targetId: "bulba", status: StatusType.Poisoned },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("It doesn't affect Bulbasaur...");
    });
  });

  describe("TerrainStatusApplied", () => {
    it("formats swamp poison in French", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.TerrainStatusApplied,
          pokemonId: "pika",
          terrain: TerrainType.Swamp,
          status: StatusType.Poisoned,
        },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu est empoisonné par le marécage !");
      expect(result.color).toBe(BattleLogColors.status);
      expect(result.pokemonIds).toEqual(["pika"]);
    });

    it("formats magma burn in English", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.TerrainStatusApplied,
          pokemonId: "bulba",
          terrain: TerrainType.Magma,
          status: StatusType.Burned,
        },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbasaur was burned by the magma!");
    });
  });

  describe("StatChanged", () => {
    it("formats stat up in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatChanged, targetId: "pika", stat: StatName.Attack, stages: 2 },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Attaque de Pikachu augmente !");
      expect(result.color).toBe(BattleLogColors.statUp);
    });

    it("formats stat down in English", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.StatChanged,
          targetId: "bulba",
          stat: StatName.Defense,
          stages: -1,
        },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbasaur's Defense fell!");
      expect(result.color).toBe(BattleLogColors.statDown);
    });

    it("formats special stats", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.StatChanged, targetId: "pika", stat: StatName.SpAttack, stages: 1 },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toContain("Atq. Spé.");
    });
  });

  describe("PokemonKo", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.PokemonKo, pokemonId: "bulba", countdownStart: 3 },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbizarre est K.O. !");
      expect(result.color).toBe(BattleLogColors.ko);
    });

    it("formats in English", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.PokemonKo, pokemonId: "bulba", countdownStart: 3 },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbasaur fainted!");
    });
  });

  describe("DefenseActivated", () => {
    it("formats Protect in French", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.DefenseActivated,
          pokemonId: "pika",
          defenseKind: DefensiveKind.Protect,
        },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu se protège avec Abri !");
      expect(result.color).toBe(BattleLogColors.defense);
    });

    it("formats Counter in English", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.DefenseActivated,
          pokemonId: "pika",
          defenseKind: DefensiveKind.Counter,
        },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu used Counter!");
    });
  });

  describe("DefenseTriggered", () => {
    it("formats blocked in French", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.DefenseTriggered,
          defenderId: "pika",
          defenseKind: DefensiveKind.Protect,
          blocked: true,
        },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Abri protège Pikachu !");
    });

    it("formats reflected in English", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.DefenseTriggered,
          defenderId: "pika",
          defenseKind: DefensiveKind.Counter,
          blocked: false,
        },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Counter reflected the damage!");
    });
  });

  describe("ConfusionTriggered", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.ConfusionTriggered, pokemonId: "pika" },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu est confus...");
      expect(result.color).toBe(BattleLogColors.status);
    });
  });

  describe("KnockbackApplied", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.KnockbackApplied,
          pokemonId: "bulba",
          from: { x: 0, y: 0 },
          to: { x: 1, y: 0 },
        },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Bulbizarre est repoussé !");
    });
  });

  describe("MultiHitComplete", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.MultiHitComplete,
          attackerId: "pika",
          targetId: "bulba",
          totalHits: 3,
        },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Touché 3 fois !");
    });

    it("formats in English", () => {
      const result = formatBattleEvent(
        {
          type: BattleEventType.MultiHitComplete,
          attackerId: "pika",
          targetId: "bulba",
          totalHits: 5,
        },
        enContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Hit 5 times!");
    });
  });

  describe("RechargeStarted", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.RechargeStarted, pokemonId: "pika" },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Pikachu doit se recharger");
      expect(result.color).toBe(BattleLogColors.recharge);
    });
  });

  describe("BattleEnded", () => {
    it("formats in French", () => {
      const result = formatBattleEvent(
        { type: BattleEventType.BattleEnded, winnerId: "Joueur 1" },
        frContext,
      ) as BattleLogEntry;
      expect(result.message).toBe("Joueur 1 remporte le combat !");
      expect(result.color).toBe(BattleLogColors.battleEnded);
    });
  });

  describe("ignored events", () => {
    it("returns null for TurnEnded", () => {
      expect(
        formatBattleEvent({ type: BattleEventType.TurnEnded, pokemonId: "pika" }, frContext),
      ).toBeNull();
    });

    it("returns null for PokemonMoved", () => {
      expect(
        formatBattleEvent(
          { type: BattleEventType.PokemonMoved, pokemonId: "pika", path: [] },
          frContext,
        ),
      ).toBeNull();
    });

    it("returns null for PokemonDashed", () => {
      expect(
        formatBattleEvent(
          { type: BattleEventType.PokemonDashed, pokemonId: "pika", path: [] },
          frContext,
        ),
      ).toBeNull();
    });

    it("returns null for DefenseCleared", () => {
      expect(
        formatBattleEvent(
          {
            type: BattleEventType.DefenseCleared,
            pokemonId: "pika",
            defenseKind: DefensiveKind.Protect,
          },
          frContext,
        ),
      ).toBeNull();
    });

    it("returns null for RechargeEnded", () => {
      expect(
        formatBattleEvent({ type: BattleEventType.RechargeEnded, pokemonId: "pika" }, frContext),
      ).toBeNull();
    });

    it("returns null for ConfusionRedirected", () => {
      expect(
        formatBattleEvent(
          { type: BattleEventType.ConfusionRedirected, pokemonId: "pika" },
          frContext,
        ),
      ).toBeNull();
    });

    it("returns null for KnockbackBlocked", () => {
      expect(
        formatBattleEvent(
          { type: BattleEventType.KnockbackBlocked, pokemonId: "pika", reason: "wall" },
          frContext,
        ),
      ).toBeNull();
    });
  });
});
