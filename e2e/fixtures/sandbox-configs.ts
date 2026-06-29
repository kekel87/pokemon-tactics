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

/** Lance-Soleil sous Soleil (bug fix charge↔météo) — Florizarre (venusaur), seul move Lance-Soleil
 *  (`solar-beam`, Ligne longueur 5, `sunSkipsCharge`). SOUS Soleil le tour de charge est SAUTÉ : la
 *  sélection passe DIRECT en phase de ciblage (aucune preview de charge sur la propre case du
 *  lanceur), donc AUCUN mesh `highlight_preview_buff` n'est peint. Seed hérité de DUEL, Lance-Soleil
 *  100 % précision → tir déterministe. */
export const SOLAR_BEAM_SUN = {
  ...DUEL,
  moves: ["solar-beam"],
  weather: "sun",
} as const;

/** Contrôle hors Soleil (Pluie) — même Florizarre / Lance-Soleil, mais le tour de charge N'EST PAS
 *  sauté : la sélection peint la preview de charge sur la propre case du lanceur (mesh
 *  `highlight_preview_buff` sur (2,3)). Prouve que c'est bien le Soleil — et non Lance-Soleil en soi —
 *  qui supprime la charge. */
export const SOLAR_BEAM_RAIN = {
  ...DUEL,
  moves: ["solar-beam"],
  weather: "rain",
} as const;

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

// Talents Tier C (plan 138) — observables pilotables via journal/HUD FR, déterministes (aucun jet).

/** Force Soleil (solar-power) — sous Soleil le porteur perd 1/8 de ses PV max EN FIN DE TOUR
 *  (hook `onEndTurn`, inconditionnel dès lors que la météo est Soleil). Le Dracaufeu (charizard, slot
 *  Force Soleil) démarre blessé (hp 50) sous Soleil ; aucune cible n'est requise : « Attendre » résout
 *  la fin de tour qui journalise « Force Soleil de <X> s'active ! » + « <X> perd N PV ! » (DamageDealt).
 *  Pas de jet → déterministe (seed hérité de DUEL). */
export const SOLAR_POWER_SUN_BURN = {
  ...DUEL,
  pokemon: "charizard",
  playerAbility: "solar-power",
  hp: 50,
  weather: "sun",
} as const;

/** Anti-Bruit (soundproof) — immunité totale aux moves `flags.sound`. Le joueur Dracaufeu force
 *  Mégaphone (`hyper-voice`, sonore, Spécial 90, 100 % précision → touche sous tout seed) sur
 *  l'Électrode (electrode, slot Anti-Bruit) adjacent. Le talent bloque le move AVANT les dégâts : le
 *  journal lit « Anti-Bruit de <X> s'active ! » et l'Électrode (hp plein) ne perd JAMAIS de PV. Cast
 *  100 % piloté par le joueur → déterministe. */
export const SOUNDPROOF_BLOCKS_SOUND = {
  ...DUEL,
  pokemon: "charizard",
  moves: ["hyper-voice"],
  dummyPokemon: "electrode",
  dummyAbility: "soundproof",
} as const;

/** Boom Final (aftermath) — si le porteur est mis K.O. par un move `flags.contact`, l'attaquant perd
 *  1/4 de SES PV max en recul. Le joueur Dracaufeu lance Griffe (`scratch`, contact, 100 %) sur le
 *  Smogogo (weezing, slot Boom Final) adjacent à 1 PV → le coup le met K.O. et déclenche le recul :
 *  le journal lit « Boom Final de <X> s'active ! » + « <le Dracaufeu> perd N PV ! » (DamageDealt sur
 *  l'attaquant). Cast 100 % piloté par le joueur → déterministe. */
export const AFTERMATH_CONTACT_RECOIL = {
  ...DUEL,
  pokemon: "charizard",
  dummyPokemon: "weezing",
  dummyAbility: "aftermath",
  dummyHp: 1,
} as const;

