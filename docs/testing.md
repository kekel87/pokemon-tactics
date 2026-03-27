# Testing — Bonnes pratiques et exemples

Ce document décrit les bonnes pratiques pour les tests dans Pokemon Tactics et fournit des exemples concrets.

## Niveaux de test

| Niveau | Fichier | Quand | Coverage |
|--------|---------|-------|----------|
| **Unit** | `*.test.ts` | Fonction/classe isolée, dépendances mockées. | 100% |
| **Intégration** | `*.integration.test.ts` | Interactions entre composants (ex: targeting + Grid). | Mesuré |
| **Scénario** | `*.scenario.test.ts` | Combat complet headless. | Non |
| **E2E visuel** | Playwright (séparé) | Navigation, screenshots, console, interactions. | Non |

Un test d'intégration vérifie un **contrat entre composants** qu'aucun unit test ne couvre.

## Bonnes pratiques

### Nommage des tests
- **Descriptif** : Le nom du test doit décrire clairement le comportement vérifié.
- **En anglais** : Les noms de tests sont en anglais pour une cohérence avec le code.
- **Concis** : Éviter les noms trop longs, mais être suffisamment précis.

Exemple :
```typescript
it('should calculate damage correctly for a normal attack', () => {
  // ...
});
```

### Mocks
- **Données pures** : Utiliser des mocks centralisés dans `packages/core/src/testing/`.
- **Pas de helpers de création** : Éviter les fonctions `createX`, `makeX`, `buildX` dans les fichiers de test.
- **Variations par spread** : Utiliser le spread operator pour créer des variantes.

Exemple :
```typescript
const attacker = { ...MockPokemon.base, attack: 50 };
const defender = { ...MockPokemon.base, defense: 30 };
```

### Structure d'un test
1. **Setup** : Préparer les données et les mocks.
2. **Execution** : Appeler la fonction ou la méthode à tester.
3. **Assertion** : Vérifier le résultat avec `expect`.

Exemple :
```typescript
it('should calculate damage correctly for a normal attack', () => {
  // Setup
  const attacker = { ...MockPokemon.base, attack: 50 };
  const defender = { ...MockPokemon.base, defense: 30 };
  const move = { power: 40, type: 'normal' };

  // Execution
  const damage = calculateDamage(attacker, defender, move);

  // Assertion
  expect(damage).toBeGreaterThan(0);
  expect(damage).toBeLessThanOrEqual(50);
});
```

## Exemples de tests

### Test unitaire pour `calculateDamage`

```typescript
import { expect, describe, it } from 'vitest';
import { calculateDamage } from '../src/battle-engine';
import { MockPokemon } from '../testing/mocks';

describe('calculateDamage', () => {
  it('should calculate damage correctly for a normal attack', () => {
    const attacker = { ...MockPokemon.base, attack: 50 };
    const defender = { ...MockPokemon.base, defense: 30 };
    const move = { power: 40, type: 'normal' };

    const damage = calculateDamage(attacker, defender, move);

    expect(damage).toBeGreaterThan(0);
    expect(damage).toBeLessThanOrEqual(50);
  });

  it('should apply type effectiveness', () => {
    const attacker = { ...MockPokemon.base, attack: 50 };
    const defender = { ...MockPokemon.base, defense: 30, types: ['water'] };
    const move = { power: 40, type: 'electric' };

    const damage = calculateDamage(attacker, defender, move);

    expect(damage).toBeGreaterThan(50); // Electric is super effective against Water
  });

  it('should handle edge cases', () => {
    const attacker = { ...MockPokemon.base, attack: 0 };
    const defender = { ...MockPokemon.base, defense: 100 };
    const move = { power: 0, type: 'normal' };

    const damage = calculateDamage(attacker, defender, move);

    expect(damage).toBe(0);
  });
});
```

### Test d'intégration pour `BattleEngine`

```typescript
import { expect, describe, it } from 'vitest';
import { BattleEngine } from '../src/battle-engine';
import { MockPokemon, MockMove } from '../testing/mocks';

describe('BattleEngine integration', () => {
  it('should process a full turn correctly', () => {
    const engine = new BattleEngine();
    const attacker = { ...MockPokemon.pikachu, position: { x: 0, y: 0 } };
    const defender = { ...MockPokemon.bulbasaur, position: { x: 1, y: 1 } };

    engine.addPokemon(attacker);
    engine.addPokemon(defender);

    const result = engine.submitAction(attacker.id, MockMove.thunderbolt, defender.id);

    expect(result.success).toBe(true);
    expect(defender.hp).toBeLessThan(MockPokemon.bulbasaur.hp);
  });

  it('should handle invalid actions', () => {
    const engine = new BattleEngine();
    const attacker = { ...MockPokemon.pikachu, position: { x: 0, y: 0 } };

    engine.addPokemon(attacker);

    const result = engine.submitAction(attacker.id, MockMove.thunderbolt, 'invalid-target');

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
```

### Test de scénario pour un combat complet

```typescript
import { expect, describe, it } from 'vitest';
import { BattleEngine } from '../src/battle-engine';
import { MockPokemon, MockMove } from '../testing/mocks';

describe('Full battle scenario', () => {
  it('should simulate a full battle until one Pokemon faints', () => {
    const engine = new BattleEngine();
    const pikachu = { ...MockPokemon.pikachu, position: { x: 0, y: 0 } };
    const bulbasaur = { ...MockPokemon.bulbasaur, position: { x: 1, y: 1 } };

    engine.addPokemon(pikachu);
    engine.addPokemon(bulbasaur);

    let battleOver = false;
    while (!battleOver) {
      // Pikachu attacks Bulbasaur
      const result = engine.submitAction(pikachu.id, MockMove.thunderbolt, bulbasaur.id);
      if (bulbasaur.hp <= 0) {
        battleOver = true;
        expect(result.success).toBe(true);
        break;
      }

      // Bulbasaur attacks Pikachu
      const result2 = engine.submitAction(bulbasaur.id, MockMove.vinewhip, pikachu.id);
      if (pikachu.hp <= 0) {
        battleOver = true;
        expect(result2.success).toBe(true);
        break;
      }
    }

    expect(battleOver).toBe(true);
  });
});
```

## Bonnes pratiques supplémentaires

### Coverage
- **100% sur le core** : Le coverage doit être de 100% pour `packages/core`.
- **Mesuré sur le renderer** : Le coverage est mesuré mais pas obligatoire pour `packages/renderer`.
- **Exclusions** : Les types, enums, barrels, et mocks sont exclus du coverage.

### Tests inutiles
Éviter les tests qui ne vérifient rien :
```typescript
// ❌ À éviter
it('should return true', () => {
  expect(true).toBe(true);
});

// ✅ Préférer
it('should handle edge cases', () => {
  const result = functionUnderTest(edgeCaseInput);
  expect(result).toBe(expectedOutput);
});
```

### Tests de compilation
Ne pas tester la compilation TypeScript :
```typescript
// ❌ À éviter
it('should compile', () => {
  // Ce test est inutile car la compilation est déjà vérifiée par tsc
});
```

## Lancer les tests

```bash
pnpm test                    # unit seulement
pnpm test:integration        # intégration seulement
pnpm test:all                # tout
pnpm test:coverage           # unit + coverage 100%
```

## Critères de succès

- Tous les tests passent (`pnpm test` vert).
- Coverage 100% sur les fichiers concernés (vérifier avec `pnpm test:coverage`).
- Chaque cas limite identifié dans `game-design.md` a un test correspondant.
- Les tests échouent si on casse la mécanique (red-green vérifié).
