# Game Design — Pokemon Tactics

> Vision et règles du jeu. Pour l'architecture technique, voir [architecture.md](architecture.md).
> Pour les décisions prises et questions ouvertes, voir [decisions.md](decisions.md).

---

## 1. Pitch

Un jeu de combat tactique sur grille isométrique qui fusionne :
- **Pokemon** : chacun avec 4 attaques, 1 talent, 1 objet tenu
- **Final Fantasy Tactics Advance** : déplacements sur grille, dénivelés, aires d'effet
- **Style HD-2D** (Octopath Traveler) : sprites 2D sur environnements 3D avec effets de lumière

**Scope actuel : combat tactique uniquement.** Pas d'aventure, pas d'histoire, pas d'évolutions.

### Inspirations principales
- **Pokemon** — types, stats, capacités
- **FFTA** — grille, initiative, AoE, KO countdown
- **Fire Emblem** (Advance+) — positionnement, blocage
- **Advance Wars** — tactique grille, lisibilité
- **Triangle Strategy** — référence visuelle HD-2D
- **Dofus**, **Le Donjon de Naheulbeuk** — tactical RPGs avec AoE et friendly fire

---

## 2. Format de combat

- **12 Pokemon max** simultanément sur le terrain
- **Jusqu'à 12 joueurs** — équipes ou chacun pour soi (free-for-all)
- Exemples : 6v6, 3v3v3v3, 2v2v2v2v2v2, 1v1v1v1 (chacun 1 Pokemon)...
- **Taille d'équipe configurable** par format — base = 6v6 (mode histoire). Définie avant le combat.
- **Multijoueur local hot-seat** (style Civilization : on se passe le clavier)
- **Pas de brouillard de guerre** — chaque joueur voit l'intégralité du terrain et tous les Pokemon
- **FFA = chacun pour soi** — pas d'alliances dynamiques. Le friendly fire gère naturellement les interactions. Mode équipe = format séparé.
- Multijoueur réseau : plus tard

---

## 3. Pokemon

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — **stats officielles Pokemon** |
| **Stats dérivées** | Mouvement, Saut, Initiative — **calculées depuis Vitesse + Poids** (formules à définir) |
| **Types** | Système de types Pokemon (18 types, faiblesses/résistances) |
| **4 Attaques** | Puissance, précision, PP, type, catégorie (phys/spé/statut), **pattern d'AoE**, **portée** — chaque valeur peut être surchargée pour l'équilibrage tactique |
| **1 Talent** | Capacité passive (ex: Intimidation, Lévitation...) |
| **1 Objet tenu** | Effet passif ou consommable (Baie, Bandeau Choix...) |

---

## 4. Système de tour — Initiative individuelle (FFTA-like)

Chaque Pokemon a son propre tour basé sur une **initiative calculée depuis Vitesse et Poids**.
Barre de temps type ATB/CT (Clock Tick de FFTA).

> **Formule à définir plus tard.** Idée de base : Vitesse haute = agit souvent, Poids lourd = malus initiative.
> Pour le POC : initiative = Vitesse (simple), on affinera ensuite.

---

## 5. Système d'équilibrage par surcharge (override)

Principe fondamental : on part des **données officielles Pokemon** (stats, dégâts, précision, PP, etc.) et on applique une **couche de surcharge** pour l'équilibrage tactique.

```
Valeur finale = valeur officielle Pokemon → surcharge globale tactique → surcharge par capacité/talent/objet
```

Exemples de surcharges possibles :
- **Par attaque** : PP ajustés, dégâts modifiés, portée/AoE ajoutée
- **Par talent** : effet modifié pour le contexte grille
- **Formule de dégâts** : multiplicateurs tactiques (hauteur, orientation, terrain)
- **Par Pokemon** : stats dérivées (mouvement, saut, initiative)

Ce système permet de :
- Utiliser les données Pokemon officielles comme base solide
- Ajuster finement l'équilibre pour le contexte tactique
- Itérer sur l'équilibrage sans toucher aux données de base
- Potentiellement proposer plusieurs "métas" / rulesets

> Si à terme les PP ne fonctionnent pas bien, on pourra les remplacer par un système de points d'action (style FFTA) via ce même système de surcharge.

---

## 6. Grille & Terrain

- Grille isométrique avec **dénivelés** (hauteur variable par tile)
- **Mouvement** : chaque Pokemon a un nombre de tiles de déplacement
- **Pas de déplacement diagonal** (style FFTA / Fire Emblem) — 4 directions uniquement
- **Saut** : capacité à franchir les dénivelés

### Blocage & traversée
- Chaque Pokemon **occupe une tile** et bloque le passage des ennemis
- Les **alliés se traversent** librement (déplacement ET attaques dash)
- **Seuls les ennemis et obstacles bloquent** le passage
- **Exceptions** : les types Vol et Spectre traversent aussi les ennemis
- Certains talents (Lévitation) pourraient permettre de traverser aussi (à valider en Phase 1)

