# Plan 077 — Roster Batch C (18 Pokemon) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Ajouter 18 Pokemon Gen 1 au roster jouable. Focus principal : combler le manque de type **Glace** (4 Pokemon Ice introduits) et ajouter des rôles tactiques nouveaux absents des Batches A et B. 8 nouvelles abilities, 15 nouveaux moves, nouvelles mécaniques core mineures.

**Roster après Batch C** : 34 (actuel) + 18 (Batch C) = **52 Pokemon jouables**.

---

## Note de sélection

Les 18 retenus privilégient : (1) types sous-représentés (Glace), (2) diversité de rôles (snipers, kamikaze, tanks défense, contrôleurs zone), (3) abilities non encore codées qui enrichissent le méta. Formes intermédiaires incluses seulement si le rôle tactique est distinct de la forme finale déjà présente (haunter vs gengar).

Exclusions justifiées :
- **tauros** : rôle bruiser Normal déjà rempli par Kangaskhan + Snorlax.
- **mr-mime** : HP/Déf trop bas pour être jouable fun, Soundproof peu intéressant.
- **slowpoke** : Slowbro déjà présent, Slowpoke apporterait peu de distinctivité.
- **dodrio** : rôle Vol Normal redondant avec Charizard/Aérodactyl/Roucarnage.

---

## Pokemon — Batch C

| # | ID | Nom FR | Types | Ability | Statut ability |
|---|---|---|---|---|---|
| 028 | sandslash | Sablaireau | Sol | sand-veil | ✓ |
| 038 | ninetales | Feunard | Feu | flash-fire | ✓ |
| 040 | wigglytuff | Grodoudou | Normal/Fée | cute-charm | ✓ |
| 045 | vileplume | Rafflesia | Plante/Poison | effect-spore | ★ |
| 055 | golduck | Akwakwak | Eau | cloud-nine | ★ |
| 073 | tentacruel | Tentacruel | Eau/Poison | clear-body | ✓ |
| 082 | magneton | Magnéton | Électrique/Acier | magnet-pull | ✓ |
| 087 | dewgong | Lamantine | Eau/Glace | thick-fat | ✓ |
| 091 | cloyster | Crustabri | Eau/Glace | shell-armor | ★ |
| 093 | haunter | Spectrum | Spectre/Poison | levitate | ✓ |
| 099 | kingler | Krabboss | Eau | hyper-cutter | ★ |
| 101 | electrode | Électrode | Électrique | static | ✓ |
| 124 | jynx | Lippoutou | Glace/Psy | oblivious | ★ |
| 125 | electabuzz | Élektek | Électrique | static | ✓ |
| 126 | magmar | Magmar | Feu | flame-body | ★ |
| 131 | lapras | Lokhlass | Eau/Glace | water-absorb | ✓ |
| 137 | porygon | Porygon | Normal | trace | ★ |
| 139 | omastar | Amonistar | Roche/Eau | swift-swim | ★ |

`✓` = ability déjà implémentée — `★` = nouvelle ability

Sprites : tous ont "Faint abs." dans PMDCollab → fallback anim (identique Batches précédents).

---

## Movesets

### sandslash — Sablaireau — Sol

**Rôle** : bruiser physique de mêlée à haute Déf (110), frappe forte en zone Sol puis se booste avec Danse-Lames.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | STAB, friendly fire |
| slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| swords-dance | Normal | Statut | — | — | 20 | self | Setup +2 Atk |
| rock-slide | Roche | Phys | 75 | 90 | 10 | cône r2 | Couverture Vol |

Aucun nouveau move requis.

---

### ninetales — Feunard — Feu

**Rôle** : attaquant spécial Feu à haute portée et haute Vit (100). Flash-fire rend les miroirs Feu impossibles. Différent de Arcanin (physique) et Dracaufeu (multi-rôle).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| flamethrower | Feu | Spé | 90 | 100 | 15 | ligne r3 | STAB |
| will-o-wisp | Feu | Statut | — | 85 | 15 | single r1–3 | Brûlure 100% ★ |
| confuse-ray | Spectre | Statut | — | 100 | 10 | single r1–3 | Confusion 100% |
| nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé ★ |

Nouveaux moves : `will-o-wisp`, `nasty-plot`.

