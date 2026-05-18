# Plan 085 — Team Builder UI (MyTeamsScene + TeamEditScene) — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-17
> Validé : 2026-05-17 (plan-reviewer + humain — décisions UI tranchées en amont)
> Terminé : 2026-05-17 — gate CI verte (build + lint + typecheck + 1496 unit + 189 intégration) + smoke test Playwright (MainMenu → MyTeams → generate random → édition Moltres → Showdown export)
> Polish terminé : 2026-05-18 — refonte CSS modulaire 12 fichiers + `<dialog>` natif + HTML sémantique + bugfix @layer + i18n noms FR Pokemon. Décisions #321-325.
> Inspiration : champteams.gg/builder (screenshots `docs/references/builder/`)

## Objectif

Livrer l'UI du Team Builder : sélection/édition complète d'équipes 6 Pokemon, persistance auto localStorage, import/export Showdown, list/delete/new, génération aléatoire, application d'OP sets curés.

Fondations core déjà livrées plan 081 (TeamSet, validateur, storage adapter, Showdown io, op-sets loader). Plan 085 = uniquement renderer + i18n + tests.

Référence visuelle : `docs/references/builder/` (8 screenshots champteams.gg : `empty.png`, `builder-1.png`, `builder-2-scrolled.png`, `builder-3-folded.png`, `pokemon-selection-filter.png`, `move-selection.png`, `item-selection.png`, `nature-selection.png`). On reprend layout **folded** (tout sur 1 écran) sans panneau "PKM vs Meta".

---

## Dépendances

- **Plan 081** — `TeamSet`, `TeamSlot`, `validateTeamSet`, `exportTeamToShowdown`, `importShowdownTeam`, `TeamStorage` (renderer), `TeamBuilderRegistry`, `resolveLearnset`.
- **Plan 082** — `packages/data/op-sets/op-sets.json` (160 sets curés, 1-3 par Pokemon roster).
- **Plan 083** — 9 items implémentés + hook `onStatLowered` + 2 moves giga-drain/focus-blast.
- **Phase 4** — roster 81 Pokemon Gen 1, 145 moves, 52 abilities, 21 items, météo.
- **Débloque** : plan 086 (refonte `TeamSelectScene` consomme équipes créées ici).

Helpers à vérifier au démarrage impl :
- `HeldItemHandlerRegistry.has(itemId)` ou helper équivalent `isItemImplemented(itemId)` — créer si absent (étape 38).
- Ordre 25 natures Champteams ligne 163 — extrait visuel `nature-selection.png`, valider vs Showdown canon avant codage.

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | Stack DOM : `scene.add.dom()` (Phaser DOM Elements) + HTML/CSS | Cohérent SandboxPanel, formulaires natifs, migration future Babylon facilitée |
| 2 | 2 scènes : `MyTeamsScene` (list) + `TeamEditScene` (builder) | Séparation clean, navigation simple |
| 3 | Save auto débounce 300 ms via `TeamStorage` | Pas de bouton Save, comportement Champteams |
| 4 | Pas de bouton Share, Coverage, Speed | Hors scope MVP |
| 5 | Modals : Pokemon picker, Move picker, Item picker, Showdown io, Delete confirm | Cohérent UX |
| 6 | Nature : dropdown inline (25 entrées, ordre champteams) | Pas besoin modal pour si peu d'options |
| 7 | Items non-implémentés : grisés + tag "Non implémenté" | Décidé méta-plan |
| 8 | Pokemon picker : grid portraits, filtres type + gen (Gen 1 only roster actuel mais préparer extension) | Scalable |
| 9 | Move picker : list filtres Phys/Spec/Stat + filtre type secondaire + tri puissance | Cohérent Champteams |
| 10 | SP presets 4 boutons + Reset | Voir tableau presets |
| 11 | Generate Random Team : pick 6 random + applique set OP 1 | MVP, smart generator → plan futur |
| 12 | Set OP par slot : dropdown 1-3 sets curés `op-sets.json` | Réutilise data plan 082 |
| 13 | Niveau fixe 50, IV fixe 31 (déjà tranché plan 081) | — |
| 14 | Default new team name = "Untitled Team" | Édit inline ensuite |
| 15 | Delete confirm = modal DOM `Delete <name>?` | Pas `confirm()` natif |

### Presets SP

