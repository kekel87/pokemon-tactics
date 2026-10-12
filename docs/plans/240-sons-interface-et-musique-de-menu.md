# Plan 240 — Sons d'interface, et réglages de la musique de menu

**Statut** : done (2026-10-12, revu par `plan-reviewer` et `game-designer`)
**Origine** : demandes de l'humain pendant le plan 239 (« des sons de menu/curseur seraient bien »,
« la musique du menu et les bips des touches configurables : choix du son et volume »), confirmées au
menu de finalisation du 2026-10-11 : plan à part, juste après le 239. Pour la musique de menu, l'humain
a retenu les trois réglages proposés : **choix du morceau**, **volume séparé**, **pouvoir la couper
seule**. Suite directe du plan 239 (decision-1167 : un volume et une sourdine par type de son).

## Ce que tu verras à l'écran

- Dans tous les menus, et dans les menus du combat : un bip quand le curseur se déplace au clavier ou
  à la manette, un son à la validation et à l'ouverture d'une fenêtre, un son d'erreur sur une action
  refusée. Rien au survol de la souris, rien quand le curseur se déplace sur la grille de combat.
- Dans **Réglages**, cinq lignes de son, chacune avec sa sourdine et son curseur : **Volume**,
  **Effets**, **Musique de combat**, **Musique de menu**, **Interface**.
- Une ligne **Thème des menus** (absente en combat) pour choisir le morceau des menus parmi 13
  musiques de menu officielles (écrans-titres, Centres Pokémon, GTS…) ; défaut : l'écran-titre de
  Rouge Feu/Vert Feuille. Aucune musique de combat. Le changement s'entend tout de suite.
- Pas de choix du son d'interface : la source n'a qu'un seul jeu de trois sons. La ligne Interface
  permet de les couper ou de les baisser.

## Recherche (2026-10-11)

- **Sons d'interface — PokeRogue** (`pagefaultgames/pokerogue-assets`, `audio/ui/`) : exactement trois
  fichiers, `select.wav` (40 Ko), `menu_open.wav` (47 Ko), `error.wav` (68 Ko). PokeRogue joue
  `select` au déplacement du curseur comme à la validation, `menu_open` à l'ouverture d'un menu,
  `error` sur une action refusée, sur un volume « UI » séparé (`audio-manager.ts`, lu au plan 239).
  `audio/se/` (39 fichiers) ne contient rien d'autre qui soit un son de menu.
- **Aucun second jeu de sons** n'a été cherché : un choix du son suppose une autre source, hors de ce
  plan (voir Hors périmètre).
- **Musique de menu** : `audio/bgm/` de PokeRogue n'a qu'un thème de menu officiel (celui livré au
  plan 239) ; son écran-titre est une composition de fan. D'où la liste proposée : le thème actuel,
  plus les musiques de combat déjà livrées — aucun fichier de plus.

## Décisions de conception

1. **Trois sons, dans le paquet existant** : `ui:move`, `ui:open`, `ui:error`, ajoutés à `sounds.bin`
   par `pnpm build-audio` (source `audio/ui/` de PokeRogue, mêmes règles d'encodage que les sons de
   coup). Aucun fichier de plus au build.
   - `ui:move` : le curseur change de contrôle (clavier, manette), et la validation d'un contrôle.
   - `ui:open` : une modale ou le menu de combat s'ouvre.
   - `ui:error` : une action refusée (bouton désactivé validé à la manette, lancement impossible).
2. **Un bus de plus, `interface`**, sous le gain maître, à côté de `effects` et `music`. Les sons
   d'interface ne passent PAS par les voix de combat : ils ne suivent ni la pause ni le ralenti.
