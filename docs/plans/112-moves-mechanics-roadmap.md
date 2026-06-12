# Plan 112 — Roadmap moves restants par système moteur

> **Statut : en cours** (2026-06-05) — plan maître ; B1–B4 livrés, B5+ à venir
> Phase 4 — mécaniques complexes. Plan **maître** : chaque système = 1 batch dédié. Suite des batches G1–G6 (clos) + plans 109/110/111.

## Objectif

Classer les **155 moves restants** (accessibles au roster, non implémentés) par **système moteur requis**, pour les livrer batch par batch dans un ordre ROI/fondation décroissant. Plus aucun move « simple » à gratter : tout le reste exige une mécanique moteur.

## Chiffres (source = données live, 2026-06-05)

| Métrique | Valeur | Méthode |
|---|---|---|
| Pool roster | **493** | union `getLegalMoves` (level-up + TM + tutor + chaîne évo) sur 80 jouables ∩ `reference/moves.json`, **moins Téra-Explosion** (hors-scope) |
| Implémentés (départ plan) | **348** (2026-06-05) | clés `tacticalOverrides` (`isMoveImplemented`) |
| Implémentés (actuel 2026-06-12) | **393** | +45 depuis ouverture plan (B1/B2/B3/B4) |
| **Restants in-scope (actuel)** | **~100** | `493 − ~393 in-pool` |

## Décisions de scope

