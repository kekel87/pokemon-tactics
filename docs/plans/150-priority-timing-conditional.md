# Plan 150 — Famille Priorité / timing conditionnel

**Statut : done** (implémenté 2026-07-05)
**Créé : 2026-07-05**
**Objectif : 469 → 475 moves** (6 nouveaux) — atteint

## Résumé

Famille des moves dont l'identité canon repose sur la **priorité** (frappe avant/après) ou sur
l'**intention simultanée** du tour (« la cible attaque-t-elle ? », « ai-je été frappé avant de
frapper ? »). Deux concepts qui **n'existent pas** dans ce jeu : le CT (Charge Time) est séquentiel
(un acteur à la fois quand son compteur franchit le seuil) et il n'y a **aucune notion de priorité**
sur `MoveDefinition`.

Adaptation retenue (validée humain 2026-07-05) :

- **Priorité canon abandonnée** partout. Le CT reflète déjà grossièrement la priorité via le coût
  dérivé de la puissance : Mitra-Poing 150 / Carapiège 150 / Bec-Canon 120 = tempo lourd (agit tard),
  Bluff 40 = tempo léger (agit tôt). Aucune mécanique de priorité ajoutée.
- **« Premier tour »** (Bluff / Escarmouche) → réinterprété en **1ʳᵉ action du combat du lanceur**
  (`lastActedAtAction == null`). Pas de switch-in dans ce jeu.
- **« La cible prépare une attaque »** (Coup Bas) → réinterprété via l'**horloge d'actions**,
  avec **fraîcheur** (décision humain 2026-07-05) : réussit seulement si la **dernière action** de
  la cible était offensive (`power > 0`), pas juste « a attaqué une fois dans le combat ». Sinon
  `lastUsedMoveId` collant rendrait Coup Bas quasi-garanti tout le combat et tuerait le contre-jeu
  (la cible peut temporiser pour dénier Coup Bas). Même pattern que Branchicrok / Prise de Bec
  (`TargetIdleSinceLastAction`, plan 134) : stamp dédié comparé à `lastActedAtAction`.
- **« Charge + interruption si frappé »** (Mitra-Poing / Bec-Canon / Carapiège) → réutilise l'infra
  charge 2-tours (plan 094, modèle skull-bash : charge SANS semi-invulnérabilité) + un **hook réactif
  dans `handle-damage`** qui réagit quand un mon en charge encaisse un coup pendant sa fenêtre d'attente.

## 6 moves

| Move (FR) | id EN | Type | Cat. | BP | Ciblage | Mécanique |
|-----------|-------|------|------|----|---------|-----------|
| **Bluff** | `fake-out` | Normal | Phys | 40 | Single 1-1 contact | `firstActionOnly` + Flinch 100 % |
| **Escarmouche** | `first-impression` | Insecte | Phys | 100 | Single 1-1 contact | `firstActionOnly` (sans flinch) |
| **Coup Bas** | `sucker-punch` | Ténèbres | Phys | 70 | Single 1-1 contact | échoue sauf si la **dernière action** de la cible était offensive (fraîcheur) |
| **Mitra-Poing** | `focus-punch` | Combat | Phys | 150 | Single 1-1 contact | charge 2-tours ; échoue si frappé pendant la charge |
| **Bec-Canon** | `beak-blast` | Vol | Phys | 120 | Single 1-1 contact | charge 2-tours ; brûle qui touche au contact (frappe quand même) |
| **Carapiège** | `shell-trap` | Feu | Spé | 150 | Zone r1 centré lanceur | charge 2-tours ; armé seulement si frappé par un move physique |

