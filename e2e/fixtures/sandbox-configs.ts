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

/** Objet tenu affiché avec son icône officielle dans l'InfoPanel (plan 168, cahier §4.7). Le joueur
 *  Florizarre tient les Restes (`heldItem`), le dummy Dracaufeu tient l'Orbe Vie (`dummyHeldItem`) →
 *  au boot le panneau de l'actif montre « Restes » + icône ; au survol du dummy, « Orbe Vie » + icône.
 *  DUEL sans `heldItem` sert de témoin « sans objet » (ligne masquée). Aucun jet → déterministe. */
export const HELD_ITEM_ICONS = {
  ...DUEL,
  heldItem: "leftovers",
  dummyPokemon: "charizard",
  dummyHeldItem: "life-orb",
} as const;

/** Player starts poisoned → the HUD must mount a status icon (test-plan §3.4). Seeded
 *  (via DUEL) so the sandbox stays deterministic — a config without a seed now boots random. */
export const POISONED = { ...DUEL, status: "poisoned" } as const;

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

// Objets légers content-fill (plan 158) — deux facettes observables via le journal FR ; les 9 autres
// objets du lot sont silencieux (marqueurs de poids/vitesse, crit-stage, immunité de secondaire déjà
// couverte par Cape Obscure §5.14…) → couverts unit (`battle/items/content-fill-158.test.ts`) → 👁.

/** Carapace Mue (`shed-shell`) — le porteur est IMMUNISÉ au piège (hook `immuneToTrapping`). Le joueur
 *  Florizarre lance Étreinte (`bind`, piège partiel, portée 1) sur le dummy Ronflex (snorlax, espèce
 *  distincte → lignes filtrables par nom) porteur de la Carapace Mue (`dummyHeldItem`) adjacent : le
 *  statut Piégé N'EST PAS posé → « L'objet de Ronflex le protège ! » (StatusBlocked reason HeldItem) et
 *  AUCUNE ligne « Ronflex est piégé ! ». Étreinte est à 85 % de précision : le joueur porte Aucun Garde
 *  (`no-guard`) → précision forcée à 100 %, le coup touche sous TOUT seed (même parti-pris déterministe
 *  que TRAP_PARTIAL_FIRE_SPIN — un raté empêcherait le blocage d'être observé). Dummy endurant
 *  (`dummyHp: 999`) → survit aux dégâts d'Étreinte, et inerte (`dummyMove: "leer"`) → ne pollue pas le
 *  journal. */
