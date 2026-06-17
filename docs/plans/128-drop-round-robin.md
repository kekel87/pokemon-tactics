# Plan 128 — Drop du mode Round-Robin (CT seul)

**Statut : done** — implémenté 2026-06-17. Design tranché + revu (plan-reviewer + game-designer), livré en un seul commit.

Note : la **notion de round est supprimée** (caduque en CT) — voir étape 1ter. Le jeu ne raisonne plus qu'en tours CT individuels + `actionCounter`.

## Objectif

Retirer entièrement le système de tour **Round-Robin** (RR). Ne garder que le **Charge Time** (CT), seul mode expédié (défaut team-select). Supprimer le toggle UI, le code RR mort, et le concept `TurnSystemKind`. Le drop force la mise au propre de l'horloge de durée CT (Lot B) et — décision humaine — le retrait du **mécanisme d'usage PP** devenu obsolète en CT (Lot C).

Origine : `docs/roadmap.md` § Post-Babylon, chantier **e**. Décision #255 (coexistence CT/RR pour A/B sandbox) devient caduque. **Tout en un seul plan / un seul commit** (choix humain 2026-06-17).

## Lot C — Retrait du mécanisme d'usage PP (décision humaine 2026-06-17)

En CT, la fréquence d'usage est régie par le coût CT → le **compteur de PP** (limite d'utilisation) fait doublon. On retire le mécanisme d'usage **mais on garde `MoveDefinition.pp`** : il reste le **poids de coût CT** dans `computeMoveCost(pp, …)`. → **balance CT inchangée**, seul l'usage/affichage saute.

À retirer :
- `PokemonInstance.currentPp` (champ) + toutes ses initialisations : `BattleSetup.ts`, `SandboxSetup.ts`, `battle-orchestrator.ts`, `mock-pokemon.ts`, `mock-battle.ts`, `build-test-engine.ts`, `build-fall/height-test-engine.ts`.
- Gating runtime : `getLegalActions` (`:560-561`), exécution (`:946-947`), décrément (`:1014`, `:1091`), gate IA (`action-scorer.ts:721`). `BattleEngine.ts:2158` `requiresAsleep && currentPp>0` → garder `requiresAsleep` seul.
- Fin anticipée d'Encore si PP=0 (`timed-volatile-tick-handler.ts:33`) → Encore tient sa durée pleine. Vérifier `handle-disable.ts`/`handle-encore.ts`.
- UI : affichage PP dans `MovesList.ts`, `MovePickerModal.ts`, `team-edit-screen.ts`, `SandboxPanel.ts`, tooltips + clés i18n `pp`.
- Tests : `currentPp` des mocks/builders + tests de déplétion PP.

À **garder** : `MoveDefinition.pp` (coût CT) ; `validate.ts:43` `move.pp > 0` (intégrité donnée pour le coût) ; Struggle (move normal, override `tactical.ts`) ; Pressure (déjà coût CT, `pressure.ts`). Spite/Grudge/Leppa absents du roster → rien.

## État des lieux (constaté)

- **Défaut expédié = CT** : `team-select-screen.ts:47` initialise `turnSystemKind = TurnSystemKind.ChargeTime`. RR n'est qu'une option du `<select>`.
- **Incohérence ctor** : `BattleEngine` constructeur défaut = `RoundRobin` (`:163`). C'est pourquoi `buildMoveTestEngine` (param `turnSystemKind=undefined`) fait tourner **tous les tests de moves en RR**.
- **CT réutilise `turnOrder`/`currentTurnIndex`** comme pointeur « acteur courant » (single-element) : écrits `advanceTurnCt` (`:2747-2748`), lus `getActivePokemonId` (`:487`), `computeCurrentMoveCost` (`:2643`), `predictCtTimeline` (`:2665`). ⇒ **ces deux champs ne sont PAS purement RR**, on les garde.
- **RR-only** (à supprimer) :
  - `TurnManager.ts` (classe entière, instanciée `:191`, exportée `index.ts`).
  - `advanceTurn()` (`:2250`+, ~150 lignes), branche `else` de `:2244`.
  - `computePredictedNextRoundOrder()` + champ `predictedNextRoundOrder` (`battle-state.ts:15`, écrit `:2876`).
  - Param ctor `turnSystemKind`, champ `this.turnSystemKind`, branches `=== ChargeTime` (`:222`, `:486`, `:2241`).
  - Enum `TurnSystemKind` (`enums/turn-system-kind.ts`) + export `enums/index.ts`.
  - Champ `BattleState.turnSystemKind` (`:16`).

