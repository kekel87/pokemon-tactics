import { appendFile, mkdir } from "node:fs/promises";
import type { Page } from "@playwright/test";
import {
  connectPad,
  holdPadUntil,
  PadButton,
  tapPadButton,
  waitForPadPoll,
} from "../pages/gamepad";

/*
 * Navigation à la manette pour la séquence d'intro (plan 194).
 *
 * Pourquoi pas des clics : un `.click()` de Playwright ne montre NI curseur NI focus. À l'image, les
 * écrans changent tout seuls — on ne comprend pas qu'un joueur navigue. La manette, elle, pose
 * `data-input-source="gamepad"` sur `<html>`, ce qui active `[data-input-source="gamepad"] :focus`
 * (`base.css`) : un liseré visible se déplace de contrôle en contrôle. C'est ça qu'on filme.
 *
 * ⚠️ Ne PAS mélanger clics et manette dans une même séquence : le premier clic remet
 * `data-input-source` sur la souris et le liseré disparaît d'un coup à l'image.
 */

/**
 * Trace des focus traversés, dans l'ordre.
 *
 * Sert à MAINTENIR la séquence : le nombre de crans entre deux entrées dépend de l'ordre du DOM, qui
 * bouge dès qu'on ajoute une entrée de menu. Sans trace, on compte à l'aveugle et la séquence casse
 * en silence (le focus atterrit ailleurs, et `A` valide autre chose).
 */
export const focusTrace: string[] = [];

/** Direction d'écran, telle que la navigation spatiale du jeu la comprend. */
export type PadDirection = "up" | "down" | "left" | "right";

/** Où la trace s'écrit AU FIL des déplacements — donc lisible même si la séquence échoue ensuite. */
const TRACE_PATH = ".screenshots/intro/focus-trace.txt";

/** Élément focalisé, décrit de façon stable pour détecter un changement de focus. */
function focusSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active) {
      return "none";
    }
    const testId = active.getAttribute("data-testid") ?? "";
    const label = (active.textContent ?? "").trim().slice(0, 40);
    /*
     * Contexte = le texte du parent DIRECT **et** du grand-parent, concaténés.
     *
     * Sans contexte, deux contrôles au même libellé sont indistinguables — chaque carte d'équipe porte
     * un bouton « Éditer ». Et ni le parent ni le grand-parent ne suffit seul, deux cas réels le
     * prouvent : le « × » d'une carte de slot est un FRÈRE de la carte, dans un conteneur nu (il faut
     * le parent pour savoir de quel Pokemon il s'agit) ; le bouton « Edit » d'une carte d'équipe a pour
     * parent la rangée d'actions (il faut le grand-parent pour retrouver le nom de l'équipe).
     *
     * Monter plus haut serait contre-productif : un ancêtre trop large contient les libellés de tous
     * les frères, et une correspondance par sous-chaîne redeviendrait ambiguë — le piège de la rangée
     * de formats, où « 3J × 4 » matchait alors que le focus était sur « 2J × 6 ».
     */
    const parentText = (active.parentElement?.textContent ?? "").trim();
    const grandParentText = (active.parentElement?.parentElement?.textContent ?? "").trim();
    const context = `${parentText} ${grandParentText}`.replace(/\s+/g, " ").slice(0, 90);
    return `${active.tagName}|${testId}|${label}|${context}`;
  });
}

/** DÉMARRE le poller, une fois l'écran voulu atteint. Idempotent. */
export async function connectCapturePad(page: Page): Promise<void> {
  await connectPad(page);
  await waitForPadPoll(page);
}

/**
 * Déplace le focus d'un cran et attend que ça ait VRAIMENT bougé.
 *
 * `holdPadUntil` plutôt qu'une tape : sur les écrans sans rendu Babylon le navigateur ralentit les
 * frames, et une pression brève tombe entre deux lectures du poller (piège documenté dans
 * `e2e/pages/gamepad.ts`).
 */
export async function padMove(page: Page, direction: PadDirection): Promise<void> {
  const button = {
    up: PadButton.DpadUp,
    down: PadButton.DpadDown,
    left: PadButton.DpadLeft,
    right: PadButton.DpadRight,
  }[direction];
  const before = await focusSignature(page);
  await holdPadUntil(page, button, async () => (await focusSignature(page)) !== before);
  const line = `${direction} → ${await focusSignature(page)}`;
  focusTrace.push(line);
  await mkdir(".screenshots/intro", { recursive: true });
  await appendFile(TRACE_PATH, `${line}\n`, "utf8");
}

/**
 * Déplace une SÉLECTION (et non le focus DOM) jusqu'à ce qu'un état attendu soit atteint.
 *
 * L'écran de choix de carte est volontairement différent (décision du plan 184) : ses flèches
 * promènent la sélection de carte, `document.activeElement` ne bouge jamais. Détecter « le focus a
 * changé » n'y veut donc rien dire — c'est l'état de l'écran qu'il faut observer.
 */
