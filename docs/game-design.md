# Game Design — Pokemon Tactics

> Vision et règles du jeu. Architecture : [architecture.md](architecture.md). Décisions : [decisions.md](decisions.md).

---

## 1. Pitch

Combat tactique sur grille isométrique :
- **Pokemon** : chacun avec 4 attaques, 1 talent, 1 objet tenu
- **Final Fantasy Tactics Advance** : déplacements sur grille, dénivelés, AoE
- **Style HD-2D** (Octopath Traveler) : sprites 2D sur environnements 3D

**Scope actuel : combat tactique uniquement.** Pas d'aventure, pas d'histoire, pas d'évolutions.

### Inspirations
- **Pokemon** — types, stats, capacités
- **FFTA** — grille, initiative, AoE, Move+Act
- **Fire Emblem** (Advance+) — positionnement, blocage
- **Advance Wars** — tactique grille, lisibilité
- **Triangle Strategy** — référence visuelle HD-2D
- **Dofus**, **Le Donjon de Naheulbeuk** — tactical RPGs avec AoE et friendly fire

---

## 2. Format de combat

- **12 Pokemon max** simultanément sur le terrain
- **Jusqu'à 12 joueurs** — équipes ou free-for-all
- Formats : 2p (6v6 max), 3p (4v4v4), 4p (3v3v3v3), 6p (2v2×6), 12p (1×12)
- **Taille d'équipe configurable** par format — base = 6v6. Définie avant le combat.
- **Multijoueur local hot-seat** (style Civilization)
- **Pas de brouillard de guerre** — chaque joueur voit tout
- **FFA = chacun pour soi** — pas d'alliances dynamiques
- Multijoueur réseau : plus tard

---

## 2b. Phase de placement

- **Carte porte les zones de spawn** : chaque `MapDefinition` déclare zones spawn par équipe pour chaque format. `Position[]` arbitraires.
- **Alternance serpent** (défaut) : P1-P2-P2-P1-P1-P2... Plus équitable — avantage informationnel s'inverse à chaque paire.
- **Mode random** : positions tirées sans remise, seed injectable pour replay.
- **Repositionnement** : uniquement le Pokemon du tour courant (undo).
- **Direction** : choix obligatoire après chaque placement via `DirectionPicker`. Mode random : direction calculée vers le centre.
- **IA** : placement random instantané (`PlayerController.Ai`).
- **`PlacementPhase` séparé de `BattleEngine`** : placement terminé → positions finales passées à `BattleEngine`.

---

## 2c. Sélection d'équipe (TeamSelectScene)

