# Implémentations — Pokemon Tactics

> Document vivant maintenu par `doc-keeper` après chaque plan.
> PMDCollab = animations disponibles dans SpriteCollab pour les animations utilisées :
> Animations requises (tous) : Idle, Walk, Attack, Shoot, Charge, Hop, Hurt, Faint, Sleep.
> Animation requise (type Vol uniquement) : FlapAround → synthèse `FlyingIdle`.

---

## Récapitulatif

> Pool = ce qui est disponible pour Gen 1 dans la référence Champions (Gen 9). Objets = total référence (combat-relevant à évaluer au cas par cas).

| Catégorie | Implémenté | Pool disponible | Commentaire |
|---|---|---|---|
| Pokemon | **150 / 151** | 151 Gen 1 | Contrainte Gen 1 (décision #92) — Gen 2+ en Phase 9. Formes finales + pré-évolutions toutes incluses (plan 135, décision #542). Métamorph/Ditto exclu (pas de Transformation). Spectrum/Haunter retiré post-Batch C (sprites conservés). |
| Attaques | 469 | 493 | Pool roster (level-up + TM + tutor + chaîne évo sur 80 jouables ∩ `reference/moves.json`), **Téra-Explosion exclue** (décision #422). **~100 restants = tous à mécanique moteur**, classés par système dans **plan 112** (roadmap maître). +mist/safeguard (plan 098), +substitute (plan 099), +taunt (plan 100), +disable/encore (plan 101), +40 dmg physique G1 (plan 102), +23 dmg spécial + multi-hit G2 (plan 103), +24 dmg + secondaire statut/flinch/confusion G3 (plan 104), +36 dmg stat-drop/high-crit/recoil/drain G4 (plan 105), +23 statut/stat-baisses pures G5 (plan 106), +11 simples G6 (plan 107). **Batches G1–G6 clos.** +12 power conditionnel plan 109 (moteur dynamicPower). +2 stat-source plan 110 (Bodypress/Tricherie). +4 poids plan 111 (Balayage/Nœud Herbe/Tacle Lourd/Tacle Feu). +6 B1 quasi-prêt plan 113 (Choc Psy/Frappe Psy/Lyophilisation/Triple Axel/Pied Voltige/Talon-Marteau). +17 B3 dégâts conditionnels plan 115 (horloge d'actions). +11 B2 soin plan 116 (É-Coque/Paresse/Racines/Anneau Hydro/Vibra Soin/Fontaine de Vie/Vœu/Aromathérapie/Vole-Force/Dévorêve/Boule Pollen). +4 B4 terrains plan 117 (Champ Herbu/Électrifié/Brumeux/Psychique). +7 B4 dépendants des Champs plan 118 (Gliss'Herbe/Monte-Tension/Vaste Pouvoir/Explo-Brume/Champlification/Force Nature + Boue-Bombe). **B4 clos (10/10).** Chantier g Post-Babylon : rebalance portées Dash (barème Vitesse Extrême→5, nukes→4, Taurogne→3, Roue de Feu/Désherbaffe/Nitrocharge→2). **Roulade** : mécanisme snowball ajouté (`DynamicPowerKind.RolloutStreak`, portée base 2 → cap 5, puissance 30 → 480). Décisions #518–521. **Plan 130 — Distorsion (`trick-room`)** : zone statique diamant Manhattan r3, inversion CT par vitesse en entrée (`max(1, 160 − baseSpeed)`), 5 tours du lanceur + horloge fantôme. 2 OP sets ajoutés (Noadkoko Distorsion, Flagadoss Distorsion). 393 → 394 moves. 177 → 179 OP sets. Décisions #522–524. **Plan 131 — Entry Hazards (Pièges au sol)** : famille « Hazards » Phase 4 — 4 setters (Picots/`spikes`, Pièges de Roc/`stealth-rock`, Pics Toxik/`toxic-spikes`, Toile Gluante/`sticky-web`) + 2 removers (Tour Rapide/`rapid-spin`, Anti-Brume/`defog`). `TargetingKind.GroundTarget`, déclenchement à l'entrée, permanent, team-agnostic. 4 OP sets ajoutés via data-miner (leads Crustabri/Ptéra, spinner Staross, Anti-Brume Rapasdepic). **394 → 400 moves. 179 → 183 OP sets.** Décisions #525–528. **Plan 132 — Contrôle (famille close)** : Possessif/`imprison` (volatil persistant lanceur, `StatusType.Imprisoning`, filtre inverse `getLegalActions`, coût MajorStatus 700, meurt avec le lanceur), Dissonance Psy/`psychic-noise` (Psy Spé 75 BP, Cône 1-3, `sound: true` perce le Substitut, secondaire `StatusType.HealBlocked` 2t — bloque usage moves de soin + application soin entrant, Drain : dégâts OK / soin 0, HoT suspendu, Vœu gaspillé), Dépit/`spite` (taxe CT one-shot `SPITE_CT_PENALTY = 350`, `PokemonInstance.pendingCtPenalty?`, bloqué par Substitut). 3 OP sets ajoutés (Ectoplasma Possessif/Dépit, Mewtwo Possessif/Dissonance Psy, Alakazam Possessif/Désactivation). **400 → 403 moves. 183 → 186 OP sets.** Décisions #529–534. **Plan 133 — Delayed / countdown (famille close)** : Prescience/`future-sight` (ciblage sol GroundTarget r4, AoE r1 au landing, 2 tours du lanceur + horloge fantôme, offense figée au cast, défense recalculée au landing — Décision #535), Requiem/`perish-song` (redesign : aura mobile r2 caster-bound, décompte 3 tours du lanceur, KO alliés+ennemis+lanceur à l'expiration, badge 🎵 + survol — Décision #536), Balance/`pain-split` (moyenne PV instantanée, bloqué Protection), Effort/`endeavor` (PV cible ← PV lanceur si cible > lanceur, bloqué Protection), Coup d'Main/`helping-hand` (×1.5 prochain move offensif allié adjacent, volatile model-agnostic). Fix livré au playtest : match nul double K.O. (`checkVictory` → `winnerId: null`, `battle.draw`). **403 → 408 moves.** Décisions #535–536. **Plan 134 — Power conditionnel restant (famille close)** : Hommage Posthume/`last-respects` (`AllyFaintCountScaled` : power × (1 + alliés KO) — hors-pool Gen 1, couverture Team Builder libre — Décision #538), Branchicrok/`fishious-rend` et Prise de Bec/`bolt-beak` (`TargetIdleSinceLastAction` : ×2 si cible n'a pas agi depuis la dernière action du lanceur — tempo-based — Décision #537). **408 → 411 moves. Famille Power conditionnel close.** **Plan 142 — Item interaction (famille close)** : infra core (champs `PokemonInstance` : `consumedItemId`, `ateBerryThisBattle`, `critStageBoost` ; helpers `held-item-transfer.ts` : `consumeHeldItem`/`removeHeldItem`/`stealHeldItem`/`swapHeldItems`/`recycleConsumedItem` ; lecture `critStageBoost` dans `damage-calculator.ts`) ; 7 `EffectKind` : `RemoveItem`/`StealItem`/`SwapItems`/`FlingItem`/`EatTargetBerry`/`BurnTargetItem`/`RecycleItem` ; tables `FLING_POWER`+`FLING_EFFECT` ; flags moves `knockOffBoost`/`requiresEatenBerry`/`requiresFlingableItem` ; events `ItemRemoved`/`ItemStolen`/`ItemsSwapped`/`BerryEatenByEnemy`/`ItemBurned`/`ItemRecycled`/`ItemFlung`/`MoveFailedNoItem`/`MoveFailedNoBerry`/`ItemTransferBlocked`. 12 moves : **Sabotage** (`knock-off`, ×1.5 + retire objet), **Larcin** (`thief`), **Implore** (`covet`, vol si mains vides), **Tour de Magie** (`trick`), **Passe-Passe** (`switcheroo`, échange inconditionnel si au moins 1 non vide), **Dégommage** (`fling`, puissance table, effets secondaires), **Picore** (`pluck`), **Piqûre** (`bug-bite`, mange baie cible), **Calcination** (`incinerate`, détruit baie/gemme), **Gaz Corrosif** (`corrosive-gas`, statut Single 1-3, retire tout objet), **Recyclage** (`recycle`, restaure `consumedItemId`), **Éructation** (`belch`, Poison 120 BP, gate `requiresEatenBerry`). **411 → 423 moves.** Décisions #566–#577. **Famille Pièges (Trapping) — 2026-06-28** : nouveau champ `positionLinked?: boolean` sur l'effet `Status` dans `packages/core/src/types/effect.ts`. Pièges purs = piège position-linked : le verrou est maintenu tant que le lanceur reste à distance Chebyshev ≤ 1 du piégé ; libéré si le lanceur meurt ou s'éloigne ; `remainingTurns -1 + sourceId=attacker`. Réutilise la mécanique Magnépik (`magnet-pull`). Pièges partiels = réutilisent `StatusType.Trapped` + `damagePerTurn` déjà existants. Périmètre in-pool uniquement (hors-pool ignorés : Claquoir, Harcèlement, Vortex Magma, Voltageôle, Troquenard). 6 moves ajoutés : **Étreinte** (`bind`, Contact 1-1, dégâts + Trapped 4-5t + 1/8 PV/tour), **Danse Flammes** (`fire-spin`, 1-2, dégâts + Trapped), **Siphon** (`whirlpool`, 1-2, dégâts + Trapped), **Tourbi-Sable** (`sand-tomb`, 1-2, dégâts + Trapped), **Barrage** (`block`, 1-1, piège pur position-linked, effectTier MajorStatus), **Regard Noir** (`mean-look`, 1-1, piège pur position-linked, effectTier MajorStatus). **423 → 429 moves.** Décisions #578–#580. **Plan 143 — Type manip (famille close) — 2026-06-28** : première mécanique de mutation runtime du type. Infra core : `PokemonInstance.typeOverride?: PokemonType[]` (un seul override à la fois, persistant fin de combat, `[]` = sans type, reset au KO) ; helper `resolveBaseTypes(pokemon, pokemonTypesMap)` + `BattleEngine.effectiveTypesOf` (22 sites de lecture directe routés) ; flag move `requiresUserType` ; `moveTypeOf` injecté dans `EffectContext`. 5 `EffectKind` + handlers dans `handlers/type-change/` (`handle-convert-self-type.ts`, `handle-convert-resist-type.ts`, `handle-copy-target-type.ts`, `handle-soak-type.ts`, `handle-remove-type.ts`). Event `TypeChanged { pokemonId, newTypes, reason }`. InfoPanel : badges de type reflètent l'override effectif. Badge « Type {types} » sur changement. 5 moves ajoutés : **Conversion** (`conversion`, Statut self, self → type du 1er move du moveset, learner : Porygon), **Conversion 2** (`conversion-2`, Statut ennemi r1, self → type PRNG résistant au dernier move cible, learner : Porygon), **Copie-Type** (`reflect-type`, Statut r1, self copie les types effectifs cible, learners : Tentacruel/Ectoplasma/Mew), **Détrempage** (`soak`, Statut ennemi r1, cible → Eau pur, bloqué par Clone, learners : lignées Eau), **Flamme Ultime** (`burn-up`, Feu Spé 130, dégâts puis lanceur perd type Feu, échoue wholesale si non-Feu, learner : Arcanin). Téra Explosion hors-scope (décision #581). **429 → 434 moves.** Décisions #581–#586. **Plan 144 — Move-copy (famille close) — 2026-06-29** : première vraie réentrance moteur. Infra core : `CallMoveSourceKind` enum (RandomAll/RandomOwnAsleep/TargetLast/GlobalLast), `MoveDefinition.callMove?`, `PokemonInstance.pendingCalledMove?`, `BattleState.lastMoveUsedGlobally?`, `EffectKind.CopyMoveToSlot` (+ handler `handlers/move-copy/`), helpers `battle/move-copy/callable-moves.ts` (exclusions), events `MoveCopied`/`MoveCopyFailed`. Réentrance = méthode `BattleEngine.prepareCalledMove` (query : roll PRNG / lecture dernier move → pose `pendingCalledMove`, idempotent/verrou anti-reroll, n'avance pas le tour) + swap dans `resolveEffectiveMove` (`pending.sourceMoveId === move.id` → move appelé) ; lazy-prepare dans `executeUseMove` pour le chemin IA/headless ; cleanup KO + fin de tour. 6 moves : **Métronome** (`metronome`, random parmi tous les implémentés − exclusions), **Blabla Dodo** (`sleep-talk`, random du moveset propre, gate sommeil `requiresAsleep`), **Mimique** (`mirror-move`, dernier move de la cible), **Photocopie** (`copycat`, dernier move global), **Copie** (`mimic`) + **Gribouille** (`sketch`, remplacent leur slot via `CopyMoveToSlot`). Renderer : UI 2-temps réutilisant `select_attack_target` via le swap pending — masquage `???` pour les aléatoires (chrome affiche la source + flag `masked`), Mimique divert dans `tryPickTarget`. IA : `enrichCalledMove` (résout + re-cible). Tags tooltip 🎲/🪞/📋. Mimique/Photocopie/Copie/Gribouille hors-pool Gen 1 (0 learner → Team Builder libre). **434 → 440 moves.** Décisions #587–#590. **Plan 145 — Field global (famille close) — 2026-07-02** : 4 moves canon « pleine arène » relocalisés en mécaniques positionnelles (cohérence projet — seule la météo reste full-arène). Infra core : type générique `FieldGlobalZone` discriminé par `kind` (mirror `DistortionZone`), `state.fieldGlobalZones[]`, `field-global-system.ts` (pose façon Champs, 5 tours du lanceur + horloge fantôme), `EffectKind.PostFieldGlobal`. **Gravité** (`gravity`, zone diamant r3 : Volants cloués au sol dans la zone via `isGroundedByGravity` sur 3 sites — immunité Sol/hazards/knockback —, précision ×5/3 contre un défenseur en zone, bloque Vol/Rebond/Pied Voltige pour un lanceur en zone, Tunnel/Plongée restent légaux). **Zone Étrange** (`wonder-room`, zone diamant r3, échange Déf↔DéfSpé du défenseur en zone dans `damage-calculator.ts`, crans restent sur leur slot d'origine — canon Gen 6+). **Zone Magique** (`magic-room`, zone diamant r3, neutralise les effets d'objet tenu d'un porteur en zone via helper unique `getActiveHeldItem` routant 5-6 sites de lecture d'objet, objet non consommé). **Vent Arrière** (`tailwind`, champ directionnel global unique N/S/E/O — pas une zone, pas team-scoped — `state.tailwind`, ctGain ×1.5 pour tout Pokemon des 2 camps orienté dans le sens du vent, snapshot à la frontière de tour, décompte round-global distinct du modèle météo, cumul après Distorsion). Boussole 3D always-on (`compass.glb`) près du portrait actif + HUD flèche Vent Arrière (rotation iso 45° + caméra). **440 → 444 moves.** Décisions #591–#594. **Plan 146 — Stat/state manip (famille close) — 2026-07-02** : première manipulation des crans de stats partagés + override Vitesse brute. Infra core : `PokemonInstance.speedStatOverride?: number` (mirror `typeOverride`, reset au KO) + helper `effectiveBaseSpeed` routant déplacement (`computeMovement` × 4 sites) et ordre de tour (`getCtGainForPokemon`) ; `EffectContext.pokemonInRadius(center, radius)` (voisinage Manhattan des vivants) ; helper partagé `applyStageWrite` (cran clampé + `StatChanged` delta + recompute movement) ; helper `statManipBlockedBySubstitute` (Clone bloque, ignore `bypasssub` — override tactique, précédent Dépit). 5 `EffectKind` + handlers `handlers/stat-manip/` : `ResetStatStages` (area/single), `CopyStatStages`, `InvertStatStages`, `SwapStatStages`, `SwapRawSpeed`. Events chapeau `StatStagesReset`/`StatStagesCopied`/`StatStagesInverted`/`StatStagesSwapped`/`SpeedSwapped` (deltas via `StatChanged` réutilisé). Garde-fou IA (`action-scorer.ts`) : score négatif quand copie/inversion/échange favorise la cible. 8 moves : **Buée Noire** (`haze`, Zone r3 auto-centrée, reset team-agnostic lanceur inclus, ignore Clone/Brume), **Boost** (`psych-up`, copie les crans cible, ennemi 1-3), **Bain de Smog** (`clear-smog`, Poison Spé 50, dégâts puis reset cible, interaction Clone standard), **Renversement** (`topsy-turvy`, inverse les crans cible, ennemi 1-3, hors-pool), **Permugarde** (`guard-swap`, échange Déf/DéfSpé, ennemi 1-3), **Permuforce** (`power-swap`, échange Atq/AtqSpé, ennemi 1-3), **Permuvitesse** (`speed-swap`, échange Vitesse brute, ennemi r1, learners Alakazam/Abra/Kadabra), **Permucœur** (`heart-swap`, échange les 7 crans, ennemi r1, hors-pool). Renversement/Permucœur hors-pool (0 learner → Team Builder libre). **444 → 452 moves.** Décisions #595–#599. **Famille Phazing / forçage — 2026-07-03** : réinterprétation du switch-out canon sur la grille (pas de banc). Nouvel `EffectKind.PhazeToSpawn` + handler `handle-phaze.ts` réutilisant `ejectToSpawn` (famille forced-teleport, décisions #564-565 ; threat = position du lanceur → éjecte loin de lui), réutilise l'event `Teleported`. Éjection **seule** (crans de stats + volatiles conservés — repositionnement, pas un reset de switch complet) ; allié/lanceur jamais éjectés ; cible sans case de spawn libre → le move fait long feu pour elle. 3 moves : **Cyclone** (`whirlwind`, Zone r1 auto-centrée, éjecte tous les ennemis adjacents, 0 dmg), **Hurlement** (`roar`, Cône 1-3 sonore, éjecte les ennemis du cône, 0 dmg — **converti** depuis l'ancien −1 Atk stopgap), **Projection** (`circle-throw`, Combat Phys Single 1-1 contact, dégâts puis éjection). IA fine différée (score neutre, jamais négatif — éjecter un ennemi n'est jamais un contresens). **452 → 454 moves.** **Plan 147 — Sacrifice / Self-KO (famille close) — 2026-07-03** : généralisation du self-KO + 2 mécaniques neuves (KO-trigger, revive). Infra core : `MoveDefinition.selfKo?: boolean` (distinct d'`isExplosion`, non bloqué par Moiteur ; `isExplosion` implique toujours `selfKo` et reste bloqué par Moiteur) ; `MoveDefinition.selfKoOnConnect?: boolean` (self-KO conditionnel au hit, Tout ou Rien) ; `EffectKind` `FinalGambit`/`ReviveOrHeal`/`PostDestinyBond`/`PostGrudge` ; `StatusType.DestinyBond`/`Grudge` (volatiles expirés au début du tour du lanceur via `sacrificeBondExpireHandler`) ; `PokemonInstance.lastHitBy?: { attackerId, moveId }` (attribution du coup fatal, posé dans `handle-damage.ts`, lu dans `handleKo`) ; `PokemonInstance.grudgeLockedMoveIds?: string[]` (verrou permanent, filtré dans `getLegalActions` + garde `submitAction`) ; `ChargeTimeTurnSystem.onPokemonRevived` (ré-injection dans l'horloge CT) ; event `PokemonRevived` étendu (`casterId`, `revived`). 7 moves : **Explosion** (`explosion`, self-KO + AoE zone r2 auto-centrée, mirror Destruction, bloqué par Moiteur), **Explo-Brume** (`misty-explosion`, préexistant, vérifié complet), **Souvenir** (`memento`, Statut ennemi r3, self-KO + Atq/Atq.Spé −2, mort quand même si le débuff est bloqué, non bloqué par Moiteur), **Tout ou Rien** (`final-gambit`, Combat Spé, ciblage Single contact 1-1, dégâts fixes = PV actuels du lanceur avec typechart complet — immunité Spectre annule tout —, self-KO seulement si le coup connecte), **Vœu Soin** (`healing-wish`, RÉINVENTÉ « Second Souffle », Psy Statut, ciblage tuile r3 n'importe quel occupant, self-KO toujours, cible KO → revive 50% PV max + statuts nettoyés + ré-CT, cible vivante → soin 100% + statuts nettoyés, premier move de revive du jeu), **Lien du Destin** (`destiny-bond`, Spectre Statut self, volatile jusqu'au prochain tour du lanceur, si le lanceur est KO par un attaquant vivant → l'attaquant tombe aussi), **Rancune** (`grudge`, RÉINVENTÉ, Spectre Statut self, volatile jusqu'au prochain tour du lanceur, si le lanceur est KO par un move → ce move verrouillé chez l'attaquant jusqu'à la fin du combat, PP-compteur d'usage n'existant plus dans le jeu). IA : garde-fou minimal reporté, pas de scoring dédié. **454 → 460 moves.** Décisions #603–#606. **Plan 148 — OHKO / K.O. en un coup (famille close) — 2026-07-04** : première mécanique de KO instantané. Flags `MoveDefinition` `isOhko`/`ohkoIceAccuracyRule`/`ohkoIceImmunity` ; module pur `battle/ohko.ts` (`ohkoAccuracy` = 30 % plat, 20 % Glaciation si lanceur non-Glace — formule canon niveau-collapsée car tous niveau 50 ; `ohkoImmunityReason` = type/Glace/Fermeté) ; `consumeLockedOn` extrait de `accuracy-check.ts`. Branche moteur dédiée dans `BattleEngine` (immunités pré-checkées AVANT le jet → « sans effet »/Fermeté, jamais « raté » ; jet plat ignorant crans/talents/objets/Gravité ; Verrouillage garantit et consomme une fois). Dégâts routés via `handle-damage` (dégâts fixes = PV max) → **Protection / Ténacité / Baie Ceinture / Clone / immunité de type gratuits** ; Fermeté = immunité totale (bypass Brise Moule). Event `OneHitKo` (« C'est un K.O. direct ! »). Multi-cible = jet 30 % indépendant par cible. IA : garde-fou `scoreOhko` (précision × valeur de KO, favorise cibles à PV élevés, malus dur sur cible immunisée) + méthode `BattleEngine.ohkoImmunityAgainst`. Tag tooltip ☠. 4 moves : **Abîme** (`fissure`, Sol, Ligne 3), **Guillotine** (`guillotine`, Normal, contact, Single 1-1), **Empal'Korne** (`horn-drill`, Normal, contact, Ligne 2), **Glaciation** (`sheer-cold`, Glace, Cône 1-2, cible Glace immunisée). +3 OP sets (Scarabrute Brise Moule/Guillotine — contourne Fermeté nativement, Lokhlass Glaciation — 30 % plein type Glace, Rhinoféros Empal'Korne — anti-Vol/Lévitation). **460 → 464 moves. 186 → 189 OP sets.** Décisions #607–#610. **Plan 149 — Lock-in multi-turn (famille close) — 2026-07-04** : verrou multi-tour forcé — adaptation grille + CT (déplacement libre pendant le verrou, seul le CHOIX du move est forcé, comme Provoc/Encore ; le joueur choisit sa cible librement chaque tour, l'IA cible l'ennemi le plus proche). Infra core : `PokemonInstance.lockInMoveId?`/`lockInTurnsRemaining?` (champ dédié, distinct de `lockedMoveId` déjà utilisé par la charge 2-tours et le verrou Choix, évite toute collision) ; `MoveDefinition.lockIn? { minTurns, maxTurns, confuseOnEnd }` + `uproarAura?` ; module `battle/lock-in.ts` (`beginOrContinueLockIn` appelé après la résolution complète du move — un whiff consomme quand même un tour de verrou, canon ; tirage `[minTurns, maxTurns]`, décrément post-résolution, Confusion self à l'expiration si `confuseOnEnd`) ; module `battle/uproar-aura.ts` (`isUnderNoSleepAura` r3 Manhattan autour du lanceur, sans gate grounded car sonore ; `wakeSleepersInUproarRadius` au 1er cast) ; filtre dans `getLegalActions` + garde `submitAction` (même pattern que `lockedMoveId`) ; cleanup KO ; blocage sommeil dans `handle-status.ts` (`ProtectionReason.UproarNoise`) ; event `BattleEventType.LockInStarted`. 5 moves nouveaux + 1 redesign : **Mania** (`thrash`, Normal Phys 120, Single 1-1, verrou 2-3t → Confusion), **Danse Fleurs** (`petal-dance`, Plante Spé 120, Single 1-2, verrou 2-3t → Confusion), **Colère** (`outrage`, Dragon Phys 120, Single 1-1, **REDESIGN, déjà existant** — l'ancien stopgap appliquait la Confusion self immédiate à chaque cast ; désormais vrai verrou 2-3t → Confusion, ne compte pas dans le total de nouveaux moves), **Grand Courroux** (`raging-fury`, Feu Phys 120, Single 1-1, verrou 2-3t → Confusion), **Brouhaha** (`uproar`, Normal Spé 90, Single 1-3 sonore, verrou 3t SANS confusion + aura mobile anti-sommeil r3 autour du lanceur), **Ball'Glace** (`ice-ball`, Glace Phys 30, Dash 2, clone Glace de Roulade — snowball volontaire `DynamicPowerKind.RolloutStreak`, PAS un verrou canon dans ce projet). Confusion « soft » du système conservée (pas de dégâts self, cf. game-design §7m) → downside = perte de tempo, choix assumé pour cette famille. Équilibrage validé sans changement (coût CT 900/cast ×2-3 = mise très chère qui gate déjà la famille). **464 → 469 moves.** Décisions #611–#616. |
| Talents | 104 | 114 | Talents portés par au moins un des 151 Gen 1. +11 plan 136 : Téméraire/Rivalité/Lentiteintée/Régé-Force/Sniper/Colérique/Acharné/Battant/Inconscient/Querelleur/Multi-Coups. +14 plan 137 : Cœur de Coq/Lumiattirance/Vaccin/Baigne Sable/Rideau Neige/Phobique/Mue/Hydratation/Cuvette/Corps Gel/Écaille Spéciale/Cœur Noble/Sécheresse/Impassible. +17 plan 138 — A-pinch (×1.5 type ≤1/3 PV) : Engrais/Brasier/Torrent/Essaim. B-météo (thread `weather` dans `DamageModifyContext`+`StatusBlockContext`, hook `onMoveImmunity`) : Force Soleil/Force Sable/Peau Sèche/Feuille Garde/Envelocape. C-réactif (champ `statusSpeedBoost`, hooks `onAccuracyModify`+`onEvasionModify` ability) : Armurouillée/Pieds Confus/Pied Véloce/Anti-Bruit/Télécharge/Peau Miracle. D-medium (hook `onDrainAttempt`, booléen `targetAlreadyActed` dans `DamageModifyContext`, bypass `infiltratorBypass`) : Agitation/Analyste/Puanteur/Suintement/Boom Final/Infiltration. 7 changements moteur livraison — voir abilities-system.md. **78 → 95 talents.** +2 plan 139 — modèle effet secondaire : nouveau module `secondary-effect.ts` (`isSecondaryEffect` + `moveHasSecondaryEffect` extraits de `effect-processor.ts`) partagé par Écran Poudre. **Sans Limite** (`sheer-force`) : supprime les effets secondaires du move + ×1.3 puissance (`onDamageModify`) — porteurs Gen 1 : Nidoking, Nidoqueen, Krabby, Krabboss, Tauros. **Sérénité** (`serene-grace`) : double la chance des effets secondaires (plafond 100 %) — porteur Gen 1 : Leveinard. Sérénité ne touche pas `onFlinchChance` (Roche Royale / Croc Rasoir — canonique). Décisions #550–#552. **95 → 97 talents.** +1 plan 140 — **Brise Moule** (`mold-breaker`) : suppression relationnelle des talents `breakable` de la cible pendant l'attaque. Nouveau module `packages/core/src/battle/ability-suppression.ts` (`resolveDefensiveAbility`). Flag `breakable` injecté dans `AbilityDefinition` depuis `abilities.json` (80 talents). 8 sites défensifs migrés. Porteur Gen 1 : Scarabrute (`pinsir`, slot 1 légal). Silencieux (pas d'`AbilityActivated`). Gaz Inhibiteur (`neutralizing-gas`) reporté (aucun porteur Gen-1 légal). Décisions #553–#556. **97 → 98 talents.** +5 plan 141 — **soutien/objet Gen 1** : **Gloutonnerie** (`gluttony`, seuil baies pincement 25%→50% PV — Chétiflor/Boustiflor/Empiflor/Ronflex hidden) ; **Tension** (`unnerve`, bloque consommation baies ennemies tant que porteur est en vie — Abo/Arbok/Miaouss/Persian/Ptéra/Mewtwo hidden) ; **Moiteur** (`damp`, bloque Destruction/Explosion + recul Boom Final depuis n'importe où — Psykokwak/Akwakwak ability1, lignée Ptitard ability2, Paras/Parasect/Hypotrempe/Hypocéan hidden) ; **Cœur Soin** (`healer`, 30% fin de tour soigne statut majeur allié r2 Manhattan, roll indépendant par allié — Leveinard hidden) ; **Garde-Ami** (`friend-guard`, alliés r2 reçoivent ×0.75 dégâts, cumulable Reflet/Mur Lumière, non cassable par Brise Moule car côté allié — Mélofée/Rondoudou hidden). Décisions #557–#561. **98 → 103 talents.** +1 plan 142 — **Glu** (`sticky-hold`) : bloque tout retrait/vol/échange d'objet du porteur (Sabotage retrait, Larcin/Implore vol, Tour de Magie/Passe-Passe échange, Gaz Corrosif, Calcination, Dégommage) — émet `AbilityActivated` + event `ItemTransferBlocked` au blocage. Porteurs Gen 1 : Tadmorv/Grotadmorv ability2, Otaria/Lamantine hidden. Décision #577. **103 → 104 talents.** |
| Objets tenus | 106 | ~159 heldItems | 173 heldItems − ~14 items Pokemon-spécifiques Gen 2-9 (orbes légendaires, drives Genesect, nectars Oricorio…). Méga-pierres (49) → Phase 9. +18 objets boost de type (×1.2, 1 par type). +29 baies (plan 135) : 18 anti-type (÷2 super-efficace, consommées, factory `typeResistBerry`), 4 pincement stat (+1 stage ≤25% PV, factory `pinchStatBerry`), 7 soin statut (fin de tour, factory `cureBerry`). Différés : Baie Lansat (crit) + Baie Frista (stat aléatoire) — flag « consommée » non encore disponible. Adaptation CT : baies soin statut agissent en fin de tour (pas à l'infliction, pas de hook `onStatusApplied`). +4 objets simples (plan 136) : Orbe Toxique (factory `selfStatusOrb`, Orbe Flamme migré), Bandeau Muscle (×1.1 Phys), Lunettes Sages (×1.1 Spé), Grelot Coque (soin 1/8 dégâts infligés). Différés : Veste de Combat (besoin verrou moves statut), Grosse Racine (hook modif soin absent), Gant de Boxe/Métronome (flags/compteurs). +4 objets « réaction au coup reçu » (75 → 79) : hook `onAfterDamageReceived`, factory `typeReactionItem` — déclenché quand le porteur est touché par un move du type déclencheur → +1 stage de la stat indiquée, objet consommé. **Bulbe** (`absorb-bulb`, Eau → AtqSpé +1), **Pile** (`cell-battery`, Électrik → Atk +1), **Boule de Neige** (`snowball`, Glace → Atk +1), **Lichen Lumineux** (`luminous-moss`, Eau → DéfSpé +1). Tests : `type-reaction-items.test.ts` + 1 scénario e2e. +3 roches de durée météo (79 → 82) : famille météo durée complète (4 roches). Mapping `WEATHER_EXTENDER_ITEM` dans `handle-set-weather.ts` — miroir Roche Chaude. **Roche Humide** (`damp-rock`, Pluie 5 → 8 tours), **Roche Lisse** (`smooth-rock`, Tempête de Sable 5 → 8 tours), **Roche Glace** (`icy-rock`, Neige 5 → 8 tours). Handlers data vides (pattern Roche Chaude). 3 tests engine ajoutés. +4 granules terrain (82 → 86) : factory `terrainSeedItem`, hook `onEndTurn` + `getFieldTerrainAt` réutilisés (zéro mécanique core nouvelle) — déclenché en fin de tour si le porteur se trouve sur le champ correspondant → +1 stage de la stat indiquée, objet consommé. **Graine Électrik** (`electric-seed`, Champ Électrifié → Déf +1), **Graine Herbe** (`grassy-seed`, Champ Herbu → Déf +1), **Graine Psychique** (`psychic-seed`, Champ Psychique → DéfSpé +1), **Graine Brume** (`misty-seed`, Champ Brumeux → DéfSpé +1). Adaptation CT : déclenchement en fin de tour (pas à l'instant d'entrée dans le champ — hook `onEnterTerrain` absent). Tests : `terrain-seed-items.test.ts` + 1 scénario e2e. +2 objets précision (86 → 88) : hook `onAccuracyModify`, factory `accuracyBoostItem`. **Loupe** (`wide-lens`, +10% précision toutes attaques), **Lentille Zoom** (`zoom-lens`, +20% précision si le porteur agit après la cible). +2 objets évasion (88 → 90) : hook `onEvasionModify`, miroir de `onAccuracyModify` câblé côté défenseur dans `checkAccuracy`. **Poudre Claire** (`bright-powder`, ×0.9 précision attaques entrantes), **Encens Doux** (`lax-incense`, ×0.9 précision attaques entrantes — fonctionnellement identique, différence flavor). Multiplicateur appliqué au numérateur de `effectiveAccuracy`, cumulable avec stages d'évasion/terrain/talents. Décision #545. +2 objets flinch (90 → 92) : nouveau hook `onFlinchChance(context) => number` sur `HeldItemHandler` (réutilise `ItemAccuracyContext`, `self` = attaquant/porteur, `target` = défenseur). Appliqué dans `effect-processor.ts` en bloc post-boucle : roll par cible survivante, push volatile Flinch + event `StatusApplied`. Factory `flinchItem(id, 10)`. Garde anti-cumul : skippé si le move inflige déjà flinch par lui-même. **Roche Royale** (`kings-rock`, +10% flinch sur tout move offensif sans flinch propre), **Croc Rasoir** (`razor-fang`, +10% flinch — fonctionnellement identique, différence flavor). Bonus : journalisation FR/EN du statut Flinch dans `BattleLogFormatter` (« \<X\> est apeuré ! »). Fidélité Showdown Gen IV+ (10%, pas d'empilement). Décision #546. +3 objets complexes (92 → 95) : **Veste de Combat** (`assault-vest`, Déf. Spé ×1.5 via `onStatModify` + flag `forbidsStatusMoves` filtré dans `getLegalActions` et garde `submitAction` façon Possessif), **Grosse Racine** (`big-root`, +30% HP soignés par les moves drain via nouveau hook `onDrainHealModify` — multiplicateur appliqué dans `handle-drain` hors backlash/heal-block), **Herbe Mental** (`mental-herb`, soigne un volatile restrictif (Provoc/Encore/Entrave/Attraction/Anti-Soin) dès qu'il est infligé au porteur — flag `curesMoveRestriction` + helper `tryMentalHerbCure` appelé après push dans `handle-status`/encore/disable, usage unique consommé). Fidélité Showdown. Décision #549. +4 objets complexes (95 → 99) : **Ballon** (`air-balloon`, immunité moves Sol + traitement aéroporté `isEffectivelyFlying` — immunité terrain Électrik/Herbu/Psy/Brume, hazards au sol Picots/Pics Toxik/Toile, knockback, DoT herbes/magma ; éclate au premier coup infligeant des dégâts, porteur redevient au sol ; Ingrain/Roost annulent l'effet aéroporté), **Lunettes Filtre** (`safety-goggles`, immunité moves Poudre comme Envelocape + immunité dégâts météo Tempête de Sable), **Pare-Effet** (`protective-pads`, moves de contact du porteur ignorent les effets de contact subis par la cible — Casque Brut, Statik, Peau Dure, Boom Final, etc. ; n'affecte pas les effets de contact offensifs du porteur), **Talisman Sain** (`clear-amulet`, bloque toute baisse de stat infligée par l'adversaire, pas les baisses auto-infligées). Nouveaux hooks `HeldItemHandler` : `onMoveImmunity`, `onTypeImmunity`, `onStatChangeBlocked` (miroir des équivalents talent) ; flags `immuneToWeatherDamage`, `protectsFromContactEffects` ; champ `contactNullified` sur `AfterDamageContext` ; nouveau `ProtectionReason.HeldItem` ; unification Ballon dans `isEffectivelyFlying`. Décision #550. +2 objets liés aux flags de move (99 → 101) : **Gant de Boxe** (`punching-glove`, moves de type Poing du porteur → dégâts ×1.1 via `onDamageModify` + perte du contact pour ces moves via prédicat `nullifiesContactForMove(move)` sur `HeldItemHandler`, intégré au calcul `contactNullified` de `handle-damage.ts` — les réactions de contact subies par la cible sont mutées, les effets offensifs propres du porteur non affectés ; fidélité Showdown Gen IX), **Spray Gorge** (`throat-spray`, après usage d'un move de type Son par le porteur — dégât ou statut — → +1 AtqSpé et objet consommé, via nouveau hook `onAfterMoveUse(context)` sur `HeldItemHandler` / interface `ItemAfterMoveUseContext`, invoqué une fois par usage dans `effect-processor.ts` bloc post-move hors gate dégâts ; fidélité Showdown Gen VIII). Aucun nouvel event ni `ProtectionReason` (réutilise `HeldItemActivated`/`StatChanged`/`HeldItemConsumed`). Tests : `punching-glove.test.ts` + `throat-spray.test.ts` (7 unit), e2e §5.18. Décision #551. +1 objet à compteur (101 → 102) : **Métronome (objet)** (`metronome`, +10% dégâts par usage consécutif du même move, cap +100% au 10e usage soit ×2.0 ; compteur `metronomeStreak` 0..10, reset si le move change ou si l'usage précédent a échoué ; aligné `reference/items.json` Champions). Décision #563. **Plan 142 — Item interaction (104 → 106)** : **+2 baies** débloquées par l'infra `consumedItemId`/`ateBerryThisBattle`/`critStageBoost` — **Baie Lansat** (`lansat-berry`, pincement ≤25% PV → `critStageBoost += 2` via pattern `pinchStatBerry` ; recyclable ; `isBerry: true`) ; **Baie Frista** (`starf-berry`, pincement ≤25% PV → +2 sur une stat aléatoire via graine déterministe ; recyclable ; `isBerry: true`). Hook `onEaten` ajouté aux baies à effet inconditionnel (Picore/Piqûre/Dégommage). Décisions #566–#577. |

---

## Pokemon (Gen 1 — 151)

> **PMDCollab** (source : SpriteCollab tracker.json, vérifié mai 2026) :
> Animations requises : Idle, Walk, Attack, Shoot, Charge, Hop, Hurt, Faint, Sleep.
> Pour les Pokemon de **type Vol** seulement : FlapAround requis pour synthétiser `FlyingIdle` (animation de vol au sol/eau).
> Fallbacks : Faint → freeze Idle · Shoot → Attack (Clefairy/Clefable) · FlyingIdle absent (type Vol) → Walk.
> `✓` = ok · `⚠️ Faint abs.` = Faint manquant (freeze Idle au KO) · `⚠️ Shoot+Faint abs.` = 7/9 ok · `⚠️ Vol : FlyingIdle abs.` = type Vol sans FlapAround (Walk en fallback vol)
>
> **Anims Babylon extraites (Jalon 3d, 2026-06-09)** : `Hover`, `Special0`, `Special10` ajoutées à `scripts/sprite-config.json` → `pnpm extract-sprites` (~ 208 fichiers atlas/offsets régénérés). Glide volants : chaîne `FLYING_GLIDE_CANDIDATES = [FlyingIdle, Hover, Special0, Special10]`, fallback Walk. Pokemon type Vol bénéficiant de la chaîne glide étendue : golbat/ptéra/rapasdepic/sulfura (Hover) ; dracolosse (Special0).
>
> **États sprite Babylon** (Jalon 3d) : pulse actif (`setActive`), flash dégâts (`flashDamage`), teinte KO + freeze (`setKnockedOut`), semi-invulnérable vol/creuse (`setSemiInvulnerable`). Items différés (pass 3D-depth) : wobble confusion, enveloppe profondeur attaque, overlay Substitut.
>
> **Décorations Babylon** (Jalon 3e, 2026-06-09) : `babylon-decorations.ts` — billboards `BILLBOARDMODE_Y` pour rochers (`rock_1`, `rock_2x2`) et arbres (`tree`) depuis Tiled `decorations` object-layer ; tall-grass auto sur tuiles `TallGrass` libres. Picking transparent (planes non-pickables). ALPHATEST pour obstacles (occluent sprites) + ALPHABLEND pour herbe (disableDepthWrite, alphaIndex). Décision #482.

**PMDCollab résumé** : 151/151 utilisables avec fallbacks. Faint absent sur 124. Pour les 19 Pokemon de type Vol : FlyingIdle synthétisable uniquement si FlapAround présent — absent sur 14 d'entre eux (Hover/Special0 utilisés quand disponibles via `FLYING_GLIDE_CANDIDATES`, sinon Walk en dernier recours).

**Plan 135 (2026-06-20)** : +70 pré-évolutions ajoutées — roster passe à **150 Pokemon jouables**. Movepool dérivé auto (learnset ∩ moves implémentés). Gag canon accepté (Magicarpe, Chenipan, Aspicot à 3 moves). Pas d'OP set pour les pré-évos. La colonne `✓` ci-dessous indique uniquement les formes finales/stars qui ont un talent implémenté ; les pré-évos ajoutées en plan 135 sont marquées `✗` (movepool dérivé, pas de talent spécifique).

| N° | ID | Nom FR | Types | ✓ | Talent | PMDCollab | Commentaire |
|---|---|---|---|---|---|---|---|
| 001 | bulbasaur | Bulbizarre | Plante/Poison | ✓ | overgrow | ✓ | |
| 002 | ivysaur | Herbizarre | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 003 | venusaur | Florizarre | Plante/Poison | ✓ | overgrow | ⚠️ Faint abs. | Méga disponible |
| 004 | charmander | Salamèche | Feu | ✓ | blaze | ✓ | |
| 005 | charmeleon | Reptincel | Feu | ✗ | | ✓ | |
| 006 | charizard | Dracaufeu | Feu/Vol | ✓ | blaze | ✓ mais FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 007 | squirtle | Carapuce | Eau | ✓ | torrent | ✓ | |
| 008 | wartortle | Carabaffe | Eau | ✗ | | ⚠️ Faint abs. | |
| 009 | blastoise | Tortank | Eau | ✓ | torrent | ⚠️ Faint abs. | Méga disponible |
| 010 | caterpie | Chenipan | Insecte | ✗ | | ⚠️ Faint abs. | |
| 011 | metapod | Chrysacier | Insecte | ✗ | | ⚠️ Faint abs. | |
| 012 | butterfree | Papilusion | Insecte/Vol | ✓ | shield-dust | ⚠️ Faint abs. (FlyingIdle ✓) | |
| 013 | weedle | Aspicot | Insecte/Poison | ✗ | | ⚠️ Faint abs. | |
| 014 | kakuna | Coconfort | Insecte/Poison | ✗ | | ⚠️ Faint abs. | |
| 015 | beedrill | Dardargnan | Insecte/Poison | ✓ | swarm | ⚠️ Faint abs. | Méga disponible |
| 016 | pidgey | Roucool | Normal/Vol | ✓ | keen-eye | ✓✓ complet | |
| 017 | pidgeotto | Roucoups | Normal/Vol | ✗ | | ⚠️ Faint abs. (FlyingIdle ✓) | |
| 018 | pidgeot | Roucarnage | Normal/Vol | ✓ | keen-eye | ⚠️ Faint abs. (FlyingIdle ✓) | Méga disponible |
| 019 | rattata | Rattata | Normal | ✗ | | ⚠️ Faint abs. | |
| 020 | raticate | Rattatac | Normal | ✓ | — | ⚠️ Faint abs. | inner-focus stub |
| 021 | spearow | Piafabec | Normal/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 022 | fearow | Rapasdepic | Normal/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Hover ✓ glide) | inner-focus stub |
| 023 | ekans | Abo | Poison | ✗ | | ⚠️ Faint abs. | |
| 024 | arbok | Arbok | Poison | ✓ | intimidate | ⚠️ Faint abs. | |
| 025 | pikachu | Pikachu | Électrique | ✓ | static | ✓ | |
| 026 | raichu | Raichu | Électrique | ✓ | lightning-rod | ✓ | Méga disponible |
| 027 | sandshrew | Sabelette | Sol | ✓ | sand-veil | ✓ | |
| 028 | sandslash | Sablaireau | Sol | ✓ | sand-veil | ✓ | |
| 029 | nidoran-f | Nidoran♀ | Poison | ✗ | | ⚠️ Faint abs. | |
| 030 | nidorina | Nidorina | Poison | ✗ | | ⚠️ Faint abs. | |
| 031 | nidoqueen | Nidoqueen | Poison/Sol | ✓ | poison-point | ⚠️ Faint abs. | |
| 032 | nidoran-m | Nidoran♂ | Poison | ✓ | poison-point | ⚠️ Faint abs. | |
| 033 | nidorino | Nidorino | Poison | ✗ | | ⚠️ Faint abs. | |
| 034 | nidoking | Nidoking | Poison/Sol | ✓ | poison-point | ⚠️ Faint abs. | |
| 035 | clefairy | Mélofée | Fée | ✗ | | ⚠️ Shoot+Faint abs. | |
| 036 | clefable | Mélodelfe | Fée | ✓ | magic-guard | ⚠️ Shoot+Faint abs. | Méga disponible |
| 037 | vulpix | Goupix | Feu | ✗ | | ✓ | |
| 038 | ninetales | Feunard | Feu | ✓ | flash-fire | ✓ | |
| 039 | jigglypuff | Rondoudou | Normal/Fée | ✓ | cute-charm | ✓ | |
| 040 | wigglytuff | Grodoudou | Normal/Fée | ✓ | cute-charm | ⚠️ Faint abs. | |
| 041 | zubat | Nosferapti | Poison/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 042 | golbat | Nosferalto | Poison/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Hover ✓ glide) | inner-focus stub |
| 043 | oddish | Mystherbe | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 044 | gloom | Ortide | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 045 | vileplume | Rafflesia | Plante/Poison | ✓ | effect-spore | ⚠️ Faint abs. | |
| 046 | paras | Paras | Insecte/Plante | ✗ | | ⚠️ Faint abs. | |
| 047 | parasect | Parasect | Insecte/Plante | ✓ | effect-spore | ⚠️ Faint abs. | |
| 048 | venonat | Mimitoss | Insecte/Poison | ✗ | | ✓ | |
| 049 | venomoth | Aéromite | Insecte/Poison | ✓ | compound-eyes | ⚠️ Faint abs. | |
| 050 | diglett | Taupiqueur | Sol | ✗ | | ⚠️ Faint abs. | |
| 051 | dugtrio | Triopikeur | Sol | ✓ | sand-veil | ⚠️ Faint abs. | |
| 052 | meowth | Miaouss | Normal | ✓ | technician | ✓ | |
| 053 | persian | Persian | Normal | ✓ | technician | ⚠️ Faint abs. | |
| 054 | psyduck | Psykokwak | Eau | ✗ | | ⚠️ Faint abs. | |
| 055 | golduck | Akwakwak | Eau | ✓ | cloud-nine | ⚠️ Faint abs. | |
| 056 | mankey | Férosinge | Combat | ✗ | | ⚠️ Faint abs. | |
| 057 | primeape | Colossinge | Combat | ✓ | vital-spirit | ⚠️ Faint abs. | |
| 058 | growlithe | Caninos | Feu | ✓ | intimidate | ⚠️ Faint abs. | |
| 059 | arcanine | Arcanin | Feu | ✓ | intimidate | ⚠️ Faint abs. | |
| 060 | poliwag | Ptitard | Eau | ✗ | | ⚠️ Faint abs. | |
| 061 | poliwhirl | Têtarte | Eau | ✗ | | ⚠️ Faint abs. | |
| 062 | poliwrath | Tartard | Eau/Combat | ✓ | water-absorb | ⚠️ Faint abs. | |
| 063 | abra | Abra | Psy | ✓ | synchronize | ✓ | |
| 064 | kadabra | Kadabra | Psy | ✗ | | ⚠️ Faint abs. | |
| 065 | alakazam | Alakazam | Psy | ✓ | magic-guard | ⚠️ Faint abs. | Méga disponible |
| 066 | machop | Machoc | Combat | ✓ | guts | ✓ | |
| 067 | machoke | Machopeur | Combat | ✗ | | ⚠️ Faint abs. | |
| 068 | machamp | Mackogneur | Combat | ✓ | no-guard | ⚠️ Faint abs. | |
| 069 | bellsprout | Chétiflor | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 070 | weepinbell | Boustiflor | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 071 | victreebel | Empiflor | Plante/Poison | ✓ | chlorophyll | ⚠️ Faint abs. | Méga disponible. chlorophyll stub Phase 9 (météo). |
| 072 | tentacool | Tentacool | Eau/Poison | ✓ | clear-body | ⚠️ Faint abs. | |
| 073 | tentacruel | Tentacruel | Eau/Poison | ✓ | clear-body | ⚠️ Faint abs. | |
| 074 | geodude | Racaillou | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 075 | graveler | Gravalanch | Roche/Sol | ✗ | | ⚠️ Faint abs. | |
| 076 | golem | Grolem | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 077 | ponyta | Ponyta | Feu | ✗ | | ✓ | |
| 078 | rapidash | Galopa | Feu | ✓ | flash-fire | ⚠️ Faint abs. | |
| 079 | slowpoke | Ramoloss | Eau/Psy | ✗ | | ⚠️ Faint abs. | |
| 080 | slowbro | Flagadoss | Eau/Psy | ✓ | own-tempo | ⚠️ Faint abs. | Méga disponible |
| 081 | magnemite | Magnéti | Électrique/Acier | ✓ | magnet-pull | ⚠️ Faint abs. | |
| 082 | magneton | Magnéton | Électrique/Acier | ✓ | magnet-pull | ⚠️ Faint abs. | |
| 083 | farfetch-d | Canarticho | Normal/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | inner-focus stub |
| 084 | doduo | Doduo | Normal/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 085 | dodrio | Dodrio | Normal/Vol | ✓ | early-bird | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 086 | seel | Otaria | Eau | ✓ | thick-fat | ⚠️ Faint abs. | |
| 087 | dewgong | Lamantine | Eau/Glace | ✓ | thick-fat | ⚠️ Faint abs. | |
| 088 | grimer | Tadmorv | Poison | ✗ | | ⚠️ Faint abs. | |
| 089 | muk | Grotadmorv | Poison | ✓ | poison-touch | ⚠️ Faint abs. | |
| 090 | shellder | Kokiyas | Eau | ✗ | | ⚠️ Faint abs. | |
| 091 | cloyster | Crustabri | Eau/Glace | ✓ | shell-armor | ⚠️ Faint abs. | |
| 092 | gastly | Fantominus | Spectre/Poison | ✓ | levitate | ⚠️ Faint abs. | |
| 093 | haunter | Spectrum | Spectre/Poison | ✗ | | ⚠️ Faint abs. | Retiré du roster post-Batch C (sprites conservés sur disque) |
| 094 | gengar | Ectoplasma | Spectre/Poison | ✓ | cursed-body | ✓ | Méga disponible |
| 095 | onix | Onix | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 096 | drowzee | Soporifik | Psy | ✗ | | ⚠️ Faint abs. | |
| 097 | hypno | Hypnomade | Psy | ✓ | insomnia | ⚠️ Faint abs. | |
| 098 | krabby | Krabby | Eau | ✗ | | ⚠️ Faint abs. | |
| 099 | kingler | Krabboss | Eau | ✓ | hyper-cutter | ⚠️ Faint abs. | |
| 100 | voltorb | Voltorbe | Électrique | ✗ | | ✓ | |
| 101 | electrode | Électrode | Électrique | ✓ | static | ⚠️ Faint abs. | |
| 102 | exeggcute | Noeunoeuf | Plante/Psy | ✗ | | ⚠️ Faint abs. | |
| 103 | exeggutor | Noadkoko | Plante/Psy | ✓ | — | ⚠️ Faint abs. | chlorophyll reporté Phase 9 (météo) |
| 104 | cubone | Osselait | Sol | ✗ | | ✓ | |
| 105 | marowak | Ossatueur | Sol | ✓ | rock-head | ⚠️ Faint abs. | |
| 106 | hitmonlee | Kicklee | Combat | ✓ | limber | ⚠️ Faint abs. | |
| 107 | hitmonchan | Tygnon | Combat | ✓ | iron-fist | ⚠️ Faint abs. | |
| 108 | lickitung | Excelangue | Normal | ✓ | own-tempo | ⚠️ Faint abs. | |
| 109 | koffing | Smogo | Poison | ✗ | | ⚠️ Faint abs. | |
| 110 | weezing | Smogogo | Poison | ✓ | levitate | ⚠️ Faint abs. | |
| 111 | rhyhorn | Rhinocorne | Sol/Roche | ✗ | | ⚠️ Faint abs. | |
| 112 | rhydon | Rhinoféros | Sol/Roche | ✓ | lightning-rod | ⚠️ Faint abs. | |
| 113 | chansey | Leveinard | Normal | ✓ | natural-cure | ⚠️ Faint abs. | |
| 114 | tangela | Saquedeneu | Plante | ✓ | chlorophyll | ⚠️ Faint abs. | chlorophyll stub Phase 9 (météo) |
| 115 | kangaskhan | Kangourex | Normal | ✓ | early-bird | ⚠️ Faint abs. | Méga disponible |
| 116 | horsea | Hypotrempe | Eau | ✗ | | ⚠️ Faint abs. | |
| 117 | seadra | Hypocéan | Eau | ✓ | swift-swim | ⚠️ Faint abs. | swift-swim stub Phase 9 (météo) |
| 118 | goldeen | Poissirène | Eau | ✗ | | ⚠️ Faint abs. | |
| 119 | seaking | Poissoroy | Eau | ✓ | water-veil | ⚠️ Faint abs. | |
| 120 | staryu | Stari | Eau | ✗ | | ⚠️ Faint abs. | |
| 121 | starmie | Staross | Eau/Psy | ✓ | natural-cure | ⚠️ Faint abs. | Méga disponible |
| 122 | mr-mime | M. Mime | Psy/Fée | ✓ | filter | ⚠️ Faint abs. | |
| 123 | scyther | Insécateur | Insecte/Vol | ✓ | technician | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 124 | jynx | Lippoutou | Glace/Psy | ✓ | oblivious | ⚠️ Faint abs. | |
| 125 | electabuzz | Élektek | Électrique | ✓ | static | ⚠️ Faint abs. | |
| 126 | magmar | Magmar | Feu | ✓ | flame-body | ⚠️ Faint abs. | |
| 127 | pinsir | Scarabrute | Insecte | ✓ | moxie | ⚠️ Faint abs. | Méga disponible |
| 128 | tauros | Tauros | Normal | ✓ | intimidate | ⚠️ Faint abs. | |
| 129 | magikarp | Magicarpe | Eau | ✗ | | ⚠️ Faint abs. | |
| 130 | gyarados | Léviator | Eau/Vol | ✓ | moxie | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 131 | lapras | Lokhlass | Eau/Glace | ✓ | water-absorb | ⚠️ Faint abs. | |
| 132 | ditto | Métamorph | Normal | ✗ | | ⚠️ Faint abs. | |
| 133 | eevee | Évoli | Normal | ✓ | adaptability | ✓ | |
| 134 | vaporeon | Aquali | Eau | ✓ | water-absorb | ⚠️ Faint abs. | |
| 135 | jolteon | Voltali | Électrique | ✓ | volt-absorb | ✓ | |
| 136 | flareon | Pyroli | Feu | ✓ | flash-fire | ✓ | |
| 137 | porygon | Porygon | Normal | ✓ | trace | ⚠️ Faint abs. | |
| 138 | omanyte | Amonita | Roche/Eau | ✗ | | ⚠️ Faint abs. | |
| 139 | omastar | Amonistar | Roche/Eau | ✓ | swift-swim | ⚠️ Faint abs. | |
| 140 | kabuto | Kabuto | Roche/Eau | ✗ | | ✓ | |
| 141 | kabutops | Kabutops | Roche/Eau | ✓ | battle-armor | ⚠️ Faint abs. | |
| 142 | aerodactyl | Ptéra | Roche/Vol | ✓ | rock-head | ⚠️ Faint abs. + FlyingIdle abs. (Hover ✓ glide) | Méga disponible |
| 143 | snorlax | Ronflex | Normal | ✓ | thick-fat | ⚠️ Faint abs. | |
| 144 | articuno | Artikodin | Glace/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Légendaire |
| 145 | zapdos | Électhor | Électrique/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Légendaire |
| 146 | moltres | Sulfura | Feu/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Hover ✓ glide) | Légendaire |
| 147 | dratini | Minidraco | Dragon | ✗ | | ⚠️ Faint abs. | |
| 148 | dragonair | Draco | Dragon | ✗ | | ⚠️ Faint abs. | |
| 149 | dragonite | Dracolosse | Dragon/Vol | ✓ | multiscale | ⚠️ Faint abs. + FlyingIdle abs. (Special0 ✓ glide) | Méga disponible |
| 150 | mewtwo | Mewtwo | Psy | ✓ | pressure | ✓ | Méga disponible, Légendaire |
| 151 | mew | Mew | Psy | ✓ | — | ✓ | Mythique. inner-focus stub. |

