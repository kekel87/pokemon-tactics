# Plan 209 — Le FFA en réseau

**Statut** : à cadrer
**Ouvert le** : 2026-09-13, à la demande de l'humain, en recette du plan 208
**Rouvre** : décision #944 (le 1v1 seul en ligne), **contestée par l'humain**

## Pourquoi ce plan existe

En recette du plan 208, l'humain a buté une fois de plus sur l'absence de sélecteur de format dans la
salle d'attente en ligne. Ses mots : **« Mais pourquoi tu parles TOUJOURS au singulier, le multi c'est
pas que du 1v1 »**, puis, devant la décision qui l'explique : **« Mais qui a décidé ça ! J'ai jamais
voulu ça moi »**.

La décision #944 (2026-09-08, plan 201 Lot B2) est tracée comme **décision humaine**. Elle répondait
à la question « quels formats offrir en ligne ? » et retenait « le 1v1 seul ». L'humain ne la
reconnaît pas trois plans plus tard, et la redemande à chaque recette — c'est le signe que l'accord
n'a pas porté sur ce qu'il croyait accorder. **On la rouvre.**

🔴 Ce plan est **à cadrer avec l'humain avant d'être écrit en détail**, et à plus forte raison avant
d'être codé : il touche au cœur du protocole et au déterminisme déjà livré. Ce document pose le
problème, l'inventaire et les questions — pas une solution arrêtée.

## Le vrai obstacle, en une phrase

Le garde-fou d'index (décision #941 / D3) suppose un canal **fiable et ordonné**. C'est vrai **par
connexion** — donc exact à deux pairs, et faux dès qu'il y en a trois.

Le mécanisme, tel qu'il tourne aujourd'hui :

- chaque action diffusée porte `actionIndex`, le nombre d'actions enregistrées chez l'émetteur avant
  elle (`Room.sendAction`, `room.ts:473`) ;
- à la réception, `submitRemoteAction` compare à `engine.actionLogLength` et **refuse** sur écart
  (`battle-orchestrator.ts:1818`) ;
- trois refus d'affilée éliminent le joueur (barème du Lot B2).

`Room.broadcast` (`room.ts:1403`) écrit sur **chaque canal** d'une boucle. Deux canaux distincts, deux
`RTCDataChannel` : SCTP garantit l'ordre *dans* un canal, **rien** ne l'ordonne entre deux. À trois
camps, une action peut donc arriver légitimement « en avance » par rapport à une autre reçue d'un
troisième pair — elle est refusée comme un décalage, **sur un joueur parfaitement honnête**, puis
**perdue** faute de renvoi. Trois fois, et il est éliminé.

C'est cela, et cela seul, qu'il faut lever. Ce n'est pas un choix de design d'interface.

## La bonne nouvelle : le germe de la solution est déjà là

`pendingRemoteActions` (`battle-orchestrator.ts:317`) **existe déjà** et fait exactement le bon geste
dans un cas voisin : quand une action arrive alors qu'on n'est pas encore en attente (`phase !==
"waiting_remote"`, typiquement pendant une animation), elle est **gardée**, pas refusée. Le
commentaire dit pourquoi, et c'est mot pour mot notre problème :

> « La refuser compterait un refus **contre un joueur honnête**, et trois suffisent à l'éliminer. »

La file est rejouée dans `refreshUI` (`:1122`), une action à la fois.

**La piste la plus économique est donc d'étendre ce tampon au cas « index en avance »** : au lieu de
refuser sur `envelope.actionIndex !== expected`, garder quand l'index est **supérieur** à l'attendu
(l'action est légitime, elle arrive trop tôt), et ne refuser que s'il est **inférieur** (l'émetteur
est en retard, ou rejoue). À valider — c'est une intuition de lecture, pas une conclusion.

## Inventaire de ce qui bouge (première passe, à compléter au cadrage)

| Où | Ce qui est en cause |
|---|---|
| `battle-orchestrator.ts:1818` | le refus sur écart d'index — le cœur du sujet |
| `battle-orchestrator.ts:317`, `:1122` | le tampon existant, à étendre plutôt qu'à dupliquer |
| `room.ts:1403` `broadcast` | la boucle sur les canaux : rien n'ordonne entre eux |
| `online-room.ts` `ONLINE_TEAM_COUNT` | la constante à lever — **une ligne**, mais la dernière, jamais la première |
| `lobby-screen.ts` | le sélecteur de format à rendre, et le nombre de places à graver avant le code |
| `GamePanel.ts` `formatLabel` | le cas « N joueurs » redevient atteignable — il est écrit et inutilisé depuis le plan 207 |
| `Room.setSeatOccupancy` | `Human` refusé sur une place libre (correctif du 2026-09-05) — à revoir à N camps |
| décision #975 (Lot B4) | la somme de contrôle devient **meilleure** à N pairs : la majorité devient possible |
| `BattleEngine.forfeit` | ⚠️ il élimine un camp **sans** faire bouger `appliedActionCount` — sans conséquence en 1v1, **faux positif garanti** sur la majorité à trois camps (limite déjà écrite dans #975) |
| `backlog-election-nouvel-hote-multijoueur` | débloqué par ce plan, mais a son propre préalable : le code du salon **est** l'adresse de l'hôte (#904) |

## Questions à trancher avec l'humain

1. **Jusqu'où ?** Tous les formats du local (3J×4, 4J×3, 6J×2, 12J×1), ou d'abord 3 et 4 camps ? Douze
   pairs, c'est un maillage de 66 connexions — la question du relais par l'hôte se pose bien avant.
2. **Tampon ou horloge ?** Étendre `pendingRemoteActions` (bon marché, local) ou ordonner vraiment
   (horloge logique, ou relais de toutes les actions par l'hôte, qui redevient alors un point de
   passage — et un point de panne).
3. **Le forfait et la majorité** (#975) : à traiter dans ce plan, ou juste après ? Sans lui, la somme
   de contrôle donne des faux positifs dès le troisième camp.
4. **L'élection d'un nouvel hôte** : hors périmètre, ou dedans ? Elle n'a de sens qu'à plus de deux
   joueurs, donc elle naît avec ce plan — mais son vrai blocage est ailleurs (#904).

## Ce qu'on ne refait pas

Le plan 208 vient de livrer la carte en modale et le bandeau de partie. Rien de ce plan-ci ne doit y
revenir, à une exception près : **la ligne « Format · 1 contre 1 »** du bandeau redeviendra un vrai
choix, et le sélecteur de format reviendra dans la salle d'attente — c'est précisément ce que
l'humain réclame depuis trois plans.
