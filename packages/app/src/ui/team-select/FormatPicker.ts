import type { MapFormat } from "@pokemon-tactic/core";

export interface FormatOption {
  key: string;
  format: MapFormat;
  label: string;
}

export interface FormatPickerCallbacks {
  onChange: (key: string) => void;
}

export function buildFormatKey(format: MapFormat): string {
  return `${format.teamCount}v${format.maxPokemonPerTeam}`;
}

export function createFormatPickerElement(
  options: readonly FormatOption[],
  initialKey: string,
  labelText: string,
  callbacks: FormatPickerCallbacks,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "ts-format-picker";

  const text = document.createElement("span");
  text.className = "ts-format-picker-label";
  text.textContent = labelText;
  label.appendChild(text);

  const select = document.createElement("select");
  select.className = "ts-format-picker-select";
  for (const option of options) {
    const optEl = document.createElement("option");
    optEl.value = option.key;
    optEl.textContent = option.label;
    select.appendChild(optEl);
  }
  select.value = initialKey;
  select.addEventListener("change", () => {
    callbacks.onChange(select.value);
  });
  label.appendChild(select);

  return label;
}
