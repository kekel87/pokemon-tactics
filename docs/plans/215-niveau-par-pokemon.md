# Plan 215 — Le niveau appartient au Pokemon, le mode le normalise

**Statut** : in-progress — les quatre lots sont écrits, la recette humaine est passée sur deux
scénarios (niveaux mélangés, non-régression du mode Combat + reprise) ; reste le gate et le commit
**Ouvert le** : 2026-09-18, en cours de route — correction de cadrage demandée par l'humain pendant
l'exécution de l'entrée `backlog-champ-level-mort-et-battle-level-en-dur`
**Bloque la release ?** : non
**Taille** : petit — le moteur est déjà bon, tout le travail est dans la configuration et les modes

## Pourquoi ce plan existe, et pourquoi il arrive en retard

L'entrée de backlog a été attaquée **sans plan**, comme un simple correctif de dette. Elle touchait
en réalité la formule de dégâts, un type d'état sérialisé et `NETWORK_VERSION` — ça méritait un plan
relu avant d'écrire une ligne. Reproche de l'humain, mot pour mot : *« On a pas relu de plan ou
quoi ? »*. Le présent document rattrape ça et **ne recommence pas le travail déjà validé**.

La seconde méprise est de conception, et c'est la vraie raison de ce plan. J'ai fait du niveau un
réglage **global au combat** (`BattleSetupConfig.level`), et j'ai écrit dans le code un commentaire
justifiant de *ne pas* faire de niveau par Pokemon (« pas de sur-ingénierie, l'Aventure n'est pas
engagée »). C'était trancher une question de conception qui ne m'appartient pas.

🔴 **Le cadrage retenu, donné par l'humain le 2026-09-18** :

> « Chaque Pokemon a son niveau. C'est juste quand mode combat/showdown, ce qu'on propose
> actuellement, on force tout à 50. Ça pourra nous débloquer des modes en plus, genre la Little Cup,
> ou tout le monde niveau 100. Mais pour l'aventure, chaque Pokemon a son niveau. »

Ce que ça change, et c'est mieux que ce que je proposais : **le niveau est une propriété du
Pokemon**, pas un réglage de combat. C'est le **format de partie** qui le normalise quand il le
décide. La contrainte passe du combat au format — au bon endroit.

Conséquence immédiate, et elle est **soldée par le lot A** : l'e2e §5.47 comparait un combat entier
au niveau 10 à un combat entier au niveau 50, donc **la cible aussi** descendait et défendait moins
bien — un contre-effet que `test-writer` avait dû documenter comme un biais assumé. On ne baisse
désormais que l'attaquant, et la mesure est propre.

## Ce qui est DÉJÀ FAIT et ne doit pas être refait

Travail du 2026-09-18, dans l'arbre, non commité. Vérifié APRÈS le lot A : 5316 tests unitaires
verts, e2e §5.47 3/3, typecheck 0 erreur, Biome propre sur 1642 fichiers.

| Acquis | Où | Statut |
|---|---|---|
| La formule de dégâts lit `attacker.level` | `damage-calculator.ts:199` | ✅ garder tel quel |
| Prescience gèle le niveau du lanceur | `future-sight-system.ts`, `types/pending-strike.ts` | ✅ garder |
| Constante unique `DEFAULT_BATTLE_LEVEL` | `stat-calculator.ts`, 7 sites alignés | ✅ garder |
| Garde fail-fast (entier 1–100) | `BattleSetup.ts` | ✅ garder, à déplacer par membre |
| `NETWORK_VERSION` 13 → 14 | `protocol.ts` | ✅ garder, **ne pas re-bumper** |
| Tests unitaires de niveau | `damage-calculator`, `future-sight-system`, `sandbox-config` | ✅ garder |
| e2e §5.47 + cahier de recette | `e2e/tests/combat/mechanics-battle-level.spec.ts` | ⚠️ à durcir (lot C) |
| `level` global dans la config | `BattleSetupConfig`, `SandboxConfig`, `SandboxPanel` | ✅ remplacé par du par-Pokemon (lot A) |

