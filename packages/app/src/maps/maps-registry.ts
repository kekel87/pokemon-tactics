import type { LocalizedText } from "@pokemon-tactic/core";

export interface MapEntry {
  id: string;
  url: string;
  displayName: LocalizedText;
  description: LocalizedText;
  size: string;
  /** Étiquettes de terrain, traduites comme `displayName`/`description` : elles s'affichent
   *  telles quelles sous le nom de la carte, donc un `string[]` français fuitait en anglais. */
  tags: LocalizedText[];
}

export const MAPS_REGISTRY: MapEntry[] = [
  {
    id: "simple-arena",
    url: "assets/maps/simple-arena.tmj",
    displayName: { fr: "Arène Simple", en: "Simple Arena", es: "Arena Sencilla" },
    description: {
      fr: "Terrain plat, idéal pour découvrir les mécaniques.",
      en: "Flat terrain, ideal for learning the mechanics.",
      es: "Terreno llano, ideal para descubrir las mecánicas.",
    },
    size: "12×20",
    tags: [],
  },
  {
    id: "forest",
    url: "assets/maps/forest.tmj",
    displayName: { fr: "Forêt Dense", en: "Dense Forest", es: "Bosque Denso" },
    description: {
      fr: "Hautes herbes omniprésentes, clairières stratégiques, barrières d'arbres.",
      en: "Tall grass everywhere, strategic clearings, tree barriers.",
      es: "Hierba alta por todas partes, claros estratégicos, barreras de árboles.",
    },
    size: "14×14",
    tags: [
      { fr: "herbe haute", en: "tall grass", es: "hierba alta" },
      { fr: "dénivelé", en: "elevation", es: "desnivel" },
    ],
  },
  {
    id: "cramped-cave",
    url: "assets/maps/cramped-cave.tmj",
    displayName: { fr: "Grotte Exiguë", en: "Cramped Cave", es: "Cueva Angosta" },
    description: {
      fr: "Couloirs étroits autour d'un bloc central de rochers. Embuscades garanties.",
      en: "Tight corridors around a central rock block. Ambushes guaranteed.",
      es: "Pasillos estrechos alrededor de un bloque central de rocas. Emboscadas aseguradas.",
    },
    size: "12×12",
    tags: [
      { fr: "couloirs", en: "corridors", es: "pasillos" },
      { fr: "dénivelé", en: "elevation", es: "desnivel" },
    ],
  },
  {
    id: "volcano",
    url: "assets/maps/volcano.tmj",
    displayName: { fr: "Volcan Actif", en: "Active Volcano", es: "Volcán Activo" },
    description: {
      fr: "Cratère central en lave impassable. Magma brûlant sur les flancs.",
      en: "Central lava crater, impassable. Burning magma on the slopes.",
      es: "Cráter central de lava infranqueable. Magma ardiente en las laderas.",
    },
    size: "14×14",
    tags: [
      { fr: "lave", en: "lava", es: "lava" },
      { fr: "magma", en: "magma", es: "magma" },
      { fr: "dénivelé", en: "elevation", es: "desnivel" },
    ],
  },
  {
    id: "swamp",
    url: "assets/maps/swamp.tmj",
    displayName: { fr: "Tourbière", en: "Swamp", es: "Turbera" },
    description: {
      fr: "Marécage empoisonné, étang central, îlots secs comme refuges.",
      en: "Poisonous swamp, central pond, dry islands as safe spots.",
      es: "Ciénaga venenosa, estanque central, islotes secos como refugio.",
    },
    size: "14×14",
    tags: [
      { fr: "poison", en: "poison", es: "veneno" },
      { fr: "eau", en: "water", es: "agua" },
      { fr: "herbe haute", en: "tall grass", es: "hierba alta" },
    ],
  },
  {
    id: "desert",
    url: "assets/maps/desert.tmj",
    displayName: { fr: "Dunes et Ruines", en: "Dunes and Ruins", es: "Dunas y Ruinas" },
    description: {
      fr: "Dunes aux quatre coins, ruines centrales avec piliers bloquant la vue.",
      en: "Dunes in each corner, central ruins with line-of-sight pillars.",
      es: "Dunas en cada esquina, ruinas centrales con pilares que tapan la vista.",
    },
    size: "14×14",
    tags: [
      { fr: "dénivelé", en: "elevation", es: "desnivel" },
      { fr: "sable", en: "sand", es: "arena" },
    ],
  },
  {
    id: "naval-arena",
    url: "assets/maps/naval-arena.tmj",
    displayName: {
      fr: "Archipel des Pontons",
      en: "Pontoon Archipelago",
      es: "Archipiélago de los Pontones",
    },
    description: {
      fr: "Eau profonde partout. Trois pontons reliés par des passerelles. Chaque chute = KO.",
      en: "Deep water everywhere. Three pontoons linked by bridges. Every fall = KO.",
      es: "Agua profunda por todas partes. Tres pontones unidos por pasarelas. Cada caída = K.O.",
    },
    size: "14×14",
    tags: [
      { fr: "eau profonde", en: "deep water", es: "agua profunda" },
      { fr: "chutes", en: "falls", es: "caídas" },
    ],
  },
  {
    id: "toundra",
    url: "assets/maps/toundra.tmj",
    displayName: { fr: "Toundra", en: "Tundra", es: "Tundra" },
    description: {
      fr: "Plaine enneigée ouverte. Plaques de glace glissantes, rochers dispersés.",
      en: "Open snowy plain. Slippery ice patches, scattered rocks.",
      es: "Llanura nevada abierta. Placas de hielo resbaladizas, rocas dispersas.",
    },
    size: "12×12",
    tags: [
      { fr: "neige", en: "snow", es: "nieve" },
      { fr: "glace", en: "ice", es: "hielo" },
    ],
  },
  {
    id: "le-mur",
    url: "assets/maps/le-mur.tmj",
    displayName: { fr: "Le Mur", en: "The Wall", es: "El Muro" },
    description: {
      fr: "Un mur de glace pyramidal domine le centre. Poussez vos adversaires dans le vide : sur la glace ils glissent, et du haut du mur la chute est fatale.",
      en: "A pyramidal ice wall towers over the center. Shove your foes into the void: on ice they slide, and from atop the wall the fall is lethal.",
      es: "Un muro de hielo piramidal domina el centro. Empuja a tus rivales al vacío: sobre el hielo resbalan, y desde lo alto del muro la caída es mortal.",
    },
    size: "16×16",
    tags: [
      { fr: "glace", en: "ice", es: "hielo" },
      { fr: "dénivelé", en: "elevation", es: "desnivel" },
      { fr: "chute", en: "fall", es: "caída" },
    ],
  },
];
