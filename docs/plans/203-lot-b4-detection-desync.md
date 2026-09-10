# Plan 203 — Lot B4 : détection de désynchronisation

> **Statut** : in-progress — les 5 étapes sont **codées**, gate local vert (typecheck monorepo,
> Biome zéro avertissement, 4448 unitaires, 465 intégration). Restent l'e2e à deux contextes, le
> cahier de recette et la recette humaine. Voir § Ce que l'implémentation a corrigé.
> **Créé** : 2026-09-09
> **Lot** : B4 du plan-cadre [195](./195-phase7-multijoueur-telemetrie.md) — **dernier lot de la
> Phase 7**. Le plan-cadre reste `in-progress` tant que celui-ci n'est pas clos.

## Motivation

En ligne, aucun état ne transite : chaque pair fait tourner sa copie du moteur et ne reçoit que les
**actions** de l'autre (exécution dupliquée, principe 2 de `docs/multiplayer.md`). Le déterminisme du
core est ce qui garantit que les deux arrivent au même état.

Quand cette garantie casse, elle casse **en silence**. Un écart d'un point de vie, un compteur de
météo qui diffère, une zone de terrain posée chez l'un seulement : les deux joueurs continuent à
s'échanger des actions parfaitement légales pendant que leurs parties se séparent. Chez l'un
Florizarre est K.O., chez l'autre il joue encore.

