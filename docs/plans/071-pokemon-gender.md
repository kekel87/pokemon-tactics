# Plan 071 — Genres des Pokemon

> Statut : done
> Phase : 4 (suite des plans 069 + 070)
> Créé : 2026-04-29
> Terminé : 2026-04-29

## Contexte

Plan 069 a livré le talent **Cute Charm**, qui inflige `Infatuated` au contact 30 % du temps. La règle officielle exige que l'attaquant soit du **genre opposé** au porteur du talent — actuellement le handler ignore cette condition (déclenche sur n'importe quel attaquant). Idem `Infatuated` côté core : aucun check de genre.

Les genres sont aussi un prérequis pour des talents ultérieurs (Magnétisme, Hyper Cutter, etc.) et pour l'affichage UI joueur (PokeRogue, Showdown affichent ♂/♀ sous le nom).

La donnée existe déjà : `packages/data/reference/pokemon.json` contient `genderRatio: { male: number; female: number } | "genderless"` pour les 151 Pokemon. Elle n'est juste pas exposée par le loader.

## Objectif

1. **Data** : exposer `genderRatio` dans `PokemonDefinition`.
2. **Core** : ajouter `gender: PokemonGender` sur `PokemonInstance`, roll déterministe à la création.
3. **Core** : Cute Charm vérifie `attacker.gender !== self.gender` (et exclut `genderless`).
4. **Renderer** : afficher ♂/♀ à côté du nom dans `InfoPanel`.

Hors scope : breeding, Sweet Veil, Rivalité, Attract en tant que move (pas dans le roster), choix manuel du genre dans Team Builder (Phase 4 plus tard).

**Évolution future (Team Builder / Importer)** : à terme, le genre sera une **information de build** stockée sur l'entrée roster (au même titre que nature, EVs, item tenu), choisie par le joueur dans le Team Builder ou importée depuis un format Showdown-like. Le roll automatique de ce plan sert d'étape transitoire — l'API `rollGender` restera utilisable comme fallback (Pokemon sauvage, IA, sandbox) mais le chemin standard passera par `rosterEntry.gender`. Concevoir l'étape 3 pour que `createPokemonInstance` accepte un genre déjà choisi (paramètre optionnel) en plus du roll par défaut.

## Décisions à acter avec l'humain

- **Symboles** : caractères Unicode `♂` (`♂`) / `♀` (`♀`) directement dans le nameText de l'InfoPanel ? Ou icônes sprite ? → Reco : Unicode pour rapidité, FFTA-like. Couleur `#5fa8ff` (mâle) / `#ff7fb4` (femelle), constantes dans `renderer/constants.ts`.
- **Affichage genderless** : aucun symbole (pas de `–` ou `?`).
- **Déterminisme du roll** : la création se fait dans `BattleSetup.createPokemonInstance` *avant* que l'`engine.random` n'existe. Reco : ajouter un paramètre `rng: () => number` à `createPokemonInstance`, alimenté par un `mulberry32(seed)` dérivé du seed déjà géré pour le replay (`packages/core/src/replay/`). Si pas de seed fourni → `Math.random` en fallback. À valider.
- **Cute Charm sur genderless attaqué** : le porteur (e.g. Clefairy) peut être female, et l'attaquant Magnemite est genderless → handler ne déclenche pas (Showdown rule). OK.

## Étapes d'implémentation

### Étape 1 — Données (packages/data)

- `packages/data/src/loaders/reference-types.ts` : ajouter `genderRatio` au type `ReferencePokemon`.
- `packages/data/src/loaders/load-pokemon.ts` : copier `genderRatio` du JSON vers la `PokemonDefinition` retournée.
- `packages/core/src/types/pokemon-definition.ts` :
  ```ts
  export type GenderRatio = { male: number; female: number } | "genderless";
  export interface PokemonDefinition {
    // ...existing
    genderRatio: GenderRatio;
  }
  ```
- 1 fichier = 1 type → `gender-ratio.ts` séparé.
- `packages/core/src/testing/mock-pokemon.ts` : default `genderRatio: { male: 50, female: 50 }`, override OK pour tests genderless.

### Étape 2 — Type PokemonGender (packages/core)

- `packages/core/src/enums/pokemon-gender.ts` :
  ```ts
  export const PokemonGender = {
    Male: "male",
    Female: "female",
    Genderless: "genderless",
  } as const;
  export type PokemonGender = typeof PokemonGender[keyof typeof PokemonGender];
  ```
- `packages/core/src/types/pokemon-instance.ts` : `gender: PokemonGender;` (non-optionnel, toujours rolled).
- Helper `packages/core/src/battle/roll-gender.ts` :
  ```ts
  export function rollGender(ratio: GenderRatio, rng: () => number): PokemonGender {
    if (ratio === "genderless") return PokemonGender.Genderless;
    return rng() * 100 < ratio.male ? PokemonGender.Male : PokemonGender.Female;
  }
  ```
