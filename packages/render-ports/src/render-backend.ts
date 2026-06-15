/**
 * Renderer lifecycle contract (plan 125, Phase 3). Engine-agnostic and DOM-free:
 * it names the one piece that was implicit (and a past source of pain) in the
 * Phaser→Babylon migration — **deterministic teardown**. Any render backend must
 * release its engine, scene, GPU resources and observers on `dispose()` so the
 * app-shell can swap screens (and one day swap renderers) without leaks.
 *
 * The data ports (`BoardView`, `BattleChrome`, `BattleFeedback`) remain the
 * behavioural contract; a backend's host surface (canvas, DOM layers) is its own
 * concern and is NOT part of this neutral interface — that keeps the contract
 * package free of any DOM/engine type. The Babylon backend's `GameStage`
 * satisfies this interface at compile time (typecheck = lifecycle conformance);
 * a runtime conformance suite can't instantiate a Babylon scene in the unit test
 * environment (no WebGL), so the lifecycle guard is enforced by the type system.
 */
export interface RenderBackend {
  /** Release engine/scene/GPU resources and observers. Idempotent. */
  dispose(): void;
}