---

### wigglytuff — Grodoudou — Normal/Fée

**Rôle** : tank HP (140 base) avec Berceuse de zone et Plaquage paralysant. Cute Charm punit les attaquants corps à corps au contact.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| body-slam | Normal | Phys | 85 | 100 | 15 | mêlée single | Para 30% |
| sing | Normal | Statut | — | 55 | 15 | cône r3 | Sommeil 100% |
| double-edge | Normal | Phys | 120 | 100 | 15 | mêlée single | Recul 1/3, STAB |
| stockpile | Normal | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé |

Aucun nouveau move requis.

---

### vileplume — Rafflesia — Plante/Poison

**Rôle** : debuffeur de zone par spores. Effect-Spore endommage statistiquement tout attaquant au contact, Poudre Dodo + Bombgemme offrent contrôle et pression.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| sleep-powder | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil zone |
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB |
| moonblast | Fée | Spé | 95 | 100 | 15 | single r1–4 | −1 AtqSpé 30% ★ |
| petal-blizzard | Plante | Phys | 90 | 100 | 15 | zone r2 | STAB, friendly fire |

Nouveau move : `moonblast`.

---

### golduck — Akwakwak — Eau

**Rôle** : attaquant Eau/Psy hybride, rapide (Vit 85). Cloud Nine efface les bonus météo adverses. Rayon Glace couvre Dragon.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| psychic | Psy | Spé | 90 | 100 | 10 | single r4 | Couverture, −1 DéfSpé 10% |
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | Couverture Dragon |
| nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé ★ |

Nouveau move : `nasty-plot` (partagé avec Ninetales).

---

### tentacruel — Tentacruel — Eau/Poison

**Rôle** : contrôleur zone Poison, Clear Body empêche toute baisse de stats adverse. Cradovague zone + Toxik finisseur.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| toxic | Poison | Statut | — | 90 | 10 | single r2 | Poison fort 100% |
| sludge-wave | Poison | Spé | 95 | 100 | 10 | zone r2 | STAB zone ★ |
| icy-wind | Glace | Spé | 55 | 95 | 15 | cône r2 | −1 Vit zone |

Nouveau move : `sludge-wave`.

---

### magneton — Magnéton — Électrique/Acier

**Rôle** : sniper Électrique/Acier, Magnet Pull piège les types Acier adjacents (extension de Magnéti). Luminocanon assure couverture Roche/Glace.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | STAB, Para 10% |
| flash-cannon | Acier | Spé | 80 | 100 | 10 | ligne r3 | STAB Acier ★ |
| discharge | Électrique | Spé | 80 | 100 | 15 | zone r2 | STAB zone ★ |
| screech | Normal | Statut | — | 85 | 40 | single r1–3 | −2 Déf cible ★ |

Nouveaux moves : `flash-cannon`, `discharge`, `screech`.

---

### dewgong — Lamantine — Eau/Glace

**Rôle** : tank de zone Glace. Isograisse coupe de moitié les dégâts Feu et Glace reçus. Contrôleur défensif avec Aurora Beam debuff Atk.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | STAB |
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| aurora-beam | Glace | Spé | 65 | 100 | 20 | ligne r3 | −1 Atk cibles |
| rest | Psy | Statut | — | — | 5 | self | Soigne 100% PV |

Aucun nouveau move requis.

---

### cloyster — Crustabri — Eau/Glace

**Rôle** : artilleur multi-hits à très haute Déf (180). Shell Armor (immunité crits) + Déf maximale rend Crustabri quasi-indestructible physiquement. Stalactite = multi-hits Glace.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| icicle-spear | Glace | Phys | 25 | 100 | 30 | single r1 | STAB, 2–5 hits ★ |
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| iron-defense | Acier | Statut | — | — | 15 | self | +2 Déf |
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | STAB ranged |

Nouveau move : `icicle-spear`.

---

### haunter — Spectrum — Spectre/Poison

