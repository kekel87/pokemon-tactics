# Plan 122 — Jalon 4c : animations combat + textes flottants

> **Statut : ✅ 4c TERMINÉ** (3 sous-paliers, 2026-06-12) — preview dégâts numérique + flash confirm
> + wobble confusion + tweens d'impact (knockback/ice/teleport) + nuance movement-animation (Hop/glide/
> rampe) reportés (couplés barres PV / confirm flow / J5 parité). Suite : 4d (écrans hors-combat).
> Démarré 2026-06-12. Worktree `phase5-babylon`, port 5220.
> Run autonome (humain : « finis jusqu'à l'iso-Phaser »). Chaîne par sous-palier :
> bonne pratique (mirror Phaser) → code → code-review → simplify → ci-gate → commit.

## Objectif

Donner de la « juice » à la boucle combat Babylon (qui snap les sprites + n'a aucun
texte flottant en 4b) : tweens de déplacement/impact + les ~30 textes flottants i18n,
à parité avec le renderer Phaser. Couvre la checklist parité §5 (déplacements & impacts)
+ §6 (textes flottants). Référence : `GameController.animateEvent` + `ui/BattleText.ts`
+ `game/movement-animation.ts` (pur, réutilisable).

## Sous-paliers (1 commit chacun)

### 4c-1 — Textes flottants DOM ✅ (2026-06-12)
- `game/floating-text-content.ts` : mapper pur `floatingTextsFor(event, context)` (port des
  `showBattleText` GameController) — dégâts/soin/immunisé/efficacité×4/raté/critique/stat±/
  confus/apeuré/séduit/bloqué/×N/recharge/chute/impact/terrain/KO-terrain/talent/objet/aura/
  Champ/substitut/Provoc-Entrave-Encore/dash-bloqué. Couleurs `BATTLE_TEXT_COLOR_*`, i18n `t()`.
- `babylon/combat-scene.ts` : `spawnFloatingText(tile, text, color, {delayMs, secondary})` — projeté
  une fois au spawn (`projectWorld` + lift `BABYLON_FLOATING_TEXT_LIFT`), div `.ft-float` dans
  worldLayer, CSS rise+fade (`floating-text.css`), retiré sur animationend.
- `babylon/floating-text-spawner.ts` : event→specs→spawn, stagger par cible (`performance.now`).
- combat-screen : feedback **composite** (BattleLog + floating text). Test `floating-text-content.test.ts` (8 cas).
- Review : +5 events portés (SubstituteFailed, Disable/EncoreBlocked, Disable/EncoreFailed).
- **Différés** : MoveCharging float (= sprite state 4c-3). **Écart assumé** : recoil-KO affiche le
  nombre de dégâts `-N` (Phaser affiche « KO » à la place) — le check HP-résultant=0 exige l'état,
  absent du mapper pur ; l'anim faint signale déjà le KO.

### 4c-2 — Tweens de déplacement (glide chemin) ✅ (2026-06-12)
- `combat-scene.moveAlongPath(path,{jump})` : glide tile-par-tile (lerp `root.position` via
  `onBeforeRenderObservable`, facing/pas via `directionFromTo`, Walk/Hop, arc `BABYLON_MOVE_JUMP_ARC`),
  Promise résolue à l'arrivée. Port `BoardView.moveAlongPath`. `applyEvents` : PokemonMoved/Dashed →
  `await board.moveAlongPath` (au lieu du snap) + guard `disposed`.
- Review CRITICAL corrigé : le tween résout aussi sur `scene.onDisposeObservable` (sinon
  `scene.dispose()` clear les observers sans les fire → `await` pendu → queue bloquée + fuite billboard
  au Replay/Exit mid-glide). + guard `disposed` après l'await dans l'orchestrateur.
- **Dettes (→ tracées) :**
  - **Knockback-shake / glissade glace / téléportation / retraite Hit&Run** gardent le **snap**
    (syncBoard) — tweens d'impact à porter (4c-2b ou polish).
  - **Nuance `movement-animation.ts` non intégrée** : Walk fixe (+ Hop si event Dashed) + durée fixe
    par pas ; PAS de calcul `heightDiff/isRamp/isFlying` par pas → un **Volant glisse en Walk** (pas
    de plané) et un **saut de hauteur ne déclenche pas Hop**. Parité à finir avant suppression Phaser (J5).

### 4c-3 — Animations d'attaque ✅ (2026-06-12)
- `combat-scene.playAttack(direction, animationName)` : face cible + one-shot anim catégorie
  (Shoot/Charge/Attack via `moveAnimationCategory`, fallback "Attack" si absente via `hasAnimation`),
  Promise + filet `setTimeout(BABYLON_ATTACK_ANIMATION_MAX_MS)` anti-hang (anim absente / dispose).
  Port `BoardView.playAttack`. `applyEvents` : MoveStarted → `await board.playAttack` + guard `disposed`.
- **Différés** (couplés confirm flow + barres PV) : flash confirmation cibles, preview dégâts numérique
  (barre PV + min-max), wobble confusion, indicateur charge two-turn. `BATTLE_CONFIRM_ATTACK` reste off.
- flashDamage (DamageDealt) + KO faint déjà câblés (7b/4c). Gate vert.

## Gate

CI standard à chaque sous-palier. `core-guardian` si `packages/core` touché (ne devrait pas).
Repasse gate complète humaine à l'iso-Phaser (fin 4d).

## Hors scope

- Team Builder réel, Team Select complet, Sandbox Studio → **4d**.
- Suppression Phaser → **J5**.
</content>
</invoke>
