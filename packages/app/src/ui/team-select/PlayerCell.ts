import { AiDifficulty, PlayerController, type TeamSet } from "@pokemon-tactic/core";
import { createTeamPortraitsElement } from "./TeamPortraits";

export interface PlayerCellLabels {
  controllerHuman: string;
  controllerAiEasy: string;
  controllerAiMedium: string;
  controllerAiHard: string;
  chooseTeam: string;
  /** « Aléatoire » — un camp qui tirera son équipe au lancement (plan 216, bug 2). */
  randomTeam: string;
  /** Réseau seulement — les états de ligne propres au salon (plan 199). */
  controllerRemote?: string;
  /** La ligne de l'hôte, telle que tout le monde la voit — la sienne comprise. */
  controllerHost?: string;
  /** Sa propre ligne, quand on n'est pas l'hôte. */
  controllerSelf?: string;
  ready?: string;
  waiting?: string;
  /** Personne sur cette place, et l'hôte n'a pas encore décidé quoi en faire. */
  seatOpen?: string;
}

export interface PlayerCellProps {
  slotIndex: number;
  playerLabel: string;
  shortLabel: string;
  colorHex: string;
  controller: PlayerController;
  /** Le niveau de l'IA de ce camp — sert à surligner le bon des trois boutons IA (plan 214). */
  aiDifficulty: AiDifficulty;
  assignedTeam: TeamSet | null;
  ephemeral: boolean;
  labels: PlayerCellLabels;
  /**
   * Réseau : la place est tenue par quelqu'un, et **ce n'est pas un choix à faire** (plan 199).
   *
   * Ces deux rôles remplacent le segment Humain / IA par un état unique, non interactif, sur toute la
   * largeur de la carte. Ce ne sont pas des contrôleurs — le moteur ne connaît qu'« humain » ou
   * « IA » — mais des faits du salon : `remote` est un humain qui n'est pas devant cet écran, et
   * `host` est celui qui tient la partie, y compris vu de lui-même. Afficher un segment à deux états
   * là où il n'y a rien à choisir demandait au joueur de comprendre pourquoi les deux sont grisés.
   */
  lockedRole?: "remote" | "host" | "self";
  /**
   * Faux quand cette équipe n'est pas de son ressort : la ligne de Pokemon **disparaît** au lieu de
   * s'afficher inerte (retour de recette 2026-09-04).
   *
   * Ce n'est pas que cosmétique : montrer l'équipe d'un adversaire humain avant le combat serait une
   * fuite d'information, dans un jeu qui masque déjà l'objet tenu et le talent (plan 176). Les lignes
   * IA restent visibles de tous — elles n'appartiennent à personne.
   */
  teamVisible?: boolean;
  /**
   * Réseau : où en est cette ligne, tel qu'on l'affiche.
   *
   * Distinct de la préparation que le salon calcule pour verrouiller le lancement : une place libre
   * y est « prête » (il n'y a personne dont on attendrait la confirmation) alors qu'à l'écran elle
   * doit dire qu'elle attend un joueur. Absent = aucun badge, ce qui est le cas du mode local et de
   * sa propre ligne.
   */
  seatStatus?: "open" | "ready" | "not-ready";
  /**
   * Faux quand ce joueur ne peut pas changer cette ligne : l'invité n'en change aucune (seul l'hôte
   * bascule Humain ↔ IA), et une place distante ne se bascule sous les pieds de personne. Absent =
   * vrai, ce qui laisse le mode local inchangé.
   */
  controllerEditable?: boolean;
  /**
   * Faux quand ce joueur ne compose pas l'équipe de cette ligne. Absent = vrai, ce qui laisse le
   * mode local inchangé.
   *
   * `disabled` plutôt qu'un clic sans effet : le refus vivait dans `chooseTeam`, donc un invité en
   * partie à 4 traversait aux flèches trois boutons focalisables qui n'ouvraient rien.
   * `FOCUSABLE_SELECTOR` écarte un bouton désactivé, ce qui règle l'affichage **et** la navigation.
   */
  teamEditable?: boolean;
}

export interface PlayerCellCallbacks {
  /** Ouvre le sélecteur d'équipe de ce camp (décision #832). */
  onChooseTeam: () => void;
  onSetController: (controller: PlayerController, aiDifficulty?: AiDifficulty) => void;
}

