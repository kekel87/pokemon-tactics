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
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
