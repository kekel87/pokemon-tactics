# Roster POC — Pokemon Tactics

> Les 12 Pokemon du prototype élargi et leurs movesets.
> Chaque attaque teste un pattern ou une mécanique différente pour valider le moteur.
> Les movesets des 8 nouveaux Pokemon (plan 013+) n'ont pas encore été revus par l'humain.

---

## Objectif du roster POC

Valider un maximum de mécaniques avec un minimum de Pokemon :
- **Roster initial (4)** : Plante, Feu, Eau, Normal/Vol — triangle élémentaire + neutre
- **Roster élargi (12)** : Électrique, Combat, Psy, Spectre/Poison, Roche/Sol, Feu (2e), Normal/Fée, Eau/Glace
- **Tous les patterns AoE** : single, cône, croix, zone self, dash, portée+AoE, lien, ligne
- **Mécaniques variées** : dégâts, statut, buff, drain, dash, AoE, debuff

---

## 1. Bulbizarre (Plante/Poison)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tranch'Herbe | Plante | Phys | 55 | 95 | 25 | 1-2 | single | Attaque fiable, petite portée |
| 2 | Poudre Dodo | Plante | Statut | — | 75 | 15 | 1-2 | single | Endort la cible — contrôle |
| 3 | Vampigraine | Plante | Statut | — | 90 | 10 | 1-3 | single (lien) | Drain PV/tour tant que cible à ≤5 tiles, permanent |
| 4 | Bombe-Beurk | Poison | Spé | 90 | 100 | 10 | 2-4 | croix 3x3 | **Portée + AoE** — tire à distance, explose en zone. Chance poison 30%. |

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
| 4 | Bulles d'O | Eau | Spé | 65 | 100 | 20 | 1-2 | croix 3x3 | AoE croix, teste le friendly fire |

**Rôle** : tank. Repli pour encaisser, Bulles d'O pour zone denial, Pistolet à O en harcèlement à distance.

---

## 4. Roucoul (Normal/Vol)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tornade | Vol | Spé | 40 | 100 | 35 | 1-3 | single | Ranged STAB |
| 2 | Vive-Attaque | Normal | Phys | 40 | 100 | 30 | dash 2 | dash | **Dash** : fonce en ligne droite (2 tiles max), frappe le premier ennemi — ou se repositionne dans le vide |
| 3 | Jet de Sable | Sol | Statut | — | 100 | 15 | 1-2 | cône | -1 Précision, teste le cône |
| 4 | Cru-Aile | Vol | Phys | 60 | 100 | 35 | 1 | single | Mêlée puissante STAB |

**Rôle** : mobile et harceleur. Type Vol = ignore le blocage et les dégâts de chute. Vive-Attaque pour gap-close ou fuir en frappant.

---

## 5. Pikachu (Électrique)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tonnerre | Électrique | Spé | 90 | 100 | 15 | ligne 4 | ligne | **Ligne** : traverse en ligne droite, chance paralysie 10% |
| 2 | Cage-Éclair | Électrique | Statut | — | 90 | 20 | 1-3 | single | Paralysie 100% |
| 3 | Jackpot | Normal | Statut | — | 100 | 15 | 0 (self) | self | +1 Esquive |
| 4 | Volttackle | Électrique | Phys | 120 | 100 | 15 | dash 3 | dash | Dash puissant, repositionnement |

**Rôle** : contrôle électrique + mobilité. Tonnerre en ligne pour punir les files. Voltacle ferme le gap avec puissance.

---

## 6. Machop (Combat)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Tranche | Combat | Phys | 50 | 100 | 25 | 1 | single | Mêlée, haute priorité critique |
| 2 | Séisme | Combat | Phys | 40 | 100 | 20 | 1 | single | Mêlée |
| 3 | Pugilat | Combat | Statut | — | 100 | 20 | 0 (self) | self | +1 Attaque, +1 Défense |
| 4 | Éclate-Roc | Combat | Phys | 40 | 100 | 15 | 1-2 | croix 3x3 | AoE croix + -1 Déf aux cibles |

**Rôle** : bruiser mêlée. Pugilat pour se booster, Éclate-Roc pour affaiblir les défenses en zone.

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
| 3 | Ombre Nuit | Spectre | Spé | 50 | 100 | 15 | 1-2 | croix 3x3 | AoE croix |
| 4 | Miniminus | Normal | Statut | — | 100 | 10 | 0 (self) | self | +2 Esquive |

**Rôle** : contrôle furtif. Type Spectre = traverse les ennemis. Hypnose pour mettre hors combat, Miniminus pour devenir insaisissable.

---

## 9. Racaillou (Roche/Sol)

| # | Attaque | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Notes |
|---|---------|------|------|--------|-------|-----|--------|---------|-------|
| 1 | Lancer-Roc | Roche | Phys | 50 | 90 | 15 | 1-3 | single | Ranged, précision réduite |
| 2 | Ampleur | Sol | Phys | 70 | 100 | 30 | 0 (self) | zone 3x3 | AoE zone self, friendly fire |
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

## Mécaniques testées par le roster élargi

| Mécanique | Testée par |
|-----------|-----------|
| Single target mêlée | Griffe, Charge, Cru-Aile, Tranche, Séisme, Léchouille, Morsure, Écras'Face, Tête de Roc |
| Single target ranged | Flammèche, Pistolet à O, Tornade, Tranch'Herbe, Cage-Éclair, Kinésie, Choc Mental, Lancer-Roc |
| AoE croix | Bombe-Beurk, Bulles d'O, Éclate-Roc, Ombre Nuit |
| AoE cône | Dracosouffle, Jet de Sable, Berceuse, Blizzard, Vent Glace |
| **Ligne** | Tonnerre, Psykoud'boul, Lance-Flammes, Laser Glace |
| Zone self | Brouillard, Ampleur |
| Buff self (Attaque/Déf) | Repli, Pugilat, Entassement, Armure, Défense Enroulée |
| Buff self (Atk Spé/Déf Spé) | Zen Absolu |
| Buff self (Vitesse) | Tranche Rapide |
| Buff self (Esquive) | Jackpot, Miniminus |
| Attaque dash | Vive-Attaque, Voltacle, Tunnel, Roue de Feu |
| Lien persistant | Vampigraine |
| Portée + AoE (tir à distance + explosion) | Bombe-Beurk |
| Statut : sommeil | Poudre Dodo, Hypnose, Berceuse |
| Statut : brûlure | Flammèche, Lance-Flammes, Roue de Feu |
| Statut : poison | Bombe-Beurk |
| Statut : paralysie | Dracosouffle, Cage-Éclair, Tonnerre, Léchouille, Plaquage |
| **Statut : gel** | Blizzard |
| Statut : -précision | Brouillard, Jet de Sable, Kinésie |
| Debuff : -Attaque | Éclate-Roc (via -1 Déf), Laser Glace |
| Debuff : -Vitesse | Vent Glace |
| Friendly fire AoE | Bombe-Beurk, Bulles d'O, Dracosouffle, Ampleur, Berceuse, Blizzard |
| Type Vol (survol, chute) | Roucoul |
| Type Spectre (traversée ennemis) | Fantominus |
| Triangle de types | Plante > Eau > Feu > Plante |
| Couverture types | Électrique, Combat, Psy, Spectre, Roche, Sol, Glace, Ténèbres, Fée |
