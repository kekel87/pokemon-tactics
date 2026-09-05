# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu via `/next`.

## État actuel (2026-08-27)

**Phase 6.5 « Client jouable : contrôles & UI » CLOSE.** Les 3 lots sont livrés *et* validés à la main : Lot 3 (UI, plans 174–182, publié `v2026.8.1`), Lot 1 (tactile, plan 183), Lot 2 (clavier/manette, plan 184 — **validé le 2026-08-21** scénario par scénario : clavier AZERTY/Firefox, caméra, menus, choix d'orientation, placement, **manette Switch Pro** filaire, **téléphone réel** (pinch, pan à deux doigts, tap, boussole) et **téléphone + manette**, le cas « first-class » du plan-cadre 173, qui marche sans code spécifique). **Légende de contrôles près de la boussole livrée** (plan 185, 2026-08-24, validée desktop et téléphone réel — voir § Fait récemment). L'**écran de remapping** est lui aussi **livré et validé** (plan 186, 2026-08-25 — voir § Fait récemment). Le **menu de combat** — dernier chantier issu de la validation du Lot 2 — est à son tour **livré et validé à la main** (plan 187, 2026-08-25, voir § Fait récemment). La **refonte de l'écran de sélection d'équipe + passe manette Team Builder**, dernier chantier issu de cette même validation, est elle aussi **livrée et validée à la main, 5 scénarios sur 5, clavier et manette Switch Pro filaire** (plan 188, 2026-08-26, revalidation des correctifs de code-review sur pad réel faite le même jour). Les trois derniers trous — **panoramique caméra au clavier**, **menu de combat pendant le placement**, **découvrabilité du défilement** — sont à leur tour **soldés** par le plan 189, livré et validé à la main le 2026-08-26 (six défauts trouvés et corrigés pendant la recette, voir § Fait récemment). Le seul point resté ouvert à la clôture — la légende de contrôles caméra qui suivait la timeline (décision #798) — a été **tranché et corrigé le 2026-08-27** (§ Reporté).

**Content-fill Gen 1 clos.** Phase 4 « mécaniques complexes » + son chantier IA (plans 159→160→161) + les 2 sessions content-fill (162 moves, 163 talents) sont tous terminés. Roster et pool Gen 1 désormais complets : **512 moves**, **114/114 talents**, **117/117 objets tenus**, **151/151 Pokemon jouables**, **203 OP sets**.

⚠️ **Garde-fou** : avant d'annoncer un reste (moves/talents/objets), toujours **recompter depuis la source réelle** (`abilityHandlers`, `tacticalOverrides`, learnsets du roster) — jamais un regex naïf, jamais un chiffre de doc figé. Des dérives passées (ex. faux « 115 talents » corrigé en 114) venaient de comptages approximatifs.

**Aucune nouvelle famille de mécanique Gen 1 à ouvrir.** La suite = une grosse phase ou une session polish (options ci-dessous, aucune n'est imposée — à trancher avec l'humain) :
- **Phase 6 — Maps & Éditeur (3D)** (`docs/roadmap.md`)
- **Phase 7 — Multijoueur**
- **Phase 8 — Équilibrage**
- **Polish / dette technique** — voir § Reporté / backlog technique ci-dessous (nombreux items non bloquants déjà identifiés)

## À faire maintenant

### 2026-09-05 — Le Lot B1 est CLOS : cadrer le Lot B2

`docs/plans/199-lot-b1-transport-lobby.md` est **`done`**, livré **et validé à la main** le
2026-09-04 : revue de code (2 Critical + 6 Important corrigés avant le commit) puis **deux tours de
recette humaine, 17 retours**, tous traités. Décisions **#895-912**. Poussé sur `origin/main`
(`3c4e751` + `c2eae14`). Le jeu en ligne se joue jusqu'à l'entrée en combat : deux navigateurs se
trouvent par un code, se mettent d'accord, et montent le même plateau — **aucune action ne s'échange
encore une fois en combat**, chacun joue sa copie locale. C'est le périmètre du lot, pas un manque.

**Prochaine action : cadrer le Lot B2** (combat en réseau), qui n'a **pas encore de plan** — échange
des actions, tour distant greffé sur `humanPlayerIds`, validation de chaque action reçue contre
`getLegalActions()`. Le Lot B1 lui a déjà préparé le terrain sur son point le plus dur : le salon a
quitté l'écran de sélection d'équipe pour appartenir à la session
(`packages/app/src/network/online-room.ts`) et **survit à l'entrée en combat** — c'était un correctif
de revue de code, c'est aussi l'architecture dont B2 a besoin.

⚠️ **Trois réglages de forfait restent à arrêter avec l'humain AVANT d'écrire le Lot B3**, pas
dedans (plan 199, encadré « Le modèle mental ») : délais suivants raccourcis à 10 s une fois
l'absence établie, forfait qui contourne les clauses de survie, et 45 s peut-être court pour une
attaque de zone à plusieurs cibles.

**Ce que la recette n'a pas pu couvrir**, et qui reste ouvert de fait — à regarder le jour où deux
vrais appareils sont sous la main, pas à retester au gate :
- la **traversée de pare-feu** entre deux réseaux réellement différents (un ordinateur et un
  téléphone en 4G, en allant coller le code dans une messagerie entre les deux — le cas qui met
  l'onglet en arrière-plan). L'e2e tourne sur la boucle locale ; c'est le risque assumé de la V1,
  avec un message clair pour seul recours ;
- les **délais de grâce** en conditions réelles (10 s après un départ propre, 45 s après un silence).

### ~~2026-09-04 — Le plan 198 est livré : exécuter le plan 199 (Lot B1)~~ — FAIT le 2026-09-04

Le plan 199 est **`done`**, décisions #895-908 inscrites, `docs/multiplayer.md` corrigé sur ses cinq
points périmés. Le cadrage ci-dessous reste la référence de ce qui a été arrêté avec l'humain, et il
garde son intérêt pour les Lots B2 et B3.

### 2026-09-03 (soir) — Lot B1 du multijoueur : deux plans rédigés et relus, zéro ligne de code

Séance de **cadrage uniquement** (décision humaine : « on fait que les plans ce soir »,
implémentation le lendemain). Deux plans écrits, relus par trois agents, corrigés :

- **`docs/plans/198-previsualisation-degats-parametre-partie.md`** — prérequis autonome. La
  prévisualisation de dégâts quitte l'écran des réglages pour devenir un **paramètre de partie**, à
  côté de « Placement auto », les deux persistés. Corrige au passage un oubli : « Placement auto »
  n'était **pas** persisté (`team-select-screen.ts:54`). Décisions #893-894.
- **`docs/plans/199-lot-b1-transport-lobby.md`** — le Lot B1 : paquet `packages/network/`, écran
  `lobby`, salle d'attente, lancement accusé. Décisions #895-908.

**L'ordre d'exécution est 198 puis 199** : le second a besoin que la prévisualisation soit un
paramètre de partie pour la mettre dans l'encart du salon.

**Le flux arrêté avec l'humain** : `lobby` (format + Créer/Rejoindre) → écran de terrain pour l'hôte
seul → **l'écran de sélection d'équipe sert de salle d'attente** (code affiché, encart de paramètres,
« Prêt »). Pas de second écran de salon. Le format se choisit **avant** la création, ce qui supprime
toute éjection de joueur.

**Cinq points du cadrage antérieur sont révisés** — `docs/multiplayer.md` dit encore le contraire, sa
mise à jour est l'étape 9 du plan 199 : plus de lien d'invitation (le code seul) · le format avant la
création · pas de salon d'attente séparé · l'IA autorisée en ligne · le refus de version ne porte pas
sur `buildVersion`.

**Trois trous trouvés en vérifiant le code, qui auraient mordu :**
1. Le **placement automatique tire au hasard** localement — sans graine venue de l'hôte, deux pairs
   ont deux plateaux différents avant le premier tour. Le setup porte donc **trois** graines.
2. `buildVersion` change à **chaque commit** et diffère entre les déploiements Pages et itch.io :
   refuser dessus **interdirait le jeu entre plateformes**. D'où `NETWORK_VERSION`, incrémentée à la
   main.
3. Les **formats sont déclarés par la carte** (`loaded.map.formats`), or le salon doit en proposer un
   avant qu'une carte existe. Sans effet : toute carte doit déclarer **les cinq** formats pour être
   valide, et `validateTiledMap` lève déjà une erreur sinon. Le salon lit `REQUIRED_TEAM_COUNTS`,
   sans filtrer ni revalider quoi que ce soit (#907).

✅ **Un blocage volontaire trouvé et tranché le jour même** (`#908`, s'écrit au Lot B3) : la règle
« 3 tours manqués consécutifs valent forfait, compteur remis à zéro dès qu'il rejoue » laissait un
joueur en train de perdre agir juste avant le troisième tour manqué, indéfiniment, imposant 45 s
d'attente réelle à l'adversaire à chaque décision sans jamais perdre. Retenu : un **second compteur
cumulatif non réinitialisable**, 6 tours manqués sur le combat entier. Trois autres réglages restent
à arrêter avant d'écrire B3 (délais suivants raccourcis à 10 s, forfait qui contourne les clauses de
survie, 45 s peut-être court pour une attaque de zone) — plan 199, encadré « Le modèle mental ».

**Les deux plans étaient en `ready`.** Le 198 est livré le 2026-09-04 ; reste le 199.

### Dans quelques jours — croiser nos compteurs avec le tableau de bord itch.io

Décidé le 2026-09-02. C'est la seule **validation externe** dont on dispose : itch compte côté
serveur, nous côté client, donc un accord des ordres de grandeur prouverait la chaîne mieux que
n'importe quel test.

**La bonne comparaison** : « Browser Plays » d'itch ↔ nos **visites** sur la plateforme `itch`
(`/tableau`, ou `pnpm stats`). Surtout PAS « Views », qui compte les gens ayant vu la page du jeu
sans jamais cliquer sur « Run game » — chez nous ils n'existent pas, le code ne tourne pas.

**Écarts attendus, qui ne sont PAS des pannes :**
- **Nous serons systématiquement en dessous.** Les bloqueurs de publicité coupent notre envoi et pas
  le comptage serveur d'itch — c'est exactement ce qui aveuglait Goatcounter (décision `#881`, mesuré).
  Un déficit de 10 à 30 % est normal ; c'est même une mesure indirecte du taux de blocage.
- **Les journées peuvent ne pas coïncider.** Notre découpage est sur `Europe/Paris` ; vérifier sur
  quel fuseau itch affiche les siennes avant de conclure à un décalage.
- **Une visite ≠ une partie.** Nos « parties lancées » n'ont pas d'équivalent chez itch.

🔴 **Ce qui serait un vrai signal d'alarme** : nos visites **supérieures** à leurs Browser Plays
(impossible sans double comptage — le drapeau `first` serait en cause), ou un rapport qui **s'effondre
brutalement** d'un jour à l'autre sans changement de trafic (signe que la collecte casse).

**2026-09-03 — premier essai de comparaison, un vrai signal d'alarme trouvé et corrigé (deux
correctifs).** itch.io affichait 2 « Browser Plays » pour le jour même, la base D1 n'en portait
**aucune ligne**. Ce n'était pas le déficit attendu (bloqueurs de pub) mais un trou de collecte : la
ligne `session` ne partait qu'en fin de vie de page. **Correctif 1 (`#888`)** : `initTelemetry()`
envoie désormais la ligne aussi au boot du bundle — couvre les visites où le bundle a fini de charger
mais où le beacon de fin de page n'est jamais parti (bug WebKit sur `visibilitychange`, onglet tué
par iOS, éviction du bfcache, iframe itch démontée). ⚠️ Ça ne couvre **pas** la fermeture pendant le
chargement des 4,3 Mo de `main.js` + Babylon — `initTelemetry()` s'exécute après tout le graphe
d'imports statiques, jamais avant (correction du mécanisme causal, faite par revue de code le jour
même). **Correctif 2 (`#889`)** : une balise de visite inline dans `index.html`, exécutée avant le
téléchargement du bundle, couvre ce second cas. **Les correctifs ne sont pas encore en ligne** :
`deploy.yml` et `itch-deploy.yml` ne se déclenchent que sur release ou `workflow_dispatch` manuel, à
relancer à la main avant de reprendre cette comparaison. Détail : `STATUS.md` (MAJ 2026-09-03),
`docs/backlog.md` § Suivi.