> Ciblages à **figer par `move-pattern-designer`**. Bec-Canon / Carapiège = signatures Gen 7 →
> **0 learner dans le roster Gen 1** (injouables en team builder pour l'instant). Codés quand même
> par complétude / futures gens (décision humain 2026-07-05).

## Décisions design (validées humain 2026-07-05)

1. **Coup Bas fizzle** = dégâts 0 mais **CT payé** (tour gaché, comme un échec canon).
2. **Mitra-Poing interrupt** = **n'importe quel dégât direct** (ennemi OU allié) casse la
   concentration. Dégâts **indirects** (météo / terrain / poison / recul) ne cassent PAS.
3. **Carapiège** = `Zone radius 1` centré lanceur → **Manhattan** (les 4 cases orthogonales adjacentes,
   comme toutes les Zones du jeu), friendly-fire inclus (cohérent avec Destruction/self-destruct).
   Canon = ennemis adjacents seulement, non retenu.
4. **Priorité canon abandonnée** : le CT sert d'ordonnancement unique.
5. **Coup Bas fraîcheur** (game-designer) : la dernière action de la cible doit être offensive (pas
   « a attaqué une fois »), sinon fizzle → contre-jeu par temporisation préservé.

### À surveiller en playtest (game-designer, non bloquant)

- **Mitra-Poing / Carapiège = « trap moves » potentiels en formats multi-mons** : ils paient le double
  coût CT des charges (comme Coud'Krâne/Lance-Soleil qui, eux, frappent toujours) **plus** un risque
  d'échec total, et la fenêtre de charge est exposée (indicateur ⚡ visible, adversaire peut casser
  délibérément). En 1v1 = pari rentable ; en 3v3+ = échec fréquent. Décision friendly-fire déjà actée
  → rouvrir seulement si le playtest montre un taux d'échec injouable (piste : exclure le friendly-fire
  de l'interruption, ou réduire le coût CT de Mitra-Poing). Carapiège plus sain (armement conditionnel
  ciblé, pas un pari aveugle).
- **Bluff / Escarmouche = usage unique par combat** (pas de switch-in) : vérifier que Persian/Kangaskhan
  restent intéressants avec un moveslot qui ne sert qu'une fois.

## Infra moteur

### Champs `MoveDefinition` (nouveaux)

- `firstActionOnly?: boolean` — Bluff / Escarmouche. Filtré dans `getLegalActions` + gardé dans
  `submitAction`.
- `failsUnlessTargetAggressive?: boolean` — Coup Bas. Fizzle si la **dernière action** de la cible
  n'était pas offensive (voir fraîcheur ci-dessous).
- `chargeReaction?: "focus" | "beak" | "shell"` — Mitra-Poing / Bec-Canon / Carapiège. Porte le
  comportement réactif pendant la fenêtre de charge. **Choix retenu (plan-reviewer) : 1 champ groupé**
  (les 3 partagent la même fenêtre « pendant la charge » ; précédent `lockIn` plan 149 qui groupe déjà
  ses paramètres). Les 3 valeurs sont mutuellement exclusives (union TS). `twoTurnCharge` reste posé
  en parallèle comme pour skull-bash (découplage charge structurelle vs. réaction conditionnée).

### `PokemonInstance` (état transitoire de charge + fraîcheur Coup Bas)

**Choix retenu (plan-reviewer) : Option B — flags transitoires** (pas d'arithmétique d'horloge
fragile) :

- `focusInterrupted?: boolean` — posé par le hook quand un Mitra-Poing en charge subit un dégât
  direct. Lu à la frappe T2 (échec si true). Effacé à T2 / KO / annulation de charge.
- `shellTrapArmed?: boolean` — posé par le hook quand un Carapiège en charge est frappé par un move
  physique. Lu à la frappe T2 (échec si false). Effacé à T2 / KO / annulation.
- Bec-Canon **n'a pas de flag** : la brûlure est appliquée immédiatement dans le hook, jamais relue.

**Fraîcheur Coup Bas** — nouveau stamp d'horloge (mirror `lastActedAtAction`) :

- `lastOffensiveActionAtAction?: number` — `actionCounter` de la dernière action **offensive**
  (`power > 0`) de ce mon. Stampé au moment où le mon résout un move à dégâts. Coup Bas réussit ssi
  `target.lastOffensiveActionAtAction === target.lastActedAtAction` (« sa dernière action était bien
  une attaque »). Élimine le collant de `lastUsedMoveId` : une cible qui a attaqué puis temporisé /
  bougé n'est plus « agressive ». Fizzle aussi si `lastActedAtAction === undefined` (jamais agi).

### Hook réactif `handle-damage`

Quand un mon `victim` prend un coup direct d'un `attacker` et que `victim.chargingMove` pointe un
move `chargeReaction` :

- **`focus`** (Mitra-Poing) : poser `victim.focusInterrupted = true` (tout dégât direct, ennemi ou
  allié). Émettre event `FocusInterrupted`.
- **`beak`** (Bec-Canon) : si le move de l'attaquant a `flags.contact` → **brûler l'attaquant**
  (`applyStatus Burned`, mêmes immunités que la brûlure standard : Feu, Munition, Peau Sèche…).
  N'interrompt PAS la charge. Émettre event `BeakBlastBurn`.
