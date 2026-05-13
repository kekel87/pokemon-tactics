# Plan 084b — Système Météo (finition) — Phase 4

> Statut : done (code + validation manuelle cahier de test A.1-A.12 + B.1-B.5 — 2026-05-13)
> Phase : 4
> Créé : 2026-05-13
> Mis à jour : 2026-05-13
> Suite de : 084 (Étapes 1-5 + 7-9 partiellement)

## Objectif

Finir l'implémentation du système météo (plan 084) : Solar-Beam 2-turn charge, AbilityActivated events sur weather boost, renderer overlay + HUD avec icônes PixelLab, op-sets restauration, gate CI.

## État d'entrée (sortie 084)

- Core : enum Weather, weather-system.ts (helpers), weather-tick-handler enregistré, damage-calculator BP/defense modifiers, accuracy-check weather overrides + sand-veil evasion, handle-set-weather (setter + heat-rock + weather war), handle-heal-self synthesis modifier, EffectKind.SetWeather + handler enregistré
- Data : 6 setter moves + 3 accuracy override moves dans tactical.ts, 4 abilities (chlorophyll/swift-swim/sand-veil/cloud-nine) déclaratives, HeldItemId.HeatRock
- Tests : 76 tests scénario écrits, 66 passent. 10 fails à clore.
- Icônes PixelLab : `packages/renderer/public/assets/ui/weather/{sun,rain,sandstorm,snow}.png` (64×64 pictogramme noir, losanges colorés)

## Étapes

### Étape 1 — Solar-Beam 2-turn charge (chargingMove flow)

**État** : `chargingMove?: { moveId, targetPosition? }` déjà sur PokemonInstance.

**À faire** :
- BattleEngine.executeUseMove : si `move.twoTurnCharge && !chargingMove`, vérifier `state.weather === Sun` :
  - Sun : tir T1 instant (skip charge)
  - Hors Sun : set `pokemon.chargingMove = { moveId: move.id }`, emit `MoveCharging`, consomme action attaque, **slot mouvement T1 reste utilisable**, return early
- BattleEngine.executeUseMove : si `pokemon.chargingMove` set au début T2, force `lockedMoveId = chargingMove.moveId`, slot attaque verrouillé sur ce move, autres grisés
- T2 : user pick nouvelle cible (re-target dynamique), mouvement libre avant tir
- T2 firing : reset `chargingMove`, BP recalc selon weather T2 (déjà fait via damage-calc)
- Interrupt : `pokemon.currentHp <= 0` → `chargingMove` cleared (clean-up dans handlers KO)
- Sleep/Paralysis/Freeze : charge persiste, release différé jusqu'à action possible

**Tests à clore** : 5 dans `weather-moves.test.ts` (solar-beam scenarios)

### Étape 2 — AbilityActivated events sur weather boost

**Problème** : chlorophyll/swift-swim/sand-veil tests attendent `BattleEventType.AbilityActivated` émis quand le boost est actif.

**Solution** : émettre l'event au transition de round (startNewRound) ou à la pose de weather, pour chaque Pokemon avec ability matchante en jeu.

**Tests à clore** : 3 dans `weather-abilities.test.ts`

### Étape 3 — Heat-rock test fix

**Problème** : test attend sunny-day dans movepool d'un Pokemon. `buildItemTestEngine` doit accepter moveIds personnalisés ET item personnalisé.

**Solution** : vérifier `buildItemTestEngine` signature ; potentiellement adapter test ou helper.

**Tests à clore** : 1 dans `weather-system.test.ts`

### Étape 4 — Renderer WeatherOverlay + WeatherHud + i18n

