# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs

### Toile Gluante absente du roster Gen 1 — invisible en Team Builder (2026-06-19, plan 131)
- `sticky-web` n'est apprise par aucun Pokemon du roster Gen 1 actuel (learnset vérification data-miner plan 131).
- Conséquence : Toile Gluante n'apparaît dans aucun movepool de Team Builder — le joueur ne peut pas la poser sans passer par le sandbox (`pnpm dev:sandbox '{...}'`).
- Ce n'est pas un bug code : la mécanique fonctionne correctement en sandbox. C'est un gap de données.
- Fix naturel : étendre le roster à des Pokemon Gen 2+ qui apprennent `sticky-web` (Arachno, Galvaran…) — Phase 9.
- Priorité basse — testable en sandbox, non bloquant.

### Multi-coup vs Peau Dure (Rough Skin) — à tester (2026-06-18, retour playtest)
- Tester un move multi-coup (ex: Furie/`fury-attack`, Charge-Os/`bone-rush`) contre un Pokemon avec **Peau Dure** (`rough-skin`).
- Vérifier : le recul Peau Dure se déclenche-t-il **par coup** (canon) ou une seule fois ? Y a-t-il un bug d'ordre / de KO en plein multi-hit ?
- QA d'abord (sandbox), puis bug + fix si comportement faux.

### `tacticalOverrides.flags` écrase les flags reference au merge (2026-05-31, review plan 102)
- `load-data.ts:58` fait `{ ...base, ...tactical }` : un `flags` défini dans tactical **remplace entièrement** `base.flags` (extrait de reference) au lieu de fusionner.
- Impact : `aerial-ace` (seul move actuel avec `flags` override = `{ slicing: true }`) perd `contact`/`protect`/`mirror` après merge.
- Aucun move du Batch G1 concerné (aucun n'override `flags`). Préexistant.
- Fix : deepMerge sur `flags`, ou inclure les flags reference dans l'override.

### Disparité UI HTML vs canvas Phaser (2026-05-19, observation playtest)
- Le projet mélange UI HTML (Team Builder, TeamSelectScene depuis plan 086) et UI Phaser canvas (combat, action menu, info panel, placement roster, timeline).
- Conséquences : double système de fonts/couleurs/spacing (tokens.css vs constants.ts), UX incohérente (curseur, scaling, raccourcis).
- À planifier : décision globale renderer 2D vs HTML overlay (cf plan 062/063 Phase 3.5 Babylon différée). Court terme : aligner styles canvas sur tokens design.

### Le Mur — réintégrer + fixer IA (2026-04-23, relancé 2026-06-18)
- Map `le-mur.tmj` retirée du menu (`maps-registry.ts`).
- **Blocage rotation caméra levé** : Babylon (Phase 5) a la rotation caméra → la map est de nouveau jouable. Objectif : **la rendre disponible** dans le menu.
- Bug transparence **résolu** (commit `082240c`). Problèmes restants à fixer avant réintégration :
  - **IA ne tente pas de monter sur le mur** — elle essaie de **tirer à travers** au lieu de prendre la hauteur. À fixer (pathfinding vertical + scoring qui valorise la prise de hauteur).
  - IA perdue sur chemins verticaux (escaliers).
  - Pokemon trop lents sur neige — terrain `slow` excessif pour une map traversée, à revoir.

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->

## Dette technique

<!-- Résolu 2026-06-12 (commit 30be7ee) : actions/checkout@v5, actions/setup-node@v5, pnpm/action-setup@v4, deploy-pages bumpés node24 dans ci.yml / deploy.yml / itch-deploy.yml. butler-to-itch bloqué à v1.3.0 (pas de release node24 dispo) — surveillé dans docs/next.md. -->

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

### Animation Faint absente pour la majorité du roster (2026-06-18, observé lors du fix anim KO)
- Seulement ~21 des Pokemon jouables du roster ont une animation `Faint` dans leur atlas (abra, bulbasaur, charizard, charmander, dummy, eevee, flareon, gengar, jigglypuff, jolteon, machop, meowth, mew, mewtwo, ninetales, pidgey, pikachu, raichu, sandshrew, sandslash, et quelques autres).
- Les Pokemon sans `Faint` ne jouent aucune animation d'effondrement au KO (tint sombre + masquage HUD uniquement — le comportement de fallback actuel).
- Exemples sans Faint : Florizarre (seulement 8 animations dans l'atlas), et la majorité du roster.
- **Cause supposée** : asset gap côté ripping PMDCollab/extract-sprites, pas un bug code. À investiguer : pourquoi `extract-sprites` ne récupère pas `Faint` pour tous les Pokemon ?
- Priorité basse — l'effondrement visuel fonctionne via fallback, mais manque de polish.

### Scénario de combat piloté Joueur vs Joueur (QA + captures) (2026-06-18)
- Pouvoir piloter un combat **JcJ** (les deux camps humains), via l'UI si possible — sinon harness sandbox.
- Objectifs : (1) tester plein de mécaniques d'un coup en jouant les deux côtés ; (2) **voir les tooltips d'attaque** en conditions réelles ; (3) servir de base aux **screenshots / gif** (README, wiki, devlog itch).
- Piste : mode/flag sandbox `humanVsHuman` (les deux `controller: human`), ou écran de setup où les 2 colonnes sont en Humain (TeamSelect le permet déjà — vérifier que le combat suit).
- Priorité moyenne — gros multiplicateur pour la QA et la com.

### Boussole / girouette d'orientation caméra (2026-06-18)
- La caméra Babylon tourne par snaps 90° → on perd vite le Nord.
- Ajouter un indicateur d'orientation (boussole / girouette) montrant la direction courante de la caméra.
- DOM (chrome écran, coin) ou monde — à trancher. Suivre la rotation caméra.

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
