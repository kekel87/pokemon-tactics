# Plan 084 — Système Météo (Gen 9 + Pokemon Champions) — Phase 4

> Statut : done (livré plans 084 + 084b — validé visuellement 2026-05-13)
> Phase : 4
> Créé : 2026-05-12
> Mis à jour : 2026-05-13

## Avancement session 2026-05-13

**Implémenté** :
- Étape 1 : 76 tests scénario écrits (test-writer)
- Étape 2 : enum Weather + BattleState weather/turns/setter/lastTickRound + chargingMove sur PokemonInstance + 5 nouveaux BattleEvent + champs MoveDefinition/AbilityHandler
- Étape 3 : weather-tick-handler enregistré priority 150 (avant items 400), decrement par round
- Étape 4 : BP modifier Fire/Water Sun/Rain, accuracy override Thunder/Hurricane/Blizzard via table, defense weather boost Rock SpDef Sand + Ice Def Snow, Freeze blocked Sun
- Étape 5 : 6 setter moves (sunny-day/rain-dance/sandstorm/snowscape/weather-ball/solar-beam) + Synthesis modifier météo (None 50%, Sun 2/3, Rain/Sand/Snow 25%) + thunder/hurricane/blizzard accuracy overrides
- Étape 7 : abilities chlorophyll/swift-swim/sand-veil/cloud-nine déclaratifs (weatherSpeedBoost/weatherEvasionBoost/suppressesWeatherEffects) intégrés via getEffectiveInitiative + checkAccuracy
- Étape 8 : applyWeatherWar (slowest setter wins) + handle-set-weather flow
- Étape 9 : heat-rock item extension 5→8 turns (logique dans handle-set-weather)

**Différé en 084b** :
- Étape 6/6.5 : Solar-Beam chargingMove flow complet (T1 charge + mouv libre, T2 retarget + mouv + tir, KO interrupt, Sun-instant, AI Sun-gated) — gros pattern d'action queue
- Étape 7 finitions : AbilityActivated events émis lors weather boost activation
- Étape 10 : Renderer WeatherOverlay tint + WeatherHud HUD avec icônes PixelLab (déjà générées dans `packages/renderer/public/assets/ui/weather/`) + i18n
- Étape 11 : op-sets:analyze post-impl
- Étape 12 : Gate CI + commit (humain)

**État tests** : 1486/1496 PASS (99.3%). 10 fails restants : 5 Solar-Beam + 3 AbilityActivated events + 1 heat-rock movepool + 1 hook order.
**Typecheck monorepo** : ✓
**Lint fichiers modifiés** : ✓
**Build** : ✓

---


## Objectif

