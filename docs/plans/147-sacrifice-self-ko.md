# Plan 147 — Famille Sacrifice / Self-KO

**Statut** : done
**Date** : 2026-07-03
**Worktree suggéré** : `sacrifice-self-ko`
**Périmètre** : 7 moves — 454 → 460 (Explosion/Souvenir/Tout ou Rien/Vœu Soin/Lien du Destin/Rancune neufs ; Destruction et Explo-Brume préexistaient déjà)

## Objectif

Implémenter la famille **Sacrifice / Self-KO** : des moves où le lanceur meurt
volontairement, en échange d'un effet. L'infra self-KO existe déjà partiellement
(`move.isExplosion` → le lanceur faint après le blast, `BattleEngine.ts:1706`,
bloquable par Moiteur/Damp). Ce plan la **généralise** (self-KO hors-explosion,
non bloqué par Damp) et ajoute deux mécaniques neuves :

1. **Trigger au KO du lanceur** (Lien du Destin / Rancune) — nouveau : lier la
   mort du lanceur à une conséquence sur l'attaquant.
2. **Revive** (Vœu Soin réinventé « Second Souffle ») — **premier move de
   résurrection** du jeu : ressusciter un allié KO / soigner un vivant.

Moves livrés :

| FR | ID | Type | Cat | Cible | Effet | Learners roster |
|----|----|------|-----|-------|-------|-----------------|
| Explosion | `explosion` | Normal | Phys | zone r2 auto-centrée | self-KO + AoE (= Destruction ×forte) | 20 |
| Explo-Brume | `misty-explosion` | Fée | Spé | zone r2 auto-centrée | self-KO + AoE Fée (déjà partiellement en place) | 5 |
| Souvenir | `memento` | Ténèbres | Statut | ennemi r? | self-KO + cible Atq **et** Atq.Spé −2 | 6 |
| Tout ou Rien | `final-gambit` | Combat | Spé | ennemi (offensif) | self-KO + dégâts **fixes = PV actuels lanceur**, **typés Combat** (immunité Spectre) | 4 |
| Vœu Soin | `healing-wish` | Psy | tuile r3 | self-KO + **revive 50%** (cible KO) / **soin 100%** (cible vivante) + statut nettoyé | 4 |
| Lien du Destin | `destiny-bond` | Spectre | self (volatile) | si le lanceur est KO avant son prochain tour → l'attaquant qui l'a KO faint aussi | 5 |
| Rancune | `grudge` | Spectre | self (volatile) | si le lanceur est KO par un move avant son prochain tour → **le move fatal est verrouillé chez l'attaquant jusqu'à la fin du combat** | 4 |

**Décisions validées humain (2026-07-03)** :
- Périmètre = **7 moves** (batch complet, y compris Vœu Soin réinterprété).
- Tout ou Rien = **dégâts fixes = PV actuels du lanceur, typés Combat** (canon
  Gen 5+, l'immunité Spectre s'applique — cohérent avec Effort/`endeavor`).
- Vœu Soin = **réinvention « Second Souffle »** (revive/soin ciblé r3), voir §Vœu Soin.
  Revive = **50% PV max** (soin d'un vivant = 100%). Le sacrifice 1-pour-1 (le
  lanceur meurt) est jugé équitable → pas de durcissement.
- **Rancune = réinventée** (le PP-compteur d'usage n'existe plus dans le jeu, PP
  = poids CT seul, `game-design.md §4`) : le move fatal est **verrouillé chez
  l'attaquant jusqu'à la fin du combat** (verrou permanent, pas N tours). Voir §KO-trigger.
- Lien du Destin = fenêtre **« jusqu'au prochain tour du lanceur »** (défaut
  cohérent avec tous les effets à durée du jeu, cf. §4b game-design). Assumé fort
  sur tanks lents → à surveiller en playtest, pas de garde-fou dans ce plan.

## Infra core existante (à réutiliser)

- **Précédents déjà livrés à mirrorer** : **Destruction** (`self-destruct`,
  `tactical.ts:1287`, `isExplosion` + zone r2) et **Explo-Brume**
  (`misty-explosion`, `tactical.ts:1693`) sont **déjà codés**. **Explosion**
  (`explosion`) est donc le seul move AoE self-KO **neuf** de la famille (copie
  quasi-directe de `self-destruct`).
