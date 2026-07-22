# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs

_Aucun bug actif._ (2 items reclassés + 2 vrais bugs corrigés le 2026-07-19 → `docs/backlog-archive.md`.)

<!-- Le Mur — réintégrer + fixer IA : RÉSOLU plan 159 (2026-07-14, publié v2026.7.2). Carte dispo au menu + IA maîtrise ring-out/prise de hauteur. Détails → docs/backlog-archive.md. -->

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->

## Dette technique

_Aucune._

<!-- Résolu 2026-07-21 : `ct-system.scenario.test.ts` capté par aucun projet vitest (jamais exécuté) → déplacé de `packages/core/src/battle/` vers `scenarios/` (convention unifiée, imports en alias `@pokemon-tactic/core`). 6/6 PASS. -->

<!-- Résolu 2026-06-12 (commit 30be7ee) : actions/checkout@v5, actions/setup-node@v5, pnpm/action-setup@v4, deploy-pages bumpés node24 dans ci.yml / deploy.yml / itch-deploy.yml. butler-to-itch bloqué à v1.3.0 (pas de release node24 dispo) — surveillé dans docs/next.md. -->
<!-- Résolu 2026-07-19 : Tag tooltip `superVsWater` hardcodé (plan 113) → tag dynamique `typeEffectivenessOverride` + i18n noms de types. Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-19 : Style dupliqué DOM↔Babylon — audit a montré que c'était en quasi-totalité du code mort (purgé), résidu vivant verrouillé par test de parité, centralisation complète écartée (sur-ingénierie). Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-21 : IA — CT-aware scoring (plan 165). Détails → docs/backlog-archive.md. -->

## Notes IA (à regrouper en plan d'amélioration IA)

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Afficher effets terrain actifs sur tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051.

## Feedback visuel

### MoveTooltip — afficher modifiers contextuels (météo, terrain, items) (2026-05-13)
- Ex : Blizzard "Prec 70 (100 en Neige)", Flamethrower "BP 90 (×1.5 en Soleil)", Thunder "Prec 70 (100 en Pluie, 50 en Soleil)".
- Étendre MoveTooltip pour calculer effective BP/accuracy selon `state.weather` et types caster/cible.
- Inclure aussi : effet Heat-Rock (durée étendue), Sun-instant Solar-Beam, etc.
- Priorité moyenne — qualité de vie UX, pas bloquant.

