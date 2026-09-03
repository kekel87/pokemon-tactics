# Plan 197 — Écran de victoire enrichi

> **Statut** : done
> **Créé** : 2026-09-03
> **Terminé** : 2026-09-03 — livré, testé et validé à la main.
> **Lot C de la Phase 7** — plan-cadre : `docs/plans/195-phase7-multijoueur-telemetrie.md`
> **Périmètre arrêté avec l'humain le 2026-09-03** (voir § Périmètre) : portraits de l'équipe du
> vainqueur avec les K.O. grisés, plus le nombre de tours et la durée. **Pas de MVP**, pas de camp
> perdant, pas d'infobulle de cause de K.O.

## Motivation

La dialog de fin de partie (`battle-chrome.ts` `showVictory`) affiche aujourd'hui un verdict et deux
boutons. Elle dit **qui** a gagné, jamais **comment**. Une rangée de portraits où les K.O. sont grisés
raconte à quel prix : un 6-0 et un 6-5 ne se ressemblent pas.

Le Lot C tient dans la Phase 7 parce qu'il partage sa matière avec l'événement `battle_ended` du
Lot A (plan 196) — définir ce que la télémétrie collecte, c'est définir ce que cet écran peut
montrer. La dépendance porte sur la **donnée**, pas sur le code : ce plan ne touche pas à la
télémétrie.

## Périmètre — ce qui est dedans, ce qui n'y est pas

Tranché par l'humain le 2026-09-03, sur menu.

**Dedans :**
1. Une rangée de portraits de l'équipe du vainqueur, K.O. grisés.
2. Une ligne « N tours · M min S ».

**Dehors, et pourquoi :**
- **MVP** — écarté. `DamageDealt` ne porte que `targetId`, `PokemonKo` que `pokemonId` : **aucun
  événement du core ne nomme l'attaquant**. Il faudrait corréler chaque K.O. avec le `MoveStarted`
  précédent (le collecteur de télémétrie fait déjà ce tour de passe-passe pour la *cause*), puis
  trancher une définition (K.O. infligés ? dégâts cumulés ?) — et vivre avec les trous : chute,
  terrain létal, sortie d'arène et recul n'ont pas d'attaquant. `pokemon.lastHitBy` existe mais est
  **effacé au K.O.** (`BattleEngine.ts`, nettoyage du corps), donc inutilisable ici. À rouvrir
  seulement si l'écran paraît vide en recette.
- **Camp perdant (2ᵉ rangée)** — écarté : double la hauteur de la dialog, et à 12 camps c'est
  ingérable (il faudrait la restreindre au 1v1).
- **Cause du K.O. au survol** — écartée. Les 4 causes sont pourtant déjà collectées ; l'argument qui
  a compté est qu'une infobulle au survol est **invisible au clavier et à la manette**, ce qui la
  rendrait inéquitable après tout le travail du Lot 2 de la Phase 6.5.

## Ce que l'exploration a établi (2026-09-03) — à ne pas re-chercher

Trois points vérifiés dans le code avant d'écrire ce plan. Ils cadrent l'implémentation.

### 1. Aucun problème d'architecture — la dialog résout ses portraits elle-même

`UiDomConfig` étend `I18nContext` (`packages/render-ports/src/i18n-context.ts`), qui déclare
`getPortraitUrl(definitionId: string): string`. `battle-chrome.ts` reçoit déjà ce `config` et s'en sert
pour `config.translate`. **La dialog appelle donc `config.getPortraitUrl` directement**, exactement
comme elle appelle `config.translate`.

> Une première lecture avait conclu qu'il fallait remonter `createTeamPortraitsElement`
> (`packages/app/src/ui/team-select/TeamPortraits.ts`) de `app` vers `ui-dom` parce que `app` dépend de
> `ui-dom` et pas l'inverse. **C'est faux** : le seam existait déjà. Le précédent est
> `info-panel.ts`, qui reçoit un `data.portraitUrl` construit par `battle-views.ts:476`
> (`context.getPortraitUrl(pokemon.definitionId)`).

### 2. Un Pokemon K.O. reste dans l'état — rien à collecter

