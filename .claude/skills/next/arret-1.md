# Arrêt 1 : « Tu testes ? » avec confiance et preuves

À lire une fois le dev fini, `typecheck` et tests du core verts, `/simplify` passé. Plan 248.

## Étapes

1. **Lister les comportements changés**, vus par le joueur (noms FR officiels), un par ligne : ce seront
   les scénarios de l'approfondie. Critère : chaque ligne dit ce qu'on voit ou fait en jeu.
2. **Classer chacun par sa meilleure preuve** (rangs ci-dessous), avec son artefact. Critère : aucune ligne
   au rang 1 sans commande et ligne de sortie, ou chemin de capture.
3. **Tenter le rang 1** pour chaque comportement neuf resté au rang 2 ou 3, quand une voie scriptable existe
   (partie sandbox lancée par Claude, log de combat lu). Pas de voie : le laisser à son rang. Critère : le
   rang affiché est celui atteint, pas celui espéré.
4. **Déduire** la confiance, puis la profondeur suggérée (grille ci-dessous). Critère : la règle qui fixe
   la profondeur est nommée.
5. **Écrire le message** dans l'ordre du modèle, preuves d'abord, suggestion en dernier, puis poser la
   question. Critère : une seule `AskUserQuestion`, la suggestion en premier avec « (Recommandé) ».

## Rangs de preuve

1. **Observé** : vu en vrai, dans une partie sandbox, un log de combat ou une capture, par Claude ou
   l'humain.
2. **Test vu rouge** : test automatisé (unitaire, intégration, `test:scenario`, e2e) qui a échoué avant le
   correctif puis passé. Un test n'est pas une observation : il prouve la règle, pas la partie.
3. **Déduit** : typecheck, lecture du code, test jamais vu rouge.
4. **Non vérifié**.

## Grille

Confiance = rang du comportement le plus faible : 1 → haute, 2 → moyenne, 3 ou 4 → basse. Jamais au
ressenti, jamais en pourcentage : un modèle surestime son propre travail.

Profondeur : haute → sauter, moyenne → rapide, basse → approfondie. L'approfondie est suggérée quelle que
soit la confiance si un de ces cas s'applique :
- rendu, animation, lisibilité ou ressenti à juger ;
- équilibrage : un chiffre, un coût ou une règle de design change (puissance, portée, multiplicateur de
  talent, écart à VGC) ; un test prouve la formule, pas l'équilibre ;
- croisement de deux familles (talent, objet, terrain, statut, champ) ou site de résolution partagé
  (dégâts, effets, suppression de talent) : le test d'une paire ne couvre pas les triplets ;
- comportement de l'IA (score, ciblage, anti-boucle) ou qui se joue sur plusieurs tours : une seule partie
  observée ne lève pas le critère ;
- réseau, déterminisme, format persisté (replay, sauvegarde, protocole) ;
- correctif d'un point refusé en recette.

Le message ne dit jamais « prêt » ni « ok » : seulement les faits et « aucune anomalie détectée par les
règles connues, non exhaustif ». L'humain tranche.

## Modèle du message

Avant le message : `git status --porcelain` et un résumé du changement en 2 lignes.

```
Preuves
- <comportement> : <rang> (<artefact>)
Non vérifié : <liste, ou « rien »>. Aucune anomalie détectée par les règles connues, non exhaustif.
Confiance : <haute|moyenne|basse> (le plus faible : <comportement>)
Suggestion : <profondeur>, règle « <critère ou grille> ».
```

Question « Tu testes ? », trois options, la suggestion en tête :
- `Approfondie` : N scénarios, un par comportement (skill `/recette`).
- `Rapide` : 1 scénario, nommé : celui de rang le plus faible, à risque égal le plus visible pour le joueur
  (skill `/recette`, branche rapide).
- `Sauter` : droit au `/menu`.

## Exemple : plan 247, reconstruit après coup

L'échec des tests n'a pas été vu à l'époque : ils restent au rang 3. Ne compter « test vu rouge » que
pour un échec vu dans cette session.

```
Preuves
- Lumargile sous Zone Magique : Mur Lumière dure 5 tours, pas 8 : déduit (aura-system.test.ts, rouge non vu)
- Champ'Duit sous Zone Magique : le champ dure 5 tours : déduit (field-terrain-system.test.ts, rouge non vu)
- Feunard pose 8 tours de soleil au début : déduit (test existant sur un Goupix de test, lecture de op-sets.json)
- L'IA joue Vœu Soin avec Feunard : non vérifié
Non vérifié : Vœu Soin joué par l'IA. Aucune anomalie détectée par les règles connues, non exhaustif.
Confiance : basse (le plus faible : Vœu Soin joué par l'IA)
Suggestion : approfondie, règle « croisement de deux familles » (objet et Zone Magique).
```
