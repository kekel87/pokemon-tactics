/**
 * Visual bucket a semi-invulnerable state collapses to for display: the four
 * mechanical {@link SemiInvulnerableState} values map to "flying" (above ground)
 * or "underground", `null` when grounded. Lives in core (not the render contract)
 * so the render ports and the engine-agnostic view logic both depend on it
 * without forming a cycle.
 */
export type SemiInvulnerableDisplay = "flying" | "underground" | null;