/**
 * Les rôles qui remplacent le segment Humain / IA, avec leur glyphe et leur contrat de test.
 *
 * 🔴 **Aucune place tenue par un humain n'affiche plus de segment grisé** (recette 2026-09-04) : ni
 * l'hôte, ni un joueur distant, ni sa propre place quand on est invité. Demander au joueur de
 * comprendre pourquoi deux boutons sont grisés était un contresens — il n'y a rien à choisir.
 */
const LOCKED_ROLE = {
  host: { testid: "player-host", label: (l: PlayerCellLabels) => `👑 ${l.controllerHost ?? ""}` },
  remote: {
    testid: "player-remote",
    label: (l: PlayerCellLabels) => `🌐 ${l.controllerRemote ?? ""}`,
  },
  self: { testid: "player-self", label: (l: PlayerCellLabels) => `🎮 ${l.controllerSelf ?? ""}` },
} as const satisfies Record<
  NonNullable<PlayerCellProps["lockedRole"]>,
  { testid: string; label: (labels: PlayerCellLabels) => string }
>;

/** Le libellé de chaque état de ligne. Table exhaustive : un état ajouté ne compile pas sans le sien. */
const SEAT_STATUS_LABEL = {
  open: (labels: PlayerCellLabels) => labels.seatOpen ?? "",
  ready: (labels: PlayerCellLabels) => labels.ready ?? "",
  "not-ready": (labels: PlayerCellLabels) => labels.waiting ?? "",
} as const satisfies Record<
  NonNullable<PlayerCellProps["seatStatus"]>,
  (labels: PlayerCellLabels) => string
>;

/** Glyphes du segment — un pictogramme par modalité de contrôle, lisible sans lire le libellé. */
const CONTROLLER_GLYPH = {
  [PlayerController.Human]: "🎮",
  [PlayerController.Ai]: "🤖",
} as const satisfies Record<PlayerController, string>;

/**
 * Les choix du segment (plan 214). Un humain, puis **un par niveau d'IA** : le niveau se règle là où
 * on donne la place à l'ordinateur, et nulle part ailleurs.
 *
 * ⚠️ `data-controller` continue de porter la valeur de `PlayerController` — c'est le contrat de test
 * existant, et il reste vrai. Ce qui distingue les trois boutons IA entre eux est `data-ai-difficulty`.
 * Le POM e2e vise l'IA de défaut quand il ne précise rien.
 */
const CONTROLLER_CHOICES = [
  { controller: PlayerController.Human },
  { controller: PlayerController.Ai, difficulty: AiDifficulty.Easy },
  { controller: PlayerController.Ai, difficulty: AiDifficulty.Medium },
  { controller: PlayerController.Ai, difficulty: AiDifficulty.Hard },
] as const satisfies readonly { controller: PlayerController; difficulty?: AiDifficulty }[];

const AI_DIFFICULTY_LABEL = {
  [AiDifficulty.Easy]: (labels: PlayerCellLabels) => labels.controllerAiEasy,
  [AiDifficulty.Medium]: (labels: PlayerCellLabels) => labels.controllerAiMedium,
  [AiDifficulty.Hard]: (labels: PlayerCellLabels) => labels.controllerAiHard,
} as const satisfies Record<AiDifficulty, (labels: PlayerCellLabels) => string>;

/**
 * Une carte de camp : son numéro, le segment Humain / IA, et l'équipe assignée.
 *
 * Deux changements structurels du plan 188 :
 *
 * - **Le segment remplace le bouton bascule** (décision #831). Les deux états sont désormais
 *   affichés en permanence, l'actif surligné : on voit ce qu'on choisit avant de le choisir, au lieu
 *   de deviner ce que le bouton va devenir. Un bouton par état, donc presser « Humain » sur un camp
 *   déjà humain ne fait rien — l'ancien bouton unique, lui, le donnait à l'IA.
 * - **Le bouton d'équipe remplace la liste centrale** (décision #832). La carte n'est plus un
 *   `<div role="button" tabindex="0">` avec son `keydown` maison : le nom d'équipe est un `<button>`
 *   qui ouvre le sélecteur. La notion de « camp actif », un second curseur qui pouvait contredire le
 *   focus à l'écran, disparaît avec lui.
 */