Aucun `delete` sur `state.pokemon` dans `BattleEngine`. Un Pokemon K.O. y reste avec `currentHp` à 0 ;
`PokemonEliminated` (sortie d'arène, « Le Mur ») **ne le retire pas non plus**, il ne fait qu'émettre
l'événement. La rangée se construit donc intégralement depuis `state.pokemon` filtré sur le `playerId`
du vainqueur, au moment de `enterBattleOver`. **Aucune collecte d'événements nouvelle.**

### 3. La durée a un piège ; le nombre de tours n'en a pas

`BattleState` **ne porte pas de compteur de tours**. Il porte `actionCounter` — horloge monotone
incrémentée une fois par action terminée (`BattleEngine.ts:3393`). C'est la bonne source :
elle est **immunisée à la reprise**, puisque rejouer les actions sauvegardées la réincrémente.

La durée, elle, n'a pas d'équivalent. `BattleResumeSave` (`packages/app/src/app/battle-persistence.ts`)
stocke `setup`/`placementTeams`/`placements`/`seed`/`actions` — **aucun horodatage**. Une durée mesurée à
la construction de l'orchestrateur n'afficherait donc, sur une partie reprise après rechargement, que
le temps écoulé *depuis le rechargement*. Silencieusement faux.

**Correctif retenu (révisé après code-review)** : un champ `elapsedMs?: number` dans
`BattleResumeSave` — un temps **cumulé**, pas un horodatage de départ.
- `persist()` réécrit la sauvegarde à chaque action, donc y grave le temps de jeu accumulé à cet
  instant. Chaque montage repart de cette valeur et y ajoute sa propre tranche
  (`previousElapsedMs + (Date.now() - mountedAt)`).
- Un **horodatage absolu** aurait été faux dans l'autre sens : une partie commencée le soir et reprise
  le lendemain aurait affiché « 843 min 12 », en comptant le temps passé la partie fermée. Le plan
  écartait à raison « la durée depuis le rechargement » ; cette symétrie-là avait été manquée, et la
  code-review l'a relevée (arbitrage humain du 2026-09-03 : temps de jeu réel).
- Comme les trois chemins (partie fraîche, reprise, bac à sable) fournissent tous ce temps, la durée
  est **toujours** disponible : `durationMs` est requis dans `BattleOutcomeSummary`, et la branche
  « pas de durée » — que rien n'aurait pu tester — n'existe pas.
- Un `elapsedMs` non numérique (stockage corrompu) est **neutralisé** au chargement, jamais fatal :
  jeter la sauvegarde coûterait la partie pour un champ d'affichage.

> ⚠️ La justification initiale de ce champ (« facultatif pour ne pas jeter les sauvegardes
> antérieures ») était **fausse**, la code-review l'a démontré : `isValidSave` rejette d'abord sur
> `buildVersion`, et `__APP_VERSION__` vaut `git describe --dirty` — donc il change à chaque commit et
> aucune sauvegarde d'un autre build n'atteint jamais ce champ. Il est facultatif parce que le type le
> permet sans coût, pas pour compatibilité ascendante.

## Étapes

1. **Étendre le port `showVictory`** (`packages/render-ports/src/ports.ts`). Il ne recevait que
   `winnerId`. Il reçoit en plus un `BattleOutcomeSummary` : effectif du vainqueur (`definitionId` +
   `ko` par membre), `turns`, `durationMs`. Le `winnerId` reste : le titre en dépend.
2. **Construire le récapitulatif** dans `buildOutcomeSummary`
   (`packages/view-core/src/battle-outcome-summary.ts`), appelé par `enterBattleOver`. Fonction
   **libre** et non méthode privée : purement calculatoire, donc testable sans monter un orchestrateur
   entier (moteur, plateau, chrome, contexte de présentation). Lit `state.pokemon` et
   `state.actionCounter`, reçoit le temps de jeu déjà calculé.
3. **Enrichir la dialog** (`battle-chrome.ts`) : rangée de portraits via `config.getPortraitUrl`,
   K.O. grisés, ligne de statistiques sous les portraits, boutons inchangés. Le titre ne bouge pas.
4. **Temps de jeu cumulé** : `elapsedMs?: number` dans `BattleResumeSave` ; l'écran de combat
   accumule (`previousElapsedMs + (Date.now() - mountedAt)`) et expose un `getElapsedMs()` à la config
   d'orchestrateur. Les trois chemins le fournissent — partie fraîche, reprise, bac à sable.
5. **Traductions** FR + EN pour la ligne de statistiques (`packages/app/src/i18n/locales/`). Le type
   `Translations` fait échouer le typecheck tant qu'une locale est incomplète (acquis du plan 190).
   Clé singulière dédiée pour « 1 tour » : `translate` ne fait qu'un remplacement de gabarit, le
   projet n'a aucun mécanisme de pluriel — et « 1 tours » est atteignable.
6. **Styles** : grisement des K.O. (opacité **et** désaturation — plusieurs portraits Gen 1 sont déjà
   quasi monochromes), dimensions des portraits. Le token `--bc-victory-portrait-size` rejoint les
   autres `--bc-*` sur `:where(.bc-root, .bc-left-col)` et suit `--ui-scale` comme eux : la dialog est
   appendue à `.bc-root`, elle hérite donc bien de ses jetons.

## Vérifications

- **Match nul** : `winnerId === null`. Pas d'équipe vainqueur → **pas de rangée de portraits**, la
  ligne de statistiques reste. Le message de match nul existant est conservé.
- **Mort environnementale** : un Pokemon tué par chute, terrain infranchissable ou terrain létal doit
  apparaître **grisé**, pas absent.

  > ⚠️ La formulation initiale de ce point — « éliminé **sans K.O. préalable**, cas de la sortie
  > d'arène » — était **fausse**, relevée indépendamment par la code-review et par `test-writer`.
  > Aucun chemin du moteur n'éjecte un Pokemon hors de la grille : `resolveKnockbackDestination`
  > (`knockback-prediction.ts:63`) renvoie `blockedReason: "edge"` et la cible s'arrête au bord. Les
  > trois morts environnementales mettent les PV à zéro **et** émettent `PokemonKo`. Le seul
  > `handleKo` sans `PokemonKo` est `applyGroundingTerrainTick` (`BattleEngine.ts:1420` — Anti-Air ou
  > fin de Vol Magnétik au-dessus de la lave), non pilotable simplement en bac à sable. La propriété
  > à protéger reste la même — *le corps reste dans `state.pokemon`, le portrait est grisé et non
  > absent* — et l'e2e la couvre par un allié abattu en cours de combat par tir allié.
- **Reprise après rechargement** : le temps de jeu reprend où il s'était arrêté ; le temps passé la
  partie fermée n'est pas compté.
- **Durée de combat ≠ durée de session.** L'écran démarre son compteur au premier tour, **placement
  exclu** ; la télémétrie horodate dans `mountPlacement`, **placement compris** (décision #857, plan
  196). Les deux chiffres décrivent la même partie et ne coïncideront pas — l'écart vaut toute la
  phase de placement, quelques secondes en auto-placement, plusieurs minutes en manuel. **Divergence
  assumée** (arbitrage humain du 2026-09-03) : « durée de combat » à l'écran, « durée de session » en
  télémétrie.
- **Bac à sable** : les deux camps peuvent être « joueur ». La formulation reste « l'équipe du
  vainqueur », jamais « ton équipe » — `showVictory` ne connaît pas le camp local, et le commentaire
  existant de `battle-chrome.ts` pose déjà cette règle pour le titre.
- **e2e** : le testid `battle-over` de la dialog est utilisé par le harnais (plan 194) — **ne pas le
  déplacer ni le renommer**.

## Décisions à inscrire dans `docs/decisions.md`

- Périmètre du Lot C réduit aux portraits + tours/durée ; MVP écarté faute d'attribution d'attaquant
  dans les événements du core, infobulle de cause écartée parce qu'inaccessible au clavier/manette.
- `elapsedMs` (temps cumulé) dans la sauvegarde plutôt qu'un horodatage de départ : une partie reprise
  doit afficher les minutes jouées, pas les heures écoulées.
- La durée de l'écran de victoire exclut le placement, celle de la télémétrie l'inclut : deux
  sémantiques distinctes et assumées, pas un bug à réconcilier.
