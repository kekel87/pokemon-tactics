# Plan 075 — Roster Batch A (12 Pokemon finaux) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Ajouter 12 Pokemon finaux Gen 1 au roster jouable. Stratégie : movesets curés 6-8 moves tactiques + abilities intéressantes seulement. Les formes intermédiaires (Reptincel, Herbizarre, etc.) restent dans les données mais ne sont plus exposées dans le mini/TeamSelect à partir de cette phase.

---

## Pokemon — Batch A

| N° | ID | Nom FR | Types | Ability | Moveset |
|---|---|---|---|---|---|
| 003 | venusaur | Florizarre | Plante/Poison | overgrow ✓ | razor-leaf, leech-seed, sleep-powder, sludge-bomb, petal-blizzard*, synthesis*, growth* |
| 006 | charizard | Dracaufeu | Feu/Vol | blaze ✓ | flamethrower, wing-attack, dragon-breath, fire-blast*, flare-blitz*, dragon-claw*, air-slash* |
| 009 | blastoise | Tortank | Eau | torrent ✓ | water-gun, bubble-beam, withdraw, iron-defense, surf*, hydro-pump*, ice-beam* |
| 026 | raichu | Raichu | Électrique | lightning-rod** | thunderbolt, thunder-wave, volt-tackle, agility, thunder*, iron-tail*, brick-break* |
| 065 | alakazam | Alakazam | Psy | magic-guard** | confusion, calm-mind, kinesis, psybeam, psychic*, recover*, shadow-ball* |
| 068 | machamp | Mackogneur | Combat | no-guard** | karate-chop, seismic-toss, bulk-up, rock-smash, dynamic-punch*, close-combat*, brick-break* |
| 130 | gyarados | Léviator | Eau/Vol | moxie** | bite, hyper-beam, waterfall*, crunch*, dragon-dance*, aqua-tail* |
| 143 | snorlax | Ronflex | Normal | thick-fat ✓ | body-slam, hyper-beam, headbutt, rest*, amnesia*, crunch* |
| 149 | dragonite | Dracolosse | Dragon/Vol | multiscale** | dragon-breath, wing-attack, agility, dragon-claw*, dragon-dance*, outrage*, extreme-speed* |
| 134 | vaporeon | Aquali | Eau | water-absorb** | water-gun, bite, quick-attack, surf*, hydro-pump*, ice-beam*, acid-armor* |
| 136 | flareon | Pyroli | Feu | flash-fire** | flamethrower, flame-wheel, bite, agility, fire-blast*, flare-blitz*, lava-plume* |
| 135 | jolteon | Voltali | Électrique | volt-absorb** | thunderbolt, thunder-wave, quick-attack, agility, thunder*, shadow-ball*, charge-beam* |

`✓` = ability déjà implémentée — `**` = nouvelle ability — `*` = nouveau move

---

## Nouveaux moves (27)

Moves déjà implémentés réutilisés librement (body-slam, bite, flamethrower, wing-attack, etc.).

### Plante (1)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| petal-blizzard | Tempête Florale | Plante | Phys | 90 | 100 | 15 | zone r2 | Friendly fire |
| synthesis | Synthèse | Normal | Statut | — | — | 5 | self | Soigne 50% PV max (météo : voir Phase 9) |
| growth | Croissance | Plante | Statut | — | — | 20 | self | +1 Atk, +1 AtqSpé |

### Feu (2)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| fire-blast | Déflagration | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | Brûlure 10% |
| flare-blitz | Tunnel de Flammes | Feu | Phys | 120 | 100 | 15 | dash r3 | Brûlure 10%, recul 1/3 PV |
| lava-plume | Éruption | Feu | Spé | 80 | 100 | 15 | zone r1 | Brûlure 30%, friendly fire |

### Dragon (2)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| dragon-claw | Draco-Griffe | Dragon | Phys | 80 | 100 | 15 | mêlée | |
| dragon-dance | Danse Draco | Dragon | Statut | — | — | 20 | self | +1 Atk, +1 Vit |

### Vol (1)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| air-slash | Tranche-Air | Vol | Spé | 75 | 95 | 15 | slash | Flinch 30% |

### Eau (4)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| surf | Surf | Eau | Spé | 90 | 100 | 15 | zone r2 | Friendly fire |
| hydro-pump | Hydrocanon | Eau | Spé | 110 | 80 | 5 | ligne r4 | |
| waterfall | Cascade | Eau | Phys | 80 | 100 | 15 | dash r3 | Flinch 20% |
| aqua-tail | Aqua-Queue | Eau | Phys | 90 | 90 | 10 | mêlée | |

