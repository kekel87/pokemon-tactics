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
- **Layout 3 colonnes** : PlayersColumn gauche + TeamList vertical central + PlayersColumn droite (seulement si N > 6, plan 086).
- **Encadrés d'équipe** : couleur `TEAM_COLORS[index]` — 12 couleurs distinctes (décision #202-204)
- **Sélection** : liste centrale des équipes saved (localStorage) + ligne "🎲 Aléatoire" en bas. Clic ligne → assignée au joueur actif, badge `[Ji]` ajouté, joueur actif avance. Mirror autorisé (plusieurs joueurs même teamId). Décisions #326-332.
- **AI default = équipe Aléatoire ephémère** (re-roll à création colonne, plan 086 décision #330).
- **Toggle Humain/IA** : IA vs IA possible sur toutes les équipes (décision #185). Switch → reset assignment + re-roll random si AI.
- **Bouton "Remplir IA aléatoire"** : bulk re-roll toutes colonnes AI (plan 086).
- **Pas d'édition d'équipe** depuis cette scène : empty state → CTA "Crée depuis le menu principal → Constructeur d'équipe" (plan 086 décision #326).
- **Format picker (dropdown)** : sélection format `{teamCount}v{maxPokemonPerTeam}` (ex: `2v6`, `3v4`). Change format → reset slots.
- **Sous-pick au placement** (plan 086) : chaque joueur place 1..maxPokemonPerTeam mons depuis ses 6 disponibles. Bouton "Done" (`PlacementRosterPanel`) actif si placedCount ≥ 1. Décision #328.
- **Toggle Placement auto / manuel** : contrôle `PlacementMode`. **Auto activé par défaut** (depuis plan 054).
- **Noms Pokemon** : FR ou EN selon langue active (`@pokemon-tactic/data`)
- **Persistance last-selection** : `localStorage` clé `pt:team-select:last-v1` mémorise teamId par slot humain.
- **Bypass sandbox** : `VITE_SANDBOX` court-circuite `TeamSelectScene` entièrement

**Flow :** `MapSelectScene → TeamSelectScene → BattleScene (PlacementPhase sous-pick) → Combat → Victoire`

---

## 3. Pokemon

| Attribut | Description |
|----------|-------------|
| **Stats de base** | PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse — stats officielles Pokemon |
| **Niveau de combat** | Fixé à **50**. Stats calculées avec formule Pokemon Gen 5+ au niveau 50 (sans IV/EV pour le POC). |
| **Stats dérivées** | Mouvement, Saut, Initiative — voir [section 6b](#6b-mouvement--formule-de-portée-de-déplacement) |
| **Types** | 18 types, faiblesses/résistances |
| **Movepool** | Réservoir complet des moves apprenables par l'espèce — source pour le futur Team Builder (sélection des 4 actifs) |
| **4 Attaques actives** | Les 4 moves sélectionnés dans le movepool, portés en combat via `moveIds`. Limité aux 4 premiers du movepool en l'absence de Team Builder. Puissance, précision, PP (poids coût CT uniquement — pas de compteur d'usage), type, catégorie (phys/spé/statut), **pattern AoE**, **portée** — surchargeable pour équilibrage |
| **1 Talent** | Capacité passive (ex: Intimidation, Lévitation...) |
| **1 Objet tenu** | Effet passif ou consommable |

---

## 4. Système de tour — Charge Time (plan 054 + plan 128)

Le moteur n'utilise qu'un seul système : **Charge Time (CT)**. Le mode Round-Robin a été retiré en plan 128 (2026-06-17 — décision #517).

### Charge Time

Inspiré de FFTA et FFX. Chaque Pokemon accumule des CT points à chaque tick. Celui qui atteint le seuil agit en premier.

`BattleState.activePokemonId: string` désigne le Pokemon actif (remplace l'ancien `turnOrder[]` + `currentTurnIndex`).

**Formule `ctGain` :**
```
ctGain = floor((30 + floor(20 × ln(baseStat + 1))) × softMult(speedStages × 0.7))
```
- CT de départ : 600 / Seuil d'action : 1000
- 1 seul acteur par tick (le plus haut CT parmi ceux ≥ 1000)
- Ratio fréquence Pikachu/Geodude (neutre) ≈ 1.50×, plafonné à 1.5×

**Coût CT par action (`computeMoveCost`) :**

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

> **PP comme poids CT uniquement.** `MoveDefinition.pp` reste présent et sert de poids dans `computeMoveCost`. Il n'existe plus de compteur d'utilisations (`currentPp`) — un move peut être utilisé indéfiniment. L'équilibrage passe par le coût CT, pas par un quota de PP.

**`effectTier` dans les surcharges tactiques :**
- `reactive` : protect, detect, wide-guard, quick-guard, counter, mirror-coat, metal-burst, endure
- `major-status` : thunder-wave, hypnosis, sing, sleep-powder, toxic
- `major-buff` : swords-dance, agility, iron-defense, minimize
- `double-buff` : calm-mind, bulk-up, withdraw, stockpile

**`getCtSnapshot()`** : expose état CT courant pour renderer (timeline CT).

**UI CT :**
- `TurnTimeline` : séquence prédictive scrollable style FFX (plan 059) — 24 entrées simulées par `predictCtTimeline(count, moveId?)`, slot 0 ancré, 11 slots scrollables molette. Au `confirm_attack` : séquence recalculée avec coût move, Pokemon actif mis en évidence (bordure teal-vert `TIMELINE_HIGHLIGHT_BORDER_COLOR`). Entrée tail (portrait semi-transparent + "...") si Pokemon absent des 24 slots.
- `ActionMenu` : coût CT affiché (PP non affichés)

> Vulgarisation joueur : `docs/wiki/ct-system.md`.

### 4b. Modèle de durée « tours du lanceur » (plan 128)

Les effets environnementaux (météo, barrières, champs, Protection) décomptent sur les **tours propres du lanceur**, et non plus sur un compteur de rounds global (qui était gelé en CT de toute façon).

**Conséquence tactique :** un lanceur lent (faible `ctGain`) accumule du CT lentement → ses tours s'étalent sur une longue fenêtre réelle → ses effets persistent longtemps. Récompense les Pokemon lents pour les rôles de support. Divergence assumée par rapport au canon Pokemon (où la durée est fixe, indépendante de la Vitesse).

### 4c. Horloge fantôme (ghost clock) (plan 128)

Quand le lanceur d'un effet **environnemental** (météo ou champ de terrain) meurt, il reste dans le scheduler CT comme **ghost** :
- Ne peut pas être ciblé ni agir.
- Continue d'accumuler du CT à sa Vitesse.
- À chaque tour fantôme, décrémente ses effets actifs.
- Quitte le scheduler dès que ses effets sont tous expirés.
- Pas de plafond de durée fantôme (voulu — un Pokemon lent très rapide au décès peut faire durer longtemps).

**Barrières (Reflet, Mur Lumière, Brume, Rune Protect) :** meurent avec leur lanceur — pas de ghost. `removeAurasOfCaster` est conservé dans `handleKo`.

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
| **knockback** | Repousse N cases | Draco-Queue |
| **warp** | Téléporte lanceur sur cible | Tunnel, Vol, Téléport |
| **phase-to-spawn** | Éjecte la cible vers sa zone de spawn (adaptation grid du switch-out canon, pas de banc dans ce jeu ; réutilise `ejectToSpawn`) | Bouton Fuite, Carton Rouge, Cyclone, Hurlement, Projection |
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

### Input — confirmation par direction survolée (décision #518)

Les moves Dash se confirment comme Cône/Ligne/Tranche : la direction est déterminée par le survol de la souris par rapport au caster. `resolveTargetAction` sélectionne automatiquement la tuile la plus loin dans la direction (portée auto — moteur s'arrête au premier obstacle). L'outline des tuiles d'atterrissage n'est pas affichée.

### Couleurs preview (décision #519)

La traînée est entièrement **jaune** (`#ffdd44`). La couleur d'intention (rouge dégâts, vert soin…) n'apparaît **que sous une tuile occupée par un Pokemon** (allié ou ennemi) sur le trajet. Dash dans le vide = tout jaune, aucune fausse tuile rouge d'impact.

### Barème de portées (décision #520)

| Portée | Moves |
|--------|-------|
| **5** | Vitesse Extrême (priorité +2, le meilleur) |
| **4** | Giga Impact, Coud'Krâne, Métalliroue, Électacle, Boutefeu, Rapace, Aquatacle |
| **3** | Volt Assaut, Draco-Charge, Bélier, Éclair Fou, Cascade, Taurogne |
| **2** | Roue de Feu, Désherbaffe, Nitrocharge, Gliss'Herbe (→ 4 sur Champ Herbu), Vive-Attaque, Aqua-Jet, Éclats Glace, Pisto-Poing, Mach Punch, Onde Vide |

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
| **Flinch** | Bloque Move + UseMove au tour suivant (consommé en début de tour) | 1 tour |
| **Verrouillé** (LockedOn) | Prochain move garanti (bypass accuracy) — consommé à l'usage | 1 usage |
| **Charge** | T1 d'un move 2 tours : bloque movement, indique ⚡ en renderer | 1 tour |
| **Infatué** | Position-linked (genre opposé) : 50% chance de ne pas agir | Jusqu'au KO/sortie portée |
| **Provoc** (Taunted) | Interdit l'utilisation de moves de catégorie Statut. Bloqué par Substitute. Pas bloqué par Safeguard ni Mist. | 3 tours |

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

## 7j. Impostor / Substitute (plan 099)

**Pose du Substitute :** move statut self-only, type Normal. Coût = `floor(maxHp / 4)` PV, déduits instantanément du lanceur. Échec si HP insuffisants OU si le lanceur a déjà un sub actif (`SubstituteFailed` émis).

**Stockage :** `PokemonInstance.substituteHp?: number` (pure field — pas de nouveau `StatusType`). `undefined` = pas de sub actif.

**Absorption des dommages :** tout dommage entrant sur un Pokemon avec sub actif est intercepté dans `handle-damage.ts` avant écriture sur `currentHp`. Le sub absorbe les dégâts ; si `substituteHp` tombe à 0, `SubstituteBroken` est émis et le sub est effacé.

**Blocage statuts/baisses-stats ennemis :** `handle-status.ts` et `handle-stat-change.ts` consultent `hasSubstitute(target)` — si actif, les statuts et baisses de stats provenant d'un adversaire sont bloqués (même pattern Mist/Safeguard). `ProtectionReason.Substitute` étendu.

### Ce qui bypass le Substitute

| Catégorie | Bypass | Raison |
|-----------|--------|--------|
| Move sonore (`flags.sound`) | Oui | Canon Showdown — son traverse le sub |
| Move avec `flags.bypasssub` | Oui | Flag explicite |
| Move drain | Oui | Drain (Vampirisme, Méga-Sangsue) perçoit HP réel |
| Move recoil | Oui | Auto-infligé indépendant du sub |
| Self-move (targeting `self`) | Toujours libre | Le Pokemon agit sur lui-même |
| Météo, terrain, statuts propres | Non bloqués | Sub ne protège pas des dégâts indirects propres |

**Multi-hit & sub :** si un move multi-hit brise le sub mid-séquence, les hits restants tombent sur les HP réels (parité Showdown canonique, décision #394).

### Events émis

| Event | Déclencheur |
|-------|-------------|
| `SubstitutePosted` | Sub posé avec succès (incluant HP du sub) |
| `SubstituteDamaged` | Sub absorbe des dégâts (incluant HP restants) |
| `SubstituteBroken` | Sub tombe à 0 HP |
| `SubstituteFailed` | Échec : HP insuffisants ou sub déjà actif |

### Renderer

- `PokemonSprite.setSubstituteOverlay(active)` swap l'atlas vers le sprite `"dummy"` (constante `SUBSTITUTE_SPRITE_ID`) pendant que le sub est actif.
- `InfoPanel` : badge `Clone {hp} PV` quand sub actif.
- `MoveTooltip` : tags `sound` et `bypasssub` affichés.
- `BattleLogFormatter` : 4 nouveaux cas + différenciation `ProtectionReason.Substitute`.
- 17 nouvelles clés i18n FR/EN.

### IA

`scoreSelfMove` dans `action-scorer.ts` étendu pour `EffectKind.PostSubstitute` : prise en compte des menaces adjacentes et garde basse HP (score réduit si HP trop bas pour que le sub ait de la valeur).

---

## 7k. Morphing / Imposteur — copie d'identité complète (plan 157)

Première mécanique de mutation runtime **complète** d'un Pokemon (stats, types, moves, talent,
poids, genre, sprite) — mutuellement, la plus lourde du jeu.

**Morphing** (`transform`, Normal, Statut, cible `normal`, Single **r3**) : le lanceur devient une
copie de la cible — stats de combat actuelles, crans de stats (snapshot à l'instant du cast, puis
évolution indépendante), types, 4 moves, talent, poids, genre, sprite. **Niveau et PV du lanceur
inchangés** (un Métamorph 50 PV qui copie un Léviator garde 50 PV max mais prend son Attaque).
Appris par **Mew**.

**Imposteur** (`imposter`, talent) : déclenche Morphing à l'entrée en combat sur l'ennemi le plus
proche (Chebyshev min) — traduction canon-fidèle de « celui d'en face » (le canon copie le slot
adverse en miroir, déterministe ; ce projet n'a pas de slots de doubles, l'ennemi le plus proche en
est l'équivalent grille). Porté par **Métamorph** (Ditto).

**Échecs :** cible absente/KO, Clone (Substitut) protège la cible, lanceur ou cible déjà transformé,
cible dont le talent effectif est `imposter` (anti-boucle Ditto vs Ditto — jamais de talent
Imposteur copié, quel que soit le porteur).

**Architecture — `PokemonInstance.transformState`** : un seul champ snapshot centralise tout le
paquet copié (au lieu d'éparpiller sur `typeOverride`/`abilityIdOverride`/`speedStatOverride`),
reset au KO. Helpers `effectiveCombatStats`/`effectiveMoveIds`/`effectiveWeight`/`effectiveGender` +
extension `effectiveAbilityId`/`resolveBaseTypes`/`effectiveBaseSpeed`.

**« Manip écrase »** : une manipulation ultérieure (Détrempage, Échange, Soucigraine,
Permuvitesse…) sur un mon déjà transformé écrase la facette correspondante du morph plutôt que
d'être masquée — priorité à 4 tiers `abilitySuppressed > override spécifique > transformState >
espèce`. Au cast, `applyTransform` purge les overrides spécifiques pré-existants du lanceur pour que
le morph soit la couche active immédiatement après.

**Conséquences tactiques :**
- La Vitesse copiée pilote le tempo CT **et** la portée de déplacement — un Métamorph lent qui
  copie un mon rapide gagne d'un coup sa mobilité.
- Le type copié s'applique **pleinement** au terrain : un morphé en Léviator (Eau/Vol) lévite/nage
  (lave OK, eau profonde OK, pas de malus marais/sable) — aucune décorrélation, tous les chemins
  terrain du core sont déjà transform-aware.

**Renderer :** event `Transformed` + port `setSpecies` (swap l'atlas affiché vers celui de la
cible) ; au break du Substitut, le sprite restauré est celui de l'espèce **morphée**, pas
l'originale.

**IA :** garde-fou `scoreTransformApplication` — gaté sur l'écart de total de stats (cible vs soi),
exclut l'action si la cible n'est nettement pas plus forte (évite de gâcher le palier CT le plus
lourd, 900, pour copier un mon plus faible).

---

## 7l. Badly Poisoned — poison grave (plan 026)

- Compteur `toxicCounter`, démarre à 1, +1/tour, plafonne à 15
- Dégâts/tour = `max(1, floor(maxHp * toxicCounter / 16))`

---

## 7m. Confusion tactique (plan 026)

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

## 8c. Système d'objets tenus (plan 073)

Chaque Pokemon peut porter **1 objet tenu** enregistré dans `HeldItemHandlerRegistry` (miroir de `AbilityHandlerRegistry`).

**8 hooks disponibles** :

| Hook | Déclencheur | Items concernés |
|------|-------------|-----------------|
| `onDamageModify` | Calcul dégâts (attaquant ou défenseur) | Orbe Vie (×1.3), Bandeau Choix (×1.5 Atk phys), Ceinture Pro (×1.2 super-eff), Balle Lumière (×2 Pikachu), Grosses Bottes (-) |
| `onCritStageBoost` | Calcul stage crit | Lentilscope (+1 stage) |
| `onAfterMoveDamageDealt` | Après infliction de dégâts (côté attaquant) | Orbe Vie (recoil 1/10 HP max) |
| `onAfterDamageReceived` | Après réception de dégâts (côté défenseur) | Ceinture Force (survive 1HP si HP max, consumé), Vulné-Assurance (+2 Atk/SpAtk si super-eff, consumé), Casque Brut (1/6 HP contact retour) |
| `onEndTurn` | Fin de tour, Pokemon vivant | Restes (+1/16 HP max), Baie Sitrus (+1/4 HP max si ≤1/2, consumé) |
| `onTerrainTick` | Avant DOT et statut terrain | Grosses Bottes (bloque effets terrain) |
| `onCtGainModify` | Calcul CT gain | Mouchoir Choix (×1.5 vitesse → CT gain) |
| `onMoveLock` | Après usage d'un move — décide si verrouillage | Bandeau Choix, Mouchoir Choix (verrouillent le move utilisé via hook, plus de check hardcodé dans BattleEngine) |

**Contraintes :**
- 2 Pokemon d'une même équipe ne peuvent pas porter le même objet (`DuplicateItem` erreur validateur)
- Choice items (Bandeau / Mouchoir) verrouillent le move utilisé (`lockedMoveId`) jusqu'à fin de combat
- Items consommables (`focusSash`, `weaknessPolicy`, `sitrusBerry`) sont retirés après usage (`heldItemId = undefined`)

**Les 12 objets du roster POC :**

| ID | Nom FR | Effet |
|----|--------|-------|
| `leftovers` | Restes | +1/16 HP max en fin de tour |
| `life-orb` | Orbe Vie | ×1.3 dégâts infligés + recoil 1/10 HP max |
| `choice-band` | Bandeau Choix | ×1.5 Atk physique + verrou move |
| `choice-scarf` | Mouchoir Choix | ×1.5 CT gain + verrou move |
| `focus-sash` | Ceinture Force | Survit à 1 HP si HP max avant le coup — consumé |
| `expert-belt` | Ceinture Pro | ×1.2 dégâts si super-efficace |
| `rocky-helmet` | Casque Brut | 1/6 HP max de l'attaquant si contact reçu |
| `weakness-policy` | Vulné-Assurance | +2 Atk ET +2 SpAtk si super-efficace reçu — consumé |
| `scope-lens` | Lentilscope | +1 stage critique |
| `sitrus-berry` | Baie Sitrus | +1/4 HP max si ≤1/2 HP — consumé |
| `heavy-duty-boots` | Grosses Bottes | Immunité effets terrain (pas la traversabilité) |
| `light-ball` | Balle Lumière | ×2 Atk ET ×2 SpAtk — Pikachu uniquement |

**Mini-système critiques (plan 073, étendu plan 142 + plan 151) :**

Intégré dans `damage-calculator.ts`. Stage critique de base = `move.critRatio ?? 0` (Tranche, Karaté Chop = 1). Lentilscope ajoute +1. Probabilités Gen 6+ simplifiées :

| Stage | Probabilité |
|-------|-------------|
| 0 | 1/24 ≈ 4.2% |
| 1 | 1/8 = 12.5% |
| 2 | 1/2 = 50% |
| 3+ | 100% |

Critique = ×1.5 dégâts + ignore stages défensifs négatifs (sans annuler stages positifs). Émet `BattleEventType.CriticalHit`. Renderer affiche "Critique!" en orange (#ff8800).

**Manipulation de coups critiques (plan 151, batch A « Misc volatile / utility »)** :
- `PokemonInstance.critStageBoost?: number` (volatile persistant, cleared au KO) — posé par la Baie Lansat (+2 au pincement ≤25% PV, plan 142) et par **Puissance** (`focus-energy`, +2 crans, self, persistant, empilable avec Affilage).
- `PokemonInstance.guaranteedCritArmed?: boolean` (volatile **one-shot**, distinct des crans) — posé par **Affilage** (`laser-focus`) : garantit le **prochain coup offensif** du lanceur quel que soit son crit stage, consommé après ce coup.
- **Cri Draconique** (`dragon-cheer`) applique `critStageBoost` à un allié : +1 cran, +2 si l'allié ciblé est de type Dragon (canon Gen 9).
- `MoveDefinition.alwaysCrit?: boolean` — **Yama Arashi** (`storm-throw`) : crit toujours garanti, mais `preventsCrit` (Coque Armure/Muscle Coque) prime toujours sur tout crit forcé (move ou volatile).
- `MoveDefinition.ignoresDefensiveStages?: boolean` — **Dark Lariat** (`darkest-lariat`) : ignore les crans Déf/Déf.Spé de la cible dans les deux sens (annule aussi bien un −2 qu'un +2 défensif), implémenté en forçant `defenseStageForCalc = 0`.

**UI sélection objet (TeamSelectScene) :** dropdown par Pokemon (12 items + "Aucun"). Validation doublons + message d'erreur.

**Events renderer :**
- `HeldItemActivated` → floating text vert `#7cf08c` avec nom FR de l'objet
- `HeldItemConsumed` → floating text gris `#aaaaaa` "[item] épuisé"
- `CriticalHit` → floating text orange `#ff8800` "Critique!"
- `HpRestored` → heal affiché dans battle log

---

## 8d. Système de talents/abilities (plan 069)

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

> `onAccuracyModify` supprimé en plan 070. Voile Sable implémenté en plan 084 via `accuracyMultiplier` hook (plan 079) + lecture `effectiveWeather`.

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
| Sabelette | **Voile Sable** | ×0.8 accuracy ennemie sous Tempête de Sable (`AbilityActivated` au tour start) |
| Excelangue | **Tempo Propre** | Immunité Confusion + bloque Intimidation |
| Kangaskhan | **Alerte** | Durée sommeil ÷2 (arrondi supérieur, min 1) |

### Event renderer

`BattleEventType.AbilityActivated { pokemonId, abilityId, targetIds }` émis à chaque déclenchement visible. Renderer affiche floating text jaune doré `"{abilityName}!"` (`BATTLE_TEXT_COLOR_ABILITY = #ffe066`) au-dessus du `pokemonId`.

### Anti-spam seuil 1/3 HP (Engrais, Brasier, Torrent)

`PokemonInstance.abilityFirstTriggered` mémorise si le seuil a été traversé. `AbilityActivated` émis **une fois par traversée**. Réinitialisé si HP repasse au-dessus. Déclenché aussi au démarrage si Pokemon déjà sous le seuil (`onBattleStart`).

> Pattern d'émission complet : `docs/abilities-system.md`.

---

## 8e. Système météo (plans 084 + 084b)

La météo est un état global du combat (`BattleState.weather`) affectant dégâts, précision, défenses et abilities.

### Météos disponibles

| Météo | ID | Setter moves | Durée (base / Heat-Rock) | Effets |
|-------|----|-------------|--------------------------|--------|
| **Soleil** | `Sun` | sunny-day | 5 / 8 tours | Feu ×1.5, Eau ×0.5, Gel bloqué, Synthèse soigne 2/3 HP, Solar-Beam skip charge, Thunder/Hurricane précision 50%, Chlorophylle ×2 vitesse |
| **Pluie** | `Rain` | rain-dance | 5 / — tours | Eau ×1.5, Feu ×0.5, Thunder/Hurricane précision 100%, Blizzard précision normale, Nage Rapide ×2 vitesse |
| **Tempête de Sable** | `Sandstorm` | sandstorm | 5 / 8 tours | Roche +50% DéfSpé, dégâts 1/16 HP/tour (sauf Rock/Ground/Steel), Solar-Beam BP ÷2, Blizzard précision normale, Voile Sable +20% esquive |
| **Neige** | `Snow` | snowscape | 5 / — tours | Glace +50% Déf, Blizzard précision 100%, Solar-Beam BP ÷2 |

### Durée et compteur

- `weatherTurns` décrémenté en `weather-tick` à chaque tour de n'importe quel Pokemon.
- Quand `weatherTurns` atteint 0 → météo passe à `None`.
- `HeldItemId.HeatRock` étend Soleil (et Sable) de 5 à **8 tours** via hook `onEndTurn`.

### Weather war

Quand deux Pokemon posent des météos différentes au même round, la règle "le poseur le plus lent gagne" (`applyWeatherWar`) s'applique : le Pokemon avec le plus bas CT gain (= plus lent) écrase la météo de l'autre.

### Modificateurs BP et précision

| Move | Sous Soleil | Sous Pluie | Sous Sable | Sous Neige |
|------|------------|------------|------------|------------|
| Moves Feu | ×1.5 | ×0.5 | normal | normal |
| Moves Eau | ×0.5 | ×1.5 | normal | normal |
| Tonnerre Vrai (thunder) | précision 50% | précision 100% | normal | normal |
| Ouragan (hurricane) | précision 50% | précision 100% | normal | normal |
| Blizzard | normal | normal | normal | précision 100% |
| Lance-Soleil | skip charge | BP ÷2 | BP ÷2 | BP ÷2 |
| Météore (weather-ball) | Feu 100 BP | Eau 100 BP | Roche 100 BP | Glace 100 BP |

### Modificateurs défensifs

| Météo | Type bénéficiaire | Modification stat |
|-------|------------------|-------------------|
| Tempête de Sable | Roche | +50% DéfSpé (×1.5) |
| Neige | Glace | +50% Déf (×1.5) |

### Gel et Soleil

Le statut Gel ne peut pas être appliqué sous `Sun`. Si un Pokemon déjà gelé subit le Soleil, le gel se dissipe (compatibilité Showdown).

### Cloud Nine / Ciel Gris

Le talent **Ciel Gris** (Akwakwak) supprime tous les effets météo tant que le porteur est actif sur le terrain. Via `effectiveWeather(state, activeAbilities)` qui retourne `None` si un porteur de Cloud Nine est vivant.

### Solar-Beam — charge en 2 tours

T1 : `chargingMove` activé, `lockedMoveId` posé, mouvement toujours possible, event `MoveCharging` émis, floating text "Rayonne!" affiché.

T2 : retarget automatique, `chargingMove` cleared, KO en T2 = animation propre.

Si Soleil actif en T1 → skip charge, exécution directe.

---

## 8f. Moves charge en 2 tours — indicateur ⚡ et Flinch (plan 094)

### Moves charge Gen 1

| Move | T1 (charge) | T2 (frappe) |
|------|-------------|-------------|
| `skull-bash` | +1 Déf (`chargeEffects`), indicateur ⚡ | Dash r3 + knockback |
| `sky-attack` | indicateur ⚡ | Single r4 Vol 140 BP, Flinch 30%, critRatio 1 |
| `razor-wind` | indicateur ⚡ | Cône r3 Normal 80 BP, critRatio 1 |
| `solar-beam` | floating "Rayonne!", indicateur ⚡ | Single r4 Plante 120 BP (60 sous Pluie/Sable/Neige). Skip T1 sous Soleil. |

### `MoveDefinition.chargeEffects?: Effect[]`

Effets latéraux appliqués **au T1** uniquement, **sur le caster (self-target)**. `applyChargeEffects(caster)` dans `BattleEngine`. Aucun move existant ne cible l'adversaire en T1 — si nécessaire à l'avenir, ajouter champ `chargeEffectTarget`.

### Indicateur ⚡ (renderer)

`PokemonSprite.setChargingIndicator(active: boolean)` — symbole ⚡ affiché au-dessus du sprite de T1 à T2. Retiré en T2 juste avant l'attaque.

`isChargeT1(move, pokemon)` helper renderer : retourne `true` si `pokemon.chargingMove === move.id` ET le move n'est pas skippé (`!move.sunSkipsCharge || weather !== Sun`).

### InfoPanel et MoveTooltip

- Badge volatile **"Charge {moveName}"** dans l'InfoPanel quand `chargingMove` est posé.
- MoveTooltip : tag **"⏱ 2 tours"** sur tous les moves charge ; variante **"⏱ 1 tour (sous Soleil)"** sur `solar-beam`.

### Flinch

`StatusType.Flinch` = statut volatile consommé au début du tour suivant. Bloque à la fois **Move** (déplacement) et **UseMove** (attaque). `processFlinch` appelé dans `BattleEngine`. `BattleEventType.Flinched` émis. Moves actuels avec Flinch : `sky-attack` (30%), `waterfall` (20%), `air-slash` (30%).

**Note** : l'ability `inner-focus` (Raticate, Fearow, Golbat, Canarticho, Mew) est prévue pour immuniser au Flinch — implémentée en stub Phase 4. Suintement (Shield Dust) bloque via `onSecondaryEffectBlocked` existant.

### Abilities météo

| Talent | Déclencheur | Effet |
|--------|-------------|-------|
| **Chlorophylle** | Tour start sous Soleil | ×2 CT gain (double vitesse), `AbilityActivated` émis |
| **Nage Rapide** | Tour start sous Pluie | ×2 CT gain, `AbilityActivated` émis |
| **Voile Sable** | Tour start sous Sable | ×0.8 accuracy des moves ennemis (équivalent +20% esquive), `AbilityActivated` émis |
| **Ciel Gris** | Passif | `effectiveWeather` retourne None si porteur actif |

### HUD Météo (renderer)

`WeatherHud` positionné top-center sous le texte de tour. Icône 48×48 + label i18n + compteur tours. Disparaît si `Weather.None`. 4 icônes 64×64 (sun/rain/sandstorm/snow). **Note backlog** : icône sandstorm perfectible (symbole spirale moins lisible que les autres).

### i18n

22 clés sous `weather.*` (noms, descriptions, damage flottants) + `sandbox.weather*` (dropdown sandbox). Sandbox : dropdown 5 valeurs (Aucune / Soleil / Pluie / Sable / Neige) + input turns dans panel Map.

---

## 8g. Taunt / Provoc — disrupteur anti-setup (plan 100)

Move `taunt` (Ténèbres, Statut, Single r3, acc 100, PP 20). Pendant **3 tours** (canon Gen 5+), la cible ne peut plus utiliser de moves de catégorie `Status`.

### Mécanique core

- `StatusType.Taunted` volatile ajouté à `volatileStatuses[]` (mirror Confused/Flinch).
- Check dans `BattleEngine.executeUseMove` **avant** dépense PP : si caster taunted + `move.category === Status` → `ActionError.InvalidAction` + `BattleEventType.TauntBlocked`. Les PP ne sont **pas** consommés (parité Showdown).
- `getLegalActions` omet les moves statut de la liste retournée si le caster est taunted (cohérence UI).
- `taunt-tick-handler.ts` décrémente le compteur en EndTurn (priorité 350) — expiration via `StatusRemoved` standard.
- `handleKo` nettoie automatiquement tous les volatiles (déjà câblé, zéro code nouveau).

### Interactions canon

| Interaction | Comportement |
|-------------|--------------|
| **Substitute** | Bloque Taunt (pas de flag `bypasssub` sur le move → `shouldSubstituteBlock` = true) |
| **Safeguard** | Ne bloque PAS (Taunted absent de `SAFEGUARD_BLOCKED_STATUSES`) |
| **Mist** | Ne bloque PAS (Taunt est un statut, pas une baisse de stat) |

### IA

`scoreTauntApplication` dans `action-scorer.ts` : bonus ×1.8 si la cible a ≥ 40% de moves statut (helper `statusMoveRatio` dans `threat-detection.ts`), pénalité ×0.3 si HP < 30% (KO direct prioritaire), skip si déjà taunted.

### Renderer

- Badge InfoPanel `Provoc {turns}t` (mirror Confus).
- MoveTooltip tag rouge `Bloqué par Provoc` sur moves statut grisés non-cliquables si caster taunted.
- Floating text `"Provoc!"` orange sur target à l'application.
- `BattleLogFormatter` : 3 cas — applied (StatusApplied filtré Taunted), blocked (TauntBlocked), expired (StatusRemoved filtré Taunted).

---

## 8h. Roulade — mécanisme snowball (décision #521)

**Portée ET puissance montent à chaque cast consécutif** du même lanceur. Reset si le lanceur utilise un autre move.

| Cast | Portée | Puissance |
|------|--------|-----------|
| 1er  | 2      | 30        |
| 2e   | 3      | 60        |
| 3e   | 4      | 120       |
| 4e   | 5      | 240       |
| 5e+  | 5 (cap) | 480 (cap) |

### Implémentation

- `DynamicPowerKind.RolloutStreak` résolu dans `dynamic-power-system`.
- `PokemonInstance.rolloutStreak?: number` (index 0–4).
- Helper `packages/core/src/battle/rollout-streak.ts` : `pendingRolloutIndex` / `rolloutPowerForIndex` / `rolloutRangeForIndex` / `recordLastUsedMove`.
- Streak suivi via `lastUsedMoveId` (déjà posé par Encore/Disable — réutilisé).
- Détection générique (`dynamicPower.kind === RolloutStreak`), pas l'ID `rollout` en dur.
- Portée rampée s'affiche en live dans la preview Dash.
- Tooltip : tag « Puissance variable » existant couvre Roulade.

---

## 9. KO & élimination

**0 PV = KO définitif :**
- Corps reste sur tile et **bloque le passage**
- Revival : **Second Souffle** — livré via Vœu Soin (`healing-wish`, plan 147, décision #604), réinventé en move de revive ciblé (tuile r3) : ressuscite un allié KO à **50% PV max** ou soigne un vivant à **100%**, self-KO du lanceur en échange — premier et seul move de revive du jeu
- KO instantané (OHKO) : famille **K.O. en un coup** (plan 148, décisions #607–#610) — Abîme/Guillotine/Empal'Korne/Glaciation infligent des dégâts fixes = PV max sur un jet de précision plate dédié (30 %, 20 % pour Glaciation si le lanceur n'est pas de type Glace), ignorant crans/talents/objets/Gravité/météo. Contres canon complets : Fermeté = immunité totale (bypassée par Brise Moule), Baie Ceinture/Ténacité = survie à 1 PV, Protection bloque, Clone absorbe, immunités de type standards (+ type Glace immunisé vs Glaciation).
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
- **Sélection des 4 moves actifs** : le joueur choisit les 4 attaques parmi le movepool complet de chaque Pokemon. En l'absence de Team Builder, `BattleSetup` prend les 4 premiers du movepool.

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
