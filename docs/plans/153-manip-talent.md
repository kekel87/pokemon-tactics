# Plan 153 — Misc Batch C : manipulation de talent

> **Statut : `DONE`** (2026-07-10 — design tranché avec l'humain : ciblage Single r1 ennemi, interactions complètes, immunités flag minimal, coût CT option A/900)
> Chantier « Misc volatile / utility » — batch C sur 5 (A crit ✅, B dégâts utilitaires ✅, C manip talent ← ici, D/E à venir).
> Cible : **486 → 490 moves** (+4). Tests positionnels `moves/{worry-seed,gastro-acid,role-play,skill-swap}.test.ts` + intégration `ability-manip.integration.test.ts`.

## Objectif

Ajouter les 4 moves de manipulation runtime du **talent** (ability) d'un Pokémon en combat, première mécanique de mutation d'ability du jeu (miroir conceptuel du `typeOverride` du plan 143) :

| Move (FR) | ID | Type | Cat. | Ciblage | Effet |
|---|---|---|---|---|---|
| **Soucigraine** | `worry-seed` | Plante | Statut | Single r1 (ennemi) | Remplace le talent de la cible par **Insomnie** (`insomnia`). Réveille la cible si endormie (Insomnie interdit le sommeil). |
| **Suc Digestif** | `gastro-acid` | Poison | Statut | Single r1 (ennemi) | **Supprime** le talent de la cible pour le reste du combat (le talent ne fait plus rien). |
| **Imitation** | `role-play` | Psy | Statut | Single r1 (ennemi) | Le **lanceur copie** le talent effectif de la cible. |
| **Échange** | `skill-swap` | Psy | Statut | Single r1 | **Échange** les talents lanceur ↔ cible. |

**Learners Gen 1 confirmés** (via TM/tuteur des gens modernes) : Soucigraine 8 (lignée Bulbizarre, Paras/Parasect, Empiflor, Noeunoeuf/Noadkoko), Suc Digestif 6 (Abo/Arbok, Chétiflor→Empiflor, Ronflex), Imitation 3 (Abra→Alakazam, M.Mime), Échange 27 (gros pool Psy/Normal). → **OP sets possibles**, pas des moves de complétude.

## Décisions de design (tranchées avec l'humain)

1. **Ciblage** : les 4 en **Single r1 (ennemi)** — cohérent avec les familles type-manip (Détrempage/Copie-Type/Conversion 2) et stat-swap (Permucœur/Permuvitesse), toutes en Statut r1 ennemi. Le lanceur doit s'approcher pour « toucher » le talent (prime au risque). **Note d'implémentation** : Échange ne cible PAS un allié — il n'existe pas de flag « cible indifférente » (`targetsAlly` = allié uniquement), et le reste de la famille swap cible l'ennemi ; Échange s'aligne dessus (voler le bon talent / refiler le mauvais à un ennemi). L'idée « donner un talent à un allié » est écartée pour la cohérence.
2. **Interactions complètes** : un changement de talent en cours de combat re-évalue les effets dépendants (auras Intimidation/Magnépiège, immunité terrain via Lévitation, position-linked). Voir §5.
3. **Coût CT : option A (900 CT, fallback)** — aucun `effectTier`, `computeMoveCost` retombe sur `ppCost(10)` → bucket `<12` → 900 CT. Cohérent avec Vampigraine (statut lien permanent, même bucket). Zéro touche core. Note playtest (`docs/next.md`) : réévaluer si Soucigraine s'avère trop chère pour son impact ; surveiller Échange sur Intimidation (double swing) + combo Sniper + Affilage.
4. **Immunités : flag minimal** — charger le flag Showdown `unsuppressable` (comme `breakable`) pour gater Suc Digestif ; Imitation/Échange échouent seulement si la cible n'a pas de talent (ou déjà supprimé). Aucun talent du roster Gen 1 n'est `unsuppressable` en pratique → surtout de la correction, pas du gameplay. Divergence assumée : pas de liste `failskillswap`/`failroleplay` (absente de notre `abilities.json`).

## Périmètre

- **Data** (`packages/data`) : 4 `MoveDefinition` + i18n move names/desc + tags tooltip + OP sets + chargement flag `unsuppressable`.
- **Core** (`packages/core`) : infra override/suppression + 4 `EffectKind` + handlers + event + interactions complètes.
- **Renderer** : badge InfoPanel « Talent {nom} » (ou « Talent scellé »), floating text, battle-log formatter.
- **IA** : garde-fou minimal (les 4 sont des statuts → scoring statut générique, pas de contresens).
- **Tests** : unit handlers + intégration par move + interactions (Lévitation supprimée, aura échangée).

## Ordre d'exécution

1. **Infra** (§1.1–1.2) : champs `PokemonInstance` + helper `effectiveAbilityId` + reset KO.
2. **Chokepoint** (§1.3) : router `AbilityHandlerRegistry.getForPokemon` via le helper.
3. **Sites id-check** (§1.4) : migrer les 9 fichiers → `effectiveAbilityId`.
4. **EffectKind + handlers** (§2) : 4 kinds, module `ability-manip/`, dispatch.
5. **Event / renderer / i18n** (§3).
6. **Interactions complètes** (§5) : trigger terrain immédiat, retrait/ré-application d'aura.
7. **IA** garde-fou (§4), **OP sets** (§6).
8. **Tests** (§7) unit + intégration.

## 1. Infra core — override & suppression de talent (miroir `typeOverride`)

### 1.1 Champs `PokemonInstance`
```ts
/** Talent runtime forcé (Soucigraine/Imitation/Échange). Persiste jusqu'au KO. undefined = talent de base. */
abilityIdOverride?: string;
/** Talent supprimé (Suc Digestif). Reste du combat. Prioritaire sur override. */
abilitySuppressed?: boolean;
```
Reset au KO à côté de `typeOverride`/`speedStatOverride` (`BattleEngine.ts` ~3353).

### 1.2 Helper central `effectiveAbilityId`
Nouveau module `packages/core/src/battle/effective-ability.ts` :
```ts
export function effectiveAbilityId(pokemon: PokemonInstance): string | undefined {
  if (pokemon.abilitySuppressed) return undefined;
  return pokemon.abilityIdOverride ?? pokemon.abilityId;
}
```

### 1.3 Chokepoint : `AbilityHandlerRegistry.getForPokemon`
Route via le helper — **couvre les ~20 sites** qui passent par `getForPokemon` (dégâts, statut, stat, immunité, drain, initiative, aura, pressure…) d'un seul coup :
```ts
getForPokemon(pokemon: PokemonInstance): AbilityDefinition | undefined {
  const id = effectiveAbilityId(pokemon);
  return id ? this.abilities.get(id) : undefined;
}
```

### 1.4 Sites id-check direct (9 fichiers, ~11 lignes) → router via `effectiveAbilityId`
Remplacer `pokemon.abilityId === "xxx"` par `effectiveAbilityId(pokemon) === "xxx"` dans :
- `effective-flying.ts:51` (`levitate`) — **critique** : Suc Digestif supprime Lévitation → le Pokémon devient sensible au terrain Sol/hazards.
- `aura-system.ts:140,203` + `substitute-system.ts:65` (`infiltrator`)
- `damp-system.ts:14` (`damp`)
- `friend-guard-system.ts:19` (`friend-guard`)
- `berry-suppression.ts:14` (`unnerve`)
- `ability-suppression.ts:24` (`mold-breaker`) — l'attaquant dont le talent est supprimé/échangé perd/gagne Brise Moule
- `handle-damage.ts:265` (`scrappy`)
- `held-item-transfer.ts:81` (`sticky-hold`)

> Marker inline pour la review : ces sites doivent lire le talent **effectif**, pas le talent de base.

## 2. EffectKind + handlers

4 nouveaux `EffectKind` (`effect.ts`) : `SetAbility` (avec `abilityId: string`), `SuppressAbility`, `CopyAbility`, `SwapAbility`.

Module `packages/core/src/battle/handlers/ability-manip/` (miroir `type-change/`), dispatch enregistré dans `effect-processor.ts` :

- **`apply-ability-change.ts`** — helper commun `applyAbilityChange(pokemon, newId | SUPPRESS, reason)` : écrit `abilityIdOverride`/`abilitySuppressed`, émet `AbilityChanged`, **déclenche les interactions §5**, retourne les events. Helper `abilityMoveFailed(casterId, move)`.
- **`handle-set-ability.ts`** (Soucigraine) : `applyAbilityChange(target, "insomnia", SetByMove)` + effet canon **réveil** si `target` endormie (retire `StatusType.Sleep`, émet le réveil).
- **`handle-suppress-ability.ts`** (Suc Digestif) : échoue si cible sans talent effectif OU talent `unsuppressable` ; sinon `applyAbilityChange(target, SUPPRESS, GastroAcid)`.
- **`handle-copy-ability.ts`** (Imitation) : lit `effectiveAbilityId(target)`, échoue si vide ; `applyAbilityChange(caster, targetAbility, RolePlay)`.
- **`handle-swap-ability.ts`** (Échange) : lit les deux talents effectifs, échoue si les deux vides ; swap via `applyAbilityChange` sur chacun (SkillSwap). Un talent supprimé s'échange comme « rien ».

## 3. Event + i18n + renderer

- **Event** `BattleEventType.AbilityChanged { targetId, abilityId?: string, reason }` (miroir `TypeChanged`). `AbilityChangeReason` = `SetByMove | GastroAcid | RolePlay | SkillSwap`.
- **BattleLogFormatter** : 4 cas FR/EN (« Le talent de {X} devient Insomnie ! », « Le talent de {X} est neutralisé ! », « {X} copie le talent de {Y} ! », « {X} et {Y} échangent leur talent ! »).
- **Floating text** : réutilise le pipeline `AbilityChanged` (court, « Talent ! »).
- **InfoPanel** badge volatile : si `abilitySuppressed` → « Talent scellé » ; sinon si `abilityIdOverride` → « Talent {nomFR} » (résolu via i18n abilities). Miroir du badge « Type {types} » du plan 143.
- **MoveTooltip** : tags descriptifs (🧬 « Manipule le talent »).
- **i18n** : move names/desc FR/EN (déjà dans `moves.json`), clés `abilityChange.*`, `infoPanel.volatile.abilitySealed`/`abilityOverride`.

## 4. IA

Garde-fou minimal : les 4 sont des Statuts → passent par le scoring statut générique (`action-scorer.ts`). Pas de contresens majeur (manipuler un talent adverse n'est jamais absurde). **Reporté** (passe IA groupée) : valoriser finement Suc Digestif contre un talent défensif clé (Multiécaille/Intimidation), Échange pour refiler un mauvais talent, Soucigraine pour couper Cran/un boost de type. Noté dans `docs/next.md`.

## 5. Interactions complètes (décision humaine)

Après **chaque** changement de talent, `applyAbilityChange` déclenche une re-évaluation :

1. **Aura Intimidation** — la passe post-action `emitPositionLinkedChecks` (déjà routée via `getForPokemon`) gère les deux sens :
   - Talent **gagné** (ex: Échange donne Intimidation) → `onAuraCheck` applique le -1 Atk aux ennemis adjacents.
   - Talent **perdu/supprimé** (Suc Digestif sur Caninos) → `processIntimidated` retire le volatile quand `effectiveAbilityId(source) !== "intimidate"` (avant, seule la distance/mort déclenchait le retrait). Réutilise le rebound `statChangeApplied`.
   - **Note (corrigé en review)** : PAS de traitement Magnépiège — `magnet-pull` n'existe pas comme talent implémenté, et les seuls Trapped position-linked (`remainingTurns === -1`) sont **move-sourcés** (Barrage/Regard Noir). Un garde `magnet-pull` sur `processPositionLinkedTrapped` casserait ces moves (les libérerait au 1ᵉʳ tick). `processPositionLinkedTrapped` reste inchangé (retrait par mort/distance uniquement).
2. **Immunité + dégâts de terrain (Lévitation)** — Suc Digestif supprime Lévitation → le Pokémon n'est plus « volant ». (a) L'immunité aux moves Sol / hazards / terrain se ré-évalue automatiquement (`effective-flying.ts` lit `effectiveAbilityId(pokemon) === "levitate"`, §1.4). (b) **Grounding-terrain immédiat** : `BattleEngine.executeUseMove` réagit aux events `AbilityChanged` (miroir exact du bloc `SmackedDown`/Anti-Air) — pour chaque mon devenu non-volant (`!isEffectivelyFlying`), il appelle `applyGroundingTerrainTick` **tout de suite**. Un Pokémon Lévitation planant au-dessus de lave / eau profonde (`dotFraction: 1` → dégâts = maxHp → K.O.) **se noie / brûle dès la résolution de Suc Digestif**, comme un Volant cloué par Anti-Air — pas d'échappatoire jusqu'à son prochain tick. Testé en intégration (dé-lévitation sur tuile Lave → K.O. immédiat) + `isEffectivelyFlying` (avant = true, après = false).
3. **Position-linked** : la passe post-action existante (`emitPositionLinkedChecks` appelée en fin d'exécution de move) couvre le reste.

> Ces re-évaluations passent par les chemins déjà routés en §1.3/1.4 → pas de nouveau câblage de lecture, juste le déclenchement + l'extension du retrait d'aura côté source.

## 6. OP sets — DIFFÉRÉ

Sets emblématiques (Suc Digestif sur Arbok/Ronflex, Échange/Imitation sur Alakazam/M.Mime, Soucigraine sur Florizarre/Empiflor) **non livrés dans cette passe** — cohérent avec les plans 150-152 qui ont différé leurs OP sets. Les 4 moves rejoignent déjà les movepools via learnset ∩ implémenté (Team Builder libre). À caler via `data-miner` en session content-fill. Noté `docs/next.md`.

## 7. Tests

- **Unit** : `effective-ability.test.ts` (override/suppress/priorité), chaque handler (`ability-manip/*.test.ts`).
- **Intégration** (`packages/core/src/battle/`) : `ability-manip.integration.test.ts` — les 4 moves bout-en-bout + interactions : (a) Suc Digestif supprime Lévitation → Séisme touche ; (b) Suc Digestif supprime Lévitation sur lave → dégâts terrain ; (c) Échange donne Intimidation → aura -1 Atk adjacente ; (d) Suc Digestif coupe Intimidation source → aura retirée ; (e) Soucigraine réveille une cible endormie ; (f) Imitation copie un talent ; (g) échec sur talent `unsuppressable` / cible sans talent ; (h) reset au KO.

## 8. Reporté (non bloquant)

- **e2e Playwright** : piloter les 4 moves via l'UI (badge InfoPanel, ligne de journal). Via `test-writer` + `docs/test-plan.md` §5.
- **Heuristiques IA fines** (voir §4).
- **OP sets** additionnels si représentation insuffisante (via `data-miner` en content-fill).

## Divergences assumées

- Pas de listes `failskillswap`/`failroleplay`/`noreceiver` (absentes de `abilities.json`) — Imitation/Échange n'échouent que sur talent vide. Aucun talent du roster Gen 1 n'est concerné canon.
- Insomnie via Soucigraine réveille immédiatement (canon Gen 4+).
- Suc Digestif = suppression permanente reste du combat (pas de banc/switch → pas de « réactivation à l'échange »).
