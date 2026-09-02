# Plan 196 — Télémétrie de jeu (Cloudflare Workers + D1)

> **Statut** : in-progress
> **Créé** : 2026-08-31
> **Démarré** : 2026-09-02
> **Lot A de la Phase 7** — plan-cadre : `docs/plans/195-phase7-multijoueur-telemetrie.md`
> **Décisions** : `#867` (Cloudflare plutôt que Goatcounter), `#868` (deux événements par partie, brut + agrégation à la lecture, RGPD par construction), `#870` (usages, pas de scores), `#215` (ce que Goatcounter offrait clés en main).
> **Tranché le 2026-08-31** : pas de nom de domaine, l'API reste sur `*.workers.dev` · le Worker vit dans `packages/telemetry-worker/`.
> **Tranché le 2026-09-02** : `battle_id` éphémère retenu (`#880`) — plus aucune décision ouverte, le plan est exécutable de bout en bout.

## But

Savoir ce que les joueurs font réellement du jeu : combien de parties, sur quelles cartes, avec quels Pokemon et quelles attaques, et combien de parties sont abandonnées en cours. **Des usages, pas des scores** (#870).

Indépendant du réseau : ça marche sur le jeu tel qu'il existe aujourd'hui, c'est-à-dire 100 % solo et hot-seat.

## État des lieux — ce que le dépôt mesure vraiment aujourd'hui

`packages/app/src/analytics/analytics.ts` (plan 114) déclare **8 événements**. Cinq sont émis, depuis les écrans DOM : `main-menu`, `battle-mode`, `team-builder`, `map-select`, `team-select`.

⚠️ **Les trois autres ne sont jamais émis, et personne ne s'en était aperçu.** `game-loaded`, `battle-start` et `battle-end` sont déclarés, la fonction `trackGameLoadedOnce()` est exportée, **et rien ne les appelle**. Leurs appels vivaient dans `LoadingScene.ts`, `BattleScene.ts` et `GameController.ts` — scènes Phaser **supprimées** par le refactor `e0c1a221` du 2026-06-15 (« extract engine-agnostic renderer packages »). Le fichier analytics a été déplacé intact, ses appelants ont disparu avec les scènes.

Conséquence : **depuis le 2026-06-15, aucun combat n'est mesuré.** Le funnel s'arrête à l'écran de sélection d'équipe. Ce plan n'est donc pas un changement d'endpoint, c'est un recâblage.

**Ce qui est bon dans le fichier actuel et doit survivre** :
- le **préfixe de plateforme** (`itch` / `ghp`), qui permet de lire les stats séparées ou combinées ;
- le **no-op en local** — `platformPrefix()` rend `null` sur `localhost`, donc ni le dev ni les 519 tests e2e ne polluent les données ;
- la règle **« la télémétrie ne casse jamais le jeu »** : envoi enveloppé dans un `try/catch` muet.

## Ce qu'on mesure

**Modèle retenu : des *usage stats* à la Showdown / Smogon** (exigence humaine, 2026-08-31). La question à laquelle la base doit répondre est : « quelle part des équipes emmène Dracaufeu, en solo, en multi, plus tard en histoire — et avec quel objet, quel talent, quelles attaques ». C'est de la matière d'équilibrage directe pour la Phase 8.

**Trois événements**, tous groupés : un par visite pour l'interface, deux par partie pour le jeu (#868). Jamais un par clic ni un par attaque — une partie à 12 équipes générerait des centaines d'actions, une visite une trentaine d'interactions.

### `session` — l'usage de l'interface

**Exigence humaine (2026-08-31)** : savoir combien de gens ouvrent les crédits, font un import ou un export Showdown, et plus généralement **quels boutons de menu servent**.

⚠️ **Pas une requête par clic.** Une visite fait facilement trente interactions ; à deux lignes par écriture (§ Quota réel), ce serait ~60 lignes par visite et le quota tomberait vers ~1 600 visites par jour. Le remède est celui qui marche déjà pour les parties : **accumuler des compteurs en mémoire et envoyer un résumé**.

- **Un compteur par action**, incrémenté en mémoire, jamais envoyé à l'unité.
- **Envoi par `sendBeacon` sur `visibilitychange → hidden`** — le cas d'usage canonique de cette API, qui survit à la fermeture de l'onglet. Plus fiable que `pagehide`, notoirement capricieux sur iOS.
- **Envoyer des *deltas*, pas un cumul** : ce qui n'a pas encore été transmis. Plusieurs bascules d'onglet produisent alors des lignes qui **s'additionnent à la lecture**, sans identifiant de session ni déduplication. Ne rien envoyer quand tous les compteurs sont à zéro.
- 🔴 **Marquer la première ligne de la visite d'un `first: true`.** Sans ce drapeau, **compter les visites deviendrait impossible** : les deltas font qu'une visite produit une à plusieurs lignes, donc compter les lignes `session` surestimerait la fréquentation. Le nombre de visites, c'est le nombre de lignes portant `first`. Le drapeau vit en mémoire et repart à zéro à chaque chargement de page — ce n'est pas un identifiant, il ne suit personne.
- La même ligne porte le contexte de la visite : plateforme, `buildVersion`, **langue de l'interface**, **source d'entrée active** (souris / clavier / manette / tactile).

```jsonc
{ "kind": "session", "platform": "itch", "lang": "fr", "input": "gamepad",
  "ui": { "credits": 1, "showdown-import-ok": 2, "showdown-import-fail": 1,
          "team-save": 3, "remap-key": 4 } }
```

**Actions à instrumenter** — toutes vérifiées dans le code, pas une liste d'intentions :

| Action | Ce qu'elle apprend | Point d'accroche |
|--------|--------------------|------------------|
| Crédits ouverts | Est-ce que quelqu'un lit les attributions ? | `credits-screen.ts` |
| Écran des contrôles ouvert | La légende du plan 185 suffit-elle, ou on va chercher la liste ? | `controls-screen.ts` |
| **Showdown : modale ouverte, import réussi, import échoué, export** | Le format d'échange sert-il ? **Et les imports échouent-ils ?** Un collage qui ne parse pas est un bug produit invisible aujourd'hui | `openShowdownIoModal({ mode })`, `importShowdownTeam`, `exportTeamToShowdown` |
| Équipe créée / sauvegardée / supprimée | Le Team Builder est-il utilisé, ou joue-t-on avec les équipes par défaut ? | `MyTeamsView`, `TeamEditView` |
| Changement de langue, plein écran | Réglages réellement touchés | `settings-panel.ts` |
| Menu de combat : ouvert, Recommencer, Abandonner, Quitter | Ce que le plan 187 a livré sert-il, et par quelle sortie part-on ? | `combat-menu` |
| Reprise de combat proposée / acceptée / refusée | La reprise du plan 181 est-elle voulue ? | `battle-resume.ts` |
| Une touche réassignée | L'écran de remapping du plan 186 sert-il ? | `controls-panel.ts` |

**Coût** : une à quelques lignes par visite, contre une par clic. Et cet événement **remplace** le `session_started` qui était en décision ouverte : il porte la fréquentation *et* les compteurs, donc pas de régression sur le funnel de Goatcounter (#215) — il fait mieux.

### Parité avec Goatcounter — visiteurs uniques et données d'audience

**Exigence humaine (2026-08-31)** : ne rien perdre par rapport à Goatcounter — visiteurs uniques, navigateurs, systèmes, pays, langues, tailles d'écran, référents — « en respectant le RGPD **comme Goatcounter le fait** ».

C'est faisable, et **presque entièrement côté Worker** : le client n'envoie rien de plus, ces informations sont déjà dans la requête HTTP.

| Donnée | Comment | Ce qui est stocké |
|--------|---------|-------------------|
| **Visiteurs uniques** | `HMAC(secret ⊕ date du jour, adresse IP + agent utilisateur)` calculé dans le Worker | **Le seul haché.** Jamais l'IP, jamais l'agent brut |
| **Navigateur / système** | Agent utilisateur analysé dans le Worker | Des catégories : `Firefox 121`, `Windows` — pas la chaîne brute |
| **Pays** | `request.cf.country`, **fourni par Cloudflare** | Le code pays. Ni base GeoIP à embarquer, ni IP à lire pour ça — **plus propre que Goatcounter** |
| **Langue** | En-tête `Accept-Language` | La langue principale |
| **Taille d'écran** | Envoyée par le client, **en paliers** (`≥1920`, `1280-1919`, `<768`…) | Le palier, jamais la valeur exacte |
| **Référent** | `document.referrer` côté client + en-tête `Referer` | L'URL de provenance |

**Le sel tourne chaque jour.** Le hachage est `HMAC(secret, "AAAA-MM-JJ")` appliqué à `IP + agent utilisateur`, le secret vivant en variable d'environnement du Worker. Deux propriétés en découlent, et ce sont exactement celles de Goatcounter :
- l'IP n'est **jamais écrite** — elle sert d'entrée au calcul, en mémoire, puis disparaît ;
- le lendemain, le même visiteur produit un **hachage différent**, donc **aucun suivi d'un jour à l'autre** n'est possible, même pour nous.

Corollaire à connaître : on comptera les uniques **par jour**, pas « les uniques sur 30 jours ». Goatcounter a exactement la même limite, pour la même raison.

⚠️ **Les référents : une limite réelle, et ta capture le montre.** Dans l'iframe itch.io, `document.referrer` vaut `html-classic.itch.zone` — le vrai référent externe (Google, Reddit, une page de tags itch) appartient à la **page parente**, cross-origin, donc inaccessible depuis l'iframe. Ce n'est pas un défaut de notre implémentation : c'est pour cette raison que Goatcounter ne les voyait pas non plus, et que le tableau des référents d'itch.io existe — itch les voit **côté serveur**, sur sa propre page.
- Sur **GitHub Pages**, le jeu n'est pas en iframe : on captera les vrais référents externes.
- Sur **itch.io**, non. Le tableau du dashboard itch reste la source pour ça, et on ne cherche pas à le remplacer.

**Décision humaine (2026-08-31) : on capture quand même** — les référents des joueurs venus par GitHub Pages ont de la valeur en eux-mêmes, et rien ne garantit qu'itch.io reste l'hôte principal du jeu. Le champ est donc là dès la V1, simplement vide sous iframe.

**Révision d'une limite posée plus haut** : « rien qui décrive l'appareil » devient « rien de **brut** qui décrive l'appareil ». Une catégorie (`Firefox 121`) et un palier (`≥1920`) ne réidentifient personne ; la chaîne d'agent utilisateur complète et une résolution exacte au pixel, si. C'est la ligne que tient Goatcounter, et c'est celle qu'on tient.

### `battle_started` — les paramètres de partie, et la composition des seules équipes choisies

⚠️ **La composition voyage au démarrage, pas à la fin.** Contre-intuitif mais décisif : chez Showdown, l'usage d'un Pokemon est sa **présence dans une équipe**, pas le fait qu'il ait agi. Si la composition partait dans `battle_ended`, **toutes les parties abandonnées disparaîtraient des statistiques d'usage** — et l'abandon est justement une population qu'on veut mesurer.

🔴 **On n'envoie la composition que des équipes réellement choisies par un humain** (décision humaine, 2026-08-31). La décision **#330** donne à l'IA une **équipe aléatoire éphémère** par défaut (`docs/game-design.md:59`), et un humain peut lui aussi prendre l'option « 🎲 Aléatoire » au moment de choisir. Or tant que le multijoueur n'a pas de joueurs, la majorité du trafic sera en solo contre l'IA : envoyer ces compositions injecterait des Pokemon **tirés au hasard** dans le même pot que les vrais choix, diluant le signal exactement dans la proportion où le solo domine.

**Le remède est dans la collecte, pas dans la requête** : on ne capture pas ce qu'il faudrait ensuite se souvenir d'exclure. Une équipe non choisie n'a **pas** de composition dans le payload — juste sa provenance. Aucun filtre à oublier au moment de lire, et un payload plus léger.

- **Paramètres de la partie** : mode (`local-vs-ai`, `local-hotseat`, `online`, `story` plus tard), identifiant stable de carte (`MAPS_REGISTRY`), format, **nombre d'humains et d'IA**, **placement automatique ou manuel** (`autoPlacement`, exposé au joueur sous « Placement auto »).
- **Par équipe** : sa **provenance**, et sa composition **seulement si elle a été construite par un humain**.

```jsonc
{ "mode": "local-vs-ai", "map": "simple-arena", "format": "2x6",
  "humans": 1, "ai": 1, "autoPlacement": true,
  "teams": [
    { "side": 0, "source": "human-built", "generated": false, "mons": [
        { "species": "charizard", "ability": "blaze", "item": "choice-band",
          "nature": "adamant", "moves": ["flamethrower", "earthquake", "slash", "fly"] }
    ] },
    { "side": 1, "source": "ai-random" }
  ] }
```

**Provenances** : `human-built` (la seule qui porte une composition) · `human-random` (le joueur a pris « 🎲 Aléatoire ») · `ai-random` (le défaut de #330) · `ai-built` (une équipe sauvegardée confiée à l'IA).

**Nuance sur `generated`** : le Team Builder sait **générer** une équipe aléatoire, qui est ensuite **sauvegardée** sous son préfixe de nom. La resélectionner est un choix — le joueur l'a gardée, peut-être retouchée — donc sa composition compte, mais le drapeau `generated` permet de l'écarter à la lecture si on veut ne garder que les équipes bâties à la main.

**Ce qu'on perd, et qu'on assume** : les statistiques d'usage des équipes de l'IA, dont on n'a que faire — elles ne renseignent que le générateur aléatoire. Le taux de victoire humain contre IA reste mesurable, puisque l'issue et le décompte humains/IA sont là.

### `battle_ended` — ce qui s'est passé

- Issue (camp vainqueur, ou match nul), durée, nombre de tours.
- **Par Pokemon des équipes `human-built` uniquement** — celles dont on a la composition : les attaques **réellement lancées** avec leur compte, plus **le tour de son K.O. et sa cause** (dégâts, chute, terrain létal — `null` s'il a survécu). Rien pour les équipes aléatoires : sans leur composition, le détail ne se rattache à rien.

> **Pourquoi le K.O. porté par chaque Pokemon plutôt qu'en total de partie** : un seul champ répond alors à trois questions — qui tombe en premier, combien de temps chacun survit, et surtout **il désambiguïse le signal des attaques mortes**. Une attaque jamais lancée par un Pokemon tombé au tour 1 n'est pas un verdict sur l'attaque, c'est un verdict sur la survie de son porteur. Sans ce champ, les deux cas sont indiscernables. Ça reste un instantané de l'état final, donc conforme à la limite qu'on s'est fixée (§ Élargir).

**Le taux d'abandon sort de l'écart entre les deux, gratuitement** : une partie quittée en cours n'émet pas de `battle_ended`. Aucun événement d'abandon à envoyer — l'absence est le signal.

### Ce que ces trois événements permettent de sortir

| Statistique | Comment |
|-------------|---------|
| **% d'usage par Pokemon, par mode et par format** | Le tableau Showdown, exactement : présence dans les équipes de `battle_started` |
| **Pour un Pokemon : distribution des objets, talents, natures, movesets** | Le second tableau Showdown, sans champ de plus |
| **Attaques emportées ≠ attaques réellement lancées** | **Meilleur que Showdown**, qui ne connaît que le moveset déclaré. Révèle les attaques mortes : emportées par tout le monde, jamais utilisées |
| **Taux de présence dans le camp vainqueur** | Croisement du camp de chaque Pokemon avec l'issue. Distingue la **popularité** (polluée par la réputation hors-jeu : on prend Dracaufeu parce que c'est Dracaufeu) de la **force réelle** |
| **Objet ou Pokemon ?** | Sans le lien Pokemon↔objet, « Kangourex est cassé » et « **Bandeau Choix** est cassé sur tout attaquant physique » donnent le même signal — deux nerfs opposés |
| **Pokemon jamais choisis** | Rien à envoyer : soustraction du roster connu (`packages/data`) aux espèces observées |
| **Avantage du premier joueur** | Index de camp croisé à l'issue. Vérifie si l'**alternance serpent** du placement fait son travail |
| **Coéquipiers fréquents** (les « teammates » de Smogon) | Gratuit : la co-occurrence Pokemon×Pokemon se calcule à la lecture depuis `teams[].mons[]`. Vide par construction aux formats à 1 Pokemon par camp |
| **Qui tombe en premier, durée de survie** | Le tour de K.O. porté par chaque Pokemon |
| **Cartes délaissées, durée par format** | Croisement des deux événements de partie, **via le `battle_id` éphémère** (§ Décisions à trancher) |

### Le filtre est dans la collecte, pas dans la requête

Le point ci-dessus (§ `battle_started`) mérite d'être répété parce qu'il est facile à défaire par inadvertance : **une équipe non choisie par un humain n'a pas de composition en base.** Il n'y a donc aucun `WHERE human = true` à ne pas oublier, aucune sous-commande de `pnpm stats` qui pourrait fausser ses chiffres en omettant un filtre, et aucun risque qu'une requête ad hoc écrite dans six mois reparte sur des données polluées.

C'est le principe général à tenir pour toute évolution du payload : **ne pas capturer ce qu'il faudrait se souvenir d'exclure.**

### Trois pièges d'interprétation, à connaître avant de nerfer quoi que ce soit

1. **Segmenter par mode et par format, y compris pour la comparaison emporté / lancé.** Une attaque de zone est quasi morte en 1v1 — une seule cible possible — et excellente à 12 joueurs. Un agrégat tous formats confondus mélange des contextes où la même attaque n'a pas la même valeur.
2. **Petit échantillon.** « 0 lancement sur 3 parties » sur une espèce peu choisie ressemble à une attaque morte mais n'est que du bruit. Exiger un volume minimal avant de conclure.
3. 🔴 **Les attaques de dissuasion sont structurellement sous-évaluées, et aucun champ ne le répare.** **Abri** ou **Vampigraine** existent pour modifier le comportement adverse **par la menace** : un Vampigraine qui fait fuir l'ennemi a fait son travail en étant lancé une fois. C'est une limite inhérente à toute télémétrie d'usage — la connaître évite de nerfer une attaque de contrôle qui fonctionne très bien autrement que par la répétition.

**Volume** : le format borne le nombre de Pokemon (12 équipes × 1, ou 2 × 6 — jamais 72), donc quelques kilo-octets par ligne, très loin de la limite de **64 Kio** d'un envoi par beacon. Et le quota se compte en **lignes**, pas en octets.

**Écarté pour la V1** : le taux de raté par attaque (précision effective observée) — signal secondaire, un champ par attaque utilisée ; à revisiter si une attaque à faible précision reste ambiguë après un premier passage de données. Et **toute granularité coup par coup** : c'est le travail du simulateur IA contre IA de la Phase 8, pas celui de la télémétrie de production.

## Élargir ce qu'on mesure — c'est presque gratuit

**Le quota serré du plan gratuit se compte en lignes écrites par jour, pas en octets** (le stockage D1 est de 5 Go, et un envoi par beacon plafonne à 64 Kio). Ajouter des champs au payload d'une ligne existante ne coûte donc **rien** en quota, et **rien** en migration puisque le Worker stocke le JSON sans le comprendre (§ Architecture). La contrainte à tenir est « **une requête par partie** », pas « peu de données par requête » — voir § Quota réel pour le calcul exact.

Deux limites, en revanche :
- **Rien qui décrive l'appareil.** Résolution, `User-Agent`, fuseau horaire, polices, mémoire : interdits. Plus on empile d'attributs de configuration, plus la combinaison devient discriminante — et une empreinte reste une empreinte même sans identifiant à côté. La ligne est nette : on mesure **ce que le joueur fait**, jamais **avec quoi il le fait**.
- **Rien qui ne se dérive pas de la composition d'équipe ou de l'état de fin de partie.** Instrumenter le moteur coup par coup pour nourrir la télémétrie serait un couplage qu'on refuse ; tout ce qui précède se lit dans la sélection d'équipe, dans l'état final, ou dans le journal déjà construit.

### Retour sur investissement des chantiers livrés

La Phase 6.5 a coûté douze plans et on ne sait pas si ce qu'elle a livré est utilisé. Ces champs voyagent dans l'événement `session` (§ Ce qu'on mesure) et répondent à des questions qu'on se pose déjà :

| Champ | Question à laquelle il répond | Verdict |
|-------|-------------------------------|---------|
| **Source d'entrée active** en fin de partie (souris / clavier / manette / tactile) | Quelqu'un joue-t-il vraiment à la manette ? au doigt ? Les plans 183-186 ont-ils servi ? | **Oui** — la donnée existe déjà (`data-input-source`), c'est un usage, pas un attribut d'appareil |
| **Langue de l'interface** | Les 234 clés migrées au plan 190 servent-elles à quelqu'un ? | **Oui** — préférence exprimée par le joueur, pas propriété de sa machine |
| **Remapping utilisé** (booléen) | L'écran de remapping du plan 186 sert-il, ou les bindings par défaut suffisent-ils ? | **Oui**, un booléen suffit — pas la liste des touches |
| **Partie issue d'une reprise** (booléen) | La reprise de combat du plan 181 est-elle utilisée ? | **Oui** — et à ne pas confondre avec le fait de ne pas réémettre `battle_started` à la reprise (étape 3) |
| **Cran de zoom final** | Les trois crans du plan 166 correspondent-ils à l'usage ? | **À évaluer** — faible valeur, mesure un instant plutôt qu'un usage |
| **Résolution, plein écran, orientation** | — | **Non** — attributs d'appareil, voir la limite ci-dessus |

## Quota réel — le calcul du 2026-08-29 était deux fois trop optimiste

Vérifié le 2026-08-31. La doc D1 est explicite : une écriture sur une table indexée compte **deux lignes** — celle de la table, celle de l'index — dès lors que les colonnes indexées sont renseignées, ce qui est notre cas à chaque insertion.

| | Écritures par partie | Plafond réel |
|---|---|---|
| Calcul du 2026-08-29 (`multiplayer.md`) | 2 | ~50 000 parties/jour |
| **Réel, avec l'index `(kind, received_at)`** | **4** | **~25 000 parties/jour** |

**Sans conséquence pratique** à notre échelle, mais le chiffre affiché était faux : `docs/multiplayer.md` est corrigé. Deux suites :
- **`AUTOINCREMENT` retiré du schéma.** Il entretient une table interne `sqlite_sequence` à chaque insertion — donc probablement une écriture de plus au compteur — et la doc SQLite dit elle-même qu'il n'est « généralement pas nécessaire ». Aucun besoin fonctionnel ici de garantir qu'un identifiant ne soit jamais réutilisé.
- **L'index est gardé.** Il coûte une écriture, mais c'est lui qui rend l'agrégation à la lecture (§ Étape 8) supportable. Compromis assumé.

**Et un non-problème confirmé** : la limite de **10 ms de CPU** par invocation ne menace pas l'insertion. L'attente d'une requête D1 est de l'I/O, explicitement **hors du budget CPU** — seule la validation JSON compte, soit quelques microsecondes. `.batch()` est inutile ici : il réduit la latence, pas le nombre de lignes facturées, et on n'écrit qu'une ligne par appel.

## Est-ce que tout cela tient dans le plan gratuit ?

Oui, avec trois ordres de grandeur de marge. Les quotas gratuits vérifiés le 2026-08-31 : Workers **100 000 requêtes/jour**, D1 **100 000 lignes écrites/jour**, **5 M lignes lues/jour**, **5 Go** de stockage (500 Mo par base).

Consommation d'un joueur qui vient et joue une partie : ~2 envois `session` + `battle_started` + `battle_ended` = **4 requêtes**, et **8 lignes écrites** (chaque insertion en coûte deux, § Quota réel).

| Ressource | Plafond | Ce qu'il autorise | Marge |
|-----------|---------|-------------------|-------|
| Lignes écrites D1 | 100 000/j | **~12 500 visites-avec-partie/jour** | **Le facteur limitant** |
| Requêtes Workers | 100 000/j | ~25 000/jour | Confortable |
| Lignes lues D1 | 5 M/j | Les requêtes de `pnpm stats` | Hors de portée |
| CPU Workers | 10 ms/invocation | L'attente D1 est de l'I/O, **hors budget CPU** | Non-problème confirmé |

Le jeu fait aujourd'hui de l'ordre de **quelques dizaines de visites par jour**. On est à ~1/300 du plafond : le quota d'écriture n'est pas un sujet, et le binding `ratelimit` (§ Étape 2) est là pour le seul scénario qui pourrait le brûler — un script qui martèle l'endpoint.

⚠️ **Le vrai point de vigilance est le stockage, pas le débit.** La composition d'équipe fait de `battle_started` la ligne la plus lourde (quelques kilo-octets). À 100 parties par jour et 8 Ko par partie, la base prend ~290 Mo par an — donc la limite de **500 Mo par base** se rapproche en un peu plus d'un an. À notre trafic réel, c'est plutôt une quinzaine d'années. **Mais il faut une politique de rétention avant d'en avoir besoin** :
- **agréger puis purger** l'événement brut au-delà de quelques mois : les usage stats mensuelles tiennent dans quelques lignes par mois, alors que le brut qui les a produites pèse des dizaines de mégaoctets ;
- surveiller la taille au moment d'écrire les requêtes de l'étape 8, pas plus tôt — mais ne pas découvrir le mur.

## Architecture

```
Jeu (packages/app)                Worker (packages/telemetry-worker)      D1
  telemetry.ts                      POST /e                             table events
  sendBeacon(JSON)  ───────────►    valide grossièrement      ───────►  1 ligne = 1 événement brut
                                    (kind, taille, Origin)              JSON dans une colonne TEXT
```

**Le Worker ne comprend pas le contenu qu'il stocke.** C'est ce qui rend l'« agrégation à la lecture » (#868) confortable : ajouter un champ au payload ne demande **aucune migration** et **aucun redéploiement du Worker**. Corollaire assumé : **pas de paquet de types partagé** entre le jeu et le Worker — la forme du payload vit côté jeu, le Worker ne valide que `kind` et la taille.

## Étapes

> **L'ordre compte, et il n'est pas celui qu'on croit.** Deux étapes sont placées à contre-intuition volontairement : le **spike itch.io** vient avant toute écriture de code, parce qu'il décide de la **forme de l'envoi** ; le **retrait de Goatcounter** vient après la validation en production, pour ne jamais se retrouver sans aucune mesure si la nouvelle chaîne échoue.

### Étape 0 — Compte Cloudflare — ✅ FAIT le 2026-09-02
- [x] Créer le compte (2026-09-02). `account_id` **à relever** (il est dans l'URL du dashboard).
- [x] Base D1 `pokemon-tactics-events` créée le 2026-09-02 (région WEUR) — `database_id` `f0a2fca1-e016-4537-82c3-2f6cb8d53eca`.
- [ ] Jeton d'API limité au déploiement de Workers — **reporté à l'étape 5** (le workflow GitHub). Le déploiement manuel du 2026-09-02 est passé par `wrangler login` (OAuth, jeton dans `~/.config/.wrangler/`, hors du dépôt).

### Étape 1 — Spike : prouver que le beacon franchit l'iframe itch.io — ✅ FAIT le 2026-09-02

Le plan 114 avait constaté que l'iframe `html-classic.itch.zone` **bloque le `<script>` Goatcounter** — c'est toute la raison du beacon `Image` actuel. Le comportement d'un `sendBeacon` POST vers `*.workers.dev` depuis cette iframe est **non vérifié**, et il détermine la forme de l'envoi. Le découvrir à la fin coûterait de réécrire le client et l'endpoint.

- [x] ~~Déployer un Worker **minimal**~~ **inutile** : la mesure a été obtenue sans déployer quoi que ce soit — l'absence totale de CSP se lit dans les en-têtes, et l'`Origin` réel a été relevé par un POST vers un service d'écho. Le Worker minimal aurait répondu à la même question pour le prix d'un déploiement. Il répond `204` à `POST /e` à `POST /e` et à `GET /e`, sans base, sans validation, et qui **journalise l'en-tête `Origin` reçu**.
- [x] **Relever l'origine réelle** du document qui exécute le jeu dans l'iframe : c'est `html-classic.itch.zone` (ou une variante si le lecteur itch a changé), **pas** `kekel87.itch.io`. C'est cette valeur exacte qu'il faudra autoriser à l'étape 2 — à observer, jamais à supposer. Attention aussi au cas `Origin: null`, que produit une iframe sandboxée sans `allow-same-origin`.
- [x] **Pronostic confirmé.** : bloquer un `<script src>` tiers relève de `script-src`, directive **indépendante** de `connect-src`, qui régit `fetch`/`sendBeacon`. Rien ne dit que le blocage de Goatcounter en 2026-06 présage un blocage du beacon. Des jeux itch appellent couramment des API externes. Ça reste à prouver, pas à parier.
- [x] Depuis le jeu **déjà en ligne** (aucun code à changer) : ouvrir la console du navigateur sur la page itch.io, puis sur GitHub Pages, et tenter les deux formes — `navigator.sendBeacon(url, body)` et un beacon `Image` en GET.
- [x] Conclusion à écrire dans ce plan avant de continuer : **quelle forme passe sur les deux plateformes**. Si le POST passe partout, on le garde (il survit à la fermeture d'onglet et évite le préflight). Sinon, repli GET `Image` sur notre propre endpoint — la forme qui a déjà fait ses preuves dans ce sandbox précis.
- [x] ⚠️ **Sans objet — le repli GET n'est pas retenu.** (consigne d'origine conservée) **Si le repli GET est retenu, le garde-fou `Origin` de l'étape 2 tombe** : une sous-ressource passive (`<img src>`) **n'envoie pas** cet en-tête, contrairement à `fetch` et `sendBeacon`. Un Worker qui rejette toute requête sans `Origin` tuerait son propre repli. À trancher **ici**, pas après : valider ce chemin par le `Referer` et la taille, en acceptant un contrôle plus faible sur un GET.

**Conclusion du spike — à remplir ici avant d'ouvrir l'étape 2** (ce plan est le compte rendu, pas seulement la consigne) :

```
Forme retenue          : [x] POST sendBeacon   [ ] GET beacon Image
Origin observé itch    : https://html-classic.itch.zone   (jamais null — voir ci-dessous)
Origin observé Pages   : https://kekel87.github.io
Validation de l'étape 2: [x] par Origin (POST)  [ ] par Referer + taille (repli GET)
Date, testé par        : 2026-09-02, Claude via Firefox marionette (MCP firefox-devtools)
```

**Le POST passe sur les deux plateformes, et le garde-fou `Origin` est donc conservé.** Mesures :

| Ce qui a été mesuré | itch.io | GitHub Pages |
|---|---|---|
| `location.origin` | `https://html-classic.itch.zone` | `https://kekel87.github.io` |
| `Origin` **vu par le serveur** sur un POST | `https://html-classic.itch.zone` | `https://kekel87.github.io` |
| `Content-Type` réellement envoyé | `text/plain;charset=UTF-8` | `text/plain;charset=UTF-8` |
| Statut de la réponse | `200` | `200` |
| `navigator.sendBeacon(...)` rend | `true` | `true` |

Le `Content-Type` confirme sur mesure ce que l'étape 3 exige : un corps passé en **chaîne** part en `text/plain`, la requête reste **CORS « simple »** et **aucun préflight `OPTIONS`** n'est déclenché.

**🔴 Le diagnostic du plan 114 est réfuté — et c'est le vrai résultat de ce spike.** « L'iframe itch bloque le `<script>` Goatcounter » était faux sur ses deux termes :

- **L'iframe n'est pas sandboxée.** Attribut relevé sur `kekel87.itch.io/pokemon-tactics` après « Run game » : `sandbox` vaut **`null`** — l'attribut est absent. Le `allow` est au contraire très large (`autoplay; fullscreen *; ... gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share`). Corollaire : **le cas `Origin: null` que ce plan redoutait ne peut pas se produire** — il vient d'une iframe sandboxée sans `allow-same-origin`, ce que celle-ci n'est pas.
- **Le document du jeu ne porte aucune CSP.** `https://html-classic.itch.zone/html/<id>/index.html` répond `200 · text/html · server: cloudflare` **sans** `Content-Security-Policy`, sans `X-Frame-Options`, sans `Permissions-Policy`, sans `Referrer-Policy`, et le HTML servi ne contient **aucune** balise `<meta http-equiv>`. Ni `script-src` ni `connect-src` n'existent : **rien, au niveau de la plateforme, ne peut bloquer un envoi réseau**. Le `gc.zgo.at` de Goatcounter est d'ailleurs bien présent dans le HTML servi.

Ce que Goatcounter subissait relevait donc du **navigateur du visiteur** (bloqueur de publicité et de traqueurs), pas d'itch.io — exactement l'argument de la décision `#867`, désormais mesuré et non plus supposé. Et c'est ce qui justifie a posteriori le chemin neutre **`/e`** de l'étape 2 : le seul adversaire réel est une liste de filtrage côté client, que le nom d'URL vise.

**Deux limites de ce spike, à connaître avant de s'y fier :**

1. **Le test a tourné dans un onglet ouvert directement sur l'origine du document du jeu** (`isFramed: false`), pas depuis l'intérieur de l'iframe itch — la page parente est cross-origin, on ne peut pas y injecter de script. L'inférence « être encadré n'ajoute aucune restriction réseau » repose sur les deux faits mesurés ci-dessus (pas de `sandbox`, pas de CSP), qui sont précisément les deux seuls mécanismes qui pourraient l'ajouter. **Confirmation définitive à l'étape 6**, que ce plan exigeait déjà : une partie réelle jouée sur itch.io.
2. **L'endpoint de test était `httpbingo.org`, pas `*.workers.dev`.** En l'absence totale de CSP, l'hôte de destination n'entre pas dans la décision d'autoriser la requête — mais le Worker réel n'a pas encore été touché par un envoi. Idem : étape 6.

**`document.referrer` valait `""`** dans les deux cas, onglet ouvert directement. Ça ne contredit ni ne confirme la limite de `#879` sur les référents itch (dans l'iframe il vaudra `html-classic.itch.zone`, jamais le vrai référent externe) — à relever à l'étape 6.

✅ **Rien à revoir avant l'étape 2** : le POST est retenu, la liste blanche d'`Origin` s'écrit avec les deux valeurs mesurées, et le repli GET `Image` n'est pas nécessaire.

🔁 **Cette conclusion pilote l'étape 2.** Si le repli GET l'emporte, revenir sur le garde-fou d'`Origin` avant d'écrire le Worker — ce n'est pas un détail d'implémentation, c'est un changement de contrat d'entrée.

### Étape 2 — Paquet `packages/telemetry-worker/` — ✅ FAIT le 2026-09-02
- [ ] `package.json` avec un script `typecheck`, **et pas de script `build`** — `pnpm -r build` ignore les paquets qui n'en déclarent pas, et un Worker ne se « build » pas, il se déploie.
- [ ] `wrangler.toml` :
  ```toml
  name = "pokemon-tactics-telemetry"
  main = "src/index.ts"
  compatibility_date = "2026-08-31"

  [[d1_databases]]
  binding = "DB"                            # ce que le Worker voit : env.DB
  database_name = "pokemon-tactics-events"
  database_id = "<depuis l'étape 0>"       # relevé sur la page de la base D1
  ```
  L'`account_id` se met dans `wrangler.toml` ou dans l'environnement — **jamais le jeton d'API**. **Relevé le 2026-09-02** : `fb522b06e2c2d12bfa3657f32a4fd44a`.
- [ ] `wrangler` et `@cloudflare/workers-types` en dépendances de dev **à la racine** — ⚠️ **corrigé le 2026-09-02, la consigne d'origine (« locale au paquet ») était fausse** : vérification faite, la racine porte **toutes** les dépendances de dev du dépôt (`typescript`, `vitest`, `vite`, `@playwright/test`…) et **aucun paquet** ne déclare de bloc `dependencies`. On suit la convention du dépôt (décision humaine du 2026-09-02).
- [ ] L'isolation des types globaux du Worker ne se fait **pas** par l'emplacement de la dépendance mais par le `tsconfig` du paquet : `"types": ["@cloudflare/workers-types"]`, exactement comme `packages/core/tsconfig.json` déclare `"types": ["node"]`. Aucun débordement sur les 9 autres paquets.
- [ ] Schéma D1 en migration SQL :
  ```sql
  CREATE TABLE events (
    id          INTEGER PRIMARY KEY,          -- PAS d'AUTOINCREMENT : voir § Quota réel
    received_at INTEGER NOT NULL,  -- horloge SERVEUR ; l'horloge client n'est pas fiable
    kind        TEXT    NOT NULL,  -- 'battle_started' | 'battle_ended'
    build       TEXT    NOT NULL,  -- buildVersion, pour ne pas mélanger deux versions du jeu
    platform    TEXT    NOT NULL,  -- 'itch' | 'ghp'
    -- Audience, renseignée par le Worker pour les lignes 'session' (§ Parité Goatcounter)
    visitor     TEXT,              -- HMAC(secret ⊕ date, IP + agent) ; l'IP n'est JAMAIS stockée
    country     TEXT,              -- request.cf.country
    browser     TEXT,              -- catégorie, ex. 'Firefox 121'
    os          TEXT,              -- catégorie, ex. 'Windows'
    lang        TEXT,              -- Accept-Language, langue principale
    payload     TEXT    NOT NULL   -- JSON brut (dont palier d'écran, référent), non interprété
  );
  CREATE INDEX idx_events_kind_time ON events (kind, received_at);
  ```
  **Aucune colonne d'IP, aucun identifiant d'appareil, aucune empreinte.**
- [ ] Endpoint **`/e`** — chemin volontairement neutre : `/track`, `/collect`, `/analytics`, `/count` sont des motifs d'URL que les listes de filtrage visent directement (#867). Méthode selon la conclusion de l'étape 1.
- [ ] Garde-fous : `kind` dans une liste blanche, payload plafonné en octets, toute autre méthode rejetée, et **selon la conclusion de l'étape 1** — vérification de l'`Origin` si le POST est retenu, du `Referer` et de la taille seule si c'est le repli GET (qui n'envoie pas d'`Origin`). Le vrai risque n'est pas la triche (#870) mais **le quota**, qu'un script pourrait brûler.
- [ ] ⚠️ **Limitation de débit : le binding `ratelimit` de Workers, PAS le WAF.** Les Rate Limiting Rules et le WAF gratuits opèrent au niveau **zone**, ce qui exige un domaine personnalisé rattaché à Cloudflare — indisponible sur `*.workers.dev`, l'option qu'on a retenue. Le binding `ratelimit` se déclare dans `wrangler.toml` et fonctionne sans domaine ; fenêtres de 10 ou 60 s seulement, et volontairement approximatif (« eventually consistent »), donc un filet anti-rafale — exactement le besoin ici.
- [ ] ⚠️ **Parser le corps avec `JSON.parse(await request.text())`, jamais `request.json()`.** Le client enverra une requête CORS « simple » (voir étape 3), donc **sans** `Content-Type: application/json` : `request.json()` partirait du mauvais présupposé. Passer par le texte marche quel que soit le type reçu.
- [ ] Renvoyer `Access-Control-Allow-Origin` sur la réponse : sans lui, le repli `fetch` voit sa promesse rejetée côté client (l'écriture a bien eu lieu, mais la console se remplit de bruit).
- [ ] **Audience, côté Worker uniquement** (§ Parité avec Goatcounter) : calculer le haché de visiteur par Web Crypto (`HMAC` du secret combiné à la date du jour, appliqué à `CF-Connecting-IP` + agent utilisateur), lire `request.cf.country`, réduire l'agent utilisateur à des catégories, extraire la langue d'`Accept-Language`. **L'IP ne doit apparaître dans aucune écriture ni aucun journal.** Le secret vit en variable d'environnement, jamais dans le dépôt.
- [ ] Ne renseigner ces colonnes que pour les lignes `session` — les deux événements de partie n'en ont pas besoin.
- [ ] Fonction de validation **pure**, testée en unitaire. `vitest.config.ts` ramasse déjà `packages/*/src/**/*.test.ts` : **aucune config à toucher**, et pas besoin d'un runtime Workers en test.

### Étape 3 — Client de jeu : `telemetry.ts` remplace `analytics.ts` — ✅ FAIT le 2026-09-02
- [ ] Envoi dans la forme retenue à l'étape 1. Si c'est `sendBeacon` : repli `fetch(..., { keepalive: true })`.
- [ ] 🔴 **`navigator.sendBeacon(url, JSON.stringify(payload))` — une chaîne, jamais un `Blob` typé `application/json`.** C'est la condition pour rester une requête CORS « simple » : une chaîne part en `text/plain;charset=UTF-8`, qui est sur la liste sûre. Un `Blob` JSON déclencherait un **préflight `OPTIONS`** que le Worker ne traite pas → échec **silencieux**, avalé par le `try/catch` muet, donc invisible en production. Même règle pour le repli `fetch` : ne pas poser d'en-tête `Content-Type: application/json`.
- [ ] `sendBeacon` rend `false` s'il ne peut pas mettre la requête en file : **tester ce retour** et basculer sur `fetch keepalive`, pas seulement quand l'API est absente.
- [ ] Plafond de **64 Kio** par envoi, partagé par `sendBeacon` et `fetch keepalive`. Nos payloads en sont loin (§ Ce qu'on mesure) — à revérifier si le contenu grossit un jour.
- [ ] Joindre à l'événement `session` les deux seules données d'audience que le serveur ne peut pas déduire : le **palier de taille d'écran** (jamais la valeur exacte) et `document.referrer`.
- [ ] Conserver `platformPrefix()` (no-op local, préfixe `itch`/`ghp`) et le `try/catch` muet.
- [ ] Joindre le `buildVersion` déjà utilisé pour invalider les sauvegardes (#748).
- [ ] Supprimer le code mort hérité du refactor `e0c1a221` : les 8 constantes d'écran, `trackGameLoadedOnce()`, le beacon `Image` vers Goatcounter. **Zéro tolérance au code mort** (CLAUDE.md).

### Étape 4 — Câbler les trois événements aux points d'accroche réels — ✅ FAIT le 2026-09-02
- [ ] `battle_started` au démarrage du combat, **là où le seed est tiré une seule fois** (`combat-screen.ts` → `startPlacementFlow({ randomSeed })`, décision #857).
- [ ] ⚠️ **Ne pas émettre à la reprise d'un combat** (`resumeBattle`, plan 181), sinon une partie reprise trois fois compte pour quatre.
- [ ] `battle_ended` sur `BattleEventType.BattleEnded` dans le `feedback.report` de `combat-screen.ts` — **point unique et exhaustif**, déjà utilisé par `onBattleClosed?.()`. Le match nul (plan 191) y passe aussi.
- [ ] **Compteurs d'interface** : un incrément en mémoire à chaque action de la table du § `session`, et l'envoi des deltas sur `visibilitychange → hidden`. Un seul module compteur, appelé depuis les écrans — **pas** un appel réseau par bouton.
- [ ] Vérifier que le bac à sable et les tests e2e n'émettent rien — **procédure, pas intention** : lancer `pnpm dev:sandbox`, jouer une partie, et confirmer dans l'onglet réseau des devtools **zéro requête vers `/e`**. `platformPrefix()` rend `null` sur `localhost`, c'est ce garde qu'on vérifie.

### Étape 5 — Déploiement — ⏳ manuel FAIT le 2026-09-02, workflow GitHub restant

**URL de production** : `https://pokemon-tactics-telemetry.kekel87.workers.dev/e`

⚠️ Le sous-domaine `*.workers.dev` est dérivé de l'adresse e-mail du compte à la création — ici
`michael-parry-87`, donc le **nom civil** de l'auteur, dans une URL qui part dans le bundle public
du jeu. Changé pour `kekel87` le 2026-09-02 (décision humaine), qui est déjà le pseudo public du
dépôt et de la page itch, donc ne révèle rien de neuf. Le sous-domaine est **au niveau du compte** :
les deux Workers à venir (mise en relation, relais réseau — décision #869) en hériteront.
Le changement casse l'ancienne URL et demande quelques minutes d'émission de certificat TLS.
`wrangler` n'expose **aucune** commande pour ça : tableau de bord uniquement.
- [ ] `wrangler deploy` à la main d'abord, pour valider bout en bout avec un `curl`.
- [ ] Puis un workflow, déclenché **uniquement** sur changement du paquet :
  ```yaml
  # .github/workflows/telemetry-deploy.yml
  on:
    push:
      branches: [main]
      paths: ["packages/telemetry-worker/**"]
  ```
  avec le jeton de l'étape 0 en secret de dépôt. C'est l'étape de déploiement dont la décision #869 disait qu'elle rendrait le signaling et le relais NAT « nettement moins chers » ensuite.

### Étape 6 — Vérifier en production
- [ ] GitHub Pages : une partie complète → deux lignes en base, préfixe `ghp`.
- [ ] itch.io : idem, préfixe `itch`. L'étape 1 a déjà levé le doute sur la forme d'envoi ; ici on vérifie la chaîne complète.
- [ ] Une partie **quittée en cours** → `battle_started` seul, pas de `battle_ended`.
- [ ] Une partie **reprise** (plan 181) → pas de second `battle_started`.

### Étape 7 — Retirer Goatcounter *(seulement maintenant)*
- [ ] Supprimer `goatcounterPlugin()` de `packages/app/vite.config.ts` (et son entrée dans `plugins: [...]`).
- [ ] Vérifier sur `pnpm build` que `dist/index.html` ne contient plus ni `gc.zgo.at` ni `data-goatcounter`.
- [ ] Garder le compte Goatcounter en lecture et **comparer les deux mesures sur au moins trois jours** avant de le fermer. Ce qu'on compare : le même **ordre de grandeur** de visites (les chiffres absolus différeront, Goatcounter étant amputé par les bloqueurs — c'est le motif du remplacement, #867), et une répartition de pays et de navigateurs de forme comparable. Un écart massif inexpliqué est un signal, pas une fatalité.
- [ ] **Puis** fermer le compte.

### Étape 8 — Lire les statistiques, et pouvoir les demander à Claude en chat

**Exigence humaine (2026-08-31)** : « j'aimerais pouvoir te demander des stats ». Claude Code doit donc pouvoir interroger la base lui-même, depuis le dépôt, sans passer par un tableau de bord.

- [ ] **Accès en lecture depuis le dépôt** : `wrangler d1 execute <db> --remote --command "<SQL>"`. L'humain lance `wrangler login` **une fois** — c'est un OAuth qui ouvre le navigateur, donc à taper dans la session Claude Code avec le préfixe `!` (`! wrangler login`), qui exécute la commande côté humain. Les identifiants sont écrits dans la configuration locale de wrangler, **hors du dépôt**. Aucun jeton commité.
- [ ] **Script `pnpm stats`** dans `packages/telemetry-worker/` — **un livrable de cette étape, pas un jalon reporté** : une sous-commande par question récurrente : parties par jour, top Pokemon, top attaques, taux d'abandon (`count(battle_ended) / count(battle_started)`), répartition par carte et par format, issue par camp.
- [ ] 🔴 **Le script traduit les identifiants en noms FR officiels avant d'afficher quoi que ce soit.** La base stocke des identifiants anglais (`charizard`, `rock-slide`) ; les rendre tels quels violerait la règle dure de CLAUDE.md — l'humain ne connaît pas les noms EN. Le script résout via `packages/data` (`names.fr`, `src/i18n/*.fr.json`) et affiche `Dracaufeu`, `Lame de Roche`. **C'est une exigence du livrable, pas un confort.**
- [ ] ⚠️ **Clé de rattachement = le slot d'équipe, pas l'espèce.** Un miroir (deux camps avec la même équipe, autorisé) place deux fois la même espèce dans une partie : une clé par espèce mélangerait les deux builds. Cas rare, mais il pique celui qui écrit le SQL sans y penser.
- [ ] Les questions ad hoc (« quelle carte est la plus abandonnée ? ») se font en SQL à la volée par `wrangler d1 execute` — pas besoin de prévoir chaque question à l'avance.
- [ ] Documenter les requêtes dans le README du paquet, pour qu'elles survivent à une reprise après un mois.

**Ce que l'agrégation à la lecture demande en SQL** : D1 est du SQLite, donc `json_extract()` et `json_each()` sont disponibles — « top attaques » se lit par `json_each(payload, '$.moves')` agrégé, sans avoir éclaté une ligne par attaque à l'écriture (#868). **C'est ce qui valide le schéma brut.** À vérifier au moment de l'écrire, avec de vraies données.

**Quota de lecture** : 5 M lignes lues par jour, hors de portée à notre échelle. Si la table grossit au point que les requêtes scannent trop, l'évolution est une table d'agrégats quotidiens alimentée par un cron Worker — **pas maintenant**.

Pas de tableau de bord. Un endpoint agrégé mis en cache reste une piste ouverte pour afficher des stats **en jeu** (#870).

## RGPD — ce qu'on ne collecte pas

En collectant nous-mêmes, nous devenons **responsable du traitement** ; Goatcounter offrait cette conformité clés en main (#215), ici elle se fait **exprès** (#868).

**⚠️ Position révisée le 2026-08-31.** Tant qu'on ne mesurait que des compteurs de jeu, l'article 82 de la loi Informatique et Libertés était **hors périmètre** : rien n'était lu ni écrit dans le terminal. En ajoutant les visiteurs uniques et les données d'audience (§ Parité avec Goatcounter), on **quitte** ce terrain confortable pour celui de la **mesure d'audience exemptée de consentement** — celui où Goatcounter s'est toujours tenu. L'exemption est solide, mais **elle a des conditions**, là où l'inapplicabilité n'en avait aucune.

**Jamais stocké** : adresse IP (elle entre dans un calcul, en mémoire, et disparaît), chaîne d'agent utilisateur brute, résolution exacte, identifiant persistant, aucun recoupement avec un autre traitement.
**Stocké** : des compteurs de jeu, l'heure de réception côté serveur, la plateforme, la version du build, et pour les lignes `session` un haché de visiteur **à sel quotidien** plus des catégories d'audience (pays, navigateur, système, langue, palier d'écran, référent).

Ce sont des données de jeu, pas des données personnelles, **et ça doit le rester** : c'est le critère de relecture de toute évolution du payload.

**Aucun livrable de conformité en V1 — décision humaine du 2026-08-31.** Ni bandeau, ni mention de transparence, ni interrupteur d'opposition. Position assumée, avec sa raison : **on ne le faisait pas avec Goatcounter non plus**, et l'échelle ne le justifie pas — jeu gratuit, sans monétisation, quelques dizaines de visites par jour, et un schéma où aucune donnée personnelle n'est écrite.

Ce que l'exemption de mesure d'audience demanderait, pour mémoire et pour le jour où la question se reposera :

| Condition | Tenue par le design ? |
|-----------|----------------------|
| Finalité strictement limitée à la mesure d'audience | ✅ Aucune autre finalité, aucune transmission à un tiers |
| Pas de recoupement avec un autre traitement | ✅ La base ne contient qu'elle-même |
| Pas de suivi entre **jours** | ✅ Sel quotidien — le haché change chaque jour, y compris pour nous |
| Pas de suivi entre **sites** | ⚠️ **Non tenu, et assumé** (décision `#886`) : la plateforme n'entre pas dans le calcul du haché, donc la même personne produit le même identifiant sur itch.io et sur GitHub Pages le même jour. Inclure la plateforme — ce que font Plausible et Goatcounter — ferait compter pour deux uniques quelqu'un qui joue sur les deux. Choix humain du 2026-09-02 |
| IP non conservée | ✅ Entrée de calcul en mémoire, jamais écrite |
| Durée de conservation limitée | ⚠️ Rétention à définir (13 mois, référence CNIL) — voir la purge du § plan gratuit |
| Information et droit d'opposition | ❌ **Non fournis, assumé** |

**Donc cinq conditions sur six sont tenues par la structure même du schéma**, sans rien faire : c'est le sel quotidien et l'absence d'IP qui font le travail. Seule l'information des personnes manque, et c'est le choix explicite ci-dessus.

🔔 **À revisiter si l'audience devient significative** (décision humaine : « on en reparlera quand on aura une plus forte audience »). Le jour où ça arrive, le coût reste faible et les points d'accroche existent déjà : l'écran de crédits pour la mention, `settings-panel.ts` pour l'interrupteur. Rien dans le schéma ne devra changer — c'est la conséquence heureuse d'avoir tenu les cinq autres conditions dès le départ.

## Décisions à trancher avant de coder

1. ~~**Garde-t-on un événement de fréquentation ?**~~ **RÉSOLU le 2026-08-31** : l'événement `session` à compteurs (§ Ce qu'on mesure) le couvre et va plus loin — il porte la fréquentation, le funnel d'écran **et** l'usage des boutons de menu. Aucune régression par rapport au funnel de Goatcounter, qui était ce qui avait révélé le blocage itch en juin.
2. ~~**Un `battle_id` éphémère dans le payload ?**~~ **RÉSOLU le 2026-09-02 : oui** (décision humaine `#880`, conforme à la reco). Identifiant **aléatoire tiré à chaque partie**, porté par `battle_started` **et** `battle_ended` pour les relier — on obtient l'abandon **par carte et par format**, au lieu du seul taux global qu'auraient donné deux compteurs comparés. Règle non négociable qui accompagne la décision : **jamais écrit sur le disque, jamais lié à un appareil, jamais réutilisé d'une partie à l'autre**. Un identifiant de partie non persistant ne réidentifie personne ; un identifiant stable, si — c'est la ligne à ne pas franchir, et elle rejoint le sel quotidien de `#879`.

**→ Plus aucune décision ouverte sur ce plan.**

## Écarts au plan, constatés à l'exécution (2026-09-02)

Ce plan a été écrit avant de toucher au code. Cinq de ses consignes se sont révélées fausses ou
incomplètes ; elles sont corrigées ici pour que le document reste le compte rendu et non l'intention.

| Ce que le plan disait | Ce qui est vrai | Pourquoi |
|---|---|---|
| Dépendances **locales au paquet** | **À la racine** | Convention réelle du dépôt, vérifiée : la racine porte l'outillage (`typescript`, `vitest`, `vite`, `biome`), les paquets ne portent que leurs dépendances de **code**. L'isolation des types globaux se fait par le `tsconfig` du paquet (`"types": [...]`), pas par l'emplacement. Décision humaine du 2026-09-02. |
| Limitation de débit par `[[unsafe.bindings]]` | **`[[ratelimits]]`** | Syntaxe vérifiée dans la doc officielle le 2026-09-02 ; la forme `unsafe` est dépassée. Exige wrangler ≥ 4.36 (on a 4.128). |
| `binding = "DB"`, point d'entrée `src/index.ts` | **`binding = "database"`, `src/worker.ts`** | `useNamingConvention` (Biome) refuse `DB`/`RATE_LIMITER`/`VISITOR_SECRET` en `SCREAMING_CASE` ; renommer est une mise en conformité, pas une exception — Cloudflare accepte tout identifiant JS valide. `index.ts` est réservé aux barrels par convention de dépôt. |
| Deux `kind`, pas d'`[observability]` | **Trois `kind`, `[observability]` épinglé** | Le troisième (`session`) vient de la révision de `#878`. L'observabilité est déclarée explicitement plutôt qu'héritée du défaut, sur recommandation de la revue de code — c'est ce qui rend visible le `console.error` du chemin d'échec d'écriture. |
| « Ne rien envoyer quand tous les compteurs sont à zéro » | **La première ligne part toujours** | Trou méthodologique : sans ça, le cas le plus fréquent (jouer sans toucher un bouton instrumenté) n'aurait produit aucune ligne, et la promesse « aucune régression sur le funnel de Goatcounter » était fausse. Décision `#883`. |

Deux corrections de la revue de code ont par ailleurs changé le Worker : le corps de la requête
n'est plus lu **avant** la vérification de méthode et d'origine (le garde-fou de quota était en aval
de la dépense qu'il prétendait éviter), et l'échec d'écriture D1 est désormais **journalisé** au lieu
d'être avalé — sans quoi une table absente aurait été indiscernable d'un fonctionnement normal, ce
qui est le mode de défaillance le plus probable d'un premier déploiement. Ce dernier point a
d'ailleurs servi le jour même : le binding déclaré ne correspondait plus au code après renommage.

## Tests

- **Unitaires (Worker)** : la fonction de validation pure — `kind` inconnu rejeté, payload trop gros rejeté, `Origin` étrangère rejetée, méthode `GET` rejetée (ou acceptée si le repli itch est retenu).
- **Unitaires (client)** : `sendBeacon` mocké — no-op sur `localhost`, préfixe de plateforme correct, payload conforme, **une exception d'envoi ne remonte jamais** dans l'appelant.
- **e2e** : une seule assertion, mais celle qui compte — **aucun appel réseau de télémétrie pendant la suite**, garantie que les 519 tests ne polluent pas la base. Implémentation : `page.on("request")` et vérifier qu'aucune requête ne vise `/e`. À placer dans un test qui joue un combat complet, sinon l'assertion ne prouve rien.
- **e2e (reprise)** : le scénario `battle-resume` existant vérifie qu'une reprise n'émet pas de second `battle_started`.
- Pas de `@cloudflare/vitest-pool-workers` : la logique testable est pure, le reste se vérifie par `curl` à l'étape 7.

## Critères de validation

- Une partie jouée sur GitHub Pages **et** une sur itch.io produisent chacune deux lignes en base, avec la bonne plateforme.
- Une partie quittée en cours produit `battle_started` **sans** `battle_ended`.
- Une partie reprise (plan 181) ne produit **pas** de second `battle_started`.
- `pnpm build` ne contient plus aucune trace de Goatcounter.
- Le gate CI complet passe, et la suite e2e n'émet **aucune** requête de télémétrie.
- Le schéma D1 relu ligne à ligne ne contient **aucune adresse IP, aucun agent utilisateur brut, aucun identifiant persistant** — et le haché de visiteur d'hier ne correspond plus à celui d'aujourd'hui pour le même visiteur.
- **Parité Goatcounter atteinte** : visites, visiteurs uniques du jour, navigateurs, systèmes, pays, langues, paliers d'écran, référents (sur GitHub Pages).
- **`pnpm stats` répond à une question posée en chat**, et rend des **noms FR officiels** — jamais un identifiant anglais.
