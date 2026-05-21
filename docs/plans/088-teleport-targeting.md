# Plan 088 — TP moves (`TargetingKind.Teleport`)

> Statut : **done**
> Créé : 2026-05-20
> Livré : 2026-05-21
> Auteur : Claude
> Révisions : plan-reviewer + game-designer audits intégrés 2026-05-20 (Fly r5→r4, étapes 4/5/7 découpées, vérifs `getLegalActions`/Wide Guard ajoutées). **Refonte 2026-05-21** : abandon landing aléatoire (4 cardinales + BFS) → caster TP **directement sur target** (qui doit être empty), AoE **r1 sur 4 cardinales autour du landing** (friendly fire inclus). `resolveTeleportLanding` supprimé.

## Objectif

Introduire une nouvelle catégorie targeting `TargetingKind.Teleport` permettant à un Pokemon de cibler une tile **libre** dans une range donnée (LoS bypassée, terrain bypassé, hauteur bypassée), d'y appliquer des dégâts si occupée, puis d'atterrir sur une case cardinale aléatoire autour de la cible. Sert de contrepartie aux moves charge T1/T2 — pas d'attente, mais position d'atterrissage non maîtrisée.

Livraison : nouvelle entrée `TargetingPattern`, resolver dédié, logique d'atterrissage (4 cardinales aléatoires + BFS fallback), intégration `BattleEngine.executeUseMove`, support renderer (placement instantané sprite), 7 moves data.

## Pourquoi maintenant

- Plan 087 terminé : `playable-pokemon.ts` dérive movepool depuis `tacticalOverrides`. Ajouter les 7 moves TP les exposera automatiquement aux Pokemon dont le learnset les inclut.
- Roster Gen 1 complet : Vol/Tunnel/Bounce/Phantom Force/Shadow Force/Dive ouvrent ~25 Pokemon (Pidgeot, Charizard, Dragonite, Aerodactyl, Articuno/Zapdos/Moltres, Mew/Mewtwo, Sandslash, Dugtrio, Rhydon, Marowak, Gengar, Lapras, Gyarados, etc.).
- Mécanique simple côté core (1 resolver + 1 helper landing), aucune dépendance bloquée.
- Squelette `chargingMove` du plan 084b (Solar-Beam) **non utilisé** ici — TP n'a pas de phase T1/T2.

## Hors scope

- **TP inversé / HitAndRun** (u-turn / volt-switch / flip-turn) : caster frappe normal puis choisit zone recul. Plan séparé.
- **MoveCharging visible** (Skull Bash, Sky Attack, Razor Wind) : stay-in-place T1, frappe T2. Plan séparé.
- **Baton Pass** : transfert stat stages à allié adjacent. Plan séparé, mécanique non-TP.
- Animation dédiée (FFTA-style disparition/réapparition) — placeholder instantané pour MVP, polish ultérieur.
- Pas de modification système Protect/Detect (les flags `bypassProtect` existants suffisent pour phantom-force/shadow-force).
- Pas de nouveau type d'AI scoring spécialisé — `action-scorer.ts` traite Teleport comme Single avec range étendu.

## Décisions actées

1. **Nouveau `TargetingKind.Teleport`** dans l'enum (`packages/core/src/enums/targeting-kind.ts`) + `TargetingPattern` discriminated union (`packages/core/src/types/targeting-pattern.ts`) :
   ```ts
   | { kind: typeof TargetingKind.Teleport; range: RangeConfig }
   ```
2. **Resolver `resolveTeleport(caster, target, range, grid)`** :
   - Retourne `[target]` si `chebyshevDistance(caster, target) ∈ [min, max]` et tile dans grid bounds.
   - Sinon retourne `[]` (ciblage invalide).
   - **Pas de LoS check** (`computeIgnoresLoS` retourne `true` pour `TargetingKind.Teleport`).
   - **Pas de check terrain/hauteur** sur target — la tile target peut être lava, deep_water, obstacle, hauteur arbitraire.
