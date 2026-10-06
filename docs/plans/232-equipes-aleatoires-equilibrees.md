# Plan 232 — Équipes aléatoires : dernier stade avec build seulement

**Statut** : done
**Origine** : `/next` du 2026-10-06. Retour du frère de l'humain (2026-09-19, partie en ligne réelle) :
`feedback-equipes-aleatoires-desequilibrees-2026-09-19` — « les équipes aléatoires sont vraiment
déséquilibrées ». Cadrage de l'humain (2026-10-06) : « que des Pokemon à leur dernier stade, et
peut-être avec un build. On verra si on va plus loin. »

## Ce que tu verras à l'écran

1. Une équipe aléatoire ne contient plus que des Pokemon à leur **dernier stade d'évolution** et qui
   ont un **vrai build** : fini Magicarpe, Chenipan ou Rattata avec un build par défaut.
2. Le tirage se fait parmi **81 Pokemon** (au lieu de 151) : exactement tous les Pokemon au dernier
   stade. Métamorph y est, avec un vrai build (Imposteur, Morphing, Mouchoir Choix).
3. Une équipe tirée est toujours **valide** : jamais deux fois le même objet, jamais deux Pokemon de
   la même famille (Aquali et Pyroli s'excluent) — les règles d'une équipe composée à la main.
4. Le bouton « équipe aléatoire » de « Mes équipes » suit la même règle.
5. En ligne, les deux joueurs doivent avoir la nouvelle version (le numéro de version réseau change).

## Le constat chiffré (2026-10-06)

- 151 Pokemon jouables. **81 au dernier stade**, **80 avec build** : les deux ensembles coïncident,
  à Métamorph près (dernier stade, aucun build). Aucun Pokemon avec build n'est une pré-évolution.
- Les 71 hors pool sont des formes de base : base totale médiane **320** (contre **490** pour le pool),
  et ils tombaient sur `defaultSlot`, un build par défaut faible.
- Tirage actuel : 6 parmi 151 sans contrainte → ~2,8 Pokemon faibles par équipe en moyenne, mais une
  équipe peut en avoir 0 et l'autre 5. C'est l'essentiel du déséquilibre ressenti.

## Comment les autres font (demandé dans le retour) — pour la suite

| Approche | Exemple | Pour nous |
|---|---|---|
| Pool restreint aux sets soignés | Showdown Random Battles | ✅ ce plan |
| Compensation par niveau | Showdown Random Battles (niveau selon le tier) | ❌ pas de niveaux variables dans le moteur |
| Tirage par paliers / budget de points | Ligues de draft Pokémon | piste suivante si l'écart reste ressenti (une pioche par tranche de puissance, sans interface) |
| Draft (choix alternés dans un pool commun) | Ligues de draft, MOBA | lourd : interface + échange réseau |
| Miroir (même équipe des deux côtés) | Modes « mirror » | équitable mais tue la variété |

Écart restant dans le pool : base totale de 377 (Canarticho) à 680 (Mewtwo). Gardé tel quel — on
attend un retour avant d'aller plus loin (paliers, exclusion de Mewtwo).

## Décisions

- **Pool = Pokemon jouables au dernier stade ET avec au moins un build** (choix de l'humain : ET, pas
  OU). Le dernier stade garantit la puissance, le build garantit un vrai build.
- **Rien en dur — exigence de l'humain** : ajouter un build ou une génération ne demande aucune
  modification de code. « Dernier stade » = aucun Pokemon *jouable* n'évolue depuis lui
  (`isFinalEvolutionStage`, `packages/data/src/playable/final-evolution-stage.ts`, calculé depuis
  `evolvesFrom` des données de référence). Nosferalto est dernier stade tant que Nostenfer n'est pas
  jouable, puis sort seul du pool. Un Pokemon sans build reste hors du tirage jusqu'à ce qu'on lui en
  écrive un.
- **Le filtre est propre au tirage** (`randomTeamPool` dans `team-generator.ts`), jamais appliqué à
  `getPlayablePokemon()` qui alimente aussi le constructeur d'équipe.
- **Métamorph inclus** (choix de l'humain) : il était le seul des 81 sans build (le README des builds
  en demande un par Pokemon). Ajout de `ditto-imposter-scarf` — son build par défaut était déjà
  Morphing + Imposteur, rien de faible.
- **Build** : le premier build du Pokemon dont l'objet est encore libre. `defaultSlot` (seul appelant :
  le générateur) devient inaccessible → supprimé (code mort). Le genre déclaré par le build est
  respecté (Attraction de Ronflex, mâle) ; un genre déjà choisi dans le constructeur reste prioritaire.
- **Équipe tirée = équipe valide** (trouvaille de `/code-review` en menu, arbitrée par l'humain :
  « faut que les équipes tirées soient valides ») : avant, 461 tirages sur 500 avaient un objet en
  double et 11 sur 500 deux Pokemon de la même famille — rien ne le bloquait au lancement. Le tirage
  écarte un Pokemon dont la famille est prise (`getSpeciesRoot` du registre, le même que le
  validateur) ou qui n'a aucun build à objet libre. Vérifié sur 2 000 graines : 0 équipe invalide,
  toujours 6 Pokemon, les 81 espèces sortent.
- **Conversion build → emplacement partagée** (`slotFromOpSet`, `team-helpers.ts`) entre le tirage et
  le bouton « appliquer un build » du constructeur d'équipe.
- **Tirage** : sans remise, même PRNG, une graine par place → déterministe, schéma réseau inchangé.
- **`NETWORK_VERSION` 17 → 18** : le tirage depuis une même graine change.

## Étapes

1. `isFinalEvolutionStage` dans `packages/data/src/playable/`, exporté par le paquet. ✅
2. `team-generator.ts` : `randomTeamPool` (dernier stade ET build), `slotFromOpSet`, suppression de
   `defaultSlot`. ✅
3. Build de Métamorph dans `op-sets.json`. ✅
4. `NETWORK_VERSION` → 18. ✅
5. Tests (menu de finalisation, après recette) : `isFinalEvolutionStage` (Florizarre oui, Bulbizarre
   non, Métamorph oui) ; générateur : 6 Pokemon distincts, tous au dernier stade avec build,
   déterminisme existant (`team-generator.determinism.test.ts`).

## Hors périmètre

- Paliers de puissance, exclusion de Mewtwo, varier le build d'un même Pokemon, contraintes de types,
  draft interactif.
