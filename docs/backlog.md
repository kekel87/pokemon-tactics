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

### Le match nul de combat n'a aucun chemin d'exécution (2026-08-27, plan 190)
- `checkVictory` (`packages/core/src/battle/BattleEngine.ts:3816`) est appelé **à chaque K.O. individuel** : le premier combattant qui tombe laisse l'autre camp seul vivant, `playersAlive.size === 1`, vainqueur déclaré et `battleOver = true` — le second K.O. de la même résolution arrive toujours trop tard. Mesuré : Explosion sur une cible à 1 PV, où le lanceur s'auto-K.O. dans la même résolution, produit « Joueur 1 gagne ! » au lieu d'un nul.
- Conséquence : `winnerId: null` est **inatteignable**, donc `battle.draw`, `battle.drawMessage`, `battleLog.battleEnded.draw` et la branche `<p class="bc-victory-message">` conservée par `showVictory` sont du **code mort de fait**. Le commentaire du core décrit pourtant ce cas (« une détonation de Requiem balayant les deux camps »). Aucun test du core n'assertait le nul non plus — `test-writer` a retiré son test plutôt que d'inventer un chemin.
- **Question ouverte, non tranchée** : soit `checkVictory` groupe les K.O. d'une même résolution et le nul devient réel, soit les trois clés et la branche de `showVictory` partent.
- Détail : `docs/plans/190-i18n-journal-de-combat.md` § 10.

