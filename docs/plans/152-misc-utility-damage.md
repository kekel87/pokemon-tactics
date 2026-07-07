# Plan 152 — Misc Batch B : dégâts utilitaires

**Statut : done** (implémenté 2026-07-07)
**Objectif : 480 → 486 moves** (6 nouveaux) — atteint

## Contexte

Deuxième des 5 batches du chantier **Misc volatile / utility** (roadmap §Phase 4). Découpage
validé humain 2026-07-05 : 1 batch = 1 cluster d'infra, 1 plan, 1 commit, validation entre chaque.
Ordre : **A crit (plan 151, done) → B dégâts utilitaires (ce plan) → C manip talent → D buff/statut
→ E grille-problématiques**.

Batch B = moves dont l'identité est un **calcul de dégâts particulier** (plafonné, fixe, conditionnel
au positionnement) plutôt qu'un effet secondaire. Cluster naturel : ils touchent tous
`handle-damage.ts` / `damage-calculator.ts`.

### Périmètre — 6 moves

`beat-up` (**Baston**) figurait dans la liste roadmap mais est **déjà implémenté** (`teamBeatUp` +
`computeBeatUpPowers`, cf. `implementations.md` ligne 520) → hors périmètre.

| Move (FR) | ID | Type/Cat | Puiss./Préc. | Ciblage | Mécanique |
|---|---|---|---|---|---|
| **Faux-Chage** | `false-swipe` | Normal Phys | 40 / 100 | Single 1-1 contact | Les dégâts ne peuvent pas mettre K.O. : la cible garde ≥1 PV. Synergie : gratte des PV sans déclencher les KO-triggers (Lien du Destin / Rancune) |
| **Croc Fatal** | `super-fang` | Normal Phys | — / 90 | Single 1-1 contact | Dégâts fixes = ⌊PV actuels cible / 2⌋, min 1 (typechart ignoré, comme Effort) |
| **Ruse** | `feint` | Normal Phys | 30 / 100 | Single 1-1 | Ignore Protection/Détection (touche à travers) |
| **Anti-Air** | `smack-down` | Roche Phys | 50 / 100 | Single 1-1 | Dégâts + cloue un Volant au sol (perd l'immunité Sol + soumis aux hazards) |
| **Poursuite** | `pursuit` | Ténèbres Phys | 40 / 100 | Single 1-1 contact | **×2 si le coup frappe la cible de dos** (réinterprétation grille du « ×2 si la cible fuit ») |
| **Corps Perdu** | `vital-throw` | Combat Phys | 70 / — | Single 1-1 contact | Ne rate jamais (`bypassAccuracy`). Priorité -1 canon abandonnée |

Tous **in-pool Gen 1** (learners confirmés) :
- `false-swipe` → Canarticho, Osselait, Ossatueur, Insécateur
- `super-fang` → Rattata, Rattatac
- `feint` → Miaouss, Persian, Kicklee, Tygnon, Kabutops
- `smack-down` → Racaillou, Gravalanch, Grolem, Onix, Rhinocorne, Rhinoféros
- `pursuit` → Rattata, Rattatac, **Piafabec, Rapasdepic** (Volants → synergie « ×2 de dos »)
- `vital-throw` → Machoc, Machopeur

## Décisions verrouillées (validées humain 2026-07-07)

1. **Poursuite ×2 = de dos.** Pas de banc/switch dans ce jeu → « ×2 si la cible fuit » réinterprété
   en **×2 quand le coup atteint la zone `Back` de la cible** (`getFacingZone` existant). Fuyard
   rattrapé dans le dos. IA lisible (favoriser le contournement), positionnement récompensé.
2. **Corps Perdu = never-miss pur, aucun downside, coût CT canon accepté.** La priorité -1 canon
   (« frappe en dernier ») est sans objet (le CT ordonnance seul). Combat Phys 70 qui ne rate jamais,
   PP canon **10 → 900 CT** (palier max). ⚠️ **N'est PAS équivalent à Aéropique/Météores** (500 CT,
   PP 20, à distance) : Corps Perdu est plus cher et contact-mêlée. Choix assumé (décision humaine
   2026-07-07) : le prix du never-miss + contact = move de **niche**, pas un pilier. Pas d'override PP.

