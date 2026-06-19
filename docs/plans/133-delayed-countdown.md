# Plan 133 — Delayed / countdown

**Statut : implémenté + validé humain (playtest 2026-06-19)**

## Validé en human-testing (2026-06-19)

- **Prescience** ✅ live (sandbox) — après fixes preview (zone r1 affichée, intention rouge).
- **Balance** ✅ live, **Effort** ✅ live.
- **Coup d'Main** : non testable en sandbox 1v1 (cible allié) → couvert par test unitaire.
- **Requiem** ✅ live après **REDESIGN** (aura de mort mobile, cf. ci-dessus) + passe en rendu **aura** (badge 🎵 gauche barre PV + zone r2 au survol, pas un champ persistant).

### Fixes livrés pendant le playtest
- **Preview ciblage sol AoE** : `GroundTarget` accepte `radius?` → `resolveGroundTarget` renvoie la zone r1, preview in-game + grille tooltip l'affichent. `moveIntent` classe Prescience/Effort/Balance en *attaque* (rouge).
- **Rendu Requiem = aura** : badge `🎵` à gauche de la barre PV (`refreshAuraVisuals`), zone r2 affichée **au survol** du lanceur (`showAuraHoverFor`), compteur flottant `🎵 N` par tick. Pas de zone peinte en permanence (rejeté : « bizarre comme un champ »).
- **Match nul (double K.O.)** : `checkVictory` gère `playersAlive.size === 0` → `BattleEnded { winnerId: null }`, propagé orchestrator/chrome/log/i18n (`battle.draw`). Corrige un crash `ChargeTimeTurnSystem: no actor` quand Requiem rase les deux camps.

## Reste (polish différé — fonctionnel sans)

