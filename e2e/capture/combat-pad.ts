import type { Page } from "@playwright/test";
import { PadButton, tapPadButton, waitForPadPoll } from "../pages/gamepad";
import { type PadDirection, padActivate, traceFocus, traceNote } from "./pad-nav";

/*
 * Pilotage du COMBAT à la manette pour la séquence d'intro (plan 194, volet combat).
 *
 * Séparé de `pad-nav.ts` parce que le combat ne se navigue pas comme un menu : hors des deux menus
 * (actions, liste d'attaques) les flèches ne déplacent pas un focus DOM mais un CURSEUR DE CASE sur
 * le plateau, et `document.activeElement` n'y bouge jamais. La signature de focus, seul repère de
 * `pad-nav`, y est donc aveugle — c'est l'état du jeu qu'il faut lire.
 *
 * Trois lectures suffisent à tout piloter, et elles viennent du hook e2e en LECTURE SEULE
 * (`__ptE2e__`, strippé des builds publiés) ou du DOM :
 * - `cursorTile()` — où est le curseur ;
 * - `spriteStates()` — qui est sur quelle case (donc où sont les adversaires) ;
 * - `combat-instruction` — dans quelle phase on est (« Select a target », « Confirm? »…).
 *
 * ⚠️ Jamais `clickTile()` : ce raccourci du hook court-circuite la couche d'entrée, et le premier
 * clic ferait basculer `data-input-source` sur la souris — le liseré de focus disparaîtrait de
 * l'image, ce que tout le volet manette cherche à éviter.
 */

type ScreenDirection = PadDirection;

const DPAD_BUTTON: Readonly<Record<ScreenDirection, number>> = {
  up: PadButton.DpadUp,
  down: PadButton.DpadDown,
  left: PadButton.DpadLeft,
  right: PadButton.DpadRight,
};

const ALL_DIRECTIONS: readonly ScreenDirection[] = ["up", "down", "left", "right"];

/**
 * Portée au-delà de laquelle on ne tente même pas de viser.
 *
 * La plus longue attaque du roster vitrine porte à quatre cases (l'infobulle l'affiche, « Range: 1-4 ») ;
 * cinq laisse une marge. Sert à deux endroits : la garde de visée, et le choix du tour qu'on filme.
 */
const MAX_ATTACK_REACH = 5;

/**
 * Les étapes que la séquence PILOTE, avec leur libellé anglais relevé dans `locales/en.ts`.
 *
 * Le catalogue complet des six étapes vit dans `INSTRUCTION_KEY` (`packages/ui-dom/src/battle-chrome.ts`)
 * — les trois autres (repli, destination de déplacement, case de retraite) n'ont pas de branche ici,
 * donc les recopier ne créerait qu'une seconde vérité à maintenir.
 */
export const Instruction = {
  selectTarget: "Select a target",
  aimDirection: "Pick a direction",
  selectDestination: "Where to move?",
  confirm: "Confirm?",
  selectFacing: "Pick a facing",
} as const;

export interface Tile {
  readonly x: number;
  readonly y: number;
}

export interface SpriteSnapshot {
  readonly pokemonId: string;
  readonly tile: Tile;
  /** Camp, résolu par la table fournie à `configureSides`. */
  readonly side: string;
}

/**
 * Table Pokemon → camp, posée par la séquence avant le combat.
 *
 * ⚠️ Le hook de scène expose `pokemonId` = l'identifiant de **définition** (« snorlax »), pas celui de
 * l'instance (« p1-snorlax ») : rien dedans ne dit le camp. Le déduire d'un préfixe donnait un camp
 * distinct par Pokemon, donc « tout le monde est un adversaire », donc un pilote qui **attaquait ses
 * propres alliés**. Mesuré par la trace de visée, après trois runs passés à en chercher la cause
 * ailleurs. La capture connaît ses deux rosters : elle les fournit.
 */
let sideByPokemonId: Map<string, string> | null = null;

export function configureSides(sides: Map<string, string>): void {
  sideByPokemonId = sides;
}

function sideOf(pokemonId: string): string {
  const side = sideByPokemonId?.get(pokemonId);
  if (side === undefined) {
    // Échec franc : un roster modifié sans mettre la table à jour ferait sinon frapper n'importe qui.
    throw new Error(
      `camp inconnu pour « ${pokemonId} » — la table de camps est-elle à jour ? ` +
        "(appeler `configureSides` avant le combat)",
    );
  }
  return side;
}

/** Case sous le curseur, ou `null` quand aucun curseur n'est posé (phase de menu). */
function cursorTile(page: Page): Promise<Tile | null> {
  return page.evaluate(
    () =>
      (
        globalThis as { __ptE2e__?: { cursorTile(): { x: number; y: number } | null } }
      ).__ptE2e__?.cursorTile() ?? null,
  );
}

/** Qui est où, camp compris. */
export async function sprites(page: Page): Promise<SpriteSnapshot[]> {
  const states = await page.evaluate(
    () =>
      (
        globalThis as {
          __ptE2e__?: { spriteStates(): { pokemonId: string; tile: { x: number; y: number } }[] };
        }
      ).__ptE2e__?.spriteStates() ?? [],
  );
  return states.map((state) => ({
    pokemonId: state.pokemonId,
    tile: state.tile,
    side: sideOf(state.pokemonId),
  }));
}

/**
 * Texte de la ligne d'instruction, ou `null` quand elle est masquée (donc qu'on est dans un menu).
 *
 * C'est le seul signal de phase lisible de l'extérieur : `inputContext()` vit dans l'orchestrateur,
 * que le hook e2e n'expose pas — et c'est très bien, il est en lecture seule sur la SCÈNE.
 */
