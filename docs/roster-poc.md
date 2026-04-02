# Roster POC — Pokemon Tactics

> Les 12 Pokemon du prototype élargi et leurs movesets.
> Chaque attaque teste un pattern ou une mécanique différente pour valider le moteur.
> Les movesets des 8 nouveaux Pokemon (plan 013+) n'ont pas encore été revus par l'humain.
> **72 moves au total** : 56 moves offensifs/statut/buff (roster élargi plan 013+ et plan 026) + 8 moves défensifs (Abri, Détection, Garde Large, Prévention, Riposte, Voile Miroir, Fulmifer, Ténacité) ajoutés en plan 023 + Dummy.
> Les 17 nouveaux moves du plan 026 (toxic, supersonic, swords-dance, iron-defense, double-kick, fury-swipes, hyper-beam, dragon-tail, wrap, growl, roar, flash, acid, earthquake, mega-punch, slash, poison-sting) sont en cours d'attribution aux 12 Pokemon — **review humain en attente** (décision #121).

---

## Objectif du roster POC

Valider un maximum de mécaniques avec un minimum de Pokemon :
- **Roster initial (4)** : Plante, Feu, Eau, Normal/Vol — triangle élémentaire + neutre
- **Roster élargi (12)** : Électrique, Combat, Psy, Spectre/Poison, Roche/Sol, Feu (2e), Normal/Fée, Eau/Glace
- **Tous les patterns AoE** : single, cône, croix, zone self, dash, portée+AoE, lien, ligne, slash, blast
- **Mécaniques variées** : dégâts, statut, buff, drain, dash, AoE, debuff, défensif (Protect/Counter/Endure...)

---

## 1. Bulbizarre (Plante/Poison)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tranch'Herbe | Plante | Phys | 55 | 95 | 25 | 1 | slash | Arc frontal 3 cases devant le lanceur |
| 2 | Poudre Dodo | Plante | Statut | — | 75 | 15 | 0 (self) | zone r1 | Endort en zone autour du lanceur — risque friendly fire |
| 3 | Vampigraine | Plante | Statut | — | 90 | 10 | 1-3 | single (lien) | Drain PV/tour tant que cible à ≤5 tiles, permanent |
| 4 | Bombe-Beurk | Poison | Spé | 90 | 100 | 10 | 2-4 | blast r1 | **Portée + AoE** — tire à distance, explose en cercle r1. Chance poison 30%. |

**Rôle** : contrôle + attrition. Vampigraine force l'ennemi à fuir ou subir. Bombe-Beurk punit les regroupements.

---

## 2. Salamèche (Feu)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Flammèche | Feu | Spé | 40 | 100 | 25 | 1-3 | single | Ranged basique, chance brûlure 10% |
| 2 | Griffe | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée |
| 3 | Brouillard | Normal | Statut | — | 100 | 20 | 0 (self) | zone 3x3 | Zone centrée sur soi, -1 Précision aux ennemis dans la zone |
| 4 | Dracosouffle | Dragon | Spé | 60 | 100 | 20 | 1-2 | cône | Souffle en cône devant soi. Chance paralysie 30%. |

**Rôle** : attaquant polyvalent. Flammèche en ranged, Dracosouffle pour punir les groupes devant lui, Brouillard pour se protéger en zone.

---

## 3. Carapuce (Eau)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Pistolet à O | Eau | Spé | 40 | 100 | 25 | 1-3 | single | Ranged basique |
| 2 | Charge | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée |
| 3 | Repli | Eau | Statut | — | 100 | 40 | 0 (self) | self | +1 Déf, +1 Déf Spé — tank |
| 4 | Bulles d'O | Eau | Spé | 65 | 100 | 20 | 1-2 | cône | Cône devant soi, friendly fire |

**Rôle** : tank. Repli pour encaisser, Bulles d'O pour zone denial, Pistolet à O en harcèlement à distance.

---

