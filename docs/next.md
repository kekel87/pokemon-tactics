# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu via `/next`.

## État actuel (2026-07-18)

**Content-fill Gen 1 clos.** Phase 4 « mécaniques complexes » + son chantier IA (plans 159→160→161) + les 2 sessions content-fill (162 moves, 163 talents) sont tous terminés. Roster et pool Gen 1 désormais complets : **512 moves**, **114/114 talents**, **117/117 objets tenus**, **151/151 Pokemon jouables**, **203 OP sets**.

⚠️ **Garde-fou** : avant d'annoncer un reste (moves/talents/objets), toujours **recompter depuis la source réelle** (`abilityHandlers`, `tacticalOverrides`, learnsets du roster) — jamais un regex naïf, jamais un chiffre de doc figé. Des dérives passées (ex. faux « 115 talents » corrigé en 114) venaient de comptages approximatifs.

**Aucune nouvelle famille de mécanique Gen 1 à ouvrir.** La suite = une grosse phase ou une session polish (options ci-dessous, aucune n'est imposée — à trancher avec l'humain) :
- **Phase 6 — Maps & Éditeur (3D)** (`docs/roadmap.md`)
- **Phase 7 — Multijoueur**
- **Phase 8 — Équilibrage**
- **Polish / dette technique** — voir § Reporté / backlog technique ci-dessous (nombreux items non bloquants déjà identifiés)

## À faire maintenant

- **Refaire les 5 visuels README/wiki** (reporté 2026-06-16) : `docs/images/{demo.gif, maps-selection, battle-log, team-builder, team-selection}-screenshot.png` montrent encore l'ancien rendu Phaser. Captures auto Babylon (visual-tester) rejetées par l'humain → originaux conservés en attendant que l'humain les refasse à la main.
- **Choisir la prochaine grosse phase** (6/7/8) ou une session polish/dette technique — voir options ci-dessus. Pas de recommandation imposée.
- **Trancher le harness e2e IA** (`dummyControl: "scored"`) si on veut débloquer les tests e2e des heuristiques IA (plans 159/160/161) — voir détail dans § Reporté ci-dessous. Non bloquant, mais en attente depuis 2026-07-14.

## Reporté / backlog technique

### e2e Playwright manquants (non bloquants)

Core + renderer livrés et couverts en unit/intégration pour toutes les familles ci-dessous, mais aucun scénario e2e ne pilote encore l'UI. À ajouter via `test-writer` + `docs/test-plan.md` §5 quand jugé utile : Move-copy (144), Field global (145), Phazing (Cyclone/Hurlement/Projection), Stat/state manip (146), Sacrifice/Self-KO (147), OHKO (148), Lock-in multi-turn (149), Priorité/timing conditionnel (150, en cours via `test-writer`), Misc Batch A→E (151-155), objets tenus légers (158), Batch B-META Morphing/Imposteur/Métamorph (157, en cours via `test-writer`). **§5.17-20 physique terrain** (LoS/chute/glace) reste 👁 (couverture SENS unit core, cf. harness Phase 5).

- **Content-fill plan 162 (9 derniers moves Gen 1)** : réussite/fizzle standards couverts 🤖. Cas de RÉUSSITE exacts Relâche/Avale (dégâts/soin par palier de Stockage) et Stockage 3ᵉ palier restent 👁 (couverts unit/intégration) — débloquable en ajoutant `stockpileCount` à `SandboxConfig`.
- **Content-fill plan 163 (7 derniers talents Gen 1)** : 6/7 talents couverts 🤖. **Délestage** (`unburden`) reste 👁 — son effet (Vitesse ×2) ne se manifeste que via la portée de mouvement/l'ordre CT après une perte d'objet, aucun signal e2e déterministe propre sans exposer `unburdenActive` (ou un champ InfoPanel de vitesse effective) dans `SandboxConfig`.

### IA — heuristiques : e2e bloqué par le harness

