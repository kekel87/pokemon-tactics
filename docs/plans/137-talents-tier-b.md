# Plan 137 — Talents Tier B (batch 14 talents)

> **Statut** : `implémenté`
> **Branche/worktree** : `talents` (port 5183)
> **Scope** : 14 talents Gen 1 manquants, les plus autonomes après le Tier A. 64→78 talents.

## Contexte

64 talents implémentés (Tier A clos, plan 136). 50 restants (univers = 114 talents portés par ≥1 des 151 Gen 1). On attaque le « Tier B » : les plus cheap, mirror de patterns existants, risque moteur quasi nul.

Capacités moteur confirmées (recon) :
- **Météo** = Sun / Rain / Sandstorm / **Snow** (la Neige est posable par un move → talents Neige ont un trigger).
- **Flinch** câblé (`StatusType.Flinch`, `processFlinch`). Le stub `inner-focus` (« pas de flinch ») est **obsolète**.
- **Piégeage** câblé (`StatusType.Trapped`).
- Champs déclaratifs existants sur `AbilityHandler` : `weatherSpeedBoost`, `weatherEvasionBoost`, `weatherAutoSetter` (ce dernier **non câblé** → à wirer).

## Les 14 talents

### G1 — blockers + miroirs météo (déclaratif / hooks existants)
| FR | id | Hook / champ | Effet | Porteurs |
|----|-----|------|-------|----------|
| Cœur de Coq | big-pecks | `onStatChangeBlocked` | bloque baisses de Défense (miroir hyper-cutter) | Roucool/Roucoups/Roucarnage |
| Lumiattirance | illuminate | `onStatChangeBlocked` | bloque baisses de Précision (miroir keen-eye) | Stari, Staross |
| Vaccin | immunity | `onStatusBlocked` | immunité Poison + Poison Grave | Ronflex |
| Baigne Sable | sand-rush | `weatherSpeedBoost` | ×2 vitesse (CT) en Tempête de Sable | Sabelette, Sablaireau |
| Rideau Neige | snow-cloak | `weatherEvasionBoost` | +1 esquive sous Neige (miroir sand-veil) | Artikodin |
| Phobique | rattled | `onAfterDamageReceived` | +1 Vitesse si touché par Ténèbres/Spectre/Insecte | Magicarpe |

> **Force Sable (sand-force) reporté Tier C** : nécessite la valeur `Weather` dans `DamageModifyContext` (le calc ne reçoit que des multiplicateurs météo pré-calculés). Threadé une fois en Tier C avec solar-power/leaf-guard/overcoat. Remplacé ici par Phobique.

### G2 — fin de tour (`onEndTurn`, gated météo/statut)
| FR | id | Effet | Porteurs |
|----|-----|-------|----------|
| Mue | shed-skin | 33% soigne le statut majeur en fin de tour | Chrysacier, Coconfort, Abo, Arbok |
| Hydratation | hydration | soigne le statut majeur si Pluie | Otaria/Lamantine, Lokhlass, Aquali |
| Cuvette | rain-dish | soin `ceil(maxHp/16)` si Pluie | Carapuce line, Tentacool |
| Corps Gel | ice-body | soin `ceil(maxHp/16)` si Neige | Otaria, Lamantine |

### G3 — réactif dégâts
| FR | id | Hook | Effet | Porteurs |
|----|-----|------|-------|----------|
| Écaille Spéciale | marvel-scale | `onDamageModify` (défenseur) | dégâts physiques reçus ÷1.5 si statut majeur | Minidraco, Draco |
| Cœur Noble | justified | `onAfterDamageReceived` | +1 Attaque si touché par un move Ténèbres | Caninos, Arcanin |

### G4 — entrée + flinch
| FR | id | Mécanisme | Effet | Porteurs |
|----|-----|-----------|-------|----------|
| Sécheresse | drought | `weatherAutoSetter` (à câbler) | invoque le Soleil 5 tours à l'entrée | Goupix, Feunard |
| Impassible | steadfast | `onFlinch` (nouveau hook) | +1 Vitesse quand le porteur flinch | Machoc line, Insécateur |

## Changements moteur (3, isolés)

1. **`AbilityEndTurnContext` += `random: () => number`** — threadé depuis `this.random` aux 2 call-sites `onEndTurn` de `BattleEngine` (l.2430, l.2904). Requis par Mue (33%).
2. **Câblage `weatherAutoSetter`** — dans `triggerBattleStart()` : pour chaque ability avec `weatherAutoSetter`, `setWeather(state, weather, turns, pokemonId)` + push events. Requis par Sécheresse.
3. **Nouveau hook `onFlinch?: (ctx: AbilityFlinchContext) => BattleEvent[]`** + `AbilityFlinchContext { self, state }` ; invoqué dans `processFlinch` après pose de `flinchedThisTurn`. Requis par Impassible.

Tout le reste = handlers data purs (hooks/champs existants).

## Émission d'événements
- Blockers (big-pecks/illuminate/immunity) : `AbilityActivated` quand `blocked === true` (convention plan 136).
- shed-skin/hydration : `AbilityActivated` + `StatusRemoved` quand soin réel.
- rain-dish/ice-body : `AbilityActivated` + `HpRestored` (miroir regenerator).
- marvel-scale : `onDamageModify` silencieux (convention multiplier).
- justified/rattled/steadfast/anger-point-like : `AbilityActivated` + `StatChanged`.
- drought : events `setWeather`.

## Tests (test-first par mécanique)
`packages/core/src/battle/abilities.integration.test.ts` — 1 bloc par talent : effet gameplay + émission `AbilityActivated` quand visible.

## Exclus (hors batch)
- Brise Moule + Gaz Inhibiteur (refacto transverse → plan séparé).
- Imposteur (transform complet → plan séparé).
- Ramassage / Fuite (pas d'overworld/combat sauvage).
- Glu / Délestage (pas de vol d'objet).
- Info-pure (Fouille/Prédiction/Anticipation/Tension) — jeu = info complète, valeur ~nulle. À revoir si masquage d'info pour le multi en ligne.
- Reste (~23) → Tier C.
