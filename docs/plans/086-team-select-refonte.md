# Plan 086 — Refonte `TeamSelectScene` + sous-pick au placement — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-18
> Réécrit : 2026-05-19 (recadrage UX après échanges humain — sous-pick déplacé au placement)
> Démarré : 2026-05-19 (validation humain : "fait tout le plan")
> Terminé : 2026-05-19 (Phases 0-7 exécutées, gate CI verte)
> Auteur : Claude
> Dépend de : plans 081 (TeamSet + validateur + storage), 085 (Team Builder UI + generator).
> Débloque : post-086 refactor `roster-poc.ts` → `playable-pokemon.ts`.

## Objectif

Remplacer `TeamSelectScene` sandbox-style (sélection libre Pokemon depuis roster complet) par une scène qui :
1. Liste les équipes sauvegardées (sortie plan 085) + 1 ligne "Aléatoire" (équipe ephémère).
2. Permet à chaque joueur (hot-seat) d'assigner une équipe complète (6 mons).
3. Délègue le sous-pick (joueur prend 1..N mons selon format) à la **phase placement** existante (PlacementPhase) — qui est étendue pour accepter une équipe pleine et autoriser un sous-ensemble placé.

Cette refonte rétablit la cohérence Team Builder ↔ combat : on joue ce qu'on a construit. L'ancien flow reste en sandbox (`SandboxPanel`, inchangé).

---

## Périmètre

**Inclus** :
- Refonte complète `packages/renderer/src/scenes/TeamSelectScene.ts`.
- Extension `PlacementPhase` core : accepte équipe complète (6), valide placement 1..maxPokemon.
- Extension `PlacementRosterPanel` renderer : affiche 6 mons, autorise sous-pick implicite via placement.
- Extension `PlacementMode.Random` : prend N premiers slots du roster équipe (auto sous-pick).
- i18n FR/EN clés `teamSelect.*` étendues + `placement.*` ajustées.

**Exclus** :
- Édition / création d'équipe depuis TeamSelectScene (lance `TeamEditScene` interdit ici).
- Smart AI sub-pick (scoring BST) — laissé pour plan IA Hard futur (noté décision 9).
- Smart team generator (random simple suffit MVP).
- Mode sandbox — inchangé.
- Roster `roster-poc.ts` refactor (post-086).

---

## Dépendances

- **Plan 081** — `TeamSet`, `TeamSlot`, `validateTeamSet`, `TeamStorage`, `TeamBuilderRegistry`.
- **Plan 085** — `team-generator.ts` (`generateRandomTeam`), `MyTeamsScene`, `TeamCard` (composant réutilisable).
- **Données map** — `MapDefinition.formats` (Tiled), chaque format porte `{ teamCount, maxPokemonPerTeam }`.
- **Core** — `TeamSelection`, `PlacementPhase`, `PlacementTeam`, `PlacementMode`.

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | Réécrire `TeamSelectScene.ts` (pas créer nouvelle scène) | Point d'entrée stable depuis `MapSelectScene` |
| 2 | Stack : Phaser DOM Elements (cohérence plan 085) | Listes/dropdowns natifs, CSS modulaire |
| 3 | Layout : liste verticale équipes au centre, colonnes joueurs sur les côtés (≤6 → 1 colonne gauche; 6+ → 6 gauche / 6 droite) | Cohérent pattern actuel, hot-seat lisible |
| 4 | Sélecteur format : dropdown clé composite `${teamCount}v${maxPokemonPerTeam}` (ex: `2v6`, `3v4`). Default = premier déclaré dans `map.formats` | Évite collisions, label clair |
| 5 | Joueur actif : cellule highlight (◀ ou ▶ + bordure couleur équipe). Click cellule autre joueur → switch actif | Permet retour joueur précédent |
| 6 | Click équipe centrale → assignée joueur actif, active passe au suivant (ordre 1→N) | Flow hot-seat fluide |
| 7 | Toggle Humain/IA par joueur | Inchangé |
| 8 | **AI default = équipe Aléatoire** ephémère (re-roll à création colonne) | UX zéro-friction (humain configure que les humains) |
| 9 | AI sub-pick au placement = N premières positions équipe (placement auto random) | MVP — scoring smart → plan IA Hard futur |
| 10 | Bouton "Remplir IA aléatoire" : re-roll toutes colonnes IA d'un coup | Pattern actuel conservé |
| 11 | Ligne "Aléatoire" toujours en bas liste centrale : clic = génère équipe ephémère pour joueur actif | Quick path solo |
| 12 | Mirror autorisé : même équipe pickée par plusieurs joueurs (badges `[J1][J5]` sur ligne) | Convention Pokemon |
| 13 | Pas de bouton édition/création depuis cette scène | Édition = menu principal → Constructeur d'équipe |
| 14 | Persistance dernier teamId par slot dans `localStorage` (clé `pt:team-select:last-v1`) | Confort retour scène |
| 15 | Hot-seat **open team** : portraits adverses visibles | Joueurs même pièce, info partagée |
| 16 | Sous-pick = **phase placement**, pas TeamSelect | Cohérent vision humain |
| 17 | Sous-pick **flexible** : joueur peut placer 1..maxPokemon (pas strict N) | Handicap volontaire OK |
| 18 | Auto-placement : prend N premiers slots équipe, place via `PlacementMode.Random` | Compat existant |
| 19 | Si équipe a < N slots remplis (équipe incomplète saved), placement utilise ce qui existe (min 1) | Tolérant |
| 20 | Format change → reset assignments joueurs (cohérence — équipe valide quel que soit format) | Sécurité UX |
| 21 | Équipe obsolète (mon/move retiré entre sessions) : warning UI + skip slots invalides à placement | Tolérant |