### Glace (1)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| ice-beam | Lance-Glace | Glace | Spé | 90 | 100 | 10 | ligne r4 | Gel 10% |

### Électrique (3)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| thunder | Tonnerre Vrai | Électrique | Spé | 110 | 70 | 10 | single r4 | Para 30% |
| iron-tail | Queue de Fer | Acier | Phys | 100 | 75 | 15 | mêlée | −1 Déf 30% |
| charge-beam | Rayon Chargé | Électrique | Spé | 50 | 90 | 10 | ligne r3 | +1 AtqSpé 70% |

### Psy (4)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| psychic | Psyko | Psy | Spé | 90 | 100 | 10 | single r4 | −1 DéfSpé 10% |
| recover | Soin | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| rest | Repos | Psy | Statut | — | — | 5 | self | Soigne 100% PV max + Sommeil 2 tours |
| amnesia | Amnésie | Psy | Statut | — | — | 20 | self | +2 DéfSpé |

### Combat (3)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| dynamic-punch | Dynamopoing | Combat | Phys | 100 | 50 | 5 | mêlée | Confusion 100% (acc parfaite avec No-Guard) |
| close-combat | Close Combat | Combat | Phys | 120 | 100 | 5 | mêlée | −1 Déf, −1 DéfSpé attaquant après |
| brick-break | Casse-Brique | Combat | Phys | 75 | 100 | 15 | mêlée | |

### Spectre / Ténèbres (2)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| shadow-ball | Ball'Ombre | Spectre | Spé | 80 | 100 | 15 | single r4 | −1 DéfSpé 20% |
| crunch | Mâchouille | Ténèbres | Phys | 80 | 100 | 15 | mêlée | −1 Déf 20% |

### Dragon offensif (1)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| outrage | Colère | Dragon | Phys | 120 | 100 | 10 | mêlée | Confusion attaquant après (auto-appliquée, 100%) |

### Normal utilitaire (2)
| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | Effet |
|---|---|---|---|---|---|---|---|---|
| extreme-speed | Vitesse Extrême | Normal | Phys | 80 | 100 | 5 | dash r2 | |
| acid-armor | Armure Acide | Poison | Statut | — | — | 20 | self | +2 Déf |

---

## Nouvelles abilities (8)

| ID | Nom FR | Trigger | Effet |
|---|---|---|---|
| lightning-rod | Para-Foudre | `onMoveLock` + `onDamageModify` | Attirer attaques Électrique adjacentes vers soi (redirect) + immunité Électrique + +1 AtqSpé si Électrique reçu |
| magic-guard | Garde Magique | `onIndirectDamage` | Bloque tous dégâts indirects (brûlure, poison, vampigraine, terrain magma/marais, recul Life Orb) |
| no-guard | Aucun Garde | `onAccuracyCheck` | Toutes les attaques envoyées ET reçues ont 100% précision |
| moxie | Macho | `onKO` | +1 Atk quand le porteur met un ennemi KO |
| multiscale | Multiécaille | `onDamageModify` | Divise par 2 les dégâts reçus si PV max du porteur |
| water-absorb | Absorb'Eau | `onDamageModify` | Immunité Eau + soigne +25% PV max si touché par move Eau |
| flash-fire | Torche | `onDamageModify` | Immunité Feu + +1 stage Feu interne (×1.5 dégâts Feu) si touché par move Feu |
| volt-absorb | Absorb'Volt | `onDamageModify` | Immunité Électrique + soigne +25% PV max si touché par move Électrique |

### Notes d'implémentation abilities

**lightning-rod** : **Batch A = immunité Électrique + +1 SpAtk + soin 25% PV** via `onDamageModify` (même pattern que water-absorb/volt-absorb). Redirect (force ennemi à cibler le porteur) → décision #XXX, implémentée dans un plan dédié ultérieur. Sans redirect, lightning-rod est fonctionnellement water-absorb Électrique + boost SpAtk.

**no-guard** : hook `onAccuracyCheck` — override accuracy à `null` (toujours touche). S'applique aussi aux moves adverses ciblant le porteur. dynamic-punch (50% acc) avec no-guard → 100%.

**multiscale** : `onDamageModify` — check `pokemon.hp === pokemon.maxHp`, si vrai `damage = Math.floor(damage / 2)`.

