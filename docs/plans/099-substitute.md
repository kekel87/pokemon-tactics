# Plan 099 — Substitute (Clonage)

> Statut : **done**
> Créé : 2026-05-25
> Livré : 2026-05-25
> Auteur : Claude
> Spec source : `docs/next.md` (mécanique candidate), Showdown `sim/data/moves.ts` (Gen 5+), Bulbapedia Substitute.

## Objectif

Livrer `substitute` (Normal, statut, self-only) — move iconique Gen 1. Le caster sacrifie 25% maxHp pour créer un sub (HP = floor(maxHp/4)) qui absorbe les dégâts ennemis et bloque statuts + stat changes négatives. Sub persiste jusqu'à break (HP ≤ 0) ou KO caster.

Bonus contenu : flag `MoveDefinition.sound` + tag des ~10 moves sound roster Gen 1 → bypass sub canon.

## Pourquoi maintenant

- Pas de méta plan G séparé : substitute = mécanique majeure + content batch (1 move iconique + 1 flag transverse).
- Roster Gen 1 quasi universel — Substitute = TM Gen 1 (presque tous learners). Pool OP sets enrichi.
- Combine avec plan 095 (auras Reflect/LightScreen) et plan 098 (Mist/Safeguard) → trinity defensive : barrière dégâts × écran statuts × sub absorb. Sub = défense individuelle complémentaire.
- Précédent infra : `StatusType` volatile + field PokemonInstance, hooks status/stat-change déjà câblés (plan 098). Coût marginal faible.
- Sprite `dummy` PMDCollab déjà extrait (sandbox) → réutilisable comme overlay.

## Hors scope

- **Bypass Infiltrator** : pas de learner Gen 1, reporté Phase 9.
- **Sub vs Hazards** (Stealth Rock, Spikes, Toxic Spikes) : pas de hazards roster Gen 1.
- **Sub bloque Trap moves** (Bind, Whirlpool) : pas dans roster (Bind volatile via Wrap-like jamais implémenté).
- **Sub bloque Yawn / Disable / Encore** : moves pas implémentés (post-099 candidats).
- **Sub bloque Knockback (Drag Out — Roar, Whirlwind)** : Roar/Whirlwind ont pattern différent (force-switch hors tactical). Vérifier Roar : si présent roster, décider plan d'après.
- **Sub absorbe OHKO** (Fissure, Horn-Drill, Guillotine, Sheer-Cold) : pas implémentés.
- **Multi-hit move** (Twineedle, Double-Slap, Pin-Missile, Icicle-Spear) : sub absorbe hit par hit, break à mi-séquence stoppe restant. Comportement déjà émergent si on route chaque hit séparément — vérifier code multi-hit.
- **Curse (typage Ghost self-damage 50% maxHp)** : pas implémenté Gen 1.

## Décisions actées

### 1. Modèle d'état — volatile + field

```ts
// packages/core/src/enums/status-type.ts
export const StatusType = {
  // ... existants
  Substitute: "substitute",
} as const;
```

`PokemonInstance.substituteHp?: number` (optional, défini ssi `StatusType.Substitute` actif). Invariant : présence du statut ⇔ `substituteHp > 0`.

**Pourquoi field séparé** : sub HP varie indépendamment, doit survivre serialization, accessible aux events. Pattern miroir `chargingMove`, `lockedMoveId`.

### 2. Pose du sub — `EffectKind.PostSubstitute`

```ts
// packages/core/src/enums/effect-kind.ts
PostSubstitute: "post_substitute",
```

Handler `handle-post-substitute.ts` :
- Pré-check : `caster.currentHp > floor(caster.maxHp / 4)` ET `caster.status !== Substitute` (sinon **fail** silencieux + event `MoveCancelled` reason `substitute-already-active` ou `substitute-insufficient-hp`).
- Coût : `caster.currentHp -= floor(maxHp / 4)`.
- État : `caster.status = Substitute`, `caster.substituteHp = floor(maxHp / 4)`.
- Émet `SubstitutePosted { pokemonId, hp }`.

**PP consommé même si fail** ? Canon : oui (move utilisé). Décision : aligné canon, PP consommé, move déclaré used (turnState.hasActed = true).

### 3. Move definition

