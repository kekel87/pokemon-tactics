# Backlog — Archive des résolus

Items du backlog déjà résolus, archivés ici pour traçabilité (raisons fix, dates, références plans/commits).

**Pas chargé par défaut** par les skills (`/next`, `session-closer`). Lecture sur demande humain ou pour audit régression.

Source de vérité primaire : git log + commit messages + `docs/plans/` + `docs/decisions.md`. Cette archive = vue lisible thématique.

---

## Animation Faint absente pour la majorité du roster — CLÔTURÉ non-actionnable (2026-07-22)

- **Contexte (2026-06-18)** : seuls **29/152** atlas du roster embarquent une animation `Faint` ; les 123 autres (dont Florizarre) ne jouent aucun effondrement au KO (assombrissement + masquage HUD uniquement). La « cause supposée » du backlog était un gap `extract-sprites` à corriger.
- **Investigation (2026-07-22)** : `extract-sprites` **demande déjà** `Faint` (présent dans `scripts/sprite-config.json`) et résout les alias `CopyOf`. Le vrai gap est **amont** : la source PMDCollab **n'a pas de sheet `Faint`** pour ces 123 Pokemon — rien à télécharger. Un « re-dl des Faint » est donc impossible sans re-rip depuis une autre source.
- **Fallback tenté puis abandonné (décision humaine)** : jouer `Sleep` (couché) gelé quand `Faint` manque. Bloqueur découvert : dans la source PMDCollab, `Sleep` **n'existe que pour la direction Sud** (convention PMD — on dort face caméra), alors qu'`Idle` a les 8 directions. Un KO'd sprite ne faisant pas face Sud → `hasAnimation("Sleep")` faux → fallback silencieusement inopérant (confirmé runtime : Florizarre K.O. restait en `Idle`). Le rendre fonctionnel aurait exigé de verrouiller l'orientation Sud des sprites K.O. + `faintPose` toutes-directions — jugé disproportionné pour le gain. **Tout le code du fallback a été reverté** (arbre propre, aucune trace).
- **Décision** : ne rien faire. L'assombrissement au KO reste le comportement. Rouvrir seulement si un jour le roster est re-rippé depuis une source fournissant `Faint` multi-direction (ou `Sleep` multi-direction). Non lié à un bug code.

## IA — CT-aware scoring — RÉSOLU (plan 165, 2026-07-21)

- **Contexte (2026-04-25)** : le CT (Charge Time) était totalement ignoré du scoring IA (scorer greedy monoronde). Un premier essai (plan 068 étape 2, `score *= CT_REFERENCE_COST / ctCost` appliqué à tout le score) avait été rejeté : la division frappait aussi la composante KO, un KO lent devenait moins bien noté qu'un chip rapide → combats **>5000 tours** en charge. Le backlog affirmait qu'un **lookahead multi-tour** (prédiction ordre CT, évaluation N tours) était nécessaire pour corriger ça.
- **Résolution (plan 165)** : approche **heuristique KO-protégé** retenue à la place du lookahead multi-tour initialement supposé nécessaire — pas de simulation, juste une exemption ciblée. Nouvelle const `CT_REFERENCE_COST = 500` + fonction `applyCtWeight(score, securesKo, move)` dans `packages/core/src/ai/action-scorer.ts` : le score d'un move offensif du chemin générique de `scoreUseMove` est multiplié par `min(1, 500/computeMoveCost(pp, power, effectTier))`, **sauf** si le move sécurise un KO (dégât direct ou ring-out létal), auquel cas il garde sa pleine valeur — un KO retire une menace définitivement (step-change), il n'est jamais pondéré par le tempo. Scores ≤ 0 non re-scalés.
- **Périmètre hors v1** (branches à `return` anticipé, non pondérées) : OHKO, Explosion/Destruction, Tout ou Rien, Souvenir, Vœu Soin, Croc Fatal, Balance/Effort, Transform, Buée Noire, stat-manip, self-buffs, moves alliés.
- **Tests** : 3 unitaires (`action-scorer.test.ts`) + 1 scénario de régression charge (`scenarios/ct-scoring-anti-drag.scenario.test.ts`, 6v6 CT, 8 seeds) — 83 à 303 actions par combat, plafond garde-fou 1000. Gate CI verte (unit + intégration 3879 tests).
- Détails formule/design : `docs/plans/165-ai-ct-aware-scoring.md`, `docs/ai-system.md` § Pondération CT.

---

## Trajectoire de vol Flying sur dénivelés — RÉSOLU DE FAIT (2026-07-21)

- **Contexte (2026-04-26)** : item écrit pour le renderer **Phaser** (`BattleScene`, `PokemonSprite.setRestingAnimation`, `JUMP_TWEEN_DURATION_MS`) — trajectoire de déplacement des Flying à améliorer (arc parabolique vs tween saut).
- **Statut réel** : le code Phaser cité est mort (migration Babylon). Le renderer Babylon gère déjà glide/flyover/atterrissage des flyers (`packages/render-babylon/src/combat-scene.ts` ~L637-724 : `selectMovementAnimation`, `isFlyoverTerrain`, `applyLandingRestingAnimation`). Reliquat caduc → retiré du backlog.

---

## Sprites originaux — plan B si DMCA Nintendo — RETIRÉ (2026-07-21)

- **Contexte (plan 096)** : contingence si DMCA (remplacer les 502 sprites PMDCollab par des créatures originales).
- **Statut** : déjà acté et documenté dans **décision #382** (stratégie IP). Redondant au backlog → retiré ; l'info de référence vit dans #382. Se réactive seulement si un DMCA survient.

---

## Sandbox — écrans actifs au boot (seed `state.screens`) — ABANDONNÉ (2026-07-21)

- **Contexte (plan 095 étape 14, non livrée v1)** : option panneau sandbox pour pré-poser un écran d'équipe (Mur Lumière / Protection / Brume / Rune Protect) au démarrage sans le caster.
- **Statut** : confort QA jugé insuffisant par l'humain → abandonné, retiré du backlog.

---

## Icône Tempête de Sable — symbole tourbillon perfectible — RÉSOLU (2026-07-21)

- **Contexte (2026-05-13, plan 084)** : icône Tempête de Sable acceptée provisoirement en PNG pixel-art. Le symbole vent (double spirale) était jugé moins reconnaissable que les 3 autres pictogrammes météo (Soleil/Pluie/Neige).
- **Résolution** : les 4 icônes météo (Soleil, Pluie, Neige, Tempête de Sable) refaites en **SVG vectoriel** (glyphe blanc contour noir sur losange coloré, dérivées des pictogrammes officiels), remplaçant les 4 PNG. `getWeatherIconUrl` (`packages/app/src/team/asset-paths.ts`) renvoie désormais `.svg`. Taille `.wh-icon` passée de 32u à 56u (icône trop petite en jeu). Voir `docs/design-system.md` § Icônes météo.

