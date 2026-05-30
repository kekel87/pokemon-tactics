# Plan 100 — Taunt (Provoc)

> Statut : **done**
> Créé : 2026-05-28
> Livré : 2026-05-28
> Auteur : Claude
> Spec source : Showdown `sim/data/moves.ts` (Gen 5+), Bulbapedia Taunt, canon roster Gen 1.

## Objectif

Livrer `taunt` (Ténèbres, statut, Single r3) — disruptor canon anti-setup. Pendant **3 tours** (canon Gen 5+), la cible ne peut plus utiliser de moves de catégorie `Status` (Reflect, Substitute, Calm Mind, Synthesis, Sunny Day, etc.). Force le jeu offensif.

## Pourquoi maintenant

- **Complète la trinity disruption** : avec plan 095 (Reflect/LightScreen), 098 (Mist/Safeguard), 099 (Substitute), Taunt = contre canon des setups défensifs ajoutés ces 3 plans. Bouclage thématique du sprint defensive-tools.
- **Petit, infra existante** : mirror confusion/flinch côté state, mirror handle-status côté pipeline. Check single dans `executeUseMove`. ~1500 lignes au total.
- **Roster Gen 1 quasi universel** via TM Gen 9 (alakazam, gengar, aerodactyl, starmie, mewtwo, mew, jolteon...). OP sets enrichis sans effort.

## Hors scope

- **Magic Coat / Magic Bounce reflect Taunt** : moves/abilities pas implémentés.
- **Sleep Talk / Snore** : pas implémentés.
- **Struggle fallback** : si toutes les moves status d'un Pokemon sont bloquées ET aucun move offensif → joueur peut Move ou EndTurn. Struggle pas implémenté roster.
- **Z-A pipeline** : Taunt fonctionnera tel quel quand le pipeline arrivera.

## Décisions actées

### 1. Modèle d'état — volatile standard (mirror Confused)

`StatusType.Taunted` ajouté à l'enum. Volatile avec `turnsRemaining: 3` (decrement standard EndTurn). Pas de field dédié sur `PokemonInstance` (lookup via `volatileStatuses` array, comme Confused/Flinch/LockedOn).

```ts
// packages/core/src/enums/status-type.ts
export const StatusType = {
  Burned: "burned",
  // ... existants
  Flinch: "flinch",
  Taunted: "taunted", // nouveau
} as const;
```

Ajout à `VOLATILE_STATUSES` dans `handle-status.ts`.

### 2. Application via handle-status (déjà câblé)

Move `taunt` utilise `EffectKind.Status` standard → `handle-status.ts` :
- **Substitute absorbe** : `shouldSubstituteBlock` check existant (statut sans bypasssub flag) → bloque automatiquement (plan 099, zéro nouveau code).
- **Safeguard NE bloque PAS** : Taunt n'est ni statut majeur ni Confusion. Helper `isProtectedFromStatus` retourne `false` car la liste protégée n'inclut pas `Taunted`. **À vérifier** dans `aura-system.ts` ligne par ligne — pas de modif nécessaire si déjà bien typé.
- **Mist NE bloque PAS** : Taunt n'est pas stat decrease.
- **Self-induced bypass** : pas applicable (Taunt cible toujours ennemi en canon).

### 3. Blocage des moves status — check dans executeUseMove

```ts
// packages/core/src/battle/BattleEngine.ts (dans executeUseMove, AVANT dépense PP)
const tauntedVolatile = pokemon.volatileStatuses.find(
  (v) => v.type === StatusType.Taunted,
);
if (tauntedVolatile && moveDef.category === MoveCategory.Status) {
  return {
    success: false,
    events: [{
      type: BattleEventType.TauntBlocked,
      pokemonId: pokemon.id,
      moveId,
    }],
    error: ActionError.InvalidAction,
  };
}
```

Nouveau `BattleEventType.TauntBlocked`. `getLegalActions` filtre aussi : pour chaque move status, omettre du tableau retourné si le caster est tainted (UI cohérente).

### 4. Move data