export async function instruction(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>('[data-testid="combat-instruction"]');
    if (!node) {
      return null;
    }
    // La ligne entière est masquée par `hidden` sur son conteneur, pas sur le texte.
    const row = node.parentElement;
    if (row?.hidden === true) {
      return null;
    }
    return (node.textContent ?? "").trim();
  });
}

/** Libellés des entrées ACTIVABLES du menu d'actions (les grisées ne prennent pas le focus). */
export function actionMenuLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...(document
        .querySelector('[data-testid="action-menu"]')
        ?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
    ].map((button) => (button.textContent ?? "").trim()),
  );
}

/** Le combat est-il terminé ? (dialogue de victoire / match nul à l'écran) */
export function isBattleOver(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('[data-testid="battle-over"]') !== null);
}

/* ------------------------------------------------------------------ curseur de case */

/**
 * Correspondance direction d'écran → pas de grille, APPRISE à l'exécution.
 *
 * Elle n'est pas dérivable d'une table : `stepCursor` (render-babylon) projette les quatre voisins
 * de la case et garde celui qui colle le mieux au vecteur d'écran. Le pas dépend donc de l'azimut de
 * la caméra, de l'élévation, et se corrige de lui-même quand la vue tourne. On mesure au lieu de
 * supposer — et on jette la mesure dès que la caméra bouge (`resetCursorCalibration`).
 */
let cursorDeltas: Partial<Record<ScreenDirection, Tile>> = {};

/** Appelée après toute rotation de caméra : les pas mesurés ne valent plus. */
function resetCursorCalibration(): void {
  cursorDeltas = {};
}

function manhattan(from: Tile, to: Tile): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

/**
 * Presse une direction et renvoie le pas de grille observé, ou `null` si le curseur n'a pas bougé
 * (bord de plateau : `stepCursor` laisse le curseur sur place plutôt que de glisser le long du bord).
 *
 * Une TAPE et non un maintien : en combat la boucle de rendu Babylon tourne à plein régime, donc le
 * poller lit la manette à chaque frame — le piège des écrans sans rendu (`pad-nav.padMove`) ne
 * s'applique pas ici, et un maintien ferait partir la répétition automatique.
 */
async function pressCursorDirection(page: Page, direction: ScreenDirection): Promise<Tile | null> {
  const before = await cursorTile(page);
  if (!before) {
    throw new Error("aucun curseur de case posé : phase de menu, pas de plateau");
  }
  await tapPadButton(page, DPAD_BUTTON[direction]);
  for (let frame = 0; frame < 8; frame++) {
    const after = await cursorTile(page);
    if (after && (after.x !== before.x || after.y !== before.y)) {
      const delta = { x: after.x - before.x, y: after.y - before.y };
      cursorDeltas[direction] = delta;
      return delta;
    }
    await waitForPadPoll(page);
  }
  return null;
}

/**
 * UN pas de curseur vers une case, en gardant la direction qui rapproche le plus.
 *
 * Renvoie la nouvelle case, ou `null` quand plus aucune direction ne rapproche (bord de plateau, ou
 * cible atteinte).
 */
async function stepCursorToward(page: Page, target: Tile): Promise<Tile | null> {
  const current = await cursorTile(page);
  if (!current) {
    throw new Error("aucun curseur de case posé");
  }
  const distance = manhattan(current, target);
  // D'abord les directions déjà mesurées qui rapprochent, meilleure en tête ; sinon on en mesure une
  // nouvelle — chaque pression enseigne son pas.
  const known = ALL_DIRECTIONS.filter((direction) => cursorDeltas[direction] !== undefined)
    .map((direction) => {
      const delta = cursorDeltas[direction] as Tile;
      return {
        direction,
        gain: distance - manhattan({ x: current.x + delta.x, y: current.y + delta.y }, target),
      };
    })
    .filter((candidate) => candidate.gain > 0)
    .sort((left, right) => right.gain - left.gain);
  const unknown = ALL_DIRECTIONS.filter((direction) => cursorDeltas[direction] === undefined);
  const attempt = known[0]?.direction ?? unknown[0];
  if (attempt === undefined) {
    return null;
  }
  if ((await pressCursorDirection(page, attempt)) === null) {
    // Une direction mesurée qui ne bouge plus est un bord : on l'oublie pour laisser sa chance aux
    // autres, au lieu de la re-presser indéfiniment.
    delete cursorDeltas[attempt];
    return cursorTile(page);
  }
  return cursorTile(page);
}

/**
 * Amène le curseur de case SUR une case donnée, à la croix directionnelle.
 *
 * Gourmand plutôt que planifié : à chaque pas on relit la position réelle. Un chemin calculé d'avance
 * supposerait une grille plane et une caméra immobile — or le pas dépend de l'azimut, et un relief
 * peut rendre un voisin injoignable.
 */
async function padCursorTo(page: Page, target: Tile, max = 40): Promise<void> {
  // On vérifie APRÈS le dernier pas autant qu'avant le premier : sans ça, un pas qui atterrit sur la
  // cible au dernier tour de boucle n'est jamais évalué, et la cible est déclarée injoignable alors que
  // le curseur est dessus. Même correctif que `padMoveTo` (`pad-nav.ts`), qui l'avait déjà payé.
  for (let step = 0; step <= max; step++) {
    const current = await cursorTile(page);
    if (current?.x === target.x && current?.y === target.y) {
      return;
    }
    if (step === max) {
      break;
    }
    if ((await stepCursorToward(page, target)) === null) {
      break;
    }
  }
  const last = await cursorTile(page);
  throw new Error(
    `cible (${target.x},${target.y}) jamais atteinte en ${max} pas — curseur en ` +
      `(${last?.x},${last?.y})`,
  );
}