---

## Boussole 3D — placement/échelle toujours imparfaits — RÉSOLU (2026-07-20)

- **Contexte (2026-07-02, playtest plan 146)** : la boussole 3D always-on près du portrait actif (plan 145) avait toujours des problèmes de placement signalés par l'humain — reliquat déjà noté au plan 145 (offsets fixes fragiles au changement de résolution).
- **Résolution** : `BabylonCompass.pinToCorner` (`packages/render-babylon/src/babylon-compass.ts`) ancre désormais la boussole à une **position + taille écran constantes en pixels**, dérivées des spans de la projection ortho (`orthoLeft/Right/Top/Bottom`) et des dimensions de rendu courantes, calibrées sur une référence **1920×1080** — plus de taille/position fixées en unités monde. Invariant resize, zoom et résolution. Décision #688.

---

## Boussole / girouette d'orientation caméra — DÉJÀ FAIT (archivé 2026-07-20)

- **Contexte (2026-06-18)** : besoin exprimé d'un indicateur d'orientation caméra (la caméra Babylon tourne par snaps 90°, on perd vite le Nord).
- **Statut réel** : couvert par la boussole always-on (plan 145) — l'aiguille suit la rotation caméra en continu. Fix placement 2026-07-20 (ci-dessus) a réglé le seul reliquat (ancrage écran imprécis).

---

## Autocomplete bilingue — chercher en langue courante ET en anglais — RÉSOLU (2026-07-20)

- **Contexte (2026-05-31)** : les champs de recherche/autocomplete du Team Builder (moves, Pokemon, items) ne matchaient que sur le nom affiché dans la langue courante — un joueur FR connaissant le nom EN d'une attaque (ou inversement) ne pouvait pas la retrouver en tapant.
- **Résolution** : nouvel util `packages/app/src/team/search-index.ts` (`normalizeSearchText`, `buildSearchText`) — normalisation NFD (accents retirés) + suppression tirets/espaces + lowercase. Champ `searchText` précalculé dans `packages/app/src/team/team-builder-data.ts`, concaténant `names.fr` + `names.en` + l'id, appliqué aux 3 pickers (moves, Pokemon, items). Tolère accents, tirets, espaces et casse.

---

## Sandbox — pas de sélecteur de talent pour le Dummy dans l'UI — RÉSOLU (2026-07-20)

- **Contexte (2026-06-22, playtest plan 139)** : le `SandboxPanel` exposait un sélecteur de talent pour le joueur, mais aucun pour le Dummy — seul le champ JSON `dummyAbility` permettait de surcharger le talent du Dummy, imposant de passer par `pnpm dev:sandbox '{...}'` pour tester un talent défensif côté cible.
- **Résolution** : `<select>` talent Dummy ajouté dans `SandboxPanel.ts`, miroir exact du sélecteur joueur (`dummyAbilitySelect`).

---

## Sandbox — `seed` absent = seed 0 → bataille entièrement déterministe (surprenant) — RÉSOLU (2026-07-20)

- **Contexte (2026-06-22, playtest plan 139)** : lancer le sandbox sans champ `seed` utilisait `seed: 0` par défaut → toute bataille était identique à chaque lancement, masquant/faussant la validation manuelle d'effets probabilistes (flinch, effets secondaires %).
- **Résolution** : nouveau mode RNG explicite dans le `SandboxPanel` — **Aléatoire** (nouveau défaut, seed frais généré à chaque mount/replay via `resolveSandboxSeed`) vs **Déterministe** (seed éditable + bouton 🎲). `SandboxConfig.rngMode?: "random" | "deterministic"`, inféré rétro-compat depuis la présence du `seed` si absent (préserve tous les scénarios e2e). Décision #685.

---

## Le Mur — réintégrer + fixer IA (RÉSOLU plan 159, 2026-07-14, publié v2026.7.2)

- **Contexte (2026-04-23, relancé 2026-06-18)** : map `le-mur.tmj` retirée du menu. Après la rotation caméra Babylon (Phase 5) et le fix transparence (commit `082240c`), restait à la rendre disponible et à corriger l'IA : elle ne tentait pas de monter sur le mur (tirait à travers au lieu de prendre la hauteur), se perdait sur les chemins verticaux, et les Pokemon étaient jugés trop lents sur neige.
- **Résolution** : nouvelle carte « Le Mur » (`le-mur.tmj`, 16×16, mur pyramidal central h≈4.5, rampes latérales seules praticables, glace partout ailleurs) ajoutée au `MAPS_REGISTRY` — conçue pour la mécanique de ring-out (recul → glissade sur glace → chute mortelle). L'IA maîtrise désormais la carte : lookahead relief corrigé (`estimateDamage` calcule hauteur/terrain/facing depuis la case candidate + garde ligne de vue `hasLineOfSightFrom` → l'IA grimpe le plateau pour tirer en surplomb, plus de « sniper fantôme » à travers le mur), et `scoreKnockbackRingOut` valorise Draco-Queue/Coud'Krâne/Draco-Charge quand le recul éjecte un ennemi vers une chute ou un terrain létal. Diagnostic agent `ai-player` : combat sain (6/6 vainqueurs, franchissement par les rampes, pas de stall — la lenteur neige n'était plus un blocage). Décisions #660–#665.

---

## Tag tooltip `superVsWater` hardcodé pour `typeEffectivenessOverride` — RÉSOLU (2026-07-19)

- **Contexte (2026-06-05, plan 113)** : `MoveTooltip.ts` affichait le tag `moveTooltip.tag.superVsWater` ("×2 sur les types Eau") pour tout move ayant `typeEffectivenessOverride !== undefined`. Le champ est générique (`{ against: PokemonType; multiplier: number }`) mais le tag était codé en dur pour l'Eau. Risque : un futur move overridant un autre type (ex ×2 Feu) afficherait un tag faux. 1 seul move concerné à l'époque (Lyophilisation).
- **Résolution** : `packages/ui-dom/src/move-tooltip.ts` construit désormais le tag dynamiquement depuis `against`/`multiplier` via la clé i18n paramétrée `moveTooltip.tag.typeEffectivenessOverride` ("×{multiplier} sur les types {type}"), résolvant le nom de type via 18 nouvelles clés i18n `pokemonType.<id>` (FR+EN, une par type Pokemon). Correct pour n'importe quel type/multiplicateur futur, sans limitation à l'Eau.

---

## Coups fantômes — attaquant K.O. par recul de contact (Casque Brut) continuait un move multi-coups — RÉSOLU (2026-07-19)