3. **Branchés en observateurs, en trois points, sans rien changer à la navigation** (leçon du plan
   238, où une retouche de la navigation spatiale avait cassé le salon en ligne) :
   - déplacement : dans `focusInDirection` (`input/focus-navigation.ts`), quand le focus a
     réellement changé de contrôle — un appui contre un bord reste muet. **Pas seulement là**
     (revue 2026-10-12) : quatre chemins déplacent le focus sans passer par `focusInDirection` et
     doivent appeler le même son : le menu d'action et la liste d'attaques du combat
     (`ui-dom/src/battle-chrome.ts`, `focusMenuStep`), le « Terminer » du placement
     (`ui-dom/src/placement-roster.ts`, `focusFinish` / `blurFinish`), la roue de codes du salon
     aux bords et entre emplacements (`lobby-screen.ts`, `moveWithinWheel`), la liste de
     `MapPickerModal` (`moveSelection`). En revanche `focusFirst` (`combat-menu.ts`) appelle
     `focusInDirection("down")` par programme à chaque ouverture de niveau : il doit être exclu, sinon
     il double `ui:open` ;
   - validation : un écouteur `click` unique sur `document`, limité aux `button` et aux liens — il
     couvre souris, doigt, Entrée native et le `click()` synthétique de la manette. **Revue
     2026-10-12** : une touche *consommée* par le routeur (`preventDefault`, décision #822) ne
     produit aucun `click`. Deux cas réels restent muets : la liste de `MapPickerModal` (Entrée ou A
     → `confirmSelection()`) et la roue du salon (Entrée arrêtée par `stopPropagation`, A → `joinRoom()`).
     Il leur faut un appel explicite. Un `<input type=checkbox>` n'est pas un `button` : il reste muet ;
   - ouverture : dans `Modal` (`packages/ui-dom`) et dans le menu de combat. **Précision (revue
     2026-10-12)** : `Modal` ne couvre pas tout — les dialogues de victoire et d'élimination de
     `battle-chrome.ts` (`showModal()` l.774 et l.838) n'en sont pas. Point d'accroche : voir « Points
     ouverts ».
   Le son d'erreur se joue là où l'action est refusée, pas dans l'écouteur de clic. **Correction
   (revue 2026-10-12)** : un bouton désactivé n'est jamais focalisable (`FOCUSABLE_SELECTOR` contient
   `button:not(:disabled)`, et `menuButton` sans action est `disabled`) : `activateFocusedControl` ne le
   voit donc pas, et le cas « bouton désactivé validé à la manette » n'existe pas. Aucun refus à bouton
   actif n'a été trouvé dans le code lu : voir « Points ouverts ».
4. **Anti-rafale** : un même son d'interface ne se rejoue pas à moins de 40 ms du précédent (une
   direction maintenue à la manette répète vite).