| Sujet | Décision |
|---|---|
| **Téra-Explosion** | **Droppé définitivement.** Aucune mécanique Téracristal / Z-Move / Dynamax dans le jeu (décision #422). Retiré du pool. |
| **Déplacement forcé** (Cyclone, Projection, Interversion) | **Adapté grille tactique** : pas de switch → knockback / repositionnement forcé sur le terrain. |
| **Pièges au sol (Hazards)** | **Adaptés grille tactique** : on pose une zone au sol qui se déclenche quand un Pokemon marche/entre dessus (style FFTA trap tile), pas de logique « entrée en combat ». |
| **Morphing** | Retiré du batch Copie générique → **batch Métamorph dédié** (Métamorph + son talent Imposteur/Morphing + le move Morphing ensemble). |
| **Métronome** | Conservé, batch Copie normal (peu complexe). |
| Cas particuliers | Certains batches resteront à trancher **au cas par cas** avec l'humain avant impl (formules, portées, interactions). |

---

## Batches par système (ordre d'exécution recommandé)

> Ordre = ROI / fondation décroissant. `→` = dépendance moteur principale.

### Vague 1 — Quick wins & fondations

#### B1 · Quasi-prêt — 6 livrés (plan 113) + 3 différés
Petite extension du moteur existant (override Défense, override type-efficacité, multi-hit croissant, crash-on-miss).
> **Livrés (plan 113)** : Choc Psy, Frappe Psy, Lyophilisation, Triple Axel, Pied Voltige, Talon-Marteau
- Choc Psy / Frappe Psy → override Déf physique (`hitsPhysicalDefense`).
- Lyophilisation → override type-efficacité (×2 Eau).
- Triple Axel → multi-hit puissance croissante + précision par coup.
- Pied Voltige / Talon-Marteau → crash-on-miss (½ PV max).
> **Différés (watch Pokémon Champions)** : Frustration, Retour, Puissance Cachée — inutilisables gen 8/9, pas de système de bonheur en tactique. Décision humain 2026-06-05 : revisiter selon maj Champions.

#### B2 · Soin — 11 moves ✅ **(plan 116, 2026-06-07)**
→ Système de soin (pur % · régén/tour · différé · drain).
> Racines, Anneau Hydro, Fontaine de Vie, Vœu, Vibra Soin, E-Coque, Paresse, Aromathérapie, Vole-Force, Dévorêve, Boule Pollen
- HoT : Racines, Anneau Hydro. Différé : Vœu. Pur % : E-Coque, Paresse, Vibra Soin (cible), Fontaine de Vie (alliés).
- Aromathérapie → soin statut équipe. Vole-Force → drain + baisse Atk. Dévorêve → drain (cible endormie). Boule Pollen → soin allié / dégâts ennemi.

#### B3 · Dégâts conditionnels — 17 moves ✅ (plan 115, 2026-06-06)
→ **Livré** : extension `dynamicPower` + **horloge d'actions** (`actionCounter` + stamps model-agnostic round/CT, remplace « ce tour »). Réutilisable B7/B9/B10. Combo Gages différé B4 ; Écho/Chant Canon = reskin « action d'équipe précédente ».
> Chant Canon, Ronflement, Trépignement, Aire d'Herbe, Aire de Feu, Aire d'Eau, Baston, Avalanche, Assurance, Écho, Voix Envoûtante, Chargeur, Feu Envieux, Poing de Colère, Vengeance, Vendetta, Dernier Recours
- Tracking « été touché ce tour » : Avalanche, Vendetta, Assurance.
- KO allié ce tour : Vengeance. Boost cible ce tour : Feu Envieux (brûle), Voix Envoûtante (confuse).
- Répétition : Chant Canon, Écho. Échec précédent : Trépignement. Taille équipe : Baston.
- Cas à part : Aire d'Herbe/Feu/Eau (combo Gages — à trancher), Ronflement (cond. endormi), Dernier Recours (a utilisé les autres moves), Chargeur (prochaine Élec ×2), Poing de Colère.

### Vague 2 — Systèmes de terrain & objet

#### B4 · Terrains (Champs) — 10 moves ✅ **10/10 (clos — plans 117 + 118)**
→ Système terrain (pose un champ + scaling de puissance). Synergie forte avec grille tactique.
> Champ Herbu, Champ Électrifié, Champ Brumeux, Champ Psychique, Gliss'Herbe, Monte-Tension, Vaste Pouvoir, Explo-Brume, Champlification, Force Nature
- 4 poseurs de champ (plan 117) + 6 moves qui scalent/varient selon le champ actif (plan 118, + Boue-Bombe sous-livrable). Moteur de Champs zonés (FFTA), double porte au-sol, barrière anti-dash Psy, Champ'Duit (Étend-Terre).

#### B5 · Objet tenu — 12 moves
→ Système de manipulation d'objet tenu en combat (vol, largage, consommation, destruction).
> Sabotage, Dégommage, Larcin, Implore, Passe-Passe, Tour de Magie, Piqûre, Picore, Calcination, Éructation, Recyclage, Gaz Corrosif
- Vol : Larcin, Implore. Échange : Passe-Passe, Tour de Magie. Largage : Dégommage. KO objet : Sabotage.
- Conso Baie : Piqûre, Picore, Éructation. Destruction : Calcination, Gaz Corrosif. Recyclage.

#### B6 · Pièges au sol (Hazards adaptés) — 4 moves
→ Nouveau système **zone-piège au sol** (déclencheur quand un Pokemon passe dessus, style FFTA).
> Pics Toxik, Picots, Piège de Roc, Tour Rapide
- Pics Toxik (poison), Picots (dégâts), Piège de Roc (dégâts type Roche). Tour Rapide = retrait pièges/bind + boost Vitesse.

### Vague 3 — État de tour & contrôle

#### B7 · Multi-tour (verrou / charge / différé) — 8 moves
→ Système d'état multi-tour (lock d'action, charge, dégâts différés).
> Danse-Fleurs, Mania, Grand Courroux, Brouhaha, Mitra-Poing, Prescience, Relâche, Avale
- Lock + confusion fin : Danse-Fleurs, Mania, Grand Courroux. Charge : Mitra-Poing. Différé : Prescience.
- Brouhaha (uproar). Stockage : Relâche, Avale (compteur Stockpile partagé).

#### B8 · Piège-étreinte (bind) — 4 moves
→ État « ligoté » (immobilise + chip dégâts multi-tour).
> Danse Flammes, Siphon, Tourbi-Sable, Étreinte

#### B9 · Priorité & ordre conditionnel — 9 moves
→ Système priorité conditionnelle / contre / ordre d'action.
> Bluff, Coup Bas, Prio-Parade, Représailles, Poursuite, Ruse, Corps Perdu, Métalaser, Après Vous
- Sucker : Coup Bas, Prio-Parade. Fake out : Bluff. Payback : Représailles, Poursuite. Contre : Métalaser.
- Ruse (traverse protection), Corps Perdu (toujours dernier/never miss), Après Vous (donne le tour).

