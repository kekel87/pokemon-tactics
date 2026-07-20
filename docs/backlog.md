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

_Aucune dette active._

<!-- Résolu 2026-06-12 (commit 30be7ee) : actions/checkout@v5, actions/setup-node@v5, pnpm/action-setup@v4, deploy-pages bumpés node24 dans ci.yml / deploy.yml / itch-deploy.yml. butler-to-itch bloqué à v1.3.0 (pas de release node24 dispo) — surveillé dans docs/next.md. -->
<!-- Résolu 2026-07-19 : Tag tooltip `superVsWater` hardcodé (plan 113) → tag dynamique `typeEffectivenessOverride` + i18n noms de types. Détails → docs/backlog-archive.md. -->
<!-- Résolu 2026-07-19 : Style dupliqué DOM↔Babylon — audit a montré que c'était en quasi-totalité du code mort (purgé), résidu vivant verrouillé par test de parité, centralisation complète écartée (sur-ingénierie). Détails → docs/backlog-archive.md. -->

## Notes IA (à regrouper en plan d'amélioration IA)

### IA — CT-aware scoring (2026-04-25)
- Scoring CT tenté plan 068, rejeté : `CT_REFERENCE_COST / ctCost` dans scorer greedy monoronde pousse moves moins puissants → combats >5000 tours dans tests de charge.
- **Nécessite lookahead multi-tour** (prédiction ordre CT, évaluation N tours). À planifier plan dédié IA.
- L'IA joue tours correctement en mode CT — problème = scoring stratégique, pas l'exécution.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Afficher effets terrain actifs sur tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051.

## Feedback visuel

### Boussole 3D — placement/échelle toujours imparfaits (2026-07-02, playtest plan 146)
- La boussole 3D always-on près du portrait actif (plan 145) a **toujours des problèmes de placement** signalés par l'humain lors du playtest stat-manip.
- Reliquat déjà noté (plan 145 § reporté : offsets fixes fragiles en changement de résolution, tuning à revoir avec le chantier zoom).
- Confirmé récurrent → à traiter pour de bon : ancrage dynamique (position relative au portrait/viewport, pas offsets fixes) + échelle indexée sur `--ui-scale` / résolution.
- À grouper avec le chantier caméra adaptative + zoom (ci-dessous) et le refacto unités CSS chrome.
- Priorité moyenne — cosmétique mais visible.

### MoveTooltip — afficher modifiers contextuels (météo, terrain, items) (2026-05-13)
- Ex : Blizzard "Prec 70 (100 en Neige)", Flamethrower "BP 90 (×1.5 en Soleil)", Thunder "Prec 70 (100 en Pluie, 50 en Soleil)".
- Étendre MoveTooltip pour calculer effective BP/accuracy selon `state.weather` et types caster/cible.
- Inclure aussi : effet Heat-Rock (durée étendue), Sun-instant Solar-Beam, etc.
- Priorité moyenne — qualité de vie UX, pas bloquant.

### Icône sandstorm — symbole tourbillon perfectible (2026-05-13)
- Icône actuelle acceptée provisoirement (plan 084).
- Symbole vent (double spirale) moins reconnaissable que les 3 autres pictogrammes (sun/rain/snow).
- À refaire ultérieurement à la main (Aseprite) avec un symbole plus lisible.

### Caméra adaptative selon taille de carte + bornes de zoom (2026-06-19)
- Comportement caméra dépend de la taille du jeu/carte : cadrage initial + amplitude pan/zoom calés sur dimensions de la grille.
- Limiter les niveaux de zoom : bornes min/max pour éviter zoom trop loin (carte minuscule) ou trop près (perte vue tactique).
- Piste : dériver min/max radius (et target) du bounding box de la map au boot de la scène.

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

### Bonus Cabriole ×2 sur Roulade / Ball'Glace (2026-07-04, human-testing plan 149)
- Canon : Cabriole (`defense-curl`) double la puissance de Roulade (`rollout`) et Ball'Glace (`ice-ball`) si utilisée avant, pour tout le reste du combat.
- État actuel : **non implémenté** — `defense-curl` ne pose que Défense +1 ; `rollout-streak.ts` / `DynamicPowerKind.RolloutStreak` ignorent Cabriole. Les deux moves sont cohérents entre eux (aucun bonus).
- À faire (passe dédiée) : flag `PokemonInstance.usedDefenseCurl?` posé par Cabriole (persistant, reset KO), consommé ×2 dans le calcul de puissance RolloutStreak (Roulade + Ball'Glace) + tests + tag tooltip. Hors périmètre plan 149 (famille lock-in).

### Trajectoire de vol (montées/descentes) pour les Flying Pokemon
- **Anim repos résolue (2026-04-26)** : Flying Pokemon restent en FlyingGlide au repos (idle, après dégâts, knockback). `PokemonSprite.setRestingAnimation()` + `playRestingAnimation()` injectés depuis `BattleScene` à la création.
- **Restant** : trajectoire déplacement sur dénivelés. Actuellement tween saut (`Hop`) comme autres. Avec FlyingGlide, arc parabolique plus compensé par frames. À traiter avec assets flying dédiés ou quand trajectoire semblera bizarre.
  - Piste : trajectoire 2-phase (rise-in-place → walk horizontal → drop) ou arc parabolique container Y.
  - Constantes `JUMP_TWEEN_DURATION_MS` déjà séparables par type.
