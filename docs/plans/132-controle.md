# Plan 132 — Contrôle (moves restants)

**Statut : done (2026-06-19)**
**Phase 4 — Mécaniques restantes (moves complexes), famille « Contrôle ».**

> Provoc / Entrave / Encore déjà livrés (plans 100-101). Cette famille clôt le Contrôle avec les 3 derniers moves in-pool : **Possessif**, **Dissonance Psy**, **Dépit**.

## But

Trois disrupteurs qui restreignent les actions de l'adversaire, chacun via un mécanisme distinct :

| Move | ID | Type / Cat | Effet | In-pool (Gen 1) |
|------|----|-----------|-------|-----------------|
| **Possessif** | `imprison` | Psy / Statut Self | Tant que le lanceur vit, les ennemis ne peuvent user les moves que le lanceur connaît aussi | 10 |
| **Dissonance Psy** | `psychic-noise` | Psy / Spé 75 BP, acc 100 | Dégâts + **Anti-Soin** (Heal Block) 2 tours sur la cible | 10 |
| **Dépit** | `spite` | Ghost / Statut, acc 100 | **Taxe CT one-shot** : la prochaine action de la cible coûte plus de CT (perte de tempo) | 13 |

Learners in-pool :
- **Possessif** : Alakazam, Noadkoko, Ectoplasma, Hypnomade, Mew, Mewtwo, Grotadmorv, Feunard, Flagadoss, Mélodelfe
- **Dissonance Psy** : Noadkoko, Ectoplasma, Akwakwak, Hypnomade, Lokhlass, Mew, Mewtwo, Flagadoss, Aéromite, Grodoudou
- **Dépit** : Arbok, Ectoplasma, Léviator, Kangourex, Mew, Mewtwo, Grotadmorv, Feunard, Persian, Colossinge, Rhinoféros, Tauros, Smogogo

### Décisions de design (tranchées avec l'humain, 2026-06-19)

| Axe | Choix |
|-----|-------|
| **Dépit & PP** | PP supprimés (plan 128) → effet canon mort. **Réinterprété en taxe CT one-shot** (perte de tempo), distinct d'Entrave (verrou de move). |
| **Anti-Soin (Heal Block) — portée** | **Canon complet** : bloque l'**usage** des moves de soin (filtre `getLegalActions` comme Provoc) **ET** l'**application** de tout soin entrant. Drain : les dégâts passent, le soin est annulé. |
| **Possessif — modèle** | Volatil persistant sur le lanceur (pas de timer). Filtre **inverse** : un Pokémon ne peut user un move M si un ennemi **vivant** porte Possessif **et** connaît M. Meurt avec le lanceur. |
| **Possessif — soft-lock** | Si Possessif scelle **tous** les moves d'un Pokémon, celui-ci se retrouve avec **uniquement `EndTurn`** (+ directions). **Pas de Lutte (Struggle)** dans ce projet → ce « tour vide » est l'effet **voulu**, pas un bug. À documenter dans `decisions.md`. |
| **Dissonance Psy & Substitute** | Move **sonore** (`sound: true` + `bypasssub: true` en référence). Donc **perce le Sub** (dégâts + secondaire Anti-Soin appliqués à travers), via l'infra sound-bypass déjà livrée plan 099. *(Corrigé après review : le canon + les flags imposent le bypass.)* |

### Réglages par défaut (mineurs, override humain possible)

- **Dissonance Psy** : `power = 75`, `accuracy = 100`, **Cône 1-3** (convention moves sonores : Hyper Voix / Grondement / Murmure ; décidé en human-testing 2026-06-19), secondaire Anti-Soin **100 %** sur chaque cible touchée.
- **Anti-Soin** : durée **2 tours** (du porteur), décompte via `timedVolatileTickHandler`.
- **Dépit** : `SPITE_CT_PENALTY = 350` CT (≈ un Wait offensif ; à valider/tuner en human-testing). **Single 1-3** (aligné sur Provoc/Entrave/Encore), jamais sur soi.
- Coût CT : **Possessif = `MajorStatus` (700)** — aligné sur Provoc/Entrave/Encore, effet persistant + multi-cibles potentiel (sous-coûté à 500). **Dépit = move statut standard**. **Dissonance Psy = move de dégâts standard.**

## Mécanique 1 — Possessif (`imprison`)

### Modèle