**Rôle** : bruiser Spectre fragile mais explosif (115 AtqSpé, 95 Vit), distinct de Gengar (130 AtqSpé, 110 Vit, HP 60 vs 45). Levitate = immunité Sol comme Fantominus.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| shadow-ball | Spectre | Spé | 80 | 100 | 15 | single r4 | STAB, −1 DéfSpé 20% |
| sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB |
| hypnosis | Psy | Statut | — | 60 | 20 | single r3 | Sommeil 100% |
| lick | Spectre | Phys | 30 | 100 | 30 | mêlée | STAB, Para 30% |

Aucun nouveau move requis.

---

### kingler — Krabboss — Eau

**Rôle** : guerrier physique ultra-offensif (130 Atk, 115 Déf). Hyper Cutter empêche Intimidation et toute baisse d'Attaque. Pince-Masse = coup signature à haute crit.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| crabhammer | Eau | Phys | 100 | 95 | 10 | single r1 | STAB, haute crit ★ |
| slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| swords-dance | Normal | Statut | — | — | 20 | self | +2 Atk |
| rock-slide | Roche | Phys | 75 | 90 | 10 | cône r2 | Couverture |

Nouveau move : `crabhammer`.

---

### electrode — Électrode — Électrique

**Rôle** : kamikaze Électrique ultra-rapide (150 Vit). Destruction = bombe zone si acculé. Coup d'Jus zone pour contrôle terrain.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | STAB |
| discharge | Électrique | Spé | 80 | 100 | 15 | zone r2 | STAB zone ★ |
| thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Para 100% |
| self-destruct | Normal | Phys | 200 | 100 | 5 | zone r2 | Kamikaze ★ |

Nouveaux moves : `discharge` (partagé Magneton), `self-destruct`.

---

### jynx — Lippoutou — Glace/Psy

**Rôle** : contrôleuse Glace/Psy, spécialiste du sommeil. Oblivious = immunité Attirance (Cute Charm adverse). Grobisou = sommeil monocible distinct de Berceuse.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| blizzard | Glace | Spé | 110 | 70 | 5 | cône r3 | STAB, Gel 10% |
| psychic | Psy | Spé | 90 | 100 | 10 | single r4 | STAB |
| lovely-kiss | Normal | Statut | — | 75 | 10 | single r1–3 | Sommeil 100% ★ |
| nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé ★ |

Nouveaux moves : `lovely-kiss`, `nasty-plot` (partagé).

---

### electabuzz — Élektek — Électrique

**Rôle** : attaquant Électrique hybride physique/spécial (Vit 105). Static + Poing-Éclair mêlée le différencient d'Electrode (kamikaze pur) et Raichu (lightning-rod).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | STAB |
| thunder-punch | Électrique | Phys | 75 | 100 | 15 | mêlée | STAB, Para 10%, punch |
| discharge | Électrique | Spé | 80 | 100 | 15 | zone r2 | STAB zone ★ |
| ice-punch | Glace | Phys | 75 | 100 | 15 | mêlée | Couverture Dragon, Gel 10% |

Nouveau move : `discharge` (partagé). Aucun unique nouveau.

---

### magmar — Magmar — Feu

**Rôle** : attaquant Feu hybride, symétrique de Électabuzz. Flame Body punit les attaquants contact, différent de Flash Fire (Ninetales) et Intimidation (Arcanin).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| flamethrower | Feu | Spé | 90 | 100 | 15 | ligne r3 | STAB |
| fire-punch | Feu | Phys | 75 | 100 | 15 | mêlée | STAB, Brûlure 10%, punch |
| lava-plume | Feu | Spé | 80 | 100 | 15 | zone r1 | STAB zone, Brûl 30% |
| thunder-punch | Électrique | Phys | 75 | 100 | 15 | mêlée | Couverture Eau, Para 10% |

Aucun nouveau move requis.

---

### lapras — Lokhlass — Eau/Glace

**Rôle** : tank offensif Eau/Glace (130 PV, 80 Déf, 95 DéfSpé). Water Absorb rend les matchs Eau très favorables. Couverture mixte Glace/Eau/Foudre.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | STAB |
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | Couverture Eau/Vol |
| sing | Normal | Statut | — | 55 | 15 | cône r3 | Contrôle sommeil |

Aucun nouveau move requis.

---

### porygon — Porygon — Normal