- **`shell`** (Carapiège) : si le move de l'attaquant est `category === physical` → poser
  `victim.shellTrapArmed = true`. N'interrompt PAS. Émettre event `ShellTrapArmed`.

> **Ordre (plan-reviewer)** : le hook se déclenche **après** l'application des dégâts (`damage > 0`,
> le coup a touché — donc après défenses/Protection/Substitut/immunité) et **avant** un KO éventuel
> du lanceur (un lanceur KO ne fera pas sa frappe T2 — nettoyage via `handleKo`). Il pose **1 flag
> par réaction** (mutuellement exclusifs) et poursuit ; les effets secondaires du move attaquant
> restent indépendants. **Zéro réentrance** : sur un move multi-hit, une fois `focusInterrupted`/
> `shellTrapArmed` posé, les hits suivants ne relancent pas de logique nouvelle (flag idempotent). En
> Zone (Carapiège frappé, ou attaquant multi-cible), chaque victime en charge réagit indépendamment.

### Gate à la frappe T2

Dans `submitAction`, au moment `isFiringCharged` (avant la résolution des dégâts) :

- **Mitra-Poing** : si `focusInterrupted` → **échec** (pas de dégâts, CT payé), event `MoveFailed`
  avec `reason: "focus"` (i18n `moveFailed.focus`). Nettoyer `chargingMove` + `focusInterrupted`.
- **Carapiège** : si `!shellTrapArmed` → **échec** (piège non armé, CT payé), event `MoveFailed`
  avec `reason: "shell-trap"` (i18n `moveFailed.shellTrap`). Nettoyer.
- **Bec-Canon** : frappe normalement (aucune condition à T2).

> `MoveFailed` gagne un champ optionnel `reason?: string` (ou réutiliser un event existant s'il y en
> a un — à vérifier à l'impl). Nettoyage commun à tout échec/succès de charge : `focusInterrupted` et
> `shellTrapArmed` remis à `undefined`.

### `getLegalActions` + `submitAction`

- `firstActionOnly` : move retiré des actions légales si `pokemon.lastActedAtAction !== undefined`.
  Garde miroir dans `submitAction` (rejette `InvalidAction`).
- `failsUnlessTargetAggressive` : **ne bloque pas** la sélection (le move reste jouable), mais fizzle
  à la résolution si `target.lastOffensiveActionAtAction !== target.lastActedAtAction` (dernière
  action non offensive) → cohérent avec le canon (on peut toujours tenter Coup Bas, il peut échouer).

## Renderer

- **Charge sans invuln** : déjà géré (indicateur `⚡` plan 094 via `setChargingIndicator`). Réutilisé
  tel quel pour Mitra-Poing / Bec-Canon / Carapiège.
- **InfoPanel** : badge volatile « Charge {move} » déjà posé pour `chargingMove` (plan 094).
- **MoveTooltip** : tags à ajouter —
  - `firstActionOnly` → `⏱ 1er tour seulement`
  - `failsUnlessTargetAggressive` → `🎯 Échoue si la cible n'attaque pas`
  - `chargeReaction: focus` → `⏱ 2 tours · échoue si frappé`
  - `chargeReaction: beak` → `⏱ 2 tours · brûle au contact`
  - `chargeReaction: shell` → `⏱ 2 tours · riposte si frappé (phys.)`
- **BattleLogFormatter** : nouveaux cas `FocusInterrupted`, `BeakBlastBurn`, `ShellTrapArmed`,
  `MoveFailed` (raisons focus/piège).
- **Nouveaux `BattleEventType`** : `FocusInterrupted`, `BeakBlastBurn`, `ShellTrapArmed` (+ réutiliser
  `MoveFailed` si présent, sinon ajouter).

## IA (`action-scorer.ts`)

Garde-fous minimaux, heuristiques fines **reportées** (passe IA groupée, cf. `docs/next.md`) :

- **Bluff / Escarmouche** : scorés via le scoring dégâts standard. Bluff hérite d'un bonus flinch (le
  flinch existe déjà dans le scoring secondaire). `firstActionOnly` → l'IA ne les voit tout
  simplement plus après sa 1ʳᵉ action (filtre `getLegalActions`), donc pas de garde-fou nécessaire.