- Nouveau `StatusType.Imprisoning` (volatil **persistant**, pas de `remainingTurns`).
- Nouveau `EffectKind.PostImprison` + handler `handle-post-imprison.ts` : pose `Imprisoning` sur le lanceur (idempotent — si déjà actif, `ImprisonFailed`).
- **Filtre inverse** dans `getLegalActions` ET garde `executeUseMove` :
  un Pokémon P ne peut user un move M si **il existe un ennemi vivant E** (`E.playerId !== P.playerId`) tel que `E` porte `Imprisoning` **et** `E.moveIds.includes(M)`.
- **Perf (review)** : ne PAS scanner les ennemis pour chaque move. Helper pur `collectImprisonedMoveIds(state, playerId): Set<string>` qui **agrège une seule fois** (par appel `getLegalActions`) l'union des `moveIds` de tous les ennemis vivants portant `Imprisoning`. Puis test O(1) `imprisonedSet.has(moveId)` par move. Le chemin `executeUseMove` recompute le Set (appel ponctuel, coût négligeable).
- **Cleanup** : aucun spécial. `handleKo` vide déjà `volatileStatuses` → dès que le lanceur tombe, le filtre ne trouve plus de porteur → moves rouverts naturellement.

### Interactions

- **Substitute** : Possessif est un move Self → pas bloqué par Sub (pose sur soi).
- **Filtre symétrique** : si les 2 camps connaissent le même move et tous deux ont Possessif, aucun ne peut l'user (canon).
- Possessif **ne se bloque pas lui-même** : si l'ennemi connaît aussi `imprison`, alors poser Possessif devient illégal pour cet ennemi (canon, voulu).

### Événements

- `Imprisoned { pokemonId }` (lanceur), `ImprisonFailed { pokemonId }` (déjà actif).
- Pas d'event « move bloqué » : le move disparaît simplement de `getLegalActions` (comme Provoc).

## Mécanique 2 — Dissonance Psy (`psychic-noise`)

### Modèle

- Move de **dégâts** classique (Psy, Spé, 75 BP, **Cône 1-3** — convention sonore) + secondaire **Anti-Soin** sur chaque cible touchée.
- Nouveau `StatusType.HealBlocked` (volatil **timé**, 2 tours) ajouté à `TIMED_VOLATILES` dans `timedVolatileTickHandler`.
- Secondaire posé via le pipeline `EffectKind.Status` existant (réutilise `handle-status.ts`), `chance = 100`, après le hit.

### Effet « bloque l'usage »

- `getLegalActions` + garde `executeUseMove` : si le Pokémon porte `HealBlocked`, retirer les moves qui contiennent un effet de soin.
- Helper pur `isHealingMove(move): boolean` = le move a au moins un effet de kind ∈ { `HealSelf`, `HealTarget`, `HealByTargetStat`, `PostHealOverTime`, `PostWish`, `CureTeamStatus`, `Drain` } **ou** `Drain`-only ? → **non** : un move Drain reste utilisable (il fait des dégâts), seul le soin est annulé à l'application (voir ci-dessous). Donc `isHealingMove` ⇒ kinds de **soin pur** ({ `HealSelf`, `HealTarget`, `HealByTargetStat`, `PostHealOverTime`, `PostWish`, `CureTeamStatus` }). Les moves Drain ne sont **pas** filtrés de la liste.

### Effet « bloque l'application »

Quand un soin tenterait d'augmenter les PV d'un Pokémon `HealBlocked`, on l'annule et on émet `HealPrevented`. Helper pur `isHealBlocked(pokemon): boolean`. Sites précis :
- **Drain** (`handle-drain.ts`, juste avant `pokemon.currentHp += healed`) : si `isHealBlocked(context.attacker)` → `healed = 0`, dégâts déjà appliqués conservés, émettre `HealPrevented` au lieu de `HpRestored`.
- **HealTarget** (`handle-heal-target.ts`) / **HealSelf** (`handle-heal-self.ts`) / **HealByTargetStat** (`handle-heal-by-target-stat.ts`) : si la **cible du soin** est `HealBlocked` → soin = 0, `HealPrevented { pokemonId, reason: HealBlock }`. (La part stat-drop de `strength-sap`/Vole-Force reste appliquée.)
- **HoT** (tick handler Racines/Anneau Hydro) : tick sauté si le porteur est `HealBlocked` (le volatil HoT reste, juste suspendu).
- **Vœu** (`handle-post-wish` + résolution différée engine) : à la résolution, si la cible est `HealBlocked` → soin = 0, `HealPrevented`.