/** Armurouillée (weak-armor) — touché par un move PHYSIQUE → Défense -1 et Vitesse +2 sur le porteur.
 *  Le joueur Dracaufeu lance Griffe (`scratch`, physique, 100 %) sur l'Onix (onix, slot Armurouillée)
 *  adjacent endurant (hp 999, survit au coup) → le journal lit « Défense de <X> baisse ! » ET
 *  « Vitesse de <X> augmente ! » en plus de « Armurouillée de <X> s'active ! ». Cast 100 % piloté par
 *  le joueur → déterministe. */
export const WEAK_ARMOR_PHYSICAL_HIT = {
  ...DUEL,
  pokemon: "charizard",
  dummyPokemon: "onix",
  dummyAbility: "weak-armor",
  dummyHp: 999,
} as const;

// Talents soutien & couplage objet (plan 141) — observables pilotables via journal FR, déterministes.

/** Moiteur (damp) — bloque les moves d'explosion (Destruction) depuis n'importe quelle position d'un
 *  Pokémon vivant porteur. Le joueur Électrode force Destruction (`self-destruct`, `isExplosion`,
 *  portée 1) sur le Psykokwak (psyduck, slot Moiteur) adjacent. Le talent fait échouer le move AVANT
 *  les dégâts (et avant l'auto-K.O. de l'Électrode) → le journal lit « Moiteur de <X> s'active ! » +
 *  « Mais cela échoue (Électrode) ! », et le Psykokwak ne perd JAMAIS de PV. Move statut sans jet de
 *  précision, cast piloté par le joueur → déterministe (seed hérité de DUEL). */
export const DAMP_FIZZLES_SELF_DESTRUCT = {
  ...DUEL,
  pokemon: "electrode",
  moves: ["self-destruct"],
  dummyPokemon: "psyduck",
  dummyAbility: "damp",
} as const;

/** Gloutonnerie (gluttony) — la baie de pincement se mange à 50 % PV (au lieu de 25 %). Le joueur
 *  Ronflex porte Gloutonnerie ET une Baie Lichii (`liechi-berry`, Attaque +1 en pincement) et démarre
 *  à 40 % PV (`hp: 40` = pourcentage du max). 40 % est SOUS le seuil 50 % de Gloutonnerie mais AU-DESSUS
 *  du seuil canon 25 % → la baie ne se déclenche QUE grâce au talent. « Attendre » résout la fin de tour :
 *  le journal lit « Baie Lichii de <X> s'active ! » + « Attaque de <X> augmente ! » + « <X> a utilisé son
 *  Baie Lichii ». Pas de jet (le hook `onEndTurn` baie est inconditionnel en pincement) → déterministe. */
export const GLUTTONY_PINCH_BERRY = {
  ...DUEL,
  pokemon: "snorlax",
  playerAbility: "gluttony",
  heldItem: "liechi-berry",
  hp: 40,
} as const;

// Talents attaquant Tier C (plan 139) — manipulent l'effet SECONDAIRE d'un move offensif. Bombe Beurk
// (`sludge-bomb`, Poison, Blast portée 2-4) porte un secondaire 30 % poison. Le dummy endurant est posé
// à (2,1), distance 2 du lanceur (2,3) → dans la portée du Blast, et survit (hp 999) pour qu'on observe
// le STATUT plutôt qu'un K.O. Bombe Beurk hors-pool → forcée via `moves` (SandboxSetup écrase le slot).

/** Sans Limite (sheer-force) — un move à effet secondaire perd son secondaire (et gagne ×1.3 puissance,
 *  couvert en unit/integration). Le Nidoking porteur lance Bombe Beurk sur le dummy : le secondaire
 *  poison est SUPPRIMÉ AVANT tout tirage → « Sans Limite de <X> s'active ! » apparaît une fois et le
 *  dummy n'est JAMAIS empoisonné, quel que soit le seed (la suppression est inconditionnelle). */