## Infra existante réutilisée (rien à créer)

- **Corps Perdu** → `MoveDefinition.bypassAccuracy` **existe déjà** (`aerial-ace`, `swift`). Move def
  seule, **zéro infra**.
- **Ruse** → `MoveDefinition.bypassProtect` **existe déjà** (`defense-check.ts:74`). Move def seule.
  *Nice-to-have optionnel* : Ruse strippe aussi le volatile Protection de la cible (canon Feint)
  pour que les attaquants suivants passent — marginal en mono-action, **différé** (noté §Reporté).
- **Croc Fatal** → même patron que `handle-endeavor.ts` / `handle-pain-split.ts` (handler dédié qui
  écrit `currentHp` directement, hors `damage-calculator`).
- **Anti-Air grounding** → chemin `gravityGroundBypass` **existe déjà** dans
  `damage-calculator.ts:351` (un défenseur au sol perd l'immunité Vol→Sol). On étend la condition
  d'entrée pour inclure un flag par-instance, au lieu de la seule zone Gravité.
- **Poursuite** → `facingModifierMap` (BattleEngine:1784) calcule déjà `Back = 1.15` via
  `getFacingZone`/`getFacingModifier`. On ajoute un ×2 conditionnel au flag.

## Infra neuve (4 points seulement)

### 1. Faux-Chage — flag `cannotKo` + cap dégâts

- `MoveDefinition.cannotKo?: boolean` (+ mirror dans `overrides/tactical.ts` local type).
- `handle-damage.ts` `dealSingleHit`, **juste avant** `target.currentHp = Math.max(0, … - actualDamage)`
  (ligne 406) : si `context.move.cannotKo === true` **et** `target.currentHp > 1` **et**
  `actualDamage >= target.currentHp` → `actualDamage = target.currentHp - 1`. Laisse la cible à 1 PV.
  - Ne s'applique **qu'au Pokemon direct**, pas au Substitut : si un Substitut bloque, le code
    early-retourne (~ligne 403) avant d'atteindre le cap → le clone prend les dégâts complets et peut
    casser normalement.
  - Le cap est placé **après** les survivances (Endure/Ténacité/Baie Ceinture, lignes ~300-356) → il
    reste prioritaire et inerte quand une survivance a déjà posé la cible à 1 PV.

### 2. Croc Fatal — `EffectKind.HalveTargetHp` + `handle-super-fang.ts`

- Nouveau `EffectKind.HalveTargetHp`.
- Nouveau `BattleEventType.SuperFangApplied` (event dédié `{ attackerId, targetId, damage }`, journal propre).
- Effet dans le move : `{ kind: EffectKind.HalveTargetHp }`.
- Handler (mirror `handle-endeavor.ts`) : `damage = max(1, floor(target.currentHp / 2))` ;
  `target.currentHp -= damage`. **Le `max(1, …)` autorise le K.O.** sur cible à 1-2 PV (canon : Croc
  Fatal peut mettre K.O.).
- **Pas de crit, pas de STAB, pas de typechart** (dégâts fixes). Immunité de type ? Canon : Croc
  Fatal touche les Spectres (Normal ne les touche pas normalement) — mais comme c'est des dégâts
  fixes, **on ignore l'immunité de type** (aligné Effort/`endeavor` qui ne consulte pas le
  typechart). Bloqué en amont par Protection (Single contact, comme Effort).
- Enregistrer le handler dans `effect-handler-registry`.

### 3. Anti-Air — volatile `smackedDown` + grounding

