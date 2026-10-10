# Plan 238 — Son lot 3 : attaques, coups, cris, et les réglages du son

**Statut** : done (2026-10-10)
**Origine** : `/next` du 2026-10-09, l'humain choisit le lot 3 son (decision-1137 découpage, decision-1138
source et licence, decision-1146 régime « source gitignorée, paquet commité »). La musique suivra dans
un plan dédié, juste après.

## Ce que tu verras à l'écran

- En combat, chaque attaque a son bruitage, calé sur son animation. Chaque coup fait « tchac » : normal,
  super efficace (plus fort, un peu plus aigu en ×4), peu efficace (plus sourd, plus grave en ×¼).
  Rien sur une immunité.
- Un Pokémon K.O. pousse son cri (juste après le coup fatal). Quand vient le tour d'un **de tes**
  Pokémon, il pousse un cri bref (≤ 0,7 s, plus discret) — réglable : Aucun / Mes Pokémon / Tous.
- Rugissement, Hurlement, Grondement, Mégaphone, Voix Enjôleuse (attaques vocales sans bruitage) :
  le lanceur pousse un cri court à la place.
- Au constructeur d'équipe, choisir un Pokémon joue son cri.
- Dans **Réglages** (menu principal et menu de combat) : **Volume** (curseur 0-100 + sourdine en icône)
  et **Cri au début du tour** Aucun / Mes Pokémon / Tous (défaut Mes Pokémon). Rien ne joue avant le premier clic ou la première touche
  (règle des navigateurs).
- L'atelier des attaques allume sa piste « Son » : on y voit et entend les bruitages de chaque attaque.

## Recherche (2026-10-09, mesurée)

- **Sons d'attaque — PokeRogue** (`pagefaultgames/pokerogue-assets`) : `battle-anims/<move>.json`
  porte des `frameTimedEvents` `{resourceName, volume, pitch}` à ~50 ms par frame. **511 attaques
  jouables sur 512** couvertes (manque Neigeux Formation `snowscape`). 1 004 événements, 696 fichiers
  distincts, 18,3 Mo bruts, 775 s. **Provenance** : 671 sont des `PRSFX` de **Pokémon Reborn** (rips
  des jeux retouchés par des fans, 8 bits 12 kHz), 25 de la bibliothèque RPG Maker XP. Ce ne sont
  **pas** des rips officiels directs. 11 attaques sans son (Rugissement, Hurlement, Grondement,
  Mégaphone, Voix Enjôleuse, Repos…).
- **Alternative « vraiment officiel »** : pack BellBlitzKing (itch.io, 4 500 sons Gen 1-7, 723 Mo,
  téléchargement manuel), **sans** correspondance attaque → instants : mapping et calage à la main.
- **Coups** : PokeRogue `audio/se/` — `hit`, `hit_strong`, `hit_weak` (officiels, déclarés fair-use).
- **Cris** : ~~Showdown~~ → **PokeAPI/cries `latest`** (cris des jeux actuels, retenu en recette), mp3 natif Safari.
- **Encodage** : ffmpeg présent localement. mp3 48 kbps mono 24 kHz → 5,1 Mo pour les 696 sons (les
  sources à 12 kHz ne gagnent rien au-delà).
- **Empaquetage** : conteneur binaire (un mp3 complet par son, concaténés) + index JSON, décodage
  **à la demande** (`decodeAudioData`) avec cache. Pas d'audio sprite : décoder 775 s d'un bloc
  ≈ 150 Mo de RAM, et le padding mp3 décale les offsets différemment selon le navigateur.
  Total ≈ 6,5 Mo, **2 fichiers** ajoutés au build.
- **Licence des JSON PokeRogue** (AGPL) : on n'en garde que noms de sons, instants, volume, pitch,
  dans un index généré — pas de recopie des JSON.

## Décisions de cadrage

- **Pas de cri à l'apparition en début de combat**, ni maintenant ni plus tard (humain, 2026-10-09 :
  « avec plein de Pokémon, ça va être un bordel »). À la place : cri **au début du tour**, réglable.
- **Volume : curseur + sourdine en icône** (révisé en recette ; les 5 crans initiaux sont abandonnés).
  La sourdine garde le volume.
