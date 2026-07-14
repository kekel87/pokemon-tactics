# Plan 158 — Content-fill : objets tenus légers + talents ability1 silencieux — Phase 4

> Statut : done
> Phase : 4 (content-fill, intercalé)
> Créé : 2026-07-13
> Terminé : 2026-07-13
> Auteur : Claude
> Dépend de : plan 142 (item interaction, `critStageBoost`/`consumedItemId`), Pièges/Trapping (2026-06-28, `StatusType.Trapped` + `positionLinked`), plan 139 (`secondary-effect.ts`), plan 111 (moves liés au poids), plan 157 (`transformState`), talent Multi-Coups (`skill-link`), Baie Ceinture / Solidité (survie 1 PV).
> Débloque : rapproche la couverture exhaustive Team Builder libre. Comble le gap « 8 Pokemon jouables sans talent actif ».

## Objectif

Session **content-fill** (pas une nouvelle mécanique) : ajouter le contenu Gen 1 restant à **faible coût** (réutilise l'infra existante), et **combler un gap propre** découvert au recensement : 8 Pokemon jouables ont un talent en slot ability1 **sans handler → aucun talent actif en combat**.

Deux volets :
- **11 objets tenus légers** (106 → 117) — tous réutilisent une infra déjà livrée.
- **2 talents ability1 silencieux** (105 → 107) — effets quasi no-op mais documentés (précédent Magné-Contrôle codé par complétude).

Hors périmètre : objets « modérés/lourds » (Herbe Pouvoir, Piquants, Parapluie Solide…), talents pool-only informationnels (Prédiction, Fouille, Anticipation…), Gaz Inhibiteur (déjà reporté plan 140). Voir § Périmètre exclu.

## Décisions verrouillées (humain 2026-07-13)

1. **Bandeau** (`focus-band`) — **INCLUS**. Hook « survie probabiliste à tout PV » (roll PRNG déterministe, seam test), câblé au même point que Baie Ceinture / Solidité. Diffère : 10 % à n'importe quels PV (vs garantie plein PV pour les 2 autres).
2. **Objets espèce-lockés** — **les 3 INCLUS** : Poing Chance (Leveinard), Poudre Métal + Poudre Vite (Métamorph). Précédent Massue Os / Cordon Élec. Cohérent avec l'arrivée de Métamorph (plan 157).
3. **Talents Fuite / Ramassage** — **CODÉS no-op documenté** (handler vide). Comme Magné-Contrôle : les 8 mons cessent d'avoir un talent fantôme, compteur honnête 107/114.

## Volet A — 11 objets tenus légers (106 → 117)

| Objet FR (id EN) | Effet | Infra réutilisée |
|---|---|---|
| **Bandeau** (`focus-band`) | 10 % survie à 1 PV sur coup fatal, tout PV | chemin survie 1 PV (Solidité / Baie Ceinture) + roll PRNG — **cf. décision 1** |
| **Griffe Rasoir** (`razor-claw`) | +1 cran critique permanent (non consommé) | `critStageBoost` (plan 142), lu dans `damage-calculator.ts` |
| **Poing Chance** (`lucky-punch`) | +2 crans critiques, **Leveinard uniquement** | `critStageBoost` + gate espèce (précédent Massue Os) — **cf. décision 2** |
| **Dé Pipé** (`loaded-dice`) | Moves multi-frappes → toujours au max de coups | logique Multi-Coups (`skill-link`) côté objet |
| **Cape Obscure** (`covert-cloak`) | Supprime les effets secondaires des moves **du porteur** | `secondary-effect.ts` (plan 139, Sans Limite/Sérénité) |
| **Pierrallégée** (`float-stone`) | Poids du porteur ÷2 | moves poids-dépendants (plan 111 : Balayage/Nœud Herbe/Tacle Lourd/Tacle Feu) via `effectiveWeight` (plan 157) |
| **Bande Étreinte** (`binding-band`) | ×2 dégâts/tour des moves de piège (Étreinte/Danse Flammes/Siphon/Tourbi-Sable) | `damagePerTurn` du statut `Trapped` (famille Pièges) |
| **Accro Griffe** (`grip-claw`) | Durée des pièges partiels forcée au max | durée `Trapped` (famille Pièges) |
| **Carapace Mue** (`shed-shell`) | Immunité totale au piégeage (`Trapped` + position-linked Barrage/Regard Noir) | flag d'immunité sur l'infra Trapped/positionLinked |
| **Poudre Métal** (`metal-powder`) | Déf + Déf.Spé ×1.5, **Métamorph non transformé** | gate espèce + `transformState` (plan 157) — **cf. décision 2** |
| **Poudre Vite** (`quick-powder`) | Vitesse ×2, **Métamorph non transformé** | même gate ; pilote aussi la portée de déplacement (Vitesse → mouvement) |

Chaque objet : entrée `held-item-id.ts`, définition `item-definitions.ts` (handler avec le bon hook), i18n FR/EN, InfoPanel/MoveTooltip si un badge est pertinent (sinon rien), 1 fichier test unit dédié, 1 scénario e2e minimal (cahier `docs/test-plan.md` §5).

### Notes hooks

- **Bandeau** : à câbler au même point que Baie Ceinture / Solidité dans le chemin de dégâts fatals + roll PRNG déterministe (seam test).
- **Bande Étreinte / Accro Griffe / Carapace Mue** : la famille Pièges est déjà en place (`StatusType.Trapped`, `damagePerTurn`, `positionLinked`). Ces 3 objets sont de purs modificateurs sur cette infra.
- **Pierrallégée / Poudre Métal / Poudre Vite** : lecture via les helpers `effective*` (plan 157) — pas de nouveau champ d'état.

## Volet B — 2 talents ability1 silencieux (105 → 107)

⚠️ Le loader (`load-pokemon.ts`) ne charge **que** le slot ability1 aujourd'hui. Ces 2 talents SONT équipés en jeu mais sans handler → `getForPokemon` renvoie `undefined` → aucun effet.

| Talent FR (id EN) | Pokemon Gen 1 (ability1) | Traitement |
|---|---|---|
| **Fuite** (`run-away`) | Rattata, Rattatac, Ponyta, Galopa, Doduo, Dodrio, Évoli | **No-op documenté** — pas de combat sauvage / fuite dans ce jeu. Handler vide, tag InfoPanel « (sans effet en combat tactique) » optionnel. |
| **Ramassage** (`pickup`) | Miaouss | **No-op documenté** — ramassage hors-combat inexistant. Handler vide. |

Précédent : Magné-Contrôle (plan 156) et Bec-Canon/Carapiège (plan 150) codés par complétude / no-op documenté. Bénéfice : les 8 mons cessent d'avoir un talent fantôme, et la barre « talents implémentés » devient honnête (107/114).

Chaque talent : entrée registry + définition data, i18n déjà présent (à vérifier), 1 test unit prouvant le handler est trouvé (pas `undefined`), note `docs/abilities-system.md` + `docs/implementations.md`.

**Correction doc** : le pool réel de talents = **114** (union ability1/2/hidden des 151 espèces), pas 115 (`implementations.md` §Récapitulatif a une dérive de comptage cumulée). À corriger : 107 / 114 après ce plan.

## Périmètre exclu (documenté, pas oublié)

- **Objets modérés/lourds** (17) : Vive Griffe, Baie Chérim, Baie Micle (réinterprétation CT priorité), Balle Fer, Point de Mire, Garde-Talent, Sac Fuite, Feuille Copieuse, Orbe Frousse, Nœud Destin, Assurance Échec, Herbe Pouvoir (charge 2-tours), Piquants (transfert contact), Parapluie Solide (routage météo), Ralentiqueue/Encens Plein, Cape Obscure déjà incluse. → batch content-fill ultérieur si jugé utile.
- **Talents pool-only** (7) : Piège Sable, Prédiction, Fouille, Récolte, Gaz Inhibiteur (reporté plan 140), Délestage, Anticipation. Non chargés par le loader (ability2/hidden) + majoritairement informationnels (faible valeur IA-vs-IA). → différés jusqu'à ce que le loader gère les slots alternatifs (chantier séparé).
- **Objets hors-scope** : Méga-Gemmes (Phase 9), objets Gen 2-9 spécifiques, objets EV (système absent), doublons ×1.2 type.

## Compteur

- Objets tenus : **106 → 117** (+11).
- Talents : **105 → 107** (+2), pool corrigé à 114.
- Moves : inchangé (503).

## Compteur final (2026-07-13)

- Objets tenus : **117 / ~159** livrés. Talents : **107 / 114** livrés (pool corrigé).
- Infra core : 6 flags déclaratifs sur `HeldItemHandler` (`immuneToTrapping`, `maximizesTrapDuration`, `doublesTrapDamage`, `maximizesMultiHit`, `survivesLethalHitChance`, `suppressesIncomingSecondary`), lecture engine dans `effective-weight.ts`/`effective-base-speed.ts` (via `heldItemId` direct), `handle-status.ts` (3 items pièges), `handle-damage.ts` (Bandeau + Dé Pipé), `effect-processor.ts` (Cape Obscure dans `filterShieldDustTargets`). Fix journal : `BattleLogFormatter` — `StatusBlocked` reason `HeldItem` → « L'objet de {X} le protège ! » (au lieu de « Rune Protect »).
- Gaps documentés (non bloquants) : Zone Magique (`magic-room`) ne supprime pas Pierrallégée/Poudre Vite/Cape Obscure/items-pièges (lecture `heldItemId` directe hors chemin `fieldGlobal`) ; heuristiques IA fines non ajoutées (objets passifs neutres pour l'IA).
- Reporté : e2e Playwright des 9 objets non couverts par le cahier existant (via `test-writer`).
- Gate CI local : vert (voir STATUS.md pour le détail des compteurs unit/intégration).
