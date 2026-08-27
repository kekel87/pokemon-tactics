# Backlog — Bugs et Feedback

Bugs connus et retours playtest **non traités**. Items résolus → `docs/backlog-archive.md`.

## Bugs


_Aucun bug actif._

<!-- Résolu 2026-07-23 (plan 169) : Régression — demi-blocs de liquide obsolètes depuis le rendu volume liquide → docs/backlog-archive.md. -->
<!-- 2 items reclassés + 2 vrais bugs corrigés le 2026-07-19 → `docs/backlog-archive.md`. -->


<!-- Le Mur — réintégrer + fixer IA : RÉSOLU plan 159 (2026-07-14, publié v2026.7.2). Carte dispo au menu + IA maîtrise ring-out/prise de hauteur. Détails → docs/backlog-archive.md. -->

<!-- Résolus plan 097 (2026-05-24) :
- FOUC font menu : index.html preload + font-display block + BootScene document.fonts.ready
- Écran noir combat : BattleLoadingScene parallèle + lazy strict 12 sprites engaged
- MapSelect preview noire : camera fadeOut(0)/fadeIn(150ms)
-->

## Dette technique

### ~~Le match nul de combat n'a aucun chemin d'exécution~~ — RÉSOLU (2026-08-27, plan 191)

`checkVictory` scellait ET émettait le verdict au premier K.O. individuel, et le court-circuit qui
suit ce `handleKo` sortait de la résolution avant l'auto-K.O. du lanceur. Le verdict est désormais
**révisable** jusqu'à la frontière de résolution (`submitAction`), un drapeau `selfKoPending`
assouplit les 5 court-circuits concernés pour les seuls moves à auto-K.O., et `BattleEnded` est émis
une fois et une seule. `battle.draw`, `battle.drawMessage`, `battleLog.battleEnded.draw` et la
branche `<p>` de `showVictory` ne sont plus du code mort. Couvert par 3 tests de scénario + l'e2e
`DUEL_MUTUAL_KO`. Détail : `docs/plans/191-match-nul-ko-simultane.md`.

### ~~`t()` retombe sur l'ANGLAIS avant la clé brute~~ — TRAITÉ (2026-08-27)

Deux filets posés : `battle-log-keys.test.ts` (+72 cas) itère chaque valeur d'enum du core et exige
la clé dans les deux locales — et son **absence** pour les valeurs hors journal ; et `translateIn`
émet désormais un `console.warn` hors production quand la clé manque de la locale active, ce qui
couvre **aussi** les familles composées que le type `Translations` ne voit pas. Le repli sur l'anglais
est conservé : mieux qu'une clé brute à l'écran pour le joueur. **Règle qui reste vivante** : toute
future famille de clés composées à l'exécution a besoin de son test d'exhaustivité, le typecheck ne
la couvrira jamais.

### ~~`AuraRingKind` encodé en union de littéraux~~ — RÉSOLU (2026-08-27)

Devenu un const-object dans `packages/render-ports/src/ports.ts` (`{ ...AuraKind, PerishAura, Uproar }`).
Les deux littéraux ne sont plus répétés : `view-core/constants.ts` emploie des clés calculées et
`aura-ring-view.ts` les membres de l'enum. Source unique, comme la convention du projet l'exige.

### ~~Les `tsconfig` excluent les `*.test.ts` du typecheck~~ — RÉSOLU (2026-08-27, plan 193)

**Les 8 paquets sont verrouillés**, `core` compris : aucun `tsconfig` n'exclut plus les tests, donc
une erreur de type dans un test casse désormais le gate. `@types/node` ajouté, avec `types: ["node"]`
sur les 3 paquets qui en ont besoin (pas dans la base — `process` resterait alors typable en code
navigateur).

Ce que le verrou a trouvé, et qui était invisible jusque-là : **12 champs fantômes** (0 usage en
production, vestiges de refontes passées — `currentPp` seul pesait 1662 erreurs et 507 fichiers), des
**signatures qui avaient bougé sans que les tests suivent** (`makeAttacker()`, `BattleEngine`,
`EndTurn`), des **mocks incomplets** (`EffectContext`, `DamageModifyContext`, `BattleChrome`,
`BoardView`, `PresentationContext`…), et des `filter` à prédicat booléen qui masquaient une variante
d'union. Aucune fausse alerte.

