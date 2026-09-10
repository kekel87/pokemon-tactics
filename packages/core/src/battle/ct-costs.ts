import { EffectTier } from "../enums/effect-tier";

const CT_THRESHOLD = 1000;
const CT_START = 600;
const CT_WAIT = 350;
const CT_MOVE_ONLY = 400;
const CT_COMBO_DISCOUNT = 150;

export { CT_START, CT_THRESHOLD, CT_WAIT };

/**
 * Paliers de `floor(20 * ln(baseStat + 1))`, tabulés sur 1..`CT_LOG_DOMAIN_MAX` (plan 203, Lot B4).
 *
 * Remplace un `Math.log`, dont ECMAScript ne garantit aucun résultat au bit près : deux navigateurs
 * peuvent différer sur le dernier bit et, le résultat passant par `Math.floor`, basculer de part et
 * d'autre d'un entier — coût CT différent, donc ordre des tours différent, donc deux parties qui
 * divergent au premier tour.
 *
 * 🔴 **Ce n'était pas un bug qui mordait.** Mesuré sur le domaine réel (vitesse de base max du
 * roster 200, ×2 Poudre Vive, ×2 Délestage → 1..800) : la valeur la plus proche d'un entier en est
 * à 4,95 × 10⁻⁴, quand un écart de dernier bit vaut ~3 × 10⁻¹⁴. Dix ordres de grandeur de marge, le
 * basculement est inatteignable. Mais cette marge est une propriété du **roster**, pas du code :
 * personne ne surveillerait sa disparition si un Pokémon plus rapide arrivait. La table rend
 * permanent ce qui n'était qu'une coïncidence heureuse.
 *
 * 🔴 **Écrite en dur, jamais calculée au chargement** : la générer avec le `Math.log` local
 * remettrait le problème en place. Régénération : `node scripts/generate-ct-log-table.mjs`.
 * `ct-costs.test.ts` la vérifie exhaustivement contre l'ancienne formule et échoue si le roster
 * dépasse le domaine.
 */
export const CT_LOG_STEPS: readonly (readonly [number, number])[] = [
  [1, 13],
  [2, 21],
  [3, 27],
  [4, 32],
  [5, 35],
  [6, 38],
  [7, 41],
  [8, 43],
  [9, 46],
  [10, 47],
  [11, 49],
  [12, 51],
  [13, 52],
  [14, 54],
  [15, 55],
  [16, 56],
  [17, 57],
  [18, 58],
  [19, 59],
  [20, 60],
  [21, 61],
  [22, 62],
  [23, 63],
  [24, 64],
  [25, 65],
  [27, 66],
  [28, 67],
  [29, 68],
  [31, 69],
  [33, 70],
  [34, 71],
  [36, 72],
  [38, 73],
  [40, 74],
  [42, 75],
  [44, 76],
  [46, 77],
  [49, 78],
  [51, 79],
  [54, 80],
  [57, 81],
  [60, 82],
  [63, 83],
  [66, 84],
  [70, 85],
  [73, 86],
  [77, 87],
  [81, 88],
  [85, 89],
  [90, 90],
  [94, 91],
  [99, 92],
  [104, 93],
  [109, 94],
  [115, 95],
  [121, 96],
  [127, 97],
  [134, 98],
  [141, 99],
  [148, 100],
  [156, 101],
  [164, 102],
  [172, 103],
  [181, 104],
  [190, 105],
  [200, 106],
  [210, 107],
  [221, 108],
  [232, 109],
  [244, 110],
  [257, 111],
  [270, 112],
  [284, 113],
  [298, 114],
  [314, 115],
  [330, 116],
  [347, 117],
  [365, 118],
  [383, 119],
  [403, 120],
  [424, 121],
  [445, 122],
  [468, 123],
  [492, 124],
  [518, 125],
  [544, 126],
  [572, 127],
  [601, 128],
  [632, 129],
  [665, 130],
  [699, 131],
  [735, 132],
  [772, 133],
  [812, 134],
  [854, 135],
  [897, 136],
  [943, 137],
  [992, 138],
  [1043, 139],
  [1096, 140],
  [1152, 141],
  [1211, 142],
  [1274, 143],
  [1339, 144],
  [1408, 145],
  [1480, 146],
  [1556, 147],
  [1635, 148],
  [1719, 149],
  [1808, 150],
  [1900, 151],
  [1998, 152],
];

