# Plan 098 — Brume / Rune Protect — Team Protections aura mobile

> Statut : **done**
> Créé : 2026-05-24
> Livré : 2026-05-24
> Auteur : Claude
> Spec source : `docs/backlog.md` ("Mist / Safeguard — Team Protections bundle"), `docs/plans/095-barriers-aura.md` (infra ScreenAura)

## Objectif

Livrer 2 moves protections d'équipe canon Pokemon avec twist tactique aura mobile r3 Manhattan (mirror plan 095) :

- **Brume** (`mist`, type Glace, statut) — bloque les **baisses de stats** infligées par ennemis sur caster + alliés dans r3.
- **Rune Protect** (`safeguard`, type Normal, statut) — bloque les **statuts majeurs** (Burned/Paralyzed/Poisoned/BadlyPoisoned/Asleep/Frozen) + **Confusion** sur caster + alliés dans r3.

Refactor infra plan 095 : unifier `ScreenAura` → `TeamAura` (1 array `BattleState.auras`, enum `AuraKind` = Reflect | LightScreen | Mist | Safeguard). Helpers radius / cleanup KO / décrément end-of-round partagés. `damage-calculator` ne consulte que kinds Reflect/LightScreen. Nouveaux hooks dans `handle-stat-change.ts` (Mist) et `handle-status.ts` (Safeguard).

## Pourquoi maintenant

- Infra ScreenAura plan 095 prête (`BattleState.screens`, `EffectKind.PostScreen`, end-of-round tick, KO cleanup, indicateurs visuels). Coût marginal extension faible.
- Roster Gen 1 couverture : 3 learners Brume (Lokhlass, Artikodin, Mewtwo), 12 learners Rune Protect (Alakazam, Papilusion, Mélodelfe, Lamantine, Kangourex, Staross, M. Mime, Sulfura, Dracolosse, Mewtwo, Ninetales, Flagadoss). Critical mass support légendaires / support mons.
- Compte tient face à Reflect/LightScreen — Brume contre stat-spam (Intimidate Arbok / Tail Whip Persian), Rune Protect contre status-spam (Spore Parasect / Lovely Kiss Jynx / Toxic-Spikes flow).
- Pas de météo / pas de field / 0 ability nouvelle. Self-contained, faible risque régression.

## Hors scope

- **Aurora Veil** — toujours dropped (0 learner Gen 1, backlog post-Z-A).
- **Infiltrator ability** — bypass auras toutes catégories. Pas de learner Gen 1. Reporté Phase 9.
- **Light Clay extension Mist/Safeguard** — Light Clay reste exclusif screens dommages plan 095 (canon Showdown, décision actée). Brume/Rune Protect durée fixe **5 tours**.
- **Mist bloque baisses self-induced** (Close Combat self-Def-1, Overheat self-SpA-2) — hors canon, passent normalement.
- **Mist bloque Sticky Web / pseudo-stat-decreases entry-hazards** — pas de hazards roster Gen 1, hors scope.
- **Safeguard bloque Flinch** — hors canon Gen 6+, Flinch passe.
- **Safeguard bloque Yawn pré-Sleep** — Yawn pas implémenté, sans objet.
- **Safeguard bloque Intimidate / Infatuated (volatils)** — décision à acter dans plan ; **Intimidate = stat-decrease → couvert par Mist** (Atk -1), pas Safeguard. **Infatuated = volatile non-statut-majeur → passe Safeguard** (canon Gen 6+).

## Décisions actées

### 1. Architecture — unification ScreenAura → TeamAura

`BattleState.screens: ScreenAura[]` → `BattleState.auras: TeamAura[]`. Refactor plan 095.

```ts
// packages/core/src/enums/aura-kind.ts (renommé screen-kind.ts)
export const AuraKind = {
  Reflect: "reflect",
  LightScreen: "light-screen",
  Mist: "mist",
  Safeguard: "safeguard",
} as const;
export type AuraKind = (typeof AuraKind)[keyof typeof AuraKind];

// packages/core/src/types/team-aura.ts (renommé screen-aura.ts)
export interface TeamAura {
  kind: AuraKind;
  casterPokemonId: string;
  remainingRounds: number;
  postedRound: number;
}
```

