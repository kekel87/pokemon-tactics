---
status: ready
created: 2026-04-02
updated: 2026-04-02
---

# Plan 027 — 8 nouveaux Pokemon : données, sprites et documentation

## Objectif

Ajouter 8 nouveaux Pokemon (12 → 20 jouables) dans `packages/data` avec leurs sprites PMDCollab et mettre à jour toute la documentation. Ce plan dépend du plan 026 (mécaniques core + 17 moves).

## Contexte

Le plan 026 ajoute 17 nouveaux moves et 5 mécaniques core. Ce plan ajoute les 8 Pokemon qui utilisent ces moves. Les moves existants réutilisés (`bite`, `quick-attack`, `scratch`, etc.) sont déjà dans le roster.

## Nouveaux Pokemon

| # | Pokemon | ID | Type(s) | HP | Atk | Déf | AtkSpé | DéfSpé | Vit | Rôle |
|---|---------|----|---------|----|-----|-----|--------|--------|-----|------|
| 13 | Évoli | eevee | Normal | 55 | 55 | 50 | 45 | 65 | 55 | Harceleur rapide, debuff |
| 14 | Tentacool | tentacool | Eau/Poison | 40 | 40 | 35 | 50 | 100 | 70 | Empoisonneur, contrôleur |
| 15 | Nidoran♂ | nidoran-m | Poison | 46 | 57 | 40 | 40 | 40 | 50 | Harceleur mêlée, confusion |
| 16 | Miaouss | meowth | Normal | 40 | 45 | 35 | 40 | 40 | 90 | Mobile, burst aléatoire |
| 17 | Magnéti | magnemite | Élec/Acier | 25 | 35 | 70 | 95 | 55 | 45 | Tourelle, tank défensif |
| 18 | Sabelette | sandshrew | Sol | 50 | 75 | 85 | 20 | 30 | 40 | Bruiser sol, AoE |
| 19 | Excelangue | lickitung | Normal | 90 | 55 | 75 | 60 | 75 | 30 | Contrôle lent, nuke |
| 20 | Kangourex | kangaskhan | Normal | 105 | 95 | 80 | 40 | 80 | 90 | Bruiser tank, buff +2 Atk |

## Movesets

### 13. Évoli (Normal)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `bite` | Morsure | mêlée |
| 2 | `quick-attack` | Vive-Attaque | dash 2 |
| 3 | `growl` | Rugissement | cône -1 Atk |
| 4 | `double-team` | Reflet | +1 Esquive |

### 14. Tentacool (Eau/Poison)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `water-gun` | Pistolet à O | ranged |
| 2 | `acid` | Acide | cône + -1 Déf Spé |
| 3 | `toxic` | Toxik | badly_poisoned |
| 4 | `wrap` | Ligotage | bind immobilise |

### 15. Nidoran♂ (Poison)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `poison-sting` | Dard-Venin | poison 30% |
| 2 | `double-kick` | Double Pied | multi-hit x2 |
| 3 | `roar` | Hurlement | cône -1 Atk |
| 4 | `supersonic` | Ultrason | confused |

### 16. Miaouss (Normal)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `scratch` | Griffe | mêlée |
| 2 | `fury-swipes` | Combo-Griffe | multi-hit 2-5 |
| 3 | `growl` | Rugissement | cône -1 Atk |
| 4 | `agility` | Hâte | +2 Vitesse |

### 17. Magnéti (Électrique/Acier)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `thunderbolt` | Tonnerre | ligne, para 10% |
| 2 | `thunder-wave` | Cage-Éclair | paralysie 100% |
| 3 | `flash` | Flash | zone r2 -1 Précision |
| 4 | `iron-defense` | Mur de Fer | +2 Défense |

### 18. Sabelette (Sol)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `slash` | Tranche | slash arc frontal |
| 2 | `scratch` | Griffe | mêlée |
| 3 | `earthquake` | Séisme | zone r2, 100 puiss. |
| 4 | `sand-attack` | Jet de Sable | cône -1 Précision |

### 19. Excelangue (Normal)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `lick` | Léchouille | paralysie 30% |
| 2 | `hyper-beam` | Ultralaser | ligne 5, 150 puiss. |
| 3 | `growl` | Rugissement | cône -1 Atk |
| 4 | `dragon-tail` | Draco-Queue | slash + knockback |

### 20. Kangourex (Normal)

| # | Move | Nom FR | Effet |
|---|------|--------|-------|
| 1 | `mega-punch` | Ultimapoing | mêlée 80 puiss. |
| 2 | `scratch` | Griffe | mêlée |
| 3 | `swords-dance` | Danse-Lames | +2 Attaque |
| 4 | `body-slam` | Plaquage | paralysie 30% |

## Étapes

### Étape 1 — Ajouter les 8 Pokemon dans packages/data

- Ajouter dans `packages/data/src/base/pokemon.ts`
- Chaque entrée : `name`, `types`, `baseStats`, `weight`, `movepool` (4 IDs)
- Stats niveau 50 calculées automatiquement par `computeStatAtLevel`
- Vérifier que `validate.ts` passe (IDs moves existent)
- Vérifier que `pnpm test` passe

### Étape 2 — Sprites PMDCollab

- Exécuter le pipeline d'extraction (plan 010) pour les 8 Pokemon
- Ajouter les `offsets.json` correspondants (plan 021)
- Si un sprite manque : le renderer utilise le placeholder existant
- Tester visuellement en mode sandbox avec au moins 2 nouveaux Pokemon

### Étape 3 — Documentation

- `docs/roster-poc.md` : ajouter les 8 Pokemon avec tableaux de movesets (format existant), MAJ tableau "Mécaniques testées"
- `STATUS.md` : mise à jour
- `docs/roadmap.md` : cocher "Roster élargi (~20 Pokemon)"

## Critères de complétion

- [ ] 8 Pokemon dans `packages/data/src/base/pokemon.ts` avec stats correctes
- [ ] `validate.ts` passe
- [ ] Sprites PMDCollab pour les 8 Pokemon (ou placeholder)
- [ ] `docs/roster-poc.md` reflète 20 Pokemon jouables
- [ ] `pnpm test` passe

## Risques

- **Sprites PMDCollab** : Excelangue et Kangourex sont moins courants, sprites potentiellement incomplets. Fallback placeholder.
- **Stats Gen 1 vs Gen 6+** : les stats de base ont changé entre générations (ex: DéfSpé séparée en Gen 2). Utiliser les stats les plus récentes (Gen 9) pour la cohérence avec le reste du roster.

## Dépendances

- **Avant** : plan 026 terminé (17 moves + mécaniques core)
- **Ce plan débloque** : Phase 1 Core complète, tests headless IA avec roster varié
