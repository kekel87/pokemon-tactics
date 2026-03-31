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
- **FFTA** — grille, initiative, AoE, Move+Act
- **Fire Emblem** (Advance+) — positionnement, blocage
- **Advance Wars** — tactique grille, lisibilité
- **Triangle Strategy** — référence visuelle HD-2D
- **Dofus**, **Le Donjon de Naheulbeuk** — tactical RPGs avec AoE et friendly fire

---

## 2. Format de combat

- **12 Pokemon max** simultanément sur le terrain
- **Jusqu'à 12 joueurs** — équipes ou chacun pour soi (free-for-all)
- Formats explicites : 2p (6v6 max), 3p (4v4v4), 4p (3v3v3v3), 6p (2v2x6), 12p (1x12)
- **Taille d'équipe configurable** par format — base = 6v6 (mode histoire). Définie avant le combat.
- **Multijoueur local hot-seat** (style Civilization : on se passe le clavier)
- **Pas de brouillard de guerre** — chaque joueur voit l'intégralité du terrain et tous les Pokemon
- **FFA = chacun pour soi** — pas d'alliances dynamiques. Le friendly fire gère naturellement les interactions. Mode équipe = format séparé.
- Multijoueur réseau : plus tard

---

## 2b. Phase de placement

Avant le premier tour de combat, les joueurs placent leurs Pokemon sur les zones de spawn.

- **La carte porte les zones de spawn** : chaque `MapDefinition` déclare les zones de spawn par équipe pour chaque format supporté. Les zones sont des `Position[]` arbitraires (pas nécessairement des rectangles).
- **Alternance serpent** (défaut) : P1-P2-P2-P1-P1-P2... Plus équitable que l'alternance simple — l'avantage informationnel s'inverse à chaque paire.
- **Mode random** : positions tirées sans remise dans les zones, seed injectable pour le replay.
- **Repositionnement** : uniquement le Pokemon placé lors de l'alternance courante (undo).
- **Direction** : choix obligatoire après chaque placement via `DirectionPicker`. En mode random, direction calculée automatiquement vers le centre de la grille.
- **IA** : placement random instantané dès que c'est son tour d'alternance (`PlayerController.Ai`).
- **Placement blind** : hors scope pour l'instant.
- **`PlacementPhase` est séparé de `BattleEngine`** : le placement se termine, les positions finales sont passées à `BattleEngine` pour créer le combat.

---

## 3. Pokemon

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — **stats officielles Pokemon** |
| **Niveau de combat** | Fixé à **50**. Les stats sont calculées avec la formule Pokemon Gen 5+ au niveau 50 (sans IV/EV pour le POC). Donne des Pokemon plus bulky et des combats plus tactiques. |
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

## 5b. Formule de dégâts (implémentée)

Basée sur la formule Pokemon Gen 5+, adaptée au contexte tactique.

```
Dégâts = ((2 × Level / 5 + 2) × Power × (Atk / Def) / 50 + 2)
         × STAB × Effectiveness × random
```

| Modificateur | Valeur | Condition |
|---|---|---|
| **STAB** | ×1.5 | L'attaque est du même type que le lanceur |
| **Effectiveness** | ×0, ×0.25, ×0.5, ×1, ×2, ×4 | Tableau des types 18×18 |
| **Burn** | ×0.5 | Sur l'Attaque physique si le lanceur est brûlé |
| **random** | ×0.85–1.00 (uniforme) | Variance de ±15% à chaque attaque |

**Preview de dégâts** (implémentée — plan 019) :
- `estimateDamage(attackerId, moveId, defenderId)` retourne `{ min, max, effectiveness }`
- `min` = dégâts au roll 0.85, `max` = dégâts au roll 1.00
- Utilisé pour afficher la fourchette min–max sur la HP bar dans la phase de confirmation d'attaque
- `effectiveness = 0` → affiche "Immune" en gris dans l'UI

> Modificateurs supplémentaires prévus en Phase 2 : hauteur (avantage/désavantage), orientation (dos/face), terrain. Tout est surchargeable via le système d'override.

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
- Arc frontal / slash (3 cases devant : face + 2 diagonales adjacentes)
- Croix (3x3, 5x5...)
- Ligne droite (portée X)
- Cône
- Zone circulaire
- Blast (projectile à distance qui explose en cercle)
- Pattern custom par attaque

**Friendly fire : OUI** — les AoE touchent les alliés. Force le positionnement tactique.

