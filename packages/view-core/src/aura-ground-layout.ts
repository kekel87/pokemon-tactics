/**
 * Engine-agnostic ground aura-icon layout (plan 125 — hoisted from render-babylon).
 * When a caster's team-aura symbols are floated over each tile of its radius, they
 * fan out in a cross/grid around the tile centre (1 centred, 2 side-by-side, … up
 * to 6). Offsets are screen-relative: `x` horizontal, `y` screen-up (the renderer
 * negates `y` if its local frame points down).
 */

export interface AuraIconOffset {
  /** Horizontal screen offset. */
  readonly x: number;
  /** Screen-vertical offset (positive = up). */
  readonly y: number;
}

/** Offsets for `count` symbols (1–6) spaced by `spacing`; counts above 6 reuse the 6-slot grid. */
export function auraGroundIconLayout(count: number, spacing: number): readonly AuraIconOffset[] {
  switch (count) {
    case 1:
      return [{ x: 0, y: 0 }];
    case 2:
      return [
        { x: -spacing, y: 0 },
        { x: spacing, y: 0 },
      ];
    case 3:
      return [
        { x: -spacing, y: 0 },
        { x: spacing, y: 0 },
        { x: 0, y: -spacing },
      ];
    case 4:
      return [
        { x: -spacing, y: 0 },
        { x: spacing, y: 0 },
        { x: 0, y: spacing },
        { x: 0, y: -spacing },
      ];
    case 5:
      return [
        { x: -spacing, y: spacing },
        { x: spacing, y: spacing },
        { x: -spacing, y: -spacing },
        { x: spacing, y: -spacing },
        { x: 0, y: 0 },
      ];
    default:
      return [
        { x: -spacing, y: spacing },
        { x: spacing, y: spacing },
        { x: -spacing, y: 0 },
        { x: spacing, y: 0 },
        { x: -spacing, y: -spacing },
        { x: spacing, y: -spacing },
      ];
  }
}