---

## Mockup ASCII (référence visuelle)

### Format 2v6 — 2 joueurs

```
┌────────────────────────────────────────────────────────────────────────┐
│ Sélection d'équipe — Arène Simple    Format : [ 2v6 ▼ ]    ◀ retour    │
├──────────┬───────────────────────────────────────────────┬─────────────┤
│ ▶ J1 ●   │ Équipes sauvegardées (3)                      │   J2 ●      │
│ bleu     │                                               │   rouge     │
│ [H|IA]   │ ┌─────────────────────────────────────────┐  │   [H|IA✓]   │
│ Champions│ │ Champions  🐉🔥⚡🌿💧👻   [J1]           │  │   Aléatoire │
│          │ └─────────────────────────────────────────┘  │   🪨🦋🐦🐍🦎🐢│
│          │ ┌─────────────────────────────────────────┐  │             │
│          │ │ Stall      🛡️💤🐢🌿🦴🐍                  │  │             │
│          │ └─────────────────────────────────────────┘  │             │
│          │ ┌─────────────────────────────────────────┐  │             │
│          │ │ Trick Room 🌀🌟🔮👁️🦊🐺                  │  │             │
│          │ └─────────────────────────────────────────┘  │             │
│          │ ┌─────────────────────────────────────────┐  │             │
│          │ │ 🎲 Aléatoire  (1 par clic, non sauvée)  │  │             │
│          │ └─────────────────────────────────────────┘  │             │
├──────────┴───────────────────────────────────────────────┴─────────────┤
│  [✓] Placement auto    Tours : [CT ▼]   [🎲 Remplir IA]  [Lancer ▶]    │
└────────────────────────────────────────────────────────────────────────┘
```

### Format 12v1 — 12 joueurs (colonnes 6 gauche / 6 droite)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Sélection d'équipe — Arène 12v1   Format : [12v1 ▼]   ◀ retour         │
├──────────┬───────────────────────────────────────────────┬─────────────┤
│ ▶ J1 ●   │ Équipes sauvegardées (3)                      │   J7 ●      │
│ bleu     │                                               │   pêche     │
│ [H|IA]   │ ┌─────────────────────────────────────────┐  │   [H|IA✓]   │
│ Champions│ │ Champions  🐉🔥⚡🌿💧👻  [J1][J5]        │  │   Aléatoire │
│──────────│ └─────────────────────────────────────────┘  │─────────────│
│   J2 ●   │ ┌─────────────────────────────────────────┐  │   J8 ●      │
│ rouge    │ │ Stall      🛡️💤🐢🌿🦴🐍   [J7]           │  │   marron    │
│ [H|IA✓]  │ └─────────────────────────────────────────┘  │   [H|IA✓]   │
│ Aléatoire│ ┌─────────────────────────────────────────┐  │   Aléatoire │
│──────────│ │ Trick Room 🌀🌟🔮👁️🦊🐺   [J3]           │  │─────────────│
│   J3 ●   │ └─────────────────────────────────────────┘  │   J9 ●      │
│ vert     │                                               │   gris      │
│ [H|IA✓]  │ ┌─────────────────────────────────────────┐  │   [H|IA✓]   │
│ Trick R. │ │ 🎲 Aléatoire (1 par clic)               │  │   Aléatoire │
│──────────│ └─────────────────────────────────────────┘  │─────────────│
│   J4-J6  │                                               │   J10-J12   │
│ ...      │                                               │   ...       │
├──────────┴───────────────────────────────────────────────┴─────────────┤
│  [✓] Placement auto   Tours : [CT ▼]   [🎲 Remplir IA]   [Lancer ▶]    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Arborescence

