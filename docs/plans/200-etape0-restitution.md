# Plan 200 — Étape 0 : batterie de restitution (ligne de base)

> **Statut** : done — mesuré le 2026-09-06, avant ET après la migration
> Rattaché à `docs/plans/200-methode-et-memoire.md`.

## À quoi ça sert

Le plan 200 change la façon dont le projet se souvient. Sans mesure, on ne saura ni prouver que le
graphe fait mieux, ni voir s'il fait pire. Cette batterie est **le seul critère d'acceptation** du
plan :

> **L'humain demande, Claude répond juste — sans coup de chance au `grep`.**

15 questions réelles, réponses de référence établies le 2026-09-05 en lisant les sources. On mesure
**avant** (dispositif actuel : gros fichiers markdown + `grep`), puis **après** chaque étape.

## Protocole

1. Une **session neuve** (ou un sous-agent) reçoit **les 15 questions seules**, collées dans le
   message. Rien d'autre.
2. Pour **chaque** réponse, elle doit **citer sa source** — fichier et ligne. C'est ce qui fait la
   différence entre « su » et « trouvé par chance », et c'est aussi le contrôle anti-triche :
   si elle cite *ce fichier-ci*, la réponse est **annulée** (voir Limite).
3. Notation par question : **2** = juste et complète · **1** = juste mais incomplète, ou juste avec
   un contresens mineur · **0** = fausse, ou « je ne sais pas ». **Total sur 30.**
4. Consigner date, dispositif en place, score, et les questions ratées.

⚠️ **Limite connue** : les réponses de référence ci-dessous sont dans le dépôt, donc un `grep`
topique peut tomber dessus. C'est pourquoi la citation de source est obligatoire — une contamination
devient **visible** au lieu d'être silencieuse. Si ça s'avère insuffisant à l'usage, déplacer ce
fichier hors du dépôt.

## Relevés

| Date | Dispositif | Score | Requêtes | Questions ratées |
|---|---|---|---|---|
| 2026-09-06 | Markdown + `grep` (**avant**) | **15/15** | ~10 appels d'outil | aucune |
| 2026-09-06 | Graphe seul, 1593 entités | **15/15** | 26 appels | aucune |
| 2026-09-06 | Graphe seul, 1979 entités (plans + recette versés) | **15/15** | 36 appels, dont 8 improductifs | aucune |

**Le verrou est passé** : le graphe répond aussi bien que les fichiers, donc leur suppression était
autorisée. Mais il répond **plus cher** — le coût du grossissement se paie en requêtes, pas en
exactitude. Les mots devenus ambigus (« Lot B3 » contre « batch B3 » du roster, « workers »
Playwright contre Cloudflare) demandent 4-5 tours au lieu d'un.

⚠️ **Ce que cette batterie ne mesure PAS**, et c'est sa limite principale : elle pose des questions
**précises, contenant déjà les bons mots-clés**. C'est le cas facile. La panne réelle — la règle du
backlog enfreinte — n'était pas un échec de recherche mais un échec de *savoir qu'il fallait
chercher*. Cela se mesurerait autrement, et ne l'est pas encore.

### Relevé du proxy automatique (`scripts/memory/eval-search.mjs`)

Plus strict que le test humain (il exige l'entité attendue dans le TOP-3, sans reformulation ni
`--open`), donc systématiquement pessimiste — 12/15 là où l'agent fait 15/15. Sa valeur est de
**détecter une régression**, pas de donner une note absolue.

| Étape | Score |
|---|---|
| Décisions seules | 11/15 |
| + plans en miettes (4811 entités) | **7/15** — écarté |
| + plans en grappe (195 entités) | 12/15 |
| + cahier de recette et procédures | 9/15 |
| + pondération par type d'entité | 10/15 |
| + repliement des accents dans l'enveloppe | **12/15** |

---

## Les 15 questions

**Q1.** La roue de caractères du salon en ligne contredit une décision antérieure. Laquelle, et
comment ça a été arbitré ?
> **#840** (« pas de saisie de texte à la manette, les champs texte sont sautés », 2026-08-26),
> prise explicitement **contre** une molette de caractères. Arbitré par **#913** en faveur de la
> roue : elle est le seul widget de saisie du code, pour les quatre entrées. #840 est **révisée sur
> son périmètre, pas annulée** — elle réglait un problème de confort, alors que le code de partie
> est la seule porte d'entrée du jeu en ligne.

