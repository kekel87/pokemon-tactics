# Séquence d'intro — produire la vidéo et les captures

Comment refabriquer, à l'identique, la **bande-annonce** du jeu et les **captures** qui alimentent le
README, le wiki et itch.io. Plan d'origine : `docs/plans/194-sequence-intro-captures.md`.

> Tout se joue **à la manette** et **en anglais**. Ce sont deux décisions de l'humain, pas des détails
> d'implémentation : la manette rend le liseré de focus visible à l'image (on comprend qu'un joueur
> navigue), l'anglais vise le public d'itch.io.

## Refaire tous les livrables — la marche à suivre

Quatre commandes, dans cet ordre. La première dure ~4 min (elle joue vraiment la partie), les trois
autres moins d'une minute chacune.

```bash
pnpm capture:intro      # 1. joue la séquence → vidéo brute + 52 captures + beats.json
pnpm capture:trailer    # 2. bande-annonce montée → .captures/intro-trailer.mp4
pnpm capture:release     # 3. livrables de publication → .captures/release/
pnpm capture:gifs       # 4. (optionnel) GIFs des moments clés → .captures/gif/
```

### Ce que ça produit, et où ça va

| Fichier | Destination | Notes |
|---|---|---|
| `.captures/intro-trailer.mp4` | **YouTube** (non répertorié) | ~1 min 40, 1920×1080, H.264, sans son |
| `.captures/release/combat.gif` | **page itch.io** | tout le combat, **accéléré ×2** pour tenir sous 3 Mo |
| `.captures/release/01-map-select.png` | itch.io, wiki, README | sélecteur de terrain |
| `.captures/release/01b-map-select-cave.png` | *variante* | plus vendeuse, mais étiquettes en français (bug au backlog) |
| `.captures/release/02-team-builder.png` | itch.io, wiki, README | constructeur d'équipe, build appliqué |
| `.captures/release/03-twelve-players.png` | itch.io, wiki, README | sélection d'équipe en 12 joueurs |

⚠️ **Limite itch.io : 3 Mo par image, GIF compris.** `capture:release` cherche le meilleur réglage qui
tient dans le budget (2,8 Mo par défaut, pour garder une marge au téléversement manuel) et **annonce ce
qu'il a sacrifié**. `--budget-mb=3` colle à la limite : 420 px au lieu de 360, à 2,99 Mo.

Les captures fixes sont **copiées depuis les PNG de la séquence**, pas extraites du mp4 : même instant,
1920×1080 sans perte, sans la compression H.264 qui fait baver le pixel art et les petits textes.

### Choisir un autre instant, un autre plan

Tout se règle par des **noms de beats** (`combat`, `carte-retenue`, `build-applique`… sans leur rang,
qui bouge) :

- la bande-annonce : `TIMELINE` dans `scripts/build-intro-trailer.ts` — un tableau ORDONNÉ de plans
  (`titleDrop`, `card`, `clip`, `platforms`, `endTitle`), indépendant de la chronologie du tournage ;
- les captures livrées : `SCREENSHOTS` dans `scripts/build-release-assets.ts` ;
- les GIFs courts : `GIFS` dans `scripts/build-intro-gifs.ts`.

Un nom de beat absent du manifeste **fait échouer** le montage en listant les noms disponibles — jamais
un chapitre silencieusement vide.

## Les autres commandes

```bash
pnpm capture:video            # coupe brute des temps forts (outil de vérification)
pnpm capture:video --captions # incruste des cartons de texte (habillage provisoire, jugé laid)
pnpm capture:video --full     # l'intégrale, pour vérifier un plan qu'on croit raté
pnpm capture:video --webm     # ajoute une sortie VP9 à côté du mp4
```

`capture:video` **ne garde que les instants nommés** (fenêtre autour de chaque beat, fenêtres qui se
chevauchent fusionnées) et **n'incruste aucun texte**. L'intégrale contient les tours joués pour amener
le plateau dans un état filmable : utile à la vérification, pas à la publication.