Le validateur d'actions du Lot B2 n'attrape **pas** ce cas. Il attrape la divergence qui produit une
action *illégale* (trois refus consécutifs → forfait, décisions #211 / D1). Une divergence d'état qui
laisse toutes les actions légales ne déclenche rien du tout. C'est exactement le trou que ce lot
existe pour boucher.

Deuxième usage, cité par `docs/multiplayer.md` § Déterminisme : `NETWORK_VERSION` s'incrémente **à la
main** dès que toucher au moteur peut faire diverger deux pairs. On l'oubliera. La somme de contrôle
transforme l'oubli en erreur lisible au lieu d'un combat qui part en vrille.

## 🔴 Ce que ce lot NE fait PAS : un anti-triche

Arbitré avec l'humain le 2026-09-09, à consigner, parce que la mémoire du projet en espérait plus.

**Rien ne lie l'empreinte émise à l'état réellement détenu.** Un client modifié fait tourner l'état
honnête à côté de son état triché et émet l'empreinte honnête. Aucune cadence ne change ça. La somme
de contrôle détecte la divergence **accidentelle** — un bug de déterminisme, un `NETWORK_VERSION`
oublié, deux versions du moteur qui se rencontrent — et rien d'autre.

Ce qui empêche réellement de tricher est déjà livré : la validation de chaque action reçue contre
`getLegalActions()` (#211, Lot B2). Un pair ne peut pas jouer un coup illégal. Il peut mentir sur son
propre état, et **aucun** mécanisme pair-à-pair sans arbitre ne peut l'en empêcher — position assumée
du projet : pas de serveur autoritaire (#862), l'information complète fuit de toute façon (#863,
« on vise petit »), le constat n'est jamais une accusation (#943).

**Le seul gain réel contre un menteur**, et il vaut d'être noté : la décision #943 laisse un trou
assumé — `forfeitedSeat` n'est pas authentifiable, donc n'importe quel pair peut désigner n'importe
qui à coût nul. Avec l'échange d'empreintes, un pair qui **fabrique** un constat de divergence alors
que les empreintes concordent devient contredisable : l'autre détient une empreinte qui dit le
contraire. Ça ne tranche pas un désaccord réel — le menteur peut aussi mentir sur l'empreinte, et on
retombe dans l'indécidable — mais le mensonge nu passe de « gratuit » à « il faut en tenir deux ».

## Ce qui existe déjà, et que ce lot ne doit pas réinventer

- **`ForfeitReason.Desynced`** (`packages/core/src/enums/forfeit-reason.ts`) et
  **`NetworkForfeitReason.EtatDivergent`** (`"diverged"`), reliés par `ENGINE_FORFEIT_REASON`
  (`packages/app/src/network/online-battle.ts:34`). La ligne de journal « les parties ne concordent
  plus » est **déjà écrite et traduite** (corrigée en recette du plan 202 : une phrase par raison).
- **`forfeitSeat(seat, reason, counted)`** (`online-battle.ts:323`) : applique le forfait, diffuse le
  constat, incrémente son compteur. Le nouveau chemin s'y branche, il n'en écrit pas un second.
- **Le compteur `forfeit-diverged`** (`packages/app/src/analytics/telemetry.ts:116`), posé par le Lot
  B3 (#962) précisément pour dire si le déterminisme tient.
- **Le déterminisme verrouillé** (plan 181) : `creationRng: createPrng(seed)`, plus aucun
  `Math.random` sur le chemin de production ; trois graines diffusées au lancement — combat,
  placement, IA (#902).
- **`state.actionCounter`** : horloge d'action monotone, incrémentée une fois par action complétée.
  C'est le point d'ancrage naturel de la comparaison, et B3 s'en sert déjà pour le chronomètre.
- **`Room.broadcast` et le routage de messages** de `room.ts`, plus `isNetworkMessage`.

**Le rattrapage n'est pas à écrire non plus** : B3 a livré `resync_request` / `resync` /
`orchestrator.actionsSince`. Ce lot ne s'en sert pas (voir la décision de périmètre ci-dessous), mais
il n'a rien à construire de ce côté.

## Réglages tranchés avec l'humain le 2026-09-09

1. **À la divergence : constat et forfait, rien de plus.** Pas de reconstruction depuis le replay,
   contre ce que le plan-cadre 195 annonçait. Motif : en 1v1 personne ne peut dire qui s'est écarté
   (#943), donc « réparer » voudrait dire adopter la version d'en face sans preuve. Et le rattrapage
   de B3 n'envoie que la **queue** du journal (`fromIndex`) : une reconstruction complète demanderait
   un message de plus et le choix non authentifiable d'adopter le journal du pair. Le but affiché est
   servi sans ça : rendre l'écart **lisible** au lieu de silencieux. → **amende le plan 195**.
2. **Cadence : à chaque action**, constante réglable `CHECKSUM_EVERY_N_ACTIONS = 1`. Motif retenu,
   et ce n'est pas celui du menu d'origine : une divergence qui ne produit pas d'action illégale
   n'est attrapée par rien d'autre, donc chaque tour laissé passer est un tour d'actions construites
   sur un état déjà faux. Le coût de sérialisation est **à mesurer**, pas à supposer (la grille fait
   400+ tuiles sur une carte moyenne) ; si la mesure mord, la constante monte et le motif est
   consigné.
3. **`Math.log` sort de `computeCtGain` dans ce lot**, mais pour un motif requalifié par la mesure
   après la revue de plan — ce n'est **pas** un bug qui mord aujourd'hui. Voir étape 2.
4. **Le code de la somme de contrôle vit dans `packages/core`**, pas dans `packages/network` —
   **amende la liste de fichiers du plan 195**, qui plaçait `checksum.ts` dans le paquet réseau. La
   sérialisation canonique est un module **pur qui connaît la forme de l'état de combat** : sa place
   est auprès de l'état. Le salon ne gagne qu'un type de message, un envoi, un rappel et une branche
   de routage — une trentaine de lignes.
5. **À plus de deux joueurs : rien n'est implémenté, mais rien n'est fermé.** Le réseau est verrouillé
   en 1v1 (#944) pour une raison étrangère à la désync (le garde-fou d'index suppose un canal
   ordonné, faux entre deux `DataChannel`). À plus de deux, la somme de contrôle devient **meilleure**
   qu'en 1v1 : la majorité devient possible — onze pairs d'accord, un qui diffère, l'isolé a tort et
   on l'exclut au lieu de terminer la partie. C'est la réponse au « qui a raison ? » que le 1v1 ne
   peut pas avoir. Le plan 195 laisse la politique de désync partielle hors V1. **Compatibilité
   gratuite prise dès maintenant** : le message porte la place de l'émetteur et son ancrage, et les
   empreintes sont stockées **par pair** (`Map<seat, digest>`) et non en booléen « on concorde ». La
   règle de majorité se greffe plus tard sans toucher au protocole.

## Découpage en étapes

Ordre contraint : l'étape 3 a besoin de l'empreinte de l'étape 1 ; l'étape 4 a besoin du message de
l'étape 3. L'étape 2 est indépendante mais passe **avant** l'étape 4, pour ne pas mettre en service
un détecteur qui signalerait une dérive qu'on sait causer soi-même.

`NETWORK_VERSION` passe de **3 à 4 une seule fois pour tout le lot**, à l'étape 3.

### Étape 1 — Sérialisation canonique et empreinte, dans le core

**En trois passes, pas d'un bloc** — la revue de plan a signalé, à juste titre, que cette étape est la
plus grosse du lot et qu'elle porte le risque dominant. (1a) scalaires et tableaux, avec les règles
de nombres ; (1b) objets et `Map`, avec le tri ; (1c) le hachage et les tests unitaires. Chaque
passe est testable seule, et une régression se localise.

Fichier neuf : `packages/core/src/battle/state-checksum.ts`, pur, exporté par `packages/core/src/index.ts`.

**Générique et récursif, jamais une projection énumérée.** `PokemonInstance` porte une centaine de
champs, la grande majorité optionnels, et le roster en gagne à chaque plan de talents. Les énumérer
garantirait un oubli par plan — un champ neuf non couvert, c'est une divergence que le détecteur ne
voit pas. Un parcours structurel les couvre tous, sans y penser.

Règles de mise en forme, chacune motivée :

- **Objets** : clés triées par ordre de point de code. Deux moteurs peuvent construire le même objet
  par des chemins différents, donc dans un ordre d'insertion différent.
- **Clés à valeur `undefined` : omises.** `{ a: 1, b: undefined }` et `{ a: 1 }` sont le même état.
  Cette règle est **load-bearing**, et la revue de plan l'a prouvé sur le code : `handleKo`
  (`BattleEngine.ts:3860-3885`) remet une **vingtaine** de champs à `undefined` plutôt que de les
  supprimer — `critStageBoost`, `typeOverride`, `speedStatOverride`, `defenseStatOverride`,
  `stockpileCount`, `transformState`, `abilityIdOverride`, `unburdenActive`,
  `abilitySuppressedByGas`, `arenaTrapped`, les trois drapeaux de révélation… Un pair qui a
  reconstruit son état par rejeu peut n'avoir jamais posé la clé là où l'autre l'a posée puis
  annulée. Les distinguer produirait des faux positifs à chaque K.O.
- **`Map`** (`state.pokemon`) : entrées **triées par clé**, émises comme une liste de paires. L'ordre
  de parcours d'une `Map` suit l'insertion — or un pair qui a repris sa partie a reconstruit la sienne
  en rejouant son journal, donc potentiellement dans un autre ordre. C'est le piège le plus
  susceptible de produire un faux positif sur une partie honnête.
- **Tableaux : ordre PRÉSERVÉ.** Contre-intuitif après la règle précédente, et délibéré : l'ordre
  **est** sémantique. `fieldTerrains` documente « latest wins per tile on overlap » ; `statusEffects`,
  `auras`, `pendingStrikes` portent leur chronologie. Trier effacerait une vraie divergence.
- **Nombres** : entiers tels quels. Non-entiers **quantifiés** à un nombre fixe de décimales
  (`CHECKSUM_FLOAT_DIGITS`), pour absorber une dérive du dernier bit. `-0` normalisé en `0`.
  `NaN` / `Infinity` : **lever une erreur** — aucun état de combat valide n'en contient, c'est un bug
  à faire remonter, pas à hacher.
- **Chaînes, booléens** : tels quels, avec un préfixe de type pour qu'un nombre et sa chaîne ne se
  confondent pas.

Puis `battleStateChecksum(state): string` — hachage de la chaîne canonique, rendu en hexadécimal.
**Hachage non cryptographique**, deux voies FNV-1a de 32 bits combinées en 64 : pur TypeScript, aucune
dépendance, synchrone, aucune API de plateforme (le core doit rester utilisable hors navigateur, donc
`crypto.subtle` est exclu, et il est asynchrone par-dessus). À documenter dans le fichier : il détecte
la divergence accidentelle, il ne résiste pas à une contrefaçon — ce qui est cohérent avec #943, où
rien n'est authentifié de toute façon.

**Toute la grille est incluse**, y compris `height` et `terrain` qui ne changent pas en combat : c'est
ce qui attrape une carte chargée différemment, et ça donne un point d'ancrage utile avant le premier
tour.

**Les champs recalculés à chaque tour restent dedans** — `abilitySuppressedByGas` et `arenaTrapped`
(`BattleEngine.ts:806-840`), recalculés par balayage des positions. La revue de plan demandait s'il
fallait les exclure, de peur qu'un ordre de parcours différent les fasse diverger. Réponse : non, on
les garde, et la question est mal posée. Le sérialiseur **trie** la `Map` des Pokémon, donc l'ordre
de parcours ne peut pas faire diverger l'**empreinte**. Si l'ordre de parcours faisait diverger la
**valeur** recalculée, ce serait un vrai bug de déterminisme du moteur, antérieur à ce lot — et
exactement ce que la somme de contrôle existe pour révéler. Les exclure reviendrait à cacher la seule
chose qu'on cherche.

### Étape 2 — Sortir `Math.log` de `computeCtGain`, et verrouiller l'acquis

`packages/core/src/battle/ct-costs.ts:12` :

```ts
const base = 30 + Math.floor(20 * Math.log(baseStat + 1));
```

**Le principe** : ECMAScript ne garantit aucun résultat au bit près pour `Math.log` — sa précision
est laissée à l'implémentation, donc V8, SpiderMonkey et JavaScriptCore peuvent différer sur le
dernier bit. Le résultat passant par `Math.floor`, une valeur qui tomberait au ras d'un entier
basculerait d'un côté chez l'un et de l'autre chez l'autre : coût CT différent, donc **ordre des
tours** différent, donc divergence au premier tour. Le code est sur le chemin de chaque calcul
d'ordre de tour (`BattleEngine.ts:4008-4009`).

🔴 **MESURÉ, et le chiffre dément l'urgence que j'avais annoncée.** Sur le domaine réel :

| Mesure | Valeur |
|---|---|
| Domaine de `baseStat` | entiers **1..800** — vitesse de base max du roster **200** (Regieleki), ×2 Poudre Vive, ×2 Délestage |
| Distance minimale de `20·ln(n+1)` à un entier | **4,95 × 10⁻⁴**, à `baseStat = 517` |
| Erreur absolue d'un écart de ~1 ulp sur `Math.log` | **~3 × 10⁻¹⁴** |
| Marge | **1,7 × 10¹⁰ fois** l'erreur plausible |

Dix ordres de grandeur de marge : sur ce domaine, un écart d'implémentation sur `Math.log` **ne peut
pas** faire basculer le `floor`. Le trou est réel en théorie et inatteignable en pratique. J'avais
présenté l'inverse à l'humain, sur lecture seule ; la mesure tranche autrement.

**On le fait quand même, et voici l'honnête raison** : la marge est une propriété du roster, pas du
code. Elle tient parce que la vitesse de base max est 200 aujourd'hui. Un Pokémon ajouté, un objet
qui multiplie la vitesse autrement, et plus rien ne surveille cette propriété — aucun test ne la
garde, personne ne penserait à la vérifier. Une table figée rend permanent ce qui n'est
aujourd'hui qu'une coïncidence heureuse, pour un coût dérisoire. C'est la seule raison, et elle
suffit ; ce n'est pas un correctif de bug.

**Forme** : table de **points de rupture** — les valeurs de `baseStat` où le palier s'incrémente.

Le domaine **tabulé** est plus large que le domaine **réel**, et c'est délibéré : `CT_LOG_DOMAIN_MAX`
vaut **2048** quand le roster n'atteint que 800, ce qui donne **112 paliers** (`[1, 13]` … `[1998,
152]`). Marge assumée pour qu'un Pokémon plus rapide ne tombe pas d'emblée dans le repli par le haut,
lequel sous-estimerait le gain de CT — et le test `keeps the roster inside the tabulated domain`
échoue avant que le roster puisse l'atteindre. (Ce paragraphe annonçait 93 paliers sur 1..800 : c'est
le chiffre du domaine réel, mesuré avant l'élargissement. Corrigé après revue de code.)

🔴 **La table est écrite en dur dans la source, jamais calculée au chargement du module** : la
générer avec le `Math.log` local remettrait exactement le problème en place. Le script de génération
est **conservé** (`scripts/` et non jetable), pour que la table soit régénérable et vérifiable quand
le roster bouge.

🔴 **Zéro changement de valeur.** La table doit reproduire à l'identique ce que la fonction rend
aujourd'hui sur tout le domaine — c'est le test exhaustif de l'étape 5, et c'est ce qui rend le
changement neutre pour l'équilibrage (aucune relecture `game-designer` nécessaire). Repli hors
domaine ou sur entrée non entière : documenté, déterministe, jamais un retour à `Math.log`.

**Le reste du core est propre, et c'est vérifié** : un balayage de `packages/core/src` sur toutes les
fonctions à précision laissée à l'implémentation (`log`, `exp`, `pow`, `sin`, `cos`, `tan`, leurs
variantes inverses et hyperboliques, `cbrt`, `hypot`) ne rend **que cette occurrence**. Une seule,
dans tout le moteur.

Reste une occurrence de l'opérateur `**`, qui a la sémantique de `Math.pow` donc la même liberté
d'implémentation : `rolloutPowerForIndex` (`packages/core/src/battle/rollout-streak.ts:30`),
`ROLLOUT_BASE_POWER * 2 ** (index - 1)`. Base 2, exposant entier petit (la puissance de Roulade est
plafonnée) : toute implémentation rend la puissance de deux exacte, elles sont représentables. Aucun
risque, noté pour ne pas le redécouvrir ; `1 << (index - 1)` le rendrait exact par construction si on
passe par là.

**Ce qui verrouille l'acquis** : un test de garde qui balaie `packages/core/src` et **échoue** si une
fonction à précision laissée à l'implémentation réapparaît sur le chemin de production. Sans lui, la
propriété qu'on vient d'établir se reperd au prochain plan sans que personne le voie — et c'est
justement le genre d'oubli que ce lot existe pour rendre visible.

### Étape 3 — Le message, et son transport

`packages/network/src/protocol.ts` :

```ts
export interface ChecksumMessage {
  type: "checksum";
  seat: number;
  /** Nombre d'actions appliquées chez l'émetteur au moment du calcul. Le point d'ancrage. */
  actionIndex: number;
  digest: string;
}
```

- ajouté à l'union `NetworkMessage` et **validé par `isNetworkMessage`** (le `Record<NetworkMessageType, true>` du paquet fait échouer la compilation si un message n'a pas sa validation) ;
- `NETWORK_VERSION` : **3 → 4** ;
- `room.ts` : `sendChecksum(actionIndex, digest)`, le rappel `onChecksum`, une branche de routage.
  Environ trente lignes — le découpage de `room.ts` fait le 2026-09-09 (#967) n'était pas un préalable
  à ce lot, contrairement à ce que l'agenda annonçait, et ce lot ne le regonfle pas.

### Étape 4 — Comparer, constater, mesurer, dire

Dans `packages/app/src/network/online-battle.ts`.

- **Quand** : après chaque action complétée, quand `state.actionCounter % CHECKSUM_EVERY_N_ACTIONS === 0`
  (donc chaque action, réglage 2). Plus **une empreinte de lancement à `actionIndex` 0** — émise
  **après** la phase de placement et **avant** la première action, donc sur un état qui porte déjà
  les positions posées : c'est ce qui couvre le placement, dont le tirage local avait déjà produit
  deux plateaux différents une fois (#902). L'ancrage 0 la rend comparable par le même chemin que
  les autres, sans cas particulier.
- **Comment** : les empreintes reçues sont rangées **par pair et par ancrage**
  (`Map<seat, Map<actionIndex, digest>>`, purgée derrière), parce qu'un pair peut être une action en
  avance. On ne compare que des empreintes de **même `actionIndex`** — comparer deux ancrages
  différents serait un faux positif garanti.
- **À l'écart constaté** : `forfeitSeat(...)` avec `NetworkForfeitReason.EtatDivergent` — le chemin
  existant, sa diffusion, sa ligne de journal déjà traduite. Rien de neuf côté interface.
- **Télémétrie** : un compteur **distinct** de `forfeit-diverged`, `ChecksumMismatch:
  "checksum-mismatch"`, ajouté à `TelemetryAction` (`packages/app/src/analytics/telemetry.ts`, à la
  suite de `ConnectionUncertain:120`) avec son paragraphe dans le commentaire qui documente ce que
  chaque compteur répond. Incrémenté sur la branche de comparaison, **avant** l'appel à
  `forfeitSeat(...)` — auquel on passe `TelemetryAction.ForfeitDiverged` comme le fait déjà le
  chemin des trois refus. Les deux compteurs montent donc ensemble sur ce chemin, et c'est voulu :
  leur **écart** dit combien de forfaits pour divergence viennent d'actions refusées plutôt que
  d'une désync d'état muette. Même leçon que `forfeit-absent` / `forfeit-missed-turns` au Lot B3 :
  les confondre masquerait lequel des deux mécanismes tranche vraiment — et c'est
  `checksum-mismatch` qui mesure le déterminisme.
- **Le coût de sérialisation est mesuré ici** et le chiffre est consigné.

### Étape 5 — Tests de parité, et le cahier de recette

- **Sérialisation** (unitaire) : ordre des clés indifférent au parcours ; `Map` triée ; `undefined`
  et clé absente confondus ; `-0` = `0` ; quantification des non-entiers ; **ordre des tableaux
  préservé** ; `NaN` levé.
- **Parité** (intégration) : deux moteurs, même graine, même suite d'actions → **même empreinte à
  chaque action**. Puis un état muté d'un seul champ → empreinte différente. Une `Map` reconstruite
  dans un autre ordre d'insertion → **même** empreinte (c'est la garantie anti-faux-positif).
  Outillage : `packages/core/src/testing/build-test-engine.ts` monte les deux moteurs (il bâtit déjà
  la `Map<string, PokemonInstance>`, ligne 47) et `runReplay` (`battle/replay-runner.ts`) rejoue la
  suite d'actions sur le second — le deuxième moteur passe donc par le **vrai** chemin de
  reconstruction, celui de la reconnexion, et pas par une copie de l'état. C'est ce qui rend le test
  représentatif du cas qui produirait un faux positif en vrai.
- **`ct-costs`** : la table contre la formule actuelle, **exhaustivement sur tout le domaine**. C'est
  la preuve de non-régression de l'étape 2.
- **e2e à deux contextes** : un combat en ligne complet et honnête, jusqu'à l'écran de victoire, avec
  l'assertion qu'**aucune** divergence n'est constatée. C'est le test le plus important du lot, pour
  la raison donnée dans les risques.
- **Cahier de recette** (graphe, entités `recette`), **rédigé avant de coder** — trois scénarios :
  (a) combat en ligne complet et honnête entre deux profils de navigateur → **aucune** divergence
  constatée, jusqu'à l'écran de victoire ; (b) combat avec une reconnexion au milieu (le chemin de
  B3, qui reconstruit l'état par rejeu) → toujours aucune divergence, c'est le scénario de faux
  positif le plus probable ; (c) divergence **provoquée** — deux pairs sur des `NETWORK_VERSION`
  compatibles mais un moteur volontairement modifié d'un champ → constat au tour où elle naît, et le
  joueur lit « les parties ne concordent plus ».
  ⚠️ Rappel de la recette du plan 202 : **deux profils de navigateur**, jamais deux onglets du même
  profil — la sauvegarde de reprise tient dans une seule clé et les deux onglets s'écrasent
  (`backlog-sauvegarde-partagee-entre-onglets-meme-profil`).

## Décisions à consigner au graphe

- La somme de contrôle n'est pas un anti-triche, et la cadence n'y change rien ; ce qu'elle apporte
  quand même au trou de #943 (un constat fabriqué devient contredisable). **Nuance la #943.**
- Constat et forfait, sans reconstruction depuis le replay. **Amende le plan 195.**
- Cadence à chaque action, avec le motif « une divergence légale n'est attrapée par rien d'autre ».
- `state-checksum.ts` dans `packages/core` et non `packages/network`. **Amende le plan 195.**
- Sérialisation générique structurelle, pas de projection énumérée, et le motif (une centaine de
  champs optionnels qui grossit à chaque plan de talents).
- Tableaux non triés alors que les `Map` le sont, parce que leur ordre est sémantique.
- `Math.log` retiré de `computeCtGain` : le trou de déterminisme cross-navigateur, la table figée en
  source, et l'interdit de la calculer au chargement.
- Hachage non cryptographique assumé, et pourquoi le core ne peut pas prendre `crypto.subtle`.
- Compatibilité conservée pour la majorité à plus de deux pairs, sans l'implémenter.
- Compteur `checksum-mismatch` distinct de `forfeit-diverged`, et ce que chacun mesure.
- 🔴 **Ce que la mesure a démenti** : le trou `Math.log` annoncé comme un bug qui mord est
  inatteignable sur le domaine réel (marge de 1,7 × 10¹⁰). On le referme quand même, pour rendre
  permanente une propriété qui n'est qu'une coïncidence de roster. Décision utile surtout pour la
  prochaine fois qu'on croira avoir trouvé un bug de déterminisme en lisant du code.
- **Ce que la revue de plan a affirmé à tort**, à ne pas ressusciter : les opérations `+ − × ÷` de
  `getStatMultiplier` ne sont **pas** une source de divergence cross-navigateur. L'arrondi correct
  IEEE 754 détermine le résultat de façon **unique** ; seules les fonctions à précision laissée à
  l'implémentation en sortent. Un audit de toutes les divisions du core serait du travail perdu.
- Le test de garde contre le retour d'une fonction à précision libre dans le core.

## Ce que la revue de plan a corrigé (`plan-reviewer`, 2026-09-09)

**Retenu, et le plan a changé** :

- La règle « clés `undefined` omises » est load-bearing, et la revue l'a prouvée sur le code :
  `handleKo` remet une vingtaine de champs à `undefined` au lieu de les supprimer. Cité en étape 1.
- Les champs recalculés chaque tour (`abilitySuppressedByGas`, `arenaTrapped`) méritaient une réponse
  explicite. Elle y est : on les garde, le tri de la `Map` protège l'empreinte, et un recalcul
  sensible à l'ordre serait le bug que ce lot cherche.
- L'étape 1 était surdimensionnée → découpée en trois passes.
- Le compteur de télémétrie, l'ancrage de l'empreinte de lancement, l'outillage du test de parité et
  les scénarios de recette n'étaient pas situés → tous épinglés sur un fichier et une ligne.
- Les chiffres de la table étaient estimés (« ~140 points de rupture ») → **mesurés** : 93, sur un
  domaine 1..800.

**Écarté, avec le motif — pour que personne ne le rejoue** :

- 🔴 **« Les divisions de `getStatMultiplier` divergent entre navigateurs, IEEE 754 n'impose pas le
  résultat au bit près entre deux JIT »** — **faux**, et c'était le bloquant le plus coûteux de la
  revue : le suivre lançait un audit de toutes les divisions du core. L'arrondi correct exigé par
  IEEE 754 pour `+ − × ÷` (et imposé par ECMAScript) rend le résultat **unique** pour des entrées
  données : il n'existe qu'un seul résultat correctement arrondi, un JIT n'a pas la liberté d'en
  rendre un autre (pas de précision étendue x87 dans la sémantique JS, pas de `fast-math`). La
  liberté d'implémentation ne concerne **que** les fonctions transcendantes. `speedStages * 0.7` et
  `(2 + s) / 2` sont donc déterministes, et le plan avait raison de le dire.
- **« La recherche de `Math.log` est incomplète »** — elle l'était au moment de la revue, elle ne
  l'est plus : le balayage complet est fait et rendu dans l'étape 2. Une seule occurrence.
- **« Les décisions amendant le plan 195 ne portent pas de numéro »** — les numéros sont attribués à
  la consignation, pas à la rédaction. Conforme à la méthode du plan 200.

## Ce que l'implémentation a corrigé

- 🔴 **La mesure de coût, faite comme le critère 5 l'exige** : **0,299 ms** par empreinte sur
  `simple-arena` (12×20 = 240 tuiles, 4 Pokémon), pour un texte canonique de **25 330 caractères**.
  La plus grande carte du roster (`le-mur`, 16×16 = 256 tuiles) est à ×1,1 de celle mesurée, et le
  réseau est en 1v1 donc 4 Pokémon au plus. La cadence de 1 action est confirmée **par le chiffre**
  et non par l'intuition : dans un jeu au tour par tour, 0,3 ms par action ne se voit pas.
- **La dichotomie de `ctLogStep` est devenue un balayage linéaire.** Elle demandait quatre accès
  indexés, donc quatre `noNonNullAssertion` — et le gate n'autorise aucun avertissement, la règle ne
  se désactive pas sans accord. Le parcours par déstructuration n'en demande aucun, pour une centaine
  de comparaisons d'entiers sur un chemin appelé quelques fois par tour. Un invariant est né de ce
  choix (seuils croissants) : il est testé.
- **Le `Pick` de `RoomSurface` a fait exactement ce que son commentaire promettait** : élargir la
  surface a cassé la compilation du faux salon des tests, au lieu de laisser un membre manquant
  jeter au runtime sur un chemin non exercé.
- **Le `Record<NetworkMessageType, …>` de `protocol.test.ts` aussi** : le message `checksum` ajouté
  sans son échantillon de test ne compilait pas.
- `isBattleOver` est une **méthode**, pas un accesseur — `attached.isBattleOver` sans parenthèses
  compilait en `TS2774` plutôt qu'en silence, mais valait toujours vrai.
- **Le port `stateChecksum` est accroché à `online` et non à `localSeat`**, contrairement au
  chronomètre du Lot B3 : un combat **repris** a bien une place locale mais `online` vaut `null` tant
  que le salon n'est pas rebranché, et il n'y a alors personne avec qui comparer.
- **Le garde-fou de déterminisme a été vérifié en red-green** : une ligne `Math.log` + `2 **`
  injectée dans `ohko.ts` fait tomber ses deux assertions, et sa suppression les remet au vert. Un
  test de garde qu'on n'a pas vu échouer ne garde rien.
- Le garde-fou compte aussi ses fichiers (`> 100`) : un balayage cassé rendrait zéro fichier et tous
  ses tests passeraient pour rien.

## Risques

- 🔴 **Le faux positif est pire que l'absence de détecteur.** Une empreinte qui diverge sur une partie
  honnête met fin à un vrai combat, par un message que le joueur ne peut ni comprendre ni contester.
  C'est le risque dominant du lot, et il est concentré dans l'étape 1 : ordre de parcours des `Map`,
  `undefined` contre clé absente, flottants. Parades : le test de parité, l'e2e à deux contextes sur
  un combat complet, et la recette humaine.
- **Le coût à chaque action n'est pas mesuré** au moment d'écrire ces lignes. Réglage 2 assumé sous
  réserve de mesure ; la constante existe pour ça.
- **Une divergence née pendant le placement** échapperait à une première empreinte posée au premier
  tour — d'où l'empreinte au lancement de l'étape 4.
- **L'audit des fonctions à précision libre est fait, et il est complet** : une seule occurrence dans
  tout le core (étape 2), plus un `**` inoffensif. Le test de garde de l'étape 2 est ce qui empêche
  la liste de se rallonger en silence. Restent les trous de déterminisme d'une **autre** nature —
  ordre de parcours, état non réinitialisé — que ce lot ne prétend pas avoir audités, et pour
  lesquels la somme de contrôle est précisément le filet.
- **Rien ne sera vérifié entre deux navigateurs réellement différents** avant que quelqu'un joue :
  la suite e2e tourne sur un seul moteur. Même risque assumé que la traversée de pare-feu du Lot B3.

## Limites connues, écrites pour ne pas être redécouvertes

Relevées en revue de code, assumées, aucune n'est bloquante :

- **Un ancrage sauté n'est jamais confronté.** `syncStateChecksum` n'annonce que l'index **courant**.
  Si deux actions atterrissent dans un même drain d'animation — le chemin existe, `refreshUI`
  applique une action distante gardée juste avant de rendre la main — l'index intermédiaire n'est
  jamais annoncé, et l'empreinte distante de cet index est rangée puis purgée sans comparaison. Sans
  gravité à la cadence de 1 (l'index suivant rattrape), et c'est précisément ce que le compteur
  `checksum-compared` rend mesurable.
- **Un pair qui n'émet jamais d'empreinte ne déclenche rien.** `NETWORK_VERSION` 4 ferme le cas d'un
  client d'une autre version ; il ne reste que le client modifié, hors périmètre assumé (#943). Là
  encore, `checksum-compared` est ce qui permettra de le voir dans les chiffres.
- **L'ancre ne couvre pas les mutations qui ne sont pas des actions journalisées.**
  `BattleEngine.forfeit` élimine un camp entier **sans** faire bouger `appliedActionCount`. Sans
  conséquence en 1v1 — un forfait termine le combat, plus aucune empreinte ne part. Mais à trois
  camps ou plus, un forfait appliqué à des points différents du flux donnerait deux états différents
  **au même ancrage**, donc un faux positif sur le mécanisme même de la majorité. La compatibilité
  annoncée au réglage 5 n'est donc pas totalement gratuite : ce point est à traiter avec la
  réouverture du FFA, pas avant.
- **La parité sur un vrai K.O. n'est pas couverte en intégration.** Le test a été tenté et retiré :
  les équipes apparaissent aux deux bouts de la carte, la première attaque légale vise une case vide,
  et forcer un K.O. demanderait de rapprocher les Pokémon sur de nombreux tours. Un test à assertion
  conditionnelle aurait pu ne rien prouver en silence, ce qui est pire que pas de test. La parité
  après reconstruction **est** couverte, elle, par le vrai chemin `runReplay` ; le K.O. relève de
  l'e2e à deux contextes et de la recette humaine.

## Critère de sortie

1. Deux moteurs déterministes rendent la même empreinte à chaque action d'un combat complet.
2. Une divergence provoquée d'un seul champ est constatée **au tour où elle naît**, et le joueur lit
   « les parties ne concordent plus ».
3. Un combat en ligne honnête et complet, en e2e à deux contextes, ne constate **aucune** divergence.
4. `computeCtGain` ne contient plus aucun appel à `Math.log`, et rend **exactement** les mêmes
   valeurs qu'avant sur tout le domaine 1..800 (test exhaustif). Le test de garde échoue si une
   fonction à précision laissée à l'implémentation réapparaît dans le core.
5. Le coût de sérialisation est mesuré et consigné.
6. Gate `/ci-gate full` vert, recette humaine passée.
