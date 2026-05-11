# Plan 078 — Roster Batch D (16 Pokemon) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Ajouter 16 Pokemon Gen 1 au roster jouable. Focus : types sous-représentés (Poison×3, Plante×2), rôles setup/tank absents (Chansey, Mr. Mime, Clefable), et premier représentant **type Bug** (Parasect). 8 nouveaux moves, 2 nouvelles abilities.

**Roster après Batch D** : 51 (actuel) + 16 = **67 Pokemon jouables**.

**Batch E (~9 Pokemon) finalisera le roster Gen 1 non-légendaire** : butterfree, beedrill, pidgeot, raticate, fearow, golbat, venomoth, farfetch-d, seaking. Batch E nécessite `EffectKind.Drain` (leech-life, mega-drain) — planifier plan dédié ou inclure en Batch E.

---

## Note de sélection

Critères : (1) diversité tactique maximale avec (2) réutilisation maximale des moves/abilities existants. Sur 16 Pokemon, 10 n'ont aucun nouveau move.

Exclusions Batch D → reportées Batch E :
- **beedrill/butterfree** : type Bug, nécessitent twineedle + swarm (nouveauté)
- **pidgeot/fearow** : Vol Normal, groupés avec les autres Vol Batch E
- **golbat/venomoth** : repoussés avec les autres Insecte/Poison Batch E
- **seaking** : groupé avec les Vol en Batch E

---

## Pokemon — Batch D

| # | ID | Nom FR | Types | Ability | Statut ability |
|---|---|---|---|---|---|
| 024 | arbok | Arbok | Poison | intimidate | ✓ |
| 036 | clefable | Mélodelfe | Fée | magic-guard | ✓ |
| 047 | parasect | Parasect | Insecte/Plante | effect-spore | ✓ |
| 051 | dugtrio | Triopikeur | Sol | sand-veil | ✓ (stub) |
| 053 | persian | Persian | Normal | technician | ✓ |
| 071 | victreebel | Empiflor | Plante/Poison | chlorophyll | ✓ (stub) |
| 078 | rapidash | Galopa | Feu | flash-fire | ✓ |
| 085 | dodrio | Dodrio | Normal/Vol | early-bird | ✓ |
| 089 | muk | Grotadmorv | Poison | poison-touch | ★ |
| 095 | onix | Onix | Roche/Sol | sturdy | ✓ |
| 110 | weezing | Smogogo | Poison | levitate | ✓ |
| 113 | chansey | Leveinard | Normal | natural-cure | ✓ |
| 114 | tangela | Saquedeneu | Plante | chlorophyll | ✓ (stub) |
| 117 | seadra | Hypocéan | Eau | swift-swim | ✓ (stub) |
| 122 | mr-mime | M. Mime | Psy/Fée | filter | ★ |
| 128 | tauros | Tauros | Normal | intimidate | ✓ |

`✓` = ability existante · `★` = nouvelle ability

Sprites : tous ont "Faint abs." PMDCollab → fallback anim (identique Batches précédents).

---

## Movesets

### arbok — Arbok — Poison

**Rôle** : saboteur Poison. Intimidation à l'entrée réduit l'Attaque ennemie. Enroulement (+1 Atk/Déf/Préc) transforme Arbok en bruiser setup. Lovoquin immobilise à distance.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| poison-fang | Poison | Phys | 50 | 100 | 15 | mêlée | Poison fort 50% ★ |
| crunch | Ténèbres | Phys | 80 | 100 | 15 | mêlée | −1 Déf 20%, couverture Psy/Spectre |
| coil | Poison | Statut | — | — | 20 | self | +1 Atk, +1 Déf, +1 Préc ★ |
| glare | Normal | Statut | — | 100 | 30 | single r1–3 | Para 100%, type Normal ★ |

Nouveaux moves : `poison-fang`, `coil`, `glare`.

---

### clefable — Mélodelfe — Fée

**Rôle** : setup tank magique. Magic Guard immunise tout dégât indirect (brûlure, poison, vampigraine, recul). Pouvoir Cosmique double-stack Déf/DéfSpé. Miniminus + Récupération = survivant ultime.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| moonblast | Fée | Spé | 95 | 100 | 15 | single r1–4 | STAB, −1 AtqSpé 30% |
| cosmic-power | Psy | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé ★ |
| minimize | Normal | Statut | — | — | 10 | self | +2 Esquive |
| recover | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |

Nouveau move : `cosmic-power`.