/* ------------------------------------------------------------------ caméra */

/**
 * Un quart de tour (LB / RB), attendu jusqu'à ce que la vue ait VRAIMENT bougé.
 *
 * Le hook e2e n'expose pas l'azimut — il est en lecture seule sur la scène, et l'ajouter pour une
 * capture serait élargir une surface de debug pour un besoin de tournage. On observe donc le
 * déplacement à l'écran d'une case témoin, ce que la projection donne déjà (`meshScreenBox`).
 */
export async function padRotateCamera(page: Page, step: 1 | -1): Promise<void> {
  const witness = await witnessTileMesh(page);
  const before = await meshScreenLeft(page, witness);
  await tapPadButton(page, step === 1 ? PadButton.RightBumper : PadButton.LeftBumper);
  for (let frame = 0; frame < 240; frame++) {
    const after = await meshScreenLeft(page, witness);
    // 40 px : au-delà du frémissement d'un tween qui démarre, en dessous d'un quart de tour complet
    // (une case témoin traverse plusieurs centaines de pixels).
    if (before !== null && after !== null && Math.abs(after - before) > 40) {
      resetCursorCalibration();
      return;
    }
    await waitForPadPoll(page);
  }
  throw new Error("la caméra n'a pas tourné après une pression de bumper");
}

/**
 * Un cran de zoom avant (gâchette droite).
 *
 * Pas de vérification : le zoom est borné à trois crans, donc une pression au bout peut légitimement ne
 * rien faire. Pas de paramètre de sens non plus — la séquence ne dézoome jamais.
 */
export async function padZoomIn(page: Page): Promise<void> {
  await tapPadButton(page, PadButton.RightTrigger);
  await waitForPadPoll(page);
}

/** Une case du plateau, choisie une fois, qui sert de témoin de mouvement de caméra. */
async function witnessTileMesh(page: Page): Promise<string> {
  const name = await page.evaluate(
    () =>
      (globalThis as { __ptE2e__?: { meshNames(): string[] } }).__ptE2e__
        ?.meshNames()
        .find((candidate) => candidate.startsWith("tile_")) ?? null,
  );
  if (name === null) {
    throw new Error("aucune case de terrain dans la scène : plateau pas encore monté");
  }
  return name;
}

function meshScreenLeft(page: Page, name: string): Promise<number | null> {
  return page.evaluate(
    (meshName) =>
      (
        globalThis as { __ptE2e__?: { meshScreenBox(n: string): { left: number } | null } }
      ).__ptE2e__?.meshScreenBox(meshName)?.left ?? null,
    name,
  );
}

/* ------------------------------------------------------------------ un tour de jeu */

/** Déplace le focus dans le menu de combat jusqu'au libellé voulu (le menu BOUCLE, contrairement à
 *  la navigation spatiale des écrans : `focusMenuStep` avance modulo le nombre d'entrées). */
export async function padFocusAction(page: Page, label: string, max = 8): Promise<void> {
  for (let step = 0; step <= max; step++) {
    const focused = await page.evaluate(() => (document.activeElement?.textContent ?? "").trim());
    if (focused === label) {
      await traceFocus(page, `action:${label}`);
      return;
    }
    if (step === max) {
      break;
    }
    await tapPadButton(page, PadButton.DpadDown);
    await waitForPadPoll(page);
  }
  /*
   * Message DIAGNOSTIC, pas décoratif : « jamais focalisée » ne dit pas si le menu n'avait pas
   * l'entrée, si le focus était ailleurs, ou si la croix pilotait encore le plateau. Chacune des trois
   * causes a coûté un run de cinq minutes.
   */
  const focused = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      tag: active?.tagName ?? "none",
      testid: active?.dataset.testid ?? "",
      text: (active?.textContent ?? "").trim().slice(0, 40),
      inMenu:
        document.querySelector('[data-testid="action-menu"]')?.contains(active ?? null) === true,
    };
  });
  const diagnostic =
    `menu=[${(await actionMenuLabels(page)).join("|")}] ` +
    `instruction=${await instruction(page)} focus=${focused.tag}/${focused.testid}/` +
    `"${focused.text}" inMenu=${focused.inMenu}`;
  await traceNote(`focus-action-failed: ${label} — ${diagnostic}`);
  throw new Error(
    `entrée « ${label} » du menu de combat jamais focalisée en ${max} crans — ${diagnostic}`,
  );
}

/**
 * Focalise une ligne d'attaque UTILISABLE, par son nom si fourni.
 *
 * `data-enabled` porte la vérité : une attaque sans cible reste affichée (pour qu'on voie pourquoi
 * elle est barrée) et garde le focus, mais son activation ne fait rien — la focaliser puis presser A
 * ferait piétiner la séquence sans rien signaler.
 */
export async function padFocusMove(
  page: Page,
  moveName?: string,
  max = 12,
  skipUsable = 0,
): Promise<string> {
  let skipped = 0;
  for (let step = 0; step <= max; step++) {
    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset.testid !== "move-item") {
        return null;
      }
      return {
        name: active.querySelector<HTMLElement>('[data-testid="move-name"]')?.textContent ?? "",
        enabled: active.dataset.enabled === "true",
      };
    });
    if (focused?.enabled === true && (moveName === undefined || focused.name === moveName)) {
      /*
       * `skipUsable` sert au repli d'une attaque sur l'autre : « utilisable » veut dire que le jeu a
       * trouvé au moins une cible, pas forcément un ADVERSAIRE — un soin ou un buff qui ne touche
       * qu'un allié compte comme utilisable. Quand la visée d'une attaque échoue, l'appelant redemande
       * la suivante plutôt que de renoncer au tour.
       */
      if (skipped >= skipUsable) {
        await traceFocus(page, `move:${focused.name}`);
        return focused.name;
      }
      skipped += 1;
    }
    if (step === max) {
      break;
    }
    await tapPadButton(page, PadButton.DpadDown);
    await waitForPadPoll(page);
  }
  throw new Error(
    `aucune attaque utilisable${moveName === undefined ? "" : ` nommée « ${moveName} »`} ` +
      `focalisée en ${max} crans`,
  );
}

