# Roadmap — Pokemon Tactics

> Phases de développement du POC au jeu complet.
> Roster limité : 151 premiers Pokemon (Gen 1) — décision #92.

## Ce qui est fait

Le détail de chaque phase close (tâches, arbitrages, dates) vit dans le graphe de mémoire du projet.
Pour l'ouvrir : `node scripts/memory/query.mjs --open <entité>`. Ci-dessous l'essentiel.

| Phase | Ce qu'elle a apporté | Entité du graphe |
|---|---|---|
| **Phase 0 — Prototype technique (POC)** | valider la stack, avoir un combat jouable minimaliste | `roadmap-phase-0-prototype-technique-poc-terminé` |
| **Phase 1 — Combat fonctionnel** | combat complet et varié, jouable en hot-seat, avec assez de Pokemon pour tester toutes les mécaniques | `roadmap-phase-1-combat-fonctionnel-terminé` |
| **Phase 2 — Démo jouable** | lien partageable, quelqu'un joue seul contre l'IA et s'amuse | `roadmap-phase-2-démo-jouable-terminé` |
| **Phase 3 — Terrain & Tactics** | la vraie profondeur tactique — le terrain change le jeu | `roadmap-phase-3-terrain-tactics-terminé` |
| **Phase 4 — Gameplay Pokemon complet** | couvrir toutes les mécaniques Pokemon, ajouter profondeur stratégique | `roadmap-phase-4-gameplay-pokemon-complet-terminée-cont` |
| **Phase 5 — Migration renderer 2D-HD (Babylon.js)** | le rendu actuel : terrain 3D + sprites 2D billboardés, moteur Babylon.js | `roadmap-phase-5-migration-renderer-2d-hd-babylonjs-ter` |
| **Phase 6.5 — Client jouable : contrôles & UI** | un client jouable au doigt, au clavier et à la manette (manette sur téléphone comprise) — le seul retour de vrais joueurs était « injouable sur mobile » | `roadmap-phase-65-client-jouable-contrôles-ui-terminée` |

## Ce qui vient

> **Où on en est** : la **Phase 7 — Multijoueur** est **close** côté développement (2026-09-10,
> plan-cadre 195) ; sa **release reste en attente, hors file, jamais tranchée**. La file de sessions
> dédiées qui a suivi la clôture est **VIDE** (5/5 faites) — entité `agenda-2026-09-10-file-de-sessions-dediees` :
> session 1 (plan 204, télémétrie des parties en ligne), session 2 (sélecteur e2e
> `scripts/e2e-affected.ts` — cadrage `--since-main` au lieu de `HEAD`, garde contre une famille de
> specs muette), session 3 (plan 205, le retour du navigateur remonte d'un écran au lieu de quitter
> le jeu — solde `backlog-retour-navigateur-non-gere`), session 4 (plan 206, passe tactile globale
> du plancher de 30 px — `--target-min` devient un réglage unique dans `tokens.css`, solde les
> segments de format et les cases du pied de la sélection d'équipe) et session 5 (cadrage avec
> l'humain du lobby et de l'écran « partie introuvable » — deux plans `ready` :
> `docs/plans/207-lobby-rhabillage-et-refus.md`, `docs/plans/208-carte-en-modale.md`).
> **Le plan 207 est livré** (2026-09-11, commit `3900a33`) : écran « Jouer en ligne » rhabillé, refus
> de rejoindre visible avant navigation, et patron « écran plein » partagé extrait au passage.
> **Prochaine étape : implémenter le plan 208** — deux arbitrages humains en préalable (télémétrie,
> carte par défaut), voir entité `agenda-prochaine-etape-courante`.
> Les autres sections ci-dessous sont ouvertes, dans un ordre qui n'est pas figé.

### Post-Babylon — petits chantiers de rendu

> Lot enchaîné juste après l'intégration de Babylon (Phase 5). **Presque entièrement livré** : ne
> restent ouverts que les points non cochés (ombres dynamiques, textures de terrain). Les lignes
> cochées sont conservées pour le contexte des choix de rendu.

