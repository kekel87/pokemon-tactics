import type { Page } from "@playwright/test";

/*
 * Deux équipes 6v6 pour la séquence d'intro (plan 194).
 *
 * Injectées dans `localStorage` AVANT le boot, donc l'éditeur d'équipe s'ouvre déjà peuplé : la
 * séquence peut le *montrer* (modèle du Pokemon, ses 4 attaques, son objet, son talent) sans avoir à
 * le *remplir* à l'écran, ce qui prendrait des dizaines d'actions et casserait au moindre changement
 * d'UI.
 *
 * ⚠️ Chaque identifiant ci-dessous a été sorti des données par script, jamais écrit de mémoire — les
 * 48 attaques sont vérifiées **apprenables** (`learnset`) ET **implémentées**
 * (`packages/core/src/battle/moves/*.test.ts`). Le nom anglais ne prédit pas l'identifiant : Voix
 * Envoûtante est `alluring-voice`, pas `disarming-voice`.
 */

/** Clé du magasin d'équipes de l'app (`packages/app/src/team/team-storage.ts`). */
const TEAMS_STORAGE_KEY = "pokemon-tactics:teams";

interface CaptureSlot {
  pokemonId: string;
  ability: string;
  nature: string;
  moveIds: string[];
  heldItemId?: string;
}

/** Camp 1 — silhouettes iconiques, couverture Feu / Psy / Normal / Sol. */
const FLAMMES_ET_PSY: CaptureSlot[] = [
  {
    pokemonId: "charizard",
    ability: "blaze",
    nature: "timid",
    heldItemId: "life-orb",
    moveIds: ["flamethrower", "air-slash", "dragon-claw", "rock-slide"],
  },
  {
    pokemonId: "alakazam",
    ability: "synchronize",
    nature: "timid",
    heldItemId: "focus-sash",
    moveIds: ["psychic", "shadow-ball", "dazzling-gleam", "recover"],
  },
  {
    pokemonId: "snorlax",
    ability: "immunity",
    nature: "adamant",
    heldItemId: "leftovers",
    moveIds: ["body-slam", "crunch", "earthquake", "rest"],
  },
  {
    pokemonId: "nidoking",
    ability: "poison-point",
    nature: "adamant",
    heldItemId: "expert-belt",
    moveIds: ["earthquake", "sludge-bomb", "rock-slide", "megahorn"],
  },
  {
    pokemonId: "arcanine",
    ability: "intimidate",
    nature: "jolly",
    heldItemId: "choice-band",
    moveIds: ["flare-blitz", "crunch", "wild-charge", "extreme-speed"],
  },
];

/*
 * Cinq membres seulement dans la première équipe, volontairement : le 6ᵉ slot reste VIDE pour que la
 * séquence d'intro le remplisse à l'écran. Ça montre la grille des 151 Pokemon, et « compléter son
 * équipe » se lit mieux que « en retirer un pour en remettre un ».
 */

/** Camp 2 — le contre naturel : Eau, Combat, Plante, Spectre, Roche, Électrik. */
const CROCS_ET_POINGS: CaptureSlot[] = [
  {
    pokemonId: "gyarados",
    ability: "intimidate",
    nature: "adamant",
    heldItemId: "life-orb",
    moveIds: ["waterfall", "crunch", "earthquake", "ice-fang"],
  },
  {
    pokemonId: "machamp",
    ability: "guts",
    nature: "adamant",
    heldItemId: "flame-orb",
    moveIds: ["close-combat", "rock-slide", "bullet-punch", "knock-off"],
  },
  {
    pokemonId: "venusaur",
    ability: "overgrow",
    nature: "bold",
    heldItemId: "black-sludge",
    moveIds: ["giga-drain", "sludge-bomb", "earthquake", "sleep-powder"],
  },
  {
    pokemonId: "gengar",
    ability: "cursed-body",
    nature: "timid",
    heldItemId: "choice-specs",
    moveIds: ["shadow-ball", "sludge-bomb", "thunderbolt", "hypnosis"],
  },
  {
    pokemonId: "rhydon",
    ability: "lightning-rod",
    nature: "adamant",
    heldItemId: "rocky-helmet",
    moveIds: ["earthquake", "rock-slide", "megahorn", "crunch"],
  },
  {
    pokemonId: "jolteon",
    ability: "volt-absorb",
    nature: "timid",
    heldItemId: "scope-lens",
    moveIds: ["thunderbolt", "shadow-ball", "volt-switch", "alluring-voice"],
  },
];

