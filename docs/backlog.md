# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs

<!-- Résolu 2026-08-28 : curseur manette qui repartait sur « ◀ Retour » à chaque changement de format (testid manquant du sélecteur de format) → docs/backlog-archive.md. -->

<!-- Résolu 2026-07-23 (plan 169) : Régression — demi-blocs de liquide obsolètes depuis le rendu volume liquide → docs/backlog-archive.md. -->
<!-- 2 items reclassés + 2 vrais bugs corrigés le 2026-07-19 → `docs/backlog-archive.md`. -->

<!-- Le Mur — réintégrer + fixer IA : RÉSOLU plan 159 (2026-07-14, publié v2026.7.2). Carte dispo au menu + IA maîtrise ring-out/prise de hauteur. Détails → docs/backlog-archive.md. -->

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->

## Dette technique

### `__ptE2e__` survit à la destruction de sa scène (2026-08-28)
- **Constaté** : le hook de debug de scène (`packages/render-babylon/src/e2e-debug-hook.ts`) est posé sur `globalThis` par `createCombatScene`, et **rien ne le retire** au `dispose()`. Or l'écran de choix de carte construit son aperçu 3D avec `createCombatScene` (`map-preview-stage.ts`) : après cet écran, `__ptE2e__.isReady()` répond donc `true` en pointant une scène détruite.
- **Conséquence** : un harnais qui attend « scène prête » pour savoir qu'un combat a démarré part **sans rien attendre**. Coûté un run de capture au plan 194 (la séquence croyait avoir lancé le combat et filmait encore l'écran de sélection d'équipe). Contourné là-bas en attendant le menu d'actions du combat, pas la scène.
- **Correctif proposé** : faire renvoyer un `uninstall` par `installE2eSceneHook` et l'appeler dans `dispose()` — le hook ne survivrait plus à sa scène. À vérifier contre les tests qui traversent menu → combat : ils attendent la nouvelle scène, donc un hook effacé entre les deux les rend plus stricts, pas plus fragiles.

<!-- Résolus 2026-08-27 : match nul sans chemin d'exécution (plan 191), repli anglais de `t()` sur les
     clés composées, `AuraRingKind` en union de littéraux, `tsconfig` excluant les `*.test.ts` des 8
     paquets (plan 193) → docs/backlog-archive.md. -->

### Étiquettes de carte en français en dur (2026-08-28)
- **Constaté** : sur l'écran de choix de carte en anglais, la ligne de méta affiche « 12×12 · couloirs, dénivelé » — les étiquettes restent françaises. Vu en sortant une capture pour itch.io et le README, dont le public est anglophone (plan 194).
- **Cause** (`packages/app/src/maps/maps-registry.ts`) : `displayName` et `description` sont bien des paires `{ fr, en }`, mais `tags` est un `string[]` **français en dur**. `map-select-screen.ts:45` les concatène tels quels.
- **Correctif** : passer `tags` en `{ fr, en }[]` comme ses voisins, ou en clés i18n. Neuf cartes, deux à quatre étiquettes chacune.
- **Contournement en attendant** : la capture livrée utilise Arène Simple, seule carte sans étiquette.

## Notes IA (à regrouper en plan d'amélioration IA)

## Feedback visuel

<!-- Résolus 2026-08-27 : valeurs fixes sous police mise à l'échelle (menu d'actions, timeline,
     infobulle), et modificateurs contextuels de l'infobulle d'attaque (plan 192) →
     docs/backlog-archive.md. -->

### Caméra adaptative selon taille de carte (2026-06-19, portée réduite 2026-07-22)
- ~~Limiter les niveaux de zoom : bornes min/max pour éviter zoom trop loin (carte minuscule) ou trop près (perte vue tactique).~~ **Fait (2026-07-22)** — zoom passé à 3 crans discrets (Vue d'ensemble 0.7 / Moyen 1.1 / Rapproché 1.8, défaut Moyen), easing entre crans, molette = 1 cran/notch clampé. `ZOOM_LEVELS`/`ZOOM_DEFAULT_INDEX`/`ZOOM_LERP` (`docs/design-system.md`).
- **Volet écarté (décision humaine, 2026-07-22)** : le cadrage initial + amplitude pan/zoom calés sur les dimensions de la grille (comportement caméra qui s'adapte à la taille de la carte) n'est **pas** implémenté et n'est plus prévu pour l'instant. Pourrait revenir plus tard si le besoin se représente (ex: cartes beaucoup plus grandes en Phase 6) — pas supprimé de la doc pour cette raison, mais aucune action engagée.

## Tâches futures (hors backlog actif)

<!-- Résolu 2026-08-28 (plan 194) : Scénario de combat piloté Joueur vs Joueur (QA + captures), devenu la
     séquence d'intro du jeu → docs/backlog-archive.md. -->

### Toile Gluante — 0 learner Gen 1 (gap data roster, pas un bug) (2026-06-19, plan 131 ; reclassé 2026-07-19)
- `sticky-web` n'est apprise par aucun Pokemon du roster Gen 1 → absente des movepools Team Builder (posable seulement en sandbox).
- Pas un bug code : la mécanique marche en sandbox. Gap de données pur.
- Se résout naturellement quand le roster s'étend aux Pokemon Gen 2+ qui l'apprennent (Arachno, Galvaran…) — Phase 9.

### Guerre météo — setters opposés à l'entrée (Gen 2+) (2026-06-21, plan 137 ; reclassé 2026-07-19)
- `weatherAutoSetter` appliqué séquentiellement à l'entrée : si plusieurs Pokemon posent une météo, le dernier dans l'ordre d'itération écrase (pas de résolution vitesse/initiative).
- **Inatteignable en Gen 1** : seul Sécheresse (Soleil) existe (Crachin/Crachin Sable/Alerte Neige = Gen 2+). Soleil vs Soleil = idempotent, conflit impossible → non testable aujourd'hui.
- À traiter **avec l'arrivée de setters opposés (Gen 2+)** : brancher `applyWeatherWar` (déjà existant) dans `triggerBattleStart` pour départager. Émet 2 events `WeatherChanged` cosmétiques si 2 setters.
- Sorti des bugs actifs (dormant, code spéculatif sinon).

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

### Décorations d'arène voxel (Phase 6)
- Pipeline Tiled `decorations.tsj` caduc → les décos passent par le **voxel** (`.glb`, cf occlusion déco résolue via voxel).
- Marquages d'arène : lignes (segments, coins, T, croisement) + pokeball centrale.
- **Peintures / blocs décorés** : motifs, dessins posés au sol / sur tuiles.
- ~~Décos environnement : herbe haute, arbres, rochers.~~ **Fait (2026-07-21)** — meshes voxel `.glb` + vent procédural, décision #690.

