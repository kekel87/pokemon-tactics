# Plan 207 — L'écran « Jouer en ligne » rhabillé, et le refus enfin visible

**Statut** : done
**Session** : 5 de `agenda-2026-09-10-file-de-sessions-dediees`
**Solde** : `backlog-revoir-ecran-creation-partie-multijoueur` (volet esthétique),
`backlog-ecran-partie-introuvable`
**Suite** : plan 208 (la carte en modale), qui réutilise le contexte manette posé ici

## Ce que le cadrage a établi

Cadré avec l'humain le 2026-09-10, écran servi et regardé. Il a nommé **l'esthétique seule** : le
parcours lui va, le partage du code par dictée lui va, la roue de caractères lui va dans son
principe. Donc on ne touche ni à la décision #896 (le nombre de camps gravé avant la création), ni à
#897 (pas de second écran de salon), ni à #895 (pas de lien d'invitation).

## 🔴 Le backlog se trompait sur « partie introuvable »

L'entrée disait « un simple `<p class="lb-error">` sous le bouton Rejoindre de l'écran lobby ».
C'est faux, et le cadrage a dû partir d'ailleurs.

L'écran `lobby` ne sait prononcer **qu'un seul refus** : « Ce code est incomplet. »
(`lobby-screen.ts:69`, la forme du code, seule chose qu'il puisse juger sans avoir joint personne).

Les six causes réelles (`NetworkErrorCode`) s'affichent **en pied de page de l'écran de sélection
d'équipe** (`team-select-screen.ts:688`, `.ts-footer-error`) — donc **après avoir quitté le lobby**.
Un code mal recopié envoie donc le joueur sur un écran complet de construction d'équipe, pour une
partie qui n'existe pas, avec une ligne rouge en bas du pied. C'est **où** le refus arrive qui est
le défaut principal, pas seulement à quoi il ressemble.

## Étape 1 — Deux panneaux, et la fin des doublons

Les deux gestes ne se distinguaient pas, et chacun se disait **deux fois** : le titre de section et
le bouton portent le même libellé (`lobby.createTitle` = `lobby.create` = « Créer une partie » ;
`lobby.joinTitle` / `lobby.join` pour l'autre). Retour de l'humain sur les deux.

Correctif : **les titres de section disparaissent**. Chaque panneau s'identifie par son contenu et
par son bouton, qui reste le seul à nommer l'action.

```
+--------------------------------+  +--------------------------------+
|  Tu héberges la partie.        |  |  Tu as reçu un code ?          |
|  Ton adversaire te rejoint     |  |                                |
|  avec ton code.                |  |     X   K   Q   4   M          |
|                                |  |                                |
|                                |  |  [ Coller ]                    |
|  [   Créer une partie   ]      |  |  [     Rejoindre     ]         |
+--------------------------------+  +--------------------------------+
```

Panneaux encadrés (`--color-bg-elevated`, bordure fine), côte à côte en paysage large, empilés
sinon avec un « ou » entre les deux.

⚠️ La media query `max-height: 420px` de `lobby.css` existe parce qu'à 568×320 le contenu
**dépassait** (374 px pour 320 px de hauteur). Deux panneaux encadrés ajoutent du remplissage et des
bordures : cette taille est à **mesurer à nouveau**, pas à supposer tenue.

## Étape 2 — La ligne de format retirée

`« Joueurs : 2 joueurs »` disparaît. L'humain ne la comprenait pas, et il a raison sur le fond : **le
format n'est pas encore décidé à ce stade**, il se choisit à l'écran suivant.

🔴 **Correction d'une erreur d'analyse commise pendant ce cadrage, à ne pas rejouer** : j'ai affirmé
qu'« une carte déclare un seul format par nombre de joueurs, donc il n'y a rien à choisir ». Faux.
Les **neuf** cartes de `packages/app/public/assets/maps/` déclarent les **cinq** couches de spawn
(`spawns_1v1`, `spawns_3p`, `spawns_4p`, `spawns_6p`, `spawns_12p`) : **toutes les cartes acceptent
tous les formats**. L'humain a signalé, agacé, que la discussion avait déjà eu lieu.

Consigné en **décision #1009** — avec une seconde correction qui vaut plus que la première. J'ai
d'abord écrit que la contrainte n'était « pas dans le graphe » ; **elle y était**. `decision-276`
(2026-04-21) et l'entité de retour « 1 layer Tiled par format de spawn » imposent les cinq
`objectgroups` à toute carte multi-format, et `decision-203` donne
`maxPokemonPerTeam = 12 / teamCount`.

Ce qui manquait, c'est la **conséquence**, pas la prémisse : « toute carte doit déclarer les cinq
couches » était écrit, « donc aucune carte ne restreint un format » ne l'était pas. Une règle de
rédaction de carte ne se lit pas comme une garantie de compatibilité, et c'est ce saut qui a été
raté deux fois.

🔴 **Leçon de méthode, mesurée pendant ce cadrage** : les requêtes en français naturel (« format
cartes compatibles tous formats ») ne remontent **ni** `decision-1009` **ni** `decision-276` — elles
se noient dans les mots communs. Les identifiants du code touchent du premier coup :
`maxPokemonPerTeam`, `teamCount`, `spawns_1v1`. **Avant d'affirmer qu'un fait n'est pas dans le
graphe, chercher avec les identifiants du code, pas avec la phrase de la conversation.**

Ce qui reste vrai, et qui est une autre affaire : `maxPokemonPerTeam` est **déduit**
(`parse-spawns-layer.ts:200-201`, `min(positions de spawn, MAX_POKEMON_PER_BATTLE / camps)`). Le
choix du format est donc le choix du **nombre de camps**, le nombre de Pokemon suit.

## Étape 3 — Un bouton « Coller »

L'humain demandait « des instructions pour dire qu'on peut coller ». Un bouton vaut mieux qu'une
instruction : il marche aux quatre entrées, il est découvrable, et il n'y a rien à expliquer. Il est
en plus le **symétrique du « Copier »** que l'hôte a déjà dans son encart de salon
(`RoomPanel.ts`, `room.copy`).

`pasteCode()` existe déjà dans `code-wheel-model.ts` — c'est du câblage, pas une mécanique nouvelle.

Motif supplémentaire, mesuré : l'astuce clavier actuelle (`lobby.wheelHint`) est **masquée sous
`pointer: coarse`** (`lobby.css`, à raison — il n'y a pas de flèches au doigt). Donc aujourd'hui, sur
téléphone, il n'y a **aucune** indication de saisie.

## Étape 4 — La roue défilable au doigt

Demande de l'humain, avec « un effet joli ». C'est le seul point du plan qui demande du vrai travail
d'animation.

Aujourd'hui un emplacement est un `<button>` découpé en **trois zones de tape** (voisin du haut,
caractère courant, voisin du bas), d'où le plancher de 90 px sous `pointer: coarse` — 3 × 30 px.

Ajout : un glissement vertical **à seuil**.

- Sous le seuil → c'est une tape, **comportement actuel inchangé**.
- Au-delà → l'alphabet défile en continu en suivant le doigt, puis **s'accroche** à la lettre la plus
  proche au relâchement. Effet de molette.
- Gratuit au passage : la molette de souris sur l'emplacement survolé.

🔴 Contrainte à ne pas perdre : les trois zones de tape et le plancher de 30 px chacune. Le
glissement s'ajoute, il ne remplace pas.

Seuil, amortissement et comportement d'accrochage **à trancher en implémentant**, à la mesure et pas
au jugé. Chercher d'abord s'il existe déjà une mécanique de défilement à réutiliser dans la vue.

## Étape 5 — La modale de refus, et le refus prononcé **avant** de naviguer

Deux changements, indissociables.

**Où.** On tente la connexion **avant** de quitter le lobby : le joueur ne part sur l'écran de
sélection d'équipe que si la partie existe. Sur refus il est toujours devant sa roue, et il corrige.
Demande un état d'attente dans le lobby (« Connexion… ») pendant la tentative.

**Quoi.** Une modale par-dessus le lobby, via `packages/ui-dom/src/Modal.ts`, qui existe déjà
(`<dialog>` natif, `showModal()`, restaure le focus précédent à la fermeture).

**Sortie : les boutons dépendent de la cause.** Arbitré avec l'humain.

| Cause (`NetworkErrorCode`) | Message existant | Bouton |
|---|---|---|
| `CodeIntrouvable` | Ce code ne correspond à aucune partie. | Réessayer |
| `SalonPlein` | Cette partie est complète. | Réessayer |
| `PartieCommencee` | Cette partie a déjà commencé. | Réessayer |
| `DelaiDepasse` | Plus de réponse. Réessayez. | Réessayer |
| `VersionIncompatible` | Vos versions du jeu diffèrent. Rechargez la page. | Retour au menu |
| `ConnexionImpossible` | Connexion impossible entre vos deux réseaux. | Retour au menu |

« Réessayer » referme et repose le focus sur le premier emplacement de la roue. Échap et B font de
même.

Les six libellés existent déjà (`room.error.*` dans `fr.ts:256-261`) : rien à rédiger, tout à
déplacer.

## 🔴 Étape 6 — Le contexte `modal` du système d'entrée

Le système d'entrée **n'a pas de contexte `modal`** : `InputContext | "screen"`
(`input-system.ts:20`), et aucun consommateur ne déclare autre chose que `"screen"`. Une modale
posée sans ça est un écran que la manette ne sait pas atteindre — **fail bloquant** de la recette
multi-entrée.

C'est une pièce d'infrastructure, et le **plan 208 en a besoin aussi** (la carte en modale). Elle est
posée ici, une fois.

## Étape 7 — L'écart de taille dans l'encart de salon

Retour de l'humain : « trop de différence de taille entre *Code de la partie* et le code ».
Mesuré — étiquette à `--font-size-sm`, valeur à `clamp(22px, 3.4vmin, 44px)` en gras avec
interlettrage : jusqu'à **3× d'écart** en 4K.

Étiquette montée d'un cran, valeur redescendue (~`clamp(20px, 2.6vmin, 34px)`). Elle doit **rester
lisible depuis un téléphone tenu à côté de l'écran** — c'est la raison d'être du gros corps
(`team-select.css:461`), on la réduit sans la perdre. Valeur exacte à mesurer au chrome-devtools à
1920×1080 et 2560×1440 avant de finaliser.

### 🔴 Et le format rendu réellement visible, dans le même geste

Ajouté après la revue de game-designer, qui a relevé un **défaut de séquencement** : l'étape 2
retire la seule mention du format **avant** que le joueur investisse du temps dans sa composition. Le
plan 208 devait fournir la mention visible en refaisant le bandeau — mais 207 sort d'abord, et entre
les deux le format ne serait rappelé que par la ligne discrète en lecture seule de l'encart.

Le risque, concret : un joueur qui vient du **solo**, où cinq formats de camps sont offerts, crée un
salon en ligne en pensant inviter plusieurs amis, et ne le découvre qu'en partageant son code.

L'encart de salon est déjà rouvert par cette étape 7 : le format y est donc rendu **franchement**
lisible ici, pas au plan 208. Ce n'est pas reportable — c'est la condition qui rend le retrait de
l'étape 2 acceptable.

## Ce qui n'est PAS dans ce plan

- Le sélecteur de format de la salle d'attente. L'humain l'a cru disparu ; il est **retiré
  volontairement en ligne** (décision #896 — le nombre de camps est gravé au lobby, le sélecteur
  disparaît au lieu de s'afficher grisé) et le « Format » reste rappelé en lecture seule dans
  l'encart. Rien à corriger, sinon que l'encart ne le dit pas assez fort — à voir au plan 208, qui
  refait cet encart.
- La carte en modale, le bandeau de partie en solo, le bouton « Créer une partie en ligne ».
  → plan 208.

## Recette

Passe multi-entrée **mesurée** avant de déranger l'humain (`.claude/rules/multi-input.md`) : le diff
touche `packages/app/src/ui/**` et `packages/app/src/styles/**`.

- **Clavier** : les deux panneaux, « Coller », « Réessayer » atteints aux flèches par de vraies
  pressions depuis un contrôle voisin. Jamais `.focus()` sur la cible.
- **Manette** : idem, et **la modale en particulier** (étape 6). B referme.
- **Tactile** : les trois zones de tape à ≥ 30 px sous `pointer: coarse`, le glissement qui ne les
  mange pas, « Coller » et les boutons de modale au plancher.
- **Responsive** : 568×320, 667×375, 1024×768, 1920×1080, 2560×1440. **568×320 est le cas dur** —
  voir l'avertissement de l'étape 1.

Scénarios pour l'humain, un à la fois : code incomplet, code bidon complet (→ modale « Réessayer »,
et on **reste** dans le lobby), collage, glissement au doigt, et l'encart de salon côté hôte.
