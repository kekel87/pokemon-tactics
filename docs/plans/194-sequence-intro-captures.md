# Plan 194 — Séquence d'intro : bande-annonce et captures reproductibles

- **Statut** : `in-progress` (2026-08-28) — **volet menus/constructeur LIVRÉ et validé à l'œil par l'humain** ; **volet combat implémenté**, en attente de validation humaine. Montage ffmpeg et doc/skill livrés (§10, §11).
- **Origine** : entrée « Scénario de combat piloté Joueur vs Joueur (QA + captures) » de `docs/backlog.md` (2026-06-18), dernier item actionnable du backlog. Le périmètre a été **élargi par l'humain** en cours de cadrage : ce n'est plus un scénario de QA, c'est la **séquence d'intro du jeu**.

## 1. Ce qui est demandé, et ce que ce n'est pas

Demande de l'humain, dans ses termes : un scénario **piloté, visuel, reproductible**, qui serve de **vidéo d'intro** — passage rapide dans l'éditeur d'équipe (modèle du Pokemon, attaques, objets, un build), puis un combat, avec la possibilité d'**arriver au milieu d'un combat avancé**, une attaque montée, la prévisualisation, la rotation de caméra. Plus des **transitions** et **un peu de texte** de présentation. Et des **captures** au passage. En **6v6**.

Deux refus explicites, à ne pas réintroduire :

- **Pas le bac à sable.** « c'est pas la bonne interface » — son panneau de studio pollue toute image. Tout passe par le parcours normal : menu → mode local → carte → équipes → placement → combat.
- **Pas le seed en production.** Vigilance de l'humain, et garde déjà en place, voir §3.

## 2. Pourquoi c'était infaisable avant, et ce qui l'a débloqué

| Obstacle | Résolution |
|---|---|
| Un combat normal tire `seed: randomSeed()` (`crypto.getRandomValues`) → deux runs donnent des dégâts et des critiques différents, donc des images différentes | `?seed=` forçable en local (§3) |
| Scripter un combat jusqu'à un état « avancé » demanderait des dizaines d'actions, fragiles au moindre changement de mécanique | **Le journal de reprise du plan 181** : `{ seed, actions }` en `localStorage` rejoue une partie dans la vraie interface. On enregistre une fois, on rejoue à l'identique ensuite |
| Transitions et texte incrustés | **ffmpeg 8.1.2** est disponible : post-production sur la vidéo enregistrée par Playwright, aucun élément parasite injecté dans le DOM du jeu pendant la capture |
| 6v6 | Les **9 cartes** portent un `objectgroup` `spawns_12p` (12 participants) — aucune carte à produire |

## 3. Le seed, et sa garde — vérifié, pas supposé

`packages/app/src/capture-seed.ts` expose `forcedBattleSeed()`, consulté par `randomSeed()` dans `combat-screen.ts`. Garde : `import.meta.env.DEV || import.meta.env.VITE_E2E === "true"` — la même que le boot bac à sable par URL.

**Preuve sur le bundle publié** (`pnpm build`, 4,2 Mo) :

| Recherche | Occurrences |
|---|---|
| `forcedBattleSeed` | **0** |
| `get("seed")` | **0** |
| `VITE_E2E` | **0** |
| `getRandomValues` (chemin normal) | 1 |

Vite remplace les deux drapeaux à la compilation par `false`, Rolldown élimine la branche. Et aucun workflow de `.github/workflows/` ne pose `VITE_E2E` ni `VITE_SANDBOX` : les builds GitHub Pages et itch.io n'ouvrent jamais cette porte.

**Exposition résiduelle, dite honnêtement** : un `VITE_E2E=true pnpm build` lancé à la main et publié ouvrirait la porte. C'est vrai du bac à sable depuis toujours. Aucun automatisme ne le fait.

## 4. Le roster vitrine — 6v6, identifiants validés

Tous les identifiants sont **vérifiés apprenables ET implémentés** (croisement `learnset` × `packages/core/src/battle/moves/*.test.ts`), jamais recopiés de mémoire — la règle tirée trois fois de cette session.

