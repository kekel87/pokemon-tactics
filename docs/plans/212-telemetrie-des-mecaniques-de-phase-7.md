# Plan 212 — Mesurer les trois mécaniques de fin de Phase 7

**Statut** : ready
**Ouvert le** : 2026-09-15, sur question de l'humain — « la télémétrie est en place pour le multi ?
on a bien tout prévu comme point de mesure ? »
**Cadré le** : 2026-09-15, avec l'humain
**Bloque la release ?** : **OUI**, arbitré par l'humain. Motif ci-dessous.
**Taille** : petit — trois compteurs, trois libellés oubliés, et leurs tests.

## Pourquoi ce plan existe

L'audit de la télémétrie en ligne, fait à la demande de l'humain avant de publier la Phase 7, dit
deux choses.

**La première est rassurante.** Tout ce qui a été pensé aux plans 201 à 204 est en place et vivant :
l'entonnoir du salon avec **une cause de refus par compteur**, le chrono de tour, les **quatre
causes de forfait distinguées**, la reprise réussie contre la reprise échouée, la dégradation ICE,
la somme de contrôle **et son dénominateur**. Les treize compteurs en ligne ont tous au moins un
point d'émission réel — aucun déclaré-mais-mort. Et `battle_started` porte `mode`, `format`,
`humans`, `ai`, plus le `battleId` partagé entre pairs qui fait compter **une** partie et non deux.

**La seconde ne l'est pas.** Trois mécaniques livrées **après** cette conception n'ont jamais été
instrumentées — elles sont nées aux plans 209, 210 et 211, quand la télémétrie, elle, datait du 204 :

| Mécanique | Plan | Mesurée ? |
|---|---|---|
| Migration d'hôte | 209 | ❌ |
| Chrono de placement à 90 s, puis pose automatique | 211 | ❌ |
| Joueur éliminé : il regarde ou il part | 210 | ❌ |

### Pourquoi ça bloque la release plutôt que d'attendre

🔴 **Une mesure oubliée avant publication est une mesure perdue pour toujours.** Les premières
semaines sont les plus informatives — c'est là que les modes d'échec inconnus se manifestent, sur
des réseaux qu'on n'a pas, avec des joueurs qui ne font pas ce qu'on attend. Ajouter le compteur
après coup ne rattrape pas les données qu'on n'a pas prises.

Et la télémétrie s'est donné cette règle à elle-même, noir sur blanc dans `telemetry.ts` :

> **les délais du lot sont des paris**, arrêtés à la main faute de terrain […] « On ajustera à
> l'usage » n'est tenable que si l'usage se mesure, sinon on devine deux fois.

Or **le chrono de placement de 90 s est exactement un de ces paris**, et son frère — les 60 s du
chrono de tour — **est** mesuré par `turn-timed-out`. L'incohérence est directe : on a instrumenté un
pari et pas l'autre, pour la seule raison que le second est né deux plans plus tard.

La **migration d'hôte** est le cas le plus gênant des trois. C'est le mécanisme le plus récent et le
plus risqué du multijoueur — il réécrit **qui héberge en pleine partie**, il dépend d'un registre
externe, et son compare-and-swap a déjà été corrigé deux fois en recette (plan 209, puis la
migration en chaîne). On s'apprête à le publier avec **zéro signal de terrain**.

## Ce qu'il faut faire

### Lot A — Migration d'hôte

Compter le moment où un pair **devient** hôte par migration (jamais à la création : `Room.create` a
déjà `room-created`).

- **Où** : `packages/app/src/network/online-room.ts`, dans `holdOnlineRoom`. C'est le **seul** site
  qui traverse toutes les phases — la migration peut survenir en salle d'attente comme en plein
  combat, et ce fichier détient le salon des deux côtés de la transition d'écran. S'abonner par
  `room.onChange` et détecter la transition `Guest → Host`.
- 🔴 **Pas dans `packages/network`** : ce paquet ne connaît pas la télémétrie, et ne doit pas. C'est
  la même frontière que `maxSeats` et `rendezvous`, injectés depuis l'application.