export async function padSelectUntil(
  page: Page,
  direction: "up" | "down",
  settled: () => Promise<boolean>,
  max = 12,
): Promise<void> {
  const button = direction === "up" ? PadButton.DpadUp : PadButton.DpadDown;
  for (let step = 0; step <= max; step++) {
    if (await settled()) {
      return;
    }
    await tapPadButton(page, button);
    await waitForPadPoll(page);
  }
  throw new Error(`état attendu jamais atteint en ${max} pressions vers ${direction}`);
}

/** Note le focus courant dans la trace, sans rien déplacer — pour situer un point de départ. */
export async function traceFocus(page: Page, label: string): Promise<void> {
  const line = `[${label}] ${await focusSignature(page)}`;
  focusTrace.push(line);
  await mkdir(".screenshots/intro", { recursive: true });
  await appendFile(TRACE_PATH, `${line}\n`, "utf8");
}

/**
 * Note une ligne LIBRE dans la trace, sans lire le focus.
 *
 * Le combat ne se raconte pas par des signatures de focus : ce qui compte y est l'état du jeu (qui
 * est visé, à combien de PV). Deux runs ont été dépensés à deviner pourquoi le pilote ne concentrait
 * pas ses attaques ; la trace le dit maintenant sans qu'on ait à relancer.
 */
export async function traceNote(text: string): Promise<void> {
  focusTrace.push(text);
  await mkdir(".screenshots/intro", { recursive: true });
  await appendFile(TRACE_PATH, `${text}\n`, "utf8");
}

/**
 * Une cible correspond-elle au focus courant ?
 *
 * Sans `|`, on compare le LIBELLÉ (ou le testid) **exactement**. C'est indispensable : la signature
 * embarque le texte du conteneur parent, et une rangée de segments contient tous les libellés à la
 * fois — un `includes("3J × 4")` était donc vrai alors que le focus était sur « 2J × 6 », et `A`
 * validait le mauvais segment sans que rien ne le signale.
 *
 * Avec `|`, la cible est cherchée dans la signature entière : c'est la façon de lever une ambiguïté
 * (« Éditer|Flammes & Psy » distingue deux boutons « Éditer » identiques).
 */
function matchesTarget(signature: string, target: string): boolean {
  const [, testId = "", label = "", context = ""] = signature.split("|");
  if (!target.includes("|")) {
    return testId === target || label === target;
  }
  /*
   * Forme « libellé|contexte » : les deux parties sont vérifiées SÉPARÉMENT — libellé exact (ou
   * testid), contexte par sous-chaîne. Une simple sous-chaîne sur la signature entière ne marche
   * pas : le libellé et le contexte ne se touchent pas dans la chaîne (« Edit|EditExportDelete
   * Blaze & Psy… »), donc « Edit|Blaze & Psy » n'y apparaît jamais.
   */
  const [wantedLabel = "", wantedContext = ""] = target.split("|");
  const labelMatches = testId === wantedLabel || label === wantedLabel;
  return labelMatches && context.includes(wantedContext);
}

/**
 * Déplace le focus JUSQU'À un contrôle donné, au lieu de compter des crans.
 *
 * Compter est fragile : le nombre de pressions dépend de l'ordre du DOM, et une entrée ajoutée casse
 * la séquence en silence (le focus atterrit ailleurs, `A` valide autre chose — c'est arrivé sur le
 * menu principal, où le premier cran tombe sur « Combat » et non sur « Aventure » désactivée).
 *
 * Ici on décrit la CIBLE. Si elle n'est pas atteinte en `max` crans, on échoue franchement plutôt que
 * de filmer une séquence qui valide n'importe quoi.
 */
export async function padMoveTo(
  page: Page,
  direction: PadDirection,
  target: string,
  max = 14,
): Promise<void> {
  // On vérifie AVANT le premier déplacement (la cible peut déjà avoir le focus) puis APRÈS chacun —
  // sinon le dernier cran effectué n'est jamais évalué, et une cible atteinte pile au quota est
  // déclarée introuvable alors qu'elle a le focus.
  for (let step = 0; step <= max; step++) {
    if (matchesTarget(await focusSignature(page), target)) {
      return;
    }
    if (step === max) {
      break;
    }
    await padMove(page, direction);
  }
  throw new Error(
    `focus « ${target} » jamais atteint en ${max} crans vers ${direction}. ` +
      `Dernier focus : ${await focusSignature(page)}. Voir ${TRACE_PATH}.`,
  );
}

/**
 * Déplace le focus JUSQU'À ce qu'une CONDITION soit vraie, quand la signature textuelle ne peut pas
 * désigner la cible sans ambiguïté.
 *
 * `padMoveTo` compare des libellés et un CONTEXTE, et ce contexte est le texte du parent et du
 * grand-parent — qui, dans une liste ou une colonne de cartes, contient le texte de tous les frères.
 * Deux faux positifs réels (plan 194) : « player-team-button|Player 2 » matchait la carte du camp 1,
 * et « Fangs & Fists » matchait la ligne « Blaze & Psy ». Là où l'élément porte un attribut qui le
 * distingue (`data-slot-index`, `data-team-id`), c'est LUI qu'il faut lire.
 */