Rationale : sémantique aura mobile d'équipe générique. Refactor coût ~1h (renommage symbol-wide, tests touchés). Gain : un seul système de décrément, cleanup KO, événements lifecycle. `damage-calculator` filtre kind Reflect/LightScreen, `handle-stat-change` filtre Mist, `handle-status` filtre Safeguard.

### 2. Rayon + bénéficiaires

**r3 Manhattan** (mirror plan 095). Caster vivant + alliés `playerId === caster.playerId` dans `manhattanDistance ≤ 3`. Ennemis exclus. Caster KO → aura disparaît (`removeAurasOfCaster` plan 095 réutilisé tel quel).

### 3. Durée

**5 tours fixes** pour Mist + Safeguard. Light Clay **n'étend pas** (décision actée). `screenDurationForCaster` plan 095 devient `auraDurationForCaster(caster, kind)` :

```ts
export function auraDurationForCaster(caster: PokemonInstance, kind: AuraKind): number {
  if (kind === AuraKind.Reflect || kind === AuraKind.LightScreen) {
    return caster.heldItemId === HeldItemId.LightClay ? 8 : 5;
  }
  return 5; // Mist / Safeguard always 5
}
```

### 4. Mist — scope blocage stat decrease

Bloque toute baisse de stat **infligée par un ennemi** sur target dans aura Mist active d'un allié (target inclus = caster Mist + alliés r3). Détection ennemi via `attacker.playerId !== target.playerId` dans `handle-stat-change.ts` (effects type `StatChange` avec `stages < 0`).

**Cas couverts** :
- Growl/Rugissement (Atq -1 enemies)
- String-Shot/Sécrétion (Spe -1 / -2 enemies)
- Tail-Whip/Mimi-Queue (Déf -1 enemies)
- Charm/Charme (Atq -2)
- Intimidate (Atk -1 on-switch — couvert si Pokemon avec Intimidate apparaît adjacent à allié protégé par Mist)
- Tous moves `StatChange` cible ennemie avec `stages < 0`
- Effects secondaires (ex: Iron-Tail Def -1 30%) — bloqués si target dans aura

**Cas non couverts** :
- Self-stat-decrease (Close-Combat self-Def-1, Overheat self-SpA-2, Superpower self-Atk/Def-1) — passe
- Buffs alliés (Helping-Hand, Growth) — passe (positif, hors scope)
- Sticky-Web — hors roster

**Comportement** : tentative baisse → vérifier auras Mist actives protégeant target → si match → bloquer **avant** modification stage, emit `StatChangeBlocked` event + i18n battle log "Brume protège {pokemonName} !".

### 5. Safeguard — scope blocage statuts

Bloque statuts suivants sur target dans aura Safeguard active d'un allié (caster + alliés r3) :

**Statuts majeurs** : Burned, Paralyzed, Poisoned, BadlyPoisoned, Asleep, Frozen.

**Volatils canon** : Confused.

**Ne bloque pas** :
- Seeded (Vampigraine, mécanique link/drain) — passe
- Trapped (Wrap/Bind) — passe (mécanique contrainte position)
- Intimidated (volatile stat-linked, voir Mist couvre via baisse Atk)
- Infatuated (Charme/Attraction) — hors canon Safeguard Gen 6+
- LockedOn (Verrouillage) — utility, hors scope
- Roosted (interne Roost) — hors scope
- Flinch — hors canon

**Bypass connus canon** :
- **Rest** (`rest`) = self-induced Asleep → **bypass Safeguard** (caster choisit dormir, canon). Caster même protégé peut Rest.
- **Status terrain** (lava burn, ice freeze) = terrain hazard, **non bloqué par Safeguard** (canon Showdown : Safeguard bloque moves enemy, pas environnement). Décision actée : terrain status passe.
- **Toxic-Orb / Flame-Orb auto-status** = self-induced, bypass.

**Comportement** : tentative pose statut → vérifier auras Safeguard actives protégeant target → si match ET source ennemie (move enemy) → bloquer **avant** application + emit `StatusBlocked` event + i18n battle log "Rune Protect protège {pokemonName} !".

