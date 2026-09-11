import { t } from "../../i18n";

/**
 * L'encart de salon (plan 199, étape 5) — le code de partie et les paramètres, posés en tête de
 * l'écran de sélection d'équipe quand celui-ci sert de **salle d'attente**.
 *
 * Il n'y a pas d'écran de salon séparé (décision #897) : l'écran de sélection d'équipe porte déjà
 * les lignes par camp, donc le salon est là. Et le code s'affiche **ici**, parce que c'est ici que
 * l'hôte attend — donc ici qu'il le partage.
 */

export interface RoomPanelProps {
  code: string;
  mapName: string;
  /** Le nombre de joueurs du format. Gravé depuis le `lobby`, jamais modifiable ici. */
  teamCount: number;
  autoPlacement: boolean;
  damagePreview: boolean;
  /**
   * Vrai pour l'hôte. Les deux options restent alors éditables **dans le pied de l'écran**, où elles
   * vivaient déjà (plan 198) : l'encart ne les redouble pas, il les rappelle en lecture seule pour
   * ceux qui ne les décident pas.
   */
  isHost: boolean;
}

export interface RoomPanelCallbacks {
  onCopyCode: (code: string) => void;
}

export function createRoomPanelElement(
  props: RoomPanelProps,
  callbacks: RoomPanelCallbacks,
): HTMLElement {
  // `<div>` et non `<section>` : l'encart n'a pas de titre propre, et `.claude/rules/html.md` réserve
  // `<section>` à ce qui porte un heading.
  const panel = document.createElement("div");
  panel.className = "ts-room-panel";
  panel.dataset.testid = "room-panel";

  panel.append(buildCodeBlock(props, callbacks), buildSettingsBlock(props));
  return panel;
}

function buildCodeBlock(props: RoomPanelProps, callbacks: RoomPanelCallbacks): HTMLElement {
  const block = document.createElement("div");
  block.className = "ts-room-code";

  const caption = document.createElement("span");
  caption.className = "ts-room-code-caption";
  caption.textContent = t("room.codeCaption");

  // Le code d'un bloc (`A7K2M`), jamais avec son préfixe d'espace de noms : `pkmntac-` est une
  // affaire d'adressage, pas quelque chose qu'un joueur recopie.
  const value = document.createElement("output");
  value.className = "ts-room-code-value";
  value.dataset.testid = "room-code";
  value.textContent = props.code;

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "tb-btn";
  copy.dataset.variant = "ghost";
  copy.dataset.testid = "room-code-copy";
  copy.textContent = t("room.copy");
  copy.addEventListener("click", () => callbacks.onCopyCode(props.code));

  block.append(caption, value, copy);
  return block;
}

function buildSettingsBlock(props: RoomPanelProps): HTMLElement {
  const block = document.createElement("div");
  block.className = "ts-room-settings";
  block.dataset.testid = "room-settings";

  const format = document.createElement("p");
  format.className = "ts-room-format";
  format.dataset.testid = "room-format";
  format.textContent = `${t("room.format")} · ${formatLabel(props.teamCount)}`;
  block.append(format);

  const list = document.createElement("dl");
  list.className = "ts-room-settings-list";

  /*
   * 🔴 Le format a QUITTÉ cette liste (plan 207, étape 7) pour sa propre ligne, juste au-dessus.
   *
   * Motif, relevé en revue de game-designer : l'étape 2 du même plan retire la mention du format de
   * l'écran « Jouer en ligne ». Cet encart devenait donc le seul endroit où le joueur peut l'
   * apprendre AVANT d'investir du temps dans sa composition — et il le disait au même corps que
   * « Placement auto », noyé dans quatre lignes de paramètres. Un joueur venu du solo, où cinq
   * formats de camps sont offerts, pouvait ouvrir un salon en croyant inviter plusieurs amis et ne
   * le découvrir qu'en partageant son code.
   */
  const rows: readonly (readonly [string, string])[] = [
    [t("room.map"), props.mapName],
    [t("teamSelect.autoPlacement.label"), onOff(props.autoPlacement)],
    [t("teamSelect.damagePreview.label"), onOff(props.damagePreview)],
  ];

  for (const [term, description] of rows) {
    const termNode = document.createElement("dt");
    termNode.textContent = term;
    const descriptionNode = document.createElement("dd");
    descriptionNode.textContent = description;
    list.append(termNode, descriptionNode);
  }
  block.append(list);

  if (!props.isHost) {
    const note = document.createElement("p");
    note.className = "ts-room-settings-note";
    note.textContent = t("room.hostDecides");
    block.append(note);
  }

  return block;
}

function onOff(value: boolean): string {
  return value ? t("settings.on") : t("settings.off");
}

/**
 * Le format en clair. « 1 contre 1 » plutôt que « 2 joueurs » quand il n'y a que deux camps : c'est
 * ainsi qu'un joueur le nomme, et l'ancienne formule était précisément ce que l'humain ne comprenait
 * pas au lobby (« Joueurs : 2 joueurs »).
 *
 * Le cas général reste écrit, et ce n'est pas de la précaution gratuite : `ONLINE_TEAM_COUNT` vaut 2
 * tant que le maillage ne garde pas les actions hors séquence, mais cet encart n'a pas à savoir
 * pourquoi — le jour où trois camps seront permis, il le dira sans être retouché.
 */
function formatLabel(teamCount: number): string {
  return teamCount === 2 ? t("room.formatDuel") : t("room.formatPlayers", { players: teamCount });
}