`capture:intro` démarre son propre serveur Vite sur **port du checkout + 2000** (5173 → 7173), avec
`VITE_E2E=true`. Le décalage est là pour qu'une capture puisse tourner pendant que le gate e2e
(+1000) ou le serveur de développement de l'humain (port nu) occupent déjà le leur.

## Ce qui sort, et où

| Chemin | Contenu |
|--------|---------|
| `.captures/artifacts/**/video.webm` | vidéo brute Playwright, 1920×1080, sans son |
| `.captures/intro.mp4` | montage des temps forts, cartons incrustés (~22 Mo, H.264) |
| `.captures/intro-full.mp4` | l'intégrale, avec `--full` |
| `.screenshots/intro/NN-slug.png` | une capture par beat, numérotée dans l'ordre de la séquence |
| `.screenshots/intro/beats.json` | manifeste : seed, issue du combat, et l'instant de chaque beat |
| `.screenshots/intro/focus-trace.txt` | où le focus a atterri, cran par cran — **l'outil de debug** |

## Pourquoi c'est reproductible

Trois verrous, tous nécessaires :

1. **Les équipes sont injectées** dans `localStorage` avant le boot (`e2e/capture/teams.ts`), avec des
   horodatages figés. L'éditeur d'équipe s'ouvre déjà peuplé.
2. **Le seed du combat est forcé** par `?seed=` (`packages/app/src/capture-seed.ts`) : mêmes dégâts,
   mêmes critiques, mêmes ratés à chaque run.
3. **Les deux camps sont humains**, avec des équipes sauvegardées. Un camp laissé à l'IA reçoit une
   équipe **tirée au hasard** (`buildInitialSlots` → `generateRandomTeam`), que le seed d'URL
   n'atteint pas — il n'alimente que le moteur. L'adversaire changerait à chaque run.

> 🔒 `?seed=` est verrouillé sur `DEV` ou `VITE_E2E`. Dans un build publié, `forcedBattleSeed()`
> renvoie toujours `null` et le drapeau est éliminé du bundle (vérifié par grep après `pnpm build` :
> `forcedBattleSeed`, `VITE_E2E`, `get("seed")` → 0 occurrence). **Ce mode ne doit jamais partir en
> production.**

## Structure

```
e2e/capture/
  intro.capture.ts   # la chorégraphie, de bout en bout — c'est le fichier qu'on modifie
  pad-nav.ts         # navigation des MENUS à la manette (focus DOM)
  combat-pad.ts      # pilotage du COMBAT à la manette (curseur de case, phases)
  teams.ts           # les deux équipes 6v6
  en-locators.ts     # libellés anglais, relevés dans locales/en.ts
  beats.ts           # capture + horodatage d'un instant nommé
playwright.capture.config.ts
scripts/build-intro-video.ts
```

Ce **n'est pas** une suite de tests, et c'est pour ça que la configuration est séparée : les `expect`
présents n'attendent qu'un écran réellement monté avant de le filmer. La séquence ne tourne **jamais
dans le gate**.

## Modifier la chorégraphie

Tout est dans `intro.capture.ts`, dans l'ordre où ça passe à l'image. Les constantes en tête disent
quoi montrer : `BROWSED_MAPS`, `BATTLE_MAP`, `SWAPPED_IN`, `SWAPPED_ITEM`, `SWAPPED_MOVE`,
`MAX_FORMAT`, `BATTLE_FORMAT`, `BATTLE_SEED`.

Deux règles de fer :

- **Jamais de clic.** Le premier `.click()` remet `data-input-source` sur la souris et le liseré de
  focus disparaît d'un coup à l'image. Même raison pour `clickTile()` du hook e2e : il court-circuite
  la couche d'entrée.