```
packages/renderer/src/
  scenes/
    TeamSelectScene.ts          ← réécrit
  ui/team-select/                ← nouveau dossier
    FormatPicker.ts              ← dropdown format
    TeamListItem.ts              ← 1 ligne équipe centrale (nom + portraits + badges)
    TeamList.ts                  ← container liste verticale
    PlayerCell.ts                ← cellule joueur (latérale)
    PlayersColumn.ts             ← container colonne joueurs (gauche ou droite)
  styles/
    team-select.css              ← layout flexbox 3 col
  team/
    last-selection.ts            ← persistance teamId par slot
    refresh-ai-teams.ts          ← re-roll équipes IA bulk

packages/core/src/
  battle/
    PlacementPhase.ts            ← extension : équipe complète + sous-pick implicite
  types/
    placement-team.ts            ← `availablePokemonIds` (6) + `placedPokemonIds` (1..N)
```

### Types renderer

```ts
interface PlayerSlotState {
  controller: PlayerController;       // Human | Ai
  assignedTeam: TeamSet | null;       // saved (référencé par teamId) ou ephemère (random)
  assignedTeamId: string | null;      // null si ephemère
  ready: boolean;                     // assignedTeam !== null
}

interface TeamSelectResult { // élargi
  teams: TeamSelection[];             // équipes complètes 6 (par player)
  autoPlacement: boolean;
  turnSystemKind: TurnSystemKind;
  mapUrl: string;
  formatKey: string;                  // "2v6", "3v4", etc.
}
```

### Types core (extension)

```ts
// packages/core/src/types/placement-team.ts
interface PlacementTeam {
  playerId: PlayerId;
  controller: PlayerController;
  availablePokemonIds: readonly string[];  // 6 mons disponibles
  placedPokemonIds: string[];              // 1..maxPokemonPerTeam, ordre placement
}
```

`PlacementPhase` :
- Validation : `placedPokemonIds.length >= 1 && <= format.maxPokemonPerTeam`.
- `tryPlace(playerId, pokemonId, position)` : ajoute à `placedPokemonIds` si pas déjà placé.
- `tryUnplace(playerId, pokemonId)` : retire de `placedPokemonIds`.
- `autoPlaceAll(center)` : prend `availablePokemonIds.slice(0, maxPokemonPerTeam)` et place via stratégie existante.
- `isComplete()` : tous joueurs ont `placedPokemonIds.length >= 1`.

---

## Étapes

### Phase 0 — Pré-requis API

0a. Vérifier `TeamBuilderRegistry.buildInstance(slot, playerId, position): PokemonInstance` existe dans `@pokemon-tactic/data`. Si absent : créer (réutilise `createPokemonInstance` core + nature/SP/ability/heldItem du slot).

0b. Vérifier signature `PlacementPhase` actuelle, lister call sites. Préparer extension (étape 8).

### Phase 1 — Core : extension `PlacementPhase` (sous-pick implicite)

1. Étendre `PlacementTeam` (`packages/core/src/types/placement-team.ts`) :
   - Renommer `pokemonIds` → `availablePokemonIds` (6 mons disponibles).
   - Ajouter `placedPokemonIds: string[]` (mutable, ordre placement).
