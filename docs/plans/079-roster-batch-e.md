# Plan 079 — Roster Batch E (14 Pokemon) — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-12

## Objectif

**Finaliser le roster Gen 1 — derniers stades d'évolution.** Ajouter les 14 derniers Pokemon manquants : 9 non-légendaires + 5 légendaires.

**Roster après Batch E** : 67 (actuel) + 14 = **81 Pokemon jouables**. Roster Gen 1 final complet (hors Ditto, voir Note).

Le batch introduit :
- **1 nouveau EffectKind core** : `Drain` (Vampirisme, Méga-Sangsue) — dégâts puis soin attaquant = `fraction × dégâts infligés`.
- **2 nouveaux champs AbilityHandler** : `accuracyMultiplier?: number` (Œil Composé ×1.3) et `targetedCtBonus?: number` (Pression +50 CT).
- **1 nouveau flag MoveDefinition** : `bypassAccuracy?: boolean` (Aéropique — touche garantie).
- **8 nouveaux moves** : Vampirisme, Méga-Sangsue, Double Dard, Aéropique, Danse Plumes, Croc de Mort, Papillodanse, Atterrissage.
- **5 nouvelles abilities réelles** : Œil Composé, Essaim, Ignifu-Voile, Pression, Suintement (stub seul : Attention — pas de mécanique flinch dans le core).

---

## Note de sélection

Critères : (1) compléter le roster Gen 1 final, (2) introduire le drain comme nouvelle mécanique core, (3) maximiser la réutilisation des moves existants. Sur 14 Pokemon, 8 n'ont aucun nouveau move.

**Exclusion : Ditto (132)** — Transform = mécanique complexe (copie stats + moves + types runtime). Reporté Phase 9 ou plan dédié.

**Légendaires (5)** : Articuno/Zapdos/Moltres/Mewtwo/Mew. Stats brutes supérieures aux Pokemon classiques (BST 580 vs ~500). Pas de balance override dans ce plan — équilibrage différé à Phase 5 (balancer).

---

## Pokemon — Batch E

| # | ID | Nom FR | Types | Ability | Statut ability |
|---|---|---|---|---|---|
| 012 | butterfree | Papilusion | Insecte/Vol | compound-eyes | ★ |
| 015 | beedrill | Dardargnan | Insecte/Poison | swarm | ★ |
| 018 | pidgeot | Roucarnage | Normal/Vol | keen-eye | ✓ |
| 020 | raticate | Rattatac | Normal | guts | ✓ |
| 022 | fearow | Rapasdepic | Normal/Vol | keen-eye | ✓ |
| 042 | golbat | Nosferalto | Poison/Vol | inner-focus | ★ stub (flinch Phase 9) |
| 049 | venomoth | Aéromite | Insecte/Poison | shield-dust | ★ |
| 083 | farfetch-d | Canarticho | Normal/Vol | keen-eye | ✓ |
| 119 | seaking | Poissoroy | Eau | water-veil | ★ (anti-Brûlure) |
| 144 | articuno | Artikodin | Glace/Vol | pressure | ★ |
| 145 | zapdos | Électhor | Électrique/Vol | pressure | ★ |
| 146 | moltres | Sulfura | Feu/Vol | pressure | ★ |
| 150 | mewtwo | Mewtwo | Psy | pressure | ★ |
| 151 | mew | Mew | Psy | synchronize | ✓ |

`✓` = ability existante · `★` = nouvelle ability réelle · `stub` = ability enregistrée mais effet différé Phase 9 (dépendance core manquante)

Sprites : tous ont "Faint abs." PMDCollab → fallback anim (identique Batches précédents). Récupération via `pnpm extract-sprites` après ajout au `sprite-config.json`.

---

## Movesets

### butterfree — Papilusion — Insecte/Vol

**Rôle** : contrôleur sommeil + setup spécial. Œil Composé (×1.3 précision) fiabilise Poudre Dodo (75 → 97.5%) et Bourdon. Papillodanse +1 AtqSpé/DéfSpé/Vit = setup tri-stat unique. Vol évite blocage terrain.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| sleep-powder (Poudre Dodo) | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil zone (avec Œil Composé ≈ 97.5%) |
| psybeam (Rafale Psy) | Psy | Spé | 65 | 100 | 20 | ligne r5 | Couverture, 10% Confusion |
| gust (Tornade) | Vol | Spé | 40 | 100 | 35 | cône r3 | STAB Vol |
| quiver-dance (Papillodanse) | Insecte | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé, +1 Vit ★ |

Nouveau move : `quiver-dance` (Papillodanse).

---

### beedrill — Dardargnan — Insecte/Poison

**Rôle** : assassin physique Poison. Double Dard (2 hits, Poison cumulé ~36%). Essaim = STAB Insecte ×1.5 sous 33% HP. Crocs Venin pour BadlyPoisoned 50%.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| twineedle (Double Dard) | Insecte | Phys | 25 | 100 | 20 | mêlée | 2 hits, Poison 36% cumulé ★ |
| poison-sting (Dard-Venin) | Poison | Phys | 15 | 100 | 35 | mêlée | Poison 30% (existant) |
| swords-dance (Danse-Lames) | Normal | Statut | — | — | 20 | self | +2 Atk |
| poison-fang (Crocs Venin) | Poison | Phys | 50 | 100 | 15 | mêlée | BadlyPoisoned 50% |

Nouveau move : `twineedle` (Double Dard).

---

### pidgeot — Roucarnage — Normal/Vol