### 6. Sources blocage — règle universelle

Une protection ne s'applique **que si la source est ennemie** (`source.playerId !== target.playerId`). Ally-cast effects (Helping-Hand alliée future, terrain alliée, Baton Pass) passent au travers.

Exception : **terrain damage/status** (lava, deep_water freeze) — pas de "source ennemie" claire → traité comme hors scope protections (passe). Cohérent avec canon Showdown.

### 7. Effect type — PostScreen → PostAura

`EffectKind.PostScreen` → `EffectKind.PostAura` (renommage symbol-wide). Effect data inclut `kind: AuraKind`. Handler `handle-post-aura.ts` (renommé) traite les 4 kinds via switch unique.

```ts
export interface PostAuraEffect {
  kind: EffectKind.PostAura;
  auraKind: AuraKind;
  target: EffectTarget.Self; // caster pose son aura
}
```

### 8. Indicateurs visuels — extension plan 095

`PokemonSprite.setLeftIndicators(specs)` plan 095 étendu pour ordre temporel 4 kinds max simultanés (caster peut tenir Reflect+LightScreen+Mist+Safeguard si pose les 4 — théorique mais autorisé).

Icônes :
- Reflect 🛡️ (livré plan 095)
- LightScreen ✨ (livré plan 095)
- Mist 🌫️ (nouveau, emoji ou sprite 16px)
- Safeguard 🕊️ (nouveau)

**Hover-only zone aura** : `IsometricGrid.showAuraHoverIcons` (renommé) affiche au centre tiles dans rayon r3 caster survolé. Mist/Safeguard ne changent pas dégâts donc pas de pulse caster — uniquement icône hover + InfoPanel badges.

### 9. InfoPanel badges

Badge caster : `{kind} {turns}t` (ex: "Brume 3t").

Badge protected : `{kind}` sans turns (ex: "Rune Protect").

Si Pokemon protégé par 2 kinds différents (Reflect d'un allié + Mist d'un autre) → 2 badges empilés. Limite 4 max (taille panel).

### 10. IA scoring

`scoreSelfMove` plan 095 étend pour `EffectKind.PostAura` avec branches par kind :

- Reflect / LightScreen : déjà livré plan 095 (`× earlyMultiplier × (1 + alliesInRadius)`, -1 si même kind active caster).
- **Mist** : score `× earlyMultiplier × (1 + alliesInRadius) × statThreatBonus` où `statThreatBonus = 1.5` si au moins 1 ennemi adjacent r5 avec stat-decrease move dans movepool (Intimidate, Growl, Tail-Whip, String-Shot, Charm, Iron-Tail-secondary, etc.), sinon `1.0`. -1 si Mist déjà active caster.
- **Safeguard** : score `× earlyMultiplier × (1 + alliesInRadius) × statusThreatBonus` où `statusThreatBonus = 1.5` si au moins 1 ennemi r5 avec status-inflict move dans movepool (Spore, Thunder-Wave, Will-O-Wisp, Toxic, Lovely-Kiss, Confuse-Ray, Sleep-Powder, Stun-Spore, Poison-Powder, etc.). -1 si Safeguard déjà active caster.

Helpers : `enemyHasStatDecreaseMove(state, casterTeam, range)` + `enemyHasStatusMove(state, casterTeam, range)` dans `ai/threat-detection.ts` (nouveau).

### 11. Data — moves

```ts
// packages/data/src/moves/tactical.ts
{
  id: "mist",
  pp: 30,
  accuracy: null, // bypass accuracy
  category: Category.Status,
  type: PokemonType.Ice,
  targeting: { kind: TargetingKind.Self },
  effects: [{ kind: EffectKind.PostAura, auraKind: AuraKind.Mist, target: EffectTarget.Self }],
  // pas de chargeEffects, instant
}
{
  id: "safeguard",
  pp: 25,
  accuracy: null,
  category: Category.Status,
  type: PokemonType.Normal,
  targeting: { kind: TargetingKind.Self },
  effects: [{ kind: EffectKind.PostAura, auraKind: AuraKind.Safeguard, target: EffectTarget.Self }],
}
```