```ts
// packages/data/src/moves/tactical.ts
{
  id: "taunt",
  name: "Provoc",
  type: PokemonType.Dark,
  category: MoveCategory.Status,
  power: 0,
  accuracy: 100,
  pp: 20,
  targetingKind: TargetingKind.Single,
  range: 3,
  losRequired: true,
  priority: 0,
  effects: [{
    kind: EffectKind.Status,
    target: EffectTarget.Defender,
    status: StatusType.Taunted,
    turns: 3,
  }],
  effectTier: EffectTier.Disruption,
  description: "Met l'adversaire en rogne 3 tours. Ne peut plus utiliser de moves statuts.",
}
```

Reference Showdown : description FR/EN déjà présentes. ID Showdown `taunt` → kebab `taunt` (pas de tiret).

### 5. OP sets — 4 disruptors canon

Variants Taunt ajoutés (~169 → ~173) :
- **alakazam-taunt** : Taunt / Psychic / Shadow-Ball / Recover. Lead anti-setup vs Substitute/Calm-Mind.
- **gengar-taunt** : Taunt / Shadow-Ball / Sludge-Wave / Substitute. Lead disruptor.
- **aerodactyl-taunt** : Taunt / Rock-Slide / Crunch / Aerial-Ace. Speed control + anti-Stealth Rock (canon competitive).
- **starmie-taunt** : Taunt / Hydro-Pump / Ice-Beam / Recover. Pivot disruptor.

### 6. Renderer

- **InfoPanel** : badge volatile `Provoc {turns}t` (mirror `Confus`/`Verrouillé`). `VOLATILE_LABELS` étendu.
- **MoveTooltip** : si caster.volatileStatuses contient Taunted ET `move.category === Status` → tag rouge `Bloqué par Provoc`. Style mirror `Bloqué (Sub)` plan 099.
- **MoveSelector / radial menu** : items status grisés + non-cliquables si caster tainted (mirror PP=0 disable). Re-utiliser helper existant `isMoveAvailable` ou créer `isMoveSelectable(caster, move)`.
- **BattleLogFormatter** : `TauntBlocked` → "{pokemon} ne peut pas utiliser {move} à cause de Provoc !". Nouveau case sur l'event existant `StatusApplied` filtre par `status === Taunted` → "{pokemon} est provoqué !". Sur expiration (event existant `StatusRemoved` filtré Taunted) → "La provoc de {pokemon} se dissipe."
- **Floating text** : `"Provoc!"` texte rouge sur target lors de l'application (mirror `Confus!`).

### 7. IA — scoring anti-setup

```ts
// packages/core/src/ai/action-scorer.ts (extension scoreStatusMove)
// Pour EffectKind.Status avec status === Taunted
const target = state.pokemon.get(action.targetPokemonId);
const statusMoveRatio = countStatusMoves(target) / target.movepool.length;
let score = weights.statusMove;
if (statusMoveRatio >= 0.4) score *= 1.8; // Anti-setup bonus
if (target.currentHp / target.combatStats.hp < 0.3) score *= 0.3; // KO direct prioritaire
return score;
```

Helper `enemyHasManyStatusMoves` dans `packages/core/src/ai/threat-detection.ts` (mirror plan 098 threat helpers).

### 8. i18n FR/EN

```ts
// packages/renderer/src/i18n/locales/{fr,en}.ts
status: {
  taunted: { fr: "Provoc", en: "Taunted" },
},
infoPanel: {
  volatile: {
    taunted: { fr: "Provoc {turns}t", en: "Taunt {turns}t" },
  },
},
battle: {
  taunt: {
    applied: { fr: "{pokemon} est provoqué !", en: "{pokemon} fell for the taunt!" },
    blocked: {
      fr: "{pokemon} ne peut pas utiliser {move} à cause de Provoc !",
      en: "{pokemon} can't use {move} after the taunt!",
    },
    expired: {
      fr: "La provoc de {pokemon} se dissipe.",
      en: "{pokemon} shook off the taunt.",
    },
  },
},
moveTooltip: {
  tag: {
    tauntBlocked: { fr: "Bloqué par Provoc", en: "Blocked by Taunt" },
  },
},
```

