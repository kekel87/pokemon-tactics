// Reusable, ID-validated sandbox configs (the dev/test-only URL boot consumes these). Keep the
// Pokemon/move/ability IDs here in sync with packages/data — a bad ID throws at boot. Centralising
// them means one place to fix when the roster changes, and self-documenting test intent.

/** A fixed adjacent duel: player (2,3) vs an inert dummy (2,2). Griffe (scratch) has range 1, so
 *  it always reaches the dummy. Seed is explicit because driving tests assert the RNG outcome. */
export const DUEL = {
  seed: 12345,
  pokemon: "venusaur",
  moves: ["scratch"],
  playerPosition: { x: 2, y: 3 },
  playerDirection: "north",
  dummyPosition: { x: 2, y: 2 },
} as const;

/** Same duel but the dummy is one hit from fainting → any Griffe is lethal (KO log assertion). */
export const DUEL_LETHAL = { ...DUEL, dummyHp: 1 } as const;

/** Player starts poisoned → the HUD must mount a status icon (test-plan §3.4). */
export const POISONED = { status: "poisoned" } as const;

/** Same duel but the only move is a multi-hit one: Balle Graine (bullet-seed) is 100% accuracy so
 *  it always lands, and the seed makes the 2-5 hit count deterministic → the log emits a single
 *  "Touché N fois !" line (test-plan §5 multi-hit). Dummy keeps full HP so it survives the volley. */
export const MULTI_HIT = { ...DUEL, moves: ["bullet-seed"] } as const;

/** Duel where the player's only move is Danse Lames (swords-dance), a self stat-up buff → the
 *  tooltip pattern grid reads as a "buff" intent (test-plan §6 preview colours). */
export const PREVIEW_BUFF = { ...DUEL, moves: ["swords-dance"] } as const;

/** Duel where the player's only move is Fontaine de Vie (life-dew), a self-centred AoE heal → the
 *  tooltip pattern grid reads as a "heal" intent with the caster tile inside the zone. */
export const PREVIEW_HEAL = { ...DUEL, moves: ["life-dew"] } as const;

/** Duel where the player's only move is Bélier (take-down), a dash move → the tooltip pattern grid
 *  draws the dash-trail cells. */
export const PREVIEW_DASH = { ...DUEL, moves: ["take-down"] } as const;

/** Directional dash (chantier g) : Raichu en bas de la colonne (2,5), face nord, Vive-Attaque
 *  (quick-attack, Dash 2). Le dummy est HORS de l'axe (4,4) → la colonne nord est libre, le dash
 *  glisse aussi loin qu'il peut (portée auto). Confirmer par DIRECTION : cliquer n'importe quelle
 *  tuile de l'axe nord (≠ tuile d'atterrissage) valide le dash — c'est tout l'objet du test. */
export const DASH_DIRECTIONAL = {
  ...DUEL,
  pokemon: "raichu",
  moves: ["quick-attack"],
  playerPosition: { x: 2, y: 5 },
  playerDirection: "north",
  dummyPosition: { x: 4, y: 4 },
} as const;

/** Duel where the player's only move is Séisme (earthquake), a self-centred Zone AoE that does NOT
 *  affect the caster tile → the centre cell is an empty "caster" (cross, no fill). */
export const PREVIEW_QUAKE = { ...DUEL, moves: ["earthquake"] } as const;

/** Entry hazards (plan 131) — Cloyster apprend Picots (`spikes`), un poseur `GroundTarget` (vise
 *  une case au sol ≤4 Manhattan). Le joueur est à (2,3), le dummy inerte à (2,4). On vise une case
 *  libre et traversable à portée — (2,1), distance 2 — pour poser les Picots. La pose émet
 *  `EntryHazardPosted` (journal « Des Picots sont posés au sol ») + peint un mesh au sol
 *  (`hazard_hazards_spikes_1_2_1`). Le DÉCLENCHEMENT à l'entrée n'est PAS pilotable ici (le joueur
 *  ne déclenche pas SES propres pièges — owner-immunity — et le dummy AI ne se déplace jamais) → le
 *  sens du déclenchement reste couvert par les unit/integration du core (`entry-hazard-system`,
 *  `resolve-hazard-traversal`). Picots est un move statut sans jet de précision → cast déterministe. */