export const SHED_SHELL_TRAP_IMMUNE = {
  ...DUEL,
  moves: ["bind"],
  playerAbility: "no-guard",
  dummyPokemon: "snorlax",
  dummyHeldItem: "shed-shell",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

/** Dé Pipé (`loaded-dice`) — force un move à frappes variables à son MAXIMUM de coups (hook
 *  `maximizesMultiHit`), comme Multi-Coups mais via l'objet. Le joueur Florizarre TIENT le Dé Pipé
 *  (`heldItem`) et lance Balle Graine (`bullet-seed`, 2-5 coups, 100 % précision, force-pool via
 *  `moves`) sur le dummy adjacent endurant (`dummyHp: 999`, survit aux 5 coups) → le récap journal lit
 *  « Touché 5 fois ! » quel que soit le seed (l'objet court-circuite le tirage du nombre de coups). */
export const LOADED_DICE_MAX_HITS = {
  ...DUEL,
  moves: ["bullet-seed"],
  heldItem: "loaded-dice",
  dummyHp: 999,
} as const;

/** Orbe Vie (`life-orb`) — recul 1/10 PV max au PORTEUR, UNE SEULE FOIS par attaque, même sur un move
 *  multi-coups (fix : le hook attaquant `onAfterMoveDamageDealt` est appelé une fois en fin de
 *  `handleDamage` sur le TOTAL des dégâts, plus par coup). Le joueur Florizarre tient l'Orbe Vie
 *  (`heldItem`) et lance Balle Graine (`bullet-seed`, 2-5 coups, 100 % précision, force-pool via
 *  `moves`) sur le dummy adjacent endurant (`dummyHp: 999`, survit à la volée) → l'Orbe s'annonce
 *  EXACTEMENT UNE fois : « Orbe Vie de <X> s'active ! » à `toHaveCount(1)` quel que soit le nombre de
 *  coups. Le seed hérité de DUEL + précision 100 % rendent le cast déterministe ; Florizarre survit au
 *  recul unique. (À distinguer du Casque Brut, canon recoil PAR coup — cf mechanics-items.spec.) */
export const LIFE_ORB_MULTI_HIT_RECOIL = {
  ...DUEL,
  moves: ["bullet-seed"],
  heldItem: "life-orb",
  dummyHp: 999,
} as const;

/** Coup fantôme / Casque Brut (`rocky-helmet`) — RÉGRESSION du recul de contact PAR coup sur un move
 *  multi-coups. Contrairement à l'Orbe Vie (recul UNE fois pour tout le move), le Casque Brut riposte
 *  à CHAQUE coup de contact reçu (1/6 PV max de l'attaquant, canon). Un attaquant à très bas PV qui
 *  lance un move multi-coups sur un porteur de Casque tombe donc K.O. dès le coup 1 — et avant le fix,
 *  la boucle multi-coups continuait au coup 2 (« un mort frappait encore »). Le fix ajoute
 *  `if attacker.currentHp <= 0 break` en tête de boucle (handle-damage) → la volée s'arrête au K.O. de
 *  l'attaquant. Le joueur Florizarre (venusaur, `hp: 1` = 1 % PV max → le recul du Casque le K.O. dès
 *  le 1er coup) lance Double Pied (`double-kick`, 2 coups FIXES, contact, 100 % précision) sur le dummy
 *  Ronflex (snorlax, espèce distincte → nom filtrable ; endurant, survit à un seul coup) porteur du
 *  Casque Brut adjacent. Observable de bout en bout via le journal : « Florizarre est K.O. ! » (recul
 *  mortel du 1er coup) + le récap multi-coups « Touché 1 fois ! » (et JAMAIS « Touché 2 fois ! » — la
 *  signature du bug). Le récap encode EXACTEMENT le nombre de coups → signal contamination-proof
 *  (immunisé des ticks de terrain de fin de tour, contrairement au comptage de « perd N PV »). Double
 *  Pied 100 % précision → touche sous tout seed (DUEL hérité). Dummy inerte (`dummyMove: "leer"`), à
 *  pleins PV (`dummyHp: 999`). Le montant chiffré et le fire-once sont couverts integration core
 *  (`held-items.integration.test.ts` : « pas de coup fantôme »). */
export const PHANTOM_HIT_ROCKY_HELMET = {
  ...DUEL,
  moves: ["double-kick"],
  hp: 1,
  dummyPokemon: "snorlax",
  dummyMove: "leer",
  dummyHeldItem: "rocky-helmet",
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

// Famille Field global (plan 145) — 3 zones diamant r3 posées via un move Self (Gravité / Zone
// Étrange / Zone Magique, TargetingKind.Self → cast sur sa propre case, exactement comme Distorsion)
// + Vent Arrière (vent directionnel global : GroundTarget portée 1, la case cardinale ciblée donne
// la direction). Tous des moves STATUT sans jet de précision → cast déterministe (seed DUEL hérité).
// L'e2e prouve le SENS observable : zone posée (journal FR + quad de scène par kind), vent levé
// (journal FR + HUD flèche), move aérien verrouillé sous Gravité (menu `data-enabled="false"`). Les
// effets NUMÉRIQUES profonds (clouage des Volants + précision ×5/3, swap Déf/DéfSpé, neutralisation
// d'objet, ctGain ×1.5 des mons alignés au vent) sont couverts unit/integration core
// (`moves/{gravity,wonder-room,magic-room,tailwind}.test.ts`) et marqués 👁 au cahier §5.29.

/** Gravité (`gravity`, Self) — le joueur Florizarre pose la zone diamant sur sa propre case (2,3). */
export const FIELD_GLOBAL_GRAVITY = { ...DUEL, moves: ["gravity"] } as const;

/** Zone Étrange (`wonder-room`, Self) — même pose Self, épicentre (2,3). */
export const FIELD_GLOBAL_WONDER_ROOM = { ...DUEL, moves: ["wonder-room"] } as const;

/** Zone Magique (`magic-room`, Self) — même pose Self, épicentre (2,3). */
export const FIELD_GLOBAL_MAGIC_ROOM = { ...DUEL, moves: ["magic-room"] } as const;

/** Vent Arrière (`tailwind`, GroundTarget portée 1) — le dummy est écarté en (4,4) pour libérer la
 *  case cardinale nord (2,2) ; `castFirstMove(2,2)` vise cette case → direction Nord (de (2,3) vers
 *  (2,2)). La pose journalise « … lève le Vent Arrière vers le Nord (5 tours) » et monte le HUD flèche
 *  (`tailwind-hud`, libellé « Vent Arrière »). Move statut sans jet → cast déterministe. */
export const TAILWIND_NORTH = {
  ...DUEL,
  moves: ["tailwind"],
  playerPosition: { x: 2, y: 3 },
  dummyPosition: { x: 4, y: 4 },
} as const;

/** Gravité verrouille les moves aériens — le joueur a deux moves : Gravité (Self) puis Pied Voltige
 *  (`high-jump-kick`, Single portée 1, tagué `disabledUnderGravity`). Le dummy Ronflex reste adjacent
 *  en (2,2) (défaut DUEL) → Pied Voltige a une cible légale tant que la Gravité n'est pas posée. Le
 *  test pose Gravité au tour 1 (le lanceur se retrouve DANS sa propre zone), laisse l'IA jouer un tour
 *  inerte, puis au tour SUIVANT du lanceur rouvre le menu Attaque : Pied Voltige est filtré des actions
 *  légales (`getLegalActions`) → sa ligne porte `data-enabled="false"` (même convention que la Veste de
 *  Combat, §5.16). Le témoin (même config, Gravité NON posée) montre Pied Voltige `data-enabled="true"`
 *  → prouve que c'est la Gravité qui verrouille, et non une portée manquante. Le dummy est en `ai` avec
 *  Groz'Yeux (`leer`, sans dégât) + `dummyHp`/`hp` à 999 pour que le lanceur revienne jouer sans être
 *  KO ni KO'er (le combat doit rester ouvert). Moves statut/mêlée → aucun jet, déterministe. */
export const GRAVITY_BLOCKS_AERIAL = {
  ...DUEL,
  moves: ["gravity", "high-jump-kick"],
  hp: 999,
  dummyPokemon: "snorlax",
  dummyControl: "ai",
  dummyMove: "leer",
  dummyHp: 999,
} as const;

/** Famille K.O. en un coup (OHKO, plan 148) — Guillotine (`guillotine`, Normal, Single 1-1 contact)
 *  hors-pool forcée. Précision 30 % PLATE → `seed: 0` fait toucher (déterministe, jamais d'override
 *  `Math.random`). Le dummy Normal (défaut) n'a aucune immunité de type → sur touche, dégâts = PV max
 *  → K.O. instantané → journal « C'est un K.O. direct ! » (event OneHitKo) puis fin de combat (seul
 *  adversaire). Griffe (portée 1) atteint toujours le dummy adjacent en (2,2). */
export const OHKO_GUILLOTINE = {
  ...DUEL,
  seed: 0,
  moves: ["guillotine"],
} as const;

/** Immunité Fermeté (`sturdy`) contre l'OHKO — même Guillotine seedée à toucher, mais le dummy porte
 *  Fermeté et démarre à PLEINS PV (défaut 100) : l'attaque qui devrait le K.O. le laisse à 1 PV. Le
 *  journal lit « Fermeté de <dummy> s'active ! » (event AbilityActivated), PAS « raté » ni « K.O.
 *  direct » — le combat reste ouvert (aucune modale de victoire). */
export const OHKO_STURDY = {
  ...OHKO_GUILLOTINE,
  dummyAbility: "sturdy",
} as const;

// Famille Priorité / timing conditionnel (plan 150) — moves dont l'identité repose sur le TIMING
// (1ʳᵉ action du combat, fraîcheur de la dernière action de la cible, charge interruptible) plutôt
// que sur une priorité canon (inexistante ici : le CT ordonne, un coût dérivé de la puissance →
// Bluff léger agit tôt, Mitra-Poing/Bec-Canon/Carapiège lourds agissent tard). Contrairement aux
// autres configs, celles-ci NE fixent PAS playerPosition/dummyPosition : on part des SPAWNS PAR
// DÉFAUT de sandbox-flat (joueur (1,4) / dummy (1,1), 3 cases d'écart) et chaque scénario PILOTE
// d'abord un déplacement du joueur vers (1,2) — adjacent au dummy (1,1) — avant de lancer un move
// Single 1-1 / Zone r1. Le pas n'ouvre PAS l'horloge d'action (`lastActedAtAction` n'est stampé qu'à
// la FIN du tour), donc Bluff/Escarmouche restent bien « 1ʳᵉ action » après s'être approchés. Tous
// les moves à 100 % de précision → cast déterministe (seed hérité, aucun jet). Le tempo LOURD des
// moves de charge (BP 120-150 → coût CT élevé) garantit que le dummy agit DANS la fenêtre de charge
// (avant la frappe T2 du joueur), ce qui rend les interruptions/ripostes déterministes.

/** Bluff (`fake-out`, firstActionOnly + Flinch 100 %). Kangaskhan (spe 90) s'approche puis lance
 *  Bluff sur le dummy inerte adjacent → dégâts + apeurement ; au tour suivant du dummy le moteur
 *  émet Flinched (« … est apeuré et ne peut pas agir ! »). Deuxième move (Griffe) pour que le menu du
 *  tour 2 ne soit pas vide et qu'on prouve que Bluff en est FILTRÉ (firstActionOnly, déjà agi). */
export const PRIORITY_FAKE_OUT = {
  seed: 12345,
  pokemon: "kangaskhan",
  moves: ["fake-out", "scratch"],
} as const;

/** Escarmouche (`first-impression`, firstActionOnly SANS flinch). Kangaskhan s'approche puis lance
 *  Escarmouche sur le dummy inerte adjacent → dégâts (pas d'apeurement) ; au tour 2, Escarmouche est
 *  filtré du menu (comme Bluff) mais Griffe reste jouable. Variante flinchless du même verrou
 *  « 1ʳᵉ action ». */
export const PRIORITY_FIRST_IMPRESSION = {
  seed: 12345,
  pokemon: "kangaskhan",
  moves: ["first-impression", "scratch"],
} as const;

/** Coup Bas — CAS RÉUSSITE (`sucker-punch`, failsUnlessTargetAggressive). Le dummy Ronflex (snorlax)
 *  est en HOT-SEAT (`dummyControl: "player"`, `dummyMoves: ["tackle"]` — Charge, move physique de
 *  contact SANS effet secondaire, pilotable directement en mode joueur sans dépendre du movepool ni
 *  risquer une paralysie qui décalerait les tours). Persian (spe 115 > 30) agit en 1er : il s'approche
 *  puis TEMPORISE (Attendre) ; le dummy attaque alors avec Charge (sa DERNIÈRE action est offensive) ;
 *  au tour suivant Persian lance Coup Bas → la fraîcheur est satisfaite (`lastOffensiveActionAtAction
 *  === lastActedAtAction`) → le coup TOUCHE (« Ronflex perd N PV »). */
export const PRIORITY_SUCKER_HIT = {
  seed: 12345,
  pokemon: "persian",
  moves: ["sucker-punch"],
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
} as const;

/** Coup Bas — CAS ÉCHEC (`sucker-punch`). Même Persian rapide (agit en 1er) contre un dummy Ronflex
 *  INERTE (IA sans move assigné → ne fait que temporiser). Persian s'approche puis lance Coup Bas AU
 *  1ᵉ TOUR, avant que le dummy ait agi (`lastActedAtAction === undefined`) → la cible n'est pas
 *  offensive → le coup FIZZLE (« Mais cela échoue … ! », 0 dégât, CT payé). L'anti-collant « a attaqué
 *  puis temporisé » (freshness fine) est couvert unit/integration core. */
export const PRIORITY_SUCKER_FIZZLE = {
  seed: 12345,
  pokemon: "persian",
  moves: ["sucker-punch"],
  dummyPokemon: "snorlax",
} as const;

/** Mitra-Poing — CHARGE tour 1 (`focus-punch`, twoTurnCharge + chargeReaction focus). Machamp
 *  (Mackogneur) s'approche puis lance Mitra-Poing sur le dummy inerte adjacent → tour de charge :
 *  journal « … concentre son énergie pour Mitra-Poing ! » (MoveCharging). L'indicateur ⚡ reste 👁. */
export const PRIORITY_FOCUS_CHARGE = {
  seed: 12345,
  pokemon: "machamp",
  moves: ["focus-punch"],
} as const;

/** Mitra-Poing — INTERRUPTION (`focus-punch`). Alakazam s'approche puis charge Mitra-Poing ; le dummy
 *  Ronflex en HOT-SEAT (`dummyMoves: ["tackle"]` — Charge, physique de contact sans secondaire) le
 *  FRAPPE pendant la charge → journal « … est frappé pendant sa concentration ! » (FocusInterrupted)
 *  et `focusInterrupted` posé. Au tour 2, Alakazam frappe : concentration brisée → échec « … perd sa
 *  concentration ! » (MoveFailed reason focus, 0 dégât, CT payé). Alakazam (spe 120, très rapide) est
 *  choisi à dessein : le tempo lourd de Mitra-Poing (150 BP) le fait rejouer tard, mais sa vitesse
 *  limite l'écart à UN seul tour adverse intercalé entre la charge et la frappe — le lien
 *  interruption→échec est le plus net avec un seul tour intercalé (comme le harness unit). */
export const PRIORITY_FOCUS_INTERRUPT = {
  seed: 12345,
  pokemon: "alakazam",
  moves: ["focus-punch"],
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
} as const;

/** Bec-Canon (`beak-blast`, twoTurnCharge + chargeReaction beak). Roucarnage (pidgeot) s'approche
 *  puis charge Bec-Canon ; le dummy Ronflex en HOT-SEAT le FRAPPE avec Charge (move de CONTACT)
 *  pendant la charge → l'attaquant se brûle sur le bec brûlant : journal « Ronflex se brûle sur le bec
 *  brûlant ! » (BeakBlastBurn). La charge n'est PAS interrompue (Bec-Canon frappe quand même au tour
 *  2, non asserté ici — l'observable net est la brûlure de contact). Ronflex (Normal) est brûlable. */
export const PRIORITY_BEAK_BURN = {
  seed: 12345,
  pokemon: "pidgeot",
  moves: ["beak-blast"],
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
} as const;

/** Carapiège (`shell-trap`, twoTurnCharge + chargeReaction shell, Zone r1 centrée lanceur). Dracaufeu
 *  (charizard) s'approche puis charge Carapiège ; le dummy Ronflex en HOT-SEAT le FRAPPE avec Charge
 *  (move PHYSIQUE) pendant la charge → le piège s'arme : journal « Le piège de Dracaufeu s'arme ! »
 *  (ShellTrapArmed). L'armement conditionnel est l'observable net (la frappe T2 armée n'est pas
 *  assertée ici). Sans coup physique le piège n'aurait pas été armé (couvert unit/integration core). */
export const PRIORITY_SHELL_ARMED = {
  seed: 12345,
  pokemon: "charizard",
  moves: ["shell-trap"],
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
} as const;

// Misc Batch A : manipulation de coups critiques (plan 151) — moves dont l'identité repose sur les
// coups critiques (booster le taux, garantir un crit). On pilote chaque move de bout en bout et on
// assert la ligne de journal FR + le badge volatile de l'InfoPanel (le SENS lisible), pas le pixel.
// Duel adjacent standard (joueur Florizarre (2,3) / dummy Normal inerte (2,2), Griffe portée 1) ;
// tous les moves testés sont 100 % précision → cast déterministe (seed hérité, aucun jet).

/** Puissance (`focus-energy`, Self, RaiseCritStage +2 persistant). Florizarre lance Puissance sur sa
 *  propre case → journal « … est plus enclin aux coups critiques ! » (CritStageRaised) + badge
 *  volatile « Puissance +2 » de l'InfoPanel (`critStageBoost > 0` → `infoPanel.volatile.focusEnergy`). */
export const CRIT_FOCUS_ENERGY = {
  ...DUEL,
  moves: ["focus-energy"],
} as const;

/** Affilage (`laser-focus`, Self, ArmGuaranteedCrit one-shot). Hors-pool Gen 1 → piloté en sandbox.
 *  Florizarre lance Affilage (self) → journal « … se concentre : son prochain coup sera critique ! »
 *  (GuaranteedCritArmed) + badge volatile « Affilage » (`guaranteedCritArmed` →
 *  `infoPanel.volatile.laserFocus`). Deuxième move Griffe (`scratch`, 100 %) pour PROUVER que le coup
 *  suivant est forcé critique : une action ne se cumule pas dans un tour → on arme au tour 1, on
 *  termine le tour (le dummy inerte temporise), puis Griffe au tour 2 → « Coup critique sur … ! ». */
export const CRIT_LASER_FOCUS = {
  ...DUEL,
  moves: ["laser-focus", "scratch"],
} as const;

/** Yama Arashi (`storm-throw`, Combat Phys contact Single 1-1, `alwaysCrit`). Hors-pool Gen 1 →
 *  piloté en sandbox. Florizarre frappe le dummy Normal adjacent → crit garanti → journal « Coup
 *  critique sur … ! » (CriticalHit) à chaque coup, indépendamment du seed (Combat ×2 sur Normal, le
 *  dummy survit à ses 100 PV). */
export const CRIT_STORM_THROW = {
  ...DUEL,
  moves: ["storm-throw"],
} as const;

// Misc Batch B : dégâts utilitaires (plan 152) — moves dont l'identité est un CALCUL de dégâts
// particulier (plafonné, fixe, conditionnel au positionnement) plutôt qu'un effet secondaire. On
// pilote chaque move de bout en bout et on assert la ligne de journal FR + le flottant / badge
// InfoPanel (le SENS lisible), pas le pixel. Duel adjacent standard (Florizarre (2,3) / dummy (2,2)) ;
// seed hérité, aucun override `Math.random`.

/** Faux-Chage (`false-swipe`, Normal Phys 40 contact, `cannotKo`). Le dummy Normal démarre bas (5 %
 *  PV, ≈ quelques PV) : Faux-Chage l'écrèterait au K.O. mais le cap le laisse à EXACTEMENT 1 PV —
 *  aucun K.O., aucune modale de victoire. 100 % précision → touche déterministe (seed hérité). */
export const FALSE_SWIPE = {
  ...DUEL,
  moves: ["false-swipe"],
  dummyHp: 5,
} as const;

/** Croc Fatal (`super-fang`, Normal Phys, `HalveTargetHp`). Le dummy Normal plein perd ⌊PV/2⌋ d'un
 *  coup → journal « … perd la moitié de ses PV (-N) ! » (SuperFangApplied) + flottant `-N`. Précision
 *  90 % → `seed: 1` fait toucher (le seed hérité 12345 raterait — déterministe, jamais d'override
 *  `Math.random`). */
export const SUPER_FANG = {
  ...DUEL,
  seed: 1,
  moves: ["super-fang"],
} as const;

/** Ruse (`feint`, Normal Phys 30, `bypassProtect`). Le dummy « dummy » (movepool protect/detect,
 *  Vit. 50) est plus RAPIDE que le joueur Ronflex (Vit. 30) et joue en 1er : il se protège (Abri,
 *  `dummyMove: "protect"`) ; puis Ronflex lance Ruse → touche À TRAVERS la protection active (journal
 *  dégâts, aucun blocage). 100 % précision. */
export const FEINT_THROUGH_PROTECT = {
  seed: 12345,
  pokemon: "snorlax",
  moves: ["feint"],
  playerPosition: { x: 2, y: 3 },
  playerDirection: "north",
  dummyPosition: { x: 2, y: 2 },
  dummyMove: "protect",
} as const;

/** Anti-Air (`smack-down`, Roche Phys 50 + `SmackDown`). Rhinoféros cloue le Dracolosse (Vol) au
 *  sol : journal « … est cloué au sol ! » (SmackedDown) + badge InfoPanel « Au sol ». Au tour 2,
 *  Coud'Boue (`mud-slap`, Sol) TOUCHE le Vol cloué (immunité Sol→Vol levée) — le contrôle
 *  `ANTI_AIR_CONTROL` prouve que sans grounding le même Coud'Boue est SANS EFFET. Les deux moves à
 *  100 % précision → déterministe (seed hérité). */
export const ANTI_AIR = {
  seed: 12345,
  pokemon: "rhydon",
  moves: ["smack-down", "mud-slap"],
  playerPosition: { x: 2, y: 3 },
  playerDirection: "north",
  dummyPosition: { x: 2, y: 2 },
  dummyPokemon: "dragonite",
} as const;

/** Contrôle négatif d'Anti-Air : Coud'Boue (Sol) lancé DIRECTEMENT sur le Dracolosse (Vol) NON cloué
 *  → l'immunité Sol→Vol le rend SANS EFFET (le journal n'émet aucune ligne de dégâts pour la cible,
 *  effectiveness 0 = silencieux). Comparé au cas cloué (ANTI_AIR, qui inflige des dégâts Sol), il
 *  prouve que le grounding lève bien l'immunité. */
export const ANTI_AIR_CONTROL = {
  ...ANTI_AIR,
  moves: ["mud-slap"],
} as const;

/** Poursuite (`pursuit`, Ténèbres Phys 40, `pursuitBackstab`) — ×2 quand le coup atteint le DOS de la
 *  cible. Deux configs qui ne diffèrent QUE par l'orientation du dummy : DOS (dummy face nord, dos
 *  tourné vers le joueur au sud → ×2,3) vs FACE (dummy face sud, vers le joueur → ×0,85). Même seed →
 *  même jet aléatoire → les dégâts de dos dominent nettement ceux de face. */
export const PURSUIT_BACKSTAB = {
  ...DUEL,
  moves: ["pursuit"],
  dummyDirection: "north",
} as const;

export const PURSUIT_FRONTAL = {
  ...DUEL,
  moves: ["pursuit"],
  dummyDirection: "south",
} as const;

/** Corps Perdu (`vital-throw`, Combat Phys 70, `bypassAccuracy`) — ne rate JAMAIS. Le dummy Normal a
 *  l'Esquive au max (+6, ≈ 33 % de précision pour un coup normal) ; Corps Perdu ignore la vérif de
 *  précision et TOUCHE quand même (journal dégâts, jamais « rate son attaque »). Le contrôle négatif
 *  (un coup normal PEUT rater cette même cible) est couvert unit/integration core. */
export const VITAL_THROW = {
  ...DUEL,
  moves: ["vital-throw"],
  dummyStatStages: { evasion: 6 },
} as const;

// Famille Misc buff-stat multi-allié (plan 156) — Grondement (`howl`, Normal Statut Self) buffe
// l'Attaque +1 du LANCEUR ET de tous les alliés vivants du diamant Manhattan r2 auto-centré (champ
// `radius` sur l'effet StatChange). Le harness sandbox est un 1v1 (joueur + dummy) et n'expose PAS de
// 2ᵉ Pokemon du même camp → le VOLET multi-allié (buff des alliés dans le rayon) n'est PAS observable
// ici ; il reste couvert par l'unit `battle/moves/howl.test.ts` (positions Manhattan r2 : ally-near
// buffé / ally-far non / ennemi non). L'e2e prouve donc le seul volet pilotable en 1v1 : le lanceur,
// qui est dans son propre rayon, gagne Attaque +1.
// Magné-Contrôle (`magnetic-flux`) n'a volontairement PAS de config : ses effets sont gatés par le
// talent Plus/Minus (`abilityGate`), absent du roster Gen 1 → no-op injouable, codé par complétude
// (décision plan 156). Le sens reste couvert par l'unit `battle/moves/magnetic-flux.test.ts`.

/** Grondement (`howl`, Normal Statut, targeting Self, StatChange Attaque +1 radius 2). Arcanin
 *  (arcanine — apprend Grondement en Gen 1) lance Grondement sur sa propre case (2,3) : il est DANS
 *  son propre diamant r2 → Attaque +1 → journal « Attaque de Arcanin augmente ! ». Move statut sans
 *  jet de précision → cast déterministe (seed DUEL hérité). */
export const GRONDEMENT = {
  ...DUEL,
  pokemon: "arcanine",
  moves: ["howl"],
} as const;

// Famille Transform (plan 157) — Morphing (`transform`), Imposteur (`imposter`), Métamorph (`ditto`).
// Le lanceur devient une COPIE de la cible : stats, types, 4 moves, talent, poids, genre, sprite ;
// mais niveau + PV restent ceux du lanceur (#649). Le SWAP D'ATLAS (sprite qui devient celui de la
// cible) est un fait de TEXTURE non exposé par le hook scène (`meshInfo` ne rend que
// position/visibilité/groupe, jamais l'atlas lié) → couvert 👁 au cahier §5.34, jamais forcé en golden.
// Les observables PILOTABLES via le renderer sont : (1) la ligne de journal FR « <nom> se transforme ! »
// (event Transformed) ; (2) le menu d'attaque qui liste désormais les moves COPIÉS de la cible
// (`effectiveMoveIds` → getLegalActions) ; (3) l'identité de l'InfoPanel qui reste celle du lanceur
// (nom + barre de PV via `definitionId` de base, PAS `transformState`) ; (4) l'héritage terrain du
// type copié (#659). Le dummy est INERTE : `dummyMove: "leer"` n'appartient PAS au movepool de
// Léviator → le DummyAiController ne trouve aucune action et se contente de terminer son tour, tandis
// que ses 4 slots (Danse Draco / Cascade / Mâchouille / Hydro-Queue) restent intacts pour la copie.
// Morphing est un move STATUT (Single r3, aucun jet de précision) → cast déterministe (seed hérité).

/** Morphing — Mew (apprend `transform`) lance Morphing sur le dummy Léviator (gyarados) adjacent. Le
 *  lanceur a 4 moves (`transform` en 1ᵉ slot → sélectionné par `castFirstMove`) pour prouver que la
 *  copie REMPLACE tout le moveset par celui de la cible. Positions hors hasard de `sandbox-flat`
 *  ((3,3)/(3,2) = terrain normal) pour que le journal ne soit pollué par aucun effet de terrain. */
export const MORPH_MEW = {
  seed: 12345,
  pokemon: "mew",
  moves: ["transform", "psychic", "recover", "barrier"],
  playerPosition: { x: 3, y: 3 },
  playerDirection: "north",
  dummyPokemon: "gyarados",
  dummyPosition: { x: 3, y: 2 },
  dummyControl: "ai",
  dummyMove: "leer",
} as const;

/** Héritage terrain (#659) — Mew (Psychic, au sol) démarre SUR le marais de `sandbox-flat` (2,2) et
 *  morphe en Léviator (Eau/Vol) posé à côté sur terrain normal (3,2). Le type Vol copié fait LÉVITER
 *  le morphé → aucun poison de marais en fin de tour. Le témoin {@link MORPH_TERRAIN_CONTROL} (même
 *  config, sans morph) prouve qu'un Mew NON transformé sur le marais EST empoisonné → c'est bien le
 *  morph (et le type copié) qui accorde l'immunité, et non la case. */
export const MORPH_TERRAIN = {
  seed: 12345,
  pokemon: "mew",
  moves: ["transform"],
  playerPosition: { x: 2, y: 2 },
  playerDirection: "north",
  dummyPokemon: "gyarados",
  dummyPosition: { x: 3, y: 2 },
  dummyControl: "ai",
  dummyMove: "leer",
} as const;

/** Témoin de {@link MORPH_TERRAIN} : MÊME config, mais le Mew au sol se contente d'ATTENDRE sur le
 *  marais (aucun morph) → il est empoisonné par le marais en fin de tour (« … est blessé par le
 *  marécage »). Comparé au cas morphé, prouve que la lévitation vient du type Vol copié. */
export const MORPH_TERRAIN_CONTROL = MORPH_TERRAIN;

/** Imposteur — Métamorph (ditto, talent `imposter`) se transforme AUTOMATIQUEMENT à l'entrée en
 *  combat sur l'ennemi le plus proche (Léviator adjacent). Aucune action requise : le morph est posé
 *  par `onBattleStart` (empilé dans les `startupEvents`), donc le journal affiche « … se transforme ! »
 *  DÈS le boot et le menu d'attaque du tour 1 liste déjà les moves de Léviator (et plus Morphing, le
 *  seul move de ditto). `playerAbility: "imposter"` est redondant (talent natif du custom ditto) mais
 *  explicite l'intention. */
export const IMPOSTER_DITTO = {
  seed: 12345,
  pokemon: "ditto",
  moves: ["transform"],
  playerAbility: "imposter",
  playerPosition: { x: 3, y: 3 },
  playerDirection: "north",
  dummyPokemon: "gyarados",
  dummyPosition: { x: 3, y: 2 },
  dummyControl: "ai",
  dummyMove: "leer",
} as const;

/** Prio-Parade — CAS RÉUSSITE (`upper-hand`, plan 162, réutilise `failsUnlessTargetAggressive` de
 *  Coup Bas + flinch 100 %). Miroir de {@link PRIORITY_SUCKER_HIT} : le dummy Ronflex en HOT-SEAT
 *  attaque avec Charge (offensive) → sa dernière action est agressive ; au tour suivant Persian
 *  (rapide) lance Prio-Parade → fraîcheur satisfaite → le coup TOUCHE, et l'apeurement 100 % skippe
 *  le tour suivant du dummy (« … est apeuré et ne peut pas agir ! »). */
export const UPPER_HAND_HIT = {
  seed: 12345,
  pokemon: "persian",
  moves: ["upper-hand"],
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
} as const;

/** Prio-Parade — CAS ÉCHEC (`upper-hand`, plan 162). Miroir de {@link PRIORITY_SUCKER_FIZZLE} :
 *  Persian rapide lance Prio-Parade AU 1ᵉ tour, avant que le dummy Ronflex inerte ait agi → la cible
 *  n'est pas agressive → le coup FIZZLE (« Mais cela échoue … ! », 0 dégât, CT payé). */
export const UPPER_HAND_FIZZLE = {
  seed: 12345,
  pokemon: "persian",
  moves: ["upper-hand"],
  dummyPokemon: "snorlax",
} as const;

// Content-fill — 7 derniers talents Gen 1 (plan 163). Pilotables via l'UI sandbox : le joueur contrôle
// son mon, `playerAbility`/`dummyAbility` sont overridables. Observables déterministes (aucun override
// `Math.random`, règle dure) : journal FR, badges volatiles de l'InfoPanel (au survol), état désactivé
// d'un bouton d'action. Délestage (unburden) est le SEUL reporté (cf. docs/next.md) : sa Vitesse ×2 ne
// se manifeste que par la portée de mouvement / l'ordre CT après une perte d'objet live, non observable
// proprement dans le 1v1 sandbox → couvert unit/integration core (`effective-base-speed.test.ts`).

/** Récolte (`harvest`) — fin de tour SOUS SOLEIL (chance 1 → déterministe) : la baie de pincement
 *  consommée est recréée. Le Ronflex (snorlax, endurant, au sol) porte Récolte + une Baie Lichii
 *  (`liechi-berry`, pincement ≤25 % PV) et démarre à 20 % PV (`hp: 20`). « Attendre » résout la fin de
 *  tour : l'objet `onEndTurn` mange la baie AVANT l'ability `onEndTurn` (ordre BattleEngine), puis
 *  Récolte la restaure DANS LA MÊME fin de tour → journal « Baie Lichii de Ronflex s'active ! » +
 *  « Récolte de Ronflex s'active ! » + « Ronflex recycle son Baie Lichii ! ». Sous Soleil
 *  (`weather: sun`) la chance de Récolte vaut 1 → aucun jet, aucun override `Math.random`. */
export const HARVEST_SUN_RESTORE = {
  ...DUEL,
  pokemon: "snorlax",
  playerAbility: "harvest",
  heldItem: "liechi-berry",
  hp: 20,
  weather: "sun",
} as const;

/** Piège Sable (`arena-trap`) — un ennemi au sol adjacent (Chebyshev r1) ne peut plus se déplacer. ⚠️
 *  Le mon PIÉGÉ doit porter un talent NON-exempté (Vol/Spectre/Lévitation/Fuite/Carapace Mue/Gaz
 *  Inhibiteur l'immuniseraient), d'où `playerAbility: "guts"` (Cran, non-exempt) sur le Florizarre
 *  (Plante/Poison, au sol). Le dummy Ronflex porte Piège Sable et démarre adjacent (2,2). À l'init du
 *  combat `recomputeGasSuppression` (qui traite aussi Piège Sable) pose `arenaTrapped` sur le joueur →
 *  le bouton « Deplacement » est DÉSACTIVÉ (aucune action Move dans `getLegalActions` → `canMove`
 *  false) et l'InfoPanel du joueur monte le badge « Piégé » (status.trapped). Aucun jet → déterministe. */
export const ARENA_TRAP_PLAYER_TRAPPED = {
  ...DUEL,
  playerAbility: "guts",
  dummyPokemon: "snorlax",
  dummyAbility: "arena-trap",
} as const;

/** Piège Sable — RUPTURE (miroir inversé) : le joueur Florizarre porte Piège Sable, le PIÉGÉ est le
 *  dummy Ronflex (`dummyAbility: "guts"`, non-exempt, au sol) adjacent en (2,2), inerte
 *  (`dummyMove: "leer"`). À l'init le dummy est piégé → badge « Piégé » à son survol. Puis le joueur se
 *  déplace en (2,5) (Chebyshev 3 du dummy) → `recomputeGasSuppression` après `PokemonMoved` libère le
 *  dummy → le badge « Piégé » disparaît (et un flottant « Libéré ! » monte, non asserté : le mesh
 *  `hud_text_plane` n'est pas discriminable par texte). Déplacement sans jet → déterministe. */
export const ARENA_TRAP_RELEASE = {
  ...DUEL,
  playerAbility: "arena-trap",
  dummyPokemon: "snorlax",
  dummyAbility: "guts",
  dummyMove: "leer",
} as const;

/** Gaz Inhibiteur (`neutralizing-gas`) — neutralise les talents ennemis dans un rayon Manhattan r2 du
 *  porteur. Le joueur Florizarre porte Gaz Inhibiteur ; le dummy Ronflex (`dummyAbility: "guts"`, pour
 *  avoir un talent à neutraliser) est adjacent en (2,2) (Manhattan 1 ≤ 2). À l'init
 *  `recomputeGasSuppression` pose `abilitySuppressedByGas` sur le dummy → au survol, l'InfoPanel du
 *  dummy monte le badge « Talent neutralisé » (infoPanel.volatile.gasSuppressed). Le PORTEUR ne
 *  s'auto-neutralise pas (aucun badge à son survol). Aucun jet → déterministe. */
export const NEUTRALIZING_GAS_SUPPRESS = {
  ...DUEL,
  playerAbility: "neutralizing-gas",
  dummyPokemon: "snorlax",
  dummyAbility: "guts",
} as const;

/** Témoin de portée : MÊME config mais le dummy est écarté à Manhattan 3 (2,0), HORS du rayon r2 → il
 *  n'est PAS neutralisé (aucun badge « Talent neutralisé » à son survol). Comparé à
 *  {@link NEUTRALIZING_GAS_SUPPRESS}, prouve que la neutralisation est bornée à r2 (et non field-wide). */
export const NEUTRALIZING_GAS_FAR = {
  ...NEUTRALIZING_GAS_SUPPRESS,
  dummyPosition: { x: 2, y: 0 },
} as const;

/** Fouille (`frisk`) — révèle l'objet des ennemis à l'entrée. Le joueur Florizarre porte Fouille ; le
 *  dummy Ronflex tient les Restes (`dummyHeldItem: "leftovers"`). À l'init (`onBattleStart`)
 *  `revealedItem` est posé sur le dummy → au survol, l'InfoPanel du dummy monte le badge « Objet :
 *  Restes » (infoPanel.reveal.item). Aucun jet → déterministe. */
export const FRISK_REVEALS_ITEM = {
  ...DUEL,
  playerAbility: "frisk",
  dummyPokemon: "snorlax",
  dummyHeldItem: "leftovers",
} as const;

/** Prédiction (`forewarn`) — révèle la capacité la plus puissante des ennemis. Le joueur Florizarre
 *  porte Prédiction ; à l'init `revealedTopMove` est posé sur le dummy Ronflex → au survol, badge
 *  « Menace : {capacité} » (infoPanel.reveal.topMove). La capacité exacte dérive du moveset d'espèce
 *  du dummy → on assert le PRÉFIXE « Menace : » (robuste, déterministe). */
export const FOREWARN_REVEALS_MOVE = {
  ...DUEL,
  playerAbility: "forewarn",
  dummyPokemon: "snorlax",
} as const;

/** Anticipation (`anticipation`) — révèle le TALENT des ennemis (choix non-canon, plan 163). Le joueur
 *  Florizarre porte Anticipation ; à l'init `revealedAbility` est posé sur le dummy Ronflex
 *  (`dummyAbility: "levitate"`) → au survol, badge « Talent : Lévitation » (infoPanel.reveal.ability).
 *  Aucun jet → déterministe. */
export const ANTICIPATION_REVEALS_ABILITY = {
  ...DUEL,
  playerAbility: "anticipation",
  dummyPokemon: "snorlax",
  dummyAbility: "levitate",
} as const;

// Anim de repos d'un Volant selon le terrain d'atterrissage (§11 ; view-core `isFlyoverTerrain`).
// Roucarnage (pidgeot, Vol) démarre ADJACENT à la tuile cible → déplacement 1-case déterministe
// (les moves longue portée ratent souvent). Le dummy est parqué en (4,4), hors chemin. Map
// `sandbox-flat` : (1,1)/(2,1) `normal`, (1,2) `ice`, (2,2) `swamp`. ⚠️ Au SPAWN le resting
// terrain-aware n'est PAS encore appliqué (Idle par défaut) → chaque scénario PILOTE un déplacement
// pour l'exercer, puis lit `spriteStates()`. Pas de jet (déplacement) → seed hérité, déterministe.

/** Départ sur le sol (1,1) — cible la GLACE adjacente (1,2), un terrain fly-over → le Volant reste
 *  en vol au repos (`restingAnimation` ∈ candidats glide, ici « FlyingIdle »). */
export const FLYING_REST_FROM_LAND = {
  seed: 12345,
  pokemon: "pidgeot",
  moves: ["gust"],
  playerPosition: { x: 1, y: 1 },
  dummyPosition: { x: 4, y: 4 },
} as const;

/** Départ sur la glace (1,2) — sert deux atterrissages 1-case : (1,1) `normal` (sol → se pose,
 *  « Idle ») et (2,2) `swamp` (fly-over → reste en vol, « FlyingIdle »). */
export const FLYING_REST_FROM_ICE = {
  ...FLYING_REST_FROM_LAND,
  playerPosition: { x: 1, y: 2 },
} as const;

/** Tag de tooltip `typeEffectivenessOverride` DÉRIVÉ dynamiquement (plus de libellé hardcodé) — le
 *  joueur Lapras force Lyophilisation (`freeze-dry`, Glace, `typeEffectivenessOverride` ×2 vs Eau,
 *  hors-pool via `moves`). Survoler le move dans le sous-menu d'attaque monte le tooltip dont un tag
 *  lit « ×2 sur les types Eau » (FR) — construit depuis `moveTooltip.tag.typeEffectivenessOverride`
 *  + `pokemonType.water`, pas une chaîne figée. Aucun cast : on n'ouvre que le menu + survol → pas de
 *  jet, déterministe (seed DUEL hérité). Lapras est un porteur Gen-1 jouable. */
export const TOOLTIP_FREEZE_DRY_TYPE_OVERRIDE = {
  ...DUEL,
  pokemon: "lapras",
  moves: ["freeze-dry"],
} as const;

// --- Plan 167 — harness équipes N-vs-N & IA scorée (schéma SandboxConfig v2 `teams`) ------------
// Le boot ?config accepte le v2 : `teams: [équipe1, équipe2]`, chaque équipe portant son `control`
// ("player" | "passive" | "scored") + ses membres. Ces fixtures exercent le VRAI scorer IA
// (`control:"scored"` → AiTeamController seedé) — le déblocage de ce plan. Déterministe via `seed`.
// Colonne x=2 de `sandbox-flat` : rangs 0/1/4 `normal`, rangs 2/3 dangereux (swamp sur x=2) → on
// place les combattants sur des tuiles `normal` (2,1)/(2,4). Dracaufeu (Feu/Vol, vitesse 100 > 80)
// joue AVANT Florizarre au boot : c'est lui qui déclenche le premier tour IA observable.

/** Équipe 2 pilotée par le vrai scorer IA (`control:"scored"`, profil « hard »). Dracaufeu (IA, en
 *  (2,1)) fait face à Florizarre (joueur, en (2,4)) sur la colonne x=2 ; plus rapide, il agit dès le
 *  boot : Lance-Flammes (Ligne 3) descend la colonne et touche Florizarre. ⚠️ Le seed fixe rend
 *  la RNG de COMBAT reproductible (précision/critique/variance), mais PAS la création (nature/genre
 *  via `rollNature`/`rollGender` sur `Math.random` non seedé dans `createSandboxBattle`) → le dégât
 *  exact varie d'un boot à l'autre ; seule la décision « attaquer » du scorer est reproductible. */
export const SCORED_AI_ATTACKS = {
  seed: 20250722,
  teams: [
    {
      control: "player",
      members: [{ pokemon: "venusaur", position: { x: 2, y: 4 }, direction: "north" }],
    },
    {
      control: "scored",
      aiProfile: "hard",
      members: [
        {
          pokemon: "charizard",
          moves: ["flamethrower"],
          position: { x: 2, y: 1 },
          direction: "south",
        },
      ],
    },
  ],
} as const;

/** Même disposition, mais l'équipe 2 est PASSIVE (aucun move défensif) : Dracaufeu attend son tour
 *  sans jamais attaquer ni bouger — le contraste avec l'IA scorée (aucune ligne « Dracaufeu utilise »,
 *  sprite figé sur sa tuile de spawn). */
export const PASSIVE_AI_STATIC = {
  seed: 20250722,
  teams: [
    {
      control: "player",
      members: [{ pokemon: "venusaur", position: { x: 2, y: 4 }, direction: "north" }],
    },
    {
      control: "passive",
      members: [{ pokemon: "charizard", position: { x: 2, y: 1 }, direction: "south" }],
    },
  ],
} as const;

/** Équipe 1 = Florizarre + un allié Dracaufeu KO au spawn (`hp:0`). Le membre KO n'est jamais actif
 *  et ne bloque pas le tour (le joueur pilote directement Florizarre). Florizarre porte Vœu Soin
 *  (healing-wish) : ciblé sur la tuile de l'allié KO adjacent (3,4), il se sacrifie et le réanime.
 *  Équipe 2 = un dummy passif parqué au coin (0,0), hors de portée. */
export const SPAWN_FAINTED_ALLY_REVIVE = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["healing-wish"],
          position: { x: 2, y: 4 },
          direction: "north",
        },
        { pokemon: "charizard", hp: 0, position: { x: 3, y: 4 } },
      ],
    },
    {
      control: "passive",
      members: [{ pokemon: "dummy", position: { x: 0, y: 0 } }],
    },
  ],
} as const;

