import { isValidRoomCode, type NetworkErrorCode, Room, RoomRole } from "@pokemon-tactic/network";
import {
  countAction,
  countScreen,
  ROOM_FAILURE_ACTIONS,
  TelemetryAction,
  TelemetryScreen,
} from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import {
  activateFocusedControl,
  focusableControls,
  focusInDirection,
} from "../../../input/focus-navigation";
import { InputSource } from "../../../input/input-source";
import { getInputSystem } from "../../../input/input-system";
import { networkErrorCodeOf } from "../../../network/network-error";
import { holdOnlineRoom, onlineRoomDeps } from "../../../network/online-room";
import { type CodeWheel, createCodeWheel } from "../../lobby/code-wheel";
import { openJoinRefusalModal } from "../../lobby/join-refusal-modal";
import { cancelToModalOrBack, el, menuButton, screenHeader, screenHeaderTitle } from "./elements";

/**
 * L'écran `lobby` (plan 199, étape 4) — la porte d'entrée du jeu en ligne, et rien de plus : on y
 * héberge une partie, ou on saisit un code pour rejoindre celle de quelqu'un.
 *
 * **Il n'y a pas de second écran de salon** (décision #897) : la salle d'attente est l'écran de
 * sélection d'équipe, qui porte déjà les lignes par camp. Le `lobby` se réduit donc à ces deux
 * gestes.
 *
 * ⚠️ Rien n'est créé ici POUR L'HÔTE : son code naît à l'entrée sur l'écran de sélection d'équipe,
 * là où il attend, donc là où il le partage. L'INVITÉ, lui, se connecte depuis ici depuis le plan
 * 207 — voir `joinRoom`.
 *
 * Deux gestes, deux panneaux (plan 207, étape 1). Ils ne se distinguaient pas, et chacun se disait
 * **deux fois** : le titre de section et le bouton portaient le même libellé (« Créer une partie »
 * en haut ET sur le bouton, « Rejoindre une partie » puis « Rejoindre »). Retour de l'humain sur les
 * deux. Les titres ont donc disparu : chaque panneau s'identifie par ce qu'il raconte et par son
 * bouton, qui reste le seul à nommer l'action.
 */

/**
 * Le nombre de camps d'une partie en ligne : **deux**, et ce n'est pas un manque de finition.
 *
 * 🔴 Le garde-fou d'index (décision D3) suppose un canal fiable et ordonné : vrai **par connexion**,
 * donc exact à deux. À trois camps, `Room.broadcast` écrit sur deux canaux distincts et rien
 * n'ordonne l'un par rapport à l'autre — une action arrivée en avance serait refusée comme un
 * décalage, sur un joueur parfaitement honnête, puis **perdue** faute de renvoi. Trois refus
 * l'éliminent (relevé en revue de code du Lot B2).
 *
 * Le FFA en réseau est hors V1 de toute façon (plan-cadre 195). Mieux vaut ne pas proposer un format
 * que le proposer cassé — le mode **local**, lui, garde les cinq.
 *
 * 🔴 Et il n'est plus AFFICHÉ ici (plan 207, étape 2). La ligne « Joueurs : 2 joueurs » a été
 * retirée : l'humain ne la comprenait pas, et il avait raison sur le fond — à ce stade le format
 * n'est pas encore décidé, il se choisit à l'écran suivant. Ce que cette constante grave, c'est le
 * nombre de camps, pas le format complet. Le format est en revanche rendu franchement lisible dans
 * l'encart de salon (`RoomPanel.ts`), et ce n'était pas reportable : sans ça, l'étape 2 retirait la
 * seule mention lue AVANT que le joueur investisse du temps dans sa composition (revue de
 * game-designer).
 */
const ONLINE_TEAM_COUNT = 2;

