# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs

### Disparité UI HTML vs canvas Phaser (2026-05-19, observation playtest)
- Le projet mélange UI HTML (Team Builder, TeamSelectScene depuis plan 086) et UI Phaser canvas (combat, action menu, info panel, placement roster, timeline).
- Conséquences : double système de fonts/couleurs/spacing (tokens.css vs constants.ts), UX incohérente (curseur, scaling, raccourcis).
- À planifier : décision globale renderer 2D vs HTML overlay (cf plan 062/063 Phase 3.5 Babylon différée). Court terme : aligner styles canvas sur tokens design.

### Le Mur — gameplay cassé (2026-04-23)
- Map `le-mur.tmj` retirée du menu (`maps-registry.ts`).
- Bug transparence **résolu** (commit `59e8b25`). Problèmes restants :
  - Pokemon trop lents sur neige — terrain `slow` excessif pour une map traversée, à revoir.
  - IA perdue sur chemins verticaux (escaliers).
- **Le Mur ne peut pas être réintégré sans rotation caméra** — injouable en vue iso fixe. À reconsidérer avec rotation (Phase 3.5 Babylon ou plus tard).

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->


## Notes IA (à regrouper en plan d'amélioration IA)

### IA — CT-aware scoring (2026-04-25)
- Scoring CT tenté plan 068, rejeté : `CT_REFERENCE_COST / ctCost` dans scorer greedy monoronde pousse moves moins puissants → combats >5000 tours dans tests de charge.
- **Nécessite lookahead multi-tour** (prédiction ordre CT, évaluation N tours). À planifier plan dédié IA.
- L'IA joue tours correctement en mode CT — problème = scoring stratégique, pas l'exécution.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Afficher effets terrain actifs sur tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051.

## Feedback visuel

### MoveTooltip — afficher modifiers contextuels (météo, terrain, items) (2026-05-13)
- Ex : Blizzard "Prec 70 (100 en Neige)", Flamethrower "BP 90 (×1.5 en Soleil)", Thunder "Prec 70 (100 en Pluie, 50 en Soleil)".
- Étendre MoveTooltip pour calculer effective BP/accuracy selon `state.weather` et types caster/cible.
- Inclure aussi : effet Heat-Rock (durée étendue), Sun-instant Solar-Beam, etc.
- Priorité moyenne — qualité de vie UX, pas bloquant.

### Icône sandstorm — symbole tourbillon perfectible (2026-05-13)
- Régen PixelLab (plan 084) — 3 itérations, dernière acceptée provisoirement.
- Symbole vent (double spirale) moins reconnaissable que les 3 autres pictogrammes (sun/rain/snow).
- À retenter ultérieurement avec prompt plus explicite ou retouche manuelle.

## Tâches futures (hors backlog actif)

### Sprites originaux — plan B si DMCA Nintendo (plan 096)
- Vecteur risque IP principal : 502 sprites PNG PMDCollab rippés Showdown/PokeAPI.
- Décision #382 : risque assumé, profil bas (zéro monétisation, pas de post manuel, niche).
- Si DMCA un jour → page itch retirée immédiatement, puis remplacer sprites par créatures originales (gros chantier, projet successeur).
- Hors scope plan 096. À planifier si jamais déclenché.

### Aurora Veil v2 — post intégration Legends Z-A
- Dropped v1 (plan 095) : 0 learner Gen 1 roster, tous les 9 learners Gen 7+ hors roster.
- Reprise quand Alolan Ninetales et Vulpix-Alola sont intégrés via le pipeline Z-A.
- Réutilise infrastructure `ScreenAura` + `EffectKind.PostScreen` ; ajouter variant `ScreenKind.AuroraVeil` + handler combiné Phys+Spé. Requiert `state.weather === Weather.Snow` à la pose.

### Mist / Safeguard — Team Protections bundle
- Mist : bloque les baisses de stats sur alliés r3 caster (mirror Reflect côté stat).
- Safeguard : immunité statuts majeurs sur alliés r3 caster.
- Bundle "Team Protections" v2, séparé du plan 095 (mécaniques distinctes des screens dégâts).

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