| Preset | HP | Atk | Def | SpA | SpD | Spe |
|--------|----|----|----|----|----|----|
| Physical Sweeper | 2 | 32 | 0 | 0 | 0 | 32 |
| Special Sweeper | 2 | 0 | 0 | 32 | 0 | 32 |
| Tank Phys | 32 | 0 | 32 | 0 | 2 | 0 |
| Tank Spé | 32 | 0 | 2 | 0 | 32 | 0 |
| Reset | 0 | 0 | 0 | 0 | 0 | 0 |

Total = 66/66 sauf Reset.

---

## Architecture

### Arborescence

```
packages/renderer/src/
  scenes/
    MyTeamsScene.ts          ← nouvelle
    TeamEditScene.ts         ← nouvelle
  ui/team/                   ← nouveau dossier
    TeamSlotCard.ts          ← carte slot 6
    TeamEditPanel.ts         ← container colonne gauche (édition)
    TeamStatsPanel.ts        ← container colonne droite (stats + SP)
    SpSlider.ts              ← slider 1 stat
    StatBar.ts               ← barre 1 stat
    NatureDropdown.ts        ← dropdown 25 natures
    PokemonPickerModal.ts    ← modal Pokemon
    MovePickerModal.ts       ← modal Move
    ItemPickerModal.ts       ← modal Item
    ShowdownIoModal.ts       ← modal Import/Export Showdown
    DeleteConfirmModal.ts    ← modal Delete confirm
    AbilityRadioGroup.ts     ← radio Abilities (1 ou 2)
    TeamCard.ts              ← carte team dans MyTeams
  ui/dom/                    ← nouveau dossier (composants DOM réutilisables)
    Modal.ts                 ← base modal (overlay + close + esc)
    Dropdown.ts              ← base dropdown
  team/
    team-generator.ts        ← generateRandomTeam(rng, registry)
```

### Flow navigation

```
MainMenuScene
  └─ [Team Builder] → MyTeamsScene
        ├─ list teams
        ├─ [+ New Team]            → TeamEditScene (team vide "Untitled Team")
        ├─ [Generate Random]       → TeamEditScene (team générée)
        ├─ row click / [Edit]      → TeamEditScene (team loaded)
        └─ [Delete]                → DeleteConfirmModal → TeamStorage.delete

TeamEditScene
  ├─ slot click vide      → PokemonPickerModal → save slot
  ├─ slot click rempli    → set active edit
  ├─ [×] slot             → clear slot
  ├─ click move           → MovePickerModal
  ├─ click item           → ItemPickerModal
  ├─ change nature        → NatureDropdown
  ├─ change ability       → AbilityRadioGroup
  ├─ drag SP slider       → update statSpread
  ├─ preset click         → applique preset SP
  ├─ [Showdown]           → ShowdownIoModal
  ├─ [Set OP] (par slot)  → dropdown 1-3 sets, applique slot complet
  ├─ name input           → update name + debounce save
  ├─ [Clear All]          → confirm modal → reset slots
  └─ [← My Teams]         → MyTeamsScene
```

### Save auto

`TeamEditScene` maintient ref `currentTeam: TeamSet`. À chaque mutation :
1. Update `currentTeam` immédiat (rendu sync)
2. Schedule `saveDebounced(currentTeam)` (300 ms)
3. `saveDebounced` → `TeamStorage.save(team)` → flag visuel "Saved" briève (1 s, top-right discret)

Si scène ferme avant timer : flush immédiat (`scene.events.on("shutdown", flushSave)`).

### Implementation flags items

Reuse `isItemImplemented(itemId)` du registre `HeldItemHandlerRegistry`. Items grisés dans `ItemPickerModal` avec tag. Sélectionnables quand même (utile preview équipe future), warning soft sur slot.

---

## Tâches (ordre exécution)

### Phase 1 — composants DOM base