2. Étendre `PlacementPhase` :
   - `tryPlace(playerId, pokemonId, position)` : exige `pokemonId ∈ availablePokemonIds` ET `pokemonId ∉ placedPokemonIds`, ajoute à `placedPokemonIds`.
   - `tryUnplace(playerId, pokemonId)` : retire `pokemonId` de `placedPokemonIds`, libère tile.
   - `autoPlaceAll(center)` : prend `availablePokemonIds.slice(0, format.maxPokemonPerTeam)` au lieu de `pokemonIds` (compat).
   - `isComplete()` : `placedPokemonIds.length >= 1 && <= maxPokemonPerTeam` pour chaque équipe.
3. Adapter `BattleSetup` pour ne créer `PokemonInstance` que pour `placedPokemonIds` (pas tout `availablePokemonIds`).
4. Tests core : étendre `PlacementPhase.test.ts` + `PlacementPhase.integration.test.ts`.
   - Cas : place 1/6, 3/6, 6/6, max+1 rejet, unplace, mirror IDs entre équipes (préfixage `pX-` conservé).

### Phase 2 — Renderer : composants UI

5. `team/last-selection.ts` : `loadLastSelection(): Record<number, string>`, `saveLastSelection(slot, teamId)`. Clé `pt:team-select:last-v1`.
6. `team/refresh-ai-teams.ts` : bulk `generateRandomTeam()` pour toutes colonnes IA + reset assignments humains intacts.
7. `ui/team-select/FormatPicker.ts` (DOM) : dropdown formats map. Event `onChange(formatKey)`.
8. `ui/team-select/TeamListItem.ts` (DOM) : ligne équipe — nom à gauche, 6 portraits centre, badges joueurs `[J1][J5]` droite. Click → emit `onPick(teamId|null)` (null = ligne Aléatoire).
9. `ui/team-select/TeamList.ts` : container vertical scroll. Liste équipes saved + ligne Aléatoire fixe en bas.
10. `ui/team-select/PlayerCell.ts` (DOM) : cellule joueur — `J_N ● couleur` + toggle `[H|IA]` + nom équipe assignée (ou `— choisir`). Highlight si actif. Click → emit `onActivate(slotIndex)`.
11. `ui/team-select/PlayersColumn.ts` : container N cellules joueur (vertical). Props : `slotIndices: number[]`.

### Phase 3 — Scène

12. Réécrire `TeamSelectScene.ts` :
    - `init(data: { mapUrl })`
    - `create()` : fetch map JSON → parser formats → state default (formatKey = premier, slots = N selon `teamCount`).
    - Layout flexbox 3 colonnes (DOM container) : gauche (PlayersColumn 0..N/2), centre (TeamList), droite (PlayersColumn N/2..N).
    - Si N ≤ 6 : tous joueurs colonne gauche, droite cachée.
    - Header DOM : titre + FormatPicker + bouton retour.
    - Footer DOM : toggle auto-placement + dropdown turn system + bouton "Remplir IA aléatoire" + bouton "Lancer ▶".
13. Gestion état :
    - State central `PlayerSlotState[]`, `activeSlotIndex`, `formatKey`.
    - `setActive(slot)` : update highlight + scroll TeamList visible.
    - `assignTeam(slot, teamId | null)` : si `null` → `generateRandomTeam()`. Avance `activeSlotIndex` si pas dernier.
    - `toggleController(slot)` : si → AI, auto-assign random ephemère; si → Human, garde assignment actuel.
    - `refreshAllAi()` : bulk re-roll équipes IA.
    - `changeFormat(key)` : reset assignments + slots recréés selon nouveau `teamCount`.
14. `validateLaunchable()` : tous slots ont `assignedTeam !== null`. Retourne reason ou null.
15. `assembleResult()` : pour chaque slot, build `TeamSelection` = équipe complète 6 mons + `playerId` + `controller` + `formatKey`. Pass à `BattleScene`.

### Phase 4 — Câblage placement (renderer)

16. `BattleScene.startPlacementPhase` : adapter pour passer `availablePokemonIds = 6` (au lieu N filtrés) à `PlacementPhase`.
17. `PlacementRosterPanel` : afficher 6 mons (pas N), placés en grisé/retiré du roster pickable, clic place sur tile sélectionnée. Bouton "Terminer" actif si `placedCount >= 1`.
18. Auto-placement (`PlacementMode.Random` path) : prend N premiers `availablePokemonIds`, place sur tiles spawn aléatoires. AI auto-fill idem.