export const SHEER_FORCE_SUPPRESSES_SECONDARY = {
  ...DUEL,
  pokemon: "nidoking",
  moves: ["sludge-bomb"],
  playerAbility: "sheer-force",
  playerPosition: { x: 2, y: 3 },
  dummyPosition: { x: 2, y: 1 },
  dummyHp: 999,
} as const;

/** Sérénité (serene-grace) — DOUBLE la chance des effets secondaires (30 % poison → 60 %). Le talent est
 *  un modificateur silencieux (pas d'`AbilityActivated`), donc on prouve le doublement par un FLIP
 *  déterministe : au seed 1, le tirage du secondaire de Bombe Beurk échoue à 30 % (config témoin
 *  ci-dessous) mais réussit à 60 % → le dummy est empoisonné UNIQUEMENT avec Sérénité. Leveinard
 *  (chansey) est le porteur Gen-1. Move 100 % précision sur cible à portée → seul le tirage du
 *  secondaire varie, et le seed 1 le fige des deux côtés. */
export const SERENE_GRACE_FLIPS_SECONDARY = {
  ...DUEL,
  seed: 1,
  pokemon: "chansey",
  moves: ["sludge-bomb"],
  playerAbility: "serene-grace",
  playerPosition: { x: 2, y: 3 },
  dummyPosition: { x: 2, y: 1 },
  dummyHp: 999,
} as const;

/** Témoin du flip Sérénité : MÊME config/seed mais SANS le talent → au seed 1 le secondaire 30 % de
 *  Bombe Beurk échoue, donc le dummy n'est PAS empoisonné. Comparé à {@link SERENE_GRACE_FLIPS_SECONDARY},
 *  prouve que c'est bien le doublement (et non le seed) qui pose le poison. */
export const SERENE_GRACE_BASELINE_NO_ABILITY = {
  ...SERENE_GRACE_FLIPS_SECONDARY,
  playerAbility: undefined,
} as const;

// Métronome (objet) — boost +10 % de dégâts par usage CONSÉCUTIF du MÊME move (succès au
// tour précédent), cumulatif, cap +100 %. Observable de bout en bout : 2× Griffe d'affilée sur la
// même cible endurante → le 2e coup retire STRICTEMENT plus de PV que le 1er (×1.1 au 2e usage).

/** Le joueur Florizarre tient le Métronome (`heldItem`) et lance Griffe (`scratch`, Normal, 100 %
 *  précision, portée 1) sur un dummy Ronflex (snorlax) adjacent. Dummy ENDURANT (`dummyHp: 999`) →
 *  survit à plusieurs coups, donc on lit plusieurs lignes « Ronflex perd N PV » comparables ; et le
 *  dummy est d'une espèce DIFFÉRENTE du lanceur pour que ses lignes de dégâts soient filtrables par
 *  nom (le lanceur perdant des PV → « Florizarre perd … » est ainsi exclu du compte). Le dummy reste
 *  inerte (`dummyMove: "leer"`, Groz'Yeux, aucun dégât) pour ne jamais polluer le journal. Griffe à
 *  100 % touche sous tout seed → pas de raté qui réinitialiserait la série. À chaque usage consécutif
 *  réussi du MÊME move, la série monte d'un cran (+10 % de dégâts) → les coups successifs croissent. */
