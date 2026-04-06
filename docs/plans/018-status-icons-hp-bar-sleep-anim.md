---
status: done
created: 2026-03-30
updated: 2026-03-30
---

# Plan 018 — Status icons ZA + HP bar FFTIC + badges stat changes + sleep animation

**Prérequis** : Plan 017 terminé

---

## Objectif

Rendre les statuts visuellement lisibles et cohérents avec l'univers ZA dans tous les éléments UI : icônes officielles dans la timeline et sur les sprites, miniature dans l'InfoPanel, badges colorés pour les stat changes (style Showdown), et animation Sleep déclenchée automatiquement sur les Pokemon endormis.

## Contexte

La Phase 1 Renderer liste explicitement : "Feedback visuel des statuts sur les sprites" et "Refonte panel info stats". Les assets type icons ZA ont été introduits en plan 016 avec le même pattern (script de téléchargement Pokepedia). Les statuts ont des icônes officielles dans le style ZA (52x36px) et des miniatures avec label (172x36px). L'InfoPanel affiche actuellement le statut en texte brut uppercase ; la timeline utilise des pastilles colorées avec lettre. L'animation Sleep est disponible dans PMDCollab (`Sleep` = animation en boucle distincte de `Idle`) mais absente de `sprite-config.json`.

---

## Étapes

### Étape 1 — Script de téléchargement des status icons ZA

**Fichier** : `scripts/download-status-icons.ts`

Créer un script similaire à `scripts/download-type-icons.ts`. Le script doit :

1. Définir la liste des 7 statuts avec leur nom français Pokepedia et leur clé normalisée :

   | Clé normalisée | Nom français Pokepedia |
   |----------------|------------------------|
   | `burned`       | Brûlure                |
   | `frozen`       | Gel                    |
   | `ko`           | K.O.                   |
   | `paralyzed`    | Paralysie              |
   | `poisoned`     | Poison                 |
   | `badly-poisoned` | Poison_grave         |
   | `asleep`       | Somnolence             |

2. Pour chaque statut, scraper la page Pokepedia pour extraire l'URL directe de l'image :
   - Page icône : `https://www.pokepedia.fr/Fichier:Icône_Statut_{Nom}_LPZA.png`
   - Page miniature : `https://www.pokepedia.fr/Fichier:Miniature_Statut_{Nom}_LPZA.png`
   - L'URL directe est dans le lien `<a>` qui wrape l'image `fullImageLink` sur la page Pokepedia (sélecteur : `a.internal` avec `href` contenant `/images/`)

3. Télécharger et sauvegarder dans `packages/renderer/public/assets/ui/statuses/` :
   - Icônes (52x36) : `icon-{key}.png` (ex: `icon-burned.png`)
   - Miniatures (172x36) : `label-{key}.png` (ex: `label-burned.png`)

4. Ajouter le script dans `package.json` racine :
   ```json
   "download-status-icons": "tsx scripts/download-status-icons.ts"
   ```

**Vérification** : lancer `pnpm download-status-icons`, vérifier que 14 fichiers (7 icônes + 7 miniatures) sont créés dans `packages/renderer/public/assets/ui/statuses/`.

---

### Étape 2 — Preload dans BattleScene + mapping constants

**Fichiers** : `packages/renderer/src/scenes/BattleScene.ts`, `packages/renderer/src/constants.ts`

Dans `constants.ts`, ajouter le mapping `StatusType` → clé normalisée :

```ts
import { StatusType } from "@pokemon-tactic/core";

export const STATUS_ICON_KEY: Partial<Record<string, string>> = {
  [StatusType.Burned]: "burned",
  [StatusType.Frozen]: "frozen",
  [StatusType.Paralyzed]: "paralyzed",
  [StatusType.Poisoned]: "poisoned",
  [StatusType.BadlyPoisoned]: "badly-poisoned",
  [StatusType.Asleep]: "asleep",
};
```

Note : le statut `K.O.` existe dans les assets mais n'est pas dans `StatusType` — ne pas l'inclure dans le mapping, l'asset est téléchargé mais non utilisé dans ce plan.

Dans `BattleScene.preload()`, après le chargement des type icons, ajouter le chargement des status icons et labels pour chaque clé du mapping :

```ts
for (const key of Object.values(STATUS_ICON_KEY)) {
  this.load.image(`status-icon-${key}`, `assets/ui/statuses/icon-${key}.png`);
  this.load.image(`status-label-${key}`, `assets/ui/statuses/label-${key}.png`);
}
```