- **Décrire la CIBLE, jamais compter les crans.** `padMoveTo(page, "down", "Attack")` échoue
  franchement si la cible n'est pas atteinte ; compter des pressions casse en silence dès qu'une
  entrée est ajoutée au DOM (le focus atterrit ailleurs et `A` valide autre chose).

### Quand ça casse

1. Lire `.screenshots/intro/focus-trace.txt` : la dernière ligne dit où le focus s'est arrêté.
2. Comparer avec la cible attendue dans le message d'erreur.
3. Regarder la dernière capture numérotée : elle montre l'écran au moment du blocage.

## Pièges de navigation déjà payés

Chacun a coûté un run. Ils sont **mesurés**, pas déduits.

| Ce qu'on croit | Ce qui se passe |
|---|---|
| Les flèches parcourent le DOM dans l'ordre | La navigation des écrans est **spatiale** (`focusInDirection`), avec pénalité ×2 hors axe, et **ne boucle pas** |
| « bas » depuis un bouton d'équipe atteint la rangée Humain / IA d'en dessous | Non : elle file sur le bouton d'équipe suivant (pleine largeur, donc centré, donc plus proche au sens spatial). Il faut y aller **horizontalement** |
| Le menu de combat se parcourt comme un écran | Non : `focusMenuStep` **boucle** modulo le nombre d'entrées, et seules ↑ ↓ y font quelque chose |
| Un maintien de bouton vaut une tape | Le **déplacement** de focus part au front descendant, l'**activation** au relâchement : maintenir empêche l'activation qu'on attend |
| Une tape suffit partout | Sur un écran **sans rendu Babylon** (menus, éditeur d'équipe), le navigateur ralentit les frames et une tape tombe entre deux lectures du poller — il faut maintenir |
| Sur l'écran de carte, `A` vise un bouton | Non : la sélection de carte n'a **pas** de focus DOM ; `A` appelle directement `confirmSelection()` |
| Le curseur de case suit les axes de la grille | Non : chaque pression **projette les quatre voisins** et garde le meilleur selon l'écran. Le pas dépend de l'azimut → `combat-pad.ts` le **mesure** et jette la mesure à chaque rotation |
| `__ptE2e__.isReady()` dit « le combat a démarré » | Non : l'écran de choix de carte bâtit son aperçu 3D avec `createCombatScene`, donc le hook est déjà là et **survit à son `dispose()`**. Le signal de démarrage est le **menu d'actions** (dette notée au backlog) |
| Les PV d'un ennemi se lisent comme ceux d'un allié | Non : sous **brouillard** (plan 176) un ennemi affiche « 79% » et **pas** « 142 / 180 ». Lire la fraction seule renvoie 100 % pour tout le monde → aucun ciblage du blessé, aucun K.O. |
| La rangée des builds n'est pas atteignable à la manette | Elle l'est : « bas » depuis les curseurs de points y descend. Mais elle est **horizontale** — insister vers le bas n'y déplace plus rien, il faut « droite » |
| Un chemin de focus qui marche reste vrai | Non : corriger le focus du sélecteur de format a fait que « droite » ne sortait plus de la rangée, alors que c'était le chemin de la veille. D'où `padReach`, qui essaie les directions plausibles et échoue en disant lesquelles |
| Un beat suffit à filmer ce qu'il nomme | Pas si l'action ANIME avant la pause : le pilote de déplacement attend le retour du menu, donc la fin du glissé, avant de rendre la main. Le beat ne portait que l'après, et le Pokemon paraissait se téléporter → `recorder.mark()` avant l'action, `capture(..., { sinceMark: true })` après |
| Le tour filmé est stable d'un run à l'autre | Non : il est **sélectionné** par des conditions, donc changer une condition change le Pokemon, l'attaque, et tout le combat qui suit — à seed identique. D'où la **préférence de lanceur** (`PREFERRED_CASTER`), avec repli |
| Le curseur existe pendant le menu d'actions | Non : la fin de tour l'efface (`pinCursor(null)`), il ne se repose qu'à l'entrée d'une phase de plateau, sur le Pokemon qui joue |

## Le K.O. n'est pas garanti — et le manifeste le dit

Un coup fort enlève ~100 PV sur 181 : il faut **deux coups sur la même cible**. Le pilote **concentre
donc le feu** (il revient sur le dernier Pokemon touché) — sans ça, douze tours d'échanges se sont
soldés par **zéro K.O.**, les dégâts s'étant répartis sur six adversaires.

Même ainsi, le budget de tours peut s'épuiser avant. Le champ `outcome` de `beats.json` dit ce qui a
été filmé (`battleOver`, `spritesLeft`), et le dernier carton s'adapte : « Until one side falls » si un
Pokemon est tombé, « Six against six » sinon. **Ne pas écrire un carton qui promet ce que l'image ne
montre pas.**

## Le montage

`scripts/build-intro-video.ts` lit `beats.json` et calcule un `drawtext` par carton — apparition et
disparition en fondu sur `alpha`, jamais sur `enable` (qui ferait clignoter le texte).

- **Encodeur : `libopenh264`.** Le ffmpeg de la machine est bâti **sans `libx264`**. OpenH264 sort un
  H.264 que itch.io et tous les navigateurs lisent, ce que ni AV1 ni VP9 ne garantissent encore. Les
  encodeurs matériels (`h264_nvenc`, `h264_vaapi`) iraient plus vite mais lieraient la sortie au GPU
  de la machine.
- **Un beat est horodaté à la FIN de sa pause de cadence**, donc l'état qu'il nomme (journal ouvert,
  infobulle affichée) occupe l'intervalle qui le **précède** — la séquence le referme juste après. Le
  manifeste porte donc `leadMs`, la durée de cette pause, et le montage cale la fenêtre **avant** le
  beat. Une fenêtre centrée sur le beat filmait l'écran d'après, carton compris.
- **Décalage vidéo / manifeste : −110 ms, mesuré** (PSNR entre une capture de beat et la vidéo source,
  image par image), pas estimé. Corrigeable par `pnpm capture:video --offset-ms=…` si l'écart change.

## Le combat filmé : UN tour, et un seul

Périmètre posé par l'humain (2026-08-28) : **un déplacement, une attaque, une rotation de caméra, une
fin de tour**, dans un combat **déjà engagé**, et **sans montrer le tour de l'adversaire**.

D'où la forme : la séquence joue d'abord les tours nécessaires **sans rien filmer** — les camps
démarrent aux deux bouts du plateau (~15 cases, quand une attaque porte à 4) — puis elle filme **un
seul tour du camp 1**, d'un trait : rotation de caméra, déplacement, attaque, fin de tour. Tout tient
dans ce tour, ce qui garantit qu'aucun tour adverse ne s'y glisse.

Le tour filmé est choisi sur trois conditions : c'est **notre camp**, le menu offre **encore le
déplacement**, et **un adversaire est à portée**. Se déplacer ne consomme pas l'action, donc l'attaque
suit dans le même tour.

Dans le constructeur d'équipe, la séquence **applique** un build (preset « Spec Sweeper » sur Mewtwo) :
les curseurs de points bougent à l'image, ce qui dit ce qu'est un build mieux qu'une fiche contemplée.

⚠️ **Un déplacement ne demande pas d'orientation d'arrivée** — A lance directement le glissé. Seul
« Attendre » ouvre le choix d'orientation, et c'est lui qui sert de plan « fin de tour ».

## Ce que la séquence montre, dans l'ordre

Menu → constructeur d'équipe (fiche d'un Pokemon, ajout de Mewtwo, objet, attaque, budget de
statistiques) → mode de combat → choix de carte (deux arènes parcourues, retour sur Arène Simple) →
formats (jusqu'à 12J × 1, retour en 2J × 6) → les deux camps et leurs équipes → **un tour de combat** :
rotation de caméra, déplacement, attaque (infobulle, visée, prévision de dégâts, impact), fin de tour.
