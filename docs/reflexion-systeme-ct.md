# Réflexion — Système CT (Charge Time)

> Discussion de design en cours. Remplacement du round-robin par un système CT.

## Contexte

Le système actuel est un round-robin : chaque Pokemon joue 1 fois par round, dans l'ordre de Vitesse. Simple mais plat — la Vitesse ne sert qu'à déterminer qui joue en premier, pas combien de fois on joue.

## Modèles étudiés

| Modèle | Principe | Problème speed meta |
|--------|----------|---------------------|
| **FFT** | CT += Speed, seuil 100, reset à 0 | Speed surpuissante (ratio linéaire) |
| **FFTA** | CT += Speed, seuil 1000, reset à 500 | Amorti mais toujours dominant |
| **Tactics Ogre Reborn** | RT inversé (coût par action), pas de stat speed | Complexe à équilibrer |
| **Fell Seal** | CT comme FFT + bonus wait 25% | Speed meta atténué |
| **Fire Emblem** | Phases d'équipe, speed → double attack | Pas applicable (multi-équipes) |

## Données de référence — Vitesse effective Nv.50

Extremes sur les 1025 Pokemon de la référence :

| | Pokemon | Base | Stat Nv.50 | A -6 | A +6 |
|---|---------|------|-----------|------|------|
| Min absolu | Shuckle | 5 | 10 | 2 | 40 |
| Min Gen 1 | Slowpoke | 15 | 20 | 5 | 80 |
| Max Gen 1 | Electrode | 150 | 155 | 38 | 620 |
| Max absolu | Regieleki | 200 | 205 | 51 | 820 |

Formule stat Nv.50 : `floor(2 × base × 50 / 100) + 5`
Multiplicateur stages : +6 = ×4.0, -6 = ×0.25
Paralysie : ×0.5 en plus

### Ratios bruts (sans compression)

- Neutre Gen 1 : Electrode/Slowpoke = **7.75×**
- Neutre absolu : Regieleki/Shuckle = **20.5×**
- Extrême (-6 vs +6) : **410×**
- Extrême + paralysie : **820×**

→ Un CT proportionnel à la vitesse est injouable.

## Formules de compression comparées

4 formules testées :

- **Linéaire (A)** : `ctGain = 50 + floor(effectiveSpeed × 0.3)`
- **Clamp (B)** : `ctGain = clamp(effectiveSpeed, 30, 120)`
- **Logarithmique (C)** : `ctGain = 30 + floor(20 × ln(effectiveSpeed + 1))`
- **FFTA brut (D)** : `ctGain = max(10, floor(effectiveSpeed × 0.5))` + plancher 500

### Ratios compressés (rapide joue X fois pendant que le lent joue 1 fois)

| Scénario | Brut | Lin (A) | Clamp (B) | Log (C) | FFTA (D) |
|----------|------|---------|-----------|---------|----------|
| Roster actuel (Geo vs Pika) | 3.8× | 1.4× | 3.2× | **1.3×** | 3.9× |
| Gen 1 (Slowpoke vs Electrode) | 7.8× | 1.7× | 4.0× | **1.4×** | 7.7× |
| Absolu (Shuckle vs Regieleki) | 20.5× | 2.1× | 4.0× | **1.8×** | 10.2× |
| Stages (-6 vs +6) | 410× | 5.9× | 4.0× | **3.2×** | 41× |
| Réaliste (Geo-3 vs Pika+2) | 19× | 2.0× | 4.0× | **1.8×** | 9.5× |

### Simulations — 10 premières actions

**Geodude vs Pikachu (neutre) — formule Log(C) :**
`Pika, Geo, Pika, Geo, Pika, Geo, Pika, Pika, Geo, Pika` → 6/4

**Shuckle vs Regieleki (neutre) — formule Log(C) :**
`Regi, Regi, Shuck, Regi, Regi, Shuck, Regi, Shuck, Regi, Regi` → 7/3