- **Contexte** : la boucle multi-coups de `packages/core/src/battle/handlers/handle-damage.ts` ne breakait que sur mort de la **cible** (`target.currentHp <= 0`), jamais de l'**attaquant**. Casque Brut (`rocky-helmet`) retire des PV à l'attaquant par coup de contact reçu ; sur un move contact multi-coups (Double Pied ×2) lancé par un attaquant bas PV, le recul du coup 1 pouvait le mettre K.O. et le coup 2 partait quand même (Pokemon mort qui frappe).
- **Note correctrice** : l'ancienne entrée backlog affirmait à tort que « Casque Brut n'est pas implémenté » et que le bug était « inatteignable / moot » — c'était faux, Casque Brut est bien implémenté et le bug était reproductible.
- **Fix** : `if (context.attacker.currentHp <= 0) break;` en tête de boucle — un move multi-coups s'arrête quand l'utilisateur s'évanouit (canon). Pose le garde latent identifié « à poser en même temps que Peau Dure/Casque Brut » ; couvre aussi Peau Dure (`rough-skin`, futur talent). Test d'intégration ajouté. Décision #678.

---

## Orbe de vie qui « tick » plusieurs fois sur un move de zone — RÉSOLU (2026-07-19)

- **Contexte (2026-06-19, playtest plan 133)** : sur un move de zone/multi-coup, l'orbe de PV (`life-orb`) semblait se décrémenter en plusieurs paliers au lieu d'un seul.
- **Cause racine** : le hook item attaquant `onAfterMoveDamageDealt` (recul Orbe Vie, soin Grelot Coque, consommation Joyau Normal) était appelé **dans** `dealSingleHit` — donc 1× par coup infligé. Sur un move multi-coups (ex Double Pied ×2), le recul Orbe Vie s'appliquait 2× au lieu d'1×.
- **Fix** : `packages/core/src/battle/handlers/handle-damage.ts` — les dégâts sont désormais accumulés sur tous les coups/cibles de l'action, et le hook `onAfterMoveDamageDealt` n'est appelé **qu'une fois** en fin de `handleDamage`, sur le total. Test d'intégration ajouté (recul Orbe Vie 1×/move total, y compris multi-cibles).
- **Casque Brut** (`rocky-helmet`, recul contact par coup, `onAfterDamageReceived`) **non touché** — reste par coup, canon correct (chaque coup de contact reçu déclenche son propre recul).

---

## Anim Volant : transition de mode en déplacement — RÉSOLU (2026-07-19)

- **Contexte (2026-07-03/07, human-testing Phazing/Anti-Air)** : trois sous-bugs distincts sur l'animation vol↔marche d'un Pokemon Volant.
  1. **Repos non terrain-aware** — `refreshGravityGrounding` (battle-orchestrator) → `setGroundedByGravity(id, false)` (combat-scene) forçait `FlyingIdle` sur **tout** Volant aéroporté sans regarder le terrain après chaque `syncBoard`, écrasant le resting terrain-aware de `applyLandingRestingAnimation`.
  2. **Glace non fly-over** — un Volant marchait sur la glace au lieu de voler au-dessus.
  3. **Transition trop tôt en déplacement (bug C)** — l'animation d'un pas (`moveBillboardAlongPath`, `getFlyingAnimationMode`) était choisie sur le terrain de **destination** et jouée pendant tout le tween → le Volant changeait de mode (vol↔marche) en **quittant** la case, pas en **arrivant**.
- **Résolution (1) et (2) — 2026-07-19** : `setGroundedByGravity` et `applyLandingRestingAnimation` rendus terrain-aware via `isFlyoverTerrain` (`packages/view-core/src/movement-animation.ts`) — un Volant se **pose** (`Idle`) sur sol praticable (normal, herbe haute) et **plane** (`FlyingIdle`) sur terrain fly-over (eau, eau profonde, lave, magma, marécage, sable, neige, glace, obstacle). `TerrainType.Ice` ajouté à `FLYING_OVERFLY_TERRAINS`. Validé live (Roucarnage, hook e2e `spriteStates`) + tests unitaires (`movement-animation.test.ts`).
- **Résolution (3) bug C — 2026-07-19** : `packages/render-babylon/src/combat-scene.ts` — le changement de mode se fait désormais à la **frontière entre les 2 cases** (mi-tween) au lieu du départ. `tweenRootPosition` reçoit un callback `onMidpoint` (fire à progress≥0.5) ; pour un pas plat, l'anim est jouée selon le terrain **source** au départ puis basculée sur le terrain **destination** à mi-parcours. Les **sauts/dénivelés** (montée/descente de cliff) restent inchangés (branche `isJumpStep` identique à l'ancien code).
- Validé visuellement par l'humain : transitions plates, dénivelés et décors OK. Bug de l'anim des Volants entièrement clos (les 3 volets).

---

## Style dupliqué entre couche DOM et couche 3D Babylon — audit : quasi-totalité code mort (RÉSOLU 2026-07-19)

- **Contexte (2026-05-19)** : deux sources de vérité suspectées pour les couleurs/police — DOM lit `packages/app/src/styles/tokens.css` (variables `--…`), le moteur 3D lit des constantes TypeScript en hexa `0x…` séparées (`render-babylon`, `view-core`/`render-ports`). Risque supposé : même valeur déclarée plusieurs fois, incohérence à chaque changement (ex fond `#1a1a2e` écrit 3× : `--blue-850` / `BACKGROUND_COLOR` / `BABYLON_CLEAR_COLOR`).
- **Audit (2026-07-19, plan 164)** : la prétendue duplication était en quasi-totalité du **code mort** dans `packages/app/src/constants.ts` (`BACKGROUND_COLOR`, `BACKGROUND_COLOR_CSS`, `TYPE_COLORS`, `TEXT_COLOR_*`, `FONT_FAMILY` — 0 usage réel, en plus des constantes de positionnement déjà purgées le même jour `INFO_PANEL_*`/`ACTION_MENU_*`/`TIMELINE_*`/`BATTLE_LOG_*`/`DEPTH_BATTLE_LOG`). Les valeurs réellement vivantes et partagées étaient déjà en source unique dans `packages/view-core` + `packages/render-ports`.
- **Résolution** : (a) purge du bloc mort de `packages/app/src/constants.ts` ; (b) test de parité `packages/app/src/styles/tokens-parity.test.ts` verrouillant le résidu vivant DOM↔TS (`FONT_FAMILY` ↔ `--font-family`, `TEAM_COLORS` ↔ `--team-N`) ; (c) codegen (génération automatique CSS↔TS) envisagé puis **abandonné** — sur-ingénierie pour ce qu'il reste à synchroniser. Plan `docs/plans/164-design-tokens-centralization.md` clos `abandoned` avec le verdict d'audit. Décision #680.

---

## 51 pré-évolutions Gen 1 sans nom FR/EN — affichaient l'ID anglais (RÉSOLU 2026-07-19)