## 4. Roucoul (Normal/Vol)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tornade | Vol | Spé | 40 | 100 | 35 | 1-3 | cône | Cône devant soi, STAB |
| 2 | Vive-Attaque | Normal | Phys | 40 | 100 | 30 | dash 2 | dash | **Dash** : fonce en ligne droite (2 tiles max), frappe le premier ennemi — ou se repositionne dans le vide |
| 3 | Jet de Sable | Sol | Statut | — | 100 | 15 | 1-2 | cône | -1 Précision, teste le cône |
| 4 | Cru-Aile | Vol | Phys | 60 | 100 | 35 | 1 | slash | Arc frontal 3 cases, mêlée STAB |

**Rôle** : mobile et harceleur. Type Vol = ignore le blocage et les dégâts de chute. Vive-Attaque pour gap-close ou fuir en frappant.

---

## 5. Pikachu (Électrique)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tonnerre | Électrique | Spé | 90 | 100 | 15 | ligne 4 | ligne | **Ligne** : traverse en ligne droite, chance paralysie 10% |
| 2 | Cage-Éclair | Électrique | Statut | — | 90 | 20 | 1-3 | single | Paralysie 100% |
| 3 | Combo-Griffe | Normal | Phys | 18 | 85 | 15 | 1 | single | **Multi-hit 2-5** (35/35/15/15%). Frappe jusqu'à 5 fois, s'arrête si KO. |
| 4 | Volttackle | Électrique | Phys | 120 | 100 | 15 | dash 3 | dash | Dash puissant, repositionnement |

**Rôle** : contrôle électrique + mobilité. Tonnerre en ligne pour punir les files. Combo-Griffe pour accumuler les dégâts et potentiellement KO. Voltacle ferme le gap avec puissance.

---

## 6. Machop (Combat)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tranche | Normal | Phys | 70 | 100 | 20 | 1 | slash | **Slash** : arc frontal 3 cases, taux critique élevé |
| 2 | Séisme | Sol | Phys | 100 | 100 | 10 | 0 (self) | zone r2 | **Zone r2** : AoE sol 13 cases, friendly fire |
| 3 | Pugilat | Combat | Statut | — | 100 | 20 | 0 (self) | self | +1 Attaque, +1 Défense |
| 4 | Éclate-Roc | Combat | Phys | 40 | 100 | 15 | self | croix 3x3 | AoE croix centrée sur le lanceur + -1 Déf aux cibles |

**Rôle** : bruiser mêlée. Tranche (slash) pour balayer plusieurs ennemis adjacents. Séisme (zone r2) pour punir les regroupements. Pugilat pour se booster.

---

## 7. Abra (Psy)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Psykoud'boul | Psy | Spé | 65 | 100 | 20 | ligne 5 | ligne | **Ligne longue** — traverse jusqu'à 5 tiles |
| 2 | Choc Mental | Psy | Spé | 50 | 100 | 25 | 1-4 | single | Ranged longue portée |
| 3 | Kinésie | Psy | Statut | — | 80 | 15 | 1-3 | single | -1 Précision cible |
| 4 | Zen Absolu | Psy | Statut | — | 100 | 20 | 0 (self) | self | +1 Atk Spé, +1 Déf Spé |

**Rôle** : mage longue portée. Stats défensives très faibles (15 Déf). Psykoud'boul en ligne pour contrôler les couloirs. Zen Absolu pour monter en puissance.

---

## 8. Fantominus (Spectre/Poison)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Léchouille | Spectre | Phys | 30 | 100 | 30 | 1 | single | Mêlée, chance paralysie 30% |
| 2 | Hypnose | Psy | Statut | — | 60 | 20 | 1-3 | single | Sommeil 100% (précision basse) |
| 3 | Ombre Nuit | Spectre | Spé | 50 | 100 | 15 | self | croix 3x3 | AoE croix centrée sur le lanceur |
| 4 | Miniminus | Normal | Statut | — | 100 | 10 | 0 (self) | self | +2 Esquive |

