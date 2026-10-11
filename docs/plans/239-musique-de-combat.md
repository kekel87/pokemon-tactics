# Plan 239 — Musique de combat

**Statut** : done (2026-10-11, revu par `plan-reviewer` et `game-designer`, recette validée — 7 scénarios, 2 retours)
**Origine** : `/next` du 2026-10-11. L'humain choisit la musique avant la release v2026.10.4 :
musiques de combat **officielles**, choisies par l'hôte en début de partie, avec deux entrées
spéciales — « Aléatoire » (une musique, en boucle) et un enchaînement de musiques tirées au hasard
(nom provisoire « Medley »). Suite directe du plan 238 (decision-1159 : « la musique aura son
volume »). Régime d'assets : decision-1138 (source téléchargée par script et gitignorée, fichiers
empaquetés commités).

## Ce que tu verras à l'écran

- En combat, une musique de combat officielle joue en boucle, sans coupure audible au point de
  boucle. Elle démarre à l'arrivée sur l'écran de combat (placement compris) et s'éteint en fondu
  quand on le quitte.
- Dans le panneau **Partie** (là où on choisit la carte), une ligne **Musique** : « Aléatoire »
  (défaut — une musique tirée, en boucle), « Medley » (une musique tirée après l'autre, chacune
  jouée une fois en entier), ou une des 15 musiques nommées. En ligne, seul l'hôte choisit ;
  l'invité lit le choix, et tout le monde entend la même musique.
- Dans **Réglages** : le curseur actuel devient **Effets**, un second curseur **Musique** s'ajoute.
  La sourdine coupe les deux.
- Quand un Pokémon pousse son cri (K.O., début de tour), la musique baisse brièvement puis remonte.
  Elle ne bouge pas pendant les bruitages d'attaque.
- La musique se met en pause quand l'onglet passe en arrière-plan, et reprend au retour.

## Recherche (2026-10-11)

Comment le son est géré ailleurs — ce que la question de l'humain demandait.

| Jeu | Musique vs bruitages | Source |
|---|---|---|
| **Émeraude (GBA)** | Pendant un **cri**, la musique tombe à 85/256 (≈ 33 %) puis revient à 256 deux images après la fin du cri. **Pas** en combat double (trop de cris). Aucune baisse pendant les bruitages d'attaque. Une **fanfare** (montée de niveau…) **arrête** la musique, qui **reprend où elle en était** à la fin. Fondus d'entrée/sortie à vitesse paramétrable. | `pret/pokeemerald`, `src/sound.c` (`PlayCry_Normal`, `Task_DuckBGMForPokemonCry`, `PlayFanfareByFanfareNum`) — lu |
| **Épée / Bouclier** | Trois volumes séparés : musique, bruitages, cris. | Serebii, « Music Customisation » |
| **Noir / Blanc** | Musique d'alerte quand les PV sont bas, et thème qui change au dernier Pokémon d'un champion. Abandonné après la Gen 5. | de mémoire + PokéBase, non vérifié dans le code |
| **Showdown** | Deux volumes (musique, effets), **aucune baisse** de la musique pendant les effets. 15 musiques de combat, une tirée par partie, points de boucle en ms écrits en dur. Boucle par saut de `currentTime` sur un `<audio>` (imprécis). Volume à 0 ou sourdine = musique arrêtée. | `smogon/pokemon-showdown-client`, `battle-sound.ts` et `battle-animations.ts` — lus |
| **PokeRogue** | Cinq volumes (général, musique, terrain, effets, interface). Baisse automatique : non trouvée dans la partie lue. | `battle-scene.ts`, lecture partielle |

**Ce qu'on en retient** : volumes séparés partout ; la seule baisse automatique attestée est celle
du **cri**, jamais des bruitages d'attaque ; personne ne synchronise la musique au gameplay.

### Les 15 musiques (Showdown, `play.pokemonshowdown.com/audio/<fichier>.mp3`)

Points de boucle en ms, repris tels quels de `setBgm`. Poids = fichier source.