- **Contexte (2026-06-29, human-testing plan 144)** : `packages/data/src/i18n/pokemon-names.{fr,en}.json` ne contenait que ~100 entrées (décompte initial approximatif). Les pré-évolutions ajoutées au plan 135 (ex: `clefairy` → devrait être Mélofée) n'avaient jamais reçu leur nom FR/EN, et s'affichaient par leur ID anglais brut (InfoPanel combat, Team Builder, sélection). Repéré en human-testing move-copy (Mélofée affichée « clefairy »).
- **Résolution** : décompte réel = **51** entrées manquantes (pas ~70). Ajoutées aux deux fichiers `pokemon-names.fr.json`/`pokemon-names.en.json`, tirées de `packages/data/reference/pokemon.json` (`names.fr`/`names.en`). Les 151 Pokemon jouables + le Dummy ont désormais chacun leur nom FR et EN — fichiers à 152 clés chacune. Vérifié en human-testing (Mélofée, Magicarpe affichent leur nom FR en jeu).

---

## Talent « par défaut » silencieux — UI sandbox (RÉSOLU 2026-06-22, décision #549)

- **Contexte (2026-06-21, plan 136)** : le `<select>` talent du SandboxPanel proposait une option vide « (défaut) » (valeur `""`) qui activait silencieusement `ability1` sans l'indiquer. Confusion QA : on ne savait pas quel talent tournait réellement.
- **Résolution** : option vide supprimée. Le `<select>` appelle désormais `getFirstAbility()` et pré-sélectionne toujours un talent concret affiché par son nom FR. Clé i18n `sandbox.abilityDefault` retirée (fr/en/types). Décision #549.
- **Périmètre traité** : UI sandbox uniquement. Le chemin jeu normal/CLI (`playerAbility`/`dummyAbility` omis dans `SandboxConfig` → engine utilise `ability1` espèce — comportement acceptable, pas de mensonge UI). Les ~30 fixtures e2e qui omettent `playerAbility`/`dummyAbility` continuent de fonctionner (`SandboxConfig` fields gardés OPTIONNELS).
- **InfoPanel combat** — afficher le talent actif en cours de combat : explicitly hors scope, différé.

---

## `tacticalOverrides.flags` écrase les flags reference — RÉSOLU (2026-06-28)

