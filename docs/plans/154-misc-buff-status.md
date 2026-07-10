# Plan 154 — Misc Batch D : buff / statut

> **Statut : `DONE`** (2026-07-10 — design tranché avec l'humain : Vol Magnétik = lévitation complète temporaire ; Malédiction = ciblage conditionnel par type du lanceur ; Bâillement = fenêtre de répit canon ; Cognobidon = fidèle sans levier ; revues plan-reviewer + game-designer intégrées). **490 → 496 moves.** Gate local : 3393 unit + 352 intégration + build + lint + typecheck verts.
> Chantier « Misc volatile / utility » — batch **D** sur 5 (A crit ✅, B dégâts utilitaires ✅, C manip talent ✅, D buff/statut ← ici, E grille-problématiques à venir).
> Cible : **490 → 496 moves** (+6). Tests positionnels `moves/{curse,yawn,belly-drum,acupressure,attract,magnet-rise}.test.ts` + intégration `buff-status.integration.test.ts`.

## Objectif

Ajouter les 6 moves « buff / statut » divers du batch D — chacun apporte une petite mécanique neuve (double comportement par type, sommeil différé, sacrifice de PV pour boost max, boost aléatoire, infatuation par genre, lévitation temporaire) :

| Move (FR) | ID | Type | Cat. | Ciblage | Effet |
|---|---|---|---|---|---|
| **Malédiction** | `curse` | Spectre | Statut | **Conditionnel** (voir §D1) | Spectre : sacrifie 50% PV max, pose un DoT 25%/tour sur un ennemi r3. Non-Spectre : self −1 Vit, +1 Atq, +1 Déf. |
| **Bâillement** | `yawn` | Normal | Statut | Single r1 (ennemi) | Endort la cible **au tour suivant** (somnolence → sommeil). |
| **Cognobidon** | `belly-drum` | Normal | Statut | Self | Sacrifie 50% PV max, **maximise l'Attaque** (crans Atq → +6). |
| **Acupression** | `acupressure` | Normal | Statut | Single r1 (self ou allié) | +2 crans à **une stat aléatoire** parmi les 5 stats de combat non plafonnées. |
| **Attraction** | `attract` | Normal | Statut | Single r1 (ennemi) | Si la cible est du **sexe opposé** : infatuation (50% de ne pas agir). |
| **Vol Magnétik** | `magnet-rise` | Élektrik | Statut | Self | **Lévite 5 tours** : immunité Sol + survole lave / eau profonde / pièges. |

**Learners Gen 1** (à confirmer via `data-miner`) : Cognobidon (Ronflex, Léviator…), Bâillement (large pool), Attraction (quasi-universel TM Gen 1), Malédiction (Spectres + large TM), Acupression (pool réduit), Vol Magnétik (Élektrik/Acier + TM). → OP sets possibles mais **différés** (§9, cohérent plans 150-153).

## Décisions de design (tranchées avec l'humain)

### D1 — Malédiction : ciblage conditionnel par type du lanceur
Un seul move, portée qui s'adapte au type du **lanceur**, résolue dans `getValidTargetPositions(caster, move)` (l'accès au lanceur y est déjà disponible) :
- Lanceur **Spectre** → `Single r3 (ennemi)` : sacrifie `floor(maxHp/2)` PV, pose le DoT sur la cible (portée 3 validée humain au playtest — cohérent avec un DoT à distance).
- Lanceur **non-Spectre** → `Self` : applique −1 Vit / +1 Atq / +1 Déf, aucun coût PV.

Nouveau flag `MoveDefinition.targetingByCasterType?: { ghost: TargetingSpec; default: TargetingSpec }` (nommage à affiner), consulté dans `getValidTargetPositions` **et** dans la validation d'action. Le type effectif est lu via `resolveBaseTypes` (override-aware). C'est la seule nouvelle infra de **ciblage**.

> **Divergence assumée** : version Spectre **échoue si `currentHp ≤ floor(maxHp/2)`** (pas de self-KO par Malédiction). Le canon permet de tomber KO ; on gate pour éviter les cas limites self-KO (miroir du floor de survie de Clone/`substitute`).

### D2 — Vol Magnétik : lévitation complète temporaire
Pendant 5 tours, le lanceur est traité comme **effectively flying** :
- Immunité aux moves de type Sol (déjà câblé via `isEffectivelyFlying` dans `getTypeEffectiveness`).
- **Survole lave / eau profonde / pièges** (cohérent avec le talent Lévitation et le type Vol qui flottent déjà — `field-terrain-system`).
- **Annulé** naturellement par : zone **Gravité** (`isEffectivelyGrounded` a priorité) et **Anti-Air** (`smackedDown`). Ces deux sources dominent la lévitation, comme pour Lévitation/Volant.