**Rôle** : sniper Vol garanti (101 Vit). Différencié de Roucoul par Aéropique (jamais raté) qui remplace Cru-Aile classique. Danse Plumes −2 Atk = anti-physique précis. Couverture spéciale via Lame d'Air.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| aerial-ace (Aéropique) | Vol | Phys | 60 | 100 | 20 | single r1–2 | STAB, **jamais raté** (bypassAccuracy) ★ |
| quick-attack (Vive-Attaque) | Normal | Phys | 40 | 100 | 30 | dash r2 | Priorité +1 |
| air-slash (Lame d'Air) | Vol | Spé | 75 | 95 | 15 | single r3 | STAB ranged spécial |
| feather-dance (Danse Plumes) | Vol | Statut | — | 100 | 15 | single r1–3 | −2 Atk cible ★ |

Nouveaux moves : `aerial-ace` (Aéropique), `feather-dance` (Danse Plumes).

> **Différenciation Roucoul** : Roucoul a Tornade/Vive-Attaque/Jet de Sable/Cru-Aile (généraliste Vol). Roucarnage spécialise sur sniper garanti (Aéropique never-miss) + caster spécial (Lame d'Air) + debuff Atk (Danse Plumes). Pas d'overlap direct sur les 4 moves.

---

### raticate — Rattatac — Normal

**Rôle** : speedster Cran (Guts). Sous statut, Atk ×1.5. Croc de Mort STAB mêlée fort. Kit cohérent rat agressif.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| hyper-fang (Croc de Mort) | Normal | Phys | 80 | 90 | 15 | mêlée | STAB, fort mêlée ★ |
| quick-attack (Vive-Attaque) | Normal | Phys | 40 | 100 | 30 | dash r2 | Priorité |
| swords-dance (Danse-Lames) | Normal | Statut | — | — | 20 | self | +2 Atk |
| crunch (Mâchouille) | Ténèbres | Phys | 80 | 100 | 15 | mêlée | Couverture Psy/Spectre, −1 Déf 20% |

Nouveau move : `hyper-fang` (Croc de Mort).

---

### fearow — Rapasdepic — Normal/Vol

**Rôle** : speedster Vol agressif (100 Vit, 90 Atk). Picpic STAB en arc devant + Aéropique jamais raté. Hâte pour double-up Vitesse.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| drill-peck (Picpic) | Vol | Phys | 80 | 100 | 20 | slash | STAB (existant Batch D) |
| aerial-ace (Aéropique) | Vol | Phys | 60 | 100 | 20 | single r1–2 | STAB, jamais raté |
| quick-attack (Vive-Attaque) | Normal | Phys | 40 | 100 | 30 | dash r2 | Priorité |
| agility (Hâte) | Psy | Statut | — | — | 30 | self | +2 Vit |

Aucun nouveau move (Aéropique ajouté pour Roucarnage).

---

### golbat — Nosferalto — Poison/Vol

**Rôle** : harceleur Vol-Poison. Vampirisme (mêlée r1) = première arme drain du roster — soigne 50% des dégâts infligés. Attention = anti-flinch (stub Phase 9). Cru-Aile STAB.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| leech-life (Vampirisme) | Insecte | Phys | 80 | 100 | 10 | **mêlée r1** | Soigne 50% dégâts infligés ★ |
| wing-attack (Cru-Aile) | Vol | Phys | 60 | 100 | 35 | slash | STAB |
| confuse-ray (Onde Folie) | Spectre | Statut | — | 100 | 10 | single r1–3 | Confusion 100% |
| poison-fang (Crocs Venin) | Poison | Phys | 50 | 100 | 15 | mêlée | BadlyPoisoned 50% |

Nouveau move : `leech-life` (Vampirisme).

> **Décision portée Vampirisme** : mêlée r1 (1 case devant) — force Nosferalto à plonger en mêlée. Risque/récompense intéressant : drain conditionnel à l'adjacence.

---

### venomoth — Aéromite — Insecte/Poison

**Rôle** : caster spécial Poison/Insecte. Papillodanse setup tri-stat. Suintement bloque les effets secondaires des moves reçus (immunité partielle aux Brûl/Para/Confusion en additionnel). Sleep Powder fiabilisé par Vit 90.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| sleep-powder (Poudre Dodo) | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil zone |
| psybeam (Rafale Psy) | Psy | Spé | 65 | 100 | 20 | ligne r5 | Confusion 10% |
| sludge-bomb (Bomb-Beurk) | Poison | Spé | 90 | 100 | 10 | blast r2–4 | STAB |
| quiver-dance (Papillodanse) | Insecte | Statut | — | — | 20 | self | +1 AtqSpé/DéfSpé/Vit |

Aucun nouveau move (Papillodanse déjà ajouté pour Papilusion).

> **Différenciation Papilusion** : kit base similaire (Poudre Dodo + Rafale Psy + Papillodanse) MAIS Aéromite a Bomb-Beurk (STAB Poison) vs Papilusion a Tornade (STAB Vol). Différenciation tactique : Aéromite focus Poison + setup, Papilusion focus Vol + précision boostée. Suivi en sandbox confirmera.

---

### farfetch-d — Canarticho — Normal/Vol

**Rôle** : épéiste mêlée avec poireau. Tranche et Lame Feuille (le poireau = type Plante). Aéropique pour STAB Vol qui ne rate jamais. Danse-Lames setup classique.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| slash (Tranche) | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| swords-dance (Danse-Lames) | Normal | Statut | — | — | 20 | self | +2 Atk |
| leaf-blade (Lame Feuille) | Plante | Phys | 90 | 100 | 15 | slash | Critique élevé (le poireau) |
| aerial-ace (Aéropique) | Vol | Phys | 60 | 100 | 20 | single r1–2 | STAB, jamais raté |

Aucun nouveau move (Aéropique déjà ajouté pour Roucarnage).

---

### seaking — Poissoroy — Eau

**Rôle** : attaquant Eau physique. Cascade dash STAB. Méga-Sangsue couverture Plante (drain 50%). Hâte pour CT explosif sous Glissade (stub météo Phase 9).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| waterfall (Cascade) | Eau | Phys | 80 | 100 | 15 | dash r3 | STAB |
| aqua-tail (Hydroqueue) | Eau | Phys | 90 | 90 | 10 | mêlée | STAB |
| mega-drain (Méga-Sangsue) | Plante | Spé | 40 | 100 | 15 | single r1–4 | Soigne 50% dégâts infligés ★ |
| agility (Hâte) | Psy | Statut | — | — | 30 | self | +2 Vit |

Nouveau move : `mega-drain` (Méga-Sangsue).

---

### articuno — Artikodin — Glace/Vol

**Rôle** : mur spécial Glace (125 DéfSpé, 100 Déf). Blizzard zone + Laser Glace ligne = double-couverture Glace. Atterrissage (50% HP) survie longue durée. Pression = +50 CT à tout ennemi qui le cible offensivement.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| blizzard (Blizzard) | Glace | Spé | 110 | 70 | 5 | zone r2 | STAB, Gel 10% |
| ice-beam (Laser Glace) | Glace | Spé | 90 | 100 | 10 | ligne r4 | STAB, Gel 10% |
| roost (Atterrissage) | Vol | Statut | — | — | 10 | self | Soigne 50% PV max ★ |
| agility (Hâte) | Psy | Statut | — | — | 30 | self | +2 Vit |

Nouveau move : `roost` (Atterrissage).

---

### zapdos — Électhor — Électrique/Vol

**Rôle** : nuke spécial Électrique (125 AtqSpé, 100 Vit). Tonnerre ligne + Coup d'Jus zone. Picpic STAB Vol surprise. Pression épuise les attaquants.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| thunderbolt (Tonnerre) | Électrique | Spé | 90 | 100 | 15 | ligne r4 | STAB, Para 10% |
| discharge (Coup d'Jus) | Électrique | Spé | 80 | 100 | 15 | zone r1 | STAB AoE, Para 30% |
| drill-peck (Picpic) | Vol | Phys | 80 | 100 | 20 | slash | STAB physique |
| agility (Hâte) | Psy | Statut | — | — | 30 | self | +2 Vit |

Aucun nouveau move.

---

### moltres — Sulfura — Feu/Vol

**Rôle** : nuke Feu/Vol (125 AtqSpé, 100 Atk). Lance-Flammes ligne, Déflagration nuke, Pyrobombe zone. Cru-Aile STAB couverture. Pression épuise les attaquants.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| flamethrower (Lance-Flammes) | Feu | Spé | 90 | 100 | 15 | ligne r3 | STAB, Brûl 10% |
| fire-blast (Déflagration) | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | STAB nuke |
| lava-plume (Pyrobombe) | Feu | Spé | 80 | 100 | 15 | zone r1 | STAB AoE, Brûl 30% |
| wing-attack (Cru-Aile) | Vol | Phys | 60 | 100 | 35 | slash | STAB couverture |

Aucun nouveau move.

---

### mewtwo — Mewtwo — Psy

**Rôle** : caster ultime (154 AtqSpé, 130 Vit, BST 680). Psyko STAB. Plénitude setup AtqSpé+DéfSpé. Couverture Glace/Foudre face aux Ténèbres/Spectre faibles. Pression amplifie le coût d'attaquer Mewtwo (+50 CT).

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| psychic (Psyko) | Psy | Spé | 90 | 100 | 10 | single r4 | STAB, −1 DéfSpé 10% |
| calm-mind (Plénitude) | Psy | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé |
| ice-beam (Laser Glace) | Glace | Spé | 90 | 100 | 10 | ligne r4 | Couverture |
| thunderbolt (Tonnerre) | Électrique | Spé | 90 | 100 | 15 | ligne r4 | Couverture |

Aucun nouveau move.

> **Power level Mewtwo** : décision validée — aucun override stats dans ce plan. Équilibrage différé à Phase 5 (balancer N matches headless).

---

### mew — Mew — Psy

**Rôle** : couteau suisse Psy (100/100/100/100/100/100). Synchro partage le statut majeur reçu avec l'attaquant (déjà implémenté). Pouvoir Antique +1 toutes stats à 10%. Machination setup AtqSpé +2.

| Move | Type | Cat | Puiss | Préc | PP | Pattern | Commentaire |
|---|---|---|---|---|---|---|---|
| psychic (Psyko) | Psy | Spé | 90 | 100 | 10 | single r4 | STAB |
| recover (Soin) | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| ancient-power (Pouvoir Antique) | Roche | Spé | 60 | 100 | 5 | single r1–4 | 10% +1 toutes stats |
| nasty-plot (Machination) | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé |

Aucun nouveau move. Transform/Métamorphe (canon Mew) reporté Phase 9.

---

## Nouveaux moves (8)

| ID | Nom FR canon | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effets |
|---|---|---|---|---|---|---|---|---|
| leech-life | Vampirisme | Insecte | Phys | 80 | 100 | 10 | `mêlée r1` | Damage + Drain 50% |
| mega-drain | Méga-Sangsue | Plante | Spé | 40 | 100 | 15 | `single r1–4` | Damage + Drain 50% |
| twineedle | Double Dard | Insecte | Phys | 25 | 100 | 20 | `mêlée` | Damage `hits: 2`, Status Poisoned chance ~36% cumulé |
| aerial-ace | Aéropique | Vol | Phys | 60 | 100 | 20 | `single r1–2` | Damage, **bypassAccuracy: true** (jamais raté) |
| feather-dance | Danse Plumes | Vol | Statut | — | 100 | 15 | `single r1–3` | StatChange Atk −2 cible |
| hyper-fang | Croc de Mort | Normal | Phys | 80 | 90 | 15 | `mêlée` | Damage |
| quiver-dance | Papillodanse | Insecte | Statut | — | — | 20 | `self` | StatChange SpA +1, SpD +1, Speed +1 |
| roost | Atterrissage | Vol | Statut | — | — | 10 | `self` | HealSelf 50% |

---

## Nouvelles abilities (5 réelles + 1 stub)

| ID | Nom FR canon | Description | Statut | Hook(s) |
|---|---|---|---|---|
| compound-eyes | Œil Composé | Précision ×1.3 sur tous les moves du porteur | ★ réel | `accuracyMultiplier: 1.3` (nouveau champ AbilityHandler) |
| swarm | Essaim | STAB Insecte ×1.5 quand HP ≤ 1/3 | ★ réel | `pinchBooster("swarm", Bug)` |
| water-veil | Ignifu-Voile | Bloque la Brûlure | ★ réel | `onStatusBlocked` Burn (pattern `limber`) |
| pressure | Pression | +50 CT à tout ennemi qui cible offensivement le porteur | ★ réel | `targetedCtBonus: 50` (nouveau champ AbilityHandler) |
| shield-dust | Suintement | Bloque les effets secondaires (status/stat-change `chance < 100`) des moves reçus | ★ réel | `onSecondaryEffectBlocked` (nouveau hook) |
| inner-focus | Attention | Bloquerait flinch | stub | aucun — mécanique flinch absente du core |

> **Note seaking** : a `swift-swim` (déjà stub depuis Batch C) — aucun changement nécessaire.
> **Note shield-dust** : nouveau hook nécessaire mais simple — voir section "Moves complexes" pour design.

---

## Moves complexes — décisions d'implémentation

### leech-life / mega-drain — EffectKind.Drain

Nouvelle mécanique core. Le handler `handle-drain.ts` :
1. Lit `context.shared.lastDamageDealt` (déjà set par `handle-damage.ts`).
2. Soigne l'attaquant pour `floor(lastDamageDealt × effect.fraction)`.
3. Émet `BattleEventType.HpRestored`.
4. Capé à `maxHp - currentHp` (pas d'over-heal).

Pattern miroir de `handle-recoil.ts` (qui *soustrait* au lieu de soigner).

```ts
// effect type
| { kind: typeof EffectKind.Drain; fraction: number }

// override
"leech-life": {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [
    { kind: EffectKind.Damage },
    { kind: EffectKind.Drain, fraction: 0.5 },
  ],
},
```

**Important** : ordre dans `effects: [Damage, Drain]` — le handler Drain dépend de `shared.lastDamageDealt`. Vérifier que l'`effect-processor.ts` itère les effets dans l'ordre (déjà le cas pour recoil).

### twineedle — multi-hit avec Status par hit

Twineedle = 2 hits indépendants, chaque hit a 20% de poison. Le système actuel supporte `Damage{hits: 2}` mais la `Status` chance est globale, pas par-hit.

**Décision** : utiliser `Damage{hits: 2}` + `Status{Poisoned, chance: 36}` (probabilité cumulative qu'au moins un hit empoisonne = 1 − 0.8² = 0.36). Approximation acceptable.

Alternative (rejetée) : ajouter `perHitChance` au système Status — sur-ingénierie pour 1 move.

### aerial-ace — toujours touche

Le move doit ignorer l'accuracy roll. Options :
- **A. Nouveau flag** `ignoreAccuracy?: boolean` sur `MoveDefinition`, vérifié au début de `checkAccuracy`. Lourd pour 1 move.
- **B. Accuracy synthétique élevée** : déclarer `accuracy: 100` (qui dans `checkAccuracy` line 29-31 `if (effectiveAccuracy >= 100) return true;` retourne true... sauf si l'attaquant a malus Précision).
- **C. Solution canon** : flag `bypassAccuracy: true` + early-return dans `checkAccuracy` avant calcul des stages.

**Recommandé : C** — sémantique propre, réutilisable par futurs moves (swift, magical-leaf). Ajout minimal : 1 ligne dans `checkAccuracy`, 1 flag dans `MoveDefinition`/`TacticalOverride`.

### feather-dance — −2 Atk single target

Réutilise pattern `growl` (existant ? à vérifier) ou similaire. Si pas d'existant : nouvelle entrée triviale.

```ts
"feather-dance": {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Attack, stages: -2, target: EffectTarget.Targets },
  ],
  effectTier: EffectTier.MajorBuff,
},
```

### quiver-dance — triple buff self

Pas de `EffectTier.TripleBuff` — utiliser `MajorBuff` (équivalent narratif). 3 StatChange `target: Self`.

### roost — HealSelf 50%

Identique à `recover` mécaniquement, type différent (Vol). Réutilise pattern `recover`.

### compound-eyes — accuracy multiplier

Nouveau champ `accuracyMultiplier?: number` sur `AbilityHandler`. Application dans `checkAccuracy` :

```ts
// après accuracyMultiplier = getStatMultiplier(accuracyStages);
const abilityAccBonus = abilityRegistry?.getForPokemon(attacker)?.accuracyMultiplier ?? 1;
const effectiveAccuracy = (move.accuracy * accuracyMultiplier * abilityAccBonus) / evasionMultiplier;
// PUIS clamp >= 100 → guaranteed hit
```

**Ordre** : multiplier appliqué AVANT le clamp `>= 100`. Donc Poudre Dodo (75) × Œil Composé (1.3) = 97.5 → reste sous le clamp, jet de probabilité standard.

`checkAccuracy` doit recevoir l'`abilityRegistry`. Vérifier la signature — propager depuis BattleEngine.

### pressure — +50 CT sur attaquants ciblants

Nouveau champ `targetedCtBonus?: number` sur `AbilityHandler` (statique, comme `blocksRecoil`).

**Lieu d'application** : `BattleEngine` au moment où l'action CT cost est calculé (après `computeMoveCost`, avant `computeCtActionCost`). Si l'action est offensive (move a au moins un effet `Damage` ou `Drain`) ET au moins une cible a `targetedCtBonus`, sommer les bonus et ajouter au `moveCost`.

```ts
// pseudo
const isOffensive = move.effects.some(e =>
  e.kind === EffectKind.Damage || e.kind === EffectKind.Drain
);
let pressureBonus = 0;
if (isOffensive) {
  for (const target of resolvedTargets) {
    const ability = abilityRegistry?.getForPokemon(target);
    if (ability?.targetedCtBonus && target !== attacker) {
      pressureBonus += ability.targetedCtBonus;
    }
  }
}
const finalMoveCost = computeMoveCost(...) + pressureBonus;
```

**Cas limites** :
- AoE (zone/cône/slash) : bonus cumulé par cible Pression dans la zone. Probable max 1 cible (rare de stacker 2 légendaires), mais possible.
- Self-target (recover, etc.) : pas offensif → 0 bonus.
- Drain : compté comme offensif (inflige dégâts).

### shield-dust — bloque effets secondaires

Nouveau hook `onSecondaryEffectBlocked?: (context) => BlockResult` sur `AbilityHandler`.

**Définition "effet secondaire"** : tout effet `Status` ou `StatChange` avec `chance < 100` ET `target !== Self`. Exemples :
- Lance-Flammes Brûl 10% → bloqué
- Tonnerre Para 10% → bloqué
- Bomb-Beurk Poison 30% → bloqué
- Poudre Dodo Sommeil 75% → **PAS bloqué** (effet principal du move, target = Targets mais c'est l'unique effet)

**Règle** : si le move a au moins un effet `Damage`/`Drain` ET aussi un effet `Status`/`StatChange` avec `chance < 100`, le second est l'effet secondaire → bloqué.

Application dans `effect-processor.ts` : avant d'appliquer un effet sur une cible, vérifier `target.abilityId` → si shield-dust, et que l'effet match la définition secondaire → skip + émettre `AbilityActivated` event.

```ts
const shieldDust: AbilityHandler = {
  id: "shield-dust",
  onSecondaryEffectBlocked: (context) => {
    if (context.isSecondaryEffect) {
      return {
        blocked: true,
        events: [{ type: BattleEventType.AbilityActivated, ... }],
      };
    }
    return { blocked: false, events: [] };
  },
};
```

### inner-focus — stub

Enregistré dans `ability-definitions.ts` avec `id` seul (pas de hooks). Permet :
- Affichage InfoPanel du nom de l'ability.
- Pas d'effet runtime (flinch non implémenté).

Commentaire `// stub Phase 9 — TODO: flinch mechanic`.

---

## Nouvelle mécanique core

### EffectKind.Drain

**Fichiers à modifier (core)** :

1. `packages/core/src/enums/effect-kind.ts` : ajouter `Drain: "drain"`.
2. `packages/core/src/types/effect.ts` : ajouter union `| { kind: typeof EffectKind.Drain; fraction: number }`.
3. `packages/core/src/battle/handlers/handle-drain.ts` (nouveau fichier) : handler symétrique à `handle-recoil.ts`.
4. `packages/core/src/battle/effect-handler-registry.ts` : register Drain handler.

**Tests core** :
- `handle-drain.test.ts` : drain 50% sur 80 dégâts → +40 HP attaquant ; cap maxHp ; pas de soin si lastDamageDealt = 0.
- `leech-life.integration.test.ts` : Golbat attaque Pidgeot, soigne sur dégâts effectifs.
- `mega-drain.integration.test.ts` : Seaking vs Geodude (super-efficace × type Plante), vérifier soin sur dégâts amplifiés.

### AbilityHandler.accuracyMultiplier

**Fichiers à modifier (core)** :

1. `packages/core/src/types/ability-definition.ts` : ajouter `accuracyMultiplier?: number` à `AbilityHandler`.
2. `packages/core/src/battle/accuracy-check.ts` : propager `abilityRegistry`, appliquer le multiplier AVANT le clamp ≥100.
3. Mettre à jour signatures appelantes (`BattleEngine.use-move.ts` etc.).

**Tests** :
- `accuracy-check.test.ts` : `compound-eyes` avec move accuracy 75 → effective 97.5.
- `compound-eyes.integration.test.ts` : Papilusion Poudre Dodo (75%) → ratio observé en mock random.

### AbilityHandler.targetedCtBonus

**Fichiers à modifier (core)** :

1. `packages/core/src/types/ability-definition.ts` : ajouter `targetedCtBonus?: number` à `AbilityHandler`.
2. `packages/core/src/battle/BattleEngine.ts` : appliquer le bonus dans le pipeline action-cost (après computeMoveCost, avant computeCtActionCost). Logique : si move offensif (a Damage/Drain) et au moins une cible a Pression → ajouter `targetedCtBonus` au cost.
3. Helper interne `computeTargetedCtBonus(move, targets, abilityRegistry)` exporté pour testabilité.

**Tests** :
- `ct-costs.test.ts` : Pression seule ajoute 50 au moveCost si attaque offensive ciblante.
- `pressure.integration.test.ts` : Mewtwo subit Psyko ennemi → CT enemy +50 vs Pokemon normal.
- AoE multi-cible : 2 Pression dans la zone = +100 (vérifier empilement).

### AbilityHandler.onSecondaryEffectBlocked

**Fichiers à modifier (core)** :

1. `packages/core/src/types/ability-definition.ts` : ajouter le hook + interface `SecondaryEffectBlockContext`.
2. `packages/core/src/battle/effect-processor.ts` : avant d'appliquer un effet, identifier s'il est "secondaire" (heuristique : effect avec `chance < 100` ET move a au moins un Damage/Drain ailleurs), invoquer le hook target.
3. Helper `isSecondaryEffect(effect, allEffects): boolean`.

**Tests** :
- `shield-dust.test.ts` : Aéromite subit Lance-Flammes → Brûl bloquée mais dégâts passent.
- `shield-dust.test.ts` : Aéromite subit Tonnerre Para 10% → Para bloquée mais dégâts passent.
- `shield-dust.test.ts` : Aéromite subit Poudre Dodo Sommeil 75% → Sommeil PASSE (effet principal, pas secondaire).
- `shield-dust.test.ts` : Aéromite subit Toxic Poison 100% → Poison PASSE (chance = 100%).

---

## Étapes d'implémentation

### Étape 0 — Vérifications pré-implémentation

Confirmer la présence des moves "existants" listés dans les movesets :
```bash
for m in psybeam gust poison-sting swords-dance poison-fang wing-attack quick-attack air-slash crunch drill-peck agility confuse-ray sludge-bomb slash leaf-blade waterfall aqua-tail blizzard ice-beam thunderbolt discharge flamethrower fire-blast lava-plume psychic calm-mind recover ancient-power nasty-plot sleep-powder; do
  grep -q "\"$m\"\\|^  $m:" packages/data/src/overrides/tactical.ts && echo "✓ $m" || echo "✗ $m MANQUANT"
done
```

### Étape 1 — Core : EffectKind.Drain

**Pre-flight obligatoire** : vérifier que `effect-processor.ts` itère les effets dans l'ordre de déclaration. Test rapide : lire la fonction principale, confirmer que `for (const effect of move.effects)` (ou équivalent) parcourt le tableau dans l'ordre. Si non, refactorer AVANT d'écrire le handler Drain.

1. Ajouter `Drain` à `effect-kind.ts`.
2. Étendre `Effect` union avec `{ kind: typeof EffectKind.Drain; fraction: number }`.
3. Créer `handle-drain.ts` (miroir de `handle-recoil.ts`, soigne au lieu de damage). Lit `context.shared.lastDamageDealt`.
4. Enregistrer dans `effect-handler-registry.ts`.
5. Tests unitaires `handle-drain.test.ts` : drain 50% sur 80 dégâts → +40 HP ; cap maxHp ; pas de soin si lastDamageDealt = 0.

### Étape 2 — Core : AbilityHandler.accuracyMultiplier

1. Ajouter le champ optionnel à `ability-definition.ts`.
2. Adapter `checkAccuracy` (signature + application). Multiplier appliqué AVANT clamp ≥100.
3. Mettre à jour les appelants (`BattleEngine.ts`, tests).
4. Test unitaire dans `accuracy-check.test.ts`.

### Étape 3 — Core : AbilityHandler.targetedCtBonus (Pression)

1. Ajouter le champ optionnel à `ability-definition.ts`.
2. Dans `BattleEngine.ts`, identifier le point où l'action cost est composé. Avant `computeCtActionCost`, ajouter le bonus Pression.
3. Helper `computeTargetedCtBonus(move, targets, abilityRegistry)` exporté.
4. Tests `ct-costs.test.ts` + `pressure.integration.test.ts`.

### Étape 4 — Core : MoveDefinition.bypassAccuracy (Aéropique)

1. Ajouter `bypassAccuracy?: boolean` à `MoveDefinition` + à `TacticalOverride`.
2. Early-return dans `checkAccuracy` si `move.bypassAccuracy === true` (avant tout calcul, après l'early-return LockedOn).
3. Test unitaire : move avec bypass + attaquant Jet de Sable 6 stages cumulés → toujours hit.

### Étape 5 — Core : AbilityHandler.onSecondaryEffectBlocked (Suintement)

1. Ajouter le hook à `ability-definition.ts` + interface `SecondaryEffectBlockContext`.
2. Helper `isSecondaryEffect(effect, allEffects): boolean` dans `effect-processor.ts`.
3. Dans `effect-processor.ts`, avant d'appliquer un effet sur une cible, vérifier le hook si effet secondaire.
4. Tests `shield-dust.test.ts` (4 cas : Brûl bloquée, Para bloquée, Sommeil-principal passe, Poison-100% passe).

### Étape 6 — Data : nouvelles abilities

`packages/data/src/abilities/ability-definitions.ts` :
- `compound-eyes` : `{ id: "compound-eyes", accuracyMultiplier: 1.3 }`.
- `swarm` : `pinchBooster("swarm", PokemonType.Bug)`.
- `water-veil` : pattern `limber` mais bloque `StatusType.Burned`.
- `pressure` : `{ id: "pressure", targetedCtBonus: 50 }`.
- `shield-dust` : implémentation `onSecondaryEffectBlocked` hook (voir section design).
- `inner-focus` : stub `{ id: "inner-focus" }` + commentaire TODO flinch.

### Étape 7 — Data : nouveaux moves (tactical.ts)

Ajouter 8 entrées :
- `leech-life` (Drain, mêlée r1)
- `mega-drain` (Drain, single r1–4)
- `twineedle` (hits:2 + Poison 36%)
- `aerial-ace` (single r1–2 + `bypassAccuracy: true`)
- `feather-dance` (StatChange Atk −2 target)
- `hyper-fang` (Damage simple, mêlée)
- `quiver-dance` (3 StatChange self)
- `roost` (HealSelf 0.5)

### Étape 8 — Data : roster (roster-poc.ts)

Ajouter 14 entrées dans l'ordre Pokédex (positions insérées entre Pokemon existants par numéro). Vérifier que `dexNumber` est bien défini dans la reference pour les 14.

### Étape 9 — Data : i18n + locales renderer

- `pokemon-names.fr.json` + `pokemon-names.en.json` : 14 noms FR canon (Papilusion, Dardargnan, Roucarnage, Rattatac, Rapasdepic, Nosferalto, Aéromite, Canarticho, Poissoroy, Artikodin, Électhor, Sulfura, Mewtwo, Mew).
- `moves.fr.json` + `moves.en.json` : 8 nouveaux moves déjà présents pour la FR (Vampirisme, Méga-Sangsue, Double Dard, Aéropique, Danse Plumes, Croc de Mort, Papillodanse, Atterrissage). Vérifier EN.
- `packages/renderer/src/i18n/fr.ts` + `en.ts` : ajouter clés Pokemon + nouvelles abilities (Œil Composé, Essaim, Ignifu-Voile, Pression, Suintement, Attention).

### Étape 10 — Sprites

Ajouter 14 entrées dans `sprite-config.json` puis :
```bash
pnpm extract-sprites
```

Confirmer les 14 sprites téléchargés. Pokemon volants sans anim dédiée → fallback animation Hop (selon mémoire `feedback_flying_animation_fallback`).

### Étape 11 — Tests

| Fichier | Test minimal |
|---|---|
| `handle-drain.test.ts` | Drain 50% sur 80 dégâts → +40 HP, cap maxHp |
| `leech-life.test.ts` | Nosferalto attaque, soigne 50% des dégâts |
| `mega-drain.test.ts` | Poissoroy soigne via Plante super-efficace |
| `twineedle.test.ts` | 2 hits + chance poison cumulée |
| `aerial-ace.test.ts` | Hit garanti même avec Jet de Sable stacké |
| `feather-dance.test.ts` | −2 Atk sur cible |
| `hyper-fang.test.ts` | Dégâts Normal STAB |
| `quiver-dance.test.ts` | +1 AtqSpé/DéfSpé/Vit self |
| `roost.test.ts` | Soin 50% maxHp |
| `compound-eyes.test.ts` | Papilusion Poudre Dodo accuracy ×1.3 |
| `swarm.test.ts` | Dardargnan HP ≤ 33% → STAB Insecte ×1.5 |
| `water-veil.test.ts` | Poissoroy immunisé Brûlure |
| `pressure.test.ts` | Mewtwo subit move offensif → +50 CT attaquant |
| `shield-dust.test.ts` | Aéromite : Brûl/Para bloquées, Sommeil principal passe |

### Étape 12 — Golden replay + validation

1. Régénérer `golden-replay.json` (`pnpm run regen-replay` ou équivalent).
2. Sandbox : tester chaque nouveau Pokemon manuellement (4 moves, ability déclarée).
3. Vérifier checklist post-batch (memory `project_batch_checklist`) :
   - Moves disponibles en sandbox
   - Limite 4 moves OK
   - Noms FR corrects (canon)
   - Ordre Pokédex respecté
   - Icônes statut affichées
   - Floating text abilities (Œil Composé, Essaim, Pression activations)

### Étape 13 — Gate CI + chain agents

```bash
pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration
```

Puis chain : `core-guardian` → `code-reviewer` → `doc-keeper` → proposer `visual-tester` → `commit-message`.

---

## Décisions tranchées (2026-05-12)

1. **Légendaires balance** ✓ → pas d'override stats, équilibrage Phase 5 (balancer N matches headless). Mewtwo arrive avec 154 AtqSpé brut.
2. **Pression** ✓ → implémentation réelle : `targetedCtBonus: 50` sur 4 légendaires. Pattern statique sur AbilityHandler.
3. **Roucarnage moveset** ✓ → swap wing-attack → aerial-ace pour différenciation vs Roucoul.
4. **Vampirisme Nosferalto** ✓ → portée mêlée r1 (1 case devant).
5. **Noms FR canon** ✓ → vérifiés dans `moves.fr.json` : Vampirisme, Méga-Sangsue, Double Dard, Aéropique, Danse Plumes, Croc de Mort, Papillodanse, Atterrissage.

## Décisions tranchées pendant rédaction

6. **Drain — ordre des effets** : `effects: [Damage, Drain]` itéré dans l'ordre déclaration. Pre-flight Étape 1 vérifie `effect-processor.ts`.
7. **Aéropique bypass** : flag dédié `MoveDefinition.bypassAccuracy` (propre, réutilisable).
8. **Double Dard poison** : approximation 36% cumulée (pas de `perHitChance`).
9. **Suintement implémentation réelle** : nouveau hook `onSecondaryEffectBlocked` (pas un stub). Définition « secondaire » = `chance < 100` ET le move a au moins un autre effet Damage/Drain.
10. **Attention (inner-focus) stub** : pas de flinch dans le core, stub honnête avec TODO Phase 9.
11. **Mew Transform** : reporté Phase 9 (= Ditto). Moveset alt : Psyko/Soin/Pouvoir Antique/Machination.
12. **Ditto** : exclu Batch E. Reporté Phase 9 ou plan dédié.
13. **Stats légendaires HP** : pas d'override. Mewtwo HP 106 (~234 niv 50), Trio Légendaire 90 (~212).
14. **Aéropique vs LockedOn** : early-return `bypassAccuracy` placé APRÈS l'early-return `LockedOn` dans `checkAccuracy` (pas de double-consommation).

---

## Risques

- **Drain bug cumulatif** : si l'ordre Damage/Drain n'est pas respecté, leech-life soignera 0. Tester en priorité.
- **compound-eyes ×1.3 vs evasion** : Butterfree sleep-powder + evasion ennemie −2 stages = précision effective. Vérifier que le multiplier s'applique AVANT le clamp 100%.
- **bypass-accuracy collision** : si un futur move `lock-on` (qui force hit via volatile) combiné avec `bypassAccuracy` provoque double-consommation. Vérifier l'early-return dans `checkAccuracy`.
- **Légendaires power creep** : Mewtwo AtqSpé 154 + Psychic STAB = OHKO probable sur tank moyen niv 50. À surveiller en playtest, override si nécessaire en Phase 5.
- **Golbat leech-life mêlée** : range 1 limite l'auto-soin. Vérifier que le pattern n'est pas trop faible. Alternative : range r1–2 (slash) — à trancher en playtest.
- **Roost type Vol** : roost soigne mais retire temporairement le type Vol dans le jeu canon. Mécanique non implémentée — ignoré dans ce plan (stub Phase 9 si besoin).
- **Replay golden** : ajout de 14 Pokemon modifie sélection random. Régénérer.
- **Sprites manquants** : si PMDCollab n'a pas tous les sprites (Mewtwo OK, Mew OK, mais petits Pokemon non-finaux moins probable problème). Fallback acceptable.

---

## Dépendances

- Plan 078 DONE — réutilise `EffectTier`, `TacticalOverride`, `AbilityHandler`, `RosterEntry`, hook `onAfterDamageDealt`.
- `shared.lastDamageDealt` (ajouté plan 078) : crucial pour le handler Drain.
- `pinchBooster()` utility (déjà existant) : utilisé par swarm.
- `pattern limber` (déjà existant) : modèle pour water-veil.

---

## Critères de complétion

- [ ] 14 Pokemon présents dans `roster-poc.ts` (ordre Pokédex)
- [ ] 8 nouveaux moves dans `tactical.ts`
- [ ] 6 nouvelles abilities dans `ability-definitions.ts` (5 réelles + 1 stub)
- [ ] 1 nouveau `EffectKind.Drain` + `handle-drain.ts` + tests
- [ ] 2 nouveaux champs AbilityHandler : `accuracyMultiplier`, `targetedCtBonus`
- [ ] 1 nouveau hook AbilityHandler : `onSecondaryEffectBlocked`
- [ ] 1 nouveau flag `MoveDefinition.bypassAccuracy`
- [ ] 14+ fichiers `*.test.ts` (8 moves + 5 abilities réelles + drain handler)
- [ ] Sprites Batch E téléchargés via PMDCollab (14 Pokemon)
- [ ] i18n FR/EN à jour (Pokemon + moves canon + nouvelles abilities)
- [ ] `docs/implementations.md` : compteurs Pokemon/moves/abilities mis à jour
- [ ] `README.md#Progression` : roster 67 → 81
- [ ] `docs/next.md` : Batch E déplacé en "Fait récemment", Team Builder devient priorité
- [ ] Golden replay régénéré
- [ ] Gate CI verte
- [ ] Checklist post-batch validée en sandbox (6 points)

---

## Fichiers à modifier

### Core (nouvelles mécaniques)

- `packages/core/src/enums/effect-kind.ts` — ajout `Drain`
- `packages/core/src/types/effect.ts` — union Drain
- `packages/core/src/battle/handlers/handle-drain.ts` — **nouveau**
- `packages/core/src/battle/handlers/handle-drain.test.ts` — **nouveau**
- `packages/core/src/battle/effect-handler-registry.ts` — register Drain
- `packages/core/src/types/ability-definition.ts` — champs `accuracyMultiplier`, `targetedCtBonus`, hook `onSecondaryEffectBlocked` + `SecondaryEffectBlockContext`
- `packages/core/src/types/move-definition.ts` — flag `bypassAccuracy`
- `packages/core/src/battle/accuracy-check.ts` — apply multiplier + bypass (avec ordre LockedOn → bypassAccuracy → calcul standard)
- `packages/core/src/battle/accuracy-check.test.ts` — tests compound-eyes + bypass
- `packages/core/src/battle/BattleEngine.ts` — apply `targetedCtBonus` au moveCost
- `packages/core/src/battle/ct-costs.test.ts` — tests Pression
- `packages/core/src/battle/effect-processor.ts` — helper `isSecondaryEffect` + hook `onSecondaryEffectBlocked`

### Data

- `packages/data/src/roster/roster-poc.ts` — 14 entrées
- `packages/data/src/overrides/tactical.ts` — 8 nouveaux moves
- `packages/data/src/abilities/ability-definitions.ts` — 6 nouvelles abilities
- `packages/data/src/i18n/pokemon-names.fr.json` — 14 noms
- `packages/data/src/i18n/pokemon-names.en.json` — 14 noms
- `packages/data/src/i18n/moves.fr.json` — 8 moves (vérifier)
- `packages/data/src/i18n/moves.en.json` — 8 moves (vérifier)
- `packages/renderer/src/i18n/fr.ts` — labels
- `packages/renderer/src/i18n/en.ts` — labels

### Sprites

- `tools/sprites/sprite-config.json` — 14 entrées
- (généré) `public/sprites/...` via `pnpm extract-sprites`

### Tests intégration

- `packages/core/src/battle/moves/leech-life.test.ts`
- `packages/core/src/battle/moves/mega-drain.test.ts`
- `packages/core/src/battle/moves/twineedle.test.ts`
- `packages/core/src/battle/moves/aerial-ace.test.ts`
- `packages/core/src/battle/moves/feather-dance.test.ts`
- `packages/core/src/battle/moves/hyper-fang.test.ts`
- `packages/core/src/battle/moves/quiver-dance.test.ts`
- `packages/core/src/battle/moves/roost.test.ts`
- `packages/core/src/abilities/compound-eyes.test.ts`
- `packages/core/src/abilities/swarm.test.ts`
- `packages/core/src/abilities/water-veil.test.ts`
- `packages/core/src/abilities/pressure.test.ts`
- `packages/core/src/abilities/shield-dust.test.ts`

### Docs

- `docs/implementations.md` — ✗→✓ Pokemon/moves/abilities, compteurs
- `README.md` — Progression
- `docs/next.md` — Batch E → fait récemment
- `docs/plans/README.md` — entrée 079
- `STATUS.md` — fin Phase 4 roster Gen 1 complet
