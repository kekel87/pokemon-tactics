---
status: done
created: 2026-04-15
updated: 2026-04-15
---

# Plan 055 — Bug gatling — 5 bugs + cleanup STATUS

## Objectif

Corriger 5 bugs identifiés lors du playtest du 2026-04-15, régénérer les assets tileset affectés, et nettoyer STATUS.md des deux faux "bugs CT" qui n'en sont pas.

## Contexte

Le plan 054 (système CT) vient d'être livré. Un playtest a révélé plusieurs régressions et bugs préexistants. Une investigation approfondie dans la session a séparé les vrais bugs des fausses alertes. STATUS.md liste 2 "bugs CT" qui décrivent en réalité soit un comportement correct, soit le bug KO idle déjà listé — ils doivent être supprimés.

## Étapes

- [x] Étape 1 — Immunité poison par type (Fantominus)
  - Fichier : `packages/core/src/battle/handlers/handle-status.ts`
  - Ajouter helper `isImmuneToStatusByType(types, status)` avec les immunités officielles :
    - `Poisoned` / `BadlyPoisoned` → types `Poison`, `Steel`
    - `Paralyzed` → type `Electric`
    - `Burned` → type `Fire`
    - `Frozen` → type `Ice`
  - Appliquer ce check avant la règle "un seul statut majeur" (ligne 54-57)
  - Pour les statuts volatils (Confused, Seeded, Trapped) : garder la logique Seeded actuelle (Grass immune), pas d'autre changement
  - Ajouter cas unitaires dans `handle-status.test.ts` pour chaque paire type/statut
  - Ajouter un test scénario sur Fantominus vs Toxic

- [x] Étape 2 — Handler TerrainStatusApplied (icône manquante)
  - Fichiers : `packages/renderer/src/game/GameController.ts` + `packages/renderer/src/ui/BattleLogFormatter.ts`
  - Le core émet `TerrainStatusApplied` (swamp→Poisoned, magma→Burned) mais aucun handler renderer ne réagit → l'icône de statut n'apparaît pas en live au-dessus du sprite
  - Ajouter dans le switch `handleEvent` de GameController :
    ```typescript
    case BattleEventType.TerrainStatusApplied: {
      const sprite = this.sprites.get(event.pokemonId);
      const pokemon = this.state.pokemon.get(event.pokemonId);
      if (sprite && pokemon) {
        sprite.updateStatus(pokemon.statusEffects);
        sprite.setStatusAnimation(event.status === StatusType.Asleep);
      }
      this.updateInfoPanelForActivePokemon();
      break;
    }
    ```
  - Ajouter un cas dans `BattleLogFormatter.ts` — clés i18n `battle.log.terrainStatusApplied`
    - FR : "X est empoisonné par le marais" / "X est brûlé par le magma"
    - EN : "X is poisoned by the swamp" / "X is burned by the magma"
  - Ajouter un test dans `BattleLogFormatter.test.ts` pour TerrainStatusApplied (poison, burn)

- [x] Étape 3 — Pokemon KO anime idle
  - Fichier : `packages/renderer/src/sprites/PokemonSprite.ts`
  - `playFaintAndStay` ne pose aucun flag "isKnockedOut" : plusieurs event handlers dans GameController appellent `setDirection`, `flashDamage`, `setStatusAnimation`, `setConfusionWobble` sur des Pokemon KO — relançant Idle via `playAnimation` ou le callback ANIMATION_COMPLETE dans `playAnimationOnce`
  - Ajouter `private isKnockedOut = false` dans la classe
  - Poser `this.isKnockedOut = true` dans `playFaintAndStay` avant tout autre traitement
  - Early-return dans : `setDirection`, `playAnimation`, `playAnimationOnce`, `playAttackAnimation`, `flashDamage`, `setStatusAnimation`, `setConfusionWobble` (quand `active = true`)
  - Vérification manuelle via sandbox (pas de test automatisé renderer)

- [x] Étape 4 — Overlay preview dégâts HP bar — **résolu**. Root cause : `HP_BAR_HEIGHT = 2` et le code faisait `HP_BAR_HEIGHT - 2 = 0` → fillRect invisible. Fix : suppression des insets (edge-to-edge alignement avec `hpBarFill`), Graphics persistant enfant du container, alphas bumpés à 0.55/0.85 pour contraste sur HP bar colorée.
  - Fichier : `packages/renderer/src/sprites/PokemonSprite.ts` (méthode `showDamageEstimate`, environ ligne 522-569)
  - Le rectangle noir semi-transparent (50 % alpha garanti / 30 % possible) ne s'affiche plus ; le texte min-max fonctionne avec la même logique
  - Diagnostic à mener pendant l'exécution :
    1. Lancer `visual-tester` avec preview dégâts actif + screenshot comparaison avant/après
    2. Vérifier l'ordre de rendu Phaser 4 : `scene.add.graphics()` hors container vs enfants container, interaction avec `container.depth` dynamique (updatePosition, playAttackAnimation)
    3. Fix probable : ajouter le Graphics comme enfant du container (propre, hérite du transform), ou forcer `setDepth` à chaque update
  - Étape avec diagnostic live — le fix exact se détermine à l'exécution