```ts
// packages/data/src/moves/...
{
  id: "substitute",
  type: "normal",
  category: "status",
  power: 0,
  accuracy: null, // bypass accuracy
  pp: 10,
  targeting: { kind: "self" },
  effects: [{ kind: "post_substitute", target: "caster" }],
  // i18n : "Clone-toi" FR / "Substitute" EN
}
```

### 4. Damage routing — sub absorbe

Modifier `packages/core/src/battle/effect-processor/handle-damage.ts` (ou équivalent — chercher point d'application HP cible) :

```ts
// pseudo
if (
  target.status === StatusType.Substitute &&
  target.substituteHp !== undefined &&
  attacker.id !== target.id &&     // self-bypass (recoil/struggle/self-damage)
  !moveDef.sound                    // sound bypass
) {
  const absorbed = Math.min(damage, target.substituteHp);
  target.substituteHp -= absorbed;
  emit({ type: SubstituteDamaged, pokemonId: target.id, damage: absorbed, remaining: target.substituteHp });

  if (target.substituteHp <= 0) {
    target.substituteHp = undefined;
    target.status = StatusType.None;
    emit({ type: SubstituteBroken, pokemonId: target.id });
  }

  // Excess damage NOT carried (Gen 5+). Defender's HP unchanged.
  return { hpDealt: 0, subDealt: absorbed };
}
// else : damage normal sur target.currentHp
```

**Retour** : la fonction d'application doit signaler à l'appelant (drain handler, recoil handler) la quantité absorbée par sub vs HP réels — actuellement la dégât retourné inclut tout. Décision : `DamageDealt` event garde sémantique "dégâts infligés totaux" (compatibilité IA + UI). Nouveau champ `DamageDealt.absorbedBySubstitute?: number` (optionnel, 0 si sub inactif). Recoil handler + drain handler lisent depuis ce champ.

### 5. Drain heal vs sub (canon Gen 5+)

`handle-drain.ts` : heal attaquant = `floor(damageDealt × drainFraction)` où `damageDealt` = total (absorbé + HP réels). Pas de modification — drain heal continue de fonctionner sur sub. Aligne canon.

### 6. Recoil vs sub

`handle-recoil.ts` : recoil = `floor(damageDealt × recoilFraction)` (déjà migré `lastDamageDealt` plan 078). Sub absorbe → caster prend recoil quand même (canon, basé sur dégâts infligés totaux). Aucun changement.

### 7. Status block — `handle-status.ts`

Ajouter check avant application :

```ts
if (
  target.status === StatusType.Substitute &&
  attacker.id !== target.id &&
  !moveDef.sound
) {
  return {
    applied: false,
    events: [{ type: StatusBlocked, pokemonId: target.id, status: statusType, reason: ProtectionReason.Substitute }],
  };
}
```

Étendre `ProtectionReason` enum (plan 098) avec `Substitute: "substitute"`.

### 8. Stat change block — `handle-stat-change.ts`

Ajouter check avant application stage négative :

```ts
if (
  stage < 0 &&
  target.status === StatusType.Substitute &&
  attacker.id !== target.id &&
  !moveDef.sound
) {
  return {
    applied: false,
    events: [{ type: StatChangeBlocked, pokemonId: target.id, stat, stage, reason: ProtectionReason.Substitute }],
  };
}
```

Positives stages (self-buff Swords-Dance, Coil) bypass via `attacker.id === target.id`.

### 9. Sound moves — flag existant

`MoveFlags.sound` + `MoveFlags.bypasssub` **déjà existent** dans `packages/core/src/types/move-flags.ts`. Reference Showdown (`packages/data/reference/moves.json`) déjà taggue 32 moves sound (growl/screech/sing/snore/supersonic/roar/hyper-voice/bug-buzz/boomburst/etc). 5 moves implémentés roster ont leur flag propagé automatiquement : `sing`, `supersonic`, `growl`, `roar`, `screech`.

**Rien à ajouter côté data.** Consommer runtime :

```ts
function bypassesSubstitute(moveDef: MoveDefinition): boolean {
  return moveDef.flags?.sound === true || moveDef.flags?.bypasssub === true;
}
```

Utiliser dans damage routing + status block + stat change block. Tests vérifient flag lu correctement post-load (intégration sing-vs-sub, growl-vs-sub).

### 10. KO cleanup

`handleKo(pokemon)` : si `status === Substitute`, clear `substituteHp` + status normalement via `clearVolatileStatuses` existant. Vérifier : `substituteHp` field doit être nettoyé.

### 11. Weather / terrain / self bypass

Weather damage (`weather-tick-handler.ts`) : applique direct `pokemon.currentHp` — sub non consulté (canon). Aucun changement.

Terrain damage (`terrain-tick-handler.ts`) : idem direct HP.

Recoil/Confusion self-damage : déjà `attacker.id === target.id` → bypass auto.

Sandstorm BadlyPoisoned tick : applique sur HP direct (Poisoned status persiste — n'a pas pu être appliqué si sub actif au moment du poison, donc cas marginal).

### 12. Re-post bloqué

`handle-post-substitute.ts` check `caster.status === Substitute` → fail `MoveCancelled { reason: "substitute-already-active" }`. PP consommé.

### 13. Events

`packages/core/src/enums/battle-event-type.ts` ajouter :

```ts
SubstitutePosted: "substitute_posted",
SubstituteDamaged: "substitute_damaged",
SubstituteBroken: "substitute_broken",
SubstituteFailed: "substitute_failed",  // pour échec post (HP insuffisant ou déjà actif)
```

Champ `DamageDealt.absorbedBySubstitute?: number` (optionnel).

### 14. IA — scoreSelfMove pour PostSubstitute

`packages/core/src/ai/action-scorer.ts` : étendre `scoreSelfMove` pour `EffectKind.PostSubstitute` :

- `caster.currentHp / caster.maxHp ≤ 0.25` → score 0 (impossible)
- `caster.status === Substitute` → score 0 (déjà actif)
- Score base = 30
- Bonus si menace alentour : `enemyHasStatusMoveInRange` OR `enemyHasStatDecreaseMoveInRange` (helpers plan 098, range r5) → ×1.5
- Bonus early-game : `currentRound ≤ 3` → ×1.2 (sub plus utile tôt)
- Malus low-HP : si HP entre 25% et 40% → ×0.5 (risqué)

### 15. Renderer — overlay sprite dummy

`PokemonSprite.setSubstituteOverlay(active: boolean)` :
- `active=true` : swap texture courante → atlas `dummy` (animation Idle), masquer animations attaque (caster bloqué tant que sub ? non, caster bouge normalement — sub suit). Décision : **sprite remplacement complet** (caster invisible, dummy visible) pour clarté visuelle. Position = position caster.
- `active=false` : restore atlas Pokemon original.

`GameController` câblé sur events :
- `SubstitutePosted` → `setSubstituteOverlay(true)` + emit float "Sub!" jaune.
- `SubstituteDamaged` → animation flash + sub HP bar visuelle (mini barre sous HP caster, distincte, couleur vert→rouge proportional).
- `SubstituteBroken` → `setSubstituteOverlay(false)` + animation poof + emit float "Sub brisé!" rouge.
- `PokemonKo` (si sub actif) → `setSubstituteOverlay(false)` cleanup.
- `PokemonMoved` (si sub actif) → sub suit caster automatiquement (sprite suit position container Pokemon).

**InfoPanel badge** : `Substitut {hp}/{maxSubHp}` (status volatile label) quand sub actif.

**MoveTooltip** : tag substitute "⚙ Crée un clone à 25% PV. Bloque dégâts/statuts/baisses-stats ennemis. Sons l'ignorent."

### 16. i18n FR/EN

Nouvelles clés `packages/data/src/i18n/` :

| Clé | FR | EN |
|-----|-----|-----|
| `move.substitute.name` | Clone-toi | Substitute |
| `move.substitute.desc` | Crée un Clone à 25% PV. Bloque les dégâts, statuts et baisses de stats ennemis. Les attaques sonores l'ignorent. | Creates a Substitute at 25% HP. Blocks damage, status and stat decreases from foes. Sound moves bypass it. |
| `substitute.posted` | {pokemon} crée un Clone! | {pokemon} created a Substitute! |
| `substitute.damaged` | Le Clone de {pokemon} encaisse le coup! | {pokemon}'s Substitute took the hit! |
| `substitute.broken` | Le Clone de {pokemon} est brisé! | {pokemon}'s Substitute broke! |
| `substitute.failed.lowHp` | {pokemon} n'a pas assez de PV pour cloner! | {pokemon} doesn't have enough HP to create a Substitute! |
| `substitute.failed.active` | {pokemon} a déjà un Clone! | {pokemon} already has a Substitute! |
| `protection.reason.substitute` | Clone | Substitute |
| `infoPanel.volatile.substitute` | Clone {hp} PV | Substitute {hp} HP |
| `moveTooltip.tag.sound` | 🔊 Sonore (ignore Clone) | 🔊 Sound (bypasses Substitute) |

`BattleLogFormatter` : 4 nouveaux cas events Substitute*.

### 17. OP sets — substitute introduction

Ajouter `substitute` dans ~5-8 sets curés `packages/data/op-sets/op-sets.json` (revoir liste post-impl avec `data-miner`) :
- `mewtwo-calm-mind-sub` (variant existant)
- `alakazam-sub-buff` (Sub + Nasty Plot + Psychic + Focus Blast)
- `gengar-sub-disable` (sans Disable encore : Sub + Shadow Ball + Sludge Wave + Focus Blast)
- `jynx-sub-nasty` (Sub + Nasty Plot + Ice Beam + Psychic)
- `vaporeon-sub-toxic` (variant tank)
- `zapdos-sub-roost`
- `articuno-sub-mist` (combo plan 098)

## Plan d'exécution

### Étape 1 — Core types (tests first)
- `StatusType.Substitute` + `EffectKind.PostSubstitute` + 4 nouveaux `BattleEventType`.
- `PokemonInstance.substituteHp?: number` (optional).
- `DamageDealt.absorbedBySubstitute?: number`.
- `ProtectionReason.Substitute`.
- Test `status-type.test.ts` + `effect-kind.test.ts` étendus.

### Étape 2 — Handler PostSubstitute
- `packages/core/src/battle/handlers/handle-post-substitute.ts` + index registration.
- Tests `handle-post-substitute.test.ts` : HP suffisant → posté, HP insuffisant → failed, déjà actif → failed, PP consommé dans les 3 cas.

### Étape 3 — Damage routing
- Modifier point d'application HP target (chercher fonction qui décrémente `currentHp` post-damage calc).
- Ajouter check sub + reroute. Émit SubstituteDamaged/Broken.
- Compatibility avec multi-hit : chaque hit consulte sub state à chaque itération.
- Tests intégration `substitute-damage.test.ts` : single hit absorb, single hit break, multi-hit absorb+break mid-séquence, excess damage non carryover, self-damage bypass.

### Étape 4 — Status + Stat block
- `handle-status.ts` : check sub avant apply, emit StatusBlocked reason=Substitute.
- `handle-stat-change.ts` : check sub avant apply (stage négatif uniquement), emit StatChangeBlocked reason=Substitute.
- Tests intégration `substitute-status-block.test.ts` + `substitute-statchange-block.test.ts`.

### Étape 5 — Sound / bypasssub consommation
- Helper `bypassesSubstitute(moveDef)` lit `flags.sound || flags.bypasssub`.
- Câbler dans damage routing + status block + stat change block.
- Vérifier propagation flags reference → MoveDefinition runtime (déjà OK normalement).
- Tests `substitute-sound-bypass.test.ts` : Growl baisse Atk caster derrière sub, Sing endort caster derrière sub.

### Étape 6 — Drain / Recoil / Weather compatibility
- Vérifier drain heal (handle-drain) lit `damageDealt` total → fonctionne sans modif.
- Vérifier recoil idem.
- Vérifier weather/terrain damage bypass sub (test régression).
- Tests `substitute-bypass-categories.test.ts`.

### Étape 7 — KO cleanup + serialization
- `handleKo` : clear `substituteHp` field.
- `clearVolatileStatuses` : déjà clear status = StatusType.None, ajouter clear field.
- Test : KO caster sub actif → field nettoyé.

### Étape 8 — Data
- Move `substitute` dans `packages/data/src/moves/...`.
- i18n FR/EN (17 clés).
- Vérifier learnset Gen 1 (TM canon — presque tous roster).

### Étape 9 — IA scoreSelfMove
- Étendre `action-scorer.ts` cas PostSubstitute.
- Tests `action-scorer-substitute.test.ts` : low HP score 0, déjà sub score 0, menace alentour score haut, early-game bonus.

### Étape 10 — Renderer overlay
- `PokemonSprite.setSubstituteOverlay(active)` : swap atlas → dummy idle.
- Sub HP bar mini sous HP caster.
- `GameController` câblé events Substitute*.
- InfoPanel badge `Substitut {hp} PV`.
- MoveTooltip tag sound bypass.
- Test smoke Playwright (post → damage → break → restore).

### Étape 11 — OP sets curation
- 5-8 sets curés via `data-miner` (analyser meta Gen 1 Smogon RBY).
- Réexécuter `pnpm op-sets:analyze`.

### Étape 12 — Gate CI + smoke playtest
- `/ci-gate full` : unit + integration + build + lint + typecheck.
- Smoke manuel : sandbox Mewtwo Substitute vs Alakazam Psychic — vérifier visuel overlay, status block (Toxic), stat block (Growl), break sur Focus Blast.

## Critères d'acceptation

- [ ] Substitute pose : coût 25% maxHp exact, sub HP = floor(maxHp/4), status volatile actif.
- [ ] Re-post bloqué quand sub actif → `SubstituteFailed`.
- [ ] Pose bloquée si HP courant ≤ 25% → `SubstituteFailed`.
- [ ] PP consommé dans les 3 cas (success, fail-active, fail-lowHp).
- [ ] Dégâts ennemis absorbés par sub jusqu'à break. Excess non carry-over Gen 5+.
- [ ] Status majeur + Confusion ennemi bloqué par sub. `StatusBlocked reason=Substitute`.
- [ ] Stat change négative ennemi bloqué. Positive self caster passe (Swords-Dance).
- [ ] Sound moves bypassent (dégâts + statuts + stats).
- [ ] Drain heal calculé sur dégâts totaux (incluant absorbé).
- [ ] Recoil calculé sur dégâts totaux.
- [ ] Weather/terrain damage hit caster direct (sub bypass).
- [ ] Self-damage (Struggle, recoil, confusion) bypass sub.
- [ ] Multi-hit moves break sub en milieu de séquence stoppent hits restants sur target (mais sub était absorbant — décision : si sub break mid-séquence, hits restants vont sur HP réel ? Canon : oui, hits restants frappent HP direct).
- [ ] KO caster cleanup `substituteHp` field.
- [ ] Sprite dummy overlay actif quand sub actif. Bouger caster = sub follow.
- [ ] InfoPanel badge `Substitut {hp} PV`.
- [ ] IA score adéquat (low-HP → 0, menace → high).
- [ ] OP sets `substitute` introduits ~5-8 mons.
- [ ] Gate CI verte.

## Risques

- **Régression damage path** : sub intercepte avant écriture HP. Risque casser flow recoil/drain. Mitigation : tests régression handle-drain + handle-recoil + recoil intégration tests existants doivent rester verts.
- **Sprite overlay multi-direction** : dummy a 4 ou 8 directions ? Vérifier atlas. Si moins de directions que Pokemon, fallback direction frontale.
- **Sound flag propagation** : si reference → MoveDefinition runtime perd les flags, sound bypass cassé. Vérifier `load-data` charge bien `flags` dans `MoveDefinition`. Test contract dédié.
- **Multi-hit break mid-séquence** : si Twineedle hit 1 break sub, hit 2 va sur HP — comportement canon, mais s'assurer que `applyDamage` re-check sub state à chaque hit. Test dédié.
- **Confusion self-damage bypass** : confusion self-damage emit Damage avec attacker=target → `attacker.id === target.id` → bypass auto. OK.
- **IA over/under-scoring** : balance via heuristique simple, ajustable post-playtest.

## Liens

- Plan 098 — TeamAura + ProtectionReason + StatusBlocked / StatChangeBlocked events.
- Plan 094 — Charge moves + Flinch (référence pattern volatile state).
- Plan 095 — Mobile aura + indicator system (référence renderer overlay).
- Bulbapedia — [Substitute (move)](https://bulbapedia.bulbagarden.net/wiki/Substitute_(move)).
- Showdown — `sim/data/moves.ts` substitute + sub damage routing.