- [ ] 1. `ui/dom/Modal.ts` — base overlay + backdrop + esc + close button + slot content. Tests unit (open/close/esc).
- [ ] 2. `ui/dom/Dropdown.ts` — base dropdown native `<select>` stylé. Tests unit (change event).
- [x] 3. CSS modulaire `packages/renderer/src/styles/` — `index.css` (entry @layer) + `tokens.css` + 10 composants. `team-builder.css` monolithique supprimé (polish 2026-05-18 — décisions #321-325).
- [ ] 4. i18n FR/EN setup : nouvelles clés sous `team.*` et `teamBuilder.*` (placeholder dans `en.ts`/`fr.ts`).

### Phase 2 — MyTeamsScene

- [ ] 5. `MyTeamsScene.ts` — création scene, registre Phaser, lifecycle (preload/create/shutdown).
- [ ] 6. `ui/team/TeamCard.ts` — rendu une team (name, 6 portraits, date modif, boutons Edit/Delete/Showdown).
- [ ] 7. Liste teams chargée via `TeamStorage.listSummaries()`.
- [ ] 8. Empty state : "No teams yet" + [+ New Team] + [Generate Random].
- [ ] 9. Bouton "+ New Team" → `TeamStorage.create()` + scene start `TeamEditScene` avec teamId.
- [ ] 10. Bouton "Generate Random" → `team-generator.generateRandomTeam(rng)` → `TeamStorage.save` → scene start `TeamEditScene`.
- [ ] 11. `DeleteConfirmModal` câblé → `TeamStorage.delete(id)` + refresh.
- [ ] 12. Bouton Showdown raccourci (export read-only) → `ShowdownIoModal` mode export.
- [ ] 13. Tests visual-tester : empty state, list 3 teams, delete confirm.

### Phase 3 — TeamEditScene squelette

- [ ] 14. `TeamEditScene.ts` — création scene, init avec teamId param, load `TeamStorage.load(id)`.
- [ ] 15. TopBar : team name input, count `N/6`, bouton Showdown, bouton Clear All, bouton "← My Teams".
- [ ] 16. `TeamSlotCard.ts` x6 row haut. États : vide (+), rempli (sprite + name + types badges + [×]), active (highlight orange).
- [ ] 17. Click slot vide → `PokemonPickerModal`.
- [ ] 18. Click slot rempli → set active + render édition.
- [ ] 19. Active slot persisté en state local scene (pas dans `TeamSet`).
- [ ] 20. Auto-save débounce 300 ms.
- [ ] 21. Tests visual-tester : team 1 slot rempli, switch active slot, clear slot.

### Phase 4 — Édition colonne gauche

- [ ] 22. `TeamEditPanel.ts` — container colonne gauche.
- [ ] 23. Portrait + nom + badges types + Lv.50 (read-only).
- [ ] 24. `AbilityRadioGroup.ts` — abilities du Pokemon (1 ou 2 selon data, prendre `abilityId` + `hiddenAbilityId?` du reference).
- [ ] 25. Item input clickable → `ItemPickerModal`.
- [ ] 26. `NatureDropdown.ts` — 25 natures, ordre Champteams (Adamant, Jolly, Modest, Timid, Brave, Quiet, Bold, Impish, Calm, Careful, Relaxed, Sassy, Hasty, Naive, Serious, Hardy, Docile, Bashful, Quirky, Lonely, Mild, Rash, Gentle, Naughty, Lax). Source : `nature-selection.png`, valider vs Showdown canon avant codage.
- [ ] 27. 4 lignes moves clickables → `MovePickerModal` (indexée 0-3).
- [ ] 28. Bouton "Set OP" dropdown 1-3 sets → applique slot complet (move/item/ability/nature/SP).

### Phase 5 — Édition colonne droite (stats + SP)

- [ ] 29. `TeamStatsPanel.ts` — container colonne droite.
- [ ] 30. `StatBar.ts` x6 — barre + value (computed via `computeCombatStats(baseStats, 50, nature) + applyStatPoints(stats, sp)`).
- [ ] 31. `SpSlider.ts` x6 — slider 0-32 + value + bouton [D] reset stat.
- [ ] 32. Compteur total `X/66`.
- [ ] 33. 5 boutons presets (Phys Sweeper, Spec Sweeper, Tank Phys, Tank Spé, Reset).
- [ ] 34. Validation live : si total > 66 → blocage slider + tooltip "Max 66 SP".
- [ ] 35. Auto-save trigger après chaque slider change.

### Phase 6 — Modals pickers

- [ ] 36. `PokemonPickerModal.ts` — grid portraits 81 Pokemon, search input, filtres types (18), filtre Gen (Gen 1 only pour l'instant). Scroll vertical. Lazy-load si > 3 écrans scroll.
- [ ] 37. `MovePickerModal.ts` — list moves accessibles via `resolveLearnset(pokemonId)` (plan 081), search, filtres Phys/Spec/Stat + filtre type, tri par puissance/accuracy/name.
- [ ] 38. `ItemPickerModal.ts` — list items implementés + non-impl grisés + catégories (Offensive, Defensive, Berries, Other). Helper `isItemImplemented(itemId)` — créer dans `HeldItemHandlerRegistry` si absent.
- [ ] 39. Tests visual-tester : ouverture chaque modal, sélection, fermeture.

### Phase 7 — Showdown io

- [ ] 40. `ShowdownIoModal.ts` — 2 onglets : Import / Export.
- [ ] 41. Import : textarea + bouton "Parse" → `parseShowdownTeam(text)` → load dans current team.
- [ ] 42. Erreurs parse affichées slot par slot (utilise `TeamValidationResult` existant).
- [ ] 43. Export : textarea read-only auto-rempli via `exportTeamToShowdown(currentTeam)`, bouton "Copy" clipboard.

### Phase 8 — Generator + intégration

- [ ] 44. `team-generator.ts` — `generateRandomTeam(rng, registry): TeamSet`. Pick 6 mons random parmi roster jouable + applique op-set 1 (fallback custom set si manquant).
- [ ] 45. Bouton "Generate Random" câblé MyTeams uniquement (MVP).
- [ ] 46. Nom team générée : `Random Team #N` (incrément).

### Phase 9 — Polish + i18n + tests

- [ ] 47. Toutes clés i18n FR/EN remplies (~50 clés `team.*`).
- [ ] 48. CSS responsive (cibler 1280x720 mini, scrollable au besoin).
- [ ] 49. Tests visual-tester suite complète (MyTeams, TeamEdit, modals).
- [ ] 50. Audit accessibilité : tab navigation, esc close modals, enter validate.
- [ ] 51. Gate CI verte (lint + typecheck + build + test + test:integration).

---

## Tests

### Unit (Vitest + JSDOM)

- `Modal.test.ts` — open/close/esc/backdrop click.
- `Dropdown.test.ts` — change emits value.
- `SpSlider.test.ts` — drag, value clamp 0-32, total clamp 66.
- `NatureDropdown.test.ts` — 25 entrées, ordre, sélection.
- `team-generator.test.ts` — `generateRandomTeam(rng)` déterministe, 6 slots remplis, IDs uniques.

### Intégration (Vitest)

- `TeamEditScene.integration.test.ts` — load team / edit slot / save débounce / reload garde état.
- `team-generator.integration.test.ts` — generate + valide via `validateTeamSet`.

### Visual-tester (Playwright)

- MyTeams empty state.
- MyTeams list 3 teams.
- Delete confirm flow.
- TeamEdit empty → fill slot 1 → switch slot 2 → fill → save indicator.
- Modal Pokemon picker open/filter/select.
- Modal Move picker open/filter/select.
- Modal Item picker open/grisé/select.
- Showdown export (copy fonctionne).
- Showdown import OK + erreur affichée.
- Generate random produit team complète.

---

## Risques

| Risque | Mitigation |
|---|---|
| Phaser DOM intégration lourde (z-index, focus) | Cohérent SandboxPanel existant. Réutiliser pattern. |
| Performance grid 81 portraits | Sprites déjà en cache (`SpriteLoader`), lazy si besoin. |
| Conflits CSS global vs scope scene | CSS modules ou préfixe `tb-*` strict. |
| Tests JSDOM ne couvrent pas Phaser scene lifecycle | Couvrir via visual-tester + composants DOM isolés. |
| Auto-save spammy si user drag slider rapide | Débounce 300 ms validé. |
| Items non-implémentés selectables vs validateur fail | Warning soft slot, pas error bloquant. |

---

## Suite directe (débloqué par celui-ci)

- **Plan 086** — Refonte `TeamSelectScene` : équipes saved + Aléatoire + Nouvelle, phase placement = sous-pick N mons selon format.

## Hors scope (à planifier après)

- **Smart team generator** (plan ultérieur) : synergies types, rôles équilibrés, weather core, coverage. MVP = random.
- **Share via URL** — Phase X (X/Social).
- **Coverage panel** — analyse types couvertes par moveset combiné équipe.
- **Speed tier panel** — comparaison vitesse vs meta.
- **Refactor `roster-poc.ts` → `playable-pokemon.ts`** — décidé méta-plan, post-086.
- **Affichage nature InfoPanel** — refonte InfoPanel globale (plan 072 étapes 4-5 reportées).
- **Multi-team format** — actuellement 1 team générique 6 mons. Multi-format spécifique = futur.
- **Touches clavier avancées** — raccourcis 1-6 slots, ctrl+s save manuel, etc.

---

## Décisions à logger (post-impl)

- Numérotation à attribuer par `doc-keeper` (#316+).
- Sujets : stack DOM Phaser, modals pattern, débounce save 300 ms, SP presets contenu, generator random MVP, layout 2 colonnes folded, Champteams nature order.

---

## Gate CI

`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration` verts avant commit.

## Suite

Plan 086 — refonte `TeamSelectScene` (utilise teams créées plan 085).
