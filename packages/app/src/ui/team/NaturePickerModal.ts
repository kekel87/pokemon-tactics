import { getNatureEffect, type Nature, type StatName } from "@pokemon-tactic/core";
import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";
import { getInputSystem } from "../../input/input-system";
import { renderPreservingFocus } from "../dom/preserve-focus";

export interface NaturePickerOptions {
  natures: readonly Nature[];
  /** Libellé de chaque nature — le NOM seul, sans ses modificateurs. */
  nameKeys: Readonly<Record<Nature, TranslationKey>>;
  /** `null` quand aucune nature n'est fixée (le sandbox tire au hasard). */
  current: Nature | null;
  /**
   * Ajoute une ligne « Aléatoire » en tête, qui rappelle `onSelect(null)`. Sert au sandbox, dont le
   * `<select>` offrait cette option — la modale ne doit pas la faire disparaître.
   */
  randomLabel?: string;
  onSelect: (nature: Nature | null) => void;
}

/** Les stats qu'une nature peut augmenter ou baisser — donc les seules à étiqueter et à filtrer. */
const NATURE_STATS = ["attack", "defense", "spAttack", "spDefense", "speed"] as const;

type NatureStat = (typeof NATURE_STATS)[number];

/**
 * Clé i18n du nom court d'une stat.
 *
 * `Record` complet sur `NATURE_STATS` et non `Partial<Record<StatName, …>>` : le repli
 * `?? "stat.atk"` afficherait un MAUVAIS libellé au lieu d'échouer, et la table des natures ne touche
 * jamais aux PV, à la précision ni à l'esquive (revue de code 2026-08-26).
 */
const STAT_LABEL_KEY: Record<NatureStat, TranslationKey> = {
  attack: "stat.atk",
  defense: "stat.def",
  spAttack: "stat.spA",
  spDefense: "stat.spD",
  speed: "stat.spd",
};

const isNatureStat = (stat: StatName): stat is NatureStat =>
  (NATURE_STATS as readonly StatName[]).includes(stat);

type NatureFilter = NatureStat | "all" | "neutral";

/**
 * Sélecteur de Nature — une liste, comme les trois autres sélecteurs de l'écran (plan 188, retours
 * humains 2026-08-26).
 *
 * Remplace un `<select>` natif, qui « capturait » la manette : ses touches haut/bas changeaient
 * l'option sans jamais dérouler la liste. Une liste dans un `<dialog>` s'ouvre pour de vrai, `B` la
 * referme, et le geste est **identique** à celui des sélecteurs de Pokemon, de capacité et d'objet.
 *
 * ## Mise en page
 *
 * Le nom et les deux modificateurs sont dans des **colonnes séparées**, et non dans un libellé unique
 * du genre `« Rigide (+Atk, -AtkSp) »` : celui-ci revenait à la ligne au milieu d'un mot dès que la
 * modale était étroite (retour humain 2026-08-26, capture à l'appui). Les modificateurs reprennent
 * les couleurs de l'InfoPanel — hausse en bleu (`--type-flying`), baisse en rouge (`--red-400`),
 * exactement les mêmes tokens que `info-panel.css` — pour qu'un `+Atk` se lise pareil partout.
 *
 * La source de vérité est `getNatureEffect` (core), pas une chaîne traduite qu'on découperait : la
 * table des natures vit dans le moteur, et c'est elle qui décide.
 */