// --- Familles mécaniques sans couverture e2e (plans 146/147/149/153/154 + phazing) ---------------
// Duel adjacent sur terrain NORMAL : `sandbox-flat` a des terrains dangereux sur les rangs y=2/3 de
// la colonne x=2 (swamp/ice…) — les configs DUEL historiques (2,3)/(2,2) sont donc SUR du marais. Ces
// familles préfèrent les rangs y=4 (100 % normal) : lanceur (2,4) face EST, cible (3,4) adjacente →
// aucun DoT de terrain ne pollue le journal, et les moves Single/Cone/Zone touchent la cible. Cible
// Ronflex (snorlax, espèce ≠ lanceur → nom filtrable) endurante (`dummyHp: 999` = PV pleins de
// l'espèce) et passive (aucun `dummyMove` → attend, ne pollue jamais). Seed fixe, aucun override
// `Math.random` : tous ces moves sont STATUT (aucun jet de précision) ou 100 % → cast déterministe.
const NORMAL_DUEL = {
  seed: 12345,
  pokemon: "venusaur",
  playerPosition: { x: 2, y: 4 },
  playerDirection: "east",
  dummyPokemon: "snorlax",
  dummyPosition: { x: 3, y: 4 },
  dummyHp: 999,
} as const;

// Famille Manip état/stats (plan 146) — reset / copie / inversion / échange de crans de stats. Tous
// des moves STATUT (aucun jet) → cast déterministe. Le SENS observable est la ligne de journal FR
// dédiée (BattleLogFormatter), pas le pixel. Cast sur la cible (3,4) sauf Buée Noire (Zone Self).

