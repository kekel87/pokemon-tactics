import { t } from "../../i18n";

/**
 * Le **bandeau de partie**, en tête de l'écran de sélection d'équipe.
 *
 * 🔴 Il s'appelait `RoomPanel` et n'existait qu'en ligne (plan 199, étape 5) : le code de partie et
 * les paramètres, posés là parce que l'écran de sélection d'équipe sert aussi de **salle d'attente**
 * (décision #897). Le plan 208 l'étend au solo, où il porte désormais la carte et le bouton qui la
 * change — d'où le renommage. `RoomPanel` / `ts-room-*` ne décrivaient plus ce qu'il fait, et un nom
 * qui ment coûte plus cher qu'un renommage.
 *
 * Ce qu'il montre, selon le mode :
 *
 * |             | En ligne                        | En solo                          |
 * |-------------|---------------------------------|----------------------------------|
 * | Bloc gauche | le code + « Copier »            | « Passer en partie en ligne »    |
 * | Bloc droit  | Carte, Format, options          | Carte, options                   |
 *
 * La carte est un **bouton qui porte son propre nom** (« Archipel des Pontons ⌄ ») partout où elle
 * se change — en solo, et pour l'hôte en ligne. Un invité n'en voit que le nom, en texte.
 */

export interface GamePanelProps {
  /** Le code du salon, `null` en solo — il n'y a pas de partie à partager. */
  code: string | null;
  /** Le nom affiché de la carte : « Aléatoire » tant qu'un tirage n'est pas joué. */
  mapName: string;
  /** Le nombre de joueurs du format. Gravé depuis le `lobby` en ligne, jamais modifiable ici. */
  teamCount: number;
  autoPlacement: boolean;
  damagePreview: boolean;
  /**
   * Vrai pour l'hôte. Les deux options restent alors éditables **dans le pied de l'écran**, où elles
   * vivaient déjà (plan 198) : le bandeau ne les redouble pas, il les rappelle en lecture seule pour
   * ceux qui ne les décident pas.
   */
  isHost: boolean;
  /**
   * Qui peut changer de carte : le joueur en solo, l'hôte en ligne. Jamais un invité — la carte lui
   * arrive de l'hôte, il n'a rien à choisir (plan 199).
   */
  canChangeMap: boolean;
}

export interface GamePanelCallbacks {
  onCopyCode: (code: string) => void;
  onChangeMap: () => void;
  /** Bascule solo → partie en ligne. Sans effet en ligne : on y est déjà. */
  onGoOnline: () => void;
}

export function createGamePanelElement(
  props: GamePanelProps,
  callbacks: GamePanelCallbacks,
): HTMLElement {
  // `<div>` et non `<section>` : le bandeau n'a pas de titre propre, et `.claude/rules/html.md`
  // réserve `<section>` à ce qui porte un heading.
  const panel = document.createElement("div");
  panel.className = "ts-game-panel";
  panel.dataset.testid = "game-panel";

  panel.append(buildLeadBlock(props, callbacks), buildSettingsBlock(props, callbacks));
  return panel;
}

/** Le bloc de gauche : le code en ligne, l'issue vers le jeu en ligne en solo. */
function buildLeadBlock(props: GamePanelProps, callbacks: GamePanelCallbacks): HTMLElement {
  return props.code === null
    ? buildGoOnlineBlock(callbacks)
    : buildCodeBlock(props.code, callbacks);
}

function buildCodeBlock(code: string, callbacks: GamePanelCallbacks): HTMLElement {
  const block = document.createElement("div");
  block.className = "ts-game-code";

  const caption = document.createElement("span");
  caption.className = "ts-game-code-caption";
  caption.textContent = t("room.codeCaption");

  // Le code d'un bloc (`A7K2M`), jamais avec son préfixe d'espace de noms : `pkmntac-` est une
  // affaire d'adressage, pas quelque chose qu'un joueur recopie.
  const value = document.createElement("output");
  value.className = "ts-game-code-value";
  value.dataset.testid = "room-code";
  value.textContent = code;

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "tb-btn";
  copy.dataset.variant = "ghost";
  copy.dataset.testid = "room-code-copy";
  copy.textContent = t("room.copy");
  copy.addEventListener("click", () => callbacks.onCopyCode(code));

  block.append(caption, value, copy);
  return block;
}

/**
 * En solo, la place du code accueille l'issue vers le jeu en ligne (plan 208, étape 5).
 *
 * Idée de l'humain, dans ses mots : « je me demande si y'a pas un mode où en solo, à la place du
 * code, on propose pas un bouton pour créer une partie multi (genre il s'est trompé), vu qu'on a le
 * bandeau ». Il n'y a aucune navigation derrière : la salle d'attente EST cet écran, donc la
 * composition en cours ne traverse rien.
 */
function buildGoOnlineBlock(callbacks: GamePanelCallbacks): HTMLElement {
  const block = document.createElement("div");
  block.className = "ts-game-go-online";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tb-btn";
  button.dataset.variant = "ghost";
  button.dataset.testid = "game-go-online";
  button.textContent = t("teamSelect.online.goOnline");
  button.addEventListener("click", () => callbacks.onGoOnline());

  block.append(button);
  return block;
}