**Geodude(-3) vs Pikachu(+2 Agility) — formule Log(C) :**
`Pika, Pika, Geo, Pika, Pika, Geo, Pika, Geo, Pika, Pika` → 7/3

## Formule ctGain — évolution

### V1 (Log sur vitesse effective — abandonnée)

`ctGain = 30 + floor(20 × ln(effectiveSpeed + 1))`

Problème : les stages sont absorbés par la compression Log. Agility +2 ne donne que ×1.10-1.13 de ctGain → neutre en simulation.

### V3 (hybride — retenue)

`ctGain = floor((30 + floor(20 × ln(baseStat + 1))) × softMult(stages × 0.7))`

Avec `softMult(s) = (2 + s) / 2` si s ≥ 0, `2 / (2 - s)` si s < 0.

Principe : Log compresse les stats de base (ratio neutre ≤1.44×), les stages s'appliquent linéairement après avec un facteur 0.7 (atténuation pour éviter l'extrême de V2).

| Scénario | V1 (Log pur) | V3 (hybride) |
|----------|-------------|-------------|
| Agility +2 impact | ×1.10-1.13 | **×1.69** |
| 20 actions Pika/Geo avec Agility | 12/8 → 12/8 (Δ0) | 12/8 → **14/6** (Δ+2) |
| Icy Wind -2 sur adversaire | ×0.90 | **×0.59** |
| Stages extrêmes Regi(+6)/Shuckle(-6) | ×3.3× | ×5.7× (acceptable) |

Raisons :
- Agility a un impact tactique réel (visible, pas mécanique/prévisible)
- Icy Wind est une vraie menace (réduit ctGain à 59% de la base)
- Ratio neutre inchangé (compression Log préservée)
- Extrêmes (+6 vs -6) raisonnables vs V2 qui donnait 23.83×

## Formule de vitesse complète (avec IV/SP/Nature Champions)

Pokemon Champions change le calcul de stats :
- **IV = 31 fixes** (plus de random)
- **EV → SP** : 66 points max à distribuer, 32 max par stat, 1 SP = +1 stat directement
- **Nature** : +10% / -10% sur une stat

Formule complète (non-HP) : `floor(((2 × base + 31) × level / 100 + 5 + SP) × nature)`

### Impact sur les extrêmes de vitesse

| Pokemon | Base | Actuelle (simplifié) | Min (0SP, -Nat) | Max (32SP, +Nat) |
|---------|------|---------------------|-----------------|------------------|
| Shuckle | 5 | 10 | 22 | 63 |
| Geodude | 20 | 25 | 36 | 79 |
| Pikachu | 90 | 95 | 99 | 156 |
| Regieleki | 200 | 205 | 198 | 277 |

Les IV à 31 fixes remontent les lents proportionnellement plus que les rapides → compression naturelle.

### Ratios avec formule complète + Log(C)

| Scénario | Brut | Log(C) |
|----------|------|--------|
| Roster neutre (Geo vs Pika) | 2.8× | **1.19×** |
| Geo tanky vs Pika speedster (+Agility) | 8.7× | **1.41×** |
| Absolu neutre (Shuckle vs Regieleki) | 8.8× | **1.44×** |
| Absolu investi (SP+Nature) | 12.6× | **1.54×** |
| Absolu stages (-6 vs +6) | 221.6× | **2.62×** |
| Absolu+paralysie | 554× | **3.33×** |

Les objets tenus (Phase 4) s'appliqueront comme multiplicateurs AVANT la compression Log :
- Choice Scarf : ×1.5 speed
- Iron Ball : ×0.5 speed
- Quick Claw / Lagging Tail : à adapter au modèle CT

## Coûts CT par action

### Principe

Après chaque action, le CT du Pokemon est réduit d'un coût variable. Plus le coût est élevé, plus il attend avant de rejouer.

`CT post-action = CT actuel - actionCost`

### PP Champions comme base des coûts

