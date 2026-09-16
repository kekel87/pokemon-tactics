# Plan 213 — La dette choisie avant la release

**Statut** : done
**Terminé le** : 2026-09-16
**Revu le** : 2026-09-16 par `plan-reviewer` (trois faits corrigés) et `game-designer`
(lot G chiffré, deux limites arbitrées par l'humain)
**Ouvert le** : 2026-09-16, sur choix de l'humain à la relecture du backlog d'après le plan 212
**Bloque la release ?** : **OUI, par décision de l'humain** — « je veux essayer de traiter tout ça
avant la release ». Ce n'est pas un blocage technique : aucune de ces entrées n'empêche de publier.
**Taille** : moyen — dix entrées de backlog, hétérogènes, dont une seule touche au jeu.

## Pourquoi ce plan existe

Le backlog a été relu après le plan 212. Il reste **16 entrées ouvertes et une seule question
ouverte**. L'humain en a choisi **dix**, et a tranché qu'elles passaient **avant** la release.

Le fil qui les relie n'est pas technique, il est temporel : ce sont des choses qu'on a vues, dites,
et laissées — presque toutes relevées en revue de code entre le 2026-09-09 et le 2026-09-14, pendant
la poussée finale du multijoueur. Les traiter maintenant, c'est refuser de publier par-dessus.

🔴 **Une raison de fond existe pour l'ordre choisi**, et elle vaut d'être écrite : le lot A corrige
une suite e2e instable, et c'est la famille qui couvre **précisément le multijoueur qu'on s'apprête à
livrer**. Une suite qui rougit au hasard finit par être ignorée, et elle le devient au pire moment —
quand on s'appuie dessus pour publier.

## Ce qu'il faut faire

### Lot A — La famille e2e en ligne, instable à froid

**Le symptôme, mesuré** : 2 échecs sur 8 tests à la **première** exécution groupée (2 workers), puis
4 passes propres d'affilée sans rien changer. 1 échec sur 5 exécutions, **uniquement la première**.
Les noms des tests tombés n'ont jamais été capturés — le filtre de sortie les avait mangés.

**La piste, relevée en revue le 2026-09-10 puis RECONTRÔLÉE DANS LE CODE le 2026-09-16.** L'entrée de
backlog parlait de « quatre assertions du chemin de l'hôte sur le délai par défaut ». La lecture donne
quelque chose de **plus étroit et de plus net** — et il faut le dire, parce que deux des quatre
n'existent pas comme décrit :

- 🔴 **La vraie asymétrie, et c'est la bonne suspecte** : `openRoom()` (l'HÔTE) attend
  `room.panel` sur le **délai par défaut**, `e2e/pages/online-session.ts:121` ; `joinRoom()`
  (l'INVITÉ) attend **le même localisateur** avec un **30 s explicite**, ligne 133. Même attente, même
  élément, six fois moins de marge du côté hôte. Or le commentaire d'`openRoom` dit lui-même ce qu'on
  y attend : « **le code naît à l'entrée sur la salle d'attente** » — donc la prise d'identifiant chez
  l'annuaire, un aller-retour réseau, sur un serveur PeerJS possiblement en train de démarrer au
  premier test. C'est exactement le profil d'un rouge à froid.
- ⚠️ **`host.maps.title` n'existe pas.** Aucune assertion `maps` dans `online-session.ts` : l'entrée de
  backlog nommait une chose absente. Ne pas la chercher.
- ⚠️ **`host.room.ready` n'est pas une asymétrie** : `guest.room.ready` court sur le défaut lui aussi
  (lignes 15 et 20). Les deux sont courts, ce qui est un autre sujet — une marge faible partagée, pas
  un déséquilibre entre les deux côtés.
- Les attentes coûteuses sont déjà couvertes : `host.room.launch` à 30 s, et les deux `scene.waitReady`
  à 30 s.

**Ce qu'on en fait :**

- **L'asymétrie sur `room.panel` est un FAIT vérifié**, pas une hypothèse : même localisateur, cinq
  secondes contre trente. On peut la corriger sans avoir établi la cause du rouge — c'est une
  correction de cohérence, pas un diagnostic.
- ⚠️ **Mais on ne consigne PAS cette asymétrie comme LA cause.** L'entrée de backlog le dit
  explicitement : il faut la trace du prochain rouge (`test-results/`) pour nommer l'assertion
  fautive. Corriger et prétendre avoir trouvé sont deux choses différentes.
- **Second front, le même défaut vu par l'autre bout** : les budgets du pilote sont incohérents avec
  le chronomètre de 60 s — le pire cas d'un tour cumule `awaitTurn` 45 s + `actAndPropagate` 30 s +
  `awaitTurn` 45 s. Sous contention, un tour perdu au chrono **ne fait pas échouer le test**, il
  compte un tour manqué — et au troisième on retombe sur le faux vert de `#981`.
- **Reproduction** : `rm -rf packages/app/dist` puis `--repeat-each=3`, **sans filtrer la sortie**.
- **Ce que ce lot répondra** : la suite en ligne est-elle fiable à froid, c'est-à-dire dans l'état où
  la CI la trouve toujours ?

### Lot B — La dette de harnais e2e en ligne

Relevée en revue du Lot B4 (2026-09-10), laissée en l'état. Cinq points, dont **un vrai défaut** :

- 🔴 **`OnlineDuel.cast` duplique `CombatScene.castMove`, et les deux flux ONT DIVERGÉ** : le clone a
  perdu la gestion de `skippedTargeting()` et clique la case **deux fois inconditionnellement**.
  Inoffensif pour les cibles simples et Téléport, donc invisible jusqu'ici. **La bonne réponse n'est
  pas de resynchroniser le clone** mais de déplacer les deux garde-fous **dans** `castMove` : un clic
  sur un bouton grisé fait pendre n'importe quel spec, pas seulement celui-là.
- Deux notions concurrentes de « qui a la main » : `OnlineDuel.awaitTurn`/`readTurn` et
  `OnlineSession.peerWithHand` sondent la même chose. La duplication est **motivée** (`peerWithHand`
  attend 30 s une main qui ne revient jamais après la fin de partie) — la réponse est d'y replier le
  cas « partie finie », pas de supprimer l'un des deux.
- `SHADOW_BALL_RANGE` et `TELEPORT_RANGE` recopient `packages/data/src/overrides/tactical.ts` : un
  rééquilibrage les périmerait **en silence**. Meilleure réponse : **ne pas calculer la portée du
  tout** — ouvrir Attaque, lire `data-enabled` sur la ligne, frapper si vrai, se téléporter sinon.
- `new OnlineDuel(session)` dans le corps des tests, contre la règle « POM via fixtures » de
  `.claude/rules/e2e.md`. Un getter `session.duel` le supprime.
- Menu : bloc de doc orphelin dans `online-duel.ts`, `interface Tile` et `manhattan` dupliqués depuis
  `e2e/capture/combat-pad.ts`.

### Lot C — Le sélecteur `e2e-affected`

Deux entrées à traiter, **une à fermer par constat**.

- **Sur-couverture sur le périmètre outillage** : `scripts/tsconfig.json` et `vitest.config.ts`
  matchent `isConfigBuild`, donc escaladent en 64 fichiers de specs, 307 tests, **3,4 min** — pour un
  diff qui ne touche QUE l'outillage. Cause : la règle « outillage » (`scripts/`, `.github/` → aucune
  famille) ne les voit **jamais**, les fichiers de config étant écartés du routage avant `route()`.
  Piste : dans `isConfigBuild` ou juste après, exclure les configs vivant sous `scripts/` ou
  `.github/` — elles ne produisent aucun octet livré.
  ⚠️ C'est de la **sur**-couverture : ça coûte du temps, **ça ne ment pas**. Aucun risque à corriger,
  aucun danger à ne pas corriger.