- Tests : 0/100 → toujours female ; 100/0 → toujours male ; genderless → Genderless ; distribution stable sur 1000 rolls avec seed fixe.

### Étape 3 — Création d'instance (renderer)

- `packages/renderer/src/game/BattleSetup.ts:43` `createPokemonInstance` : prendre un paramètre `rng: () => number` **et** un paramètre optionnel `genderOverride?: PokemonGender`. Si `genderOverride` fourni → assigner directement, sinon `rollGender(definition.genderRatio, rng)`. Préparer le futur Team Builder qui passera le genre choisi.
- Caller `createBattleFromPlacements` : créer un `mulberry32(setupSeed)` (seed déjà fourni par le replay system, sinon `Date.now()`).
- `SandboxSetup.ts` : idem.
- ⚠ Determinism : vérifier que l'ordre de création des instances ne change pas entre runs (ordre `placements`).

### Étape 4 — Cute Charm gender check (packages/data)

- `packages/data/src/abilities/ability-definitions.ts:281` `cuteCharm.onAfterDamageReceived` : ajouter en tête
  ```ts
  if (
    context.self.gender === PokemonGender.Genderless ||
    context.attacker.gender === PokemonGender.Genderless ||
    context.self.gender === context.attacker.gender
  ) {
    return [];
  }
  ```
- Test d'intégration `abilities.integration.test.ts` :
  - Attaquant male vs porteur Jigglypuff female (override) → Infatuated possible.
  - Attaquant male vs porteur Jigglypuff male (override) → jamais Infatuated.
  - Attaquant female vs porteur female → jamais Infatuated.
  - Attaquant Magnemite (genderless) vs Jigglypuff → jamais.
  - Attaquant Jigglypuff vs Magnemite porteur (cas hypothétique override) → jamais.

### Étape 5 — InfoPanel (renderer)

- `packages/renderer/src/constants.ts` : `GENDER_SYMBOL_MALE_COLOR = "#5fa8ff"`, `GENDER_SYMBOL_FEMALE_COLOR = "#ff7fb4"`.
- `packages/renderer/src/ui/InfoPanel.ts` :
  - Ajouter `private readonly genderText: Phaser.GameObjects.Text;`
  - Positionner après `nameText` : x = `nameText.x + nameText.width + 4`.
  - `update()` : si `gender === Genderless` → vide ; sinon `♂`/`♀` avec couleur dédiée.
- i18n : pas de string nécessaire (symboles Unicode universels).
- Documenter les nouvelles constantes dans `docs/design-system.md`.

### Étape 6 — Tests + CI

- 1130 unit + 134 integration actuels doivent rester verts.
- +3 tests unitaires `roll-gender.test.ts`.
- +3 tests intégration Cute Charm (Étape 4).
- Lint zero warning, typecheck strict, `pnpm test:integration` vert.

## Validation visuelle

- Lancer combat sandbox 4 Pokemon : vérifier ♂/♀ apparaît dans InfoPanel selon hover.
- Magnemite : aucun symbole.
- Cute Charm : tester Clefairy (female) vs male attacker → floating text + Infatuated. Vs female attacker → rien.

## Risques

- **Determinism replay** : si `rollGender` n'utilise pas le seed de replay, deux replays identiques peuvent diverger. Bloquant pour Phase 7 multi. Mitigation : étape 3, plumber le seed proprement.
- **Tests cassés** : `MockPokemon.fresh` doit fournir `gender` par défaut, sinon ~1000 tests cassent. Default `Genderless` pour les tests qui n'en ont rien à faire.

## Effort estimé

½ journée. Plan court.

## Notes review (game-designer + plan-reviewer)

- **Bug data hors-scope** : `kangaskhan` a `genderRatio: { male: 50, female: 50 }` dans `reference/pokemon.json`, canon Bulbapedia = `{ male: 0, female: 100 }`. Pas dans le roster actuel donc pas bloquant pour ce plan, mais à tracer dans `docs/backlog.md` (data update).
- **Carrier Cute Charm confirmé** : Jigglypuff (25M / 75F), pas Clefairy (qui n'est pas dans le roster-poc actuel).
- **Eevee/Growlithe** ratios biaisés (87.5M/12.5F, 75M/25F) confirmés en JSON, cohérents canon.
- Aucune autre ability du roster ne dépend du genre — Rivalité (Nidoran-M) a `poison-point` comme abilityId actuel.

## Décisions documentées (à acter)

- #278 — `PokemonInstance.gender` rolled à la création via `genderRatio`, déterministe via seed de replay.
- #279 — Cute Charm vérifie le genre opposé non-genderless (rule Showdown).
- #280 — Affichage UI : symboles Unicode ♂/♀ colorés dans InfoPanel, rien si genderless.