- **Grille de portraits** : 5×4, portraits 82px — 20 Pokemon du roster
- **Sélecteur d'équipes** : bouton cyclique (2→3→4→6→12→2). `maxPokemonPerTeam` = 12 / teamCount
- **Layout dynamique** : encadrés d'équipe en 2 colonnes. Impair → colonne gauche +1 équipe.
- **Encadrés d'équipe** : couleur `TEAM_COLORS[index]` — 12 couleurs distinctes (décision #202-204)
- **Sélection** : clic portrait → ajouté à l'équipe active (max `maxPokemonPerTeam`, 1 exemplaire/espèce/équipe). Mirror match autorisé entre équipes (décision #184)
- **Toggle Humain/IA** : IA vs IA possible sur toutes les équipes (décision #185)
- **Bouton Auto** : randomize toute l'équipe
- **Bouton Vider** : réinitialise à 0 Pokemon
- **Bouton Remplir IA** : remplit toutes équipes manquantes avec IA aléatoires
- **Bouton Valider** : valide via `validateTeamSelection()`, affiche erreurs i18n si invalide
- **Toggle Placement auto / manuel** : contrôle `PlacementMode`. **Auto activé par défaut** (depuis plan 054).
- **Toggle CT / Round-Robin** : `BattleConfig.turnSystem`. **CT activé par défaut** (depuis plan 054).
- **Noms Pokemon** : FR ou EN selon langue active (`@pokemon-tactic/data`)
- **Bypass sandbox** : `VITE_SANDBOX` court-circuite `TeamSelectScene` entièrement

**Flow :** `TeamSelectScene` → `BattleScene` (placement) → Combat → Victoire (Rejouer ou Retour menu)

---

## 3. Pokemon

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — stats officielles Pokemon |
| **Niveau de combat** | Fixé à **50**. Stats calculées avec formule Pokemon Gen 5+ au niveau 50 (sans IV/EV pour le POC). |
| **Stats dérivées** | Mouvement, Saut, Initiative — voir [section 6b](#6b-mouvement--formule-de-portée-de-déplacement) |
| **Types** | 18 types, faiblesses/résistances |
| **4 Attaques** | Puissance, précision, PP, type, catégorie (phys/spé/statut), **pattern AoE**, **portée** — surchargeable pour équilibrage |
| **1 Talent** | Capacité passive (ex: Intimidation, Lévitation...) |
| **1 Objet tenu** | Effet passif ou consommable |

---

## 4. Système de tour — Dual-mode RR/CT (plan 054)

Le moteur supporte deux systèmes via `BattleConfig.turnSystem` :

### 4a. Round-Robin (mode `'round-robin'`)

Chaque Pokemon joue une fois par round dans l'ordre d'initiative. Initiative recalculée à chaque round. Pas de CT.

### 4b. Charge Time (mode `'charge-time'`, activé par défaut depuis plan 054)

Inspiré de FFTA et FFX. Chaque Pokemon accumule des CT points à chaque tick. Celui qui atteint le seuil agit en premier.

**Formule `ctGain` :**
```
ctGain = floor((30 + floor(20 × ln(baseStat + 1))) × softMult(speedStages × 0.7))
```
- CT de départ : 600 / Seuil d'action : 1000
- 1 seul acteur par tick (le plus haut CT parmi ceux ≥ 1000)
- Ratio fréquence Pikachu/Geodude (neutre) ≈ 1.50×, plafonné à 1.5×

**Coût CT par action (`computeCtCost`) :**

| Source | Coût |
|--------|------|
| Wait | 350 |
| Move seul | 400 |
| Move + Attaque | move + atk - 150 |
| PP 20 | 500, PP 16 → 600, PP 12 → 700, PP 8 → 900 |
| Power ≥ 70 | 600, ≥ 90 → 700, ≥ 110 → 900 |
| `effectTier: reactive` | 500 (fixe) |
| `effectTier: major-status` | floor 700 |
| `effectTier: major-buff` | floor 600 |
| `effectTier: double-buff` | floor 550 |

Coût final = `max(ppCost(pp), powerFloor(power), effectFloor(effectTier))`.

**`effectTier` dans les surcharges tactiques :**
- `reactive` : protect, detect, wide-guard, quick-guard, counter, mirror-coat, metal-burst, endure
- `major-status` : thunder-wave, hypnosis, sing, sleep-powder, toxic
- `major-buff` : swords-dance, agility, iron-defense, minimize
- `double-buff` : calm-mind, bulk-up, withdraw, stockpile

**Interface TurnSystem :**
```typescript
interface TurnSystem {
  getNextActorId(): string;
  onActionComplete(pokemonId: string, actionCost: number): void;
  onPokemonKO(pokemonId: string): void;
}
```
Implémentée par `RoundRobinTurnSystem` et `ChargeTimeTurnSystem`.

**`ChargeTimeTurnSystem.getCtSnapshot()`** : expose état CT courant pour renderer (timeline CT).

**UI CT :**
- `TurnTimeline` : séquence prédictive scrollable style FFX (plan 059) — 24 entrées simulées par `predictCtTimeline(count, moveId?)`, slot 0 ancré, 11 slots scrollables molette. Au `confirm_attack` : séquence recalculée avec coût move, Pokemon actif mis en évidence (bordure teal-vert `TIMELINE_HIGHLIGHT_BORDER_COLOR`). Entrée tail (portrait semi-transparent + "...") si Pokemon absent des 24 slots.
- `ActionMenu` : PP masqués, coût CT affiché
- `TeamSelectScene` : toggle CT/RR, CT par défaut

> Vulgarisation joueur : `docs/wiki/ct-system.md`.

---

## 5. Système d'équilibrage par surcharge (override)

```
Valeur finale = valeur officielle Pokemon → surcharge globale tactique → surcharge par capacité/talent/objet
```

Exemples :
- **Par attaque** : PP ajustés, dégâts modifiés, portée/AoE ajoutée
- **Par talent** : effet adapté pour contexte grille
- **Formule dégâts** : multiplicateurs tactiques (hauteur, orientation, terrain)
- **Par Pokemon** : stats dérivées (mouvement, saut, initiative)

> Si les PP ne fonctionnent pas, remplaçables par points d'action style FFTA via le même système de surcharge.

---

## 5b. Formule de dégâts (implémentée)

Basée sur formule Pokemon Gen 5+, adaptée au contexte tactique.

```
Dégâts = ((2 × Level / 5 + 2) × Power × (Atk / Def) / 50 + 2)
         × STAB × Effectiveness × random
```

| Modificateur | Valeur | Condition |
|---|---|---|
| **STAB** | ×1.5 | Attaque même type que lanceur |
| **Effectiveness** | ×0, ×0.25, ×0.5, ×1, ×2, ×4 | Tableau types 18×18 |
| **Burn** | ×0.5 | Sur Attaque physique si lanceur brûlé |
| **random** | ×0.85–1.00 (uniforme) | Variance ±15% |

**Preview dégâts** (plan 019) :
- `estimateDamage(attackerId, moveId, defenderId)` retourne `{ min, max, effectiveness }`
- `min` = roll 0.85, `max` = roll 1.00
- `effectiveness = 0` → affiche "Immune"

> **Modificateur hauteur** (plan 046) : ±10%/niveau, plafonds +50%/-30%.
> **Modificateur terrain** (plan 051) : +15% si type move correspond au terrain attaquant.
> **Orientation** (plan 052) : dos/face — voir section 8.

---

## 6. Grille & Terrain

- Grille isométrique avec **dénivelés** (hauteur variable par tile)
- **Mouvement** : tiles de déplacement par Pokemon
- **Pas de diagonal** (style FFTA / Fire Emblem) — 4 directions uniquement
- **Saut** : capacité à franchir les dénivelés

### Blocage & traversée
- Chaque Pokemon **occupe une tile** et bloque les ennemis
- **Alliés se traversent** librement (déplacement ET dash)
- **Ennemis et obstacles bloquent** le passage
- **Exceptions** : types Vol et Spectre traversent aussi les ennemis

### Hauteur des tiles (plan 046)

`TileState.height` est `number` (demi-tiles : 0, 0.5, 1, 1.5, 2, 3…). Tile pleine = 1.0, demi-tile = 0.5.

**Pathfinding asymétrique (BFS) :**
- `jump` par défaut : 0.5
- **Montée ≤ 0.5** : autorisée (animation Hop)
- **Montée > 0.5** : bloquée — passer par une rampe
- **Descente** : toujours libre
- **Vol** : jamais bloqué, coût 1 quel que soit le dénivelé

**Blocage mêlée par hauteur :**
- Moves mêlée (range 1) bloqués si `|heightDiff| ≥ 2`

**Bonus/malus attaque par hauteur :**
- +10% dégâts par niveau d'avantage (attaquant plus haut), plafond +50%
- -10% par niveau désavantage, plafond -30%
- `ignoresHeight: true` supprime ce modificateur (Séisme, Ampleur…)

### Chute & dégâts de chute (plan 046)

Déclenchés quand knockback ou dash envoie Pokemon vers tile plus basse.

| Chute (diff) | Dégâts |
|---|---|
| ≤ 1.0 | 0 |
| 2.0 | 33% maxHp |
| 3.0 | 66% maxHp |
| 4.0+ | 100% = mort |

Calcul : `Math.floor(diff)` → index dans `[0, 0, 33, 66, 100]`.

- **Types Vol** : immunisés
- **Ténacité** : ne protège PAS des dégâts de chute
- Émet `BattleEventType.FallDamageDealt { pokemonId, amount, heightDiff }`

### Ligne de vue et obstacles (plan 047)

**LoS** calculée par raycast Bresenham 2D entre origine et cible, filtré par hauteur tiles traversées.

**Règle blocage** : tile obstacle bloque LoS si `obstacleHeight > referenceHeight + 1`, où `referenceHeight = min(hauteur attaquant, hauteur cible)`.

**Portée en hauteur (`withinHeightReach`)** : pour moves qui ignorent LoS, `|hauteur attaquant - hauteur cible| < 2`.

**Comportement par type de move :**

| Pattern | Comportement LoS |
|---------|-----------------|
| `single` (distance) | Bloqué si obstacle coupe ligne directe. |
| `cone` / `cross` | Chaque case vérifiée individuellement par raycast depuis origine. |
| `line` | S'arrête sur premier obstacle — cases derrière épargnées. |
| `zone` | Chaque case filtrée : `heightBlocks(tileHeight, epicenterHeight)` + raycast depuis épicentre. |
| `blast` | Phase 1 : raycast tireur→cible. Si intercepté, explosion recentrée sur case avant pilier. Phase 2 : propagation depuis nouvel épicentre. |
| `slash` | Règle mêlée (`isMeleeBlockedByHeight`) — pas de raycast. |
| `dash` | S'arrête si `heightDiff > 0.5` — dégâts de chute. |
| `self` | Jamais bloqué. |

**Moves qui ignorent LoS (`ignoresLineOfSight`)** :
- **Moves sonores** (`flags.sound = true`) : Hurlement, Rugissement, Ultrason, Chant
- **Zones telluriques** (pattern `zone` + type `ground`) : Séisme, Ampleur

### Types de terrain

11 types de terrain dans `TerrainType` (implémentés plan 051) :

| Terrain | Effet gameplay | Immunité terrain |
|---------|---------------|-----------------|
| `normal` | Rien | — |
| `tall_grass` | +1 bonus évasion virtuel dans `checkAccuracy` si défenseur sur tile | — |
| `obstacle` | Bloque mouvement + LOS. Vol : traverse + arrêt. Spectre : traverse, pas d'arrêt. | Vol, Spectre (traverse seul) |
| `water` | Malus déplacement -1 | Eau/Vol/Lévitation |
| `deep_water` | Intraversable + **KO létal** si atterrissage non-immun + bonus dégâts +15% moves Eau | Eau/Vol |
| `magma` | Brûlure au passage (traversée) + DOT 1/16 HP/tour (arrêt) + bonus dégâts +15% moves Feu | Feu/Vol |
| `lava` | Intraversable + **KO létal** si atterrissage non-immun + bonus dégâts +15% moves Feu | Feu/Vol |
| `ice` | Glissade après knockback (slide jusqu'à obstacle) + bonus dégâts +15% moves Glace | Glace/Vol |
| `sand` | Malus déplacement -1 + bonus dégâts +15% moves Sol | Sol/Vol |
| `snow` | Malus déplacement -1 + bonus dégâts +15% moves Glace | Glace/Vol |
| `swamp` | Malus déplacement -2 + Poison en EndTurn + bonus dégâts +15% moves Poison | Poison/Vol |

> **Règle globale Vol** : pas affecté par terrains, sauf `obstacle` où Spectre ne peut pas s'arrêter. **Lévitation** confère mêmes immunités terrain que type Vol — plan 069+070. Ne peut pas atterrir sur lava/deep_water.
>
> **Bonus type/terrain** : +15% dégâts si type move correspond au terrain tile occupée par l'attaquant. Via `getTerrainTypeBonusFactor`.
>
> **Ice slide** : Pokemon non-Glace/Vol atterrissant sur `ice` après knockback continue à glisser. Collision mur → `WallImpactDealt`. Collision Pokemon → `IceSlideCollision`.
>
> **KO létal terrain** : atterrir sur `lava` ou `deep_water` = KO immédiat (`LethalTerrainKo`). Renderer : "Fondu!" pour lava, "Noyé!" pour deep_water.
>
> **Règle un seul statut majeur** : effets terrain respectent `isMajorStatus`.

### Influence du terrain sur la précision
- **Herbe haute** : +1 bonus évasion virtuel si défenseur sur `tall_grass`
- **Glace/Hauteur supérieure/Eau profonde** : modificateurs de précision — à définir Phase 3

---

## 6b. Mouvement — formule de portée de déplacement

Mouvement dérivé de la **base speed** du Pokemon et des **stages de vitesse** en combat (-6 à +6).

### Formule

```
effectiveSpeed = floor(baseSpeed × stageMultiplier)
movement = palier correspondant
```

`stageMultiplier` : `(2 + stages) / 2` si positif, `2 / (2 - stages)` si négatif. Soit ×0.25 à ×4.0.

### Paliers de mouvement

| Move | Vitesse effective | Exemples stage 0 |
|------|-------------------|-------------------|
| **2** | ≤ 20 | Ramoloss (15), Racaillou (20), Rondoudou (20) |
| **3** | 21–45 | Ronflex (30), Machoc (35), Bulbizarre (45) |
| **4** | 46–85 | Évoli (55), Caninos (60), Fantominus (80) |
| **5** | 86–170 | Pikachu (90), Dracaufeu (100), Electrode (150) |
| **6** | 171–340 | *Uniquement via buffs* |
| **7** | ≥ 341 | *Uniquement via buffs* |

**Plancher : 2. Plafond : 7.**

Basé sur `baseSpeed` (fixe par espèce), pas `combat speed` (dépend du niveau). Mouvement **constant quel que soit le niveau** — seuls les stages le modifient.

### Exemples avec Hâte

| Pokemon (base) | Stage 0 | +2 (Hâte) | +4 | +6 |
|----------------|---------|-----------|-----|-----|
| Ramoloss (15) | 2 | 3 | 3 | 4 |
| Ronflex (30) | 3 | 4 | 5 | 5 |
| Bulbizarre (45) | 4 | 5 | 5 | 6 |
| Pikachu (90) | 5 | 6 | 7 | 7 |
| Electrode (150) | 5 | 7 | 7 | 7 |

---

## 7. Aires d'effet (AoE)

**Friendly fire : OUI** — AoE touchent les alliés. Force positionnement tactique.

### Types de portée
- **Mêlée** : tile adjacente
- **Portée X** (1-3, 2-4...) : cible à distance, single tile
- **Portée + AoE** : cible un point à distance, effet se propage en zone
- **Zone self** (portée 0) : zone centrée sur lanceur (Brouillard, Ampleur)
- **Cône** : largeur dynamique = `distance * 2 - 1` (distance 1→1 case, 2→3 cases, 3→5 cases). Ex: Dracosouffle, Blizzard
- **Slash / arc frontal** : 3 cases devant (face + 2 perpendiculaires). Ex: Tranch'Herbe, Cru-Aile
- **Blast** : projectile à distance (`range`) + explosion en cercle (`radius`). Ex: Bombe-Beurk
- **Croix** : centré sur caster, pas de portée. Ex: Éclate-Roc, Ombre Nuit
- **Ligne** : ligne droite depuis lanceur
- **Dash** : lanceur se déplace en ligne + frappe

### Effets spéciaux (flags)

| Propriété | Description | Exemples |
|-----------|-------------|---------|
| **knockback** | Repousse N cases | Cyclone, Draco-Queue |
| **warp** | Téléporte lanceur sur cible | Tunnel, Vol, Téléport |
| **ground** | Zone persistante au sol (N tours) | Picots, Piège de Roc |
| **self-damage** | Lanceur subit dégâts | Voltacle, Bélier |
| **pierce** | Traverse les cibles | Laser traversant |
| **ignore-height** | Ignore bonus/malus hauteur | Séisme, Ampleur |

---

## 7b. Attaques de priorité → Attaques Dash

**Solution retenue : attaques de priorité = Dash.**

Le Pokemon **se déplace en ligne droite** sur X tiles et frappe le premier ennemi rencontré.

**Propriétés :**
- 4 directions (pas de diagonale)
- Distance max variable par attaque (ex: Vive-Attaque = 2 tiles, Vitesse Extrême = 5 tiles)
- Frappe **premier ennemi** rencontré — s'arrête **à côté** après impact
- **Dash dans le vide** : aucun ennemi sur chemin → déplacement jusqu'à case ciblée sans frapper. Consomme Act, pas Move.
- Ne consomme **pas** `hasMoved` — peut encore se déplacer après
- **Traverse les alliés**, bloqué par ennemis et obstacles

---

## 7c. Effets de statut

### Statuts majeurs (1 seul à la fois)
| Statut | Effet | Durée |
|--------|-------|-------|
| Brûlure | Dégâts 1/16 HP max/tour + -50% Attaque phys | Permanent |
| Paralysie | -50% initiative + **12.5% proc** bloque Move et Dash | Permanent |
| Poison | Dégâts 1/8 HP max/tour | Permanent |
| **Poison grave** | Dégâts croissants : `toxicCounter/16` HP max/tour (1/16→15/16, cap 15) | Permanent |
| Gel | Ne peut pas agir, **25% chance de dégel/tour**, **max 3 tours** | 1-3 tours |
| Sommeil | Ne peut pas agir, se réveille après **sample([2, 3, 3])** (≈ 2-3 tours) | 2-3 tours |

> Valeurs **Pokemon Champions** (décisions #263–264). `StatusRules` injecté dans `BattleEngine` ; `DEFAULT_STATUS_RULES` = Champions.

### Statuts volatils (coexistent, stockés dans `volatileStatuses[]`)
| Statut | Effet | Durée |
|--------|-------|-------|
| **Confusion** | 50% chance/tour de dérailler (redirection allié, direction aléatoire AoE, tour perdu si aucun allié) | 2-5 tours |

### Stacking
- **1 statut majeur max** — nouveau statut ne s'applique pas si déjà actif
- **Statuts volatils** : coexistent avec les statuts majeurs

---

## 7d. Moves défensifs (plan 023)

**Règle durée** : actif "jusqu'au prochain tour du lanceur". Prévention = consommé au premier coup. Si lanceur KO → effet disparaît immédiatement.

| Move | Effet | Notes d'adaptation |
|------|-------|-------------------|
| **Abri** / Protect | Bloque attaques de face et de côtés. | Directionnel (dos vulnérable). Pas de spam penalty. |
| **Détection** / Detect | Clone d'Abri. | Distribution roster différente. |
| **Garde Large** / Wide Guard | Bloque AoE dans rayon 2 tiles, protège alliés dans ce rayon. | Portée localisée. |
| **Prévention** / Quick Guard | Bloque prochaine attaque reçue (toute direction). Consommé en 1 coup. | Omnidirectionnel mais 1 usage. |
| **Riposte** / Counter | Prend dégâts contact, renvoie ×2. Actif toute la durée. | Contact uniquement. |
| **Voile Miroir** / Mirror Coat | Prend dégâts distance, renvoie ×2. | Distance uniquement. |
| **Fulmifer** / Metal Burst | Prend dégâts (contact ou distance), renvoie ×1.5. | Universel, multiplicateur faible. |
| **Ténacité** / Endure | Ne peut pas tomber en dessous de 1 PV. | Spam penalty (pas 2 tours de suite). Ne bloque PAS statut/terrain/chute. |

---

## 7d bis. Blast + Protect — interaction directionnelle

Pour Blast, check directionnel d'Abri/Détection effectué depuis le **centre de l'explosion** (`targetPosition`), pas la position du lanceur.

Conséquence : cibler une tile **derrière** un Pokemon qui utilise Abri contourne sa protection.

---

## 7e. Vampigraine — statut volatil `Seeded` (plan 031)

**Implémentation :** statut volatil `Seeded` avec `sourceId`.

**Comportement :**
- **Portée lancer** : 1-3 tiles
- **Drain** : 1/8 HP max de la cible/tour en EndTurn — soigné au lanceur si encore en vie
- **Immunité** : type Plante
- **Rupture** : lanceur KO ; Rapid Spin (futur) ; case Feu/lave (futur)
- Lanceur peut poser Vampigraine sur plusieurs cibles simultanément

---

## 7f. Piège — statut volatil `Trapped` (plan 031)

**Comportement :**
- **Immobilisation** : cible ne peut pas se déplacer (Move) tant qu'actif
- Cible **peut** toujours attaquer (Act)
- **Dégâts passifs** : 1/8 HP max/tour en EndTurn
- **Durée** : N tours (configurable par move)
- **Sortie anticipée** : knockback reçu ou dash reçu libère la cible
- **Pas de lien source-cible** : lanceur peut bouger librement après

| Propriété | Vampigraine (`Seeded`) | Piège (`Trapped`) |
|-----------|----------------------|-------------------|
| Drain vers source | Oui (1/8 HP/tour) | Non |
| Immobilise la cible | Non | Oui (Move bloqué) |
| Durée | Permanente | N tours |
| Dégâts/tour | 1/8 HP | 1/8 HP |
| Immunité | Type Plante | Aucune |

---

## 7g. Knockback (plan 026)

**Comportement :**
- S'exécute **après** les dégâts
- Pousse chaque cible individuellement selon position relative au lanceur
- **Bloqué si** : bord grille, tile occupée
- Avec pattern slash : chaque cible poussée dans sa direction

---

## 7h. Multi-hit (plan 026)

- **Fixe** (ex: Double Pied) : `hits: 2`
- **Variable** (ex: Combo-Griffe) : `hits: { min: 2, max: 5 }` — roll 35/35/15/15% pour 2/3/4/5 coups

**Comportement :**
- 1 seul accuracy check au début
- Chaque hit = event `DamageDealt` séparé
- Stop si cible KO avant fin
- Event `MultiHitComplete` en fin

---

## 7i. Recharge — Ultralaser (plan 026)

Après move avec `recharge: true`, Pokemon ne peut pas attaquer au tour suivant.

- Peut se déplacer (Move) et choisir direction
- `getLegalActions` ne retourne aucune action `use_move` pendant recharge
- Flag `recharging` reset en fin du tour de recharge

---

## 7j. Badly Poisoned — poison grave (plan 026)

- Compteur `toxicCounter`, démarre à 1, +1/tour, plafonne à 15
- Dégâts/tour = `max(1, floor(maxHp * toxicCounter / 16))`

---

## 7k. Confusion tactique (plan 026)

Statut volatil. Dure 2-5 tours. Chaque tour : 50% de chance de dérailler.

| Situation | Comportement si confusion déclenche |
|-----------|--------------------------------------|
| Attaque single/dash | Cible redirigée vers allié aléatoire à portée |
| Attaque AoE (cône, ligne, slash) | Direction aléatoire |
| Attaque zone self | Exécutée normalement |
| Buff self | Fonctionne normalement |
| Aucun allié à portée | Tour perdu |
| Déplacement | Direction aléatoire, 1-2 cases |

---

## 8. Orientation & positionnement (style FFTA)

Chaque Pokemon a une **orientation** (direction dans laquelle il regarde).

### Choix de direction en fin de tour (plan 012)

- **Direction obligatoire** : joueur choisit toujours avant `EndTurn`
- **4 directions** : `getLegalActions` génère 4 actions `EndTurn`
- **Orientation initiale** : vers le centre au spawn via `directionFromTo`
- **UI style FFT** : `DirectionPicker` — flèches spritesheet, flèche active jaune / inactives grises

### Modificateur d'orientation sur les dégâts (plan 052)

Modificateur sur **dégâts uniquement** (pas évasion, pas statuts). Calculé depuis **zone de frappe** relative à l'orientation du défenseur :

| Zone | Modificateur | Condition |
|------|-------------|-----------|
| **Dos** | +15% (×1.15) | Attaque arrive dans même direction que l'orientation |
| **Flanc** | neutre (×1.0) | Attaque arrive perpendiculairement |
| **Face** | -15% (×0.85) | Attaque arrive en direction opposée |

- `packages/core/src/battle/facing-modifier.ts` : `FacingZone`, `getFacingZone(attackOrigin, defender)`, `getFacingModifier(zone)`
- Pour **Blast** : origine = **épicentre** (position d'impact), pas la position du lanceur
- **Preview renderer** : suffixe `(+15%)` ou `(-15%)`, aucun si neutre

---

## 8b. Undo déplacement (plan 053)

Après déplacement, joueur peut **annuler** (avant ou après attaque).

- **Move → Attack** : verrouille le déplacement (snapshot vidé), undo impossible
- **Attack → Move** : undo reste disponible
- **Action core** : `undo_move` — restaure position d'origine, remet `hasMoved` à `false`
- **Effets annulés** : brûlure magma acquise pendant déplacement retirée si elle n'existait pas avant

---

## 8c. Système de talents/abilities (plan 069)

Chaque Pokemon possède **1 talent** via hooks enregistrés dans `AbilityHandlerRegistry`.

**9 hooks disponibles** (plan 069 + refactor plan 070) :

| Hook | Déclencheur | Return type | Exemples |
|------|-------------|-------------|---------|
| `onDamageModify` | Calcul dégâts | `number` | Brasier, Torrent, Engrais (×1.5 si HP ≤ 1/3), Robustesse (×0.5 Feu/Glace), Adaptabilité (STAB 2.0), Bagarre (×1.5 Atk si statut) |
| `onAfterDamageReceived` | Après application dégâts | `BattleEvent[]` | Statik (30% para contact), Point Poison (30% poison contact), Charme (30% Infatué contact), Synchronisme, Fermeté (survive OHKO à HP max) |
| `onStatusBlocked` | Avant application statut majeur/volatil | `BlockResult { blocked, events }` | Tempo Propre (bloque Confusion + Intimidation) |
| `onStatusDurationModify` | Calcul durée statut | `DurationModifyResult { duration, events }` | Alerte (sommeil ÷2) |
| `onAfterStatusReceived` | Après application statut majeur | `BattleEvent[]` | Synchronisme (réflexe) |
| `onStatChangeBlocked` | Avant changement de stat | `BlockResult { blocked, events }` | Regard Vif (bloque baisses Précision ennemies), Corps Sain (bloque toutes baisses ennemies) |
| `onTypeImmunity` | Avant calcul dégâts | `BlockResult { blocked, events }` | Lévitation (immunité Sol) |
| `onBattleStart` | Démarrage combat, après placement | `BattleEvent[]` | Intimidation (–1 Atk ennemis adjacents), Magnépiège (piège ennemis Acier adjacents) |
| `onAuraCheck` | Après chaque action (position-linked update) | `BattleEvent[]` | Intimidation (ré-applique ou retire selon distance) |

> `onAccuracyModify` supprimé en plan 070 — sera ré-ouvert Phase 9 quand `sandstormActive` implémenté.

### Talents position-linked

- **Intimidation** : statut `Intimidated` (–1 Atk) sur ennemis adjacents. Retiré quand Growlithe s'éloigne, knockbacké ou KO.
- **Magnépiège** : statut `Trapped` sur ennemis Acier adjacents. Mêmes règles de retrait.

`checkPositionLinkedStatuses` appelé après chaque déplacement, knockback et KO.

### Lévitation = vol mécanique

**Lévitation** confère mêmes bénéfices mécaniques que type Vol : traversée obstacles, pas de pénalité terrain (passage lava/deep_water), immunité dégâts de chute, immunité Sol via `onTypeImmunity`. **Ne peut pas atterrir sur lava ou deep_water.** Via `isEffectivelyFlying(instance, types)` exporté depuis `@pokemon-tactic/core`.

### Les 20 talents du roster POC

| Pokemon | Talent | Effet |
|---------|--------|-------|
| Bulbizarre | **Engrais** | ×1.5 Plante si HP ≤ 1/3 |
| Salamèche | **Brasier** | ×1.5 Feu si HP ≤ 1/3 |
| Carapuce | **Torrent** | ×1.5 Eau si HP ≤ 1/3 |
| Roucoul | **Regard Vif** | Bloque baisses de Précision ennemies |
| Pikachu | **Statik** | 30% paralysie au contact reçu |
| Machoc | **Bagarre** | ×1.5 Atk si porteur d'un statut majeur (brûlure ignorée) |
| Abra | **Synchronisme** | Reflète statut majeur reçu à la source |
| Fantominus | **Lévitation** | Immunité Sol + vol mécanique complet |
| Racaillou | **Fermeté** | Survit un OHKO à 1 HP si HP max avant le coup |
| Caninos | **Intimidation** | Entrée : –1 Atk aux ennemis adjacents (position-linked) |
| Rondoudou | **Charme** | 30% Infatué au contact reçu (position-linked) |
| Lamantine | **Robustesse** | ×0.5 dégâts Feu et Glace reçus |
| Évoli | **Adaptabilité** | STAB 2.0× au lieu de 1.5× |
| Tentacool | **Corps Sain** | Bloque toutes baisses de stat ennemies |
| Nidoran♂ | **Point Poison** | 30% poison au contact reçu |
| Meowth | **Technician** | ×1.5 si puissance move ≤ 60 |
| Magnétite | **Magnépiège** | Piège ennemis Acier adjacents (position-linked) |
| Sabelette | **Voile Sable** | +1 évasion en tempête de sable (dormant — Phase 9) |
| Excelangue | **Tempo Propre** | Immunité Confusion + bloque Intimidation |
| Kangaskhan | **Alerte** | Durée sommeil ÷2 (arrondi supérieur, min 1) |

### Event renderer

`BattleEventType.AbilityActivated { pokemonId, abilityId, targetIds }` émis à chaque déclenchement visible. Renderer affiche floating text jaune doré `"{abilityName}!"` (`BATTLE_TEXT_COLOR_ABILITY = #ffe066`) au-dessus du `pokemonId`.

### Anti-spam seuil 1/3 HP (Engrais, Brasier, Torrent)

`PokemonInstance.abilityFirstTriggered` mémorise si le seuil a été traversé. `AbilityActivated` émis **une fois par traversée**. Réinitialisé si HP repasse au-dessus. Déclenché aussi au démarrage si Pokemon déjà sous le seuil (`onBattleStart`).

> Pattern d'émission complet : `docs/abilities-system.md`.

---

## 9. KO & élimination

**0 PV = KO définitif :**
- Corps reste sur tile et **bloque le passage**
- Revival : **Second Souffle** (Revival Blessing, **1 PP**) — rare
- Victoire = tous les Pokemon adverses KO

---

## 9b. Prévisualisation des actions légales

`getLegalActions()` retourne pour chaque action les positions de cible valides.

Usages :
- **UI** : afficher tiles disponibles
- **IA** : filtrer attaques sans cible à portée avant de décider

---

## 9c. Prévisualisation AoE et flow de confirmation (plan 017)

### Comportement par type de pattern
- **Directionnels (Cone, Line, Slash, Dash)** : preview suit direction souris par rapport au caster
- **Point-target (Single, Blast)** : preview suit tile survolée si dans cibles valides
- **Self-centered (Self, Cross, Zone)** : preview affichée statiquement dès l'entrée en ciblage

### Couleurs (décision #129)
- **Rouge** (`0xff4444`) : tiles avec au moins un effet de dégâts
- **Bleu** (`0x4488ff`) : tiles avec uniquement buffs/effets positifs
- **Outline périmétrique rouge** : contour de la zone de portée

### Flow de confirmation 2 étapes (style FFTA)
Contrôlé par `confirmAttack: boolean` dans `BattleConfig` :

| Étape | Action | Effet |
|-------|--------|-------|
| **Preview (hover)** | Survol grille | Tiles affectées colorées en temps réel |
| **Verrouillage (1er clic)** | Clic = verrouille la cible | Sprites des Pokemon touchés clignotent |
| **Confirmation (2e clic)** | Clic = exécute l'attaque | Combat normal |
| **Escape** | À tout moment | Annule et retour sous-menu attaque |

- `confirmAttack: true` (défaut) : flow complet 2 étapes
- `confirmAttack: false` : 1er clic exécute directement

---

## 10. Jouabilité par IA

| Type | Description | Usage |
|------|------------|-------|
| **Humain (UI)** | Interface graphique | Jeu normal |
| **Humain (hot-seat)** | Se passe le clavier | Multi local |
| **IA classique** | Algorithme (minimax, MCTS, heuristiques) | Solo, tests |
| **IA LLM** | Claude/GPT reçoit état en texte, répond une action | Fun, tests |
| **IA MCP** | LLM connecté via MCP server | Intégration directe |

---

## 11. Système de replay

Chaque combat = séquence d'actions déterministe :
- État initial (grille, placements, équipes)
- Chaque action jouée dans l'ordre
- Seed aléatoire (pour reproduire crits, miss...)

---

## 12. Éditeur de terrain

### Éditeur visuel (plus tard)
- Interface drag & drop, hauteurs, terrains, prévisualisation temps réel

### Génération par prompt IA
- Description texte → LLM génère JSON map (grille, hauteurs, types terrain, placements)

---

## 13. Team Builder

- **Format Showdown** pour import/export
- Permet d'échanger équipes, utiliser équipes existantes de la communauté

---

## 14. Modes de jeu (vision long terme)

| Mode | Statut | Description |
|------|--------|-------------|
| **Combat rapide** | POC | Choisir 2+ équipes, lancer un combat |
| **Mode histoire / aventure** | À voir | Entrée désactivée dans le menu |
| **Multijoueur local** | Phase 1 | Hot-seat |
| **Multijoueur réseau** | Phase 4+ | WebSocket |

---

## 15. Contrôles

- **Clavier + souris** : contrôle principal
- **Manette** : support gamepad prévu (navigation grille, sélection, menus)

> Clavier/souris pour le POC. Manette en Phase 2-3.
