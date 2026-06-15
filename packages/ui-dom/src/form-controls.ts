export type ButtonVariant = "primary" | "danger" | "ghost" | "icon";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CreateButtonOptions {
  label: string;
  variant?: ButtonVariant;
  className?: string;
  onClick: (event: MouseEvent) => void;
  signal?: AbortSignal;
}

export function createButton(options: CreateButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = options.className ?? "tb-btn";
  if (options.variant !== undefined) {
    button.dataset.variant = options.variant;
  }
  button.textContent = options.label;
  button.addEventListener("click", options.onClick, { signal: options.signal });
  return button;
}

export interface CreateLabeledSelectOptions {
  label: string;
  options: SelectOption[];
  selected: string;
  labelWidth?: "narrow" | "medium" | "wide";
  layout?: "split" | "inline";
  onChange?: (value: string) => void;
  signal?: AbortSignal;
}

export interface LabeledSelect {
  row: HTMLDivElement;
  select: HTMLSelectElement;
}

export function createLabeledSelect(options: CreateLabeledSelectOptions): LabeledSelect {
  const row = document.createElement("div");
  row.className = "sb-form-row";
  if (options.layout !== undefined) {
    row.dataset.layout = options.layout;
  }

  const labelEl = document.createElement("span");
  labelEl.className = "sb-form-label";
  labelEl.dataset.width = options.labelWidth ?? "wide";
  labelEl.textContent = `${options.label}:`;
  row.appendChild(labelEl);

  const select = document.createElement("select");
  select.className = "sb-form-input";
  for (const opt of options.options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.disabled === true) {
      option.disabled = true;
    }
    if (opt.value === options.selected) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  if (options.onChange !== undefined) {
    select.addEventListener("change", () => options.onChange?.(select.value), {
      signal: options.signal,
    });
  }
  row.appendChild(select);
  return { row, select };
}

export function replaceSelectOptions(
  select: HTMLSelectElement,
  options: SelectOption[],
  fallback: string,
): void {
  const previous = select.value;
  select.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.disabled === true) {
      option.disabled = true;
    }
    fragment.appendChild(option);
  }
  select.appendChild(fragment);
  const stillValid = options.some((opt) => opt.value === previous && opt.disabled !== true);
  select.value = stillValid ? previous : fallback;
}

export interface CreateLabeledCheckboxOptions {
  label: string;
  checked: boolean;
  labelWidth?: "narrow" | "medium" | "wide";
  onChange?: (checked: boolean) => void;
  signal?: AbortSignal;
}

export interface LabeledCheckbox {
  row: HTMLLabelElement;
  input: HTMLInputElement;
}

export function createLabeledCheckbox(options: CreateLabeledCheckboxOptions): LabeledCheckbox {
  const row = document.createElement("label");
  row.className = "sb-form-row";

  const labelEl = document.createElement("span");
  labelEl.className = "sb-form-label";
  labelEl.dataset.width = options.labelWidth ?? "wide";
  labelEl.textContent = options.label;
  row.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = options.checked;
  if (options.onChange !== undefined) {
    input.addEventListener("change", () => options.onChange?.(input.checked), {
      signal: options.signal,
    });
  }
  row.appendChild(input);
  return { row, input };
}

export interface CreateLabeledRangeOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  labelWidth?: "narrow" | "medium" | "wide";
  onChange?: (value: number) => void;
  signal?: AbortSignal;
}

export interface LabeledRange {
  row: HTMLDivElement;
  input: HTMLInputElement;
  valueLabel: HTMLSpanElement;
}

export function createLabeledRange(options: CreateLabeledRangeOptions): LabeledRange {
  const row = document.createElement("div");
  row.className = "sb-form-row";

  const labelEl = document.createElement("span");
  labelEl.className = "sb-form-label";
  labelEl.dataset.width = options.labelWidth ?? "narrow";
  labelEl.textContent = options.label;
  row.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = "range";
  input.className = "sb-form-input";
  input.min = String(options.min);
  input.max = String(options.max);
  input.value = String(options.value);
  row.appendChild(input);

  const valueLabel = document.createElement("span");
  valueLabel.className = "sb-form-value";
  valueLabel.textContent = String(options.value);
  input.addEventListener(
    "input",
    () => {
      valueLabel.textContent = input.value;
    },
    { signal: options.signal },
  );
  if (options.onChange !== undefined) {
    input.addEventListener("change", () => options.onChange?.(Number(input.value)), {
      signal: options.signal,
    });
  }
  row.appendChild(valueLabel);
  return { row, input, valueLabel };
}

export interface CreateOptionalNumberInputOptions {
  label: string;
  min: number;
  max: number;
  value: number | undefined;
  placeholder?: string;
  labelWidth?: "narrow" | "medium" | "wide";
  onChange?: (value: number | undefined) => void;
  signal?: AbortSignal;
}

export interface OptionalNumberInput {
  row: HTMLDivElement;
  input: HTMLInputElement;
}

export function createOptionalNumberInput(
  options: CreateOptionalNumberInputOptions,
): OptionalNumberInput {
  const row = document.createElement("div");
  row.className = "sb-form-row";

  const labelEl = document.createElement("span");
  labelEl.className = "sb-form-label";
  labelEl.dataset.width = options.labelWidth ?? "medium";
  labelEl.textContent = options.label;
  row.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = "number";
  input.className = "sb-form-input";
  input.dataset.size = "number";
  input.min = String(options.min);
  input.max = String(options.max);
  input.value = options.value === undefined ? "" : String(options.value);
  if (options.placeholder !== undefined) {
    input.placeholder = options.placeholder;
  }
  if (options.onChange !== undefined) {
    input.addEventListener(
      "change",
      () => {
        const value = input.value === "" ? undefined : Number(input.value);
        options.onChange?.(value);
      },
      { signal: options.signal },
    );
  }
  row.appendChild(input);
  return { row, input };
}

export interface CreatePickerCardOptions {
  label: string;
  text: string;
  labelWidth?: "narrow" | "medium" | "wide";
  onClick: () => void;
  signal?: AbortSignal;
}

export interface PickerCard {
  row: HTMLDivElement;
  button: HTMLButtonElement;
}

export function createPickerCard(options: CreatePickerCardOptions): PickerCard {
  const row = document.createElement("div");
  row.className = "sb-form-row";

  const labelEl = document.createElement("span");
  labelEl.className = "sb-form-label";
  labelEl.dataset.width = options.labelWidth ?? "wide";
  labelEl.textContent = `${options.label}:`;
  row.appendChild(labelEl);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sb-picker-card";
  button.textContent = options.text;
  button.addEventListener("click", options.onClick, { signal: options.signal });
  row.appendChild(button);

  return { row, button };
}