| id | Nom affiché (FR) | début boucle | fin boucle | source |
|---|---|---|---|---|
| `dpp-trainer` | Dresseur — Diamant/Perle | 13440 | 96959 | 2,5 Mo |
| `dpp-rival` | Rival — Diamant/Perle | 13888 | 66352 | 1,8 Mo |
| `hgss-johto-trainer` | Dresseur de Johto — Or HeartGold | 23731 | 125086 | 3,0 Mo |
| `hgss-kanto-trainer` | Dresseur de Kanto — Or HeartGold | 13003 | 94656 | 2,3 Mo |
| `bw-trainer` | Dresseur — Noir/Blanc | 14629 | 110109 | 2,8 Mo |
| `bw-rival` | Rival — Noir/Blanc | 19180 | 57373 | 1,8 Mo |
| `bw-subway-trainer` | Métro de Combat — Noir/Blanc | 15503 | 110984 | 2,8 Mo |
| `bw2-kanto-gym-leader` | Champion de Kanto — Noir 2/Blanc 2 | 14626 | 58986 | 1,7 Mo |
| `bw2-rival` | Rival — Noir 2/Blanc 2 | 7152 | 68708 | 1,8 Mo |
| `xy-trainer` | Dresseur — X/Y | 7802 | 82469 | 2,0 Mo |
| `xy-rival` | Rival — X/Y | 7802 | 58634 | 1,7 Mo |
| `oras-trainer` | Dresseur — Rubis Oméga | 13579 | 91548 | 2,3 Mo |
| `oras-rival` | Rival — Rubis Oméga | 14303 | 69149 | 1,8 Mo |
| `sm-trainer` | Dresseur — Soleil/Lune | 8323 | 89230 | 2,2 Mo |
| `sm-rival` | Rival — Soleil/Lune | 11389 | 62158 | 1,9 Mo |

Total source : 32 Mo, 1 236 s jusqu'aux fins de boucle. Les noms affichés sont des libellés
d'interface (rôle — jeu), pas des titres de pistes ; ils ne se traduisent que par le nom du jeu.

## Décisions de conception

1. **Un fichier par musique, chargé à la demande** — pas dans `sounds.bin`. Seule la musique jouée
   est téléchargée. `packages/app/public/assets/audio/music/<id>.mp3` + les points de boucle dans le
   code (`music-tracks.ts`). +15 fichiers au build (250 → ~265, plafond itch.io 1000).
