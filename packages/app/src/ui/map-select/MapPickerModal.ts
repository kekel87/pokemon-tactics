import { createMapPreviewStage, type MapPreviewStage } from "@pokemon-tactic/render-babylon";
import { Modal } from "@pokemon-tactic/ui-dom";
import { countAction, TelemetryAction } from "../../analytics/telemetry";
import { getLanguage, t } from "../../i18n";
import { activateFocusedControl, focusInDirection } from "../../input/focus-navigation";
import { InputSource } from "../../input/input-source";
import { getInputSystem } from "../../input/input-system";
import { RANDOM_MAP_ID } from "../../maps/map-choice";
import { MAPS_REGISTRY, type MapEntry } from "../../maps/maps-registry";
import { cancelToModalOrBack, el } from "../dom/screens/elements";

/**
 * Le choix du terrain, en modale (plan 208).
 *
 * 🔴 C'était un ÉCRAN (`map-select`), et le retirer du graphe de navigation est tout l'objet du
 * plan. Le motif n'est pas le confort : changer de carte en solo passait par « Retour », ce qui
 * **démontait l'écran de sélection d'équipe** et jetait la composition en cours. Une modale la
 * préserve, puisque l'écran reste monté dessous.
 *
 * `createMapPreviewStage` accepte n'importe quel conteneur — il y crée son canvas et son voile de
 * chargement — donc il entre dans `Modal.getBody()` sans une ligne d'adaptation.
 */

export interface MapPickerOptions {
  /** La carte retenue à l'ouverture, `RANDOM_MAP_ID` compris. */
  currentMapId: string;
  /** Appelé seulement quand le joueur CONFIRME une carte différente de celle d'entrée. */
  onPick: (mapId: string) => void;
}

/** Une entrée de la liste : les neuf cartes, plus « Aléatoire ». */
interface PickerEntry {
  id: string;
  label: string;
  /**
   * L'entrée de registre, `undefined` pour « Aléatoire » — qui n'est pas une carte et n'a donc ni
   * terrain à montrer, ni dimensions, ni étiquettes.
   *
   * Portée ici plutôt que recherchée au rendu : la liste DÉRIVE du registre, donc une recherche par
   * identifiant ne pouvait pas échouer — et sa branche fausse, morte, aurait silencieusement laissé
   * à l'écran la description de la carte précédente (revue de code du 2026-09-13).
   */
  entry: MapEntry | undefined;
}

/**
 * Ouvre la modale, et rend de quoi la **refermer de l'extérieur**.
 *
 * 🔴 Le retour n'est pas une commodité : la modale vit sur `document.body`, hors de l'arbre de
 * l'écran qui l'ouvre, donc le démontage de cet écran ne l'emporte pas. L'écran de carte qu'elle
 * remplace libérait son aperçu Babylon dans son propre `dispose()` ; il faut rendre cette garantie à
 * l'appelant, sous peine de fuir un moteur de rendu sur une navigation pilotée par le réseau.
 */
