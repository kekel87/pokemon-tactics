# Plan 174 — InfoPanel enrichi « tes Pokemon »

> **Statut** : draft
> **Créé** : 2026-07-24
> **Phase** : 6.5 Client jouable — Lot 3 (compléter l'UI), 1er chantier. Plan-cadre : `docs/plans/173`.

## But

Enrichir l'InfoPanel de combat pour les **Pokemon du joueur (alliés)** : afficher **types, stats (exactes + après crans), talent, nature** — en plus de l'existant (portrait, nom/genre/niveau, PV, objet, badges). Réf-cible d'affichage = le panneau Showdown.

**Périmètre strict** : côté **allié uniquement**. L'affichage ennemi (plages, gating talent/moves/objet, PV%, filtre de perspective) = **plan 176**. Ici on ne touche pas au rendu ennemi (reste minimal comme aujourd'hui). On introduit juste le **flag de perspective** qui permettra au 176 de brancher la branche ennemie.

Hors périmètre : dialog Status (repli, 173), preview combat (175), info terrain/auras (plans rendu), responsive/tactile (Lot 1).

## État actuel

- Vue : `packages/ui-dom/src/info-panel.ts` — rend `InfoPanelData`. Affiche portrait, nom/genre/niveau, barre PV (chiffres exacts), objet (icône+nom), badges. **Ni types, ni stats, ni talent, ni nature.**
- View-model : `packages/render-ports/src/view-models.ts` `InfoPanelData` (`name/level/gender?/hpCurrent/hpMax/team/portraitUrl?/badges/heldItem?/itemIconUrl?`).
- Adaptateur : `packages/view-core/src/battle-views.ts` `buildInfoPanelView(...)` (l.175) — construit le view-model depuis le core.
- Données core dispo : `getPokemonTypes(id)` (types effectifs), `effectiveCombatStats(...)` (stats après EV/nature), `PokemonInstance.statStages: Record<StatName, number>` (crans), `PokemonInstance.nature: Nature`, `effectiveAbilityId(pokemon)` (talent effectif).
- i18n : types FR = clés `pokemonType.<id>` (plan 164, `packages/app/src/i18n/locales/fr.ts`). Nature FR = déjà dans le Team Builder (dropdown 25 natures) → réutiliser la source. Stat names FR = **à vérifier/ajouter** (`statName.<id>`).

## Design (cf. 173)

InfoPanel allié, glanceable :
```
[portrait] Nom            ♂ Lv.50
           [PLANTE][COMBAT]              ← chips couleur (--type-*)
           ▓▓▓▓▓▓░░ 142 / 180           ← PV exacts (existant)
           🎒 Orbe Vie                   ← objet (existant)
           Talent: Cœur Noble · Prudent  ← talent + nature (nouveau)
           ┌ stats ────────────────┐
           │ Atq 120 ↑↑ → 180       │    ← base + crans + valeur après crans
           │ Déf  90                │
           │ …                      │
           └────────────────────────┘
           [statuts…]                    ← badges (existant)
```
- **Types** : chips colorées via tokens `--type-<id>`.
- **Stats** : 6 lignes (PV/Atq/Déf/Atq Spé/Déf Spé/Vit). Base exacte ; si cran ≠ 0 → flèches ↑/↓ (nombre de crans) **et** valeur après crans. PV : pas de cran (afficher la valeur).
- **Talent + Nature** : une ligne.
- On tente **tout dans le panneau** (décision 173). Si ça déborde sur mobile → on tranchera le repli dialog Status (hors 174).

## Implémentation