export function openNaturePickerModal(options: NaturePickerOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.section.nature"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    // `picker` élargit la modale : c'est ce qui laisse les trois colonnes tenir sur une ligne.
    size: "picker",
  });
  const body = modal.getBody();

  const filterRow = document.createElement("div");
  filterRow.className = "tb-picker-filter-row";
  body.appendChild(filterRow);

  const list = document.createElement("div");
  list.className = "tb-list";
  list.dataset.testid = "nature-picker-list";
  body.appendChild(list);

  let filter: NatureFilter = "all";

  const renderFilters = (): void => {
    filterRow.innerHTML = "";
    const entries: { key: NatureFilter; label: string }[] = [
      { key: "all", label: t("teamBuilder.nature.filterAll") },
      ...NATURE_STATS.map((stat) => ({ key: stat, label: `+${t(STAT_LABEL_KEY[stat])}` })),
      { key: "neutral", label: t("teamBuilder.nature.filterNeutral") },
    ];
    for (const entry of entries) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tb-filter-chip";
      chip.dataset.testid = "nature-filter";
      chip.dataset.filter = entry.key;
      if (filter === entry.key) {
        chip.dataset.state = "active";
      }
      chip.textContent = entry.label;
      chip.addEventListener("click", () => {
        filter = entry.key;
        render();
      });
      filterRow.appendChild(chip);
    }
  };

  const matchesFilter = (nature: Nature): boolean => {
    const effect = getNatureEffect(nature);
    if (filter === "all") {
      return true;
    }
    if (filter === "neutral") {
      return effect.boost === null;
    }
    return effect.boost === filter;
  };

  const renderList = (): void => {
    list.innerHTML = "";
    if (options.randomLabel !== undefined && filter === "all") {
      list.appendChild(buildRandomRow(options.randomLabel));
    }
    for (const nature of options.natures.filter(matchesFilter)) {
      list.appendChild(buildRow(nature));
    }
  };

  const buildRandomRow = (label: string): HTMLElement => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tb-list-row tb-nature-row";
    row.dataset.testid = "nature-picker-random";
    if (options.current === null) {
      row.dataset.state = "active";
    }
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    row.appendChild(name);
    row.addEventListener("click", () => {
      modal.close();
      options.onSelect(null);
    });
    return row;
  };

  const buildRow = (nature: Nature): HTMLElement => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tb-list-row tb-nature-row";
    row.dataset.testid = "nature-picker-row";
    row.dataset.nature = nature;
    if (nature === options.current) {
      row.dataset.state = "active";
    }
    appendNatureLabel(row, nature, options.nameKeys[nature]);
    row.addEventListener("click", () => {
      modal.close();
      options.onSelect(nature);
    });
    return row;
  };

  const render = (): void =>
    renderPreservingFocus(body, () => {
      renderFilters();
      renderList();
    });

  render();

  // La manette n'a pas de `Tab` : sans point de départ, la première direction ne servirait qu'à entrer
  // dans la liste. On entre sur la Nature COURANTE, l'endroit d'où l'on veut se déplacer.
  if (getInputSystem()?.tracker.isFocusDriven() === true) {
    const current = list.querySelector<HTMLElement>('[data-state="active"]');
    (current ?? list.querySelector<HTMLElement>("button"))?.focus();
  }
}

/**
 * Pose « nom · +stat · −stat » dans un conteneur — partagé par les lignes de la liste et par le
 * déclencheur du panneau d'édition, pour que le même contenu se lise pareil aux deux endroits.
 */
export function appendNatureLabel(
  target: HTMLElement,
  nature: Nature,
  nameKey: TranslationKey,
): void {
  const effect = getNatureEffect(nature);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = t(nameKey);
  target.appendChild(name);
  target.appendChild(buildModifierCell(effect.boost, "boost"));
  target.appendChild(buildModifierCell(effect.lowered, "lower"));
}

function buildModifierCell(stat: StatName | null, kind: "boost" | "lower"): HTMLElement {
  const cell = document.createElement("span");
  cell.className = "tb-nature-mod";
  if (stat === null) {
    // Une nature neutre garde des cellules VIDES plutôt qu'un tiret : les colonnes doivent rester
    // alignées d'une ligne à l'autre, c'est tout leur intérêt.
    return cell;
  }
  // `data-nature` reprend le contrat de `info-panel.css` — même attribut, mêmes couleurs.
  if (!isNatureStat(stat)) {
    // Une nature ne touche qu'aux cinq stats de combat : si le core en renvoyait une autre, ne rien
    // afficher vaut mieux qu'un libellé faux.
    return cell;
  }
  cell.dataset.nature = kind;
  cell.textContent = `${kind === "boost" ? "+" : "−"}${t(STAT_LABEL_KEY[stat])}`;
  return cell;
}
