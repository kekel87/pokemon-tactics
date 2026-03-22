# Roster POC — Pokemon Tactics

> Les 4 Pokemon du prototype et leurs movesets.
> Chaque attaque teste un pattern ou une mécanique différente pour valider le moteur.

---

## Objectif du roster POC

Valider un maximum de mécaniques avec un minimum de Pokemon :
- **4 types** : Plante, Feu, Eau, Normal/Vol (triangle élémentaire + neutre)
- **Tous les patterns AoE** : single, cône, croix, zone self, dash, portée+AoE, lien
- **Mécaniques variées** : dégâts, statut, buff, drain, dash, AoE

---

## 1. Bulbizarre (Plante/Poison)

| # | Attaque | Type | Cat. | Puiss. | Portée | Pattern | Notes |
|---|---------|------|------|--------|--------|---------|-------|
| 1 | Tranch'Herbe | Plante | Phys | 55 | 1-2 | single | Attaque fiable, petite portée |
| 2 | Poudre Dodo | Plante | Statut | — | 1-2 | single | Endort la cible — contrôle |
| 3 | Vampigraine | Plante | Statut | — | 1-3 | single (lien) | Drain PV/tour tant que cible à ≤5 tiles, max 3 tours |
| 4 | Bombe-Beurk | Poison | Spé | 90 | 2-4 | croix 3x3 | **Portée + AoE** — tire à distance, explose en zone. Chance poison. |

**Rôle** : contrôle + attrition. Vampigraine force l'ennemi à fuir ou subir. Bombe-Beurk punit les regroupements.

---

## 2. Salamèche (Feu)

| # | Attaque | Type | Cat. | Puiss. | Portée | Pattern | Notes |
|---|---------|------|------|--------|--------|---------|-------|
| 1 | Flammèche | Feu | Spé | 40 | 1-3 | single | Ranged basique, chance brûlure |
| 2 | Griffe | Normal | Phys | 40 | 1 | single | Mêlée |
| 3 | Brouillard | Normal | Statut | — | 0 (self) | zone 3x3 | Zone centrée sur soi, -1 Précision aux ennemis dans la zone |
| 4 | Dracosouffle | Dragon | Spé | 60 | 1-2 | cône | Souffle en cône devant soi. Chance paralysie. |

**Rôle** : attaquant polyvalent. Flammèche en ranged, Dracosouffle pour punir les groupes devant lui, Brouillard pour se protéger en zone.

---

## 3. Carapuce (Eau)

| # | Attaque | Type | Cat. | Puiss. | Portée | Pattern | Notes |
|---|---------|------|------|--------|--------|---------|-------|
| 1 | Pistolet à O | Eau | Spé | 40 | 1-3 | single | Ranged basique |
| 2 | Charge | Normal | Phys | 40 | 1 | single | Mêlée |
| 3 | Repli | Eau | Statut | — | 0 (self) | self | +1 Déf, +1 Déf Spé — tank |
| 4 | Bulles d'O | Eau | Spé | 65 | 1-2 | croix 3x3 | AoE croix, teste le friendly fire |

**Rôle** : tank. Repli pour encaisser, Bulles d'O pour zone denial, Pistolet à O en harcèlement à distance.

---

## 4. Roucoul (Normal/Vol)

| # | Attaque | Type | Cat. | Puiss. | Portée | Pattern | Notes |
|---|---------|------|------|--------|--------|---------|-------|
| 1 | Tornade | Vol | Spé | 40 | 1-3 | single | Ranged STAB |
| 2 | Vive-Attaque | Normal | Phys | 40 | dash 3 | dash | **Dash** : fonce en ligne droite (3 tiles max), frappe le premier ennemi |
| 3 | Jet de Sable | Sol | Statut | — | 1-2 | cône | -1 Précision, teste le cône |
| 4 | Cru-Aile | Vol | Phys | 60 | 1 | single | Mêlée puissante STAB |

**Rôle** : mobile et harceleur. Type Vol = ignore le blocage et les dégâts de chute. Vive-Attaque pour gap-close ou fuir en frappant.

---

## Mécaniques testées par le roster

| Mécanique | Testée par |
|-----------|-----------|
| Single target mêlée | Griffe, Charge, Cru-Aile |
| Single target ranged | Flammèche, Pistolet à O, Tornade, Tranch'Herbe |
| AoE croix | Bombe-Beurk, Bulles d'O |
| AoE cône | Dracosouffle, Jet de Sable |
| Zone self | Brouillard |
| Buff self | Repli |
| Attaque dash | Vive-Attaque |
| Lien persistant | Vampigraine |
| Portée + AoE (tir à distance + explosion) | Bombe-Beurk |
| Statut : sommeil | Poudre Dodo |
| Statut : brûlure | Flammèche |
| Statut : poison | Bombe-Beurk |
| Statut : paralysie | Dracosouffle |
| Statut : -précision | Brouillard, Jet de Sable |
| Friendly fire AoE | Bombe-Beurk, Bulles d'O, Dracosouffle |
| Type Vol (survol, chute) | Roucoul |
| Triangle de types | Plante > Eau > Feu > Plante |
