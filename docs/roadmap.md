# Roadmap — Pokemon Tactics

> Ce que le jeu peut encore devenir. Roster : 151 premiers Pokemon (Gen 1) — décision #92.
>
> **Le raisonnement vit dans le graphe, pas ici.** Ce document liste *quoi*, avec juste assez de
> contexte pour décider ; le *pourquoi* s'ouvre avec `node scripts/memory/query.mjs --open <entité>`.

## Où on en est

**Phase 7 — Multijoueur sortie le 2026-09-16 en `v2026.9.1`.** Jeu en ligne P2P, 2 à 12 joueurs, sans
compte. → graphe : `release-v2026.9.1`, `plan-195`.

14 jours de production (plan 212) : **36 visites · 22 parties commencées · 5 terminées (77 %
d'abandon) · 21 parties sur 22 contre l'IA · 36 % de tactile**.

🔴 **Le chiffre qui oriente ce document : 21 sur 22 contre l'IA.** Le jeu réellement joué est un jeu
**solo**. Ce qui sert le solo sert presque toutes les sessions ; ce qui est adjacent au réseau en sert
une poignée.

`battle_abandoned` est en production depuis le 2026-09-16 (tour, durée, porte de sortie, camp, PV).
Il dira sous peu **pourquoi** on abandonne — plusieurs items de « Comprendre & rythme » attendent
cette lecture plutôt qu'un pari.

## Comment lire

**Plus de phases numérotées, plus d'ordre.** Les numéros servaient à construire le jeu du POC vers la
V1 ; ils suggéraient une séquence qui n'existe plus et enterraient des sujets au fond de « Phase X ».
Ci-dessous des **domaines**, nommés par la question à laquelle ils répondent. Rien dans leur ordre
d'apparition n'indique une priorité.

---

## Donner envie

> Présentation et game feel. Sert tous les arrivants, donc surtout les 21 parties sur 22 contre l'IA.

- [ ] **VFX d'attaque — effets visuels des capacités.** 🔴 Le manque le plus visible du jeu.
      L'**effet de la capacité** (flammes, éclair, onde, impact), pas l'animation du Pokemon, qui
      existe. `design-system.md` §89 : *« pas de particules, pas d'effets visuels par type »*.
      `playAttackAnimation` fait avancer le sprite, point — **Lance-Flammes et Vibrobscur tapent pareil
      à l'écran**.

      **Aucune source d'assets ne le fournira** (vérifié 2026-09-16) : PMDCollab donne une pose
      `Attack` (plan 010), Cobblemon des animations de créature. Dans les deux cas c'est le corps qui
      bouge. **Ce chantier est le nôtre quelle que soit la source** — donc pas un argument pour en
      changer.

      **Approche : simple et générique** (humain, 2026-09-16). Pas un catalogue capacité par capacité,
      un vocabulaire **composé sur trois axes déjà présents dans les données** :

      | Axe | Source | Donne |
      |---|---|---|
      | Type (18) | `MoveDefinition.type` | palette, texture |
      | Drapeau Showdown | `flags` de `moves.json` | nature du coup |
      | Patron de ciblage | `tactical.ts` | géométrie |

      Drapeaux exploitables, volumes mesurés : `sound` 32, `bullet` 26, `slicing` 26, `punch` 24,
      `wind` 17, `dance` 12, `bite` 10. ⚠️ `contact` (267) = drapeau de règles, pas d'apparence —
      repli seulement. Vocabulaire du domaine : `docs/reflexion-patterns-attaques.md` §3.4.
      Sans effet dédié, une capacité retombe sur le générique de son type : **couverture totale dès le
      premier jour**, finesse ensuite.

      **Réemploi à explorer** (humain) : Showdown et autres projets libres animent déjà les capacités.
      Deux réserves — **licence** (graphismes ≠ moteur ; zéro asset non libre de droits commité) et
      **transposition** (leurs effets sont DOM/CSS en vue plate 2D, notre scène est du Babylon
      isométrique : les *images* passent, **le code d'animation non**). Piste d'**assets**, pas de
      système. `best-practices` avant de coder.
- [ ] **Ombres / lumière dynamiques** (voxel + Pokemon). Tout est flat unlit (`StandardMaterial` sans
      lumière) + ombres bakées (`Shadow.png` PMD pour les sprites, rien pour les props voxel).
      **Arbitrage jamais tranché** : (a) **blob/decal** stylisé (cohérent FFTA, coût ~0, recommandé)
      vs (b) **`ShadowGenerator`** réel (1 `DirectionalLight` — vrai dynamique, mais perf, clash avec
      le flat, sprites ALPHATEST capricieux comme casters). Regarder les refs 2D-HD (Octopath,
      Triangle Strategy, FFTA) ; `best-practices` d'abord. Voir `docs/babylon/`.
- [ ] **Textures terrain** — transitions entre types (blend / bords), variations sur un même type
      (casser la répétition). *Animation des liquides déjà livrée : `LiquidShimmerPlugin`,
      décision #707.*
- [ ] **Son / Musique** — le jeu est muet de bout en bout. Aucun cadrage à ce jour.
- [ ] **Décors sur les maps**

---

## Le solo

> Le mode réellement joué, et celui qui n'a **aucune structure** : une équipe, une carte, un combat,
> fin. Pas de progression, pas de raison de revenir. Domaine ouvert le 2026-09-16.

- [ ] **Mode aventure / overworld FFTA** (vision, 2026-06-19) — carte d'exploration façon FFT/FFTA,
      distincte du combat. Déplacement overworld, rivaux mobiles, rencontres aléatoires sur les
      sections de route, villes (arènes, boutiques, events). Départ : **Kanto**, sans fermer la porte
      à une méga-carte mondiale. 🔴 Garde-fou : **pas de scénario complet ni de monde sur-mesure**
      (temps limité) — on s'appuie sur l'univers Pokemon existant.
- [ ] **Conditions de victoire alternatives**
- [ ] **Draft/ban phase** — bannir des espèces à tour de rôle (interdites aux deux camps) puis choisir
      la sienne en voyant l'adversaire. Effet de bord : **corrige l'équilibrage sans équilibrer** —
      une espèce trop forte se fait bannir.

---

## Comprendre & rythme

> Pourquoi 77 % des parties ne finissent pas. **S'arbitre à la donnée** (`battle_abandoned`).

- [ ] **Tutoriel interactif** — jamais cadré.
- [ ] **Contrôles de vitesse** — vitesse des déplacements, passer les animations d'attaque. Jamais
      cadré depuis son ajout (commit `f805821`, 2026-04-02), aucun retour de playtest. ⚠️ « Passer les
      animations d'attaque » suppose des VFX qui n'existent pas. Durées centralisées
      (`render-babylon/src/constants.ts`), accroche UI en place (`settings-panel.ts`).
- [ ] **Sauvegarde auto (localStorage)**

---

## Se partager

> Le seul domaine qui agit sur l'acquisition.

- [ ] **Replay partageable par URL + lecteur.** 🔴 **L'infra est déjà là** : `BattleReplay =
      { seed, actions }`, `runReplay()` (`packages/core/src/battle/replay-runner.ts`), déterminisme
      verrouillé (`golden-replay.test.ts`, `determinism-guard.test.ts`, sommes de contrôle réseau).
      Sert déjà la reprise de partie (plan 181). Restent la sérialisation en URL et le lecteur.
      ⚠️ La barre de transport (`REPLAY_BUTTONS`) a été **retirée** le 2026-09-16 : 5 boutons
      `disabled` qui avaient l'air cliquables. À rebrancher, pas à retrouver.
- [ ] **Défi du jour** (graine quotidienne). 🔴 C'est **le matchmaking des jeux sans joueurs
      simultanés** : même graine pour tous, chacun joue quand il veut. Presque gratuit vu l'infra de
      replay ci-dessus. Sortie proposée au cercle vicieux du matchmaking (§ Questions ouvertes).
- [ ] **Capture de fin de combat partageable**
- Canaux de promo → `docs/promo-channels.md` (restent r/WebGames et r/gamedevfr ; éviter
  r/IndieGaming, anti-IA). ⚠️ Risque juridique fan-game : graphe, `plan-096`.

---

## S'étendre

- [ ] **Éditeur de terrain in-game voxel** — palette de blocs + décorations, empilement, spawns, rendu
      instancié, picking (x,y,z). **Englobe l'ajout de terrains et de plus beaux assets.**
      Vision « Minecraft créatif » validée 2026-07-20 : bloc = cube **24×24×24 px** (taille des
      textures PMD) = 1 unité de hauteur ; relief **par empilement**, pas par étirement (rupture avec
      `tile.height` flottant) ; chaque variation de texture/prop = un nouveau bloc ; décorations =
      entités posables réutilisant le pipeline voxel `.glb`.
      **À trancher au démarrage** : `tile.height` → pile de blocs par case (le core ne voit toujours
      qu'un `MapDefinition`) ; **thin instances** Babylon — **solde gratuitement la dette des ~1500
      draw calls** (~10 draws) ; picking `thinInstanceIndex → (x,y,z)` remplaçant `mesh.metadata` ;
      `terrain-extruder.ts` **remplacé**, pas optimisé. Recherche d'abord (éditeurs voxel existants,
      `best-practices` rendu instancié).
- [ ] **Générations 2-9** — 874 Pokemon (Gen 2 : 100, 3 : 135, 4 : 107, 5 : 156, 6 : 72, 7 : 88,
      8 : 96, 9 : 120). Sprites PMDCollab pour la majorité. Demande `sprite-config.json` étendu +
      movesets tactiques par espèce.
- [ ] **Méga-Évolutions** — 21 formes Gen 1 (16 officielles + 5 Pokémon Champions). PMDCollab : 6
      formes partielles, aucune complète (mai 2026). → graphe : `méga-évolutions-gen-1`, et l'entrée
      Legends Z-A (mod Showdown `gen9legends`) comme autre source.
- [ ] **Modification dynamique du terrain par attaques** — Feu supprime l'herbe haute, Ébullition crée
      lave/magma, Force déplace les rochers, Glace gèle l'eau. Mutation runtime `TerrainType` +
      décoration. Reporté 2026-04-20 : trop lourd tant que roster d'attaques et palette de terrains ne
      sont pas figés.

---

## Équilibrer

> 🔴 **En attente de volume, assumé.** Pas mort : bloqué par une quantité de données qu'on n'a pas. Au
> rythme mesuré (≈1,6 partie/jour), une espèce apparaît **une fois tous les 17 jours** ; `n=30` par
> espèce ≈ **16 mois** (décision #1069).
>
> Réserves pour le retour : le *build* des équipes aléatoires n'est pas tiré au hasard (`opSets[0]`
> toujours) et 21 parties sur 22 sont contre l'IA. → graphe : `plan-212`.
>
> Ce qui parlerait vite, en revanche, ce sont les questions qui **poolent** le trafic au lieu de le
> fragmenter par espèce : abandon et sa posture, causes de K.O. globales, durée, tours. Déjà mesurées.

- [ ] **Mode headless + outils d'équilibrage** — **prérequis** : déplacer les `.tmj` dans
      `packages/data/src/maps/tiled/` + `loadMapDefinition(id)` Node-compatible. Aujourd'hui les maps
      sont dans `packages/renderer/public/`, chargées par `fetch()` HTTP — inutilisable sans
      navigateur.
- [ ] **IA vs IA + reporting** — ⚠️ la partie « niveaux de difficulté » est passée dans **Le solo**
      (2026-09-16) : fonctionnalité joueur, pas outil de mesure.
- [ ] **LLM vs LLM** (Claude adversaire) — risque d'être cher.
- [ ] **Passes d'équilibrage**

---

## Dette & infra

> La dette fine vit dans le graphe (entités `backlog`). Seuls les chantiers nommés restent ici.

- [ ] **Biome HTML/CSS lint** — étendre `files.includes` += `**/*.{css,html}`. A11y **non activée**
      (décision #752, lecteur d'écran abandonné, `a11y.preset: "none"`). Optionnel :
      `stylelint-plugin-use-baseline`.
- [ ] **Signaling maison + relais NAT** sur Durable Object (#869) — *si besoin après la V1*. Non
      déclenché.

---

## Questions ouvertes

**Modèles 3D pour les Pokemon — requalifié, pas mort** (2026-09-16). POC Cobblemon clôturé le
2026-06-18 sur **rejet esthétique**. → graphe `plan-129` ; ⚠️ le plan lui-même n'existe que sur la
branche **non mergée** `poc-cobblemon` (`docs/plans/129-poc-cobblemon-voxel-renderer.md`), pas sur
`main`. Rouvert parce que
le rejet tenait à un seul avis, que les développeurs Cobblemon semblent plus actifs que PMDCollab, et
pour les Méga. **Ce qui doit peser** : Cobblemon n'apporte **pas** les VFX (clips = `idle`, `walk`,
`run`, `blink`, `cry`, `recoil`, `faint`, `ride_*` — de la créature) ; licence **CC BY-NC identique** ;
**7 chantiers** de productisation relevés (machine d'états des poses à réimplémenter, root motion à
stripper, multi-texture absent — *la queue de Dracaufeu n'a pas de flamme* —, posture vol/nage,
z-fighting résiduel). **Non vérifié : la couverture Méga de Cobblemon.**

**Taille des Pokemon et emprise sur la grille** (2026-09-16). Certains modèles sont énormes ; le POC
avait **contourné** par une échelle forcée ×0.45 et l'invariant « le modèle déborde mais n'occupe
qu'une case ». 🔴 **Question de gameplay, pas de rendu** : une emprise 2×2 touche déplacement,
portées, ciblage, placement, pathfinding. `game-designer` avant tout code — et **elle se pose même en
2D-HD**, indépendamment du choix sprites/3D.

**Matchmaking — écarté, pas reporté** (2026-08-29, `docs/multiplayer.md`, #862). Objection **produit,
pas technique** : *« un matchmaking avec personne en ligne, c'est une salle d'attente vide — pire
qu'un code »*. Toujours vraie (21/22 contre l'IA), mais **circulaire**. Sortie proposée le
2026-09-16 : le **défi du jour**, qui supprime le besoin de simultanéité.

**Statut / terrain** — `question-ouverte-9`, laissée ouverte **sciemment** : « on verra quand
j'ajouterai des terrains ». Ne pas la reposer avant le prochain lot de terrains.

---

## Ce qui est fait

Détail complet dans le graphe : `node scripts/memory/query.mjs --open <entité>`.

| Phase | Apport | Entité |
|---|---|---|
| **0 — Prototype (POC)** | valider la stack, un combat jouable minimal | `roadmap-phase-0-prototype-technique-poc-terminé` |
| **1 — Combat fonctionnel** | combat complet et varié en hot-seat | `roadmap-phase-1-combat-fonctionnel-terminé` |
| **2 — Démo jouable** | lien partageable, on joue seul contre l'IA | `roadmap-phase-2-démo-jouable-terminé` |
| **3 — Terrain & Tactics** | la profondeur tactique : le terrain change le jeu | `roadmap-phase-3-terrain-tactics-terminé` |
| **4 — Gameplay Pokemon complet** | météo, champs, Distorsion, toutes les mécaniques | `roadmap-phase-4-gameplay-pokemon-complet-terminée-cont` |
| **5 — Renderer 2D-HD (Babylon.js)** | terrain 3D + sprites billboardés | `roadmap-phase-5-migration-renderer-2d-hd-babylonjs-ter` |
| **6.5 — Client jouable** | doigt, clavier, manette — le seul retour joueur était « injouable sur mobile » | `roadmap-phase-65-client-jouable-contrôles-ui-terminée` |
| **7 — Multijoueur & télémétrie** | P2P WebRTC 2-12 joueurs, télémétrie Worker — **publiée `v2026.9.1`** | `release-v2026.9.1`, `plan-195` |
| **Post-Babylon** | props voxel, liquides, auras, Vitest ×10-15, TypeScript 6, Babylon 9.12 | décisions #690-#707, #753-#757 |

**Écarté, ne reviendra pas sans nouvelle décision** : serveur autoritaire, Supabase (#862), fog réel
en ligne (#863), classement compétitif (#870), round-robin et PP (#517), POC Cobblemon (§ Questions
ouvertes).

**Livrés ailleurs — ne pas reproposer comme neufs** : support manette, UI revamps et tooltips type
chart (Phase 6.5) ; CSS modulaire + `<dialog>` natif (plan 085) ; roster Gen 1 complet, 150 espèces
(plan 135) ; **choisir le niveau de l'IA** — livré par le plan 214 le
2026-09-17, un jour après que la décision #1075 l'ait rangé dans « Le solo », d'où la ligne restée
ouverte à tort jusqu'au 2026-09-18 : l'écran de sélection d'équipe porte **un bouton par niveau**
(Facile / Moyenne / Difficile) sur chaque place, défaut Moyenne. Les 5 niveaux de la décision #699
sont ceux du **studio sandbox**, pas de l'écran joueur.

🔴 **Règles de release** (décisions #924, #925) : `pnpm test:e2e` **complet** avant de publier —
l'affected ne suffit pas —, **pas de `/publish` sur un `pnpm e2e:status` rouge**, et on **n'attend
jamais** la suite e2e asynchrone.