3. **Landing logic** :
   - Helper `resolveTeleportLanding(target, grid, traversalContext, rng): Position`
   - 1. 4 cardinales (N/E/S/O) autour target. Filtre : in-bounds, non-occupée par Pokemon vivant.
   - 2. Shuffle déterministe via `rng` (PRNG injecté). Première valide retournée.
   - 3. Si 4 cardinales toutes invalides → BFS expansion ring (Chebyshev distance croissante depuis target, ordre tile déterministe shuffle par ring), retourne 1ʳᵉ tile valide trouvée.
   - 4. Tiles `terrain` dangereuses (lava, deep_water) **ne sont pas exclues** — risque réel. Caster peut atterrir et subir dégâts/KO terrain.
   - 5. Si BFS épuise toute la grille sans trouver tile valide (cas extrême sandbox saturée) → **fallback target tile elle-même** (caster atterrit sur target).
4. **Application dégâts** :
   - Si une tile dans `resolveTargeting(...)` est occupée par un Pokemon vivant (target normal), `EffectKind.Damage` s'applique via pipeline existant (`effect-processor.ts`).
   - Si target = tile vide → uniquement le déplacement caster a lieu (`Teleport` move pur).
5. **Ordre exécution dans `BattleEngine.executeUseMove`** :
   - Accuracy check standard (Teleport pur = OHKO bypass non, accuracy 100% par défaut).
   - Effects pipeline (dégâts).
   - Si pattern = `Teleport` ET targets non vides OU pattern.kind = Teleport (TP pur) → **après dégâts** : compute landing position, update `caster.position`, émettre `BattleEventType.Teleported { pokemonId, fromPosition, toPosition, targetTile }`.
   - Terrain triggers (burn lava, fall damage deep_water) appliqués à `toPosition` via flux existant `applyTerrainOnEnter`.
6. **`BattleEventType.Teleported`** ajouté à `battle-event.ts` :
   ```ts
   { type: "Teleported"; pokemonId: PokemonId; fromPosition: Position; toPosition: Position; targetTile: Position }
   ```
   Renderer log : "Pikachu se téléporte." / "Pikachu teleports."
7. **Caster traversal** : Teleport bypass `canTraverse` / `MAX_CLIMB` / `MAX_DESCENT` — la tile d'atterrissage doit être *atteignable comme finale*, mais la trajectoire entre caster et target n'est jamais traversée.
8. **AI scoring** : `action-scorer.ts` traite TP comme Single (cible = position, score basé sur target). Pas de scoring de tile d'atterrissage (random, non prédictible). Hint : si caster basse HP et target sur lava/deep_water → léger malus optionnel (différé).
9. **PRNG injecté** : `BattleEngine.rng` (existant) utilisé pour shuffle landing positions → replay déterministe.
10. **Renderer** :
    - `PokemonSprite.setPosition(x, y)` direct + flottant "TP" optionnel (placeholder).
    - Pas d'animation tween entre fromPosition et toPosition — instantané.
    - `BattleLogFormatter` : entrée pour `Teleported`.
11. **Tactical override JSON-equivalent** : 7 moves listés Section "Moves data" (étape 5).
12. **Compatibilité Substitute / Protect** :
    - phantom-force / shadow-force flag `bypassProtect: true` (existant).
    - Si target sous Substitute → dégâts au Substitute, caster TP normalement.
    - Pas d'interaction spéciale Endure / Detect / Wide Guard (couvert flux standard).
13. **Knockback désactivé sur TP** : aucun effet `Knockback` dans les 7 moves data. Si futur design veut combiner, plan dédié.
14. **Recoil/Drain compatibles** : un move TP peut avoir `Recoil`/`Drain` (pipeline standard) — pas de cas Gen 1 prévu mais l'architecture le permet.

## Étapes

### 1. Enum + type

**Fichiers** :
- `packages/core/src/enums/targeting-kind.ts` — ajouter `Teleport: "teleport"` à l'enum.
- `packages/core/src/types/targeting-pattern.ts` — ajouter variant `{ kind: typeof TargetingKind.Teleport; range: RangeConfig }`.

### 2. Resolver targeting

**Fichiers** :
- `packages/core/src/grid/resolve-teleport.ts` (nouveau, 1 fichier = 1 resolver) — fonction `resolveTeleport(caster, target, range, grid): Position[]`. Retourne `[target]` ou `[]`.
- `packages/core/src/grid/targeting.ts` :
  - `computeIgnoresLoS` retourne `true` pour `kind === Teleport`.
  - `resolveTargeting` switch case `Teleport` → délègue à `resolveTeleport`.

