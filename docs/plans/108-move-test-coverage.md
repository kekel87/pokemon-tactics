# Plan 108 — Couverture tests par move (rattrapage + garde-fou)

> **Statut : done** (2026-06-02)
> Rattrape la dette de tests positionnels par move (210 moves sans `*.test.ts`) et
> installe un garde-fou (meta-test CI + checklist) pour qu'aucun nouveau move ne
> passe sans test.

## Contexte

Les batches de contenu G4/G5/G6 (plans 105-107) ont ajouté ~70 moves en data-only
(`tactical.ts` + i18n) **sans** test par move. Audit complet : **210 / 330 moves
implémentés n'ont aucun fichier `moves/<id>.test.ts`**. La mémoire projet impose
« un fichier de test par move, scénarios positionnels bout en bout ».

## Garde-fou (fait)

- `packages/core/src/battle/moves/move-test-coverage.test.ts` : meta-test qui
  énumère `loadData().moves` et **échoue** si un move implémenté n'a pas de fichier
  `<id>.test.ts` (ou `<id>.integration.test.ts`). Strict, **sans allowlist** de
  couverture. Bloque la CI.
- Allowlist `CROSS_MOVE_MECHANIC_TESTS` (orphelins uniquement) : `hit-and-run`,
  `teleport-landing`, `teleport-pattern` — tests de mécaniques transverses, pas
  liés à un move unique.

## Convention de test par move (à respecter par tous les fichiers)

Reproduire le style des tests existants (`mega-punch.test.ts`, `growl.test.ts`,
`leech-life.test.ts`, `double-edge.test.ts`, `swords-dance.test.ts`).

- Fichier : `packages/core/src/battle/moves/<id>.test.ts`, à côté du code.
- **Aucun commentaire** (règle tests unitaires `.claude/rules/tests.md`).
- Imports : helpers depuis `"../../testing"`, enums depuis `"../../enums/..."`.
- `describe("<id>", () => { ... })`.
- Toujours `MockPokemon.fresh(MockPokemon.base, { ... })` — jamais de mock inline.
  Champs typiques : `id`, `playerId`, `position`, `orientation` (`Direction.East`
  pour les moves directionnels), `moveIds: ["<id>"]`, `currentPp: { "<id>": <pp> }`,
  `derivedStats: { movement: 3, jump: 1, initiative: 100 }` (attaquant rapide) / `10`
  (cible lente).
- Moteur : `const { engine, state } = buildMoveTestEngine([user, foe]);` (grille 6×6).
- Action : `engine.submitAction(PlayerId.Player1, { kind: ActionKind.UseMove,
  pokemonId: user.id, moveId: "<id>", targetPosition: { x, y } })`.
- Précision < 100 ou effet secondaire à probabilité → `vi.spyOn(Math, "random").mockReturnValue(0)`
  en début de test + `vi.restoreAllMocks()` à la fin.
- **Cibles** : move `status|self` (ou `targetsAlly`) → `targetPosition` = position du
  user ; sinon position de l'ennemi.

### Recettes par type d'effet (event attendu → assertion)

| Effet (`effects[].kind`) | Event | Assertion clé |
|---|---|---|
| `damage` | `DamageDealt` | `events` contient `DamageDealt` ; `foe.currentHp` < avant |
| `stat_change` (ennemi) | `StatChanged` | `foe.statStages[StatName.X]` == valeur attendue (signe × stages) |
| `stat_change` (self) | `StatChanged` | `user.statStages[StatName.X]` == valeur attendue |
| `status` | `StatusApplied` | `foe.statusEffects` contient le statut (forcer via `Math.random=0`) |
| `drain` | `HpRestored` | attaquant `currentHp` < `maxHp` au départ, puis hp ↑ |
| `recoil` | `DamageDealt` (sur attaquant) | `user.currentHp` < avant ; event recoil ciblant `user.id` présent |
| `heal_self` | `HpRestored` | user `currentHp` < `maxHp` au départ, puis hp ↑ |
| `set_weather` | `WeatherSet` | `state.weather?.type` == météo attendue |
| `knockback` | `KnockbackApplied` | cible déplacée |
| `post_aura` | `AuraPosted` | aura présente dans `state` (cf. `auras-*.integration.test.ts`) |

### Deuxième scénario (positionnel) quand pertinent

- Targeting `single` / `dash` / `slash` : test « hors de portée » →
  `result.success === false` et `result.error === ActionError.InvalidTarget`.
- Targeting `cone` / `line` / `zone` : vérifier qu'une cible **dans** l'AoE est
  touchée et idéalement qu'une **hors** AoE ne l'est pas.
- Moves `sound` (flag) : peuvent passer à travers un pilier (`MockBattle.setTile(state,
  x, y, { height: 2 })`), cf. `growl.test.ts`.

### Cas spéciaux — mimer un test existant

- `twoTurnCharge` (charge 2 tours) → `sky-attack.test.ts`, `skull-bash.test.ts`,
  `razor-wind.test.ts`.
- `recharge` → `hyper-beam.test.ts`.
- `targeting.kind === "hit-and-run"` → `hit-and-run.integration.test.ts`, `wrap`/`u-turn`.
- `targeting.kind === "teleport"` → `teleport-pattern.test.ts`, `teleport-landing.integration.test.ts`.
- multi-hit (`hits`/`minHits`) → `double-kick.test.ts`, `fury-swipes.test.ts`.

> **Règle de fond** : pour l'idiome exact, `grep` un test frère dans `moves/` dont le
> move a le **même `targeting.kind` + mêmes `effects[].kind`**, et le calquer.

## Exécution

Rattrapage des 210 via workflow fan-out groupé par archétype (agents `test-writer`).
Chaque agent écrit ses fichiers et lance `vitest` sur ses fichiers jusqu'au vert.

## Anti-récidive (checklist)

- Meta-test CI (ci-dessus) — bloquant.
- `docs/methodology.md` + template plan de batch : tout nouveau move ⇒ test par move
  obligatoire dans le même plan.
- Mémoire `project_batch_checklist` : ajouter « test par move (meta-test vert) ».