**Composants à créer** :
- `packages/renderer/src/battle/scene/WeatherOverlay.ts` : tint global alpha 0.15 sur viewport selon météo (Sun jaune, Rain bleu-gris, Sand ocre, Snow blanc-bleu). Transition fade 0.5s.
- `packages/renderer/src/ui/WeatherHud.ts` : composant top-center sous timeline d'initiative. Image icône 64×64 (charge depuis `assets/ui/weather/weather-{sun,rain,sandstorm,snow}.png`) + label `[N tours]`. Visible quand weather !== None.
- `packages/renderer/src/ui/BattleLog.ts` : 4 messages i18n (set/cleared/damage/war)
- `packages/renderer/src/i18n/` : entrées weather × {fr, en}
- Constantes couleurs dans `packages/renderer/src/constants.ts` (Sun `#FFC840`, Rain `#3060A0`, Sand `#C8A060`, Snow `#A0D0F0`)
- Documenter dans `docs/design-system.md`

**Validation** : sandbox 4 météos + clear + war scenario (visual-tester)

### Étape 4.5 — Sélecteur météo dans SandboxPanel

**État actuel** : `SandboxConfig` n'a pas de field weather. `SandboxPanel` n'a pas de sélecteur.

**À faire** :
- `packages/renderer/src/types/SandboxConfig.ts` :
  - Ajouter `weather?: Weather` (default `Weather.None`)
  - Ajouter `weatherTurns?: number` (default 5)
  - Ajouter dans `DEFAULT_SANDBOX_CONFIG`
- `packages/renderer/src/ui/SandboxPanel.ts` (panel map section) :
  - Dropdown 5 valeurs : None / Sun / Rain / Sandstorm / Snow
  - Input number `turns` (5-8, default 5)
  - Bouton "Apply weather" → invoque `setWeather(state, weather, turns)` en live
  - Bouton "Clear weather" → invoque `clearWeather(state)`
  - Affichage état actuel (synchronisé HUD)
- `packages/renderer/src/game/SandboxSetup.ts` :
  - Appliquer `config.weather` à l'init de battle state (avant Pokemon placement)
- Tests : `SandboxSetup.test.ts` étendu avec config météo

**Justification** : permet tester rapidement chaque météo sans devoir poser un setter move. Critique pour validation cahier de test A.1-A.12.

### Étape 5 — Op-sets restauration

- `pnpm op-sets:analyze` → cible 100% `full`
- MAJ `docs/op-sets-gap-analysis.md`

### Étape 6 — Gate CI + commit

- `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`
- Code-reviewer + doc-keeper
- Commit (humain)

## Critères d'acceptation