/** Adversaires du camp qui joue, triés du plus proche au plus lointain du lanceur. */
async function enemiesByDistance(page: Page, from: Tile): Promise<SpriteSnapshot[]> {
  const all = await sprites(page);
  const caster = all.find((sprite) => sprite.tile.x === from.x && sprite.tile.y === from.y);
  if (!caster) {
    throw new Error(`aucun Pokemon sur la case du lanceur (${from.x},${from.y})`);
  }
  return all
    .filter((sprite) => sprite.side !== caster.side)
    .sort((left, right) => manhattan(left.tile, from) - manhattan(right.tile, from));
}

/**
 * Part de PV restants du Pokemon sous le curseur, lue sur la CARTE DU CURSEUR.
 *
 * C'est la seule source de PV accessible de l'extérieur — le hook de scène n'en expose pas — et elle
 * ne coûte rien : pendant une visée, le curseur est déjà sur la cible et le panneau affiche sa fiche.
 *
 * ⚠️ Un ennemi sous **brouillard** (plan 176) n'affiche PAS « 142 / 180 » mais « 79% » tout court : le
 * jeu lui retire ses PV exacts. Une lecture qui n'accepte que la fraction renvoie donc 100 % pour tout
 * le monde, et le pilote croit tout le monde intact — mesuré : quinze attaques, dégâts parfaitement
 * répartis, **zéro K.O.** On lit donc le POURCENTAGE d'abord, seul présent dans les deux cas.
 *
 * Renvoie `1` quand la ligne est illisible : mieux vaut traiter un adversaire comme intact que de
 * croire à tort qu'il est mourant.
 */
async function cursorHpRatio(page: Page): Promise<number> {
  const text = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="cursor-panel"] [data-testid="info-panel-hp"]')
        ?.textContent?.trim() ?? "",
  );
  const percent = /(\d+)\s*%/.exec(text);
  if (percent?.[1] !== undefined) {
    return Number(percent[1]) / 100;
  }
  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(text);
  const current = Number(fraction?.[1]);
  const max = Number(fraction?.[2]);
  return Number.isFinite(current) && Number.isFinite(max) && max > 0 ? current / max : 1;
}

/**
 * Vise puis CONFIRME l'attaque déjà choisie, en essayant les adversaires du plus proche au plus
 * lointain. Renvoie la case touchée, ou `null` si aucune cible n'était atteignable.
 *
 * Pourquoi essayer plutôt que calculer : la portée, les obstacles et l'empreinte du pattern vivent
 * dans le core, et rien ne les expose au harnais. Le jeu, lui, répond sans ambiguïté — sur une case
 * invalide, A ne fait rien et l'instruction reste « Select a target ».
 */
export async function padAimAndConfirm(page: Page, caster: Tile): Promise<Tile | null> {
  const phase = await instruction(page);
  // Pattern statique (soi-même, croix, zone centrée) : la visée est déjà tranchée, on est directement
  // à l'étape de confirmation — chercher une cible y dépenserait l'appui qui valide.
  if (phase === Instruction.confirm) {
    return caster;
  }
  /*
   * Pattern DIRECTIONNEL (cône, ligne, fauche, charge) : le curseur reste sur le lanceur et les
   * flèches font tourner l'empreinte autour de lui. L'orientation de départ vaut, donc on valide sans
   * la retoucher — et on s'arrête, comme les autres branches, sur l'étape de confirmation.
   */
  if (phase === Instruction.aimDirection) {
    await padTapUntilInstruction(page, Instruction.confirm);
    return caster;
  }
  /*
   * QUATRE plus proches, pas les douze : la liste est triée par distance croissante, et une attaque
   * porte à cinq cases au mieux — si les quatre premières sont hors de portée, les suivantes le sont
   * aussi. Les essayer toutes coûtait une centaine de pressions de croix par tour, pour rien.
   */
  const CANDIDATES = 4;
  const all = await enemiesByDistance(page, caster);
  /*
   * Garde de portée, avant tout déplacement de curseur : la plus longue attaque du roster porte à
   * quatre cases, et les deux camps démarrent à une quinzaine l'un de l'autre. Sans cette garde, un
   * tour non engagé promenait le curseur sur une quinzaine de cases pour chacun des quatre candidats, puis
   * autant pour les essayer — plus de cent pressions de croix, pour une visée impossible d'avance.
   */
  const nearest = all[0];
  if (!nearest || manhattan(nearest.tile, caster) > MAX_ATTACK_REACH) {
    return null;
  }
  const enemies = all
    .slice(0, CANDIDATES)
    .filter((enemy) => manhattan(enemy.tile, caster) <= MAX_ATTACK_REACH);
  /*
   * On visite chaque candidat pour LIRE ses PV, puis on frappe le plus entamé.
   *
   * Frapper le plus proche répartit les dégâts sur six adversaires et personne ne tombe : mesuré, vingt
   * tours d'échanges se sont soldés par **zéro K.O.** (un coup fort enlève ~100 PV sur 181, il en faut
   * deux sur la même cible). Achever le blessé, c'est ce que fait n'importe quel joueur — et c'est ce
   * qui donne à la bande-annonce le K.O. qu'elle doit montrer.
   *
   * La visite ne coûte presque rien : le curseur devait de toute façon se déplacer pour essayer.
   */
  const scouted: { enemy: SpriteSnapshot; hpRatio: number }[] = [];
  for (const enemy of enemies) {
    await padCursorTo(page, enemy.tile);
    scouted.push({ enemy, hpRatio: await cursorHpRatio(page) });
  }
  scouted.sort((left, right) => left.hpRatio - right.hpRatio);
  await traceNote(
    `aim: caster=(${caster.x},${caster.y}) ` +
      scouted
        .map(
          (candidate) =>
            `${candidate.enemy.pokemonId}@${candidate.enemy.tile.x},${candidate.enemy.tile.y}=` +
            `${Math.round(candidate.hpRatio * 100)}%`,
        )
        .join(" "),
  );
  for (const { enemy } of scouted) {
    await padCursorTo(page, enemy.tile);
    await tapPadButton(page, PadButton.A);
    const next = await waitWhileInstruction(page, Instruction.selectTarget);
    if (next === Instruction.confirm) {
      await traceNote(`hit: ${enemy.pokemonId}@${enemy.tile.x},${enemy.tile.y}`);
      return enemy.tile;
    }
    if (next !== Instruction.selectTarget) {
      // La phase a changé pour autre chose que la confirmation (annulation, résolution en cours) :
      // on arrête d'appuyer à l'aveugle plutôt que de valider on ne sait quoi.
      return null;
    }
  }
  return null;
}