**Vérification** : console Phaser sans erreur de chargement, assets visibles dans l'onglet Network du browser.

---

### Étape 3 — TurnTimeline : remplacer les pastilles par les icônes ZA

**Fichier** : `packages/renderer/src/ui/TurnTimeline.ts`

Remplacer la méthode `createStatusIcon` qui dessine un cercle coloré + lettre.

Nouvelle logique dans `createStatusIcon(statusType, half, scene)` :
- Récupérer la clé normalisée depuis `STATUS_ICON_KEY[statusType]`
- Si pas de clé → return `null` (fallback silencieux)
- Vérifier que la texture `status-icon-{key}` est chargée (`scene.textures.get(key).key !== "__MISSING"`)
- Si texture présente : créer un `Phaser.GameObjects.Image` avec la clé
  - Taille source de l'icône : 52x36px
  - Scaler pour que la hauteur fasse ~14px (scale = 14/36 ≈ 0.39) — lisible sans cacher le portrait
  - Positionner en bas-droite du portrait : `x = half - scaledWidth/2`, `y = half - 7`
- Si texture absente (assets non téléchargés) : conserver le comportement actuel (cercle + lettre) comme fallback

Supprimer `STATUS_ICON_CONFIG` si le fallback cercle+lettre n'est plus utilisé, ou le garder uniquement pour le fallback.

**Vérification** : icône statut visible dans la timeline pour un Pokemon avec statut, correctement positionnée en bas-droite du portrait.

---

### Étape 4 — PokemonSprite : icône statut + rework HP bar style FFTIC

**Fichier** : `packages/renderer/src/sprites/PokemonSprite.ts`

#### 4a — Rework HP bar style FFTIC

Modifier `drawHpBar()` pour un style plus proche de FFTIC (référence : `docs/references/info card - fftic.png`) :

- Contour/bordure noir fine (1px) autour de la barre complète
- Fond sombre (`HP_BAR_BG_COLOR`, alpha 0.9)
- Gradient simulé en 3 segments selon `hpRatio` :
  - `ratio > 0.6` → couleur verte (`HP_COLOR_HIGH = 0x44cc44`)
  - `0.3 < ratio <= 0.6` → couleur jaune (nouvelle constante `HP_COLOR_MEDIUM = 0xddcc22`)
  - `ratio <= 0.3` → couleur rouge (`HP_COLOR_LOW = 0xcc4444`)
- Conserver dimensions actuelles (`HP_BAR_WIDTH = 36`, `HP_BAR_HEIGHT = 5`)

Ajouter `HP_COLOR_MEDIUM = 0xddcc22` dans `constants.ts`.

#### 4b — Icône statut sur le sprite grille

Ajouter dans `PokemonSprite` :
- Propriété privée `statusIcon: Phaser.GameObjects.Image | null = null`
- Méthode `updateStatus(statusEffects: PokemonInstance['statusEffects']): void`
  - Si `statusEffects.length === 0` ou premier statut sans clé dans `STATUS_ICON_KEY` → masquer/supprimer l'icône existante
  - Sinon : récupérer la clé du premier statut, charger la texture `status-icon-{key}`
    - Si texture présente et icône existante de même clé → ne rien faire
    - Si texture présente : créer/remplacer l'`Image`, scale ≈ 0.5 (26x18px effective)
    - Positionner à droite de la HP bar : `x = HP_BAR_WIDTH / 2 + 14`, `y = -32` (même hauteur que la HP bar)
  - Ajouter l'`Image` au container si créée

- Appeler `updateStatus` dans le constructeur (avec `pokemon.statusEffects`)

**Vérification** : icône statut visible sur le sprite grille pour un Pokemon avec statut, disparaît quand le statut est retiré (vérifiable via l'event système dans l'étape 6).

---

### Étape 5 — InfoPanel : miniature ZA + badges stat changes

**Fichier** : `packages/renderer/src/ui/InfoPanel.ts`

#### 5a — Miniature statut ZA

Remplacer le `statusText` (texte uppercase) par une image Phaser :