export const METRONOME_BOOST = {
  ...DUEL,
  heldItem: "metronome",
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

/** Témoin du Métronome : MÊME config/seed mais SANS l'objet → les Griffe consécutives ne montent PAS
 *  en dégâts (la série n'augmente rien sans l'objet). Comparé à {@link METRONOME_BOOST}, prouve que la
 *  croissance des dégâts vient bien de l'objet (et non d'un effet de bord de tour ou du seed). */
export const METRONOME_BASELINE_NO_ITEM = {
  ...DUEL,
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

// Objets « eject » (plan 142) — téléportation forcée vers la zone de spawn quand le porteur encaisse
// un coup de dégâts. Carton Rouge renvoie l'ATTAQUANT chez lui ; il est donc le SEUL des deux à être
// pilotable de bout en bout côté joueur (le joueur est l'attaquant). Bouton Fuite renvoie le PORTEUR
// chez lui, ce qui n'est observable que si le porteur s'est d'abord éloigné de son spawn ET reçoit un
// coup : en sandbox 1v1 le seul attaquant fiable est le joueur, et le porteur (le dummy) ne peut être
// frappé par le joueur QUE depuis sa case de spawn (il n'a pas bougé) → l'eject ramène alors le
// porteur sur sa propre case (no-op, non journalisé). Bouton Fuite reste donc couvert unit/integration
// core (`forced-teleport.test.ts`, `items/eject-items.test.ts`) et marqué 👁 dans le cahier.

/** Carton Rouge (red-card) : quand le porteur encaisse un coup, l'ATTAQUANT est renvoyé sur sa propre
 *  zone de spawn, puis l'objet du porteur est consommé. Le joueur Florizarre démarre sur sa case de
 *  spawn (2,4), face nord, et lance Vive-Attaque (`quick-attack`, Dash 2, 100 % précision → touche
 *  sous tout seed) sur le dummy Ronflex (snorlax) porteur du Carton Rouge en (2,2). Le dash éloigne le
 *  joueur de son spawn — il atterrit en (2,3), adjacent au dummy — puis le coup déclenche le Carton
 *  Rouge : l'attaquant (le joueur) est téléporté sur sa case de spawn libérée (2,4). Le dummy est
 *  endurant (`dummyHp: 999`) pour survivre au coup. Observable de bout en bout via le journal :
 *  « Carton Rouge de <X> s'active ! » + « <le Florizarre> se téléporte ! » + « <X> a utilisé son
 *  Carton Rouge ». Dash piloté par la DIRECTION (axe nord), 100 % précision → déterministe. */
export const RED_CARD_EJECTS_ATTACKER = {
  ...DUEL,
  moves: ["quick-attack"],
  playerPosition: { x: 2, y: 4 },
  playerDirection: "north",
  dummyPokemon: "snorlax",
  dummyPosition: { x: 2, y: 2 },
  dummyHeldItem: "red-card",
  dummyHp: 999,
} as const;
// Item interaction (plan 142) — manipulation de l'objet tenu, pilotée de bout en bout via le journal
// FR + la ligne objet de l'InfoPanel (`info-panel-item`, « 🎒 {nom} »). Tous déterministes : moves
// 100 % précision sur cible adjacente (DUEL) → aucun jet (seed DUEL hérité, sauf besoin précis).

/** Sabotage (`knock-off`) — le joueur Florizarre lance Sabotage (Single 1-1) sur le dummy porteur
 *  des Restes (`dummyHeldItem`) adjacent → l'objet est retiré : « <X> perd son Restes ! » + dégâts.
 *  Le ×1.5 si la cible porte un objet retirable est silencieux (valeur couverte unit) → on assert le
 *  RETRAIT (la ligne de journal), pas le multiplicateur. Move 100 % précision → cast déterministe. */
export const KNOCK_OFF_REMOVES_ITEM = {
  ...DUEL,
  moves: ["knock-off"],
  dummyHeldItem: "leftovers",
} as const;

/** Larcin (`thief`) — vol si le lanceur a les mains vides (D2). Le joueur (SANS objet : `heldItem`
 *  omis) lance Larcin sur le dummy porteur des Restes (`dummyHeldItem`) adjacent → « <X> vole le
 *  Restes de <Y> ! », puis l'InfoPanel du LANCEUR montre « 🎒 Restes » (objet désormais tenu). Move
 *  100 % précision → cast déterministe. */
export const THIEF_STEALS_ITEM = {
  ...DUEL,
  moves: ["thief"],
  dummyHeldItem: "leftovers",
} as const;

/** Tour de Magie (`trick`) — échange inconditionnel des objets tenus (D3). Le joueur tient le Bandeau
 *  Choix (`heldItem`), le dummy tient les Restes (`dummyHeldItem`) ; Tour de Magie (Single 1-3) sur le
 *  dummy adjacent → « <X> échange son objet avec <Y> ! ». Après l'échange l'InfoPanel du lanceur montre
 *  « 🎒 Restes » (il a récupéré l'objet du dummy). Move statut 100 % précision → cast déterministe. */
export const TRICK_SWAPS_ITEMS = {
  ...DUEL,
  moves: ["trick"],
  heldItem: "choice-band",
  dummyHeldItem: "leftovers",
} as const;

/** Dégommage (`fling`) — lance l'objet tenu ; l'Orbe Flamme (`flame-orb`, fling power 30) inflige la
 *  Brûlure à la cible (table `FLING_EFFECT`, D6). Le joueur tient l'Orbe Flamme (`heldItem`) et lance
 *  Dégommage (Single 1-3) sur le dummy endurant (hp 999 → survit pour qu'on observe le STATUT et non un
 *  K.O.) adjacent → « <X> dégomme son Orbe Flamme ! » + « <Y> est brûlé ! ». On caste au TOUR 1 (avant
 *  toute fin de tour) pour que l'Orbe parte AVANT de brûler son propre porteur. Move 100 % → déterministe. */
export const FLING_FLAME_ORB_BURNS = {
  ...DUEL,
  moves: ["fling"],
  heldItem: "flame-orb",
  dummyHp: 999,
} as const;

/** Recyclage (`recycle`) — restaure le dernier objet consommé par son propre effet (D1). Le joueur
 *  Ronflex tient une Baie Lichii (`liechi-berry`, pincement ≤25 % PV) et démarre à 20 % PV : « Attendre »
 *  → fin de tour → la baie se mange (pose `consumedItemId`) → « Baie Lichii … s'active ! » + « a utilisé
 *  son Baie Lichii ». Au tour suivant, Recyclage (Self) restaure l'objet → « <X> recycle son Baie Lichii ! »
 *  et l'InfoPanel re-montre « 🎒 Baie Lichii ». Aucun jet (hook baie inconditionnel en pincement) →
 *  déterministe. Ronflex (snorlax) = porteur Gen-1 endurant (survit à la fin de tour à 20 % PV). */
export const RECYCLE_RESTORES_BERRY = {
  ...DUEL,
  pokemon: "snorlax",
  moves: ["recycle"],
  heldItem: "liechi-berry",
  hp: 20,
} as const;

/** Éructation (`belch`) — injouable tant qu'aucune baie n'a été mangée (D7, `requiresEatenBerry`). Le
 *  joueur Ronflex tient une Baie Lichii et démarre à 20 % PV : « Attendre » → fin de tour → la baie se
 *  mange (pose `ateBerryThisBattle`). Au tour suivant, Éructation devient légale et résout sur le dummy
 *  endurant (hp 999, survit → on observe les dégâts et non un K.O.) → « <Y> perd N PV ». Éructation est le
 *  SEUL move : au tour 1 il est filtré (baie pas encore mangée), au tour 2 il est castable. Move 90 %
 *  précision → seed fixe (DUEL) pour un toucher reproductible. */
export const BELCH_AFTER_BERRY = {
  ...DUEL,
  pokemon: "snorlax",
  moves: ["belch"],
  heldItem: "liechi-berry",
  hp: 20,
  dummyHp: 999,
} as const;

// Famille Pièges (trapping) — un piège PARTIEL (dégâts + Piégé 4-5 tours + 1/8 PV par tour +
// immobilisation) et un piège PUR (verrou position-linked sans dégâts, libéré quand le lanceur
// s'éloigne). Déterministes : moves 100 % précision sur cible adjacente (DUEL hérité), aucun jet.

/** Danse Flammes (`fire-spin`, piège partiel, portée 1-2) — le joueur Florizarre lance Danse Flammes
 *  sur le dummy Ronflex (snorlax, espèce DIFFÉRENTE → lignes de dégâts filtrables par nom) adjacent
 *  endurant (`dummyHp: 999` → survit au coup ET aux ticks, donc on observe le piège et non un K.O.).
 *  Le dummy reste inerte (`dummyMove: "leer"`, Groz'Yeux, aucun dégât) pour ne jamais polluer le
 *  journal. Le cast journalise « Ronflex est piégé ! » ; chaque fin de tour applique le chip 1/8 →
 *  « Ronflex perd N PV ! ». Danse Flammes est à 85 % de précision : le joueur porte Aucun Garde
 *  (`no-guard`) → précision forcée à 100 %, le coup touche sous TOUT seed (sinon un raté empêcherait
 *  le piège de se poser) → déterministe (seed DUEL hérité). */
export const TRAP_PARTIAL_FIRE_SPIN = {
  ...DUEL,
  moves: ["fire-spin"],
  playerAbility: "no-guard",
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

/** Barrage (`block`, piège PUR position-linked, portée 1) — le joueur Florizarre lance Barrage sur le
 *  dummy Ronflex (snorlax) adjacent : aucun dégât, juste le verrou → « Ronflex est piégé ! ». Le
 *  verrou tient tant que le lanceur reste adjacent (chebyshev ≤1) ; dès qu'il s'éloigne il se rompt →
 *  « Ronflex est libéré du piège ». Le joueur démarre en (2,3), le dummy en (2,2) ; après le cast le
 *  joueur se DÉPLACE vers (2,5) (distance 3 du dummy) → la rupture est journalisée. Move statut sans
 *  jet de précision → cast déterministe. */
export const TRAP_PURE_BLOCK = {
  ...DUEL,
  moves: ["block"],
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

/** Talent Glu (`sticky-hold`, D12) — bloque tout retrait/vol/échange d'objet du porteur. Le joueur
 *  Florizarre lance Sabotage (`knock-off`) sur le dummy Grotadmorv (muk, slot Glu via `dummyAbility`)
 *  porteur des Restes (`dummyHeldItem`) adjacent → le retrait est bloqué : « Glu de <X> s'active ! »
 *  apparaît et « perd son Restes » N'apparaît PAS (l'objet reste). Les dégâts de Sabotage frappent
 *  normalement. Move 100 % précision → cast déterministe. */
export const STICKY_HOLD_BLOCKS_REMOVAL = {
  ...DUEL,
  moves: ["knock-off"],
  dummyPokemon: "muk",
  dummyAbility: "sticky-hold",
  dummyHeldItem: "leftovers",
} as const;

// Famille Type manip (plan 143) — moves qui réécrivent le type d'un Pokemon. Le signal le plus net
// est Détrempage (`soak`) : cible ennemie r1 → Eau pur. Deux feedbacks observables convergent : la
// ligne de journal FR (« <X> devient de type Eau ! ») et le badge volatile « Type Eau » de
// l'InfoPanel (au survol de la cible). Les autres moves de la famille (Conversion, Conversion 2,
// Copie-Type, Flamme Ultime) dépendent d'un historique de move (1er move du lanceur / dernier move
// ennemi) ou d'un type de lanceur précis → setup moins net en sandbox 1v1, couverts unit core.

/** Détrempage (`soak`, type manip, portée 1-1) — le joueur Florizarre lance Détrempage sur le dummy
 *  Ronflex (snorlax, Normal pur → le changement vers Eau est sans ambiguïté ; espèce DIFFÉRENTE du
 *  lanceur → nom filtrable au journal/survol). Le dummy reste inerte (`dummyMove: "leer"`, Groz'Yeux)
 *  et endurant (`dummyHp: 999`) pour ne pas polluer le journal ni mourir. Détrempage est un move
 *  STATUT à 100 % de précision → aucun jet, cast déterministe (seed DUEL hérité). Move hors-pool
 *  forcé via `moves` (SandboxSetup écrase `moveIds` sans regarder le learnset). Après le cast :
 *  journal « Ronflex devient de type Eau ! » + au survol de la case du dummy l'InfoPanel monte le
 *  badge volatile « Type Eau » (typeOverride). */
export const TYPE_MANIP_SOAK = {
  ...DUEL,
  moves: ["soak"],
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

// Famille Move-copy (plan 144) — moves qui APPELLENT ou COPIENT un autre move résolu au runtime. Deux
// signaux observables nets et déterministes (sans dépendre d'un golden pixel) : (1) Copie (`mimic`)
// REMPLACE son slot par le dernier move de la cible → ligne de journal FR « <X> apprend <Y> ! » (event
// MoveCopied) ET le menu d'attaque montre désormais le move copié à la place de Copie ; (2) Métronome
// (`metronome`) TIRE un move aléatoire (PRNG seedé) qui s'exécute via l'orchestrateur → ligne de journal
// FR « <X> utilise <Y> ! » (MoveStarted du move appelé, Y ≠ Métronome). Les autres (Blabla Dodo gate
// sommeil, Mimique/Photocopie sur historique de move, Gribouille ≡ Copie) = unit core + cahier 👁.

/** Copie (`mimic`, portée 1-3, EffectKind.CopyMoveToSlot) — le joueur Alakazam (très rapide → agit en
 *  premier) attend un tour pour laisser le dummy Ronflex (snorlax, espèce ≠ lanceur → nom filtrable)
 *  jouer son `dummyMove` Plaquage (`body-slam`, dans le movepool d'espèce de Ronflex → l'IA le trouve
 *  dans ses actions légales et le joue, posant `lastUsedMoveId="body-slam"` sur le dummy). ⚠️ En mode
 *  `dummyControl: "ai"` le moveset du dummy reste son movepool d'espèce (non écrasé) → le `dummyMove`
 *  DOIT être un move appris par Ronflex, sinon l'IA ne trouve aucune action légale et ne joue rien.
 *  Au tour suivant, le joueur lance Copie sur le dummy adjacent : déterministe (statut 100 % précision,
 *  aucun jet) → le slot Copie devient Plaquage. Deux feedbacks convergent : journal « Alakazam apprend
 *  Plaquage ! » (event MoveCopied) + le sous-menu d'attaque liste désormais « Plaquage » à la place de
 *  « Copie ». `hp: 999` / `dummyHp: 999` → les deux survivent au Plaquage + au DOT du marécage. */
export const MOVE_COPY_MIMIC = {
  ...DUEL,
  pokemon: "alakazam",
  moves: ["mimic"],
  hp: 999,
  dummyPokemon: "snorlax",
  dummyControl: "ai",
  dummyMove: "body-slam",
  dummyHp: 999,
} as const;

/** Métronome (`metronome`, callMove RandomAll) — le joueur Alakazam tire un move au hasard via le PRNG
 *  seedé (seed DUEL=12345), puis le place sur le dummy Ronflex adjacent (snorlax, endurant `dummyHp: 999`,
 *  inerte `dummyMove: "leer"` Groz'Yeux). Le move appelé s'exécute via l'orchestrateur et émet son propre
 *  MoveStarted → le journal montre « Alakazam utilise <move tiré> ! » (≠ Métronome). On asserte le SENS
 *  (un move a bien été appelé et a démarré), pas l'identité exacte du move tiré (dépend du roster). */
export const MOVE_COPY_METRONOME = {
  ...DUEL,
  pokemon: "alakazam",
  moves: ["metronome"],
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHp: 999,
} as const;