/**
 * Attend que l'instruction QUITTE l'étape donnée, et renvoie celle qui la remplace (ou la même si
 * rien n'a bougé dans le budget).
 *
 * Fenêtre généreuse à dessein : le texte d'instruction est repeint par le rendu du chrome, un cran
 * après l'appui. Une fenêtre trop courte concluait « la case est invalide » alors que le jeu avait
 * accepté — et l'appui suivant, destiné à essayer une autre case, confirmait l'orientation d'arrivée
 * et lançait le déplacement. Le curseur s'effaçait alors (contexte verrouillé) et le pilote plantait
 * une case plus loin, sur un symptôme sans rapport avec sa cause.
 */
async function waitWhileInstruction(
  page: Page,
  expected: string,
  frames = 24,
): Promise<string | null> {
  for (let frame = 0; frame < frames; frame++) {
    const current = await instruction(page);
    if (current !== expected) {
      return current;
    }
    await waitForPadPoll(page);
  }
  return expected;
}

/** Tape A jusqu'à ce que l'instruction affiche l'étape attendue. */
async function padTapUntilInstruction(page: Page, expected: string, attempts = 6): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await instruction(page)) === expected) {
      return;
    }
    await tapPadButton(page, PadButton.A);
    for (let frame = 0; frame < 6; frame++) {
      if ((await instruction(page)) === expected) {
        return;
      }
      await waitForPadPoll(page);
    }
  }
  throw new Error(`l'étape « ${expected} » n'a jamais été atteinte`);
}

/**
 * Avance vers l'adversaire le plus proche, aussi loin que le déplacement du tour le permet.
 *
 * Indispensable, et mesuré : sur Arène Simple en 6v6, les zones de départ posent les deux camps aux
 * deux bouts du plateau — relevé dans la trace de visée, un lanceur en (3,18) a ses adversaires en
 * (5,1)…(5,3), soit une quinzaine de cases, quand la plus longue attaque du roster porte à quatre.
 * Sans déplacement, chaque tour conclut « Attendre », personne ne se rejoint jamais, et la séquence
 * filme douze Pokemon qui se regardent.
 *
 * On ne CALCULE pas la portée de déplacement — elle dépend du terrain, du relief et des occupants,
 * tout ça dans le core. On tend le curseur vers l'ennemi puis on recule d'une case à la fois jusqu'à
 * ce que le jeu accepte : sur une case injoignable, A ne fait rien et l'étape ne change pas.
 */