i18n FR : `mist` → "Brume", `safeguard` → "Rune Protect" (déjà présents dans `moves.fr.json`).

### 12. OP sets — pas de mises à jour requises v1

Brume/Rune Protect = moves utilitaires niche. Pas d'OP set canon Smogon Gen 1 où ils sont compétitifs (overshadowed par offensive). 3 learners Mist Gen 1 légendaires + Lokhlass — leur OP set actuel (Sheer Cold/Ice Beam/Surf/Thunderbolt pour Articuno, etc.) reste valide. Backlog éventuel : "OP sets Support Phase 9" si on développe archétype support team-builder.

## Plan d'exécution

### Étape 1 — Refactor ScreenAura → TeamAura (infra plan 095)

**1.1** Renommer fichiers :
- `packages/core/src/enums/screen-kind.ts` → `aura-kind.ts`
- `packages/core/src/types/screen-aura.ts` → `team-aura.ts`
- `packages/core/src/battle/screens-system.ts` → `aura-system.ts`
- `packages/core/src/battle/screens-tick-handler.ts` → `aura-tick-handler.ts`
- `packages/core/src/battle/handlers/handle-post-screen.ts` → `handle-post-aura.ts`
- Tests : `screens-*.test.ts` → `auras-*.test.ts`

**1.2** Renommer symbols :
- `ScreenKind` → `AuraKind` (étendu Mist + Safeguard)
- `ScreenAura` → `TeamAura`
- `BattleState.screens` → `BattleState.auras`
- `state.screensLastTickRound` → `state.aurasLastTickRound`
- `EffectKind.PostScreen` → `EffectKind.PostAura`
- `BattleEventType.ScreenPosted/Dissipated/Broken` → `AuraPosted/Dissipated/Broken`
- `screenDurationForCaster` → `auraDurationForCaster` (signature étendue `kind`)
- `computeScreenMultiplier` reste (filtre interne kind Reflect/LightScreen via `screenKindMatchesCategory`)
- `findActiveAurasProtectingTarget` reste, ajout param optional `kindFilter?: AuraKind` pour filtrer Mist/Safeguard recherches

**1.3** Tests régénérés : `auras-state.test.ts`, `auras-system.test.ts`, `auras-damage.integration.test.ts`, `auras-lifecycle.integration.test.ts`. Pas de logique changée, juste renommages.

**1.4** Renderer + i18n :
- `screen.posted.*` → `aura.posted.*` clés i18n (avec branches `aura.posted.reflect`, `aura.posted.light-screen`, `aura.posted.mist`, `aura.posted.safeguard`)
- `screen.dissipated.*`, `screen.broken` → `aura.dissipated.*`, `aura.broken`
- `screen.kind.*` → `aura.kind.*`
- `infoPanel.aura.caster/protected` reste
- BattleLogFormatter switch cases mis à jour

**1.5** `GameController.refreshScreenVisuals()` → `refreshAuraVisuals()`. `IsometricGrid.showScreenAuraHoverIcons` → `showAuraHoverIcons` (accepte map kind → icon).

**Gate étape 1** : tous tests plan 095 verts post-refactor + lint + typecheck.

### Étape 2 — Helper `applyAuraDecisions` + détection sources ennemies

**2.1** Helper unique `findActiveAurasProtectingTarget(state, target, kindFilter?)` étend signature avec filtre kind optionnel. Sans filtre = comportement actuel. Avec filtre = liste auras d'un kind précis.

**2.2** Helper `isProtectedFromStatDecrease(state, attacker, target): boolean` :
```ts
export function isProtectedFromStatDecrease(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
): boolean {
  if (attacker.playerId === target.playerId) return false; // self/ally → no protection
  const auras = findActiveAurasProtectingTarget(state, target, AuraKind.Mist);
  return auras.length > 0;
}
```