- **Parsing de tuning de move non testé** : `changedMoveIds` (lecture des en-têtes de hunk `@@`) et
  `specsForId` ne sont pas couverts, parce qu'ils dépendent de `git`. Risque contenu — si ce parsing
  casse, `unmapped` se remplit et le sélecteur replie sur `mechanics` + `combat`, donc **dans la
  direction sûre**. C'est néanmoins le seul endroit du fichier où une régression ne se verrait pas du
  tout, d'où la couverture.
- ❌ **`famille-visual-marge-nulle` : FERMÉE PAR CONSTAT, rien à coder.** Son propre texte dit « à
  savoir, pas à corriger ». La famille `visual` ne tient qu'à un spec ; le déplacer ferait escalader
  tout changement de rendu en suite entière — comportement **voulu**, le biais du fichier étant
  conservateur. Ajouter un second spec pour rembourrer une famille serait inventer du travail. La
  note du graphe est le filet. Arbitré avec l'humain le 2026-09-16.

### Lot D — La collision de numérotation du cahier de recette

`online-lobby.spec.ts:363` et `:409` (« solo → en ligne ») portent le **même §11.3** que
`online-resilience.spec.ts:41` (« le canal tombe, le pair revient »). Le cahier **s'indexe par
numéro** : deux scénarios différents répondent au même appel.