/** Buée Noire (`haze`, Zone r3 Self) — remet à zéro les crans de TOUS les mons du diamant (lanceur +
 *  cible) → journal « Les changements de stats de tous les Pokémon sont annulés ! » (StatStagesReset).
 *  Cast sur la propre case (2,4) ; les deux combattants sont dans le rayon r3. */
export const STAT_MANIP_HAZE = { ...NORMAL_DUEL, moves: ["haze"] } as const;

/** Bain de Smog (`clear-smog`, Single 1-3) — dégâts PUIS reset des crans de la cible → journal
 *  « Ronflex perd N PV » + « Les changements de stats de tous les Pokémon sont annulés ! ». */
export const STAT_MANIP_CLEAR_SMOG = { ...NORMAL_DUEL, moves: ["clear-smog"] } as const;

/** Boost (`psych-up`, Single 1-3) — le lanceur COPIE les crans de la cible → journal « Florizarre
 *  copie les changements de stats de Ronflex ! » (StatStagesCopied). */
export const STAT_MANIP_PSYCH_UP = { ...NORMAL_DUEL, moves: ["psych-up"] } as const;

/** Renversement (`topsy-turvy`, Single 1-3) — inverse le signe des crans de la cible → journal
 *  « Les changements de stats de Ronflex sont inversés ! » (StatStagesInverted). */