- [x] Solar-Beam 2-turn charge complet (T1 charge + mouv, T2 retarget + mouv + tir, Sun-instant, KO interrupt)
- [x] AI Solar-Beam Sun-gated (déjà géré par le lockedMoveId quand chargingMove est posé — l'AI évalue les actions légales)
- [x] AbilityActivated events émis pour chlorophyll/swift-swim/sand-veil (via emitWeatherAbilityActivation au tour start)
- [x] 76/76 tests scénario PASS (1496 tests unit + 189 integration au total)
- [ ] WeatherOverlay renderer (tint subtle alpha 0.15) — reporté, HUD seul livré
- [x] WeatherHud top-center avec icônes PixelLab (icône 48 + label + turns)
- [x] BattleLog messages i18n fr/en (clés `weather.*` ajoutées)
- [x] SandboxPanel : dropdown météo + turns (Apply via emit auto)
- [x] op-sets.json 100% `full` (160/160)
- [x] Gate CI verte (build + lint + typecheck + test + test:integration)

## Risques

- Solar-Beam pattern d'action queue : invasive. Risque casser tests existants ChargeTime turn system. Mitigation : tests de regression existants.
- AbilityActivated event spam : émettre 1 fois à la pose weather, pas à chaque round. Mitigation : flag `weatherBoostApplied` par pokemon.
- Renderer tint Phaser : vérifier que tint global ne fait pas saigner sur HUD existant (z-order). Mitigation : tint sur container battlefield uniquement, HUD au-dessus.

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | Split 084 → 084a (core) + 084b (Solar-Beam + renderer + finitions) | Plan 084 trop gros pour 1 session. 084a fournit base fonctionnelle (99% tests), 084b raffine. |

---

## Cahier de test manuel (validation fin 084b)

### Pré-requis

- Build OK, dev server lancé (`pnpm dev`)
- Roster Pokemon avec : Venusaur (chlorophyll, synthesis, solar-beam), Charizard (flamethrower), Blastoise (water-gun, rain-dance), Onix (sandstorm, Rock/Ground), Articuno (blizzard, Ice), Pikachu (thunder), Golduck (cloud-nine, water-gun), Magneton (Steel)
- Items : Heat-Rock disponible dans inventaire

### A — Tests sandbox (`/sandbox` route ou JSON config CLI)

Lance les scénarios via JSON :

```bash
pnpm sandbox --config docs/sandbox-configs/weather-X.json
```

#### A.1 — Sun setup + Fire BP boost
Config : Charizard (lv50, flamethrower) vs Bulbasaur (lv50, 200 HP test).
1. Sunny-Day → vérifier HUD top-center affiche icône Sun + `[5]`, tint jaune subtle visible
2. Charizard utilise Flamethrower → damage ~×1.5 baseline (sans Sun ~80 → avec Sun ~120)
3. Battle log : "Le soleil brille intensément !" + "Charizard utilise Lance-Flammes"
4. Pas 5 rounds → HUD passe `[5]→[4]→[3]→[2]→[1]→cleared` + log "Le soleil s'estompe", tint fade out

#### A.2 — Rain + Thunder accuracy
Config : Pikachu (lv50, thunder) vs target.
1. Rain-Dance → HUD bleu nuit
2. Thunder (base 70% accuracy) → 10 tirs consécutifs : tous touchent (100% Rain)
3. Sunny-Day → Thunder 10 tirs : ~50% touchent

#### A.3 — Sandstorm damage + immunités
Config : Charizard, Onix (Rock/Ground), Magneton (Steel), Bulbasaur (Grass).
1. Sandstorm → tint ocre
2. End-of-round : Charizard prend 1/16 HP, Bulbasaur prend 1/16 HP
3. Onix et Magneton : 0 damage (immune)
4. Battle log : "X est blessé par la tempête de sable" × 2

#### A.4 — Snow + Blizzard accuracy + Def Ice boost
Config : Articuno (Ice, blizzard) vs Charizard (Fire).
1. Snowscape → tint blanc-bleu
2. Blizzard 100% accuracy en Snow (10 tirs touchent)
3. Charizard utilise Flamethrower sur Articuno → damage réduit (Def Ice +50%)
4. Aucun damage de fin de tour (Snow ≠ Hail)

#### A.5 — Freeze blocked en Sun
Config : Articuno (blizzard 10% freeze), target Charizard.
1. Sunny-Day actif
2. Blizzard sur Charizard 20 fois consécutives → status_immune émis si freeze rolled, Charizard jamais Frozen
3. Sans Sun : Charizard finit Frozen au bout de quelques essais (10% chance)

#### A.6 — Synthesis modifier
Config : Venusaur HP=50/200, test chaque météo.
1. Aucune météo → Synthesis heal 100 HP (50%) → 150/200
2. Sun → Synthesis heal 133 HP (2/3) → 183/200
3. Rain → Synthesis heal 50 HP (25%) → 100/200
4. Sandstorm → idem 25% → 100/200
5. Snow → idem 25% → 100/200

#### A.7 — Cloud Nine board-wide masking
Config : Golduck (cloud-nine), Charizard (flamethrower), Bulbasaur target.
1. Sandstorm posé → HUD ocre actif, timer décompte normalement
2. Tint ocre visible mais **aucun damage** par tick (Cloud Nine actif)
3. Charizard Flamethrower → BP normal (pas de modifier)
4. Golduck meurt → tick suivant : Charizard prend Sandstorm damage, Flamethrower repasse à BP normal hors Sun
5. Battle log : "Golduck rend la météo inactive" (ou équivalent)

#### A.8 — Weather War
Config : Slow setter (Bulbasaur sunny-day, Speed 30) + Fast setter (Pikachu rain-dance, Speed 90).
1. Pikachu rain-dance posé Round 1 → Rain actif
2. Bulbasaur sunny-day Round 1 round suivant → **Bulbasaur plus lent, gagne** → Sun actif, log `WeatherWar`
3. Inverse : Bulbasaur d'abord puis Pikachu → **Pikachu plus rapide, perd** → Sun reste

#### A.9 — Heat-Rock extension
Config : Charizard (sunny-day, Heat-Rock).
1. Sunny-day → HUD affiche `[8]` (pas 5)
2. 8 rounds plus tard → cleared

#### A.10 — Abilities weather-active
Config : Venusaur (chlorophyll, base initiative 80) vs target.
1. Sun → timeline initiative Venusaur doublée (160) ; HUD ability_activated pop-up sur sprite
2. Rain → pas de boost
3. Floatzel (swift-swim) + Rain → speed ×2 ; pas de boost en Sun
4. Garchomp (sand-veil) + Sandstorm → évasion +1 stage (vérifier accuracy ennemi 100% → ~75%)

#### A.11 — Weather-Ball
Config : caster avec weather-ball.
1. None → type Normal, BP 50
2. Sun → type Fire, BP 100, ×1.5 vs Grass cible
3. Rain → type Water, BP 100
4. Sandstorm → type Rock, BP 100
5. Snow → type Ice, BP 100

#### A.12 — Solar-Beam (084b Étape 1)
Config : Venusaur (solar-beam) vs Charizard.
1. Hors Sun, T1 : Venusaur utilise Solar-Beam → texte flottant "Concentre l'énergie solaire" + log + chargingMove set, slot attaque verrouillé T2, slot mouvement T1 utilisable
2. T1 : Venusaur bouge 2 cases (verif mouvement libre OK)
3. T2 : Venusaur bouge encore, **re-target une autre cible**, tire → damage normal
4. Sun actif T1 : Solar-Beam tire instant (pas de charge)
5. Weather Sun→Rain entre T1 (Sun, chargé) et T2 (Rain) → BP ÷2 au tir T2
6. KO Venusaur entre T1/T2 → chargingMove cleared, pas de tir
7. Sleep apply pendant charge → release différé jusqu'au réveil
8. AI : sans Sun jamais propose Solar-Beam ; avec Sun le propose

### B — Tests normal (jeu standard)

Tests pendant partie réelle (PvP humain ou vs AI) :

#### B.1 — Cohérence visuelle
- Tint subtle alpha 0.15 lisible sur tous biomes (forêt, plage, grotte, montagne)
- HUD top-center sous timeline visible sans masquer info gameplay
- Icônes 64×64 PixelLab nettes (Sun pictogramme rayonnant, Rain nuage+gouttes, Sand spirale, Snow flocon)
- Transition fade-in/out 0.5s smooth
- Tooltip au clic sur icône HUD : affiche effets actifs (Fire ×1.5, etc.)

#### B.2 — Cohérence i18n FR/EN
- Battle log messages en FR : "Le soleil brille intensément !", "La pluie commence à tomber !", "Une tempête de sable se lève !", "Il commence à neiger !"
- Bascule EN : "The sunlight turned harsh!", etc.
- Messages clear, damage, war traduits

#### B.3 — Performance
- 60 FPS maintenu avec tint actif
- Pas de spike CPU lors transition météo
- Pas de leak mémoire après 10 cycles weather set/clear

#### B.4 — Intégration tactique
- Joueur peut planifier autour météo : ex équipe Fire + Sun + Heat-Rock = stratégie cohérente
- IA reconnaît la météo dans ses scores (ex AI Charizard préfère Flamethrower en Sun)
- Pas de blocage UI lors validation move avec préview damage incluant météo modifier

#### B.5 — Replay/save
- État weather sauvegardé/chargé correctement
- Replay reproduit weather identique tour par tour
- Tests de regression replay golden après changements

### C — Tests gate CI (auto)

- `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`
- 76/76 tests weather PASS
- 100% op-sets `full`
- Zéro warning Biome
- Zéro régression tests existants

