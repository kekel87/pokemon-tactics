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
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