export function createLobbyScreen(navigate: Navigate): Screen<"lobby"> {
  let root: HTMLElement | null = null;
  let wheel: CodeWheel | null = null;
  let unregisterInput: (() => void) | undefined;
  let errorText: HTMLElement | null = null;
  let joinButton: HTMLButtonElement | null = null;
  let pasteButton: HTMLButtonElement | null = null;
  /** Une seule tentative de connexion à la fois : le bouton se rappuie, la roue se re-valide. */
  let joining = false;

  const goBack = (): void => navigate("battle-mode", undefined);

  const createRoom = (): void => {
    navigate("map-select", { network: { role: RoomRole.Host, teamCount: ONLINE_TEAM_COUNT } });
  };

  /**
   * Rejoindre : on se connecte **avant** de quitter l'écran (plan 207, étape 5).
   *
   * 🔴 C'est le cœur du plan. Avant, `joinRoom` naviguait sur la foi de la seule forme du code, et
   * la connexion était tentée par la salle d'attente : un code mal recopié posait le joueur devant
   * un écran complet de composition d'équipe pour une partie qui n'existe pas, le refus réduit à une
   * ligne rouge en bas du pied de page. Désormais il ne quitte le lobby que si la partie existe, et
   * sinon il est toujours devant sa roue, prêt à corriger.
   *
   * Le salon joint est confié à la SESSION (`holdOnlineRoom`) et non passé en paramètre de
   * navigation : c'est déjà là qu'il vit depuis le plan 199, précisément pour survivre aux
   * transitions d'écran. La salle d'attente l'y adopte.
   */
  const joinRoom = async (): Promise<void> => {
    if (joining) {
      return;
    }
    const code = wheel?.code() ?? "";
    // Le seul refus que cet écran sache prononcer SANS réseau : la forme du code. Inutile de
    // déranger un annuaire de mise en relation pour un code à quatre caractères.
    if (!isValidRoomCode(code)) {
      showError(t("lobby.invalidCode"));
      return;
    }
    setJoining(true);
    try {
      const room = await Room.join(onlineRoomDeps(), code);
      countAction(TelemetryAction.RoomJoined);
      holdOnlineRoom(room);
      navigate("team-select", { network: { role: RoomRole.Guest, code } });
    } catch (error) {
      setJoining(false);
      showRefusal(networkErrorCodeOf(error));
    }
  };

  /**
   * L'état d'attente. Il ne sert pas qu'à faire joli : joindre un pair passe par un annuaire de mise
   * en relation, donc ça prend un temps visible — sans ce retour, « Rejoindre » avait l'air de ne
   * rien faire, et le joueur rappuyait.
   */
  const setJoining = (active: boolean): void => {
    joining = active;
    if (joinButton) {
      joinButton.disabled = active;
      joinButton.textContent = active ? t("lobby.connecting") : t("lobby.join");
    }
    if (pasteButton) {
      pasteButton.disabled = active;
    }
  };

  const showRefusal = (code: NetworkErrorCode): void => {
    /*
     * 🔴 Le compteur par cause SUIT le refus là où il se prononce désormais.
     *
     * Il vivait dans `showNetworkError` de la salle d'attente, où la connexion était tentée jusqu'au
     * plan 207. Déplacer la tentative sans déplacer le compteur aurait rendu MUETTES les six causes
     * d'échec de mise en relation côté invité — or c'est le signal le plus brûlant de la télémétrie
     * en ligne : la traversée de pare-feu est assumée faillible en V1, et sans compteur par cause on
     * ne sait pas si le pair-à-pair sans relais est tenable (plan 199, étape 7).
     *
     * Pas de double comptage : la salle d'attente compte toujours SES propres refus (échec de
     * création côté hôte, erreurs de salon en cours de route), qui sont d'autres événements.
     */
    countAction(ROOM_FAILURE_ACTIONS[code]);
    showError("");
    openJoinRefusalModal(code, {
      /*
       * Le joueur corrige : on lui rend la roue, sur son PREMIER emplacement.
       *
       * Le commentaire disait « là où il l'avait laissée » — c'était faux, `focusWheel` prend
       * toujours le premier (relevé en revue de code). Et le premier est le bon : un refus « ce code
       * ne correspond à aucune partie » ne dit pas QUEL caractère est faux, donc on relit depuis le
       * début. Rendre l'emplacement actif reviendrait à désigner un coupable qu'on ne connaît pas.
       */
      onRetry: () => focusWheel(),
      onBackToMenu: () => navigate("main-menu", undefined),
    });
  };

  const focusWheel = (): void => {
    wheel?.element.querySelector<HTMLElement>("[data-slot]")?.focus();
  };

  const showError = (message: string): void => {
    if (!errorText) {
      return;
    }
    errorText.textContent = message;
    /*
     * 🔴 `hidden` et pas seulement un texte vide : la ligne est un élément de la colonne flex, donc
     * le `gap` du panneau s'applique à elle **même à hauteur nulle**. Mesuré à la recette — 15 px
     * d'écart subsistaient en pied de la carte « Rejoindre » après avoir retiré sa hauteur réservée,
     * et c'est ce gap-là qu'on voyait. `display: none` la sort du flux, gap compris.
     */
    errorText.hidden = message === "";
  };

  /**
   * Le bouton « Coller » (plan 207, étape 3). Demandé par l'humain comme « des instructions pour dire
   * qu'on peut coller » — un bouton vaut mieux qu'une instruction : il marche aux quatre entrées, il
   * se voit, et il n'y a rien à expliquer. Il est le symétrique du « Copier » que l'hôte a déjà dans
   * son encart de salon.
   *
   * Motif décisif, mesuré : l'astuce clavier (`lobby.wheelHint`) est masquée sous `pointer: coarse`,
   * à raison — il n'y a pas de flèches au doigt. Donc sur téléphone il n'y avait **aucune**
   * indication de saisie.
   *
   * L'événement `paste` de la roue reste, et couvre ce que ce bouton ne peut pas : le clic droit et
   * le menu de collage du téléphone, qui ne passent par aucune touche.
   */
  const pasteFromClipboard = async (): Promise<void> => {
    /*
     * `readText()` n'existe pas partout : détection avant l'appel, et un message qui nomme la sortie
     * valable partout — la roue traite l'événement `paste`, donc `Ctrl+V`, le clic droit → Coller et
     * le menu de collage du téléphone marchent même là où ce bouton ne peut rien.
     */
    if (typeof navigator.clipboard?.readText !== "function") {
      showError(t("lobby.pasteUnavailable"));
      focusWheel();
      return;
    }
    /*
     * 🔴 **Aucune borne de temps sur cette attente** — et c'est un correctif de recette, pas un
     * oubli.
     *
     * Une première version bornait l'appel à deux secondes, parce qu'en automatisation (document
     * sans focus) il reste pendant indéfiniment. L'humain l'a pris en défaut sur **Firefox** : là,
     * `readText()` n'est pas refusé, il ouvre une confirmation « Coller » que le joueur doit
     * cliquer — et cliquer prend plus de deux secondes. La borne affichait donc « collage
     * impossible » PAR-DESSUS une confirmation encore ouverte, et condamnait le seul chemin qui
     * fonctionnait.
     *
     * L'attente est donc sans limite, mais **visible** : le bouton reste désactivé tant que le
     * joueur n'a pas répondu. Le cas « pendant indéfiniment » ne concerne qu'une page sans focus,
     * ce qui n'arrive pas à quelqu'un qui vient de cliquer.
     */
    let pasted: string;
    if (pasteButton) {
      pasteButton.disabled = true;
    }
    try {
      pasted = await navigator.clipboard.readText();
    } catch {
      showError(t("lobby.pasteUnavailable"));
      focusWheel();
      return;
    } finally {
      if (pasteButton) {
        pasteButton.disabled = joining;
      }
    }
    if (wheel?.paste(pasted) !== true) {
      showError(t("lobby.pasteEmpty"));
      return;
    }
    showError("");
    focusWheel();
  };

  return {
    mount(host) {
      countScreen(TelemetryScreen.Lobby);
      /*
       * Patron « écran plein » du projet : en-tête « ◀ Retour  Jouer en ligne », puis le contenu.
       *
       * 🔴 C'était le patron *menu* (`mn-screen` : pile centrée, titre doré, retour en dernier)
       * jusqu'au 2026-09-11, et les cartes encadrées du plan 207 en avaient fait un hybride que
       * l'humain a refusé : « en gros on a deux layouts, menu ou plein écran avec un header et le
       * bouton retour en haut. Essayons de rester consistant ». Les cartes, elles, lui vont — c'est
       * la mise en page « qui correspond à rien » qui le gênait.
       */
      root = el("div", "scr-root lb-screen");
      const header = screenHeader(goBack);
      header.append(screenHeaderTitle(t("lobby.title")));
      const body = el("div", "lb-body");

      // 🔴 Le testid du PANNEAU est distinct de celui du bouton qu'il contient. Nommer le panneau
      // `lobby-join` comme son bouton faisait deux nœuds pour un même testid, donc un localisateur
      // ambigu et un échec en mode strict de Playwright. Trouvé en mesurant.
      const createPanel = el("section", "lb-panel", "lobby-panel-create");
      const createButton = menuButton(t("lobby.create"), createRoom);
      createButton.dataset.testid = "lobby-create";
      /*
       * La note passe SOUS le bouton, en italique et estompée (retour humain, recette du plan 207).
       *
       * Elle disait d'abord « Tu héberges la partie. Ton adversaire te rejoint avec ton code. », en
       * tête de panneau : trop bavard pour ce qu'il y a à dire, et l'humain butait sur le singulier
       * d'« adversaire ». Elle ne compte donc plus les joueurs du tout et répond à la seule question
       * que cet écran laisse ouverte — **où est mon code ?** Il naît à l'écran suivant, pas ici
       * (décision #896), et rien ne le disait.
       */
      const createHint = el("p", "lb-panel-note");
      createHint.textContent = t("lobby.createHint");
      createPanel.append(createButton, createHint);

      const joinPanel = el("section", "lb-panel", "lobby-panel-join");
      const joinHint = el("p", "lb-panel-hint");
      joinHint.textContent = t("lobby.joinHint");
      wheel = createCodeWheel({
        onChange: () => showError(""),
        onConfirm: () => void joinRoom(),
      });
      /*
       * L'astuce clavier reçoit le même traitement que la note de « Créer » (retour humain, même
       * recette) : italique estompée, et POSÉE SOUS les boutons plutôt qu'entre la roue et eux, où
       * elle coupait le geste en deux.
       *
       * Elle garde `lb-hint` en plus de l'allure commune, et c'est le seul rôle qui lui reste :
       * servir de crochet à la règle qui la masque sous `pointer: coarse`. Une astuce qui parle de
       * flèches est une information FAUSSE au doigt.
       */
      const hint = el("p", "lb-panel-note lb-hint");
      hint.textContent = t("lobby.wheelHint");
      pasteButton = menuButton(t("lobby.paste"), () => void pasteFromClipboard());
      pasteButton.classList.add("lb-paste");
      pasteButton.dataset.variant = "ghost";
      pasteButton.dataset.testid = "lobby-paste";
      joinButton = menuButton(t("lobby.join"), () => void joinRoom());
      joinButton.dataset.testid = "lobby-join";
      errorText = el("p", "lb-error", "lobby-error");
      errorText.role = "alert";
      // Montée à vide : rien à dire encore, donc rien à occuper (voir `showError`).
      errorText.hidden = true;
      /*
       * « Coller » siège À CÔTÉ de « Tu as reçu un code ? » (retour humain, recette du plan 207).
       *
       * Il était sous la roue, entre elle et « Rejoindre », où il s'alignait avec le bouton de
       * validation sans en être un. Sa place est auprès de la question qu'il répond : on a reçu un
       * code, il est au presse-papier, on le colle. La rangée les met sur la même ligne de base.
       */
      const joinHeader = el("div", "lb-join-header");
      joinHeader.append(joinHint, pasteButton);
      // L'astuce reste SOUS LA ROUE (retour humain) : elle explique comment la manipuler, donc sa
      // place est contre elle, pas sous le bouton qui valide.
      joinPanel.append(joinHeader, wheel.element, hint, joinButton, errorText);

      body.append(createPanel, joinPanel);
      root.append(header, body);
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
           *
           * Une modale ouverte reprend les deux axes : le `<dialog>` piège le focus, donc
           * `holdsFocus()` est faux et `focusInDirection` se cadre de lui-même sur la modale
           * (`focusableControls`).
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
              void joinRoom();
              return true;
            }
            return activateFocusedControl();
          },
          // 🔴 Partagé avec `bindScreenInput` depuis le plan 207 : cet écran annulait
          // INCONDITIONNELLEMENT, donc à la manette B quittait le lobby par-dessous une modale
          // ouverte au lieu de la refermer.
          cancel: () => cancelToModalOrBack(goBack),
        },
      });
    },
    dispose() {
      unregisterInput?.();
      unregisterInput = undefined;
      wheel?.dispose();
      wheel = null;
      errorText = null;
      joinButton = null;
      pasteButton = null;
      joining = false;
      root?.remove();
      root = null;
    },
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
  function moveWithinWheel(direction: "left" | "right"): void {
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
  }
}