export const STAT_MANIP_TOPSY_TURVY = { ...NORMAL_DUEL, moves: ["topsy-turvy"] } as const;

/** Permugarde (`guard-swap`, Single 1-3) — échange les crans Déf + Déf. Spé. lanceur↔cible → journal
 *  « Florizarre et Ronflex échangent leur Défense et Déf. Spé. ! » (StatStagesSwapped). */
export const STAT_MANIP_GUARD_SWAP = { ...NORMAL_DUEL, moves: ["guard-swap"] } as const;

/** Permuforce (`power-swap`, Single 1-3) — échange les crans Atq + Atq. Spé. → journal « … échangent
 *  leur Attaque et Atq. Spé. ! ». */
export const STAT_MANIP_POWER_SWAP = { ...NORMAL_DUEL, moves: ["power-swap"] } as const;

/** Permucœur (`heart-swap`, Single 1-1) — échange les 7 crans lanceur↔cible → journal « Florizarre et
 *  Ronflex échangent leur … ! » (StatStagesSwapped, les 7 libellés). Cast sur la cible adjacente. */
export const STAT_MANIP_HEART_SWAP = { ...NORMAL_DUEL, moves: ["heart-swap"] } as const;

/** Permuvitesse (`speed-swap`, Single 1-1) — échange la Vitesse BRUTE → journal « Florizarre et
 *  Ronflex échangent leur Vitesse ! » (SpeedSwapped). Cast sur la cible adjacente. */
export const STAT_MANIP_SPEED_SWAP = { ...NORMAL_DUEL, moves: ["speed-swap"] } as const;

// Famille Lock-in multi-tours (plan 149) — verrou 2-3 tours (Mania/Danse Fleurs/Colère + Confusion à
// la fin) ou 3 tours (Brouhaha, sans confusion). Le SENS observable : (1) le journal FR de départ
// « <X> se déchaîne avec <move> ! » (LockInStarted) ; (2) le VERROUILLAGE — au tour suivant le menu
// d'attaque ne liste plus que le move verrouillé (getLegalActions le filtre). Ball'Glace (`ice-ball`,
// RolloutStreak) et Frénésie (`rage`, non implémenté) restent 👁 (cf. cahier §5.40).

/** Colère (`outrage`, Single 1-1, lockIn 2-3 + confuseOnEnd) — DEUX moves [outrage, scratch] pour
 *  prouver le verrouillage : après le 1ᵉ cast, le menu d'attaque du tour suivant ne montre plus que
 *  Colère (Griffe filtrée). Cast sur la cible adjacente (3,4). */
export const LOCK_IN_OUTRAGE = { ...NORMAL_DUEL, moves: ["outrage", "scratch"] } as const;

/** Mania (`thrash`, Single 1-1, lockIn 2-3 + confuseOnEnd) — journal de départ « … se déchaîne … ». */
export const LOCK_IN_THRASH = { ...NORMAL_DUEL, moves: ["thrash"] } as const;

/** Danse Fleurs (`petal-dance`, Single 1-2, lockIn 2-3 + confuseOnEnd) — idem, portée 1-2. */
export const LOCK_IN_PETAL_DANCE = { ...NORMAL_DUEL, moves: ["petal-dance"] } as const;

/** Brouhaha (`uproar`, Cone 1-3, lockIn 3 SANS confusion) — cône vers l'EST : le lanceur (2,4) face
 *  est vise la cible (3,4) dans le cône → journal « … se déchaîne avec Brouhaha ! ». */
export const LOCK_IN_UPROAR = { ...NORMAL_DUEL, moves: ["uproar"] } as const;

// Famille Manip talent — Batch C (plan 153). Mutation runtime du talent (event AbilityChanged →
// ligne de journal FR). Le lanceur porte Engrais (`overgrow`, explicite pour que l'échange/copie soit
// non-trivial) et la cible Vaccin (`immunity`, ≠ lanceur → aucun échec « no-op »). Single r1, cast sur
// la cible adjacente (3,4). Statut sans jet → déterministe.

/** Soucigraine (`worry-seed`) — remplace le talent de la cible par Insomnie → journal « Le talent de
 *  Ronflex devient <Insomnie> ! » (AbilityChanged, reason SetByMove). */
export const ABILITY_MANIP_WORRY_SEED = {
  ...NORMAL_DUEL,
  moves: ["worry-seed"],
  playerAbility: "overgrow",
  dummyAbility: "immunity",
} as const;

/** Suc Digestif (`gastro-acid`) — supprime le talent de la cible → journal « Le talent de Ronflex est
 *  neutralisé ! » (AbilityChanged, reason GastroAcid). */
export const ABILITY_MANIP_GASTRO_ACID = {
  ...NORMAL_DUEL,
  moves: ["gastro-acid"],
  playerAbility: "overgrow",
  dummyAbility: "immunity",
} as const;

/** Imitation (`role-play`) — le lanceur COPIE le talent de la cible → journal « Florizarre copie le
 *  talent <Vaccin> ! » (AbilityChanged, reason RolePlay). */
export const ABILITY_MANIP_ROLE_PLAY = {
  ...NORMAL_DUEL,
  moves: ["role-play"],
  playerAbility: "overgrow",
  dummyAbility: "immunity",
} as const;

/** Échange (`skill-swap`) — échange les talents lanceur↔cible → DEUX lignes « Le talent de … devient
 *  … ! » (AbilityChanged ×2, reason SkillSwap). On assert celle du lanceur. */
export const ABILITY_MANIP_SKILL_SWAP = {
  ...NORMAL_DUEL,
  moves: ["skill-swap"],
  playerAbility: "overgrow",
  dummyAbility: "immunity",
} as const;

// Famille Buff/statut — Batch D (plan 154). Chaque move a une ligne de journal FR dédiée. Statut sans
// jet → déterministe. Cast Self sur la propre case (2,4) ; cast ennemi sur la cible adjacente (3,4).