- **Self-KO explosion** : `move.isExplosion` + bloc `BattleEngine.ts:1704-1729`
  (emit `DamageDealt {recoil}` puis `PokemonKo {countdownStart:0}` puis
  `handleKo`). **Bloqué par Moiteur/Damp** (`dampFizzled`, `:1533`).
- **Baisse de crans ciblée** : `EffectKind.StatChange` (précédent Stat manip
  plan 146, Baton Pass plan 093) — pour Souvenir −2/−2.
- **Dégâts fixes basés HP** : `EffectKind.Endeavor` (`effect-kind.ts:45`,
  events `EndeavorApplied`/`EndeavorFailed`) — modèle le plus proche pour Tout
  ou Rien (dégâts = PV lanceur, pas set-HP).
- **Volatiles + cleanup au KO** : `PokemonInstance.volatileStatuses`,
  `handleKo` (`:3030`) reset tous les champs volatiles + émet
  `PokemonEliminated`. Précédents volatiles : Perish (aura), Charge, Seeded.
- **Ciblage allié / tuile** : `targetsAlly` / `targetsAllyOrSelf` (`tactical.ts`),
  Baton Pass (`baton-pass` r1 allié), zones diamant Manhattan (plans 145/146).
- **Attribution d'un KO** : ⚠️ **à vérifier** — le moteur ne trace pas encore
  « quel move / quel attaquant a porté le coup fatal ». Nécessaire pour Lien du
  Destin + Rancune (voir §KO-trigger).

## Décisions de design

### Généralisation self-KO (nouveau flag)

