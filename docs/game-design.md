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

## 2c. Sélection d'équipe (TeamSelectScene)

Avant la phase de placement, les joueurs construisent leur équipe dans `TeamSelectScene` — le premier écran affiché au démarrage.

- **Grille de portraits** : 5×4, portraits 82px — les 20 Pokemon du roster sont affichés
- **Sélecteur de nombre d'équipes** : bouton cyclique dans la bottom bar (2→3→4→6→12→2). `maxPokemonPerTeam` = 12 / teamCount (ex : 3 équipes → max 4 Pokemon chacune)
- **Layout dynamique** : les encadrés d'équipe s'empilent en 2 colonnes. Nombre impair → colonne gauche reçoit une équipe de plus. Pour les formats 1-2 Pokemon/équipe (6 ou 12 équipes), chaque équipe s'affiche en ligne compacte (nom + toggle + portrait)
- **Encadrés d'équipe** : toujours visibles, actif lumineux / inactif discret. Couleur issue de `TEAM_COLORS[index]` — 12 couleurs distinctes (décision #202-204)
- **Sélection** : clic sur un portrait l'ajoute à l'équipe active (max `maxPokemonPerTeam`, un seul exemplaire par espèce par équipe). Mirror match autorisé entre équipes (décision #184)
- **Toggle Humain/IA** sur la même ligne que "Joueur X" — IA vs IA possible sur toutes les équipes (décision #185)
- **Bouton Auto** : re-randomize toute l'équipe à chaque clic (Pokemon aléatoires distincts, count = maxPokemonPerTeam)
- **Bouton Vider** : réinitialise l'équipe à 0 Pokemon
- **Bouton Remplir IA** : dans la bottom bar, remplit toutes les équipes manquantes avec des équipes IA aléatoires pour lancer rapidement
- **Bouton Valider** : valide l'équipe via `validateTeamSelection()` (core), affiche les erreurs i18n si invalide
- **Toggle Placement auto / Placement manuel** : à côté du bouton "Lancer le combat" — contrôle le `PlacementMode` transmis à `BattleScene`
- **Lancer le combat** : actif seulement si toutes les équipes sont validées
- **Noms des Pokemon** : affichés en FR ou EN selon la langue active (i18n depuis `@pokemon-tactic/data`)
- **Zones de spawn** sur la carte poc-arena colorées selon les équipes via `TEAM_COLORS` (décision #189)
- **Bypass sandbox** : le mode sandbox (`VITE_SANDBOX`) court-circuite `TeamSelectScene` entièrement

**Flow complet :** `TeamSelectScene` → `BattleScene` (placement) → Combat → Écran de victoire (Rejouer ou Retour au menu)

---

## 3. Pokemon

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — **stats officielles Pokemon** |
| **Niveau de combat** | Fixé à **50**. Les stats sont calculées avec la formule Pokemon Gen 5+ au niveau 50 (sans IV/EV pour le POC). Donne des Pokemon plus bulky et des combats plus tactiques. |
| **Stats dérivées** | Mouvement, Saut, Initiative — voir [section 6b](#6b-mouvement--formule-de-portée-de-déplacement) pour la formule |
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

> **Modificateur hauteur** (implémenté — plan 046) : ±10%/niveau, plafonds +50%/-30%. Voir section 6.
> **Modificateur terrain** (implémenté — plan 051) : +15% dégâts si type du move correspond au terrain de l'attaquant.
> Autre modificateur : orientation (dos/face — implémenté plan 052, voir section 8). Tout est surchargeable via le système d'override.

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

### Hauteur des tiles (implémenté — plan 046)

`TileState.height` est un `number` (supporte les demi-tiles : 0, 0.5, 1, 1.5, 2, 3…). Tile pleine = hauteur 1.0, demi-tile = 0.5. Les rampes/escaliers sont des séquences de tiles à hauteurs intermédiaires.

**Pathfinding asymétrique (BFS) :**
- `jump` par défaut : 0.5 (tout le monde peut sauter une demi-tile)
- **Montée ≤ 0.5** : autorisée (animation Hop)
- **Montée > 0.5** : bloquée — il faut passer par une rampe
- **Descente** : toujours libre (animation Hop si diff > 0.5, Walk sur les rampes)
- **Vol** : jamais bloqué, coût 1 quel que soit le dénivelé

**Blocage mêlée par la hauteur :**
- Les moves mêlée (range 1) sont bloqués si `|heightDiff| ≥ 2` entre l'attaquant et la cible
- Un Pokemon sur position haute est intouchable en mêlée depuis le sol — il faut monter ou utiliser une attaque à distance

**Bonus/malus d'attaque par la hauteur :**
- +10% de dégâts par niveau d'avantage (attaquant plus haut), plafonné à +50%
- -10% par niveau de désavantage (attaquant plus bas), plafonné à -30%
- S'applique aux dégâts physiques et spéciaux
- Flag `ignoresHeight: true` sur un move supprime ce modificateur (Séisme, Ampleur…)

### Chute & dégâts de chute (implémenté — plan 046)

Déclenchés quand un knockback ou un dash envoie un Pokemon vers une tile plus basse. L'attaquant lui-même subit les dégâts s'il dash dans le vide.

| Chute (diff) | Dégâts |
|---|---|
| ≤ 1.0 | 0 |
| 2.0 | 33% maxHp |
| 3.0 | 66% maxHp |
| 4.0+ | 100% = mort |

Calcul par palier : `Math.floor(diff)` → index dans `[0, 0, 33, 66, 100]`.

- **Types Vol** : immunisés (ils ne tombent pas)
- **Ténacité (Endure)** : ne protège PAS des dégâts de chute
- Le Pokemon atterrit sur la tile de destination si passable ; si hors-grille ou impassable, knockback bloqué, pas de chute
- Émet `BattleEventType.FallDamageDealt { pokemonId, amount, heightDiff }`

### Ligne de vue et obstacles (implémenté — plan 047)

La **ligne de vue (LoS)** détermine si une attaque à distance peut atteindre sa cible. Elle est calculée par un raycast Bresenham 2D entre l'origine et la cible, filtré par la hauteur des tiles traversées.

**Règle de blocage** : une tile obstacle bloque la LoS si `obstacleHeight > referenceHeight + 1`, où `referenceHeight = min(hauteur attaquant, hauteur cible)`. Autrement dit, une tile h3 bloque un tir entre un attaquant h0 et une cible h1 (`min=0`, seuil=1), mais pas entre h1 et h2 (`min=1`, seuil=2). Corrige le cas "tireur sur plateau → cible en contrebas à travers le bord du plateau".

**Portée en hauteur (`withinHeightReach`)** : pour les moves qui ignorent la LoS (sonores et zones telluriques), une règle de portée verticale s'applique : `|hauteur attaquant - hauteur cible| < 2`. Une cible à plus de 1 niveau d'écart ne peut pas être atteinte, même par un move traversant les murs.

**Comportement par type de move :**

| Pattern | Comportement LoS |
|---------|-----------------|
| `single` (distance) | Bloqué si un obstacle coupe la ligne directe. |
| `cone` / `cross` | Chaque case de la zone est vérifiée individuellement par raycast depuis l'origine. |
| `line` | S'arrête sur le premier obstacle qui bloque — les cases derrière sont épargnées. |
| `zone` | Chaque case filtrée : `heightBlocks(tileHeight, epicenterHeight)` + raycast depuis l'épicentre. |
| `blast` (projectile + explosion) | Phase 1 : raycast tireur→cible. Si intercepté, l'explosion se recentre sur la case d'avant le pilier (dernière case libre). Phase 2 : propagation depuis le nouvel épicentre. Tile d'impact affichée en orange dans la preview. |
| `slash` (arc frontal mêlée) | Règle mêlée (`isMeleeBlockedByHeight`) — pas de raycast. |
| `dash` | S'arrête si `heightDiff > 0.5` — le Pokemon fonce dans le mur et subit des dégâts de chute. |
| `self` | Jamais bloqué. |

**Moves qui ignorent la LoS (`ignoresLineOfSight`)** : dérivé des flags, pas d'un flag maison.
- **Moves sonores** (`flags.sound = true`) : Hurlement, Rugissement, Ultrason, Chant — traversent les murs car le son se propage sans ligne de vue.
- **Zones telluriques** (pattern `zone` + type `ground`) : Séisme, Ampleur — attaques qui se propagent par le sol, insensibles aux obstacles verticaux.

**Dash contre mur :** si la trajectoire d'un Dash rencontre une tile infranchissable ou une hauteur trop grande (`heightDiff > 0.5`), le Pokemon s'arrête sur la case devant l'obstacle et émet `BattleEventType.WallImpactDealt` (distinct de `FallDamageDealt`) avec des dégâts proportionnels à la différence de hauteur (`calculateFallDamage(wallHeightDiff)`). KO possible. Types Vol immunisés.

**Preview AoE :** dans l'interface, les cases bloquées par un obstacle n'apparaissent plus dans la zone de preview. Pour les blasts interceptés, l'épicentre décalé est affiché dans une couleur distincte (orange).

### Types de terrain

11 types de terrain définis dans `TerrainType`. Les effets gameplay sont implémentés dans le plan 051 :

| Terrain | Effet gameplay | Immunité terrain |
|---------|---------------|-----------------|
| `normal` | Rien | — |
| `tall_grass` | +1 bonus d'évasion virtuel dans `checkAccuracy` (pas de modification de statStages, aucune cumulation) | — |
| `obstacle` | Bloque mouvement + LOS. Vol : traverse + arrêt. Spectre : traverse, pas d'arrêt. | Vol, Spectre (traverse seul) |
| `water` | Malus déplacement -1 | Eau/Vol (Lévitation Phase 4) |
| `deep_water` | Intraversable + **KO létal** si atterrissage non-immun + bonus dégâts +15% pour moves Eau | Eau/Vol |
| `magma` | Brûlure au passage (traversée) + DOT 1/16 HP/tour (arrêt) + bonus dégâts +15% pour moves Feu | Feu/Vol |
| `lava` | Intraversable + **KO létal** si atterrissage non-immun + bonus dégâts +15% pour moves Feu | Feu/Vol |
| `ice` | Glissade après knockback (slide dans la direction jusqu'à obstacle/mur/Pokemon/bord) + bonus dégâts +15% pour moves Glace | Glace/Vol |
| `sand` | Malus déplacement -1 + bonus dégâts +15% pour moves Sol | Sol/Vol |
| `snow` | Malus déplacement -1 + bonus dégâts +15% pour moves Glace | Glace/Vol |
| `swamp` | Malus déplacement -2 + Poison en EndTurn + bonus dégâts +15% pour moves Poison | Poison/Vol |

> La passabilité est déterminée directement par le terrain (`isTerrainPassable(terrain)`). Le flag `isPassable` a été supprimé de `TileState` (plan 045).
>
> **Règle globale Vol** : pas affecté par les terrains, sauf `obstacle` où Spectre ne peut pas s'arrêter. La Lévitation (talent) sera ajoutée en Phase 4 (décision #245).
>
> **Bonus type/terrain** : +15% dégâts si le type du move correspond au terrain de la tile occupée par l'attaquant. Calculé dans `damage-calculator.ts` via `getTerrainTypeBonusFactor`. Propagé via `terrainModifier` dans `EffectContext` → `ProcessContext`.
>
> **Ice slide** : après un knockback, un Pokemon non-Glace/Vol atterrissant sur `ice` continue à glisser dans la direction du knockback. Collision mur → `WallImpactDealt`. Collision Pokemon → `IceSlideCollision` (dégâts aux deux, la cible ne glisse pas). Handler dans `handle-knockback.ts`.
>
> **KO létal terrain** : atterrir sur `lava` ou `deep_water` est mortel (KO immédiat, event `LethalTerrainKo`). Immunités : type Feu sur `lava`, type Eau sur `deep_water`, type Vol sur tous les terrains létaux. Renderer : texte "Fondu!" pour lava, "Noyé!" pour deep_water.
>
> **Règle un seul statut majeur** : les effets terrain (brûlure passage magma, poison swamp EndTurn) respectent la règle `isMajorStatus` — un Pokemon avec un statut majeur existant n'en reçoit pas un second via un terrain.

### Influence du terrain sur la précision
Le système de précision Pokemon (précision attaque × évasion cible) est conservé, avec des **modificateurs terrain** :
- **Herbe haute** : +1 bonus d'évasion virtuel appliqué dans `checkAccuracy` uniquement si le défenseur est sur `tall_grass` au moment du calcul (implémenté plan 051 — aucune modification de `statStages`, aucune cumulation)
- **Glace** : malus précision à l'attaquant (terrain instable) ? — à définir Phase 3
- **Hauteur supérieure** : bonus précision à l'attaquant (avantage du surplomb) ? — à définir Phase 3
- **Eau profonde** : malus évasion aux non-Eau ? — à définir Phase 3

> Tout est surchargeable via le système d'override.

### Interactions terrain / type
- Les Pokemon **Vol** peuvent survoler obstacles et dénivelés, et sont immunisés à tous les effets terrain (implémenté plan 051)
- Les Pokemon **Feu** sont immunisés à magma/lava (implémenté plan 051)
- Les Pokemon **Eau** nagent dans l'eau sans malus (implémenté plan 051)
- Les Pokemon **Glace** ne glissent pas sur ice après knockback (implémenté plan 051)
- Les Pokemon **Poison** ne sont pas empoisonnés par swamp (implémenté plan 051)
- Les attaques peuvent **modifier le terrain** (Champ Herbeux, Champ Électrifié, etc.) — Phase 3+

---

## 6b. Mouvement — formule de portée de déplacement

Le mouvement (nombre de tiles par tour) est dérivé de la **base speed** du Pokemon (stat officielle, indépendante du niveau) et des **stages de vitesse** en combat (-6 à +6).

### Formule

```
effectiveSpeed = floor(baseSpeed × stageMultiplier)
movement = palier correspondant (voir table ci-dessous)
```

Le `stageMultiplier` est celui des jeux Pokemon : `(2 + stages) / 2` si positif, `2 / (2 - stages)` si négatif. Soit x0.25 à x4.0.

### Paliers de mouvement

| Move | Vitesse effective | Exemples stage 0 |
|------|-------------------|-------------------|
| **2** | ≤ 20 | Ramoloss (15), Racaillou (20), Rondoudou (20) |
| **3** | 21–45 | Ronflex (30), Machoc (35), Bulbizarre (45) |
| **4** | 46–85 | Évoli (55), Caninos (60), Fantominus (80) |
| **5** | 86–170 | Pikachu (90), Dracaufeu (100), Electrode (150) |
| **6** | 171–340 | *Uniquement via buffs (ex: Hâte ×1 sur base 86+)* |
| **7** | ≥ 341 | *Uniquement via buffs (ex: Hâte ×2 sur base 86+)* |

**Plancher : 2. Plafond : 7.**

### Pourquoi la base speed et pas la combat speed ?

La combat speed dépend du niveau (`floor(2 × base × level / 100) + 5`). Si on l'utilisait, un Pikachu niveau 5 aurait 14 de combat speed → move 2, aussi lent que Ramoloss. En se basant sur la base speed (fixe par espèce), le mouvement est **constant quel que soit le niveau** — seuls les stages en combat le modifient.

### Interactions avec les buffs/debuffs

| Situation | Effet sur le mouvement |
|-----------|------------------------|
| Hâte (+2 stages, ×2.0) | +1 à +2 move selon le Pokemon |
| Double Hâte (+4 stages, ×3.0) | Rapides atteignent move 7 |
| Paralysie (si impacte speed) | Réduit le mouvement via le stage |
| Toile Gluante, Vent Arrière | Modificateurs futurs possibles |

### Exemples concrets avec Hâte

| Pokemon (base) | Stage 0 | +2 (Hâte) | +4 | +6 |
|----------------|---------|-----------|-----|-----|
| Ramoloss (15) | 2 | 3 | 3 | 4 |
| Ronflex (30) | 3 | 4 | 5 | 5 |
| Bulbizarre (45) | 4 | 5 | 5 | 6 |
| Pikachu (90) | 5 | 6 | 7 | 7 |
| Electrode (150) | 5 | 7 | 7 | 7 |

### Principes de design

- **Inspiré de Pokemon Conquest** : mouvement fixe par espèce, range serré (Conquest : 2–4).
- **Aucun jeu tactique de référence** (FFT, Fire Emblem, Disgaea, Advance Wars) ne dérive le mouvement de la vitesse directement — c'est toujours une stat fixe. Ici on fait un compromis : fixe par espèce mais modifiable par les buffs de vitesse.
- **Move 5 max naturel** : sur une grille 12×12, move 5 permet de traverser ~40% de la carte. Move 6–7 est réservé aux buffs pour rester impactant.
- **Distribution Gen 1** : ~9% move 2 / ~22% move 3 / ~37% move 4 / ~32% move 5 — bonne répartition sur 4 tiers.
- **Extensible** : les paliers peuvent être ajustés si on introduit des cartes plus grandes.

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

### Statuts majeurs (1 seul à la fois sur un Pokemon)
| Statut | Effet | Durée |
|--------|-------|-------|
| Brûlure | Dégâts 1/16 HP max/tour + -50% Attaque phys | Permanent (jusqu'à guérison) |
| Paralysie | -50% initiative permanent + 25% proc bloque Move et Dash (pas use_move non-dash) | Permanent |
| Poison | Dégâts 1/8 HP max/tour | Permanent |
| **Poison grave** | Dégâts croissants : `toxicCounter/16` HP max/tour (1/16 → 15/16, cap 15) | Permanent — `toxicCounter` incrémenté à chaque tick |
| Gel | Ne peut pas agir, 20% chance de dégel par tour | Variable |
| Sommeil | Ne peut pas agir, se réveille après 1-3 tours | 1-3 tours |

### Statuts volatils (coexistent avec un statut majeur, stockés dans `volatileStatuses[]`)
| Statut | Effet | Durée |
|--------|-------|-------|
| **Confusion** | 50% chance/tour de dérailler (redirection allié aléatoire, direction aléatoire AoE, tour perdu si aucun allié) | 2-5 tours |

### Stacking
- **1 statut majeur max** — comme Pokemon : un nouveau statut ne s'applique pas si un statut majeur est déjà actif
- **Statuts volatils** : coexistent avec les statuts majeurs et entre eux. Distinction par le champ de stockage (`status` vs `volatileStatuses[]`).

### Questions ouvertes sur les statuts
- **Interaction terrain** : un Pokemon Brûlé sur eau = guéri ? Un Pokemon sur glace = plus facile à geler ? (Phase 2)
- **Guérison active** : par talent, objet, ou capacité (Repos, Glas de Soin, Psycho-Transfert, Rune Protect — prévus Phase 1)

---

## 7d. Moves défensifs (implémentés — plan 023)

Huit moves défensifs adaptés au contexte tactique.

**Règle générale de durée** : un move défensif actif dure "jusqu'au prochain tour du lanceur". Exception : Prévention est consommé au premier coup reçu. Si le lanceur est KO pendant que l'effet est actif, l'effet disparaît immédiatement.

| Move | Effet | Notes d'adaptation |
|------|-------|-------------------|
| **Abri** / Protect | Bloque les attaques de face et de côtés. | Directionnel (dos vulnérable). Pas de spam penalty. |
| **Détection** / Detect | Clone d'Abri, même effet. | Distribution roster différente. |
| **Garde Large** / Wide Guard | Bloque les AoE dans un rayon de 2 tiles, protège les alliés dans ce rayon. | Portée localisée (adapté grille). Disparaît si KO. |
| **Prévention** / Quick Guard | Bloque la prochaine attaque reçue (toute direction). Consommé en 1 coup. | Repurposé : omnidirectionnel mais à 1 usage. |
| **Riposte** / Counter | Prend les dégâts d'attaques au contact, renvoie x2. Actif toute la durée. | Contact uniquement. Pas de renvoi si KO. |
| **Voile Miroir** / Mirror Coat | Prend les dégâts d'attaques à distance, renvoie x2. Actif toute la durée. | Distance uniquement. Pas de renvoi si KO. |
| **Fulmifer** / Metal Burst | Prend les dégâts (contact ou distance), renvoie x1.5. Actif toute la durée. | Universel, multiplicateur plus faible. Pas de renvoi si KO. |
| **Ténacité** / Endure | Ne peut pas tomber en dessous de 1 PV. | Spam penalty (pas 2 tours de suite). Ne bloque PAS statut/terrain/chute. |

**Différences notables avec le jeu Pokemon de base :**
- Abri/Détection sont directionnels — le dos reste exposé
- Abri/Détection n'ont pas de spam penalty (la contrainte directionnelle suffit)
- Prévention est repurposée : bloque 1 coup (toute direction) au lieu de bloquer les moves prioritaires
- Garde Large est localisée à un rayon de 2 tiles au lieu de protéger toute l'équipe

---

## 7d bis. Blast + Protect — interaction directionnelle

Pour les moves de type Blast, le check directionnel d'Abri/Détection est effectué depuis le **centre de l'explosion** (paramètre `targetPosition`) et non depuis la position du lanceur.

Conséquence tactique : cibler une tile **derrière** un Pokemon qui utilise Abri contourne sa protection. La case d'explosion se trouve dans le dos du défenseur — l'onde de choc contourne le bouclier.

> Ceci crée une interaction tactique intentionnelle : Abri/Détection bloquent le tir direct, mais pas un Blast qui atterrit derrière soi. Le joueur peut donc choisir la tile d'impact pour contourner la défense.

---

## 7e. Vampigraine — statut volatil `Seeded` (refactoré plan 031)

Vampigraine plante une graine sur la cible qui **draine des PV chaque tour et les rend au lanceur**.

**Implémentation :** statut volatil `Seeded` avec `sourceId` (plus de lien à distance, plus de `ActiveLink`).

**Comportement :**
- **Portée de lancer** : 1-3 tiles
- **Drain** : 1/8 HP max de la cible par tour en EndTurn — soigné au lanceur si encore en vie
- **Immunité** : les Pokemon de type Plante ne peuvent pas être ensemencés
- **Pas de maxRange** : le drain est permanent quelle que soit la distance
- **Rupture** : lanceur KO (le drain s'arrête, pas de soin) ; Rapid Spin (futur) ; case Feu/lave (futur)
- Un lanceur peut poser Vampigraine sur plusieurs cibles simultanément

**Pourquoi c'est tactique :**
- Drain passif permanent → pression continue sur la cible
- Immunité Plante → lecture du roster adverse importante
- Combo : Vampigraine + moves de ralentissement/blocage pour maximiser le drain

---

## 7f. Piège — statut volatil `Trapped` (refactoré plan 031)

Les attaques de type "piège" (Ligotage/Wrap, Étreinte, Danse Flammes...) appliquent le statut volatil **`Trapped`** sur la cible.

**Comportement :**
- **Immobilisation** : la cible ne peut pas se déplacer (Move) tant que le statut est actif
- La cible **peut** toujours attaquer (Act)
- **Dégâts passifs** : 1/8 HP max par tour en EndTurn (sans heal au lanceur)
- **Durée** : N tours (configurable par move)
- **Sortie anticipée** : knockback reçu ou dash reçu libère la cible ; Rapid Spin (futur)
- **Pas de lien source-cible** : le lanceur peut bouger librement après avoir piégé

**Différence clé avec Vampigraine :**
| Propriété | Vampigraine (`Seeded`) | Piège (`Trapped`) |
|-----------|----------------------|-------------------|
| Drain vers source | Oui (1/8 HP/tour) | Non |
| Immobilise la cible | Non | Oui (Move bloqué) |
| Durée | Permanente (jusqu'à rupture) | N tours |
| Lien source-cible | Non (sourceId pour le drain) | Non |
| Dégâts/tour | 1/8 HP | 1/8 HP |
| Immunité | Type Plante | Aucune |

---

## 7g. Knockback — poussée via Draco-Queue (implémenté — plan 026)

Certaines attaques repoussent la cible de N cases dans la direction opposée au lanceur.

**Comportement :**
- S'exécute **après** les dégâts dans le pipeline d'effets
- Pousse chaque cible individuellement selon sa position relative au lanceur
- **Bloqué si** : bord de grille, tile occupée (allié, ennemi, corps KO)
- Si bloqué : pas de déplacement, les dégâts sont infligés normalement
- Avec pattern slash : chaque cible est poussée dans sa propre direction

---

## 7h. Multi-hit (implémenté — plan 026)

Certaines attaques frappent plusieurs fois en une seule action.

**Deux modes :**
- **Fixe** (ex: Double Pied) : `hits: 2` — toujours 2 coups
- **Variable** (ex: Combo-Griffe) : `hits: { min: 2, max: 5 }` — roll 35/35/15/15% pour 2/3/4/5 coups

**Comportement :**
- Un seul accuracy check au début (pas par hit)
- Chaque hit = event `DamageDealt` séparé (peut trigger Riposte/Voile Miroir)
- Stop si cible KO avant la fin des hits
- Event `MultiHitComplete` en fin de séquence

---

## 7i. Recharge — Ultralaser (implémenté — plan 026)

Après utilisation d'un move avec `recharge: true`, le Pokemon ne peut pas attaquer au tour suivant.

**Comportement :**
- Le Pokemon **peut** se déplacer (Move) et choisir sa direction en fin de tour
- `getLegalActions` ne retourne aucune action `use_move` pendant le tour de recharge
- Le flag `recharging` est reset en fin du tour de recharge (quand le Pokemon n'a pas attaqué)
- Si KO pendant la recharge, le flag est sans effet

---

## 7j. Badly Poisoned — poison grave (implémenté — plan 026)

**Statut majeur** (exclusif avec les autres statuts majeurs, comme le poison normal).

- Compteur `toxicCounter` sur le Pokemon, démarre à 1, +1 par tour, plafonne à 15
- Dégâts par tour = `max(1, floor(maxHp * toxicCounter / 16))`
- Dégâts croissants : 1/16, 2/16, 3/16... jusqu'à 15/16 du max HP

---

## 7k. Confusion tactique (implémentée — plan 026)

**Statut volatil** — coexiste avec un statut majeur. Stocké dans `volatileStatuses[]`.

Dure 2-5 tours. Chaque tour : 50% de chance que l'action déraille.

| Situation | Comportement si confusion déclenche |
|-----------|--------------------------------------|
| Attaque single/dash | Cible redirigée vers un **allié aléatoire à portée** |
| Attaque AoE (cône, ligne, slash) | **Direction aléatoire** |
| Attaque zone self | Exécutée normalement (friendly fire gère) |
| Buff self | Fonctionne normalement |
| Aucun allié à portée | **Tour perdu** |
| Déplacement | Direction aléatoire, 1-2 cases |

---

## 8. Orientation & positionnement (style FFTA)

Chaque Pokemon a une **orientation** (la direction dans laquelle il regarde).
- L'orientation se met à jour quand le Pokemon se déplace ou attaque
- Ajoute une couche tactique : tourner le dos à l'ennemi est dangereux, le positionnement autour d'une cible compte

### Choix de direction en fin de tour (implémenté — plan 012)

- **Direction obligatoire** : le joueur choisit toujours sa direction avant de terminer son tour (`EndTurn` exige une `Direction`)
- **4 directions** : `getLegalActions` génère 4 actions `EndTurn` (une par direction)
- **Orientation initiale** : chaque Pokemon regarde le centre de la grille au spawn (calculé via `directionFromTo`)
- **UI style FFT** : `DirectionPicker` — flèches spritesheet positionnées au-dessus du sprite, flèche active jaune / inactives grises
- **Détection quadrants** : la direction est déterminée par la position de la souris dans les 4 quadrants cardinaux écran (croix horizontale/verticale)
- **Barre PV masquée** pendant le choix de direction pour améliorer la lisibilité

### Modificateur d'orientation sur les dégâts (implémenté — plan 052)

Le modificateur d'orientation affecte **uniquement les dégâts** (pas l'évasion, pas la résistance aux statuts). Il est calculé depuis la **zone de frappe** relative à l'orientation du défenseur :

| Zone | Modificateur | Condition |
|------|-------------|-----------|
| **Dos** | +15% (×1.15) | L'attaque arrive dans la même direction que l'orientation du défenseur |
| **Flanc** | neutre (×1.0) | L'attaque arrive perpendiculairement |
| **Face** | -15% (×0.85) | L'attaque arrive en direction opposée à l'orientation du défenseur |

- Implémenté dans `packages/core/src/battle/facing-modifier.ts` : `FacingZone`, `getFacingZone(attackOrigin, defender)`, `getFacingModifier(zone)`
- `getFacingZone` utilise `directionFromTo(attackOrigin, defender.position)` et compare avec `defender.orientation`
- Intégré dans `calculateDamage()`, `estimateDamage()`, `processEffects()` via `facingModifierMap` par cible
- Pour les moves **Blast** : l'origine de l'attaque est l'**épicentre** (position d'impact), pas la position du lanceur
- `BattleEngine.estimateDamage()` accepte un `targetPosition` optionnel pour le calcul Blast
- **Preview renderer** : suffixe `(+15%)` ou `(-15%)` dans le texte de preview dégâts, aucun suffixe si neutre
- Les moves sans puissance (statuts) retournent `facingModifier: 1.0` sans calcul

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