Camp 1 et camp 2 en 6v6, choisis pour la variété de silhouettes et de types (l'humain a demandé « des Pokemon stylés »).

## 5. Architecture de capture

```
e2e/capture/                        ← séparé des tests : ce n'est pas une suite qui passe/échoue
  teams.ts                          12 builds validés + injection localStorage
  beats.ts                          capture + horodatage d'un instant nommé
  en-locators.ts                    libellés anglais, relevés dans locales/en.ts
  pad-nav.ts                        navigation des MENUS à la manette (focus DOM)
  combat-pad.ts                     pilotage du COMBAT à la manette (curseur de case, phases)
  intro.capture.ts                  la chorégraphie, de bout en bout
playwright.capture.config.ts
scripts/build-intro-video.ts        cartons de texte + encodage (pnpm capture:video)
```

*(Le `post/` annoncé au cadrage n'existe pas : un seul script suffit, et il vit avec les autres
scripts du dépôt.)*

- **Playwright** enregistre la vidéo (`video: "on"`, viewport fixe) et prend les captures aux beats nommés.
- **Les équipes sont injectées** dans `localStorage["pokemon-tactics:teams"]` avant le boot (`addInitScript`), donc l'éditeur d'équipe s'ouvre déjà peuplé — on le *montre* sans avoir à le *remplir*.
- **ffmpeg** assemble : découpe aux beats, transitions, cartons de texte.
- **Sorties** : images dans `.screenshots/` (convention du dépôt), vidéo à côté.

## 6. Les beats

1. **Éditeur d'équipe** — le build déjà en place : modèle du Pokemon, ses 4 attaques, son objet tenu, son talent
2. **Lancement** — carte, format 6v6, les deux camps
3. **Coupe dans un combat avancé** — via le journal de reprise
4. **Une attaque montée** — menu, infobulle avec les valeurs effectives (plan 192), prévisualisation de dégâts
5. **Rotation de caméra** — la signature visuelle qu'aucune capture statique ne rend
6. **Impact et K.O.**

## 7. Étapes

1. ✅ `?seed=` local, avec preuve sur le bundle
2. ✅ Les 12 builds validés + injection `localStorage`
3. ✅ Projet Playwright `capture` (vidéo, viewport fixe, pas dans le gate)
4. ✅ Le pilote et ses beats nommés
5. ❌ **Écarté** — journal de reprise pour la coupe en combat avancé. Voir §10 : le combat s'avance en le JOUANT
6. ✅ Validation humaine du volet menus (2026-08-27, cinq allers-retours de retours — voir §9)
7. ✅ Volet COMBAT : combat avancé, attaque montée, infobulle, prévisualisation, rotation caméra (§10)
8. ✅ Montage ffmpeg : cartons incrustés (`pnpm capture:video`)
9. ✅ Doc + skill reproductibles : `docs/capture-sequence.md`, `/capture-intro`
10. ⬜ Validation humaine du volet combat
11. ⬜ Refonte des 5 visuels README/wiki à partir des captures

## 8. Ce que ça débloque

Les 5 images `docs/images/*-screenshot.png` sont encore en **rendu Phaser** (reporté depuis le 2026-06-16, captures automatiques rejetées par l'humain). Une séquence reproductible dans la vraie interface les remplace, et fournit en plus la matière du devlog itch.

## 9. Volet menus — livré (2026-08-27)

### Comment ça se lance

```bash
pnpm capture:intro                                   # 1920×1080, ~58 s
PT_CAPTURE_WIDTH=3840 PT_CAPTURE_HEIGHT=2160 pnpm capture:intro   # autre résolution
```

Sorties : `.captures/intro/sequence-intro.webm` (vidéo) et `.screenshots/intro/` (33 PNG +
`beats.json` avec les repères temporels + `focus-trace.txt`). Les deux dossiers sont ignorés par git.

**1920×1080 est acté** (contrainte itch.io, décision humaine). **Tout est en anglais** — locale
`en-US` **et** `pt-lang=en` : la vidéo et les captures visent itch.io et le README.

### Tout est piloté à la MANETTE, et c'est le point clé

Un `.click()` de Playwright ne montre ni curseur ni focus : à l'image, les écrans changeaient seuls et
on ne comprenait pas qu'un joueur navigue (retour humain). La manette synthétique pose
`data-input-source="gamepad"` sur `<html>`, ce qui allume `[data-input-source="gamepad"] :focus` — un
liseré visible qui se déplace de contrôle en contrôle.

⚠️ **Ne jamais mélanger clics et manette** dans une séquence : le premier clic remet la source sur la
souris et le liseré disparaît d'un coup à l'image.

### Ce qu'il a fallu comprendre du jeu pour y arriver

| Découverte | Conséquence pour le pilote |
|---|---|
| **La navigation est SPATIALE** (`focusInDirection`) : contrôle le plus proche dans la direction, pénalité ×2 hors axe, **pas de bouclage** | On ne compte pas des crans, on décrit une cible (`padMoveTo`). Et la position à l'ÉCRAN dicte la direction : la carte du 6ᵉ slot étant à droite, « bas » y trouve la colonne des statistiques — il faut longer la rangée à gauche **sans valider** puis descendre |
| **`withFakeGamepad` passe par `addInitScript`** | À installer **avant** le premier `goto`, sinon la manette n'existe pas |
| **Le déplacement de focus se déclenche au front, l'ACTIVATION au relâchement** | `holdPadUntil` pour bouger, **tape répétée** pour valider — un maintien attendait un effet que le maintien empêchait |
| **Choix de la carte** : les flèches déplacent la SÉLECTION, jamais le focus DOM (plan 184) ; `A` sans focus confirme directement | `padSelectUntil` observe l'état de l'écran, pas le focus |
| **Sélection d'équipe** : la navigation verticale ne couvre que « Back » et « Auto placement » ; les cartes de joueur ne sont atteignables qu'**horizontalement** | Le bouton d'équipe se rejoint par la droite |
| Le champ de recherche d'un sélecteur porte `data-nav-skip="gamepad"` et la manette entre sur le **premier résultat** | La recherche se remplit par frappe (`pressSequentially`, visible à l'image), pas par navigation |

Ces éléments sont écrits ici parce qu'ils ne se devinent pas : chacun a coûté un run pour être mesuré.

### L'outil qui a rendu ça possible

`e2e/capture/pad-nav.ts` — navigation **déclarative** (« va au contrôle nommé X ») plutôt qu'un compte
de crans, et une **trace des focus** écrite au fil des déplacements dans
`.screenshots/intro/focus-trace.txt`, donc lisible même quand la séquence échoue. C'est elle qui a
révélé chacune des lignes du tableau ci-dessus.

Deux pièges de la trace, corrigés :
- le contexte d'un contrôle remonte **parent + grand-parent**. Ni l'un ni l'autre ne suffit : le « × »
  d'un slot est un FRÈRE de la carte (conteneur nu), et le bouton « Edit » d'une carte d'équipe a pour
  parent la rangée d'actions.
- une cible `libellé|contexte` vérifie ses deux parties **séparément** (libellé exact, contexte par
  sous-chaîne). Une sous-chaîne sur la signature entière échouait, et une sous-chaîne trop large
  matchait n'importe quoi — c'est ce qui faisait que `team-slot-card|Charizard` désignait toutes les
  cartes (le grand-parent contient toute la rangée) et que le focus ne bougeait jamais.

### Faux positifs attrapés, et comment

- **Cinq captures de formats identiques** (30,9 K chacune) : mon prédicat vérifiait que le conteneur
  *contient* le libellé — vrai d'avance, il liste tous les formats. Repéré en comparant les **tailles
  de fichier**, pas à l'œil. Corrigé en lisant `[data-state="active"]`.
- **Une variable capturée par fermeture dans `evaluate`** n'existe pas côté navigateur : la
  comparaison était toujours fausse. Il faut la passer en argument.
- **Un blocage attribué à tort à la navigation** : « Dragon Pulse » n'est pas apprenable par Mewtwo, la
  liste filtrée était vide, donc plus aucun candidat sous le dernier filtre. La cause était la
  **donnée**, pas le focus. D'où la règle : valider apprenable ET implémenté, par script.

### Séquence retenue

| Bloc | Contenu |
|---|---|
| Menu | le liseré descend jusqu'à « Team Builder » |
| Équipe | semée à **5 membres**, le 6ᵉ slot volontairement vide |
| Construire | grille des 151 → recherche « Mewtwo » → ajouté → **Expert Belt** → **Aura Sphere** → panneau de build |
| Carte | deux crans (Forest, Cramped Cave) puis retour sur **Simple Arena**, la plus lisible pour le combat |
| Format | **12J × 1** puis retour au 2J × 6 |
| Équipe | modale tenue ~2 s, « Blaze & Psy » assignée |

Le 6ᵉ slot laissé vide est un choix : ouvrir un slot vide donne directement la grille, ce qui se lit
mieux que « vider un slot pour le remplir » — et évite le bouton « × », qui ne s'active pas au dpad.

## 10. Volet combat — implémenté (2026-08-28)

### Le journal de reprise : écarté, et pourquoi

Le §2 promettait de couper dans un combat avancé en **rejouant le journal du plan 181**
(`pt-battle-resume`). Écarté après lecture du mécanisme, pour deux raisons dirimantes :

1. La sauvegarde porte `buildVersion` et est **rejetée si elle ne correspond pas au build courant**
   (`packages/app/src/app/battle-persistence.ts`) — c'est sa raison d'être : un changement de formule
   ferait diverger le rejeu en silence. Un journal figé dans un fichier de test **rouillerait à la
   première version**, et il faudrait le réenregistrer à chaque fois.
2. Elle n'est lue **qu'au démarrage suivant**, donc l'enregistrer supposait un run préalable dédié.

À la place, le combat s'avance **en le jouant**, à la manette, dans la vraie interface. Ce n'est pas
un contournement : c'est exactement ce que le journal aurait rejoué, sans le fichier à maintenir. Et
ça exerce le jeu au passage — deux bugs de navigation ont été trouvés comme ça.

### Deux camps humains, et c'est structurel

Un camp laissé à l'IA reçoit une équipe **tirée au hasard** (`buildInitialSlots` →
`generateRandomTeam`), que `?seed=` n'atteint pas : il n'alimente que le moteur de combat.
L'adversaire changerait donc à chaque run, et la promesse de reproductibilité tomberait. La séquence
passe donc le camp 2 en **Humain** et lui assigne « Fangs & Fists ».

