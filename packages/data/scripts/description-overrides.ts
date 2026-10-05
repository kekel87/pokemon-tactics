export type DescriptionOverride = { readonly en: string; readonly fr: string; readonly es: string };

/**
 * Descriptions written for the game when our mechanic deliberately departs from both PokeAPI and
 * Champions — usually a grid adaptation of "adjacent". Applied last, after the Champions overrides, to
 * the short AND long description in every language (plan 223).
 */
export const ABILITY_DESCRIPTION_OVERRIDES: Readonly<Record<string, DescriptionOverride>> = {
  // Champions rolls 50% for adjacent allies; on a grid we keep a radius of 2 tiles.
  healer: {
    en: "At the end of each turn, 50% chance to cure the major status of each ally within 2 tiles.",
    fr: "En fin de tour, 50 % de chances de soigner le statut majeur de chaque allié à 2 cases ou moins.",
    es: "Al final de cada turno, 50 % de probabilidad de curar el problema de estado de cada aliado a 2 casillas o menos.",
  },
  // Permanent positional aura (Chebyshev r1), restored when the enemy leaves or the holder faints.
  intimidate: {
    en: "Adjacent enemies have their Attack lowered by one stage while they stay next to the holder; it comes back as soon as they move away or the holder faints.",
    fr: "Les ennemis adjacents ont leur Attaque baissée d'un cran tant qu'ils restent à côté du porteur ; elle remonte dès qu'ils s'éloignent ou qu'il est K.O.",
    es: "Los enemigos adyacentes ven su Ataque reducido un nivel mientras sigan junto al portador; lo recuperan en cuanto se alejan o el portador se debilita.",
  },
  "magnet-pull": {
    en: "Adjacent Steel-type enemies cannot move while the holder stays next to them, but they can still attack.",
    fr: "Les ennemis de type Acier adjacents ne peuvent plus se déplacer tant que le porteur reste à côté d'eux, mais peuvent toujours attaquer.",
    es: "Los enemigos de tipo Acero adyacentes no pueden desplazarse mientras el portador siga junto a ellos, aunque aún pueden atacar.",
  },
  "arena-trap": {
    en: "Adjacent grounded enemies cannot move. Ghost types, Pokémon that fly or levitate, and those with Run Away escape it.",
    fr: "Les ennemis adjacents au sol ne peuvent plus se déplacer. Les Pokémon Spectre, ceux qui volent ou lévitent et ceux au talent Fuite y échappent.",
    es: "Los enemigos adyacentes que están en el suelo no pueden desplazarse. Los Pokémon de tipo Fantasma, los que vuelan o levitan y los que tienen Fuga se libran.",
  },
  // No switching: reinterpreted as a small heal on the holder's own turns (plan 136).
  regenerator: {
    en: "At the end of each of its turns, the holder restores 1/16 of its max HP.",
    fr: "À la fin de chacun de ses tours, le porteur récupère 1/16 de ses PV max.",
    es: "Al final de cada uno de sus turnos, el portador recupera 1/16 de sus PS máximos.",
  },
  // Relational, not field-wide: only when the holder is among the explosion's targets.
  damp: {
    en: "Self-Destruct, Explosion and Misty Explosion fail if the holder is among their targets. The holder also takes no Aftermath recoil.",
    fr: "Destruction, Explosion et Explo-Brume échouent si le porteur fait partie de leurs cibles. Le porteur ne subit pas non plus le contrecoup de Boom Final.",
    es: "Autodestrucción, Explosión y Bruma Explosiva fallan si el portador está entre sus objetivos. Además, el portador no sufre el daño de Detonación.",
  },
  // No PP: the surcharge is billed in CT (+50 per Pressure target, offensive moves only).
  pressure: {
    en: "Every damaging move that targets the holder costs its user 50 more CT.",
    fr: "Chaque capacité offensive qui vise le porteur coûte 50 CT de plus à son lanceur.",
    es: "Cada movimiento ofensivo que apunta al portador le cuesta 50 CT más a su usuario.",
  },
  "friend-guard": {
    en: "Allies within 2 tiles of the holder take 25% less damage.",
    fr: "Les alliés à 2 cases ou moins du porteur subissent 25 % de dégâts en moins.",
    es: "Los aliados a 2 casillas o menos del portador reciben un 25 % menos de daño.",
  },
  "neutralizing-gas": {
    en: "Neutralizes the ability of every other Pokémon, ally or enemy, within 2 tiles of the holder.",
    fr: "Neutralise le talent de tous les autres Pokémon, alliés comme ennemis, à 2 cases ou moins du porteur.",
    es: "Anula la habilidad de todos los demás Pokémon, aliados o enemigos, a 2 casillas o menos del portador.",
  },
  // Only engine use: exemption from Arena Trap (BattleEngine.isArenaTrapped).
  "run-away": {
    en: "Immune to Arena Trap. No other effect in this game.",
    fr: "Immunise contre Piège Sable. Sans autre effet dans ce jeu.",
    es: "Inmune a Trampa Arena. Sin otro efecto en este juego.",
  },
  pickup: {
    en: "No effect in this game.",
    fr: "Sans effet dans ce jeu.",
    es: "Sin efecto en este juego.",
  },
};