**Rôle** : wildcard tactique. Trace copie l'ability adversaire la plus proche. Triplattaque inflige un statut aléatoire. Récupération soutient sa survie.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| tri-attack | Normal | Spé | 80 | 100 | 10 | single r1–4 | Brûl/Para/Gel 20% ★ |
| lock-on | Normal | Statut | — | — | 5 | single r1–4 | Prochain move garanti ★ |
| recover | Normal | Statut | — | — | 5 | self | Soigne 50% PV |
| thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Para 100% |

Nouveaux moves : `tri-attack`, `lock-on`.

---

### omastar — Amonistar — Roche/Eau

**Rôle** : contrôleur roche défensif (125 Déf) + sniper. Swift Swim = stub Phase 4 (météo Phase 9). Exuviation = mode kamikaze offensif risqué (−1 Déf/DéfSpé).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| ancient-power | Roche | Spé | 60 | 100 | 5 | single r1–3 | STAB, +all stats 10% ★ |
| surf | Eau | Spé | 90 | 100 | 15 | zone r2 | STAB |
| ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | Couverture Herbe |
| shell-smash | Normal | Statut | — | — | 15 | self | +2 Atk/AtqSpé/Vit, −1 Déf/DéfSpé ★ |

Nouveaux moves : `ancient-power`, `shell-smash`.

---

## Nouveaux moves (15)

| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effets |
|---|---|---|---|---|---|---|---|---|
| will-o-wisp | Feu Follet | Feu | Statut | — | 85 | 15 | `single r1–3` | Brûlure 100% |
| nasty-plot | Machination | Ténèbres | Statut | — | — | 20 | `self` | +2 AtqSpé |
| sludge-wave | Cradovague | Poison | Spé | 95 | 100 | 10 | `zone r2` | Friendly fire, Poison 10% |
| flash-cannon | Luminocanon | Acier | Spé | 80 | 100 | 10 | `ligne r3` | −1 DéfSpé cible 10% |
| discharge | Coup d'Jus | Électrique | Spé | 80 | 100 | 15 | `zone r2` | Para 30%, friendly fire |
| screech | Grincement | Normal | Statut | — | 85 | 40 | `single r1–3` | −2 Déf cible |
| icicle-spear | Stalactite | Glace | Phys | 25 | 100 | 30 | `single r1` | 2–5 hits |
| lovely-kiss | Grobisou | Normal | Statut | — | 75 | 10 | `single r1–3` | Sommeil 100% |
| crabhammer | Pince-Masse | Eau | Phys | 100 | 95 | 10 | `single r1` | Haute crit (`critRatio: 1`) |
| self-destruct | Destruction | Normal | Phys | 200 | 100 | 5 | `zone r2` | Attaquant KO après usage |
| tri-attack | Triplattaque | Normal | Spé | 80 | 100 | 10 | `single r1–4` | 20% Para (Phase 4 simplifié — voir décision) |
| lock-on | Verrouillage | Normal | Statut | — | — | 5 | `single r1–4` | Prochain move de l'utilisateur garanti (accuracy override 1 tour) |
| moonblast | Pouvoir Lunaire | Fée | Spé | 95 | 100 | 15 | `single r1–4` | −1 AtqSpé cible 30% |
| ancient-power | Pouvoir Antique | Roche | Spé | 60 | 100 | 5 | `single r1–3` | +1 toutes stats attaquant 10% (indépendant) |
| shell-smash | Exuviation | Normal | Statut | — | — | 15 | `self` | +2 Atk, +2 AtqSpé, +2 Vit, −1 Déf, −1 DéfSpé |

---

## Nouvelles abilities (8)

