# Roadmap — Pokemon Tactics

> Phases de développement du POC au jeu complet.
> Limite de roster : 151 premiers Pokemon (Gen 1) — décision #92.

---

## Phase 0 — Prototype technique (POC) ✅ *Terminé*

> But : valider la stack et avoir un combat jouable minimaliste

### Core
- [x] Setup monorepo (pnpm workspaces, tsconfig, Vite, Vitest, Biome)
- [x] Modèles de base (Pokemon, Move, Grid, BattleState)
- [x] Grille plate (pas de dénivelé), placement de 2 Pokemon
- [x] Système de tour simple (round-robin par Vitesse)
- [x] Déplacement (pathfinding BFS sur grille)
- [x] Attaque single target + calcul de dégâts (formule Gen 5+, STAB, types)
- [x] Condition de victoire (dernière équipe debout)
- [x] Move+Act par tour (FFTA-like)
- [x] 5 statuts majeurs (brûlure, poison, paralysie, gel, sommeil)
- [x] 9 targeting patterns (single, self, cone, cross, line, dash, zone, slash, blast)
- [x] Friendly fire actif
- [x] Type chart 18x18
- [x] Tests unitaires pour chaque mécanique (596 tests, 100% coverage — 73 fichiers moves + 14 mécaniques transversales)