- ⚠️ Renuméroter touche **le cahier ET les titres de test**, donc le graphe et le code ensemble.
- ⚠️ L'entrée de backlog suggérait §11.9 et §11.10 comme libres — **c'est périmé** : ils sont pris
  par `online-combat-menu.spec.ts`, et la famille est montée jusqu'à §11.18 (plan 212). **Les premiers
  numéros réellement libres au 2026-09-16 sont §11.19 et §11.20** — vérifiés, mais à recontrôler au
  moment de poser le code : ce plan n'est pas le seul à en consommer.
- Le même piège a déjà mordu au plan 212 : un premier jet portait §11.17, déjà pris par
  `online-watching-cursor.spec.ts`, et `-g "§11.17"` faisait tourner deux scénarios sans rapport.

### Lot E — Conventions du paquet réseau

- **`Listeners<Args>` dupliqué HUIT fois, et non sept.** La forme exacte que ce gabarit remplace dans
  `room.ts` — un `Set`, `add`, une fermeture de `delete`, une émission sur copie, `clear` — subsiste
  **huit fois** ailleurs : `peer-connection.ts` (`incomingListeners`, `messageListeners`,
  `closeListeners`, `healthListeners`) et `testing/fake-transport.ts` (les quatre mêmes). **L'entrée
  de backlog disait sept** ; le comptage a été refait dans le code le 2026-09-16. Deux idiomes
  coexistent dans le paquet depuis le 2026-09-09.
  ⚠️ L'entrée disait « à proposer à l'humain avant de la traiter, **jamais à glisser dans un autre
  chantier** » — parce qu'élargir un refactor annoncé sans changement de comportement est le vrai
  risque. **C'est fait** : l'humain l'a explicitement demandée le 2026-09-16. Elle a donc son lot à
  elle, et rien d'autre ne s'y ajoute.
- **`ForfeitReason.Desynced` renommé.** La valeur du moteur porte un concept qui n'existe **qu'en
  réseau** — un moteur seul ne peut pas se désynchroniser avec lui-même. Vers `InternalConflict` ou
  `StateViolation`, les trois cas devenant abandon volontaire / déconnexion / conflit d'état interne.
  ⚠️ **L'entrée argumentait CONTRE** : « à ne faire que si une deuxième valeur réseau-teintée se
  présente — un renommage seul ne paie pas son coût ». Aucune n'est apparue depuis. **L'humain a
  confirmé le 2026-09-16 de le faire quand même.** C'est son arbitrage, il est noté comme tel.
  Le découplage est intact (zéro import réseau dans le core) et la valeur ne sort jamais telle quelle
  à l'écran — le journal traduit par clé i18n. Le renommage est donc sans risque fonctionnel.

### Lot F — Les suggestions de revue du menu de combat

Trois des quatre points de la revue du 2026-09-14 (`decision-1038`), tous classés Minor :