| ID | Nom FR | Description mécanique | Hook(s) |
|---|---|---|---|
| effect-spore | Pose Spore | 30% chance sur attaque contact reçue : Sommeil ou Poison ou Para (1/3 chacun) | `onAfterDamageReceived` : si contact et `random() < 0.30` → statut aléatoire pondéré |
| cloud-nine | Ciel Gris | Supprime bonus/malus météo — **stub Phase 4** | Vide — hook `onWeatherModify` Phase 9 |
| shell-armor | Coque Armure | Immunité aux coups critiques | `preventsCrit: true` (identique `battle-armor`) |
| hyper-cutter | Hyper Cutter | Bloque toutes les baisses d'Attaque | `onStatChangeBlocked` : si `stat === Attack && stages < 0` → blocked |
| oblivious | Flegmatique | Immunité à Attirance (Infatuation) | `onStatusBlocked` : si `status === Infatuated` → blocked |
| flame-body | Corps Ardent | 30% chance Brûlure sur attaque contact reçue | `onAfterDamageReceived` : si contact et `random() < 0.30` → Burned sur attaquant |
| trace | Calque | Arrive sur terrain : copie l'ability du Pokemon ennemi le plus proche | `onBattleStart` : cherche ennemi le plus proche, copie son `abilityId`, émet `AbilityActivated` |
| swift-swim | Glissade | Double la vitesse sous pluie — **stub Phase 4** | Vide — hook `onCTModify` Phase 9 |

### Trace — détails implémentation

**Pré-requis** : vérifier que `AbilityHandlerRegistry.getForPokemon(pokemon)` lit `pokemon.abilityId` dynamiquement (pas de cache initial). Si le registry cache à la construction, Trace ne fonctionnera pas.

```ts
const trace: AbilityHandler = {
  id: "trace",
  onBattleStart: (context) => {
    const enemies = [...context.state.pokemon.values()].filter(
      p => p.playerId !== context.self.playerId && p.currentHp > 0
    );
    if (enemies.length === 0) return [];
    const nearest = enemies.reduce((a, b) =>
      chebyshev(context.self.position, a.position) <= chebyshev(context.self.position, b.position) ? a : b
    );
    const copiedId = nearest.abilityId;
    if (!copiedId) return [];
    context.self.abilityId = copiedId;
    return [{ type: BattleEventType.AbilityActivated, pokemonId: context.self.id, abilityId: "trace", targetIds: [nearest.id] }];
  },
};
```

### Effect-Spore — détails implémentation

```ts
const effectSpore: AbilityHandler = {
  id: "effect-spore",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact) return [];
    if (hasMajorStatus(context.attacker)) return [];
    if (context.random() >= 0.30) return [];
    const roll = context.random();
    const status = roll < 1/3 ? StatusType.Asleep
                 : roll < 2/3 ? StatusType.Poisoned
                 : StatusType.Paralyzed;
    // ... apply status + emit events
    return [/* AbilityActivated, StatusApplied */];
  },
};
```

---

## Moves complexes — décisions d'implémentation

### self-destruct

Approche : `EffectKind.Recoil` avec `fraction: 999` dans tactical.ts. Réutilise `handle-recoil.ts` existant sans nouveau EffectKind. La fraction > 1 garantit un KO de l'attaquant.

**Vérifier** : `handle-recoil.ts` ne doit pas limiter le recul à `currentHp` pour que le KO soit émis. Un `Math.floor(maxHp * 999)` >> currentHp max → KO garanti.

```ts
"self-destruct": {
  targeting: { kind: TargetingKind.Zone, radius: 2 },
  effects: [
    { kind: EffectKind.Damage },
    { kind: EffectKind.Recoil, fraction: 999 },
  ],
},
```

### tri-attack (Phase 4 simplifié)

Décision #XXX : Phase 4 = statut fixe `Paralyzed` 20% (encode comme `body-slam` mais Spé). Tri-status aléatoire (Brûl/Para/Gel 1/3 chacun) → Phase 9.

### lock-on

Ajout `StatusType.LockedOn` dans `status-type.ts`. Dans `accuracy-check.ts` : si attaquant a `LockedOn`, skip le check et décrémenter le volatile.

```ts
// accuracy-check.ts
if (attacker.volatiles.some(v => v.type === StatusType.LockedOn)) {
  removeVolatile(attacker, StatusType.LockedOn);
  return true; // always hit
}
```

### ancient-power

5 effets `StatChange` indépendants à 10% chacun (pas "toutes ou rien"). Diverge du canon Pokemon mais acceptable Phase 4. Décision #XXX.

### shell-smash

5 effets `StatChange` dans effects[]. Le système existant supporte déjà `stages: -1` et `stages: +2` — vérifier que les baisses sur self fonctionnent avec `target: EffectTarget.Self`.

---

## Nouvelles mécaniques core

### StatusType.LockedOn

