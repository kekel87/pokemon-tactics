# Game Design — Pokemon Tactics

> Vision et règles du jeu. Pour l'architecture technique, voir [architecture.md](architecture.md).
> Pour les décisions prises et questions ouvertes, voir [decisions.md](decisions.md).

---

## 1. Pitch

Un jeu de combat tactique sur grille isométrique qui fusionne :
- **Pokemon** : créatures avec 4 attaques, 1 talent, 1 objet tenu
- **Final Fantasy Tactics** : déplacements sur grille, dénivelés, aires d'effet
- **Style HD-2D** (Octopath Traveler) : sprites 2D sur environnements 3D avec effets de lumière

**Scope actuel : combat tactique uniquement.** Pas d'aventure, pas d'histoire, pas d'évolutions.

---

## 2. Format de combat

- **12 créatures max** simultanément sur le terrain
- **Jusqu'à 12 joueurs** — équipes ou chacun pour soi (free-for-all)
- Exemples : 6v6, 3v3v3v3, 2v2v2v2v2v2, 12 joueurs en free-for-all...
- **Multijoueur local hot-seat** (style Civilization : on se passe le clavier)
- Multijoueur réseau : plus tard

---

## 3. Créature (Pokemon)

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — **stats officielles Pokemon** |
| **Stats dérivées** | Mouvement, Saut, Initiative — **calculées depuis Vitesse + Poids** (formules à définir) |
| **Types** | Système de types Pokemon (18 types, faiblesses/résistances) |
| **4 Attaques** | Puissance, précision, PP, type, catégorie (phys/spé/statut), **pattern d'AoE**, **portée** |
| **1 Talent** | Capacité passive (ex: Intimidation, Lévitation...) |
| **1 Objet tenu** | Effet passif ou consommable (Baie, Bandeau Choix...) |

---

## 4. Système de tour — Initiative individuelle (FFT-like)

Chaque Pokemon a son propre tour basé sur une **initiative calculée depuis Vitesse et Poids**.
Barre de temps type ATB/CT (Clock Tick de FFT).

> **Formule à définir plus tard.** Idée de base : Vitesse haute = agit souvent, Poids lourd = malus initiative.
> Pour le POC : initiative = Vitesse (simple), on affinera ensuite.

---

## 5. Grille & Terrain

- Grille isométrique avec **dénivelés** (hauteur variable par tile)
- **Mouvement** : chaque créature a un nombre de tiles de déplacement
- **Saut** : capacité à franchir les dénivelés

### Types de terrain
| Terrain | Effet | Immunité |
|---------|-------|----------|
| Lave | Dégâts + brûlure | Type Feu |
| Eau | Dégâts + ralentissement ? | Type Eau |
| Herbe haute | Bonus évasion ? | — |
| Glace | Glissade ? | Type Glace ? |

### Interactions terrain / type
- Les Pokemon **Vol** peuvent survoler obstacles et dénivelés
- Les Pokemon **Feu** sont immunisés à la lave
- Les Pokemon **Eau** nagent dans l'eau
- Les attaques peuvent **modifier le terrain** (Champ Herbeux, Champ Électrifié, etc.)

---

## 6. Aires d'effet (AoE)

Chaque attaque a un **pattern** (inspiré FFT) :
- Single tile (cible unique)
- Croix (3x3, 5x5...)
- Ligne droite (portée X)
- Cône
- Zone circulaire
- Pattern custom par attaque

**Friendly fire : OUI** — les AoE touchent les alliés. Force le positionnement tactique.

---

## 7. Orientation & positionnement (style FFT)

Chaque créature a une **orientation** (la direction dans laquelle elle regarde).
- **Attaque de dos** : bonus de dégâts (le défenseur ne voit pas venir le coup)
- **Attaque de côté** : dégâts normaux
- **Attaque de face** : possibilité de réduction de dégâts ?
- L'orientation se met à jour quand la créature se déplace ou attaque
- Ajoute une couche tactique : tourner le dos à l'ennemi est dangereux, le positionnement autour d'une cible compte

