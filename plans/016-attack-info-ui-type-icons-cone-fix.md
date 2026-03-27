---
status: done
created: 2026-03-27
updated: 2026-03-27
---

# Plan 016 — Infos attaques UI + type icons + fix cone

## Objectif

Enrichir le sous-menu d'attaque avec les type icons (sprites PokeAPI) et les PP affichés,
ajouter un tooltip au hover sur chaque move (puissance, précision, catégorie, portée, mini-grille pattern),
et corriger le resolver `resolveCone` pour que la largeur s'élargisse avec la distance.

## Contexte

- La roadmap Phase 1 Renderer liste "infos détaillées des attaques dans le sous-menu" comme tâche prioritaire.
- La décision de design session 2026-03-26 a validé l'approche : type icon + nom + PP dans le sous-menu, tooltip complet au hover.
- Le `resolveCone` actuel utilise une largeur fixe (`width` constant). La formule correcte est `largeur = distance * 2 - 1`, ce qui donne un cône qui s'élargit naturellement. Ce bug de core doit être corrigé en premier (tests first).
- Les type icons viennent de PokeAPI sprites Scarlet-Violet (PNG par type, 18 types).

## Étapes

- [x] Étape 1 — Fix `resolveCone` : largeur dynamique par distance
  - Dans `packages/core/src/grid/targeting.ts`, remplacer le `halfWidth` fixe par `halfWidth = distance - 1` (ce qui donne `largeur = distance * 2 - 1`)
  - Le paramètre `width` de `TargetingPattern` (kind: Cone) devient obsolète dans ce calcul — vérifier si d'autres usages l'utilisent encore, supprimer si code mort
  - Écrire les tests dans `packages/core/src/grid/targeting.integration.test.ts` **avant** de modifier le code :
    - Distance 1 → 1 case touchée (juste le centre)
    - Distance 2 → 3 cases (centre + 1 perpendiculaire de chaque côté)
    - Distance 3 → 5 cases (centre + 2 perpendiculaires de chaque côté)
    - Direction Nord, direction Est — vérifier que les perpendiculaires sont correctes
    - Cas limite : débordement de grille (cases hors bounds ignorées)