## Périmètre fichiers

### Core (`packages/core`)
- `enums/turn-system-kind.ts` → **supprimer** ; retirer de `enums/index.ts`.
- `battle/TurnManager.ts` → **supprimer** ; retirer export `index.ts`.
- `battle/BattleEngine.ts` → retirer param ctor + champ + branches + `advanceTurn` + `computePredictedNextRoundOrder` + `this.turnManager`. `advanceTurnCt` devient l'unique chemin (renommer `advanceTurn` ? voir Décision 2).
- `types/battle-state.ts` → retirer `turnSystemKind?`, `predictedNextRoundOrder`. **Garder** `turnOrder`/`currentTurnIndex` (pointeur CT).
- `testing/build-move-test-engine.ts` → retirer le slot `turnSystemKind` (ctor n'a plus le param). **Bascule de fait en CT.**
- `testing/build-ct-test-engine.ts`, `testing/build-charge-time-system.ts` → simplifier (plus de kind à passer).
- Tests : `ct-system.scenario.test.ts`, `BattleEngine.predict-ct.test.ts`, `held-items.integration.test.ts` → retirer refs `TurnSystemKind`. **+ triage suite complète** (voir Risques).

### View-core (`packages/view-core`)
- `BattleSetup.ts`, `battle-orchestrator.ts` (`:305` fallback RR, `:338` branche CT), `battle-views.ts`/`.test.ts`, `sandbox-config.ts` (champ `turnSystemKind` #504 → retirer).

### Render-ports / ui-dom / app
- `render-ports/src/ports.ts`, `ui-dom/src/battle-chrome.ts`, `app/src/app/screens.ts`.
- `app/src/ui/dom/screens/team-select-screen.ts` → retirer le `<label>`/`<select>` CT/RR (`:243-258`), la var `turnSystemKind` (toujours CT en interne).
- i18n `locales/en.ts` + `fr.ts` + `types.ts` → retirer `teamSelect.turnSystem.label`, `teamSelect.turnSystemCt`, `teamSelect.turnSystemRr`.

### e2e
- `e2e/` : retirer toute interaction avec le select de tour + assertions « 2 options » éventuelles. Golden team-select à régénérer si la ligne disparaît.

### Docs
- `decisions.md` : nouvelle décision « RR retiré, CT seul » ; marquer #255 caduque, ref #62/#254/#504.
- `roadmap.md` : cocher chantier e (`:278`).
- `docs/next.md`, `STATUS.md` : MAJ.
- `docs/game-design.md` : si le RR y est documenté comme mode.

## ⚠️ Découverte bloquante — l'horloge de round CT est incomplète

`state.roundNumber` n'est incrémenté **que** dans `advanceTurn` (RR) : `BattleEngine.ts:2257/2308/2364`. `ChargeTimeTurnSystem` n'a aucune notion de round, et **aucun autre site n'écrit `roundNumber`** (grep exhaustif). ⇒ **en CT, `roundNumber` reste gelé** à sa valeur initiale.

Or toutes les **durées** dédupent leur décrément sur `roundNumber` :
- `weather-tick-handler.ts:47` — `weatherLastTickRound !== roundNumber` → météo ne décompte jamais en CT (dégâts continuent, durée infinie).
- `aura-tick-handler.ts:23` (`aurasLastTickRound`), `field-terrain-tick-handler.ts:64` (`fieldTerrainsLastTickRound`) — barrières/champs n'expirent jamais en CT.
- `defensive-clear-handler.ts:21-23` — Protection se nettoie via `roundApplied < roundNumber` ; gelé en CT → la 2ᵉ clause `turnIndexApplied < currentTurnIndex` est toujours `0<0`.

**C'est un bug latent pré-existant de CT**, masqué parce que toute la suite de tests tourne en RR (où `roundNumber` avance). Le drop de RR n'aggrave rien *en prod* (le code RR n'est jamais exécuté en CT aujourd'hui), **mais** la bascule des tests RR→CT (inévitable : CT devient le seul moteur) va exposer ce bug — les tests de durée échoueront en CT.

### Modèle de durée retenu (décision humaine 2026-06-17) — « tours du lanceur »

Plutôt que de réinventer un « round » global, **chaque effet à durée se décompte sur les tours de son lanceur** :

- Chaque effet global mémorise déjà son lanceur : météo `weatherSetterPokemonId`, barrières `TeamAura.casterId`, champs `FieldZone` setter. Protection = propriétaire = le mon lui-même.
- **Décrément à la fin du tour du lanceur** (plus de gating sur `roundNumber`).
- **Identité de design** : un lanceur **lent** → ses N tours s'étalent longtemps → effet durable ; lanceur rapide → effet bref. **Récompense les Pokémon lents** (intention explicite du directeur créatif).
- **Lanceur KO → horloge fantôme (météo + champs UNIQUEMENT)** : le lanceur mort d'un effet **environnemental** (météo, champs) **reste suivi comme s'il jouait**. Il demeure dans le scheduler CT en *ghost* : il accumule du CT à sa Vitesse, et à chaque fois qu'il « aurait agi », on décrémente ses effets. Quand tous ses effets environnementaux tombent à 0, le ghost est retiré. Le ghost ne joue aucune action, n'est pas ciblable, ne compte pas pour la condition de victoire.
- **Barrières (`TeamAura` : Reflet/Mur Lumière/Brume/Rune Protect) → s'arrêtent à la mort du lanceur** (décision humaine 2026-06-17). On **garde** `removeAurasOfCaster` dans `handleKo`. Justification : une barrière est liée à la présence du lanceur ; pas de ghost pour les auras. Tant que le lanceur est vivant, l'aura décompte sur **ses tours** (comme les autres).
- Distinction nette : **environnemental (météo/champs) = persiste via ghost** ; **protection d'équipe (barrières) = meurt avec le lanceur**.
- **Divergence canon assumée** : Pokémon classique = durées en tours fixes (5), indépendantes de la Vitesse. Nous : durée liée à la Vitesse du lanceur. Choix tactique délibéré.

**`roundNumber`** : découplé des durées. Reste pour l'affichage/les events (`TurnStarted.roundNumber`). Son incrément correct en CT (actuellement gelé → HUD figé) = **follow-up séparé** hors de ce chantier (cosmétique, non gameplay), noté backlog.

### Sous-chantiers induits

Le drop de RR force donc **2 lots** dans ce plan :
- **Lot A — Drop RR** : suppression du code/concept RR (cf. périmètre).
- **Lot B — Modèle de durée CT « tours du lanceur » + horloge fantôme** : refonte des 4 systèmes de durée (météo/barrières/champs/Protection) pour décompter sur le tour du lanceur, + ghost-clock post-KO. C'est ce qui débloque la bascule des tests en CT.

## Décisions tranchées (humain, 2026-06-17)

- **Nettoyage complet** (« tu nettoies le code évidemment ») : `turnOrder[]`+`currentTurnIndex` → un seul champ `activePokemonId: string` ; retrait `turnIndexApplied` de `ActiveDefense` ; rename `advanceTurnCt`/`endCurrentTurnCt` → `advanceTurn`/`endCurrentTurn`. Pas de scaffolding RR résiduel.
- **Un seul système** (« je ne prévois pas de faire vivre deux systèmes en // ») : suppression franche, aucune compat RR conservée.
- **Reste à trancher** : l'horloge de round CT (ci-dessus) — bloquant.

## Stratégie de test (risque principal)

`buildMoveTestEngine` bascule RR→CT pour ~toute la suite core. Hypothèse : la majorité des tests de moves assertent une **mécanique** (dégâts/statut) sur l'acteur courant, agnostiques au système de tour → passent. Risque concentré sur : ordre de tour, ticks fin-de-tour multi-tours, compteurs round.

Procédure : (1) appliquer le retrait core ; (2) `pnpm test` ; (3) **triage des échecs** — distinguer « test légitimement RR-spécifique à supprimer » vs « test à réécrire en sémantique CT ». Documenter le compte d'échecs et la nature dans ce plan avant correction.

## Étapes

### Lot B — Modèle de durée CT « tours du lanceur » (**doit être COMPLET et vert avant le triage Lot A**)
1. **Décompte des durées sur le tour du lanceur** : centraliser le décrément dans `endCurrentTurn(pokemonId)` (ex-`endCurrentTurnCt`) — pour chaque effet à durée dont le lanceur `=== pokemonId`, décrémenter `turnsRemaining`, émettre les events Dissipated à 0. **Retirer le gating `xxxLastTickRound !== roundNumber`** des handlers météo/aura/champs (ils gardent l'effet périodique : dégâts météo etc., mais ne décrémentent plus la durée — c'est `endCurrentTurn` qui le fait). **Discriminant de catégorie** (météo / champ / barrière) requis pour le filtrage post-KO (étape 2).
1bis. **Protection** : `defensiveClearHandler` passe d'un check `roundApplied`/`turnIndexApplied` à un **décompte au prochain tour du propriétaire**. Retirer `turnIndexApplied` ET `roundApplied` de `ActiveDefense`.
1ter. **🔴 Suppression totale de la notion de « round »** (décision humaine 2026-06-17 — caduque en CT) : retirer `BattleState.roundNumber`, les 3 dédups `weatherLastTickRound`/`aurasLastTickRound`/`fieldTerrainsLastTickRound` (le décrément passe sur le tour du lanceur → ces champs n'ont plus lieu d'être), `roundNumber` de l'event `TurnStarted` (et tout consommateur : `ports.ts`, `battle-chrome.ts`, `battle-views.ts`, `battle-orchestrator.ts` + affichage), `regenerate-golden-replay.ts`. **`PokemonInstance.lastEndureRound`** (anti-spam Endure/Ténacité, seule vraie dépendance sémantique au round) → reporter sur `actionCounter` (déjà model-agnostic). Vérifier `handle-defensive.ts`.
2. **Horloge fantôme post-KO (météo + champs UNIQUEMENT)** :
   - **🔴 Préalable** : `getCtGainForPokemon` (`BattleEngine.ts:~2622`) renvoie **0** pour un mon KO → à corriger pour que le ghost gagne du CT à sa **Vitesse** (`getEffectiveInitiative` renvoie déjà la Vitesse même KO). Sans ça le ghost n'avance jamais.
   - **Où** : mutation de `ChargeTimeTurnSystem` — `onPokemonKO(id)` ne `delete` du `ctMap` que si le mon ne porte aucun effet **environnemental** actif ; sinon il y reste, marqué ghost.
   - **Boucle** : dans `advanceTurn` (CT), si l'acteur est un ghost (HP 0) → décrémenter ses effets météo/champs, re-payer un coût CT standard, retirer du `ctMap` quand vidé, `continue`.
   - **Intégration** : `getLegalActions` retourne `[]` / n'est jamais sollicité pour un ghost ; `predictCtTimeline` ignore les ghosts ; `battleOver`/condition de victoire ne comptent pas le ghost ; le ghost n'est pas ciblable.
   - **Barrières** : **garder `removeAurasOfCaster`** dans `handleKo` (meurent avec le lanceur, pas de ghost).
3. **Tests Lot B (vert obligatoire avant Lot A)** : (a) durée météo/champ/Protection/barrière décrémente sur le tour du lanceur, lanceur lent vs rapide ; (b) `roundNumber` gelé n'empêche plus le décrément (test direct) ; (c) ghost météo/champ expire post-KO et est retiré une fois vidé ; (d) ghost n'agit pas, hors `getLegalActions`/`predictCtTimeline`/victoire ; (e) barrière disparaît au KO du lanceur.

### Lot A — Drop RR
4. Core : supprimer enum `TurnSystemKind` + `TurnManager` + branches `=== ChargeTime` + `advanceTurn` (RR) + `computePredictedNextRoundOrder` + param ctor + `predictedNextRoundOrder`. Le chemin CT devient l'unique (renommer `advanceTurnCt`/`endCurrentTurnCt` → `advanceTurn`/`endCurrentTurn`).
5. **Nettoyage state** : grep exhaustif `state.turnOrder[` + `state.currentTurnIndex` AVANT migration (lecteurs connus : `replay-runner.ts:11`, `aggressive-ai.ts:22`, `action-scorer.ts:47`, `BattleEngine.ts:487/2643/2665`, builders, ~37 fichiers de tests). Puis `turnOrder[]`+`currentTurnIndex` → `activePokemonId: string`, migrer tous les lecteurs.
6. Testing helpers : `buildMoveTestEngine` & co. perdent le param kind (CT de fait ; un appel `RoundRobin` doit devenir une erreur de compile). **Triage** : 6.1 lancer `pnpm test`, documenter ici nombre + nature des échecs ; 6.2 classifier puis fixer groupés — supprimer les tests purement RR (ordre de tour multi-mons), réécrire en sémantique CT ceux qui restent pertinents.

### Lot C — Retrait usage PP
6b. Core : retirer `currentPp` (champ + inits) + tous les gatings/décréments runtime + fin-anticipée Encore sur PP. Garder `move.pp` + `validate.ts`. Suite verte.
6c. UI + i18n : retirer l'affichage PP des composants + clés.
6d. IA : retirer le gate `currentPp <= 0` (`action-scorer.ts:721`). **Pondérer la Vitesse du lanceur** dans le score des setters météo/champs/barrières (un lanceur lent = effet plus durable = plus de valeur), sinon l'IA sous-évalue les setups sur Pokémon lents.

### Intégration
7. View-core + ports + ui-dom : retirer `TurnSystemKind`, orchestrator fallback inconditionnel CT, `SandboxConfig.turnSystemKind` retiré (#504). Retirer init `currentPp` (BattleSetup/SandboxSetup/orchestrator).
8. App : retirer le `<select>` CT/RR team-select + clés i18n `teamSelect.turnSystem*`.
9. e2e : retirer interactions toggle, régénérer golden team-select si besoin.
10. Docs : `decisions.md` (RR retiré + modèle durée « tours du lanceur » + révise #095/#098/#255/#504), `roadmap.md` (chantier e coché), `game-design.md` (système de tour + durées), `next.md`, `STATUS.md`. Backlog : `roundNumber` affichage en CT (follow-up).
11. Gate CI complet.

## Risques

- **Triage tests RR→CT** (étape 6) — incertitude sur le volume d'échecs ; le Lot B doit avoir corrigé les échecs « durée gelée ». Reste les tests d'ordre de tour multi-mons (RR-spécifiques) → réécrire en CT ou supprimer.
- **Horloge fantôme** — vérifier non-interférence : `battleOver`, ciblage, `getLegalActions`, `predictCtTimeline`, snapshots CT.
- **🔴 `getCtGainForPokemon` renvoie 0 pour un mon KO** (confirmé revue) → fix obligatoire pour le ghost (gain à la Vitesse). `getEffectiveInitiative` OK (renvoie la Vitesse même KO).
- Golden e2e team-select + golden replay (`regenerate-golden-replay.ts`) à régénérer.
- **Balance (revue game-designer + décision humaine)** : durées « tours du lanceur » = design assumé, favorise les lents. **Pas de plafond sur la durée fantôme post-KO** (décision humaine 2026-06-17) : un setter lent KO maintient son effet longtemps — c'est voulu, pas un bug. **À vérifier en impl** : les moves de setup (Danse-Lames, etc.) ont le bon `effectTier` (sinon coût CT trop bas → spam une fois les PP retirés). Surveiller Kangourex/Danse-Lames en playtest.