export async function padMoveTowardEnemy(page: Page, reach = 6): Promise<boolean> {
  const caster = await casterTile(page);
  const before = await sprites(page);
  const mover = before.find((sprite) => sprite.tile.x === caster.x && sprite.tile.y === caster.y);
  const [nearest] = await enemiesByDistance(page, caster);
  if (!nearest || !mover) {
    return false;
  }
  /** Cases déjà occupées : jamais une destination valide, donc jamais un candidat. */
  const occupiedKeys = new Set(before.map((sprite) => `${sprite.tile.x},${sprite.tile.y}`));
  /*
   * 1. Relever le chemin que le curseur peut réellement suivre vers l'ennemi. On s'arrête au CONTACT :
   *    sa case est occupée, donc jamais une destination valide.
   */
  const path: Tile[] = [];
  for (let step = 0; step < reach; step++) {
    const current = await cursorTile(page);
    if (!current || manhattan(current, nearest.tile) <= 1) {
      break;
    }
    const moved = await stepCursorToward(page, nearest.tile);
    if (!moved) {
      break;
    }
    if (!occupiedKeys.has(`${moved.x},${moved.y}`)) {
      path.push(moved);
    }
  }
  await traceNote(
    `move: caster=(${caster.x},${caster.y}) ` +
      `nearest=${nearest.pokemonId}@${nearest.tile.x},${nearest.tile.y} ` +
      `dist=${manhattan(caster, nearest.tile)} path=${path.map((tile) => `${tile.x},${tile.y}`).join(">")}`,
  );
  /*
   * 2. Essayer de la case la plus LOINTAINE à la plus proche : on veut avancer le plus possible, et
   *    seul le jeu sait jusqu'où le déplacement du tour porte.
   *
   * ⚠️ Une case hors de portée ne se contente pas d'être refusée : presser A dessus **quitte la phase**
   * et rend la main au menu d'actions. Il faut donc y RENTRER À NOUVEAU avant chaque essai, sinon le
   * premier refus consomme tous les autres. Sans ça, le pilote croyait s'être déplacé (la phase avait
   * bien changé), le même Pokemon rejouait indéfiniment, et soixante tours se sont écoulés sans qu'un
   * seul Pokemon bouge — visible seulement dans la trace, l'image montrant un menu qui s'ouvre et se
   * referme.
   */
  for (const candidate of [...path].reverse()) {
    if ((await instruction(page)) !== Instruction.selectDestination) {
      if (!(await actionMenuLabels(page)).includes("Move")) {
        return false;
      }
      await padFocusAction(page, "Move");
      await padActivate(
        page,
        async () => (await instruction(page)) === Instruction.selectDestination,
      );
    }
    await padCursorTo(page, candidate);
    /*
     * On TAPE A jusqu'à obtenir un effet, on ne se contente pas d'un appui : un appui unique peut
     * tomber entre deux lectures du poller (piège documenté dans `e2e/pages/gamepad.ts`).
     */
    let next: string | null = Instruction.selectDestination;
    for (let press = 0; press < 3 && next === Instruction.selectDestination; press++) {
      await tapPadButton(page, PadButton.A);
      next = await waitWhileInstruction(page, Instruction.selectDestination);
    }
    if (next === Instruction.selectDestination) {
      // Case refusée : l'étape n'a pas bougé. On essaie la suivante, plus proche.
      continue;
    }
    /*
     * ⚠️ Un déplacement validé ne passe PAS par un choix d'orientation — mesuré par sonde sur le bac à
     * sable : A sur la destination lance directement le glissé, l'étape devient nulle et le menu se
     * vide le temps de l'animation. Le choix d'orientation n'existe que pour « Attendre ».
     *
     * Attendre `selectFacing` était donc attendre quelque chose qui n'arrive jamais : le pilote
     * concluait « destination refusée » sur des déplacements pourtant exécutés, et AUCUN déplacement
     * n'a jamais été reconnu pendant six runs.
     */
    if (next === Instruction.selectFacing) {
      await padActivate(page, async () => (await instruction(page)) !== Instruction.selectFacing);
    }
    await waitForActionMenu(page);
    /*
     * On vérifie que c'est bien NOTRE Pokemon qui a atterri là.
     *
     * « quelqu'un occupe la case visée » ne suffit pas : un autre Pokemon peut déjà y être, et le
     * test passait alors sans que le lanceur ait bougé d'un pouce — trente-trois « déplacements »
     * réussis pour un Pokemon resté sur sa case, visible seulement en comparant les traces.
     */
    const arrived = (await sprites(page)).some(
      (sprite) =>
        sprite.pokemonId === mover.pokemonId &&
        sprite.tile.x === candidate.x &&
        sprite.tile.y === candidate.y,
    );
    if (arrived) {
      await traceNote(`moved: to=(${candidate.x},${candidate.y})`);
      return true;
    }
  }
  return false;
}

/**
 * Joue UN tour au plus vite, sans pause de cadence : c'est ce qui fait avancer le combat jusqu'à un
 * état filmable (camps engagés, PV entamés) avant les tours qu'on filme vraiment.
 *
 * Ordre du tour : **frapper si quelque chose est à portée, se rapprocher sinon**. Et pas « se
 * rapprocher puis frapper », qui semblait naturel : la portée d'une attaque se recalcule depuis la
 * case d'ARRIVÉE, et un déplacement qui s'arrête une case trop court laisse le menu sans attaque
 * légale (« Attaque » grisée, mesuré à l'image). Le pilote passait donc ses tours à avancer sans
 * jamais frapper.
 *
 * Renvoie `"attacked"` quand le tour s'est soldé par une attaque résolue, `"acted"` sinon
 * (déplacement seul, ou attente), et `"over"` dès que le dialogue de fin est à l'écran.
 */
export const FastTurnOutcome = {
  /** Le tour s'est soldé par une attaque résolue. */
  Attacked: "attacked",
  /** Déplacement seul, ou attente. */
  Acted: "acted",
  /** Le dialogue de fin est à l'écran. */
  Over: "over",
} as const;

export type FastTurnOutcome = (typeof FastTurnOutcome)[keyof typeof FastTurnOutcome];