**2.3** Helper `isProtectedFromStatus(state, attacker, target, status): boolean` :
```ts
const SAFEGUARD_BLOCKED_STATUSES = new Set<StatusType>([
  StatusType.Burned, StatusType.Paralyzed, StatusType.Poisoned,
  StatusType.BadlyPoisoned, StatusType.Asleep, StatusType.Frozen,
  StatusType.Confused,
]);

export function isProtectedFromStatus(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
  status: StatusType,
): boolean {
  if (attacker.playerId === target.playerId) return false;
  if (!SAFEGUARD_BLOCKED_STATUSES.has(status)) return false;
  const auras = findActiveAurasProtectingTarget(state, target, AuraKind.Safeguard);
  return auras.length > 0;
}
```

### Étape 3 — Hook Mist dans `handle-stat-change.ts`

**3.1** Effect handler `handleStatChange` :
- Avant application stage, pour chaque target avec `stages < 0` ET `attacker.playerId !== target.playerId` :
  - Si `isProtectedFromStatDecrease(state, attacker, target)` → skip mutation + emit `StatChangeBlocked { pokemonId, stat, reason: "mist", protectingCasterId }`.
  - i18n battle log : `aura.blocked.mist {pokemonName}` → "Brume protège {nom} !".

**3.2** Nouveau event `BattleEventType.StatChangeBlocked` :
```ts
{
  type: BattleEventType.StatChangeBlocked,
  pokemonId: string,
  stat: StatName,
  reason: "mist" | "ability", // ability = futur Clear-Body etc.
  protectingCasterId?: string,
}
```

**3.3** Intimidate ability (`packages/data/src/abilities/intimidate.ts`) → vérifier Mist avant baisse Atk. Hook `onSwitchIn` (ou équivalent) appelle helper.

**3.4** Tests intégration `aura-mist.integration.test.ts` :
- Growl ennemi sur allié protégé Mist → Atk inchangée, event émis
- Growl ennemi sur ennemi (hors aura) → Atk normale baissée
- Close-Combat self-Def-1 du caster Mist → Def baissée (self-induced passe)
- Intimidate Arbok switch-in adjacent à allié Mist → Atk allié inchangée
- 2 Mist alliés overlap → reste bloqué (idempotent)
- Caster Mist KO → aura disparue → Growl baisse normale

### Étape 4 — Hook Safeguard dans `handle-status.ts`

**4.1** Effect handler `handleStatus` :
- Avant application status, si `attacker.playerId !== target.playerId` :
  - Si `isProtectedFromStatus(state, attacker, target, status)` → skip + emit `StatusBlocked { pokemonId, status, reason: "safeguard", protectingCasterId }`.
  - i18n : `aura.blocked.safeguard {pokemonName} {statusLabel}` → "Rune Protect protège {nom} !".

**4.2** Secondary effects (Iron-Tail Def-1 30% etc.) — déjà passent par `handleStatChange` filtré par Mist (étape 3).

**4.3** Secondary status effects (Fire-Blast Burn 10%, Thunder Para 30%, etc.) — `handleStatus` filtre Safeguard.

**4.4** Self-induced status :
- Rest (`rest` move) : self-cast `Asleep` sur caster. Source = caster = attacker = self → `attacker.playerId === target.playerId` → bypass Safeguard. ✅
- Flame-Orb / Toxic-Orb (held items) : pas implémentés roster v1 mais `onEndTurn` handler aura `attacker = target` → bypass naturel.

**4.5** Tests intégration `aura-safeguard.integration.test.ts` :
- Spore ennemi sur allié protégé Safeguard → Asleep bloqué, event émis
- Will-O-Wisp ennemi sur allié protégé → Burned bloqué
- Rest self → Asleep appliqué (bypass)
- Fire-Blast burn secondaire sur allié protégé → Burned bloqué
- Lava terrain damage + status sur allié protégé → terrain passe (canon non bloqué)
- Confuse-Ray ennemi sur allié protégé → Confused bloqué
- Charm ennemi (Atk -2) sur allié Safeguard SEUL → Atk baissée (Mist absent)

### Étape 5 — Data moves Brume + Rune Protect

**5.1** `packages/data/src/moves/tactical.ts` : 2 entries (voir section décisions 11).