`packages/core/src/enums/status-type.ts` : ajouter `LockedOn = "locked-on"`.
`packages/core/src/battle/accuracy-check.ts` : hook avant le check normal.

### Pas de nouveau EffectKind

`self-destruct` réutilise `Recoil`. Les autres moves réutilisent les patterns existants.

---

## Étapes d'implémentation

### Étape 1 — StatusType.LockedOn (pour lock-on)

- `packages/core/src/enums/status-type.ts` : ajouter `LockedOn`
- `packages/core/src/battle/accuracy-check.ts` : check LockedOn avant accuracy

### Étape 2 — Nouvelles abilities

`packages/data/src/abilities/ability-definitions.ts` (ou fichiers individuels selon structure existante) : ajouter les 8 handlers.

Abilities triviales (copie pattern existant) :
- `shell-armor` → copie `battle-armor` (même `preventsCrit: true`)
- `hyper-cutter` → copie `keen-eye` (même hook `onStatChangeBlocked`, stat `Attack`)
- `oblivious` → copie `limber` (même hook `onStatusBlocked`, status `Infatuated`)
- `cloud-nine` et `swift-swim` → handlers vides (stub)
- `flame-body` → copie `static` (même hook `onAfterDamageReceived`, statut `Burned`)

### Étape 3 — Nouveaux moves dans tactical.ts

Ajouter les 15 entries dans `packages/data/src/overrides/tactical.ts`.

### Étape 4 — Roster

`packages/data/src/roster/roster-poc.ts` : ajouter les 18 nouvelles entrées.

### Étape 5 — i18n

- `packages/data/src/i18n/pokemon-names.fr.json` : 18 noms FR
- `packages/data/src/i18n/pokemon-names.en.json` : 18 noms EN
- Vérifier moves manquants dans `moves.fr.json` (`lock-on`, `ancient-power`, `moonblast`, etc.)

### Étape 6 — Tests

**Règle** : 1 test minimum par nouveau move ET par nouvelle ability non-triviale.

#### Tests moves (`packages/core/src/battle/moves/*.test.ts`)

| Fichier | Test minimal |
|---|---|
| `will-o-wisp.test.ts` | Brûlure 100% appliquée |
| `nasty-plot.test.ts` | +2 AtqSpé (pattern `swords-dance.test.ts`) |
| `sludge-wave.test.ts` | Zone r2 touche toutes cibles, Poison 10% |
| `flash-cannon.test.ts` | Dégâts + −1 DéfSpé 10% (mock random=0.05) |
| `discharge.test.ts` | Zone r2 + Para 30% |
| `screech.test.ts` | −2 Déf cible |
| `icicle-spear.test.ts` | 2–5 hits (pattern `fury-swipes.test.ts`) |
| `lovely-kiss.test.ts` | Sommeil 100% (pattern `hypnosis.test.ts`) |
| `crabhammer.test.ts` | Dégâts Eau, critRatio=1 |
| `self-destruct.test.ts` | Attaquant KO + dégâts zone cibles |
| `tri-attack.test.ts` | Para 20% (mock random=0.05) |
| `lock-on.test.ts` | Move suivant atterrit malgré Évasion maximale |
| `moonblast.test.ts` | −1 AtqSpé 30% (mock random=0.1) |
| `ancient-power.test.ts` | +1 stats 10% par stat indépendant |
| `shell-smash.test.ts` | +2/+2/+2 Atk/AtqSpé/Vit, −1/−1 Déf/DéfSpé |

#### Tests abilities (`packages/core/src/battle/abilities.integration.test.ts`)

| Ability | Test minimal |
|---|---|
| effect-spore | Attaque contact → statut appliqué 30% (mock random=0.1) |
| shell-armor | Pas de CriticalHit event sur Cloyster (mock random=0) |
| hyper-cutter | Growl/Rugissement bloqué sur Kingler |
| oblivious | Cute Charm → Infatuation bloqué sur Jynx |
| flame-body | Contact → Brûlure 30% sur attaquant (mock random=0.1) |
| trace | Lapras en face → Porygon copie water-absorb, Surf bloqué |
| cloud-nine | Smoke test no-crash (stub) |
| swift-swim | Smoke test no-crash (stub) |