**Rôle** : contrôle furtif. Type Spectre = traverse les ennemis. Hypnose pour mettre hors combat, Miniminus pour devenir insaisissable.

---

## 9. Racaillou (Roche/Sol)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Lancer-Roc | Roche | Phys | 50 | 90 | 15 | 1-3 | single | Ranged, précision réduite |
| 2 | Ampleur | Sol | Phys | 70 | 100 | 30 | 0 (self) | zone r2 | AoE zone self r2 (13 cases), friendly fire |
| 3 | Armure | Normal | Statut | — | 100 | 40 | 0 (self) | self | +1 Défense |
| 4 | Tunnel | Roche | Phys | 30 | 90 | 20 | dash 4 | dash | Dash longue portée |

**Rôle** : forteresse lente. 100 Défense, 20 Vitesse. Ampleur punit les regroupements autour de lui. Tunnel pour se repositionner malgré la lenteur.

---

## 10. Caninos (Feu)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Morsure | Ténèbres | Phys | 60 | 100 | 25 | 1 | single | Mêlée |
| 2 | Lance-Flammes | Feu | Spé | 90 | 100 | 15 | ligne 3 | ligne | **Ligne** : rayon de feu, chance brûlure 10% |
| 3 | Tranche Rapide | Psy | Statut | — | 100 | 30 | 0 (self) | self | +2 Vitesse |
| 4 | Roue de Feu | Feu | Phys | 60 | 100 | 25 | dash 3 | dash | Dash + dégâts feu, chance brûlure 10% |

**Rôle** : attaquant Feu polyvalent, plus mobile que Salamèche. Lance-Flammes en ligne pour les couloirs. Tranche Rapide + Roue de Feu pour chasser les cibles.

---

## 11. Rondoudou (Normal/Fée)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Écras'Face | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée basique |
| 2 | Berceuse | Normal | Statut | — | 55 | 15 | 1-3 | cône | Sommeil en cône (précision basse) |
| 3 | Plaquage | Normal | Phys | 85 | 100 | 15 | 1 | single | Mêlée puissante, chance paralysie 30% |
| 4 | Entassement | Normal | Statut | — | 100 | 20 | 0 (self) | self | +1 Défense, +1 Déf Spé |

**Rôle** : tank PV (115 HP) avec contrôle de zone. Berceuse en cône pour endormir plusieurs ennemis. Plaquage pour punir ce qui reste debout.

---

## 12. Otaria (Eau/Glace)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Laser Glace | Glace | Spé | 65 | 100 | 20 | ligne 3 | ligne | **Ligne** : rayon glacé, -1 Attaque aux cibles |
| 2 | Blizzard | Glace | Spé | 110 | 70 | 5 | 1-3 | cône | Cône large, chance gel 10%, précision basse — nuke situationnel |
| 3 | Tête de Roc | Normal | Phys | 70 | 100 | 15 | 1 | single | Mêlée |
| 4 | Vent Glace | Glace | Spé | 55 | 95 | 15 | 1-2 | cône | Cône court, -1 Vitesse aux cibles |

**Rôle** : contrôle par ralentissement et gel. Blizzard est un nuke situationnel (5 PP, 70% précision). Vent Glace slow zone, Laser Glace en ligne pour affaiblir l'Attaque.

---

## 13. Dummy (Normal) — cible du mode sandbox

Pokemon de test uniquement, utilisé comme adversaire en mode sandbox. Non présent dans les combats normaux.

| Stat de base | Valeur |
|---|---|
| PV | 100 |
| Attaque | 50 |
| Défense | 50 |
| Atk Spé | 50 |
| Déf Spé | 50 |
| Vitesse | 50 |

**Movepool** : les 8 moves défensifs uniquement (Abri, Détection, Garde Large, Prévention, Riposte, Voile Miroir, Fulmifer, Ténacité) + option passif (EndTurn immédiat). Le move actif est configurable via le panel Dummy ou le query param `dummyMove`.