Effet de bord heureux : c'est le **scénario joueur contre joueur** que le backlog réclamait à
l'origine, celui qui a lancé ce plan.

### Le pilote de combat — `e2e/capture/combat-pad.ts`

Séparé de `pad-nav.ts` parce que le combat ne se navigue pas comme un menu : hors des deux menus, les
flèches déplacent un **curseur de case** et `document.activeElement` ne bouge jamais. Trois lectures
suffisent à tout piloter — `cursorTile()`, `spriteStates()` (hook e2e, lecture seule) et le texte de
`combat-instruction` (la phase).

Ce qui a demandé une mesure, et non une déduction :

| Point | Ce qui se passe réellement |
|---|---|
| Pas du curseur | Chaque pression **projette les quatre voisins** et garde le meilleur selon l'écran : le pas dépend de l'azimut. Le pilote le **mesure** à l'exécution et jette la mesure à chaque rotation |
| Curseur en phase de menu | Il n'existe pas : la fin de tour l'efface (`pinCursor(null)`), il se repose à l'entrée d'une phase de plateau, **sur le Pokemon qui joue** — d'où on lit la case du lanceur |
| Portée d'attaque et de déplacement | Elles vivent dans le core, rien ne les expose. On **essaie** : sur une case invalide, A ne fait rien et l'étape ne change pas |
| PV d'un ennemi | Sous brouillard (plan 176) il affiche « 79% », **jamais** « 142 / 180 ». Lire la fraction seule renvoyait 100 % pour tout le monde, donc aucun ciblage du blessé |
| Cible d'attaque | Frapper **le plus proche** répartit les dégâts sur six adversaires : mesuré, douze tours d'échanges = **zéro K.O.** Le pilote **concentre le feu** sur le dernier Pokemon touché |
| Déplacement | **Indispensable.** Mesuré : en 6v6 sur Arène Simple les camps se posent aux deux bouts du plateau (~15 cases), la plus longue attaque du roster porte à 4. Sans déplacement, chaque tour conclut « Attendre » |
| « Le combat a démarré » | **Pas** `__ptE2e__.isReady()` : l'écran de choix de carte bâtit son aperçu 3D avec `createCombatScene`, donc le hook est déjà là et survit à son `dispose()`. Le signal est le **menu d'actions** (dette notée au backlog) |