- **Contexte (2026-05-31, review plan 102)** : `load-data.ts` fusionnait les moves via spread shallow `{ ...base, ...tactical }`. Un champ `flags` dans l'override tactique remplaçait entièrement `base.flags` (extrait de Showdown reference) au lieu de fusionner les deux objets. Impact : Aéropique (`aerial-ace`), seul move avec un override `flags: { slicing: true }`, perdait silencieusement `contact`, `protect`, `mirror`, `metronome` après merge. Aucun autre move du Batch G1 concerné (aucun n'overridait `flags`).
- **Résolution** : fusion des flags dans `load-data.ts` — `flags: { ...base.flags, ...tactical.flags }` au lieu du spread plat. Aéropique retrouve `contact` (déclenche Statik/Pt Poison/Corps Ardent/etc.) et `protect` (bloqué par Abri). Décision design : `contact` conservé même si portée 1-2 (fidélité canon Showdown, décision #581). Régression couverte par `load-data.test.ts`. Décision #582.

---

## Lance-Soleil sous Soleil — preview mode-charge + latent `getLegalActions` (RÉSOLU 2026-06-28)

- **Contexte (2026-06-28, playtest)** : sous Plein Soleil, Lance-Soleil (`solar-beam`) affichait à tort le ciblage du tour de charge (zone bleue sur la case du lanceur) au lieu du ciblage immédiat. Bug purement côté preview/view. Un bug latent adjacent existait dans `getLegalActions` (`BattleEngine.ts`) : la charge sous soleil était sautée pour TOUT move `twoTurnCharge` sans gate `sunSkipsCharge`, créant une incohérence légalité↔exécution pour les autres moves à charge (Lame d'Air, Piqué, Vol…).
- **Résolution** : helper `isChargingThisTurn(move, active, weather)` extrait et partagé par les 3 sites preview de `battle-orchestrator.ts` (DRY). `getLegalActions` corrigé : gate ajouté (`&& move.sunSkipsCharge === true`) pour ne sauter la charge que sur les moves `sunSkipsCharge`. `getEffectiveWeather()` passée `public`. Miroir légalité↔exécution rétabli. Décision #576.

---

## Talent Anti-Bruit (`soundproof`) — RÉSOLU (plan 138, v2026.6.4)
- **Contexte** : aucun move sonore (Requiem, Dissonance Psy, Bruit Blanc, Berceuse…) n'était bloqué par Anti-Bruit. Electrode (roster) a ce talent → n'était pas immunisé à Requiem & co.
- **Résolution** : Anti-Bruit (`soundproof`) implémenté dans le batch talents Tier C (plan 138). Immunité gérée par le hook `onMoveImmunity` (`effect-processor.ts`, gate générique sur le flag `sound`). Couvert par tests (`abilities.integration.test.ts`, `effect-processor.test.ts`).

---

## Bugs UI résolus (2026-06-16, commit `fix: langue au boot sandbox…`)

### HUD de combat ignorait `pt-lang` au boot sandbox `?config` (résolu 2026-06-16)
- Cause : `initLanguage()` n'était **jamais appelé** — `currentLanguage` restait au défaut, seul le toggle menu (`setLanguage`) le changeait. Boot direct sandbox/combat → langue figée.
- Fix : appel `initLanguage()` au boot (`babylon-boot.ts`, lit `pt-lang` sur tout chemin). + locale Playwright épinglée `fr-FR` (sinon e2e bootait en EN via la locale machine). Débloque le test EN-combat (`hud.spec`).

### Team Builder — bloc « Commence à construire ton équipe… » non centré (résolu 2026-06-16)
- Cause : `.tb-edit-empty` centré horizontalement seulement, coincé dans la demi-colonne gauche de `.tb-edit-grid`.
- Fix : `editGrid.dataset.empty` (TeamEditView) → CSS `[data-empty]` passe la grille en 1 colonne `place-items: center` + `.tb-edit-empty` centré vertical (`justify-content`/`block-size:100%`).

### Map preview — bouton « Retour » débordait du panneau gauche (résolu 2026-06-16)
- Cause : le `min-width` large de `.mn-btn` (clamp 240px+) dépassait le panneau liste étroit.
- Fix : `.ms-list-panel .mn-btn { min-inline-size: 0; inline-size: 100%; box-sizing: border-box; }`.

### Team Builder — « Tout vider » vidait sans confirmation (régression Phaser→Babylon, résolu 2026-06-16)
- Cause : la migration Babylon avait perdu la modale de confirmation ; `TeamEditView.clearAll()` vidait direct les slots. Clés i18n `clearAllConfirmTitle`/`Body` orphelines (code mort).
- Fix : `ClearTeamConfirmModal.ts` (`<dialog>`, mirror de `DeleteConfirmModal`) appelé par `clearAll()` ; nouvelles clés `clearAllConfirmYes`/`No` (Vider/Annuler). e2e réactivé : `team-builder.spec.ts` (« Tout vider » demande confirmation).

### `BattleLogPanel` — entrée longue wrappe/déborde (obsolète post-migration, clos 2026-06-16)
- Bug Phaser (plan 118) : slots à hauteur fixe `BATTLE_LOG_LINE_HEIGHT` + `wordWrap` → message 2 lignes chevauchait le suivant.
- Caduc : la migration Babylon a remplacé `BattleLogPanel` par `battle-log.ts` (DOM `<ol>`/`<li>`/`<span>`, flux CSS). Chaque entrée grandit pour contenir son texte — chevauchement structurellement impossible. Plus de hauteur fixe ni de `wordWrap`. Rien à corriger.

### Nom FR `body-press` : override i18n faux = "Bodypress" (résolu 2026-06-16)
- Le plan 110 avait décrété « nom officiel FR = Bodypress » (**erreur**) et posé l'override `moves.fr.json` = "Bodypress". L'ancien item backlog reprenait cette erreur (« reference Big Splash = faux »).
- Vérité : Poképédia (autorité FR) confirme que **« Big Splash » est le nom français officiel** de Body Press. PokeAPI (donc `reference/moves.json` = "Big Splash") avait raison.
- Fix : override `moves.fr.json` corrigé "Bodypress" → "Big Splash". `reference/moves.json` laissé tel quel ("Big Splash", correct). Aucune carte de correction dans `build-reference.ts` (PokeAPI est juste). Le jeu affichait "Bodypress" (faux) → affiche désormais "Big Splash".

## Dette technique résolue

### Génération automatique des i18n de noms (moves + pokemon) depuis `reference/` (RÉSOLU 2026-07-19)

- **Contexte (2026-06-04)** : `moves.en.json` maintenu à la main s'était retrouvé incomplet (297 clés vs 938 en FR) — chaque batch de moves oubliait d'ajouter les noms EN, 47 moves s'affichaient en slug brut (`rock-slide`, `confuse-ray`) dans l'ActionMenu en anglais jusqu'au hotfix 2026-06-04. Racine identique au bug des 51 pré-évolutions Gen 1 sans nom FR/EN (voir entrée ci-dessus, 2026-07-19) : fichiers i18n maintenus à la main, dérive silencieuse.
- **Résolution** : `build-reference.ts` (lancé par `pnpm data:update`) génère désormais automatiquement les **4 fichiers i18n de noms** — `src/i18n/moves.{fr,en}.json` ET `src/i18n/pokemon-names.{fr,en}.json` — via une fonction pure `buildI18nMaps()`, dérivés de `reference/*.json`. Parité en↔fr garantie structurellement. Nouveau test `scripts/i18n-sync.test.ts` casse le CI si les fichiers commités divergent de la sortie générée (garde anti-drift / oubli de `data:update`).
- **Effet secondaire** : 104 vieux noms de moves legacy (Z-Moves/Dynamax/Shadow, non référencés en code, hors roster Champions) supprimés du fichier moves i18n ; 16 `hidden-power-*` (Puissance Cachée) ajoutés ; noms Pokemon inchangés (roster). Résout aussi structurellement la classe de bug côté Pokemon (le bug des 51 pré-évolutions ne pourra plus se reproduire — même racine, même fix).
- Voir aussi `docs/process-data-update.md` (§ Fichiers produits) — les i18n de noms ne s'éditent plus à la main.

### GitHub Actions sur Node 20 — déprécié (résolu 2026-06-12, commit `30be7ee`)
- Actions `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `peaceiris/actions-gh-pages` bumpées vers leurs variantes Node 24 dans `ci.yml`, `deploy.yml`, `itch-deploy.yml`.
- `Ayowel/butler-to-itch` toujours à v1.3.0 (pas de release node24 mainteneur au 2026-06-12) — surveillé dans `docs/next.md`, marche probablement via runtime node24 auto GitHub.

---

## Bugs résolus

### Anim KO déclenchée trop tôt (résolu 2026-06-18)
- Retour playtest 2026-06-18 : l'animation de KO (`Faint`) se déclenchait avant la fin de l'animation de dégât (Hurt + flash rouge), coupant la réaction de dégât.
- Fix : `packages/view-core/src/battle-orchestrator.ts` — sur les events `PokemonKo`/`PokemonEliminated`, on attend désormais `max(durée Hurt, DAMAGE_FLASH_TOTAL_MS)` avant de jouer le Faint. Ajout d'un accessor port `hurtAnimationDurationMs` (interface `BoardView` + handler `CombatScene`), implémenté côté Babylon. Constante dérivée `DAMAGE_FLASH_TOTAL_MS` dans `view-core/constants.ts`.

### Clôture recette migration Babylon (2026-06-14, plan 124/125)
Recette visuelle humaine de la migration Babylon validée (2026-06-14). Les 4 reliquats du backlog Babylon sont **clos par acceptation humaine** — jugés acceptables / non-bloquants à la recette, **pas un fix code** (à rouvrir si régression réelle). Distincts des fixs plan 120 archivés plus bas (#488-491).
- **[Babylon] Curseur FFTA ne remonte pas à la tête du Pokémon fraîchement posé** (2026-06-11, plan 120) — accepté tel quel.
- **[Babylon] Silhouette X-ray entre Pokémon jugée moche** (2026-06-11, plan 120) — accepté tel quel.
- **[Babylon] Animations idle/boucles trop rapides vs Phaser** (2026-06-11, plan 120) — accepté tel quel.
- **[Babylon] Divergence HUD combat : sandbox studio in-canvas vs FSM DOM** (2026-06-13) — accepté ; priorité basse, à documenter/unifier seulement si une feature HUD l'exige.

### Renderer Babylon — animations idle trop rapides (playtest 2026-06-11)
- Feedback playtest plan 120 : les animations idle des sprites Babylon jouaient à 140ms/frame fixe, trop vite par rapport aux durées PMD réelles.
- Fix (plan 120) : chaque frame jouée pour sa durée PMD réelle (`atlas.meta.animations[nom].durations[i] × BABYLON_PMD_TICK_DURATION_MS`). Constantes `BABYLON_PMD_TICK_DURATION_MS = 33` + `BABYLON_PMD_DEFAULT_FRAME_TICKS = 4`. Parité avec `SpriteLoader.TICK_DURATION_MS` du renderer Phaser. Décision #488.

### Renderer Babylon — silhouette X-ray visible entre Pokémon (playtest 2026-06-11)
- Feedback playtest plan 120 : l'effet silhouette (contour X-ray derrière les obstacles) s'appliquait aussi entre Pokémon, rendant la lecture confuse.
- Fix (plan 120) : refonte rendering groups. Group 1 = silhouettes (testent depth vs terrain group 0 uniquement). Group 2 = sprites avec `setRenderingAutoClearDepthStencil(2, false)` — les sprites ne réalimentent pas le test silhouette. Résultat : silhouette X-ray seulement derrière terrain/décor. Décision #489.

### Renderer Babylon — curseur/flèches direction ne remontent pas à la tête au placement (playtest 2026-06-11)
- Feedback playtest plan 120 : les flèches de direction au placement s'affichaient au sol et ne suivaient pas la hauteur de tête du Pokémon (pire sur les gros sprites type Léviator).
- Fix (plan 120) : flèches voxel `arrow.gltf` positionnées à hauteur de tête via l'ancre partagée avec le curseur survol. Fallback `BABYLON_SPRITE_HEAD_LIFT_FALLBACK = 1` le temps du chargement atlas, reposition automatique au chargement (`BillboardEntry.ready`). Décisions #490-491.

### Test d'intégration `PlacementPhase` cassé + CI ne run pas les integration tests
- Fix : coordonnées corrigées (3,18) et (4,19) dans les spawn zones. `pnpm test:integration` ajouté à la CI.

### Régénérer le tileset.png avec les brightness uniformes (plan 055)
- Fix : 15 colonnes régénérées avec `LEFT_BRIGHTNESS = RIGHT_BRIGHTNESS = 0.65`, tileset assemblé (32x2368px, 74 tiles). Validation visuelle OK (2026-04-17).

### Transparence tiles/décos dans le visionneur de maps (2026-04-23)
- Fix 2026-04-24 (commit `082240c`) : suppression système `TERRAIN_TINT`. Bug global renderer iso résolu.

### Hyper-Fang test flaky en suite complète (2026-05-20)
- Fix : `buildMoveTestEngine` migré en options object `{ gridSize?, random? }` (vs positional `gridSize, random?`). Le test hyper-fang passe `{ random: createPrng(0) }` explicite (accuracy=90 → roll déterministe). Cause racine : helper passait `undefined` comme RNG → `BattleEngine` fallback `Math.random()` non déterministe → 10% miss aléatoire selon ordre des tests. 13 call sites positionnels migrés au passage.

### MapSelectPreviewScene — crash `cameras.main` undefined au retour menu (2026-04-23)
- Fix 2026-04-23 : `setLayout` et `create` gardent layout en propriété, `setLayout` no-op si caméra pas prête.
- Cause : `setLayout` appelé depuis `MapSelectScene.create()` avant que `MapSelectPreviewScene.create()` ait tourné (race au 2e passage après SHUTDOWN + relaunch).

### simple-arena non centrée dans le preview (2026-04-23)
- Fix 2026-04-23 : `applyCameraFit` prend en compte décalage horizontal `(gridWidth - gridHeight) * TILE_WIDTH / 4` pour grilles non carrées (simple-arena 12×20).

### SandboxPanel — sélecteur de talent + élargir panels (2026-05-20)
- Fix 2026-05-20 : ability dropdown ajouté dans hub Player ET hub Dummy (`SandboxPanel.buildAbilityOptions`, rebuild on Pokemon change). Default `(défaut)` = ability primaire de l'espèce ; abilities non implémentées suffixées `(–)`. `SandboxConfig.playerAbility`/`dummyAbility` câblés via `BattleSetupConfig.abilityOverrides`. Largeur container `240px → 320px` (réduit le scroll vertical / le crop des labels). i18n FR/EN `sandbox.ability`/`sandbox.abilityDefault`. Test `SandboxSetup.test.ts` étendu (ability override player+dummy).

### Sandbox refonte — 4 points playtest (plan 090 — 2026-05-21)
- (1) Divergence learnset teambuilder vs sandbox : `SandboxPanel.getMovepoolFor` faisait `legal.has(toShowdownId(move.id))` — `toShowdownId("vine-whip") = "vinewhip"` cherché dans un Set kebab (`vine-whip`) → tous moves multi-mot filtrés. Fix : comparaison directe `legal.has(move.id)`, source unifiée via team builder. Test parity ajouté.
- (2) Mutualisation team builder : 4 cartes Move cliquables → `MovePickerModal` (composant team builder réutilisé). Player + Dummy(Player mode).
- (3) Mode dummy jouable : `SandboxConfig.dummyControl: "ai" | "player"` + `dummyMoves: string[]`. AI mode = `DummyAiController` + 1 move défensif (comportement actuel). Player mode = `PlayerController.Human` + 4 moves picker, `controller.onTurnReady = null`. `GameController` sans notion teamId → tous tours traités comme input humain.
- (4) Layout "Sandbox Studio" : page plein écran avec header + canvas Phaser flex height + 2 colonnes Player/Dummy + bandeau Battle bas. DOM injecté par `sandbox-boot.ts` (`body[data-sandbox="true"]`), Phaser scale `RESIZE` en sandbox. Toolbar dans header, plus de sidebar fixed.
- Drops `dummyLevel` + `dummyBaseStats` (toujours level 50, stats espèce). Migration JSON `default.json` + `charmander-test.json`.

### TurnTimeline CT — layout et barre de charge (plan 055 — commit b728c3a)
- Corrigé dans le bug gatling (plan 055).

### phantom-force / baton-pass invisibles dans le team builder (hors plan — 2026-05-21)
- `phantom-force` et `baton-pass` n'apparaissaient pas dans le MovePickerModal du team builder malgré des learnsets valides.
- Cause : `learnset-resolver.ts` comparait les IDs sans traduire le format Showdown (sans tirets : `phantomforce`) vers kebab (`phantom-force`). `buildShowdownToKebabIndex` existait dans `load-data` mais non utilisé dans le resolver.
- Fix : `learnset-resolver` utilise `showdownToKebab` pour normaliser les IDs Showdown avant intersection avec les moves implémentés.

### Terrain target lava — mouvement autorisé vers tile lava invalide (hors plan — 2026-05-21)
- `getValidTargetPositions` ne filtrait pas les tiles terrain dangereux (lava/deep_water) comme cibles de mouvement pour les Pokemon non-immuns.
- Fix : filtre ajouté dans `getValidTargetPositions`.

### Freeze post-self-KO (terrain létal) (hors plan — 2026-05-21)
- KO par terrain létal (lava/deep_water) laissait le jeu dans un état figé si le Pokemon attaquant se KO lui-même via terrain au landing.
- Cause : `handleKo` appelé avant `LethalTerrainKo` event, HP bar non mise à jour.
- Fix : ordre d'appel corrigé (`handleKo` après `LethalTerrainKo`), HP bar forcée à 0 avant KO handler.

### Ombre Volant au sol / hauteur sprite vol incorrecte (hors plan — 2026-05-21)
- Sprite Flying identique aux autres au sol. Pas d'ombre distincte.
- Fix : sprite Flying décalé `h+2` (2 tiles hauteur visuelle), ombre restée au sol via shadow Y offset séparé. Burrowing/Diving/Vanished : sprite rendu invisible.

### Reference learnsets vides (10 Pokemon Gen 1) + Kangaskhan genderRatio (hors plan — 2026-05-20)
- 10 Pokemon Gen 1 (Pidgey/Pidgeotto/Rattata/Raticate/Spearow/Fearow/Paras/Parasect/Weedle/Kakuna) avaient `learnset.levelUp/tm/tutor = []`.
- Kangaskhan `genderRatio: { male: 50, female: 50 }` au lieu de `{ male: 0, female: 100 }` (canon : exclusivement femelle).
- Cause racine 1 (learnsets) : `parseLearnset` dans `build-reference.ts` calculait `maxGen` global sur **toutes** les entrées du Pokemon (incluant `8V` Virtual Console). Quand l'unique présence Gen 8+ d'un Pokemon était via VC, `maxGen=8` mais V/E/S/R sont skippés → tous les vrais moves L/M/T des gens antérieures filtrés.
- Cause racine 2 (gender) : `transformPokemon` gérait `gender === "N"` (genderless) mais pas `gender === "F"` / `"M"`. Tombait sur le default 50/50.
- Fix : `maxGen` restreint aux entrées `L`/`M`/`T` uniquement (set `LEARNABLE_TYPES`). Ajout des branches `gender === "F"` → `{0,100}` et `gender === "M"` → `{100,0}`.
- Régénération via `pnpm data:update:skip-fetch`. Pidgey 14L+23M+6T, Rattata 13L+29M+10T, etc. Kangaskhan 0/100 correctement détectée. Gate CI verte (1514 unit + 189 intégration + typecheck + lint + build).
- Note : Kangaskhan learnset Champions = 67 TM uniquement (pas de levelUp/tutor en Gen 9 mod), comportement attendu.

### Curseur jaune passe au-dessus des Pokemon (tile surélevée) (hors plan — 2026-05-20)
- Sur tile surélevée, base du curseur dépassait Pokemon sur même tile (`+0.8` > Pokemon `+0.5`).
- Fix : `DEPTH_CURSOR_OVER_DECORATION_OFFSET` (0.8) renommé `DEPTH_CURSOR_RAISED_TILE_OFFSET` et abaissé à `0.4`. Cursor passe désormais sous Pokemon même tile (`0.5`), reste au-dessus obstacle (`0.3`), passe sous tall grass (`0.6`).
- Refonte FFTA-style (curseur au-dessus des Pokemon avec design dédié) reportée à un plan renderer dédié (cf. memory `project_cursor_ffta`).

### Caméra hors-écran 12v1 (hors plan — 2026-05-20)
- Format 12v1 : Pokemon spawné en bord de carte, caméra ne le centrait pas → hors écran au début et entre les tours.
- Cause racine : `Phaser.Cameras.Scene2D.Effects.Pan` ignore silencieusement tout appel si `isRunning=true` (pan manuel ou chaîne de tours rapide encore actif). Les appels `pan()` successifs rataient sans erreur.
- Fix : `BattleScene.recenterOnActivePokemon` étendu avec param `instant` (center direct, bypasse Pan). Appelé en fin de `transitionToBattle` et `initSandboxBattle`. `GameController.pan()` passe `force=true` dans les handlers `refreshUI` et `battleLogPanel` click.

### MapSelect — première map noire au retour (hors plan — 2026-05-20)
- Retour sur MapSelectScene (après victoire ou bouton Retour) laissait la première map avec une preview noire.
- Cause : état de l'instance Phaser persistant entre passages — `currentUrl`/`isometricGrid`/`decorationsLayer` non réinitialisés dans `MapSelectPreviewScene.create()`, et `selectedIndex`/`listItems`/refs non réinitialisés dans `MapSelectScene.init()`.
- Fix : reset complet de ces propriétés dans `MapSelectPreviewScene.create()` et `MapSelectScene.init()`.

### Icône statut non retirée après natural-cure (hors plan — 2026-05-06)
- natural-cure retirait bien le statut (core OK) mais l'icône restait affichée — `StatusRemoved` non émis.
- Fix : `naturalCure.onEndTurn` dans `ability-definitions.ts` émet `BattleEventType.StatusRemoved` (un par statut retiré) avant `AbilityActivated`. Test d'intégration mis à jour pour vérifier l'événement.

### Noms Pokemon slug-only en sandbox et team builder (hors plan — 2026-05-06)
- Tous les Pokemon Batch B (19) ajoutés à `pokemon-names.en.json` + `pokemon-names.fr.json`.
- Tous les Pokemon Batch A + B (35 total) ajoutés aux locales renderer `en.ts` + `fr.ts` sous clés `pokemon.*`. Type `Translations` mis à jour.

### Moves sandbox : selects non pré-remplis (init et changement Pokemon) (hors plan — 2026-05-06)
- Deux bugs distincts avec la même racine (selects initialisés à `""`).
- Bug 1 (init) : `config.moves[i] ?? movepool[i] ?? ""` à la création des selects dans `SandboxPanel.buildPlayerPanel`. Fallback `readConfig()` limité à `.slice(0, 4)`.
- Bug 2 (changement Pokemon) : `select.value` lu avant vidage des options → valeur perdue. Fix : lecture avant reconstruction + fallback `movepool[i]` dans `rebuildMoveOptions` après reconstruction.
- Symptômes couverts : +4 moves affichés, moves Eevee evos non visibles, selects vides au changement de Pokemon.

### Ordre Pokédex non respecté en team builder et sandbox (hors plan — 2026-05-06)
- Fix : `dexNumber?: number` ajouté à `PokemonDefinition` (core), chargé depuis `ref.dexNumber` dans `loadPokemonFromReference`. `SandboxPanel` et `TeamSelectScene` trient par `dexNumber ?? 0`.

### Team builder 5 colonnes — overflow bouton Launch sur 34 Pokemon (hors plan — 2026-05-06)
- `GRID_COLS = 5` dans `TeamSelectScene` causait 7 lignes sur 34 Pokemon, le bouton Launch passait hors écran.
- Fix : `GRID_COLS = 7` → 5 lignes, bouton Launch visible sans scroll.

### Traversée DeepWater/Lava bloquée pour les types immuns (hors plan — 2026-04-25)
- Pokemon Water/Flying ne pouvaient pas traverser DeepWater. Fire/Flying ne pouvaient pas traverser Lava.
- Fix : `TraversalOptions` accepte `immuneTerrains?: ReadonlySet<TerrainType>`. `canEnterTerrain` et `canStopOn` ignorent impassabilité pour ces types. Nouvelle `getImmuneTerrains(types)` dans `terrain-effects.ts`. 3 call sites BattleEngine (`getReachableTiles`, `validateMovePath`, `computePathDistance`) calculent et passent le set.

### Steel non immun au marécage (statut + traversée) (hors plan — 2026-04-25)
- Magneton (Electric/Steel) prenait Poisoned en traversant Swamp.
- Fix : `PokemonType.Steel` ajouté à `TERRAIN_IMMUNE_TYPES[Swamp]` dans `terrain-effects.ts`.

### IA figée quand équipes séparées par terrain infranchissable (hors plan — 2026-04-25)
- `closestPathDistance` retournait `Infinity` pour tous les ennemis sans chemin. L'IA ne se déplaçait plus.
- Fix : `closestDistanceToEnemies` dans `action-scorer.ts` utilise Manhattan comme fallback quand `computePathDistance` retourne `Infinity`.

### IA — aversion terrains dangereux (plan 068 — 2026-04-25)
- Fix : `action-scorer.ts` applique `DANGEROUS_TERRAIN_PENALTY = 8` sur destinations Magma/Lava/Swamp. Exception : Pokemon immuns via `isTerrainImmune`. Constante `DANGEROUS_TERRAINS` centralisée.

### IA — pathfinding aveugle (distance manhattan vs distance réelle) (plan 068 — 2026-04-25)
- Fix partiel : `scoreMove` utilise `engine.computePathDistance` (BFS sans budget) au lieu de `manhattanDistance`. Ennemi derrière obstacle score à `Infinity`.
- Résidu : navigation long terme (rampes, contournement multi-tours) reste limitée par BFS à budget — hors scope.

### Observation "dégâts à travers le mur" (le-mur.tmj) (plan 068 — 2026-04-25)
- Investigation : dégâts provenaient de moves `ignoresLineOfSight` (soniques/telluriques) — comportement correct.
- Test non-régression ajouté (`BattleEngine.los-legal-actions.test.ts`).

### Transparence / silhouette des Pokemon derrière obstacle (plan 065)
- Fix : `OcclusionFader` — fade alpha 0.4 sur obstacle occultant un Pokemon (AABB screen-space + comparaison depth). Fix depth tiles surélevées (`DEPTH_RAISED_TILE_BASE = DEPTH_POKEMON_BASE`). Alt-click picking. Résolu 2026-04-20.

### Immunité au poison non respectée (type Poison empoisonné) (plan 055)
- Fantominus (Poison/Ghost) se faisait empoisonner par Toxic.
- Fix : helper `isImmuneToStatusByType` (Poison/Steel → Poisoned/BadlyPoisoned, Electric → Paralyzed, Fire → Burned, Ice → Frozen). Check avant règle "un seul statut majeur".

### Pokemon KO continuent d'animer idle (plan 055)
- Fix : flag `isKnockedOut = true` dans `playFaintAndStay`, early-return dans méthodes d'animation. `setConfusionWobble(false)` reste autorisé après KO pour nettoyage.

### Icône de statut manquante suite à empoisonnement par marais (plan 055)
- Core émettait `TerrainStatusApplied` mais renderer sans handler → icône jamais mise à jour.
- Fix : nouveau case dans `GameController.handleEvent` + nouveau cas i18n FR/EN dans `BattleLogFormatter.ts`.

### Overlay preview dégâts sur HP bar (plan 055)
- Root cause : `HP_BAR_HEIGHT = 2` → `HP_BAR_HEIGHT - 2 = 0` → fillRect 0px invisible.
- Fix : edge-to-edge alignement + `damageEstimateGraphics` persistant enfant du container + alphas 0.55/0.85.

### Textes flottants superposés (multi-hit, DOT simultanés) (plan 055)
- Fix : queue temporelle par `targetId`. `showBattleText` accepte `targetId` (auto-queue via `acquireSpawnDelay`) OU `delay` explicite. Délai entre beats : `BATTLE_TEXT_QUEUE_DELAY_MS = 700`. Spawn différé via `scene.time.delayedCall`. Tests unit sur `acquireSpawnDelay`.

### Profondeur du sélecteur/highlight vs sprites Pokemon (bugfix hors plan 2026-04-14)
- Fix : layering depths dans `constants.ts` — tiles (1–125) → highlights (500–510) → Pokemon (520+) → curseur (900) → UI (1000+). `DEPTH_POKEMON_BASE` 200 → 520.

### Rendu de profondeur pendant animations d'attaque (bugfix hors plan 2026-04-12)
- Fix : `PokemonSprite.playAttackAnimation` bump depth container à `max(originalDepth, maxTileDepthInRadius(r=3))`. `animateMoveTo` même principe (`r=1`). Constantes `ATTACK_DEPTH_ENVELOPE_RADIUS=3` et `MOVEMENT_DEPTH_ENVELOPE_RADIUS=1` dans `constants.ts`.
- Fichiers : `PokemonSprite.ts`, `GameController.ts`, `constants.ts`.

### Mécaniques d'attaque en terrain 3D (champ de vision, collisions) (plan 047)
- LoS raycast Bresenham 2D dans 9 resolvers de targeting (`hasLineOfSight`, `heightBlocks`)
- Dash contre mur : arrêt + dégâts de chute
- Moves sonores/zones telluriques ignorent LoS (`ignoresLineOfSight` dérivé des flags)
- Preview AoE filtrée par LoS dans renderer

### Texte flottant trop rapide et illisible (plan 046 playtest)
- Fix : constantes dans `packages/renderer/src/constants.ts` retunées :
  - `BATTLE_TEXT_FONT_SIZE` : 7 → 10
  - `BATTLE_TEXT_DURATION_MS` : 2200 → 3500
  - `BATTLE_TEXT_DRIFT_Y` : -15 → -20
  - `BATTLE_TEXT_STAGGER_Y` : -7 → -10
- Ajout clé i18n `battle.fall` (FR: "Chute", EN: "Fall") dans `GameController.ts`.

### Police WOFF2 corrompue (plan 045)
- WOFF2 regénéré proprement, plus d'erreur CFF

### Confusion wobble post-KO (commit ef3b002)
- Tween confusion stoppé dans `playFaintAndStay`

### Distinguer alliés et ennemis sur la grille (plan 042)
- HP bars, InfoPanel, Timeline et BattleLog colorisés par couleur d'équipe (12 couleurs, `TEAM_COLORS` dans constants.ts)

### Pas d'écran de victoire en mode IA vs IA (plan 042)
- Fix dans `GameController.ts` — flow BattleEnded → showVictory fonctionne en mode spectateur

### Border blanc sur les badges de statut (InfoPanel) (plan 042)
- `setStrokeStyle` blanc ajouté sur rectangles badges dans `InfoPanel.ts`

### Touche Espace pour passer le tour (plan 042)
- Espace → end turn, touche C → recentrer caméra (décision #219)

### Dégâts Vampigraine pas reflétés sur la HP bar (plan 024)
### Status burn non affiché au spawn en sandbox (plan 024)
### Événements du tour Dummy non animés (fix 2026-04-02)
