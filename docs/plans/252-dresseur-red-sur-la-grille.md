# Plan 252 : Red sur la grille de combat (preuve visuelle)

**Statut** : done

**Ouvert le** : 2026-11-20, suite de `decision-1236` (sprites des dresseurs par SpriteKiln), `docs/aventure.md`
**Bloque la release ?** : non

| Écart au plan | Raison |
|---|---|
| Pied enfoncé de 4 px sous le pixel le plus bas | Recette : Red flottait ; l'ancrage PMD est le centre de l'ombre (`decision-1239`) |
| Célébration en boucle, 1,5 s d'attente entre deux | Demande de l'humain en recette (`decision-1240`) |
| Case sur sol sec seulement (pas d'eau, magma, glace, marais) | Revue de code (`decision-1241`) |
| `animationDurationMs` ajouté au port de scène, `testId` au helper `createLabeledSelect` | Boucle de célébration ; règle multi-entrée |
| `DirectionalBillboard` inchangé : Red passe par `addPokemon` | Le port avait déjà `setHudVisible`, `playOnce`, `setFacing` |

## Ce que tu verras à l'écran

- Dans le bac à sable, chaque équipe a un choix « Dresseur » (Aucun ou Red) ; avec Red, il apparaît sur une case
  libre derrière son équipe, à l'échelle des Pokémon, avec son ombre.
- Red joue son attente en boucle, tourné vers le centre du combat, et se retourne quand la caméra pivote (8
  directions), comme un Pokémon.
- Quand un Pokémon de son équipe agit, Red joue « ordre » ; quand un de ses Pokémon tombe K.O., « touché » ; à la
  victoire de son équipe, « célébration » ; à sa défaite, « K.O. ».
- Une liste de débogage du bac à sable joue à la demande chacune de ses 9 animations.
- Hors bac à sable, rien ne change.

## Périmètre

Preuve visuelle seulement : Red est un décor du rendu, le core ne le connaît pas (pas d'unité, pas de case
bloquée ; un Pokémon peut passer sur sa case). Le dresseur unité de combat (`decision-1214`, `decision-1215`) viendra
avec l'Aventure, sur la base de ce qu'on aura vu ici.

## Empaquetage

- Source hors git : `assets-src/sprites/trainers/<id>/{atlas.png,atlas.json}`, copie de la sortie SpriteKiln
  (`assets-src/references/aventure/sprites-dresseurs/spritekiln-red2/out/red2/red2.{png,json}`).
- `scripts/pack-sprites.ts` lit aussi ce dossier et range chaque dresseur dans `sprites.bin` sous l'id
  `trainer-<id>`. Seul le paquet est commité (règle des assets non libres).
- Conversion au moment de l'empaquetage, pour que le billboard des Pokémon serve tel quel : noms SpriteKiln
  `idle_s_0` → noms PMD `Idle-South-0` (animations `Idle`, `Walk`, `Throw`, `Hop`, `Hurt`, `Faint`, `Command`,
  `Item`, `Celebrate`), durées en millisecondes → ticks PMD de 24 ms dans `meta.animations.<Anim>.durations`.
- Offsets (pied, tête, ombre) calculés à l'empaquetage depuis l'alpha de la frame d'attente sud.

## Rendu

- `DirectionalBillboard` (`packages/render-babylon`) réutilisé pour Red ; ajouts limités à ce que le dresseur n'a
  pas (pas de barre de PV, pas de statut).
- `SandboxTeamConfig` gagne un champ `trainer` optionnel ; le studio du bac à sable l'expose par équipe.
- Réactions branchées sur les événements de combat déjà émis au rendu (action d'un Pokémon, K.O., fin de combat).

## Critères

- `pnpm pack-sprites` produit un `sprites.bin` qui contient `trainer-red` ; test unitaire `scripts/trainer-atlas.test.ts`
  (à créer) sur la conversion de noms et de durées (fonction pure).
- `typecheck` vert ; recette visuelle sur les 5 lignes ci-dessus.

## Fichiers touchés

`scripts/pack-sprites.ts`, `scripts/trainer-atlas.ts` (conversion), `packages/view-core/src/sandbox-config.ts` et
`constants.ts` (ids et animations des dresseurs), `packages/render-ports/src/combat-scene.ts` et
`packages/render-babylon/src/combat-scene.ts` (`animationDurationMs`), `packages/ui-dom/src/form-controls.ts`
(`testId`), `packages/app/src/babylon/sandbox-trainers.ts` (placement, réactions), `sandbox-studio.ts`,
`combat-screen.ts` (`onBattleEvent`), `packages/app/src/ui/SandboxPanel.ts`, i18n, `sprites.bin` et
`sprites-manifest.json`.
