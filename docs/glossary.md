# Glossaire — Pokemon Tactics

> Référence des termes techniques du projet, à destination du créateur non-technique.
> Code en anglais, documentation en français.

---

## Termes de game design

**AoE** (Area of Effect)
Attaque qui touche plusieurs cibles en même temps dans une zone. Exemple : une explosion qui blesse tous les Pokemon dans un rayon de 2 cases autour du point d'impact.

**BFS** (Breadth-First Search)
Algorithme de recherche en largeur utilisé pour le pathfinding. Il explore toutes les cases accessibles à distance 1, puis distance 2, etc. Garantit de trouver tous les chemins possibles, pas forcément le plus court. Utilisé dans `getLegalActions` pour calculer les tiles atteignables.

**Dash**
Attaque combinant déplacement et frappe. Le Pokemon fonce en ligne droite et frappe le premier ennemi rencontré. Remplace les attaques de priorité (Blizzard, Tranche-Vent...) qui dans le jeu original permettaient d'agir avant l'adversaire.

**Evasion** (Esquive)
Statistique qui réduit la probabilité d'être touché par une attaque. Modifie le calcul de précision : `précision × esquive`. Surchargeable par les overrides de balance.

**Friendly fire**
Les attaques de zone touchent les alliés autant que les ennemis. Décision délibérée pour rendre le positionnement critique.

**Grid** (Grille)
La carte de combat sous forme de cases (tiles) carrées. Taille par défaut pour le POC : 12x12. Chaque tile peut être vide, occupée, ou non-passable.

**Initiative**
Statistique dérivée (calculée depuis Vitesse et Poids) qui détermine l'ordre de passage dans un round. Le Pokemon avec la plus haute initiative joue en premier.

**KO countdown**
Quand un Pokemon tombe à 0 PV, il n'est pas immédiatement éliminé : un compteur démarre (3 tours par défaut, FFTA-like). À 0, élimination définitive. Des capacités de revival peuvent intervenir entre-temps.

**Pathfinding**
Calcul des cases qu'un Pokemon peut atteindre depuis sa position, en tenant compte des obstacles, des ennemis, des alliés et des dénivelés. Utilise un BFS dans ce projet.

**Round**
Un cycle complet où chaque Pokemon en jeu a joué une fois. Distinct du "tour" (= le moment d'un seul Pokemon).

**Stat stages** (Modificateurs de stat)
Niveaux d'amplification ou de réduction d'une stat (+1, +2, -1...). Systèm officiel Pokemon : chaque stage correspond à un multiplicateur (x1.5 pour +1, x2 pour +2, etc.).

**Targeting pattern** (Patron de ciblage)
La forme géométrique qu'une attaque dessine sur la grille. Exemples : `single` (une case), `cone` (cône devant le lanceur), `zone` (cercle), `line` (ligne droite), `cross` (croix), `dash` (ligne avec déplacement).

**Tile**
Une case de la grille de combat. Chaque tile a une position (x, y), une hauteur, et peut être occupée par un Pokemon ou être non-passable.

---

## Termes techniques

**Barrel export**
Fichier `index.ts` qui regroupe et réexporte les éléments publics d'un module. Permet d'importer depuis `@pokemon-tactic/core` sans connaître la structure interne des dossiers.

**Const enum** (ou const object enum)
Pattern TypeScript du projet : `{ Key: "value" } as const` + type dérivé. Évite les enums natifs TypeScript (qui génèrent du JS) et les chaînes de caractères brutes. Exemple : `TargetingKind.Single` plutôt que `"single"`.

**deepMerge**
Fonction qui fusionne plusieurs objets couche par couche. Dans ce projet, les arrays sont **remplacés** (pas concaténés) lors du merge. Utilisée pour combiner les données base + tactical + balance en `MoveDefinition` complètes.

**Discriminated union**
Type TypeScript où plusieurs formes d'un même type se distinguent par un champ commun (souvent `kind`). Exemple : `TargetingPattern` peut être `{ kind: 'single'; range: ... }` ou `{ kind: 'cone'; width: ... }`. TypeScript sait exactement quel type est actif selon la valeur de `kind`.

**Event emitter** (Émetteur d'événements)
Pattern où un objet publie des événements que d'autres peuvent écouter. Dans ce projet, le `BattleEngine` émet des `BattleEvent` que le renderer, l'IA et le système de replay écoutent. Découple totalement le core de l'affichage.

**Headless**
Exécution sans interface graphique. Le moteur de jeu peut simuler des centaines de combats complets en quelques secondes via Node.js, sans Phaser, sans fenêtre, sans rendu. Indispensable pour les tests et l'équilibrage automatique.

**Override** (Surcharge)
Données additionnelles qui s'appliquent par-dessus les données de base sans les modifier directement. Exemple : la couche `tactical` ajoute le `targeting` d'un move, la couche `balance` ajuste son `power`. Changer l'équilibre = modifier un seul fichier.

---

## Termes d'architecture

**Core**
Le package `@pokemon-tactic/core` — moteur de jeu pur, sans aucune dépendance à l'affichage. Contient la logique de combat, le pathfinding, le système de tours, la validation. Peut tourner dans n'importe quel environnement (navigateur, Node.js, IA).

**Data pipeline** (Pipeline de données)
Le flux de transformation des données de jeu : données officielles Pokemon (base) → surcharges tactiques (targeting, effects) → surcharges de balance (tweaks numériques) → `deepMerge` → `MoveDefinition` complètes → `validateBattleData()` au startup.

**MCP server**
Interface qui permet à une IA externe (LLM) de jouer au jeu via l'API du core. L'IA appelle `getLegalActions()`, choisit une action, appelle `submitAction()` — exactement comme un joueur humain.

**Mock**
Données de test fictives mais réalistes, utilisées pour isoler ce qu'on teste. Dans ce projet, les mocks sont des `abstract class` avec des `static readonly` — pas de helpers de création, juste des données pures. Exemple : `MockPokemon.bulbasaur`.

**Monorepo**
Un seul dépôt Git contenant plusieurs packages indépendants. Ici : `packages/core`, `packages/data`, `packages/renderer`. Géré par pnpm workspaces. Permet de partager du code entre packages sans publier sur npm.

**Renderer**
Le package `@pokemon-tactic/renderer` — la couche d'affichage (Phaser 4). Écoute les events du core et anime les actions à l'écran. Peut être remplacé sans toucher au core.
