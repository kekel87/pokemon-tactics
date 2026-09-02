# Plan 195 — Phase 7 « Multijoueur & télémétrie » (plan-cadre)

> **Statut** : in-progress
> **Créé** : 2026-08-31
> **Phase démarrée** : 2026-09-02 — par le Lot A (télémétrie, plan 196). Compte Cloudflare créé le même jour.
> **Nature** : plan-cadre d'une phase entière. Chaque lot sera détaillé dans son propre plan au moment de l'attaquer. Ce document fixe le périmètre, l'ordre, les acquis, les décisions déjà prises et celles qui restent ouvertes.
> **Référence de conception** : `docs/multiplayer.md` (réécrit en v2 le 2026-08-29). Décisions `#209-212` (fondations) et `#862-870` (cadrage). Ce plan **ne rejoue pas** le raisonnement de ce document — il l'ordonne en lots exécutables.

## Motivation

Jouer contre de vrais adversaires. La Phase 6.5 « Client jouable » est close depuis le 2026-08-21 et publiée en `v2026.8.2` : la justification qui la faisait passer avant le multijoueur (« injouable sur mobile ») est levée.

Le cadrage a été arrêté le 2026-08-29 en **passe de préparation, sans écrire une ligne de code**. Cette phase est donc la première où la question n'est plus « comment » mais « dans quel ordre ».

## Ce qui est déjà prêt — et que la phase ne doit pas réinventer