- **`combat-menu.ts`, le rappel dans le niveau** : `{ kind: 'confirm', action, run }` rendrait
  l'inatteignabilité du `onRestart?.()` **structurelle** au lieu d'être affirmée par un commentaire.
  Aujourd'hui l'appel optionnel est un artefact de rétrécissement — `onRestart` est déstructuré hors
  de la fermeture, et TypeScript ne propage pas le `if (onRestart)` de `renderRoot` jusqu'au
  gestionnaire de confirmation.
- **`launchOnlineBattleAlone` monte au POM** : née dans `online-combat-menu.spec.ts`, c'est une
  chorégraphie réutilisable qui monte un combat **en ligne** en ~3 s au lieu de ~45 s, en dressant la
  place libre en IA. `OnlinePeer.launchAlone({ interactivePlacement })`. Sans ça, le prochain spec
  qui voudra une partie en ligne bon marché la recopiera.
- **`action` et `variant` en const object enums** : unions de littéraux sur lesquelles le code
  branche, là où la convention projet demande des énumérations. Pré-existant.
- ❌ **Le quatrième point n'est PAS à faire** : le spread `...(onRestart === undefined ? {} :
  { onRestart })` de `mountPlacementChrome` est inutile (`exactOptionalPropertyTypes` n'est pas
  activé), mais c'est **l'idiome du fichier**. Le retirer seul créerait une incohérence locale pour
  rien. Laissé tel quel, comme la revue l'avait déjà tranché.

### Lot G — Le ciblage de l'IA en FFA

**Le seul sujet de jeu du plan, et le seul qui ne soit pas de la dette.** Revu par `game-designer` le
2026-09-16, qui a chiffré les poids et trouvé deux angles morts — tous deux arbitrés par l'humain.

`getAliveEnemies` (`packages/core/src/ai/action-scorer.ts:2685`) traite **tout camp adverse à
égalité** : aucune pondération pour celui qui mène, aucune protection du plus faible. Or la dynamique
classique du FFA est que tout le monde tape le premier qui dépasse. Vrai depuis que les formats à N
camps existent en solo ; le plan 209 n'a fait que l'exposer humain contre humain.

#### Ce qui est tranché

**Biais DOUX — ×1,2 pour le meneur, ×0,9 pour le traînard, ×1,0 pour tous les autres.** Pas de
gradient continu : seuls les deux extrêmes sont touchés, ce qui colle aux rôles singuliers
(« le meneur », « le traînard ») et reste testable simplement.

**Chiffrage vérifié sur le barème réel** (`killPotential: 10`, `typeAdvantage: 3`) :

| Situation | Sans biais | Avec biais | Verdict |
|-----------|-----------|-----------|---------|
| Deux cibles à dégâts égaux | 2,0 / 2,0 | **2,4** / 2,0 | Le départage voulu, net à 20 % |
| Meneur non létal vs K.O. ailleurs | 1,5 / **10** | 1,8 / **10** | La létalité écrase, aucune inversion |
| Meneur résisté vs cible neutre | 1,0 / **2,5** | 1,2 / **2,5** | **Une simple résistance suffit à annuler le biais** |

C'est exactement ce qu'on voulait : l'avantage ne fait que départager des cibles équivalentes.

**Mesure de « qui mène »** : `hpFraction(camp) = Σ currentHp / Σ maxHp` du camp. **Fraction seule, sans
mélange avec le nombre de vivants** — elle règle le cas « six Pokemon tous blessés ne mènent pas »,
reste bornée à [0,1] quelle que soit la taille d'équipe, et garde une granularité continue même à un
Pokemon par camp. Un mélange ajouterait un poids arbitraire pour une nuance : on commence simple.

🔴 **Garde anti-égalité** : si l'écart entre le plus fort et le plus faible est sous un epsilon (début
de partie, tout le monde à 100 %), **personne** n'est désigné. Sans ça, un artefact d'ordre
d'itération de `Map` élirait un « meneur » au hasard.

**Biais CONSTANT sur les trois profils.** Comme il est multiplicatif, son poids relatif (±20 % /
−10 %) reste identique quel que soit le barème du profil — il est donc auto-cohérent avec Facile,
Moyen et Difficile sans rien recalibrer. Pas d'axe de réglage supplémentaire sans justification.

#### La neutralité est STRUCTURELLE, et elle couvre plus que le 1v1

🔴 **Correction d'une formulation trop étroite de ce plan.** Ce n'est pas « sans effet en 1v1 », c'est
**sans effet dans TOUT format à deux camps** — 2v6 et 4v4 compris, qui pèsent dans les 21 parties sur
22 mesurées en production.

La garde se pose sur le **nombre de camps ennemis distincts**, pas sur le format :

```ts
const enemyCampIds = new Set(enemies.map((enemy) => enemy.playerId));
if (enemyCampIds.size < 2) return neutral;  // rien à départager
```

`getAliveEnemies` définit déjà « ennemi » comme tout `playerId` différent du mien, donc
`enemyCampIds.size` vaut **exactement 1** dans tout combat à deux camps. Le rang meneur/traînard n'a
alors aucun sens à définir, et le code se court-circuite **avant tout calcul de score**. Ce n'est pas
une propriété approximative du réglage des poids, c'est une garde qu'un test prouve par égalité
**stricte** des scores avec et sans le code de biais.

#### ⚠️ Deux limites ASSUMÉES, arbitrées par l'humain le 2026-09-16

**(1) Le biais ne joue que sur le CIBLAGE, jamais sur le déplacement.** `scoreMove`,
`closestDistanceToEnemies` et `findClosestEnemy` ne connaissent pas `playerId` et **ne sont pas
touchés**. Conséquence assumée : l'IA ne se met **jamais en route** vers le meneur — elle le préfère
seulement quand il est **déjà à portée en même temps qu'un autre camp**. À 3 et 4 camps c'est
fréquent ; **à 12 camps à un Pokemon, un tour n'a souvent qu'un seul ennemi à portée, donc rien à
départager — le biais y sera rarement discriminant**.
Pourquoi on s'arrête là : teinter le déplacement toucherait l'IA de **toutes** les parties, deux camps
compris, parce que `scoreMove` gouverne aussi la couverture, la fuite et le placement défensif. C'est
un second chantier, pas une extension.

**(2) Le biais ne vit que dans `scoreDamagingMove`**, le chemin commun dégâts/statut. Une quinzaine de
fonctions spécialisées choisissent leur cible indépendamment — Malédiction, Croc Fatal, Guillotine,
Morphing, Provoc, Cyclone, Coup Bas… — et **n'en bénéficieront pas**. Un Pokemon dont le meilleur coup
contre le meneur est Provoc ne le préférera donc pas. Incohérence réelle mais discrète ; factoriser un
helper partagé multiplierait la surface touchée et ferait sortir ce lot de sa taille.
🔴 **Un test documente sciemment cette limite** plutôt que de la laisser découvrir plus tard comme un
bug.

#### Où

- Le facteur s'applique au **sous-total PAR CIBLE** dans `scoreDamagingMove`
  (`action-scorer.ts:2382-2427`), jamais au score total de l'action — sinon il fausserait aussi la
  pénalité de tir ami et le poids CT d'`applyCtWeight`.
- Le poids appartient à `AiProfile.scoringWeights` (`packages/core/src/types/ai-profile.ts`), comme
  `killPotential`, `typeAdvantage`, `positioning` et `statChanges` — **pas une constante en dur**.
- Précédent architectural à suivre : le bonus « menace n°1 » de `threat-detection.ts`
  (`highestThreatEnemy`) fait déjà exactement ce genre de pondération par cible.

#### Tests — **écrits AVANT le code** (mécanique de core)

Dans `packages/core/src/ai/action-scorer.test.ts`. Les neuf, pas seulement le premier :

1. 🔴 **Neutralité stricte à deux camps** — le test qui protège le plus de trafic. Scores **identiques**
   avec et sans le biais, pas « proches ».
2. **Départage positif** : trois camps, deux cibles rigoureusement équivalentes sauf le camp → celle
   du meneur score strictement plus haut.
3. **Non-domination sur la létalité** : un K.O. garanti ailleurs reste préféré.
4. **Non-domination sur le type** : une cible du meneur **résistée** perd contre une cible neutre.
5. **Protection du traînard**, symétrique du départage.
6. **Aucun meneur sur égalité parfaite** — la garde anti-artefact d'itération.
7. **Granularité à 12 camps** : plusieurs camps à un Pokemon, PV 90 / 60 / 20 % → le classement reste
   correct. Prouve que c'est bien la **fraction** et non un décompte brut qui est implémenté.
8. **Zone multi-camps** : seule la contribution de la cible du meneur est multipliée, pas le score
   total de l'action.
9. **La limite documentée** : un move de statut pur ne reçoit **aucun** biais (limite 2 ci-dessus).


## Ce qui s'est réellement passé

**Deux vrais défauts, aucun des deux prévu par ce plan.**

1. 🔴 **Le biais de camp était silencieusement MORT** (lot G). `campBiasFactors` recevait
   `state.pokemon.values()` — un **itérateur à usage unique** — et le parcourait deux fois. Le second
   passage voyait une liste vide, donc des vigueurs nulles, donc aucun facteur. Trouvé par le test
   d'intégration du scoreur, **pas par le typage** : `Iterable` ne dit pas « réutilisable ».
2. 🔴 **`OnlineDuel.cast` avait bien divergé** (lot B), exactement comme annoncé : `skippedTargeting`
   perdu, case cliquée deux fois inconditionnellement. Invisible parce qu'inoffensif pour une cible
   unique et Téléport.

**Le rouge à froid ne s'est PAS reproduit** (lot A) : 20/20 verts, `dist` supprimé, 2 workers. C'est
dit tel quel. L'asymétrie de délai a été corrigée quand même, comme **cohérence** et non comme
diagnostic — `backlog-flaky-famille-online-a-froid` **reste ouverte**.

Le lot A a gagné en route ce que le plan ne demandait pas et qui vaut plus que le reste : une garde
qui **refuse un tour parti au chronomètre** pendant un duel piloté. C'était jusqu'ici un échec
**silencieux** — le pilote laissait expirer, le jeu passait le tour seul, et au troisième le camp
était forfaité : le test se terminait au **vert** en ayant mesuré l'inverse de ce qu'il prétend.

**Un premier jet de test a échoué pour une bonne raison, et c'est consigné** : affaiblir un camp pour
en faire le traînard rendait du même coup sa cible plus facile à achever. Ce n'était donc pas une
« situation équivalente » — on mesurait la létalité en croyant mesurer le biais. Le montage final
règle la vigueur des camps par leur **second** Pokemon, hors de portée.

## Écarts au plan, assumés

- ❌ **Les portées recopiées du harnais n'ont pas été remplacées** par une lecture de `data-enabled`
  (lot B). Ça demanderait d'ouvrir puis refermer le menu d'attaque — donc perturber l'état — ou
  d'importer `packages/data` dans `e2e/`.
- ✅ **La question structurelle a été posée à l'humain, et TRANCHÉE** le 2026-09-16 : « oui, si ça ne
  casse pas l'archi ». Vérification faite, **ça la cassait** — et c'est ce qui a fait choisir l'autre
  chemin.

  Ce qui ne marchait pas : un import relatif vers `protocol.ts` ou `tactical.ts` cascade vers un
  spécificateur **nu** (`@pokemon-tactic/core`) que `e2e/` ne sait pas résoudre — il n'est pas un
  paquet de l'espace de travail, et il n'existe pas de `node_modules/@pokemon-tactic/`. La seule voie
  restante était d'ajouter des dépendances à la racine, donc de faire dépendre le harnais du graphe
  de paquets. Cher payé pour deux constantes : `e2e/` est aujourd'hui un îlot qui ne compile que
  lui-même, et c'est une propriété qui a de la valeur.

  **Ce qui a été fait à la place** : `ONLINE_TURN_DURATION_MS` est sorti dans
  `packages/network/src/timings.ts`, un module **sans aucun import**, que `protocol.ts` réexporte —
  rien ne change pour ses consommateurs. Le harnais l'importe alors par chemin relatif. Même remède
  que `telemetry-contract.ts` au plan 212, et pour la même raison : ce qui doit traverser une
  frontière de paquet sans en payer les dépendances vit dans un module qui n'en a aucune.

  ⚠️ **Les portées restent recopiées** : `tactical.ts` est trop gros et trop lié au core pour ce
  traitement. Le risque reste **borné** — si un rééquilibrage les périme, `actAndPropagate` échoue
  sur « le journal n'a pas grandi », donc bruyamment.

## Ce qu'il ne faut PAS faire

- ❌ **Ne pas consigner l'asymétrie de délais comme LA cause du rouge à froid** (lot A). La corriger,
  oui ; en faire le diagnostic, non — il faut la trace du prochain rouge.
- ❌ **Ne pas resynchroniser `OnlineDuel.cast` sur `CombatScene.castMove`** (lot B). Le clone est le
  problème ; les garde-fous vont dans `castMove`.
- ❌ **Ne pas ajouter un second spec visuel** pour rembourrer la famille (lot C). Fermée par constat.
- ❌ **Ne pas réutiliser §11.9 et §11.10** (lot D) sur la foi de l'entrée de backlog : périmés.
- ❌ **Ne rien glisser d'autre dans le lot E.** C'est exactement la raison pour laquelle cette
  entrée attendait un feu vert explicite.
- ❌ **Ne pas faire du ciblage FFA une coalition** (lot G). Biais doux, arbitré.
- ❌ **Ne pas teinter le déplacement** (lot G, limite 1). `scoreMove` gouverne aussi la couverture, la
  fuite et le placement défensif : le toucher changerait l'IA de TOUTES les parties, deux camps
  compris. Second chantier, pas une extension.
- ❌ **Ne pas propager le biais aux ~15 fonctions de ciblage spécialisées** (lot G, limite 2). Un
  helper partagé ferait sortir ce lot de sa taille ; un test documente la limite à la place.
- ❌ **Ne pas toucher aux six entrées de backlog hors de cette file** : les cinq de télémétrie (dont
  l'écart vs le compteur itch.io, qui ne se mesure **qu'après** le redéploiement), la parité de somme
  de contrôle sur K.O., l'édition d'équipe depuis le salon, et `question-ouverte-9` (statut/terrain),
  **laissée ouverte sciemment** — ne pas la reposer.

## Comment on saura que c'est fait

- La famille e2e en ligne passe **à froid**, `dist` supprimé, `--repeat-each=3`, **sans filtrer la
  sortie**. Si un rouge survient, sa trace est capturée et l'assertion fautive nommée.
- `openRoom` et `joinRoom` attendent `room.panel` avec **la même marge** : plus aucune asymétrie de
  délai entre hôte et invité sur le même localisateur.
- `OnlineDuel.cast` n'existe plus comme clone : les garde-fous vivent dans `castMove`, et un clic sur
  un bouton grisé ne peut plus faire pendre un spec.
- Un diff qui ne touche que `scripts/` ou `.github/` **n'escalade plus** en 307 tests.
- Aucun numéro de section du cahier de recette n'est porté par deux scénarios différents.
- `packages/network` n'a plus qu'**un seul** idiome d'abonnés.
- À trois camps de force inégale, l'IA préfère le meneur **à situation tactique équivalente**, et pas
  autrement. **Les neuf tests du lot G passent**, dont celui qui prouve par égalité STRICTE que rien
  ne change dans un format à deux camps — 2v6 compris, soit 21 parties sur 22 du trafic réel.
- Gate full vert.

## Suite immédiate, hors de ce plan

**La release de la Phase 7**, qui attend ce plan par décision de l'humain. Rien n'est publié depuis
`v2026.8.2` (2026-08-28). Version proposée et **toujours non tranchée** : `v2026.9.0`. Les deux
pièges de release restent : forcer `pnpm test:e2e` **complet** (l'affected ne suffit pas), et pas de
`/publish` sur un `e2e:status` rouge (`decision-924`).