### La chorégraphie filmée — UN tour, et un seul

Périmètre resserré par l'humain le 2026-08-28, après avoir vu la première version : « un déplacement,
une attaque, une rotation de caméra, une fin de tour et ça va très bien », dans un combat **déjà
engagé**, et **sans le tour de l'adversaire**. Ont donc sauté : les trois quarts de tour de caméra
(un seul suffit), le journal de combat, la seconde infobulle, et la chasse au K.O.

Les tours qui amènent les camps au contact sont joués **sans être filmés** ; puis **un seul tour du
camp 1** est filmé d'un trait : rotation de caméra, déplacement (menu, cases accessibles, glissé),
attaque (infobulle au focus, visée, prévision de dégâts, impact), fin de tour. Tout tenant dans un même
tour, aucun tour adverse ne peut s'y glisser.

### Ce que le combat a appris — mesuré, jamais déduit

Cinq points, chacun ayant coûté un run de cinq minutes, et le dernier une **sonde jetable sur le bac à
sable** (même interface, boot en six secondes) qui a répondu ce que six runs n'avaient pas dit :

| Ce qu'on croyait | Ce qui est vrai |
|---|---|
| `spriteStates().pokemonId` porte le camp | C'est l'identifiant de **définition** (« snorlax »). Le camp déduit d'un préfixe donnait un camp par Pokemon, donc un pilote qui **attaquait ses propres alliés**. La capture fournit la table |
| Un déplacement demande une orientation d'arrivée | **Non** : A sur la destination lance directement le glissé. Attendre `selectFacing` faisait conclure « destination refusée » sur des déplacements pourtant exécutés — **aucun** déplacement reconnu pendant six runs |
| « Quelqu'un occupe la case visée » prouve le déplacement | Non : un autre Pokemon peut déjà y être. Trente-trois « déplacements » réussis pour un Pokemon resté sur sa case |
| B ramène toujours au menu d'actions | Au menu racine, B **ouvre le menu de combat** (plan 187), dont le focus capture la croix — le focus se retrouvait sur « Quitter » |
| Une attaque « utilisable » peut viser un adversaire | `data-enabled` dit seulement que le jeu a trouvé **une** cible : un soin qui ne porte que sur un allié compte. D'où le repli d'une attaque sur la suivante |