- [x] Étape 2 — Télécharger les type icons PokeAPI
  - URL pattern : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-ix/scarlet-violet/{id}.png` où id est l'id numérique du type (1=normal, 2=fighting, 3=flying, 4=poison, 5=ground, 6=rock, 7=bug, 8=ghost, 9=steel, 10=fire, 11=water, 12=grass, 13=electric, 14=psychic, 15=ice, 16=dragon, 17=dark, 18=fairy)
  - Destination : `packages/renderer/public/assets/ui/types/{typeName}.png` (nommés par nom anglais lowercase : `fire.png`, `water.png`, etc.)
  - Créer un script `scripts/download-type-icons.ts` qui télécharge les 18 types (même pattern que `scripts/extract-sprites.ts` pour le style)
  - Ajouter le script dans `package.json` root : `"download-type-icons": "tsx scripts/download-type-icons.ts"`
  - Les types couverts par le roster actuel en priorité : normal, fire, water, grass, electric, psychic, fighting, poison, rock, ghost, ice, flying — les 18 pour l'exhaustivité

- [x] Étape 3 — Charger les type icons dans `BattleScene.preload`
  - Dans `packages/renderer/src/scenes/BattleScene.ts`, ajouter dans `preload()` le chargement des 18 type icons : `this.load.image('type-icon-fire', 'assets/ui/types/fire.png')` etc.
  - Utiliser la constante `TYPE_NAMES` (tableau des 18 types, à créer dans `constants.ts`) pour éviter la duplication
  - Ajouter `TYPE_NAMES` dans `packages/renderer/src/constants.ts` : tableau `string[]` des 18 noms de types en lowercase anglais

- [x] Étape 4 — Modifier `showAttackSubmenu` dans `ActionMenu.ts` : type icon + PP
  - Dans `packages/renderer/src/ui/ActionMenu.ts`, modifier `showAttackSubmenu` pour afficher sur chaque ligne :
    - L'icône du type (image 24x12 — format "small" de PokeAPI Scarlet-Violet) à gauche du texte, offset X = 12
    - Le nom du move (décalé de 12 + 24 + 4 = 40px depuis le bord gauche du menu)
    - Le PP à droite : `${currentPp}/${maxPp}` aligné à droite du menu (offset X = ACTION_MENU_WIDTH - 8, origin 1, 0.5)
  - Supprimer la couleur de texte par type (actuellement `TYPE_COLORS` sur le texte) — l'icône suffit, texte blanc uniforme
  - `ACTION_MENU_ITEM_HEIGHT` restera à 32px — assez pour une icône de 12px de haut avec du padding
  - La `MoveDefinition` doit exposer le `type` (déjà présent) — pas de changement core nécessaire

- [x] Étape 5 — Créer `MoveTooltip.ts` dans `packages/renderer/src/ui/`
  - Nouveau composant `MoveTooltip` qui affiche au hover sur un move du sous-menu :
    - **Puissance** : `Puis: 80` (ou `—` si null/0)
    - **Précision** : `Préc: 100` (ou `—` si always hits)
    - **Catégorie** : `Physique` / `Spécial` / `Statut`
    - **Portée** : `Portée: 3` (valeur de `range.max` ou `length` ou `maxDistance` selon le kind)
    - **Mini-grille 5x5** du pattern de ciblage (voir section Mini-grille ci-dessous)
  - Positionné à gauche du sous-menu (ACTION_MENU_X - TOOLTIP_WIDTH - 8) pour ne pas sortir de l'écran
  - Fond sombre semi-transparent (même style que ACTION_MENU_BG), dimensions ~160x140px
  - Apparaît sur `pointerover` d'un item du sous-menu, disparaît sur `pointerout`
  - Le tooltip est instancié dans `BattleUIScene` et passé à `ActionMenu` comme dépendance (injection simple)

- [x] Étape 6 — Implémenter la mini-grille 5x5 dans `MoveTooltip`
  - La grille est un affichage 5x5 de petits carrés (6x6px chacun, espacement 1px, total ~35x35px)
  - Le caster est au centre de la grille (position 2,2 en 0-indexed)
  - Utiliser un helper `buildPatternPreview(targetingPattern: TargetingPattern): PatternCell[][]` dans `packages/renderer/src/ui/pattern-preview.ts`
    - `PatternCell` : `'target' | 'dash' | 'caster' | 'empty'`
    - Pour les patterns directionnels (Cone, Line, Dash, Slash), pointer vers le bas (direction Sud)
    - Pour Zone, le caster est au centre et n'est pas touché
    - Pour Blast, le centre de la cible est touché (simuler une cible à distance 2 vers le bas)
  - Couleurs : target = rouge clair `0xff6644`, dash = jaune `0xffdd44`, caster = blanc `0xffffff`, empty = gris foncé `0x333333`
  - Ajouter `TOOLTIP_WIDTH = 160`, `TOOLTIP_HEIGHT = 145`, `TOOLTIP_CELL_SIZE = 6`, `TOOLTIP_CELL_GAP = 1` dans `constants.ts`

- [x] Étape 7 — Brancher `MoveTooltip` dans `ActionMenu` et `BattleUIScene`
  - Dans `BattleUIScene.ts`, instancier `MoveTooltip` et le passer à `ActionMenu` via constructeur ou méthode `setTooltip(tooltip: MoveTooltip)`
  - Dans `ActionMenu.showAttackSubmenu`, sur `pointerover` d'un item : appeler `tooltip.show(move.definition, x, y)`
  - Sur `pointerout` : appeler `tooltip.hide()`
  - Sur `clearItems` : appeler `tooltip.hide()`

## Données de la mini-grille 5x5 par pattern

Référence visuelle (caster = centre, grille 5x5, direction vers le bas = distance croissante en Y) :

| Pattern | Aperçu |
|---------|--------|
| Single  | Seule la case sous le caster à distance 1 est marquée `T` |
| Line (length=5) | Colonne du bas entière = `T T T T T` (5 cases vers le bas) |
| Dash (maxDistance=2) | Cases à dist 1 et 2 = `M` (movement), impact si ennemi présent |
| Cone (dist 1→3) | Ligne 1 : 1 case, ligne 2 : 3 cases, ligne 3 : 5 cases |
| Slash | 3 cases adjacentes devant le caster (arc 1 case de distance) |
| Cross (size=5) | Croix centrée sur cible, cible = case sous le caster à dist 2 |
| Zone (radius=2) | Losange centré sur le caster (sans le caster lui-même) |
| Blast (radius=1) | Losange de rayon 1 centré sur cible (à dist 2 sous caster) |

## Critères de complétion

- `resolveCone` produit un cône qui s'élargit : distance 1 → 1 case, distance 2 → 3 cases, distance 3 → 5 cases (tests verts, coverage 100% maintenu)
- Les 18 type icons sont téléchargés dans `public/assets/ui/types/` via le script
- Le sous-menu attaque affiche : type icon (24x12) | nom du move | PP courants/max à droite
- Le tooltip apparaît au hover sur chaque move avec : puissance, précision, catégorie, portée, mini-grille 5x5
- Aucune régression sur les 305 tests existants
- TypeScript strict : pas de `any`, pas de `as` abusif
- `visual-tester` valide le rendu final (sous-menu + tooltip visible, pas de débordement)

## Risques / Questions

- **Format des type icons PokeAPI** : les sprites "scarlet-violet" ont une taille variable — à vérifier avant d'intégrer. Si le format ne convient pas, fallback sur `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/sword-shield/{id}.png` (plus petit, ~30x14).
- **Paramètre `width` du Cone** : après le fix, `width` dans `TargetingPattern` sera inutilisé si le calcul est entièrement basé sur la distance. Vérifier si des moves dans `tactical.ts` le définissent encore — supprimer le champ si code mort (décision à prendre en cours d'étape 1).
- **Positionnement tooltip** : si ACTION_MENU_X est trop à gauche pour placer le tooltip à sa gauche, le positionner à gauche du sous-menu peut sortir du canvas (1100 - 160 - 8 = 932, OK). À valider visuellement.
- **`buildPatternPreview` et la grille 5x5** : les patterns avec portée > 2 tiles dépasseront la fenêtre 5x5. Tronquer silencieusement (ne pas afficher les cases hors de la grille preview) — c'est un aperçu schématique, pas une simulation exacte.

## Dépendances

- **Prérequis** : Plan 015 (stats niveau 50) — terminé
- **Bloque** : Plan 017 (prévisualisation AoE sur la grille de jeu) — le fix cone doit être en place avant
- **Décisions liées** : décision #108 (slash), #109 (blast), #110 (changements de pattern tactical.ts) — les patterns corrects doivent être en place avant de les afficher dans le tooltip
