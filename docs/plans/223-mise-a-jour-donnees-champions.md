# Plan 223 — Mise à jour des données Pokémon Champions (et Showdown)

**Statut** : done
**Origine** : discussion du 2026-10-04. En comblant les noms espagnols (plan 222), on a constaté que le
rafraîchissement Champions du 2026-07-11 (commit `93527a47`) n'avait jamais été appliqué à `pokemon.json`.
L'humain demande de **tout remettre à jour** (Champions a reçu ~25 commits depuis juillet) **et de
l'appliquer à nos Pokemon**.

## Ce que tu verras à l'écran

- Dans le constructeur d'équipe, 6 Pokemon du roster gagnent des attaques Champions : Rafflesia
  (Vampigraine, Synthèse, Vole-Force…), Grodoudou (Vœu, Vibra Soin, Pouvoir Lunaire…), Persian (Hypnose,
  Représailles…), Canarticho, M. Mime, Scarabrute (Tranche, Piège de Roc).
- Seuls Canarticho (Picpic, Jet de Sable, Groz'Yeux, Taillade, Coupe, Faux-Chage, Vengeance, Vendetta,
  Météores, Rengorgement) et M. Mime (Feuille Magik, Ultimapoing, Métronome) **perdent** des attaques —
  les autres les gardent via leurs pré-évolutions ou leurs sets prédéfinis.
- Tranche frappe plus fort (puissance 70 → 80, même tempo).
- Les descriptions anglaises des attaques restent présentes (Showdown les a déplacées, le générateur suit).
- Une équipe sauvegardée avec une attaque perdue (Canarticho, M. Mime) : comportement constaté et annoncé.

## Mesure faite (régénération à blanc, sources fraîches, 2026-10-04)

- **Attaques implémentées** : 2 changements de données — Tranche (`slash`) puissance 70 → 80 ;
  Vole-Force (`strength-sap`) et Vœu (`wish`) PP 10 → 5. **Aucun effet CT** (game-designer) : PP < 12
  → palier 900 avant comme après ; Tranche reste à 600 (tempo 2), seul le dégât change.
- **Talents** : aucun changement de données. Deux écarts de description Champions à trancher :
  Cœur Soin — description Champions « 50 % », notre handler code 30 % (`HEALER_CURE_CHANCE`, écart
  **antérieur**) ; Poing Invisible — Champions retire « 1/4 des dégâts ».
- **Objets** : aucun changement.
- **Attaques apprenables** : 70 Pokemon changent dans la référence, dont 7 jouables. Mais le jeu cumule la
  lignée d'évolution + les sets prédéfinis + `learnset-extensions` (`getLegalMoves`) : en **légalité réelle**,
  6 gagnent, 2 perdent (Canarticho, M. Mime), Dracaufeu ne bouge pas. Aucun set prédéfini n'utilise une
  attaque réellement perdue.
- **83 surcharges Champions ignorées** (identifiants absents de notre base : 1 attaque, 2 talents,
  52 objets, 28 formes régionales/Méga) — inchangé dans l'esprit, hors roster.
- 🔴 **Régression de la source** : `play.pokemonshowdown.com/data/moves.json` ne contient plus `desc` /
  `shortDesc`. Sans correction, **toutes les descriptions anglaises des attaques deviennent vides**.
  Nouvelle source : `raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/moves.ts`.
- Les changements de code de combat Showdown (Malédiction, Entrave, Encore, Échappatoire, Fuite…) sont
  des corrections d'interactions du simulateur Showdown, pas des données : `game-designer` dit lesquelles
  concernent notre moteur.

## Travail

1. **Générateur** (`packages/data/scripts/build-reference.ts`) : lire les descriptions d'attaques depuis
   `data/text/moves.ts` (parse TS comme `abilities.ts`), en cache `showdown/text-moves.ts`.
2. **Rafraîchir** les sources Showdown + Champions (`pnpm data:update` après purge de
   `.cache/showdown` et `.cache/champions`) ; PokeAPI reste en cache (aucun changement attendu).
3. **Vérifier** : comparer l'output JSON généré à la mesure ci-dessus (70 Pokemon + 7 jouables, changements de données) ; noms FR/ES intacts ; `i18n-sync` vert.
4. **Conséquences en jeu** :
   - sets prédéfinis (`op-sets`) et ajouts manuels (`learnset-extensions`) qui deviendraient illégaux
     pour les 7 Pokemon → corriger les sets ;
   - équipe sauvegardée avec une attaque devenue illégale : constater le comportement actuel (validation
     au chargement ?) et le rapporter avant toute correction ;
   - tests du core qui figent Tranche à 70 ou un coût CT de Vole-Force / Vœu → mettre à jour.
5. **Écarts de mécanique** : appliquer ce que `game-designer` retient (Cœur Soin 30 % vs 50 %, Poing
   Invisible) — tests core d'abord.

## Hors périmètre

- Nouvelles formes / objets Champions absents de notre base (les 83 ignorées).
- Changement de PokeAPI (noms, descriptions FR/ES) — rafraîchissement séparé si besoin.
- Paliers (tiers) et bannissements Champions OU/UU : sans objet pour le jeu.

## Risques

- Une équipe sauvegardée d'un joueur peut devenir illégale (Rafflesia avec Méga-Sangsue, etc.).
- Le parse de `text/moves.ts` dépend d'un format Showdown qui peut encore bouger : test de non-vide.