### 9. Tests intégration (8 scénarios)

1. **Application + durée 3 tours** : taunt appliqué T1, decrement T2/T3/T4, expire T4 emission StatusRemoved.
2. **Blocage move statut** : caster tainted essaie Recover → ActionError + TauntBlocked event.
3. **Move offensif OK** : caster tainted utilise Psychic → succès normal.
4. **Substitute absorbe Taunt** : target sub → SubstituteDamaged ou no-op (selon code plan 099, vérifier comportement attendu canon = status bloqué par sub).
5. **Safeguard NE bloque PAS Taunt** : target sous Safeguard → taunt applique normalement (vérification canon).
6. **Mist NE bloque PAS Taunt** : target sous Mist → taunt applique normalement.
7. **KO clear** : caster tainted KO → `handleKo` nettoie volatileStatuses (déjà câblé).
8. **getLegalActions filter** : tainted Pokemon → moves status absents du retour.

Tests unitaires :
- `taunt.test.ts` : helper `enemyHasManyStatusMoves`.
- `action-scorer.test.ts` : extension scoring Taunt.

### 10. Bypass automatique des interactions existantes

- **Plan 099 Substitute** : check `shouldSubstituteBlock` dans `handle-status.ts` bloque déjà tout status sans bypasssub flag → Taunt automatiquement absorbé.
- **Plan 098 Safeguard** : `isProtectedFromStatus` whitelist majeurs + Confusion → Taunt automatiquement non protégé.
- **Plan 095 Reflect/LightScreen** : ne touchent que les dégâts → non concerné.

## Étapes d'exécution

1. **Core** :
   - `StatusType.Taunted` enum + `VOLATILE_STATUSES` set.
   - `BattleEventType.TauntBlocked` + type event.
   - `executeUseMove` check Taunted + Status category.
   - `getLegalActions` filtre moves status si tainted.
   - `handleKo` cleanup (vérifier idempotent — déjà géré pour tous volatiles).
2. **Data** :
   - Move `taunt` dans `tactical.ts`.
   - 4 OP sets dans `op-sets.json`.
   - Reference FR/EN Showdown déjà présent — vérifier import.
3. **Renderer** :
   - `InfoPanel.VOLATILE_LABELS` extension.
   - `MoveTooltip` tag rouge.
   - `MoveSelector` grisé non-cliquable.
   - `BattleLogFormatter` 3 nouveaux cas (applied via filter, blocked, expired via filter).
   - Floating text orchestration `GameController`.
4. **IA** :
   - Helper `enemyHasManyStatusMoves` dans `threat-detection.ts`.
   - `action-scorer.ts` extension `scoreStatusMove` pour Taunted target.
5. **i18n** :
   - 5 nouvelles clés FR/EN.
6. **Tests** :
   - 8 scénarios intégration dans `taunt.integration.test.ts`.
   - 2 unit tests (threat-detection, action-scorer extension).
7. **Gate CI** :
   - `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`.
   - Cible : ~1625 unit + ~254 intégration verts.

## Risques / pièges

- **Régression plan 099 Substitute** : check tags Taunt absorbé par sub. À couvrir dans test #4.
- **UI radial menu** : grisé/non-cliquable doit être visuellement clair (rouge ou opacité réduite). Tester en sandbox post-impl.
- **IA score collision** : si Taunt score trop haut, l'IA spamme Taunt → cap via `statusMoveRatio` threshold (0.4). Vérifier équilibrage dans tests `scored-ai-smoke`.
- **Multi-volatile** : un Pokemon peut être à la fois Taunted + Confused + Flinch. Pas de conflit (states indépendants), UI badge stack horizontal déjà géré.

## Validation post-impl

- 8 tests intégration verts.
- Sandbox : appliquer taunt sur Alakazam IA → Alakazam ne joue plus Recover/Calm-Mind/Substitute pendant 3 tours, fallback sur Psychic.
- InfoPanel affiche `Provoc 3t` → `2t` → `1t` → disparaît.
- MoveTooltip rouge sur Recover quand tainted.
- Battle log lisible FR + EN.