**Q2.** Pourquoi Mesa llvmpipe a-t-il été écarté pour la CI e2e, et qu'est-ce qui a réellement
débloqué la CI ?
> llvmpipe — la piste que la littérature donnait gagnante — **n'obtient aucun contexte WebGL**, ni
> sur le runner ni en local (sondé aux deux endroits). Ce qui a débloqué, c'est le **retrait du
> serveur de développement** au profit d'un build servi : Vite retransformait le graphe de modules à
> chaque navigation. SwiftShader passe ensuite sur le même runner, avec les mêmes arguments qu'avant.
> Piège : l'ancienne conclusion était **juste sur les faits, fausse sur la cause**.

**Q3.** Que valent `/ci-gate fast` et `/ci-gate full` en temps, et que contient `fast` ?
> `fast` ≈ **43 s**, **tour des 10 écrans compris** (c'est la boucle d'itération).
> `full` ≈ **80 s** sur un diff normal, avec l'e2e ciblé par `scripts/e2e-affected.ts` — **bloquant
> avant commit**. Avant le chantier : `fast` ~30 s sans e2e, `full` ~25 min.

**Q4.** Que reste-t-il à trancher avec l'humain **avant** d'écrire le Lot B3 ?
> **Trois réglages de forfait**, à arrêter avant et non dedans : (1) les délais suivants raccourcis à
> **10 s** une fois l'absence établie ; (2) le forfait qui **contourne les clauses de survie** ;
> (3) **45 s peut-être trop court** pour une attaque de zone à plusieurs cibles.

**Q5.** Pourquoi une partie en ligne n'émet-elle pas `battle_started` ?
> `telemetryTeams` est **délibérément absent** du setup composé depuis le `start` : la composition
> des autres camps n'est **pas** de l'information locale — un pair ne connaît des autres que ce
> qu'ils ont annoncé. Et `battle_started` n'a pas encore de mode `online`. À traiter au **Lot B2**.

**Q6.** Quel défaut rendait le bouton « Lancer » définitivement inerte dans un salon en ligne ?
> `setSeatOccupancy` posait `ready: false` sur une place que **personne ne tient**, donc une
> confirmation impossible à donner. `isEveryoneReady()` exigeant toutes les places, « Lancer »
> devenait inerte — et l'hôte ne pouvait pas revenir en arrière, `canEditSlot` ne rendant la main que
> sur `Ai` et `Waiting`. **Correctif** : `Human` est refusé par `setSeatOccupancy`, et le segment
> « Humain » vaut **`Waiting`** en ligne.

**Q7.** Que fait `leave()` sur `pendingLaunch`, et pourquoi c'est critique ?
> Il le **solde**. Sans ça, la promesse de `waitForStartAcks` n'avait plus **aucun dénouement** une
> fois son minuteur coupé, et `launch()` restait suspendue **pour toujours**. Les cinq mutateurs
> publics sortent désormais en `no-op` après un départ.

**Q8.** Le reset CSS ne couvre que deux racines. Lesquelles, et quelle conséquence **mesurée** ?
> `styles/reset.css` pose `box-sizing: border-box` sur **`.tb-root` et `.tb-dialog`** seulement —
> pas sur `.ts-root`, `.mn-screen`, `.ms-screen`, ni `.lb-screen`. Conséquence mesurée : un
> `<button>` reçoit `border-box` du navigateur tandis qu'un `<span>` reste en `content-box`, d'où
> **34 px contre 26 px** sur la puce d'état de la salle d'attente. ⚠️ Blast radius important.

**Q9.** Pourquoi `MESSAGE_TYPES` n'a-t-il **pas** pris la forme suggérée par la revue de code ?
> La forme suggérée (objet constant consommé par les `case`) a été **écartée à la mesure** : Biome
> `useExhaustiveSwitchCases` ne sait résoudre qu'un **littéral** dans un `case`, donc elle lui
> faisait perdre sa vérification d'exhaustivité. Retenu à la place : un objet
> `satisfies Record<NetworkMessageType, true>`, exhaustif **dans les deux sens** par compilation.