> Périmètre : on couvre les sources de soin **déjà implémentées**. Aucune source future n'a besoin de re-câblage si elle passe par un des handlers ci-dessus.

### Interactions

- **Substitute** : Dissonance Psy est **sonore** (`sound: true` + `bypasssub: true`) → **perce le Sub** : dégâts ET secondaire Anti-Soin appliqués directement à la cible (réutilise l'infra sound-bypass livrée plan 099 — les moves sonores ignorent déjà `shouldSubstituteBlock`). Vérifier que le secondaire Status passe aussi le bypass (sinon, lever le check Sub dans le chemin Status pour les moves `sound`).
- **Brume / Rune Protect** : Anti-Soin n'est pas un statut majeur ni une baisse de stat → **non bloqué** (cohérent avec Provoc).

### Événements

- `HealBlockApplied { pokemonId, turns }`, `StatusRemoved { status: HealBlocked }` (via tick handler).
- `HealPrevented { pokemonId, reason }` (application annulée).

## Mécanique 3 — Dépit (`spite`)

### Modèle

- Move statut Ghost, Single 1-1, jamais sur soi (`spite` échoue/illegal sur le lanceur).
- Nouveau `EffectKind.SpiteCtTax` + handler `handle-spite-ct-tax.ts`.
- Le handler ne touche pas directement le scheduler (les handlers opèrent sur l'état). Il **pose un champ one-shot** sur la cible : `PokemonInstance.pendingCtPenalty?: number` (= `SPITE_CT_PENALTY`). Précédent : champ `pendingWish` (plan 116).
- **Consommation** : dans `payCtActionCost` (BattleEngine, ~l.2881), après le calcul de `actionCost` et **avant** `onActionComplete`, si le Pokémon a `pendingCtPenalty` → `actionCost += pendingCtPenalty` puis `pendingCtPenalty = undefined` (one-shot). Consommé à la **première action complète** du tour taxé (que ce soit un move ou un Wait). Effet net : son **prochain** tour est retardé (CT plus négatif après l'action).
- **Cleanup** : `handleKo` met `pendingCtPenalty = undefined` (pas de fuite si la cible tombe avant d'agir — la pénalité disparaît avec le Pokémon, cohérent).

> Alternative écartée : drain CT immédiat sur le pool. Rejetée car moins lisible (le scheduler recompute en continu) et plus intrusive dans `ChargeTimeTurnSystem`. Le champ one-shot consommé à la prochaine action est déterministe et testable unitairement.

### Interactions

- **Substitute** : Dépit ne fait pas de dégâts ; comme c'est une « manip » sur la cible, **bloqué par Sub** (mirror Provoc/Entrave : check `hasSubstitute` en tête de handler).
- **Cible déjà taxée** : `pendingCtPenalty` est écrasé (pas cumulé) — re-Dépit rafraîchit la taxe, ne l'empile pas.

### Événements

- `SpiteApplied { pokemonId, ctPenalty }`, `SpiteFailed { pokemonId }` (Sub).

## Renderer (view + DOM)

- **InfoPanel badges volatils** :
  - Possessif → badge sur le lanceur `Possessif` (icône 🔒, sans timer).
  - Anti-Soin → badge sur la cible `Anti-Soin {turns}t`.
  - Dépit → pas de badge persistant (effet one-shot) ; floating text au cast suffit.
- **MoveTooltip tags** : Possessif `🔒 Scelle vos moves communs` · Dissonance Psy `🚫 Anti-Soin 2t` · Dépit `⏳ Taxe CT`.
- **MoveSelector** : moves grisés/retirés gérés par `getLegalActions` (Possessif côté ennemi, Anti-Soin côté porteur) — pas de travail UI dédié, le filtre core suffit.
- **BattleLogFormatter** : cas `Imprisoned`, `HealBlockApplied`, `HealPrevented`, `SpiteApplied` + variantes Failed/Blocked.
- **Floating text** : `Anti-Soin !` (cible), `Dépit !` (cible), `Possessif !` (lanceur).
- **GameController** : câbler les nouveaux events.

## i18n (FR / EN)

Clés nouvelles : `infoPanel.volatile.imprison`, `infoPanel.volatile.healBlock`, `moveTooltip.tag.imprison`, `moveTooltip.tag.healBlock`, `moveTooltip.tag.spite`, `battleLog.imprisoned`, `battleLog.healBlockApplied`, `battleLog.healPrevented`, `battleLog.spiteApplied`, + variantes Failed. Noms FR officiels : **Possessif**, **Dissonance Psy**, **Dépit**, **Anti-Soin**.

## IA (scoring)

- **Possessif** (`scoreSelfMove` / PostImprison) : score base modéré, **×1.5 si ≥1 ennemi partage ≥2 moves** avec le lanceur (sinon faible — sceller dans le vide est inutile). -1 si déjà actif.
- **Dissonance Psy** : scoré comme un move de dégâts standard ; **bonus** si la cible a un move de soin connu ou un HoT actif (Anti-Soin a de la valeur).
- **Dépit** (`scoreSpite`) : bonus si la cible est « proche d'agir » (CT élevé) — la taxe a plus d'impact ; faible sinon.

## Data (`packages/data`)

- `tactical.ts` : entrées `imprison` (Self, PostImprison), `psychic-noise` (Single 1-1, Damage + Status HealBlocked 100 %), `spite` (Single 1-1, SpiteCtTax).
- Patterns via `move-pattern-designer` au lancement.
- **OP sets** (data-miner) : 2-3 sets exploitant ces moves (ex. Ectoplasma Possessif/Dépit, Mewtwo/Alakazam Possessif, Lokhlass Dissonance Psy). Compteur OP sets à recaler.

## Tests

### Unit (core)
- `imprison.test.ts` : pose volatil, filtre ennemi (move commun retiré), move non-commun gardé, lanceur KO → filtre levé, double Possessif symétrique, `ImprisonFailed` si déjà actif.
- `psychic-noise.test.ts` : dégâts + Anti-Soin posé, durée 2t décompte, filtre moves soin sur porteur, drain (dégâts OK / soin 0), HealTarget annulé, HoT suspendu puis repris, Vœu différé annulé, Sub bloque secondaire.
- `spite.test.ts` : `pendingCtPenalty` posé, consommé une fois (one-shot), prochain tour retardé, Sub bloque, re-Dépit écrase.

### Intégration
- Scénario Possessif : 2 mons partageant un move, vérif legalActions ennemi avant/après KO lanceur.
- Scénario Anti-Soin : porteur tente Soin → illégal ; reçoit Vampigraine soin → annulé.
- Scénario Dépit : ordre CT modifié sur le tour suivant de la cible.

### e2e (test-writer)
- Observable : badges InfoPanel (Possessif/Anti-Soin), grisage moves, log. Scénario `pnpm dev:sandbox` pré-rempli + MAJ `docs/test-plan.md` §11.

## Périmètre v1

- Les **3** moves in-pool. Hors-pool (Torment / Magic Coat) **non** couverts (à prévoir si learnsets élargis).
- Pas de nouvelle source de soin créée ; Anti-Soin couvre l'existant.

## Découpage d'exécution

1. **Core enums/types** : `StatusType.Imprisoning` + `.HealBlocked`, `EffectKind.PostImprison` + `.SpiteCtTax`, `PokemonInstance.pendingCtPenalty?`, et **`BattleEventType`** : `Imprisoned`, `ImprisonFailed`, `HealBlockApplied`, `HealPrevented`, `SpiteApplied`, `SpiteFailed` (+ types `BattleEvent` associés). Ajouter `HealBlocked` à `TIMED_VOLATILES` dans `timedVolatileTickHandler`.
2. **Handlers** : `handle-post-imprison.ts`, `handle-spite-ct-tax.ts` + helpers purs `isImprisonedMove` / `isHealingMove`.
3. **getLegalActions + executeUseMove** : filtres Possessif (inverse) + Anti-Soin (heal moves).
4. **Application soin bloquée** : drain / heal-target / heal-self / HoT tick / wish.
5. **CT one-shot** : consommation `pendingCtPenalty` dans `payCtActionCost` + `timedVolatileTickHandler` += `HealBlocked`.
6. **Tests unit + intégration** (test-first sur le core).
7. **Data** : `tactical.ts` + OP sets (data-miner) + patterns (move-pattern-designer).
8. **Renderer + i18n + BattleLog + IA**.
9. **e2e + test-plan** (test-writer).
10. **Gate CI → human-testing → commit**.