- **Un seul volume** pour ce lot. Le plan musique ajoutera son propre volume — pas de contrôle mort
  d'ici là.
- **Combat Instantané** : aucun bruitage d'attaque ni cri de tour ; seuls les sons de coup restent.
  La vitesse Rapide (×2) a été **supprimée** en recette : il ne reste que Normale et Instantanée.
- **Multijoueur** : l'audio est local, branché sur les repères de présentation, rien ne passe sur le
  réseau.
- **Attaques sans son** : attaques vocales (Rugissement, Hurlement, Grondement, Mégaphone, Voix
  Enjôleuse) → cri du lanceur, 400 ms, −6 dB. Les autres (Repos, Neigeux Formation…) → rien.

## Arbitrages après relecture (plan-reviewer + game-designer, 2026-10-09)

- **Cri de tour** : réglage à 3 états Aucun / Mes Pokémon / Tous, défaut **Mes Pokémon** (camp(s)
  contrôlé(s) localement). Coupé à 700 ms avec fondu de 150 ms, à 70 % du volume. Coupé net dès que
  le joueur agit. **Pas de cri au premier tour du combat** (fidèle à « pas de cri d'apparition »).
- **K.O.** : cri à 100 %, 250 ms après le son de coup, en file (1 cri / 400 ms max).
- **Coups** : ×4 rate +12 %, ×¼ rate −15 % et −3 dB ; variation aléatoire ±3 % sur tous ; au plus
  3 voix simultanées du même son, au-delà −3 dB ; décalage de 40 ms par cible en zone.
- **Normalisation** du niveau dans `build-audio` (`loudnorm` ffmpeg par son) — les sources Reborn sont
  hétérogènes.
- **Ancrage des instants** : sur `attack-start` (la frame 0 PokeRogue = début de l'animation), décalage
  global repris en recette si besoin. `rate = pitch / 100` (100 = neutre, lecture PokeRogue).
- **Constructeur d'équipe** : un nouveau cri coupe le précédent (pas d'empilement).
- **Instantané** : sons de coup seuls (révisé en recette, voir Retours).

## Comment

### A. Assets — `scripts/build-audio.ts` (`pnpm build-audio`)

- Télécharge si absent dans `assets-src/audio/` (gitignoré) : les JSON PokeRogue des attaques
  jouables (clés de `packages/data/src/overrides/tactical.ts`), les fichiers `battle_anims/` cités,
  `se/hit*.wav`, et les cris Showdown du roster (`playable-pokemon.ts`, id sans tiret).
- Encode chaque son en mp3 48 kbps mono 24 kHz (ffmpeg), concatène dans
  `packages/app/public/assets/audio/sounds.bin`, écrit `sounds-manifest.json` : `sounds: {id: [offset,
  length]}`, `moves: {moveId: [{atMs, sound, volume, rate}]}`, `hits: {normal, strong, weak}`,
  `cries: {speciesId: soundId}`. Précédent : `pack-sprites.ts` / `sprite-bundle.ts`.
- Script racine : `"build-audio": "tsx scripts/build-audio.ts"` dans `package.json` (à côté de
  `pack-sprites`, `build-move-effects`). Sortie dans `packages/app/public/assets/audio/` (même patron
  que `BUNDLE_DIR` de `scripts/pack-sprites.ts`).
- Vérifie que le build reste sous le plafond de fichiers : `packages/app/vite.config.ts`,
  `stripNonShippedAssetsPlugin` (`ITCH_FILE_LIMIT = 1000`, avertissement à 900). Le build ne fait qu'un
  décompte : le +2 fichiers est à mesurer avant/après (`pnpm build`, ligne « N fichiers dans le build »).

### B. Moteur — `packages/app/src/audio/`

- `audio-player.ts` : **Web Audio natif** (et non Babylon AudioEngineV2, écarté), déverrouillé au premier
  geste, volume maître lu dans les réglages.
- `sound-bank.ts` : un `fetch` du `.bin` (paresseux, au premier besoin), découpe par l'index, décodage
  à la demande + cache.
- `battle-audio.ts` : récepteur des repères `onPresentationCue` (plan 233, `render-ports/src/ports.ts`,
  type `PresentationCue`) —
  `attack-start` (`attackerId`, `moveId`) → programme les bruitages de l'attaque, instants relatifs à
  ce repère ; `hit` (`targetId`, `effectiveness`, `critical`) → son de coup selon `effectiveness`
  (> 1 fort, < 1 faible, 0 rien ; critique → fort ; ×4 / ×¼ : voir Arbitrages) ; `faint` (`pokemonId`) →
  cri de l'espèce.
  - **Instantané** : l'orchestrateur émet `attack-start` / `impact` / `hit` **sans condition** (y compris
    en Instantané, `battle-orchestrator.ts` ~2596). Le filtrage « aucun son d'attaque » se fait donc
    dans le récepteur, via `isInstantCombat()` (`view-core/src/combat-pacing.ts`). Le `faint` reste.
  - **×2** : l'échelle vient de `combatClock` (`combat-pacing.ts`), le récepteur n'a pas à connaître la
    vitesse autrement.
  - **Cri de tour : le point d'accroche EXISTE.** `BattleOrchestrator.refreshUI()`
    (`battle-orchestrator.ts` ~1263) calcule `active = this.activePokemon()` à chaque tour, et
    `syncTurnClock()` (~1100) ouvre une nouvelle fenêtre seulement quand `state.actionCounter` change
    — `refreshUI()` tourne **plusieurs fois par tour**, donc il faut le même garde-fou (comparer
    `actionCounter` au dernier tour annoncé). Il n'y a pas de repère `turn-start` aujourd'hui : il faut
    en ajouter un (`{ kind: "turn-start", pokemonId }` dans l'union `PresentationCue`, émis depuis
    `refreshUI()` après le garde-fou). Les consommateurs qui switchent sur `kind` (atelier,
    `move-workshop.ts` `onCue`) doivent l'ignorer.
  - **Attention** : `refreshUI()` est aussi appelé au **premier** tour du combat (après les événements
    de démarrage). Sans filtre, le cri du premier actif sonnerait en début de combat — contraire à la
    décision « pas de cri à l'apparition ». À arbitrer (voir Risques).