---

### parasect — Parasect — Insecte/Plante

**Rôle** : premier **type Bug** du roster. Contrôleur sommeil absolu — Spore 100% en mêlée. Effect Spore punit chaque attaquant au contact. Lent (25 Vit) mais durable avec types résistances Plante.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| spore | Plante | Statut | — | 100 | 15 | single r1 | Sommeil 100%, mêlée ★ |
| razor-leaf | Plante | Phys | 55 | 95 | 25 | slash | STAB, critique élevé |
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | Couverture Fée/Plante |
| growth | Plante | Statut | — | — | 20 | self | +1 Atk, +1 AtqSpé |

Nouveau move : `spore`.

---

### dugtrio — Triopikeur — Sol

**Rôle** : assassin Sol ultra-rapide (120 Vit). Séisme + Amplitude frappent en zone. Éboulement couvre le type Vol. Hit-and-run via sa Vitesse extrême.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | STAB, friendly fire |
| slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| rock-slide | Roche | Phys | 75 | 90 | 10 | cône r2 | Couverture Vol |
| magnitude | Sol | Phys | var | 100 | 30 | zone r2 | STAB, puissance variable |

Aucun nouveau move.

---

### persian — Persian — Normal

**Rôle** : speedster physique (115 Vit). Technicien ×1.5 sur Combo-Griffe (18 base → 27 effectif, 2–5 fois). Crochet haute critique. Machination setup AtqSpé surprise.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| fury-swipes | Normal | Phys | 18 | 80 | 15 | mêlée | Technicien ×1.5, 2–5 hits |
| crunch | Ténèbres | Phys | 80 | 100 | 15 | mêlée | −1 Déf 20% |
| nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé (setup surprenant) |

Aucun nouveau move.

---

### victreebel — Empiflor — Plante/Poison

**Rôle** : attaquant offensif Plante/Poison. Lame Feuille haute critique différencie de Florizarre (Tempête) et Rafflesia (zone/spores). Poudre Dodo impose la pression de sommeil en zone.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| leaf-blade | Plante | Phys | 90 | 100 | 15 | slash | STAB, critique élevé ★ |
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB Poison |
| sleep-powder | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil zone |
| energy-ball | Plante | Spé | 90 | 100 | 10 | single r1–4 | STAB ranged |

Nouveau move : `leaf-blade`.

---

### rapidash — Galopa — Feu

**Rôle** : cavalier de feu ultra-rapide (105 Vit). Hâte +2 Vit → CT explosif. Flash Fire annule le Feu adverse et renforce les propres attaques Feu. Hit-and-run avec Tunnel de Flammes.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| flare-blitz | Feu | Phys | 120 | 100 | 15 | dash r3 | STAB, Brûl 10%, recul 1/3 |
| agility | Psy | Statut | — | — | 30 | self | +2 Vit |
| fire-blast | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | STAB nuke |
| iron-tail | Acier | Phys | 100 | 75 | 15 | mêlée | Couverture Roche, −1 Déf 30% |

Aucun nouveau move.

---

### dodrio — Dodrio — Normal/Vol

**Rôle** : attaquant Vol physique explosif (110 Atk, 110 Vit). Picpic Vol STAB. Early Bird se réveille vite — immunité effective aux contrôles Sommeil adverses.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| drill-peck | Vol | Phys | 80 | 100 | 20 | slash | STAB ★ |
| quick-attack | Normal | Phys | 40 | 100 | 30 | dash r2 | Priorité +1 |
| body-slam | Normal | Phys | 85 | 100 | 15 | mêlée | Para 30% |
| swords-dance | Normal | Statut | — | — | 20 | self | +2 Atk |

Nouveau move : `drill-peck`.

---

### muk — Grotadmorv — Poison

**Rôle** : tank Poison offensif (105 HP, 75 Déf, 100 DéfSpé). Grincement −2 Déf cible ouvre des OHKO. Armure Acide rend le flanc physique solide. Poison Touch spread le poison au contact.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB, Poison 30% |
| screech | Normal | Statut | — | 85 | 40 | single r1–3 | −2 Déf cible — pression offensive |
| acid-armor | Poison | Statut | — | — | 20 | self | +2 Déf |
| fire-blast | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | Couverture Acier/Glace |

Aucun nouveau move. (`screech` déjà implémenté plan 077)

---

### onix — Onix — Roche/Sol