- `PokemonInstance.smackedDown?: boolean` (persistant jusqu'au KO, **reset dans `handleKo`** comme
  les autres volatiles ; pas de reset « au switch » puisque pas de banc).
- `EffectKind.SmackDown` + `handle-smack-down.ts` :
  - `target.smackedDown = true`.
  - Si `target.semiInvulnerableState === SemiInvulnerableState.Flying` (Vol/Rebond en cours) →
    **force l'atterrissage** : `target.semiInvulnerableState = undefined` (annule la charge aérienne).
    Seul l'état `Flying` est concerné (Tunnel/Plongée = souterrain/sous-eau, non concernés).
  - Event `SmackedDown { targetId }`.
- Le move Anti-Air a **2 effets** : `{ kind: Damage }` (50 BP, Roche) + `{ kind: SmackDown }`
  (secondaire 100 %). Ordre : dégâts puis grounding.
- **Câblage grounding** — créer un helper commun `isEffectivelyGrounded(state, pokemon): boolean` dans
  `field-global-system.ts` = `isGroundedByGravityZone(state, pokemon) || pokemon.smackedDown === true`.
  Le brancher aux **2 sites** :
  1. `handle-damage.ts` (~ligne 207, construction du `fieldGlobalContext`) :
     `defenderGroundedByGravity = isEffectivelyGrounded(context.state, target)`.
  2. `BattleEngine.ts` (~ligne 2448, gate hazard) :
     `if (isGroundedOnlyHazard(cell.kind) && isFlying && !isEffectivelyGrounded(this.state, pokemon)) continue;`
  - Effet : le défenseur `smackedDown` de type Vol perd son immunité aux moves Sol **et** subit les
    hazards grounded-only.
  - **Nomenclature** : après l'ajout de `smackedDown`, la propriété
    `FieldGlobalDamageContext.defenderGroundedByGravity` porte un sens élargi → documenter dans le
    commentaire d'interface (« inclut les zones Gravité ET l'état smackedDown ») ou renommer en
    `defenderEffectivelyGrounded`. **Reco** : commentaire (renommage = churn transverse).
- **Immunité** : un mon déjà non-Volant reçoit juste 50 dégâts Roche + le flag (inerte). Pas d'échec.

### 4. Poursuite — flag `pursuitBackstab` + ×2 de dos

- `MoveDefinition.pursuitBackstab?: boolean`.
- `BattleEngine.ts` build de `facingModifierMap` (ligne ~1785) : après le calcul du modifier de base,
  si `effectiveMove.pursuitBackstab === true` **et** `getFacingZone(attackOrigin, target) ===
  FacingZone.Back` → `modifier *= 2`.
  - Résultat : Poursuite de dos = `1.15 × 2 = 2.3×` (le bonus de dos universel + le ×2 identitaire).
    De face = `0.85×`, de flanc = `1.0×`. **40 BP → ~92 effectif de dos, ~34 de face.** Positionnement
    fortement récompensé — cohérent avec l'identité « rattraper un fuyard ».
  - Passe par `facingModifierMap` → le multiplicateur circule automatiquement dans l'**estimation de
    dégâts** (preview) et le calcul réel.
  - ⚠️ **À confirmer au review** : ×2 qui **stacke** avec le 1.15 (→ 2.3×) vs ×2 **plat** qui
    remplace le bonus de dos (→ 2.0× exact de dos). Reco : stacke (plus simple, le modèle facing est
    universel et Poursuite ne le désactive pas).

## Renderer / présentation