Les PV d'un ennemi, eux, ne se lisent qu'en **pourcentage** (brouillard du plan 176) : lire la fraction
seule renvoyait 100 % pour tout le monde.

### Le montage — `pnpm capture:video`

`scripts/build-intro-video.ts` lit `beats.json` et **calcule** un `drawtext` par carton (fondu sur
`alpha`, jamais sur `enable`, qui ferait clignoter le texte).

Deux choses que le premier montage a apprises, mesurées et non déduites :

- **La sortie par défaut est un montage de TEMPS FORTS**, pas l'enregistrement intégral (dont la
  moitié est le remplissage de tours nécessaire à l'état du plateau). Les fenêtres viennent du
  manifeste ; celles qui se chevauchent fusionnent, pour ne pas couper deux fois dans le même plan.
  L'intégrale reste sous `--full`.
- **Aucun carton incrusté par défaut** (retour humain 2026-08-28 : les `drawtext` ont été jugés laids).
  Le vrai habillage viendra plus tard ; `--captions` remet l'existant. Les instants nommés restent le
  squelette du montage : ce sont eux qui décident des coupes.
- **Un beat est horodaté à la fin de sa pause de cadence**, donc l'état qu'il nomme le PRÉCÈDE. Le
  manifeste porte désormais `leadMs` et la fenêtre se cale avant le beat — sans quoi le carton
  « Every roll, written down » jouait sur un journal déjà refermé (vu à l'image, pas supposé).
- **Décalage vidéo / manifeste : −110 ms**, mesuré au PSNR entre une capture de beat et la vidéo
  source, image par image.

**Correction du §2** : ffmpeg est bien sans `libx264`, mais il a **`libopenh264`** — le mp4 est donc
possible, et c'est ce qui sort par défaut. Ni AV1 ni VP9 ne sont encore lisibles partout ; les
encodeurs matériels (`h264_nvenc`, `h264_vaapi`) lieraient la sortie au GPU de la machine.

## 11. Le montage — livré (2026-08-28)

Forme dictée plan par plan par l'humain : titre qui descend « comme le logo Nintendo quand on allume une
Game Boy », puis alternance carton de texte animé → séquence de jeu, un écran de plateformes en trois
colonnes, retour au titre. **Pas de son** (aucune source audio, et on n'ajoute pas d'asset non libre).

Trois scripts, une logique de découpage partagée (`scripts/intro-beats.ts`) :

| Commande | Sortie | Rôle |
|---|---|---|
| `pnpm capture:trailer` | `.captures/intro-trailer.mp4` | la bande-annonce habillée |
| `pnpm capture:release` | `.captures/release/` | le GIF du combat + les 3 captures de publication |
| `pnpm capture:video` | `.captures/intro.mp4` | coupe brute — outil de vérification |

Ce qu'il a fallu comprendre :

- **`xfade` mange la durée du raccord** : la sortie vaut `offset + durée(B)`, pas la somme. Un `offset`
  recalculé depuis les durées d'origine décale tout le film.
- **Un carton de texte ne se fait pas d'un seul `ffmpeg`** : le fond est fixe mais le texte s'anime, donc
  il faut un `t` qui avance. `-frames:v 1` sortait un carton d'UNE image que `xfade` avalait, et la
  bande-annonce tombait de cent à vingt-neuf secondes sans le dire.
- **L'ordre du montage n'est pas celui du tournage** : d'où une `TIMELINE` explicite, où chaque plan dit
  de quels beats il vient. Un découpage chronologique ne peut pas exprimer « le combat d'abord ».
- **Les fenêtres fusionnées sont plus grossières que les plans** : il faut les borner sur la fin du
  **beat** visé, sinon un plan déborde sur le chapitre suivant.
- **La planche Kenney n'a ni manette ni téléphone** : les deux sont dessinés en ASCII dans
  `scripts/trailer-icons.ts` (grille 16×16, comme les tuiles Kenney), rendus par sharp au plus proche
  voisin. Source de vérité lisible en diff, aucun binaire ajouté au dépôt.
- **itch.io plafonne à 3 Mo par image, GIF compris** (vérifié) : 35 s de combat n'y tiennent pas. La
  recherche de réglage descend en taille, en cadence, puis **accélère ×2** — ce qui garde tout le combat
  au lieu de le tronquer — et annonce le compromis retenu.

## 12. Reproductibilité — doc et skill

- **`docs/capture-sequence.md`** : les deux commandes, ce qui sort et où, les trois verrous de
  reproductibilité, comment modifier la chorégraphie, et le tableau des **pièges de navigation déjà
  payés** (un run chacun).
- **`/capture-intro`** (`.claude/skills/capture-intro/`) : rejoue la séquence et le montage, avec la
  marche à suivre en cas d'échec (trace de focus → dernière capture → lire la source).