### Phase 5 — Style + i18n

19. `styles/team-select.css` : layout 3 col flex, listes scrollables, cellules joueur compactes, tokens design `--color-team-*`, `--space-*`, `--font-pokemon`.
20. i18n FR/EN `teamSelect.*` étendu :
    - `title`, `format.label`, `format.${key}` (`2v6` = "2v6 (6/équipe)" etc.)
    - `players.title`, `players.choose` (`— choisir`)
    - `controller.human`, `controller.ai`
    - `teams.empty.title` (`Aucune équipe`), `teams.empty.cta` (`Crée une équipe depuis le menu principal`)
    - `teams.random` (`🎲 Aléatoire`)
    - `actions.refreshAi` (`Remplir IA aléatoire`)
    - `actions.launch`, `actions.back`
    - `autoPlacement.label`, `turnSystem.label`
    - `warn.outdated` (équipe contient données obsolètes)
    - `launch.disabled.allTeamsRequired`
    - `subpick.title` (placement) — `Place tes Pokemon (1 à {max})`

### Phase 6 — Tests + validation

21. Tests unitaires (core) :
    - `PlacementPhase.test.ts` : sous-pick 1/6, 3/6, 6/6, rejet > max, unplace, mirror IDs.
22. Tests unitaires (renderer) :
    - `last-selection.test.ts` : load/save/clear.
    - `refresh-ai-teams.test.ts` : reset IA only, humains intacts.
23. Tests intégration :
    - `placement.integration.test.ts` étendu : équipe 6, sous-pick 3, vérifie BattleEngine reçoit 3 instances (pas 6).
24. Smoke Playwright (`visual-tester`) :
    - MainMenu → BattleMode → MapSelect (simple-arena) → TeamSelect.
    - Format 2v6 : 2 colonnes joueurs gauche, équipe `Champions` au centre, J1 actif.
    - J1 clique `Champions` → badge `[J1]`, active passe à J2.
    - J2 = IA par défaut, équipe Aléatoire déjà assignée.
    - Toggle J2 → Humain, clique `Stall` → badge `[J2]`.
    - Bouton "Lancer" → PlacementScene avec 6 mons par joueur, sous-pick 3 puis "Terminer" → combat 3v3.
    - Test format 3v4 : 3 colonnes, validation.
25. Gate CI : `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

### Phase 7 — Documentation

26. `STATUS.md` : section plan 086.
27. `docs/next.md` : déplace 086 dans "Fait récemment", propose post-086 (refactor `roster-poc.ts`).
28. `docs/decisions.md` : décisions 17-21 (sous-pick flexible, hot-seat open, AI default random, etc.).
29. `docs/plans/README.md` : statut `done`.
30. `docs/game-design.md` : section "Sous-pick au placement" (mécanique tactique avant combat).

---

## Risques

| Risque | Mitigation |
|---|---|
| `TeamBuilderRegistry.buildInstance` absent | Vérif Phase 0a, créer si manquant |
| `PlacementPhase` API breaking change | Renommer `pokemonIds` → `availablePokemonIds` + adaptation call sites en 1 commit |
| 12 joueurs colonnes overflow vertical | Test responsive Phase 6 step 24 + scroll si > viewport |
| Édition équipe inaccessible depuis TeamSelect (UX flow) | Documenter "Crée/modifie depuis menu principal → Constructeur d'équipe" + lien empty state |
| Équipe obsolète (mon retiré) plante placement | Try/catch par slot dans `BattleSetup` + warning UI, skip silencieux |
| Mirror équipe (2 joueurs même teamId) plante validation core | Préfixage `p${index}-${defId}` existant gère collision IDs |

---

## Validation

- [x] Plan-reviewer relu 2026-05-18 (verdict READY 1re version).
- [x] Game-designer relu 2026-05-18 (sous-pick validé).
- [x] Humain recadré 2026-05-19 : layout central liste verticale + sous-pick au placement + AI default random + bouton remplir IA.
- [ ] Plan-reviewer relu V2 (post-recadrage core PlacementPhase extension).
- [ ] Humain valide statut → `ready`.
