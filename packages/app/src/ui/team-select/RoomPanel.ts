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

  const list = document.createElement("dl");
  list.className = "ts-room-settings-list";

  const rows: readonly (readonly [string, string])[] = [
    [t("room.map"), props.mapName],
    [t("room.format"), t("lobby.format.option", { players: props.teamCount })],
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