/**
 * Same contract as {@link ABILITY_DESCRIPTION_OVERRIDES}, for held items (plan 225): the official
 * text promises a rule our engine does not have (bench, switch-in, PP), or PokeAPI has no text at all
 * for the item.
 *
 * 🔴 The official text is the default (human, 2026-10-05, plan 226). An override needs a GAMEPLAY
 * difference: a duration counted in the holder's turns rather than the battle's is not one — the
 * weather rocks, Lumargile and Champ'Duit keep their official wording.
 */
export const ITEM_DESCRIPTION_OVERRIDES: Readonly<Record<string, DescriptionOverride>> = {
  // No bench: the spawn-zone teleport is the analogue of the canonical switch-out.
  "eject-button": {
    en: "When the holder takes damage from a move, it is teleported to a free tile of its starting zone, then the item is consumed.",
    fr: "Quand le porteur subit des dégâts d'une attaque, il est téléporté sur une case libre de sa zone de placement, puis l'objet est consommé.",
    es: "Cuando el portador recibe daño de un ataque, se teletransporta a una casilla libre de su zona de colocación y el objeto se consume.",
  },
  "red-card": {
    en: "When the holder takes damage from a move, the attacker is teleported to a free tile of its own starting zone, then the card is consumed.",
    fr: "Quand le porteur subit des dégâts d'une attaque, l'attaquant est téléporté sur une case libre de sa propre zone de placement, puis le carton est consommé.",
    es: "Cuando el portador recibe daño de un ataque, el atacante se teletransporta a una casilla libre de su propia zona de colocación y la tarjeta se consume.",
  },
  "choice-scarf": {
    en: "The holder fills its CT gauge 50% faster, but stays locked into the first move it uses.",
    fr: "Le porteur remplit sa jauge de CT 50 % plus vite, mais reste bloqué sur la première capacité qu'il utilise.",
    es: "El portador llena su barra de CT un 50 % más rápido, pero queda bloqueado en el primer movimiento que usa.",
  },
  // Seeds: checked at the end of the holder's turn, grounded and standing inside the matching zone.
  "electric-seed": {
    en: "At the end of its turn, if the holder stands on the ground in an Electric Terrain, its Defense rises by one stage and the seed is consumed.",
    fr: "À la fin de son tour, si le porteur se tient au sol dans un Champ Électrifié, sa Défense monte d'un cran et la graine est consommée.",
    es: "Al final de su turno, si el portador está en el suelo dentro de un Campo Eléctrico, su Defensa sube un nivel y la semilla se consume.",
  },
  "grassy-seed": {
    en: "At the end of its turn, if the holder stands on the ground in a Grassy Terrain, its Defense rises by one stage and the seed is consumed.",
    fr: "À la fin de son tour, si le porteur se tient au sol dans un Champ Herbu, sa Défense monte d'un cran et la graine est consommée.",
    es: "Al final de su turno, si el portador está en el suelo dentro de un Campo de Hierba, su Defensa sube un nivel y la semilla se consume.",
  },
  "psychic-seed": {
    en: "At the end of its turn, if the holder stands on the ground in a Psychic Terrain, its Special Defense rises by one stage and the seed is consumed.",
    fr: "À la fin de son tour, si le porteur se tient au sol dans un Champ Psychique, sa Défense Spéciale monte d'un cran et la graine est consommée.",
    es: "Al final de su turno, si el portador está en el suelo dentro de un Campo Psíquico, su Defensa Especial sube un nivel y la semilla se consume.",
  },
  "misty-seed": {
    en: "At the end of its turn, if the holder stands on the ground in a Misty Terrain, its Special Defense rises by one stage and the seed is consumed.",
    fr: "À la fin de son tour, si le porteur se tient au sol dans un Champ Brumeux, sa Défense Spéciale monte d'un cran et la graine est consommée.",
    es: "Al final de su turno, si el portador está en el suelo dentro de un Campo de Niebla, su Defensa Especial sube un nivel y la semilla se consume.",
  },
  // Snow is extended whichever move set it — Hail or Snowscape — and the official text names Hail only.
  "icy-rock": {
    en: "An item to be held by a Pokémon. It extends the duration of the moves Hail and Snowscape used by the holder.",
    fr: "Objet à tenir. Prolonge la durée des capacités Grêle et Chute de Neige utilisées par le porteur.",
    es: "Objeto que se puede llevar. Prolonga la duración de los movimientos Granizo y Paisaje Nevado que usa el portador.",
  },
  "mental-herb": {
    en: "Instantly cures the holder of Taunt, Encore, Disable, Heal Block or infatuation, then the herb is consumed.",
    fr: "Guérit aussitôt le porteur de Provoc, Encore, Entrave, Anti-Soin ou du statut Charmé, puis l'herbe est consommée.",
    es: "Libera al instante al portador de Mofa, Otra Vez, Anulación, Anticura o del enamoramiento, y la hierba se consume.",
  },
  // The five items below have no FR/ES text in PokeAPI: written from the engine rule.
  "fairy-feather": {
    en: "Boosts the power of the holder's Fairy-type moves by 20%.",
    fr: "Augmente de 20 % la puissance des capacités de type Fée du porteur.",
    es: "Aumenta un 20 % la potencia de los movimientos de tipo Hada del portador.",
  },
  "clear-amulet": {
    en: "Other Pokémon's moves cannot lower the holder's stats.",
    fr: "Les capacités des autres Pokémon ne peuvent pas baisser les statistiques du porteur.",
    es: "Los movimientos de otros Pokémon no pueden reducir las características del portador.",
  },
  "punching-glove": {
    en: "Boosts the power of the holder's punching moves by 10%, and they no longer make contact.",
    fr: "Augmente de 10 % la puissance des capacités de poing du porteur, qui ne sont plus des capacités de contact.",
    es: "Aumenta un 10 % la potencia de los movimientos de puño del portador, que dejan de ser de contacto.",
  },
  "loaded-dice": {
    en: "The holder's multi-hit moves always strike the maximum number of times.",
    fr: "Les capacités à coups multiples du porteur frappent toujours le nombre maximal de fois.",
    es: "Los movimientos de golpes múltiples del portador siempre golpean el número máximo de veces.",
  },
  "covert-cloak": {
    en: "Protects the holder from the added effects of moves that hit it.",
    fr: "Protège le porteur des effets secondaires des capacités qui le touchent.",
    es: "Protege al portador de los efectos secundarios de los movimientos que lo alcanzan.",
  },
};
