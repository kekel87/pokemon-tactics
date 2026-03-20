# Roadmap — Pokemon Tactics

> Phases de développement du POC au jeu complet.

---

## Phase 0 — Prototype technique (POC) 🎯 *Objectif immédiat*

> But : valider la stack et avoir un combat jouable minimaliste

### Core
- [x] Setup monorepo (pnpm workspaces, tsconfig, Vite, Vitest, Biome)
- [ ] Modèles de base (Pokemon, Move, Grid, BattleState)
- [ ] Grille plate (pas de dénivelé), placement de 2 Pokemon
- [ ] Système de tour simple (tri par Vitesse)
- [ ] Déplacement (pathfinding basique sur grille)
- [ ] Attaque single target + calcul de dégâts simplifié
- [ ] Condition de victoire (PV à 0)
- [ ] Tests unitaires pour chaque mécanique

### Renderer
- [ ] Grille isométrique 2D avec Phaser
- [ ] Sprites Pokemon (placeholder ou premiers followers)
- [ ] Sélection + déplacement visuel
- [ ] Attaque visuelle basique
- [ ] UI minimale (PV, sélection attaque)

### AI
- [ ] IA random (validation que l'API core fonctionne)

---

## Phase 1 — Combat fonctionnel

- [ ] 4 attaques par Pokemon avec choix
- [ ] Système de types complet (18 types, tableau d'efficacité)
- [ ] Calcul de dégâts fidèle (formule Pokemon adaptée)
- [ ] Plusieurs Pokemon par équipe (2v2, 3v3)
- [ ] AoE patterns (single, cross, line, circle)
- [ ] Portée des attaques
- [ ] Friendly fire actif
- [ ] Statuts (brûlure, paralysie, gel, poison, sommeil)
- [ ] Système de KO + countdown (style FFTA)
- [ ] Système de replay (enregistrement + rejeu)
- [ ] Hot-seat 2 joueurs
- [ ] Sprites PMDCollab (pipeline AnimData.xml → Phaser atlas)

---

## Phase 2 — Terrain tactique

- [ ] Dénivelés (hauteur des tiles) + dégâts de chute
- [ ] Types de terrain (lave, eau, herbe) + modificateurs précision terrain
- [ ] Interactions type/terrain (Feu immunisé lave, Vol ignore obstacles...)
- [ ] Modification du terrain par les attaques (Champ Herbeux, etc.)
- [ ] Orientation des créatures (face/dos/côté) + bonus dégâts de dos (style FFTA)
- [ ] Team Builder (import/export format Showdown)
- [ ] Support manette (Gamepad API)

---

## Phase 3 — Profondeur & IA

- [ ] Talents (capacités passives)
- [ ] Objets tenus
- [ ] Formules dérivées affinées (Mouvement/Saut/Initiative)
- [ ] Plus de Pokemon (roster ~30+)
- [ ] IA heuristique (jouer solo)
- [ ] IA LLM (Claude comme adversaire)
- [ ] MCP server pour exposer le moteur
- [ ] Mode headless accéléré (1000 combats sans rendu)
- [ ] Outils d'équilibrage (stats de winrate)
- [ ] Éditeur de terrain visuel
- [ ] Génération de terrain par prompt IA ("arène de feu", "village de montagne")

---

## Phase 4 — Polish & Multi

- [ ] Animations fluides (attaque, déplacement, KO)
- [ ] Effets visuels isométriques (ombres, lumières, particules)
- [ ] Rotation caméra 4 angles (style FFTA)
- [ ] Hot-seat jusqu'à 12 joueurs
- [ ] Menu principal (combat rapide + entrée aventure désactivée)
- [ ] Son / Musique
- [ ] Migration renderer vers Three.js pour vrai HD-2D (optionnel)
- [ ] Multijoueur réseau (WebSocket)
- [ ] Mode histoire / aventure (si décidé)
