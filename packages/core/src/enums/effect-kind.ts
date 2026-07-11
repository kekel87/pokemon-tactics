export const EffectKind = {
  Damage: "damage",
  Status: "status",
  StatChange: "stat_change",
  Defensive: "defensive",
  Knockback: "knockback",
  HealSelf: "heal_self",
  Recoil: "recoil",
  Drain: "drain",
  SetWeather: "set_weather",
  TransferStatStages: "transfer_stat_stages",
  PostAura: "post_aura",
  PostSubstitute: "post_substitute",
  Disable: "disable",
  Encore: "encore",
  /** Heal the move's resolved target by a percent of its max HP (heal-pulse, life-dew, pollen-puff). */
  HealTarget: "heal_target",
  /** Cure major status of allies in radius around the caster (aromatherapy). */
  CureTeamStatus: "cure_team_status",
  /** Heal the caster by the target's effective stat value, then a stat drop follows (strength-sap). */
  HealByTargetStat: "heal_by_target_stat",
  /** Post a persistent heal-over-time volatile on the caster (ingrain, aqua-ring). */
  PostHealOverTime: "post_heal_over_time",
  /** Schedule a delayed heal on an ally that fires on the target's next turn (wish). */
  PostWish: "post_wish",
  /** Paint a field-terrain zone around the caster (B4: grassy/electric/misty/psychic terrain). */
  PostFieldTerrain: "post_field_terrain",
  /** Post a Trick Room ("Distorsion") zone around the caster: inverts CT tempo inside it. */
  PostDistortion: "post_distortion",
  /** Place an entry-hazard trap on the move's target tile (Picots / Pièges de Roc / Pics Toxik / Toile Gluante). */
  PostEntryHazard: "post_entry_hazard",
  /** Clear entry-hazard traps within a radius of the user (Tour Rapide / Anti-Brume). */
  RemoveEntryHazards: "remove_entry_hazards",
  /** Post the persistent Imprison ("Possessif") volatile on the caster. */
  PostImprison: "post_imprison",
  /** Apply a one-shot Charge-Time tax on the target's next action (Dépit / spite). */
  SpiteCtTax: "spite_ct_tax",
  /** Schedule a tile-bound delayed strike that lands after a delay (Prescience / future-sight). */
  PostFutureSight: "post_future_sight",
  /** Set a perish countdown on every Pokemon on the field (Requiem / perish-song). */
  PostPerishSong: "post_perish_song",
  /** Average the caster's and target's current HP (Balance / pain-split). */
  PainSplit: "pain_split",
  /** Set the target's HP to the caster's HP when the target's is higher (Effort / endeavor). */
  Endeavor: "endeavor",
  /** Buff an adjacent ally's next offensive move by ×1.5 (Coup d'Main / helping-hand). */
  HelpingHand: "helping_hand",
  /** Remove the target's held item without making it recyclable (Sabotage post-hit / Gaz Corrosif). */
  RemoveItem: "remove_item",
  /** Steal the target's held item if the user is empty-handed (Larcin / Implore). */
  StealItem: "steal_item",
  /** Swap held items with the target (Tour de Magie / Passe-Passe). */
  SwapItems: "swap_items",
  /** Throw the user's held item at the target for damage + its fling effect (Dégommage). */
  FlingItem: "fling_item",
  /** Eat the target's berry, applying its effect to the user (Picore / Piqûre). */
  EatTargetBerry: "eat_target_berry",
  /** Destroy the target's berry or gem with no effect (Calcination). */
  BurnTargetItem: "burn_target_item",
  /** Restore the user's last self-consumed item (Recyclage). */
  RecycleItem: "recycle_item",
  /** Set the caster's type to the type of its first move (Conversion). */
  ConvertSelfType: "convert_self_type",
  /** Set the caster's type to one resisting the target's last-used move (Conversion 2). */
  ConvertResistType: "convert_resist_type",
  /** Copy the target's effective types onto the caster (Copie-Type / reflect-type). */
  CopyTargetType: "copy_target_type",
  /** Set the target's type to a single pure type (Détrempage → Water). */
  SoakType: "soak_type",
  /** Remove a type from the caster after dealing damage (Flamme Ultime → drop Fire). */
  RemoveType: "remove_type",
  /** Replace the source move's slot with the target's last used move (Copie / Gribouille). */
  CopyMoveToSlot: "copy_move_to_slot",
  /** Post a localized "field global" zone around the caster (Gravité / Zone Étrange / Zone Magique). */
  PostFieldGlobal: "post_field_global",
  /** Set the single global directional wind (Vent Arrière / tailwind). */
  SetTailwind: "set_tailwind",
  /** Reset the stat stages of a target (Bain de Smog) or of every mon in a radius (Buée Noire). */
  ResetStatStages: "reset_stat_stages",
  /** Copy the target's stat stages onto the caster (Boost / psych-up). */
  CopyStatStages: "copy_stat_stages",
  /** Invert the sign of every stat stage of the target (Renversement / topsy-turvy). */
  InvertStatStages: "invert_stat_stages",
  /** Swap a set of stat stages between the caster and the target (Permugarde / Permuforce / Permucœur). */
  SwapStatStages: "swap_stat_stages",
  /** Swap the raw Speed stat between the caster and the target (Permuvitesse / speed-swap). */
  SwapRawSpeed: "swap_raw_speed",
  /**
   * Phazing: eject every enemy target back to its own spawn zone (Cyclone / Hurlement / Projection).
   * Reuses `ejectToSpawn` — the forced-teleport family reinterpretation of switch-out on the grid.
   */
  PhazeToSpawn: "phaze_to_spawn",
  /** Deal fixed damage equal to the caster's current HP, typed (Tout ou Rien / final-gambit). */
  FinalGambit: "final_gambit",
  /**
   * Sacrifice heal (Vœu Soin / healing-wish, reinvented « Second Souffle »): revive a KO'd occupant of
   * the target tile to 50% max HP, or fully heal a living one to 100%, clearing status either way.
   */
  ReviveOrHeal: "revive_or_heal",
  /** Post the Lien du Destin volatile: if the caster is KO'd before its next turn, the killer faints too. */
  PostDestinyBond: "post_destiny_bond",
  /** Post the Rancune volatile: if the caster is KO'd by a move, that move is locked on the killer for the battle. */
  PostGrudge: "post_grudge",
  /** Raise the crit stage of the caster (Puissance / focus-energy) or an ally (Cri Draconique / dragon-cheer). */
  RaiseCritStage: "raise_crit_stage",
  /** Arm a one-shot guaranteed critical hit on the caster's next offensive move (Affilage / laser-focus). */
  ArmGuaranteedCrit: "arm_guaranteed_crit",
  /** Deal fixed damage equal to half the target's current HP, min 1 (Croc Fatal / super-fang). */
  HalveTargetHp: "halve_target_hp",
  /** Ground the target (Anti-Air / smack-down): loses Flying's Ground immunity + becomes hazard-vulnerable. */
  SmackDown: "smack_down",
  /** Set the target's ability to a fixed one (Soucigraine / worry-seed → Insomnie). */
  SetAbility: "set_ability",
  /** Suppress the target's ability for the rest of the battle (Suc Digestif / gastro-acid). */
  SuppressAbility: "suppress_ability",
  /** Copy the target's effective ability onto the caster (Imitation / role-play). */
  CopyAbility: "copy_ability",
  /** Swap the effective abilities of the caster and the target (Échange / skill-swap). */
  SwapAbility: "swap_ability",
  /**
   * Malédiction (curse, plan 154): dual behaviour by the CASTER's effective type. Ghost → sacrifice
   * 50% max HP + post a 25%/turn Cursed DoT on an enemy; non-Ghost → self −1 Spe / +1 Atk / +1 Def.
   */
  Curse: "curse",
  /** Cognobidon (belly-drum, plan 154): lose 50% max HP, then maximise Attack (stages → +6). */
  BellyDrum: "belly_drum",
  /** Bâillement (yawn, plan 154): make the target drowsy → it falls asleep at the end of its next turn. */
  Yawn: "yawn",
  /** Acupression (acupressure, plan 154): +2 stages to one random battle stat of the caster or an ally. */
  RaiseRandomStat: "raise_random_stat",
  /** Attraction (attract, plan 154): infatuate an opposite-gender target (50% skip, position-linked). */
  Attract: "attract",
  /** Vol Magnétik (magnet-rise, plan 154): the caster levitates for 5 turns (temporary effectively-flying). */
  MagnetRise: "magnet_rise",
  /**
   * Par Ici / Poudre Fureur (follow-me / rage-powder, plan 155): every enemy inside a Manhattan
   * diamond around the caster pivots to face the caster (one-shot), exposing its back. Poudre Fureur
   * is a powder move — powder-immune enemies (Grass / Envelocape / Lunettes Filtre) do not turn.
   */
  DrawAttention: "draw_attention",
  /**
   * Après Vous (after-you, plan 155): the target ally becomes the strictly-next actor in the CT
   * scheduler, without resetting anyone else's gauge (non-destructive promotion).
   */
  ActAfterUser: "act_after_user",
  /** Interversion (ally-switch, plan 155): the caster swaps grid positions with a target ally. */
  SwapAllyPositions: "swap_ally_positions",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