2. **Encodage** : ré-encodage ffmpeg en mp3 **stéréo 96 kbps 44,1 kHz**, coupé à `fin boucle + 0,5 s`
   (la suite du fichier ne s'entend jamais). Poids attendu ≈ 15 Mo au total — **à mesurer** ; si
   l'écoute en recette le permet, descendre à 80 kbps.
3. **Boucle au sample près** : la piste est décodée (`decodeAudioData`) et jouée par un
   `AudioBufferSourceNode` avec `loop`, `loopStart`, `loopEnd`. Pas de `<audio>` + minuterie comme
   Showdown : le saut s'entend. Coût : ~40 Mo de RAM par piste décodée → **une seule piste décodée
   à la fois** (Medley : la suivante est décodée pendant les dernières secondes, la précédente
   libérée). Les points de boucle sont ceux du fichier source ; le ré-encodage mp3 ajoute un retard
   d'encodeur → **vérifier à l'oreille** et corriger par un décalage constant s'il y en a un
   (mesurable : comparer la durée décodée source / ré-encodée).
4. **Deux bus sous le gain maître** : `effects` (tout ce qui existe) et `music`. `audio-player.ts`
   expose `setEffectsVolume`, `setMusicVolume` ; la sourdine reste sur le maître.
   Réglages : `volume` existant = effets (libellé « Effets », clé de stockage inchangée → pas de
   migration), nouveau `musicVolume` (défaut **40**, la musique sous les effets à 75 — avis
   `game-designer` : le son d'efficacité d'un coup est une information de jeu, il reste devant).
5. **Baisse pendant les cris** (modèle Émeraude, adouci, dosé par cri — avis `game-designer`) :
   la musique descend en 80 ms, tient la durée du cri, remonte en 300 ms. Niveau : **50 %** pour un
   cri de K.O. ou un cri emprunté par une attaque vocale, **70 %** pour le cri de début de tour
   (lui-même joué à 0,7). Une baisse demandée pendant une autre la prolonge au niveau le plus bas,
   sans redescendre ni remonter entre les deux (pas de « pompage » avec le réglage Tous). Aucune
   baisse en vitesse Instantanée (les cris n'y jouent pas). Rien sur les bruitages d'attaque ni les
   coups. Constantes à régler en recette.
6. **Hors horloge de combat** : la musique ne suit ni la pause, ni le ralenti, ni la vitesse
   Instantanée. Pas de musique dans l'atelier des attaques ni au bac à sable e2e (silence = défaut
   quand aucun choix de musique n'est transmis).
7. **Cycle de vie** : démarre au montage de l'écran de combat (placement compris) avec un **fondu
   d'entrée de 1 s** (sur téléphone la piste arrive tard, en plein tour : jamais de départ brutal).
   À la fin du combat, la musique descend à **30 % en 2 s** et continue sur l'écran de résultat ;
   fondu de sortie 500 ms au démontage. Menu de pause ouvert : musique à **40 %**, sans coupure
   (le curseur Musique des Réglages ouverts depuis la pause reste audible). « Rejouer » relance la
   même sélection (Aléatoire retire une musique) : l'ancienne piste finit son fondu de sortie
   pendant que la nouvelle entre, son tampon décodé est libéré à la fin du fondu.
   Onglet caché (`visibilitychange`) → pause, retour → reprise.
   Volume musique à 0 ou sourdine : rien n'est téléchargé ni décodé ; remonté en cours de combat →
   la musique démarre.
8. **Le choix** — valeur `musicId` : un id de piste, `random` ou `medley`.
   - Préférence locale `lastMusicId` (défaut `random`), validée contre la liste comme `lastMapId`.
   - Ligne « Musique » dans `GamePanel`, sous « Carte », même gabarit (bouton + chevron pour qui
     peut changer, texte seul pour l'invité). Sélecteur : modale de liste, sur le modèle de
     `MapPickerModal` (sans vignette). Un bouton d'écoute par piste est **hors périmètre**.
   - **Transport jusqu'à l'écran** : champ optionnel `musicId` dans `CombatSetup`
     (`packages/app/src/app/screens.ts`), posé par `team-select-screen.ts` — solo dans `onLaunch`,
     en ligne dans `enterNetworkBattle` depuis `start.options.musicId`. Il voyage ainsi dans
     `BattleResumeSave.setup` (reprise) et dans `setupForReplay` (« Rejouer ») sans champ de plus.
     `combat-screen.ts` ne lance la musique que si `setup?.musicId` est défini : bac à sable,
     atelier des attaques et `?combat=1` ne passent pas de setup.
   - **En ligne** : `NetworkRoomOptions.musicId` (chaîne opaque pour `network`, comme `mapId`).
     `random` est résolu **par l'hôte dans `team-select-screen.ts` (`onNetworkLaunch`)**, comme la
     carte, puis transmis à `Room.launch` (nouveau paramètre) qui le publie concret dans le `start`.
     `launch` refuse la sentinelle `random` comme il refuse celle de la carte. `medley` voyage tel
     quel : ce n'est pas une piste, la règle « identifiant concret » ne vaut que pour `random`.
     **`NETWORK_VERSION` 18 → 19** : la forme de `room_state` et `start` change.
   - **Ordre du Medley, sans nouveau champ et sans graine consommée deux fois** :
     `createPrng(start.seeds.battle ^ MEDLEY_SALT)`, un générateur **neuf** à chaque Medley. Ne jamais
     réutiliser un générateur déjà avancé : `deriveTeamSeedsBySeat` consomme celui de `seeds.team`, le
     moteur de combat celui de `seeds.battle` — les réutiliser décalerait leurs tirages. `createPrng`
     ne lit qu'un entier (`seed | 0`) et n'a aucun état partagé : deux pairs avec la même graine
     obtiennent la même suite, quel que soit l'instant de l'appel. Solo (pas de `seeds`) : graine tirée
     à l'entrée, rien à synchroniser.
   - **Solo / local** : même panneau, même résolution de `random`, sans réseau. Où elle se fait
     (au montage de `combat-screen.ts` ou à l'entrée dans `team-select`) : voir Risques, reprise.
9. **Medley** : une piste boucle jusqu'à la **première fin de boucle après 150 s** (la plus courte
   ne dure que 57 s : un seul passage ferait changer de musique chaque minute — avis
   `game-designer`), puis cède la place. Fondu **enchaîné avec chevauchement** : la suivante démarre
   1,5 s avant cette fin de boucle et monte pendant que l'autre descend. Jamais deux fois la même
   d'affilée ; l'ordre est une permutation retirée quand elle est épuisée.
10. **Crédits** : `CREDITS.md` et l'écran Crédits gagnent la ligne musique (source Showdown,
    œuvres © leurs ayants droit), sur le modèle des bruitages.

## Élargissement en cours de dev (demandes de l'humain, 2026-10-11)

- **Musiques plus récentes** : 11 pistes de PokeRogue (`audio/bgm/`) s'ajoutent aux 15 de Showdown —
  Arène, Conseil 4 et Maître de X/Y ; Conseil 4 de Soleil/Lune ; Maître d'Ultra-Soleil/Ultra-Lune ;
  Maître d'Épée/Bouclier ; Arène, Conseil 4, Alisma, Menzi et Kass d'Écarlate/Violet. Elles bouclent
  d'un point de départ à la **fin du fichier** (`getBgmLoopPoint`). **Écartées** : Arène de Galar
  (267 s) et Tournoi de la Ligue (222 s) — au-delà de 3 min, une piste décodée dépasse 80 Mo.
- **Queue de boucle** : chaque fichier est coupé à sa fin de boucle puis prolongé de 0,5 s copiées
  après son début de boucle. Remplace « fin de boucle + 0,5 s du fichier source » (décision 2), qui
  ne vaut rien pour une piste bouclant en fin de fichier.
- **Poids mesuré** : 27 fichiers, **30,3 Mo** (26 pistes de combat + le thème des menus), contre
  15 Mo prévus pour 15 pistes.
- **Musique de menu** : thème de menu de PokeRogue (officiel, Donjon Mystère : Explorateurs), bouclé
  en entier, sur tous les écrans hors combat. Lancé au montage de chaque écran de menu
  (`babylon-boot.ts`), il continue sans coupure d'un écran au suivant.
- **Sons de menu et de curseur** : demandés, **pas dans ce lot** — proposés pour un plan suivant
  (ils touchent la navigation partagée). À confirmer par l'humain.
- **Réglages** : la sourdine reste sur la ligne Effets ; le curseur Musique a sa ligne juste dessous.

## Ce qui a été livré, là où ça diffère du texte ci-dessus (recette du 2026-10-11)

Le texte des sections précédentes est celui du plan validé ; ce qui suit fait foi.

- **26 pistes de combat**, pas 15, plus le thème des menus (voir « Élargissement »).
- **Réglages du son** (retour de recette) : trois lignes, chacune avec sa sourdine et son curseur —
  **Volume** (général, clé `volume` inchangée, sa sourdine `muted` coupe tout), **Effets**
  (`effectsVolume`, défaut 100, `effectsMuted`) et **Musique** (`musicVolume`, défaut **55** car
  multiplié par le général, `musicMuted`). Les boutons de sourdine ont la hauteur d'un bouton de
  texte. La décision 4 (« `volume` devient effets », défaut 40) est caduque.
- **« Rejouer »** : le choix d'origine est gelé dans `CombatSetup.musicChoiceId` (local seulement) et
  « Aléatoire » retire à partir de lui — jamais des préférences (décision #893). Le point tranché
  « retire à partir de `lastMusicId` » est caduc.
- **Pas de module feuille pour les sentinelles** : `settings/index.ts` importe `music-tracks.ts`, qui
  ne tire que `@pokemon-tactic/network` et la table des pistes. Pas de cycle tant que ni l'un ni
  l'autre n'importe `settings` ou `i18n` — c'est pour cela que les libellés vivent à part, dans
  `music-names.ts`.
- **Musique de menu** portée par `ScreenManager` (rappel `onScreen`), pas par chaque écran.
- **Pause en arrière-plan** : tout le contexte audio, dans `audio-player.ts`.
- **Medley** : la piste suivante est téléchargée et décodée 6 s avant son entrée (pas 20), rien
  n'est chargé tant que la musique est inaudible, et un échec attend 30 s avant un nouvel essai.
- Le sel de graine du medley s'appelle `MEDLEY_SEED_SALT`.

## Hors périmètre

- Jingle de victoire, musique d'alerte PV bas (Gen 5), thème de « dernier Pokémon ».
- Écoute d'une piste depuis le sélecteur.
- Changer de musique en cours de combat.
- Les 4 pistes spéciales de Showdown (Miror B., Homika, Élite 4 SPL).

## Risque à connaître

La musique est l'asset le plus « détectable » (noté dès reflexion-2026-10-07-vfx-source-autres) :
un retrait sur itch.io ou GitHub Pages viserait d'abord elle. Conséquence de conception : les
pistes sont des fichiers à part, la liste est une table — retirer la musique = vider la table, le
jeu reste jouable et silencieux côté musique.

## Points tranchés après revue (2026-10-11)

- **Où `random` se résout** : à la **composition du `CombatSetup`** (solo : `onLaunch` ; en ligne :
  l'hôte dans `onNetworkLaunch`). Le setup porte donc toujours une piste concrète ou `medley`.
  « Rejouer » retire à partir de la préférence (`lastMusicId`), pas du setup.
- **Reprise d'une partie solo** : la sauvegarde porte la piste concrète → même musique à la reprise.
  Une sauvegarde antérieure, sans le champ, reprend en **silence** (elle ne vit qu'un combat).
- **Identifiant de musique inconnu au `start`** : **silence**, jamais un refus. Une musique ne
  bloque pas un combat.
- **Niveau sonore des pistes** : ramenées à une même **sonie** par un **gain constant** (la mesure
  vient de `loudnorm`, cible -16 LUFS, plafond de pic -1,5 dB ; la dynamique n'est pas touchée)
  au ré-encodage, pour qu'un Medley ne saute pas de niveau d'une piste à l'autre. Le défaut 40 se
  règle en recette sur ce niveau.
- **Ressources** : deux pistes décodées ne coexistent que le temps d'un fondu (Medley, Rejouer).
- **e2e** : `musicVolume: 0` par défaut dans les réglages semés ; aucun réseau, aucun hasard.

## Étapes

- [x] 1. `scripts/build-music.ts` (+ script `pnpm build-music` dans `package.json`) : téléchargement des
  15 sources dans `assets-src/audio/music/` (cache, déjà couvert par le `.gitignore` via
  `assets-src/audio/`), ré-encodage, écriture dans `public/assets/audio/music/`. Pas dans
  `build-audio.ts` : son `main()` est monolithique et écrit `sounds.bin`. Son `download()` est à
  extraire dans un module partagé, ou à dupliquer. Mesurer le poids total et le retard d'encodeur.
  Le plugin `strip-non-shipped-assets` de `vite.config.ts` ne filtre pas par type : les mp3 passent
  sans réglage. Seuls comptent le total (avertissement à 900, plafond itch.io à 1000). Le « 250 »
  de la décision 1 n'est pas vérifié ici : à mesurer sur un build.
- [x] 2. `packages/app/src/audio/music-tracks.ts` : table des pistes (id, clé i18n, points de boucle),
  sentinelles `RANDOM_MUSIC_ID` / `MEDLEY_MUSIC_ID`, `knownMusicIdOrDefault`, `resolveMusicId`,
  ordre de medley à partir d'un générateur fourni. Pur, testable.
  🔴 Les sentinelles et `knownMusicIdOrDefault` vont dans un module **feuille** (sur le modèle de
  `maps/random-map-id.ts`) : `settings/index.ts` doit les importer pour son défaut `lastMusicId`, et
  `preferred-map.ts` documente un cycle d'import réel né de ce cas. `music-tracks.ts` (table, PRNG)
  n'est importé que par le lecteur de musique, jamais par `settings`.
- [x] 3. `audio-player.ts` : bus `effects` et `music`, volumes séparés, `duckMusic(durationMs)`.
  `isAudioSilent()` doit rester vrai quand le volume d'effets vaut 0 : aujourd'hui c'est le gain maître
  qui le dit, et les bruitages sont décodés pour rien sinon. `initAudio` et `setMasterVolume` changent
  de forme : `initSettings` doit passer les deux volumes au boot.
  Tests existants à mettre à jour dans cette étape : `settings/index.test.ts` (mock de `audio-player`,
  attentes `initAudio(0.4)` et `setMasterVolume` `[[0.2],[0],[0.2]]`, `toEqual` des défauts) et le mock
  de `audio-player` dans `battle-audio.test.ts` (ajouter `duckMusic`, sinon l'appel lève à la première
  attaque).
- [x] 4. `packages/app/src/audio/music-player.ts` : chargement/décodage d'une piste, boucle, fondus,
  medley, pause sur onglet caché, démarrage différé tant que l'audio est verrouillé ou muet.
- [x] 5. Réglages : `musicVolume`, `lastMusicId`, validation (`mergeWithDefaults` : type et bornes,
  comme `volume`) ; panneau Réglages (second curseur, libellés « Effets » / « Musique », parcours
  clavier/manette/tactile identique à la ligne actuelle).
  `settings-panel.ts` lit aujourd'hui `volume === 0` comme sourdine (`refreshMuteToggle`, `toggleMute`,
  `UNMUTED_VOLUME`) : à réécrire pour le seul bus d'effets, sinon le bouton de sourdine tient pour
  muet un réglage qui ne coupe que la musique. Le curseur Musique a un testid propre
  (`setting-music-volume`) : `e2e/pages/screens.ts` et `settings.spec.ts` ciblent `setting-volume`.
- [x] 6. `battle-audio.ts` : appel de `duckMusic` sur les cris.
- [x] 7. `GamePanel` + modale de choix + `team-select-screen.ts` : ligne Musique, préférence, hôte/invité.
- [x] 8. Réseau : `NetworkRoomOptions.musicId`, validation du message (`isRoomOptions`, donc `room_state`
  et `start`), résolution de `random` dans `team-select-screen.ts` (`onNetworkLaunch`) puis
  `Room.launch(…, resolvedMusicId)`, qui refuse la sentinelle. Sont aussi à mettre à jour :
  `createAsHost` (`team-select-screen.ts`, construit `NetworkRoomOptions` avec `mapId: mapChoiceId`),
  `placeholderOptions()` (`room.ts`), les tests `protocol.test.ts` et `room.integration.test.ts`.
  `NETWORK_VERSION` 18 → 19 avec son paragraphe (protocol.ts), `docs/multiplayer.md`
  (protocole, § Versionnage).
- [x] 9. `combat-screen.ts` : démarrage et arrêt de la musique, « Rejouer ». Le démarrage se place dans
  `mountContent` après `const setup = params.setup` (les trois chemins, placement, reprise et Rejouer,
  y passent), et l'arrêt dans `teardown()`. Ordre à trancher : `teardown` fond en 500 ms, donc un
  Rejouer fait se chevaucher l'ancienne piste et la nouvelle pendant ce temps.
  🔴 **e2e** : le défaut « Aléatoire » est aussi celui de l'écran de sélection, donc **chaque combat e2e
  qui y passe lance une piste** (téléchargement, décodage, hasard hors seed). L'affirmation « silence
  par défaut » ne tient donc que pour bac à sable et atelier. `e2e/fixtures/index.ts` doit poser
  `musicVolume: 0` par défaut (`seedSettings`), et les tests de musique le remettent explicitement.
- [x] 10. i18n fr / en / es ; `CREDITS.md` + écran Crédits ; `docs/architecture.md` (une ligne).
  Télémétrie : `telemetry-contract.ts` (`VolumeChange` / `VolumeMute`, lignes 85-86) gardent leur sens
  « effets » ; ajouter les compteurs de la musique (changement de curseur, choix d'une piste, Aléatoire,
  Medley), sur le modèle de `MapChanged`. Sans eux, le choix de musique n'est pas compté du tout.
  Le nouveau curseur, la ligne du panneau Partie et la modale de choix sont des contrôles : e2e, `getByRole`
  non scopé (`slider`, `button`) à grepper après ajout.
- [x] 11. `/simplify`, typecheck, passe multi-entrée mesurée (ligne Musique du panneau Partie,
  modale, second curseur des Réglages).

## Recette prévue (6 scénarios)

1. Solo, « Aléatoire » : une musique démarre, boucle sans accroc (écouter deux passages de boucle).
2. Choix d'une piste nommée dans le panneau Partie ; « Rejouer » la garde.
3. « Medley » : enchaînement et fondu entre deux pistes.
4. Réglages : curseurs Effets et Musique indépendants, sourdine, musique à 0 puis remontée en combat.
5. Baisse pendant un cri de K.O. et un cri de début de tour ; rien pendant une attaque.
6. En ligne à deux : l'invité lit le choix de l'hôte et entend la même musique ; sur téléphone,
   déblocage au premier geste et pause quand l'onglet passe en arrière-plan.