/** Malédiction (`curse`) — lanceur SPECTRE : Ectoplasma (gengar) sacrifie 50 % PV + DoT sur la cible
 *  ennemie r3 → journal « Ectoplasma se maudit et jette une malédiction sur Ronflex ! (-N PV) »
 *  (Cursed). Cast sur la cible (3,4). Gengar démarre à PV pleins (coût 50 % non létal). */
export const BUFF_STATUS_CURSE_GHOST = {
  ...NORMAL_DUEL,
  pokemon: "gengar",
  moves: ["curse"],
} as const;

/** Malédiction (`curse`) — lanceur NON-Spectre : Florizarre (Plante/Poison) se buffe (Self) : −1 Vit,
 *  +1 Atq, +1 Déf, sans coût de PV → journal « Attaque de Florizarre augmente ! » + « Vitesse de
 *  Florizarre baisse ! » (StatChanged). Cast sur la propre case (2,4). */
export const BUFF_STATUS_CURSE_SELF = { ...NORMAL_DUEL, moves: ["curse"] } as const;

/** Bâillement (`yawn`, Single 1-1) — rend la cible somnolente (sommeil différé) → journal « Ronflex
 *  commence à somnoler ! » (Drowsy). Cast sur la cible adjacente (3,4). */
export const BUFF_STATUS_YAWN = { ...NORMAL_DUEL, moves: ["yawn"] } as const;

/** Cognobidon (`belly-drum`, Self) — sacrifie 50 % PV, maximise l'Attaque → journal « Florizarre se
 *  tape le bidon et maximise son Attaque ! (-N PV) » (BellyDrumUsed). Florizarre à PV pleins (coût
 *  50 % non létal, Attaque pas déjà +6). Cast sur la propre case (2,4). */
export const BUFF_STATUS_BELLY_DRUM = { ...NORMAL_DUEL, moves: ["belly-drum"] } as const;

/** Acupression (`acupressure`, ally-or-self) — +2 à une stat de combat ALÉATOIRE du lanceur (seedée)
 *  → journal « <stat> de Florizarre augmente ! » (StatChanged). La stat exacte dépend du seed → on
 *  assert le SENS (une hausse sur le lanceur), pas l'identité de la stat. Cast sur la propre case. */
export const BUFF_STATUS_ACUPRESSURE = { ...NORMAL_DUEL, moves: ["acupressure"] } as const;

/** Attraction (`attract`, Single 1-1) — infatue une cible du SEXE OPPOSÉ. Tauros (100 % ♂) vise
 *  Kangourex (kangaskhan, 100 % ♀) → le sexe opposé est GARANTI quel que soit le seed → journal
 *  « Kangourex tombe amoureux ! » (StatusApplied Infatuated). Cast sur la cible adjacente (3,4). */
export const BUFF_STATUS_ATTRACT = {
  ...NORMAL_DUEL,
  pokemon: "tauros",
  moves: ["attract"],
  dummyPokemon: "kangaskhan",
} as const;

/** Vol Magnétik (`magnet-rise`, Self) — le lanceur lévite 5 tours → journal « Florizarre lévite grâce
 *  à un champ magnétique ! » (MagnetRisePosted). Aucune Gravité en jeu. Cast sur la propre case. */
export const BUFF_STATUS_MAGNET_RISE = { ...NORMAL_DUEL, moves: ["magnet-rise"] } as const;

// Famille Phazing — Cyclone / Hurlement / Projection éjectent chaque ennemi vers SA zone de spawn
// (EffectKind.PhazeToSpawn → ejectToSpawn : pas de banc, l'éjection remplace le switch forcé canon).
// ⚠️ L'ÉJECTION elle-même n'agit QUE si la cible n'est PAS déjà sur sa case de spawn
// (`forced-teleport` : positionKey ≠ current) : en 1v1 statique la cible reste sur son spawn → un
// no-op non journalisé. La rendre observable exigerait de repositionner de façon fiable la cible
// HORS de son spawn ET dans la portée du lanceur — or (a) le déplacement d'un mon en hot-seat n'est
// pas gréable via le DOM dans ce harness, et (b) la zone de contrôle interdit d'entrer sur une case
// adjacente à un ennemi (indispensable pour Cyclone r1 / Projection corps-à-corps). Le SENS de
// l'éjection reste couvert par les unit core (`handle-phaze.test.ts`, `forced-teleport.test.ts`) → 👁.
// On pilote donc ici le volet OBSERVABLE en 1v1 statique : Projection inflige ses dégâts (la cible
// reste sur son spawn, éjection no-op), Cyclone/Hurlement se lancent et résolvent (MoveStarted). Duel
// normal (lanceur (2,4) est / cible (3,4)), aucun jet → déterministe.

/** Cyclone (`whirlwind`, Zone r1 Self) — le lanceur souffle la zone (MoveStarted « … utilise Cyclone ! »).
 *  Cast sur la propre case (2,4) ; la cible sur son spawn n'est pas déplaçable → éjection no-op (👁). */
export const PHAZE_WHIRLWIND = { ...NORMAL_DUEL, moves: ["whirlwind"] } as const;

/** Hurlement (`roar`, Cone 1-3) — le lanceur crie vers l'est (MoveStarted « … utilise Hurlement ! »).
 *  Cast sur la case de la cible (3,4) dans le cône ; éjection no-op sur spawn (👁). */
export const PHAZE_ROAR = { ...NORMAL_DUEL, moves: ["roar"] } as const;

/** Projection (`circle-throw`, Single 1-1) — dégâts PUIS éjection. En 1v1 statique seuls les DÉGÂTS
 *  sont observables (« Ronflex perd N PV ») ; la cible sur son spawn n'est pas éjectée (no-op, 👁).
 *  Projection est à 90 % de précision → le lanceur porte Aucun Garde (`no-guard`) pour forcer la
 *  précision à 100 % (touche sous TOUT seed, même parti-pris que TRAP_PARTIAL_FIRE_SPIN). */
export const PHAZE_CIRCLE_THROW = {
  ...NORMAL_DUEL,
  moves: ["circle-throw"],
  playerAbility: "no-guard",
} as const;

// Famille Sacrifice / Self-KO (plan 147) — le lanceur meurt en échange d'un effet. En 1v1 le lanceur
// est l'unique mon du joueur → son self-K.O. clôt le combat (modale), mais les lignes de journal de la
// résolution sont émises AVANT et persistent → assertables. Le lanceur agit au TOUR 1 (aucune fin de
// tour préalable). Statut/portée fixe → déterministe. Vœu Soin (healing-wish) est DÉJÀ couvert §5.38.

/** Destruction (`self-destruct`, Zone r2 Self, isExplosion) — dégâts AoE + auto-K.O. du lanceur. Cast
 *  sur la propre case (2,4) : la cible adjacente (3,4) est dans le rayon → journal « Ronflex perd N PV »
 *  + « Florizarre est K.O. ! ». */
export const SELF_KO_SELF_DESTRUCT = { ...NORMAL_DUEL, moves: ["self-destruct"] } as const;

/** Explosion (`explosion`, Zone r2 Self, isExplosion) — variante ×forte de Destruction (même modèle
 *  self-K.O. AoE). Cast sur la propre case (2,4). */
export const SELF_KO_EXPLOSION = { ...NORMAL_DUEL, moves: ["explosion"] } as const;

/** Souvenir (`memento`, Single 1-3, selfKo) — auto-K.O. + baisse Atq/Atq. Spé. de la cible de 2 →
 *  journal « Attaque de Ronflex baisse ! » + « Florizarre est K.O. ! ». Cast sur la cible (3,4). */
export const SELF_KO_MEMENTO = { ...NORMAL_DUEL, moves: ["memento"] } as const;

/** Tout ou Rien (`final-gambit`, Single 1-1, selfKoOnConnect) — dégâts fixes = PV du lanceur (typés
 *  Combat, la cible Normal n'est pas immunisée) + auto-K.O. sur touche → journal « Florizarre joue le
 *  tout pour le tout ! » (FinalGambitApplied) + « Ronflex perd N PV ». Cible endurante (survit). */
export const SELF_KO_FINAL_GAMBIT = { ...NORMAL_DUEL, moves: ["final-gambit"] } as const;

/** Lien du Destin (`destiny-bond`, Self) — pose le volatile → journal « Florizarre tisse un lien du
 *  destin… » (DestinyBondPosted). Le DÉCLENCHEMENT (tueur entraîné) exige que le lanceur soit K.O.
 *  avant son prochain tour → 👁 (cf. cahier §5.44). Cast sur la propre case (2,4). */
export const SELF_KO_DESTINY_BOND = { ...NORMAL_DUEL, moves: ["destiny-bond"] } as const;

/** Rancune (`grudge`, Self) — pose le volatile → journal « Florizarre nourrit une rancune… »
 *  (GrudgePosted). Le DÉCLENCHEMENT (scellement du move tueur) exige un K.O. par move → 👁. Cast Self. */
export const SELF_KO_GRUDGE = { ...NORMAL_DUEL, moves: ["grudge"] } as const;

// ── Batch E « grille » (plan 155) via harness N-vs-N (plan 167) — §5.45 ──────────────────────────
// Quatre moves hors-pool Gen 1 (redirection / promotion CT / échange de position) forcés via `moves`.
// Ils VISENT ou AFFECTENT des ennemis/alliés → il faut le format v2 `teams` (une vraie équipe 2 mons
// pour les moves alliés). Terrain normal (rang y=4, 100 % normal ; cf. NORMAL_DUEL) → aucun DoT ne
// pollue le journal. Moves STATUT (aucun jet de précision) → cast déterministe (seed fixe).

/** Par Ici (`follow-me`, Zone r4 Self) — les ennemis dans le diamant Manhattan r4 centré sur le
 *  lanceur pivotent pour lui faire face → journal « Florizarre attire l'attention ! … » (DrewAttention,
 *  émis dès qu'au moins un ennemi tourne). Le lanceur Florizarre en (2,4) ; l'ennemi Ronflex passif en
 *  (3,4), distance Manhattan 1 ≤ 4 → DANS la zone. Cast Self sur (2,4). Par Ici N'EST PAS un move
 *  poudre → il tourne AUSSI les Plante (cf. RAGE_POWDER_GRASS_IMMUNE, le contraste du flag poudre). */
export const FOLLOW_ME_DRAWS = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        { pokemon: "venusaur", moves: ["follow-me"], position: { x: 2, y: 4 }, direction: "east" },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 3, y: 4 } }] },
  ],
} as const;

/** Par Ici — HORS zone : l'ennemi Ronflex passif est parqué en (0,0), distance Manhattan 6 > 4 du
 *  lanceur (2,4) → il ne pivote PAS. Le move se lance quand même (« utilise Par Ici ! ») mais AUCUNE
 *  ligne « attire l'attention » n'est émise (affectedIds vide). Prouve la borne de la Zone r4. */
export const FOLLOW_ME_OUT_OF_RANGE = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        { pokemon: "venusaur", moves: ["follow-me"], position: { x: 2, y: 4 }, direction: "east" },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 0, y: 0 } }] },
  ],
} as const;

/** Poudre Fureur (`rage-powder`, Zone r4 Self, move POUDRE) — comme Par Ici mais poudre : les ennemis
 *  Plante / Envelocape / Lunettes Filtre ne pivotent PAS. Ici l'ennemi Ronflex (Normal, non immunisé)
 *  en (3,4) pivote → « Florizarre attire l'attention ! … » (DrewAttention). Cast Self sur (2,4). */
