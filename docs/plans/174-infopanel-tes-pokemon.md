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
   - `readonly stats?: readonly { key: StatName-string; label: string; value: number; stage: number; modified: number }[]` (omis côté ennemi en 174).
   > `StatName` est un enum core — côté render-ports (pas de dep core) on passe des **strings** déjà résolues. Le label localisé est calculé dans l'adaptateur view-core.
2. **Adaptateur `buildInfoPanelView` (view-core)** — pour un mon allié : remplir `types` (`getPokemonTypes`), `ability` (`effectiveAbilityId` → nom FR), `nature` (→ nom FR), `stats` (`effectiveCombatStats` pour la base + `statStages` pour les crans + calcul `modified` = base × multiplicateur de cran). Passer `isAlly`. Pour un ennemi : `isAlly:false`, laisser `types` (public, OK à montrer) mais **omettre** stats/ability/nature (→ 176). *(Types ennemis publics = OK dès maintenant ; le reste attend 176.)*
   - **Perspective** : l'appelant (orchestrateur) sait quelle équipe possède le mon inspecté vs le joueur actif → passe `isAlly`. (Ne PAS s'appuyer sur `getGameState` qui est full-info ; le vrai filtre = 176.)
   - Multiplicateur de cran : réutiliser la table core existante (crans → ×) ; si pas exposée hors damage-calc, extraire un helper pur partagé.
3. **Vue `info-panel.ts`** — rendre chips types (couleur token), bloc stats (flèches + valeur modifiée), ligne talent/nature. Tout conditionnel à la présence (ennemi omet → non rendu, panneau reste minimal).
4. **CSS** (`info-panel.css` / tokens) — chips types (fond `--type-<id>`), grille stats, style flèches ↑↓ (réutiliser les indicateurs de crans existants s'il y en a — cf. roadmap Phase 1 « stat change indicators flèches ↑↓ colorées dans InfoPanel »… **à retrouver**, peut-être déjà un style).
5. **i18n** — vérifier/ajouter `statName.<id>` FR+EN ; réutiliser natures FR du Team Builder ; types FR déjà là.

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
