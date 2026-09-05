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
import { createFormatPickerElement } from "../../team-select/FormatPicker";
import { renderPreservingFocus } from "../preserve-focus";
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
export function createLobbyScreen(navigate: Navigate): Screen<"lobby"> {
  let root: HTMLElement | null = null;
  let wheel: CodeWheel | null = null;
  let unregisterInput: (() => void) | undefined;
  // `REQUIRED_TEAM_COUNTS` est un tuple `as const`, donc son premier élément existe à la compilation :
  // le repli `?? 2` qui traînait ici était une branche inatteignable, et sa valeur en dur un second
  // endroit où le format par défaut était écrit.
  let selectedTeamCount: number = REQUIRED_TEAM_COUNTS[0];
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

  /**
   * La rangée de formats du `lobby` n'annonce que le **nombre de joueurs**, là où celle de l'écran
   * d'équipe dit « 2J × 6 ».
   *
   * Ce n'est pas une simplification : le nombre de Pokemon par camp est
   * `min(places de spawn de la carte, plafond de jeu / nombre de camps)`, donc il **dépend de la
   * carte** — et à ce stade aucune carte n'est choisie. Annoncer un « × 6 » qui pourrait devenir
   * « × 4 » au chargement du terrain serait un mensonge.
   *
   * La liste vient de `REQUIRED_TEAM_COUNTS`, la source de vérité existante (décision #907) : toute
   * carte doit déclarer les cinq formats pour être valide, `validateTiledMap` levant une erreur
   * sinon. D'où ni filtrage des cartes par format, ni revalidation du couple au lancement.
   */
  const buildFormatPicker = (): HTMLElement =>
    createFormatPickerElement(
      REQUIRED_TEAM_COUNTS.map((teamCount) => ({
        key: String(teamCount),
        label: t("lobby.format.option", { players: teamCount }),
      })),
      String(selectedTeamCount),
      t("lobby.format.label"),
      {
        onChange: (key) => {
          selectedTeamCount = Number(key);
          refreshFormatPicker();
        },
      },
    );

  let formatPicker: HTMLElement | null = null;

  /**
   * 🔴 Passe par `renderPreservingFocus` : remplacer la rangée détruit le segment **focalisé**, donc
   * changer de format au clavier ou à la manette éjectait le liseré vers `<body>`, d'où
   * `focusInDirection` réentrait sur le premier contrôle de l'écran. C'est la régression du plan 194
   * (#835), que `FormatPicker` documente et que `gamepad-menus.spec` couvre pour l'écran d'équipe —
   * mais pas pour le `lobby`, qui est neuf.
   */
  const refreshFormatPicker = (): void => {
    const host = formatPicker?.parentElement;
    if (!formatPicker || host === null || host === undefined) {
      return;
    }
    renderPreservingFocus(host, () => {
      const replacement = buildFormatPicker();
      formatPicker?.replaceWith(replacement);
      formatPicker = replacement;
    });
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
      formatPicker = buildFormatPicker();
      createSection.append(createHeading, formatPicker, menuButton(t("lobby.create"), createRoom));

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
      formatPicker = null;
      errorText = null;
      root?.remove();
      root = null;
    },
  };
}