> Détails (bonus exact, mécanique de retournement) à définir en Phase 1-2.

---

## 8. Jouabilité par IA

Le moteur est jouable par différents types de joueurs :

| Type | Description | Usage |
|------|------------|-------|
| **Humain (UI)** | Joue via l'interface graphique | Jeu normal |
| **Humain (hot-seat)** | Se passe le clavier | Multi local |
| **IA classique** | Algorithme (minimax, MCTS, heuristiques) | Solo, tests |
| **IA LLM** | Claude/GPT reçoit l'état en texte, répond une action | Fun, tests |
| **IA MCP** | LLM connecté au moteur via MCP server | Intégration directe |

Cas d'usage IA :
- **Tests** : vérifier que les mécaniques fonctionnent
- **Équilibrage** : 1000 combats headless, analyse de winrate
- **Solo** : jouer contre l'ordi
- **Fun** : affronter Claude

---

## 9. Système de replay

Chaque combat est enregistré comme une séquence d'actions déterministe :
- État initial (grille, placements, équipes)
- Chaque action jouée dans l'ordre
- Seed aléatoire (pour reproduire crits, miss...)

Un replay peut être rejoué visuellement, analysé en texte, ou utilisé pour le debug.

---

## 10. Éditeur de terrain

Deux modes prévus :

### Éditeur visuel (plus tard)
- Interface drag & drop pour placer des tiles, ajuster les hauteurs, peindre les terrains
- Prévisualisation en temps réel

### Génération par prompt IA
- Décrire un terrain en texte : "arène de feu", "village de montagne", "plage avec falaises"
- Un LLM génère le JSON de la map (grille, hauteurs, types de terrain, placements)
- Permet de prototyper des maps très rapidement

> Phase 3-4. Pour le POC, les maps seront codées en dur en JSON.

---

## 11. Team Builder

- Construire son équipe de Pokemon (choix d'espèce, 4 attaques, talent, objet tenu)
- **Format Showdown** pour l'import/export (standard de la communauté, facile à parser)
- Permet d'échanger des équipes, d'utiliser des équipes existantes de la communauté

> Phase 2-3. Pour le POC, les équipes seront définies dans le code/JSON.

---

## 12. Modes de jeu (vision long terme)

| Mode | Statut | Description |
|------|--------|-------------|
| **Combat rapide** | POC | Choisir 2+ équipes, lancer un combat |
| **Mode histoire / aventure** | À voir | Prévu dans le menu principal (entrée désactivée tant que pas implémenté) |
| **Multijoueur local** | Phase 1 | Hot-seat |
| **Multijoueur réseau** | Phase 4+ | WebSocket |

---

## 13. Contrôles

- **Clavier + souris** : contrôle principal
- **Manette** : support gamepad prévu (navigation grille, sélection, menus)
- Phaser supporte le Gamepad API nativement

> Clavier/souris pour le POC. Manette en Phase 2-3.

---

## 14. Assets & Style visuel

### Sprites Pokemon
- **PMDCollab/SpriteCollab** : sprites style PMD, 8 directions, animations riches (Walk, Idle, Attack, Hurt...)
- Pipeline : AnimData.xml → Phaser texture atlas (JSON + PNG)
- Placeholders pour le POC, vrais sprites en Phase 1

### Terrain
- Tiles isométriques avec faux dénivelés (2D) → vraie 3D plus tard (Three.js)
- Effets de lumière/ombre pour le rendu HD-2D
- Dénivelés visibles (escaliers, plateaux, falaises)

### UI
- Minimaliste, inspirée Pokemon + FFT
- Barre de PV, infos attaques, grille de portée visible, barre d'initiative
- Menu principal avec entrées désactivables (aventure grisée)