### Types de portée
- **Mêlée** (portée 1) : tile adjacente
- **Portée X** (portée 1-3, 2-4...) : cible à distance, single tile
- **Portée + AoE** : cible un point à distance, l'effet se propage en zone autour du point d'impact (ex: boule de feu tirée à portée 3, explose en croix 3x3)
- **Zone self** (portée 0) : zone centrée sur le lanceur (ex: Brouillard, Ampleur)
- **Cône** : éventail devant le lanceur, largeur dynamique = `distance * 2 - 1` (distance 1 → 1 case, distance 2 → 3 cases, distance 3 → 5 cases) — ex: Dracosouffle, Blizzard, Tornade. Aucun paramètre `width` — la largeur est entièrement dérivée de la distance.
- **Slash / arc frontal** : touche les 3 cases devant le lanceur (face + 2 perpendiculaires adjacentes) — balayage, coup d'aile (ex: Tranch'Herbe, Cru-Aile). Aucun paramètre.
- **Blast** : projectile lancé à distance (`range`) qui explose en cercle à l'impact (`radius`) — différent de `cross` (forme en +) et de `zone` (centré sur soi) (ex: Bombe-Beurk)
- **Croix** : toujours centrée sur le caster, aucun paramètre de portée — ex: Éclate-Roc, Ombre Nuit. Non ciblable à distance.
- **Ligne** : ligne droite depuis le lanceur
- **Dash** : le lanceur se déplace en ligne droite et frappe (voir attaques de priorité)

### Effets spéciaux sur les attaques (flags)

Au-delà du pattern de ciblage, certaines attaques ont des propriétés supplémentaires qui ne sont pas des patterns de ciblage :

| Propriété | Description | Exemples |
|-----------|-------------|---------|
| **knockback** | Repousse la cible de N cases dans la direction de l'impact | Cyclone, Draco-Queue, Torgnole |
| **warp** | Le lanceur se téléporte sur la cible (ignore obstacles), reste à l'arrivée | Tunnel, Vol, Ombre Portée, Téléport |
| **ground** | Pose une zone persistante au sol (N tours) — piège, terrain, brouillard | Picots, Piège de Roc, Cage-Éclair zone |
| **self-damage** | Le lanceur subit des dégâts (recul) | Voltacle, Bélier, Danse Lames |
| **pierce** | Traverse les cibles (variante de `line`) | Laser traversant |
| **ignore-height** | Ignore les bonus/malus de hauteur | Séisme, Ampleur |

> Ces propriétés sont des effets ou flags sur le move. À implémenter en Phase 1+. Voir `docs/reflexion-patterns-attaques.md` pour le détail et les décisions prises.

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
- Distance max : variable par attaque (ex: Vive-Attaque = 2 tiles, Vitesse Extrême = 5 tiles)
- Frappe le **premier ennemi** sur le chemin — le lanceur s'arrête **à côté** de la cible après l'impact
- **Cible valide** : toutes les cases dans les 4 directions jusqu'à `maxDistance` (pas seulement les cases occupées par un ennemi)
- **Dash dans le vide** : si aucun ennemi sur le chemin, le caster se déplace jusqu'à la case ciblée sans frapper. Consomme l'Act, pas le Move.
- **Le lanceur est repositionné** après tout dash (frappe ou non)
- Ne consomme **pas** `hasMoved` — le Pokemon peut encore se déplacer après un dash
- **Traverse les alliés** (comme le déplacement normal), bloqué par les ennemis et obstacles

> Ça ouvre des possibilités tactiques : fermer un gap, foncer à travers une ouverture, fuir + frapper dans la direction de fuite, ou se repositionner rapidement dans le vide. Les alliés peuvent body-blocker un dash ennemi.

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

Chaque Pokemon a une **orientation** (la direction dans laquelle il regarde).
- **Attaque de dos** : bonus de dégâts (le défenseur ne voit pas venir le coup)
- **Attaque de côté** : dégâts normaux
- **Attaque de face** : possibilité de réduction de dégâts ?
- L'orientation se met à jour quand le Pokemon se déplace ou attaque
- Ajoute une couche tactique : tourner le dos à l'ennemi est dangereux, le positionnement autour d'une cible compte

### Choix de direction en fin de tour (implémenté — plan 012)

- **Direction obligatoire** : le joueur choisit toujours sa direction avant de terminer son tour (`EndTurn` exige une `Direction`)
- **4 directions** : `getLegalActions` génère 4 actions `EndTurn` (une par direction)
- **Orientation initiale** : chaque Pokemon regarde le centre de la grille au spawn (calculé via `directionFromTo`)
- **UI style FFT** : `DirectionPicker` — flèches spritesheet positionnées au-dessus du sprite, flèche active jaune / inactives grises
- **Détection quadrants** : la direction est déterminée par la position de la souris dans les 4 quadrants cardinaux écran (croix horizontale/verticale)
- **Barre PV masquée** pendant le choix de direction pour améliorer la lisibilité

> Les bonus/malus d'attaque selon l'orientation (dos, face, côté) restent à implémenter (Phase 2).

---

## 9. KO & élimination

Un Pokemon à **0 PV** est **KO définitif** :
- Le corps reste sur la tile et **bloque le passage** (comme un obstacle)
- Seule capacité de revival : **Second Souffle** (Revival Blessing, **1 PP**) — rare et coûteuse
- Victoire = tous les Pokemon adverses sont KO

> Le KO définitif avec corps bloquant crée une dimension tactique : les cadavres modifient la topologie de la grille. La revival ultra-rare (1 PP) en fait une décision stratégique majeure.