Implémenter le **système Météo Gen 9 / Pokemon Champions** (Soleil/Pluie/Sable/**Neige**) avec :
- 4 setter moves (sunny-day, rain-dance, sandstorm, snowscape)
- 1 variable move (`weather-ball`)
- 1 charge move adapté (`solar-beam` : 1 turn en Sun, 2 turns + ÷2 BP hors Sun)
- BP modifiers Fire/Water/Solar-Beam selon météo
- Precision modifiers (Thunder/Hurricane/Blizzard)
- Boosts stat passifs (+50% SpDef Rock en Sand, +50% Def Ice en Snow)
- Activation passive abilities `chlorophyll` / `swift-swim` / `sand-veil` (stubs Batch C/E)
- Hooks pour abilities auto-setter (drought/drizzle/sand-stream/snow-warning) — anticipation Gen 2+
- Mécanique weather war (setter le plus lent gagne en cas collision)
- 1 item d'extension (`heat-rock`)
- UI : indicateur HUD top-center sous timeline + tint global subtle

Cible : débloquer les 4 sets `partial` plan 082 liés météo (heat-rock, weather-ball ×2, solar-beam) → **100% sets `full`** post-impl.

---

## Note d'introduction

**Référence canon Gen 9 / Pokemon Champions** (avril 2026). Snow remplace Hail (changement Gen 9 majeur). Durée 5 turns par défaut, 8 turns avec rock items (Showdown standard, confirmé Champions).

**Abilities auto-setter** (drought, drizzle, sand-stream, snow-warning) : pas dans roster Gen 1 actuel, mais **on prépare l'infrastructure** (hook `onSwitchIn`, intégration weather war) pour Gen 2+ futures batches (Tyranitar, Politoed, etc.).

Les **3 météos primal** (Desolate Land, Primordial Sea, Delta Stream) sont **hors scope** — réservées aux Mega Legendaries absents du roster.

---

## Table effets météo (canon Gen 9 / Champions)

### Sun (Harsh Sunlight)
| Effet | Valeur |
|---|---|
| Fire moves | ×1.5 BP |
| Water moves | ×0.5 BP |
| Thunder / Hurricane | accuracy 50% |
| Solar-Beam | charge 1 turn (vs 2) |
| **Freeze status** | **impossible d'être gelé en Sun** (blocking statusApply si target sous Sun) |
| Damage résiduel | aucun |
| Abilities activées | chlorophyll (×2 Spd) |
| Setter | sunny-day, drought ability |

### Rain
| Effet | Valeur |
|---|---|
| Water moves | ×1.5 BP |
| Fire moves | ×0.5 BP |
| Thunder / Hurricane | accuracy 100% |
| Solar-Beam | ÷2 BP |
| Damage résiduel | aucun |
| Abilities activées | swift-swim (×2 Spd) |
| Setter | rain-dance, drizzle ability |

### Sandstorm
| Effet | Valeur |
|---|---|
| Move BP | aucun boost |
| Damage résiduel | 1/16 HP/turn |
| Immunités damage | Rock, Ground, Steel |
| SpDef Rock-types | **+50%** |
| Solar-Beam | ÷2 BP |
| Abilities activées | sand-veil (+1 stage évasion) |
| Setter | sandstorm move, sand-stream ability |

### Snow (Gen 9+ remplace Hail)
| Effet | Valeur |
|---|---|
| Move BP | aucun boost |
| Damage résiduel | **aucun** (différence vs Hail) |
| Def Ice-types | **+50%** |
| Blizzard | accuracy 100% |
| Solar-Beam | ÷2 BP |
| Weather-Ball | type Ice + ×2 BP |
| Abilities activées | (Gen 2+ : slush-rush, ice-body, snow-cloak) |
| Setter | snowscape move, snow-warning ability |

---

## Architecture core

### `packages/core/src/enums/weather.ts` (nouveau)
```ts
export const Weather = {
  None: "none",
  Sun: "sun",
  Rain: "rain",
  Sandstorm: "sandstorm",
  Snow: "snow",
} as const;
export type Weather = (typeof Weather)[keyof typeof Weather];
```

### `packages/core/src/types/battle-state.ts` (modifié)
```ts
weather: Weather;            // default None
weatherTurnsRemaining: number; // 0 si None
weatherSetterPokemonId?: string; // pour debug + future "extended by item ?" check
```

### `packages/core/src/battle/weather-system.ts` (nouveau)
Functions exposées :
- `setWeather(state, weather, turns, setterPokemonId?)` — applique météo + emit `WeatherSet`
- `tickWeatherEndTurn(state)` — décrement, clear si 0, applique damage résiduel
- `getWeatherBpModifier(moveType, weather): number` — Fire ×1.5 Sun, Water ×0.5 Sun, etc.
- `getWeatherAccuracyOverride(moveId, weather): number | undefined` — Thunder/Hurricane/Blizzard
- `getWeatherDefenseStatBoost(pokemonTypes, stat, weather): number` — Rock SpDef en Sand, Ice Def en Snow
- `isWeatherDamageImmune(pokemonTypes, weather): boolean` — Rock/Steel/Ground vs Sand
- `applyWeatherWar(state, newWeather, newSetterSpeed, currentSetterSpeed): boolean` — slowest wins

### `packages/core/src/enums/battle-event-type.ts` (modifié)
- `WeatherSet` (weather, turns, setterPokemonId)
- `WeatherCleared`
- `WeatherDamage` (pokemonId, amount, weather)
- `WeatherWar` (previousWeather, newWeather, winnerPokemonId) — debug

### `packages/core/src/types/move-definition.ts` (modifié)
```ts
weatherSetter?: { type: Weather; turns: number };
weatherBoostedType?: boolean;     // weather-ball
twoTurnCharge?: boolean;          // solar-beam
weatherAccuracyOverride?: { weather: Weather; accuracy: number }[]; // Thunder, etc.
weatherBpOverride?: { weather: Weather; multiplier: number }[];
```

### `packages/core/src/types/ability-definition.ts` (modifié)
```ts
weatherSpeedBoost?: { weather: Weather; multiplier: number };  // chlorophyll/swift-swim
weatherEvasionBoost?: { weather: Weather; stages: number };    // sand-veil
weatherAutoSetter?: { weather: Weather; turns: number };       // drought/drizzle/sand-stream/snow-warning
```

### `packages/core/src/types/pokemon-instance.ts` (modifié)
```ts
chargingMove?: { moveId: string; targetPosition?: Position }; // solar-beam state
```

### `packages/core/src/battle/effect-processor.ts` (modifié)
- Pré-damage : `bp = base_bp * getWeatherBpModifier(move.type, state.weather)`
- weather-ball : type = type-of-weather, BP doublé si météo active
- solar-beam : skip charge si state.weather === Sun, sinon emit `MoveCharging` puis attack tour suivant
- Accuracy override : `Thunder`, `Hurricane`, `Blizzard`, `Solar-Beam` adjustments
- Stat boosts : injectés dans calculs Defense/SpDefense

### `packages/core/src/battle/BattleEngine.ts` (modifié)
- `processEndTurn` : `tickWeatherEndTurn` AVANT items/abilities end-turn (canon)
- `computeSpeedStat` : applique `weatherSpeedBoost` si active
- `processSwitchIn` (ou équivalent placement initial) : invoke `weatherAutoSetter` ability hook → weather war check

---

## Architecture data

### `packages/data/src/overrides/tactical.ts`
6 nouveaux moves :
- `sunny-day` (Feu Statut, set Sun 5)
- `rain-dance` (Eau Statut, set Rain 5)
- `sandstorm` (Roche Statut, set Sandstorm 5)
- `snowscape` (Glace Statut, set Snow 5) — remplace `hail` plan original
- `weather-ball` (Normal Spé 50 BP, type+BP dynamic)
- `solar-beam` (Plante Spé 120 BP, twoTurnCharge instant en Sun)

Move accuracy overrides (existants modifiés) :
- `thunder` (50% Sun, 100% Rain)
- `hurricane` (50% Sun, 100% Rain) — si dans roster
- `blizzard` (100% Snow)

### `packages/data/src/items/item-definitions.ts`
1 nouvel item :
- `heat-rock` — extend Sun 5→8 turns à la pose (hook `onWeatherSet` ou check dans `setWeather`)

### `packages/data/src/abilities/ability-definitions.ts`
3 abilities existantes (stubs) → activer mécanique :
- `chlorophyll` (×2 Speed en Sun)
- `swift-swim` (×2 Speed en Rain)
- `sand-veil` (+1 stage évasion en Sandstorm)

Infrastructure prête pour Gen 2+ (pas implémenté ici) :
- `drought`, `drizzle`, `sand-stream`, `snow-warning` (auto-setters via `weatherAutoSetter`)

---

## Architecture renderer

### `packages/renderer/src/battle/scene/WeatherOverlay.ts` (nouveau)
- **Tint global subtle** : alpha 0.15
  - Sun : `0xFFE680` (jaune chaud)
  - Rain : `0x6080A0` (bleu-gris)
  - Sandstorm : `0xC8A060` (ocre sable)
  - Snow : `0xE0F0FF` (blanc-bleu)
- Particules différées Phase 9 (Phaser ParticleEmitter)
- Transition fade-in 0.5s à `setWeather`, fade-out 0.5s à clear

### `packages/renderer/src/ui/WeatherHud.ts` (nouveau)
- Position : **top-center sous timeline d'initiative**
- Composant : icône météo (32×32 base, scale x2 pour HUD = 64×64) + label `[N tours]`
- Visible permanent quand weather !== None
- Cliquable → tooltip avec effets actifs (Fire ×1.5, etc.)
- Disparait quand weather clear (animation fade-out)

### Icônes météo (PixelLab AI)
- **Style** : pictogramme noir massif (silhouette épaisse, style emoji/icon mobile app). Ref user : 4 symboles météo noirs purs avec contre-formes internes blanches (cloud+rain, soleil+rayons, flocon étoile, tourbillon vent).
- **Format** : **64×64**, losange (rhombus) coloré uni **sans contour** + symbole météo **NOIR PUR MASSIF** centré (silhouette pictogramme, pas de contour, pas de blanc)
- **4 icônes** :
  - `weather-sun.png` — losange jaune doré `#FFC840` + soleil noir : cercle plein + 8 rayons triangulaires courts
  - `weather-rain.png` — losange bleu nuit `#3060A0` + nuage noir stylisé + 3 gouttes pluie noires sous
  - `weather-sandstorm.png` — losange ocre `#C8A060` + tourbillon vent noir : double cercle imbriqué + spirale (pictogramme wind canon)
  - `weather-snow.png` — losange bleu glace `#A0D0F0` + flocon noir 6 branches étoile
- **Emplacement** : `packages/renderer/public/assets/ui/weather/`
- **Pipeline** : génération via `mcp__pixellab__create_isometric_tile` ou équivalent → review humain → intégration HUD
- **Fallback** : si PixelLab indispo, placeholder Phaser Graphics (losange + emoji texte)

### `packages/renderer/src/ui/BattleLog.ts`
- 4 messages i18n :
  - `weather.set.<type>` (Le soleil brille intensément !)
  - `weather.cleared.<type>` (Le soleil s'estompe)
  - `weather.damage.<type>` (X est blessé par la tempête de sable)
  - `weather.war` (La météo est écrasée par Y)

### `packages/renderer/src/i18n/`
- 6 moves × {fr, en}
- 1 item × {fr, en}
- Messages weather (set/clear/damage/war) × {fr, en}
- Tooltip effets météo × {fr, en}

---

## Étapes d'exécution

### Étape 1 — Tests scénario météo (test-writer)
- Set Sun 5 turns → après 5 turns end-turn, weather = None, event `WeatherCleared`
- Heat-rock extension : set Sun avec porteur heat-rock → turns = 8
- Sandstorm damage : tous non-(Rock/Steel/Ground) reçoivent 1/16 HP/turn
- Snow damage : aucun damage (différence vs Hail)
- Fire BP en Sun : Flamethrower 90 → 135 effective BP
- Solar-Beam ÷2 BP hors Sun, ×1 BP en Sun, charge 1 turn en Sun
- Thunder accuracy : 50% Sun, 100% Rain, 70% (base) None
- Blizzard accuracy : 100% Snow
- SpDef Rock +50% en Sandstorm
- Def Ice +50% en Snow
- Chlorophyll active : Venusaur speed ×2 en Sun
- Sand-veil : +1 évasion stage en Sandstorm
- Swift-swim : ×2 speed en Rain
- Weather-ball : Sun → Fire 100, Rain → Water 100, Sand → Rock 100, Snow → Ice 100, None → Normal 50
- Weather war : 2 setters dans le même round (2 ticks CT consécutifs sans clear), le plus lent setter prend
- **Solar-Beam** : T1 charge → KO caster pendant gap → cancel propre (pas de tir T2)
- **Solar-Beam** : T1 Sun → tir instant (pas de charge stockée)
- **Solar-Beam** : T1 charge + mouvement T1, T2 mouvement + re-target depuis nouvelle position
- **Solar-Beam** : weather change Sun→Rain entre T1/T2 → BP ÷2 au tir T2
- **Solar-Beam** : Sleep apply pendant charge → release différé jusqu'au réveil, charge persiste
- **Synthesis** : 1/2 HP None, 2/3 HP Sun, 1/4 HP Rain/Sand/Snow
- **Cloud Nine (Golduck)** : annule effets météo globaux tant que Golduck est en jeu (BP modifiers, accuracy, damage, stat boosts, abilities weather-activated). N'efface pas le state weather, masque seulement les effets.
- Sandstorm/Snow immunités : Pokemon dual-type avec un type immune → OR logique (Onix Roche/Sol = double-immune Sandstorm)

### Étape 2 — Core enum + state (test-first)
- Tests `weather-system.test.ts` (functions pures)
- `enums/weather.ts`, `weather-system.ts`, MAJ `battle-state.ts` + `battle-event-type.ts`

### Étape 3 — End-turn weather tick
- Intégrer `tickWeatherEndTurn` dans `processEndTurn` AVANT items
- Tests damage résiduel + ordre + immunités (OR logique double-type)
- **Test hook order critique** : Sandstorm damage (weather tick) puis Leftovers heal (item) — ordre canon. Validation explicite que stat-lower items (white-herb plan 083) ne sont pas perturbés par weather damage qui ne touche pas stats.

### Étape 4 — BP + accuracy + stat modifiers + status guards
- `getWeatherBpModifier`, `getWeatherAccuracyOverride`, `getWeatherDefenseStatBoost`
- Intégration `effect-processor.ts` + `damage-calculator.ts`
- **Freeze guard en Sun** : `handle-status.ts` skip `Frozen` apply si `state.weather === Sun`, emit message
- Tests Fire/Water/Solar-Beam + Thunder/Hurricane/Blizzard + Rock SpDef + Ice Def + Freeze blocked Sun

### Étape 5 — 4 setter moves + weather-ball + Synthesis update
- Tests intégration par move
- `tactical.ts` entries (4 setters + weather-ball)
- **Synthesis modifier météo** : ajouter logique conditionnelle dans handler HealSelf ou move-specific
  - None : 50% HP (actuel)
  - Sun : 66% HP (2/3)
  - Rain/Sand/Snow : 25% HP (1/4)
  - Test scénario par météo

### Étape 6 — Solar-beam 2-turn charge (spécifié)
- Nouveau mécanisme `chargingMove` sur `PokemonInstance` : `{moveId: string}`
- **T1 (charge)** :
  - Action attaque consommée par Solar-Beam → set `chargingMove`, emit `MoveCharging`
  - Slot mouvement T1 reste utilisable (peut bouger après commit charge)
  - **Sun actif** : skip charge, fire T1 immediat (tile cible normale)
- **T2 (release)** :
  - Slot attaque verrouillé sur Solar-Beam (autres moves grisés)
  - User pick cible re-target dynamique au moment du tir
  - User peut bouger T2 avant tir (mouvement libre)
  - BP recalculé selon météo T2 (×1 Sun, ÷2 Rain/Sand/Snow)
  - Range check depuis position T2 (recalculé après mouvement)
- **Interrupt** : KO uniquement (canon Gen 3+). Sleep/Paralysis/Freeze persistent.
- **Cancel forcé** si Pokemon KO entre T1 et T2 → `chargingMove` cleared sans tir
- Test :
  - Sans Sun = charge T1 + attack T2
  - Avec Sun = attack T1 instant
  - T1 + bouge OK
  - T2 + bouge + tir OK
  - T2 cible obligatoire (UI bloque submit invalid)
  - KO pendant charge → cleared
  - Sleep pendant charge → fire OK quand awake
  - Weather change Sun→Rain entre T1/T2 → BP ÷2 au tir
- `tactical.ts` entry avec `twoTurnCharge: true`

### Étape 6.5 — Solar-beam UI/AI
- **Display charging** : texte flottant au-dessus sprite ("Charging" / "Concentre l'énergie solaire") + battle log message
- Pas de status icon HP bar, pas de sprite glow (MVP)
- **AI policy** : Solar-Beam autorisé **uniquement si `state.weather === Sun`** (instant). Hors Sun → AI exclut Solar-Beam du pool actions
- Test AI : Sun → considère Solar-Beam, Hors Sun → ne l'envisage pas

### Étape 7 — Abilities weather-activated + Cloud Nine
- Activer chlorophyll/swift-swim/sand-veil (passer de stubs à handlers réels)
- **Activer Cloud Nine (Golduck)** : ability annule effets météo tant que Pokemon en jeu
  - Hook : check `hasCloudNineActive(state)` dans `getWeatherBpModifier`, `getWeatherAccuracyOverride`, `getWeatherDefenseStatBoost`, weather damage, weather-activated abilities
  - State weather conservé (timer continue), seulement effets masqués
  - Activation : si au moins 1 Pokemon vivant avec Cloud Nine sur board (including ennemis)
- Tests speed boost + evasion + Cloud Nine masque tous effets

### Étape 8 — Weather war + auto-setter infrastructure
- `applyWeatherWar` function (slowest setter wins)
- Hook `weatherAutoSetter` au switch-in / placement initial
- Tests : 2 setters même tour → plus lent prend, conflit move vs ability

### Étape 9 — Heat-rock item
- Handler hook `onWeatherSet` (nouveau) ou check à la pose dans `setWeather`
- Test extension 5→8 turns

### Étape 10 — Renderer WeatherOverlay + WeatherHud + icônes + i18n
- **Gen icônes PixelLab** (asset-manager) :
  - 4 icônes 32×32 losange coloré + symbole météo (SW&SH style)
  - Couleurs : Sun `#FFC840`, Rain `#3060A0`, Sand `#C8A060`, Snow `#A0D0F0`
  - Dépôt `packages/renderer/public/assets/ui/weather/`
- Tint global subtle alpha 0.15 (Sun/Rain/Sand/Snow)
- HUD top-center sous timeline avec icône + turn counter
- Battle log messages
- Validation visuelle sandbox (4 météos + clear + war scenario)

### Étape 11 — Restauration op-sets.json complet
- `pnpm op-sets:analyze` post-084 → cible **100% `full`**
- MAJ `docs/op-sets-gap-analysis.md`

### Étape 12 — Gate CI + commit

---

## Critères d'acceptation

- [ ] 5 weathers : None (default), Sun, Rain, Sandstorm, **Snow** (pas Hail)
- [ ] Tick end-turn décrémente, clear à 0
- [ ] Sandstorm damage 1/16 sauf immunités (Rock/Steel/Ground)
- [ ] Snow : aucun damage (différence Gen 9 vs Hail)
- [ ] BP modifiers : Fire/Water Sun/Rain × {1.5, 0.5}, Solar-Beam ÷2 hors Sun
- [ ] Accuracy overrides : Thunder 50%/100%, Blizzard 100% Snow
- [ ] Stat boosts : SpDef Rock +50% Sand, Def Ice +50% Snow
- [ ] Freeze status bloqué en Sun (Blizzard/Ice Beam/Ice Punch/Tri-Attack effet annulé)
- [ ] 4 setter moves + 1 weather-ball + 1 solar-beam (charge)
- [ ] Heat-rock item étend durée 5→8
- [ ] chlorophyll/swift-swim/sand-veil mécanique active
- [ ] Infrastructure auto-setter abilities prête (hook, types)
- [ ] Cloud Nine (Golduck) annule effets météo board-wide
- [ ] Synthesis modifier météo intégré (None 50%, Sun 66%, autres 25%)
- [ ] Weather war : setter le plus lent prend si collision dans même round
- [ ] WeatherOverlay renderer (tint subtle alpha 0.15)
- [ ] WeatherHud (icône + turns) top-center sous timeline
- [ ] 4 icônes météo PixelLab générées (losange coloré + symbole, SW&SH style)
- [ ] op-sets.json 100% `full` post-impl
- [ ] Gate CI verte
- [ ] Validation visuelle sandbox : 4 weathers + 6 moves + 1 item + 3 abilities + war scenario

---

## Risques

- **Two-turn charge mécanique** : nouveau pattern. Risk casser tests existants si placeholder action mal intégré au CT system. Mitigation : pattern symétrique avec `recharge` (post-attack) — réutiliser flow `PokemonInstance.cannotAct` style.
- **Ordre end-turn** : weather tick AVANT items canon. Tests doivent vérifier.
- **Immunités weather damage** : Rock/Steel/Ground vs Sandstorm. Utiliser `types` du Pokemon.
- **Heat-rock à la pose vs équipement** : extension appliquée uniquement au moment du set Sun.
- **Weather war timing** : si 2 setters dans le même round (2 ticks CT consécutifs sans clear entre les deux), comparer speed des setters au moment du second set. Plus lent gagne. En CT classique, 1 acteur/tick → "même CT" impossible mécaniquement, on parle bien de "même round perçu" (set 1 → set 2 immédiat sans tour intermédiaire de l'autre joueur).
- **Stat boost Rock/Ice** : modificateur appliqué dans `getModifiedStat` (Defense/SpDefense) avant calcul damage. Pas un stat stage classique.
- **Tint renderer trop subtle** : alpha 0.15 peut être invisible. Validation visuelle obligatoire. Ajuster à 0.20 si besoin.
- **Accuracy override edge case** : Thunder/Hurricane existent-ils déjà dans roster ? Si oui, mettre à jour leur tactical.ts entry.
- **Solar-Beam T2 mobilité libre** : potentiellement trop flexible vs FFTA canon (où charge moves immobilisent T2). Marquer pour playtest. Si trop fort, lock position T2 dans plan futur.
- **Synthesis pre-existant** : déjà implémenté à 50% fix dans tactical.ts (Venusaur l'a). Ce plan ajoute le modifier météo. Risque casser tests existants Venusaur — vérifier.
- **Cloud Nine global vs holder-only** : canon Gen 9 = global tant que Cloud Nine présent. Notre impl suit canon (board-wide). Edge case : Golduck KO en cours de turn → effets météo se réactivent au tick suivant.

---

## Hors scope

- **Météos Primal** (Desolate Land, Primordial Sea, Delta Stream) — Mega Legendaries absents roster
- **Hail legacy** — remplacé par Snow Gen 9
- **Aurora Veil** — Snow buff Pokemon Ice avancé, différé
- **Auto-setter abilities Gen 2+** (drought/drizzle/sand-stream/snow-warning) — infrastructure prête mais activation différée au batch Gen 2+ (avec Tyranitar, Politoed, etc.)
- **Moves météo-dépendants secondaires** : Synthesis/Moonlight/Morning-Sun (×2/3 HP Sun) — pas dans roster MVP
- **Particules météo renderer** — différé Phase 9 (tint suffit MVP)
- **Damp Rock / Smooth Rock / Icy Rock** — pas dans op-sets actuels, seul Heat Rock requis

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | 5 turns durée + heat-rock 8 (canon Gen 3+) | Standard Showdown + Champions confirmé. |
| 2 | **Snow remplace Hail** (Gen 9+) | Standard actuel + Pokemon Champions confirmé. Pas de dégâts résiduels, buff Def Ice +50%. |
| 3 | Solar-beam 2-turn charge (placeholder action) | Fidelité Pokemon + pattern réutilisable (Sky Attack, Dig). T1 commit charge action + mouvement libre, T2 re-target dynamique + mouvement libre. Interrupt KO only. AI Sun-gated. Affichage texte flottant + battle log. |
| 4 | Weather-ball recalcule type à chaque execution | Fidelity canon. Coût négligeable. |
| 5 | **Tint subtle alpha 0.15** | MVP : feedback visuel sans écraser lisibilité sprites. PokeRogue-style. |
| 6 | **HUD top-center sous timeline** | Information globale battlefield, cohérent avec timeline initiative. Avantage UX vs Showdown (qui n'affiche pas turn counter). |
| 7 | Ordre end-turn : weather tick AVANT items | Canon Gen 5+. |
| 8 | **Stat boosts Rock/Ice inclus** | Mécanique canon Gen 9, simple mod stat dérivée. Impact équilibre roster. |
| 9 | **Weather war + auto-setter infrastructure** | Anticipation Gen 2+ (Tyranitar, Politoed) sans coût additionnel. Hook prêt. |
| 10 | Particules différées Phase 9 | Tint + HUD suffisent MVP. Particules = polish. |
| 11 | Snowscape (Gen 9 move) plutôt que Hail (legacy) | Cohérent avec Snow Gen 9. |
| 12 | **Cloud Nine activé dans plan 084** | Golduck a déjà l'ability assignée (stub). Stub Phase 4 = ce plan. Doit s'activer avec mécanique météo, sinon incohérent. |
| 13 | **Synthesis modifier météo ajouté** | Déjà implémenté 50% fix (Venusaur l'utilise). Canon Gen 9 = 50%/66%/25% selon météo. Ajout simple, cohérence canon. |