**Test** : `resolve-teleport.test.ts` — in-range valide, out-of-range vide, in-bounds, peut cibler tile vide / occupée alliée / occupée ennemie / obstacle / hauteur arbitraire.

### 2b. Vérifier `getLegalActions` (no-op attendu)

**Fichier** : `packages/core/src/battle/BattleEngine.ts` — méthode `getLegalActions`.

Confirmer que pour pattern `Teleport`, **toutes** les tiles in-range Chebyshev autour du caster sont générées comme target candidates **sans filtre LoS/terrain/hauteur**. Le resolver `resolveTeleport` retourne `[target]` si in-range, donc `getLegalActions` doit énumérer toutes les positions in-range.

Test ciblé : `BattleEngine.legal-actions.teleport.test.ts` — caster avec move teleport en map mixte (obstacles, hauteur, lava), vérifier que `legalActions` contient bien toutes les tiles in-range incluant celles inaccessibles en marche.

### 3. Landing logic

**Fichiers** :
- `packages/core/src/grid/resolve-teleport-landing.ts` (nouveau) — fonction `resolveTeleportLanding(target, grid, occupied, rng): Position`.
  - `occupied: Set<string>` (positions verrouillées Pokemon vivants, format `"x,y"`).
  - Implémentation : 4 cardinales → shuffle via `rng` → première valide. Sinon BFS expansion ring distance Chebyshev. Fallback target.

**Test** : `resolve-teleport-landing.test.ts` — 4 cardinales libres, 4 occupées → BFS, edge corner, full saturation fallback target, rng déterministe.

### 4. Événement + intégration BattleEngine

**4a. Event type** :
- `packages/core/src/enums/battle-event-type.ts` — ajouter `Teleported: "Teleported"`.
- `packages/core/src/types/battle-event.ts` — ajouter variant discriminated union :
  ```ts
  | { type: typeof BattleEventType.Teleported; pokemonId: PokemonId; fromPosition: Position; toPosition: Position; targetTile: Position }
  ```

**4b. Intégration `BattleEngine.executeUseMove`** :
- `packages/core/src/battle/BattleEngine.ts` :
  - Après pipeline effects (dégâts), check `if (pattern.kind === TargetingKind.Teleport)`.
  - Compute `occupied` snapshot post-dégâts (KO Pokemon retirés via `handleKo` antérieur).
  - Appel `resolveTeleportLanding(targetPosition, grid, occupied, this.rng)`.
  - Update `caster.position`.
  - Emit `Teleported` event.

**4c. Flux terrain landing** :
- Appel flux terrain existant `applyTerrainOnEnter(caster, toPosition)` après TP — gère burn lava, fall damage deep_water, ice slide via `handleKnockback.ice-slide` (à vérifier : ice slide se déclenche-t-il via `applyTerrainOnEnter` ou uniquement via knockback ? Si seul knockback, ajouter trigger ice-slide pour Teleport).

**4d. AI scoring** :
- `packages/core/src/ai/action-scorer.ts` — pas de changement spécial. TP traité comme Single (cible position, score normal). Dette technique notée : pas de prédiction landing pour éviter lava (acceptable Phase 4).

**Test** : `teleport-engine.integration.test.ts` —
- TP pur (teleport) : caster bouge, pas de dégâts, occupants intacts.
- TP + damage (fly) : caster bouge, target prend dégâts, types/STAB appliqués.
- Landing sur lava : caster brûlé via terrain handler.
- Landing sur deep_water non-Vol : KO létal.
- Landing 4 cardinales bloquées : BFS trouve case voisine.
- TP target sous Substitute : sub prend dégâts, caster TP.
- TP via phantom-force vs target Protect : dégâts passent (bypassProtect), caster TP.

### 5. Moves data

**Fichier** : `packages/data/src/overrides/tactical.ts` — ajouter 7 entrées.

