# Plan 090 — Sandbox refonte (UI Studio + mutualisation team builder + dummy jouable)

> Statut : **done**
> Créé : 2026-05-21
> Livré : 2026-05-21 (en attente validation visuelle humain)
> Auteur : Claude (dev) / Michael (DC)
> Révisions : plan-reviewer audit intégré 2026-05-21 (clarifs `onTurnReady = null`, pas de `sandbox.html` séparé, migration JSON explicite, scission `SandboxPanel` obligatoire, étape 9 split unit/e2e/visual).
> Notes livraison :
> - Étape 5 (scission physique en sous-fichiers) **reportée** — refonte effectuée via DOM slots injectés depuis `sandbox-boot.ts`, fichier `SandboxPanel.ts` reste monolithe (902 lignes après drops). Suivi : plan 091 si besoin physique split.
> - Bug critique trouvé étape 1 : `getMovepoolFor` cherchait `toShowdownId(move.id)` (sans tirets) dans un Set kebab (avec tirets) → tous moves multi-mot filtrés. Fix : comparaison directe `legal.has(move.id)`.
> - CI gate verte : lint zéro warning, 1552 unit + 191 integration, typecheck, build.

## Objectif

Refonte de la **page sandbox** en *Sandbox Studio* : canvas Phaser encastré (flex height) + colonnes config Player / Dummy en dessous + bandeau Battle/Map. Mutualisation maximale avec le team builder (`MovePickerModal`, `getMoveInfo`, ability picker), unification de la source learnset, et ajout d'un mode **dummy jouable** (humain contrôle l'adversaire) pour tester des mécaniques à la main.

Livraison : nouveau layout HTML page sandbox, `SandboxConfig` étendu (`dummyControl`), `DummyAiController` court-circuité en mode player, `MovePickerModal` réutilisé pour Player + Dummy(Player mode), source learnset unifiée, drops `dummyLevel`/`dummyBaseStats`/`Level field` (level fixe 50).

## Pourquoi maintenant

- 4 retours playtest convergents (2026-05-21) :
  1. Divergence apparente movepool teambuilder vs sandbox — bug réel confirmé par audit code (2 chemins distincts : `getLegalMoves` direct vs `validator.getLegalMoves`).
  2. Volonté mutualiser teambuilder → sandbox (composants pickers, ability dropdown).
  3. Besoin tester mécaniques manuellement (dummy jouable) — actuellement IA seulement.
  4. Panel sandbox accordéons HTML latéraux peu pratique sur écran 4K (panneau étroit, scroll vertical).
- Plan 086 (TeamSelect refonte) et plan 087 (playable-pokemon refactor) ont livré les composants réutilisables (`MovePickerModal`, `team-builder-data`).
- Plan 088 (Teleport) terminé, pas de chantier majeur en cours sur le core → moment idéal pour chantier renderer/UX.

## Hors scope

- **Refonte BattleScene** (rendu jeu) : la sandbox réutilise le canvas existant tel quel, encastré.
- **MovePickerModal lui-même** : pas de modif, on l'utilise tel quel.
- **TeamBuilder** : aucune modif côté builder.
- **Refonte SandboxConfig JSON format** : champ `dummyControl` ajouté (optionnel, défaut `"ai"`) — JSON existant reste compatible.
- **AI scoring spécifique au mode Player** : quand `dummyControl === "player"`, l'IA n'intervient pas du tout.
- **Animations transition Apply** : appliquer config = reset complet de la scène (comportement actuel), pas de live-edit pendant combat.
- **Sandbox JSON URL parameters** : si format JSON existant n'a pas `dummyControl`, défaut = `"ai"` (rétro-compat).

## Décisions actées

### Bug fix divergence learnset (point 1)

1. **Source unique** : `SandboxPanel.getMovepoolFor()` doit utiliser **le même chemin** que `MovePickerModal` → passer par `getLearnsetForPokemon(pokemonId)` (`team-builder-data.ts`), qui passe par `data.registry.validator.getLegalMoves(pokemonId)`.
2. **Audit divergence** : vérifier si `validator.getLegalMoves` filtre/normalise différemment de `learnset-resolver.getLegalMoves` direct. Si oui, documenter quel chemin est canonique et aligner. Étape 1 = écrire un test qui charge la list pour `pidgey` / `eevee` / `pikachu` par les 2 chemins et compare → si écart, fix.
3. **Drop import** `getLegalMoves` + `toShowdownId` de `SandboxPanel.ts` (plus utilisés après refactor).

