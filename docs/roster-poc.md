# Roster POC — Pokemon Tactics

> Les 20 Pokemon jouables (+1 Dummy) et leurs movesets.
> Chaque attaque teste un pattern ou une mécanique différente pour valider le moteur.
> **72 moves au total** : 56 moves offensifs/statut/buff + 8 moves défensifs (Dummy) + 8 moves partagés entre les nouveaux Pokemon.
> 8 nouveaux Pokemon ajoutés en plan 027 : Évoli, Tentacool, Nidoran♂, Miaouss, Magnéti, Sabelette, Excelangue, Kangourex.

---

## Objectif du roster POC

Valider un maximum de mécaniques avec un minimum de Pokemon :
- **Roster initial (4)** : Plante, Feu, Eau, Normal/Vol — triangle élémentaire + neutre
- **Roster élargi (20)** : Électrique, Combat, Psy, Spectre/Poison, Roche/Sol, Feu (2e), Normal/Fée, Eau/Glace, Eau/Poison, Sol, Élec/Acier, Normal (x4)
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

## 14. Évoli (Normal)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Morsure | Ténèbres | Phys | 60 | 100 | 25 | 1 | single | Mêlée |
| 2 | Vive-Attaque | Normal | Phys | 40 | 100 | 30 | dash 2 | dash | Dash repositionnement |
| 3 | Rugissement | Normal | Statut | — | 100 | 40 | 1-2 | cône | -1 Atk aux cibles |
| 4 | Reflet | Normal | Statut | — | 100 | 15 | 0 (self) | self | +1 Esquive |

**Rôle** : harceleur rapide. Morsure en mêlée, Vive-Attaque pour gap-close, Rugissement pour affaiblir les ennemis devant lui, Reflet pour l'esquive.

---

## 15. Tentacool (Eau/Poison)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Pistolet à O | Eau | Spé | 40 | 100 | 25 | 1-3 | single | Ranged basique |
| 2 | Acide | Poison | Spé | 40 | 100 | 30 | 1-2 | cône | Cône + -1 Déf Spé aux cibles |
| 3 | Toxik | Poison | Statut | — | 90 | 10 | 1-3 | single | Poison grave (dégâts croissants) |
| 4 | Ligotage | Normal | Phys | 15 | 90 | 20 | 1 | single | Bind : immobilise 4-5 tours, dégâts/tour |

**Rôle** : empoisonneur et contrôleur. Toxik pour l'attrition lourde, Ligotage pour immobiliser, Acide pour affaiblir la Déf Spé en zone. 100 Déf Spé tank les attaquants spéciaux.

---

## 16. Nidoran♂ (Poison)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Dard-Venin | Poison | Phys | 15 | 100 | 35 | 1 | single | Mêlée, chance poison 30% |
| 2 | Double Pied | Combat | Phys | 30 | 100 | 30 | 1 | single | Multi-hit x2 fixe |
| 3 | Hurlement | Normal | Statut | — | 100 | 40 | 1-2 | cône | -1 Atk aux cibles en cône |
| 4 | Ultrason | Normal | Statut | — | 55 | 20 | 1-3 | single | Confusion (redirection aléatoire) |

**Rôle** : harceleur mêlée avec contrôle. Dard-Venin pour empoisonner, Double Pied pour accumuler les dégâts, Ultrason pour semer la confusion.

---

## 17. Miaouss (Normal)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Griffe | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée basique |
| 2 | Combo-Griffe | Normal | Phys | 18 | 80 | 15 | 1 | single | Multi-hit 2-5 (35/35/15/15%) |
| 3 | Rugissement | Normal | Statut | — | 100 | 40 | 1-2 | cône | -1 Atk aux cibles |
| 4 | Hâte | Psy | Statut | — | 100 | 30 | 0 (self) | self | +2 Vitesse |

**Rôle** : mobile et burst aléatoire. 90 Vitesse + Hâte pour agir souvent. Combo-Griffe pour du burst potentiel. Rugissement pour débuffer.

---

## 18. Magnéti (Électrique/Acier)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tonnerre | Électrique | Spé | 90 | 100 | 15 | ligne 4 | ligne | Traverse en ligne, chance paralysie 10% |
| 2 | Cage-Éclair | Électrique | Statut | — | 90 | 20 | 1-3 | single | Paralysie 100% |
| 3 | Flash | Normal | Statut | — | 100 | 20 | 0 (self) | zone r2 | -1 Précision en zone autour du lanceur |
| 4 | Mur de Fer | Acier | Statut | — | 100 | 15 | 0 (self) | self | +2 Défense |

**Rôle** : tourelle défensive. 95 Atk Spé + Tonnerre en ligne. Cage-Éclair pour paralyser à distance. Flash pour zone denial. Mur de Fer pour renforcer sa défense déjà solide (70). Double type Élec/Acier offre de bonnes résistances.

---

## 19. Sabelette (Sol)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tranche | Normal | Phys | 70 | 100 | 20 | 1 | slash | Arc frontal 3 cases, taux critique élevé |
| 2 | Griffe | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée basique |
| 3 | Séisme | Sol | Phys | 100 | 100 | 10 | 0 (self) | zone r2 | AoE sol 13 cases, friendly fire |
| 4 | Jet de Sable | Sol | Statut | — | 100 | 15 | 1-2 | cône | -1 Précision en cône |