```ts
teleport: {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 6 } },
  effects: [],
},
fly: {
  targeting: { kind: TargetingKind.Teleport, range: { min: 2, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
},
dig: {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 } },
  effects: [{ kind: EffectKind.Damage }],
},
bounce: {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 } },
  effects: [
    { kind: EffectKind.Damage },
    { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
  ],
},
"phantom-force": {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
},
"shadow-force": {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
},
dive: {
  targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 } },
  effects: [{ kind: EffectKind.Damage }],
},
```

**Flags** : phantom-force / shadow-force ont `bypassProtect: true` dans le champ `moveFlags` du `MoveDefinition` (type défini dans `packages/data/src/reference-types.ts` — interface `MoveFlags`). Showdown : ces moves contournent Protect en frappe T2 — dans notre version sans T1/T2 on conserve la propriété narrative.

**Note** : fly / dig / bounce / dive ne portent **pas** `bypassProtect` (Protect bloque normalement). Seuls les Spectre signature moves bypassent.

**Décision Dive** : cible libre (pas de restriction terrain). Validée 2026-05-20.

### 5b. Validation basePower / Accuracy

Vérifier que `packages/data/reference/moves.json` contient les valeurs alignées :
- fly : 90 BP / 95 acc
- dig : 80 BP / 100 acc
- bounce : 85 BP / 85 acc
- phantom-force : 90 BP / 100 acc
- shadow-force : 120 BP / 100 acc
- dive : 80 BP / 100 acc
- teleport : 0 BP / 100 acc

Si reference diffère, ajouter override dans `packages/data/src/overrides/balance.ts`. Commande de vérification :
```bash
grep -A 5 '"id":"fly"' packages/data/reference/moves.json | head -10
```

Validation : `pnpm typecheck && pnpm build` doivent passer post-ajout. Pas de migration data nécessaire.

### 5c. Vérification interaction Wide Guard × bypassProtect

**Fichier** : `packages/core/src/battle/effect-processor.ts` (ou handler `Defensive`).

Wide Guard bloque les AoE multi-target ; `bypassProtect` flag ne doit **pas** auto-bypasser Wide Guard. Vérifier que les deux flags sont distincts dans le code de `DefensiveKind`. Si check unique sur `bypassProtect` ignorant Wide Guard → c'est OK (Wide Guard intervient avant). Si check fusionne les deux → bug à corriger.

Test : `wide-guard-vs-teleport.test.ts` — phantom-force vs ally Wide Guard actif → Wide Guard doit bloquer (ou pas, selon convention). Trancher avant impl.

### 6. Tests intégration par move

**Fichier** : `packages/core/src/battle/moves/teleport.integration.test.ts` (et 1 fichier par move : `fly`, `dig`, `bounce`, `phantom-force`, `shadow-force`, `dive`).

Pattern existant `buildMoveTestEngine({ random: createPrng(seed) })` (voir `hyper-fang.test.ts`).

Scénarios par move :
- Hit-and-relocate baseline.
- TP target vide (relocate only).
- bounce : Para 30% via PRNG fixe.
- phantom-force vs Protect.
- dive : range OK terrain (deep_water comme target ?).
- fly : range max boundary.

### 7. Renderer intégration

**7a. Event handler** :
- `packages/renderer/src/scenes/battle/GameController.ts` :
  - Nouveau handler `Teleported` event dans le switch `applyEvent`.
  - `pokemonSprite.setIsoPosition(toPosition)` direct (pas de tween animation, instantané).
  - Pas de flottant "TP" pour MVP (skip placeholder, polish ultérieur via plan animation dédié).

**7b. Log formatter** :
- `packages/renderer/src/scenes/battle/BattleLogFormatter.ts` :
  - Case `Teleported` : retourne `t("battle.teleported", { pokemonName })`.

**7c. i18n** :
- `packages/renderer/src/i18n/locales/fr.ts` : `"battle.teleported": "{pokemonName} se téléporte."`
- `packages/renderer/src/i18n/locales/en.ts` : `"battle.teleported": "{pokemonName} teleports."`

### 8. Préview AoE / UI

- `packages/renderer/src/scenes/battle/pattern-preview.ts` — preview `Teleport` : highlight tile target uniquement (1 tile single). 4 cardinales possible landing en highlight secondaire (couleur distincte, infor uniquement). Ou laisser placeholder = même rendu que Single. Décision : MVP = Single preview.
- `packages/renderer/src/scenes/battle/MoveTooltip.ts` — afficher icône TP distinguant Dash de Teleport. MVP : libellé `Téléport` dans tooltip type.