**5.2** Vérifier `pokemon-by-move/mist` + `safeguard` intersect roster :
- Mist : Articuno, Lapras, Mewtwo (3 mons)
- Safeguard : Alakazam, Butterfree, Clefable, Dewgong, Dragonite, Kangaskhan, Mewtwo, Moltres, Mr-Mime, Ninetales, Slowbro, Starmie (12 mons)

**5.3** Implementation flag `implementedMoves` + golden replay régénéré si changement ordering movepool.

**5.4** i18n : `mist` + `safeguard` clés déjà présentes (`moves.fr.json`). Vérifier `moves.en.json`.

### Étape 6 — IA threat detection

**6.1** Nouveau fichier `packages/core/src/ai/threat-detection.ts` :
```ts
const STAT_DECREASE_MOVES = new Set<string>([
  "growl", "tail-whip", "string-shot", "charm", "screech", "leer",
  "smokescreen", "sand-attack", "feather-dance", "scary-face", "metal-sound",
  // + tous moves Status avec StatChange stages<0 enemies
]);

const STATUS_MOVES = new Set<string>([
  "spore", "thunder-wave", "will-o-wisp", "toxic", "lovely-kiss",
  "confuse-ray", "sleep-powder", "stun-spore", "poison-powder",
  "supersonic", "glare", "hypnosis", "sing", "poison-gas", "sweet-kiss",
]);

export function enemyHasStatDecreaseMove(
  state: BattleState,
  casterTeamId: PlayerId,
  range: number,
): boolean { /* itère ennemis Manhattan ≤ range, check movepool intersect STAT_DECREASE_MOVES */ }

export function enemyHasStatusMove(...): boolean { /* idem STATUS_MOVES */ }
```

Sets dérivés statiquement de `moves.json` au build-time (optionnel optimisation Phase 9, hardcodé v1 acceptable).

**6.2** `action-scorer.ts` `scoreSelfMove` étend `EffectKind.PostAura` :
```ts
case EffectKind.PostAura: {
  const kind = effect.auraKind;
  // Reflect / LightScreen logic plan 095 (inchangé)
  // Mist
  if (kind === AuraKind.Mist) {
    const alreadyActive = state.auras.some(a => a.casterPokemonId === caster.id && a.kind === AuraKind.Mist);
    if (alreadyActive) return -1;
    const alliesInRadius = countAlliesInRadius(state, caster, 3);
    const threatBonus = enemyHasStatDecreaseMove(state, caster.playerId, 5) ? 1.5 : 1.0;
    return baseScore * earlyMultiplier * (1 + alliesInRadius) * threatBonus;
  }
  // Safeguard symétrique
  ...
}
```

**6.3** Tests `action-scorer-aura.test.ts` étendus avec scénarios Mist/Safeguard.

### Étape 7 — Renderer indicateurs + InfoPanel

**7.1** Icônes 16px Mist (`🌫️` ou sprite) + Safeguard (`🕊️` ou sprite). Si emoji insuffisant qualité visuelle → générer PixelLab 64×64 (à valider playtest, fallback emoji acceptable v1).

**7.2** `PokemonSprite.setLeftIndicators(specs)` plan 095 déjà generic, ajouter mappings dans `aura-indicator-config.ts` :
```ts
export const AURA_INDICATOR_ICONS: Record<AuraKind, string> = {
  [AuraKind.Reflect]: "🛡️",
  [AuraKind.LightScreen]: "✨",
  [AuraKind.Mist]: "🌫️",
  [AuraKind.Safeguard]: "🕊️",
};
```

**7.3** `GameController.refreshAuraVisuals()` recompute pour les 4 kinds. Idempotent.

**7.4** InfoPanel badges :
- Caster avec aura active : "Brume 3t", "Rune Protect 5t", "Protection 4t", "Mur Lumière 2t" (i18n)
- Protégé : "Brume", "Rune Protect", "Protection", "Mur Lumière"

**7.5** Hover-only icônes centre tiles : Mist/Safeguard utilisent mêmes mécanismes plan 095 (`showAuraHoverIcons`).

### Étape 8 — i18n FR/EN