🔴 **`PokemonInstance.level` existait déjà et était correct.** Le défaut n'a jamais été dans le
moteur : il était que la formule ne le lisait pas, et que rien ne permettait de le poser. Le moteur
est donc déjà prêt pour des niveaux hétérogènes — aucun changement de cœur dans ce plan.

## Lots

Dépendances, parce que l'ordre n'est pas libre :

```
Lot A (le niveau descend au membre)  ──►  Lot B (le format impose)  ──►  Lot C (tests durcis)
Lot C peut COMMENCER en parallèle de A (le cas « équipe mélangée » n'attend pas le forçage)
Lot D (doc et dettes) s'entrelace n'importe quand
```

Le lot B ne peut pas précéder le A : forcer un niveau n'a de sens que si les Pokemon peuvent en
avoir de différents.

### Lot A — Le niveau descend au membre ✅ FAIT le 2026-09-18

Retirer `BattleSetupConfig.level` (global) au profit d'un niveau **par Pokemon**.

- `BattleSetupConfig` : le niveau rejoint les surcharges par emplacement, à l'idiom des voisins
  (`natureOverrides`, `heldItemOverrides`) — `levelOverrides?: Record<string, number>`. Absent pour
  un emplacement → `DEFAULT_BATTLE_LEVEL`.
- Déplacer le garde fail-fast : il valide **chaque** niveau, pas un réglage unique.
- `SandboxMemberConfig.level?: number` — le niveau se pose par membre d'équipe, comme `nature`,
  `heldItem` ou `ability`, et non plus à la racine du JSON.
- Retirer `SandboxConfig.level` et le champ mémorisé de `SandboxPanel` ; retirer le relais de
  `level` dans les **deux** chemins de `normalizeSandboxConfig`, remplacé par un relais par membre.
- Retirer de `BattleSetup.ts` le commentaire qui justifiait l'absence de niveau par Pokemon.

⚠️ **Le relais par membre doit passer par LES DEUX chemins de `normalizeSandboxConfig`**, qui
recopient champ par champ et jettent en silence tout ce qu'ils oublient. C'est le piège déjà tombé
une fois sur ce même champ, trouvé par `test-writer` — les fixtures e2e sont toutes écrites à plat,
donc un oubli côté `fromLegacy` rend la chose littéralement intestable. Deux sous-points, à traiter
comme deux :

- `fromLegacy(raw)` (forme à plat) : le niveau du joueur et celui du Dummy descendent chacun sur
  leur membre.
- le chemin v2, dans `normalizeTeam(...)` : le niveau descend par membre d'équipe.

Un test unitaire par chemin, à l'image des deux qui existent déjà pour le `level` global.

✅ **FAIT — test du remontage du studio, en e2e et non en unitaire.** `SandboxPanel` reconstruit la configuration entière à
chaque changement, et un champ non porté par `MemberUiState` se perd au premier réglage touché. Le
champ `level` y est désormais porté (état du membre, relu par `readMember`), mais **à l'aveugle** :
`SandboxPanel` n'a aucun test, il exige `getSandboxStudioDom()` et il n'existe pas de harnais DOM
pour lui. Le garde-fou manquant : configuration lue == configuration écrite après un remontage.
`debugTiles` souffre du même trou, préexistant — un test les couvrirait tous les deux.

Écrit en **e2e** (§5.47, 4ᵉ test) plutôt qu'en unitaire : le projet n'a **aucun environnement DOM**
configuré pour vitest, et en ajouter un serait une dépendance de plus — décision qui appartient à
l'humain. Le test pilote donc le VRAI panneau, ce qui prouve davantage. **Rouge-vert vérifié** : en
retirant le report du niveau dans `readMember`, il tombe.

Deux pièges mesurés en l'écrivant, consignés pour le prochain : (1) `waitReady()` n'est **pas**
réarmé par un remontage du studio — il expire à 20 s ; `hoverCard` sonde déjà, il encaisse la
reconstruction. (2) Le **premier** `select` du bandeau est celui de la CARTE : en changer rejoue un
autre combat où le Pokemon n'est plus sur la même case, et le test échoue pour une raison sans
rapport avec ce qu'il prétend prouver. Viser la météo par sa valeur (`option[value="rain"]`).

### Lot B — Le format impose son niveau ✅ FAIT le 2026-09-18