export function createPlayerCellElement(
  props: PlayerCellProps,
  callbacks: PlayerCellCallbacks,
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "ts-player-cell";
  cell.dataset.slotIndex = String(props.slotIndex);
  cell.style.setProperty("--ts-player-color", props.colorHex);

  const header = document.createElement("span");
  header.className = "ts-player-cell-header";

  const dot = document.createElement("span");
  dot.className = "ts-player-cell-dot";
  header.appendChild(dot);

  const label = document.createElement("span");
  label.className = "ts-player-cell-label";
  label.textContent = props.playerLabel;
  header.appendChild(label);

  // Réseau : où en est ce joueur. Sur la même rangée que son nom, parce que c'est une propriété de
  // lui et non de son équipe — et parce qu'un badge sous le segment aurait décalé les portraits.
  if (props.seatStatus !== undefined) {
    const status = document.createElement("span");
    status.className = "ts-player-cell-status";
    status.dataset.testid = "player-ready";
    status.dataset.slotIndex = String(props.slotIndex);
    status.dataset.state = props.seatStatus;
    status.textContent = SEAT_STATUS_LABEL[props.seatStatus](props.labels);
    header.appendChild(status);
  }

  cell.appendChild(header);

  // Le segment est sur sa PROPRE rangée, pleine largeur, et non plus poussé à droite de l'en-tête
  // (retour humain 2026-08-25 : « le passage du focus est bizarre »). La navigation du focus est
  // SPATIALE (`focusInDirection`) : le segment collé à droite avait son centre à droite de celui du
  // bouton d'équipe, donc ← depuis « Humain » descendait sur l'équipe au lieu de ne rien faire.
  // Empilé, la géométrie dit la même chose que la logique : ← → parcourent Humain ↔ IA, ↑ ↓ montent
  // et descendent dans la carte.
  cell.appendChild(buildControllerSegment(props, callbacks));

  /*
   * L'équipe d'un autre joueur humain ne s'affiche pas du tout. Ce n'est pas de la pudeur : la
   * montrer avant le combat serait une fuite d'information, dans un jeu qui masque déjà l'objet tenu
   * et le talent de l'adversaire (plan 176, #729). Les lignes IA restent visibles de tous.
   */
  if (props.teamVisible === false) {
    return cell;
  }

  const teamButton = document.createElement("button");
  teamButton.type = "button";
  teamButton.className = "ts-player-cell-team";
  teamButton.dataset.testid = "player-team-button";
  teamButton.dataset.slotIndex = String(props.slotIndex);
  const teamName = document.createElement("span");
  teamName.className = "ts-player-cell-team-name";
  /*
   * 🔴 Trois états, et non deux (plan 216, bug 2). `assignedTeam === null` ne veut plus dire « vide » :
   * un camp **aléatoire** est désormais lui aussi sans équipe, parce que le tirage est différé au
   * lancement. Le confondre avec un camp vide afficherait « Choisir une équipe » sur un camp
   * parfaitement réglé, et le rendrait injouable à l'œil.
   */
  if (props.assignedTeam === null && props.ephemeral) {
    teamName.textContent = props.labels.randomTeam;
    teamButton.dataset.state = "ephemeral";
  } else if (props.assignedTeam === null) {
    teamName.textContent = props.labels.chooseTeam;
    teamButton.dataset.state = "empty";
  } else {
    teamName.textContent = props.assignedTeam.name;
    teamButton.dataset.state = props.ephemeral ? "ephemeral" : "saved";
  }
  if (props.teamEditable === false) {
    teamButton.disabled = true;
  }
  teamButton.appendChild(teamName);
  // Les portraits, en plus du nom (retour humain 2026-08-25) : #832 avait remplacé la liste
  // permanente — qui les montrait en continu — par une modale, et la carte ne disait plus QUELLE
  // équipe c'était, seulement comment elle s'appelle.
  if (props.assignedTeam !== null) {
    teamButton.appendChild(createTeamPortraitsElement(props.assignedTeam.slots));
  }
  teamButton.addEventListener("click", () => callbacks.onChooseTeam());
  cell.appendChild(teamButton);

  return cell;
}