export const RAGE_POWDER_HITS = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["rage-powder"],
          position: { x: 2, y: 4 },
          direction: "east",
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 3, y: 4 } }] },
  ],
} as const;

/** Poudre Fureur — IMMUNITÉ poudre : l'ennemi est un Florizarre (Plante/Poison) en (3,4), DANS la
 *  zone r4 mais immunisé aux poudres → il ne pivote PAS. Le move se lance (« utilise Poudre Fureur ! »)
 *  mais AUCUNE ligne « attire l'attention » (affectedIds vide). Comparé à RAGE_POWDER_HITS (Ronflex
 *  Normal tourné) ET à FOLLOW_ME sur le même Plante, prouve que c'est bien le flag POUDRE qui bloque. */
export const RAGE_POWDER_GRASS_IMMUNE = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["rage-powder"],
          position: { x: 2, y: 4 },
          direction: "east",
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "venusaur", position: { x: 3, y: 4 } }] },
  ],
} as const;

/** Après Vous (`after-you`, Single r3, targetsAlly) — la cible alliée passe STRICTEMENT prochaine au
 *  Charge Time (promotion non-destructive consommée dans `advanceTurn`). Équipe joueur = Florizarre
 *  (after-you, Vit 80) en (2,4) + un allié LENT Ronflex (Vit 30) en (3,4). Équipe ennemie = un
 *  Électrode RAPIDE (Vit 150) passif en (5,4). À vide, après le tour de Florizarre l'Électrode (le plus
 *  rapide) jouerait AVANT le lent Ronflex ; avec Après Vous sur Ronflex, ce dernier est promu prochain
 *  → « Ronflex va agir juste après ! » (PromotedToActNext) puis, après `endTurn`, Ronflex devient
 *  l'actif (avant l'Électrode). L'Électrode passif temporise au boot → la main revient à Florizarre.
 *  Cast Single sur la case de l'allié (3,4). Statut sans jet → déterministe. */
export const AFTER_YOU_PROMOTES = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        { pokemon: "venusaur", moves: ["after-you"], position: { x: 2, y: 4 }, direction: "east" },
        { pokemon: "snorlax", position: { x: 3, y: 4 } },
      ],
    },
    { control: "passive", members: [{ pokemon: "electrode", position: { x: 5, y: 4 } }] },
  ],
} as const;

/** Interversion (`ally-switch`, Single r3, targetsAlly) — le lanceur ÉCHANGE sa position avec un allié
 *  r3 (terrain re-déclenché aux 2 cases, no-op sur terrain normal). Équipe joueur = Florizarre
 *  (ally-switch) en (2,4) + un allié Ronflex en (2,5), distance 1. Équipe ennemie = un Électrode passif
 *  parqué au coin (0,0). Cast Single sur la case de l'allié (2,5) → « Florizarre et Ronflex échangent
 *  leur place ! » (AlliesSwapped) ; après coup Florizarre occupe (2,5) et Ronflex (2,4) (observable via
 *  `spriteStates`). Espèces distinctes → tuiles filtrables sans ambiguïté. Statut → déterministe. */
export const ALLY_SWITCH_SWAP = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["ally-switch"],
          position: { x: 2, y: 4 },
          direction: "east",
        },
        { pokemon: "snorlax", position: { x: 2, y: 5 } },
      ],
    },
    { control: "passive", members: [{ pokemon: "electrode", position: { x: 0, y: 0 } }] },
  ],
} as const;

/** Hurlement (`roar`, Cone 1-3, PhazeToSpawn) — RÉGRESSION éjection forcée OBSERVABLE via le harness
 *  hot-seat (les DEUX équipes en `player` → on pilote l'ennemi). L'éjection ne renvoie un mon chez lui
 *  QUE s'il n'est PAS déjà sur sa case de spawn (`forced-teleport`) : impossible à voir en 1v1 statique
 *  (§5.43, 👁), mais ici l'Électrode ennemi (Vit 150 → actif au boot) est PILOTÉ pour QUITTER son spawn
 *  (5,4) vers (4,4) — distance 2 du lanceur, hors zone de contrôle (Cyclone/Projection r1 seraient
 *  bloqués par l'adjacence ; le cône r1-3 de Hurlement atteint (4,4) sans coller le lanceur). Puis
 *  Florizarre (2,4) crie le cône vers l'est → l'Électrode hors-spawn est renvoyé sur (5,4) : « Électrode
 *  se téléporte ! » (Teleported) et il retrouve sa case de spawn (observable via `spriteStates`).
 *  Hurlement est un move statut sans jet → déterministe (seed fixe). */
export const PHAZE_ROAR_EJECTS = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        { pokemon: "venusaur", moves: ["roar"], position: { x: 2, y: 4 }, direction: "east" },
      ],
    },
    {
      // Anti-Bruit (soundproof), le talent par défaut d'Électrode, BLOQUE Hurlement (move sonore) →
      // on force Statik (`static`, sans effet ici, Hurlement n'est pas un contact) pour que le cône
      // touche et déclenche l'éjection.
      control: "player",
      members: [
        { pokemon: "electrode", ability: "static", position: { x: 5, y: 4 }, direction: "west" },
      ],
    },
  ],
} as const;

// ── Content-fill débloqué (plans 162/163) — §5.36/§5.37 : cas 👁 → 🤖 grâce aux champs `stockpileCount`
// et `unburdenActive` de SandboxMemberConfig. Terrain normal (y=4). Ennemi passif slow (Ronflex Vit 30)
// parqué hors-jeu, ou cible endurante à (3,4). Moves 100 % / statut → déterministes (seed fixe).

/** Relâche (`spit-up`, Single r3) RÉUSSITE — le lanceur pré-chargé à 3 paliers de Stockage
 *  (`stockpileCount: 3`) inflige des dégâts spé = 100 × paliers puis vide sa réserve : « Ronflex perd
 *  N PV » + « Florizarre libère sa réserve accumulée ! » (StockpileReleased). Cible Ronflex passive et
 *  ENDURANTE (hp plein, 3ᵉ palier ≈ 300 BP → survit ou tombe, la ligne de dégâts est émise dans les 2
 *  cas). Cast Single sur la cible adjacente (3,4). */
export const SPIT_UP_SUCCESS = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["spit-up"],
          position: { x: 2, y: 4 },
          direction: "east",
          stockpileCount: 3,
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 3, y: 4 } }] },
  ],
} as const;

/** Relâche — 1 seul palier : même setup mais `stockpileCount: 1` (≈ 100 BP). Comparé à SPIT_UP_SUCCESS
 *  (3 paliers), prouve le SCALING chiffré (dégâts croissants avec les paliers) ; sert aussi de base au
 *  test de CONSOMMATION (après ce cast la réserve tombe à 0 → un 2ᵉ Relâche échoue). Cible endurante. */
export const SPIT_UP_ONE_LAYER = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["spit-up"],
          position: { x: 2, y: 4 },
          direction: "east",
          stockpileCount: 1,
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 3, y: 4 } }] },
  ],
} as const;

/** Avale (`swallow`, Self) RÉUSSITE — le lanceur pré-chargé à 3 paliers (`stockpileCount: 3`) et blessé
 *  (`hp: 50` = 50 % du max) se soigne (3 paliers → 100 % du max, plafonné aux PV manquants = 50 % du
 *  max) puis vide sa réserve : « Florizarre récupère N PV » + « Florizarre libère sa réserve accumulée ! ».
 *  Ennemi Ronflex passif parqué au coin (0,0). Cast Self sur (2,4). */
export const SWALLOW_SUCCESS = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["swallow"],
          position: { x: 2, y: 4 },
          direction: "east",
          hp: 50,
          stockpileCount: 3,
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 0, y: 0 } }] },
  ],
} as const;

/** Avale — 1 seul palier : même blessure (`hp: 50`) mais `stockpileCount: 1` → soin 25 % du max.
 *  Comparé à SWALLOW_SUCCESS (3 paliers = 50 % du max plafonné), prouve le SCALING chiffré du soin. */
export const SWALLOW_ONE_LAYER = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["swallow"],
          position: { x: 2, y: 4 },
          direction: "east",
          hp: 50,
          stockpileCount: 1,
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 0, y: 0 } }] },
  ],
} as const;

/** Stockage (`stockpile`, Self) 3ᵉ PALIER + échec au-delà — le lanceur pré-chargé à 2 paliers
 *  (`stockpileCount: 2`) : un cast atteint « accumule ! (Stockage 3/3) » (Stockpiled) ; un 2ᵉ cast
 *  (après `endTurn`) dépasse le cap 3 → « Mais cela échoue … ! » (MoveFailed). Ennemi passif hors-jeu. */
export const STOCKPILE_THIRD_TIER = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [
        {
          pokemon: "venusaur",
          moves: ["stockpile"],
          position: { x: 2, y: 4 },
          direction: "east",
          stockpileCount: 2,
        },
      ],
    },
    { control: "passive", members: [{ pokemon: "snorlax", position: { x: 0, y: 0 } }] },
  ],
} as const;

/** Délestage (`unburden`, plan 163) — Vitesse ×2 une fois l'objet perdu/consommé, ici forcée via
 *  `unburdenActive: true` sur l'instance. Deux mons de MÊME espèce (Florizarre, Vit de base 80) : SEUL
 *  le flag Délestage diffère (équipe 2). Harness hot-seat (les 2 équipes `player` → aucun auto-tour,
 *  cadence CT pilotée). ⚠️ Le mon actif au boot est FIGÉ à la création (avant l'application du flag) →
 *  l'équipe 1 (`p1-…`, gagnante des égalités d'id) ouvre le combat dans les 2 configs ; le ×2 se lit
 *  donc sur la CADENCE (qui rejoue en 3ᵉ après deux « Attendre »), pas sur l'actif du boot. La Vitesse
 *  alimente une courbe log → le ×2 n'est pas un doublement de gain mais rend le porteur strictement
 *  plus rapide → l'équipe 2 reprend la main en 3ᵉ. Aucun jet → déterministe (seed fixe). */
export const UNBURDEN_ACTS_FIRST = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [{ pokemon: "venusaur", position: { x: 2, y: 4 }, direction: "north" }],
    },
    {
      control: "player",
      members: [
        { pokemon: "venusaur", position: { x: 4, y: 4 }, direction: "south", unburdenActive: true },
      ],
    },
  ],
} as const;

/** Témoin du flip Délestage : MÊME setup mais SANS `unburdenActive` → à Vitesse de base égale,
 *  l'alternance rend la main à l'équipe 1 (`p1-…`, gagnante des égalités d'id) en 3ᵉ tour. Comparé à
 *  UNBURDEN_ACTS_FIRST, prouve que c'est bien le ×2 (et non un biais d'id/position) qui fait rejouer
 *  l'équipe 2 plus tôt. */
export const UNBURDEN_BASELINE = {
  seed: 12345,
  teams: [
    {
      control: "player",
      members: [{ pokemon: "venusaur", position: { x: 2, y: 4 }, direction: "north" }],
    },
    {
      control: "player",
      members: [{ pokemon: "venusaur", position: { x: 4, y: 4 }, direction: "south" }],
    },
  ],
} as const;