**flash-fire / water-absorb / volt-absorb** : même pattern. `onDamageModify` — si type match → `blocked: true` + `events: [HpRestored]`. Flash-fire ajoute aussi un modifier interne (`flashFireActive`) boostant STAB Feu.

---

## Suppression des formes non-finales du mini

Retirer du roster les Pokemon dont une évolution Gen 1 existe : `bulbasaur`, `charmander`, `squirtle`, `pidgey`, `pikachu`, `sandshrew`, `nidoran-m`, `jigglypuff`, `tentacool`, `geodude`, `magnemite`, `abra`, `machop`, `seel`, `gastly`, `growlithe`, `meowth`, `eevee`.

Les Pokemon retirés restent dans `packages/data/reference/pokemon.json` — non exposés dans `rosterPoc` jusqu'au Team Builder.

---

## Étapes d'implémentation

### Étape 1 — Nouveaux moves dans `tactical.ts`
Ajouter les 27 entrées dans `packages/data/src/overrides/tactical.ts`. Pattern par move selon table ci-dessus.

**effectTier à appliquer dans tactical.ts** (pour le système CT) :
- `dragon-dance` → `DoubleBuff` (même que bulk-up / calm-mind)
- `growth` → `DoubleBuff`
- `amnesia` → `MajorBuff` (+2 = major)
- `acid-armor` → `MajorBuff`

Moves avec effets spéciaux à implémenter dans le core :
- **rest** : applique `sleep` au porteur (2 tours) + soigne HP max. Hook `onMoveUsed`.
- **close-combat** : après dégâts, -1 Def -1 SpDef attaquant. Effet `SelfStatChange`.
- **outrage** : après dégâts, applique `confusion` à l'attaquant (100%). Effet identique à la mécanique confusion existante.
- **flare-blitz** : après dégâts, recul 1/3 HP max attaquant. Même mécanique que Life Orb (déjà dans core via `HpLost` event).
- **extreme-speed** : dash r2 normal, aucun effet spécial — vitesse représentée par le pattern dash.
- **charge-beam** : après dégâts, 70% chance +1 SpAtk attaquant.

### Étape 2 — Nouvelles abilities dans `ability-definitions.ts`
Ajouter les 8 handlers dans `packages/data/src/abilities/ability-definitions.ts`.

### Étape 3 — Roster
Modifier `packages/data/src/roster/roster-poc.ts` :
- Retirer formes non-finales (liste ci-dessus, décision Évoli à valider)
- Ajouter les 12 nouvelles entrées

### Étape 4 — Tests
Pour chaque nouvelle mécanique non triviale :
- **rest** : tester sleep + heal, interaction Early Bird
- **close-combat** : tester -def -spdef self
- **outrage** : tester confusion auto
- **flare-blitz** : tester recul
- **no-guard + dynamic-punch** : tester 100% confusion
- **multiscale** : tester demi-dégâts à PV max, dégâts normaux sinon
- **flash-fire / water-absorb / volt-absorb** : tester immunité + heal
- **moxie** : tester +1 Atk sur KO
- **magic-guard** : tester immunité poison/brûlure/vampigraine

### Étape 5 — Sprites
Vérifier présence sprites PMDCollab pour les 12 Pokemon.
Voir `docs/implementations.md` section PMDCollab pour status.
Flying types (charizard, gyarados, dragonite) → fallback Walk si FlapAround absent.

### Étape 6 — Gate CI + doc
`pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
Mettre à jour `docs/implementations.md` (12 Pokemon ✓, moves, abilities).

---

## Décisions à trancher

1. **Multiscale + dragon-dance** : accepté en l'état — surveiller en sandbox. Documenter décision #XXX.

> **Résolu (Batch A)** — lightning-rod : immunité + +1 SpAtk + soin, sans redirect. Redirect → plan dédié ultérieur.

---

## Risques

- **rest** : nouveau mécanisme sleep-auto. Vérifier interaction avec `own-tempo` (Tempo Perso ne bloque pas rest, c'est un sleep volontaire).
- **no-guard** : s'assure que l'override accuracy s'applique aussi quand ennemi cible le porteur, pas seulement quand le porteur attaque.
- **outrage** : confusion self après move = potentiellement frustrant tactiquement. Valider feeling en sandbox.
- Replay golden potentiellement à régénérer si stats changent (retrait formes non-finales du roster peut casser seed existante).