**Sprite** : clone PMDCollab sprite `#0000 form 1` (sprite générique partagé).

---

## Mécaniques testées par le roster élargi

| Mécanique | Testée par |
|-----------|-----------|
| Single target mêlée | Griffe, Charge, Tranche, Séisme, Léchouille, Morsure, Écras'Face, Tête de Roc |
| Single target ranged | Flammèche, Pistolet à O, Cage-Éclair, Kinésie, Choc Mental, Lancer-Roc |
| **Slash** (arc frontal 3 cases) | Tranch'Herbe, Cru-Aile |
| **Blast** (projectile + explosion circulaire) | Bombe-Beurk |
| AoE croix | Éclate-Roc, Ombre Nuit |
| AoE cône | Tornade, Dracosouffle, Bulles d'O, Jet de Sable, Berceuse, Blizzard, Vent Glace |
| **Ligne** | Tonnerre, Psykoud'boul, Lance-Flammes, Laser Glace |
| Zone self | Brouillard, Poudre Dodo, Ampleur |
| Buff self (Attaque/Déf) | Repli, Pugilat, Entassement, Armure, Défense Enroulée |
| Buff self (Atk Spé/Déf Spé) | Zen Absolu |
| Buff self (Vitesse) | Tranche Rapide |
| Buff self (Esquive) | Miniminus |
| **+2 Attaque (Épée Danse)** | swords-dance |
| **+2 Défense (Mur de Fer)** | iron-defense |
| Attaque dash | Vive-Attaque, Voltacle, Tunnel, Roue de Feu |
| Lien persistant (drain) | Vampigraine |
| **Lien Bind (immobilisation)** | Ligotage (wrap) |
| **Multi-hit fixe** | Double Pied (double-kick x2) |
| **Multi-hit variable** | Combo-Griffe (fury-swipes 2-5) |
| **Recharge tour suivant** | Ultralaser (hyper-beam) |
| **Knockback** | Draco-Queue (dragon-tail) |
| Statut : sommeil | Poudre Dodo, Hypnose, Berceuse |
| Statut : brûlure | Flammèche, Lance-Flammes, Roue de Feu |
| Statut : poison | Bombe-Beurk, Dard-Venin (poison-sting) |
| **Statut : poison grave** | Toxik (toxic) |
| Statut : paralysie | Dracosouffle, Cage-Éclair, Tonnerre, Léchouille, Plaquage |
| **Statut volatil : confusion** | Ultrason (supersonic) |
| **Statut : gel** | Blizzard |
| Statut : -précision | Brouillard, Jet de Sable, Kinésie, Flash |
| Debuff : -Attaque | Laser Glace, Rugissement (growl, cône), Hurlement (roar, cône) |
| Debuff : -Déf Spé | Acide (acid, cône) |
| Debuff : -Vitesse | Vent Glace |
| Friendly fire AoE | Tranch'Herbe, Cru-Aile (slash), Bombe-Beurk (blast), Poudre Dodo, Tornade, Bulles d'O (cône), Dracosouffle, Ampleur, Berceuse, Blizzard |
| Type Vol (survol, chute) | Roucoul |
| Type Spectre (traversée ennemis) | Fantominus |
| Triangle de types | Plante > Eau > Feu > Plante |
| Couverture types | Électrique, Combat, Psy, Spectre, Roche, Sol, Glace, Ténèbres, Fée |
| **Défensif : blocage directionnel** | Abri, Détection (Dummy) |
| **Défensif : blocage AoE** | Garde Large (Dummy) |
| **Défensif : omnidirectionnel 1 coup** | Prévention (Dummy) |
| **Défensif : renvoi contact x2** | Riposte (Dummy) |
| **Défensif : renvoi distance x2** | Voile Miroir (Dummy) |
| **Défensif : renvoi universel x1.5** | Fulmifer (Dummy) |
| **Défensif : survie 1 PV** | Ténacité (Dummy) |