export function openMapPickerModal(options: MapPickerOptions): () => void {
  const language = getLanguage();
  /*
   * « Aléatoire » est une entrée VOLONTAIRE à côté des neuf cartes nommées, jamais un remplacement
   * du choix explicite (confirmé par game-designer au cadrage). Ce qu'elle retire, c'est la lecture
   * de carte avant composition — un axe de préparation, pas la profondeur du combat, dont position,
   * hauteur et orientation restent entières. C'est acceptable PARCE QUE c'est opt-in.
   *
   * En ligne elle porte un second motif, écrit au backlog dès le 2026-09-03 : elle évite la
   * **négociation de carte** entre deux joueurs. Un vote avait été évoqué puis écarté au Lot B1 ; le
   * tirage est la réponse bon marché au même problème.
   */
  const entries: PickerEntry[] = [
    ...MAPS_REGISTRY.map((entry) => ({
      id: entry.id,
      label: entry.displayName[language],
      entry,
    })),
    // 🔴 « Aléatoire » EN FIN DE LISTE (retour humain, 2026-09-13), et c'est le patron du projet :
    // le sélecteur d'équipe pose déjà sa ligne « 🎲 Aléatoire » après les équipes sauvegardées
    // (`TeamPickerModal`). Les cartes nommées sont le choix ordinaire, le tirage est l'option qu'on
    // va chercher — les mettre dans cet ordre, c'est le dire sans une ligne de texte.
    { id: RANDOM_MAP_ID, label: t("mapSelect.random"), entry: undefined },
  ];

  let selectedIndex = Math.max(
    entries.findIndex((entry) => entry.id === options.currentMapId),
    0,
  );
  /** Vrai dès que le joueur confirme : c'est ce qui distingue un choix d'un abandon à la fermeture. */
  let picked = false;
  let preview: MapPreviewStage | null = null;
  const listButtons: HTMLButtonElement[] = [];

  countAction(TelemetryAction.MapModalOpen);

  const modal = new Modal({
    title: t("mapSelect.title"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    size: "picker",
    onClose: () => {
      unregisterInput?.();
      unregisterInput = undefined;
      // 🔴 La scène Babylon se libère À LA FERMETURE, et pas seulement au changement de carte : la
      // modale s'ouvre et se referme autant de fois qu'on veut sur un écran qui, lui, reste monté.
      preview?.dispose();
      preview = null;
      if (!picked) {
        // Ouverte puis refermée sans rien retenir : c'est le geste que la télémétrie adaptée du plan
        // 208 distingue du changement effectif.
        countAction(TelemetryAction.MapModalDismissed);
      }
    },
  });

  const body = modal.getBody();
  const root = el("div", "ms-screen");

  const aside = el("aside", "ms-list-panel");
  const list = el("ul", "ms-list");
  entries.forEach((entry, index) => {
    const item = el("li");
    const button = el("button", "ms-list-item", "map-list-item");
    button.type = "button";
    button.textContent = entry.label;
    button.dataset.mapId = entry.id;
    button.addEventListener("click", () => selectIndex(index));
    /*
     * 🔴 La sélection SUIT LE FOCUS, et pas seulement le clic — mesuré à la recette multi-entrée du
     * 2026-09-11.
     *
     * `moveSelection` déplaçait la sélection puis le focus, mais l'inverse n'était pas vrai : entrer
     * dans la liste par le CÔTÉ (navigation spatiale, depuis « Choisir cette carte ») posait l'anneau
     * sur une ligne sans la sélectionner. L'aperçu montrait alors une autre carte que celle
     * surlignée, et la flèche suivante repartait de l'ancien index — un saut de sept lignes, observé.
     */
    button.addEventListener("focus", () => selectIndex(index));
    listButtons.push(button);
    item.append(button);
    list.append(item);
  });
  aside.append(list);

  const main = el("div", "ms-main");
  const previewContainer = el("div", "ms-preview");
  /*
   * Le panneau du tirage. Un cadre VIDE était exclu d'avance : le voile de chargement de
   * `map-preview-stage.ts` existe précisément parce qu'« un cadre vide donne l'impression que c'est
   * cassé » (retour humain 2026-08-06). « Aléatoire » n'a rien à montrer, donc il montre le dé.
   */
  const randomPanel = el("div", "ms-random", "map-random-panel");
  const randomDie = el("span", "ms-random-die");
  randomDie.textContent = "🎲";
  randomDie.setAttribute("aria-hidden", "true");
  const randomText = el("p", "ms-random-text");
  randomText.textContent = t("mapSelect.randomHint");
  randomPanel.append(randomDie, randomText);
  previewContainer.append(randomPanel);

  const details = el("section", "ms-details");
  const detailsName = el("h2", "ms-details-name", "map-detail-name");
  const detailsMeta = el("p", "ms-details-meta", "map-detail-meta");
  const detailsDescription = el("p", "ms-details-description", "map-detail-description");
  details.append(detailsName, detailsMeta, detailsDescription);

  const confirm = el("button", "tb-btn ms-confirm", "map-confirm");
  confirm.type = "button";
  confirm.dataset.variant = "primary";
  confirm.textContent = t("mapSelect.confirm");
  confirm.addEventListener("click", () => confirmSelection());

  main.append(previewContainer, details, confirm);
  root.append(aside, main);
  body.append(root);

  /*
   * 🔴 L'aperçu Babylon n'est construit QUE si la première entrée regardée en a besoin.
   *
   * Ouvrir la modale sur « Aléatoire » — le défaut d'un joueur qui n'a encore rien joué — ne doit
   * pas payer le montage d'un moteur Babylon pour un panneau qui n'affiche qu'un dé.
   */
  const ensurePreview = (): MapPreviewStage => {
    preview ??= createMapPreviewStage(previewContainer);
    return preview;
  };

  function refreshSelection(): void {
    const entry = entries[selectedIndex];
    if (!entry) {
      return;
    }
    listButtons.forEach((button, index) => {
      button.setAttribute("aria-current", index === selectedIndex ? "true" : "false");
    });
    listButtons[selectedIndex]?.scrollIntoView({ block: "nearest" });

    const map = entry.entry;
    randomPanel.hidden = map !== undefined;
    previewContainer.dataset.mode = map === undefined ? "random" : "map";
    detailsName.textContent = entry.label;

    if (map === undefined) {
      detailsMeta.textContent = "";
      detailsDescription.textContent = t("mapSelect.randomDescription");
      return;
    }

    const tagsText =
      map.tags.length > 0 ? `  ·  ${map.tags.map((tag) => tag[language]).join(", ")}` : "";
    detailsMeta.textContent = `${map.size}${tagsText}`;
    detailsDescription.textContent = map.description[language];
    ensurePreview().setMap(map.url);
  }

  function selectIndex(index: number): void {
    if (index === selectedIndex) {
      return;
    }
    selectedIndex = index;
    refreshSelection();
  }

  function moveSelection(delta: number): void {
    selectIndex((selectedIndex + delta + entries.length) % entries.length);
    // La sélection se déplace au clavier ET à la manette : le focus la suit, sans quoi l'anneau
    // resterait sur une ligne que la liste ne montre plus comme retenue.
    listButtons[selectedIndex]?.focus();
  }

  function confirmSelection(): void {
    const entry = entries[selectedIndex];
    if (!entry) {
      return;
    }
    picked = true;
    modal.close();
    // Le changement seulement : re-confirmer la carte déjà retenue n'est pas un changement, et le
    // compter en ferait un — c'est exactement le faux signal que l'arbitrage de télémétrie du plan
    // 208 cherche à éviter.
    if (entry.id !== options.currentMapId) {
      countAction(TelemetryAction.MapChanged);
      options.onPick(entry.id);
    }
  }

  /*
   * Consommateur d'entrée PROPRE, empilé au-dessus de celui de l'écran : haut/bas appartiennent à la
   * LISTE DES CARTES, pas à la navigation spatiale, qui sortirait de la liste par le haut. Même
   * écart assumé que l'écran qu'il remplace — et que la roue de codes du lobby.
   *
   * L'horizontale, elle, reste à la navigation spatiale : c'est la sortie de la liste vers « Choisir
   * cette carte » et la croix de fermeture. Sans elle, la liste serait un piège à focus à la
   * manette, où B est la seule autre issue.
   */
  let unregisterInput: (() => void) | undefined = getInputSystem()?.register({
    context: () => "screen",
    menu: {
      focusMove: (direction) => {
        /*
         * 🔴 La liste ne prend la VERTICALE que quand le focus est DEDANS — mesuré à la recette
         * multi-entrée du 2026-09-11.
         *
         * Elle la prenait inconditionnellement, comme l'écran qu'elle remplace. Mais un écran n'avait
         * rien d'autre à atteindre, là où la modale a « Choisir cette carte » et sa croix : depuis
         * l'un d'eux, ↓ **retombait dans la liste** au lieu de descendre vers le bouton, qui devenait
         * injoignable à la verticale. Même règle que la roue de codes du lobby (`holdsFocus`) : un
         * contrôle garde l'axe qu'il utilise, et le rend dès qu'on l'a quitté.
         */
        const active = document.activeElement;
        const inList = active instanceof HTMLElement && list.contains(active);
        if (inList && direction === "up") {
          moveSelection(-1);
          return;
        }
        if (inList && direction === "down") {
          moveSelection(1);
          return;
        }
        focusInDirection(direction);
      },
      confirm: () => {
        /*
         * 🔴 Dans la LISTE, le geste de validation retient la carte regardée — à la manette comme au
         * clavier.
         *
         * Sans cette branche, `A` ne faisait RIEN sur une ligne : la sélection suit le focus (c'est
         * ce qui dessine l'anneau sur la ligne retenue), donc un bouton est toujours focalisé, et un
         * appui de pad ne déclenche aucune activation native — le trou décrit par
         * `.claude/rules/multi-input.md`. Rendre `false` aurait laissé la liste sans validation au
         * pad, avec B pour seule issue.
         *
         * Au clavier, `Entrée` est avalée (`preventDefault` sur action consommée), donc le clic natif
         * du bouton ne s'ajoute pas : un seul traitement, comme le veut la décision #822.
         */
        const active = document.activeElement;
        if (active instanceof HTMLElement && list.contains(active)) {
          confirmSelection();
          return true;
        }
        // Ailleurs — « Choisir cette carte », la croix — le clavier active nativement, le pad non.
        if (getInputSystem()?.tracker.current() !== InputSource.Gamepad) {
          return false;
        }
        return activateFocusedControl();
      },
      /*
       * 🔴 `cancelToModalOrBack` SANS retour arrière, et surtout pas un `false` sec.
       *
       * Le routeur livre une action à **exactement un** consommateur, celui du sommet de la pile —
       * c'est son invariant. Un `false` rendu ici ne redescend donc PAS à l'écran du dessous : au
       * clavier la fermeture native du `<dialog>` sauvait les apparences, mais à la manette B
       * n'aurait eu aucune sortie et la modale aurait été un piège. C'est très exactement le trou
       * que l'étape 6 du plan 207 a bouché sur le lobby, et que ce plan-ci devait ne pas rejouer.
       *
       * Sans `onBack` : il n'y a rien derrière une modale ouverte par un écran qui reste monté — le
       * geste ferme la modale, il ne quitte pas l'écran.
       */
      cancel: () => cancelToModalOrBack(),
    },
  });

  refreshSelection();
  listButtons[selectedIndex]?.focus();

  // `Modal.close()` est idempotent (il teste `dialog.open`), donc refermer une modale déjà partie ne
  // coûte rien — l'appelant n'a pas à savoir si le joueur l'a fermée avant lui.
  return () => modal.close();
}