### Chute & dégâts de chute
- Un Pokemon poussé hors d'une tile élevée **tombe** sur la tile inférieure
- **Dégâts de chute** proportionnels à la hauteur tombée
- Le **Poids** du Pokemon pourrait influencer les dégâts de chute (plus lourd = plus de dégâts ?) — à tester
- **Immunités** : types Vol, talent Lévitation — ne prennent pas de dégâts de chute

### Types de terrain
| Terrain | Effet | Immunité |
|---------|-------|----------|
| Lave | Dégâts + brûlure | Type Feu |
| Eau | Dégâts + ralentissement ? | Type Eau |
| Herbe haute | Bonus évasion ? | — |
| Glace | Glissade ? | Type Glace ? |

### Influence du terrain sur la précision
Le système de précision Pokemon (précision attaque × évasion cible) est conservé, avec des **modificateurs terrain** en plus :
- **Herbe haute** : bonus évasion au défenseur
- **Glace** : malus précision à l'attaquant (terrain instable) ?
- **Hauteur supérieure** : bonus précision à l'attaquant (avantage du surplomb) ?
- **Eau profonde** : malus évasion aux non-Eau ?

> Détails et valeurs à définir en Phase 1-2. Tout est surchargeable via le système d'override.

### Interactions terrain / type
- Les Pokemon **Vol** peuvent survoler obstacles et dénivelés
- Les Pokemon **Feu** sont immunisés à la lave
- Les Pokemon **Eau** nagent dans l'eau
- Les attaques peuvent **modifier le terrain** (Champ Herbeux, Champ Électrifié, etc.)

---

## 7. Aires d'effet (AoE)

Chaque attaque a un **pattern** (inspiré FFTA) :
- Single tile (cible unique)
- Croix (3x3, 5x5...)
- Ligne droite (portée X)
- Cône
- Zone circulaire
- Pattern custom par attaque

**Friendly fire : OUI** — les AoE touchent les alliés. Force le positionnement tactique.

### Types de portée
- **Mêlée** (portée 1) : tile adjacente
- **Portée X** (portée 1-3, 2-4...) : cible à distance, single tile
- **Portée + AoE** : cible un point à distance, l'effet se propage en zone autour du point d'impact (ex: boule de feu tirée à portée 3, explose en croix 3x3)
- **Zone self** (portée 0) : zone centrée sur le lanceur (ex: Brouillard)
- **Cône** : éventail devant le lanceur
- **Ligne** : ligne droite depuis le lanceur
- **Dash** : le lanceur se déplace en ligne droite et frappe (voir attaques de priorité)

---

## 7b. Attaques de priorité → Attaques Dash

Dans Pokemon, les attaques de priorité (Vive-Attaque, Mach Punch...) permettent d'agir en premier. Dans un système à initiative individuelle, "agir en premier" n'a pas le même sens.

**Solution retenue : les attaques de priorité deviennent des attaques Dash.**

Le Pokemon **se déplace en ligne droite** sur X tiles et frappe le premier ennemi rencontré. C'est à la fois :
- Un déplacement (repositionnement)
- Une attaque (dégâts)
- En une seule action

**Propriétés d'une attaque Dash :**
- Direction : 4 directions (pas de diagonale)
- Distance max : variable par attaque (ex: Vive-Attaque = 3 tiles, Vitesse Extrême = 5 tiles)
- Frappe le **premier ennemi** sur le chemin
- Le lanceur s'arrête **à côté** de la cible après l'impact
- **Traverse les alliés** (comme le déplacement normal), bloqué par les ennemis et obstacles

> Ça ouvre des possibilités tactiques : fermer un gap, foncer à travers une ouverture, fuir + frapper dans la direction de fuite... Les alliés peuvent body-blocker un dash ennemi.

---

## 7c. Effets de statut

### Statuts existants (base Pokemon, adaptés au tactique)
| Statut | Effet | Durée |
|--------|-------|-------|
| Brûlure | Dégâts par tour + -50% Attaque phys | À définir (fixe ou surchargeable) |
| Paralysie | -50% Vitesse + chance de ne pas agir | À définir |
| Poison | Dégâts par tour | À définir |
| Poison grave | Dégâts croissants par tour | À définir |
| Gel | Ne peut pas agir, chance de dégel par tour | À définir |
| Sommeil | Ne peut pas agir, se réveille après X tours | À définir |
| Confusion | Chance de se frapper soi-même | À définir |

### Questions ouvertes sur les statuts
- **Durée** : nombre de tours fixe ? Aléatoire ? Surchargeable par attaque ?
- **Stacking** : un Pokemon peut-il avoir plusieurs statuts à la fois ? (Dans Pokemon : 1 statut majeur max + statuts volatils illimités)
- **Interaction terrain** : un Pokemon Brûlé sur eau = guéri ? Un Pokemon sur glace = plus facile à geler ?
- **Guérison** : par talent, objet, ou passage du temps uniquement ?

> À trancher en Phase 1. Le système de surcharge permettra d'ajuster tous les chiffres.

---

## 7d. Vampigraine — mécanique spéciale (lien à distance)

Vampigraine plante une graine sur la cible qui **draine des PV chaque tour et les rend au lanceur**.