export async function padPlayFastTurn(page: Page): Promise<FastTurnOutcome> {
  if (await isBattleOver(page)) {
    return FastTurnOutcome.Over;
  }
  await waitForActionMenu(page);
  const labels = await actionMenuLabels(page);
  if (labels.includes("Attack") && (await activeHasEnemyInReach(page))) {
    await padFocusAction(page, "Attack");
    await padActivate(page, () => hasUsableMove(page));
    await padFocusMove(page);
    /*
     * La case du lanceur se lit APRÈS avoir validé l'attaque, jamais avant : dans un menu il n'y a
     * pas de curseur (la fin du tour précédent l'a effacé, `pinCursor(null)` en contexte verrouillé),
     * et il ne se repose qu'à l'entrée d'une phase de plateau, sur la case que la caméra centre —
     * c'est-à-dire sur le Pokemon qui joue.
     */
    await padActivate(page, async () => (await instruction(page)) !== null);
    const caster = await casterTile(page);
    const hit = await padAimAndConfirm(page, caster);
    if (hit !== null) {
      await tapPadButton(page, PadButton.A);
      await settleTurn(page);
      return (await isBattleOver(page)) ? FastTurnOutcome.Over : FastTurnOutcome.Attacked;
    }
    /*
     * Aucune cible atteignable : on remonte jusqu'au menu d'actions.
     *
     * Il faut PLUSIEURS B, pas un seul : depuis la phase de visée, le premier ramène à la liste des
     * attaques — qui n'a pas d'entrée « Attendre ». Attendre le menu d'actions après un unique B
     * bloquait la séquence jusqu'à l'épuisement du budget, sur un message d'animation bloquée qui
     * n'avait rien à voir.
     */
    await padBackToActionMenu(page);
  }
  if ((await actionMenuLabels(page)).includes("Move")) {
    await padFocusAction(page, "Move");
    await padActivate(
      page,
      async () => (await instruction(page)) === Instruction.selectDestination,
    );
    if (await padMoveTowardEnemy(page)) {
      await settleTurn(page);
      return (await isBattleOver(page)) ? FastTurnOutcome.Over : FastTurnOutcome.Acted;
    }
    // Aucune destination acceptée (encerclé, ou déjà au contact) : on remonte au menu.
    await padBackToActionMenu(page);
  }
  await padFocusAction(page, "Wait");
  await padActivate(page, async () => (await instruction(page)) === Instruction.selectFacing);
  await tapPadButton(page, PadButton.A);
  await settleTurn(page);
  return (await isBattleOver(page)) ? FastTurnOutcome.Over : FastTurnOutcome.Acted;
}

/**
 * Le Pokemon dont c'est le tour a-t-il un adversaire à portée d'attaque ?
 *
 * Sert à deux choses : décider si un tour rapide frappe ou se rapproche, et **choisir le tour qu'on
 * filme** — « le menu propose Attaque » ne suffit pas, il le propose dès le premier tour alors que les
 * camps sont à quinze cases, et le plan filmé butait sur une visée impossible après avoir déjà pris
 * ses captures.
 */
async function activeHasEnemyInReach(page: Page): Promise<boolean> {
  const distance = await activeEnemyDistance(page);
  /*
   * `null` veut dire « je ne sais pas » (lanceur non reconnu, ou plus aucun adversaire) — et se traduit
   * ici par **non**, délibérément.
   *
   * L'inverse envoyait le tour dans la branche Attaque sur une ignorance, et `enemiesByDistance` levait
   * alors « aucun Pokemon sur la case du lanceur » — un symptôme à trois fonctions de sa cause. Répondre
   * non fait se déplacer, ce qui est inoffensif et rattrapable au tour suivant.
   */
  return distance !== null && distance <= MAX_ATTACK_REACH;
}

/**
 * Distance au plus proche adversaire du Pokemon qui joue, ou `null` s'il n'est pas reconnaissable.
 *
 * Sert à choisir un tour où le déplacement se VOIT : à une case de l'ennemi, le glissé dure deux
 * images et se lit comme une téléportation (retour humain 2026-08-28). Il faut donc un tour où
 * l'adversaire est assez loin pour qu'on marche, et assez près pour qu'une attaque porte après.
 */
export async function activeEnemyDistance(page: Page): Promise<number | null> {
  const active = await activeSprite(page);
  if (!active) {
    return null;
  }
  const distances = (await sprites(page))
    .filter((sprite) => sprite.side !== active.side)
    .map((sprite) => manhattan(sprite.tile, active.tile));
  return distances.length === 0 ? null : Math.min(...distances);
}

/** Camp du Pokemon qui joue, ou `null` s'il n'est pas reconnaissable. */
export async function activeSide(page: Page): Promise<string | null> {
  return (await activeSprite(page))?.side ?? null;
}

/** Identifiant du Pokemon qui joue, ou `null` s'il n'est pas reconnaissable. */
export async function activePokemonId(page: Page): Promise<string | null> {
  return (await activeSprite(page))?.pokemonId ?? null;
}

/**
 * Le Pokemon dont c'est le tour, identifié par le NOM de son panneau.
 *
 * Il n'existe pas de curseur en phase de menu et le hook de scène ne dit pas qui joue — le panneau de
 * gauche, lui, montre toujours l'actif. Le nom porte parfois un glyphe de genre (« Gengar ♂ »), d'où
 * la normalisation ; `null` quand il ne correspond à aucun Pokemon de la table, pour que l'appelant
 * décide quoi faire d'une reconnaissance ratée plutôt que d'hériter d'un camp faux.
 */
async function activeSprite(page: Page): Promise<SpriteSnapshot | null> {
  const displayed = await page.evaluate(
    () =>
      document.querySelector('[data-testid="info-panel"] [data-testid="info-panel-name"]')
        ?.textContent ?? "",
  );
  const pokemonId = (/[A-Za-z]+/.exec(displayed)?.[0] ?? "").toLowerCase();
  if (sideByPokemonId?.has(pokemonId) !== true) {
    return null;
  }
  return (await sprites(page)).find((sprite) => sprite.pokemonId === pokemonId) ?? null;
}