**Rôle** : mur physique géant (160 Déf). Solidité garantit 1 PV minimum. Éboulement + Séisme = couverture double STAB. Ligotage immobilise un ennemi adjacent et drain/tour.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| rock-slide | Roche | Phys | 75 | 90 | 10 | cône r2 | STAB |
| earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | STAB, friendly fire |
| iron-tail | Acier | Phys | 100 | 75 | 15 | mêlée | Couverture |
| wrap | Normal | Phys | 15 | 90 | 20 | mêlée | Piégé + drain/tour |

Aucun nouveau move. (`wrap` = Ligotage déjà implémenté)

---

### weezing — Smogogo — Poison

**Rôle** : nuage toxique défensif. Lévitation (immunité Sol) + double statut adverse (Poison ou Brûlure). Zéro nouveau move requis — assemblé 100% depuis le pool existant.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB, Poison 30% |
| will-o-wisp | Feu | Statut | — | 85 | 15 | single r1–3 | Brûlure 100% |
| thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | Couverture Eau/Vol |
| fire-blast | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | Couverture Acier |

Aucun nouveau move.

---

### chansey — Leveinard — Normal

**Rôle** : tank HP absolu (250 base HP). Soin Naturel guérit en fin de tour. Prise de Judo inflige dégâts fixes (= niveau, ignorant les stats adverses). Cage Éclair contrôle à distance.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| seismic-toss | Combat | Phys | var | 100 | 20 | mêlée | Dégâts = niveau, ignore stats |
| recover | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Para 100% |
| double-edge | Normal | Phys | 120 | 100 | 15 | mêlée | STAB, recul 1/3 HP |

Aucun nouveau move.

---

### tangela — Saquedeneu — Plante

**Rôle** : lieur végétal. Ligotage immobilise + drain/tour (identité unique "enrouleur"). Boule Énergie attaque à distance. Poudre Dodo zone contrôle. Rôle distinct de Victreebel (attaquant slash/blast) et Florizarre (bruiser zone).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| energy-ball | Plante | Spé | 90 | 100 | 10 | single r1–4 | STAB ranged |
| wrap | Normal | Phys | 15 | 90 | 20 | mêlée | Piégé + drain/tour — identité lieur ★★ |
| sleep-powder | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil zone |
| growth | Plante | Statut | — | — | 20 | self | +1 Atk, +1 AtqSpé |

Aucun nouveau move. (`wrap` = Ligotage existant)

---

### seadra — Hypocéan — Eau

**Rôle** : sniper Eau/Dragon setup. Danse Dragon +1 Atk/Vit → combo Cascade. Swift Swim stub Phase 4 (météo Phase 9). Entièrement assemblé depuis moves existants.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| hydro-pump | Eau | Spé | 110 | 80 | 5 | ligne r4 | STAB nuke |
| dragon-dance | Dragon | Statut | — | — | 20 | self | +1 Atk, +1 Vit |
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | Couverture Dragon |
| smokescreen | Normal | Statut | — | 100 | 20 | zone r1 | −1 Préc zone |

Aucun nouveau move.

---

### mr-mime — M. Mime — Psy/Fée

**Rôle** : mur Psy/Fée. Filtre réduit les dégâts super-efficaces de 25%. Barrière +2 Déf → mur physique. Zen Absolu setup offensif avant Psyko.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| psychic | Psy | Spé | 90 | 100 | 10 | single r4 | STAB, −1 DéfSpé 10% |
| barrier | Psy | Statut | — | — | 20 | self | +2 Déf ★ |
| calm-mind | Psy | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé |
| thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Contrôle paralysie |

Nouveau move : `barrier`.

---

### tauros — Tauros — Normal

**Rôle** : bruiser Normal pur (100 Atk, 110 Vit). Intimidation à l'entrée affaiblit les ennemis proches. Damoclès + Plaquage Normal STAB. Séisme + Queue de Fer = couverture complète.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| double-edge | Normal | Phys | 120 | 100 | 15 | mêlée | STAB, recul 1/3 |
| body-slam | Normal | Phys | 85 | 100 | 15 | mêlée | STAB, Para 30% |
| earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | Couverture Acier/Feu |
| iron-tail | Acier | Phys | 100 | 75 | 15 | mêlée | Couverture Roche, −1 Déf 30% |

Aucun nouveau move.

---

## Nouveaux moves (8)

| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effets |
|---|---|---|---|---|---|---|---|---|
| poison-fang | Crocs Venin | Poison | Phys | 50 | 100 | 15 | `mêlée` | Poison fort 50% (BadlyPoisoned) |
| coil | Enroulement | Poison | Statut | — | — | 20 | `self` | +1 Atk, +1 Déf, +1 Préc |
| glare | Regard Médusant | Normal | Statut | — | 100 | 30 | `single r1–3` | Para 100% |
| cosmic-power | Pouvoir Cosmique | Psy | Statut | — | — | 20 | `self` | +1 Déf, +1 DéfSpé |
| spore | Spore | Plante | Statut | — | 100 | 15 | `single r1` | Sommeil 100% (mêlée uniquement) |
| leaf-blade | Lame Feuille | Plante | Phys | 90 | 100 | 15 | `slash` | Critique élevé (`critRatio: 1`) |
| drill-peck | Picpic | Vol | Phys | 80 | 100 | 20 | `slash` | — |
| barrier | Barrière | Psy | Statut | — | — | 20 | `self` | +2 Déf |

---

## Nouvelles abilities (2)

| ID | Nom FR | Description mécanique | Hook(s) |
|---|---|---|---|
| poison-touch | Contact Poison | 30% chance d'empoisonner l'ennemi quand Muk utilise une attaque de contact | `onAfterDamageDealt` : si `move.flags.contact`, `random() < 0.30` → `Poisoned` sur cible |
| filter | Filtre | Réduit de 25% les dégâts reçus super-efficaces | `onDamageModify` : si `effectiveness > 1.0` → `damage *= 0.75` |

### poison-touch — détails implémentation

```ts
const poisonTouch: AbilityHandler = {
  id: "poison-touch",
  onAfterDamageDealt: (context) => {
    if (!context.move.flags?.contact) return [];
    if (context.target.currentHp <= 0) return [];
    if (hasMajorStatus(context.target)) return [];
    if (context.random() >= 0.30) return [];
    return applyStatus(context.target, StatusType.Poisoned, context.state);
  },
};
```

### filter — détails implémentation

Hook `onDamageModify` dans `damage-calculator.ts` — appelé avant arrondi final.

```ts
const filter: AbilityHandler = {
  id: "filter",
  onDamageModify: (context) => {
    if (context.effectiveness <= 1.0) return context.damage;
    return Math.floor(context.damage * 0.75);
  },
};
```

**Vérifier** : `onDamageModify` existe déjà (utilisé par `multiscale`, `thick-fat`) — filter réutilise le même hook.

---

## Moves complexes — décisions d'implémentation

### coil — +1 Précision (accuracy stage)

`StatName.Accuracy` existe déjà dans le système. Le `handle-stat-change.ts` supporte déjà les modifications d'accuracy (`kinesis`, `sand-attack` l'utilisent). Coil utilise 3 effets `StatChange` indépendants :

```ts
"coil": {
  targeting: { kind: TargetingKind.Self },
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
    { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
    { kind: EffectKind.StatChange, stat: StatName.Accuracy, stages: 1, target: EffectTarget.Self },
  ],
},
```

### spore — sommeil à 100% en mêlée

Spore = single r1 (mêlée) + accuracy 100% + Sommeil. Mécanique identique à `hypnosis` mais portée réduite (r1 vs r3) et accuracy maximale. Pas de nouveau EffectKind.

```ts
"spore": {
  targeting: { kind: TargetingKind.Single, minRange: 1, maxRange: 1 },
  effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, accuracy: 1.0 }],
},
```

### glare — paralysie Normal type

