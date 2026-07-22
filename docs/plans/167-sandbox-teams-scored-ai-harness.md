# Plan 167 — Studio sandbox multi-Pokémon par équipe + harness e2e IA « scoré »

- **Statut** : `done` (implémenté 2026-07-22, commit WIP `024c770`)
- **Auteur** : Claude
- **Date** : 2026-07-22
- **Débloque** : e2e des heuristiques IA (plans 159/160/161), item `docs/next.md` « e2e IA bloqué par harness » (en attente depuis 2026-07-14)
- **Dépend de** : rien (leviers déterministes IA déjà présents côté core)

---

## 1. Problème

Le harness sandbox (`?config=` / `pnpm dev:sandbox`) est **1v1 fixe** et ne câble jamais le vrai scorer IA :

- `dummyControl: "ai"` → `DummyAiController` **scripté** (1 move défensif fixe + fin de tour, `combat-screen.ts:416-427`). N'appelle jamais `scoreAction`.
- Le vrai `AiTeamController` → `pickScoredAction` → `scoreAction` n'est atteignable **que** par le flux placement/team-select (`wireScoredAi`, `combat-screen.ts:286-311`), hors sandbox.
- Même dans ce flux, le PRNG de décision IA = `createPrng(Date.now())` (`combat-screen.ts:301`) → **non dérivé de `config.seed`** → non replayable en e2e.

Conséquence : **zéro assertion e2e déterministe** possible sur les familles d'heuristiques des plans 159/160/161 (ring-out, faux-KO, self-KO, lock-in, priorité/timing, manip-talent, buff/statut, grille, field global, phazing, move-copy, stat manip).

### Bonne nouvelle : rien à inventer côté core

Les leviers déterministes existent déjà :
- `pickScoredAction(random)` prend déjà un `RandomFn` (`packages/core/src/ai/scored-ai.ts:14-64`).
- `AiProfile` a `randomWeight` + `topN` (`packages/core/src/types/ai-profile.ts`). **`HARD_PROFILE` = `randomWeight:0, topN:1` → choix 100 % déterministe, ne consomme même pas `random()`** (`packages/core/src/ai/ai-profiles.ts:28-38`).
- Le PRNG **moteur** combat est déjà seedé depuis `config.seed` dans les deux flux (`packages/view-core/src/BattleSetup.ts:263-271`).

Le chantier est donc **plomberie harness + UI**, pas de logique IA nouvelle.

### Décision de portée (humain, 2026-07-22)

Portée complète (prérequis 1→4). Le prérequis #4 (allié KO de départ pour tester Vœu Soin) **tombe naturellement** dès qu'on a des équipes multi-Pokémon — plus besoin de cas spécial. On en profite pour transformer le studio 1v1 en **studio N-vs-N par équipes**, avec l'UI voulue par l'humain (accordéon, add/trash, contrôle par équipe).

---

## 2. Vision UI (validée humain)