Aujourd'hui le self-KO est couplé à `isExplosion` (⇒ AoE + bloqué par Damp).
Souvenir, Tout ou Rien et Vœu Soin doivent tuer le lanceur **sans** être des
explosions (pas d'AoE, **pas** bloqués par Moiteur — canon).

Introduire `MoveDefinition.selfKo?: boolean` :
- `isExplosion: true` **implique** `selfKo` (rétro-compat : Destruction/Explosion/Explo-Brume) et reste **bloqué par Damp**.
- `selfKo: true` **seul** (Souvenir / Tout ou Rien / Vœu Soin) → lanceur faint après résolution des effets, **non bloqué par Damp**.
- Le lanceur faint **après** que les effets du move soient appliqués (débuff /
  dégâts / revive posés d'abord, puis mort — l'ordre compte pour le renderer et
  pour que le revive/soin s'applique avant la disparition du lanceur).

Refacto du bloc `BattleEngine.ts:1704` : condition
`(move.isExplosion && !dampFizzled) || move.selfKo` et le self-KO se déclenche
une fois les `effectEvents` posés.

### Tout ou Rien (final-gambit)

- Move offensif **ciblage Single** (LoS standard, comme les moves de dégâts).
- Dégâts = `pokemon.currentHp` (au moment du cast), **typés Combat** : passe par
  le pipeline de type (efficacité, immunité) → **0 sur Spectre**, ×2 sur
  Normal/Roche/Glace/Ténèbres/Acier, etc. Pas de calcul stat classique (dégâts
  fixes), mais **l'efficacité de type module** (canon : Fighting-type fixed
  damage, respecte les immunités/résistances ? → **canon = seule l'immunité
  Spectre annule**, l'efficacité ne multiplie PAS les dégâts fixes).
  **À trancher en impl** : Showdown applique le typechart complet à Final Gambit
  (STAB non, mais multiplicateurs oui). Reco : **appliquer le typechart complet**
  (immunité + résistance/faiblesse) pour cohérence avec Effort et lisibilité.
- Le lanceur meurt (`selfKo`) **même si** la cible est immunisée / hors-portée
  (canon : Final Gambit fait faint l'utilisateur seulement s'il touche… ⚠️
  **canon = échoue et NE tue PAS si immunisé/raté**). **À trancher** : reco =
  self-KO **seulement si le move connecte** (miss/immunité Spectre → move
  échoue, lanceur survit, CT payé). Mirror `crashOnMiss` inversé.

### Souvenir (memento)

- Statut, ciblage **Single ennemi** (portée à fixer, reco r3 diamant comme les
  moves statut de contrôle plan 132/146 — **à confirmer** ; canon = portée 1
  Showdown mais grid ⇒ r3 cohérent).
- Effets : `StatChange` Atq −2 **et** Atq.Spé −2 sur la cible, **puis** `selfKo`.
- **Non bloqué par Damp.** Bloqué par Brume/Mist, Garde (protect), Substitut
  (comme les autres stat-drops — réutiliser les checks existants
  `handle-stat-change.ts`).
- Si la cible est immunisée au stat-drop (Clear Body / Brume) → le débuff échoue
  mais **le lanceur meurt quand même** (canon : Memento fait toujours faint).

### Vœu Soin (healing-wish) — réinvention « Second Souffle » / revive

**Premier move de revive du jeu.** Rework complet vs canon (pas de switch en grid).

- **Ciblage** : tuile unique, portée **r3** (diamant Manhattan depuis le lanceur).
  La tuile doit contenir un Pokemon (allié ou ennemi, vivant ou KO — **libre**,
  y compris un choix sous-optimal comme soigner/revive un ennemi).
- **Self-KO** du lanceur : **toujours** (même si la cible est vide / le move
  échoue → « tu meurs quand même, tampis »).
- **Effet selon l'état de la cible** :
  - Cible **KO** (`currentHp <= 0`) → **revive** : `currentHp = floor(maxHp * 0.5)`,
    statut principal + volatiles nettoyés, **ré-injection dans l'horloge CT**,
    ré-apparition sur sa case (le mon KO garde sa position), re-spawn sprite.
  - Cible **vivante** (`currentHp > 0`) → **soin 100%** : `currentHp = maxHp`,
    statut principal + volatiles nettoyés.
- **Fallback** : tuile vide / hors-portée invalide → move échoue, lanceur meurt
  quand même, CT payé.
- **Ordre** : soin/revive appliqué **avant** le self-KO du lanceur.

**Sous-système revive (neuf)** — à construire :
1. `handleRevive(targetId, hpAmount, events)` : restaure PV, clear statuts,
   ré-ajoute au `chargeTimeTurnSystem` (inverse de `onPokemonKO`), émet un
   nouvel event `PokemonRevived { pokemonId, hp }`.
2. **Grille** : le mon KO conserve `position` (jamais effacée dans `handleKo`) →
   vérifier que `grid.getOccupant` le ré-expose bien une fois `currentHp > 0`
   (l'occupancy filtre sur `currentHp <= 0` à plusieurs endroits). **À auditer** :
   la case est-elle réellement libérée au KO ou juste filtrée ? Si un autre mon
   a pris la case entre-temps, revive **échoue** (pas de télé-port).
3. **Victoire** : le revive peut **annuler une défaite** (dernier mon d'une team
   ressuscité) → `checkVictory` doit être ré-évalué **après** le revive, pas
   figé. Vérifier que `PokemonEliminated` d'un côté n'a pas déjà clos la partie.
4. **Renderer** (`battle-orchestrator.ts:1124`) : `PokemonEliminated` fade le
   sprite → gérer `PokemonRevived` : re-fade-in / re-création du sprite +
   barre PV + retrait du visuel « KO ». Anim de revive (reco : fade-in + petit
   flash soin).

### KO-trigger : Lien du Destin (destiny-bond) + Rancune (grudge)

**Nouvelle infra : attribution du coup fatal.** Le moteur doit savoir, au moment
d'un `handleKo`, **quel Pokemon** et **quel move** ont porté le coup. À vérifier :
`lastDamageDealt` / contexte d'action courant portent-ils déjà `attackerId` +
`moveId` ? Sinon, threader `{ lastHitBy?: { attackerId, moveId } }` sur
`PokemonInstance` (posé dans `handle-damage.ts`, lu dans `handleKo`).

- **Volatile commun** : `StatusType.DestinyBond` / `StatusType.Grudge` posé sur
  le lanceur, **actif jusqu'à son prochain tour** (expire à son tour suivant —
  mirror de la fenêtre Showdown). Badge InfoPanel + icône gauche barre PV.
- **Lien du Destin** : à `handleKo(user)`, si `user` a le volatile actif **et**
  `lastHitBy.attackerId` défini **et** l'attaquant est vivant → KO l'attaquant
  aussi (`handleKo(attacker)`, en évitant la récursion infinie / double-trigger).
  Émettre `DestinyBondTriggered { userId, victimId }`. Interaction match nul
  possible (double KO → `BattleEnded { winnerId: null }`, déjà géré plan 133).
- **Rancune** (RÉINVENTÉE — le PP-compteur d'usage n'existe plus, `game-design.md
  §4`) : à `handleKo(user)`, si le volatile actif **et** le KO vient d'un move
  (`lastHitBy.moveId`) → **verrouille ce move chez l'attaquant jusqu'à la fin du
  combat** (l'attaquant ne peut plus sélectionner ce move). Réutiliser l'infra de
  verrou de move existante (`lockedMoveId` / le mécanisme de blocage type
  Provoc/Dépit `handle-*`) mais **sans expiration** (permanent le reste du
  combat) — vérifier le champ exact : `lockedMoveId` est plutôt « forcé de jouer
  ce move » (Frénésie), on veut l'inverse (« interdit de jouer ce move »). Si
  aucun champ « move interdit » n'existe, ajouter
  `PokemonInstance.grudgeLockedMoveIds?: string[]` consulté par `getLegalActions`
  / la validation de sélection de move. Émettre `GrudgeTriggered { userId,
  attackerId, moveId }`. **Nettoyage** : le verrou persiste au fil du combat (pas
  de reset au tour), retiré seulement si l'attaquant est lui-même KO.
- Ces deux moves sont **Statut, ciblage self**, priorité normale (canon
  Destiny Bond = prio +0 en Gen ≥ 7). Pas de self-KO à eux seuls (le lanceur ne
  meurt que s'il se fait tuer).

## Découpage d'implémentation (ordre)

1. **Généralisation self-KO** : flag `selfKo`, refacto bloc `BattleEngine.ts:1704`
   + tests (Souvenir/Tout ou Rien non bloqués par Damp ; Destruction toujours bloqué).
2. **Explosion** (trivial) : data + tactical `isExplosion` + pattern zone r2
   (mirror `self-destruct`). Réconcilier **Explo-Brume** (déjà présent → vérifier
   qu'il est complet, sinon finaliser).
3. **Souvenir** : StatChange −2/−2 + selfKo + tests (immunité stat-drop ⇒ mort quand même).
4. **Tout ou Rien** : dégâts fixes = PV lanceur, typechart Combat, self-KO
   conditionnel au hit + tests (immunité Spectre ⇒ échoue, survit).
5. **Vœu Soin / revive** : sous-système `handleRevive` + `PokemonRevived` event +
   audit occupancy grille + re-check victoire + renderer re-spawn + tests
   (revive 50%, soin vivant 100%, cible vide ⇒ mort, case reprise ⇒ échoue,
   revive dernier mon ⇒ pas de défaite).
6. **KO-trigger** : attribution coup fatal (`lastHitBy {attackerId, moveId}` posé
   dans `handle-damage.ts` — **injecter à chaque hit** qui abaisse les PV, lu dans
   `handleKo`) + volatiles DestinyBond/Grudge + triggers dans `handleKo` + events
   + badges renderer + tests (double KO, expiration au tour pour Lien du Destin,
   verrou permanent du move fatal pour Rancune, KO non-move terrain/météo ⇒ pas
   de trigger).

**Corrections plan-reviewer intégrées** :
- **Étape 2** : Explo-Brume déjà dans `tactical.ts:1693` → vérifier qu'il a bien
  ses tests + son entrée movepool, sinon finaliser (ne pas re-coder).
- **Étape 5** : audit occupancy grille **explicite** — `Grid.getOccupant`
  (`Grid.ts:66`) ne filtre PAS `currentHp`, et `handleKo` n'appelle jamais
  `setOccupant(pos, null)` : la case du mon KO reste « occupée » par lui. Donc le
  revive en place fonctionne SI personne d'autre n'a pris la case ; ajouter un
  test « case reprise par un autre mon ⇒ revive échoue, lanceur meurt quand même ».
- Divergence à documenter dans `decisions.md` : Tout ou Rien applique le typechart
  complet alors qu'Effort (`handle-endeavor.ts`) n'applique aucun multiplicateur
  (simple set-HP) — deux mécaniques « PV-based » traitées différemment, assumé.

## Données / roster

- **Learnsets confirmés** (`.cache/showdown/learnsets.json`) — ⚠️ **filtrer par
  génération Gen 1**, la source `.cache` n'est PAS filtrée (pollution
  cross-gen) :
  Explosion 20 · Explo-Brume 5 · Souvenir (Grotadmorv/Smogogo/Goupix/Taupiqueur/Smogo —
  **exclure Miasmax = gen 5**) · Tout ou Rien 4 (Férosinge/Rattata/Taupiqueur/Mankey) ·
  Vœu Soin (Mélodelfe/Goupix/… — **exclure Leuphorie = gen 2**) ·
  Lien du Destin 5 (Ectoplasma/Smogogo/Fantominus/Spectrum/Smogo) ·
  Rancune 4 (Feunard/Goupix/Fantominus/Smogo).
- Ajouter les moves aux movepools dérivés (union OP sets ∪ learnset legal ∩ implémenté).
- **OP sets** : ajouter quelques variantes suicide (Ectoplasma Lien du Destin,
  Smogogo Souvenir, Rattata/Taupiqueur Tout ou Rien) pour Team Builder libre.

## i18n

- Noms déjà présents dans `moves.fr.json`/`moves.en.json` (dict complet).
- Clés neuves : tags MoveTooltip (`⚠ Sacrifice`, `♻ Revive`, `⏱ Lien du Destin`…),
  badges InfoPanel volatiles (Lien du Destin / Rancune), lignes BattleLog
  (`PokemonRevived`, `DestinyBondTriggered`, `GrudgeTriggered`,
  `EndeavorApplied` pour Tout ou Rien).

## Renderer

- **Vœu Soin/revive** : gérer `PokemonRevived` (re-spawn sprite fade-in + flash
  soin), défaire l'état visuel `PokemonEliminated`.
- **Lien du Destin / Rancune** : badges volatiles + icône gauche barre PV
  (mirror Charge/Perish).
- **Explosion / Explo-Brume** : réutiliser l'anim self-destruct existante.
- **Souvenir / Tout ou Rien** : anim self-KO générique (réutiliser recoil + KO).

## IA

- **Reporté** (cohérent avec les familles précédentes) : pas de scoring dédié
  dans ce plan. Garde-fou minimal : ne pas jouer un move self-KO à l'aveugle
  (Tout ou Rien à bas PV = bon ; Vœu Soin sans allié KO/blessé = mauvais). À
  affiner en passe IA groupée (type-manip / item / move-copy / stat-manip /
  phazing / pièges + sacrifice). Noté dans `docs/next.md` §Reporté.

## Tests (test-first core)

- `self-ko-flag` : selfKo non-Damp vs isExplosion Damp-blocked.
- `explosion` / `misty-explosion` : AoE r2 + self-KO.
- `memento` : −2/−2 + self-KO ; immunité stat-drop ⇒ mort quand même.
- `final-gambit` : dégâts = PV lanceur ; immunité Spectre ⇒ échoue+survit ; self-KO au hit.
- `healing-wish` : revive 50% (CT ré-injecté, sprite), soin vivant 100%, cible
  vide ⇒ mort, **case reprise par un autre mon ⇒ revive échoue + lanceur meurt**,
  revive dernier mon ⇒ pas de défaite.
- `destiny-bond` : double KO, expiration au tour suivant du lanceur, attaquant déjà mort.
- `grudge` : **verrou permanent du move fatal chez l'attaquant** (indisponible en
  sélection le reste du combat), KO non-move (terrain/météo) ⇒ pas de trigger.

## Points tranchés (validés humain 2026-07-03)

1. Portée Souvenir = **r3** (diamant Manhattan, cohérent moves de contrôle).
2. Tout ou Rien = **typechart complet** (immunité + résist/faiblesse).
3. Tout ou Rien = self-KO **conditionnel au hit** (miss/immunité Spectre ⇒ échoue, lanceur survit, CT payé).
4. Rancune = **verrou permanent** du move fatal (pas de PP-compteur dans le jeu).
5. Vœu Soin = revive **50%** / soin vivant **100%**.
6. Lien du Destin = fenêtre **tours du lanceur**.
7. Learners **filtrés Gen 1** (exclure Miasmax, Leuphorie).