Nouvelles clés (~12) :
- `aura.kind.mist`, `aura.kind.safeguard`
- `aura.posted.mist`, `aura.posted.safeguard`
- `aura.dissipated.mist`, `aura.dissipated.safeguard`
- `aura.blocked.mist`, `aura.blocked.safeguard`
- `infoPanel.aura.caster.mist`, `infoPanel.aura.caster.safeguard`
- `infoPanel.aura.protected.mist`, `infoPanel.aura.protected.safeguard`

Refactor existant : `screen.*` → `aura.*` (étape 1.4).

### Étape 9 — Tests + gate CI

- Unit : `aura-system.test.ts` étendu, `threat-detection.test.ts`
- Intégration : `aura-mist.integration.test.ts` (~6 scénarios), `aura-safeguard.integration.test.ts` (~7 scénarios)
- Tests existants plan 095 régénérés noms (étape 1.3)
- Golden replay : régénération si ordering movepool change (3 + 12 mons concernés)
- Gate CI complet : build + lint + typecheck + test + test:integration

### Étape 10 — Doc

- `docs/decisions.md` : décisions #383+ (unification aura, Mist scope, Safeguard scope, Light Clay exclusion)
- `docs/abilities-system.md` : pas concerné
- `docs/next.md` : marquer plan 098 done, ajouter "Fait récemment"
- `STATUS.md` : section Phase 4
- `docs/backlog.md` : marquer "Mist / Safeguard — Team Protections bundle" résolu → archive
- `docs/implementations.md` : ajouter Brume + Rune Protect dans Pokemon learners

## Risques + mitigations

| Risque | Mitigation |
|--------|-----------|
| Refactor ScreenAura → TeamAura casse plan 095 | Étape 1 isolée + tests verts gate avant étape 2. Pas de logique changée. |
| Mist bloque baisses self-induced par accident | Helper vérifie `attacker.playerId !== target.playerId` explicite. Tests Close-Combat self-Def. |
| Safeguard bloque Rest | Rest = self-cast, attacker = target → bypass naturel. Test dédié. |
| Confusion bloquée trop large (canon Gen 6+) | Liste `SAFEGUARD_BLOCKED_STATUSES` explicite, Set immuable. Tests Confuse-Ray bloqué. |
| Empilage 4 auras même caster casse renderer | `setLeftIndicators` plan 095 généralise via Map<id, seq>. Test visuel plan 095 déjà OK 2 auras. 4 = extension linéaire. |
| IA spam Mist/Safeguard tous tours | `-1` si déjà actif même caster + kind. ThreatBonus 1.5 require ennemis r5 avec movepool match. |
| Terrain status bloqué par Safeguard | Décision actée : terrain non bloqué (canon). Source terrain ≠ attacker ennemi → bypass naturel via signature `attacker` du handler. |

## Validation

- 1607 unit (plan 095) + ~25 nouveaux unit (helpers + IA) = ~1632 unit attendu
- 220 intégration (plan 095) + ~13 nouveaux intégration (Mist + Safeguard scenarios) = ~233 intégration attendu
- Build + lint + typecheck verts
- Smoke test sandbox : Brume caster + Growl ennemi → "Brume protège" en log + Atk inchangée
- Smoke test sandbox : Rune Protect caster + Spore ennemi → "Rune Protect protège" + pas de Sleep

## Estimations

- Étape 1 (refactor) : ~2h
- Étapes 2-4 (helpers + hooks Mist/Safeguard) : ~3h
- Étape 5 (data moves) : ~30min
- Étape 6 (IA threat detection) : ~1h30
- Étape 7 (renderer indicateurs) : ~1h30
- Étapes 8-10 (i18n + tests + doc) : ~2h

**Total : ~10h** sur 1-2 sessions.

## Suite

Plan 098 livré → backlog item "Mist/Safeguard Team Protections bundle" résolu. Infra `TeamAura` prête pour extensions futures (Aurora Veil post-Z-A, Tailwind side-effect, hazards éventuels).

Candidat suivant : Content Batch G (gap moves Gen 1 restants) ou méga-évolutions Phase 9.
