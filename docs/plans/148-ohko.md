# Plan 148 — Famille OHKO (K.O. en un coup)

**Statut : done**
**Créé : 2026-07-04**
**Périmètre : 460 → 464 moves (4 moves). Nouvelle mécanique Phase 4.**

## Objectif

Implémenter les 4 moves canon « One-Hit-KO » de la Gen 1, réinterprétés positionnellement (comme
les familles Phazing / Field global / Sacrifice) :

| Move (FR) | ID | Type | Cat. | Forme tactique | Learners Gen 1 |
|-----------|-----|------|------|----------------|----------------|
| **Abîme** | `fissure` | Sol | Phys | **Ligne droite 3** | Taupiqueur, Triopikeur, Ronflex |
| **Glaciation** | `sheer-cold` | Glace | Spé | **Cône 1-2** | Lamantine, Lokhlass, Artikodin |
| **Guillotine** | `guillotine` | Normal | Phys | **Single 1-1** (contact) | Krabby, Krabboss, Scarabrute |
| **Empal'Korne** | `horn-drill` | Normal | Phys | **Ligne 2** (contact, transperçante) | Rhinocorne, Rhinoféros, Poissirène, Poissoroy |

**Mécanique** : si le move touche (jet de précision dédié), la cible tombe K.O. sur le coup (dégâts
= PV max). Tous les learners sont en roster → **aucun move hors-pool**.

## Décisions de design (validées humain 2026-07-04)

