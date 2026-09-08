import { REQUIRED_TEAM_COUNTS } from "@pokemon-tactic/data";
import { isValidRoomCode, RoomRole } from "@pokemon-tactic/network";
import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import {
  activateFocusedControl,
  focusableControls,
  focusInDirection,
} from "../../../input/focus-navigation";
import { InputSource } from "../../../input/input-source";
import { getInputSystem } from "../../../input/input-system";
import { type CodeWheel, createCodeWheel } from "../../lobby/code-wheel";
import { el, menuButton } from "./elements";

/**
 * L'écran `lobby` (plan 199, étape 4) — la porte d'entrée du jeu en ligne, et rien de plus : on y
 * choisit un format puis on crée, ou on saisit un code puis on rejoint.
 *
 * **Il n'y a pas de second écran de salon** (décision #897) : la salle d'attente est l'écran de
 * sélection d'équipe, qui porte déjà les lignes par camp. Le `lobby` se réduit donc à ces deux
 * gestes.
 *
 * Le **format se choisit avant la création** (décision #896). Le nombre de places est ainsi fixé
 * avant que le code n'existe, ce qui supprime le cas où changer de format devrait éjecter un joueur
 * déjà entré.
 *
 * ⚠️ Rien n'est créé ici : le code naît à l'entrée sur l'écran de sélection d'équipe, là où l'hôte
 * attend, donc là où il le partage.
 */
/**
 * Formats offerts **en ligne** : le 1v1 seulement.
 *
 * 🔴 Le combat en réseau n'est correct qu'à deux pairs, et c'est structurel, pas un manque de
 * finition. Le garde-fou d'index (décision D3) suppose un canal fiable et ordonné : vrai **par
 * connexion**, donc exact à deux. À trois camps, `Room.broadcast` écrit sur deux canaux distincts et
 * rien n'ordonne l'un par rapport à l'autre — une action arrivée en avance serait refusée comme un
 * décalage, sur un joueur parfaitement honnête, puis **perdue** faute de renvoi. Trois refus
 * l'éliminent (relevé en revue de code du Lot B2).
 *
 * Le FFA en réseau est hors V1 de toute façon (plan-cadre 195). Mieux vaut ne pas proposer un format
 * que le proposer cassé — le mode **local**, lui, garde les cinq.
 *
 * Le jour où le maillage gardera les actions hors séquence, cette constante redevient
 * `REQUIRED_TEAM_COUNTS`.
 */
const ONLINE_TEAM_COUNTS = REQUIRED_TEAM_COUNTS.filter((teamCount) => teamCount === 2);

