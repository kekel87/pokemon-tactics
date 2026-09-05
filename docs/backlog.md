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

## Suivi

### Écart résiduel télémétrie vs compteur itch.io — à mesurer après redéploiement (2026-09-03)
- Incident du 2026-09-03 : itch.io comptait 2 « Browser Plays » du jour, 0 ligne en base D1. Deux correctifs, tous deux dans `docs/decisions.md` : (`#888`) `initTelemetry()` envoie la ligne `session` (`first: true`) au boot du bundle en plus de la fin de page — couvre les cas où le beacon de fin de page ne part jamais (bug WebKit sur `visibilitychange`, onglet tué par iOS, éviction du bfcache, iframe itch démontée), pas les fermetures pendant le chargement ; (`#889`) une balise de visite inline dans `index.html`, exécutée avant le téléchargement du bundle, couvre ce second cas.
- **EN LIGNE depuis le 2026-09-03** : les deux workflows relancés à la main (`workflow_dispatch`), runs verts — Pages [`33736940730`](https://github.com/kekel87/pokemon-tactics/actions/runs/33736940730), itch.io [`33736956366`](https://github.com/kekel87/pokemon-tactics/actions/runs/33736956366) (étiquette butler `v2026.8.2-telemetrie`, `main` étant en avance sur le tag `v2026.8.2`).
- **Chaîne vérifiée bout en bout le 2026-09-03** : la page servie par GitHub Pages porte bien la balise inline (build `v2026.8.2-25-g8e6c45c`, HEAD) ; un chargement réel a produit **une seule** ligne `session` `first: true` en base (`id=12`, `ghp`, Chrome 152/Linux/FR) — donc la balise inline part **et** la déduplication par `window.__pokemonTacticsVisitSent` empêche `initTelemetry()` de compter une seconde fois. ⚠️ Cette ligne `id=12` est **synthétique** (vérification), à défalquer si on compare finement le 2026-09-03. Le build itch.io porte la même balise : le plugin Vite `visit-beacon` est injecté sans condition et la plateforme est résolue au runtime par nom d'hôte (`itch.zone` → `itch`), indépendamment de `ITCH_DEPLOY`.
- Une fois redéployé : comparer sur quelques jours le nombre de lignes `session` (`first: true`) au nombre de « Browser Plays » du tableau de bord itch. Un écart résiduel pointerait vers le bloqueur de publicité côté joueur (cause historique de la cécité de Goatcounter, `#867`/`#881`) plutôt qu'un trou de câblage.

## Dette technique

<!-- Résolus 2026-08-27 : match nul sans chemin d'exécution (plan 191), repli anglais de `t()` sur les
     clés composées, `AuraRingKind` en union de littéraux, `tsconfig` excluant les `*.test.ts` des 8
     paquets (plan 193) → docs/backlog-archive.md. -->

<!-- Résolus 2026-08-29 (commit e9f23d1) : `__ptE2e__` survit à la destruction de sa scène,
     étiquettes de carte en français en dur, libellé de format d'équipe en français en dur →
     docs/backlog-archive.md. -->

### Cases à cocher du pied de l'écran de sélection d'équipe sous le plancher tactile (2026-09-04, plan 198)

`.claude/rules/html.md` pose un **plancher de 30 px sur la hit-area sous `pointer: coarse`**, arbitré
sur téléphone réel au plan 179. Les deux cases du pied de l'écran de sélection d'équipe
(« Placement auto », « Prévisualisation dégâts ») sont en dessous — **mesuré** au plan 198 :

| Viewport | Hit-area du `<label>` | Case native seule |
|---|---|---|
| 667 × 375 | 87 × **19** px | 13 × 13 px |
| 1920 × 1080 | 113 × **23** px | 13 × 13 px |

C'est le `<label>` qu'on mesure (il enveloppe la case **et** son texte, donc tout est tapable), et il
plafonne à la hauteur de ligne du texte. Aucune règle CSS ne cible `pointer: coarse` sur ces cases —
aucune ne cible les cases à cocher du tout dans le projet.

**Pré-existant** (« Placement auto » était déjà comme ça), mais le plan 198 en a ajouté une seconde,
donc l'écart est maintenant deux fois plus visible au doigt.

**Non corrigé volontairement** : porter la hit-area à 30 px grandit le pied d'écran de ~11 px, ce qui
mord sur la colonne des camps à 320 px de haut — c'est un changement de mise en page que l'humain doit
voir avant. À noter aussi que « Lancer ▶ » mesure **27 px** de haut au viewport le plus étroit, donc
le plancher n'est pas tenu uniformément ailleurs non plus : le sujet mérite une passe globale plutôt
qu'un correctif local.

### Segments de format du salon sous le plancher tactile, figés en 4K (2026-09-05, manque du plan 199)

`.claude/rules/multi-input.md` et `.claude/rules/html.md` posent un **plancher de 30 px sur la
hit-area sous `pointer: coarse`**. `.ts-segment` (`packages/app/src/styles/components/team-select.css:83`)
n'a pas de `min-height` — il se dimensionne au `padding` + `line-height: 1`, soit **26 px** partout.
Mesuré au chrome-devtools sur Chromium :

- **Tactile** : 26 px < 30 px à **568×320, 667×375 et 1024×768** — donc pas un effet de la media
  query « écran court », le défaut est constant.
- **4K** : les segments ne grandissent pas non plus. À 2560×1440, 26 px face à **50 px** pour
  « Créer une partie »/« Rejoindre »/« Retour » et **132 px** pour la roue de code. Capture :
  `.screenshots/lobby-segments-2560.png` (gitignoré).

Le composant est partagé (`FormatPicker`, `packages/app/src/ui/team-select/FormatPicker.ts`) — l'écran
de sélection d'équipe local porte le même défaut.

**Non corrigé volontairement** : hors du périmètre validé par l'humain pour la session du 2026-09-05,
et l'agrandir rejoue la mise en page d'un écran déjà serré en paysage téléphone.

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

### Carte aléatoire — option de sélection (2026-09-03, idée du frère de l'humain)
- Ajouter une entrée « Carte aléatoire » à la sélection de terrain : tire une carte de `MAPS_REGISTRY` au hasard au lieu de la choisir.
- Intérêt confirmé par le multijoueur : évite la négociation de carte entre deux joueurs (un système de vote a été évoqué puis écarté pour le Lot B1 — « on verra plus tard »).
- Portée : écran de sélection de terrain + salon en ligne (l'hôte peut poser « aléatoire », le tirage doit alors venir de l'hôte avec le reste du setup, jamais tiré deux fois).

### Éditer son équipe depuis le salon en ligne (2026-09-03)
- Pendant l'attente des autres joueurs, pouvoir ouvrir le Team Builder sans quitter le salon (aujourd'hui `SCREEN_TRANSITIONS` ne relie pas `team-select` à `team-edit`).
- Noté comme « peut-être plus tard » par l'humain pendant le cadrage du Lot B1 — hors périmètre B1.

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