- [x] Étape 5 — Stagger automatique des textes flottants
  - Fichiers : `packages/renderer/src/ui/BattleText.ts` + `packages/renderer/src/game/GameController.ts`
  - `BATTLE_TEXT_STAGGER_Y = -10` existe mais n'est appliqué manuellement qu'aux 4 textes d'efficacité. Plusieurs `showBattleText` simultanés sur le même Pokemon (Double-Pied 2 coups, burn tick + magma DOT) se chevauchent à la même position Y
  - Transformer `showBattleText` pour accepter un `targetId?: string` optionnel et maintenir un `Map<targetId, activeCount>` module-scope :
    - Si `targetId` présent : `offsetY += BATTLE_TEXT_STAGGER_Y * (count++)` puis décrémente dans le `onComplete` du tween
    - Supprimer l'entrée du map quand count = 0
  - Les 4 appels existants avec `offsetY: BATTLE_TEXT_STAGGER_Y` continuent de fonctionner (cumul) ou sont migrés vers le nouveau mécanisme
  - Passer `targetId: event.pokemonId` (ou `event.targetId`) sur tous les `showBattleText` pertinents dans GameController (damage, fall, terrain damage, impact, immune, miss, etc.)
  - Ajouter un test unitaire dans `BattleText.test.ts` : plusieurs appels successifs sur le même targetId produisent des offsetY croissants

- [x] Étape 6 — Flanc flipé pentes et escaliers
  - Fichier : `scripts/make-iso-tile.py` + regénération `packages/renderer/public/assets/tilesets/terrain/tileset.png`
  - `LEFT_BRIGHTNESS = 0.75` et `RIGHT_BRIGHTNESS = 0.55` simulent un éclairage SE. Les variantes "E" des pentes/escaliers utilisent `sprite.setFlipX(true)` → flip inverse l'ombrage → raccord visible avec tiles adjacentes non-flipées
  - Fix MVP retenu : uniformiser les deux flancs à `LEFT_BRIGHTNESS = RIGHT_BRIGHTNESS = 0.65` (plus plat, pas de raccord cassé)
  - Alternative rejetée : 4 variantes par orientation — trop coûteux pour un bug visuel mineur
  - Exécution :
    1. Modifier les constantes dans `scripts/make-iso-tile.py`
    2. Relancer le pipeline de construction du tileset (voir `scripts/README.md`)
    3. Vérifier visuellement dans `test-arena.tmj` et maps sandbox avec dénivelés

- [x] Étape 7 — Nettoyage STATUS.md (bugs fantômes)
  - Fichier : `STATUS.md` (section "Bugs CT à corriger", lignes ~787-789)
  - Supprimer les 2 bullets :
    - "KO idle : un Pokemon qui tombe en dessous du seuil CT..." — paraphrase confuse du bug KO idle anim (étape 3), pas un bug CT distinct (`onPokemonKO` et `advanceTurnCt` sont propres)
    - "Poison immunité : le terrain swamp n'applique pas le Poison..." — comportement correct (règle un-seul-statut-majeur + isTerrainImmune pour Poison-type). Le vrai bug est l'icône manquante (étape 2)
  - Vérifier `docs/backlog.md` : ajouter le bug icône TerrainStatusApplied si absent, mettre à jour sinon

- [x] Étape 8 — Documenter les décisions
  - Fichier : `docs/decisions.md`
  - Ajouter décision #257+ : immunités de statut par type suivent les règles Pokemon officielles (Poison/Steel → Poisoned/BadlyPoisoned, Electric → Paralyzed, Fire → Burned, Ice → Frozen)
  - Ajouter décision suivante : ombrage flancs uniformisé à 0.65 pour MVP (option A retenue — éviter le raccord cassé au flipX sans régénérer 4x plus de variants)

## Livraison

**Un seul commit final** regroupant tous les fichiers modifiés (core, renderer, scripts, assets regénérés, docs). Message suggéré :

```
fix(core,renderer,assets): bug gatling — type status immunity, terrain icon, KO anim, HP preview, text stagger, tile shading (plan 055)
```

## Critères de complétion

- `pnpm test` passe (nouveaux cas dans `handle-status.test.ts`, `BattleLogFormatter.test.ts`, `BattleText.test.ts`)
- `pnpm build` + `pnpm lint` + `pnpm typecheck` clean
- Fantominus ne se fait plus empoisonner par Toxic
- L'icône de statut apparaît en live sur TerrainStatusApplied
- Aucun Pokemon KO ne relance son animation idle
- Le rectangle de preview dégâts est visible sur la HP bar
- Les textes flottants simultanés sur un même Pokemon sont décalés verticalement
- Les pentes/escaliers flipés n'ont plus de raccord visible
- STATUS.md ne liste plus les 2 faux "bugs CT"

## Risques / Questions

- Étape 4 (HP preview) : le diagnostic exact doit être fait à l'exécution. Si le Graphics hors-container est la cause, le fix est trivial ; si la depth est écrasée dynamiquement, il faut tracer les appels `setDepth` sur le container.
- Étape 6 (tileset) : uniformiser à 0.65 rend les pentes légèrement plus plates visuellement — acceptable pour MVP, à revisiter si l'artiste souhaite un éclairage directionnel propre.
- Les tests `handle-status.test.ts` peuvent nécessiter des factories existantes pour créer un PokemonInstance avec des types spécifiques — vérifier `packages/core/src/testing/` avant d'écrire.

## Dépendances

- Requiert : plan 054 livré (CT system) — fait
- Débloque : plan 056 à définir (preview timeline FFX-style, interactions type/terrain, etc.)

## Agents post-plan

1. `core-guardian` — étape 1 touche `packages/core/`
2. `code-reviewer` — review qualité globale
3. `visual-tester` — étapes 2, 3, 4, 5, 6 ont une composante visuelle
4. `doc-keeper` — met à jour STATUS.md, roadmap.md, backlog.md
5. `commit-message` — propose le message final

## Ne pas faire dans ce plan

- Pas de refactor additionnel hors scope des bugs listés
- Pas de nouvelles features
- Pas de tests e2e Playwright automatisés (visual-tester suffit)
- Pas d'autres bugs du backlog non investigués dans cette session