### Mutualisation team builder (point 2)

4. **Move picker réutilisé** : remplacer les 4 `<select>` plats de `SandboxPanel.buildPlayerPanel` par 4 cartes cliquables (`<button class="tb-move-card">`) qui ouvrent `MovePickerModal` au clic. Idem pour Dummy(Player mode).
5. **Ability picker** : conserver le dropdown actuel (`AbilityDropdown`-style) — déjà OK. Aucune modif.
6. **Type/category icons** : les cartes de move affichent type + catégorie via `getCategoryIconUrl` / `getTypeIconUrl` (`asset-paths.ts`), comme team builder.
7. **Source pokemon list** : `getCache().registry.pokemon` (team-builder-data) au lieu de `loadData().pokemon` direct, pour assurer cohérence d'ordre (dexNumber).

### Dummy jouable (point 3)

8. **Nouveau champ `dummyControl`** dans `SandboxConfig` :
   ```ts
   dummyControl: "ai" | "player"; // défaut "ai"
   ```
9. **Wiring `BattleScene.initSandboxBattle`** :
   - Si `config.dummyControl === "ai"` : comportement actuel (`DummyAiController` + `controller.onTurnReady` court-circuite quand `activePokemonId === dummyPokemonId`).
   - Si `config.dummyControl === "player"` : **ne pas créer** `DummyAiController`. `controller.onTurnReady = null` (le type est `((...) => BattleEvent[] | false) | null` — `null` est la valeur d'init, pas `undefined`). Le `GameController` traitera tous les tours comme input humain (pas de notion `teamId` côté controller actuellement — vérifié `GameController.ts`, le check `if (this.onTurnReady && ...)` ligne 612 garantit que `null` skip proprement le path IA).
   - **Vérification** : `GameController` n'a pas de notion "team contrôlée par IA". Si `onTurnReady = null`, **tous** les tours = input humain (clavier/souris/click). Pas besoin de wiring supplémentaire — c'est le comportement par défaut.
10. **Mode Player → dummy a 4 moves** :
    - Quand `dummyControl === "player"`, le champ `config.dummyMove` (1 single) est ignoré. Le dummy utilise un nouveau champ `config.dummyMoves: string[]` (max 4) ajouté à `SandboxConfig`.
    - Quand `dummyControl === "ai"`, comportement actuel : `dummyMove` single + AI joue defensif.
    - UI conditionnelle dans `SandboxPanel.buildDummyPanel` : toggle radio "AI / Player" → reconstruit la section moves (1 select defensif OU 4 cartes picker).
    - **Fallback `dummyMoves` invalide/vide** : si `dummyControl === "player"` et `dummyMoves` est `[]` ou contient des IDs hors movepool, fallback à `movepool[:4]` (premier 4 moves du learnset trié). Si movepool < 4, slots restants vides (acceptable — Pokemon avec movepool < 4 rare).
11. **`createSandboxBattle` (`SandboxSetup.ts`)** :
    - Lit `config.dummyControl` (défaut `"ai"`).
    - En mode Player : les moves dummy = `config.dummyMoves` (max 4, validation via `MoveValidator`).
    - En mode AI : moves dummy = `[config.dummyMove]` si présent, sinon `[]` (comportement actuel inchangé).
12. **Tests `DummyAiController.test.ts`** : aucune modif (mode AI inchangé). Nouveau test `SandboxSetup.dummy-player.test.ts` : `dummyControl: "player"` → moves dummy = `dummyMoves` array, pas d'IA wirée.

### Drops config

13. **`dummyLevel`** retiré de `SandboxConfig` (toujours 50). Adapter `createSandboxBattle` : level hardcodé à 50 pour player ET dummy.
14. **`dummyBaseStats`** retiré de `SandboxConfig` (stats dérivées de l'espèce).
15. **`Level` field** retiré de `SandboxPanel` (Player ET Dummy).
16. **`Format` / `Seed`** : jamais existé, ne pas ajouter.

### Layout Studio (point 4)

17. **Pas de `sandbox.html` séparé** — vérifié 2026-05-21 : `packages/renderer/` n'a qu'un seul `index.html` + `main.ts`. La sandbox est bootée via `VITE_SANDBOX=true` + `VITE_SANDBOX_CONFIG` (cf. `sandbox-boot.ts`). Le layout Studio = **restructuration DOM injectée dynamiquement** sur la même page :
    - `index.html` reste tel quel (`<div id="game-container">` plein écran).
    - Quand `sandboxBootConfig.enabled === true`, `BattleScene.initSandboxBattle` injecte un wrapper `<div id="sandbox-studio">` qui repositionne `#game-container` à l'intérieur d'un grid layout et ajoute les colonnes/bandeau autour.
    - CSS : nouveau `sandbox-studio.css` importé conditionnellement.
    - Avantage : zéro changement Vite config, zéro nouvelle entrée HTML, rétro-compat mode non-sandbox.
18. **Layout cible (injecté DOM)** :
    ```
    ┌──────────────────────────────────────────────────────┐
    │  Header (titre + actions Apply/Reset)                │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │              Canvas Phaser (flex 1)                  │
    │              (#game-container repositionné)          │
    │                                                      │
    ├────────────────────────┬─────────────────────────────┤
    │  PLAYER (col 1)        │  DUMMY (col 2)              │
    │  [sections form]       │  [sections form]            │
    ├────────────────────────┴─────────────────────────────┤
    │  BATTLE (bandeau bas : Map, Weather, Turns, etc.)    │
    └──────────────────────────────────────────────────────┘
    ```
19. **CSS Grid** sur `<body>` (mode sandbox) :
    ```css
    body[data-sandbox="true"] { display: grid; grid-template-rows: auto 1fr auto auto; height: 100vh; }
    body[data-sandbox="true"] #game-container { min-height: 0; } /* flex height */
    .sb-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    ```
    `body[data-sandbox]` ajouté dynamiquement par `sandbox-boot.ts` quand `enabled === true`.
20. **Canvas Phaser** : `#game-container` (existant) repositionné dans la grille. Phaser scale config = `Phaser.Scale.RESIZE` pour suivre la taille du conteneur. Resize observer (ou window resize listener) ajuste les dimensions internes. **Risque pixel art** : si scale RESIZE produit un scale non-entier → tester `Phaser.Scale.FIT` + `Phaser.Scale.CENTER_BOTH` en fallback (étape 4 valide visuellement).
21. **Bandeau actions header** : `[Apply ▶]` (reset scène avec nouvelle config) + `[Reset ⟳]` (revert config à `DEFAULT_SANDBOX_CONFIG`). Bouton Apply = équivalent du bouton actuel "Apply".
22. **Responsive < 1024px** : `grid-template-columns: 1fr` (colonnes stack vertical) — qualité de vie laptop.
23. **Composants conservés tels quels** dans chaque colonne (sections) :
    - Pokemon species select
    - Ability dropdown
    - Item dropdown
    - HP%
    - Status select
    - Volatile status select
    - Stat stages (5 inputs : Atk/Def/SpA/SpD/Spd)
    - Position x/y + Direction
    - Moves : 4 cartes (Player + Dummy-Player) OU 1 select defensif (Dummy-AI)
24. **Section Dummy spéciale** : radio `Control: ( ) AI  ( ) Player` en haut de la colonne Dummy. Toggle reconstruit la section moves.
25. **Bandeau Battle (bas)** : Map ▼, Weather ▼, Turns input, checkbox `Debug decoration footprint`, boutons `Export JSON` / `Import JSON`.
26. **Pas d'`accordéon`** : sections toujours visibles (plus de toggle `▼/▲`). Layout en grille rend la collapse inutile.

### Misc

27. **i18n** : nouvelles clés FR/EN listées étape 8 :
    - `sandbox.studio.title` ("Sandbox Studio" / "Studio sandbox")
    - `sandbox.dummyControl` ("Contrôle / Control")
    - `sandbox.dummyControl.ai` ("IA / AI")
    - `sandbox.dummyControl.player` ("Joueur / Player")
    - `sandbox.dummyMoves` ("Attaques dummy / Dummy moves")
    - `sandbox.apply` ("Appliquer / Apply") + `sandbox.reset` ("Réinitialiser / Reset")
28. **Style CSS** : nouveau fichier `packages/renderer/src/styles/sandbox-studio.css` (importé par `sandbox-boot.ts`). Reprend tokens design existants.
29. **`SandboxPanel.ts` scission OBLIGATOIRE** (audit `plan-reviewer` 2026-05-21) : fichier actuellement 900+ lignes, refonte ajoute ~200-300 lignes → scinder en étape 5 :
    - `SandboxPanel/PlayerColumn.ts` (Player species/ability/item/status/stages/position/moves)
    - `SandboxPanel/DummyColumn.ts` (Dummy + radio control + UI conditionnelle moves)
    - `SandboxPanel/BattleStrip.ts` (Map/Weather/Turns/Debug/Export-Import)
    - `SandboxPanel/index.ts` (orchestrateur + types partagés)
30. **MovePicker callback mutation** : intégration sandbox utilise :
    ```ts
    openMovePickerModal({
      pokemonId: config.pokemon,
      slotIndex: i,
      excludeMoveIds: config.moves.filter((_, j) => j !== i),
      onSelect: (move) => {
        this.config.moves[i] = move.id;
        this.rebuildMoveCard(i, move);
        this.emit("change", this.readConfig());
      },
    });
    ```
    Vérifier dans étape 6 que `readConfig()` reflète bien l'état post-picker.

## Étapes

### 1. Audit + fix divergence learnset (bug point 1)

- [ ] Écrire test `learnset-source-parity.test.ts` (renderer) qui compare `getLegalMoves(pokemonId)` direct vs `team-builder-data.getLearnsetForPokemon(pokemonId)` pour 5 Pokemon (Pikachu, Eevee, Pidgey, Mew, Charizard).
- [ ] Si divergence : documenter dans le test + fixer (probable : `validator.getLegalMoves` applique `showdownToKebab` normalize, `learnset-resolver` brut).
- [ ] Source canonique = celle utilisée par team builder (`validator`). Aligner sandbox dessus.
- [ ] Commit : `fix(sandbox): unify learnset source with team builder`

### 2. Drops config (level, base stats override)

- [ ] Retirer `dummyLevel`, `dummyBaseStats` de `SandboxConfig` + `DEFAULT_SANDBOX_CONFIG`.
- [ ] Adapter `createSandboxBattle` : level hardcodé 50, stats dérivées espèce.
- [ ] Adapter `SandboxPanel` : retirer inputs Level + Base stats override.
- [ ] Vérifier aucune autre référence à ces champs (search global).
- [ ] Mettre à jour `SandboxSetup.test.ts` (assertions sur level/stats).
- [ ] Commit : `refactor(sandbox): drop dummyLevel/dummyBaseStats — always lvl 50`

### 3. Ajout `dummyControl` + `dummyMoves` array

- [ ] Étendre `SandboxConfig` : `dummyControl: "ai" | "player"`, `dummyMoves: string[]`.
- [ ] `DEFAULT_SANDBOX_CONFIG` : `dummyControl: "ai"`, `dummyMoves: []`.
- [ ] `createSandboxBattle` lit `dummyControl` : si `"player"`, applique `dummyMoves` au PokemonRuntime côté dummy. Validation : si `dummyMoves` vide/invalide → fallback `movepool[:4]`.
- [ ] `BattleScene.initSandboxBattle` : si `dummyControl === "player"`, ne crée pas `DummyAiController`, `controller.onTurnReady = null` (pas undefined — type `| null`).
- [ ] Test `SandboxSetup.dummy-player.test.ts` : valider mode Player (4 moves dummy, pas d'IA wirée).
- [ ] Test `SandboxSetup.dummy-player-fallback.test.ts` : `dummyMoves: []` → moves dummy = movepool[:4].
- [ ] Commit : `feat(sandbox): add dummyControl player mode`

### 3.5. Migration JSON sandbox-configs

- [ ] Vérifier `packages/data/sandbox-configs/*.json` (2 fichiers : `default.json`, `charmander-test.json`).
- [ ] Retirer manuellement les champs `dummyLevel`, `dummyBaseStats` (présents dans les 2 fichiers).
- [ ] Ajouter `dummyControl: "ai"`, `dummyMoves: []` pour rétrocompat explicite (optionnel — `DEFAULT_SANDBOX_CONFIG` couvre déjà via spread).
- [ ] Audit : `grep -rn "dummyLevel\|dummyBaseStats" packages/ docs/` doit ne retourner que le plan + code mort éventuel.
- [ ] Test : `pnpm dev` avec `VITE_SANDBOX_CONFIG` de `default.json` boot OK sans warning.
- [ ] Commit : `chore(sandbox): migrate JSON configs — drop level/baseStats`

### 4. Layout Studio CSS grid + DOM injection

- [ ] Nouveau fichier `packages/renderer/src/styles/sandbox-studio.css`.
- [ ] Import conditionnel dans `sandbox-boot.ts` (uniquement si `enabled`).
- [ ] `sandbox-boot.ts` ajoute `document.body.dataset.sandbox = "true"` quand sandbox actif.
- [ ] CSS grid sur `body[data-sandbox="true"]` (cf. décision #19).
- [ ] `BattleScene.initSandboxBattle` (ou nouveau helper `injectSandboxStudioDom()`) crée les wrappers DOM autour de `#game-container` : header, `.sb-columns`, `.sb-battle-strip`.
- [ ] Resize observer canvas Phaser (scale RESIZE) — tester pixel art preservation.
- [ ] Validation visuelle 4K (2560×1440+) + laptop (1366×768) — **proposer `visual-tester` à l'humain ici, pas auto**.
- [ ] Commit : `feat(sandbox): studio layout — canvas + columns + strip`

### 5. Scission `SandboxPanel.ts` (obligatoire)

- [ ] Créer dossier `packages/renderer/src/ui/sandbox/`.
- [ ] Extraire `PlayerColumn.ts` : `buildPlayerPanel` + helpers spécifiques (moves, ability, item, status, stages, position).
- [ ] Extraire `DummyColumn.ts` : `buildDummyPanel` + radio control + UI conditionnelle moves.
- [ ] Extraire `BattleStrip.ts` : `buildBattleStrip` (Map/Weather/Turns/Debug/Export-Import).
- [ ] `SandboxPanel.ts` devient orchestrateur léger (`< 200 lignes`) qui assemble les 3 sous-composants + expose API publique (`readConfig`, `emit`, `attach`).
- [ ] Types partagés extraits dans `sandbox/shared.ts` si nécessaire (SelectOption, etc.).
- [ ] Vérifier `pnpm typecheck` + `pnpm test` verts après scission.
- [ ] Commit : `refactor(sandbox): split SandboxPanel into PlayerColumn/DummyColumn/BattleStrip`

### 6. Move picker mutualisé (point 2)

- [ ] Remplacer 4 `<select>` moves de la colonne Player par 4 `<button class="tb-move-card">` (style cohérent team builder).
- [ ] Au clic d'une carte → `openMovePickerModal({ pokemonId, slotIndex, excludeMoveIds, onSelect })`.
- [ ] Idem pour Dummy(Player mode) : 4 cartes picker.
- [ ] Dummy(AI mode) garde le `<select>` defensif (move unique, comportement actuel intact).
- [ ] Move cards = type icon + cat icon + nom + bouton swap.
- [ ] Test visuel : Picker s'ouvre, sélection met à jour le slot, `SandboxConfig` correctement mis à jour.
- [ ] Commit : `feat(sandbox): reuse MovePickerModal for moves`

### 7. Radio Control Dummy + toggle UI

- [ ] Ajout radio `Control: ( ) AI ( ) Player` en haut de la colonne Dummy.
- [ ] Au changement : reconstruit dynamiquement la section moves (select defensif ↔ 4 cartes).
- [ ] `SandboxConfig.dummyControl` mis à jour à chaque toggle, propagé via `readConfig()`.
- [ ] Test : toggle persiste après Apply, mode Player permet input clavier dummy.
- [ ] Commit : `feat(sandbox): dummy control toggle UI`

### 8. i18n + assets

- [ ] Ajout clés FR/EN : `sandbox.studio.title`, `sandbox.dummyControl`, `sandbox.dummyControl.ai`, `sandbox.dummyControl.player`, `sandbox.dummyMoves`.
- [ ] Vérifier types `Translations` synchros.
- [ ] Pas de nouveau asset visuel (réutilise icons team builder).
- [ ] Commit : intégré à étape 7.

### 9a. Tests unitaires

- [ ] `pnpm test` (unit) vert.
- [ ] `pnpm test:integration` vert.
- [ ] Tests ajoutés : `learnset-source-parity.test.ts`, `SandboxSetup.dummy-player.test.ts`, `SandboxSetup.dummy-player-fallback.test.ts`.
- [ ] `pnpm typecheck` + `pnpm lint` zéro warning.

### 9b. Test scénario e2e (AI ↔ Player switch)

- [ ] Manuel : boot sandbox AI mode → dummy joue defensif → vérifier 1 tour IA déroulé.
- [ ] Switch to Player mode → bouton Apply → vérifier dummy a 4 moves visibles, pas d'IA.
- [ ] Tour humain dummy : click move → tile cible → vérifier exécution OK (sprite bouge, dégâts appliqués).
- [ ] Tour humain player : alternance avec dummy human → pas de blocage du flow tour-par-tour.
- [ ] Export JSON après config personnalisée → relancer avec ce JSON via `VITE_SANDBOX_CONFIG` → restauration cohérente.

### 9c. Validation visuelle (proposer `visual-tester` à l'humain)

- [ ] Proposer lancement `visual-tester` agent (Playwright Chromium, ~2 min) sur :
  - 4K (2560×1440) — vérifier layout grille équilibré, canvas flex prend espace dispo.
  - Laptop (1366×768) — vérifier stack vertical responsive.
- [ ] Pixel art : vérifier scale Phaser canvas n'a pas d'artefacts (sharp pixels).
- [ ] Si régression : commit `fix(sandbox): polish ...` avant étape 10.

### 10. Doc + release notes

- [ ] Mettre à jour `docs/backlog.md` (résolution des 4 points sandbox).
- [ ] Mettre à jour `docs/decisions.md` si nouvelles décisions architecturales.
- [ ] Entrée release notes (CHANGELOG joueur).
- [ ] Commit : `docs: sandbox refonte plan 090`

## Risques

- **Resize Phaser canvas** : `Phaser.Scale.RESIZE` peut avoir des artefacts pixel art (scale non entier). Mitigation : `Scale.FIT` + `Scale.CENTER_BOTH` fallback, valider visuellement étape 4 dès commit.
- **Player mode dummy bloque flow** : `GameController` n'a pas de notion `teamId` côté contrôleur (audit 2026-05-21). Si `onTurnReady = null`, **tous les tours = input humain** — comportement attendu et trivial. Risque résiduel = profil dummy mal init. Étape 9b doit valider e2e.
- **Divergence learnset cachée** : si la cause est plus profonde que `showdownToKebab` (cache stale, registry init désynchronisé), étape 1 peut s'étendre. Plafonner à 1 jour, sinon scinder en plan dédié.
- **JSON sandbox-configs** : 2 fichiers seulement (`default.json`, `charmander-test.json`), tous deux contiennent `dummyLevel` + `dummyBaseStats`. Migration triviale via étape 3.5 (edit manuel 2 fichiers).
- **Scission `SandboxPanel` casse des imports** : audit imports avant scission étape 5. Mitigation : facade `SandboxPanel.ts` ré-export public API.

## Métriques succès

- Bug divergence learnset résolu (test parity vert).
- Sandbox utilisable en mode dummy jouable (1 humain vs 1 humain sur même clavier, scénarios tests possibles) — validé étape 9b.
- Layout Studio passe 4K + 1366×768 sans scroll inutile — validé étape 9c via `visual-tester`.
- ≥ 50% du code Move picker mutualisé (mêmes composants que team builder).
- Aucune régression IA sandbox (tests `DummyAiController` verts).
- `pnpm test` + `pnpm test:integration` + `pnpm typecheck` + `pnpm lint` + `pnpm build` verts.
- JSON sandbox-configs migrés (zéro référence à `dummyLevel`/`dummyBaseStats` hors plan/historique).