- **Journal FR** (`BattleLogFormatter`) : nouveaux events `SuperFangApplied` (« {cible} perd la
  moitié de ses PV ! »), `SmackedDown` (« {cible} est clouée au sol ! »). Faux-Chage : réutilise le
  flux dégâts standard (pas de ligne dédiée nécessaire ; à voir si on ajoute « {cible} tient bon ! »
  quand le cap s'applique — *optionnel, différable*).
- **MoveTooltip tags** : Faux-Chage « Ne met jamais K.O. », Croc Fatal « Dégâts = ½ PV cible »,
  Ruse « Ignore Protection », Anti-Air « Cloue au sol », Poursuite « ×2 dans le dos », Corps Perdu
  « Ne rate jamais » (réutiliser le tag never-miss existant si présent).
- **InfoPanel** : badge volatile « Au sol » pour un Pokemon `smackedDown` (si un Volant). *(à
  confirmer : cohérent avec l'affichage Gravité ?)*
- **i18n FR/EN** : clés journal + tooltip + badge.

## IA (garde-fous minimaux, heuristiques fines reportées)

- Faux-Chage / Croc Fatal / Ruse / Anti-Air / Corps Perdu / Poursuite passent tous par le scoring
  dégâts standard (moves offensifs) → **fonctionnels** dès la livraison.
- **Reporté** (passe IA groupée, même lot que les batches précédents) : valoriser finement
  Croc Fatal sur cible à PV élevés, Faux-Chage pour capturer/laisser en vie, Anti-Air sur un Volant
  menaçant, **Poursuite via contournement pour frapper de dos** (positionnement IA non trivial).
  Non bloquant.

## OP sets

- Aucun set emblématique livré dans ce plan (Rattata/Piafabec = hors-pool compétitif Gen 1 pertinent).
  À ajouter via `data-miner` en session content-fill si besoin. Les 6 moves entrent automatiquement
  dans les movepools dérivés des learners (Team Builder libre).

## Tests

- **Unit core** (`test-writer`, test-first) :
  - `moves/false-swipe.test.ts` : cap à 1 PV (cible pleine, cible à 2 PV → 1, cible déjà à 1 PV → pas
    de dégât négatif, Substitut cassable normalement).
  - `moves/super-fang.test.ts` : dégâts = `max(1, floor(PV cible / 2))` → **min 1, K.O. possible** sur
    cible à 1-2 PV ; ignore le typechart (touche un Spectre), bloqué par Protection.
  - `moves/feint.test.ts` : touche à travers Protection/Détection.
  - `moves/smack-down.test.ts` : dégâts + flag + Volant perd l'immunité Sol + subit les hazards +
    force l'atterrissage d'un Vol en cours.
  - `moves/pursuit.test.ts` : ×2 de dos, 0.85 de face, 1.0 de flanc.
  - `moves/vital-throw.test.ts` : ne rate jamais (précision cible évasive).
  - `utility-damage.integration.test.ts` : suite d'intégration du batch.
- **e2e Playwright** : **reporté** (via `test-writer` + cahier `docs/test-plan.md` §5), non bloquant.
- **Human-testing ciblés** (post-impl) : (1) Poursuite — Raticate contourne un Onix immobile pour le
  frapper de dos (vérifier que le coût réel ~750 CT rend l'action engageante, pas spammable) ; (2)
  Croc Fatal contre un tank Défense (Onix/Rhinocorne) ; (3) Anti-Air cloue un Volant puis hazard.

## Ordre d'implémentation (test-first — tests **avant** chaque handler)

1. Move defs des **2 gratuits** d'abord (Corps Perdu `bypassAccuracy`, Ruse `bypassProtect`) +
   tests → valider le socle.
2. Faux-Chage (`cannotKo` + cap).
3. Croc Fatal (`EffectKind.HalveTargetHp` + handler + event).
4. Poursuite (`pursuitBackstab` + facing ×2).
5. Anti-Air (`smackedDown` + grounding + landing + hazards) — le plus transverse, en dernier.
6. Renderer (journal/tooltip/i18n) + `implementations.md`.

## Reporté (non bloquant)

- Ruse : strip du volatile Protection de la cible (marginal en mono-action).
- Heuristiques IA fines (passe groupée).
- e2e Playwright.
- OP sets `data-miner`.
- Ligne journal « tient bon ! » pour le cap Faux-Chage (cosmétique).