// Physique de terrain (§5.17-5.20, plan e2e terrain) — les dégâts de hauteur / chute / DoT de terrain
// ne sont PAS journalisés (test-plan : « dégâts via HP non journalisés ») → on les lit par les PV
// (barre de vie InfoPanel `role="progressbar"` → `aria-valuenow`) et par la tuile finale des sprites
// (`spriteStates().tile`). Déterministe : seed fixe + hauteurs/terrains figés par les maps dev.

// --- §5.17 modificateur de dégâts par hauteur — sur `sandbox-fall-1` (plateau cols 0-2 à h2.0, sol
// cols 3-5 à h1.0 ; la glace du plateau est en row 2, on reste donc en row 1). Même Griffe (Single 1-1,
// 100 % précision), même seed, même cible endurante (Ronflex) : seul l'écart de hauteur change le
// dégât (±10 %/niveau). Chaque paire garde le MÊME axe/sens d'attaque pour que le modificateur de face
// s'annule. Le lanceur Florizarre force Griffe (défaut DUEL). ---

/** Attaquant plus HAUT d'un niveau (plateau (2,1) h2.0 → cible sol (3,1) h1.0, attaque vers l'est) →
 *  ×1.1. À comparer à {@link HEIGHT_DMG_FLAT_EAST} (même axe est, Δh=0). */
export const HEIGHT_DMG_HIGH = {
  ...DUEL,
  moves: ["scratch"],
  playerPosition: { x: 2, y: 1 },
  playerDirection: "east",
  dummyPosition: { x: 3, y: 1 },
  dummyPokemon: "snorlax",
  dummyHp: 999,
  mapUrl: "assets/maps/dev/sandbox-fall-1.tmj",
} as const;

/** Témoin à plat pour la paire EST (sol (3,1) h1.0 → sol (4,1) h1.0, attaque vers l'est, Δh=0 → ×1.0). */
export const HEIGHT_DMG_FLAT_EAST = {
  ...HEIGHT_DMG_HIGH,
  playerPosition: { x: 3, y: 1 },
  dummyPosition: { x: 4, y: 1 },
} as const;

/** Attaquant plus BAS d'un niveau (sol (3,1) h1.0 → cible plateau (2,1) h2.0, attaque vers l'ouest) →
 *  ×0.9. À comparer à {@link HEIGHT_DMG_FLAT_WEST} (même axe ouest, Δh=0). */
export const HEIGHT_DMG_LOW = {
  ...HEIGHT_DMG_HIGH,
  playerPosition: { x: 3, y: 1 },
  playerDirection: "west",
  dummyPosition: { x: 2, y: 1 },
} as const;

/** Témoin à plat pour la paire OUEST (sol (4,1) h1.0 → sol (3,1) h1.0, attaque vers l'ouest, Δh=0). */
export const HEIGHT_DMG_FLAT_WEST = {
  ...HEIGHT_DMG_HIGH,
  playerPosition: { x: 4, y: 1 },
  playerDirection: "west",
  dummyPosition: { x: 3, y: 1 },
} as const;

// --- §5.18 table de chute (non létale) — repoussé par-dessus une falaise sur `sandbox-fall-2`
// (plateau h3.0 → sol h1.0 = 2 niveaux → 33 %) et `sandbox-fall-3` (h4.0 → h1.0 = 3 niveaux → 66 %).
// Draco-Queue (Slash + Knockback 1) frappe et repousse la cible hors du plateau (row 1, hors glace).
// Le dégât du MOVE est identique (mêmes espèces/seed, Δh=0 sur le plateau) → la différence de PV entre
// fall-2 et fall-3 isole la table (66 % − 33 %). seed 7 : Draco-Queue (90 %) touche. ---

/** Chute de 2 niveaux → 33 % PV. Ronflex endurant (hp 999) survit au coup + à la chute. */
export const FALL_TABLE_2 = {
  ...DUEL,
  seed: 7,
  moves: ["dragon-tail"],
  playerPosition: { x: 1, y: 1 },
  playerDirection: "east",
  dummyPosition: { x: 2, y: 1 },
  dummyPokemon: "snorlax",
  dummyHp: 999,
  mapUrl: "assets/maps/dev/sandbox-fall-2.tmj",
} as const;

/** Chute de 3 niveaux → 66 % PV (même setup, falaise plus haute). */
export const FALL_TABLE_3 = {
  ...FALL_TABLE_2,
  mapUrl: "assets/maps/dev/sandbox-fall-3.tmj",
} as const;

/** §5.18 glissade sur la glace — `sandbox-flat` a une colonne de glace en x=1 (y=2 et y=3). Le lanceur
 *  Florizarre est au NORD (1,0) de la cible Ronflex (1,1) ; Draco-Queue la repousse d'UNE case au sud
 *  sur (1,2) glace, puis elle GLISSE dans l'élan (sud) sur (1,3) glace et s'arrête sur (1,4) normal —
 *  soit 3 cases pour un repoussé de 1. La tuile finale (`spriteStates().tile` = (1,4)) prouve la
 *  glissade (au-delà de l'adjacence). Ronflex endurant survit. seed 7 → Draco-Queue touche. */
export const ICE_SLIDE = {
  ...DUEL,
  seed: 7,
  moves: ["dragon-tail"],
  playerPosition: { x: 1, y: 0 },
  playerDirection: "south",
  dummyPosition: { x: 1, y: 1 },
  dummyPokemon: "snorlax",
  dummyHp: 999,
} as const;

/** §5.18 immunité au repoussé — un Volant/immunisé au terrain d'ARRIVÉE n'est PAS déplacé. Le lanceur
 *  Florizarre (0,3) repousse Dracaufeu (0,4) vers le sud : la case d'arrivée (0,5) est de la LAVE
 *  (impassable) et Dracaufeu (Feu/Vol) y est immunisé → le repoussé est bloqué, sa tuile reste (0,4).
 *  `spriteStates().tile` inchangée + AUCUNE ligne « repoussé ». seed 7 → Draco-Queue touche. */
export const KNOCKBACK_IMMUNE_FLYER = {
  ...DUEL,
  seed: 7,
  moves: ["dragon-tail"],
  playerPosition: { x: 0, y: 3 },
  playerDirection: "south",
  dummyPokemon: "charizard",
  dummyPosition: { x: 0, y: 4 },
  dummyHp: 999,
} as const;

/** §5.18 recul mortel — Damoclès (`double-edge`, Single 1-1, 100 % précision, recul 1/3). Le lanceur
 *  Florizarre démarre à 1 % PV : le coup blesse le Ronflex endurant (hp 999, survit → c'est bien le
 *  RECUL, pas la riposte, qui tue) puis le recul met le LANCEUR K.O. → journal « Florizarre est K.O. ».
 *  100 % précision → déterministe (seed DUEL hérité), le lanceur agit au tour 1 (avant toute fin de tour). */
export const RECOIL_SELF_KO = {
  ...DUEL,
  moves: ["double-edge"],
  hp: 1,
  dummyPokemon: "snorlax",
  dummyHp: 999,
} as const;

// --- §5.20 effets de terrain lisibles par PV (sur `sandbox-flat`) ---

/** DoT Magma 1/16 en fin de tour. Le SUJET est le dummy Ronflex posé sur le magma (5,2), en HOT-SEAT
 *  (`dummyControl: "player"`) : le tour s'arrête à chaque décision, donc après avoir passé le tour du
 *  dummy on lit ses PV APRÈS exactement UN tick de terrain et AVANT que sa brûlure (posée par le magma)
 *  ne tique à son prochain début de tour → perte isolée = `floor(maxHp/16)`. Le joueur Florizarre est
 *  hors terrain (0,0) ; il joue en premier (plus rapide), d'où l'ordre Florizarre → Ronflex → Florizarre
 *  (cadence CT alternée). Aucun jet → déterministe. */
export const MAGMA_DOT = {
  ...DUEL,
  moves: ["scratch"],
  playerPosition: { x: 0, y: 0 },
  playerDirection: "south",
  dummyPokemon: "snorlax",
  dummyControl: "player",
  dummyMoves: ["tackle"],
  dummyPosition: { x: 5, y: 2 },
  dummyHp: 999,
} as const;

/** Bonus de puissance ×1.15 — un move du TYPE du terrain sous le LANCEUR gagne ×1.15. Florizarre (non
 *  Feu/Vol → pas immunisé au magma) lance Poing Feu (`fire-punch`, Feu, Single 1-1, 100 % précision)
 *  depuis une case MAGMA (5,2) sur le Ronflex endurant (5,3) → dégât boosté. À comparer à
 *  {@link TERRAIN_POWER_BONUS_BASELINE} (même move/seed/axe depuis une case NORMALE). Seul le terrain
 *  du lanceur change → la cible perd STRICTEMENT plus de PV sur magma. */
export const TERRAIN_POWER_BONUS_MAGMA = {
  ...DUEL,
  moves: ["fire-punch"],
  playerPosition: { x: 5, y: 2 },
  playerDirection: "south",
  dummyPokemon: "snorlax",
  dummyPosition: { x: 5, y: 3 },
  dummyHp: 999,
} as const;

/** Témoin du bonus de terrain : même Poing Feu depuis une case NORMALE (0,0) → cible (0,1), même axe
 *  d'attaque (sud), même géométrie → ×1.0. Comparé à {@link TERRAIN_POWER_BONUS_MAGMA}, prouve que
 *  c'est bien le magma sous le lanceur (et non le seed/la position) qui augmente le dégât. */
export const TERRAIN_POWER_BONUS_BASELINE = {
  ...TERRAIN_POWER_BONUS_MAGMA,
  playerPosition: { x: 0, y: 0 },
  dummyPosition: { x: 0, y: 1 },
} as const;

// --- §5.19 immunités du Volant aux terrains (sur `sandbox-flat`) ---

/** Un Volant posé sur la LAVE (0,5) — mortelle au sol en fin de tour — y SURVIT (immunité de terrain).
 *  Dracaufeu passe le tour ; ses PV restent pleins et aucune ligne « K.O. » n'est émise pour lui. */
export const FLYER_ON_LAVA = {
  ...DUEL,
  pokemon: "charizard",
  playerPosition: { x: 0, y: 5 },
  dummyPosition: { x: 3, y: 0 },
} as const;

/** Un Volant posé sur le MAGMA (5,2) — qui brûle au sol — n'est PAS brûlé (immunité de terrain).
 *  Dracaufeu passe le tour ; aucune ligne « brûlé par le magma » et ses PV restent pleins. */
export const FLYER_ON_MAGMA = {
  ...DUEL,
  pokemon: "charizard",
  playerPosition: { x: 5, y: 2 },
  dummyPosition: { x: 3, y: 0 },
} as const;

/** §5.19 pas de glissade pour le Volant — Dracaufeu repoussé sur la glace (1,2) ne glisse PAS (immunité
 *  glace du Volant) : sa tuile finale reste (1,2), à comparer au Ronflex qui glisse jusqu'à (1,4)
 *  ({@link ICE_SLIDE}). Même setup de repoussé (Draco-Queue depuis (1,0), seed 7). */
export const FLYER_ICE_NO_SLIDE = {
  ...DUEL,
  seed: 7,
  moves: ["dragon-tail"],
  playerPosition: { x: 1, y: 0 },
  playerDirection: "south",
  dummyPokemon: "charizard",
  dummyPosition: { x: 1, y: 1 },
  dummyHp: 999,
} as const;