export const ENTRY_HAZARD_SPIKES = {
  ...DUEL,
  pokemon: "cloyster",
  moves: ["spikes"],
  playerPosition: { x: 2, y: 3 },
  dummyPosition: { x: 2, y: 4 },
} as const;

/** Puissance conditionnelle — Branchicrok (`fishious-rend`, Eau Phys 80, ×2 si la cible n'a pas agi
 *  depuis la dernière action du lanceur). Move hors-pool forcé via `moves` (SandboxSetup écrase
 *  `moveIds` sans regarder le learnset). Au tour 1 personne n'a agi (`lastActedAtAction` des deux =
 *  -1, donc cible ≤ lanceur) → la condition ×2 est ACTIVE et le move résout. Portée 1 (Single 1-1),
 *  donc le lanceur (2,3) et la cible (2,2) sont adjacents : aucun jet de portée. Précision 100 % →
 *  cast déterministe quel que soit le seed. On assert la ligne « perd N PV » (la résolution passe
 *  par l'orchestrateur avec la condition ×2 active) ; la valeur exacte du ×2 reste couverte unit. */
export const DYNAMIC_FISHIOUS_REND = { ...DUEL, moves: ["fishious-rend"] } as const;

/** Idem mais Prise de Bec (`bolt-beak`, Électrik Phys 80) — même condition « cible fraîche → ×2 ». */
export const DYNAMIC_BOLT_BEAK = { ...DUEL, moves: ["bolt-beak"] } as const;

// Hommage Posthume (`last-respects`, Spectre Phys 50, puissance ×(1 + alliés K.O.)) n'a PAS de config
// ici à dessein : la sandbox est un 1v1 (le lanceur n'a aucun allié) et n'expose ni équipe à 2+ ni
// amorçage d'allié K.O. → le facteur d'échelle vaut toujours 1, le SCALING est donc non observable.
// Le sens (`faintedAllyCount`/`AllyFaintCountScaled`) reste couvert par les unit/integration du core
// (`dynamic-power-system.test.ts`, `moves/last-respects.test.ts`). Cf. test-plan §5.23 (case 👁).

// Talents Tier A (plan 136) — observables pilotables via journal FR, déterministes (aucun jet).

/** Régé-Force (regenerator) — soin passif de fin de tour (réinterprétation tactique, ~1/16 PV max).
 *  Le joueur Florizarre démarre blessé (hp 50, sous son max) avec le talent ; la fin de tour applique
 *  le soin et journalise « Régé-Force de <X> s'active ! » + « <X> récupère N PV » (HpRestored). Aucun
 *  jet : le hook `onEndTurn` est inconditionnel dès lors que le porteur n'est pas au max → déterministe. */
export const REGENERATOR_HEAL = { ...DUEL, playerAbility: "regenerator", hp: 50 } as const;

/** Multi-Coups (skill-link) — un move à frappes variables (Balle Graine, 2-5) touche TOUJOURS le max
 *  (5). Le joueur porte le talent et lance Balle Graine (100 % précision, force-pool via `moves`) sur
 *  le dummy adjacent endurant (hp 999, survit aux 5 coups) → le récap journal lit « Touché 5 fois ! »
 *  quel que soit le seed (le talent court-circuite le tirage aléatoire du nombre de coups). */
export const SKILL_LINK_MAX_HITS = {
  ...DUEL,
  moves: ["bullet-seed"],
  playerAbility: "skill-link",
  dummyHp: 999,
} as const;

/** Querelleur (scrappy) — un coup Normal touche un Spectre normalement immunisé. Le joueur porte le
 *  talent et lance Griffe (Normal, 100 % précision, portée 1) sur l'Ectoplasma (gengar, Spectre/Poison)
 *  adjacent. Sans Querelleur le coup serait totalement bloqué (« Ça n'affecte pas… », aucun dégât) ;
 *  avec, l'efficacité est ramenée à neutre (1) → le journal lit « <X> perd N PV » (et PAS « Ça n'affecte
 *  pas »). Garde la régression du fix handle-damage (effectiveness 0 → 1). Cast déterministe. */