---

## 9b. Prévisualisation des actions légales

`getLegalActions()` retourne pour chaque action possible les positions de cible valides (cibles dans la zone d'effet, chemin accessible pour un déplacement, etc.).

Cette API sert à deux usages :
- **UI** : afficher les tiles disponibles quand le joueur sélectionne une attaque ou un déplacement
- **IA** : filtrer les attaques qui n'ont pas de cible à portée avant de choisir une action

> Validé par les tests headless : une IA qui ignore ce filtre gaspille ses PP sur des attaques sans cible. Toute IA correcte doit consommer `getLegalActions` avant de décider.

---

## 9c. Prévisualisation AoE et flow de confirmation (implémenté — plan 017)

En phase `select_attack_target`, les tiles affectées par l'attaque sont affichées en temps réel avant exécution.

### Comportement par type de pattern
- **Directionnels (Cone, Line, Slash, Dash)** : la preview suit la direction de la souris par rapport au caster (algorithme quadrants, identique au DirectionPicker)
- **Point-target (Single, Blast)** : la preview suit la tile survolée si elle est dans les cibles valides
- **Self-centered (Self, Cross, Zone)** : la preview est affichée statiquement dès l'entrée en phase de ciblage

### Couleurs (décision #129)
- **Rouge** (`0xff4444`) : tiles avec au moins un effet de dégâts
- **Bleu** (`0x4488ff`) : tiles avec uniquement des buffs/effets positifs
- **Outline périmétrique rouge** : contour de la zone de portée (pas chaque tile — lisibilité)

### Flow de confirmation 2 étapes (style FFTA)
Contrôlé par le paramètre `confirmAttack: boolean` dans `BattleConfig` :

| Étape | Action | Effet |
|-------|--------|-------|
| **Preview (hover)** | Survol de la grille | Tiles affectées colorées en temps réel |
| **Verrouillage (1er clic)** | Clic = verrouille la cible | Sprites des Pokemon touchés clignotent (alpha 0.3↔1.0) |
| **Confirmation (2e clic)** | Clic = exécute l'attaque | Combat normal |
| **Escape** | À tout moment | Annule et retour au sous-menu attaque |

- `confirmAttack: true` (défaut) : flow complet 2 étapes
- `confirmAttack: false` : le 1er clic exécute directement (pas de clignotement)

> Pas de warning friendly fire (décision #128) — les alliés dans la zone clignotent comme les ennemis, sans couleur d'alerte distincte. La visibilité des tiles suffit.

> Preview de dégâts implémentée (plan 019) — voir section 5b pour la formule et l'API `estimateDamage`.

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

### Raccourcis clavier/souris

| Entrée | Action |
|--------|--------|
| **Clic gauche** | Sélectionner tile / confirmer action |
| **Survol souris** | Preview AoE, info panel du Pokemon survolé |
| **Molette** | Zoom (3 niveaux : close-up 2.0x, medium 1.3x, overview 0.85x) |
| **+** / **-** / **=** | Zoom in / out (clavier) |
| **Pavé num +** / **-** | Zoom in / out (pavé numérique) |
| **Flèches directionnelles** | Pan caméra (maintenir enfoncé) |
| **Espace** | Recentrer la caméra sur le Pokemon actif |
| **Echap** | Annuler / revenir au menu précédent |

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
- **Sous-menu attaque enrichi** : icône catégorie (Bulbagarden SV, 50x40px) + nom du move + PP courants/max alignés à droite + type icon (Pokepedia ZA, 36x36px sans texte) au hover
- **MoveTooltip** : tooltip au hover sur chaque attaque avec layout fixe :
  1. Icône catégorie SV (physique/spécial/statut)
  2. Puissance / Précision (`—` si nul)
  3. Nom du pattern en français + portée conditionnelle (affichée uniquement pour Single à distance range>1 et Blast)
  4. Grille dynamique du pattern (taille adaptée au pattern réel, minimum 3x3, centrée)
- **Noms patterns FR** : Cible, Soi, Ligne, Cône, Slash, Croix, Zone, Dash, Bombe
- **Type icons** : sprites Pokepedia ZA (Légendes Pokémon Z-A) 36x36px sans texte, chargés comme `type-{typeName}` dans Phaser
- **Category icons** : sprites Bulbagarden Sword & Shield (`PhysicalIC_SV.png`, `SpecialIC_SV.png`, `StatusIC_SV.png`), chargés comme `category-{type}` dans Phaser

---

## 17. Internationalisation (i18n)

Prévu en Phase 2 : système de traduction léger pour les noms de Pokemon, moves, statuts et textes UI.

- **Langues cibles** : français et anglais
- **Source** : [pokemon-showdown-fr](https://github.com/Sykless/pokemon-showdown-fr) pour les traductions françaises
- Pas de lib i18n lourde — un simple dictionnaire JSON suffit pour le POC
- Les données core restent en anglais ; la couche de traduction est uniquement dans le renderer/UI
