import type { MapFormat } from "@pokemon-tactic/core";

export interface FormatOption {
  key: string;
  format: MapFormat;
  label: string;
}

export interface FormatPickerCallbacks {
  onChange: (key: string) => void;
}

/**
 * Clé d'un format — elle IDENTIFIE le format et voyage jusqu'au `CombatSetup`. Distincte du libellé
 * affiché (`formatLabel`) depuis le plan 188 : changer l'un ne doit pas changer l'autre.
 */
export function buildFormatKey(format: MapFormat): string {
  return `${format.teamCount}v${format.maxPokemonPerTeam}`;
}

/**
 * Libellé affiché d'un format — « 2J × 6 » : deux joueurs, six Pokemon chacun (décision #835).
 *
 * L'ancienne forme réutilisait la clé, donc affichait « 2v6 », qui **se lit** « deux contre six » :
 * un affrontement déséquilibré, alors que le format est symétrique. Le `×` lève l'ambiguïté du `v`,
 * et la rangée est titrée « Joueurs × Pokemon » — ce qui rend le `J` lisible sans légende séparée.
 * La forme reste courte, condition pour que la rangée de segments tienne sur un téléphone.
 */
export function formatLabel(format: MapFormat): string {
  return `${format.teamCount}J × ${format.maxPokemonPerTeam}`;
}

/**
 * Rangée de segments — un bouton par format, l'actif surligné (décision #830).
 *
 * C'était un `<select>` : le format actif n'était lisible qu'en dépliant la liste, ce qui en faisait
 * « un niveau de plus à comprendre » (retour humain 2026-08-21). Des `<button>` ordinaires règlent
 * aussi le cas de la manette au passage — `activateFocusedControl` ne sait pas ouvrir la liste
 * native d'un `<select>`, donc le choix du format était inaccessible au pad.
 */
export function createFormatPickerElement(
  options: readonly FormatOption[],
  activeKey: string,
  labelText: string,
  callbacks: FormatPickerCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "ts-format-picker";

  const text = document.createElement("span");
  text.className = "ts-format-picker-label";
  text.textContent = labelText;
  wrapper.appendChild(text);

  const segments = document.createElement("div");
  segments.className = "ts-segments";
  segments.dataset.testid = "format-segments";
  for (const option of options) {
    const segment = document.createElement("button");
    segment.type = "button";
    segment.className = "ts-segment";
    /*
     * Testid présent, et pas seulement `data-format-key` : `renderPreservingFocus` ne sait restaurer
     * le focus que **par famille de `data-testid`** (le repli par rang global a été retiré exprès, il
     * posait le focus sur un bouton « Supprimer »). Sans lui, changer de format renvoyait le liseré
     * sur `<body>`, puis `focusInDirection` réentrait sur `controls[0]` = « ◀ Retour », tout à gauche
     * de l'écran — signalé comme un bug visuel en filmant la séquence d'intro (plan 194).
     */
    segment.dataset.testid = "format-segment";
    segment.dataset.formatKey = option.key;
    if (option.key === activeKey) {
      segment.dataset.state = "active";
    }
    segment.textContent = option.label;
    segment.addEventListener("click", () => callbacks.onChange(option.key));
    segments.appendChild(segment);
  }
  wrapper.appendChild(segments);

  return wrapper;
}