5. **Musique de menu sur son propre bus** : `music` devient `battleMusic`, un bus `menuMusic`
   s'ajoute. Le programme de menu se branche sur le second ; `isMusicAudible` se décide par bus, pour
   que couper l'une ne retienne pas le chargement de l'autre.
   **Mixeur (revue 2026-10-12)** : `duck` et `dim` ne se dupliquent pas. Ce sont aujourd'hui une chaîne
   unique `duck → dim → sortie`, construite une fois sur un seul bus (`getMixer`) : les deux bus s'y
   branchent, et un seul programme jouant à la fois, un seul est audible. Ce qui change vraiment :
   `startVoice` se branche sur `target.duck` et doit se brancher sur le bus de son programme ;
   `isMusicAudible` a trois appelants (`play`, `follow` du medley, `notifyMusicAudible`) ; l'écouteur
   unique `startWaitingProgramme` doit vérifier le bus du programme en attente, sinon couper l'un
   réveille l'autre. **Cris** : `duckMusic` ne teste que `current === null`. Aucun cri de combat ne joue
   sous la musique de menu (`playMenuCry` n'appelle pas `duckMusic`) : la baisse touche donc la musique
   de combat en pratique. La garantir demande une garde `currentIsMenu` (voir « Points ouverts »).
6. **Réglages** (suite de decision-1167, même modèle `VOLUME_LINES`) :
   - `musicVolume` / `musicMuted` : gardent leurs clés, libellé « Musique de combat » ;
   - `menuMusicVolume` (défaut 55) / `menuMusicMuted` ; `interfaceVolume` (défaut 70) /
     `interfaceMuted` ;
   - `menuMusicId` (défaut : le thème de menu), validé par un validateur **dédié**
     (`knownMenuMusicIdOrDefault`, dans `music-tracks.ts`) : `knownMusicIdOrDefault` accepte aussi
     `medley`, que le thème de menu ne doit pas recevoir. Le thème a un identifiant (`menu`,
     `MENU_MUSIC_TRACK.id`) et un libellé à ajouter dans `music-names.ts` (`musicDisplayName` ne le
     connaît pas aujourd'hui).
   Une clé absente prend son défaut : pas de migration. Un joueur qui avait baissé sa musique verra
   la musique de menu revenir à 55 — accepté, le réglage est nouveau.
7. **Thème des menus** : une ligne des Réglages ouvre la modale de musique du plan 239, rendue
   paramétrable (titre, liste d'entrées, compteur de télémétrie). Entrées : « Thème de menu », puis
   les 26 pistes de combat. Pas d'« Aléatoire » ni de Medley ici. Le choix s'applique en direct.
   **En combat (revue 2026-10-12)** : le panneau Réglages est aussi monté par le menu de combat
   (`combat-menu.ts`, `embedded: true`). Une ligne « Thème des menus » y changerait la musique
   **pendant la partie**, puisque `playMenuMusic` coupe le programme de combat. Voir « Points ouverts ».
8. **e2e : neutraliser le chargement audio à la racine** (reporté du plan 239, relecture
   « profondeur ») : la fixture `page` bloque les requêtes `**/assets/audio/music/*.mp3` au lieu de
   semer `musicVolume: 0`. Les réglages du harnais redeviennent ceux du produit, et les trois
   scénarios de Réglages qui semaient `volume: 0` pour contourner sont réécrits sans contournement.
9. **Télémétrie** : compteurs pour le volume d'interface, le volume de la musique de menu, et le
   choix du thème des menus, sur le modèle des compteurs du plan 239.
10. **Crédits** : la ligne « Sons d'interface » (PokeRogue) dans `CREDITS.md` et l'écran Crédits.
11. **Pas de changement réseau** : tout est réglage local, `NETWORK_VERSION` reste à 19.

## Hors périmètre

- Un second jeu de sons d'interface, donc le **choix du son** : il faut d'abord une autre source.
- Un son au déplacement du curseur sur la grille de combat, et au survol de la souris.
- Musique de menu « Aléatoire » ou en medley.
- Jingle de victoire, musique d'alerte PV bas.

## Risques

- **Navigation partagée** : `focusInDirection` sert tous les écrans. Le son n'y est qu'un appel de
  plus après le `focus()`, sans condition nouvelle sur le chemin ; à vérifier sur la suite e2e
  entière au gate, pas seulement sur les specs touchées.
- **Écouteur de clic global** : il ne doit jamais appeler `preventDefault` ni `stopPropagation`, et
  ne doit pas compter deux fois une validation à la manette (un seul `click()` synthétique).
- **Cinq lignes de son + une ligne de choix** : les Réglages défilent déjà sur téléphone paysage ;
  à mesurer en 568 × 320 (hauteur des lignes, portée du défilement, focus qui reste visible).
- **Captures de référence** des Réglages et des Crédits : elles changeront, et c'est l'humain qui
  valide les nouvelles (garde-fou `--update-snapshots`).

## Points tranchés après revue (2026-10-12)

Les huit points ouverts par `plan-reviewer`, tranchés avec l'avis de `game-designer`. Ce qui suit fait
foi sur les décisions ci-dessus là où elles diffèrent.

1. **Ce qui sonne comme un déplacement** : tout changement de focus au clavier ou à la manette
   (`focusInDirection` et les quatre chemins de la décision 3), plus deux changements de sélection qui
   sont des déplacements de curseur pour le joueur : `cycleRosterSelection` (Pokémon du placement) et
   `wheel.step` (lettre de la roue). La valeur d'un curseur réglée aux flèches reste **muette** : le
   réglage s'entend déjà.
2. **Validation consommée** : son explicite sur Entrée ou A dans la liste de cartes et dans la roue
   du salon, qui ne produisent pas de `click`.
3. **Ouverture : un observateur unique** (option B) — `MutationObserver` sur l'attribut `open` des
   `dialog`, au niveau du document. Il couvre les `Modal`, les dialogues de victoire et d'élimination
   et le menu de combat, sans toucher à `ui-dom`. Le même observateur joue le son de **retour** quand
   un dialogue se ferme (voir 9).
4. **Erreur** : `ui:error` sur le code de salon invalide (`lobby-screen.ts`, `joinRoom`) et à
   l'ouverture de la modale de refus de connexion, où il **remplace** `ui:open`. Un refus de case ou
   de cible sur la grille ne sonne que s'il existe un point de refus unique dans
   `battle-orchestrator` ; sinon il reste hors périmètre, sans son branché à moitié.
5. **Cris** : garde `currentIsMenu` dans `duckMusic` — un cri ne baisse jamais la musique de menu.
6. **Thème des menus en combat** : la ligne est **masquée** dans les Réglages ouverts depuis le menu
   de combat (option du panneau). Elle ne se règle que depuis les menus.
7. **Validation et ouverture au même instant** : un seul son, l'ouverture. Une validation suivie
   d'une ouverture dans la même tâche cède sa place (le son de validation part en fin de tâche,
   annulé si un dialogue s'est ouvert entre-temps).
8. **e2e** : rien de spécial pour les sons d'interface — `sounds.bin` est déjà chargé par les combats,
   et aucun e2e n'écoute. Le déclenchement se prouve en test unitaire. Pour la musique, le blocage
   des mp3 passe par un helper partagé, appelé par la fixture `page` **et** par chaque création de
   contexte en ligne (neuf endroits, dont `online-session.ts`).
9. **Retour en arrière** (angle mort relevé par `game-designer`) : la fermeture d'un dialogue joue
   `ui:move` plus grave — pas de quatrième fichier.

Réglages de ressenti, à régler en recette :

- **Validation distincte du déplacement** : même fichier, déplacement à volume 0,6, validation à
  volume 1 et lue plus aiguë (vitesse 1,19, environ trois demi-tons), retour plus grave (0,84).
- **Anti-rafale à 70 ms** (et non 40) : la manette répète une direction tenue toutes les 90 ms
  (`REPEAT_INTERVAL_FRAMES`), donc chaque cran garde son tic et seul un double déclenchement est filtré.
- **Volume de l'interface à 60** par défaut (et non 70).
- **Grille de combat** : silence au déplacement du curseur, son de validation à la confirmation
  d'une case ou d'une cible — si un point de confirmation unique existe côté application.
- **Silences en combat** : aucun son d'interface pendant le tour de l'IA ni pendant qu'une attaque
  se joue, quand le joueur ne navigue pas.

Laissé tel quel, faute de réponse de l'humain : les **cinq lignes de son restent visibles**.
`game-designer` proposait de n'afficher que Volume et de replier les quatre autres sous « Avancé ».

## Retours de recette (2026-10-12, scénario 1)

- **Thème des menus : pas des musiques de combat.** L'humain veut des musiques de MENU officielles
  (écran-titre, Centre Pokémon, GTS…), des versions GBA, DS/3DS et récentes, une dizaine. La décision 7
  est caduque sur la liste. Livré : douze pistes d'album tirées des bandes originales officielles
  hébergées sur archive.org (`MENU_MUSIC_TRACKS`), plus le thème de Donjon Mystère en défaut
  provisoire — le défaut se choisira à l'écoute. Ces pistes n'ont pas de points de boucle : elles
  reprennent en fondu enchaîné 6 s avant leur fin (`restartAtMs`). Banque Pokémon : aucune source
  téléchargeable trouvée (archive.org ne renvoie que des podcasts).
- **Bips un peu moins forts** : interface à 55 par défaut (et non 60).
- **Cocher une case** muet à la souris, sonore au clavier et à la manette : accepté tel quel.
- **Variations d'un même son** (validation plus aiguë, retour plus grave) : acceptées, mais l'humain
  préférerait des sons dédiés. Recherche faite, sans résultat : PokeRogue n'a que trois sons ; les
  paquets archivés de The Sounds Resource pour Noir/Blanc, HeartGold/SoulSilver, X/Y et Soleil/Lune ne
  contiennent que des cris, des bruitages d'attaque et des jingles ; le paquet « General Battle Sound
  Effects » de Noir/Blanc n'est pas archivé. Seule piste non explorée : la banque brute d'Émeraude
  (n° 4206, correspondance des identifiants non vérifiée).

## Ce qui a été livré, là où ça diffère du texte ci-dessus

Fait foi sur tout ce qui précède (le code a raison). Détail : graphe, `plan-240` et decision-1169 à 1172.

- **Sons livrés à part** : `packages/app/public/assets/audio/ui/*.mp3` (13 Ko), pas dans `sounds.bin`
  (la décision 1 est caduque), pour qu'un clic dans les menus ne télécharge pas le paquet de 7 Mo.
- **Pas d'anti-rafale** (décision 4 et réglage à 70 ms retirés), **pas de silence pendant le tour de l'IA**.
- **Interface à 40** par défaut (et non 70, 60 ni 55) : volumes en table unique `VOLUME_SETTINGS`.
- **Observateurs** : routeur d'entrée (`withInterfaceSounds`, injecté par `babylon-boot.ts`), clics
  sur boutons et liens, attribut `open` des `dialog` ; règle « un appui, un son » (le plus parlant
  l'emporte en fin de tâche) ; appels explicites pour le refus et deux sélections sans changement de focus.
- **Thème des menus** : 13 thèmes (douze pistes d'album archive.org + Donjon Mystère : Explorateurs),
  **défaut : écran-titre de Rouge Feu/Vert Feuille**, **aucune musique de combat** dans la liste.
  Pistes d'album sans boucle : reprise en fondu enchaîné 6 s avant la fin (`restartAtMs`).
- **Quatre bus** (effets, interface, musique de combat, musique de menu), `duck` et `dim` dans `audio-player.ts`.
- **Préchargement** derrière les barres de chargement (`audio-preload.ts`, plafond 8 s) : la barre de
  démarrage attend les sons d'interface et le thème des menus, le voile du combat attend le paquet
  de bruitages et la musique du combat.
- **Héritage** : `menuMusicVolume` / `menuMusicMuted` reprennent l'ancien réglage de musique s'ils
  sont absents du stockage (la décision 6 disait « pas de migration »).
- **Variantes** d'un même son gardées par l'humain ; recherche de sons dédiés sans résultat
  (graphe, `recherche-sons-interface-2026-10-12`).
- **Procédure** : test sur téléphone toujours par tunnel (`docs/references/test-sur-telephone.md`).

## Étapes

- [x] 1. `scripts/build-audio.ts` : les trois sons `ui:*` depuis `audio/ui/` ; régénérer le paquet.
  - **Revue 2026-10-12** : `main()` crée une liste de dossiers (l.228-237) qui ne contient pas
    `raw/ui` : l'ajouter, sinon l'écriture du téléchargement échoue. Les `ui:*` suivent `encodingOf`
    (ni `move:`, donc 44,1 kHz / 96 kbps comme les coups) et la normalisation de crête à −1 dB de `encode()` :
    ils sortent à la même crête que les coups.
- [x] 2. `audio/audio-player.ts` : bus `interface`, `battleMusic`, `menuMusic` ; `AudioVolumes` à
  cinq gains ; `isMusicAudible(bus)` ; un `playInterfaceSound(soundId)` avec l'anti-rafale.
  - **Revue 2026-10-12** : `playInterfaceSound` ne peut pas réutiliser `playSound` : celui-ci teste le
    gain d'effets (`isAudioSilent`) et se branche sur le bus d'effets. Il faut un paramètre de bus interne
    et un test de silence propre au bus d'interface (master, bus, contexte `running`).
  - Tests à mettre à jour aussi : `audio/music-player.test.ts` (mock de `./audio-player` :
    `isMusicAudible`, `musicOutput`, `onMusicAudible`) et `packages/app/src/testing/fake-music-engine.ts`
    (`busNode`, à doubler pour le second bus).
- [x] 3. `audio/music-player.ts` : le programme de menu sur le bus `menuMusic` ; `playMenuMusic`
  prend l'identifiant du thème et redémarre quand il change.
  - **Revue 2026-10-12** : `playMenuMusic` retourne aujourd'hui tôt si le programme courant est déjà un
    menu : cette garde saute pour un changement d'identifiant. Le rappel `onScreen` (`babylon-boot.ts`)
    lit `getSettings().menuMusicId` ; le sélecteur rappelle `playMenuMusic(id)` au choix.
- [x] 4. `settings/index.ts` : les cinq clés nouvelles, validation, `audioVolumes`.
- [x] 5. `ui/dom/panels/settings-panel.ts` : cinq `VOLUME_LINES`, la ligne « Thème des menus ».
  - **Revue 2026-10-12** : le modèle tient pour cinq lignes (`createVolumeControl` est déjà générique).
    Les unions `VolumeLine.volume` / `VolumeLine.muted` (settings-panel.ts) et `VOLUME_KEYS`
    (settings/index.ts) répètent la même liste : la dériver de `VOLUME_KEYS` exporté. `changed` exige deux
    `TelemetryAction` nouvelles, `MenuMusicVolumeChange` et `InterfaceVolumeChange`. Les tests de
    `settings/index.test.ts` attendent trois clés dans `initAudio` et `setAudioVolumes` : à mettre à jour.
- [x] 6. `ui/music-select/MusicPickerModal.ts` : paramétrable ; l'appel du panneau Partie inchangé.
- [x] 7. Points d'accroche : `input/focus-navigation.ts`, écouteur de clic (dans `babylon-boot.ts`),
  `Modal` de `ui-dom`, menu de combat, listes à axe propre.
  - **Revue 2026-10-12** : ajouter `battle-chrome.ts` (`focusMenuStep`, `focusFinish` de
    `placement-roster.ts`, les deux `showModal()` de victoire et d'élimination), `moveWithinWheel` et
    `moveSelection`. Exclure `focusFirst` de `combat-menu.ts`. Le point d'accroche de l'ouverture est
    tranché en « Points ouverts », point 3.
- [x] 8. i18n fr / en / es ; télémétrie (contrat et libellés du rapport) ; `CREDITS.md` et écran
  Crédits ; `docs/architecture.md` (une phrase, sans grossir le fichier).
- [x] 9. e2e : fixture qui bloque les mp3 de musique ; réécriture des trois scénarios concernés.
  - **Revue 2026-10-12** :
    - `page.route` de la fixture ne couvre que sa page. Neuf `browser.newContext` ne passent pas par
      elle et ne sèment rien : `e2e/pages/online-session.ts` (l.263-264), `e2e/pages/elimination.ts`
      (l.201), `e2e/tests/dom/online-lobby.spec.ts` (l.32-33), `online-ai-difficulty.spec.ts` (l.35),
      `online-format.spec.ts` (l.97), `online-host-migration.spec.ts` (l.36), et
      `e2e/tests/bench/mesh-scaling.spec.ts` (l.145). Ils téléchargent déjà la musique aujourd'hui
      (défaut 55, volume 75). Il faut un `context.route` à chaque création de contexte, sur le modèle de
      `RoomRegistryStub.install(context)` (`e2e/fixtures/room-registry.ts`), ou un helper partagé.
    - Un thème dont le chargement échoue : `failed()` oublie le programme, donc chaque changement d'écran
      redemande le mp3 (une requête avortée par écran, sans boucle ni `pageerror`). Le bruit est en console
      (« Failed to load resource »), que le harnais ne contrôle pas.
    - `e2e/tests/dom/settings.spec.ts` : le test de parcours des flèches (l.82-113) liste l'ordre des
      testids : deux lignes de plus à y mettre. Le test l.160 cherche `getByText("Musique")` exact, et
      les noms accessibles « Couper le son — Musique » (l.161, 169, 170…) changent avec le libellé
      « Musique de combat » : à mettre à jour, comme `e2e/pages/screens.ts` (locators par testid, deux de plus).
    - Specs qui sèment `volume: 0` : trois scénarios de `settings.spec.ts` (l.157, 191, 326). Specs qui
      sèment `musicVolume` : `settings.spec.ts` seulement ; la fixture `page` le fait pour toutes les autres.
      `music-picker.spec.ts` (l.18) documente encore « la fixture `page` sème `musicVolume: 0` » : commentaire à
      réécrire.
    - Sons d'interface en e2e : voir point 8 de « Points ouverts ».
- [x] 10. `/simplify`, typecheck, passe multi-entrée mesurée (cinq lignes, ligne de choix, modale).

## Recette prévue (5 scénarios)

1. Sons d'interface au clavier et à la manette : déplacement, bord muet, validation, ouverture d'une
   modale, action refusée ; rien au survol.
2. Sons d'interface en combat : menu d'action et menu de combat ; rien sur la grille.
3. Réglages : les cinq lignes, chaque sourdine ne coupe que sa ligne, la sourdine générale coupe tout.
4. Thème des menus : changer de morceau, l'entendre tout de suite, le retrouver après rechargement ;
   couper la musique de menu sans couper celle du combat, et l'inverse.
5. Téléphone paysage : les Réglages défilent, tout se touche au doigt.