Constat `test-writer` (2026-07-14) : le boot sandbox `?config=` câble `DummyAiController` (scripté, n'appelle jamais `scoreAction`) ; le vrai scorer ne tourne qu'en jeu normal avec PRNG non-seedé et équipes IA non-configurables → aucune assertion e2e déterministe possible pour les heuristiques des plans 159/160/161 (ring-out, faux-KO, self-KO, lock-in, priorité/timing, manip-talent, buff/statut, grille, field global, phazing, move-copy, stat manip, etc.). **Prérequis (feature harness, à décider avec l'humain)** : (1) mode `dummyControl: "scored"` dans `SandboxConfig` câblant `AiTeamController` ; (2) PRNG IA seedé depuis `config.seed` + profil déterministe (`randomWeight:0`/`topN:1`) en test ; (3) moveset IA configurable ; (4) équipe alliée à 2 avec allié KO de départ (pour tester Vœu Soin).

### OP sets restants (non bloquant)

203 OP sets couvrent l'essentiel des familles récentes (Batch A/C/D, Priorité/timing, Croc Fatal). Manquent encore, à évaluer via `data-miner` si besoin : Attraction (Batch D), Faux-Chage/Ruse/Anti-Air/Poursuite/Corps Perdu (Batch B). **Impossibles tant que Gen 1 est le seul roster** (0 learner Gen 1) : Vol Magnétik, Affilage, Cri Draconique, Yama Arashi, Dark Lariat, Bec-Canon, Carapiège, Par Ici, Poudre Fureur, Après Vous, Interversion — à revisiter en Phase 9 (Gen 2+).

### Reliquats signalés (non bloquants)

- **Field global (plan 145)** : (1) double zone Gravité superposée applique terrain+hazards 2× au même cast (`applyGravityGroundingOnCast`) — dédup par `occupantId` si le cas se présente ; (2) tuning position/échelle de la boussole 3D à revoir avec le chantier zoom ; (3) ancrage de la flèche Vent Arrière à affiner.
- **Retrofit immunité poudre Plante** (plan 155, signalé, non engagé) : Spore, Poudre Dodo, Para-Spore… ne gatent pas le type Plante aujourd'hui (gap découvert en implémentant Poudre Fureur, décision #640). À trancher séparément si jugé utile.
- **Gap Zone Magique / objets (plan 158)** : Zone Magique ne neutralise pas encore Pierrallégée/Poudre Vite/Cape Obscure/items-pièges (Bande Étreinte/Accro Griffe/Carapace Mue) — ces objets sont lus via `heldItemId` direct, hors du chemin `fieldGlobal`.
- **Surveillance playtest Mitra-Poing/Carapiège** (plan 150) : « trap moves » à risque d'échec élevé en formats multi-mons (3v3+, fenêtre de charge exposée). Rouvrir seulement si le playtest confirme un taux d'échec trop élevé.
- **Placement Ditto / Imposteur** (plan 157) : le placement au spawn influence quel ennemi Imposteur copie — question de design non tranchée.
- **Positionnement offensif/défensif pour le ring-out** (plan 159, Phase 2 différée) : manœuvrer exprès pour aligner ennemi/bord/soi + éviter de stationner en bord si un ennemi porte un move à recul — jugé puissant mais coûteux, différé.
- **Anomalies pré-existantes** (signalées par le plan 159, non corrigées) : test `magic-room`/Life Orb flaky (PRNG non seedé) ; `BattleEngine.getLegalActions` n'exclut pas un acteur qui vient de s'auto-KO au recul (garde `currentHp > 0` manquante).
- **Heuristiques IA objets légers (plan 158)** : 11 objets passifs, neutres pour l'IA — pas de contresens à corriger, priorité faible.
- **Heuristiques IA fines item-interaction (plan 142)** : Gaz Corrosif/Sabotage/Tour de Magie/Passe-Passe passent par le scoring générique `hasItemManip`, pas de bonus dédié — non bloquant, moves fonctionnels.

### Design — pistes à trancher plus tard

- **Réévaluer l'équilibrage de Tension** si des baies de soin en quantité sont ajoutées au pool d'objets (décision #561) — Tension bloque toutes les baies consommables ennemies, deviendrait très dominant.
- **Possessif étendu à toute l'arène** (décision #534) — actuellement Possessif ne scelle que les ennemis qui connaissent les mêmes moves. Piste d'équilibrage : étendre à tous les Pokémon présents (alliés inclus). À évaluer à l'usage.

### Infra / process

- **Migrer l'analytics vers backend first-party** — GoatCounter (plan 114) bloqué par les adblockers (`goatcounter.com` filtré par EasyPrivacy). Fix : endpoint `/analytics` sur notre propre domaine backend. À faire avec le futur backend matchmaking, pas avant.
- **Bump `Ayowel/butler-to-itch`** (workflow `itch-deploy.yml`) — bloqué à v1.3.0 (runtime node20) tant qu'aucune release node24 n'est publiée par le mainteneur. Bumper dès disponible.
- **Changelogs release trop verbeux** (feedback 2026-06-12) — raccourcir le format joueur : regrouper par catégorie sans énumérer chaque move + sa sous-puce. Appliquer dès la prochaine release.
- **Icônes officielles d'objets dans l'InfoPanel** (feedback humain 2026-06-27) — remplacer le texte `🎒 {nom}` par l'icône sprite officielle (chantier `asset-manager` : atlas d'icônes Gen 1, résolution id→icône). ⚠️ Multi en ligne : gater l'affichage de l'objet ennemi sur la révélation (information cachée) — à traiter avec le backend matchmaking.
- **Scaling assets Gen 2+** — chunk-by-génération du bundle sprites (`pack-sprites`) reste à implémenter quand on attaque Gen 2 ; architecture déjà prête (plan 135), indépendante du nombre de Pokemon.

### Idées en exploration (humain, rien d'engagé)

- **Décorations voxel** — remplacer les décorations billboards (rochers/arbres) par des assets voxel. **Assets stagés** (2026-07-19) : `tree.glb`/`tall_grass.glb` dans `packages/app/public/assets/decorations/`, lifts mesurés (tree 31/24, tall_grass 3/24). **Reste à faire : câblage renderer** (chantier séparé, pas fait) — cf `docs/references/voxel-tile-placement.md` §Décorations.
- **Éditeur de carte voxel in-app** — builder façon Goxel minimal (poser/remplacer/supprimer cube + asset), cartes « voxel based » avec tiles + déco + zones de spawn, vérificateur de conformité live. Abandon Tiled/`.tmj` → format maison JSON versionné. Note complète : `docs/ideas/voxel-map-editor.md`.

### Polish / dette technique (Jalon 3 rendu, non bloquants)

- Terrain : ~1500 draw calls (MultiMaterial + 6 SubMeshes par tuile, cube étiré). **Résorbé par la fondation voxel de l'éditeur (roadmap Phase 6, décision #682)** — blocs unitaires 24³ instanciés → ~10 draws. **Ne PAS optimiser `terrain-extruder.ts` maintenant** (sera remplacé, pas fusionné/optimisé).
- Consolider le loader Tiled (`resolveExternalTilesets` dupliqué 3×, `findProperty`/`resolveTileProperties` à exporter depuis `@pokemon-tactic/data`). **À revoir avec Phase 6** (format map custom 3D, décision #451/#682) : le parsing Tiled sera retravaillé/supprimé — ne consolider que si Tiled survit comme pont d'import. Pas de refacto maintenant.
- ~~`MultiMaterial` non disposées au reload de map~~ **Vérifié — non-problème (2026-07-20).** `terrain-extruder.ts` dispose via `root.dispose(false, true)` : Babylon récurse en propageant `disposeMaterialAndTextures=true`, et le cas `MultiMaterial` d'`AbstractMesh.dispose` appelle `material.dispose(false, true, true)` (`forceDisposeChildren=true`) → chaque MultiMaterial par tuile **est** disposée, sous-matériaux + textures inclus. De plus `extrudeTerrain` n'est appelé qu'1× (teardown de scène unique, aucun reload sur scène vivante). Note périmée, rien à corriger.
- Occlusion fine per-sprite pour les décorations (rochers/herbes/arbres objectgroup).
- Bonus plan 064 différé : marquages arène + pokéball centrale (`docs/plans/064-decorations-obstacles.md`).
- Plan 080 Token optimization : Phase 1+3 DONE, 2+4 partiel, 5 pending — décision restante humain (skills à désinstaller, validation `/cost` session fraîche).

### UI/UX en attente

- **Refacto unités CSS chrome : rem → `px × --ui-scale`** (validé humain 2026-06-12, option C) — gros refacto transverse (tokens.css + tous les composants chrome `styles/`). À faire en passe dédiée, pas en plein milieu des retours.
- **Recherche bilingue FR+EN dans le move picker** (souhait humain 2026-06-15) — taper un nom EN doit matcher l'entrée FR (ex. « ven » → venusaur). Noté `docs/test-plan.md` §7.2.
- Pistes best-practices overlay (non bloquantes) : (1) plancher font-size `max(calc(N·--px), Xpx)` zone 480-767px ; (2) modales `<dialog>` top-layer → publier `--stage-scale` sur `:root` via ResizeObserver (Jalon 4) ; (3) cap ultrawide optionnel `min(100cqw/1920, 100cqh/1080)` (décision design) ; (4) `--ui-scale` barres PV monde à brancher si besoin 4K.
- Mineur a11y placement-roster : `.pl-roster` sans heading (`<h2>`/`<section>` recommandé par `html.md`).
- Affichage nature dans InfoPanel — mécanique core livrée (plan 072), UI absente. Reprendre à la refonte InfoPanel globale.

### Décisions actées (pour mémoire, pas d'action)

- Jalon 3.5 pixel-art **ABANDONNÉ** (2026-06-10, décision #486) — 4 essais rejetés, rendu full-res conservé. Ne pas rouvrir sans décision humaine. Historique : `docs/babylon/babylon-pixel-art-pipeline.md`.
- Frustration/Retour mis de côté (inutilisables Gen 8/9, décision #423) ; Puissance Cachée exclue définitivement (0 learner côté Champions, confirmé 2026-07-11) ; Morphing/Imposteur/Métamorph livrés (plan 157, roster 151/151 complet).

## Fait récemment

- 2026-07-20 — Dette code mineure (review J4/J5) soldée : `dataset.scene` mort supprimé (2 écritures, 0 lecture), `SlotForRefresh`/`SlotState` dédupliqués (alias, dép ui→team), branche `teamId === null` morte retirée (type `team-edit` resserré à `string`), event funnel `TeamSelect` ajouté (team-select ne tire plus `TeamBuilder`). Les 3 mineurs J4 (`0x2255aa`, `TurnSystemKind`, `formatLabel`) étaient déjà résolus. Dette `MultiMaterial reload` vérifiée = faux (dispose via `forceDisposeChildren`, note périmée).
- 2026-07-20 — Dette technique résolue : harness dev Babylon jetable (`babylon-preview.ts` 426l + `team-edit-harness.ts`, branche `?preview=1` de `babylon-boot.ts`, `#hint`/`#pixinfo` d'`index.html`) supprimé. Caméra extraite dans une classe `IsometricCamera` (`packages/render-babylon/src/isometric-camera.ts`), `combat-scene.ts` délègue.
- 2026-07-20 — Dette test résolue : helper `damageTo(events, targetId)` dupliqué inline dans 36 fichiers `packages/core/src/battle/moves/*.test.ts` centralisé dans `packages/core/src/testing/damage-events.ts` (exporté via `testing/index.ts`). -458/+37 lignes, typecheck + 1545 tests unit verts.
- 2026-07-19 — Fix anim de repos des Volants selon le terrain (posé sur sol, vol sur eau/lave/glace… ; glace ajoutée aux fly-over) + hook e2e spriteStates. Reliquat transition de mode en déplacement (bug C) également résolu : bascule à mi-tween au lieu du départ du pas — bug de l'anim des Volants entièrement clos.
- 2026-07-19 — Auto-génération des 4 fichiers i18n de noms (moves + pokemon-names, fr/en) depuis reference dans build-reference.ts + test de synchro anti-drift. Fin de la classe de bug "nom manquant après batch". 104 moves legacy purgés.
- 2026-07-19 — Bug résolu : 51 pré-évolutions Gen 1 sans nom FR/EN → noms officiels ajoutés aux 2 fichiers i18n (source reference/pokemon.json). Roster i18n complet (152 clés).
- 2026-07-18 — **Plan 163 — Content-fill : 7 derniers talents Gen 1 (107 → 114, pool talents Gen 1 complet).** Récolte, Délestage, Piège Sable, Gaz Inhibiteur, Fouille, Prédiction, Anticipation. Décisions #673–#676.
- 2026-07-18 — **Plan 162 — Content-fill : 9 derniers moves apprenables Gen 1 (503 → 512, pool moves Gen 1 essentiellement complet).** Relâche/Avale (upgrade Stockage en vrai compteur de paliers), Prio-Parade, Piège de Venin, Rayon Lune/Aurore, Partage Garde, Métalaser, Grêle. Décisions #666–#672.
- 2026-07-14 — **Plan 161 — Passe IA Phase 3, clôt le chantier IA (159→160→161).** Stat/state manip, Buée Noire, Bain de Smog, Recyclage, Calcination, Attraction, Barrage/Regard Noir, Cognobidon valorisés dans `action-scorer.ts`. Toutes les familles d'heuristiques IA de la roadmap traitées.
- 2026-07-14 — **Plan 160 — Passe IA groupée Phase 2 (toutes les familles restantes en un plan).** Nouveau module `ai/move-reach.ts` + 8 primitives `threat-detection.ts`. Faux-KO/immunité transverse, Sacrifice/Self-KO, Lock-in, Priorité/timing, Dégâts-util, Manip-talent, Buff/statut, Grille, Field global, Phazing, Move-copy.
- 2026-07-14 — **Plan 159 — IA compétente sur « Le Mur » (ring-out par recul) + 5 heuristiques haut-impact + carte disponible.** Nouvelle carte « Le Mur » (16×16, mur pyramidal). Module `battle/knockback-prediction.ts`, `scoreKnockbackRingOut`, lookahead relief corrigé. OHKO/Malédiction/Transform/crit-manip/item-interaction valorisés. Décisions #660–#665.
- 2026-07-13 — **Plan 158 — Content-fill : 11 objets tenus légers + 2 talents ability1 silencieux (106 → 117 objets, 105 → 107 talents).** Bandeau, Griffe Rasoir, Poing Chance, Dé Pipé, Cape Obscure, Pierrallégée, Bande Étreinte, Accro Griffe, Carapace Mue, Poudre Métal, Poudre Vite + talents Fuite/Ramassage (no-op corrigés).
- 2026-07-12 — **Plan 157 — Batch B-META : Morphing / Imposteur / Métamorph (502 → 503 moves, roster 151/151 complet).** Morphing (Mew), Imposteur (talent, déclenche Morphing à l'entrée), Métamorph (Ditto) rejoint le roster. `PokemonInstance.transformState`. Décisions #647–#659.
- 2026-07-10 — **Plan 154 — Misc Batch D : buff/statut (490 → 496 moves).** Malédiction (ciblage conditionnel par type), Bâillement, Cognobidon, Acupression, Attraction, Vol Magnétik. Décisions #632–#638.
- 2026-07-07 — **Plan 152 — Misc Batch B : dégâts utilitaires (480 → 486 moves).** Faux-Chage, Croc Fatal, Ruse, Anti-Air, Poursuite, Corps Perdu. Décisions #625–#627.
- 2026-07-05 — **Plan 150 — Famille Priorité / timing conditionnel (469 → 475 moves).** Bluff, Escarmouche, Coup Bas, Mitra-Poing, Bec-Canon, Carapiège — priorité canon abandonnée, le CT ordonnance seul. Décisions #617–#620.
- 2026-07-04 — **Plan 149 — Famille Lock-in multi-turn (464 → 469 moves).** Mania, Danse Fleurs, Grand Courroux, Brouhaha (aura anti-sommeil), Ball'Glace, redesign Colère. Décisions #611–#616.
- 2026-07-04 — **Plan 148 — Famille OHKO / K.O. en un coup (460 → 464 moves).** Abîme, Guillotine, Empal'Korne, Glaciation — première mécanique de KO instantané. Décisions #607–#610.
- 2026-07-03 — **Plan 147 — Famille Sacrifice / Self-KO (454 → 460 moves).** Explosion, Souvenir, Tout ou Rien, Vœu Soin (premier revive du jeu), Lien du Destin, Rancune. Décisions #603–#606.
- 2026-07-02 — **Plan 146 — Famille Stat/state manip (444 → 452 moves).** Buée Noire, Boost, Bain de Smog, Renversement, Permugarde/Permuforce/Permuvitesse/Permucœur — première manipulation partagée des crans de stats. Décisions #595–#599.

**Historique antérieur (plans 093-145, sessions objets/talents mai-juin 2026, Phase 5 migration Babylon, Team Builder)** : voir `git log`, `docs/plans/`, `docs/implementations.md` pour le détail complet.

## Contexte prochaine session

**2026-07-18 — Content-fill Gen 1 clos.** Phase 4 « mécaniques complexes », le chantier IA (159→160→161) et les 2 sessions content-fill (162 moves, 163 talents) sont tous terminés. Roster + pool Gen 1 complets : 512 moves, 114/114 talents, 117/117 objets, 151/151 Pokemon jouables, 203 OP sets. **Prochaine session : choisir entre Phase 6 (Maps & Éditeur 3D), Phase 7 (Multijoueur), Phase 8 (Équilibrage), ou une session polish/dette technique** (§ Reporté / backlog technique ci-dessus). Aucune direction n'est imposée — trancher avec l'humain au démarrage de la session.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. Consulter si besoin de comprendre ce qui a été tenté en 2D iso avant le pivot Babylon.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. Item principal en premier.
- **Reporté** : `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : `- YYYY-MM-DD — ce qui a été fait`. Cap ~12-15, vire les plus anciens (historique complet = git log + docs/plans/).
- Mettre à jour fin de plan, fin d'étape significative, ou quand agent reporté.
- Item "À faire" → "Fait" : déplacer.
- Item "Reporté" impertinent : supprimer avec ligne dans "Fait".