### Étape 7 — Sprites + Gate CI + doc

```bash
pnpm extract-sprites  # télécharger sprites Batch C depuis PMDCollab
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
```

Mettre à jour :
- `docs/implementations.md` : 18 Pokemon ✓, compteurs moves/abilities
- `README.md#Progression`
- `docs/next.md`

---

## Décisions à trancher avant implémentation

1. **lock-on** : implémentation réelle (`StatusType.LockedOn` + hook accuracy) vs stub (ignore pour Phase 4). Recommandé : réelle, coût raisonnable.
2. **tri-attack** : Phase 4 = statut fixe `Paralyzed` 20% (simple) vs tri-status aléatoire (complexe). Recommandé : fixe Para 20%.
3. **ancient-power** : 5 chances indépendantes à 10% (simple) vs toutes-ou-rien 10% (canon). Recommandé : indépendant Phase 4.
4. **self-destruct recul** : vérifier dans `handle-recoil.ts` que `fraction * maxHp` > `currentHp` produit bien un KO émis en `FaintDealt`.
5. **trace dynamicité** : vérifier `AbilityHandlerRegistry.getForPokemon()` lit `abilityId` dynamiquement avant d'implémenter.
6. **haunter dans roster** : Spectrum présente un rôle distinct de Gengar (HP 45 vs 60, AtqSpé 115 vs 130). Accepté.

---

## Risques

- **surplus Glace** : 4 Pokemon Glace (Lapras, Dewgong, Cloyster, Jynx) + Ice Beam sur 8+ Pokemon → le type Glace pourrait dominer. Surveiller en sandbox.
- **effect-spore + sommeil meta** : Vileplume (sleep-powder zone) + Effect Spore (contact) + Jynx (Grobisou) peut rendre le contrôle de statut oppressant.
- **discharge friendly fire** : Electrode et Magneton partagent discharge zone r2. En équipe mixte = feature tactique, pas bug.
- **shell-smash Omastar** : +2/+2/+2 avec 125 Déf de base → surveiller en playtest.
- **Replay golden** : ajout de 18 Pokemon modifie la sélection random. Régénérer le replay après étape 4.

---

## Dépendances

- Plan 076 DONE — réutilise tous les patterns : `EffectTier`, `TacticalOverride`, `AbilityHandler`, `RosterEntry`, `preventsCrit`, `blocksRecoil`, `onEndTurn`.
- Moves `discharge` et `flash-cannon` : Zone r2 et Line r3 déjà dans le système, pas de nouvelle mécanique.
- `screech` (−2 Déf) : vérifier que `stages: -2` sur StatChange est supporté dans `handle-stat-change.ts`.
- `shell-smash` : vérifier que `target: EffectTarget.Self` sur StatChange négatif fonctionne.

---

## Critères de complétion

- [ ] 18 Pokemon présents dans `roster-poc.ts`
- [ ] 15 nouveaux moves dans `tactical.ts`
- [ ] 15 fichiers `*.test.ts` moves dans `packages/core/src/battle/moves/`
- [ ] 8 nouvelles abilities dans `ability-definitions.ts`
- [ ] 8 `it()` abilities dans `abilities.integration.test.ts`
- [ ] Décision lock-on tranchée et implémentée (réel recommandé)
- [ ] Décision tri-attack tranchée (fixe Para 20% Phase 4)
- [ ] `StatusType.LockedOn` ajouté (si lock-on réel) + hook accuracy
- [ ] Sprites Batch C téléchargés via PMDCollab
- [ ] Gate CI verte : `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
- [ ] `docs/implementations.md` mis à jour

---

## Fichiers à modifier

- `packages/data/src/roster/roster-poc.ts`
- `packages/data/src/overrides/tactical.ts`
- `packages/data/src/overrides/balance-v1.ts` (si overrides stats nécessaires)
- `packages/data/src/abilities/ability-definitions.ts`
- `packages/core/src/enums/status-type.ts` (LockedOn)
- `packages/core/src/battle/accuracy-check.ts` (hook LockedOn)
- `packages/data/src/i18n/pokemon-names.fr.json`
- `packages/data/src/i18n/pokemon-names.en.json`
- `docs/implementations.md`
- `README.md`
- `docs/next.md`
