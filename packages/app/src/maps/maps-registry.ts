export interface MapEntry {
  id: string;
  url: string;
  displayName: { fr: string; en: string };
  description: { fr: string; en: string };
  size: string;
  tags: string[];
}

export const MAPS_REGISTRY: MapEntry[] = [
  {
    id: "simple-arena",
    url: "assets/maps/simple-arena.tmj",
    displayName: { fr: "Arène Simple", en: "Simple Arena" },
    description: {
      fr: "Terrain plat, idéal pour découvrir les mécaniques.",
      en: "Flat terrain, ideal for learning the mechanics.",
    },
    size: "12×20",
    tags: [],
  },
  {
    id: "forest",
    url: "assets/maps/forest.tmj",
    displayName: { fr: "Forêt Dense", en: "Dense Forest" },
    description: {
      fr: "Hautes herbes omniprésentes, clairières stratégiques, barrières d'arbres.",
      en: "Tall grass everywhere, strategic clearings, tree barriers.",
    },
    size: "14×14",
    tags: ["herbe haute", "dénivelé"],
  },
  {
    id: "cramped-cave",
    url: "assets/maps/cramped-cave.tmj",
    displayName: { fr: "Grotte Exiguë", en: "Cramped Cave" },
    description: {
      fr: "Couloirs étroits autour d'un bloc central de rochers. Embuscades garanties.",
      en: "Tight corridors around a central rock block. Ambushes guaranteed.",
    },
    size: "12×12",
    tags: ["couloirs", "dénivelé"],
  },
  {
    id: "volcano",
    url: "assets/maps/volcano.tmj",
    displayName: { fr: "Volcan Actif", en: "Active Volcano" },
    description: {
      fr: "Cratère central en lave impassable. Magma brûlant sur les flancs.",
      en: "Central lava crater, impassable. Burning magma on the slopes.",
    },
    size: "14×14",
    tags: ["lave", "magma", "dénivelé"],
  },
  {
    id: "swamp",
    url: "assets/maps/swamp.tmj",
    displayName: { fr: "Tourbière", en: "Swamp" },
    description: {
      fr: "Marécage empoisonné, étang central, îlots secs comme refuges.",
      en: "Poisonous swamp, central pond, dry islands as safe spots.",
    },
    size: "14×14",
    tags: ["poison", "eau", "herbe haute"],
  },
  {
    id: "desert",
    url: "assets/maps/desert.tmj",
    displayName: { fr: "Dunes et Ruines", en: "Dunes and Ruins" },
    description: {
      fr: "Dunes aux quatre coins, ruines centrales avec piliers bloquant la vue.",
      en: "Dunes in each corner, central ruins with line-of-sight pillars.",
    },
    size: "14×14",
    tags: ["dénivelé", "sable"],
  },
  {
    id: "naval-arena",
    url: "assets/maps/naval-arena.tmj",
    displayName: { fr: "Archipel des Pontons", en: "Pontoon Archipelago" },
    description: {
      fr: "Eau profonde partout. Trois pontons reliés par des passerelles. Chaque chute = KO.",
      en: "Deep water everywhere. Three pontoons linked by bridges. Every fall = KO.",
    },
    size: "14×14",
    tags: ["eau profonde", "chutes"],
  },
  {
    id: "toundra",
    url: "assets/maps/toundra.tmj",
    displayName: { fr: "Toundra", en: "Tundra" },
    description: {
      fr: "Plaine enneigée ouverte. Plaques de glace glissantes, rochers dispersés.",
      en: "Open snowy plain. Slippery ice patches, scattered rocks.",
    },
    size: "12×12",
    tags: ["neige", "glace"],
  },
];