- **Tags MoveTooltip** des 5 moves (⏱ différé 2t, 🎵 aura mortelle, etc.).
- **Test ghost-clock Prescience** (lanceur KO avant l'impact) : couvert par réutilisation de l'infra météo testée (`ct-ghost-clock.test.ts`) ; ajouter un test d'intégration dédié (test-writer).
- **e2e** Prescience/Requiem (scénarios pilotables) + `docs/test-plan.md` (test-writer).

**Phase 4 — Mécaniques restantes (moves complexes), famille « Delayed / countdown ».**

## But

Porter la famille **différés / décompte** dans le jeu tactique sur grille. 5 moves, 4 mécaniques neuves :

| Move (FR / EN) | Type / Cat | Mécanique |
|----------------|-----------|-----------|
| **Prescience** (`future-sight`) | Psy / Spé | Frappe différée **liée au sol** : verrouille une tuile, AoE r1 Manhattan **2 tours plus tard**. |
| **Requiem** (`perish-song`) | Normal / Statut | Décompte global 3 tours sur **tous** les Pokémon présents → KO à 0. |
| **Balance** (`pain-split`) | Normal / Statut | Moyenne les PV du lanceur et de la cible (instantané). |
| **Effort** (`endeavor`) | Normal / Phys | PV cible ← PV lanceur **si cible > lanceur** (instantané). |
| **Coup d'Main** (`helping-hand`) | Normal / Statut | Buff ×1.5 sur le prochain move offensif d'un allié adjacent. |

**Vœu Destructeur** (`doom-desire`) **écarté** : 0 apprenant Gen 1 (Jirachi only). Pairé à Prescience dans la roadmap mais hors roster.

> Note : **Vœu** (`wish`, soin différé) est **déjà livré** (plan 116, infra `PostWish` + `wishTickHandler`). Sert de modèle pour le différé model-agnostic.

## Décisions de design (tranchées avec l'humain, 2026-06-19)

| Axe | Choix |
|-----|-------|
| **Périmètre** | Les **5** moves d'un coup, 1 commit final. |
| **Prescience — ciblage** | **Ciblage SOL** : `TargetingKind.GroundTarget` (réutilisé plan 131, portée 4). On désigne une **tuile** (libre ou occupée), pas un Pokémon. |
| **Prescience — zone d'impact** | **AoE r1 Manhattan** autour de la tuile verrouillée (roadmap). Touche **qui s'y trouve au landing** — y compris **alliés du lanceur** (tir ami possible). Tuile vide → coup dans le vide. |
| **Prescience — calcul dégâts** | **Offense figée au cast** (SpA + stages, niveau, puissance 120, type Psy, snapshot météo, `casterId`). **Défense recalculée au landing** : type-efficacité + Def/SpD vs **chaque** occupant de la zone. Propre pour AoE et occupant changé. |
| **Prescience — délai** | **2 tours du lanceur**, modèle durée **identique à la météo plan 128** (pas aux barrières) : décompte sur les tours du lanceur, et si le lanceur est KO avant l'impact → **horloge fantôme** (le lanceur reste planifié dans le scheduler CT via `advanceTurn`, cf. `weather-tick-handler` lignes 48+). La frappe résout quand même, offense déjà gelée. |
| **Requiem — REDESIGN (validé humain 2026-06-19, playtest)** | **Aura de mort mobile** (PAS le compteur global canon, jugé inutilisable/auto-destructeur sans switch). Le lanceur active une aura **centrée sur lui, r2 Manhattan (13 tuiles), qui le suit** (infra mobile plan 095). Décompte **3 tours du lanceur**. À l'expiration : **tout Pokémon vivant dans la zone meurt** — alliés + ennemis + **lanceur** (toujours au centre → vrai sacrifice). On peut **fuir** la zone ou la **traîner** sur l'ennemi. **Si le lanceur meurt avant l'expiration → l'aura disparaît** (pas de ghost-clock, comme les barrières plan 095). Move sonore (flags `sound`/`bypasssub`) sans incidence ici (pas de Substitut à traverser). |
| **Requiem — état/rendu** | Volatile `perishAura?: { turnsRemaining, radius }` sur le lanceur (1 par lanceur, caster-bound, mobile par recalcul depuis `caster.position`). Tick fin de tour du lanceur. Rendu : overlay de tuiles rouge persistant sur la zone r2 autour du lanceur (réutiliser le rendu de zone Champs/Distorsion), suit le lanceur. |
| **Balance** | `avg = floor((lanceur.currentHp + cible.currentHp) / 2)` ; les deux ← `min(avg, maxHp)`. Cible ennemie unique, portée standard, **bloqué par Protection** (flag `protect`). Pas de contact. |
| **Effort** | Si `cible.currentHp > lanceur.currentHp` : `cible.currentHp ← lanceur.currentHp` (copie pure). Sinon **échec**. Ne KO jamais (la cible garde au minimum les PV du lanceur, ≥ 1 tant que le lanceur est vivant). Contact, cible unique, bloqué par Protection. |
| **Coup d'Main — cible** | Allié **adjacent** (`adjacentAlly`, portée 1). Échoue si pas d'allié à portée (pas de self). |
| **Coup d'Main — durée/conso** | Volatile `helpingHand` posé sur l'allié. Effacé à la **prochaine action complète de l'allié** : move offensif (`power > 0`, **Drain inclus** — recompte via damage-calc) → ×1.5 puissance ; move statut/soin → **gaspillé** (effacé sans effet). Model-agnostic, pas de réf lanceur ni timer. Ne stacke pas. |

## Règles canon (tranchées par Claude)

- **Prescience** : échoue si une frappe Prescience est **déjà active sur la même tuile** (canon « one per slot »). Pas de stacking de frappes différées au même endroit.
- **Prescience — esquive** : au landing, si la tuile verrouillée + son AoE r1 ne contiennent **aucun mon vivant**, le coup tombe dans le vide (aucun effet). Bouger hors zone (déplacement, knockback, dash, recul) = esquive totale. La défense (type-eff, Def/SpD stages, objets, météo/champ live) est recalculée vs chaque occupant **au moment du landing** ; seule l'offense du lanceur est figée.
- **Requiem** : **Anti-Bruit** (`soundproof`, Electrode du roster) devrait immuniser. **Non implémenté** dans le moteur (gap connu, partagé par tous les moves sonores existants — Dissonance Psy plan 132, Bruit Blanc, etc.). **Hors scope** : noté backlog. Tous les présents reçoivent le décompte.
- **Requiem** : un mon déjà KO n'est pas affecté ; un mon entrant (placement terminé, pas de switch en jeu) → non concerné après le cast.
- **Balance / Effort** : ne peuvent **pas** faire monter les PV au-dessus de `maxHp`. Effort ne peut pas KO (laisse ≥ PV lanceur ≥ 1 si lanceur vivant). Balance peut soigner le lanceur (si cible a plus de PV) ou le blesser.
- **Coup d'Main** : ne booste que les moves **offensifs** (puissance > 0). N'affecte pas un statut/soin de l'allié.

## Réglages par défaut (mineurs, override humain possible)

- `FUTURE_SIGHT_DELAY_TURNS = 2`, `FUTURE_SIGHT_RADIUS = 1`, `FUTURE_SIGHT_POWER = 120`, portée pose `GroundTarget` range 4.
- `PERISH_COUNTER_TURNS = 3`.
- `HELPING_HAND_MULTIPLIER = 1.5`.
- Coût CT : **coûts naturels** (`computeMoveCost = max(ppCost, powerFloor, effectFloor)`, pas d'override `effectTier`). Vu les PP réels : **Prescience 900** (120 BP / 10 PP — lourd = lanceur lent = télégraphe plus long = menace équitable, va dans le sens de la reco game-designer « plus c'est cher, plus c'est juste »), **Requiem 900** (5 PP, engagement fort), **Effort 900** (5 PP, situationnel), **Balance 500** (20 PP), **Coup d'Main 500** (20 PP — reste viable pour un move sans dégât).

## Architecture (core découplé)

### Enums / types
- `EffectKind` : `PostFutureSight`, `PostPerishSong`, `PainSplit`, `Endeavor`, `HelpingHand`.
- `BattleState.pendingStrikes: PendingStrike[]` (nouveau, façon `entryHazards[]`) :
  `{ centerPosition: Position, radius: number, frozenOffense: { spA, level, power, type, weather }, casterId: string, casterPlayerId: string, turnsRemaining: number }`.
  `casterPlayerId` = **ID du joueur** (pas pokemonId) — sert au log/IA, **pas** de filtre owner sur les dégâts (tir ami volontaire, cf. zone).
- `PokemonInstance` volatils : `perishCounter?: number`, `helpingHand?: boolean`.
- `BattleEventType` : `FutureSightPosted`, `FutureSightStruck`, `PerishCountSet`, `PerishCountDecremented`, `PerishKo`, `PainSplitApplied`, `EndeavorApplied`, `EndeavorFailed`, `HelpingHandPosted`, `HelpingHandConsumed`.

### Handlers d'effet (cast) — `effect-processor` registry
- `handlePostFutureSight` : snapshot offense, vérifie pas de frappe sur la tuile, push `PendingStrike`.
- `handlePostPerishSong` : pose `perishCounter = min(existant, 3)` sur tous les mons vivants.
- `handlePainSplit`, `handleEndeavor`, `handleHelpingHand` : instantanés.

### Tick handlers (start-turn pipeline, cf. `wishTickHandler`)
- `futureSightTickHandler` (global, priorité après Wish) : à chaque tour du **lanceur** (matché via `frozenOffense.casterId`, ghost-clock si KO), `turnsRemaining--` ; à 0 → résout l'AoE r1 (dégâts par occupant) et émet `FutureSightStruck`, retire de `pendingStrikes`.
- `perishTickHandler` (per-mon) : décrémente `perishCounter` sur le tour du mon, KO à 0.
- `helpingHand` expiry : au début du tour du **lanceur**, si toujours posé et non consommé → effacer (via volatile timer existant ou check dédié).

### Damage calculator
- Param `helpingHandMultiplier` : si l'attaquant porte `helpingHand` et move offensif → ×1.5, émettre `HelpingHandConsumed`, effacer le volatile.
- Réutiliser le pipeline de dégâts existant pour la frappe Prescience (offense gelée injectée, défense live).

### Nettoyage
- `handleKo` : retirer `perishCounter`/`helpingHand` du mon KO ; **ne pas** retirer les `pendingStrikes` du lanceur KO (ghost-clock).
- Reset de combat : vider `pendingStrikes`.

## Renderer (view-core, découplé)
- **Prescience** : marqueur sol sur la/les tuiles verrouillées (réutiliser indicateur tuile existant, teinte psy). Au landing : flash AoE + flottants dégâts par occupant.
- **Requiem** : badge décompte `Requiem {n}` (indicateur gauche barre PV, cf. système `setLeftIndicators` plan 095) + InfoPanel volatile.
- **Coup d'Main** : badge volatile `Coup d'Main` sur l'allié buffé.
- **Balance / Effort** : flottants de variation PV (système existant).
- `BattleLogFormatter` : 1 cas par nouvel event (noms FR).

## IA (`action-scorer`)
- **Prescience** : scorer la zone par menace attendue (mons ennemis sur/proches de la tuile), bonus si plusieurs cibles dans r1, malus si tuile déjà sous frappe.
- **Requiem** : valoriser quand l'IA est en mauvaise posture / mons ennemis à PV pleins sans soin (échange de KO). Malus si ses propres mons mourraient d'abord.
- **Balance** : valoriser quand `lanceur.currentHp` est bas et `cible.currentHp` haut (vol de PV).
- **Effort** : valoriser quand lanceur bas + cible haute (gros chip).
- **Coup d'Main** : valoriser si allié adjacent avec move offensif fort prêt à tirer ce tour-ci.

## Data
- 5 moves câblés dans `tactical.ts` (effets + targeting + coût CT).
- i18n FR/EN : noms (déjà en reference) + descriptions tags + clés event log + badges.
- OP sets (data-miner) : leads/porteurs Gen 1 — Prescience (Mr. Mime, Slowbro, Starmie, Exeggutor, Hypno, Jynx), Requiem (Lapras, Jynx, Wigglytuff, Clefable), Balance (Ectoplasma…), Effort, Coup d'Main. Valider apprenants réels via resolver.

## Tests
- **Core unit** (test-first, 1 fichier/move) :
  - `future-sight` : pose, délai 2 tours, AoE r1, esquive (cible bouge), tir ami, occupant changé (type-eff recalc), offense gelée, ghost-clock (lanceur KO), échec si frappe déjà sur tuile.
  - `perish-song` : 3→0 KO, lanceur inclus, décompte par mon, re-cast garde min, sonore traverse/ignore Sub.
  - `pain-split` : moyenne, clamp maxHp, bloqué Protection.
  - `endeavor` : set si cible>lanceur, échec sinon, pas de KO, bloqué Protection.
  - `helping-hand` : ×1.5 prochain move offensif, conso 1×, expire non utilisé, échec sans allié adjacent, n'affecte pas statut.
- **Intégration** : 1 suite par mécanique (différé, décompte, instantanés, buff).
- **e2e** : scénario observable Prescience (marqueur sol + frappe différée) si pilotable via journal/scène ; MAJ `docs/test-plan.md`.

## Ordre d'implémentation
1. Enums + types + state (`pendingStrikes`, volatils).
2. Instantanés d'abord (Balance, Effort) — plus simples, valident le registry.
3. Coup d'Main (buff + conso damage-calc).
4. Requiem (décompte per-mon).
5. Prescience (différé sol + ghost-clock) — le plus complexe en dernier.
6. Renderer + log + IA + data + i18n.
7. Tests à chaque étape (test-first core).
8. Gate CI + validation humaine.

## Risques / points d'attention
- **Ghost-clock Prescience** : bien réutiliser le mécanisme `advanceTurn` existant (weather/field) — ne pas réinventer. Principal risque technique.
- **Tir ami Prescience** : vérifier que la zone touche `playerId` quelconque (pas de filtre owner), contrairement aux hazards.
- **Substitut vs Requiem** : sonore → ignore Sub (cf. infra plan 099/132).
- **Soundproof non implémenté** : noter backlog, ne pas bloquer.