**2026-09-03 (suite) — les deux correctifs sont DÉPLOYÉS et la chaîne est prouvée.** `deploy.yml` et
`itch-deploy.yml` relancés à la main par `workflow_dispatch`, les deux verts (runs
[`33736940730`](https://github.com/kekel87/pokemon-tactics/actions/runs/33736940730) et
[`33736956366`](https://github.com/kekel87/pokemon-tactics/actions/runs/33736956366) ; étiquette butler
`v2026.8.2-telemetrie`, `main` étant en avance sur le tag). La page servie par GitHub Pages porte la
balise inline au build `v2026.8.2-25-g8e6c45c` (= HEAD), et un chargement réel a produit **une seule**
ligne `session` `first: true` (`id=12`) — la balise part, et la déduplication par
`window.__pokemonTacticsVisitSent` empêche le double comptage qui aurait été le vrai signal d'alarme.
Le build itch.io est couvert par construction (plugin Vite `visit-beacon` injecté sans condition,
plateforme résolue au runtime par nom d'hôte). ⚠️ La ligne `id=12` est **synthétique**, à défalquer
d'une comparaison fine du 2026-09-03.

**→ La comparaison avec le tableau de bord itch.io peut reprendre dans quelques jours**, sur des
journées entièrement postérieures au redéploiement. Un écart résiduel (nous en dessous de 10 à 30 %)
sera alors la mesure du taux de blocage publicitaire, pas une panne.

### 2026-09-02 (fin de journée) — question ouverte héritée de la session

**Classement compétitif : prémisse à rouvrir ou pas.** En validant la télémétrie, l'humain a évoqué
« un login/mot de passe, principalement pour faire du classement pour le matchmaking ». La décision
**#870** dit « pas de classement compétitif ». Rien n'est engagé, aucune ligne de code n'existe — mais
si l'envie se confirme, c'est une décision du **Lot B (multijoueur)**, pas de la télémétrie, et elle
entraîne deux conséquences déjà écrites (`#885`) : un identifiant de compte dans la base en fait une
**donnée personnelle**, ce qui fait tomber `#878` (aucun livrable de conformité en V1) et impose
politique de confidentialité, rétention et droits d'accès. **Règle validée par l'humain le 2026-09-02** : l'audience
anonyme et d'éventuelles statistiques identifiées restent deux mondes séparés, jamais joints.


### 2026-08-29 — Release `v2026.8.2` PUBLIÉE

**Phase 6.5 « Client jouable » est sortie.** https://github.com/kekel87/pokemon-tactics/releases/tag/v2026.8.2
— 25 commits, 12 plans clos (183→194). `itch-deploy` et Pages verts. Gate `full` vert :
3955 unit, 388 integration, 23 scenario, et **519/519 e2e** joués en passe complète.

⚠️ **Piège du gate constaté ce jour** : `test:e2e:affected` a classé le diff comme non-code et
n'a joué que **2 tests smoke sur 519**. Pour une release, toujours forcer `pnpm test:e2e` complet
— le gate seul ne suffit pas.

**Reste à faire :**
- [x] Devlog itch.io publié (2026-08-29).
- [x] Refs post-release commitées (2026-08-29, `472570b` « docs: nettoyage post-release v2026.8.2 »).
- [x] Sync wiki **fait** (2026-08-29, commit wiki `5a7f24a`) : Changelog EN+FR, Mécaniques (match
      nul, infobulle contextuelle), pages `Controls.md` + `Contrôles.md` créées. **Les visuels du
      wiki sont passés aussi** — `images/{demo.gif, map-select-screenshot.png,
      team-builder-screenshot.png}` sont octet pour octet les captures du plan 194
      (`combat.gif`, `01-map-select.png`, `02-team-builder.png`).
- [x] **Visuels README refaits (2026-08-29)** — release soldée. `docs/images/` ne contient plus que
      les **2 fichiers réellement référencés** par `README.md` (l.11 et l.17), tous deux repris des
      captures validées du plan 194 : `demo.gif` ← `combat.gif`, `team-builder-screenshot.png` ←
      `02-team-builder.png`. Les **3 orphelins** (`battle-log`, `maps-selection`, `team-selection`,
      encore en rendu Phaser, cités nulle part dans le dépôt) sont **purgés** — décision humaine du
      2026-08-29, ≈2,2 Mo retirés.

      ⚠️ **Les captures de `.captures/release/` sont antérieures au fix i18n `f785f70`.** Deux sont
      **périmées** et ne doivent pas être publiées telles quelles : `01b-map-select-cave.png`
      (« 12×12 · couloirs, dénivelé » en UI anglaise) et `03-twelve-players.png` (`2J × 6` …
      `12J × 1`). Le **code est correct** (`maps-registry.ts` porte des `tags: { fr, en }[]` depuis
      `e9f23d1`) — c'est la matière qui date. Les deux copiées dans `docs/images/` et la
      `01-map-select.png` publiée au wiki sont **saines** (aucun texte traduisible à l'image :
      Arène Simple a `tags: []`). **Re-capture volontairement reportée** (décision humaine
      2026-08-29 : rien de périmé n'est publié) → à rejouer (`pnpm capture:release`) à la prochaine
      passe de captures.

- **Plan 194 — séquence d'intro : LIVRÉ et validé** (2026-08-28). Marche à suivre complète :
  **`docs/capture-sequence.md`**, skill **`/capture-intro`**.

  ```bash
  pnpm capture:intro      # joue la séquence (~4 min) → vidéo brute + 52 captures + beats.json
  pnpm capture:trailer    # bande-annonce montée → .captures/intro-trailer.mp4
  pnpm capture:release    # GIF du combat + 3 captures de publication → .captures/release/
  ```

  Livrables validés par l'humain : **vidéo** (1 min 40, → YouTube non répertorié), **GIF du combat
  entier** (2,3 Mo, accéléré ×2 pour tenir sous les 3 Mo d'itch.io), **3 captures** (sélecteur de
  terrain, constructeur d'équipe, sélection d'équipe en 12 joueurs) → itch.io, wiki, README.

  ⚠️ **Deux règles à ne pas perdre** : la séquence se joue **entièrement à la manette** (un seul
  `.click()` remet `data-input-source` sur la souris et le liseré disparaît d'un coup à l'image), et le
  mode `?seed=` reste **strictement local** (garde `DEV || VITE_E2E`, preuve sur le bundle publié au §3
  du plan).

  **Reste ouvert** : plus rien — wiki (commit wiki `5a7f24a`) et README soldés le 2026-08-29.


### 2026-09-02 (fin de journée) — Lot A télémétrie quasi clos, reste à faire

`docs/plans/196-telemetrie-cloudflare-workers.md` est `done`. Cette section décrivait un reliquat :
l'étape 6 (vérification en production) était **partielle** au 2026-09-02, et le trou de collecte
trouvé le 2026-09-03 l'a confirmé. **Soldée le 2026-09-03** — correctifs `#888`/`#889` déployés et
chaîne prouvée bout en bout (voir § « À faire maintenant »). Détail complet, écarts au plan : voir le
plan 196 lui-même (§ Étapes 6-8), pas répété ici.

**Livré** : Worker en ligne (`https://pokemon-tactics-telemetry.kekel87.workers.dev`), collecte
`POST /e` vérifiée en production sur itch.io et GitHub Pages ; relevé live protégé par mot de
passe sur `GET /tableau` (fréquentation, audience, entonnoir, cartes, formats, fenêtre 7/30/90/365
jours) ; `pnpm stats` en terminal pour l'équilibrage Phase 8 (Pokemon, talents, objets tenus,
attaques, causes de K.O.) ; `src/report.ts` module partagé entre le dashboard et le script ;
Goatcounter retiré du bundle. Décisions **#880-886** (`docs/decisions.md`).

**Ce qui reste, concrètement, dans l'ordre le plus utile** :

1. ~~**Finir une partie jusqu'au bout en production**~~ **FAIT le 2026-09-02 à 21h59**, sur itch.io.
   `battle_ended` vérifié en vrai : `battleId` reliant les deux événements, vainqueur, 13 tours,
   0,6 min, et le détail par Pokemon — **Bulbizarre**, K.O. au tour 13 par dégâts, une seule
   **Balle Graine** lancée. Cette ligne illustre au passage pourquoi le champ K.O. existe : sans
   lui, « une Balle Graine en 13 tours » se lirait comme une attaque peu utilisée, alors que son
   porteur était tombé.
2. ~~**Workflow GitHub de déploiement du Worker**~~ **FAIT le 2026-09-02** — jeton posé par
   l'humain, workflow vert, le Worker se déploie seul sur changement du paquet.
3. ~~**Anomalie `-dirty`**~~ **RÉSOLUE le 2026-09-02** (décision `#887`) — le fichier de
   verrouillage ne portait pas l'entrée `packages/telemetry-worker: {}`, donc chaque `pnpm install`
   la rajoutait et salissait l'arbre. Deux hypothèses testées et réfutées avant celle-là ; c'est
   l'instrumentation du build qui a tranché en nommant le fichier coupable.
4. ~~**Fermeture du compte Goatcounter**~~ **FAIT le 2026-09-02.** Export récupéré avant fermeture
   (786 hits, 7 avril → 2 septembre : 145 passages au menu sur itch contre 32 sur GitHub Pages,
   27 combats lancés pour 7 terminés). **Décision : ces données ne sont PAS réinjectées** —
   Goatcounter comptait un hit par événement, nous comptons des visites au drapeau `first` ; les
   mélanger rendrait faux tous les chiffres historiques. L'archive reste chez l'humain.
5. ~~**Rejouer la suite e2e complète**~~ **FAIT le 2026-09-02** — 524/524, après installation du
   binaire `chrome-headless-shell` absent du cache (faux positif documenté dans
   `.claude/rules/e2e.md`).

---

### 2026-08-31 — Phase 7 planifiée (état du jour — **démarrée le 2026-09-02**, voir ci-dessus)

**Deux plans rédigés, statut `draft`, zéro ligne de code écrite.** `docs/plans/195-phase7-multijoueur-telemetrie.md`
(plan-cadre : Lot A télémétrie, Lot B multijoueur P2P 1v1 en 4 tranches — transport+lobby / combat /
robustesse / désync —, Lot C réduit à l'écran de victoire enrichi ; après-V1 non engagé : signaling
maison, relais NAT, FFA à 12) et `docs/plans/196-telemetrie-cloudflare-workers.md` (Lot A détaillé,
9 étapes). Décisions humaines **#871-878** inscrites (`docs/decisions.md`) : pas de nom de domaine
(l'API reste sur `*.workers.dev`), Worker dans `packages/telemetry-worker/` (workspace existant, pas
de script `build`), Lot C réduit à l'écran de victoire (Speed controls et Tutoriel interactif partent
en Phase 9 — Polish, sans lien avec le réseau ni la télémétrie), **télémétrie sur trois événements** :
`session` (fréquentation, funnel d'écran et usage de l'interface — crédits, Showdown import/export,
équipes, contrôles, menu de combat, reprise — compteurs accumulés en mémoire, envoyés en **deltas**
par `sendBeacon` à `visibilitychange → hidden`, jamais un envoi par clic), `battle_started` (composition
d'équipe par mode, modèle *usage stats* à la Showdown/Smogon), `battle_ended` (issue, durée, tours,
K.O. par cause, attaques réellement lancées) ; interrogation de la base depuis le chat via
`wrangler d1 execute --remote` + script `pnpm stats` (noms FR officiels obligatoires à l'affichage) ;
plafond réel corrigé à **~25 000 parties/jour** (pas ~50 000, une écriture indexée compte deux lignes) ;
limitation de débit par le binding `ratelimit` (le WAF gratuit exige un domaine).

**Complété en fin de journée — parité Goatcounter exigée (#879), et ce qu'elle coûte (#878 révisée).**
Le schéma du matin acceptait de perdre les **visiteurs uniques** : refusé par l'humain, qui veut « a
minima les mêmes infos que Goatcounter » — navigateurs, systèmes, pays, langues, tailles d'écran,
référents. Méthode retenue, la sienne : visiteur = `HMAC(secret ⊕ date du jour, IP + agent)` calculé
dans le Worker, **seul le haché est écrit, jamais l'IP**, et le sel tournant chaque jour rend tout
suivi inter-jours impossible (uniques par jour, pas sur 30 jours — même limite que Goatcounter). Le
reste vient de la requête HTTP sans que le client envoie plus : catégories de navigateur/système,
**pays par `request.cf.country`** (ni base GeoIP ni IP à lire), langue par `Accept-Language`, écran en
paliers. ⚠️ **Les référents externes resteront invisibles sur itch.io** — dans l'iframe,
`document.referrer` vaut `html-classic.itch.zone`, le vrai référent étant cross-origin ; c'est
pourquoi Goatcounter ne les voyait pas non plus, et le tableau du dashboard itch reste la source pour
cette plateforme. Sur GitHub Pages ils seront captés.
**Contrepartie juridique, et ce qu'on en fait (#878 finalisée)** : on quitte « article 82 hors
périmètre » pour la **mesure d'audience exemptée de consentement**, qui a des conditions. **Décision
humaine : aucun livrable de conformité en V1** — ni bandeau, ni mention de transparence, ni
interrupteur d'opposition. Motif : on ne le faisait pas davantage avec Goatcounter, et l'échelle ne le
justifie pas. À noter que **cinq des six conditions sont tenues par la structure du schéma sans rien
faire** (finalité unique, pas de recoupement, pas de suivi entre jours par le sel
quotidien, IP jamais écrite) ; seules manquent l'information des personnes et la rétention, à définir.
🔔 **À revisiter si l'audience devient significative** — points d'accroche déjà en place (écran de
crédits, `settings-panel.ts`), schéma inchangé le jour où ça arrive.

~~**Prochaine action concrète, qui bloque tout le reste : créer le compte Cloudflare** (étape 0 du plan
196, action humaine non déléguable — compte, base D1, jeton d'API de déploiement).~~ **FAIT le
2026-09-02** — compte Cloudflare et base D1 `pokemon-tactics-events` créés, voir section ci-dessus.

~~**Reste ouverte (plan 196 § Décisions à trancher avant de coder), Reco : oui, non tranchée par
l'humain** : un `battle_id` éphémère par partie (sans lui, le taux d'abandon n'existe qu'en global,
jamais par carte ni par format).~~ **TRANCHÉE le 2026-09-02 (#880) : retenu.**

---

**Cadrage initial (2026-08-29).** Décision humaine : **on ne démarre pas la Phase 7, on la prépare.** Passe d'audit de faisabilité sur
tout ce qui avait été noté depuis avril, **aucune ligne de code écrite**. Résultat : `docs/multiplayer.md`
réécrit en v2, décisions **#862-870** inscrites, contradictions doc corrigées.

**Deux prémisses du document d'avril étaient mortes** et avaient contaminé des décisions d'août :
1. « information complète, rien à cacher » — faux depuis le fog du plan 176 (2026-08-05) ;
2. « un serveur autoritaire arrivera en Phase 7 » — supposé par #728, #732, #751 et le plan 181.

**Ce qui est tranché** : P2P WebRTC sans backend (#862, réaffirme #209 ; Supabase écarté pour sa mise
en pause à 7 jours, et le cron GitHub de réveil est lui-même désactivé après 60 jours sans activité du
dépôt) · fog cosmétique en ligne, le report de #728/#732 clos par un « non » (#863) · chronomètre local
auto-déclarant, le timeout produit une **action** et non un message réseau (#864, #865) · codes de partie
préfixés, le namespace PeerJS Cloud est mondial et partagé (#866) · télémétrie Cloudflare Workers + D1
en remplacement de Goatcounter, faussé par les bloqueurs (#867, #868) · ordre d'apparition de Workers :
télémétrie → signaling → relais NAT (#869) · pas de classement compétitif (#870).

**Limites du plan gratuit Cloudflare vérifiées sur le web le 2026-08-29** (Workers 100k req/j et 10 ms
CPU ; Durable Objects 100k req/j, 13 000 GB-s, **backend SQLite obligatoire en gratuit** ; D1 5 M lignes
lues et 100k écrites/j, 5 Go ; API Hibernation confirmée pour les WebSockets).

**Prochaine étape quand la phase démarrera** : la **télémétrie** — indépendante du réseau, déjà utile en
solo (100 % du jeu aujourd'hui), et c'est elle qui fait apparaître le compte Cloudflare dont le reste
dépendra. Rattachée à la Phase 7 par choix humain (même chantier « serveur »). **Devenue concrète le
2026-08-31** : plan 196, qui commence par la création du compte Cloudflare (§ ci-dessus).

**Restent à trancher au moment de coder** (détail : plan 195 § Décisions à trancher, plan 196
§ Décisions à trancher avant de coder) : durée du chrono et action par défaut (« passer le tour » est
le choix sûr) · politique de désync partielle en FFA à 12 (viser le 1v1 d'abord) · politique de
reconnexion (délai, ce que voit l'autre pair) · saisie du code de partie à la manette. **Le nom de
domaine est tranché** (#871, décision du 2026-08-31) : pas de nom de domaine, l'API télémétrie reste
sur `*.workers.dev`.

- ~~**Trancher la suite : toujours ouvert.** La Phase 7 est planifiée mais pas lancée.~~ **Phase 7
  DÉMARRÉE le 2026-09-02** (Lot A télémétrie, étapes 1-2 livrées — voir section datée ci-dessus).
  Options Phase 6 / Phase 8 toujours entières, non dépriorisées par ce démarrage :
  - **Grosse phase** : Phase 6 (Maps & Éditeur 3D), Phase 7 (Multijoueur — **cadrée le 2026-08-29,
    planifiée le 2026-08-31, démarrée le 2026-09-02** par les plans 195/196, Lot A en cours),
    Phase 8 (Équilibrage).
- **Phase 6.5 — Client jouable : contrôles & UI — CLOSE (2026-08-21)**, historique du périmètre conservé ici (plan-cadre `docs/plans/173-phase-client-jouable-ui-controles.md`, phase validée 2026-07-24). Elle était prioritaire avant le Multijoueur (retour réel : injouable mobile → contrôles tactiles) — cette justification est **levée**. **Lot 3 (compléter l'UI)** : ~~nature InfoPanel~~ **livré** (plan 174, 2026-07-24), ~~info terrain/modificateurs~~ **livré** (plan 177, panneau d'info de case, 2026-07-25), ~~preview combat~~ **livré** (plan 175, 2026-07-26), ~~info move~~ **livré** (plan 178, tooltip enrichi + harmonisation des types, 2026-08-03), ~~panneau ennemi + information cachée~~ **livré** (plan 176, information ennemie cachée, 2026-08-05), ~~responsive + dette mobile~~ **livré** (plan 179, 2026-08-06, voir § Fait récemment — validation humaine partielle : dialog de victoire et rendu 4K jamais vus) ~~auras~~ **livré** (plan 182, 2026-08-20, anneaux au sol) → **Lot 3 TERMINÉ**. (l'**a11y** est **abandonnée** le 2026-08-20, décision #752 : support lecteur d'écran non visé, le combat est un canvas ; la gestion du focus part au Lot 2, le HTML sémantique reste une règle vivante justifiée par le harnais e2e, la taille de cible tactile est livrée au plan 179). ~~Lot 1 (contrôles tactiles)~~ **livré** (plan 183, 2026-08-20, validé sur téléphone réel — voir § Fait récemment) : c'était la justification prioritaire de la phase (retour réel « injouable mobile »). **Dette assumée notée par le plan** : le tactile est codé en direct dans `combat-scene.ts`, pas derrière une couche d'actions logiques — le Lot 2 devra le **rapatrier**, pas l'envelopper. ~~**Prochaine étape : Lot 2 (clavier/manette)**~~ **LIVRÉ (plan 184, 2026-08-21, étapes A→E, gate local vert) → la Phase 6.5 « Client jouable » a ses 3 lots clos.** **Validé à la main le 2026-08-21**, scénario par scénario : clavier (AZERTY/Firefox), caméra, menus, choix d'orientation, placement, **manette Switch Pro** filaire, **téléphone réel** (pinch, pan à deux doigts, tap, boussole — la revalidation qu'exigeait l'étape E, le tactile ayant été déplacé sans être réécrit) et **téléphone + manette**. **→ Phase 6.5 CLOSE**, rien ne reste en attente de validation dessus. Deux retours de cette session de test ont été sortis du périmètre en chantiers dédiés (§ Reporté) : **légende de contrôles + écran de remapping** (à faire ensemble) et **refonte de l'écran de sélection d'équipe**. Décisions humaines actées : bindings **fixes** (l'écran de remapping part dans un plan dédié **après**), bindings par **position physique** (`KeyboardEvent.code`, un seul jeu pour AZERTY/QWERTY), navigation des menus par **focus DOM natif**, couche d'actions logiques dans `packages/app/src/input/`, perte d'inspection du plateau assumée pendant `action_menu`/`attack_submenu`, défilement journal/timeline par bindings dédiés. Assets Kenney CC0 — la feuille `input-prompts-pixel-1-bit` est déjà intégrée (chantier séparé « aide visuelle des gestes attendus », § Fait récemment ci-dessous) et sera réutilisée pour les glyphes clavier/manette ; `cursor-pixel-pack` reste non intégré. ⚠️ L'item « tooltips type chart » du plan-cadre 173 est **abandonné** (décision humaine 2026-08-03 : la preview du plan 175 donne déjà le multiplicateur résolu, une table 18×18 serait un mur d'icônes) ; l'« efficacité contextuelle par move » l'est aussi (exigeait une cible de référence collante, trop de design pour un tri grossier), ainsi que les descriptions textuelles de moves (la source décrit le canon Gen 8/9, divergent de nos règles).
- ~~**Chantier séparé : ressusciter l'échelle `--tb-px` du Team Builder.**~~ **TRANCHÉ (2026-08-27) : on ne la ressuscite PAS, le code mort est purgé.** Décision humaine — rescaler l'écran à toutes les tailles (4K comprise) est un changement visuel qui mérite son propre chantier, pas un effet de bord de nettoyage. Purgé : les ~90 lignes de tokens `@container stage` inertes, le bloc de reflux `@container stage (width < 768px)`, les règles mortes `.ui-screen .tb-root` (rien ne monte cet écran dans la couche écran du stage depuis la suppression de `team-edit-harness.ts` le 2026-07-20), et les **7 indirections `var(--tb-*, Npx)` devenues vestigiales** dans `stat-bar.css`/`set-op.css`/`edit-panels.css` (plus aucun déclarant après la purge — `--tb-stat-col`, `--tb-statbar-h`, `--tb-setop-min-w`, `--tb-mv-col-{num,cat,pow,acc}`). `team-builder-overlay.css` passe de **216 à 78 lignes**, son en-tête raconte désormais l'état réel. Ce qui **reste vivant et intact** : le correctif étroit du plan 179 (tokens compacts `.tb-root` sous `@media (height < 500px), (width < 900px)`) et l'unité de la `type-chip`. Le retour « l'app est trop petite en 4K » reste donc **non traité pour cet écran** — c'est le chantier à ouvrir si tu veux y revenir.
- ~~**Refaire les 5 visuels README/wiki**~~ **SOLDÉ le 2026-08-29** (reporté depuis le 2026-06-16). Volet **wiki** passé le matin (commit wiki `5a7f24a`), volet **README** l'après-midi. Les captures auto par `visual-tester` avaient été rejetées une fois par l'humain — c'est la séquence d'intro du plan 194 (`pnpm capture:release`) qui a fourni la matière validée. Résultat : `docs/images/` réduit aux **2 fichiers réellement référencés**, les 3 orphelins Phaser purgés.

## Reporté / backlog technique

- **Le reset CSS ne couvre que `.tb-root` et `.tb-dialog` (repéré 2026-09-04)** : `styles/reset.css` pose `box-sizing: border-box` sur ces deux racines et leurs descendants — **pas** sur `.ts-root` (écran de sélection d'équipe), `.mn-screen` (écrans de menu), `.ms-screen` (choix de carte), ni `.lb-screen` (salon).
  - **Conséquence mesurée** : dans ces écrans, un `<button>` reçoit `border-box` du **navigateur** tandis qu'un `<span>` reste en `content-box`. Deux éléments portant la même classe et le même `min-height` ne font donc pas la même hauteur — 34 px contre 26 px sur la puce d'état de la salle d'attente, corrigée en posant `box-sizing` sur `.ts-segment`.
  - **Pourquoi ça compte** : le dimensionnement de ces écrans dépend aujourd'hui d'un **défaut de navigateur**, pas d'une règle du projet. Tout `min-height`, `width` ou `padding` posé sur un élément non-formulaire y réserve la même surprise, et elle ne se voit qu'à la capture.
  - **Correctif attendu** : élargir le reset aux racines d'écran, ou mieux, le rendre global (`*, *::before, *::after`). ⚠️ **Blast radius important** — ça change le calcul de taille de tous les écrans DOM d'un coup, donc ça demande une passe visuelle complète (les 5 viewports du cahier) et probablement `visual-tester`. À faire comme chantier propre, pas en marge d'autre chose.

- ~~🔴 **Flaky dans le gate — `type-manip.integration.test.ts`, jet de dégâts non épinglé (repéré 2026-09-04)**~~ **RÉSOLU le 2026-09-05.** Le jet est épinglé pour tout le bloc « damage path reads the override end-to-end » (`beforeEach` `vi.spyOn(Math, "random").mockReturnValue(0.5)` + `afterEach(vi.restoreAllMocks)`), et les deux comparaisons molles sont devenues des **valeurs exactes** : ×2 d'efficacité (37 → 75, l'arrondi de la formule explique le 75 et non 74) et ×1.5 de STAB (37 → 56). Le second test — celui que `toBeGreaterThan` laissait chevaucher — est passé de **2 échecs sur 10** à **0 sur 10** exécutions.

- ~~**Conventions et dette du paquet `packages/network/` (revue de code du 2026-09-04, plan 199)**~~ **SOLDÉE le 2026-09-05**, les neuf points. Deux d'entre eux étaient des **défauts de comportement**, pas des conventions, et ont leur test de non-régression (vérifié : les deux échouent si on retire le correctif).
  - `MESSAGE_TYPES` n'est plus un tableau de huit littéraux recopiés mais un objet `satisfies Record<NetworkMessageType, true>` — exhaustif **dans les deux sens** par compilation, ce que l'ancienne liste n'était pas. ⚠️ La forme suggérée par la revue (objet constant consommé par les `case`) a été **écartée à la mesure** : Biome `useExhaustiveSwitchCases` ne sait résoudre qu'un littéral dans un `case`, donc elle lui faisait perdre sa vérification d'exhaustivité. Les `switch` gardent leurs littéraux, et c'est désormais un choix documenté.
  - `PlayerController` et `RoomRole` remplacent les littéraux (`room.ts`, `team-select-screen.ts`, `screens.ts`). Le paquet réseau importe donc maintenant une **valeur** du core, pas seulement des types — le JSDoc du barrel le dit.
  - `FakeNetworkDirectory` a quitté le barrel public pour `packages/network/src/testing/`, avec son point d'entrée `@pokemon-tactic/network/testing`.
  - `ScreenParamsById["team-select"]` est une **union discriminée** (`{ mapUrl } | { network: GuestIntent }`) ; le `throw` au montage a disparu avec le cas qu'il couvrait. Le compilateur a immédiatement trouvé une seconde garantie manquante : `map-select` acceptait un `NetworkIntent` d'invité alors qu'un invité ne choisit jamais de carte — resserré en `HostIntent`.
  - Les deux tests sans comportement de `protocol.test.ts` sont supprimés ; celui qui restait énumère désormais les types par un `Record<NetworkMessageType, true>`, donc il échoue à la compilation si le protocole gagne un message.
  - `mapIdFromUrl` rend `undefined` au lieu de `"unknown"` ; le repli est passé à l'appelant qui en veut un (la télémétrie, via `MAP_ID_UNKNOWN`), et l'ouverture d'un salon **refuse** une carte hors registre.
  - 🔴 `leave()` solde `pendingLaunch` — sans quoi la promesse de `waitForStartAcks` n'avait plus **aucun** dénouement une fois son minuteur coupé, et `launch()` restait suspendue pour toujours. Les cinq mutateurs publics sortent maintenant en `no-op` après un départ, au lieu de « fonctionner » sur un objet mort.
  - 🔴 Une fermeture pendant le lancement annule **tout de suite** (`abandonLaunchIfAwaiting`), au lieu de laisser courir les 15 s pour un accusé dont on sait déjà qu'il n'arrivera pas.
  - Divers : JSDoc de `holdsFocus` corrigée (la roue prend **les deux** axes), `focusActiveSlot` retiré de l'interface publique (aucun appelant externe), double JSDoc de `wireScoredAi` fusionnée, les deux `@media (pointer: coarse)` de `lobby.css` réunis, nouveau token `--color-feedback-success-text` (le vert de la puce « Prêt » empruntait un token de **bordure de bouton**), `REQUIRED_TEAM_COUNTS[0] ?? 2` réduit à `REQUIRED_TEAM_COUNTS[0]`, JSDoc de `battle-mode-screen.ts` repassée en français. Une phrase dupliquée dans `composeStartSeats` a été nettoyée au passage.

- ~~**`slot-state.ts` — `humanIndex` ne tient qu'une moitié de sa promesse (2026-09-04)**~~ **RÉSOLU le 2026-09-05**, sans attendre le Lot B2. La ligne du joueur local lit et écrit une entrée **unique** (`LOCAL_PLAYER_SELECTION_SLOT`, l'index 0 qu'une partie locale ordinaire utilise déjà), au lieu de son numéro de place : « ma dernière équipe » appartient à la personne devant l'écran, pas au camp qu'un ordre d'arrivée lui a donné. Le comportement local est inchangé au bit près (le joueur local y est déjà l'index 0). Au passage, une **écriture morte** a disparu : le hot-seat local rangeait ses camps humains sous leur propre index, que `buildInitialSlots` ne relit jamais.

- ~~**À trancher : l'hôte peut basculer une ligne IA en « Humain » dans une partie en ligne (2026-09-04)**~~ **RÉSOLU le 2026-09-05 — ce n'était pas une décision de design, c'était un bug.** La note ci-dessus décrivait un hot-seat en ligne ; la lecture du code montre pire : `setSeatOccupancy` posait `ready: false` sur une place que **personne ne tient**, donc une confirmation que personne ne pouvait donner. `isEveryoneReady()` exigeant toutes les places, « Lancer » devenait **définitivement inerte** — et l'hôte ne pouvait pas revenir en arrière, `canEditSlot` ne rendant la main que sur `Ai` et `Waiting`, donc le segment passait grisé. **Le salon n'avait plus d'autre issue que d'être quitté**, sauf si quelqu'un venait occuper la place entre-temps.
  - **Correctif** : `Human` est refusé par `setSeatOccupancy`, et le segment « Humain » vaut **`Waiting`** en ligne — ce qui est ce que l'hôte veut dire (« je rouvre cette place à un joueur »), ce que l'écran affichait déjà (« ⏳ Place libre »), et ce qui reste jouable si personne ne vient. Rien n'est perdu : **deux amis contre deux IA marchaient déjà** sans ce levier, les places libres partant en IA au lancement.
  - Test de non-régression ajouté, et l'ancien test — qui affirmait précisément le comportement bloquant — réécrit.
  - **Second étage, relevé par la revue de code du 2026-09-05** (décision #919) : le correctif ci-dessus ne traitait que le salon. À l'écran, « Humain » **vidait** la ligne, donc trois widgets se contredisaient, « Lancer » s'éteignait sur la règle locale « aucun camp vide » pour une place que le salon déclare prête, et `announceSelection` sortant sur une équipe nulle, le salon **gardait l'ancienne sélection** — la place partait en combat avec l'équipe que l'écran venait de montrer comme retirée. Une place libre garde désormais une équipe éphémère. Couvert en e2e (`online-lobby.spec` §11.2, red-green vérifié).
  - **Troisième point de la même revue** (décision #920) : `{ mapUrl, network: <invité> }` compilait malgré l'union discriminée — le membre invité déclare maintenant `mapUrl?: undefined`, la combinaison n'est plus représentable (`TS2353`).

- **Reste de la revue de code du 2026-09-05 (commit de la dette B1)** — aucun bloquant, tout est soit pré-existant, soit du défensif. Les 3 points qui étaient de la dette de code neuf ont été corrigés le jour même (décisions #919-920) ; voici ce qui n'a pas été pris.
  - 🔴 **`isNetworkMessage` ne valide que le champ `type`** mais promet `value is NetworkMessage` (`packages/network/src/protocol.ts`). Un pair à l'adresse de l'hôte envoyant `{"type":"room_state"}` **nu** passe le garde et `isSpokenFor`, puis `applyRoomState(undefined, undefined, undefined)` lève un `TypeError` **dans la boucle d'écouteurs de `deliver`** (`peer-connection.ts`) — donc dans le handler `data` de PeerJS, que rien n'attrape : le salon de l'invité meurt sans message. Même famille avec `{"type":"start"}` → `enterNetworkBattle` lit `start.options.mapId`. Pré-existant, mais le commit retouche le prédicat **et grave la limite dans un test** (« la forme seule est son affaire »). `team_select` et `ready` sont bénins (le `??` de `composeStartSeats` absorbe). Le trou utile est donc `room_state` et `start`, tous deux réservés à l'hôte — portée limitée, mais le module se donne explicitement pour mission de résister à un pair mal élevé. **À traiter au Lot B2**, qui va justement faire passer des actions sur ce chemin.
  - **`cancelLaunch()` annonce `DelaiDepasse` même quand l'abandon vient d'une fermeture** (`room.ts`) : depuis le correctif d'annulation anticipée, l'hôte peut lire « plus de réponse, réessayez » **0 ms** après avoir pressé « Lancer », ce qui est l'inverse de ce qui s'est passé. Un code `JoueurParti` serait juste. Coût : une valeur de plus dans l'énumération fermée, donc une action de télémétrie et deux libellés i18n. Le nouveau test grave d'ailleurs `expect(errors).toEqual([NetworkErrorCode.DelaiDepasse])`.
  - **`damagePreview` est requis côté Worker** (`packages/telemetry-worker/src/report.ts`) alors qu'aucune ligne `battle_started` déjà stockée ne le porte. Rien ne le lit encore, donc sans conséquence aujourd'hui ; `damagePreview?: boolean`, comme `TeamPayload.generated?`, dirait la vérité au premier consommateur.
  - **Les 5 gardes `this.left` des mutateurs du salon sont pour la plupart inobservables** : `leave()` vide déjà les canaux, les quatre `Set` d'écouteurs et détruit le transport, donc `broadcast()` et `notifyChange()` sont déjà des non-opérations — seule dérive une entrée de `Map` interne sur un objet mort. Seule la garde **post-`await`** de `launch()` est couverte par un test. Sous « pas de code au cas où », ça fait 4 branches défensives non couvertes. À trancher : les retirer, ou couvrir.
  - **Plus rien n'épingle les chaînes de `NetworkErrorCode`** depuis la suppression du test `Object.values(...)`. Le `satisfies Record<NetworkErrorCode, TelemetryAction>` contraint les **clés du type**, pas les littéraux : renommer `SalonPlein: "salon_plein"` en `"room_full"` et mettre la table à jour dans le même geste compile parfaitement et **coupe silencieusement une série du relevé**. La suppression était justifiée sur la forme (le test figeait aussi l'ordre d'un littéral d'objet), pas sur ce qu'elle laisse tomber. Un test qui affirme les valeurs sans figer l'ordre serait le bon remplaçant.
  - Divers non bloquants : le défaut `humanIndex = 0` d'`assignTeamToSlot` n'a aucun consommateur (l'unique appelant passe toujours la valeur) ; `packages/app/src/team/last-selection.ts` garde une généralité par emplacement que plus rien ne produit, et son test `saveLastSelectionEntry(1, …)` couvre une forme morte ; la garde `mapId === undefined` de `createAsHost` est inatteignable en pratique (assumée en fail-fast de frontière, #916) ; le test survivant de `protocol.test.ts` reconstruit la même table de 8 clés que `MESSAGE_TYPES`, les deux étant vérifiées à la compilation — doublon de déclaration plutôt que test de comportement ; `--color-feedback-success-text` est le premier token `success` et n'a pas de frères `-bg`/`-border`, et n'est pas dans `docs/design-system.md` — mais aucun `--color-feedback-*` ne l'est, donc c'est cohérent avec l'existant.

- **Rappel Phase 7 — le menu de combat grignotera le temps du joueur sans le dire** (noté par le plan 187, 2026-08-25 ; **repris dans `docs/multiplayer.md` § Chronomètre le 2026-08-29**, il n'est plus orphelin ici). Quand le chronomètre multijoueur existera, ouvrir le menu de combat consommera du temps de tour au même titre que n'importe quelle autre action — c'est le prix explicite du cadrage « un seul comportement, dès le solo » (décision #819 : pas de pause). Il faudra probablement une mention « le temps continue » sur la modale à ce moment-là.
- ~~**Télémétrie `battle_started` — `damagePreview` absent, `autoPlacement` présent (2026-09-04)**~~ **RÉSOLU le 2026-09-05.** Le champ est câblé sur toute la chaîne — `BattleStartedPayload` (`analytics/telemetry.ts`), l'entrée de `beginBattleTelemetry` (`analytics/battle-telemetry-session.ts`), son appelant (`babylon/combat-screen.ts`) et le schéma du Worker (`telemetry-worker/src/report.ts`). Traité exactement comme `autoPlacement`, qui n'est pas non plus **affiché** dans le relevé : les deux paramètres de partie voyagent, la Phase 8 décidera de ce qu'elle en montre.

- **Une partie en ligne n'émet pas `battle_started` (2026-09-04, plan 199)** : `telemetryTeams` est délibérément absent du setup composé depuis le `start`, parce que la composition des autres camps n'est **pas** de l'information locale — un pair ne connaît des autres que ce qu'ils ont annoncé, et `battle_started` n'a de toute façon pas encore de mode `online` (#857 n'en prévoyait pas). Conséquence : le jeu en ligne est visible par ses compteurs de salon (`room-created`, `room-joined`, échecs par cause) mais **pas** dans les statistiques de combat. À traiter avec le Lot B2, qui est le premier à faire réellement jouer une partie en ligne — c'est là que « une partie en ligne a eu lieu » devient une donnée qui veut dire quelque chose.
- ~~**Légende de contrôles caméra qui suit la timeline (décision #798)**~~ **RÉSOLU le 2026-08-27 — option B implémentée.** `.tt-active` réserve désormais la hauteur d'une vignette active même quand la case se vide (`min-block-size`, avec la valeur du format téléphone du plan 179 et les deux bordures du portrait, qui est en `content-box`). La légende, la liste et les deux capuchons de défilement ne bougent plus d'un pixel pendant la prévisualisation de coût en CT ; **la boussole non plus** — `chrome-insets` écarte toute mesure de largeur nulle, et un slot vide reste large de 0, ce qui distingue ce cas du `min-inline-size` rejeté par le plan 185. Test e2e §4.18 « la légende ne bouge pas quand la timeline perd son entrée active » **repassé au vert** (6/6 sur la spec).

### e2e Playwright — chantier de rattrapage CLOS (2026-07-22)

**Toutes les familles de mécaniques ont désormais une couverture e2e** (~62 tests ajoutés, 3 batches via `test-writer`). Sections `docs/test-plan.md` §5.39-5.46 créées + §5.17-5.20 physique terrain révisées (👁→🤖 pour tout l'observable). Familles couvertes ce chantier : Stat/state manip (146), Lock-in (149), Manip talent Batch C (153), Buff/statut Batch D (154), Phazing, Sacrifice/Self-KO (147), Batch E grille (155, via harness N-vs-N), physique terrain (5.17-5.20). Move-copy (144)/Field global (145)/OHKO (148)/Priorité-timing (150)/Batch A/B (151-152)/Transform (157) étaient déjà couverts (next.md précédent était périmé).

**Débloqués par l'extension `SandboxConfig`** (champs test-only `stockpileCount` + `unburdenActive` sur `SandboxMemberConfig`, view-core) : Relâche/Avale RÉUSSITE exacte + Stockage 3ᵉ palier (162) et Délestage (163, observé via cadence CT) — tous passés 👁→🤖.

**Restent 👁 volontairement** (signal e2e absent, SENS couvert unit core) : ligne de vue hauteur (whiff/targeting ambigu), valeurs chiffrées exactes (caps ±50 %/−30 %, ×1.15, table de chute au PV près), coût de déplacement terrain (tuiles atteignables non exposées par le hook), éjection forcée corps-à-corps r1 (Cyclone/Projection : cible hors-spawn devrait être adjacente, interdit par la zone de contrôle), Colère/`rage` **non implémenté** (aucun override tactique), occlusion/curseur/perch (pixel/rendu).

### Infra e2e — 2 points signalés (code-review 2026-07-22)

- **Le gate typecheckait pas `e2e/` — RÉSOLU (2026-07-22).** `pnpm typecheck` chaîne désormais `typecheck:e2e` (`tsc -p e2e/tsconfig.json`) après les packages ; Playwright transpilant via esbuild sans type-check, une erreur `tsc` latente passait sinon entre les mailles (ex. `as const` sur `POLL`, attrapé par la review). Le gate couvre maintenant `e2e/`.
- ~~**`pnpm exec biome` échoue SOUS CHARGE — pas un bug persistant.**~~ **Diagnostic « contention » infirmé (vérifié le 2026-08-25).** L'ancienne note attribuait le crash « Linter process terminated abnormally (possibly out of memory) » à une concurrence de tâches lourdes. Reproduit ce jour **hors charge**, sur **2 fichiers seulement**, avec **48 Go de RAM libre** : `pnpm lint` (`biome check .`, la couche que le gate utilise) échoue quand même. À l'inverse, le **binaire natif appelé directement** (`node_modules/.pnpm/@biomejs+cli-linux-x64@2.5.5/.../biome`) passe les **1474 fichiers du repo en 6 s**, sans erreur. La contention n'est donc pas (ou plus) la cause — le problème est dans la couche `pnpm`/wrapper Node au-dessus du binaire, pas dans biome lui-même ni dans la charge machine. Contournement inchangé : appeler le binaire natif directement. **Non investigué plus loin** (cause exacte du wrapper non identifiée) ; à creuser si ça bloque un gate en pratique.
- ~~**Projet e2e `dom` frôle son délai** (signalé plan 179, 2026-08-06).~~ **RÉSOLU (2026-08-25, plan 187)** : le projet a effectivement basculé quand la suite a grossi de 17 tests, et le remède prévu ici a été appliqué — `timeout: 60_000` sur le projet `dom` dans `playwright.config.ts`, comme `combat`. Diagnostic mesuré avant d'y toucher : les 3 specs qui tombaient sont les 3 seules du projet à faire un **rechargement complet** de page (en dev, Vite re-sert tout le graphe de modules non bundlé depuis un seul serveur partagé par 16 workers) ; isolées elles passent en **24 s pour 17 tests** (~1,4 s chacune) alors qu'une seule dépassait 30 s dans la suite complète. Une dégradation de plus de 20× vient de la file d'attente, pas d'un chemin de code — même nature que ce que le commentaire du projet `combat` documentait déjà.

### OP sets restants (non bloquant)

Volet « faisable en Gen 1 » (Faux-Chage/Ruse/Anti-Air/Poursuite/Corps Perdu/Attraction) **promu en § À faire maintenant** (2026-07-24). **Impossibles tant que Gen 1 est le seul roster** (0 learner Gen 1) : Vol Magnétik, Affilage, Cri Draconique, Yama Arashi, Dark Lariat, Bec-Canon, Carapiège, Par Ici, Poudre Fureur, Après Vous, Interversion — à revisiter en Phase 9 (Gen 2+).

### Reliquats signalés (non bloquants)

- **Field global (plan 145)** — **CLOS (2026-07-24)** : boussole 3D + flèche Vent Arrière vérifiées OK en sandbox par l'humain. Rien à faire.
- **Ditto / Imposteur** (plan 157) — **CLOS (2026-07-24)** : mécanique complète (copie l'ennemi le plus proche au spawn, code + tests). Le « placement influence quelle cible » était une question de design, tranchée : comportement conservé.
- **Anomalie pré-existante** (signalée par le plan 159, non corrigée) : test `magic-room`/Life Orb flaky (PRNG non seedé). ~~`BattleEngine.getLegalActions` n'exclut pas un acteur qui vient de s'auto-KO au recul~~ **Corrigé (plan 167, 2026-07-22)** : une action self-KO avance désormais le tour immédiatement (`submitAction`).
- ~~**Isolation de tests fragile (préexistante, signalée code-review plan 167) — DURCI (2026-07-23), a récidivé 2× le 2026-07-26 malgré le durcissement.** `pnpm test` (run multi-packages) pouvait faire échouer `knock-off.test.ts` (« expected 45 to be greater than 50 ») selon l'allocation de workers/CPU — `loadData()` mémoïse un objet partagé (`load-data.ts` `cachedGameData`) qu'un test d'un autre package mute, et le sharding décide s'ils tombent dans le même worker. Fix appliqué : nouveau `deep-freeze.ts` (`deepFreeze` récursif) gèle désormais les définitions partagées `pokemon`/`moves` dans `loadData()` avant mise en cache, et le singleton `typeChart` (`type-chart.ts`) partagé par tous les engines. **À investiguer** si ça continue de récidiver — piste : élargir le gel à d'autres singletons partagés, ou creuser `pool:threads`/`maxWorkers`.~~ **Diagnostic infirmé par la mesure (2026-08-19).** Aucune mutation d'état partagé, aucun effet du sharding, aucun trou du `deepFreeze` n'était en cause : les 2 fichiers récidivants (`steel-beam`, `knock-off`) — et 2 autres jamais vus flaky (`gravity`, `clear-amulet`) — affirmaient un résultat dépendant d'un jet sans épingler `Math.random` via le seam de test de `BattleEngine` (documenté, utilisé par ~323 fichiers). Corrigé par test (voir § Fait récemment). Les deux pistes ci-dessus sont abandonnées : **élargir le gel** n'aurait rien fermé (aucune mutation trouvée) ; **creuser `pool:threads`/`maxWorkers`** n'aurait rien fermé non plus (le sharding n'était pas en cause — la corrélation « selon les workers » était fortuite, quelques % d'échec par run ressemblent à de la contention quand le gate tourne rarement). `deepFreeze` (#712) reste en place comme garde-fou contre une vraie mutation croisée, mais n'était pas et n'est pas le remède de ce flaky. Décisions #759–#760.
- **Heuristiques IA objets légers (plan 158) — WON'T-FIX documenté (2026-07-23, décision #714).** Les 11 objets passifs sont toujours-actifs et ne conditionnent aucune décision IA : leur ajouter un « bonus dédié » inventerait du scoring sans choix sous-jacent (bruit qui dégraderait l'IA). Seul sous-cas réel (l'IA sur-estime les dégâts contre un Métamorph à Poudre Métal) est ultra-niche. Laissé tel quel sciemment.
- ~~**Heuristiques IA fines item-interaction (plan 142)**~~ **RÉSOLU (2026-07-23, décision #714).** Sabotage/Tour de Magie/Passe-Passe/Gaz Corrosif : le bonus `hasItemManip` est désormais pondéré par la valeur tactique de l'objet visé (`HIGH_VALUE_MANIP_TARGET_ITEMS` + toute baie `-berry` → ×2 ; stat-sticks passifs → générique).

### Migration i18n du journal de combat — CLOSE (2026-08-27, plan 190)

**Faite en entier.** Le périmètre réel était bien plus gros que ce que cette note annonçait (« six familles de libellés ») : mesuré le 2026-08-27, `BattleLogFormatter.ts` portait **157** ternaires `lang === "fr"` — en majorité des **gabarits de phrase inline**, pas des libellés de table — **plus 10 tables** (les 6 familles connues, plus `STATUS_LOG_KEY`, `STAT_NAME_KEY`, `TERRAIN_STATUS_LOG_KEY`, `DEFENSE_NAME`), soit **234 chaînes** au total dans un fichier de 1617 lignes.

Livré : **0** occurrence de `=== "fr"` dans le formateur, **+234 clés `battleLog.*`** dans `types.ts` + les deux locales (699 → 933), `translate` ajouté à `BattleLogContext`, `translateIn(language, key, params)` extrait de `t()`, tables et helper `resolve()` supprimés. Sortie **octet pour octet identique** en FR et EN — c'était l'invariant directeur, et le filet e2e le vérifie.

Décisions notables (détail complet : `docs/plans/190-i18n-journal-de-combat.md` §7) : `language` **reste** dans le contexte à côté de `translate` (il sert les noms de **données** — `getTypeName` du paquet `data`) ; les clés se composent sur la **valeur** d'enum, pas le nom de membre (`BadlyPoisoned` → `badly_poisoned`, `AquaRing` → `aqua-ring` — lues dans le core, jamais devinées) ; le double emploi des tables (libellés **et** filtre « cet événement mérite-t-il une ligne ? ») est explicité en `LOGGED_STATUSES`/`LOGGED_TERRAIN_STATUSES`, qui restent dans `ui-dom` — c'est un périmètre, pas de la langue.

Le test a été **dédoublé par responsabilité**, pas déplacé : `ui-dom` vérifie la clé + les paramètres émis, et un nouveau `packages/app/src/i18n/battle-log-formatter.test.ts` reprend les **mêmes 519 lignes d'assertions sur les phrases** FR/EN, rendues par les vraies locales (`ui-dom` ne peut pas importer l'i18n de l'app sans dépendance circulaire). Aucune couverture perdue.

**Ce que ça débloque** : une 3ᵉ langue = un fichier de locale de plus, et le type `Translations` échoue au typecheck tant qu'il est incomplet. Le journal n'est plus une exception dans le système i18n.

### Réglage de la langue en cours de combat — débloqué en principe, pas fait (2026-08-27, plan 190)

La décision **#828** (« la langue n'est pas réglable en cours de combat ») invoquait deux obstacles : la
résolution de langue capturée une fois par `runBattle`, **et** le chantier i18n du journal, alors en
attente. Ce second obstacle est **levé** (plan 190) : les lignes du journal sont désormais des clés
localisées à l'écriture, donc rejouables dans une autre langue.

Ce qui reste, et pourquoi ce n'est pas fait : les lignes **déjà écrites** sont du texte DOM figé. Basculer
en pleine partie demande de **re-rendre l'historique** — donc de conserver les événements bruts en regard
de chaque ligne (ou de rejouer le journal, comme le fait déjà la reprise du plan 181) plutôt que leur
rendu. Chantier à part, non engagé. Tant qu'il n'est pas fait, la ligne « Langue » reste absente du
panneau de réglages embarqué, ce qui est le bon compromis (#828).

### Infra / process

- **Migrer l'analytics vers backend first-party** — GoatCounter (plan 114) bloqué par les adblockers (`goatcounter.com` filtré par EasyPrivacy). Fix : endpoint `/analytics` sur notre propre domaine backend. À faire avec le futur backend matchmaking, pas avant.
- ~~**Masquer l'objet ennemi en multi en ligne** (information cachée) — gap identifié plan 168 : l'icône+nom d'objet tenu de l'InfoPanel reste toujours visible aujourd'hui (comportement inchangé en local/sandbox), il faudra gater son affichage sur la révélation. À traiter avec le futur backend matchmaking.~~ **RÉSOLU côté client (2026-08-05, plan 176)** : l'InfoPanel ennemi masque désormais l'objet tenu (et le talent, et les PV exacts) tant qu'ils ne sont pas révélés — décision #729. **Reste ouvert** : le masquage est appliqué côté vue (`view-core`), pas dans `getGameState` (toujours un passthrough, décision #728) — un client modifié en multijoueur en ligne pourrait lire l'état complet malgré tout. Redaction côté core par perspective = nécessite un serveur autoritaire, renvoyée à la **Phase 7 (multijoueur/backend)**.
- ~~**Bump `Ayowel/butler-to-itch`** (workflow `itch-deploy.yml`) — bloqué à v1.3.0 (runtime node20) tant qu'aucune release node24 n'est publiée par le mainteneur.~~ **RÉSOLU (2026-07-23).** Bumpé v1.3.0 → v2.0.0 dans `.github/workflows/itch-deploy.yml` (v2.0.0 = runtime node24, sortie 2026-07-18 ; nos paramètres restent compatibles, le breaking change `check_signature` n'était pas utilisé).
- ~~**Changelogs release trop verbeux** (feedback 2026-06-12) — raccourcir le format joueur : regrouper par catégorie sans énumérer chaque move + sa sous-puce.~~ **RÉSOLU (2026-07-23).** Règle de concision ajoutée à l'agent `publisher` (`.claude/agents/publisher.md`) : agréger par catégorie, une ligne de synthèse chiffrée par lot, plus une puce par move/Pokemon. S'appliquera dès la prochaine release publiée.
- **Scaling assets Gen 2+** — chunk-by-génération du bundle sprites (`pack-sprites`) reste à implémenter quand on attaque Gen 2 ; architecture déjà prête (plan 135), indépendante du nombre de Pokemon.
- **Perf des suites de test — volet e2e RÉSOLU (plan 170, 2026-07-23)**, volet unit/integration reste ouvert mais **basse priorité** (déjà ~5-6s wall, pas le vrai goulot).
  - **e2e** : `fullyParallel: true` + GPU matériel local (SwiftShader réservé à `process.env.CI`) → full suite 10.4→8.2 min. 3 niveaux via `scripts/e2e-affected.ts` : **L1 smoke** (~4.4s, plancher à chaque commit), **L2 affected** (sous-ensemble calculé du diff), **L3 full** (349, escalade auto si diff cross-cutting, filet obligatoire au `/publish`). `ci-gate full` → e2e = affected, `ci-gate slow` → e2e = full. Décision #713.
  - **Pistes unit/integration restantes (basse priorité, non engagées)** : (1) cache de transform Vite persistant (`cacheDir`) pour amortir le coût transform sur les reruns ; (2) `loadData()` — le gel (`deepFreeze`, décision #712) couvre déjà `pokemon`/`moves`/`typeChart`, reste à profiler si le parsing JSON par worker est encore un poste notable ; (3) revoir `maxWorkers`/`pool` si contention CPU observée ; (4) `test --changed` en watch local.

### Chantiers séparés — plan 177 (panneau d'info de case, 2026-07-25)

Notés en marge du plan 177 (livré), hors périmètre — 4 pistes distinctes non engagées :

- **Point icônes** — remplacer les émoji placeholder du panneau d'info de case (`⛰ 👣 🛑 🥾 ⛔💀 🆓`) par un pack cohérent. Piste notée par l'humain : **game-icons.net** (~4000 icônes silhouette monochromes, CC BY, couvre botte/montagne/crâne/mur/pas/main-stop/pics). Décision de sourcing reportée à ce point.
- **Évasion Herbe Haute (core)** — Herbe Haute n'a aujourd'hui aucun effet mécanique (juste « immunise Vol », cosmétique) ; l'« Évasion +1 » du backlog n'a jamais été codée. Décision actée (2026-07-25) : à implémenter dans le core (magnitude/forme à cadrer — cran d'Esquive vs modificateur d'accuracy dédié, interaction précision garantie/météo/Lentiscope/Œil Composé), puis afficher au panneau. `game-designer` + `best-practices` avant de coder.
- **Hazards interdits dans les liquides sauf Piège de Roc (core)** — Piège de Roc flotte, les autres hazards (Picots, Pics Toxik, Toile Gluante) coulent ; leur pose devrait échouer sur une tuile liquide. Non implémenté.
- **Rendu in-world des effets sur tuiles** — marqueurs/anneaux d'effets directement sur les tuiles (feedback permanent sans survol du panneau), ex. un rond par aura. Rendu Babylon → `best-practices` avant, plan à part.

### Dettes — plan 180 (comportement plateforme mobile, 2026-08-14)

Notées à la livraison des lots 180-a/180-b (livrés), non résolues :

- ~~**`aria-pressed` absent des bascules de l'écran de réglages**~~ **ÉCARTÉ (2026-08-19, décision #752)** — `aria-pressed` ne sert que le lecteur d'écran, non visé ; `.claude/rules/html.md` ne l'exige plus. **Ce qui reste vrai, et part au Lot 2** : `render()` intégral à chaque bascule (`packages/app/src/ui/dom/screens/settings-screen.ts`) reconstruit tout le sous-arbre et **fait perdre le focus clavier** — bug de navigation clavier/manette, partagé par les 3 lignes (Langue, Prévisualisation dégâts, Plein écran).
- ~~**Trois stubs `localStorage` écrits à la main** dans les tests de `packages/app` (`i18n/index.test.ts`, `team/__tests__/last-selection.test.ts`, `app/screen-persistence.test.ts`), structurellement différents (espions / magasin exposé / `satisfies Storage`, dont un posé avant un import dynamique). Convergence vers un helper partagé souhaitable mais volontairement non faite en fin de chaîne (risque de dégrader deux tests existants pour un gain cosmétique).~~ **RÉSOLU (2026-08-14, plan 181).** Les 3 stubs + le 4ᵉ ajouté par `battle-persistence.test.ts` convergent vers `packages/app/src/testing/local-storage-stub.ts`.
- ~~**Bouton plein écran d'itch.io**~~ **RÉSOLU (2026-08-19, release `v2026.8.1`)** — vérifié par l'humain en production : **notre bouton fonctionne dans l'embed itch**, la permission `fullscreen` est donc bien accordée à l'iframe par la page itch. « Bouton Plein écran » est désormais **décoché** dans les Options du cadre du dashboard itch, notre bouton est le seul. Compromis assumé et connu : le bouton d'itch existait avant le chargement du jeu, le nôtre n'apparaît qu'une fois le client monté.
- **Service worker / mise à jour PWA** : aucun service worker aujourd'hui, donc la PWA installée charge depuis le réseau et est toujours à jour — rien à gérer. Le sujet « mise à jour bloquée derrière un cache » n'apparaîtrait qu'en ajoutant un service worker pour le hors-ligne (piste, non engagée).
- **Firefox Android propose « Ajouter à l'écran d'accueil », jamais « Installer »** (constaté sur téléphone réel, 2026-08-14, via le tunnel). Firefox a deux modes : « Installer » consomme les **icônes du manifeste**, « Ajouter à l'écran d'accueil » crée un simple signet et prend le **favicon**. Notre manifeste porte pourtant tout ce qu'exige la liste publique de Chromium (`name`, `short_name`, icônes 192+512, `start_url`, `display: standalone`) — mais **Mozilla ne publie pas ses critères**, et l'hypothèse « service worker requis pour le mode Installer » n'a pu être ni prouvée ni écartée (angle mort documentaire, recherche `best-practices` du 2026-08-14). **Non engagé volontairement** : ajouter un service worker sur une intuition traînerait toute une machinerie de versionnage. Palliatif déjà en place : la 192×192 est aussi déclarée en `<link rel="icon">`, donc disponible dans le mode signet. **Précision de périmètre (2026-08-19, release `v2026.8.1`)** : l'installation ne peut de toute façon marcher **que depuis GitHub Pages**, jamais depuis itch.io — sur itch le jeu est servi dans une **iframe** du domaine itch.io, et un navigateur ne propose pas d'installer une application depuis un contexte de navigation imbriqué (le manifeste d'un document iframé n'est pas pris en compte). itch.io n'est donc pas un canal d'installation et ne le sera pas : ce n'est pas un bug à corriger, c'est la nature de l'embed. La question « Installer vs Ajouter à l'écran d'accueil » sur Firefox Android reste donc à trancher **sur GitHub Pages uniquement**, et n'est plus bloquée par le tunnel Cloudflare depuis la mise en production.
- **Icône de raccourci absente sur le téléphone de l'humain — PAS notre bug** (2026-08-14). Symptôme identique constaté par l'humain avec **Instagram**, PWA tierce parfaitement configurée → la cause est côté Firefox Android/launcher, pas dans notre manifeste (servi valide, icônes en HTTP 200, résolution vérifiée sur les 3 bases de déploiement). À garder en tête pour ne pas rouvrir une chasse dans notre code : le bitmap d'un raccourci est **figé à sa création** et jamais re-téléchargé, donc tout test d'icône exige de supprimer le raccourci **et** de vider les données du site.
- **Golden visuel `settings-visual-linux.png` régénéré** (la 3ᵉ ligne des réglages décale titre et boutons) — noter que le projet e2e `visual` est **local-only**, la CI GitHub ne l'aurait pas vu. **Régénéré à nouveau au plan 198** (2026-09-04), cette fois pour une ligne en **moins** : « Prévisualisation dégâts » a quitté l'écran des réglages.

### Préparation multijoueur (Phase 7) — issue du plan 181 (2026-08-14)

Le choix « journal d'actions » du plan 181 (rejeu plutôt que sérialisation d'état, § reprise d'un combat en cours ci-dessus) prépare directement la reprise en multijoueur : le serveur détient le `seed` et le journal, un client qui revient (rechargement, réseau coupé) le redemande et rejoue par **le même chemin de reprise que le solo** — seul le magasin change (`localStorage` → serveur), grâce au port `load`/`save`/`clear` posé à cette fin.

Ce qu'il ne résout **pas**, à traiter en Phase 7 (détail complet § « Préparation Phase 7 » de `docs/plans/181-reprise-combat-en-cours.md`) :
- **Autorité serveur** : un journal côté client est falsifiable, chaque action doit être validée serveur (`getLegalActions`), pas seulement rejouée.
- **Identifiant stable de carte** (`MAPS_REGISTRY`) à la place d'un `mapUrl` dépendant de la base de déploiement.
- **Politique de reconnexion** : fenêtre de reconnexion, horloge de tour pendant l'absence, abandon vs pause.
- **Seed de l'IA fourni par le serveur** si le serveur re-simule (`createPrng(Date.now())` suffit en solo, on rejoue les actions déjà décidées).
- **Information cachée côté serveur** : `getGameState` reste un passthrough (décision #728) — un client modifié en multijoueur lirait l'état complet malgré le masquage appliqué côté vue.
- **Version de protocole** : le `buildVersion` de la sauvegarde locale devient un contrôle de compatibilité client/serveur.

**Point ouvert non résolu par ce plan** : aucun garde-fou e2e sur l'invariant « la reprise ne rejoue aucun texte flottant/animation » — l'égalité event-for-event du journal reconstruit sert de proxy, mais rien ne vérifie explicitement l'absence de rejeu visuel.

### Idées en exploration (humain, rien d'engagé)

- ~~**Décorations voxel** — remplacer les décorations billboards (rochers/arbres) par des assets voxel.~~ **Fait (2026-07-21)** — arbre, herbe haute, rochers 1×1/2×2 en meshes voxel `.glb` câblés dans `babylon-decorations.ts` (pipeline mirroré des entry hazards), + vent procédural (`decoration-wind-plugin.ts`). Décision #690, `docs/references/voxel-tile-placement.md`.
- **Éditeur de carte voxel in-app** — builder façon Goxel minimal (poser/remplacer/supprimer cube + asset), cartes « voxel based » avec tiles + déco + zones de spawn, vérificateur de conformité live. Abandon Tiled/`.tmj` → format maison JSON versionné. Note complète : `docs/ideas/voxel-map-editor.md`.

### Polish / dette technique (Jalon 3 rendu, non bloquants)

- Terrain : ~1500 draw calls (MultiMaterial + 6 SubMeshes par tuile, cube étiré). **Résorbé par la fondation voxel de l'éditeur (roadmap Phase 6, décision #682)** — blocs unitaires 24³ instanciés → ~10 draws. **Ne PAS optimiser `terrain-extruder.ts` maintenant** (sera remplacé, pas fusionné/optimisé).
- Consolider le loader Tiled (`resolveExternalTilesets` dupliqué 3×, `findProperty`/`resolveTileProperties` à exporter depuis `@pokemon-tactic/data`). **À revoir avec Phase 6** (format map custom 3D, décision #451/#682) : le parsing Tiled sera retravaillé/supprimé — ne consolider que si Tiled survit comme pont d'import. Pas de refacto maintenant.
- ~~`MultiMaterial` non disposées au reload de map~~ **Vérifié — non-problème (2026-07-20).** `terrain-extruder.ts` dispose via `root.dispose(false, true)` : Babylon récurse en propageant `disposeMaterialAndTextures=true`, et le cas `MultiMaterial` d'`AbstractMesh.dispose` appelle `material.dispose(false, true, true)` (`forceDisposeChildren=true`) → chaque MultiMaterial par tuile **est** disposée, sous-matériaux + textures inclus. De plus `extrudeTerrain` n'est appelé qu'1× (teardown de scène unique, aucun reload sur scène vivante). Note périmée, rien à corriger.
- ~~Occlusion fine per-sprite pour les décorations~~ **Vérifié — déjà résolu (2026-06-15, commit `2cb4b77`).** Chaque déco a son propre matériau + `SpriteDepthPlugin` (foot-depth par instance) et `Decorations.update()` reprojette le pied en NDC chaque frame → occlusion correcte pendant la rotation caméra. Note écrite le 2026-06-13, corrigée 2 jours plus tard, jamais barrée. **Devenu caduc autrement** : les déco billboards **ont été remplacées** par des meshes voxel (2026-07-21, décision #690) → occlusion via depth-buffer GPU natif comme le terrain, plus de `SpriteDepthPlugin` sur les décorations.
- Bonus plan 064 différé : marquages arène + pokéball centrale (`docs/plans/064-decorations-obstacles.md`).

### UI/UX en attente

> **Les items ouverts ci-dessous sont consolidés dans la Phase 6.5 « Client jouable » (plan-cadre `docs/plans/173`, Lot 3).** Ils seront traités là — détail au plan du Lot 3.

- ~~**Refacto unités CSS chrome : rem → `px × --ui-scale`** (validé humain 2026-06-12, option C) — gros refacto transverse (tokens.css + tous les composants chrome `styles/`).~~ **RÉSOLU (2026-07-23).** 23 valeurs `rem` du chrome (battle-log, move-tooltip, turn-timeline, battle-chrome) converties en `calc(px * var(--ui-scale))`.
- ~~**Recherche bilingue FR+EN dans le move picker** (souhait humain 2026-06-15)~~ — LIVRÉ : haystack normalisé bilingue (FR+EN+id, accents/séparateurs tolérés) sur les 3 pickers (`team/search-index.ts`). Couvert e2e `dom/picker-search.spec.ts`, cahier §7.2.
- Pistes best-practices overlay (non bloquantes) : ~~(1) plancher font-size `max(calc(N·--px), Xpx)` zone 480-767px~~ **écarté sciemment (2026-07-23)** — l'humain a tranché « tout scaler sans plancher » au refacto CSS rem→px×--ui-scale, piste abandonnée ; (2) modales `<dialog>` top-layer → publier `--stage-scale` sur `:root` via ResizeObserver (Jalon 4) ; (3) cap ultrawide optionnel `min(100cqw/1920, 100cqh/1080)` (décision design) ; (4) `--ui-scale` barres PV monde à brancher si besoin 4K.
- ~~**Plan 179 (responsive) — 2 points 4K/grand écran en attente de décision humaine.**~~ **RÉSOLU (2026-08-27, option « scaler les paddings » retenue par l'humain.)** La note était **périmée sur un des trois éléments** : l'**indicateur de tour** avait déjà ses paddings scalés depuis le plan 179 lui-même (`--bc-gap-xs` + `calc(18px * var(--ui-scale))`) — seul son rayon de bordure restait fixe. Les deux vrais défauts étaient la **pastille d'instruction** (`--spacing-xs`/`--spacing-md`, soit 4px/8px fixes sous un texte de ~56px en 4K) et la **dialog de victoire** (`--spacing-lg`, 12px fixes ; elle est enfant DOM de `.bc-root`, donc elle hérite bien de la police scalée même en top-layer). Correctif : famille de tokens locale `--bc-pad-{xs,sm,md,lg}` + `--bc-radius-{sm,md}` déclarée sur le `:where(.bc-root, .bc-left-col)` partagé (le même bloc qui existait déjà pour `--bc-edge`, parce que `.bc-left-col` est un **frère** de `.bc-root`), et passe complète de **`battle-chrome.css`** : plus un seul `--spacing-*`/`--radius-*` fixe dedans (seul `--target-min` reste, volontairement). ⚠️ **Portée exacte, relevée par la revue de code** : trois feuilles stylent des *descendants DOM* de ce sous-arbre et gardent des valeurs fixes — `components/button.css` (`.tb-btn`, arrondi 4px, partagé avec le Team Builder donc non modifiable en place), `move-tooltip.css` (marge intérieure et arrondi 6px sous une police de 42px en 4K — le même défaut que la pastille d'instruction) et `turn-timeline.css` (écarts 4/4/6px). Voir § dédié ci-dessous. Les tokens globaux ne sont **pas** redéfinis localement — le plan 179 l'avait déjà écarté (ils sont hérités par des panneaux qui portent leur propre échelle). **Reste vrai** : la dialog de victoire n'a **jamais été vue** en recette (aucun combat gagné pendant la validation du plan 179) — à regarder au prochain test humain.
- ~~Mineur a11y placement-roster : `.pl-roster` sans heading (`<h2>`/`<section>` recommandé par `html.md`).~~ **RÉSOLU (2026-07-23).** Instruction passée en `<h2>`.
- Affichage nature dans InfoPanel — mécanique core livrée (plan 072), UI absente. Reprendre à la refonte InfoPanel globale.

### Décisions actées (pour mémoire, pas d'action)

- Jalon 3.5 pixel-art **ABANDONNÉ** (2026-06-10, décision #486) — 4 essais rejetés, rendu full-res conservé. Ne pas rouvrir sans décision humaine. Historique : `docs/babylon/babylon-pixel-art-pipeline.md`.
- Frustration/Retour mis de côté (inutilisables Gen 8/9, décision #423) ; Puissance Cachée exclue définitivement (0 learner côté Champions, confirmé 2026-07-11) ; Morphing/Imposteur/Métamorph livrés (plan 157, roster 151/151 complet).

## Fait récemment

- 2026-09-05 — **Deux désynchronisations de doc corrigées, dont une décision qui en contredisait une
  autre.** (1) `docs/next.md` annonçait encore la recette du Lot B1 comme prochaine action alors que
  `STATUS.md`, `docs/roadmap.md` et les décisions #909-912 (toutes marquées « sortie de recette »)
  la donnaient faite : le commit de clôture avait mis à jour les quatre fichiers, mais pas celui-ci.
  (2) La **roue de caractères** livrée au Lot B1 contredit la décision **#840**, qui écartait
  nommément « une molette de caractères » — les deux cohabitaient dans `docs/decisions.md` sans que
  rien ne les relie, donc le prochain lecteur de #840 aurait été induit en erreur. Arbitré en faveur
  de la roue (**#913** + § Révisé au Lot B1) : #840 réglait un problème de **confort**, alors que le
  code de partie est la seule porte d'entrée du jeu en ligne. Le plan 199 porte désormais la même
  note à son étape 4.

  ⚠️ **Ce qui a fait trouver ces deux écarts** : une session est repartie sur un `main` local en
  retard de 2 commits sur `origin/main`, a donc relu des docs d'avant le Lot B1, et a commencé à
  réimplémenter le plan 199 de zéro avant que l'humain ne l'arrête. Premier geste d'une reprise :
  `git fetch`, puis comparer `main`, `origin/main` et les branches locales **avant** de lire
  `docs/next.md`.

- 2026-09-04 (soir) — **Plan 199 — Lot B1 du multijoueur : transport, salon, lancement.** Livré d'un
  trait, les 9 étapes. Nouveau paquet `packages/network/` **pur** (aucune dépendance d'interface, et
  du moteur il ne connaît que des **types**) : protocole et `NETWORK_VERSION`, codes et **adresses
  dérivées du code** (`pkmntac-<CODE>-<place>` — l'hôte est celui qui a pris la place 1, ce qui donne
  d'un coup l'allocation sans arbitre, le maillage et la reconnexion sans serveur), transport à deux
  mises en œuvre (`peerjs@1.5.5` et un **canal en mémoire**), et le salon. Écran `lobby` + salle
  d'attente greffée sur l'écran de sélection d'équipe. Décisions #895-908.

  **Le point structurel est le déterminisme.** Le setup diffusé porte **trois graines** — combat,
  placement, IA. Le placement automatique tirait au hasard **localement** : sans sa graine, deux
  pairs avaient **deux plateaux différents avant le premier tour**. Et l'affirmation du plan-cadre
  « l'IA ne peut pas tourner sur les deux pairs » était **fausse** : elle est pure à état et
  générateur donnés, donc une graine dérivée par place suffit, sans un seul message (#901).

  **Cinq trous trouvés en exécutant, aucun par inspection** : les lettres de la roue collisionnaient
  avec les touches de mouvement (`KeyS` = bas, `KeyD` = droite — taper `SNSD2` posait `SNSDA`) ;
  `Room.join` rendait la main **avant** le premier `room_state`, donc l'invité lisait une
  configuration vide et affichait « versions incompatibles » alors que tout allait bien ; l'écran de
  terrain ne **transmettait pas** l'intention réseau, si bien que la salle d'attente se montait en
  mode local **sans que rien ne le signale** ; la ligne humaine de l'invité était codée sur la
  première place, alors que c'est celle de l'hôte ; et les sélections d'équipe n'étaient annoncées
  par personne, donc le `start` de l'hôte partait avec des équipes **vides**.

  ⚠️ Un sixième, attrapé par le seul canal factice : le premier correctif de poignée de main marchait
  en e2e et cassait **16 tests d'intégration** — le canal en mémoire livre au plus serré, et
  l'attente du `room_state` s'armait après son passage. C'est exactement la raison d'être de ce canal.

  71 tests dans `packages/network`, un scénario e2e à deux contextes sur **annuaire local** (jamais
  le service public : une coupure d'Internet rendrait le gate rouge). Compteurs de télémétrie du jeu
  en ligne, avec une **cause par compteur** pour les échecs de mise en relation — c'est ce qui dira
  si le pair-à-pair sans relais est tenable. `docs/multiplayer.md` corrigé sur ses cinq points
  périmés.

  ✅ **Revue de code puis validation humaine faites le même jour — décisions #895 à #912.** La revue
  a sorti **2 Critical**, tous deux corrigés avant le commit : le salon faisait confiance au
  `seat` **annoncé dans le message** plutôt qu'à la place dérivée de l'adresse d'annuaire (un invité
  pouvait poser l'équipe de l'hôte en silence, usurper un accusé de lancement, réécrire l'état d'un
  autre) ; et `close({ flush: true })` **ne vide rien** dans `peerjs@1.5.5` — vérifié en source —,
  donc l'accusé de lancement pouvait se perdre. Le second a été corrigé **à la racine** : le salon a
  quitté l'écran de sélection d'équipe pour appartenir à la session
  (`packages/app/src/network/online-room.ts`) et **survit à l'entrée en combat**. C'est aussi
  l'architecture dont le Lot B2 a besoin.

  🔴 **La recette humaine, en deux tours, a rendu 17 retours — dont un bloquant que seule elle
  pouvait trouver** : les serveurs STUN étaient coupés dans l'URL `?peerPort=` servant à la fois à
  l'e2e et au test manuel. Chromium s'en sort sur la boucle locale, **Firefox refuse** (« ICE
  failed »). Trois corrections de conception en sont sorties, toutes contre un choix pris plus tôt le
  même jour : l'hôte a **son propre bouton « Prêt »**, réversible (#909 — dérivée de son équipe, sa
  préparation lui retirait le droit de dire « attendez » et de dégeler ses options) ; une place
  vacante s'annonce **« ⏳ Place libre »** et non « IA » (#910 — sinon un salon en attente ressemble à
  une partie solo déjà complète) ; et les **équipes des autres joueurs sont masquées** (#911, même
  fuite d'information que #729).


- 2026-09-04 — **Plan 198 — La prévisualisation de dégâts devient un paramètre de partie.** Livrée
  d'un trait (plan `ready`, les 8 étapes). Elle quitte les Réglages pour le pied de l'écran de
  sélection d'équipe, à côté de « Placement auto », et les **deux** sont persistées dans
  `pt-settings` — « Placement auto » ne l'était pas du tout, c'était une variable locale qui
  repartait au défaut à chaque entrée d'écran. Le point structurel est le **gel** : `CombatSetup`
  porte `damagePreview` et `isDamagePreviewEnabled` lit cette valeur figée, là où il relisait
  `getSettings()` en direct à chaque appel — sans conséquence en solo, intenable en ligne (#893). Le
  magasin est réutilisé plutôt que dédoublé : sa lecture fusionne déjà avec les défauts, donc aucune
  migration (#894). Le **bac à sable** est le seul chemin de combat sans configuration de partie, et
  le seul à retomber sur la préférence persistée ; la reprise, elle, rejoue le setup sauvegardé, donc
  elle retrouve le choix fait à la sélection d'équipe. **Trois écarts au plan**, tous mineurs : le
  golden que l'étape 8 devait marquer comme soldé était **déjà régénéré** (rien n'attendait) ;
  `e2e/pages/screens.ts` visait la case par `getByRole("checkbox")`, ambigu à deux cases, passé en
  `data-testid` ; une media query sur `.ts-footer` resserre l'écart sous le seuil téléphone, sans
  quoi « Lancer » sortait du pied. Cahier `docs/test-plan.md` suivi (§4.14, §6.4, §6.7, §6.12, table
  des specs) — une case §6.12 passe **🤖 → 👁** : « une bascule des réglages garde le focus » n'a plus
  de signal e2e, « Prévisualisation dégâts » étant la seule bascule de cet écran à muter son libellé
  en place. Nouveau `packages/app/src/settings/index.test.ts` (5 cas, dont celui qui prouve l'absence
  de migration). Décisions #893-894.

- 2026-09-03 (soir) — **Lot B1 cadré : plans 198 et 199 rédigés, relus et corrigés, aucun code.**
  Longue discussion de cadrage avec l'humain qui a révisé cinq points du plan-cadre 195 et de
  `docs/multiplayer.md` (voir § À faire maintenant). Décisions #893-908. Trois relectures lancées en
  parallèle — `plan-reviewer` sur chaque plan, `game-designer` sur les règles de jeu du 199 ; les
  corrections sont appliquées. Deux affirmations de relecture ont été **écartées après vérification**
  dans le code : la manette qui ne saisit pas dans un champ texte est bien un choix explicite
  (`focus-navigation.ts:237`), et une reprise de partie ne peut pas casser sur un setup sans
  `damagePreview` (`battle-persistence.ts:80` jette déjà toute sauvegarde d'un autre build). Deux
  idées notées au backlog : **carte aléatoire** (idée du frère de l'humain) et **éditer son équipe
  depuis le salon**. Le plan 197, absent de l'index des plans, y a été ajouté.
- 2026-09-03 — **Plan 197 — Écran de victoire enrichi (Lot C de la Phase 7), livré et validé à la main.** La dialog de fin de partie affiche désormais, sous le verdict, une rangée de portraits de l'équipe du vainqueur (K.O. grisés par opacité **et** désaturation) puis « N tours · M min ». **Périmètre réduit avec l'humain sur menu** (#890) : pas de MVP — aucun événement du core ne nomme l'attaquant (`DamageDealt` ne porte que `targetId`, `PokemonKo` que `pokemonId`, `pokemon.lastHitBy` effacé au K.O.) —, pas de camp perdant (doublerait la hauteur de la dialog, ingérable à 12 camps), pas d'infobulle de cause de K.O. (inaccessible au clavier et à la manette). Nouveau `packages/view-core/src/battle-outcome-summary.ts` (`buildOutcomeSummary`, fonction libre — lit `state.pokemon`/`state.actionCounter`, testable sans monter d'orchestrateur), port `showVictory` étendu d'un `BattleOutcomeSummary`. **Temps de jeu cumulé** (`elapsedMs?: number` dans `BattleResumeSave`, #891) plutôt qu'un horodatage de départ : une partie reprise le lendemain affiche les minutes réellement jouées, pas les heures écoulées. ⚠️ **Durée de combat (écran, placement exclu) ≠ durée de session (télémétrie, placement compris, #857)** — deux sémantiques assumées, pas un bug à réconcilier (#892). Décisions #890–892. Plan 197 `done`, plan-cadre 195 reste `in-progress` (seul le Lot B — multijoueur P2P 1v1 — n'est pas commencé).
- 2026-08-31 — **Phase 7 planifiée : plans 195 (cadre) et 196 (Lot A télémétrie détaillé) rédigés, `draft`, zéro code écrit.** Découpage : Lot A télémétrie Cloudflare Workers + D1, Lot B multijoueur P2P 1v1 en 4 tranches (transport+lobby / combat / robustesse / désync), Lot C réduit à l'écran de victoire enrichi (Speed controls et Tutoriel interactif partent en Phase 9 — Polish, décision humaine, sans lien avec le réseau ni la télémétrie). **Télémétrie sur trois événements**, pas deux : `session` (fréquentation, funnel d'écran ET usage de l'interface — crédits ouverts, Showdown import/export réussi ou échoué, équipe créée/sauvegardée/supprimée, écran des contrôles, touche réassignée, menu de combat, reprise de combat, langue, plein écran — compteurs accumulés en mémoire, envoyés en deltas par `sendBeacon` à `visibilitychange → hidden`, jamais un envoi par clic, sous peine de faire tomber le plafond à ~1 600 visites/jour), `battle_started` (composition d'équipe par mode — modèle *usage stats* à la Showdown/Smogon, la composition voyage au démarrage pour ne pas perdre les abandons des statistiques), `battle_ended` (issue, durée, tours, K.O. par cause, attaques réellement lancées). Décisions #871-878 : pas de nom de domaine (`*.workers.dev`), Worker dans `packages/telemetry-worker/`, `pnpm stats` + `wrangler d1 execute --remote` pour interroger la base en chat avec noms FR officiels, plafond réel ~25 000 parties/jour (correction du calcul du 2026-08-29), limitation de débit par le binding `ratelimit`, pas de bandeau de consentement. **Constat technique consigné (pas une décision)** : `analytics.ts` déclare 8 événements, 3 ne sont jamais émis (`game-loaded`, `battle-start`, `battle-end`) depuis le refactor `e0c1a221` du 2026-06-15 — aucun combat n'est mesuré depuis deux mois et demi ; traité par l'étape 3 du plan 196. Seule décision encore ouverte : un `battle_id` éphémère par partie (Reco : oui). Prochaine action concrète, bloquante : créer le compte Cloudflare (étape 0 du plan 196, action humaine).
- 2026-08-29 — **Phase 7 préparée, pas démarrée (aucun code).** Audit de faisabilité de tout ce qui avait été noté sur le multijoueur depuis le 2026-04-06, vérifications faites sur le web. Deux prémisses mortes trouvées : « information complète, rien à cacher » (faux depuis le fog du plan 176) et « un serveur autoritaire arrivera en Phase 7 » (supposé par #728, #732, #751 et le plan 181). Tranché : **P2P sans backend** (#862), **fog cosmétique en ligne** — le report de #728/#732 est clos par un « non » (#863), **chronomètre local auto-déclarant** dont le timeout produit une *action* et non un message réseau, donc il traverse `exportReplay()` sans cas particulier (#864, #865), **codes de partie préfixés** car le namespace PeerJS Cloud est mondial et partagé (#866), **télémétrie sur Cloudflare Workers + D1** en remplacement de Goatcounter, faussé par les bloqueurs de publicité (#867, #868), ordre d'apparition de Workers (#869), pas de classement compétitif (#870). Supabase écarté (pause à 7 jours ; le cron GitHub censé la contourner est lui-même désactivé après 60 jours sans activité du dépôt). Livrables : `docs/multiplayer.md` réécrit en v2 (306 → 539 lignes), décisions #862-870 + section « Révisé à la préparation de la Phase 7 », Phase 7 de `roadmap.md` recadrée, mentions « WebSocket » de `roadmap.md` et `game-design.md` §14 corrigées — elles contredisaient la décision #209 depuis avril.

- 2026-08-27 — **Trois reliquats soldés avant release : points 4K de l'interface de combat, échelle morte du Team Builder, migration i18n du journal (plan 190).** (1) **4K** — la note de ce fichier était périmée sur un des trois éléments (l'indicateur de tour avait déjà ses paddings scalés depuis le plan 179) ; les deux vrais défauts, pastille d'instruction et dialog de victoire, sont corrigés par une famille de tokens locale `--bc-pad-*`/`--bc-radius-*` sur le `:where(.bc-root, .bc-left-col)` partagé, et le sous-arbre est passé en entier — plus aucun `--spacing-*`/`--radius-*` fixe dans `battle-chrome.css` — le nom de fichier reste anglais, convention du dépôt (décision #849). (2) **Team Builder** — décision humaine de **ne pas** ressusciter `--tb-px` et de purger : `team-builder-overlay.css` 216 → 78 lignes, plus les 7 indirections `var(--tb-*, Npx)` restées sans déclarant dans `stat-bar.css`/`set-op.css`/`edit-panels.css` (décision #850). (3) **i18n du journal** — migration **complète** : le périmètre réel était 157 ternaires + 10 tables = **234 chaînes** dans 1617 lignes, pas les « six familles » annoncées ; `BattleLogFormatter.ts` finit à **0** occurrence de `=== "fr"`, les locales passent de 699 à **933 clés**, sortie octet pour octet identique en FR et EN. Migration **scriptée** (extracteur maison — l'API compilateur JS de TypeScript n'existe plus en TS 7, portage Go), avec contrôles automatiques de parité de paramètres FR/EN et de clés dupliquées ; les chaînes n'ont jamais été retapées, une recopie de mémoire ayant justement inventé « Terrain Herbu » là où le code dit « Champ Herbu ». Test dédoublé par responsabilité (clé+params côté `ui-dom`, phrases FR/EN côté `app` avec les vraies locales) — aucune couverture perdue. Décisions #851-855. **Correction d'accents, avec son contrecoup** : `"action.move"` (« Deplacement ») **et** `"action.undoMove"` (« Annuler deplacement ») étaient non accentués — deux valeurs, pas une (ma première vérification n'avait cherché que la capitale). Ces deux libellés sont des **sélecteurs e2e** : les corriger a fait tomber ~30 tests au premier passage du gate. Répercuté sur **25 occurrences dans 15 fichiers e2e** (dont le POM `CombatScene.ts`) + **12 dans `docs/test-plan.md`**, plus le titre §6.4 de `docs/reflexion-patterns-attaques.md`. Leçon pour la prochaine fois : un libellé d'action de l'interface de combat est du texte **lu par le harnais**, pas seulement par le joueur.

- 2026-08-26 — **Plan 189 — Panoramique clavier, menu de combat au placement, découvrabilité du défilement, livré et validé à la main, scénario par scénario (six défauts trouvés et corrigés pendant la recette).** Trois trous soldés d'un coup, réunis parce qu'ils partagent leurs fichiers. **Volet A (panoramique clavier)** : nouveau `packages/app/src/input/keyboard-hold-source.ts`, modèle d'entrée **continu** au clavier (le seul comportement continu existait jusque-là côté manette) — `keydown` ajoute au jeu de touches tenues, `keyup` retire, `blur`/`visibilitychange` purgent (sinon `Alt+Tab` laisse une touche « collée »). Le panoramique redevient **remappable**, défauts `Numpad8/2/4/6`, jeu de secours **fixe** `Maj`+flèches pour les claviers sans pavé (non remappable, jamais prioritaire sur un binding du joueur), `Numpad1/2/3` libérés des crans de zoom qui gardent `Digit1/2/3`. Révise les décisions #807 et #811 (`docs/decisions.md` § Révisé au plan 189) — leur prémisse (« ne fonctionne qu'en continu, la couche est en `keydown` ») est tombée. **Volet B (menu de combat au placement)** : une seconde instance de `createCombatMenu` vit pendant la phase de placement (Reprendre / Paramètres / Recommencer / Quitter, pas d'« Abandonner » — aucune sauvegarde à purger à ce stade ; Quitter confirme), détruite quand `runBattle` prend la main. `Échap` ouvre le menu seulement quand il n'a rien à annuler (`undoLastPlacement` reste prioritaire). **Volet C (découvrabilité)** : règle générale actée — chaque bouton du chrome porte le glyphe de sa touche sous lui (Journal, `☰` Menu). Bloc de glyphes de défilement de la timeline CT, affiché **en permanence** (elle déborde toujours, 4K comprise), lu aux extrémités de la liste ; dans le journal, seulement **au débordement** (`scrollHeight > clientHeight`). `R3` + direction annonce aussi le geste manette de ce nouveau bloc. **Capuchons de touche larges enfin supportés** : `--cl-cap-span` élargit la fenêtre du masque (pas seulement la largeur), ce qui lève la limite « 1 tuile » de la décision #791 (relevé complet des tuiles 2026-08-26 dans `docs/references/kenney-input-prompts-tileset.md`). **Point resté ouvert, non tranché** : les lignes de légende caméra vivent désormais dans la colonne de l'ordre de jeu et suivent donc la timeline quand sa case active se vide en prévisualisation de coût CT — la décision #798 disait le contraire ; test e2e laissé **volontairement rouge** en attendant arbitrage (§ Reporté). Décisions #843–#848 + révisions de #807/#811/#791.
- 2026-08-26 — **Plan 188 — Refonte de l'écran de sélection d'équipe + passe manette (Team Builder & modales), livré et validé à la main, 5 scénarios sur 5 (clavier et manette Switch Pro filaire).** Dernier chantier issu de la validation du Lot 2, deux volets. **Volet 1 (écran de sélection d'équipe)** : le `<select>` replié du format devient une rangée de segments toujours visible (`1v1 2v2 3v3 4v4`, décision #830), libellés `2J × 6` sous « Joueurs × Pokemon » plutôt que `2v6` — qui se lisait « deux contre six » (#835) ; Humain/IA devient un segment à deux états, les deux visibles en permanence (#831) ; **la notion de « joueur actif » disparaît** — `activeSlotIndex` (deux curseurs pour un seul geste avec le focus DOM du plan 184) est supprimé, chaque cellule ouvre une modale de choix d'équipe (#832), et après une sélection réussie le focus avance au prochain camp non assigné, écart assumé à la convention `<dialog>` (#834). **Volet 2 (Team Builder à la manette, jamais éprouvé)** : c'était une impasse, pas une gêne — chips de filtre et lignes de résultat des trois sélecteurs étaient des `<div>` invisibles au focus, aucune sortie de modale au pad (pas d'`Échap`), aucun arbitrage du contrôle focalisé côté manette (slider PS, `<select>`). Corrigés : chips/lignes/onglets Showdown en vrais `<button>`, `B` ferme la modale, ← → règlent un slider au pad (répétition déjà présente dans `gamepad-source.ts`, aucun modèle d'entrée continu à écrire), focus d'entrée à trois cas selon la source (souris → recherche, doigt → rien, manette → premier résultat). **Corrections trouvées EN COURS de test humain, hors cadrage initial** : le télescopage visuel jaune actif/focus — sélectionné passe au bleu des boutons, le jaune reste réservé au focus (#836) ; **la préservation du focus au re-rendu devient un helper partagé** (`packages/app/src/ui/dom/preserve-focus.ts`, `renderPreservingFocus`) après le retour « ça perd le focus à peu près partout », branché sur `TeamEditView`, les trois sélecteurs, `MyTeamsView`, `NaturePickerModal` et l'écran de sélection d'équipe (#837) ; trois familles de `<div>` cliquables du panneau d'édition (ligne d'objet, 4 lignes de capacité, lignes du menu des builds) converties en `<button>` — l'audit du plan s'était trompé en comptant des créations d'éléments plutôt que d'examiner quels contrôles portent l'action (#838) ; **la Nature devient une liste maison** (`NaturePickerModal`, trois colonnes nom/hausse/baisse, couleurs de l'InfoPanel, filtres par stat, source de vérité `getNatureEffect`), le `<select>` natif disparaissant du Team Builder **et** du sandbox — qui garde sa ligne « Aléatoire » (#839) ; **pas de saisie de texte à la manette** — recherche des 3 sélecteurs et nom d'équipe portent `data-nav-skip="gamepad"`, filtrage par chips (#840) ; **« Remplir IA » supprimé**, devenu sans objet une fois #831 assignant déjà une équipe aléatoire à un camp IA (#841) ; **bug qui tuait la manette entière jusqu'au rechargement** — `applyToControl` appelait `stepUp` détaché de son receveur (`Illegal invocation`) et l'exception tuait la boucle `requestAnimationFrame` du poller, corrigé à la source **et** par un `try/catch` filet dans `gamepad-source.ts` (#842). e2e `dom/gamepad-pickers.spec.ts` (manette synthétique partagée `pages/gamepad.ts`), cahier §6.4/§6.13. **Point resté ouvert** : la validation matérielle des correctifs de la revue de code n'a pas été rejouée sur pad réel (voir § Reporté). Décisions #830–#842. **Revalidation sur pad réel des correctifs de la revue de code FAITE (2026-08-26, confirmée par l'humain)** : `preserve-focus.ts` partagé, boutons du panneau d'édition, `NaturePickerModal` et résilience du poller manette rejoués sur pad réel, pas seulement à la manette synthétique de `dom/gamepad-pickers.spec.ts` — le plan 188 est validé de bout en bout, correctifs compris.
- 2026-08-25 — **Plan 187 — Menu de combat, livré et validé à la main, dernier chantier issu de la validation du Lot 2.** Surcouche d'interface qui **n'est pas une pause** (décision #819) : rien n'est suspendu, le combat continue derrière (l'IA joue, les animations se déroulent). Ouvert par `Start` (manette, laissé libre exprès par le plan 186) — pas de défaut clavier, `Échap` fait déjà le travail. Nouveau `packages/app/src/ui/dom/combat-menu.ts` : un `<dialog>` à quatre niveaux (menu → Paramètres → Contrôles → confirmation), qui **empile sa propre registration** sur la pile de l'`InputSystem` (décision #821, aucun consommateur du combat n'est touché) et neutralise le `cancel` natif du `<dialog>` (décision #822, sinon double traitement d'`Échap`). **`BattleOrchestrator.onEscape()` retourne désormais un booléen** (décision #820) : les deux `cancel` du combat n'ouvrent le menu que quand rien n'a été annulé — le point le plus à risque de régression, couvert par des tests phase par phase avant branchement. **Deux sorties distinctes** (décision #823, révisée pendant le test humain) : `Abandonner` purge la sauvegarde de reprise derrière une confirmation, `Quitter` la garde sans confirmation — visible seulement là où une sauvegarde existe (jamais dans le studio sandbox). **Extraction des panneaux Réglages/Contrôles** dans `ui/dom/panels/` (décision #824) : `ScreenManager` fait *dispose puis mount*, donc naviguer `combat → settings` par l'écran normal aurait tué la partie ; les deux panneaux sont désormais montés à la fois par leur écran et par la surcouche, sans qu'un seul `data-testid` ne bouge. **Icônes** : le burger `☰` passe au menu de combat, le journal prend `▤` (décision #825). Trois cas de bord testés : la victoire qui survient menu ouvert (le menu se referme, la victoire prend la main), `open()` refusé si un autre `dialog` est déjà ouvert, une visée en cours retrouvée intacte à la fermeture. Décisions #819–#826.
- 2026-08-25 — **Plan 186 — Écran de remapping clavier & manette, livré et validé à la main.** Les bindings quittent les sources d'entrée pour un **magasin unique** (`packages/app/src/input/bindings-store.ts`), transposé **par action**, dont les tables de recherche sont **dérivées** et mises en cache (le chemin chaud n'itère jamais) ; la source clavier, la source manette et la légende du plan 185 le relisent, donc la légende suit un remapping sans câblage. Nouvel écran `controls` atteint depuis Réglages : **une seule table à 3 colonnes** (Principal / Secondaire / Manette — les onglets par appareil du premier jet ont été abandonnés sur retour humain), 5 sections (« Curseur & menus », « Prévisualisation AoE », « Caméra », « Barre d'ordre de jeu », « Journal de combat »), capture de touche par `InputSystem.beginCapture` (pas un écouteur de plus), **échange automatique** en cas de conflit avec message nommant l'action délogée, et deux états de case bien distincts — *vide de naissance* (neutre) vs *vidé par un échange* (rouge + astérisque), sans quoi l'écran s'ouvrait couvert d'alertes. **Nouveautés de jeu au passage** : `J` ouvre/ferme le **journal de combat** (le repli existait mais n'était atteignable qu'à la souris), `Page ↑/↓` passe à la **barre d'ordre de jeu** et le journal sous `Maj+Page ↑/↓`, bascule **« Inverser le stick droit »**. Côté manette : `Y` = cible précédente, **`Select` ouvre le journal** et le geste de défilement (`R3` maintenu + direction, déplacé depuis `Y`) est enfin **affiché** — le tout **validé sur manette réelle le 2026-08-25** — il existait depuis le plan 184 sans être écrit nulle part. `Start` reste libre pour le futur menu de pause. **Trois bugs de manette corrigés** par la validation : pad **muet sous Firefox** (`mapping` vide pour une Switch Pro → on route désormais toujours avec les indices standard, une erreur se corrigeant dans l'écran), **anneau de focus invisible** à la manette (`:focus-visible` ignore le pad → `[data-input-source="gamepad"] :focus`), et **poller qui s'éteignait** à la première frame vide (délai de grâce + démarrage de rattrapage). `MenuNext`/`MenuPrevious`, actions mortes depuis le plan 184, supprimées ; `NumpadEnter` perdu (2 slots). **Tests** : 93 unit sur `packages/app/src/input/`, 16 e2e (`dom/controls-remapping`, `dom/gamepad-menus` avec **manette synthétique**, `combat/controls-remapping`), cahier §6.12. Décisions #803–#816.
- 2026-08-24 — **Plan 185 — Légende de contrôles près de la boussole, livrée et validée desktop + téléphone réel.** Nouvel élément DOM permanent (`packages/ui-dom/src/control-legend.ts` + `styles/control-legend.css`, monté par `battle-chrome.ts`) : glyphe « ça se clique » (souris/doigt) à droite de la boussole, lignes **rotation** puis **zoom** en dessous (`[dessin][touche]` : `⟲ A` / `⟳ E`, loupe `+` `R` / loupe `−` `F`) ; manette = `LB`/`RB` rotation, `RT`/`LT` zoom, pas de glyphe de clic ; tactile = ligne rotation masquée (la boussole tourne déjà la vue au tap), zoom = loupes + main écartée/pincée. Permanente, alpha 0,72, `pointer-events: none`. Source d'entrée résolue en CSS pur (`data-input-source`). **Positionnement** : la légende lit la même mesure que le renderer pour épingler la boussole (`chrome-insets.ts`, gagne un `subscribe`) — deux approches échouées avant : ancrage DOM dans la case active de la timeline (vide en prévisualisation de coût CT → boîte 0×0 → légende écrasée sur la boussole), puis réservation de cette boîte en CSS (déplaçait la boussole, même mesure) ; leçon : une mesure a UN propriétaire. **Étiquette de touche selon la disposition** (`packages/app/src/input/key-legend.ts`) : `navigator.keyboard.getLayoutMap()` (Chromium, contexte sécurisé, peut lever `SecurityError`) + repli sur la langue du jeu (FR → `A`, EN → `Q` pour `KeyQ`) ; piège documenté : les capuchons Kenney sont rangés par position QWERTY mais **dessinent** une légende QWERTY, donc `KeyQ` se dessine avec la tuile `A` pour un joueur AZERTY. **Mesh anneau supprimé** de `babylon-compass.ts` (2ᵉ chemin de rendu de glyphe) : le proxy de picking de la boussole redevient un **carré** (plancher 44 px) au lieu du rectangle étiré jusqu'au glyphe, mais garde sa croissance vers la droite seulement — centré, son bord gauche mordait ~4 px sur le portrait de la timeline (mesuré en e2e). **Pack de curseurs Kenney intégré** (`cursor-pixel-pack`, CC0) en **variante masque commitée** (`packages/app/public/assets/ui/cursors/tilemap-1bit.png`) — l'original dessine des lignes blanches dans un contour noir opaque, incompatible avec un masque CSS ; grille 20×11 tuiles 16 px. Le tap est désormais dessiné par cette feuille **partout**, y compris la ligne d'instruction (`.bc-input-glyph`). **Bug non lié corrigé** : Babylon pose lui-même `tabindex="1"` sur le canvas (constructeur `Scene`) — premier arrêt de tabulation de la page, liseré `:focus-visible` global dessiné autour de toute la scène — corrigé par `canvas.tabIndex = -1`. **Tests** : `compass-rotate-hint.spec.ts` renommé `compass-and-legend.spec.ts` (6 tests), `input-prompt-glyph.spec.ts` +2 (12 verts), nouveau `key-legend.test.ts` (6 verts unit). Le chantier « écran de remapping », initialement lié à celui-ci (décision humaine 2026-08-21), en est désormais **détaché** (décision humaine 2026-08-24) — il reste seul en § Reporté. Décisions #797–#802.
- 2026-08-21 — **Plan 184 — Contrôles clavier & manette (Lot 2 du plan-cadre 173) livré : la Phase 6.5 a ses 3 lots clos.** Étapes A→E toutes faites. **Couche d'actions logiques** dans `packages/app/src/input/` (7 modules) : un **seul** écouteur clavier pour l'app, un routeur qui donne l'action à **un** consommateur selon le contexte (`menu`/`board`/`screen`/`locked`, dérivé des 9 phases via le nouvel accesseur `inputContext()` de l'orchestrateur), un tracker de source *last-input-wins* publié en `data-input-source`. Les **5 `keydown` dispersés sont supprimés** (`combat-scene`, `combat-screen`, `placement-flow`, `elements`, `map-select-screen`), dont le `stopImmediatePropagation()` qui masquait l'absence d'arbitrage — remplacé par un **test d'invariant** « une action n'atteint jamais deux consommateurs ». **Curseur de plateau au clavier/manette** : c'était LE trou (le curseur n'existait que comme conséquence d'un `pointermove`), résolu par une conversion écran→grille qui **projette les 4 voisins et garde le meilleur** plutôt qu'une table d'azimut — s'auto-corrige à toute rotation, et les vecteurs de référence sont les **diagonales** écran (en vue dimétrique les axes de grille se projettent en diagonales, convention FFT). **Bindings par position** (`KeyboardEvent.code`) : `KeyW/A/S/D` = ZQSD/WASD, `KeyQ`/`KeyE` = A-E/Q-E, zoom `Digit1/2/3` absolu + `KeyR`/`KeyF` relatif. **Manette** : polling rAF, fronts sur **valeurs primitives** (Chrome mute les objets `Gamepad` en place — une référence gardée casse toute détection de front en silence), deadzone circulaire, répétition, `Y` maintenu + direction = défilement journal/timeline. **Focus** : règle `:focus-visible` globale (il n'en existait qu'une dans tout le CSS), menu qui reprend le focus après `replaceChildren` **seulement** si la source est clavier/manette, et `settings-screen` qui mute son libellé au lieu de se reconstruire. **Étape E (dette du plan 183) faite en déplacement réel** : les ~180 lignes de gestes vivent dans `input/pointer-source.ts` et `render-babylon` n'a plus **aucun** `addEventListener("pointer*")` — au prix de 9 primitives d'entrée sur le port (`pickTileAt`, `isCompassHitAt`, `setCursor`, `dispatchTileClick`, 4 pour le sélecteur d'orientation, `panCameraByPixels`) : l'app décide, le renderer mesure. **Trou trouvé à l'exécution** (décision #783) : `onTileClick` n'a aucun cas pour la phase d'orientation, donc au clavier « Attendre » ouvrait une phase sans issue et le **placement** ne laissait placer aucun Pokemon — les flèches visent désormais le sélecteur et Confirm lui est offert d'abord. Tests : 13 e2e clavier + 45 unit couche + 5 unit `inputContext()`, les 7 e2e tactiles du plan 183 verts **après** déplacement. **VALIDÉ À LA MAIN le 2026-08-21** : clavier (AZERTY/Firefox), caméra, menus, orientation, placement, **manette Switch Pro** filaire (reconnue `standard` par Firefox), **téléphone réel**, et **téléphone + manette** — le cas que le plan-cadre 173 voulait first-class, qui marche sans code spécifique. La recette a produit **14 correctifs, plus que l'implémentation initiale**, dont 7 défauts structurels : menu principal sans registration (seul écran sans « retour » à brancher), aucune activation native derrière un appui de manette (A ne faisait rien sur les menus), focus piégé dans les contrôles de formulaire, navigation en ordre DOM au lieu de spatiale, bouton « Terminer » du placement inatteignable, dialogue de victoire classé `locked`, placement sans origine de curseur. Le point commun des trois derniers : **une phase classée dans le mauvais contexte d'entrée rend une UI entière inatteignable, sans erreur et sans test rouge** — c'est le risque propre à cette architecture. Plus 7 défauts que seul un humain pouvait voir (liseré promettant la mauvaise action, « Annuler le déplacement » en tête de menu déclenché sans le viser, curseur ne repartant pas du Pokemon actif, annulation muette sur Plénitude / clignotement persistant sur Destruction, A/B inversés sur manette Nintendo, pan au stick inversé, glyphes mal calés). Décisions #776–#796.
- 2026-08-20 — **Plan 184 (Lot 2 : clavier & manette) rédigé, revu par 3 agents et corrigé — `draft` prêt à exécuter, aucun code écrit.** Cartographie : le trou central n'est pas la manette, c'est le **curseur**, qui n'existe que comme conséquence d'une position de pointeur (`onTileHover`) ou d'un tap — sans pointeur, aucune façon de désigner une case, donc tout le Lot 3 est invisible au clavier pour la même raison qu'il l'était au doigt avant le plan 183. Architecture : couche d'actions logiques + tracker de source *last-input-wins* dans `packages/app/src/input/` (décision humaine : pas de nouveau package), accesseur `inputContext()` sur l'orchestrateur (`InputState` reste privé), 4 ajouts au port `CombatScene` (`moveCursor`, `cursorTile`, `rotateCamera`/`zoomCamera` + `setZoomLevel`). **Bindings par position physique** (`KeyboardEvent.code`) : `KeyW/A/S/D` donne ZQSD en AZERTY et WASD en QWERTY, `KeyQ`/`KeyE` donne A/E et Q/E — un seul jeu, zéro détection de disposition. Zoom = `Digit1/2/3` (les 3 crans de `ZOOM_LEVELS` en absolu) + `KeyR`/`KeyF` en relatif ; `+`/`−` écartés (position `Minus` = `)` en AZERTY) et `Maj+&` évité (la rangée du haut ne produit des chiffres qu'avec `Maj` en AZERTY — argument de plus pour `code`). **Correction factuelle attrapée en revue** : la caméra tourne par **quarts de tour, 4 azimuts** (`AZIMUTH_STEP = Math.PI / 2`, décision #476), pas par crans de 45° comme le draft l'écrivait — donc « haut de l'écran » tombe toujours pile sur un axe de grille, aucune diagonale à gérer (l'erreur aurait fait sur-concevoir la conversion écran→grille). **2 pièges de stack documentés** : Chrome **mute les objets `Gamepad` en place** à chaque frame (garder une référence casse toute détection de front, silencieusement — copier les primitives), et Chrome émet un `pointermove` de **delta 0** au `pointerdown` (constaté sur Babylon.js : sans filtre explicite, un appui rebascule la source active sur `pointer` après une entrée clavier). **Limite connue Firefox** : `mapping === ""` pour toute manette absente de sa table interne, même standard (Bugzilla #952773/#1542893/#1922925) → une manette réelle peut y être silencieusement invisible, à vérifier sous Chromium avant d'accuser notre code. Décisions humaines : bindings fixes (remapping → plan dédié ensuite), focus DOM natif (ni *roving tabindex* ni `role="menu"`, choix assumé), inspection du plateau **perdue** pendant `action_menu`/`attack_submenu` (assumé, bascule `Tab`/`Y` écartée mais peu coûteuse à rouvrir : le curseur est gelé, pas détruit), défilement journal/timeline par bindings dédiés (`PageUp/PageDown`, `Maj+` pour la timeline ; manette `Y` maintenu + croix) plutôt que par `tabindex`. Le rapatriement des gestes tactiles (dette plan 183) est l'**étape E, en dernier et coupable du plan** : validé sur téléphone la veille, c'est le plus coûteux à revalider.
- 2026-08-20 — **Chantier « aide visuelle des gestes attendus » (suite du Lot 1 du plan-cadre 173), commit WIP `6891639` + corrections de revue — résout la décision « Style Kenney » laissée ouverte par le plan-cadre 173.** Glyphe de geste dans la ligne d'instruction du combat (nouveau `packages/ui-dom/src/input-prompt-glyph.ts`, pastille restructurée en `.bc-instruction-row`) : masque CSS sur la feuille Kenney **`input-prompts-pixel-1-bit`** (16×16, 1-bit, CC0) — souris en pointeur fin, main-curseur en pointeur grossier (`@media (pointer: coarse)`), suffixe « ×2 » tactile uniquement sur les 2 phases directionnelles (`aimDirection`, `selectDirection`). Taille `0.9em` après 2 rejets (48px trop gros en 4K, 32px trop petit). **Glyphe de rotation à droite de la boussole** (`babylon-compass.ts`, billboard texturé NEAREST alpha-blend, groupe HUD) : le proxy de picking s'étend vers la droite seulement, boussole + glyphe forment une seule zone tapable. Assets committés (`packages/app/public/assets/ui/input-prompts/tilemap-1bit.png`, 7,9 Ko, + `LICENSE.txt`) + crédits `credits.inputPrompts` (FR/EN). **Pack retenu contre la reco du plan-cadre 173** (`input-prompts` 64×64 couleur), tranché hors du Lot 2 où le plan 183 en repoussait le choix. **Correction factuelle** : le pack n'a **aucun** glyphe de geste tactile (ni tap, ni double tap, ni pinch, ni swipe) — l'ancienne note de cette section « couvre manette, tactile et souris » était fausse. Tuiles retenues : 111 (souris, après rejet de la 478), 578 (doigt), colonne 27/ligne 19 (rotation, choisie par l'humain **contre** la lecture géométrique du sens — la tuile qui *paraît* horaire se lisait à l'envers sur la scène réelle). Exception assumée au facteur entier pour le glyphe boussole : demi-pas de 8px, pas 16px (79px compass 4K, les paliers entiers n'offraient que trop petit/trop gros). **Piège CSS transversal** : `calc(32px / 16px)` (longueur ÷ longueur → nombre) accepté par Chromium, **rejeté par Firefox** (déclaration entière jetée, glyphe disparu sans erreur console) — le facteur doit être un nombre nu. Doc complète : `docs/references/kenney-input-prompts-tileset.md`. e2e `input-prompt-glyph.spec.ts` (10) + `compass-rotate-hint.spec.ts` (4), cahier §4.8/§4.18 (3 cases 👁→🤖). **`cursor-pixel-pack` non intégré** (reste ouvert, le Lot 2 réutilisera la feuille 1-bit déjà en place pour ses glyphes clavier/manette). Dettes notées : bug préexistant `normalizeMesh` (bounding info périmée du mesh boussole, sans effet visuel — voir `docs/references/babylon-gotchas.md`), canvas 0×0 → `NaN` en amont de `pinToCorner` (récupération auto), « ×2 » pas strictement vrai si la direction par défaut affichée convient déjà, géométrie de feuille dupliquée entre CSS et Babylon, golden `credits-visual-linux.png` régénéré. Décisions #770–#775.
- 2026-08-20 — **Plan 183 — Contrôles tactiles (Lot 1 du plan-cadre 173), livré et validé sur téléphone réel — résout la justification prioritaire de la phase (retour réel « injouable mobile »).** Table de pointeurs (`Map<pointerId>`) + `pointercancel` + `setPointerCapture` (remplace l'état scalaire pensé souris, `combat-scene.ts`). Seuil tap/glissé dérivé de `pointerType` (5px souris/pen, 10px doigt). **Un tap agit du premier coup** — le tap en deux temps généralisé, écrit puis mesuré sur le vrai flux, s'est révélé redondant avec l'étape de confirmation déjà présente (4 taps contre 2 clics à la souris) et a été abandonné ; seule exception : viser un pattern directionnel (cône affiché par défaut, retaper la **même direction** lance — comparaison par direction et non par case, arbitrée dans l'orchestrateur, seul à la connaître), même règle pour l'orientation de fin de tour (bug corrigé : un booléen validait la nouvelle direction au lieu de l'afficher). Pinch à 2 doigts → crans de zoom existants (pas de zoom continu) + pan par centroïde. Boussole devenue tapable, taille/ancrage **repris de la première case de la timeline** (nouveau `packages/ui-dom/src/chrome-insets.ts`, mesure DOM injectée dans `render-babylon` via `CombatSceneOptions` — le renderer ne dépend pas de `ui-dom`) après 3 dérives sur téléphone. **Annulation atteignable au doigt** sur les 6 phases annulables (5/6 étaient des culs-de-sac sans clavier) — bouton « Annuler » étendu, `BattleInstruction` +2 variantes, +2 clés i18n FR/EN. Nouveau `tapTile` dans le hook e2e (`clickTile`/`hoverTile` inchangés, ~419 tests e2e intacts par construction). **Dette assumée notée** : le tactile est codé en direct dans `combat-scene.ts`, à rapatrier derrière la couche d'actions logiques au Lot 2. Décisions #763–#767.
- 2026-08-19 — **Flaky partagé (`knock-off`/`steel-beam`) : cause réelle établie, corrigée par test — le diagnostic « isolation de tests fragile » (#712, 2026-07-23) était faux.** Aucune mutation d'état partagé, aucun effet du sharding, aucun trou du `deepFreeze` — c'est un manque d'épinglage de l'aléa. `BattleEngine.ts:239` (`this.random = random ?? (() => Math.random())`) est un seam de test délibéré et documenté, piloté par `vi.spyOn(Math, "random")` dans ~323 fichiers ; 4 tests l'omettaient en affirmant tout de même un résultat dépendant d'un coup réussi ou d'un jet de dégâts. Mesuré : `steel-beam` (Métalaser, précision 95) ratait 4,70 % des runs (94/2000, reproduit en forçant `Math.random` à 0.99) ; `knock-off` (comparaison à deux moteurs) s'inversait 2,15 % du temps (43/2000, un critique sur le run sans objet). Corrigés (épinglés `vi.spyOn(Math, "random").mockReturnValue(0.5)` + `afterEach(() => vi.restoreAllMocks())`) : `steel-beam.test.ts`, `knock-off.test.ts` (exposés, prouvés par la mesure), `gravity.test.ts` (exposé, prouvé statiquement — assertion « dégâts > 0 » après Cavalerie Lourde précision 95), `clear-amulet.test.ts` (non exposé en pratique, épinglé par principe ; son titre disait à tort « uses Draco-Météore », le code utilise Surchauffe — corrigé). `smack-down.test.ts` audité et écarté (Vol n'y sert qu'à poser la semi-invulnérabilité, assertions sur drapeaux/events). Option de classe écartée par la mesure : un PRNG seedé par défaut dans `BattleEngine` casse des centaines de tests dépendant du seam — le remède est par test, pas au moteur. Vérification : 0 échec sur 45 exécutions complètes (contre 1/14 avant). Règle ajoutée à `.claude/rules/core.md` : un test qui affirme un résultat dépendant de l'aléa doit épingler `Math.random` ou passer un `random` seedé au harnais. `deepFreeze` (#712) reste en place (garde-fou valable contre une vraie mutation croisée, n'était simplement pas le remède de CE flaky). Décisions #759–#760.
- 2026-08-19 — **Projet vitest `scenarios` ne résolvait plus ses imports depuis un bump de dépendances antérieur à v2026.7.3, corrigé.** `ct-scoring-anti-drag`, `ct-system`, `ghost-traversal` échouaient sur `Cannot find package '@pokemon-tactic/core'` et n'exécutaient **aucun test** — silencieusement, car `test:scenario` était absent du niveau `full` du gate (`.claude/skills/ci-gate/run.sh`), ce qui a laissé la casse passer inaperçue ~4 semaines. Cause : `resolve.tsconfigPaths` ne mappe les alias que pour les fichiers couverts par l'`include` du tsconfig racine, resté `["packages/*/src"]`. Corrigé : `scenarios` ajouté à cet `include`, nouveau `scenarios/tsconfig.json` (extend `tsconfig.base.json`), `typecheck:scenarios` chaîné dans `pnpm typecheck`, step `test:scenario` ajouté au niveau `full` du gate. 20 tests s'exécutent et passent désormais. Décision #761.
- 2026-08-19 — **Plan 182 — Anneaux d'aura au sol, DERNIER item du Lot 3 → Lot 3 terminé.** Les auras se lisaient au sol par des émoji flottés sur chaque tuile du rayon, **construits au survol du lanceur** : par défaut rien n'indiquait qu'on traversait une zone protégée. Remplacés par des **anneaux permanents** dessinant le contour de la zone (contour en escalier, section **1 voxel**, empilés en world-Y au pas de **2 voxels**, une teinte par aura), au-dessus de la peinture des Champs. Répartition : l'anneau dit **où**, la pastille de barre de vie dit **quoi**. **Constat qui a dimensionné le chantier** : le pipeline de contour procédural existait déjà de bout en bout (`view-core/field-terrain-borders.ts` rend les arêtes de périmètre d'un jeu de tuiles quelconque, `babylon-field-terrains.ts` les rend en `CreateGreasedLine` posés sur le haut de chaque tuile), et `FIELD_TERRAIN_OUTLINE_WIDTH = 0.04` valait déjà 1 voxel (1/24 = 0.0417) — le plan s'est réduit à du view-model plus un clone paramétré. Nouveaux `packages/view-core/src/aura-ring-view.ts` (`buildAuraRingSpecs`, normalise les **3 sources hétérogènes** : `state.auras`, `pokemon.perishAura`, verrou `lockInMoveId`) et `packages/render-babylon/src/babylon-aura-rings.ts` ; port `setAuraGroundIcons` → `setAuraRings`. **Requiem** perd son court-circuit (elle faisait `return` avant les auras d'équipe : un lanceur Requiem + Protection n'affichait que Requiem). **Brouhaha gagne son premier rendu** — elle projetait une aura anti-sommeil r3 dans le core (`uproar-aura.ts`) **rendue nulle part**, désormais anneau + pastille 🔊. Teintes dérivées de la couleur de l'émoji (règle humaine), avec 2 écarts tracés (Requiem bleu nuit → violet, Brouhaha sans base émoji → orange) et poussées à l'écart des **8 couleurs de zone au sol déjà prises**. Refacto au passage : les 3 duplications inline du calcul de zone d'aura (`battle-views`, `battle-orchestrator`, `ai/action-scorer`) routées sur `isWithinAuraRadius` — la zone dessinée ne peut plus diverger de la zone qui protège. Purge : `babylon-aura-ground-icons.ts`, `view-core/aura-ground-layout.ts` (+ son test), `showAuraHoverFor`, et les constantes `AURA_HOVER_*` — **définies en double** dans `render-babylon` et `packages/app` (duplication préexistante), plus 2 orphelines de l'ère Phaser. Tests : 12 unit view-model, 4 unit core sur le helper partagé. Aucun gating sous l'information cachée (héritage #728-#732 : les auras y sont déjà « visibles »). Décisions #753–#757.
- 2026-08-14 — **Plan 181 — Reprise d'un combat en cours (lot 180-c).** Approche : sauvegarde = **journal d'actions + seed + entrées de setup** (carte, équipes, placements), jamais d'état dérivé ; reprise = `createBattleFromPlacements` + rejeu. Infra déjà là (`BattleReplay`, `exportReplay`, `runReplay`, golden replay) → aucun sérialiseur à écrire, exact par construction. Mesuré : 600 actions 6v6 = 45 Ko, rejeu 17 ms. Nouveaux `packages/app/src/app/battle-persistence.ts` (clé `pt-battle-resume`, port `load`/`save`/`clear`), `packages/app/src/babylon/battle-resume.ts` (`buildBattle` partagé live/reprise, `resumeBattle`), `packages/app/src/testing/{local-storage-stub,mock-battle-resume}.ts`. Core : `runReplay` gagne un `ReplayActionObserver` optionnel pour reconstruire intégralement le journal — rien d'autre ne bouge. `BattleOrchestratorConfig.onActionCommitted` sauvegarde après chaque action validée (humain et IA) + une fois au démarrage. Entrée « Reprendre le combat — <carte> » en tête du menu principal, visible seulement si sauvegarde valide (pas de reprise silencieuse, pas de modale au boot). Effacement à `BattleEnded`, retour menu, « Rejouer ». **Correctif de déterminisme** : `creationRng` était `Math.random` par défaut côté live → les genres non fixés (lus par Attraction) pouvaient changer à la reprise ; désormais `createPrng(seed)`, dernier `Math.random` du chemin livré supprimé. **2 bugs attrapés en code-review** : (a) sauvegarde écrite juste avant que la victoire ne soit vue → décrivait un combat déjà terminé, rejeu sans erreur, soft-lock — `resumeBattle` refuse désormais un journal contenant `BattleEnded` ; (b) numéro d'équipe des billboards de reprise déduit de `playerId === Player1 ? 1 : 2` alors que les formats montent à 12 équipes → joueurs 3+ repeints en couleur ennemie, corrigé par `spawnBillboardsFromState` partagé avec le sandbox. Dette plan 180 soldée au passage : les 4 stubs `localStorage` de `packages/app` convergent vers `src/testing/local-storage-stub.ts`. Tests : 8 unit persistance, 5 intégration (dont comparaison de **tout** l'état reconstruit vs live, et refus d'un combat terminé), 1 unit core, 5 e2e, cahier §6.11. Human-testing validé (3 scénarios). Décisions #744–#751.
- 2026-08-14 — **Plan 180 — Comportement plateforme mobile, lots 180-a et 180-b (commit WIP `118cd55`), validés sur téléphone réel.** **180-a** : manifeste PWA (`packages/app/public/manifest.json`) + 3 icônes par agrandissement nearest-neighbor du favicon 28×28 (aucun logo dans le dépôt, décision #738) ; nouveaux modules `packages/app/src/platform/{fullscreen,pwa,wake-lock}.ts` ; bouton/ligne plein écran (état vivant lu sur `document.fullscreenElement`, jamais persisté, décision #740), verrouillage paysage best-effort séquencé (`requestFullscreen()` synchrone puis `orientation.lock()` après résolution, décision #741, invariant couvert par `fullscreen.test.ts`) ; ligne « Installer l'app » (iPhone non installé) ; diagnostic `onContextLostObservable`/`onContextRestoredObservable` dans `combat-scene.ts`. **180-b** : Wake Lock avec ré-acquisition sur `visibilitychange` ; `packages/app/src/app/screen-persistence.ts` (clé `pt-last-screen`, péremption 1h) — reprise silencieuse du menu quitté, écrans à paramètre exclus via un type dérivé `ParamlessScreenId` (décision #742), combat non restaurable = 180-c. **Bug attrapé en revue avant publication** : URLs de manifeste absolues cassaient l'installabilité en silence sur GitHub Pages/itch.io (3 bases de service, `vite.config.ts` ne réécrit pas `public/`) — corrigé en relatif (décision #739, le point le plus important du lot). Limites iOS reconfirmées, rien à changer (décision #743). **180-c (persistance/reprise d'un combat en cours) reste `draft`.** Décisions #738–#743. Dettes non résolues → § Dettes ci-dessus.
- 2026-08-06 — **Plan 179 — Responsive + dette mobile, résout l'item Lot 3 « responsive + dette mobile » (implémentation + review + e2e, commit WIP `8d13d58`).** Second référentiel de design mobile (1280×720 sous `height < 500px` ou `width < 900px`, constantes `MOBILE_DESIGN_REFERENCE_*` de `packages/ui-dom/src/game-stage.ts`) + zoom mobile ×1,5 arbitré sur téléphone réel ; systèmes container-query (`--ip-px`/`--wh-px`/`--tt-size`) réalignés sur le même seuil. Chrome de combat (menu d'actions, indicateur de tour, liste d'attaques, journal, timeline) raccordé à l'échelle ; plancher de cible tactile 30px sous `pointer: coarse` (hit-area seule, WCAG 2.2 SC 2.5.8). Écrans de menu redensifiés (choix de carte, Team Builder, 3 sélecteurs — grille de résultats à 0px de haut corrigée —, sélecteur d'équipe, barre de placement). Overlay d'orientation par obstruction (`OrientationPrompt.ts`, pas un verrouillage, portrait autorisé sur tablette). Clavier virtuel (`interactive-widget=resizes-content`, modales en `dvh`, plus de focus auto en pointeur grossier). `createTypeChip` désormais exporté par `ui-dom` (oubli du plan 178) — Team Builder migré dessus, `.tb-type-badge` supprimé. Icônes d'objet + noms de type FR dans les sélecteurs, tunnel de dev (`PT_TUNNEL=1`). **Validation humaine partielle** : combat/Team Builder/sélecteurs/orientation validés sur téléphone réel ; dialog de victoire et rendu 4K jamais vus (2 points ouverts, § UI/UX en attente). Décisions #733–#737.
- 2026-08-05 — **Plan 176 — « Fog ennemi » (rétention d'information sur les Pokemon adverses), résout l'item Lot 3 « Panneau ennemi + information cachée » (commit WIP `68075f9`).** ⚠️ *Le terme « fog » du titre est un abus de langage, corrigé le 2026-08-19 (décision #762) : il n'y a aucun brouillard de guerre — la carte et les ennemis sont entièrement visibles, seule l'information sur eux est cachée. Vocabulaire de référence : « information cachée ». Le titre du plan et les identifiants du code portent encore l'ancien terme.* L'InfoPanel ennemi masque PV exacts (`%` seul), objet tenu et talent (`???` + icône générique CSS, talent déplacé dans son slot normal) tant qu'ils ne sont pas révélés, ainsi que le chiffre de PV du Substitut. **Révélation à l'usage** : nouveau `packages/core/src/battle/reveal-tracking.ts` (`applyRevealsFromEvents`) — tout event nommant un objet/talent le révèle définitivement, branché sur `submitAction` (devenu wrapper d'un `applyAction` privé) et `consumeStartupEvents`. Dégâts de la preview (plan 175) et de l'overlay flottant en % des PV max sous information cachée ; Ceinture Force/Fermeté non nommées dans le garde-fou « sauf … » sauf si connues. Bug de perspective corrigé au passage (`humanPlayerIds`/`viewerPlayerId()` — le panneau gauche affichait l'ennemi en clair à chaque tour d'IA). Fog **ON en dur** en partie réelle, `SandboxConfig.fogOfWar` (défaut OFF) + case à cocher au studio (masquage OFF = lecture complète). Résout l'item backlog « Masquer l'objet ennemi en multi en ligne » côté partie réelle. Décisions #728–#732.
- 2026-08-03 — **Plan 178 — Tooltip d'attaque enrichi + harmonisation de l'affichage des types, résout l'item Lot 3 « info move ».** Tooltip : tags contrecoup/drain/auto-K.O. (corrige au passage Explo-Brume qui n'annonçait jamais son auto-K.O., tag mort supprimé), coût CT chiffré (nouvelle API core `BattleEngine.previewMoveCtCost`, base seule au tooltip vs total exact + surtaxe Pression séparée à la confirmation), chip de type nommé, probabilité d'effet secondaire (`buildSecondaryEffectChip` extrait du plan 175, partagé). Types : source unique `getTypeName` (`packages/data/src/i18n/type-names.ts`) remplace `TYPE_LABEL` et les 18 clés i18n `pokemonType.*` (doublon). Nouveaux composants partagés `createTypeChip`/`createStatusChip` (ce dernier active enfin les assets `label-<status>.png`, présents depuis le plan 018 mais jamais branchés). Table de types 18×18 et efficacité contextuelle par move abandonnées (décision humaine). Décisions #724–#727. Commits `2e01f19`, `d26dea6` (fix sélecteur de talent sandbox + dérive de type dans un test).
- 2026-07-27 — **Plan 175, suite : contexte de dégâts unifié, K.O. en un coup dans la preview, Fermeté sous information cachée.** Nouveau `packages/core/src/battle/damage-context.ts` (`resolveDamageContext`) = source unique partagée par le vrai coup (`handle-damage.ts`, −126 l.) et la prévision (`estimateDamage`, −76 l.), qui avaient divergé (morph météo de Météore, malus pluie de Lance-Soleil, volatile Chargeur, Coup d'Main, Garde Amie ignorés côté estimation → chiffre affiché et scoring IA faux). `previewMove` gagne `isOhko`/`ohkoImmunity` (Abîme, Guillotine, Empal'Korne, Glaciation annonçaient « survit ») et résout les moves appelés (Métronome/Blabla Dodo/Photocopie décrivaient l'appelant). **Masquage partiel avant le plan 176** : le prédicat de visibilité de `combat-preview-view.ts`, stub `return true`, teste désormais `revealedAbility` (ou cible alliée) — Fermeté n'est plus nommée tant qu'elle n'est pas révélée, ni sur l'immunité K.O.-en-un-coup ni sur le garde-fou « sauf Fermeté ». Ténacité et Ceinture Force restent nommées, immunités de type/Glace restent visibles. Décision #723.
- 2026-07-26 — **Plan 175 — Preview de combat (prévision de dégâts détaillée), résout l'item Lot 3 « preview combat ».** À la confirmation d'une attaque, le panneau du lanceur s'étire (bloc attaque : nom/type, `min–max PV` coloré selon la létalité, précision, critique arrondi %, puces de modificateurs, effet secondaire) et la carte curseur devient la cible focalisée (barre de vie à 3 zones — plein/dégradé/restant —, PV en %, « Sans effet » si immunité, verdict K.O. nuancé « sauf Ceinture Force/Ténacité/Fermeté » si connu du joueur, jamais pour le Bandeau). Cycle multi-cibles au survol ou `Tab`. Gaté par « Prévisualisation dégâts ». **2 changements de règle de jeu** (pas que de l'UI) : (1) `estimateDamage` intègre désormais météo/écrans (Protection/Mur Lumière)/Brise Barrière, auparavant figés à 1.0 — les ~10 heuristiques IA qui en dépendent changent de scoring, effet assumé (décision #721) ; (2) le bonus de type du terrain (×1.15) n'est plus refusé au type natif/immunisé (`getTerrainTypeBonusFactor` ne consulte plus `isTerrainImmune`), seul un attaquant aéroporté en est exclu — vaut pour toute la table Eau/Magma-Lave/Glace/Sable/Marais (décision #722). Nouveaux exports core `computeEffectiveAccuracy`, `effectiveCritChance`, `BattleEngine.previewMove`, `SurvivalGuardKind`, `MovePreview`. Corrections annexes : `initSettings()` manquait au boot (réglage persisté redevenait le défaut au rechargement), `[hidden]` inerte sur `.ip-panel`/`.ti-panel` (règle auteur `display` prioritaire). e2e `combat-preview.spec.ts` + `docs/test-plan.md` §4.14. Commit `dc43def`.
- 2026-07-24 — **Plan 172 — IA : positionnement pour le ring-out (Phase 2 du plan 159), résout l'item « IA — positionnement offensif/défensif pour le ring-out ».** A3 offensif (`evaluateAttacksFromPosition` se déplace exprès pour aligner un ring-out létal) + A4 défensif (`evaluateKnockbackVulnerability` évite une case exposée à un ring-out adverse létal), lethal-only des deux côtés, heuristiques communes à tous les niveaux. `BattleEngine.predictKnockback` gagne `attackerPosition?`. Tests unit A3/A4 verts. Voir `docs/ai-system.md` § Positionnement ring-out (A3/A4).
- 2026-07-24 — **6 OP sets emblématiques Batch B/D Gen 1 ajoutés à `op-sets.json`** (203 → 209 OP sets, 100% `full`, validé `pnpm op-sets:analyze`) : Insécateur Faux-Chage, Persian Ruse, Grolem Anti-Air, Rattatac Poursuite, Mackogneur Corps Perdu (Batch B), Ronflex Attraction (Batch D).
- 2026-07-24 — **Plan 171 — Zone Magique canonique complète (commit WIP `18e6a06`).** Le chokepoint `effectiveHeldItem(state, pokemon, registry)` a désormais une adoption complète : ~16 lectures directes `itemRegistry.getForPokemon(...)` routées + 2 signatures threadées (`tryMentalHerbCure`, `applyTerrainStatus`/`applyTerrainDot`). Zone Magique neutralise canoniquement tous les effets d'objet tenu d'un mon dans la zone (Veste de Combat, Ballon, Lunettes Filtre, Talisman Sain, Grosse Racine, Dé Pipé, Roche Royale/Croc Rasoir, Spray Gorge, Herbe Mentale, verrou Choice, Lancer/Dégommage, bloc terrain…). 2 carve-outs canon documentés (non routés) : manipulation physique de baie ennemie (Calcination, Picore/Piqûre — l'effet est neutralisé, pas la présence physique de la baie) et les helpers stat purs Pierrallégée/Poudre Vite (déjà gérés inline). Résout le reliquat « Zone Magique — couverture d'objets partielle » (post-#714). Décision #715.
**Historique antérieur (plans 093-170, sessions objets/talents mai-juin 2026, Phase 5 migration Babylon, Team Builder, chantiers IA 159-161, content-fill 162-163, purge demi-blocs liquide 169, niveaux de test e2e 170)** : voir `git log`, `docs/decisions.md`, `docs/plans/`, `docs/implementations.md` pour le détail complet.

## Contexte prochaine session

**2026-09-03 — Lot C (écran de victoire enrichi) livré et validé ; suite naturelle = Lot B
(multijoueur P2P 1v1).** Plan 197 `done` (portraits de l'équipe du vainqueur + « N tours · M min »,
décisions #890-892). Le plan-cadre 195 reste `in-progress` : seul le **Lot B** — transport+lobby
(B1) / combat en réseau (B2) / robustesse : chronomètre + reconnexion (B3) / détection de désync
(B4) — n'est pas commencé ; voir `docs/plans/195-phase7-multijoueur-telemetrie.md` § Lot B pour le
découpage et les deux correctifs déjà notés par l'audit (identifiant de carte stable, IA non
rejouable telle quelle sur les deux pairs). **La comparaison télémétrie ↔ tableau de bord itch.io
n'a pas bougé** — toujours en attente de quelques jours pleins de trafic postérieurs au
redéploiement des correctifs `#888`/`#889` (§ « Dans quelques jours » ci-dessus), c'est l'item qui
reste réellement ouvert côté Lot A.

**2026-09-02 — Phase 7 démarrée, Lot A télémétrie en cours (étapes 1-2/9 livrées), depuis clos le
2026-09-02 puis complété le 2026-09-03.** Plans 195 et 196 passés `in-progress` (196 `done`).
Compte Cloudflare et base D1 `pokemon-tactics-events` créés (étape 0). Spike `sendBeacon` validé
sur itch.io et GitHub Pages, diagnostic du plan 114 réfuté (étape 1). Paquet
`packages/telemetry-worker/` livré, Goatcounter retiré. Décisions #880 (`battle_id` retenu) et
#881 (`sendBeacon` + garde-fou `Origin`) inscrites. La Phase 6 (éditeur voxel) et la Phase 8
(équilibrage, avec son prérequis `loadMapDefinition` Node-compatible) restent des options entières,
non dépriorisées par ce démarrage.

**2026-08-26 — Plan 188 TERMINÉ.** Recette humaine 5/5 validée (clavier + manette Switch Pro
filaire), code-review traitée (helper de focus partagé, boutons du panneau d'édition, résilience du
poller manette — voir décisions #837, #838, #842). Décisions #830–#842 inscrites dans
`docs/decisions.md`, plan passé `done`, cahier `docs/test-plan.md` §6.4/§6.13 à jour. Reste
uniquement : `/ci-gate` et le commit définitif (amende le WIP) — voir menu post-impl. Point reporté
en § Reporté : la validation matérielle des correctifs de code-review n'a pas été rejouée sur pad réel
(seulement la manette synthétique e2e depuis).

**Ressources machine — garde-fou (2026-08-25)** : l'humain travaille et joue sur la machine
pendant les runs. `scripts/with-cpu-cap.sh` plafonne l'e2e (4 cœurs sur 16, 8 Go, priorité basse) et
`playwright.config.ts` descend à 3 workers ; `PT_FULL_SPEED=1` débride. **Toujours
`pnpm test:e2e:affected`**, jamais `pnpm test:e2e` en cours de chantier. Règle dure dans
`.claude/rules/e2e.md` § Ressources machine.

---

**2026-07-18 — Content-fill Gen 1 clos.** Phase 4 « mécaniques complexes », le chantier IA (159→160→161) et les 2 sessions content-fill (162 moves, 163 talents) sont tous terminés. Roster + pool Gen 1 complets : 512 moves, 114/114 talents, 117/117 objets, 151/151 Pokemon jouables, 203 OP sets. **Prochaine session : choisir entre Phase 6 (Maps & Éditeur 3D), Phase 7 (Multijoueur), Phase 8 (Équilibrage), ou une session polish/dette technique** (§ Reporté / backlog technique ci-dessus). Aucune direction n'est imposée — trancher avec l'humain au démarrage de la session.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. Consulter si besoin de comprendre ce qui a été tenté en 2D iso avant le pivot Babylon.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. Item principal en premier.
- **Reporté** : `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : `- YYYY-MM-DD — ce qui a été fait`. Cap ~12-15, vire les plus anciens (historique complet = git log + docs/plans/).
- Mettre à jour fin de plan, fin d'étape significative, ou quand agent reporté.
- Item "À faire" → "Fait" : déplacer.
- Item "Reporté" impertinent : supprimer avec ligne dans "Fait".