- Le son est branché dans `runBattle` (réalisé ainsi, et non dans `runResolvedBattle`).
- **Calage des instants** : les `atMs` viennent des frames PokeRogue, calées sur **l'animation
  PokeRogue**, pas sur l'animation PMD de Pokémon Tactics (`playAttack`, `impactMs` de `Effect`).
  Décision à prendre avant l'étape 3 : ancrer sur `attack-start` (et accepter le décalage, à reprendre
  à la recette) ou ancrer sur `impact` (et recaler `atMs` sur le frame d'impact). Le `pitch` PokeRogue
  est en unité à définir (100 = neutre ?) : sa conversion en `rate` n'est pas écrite.

### C. Réglages

- `settings/index.ts` : `volume` (0-100, curseur ; sourdine séparée qui garde le volume, défaut 75), `turnCries` (`none` / `mine` / `all`,
  défaut `mine`). Ajouter les
  champs à `GameSettings` **et** `DEFAULT_SETTINGS`. `mergeWithDefaults` ne contrôle que le `typeof` :
  il laisse passer `volume: 42` ou `volume: "75"` → **il faut une liste blanche** (sur le modèle de
  `COMBAT_SPEEDS`, lignes 87-90) pour le volume. `updateSettings` applique le volume au moteur (modèle
  `setCombatSpeed`, ligne 123). `settings/index.test.ts` (littéraux complets lignes 13 et 64) à mettre à jour.
- `settings-panel.ts` (`createSettingsPanel`) : deux `menuButton` en bascule, sur le modèle du bouton
  Vitesse (lignes 113-124, `data-testid`, libellé `t(...)` recalculé au clic). Télémétrie : chaque
  action doit être déclarée dans `packages/app/src/analytics/telemetry-contract.ts` (enum
  `TelemetryAction`, cf. `CombatSpeedNormal` ligne 82) avant d'être comptée. i18n : clés dans
  `i18n/types.ts` puis fr/en/es (`locales/*.ts`).

### D. Constructeur d'équipe et atelier

- `packages/app/src/ui/team/TeamEditView.ts` : cri de l'espèce dans le `onSelect` de
  `openPokemonPickerModal` (~ligne 267). Le cri joue au clic de choix, pas à l'ouverture.
- Atelier (`packages/app/src/babylon/move-workshop-timeline.ts`) : les pistes `attackerSound` et
  `targetSound` **existent déjà**, grisées par `FUTURE_TRACKS` (lignes 64-69, rangées ~114). « Dégriser »
  = les sortir de `FUTURE_TRACKS` et y poser les marqueurs. Libellés `atelier.track.*` déjà présents.
  La lecture audible passe par le même moteur que la partie.

### E. Crédits et docs

- `CREDITS.md` + écran Crédits : sons d'attaque (Pokémon Reborn via PokeRogue), sons de coup
  (PokeRogue / Nintendo), cris (Pokémon Showdown). fr/en/es.
- `docs/architecture.md` (module audio, script, paquet).

## Étapes

- [x] 1 — `scripts/build-audio.ts`, `.gitignore`, script `package.json`, paquet généré et commité.
- [x] 2 — Moteur audio + banque.
- [x] 3 — Récepteur combat (attaques, coups, K.O., cri de tour), Instantané, ×2. Inclut : ajout du
  repère `turn-start` (render-ports `ports.ts` + émission dans `battle-orchestrator.ts` `refreshUI()`,
  dédoublonné sur `actionCounter`), câblage de `runResolvedBattle` → `runBattle`, et le choix d'ancrage
  des instants (voir Comment B).
- [x] 4 — Réglages (store, panneau, i18n).
- [x] 5 — Cri au constructeur d'équipe ; piste Son de l'atelier.
- [x] 6 — Crédits, docs.

Tests unitaires du core : aucun (le core ne bouge pas). Le mapping efficacité → son et la mise à
l'échelle des instants sont des fonctions pures testées au menu de finalisation.

## Critères de complétion

- Les 511 attaques couvertes jouent leurs bruitages aux bons instants, en Normal et ×2.
- Coups normal / fort / faible audibles et distincts ; rien sur une immunité.
- Cris au K.O., au début du tour (coupable), au constructeur d'équipe.
- Volume Coupé = silence total. Réglages persistés, joignables clavier / pad / doigt.
- Build ≤ 1000 fichiers ; Safari iOS joue le son après le premier geste.

## Risques / Questions

- **Ancrage des instants** (Comment B) : décalage possible entre frames PokeRogue et animation PMD.
  Question ouverte, à trancher avant l'étape 3.
- **Cri au premier tour** : le premier `turn-start` du combat tombe au démarrage. Faut-il le supprimer
  (ne pas annoncer le premier acteur) ? Question de cadrage, pas d'équilibrage.
- **Immunité et repère `hit`** : le `hit` est émis par `playImpact` / `playStrike`
  (`battle-orchestrator.ts` ~2851 / 2866), donc seulement pour les coups qui arrivent à un strike.
  Non vérifié : une immunité produit-elle un strike à `effectiveness: 0` ? Si non, « rien sur une
  immunité » est automatique ; si oui, le récepteur filtre sur 0.
- **Pitch PokeRogue** : unité et conversion en `rate` à définir (voir Comment B).
- **Babylon AudioEngineV2** : écarté, Web Audio natif retenu.
- **Provenance / licence** : les 671 sons Reborn sont des rips de jeux Nintendo retouchés par des fans.
  Le paquet est commité (même régime que les sprites CC BY-NC, décision 1138). Le texte des Crédits
  (étape 6) doit le dire tel quel. Arbitrage humain si le régime doit changer.
- **Recherche PokeRogue (chiffres 511 / 1 004 / 696, 6,5 Mo)** : issue d'une mesure du 2026-10-09,
  non re-mesurée lors de cette relecture.

## Dépendances

- Plan 233 (repères de présentation `onPresentationCue`) : fait.
- Plan 234 (effets de coup, `impactMs`) : fait, sert au calage.
- Plan 236 (plafond itch.io, `stripNonShippedAssetsPlugin`) : fait.
- Plan 237 (sources hors `public/`, `assets-src/`) : fait. `assets-src/audio/` s'y ajoute en gitignore.
- Plan musique (à venir) : réutilise le volume et le moteur audio de ce lot.

## Retours de recette (2026-10-09, scénario 1)

- **« Ça va trop vite »** — trois pauses, demandées par l'humain, chiffrées d'après une recherche
  (ordre du K.O. de PokeRogue, `faint-phase.ts`) : la fin d'une attaque attend ses bruitages
  (plafond 1,2 s depuis son début) ; pause de 500 ms quand le tour change de main ; au K.O., le cri
  joue en entier (plafond 2,5 s), puis la chute, puis 600 ms. Mécanisme : `presentationSettled`
  (render-ports), que l'orchestrateur attend ; constantes `ACTION_PAUSE_MS` / `KO_PAUSE_MS`
  (combat-pacing).
- **Vitesse Rapide supprimée** (humain : « on ne pourra pas aller plus vite que les cris ») : Normale
  et Instantanée seulement. En Instantanée, seuls les sons de coup (l'efficacité) restent.
- **Cri de K.O. joué deux fois** : `PokemonKo` puis `PokemonEliminated` déclenchaient chacun la
  chute — une seule par K.O. désormais (jusqu'à une éventuelle réanimation).
- **Cris coupés / pas fidèles** : plus aucun cri tronqué (tour, K.O., Rugissement & co.). Source
  passée de Showdown à **PokeAPI/cries `latest`** (cris des jeux actuels), encodés en 44,1 kHz /
  96 kbps au lieu de 24 kHz / 48 kbps qui les étouffait. Sons de coup idem.
- **Volume** : curseur 0-100 (pas de 5) + bouton sourdine qui affiche la valeur ; la sourdine garde
  le volume. Le cri de tour à trois états est conservé (« bonne idée »).
- **Écrans de menu** : défilent quand ils débordent (Réglages à 568×320 dépassait de 3 px).

## Retours de recette (suite, 2026-10-10) — ~25 retours sur 5 scénarios

- **Sourdine** : bouton en icône (au lieu d'un libellé qui affichait la valeur).
- **Talent Engrais (et Brasier / Torrent) annoncé au K.O.** : corrigé dans
  `packages/data/src/abilities/ability-definitions.ts`.
- **Cri de tour** : joué après le déplacement de caméra ; l'IA attend la fin du cri. Plus de pause fixe
  entre les tours : la pause de 500 ms après chaque action a été essayée puis retirée (« ça casse la
  fluidité »). Restent la fin de bruitage (≤ 2 s) et la séquence du K.O. (cri entier, chute, 600 ms).
- **Bruitage d'attaque** plafonné à 2 s avec fondu.
- **Sons d'effets** accrochés à nos propres effets visuels : soin, drain de Vampigraine au tic de fin de
  tour (champ `drainedBy` sur `DamageDealt`), statuts, montée / baisse de stat, protection.
- **6 attaques muettes** dotées du son d'une attaque voisine (table `MOVE_SOUND_BORROWS` de
  `scripts/build-audio.ts`).
- **Atelier** : barres de durée ; le son suit pause / scrub / ralenti (`combat-voices.ts`) ; pas de cri
  de tour.
- **Navigation spatiale** : écart transverse d'intervalle à intervalle + départage au plus centré
  (`focus-navigation.ts`) — solde le constat de `directionalScore` du 2026-10-09.
- **Écrans de menu défilables.**
- **Source des sons d'attaque** (Reborn via PokeRogue) **gardée** après écoute ; recherche des sources
  officielles : graphe, `reflexion-2026-10-10-sources-sons-officiels`.

### Correctif du gate (2026-10-10)

- Le premier calcul de navigation (écart d'intervalle seul) cassait le salon en ligne : ↓ depuis
  « Créer » allait sur « Coller » au lieu de la roue de code. Forme retenue : bord à bord + écart
  d'intervalle × 2 + décalage des centres × 1,5 (decision-1161, révisée).
- Ligne Volume réglée par la mise en page : le curseur tient la colonne des commandes, la sourdine
  en icône est à sa gauche. Clavier : Entrée sur le curseur coupe / remet le son ; manette : A.
