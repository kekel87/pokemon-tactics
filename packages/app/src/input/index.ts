/**
 * Device-agnostic input layer (plan 184, Lot 2 du plan-cadre 173).
 *
 * Raw devices (keyboard, gamepad, pointer/finger) produce `LogicalAction`s; the router hands each
 * one to exactly one consumer, chosen by the current input context. Consumers never see an event.
 *
 * It lives in `packages/app` because the app is the composition root: it owns the canvas (via
 * `game-stage`) and wires the orchestrator to the scene. Extractable into its own package later if
 * a second renderer ever needs it — no need to pay for that boundary today (décision humaine).
 */
export * from "./gamepad-source.js";
export * from "./input-router.js";
export * from "./input-source.js";
export * from "./input-system.js";
export * from "./keyboard-source.js";
export * from "./logical-action.js";
export * from "./pointer-source.js";