export async function padMoveUntil(
  page: Page,
  direction: PadDirection,
  what: string,
  settled: () => Promise<boolean>,
  max = 14,
): Promise<void> {
  for (let step = 0; step <= max; step++) {
    if (await settled()) {
      await traceFocus(page, what);
      return;
    }
    if (step === max) {
      break;
    }
    await padMove(page, direction);
  }
  // Le DATASET du contrôle focalisé, pas seulement sa signature textuelle : quand la cible est décrite
  // par des attributs, c'est la seule chose qui dise POURQUOI elle ne correspond pas.
  const dataset = await page.evaluate(() =>
    JSON.stringify({ ...((document.activeElement as HTMLElement | null)?.dataset ?? {}) }),
  );
  throw new Error(
    `focus « ${what} » jamais atteint en ${max} crans vers ${direction}. ` +
      `Dernier focus : ${await focusSignature(page)} dataset=${dataset}. Voir ${TRACE_PATH}.`,
  );
}

/**
 * Atteint une cible en essayant plusieurs DIRECTIONS, dans l'ordre donné.
 *
 * La navigation des écrans est spatiale (`focusInDirection`) : le chemin entre deux contrôles n'est
 * pas un graphe qu'on peut prédire depuis le DOM, il dépend des centres géométriques et d'une pénalité
 * hors axe. Chaque hypothèse fausse coûtait un run de cinq minutes — et une correction d'interface
 * peut la retourner : corriger le focus du sélecteur de format a fait que « droite » ne sortait plus
 * de la rangée, alors que c'était le chemin de la veille.
 *
 * On essaie donc les directions plausibles et on échoue franchement si aucune n'y mène, en disant
 * lesquelles ont été tentées.
 */
export async function padReach(
  page: Page,
  what: string,
  settled: () => Promise<boolean>,
  directions: readonly PadDirection[],
  maxPerDirection = 4,
): Promise<void> {
  for (const direction of directions) {
    for (let step = 0; step <= maxPerDirection; step++) {
      if (await settled()) {
        await traceFocus(page, what);
        return;
      }
      if (step === maxPerDirection) {
        break;
      }
      try {
        await padMove(page, direction);
      } catch {
        // Direction épuisée (le focus ne bouge plus de ce côté) : on passe à la suivante. Le seul
        // échec qui compte est celui de la boucle entière, signalé ci-dessous.
        break;
      }
    }
  }
  if (await settled()) {
    await traceFocus(page, what);
    return;
  }
  const dataset = await page.evaluate(() =>
    JSON.stringify({ ...((document.activeElement as HTMLElement | null)?.dataset ?? {}) }),
  );
  throw new Error(
    `focus « ${what} » jamais atteint en essayant ${directions.join(", ")}. ` +
      `Dernier focus : ${await focusSignature(page)} dataset=${dataset}. Voir ${TRACE_PATH}.`,
  );
}

/**
 * TAPE un bouton jusqu'à obtenir l'effet, plutôt que de le maintenir.
 *
 * `holdPadUntil` (maintien) convient au DÉPLACEMENT de focus, qui se déclenche au front descendant.
 * Il ne convient pas à l'ACTIVATION : mesuré, une tape vide un slot (« 5/6 Pokémon ») là où un
 * maintien de 60 frames ne produit rien — l'activation attend le relâchement. Un maintien attendait
 * donc un effet que le maintien lui-même empêchait.
 *
 * On tape et on re-tape, parce qu'une tape unique peut tomber entre deux lectures du poller sur un
 * écran sans boucle de rendu (piège documenté dans `e2e/pages/gamepad.ts`).
 */
async function padTapUntil(
  page: Page,
  button: number,
  settled: () => Promise<boolean>,
  attempts = 6,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await settled()) {
      return;
    }
    await tapPadButton(page, button);
    /*
     * Laisser le DOM se re-rendre AVANT de conclure. Vérifier juste après la tape donnait un faux
     * négatif : mesuré, une tape vide bien le slot, mais l'effet n'est pas observable dans la même
     * microtâche — et re-taper aussitôt enchaînait des activations parasites sur le contrôle suivant.
     */
    for (let settle = 0; settle < 4; settle++) {
      await waitForPadPoll(page);
      if (await settled()) {
        return;
      }
    }
  }
  throw new Error(`le bouton ${button}, tapé ${attempts} fois, n'a produit aucun effet`);
}

/** Valide le contrôle focalisé (A), en attendant l'effet fourni par l'appelant. */
export async function padActivate(page: Page, settled: () => Promise<boolean>): Promise<void> {
  await padTapUntil(page, PadButton.A, settled);
}

/** Revient en arrière (B). */
export async function padBack(page: Page, settled: () => Promise<boolean>): Promise<void> {
  await padTapUntil(page, PadButton.B, settled);
}
