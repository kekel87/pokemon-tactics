---
status: done
created: 2026-04-04
updated: 2026-04-04
---

# Plan 036 — Menu principal, Settings et Disclaimer

## Objectif

Ajouter un menu principal comme point d'entrée du jeu, un sous-menu Combat, un écran de paramètres persistants, et un disclaimer légal/crédits.

## Contexte

Le plan 035 a supprimé les query params URL et posé le boot conditionnel sandbox via env var. Le jeu démarre sur `TeamSelectScene` en mode normal. Il manque :
- Un menu principal (identité visuelle, navigation claire)
- Un sous-menu Combat (Local / En ligne / Tutoriel)
- Des paramètres persistants (langue, damage preview)
- Un disclaimer pour se protéger juridiquement (fan project, crédits sprites)

## Dépendances

- Plan 035 (suppression query params, sandbox via env var)

## Décisions

1. **Damage preview** : global pour l'instant. Deviendra per-match quand le multi arrive (Phase 7).
2. **Aventure** : bouton visible mais grisé (Phase 9).
3. **En ligne** : bouton visible mais grisé (Phase 7).
4. **Tutoriel** : bouton visible mais grisé (Phase 7, noté dans roadmap).
5. **Version + changelog** : hors scope, noté pour plus tard.

## Design du menu principal

```
┌─────────────────────────────────────┐
│                                     │
│          POKEMON TACTICS            │
│          (logo / titre)             │
│                                     │
│         ┌───────────────┐           │
│         │   Aventure    │  (grisé)  │
│         ├───────────────┤           │
│         │    Combat     │           │
│         ├───────────────┤           │
│         │  Paramètres   │           │
│         ├───────────────┤           │
│         │   Crédits     │           │
│         └───────────────┘           │
│                                     │
│  v0.2.0              FR | EN        │
└─────────────────────────────────────┘
```