- Renommer **« Joueur » → « Équipe 1 »**, **« Dummy » → « Équipe 2 »**.
- Chaque équipe est un **accordéon** (un seul ouvert à la fois).
- En-tête d'équipe : nom + **sélecteur de contrôle** (un seul dropdown) : **Joueur / Auto passif / Facile / Moyen / Difficile** (voir §3).
- Dans l'équipe : **Pokémon empilés** (stack de cartes membres).
  - Bouton **« + Ajouter Pokémon »** sous la pile, **désactivé à 6 membres**.
  - **Icône poubelle** par membre pour supprimer, **désactivée s'il ne reste qu'un membre** (interdit d'enlever le dernier).
- Chaque membre garde l'éditeur actuel (Pokémon, moves, ability, item, HP, statut, volatile, stat stages, position, direction) — cf. `buildPokemonState`.

### Décisions UI (validées humain 2026-07-22)

1. **Cartes membres repliables, une seule ouverte** (accordéon à 2 niveaux). Évite le scroll géant à 6 mons.
2. **Résumé de carte membre repliée** : sprite + nom FR + HP. Clic = déplie l'éditeur.
3. Le sélecteur de contrôle par équipe pilote l'affichage (via `data-control-mode`) : `player` masque les moves défensifs, les modes IA (`passive`/`scored`) masquent la move-list éditable joueur, etc.

---

## 3. Contrôle par équipe — un dropdown, 5 choix

Un seul sélecteur par équipe expose 5 niveaux. En interne : `control` + `aiProfile`.

| Label UI | `control` | `aiProfile` | Controller câblé | Sémantique |
|----------|-----------|-------------|------------------|------------|
| **Joueur** | `player` | — | `HumanController` (chaque membre) | Input humain (comme `dummyControl:"player"` actuel) |
| **Auto passif** | `passive` | — | `DummyAiController` **par membre** (scripté) | Comportement défensif existant : chaque membre joue son `defensiveMove` + fin de tour. Rétro-compat du `dummyControl:"ai"` actuel |
| **Facile** | `scored` | `easy` | `AiTeamController` | Scorer, `EASY_PROFILE` |
| **Moyen** | `scored` | `medium` | `AiTeamController` | Scorer, `MEDIUM_PROFILE` |
| **Difficile** | `scored` | `hard` | `AiTeamController` | Scorer, `HARD_PROFILE` |

**Point clé déterminisme e2e** : `AiTeamController` reçoit `createPrng(config.seed ?? 0)` (et non `Date.now()`). Comme le choix scoré ne consomme `random()` que si `randomWeight > 0`, **les 3 profils deviennent déterministes/replayables** dès que le seed est fixé — Facile et Moyen inclus. `HARD_PROFILE` (`randomWeight:0`) l'est même sans consommer `random()`.

---

## 4. Schéma `SandboxConfig` v2

Aujourd'hui **plat** (`sandbox-config.ts:14-55`) : `pokemon/moves/hp/...` + `dummyPokemon/dummyControl/dummyMove/dummyMoves/...`. Cible :

```ts
interface SandboxTeamMemberConfig {
  pokemon: string;
  moves?: string[];            // écrase le learnset si non vide
  hp?: number;
  status?: string;
  volatileStatus?: string;
  statStages?: Record<string, number>;
  heldItem?: string;
  ability?: string;
  position?: { x: number; y: number };
  direction?: string;
  defensiveMove?: string | null; // mode "ai" scripté : move joué par ce membre
}

interface SandboxTeamConfig {
  control: "player" | "passive" | "scored";
  aiProfile?: "easy" | "medium" | "hard"; // requis si control === "scored"
  members: SandboxTeamMemberConfig[]; // 1..6
}

interface SandboxConfig {
  // globaux inchangés
  seed?: number;
  rngMode?: "random" | "deterministic";
  mapUrl?: string;
  weather?: string;
  weatherTurns?: number;
  // nouveau
  teams: [SandboxTeamConfig, SandboxTeamConfig];
}
```

### 4.1 Rétro-compat OBLIGATOIRE (adaptateur)

⚠️ **Tous les fixtures e2e existants (`e2e/fixtures/sandbox-configs.ts`) et toute URL sandbox déjà en circulation utilisent le schéma plat.** Sans adaptateur, toute la recette e2e tombe.

`normalizeSandboxConfig(raw): SandboxConfig` (nouveau, `packages/view-core/src/sandbox-config.ts`) :
- Si `raw.teams` présent → v2, utilisé tel quel (avec défauts).
- Sinon (schéma plat détecté via `raw.pokemon`) → mappe :
  - **Équipe 1** = `{ control: "player", members: [{ pokemon: raw.pokemon, moves: raw.moves, hp: raw.hp, status, volatileStatus, statStages, heldItem: raw.heldItem, ability: raw.playerAbility, position: raw.playerPosition, direction: raw.playerDirection }] }`
  - **Équipe 2** = `{ control: raw.dummyControl === "player" ? "player" : "passive", members: [{ pokemon: raw.dummyPokemon, moves: raw.dummyMoves, defensiveMove: raw.dummyMove, hp: raw.dummyHp, status: raw.dummyStatus, ..., ability: raw.dummyAbility, position: raw.dummyPosition, direction: raw.dummyDirection }] }` (l'ancien `dummyControl:"ai"` → `"passive"`)
- Appelé au boot **et** par la fusion `{ ...DEFAULT, ...parsed }` (`babylon-boot.ts:71-85`, `sandbox-boot.ts:4-15`).

**Tests unit** de l'adaptateur (v2 pass-through, plat→v2, champs manquants → défauts). Un test de non-régression : chaque fixture plat existant produit une battle valide.

---

## 5. Phases

### Phase 0 — Annexe : fix ordre Métamorph dans le picker *(indépendant, petit)*

Bug : Métamorph (Ditto) apparaît **en tête** du picker au lieu de #132.
- Cause : entrée custom sans `dexNumber` → `def.dexNumber ?? 0` (`team-builder-data.ts:108`) → tri ascendant (`:122`) place 0 avant #1.
- Fix : propager `dexNumber` dans la branche custom du loader (`packages/data/src/loaders/load-pokemon.ts:22-32`) **et** renseigner `dexNumber: 132` sur l'entrée custom `ditto` (`packages/data/src/playable/playable-pokemon.ts:88-98`).
- Vérif : Métamorph entre Ptéra (#142)… non, #132 → entre Kokiyas (#116 zone) et le reste, ordre dex correct. Test unit `getPlayablePokemon()` : `ditto` bien positionné, aucun `dexNumber` à 0.

### Phase 1 — Schéma v2 + adaptateur *(core view-core, testable seul)*

- Réécrire l'interface `SandboxConfig` + `DEFAULT_SANDBOX_CONFIG` (`packages/view-core/src/sandbox-config.ts`), re-export `packages/app/src/types/SandboxConfig.ts`.
- Implémenter `normalizeSandboxConfig` + tests unit.
- Brancher la normalisation dans les 3 chemins de parsing (`babylon-boot.ts`, `sandbox-boot.ts`, `e2e/pages/CombatScene.ts` — vérifier que le PO peut passer v2 direct).

### Phase 2 — Wiring battle N-vs-N + mode `scored`

- `packages/view-core/src/SandboxSetup.ts` (`createSandboxBattle`) : construire **2 équipes de 1..6 membres** au lieu de p1/p2 uniques. IDs `t1-m0`, `t1-m1`, … ; spawns depuis `format.spawnZones` (fallback si plus de membres que de zones → à gérer). Movesets par membre. HP/statuts/stages par membre.
- `packages/app/src/babylon/combat-screen.ts` (`startSandboxBattle`) : câbler le controller **par équipe** selon `team.control` :
  - `player` → Human (tous les membres du camp)
  - `passive` → `DummyAiController` par membre actif (scripté)
  - `scored` → **`AiTeamController(engine, playerId, profileFor(team.aiProfile), createPrng(config.seed ?? 0), moveDefinitions)`** (`profileFor` mappe `easy/medium/hard` → `EASY/MEDIUM/HARD_PROFILE`) — réutilise `wireScoredAi` généralisé.
- **Point de vigilance #4** : un membre avec `hp:0` au départ (allié KO pour Vœu Soin). Vérifier que `createBattleFromPlacements` / `rerunBattleStartChecks` acceptent un membre KO au spawn, et que `getLegalActions` l'exclut proprement (cf. anomalie signalée plan 159 : garde `currentHp > 0` manquante dans `BattleEngine.getLegalActions` — **peut nécessiter un fix core** ; à confirmer en Phase 2).

### Phase 3 — UI accordéon équipes

- `packages/app/src/ui/SandboxPanel.ts` : refonte de l'état `this.player`/`this.dummy` → `this.teams: TeamState[]` (`{ control, members: PokemonState[] }`). `readConfig()` (`:731`) produit le `teams`.
- `buildPokemonState(config, owner, container)` (`:328`) généralisé en `(teamIndex, memberIndex, container)`.
- Nouveaux composants : accordéon équipe (en-tête + sélecteur contrôle), carte membre repliable, bouton « + Ajouter Pokémon » (cap 6), poubelle (désactivée si dernier). Réutiliser les helpers `@pokemon-tactic/ui-dom` existants + `openPokemonPickerModal`.
- `packages/app/src/sandbox-boot.ts` (`initSandboxStudioDom`) : `.sb-column-player`/`.sb-column-dummy` → deux accordéons `.sb-team` (Équipe 1 / Équipe 2).
- CSS `packages/app/src/styles/sandbox-studio.css` : styles accordéon, pile membres, bouton add, poubelle. Conserver `data-control-mode` (étendu à `scored`).

### Phase 4 — e2e IA scoré + recette

- Nouveaux fixtures `scored` dans `e2e/fixtures/sandbox-configs.ts` (seed fixe ; profil `hard` par défaut pour la clarté, tout profil restant déterministe grâce au seed IA).
- Scénarios e2e pilotant le scorer, via `test-writer` : ring-out (« Le Mur »), faux-KO, self-KO/Sacrifice (dont **Vœu Soin** avec allié KO de départ), lock-in, priorité/timing, buff/statut, phazing, move-copy, stat manip. Croiser avec `docs/test-plan.md` §5.
- **Débloque aussi** au passage : cas de réussite précis Relâche/Avale + Stockage 3ᵉ palier (si un membre avec `statStages`/volatile suffit) — à confirmer.

---

## 6. Risques / points ouverts

1. **Migration e2e** : l'adaptateur DOIT couvrir 100 % des fixtures plats existants (sinon recette rouge). Test de non-régression obligatoire en Phase 1.
2. **`getLegalActions` + membre KO au spawn** (Phase 2) : peut exiger un petit fix core (`currentHp > 0`). À valider tôt — impacte le prérequis #4.
3. **Spawns > zones** : si une équipe a plus de membres que de `spawnZones` dans le format courant, définir un fallback (placement en cascade) ou capper selon la map.
4. **Mode `passive` scripté multi-membres** : `DummyAiController` gère 1 Pokémon ; l'étendre à N membres (un controller par membre, ou itération). Semantique « chaque membre joue son `defensiveMove` ».
5. ~~Profil IA exposé ?~~ **Tranché** : dropdown Joueur / Auto passif / Facile / Moyen / Difficile (§3). Les 3 profils scorés sont déterministes grâce au seed IA.
6. **Ampleur UI** : refonte non triviale de `SandboxPanel.ts` (état + rendu). Découpable, mais Phase 3 est le gros morceau.

---

## 6bis. Résolutions post-review (plan-reviewer, 2026-07-22)

1. **`dexNumber` custom (Phase 0)** : ajouter un champ optionnel `dexNumber?` à la struct des entrées custom (`playable-pokemon.ts`), renseigner `132` sur Ditto, et le propager dans la branche custom de `load-pokemon.ts:22-32`. (Champ réutilisable pour tout futur mon custom.)
2. **Membre KO au spawn (Phase 2)** : **spike à faire en premier dans la Phase 2** — instancier une battle avec 1er membre `hp:0` et observer si `TurnManager`/`ChargeTimeTurnSystem` l'exclut de la sélection du 1er acteur et passe au membre suivant. Fix core (garde `currentHp > 0` dans `getLegalActions`) seulement si le spike le prouve nécessaire.
3. **Spawns > zones (Phase 2)** : **fallback cascade** — les membres au-delà du nombre de `spawnZones` du format sont placés sur les tuiles marchables libres les plus proches de la dernière zone du camp ; `log()`/warn si débordement. Pas d'erreur dure. Équipes **hétérogènes autorisées** (1 vs 6 OK), cap 6.
4. **Mode `passive` multi-membres (Phase 2)** : **N instances** de `DummyAiController` (une par membre), routées par `pokemonId` actif dans `wireTurnReady`. On ne modifie pas `DummyAiController`.
5. **Déclencheurs de reload UI (Phase 3)** : on **conserve le comportement actuel** — tout changement de config (add/trash membre, dropdown contrôle, tout champ) → `emit()` → remount complet de la battle. Pas de bouton « Relancer » séparé.
6. **Granularité commits** : Phase 1 = schéma + adaptateur + **sites d'appel** (`babylon-boot`/`sandbox-boot`/`CombatScene`) dans **un seul commit** (les sites doivent compiler). Phase 2 wiring = commit séparé. Phases 2+3 dans **la même session** (elles se partagent `SandboxPanel.ts`/`combat-screen.ts` → éviter les conflits).
7. **Test de non-régression adaptateur (Phase 1)** : boucle sur **tous** les fixtures plats de `e2e/fixtures/sandbox-configs.ts` → `createSandboxBattle(normalizeSandboxConfig(fixture))` doit produire une battle valide sans throw.

**Découpe d'exécution affinée :**
- **Phase 3 (UI)** en sous-étapes : (a) refonte état `teams`/`readConfig`, (b) DOM accordéon équipe + dropdown contrôle, (c) pile membres repliables + résumé, (d) add/trash + garde-fous cap, (e) CSS. Validation visuelle humaine à la fin.
- **Phase 4 (e2e)** : 1 scénario = 1 unité (fixture + spec), livrables groupables mais listés (ring-out, faux-KO, self-KO/Vœu Soin, lock-in, priorité/timing, buff/statut, phazing, move-copy, stat manip). Croiser `docs/test-plan.md` §5.

## 7. Ordre d'exécution proposé

`Phase 0 (annexe picker) → Phase 1 (schéma + adaptateur + tests) → Phase 2 (wiring + fix core éventuel) → Phase 3 (UI) → Phase 4 (e2e)`.

Phases 0 et 1 committables indépendamment. Phase 2 validable en pilotant une config v2 « scored » à la main avant l'UI. Phase 3 = validation visuelle humaine. Phase 4 = recette.

---

## 8. Résultat (2026-07-22)

Livré dans son intégralité (Phases 0→4), commit WIP `024c770`.

- **Schéma `SandboxConfig` v2 par équipes** + `normalizeSandboxConfig` (adaptateur rétro-compat legacy plat) — voir décision #698.
- **Contrôle par équipe**, dropdown 5 niveaux (Joueur / Auto passif / Facile / Moyen / Difficile) : `passive` = `DummyAiController` scripté par membre, `scored` = `AiTeamController` seedé (profils `easy`/`medium`/`hard`) — décision #699. **Déblocage e2e du vrai scorer IA** (plans 159/160/161), résout l'item next.md correspondant.
- **UI studio** : accordéons Équipe 1 / Équipe 2, cartes membres repliables (une ouverte), add/trash (cap 6), allié KO au spawn possible (`hp:0`, pour tester Vœu Soin).
- **2 fixes moteur découverts en human-testing** (décision #700) : (A) membre KO au spawn non planifié dans le CT (`rerunBattleStartChecks`) ; (B) une action self-KO (Vœu Soin/Explosion/Souvenir) avance le tour immédiatement (`submitAction`) — corrige l'anomalie signalée au plan 159 (`getLegalActions` offrait encore des actions au « cadavre »).
- **RNG de création seedée** (`creationRng: createPrng(config.seed)` dans `createSandboxBattle`) — le sandbox est désormais 100 % déterministe à seed fixe, nature/genre inclus (décision #701).
- **Fix ordre picker Métamorph** (`dexNumber` custom, décision #702).

Le point ouvert §6.2 (« peut exiger un fix core ») s'est confirmé nécessaire : le spike Phase 2 a bien montré qu'un membre `hp:0` restait planifié sans le fix (A).