Pokemon Champions réduit le range des PP de 5-40 à **8-20** (multiples de 4, pas de PP Up/Max).

| PP classiques | PP Champions | Conversion |
|---------------|-------------|------------|
| 5 PP | 8 PP | Dévastateur |
| 10 PP | 12 PP | Fort |
| 15 PP | 16 PP | Standard |
| 20+ PP | 20 PP | Spammable |

### Coûts CT — formule complète

Le coût d'un move est calculé par :

```
ctCost(move) = max(ppCost(move.pp), powerFloor(move.power), effectFloor(move.effectTier))
```

**ppCost** (suit Champions automatiquement) :

| PP Champions | CT cost |
|-------------|---------|
| 20 PP | 500 |
| 16 PP | 600 |
| 12 PP | 700 |
| 8 PP | 900 |

**powerFloor** (suit la puissance du move) :

| Puissance | Floor CT |
|-----------|----------|
| ≥ 110 | 900 |
| ≥ 90 | 700 |
| ≥ 70 | 600 |
| < 70 | 0 (PP prime) |

**effectFloor** (classification tactique, stable — dans `tacticalOverrides`) :

| effectTier | Floor CT | Moves concernés |
|-----------|----------|-----------------|
| `major-status` | 700 | sleep, bad poison, para 100% (Hypnosis, Toxic, Thunder Wave, Sing, Sleep Powder) |
| `major-buff` | 600 | buff +2 d'un coup (Swords Dance, Agility, Iron Defense, Minimize) |
| `double-buff` | 550 | deux buffs +1 (Calm Mind, Bulk Up, Withdraw, Stockpile) |
| `reactive` | 500 fixe | Protect, Counter, Mirror Coat, Endure… (perdre son tour = coût stratégique) |
| *(non défini)* | 0 | PP + Power priment (debuffs mineurs, buffs simples) |

Cette classification est décidée avec le game designer, indépendamment des mises à jour Champions. Si Champions change les PP ou la puissance d'un move, le coût se recalcule automatiquement ; l'`effectTier` ne change que sur décision de design.

### Exemples de coûts finaux (roster actuel)

| Move | PP | Power | ppCost | powerFloor | effectFloor | **Coût final** |
|------|----|-------|--------|-----------|------------|---------------|
| Scratch | 20 | 40 | 500 | 0 | — | **500** |
| Slash | 20 | 70 | 500 | 600 | — | **600** |
| Body Slam | 16 | 85 | 600 | 600 | — | **600** |
| Thunderbolt | 16 | 90 | 600 | 700 | — | **700** |
| Flamethrower | 16 | 90 | 600 | 700 | — | **700** |
| Volt Tackle | 16 | 120 | 600 | 900 | — | **900** |
| Earthquake | 12 | 100 | 700 | 700 | — | **700** |
| Blizzard | 8 | 110 | 900 | 900 | — | **900** |
| Hyper Beam | 8 | 150 | 900 | 900 | — | **900** + skip |
| Thunder Wave | 20 | — | 500 | 0 | 700 | **700** |
| Hypnosis | 16 | — | 600 | 0 | 700 | **700** |
| Swords Dance | 20 | — | 500 | 0 | 600 | **600** |
| Agility | 20 | — | 500 | 0 | 600 | **600** |
| Calm Mind | 20 | — | 500 | 0 | 550 | **550** |
| Protect | 8 | — | 900 | 0 | 500 fixe | **500** |
| Growl | 20 | — | 500 | 0 | — | **500** |

### Autres coûts

| Action | CT cost | Notes |
|--------|---------|-------|
| **Wait (skip)** | 350 | Repositionnement sans agir |
| **Move seul** | 400 | Déplacement sans attaque |
| **Move + Attaque** | move(400) + atk - 150 | Discount combo |

### Simulations avec coûts d'action

**Pikachu Thunderbolt (600) vs Geodude Earthquake (700) — 12 actions :**
Pika 7, Geo 5 — le rapide garde l'avantage avec des attaques plus légères.