export const SCRAPPY_HITS_GHOST = {
  ...DUEL,
  playerAbility: "scrappy",
  dummyPokemon: "gengar",
  dummyHp: 999,
} as const;

// Talents Tier B (plan 137) — observables pilotables via journal/HUD FR, déterministes.

/** Sécheresse (drought) — invoque le Soleil 5 tours à l'ENTRÉE (hook `weatherAutoSetter` câblé dans
 *  `triggerBattleStart`). Le joueur Goupix (vulpix) porte le talent ; aucune action n'est requise : la
 *  météo est posée à la création du combat, donc le HUD météo affiche « Plein soleil » dès le boot.
 *  Pas de jet → déterministe (seed hérité de DUEL). On part SANS météo explicite (`weather: none`)
 *  pour prouver que c'est bien Sécheresse — et non la config — qui pose le Soleil. */
export const DROUGHT_SETS_SUN = {
  ...DUEL,
  pokemon: "vulpix",
  playerAbility: "drought",
  weather: "none",
} as const;

/** Cuvette (rain-dish) — soin passif de fin de tour SOUS PLUIE (`ceil(maxHp/16)`). Le joueur Carapuce
 *  (squirtle) porte le talent, démarre blessé (hp 50, sous son max) et le combat est sous Pluie
 *  (`weather: rain`). La fin de tour applique le soin et journalise « Cuvette de <X> s'active ! » +
 *  « <X> récupère N PV » (HpRestored). Aucun jet (le hook `onEndTurn` est inconditionnel dès lors que
 *  la météo est Pluie et que le porteur n'est pas au max) → déterministe. */
export const RAIN_DISH_HEAL = {
  ...DUEL,
  pokemon: "squirtle",
  playerAbility: "rain-dish",
  hp: 50,
  weather: "rain",
} as const;

/** Vaccin (immunity) — immunité au Poison. Le joueur Mackogneur lance Poudre Toxik (`poison-powder`,
 *  Zone r1, 75 % de base) sur le dummy Ronflex (snorlax) adjacent porteur de Vaccin. Le caster porte
 *  Aucun Garde (`no-guard`, dans ses slots) → précision forcée à 100 % : le coup touche TOUJOURS sous
 *  seed fixe (sinon Poudre Toxik à 75 % peut rater et le blocage ne se déclenche pas). Sans Vaccin le
 *  dummy serait empoisonné ; avec, le statut est bloqué → le journal lit « Vaccin de Ronflex s'active ! »
 *  et JAMAIS « est empoisonné ». Move statut piloté par le joueur (pas d'AI) → cast déterministe. */
export const IMMUNITY_BLOCKS_POISON = {
  ...DUEL,
  pokemon: "machamp",
  playerAbility: "no-guard",
  moves: ["poison-powder"],
  dummyPokemon: "snorlax",
  dummyAbility: "immunity",
} as const;

/** Distorsion (trick-room) — slow caster, fast foe, both inside the r3 zone (decision 2026-06-18).
 *  Player = Flagadoss (slowbro, base Vit 30) at (2,3) casting Distorsion ; dummy = Électrode
 *  (electrode, base Vit 150) at (2,2), distance 1 → both in the diamond. Once the zone is posted the
 *  CT tempo inverts inside it (slow plays first), so the predicted timeline must list the slow
 *  Flagadoss BEFORE the fast Électrode — the opposite of the no-Distorsion order. Seed fixed for a
 *  replayable run; Distorsion is a Self status move (no accuracy roll), so the cast is deterministic. */
export const DISTORTION_INVERSION = {
  ...DUEL,
  pokemon: "slowbro",
  moves: ["trick-room"],
  playerPosition: { x: 2, y: 3 },
  dummyPokemon: "electrode",
  dummyPosition: { x: 2, y: 2 },
} as const;