### `t()` retombe sur l'ANGLAIS avant la clé brute — clés composées non couvertes par le type `Translations` (2026-08-27, plan 190)
- Le type `Translations` (clés littérales) garantit que `fr.ts`/`en.ts` portent les mêmes clés — mais une clé **composée à l'exécution** (ex. `battleLog.status.${status}.applied`) n'existe dans aucun type : si elle manque d'une seule locale, `t()` retombe sur l'autre locale (l'anglais) plutôt que sur la clé brute, donc un balayage « la sortie ne contient jamais `battleLog.` » ne la détecte pas. `test-writer` a dénombré **12 familles** composées dans le journal (pas les 6 qu'annonçait la note d'origine du plan).
- **Comblé pour le journal** par `packages/app/src/i18n/battle-log-keys.test.ts` (itère chaque valeur d'enum du core, exige la clé dans les deux locales, exige son absence pour les valeurs hors journal). La règle générale — tester une famille de clés composées ne se limite pas au typecheck — mérite d'être appliquée à toute future famille du même genre, dans l'app comme ailleurs.
- Détail : `docs/plans/190-i18n-journal-de-combat.md` § 10.

### `AuraRingKind` encodé en union de littéraux plutôt qu'en const-object (2026-08-19, plan 182)
- `packages/render-ports/src/ports.ts` déclare `export type AuraRingKind = AuraKind | "perish-aura" | "uproar"`, et les deux littéraux sont ensuite **répétés** comme clés dans `packages/view-core/src/constants.ts` (`AURA_RING_COLOR_BY_KIND`) et comme valeurs poussées dans `packages/view-core/src/aura-ring-view.ts` — 3 fichiers, pas de source unique. La convention du projet serait un const-object (`export const AuraRingKind = { ...AuraKind, PerishAura: "perish-aura", Uproar: "uproar" } as const`).
- **Laissé tel quel sciemment** : `ports.ts` livre déjà `BoardHighlight` et `AttackPreviewKind` en unions nues, donc l'encodage est cohérent avec son fichier. Signalé par `code-reviewer` (2026-08-19) comme non bloquant. À revoir si un 7ᵉ kind d'aura apparaît — c'est là que l'absence de source unique coûtera.

### `packages/*/tsconfig.json` exclut les `*.test.ts` du typecheck (2026-08-03, plan 178)
- Chaque `tsconfig.json` de package porte `"exclude": ["src/**/*.test.ts"]` : une erreur de type dans un fichier de test n'est jamais détectée par `pnpm typecheck`, seulement par Vitest à l'exécution (qui peut passer si la valeur mal typée fonctionne quand même au runtime).
- Constaté sur un `PresentationContext` de test devenu incomplet pendant le plan 178 (nouveaux champs `getStatusLabelUrl`/`translate` ajoutés, un mock de test non mis à jour n'a pas fait échouer le typecheck).
- Analogue au trou e2e (`e2e/` non typechecké) corrigé au plan 170 — même remède : retirer l'exclusion. **Mais l'ampleur a été mesurée (2026-08-03) et ce n'est pas un quick-win** : en retirant l'exclusion des 8 `tsconfig`, `tsc` remonte **~2000 erreurs**, réparties `core` 1978 · `ui-dom` 11 · `view-core` 7 · `app` 3 · les autres 0.
- **84 % viennent d'une seule cause** : 1662 `TS2561` du type « `currentPp` n'existe pas sur `Partial<PokemonInstance>` » — les tests du core posent un champ **fantôme**. (Cohérent avec le fait que les PP ne sont pas consommés en combat : ils ne servent qu'à calculer le coût CT.) Le nettoyage est donc mécanique mais touche des centaines de fichiers de test.
- Le reste (~330) est varié : mocks de `BoardView`/`BattleChrome`/`PresentationContext` désynchronisés de leur interface, `Object is possibly undefined`, littéraux incomplets.
- **Ordre suggéré** : (1) purger `currentPp` des tests du core, (2) traiter `ui-dom`/`view-core`/`app` (une trentaine, dont des mocks réellement périmés), (3) retirer l'exclusion et verrouiller. ⚠️ `packages/app/src/styles/tokens-parity.test.ts` importe `node:fs`/`node:path`/`node:url` : il faudra **ajouter `@types/node`** (aucun `@types/*` dans le projet aujourd'hui) — décision de dépendance à valider avec l'humain.
- **Déjà corrigé au passage (plan 178)** : `packages/app/src/team/__tests__/refresh-ai-teams.test.ts` — son type local `Slot` n'avait jamais suivi l'ajout de `ephemeral` à `SlotForRefresh`, ce qui cassait aussi l'inférence générique et masquait `label`. Exemple typique de ce que l'exclusion laisse pourrir.

<!-- Résolu 2026-07-21 : `ct-system.scenario.test.ts` capté par aucun projet vitest (jamais exécuté) → déplacé de `packages/core/src/battle/` vers `scenarios/` (convention unifiée, imports en alias `@pokemon-tactic/core`). 6/6 PASS. -->

<!-- Résolu 2026-06-12 (commit 30be7ee) : actions/checkout@v5, actions/setup-node@v5, pnpm/action-setup@v4, deploy-pages bumpés node24 dans ci.yml / deploy.yml / itch-deploy.yml. butler-to-itch bloqué à v1.3.0 (pas de release node24 dispo) — surveillé dans docs/next.md. -->
<!-- Résolu 2026-07-19 : Tag tooltip `superVsWater` hardcodé (plan 113) → tag dynamique `typeEffectivenessOverride` + i18n noms de types. Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-19 : Style dupliqué DOM↔Babylon — audit a montré que c'était en quasi-totalité du code mort (purgé), résidu vivant verrouillé par test de parité, centralisation complète écartée (sur-ingénierie). Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-21 : IA — CT-aware scoring (plan 165). Détails → docs/backlog-archive.md. -->

## Notes IA (à regrouper en plan d'amélioration IA)

## Feedback visuel

### Valeurs fixes restantes sous une police mise à l'échelle — menu d'actions et timeline (2026-08-27, revue de code du plan 190)

Le plan 190 a mis à l'échelle toute la garniture de `battle-chrome.css` (jetons `--bc-pad-*` /
`--bc-radius-*` sur `:where(.bc-root, .bc-left-col)`) puis, sur décision humaine, celle de
`move-tooltip.css`. **Deux feuilles stylent encore des descendants DOM de ce sous-arbre avec des
valeurs fixes**, décision humaine du 2026-08-27 de s'arrêter là (leur écart est nettement moins
visible que celui de l'infobulle) :

- `packages/app/src/styles/components/button.css:13` — `.tb-btn` garde `border-radius:
  var(--radius-sm)` = **4px fixe**. En 4K le panneau qui le contient (`.bc-menu`) est à 12px et les
  lignes d'attaque (`.bc-move-item`) à 8px : les lignes du menu d'actions restent à 4px, dans le même
  panneau. **L'écart est aggravé par le plan 190** (6 vs 4 avant, 12 vs 4 après). ⚠️ Ne PAS éditer
  `.tb-btn` en place : il est partagé avec le Team Builder, qui doit rester sur son propre système.
  Le correctif est un sélecteur ciblé `.bc-menu .bc-btn` dans `battle-chrome.css`.
- `packages/ui-dom/src/styles/turn-timeline.css:54,103,131,186` — vignettes mises à l'échelle
  (`--tt-size`) mais écarts **4/4/6px** et arrondi de portrait **4px** fixes.

Purement pixel, donc hors portée e2e — à juger à l'œil sur grand écran.


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

### Décorations d'arène voxel (Phase 6)
- Pipeline Tiled `decorations.tsj` caduc → les décos passent par le **voxel** (`.glb`, cf occlusion déco résolue via voxel).
- Marquages d'arène : lignes (segments, coins, T, croisement) + pokeball centrale.
- **Peintures / blocs décorés** : motifs, dessins posés au sol / sur tuiles.
- ~~Décos environnement : herbe haute, arbres, rochers.~~ **Fait (2026-07-21)** — meshes voxel `.glb` + vent procédural, décision #690.