**Pikachu Hyper Beam (1200) vs Geodude Scratch (500) — 12 actions :**
Pika 5, Geo 7 — **le lent prend l'avantage** si le rapide spamme du lourd. Choix tactique.

**Pikachu Quick Attack spam (400) vs Geodude Earthquake (700) — 12 actions :**
Pika 8, Geo 4 — le rapide joue beaucoup mais tape faible. Tempo vs puissance.

**Geodude Wait×2 puis Earthquake vs Pikachu Thunderbolt — 12 actions :**
6/6 égalité — le Wait (300) permet au lent de se repositionner et rattraper.

## Changements de statuts Champions (à intégrer)

| Statut | Classique | Champions | Notre jeu actuel | À changer |
|--------|-----------|-----------|-------------------|-----------|
| **Paralysie** | -50% speed, 25% skip | -50% speed, **12.5% skip** | -50% speed, 25% skip | Oui → 12.5% |
| **Sommeil** | 2-4 tours aléatoire | **1-3 tours, garanti au 3e** | 1-3 tours | Vérifier le garanti |
| **Gel** | 20% dégel/tour, permanent possible | **25% dégel, garanti au 3e tour** | 20% dégel | Oui → 25% + cap 3 |
| **Brûlure** | 1/16 HP, -50% Atk | Inchangé | 1/16 HP, -50% Atk | Non |
| **Poison** | 1/8 HP | Inchangé | 1/8 HP | Non |
| **Poison grave** | Croissant 1/16→15/16 | Inchangé | Croissant | Non |

Note : la paralysie affecte le ctGain (via -50% speed effective). Le skip 12.5% s'applique en plus, au moment d'agir.

## Interaction CT + effets existants

- **Hyper Beam recharge** : garde l'effet (skip forced) + coût CT standard (900 pour 8PP). La recharge est la vraie pénalité. Pas de double peine — cohérent avec Pokemon.
- **Protect consécutifs** : le mécanisme de fail rate (50% cumulatif) reste. Le coût CT 400 rend le spam Protect moins punitif en tempo.
- **Confusion** : appliquée au moment d'agir (pas d'impact CT).
- **Vampigraine/Bind** : ticks en EndTurn — dans un système CT sans rounds, il faut définir quand les ticks s'appliquent (à chaque action du Pokemon affecté ? à intervalle CT fixe ?).

## Résultats des simulations (pré-équilibrage)

Simulations avec 1 acteur par tick (le plus haut CT joue), CT départ 600, seuil 1000.

| Test | Scénario | Résultat | Verdict |
|------|----------|----------|---------|
| Ratio neutre | Pikachu Tbolt(700) vs Geodude EQ(700) | Pika 12 / Geo 8 = **1.50×** | Dans la cible (1.3-1.6×) |
| Extreme | Regieleki vs Shuckle neutre | Regi/Shuck = **1.44×** | Compression log efficace |
| Agility V3 | Pika avec Agility +2 vs sans (20 actions) | 12/8 → **14/6** (Δ+2) | Visible, pas écrasant |
| Agility ratio | ctGain +2 stages | **×1.69** | Fort sans être mécanique |
| Volt Tackle (PP seul) | Pika(600) vs Geo EQ(700) | 12/8 = 1.50× | Identique à Body Slam — absurde |
| Volt Tackle (PP+Power) | Pika(900) vs Geo EQ(700) | **10/10 = 1.00×** | VT ralentit autant que Geo — correct |
| Hyper Beam | Pika HB(900+skip) vs Geo Scratch(500) | Geo joue 1.7× plus | Bien puni |
| Brûlure | Pika vs Geo, tous brûlés (120HP) | Pika meurt, Geo survit à 9HP | Le rapide meurt de la burn, pas le lent |
| Move+Atk | Combo(850) vs Split(1000) | 6 hits vs 3 hits | Le discount combo fonctionne |
| 2v2 focus | Speed team focus Geodude | Geo KO sans agir | Normal — identique en round-robin |