- ⚠️ Compter la **transition**, pas l'état : `onChange` émet à chaque changement de salon, donc il
  faut mémoriser le rôle précédent, sinon un hôte compte à chaque événement.
- Nom proposé : `HostMigrated` → `"host-migrated"`.
- **Ce que ce chiffre répondra** : la migration arrive-t-elle vraiment, et aboutit-elle ? Croisé avec
  `forfeit-absent`, il dit si un hôte qui part est remplacé ou si la partie meurt avec lui.

### Lot B — Chrono de placement expiré

- **Où** : `packages/app/src/babylon/placement-flow.ts`, dans `onWindowExpired()`, à l'intérieur du
  `if (!phase.isPlayerDone(localPlayerId))` — on ne compte que si l'expiration a **réellement** posé
  quelque chose à notre place. Un joueur déjà prêt dont la fenêtre expire n'est pas un dépassement.
- Nom proposé : `PlacementTimedOut` → `"placement-timed-out"`.
- **Ce que ce chiffre répondra** : 90 s suffisent-ils pour poser son équipe ? Exactement la question
  que `turn-timed-out` pose pour les 60 s du tour. À lire rapporté au nombre de parties en ligne.

### Lot C — Le joueur éliminé, regarder ou partir

- **Où** : le dialogue à deux issues du plan 210 (`showEliminated`, `battle-chrome.ts` côté rendu ;
  le câblage est dans `combat-screen.ts`). Un compteur par issue.
- Noms proposés : `EliminatedKeptWatching` → `"eliminated-kept-watching"` et `EliminatedLeft` →
  `"eliminated-left"`.
- **Ce que ces chiffres répondront** : le mode spectateur sert-il à quelqu'un ? C'est une
  fonctionnalité entière livrée « sans une ligne de code » au plan 210 ; si personne ne reste, on le
  saura, et c'est une information de conception, pas un bug.
- ⚠️ Le seul des trois qui ne mesure **pas** un pari technique. Il vient en dernier.

### Lot D — Les trois libellés oubliés

`packages/telemetry-worker/src/report.ts` porte une table `Record<string, string>` qui nomme chaque
action dans le rapport. Trois compteurs **existants** n'y figurent pas et s'y afficheraient sous leur
clé brute :

- `checksum-mismatch`
- `checksum-compared`
- `room-failed-format_reduit`

Y ajouter aussi les compteurs des lots A à C. **Ne pas oublier ce lot** : c'est précisément le genre
d'oubli qui a produit les trois premiers.

## Ce qu'il ne faut PAS faire

- ❌ **Ne pas ajouter `mode` à `BattleEndedPayload`.** C'est ce que demanderait
  `backlog-telemetrie-partie-a-cheval-sur-la-borne`, et le plan 204 se l'est explicitement interdit.
  Hors périmètre, et ça change la forme d'un message.
- ❌ **Ne pas toucher au Worker au-delà de la table de libellés.** Les actions sont comptées
  génériquement ; aucune liste blanche à maintenir côté serveur.
- ❌ **Ne pas instrumenter la production pour rendre un test vert** — voir
  `feedback-agents-jamais-instrumenter-la-production`. Si un compteur est difficile à couvrir, le
  dire plutôt que d'ajouter un crochet.

## Comment on saura que c'est fait

- Les quatre nouveaux compteurs ont chacun **un point d'émission réel** et un test qui le prouve —
  le contrôle à refaire est celui de l'audit : un compteur déclaré et jamais émis est pire que pas de
  compteur, il donne l'illusion de la mesure.
- Le rapport n'affiche plus aucune clé brute.
- `pnpm stats` tourne et montre les nouvelles lignes.
- Gate full vert.

## Suite immédiate, hors de ce plan

L'humain veut **regarder les statistiques existantes** avant de publier. À faire au même moment,
mais ce n'est pas du code : lire le tableau de bord (`pnpm stats`, plus le tableau protégé du
Worker), et se demander ce que les chiffres d'avant-multi racontent déjà. Voir l'entité
`plan-196` du graphe pour le dispositif, et `backlog-écart-résiduel-télémétrie-vs-compteur-itchio`
— cette mesure-là s'active **pile après** le redéploiement, donc après la release.
