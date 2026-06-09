# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs

### `BattleLogPanel` — entrée longue wrappe et déborde sur la ligne suivante (2026-06-09, playtest plan 118)
- Chaque slot de log a une hauteur fixe (`BATTLE_LOG_LINE_HEIGHT`) mais le `lineText` a `wordWrap` activé → un message qui passe sur 2 lignes occupe 1 seul slot et **chevauche** l'entrée suivante (observé sur le morph « Force Nature se transforme en Triplattaque ! »).
- Contourné plan 118 : messages morph raccourcis en forme flèche (`X → Y`) pour tenir sur 1 ligne. La limite de fond demeure pour tout futur message long.
- Fix propre : lignes à hauteur variable (mesurer `lineText.height` réel, empiler par pixels au lieu d'index × hauteur fixe) + scroll au pixel. Refonte modérée du `BattleLogPanel`.

### Nom FR reference faux : `body-press` = "Big Splash" (2026-06-04, plan 110)
- `reference/moves.json` et le pipeline `data:update` donnent `names.fr = "Big Splash"` pour `body-press` (faux — nom officiel FR = **Bodypress**).
- Contourné : override dans `src/i18n/moves.fr.json` (`"body-press": "Bodypress"`). La reference reste fausse → à corriger côté source `build-reference.ts` / mapping Showdown au prochain `data:update`, sinon le fix i18n sera écrasé.
- Vérifier si d'autres moves ont un `names.fr` anglais résiduel (audit grep mots EN dans moves.fr.json).

### `tacticalOverrides.flags` écrase les flags reference au merge (2026-05-31, review plan 102)
- `load-data.ts:58` fait `{ ...base, ...tactical }` : un `flags` défini dans tactical **remplace entièrement** `base.flags` (extrait de reference) au lieu de fusionner.
- Impact : `aerial-ace` (seul move actuel avec `flags` override = `{ slicing: true }`) perd `contact`/`protect`/`mirror` après merge.
- Aucun move du Batch G1 concerné (aucun n'override `flags`). Préexistant.
- Fix : deepMerge sur `flags`, ou inclure les flags reference dans l'override.

### Disparité UI HTML vs canvas Phaser (2026-05-19, observation playtest)
- Le projet mélange UI HTML (Team Builder, TeamSelectScene depuis plan 086) et UI Phaser canvas (combat, action menu, info panel, placement roster, timeline).
- Conséquences : double système de fonts/couleurs/spacing (tokens.css vs constants.ts), UX incohérente (curseur, scaling, raccourcis).
- À planifier : décision globale renderer 2D vs HTML overlay (cf plan 062/063 Phase 3.5 Babylon différée). Court terme : aligner styles canvas sur tokens design.

### Le Mur — gameplay cassé (2026-04-23)
- Map `le-mur.tmj` retirée du menu (`maps-registry.ts`).
- Bug transparence **résolu** (commit `082240c`). Problèmes restants :
  - Pokemon trop lents sur neige — terrain `slow` excessif pour une map traversée, à revoir.
  - IA perdue sur chemins verticaux (escaliers).
- **Le Mur ne peut pas être réintégré sans rotation caméra** — injouable en vue iso fixe. À reconsidérer avec rotation (Phase 3.5 Babylon ou plus tard).

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->


## Dette technique

### GitHub Actions sur Node 20 — déprécié (2026-06-05, release v2026.6.1)
- **Contexte** : le run `itch-deploy` v2026.6.1 a émis un warning : `actions/checkout@v4`, `actions/setup-node@v4`, `Ayowel/butler-to-itch@v1.3.0`, `pnpm/action-setup@v4` tournent sur Node.js 20, déprécié.
- **Deadline** : à partir du **16 juin 2026** GitHub force Node.js 24 par défaut ; Node 20 retiré des runners le **16 septembre 2026**.
- **Fix recommandé** : bumper les actions vers des versions supportant Node 24 (`actions/checkout@v5`, `actions/setup-node@v5`, vérifier `pnpm/action-setup` et `butler-to-itch`). Workaround temporaire : `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` dans le workflow.
- **Priorité** : moyenne — non bloquant avant le 16 juin, à traiter avant cette date pour éviter surprise.
- Ref : https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

### Tag tooltip `superVsWater` hardcodé pour `typeEffectivenessOverride` (2026-06-05, plan 113)
- **Contexte** : `MoveTooltip.ts` affiche le tag `moveTooltip.tag.superVsWater` ("×2 sur les types Eau") pour tout move ayant `typeEffectivenessOverride !== undefined`. Le champ est générique (`{ against: PokemonType; multiplier: number }`) mais le tag est spécifique à l'Eau.
- **Risque** : un futur move qui override contre un autre type (ex: ×2 Feu) afficherait un tag faux. Aujourd'hui 1 seul move concerné (Lyophilisation).
- **Fix recommandé** : construire le tag dynamiquement depuis `against`/`multiplier` (avec clés i18n de noms de types). À faire quand un 2e move à override arrive (B2/B3 ou plus tard).
- **Priorité** : basse — cosmétique, 1 move concerné.

### Générer automatiquement `moves.{en,fr}.json` depuis `reference/moves.json` dans `data:update` (2026-06-04)
- **Contexte** : `moves.en.json` s'est retrouvé incomplet (297 clés vs 938 en FR) car il est maintenu à la main. Chaque batch de moves oublie d'ajouter les noms EN. 47 moves implémentés s'affichaient en slug brut (`rock-slide`, `confuse-ray`) dans l'ActionMenu en mode anglais jusqu'au hotfix 2026-06-04.
- **Fix courant** : régénération manuelle depuis `reference/moves.json` (`names.en`). Clé `vise-grip` corrigée dans `moves.fr.json`.
- **Fix recommandé** : intégrer la génération des fichiers `i18n/moves.{en,fr}.json` dans le script `build-reference.ts` (tâche `data:update`), en extrayant `names.en` et `names.fr` de chaque entrée `reference/moves.json`. Parité garantie à chaque `data:update` sans intervention manuelle.
- **Priorité** : moyenne — bloquant uniquement pour les utilisateurs en langue anglaise ; chaque `data:update` sans ce fix est un risque de régression.

## Notes IA (à regrouper en plan d'amélioration IA)

### IA — CT-aware scoring (2026-04-25)
- Scoring CT tenté plan 068, rejeté : `CT_REFERENCE_COST / ctCost` dans scorer greedy monoronde pousse moves moins puissants → combats >5000 tours dans tests de charge.
- **Nécessite lookahead multi-tour** (prédiction ordre CT, évaluation N tours). À planifier plan dédié IA.
- L'IA joue tours correctement en mode CT — problème = scoring stratégique, pas l'exécution.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Afficher effets terrain actifs sur tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051.

## Feedback visuel

### Autocomplete bilingue — chercher en langue courante ET en anglais (2026-05-31)
- Les champs de recherche / autocomplete (moves, Pokemon, items, abilities) doivent matcher **les deux langues** : la langue courante (FR) **et** l'anglais, quelle que soit la langue UI active.
- Cas d'usage : joueur FR qui connaît le nom EN d'une attaque (ou inversement) doit pouvoir le taper et trouver le résultat.
- Concerne : MovePickerModal, Pokemon picker, Item modal (TeamEditScene), tout futur champ de recherche.
- Impl : indexer la recherche sur `names.fr` + `names.en` (reference) au lieu du seul `getMoveName(lang)`. Normaliser (lowercase, sans accents, sans tiret) pour tolérance de frappe.
- Priorité moyenne — QoL Team Builder.

### MoveTooltip — afficher modifiers contextuels (météo, terrain, items) (2026-05-13)
- Ex : Blizzard "Prec 70 (100 en Neige)", Flamethrower "BP 90 (×1.5 en Soleil)", Thunder "Prec 70 (100 en Pluie, 50 en Soleil)".
- Étendre MoveTooltip pour calculer effective BP/accuracy selon `state.weather` et types caster/cible.
- Inclure aussi : effet Heat-Rock (durée étendue), Sun-instant Solar-Beam, etc.
- Priorité moyenne — qualité de vie UX, pas bloquant.

### Icône sandstorm — symbole tourbillon perfectible (2026-05-13)
- Icône actuelle acceptée provisoirement (plan 084).
- Symbole vent (double spirale) moins reconnaissable que les 3 autres pictogrammes (sun/rain/snow).
- À refaire ultérieurement à la main (Aseprite) avec un symbole plus lisible.

## Tâches futures (hors backlog actif)

### Sprites originaux — plan B si DMCA Nintendo (plan 096)
- Vecteur risque IP principal : 502 sprites PNG PMDCollab rippés Showdown/PokeAPI.
- Décision #382 : risque assumé, profil bas (zéro monétisation, pas de post manuel, niche).
- Si DMCA un jour → page itch retirée immédiatement, puis remplacer sprites par créatures originales (gros chantier, projet successeur).
- Hors scope plan 096. À planifier si jamais déclenché.

### Aurora Veil v2 — post intégration Legends Z-A
- Dropped v1 (plan 095) : 0 learner Gen 1 roster, tous les 9 learners Gen 7+ hors roster.
- Reprise quand Alolan Ninetales et Vulpix-Alola sont intégrés via le pipeline Z-A.
- Réutilise infrastructure `TeamAura` + `EffectKind.PostAura` (plan 098) ; ajouter variant `AuraKind.AuroraVeil` + handler combiné Phys+Spé. Requiert `state.weather === Weather.Snow` à la pose.

<!-- Résolu plan 098 (2026-05-25) : Brume (Mist, Glace) + Rune Protect (Safeguard, Normal) livrés. Refactor infra unifié ScreenAura → TeamAura (4 kinds). Hook handle-stat-change.ts (Mist) + handle-status.ts (Safeguard). Bug fix friendly fire (attacker.id vs attacker.playerId). IA threat-detection + scoring threatBonus ×1.5. Renderer indicateurs 4 kinds. 1618 unit + 236 intégration verts. -->

### Sandbox panel — config screens active au boot
- Plan 095 étape 14 (optionnelle non livrée v1).
- UI : panneau "Écrans actifs" avec sélection Kind + caster + tours restants → seed `state.screens` au démarrage sandbox.
- Utile pour QA/playtest sans devoir poser le move chaque session.

### Ajouter Pokemon Legends Z-A comme source de données
- Showdown mod ZA : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen9legends/`
- Fichiers : `pokedex.ts` (Mega ZA — Mega Starmie, Mega Mawile, Mega Medicham), `learnsets.ts`, `formats-data.ts`, `scripts.ts`
- Format identique à `mods/champions` (`inherit: true` + overrides) → réutiliser pipeline `fetch-champions.ts` / `applyChampionsOverrides`
- **Question de design** : composer ZA et Champions ?
  - Option : layering `Showdown Gen 9 → ZA → Champions` (ZA apporte contenu, Champions ajuste équilibrage)
  - Risque : Champions peut overrider contenu ZA (nouveau Mega) — vérifier conflits
- **Plan 094** : `learnset-extensions.ts` est un override temporaire (skull-bash + razor-wind) à supprimer quand le pipeline Z-A sera intégré.
- Planifier plan dédié.

### Portée dynamique selon hauteur (dénivelé)
- Attaquant en hauteur voit/tire plus loin. Bonus portée +N cases selon différence hauteur caster-cible (ex: +1 case par niveau au-dessus, cap +2).
- Plans 046/047 : uniquement modificateur **dégâts** (`getHeightModifier`, ±10%/niveau, cap +50%/-30%). Aucun bonus portée.
- À planifier : formule (flat +N, multiplicatif, cap), adapter `getValidTargetPositions` pour portée effective par caster, affecter preview renderer.

### Système de décorations Tiled
- Créer `decorations.tsj` + `decorations.png` — tileset dédié, pipeline séparée du terrain
- Marquages d'arène : lignes (~12 tiles : segments, coins, T, croisement) + pokeball centrale (~6-8 tiles)
- Décos environnement : herbe haute overlay, arbres, rochers (sources PMD)
- Remplir layer `decorations` de `simple-arena.tmj` + maps futures

### Trajectoire de vol (montées/descentes) pour les Flying Pokemon
- **Anim repos résolue (2026-04-26)** : Flying Pokemon restent en FlyingGlide au repos (idle, après dégâts, knockback). `PokemonSprite.setRestingAnimation()` + `playRestingAnimation()` injectés depuis `BattleScene` à la création.
- **Restant** : trajectoire déplacement sur dénivelés. Actuellement tween saut (`Hop`) comme autres. Avec FlyingGlide, arc parabolique plus compensé par frames. À traiter avec assets flying dédiés ou quand trajectoire semblera bizarre.
  - Piste : trajectoire 2-phase (rise-in-place → walk horizontal → drop) ou arc parabolique container Y.
  - Constantes `JUMP_TWEEN_DURATION_MS` déjà séparables par type.