Glare = Thunder Wave mais type Normal (contourne l'immunité Électrique). Mécanique identique à `thunder-wave`. Pattern `single r1–3` avec accuracy 100%.

### poison-fang — BadlyPoisoned 50%

```ts
"poison-fang": {
  targeting: { kind: TargetingKind.Melee },
  effects: [
    { kind: EffectKind.Damage },
    { kind: EffectKind.Status, status: StatusType.BadlyPoisoned, chance: 0.50 },
  ],
},
```

### barrier vs iron-defense

Barrière = +2 Déf, identique à `iron-defense` mécaniquement. Type Psy au lieu d'Acier — différence type uniquement (pas de nouvelle mécanique). Réutilise le pattern StatChange exact.

---

## Nouvelles mécaniques core

### Aucune nouvelle mécanique core

Tous les moves s'appuient sur EffectKind existants. Tous les hooks abilities existent déjà (`onDamageModify`, `onAfterDamageDealt`).

**Vérifier avant implémentation** :
1. `onDamageModify` accepte un contexte `{ effectiveness, damage }` — nécessaire pour `filter`.
2. `handle-stat-change.ts` accepte `StatName.Accuracy` avec `target: EffectTarget.Self` (pour `coil`).

---

## Étapes d'implémentation

### Étape 0 — Vérifications pré-implémentation

Avant de coder, confirmer que ces moves sont bien dans `tactical.ts` (utilisés comme "existants" dans ce plan) :
`sludge-bomb`, `recover`, `earthquake`, `iron-tail`, `body-slam`, `double-edge`, `crunch`, `nasty-plot`, `wrap`, `will-o-wisp`, `thunderbolt`, `fire-blast`, `seismic-toss`, `thunder-wave`, `dragon-dance`, `hydro-pump`, `ice-beam`, `smokescreen`, `sleep-powder`, `energy-ball`, `growth`, `razor-leaf`, `minimize`, `acid-armor`, `moonblast`, `agility`, `flare-blitz`, `slash`, `fury-swipes`, `magnitude`, `rock-slide`, `quick-attack`, `swords-dance`, `calm-mind`.

```bash
grep -c "\"wrap\"" packages/data/src/overrides/tactical.ts  # doit être > 0
```

### Étape 1 — Nouvelles abilities

`packages/data/src/abilities/ability-definitions.ts` : ajouter `poison-touch` et `filter`.

- `poison-touch` → pattern `flame-body` (même hook, même chance 30%, statut différent)
- `filter` → pattern `thick-fat` (même hook `onDamageModify`, condition différente)

### Étape 2 — Nouveaux moves dans tactical.ts

`packages/data/src/overrides/tactical.ts` : ajouter les 8 entrées.

Moves triviaux (pattern existant) :
- `cosmic-power` → copie `stockpile` (double StatChange self)
- `barrier` → copie `iron-defense` (StatChange +2 Déf self, type différent)
- `drill-peck` → copie `wing-attack` (Vol Phys slash, puissance différente)
- `glare` → copie `thunder-wave` (Para 100%, pattern single r1–3)
- `leaf-blade` → copie `cross-chop` (Phys slash, crit élevé, type Plante)

Moves avec vérification :
- `coil` → 3 StatChange self (Atk/Déf/Accuracy), vérifier `Accuracy` stage fonctionne en self
- `spore` → Status Sommeil accuracy 1.0, range r1
- `poison-fang` → Damage + BadlyPoisoned 50%

### Étape 3 — Roster

`packages/data/src/roster/roster-poc.ts` : ajouter les 16 nouvelles entrées.

### Étape 4 — i18n

- `packages/data/src/i18n/pokemon-names.fr.json` : 16 noms FR
- `packages/data/src/i18n/pokemon-names.en.json` : 16 noms EN
- Vérifier moves manquants dans `moves.fr.json` et `moves.en.json`
- Ajouter locales renderer : `packages/renderer/src/i18n/fr.ts` + `en.ts`

### Étape 5 — Tests

**Règle** : 1 test minimum par nouveau move + par nouvelle ability non-triviale.

#### Tests moves

| Fichier | Test minimal |
|---|---|
| `poison-fang.test.ts` | Dégâts Poison + BadlyPoisoned 50% (mock random=0.3) |
| `coil.test.ts` | +1 Atk/Déf/Préc sur attaquant (pattern `bulk-up.test.ts`) |
| `glare.test.ts` | Paralysie 100% sur cible Normal (+ vérifier que Électrique résistant n'est PAS immunisé) |
| `cosmic-power.test.ts` | +1 Déf/DéfSpé sur attaquant |
| `spore.test.ts` | Sommeil 100% en mêlée (accuracy 1.0), raté si r2 (hors portée) |
| `leaf-blade.test.ts` | Dégâts Plante STAB, critique élevé (`critRatio: 1`) |
| `drill-peck.test.ts` | Dégâts Vol STAB, pattern slash |
| `barrier.test.ts` | +2 Déf sur attaquant |

#### Tests abilities (intégration)

| Ability | Test minimal |
|---|---|
| poison-touch | Muk contact → Poisoned 30% (mock random=0.1), non-contact → pas de poison |
| filter | Mr. Mime reçoit move SE → ×0.75, move normal → ×1.0 |

### Étape 6 — Sprites + Gate CI + doc

```bash
pnpm extract-sprites  # télécharger sprites Batch D depuis PMDCollab
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
```

Mettre à jour :
- `docs/implementations.md` : 16 Pokemon ✓, compteurs moves/abilities
- `README.md#Progression`
- `docs/next.md`

---

## Décisions à trancher avant implémentation

1. **spore portée** : r1 (mêlée, équilibré) vs r1–2 (légèrement étendu). Recommandé : r1 pour éviter un contrôle sommeil trop facile à 100%.
2. **coil accuracy stage** : vérifier que `StatName.Accuracy` avec `target: Self` est supporté dans `handle-stat-change.ts` avant de coder. Si non, simplifier coil à +1 Atk/+1 Déf uniquement.
3. **glare vs thunder-wave** : glare = type Normal, contourne immunité Électrique (Raichu, Jolteon, Electrode). Garder ce comportement ? Recommandé : oui (canon).
4. **filter seuil** : 25% (×0.75, canon) vs 50% (×0.5, plus puissant). Recommandé : 25% canon.
5. **poison-touch cible déjà empoisonnée** : si cible déjà Poison/BadlyPoisoned, skip (vérifier `hasMajorStatus`). Recommandé : skip, cohérent avec les autres abilities de statut.
6. **5e move backup pour Chansey** : seismic-toss + recover + thunder-wave + double-edge = rôle défensif/support. Valider que ce kit est fun à jouer.

---

## Risques

- **surplus Poison** : Arbok + Muk + Weezing + Victreebel + Parasect = 5 ajouts à typage Poison. Roles distincts (saboteur / tank offensif / status spreader / attaquant / contrôleur Bug), mais une équipe Poison-lourde peut être oppressante. Tester en sandbox Poison × Sol/Psy counters.
- **spore + effect-spore** : Parasect cumule 100% sommeil mêlée + spore de contact 30% → peut sembler oppressant. Compensé par Vitesse 25 (mouvement 2).
- **chansey tank** : 250 HP + Soin Naturel = quasi-unkillable en fin de tour. Natural Cure déjà sur Staross ; deux tanks avec cette ability à surveiller.
- **double Intimidation** : Arbok + Tauros = 2 nouvelles Intimidations (+ Arcanin/Caninos existants). 4 Pokemon Intimidation dans le roster. Vérifier que l'IA ne spamme pas stacking.
- **replay golden** : ajout de 16 Pokemon modifie la sélection random. Régénérer le replay après Étape 4.
- **Tangela vs Victreebel** : movesets différenciés (wrap lieur vs leaf-blade slash) — vérifier en sandbox que les deux ont un espace distinct.
- **Muk stall** : minimize retiré → Grincement donne pression offensive, réduit le stall dégénéré. Surveiller combo screech + sludge-bomb.

---

## Dépendances

- Plan 077 DONE — réutilise tous les patterns : `EffectTier`, `TacticalOverride`, `AbilityHandler`, `RosterEntry`.
- `filter` nécessite `onDamageModify` hook : vérifier qu'il existe déjà (multiscale, thick-fat l'utilisent).
- `coil` (+1 Accuracy self) : vérifier support `StatName.Accuracy` en `target: Self` dans `handle-stat-change.ts`.
- `leaf-blade` : même pattern que `cross-chop` (`critRatio: 1` dans tactical.ts).

---

## Critères de complétion

- [ ] 16 Pokemon présents dans `roster-poc.ts`
- [ ] 8 nouveaux moves dans `tactical.ts`
- [ ] 8 fichiers `*.test.ts` moves dans `packages/core/src/battle/moves/`
- [ ] 2 nouvelles abilities dans `ability-definitions.ts`
- [ ] 2 `it()` abilities dans `abilities.integration.test.ts`
- [ ] Décision spore portée tranchée (r1 recommandé)
- [ ] Décision coil accuracy tranchée (vérifier support)
- [ ] Sprites Batch D téléchargés via PMDCollab
- [ ] Gate CI verte : `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
- [ ] `docs/implementations.md` mis à jour

---

## Fichiers à modifier

- `packages/data/src/roster/roster-poc.ts`
- `packages/data/src/overrides/tactical.ts`
- `packages/data/src/abilities/ability-definitions.ts`
- `packages/data/src/i18n/pokemon-names.fr.json`
- `packages/data/src/i18n/pokemon-names.en.json`
- `packages/renderer/src/i18n/fr.ts`
- `packages/renderer/src/i18n/en.ts`
- `docs/implementations.md`
- `README.md`
- `docs/next.md`