1. **Formes** — Abîme = Ligne 3 ; Glaciation = Cône 1-2 ; Guillotine = Single 1-1 ; Empal'Korne =
   Ligne 2. Les deux moves contact (Guillotine/Empal'Korne) portent le flag `contact`. Décision #607.
   **Glaciation = Cône 1-2 (4 tuiles) et non 1-3 (9 tuiles)** : à coût CT égal (900, palier max), un
   Cône 1-3 roulerait jusqu'à 9 jets → espérance ~2.7 KO/cast, un ordre de grandeur au-dessus des 3
   autres membres. Cône 1-2 ramène l'espérance à ~1.2 KO, aligné sur Abîme Ligne 3 (~0.9). Décision #607.
2. **Multi-cible = jet 30% indépendant par cible** (Ligne/Cône touchent plusieurs Pokemon) : chaque
   cible touchée subit son propre jet de précision → un cast peut K.O. 0, 1 ou plusieurs Pokemon.
   Puissant mais aléatoire (espérance ~0.3 KO/cible). Décision #608.
3. **Précision (niveau fixe 50)** — la formule canon `(niveau lanceur − niveau cible + base)` se
   réduit à **base plat** puisque tous les Pokemon sont niveau 50 (`Δniveau = 0`), et la clause
   « échoue si la cible est de niveau supérieur » ne se déclenche jamais. Donc :
   - Abîme / Guillotine / Empal'Korne : **30 %** plat.
   - Glaciation : **30 % si le lanceur est de type Glace, 20 % sinon** (`ohkoIceAccuracyRule`).
   - **Ignore totalement** les crans de Précision/Esquive, les talents/objets de précision, la
     Gravité, la météo. Verrouillage (`LockedOn`) garantit le coup (consommé). Décision #609.
4. **Contres défensifs = canon complet** (tout gratuit car routé via `handle-damage`) :
   - **Fermeté** (`sturdy`) → **immunité totale** (message dédié), bypassée par **Brise Moule**.
   - **Baie Ceinture** (Focus Sash) + **Ténacité** (Endure) → **survie à 1 PV**.
   - **Protection / Détection** → bloque (les 4 moves ont le flag `protect`).
   - **Clone** (Substitute) → absorbe le coup (le Clone casse, la cible survit).
   - **Immunité de type** : Spectre immunisé vs Guillotine/Empal'Korne (Normal) ; Vol/Lévitation
     immunisé vs Abîme (Sol) ; **type Glace immunisé vs Glaciation** (règle spéciale, hors table de
     types car Glace vs Glace = ×0.5). Décision #610.

## Architecture — routage via `handle-damage` (DRY)

Point clé : `checkDefense` (Protection/Ténacité) et les gardes Fermeté/Baie Ceinture/Clone vivent
**uniquement dans `handle-damage.ts`**. Un handler custom (façon `handle-final-gambit`) les
ignorerait. Donc l'OHKO **réutilise le chemin de dégâts standard** avec une injection de dégâts fixes,
et le moteur pré-filtre les immunités spéciales + gère la précision dédiée.

### 1. Flags sur `MoveDefinition` (`packages/core/src/types/move-definition.ts`)

```ts
/** OHKO (K.O. en un coup) : précision plate dédiée (ignore crans/talents/objets), dégâts = PV max. */
isOhko?: boolean;
/** Glaciation : précision 30 % si le lanceur est de type Glace, 20 % sinon. */
ohkoIceAccuracyRule?: boolean;
/** Glaciation : le type Glace est immunisé (hors table de types). */
ohkoIceImmunity?: boolean;
```

(Pas de nouvel `EffectKind` : l'OHKO passe par `EffectKind.Damage` — c'est le flag `isOhko` qui
détourne le calcul de dégâts. `power` = 0 dans l'override, non lu.)

### 2. Nouveau module `packages/core/src/battle/ohko.ts`

Fonctions pures, testées unitairement :
- `ohkoAccuracy(move, attackerTypes): number` → `20` si `move.ohkoIceAccuracyRule && !attackerTypes.includes(Ice)`, sinon `30`.
- `ohkoImmunityReason(move, attacker, target, ctx): OhkoImmunity | null` — renvoie :
  - `"type"` si `getTypeEffectiveness(move.type, targetTypes, chart, override, scrappy, grounded) === 0` ;
  - `"ice"` si `move.ohkoIceImmunity && targetTypes.includes(Ice)` ;
  - `"sturdy"` si `resolveDefensiveAbility(registry, target, attacker)?.id === "sturdy"` (déjà Brise-Moule-aware) ;
  - `null` sinon.
- Type `OhkoImmunity = "type" | "ice" | "sturdy"`.

### 2bis. Extraire `consumeLockedOn` (`accuracy-check.ts`)

Le court-circuit Verrouillage (`LockedOn`) est actuellement inline en tête de `checkAccuracy` (lignes
30-34). La branche OHTO du moteur **saute** `checkAccuracy` → il faut extraire ce comportement pour le
réutiliser **sans double consommation** :

```ts
// accuracy-check.ts (exporté)
export function consumeLockedOn(pokemon: PokemonInstance): boolean {
  const i = pokemon.volatileStatuses.findIndex((v) => v.type === StatusType.LockedOn);
  if (i !== -1) { pokemon.volatileStatuses.splice(i, 1); return true; }
  return false;
}
```

`checkAccuracy` réutilise ce helper en tête (au lieu du bloc inline). La branche OHKO l'appelle une
fois. ⚠️ **Garantie « consommé une seule fois »** : l'OHKO ne passe JAMAIS par `checkAccuracy` (le
`continue` saute le bloc standard), donc pas de double décrément. À couvrir par un test dédié.

### 3. Branche OHKO dans `BattleEngine` (boucle de résolution des cibles, ~ligne 1495-1539)

Avant l'appel à `checkAccuracy`, court-circuit pour `effectiveMove.isOhko` (dans la boucle `for target`) :

```ts
if (effectiveMove.isOhko) {
  // Immunités spéciales pré-checkées AVANT la précision (report "sans effet" / Fermeté, pas "raté").
  const immunity = ohkoImmunityReason(effectiveMove, pokemon, target, {
    typeChart: this.typeChart,
    targetTypes: this.effectiveTypesOf(target),
    attackerTypes: this.effectiveTypesOf(pokemon),
    abilityRegistry: this.abilityRegistry ?? undefined,
    groundedByGravity: isInFieldGlobalZone(this.state, target.position, FieldGlobalKind.Gravity),
  });
  if (immunity === "sturdy") { emit AbilityActivated(sturdy) ; continue; }
  if (immunity) { emit DamageDealt(amount 0, effectiveness 0) ; continue; } // "sans effet"

  // Verrouillage garantit le coup (consommé), sinon jet plat dédié.
  const locked = consumeLockedOn(pokemon); // mirror checkAccuracy
  const acc = ohkoAccuracy(effectiveMove, this.effectiveTypesOf(pokemon));
  if (forceHit || locked || this.random() * 100 < acc) {
    targets.push(target);
  } else {
    emit MoveMissed;
  }
  continue; // saute checkAccuracy standard
}
```

Le `continue` remplace le bloc `checkAccuracy` standard pour ce target. Le check
`semiInvulnerableState` (déjà au-dessus dans la boucle) reste actif.

### 4. Injection dégâts fixes dans `handle-damage.ts` (~ligne 248)

Après `calculateDamageWithCrit`, override pour l'OHKO :

```ts
let damage = baseDamage;
if (context.move.isOhko) {
  // Dégâts fixes = PV max. L'immunité de type/Glace/Fermeté est DÉJÀ filtrée en amont (moteur) → ce
  // chemin n'est atteint que pour une cible non immunisée. Le `=== 0 ? 0 : maxHp` est un FAILSAFE
  // défensif (double sécurité si un futur path atteint handle-damage sans pré-check), pas la voie
  // nominale. Le reste (Protection/Ténacité/Baie Ceinture/Clone) est géré par la suite de handle-damage.
  const ohkoEffectiveness = getTypeEffectiveness(context.move.type, defenderTypes, context.typeChart,
    context.move.typeEffectivenessOverride, scrappyGhostBypass,
    fieldGlobalContext.defenderGroundedByGravity === true);
  damage = ohkoEffectiveness === 0 ? 0 : target.maxHp;
}
```

⚠️ Nécessite de hisser le calcul de `scrappyGhostBypass` (actuellement ligne ~305) **avant** ce point
(ou le recalculer). Petit reorder local, sans changement de comportement pour les moves non-OHKO.

**Note Fermeté** : la survie-à-1 de Fermeté dans `handle-damage` (ligne 288) ne se déclenchera jamais
pour un OHKO car la Fermeté est déjà pré-filtrée en immunité totale par le moteur. Baie Ceinture
(ligne 330) et Ténacité (`endureAtOne`, ligne 278) restent actives → survie à 1 PV. ✓

### 5. Event + journal

- Nouveau `BattleEventType.OneHitKo` (`{ type, targetId }`), émis dans `handle-damage` quand
  `context.move.isOhko && target.currentHp <= 0`. **Ordre strict** : `DamageDealt` → `OneHitKo` →
  (le `PokemonKo` est émis par le flux KO en aval). Le journal affiche « C'est un K.O. direct ! »
  avant l'anim de KO.
- `BattleLogFormatter` : ligne FR « C'est un K.O. direct ! » / EN « It's a one-hit KO! ».
- Immunité Fermeté : réutilise le formatage `AbilityActivated` existant (message Fermeté).
- Immunité type/Glace : le `DamageDealt amount 0 effectiveness 0` existant produit déjà « Ça
  n'affecte pas … » — vérifier que le formatter le rend bien pour ce cas.

### 6. Data — overrides `packages/data/src/overrides/tactical.ts`

```ts
"fissure": {
  targeting: { kind: TargetingKind.Line, length: 3 },
  effects: [{ kind: EffectKind.Damage }],
  isOhko: true,
},
"guillotine": {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }],
  isOhko: true,
},
"horn-drill": {
  targeting: { kind: TargetingKind.Line, length: 2 },
  effects: [{ kind: EffectKind.Damage }],
  isOhko: true,
},
"sheer-cold": {
  targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
  effects: [{ kind: EffectKind.Damage }],
  isOhko: true,
  ohkoIceAccuracyRule: true,
  ohkoIceImmunity: true,
},
```

> **Note `ohkoIceAccuracyRule` (20 %)** : les 3 learners natifs de Glaciation (Lamantine, Lokhlass,
> Artikodin) sont tous de type Glace → ils obtiennent toujours 30 %. La branche 20 % n'est atteinte
> que si un non-Glace porte Glaciation via la famille **move-copy** (Métronome / Copie / Gribouille).
> C'est du forward-compatible volontaire, pas du code mort.

Flags `contact` (Guillotine/Empal'Korne) et `protect` (les 4) viennent déjà de `reference/moves.json`
via `MoveFlags` (`flags.protect: true`) → **pas** de champ sur `MoveDefinition`, rien à ajouter dans
l'override. Ne PAS poser `bypassProtect` → Protection bloque bien l'OHKO.

### 7. Tooltip / preview (renderer)

- `MoveTooltip` : tag `☠ K.O. en un coup (30 %)` (20 % pour Glaciation non-Glace — ou tag générique
  « 30 %/20 % » ; à trancher à l'impl, tag simple « ☠ K.O. direct » suffit).
- Preview de ciblage : les patterns Ligne/Cône sont déjà rendus (couleur d'intention attaque rouge).
  Pas de nouveau highlight. L'OHKO ne nécessite pas d'anim dédiée (le KO existant joue).
- i18n FR/EN : clés `battleLog.oneHitKo`, `moveTooltip.tag.ohko`.

### 8. IA — garde-fou minimal (heuristiques fines reportées)

`action-scorer.ts` : un move `isOhko` scoré via le chemin dégâts standard vaut ~0 (power 0). Ajouter
un **garde-fou minimal** : score modéré = `expectedKoValue × 0.3` (jet), **bonus** contre une cible à
PV élevés / haute menace que les dégâts normaux ne K.O. pas, **malus** si la cible est déjà à bas PV
(gâchis — un move normal suffit) ou immunisée (Fermeté/type/Glace → score négatif, anti-contresens).
Ne PAS valoriser finement (report, comme les familles précédentes). **Reporté** : heuristiques IA
fines (même lot que type-manip / item-interaction / move-copy / stat-manip / phazing / pièges).

### 9. OP sets

data-miner : ajouter 2-3 OP sets exploitant l'OHKO comme finisher niche (ex : Lokhlass Glaciation,
Triopikeur Abîme + Fermeté-bypass, Rhinoféros Empal'Korne). À curer — l'OHKO reste un pari 30 %, pas
un pilier de set. 186 → ~188-189 sets.

## Tests

- **Unit** `ohko.ts` : `ohkoAccuracy` (30/20 selon type Glace), `ohkoImmunityReason` (type 0 / Glace /
  Fermeté / Brise Moule bypass / null).
- **Intégration** (`packages/core/src/battle/`, mocks `testing/`) :
  - OHKO touche (forceHit / random seedé) → cible à 0 PV, `OneHitKo` + `PokemonKo` émis.
  - Fermeté → immunité totale (cible intacte, `AbilityActivated`), Brise Moule → passe.
  - Baie Ceinture / Ténacité → survie à 1 PV.
  - Protection → bloqué.
  - Clone → absorbé (Clone cassé, cible vivante).
  - Immunité type : Spectre vs Guillotine (0), Vol vs Abîme (0), Glace vs Glaciation (0).
  - Glaciation : lanceur Glace = 30 %, non-Glace = 20 % (jet seedé aux bornes).
  - Multi-cible Ligne/Cône : jets indépendants (2 cibles, seed → 1 KO + 1 raté).
  - Verrouillage → coup garanti **et consommé une seule fois** (assert `LockedOn` absent après le
    cast ; ne repasse pas par `checkAccuracy`).
- **Garde-fou couverture** : `move-test-coverage` (plan 108) — 4 nouveaux moves doivent avoir un test.

## Reporté (non bloquant)

- **e2e Playwright** : piloter Abîme (Ligne) / Glaciation (Cône) / Fermeté-immunité / survie Baie
  Ceinture via l'UI + journal FR. À ajouter via `test-writer` + `docs/test-plan.md` §5.
- **Heuristiques IA fines** (cf. §8).
- **Tag précision variable** tooltip (30/20) si le tag simple ne suffit pas au retour humain.

## Séquençage

1. Core : flags `MoveDefinition` + module `ohko.ts` + extraction `consumeLockedOn` (§2bis) + tests unit.
2. Core : branche moteur `BattleEngine` (précision + immunités) + injection `handle-damage` + event
   `OneHitKo`.
3. Core : tests intégration (les 8+ cas ci-dessus).
4. Data : 4 overrides `tactical.ts`.
5. Renderer : tag tooltip + formatter journal + i18n.
6. IA : garde-fou minimal `action-scorer.ts`.
7. Data-miner : OP sets.
8. `implementations.md` + `docs/decisions.md` (#607-610) + STATUS.md + next.md.
9. Gate CI + human-testing.
```