- [x] **Fixer `doc-keeper` qui ne respecte pas les worktrees** — règle dure « chemins relatifs uniquement, jamais absolu » ajoutée en tête du prompt (l'agent n'a pas Bash → ne peut résoudre la racine ; chemin absolu codé en dur = fuite vers repo principal).
- [x] **Optimiser Vitest** (2026-06-17) — suite unit **~50-75s → ~4,5s (≈10-15×)**. Projet `unit` : `isolate: false` (gros levier, core pur sans mocks/état global), `pool: "threads"`, `experimental: { fsModuleCache: true }` (+ cache `actions/cache` en CI). Couverture inchangée (seuil core 100% tient). `viteModuleRunner: false` testé mais **incompatible** (Node natif ne résout pas nos imports TS sans extension) → écarté.
- [x] **Mettre à jour les dépendances** (2026-06-17) — Vite 8.0.16 (2 RCE dev-server + XML fast-xml-parser fermés), Vitest 4.1.9, Playwright 1.61, sharp 0.35.1, tsx 4.22.4, Biome 2.5.0 (config migrée `recommended`→`preset`), visualizer v7 + `engines node >=24`, **TypeScript 6.0** (retrait `baseUrl`, paths `./`), **Babylon.js 9.12.1** (validé visuel : placement glTF + rendu combat). 4 commits par phase, gate complet entre chaque.
- [x] **Intégrer le curseur voxel** (2026-06-17) — curseur de sélection remplacé par un modèle voxel `.glb` (`cursor.glb`, voxigen.io) au-dessus du Pokemon, mécanique de switch de variantes supprimée.
- [x] **Drop le mode tour par tour (round-robin)** — ne garder que le Charge Time ; retirer le toggle + le code RR. *(plan 128, 2026-06-17)*
- [x] **Aligner les couleurs des previews de pattern d'attaque** (2026-06-17) — cohérence tooltip ↔ zones au sol (rouge attaque, vert soin, jaune dash) via helpers partagés `moveIntent`/`selfPreviewRadius`.
- [x] **Dash — direction seule, portée auto** (2026-06-18) — confirmation par direction survolée, portée auto (le moteur s'arrête au premier obstacle), rebalance des portées + Roulade snowball.
- [x] **POC Cobblemon — CLÔTURÉ (2026-06-18)** — chaîne 3D (terrain voxel + modèles Cobblemon GLB) explorée bout-en-bout sur la branche `poc-cobblemon` (jamais mergée). **Rejet esthétique → on reste en 2D-HD sprites.** Archive : branche `poc-cobblemon` + graphe, entité `plan-129`.
- [ ] **Ombres / lumière dynamiques (voxel + Pokemon)** — chantier rendu lié au **2D-HD**. Aujourd'hui tout est flat unlit (StandardMaterial sans lumière) + ombres bakées (`Shadow.png` PMD pour les sprites, rien pour les props voxel comme Pièges de Roc / futures décos). À décider : (a) **ombres blob/decal** stylisées sous chaque voxel (cohérent FFTA, coût ~0, voie recommandée) **vs** (b) **`ShadowGenerator` réel** (1 `DirectionalLight`, casters voxel, terrain receiver — vrai dynamique mais perf + clash avec le flat + sprites ALPHATEST capricieux comme casters). **Regarder comment font les refs 2D-HD** (Octopath, Triangle Strategy, FFTA…) au moment d'attaquer ce point. `best-practices` d'abord. Voir `docs/babylon/`.

#### Polish visuel 2D-HD — idées en vrac (2026-06-19)

> Lot d'idées rendu notées d'un coup. Voxelisation des props + retravail textures/eau/auras. Pas priorisé, à attaquer 1 par 1. `best-practices` + refs 2D-HD avant chaque chantier non trivial.

- [x] **Herbe haute en voxel** (2026-07-21) — déco herbe haute désormais un mesh voxel `.glb` (`tall_grass.glb`), rendu via `babylon-decorations.ts`. Décision #690.
- [x] **Rochers en voxel** (2026-07-21) — rochers 1×1 et 2×2 passés en props voxel (`rock-1x1x1.glb`, `rock-2x2x2.glb`). Décision #690.
- [x] **Arbres en voxel** (2026-07-21) — arbre passé en prop voxel (`tree.glb`). Décision #690.
- [x] **Mouvement herbe haute + arbres** (2026-07-21) — vent procédural via `decoration-wind-plugin.ts` (déplacement de sommets pondéré par la hauteur, base figée). Cf. `docs/babylon/`.
- [x] **Auras — un « rond » par aura qui se stack** (2026-08-19) — anneaux voxel permanents (contour de zone en escalier, section 1 voxel, empilés en Y au pas de 2 voxels, une teinte par aura) remplacent les émoji au survol. Requiem et Brouhaha intégrées, Brouhaha gagne son premier rendu. Plan 182, décisions #753–#757.
- [x] **Eau & liquides** (2026-07-21) — transparence + cuvette + immersion des sprites + écume de flottaison + tuiles standardisées demi-bloc. Plan 166, décisions #691–#697. Voir `docs/design-system.md` §Liquides.
- [ ] **Textures terrain — retravail** :
  - transitions entre types de terrain (blend / bords).
  - variations de texture sur un même type (casser la répétition).
  - [x] animation (eau, lave, magma, marais…) (2026-07-23) — `LiquidShimmerPlugin` (procédural : lueur/scintillement/ondulation), pas du palette-cycling. Décision #707. Voir `docs/design-system.md` §Liquides.

---

### Phase 6 — Maps & Éditeur (3D)

> **Position actuelle : après Phase 3.5** (reordonnée 2026-04-20, donc post-Phase 7).
>
> But : contenu varié, roster de maps équilibré, outils de création.

Tie à Babylon : éditeur et props terrain repensés pour renderer 3D.

> **Note 2026-04-20** : *Choix maps UI*, *Roster maps variées* et *génération IA* remontés en Phase 3 — ne dépendent pas de Babylon. Seul l'éditeur in-game reste ici.

#### Vision éditeur — voxel « Minecraft créatif » (validée 2026-07-20)

La carte au centre, une palette de blocs + décorations sur le côté ; on pose / enlève à la souris.

- **Bloc = unité de base** : cube **24×24×24 px** (= taille des textures PMD), 1 bloc = 1 unité de hauteur monde.
- **Relief par empilement** de cubes unitaires (façon Minecraft), **pas** d'étirement d'un cube. Rupture avec le `tile.height` flottant actuel.
- **Chaque variation de texture / prop = un nouveau bloc** dans la palette (pas de paramètre réglable sur un bloc existant).
- **Décorations** = entités posables séparées, réutilisent le pipeline voxel `.glb` existant (herbe haute, rochers, arbres, hazards — cf. `docs/babylon/`).

##### Conséquences techniques (à trancher au démarrage de la phase)

- **Modèle données terrain** : `tile.height` (hauteur flottante extrudée) → **pile de blocs unitaires** par case (colonne, voire grille 3D). Le core continue de ne voir qu'un `MapDefinition` (hauteur dérivée du nombre de blocs empilés).
- **Rendu = instances** (thin instances Babylon) : 1 cube modèle par type de bloc, une instance par bloc posé. Poser / enlever = ajouter / retirer une instance. Résout **gratuitement** la dette « ~1500 draw calls terrain » (blocs uniformes → plus de piège d'UV de flanc, ~10 draws). Cette dette est consignée dans le graphe, entités `agenda`.
- **Picking** : `thinInstanceIndex → (x, y, z)` — nécessaire pour l'éditeur (poser / enlever) **et** le gameplay (sélection de tuile). Remplace le `mesh.metadata {x,y}` par box actuel.
- `packages/render-babylon/src/terrain-extruder.ts` actuel (cube étiré + `MultiMaterial` 6 submeshes / tuile) sera **remplacé**, pas optimisé.
- **Recherche avant de coder** : regarder les éditeurs voxel / loaders type Minecraft/Cobblemon existants (réf. mémoire « research avant réinventer ») + `best-practices` sur le rendu instancié Babylon.

- [ ] Éditeur de terrain in-game voxel (palette de blocs + décorations, empilement hauteur, spawns), rendu instancié, picking (x,y,z)

---

### Phase 8 — Équilibrage

> But : outils pour tester et équilibrer avant d'ouvrir le multi

- [ ] Mode headless + outils d'équilibrage — **prérequis** : déplacer `.tmj` dans `packages/data/src/maps/tiled/` et ajouter `loadMapDefinition(id)` Node-compatible. Aujourd'hui maps dans `packages/renderer/public/` chargées via `fetch()` HTTP — inutilisable sans browser.
- [ ] LLM vs LLM (Claude adversaire) (risque d'être cher maintenant)
- [ ] AI vs IA (+nouveau de difficultés) + reporting équilibrage
- [ ] Passes d'équilibrage

---

### Phase 7 — Multijoueur (en cours)

> But : jouer contre de vrais adversaires
>
> **Cadrage arrêté le 2026-08-29** (passe de préparation, aucun code écrit) : **P2P WebRTC via PeerJS,
> zéro backend** — la mention « WebSocket » qui figurait ici contredisait la décision #209 et était un
> reliquat d'avant. Détail complet et raisonnement : **[multiplayer.md](multiplayer.md)**, décisions
> #862-870. **Plan-cadre de la phase** : `docs/plans/195-phase7-multijoueur-telemetrie.md` (lots, ordre,
> risques et décisions ouvertes).
>
> **Phase DÉMARRÉE le 2026-09-02** par le Lot A (télémétrie), **clos le même jour** — Worker en ligne
> (`https://pokemon-tactics-telemetry.kekel87.workers.dev`), collecte vérifiée en production sur
> itch.io et GitHub Pages, relevé live protégé par mot de passe (`GET /tableau`), `pnpm stats` pour
> l'équilibrage, Goatcounter retiré du bundle. **Lot C (écran de victoire enrichi) livré et validé le
> 2026-09-03** (plan 197). **Lot B1 (transport, salon, lancement accusé) livré le 2026-09-04** (plan
> 199, décisions #895-912) : deux navigateurs se trouvent par un code et entrent en combat avec un
> état identique. **Lot B2 (combat en réseau) livré et validé à la main le 2026-09-08** (plan 201) :
> un 1v1 complet se joue de bout en bout entre deux navigateurs, jusqu'à l'écran de victoire, sur le
> service public de PeerJS. **Lot B3 (robustesse) livré le 2026-09-09** (plan 202) : chronomètre de
> tour, chien de garde de connexion, reconnexion d'un pair (hôte compris) et abandon volontaire,
> validés en recette humaine et par `code-reviewer`/`core-guardian`. **Lot B4 (détection de désync)
> codé le 2026-09-10** (plan 203) : somme de contrôle de l'état à chaque action, forfait sur
> divergence, sans reconstruction. `docs/plans/195` reste `in-progress` : restent l'e2e à deux
> contextes, le cahier de recette et la recette humaine du Lot B4.

**Ce qui est déjà prêt** : replay et déterminisme verrouillés (plan 181), port de persistance (#751),
hot-seat N joueurs avec `humanPlayerIds` (plan 188) — le tour distant se greffe là où le tour hot-seat
existe déjà.

**Ce qui est écarté et ne reviendra pas sans nouvelle décision** : serveur autoritaire, Supabase
(mise en pause au bout de 7 jours), matchmaking, fog réel en ligne (#863), classement compétitif
(#870).

- [ ] **Télémétrie de jeu** — Cloudflare Workers + D1, remplace Goatcounter (faussé par les bloqueurs).
      Usages seulement : parties jouées, Pokemon et attaques les plus joués, taux d'abandon.
      **Indépendante du réseau et déjà utile en solo** → première tranche livrable de la phase
      (#867, #868, #870). **QUASI CLOSE (2026-09-02)** : étapes 0-5, 7, 8/9 du plan 196 livrées —
      Worker en ligne (collecte `POST /e` vérifiée en production itch.io + GitHub Pages), relevé live
      protégé par mot de passe (`GET /tableau`), `pnpm stats` pour l'équilibrage Phase 8, Goatcounter
      retiré du bundle (compte pas encore fermé). Étape 6 (vérification en production) **partielle** :
      aucune partie menée jusqu'au bout, l'événement `battle_ended` reste non éprouvé — détail dans
      le graphe, entités `agenda` et `plan-196`
- [ ] **Multijoueur réseau P2P** — lobby (`ScreenId` neuf), protocole d'actions, validation,
      détection de désync (sérialisation canonique livrée, plan 203), chronomètre local
      auto-déclarant (#864, #865), reconnexion par le chemin du plan 181. **Viser le 1v1**, retester le FFA à 12
      ensuite. **Lot B1 (transport et salon) LIVRÉ le 2026-09-04** (plan 199, paquet
      `packages/network/`, décisions #895-912) : code de partie, écran `lobby`, salle d'attente,
      lancement accusé, trois graines partagées (combat/placement/IA). **Lot B2 (combat en réseau)
      LIVRÉ et validé à la main le 2026-09-08** (plan 201) : tour distant greffé sur `humanPlayerIds`,
      validation de chaque action reçue contre `getLegalActions()`, barème 1er/2e/3e refus (avertir
      puis forfait), forfait dans le core (`BattleEngine.forfeit`). Réseau restreint au **1v1** — le
      garde-fou d'index suppose un canal ordonné, vrai par connexion mais pas à trois camps et plus.
      **Lot B3 (chronomètre, reconnexion, abandon) LIVRÉ le 2026-09-09** (plan 202) : chronomètre de
      tour local auto-déclarant (60 s), chien de garde de connexion distinct (75 s puis 30 s),
      admission d'un revenant dans un salon verrouillé (hôte compris — asymétrie de qui compose
      corrigée par `scheduleHostRedial`), rattrapage du journal manqué, abandon volontaire propagé
      aux deux pairs. **Lot B4 (somme de contrôle de désync) CODÉ le 2026-09-10** (plan 203) :
      empreinte de `BattleState` à chaque action, forfait sur divergence sans reconstruction ;
      restent l'e2e à deux contextes et la recette humaine
- [x] **Écran de victoire enrichi** — sans dépendance réseau, garde sa place ici : même matière que
      l'événement `battle_ended` de la télémétrie (durée, tours, camp vainqueur). **LIVRÉ ET VALIDÉ
      (2026-09-03, plan 197)** : rangée de portraits de l'équipe du vainqueur (K.O. grisés) + « N tours ·
      M min ». Périmètre réduit avec l'humain (#890) : **pas de MVP** (aucun événement du core ne nomme
      l'attaquant), **pas de camp perdant**, **pas d'infobulle de cause de K.O.** (inaccessible au
      clavier/manette)
- [→] ~~Speed controls (skip/accélérer animations)~~ **déplacé en Phase 9 — Polish** (2026-08-31, plan-cadre 195) :
      aucun lien avec le réseau ni la télémétrie, jamais cadré depuis son ajout du 2026-04-02
- [→] ~~Tutoriel interactif~~ **déplacé en Phase 9 — Polish** (2026-08-31, plan-cadre 195)
- [ ] *Si besoin, après la V1* : signaling maison et relais de secours NAT sur Durable Object (#869)
- [→] ~~Support manette~~ **déplacé en Phase 6.5 — Client jouable (Lot 2)** (2026-07-24)

---

### Phase 9 — Polish

> But : confort et qualité visuelle

- [→] ~~UI revamps~~ **déplacé en Phase 6.5 — Client jouable (Lot 3)** (2026-07-24)
- [x] **CSS modulaire Team Builder + `<dialog>` natif + HTML a11y** — livré plan 085 polish 2026-05-18. `packages/renderer/src/styles/` 12 modules (@layer, tokens, `<dialog showModal()>` natif, slot cards `<button>`, aria-label i18n, lazy loading, bugfix `@layer reset`). Rules `.claude/rules/css.md` + `.claude/rules/html.md`. Décisions #321-325.
- [ ] **Biome HTML/CSS lint** — Biome v2.4 gère HTML formatter + CSS formatter. Étendre `biome.json` : `files.includes` += `**/*.{css,html}`. ~~Activer `linter.rules.a11y.recommended: true`. Optionnel : audit Axe + Lighthouse.~~ **Lint/audit a11y non activés** (2026-08-19, décision #752) — support lecteur d'écran abandonné, `biome.json` garde `a11y.preset: "none"`. Optionnel : `stylelint-plugin-use-baseline`.
- [ ] Son / Musique
- [ ] **Speed controls** — configurer la vitesse des déplacements, passer les animations d'attaque.
      **Rapatrié de la Phase 7** (2026-08-31, plan-cadre 195). ⚠️ Les animations d'attaque n'existent pas
      encore ; les durées sont des constantes centralisées (`render-babylon/src/constants.ts`) et le point
      d'accroche UI existe (`settings-panel.ts`, monté par l'écran de paramètres **et** le menu de combat)
- [ ] **Tutoriel interactif** — **rapatrié de la Phase 7** (2026-08-31, plan-cadre 195)
- [ ] Décors sur les maps
- [→] ~~Tooltips type chart (efficacités au hover)~~ **déplacé en Phase 6.5 — Client jouable (Lot 3)** (2026-07-24)
- [ ] Auto-save localStorage

---

### Phase X — Social & Partage

> But : features qui donnent envie de partager et revenir

- [ ] Share replay via URL + lecteur de replay
- [ ] Défi du jour (seed quotidienne, même combat pour tous)
- [ ] Screenshot de fin de combat partageable

---

### Phase X — Futur / À voir

- [x] **🔧 Retrait du mode de tours round-based + système de PP** — livré plan 128 (2026-06-17). CT seul (`TurnSystemKind`/`TurnManager` supprimés, `activePokemonId` remplace `turnOrder[]`+`currentTurnIndex`). `roundNumber` supprimé (event + HUD + dédups `weatherLastTickRound`/…). PP usage retiré (`currentPp`, `NoPpLeft`, décrément) — `MoveDefinition.pp` conservé pour le coût CT. Modèle de durée « tours du lanceur » + horloge fantôme. Décision #517.

- [x] **Roster Gen 1 complet — plan 135 terminé 2026-06-20.** +70 pré-évolutions → **150 Pokemon jouables** (tous Gen 1 sauf Métamorph/Ditto). Movepool dérivé auto (learnset ∩ moves implémentés). Pipeline sprites refondu : bundle 3 fichiers (`sprites.bin` + `sprites-manifest.json` + `portraits.png`), mur itch.io résolu, dist ≈ 120 fichiers. Décisions #539–#543.
- [ ] **Générations 2-9** — ajout des 874 Pokemon restants (Gen 2 : 100, Gen 3 : 135, Gen 4 : 107, Gen 5 : 156, Gen 6 : 72, Gen 7 : 88, Gen 8 : 96, Gen 9 : 120). Sprites PMDCollab disponibles pour la majorité. Nécessite pipeline `sprite-config.json` étendu + movesets tactiques par Pokemon.
- [ ] **Méga-Évolutions** — 21 formes Méga Gen 1 (16 officielles + 5 exclusives Pokémon Champions). Sprites PMDCollab : 6 formes ont des fichiers partiels (pending review), aucune complète en mai 2026. À replanifier quand PMDCollab coverage s'améliore. Détail dans le graphe, entité `méga-évolutions-gen-1`.
- [ ] **Mode aventure / overworld FFTA (vision — idée 2026-06-19)** — carte d'exploration façon Final Fantasy Tactics / FFTA, distincte du combat tactique. Garde-fou : pas d'écriture d'un scénario complet ni d'un monde sur-mesure (temps/énergie limités) — on s'appuie sur l'univers Pokemon existant.
  - **Déplacement overworld** : on déplace son perso sur la carte exactement comme FFT/FFTA (sprites Pokemon en mouvement overworld FFTA, pas le rendu combat).
  - **Rivals** : les rivaux se baladent sur la carte (entités mobiles overworld).
  - **Rencontres aléatoires** : dresseurs & Pokemon sauvages aléatoires sur les « tick/sections » de route entre deux points.
  - **Villes** : champions d'arène, boutiques, events.
  - **Périmètre de départ** : une région — **Kanto** pour commencer. Pas fermé à l'idée d'une **méga-carte mondiale** reliant toutes les régions Pokemon à terme.
- [ ] Conditions de victoire alternatives
- [ ] Draft/ban phase
- [ ] Effets visuels (particules, ombres, lumières, attaques)
- [ ] **Modification dynamique du terrain par attaques** — certaines attaques transforment terrain pendant combat (Feu → supprime tall grass, Ébullition crée tiles lave/magma, Force déplace rochers, Glace gèle tiles eau). Mutation runtime `TerrainType` + décoration associée. Reporté Phase 3 en 2026-04-20 : scope trop lourd tant que roster attaques et palette terrains pas figés.
- [x] **Météo (Soleil, Pluie, Tempête de Sable, Neige) — plans 084 + 084b terminés 2026-05-13.** Livré en Phase 4 (débloqué par roster Gen 1 complet + OP sets). Sand-veil, swift-swim, chlorophyll activés. Synthèse contextuelle. Solar-Beam 2-turn. Heat-Rock 8 tours. Cloud Nine supprime effets.
- [x] **Champs (Herbeux, Électrique, Brumeux, Psychique) — plans 117 + 118 terminés 2026-06-08/09.** Livré en Phase 4. Système `FieldTerrain` zones Manhattan r3, multi-zones coexistantes, 4 poseurs + 7 moves dépendants (B4 10/10).
- [x] **Distorsion (`trick-room`) — plan 130 terminé 2026-06-18.** Livré en Phase 4. Zone statique Manhattan r3, inversion CT par vitesse en entrée (`max(1, 160 − baseSpeed)`), 5 tours lanceur + horloge fantôme. 2 OP sets. 394 moves.
- [ ] **Modèles 3D pour les Pokemon** — remplacer sprites billboards 2D par modèles 3D (glTF/GLB) style Pokemon Champions / Stadium. À évaluer après stabilisation renderer Babylon.