- **Coup Bas** : ne pas le jouer si la condition de fraîcheur n'est pas remplie (le move fizzlerait,
  CT jeté) → **exclusion dans le scoring** (retour quasi-nul, cohérent avec les autres impossibilités
  post-légales) quand `target.lastOffensiveActionAtAction !== target.lastActedAtAction`.
- **Mitra-Poing / Carapiège** : moves à condition risquée (échouent souvent). Garde-fou : ne pas les
  spammer à l'aveugle. Scoring dégâts standard suffisant pour un premier jet ; l'IA ne raisonne pas
  sur « vais-je être frappé pendant la charge ? ».
- **Bec-Canon** : scoring dégâts standard (120 BP), la brûlure au contact est un bonus passif non
  modélisé.

## i18n (FR/EN)

- Noms des 6 moves (déjà dans `reference/moves.json`, à câbler dans les data + i18n si besoin).
- Clés log : `focusInterrupted`, `beakBlastBurn`, `shellTrapArmed`, `moveFailed.focus`,
  `moveFailed.shellTrap`.
- Tags MoveTooltip (5 nouveaux, cf. Renderer).

## Data

- 6 entrées dans `packages/data/src/overrides/tactical.ts` (targeting + effects + flags).
- OP sets : ajouter quelques sets emblématiques (ex : Mitra-Poing sur les combattants ;
  Coup Bas sur Arbok/Ectoplasma ; Bluff sur Persian/Kangaskhan). Bec-Canon / Carapiège = pas d'OP set
  (0 learner).
- Sprites : n/a (pas de nouveau Pokemon).

## Tests

### Unit (core) — obligatoire avant impl (test-first)

- `battle/moves/fake-out.test.ts` — 1ʳᵉ action OK, 2ᵉ action filtrée, flinch 100 %.
- `battle/moves/first-impression.test.ts` — 1ʳᵉ action OK, filtré ensuite.
- `battle/moves/sucker-punch.test.ts` — réussit si la **dernière action** de la cible était offensive
  (`lastOffensiveActionAtAction === lastActedAtAction`) ; fizzle (CT payé) si dernière action = statut /
  déplacement seul / jamais agi ; **cas fraîcheur** : cible qui attaque puis temporise → Coup Bas
  échoue (anti-collant `lastUsedMoveId`).
- `battle/moves/focus-punch.test.ts` — charge T1 ; frappe T2 si non frappé ; échec T2 si frappé
  (dégât direct) ; dégât indirect (poison) ne casse pas.
- `battle/moves/beak-blast.test.ts` — charge T1 ; attaquant contact brûlé pendant charge ; frappe T2
  quand même ; attaquant non-contact non brûlé ; cible Feu non brûlée.
- `battle/moves/shell-trap.test.ts` — charge T1 ; armé si frappé phys → frappe T2 ; échec T2 si non
  frappé / frappé spécial seulement.
- `battle/charge-reaction.test.ts` — hook `handle-damage` isolé (3 réactions), nettoyage au KO.

### Intégration

- `battle/priority-timing.integration.test.ts` — scénarios bout-en-bout des 6 moves via l'API.

### e2e Playwright — **reporté** (cf. `docs/next.md`)

Non bloquant (logique couverte en unit). À ajouter via `test-writer` + cahier `docs/test-plan.md` §5.

## Étapes d'exécution

1. **Data + patterns** : `move-pattern-designer` fige les 6 ciblages ; entrées `tactical.ts` ;
   nouveaux champs `MoveDefinition`.
2. **Core** : champs `PokemonInstance` (flags charge) ; hook `handle-damage` (`battle/charge-reaction.ts`)
   ; gates `getLegalActions` / `submitAction` ; events + tests unit **first**.
3. **IA** : garde-fous Coup Bas + minimal.
4. **Renderer** : tags MoveTooltip + cas BattleLogFormatter + câblage events.
5. **i18n** FR/EN.
6. **OP sets** emblématiques.
7. Gate CI + tests intégration.

## Reporté (non bloquant)

- **e2e Playwright** pour les 6 moves.
- **Heuristiques IA fines** (passe IA groupée : valoriser Bluff en ouverture, Coup Bas comme punition,
  Mitra-Poing derrière un mur/quand safe).
- **Bec-Canon / Carapiège injouables** tant que le roster n'a pas de learner Gen 7 → prêts pour la suite.
