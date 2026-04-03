# Système IA — Pokemon Tactics

> Architecture, pipeline de scoring, et niveaux de difficulté.

## Architecture

Le système IA est composé de 3 couches, toutes dans `packages/core/src/ai/` :

```
BattleEngine.getLegalActions()     ← actions légales (Move, UseMove, EndTurn)
         │
         ▼
    scoreAction()                  ← score chaque action (action-scorer.ts)
         │
         ▼
    pickScoredAction()             ← choisit parmi les meilleures (scored-ai.ts)
         │
         ▼
BattleEngine.submitAction()        ← exécute l'action choisie
```

Le `AiTeamController` (renderer) orchestre le tour complet : il boucle sur ce pipeline
jusqu'à `EndTurn`.

**Tout le pipeline est commun à tous les niveaux de difficulté.** Seul l'`AiProfile` change.

## Pipeline de scoring

### 1. Collecte des données (`scoreAction`)

Pour chaque action légale, le scorer collecte :

- **Le Pokemon actif** : position, moves, PP restants
- **Les ennemis vivants** : position, HP, types
- **Les alliés vivants** : position (pour le friendly fire)

### 2. Scoring par type d'action

#### UseMove (attaque / buff / debuff)

**Self-targeting (buffs)** — traitement séparé :
- Score = `statChanges` (1) si ennemi proche, `statChanges × 3` si ennemi loin (>2 tiles)
- Logique : se buffer quand on ne peut pas encore frapper

**Attaques (power > 0)** :
1. Calcule les **tiles affectées** via `estimateAffectedTiles()` (miroir simplifié de `resolveTargeting`, sans Grid)
2. Filtre les ennemis **réellement touchés** (position sur une tile affectée)
3. Si aucun ennemi touché → **score = -1** (l'IA ne tire jamais dans le vide)
4. Pour chaque ennemi touché :
   - **Kill potential** : si `estimateDamage.min >= HP restants` → `killPotential` (10). Sinon → `(dégâts max / HP max) × killPotential × 0.5`
   - **Type advantage** : `effectiveness > 1` → +`typeAdvantage` (3). `< 1` → malus
5. **Friendly fire** : -30% de `killPotential` par allié dans la zone d'effet
6. **Effets secondaires** : +`statChanges × 1.5` pour les debuffs ennemis, +`statChanges` pour les statuts

#### Move (déplacement)

1. **Positionnement** : gain de distance vers l'ennemi le plus proche × `positioning`
2. **Lookahead move+attack** : pour chaque move du Pokemon (avec PP) :
   - Calcule la portée max (`getMoveMaxReach`)
   - Vérifie si un ennemi serait à portée depuis la destination
   - Score le meilleur dégât possible × 0.8 (facteur d'estimation)
3. Le lookahead fait que l'IA **se déplace vers des positions d'attaque**, pas juste vers l'ennemi

#### EndTurn (fin de tour)

- Score = 1 si face à l'ennemi le plus proche, 0 sinon
- L'IA se tourne toujours vers la menace

### 3. Scores négatifs

Les actions à score < 0 (attaques sans cible) sont **filtrées** du pool de sélection.
L'IA ne gaspille jamais son tour sur une action inutile.

## Sélection d'action (`pickScoredAction`)

```
1. Scorer toutes les actions légales
2. Trier par score décroissant
3. Filtrer les scores négatifs
4. Prendre le top-N (selon profil)
5. Selon randomWeight : prendre le meilleur OU piocher dans le top-N
```

C'est ici que la difficulté intervient. **Le scoring est identique** — seul le choix final change.

## Niveaux de difficulté

La difficulté est définie par un `AiProfile` :

```typescript
interface AiProfile {
  difficulty: AiDifficulty;    // easy | medium | hard
  randomWeight: number;        // 0-1, proba de choisir sous-optimal
  topN: number;                // nombre de candidats considérés
  scoringWeights: ScoringWeights;
}
```

### Ce qui change entre les niveaux

| Paramètre | Easy | Medium | Hard |
|-----------|------|--------|------|
| `randomWeight` | 0.4 (40% sous-optimal) | 0.15 (15%) | 0 (toujours optimal) |
| `topN` | 3 | 2 | 1 |
| `killPotential` | 10 | 10 | 10 |
| `typeAdvantage` | 3 | 3 | 5 |
| `positioning` | 2 | 2 | 3 |
| `statChanges` | 1 | 1 | 2 |

### Effet concret

- **Easy** : voit les bonnes actions mais en choisit une sous-optimale 40% du temps dans le top 3.
  Rate parfois un KO, se déplace un peu au hasard, ne maximise pas toujours le type advantage.
- **Medium** : plus cohérente, pioche rarement en dehors du meilleur. Quasi toujours le bon move.
- **Hard** : joue toujours le coup optimal. Mêmes poids que Medium mais `typeAdvantage` et `positioning` comptent plus — elle optimise chaque tile, chaque matchup.

### Ce qui est commun à tous les niveaux

- Le pipeline de scoring (collecte, tiles affectées, estimateDamage, lookahead)
- Le filtrage des scores négatifs
- L'orientation EndTurn vers l'ennemi
- La gestion du friendly fire
- Le `AiTeamController` (boucle Move → UseMove → EndTurn)

## Portée max par targeting (`getMoveMaxReach`)

| Pattern | Portée | Exemple |
|---------|--------|---------|
| Single | `range.max` | Lanceflamme (3) |
| Cone | `range.max` | Flammèche (2) |
| Line | `length` | Ultralaser (5) |
| Slash | 1 (adjacence) | Tranche |
| Dash | `maxDistance` | Volt Tackle (4) |
| Zone | `radius` | Séisme (2) |
| Cross | `size / 2` | Onde de Choc |
| Blast | `range.max + radius` | Bombe Beurk |
| Self | 0 | Épée Danse |

## Limitations actuelles

- **Pas de mémoire** : l'IA n'apprend pas des tours précédents (pas de tracking des moves adverses)
- **Pas de prédiction** : ne prédit pas les actions du joueur au tour suivant
- **estimateDamage approximatif** : le lookahead utilise la portée max, pas le targeting exact
- **Pas de coordination d'équipe** : chaque Pokemon joue indépendamment
- **Movement = 3 pour tous** : hardcodé, pas lié aux stats du Pokemon (à corriger)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `core/src/ai/action-scorer.ts` | Scoring de chaque action |
| `core/src/ai/scored-ai.ts` | Sélection pondérée top-N |
| `core/src/ai/ai-profiles.ts` | Profils Easy / Medium / Hard |
| `core/src/types/ai-profile.ts` | Interface `AiProfile` + `ScoringWeights` |
| `core/src/enums/ai-difficulty.ts` | Enum `AiDifficulty` |
| `renderer/src/game/AiTeamController.ts` | Orchestration du tour IA |