/** Remonte au menu d'actions par B, autant de fois qu'il faut d'étapes à défaire. */
export async function padBackToActionMenu(page: Page, frames = 600): Promise<void> {
  /*
   * Budget en FRAMES, et un compte séparé pour les pressions de B.
   *
   * Un budget en « tentatives » ne marche pas : la branche d'attente (menu vide = animation en cours)
   * consomme une tentative par frame, donc six tentatives = un sixième de seconde, et la fonction
   * abandonnait au milieu de la première animation.
   */
  const MAX_CANCELS = 4;
  let cancels = 0;
  for (let frame = 0; frame < frames; frame++) {
    /*
     * Le MENU DE COMBAT s'est ouvert : c'est B au menu racine qui l'a fait (plan 187, décision 7 —
     * « Échap n'a rien à annuler, donc il ouvre le menu »). Son focus capture la croix, donc plus
     * aucune entrée d'action n'est atteignable : mesuré, le focus se retrouvait sur « Quit » et viser
     * « Attendre » échouait au bout de ses crans. On le referme par sa propre entrée « Reprendre ».
     */
    if (await isCombatMenuOpen(page)) {
      await padMenuActivate(
        page,
        "combat-menu-resume",
        async () => !(await isCombatMenuOpen(page)),
      );
      continue;
    }
    if ((await actionMenuLabels(page)).includes("Wait")) {
      // Les libellés ne suffisent pas : il faut aussi que le FOCUS soit revenu dans le menu, sinon la
      // croix pilote encore le curseur de plateau et aucune entrée ne prend le focus.
      await waitForActionMenu(page);
      return;
    }
    /*
     * On ne presse B que s'il y a QUELQUE CHOSE à annuler — une étape de plateau (ligne d'instruction
     * visible) ou la liste d'attaques. Sinon on attend : un menu vide est une animation en cours, et
     * un B de trop y ouvre le menu de combat.
     */
    const cancellable = (await instruction(page)) !== null || (await hasMoveList(page));
    if (!cancellable || cancels >= MAX_CANCELS) {
      await waitForPadPoll(page);
      continue;
    }
    cancels += 1;
    await tapPadButton(page, PadButton.B);
    await waitForPadPoll(page);
  }
  throw new Error("le menu d'actions n'est jamais revenu (B bloqué, ou animation sans fin)");
}

/** Le menu de combat (Reprendre / Paramètres / Recommencer / Quitter) est-il ouvert ? */
function isCombatMenuOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('[data-testid="combat-menu"]') !== null);
}

/** La liste des attaques est-elle affichée ? (donc B a une étape à défaire) */
function hasMoveList(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('[data-testid="move-item"]') !== null);
}

/**
 * Focalise une entrée par son testid puis la valide — pour les menus qui ne sont pas le menu d'actions
 * (menu de combat, dialogue de fin), où l'on navigue au focus DOM et non par `focusMenuStep`.
 */
async function padMenuActivate(
  page: Page,
  testId: string,
  settled: () => Promise<boolean>,
  max = 10,
): Promise<void> {
  for (let step = 0; step <= max; step++) {
    if (await settled()) {
      return;
    }
    const focusedTestId = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.testid ?? "",
    );
    if (focusedTestId === testId) {
      await padActivate(page, settled);
      return;
    }
    await tapPadButton(page, PadButton.DpadUp);
    await waitForPadPoll(page);
  }
  throw new Error(`entrée « ${testId} » jamais focalisée`);
}

/** Case du Pokemon qui agit : le curseur s'y pose à l'entrée de toute phase de plateau. */
export async function casterTile(page: Page): Promise<Tile> {
  for (let frame = 0; frame < 60; frame++) {
    const tile = await cursorTile(page);
    if (tile) {
      return tile;
    }
    await waitForPadPoll(page);
  }
  throw new Error("le curseur ne s'est jamais posé sur le lanceur");
}

/** Une attaque au moins est utilisable dans le sous-menu ouvert. */
function hasUsableMove(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.querySelector('[data-testid="move-item"][data-enabled="true"]') !== null,
  );
}

/** Attend que le menu d'actions du tour suivant soit là et focalisé. */
export async function waitForActionMenu(page: Page, frames = 900): Promise<void> {
  for (let frame = 0; frame < frames; frame++) {
    if (await isBattleOver(page)) {
      return;
    }
    const labels = await actionMenuLabels(page);
    if (labels.includes("Wait") && (await instruction(page)) === null) {
      // Le menu est reconstruit à chaque tour, ce qui éjecte le focus : `restoreMenuFocus` le repose
      // sur la première entrée. On attend ce focus, sinon le premier cran de croix serait avalé.
      for (let settle = 0; settle < 24; settle++) {
        const inMenu = await page.evaluate(
          () =>
            document
              .querySelector('[data-testid="action-menu"]')
              ?.contains(document.activeElement) === true,
        );
        if (inMenu) {
          return;
        }
        await waitForPadPoll(page);
      }
      /*
       * Échec FRANC, et pas un `return` silencieux : la fonction promet « le menu est là ET focalisé »,
       * et sans le focus le premier cran de croix est avalé — le pilote décale alors d'une entrée sans
       * que rien ne le signale. Mieux vaut un message que trois minutes de séquence à côté.
       */
      throw new Error(
        "le menu d'actions est affiché mais aucune de ses entrées n'a pris le focus " +
          "(la croix piloterait le plateau au lieu du menu)",
      );
    }
    await waitForPadPoll(page);
  }
  throw new Error("le menu d'actions n'est jamais revenu (animation bloquée ?)");
}

/**
 * Attend la fin de la résolution : l'animation joue, le journal se remplit, puis le tour suivant
 * ouvre son menu. Une orientation de fin de tour peut s'interposer — on la confirme.
 */
export async function settleTurn(page: Page): Promise<void> {
  for (let frame = 0; frame < 900; frame++) {
    if (await isBattleOver(page)) {
      return;
    }
    const phase = await instruction(page);
    if (phase === Instruction.selectFacing) {
      await tapPadButton(page, PadButton.A);
      continue;
    }
    if (phase === null && (await actionMenuLabels(page)).includes("Wait")) {
      await waitForActionMenu(page);
      return;
    }
    await waitForPadPoll(page);
  }
  throw new Error("la résolution du tour ne s'est jamais terminée");
}