1. **`InfoPanelData` (render-ports)** — étendre :
   - `readonly isAlly: boolean` (perspective — permet au 176 de brancher l'ennemi ; ici seul `true` est enrichi).
   - `readonly types: readonly string[]` (ids de type, ex. `["grass","fighting"]` → tokens/i18n côté vue).
   - `readonly ability?: string` (nom localisé ; omis = non affiché).
   - `readonly nature?: string` (nom localisé).
   - `readonly stats?: readonly { label: string; value: number; stage: number; modified: number }[]` (omis côté ennemi en 174). **Pas de champ `key`** (ordre implicite du tableau) ; **PV hors de ce tableau** (déjà `hpCurrent/hpMax`). Le tableau = les **5 stats de combat** (Atq/Déf/Atq Spé/Déf Spé/Vit) dans cet ordre.
   > Pas de dep core dans render-ports → `label` est une **string déjà localisée** (résolue dans l'adaptateur view-core), `stage` = nombre de crans (−6..+6), `modified` = valeur après crans.
2. **Adaptateur `buildInfoPanelView` (view-core)** — pour un mon allié :
   - **types** : `getPokemonTypes` est une **méthode de `BattleEngine`** (a besoin de `pokemonTypesMap`, privé). L'adaptateur n'a que `(context, pokemon, state)` → **ajouter un accesseur `context.getPokemonTypes(definitionId): string[]`** (mirror de `context.getPortraitUrl`/`getAbilityName`, l.321/360/381) qui renvoie les types de base (data) ; l'adaptateur applique `pokemon.typeOverride` s'il est présent (Flamme Ultime/transform). Types = ids → chips côté vue (tokens `--type-<id>` + i18n `pokemonType.<id>`).
   - **ability** : `context.getAbilityName(effectiveAbilityId(pokemon))` (pattern déjà utilisé l.360).
   - **nature** : réutiliser les clés i18n **existantes** `teamBuilder.nature.<id>` (table `EditLeftPanel.ts`) ; idéalement les promouvoir en accesseur `context.getNatureName(nature)`.
   - **stats** : base via `effectiveCombatStats(...)` ; `stage` via `pokemon.statStages[stat]` ; **`modified = Math.floor(base × getStatMultiplier(stage))`** — `getStatMultiplier` est **exporté** de `packages/core/src/battle/stat-modifier.ts` (formule identique à celle utilisée par le core, l.20). Labels FR via i18n `statName.<id>` (**à vérifier/ajouter**).
   - Passer `isAlly: true`.
   - Pour un **ennemi** : `isAlly:false`, remplir `types` (public, OK) mais **omettre** `stats`/`ability`/`nature` (→ 176).
   - **Perspective (`isAlly`)** : défini par **l'appelant** (l'orchestrateur, `battle-orchestrator.ts`, qui appelle `updateInfoPanel`) — il connaît l'équipe du mon inspecté vs le joueur actif. Ne PAS s'appuyer sur `getGameState` (full-info ; vrai filtre = 176).
3. **Vue `info-panel.ts`** — rendre chips types (couleur token), bloc stats (flèches + valeur modifiée), ligne talent/nature. Tout conditionnel à la présence (ennemi omet → non rendu, panneau reste minimal).
4. **CSS** (`info-panel.css` / tokens) — chips types (fond `--type-<id>`), grille stats. **Flèches de crans : CSS à créer** (vérifié : pas de style `.stat-up/.stat-down` réutilisable en Phase 1 — l'ancien indicateur Phaser n'a pas de pendant DOM). Nouvelles classes `.ip-stat-buff` (vert ↑) / `.ip-stat-debuff` (rouge ↓), nombre de flèches = |stage|. Format ligne : `{label} {value}` si `stage==0`, sinon `{label} {value} {flèches} → {modified}`.
5. **i18n** — **ajouter `statName.<id>` FR+EN** (Atq/Déf/Atq Spé/Déf Spé/Vit, + PV pour le label PV) ; natures = clés `teamBuilder.nature.*` existantes (réutiliser ou promouvoir) ; types FR `pokemonType.<id>` déjà là.

## Tests

- **Unit** (view-core) : `buildInfoPanelView` sur un mon allié → `types`/`ability`/`nature`/`stats` remplis, crans reflétés dans `modified` ; sur un ennemi → stats/ability/nature omis, `isAlly:false`.
- **e2e DOM** (`test-writer`) : InfoPanel d'un allié affiche types + 6 stats + talent + nature ; un cran actif montre la flèche + valeur modifiée. Cahier `docs/test-plan.md` §7 (InfoPanel).

## Human-testing

- Survol/inspection d'un allié → panneau enrichi lisible (desktop). **Vérifier l'encombrement** (base du choix dialog-fallback).
- Un allié boosté (ex. Danse-Lames) → flèches + valeur après crans correctes.
- Ennemi → panneau inchangé (minimal), pas de fuite de stats (confirme le périmètre).

## Décisions

- **Valeur après crans = chiffre** (ex. `Atq 120 ↑↑ → 180`), pas seulement les flèches (décision humaine 2026-07-24).
- **174 = allié seulement** ; ennemi (plages/gating/PV%) = 176. Types ennemis publics affichables mais on garde le focus allié ici.
- Dialog Status = repli, hors 174.

## Gate

CI full (diff `packages/core` possible si helper cran extrait → e2e escalade auto).