/** Borne haute tabulée. Au-delà, le dernier palier s'applique — voir `ctLogStep`. */
export const CT_LOG_DOMAIN_MAX = 2048;

/**
 * Le palier sous le premier seuil. Inatteignable en pratique — le premier seuil est `baseStat` 1 et
 * aucun chemin de production ne descend en dessous — mais il faut bien une valeur de départ, et une
 * constante nommée dit mieux qu'un `CT_LOG_STEPS[0]![1]` d'où elle vient.
 */
const CT_LOG_FIRST_STEP = 13;

/**
 * Le palier tabulé pour `baseStat`.
 *
 * Balayage linéaire des 112 paliers, et non une dichotomie : la dichotomie demandait quatre accès
 * indexés donc quatre assertions de non-nullité (`noNonNullAssertion`), pour économiser une centaine
 * de comparaisons d'entiers sur un chemin appelé quelques fois par tour. Le parcours par
 * déstructuration n'en demande aucune. Il suppose les seuils **croissants**, ce que le générateur
 * garantit et que `ct-costs.test.ts` vérifie.
 *
 * Replis, tous déterministes et aucun ne rappelle `Math.log` : une entrée non entière est ramenée à
 * son plancher (aucun chemin de production n'en produit — `effectiveBaseSpeed` part d'une vitesse
 * entière doublée, `invertedDistortionSpeed` d'une soustraction bornée à 1) ; en dessous du domaine
 * c'est le premier palier, au-dessus le dernier. Le dépassement par le haut sous-estimerait le gain,
 * d'où le test qui échoue avant qu'un roster puisse l'atteindre.
 */
function ctLogStep(baseStat: number): number {
  const clamped = Math.floor(baseStat);
  let step = CT_LOG_FIRST_STEP;
  for (const [threshold, value] of CT_LOG_STEPS) {
    if (threshold > clamped) {
      break;
    }
    step = value;
  }
  return step;
}

export function computeCtGain(baseStat: number, speedStages: number): number {
  const base = 30 + ctLogStep(baseStat);
  const s = speedStages * 0.7;
  const softMult = s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  return Math.floor(base * softMult);
}

export function ppCost(pp: number): number {
  if (pp >= 20) {
    return 500;
  }
  if (pp >= 16) {
    return 600;
  }
  if (pp >= 12) {
    return 700;
  }
  return 900;
}

export function powerFloor(power: number): number {
  if (power >= 110) {
    return 900;
  }
  if (power >= 90) {
    return 700;
  }
  if (power >= 70) {
    return 600;
  }
  return 0;
}

const EFFECT_FLOOR_BY_TIER: Record<EffectTier, number> = {
  [EffectTier.Reactive]: 500,
  [EffectTier.MajorStatus]: 700,
  [EffectTier.MajorBuff]: 600,
  [EffectTier.DoubleBuff]: 550,
};

export function effectFloor(tier: EffectTier | undefined): number {
  if (tier === undefined) {
    return 0;
  }
  return EFFECT_FLOOR_BY_TIER[tier];
}

export function computeMoveCost(pp: number, power: number, tier: EffectTier | undefined): number {
  if (tier === EffectTier.Reactive) {
    return 500;
  }
  return Math.max(ppCost(pp), powerFloor(power), effectFloor(tier));
}

/** Number of pips on the move "tempo" gauge (UI): how heavy this move's Charge Time cost is. */
export const CT_TEMPO_MAX = 5;

/**
 * Map a move's Charge Time cost to a 1..5 "tempo" rating for display. Higher = heavier = the user
 * waits longer before its next turn. Lets players read the CT economy without raw cost numbers.
 */
export function moveCtTempo(pp: number, power: number, tier: EffectTier | undefined): number {
  const cost = computeMoveCost(pp, power, tier);
  if (cost <= 500) {
    return 1;
  }
  if (cost <= 600) {
    return 2;
  }
  if (cost <= 700) {
    return 3;
  }
  if (cost <= 800) {
    return 4;
  }
  return CT_TEMPO_MAX;
}

export function computeCtActionCost(
  hasMoved: boolean,
  hasActed: boolean,
  moveCost: number,
): number {
  if (!hasMoved && !hasActed) {
    return CT_WAIT;
  }
  if (hasMoved && !hasActed) {
    return CT_MOVE_ONLY;
  }
  if (!hasMoved && hasActed) {
    return moveCost;
  }
  return CT_MOVE_ONLY + moveCost - CT_COMBO_DISCOUNT;
}