/*
 * Horodatages FIXES, pas `Date.now()` : une séquence de capture doit produire deux fois le même
 * `localStorage`, sinon un « build créé le … » affiché à l'écran changerait d'un run à l'autre.
 */
const FIXED_CREATED_AT = 1_756_000_000_000;

function buildTeam(id: string, name: string, slots: CaptureSlot[]) {
  return {
    id,
    name,
    format: "6v6",
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_CREATED_AT,
    slots: slots.map((slot) => ({
      pokemonId: slot.pokemonId,
      ability: slot.ability,
      nature: slot.nature,
      moveIds: slot.moveIds,
      ...(slot.heldItemId === undefined ? {} : { heldItemId: slot.heldItemId }),
      // Répartition neutre : la vitrine montre des builds lisibles, pas une optimisation
      // compétitive. `SP_TOTAL_MAX` vaut 66, donc 11 par statistique reste dans le budget.
      statSpread: { hp: 11, attack: 11, defense: 11, spAttack: 11, spDefense: 11, speed: 11 },
    })),
  };
}

const TEAMS = [
  buildTeam("capture-flammes-psy", "Blaze & Psy", FLAMMES_ET_PSY),
  buildTeam("capture-crocs-poings", "Fangs & Fists", CROCS_ET_POINGS),
];

/*
 * Enveloppe attendue par `packages/app/src/team/team-storage.ts` : `{ version, teams }` où `teams` est
 * un DICTIONNAIRE indexé par id, pas un tableau. Et `version` doit valoir exactement
 * `SCHEMA_VERSION` (1) — le lecteur jette silencieusement tout ce qui ne correspond pas et renvoie un
 * magasin vide, ce qui donne un écran « Mes équipes » sans aucune carte et sans le moindre message
 * d'erreur. C'est précisément ce qui est arrivé au premier run.
 */
const CAPTURE_TEAMS_PAYLOAD = {
  version: 1,
  teams: Object.fromEntries(TEAMS.map((team) => [team.id, team])),
};

/** Identifiants de camp, tels que le pilote de combat les compare. Arbitraires mais stables. */
export const CAPTURE_SIDE_1 = "p1";
const CAPTURE_SIDE_2 = "p2";

/**
 * Table Pokemon → camp, construite depuis les rosters ci-dessus.
 *
 * Pourquoi elle existe : le hook de scène expose `pokemonId` = l'identifiant de **définition**
 * (« snorlax »), pas l'identifiant d'instance (« p1-snorlax »). Rien dans `spriteStates()` ne dit donc
 * à quel camp appartient un sprite, et le déduire d'un préfixe d'id donne un camp par Pokemon : le
 * pilote de combat a passé plusieurs runs à **attaquer ses propres alliés**, ce que la trace de visée a
 * fini par montrer. La capture, elle, sait exactement qui est de quel côté — c'est donc elle qui le dit.
 *
 * ⚠️ Suppose que les deux rosters ne partagent **aucun** Pokemon. Le contraire est refusé ici plutôt
 * que résolu au hasard : deux Dracaufeu, un par camp, rendraient la table ambiguë sans le dire.
 */
export function buildSideByPokemonId(
  extraSide1PokemonIds: readonly string[] = [],
): Map<string, string> {
  const sides = new Map<string, string>();
  for (const slot of FLAMMES_ET_PSY) {
    sides.set(slot.pokemonId, CAPTURE_SIDE_1);
  }
  for (const pokemonId of extraSide1PokemonIds) {
    sides.set(pokemonId, CAPTURE_SIDE_1);
  }
  for (const slot of CROCS_ET_POINGS) {
    if (sides.has(slot.pokemonId)) {
      throw new Error(
        `« ${slot.pokemonId} » est dans les deux équipes de capture : le camp devient indevinable`,
      );
    }
    sides.set(slot.pokemonId, CAPTURE_SIDE_2);
  }
  return sides;
}

/**
 * Pose les deux équipes avant le premier script de la page, donc avant que l'app lise son magasin.
 * `addInitScript` s'applique aussi aux navigations suivantes — l'injection survit à un rechargement.
 */
export async function seedCaptureTeams(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, payload]: [string, string]) => {
      window.localStorage.setItem(key, payload);
    },
    [TEAMS_STORAGE_KEY, JSON.stringify(CAPTURE_TEAMS_PAYLOAD)] as [string, string],
  );
}