### Caméra adaptative selon taille de carte (2026-06-19, portée réduite 2026-07-22)
- ~~Limiter les niveaux de zoom : bornes min/max pour éviter zoom trop loin (carte minuscule) ou trop près (perte vue tactique).~~ **Fait (2026-07-22)** — zoom passé à 3 crans discrets (Vue d'ensemble 0.7 / Moyen 1.1 / Rapproché 1.8, défaut Moyen), easing entre crans, molette = 1 cran/notch clampé. `ZOOM_LEVELS`/`ZOOM_DEFAULT_INDEX`/`ZOOM_LERP` (`docs/design-system.md`).
- **Volet écarté (décision humaine, 2026-07-22)** : le cadrage initial + amplitude pan/zoom calés sur les dimensions de la grille (comportement caméra qui s'adapte à la taille de la carte) n'est **pas** implémenté et n'est plus prévu pour l'instant. Pourrait revenir plus tard si le besoin se représente (ex: cartes beaucoup plus grandes en Phase 6) — pas supprimé de la doc pour cette raison, mais aucune action engagée.

## Tâches futures (hors backlog actif)

### Toile Gluante — 0 learner Gen 1 (gap data roster, pas un bug) (2026-06-19, plan 131 ; reclassé 2026-07-19)
- `sticky-web` n'est apprise par aucun Pokemon du roster Gen 1 → absente des movepools Team Builder (posable seulement en sandbox).
- Pas un bug code : la mécanique marche en sandbox. Gap de données pur.
- Se résout naturellement quand le roster s'étend aux Pokemon Gen 2+ qui l'apprennent (Arachno, Galvaran…) — Phase 9.

### Guerre météo — setters opposés à l'entrée (Gen 2+) (2026-06-21, plan 137 ; reclassé 2026-07-19)
- `weatherAutoSetter` appliqué séquentiellement à l'entrée : si plusieurs Pokemon posent une météo, le dernier dans l'ordre d'itération écrase (pas de résolution vitesse/initiative).
- **Inatteignable en Gen 1** : seul Sécheresse (Soleil) existe (Crachin/Crachin Sable/Alerte Neige = Gen 2+). Soleil vs Soleil = idempotent, conflit impossible → non testable aujourd'hui.
- À traiter **avec l'arrivée de setters opposés (Gen 2+)** : brancher `applyWeatherWar` (déjà existant) dans `triggerBattleStart` pour départager. Émet 2 events `WeatherChanged` cosmétiques si 2 setters.
- Sorti des bugs actifs (dormant, code spéculatif sinon).

### Scénario de combat piloté Joueur vs Joueur (QA + captures) (2026-06-18)
- Pouvoir piloter un combat **JcJ** (les deux camps humains), via l'UI si possible — sinon harness sandbox.
- Objectifs : (1) tester plein de mécaniques d'un coup en jouant les deux côtés ; (2) **voir les tooltips d'attaque** en conditions réelles ; (3) servir de base aux **screenshots / gif** (README, wiki, devlog itch).
- Piste : mode/flag sandbox `humanVsHuman` (les deux `controller: human`), ou écran de setup où les 2 colonnes sont en Humain (TeamSelect le permet déjà — vérifier que le combat suit).
- Priorité moyenne — gros multiplicateur pour la QA et la com.

### Aurora Veil v2 — post intégration Legends Z-A
- Dropped v1 (plan 095) : 0 learner Gen 1 roster, tous les 9 learners Gen 7+ hors roster.
- Reprise quand Alolan Ninetales et Vulpix-Alola sont intégrés via le pipeline Z-A.
- Réutilise infrastructure `TeamAura` + `EffectKind.PostAura` (plan 098) ; ajouter variant `AuraKind.AuroraVeil` + handler combiné Phys+Spé. Requiert `state.weather === Weather.Snow` à la pose.

<!-- Résolu plan 098 (2026-05-25) : Brume (Mist, Glace) + Rune Protect (Safeguard, Normal) livrés. Refactor infra unifié ScreenAura → TeamAura (4 kinds). Hook handle-stat-change.ts (Mist) + handle-status.ts (Safeguard). Bug fix friendly fire (attacker.id vs attacker.playerId). IA threat-detection + scoring threatBonus ×1.5. Renderer indicateurs 4 kinds. 1618 unit + 236 intégration verts. -->

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

### Animer les liquides (2026-07-21, suite plan 166)
- Rendu liquides statique (plan 166 : transparence, cuvette, immersion, écume pixel-art). La **surface ne bouge pas**.
- À faire (prochaine session) : animer la surface des liquides — ondulation/vagues procédurales sur la slab de surface translucide (eau, eau profonde, marais, lave). Cohérent avec l'écume déjà animée (`water-foam-material.ts`).
- Pistes : décalage UV animé sur le `topMaterial` de la surface, ou léger déplacement vertical sinusoïdal des vertices du haut, ou shader dédié (comme l'écume). Garder l'échelle pixel-art (pas de shader lisse).
- Constantes ajustables déjà en place (`LIQUID_SURFACE_RATIO`, alphas par groupe) — ajouter fréquence/amplitude/vitesse ajustables.

### Décorations d'arène voxel (Phase 6)
- Pipeline Tiled `decorations.tsj` caduc → les décos passent par le **voxel** (`.glb`, cf occlusion déco résolue via voxel).
- Marquages d'arène : lignes (segments, coins, T, croisement) + pokeball centrale.
- **Peintures / blocs décorés** : motifs, dessins posés au sol / sur tuiles.
- ~~Décos environnement : herbe haute, arbres, rochers.~~ **Fait (2026-07-21)** — meshes voxel `.glb` + vent procédural, décision #690.

### Bonus Cabriole ×2 sur Roulade / Ball'Glace (2026-07-04, human-testing plan 149)
- Canon : Cabriole (`defense-curl`) double la puissance de Roulade (`rollout`) et Ball'Glace (`ice-ball`) si utilisée avant, pour tout le reste du combat.
- État actuel : **non implémenté** — `defense-curl` ne pose que Défense +1 ; `rollout-streak.ts` / `DynamicPowerKind.RolloutStreak` ignorent Cabriole. Les deux moves sont cohérents entre eux (aucun bonus).
- À faire (passe dédiée) : flag `PokemonInstance.usedDefenseCurl?` posé par Cabriole (persistant, reset KO), consommé ×2 dans le calcul de puissance RolloutStreak (Roulade + Ball'Glace) + tests + tag tooltip. Hors périmètre plan 149 (famille lock-in).