function buildControllerSegment(
  props: PlayerCellProps,
  callbacks: PlayerCellCallbacks,
): HTMLElement {
  const segment = document.createElement("div");
  segment.className = "ts-segments ts-player-cell-controller";

  /*
   * Une place tenue — par un joueur distant ou par l'hôte — n'affiche PAS le segment Humain / IA
   * (plan 199, précisé à la recette du 2026-09-04). Deux boutons grisés diraient « on pourrait, mais
   * pas maintenant », alors qu'il n'y a **rien à choisir** : la place est prise par quelqu'un. Un
   * état unique, non interactif et **sur toute la largeur**, le dit mieux — et il n'ajoute aucun
   * contrôle que les flèches devraient traverser pour rien.
   */
  /*
   * Rien du tout quand la ligne n'est ni tenue ni basculable : c'est le cas d'une place **libre vue
   * par un invité**, qui n'a pas à en décider. Deux boutons grisés y posaient la même question que
   * partout ailleurs — « pourquoi je ne peux pas ? » — alors que l'en-tête dit déjà « Place libre ».
   */
  /*
   * 🔴 Une place IA que le spectateur ne règle PAS montre quand même son niveau (plan 214).
   *
   * Sans cette puce, l'invité d'un salon en ligne ne voyait **rien du tout** sur une place tenue par
   * l'ordinateur : le niveau traversait bien le réseau dans `NetworkSeatState`, mais personne ne
   * l'affichait chez lui — on découvrait la difficulté de l'adversaire en entrant en combat, ce qui
   * est précisément ce que le Lot C voulait éviter. Trouvé en préparant la recette, avant de faire
   * tester l'humain.
   *
   * Une puce et non un segment grisé : il n'y a rien à choisir ici, et quatre boutons éteints
   * poseraient la question « pourquoi je ne peux pas ? » — même raisonnement que les rôles verrouillés
   * ci-dessous (recette 2026-09-04).
   */
  if (
    props.lockedRole === undefined &&
    props.controllerEditable === false &&
    props.controller === PlayerController.Ai &&
    props.seatStatus !== "open"
  ) {
    const chip = document.createElement("span");
    chip.className = "ts-segment ts-player-cell-role";
    chip.dataset.testid = "player-ai-level";
    chip.dataset.slotIndex = String(props.slotIndex);
    chip.dataset.aiDifficulty = props.aiDifficulty;
    chip.dataset.state = "active";
    chip.textContent = `${CONTROLLER_GLYPH[PlayerController.Ai]} ${AI_DIFFICULTY_LABEL[props.aiDifficulty](props.labels)}`;
    segment.appendChild(chip);
    return segment;
  }

  if (props.lockedRole === undefined && props.controllerEditable === false) {
    return segment;
  }

  const role = props.lockedRole;
  if (role !== undefined) {
    const chip = document.createElement("span");
    chip.className = "ts-segment ts-player-cell-role";
    chip.dataset.testid = LOCKED_ROLE[role].testid;
    chip.dataset.slotIndex = String(props.slotIndex);
    chip.dataset.state = "active";
    chip.textContent = LOCKED_ROLE[role].label(props.labels);
    segment.appendChild(chip);
    return segment;
  }

  for (const choice of CONTROLLER_CHOICES) {
    const { controller } = choice;
    const difficulty = "difficulty" in choice ? choice.difficulty : undefined;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ts-segment";
    // Contrat de test : le testid localise, `data-controller` (id stable, indépendant de l'i18n) et
    // `data-slot-index` désignent lequel — le libellé, lui, porte un glyphe et se traduit.
    button.dataset.testid = "player-controller";
    // `PlayerController.Human === "human"` : l'enum porte déjà la valeur du contrat de test.
    button.dataset.controller = controller;
    if (difficulty !== undefined) {
      button.dataset.aiDifficulty = difficulty;
    }
    button.dataset.slotIndex = String(props.slotIndex);
    /*
     * Une place **libre** ne surligne ni l'un ni l'autre : rien n'y est décidé, et l'en-tête dit
     * « Place libre ». Marquer « IA » — ce que fait l'état local, qui a déjà tiré une équipe de
     * repli — contredisait l'en-tête à côté (recette 2026-09-04). Le repli en IA reste vrai au
     * lancement ; il n'a simplement pas à s'annoncer comme un choix de l'hôte.
     */
    const chosen =
      controller === PlayerController.Ai
        ? props.controller === controller && props.aiDifficulty === difficulty
        : props.controller === controller;
    if (chosen && props.seatStatus !== "open") {
      button.dataset.state = "active";
    }
    // L'invité ne bascule aucune ligne : seul l'hôte le fait. `disabled` plutôt qu'un bouton absent,
    // pour que la ligne garde la même forme chez tout le monde — et `FOCUSABLE_SELECTOR` écarte déjà
    // un bouton désactivé, donc les flèches ne s'y arrêtent pas.
    if (props.controllerEditable === false) {
      button.disabled = true;
    }
    button.textContent = `${CONTROLLER_GLYPH[controller]} ${
      difficulty === undefined
        ? props.labels.controllerHuman
        : AI_DIFFICULTY_LABEL[difficulty](props.labels)
    }`;
    button.addEventListener("click", () => callbacks.onSetController(controller, difficulty));
    segment.appendChild(button);
  }

  return segment;
}