C'est le cœur du cadrage de l'humain, et la part neuve.

**Tranché par l'humain le 2026-09-18** : des règles de format **à part**, pas un champ de plus sur
`MapFormat`. Raison de fond, confirmée en regardant `MapFormat` : il ne porte que de la géométrie
(`teamCount`, `maxPokemonPerTeam`, `spawnZones`) et vient des données de carte — y loger les règles
enfermerait une Little Cup dans les cartes qui l'auraient déclarée, alors qu'un format doit être
jouable partout.

🔴 **Le vocabulaire vient de Showdown et de Stadium, vérifiés à la source** (`sim/dex-formats.ts`),
sur demande de l'humain — et ça a changé la conception. Showdown distingue SIX axes de niveau
(`minLevel`, `maxLevel`, `defaultLevel`, `adjustLevel`, `adjustLevelDown`, `maxTotalLevel`) là où le
plan n'en prévoyait qu'un. La distinction qui compte : `maxLevel` REFUSE une équipe, `adjustLevel`
la RÉÉCRIT. « On force tout à 50 » est donc un `adjustLevel` (modèle VGC), et une Little Cup est un
`maxLevel: 5` — une règle de validation d'équipe, pas de forçage, donc un autre mécanisme. Pokemon
Stadium s'exprime entièrement dans ce vocabulaire (Poké Cup 50-55 somme ≤ 155, Prime Cup tout à 100,
Petit Cup 25-30 somme ≤ 80 non évolués), ce qui confirme les axes : deux conceptions indépendantes
tombées au même endroit.

- Nouveau type `BattleFormatRules` (`packages/core/src/types/battle-format-rules.ts`), **un seul
  champ implémenté** : `adjustLevel?: number`. Les cinq autres axes sont des règles de validation
  d'ÉQUIPE, qui relèvent du constructeur d'équipe — les poser ici sans personne pour les lire serait
  du décor. Les noms sont déjà ceux de Showdown pour que l'ajout reste additif.
- `BattleSetupConfig.formatRules?: BattleFormatRules`. Absent → chaque Pokemon garde son niveau
  (mode Aventure). `adjustLevel` présent → tous y sont ramenés, écrasant les niveaux individuels.
- Les formats actuels (mode Combat / Showdown) posent `50`. Comportement inchangé pour le joueur :
  c'est exactement ce qui se passe aujourd'hui, mais dit explicitement au lieu d'être une constante.
- L'application du forçage se fait **à la construction du combat**, une fois, jamais dans la formule
  de dégâts — qui continue de lire bêtement `attacker.level`.
- Test unitaire du forçage lui-même, distinct de l'e2e : `createBattleFromPlacements` avec un format
  porteur d'un niveau imposé ramène **tous** les Pokemon à cette valeur, quels que soient leurs
  niveaux individuels.

✅ **`battle-resume.ts` : soldé, et par le bon bout.** La règle est posée dans `buildBattle`, le
chemin que la partie vive et la reprise PARTAGENT — au même endroit et pour la même raison
structurelle que `reviveDefeatedCamps` juste au-dessus. Les deux chemins ne peuvent donc pas
diverger par construction, plutôt que par vigilance.

✅ **Questions tranchées le 2026-09-18** :

1. ✅ Des règles de format **à part** — fait, `BattleFormatRules`.
2. La Little Cup : dans Pokemon, c'est **niveau 5 et non évolués**. L'humain a écrit « la Little Cup
   ou tout le monde niveau 100 » — je note les deux comme exemples de formats à palier, sans
   supposer lequel. Le lot B n'ajoute **aucun** format : il rend seulement les formats capables d'en
   imposer un.
3. Faut-il une borne par format (niveau max autorisé pour une équipe) ? Hors périmètre à mon avis,
   mais c'est le voisin immédiat.

### Lot C — Les tests disent la vérité ✅ FAIT le 2026-09-18

- Durcir l'e2e §5.47 : ne baisser que **l'attaquant**, la cible restant au niveau 50. Le biais du
  contre-effet défensif disparaît, l'écart mesuré devient franc et non plus « conservateur malgré
  un contre-effet ».