| Acquis | Ce qu'il donne à la Phase 7 |
|--------|-----------------------------|
| **Déterminisme verrouillé** (plan 181) | `creationRng: createPrng(seed)` sur le chemin live, plus aucun `Math.random` en production. L'exécution dupliquée repose entièrement là-dessus. |
| **Replay éprouvé** (`exportReplay` / `runReplay`) | Reconnexion et resync sont des rejeux, pas un protocole neuf. |
| **Port de persistance** `load`/`save`/`clear` (#751) | La source du journal peut devenir le pair distant sans toucher l'écran de combat. |
| **Hot-seat N joueurs** (`humanPlayerIds`, plan 188) | **Le plus gros cadeau de la Phase 6.5** : le tour distant se greffe là où le tour hot-seat existe déjà. |
| **Couche d'entrée device-agnostique** (plans 184-186) | Le lobby est jouable à la manette sans travail spécifique — seule la saisie d'un code reste à cadrer. |
| **Analytics existant** (`packages/app/src/analytics/analytics.ts`, plan 114) | 8 événements d'écran, beacon `Image` vers l'endpoint pixel Goatcounter, préfixe de plateforme `itch`/`ghp`, no-op en local. La télémétrie **remplace** ce fichier ; ses trois bonnes idées (préfixe de plateforme, no-op local, « ça ne casse jamais le jeu ») sont à **conserver**. |
| **Harnais e2e** (`.claude/rules/e2e.md`) | Sait piloter une manette synthétique et un hook de scène. Les tests à deux contextes s'y branchent. |

## Ce qui est écarté et ne reviendra pas sans nouvelle décision

Serveur autoritaire · Supabase (mise en pause à 7 jours, #862) · matchmaking (écarté, pas reporté) · fog réel en ligne (#863) · classement compétitif (#870).

**Conséquence à assumer sans y revenir** : en exécution dupliquée, chaque pair détient l'état complet, donc un client modifié voit à travers le fog (PV exacts, objet, talent). C'est un « non » définitif au report de #728/#732, pas un chantier futur.

---

## Découpage en lots

L'ordre est celui de la décision #869 (télémétrie → signaling → relais NAT), étendu au combat lui-même.

### Lot A — Télémétrie *(première tranche livrable — plan détaillé : `196-telemetrie-cloudflare-workers.md`)*

**Indépendante du réseau, utile immédiatement en solo** — c'est-à-dire sur 100 % du jeu tel qu'il existe aujourd'hui. Et c'est elle qui fait apparaître le compte Cloudflare, le `wrangler.toml` et l'étape de déploiement, dont les lots B4+ dépendront.

Périmètre :
- Worker d'ingestion + base D1, schéma **événement brut en JSON, agrégation à la lecture** (#868).
- **Trois événements groupés**, jamais un par clic ni un par attaque :
  - `session` — usage de l'interface (crédits, import/export Showdown, Team Builder, menu de combat, remapping…), par **compteurs accumulés en mémoire** et envoyés en deltas ;
  - `battle_started` — mode de jeu et **composition des équipes** : c'est ce qui donne les *usage stats* à la Showdown (quelle part des équipes emmène quel Pokemon, avec quel objet et quel talent), et la composition part au **démarrage** pour que les parties abandonnées comptent aussi ;
  - `battle_ended` — issue, durée, tours, K.O. par cause, attaques réellement lancées. L'écart avec `battle_started` donne le taux d'abandon gratuitement.
- Client de jeu : un `fetch()` vers **notre** API sur un chemin neutre, pas un script d'analytics — les listes de filtrage ne peuvent pas le bloquer sans casser le jeu (#867).
- Retrait de Goatcounter : `goatcounterPlugin()` dans `packages/app/vite.config.ts` **et** `analytics.ts`.
- ⚠️ **Ce lot est un recâblage, pas un changement d'endpoint** : `game-loaded`, `battle-start` et `battle-end` sont déclarés dans `analytics.ts` et **jamais émis** depuis le refactor `e0c1a221` du 2026-06-15, qui a supprimé les scènes Phaser où vivaient leurs appels. Aucun combat n'est mesuré depuis deux mois et demi.
- Lecture des statistiques (au minimum une requête SQL documentée ; un endpoint agrégé si le coût est nul).
- **RGPD par construction** : aucun identifiant, aucune IP stockée, aucune empreinte. Goatcounter offrait la conformité clés en main (#215) ; ici elle se fait **exprès** (#868).

### Lot B — Multijoueur P2P 1v1

Viser le **1v1**, pas le FFA à 12 (§ ci-dessous). Découpage proposé, chaque tranche livrable et testable seule :

- **B1 — Transport et lobby.** Package `packages/network/` (`protocol.ts`, `peer-connection.ts`, `room.ts`), nouvel `ScreenId` `lobby` câblé dans `SCREEN_TRANSITIONS`, codes de partie **préfixés** (#866), lien d'invitation construit **depuis l'origine courante** (le jeu tourne sur GitHub Pages *et* en iframe itch.io), handshake avec version de protocole (`buildVersion` sert déjà à invalider les sauvegardes, #748). Critère : deux navigateurs se connectent et s'échangent un message.
- **B2 — Combat en réseau.** Seed partagé, échange des sélections d'équipe, tour distant greffé sur `humanPlayerIds`, validation de chaque action reçue contre `getLegalActions()` avec le barème 1er/2e/3e (rejet → avertissement → forfait). Critère : un combat 1v1 complet de bout en bout.
- **B3 — Robustesse.** Chronomètre **local auto-déclarant** dont le timeout produit une *action* et non un message réseau (#864) ; chien de garde de connexion **distinct** du chrono, à `chrono + marge` (#865) ; reconnexion par le chemin du plan 181 ; abandon volontaire. Critère : couper le réseau d'un pair et revenir.
- **B4 — Détection de désync.** `checksum.ts` : **sérialisation canonique** du `BattleState` (ordre des clés, ordre d'itération des `Map`, arrondi des flottants comme `tile.height`) puis hash comparé tous les N tours. ⚠️ **Le point le plus sous-estimé du document d'avril** — petit chantier réel, à ne pas traiter comme un `JSON.stringify`. Reconstruction depuis le replay quand ça diverge.

**Deux corrections à faire dans ce lot, notées par l'audit :**
1. `mapUrl` → **identifiant stable de carte** (`MAPS_REGISTRY`). Une URL n'est pas un contrat entre deux pairs.
2. **L'IA ne peut pas tourner sur les deux pairs** : elle est seedée sur `createPrng(Date.now())` (`combat-screen.ts:782`), deux pairs divergeraient au premier tour. Il faut soit désigner un pair émetteur qui joue l'IA et diffuse ses actions, soit fournir un seed d'IA de session.

### Lot C — Écran de victoire enrichi *(sans dépendance réseau)*

Récap de fin de partie : tours, KO, MVP. **Il partage sa matière avec l'événement `battle_ended` du Lot A** (durée, tours, camp vainqueur, Pokemon et attaques utilisés) : définir ce que la télémétrie collecte, c'est définir ce que cet écran peut afficher — et c'est ce qui garde le Lot C dans cette phase.

> Ce lot aura **son propre plan détaillé**, comme les autres. Sa dépendance au Lot A porte sur la **donnée** (quels champs sont dérivables de l'état de fin de partie), pas sur le code : le plan 196 ne contient rien de cet écran et n'a pas à en contenir.

**Périmètre réduit le 2026-08-31** (décision humaine). Les deux autres items que la roadmap portait en Phase 7 en sortent, faute de tout lien avec le réseau ou la télémétrie :
- **Speed controls** — configurer la vitesse des déplacements, passer les animations d'attaque → **Phase 9**. Item hérité du commit `f805821` (2026-04-02, réorganisation de roadmap), jamais cadré, aucune décision et aucun retour de playtest derrière. À noter : « passer les animations d'attaque » suppose des animations d'attaque, qui **n'existent pas aujourd'hui**.
- **Tutoriel interactif** → **Phase 9**.

> **Le lecteur de replay n'est pas dans cette phase non plus.** Il vit en **Phase X — Social & Partage** (« Share replay via URL + lecteur de replay »), avec sa propre vitesse de lecture. La Phase 7 se sert du replay comme **mécanisme interne** — reconnexion et resync (Lots B3/B4) — sans jamais l'exposer au joueur.

### Après la V1 — non engagé

Signaling maison sur Durable Object (~100 lignes, namespace à nous, plus de dépendance au SLA inexistant de `peerjs.com`) · relais de secours quand le NAT gagne, qui **supprime le besoin d'un TURN tiers** · FFA à 12 à retester · affichage de statistiques d'usage en jeu (#870, piste ouverte non cadrée).

---

## Risques identifiés — et la position tenue sur chacun

| Risque | Position |
|--------|----------|
| **NAT symétrique / CGNAT mobile** : certaines paires ne se connecteront jamais en direct. | Assumé en V1 : message clair, « réessayez depuis une connexion fixe ». Le vrai correctif est le relais de secours, après la V1. L'IPv6 (>50 % mondial en mars 2026, France en tête) joue pour nous. |
| **PeerJS Cloud sans SLA**, namespace mondial partagé, historique de `429`. | Codes préfixés (#866) en V1 ; signaling maison si ça mord. |
| **Coût machine des tests e2e** : la suite est déjà à 519 tests sous plafond CPU. | Une famille de tests à deux contextes navigateur se **budgète**, ne s'ajoute pas sans y penser. L'essentiel des bugs de protocole se prend en intégration (deux moteurs, canal `EventEmitter`). |
| **Télémétrie en tierce partie** : un Worker sort sur `*.workers.dev` par défaut, ce que les filtres visent en priorité. | **Assumé** (décision humaine du 2026-08-31) : on reste sur `*.workers.dev`. Bloquer ce domaine en masse casserait trop de sites. Un nom de domaine servant le jeu et l'API en première partie l'annulerait complètement — décidable plus tard, seule l'URL de base changerait. |
| **CSP de l'iframe itch.io** : le plan 114 avait constaté que le `<script>` Goatcounter y était bloqué et avait dû passer par un beacon `Image`. Un `fetch()` POST vers un domaine tiers y est **non vérifié**. | À prouver en prod dans le Lot A, avec un repli identifié avant de coder (`fetch` en `no-cors`, ou beacon `Image` sur notre propre endpoint). Ne pas découvrir ça après le déploiement. |
| **FFA à 12 en réseau** : 66 connexions mesh, 12 copies du moteur, et **aucune politique définie pour une désync partielle** (3 pairs sur 12 divergent — qui a raison ?). | Hors périmètre V1. Le 1v1 d'abord. |

## Décisions à trancher — avant ou pendant les lots

**Tranchées le 2026-08-31 (décisions humaines) — le plan détaillé du Lot A part de là :**
1. **Pas de nom de domaine.** L'API reste sur `*.workers.dev`, donc en tierce partie vis-à-vis du jeu. Coût zéro, déployable tout de suite, et `workers.dev` n'est pas bloqué en masse — ça casserait trop de sites. **Décidable plus tard sans jeter de code** : seule l'URL de base change.
2. **Le Worker vit dans `packages/telemetry-worker/`.** Dans le workspace existant (`packages/*`), donc couvert par le lint et le typecheck du gate CI sans changement structurel. Ses dépendances (`wrangler`, `@cloudflare/workers-types`) restent locales au paquet.
3. **Lot C réduit à l'écran de victoire enrichi** (§ Lot C) — speed controls et tutoriel interactif partent en Phase 9.

**Reste à faire avant le premier déploiement :**
- **Création du compte Cloudflare** — action humaine, non déléguable.

**Pendant le Lot B :**
4. **Durée du chronomètre** et **action par défaut** au timeout. « Passer le tour » sans agir est le choix sûr ; surtout pas une attaque au hasard. Trois effets de game design à adosser à cette décision comme critères de test (relevés par l'agent `game-designer`, 2026-08-31) :
   - ⚠️ **Attendre n'est pas neutre dans le barème CT** : `CT_WAIT = 350` contre `CT_MOVE_ONLY = 400` et ≥ 500 pour toute attaque réelle (`packages/core/src/battle/ct-costs.ts`). C'est **le coût le plus bas de toute la table**, donc l'action par défaut au timeout est aussi la **plus rentable en tempo** du jeu. Aucun impact sur le plateau, donc pas un exploit grave — mais à assumer explicitement, plutôt que de découvrir qu'un joueur a intérêt à laisser filer le temps sur ses tours creux.
   - **Un chrono fixe par décision favorise structurellement les Pokemon rapides.** Le système CT leur donne déjà plus de décisions ; les profils lents compensent par des effets dont la durée se compte en tours du lanceur. Un chrono identique pour toutes les décisions rabote cette compensation. Sans conséquence si le chrono est un garde-fou généreux contre l'inactivité ; à tester sur un profil lent/support **et** sur une décision de zone à plusieurs cibles avec tir allié si l'intention est une pression compétitive serrée.
   - **Le chrono se met-il en pause quand le menu de combat est ouvert ?** Décision à prendre, pas à laisser à l'implémentation. Le plan 187 avait noté que le menu grignote le temps sans le dire, mais pour l'horloge de partie. Le chrono étant **local et auto-déclarant** (#864), le mettre en pause pendant qu'une modale locale est ouverte **ne touche pas au modèle réseau** — sinon un joueur qui consulte ses contrôles se fait éliminer par timeout.
5. **Politique de reconnexion** : délai, qui attend, ce que voit l'autre.
6. **Saisie du code de partie** à la manette (clavier virtuel, ou roue de caractères).

## À ne pas oublier en cours de route

- **Le menu de combat grignotera le temps du joueur sans le dire** (noté par le plan 187). Rien n'est mis en pause (#819, « un seul comportement dès le solo ») : il faudra une pastille « le temps continue » sur la modale quand le chrono existera.
- **La télémétrie ne doit jamais casser le jeu.** L'`analytics.ts` actuel enveloppe déjà son beacon dans un `try/catch` muet — la règle survit au changement d'implémentation.
- **Piège du gate constaté le 2026-08-29** : `test:e2e:affected` peut classer un diff comme non-code et ne jouer que 2 tests sur 519. Pour toute release de cette phase, forcer `pnpm test:e2e` complet.

## Critères de clôture de la phase

- Deux personnes sur deux machines différentes jouent un 1v1 complet en s'échangeant un code, sans qu'aucun serveur du projet n'arbitre le combat.
- Une déconnexion en cours de partie se rattrape ou se solde proprement, sans état incohérent.
- La télémétrie remonte parties jouées, Pokemon et attaques les plus joués, et taux d'abandon — et Goatcounter est retiré du dépôt.
- Aucune donnée personnelle collectée, vérifiable en lisant le schéma.

## Hors périmètre explicite

Serveur autoritaire, fog réel, classement, matchmaking, chat vocal, spectateur, FFA à 12 en réseau, TURN tiers.