function buildSettingsBlock(props: GamePanelProps, callbacks: GamePanelCallbacks): HTMLElement {
  const block = document.createElement("div");
  block.className = "ts-game-settings";
  block.dataset.testid = "room-settings";

  /*
   * 🔴 La CARTE a quitté la liste des paramètres pour sa propre ligne (plan 208), et pas seulement
   * pour faire de la place à un bouton.
   *
   * C'est le seul paramètre de ce bandeau qui se **change** depuis ici, maintenant que l'écran de
   * choix du terrain n'existe plus. La laisser dans la liste en lecture seule, un bouton accroché à
   * sa ligne de définition, aurait donné une liste dont une entrée sur trois est interactive —
   * exactement ce que le format a fui au plan 207.
   */
  const mapRow = document.createElement("p");
  mapRow.className = "ts-game-map";
  mapRow.dataset.testid = "room-map";

  const mapCaption = document.createElement("span");
  mapCaption.className = "ts-game-map-caption";
  mapCaption.textContent = t("room.map");

  // 🔴 Le NOM porte son propre testid, séparé de la légende et du bouton : lire le `<p>` entier
  // rendait « Carte · Volcan ActifChanger de carte », donc toute assertion sur le nom devait
  // découper une chaîne — et le test de reprise s'y est fait prendre en comparant ce paquet au
  // libellé du menu.
  const mapValue = document.createElement("span");
  mapValue.dataset.testid = "room-map-name";
  mapValue.textContent = props.mapName;

  /*
   * 🔴 Le NOM DE LA CARTE **est** le bouton (retour humain, recette du 2026-09-11).
   *
   * Il y avait avant deux éléments côte à côte — « Carte · <nom> » puis « Changer de carte » — et le
   * bouton se DÉPLAÇAIT horizontalement selon la longueur du nom : « la taille varie en fonction du
   * titre de la carte, j'aime pas ». Fondre les deux règle le défaut à la racine plutôt que de le
   * compenser : il ne reste qu'un élément à droite, son bord droit est ancré, et rien ne bouge quand
   * le nom change.
   *
   * C'est aussi le patron d'un sélecteur — le contrôle porte la valeur courante et l'ouvre au clic —
   * et il économise un arrêt de focus au clavier comme à la manette.
   */
  if (props.canChangeMap) {
    const change = document.createElement("button");
    change.type = "button";
    change.className = "tb-btn ts-game-map-button";
    change.dataset.variant = "ghost";
    change.dataset.testid = "room-change-map";
    /*
     * Le nom visible EST le nom accessible du bouton ; le chevron n'est que décoratif, d'où
     * `aria-hidden` — sans quoi il entrerait dans le nom lu par `getByRole`.
     *
     * 🔴 Un chevron TRACÉ EN CSS, pas un caractère. `⌄` (U+2304) est dessiné bas dans sa boîte et
     * penchait sous la ligne de base du nom — « pas centré verticalement » (recette 2026-09-13) ;
     * le recentrer aurait voulu dire compenser une métrique de police qui change avec la police.
     * Deux bordures tournées à 45° se centrent exactement, partout, et n'ajoutent pas un émoji de
     * plus à un projet dont les icônes sont déjà au backlog.
     */
    const chevron = document.createElement("span");
    chevron.className = "ts-game-map-chevron";
    chevron.setAttribute("aria-hidden", "true");
    change.append(mapValue, chevron);
    change.addEventListener("click", () => callbacks.onChangeMap());
    mapRow.append(mapCaption, change);
  } else {
    // L'invité ne choisit pas : le nom reste un simple texte, à la même place.
    mapValue.classList.add("ts-game-map-static");
    mapRow.append(mapCaption, mapValue);
  }
  block.append(mapRow);

  /*
   * 🔴 Le format a QUITTÉ la liste des paramètres au plan 207, étape 7, pour sa propre ligne.
   *
   * Motif, relevé en revue de game-designer : l'étape 2 du même plan retire la mention du format de
   * l'écran « Jouer en ligne ». Ce bandeau devenait donc le seul endroit où le joueur peut
   * l'apprendre AVANT d'investir du temps dans sa composition — et il le disait au même corps que
   * « Placement auto », noyé dans quatre lignes de paramètres. Un joueur venu du solo, où cinq
   * formats de camps sont offerts, pouvait ouvrir un salon en croyant inviter plusieurs amis et ne
   * le découvrir qu'en partageant son code.
   *
   * En SOLO il ne s'affiche pas ici : il a son propre sélecteur dans l'en-tête, toujours lu et
   * toujours modifiable, et le redoubler en lecture seule juste au-dessous ne dirait rien de plus.
   */
  if (props.code !== null) {
    const format = document.createElement("p");
    format.className = "ts-game-format";
    format.dataset.testid = "room-format";
    format.textContent = `${t("room.format")} · ${formatLabel(props.teamCount)}`;
    block.append(format);
  }

  const list = document.createElement("dl");
  list.className = "ts-game-settings-list";
  const rows: readonly (readonly [string, string])[] = [
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

  // Seul un invité subit les choix d'un autre. En solo comme pour l'hôte, les bascules du pied sont
  // à portée de main, et le rappel serait faux.
  if (props.code !== null && !props.isHost) {
    const note = document.createElement("p");
    note.className = "ts-game-settings-note";
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
 * tant que le maillage ne garde pas les actions hors séquence, mais ce bandeau n'a pas à savoir
 * pourquoi — le jour où trois camps seront permis, il le dira sans être retouché.
 */
function formatLabel(teamCount: number): string {
  return teamCount === 2 ? t("room.formatDuel") : t("room.formatPlayers", { players: teamCount });
}