- Ajouter propriété `statusLabel: Phaser.GameObjects.Image | null = null` et `currentStatusKey: string = ""`
- Dans `update()`, remplacer `this.statusText.setText(statusName.toUpperCase())` par :
  - Récupérer la clé depuis `STATUS_ICON_KEY`
  - Si même clé qu'avant → ne rien faire (pas de rechargement)
  - Si clé différente : détruire l'image précédente, créer `Phaser.GameObjects.Image` avec `status-label-{key}`
    - Taille source : 172x36px — scaler à hauteur 14px (scale = 14/36 ≈ 0.39, largeur effective ≈ 67px)
    - Positionner à droite dans le panel : `x = INFO_PANEL_WIDTH - HP_BAR_MARGIN_RIGHT - scaledWidth/2`, `y = HP_BAR_OFFSET_Y + HP_BAR_HEIGHT + 4 + 7` (même ligne que le texte HP)
  - Si pas de statut → masquer/détruire l'image

Conserver `statusText` mais le cacher (`.setVisible(false)`) — ou le supprimer si aucun fallback n'est nécessaire. Supprimer si texture absente uniquement : dans ce cas, conserver le `statusText` avec le texte.

#### 5b — Badges stat changes style Showdown

Remplacer le `statChangesText` (texte monochrome) par des badges colorés.

Ajouter dans `constants.ts` :
```ts
export const STAT_BADGE_BUFF_COLOR = 0x1a4a8a;     // fond bleu foncé
export const STAT_BADGE_DEBUFF_COLOR = 0x8a1a1a;   // fond rouge foncé
export const STAT_BADGE_TEXT_COLOR = "#ffffff";
export const STAT_BADGE_HEIGHT = 13;
export const STAT_BADGE_CORNER_RADIUS = 3;
export const STAT_BADGE_PADDING_X = 4;
export const STAT_BADGE_SPACING = 3;
```

Dans `InfoPanel`, remplacer `statChangesText` (unique `Text`) par :
- Propriété `statBadgeContainer: Phaser.GameObjects.Container` ajouté au container principal
- Méthode `updateStatBadges(pokemon: PokemonInstance): void` qui :
  1. Détruit les enfants du `statBadgeContainer` (clear)
  2. Pour chaque stat avec stage ≠ 0, dans l'ordre de `STAT_LABELS` :
     - Construire le label : `Atk +2` ou `Def -1`
     - Créer un `Text` de taille 9px pour mesurer la largeur (`text.width`)
     - Créer un `Graphics` avec fond coloré (bleu si stage > 0, rouge si stage < 0), coins arrondis `STAT_BADGE_CORNER_RADIUS`, hauteur `STAT_BADGE_HEIGHT`
     - Empiler les badges horizontalement, x cumulatif, wrap si dépassement de `INFO_PANEL_WIDTH - TEXT_OFFSET_X - HP_BAR_MARGIN_RIGHT`
  3. Positionner le container à `(TEXT_OFFSET_X, STAT_CHANGES_OFFSET_Y)`

Supprimer `statChangesText` du constructeur et du container initial.

**Vérification** : badges colorés visibles dans l'InfoPanel pour un Pokemon avec stat changes, bleu pour buffs, rouge pour debuffs. Miniature statut ZA visible à la place du texte BURNED.

---

### Étape 6 — Sleep animation PMD

**Fichiers** : `scripts/sprite-config.json`, `packages/renderer/src/sprites/PokemonSprite.ts`, `packages/renderer/src/game/GameController.ts`

#### 6a — Ajouter "Sleep" aux animations extraites

Dans `scripts/sprite-config.json`, ajouter `"Sleep"` à la liste `animations` :

```json
"animations": ["Idle", "Walk", "Attack", "Hurt", "Faint", "Sleep"]
```

Relancer `pnpm extract-sprites` — le script affiche un warning pour les Pokemon sans animation Sleep disponible (comportement existant) et génère les frames pour ceux qui l'ont.

#### 6b — Méthode `setSleepAnimation` dans PokemonSprite

Dans `PokemonSprite.ts`, ajouter une méthode publique :

```ts
setStatusAnimation(isAsleep: boolean): void
```

Comportement :
- Si `isAsleep` et l'animation "Sleep" existe (`this.scene.anims.exists(key)`) → `playAnimation("Sleep")`
- Si `isAsleep` et "Sleep" n'existe pas → jouer "Idle" (fallback silencieux)
- Si `!isAsleep` et l'animation courante est "Sleep" → `playAnimation("Idle")` (retour à Idle)
- Si `!isAsleep` et l'animation courante n'est pas "Sleep" → ne rien faire (ne pas interrompre Attack, Hurt, etc.)

#### 6c — Écouter StatusApplied / StatusRemoved dans GameController

Dans `GameController.ts`, dans `processEvents(events)`, ajouter des cases pour :