### 9. Validation données

- `packages/data/src/validate.ts` — pas de nouveau check requis (le type discriminated union suffit).
- Run `pnpm typecheck` après ajout enum + 7 overrides.

### 10. Mise à jour `docs/implementations.md`

Ajouter 7 moves dans la table. Incrémenter compteur global moves (145 → 152).

### 11. Mise à jour `docs/decisions.md`

Ajouter décisions #326-#334 :
- #326 — `TargetingKind.Teleport` introduit (cible libre, LoS/terrain/hauteur bypass).
- #327 — Landing 4 cardinales aléatoires + BFS fallback + fallback target tile.
- #328 — Terrains dangereux **inclus** dans landing (risque assumé).
- #329 — Teleport pur (Téléport move) sans dégâts mais comportement TP identique.
- #330 — phantom-force / shadow-force héritent `bypassProtect` (couvert flag existant).
- #331 — AI scoring TP = Single (pas de prédiction landing).
- #332 — Animation TP = placeholder instantané MVP.
- #333 — Fly range max = 4 (ajusté depuis r5 post-audit game-designer 2026-05-20).
- #334 — Dive cible libre sans restriction terrain (pas de check water/deep_water).

### 12. Gate CI + golden replay

`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

Régénérer golden replay si IA touche un de ces moves (probable — birds finals roster ont Fly).

Commande : `pnpm tsx scripts/regenerate-golden-replay.ts`. Seed = constante existante dans le script (vérifier valeur actuelle, ne pas changer sauf nécessaire). Si seed change, documenter dans `docs/decisions.md`.

## Tests

- **Unit** :
  - `resolve-teleport.test.ts` — range valide/invalide, target dans/hors grid, target sur terrain dangereux/hauteur libre.
  - `resolve-teleport-landing.test.ts` — 4 cardinales, BFS, fallback target, déterminisme PRNG.
- **Intégration** :
  - `teleport-engine.integration.test.ts` — flow complet TP + terrain + Substitute + Protect.
  - 7 fichiers `<move>.integration.test.ts`.
- **Golden replay** : régénérer via `regenerate-golden-replay.ts` si IA pioche un move TP.

## Risques connus

1. **Landing déterminisme** : si 2 saves de la même partie chargent un seed différent, landing diffère. Le `BattleEngine.rng` est déjà partagé via `seedRng` (plan 028 replay). OK.
2. **AI exploite mal TP** : sans prédiction landing, l'IA peut TP sur lava. Acceptable Phase 4, raffinement post-playtest.
3. **Pathfinding aware Teleport** : `getLegalActions` doit considérer toute tile in-range comme target valide (pas de filtre LoS/terrain/hauteur sur target). Vérifier `BattleEngine.getLegalActions` génère bien le bon set pour `Teleport`.
4. **Preview joueur peut être confus** : un humain peut s'attendre à choisir la landing tile. Tooltip clair requis : "Atterrissage aléatoire autour de la cible".
5. **Sandbox 6x6 saturée** : test stress avec map mini + 12 Pokemon vivants → BFS épuise grille → fallback target. Vérifier que ce cas ne plante pas et atterrit sur target sans loop.

## Migration data

Aucune migration nécessaire — ajouts purs. Les Pokemon dont le learnset inclut `fly` / `dig` / etc. via reference Showdown verront ces moves apparaître automatiquement dans `movepool` (plan 087 dérivé).

Vérifier post-impl que :
- Pidgeot, Charizard, Dragonite, Aerodactyl, Articuno/Zapdos/Moltres, Mew/Mewtwo ont `fly` accessible.
- Sandslash, Dugtrio, Rhydon, Marowak ont `dig`.
- Gengar a `phantom-force` (TM Gen 9).
- Mewtwo, Alakazam ont `teleport`.

## Compteurs prévus post-livraison

- Moves : 145 → **152**
- Targeting kinds : 9 → **10**
- BattleEventType : +1 (Teleported)
- Pokemon ayant accès à au moins 1 move TP : ~25 (à confirmer via learnset intersection).