### Observations clés

- **Agility** (V3) a un impact réel : +2 stages → ×1.69 de ctGain, +2 actions sur 20. Tactiquement visible sans domination.
- **Volt Tackle** sans floor = identique à Body Slam en tempo, malgré 120 puissance. Le power floor corrige ça.
- **Brûlure/poison** punissent naturellement les rapides (plus de ticks). Revers de médaille élégant.
- **Hyper Beam** : coût CT normal (900 pour 8PP) + skip forced (recharge). La recharge est la pénalité principale.
- **Le focus-fire** tue les fragiles dans tous les systèmes (CT ou round-robin). Ce n'est pas un défaut.

## Paramètres retenus (v1 — à rééquilibrer en playtest)

```
ctGain(baseStat, stages) = floor((30 + floor(20 × ln(baseStat + 1))) × softMult(stages × 0.7))
  où softMult(s) = (2 + s) / 2  si s ≥ 0
                  2 / (2 - s)   si s < 0

CT de départ  = 600
Seuil action  = 1000
1 acteur par tick (plus haut CT joue, tie-break par ID)

ctCost(move) = max(ppCost(move.pp), powerFloor(move.power), effectFloor(move.effectTier))
```

Overrides par move (champ `effectTier` dans `tacticalOverrides`, `ctCostOverride` pour exceptions) :
- `protect`, `detect`, `wide-guard`, `quick-guard`, `counter`, `mirror-coat`, `endure` : `reactive` → **500 fixe**
- `thunder-wave`, `hypnosis`, `sing`, `sleep-powder`, `toxic` : `major-status` → floor **700**
- `swords-dance`, `agility`, `iron-defense`, `minimize` : `major-buff` → floor **600**
- `calm-mind`, `bulk-up`, `withdraw`, `stockpile` : `double-buff` → floor **550**

## Architecture — coexistence round-robin / CT (décision #255)

Les deux systèmes coexistent via une interface `TurnSystem` commune :

```
TurnSystem (interface)
├── getNextActorId(): string
├── onActionComplete(pokemonId, actionCost): void
└── onPokemonKO(pokemonId): void

Implémentations :
├── RoundRobinTurnSystem  ← TurnManager actuel, refactoré (façade mince)
└── ChargeTimeTurnSystem  ← nouveau, avec CT + coûts
```

`BattleConfig.turnSystem: 'round-robin' | 'charge-time'` sélectionne l'implémentation.

**Scope du changement** : BattleEngine, TurnManager (→ interface), timeline renderer.
**Inchangé** : moves, dégâts, pathfinding, targeting, IA, grille.

**Rationale** : le round-robin est déjà implémenté, le refactorer derrière l'interface coûte ~1h. Permet l'A/B testing en sandbox pendant le calibrage CT. Pas d'UI joueur pour l'instant — à décider (voir roadmap Phase 3).

**Maintenance CT + Champions** : voir `docs/plans/054-ct-system.md` section "Flow de maintenance" — les coûts PP/power se recalculent automatiquement, l'`effectTier` des moves non-offensifs est la seule décision manuelle à maintenir.

## Questions ouvertes

- **Suppression des rounds** : la timeline passe d'un affichage par round à une file continue. Les ticks de statut (burn, poison, leech seed) doivent être recalés sur un autre déclencheur.
- **Interaction avec Trick Room** : inverser l'ordre CT (le plus lent joue en premier) ? Ou inverser le ctGain ?
- **Priorité des moves** : Quick Attack (+1), ExtremeSpeed (+2) — en CT pur il n'y a plus de "tour" pour avoir la priorité. À repenser.
- **Items multiplicatifs** : Choice Scarf (×1.5), Iron Ball (×0.5) s'appliquent avant compression Log.
- **Mise à jour depuis Champions** : garder la table de conversion PP classiques → Champions dans les données, pour pouvoir facilement mettre à jour si Champions patche.