```ts
case BattleEventType.StatusApplied: {
  const sprite = this.pokemonSprites.get(event.targetId);
  if (sprite) {
    sprite.updateStatus([{ type: event.status }]);
    sprite.setStatusAnimation(event.status === StatusType.Asleep);
  }
  break;
}
case BattleEventType.StatusRemoved: {
  const sprite = this.pokemonSprites.get(event.targetId);
  if (sprite) {
    sprite.updateStatus([]);
    sprite.setStatusAnimation(false);
  }
  break;
}
```

Note : `updateStatus` (étape 4b) gère l'icône sur le sprite, `setStatusAnimation` gère l'animation. Les deux sont appelés ensemble.

**Vérification** : un Pokemon endormi joue l'animation Sleep en boucle. Quand le statut expire (après 1-3 tours via `StatusRemoved`), il revient à Idle. L'icône "asleep" apparaît et disparaît en synchronisation.

---

## Critères de complétion

- [x] 14 fichiers png dans `packages/renderer/public/assets/ui/statuses/` (7 icônes + 7 miniatures)
- [x] Icônes ZA visibles dans la TurnTimeline (remplacent les pastilles colorées)
- [x] Icône statut ZA sur les sprites grille (apparaît/disparaît avec le statut)
- [x] HP bar sur les sprites grille avec gradient 3 couleurs (vert/jaune/rouge) et bordure fine
- [x] Miniature ZA dans l'InfoPanel (remplace le texte BURNED)
- [x] Badges colorés (bleu buff / rouge debuff) dans l'InfoPanel pour les stat changes
- [x] Animation Sleep jouée en boucle pour les Pokemon endormis, retour à Idle à la guérison
- [x] Fallback cercle+lettre (timeline) et texte (InfoPanel) si assets non téléchargés
- [x] Aucun test core cassé, coverage 100% maintenu

## Risques / Questions

- **Scraping Pokepedia** : la structure HTML peut varier. Vérifier la présence du sélecteur `fullImageLink` sur quelques pages avant de coder le parsing. Alternative : hard-coder les URLs directes si le scraping est trop fragile (comme pour les type icons dans `download-type-icons.ts`).
- **Animation Sleep absente** : certains Pokemon PMDCollab n'ont pas d'animation Sleep. Le fallback Idle est prévu, mais vérifier que `extract-sprites` ne crash pas sur les Pokemon manquants (le warning existant doit couvrir ce cas).
- **Largeur des badges stat changes** : si un Pokemon a beaucoup de stat changes actifs simultanément (ex: 5 stats buffées), les badges peuvent déborder du panel. Le wrap horizontal est prévu mais à tester avec le cas limite.
- **Positionnement icône statut sur PokemonSprite** : la HP bar est à y=-32, l'icône à droite. Vérifier qu'elle ne sort pas de l'écran iso pour les sprites en bord de carte.
- **`StatusRemoved` vs état réel** : après un `StatusRemoved`, appeler `updateStatus([])` remet à zéro. Mais si le Pokemon avait deux statuts (impossible actuellement, mais à garder en tête), il faudrait relire l'état complet. Pour ce plan, l'hypothèse 1 statut max est correcte.

## Dépendances

- **Avant ce plan** : Plan 017 terminé (BattleScene.preload, GameController.processEvents structurés)
- **Ce plan débloque** : Refonte complète du feedback visuel statuts — prochaine étape logique : preview dégâts estimés (slot prévu dans plan 017), puis Phase 2 (i18n, zoom caméra)

## Fichiers impactés

- `scripts/download-status-icons.ts` — nouveau
- `scripts/sprite-config.json` — ajout "Sleep"
- `package.json` (racine) — nouveau script npm
- `packages/renderer/public/assets/ui/statuses/` — 14 nouveaux assets PNG
- `packages/renderer/src/constants.ts` — `STATUS_ICON_KEY`, `HP_COLOR_MEDIUM`, constantes badges
- `packages/renderer/src/scenes/BattleScene.ts` — preload status icons
- `packages/renderer/src/ui/TurnTimeline.ts` — icônes ZA, fallback conservé
- `packages/renderer/src/sprites/PokemonSprite.ts` — icône statut, rework HP bar, `setStatusAnimation`
- `packages/renderer/src/ui/InfoPanel.ts` — miniature ZA, badges stat changes
- `packages/renderer/src/game/GameController.ts` — écoute `StatusApplied`/`StatusRemoved`