**Q10.** Où tourne la suite e2e complète, combien de temps, et quelle règle de porte l'accompagne ?
> Sur **GitHub** (`.github/workflows/e2e.yml`), **531 tests en 8 tranches**, **~5 min**, sur `push`
> vers `main` + chaque nuit + à la main. **Asynchrone, ne bloque jamais.** Verdict par
> `pnpm e2e:status` / `/e2e-status`. Deux règles dures : 🔴 **on ne l'attend jamais** (#925, ni
> `gh run watch` ni boucle de sondage) et 🔴 **pas de `/publish` sur un rouge** (#924).

**Q11.** Combien de workers Playwright, quel plafond CPU, et pourquoi on ne monte pas ?
> **3 workers**, plafond **400 %** (4 cœurs sur 16), via `scripts/with-cpu-cap.sh`. Laissés intacts
> **à la demande de l'humain** : il travaille et joue sur la machine pendant les runs. Coût assumé :
> la suite complète locale fait 5,9 min au lieu de 4,0 à 6 workers / 600 %. `PT_FULL_SPEED=1` débride.

**Q12.** Pourquoi les 218 specs `mechanics-*` n'ont-elles **pas** été réduites ?
> **Décision prise de ne pas les réduire.** L'argument de vitesse est **mort** avec le passage à
> 4 min ; il ne restait que le coût de maintenance. Le rendu ne les rejoue plus (arbitrage #923,
> contrepartie = le filet GitHub). Elles représentent 51 % du projet `combat`.

**Q13.** Quelle est la limite exacte de `isNetworkMessage`, et quels messages sont réellement à
risque ?
> Il **ne valide que le champ `type`** tout en promettant `value is NetworkMessage`. Un pair envoyant
> `{"type":"room_state"}` **nu** passe le garde, puis `applyRoomState(undefined, …)` lève un
> `TypeError` **dans la boucle d'écouteurs de `deliver`** — que rien n'attrape : le salon de
> l'invité meurt sans message. Même famille pour `{"type":"start"}`. `team_select` et `ready` sont
> bénins (le `??` de `composeStartSeats` absorbe). **À traiter au Lot B2.**

**Q14.** Qu'est-ce qui a été corrigé sur `humanIndex` dans `slot-state.ts` ?
> La ligne du joueur local lit et écrit désormais une entrée **unique**
> (`LOCAL_PLAYER_SELECTION_SLOT`, l'index 0) au lieu de son numéro de place : « ma dernière équipe »
> appartient à **la personne devant l'écran**, pas au camp qu'un ordre d'arrivée lui a donné.
> Comportement local inchangé au bit près. Une **écriture morte** a disparu au passage.

**Q15.** Pourquoi le placement automatique avait-il besoin d'une graine en multijoueur ?
> Il tirait au hasard **localement** : sans graine partagée, deux pairs avaient **deux plateaux
> différents avant le premier tour**. Le setup diffusé porte donc **trois graines** — combat,
> placement, IA. Corollaire (#901) : l'affirmation du plan-cadre « l'IA ne peut pas tourner sur les
> deux pairs » était **fausse** — elle est pure à état et générateur donnés, donc une graine dérivée
> par place suffit, **sans un seul message**.

---

## Pourquoi ces 15-là

Elles ne sont pas prises au hasard : chacune vise un mode d'échec du dispositif actuel.

| Mode d'échec visé | Questions |
|---|---|
| **Supersession** — une décision en révise une autre ; `grep` remonte la plus verbeuse, pas la plus récente | Q1, Q12 |
| **Fait juste, cause fausse** — le piège documenté de #921/#924 | Q2, Q15 |
| **Chiffre exact** — invérifiable de mémoire, doit être retrouvé | Q3, Q10, Q11 |
| **Ouvert vs résolu** — un point encore à trancher, noyé dans du résolu | Q4, Q5, Q13 |
| **Cause racine d'un bug** — le raisonnement, pas le symptôme | Q6, Q7, Q14 |
| **Négatif** — pourquoi une option a été **écartée** (le plus dur à retrouver) | Q8, Q9 |
