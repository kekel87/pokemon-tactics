# Plan 162 — Content-fill : 9 derniers moves apprenables Gen 1

**Statut : done** (2026-07-18)

## Objectif

Clore les 9 derniers moves *réellement faisables* apprenables par le roster Gen 1 (les autres non-impl sont écartés : Représailles/Frustration/Retour/Puissance Cachée/Téra Explosion, décisions #423/#581). Après ce plan, la couverture des moves Gen 1 est essentiellement complète.

**Recompté sur source 2026-07-18** (croisement `reference/*.json` + `tacticalOverrides` + handlers) : 503 moves implémentés, 14 apprenables non-impl dont 5 écartés → **9 faisables**.

## Les 9 moves (+ upgrade Stockage)

| FR | ID | Type/Cat | Mécanique | Learners Gen 1 |
|----|----|----|-----------|----------------|
| Relâche | `spit-up` | Normal Spé | dégâts spé = 100 × paliers Stockage, consomme | Abo/Arbok/Rondoudou/Grodoudou/Empiflor |
| Avale | `swallow` | Normal Statut | soin 25/50/100 % selon paliers, consomme | + Ronflex |
| Prio-Parade | `upper-hand` | Combat Phys 65 | fraîcheur d'action (réutilise `failsUnlessTargetAggressive`) + flinch 100 % | Pikachu/Raichu/Tartard/Kicklee/Tygnon/Mew |
| Piège de Venin | `venom-drench` | Poison Statut | baisse Atq/Atq.Spé/Vit **si cible empoisonnée** | lignées Nidoran + Nosferapti |
| Rayon Lune | `moonlight` | Fée Statut | soin météo-dépendant (core déjà câblé) | Mélofée/Mélodelfe/Mystherbe/Ortide/Rafflesia |
| Aurore | `morning-sun` | Normal Statut | soin météo-dépendant (core déjà câblé) | Arcanin |
| Partage Garde | `guard-split` | Psy Statut | moyenne Déf+Déf.Spé effectives lanceur↔cible (override brut fidèle) | Alakazam |
| Métalaser | `steel-beam` | Acier Spé 140 | dégâts + recul 50 % PV **max** (extension `Recoil.ofMaxHp`) | Magnéti/Magnéton/Mew |
| Grêle | `hail` | Glace Statut | pose Neige 5 t (clone `snowscape` ; notre Neige sans dégâts, cohérent Champions) | Krabby/…/Kabutops (11) |

**Prérequis** : Stockage (`stockpile`) est implémenté *simplifié* (juste +1 Déf/+1 Déf.Spé, pas de compteur). → Upgrade en vrai compteur 1-3 paliers.

## Décisions design (humain, 2026-07-18)

- **Prio-Parade** : pas de priorité canon dans le jeu (abandonnée plan 150) → condition « la cible s'apprête à lancer une attaque prioritaire » réinterprétée en **fraîcheur d'action** (comme Coup Bas, `failsUnlessTargetAggressive`). + flinch 100 %.
- **Partage Garde** : **override de stat brute fidèle** (miroir `speedStatOverride`) — Déf et Déf.Spé effectives des 2 mons fixées à leur moyenne, routées via `effectiveCombatStats`. Persiste fin de combat, reset KO, purgé par Morphing (manip écrase).
- **Grêle** : pose Neige (Champions-aligné, notre Neige ne fait pas de dégâts ; ≡ `snowscape` mécaniquement, deux moves météo-Glace historiques).

## Infra core

- **PokemonInstance** : `stockpileCount?` (0-3), `defenseStatOverride?`, `spDefenseStatOverride?`.
- **effectiveCombatStats** : respecte def/spdef overrides (nouvel objet si présents).
- **MoveDefinition** : `failsWithoutStockpile?` (guard fizzle spit-up/swallow, miroir `failsUnlessTargetAggressive`).
- **Effect (Recoil)** : `ofMaxHp?: boolean` → recul = ⌊maxHp × fraction⌋ au lieu de dégâts infligés.
- **DynamicPowerKind** : `StockpileLayers` → 100 × `stockpileCount`.
- **EffectKind** nouveaux : `Stockpile` (incrément + Déf/Déf.Spé +1, cap 3), `SwallowHeal` (soin par paliers), `ConsumeStockpile` (reset + baisse Déf/Déf.Spé), `VenomDrench`, `GuardSplit`.
- **Événements** : `Stockpiled { pokemonId, count }`, `StockpileReleased { pokemonId }`, `GuardSplit { casterId, targetId, defense, spDefense }`. Reste = réutilise StatChanged/HpRestored/MoveFailed.
- **BattleEngine** : reset des 3 champs au KO ; `apply-transform` purge les overrides au cast.

## Renderer / i18n

- Noms FR déjà présents dans `moves.fr.json` (les 9). ✔
- InfoPanel : badge volatile « Stockage {n} » quand `stockpileCount > 0`.
- BattleLogFormatter : lignes FR/EN pour `Stockpiled`/`StockpileReleased`/`GuardSplit`.
- animation-category : mapper les nouveaux ids.

## Tests

- Unit par move : `moves/{spit-up,swallow,upper-hand,venom-drench,moonlight,morning-sun,guard-split,steel-beam,hail}.test.ts`.
- Intégration : cycle Stockage→Relâche/Avale (paliers, consume, undo stats), Partage Garde (moyenne + reset KO), Métalaser recul %maxHP (+ auto-KO possible), Piège de Venin (fail si non-empoisonné).
- Gate CI complet avant commit.

## Reporté

- e2e Playwright des 9 moves (via `test-writer`, non bloquant).
- OP sets emblématiques éventuels (data-miner) si pertinents — plusieurs learners iconiques (Alakazam/Ronflex/Arcanin/Mew).