Approche unifiée : nouveau champ `PokemonInstance.magnetRiseTurns?: number` consulté dans `effective-flying.ts` (`isEffectivelyFlying`), décrémenté par un tick handler. **Pas de champ dupliqué** dans `isEffectivelyGrounded` — la gravité/`smackedDown` y sont déjà prioritaires.

### D3 — Autres (défauts fidèles, décidés)
- **Bâillement** — **fenêtre de répit (canon, tranché humain)** : la cible **garde une action normale au tour suivant** puis s'endort. Impl : `drowsyTurns = 1` posé sur la cible ; le tick est **end-turn** (pas start-turn) → la cible agit pendant son tour, puis en fin de ce tour `drowsyTurns` décrémente ; à `0` → applique `StatusType.Asleep` **via le chemin `handle-status`** (respecte Insomnie/Corps Sain/Vigilance/Vital Spirit, Brume/Safeguard). Le statut n'est PAS position-linked (s'éloigner du lanceur ne l'annule pas — cohérent avec Poison/Brûlure). Échoue immédiatement au cast si la cible a déjà un statut primaire, est **déjà somnolente** (`drowsyTurns !== undefined` — pas d'empilement), ou est immunisée au sommeil.
- **Cognobidon** : coût `floor(maxHp/2)` ; crans Atq **portés à +6** (`clampStages`). Échoue si `currentHp ≤ floor(maxHp/2)` **ou** crans Atq déjà à +6.
- **Acupression** : +2 crans à une stat aléatoire (`context.random()`) parmi **les 5 stats de combat** (Atq/Déf/Atq Spé/Déf Spé/Vit) **non déjà à +6**. Échoue si toutes plafonnées. *Divergence assumée* : Précision/Esquive exclues du tirage (rolls faibles, cohérence avec un jeu tactique — décision d'impl, pas canon strict).
- **Attraction** : gate sexe-opposé strict — échoue si même sexe, si l'un des deux est `Genderless`, ou si la cible est déjà infatuée. Copie le pattern Joli Sourire (`ability-definitions.ts:310-314`).

## Périmètre

- **Data** (`packages/data`) : 6 `MoveDefinition` + flags (`targetingByCasterType`, `targetsAllyOrSelf` pour Acupression) + i18n names/desc + tags tooltip. OP sets **différés**.
- **Core** (`packages/core`) : 6 `EffectKind` + handlers, 2 nouveaux champs instance (`drowsyTurns`, `magnetRiseTurns`), 1 volatile DoT (`Cursed`), 2 tick handlers (drowsy→sommeil, magnet-rise décrément), 1 hook de ciblage conditionnel, consultation `magnetRiseTurns` dans `effective-flying`.
- **Renderer** : badges InfoPanel (Somnolent / Maudit / Amoureux / Lévitation {n}t), floating text, battle-log formatter, tags MoveTooltip.
- **IA** : garde-fous minimaux (statuts → scoring générique ; Cognobidon gardé contre le suicide à bas PV). Heuristiques fines **reportées**.
- **Tests** : unit par handler + intégration par move + interactions (lévitation sur lave, Gravité/Anti-Air annulent, DoT ticke, sommeil différé, gate genre, gate PV Cognobidon).

## Ordre d'exécution

1. **Infra champs** (§1) : `drowsyTurns`, `magnetRiseTurns` + reset KO ; `StatusType.Cursed`.
2. **EffectKind + handlers** (§2) : 6 kinds + module `buff-status/`, dispatch `effect-processor`.
3. **Ticks** (§3) : drowsy→sommeil (start-turn), magnet-rise décrément (start-turn), Cursed DoT (end-turn, réutilise le loop `damagePerTurn`).
4. **Ciblage conditionnel Malédiction** (§4) : flag + `getValidTargetPositions` + validation.
5. **Lévitation** (§5) : `effective-flying.ts` consulte `magnetRiseTurns`.
6. **Event / renderer / i18n** (§6).
7. **IA** garde-fous (§7).
8. **Tests** (§8).

## 1. Infra core — champs & volatile

### 1.1 Champs `PokemonInstance`
```ts
/** Bâillement : somnolence. À 0 (tick suivant) → applique Asleep. undefined = pas somnolent. */
drowsyTurns?: number;
/** Vol Magnétik : tours de lévitation restants. >0 = effectively flying temporaire. */
magnetRiseTurns?: number;
```
Reset au KO à côté de `typeOverride`/`abilityIdOverride` (`BattleEngine.ts` ~3353). Le volatile `Cursed` est nettoyé par le cleanup `volatileStatuses` existant au KO.

### 1.2 Volatile `Cursed`
`StatusType.Cursed` (`status-type.ts`). Posé via un `VolatileStatus { type: Cursed, remainingTurns: -1, damagePerTurn: 0.25, sourceId }` — persistant (`-1`), infligé chaque fin de tour. Réutilise le champ `damagePerTurn` déjà présent sur `VolatileStatus` (comme Trapped).

## 2. EffectKind + handlers

6 nouveaux `EffectKind` (`effect.ts` + `effect-kind.ts`). Module `packages/core/src/battle/handlers/buff-status/`, dispatch enregistré dans `effect-processor.ts` :

- **`Curse`** → `handle-curse.ts` : lit `context.attackerTypes.includes(PokemonType.Ghost)`.
  - Spectre : gate `currentHp > floor(maxHp/2)` (sinon `MoveFailed`) → coût PV (miroir `handle-post-substitute` l.20-33) → pose le volatile `Cursed` (§1.2) sur la cible avec `sourceId = caster.id` → events `HpLost` + `Cursed`. **DoT non position-linked, sans rupture** (le lanceur peut mourir/s'éloigner, le DoT persiste — fidèle canon, distinct de Vampigraine). *Levier playtest* : si trop fort, ajouter une rupture liée à `sourceId` (mort/éloignement) sans toucher le taux — noté `docs/next.md`.
  - **Non-Spectre (PATCH 1)** : applique **3 `EffectKind.StatChange` internes** (−1 Vit, +1 Atq, +1 Déf) **au lanceur**, en réutilisant la logique de `handle-stat-change.ts` en mode self-cast (pas de gate d'ennemi type Brise Moule/Brume/Substitute — c'est un buff sur soi ; recompute `movement` pour la Vitesse via `computeMovement`). Aucun coût PV. Implémentation : extraire un helper pur `applyStatStage(pokemon, stat, delta): BattleEvent[]` de `handle-stat-change.ts` (application brute + clamp + movement), réutilisé aussi par Cognobidon et Acupression. Le handler existant `handleStatChange` continue d'appeler ce helper après ses gates → **aucune régression**.
- **`BellyDrum`** → `handle-belly-drum.ts` (Cognobidon) : gate `currentHp > floor(maxHp/2)` **et** `statStages.Attack < 6` (sinon `MoveFailed`) → coût `floor(maxHp/2)` → `statStages.Attack = 6` → events `HpLost` + `StatChanged` (« Attaque au max ! »).
- **`Yawn`** → `handle-yawn.ts` (Bâillement) : gate (PATCH 5) = `target.drowsyTurns === undefined` **et** pas de statut primaire **et** pas immunisée sommeil (réutilise le check sommeil de `handle-status`) → sinon `MoveFailed`. Sinon `target.drowsyTurns = 1` → event `Drowsy`.
- **`RaiseRandomStat`** ({ stages: 2 }) → `handle-acupressure.ts` : construit la liste des 5 stats de combat avec `statStages[stat] < 6` ; **si vide → `MoveFailed`** (PATCH 8, aucun fallback) ; sinon tire uniformément via `context.random()`, applique +2 via `applyStatStage` → event `StatChanged`. Cible = self ou allié r1 (résolue en amont via `targetsAllyOrSelf`).
- **`Attract`** → `handle-attract.ts` : gate sexe-opposé (copie `cute-charm`) + cible pas déjà `Infatuated` → pose `VolatileStatus { type: Infatuated, remainingTurns: -1, sourceId: caster.id }` (release position-linkée via `processInfatuated` déjà en place) → event `Infatuated`. Sinon `MoveFailed`.
- **`MagnetRise`** → `handle-magnet-rise.ts` : échoue si `smackedDown`, en zone Gravité, ou `magnetRiseTurns` déjà actif → `self.magnetRiseTurns = 5` → event `MagnetRise`.

## 3. Tick handlers

**Où enregistrer (PATCH 3)** : `BattleEngine.ts` — les phase handlers start-turn sont enregistrés ~l.234-262 (status-tick prio 100, infatuation 150, wish/future-sight/perish, timed-volatile 262) ; les end-turn (trapped-tick prio 300, screens, perish 280…). Suivre le modèle `timed-volatile-tick-handler.ts` / `trapped-tick-handler.ts` (signature `PhaseHandler`).

- **Drowsy → sommeil (fenêtre de répit)** — nouveau `drowsy-tick-handler.ts`, **end-turn** (pour laisser la cible agir pendant son tour avant de dormir) : si `pokemon.drowsyTurns` défini → décrémente ; à `0` → tente d'appliquer `StatusType.Asleep` via le chemin `handle-status` (respecte Insomnie/immunités/Brume/Safeguard), retire `drowsyTurns`, émet le sommeil (ou l'échec silencieux si immunisée entre-temps).
- **Magnet-rise** — `magnet-rise-tick-handler.ts`, start-turn : décrémente `magnetRiseTurns` **inconditionnellement** (PATCH 6 — même si Gravité/Anti-Air dominent `isEffectivelyFlying` ce tour ; le compteur court en parallèle) ; à `0` → `undefined` + event `MagnetRiseEnded`.
- **Cursed DoT** — end-turn : étendre le loop `damagePerTurn` existant (`trapped-tick-handler.ts` l.32-46, prio 300) pour traiter aussi les volatiles `Cursed` (même calcul `floor(maxHp * damagePerTurn)`, gestion KO identique). Émet `CurseDamage { targetId, amount, sourceId }` (PATCH 4 — le `sourceId` du volatile attribue le KO au lanceur d'origine).

## 4. Ciblage conditionnel — Malédiction (§D1)

- Flag `MoveDefinition.targetingByCasterType?` (les deux specs de portée).
- `getValidTargetPositions(caster, move)` (`BattleEngine.ts:1155`) : nouvelle branche en tête — si `move.targetingByCasterType`, choisir la spec selon `resolveBaseTypes(caster).includes(Ghost)` puis résoudre comme `Self` ou `Single r1 (ennemi)`.
- **Validation backend (PATCH 2)** : `getValidTargetPositions` n'est appelée que dans `getLegalActions` (candidats UI/IA), pas dans `executeUseMove`. Pour éviter qu'une position hors-spec passe côté moteur, ajouter dans `executeUseMove` (après `resolveTargeting`) une guard spécifique aux moves `targetingByCasterType` : `const valid = this.getValidTargetPositions(caster, move); if (!valid.some(p => p.x === targetPosition.x && p.y === targetPosition.y)) return InvalidTarget;`. Léger, ciblé sur ce seul flag.
- Le handler `handle-curse` re-teste le type (source de vérité) : si le ciblage et le type divergeaient (cas théorique), le comportement suit le type.

## 5. Lévitation temporaire (§D2)

`effective-flying.ts` — `isEffectivelyFlying(pokemon, ...)` ajoute `|| (pokemon.magnetRiseTurns ?? 0) > 0`. Aucune touche à `isEffectivelyGrounded` (Gravité + `smackedDown` y sont déjà prioritaires et dominent). Conséquences automatiques : immunité Sol (`getTypeEffectiveness`), survol terrain/hazards (`field-terrain-system`), annulation par Gravité/Anti-Air.

> Interaction Anti-Air : `smack-down` sur un mon en Vol Magnétik → `smackedDown = true` le re-cloue (grounding-terrain immédiat déjà géré §627). On ne touche pas `magnetRiseTurns` (le compteur expire seul), mais `smackedDown` domine tant qu'il est actif.

## 6. Event + i18n + renderer

- **Events** `BattleEventType` : `Cursed`, `CurseDamage`, `Drowsy`, `MagnetRise`, `MagnetRiseEnded` (+ réutilise `Infatuated`, `HpLost`, `StatChanged`, `MoveFailed`). Infatuation triggered/resisted existent déjà.
- **BattleLogFormatter** : cas FR/EN pour Malédiction (Spectre « X se maudit et pose une malédiction sur Y ! » / non-Spectre trois flèches de stats), DoT Malédiction, Bâillement (« Y a envie de dormir ! » puis « Y s'endort ! »), Cognobidon (« X se tape le bidon et maximise son Attaque ! »), Acupression (« +2 en {stat} ! »), Attraction (« Y tombe amoureux ! »), Vol Magnétik (« X lévite grâce à un champ magnétique ! »).
- **Floating text** : réutilise le pipeline existant (stat/HP/statut).
- **InfoPanel** badges volatiles : `Somnolent` (`drowsyTurns`), `Maudit` (volatile Cursed), `Amoureux` (Infatuated — ajouter si absent), `Lévitation {n}t` (`magnetRiseTurns`).
- **MoveTooltip** tags : ⏳ « Sommeil différé » (Bâillement), 💔 « Infatuation (sexe opposé) » (Attraction), 🧲 « Lévitation 5 tours » (Vol Magnétik), 🥁 « −50% PV → Atq max » (Cognobidon), 👻 « Effet selon type du lanceur » (Malédiction).
- **i18n** FR/EN : names/desc (déjà dans `moves.json`), clés d'events + badges (`infoPanel.volatile.drowsy`/`cursed`/`infatuated`/`magnetRise`).

## 7. IA

Garde-fous minimaux :
- **Cognobidon** : score conditionné — jouable seulement si `currentHp` élevé (> ~70% maxHp) **et** crans Atq bas, sinon score ~0 (évite le suicide / le boost inutile). Sécurité prioritaire (le −50% PV est le seul move de ce batch qui peut être un contresens grave).
- **Malédiction / Bâillement / Attraction / Acupression / Vol Magnétik** : statuts → scoring générique (`action-scorer.ts`), pas de contresens (Attraction gate déjà l'échec sur même sexe → l'IA ne le jouera pas à vide si le legal-actions le filtre ; sinon garde-fou léger).

**Reporté** (passe IA groupée, `docs/next.md`) : valoriser finement Bâillement (poser le sommeil avant un switch/finish), Attraction contre un sweeper adverse, Vol Magnétik contre une équipe Sol, Malédiction-Spectre comme pression PV, Acupression en setup sûr, Cognobidon comme win-condition derrière un mur.

## 8. Tests

- **Unit** : chaque handler (`buff-status/*.test.ts`) — Curse (branches Spectre/non-Spectre + gate PV), BellyDrum (gate + set +6), Yawn (pose drowsy + immunités), Acupressure (tirage parmi éligibles + échec tout plafonné), Attract (gate genre), MagnetRise (échec si grounded/actif). Ticks : `drowsy-tick` (sommeil au tick suivant), `magnet-rise-tick` (décrément/expiration), DoT Cursed.
- **Intégration** (`buff-status.integration.test.ts`) : (a) Malédiction Spectre → DoT 25%/tour + coût PV ; (b) Malédiction non-Spectre → ciblage self + 3 crans ; (c) Bâillement → cible endormie au tour suivant, échec si Insomnie ; (d) Cognobidon → −50% PV & Atq +6, échec à bas PV ; (e) Acupression self **et** allié r1 ; (f) Attraction → infatuation sexe opposé, échec même sexe/genderless ; (g) **Vol Magnétik sur tuile Lave → survit** (lévitation) ; (h) **Gravité annule** Vol Magnétik (immunité Sol levée) ; (i) **Anti-Air annule** Vol Magnétik (re-cloué) ; (j) reset au KO.

## Divergences assumées

- Malédiction-Spectre échoue si `currentHp ≤ floor(maxHp/2)` (pas de self-KO) — canon permet le KO.
- Acupression tire parmi 5 stats de combat (exclut Précision/Esquive) — canon inclut Précision/Esquive.
- Vol Magnétik = lévitation **complète** (survole les terrains), pas seulement immunité aux moves Sol — adaptation grille validée humain (§D2).
- DoT Malédiction = 25% maxHp/tour, durée illimitée (`remainingTurns: -1`) — pas de banc/switch dans le jeu.

## 9. Reporté (non bloquant)

- **e2e Playwright** : piloter les 6 moves via l'UI (badges, journal, DoT visible, sommeil différé). Via `test-writer` + `docs/test-plan.md` §5.
- **Heuristiques IA fines** (voir §7).
- **OP sets** emblématiques (Cognobidon Ronflex/Léviator, Attraction sur les Normal, Vol Magnétik sur les Élektrik/Acier) — via `data-miner` en session content-fill. **Note contre (game-designer)** : au moment de l'assignation, s'assurer qu'au moins un mon par format ait accès à Anti-Air ou Gravité, sinon la traversée lave/eau via Vol Magnétik reste incontrable en jeu réel.
- **Playtest à surveiller** : (a) DoT Malédiction 25%/t vs Toxik (levier rupture `sourceId` en secours) ; (b) Cognobidon whiff par kiting (fidèle assumé — associer à des mons rapides/gap-closer en OP-set) ; (c) Bâillement (jet garanti) vs Hypnose (jet ~60 mais moins cher en CT).