### Méga-Évolutions Gen 1

> Mégas en reference : 21 formes. Mégas "Champions" (raichu, clefable, victreebel, starmie, dragonite) = format Pokémon Champions uniquement, pas dans les jeux principaux.
> **Conclusion PMDCollab** : aucun Méga n'a de sprites complets. 6 ont des fichiers partiels (pending review). Ne pas planifier de Méga avant que la situation PMDCollab s'améliore.

| ID | Base | Types Méga | Officiel | PMDCollab | Commentaire |
|---|---|---|---|---|---|
| venusaur-mega | Florizarre | Plante/Poison | ✓ | ✗ aucun fichier | |
| charizard-mega-x | Dracaufeu | Feu/Dragon | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| charizard-mega-y | Dracaufeu | Feu/Vol | ✓ | ✗ aucun fichier | |
| blastoise-mega | Tortank | Eau | ✓ | ✗ aucun fichier | |
| beedrill-mega | Dardargnan | Insecte/Poison | ✓ | ✗ aucun fichier | |
| pidgeot-mega | Roucarnage | Normal/Vol | ✓ | ✗ aucun fichier | |
| raichu-mega-x | Raichu | Électrique | ✗ Champions | ✗ aucun fichier | Non-officiel |
| raichu-mega-y | Raichu | Électrique/Psy | ✗ Champions | ✗ aucun fichier | Non-officiel |
| clefable-mega | Mélodelfe | Fée | ✗ Champions | ✗ aucun fichier | Non-officiel |
| alakazam-mega | Alakazam | Psy | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| victreebel-mega | Empiflor | Plante/Poison | ✗ Champions | ✗ n'existe pas dans SpriteCollab | Non-officiel |
| slowbro-mega | Flagadoss | Eau/Psy | ✓ | ⚠️ 6/10 pending | Hurt+Faint+Sleep+FlapAround absents |
| gengar-mega | Ectoplasma | Spectre/Poison | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| kangaskhan-mega | Kangourex | Normal | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| starmie-mega | Staross | Eau/Psy | ✗ Champions | ✗ aucun fichier | Non-officiel |
| pinsir-mega | Scarabrute | Insecte/Vol | ✓ | ✗ aucun fichier | |
| gyarados-mega | Léviator | Eau/Ténèbres | ✓ | ✗ aucun fichier | |
| aerodactyl-mega | Ptéra | Roche/Vol | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| dragonite-mega | Dracolosse | Dragon/Vol | ✗ Champions | ✗ aucun fichier | Non-officiel |
| mewtwo-mega-x | Mewtwo | Psy/Combat | ✓ | ✗ aucun fichier | |
| mewtwo-mega-y | Mewtwo | Psy | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |

---

## Attaques (393 implémentées)


> Pattern = ciblage tactique dans le jeu (custom, pas le comportement original Pokemon).

| Nom FR | ID | Type | Cat | Puiss | Préc | PP | Pattern | Effets notables |
|---|---|---|---|---|---|---|---|---|
| Acide | acid | Poison | Spé | 40 | 100 | 30 | cône r2 | −1 Déf Spé cibles |
| Hâte | agility | Psy | Statut | — | — | 30 | self | +2 Vit |
| Onde Boréale | aurora-beam | Glace | Spé | 65 | 100 | 20 | ligne r3 | −1 Atk cibles |
| Morsure | bite | Ténèbres | Phys | 60 | 100 | 25 | mêlée | |
| Blizzard | blizzard | Glace | Spé | 110 | 70 | 5 | cône r3 | Gel 10% |
| Plaquage | body-slam | Normal | Phys | 85 | 100 | 15 | mêlée | Para 30% |
| Bulles d'O | bubble-beam | Eau | Spé | 65 | 100 | 20 | cône r2 | |
| Gonflette | bulk-up | Combat | Statut | — | — | 20 | self | +1 Atk, +1 Déf |
| Plénitude | calm-mind | Psy | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé |
| Choc Mental | confusion | Psy | Spé | 50 | 100 | 25 | single r4 | |
| Riposte | counter | Combat | Phys | — | 100 | 20 | self | Défensif : renvoie dégâts physiques ×2 |
| Boul'Armure | defense-curl | Normal | Statut | — | — | 40 | self | +1 Déf |
| Chant Canon | round | Normal | Spé | 60 | 100 | 15 | cône r3 | `dynamicPower` ×2 (120) si l'action d'équipe précédente était Chant Canon (`TeamPreviousMoveDouble`). Son. |
| Chargeur | charge | Électrique | Statut | — | — | 20 | self | +1 DéfSpé self + pose volatile `Charged` : prochain move Électrique ×2 puissance. |
| Détection | detect | Combat | Statut | — | — | 5 | self | Défensif : immunité dégâts 1 tour |
| Double Pied | double-kick | Combat | Phys | 30×2 | 100 | 30 | mêlée | 2 coups |
| Reflet | double-team | Normal | Statut | — | — | 15 | self | +1 Esquive |
| Draco-Souffle | dragon-breath | Dragon | Spé | 60 | 100 | 20 | cône r2 | Para 30% |
| Draco-Queue | dragon-tail | Dragon | Phys | 60 | 90 | 10 | slash | Knockback 1 |
| Séisme | earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | Friendly fire |
| Flammèche | ember | Feu | Spé | 40 | 100 | 25 | single r3 | Brûl 10% |
| Ténacité | endure | Normal | Statut | — | — | 10 | self | Défensif : survive à 1 PV min |
| Roue de Feu | flame-wheel | Feu | Phys | 60 | 100 | 25 | dash r3 | Brûl 10% |
| Lance-Flammes | flamethrower | Feu | Spé | 90 | 100 | 15 | ligne r3 | Brûl 10% |
| Flash | flash | Normal | Statut | — | 100 | 20 | zone r2 | −1 Préc cibles |
| Combo-Griffe | fury-swipes | Normal | Phys | 18 | 80 | 15 | mêlée | 2-5 coups |
| Rugissement | growl | Normal | Statut | — | 100 | 40 | cône r3 | −1 Atk cibles |
| Tornade | gust | Vol | Spé | 40 | 100 | 35 | cône r3 | |
| Coup d'Boule | headbutt | Normal | Phys | 70 | 100 | 15 | mêlée | |
| Ultralaser | hyper-beam | Normal | Spé | 150 | 90 | 5 | ligne r5 | Recharge 1 tour |
| Hypnose | hypnosis | Psy | Statut | — | 60 | 20 | single r3 | Sommeil 100% |
| Vent Glace | icy-wind | Glace | Spé | 55 | 95 | 15 | cône r2 | −1 Vit cibles |
| Mur de Fer | iron-defense | Acier | Statut | — | — | 15 | self | +2 Déf |
| Poing Karaté | karate-chop | Combat | Phys | 50 | 100 | 25 | mêlée | Critique élevé |
| Télékinésie | kinesis | Psy | Statut | — | 80 | 15 | single r3 | −1 Préc |
| Vampigraine | leech-seed | Plante | Statut | — | 90 | 10 | single r3 | Drain PV/tour tant que ≤5 tiles |
| Léchouille | lick | Spectre | Phys | 30 | 100 | 30 | mêlée | Para 30% |
| Ampleur | magnitude | Sol | Phys | var | 100 | 30 | zone r2 | Friendly fire, puissance variable |
| Ultimapoing | mega-punch | Normal | Phys | 80 | 85 | 20 | mêlée | |
| Lilliput | minimize | Normal | Statut | — | — | 10 | self | +2 Esquive |
| Ombre Nocturne | night-shade | Spectre | Spé | var | 100 | 15 | croix 3×3 | Dégâts = niveau |
| Dard-Venin | poison-sting | Poison | Phys | 15 | 100 | 35 | mêlée | Poison 30% |
| Écras'Face | pound | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Abri | protect | Normal | Statut | — | — | 5 | self | Défensif : immunité dégâts 1 tour |
| Rafale Psy | psybeam | Psy | Spé | 65 | 100 | 20 | ligne r5 | |
| Vive-Attaque | quick-attack | Normal | Phys | 40 | 100 | 30 | dash r2 | |
| Tranch'Herbe | razor-leaf | Plante | Phys | 55 | 95 | 25 | slash | Critique élevé |
| Hurlement | roar | Normal | Statut | — | — | 20 | cône r3 | **Phazing** (sonore) : éjecte les ennemis du cône vers leur zone de spawn |
| Cyclone | whirlwind | Normal | Statut | — | — | 20 | zone r1 | **Phazing** : éjecte les ennemis adjacents vers leur zone de spawn |
| Projection | circle-throw | Combat | Phys | 60 | 90 | 10 | single r1 contact | **Phazing** : dégâts puis éjecte la cible vers sa zone de spawn |
| Éclate-Roc | rock-smash | Combat | Phys | 40 | 100 | 15 | croix 3×3 | −1 Déf cibles |
| Jet-Pierres | rock-throw | Roche | Phys | 50 | 90 | 15 | single r3 | |
| Roulade | rollout | Roche | Phys | 30 (→480 snowball) | 90 | 20 | dash r2 (→r5 snowball) | **Snowball** : portée +1/cast consécutif (cap r5), puissance ×2/cast (cap 480). Reset si autre move. `DynamicPowerKind.RolloutStreak`. |
| Jet de Sable | sand-attack | Sol | Statut | — | 100 | 15 | cône r2 | −1 Préc |
| Griffe | scratch | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Frappe Atlas | seismic-toss | Combat | Phys | var | 100 | 20 | mêlée | Dégâts = niveau |
| Berceuse | sing | Normal | Statut | — | 55 | 15 | cône r3 | Sommeil 100% |
| Tranche | slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| Poudre Dodo | sleep-powder | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil 75% |
| Bombe Beurk | sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2-4/r1 | Poison 30% |
| Brouillard | smokescreen | Normal | Statut | — | 100 | 20 | zone r1 | −1 Préc cibles |
| Stockage | stockpile | Normal | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé |
| Ultrason | supersonic | Normal | Statut | — | 55 | 20 | single r3 | Confusion 100% |
| Danse Lames | swords-dance | Normal | Statut | — | — | 20 | self | +2 Atk |
| Charge | tackle | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Cage Éclair | thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Para 100% |
| Tonnerre | thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | Para 10% |
| Toxik | toxic | Poison | Statut | — | 90 | 10 | single r2 | Poison fort 100% |
| Électacle | volt-tackle | Électrique | Phys | 120 | 100 | 15 | dash r3 | |
| Pistolet à O | water-gun | Eau | Spé | 40 | 100 | 25 | single r3 | |
| Cru-Ailes | wing-attack | Vol | Phys | 60 | 100 | 35 | slash | |
| Repli | withdraw | Eau | Statut | — | — | 40 | self | +1 Déf, +1 DéfSpé |
| Ligotage | wrap | Normal | Phys | 15 | 90 | 20 | mêlée | Piégé + drain PV/tour |
| Armure Acide | acid-armor | Poison | Statut | — | — | 20 | self | +2 Déf |
| Tranche-Air | air-slash | Vol | Spé | 75 | 95 | 15 | slash | Flinch 30% |
| Amnésie | amnesia | Psy | Statut | — | — | 20 | self | +2 DéfSpé |
| Aqua-Queue | aqua-tail | Eau | Phys | 90 | 90 | 10 | mêlée | |
| Assurance | assurance | Ténèbres | Phys | 60 | 100 | 10 | single r1 | `dynamicPower` ×2 si cible a déjà subi des dégâts depuis sa dernière action. |
| Avalanche | avalanche | Glace | Phys | 60 | 100 | 10 | slash | `dynamicPower` ×2 si le lanceur a été touché par un ennemi depuis sa dernière action. |
| Casse-Brique | brick-break | Combat | Phys | 75 | 100 | 15 | mêlée | |
| Rayon Chargé | charge-beam | Électrique | Spé | 50 | 90 | 10 | ligne r3 | +1 AtqSpé 70% |
| Close Combat | close-combat | Combat | Phys | 120 | 100 | 5 | mêlée | −1 Déf, −1 DéfSpé attaquant |
| Mâchouille | crunch | Ténèbres | Phys | 80 | 100 | 15 | mêlée | −1 Déf 20% |
| Draco-Griffe | dragon-claw | Dragon | Phys | 80 | 100 | 15 | mêlée | |
| Danse Draco | dragon-dance | Dragon | Statut | — | — | 20 | self | +1 Atk, +1 Vit |
| Dynamopoing | dynamic-punch | Combat | Phys | 100 | 50 | 5 | mêlée | Confusion 100% (acc parfaite avec No-Guard) |
| Vitesse Extrême | extreme-speed | Normal | Phys | 80 | 100 | 5 | dash r2 | |
| Déflagration | fire-blast | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | Brûlure 10% |
| Tunnel de Flammes | flare-blitz | Feu | Phys | 120 | 100 | 15 | dash r3 | Brûlure 10%, recul 1/3 PV |
| Croissance | growth | Plante | Statut | — | — | 20 | self | +1 Atk, +1 AtqSpé |
| Hydrocanon | hydro-pump | Eau | Spé | 110 | 80 | 5 | ligne r4 | |
| Lance-Glace | ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | Gel 10% |
| Queue de Fer | iron-tail | Acier | Phys | 100 | 75 | 15 | mêlée | −1 Déf 30% |
| Éruption | lava-plume | Feu | Spé | 80 | 100 | 15 | zone r1 | Brûlure 30%, friendly fire |
| Colère | outrage | Dragon | Phys | 120 | 100 | 10 | mêlée | Confusion attaquant après (100%) |
| Tempête Florale | petal-blizzard | Plante | Phys | 90 | 100 | 15 | zone r2 | Friendly fire |
| Psyko | psychic | Psy | Spé | 90 | 100 | 10 | single r4 | −1 DéfSpé 10% |
| Soin | recover | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| Repos | rest | Psy | Statut | — | — | 5 | self | Soigne 100% PV max + Sommeil 2 tours |
| Ronflement | snore | Normal | Spé | 50 | 100 | 15 | cône r3 | Utilisable uniquement si le lanceur est endormi (`requiresAsleep`). Flinch 30%. Son. |
| Ball'Ombre | shadow-ball | Spectre | Spé | 80 | 100 | 15 | single r4 | −1 DéfSpé 20% |
| Surf | surf | Eau | Spé | 90 | 100 | 15 | zone r2 | Friendly fire |
| Synthèse | synthesis | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| Tonnerre Vrai | thunder | Électrique | Spé | 110 | 70 | 10 | single r4 | Para 30% |
| Cascade | waterfall | Eau | Phys | 80 | 100 | 15 | dash r3 | Flinch 20% |
| Coup Croix | cross-chop | Combat | Phys | 100 | 80 | 5 | single r1 | Critique élevé (`critRatio: 1`) |
| Éboulement | rock-slide | Roche | Phys | 75 | 90 | 10 | cône r1–2 | |
| Onde Folie | confuse-ray | Spectre | Statut | — | 100 | 10 | single r1–3 | Confusion 100% |
| Boule Énergie | energy-ball | Plante | Spé | 90 | 100 | 10 | single r1–4 | |
| Osmerang | bonemerang | Sol | Phys | 50 | 90 | 10 | single r1 | 2 hits fixes |
| Flammepied | blaze-kick | Feu | Phys | 85 | 90 | 10 | single r1 | Critique élevé, brûlure 10% |
| Poing Éclair | thunder-punch | Électrique | Phys | 75 | 100 | 15 | single r1 | Paralysie 10%. Flag `punch`. |
| Poing Glace | ice-punch | Glace | Phys | 75 | 100 | 15 | single r1 | Gel 10%. Flag `punch`. |
| Poing de Feu | fire-punch | Feu | Phys | 75 | 100 | 15 | single r1 | Brûlure 10%. Flag `punch`. |
| Damoclès | double-edge | Normal | Phys | 120 | 100 | 15 | single r1 | Recul 1/3 HP max |
| Dernier Recours | last-resort | Normal | Phys | 140 | 100 | 5 | single r1 | Échoue si tous les autres moves du lanceur n'ont pas encore été utilisés au moins une fois. |
| Feu Follet | will-o-wisp | Feu | Statut | — | 85 | 15 | single r1–3 | Brûlure 100% |
| Machination | nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé |
| Cradovague | sludge-wave | Poison | Spé | 95 | 100 | 10 | zone r2 | Friendly fire, Poison 10% |
| Luminocanon | flash-cannon | Acier | Spé | 80 | 100 | 10 | ligne r3 | −1 DéfSpé cible 10% |
| Coup d'Jus | discharge | Électrique | Spé | 80 | 100 | 15 | zone r2 | Para 30%, friendly fire |
| Grincement | screech | Normal | Statut | — | 85 | 40 | single r1–3 | −2 Déf cible |
| Stalactite | icicle-spear | Glace | Phys | 25 | 100 | 30 | single r1 | 2–5 hits |
| Grobisou | lovely-kiss | Normal | Statut | — | 75 | 10 | single r1–3 | Sommeil 100% |
| Pince-Masse | crabhammer | Eau | Phys | 100 | 95 | 10 | single r1 | STAB, critique élevé (`critRatio: 1`) |
| Destruction | self-destruct | Normal | Phys | 200 | 100 | 5 | zone r2 | Attaquant KO après usage |
| Triplattaque | tri-attack | Normal | Spé | 80 | 100 | 10 | single r1–4 | Para 20% (Phase 4) |
| Verrouillage | lock-on | Normal | Statut | — | — | 5 | single r1–4 | Prochain move garanti (accuracy override 1 tour) |
| Pouvoir Lunaire | moonblast | Fée | Spé | 95 | 100 | 15 | single r1–4 | −1 AtqSpé cible 30% |
| Pouvoir Antique | ancient-power | Roche | Spé | 60 | 100 | 5 | single r1–3 | +1 toutes stats attaquant 10% (indépendant) |
| Exuviation | shell-smash | Normal | Statut | — | — | 15 | self | +2 Atk/AtqSpé/Vit, −1 Déf/DéfSpé |
| Crocs Venin | poison-fang | Poison | Phys | 50 | 100 | 15 | mêlée | Poison fort 50% (BadlyPoisoned) |
| Enroulement | coil | Poison | Statut | — | — | 20 | self | +1 Atk, +1 Déf, +1 Préc |
| Regard Médusant | glare | Normal | Statut | — | 100 | 30 | single r1–3 | Para 100% |
| Force Cosmique | cosmic-power | Psy | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé |
| Spore | spore | Plante | Statut | — | 100 | 15 | single r1 | Sommeil 100% |
| Lame Feuille | leaf-blade | Plante | Phys | 90 | 100 | 15 | slash | Critique élevé (`critRatio: 1`) |
| Picpic | drill-peck | Vol | Phys | 80 | 100 | 20 | slash | — |
| Barrière | barrier | Psy | Statut | — | — | 20 | self | +2 Déf |
| Vampirisme | leech-life | Insecte | Phys | 80 | 100 | 10 | mêlée | Drain : soigne attaquant = 50% dégâts |
| Méga-Sangsue | mega-drain | Plante | Spé | 40 | 100 | 15 | single r1–3 | Drain : soigne attaquant = 50% dégâts |
| Double Dard | twineedle | Insecte | Phys | 25×2 | 100 | 20 | mêlée | 2 hits, Poison 20% par hit |
| Aéropique | aerial-ace | Vol | Phys | 60 | — | 20 | slash | Touche garantie (`bypassAccuracy`) |
| Danse Plumes | feather-dance | Vol | Statut | — | 100 | 15 | single r1–3 | −2 Atk cible |
| Croc de Mort | hyper-fang | Normal | Phys | 80 | 90 | 15 | mêlée | |
| Papillodanse | quiver-dance | Insecte | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé, +1 Vit |
| Atterrissage | roost | Vol | Statut | — | — | 5 | self | Soigne 50% PV max |
| Giga-Sangsue | giga-drain | Plante | Spé | 75 | 100 | 10 | single r1–3 | Drain : soigne attaquant = 50% dégâts |
| Balle Focus | focus-blast | Combat | Spé | 120 | 70 | 5 | single r1–4 | −1 DéfSpé cible 10% |
| Zénith | sunny-day | Feu | Statut | — | — | 5 | self | Active Soleil 5 tours (8 avec Pierre Soleil) |
| Danse-Pluie | rain-dance | Eau | Statut | — | — | 5 | self | Active Pluie 5 tours (8 avec Pierre Pluie) |
| Tempête de Sable | sandstorm | Roche | Statut | — | — | 10 | self | Active Sable 5 tours (8 avec Roc Chaleur) |
| Poudreneige | snowscape | Glace | Statut | — | — | 10 | self | Active Neige 5 tours |
| Protection | reflect | Psy | Statut | — | — | 20 | self | Aura mobile r3 caster, alliés inclus, ×0.5 Phys ennemi. Durée 5 (8 avec Lumargile). Crits ignorent. Cassée par Casse-Brique ×2 mêlée / ×1.5 protégé. |
| Mur Lumière | light-screen | Psy | Statut | — | — | 30 | self | Aura mobile r3 caster, alliés inclus, ×0.5 Spé ennemi. Durée 5 (8 avec Lumargile). Crits ignorent. Cassée par Casse-Brique. |
| Météore | weather-ball | Normal | Spé | 50 (100 sous météo) | 100 | 10 | single r1–4 | Type change selon météo active |
| Lance-Soleil | solar-beam | Plante | Spé | 120 (60 sous Pluie/Sable/Neige) | 100 | 10 | single r1–4 | Charge 1 tour (skip sous Soleil), float "Rayonne!" T1 |
| Demi-Tour | u-turn | Insecte | Phys | 70 | 100 | 20 | hit-and-run r1 / retreat r1–4 | Frappe puis recul TP joueur. Miss/Protect bloque retreat. |
| Change Éclair | volt-switch | Électrik | Spé | 70 | 100 | 20 | hit-and-run r1–2 (non-contact) / retreat r1–4 | Non-contact (parité Showdown). |
| Eau Revoir | flip-turn | Eau | Phys | 60 | 100 | 20 | hit-and-run r1 / retreat r1–4 | Frappe puis recul TP joueur. |
| Bélier | skull-bash | Normal | Phys | 130 | 100 | 10 | dash r3 | Charge 2 tours. T1 : `chargeEffects` +1 Déf, indicateur ⚡. T2 : dash + knockback. |
| Ciel Attaque | sky-attack | Vol | Spé | 140 | 90 | 5 | single r4 | Charge 2 tours. T1 : indicateur ⚡. T2 : Flinch 30%, critique élevé (`critRatio: 1`). |
| Rasoir Vent | razor-wind | Normal | Spé | 80 | 100 | 10 | cône r3 | Charge 2 tours. T1 : indicateur ⚡. T2 : critique élevé (`critRatio: 1`). |
| Brume | mist | Glace | Statut | — | — | 30 | self | Aura mobile r3 caster + alliés inclus. Bloque baisses de stats ennemies 5 tours. |
| Voile | safeguard | Normal | Statut | — | — | 25 | self | Aura mobile r3 caster + alliés inclus. Bloque statuts majeurs ennemis 5 tours. |
| Impostor | substitute | Normal | Statut | — | — | 10 | self | Crée un clone (sub) à `floor(maxHp/4)` PV. Absorbe dégâts/statuts/baisses-stats ennemis. Bypass : son, `bypasssub`, drain, recoil. |
| Provoc | taunt | Ténèbres | Statut | — | 100 | 20 | single r3 | Volatile `Taunted` 3 tours. Cible ne peut plus utiliser de moves Statut. Bloqué par Substitute (sans bypasssub). Safeguard et Mist ne bloquent pas. |
| Entrave | disable | Normal | Statut | — | 100 | 20 | single r3 | Volatile `Disabled` 4 tours. Bloque la **dernière move exécutée** par la cible (retirée de `getLegalActions`). Échoue si pas de `lastUsedMoveId`, PP 0, ou déjà disabled. Bloqué par Substitute. |
| Encore | encore | Normal | Statut | — | 100 | 5 | single r3 | Volatile `Encored` 3 tours. Force la cible à répéter sa **dernière move** (seule move jouable dans `getLegalActions`). Fin anticipée si PP de la move encored tombent à 0. Échoue si pas de `lastUsedMoveId`, PP 0, déjà encored, ou move = encore. Bloqué par Substitute. |
| Aqua-Jet | aqua-jet | Eau | Phys | 40 | 100 | 20 | dash r2 | Priorité (charge gap-close) |
| Ailes d'Acier | steel-wing | Vol | Phys | 70 | 90 | 25 | slash | +1 Déf attaquant 10% |
| Poing Météore | meteor-mash | Acier | Phys | 90 | 90 | 10 | single r1 | +1 Atk attaquant 20% |
| Pisto-Poing | bullet-punch | Acier | Phys | 40 | 100 | 30 | dash r2 | Priorité (charge gap-close) |
| Canon Graine | seed-bomb | Plante | Phys | 80 | 100 | 15 | single r1–3 | — |
| Cent Rancunes | lash-out | Ténèbres | Phys | 75 | 100 | 5 | single r1 | *(rider power conditionnel différé)* |
| Centrifugifle | brutal-swing | Normal | Phys | 60 | 100 | 20 | zone r1 | Friendly fire |
| Coupe | cut | Normal | Phys | 50 | 95 | 30 | slash | — |
| Crocs Éclair | thunder-fang | Électrique | Phys | 65 | 95 | 15 | single r1 | Paralysie 10% + Flinch 10% |
| Crocs Feu | fire-fang | Feu | Phys | 65 | 95 | 15 | single r1 | Brûlure 10% + Flinch 10% |
| Crocs Givre | ice-fang | Glace | Phys | 65 | 95 | 15 | single r1 | Gel 10% + Flinch 10% |
| Cryo-Pirouette | ice-spinner | Glace | Phys | 80 | 100 | 15 | single r1 | *(rider terrain différé)* |
| Dard Mortel | fell-stinger | Insecte | Phys | 50 | 100 | 25 | single r1 | *(rider KO-boost Atk +3 différé)* |
| Désherbaffe | trailblaze | Plante | Phys | 50 | 100 | 20 | dash r3 | +1 Vit attaquant (100%) |
| Esprit Frappeur | poltergeist | Spectre | Phys | 110 | 90 | 5 | single r1–3 | *(rider item-check différé)* |
| Estocorne | smart-strike | Acier | Phys | 70 | — | 10 | single r1–2 | Touche garantie (`bypassAccuracy`) |
| Exécu-Son | throat-chop | Ténèbres | Phys | 80 | 100 | 15 | single r1 | *(rider sound-lock différé)* |
| Fouet Lianes | vine-whip | Plante | Phys | 45 | 100 | 25 | single r1–2 | — |
| Griffe Acier | metal-claw | Acier | Phys | 50 | 95 | 35 | single r1 | +1 Atk attaquant 10% |
| Indignition | temper-flare | Feu | Phys | 75 | 100 | 10 | single r1 | *(rider power conditionnel différé)* |
| Jackpot | pay-day | Normal | Phys | 40 | 100 | 20 | single r1–3 | — |
| Koud'Korne | horn-attack | Normal | Phys | 65 | 100 | 25 | single r1 | — |
| Mach Punch | mach-punch | Combat | Phys | 40 | 100 | 30 | dash r2 | Priorité (charge gap-close) |
| Marto-Poing | hammer-arm | Combat | Phys | 100 | 90 | 10 | single r1 | −1 Vit attaquant (100%) |
| Cavalerie Lourde | high-horsepower | Sol | Phys | 95 | 95 | 10 | single r1 | — |
| Mégacorne | megahorn | Insecte | Phys | 120 | 85 | 10 | single r1–2 | — |
| Mégafouet | power-whip | Plante | Phys | 120 | 85 | 10 | single r1–2 | — |
| Métalliroue | steel-roller | Acier | Phys | 130 | 100 | 5 | dash r3 | *(rider terrain différé)* |
| Nitrocharge | flame-charge | Feu | Phys | 50 | 100 | 20 | dash r3 | +1 Vit attaquant (100%) |
| Picpic | peck | Vol | Phys | 35 | 100 | 35 | single r1–2 | — |
| Plaie Croix | x-scissor | Insecte | Phys | 80 | 100 | 15 | slash | — |
| Poing de Colère | rage-fist | Spectre | Phys | 50 | 100 | 10 | single r1 | `dynamicPower` +50 par fois que le lanceur a été touché par un move offensif depuis le début du combat (max 6 hits → 350). Flag `punch`. |
| Poing Ombre | shadow-punch | Spectre | Phys | 60 | — | 20 | single r1 | Touche garantie (`bypassAccuracy`) |
| Psycho-Croc | psychic-fangs | Psy | Phys | 85 | 100 | 10 | single r1 | *(rider screen-break différé)* |
| Champ Herbu | grassy-terrain | Plante | Statut | — | — | 10 | self (zone r3) | Pose Champ Herbu : soin 1/16 PV/tour au sol, ×1.3 Plante attaquant sur zone, ×0.5 Séisme/Piétisol/Ampleur sur cible sur zone. Durée 5 tours (8 avec Champ'Duit). |
| Champ Électrifié | electric-terrain | Élec | Statut | — | — | 10 | self (zone r3) | Pose Champ Électrifié : immunité Sommeil au sol, ×1.3 Électrique attaquant sur zone. Durée 5 tours (8 avec Champ'Duit). |
| Champ Brumeux | misty-terrain | Fée | Statut | — | — | 10 | self (zone r3) | Pose Champ Brumeux : immunité statuts majeurs + confusion au sol, ×0.5 Dragon sur cible sur zone. Durée 5 tours (8 avec Champ'Duit). |
| Champ Psychique | psychic-terrain | Psy | Statut | — | — | 10 | self (zone r3) | Pose Champ Psychique : barrière anti-dash (ennemis entrant dans la zone stoppés au bord, divergence Showdown #428), ×1.3 Psy attaquant sur zone. Durée 5 tours (8 avec Champ'Duit). |
| Gliss'Herbe | grassy-glide | Plante | Phys | 55 | 100 | 20 | dash r2 | Portée Dash étendue 2 → 4 si le lanceur part d'un Champ Herbu (#439). Soumis à la barrière Psy. |
| Monte-Tension | rising-voltage | Élec | Spé | 70 | 100 | 20 | single r1–4 | ×2 puissance si la cible est au sol sur un Champ Électrifié (double porte). |
| Vaste Pouvoir | expanding-force | Psy | Spé | 80 | 100 | 10 | single r1–4 | Sur Champ Psychique (lanceur au sol) : ciblage → AoE r2 autour de la cible (blast) + ×1.5 (#440, #444). Exempté du boost-type terrain. |
| Explo-Brume | misty-explosion | Fée | Spé | 100 | 100 | 5 | zone r2 | Self-KO (Recoil 999, modèle Explosion). ×1.5 si le lanceur est sur un Champ Brumeux. |
| Champlification | terrain-pulse | Normal→morph | Spé | 50 | 100 | 10 | single r1–4 | Type morph + ×2 (→100) selon le Champ sous le lanceur (Herbu→Plante, Électrifié→Élec, Brumeux→Fée, Psychique→Psy). Exempté du boost-type terrain (#443). |
| Force Nature | nature-power | morph | — | — | — | 20 | self→morph | Swap complet selon Champ (§6-A) > tuile de map (§6-B) > Triplattaque. Re-résolu à l'exécution (PP de nature-power). |
| Boue-Bombe | mud-bomb | Sol | Spé | 65 | 85 | 10 | single r1–4 | Baisse Précision −1 (30%). Cible de morph Force Nature (marais). |
| Souplesse | slam | Normal | Phys | 80 | 75 | 20 | single r1 | — |
| Surpuissance | superpower | Combat | Phys | 120 | 100 | 5 | single r1 | −1 Atk, −1 Déf attaquant (100%) |
| Taillade | fury-cutter | Insecte | Phys | 40 | 95 | 20 | single r1 | *(rider power escalade différé)* |
| Taurogne | raging-bull | Normal | Phys | 90 | 100 | 10 | dash r2 | *(rider screen-break différé)* |
| Ultimawashi | mega-kick | Normal | Phys | 120 | 75 | 5 | single r1 | — |
| Volt Assaut | supercell-slam | Électrique | Phys | 100 | 95 | 15 | dash r3 | *(rider crash on miss différé)* |
| Éclats Glace | ice-shard | Glace | Phys | 40 | 100 | 30 | dash r2 | Priorité (charge gap-close) |
| Météo Balle | swift | Normal | Spé | 60 | — | 20 | blast r1 1–5 | Touche garantie (`bypassAccuracy`) |
| Draco-Souffle | dragon-pulse | Dragon | Spé | 85 | 100 | 10 | ligne r4 | — |
| Éclat Dazzle | dazzling-gleam | Fée | Spé | 80 | 100 | 10 | zone r2 | Friendly fire |
| Voix Sonore | hyper-voice | Normal | Spé | 90 | 100 | 10 | cône r1–3 | Son |
| Surchauffe | overheat | Feu | Spé | 130 | 90 | 5 | zone r2 | −2 AtqSpé attaquant (100%) |
| Coup Vague | vacuum-wave | Combat | Spé | 40 | 100 | 30 | dash r2 | Priorité |
| Tempête Verte | leaf-storm | Plante | Spé | 130 | 90 | 5 | cône r1–3 | −2 AtqSpé attaquant (100%) |
| Sphère Aura | aura-sphere | Combat | Spé | 80 | — | 20 | single r1–4 | Touche garantie (`bypassAccuracy`) |
| Feuille Magique | magical-leaf | Plante | Spé | 60 | — | 20 | slash | Touche garantie (`bypassAccuracy`) |
| Joyau Lumière | power-gem | Roche | Spé | 80 | 100 | 20 | ligne r3 | — |
| Voix Douceur | disarming-voice | Fée | Spé | 40 | — | 15 | cône r1–2 | Touche garantie, son |
| Météore Draco | draco-meteor | Dragon | Spé | 130 | 90 | 5 | blast r1 1–5 | −2 AtqSpé attaquant (100%) |
| Électacle Choc | shock-wave | Électrique | Spé | 60 | — | 20 | cône r1–2 | Touche garantie (`bypassAccuracy`) |
| Double Battue | dual-wingbeat | Vol | Phys | 40×2 | 90 | 10 | single r1 | 2 coups |
| Éclat Roc | rock-blast | Roche | Phys | 25 | 90 | 10 | single r1–3 | 2–5 coups |
| Écaille Canon | scale-shot | Dragon | Phys | 25 | 90 | 20 | single r1–3 | 2–5 coups, −1 Déf / +1 Vit attaquant après |
| Balle Graine | bullet-seed | Plante | Phys | 25 | 100 | 30 | single r1–3 | 2–5 coups |
| Double Frappe | double-hit | Normal | Phys | 35×2 | 90 | 10 | single r1 | 2 coups |
| Dard-Aiguille | pin-missile | Insecte | Phys | 25 | 95 | 20 | single r1–2 | 2–5 coups |
| Combo-Giffe | fury-attack | Normal | Phys | 15 | 85 | 20 | single r1 | 2–5 coups |
| Ruée d'Os | bone-rush | Sol | Phys | 25 | 90 | 10 | single r1–2 | 2–5 coups |
| Stalacte Gel | icicle-crash | Glace | Phys | 85 | 90 | 10 | single r1–3 | Flinch 30% |
| Gifle Fion | tail-slap | Normal | Phys | 25 | 85 | 10 | single r1 | 2–5 coups |
| Vibraqua | water-pulse | Eau | Spé | 60 | 100 | 20 | single r1–3 | Confusion 20% |
| Canicule | heat-wave | Feu | Spé | 95 | 90 | 10 | cône r1–3 | Brûlure 10% |
| Sable Ardent | scorching-sands | Sol | Spé | 70 | 100 | 10 | single r1–3 | Brûlure 30% |
| Vibrobscur | dark-pulse | Ténèbres | Spé | 80 | 100 | 15 | ligne r1–4 | Flinch 20% |
| Vent Violent | hurricane | Vol | Spé | 110 | 70 | 10 | single r1–4 | Confusion 30% |
| Ébullition | scald | Eau | Spé | 80 | 100 | 15 | single r1–3 | Brûlure 30% |
| Éclair | thunder-shock | Électrique | Spé | 40 | 100 | 30 | single r1–3 | Para 10% |
| Élecanon | zap-cannon | Électrique | Spé | 120 | 50 | 5 | single r1–4 | Para 100% |
| Feu d'Enfer | inferno | Feu | Spé | 100 | 50 | 5 | single r1–3 | Brûlure 100% |
| Feu Envieux | burning-jealousy | Feu | Spé | 70 | 100 | 5 | cône r2 | Brûlure 100% si la cible a obtenu un boost de stat depuis sa dernière action (`TargetBoostedRecently`). |
| Poudreuse | powder-snow | Glace | Spé | 40 | 100 | 25 | cône r1–2 | Gel 10% |
| Détritus | sludge | Poison | Spé | 65 | 100 | 20 | single r1–3 | Poison 30% |
| Purédpois | gunk-shot | Poison | Phys | 120 | 80 | 5 | blast r1–3/r1 | Poison 30% |
| Extrasenseur | extrasensory | Psy | Spé | 80 | 100 | 20 | single r1–4 | Flinch 10% |
| Ouragan | twister | Dragon | Spé | 40 | 100 | 20 | zone r1 | Flinch 20%, friendly fire |
| Psykoud'Boul | zen-headbutt | Psy | Phys | 80 | 90 | 15 | single r1 | Flinch 20% |
| Direct Toxik | poison-jab | Poison | Phys | 80 | 100 | 20 | single r1 | Poison 30% |
| Tête de Fer | iron-head | Acier | Phys | 80 | 100 | 15 | single r1 | Flinch 30% |
| Détricanon | dragon-rush | Dragon | Phys | 100 | 75 | 10 | single r1 | Flinch 20% |
| Poison Croix | cross-poison | Poison | Phys | 70 | 100 | 20 | slash | Poison 10%, critique élevé |
| Draco-Charge | dragon-charge | Dragon | Phys | 80 | 100 | 20 | dash r3 | Knockback 1 |
| Étincelle | spark | Électrique | Phys | 65 | 100 | 20 | single r1 | Para 30% |
| Étonnement | astonish | Spectre | Phys | 30 | 100 | 15 | single r1 | Flinch 30% |
| Frotte-Frimousse | nuzzle | Électrique | Phys | 20 | 100 | 20 | single r1 | Para 100% |
| Queue-Poison | poison-tail | Poison | Phys | 50 | 100 | 25 | single r1 | Poison 10%, critique élevé |
| Bélier | take-down | Normal | Phys | 90 | 85 | 20 | dash r3 | Recoil 1/4 |
| Éclair Fou | wild-charge | Électrique | Phys | 90 | 100 | 15 | dash r3 | Recoil 1/4 |
| Écho | echoed-voice | Normal | Spé | 40 | 100 | 15 | cône r3 | `dynamicPower` crescendo : ×1–×5 (40→200) si un allié ou soi a utilisé Écho à l'action précédente (`EchoCrescendo`). Son. |
| Rapace | brave-bird | Vol | Phys | 120 | 100 | 15 | dash r3 | Recoil 1/3 |
| Aquatacle | wave-crash | Eau | Phys | 120 | 100 | 10 | dash r3 | Recoil 1/3 |
| Martobois | wood-hammer | Plante | Phys | 120 | 100 | 15 | single r1 | Recoil 1/3 |
| Vampi-Poing | drain-punch | Combat | Phys | 75 | 100 | 10 | single r1 | Drain 0.5 |
| Vole-Vie | absorb | Plante | Spé | 20 | 100 | 25 | single r1–2 | Drain 0.5 |
| Vampibaiser | draining-kiss | Fée | Spé | 50 | 100 | 10 | single r1 | Drain 0.75 |
| Lame de Roc | stone-edge | Roche | Phys | 100 | 80 | 5 | single r1–2 | Critique élevé (`critRatio: 1`) |
| Tunnelier | drill-run | Sol | Phys | 80 | 95 | 10 | ligne r2 | Critique élevé (`critRatio: 1`) |
| Griffe Ombre | shadow-claw | Spectre | Phys | 70 | 100 | 15 | single r1 | Critique élevé (`critRatio: 1`) |
| Tranch'Air | air-cutter | Vol | Spé | 60 | 95 | 25 | slash | Critique élevé (`critRatio: 1`) |
| Coupe Psycho | psycho-cut | Psy | Phys | 70 | 100 | 20 | slash | Critique élevé (`critRatio: 1`) |
| Tranche-Nuit | night-slash | Ténèbres | Phys | 70 | 100 | 15 | slash | Critique élevé (`critRatio: 1`) |
| Piétisol | bulldoze | Sol | Phys | 60 | 100 | 20 | zone r1 | −1 Vit cibles 100%, friendly fire |
| Tomberoche | rock-tomb | Roche | Phys | 60 | 95 | 15 | single r1–3 | −1 Vit cible 100% |
| Balayette | low-sweep | Combat | Phys | 65 | 100 | 20 | single r1 | −1 Vit cible 100% |
| Baston | beat-up | Ténèbres | Phys | var | 100 | 10 | single r1 | 1 coup par allié sain (sans statut majeur). Puissance par coup = 5 + floor(AtkBase allié / 10). |
| Bond | pounce | Insecte | Phys | 50 | 100 | 20 | single r1 | −1 Vit cible 100% |
| Tir de Boue | mud-shot | Sol | Spé | 55 | 95 | 15 | single r1–3 | −1 Vit cible 100% |
| Toile Élek | electroweb | Électrique | Spé | 55 | 95 | 15 | zone r2 | −1 Vit cibles 100%, friendly fire |
| Furie-Bond | lunge | Insecte | Phys | 80 | 100 | 15 | single r1 | −1 Atk cible 100% |
| Abattage | breaking-swipe | Dragon | Phys | 60 | 100 | 15 | slash | −1 Atk cibles 100% |
| Douche Froide | chilling-water | Eau | Spé | 50 | 100 | 20 | single r1–3 | −1 Atk cible 100% |
| Câlinerie | play-rough | Fée | Phys | 90 | 90 | 10 | single r1 | −1 Atk cible 10% |
| Aqua-Brèche | liquidation | Eau | Phys | 85 | 100 | 10 | single r1 | −1 Déf cible 20% |
| Coqui-Lame | razor-shell | Eau | Phys | 75 | 95 | 10 | slash | −1 Déf cible 50% |
| Éclate Griffe | crush-claw | Normal | Phys | 75 | 95 | 10 | single r1 | −1 Déf cible 50% |
| Telluriforce | earth-power | Sol | Spé | 90 | 100 | 10 | single r1–3 | −1 DéfSpé cible 10% |
| Bourdon | bug-buzz | Insecte | Spé | 90 | 100 | 10 | single r1–3 | −1 DéfSpé cible 10% |
| Bombe Acide | acid-spray | Poison | Spé | 40 | 100 | 20 | single r1–3 | −2 DéfSpé cible 100% |
| Ravage Rampant | skitter-smack | Insecte | Phys | 70 | 100 | 10 | single r1 | −1 AtqSpé cible 100% |
| Aboiement | snarl | Ténèbres | Spé | 55 | 95 | 15 | cône r1–3 | −1 AtqSpé cibles 100% |
| Feu Ensorcelé | mystical-fire | Feu | Spé | 75 | 100 | 10 | single r1–3 | −1 AtqSpé cible 100% |
| Survinsecte | struggle-bug | Insecte | Spé | 50 | 100 | 20 | cône r1–2 | −1 AtqSpé cibles 100% |
| Coud'Boue | mud-slap | Sol | Spé | 20 | 100 | 10 | single r1–2 | −1 Préc cible 100% |
| Ocroupi | muddy-water | Eau | Spé | 90 | 85 | 10 | zone r2 | −1 Préc cibles 30%, friendly fire |
| Grimace | scary-face | Normal | Statut | — | 100 | 10 | single r1–3 | −2 Vit cible |
| Charme | charm | Fée | Statut | — | 100 | 20 | single r1–3 | −2 Atk cible |
| Croco Larme | fake-tears | Ténèbres | Statut | — | 100 | 20 | single r1–3 | −2 DéfSpé cible |
| Ondes Étranges | eerie-impulse | Électrique | Statut | — | 100 | 15 | single r1–3 | −2 AtqSpé cible |
| Strido-Son | metal-sound | Acier | Statut | — | 85 | 40 | single r1–3 | −2 DéfSpé cible |
| Regard Touchant | baby-doll-eyes | Fée | Statut | — | 100 | 30 | single r1–3 | −1 Atk cible. Priorité +1 |
| Confidence | confide | Normal | Statut | — | — | 20 | single r1–3 | −1 AtqSpé cible |
| Chatouille | tickle | Normal | Statut | — | 100 | 20 | single r1–3 | −1 Atk, −1 Déf cible |
| Gros'Yeux | leer | Normal | Statut | — | 100 | 30 | cône r1–3 | −1 Déf cibles |
| Mimi-Queue | tail-whip | Normal | Statut | — | 100 | 30 | cône r1–3 | −1 Déf cibles |
| Doux Parfum | sweet-scent | Normal | Statut | — | 100 | 20 | zone r2 | −1 Esquive cibles |
| Sécrétion | string-shot | Insecte | Statut | — | 95 | 40 | cône r1–2 | −1 Vit cibles |
| Armure | harden | Normal | Statut | — | — | 30 | self | +1 Déf |
| Rengorgement | work-up | Normal | Statut | — | — | 30 | self | +1 Atk, +1 AtqSpé |
| Poliroche | rock-polish | Roche | Statut | — | — | 20 | self | +2 Vit |
| Coaching | coaching | Combat | Statut | — | — | 10 | allié r1 | +1 Atk, +1 Déf allié |
| Poudre Toxik | poison-powder | Poison | Statut | — | 75 | 35 | single r1 | Poison 100% |
| Para-Spore | stun-spore | Plante | Statut | — | 75 | 30 | single r1 | Para 100% |
| Gaz Toxik | poison-gas | Poison | Statut | — | 90 | 40 | zone r1 | Poison 100% |
| Doux Baiser | sweet-kiss | Fée | Statut | — | 75 | 10 | single r1–3 | Confusion 100% |
| Danse Folle | teeter-dance | Normal | Statut | — | 100 | 20 | zone r2 | Confusion 100% cibles, friendly fire |
| Vantardise | swagger | Normal | Statut | — | 85 | 15 | single r1–3 | +2 Atk cible + Confusion 100% |
| Flatterie | flatter | Ténèbres | Statut | — | 100 | 15 | single r1–3 | +1 AtqSpé cible + Confusion 100% |
| Force | strength | Normal | Phys | 80 | 100 | 15 | single r1–3 | — |
| Écrasement | stomp | Normal | Phys | 65 | 100 | 20 | single r1–3 | Flinch 30% |
| Double Baffe | dual-chop | Dragon | Phys | 40×2 | 90 | 15 | single r1 | 2 coups |
| Camaraderie | play-nice | Normal | Statut | — | — | 20 | single r1–3 | −1 Atk cible + touche garantie (`bypassAccuracy`) |
| Rafale Feu | blast-burn | Feu | Spé | 150 | 90 | 5 | ligne r5 | Recharge 1 tour |
| Végé-Attaque | frenzy-plant | Plante | Spé | 150 | 90 | 5 | ligne r5 | Recharge 1 tour |
| Hydroblast | hydro-cannon | Eau | Spé | 150 | 90 | 5 | ligne r5 | Recharge 1 tour |
| Giga Impact | giga-impact | Normal | Phys | 150 | 90 | 5 | dash r3 | Recharge 1 tour (contact → Dash) |
| Lame Solaire | solar-blade | Plante | Phys | 125 | 100 | 10 | single r1 | Charge 2 tours (skip sous Soleil). Flags `contact`+`slicing`. |
| Laser Météore | meteor-beam | Roche | Spé | 120 | 90 | 5 | ligne r5 | Charge 2 tours. T1 : `chargeEffects` +1 AtqSpé self. |
| Trempette | splash | Normal | Statut | — | — | 40 | self | Aucun (no-op canonique) |
| Trépignement | stomping-tantrum | Sol | Phys | 75 | 100 | 10 | single r1 | `dynamicPower` ×2 (150) si le move précédent du lanceur a échoué (`PreviousMoveFailedDouble`). |
| Façade | facade | Normal | Phys | 70 (140 si statut) | 100 | 20 | single r1–3 | `dynamicPower` ×2 si lanceur a un statut majeur. Ignore baisse Atk brûlure (`ignoresBurnAttackDrop`). |
| Châtiment | hex | Spectre | Spé | 65 (130 si statut cible) | 100 | 10 | single r1–3 | `dynamicPower` ×2 si cible a un statut majeur ou volatile. |
| Choc Venin | venoshock | Poison | Spé | 65 (130 si cible empoisonnée) | 100 | 10 | single r1–3 | `dynamicPower` ×2 si cible Poisoned ou BadlyPoisoned. |
| Acrobatie | acrobatics | Vol | Phys | 55 (110 sans objet) | 100 | 15 | slash | `dynamicPower` ×2 si lanceur ne tient aucun objet. |
| Aire d'Eau | water-pledge | Eau | Spé | 80 | 100 | 10 | single r3 | Dégâts simples (combo champ différé B4). |
| Aire de Feu | fire-pledge | Feu | Spé | 80 | 100 | 10 | single r3 | Dégâts simples (combo champ différé B4). |
| Aire d'Herbe | grass-pledge | Plante | Spé | 80 | 100 | 10 | single r3 | Dégâts simples (combo champ différé B4). |
| Force Ajoutée | stored-power | Psy | Spé | 20 (+20/stage positif) | 100 | 10 | single r1–3 | `dynamicPower` 20 + 20 par cran de stat positif du lanceur (max 860). |
| Boule Élek | electro-ball | Électrique | Spé | var | 100 | 10 | single r1–4 | `dynamicPower` ratio vitesse : 40–150 selon spdSoi/spdCible. |
| Gyroballe | gyro-ball | Acier | Phys | var | 100 | 5 | single r1 | `dynamicPower` `min(150, floor(25 × spdCible/spdSoi + 1))`. |
| Gigotage | flail | Normal | Phys | var | 100 | 15 | single r1 | `dynamicPower` selon HP% lanceur (20–200 : 200 à ≤4%, 150 ≤9%, 100 ≤16%, 80 ≤32%, 40 ≤48%, 20 sinon). |
| Contre | reversal | Combat | Phys | var | 100 | 15 | single r1 | `dynamicPower` identique à Gigotage selon HP% lanceur. |
| Saumure | brine | Eau | Spé | 65 (130 si cible ≤50% HP) | 100 | 10 | single r1–3 | `dynamicPower` ×2 si HP cible ≤ 50% max. |
| Pression Extrême | hard-press | Acier | Phys | var | 100 | 10 | single r1 | `dynamicPower` `floor(100 × HPcible / HPmax)` (min 1). |
| Giclédo | water-spout | Eau | Spé | var | 100 | 5 | zone r2 | `dynamicPower` `max(1, floor(150 × HPsoi / HPmax))`. Friendly fire. |
| Big Splash | body-press | Combat | Phys | 80 | 100 | 10 | single r1 | `attackStatSource: UserDefense` — dégâts calculés depuis la Défense du lanceur (+ crans Déf). Bagarre ne booste pas. |
| Tricherie | foul-play | Ténèbres | Phys | 95 | 100 | 15 | single r1 | `attackStatSource: TargetAttack` — dégâts calculés depuis l'Attaque de la cible (+ crans Atq cible). Atk lanceur ignorée. |
| Balayage | low-kick | Combat | Phys | var | 100 | 20 | single r1 | `dynamicPower` `TargetWeight` : puissance selon poids cible (20 ≤10 kg → 120 ≥200 kg). 6 paliers parité Showdown. |
| Nœud Herbe | grass-knot | Plante | Spé | var | 100 | 20 | single r1 | `dynamicPower` `TargetWeight` : identique à Balayage (puissance selon poids cible). |
| Tacle Lourd | heavy-slam | Acier | Phys | var | 100 | 10 | single r1 | `dynamicPower` `WeightRatio` : puissance selon ratio poids lanceur / poids cible (40–120). Palier ×3 inclusif → 80. |
| Tacle Feu | heat-crash | Feu | Phys | var | 100 | 10 | single r1 | `dynamicPower` `WeightRatio` : identique à Tacle Lourd. |
| Vendetta | revenge | Combat | Phys | 60 | 100 | 10 | single r1 | `dynamicPower` ×2 si le lanceur a été touché par un ennemi depuis sa dernière action (`DamagedByEnemySinceLastAction`). Priorité −4. |
| Vengeance | retaliate | Normal | Phys | 70 | 100 | 5 | single r1 | `dynamicPower` ×2 si un allié est tombé KO depuis la dernière action du lanceur (`AllyFaintedSinceLastAction`). |
| Voix Envoûtante | alluring-voice | Fée | Spé | 80 | 100 | 10 | cône r2 | Confusion 100% si la cible a obtenu un boost de stat depuis sa dernière action (`TargetBoostedRecently`). |

---

## Talents (77 implémentés)

| Talent | ID | Pokemon (roster) | Effet résumé |
|---|---|---|---|
| Engrais | overgrow | Bulbizarre | ×1.5 attaques Plante si PV ≤ 1/3 |
| Brasier | blaze | Salamèche | ×1.5 attaques Feu si PV ≤ 1/3 |
| Torrent | torrent | Carapuce | ×1.5 attaques Eau si PV ≤ 1/3 |
| Regard Vif | keen-eye | Roucool | Bloque baisses de Précision |
| Statik | static | Pikachu | Contact → Para adversaire 30% |
| Cran | guts | Machoc | ×1.5 attaques Phys si statut majeur |
| Synchro | synchronize | Abra | Renvoie Brûl/Para/Pois/PoisF à la source |
| Lévitation | levitate | Fantominus | Immunité Sol |
| Solidité | sturdy | Racaillou | Survie à 1 PV sur coup fatal à plein PV ; immunité totale vs moves K.O. en un coup (`isOhko`, plan 148), bypassée par Brise Moule |
| Intimidation | intimidate | Caninos | Au début : −1 Atk ennemis adjacents (rayon 1) |
| Joli Sourire | cute-charm | Rondoudou | Contact → Attirance adversaire 30% (genre opposé) |
| Isograisse | thick-fat | Otaria | −50% dégâts Feu et Glace reçus |
| Rivalité | adaptability | Évoli | STAB = ×2 au lieu de ×1.5 |
| Corps Sain | clear-body | Tentacool | Bloque toutes les baisses de stats |
| Point Poison | poison-point | Nidoran♂ | Contact → Poison adversaire 30% |
| Technicien | technician | Miaouss | ×1.5 attaques de puissance ≤ 60 |
| Magnétisme | magnet-pull | Magnéti | Piège les Pokemon Acier adjacents |
| Voile Sable | sand-veil | Sabelette, Sablaireau | +20% esquive sous Tempête de Sable (×0.8 sur accuracy adversaire), `AbilityActivated` au tour start |
| Tempo Perso | own-tempo | Excelangue | Immunité Confusion et Intimidation |
| Matinale | early-bird | Kangourex | Durée Sommeil ÷ 2 |
| Para-Foudre | lightning-rod | Raichu | Immunité Électrique + +1 AtqSpé si Électrique reçu (redirect → plan dédié) |
| Garde Magique | magic-guard | Alakazam | Bloque tous dégâts indirects (brûlure, poison, vampigraine, recul Life Orb…) |
| Aucun Garde | no-guard | Mackogneur | Toutes attaques envoyées ET reçues ont 100% précision |
| Macho | moxie | Léviator | +1 Atk quand le porteur met un ennemi KO |
| Multiécaille | multiscale | Dracolosse | Divise par 2 les dégâts reçus si PV max |
| Absorb'Eau | water-absorb | Aquali | Immunité Eau + soigne +25% PV max si touché par move Eau |
| Torche | flash-fire | Pyroli | Immunité Feu + ×1.5 dégâts Feu après avoir reçu un move Feu |
| Absorb'Volt | volt-absorb | Voltali | Immunité Électrique + soigne +25% PV max si touché par move Électrique |
| Esprit Vital | vital-spirit | Colossinge | Immunité au sommeil |
| Insomnie | insomnia | Hypnomade | Immunité au sommeil |
| Corps Maudit | cursed-body | Ectoplasma | 30% chance confusion sur attaque contact reçue |
| Tête de Roc | rock-head | Ossatueur, Ptéra | Annule les dégâts de recul |
| Souplesse | limber | Kicklee | Immunité à la paralysie |
| Poing de Fer | iron-fist | Tygnon | ×1.2 dégâts moves avec flag `punch` |
| Soin Naturel | natural-cure | Staross | Soigne le statut majeur en fin de tour |
| Armure Dure | battle-armor | Kabutops | Immunité aux coups critiques |
| Pose Spore | effect-spore | Rafflesia | 30% chance sur contact reçu : Sommeil, Poison ou Para (1/3 chacun) |
| Ciel Gris | cloud-nine | Akwakwak | Supprime tous les effets météo via `effectiveWeather` (renvoie None si porteur actif) |
| Coque Armure | shell-armor | Crustabri | Immunité aux coups critiques |
| Hyper Cutter | hyper-cutter | Krabboss | Bloque toutes les baisses d'Attaque |
| Flegmatique | oblivious | Lippoutou | Immunité à Attirance (Infatuation) |
| Corps Ardent | flame-body | Magmar | 30% chance Brûlure sur attaque contact reçue (sur l'attaquant) |
| Calque | trace | Porygon | Au combat : copie l'ability de l'ennemi le plus proche |
| Glissade | swift-swim | Amonistar | ×2 CT gain sous Pluie (double vitesse), `AbilityActivated` au tour start |
| Contact Poison | poison-touch | Grotadmorv | 30% chance empoisonner ennemi quand move de contact (`onAfterDamageDealt`) |
| Filtre | filter | M. Mime | Réduit de 25% les dégâts reçus super-efficaces (`onDamageModify`) |
| Œil Composé | compound-eyes | Aéromite | ×1.3 précision de tous les moves (`accuracyMultiplier`) |
| Essaim | swarm | Dardargnan | ×1.5 attaques Insecte si PV ≤ 1/3 |
| Ignifu-Voile | water-veil | Poissoroy | Immunité Brûlure |
| Pression | pressure | Artikodin, Électhor, Sulfura, Mewtwo | Cible adverse dépense +50 CT par action utilisée contre le porteur (`targetedCtBonus`) |
| Suintement | shield-dust | Papilusion | Bloque les effets secondaires des moves ennemis (`onSecondaryEffectBlocked`) |
| Attention | inner-focus | Rattatac, Rapasdepic, Nosferalto, Canarticho, Mew | Stub — immunité flinch (pas de mécanique flinch dans le core Phase 4) |
| Chlorophylle | chlorophyll | Florizarre, Noadkoko | ×2 CT gain sous Soleil (double vitesse), `AbilityActivated` au tour start |
| Téméraire | reckless | Tauros, Léviator | ×1.2 dégâts si le move a un effet de recul (`EffectKind.Recoil`). Silencieux (`onDamageModify`). |
| Rivalité | rivalry | Nidoran♂, Nidoran♀, Tauros | ×1.25 si adversaire même genre, ×0.75 genre opposé, ×1 si genderless. Silencieux (`onDamageModify`). |
| Lentiteintée | tinted-lens | Aéromite | Si effectivité < 1 → ×2 (0.5→1.0). Silencieux (`onDamageModify`). |
| Régé-Force | regenerator | Flagadoss | Soin `ceil(maxHp/16)` en fin de tour (`onEndTurn`). **Divergence canon** : canon = soin 1/3 à l'échange, inapplicable sans banc → réinterprété soin passif fin de tour. Émet `AbilityActivated` + `HpRestored`. |
| Sniper | sniper | Krabboss, Canarticho | Si coup critique → ×1.5 multiplicatif (total 2.25). Requiert flag `isCrit` dans `DamageModifyContext`. Silencieux. |
| Colérique | anger-point | Tauros | Reçoit un critique → Attaque à +6 stages instantanément. Requiert flag `isCrit` dans `AfterDamageContext`. Émet `AbilityActivated`. |
| Acharné | defiant | Primeape, Farfetch'd | Stat abaissée par un adversaire → +2 Attaque. Hook `onAfterStatLowered` (gate `source.playerId !== self.playerId`). Émet `AbilityActivated`. |
| Battant | competitive | Nidoqueen | Stat abaissée par un adversaire → +2 Atq. Spé. Hook `onAfterStatLowered` (même gate qu'Acharné). Émet `AbilityActivated`. |
| Inconscient | unaware | Flagadoss | Attaque : ignore les stages Déf/DéfSpé de la cible. Défense : ignore les stages Atq/AtqSpé de l'attaquant. Marker lu dans `damage-calculator`. Silencieux. |
| Querelleur | scrappy | Ronflex, Kangourex | Normal/Combat ignorent l'immunité Spectre. Implémenté inline dans `effect-processor.ts`. Bug corrigé : l'effectivité retournée correspond bien au matching non-Ghost (fix lors du plan 136). |
| Multi-Coups | skill-link | Crustabri, Araignant | Moves multi-frappes = toujours le maximum de coups. Marker lu dans `handle-damage.ts` (`rollMultiHitCount`). |
| Cœur de Coq | big-pecks | Roucool, Roucoups, Roucarnage | Bloque toutes les baisses de Défense (`onStatChangeBlocked`, miroir Hyper Cutter). Émet `AbilityActivated`. |
| Lumiattirance | illuminate | Stari, Staross | Bloque toutes les baisses de Précision (`onStatChangeBlocked`, miroir Regard Vif). Émet `AbilityActivated`. |
| Vaccin | immunity | Ronflex | Immunité Poison et Poison Grave (`onStatusBlocked`). Émet `AbilityActivated`. |
| Baigne Sable | sand-rush | Sabelette, Sablaireau | ×2 CT gain sous Tempête de Sable (champ déclaratif `weatherSpeedBoost`, miroir Glissade). |
| Rideau Neige | snow-cloak | Artikodin | +1 esquive sous Neige (champ déclaratif `weatherEvasionBoost`, miroir Voile Sable). |
| Phobique | rattled | Magicarpe | +1 Vitesse si touché par un move Ténèbres, Spectre ou Insecte (`onAfterDamageReceived`). Émet `AbilityActivated`. |
| Mue | shed-skin | Chrysacier, Coconfort, Abo, Arbok | 33% de chance de soigner le statut majeur en fin de tour (`onEndTurn`, via `random: () => number` exposé dans `AbilityEndTurnContext`). Émet `AbilityActivated` + `StatusRemoved`. |
| Hydratation | hydration | Otaria, Lamantine, Lokhlass, Aquali | Soigne le statut majeur en fin de tour si météo Pluie active (`onEndTurn`, vérifie `weather` dans `AbilityEndTurnContext`). Émet `AbilityActivated` + `StatusRemoved`. |
| Cuvette | rain-dish | Carapuce, Carabaffe, Tortank, Tentacool | Soin `max(1, ceil(maxHp/16))` par tour sous Pluie (`onEndTurn`). Émet `AbilityActivated` + `HpRestored`. |
| Corps Gel | ice-body | Otaria, Lamantine | Soin `max(1, ceil(maxHp/16))` par tour sous Neige (`onEndTurn`). Émet `AbilityActivated` + `HpRestored`. |
| Écaille Spéciale | marvel-scale | Minidraco, Draco | Dégâts physiques reçus ÷ 1.5 si statut majeur actif (`onDamageModify` défenseur). Silencieux. |
| Cœur Noble | justified | Caninos, Arcanin | +1 Attaque si touché par un move Ténèbres (`onAfterDamageReceived`). Émet `AbilityActivated`. |
| Sécheresse | drought | Goupix, Feunard | Invoque le Soleil (5 tours) à l'entrée en combat (champ déclaratif `weatherAutoSetter`, câblé dans `triggerBattleStart`). |
| Impassible | steadfast | Machoc, Machopeur, Mackogneur, Insécateur | +1 Vitesse quand le porteur subit un flinch (nouveau hook `onFlinch`, `AbilityFlinchContext { self, state }`, invoqué dans `processFlinch`). Émet `AbilityActivated`. |

---

## Objets Tenus (88 implémentés)

| Nom | ID | Effet résumé |
|---|---|---|
| Restes | leftovers | +1/16 PV max par tour |
| Orbe Vie | life-orb | ×1.3 dégâts, −1/10 PV max après attaque |
| Ceinture Choix | choice-band | ×1.5 Attaque Phys, verrouille l'attaque |
| Foulard Choix | choice-scarf | ×1.5 CT gain (vitesse), verrouille l'attaque |
| Filet Focus | focus-sash | Survit à 1 coup depuis PV max (1 PV restant) |
| Ceinture Expert | expert-belt | ×1.2 dégâts super-efficaces |
| Casque Gonflé | rocky-helmet | Attaquant au contact perd 1/6 PV max |
| Police Faiblesse | weakness-policy | +2 Atk et AtqSpé si touché super-efficacement (consommé) |
| Lentilles Portée | scope-lens | +1 stage critique |
| Baie Sitrus | sitrus-berry | Soigne 1/4 PV max si PV ≤ 50% (consommée) |
| Bottes Glissantes | heavy-duty-boots | Immunité effets de terrain (pièges, terrain) |
| Ballon Lumineux | light-ball | ×2 dégâts Pikachu uniquement |
| Lentilles Choix | choice-specs | ×1.5 AtqSpé, verrouille l'attaque |
| Éviolite | eviolite | ×1.5 Déf et DéfSpé pour Pokemon NFE Gen 2+ (liste hardcodée) |
| Boue Noire | black-sludge | +1/16 PV/tour si Poison, −1/8 PV/tour sinon |
| Poireau | leek | +2 stages critique (Canarticho uniquement) |
| Os Épais | thick-club | ×2 Attaque (Ossatueur uniquement) |
| Herbe Blanche | white-herb | Restaure la première stat abaissée (consommée) — `onStatLowered` |
| Orbe Flamme | flame-orb | Inflige Brûlure au porteur en fin de premier tour |
| Baie Salace | salac-berry | +1 Vitesse si PV ≤ 25% (consommée) |
| Gemme Normale | normal-gem | ×1.3 prochain move Normal (consommée) |
| Roc Chaleur | heat-rock | Étend Soleil (sunny-day) de 5 à 8 tours |
| Lumargile | light-clay | Étend Reflect / Light Screen posés par le porteur de 5 à 8 tours |
| Champ'Duit | terrain-extender | Étend les Champs (grassy/electric/misty/psychic-terrain) posés par le porteur de 5 à 8 tours (effet passif au cast, miroir Light Clay) |
| Mouchoir Soie | silk-scarf | ×1.2 dégâts des moves Normal |
| Charbon | charcoal | ×1.2 dégâts des moves Feu |
| Eau Mystique | mystic-water | ×1.2 dégâts des moves Eau |
| Graine Miracle | miracle-seed | ×1.2 dégâts des moves Plante |
| Aimant | magnet | ×1.2 dégâts des moves Électrik |
| Glace Éternelle | never-melt-ice | ×1.2 dégâts des moves Glace |
| Ceinture Noire | black-belt | ×1.2 dégâts des moves Combat |
| Pic Venin | poison-barb | ×1.2 dégâts des moves Poison |
| Sable Doux | soft-sand | ×1.2 dégâts des moves Sol |
| Bec Pointu | sharp-beak | ×1.2 dégâts des moves Vol |
| Cuillère Tordue | twisted-spoon | ×1.2 dégâts des moves Psy |
| Poudre Argentée | silver-powder | ×1.2 dégâts des moves Insecte |
| Pierre Dure | hard-stone | ×1.2 dégâts des moves Roche |
| Rune Sort | spell-tag | ×1.2 dégâts des moves Spectre |
| Croc Dragon | dragon-fang | ×1.2 dégâts des moves Dragon |
| Lunettes Noires | black-glasses | ×1.2 dégâts des moves Ténèbres |
| Peau Métal | metal-coat | ×1.2 dégâts des moves Acier |
| Plume Enchantée | fairy-feather | ×1.2 dégâts des moves Fée |
| Orbe Toxique | toxic-orb | Empoisonne gravement le porteur en fin de tour (factory `selfStatusOrb` — Orbe Flamme migré vers la même factory) |
| Bandeau Muscle | muscle-band | ×1.1 dégâts des moves Physiques (`onDamageModify`) |
| Lunettes Sages | wise-glasses | ×1.1 dégâts des moves Spéciaux (`onDamageModify`) |
| Grelot Coque | shell-bell | Soigne le porteur de 1/8 des dégâts infligés, non consommé (`onAfterMoveDamageDealt`) |
| Bulbe | absorb-bulb | +1 AtqSpé si touché par un move Eau (consommé, `onAfterDamageReceived`, factory `typeReactionItem`) |
| Pile | cell-battery | +1 Atk si touché par un move Électrik (consommé, `onAfterDamageReceived`, factory `typeReactionItem`) |
| Boule de Neige | snowball | +1 Atk si touché par un move Glace (consommé, `onAfterDamageReceived`, factory `typeReactionItem`) |
| Lichen Lumineux | luminous-moss | +1 DéfSpé si touché par un move Eau (consommé, `onAfterDamageReceived`, factory `typeReactionItem`) |
| Roche Humide | damp-rock | Étend Pluie (rain-dance) de 5 à 8 tours |
| Roche Lisse | smooth-rock | Étend Tempête de Sable (sandstorm) de 5 à 8 tours |
| Roche Glace | icy-rock | Étend Neige (snowscape) de 5 à 8 tours |
| Graine Électrik | electric-seed | +1 Déf si le porteur se trouve sur un Champ Électrifié en fin de tour (consommé, `onEndTurn`, factory `terrainSeedItem`) |
| Graine Herbe | grassy-seed | +1 Déf si le porteur se trouve sur un Champ Herbu en fin de tour (consommé, `onEndTurn`, factory `terrainSeedItem`) |
| Graine Psychique | psychic-seed | +1 DéfSpé si le porteur se trouve sur un Champ Psychique en fin de tour (consommé, `onEndTurn`, factory `terrainSeedItem`) |
| Graine Brume | misty-seed | +1 DéfSpé si le porteur se trouve sur un Champ Brumeux en fin de tour (consommé, `onEndTurn`, factory `terrainSeedItem`) |
| Loupe | wide-lens | +10% précision sur toutes les attaques du porteur (`onAccuracyModify`) |
| Lentille Zoom | zoom-lens | +20% précision si le porteur agit après la cible (`onAccuracyModify`) |