### Renderer
- [x] Grille isométrique 2D avec Phaser 4
- [x] Sprites Pokemon animés (PMDCollab : Idle/Walk/Attack/Hurt/Faint, portraits)
- [x] Sélection + déplacement visuel + animation
- [x] UI FFT-like (menu d'action, sous-menu attaque, panel info, timeline, curseur)
- [x] State machine 6 états + overlay scene séparée
- [x] Écran de victoire
- [x] Hot-seat 2 joueurs basique

### AI
- [x] IA random headless (validation API core, 58 rounds, victoire détectée)

---

## Phase 1 — Combat fonctionnel 🎯 *En cours*

> But : un combat complet et varié, jouable en hot-seat, avec assez de Pokemon pour tester toutes les mécaniques

### Ce qui est posé (fondations Phase 0)
Formule de dégâts, type chart, 9 targeting patterns, 5 statuts majeurs, friendly fire, Move+Act, stat stages (-6/+6), hot-seat basique, 12 Pokemon avec 48 moves, format 6v6, phase de placement interactive.

### Core
- [x] KO définitif : corps reste sur la tile, traversable mais non-stoppable (plan 011)
- [x] Placement initial configurable : `MapDefinition`, `PlacementPhase`, alternance serpent, mode random (plan 013 — implémenté, non commité)
- [x] Direction de fin de tour (orientation choisie avant EndTurn)
- [x] Nouveaux patterns core : `slash` (arc frontal 3 cases) et `blast` (projectile + explosion circulaire) — voir `docs/reflexion-patterns-attaques.md` et décisions #108-109
- [x] Mettre à jour `tactical.ts` avec les 7 changements de pattern effectifs (décision #110) — Ball'Ombre absente du roster actuel
- [x] **Mode Sandbox** (`?sandbox`) : 1 Pokemon joueur vs 1 Dummy configurable sur micro-carte 6x6, 2 panels séparés (Joueur/Dummy), toolbar Réinitialiser + Copier URL, query params complets, Dummy avec preset Pokemon ou custom stats (décisions #138-139) — plan 023 + post-plan
- [x] 8 moves défensifs : Abri, Détection, Garde Large, Prévention, Riposte, Voile Miroir, Fulmifer, Ténacité (décisions #141-146) + tests d'intégration scénario Gherkin (décision #140) — plan 023
- [x] Plus de moves stat changes : Épée Danse (+2 Atk), Mur de Fer (+2 Def), Rugissement (-1 Atk cone), Hurlement (-1 Atk cone), Flash (-1 Accuracy zone r2) — plan 026
- [x] Plus de moves AoE variés : Séisme (zone r2), Acide (cone + SpDef debuff), Tranche (slash), Draco-Queue (slash + knockback) — plan 026
- [x] Plus de moves avec portées variées : Ultimapoing (mêlée), Dard-Venin (mêlée + poison), Ultralaser (ligne 5 + recharge), Double Pied (multi-hit x2), Combo-Griffe (multi-hit 2-5) — plan 026
- [x] Statuts volatils : confusion tactique (redirection allié, direction aléatoire, tour perdu si pas d'allié) — plan 026
- [x] Poison grave : dégâts croissants via toxicCounter (1/16 à 15/16 HP) — plan 026
- [x] Plusieurs Pokemon par équipe : format 6v6 implémenté (plan 013)
- [x] Tests d'intégration par move : 73 fichiers moves + 14 fichiers mécaniques, helper `buildMoveTestEngine`, **595 tests** (plans 025+026)
- [x] Roster élargi (~20 Pokemon) — **20 Pokemon jouables** (+1 Dummy) avec 72 moves, sprites PMDCollab, tests d'intégration par move (plan 027)
- [x] Stats niveau 50 : fonction `computeStatAtLevel` pour calculer HP et stats réelles au niveau 50 (plan 015)
- [ ] Système de replay (log d'actions déterministe, seed + rejeu)

### Renderer
- [x] Placement initial visuel : phase de placement interactive, panel roster, zones de spawn highlight (plan 013 — implémenté, non commité)
- [x] Choix de direction en fin de tour
- [x] Corps KO visible sur la grille (sprite Faint persistant, alpha réduit)
- [x] Stat change indicators (flèches ↑↓ colorées) dans l'info panel
- [x] Status icons (pastilles colorées) dans la turn timeline
- [x] Afficher le niveau dans l'UI (`Lv.50` dans l'InfoPanel)
- [x] Info détaillées des attaques dans le sous-menu (catégorie icon SV + nom + PP courants/max) + tooltip hover (catégorie, puissance, précision, nom pattern FR + portée conditionnelle, grille dynamique) — plan 016
- [x] Refonte panel info stats : badges colorés Showdown (bleu buff / rouge debuff) pour les stat changes (plan 018)
- [x] Feedback visuel des statuts sur les sprites (icônes ZA sur sprites + timeline, miniature ZA dans InfoPanel, animation Sleep PMD) (plan 018)
- [x] Prévisualisation AoE dynamique sur la grille : preview hover, flow 2 étapes FFTA (verrouillage + clignotement + confirmation), `confirmAttack` configurable, couleurs rouge/bleu selon effets, outline périmétrique pour la portée (plan 017)
- [x] Preview dégâts estimés dans `confirm_attack` : random roll x0.85–1.00, `estimateDamage()` core, zone dégradée HP bar + texte flottant min–max, "Immune" pour les immunités, AoE multi-cibles (plan 019)

---

## Phase 2 — Terrain tactique

- [ ] i18n français/anglais : système de traduction léger pour noms Pokemon, moves, statuts, UI (source : https://github.com/Sykless/pokemon-showdown-fr)
- [ ] Scaling sprites selon taille Pokemon : scale relatif basé sur height/weight de PokeAPI
- [ ] Dénivelés (hauteur des tiles) + dégâts de chute
- [ ] Types de terrain (lave, eau, herbe) + modificateurs précision terrain
- [ ] Interactions type/terrain (Feu immunisé lave, Vol ignore obstacles...)
- [ ] Modification du terrain par les attaques (Champ Herbeux, etc.)
- [ ] Orientation : bonus dégâts de dos / réduction de face (style FFTA)
- [ ] Team Builder (import/export format Showdown)
- [ ] Support manette (Gamepad API)

---

## Phase 3 — Profondeur & IA

- [ ] Talents (capacités passives)
- [ ] Objets tenus
- [ ] Système CT (FFTA Clock Tick) en remplacement du round-robin (si décidé)
- [ ] Formules dérivées affinées (Mouvement/Saut/Initiative)
- [ ] Roster élargi (~30+ Pokemon)
- [ ] IA heuristique (jouer solo)
- [ ] IA LLM (Claude comme adversaire)
- [ ] MCP server pour exposer le moteur
- [ ] Mode headless accéléré (1000 combats sans rendu)
- [ ] Outils d'équilibrage (stats de winrate)
- [ ] Éditeur de terrain visuel
- [ ] Génération de terrain par prompt IA ("arène de feu", "village de montagne")

---

## Phase 4 — Polish & Multi

- [ ] Animations fluides (attaque par catégorie, déplacement par type)
- [ ] Effets visuels isométriques (ombres, lumières, particules)
- [ ] Rotation caméra 4 angles (style FFTA)
- [x] Canvas responsive FIT (Phaser.Scale.FIT, CSS 100vw/100vh) — plan 020
- [x] Zoom 3 niveaux discrets (close-up 2.0x / medium 1.3x / overview 0.85x), molette + touches +/- — plan 020
- [x] Pan caméra aux bords de l'écran (50px threshold, 6px/frame) + suivi automatique du Pokemon actif (camera.pan fluide) — plan 020
- [x] Sprite offsets corrects via Shadow.png PMDCollab (`Idle-Offsets.png` : pixel noir = tête, pixel vert = corps, `ShadowSize` XML → `offsets.json` par Pokemon) + ombres ellipse sous sprites — plan 021
- [x] Refonte turn order (timeline) : section haute actif+restants, séparateur round, section basse déjà-passés en transparence, tailles réduites pour 12 Pokemon sans chevauchement InfoPanel — plan 022
- [ ] Hot-seat jusqu'à 12 joueurs
- [ ] Menu principal (combat rapide + entrée aventure désactivée)
- [ ] Son / Musique
- [ ] Migration renderer vers Three.js/Babylon.js pour vrai HD-2D (optionnel)
- [ ] Multijoueur réseau (WebSocket)
- [ ] Mode histoire / aventure (si décidé)