- Titre : "Pokemon Tactics" (texte stylisé, pas de logo bitmap pour l'instant)
- Boutons : Aventure (disabled), Combat → BattleModeScene, Paramètres → SettingsScene, Crédits → CreditsScene
- Version en bas à gauche (hardcodée pour l'instant)
- Toggle langue en bas à droite (réutilise LanguageToggle existant)

## Design du sous-menu Combat (BattleModeScene)

```
┌─────────────────────────────────────┐
│                                     │
│           MODE DE COMBAT            │
│                                     │
│         ┌───────────────┐           │
│         │    Local      │           │
│         ├───────────────┤           │
│         │   En ligne    │  (grisé)  │
│         ├───────────────┤           │
│         │   Tutoriel    │  (grisé)  │
│         └───────────────┘           │
│                                     │
│         ┌───────────────┐           │
│         │    Retour     │           │
│         └───────────────┘           │
└─────────────────────────────────────┘
```

- Local → TeamSelectScene (flow existant)
- En ligne (disabled) → Phase 7
- Tutoriel (disabled) → Phase 7
- Retour → MainMenuScene

## Design des paramètres

| Setting | Type | Default | Stockage |
|---------|------|---------|----------|
| Langue | FR / EN | détection navigateur | `localStorage("pt-lang")` (existant) |
| Damage preview | on / off | on | `localStorage("pt-settings")` |

Objet settings dans localStorage :
```json
{ "damagePreview": true }
```

La langue reste dans sa clé séparée `pt-lang` (existant, pas de migration).

## Disclaimer / Crédits

Approche sobre, inspirée de PokeRogue (qui ne met aucun disclaimer explicite dans le repo, juste des licences non-commerciales). On fait un peu plus car on affiche un écran dédié.

Texte i18n (version EN par défaut, portée juridique internationale) :

> **Pokemon Tactics** is a fan-made, non-commercial project.
> It is not affiliated with, endorsed, or approved by Nintendo, Game Freak, or The Pokemon Company.
> Pokemon and all related names are trademarks of their respective owners.
>
> **Sprites** : PMDCollab SpriteCollab — CC-BY-NC 4.0
> https://sprites.pmdcollab.org
>
> **Code** : developed with the assistance of Claude (Anthropic)

Bouton "Retour" → MainMenuScene.

## Étapes

### Étape 1 — Infrastructure settings

- Créer `packages/renderer/src/settings/` avec :
  - `GameSettings` type (`damagePreview: boolean`)
  - `getSettings()` / `updateSettings()` / `onSettingsChange()` (pattern similaire à i18n)
  - Persistance `localStorage("pt-settings")`
- Brancher `damagePreview` sur `GameController.ts` → conditionner l'appel `showDamageEstimates()` au setting
- Tests unitaires pour le module settings
- `pnpm build && pnpm test`

### Étape 2 — MainMenuScene

- Créer `packages/renderer/src/scenes/MainMenuScene.ts`
- Titre "Pokemon Tactics" (texte Phaser stylisé)
- 4 boutons : Aventure (disabled), Combat, Paramètres, Crédits
- Version statique en bas à gauche
- LanguageToggle repositionné (vérifier si le composant prend des coordonnées en paramètre)
- Mettre à jour `main.ts` : MainMenuScene comme première scène (quand `VITE_SANDBOX` n'est pas défini)
- Combat → `scene.start("BattleModeScene")`
- Traduire les clés i18n : `menu.adventure`, `menu.battle`, `menu.settings`, `menu.credits`

### Étape 3 — BattleModeScene

- Créer `packages/renderer/src/scenes/BattleModeScene.ts`
- Titre "Mode de combat"
- 3 boutons : Local, En ligne (disabled), Tutoriel (disabled)
- Bouton Retour → MainMenuScene
- Local → `scene.start("TeamSelectScene")`
- Traduire les clés i18n : `battleMode.title`, `battleMode.local`, `battleMode.online`, `battleMode.tutorial`, `battleMode.back`

### Étape 4 — SettingsScene

- Créer `packages/renderer/src/scenes/SettingsScene.ts`
- Toggle langue (réutilise la logique i18n existante, affichage plus explicite que le petit bouton)
- Toggle damage preview on/off
- Bouton Retour → MainMenuScene
- Les changements sont appliqués et persistés immédiatement

### Étape 5 — CreditsScene

- Créer `packages/renderer/src/scenes/CreditsScene.ts`
- Texte du disclaimer (voir section ci-dessus)
- i18n FR/EN pour le texte
- Bouton Retour → MainMenuScene

### Étape 6 — Mise à jour du flow retour + vérifications

- Modifier `BattleUI.ts` : le handler du bouton `battle.backToMenu` démarre `MainMenuScene` au lieu de `TeamSelectScene`
- Vérifier que toutes les transitions de scènes sont cohérentes
- `pnpm build && pnpm test`

## Critères de complétion

- Le jeu démarre sur MainMenuScene (sauf mode sandbox via env var)
- Flow complet : MainMenu → Combat → BattleMode → Local → TeamSelectScene → BattleScene → Victory → MainMenuScene
- Paramètres fonctionnels et persistés (langue + damage preview)
- Crédits/disclaimer affichés proprement en FR et EN
- Tous les tests passent, build OK

## Notes pour plus tard

- **Police Pokemon + passe brand globale** : texte stylisé pour l'instant, police Pokemon et cohérence visuelle globale dans un futur plan dédié
- **Version dynamique + changelog public** : afficher la version depuis package.json + page changelog (≠ git log)
- **Tutoriel interactif** : bouton prévu dans BattleModeScene (grisé), à implémenter Phase 7

## Hors scope

- Logo bitmap / branding poussé (texte stylisé suffit)
- Police Pokemon custom
- Musique / sons du menu
- Animations de transition entre scènes
- Version dynamique / changelog
- Settings per-match pour le multi
- Tutoriel interactif