**Adaptation tactique :**
- **Portée de lancer** : 1-3 tiles
- **Lien à distance** : le drain ne fonctionne que tant que la cible est à **≤ X tiles** du lanceur (ex: 5 tiles)
- **Durée limitée** : 3 tours max (surchargeable)
- Si la cible **s'éloigne** au-delà de la portée du lien → le drain est interrompu (mais reprend si elle revient à portée)

**Pourquoi c'est tactique :**
- Le lanceur doit rester à portée → se met en danger
- La cible peut fuir pour rompre le lien
- Les alliés peuvent body-blocker pour empêcher le lanceur de suivre
- Combo : Vampigraine + allié qui ralentit/bloque la cible

> Premier prototype d'attaque à "lien persistant". Pourrait s'appliquer à d'autres attaques plus tard (Attraction, Embargo...).

---

## 8. Orientation & positionnement (style FFTA)

Chaque Pokemon a une **orientation** (la direction dans laquelle elle regarde).
- **Attaque de dos** : bonus de dégâts (le défenseur ne voit pas venir le coup)
- **Attaque de côté** : dégâts normaux
- **Attaque de face** : possibilité de réduction de dégâts ?
- L'orientation se met à jour quand le Pokemon se déplace ou attaque
- Ajoute une couche tactique : tourner le dos à l'ennemi est dangereux, le positionnement autour d'une cible compte

> Détails (bonus exact, mécanique de retournement) à définir en Phase 1-2.

---

## 9. KO & élimination

Système inspiré de **FFTA** :
- Un Pokemon à **0 PV** tombe **KO** mais n'est pas immédiatement éliminé
- Un **countdown** démarre (ex: 3 tours). Si le countdown atteint 0, le Pokemon est **définitivement éliminé**
- Pendant le countdown, un allié ou un effet peut **ranimer** le Pokemon (objet Rappel, capacités comme Voeu, etc.)
- Certains talents pourraient interagir avec ce système (à explorer en Phase 3)

> Ce système ajoute une couche tactique : faut-il finir un KO ou sauver un allié ? On peut ajuster la durée du countdown pour l'équilibrage.

---

## 9b. Prévisualisation des actions légales

`getLegalActions()` retourne pour chaque action possible les positions de cible valides (cibles dans la zone d'effet, chemin accessible pour un déplacement, etc.).

Cette API sert à deux usages :
- **UI** : afficher les tiles disponibles quand le joueur sélectionne une attaque ou un déplacement
- **IA** : filtrer les attaques qui n'ont pas de cible à portée avant de choisir une action

> Validé par les tests headless : une IA qui ignore ce filtre gaspille ses PP sur des attaques sans cible. Toute IA correcte doit consommer `getLegalActions` avant de décider.

---

## 10. Jouabilité par IA

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

## 11. Système de replay

Chaque combat est enregistré comme une séquence d'actions déterministe :
- État initial (grille, placements, équipes)
- Chaque action jouée dans l'ordre
- Seed aléatoire (pour reproduire crits, miss...)

Un replay peut être rejoué visuellement, analysé en texte, ou utilisé pour le debug.

---

## 12. Éditeur de terrain

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

## 13. Team Builder

- Construire son équipe de Pokemon (choix d'espèce, 4 attaques, talent, objet tenu)
- **Format Showdown** pour l'import/export (standard de la communauté, facile à parser)
- Permet d'échanger des équipes, d'utiliser des équipes existantes de la communauté

> Phase 2-3. Pour le POC, les équipes seront définies dans le code/JSON.

---

## 14. Modes de jeu (vision long terme)

| Mode | Statut | Description |
|------|--------|-------------|
| **Combat rapide** | POC | Choisir 2+ équipes, lancer un combat |
| **Mode histoire / aventure** | À voir | Prévu dans le menu principal (entrée désactivée tant que pas implémenté) |
| **Multijoueur local** | Phase 1 | Hot-seat |
| **Multijoueur réseau** | Phase 4+ | WebSocket |

---

## 15. Contrôles

- **Clavier + souris** : contrôle principal
- **Manette** : support gamepad prévu (navigation grille, sélection, menus)
- Phaser supporte le Gamepad API nativement

> Clavier/souris pour le POC. Manette en Phase 2-3.

---

## 16. Assets & Style visuel

### Sprites Pokemon
- **PMDCollab/SpriteCollab** : sprites style PMD, 8 directions, animations riches (Walk, Idle, Attack, Hurt...)
- Pipeline : AnimData.xml → Phaser texture atlas (JSON + PNG)
- Placeholders pour le POC, vrais sprites en Phase 1

### Terrain
- Tiles isométriques avec faux dénivelés (2D) → vraie 3D plus tard (Three.js)
- Effets de lumière/ombre pour le rendu HD-2D
- Dénivelés visibles (escaliers, plateaux, falaises)

### UI
- Minimaliste, inspirée Pokemon + FFTA
- Barre de PV, infos attaques, grille de portée visible, barre d'initiative
- Menu principal avec entrées désactivables (aventure grisée)