export function createLobbyScreen(navigate: Navigate): Screen<"lobby"> {
  let root: HTMLElement | null = null;
  let wheel: CodeWheel | null = null;
  let unregisterInput: (() => void) | undefined;
  // `REQUIRED_TEAM_COUNTS` est un tuple `as const`, donc son premier élément existe à la compilation :
  // le repli `?? 2` qui traînait ici était une branche inatteignable, et sa valeur en dur un second
  // endroit où le format par défaut était écrit.
  const selectedTeamCount: number = ONLINE_TEAM_COUNTS[0] ?? 2;
  let errorText: HTMLElement | null = null;

  const goBack = (): void => navigate("battle-mode", undefined);

  const createRoom = (): void => {
    navigate("map-select", { network: { role: RoomRole.Host, teamCount: selectedTeamCount } });
  };

  const joinRoom = (): void => {
    const code = wheel?.code() ?? "";
    // Le seul refus que cet écran sait prononcer seul : la forme du code. « Ce code n'existe pas »
    // demande d'avoir essayé de joindre l'hôte, ce que fait la salle d'attente.
    if (!isValidRoomCode(code)) {
      showError(t("lobby.invalidCode"));
      return;
    }
    navigate("team-select", { network: { role: RoomRole.Guest, code } });
  };

  const showError = (message: string): void => {
    if (errorText) {
      errorText.textContent = message;
    }
  };

  /**
   * Le déplacement horizontal **dans** la roue : l'emplacement voisin s'il existe, sinon le contrôle
   * qui la précède ou la suit dans l'ordre du document.
   *
   * 🔴 La roue prend l'axe horizontal **en entier**, elle ne le délègue pas à `focusInDirection`.
   * Mesuré à la recette : la navigation spatiale sortait bien de la roue par le côté, mais vers la
   * **rangée de formats** — et selon la taille du viewport, tantôt vers « Rejoindre », tantôt vers un
   * segment de format. La roue étant centrée, il n'y a rien à sa hauteur ni à gauche ni à droite,
   * donc la navigation spatiale n'avait aucune bonne réponse à donner et prenait la moins mauvaise.
   *
   * L'ordre du document est ici la bonne référence, précisément parce que la géométrie ne dit rien.
   */
  const moveWithinWheel = (direction: "left" | "right"): void => {
    const wheelElement = wheel?.element;
    const active = document.activeElement;
    if (wheelElement === undefined || !(active instanceof HTMLElement)) {
      return;
    }
    const step = direction === "left" ? -1 : 1;
    const slot = Number(active.dataset.slot ?? "0");
    const neighbourSlot = wheelElement.querySelector<HTMLElement>(`[data-slot="${slot + step}"]`);
    if (neighbourSlot !== null) {
      neighbourSlot.focus();
      return;
    }
    // Au bord de la roue : on en sort.
    const controls = focusableControls();
    const inWheel = controls
      .map((control, index) => (wheelElement.contains(control) ? index : -1))
      .filter((index) => index !== -1);
    const first = inWheel[0];
    const last = inWheel.at(-1);
    if (first === undefined || last === undefined) {
      return;
    }
    (direction === "left" ? controls[first - 1] : controls[last + 1])?.focus();
  };

  return {
    mount(host) {
      countScreen(TelemetryScreen.Lobby);
      root = el("div", "mn-screen lb-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("lobby.title");

      const createSection = el("section", "lb-section");
      const createHeading = el("h2", "lb-section-title");
      createHeading.textContent = t("lobby.createTitle");
      /*
       * 🔴 Une LIGNE, pas un sélecteur, parce que le réseau est 1v1 (voir `ONLINE_TEAM_COUNTS`).
       *
       * La rangée segmentée est restée jusqu'à ce qu'un test de manette la prenne en défaut : à une
       * seule option, un segment est un **contrôle mort** — toujours sélectionné, sans alternative,
       * et il occupait pourtant un arrêt de focus au clavier comme au pad. Le format reste dit, il
       * n'est simplement plus présenté comme un choix.
       */
      const formatLine = el("p", "lb-format");
      formatLine.textContent = `${t("lobby.format.label")} ${t("lobby.format.option", {
        players: selectedTeamCount,
      })}`;
      createSection.append(createHeading, formatLine, menuButton(t("lobby.create"), createRoom));

      const joinSection = el("section", "lb-section");
      const joinHeading = el("h2", "lb-section-title");
      joinHeading.textContent = t("lobby.joinTitle");
      wheel = createCodeWheel({
        onChange: () => showError(""),
        onConfirm: joinRoom,
      });
      const hint = el("p", "lb-hint");
      hint.textContent = t("lobby.wheelHint");
      errorText = el("p", "lb-error", "lobby-error");
      errorText.role = "alert";
      joinSection.append(
        joinHeading,
        wheel.element,
        hint,
        menuButton(t("lobby.join"), joinRoom),
        errorText,
      );

      root.append(title, createSection, joinSection, menuButton(t("lobby.back"), goBack));
      host.append(root);

      // Écran monté alors que le joueur navigue au clavier ou à la manette : on lui donne un point
      // de départ, sinon il devrait presser une flèche « pour rien » avant que quoi que ce soit ne
      // réagisse (même raison que `bindScreenInput`, que cet écran ne peut pas utiliser).
      const system = getInputSystem();
      if (system?.tracker.isFocusDriven() === true) {
        focusableControls()[0]?.focus();
      }

      // Écran à consommateur propre, comme l'écran de terrain : haut/bas appartient à la ROUE quand
      // le focus y est, pas à la navigation spatiale, qui sortirait de la roue par le haut.
      unregisterInput = getInputSystem()?.register({
        context: () => "screen",
        menu: {
          /*
           * 🔴 Quand le focus est dans la roue, **les deux axes lui appartiennent** — et c'est un
           * écart assumé à la règle du projet (« un contrôle garde l'axe qu'il utilise, la couche
           * prend l'autre »).
           *
           * Motif mesuré à la recette multi-entrée, en deux temps. D'abord la roue était un piège à
           * focus complet : haut/bas défilent l'alphabet, qui **boucle** donc n'atteint jamais de
           * butée, et aux extrémités la navigation spatiale ne trouvait rien à gauche ni à droite —
           * la roue est centrée, avec des boutons au-dessus et au-dessous. Au clavier il restait
           * `Tab` ; à la manette, plus aucune issue que B, qui quitte l'écran.
           * Ensuite, en confiant l'horizontal à `focusInDirection`, la sortie **dépendait de la
           * taille du viewport** : tantôt « Rejoindre », tantôt un segment de format. La géométrie
           * n'a pas de bonne réponse à donner ici, donc on ne la lui demande plus.
           */
          focusMove: (direction) => {
            if (wheel?.holdsFocus() === true) {
              if (direction === "up" || direction === "down") {
                wheel.step(direction);
                return;
              }
              moveWithinWheel(direction);
              return;
            }
            focusInDirection(direction);
          },
          confirm: () => {
            // Au clavier, le navigateur active nativement le contrôle focalisé, et la roue traite
            // `Entrée` elle-même : réclamer la touche ici doublerait le traitement.
            if (getInputSystem()?.tracker.current() !== InputSource.Gamepad) {
              return false;
            }
            // À la manette il faut activer soi-même. Dans la roue, `A` vaut « Rejoindre » : activer
            // le bouton d'emplacement focalisé ne voudrait rien dire.
            if (wheel?.holdsFocus() === true) {
              joinRoom();
              return true;
            }
            return activateFocusedControl();
          },
          cancel: () => {
            goBack();
            return true;
          },
        },
      });
    },
    dispose() {
      unregisterInput?.();
      unregisterInput = undefined;
      wheel?.dispose();
      wheel = null;
      errorText = null;
      root?.remove();
      root = null;
    },
  };
}