#### B10 · Entraves & statuts spéciaux — 11 moves
→ Nouveaux statuts/entraves (no-move, heal-block, timer-KO, etc.).
> Anti-Air, Bâillement, Attraction, Dépit, Piège de Venin, Possessif, Dissonance Psy, Regard Noir, Barrage, Vol Magnétik, Requiem
- Attraction (séduction), Bâillement (sommeil différé), Requiem (timer-KO), Dissonance Psy (heal-block).
- Regard Noir / Barrage (no-flee → adapter : no-move ?), Possessif (imprison), Dépit (−PP), Anti-Air (groundé), Vol Magnétik (lévite), Piège de Venin (poison + baisse stats).

### Vague 4 — Stats avancées & finishers

#### B11 · Stats : swap/partage/copie/boost spécial — 9 moves
> Balance, Boost, Permuforce, Partage Garde, Permugarde, Permuvitesse, Acupression, Magné-Contrôle, Cognobidon

#### B12 · Reset stat-stages — 4 moves
> Buée Noire (haze), Anti-Brume (defog), Bain de Smog, Dark Lariat (ignore crans cible)

#### B13 · Taux critique — 4 moves
> Puissance, Affilage, Yama Arashi (crit garanti), Cri Draconique (crit alliés)

#### B14 · Buffs alliés/équipe — 3 moves
> Coup d'Main, Vent Arrière, Grondement

#### B15 · KO direct (OHKO) — 4 moves
→ Mécanique OHKO (à équilibrer pour le format tactique — au cas par cas).
> Abîme, Guillotine, Glaciation, Empal'Korne

#### B16 · PV-fixe / sacrifice / self-KO — 9 moves
> Explosion, Faux-Chage, Effort, Croc Fatal, Tout ou Rien, Souvenir, Vœu Soin, Lien du Destin, Malédiction

### Vague 5 — Systèmes lourds / niche

#### B17 · Changement de type — 5 moves
> Détrempage, Copie-Type, Conversion, Conversion 2, Flamme Ultime
*(Téra-Explosion exclu — décision #422.)*

#### B18 · Manipulation de talent — 4 moves
> Soucigraine, Échange, Suc Digestif, Imitation

#### B19 · Zones de champ globales — 4 moves
→ Règles globales temporaires (à adapter au format tactique).
> Distorsion (trick room), Gravité, Zone Étrange (wonder room), Zone Magique (magic room)

#### B20 · Déplacement forcé / repositionnement — 3 moves
→ Adapté grille : knockback / swap position (pas de switch).
> Cyclone, Projection, Interversion

#### B21 · Redirection de ciblage (aggro) — 2 moves
> Poudre Fureur, Par Ici

#### B22 · Météo — 3 moves
→ Système météo (`weatherSetter` déjà amorcé sur `TacticalOverride`).
> Grêle, Rayon Lune (soin météo-dép.), Aurore (soin météo-dép.)

#### B23 · Copie / capacité aléatoire — 5 moves
> Métronome, Blabla Dodo, Mimique, Photocopie, Copie

#### B-META · Métamorph (batch dédié, hors comptage move pur)
→ Batch transversal : Métamorph (Pokemon) + talent Imposteur + move **Morphing** ensemble.
> Morphing

---

## Récapitulatif batches

| Vague | Batches | Moves |
|---|---|---|
| 1 — Quick wins & fondations | B1 Quasi-prêt, B2 Soin, B3 Dégâts conditionnels | 37 |
| 2 — Terrain & objet | B4 Terrains, B5 Objet, B6 Hazards | 26 |
| 3 — État de tour & contrôle | B7 Multi-tour, B8 Bind, B9 Ordre, B10 Entraves | 32 |
| 4 — Stats avancées & finishers | B11 Stats-manip, B12 Reset, B13 Crit, B14 Buffs, B15 OHKO, B16 Sacrifice | 33 |
| 5 — Lourds / niche | B17 Type, B18 Talent, B19 Zones, B20 Déplacement, B21 Redirect, B22 Météo, B23 Copie, B-META Morphing | 27 |
| **Total** | **24 batches** | **155** |

## Notes d'exécution

- **1 système = 1 batch = 1 plan numéroté** (113, 114, …). Ce plan 112 reste le maître/index.
- Trancher **au cas par cas** avant impl : OHKO (équilibrage), Zones globales (adaptation tactique), Déplacement forcé (règles knockback), combo Gages (Aire d'Herbe/Feu/Eau).
- Mettre à jour `docs/implementations.md` (compteur + renvoi) après chaque batch livré.
