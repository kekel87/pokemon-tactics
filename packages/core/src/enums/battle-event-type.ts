export const BattleEventType = {
  TurnStarted: "turn_started",
  TurnEnded: "turn_ended",
  MoveStarted: "move_started",
  PokemonMoved: "pokemon_moved",
  PokemonDashed: "pokemon_dashed",
  DamageDealt: "damage_dealt",
  StatusApplied: "status_applied",
  StatusRemoved: "status_removed",
  StatusImmune: "status_immune",
  StatChanged: "stat_changed",
  PokemonKo: "pokemon_ko",
  PokemonEliminated: "pokemon_eliminated",
  PokemonRevived: "pokemon_revived",
  MoveMissed: "move_missed",
  DefenseActivated: "defense_activated",
  DefenseCleared: "defense_cleared",
  DefenseTriggered: "defense_triggered",
  BattleEnded: "battle_ended",
  ConfusionTriggered: "confusion_triggered",
  ConfusionRedirected: "confusion_redirected",
  ConfusionResisted: "confusion_resisted",
  ConfusionFailed: "confusion_failed",
  InfatuationTriggered: "infatuation_triggered",
  InfatuationResisted: "infatuation_resisted",
  KnockbackApplied: "knockback_applied",
  KnockbackBlocked: "knockback_blocked",
  MultiHitComplete: "multi_hit_complete",
  RechargeStarted: "recharge_started",
  RechargeEnded: "recharge_ended",
  FallDamageDealt: "fall_damage_dealt",
  WallImpactDealt: "wall_impact_dealt",
  TerrainDamageDealt: "terrain_damage_dealt",
  TerrainStatusApplied: "terrain_status_applied",
  IceSlideApplied: "ice_slide_applied",
  IceSlideCollision: "ice_slide_collision",
  LethalTerrainKo: "lethal_terrain_ko",
  MoveCancelled: "move_cancelled",
  AbilityActivated: "ability_activated",
  HeldItemActivated: "held_item_activated",
  HeldItemConsumed: "held_item_consumed",
  ItemKnockedOff: "item_knocked_off",
  ItemStolen: "item_stolen",
  ItemsSwapped: "items_swapped",
  ItemBurned: "item_burned",
  BerryEaten: "berry_eaten",
  ItemRecycled: "item_recycled",
  ItemFlung: "item_flung",
  ItemMoveFailed: "item_move_failed",
  CriticalHit: "critical_hit",
  HpRestored: "hp_restored",
  WeatherSet: "weather_set",
  WeatherCleared: "weather_cleared",
  WeatherDamage: "weather_damage",
  WeatherWar: "weather_war",
  MoveCharging: "move_charging",
  /** Reactive-charge family (plan 150): a charging Mitra-Poing lost focus after taking a hit. */
  FocusInterrupted: "focus_interrupted",
  /** Reactive-charge family (plan 150): a Bec-Canon burned a contact attacker during its charge. */
  BeakBlastBurn: "beak_blast_burn",
  /** Reactive-charge family (plan 150): a Carapiège armed after being hit by a physical move. */
  ShellTrapArmed: "shell_trap_armed",
  Teleported: "teleported",
  HitAndRunRetreat: "hit_and_run_retreat",
  HitAndRunRetreatFallback: "hit_and_run_retreat_fallback",
  BatonPassed: "baton_passed",
  Flinched: "flinched",
  AuraPosted: "aura_posted",
  AuraDissipated: "aura_dissipated",
  AuraBroken: "aura_broken",
  StatChangeBlocked: "stat_change_blocked",
  StatusBlocked: "status_blocked",
  SubstitutePosted: "substitute_posted",
  SubstituteDamaged: "substitute_damaged",
  SubstituteBroken: "substitute_broken",
  SubstituteFailed: "substitute_failed",
  TauntBlocked: "taunt_blocked",
  MoveDisabled: "move_disabled",
  MoveEncored: "move_encored",
  DisableBlocked: "disable_blocked",
  EncoreBlocked: "encore_blocked",
  DisableFailed: "disable_failed",
  EncoreFailed: "encore_failed",
  WishPosted: "wish_posted",
  WishHealed: "wish_healed",
  MoveFailed: "move_failed",
  FieldTerrainPosted: "field_terrain_posted",
  FieldTerrainExpired: "field_terrain_expired",
  DashBlockedByPsychicTerrain: "dash_blocked_by_psychic_terrain",
  DistortionPosted: "distortion_posted",
  DistortionExpired: "distortion_expired",
  FieldGlobalPosted: "field_global_posted",
  FieldGlobalExpired: "field_global_expired",
  TailwindSet: "tailwind_set",
  TailwindEnded: "tailwind_ended",
  GravityMoveBlocked: "gravity_move_blocked",
  EntryHazardPosted: "entry_hazard_posted",
  EntryHazardTriggered: "entry_hazard_triggered",
  EntryHazardRemoved: "entry_hazard_removed",
  EntryHazardAbsorbed: "entry_hazard_absorbed",
  Imprisoned: "imprisoned",
  ImprisonFailed: "imprison_failed",
  HealPrevented: "heal_prevented",
  SpiteApplied: "spite_applied",
  SpiteFailed: "spite_failed",
  FutureSightPosted: "future_sight_posted",
  FutureSightFailed: "future_sight_failed",
  FutureSightStruck: "future_sight_struck",
  PerishAuraPosted: "perish_aura_posted",
  PerishAuraTick: "perish_aura_tick",
  PerishKo: "perish_ko",
  PainSplitApplied: "pain_split_applied",
  EndeavorApplied: "endeavor_applied",
  EndeavorFailed: "endeavor_failed",
  SuperFangApplied: "super_fang_applied",
  SmackedDown: "smacked_down",
  HelpingHandPosted: "helping_hand_posted",
  HelpingHandConsumed: "helping_hand_consumed",
  TypeChanged: "type_changed",
  /** Copie / Gribouille (mimic / sketch): the caster's slot move was replaced by a copied move. */
  MoveCopied: "move_copied",
  /** Copie / Gribouille / Mimique / Photocopie: the move-copy failed (no move to copy). */
  MoveCopyFailed: "move_copy_failed",
  /** Buée Noire / Bain de Smog: the stat stages of the listed mons were reset to 0. */
  StatStagesReset: "stat_stages_reset",
  /** Boost (psych-up): the caster copied the target's stat stages. */
  StatStagesCopied: "stat_stages_copied",
  /** Renversement (topsy-turvy): the target's stat stages had their sign inverted. */
  StatStagesInverted: "stat_stages_inverted",
  /** Permugarde / Permuforce / Permucœur: caster and target swapped a set of stat stages. */
  StatStagesSwapped: "stat_stages_swapped",
  /** Permuvitesse (speed-swap): caster and target swapped their raw Speed stat. */
  SpeedSwapped: "speed_swapped",
  /** Tout ou Rien (final-gambit): fixed damage equal to the caster's current HP was dealt. */
  FinalGambitApplied: "final_gambit_applied",
  /** Vœu Soin (healing-wish): the targeted tile had no valid occupant to revive/heal. */
  ReviveOrHealFailed: "revive_or_heal_failed",
  /** Lien du Destin (destiny-bond): the volatile was posted on the caster. */
  DestinyBondPosted: "destiny_bond_posted",
  /** Lien du Destin (destiny-bond): the caster's killer was dragged down with it. */
  DestinyBondTriggered: "destiny_bond_triggered",
  /** Rancune (grudge): the volatile was posted on the caster. */
  GrudgePosted: "grudge_posted",
  /** Rancune (grudge): the move that KO'd the caster was locked on its attacker for the battle. */
  GrudgeTriggered: "grudge_triggered",
  /** Famille OHKO (K.O. en un coup): the move connected and instantly KO'd the target. */
  OneHitKo: "one_hit_ko",
  /** Lock-in multi-turn (plan 149): the caster got locked into repeating a move (rampage / Brouhaha). */
  LockInStarted: "lock_in_started",
  /** Puissance / Cri Draconique: the target's crit stage was raised. */
  CritStageRaised: "crit_stage_raised",
  /** Affilage (laser-focus): the caster armed a one-shot guaranteed critical hit. */
  GuaranteedCritArmed: "guaranteed_crit_armed",
  /** Manip talent (plan 153): a Pokémon's ability was set/copied/swapped, or suppressed (abilityId undefined). */
  AbilityChanged: "ability_changed",
  /** Malédiction (curse, plan 154): a Ghost caster sacrificed HP and cursed a target. */
  Cursed: "cursed",
  /** Malédiction (curse, plan 154): the Cursed DoT ticked on the target at end-turn. */
  CurseDamage: "curse_damage",
  /** Bâillement (yawn, plan 154): the target became drowsy and will fall asleep at the end of its next turn. */
  Drowsy: "drowsy",
  /** Cognobidon (belly-drum, plan 154): the caster sacrificed HP to maximise its Attack. */
  BellyDrumUsed: "belly_drum_used",
  /** Vol Magnétik (magnet-rise, plan 154): the caster began levitating for N turns. */
  MagnetRisePosted: "magnet_rise_posted",
  /** Vol Magnétik (magnet-rise, plan 154): the caster's levitation expired. */
  MagnetRiseEnded: "magnet_rise_ended",
  /** Par Ici / Poudre Fureur (plan 155): enemies in range pivoted to face the caster. */
  DrewAttention: "drew_attention",
  /** Après Vous (after-you, plan 155): the target ally was promoted to act right after the caster. */
  PromotedToActNext: "promoted_to_act_next",
  /** Interversion (ally-switch, plan 155): the caster and a target ally swapped grid positions. */
  AlliesSwapped: "allies_swapped",
  /** Morphing / Imposteur (plan 157): a Pokémon transformed into a copy of another species. */
  Transformed: "transformed",
  /** Stockage (stockpile, plan 162): the caster added a stockpile layer (now at `count`). */
  Stockpiled: "stockpiled",
  /** Relâche / Avale (plan 162): the caster spent its stockpile layers. */
  StockpileReleased: "stockpile_released",
  /** Partage Garde (guard-split, plan 162): Def & Sp. Def averaged between caster and target. */
  GuardSplit: "guard_split",
} as const;

export type BattleEventType = (typeof BattleEventType)[keyof typeof BattleEventType];