- Ajouter le cas qui n'existe pas aujourd'hui et qui est le vrai sujet : **une équipe aux niveaux
  mélangés** dans un même combat.
- Test du forçage par format : deux Pokemon de niveaux différents dans un format à `forcedLevel: 50`
  finissent tous deux au niveau 50.
- Mettre à jour le cahier de recette (graphe, entités `recette`, §5.47).

### Lot D — Documentation et dette ✅ FAIT le 2026-09-18

- `docs/multiplayer.md` : entrée du journal réseau pour la version 14 (**manquante**, relevée en
  revue — le journal est tenu jusqu'à 13).
- `docs/architecture.md` : la forme de `SandboxConfig` y est listée sans `level` (elle omet déjà
  `fogOfWar` et `debugTiles`).
- `.claude/agents/sandbox-json.md` : `level` ajouté. 🔴 **Deux champs FANTÔMES trouvés en le
  faisant** — documentés ici et ignorés par le code : `dummyLevel` (qui n'existait pas avant ce
  plan, la ligne était donc fausse) et `dummyBaseStats` (qui n'a jamais existé, retiré). Ce tableau
  sert à fabriquer les configurations de recette humaine : un champ inventé fait croire à un
  scénario testé alors que le réglage n'a rien fait.
- `docs/game-design.md` : consigner que le niveau appartient au Pokemon et que le format le
  normalise. C'est une règle de jeu, pas un détail d'implémentation.

## Dettes connues, à ne pas perdre

Relevées en revue de code le 2026-09-18, laissées ouvertes sciemment. Les deux qui étaient d'abord
listées ici — `battle-resume.ts` et l'absence de test de `SandboxPanel` — ont été **promues en
étapes** (lots B et A) : ce ne sont pas des dettes à porter, ce sont des conditions de fin de lot.

- ✅ **`naive-damage.ts` — SOLDÉ le 2026-09-18.** Le coefficient `0,44` écrit en dur devient
  `powerCoefficientAtLevel(level)` = `(2 × niveau / 5 + 2) / 50`, et `readNaiveDamage` prend le
  niveau de l'ATTAQUANT (trois sites d'appel dans `action-scorer.ts`). Sans ça, l'estimation du
  palier Facile aurait menti dès qu'un Pokemon sort du niveau 50 — ce que ce plan rend possible.
- ✅ **`packages/core/scripts/regenerate-golden-replay.ts` — SUPPRIMÉ le 2026-09-18**, sur accord de
  l'humain. Code mort préexistant : aucun script de paquet, aucune référence dans le dépôt, et il
  doublait `scripts/generate-golden-replay.ts` (le vivant, câblé sur `pnpm replay:generate`). Le
  dossier `packages/core/scripts/` disparaît avec lui.
- ✅ **Le test de scénario instable — SOLDÉ le 2026-09-18.**
  `buildTestEngineFromPlacements` accepte désormais un `random`, et
  `scenarios/ct-scoring-anti-drag.scenario.test.ts` lui passe `createPrng(seed + 2)`. Le paramètre
  est optionnel pour ne décaler aucun nombre chez les appelants qui ne dépendent d'aucun jet.
  Mesuré : 5 passes complètes d'affilée au vert, contre ~1 échec sur 4 avant.
- **Aucune validation des champs de `sandbox-config.ts`** en général : le niveau a reçu un garde
  parce qu'il change les dégâts, les autres champs n'en ont pas.

## Ce que ce plan ne fait PAS

- Il n'ajoute aucun mode de jeu, aucune Little Cup, aucun format niveau 100. Il rend les formats
  *capables* d'imposer un niveau ; les créer est un autre sujet.
- Il n'engage rien sur le mode Aventure, toujours au stade d'idées cadrées (onze entités du graphe).
- Il ne branche **pas** le déplacement ni le temps de charge sur le niveau. `docs/game-design.md`
  veut un mouvement constant quel que soit le niveau, pour qu'un joueur qui apprend au niveau 5 ne
  réapprenne rien au niveau 50. Seuls les dégâts et les PV changent d'échelle.
- Il ne re-bumpe pas `NETWORK_VERSION` : le 14 du jour couvre toute la série.
