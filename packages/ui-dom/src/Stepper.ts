export interface CreateStepperOptions {
  value: number;
  min: number;
  max: number;
  format?: (value: number) => string;
  onChange?: (value: number) => void;
  signal?: AbortSignal;
}

export interface Stepper {
  element: HTMLButtonElement;
  getValue: () => number;
  setValue: (value: number) => void;
}

const defaultFormat = (value: number): string => String(value);

export function createStepper(options: CreateStepperOptions): Stepper {
  const format = options.format ?? defaultFormat;
  let value = options.value;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sb-stepper";
  button.textContent = format(value);
  button.title = "Click: +1 — Right-click: -1";

  const apply = (next: number, emit: boolean): void => {
    const clamped = Math.max(options.min, Math.min(options.max, next));
    if (clamped === value) {
      return;
    }
    value = clamped;
    button.textContent = format(clamped);
    if (emit) {
      options.onChange?.(clamped);
    }
  };

  const step =
    (delta: number) =>
    (event: MouseEvent): void => {
      event.preventDefault();
      apply(value + delta, true);
    };

  button.addEventListener("click", step(1), { signal: options.signal });
  button.addEventListener("contextmenu", step(-1), { signal: options.signal });

  return {
    element: button,
    getValue: () => value,
    setValue: (next: number) => apply(next, false),
  };
}