Enseignement méthodologique consigné au plan : **115 des 290 erreurs du core venaient d'une seule
ligne**. Le comptage brut ne dit rien de la charge de travail — c'est la distribution par fichier
qu'il faut regarder.

Détail : `docs/plans/193-typecheck-des-tests.md`.

<!-- Résolu 2026-07-21 : `ct-system.scenario.test.ts` capté par aucun projet vitest (jamais exécuté) → déplacé de `packages/core/src/battle/` vers `scenarios/` (convention unifiée, imports en alias `@pokemon-tactic/core`). 6/6 PASS. -->

<!-- Résolu 2026-06-12 (commit 30be7ee) : actions/checkout@v5, actions/setup-node@v5, pnpm/action-setup@v4, deploy-pages bumpés node24 dans ci.yml / deploy.yml / itch-deploy.yml. butler-to-itch bloqué à v1.3.0 (pas de release node24 dispo) — surveillé dans docs/next.md. -->
<!-- Résolu 2026-07-19 : Tag tooltip `superVsWater` hardcodé (plan 113) → tag dynamique `typeEffectivenessOverride` + i18n noms de types. Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-19 : Style dupliqué DOM↔Babylon — audit a montré que c'était en quasi-totalité du code mort (purgé), résidu vivant verrouillé par test de parité, centralisation complète écartée (sur-ingénierie). Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-21 : IA — CT-aware scoring (plan 165). Détails → docs/backlog-archive.md. -->

## Notes IA (à regrouper en plan d'amélioration IA)

## Feedback visuel

### ~~Valeurs fixes restantes sous une police mise à l'échelle~~ — RÉSOLU (2026-08-27)

Les deux feuilles que la décision du 2026-08-27 avait mises de côté sont finalement traitées, sur
demande de l'humain : `components/button.css` (l'arrondi de `.tb-btn`, corrigé par un sélecteur
**ciblé** `.bc-menu .bc-btn` dans `battle-chrome.css` — jamais en place, il est partagé avec le Team
Builder) et `turn-timeline.css` (écarts et arrondi de portrait). Plus aucun `--spacing-*`/`--radius-*`
fixe dans le sous-arbre de l'interface de combat.

### ~~Infobulle d'attaque — modificateurs contextuels~~ — RÉSOLU (2026-08-27, plan 192)

L'infobulle affiche désormais la puissance et la précision **effectives** (fiche barrée, valeur réelle
colorée par son sens) avec leurs causes nommées, plus une mention de brûlure distincte. Calcul par
`resolveCasterMoveContext` dans le core, **source unique partagée avec la prévision de dégâts** — le
fichier `damage-context.ts` raconte lui-même qu'un calcul dupliqué avait déjà dérivé une fois.

Le périmètre suit un clivage précis, tranché avec l'humain : **tout ce qui ne dépend pas de la cible**
(météo, champ sous le lanceur, Chargeur, Coup d'Main, brûlure, morphe de move) va dans l'infobulle ;
ce qui dépend de la cible reste dans la prévision. C'est ce clivage qui rend le sujet faisable, là où
l'« efficacité contextuelle par move » avait été abandonnée le 2026-08-03 faute de cible de référence.

**Reste hors périmètre** : les **objets tenus** (Charbon, Magnet…). Ils sont bien indépendants de la
cible et entreraient dans le cadre, mais chacun est un cas à câbler ; le point d'extension est
`resolveCasterMoveContext`. Et aucun e2e ne vérifie encore le rendu sous météo (les deux suites
unitaires couvrent le calcul et la mise en mots).

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

### Décorations d'arène voxel (Phase 6)
- Pipeline Tiled `decorations.tsj` caduc → les décos passent par le **voxel** (`.glb`, cf occlusion déco résolue via voxel).
- Marquages d'arène : lignes (segments, coins, T, croisement) + pokeball centrale.
- **Peintures / blocs décorés** : motifs, dessins posés au sol / sur tuiles.
- ~~Décos environnement : herbe haute, arbres, rochers.~~ **Fait (2026-07-21)** — meshes voxel `.glb` + vent procédural, décision #690.