**Rôle** : bruiser sol. 85 Défense + 75 Attaque. Tranche (slash) pour balayer en mêlée. Séisme pour punir les regroupements. Jet de Sable pour affaiblir la précision ennemie.

---

## 20. Excelangue (Normal)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Léchouille | Spectre | Phys | 30 | 100 | 30 | 1 | single | Mêlée, chance paralysie 30% |
| 2 | Ultralaser | Normal | Spé | 150 | 90 | 5 | ligne 5 | ligne | Nuke en ligne, recharge au tour suivant |
| 3 | Rugissement | Normal | Statut | — | 100 | 40 | 1-2 | cône | -1 Atk aux cibles |
| 4 | Draco-Queue | Dragon | Phys | 60 | 90 | 10 | 1 | slash | Arc frontal 3 cases + knockback |

**Rôle** : contrôle lent et nuke. 90 PV + bonnes défenses (75/75). Ultralaser pour dévastation en ligne (mais recharge). Draco-Queue pour repousser les ennemis. Rugissement pour débuffer. Très lent (30 Vitesse).

---

## 21. Kangourex (Normal)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Ultimapoing | Normal | Phys | 80 | 85 | 20 | 1 | single | Mêlée puissante |
| 2 | Griffe | Normal | Phys | 40 | 100 | 35 | 1 | single | Mêlée basique |
| 3 | Danse-Lames | Normal | Statut | — | 100 | 20 | 0 (self) | self | +2 Attaque |
| 4 | Plaquage | Normal | Phys | 85 | 100 | 15 | 1 | single | Mêlée puissante, chance paralysie 30% |

**Rôle** : bruiser tank offensif. 105 PV, 95 Attaque, 90 Vitesse. Danse-Lames pour +2 Atk puis Ultimapoing/Plaquage pour faire très mal. Résistant avec 80 Déf et 80 Déf Spé.

---

## Mécaniques testées par le roster élargi

| Mécanique | Testée par |
|-----------|-----------|
| Single target mêlée | Griffe, Charge, Tranche, Séisme, Léchouille, Morsure, Écras'Face, Tête de Roc, Dard-Venin, Double Pied, Ultimapoing, Plaquage |
| Single target ranged | Flammèche, Pistolet à O, Cage-Éclair, Kinésie, Choc Mental, Lancer-Roc, Toxik, Ultrason |
| **Slash** (arc frontal 3 cases) | Tranch'Herbe, Cru-Aile, Tranche (Sabelette), Draco-Queue (Excelangue) |
| **Blast** (projectile + explosion circulaire) | Bombe-Beurk |
| AoE croix | Éclate-Roc, Ombre Nuit |
| AoE cône | Tornade, Dracosouffle, Bulles d'O, Jet de Sable, Berceuse, Blizzard, Vent Glace, Rugissement, Hurlement, Acide |
| **Ligne** | Tonnerre, Psykoud'boul, Lance-Flammes, Laser Glace, Ultralaser (Excelangue) |
| Zone self | Brouillard, Poudre Dodo, Ampleur, Flash, Séisme (Sabelette) |
| Buff self (Attaque/Déf) | Repli, Pugilat, Entassement, Armure, Défense Enroulée |
| Buff self (Atk Spé/Déf Spé) | Zen Absolu |
| Buff self (Vitesse) | Tranche Rapide, Hâte (Miaouss) |
| Buff self (Esquive) | Miniminus, Reflet (Évoli) |
| **+2 Attaque (Épée Danse)** | Danse-Lames (Kangourex) |
| **+2 Défense (Mur de Fer)** | Mur de Fer (Magnéti) |
| Attaque dash | Vive-Attaque, Voltacle, Tunnel, Roue de Feu, Vive-Attaque (Évoli) |
| Lien persistant (drain) | Vampigraine |
| **Lien Bind (immobilisation)** | Ligotage (Tentacool) |
| **Multi-hit fixe** | Double Pied (Nidoran♂ x2) |
| **Multi-hit variable** | Combo-Griffe (Pikachu, Miaouss 2-5) |
| **Recharge tour suivant** | Ultralaser (Excelangue) |
| **Knockback** | Draco-Queue (Excelangue) |
| Statut : sommeil | Poudre Dodo, Hypnose, Berceuse |
| Statut : brûlure | Flammèche, Lance-Flammes, Roue de Feu |
| Statut : poison | Bombe-Beurk, Dard-Venin (Nidoran♂) |
| **Statut : poison grave** | Toxik (Tentacool) |
| Statut : paralysie | Dracosouffle, Cage-Éclair, Tonnerre, Léchouille, Plaquage (Kangourex), Plaquage (Rondoudou) |
| **Statut volatil : confusion** | Ultrason (Nidoran♂) |
| **Statut : gel** | Blizzard |
| Statut : -précision | Brouillard, Jet de Sable, Kinésie, Flash |
| Debuff : -Attaque | Laser Glace, Rugissement (Évoli, Miaouss, Excelangue), Hurlement (Nidoran♂) |
| Debuff : -Déf Spé | Acide (Tentacool) |
| Debuff : -Vitesse | Vent Glace |
| Friendly fire AoE | Tranch'Herbe, Cru-Aile, Bombe-Beurk, Poudre Dodo, Tornade, Bulles d'O, Dracosouffle, Ampleur, Berceuse, Blizzard, Rugissement, Hurlement, Acide, Flash, Séisme, Tranche, Draco-Queue |
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
