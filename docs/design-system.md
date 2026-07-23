# Design System — Pokemon Tactics

> Palette de couleurs, conventions visuelles et guide de brand.
> Source de vérité : `packages/renderer/src/constants.ts` pour les valeurs centralisées.

---

## Direction artistique

### Vision

Le jeu fusionne l'univers Pokemon avec le gameplay de Final Fantasy Tactics Advance. L'objectif visuel est un rendu **pixel art lisible sur fond sombre**, inspiré des tactical RPGs GBA/DS, pas du style HD-2D (cet objectif reste futur). L'interface est minimaliste, fonctionnelle, pensée pour laisser la grille de combat au centre de l'attention.

### Ambiance générale

- **Dark mode intégral** : fond bleu nuit profond (`#1a1a2e`), panneaux UI quasi-noirs avec une teinte bleu-violet (`#111122`). Aucune surface claire. Le contraste vient des sprites colorés et des accents.
- **Esthétique "terminal de combat"** : police monospace exclusive, panneaux rectangulaires avec coins arrondis subtils (4-6px), bordures fines blanches semi-transparentes. L'UI rappelle un HUD militaire ou un overlay de données sur le champ de bataille.
- **Sprites pixel art PMDCollab** : sprites Pokemon Mystery Dungeon (Idle/Walk/Attack/Hurt/Faint), rendu via zoom caméra (plus de `POKEMON_SPRITE_SCALE` hardcodé depuis plan 044), filtre NEAREST appliqué manuellement. Portraits carrés dans les panneaux (filtre LINEAR). Les sprites sont le seul élément visuellement "chaud" du jeu — tout le reste est sobre.

### Structure des écrans

**Menu principal** : centré verticalement, titre doré "POKEMON TACTICS" en gros, boutons empilés en bleu acier, version en bas-gauche, toggle langue en bas-droite. Minimaliste.

**Sélection d'équipe** : grille centrale de portraits Pokemon (5x4+), deux colonnes d'équipe dynamiques (les encadrés s'empilent verticalement, couleur issue de `TEAM_COLORS`), sélecteur de nombre d'équipes + bouton "Remplir IA" dans la bottom bar. Les portraits sélectionnés ont un liseré coloré par équipe. Layout compact (lignes) pour 6+ équipes.

**Combat (écran principal)** : la grille isométrique occupe le centre. L'UI se répartit en périphérie :
- **Haut-gauche** : timeline des tours (colonne verticale de portraits, actif en haut avec bordure dorée, séparateur entre rounds)
- **Haut-centre** : info de tour ("Round X — Joueur Y — Pokemon")
- **Bas-gauche** : info panel du Pokemon sélectionné/survolé (portrait, nom, niveau, barre HP, badges de stats)
- **Droite** : menu d'actions (Déplacement/Attaque/Attendre) + sous-menu attaques avec tooltips
- **Haut-droite** : battle log (pliable, historique des actions)

**Sandbox** : même layout que le combat, avec un panel de config en haut-droite et une carte 6x6 réduite.

**Victoire** : overlay semi-transparent noir sur la scène de combat, texte doré "Player X wins!" centré, bouton vert "Restart".

### Mode pixel art

Le rendu Babylon applique le filtre `NEAREST` sur les textures pixel art (tileset terrain 3D, sprites Pokemon billboards) pour préserver des pixels nets sans affecter le rendu du texte.

`pixelArt: true` a été **écarté** : il applique NEAREST à toutes les textures, y compris les textures de texte (BitmapText), ce qui les rend flous — décision #220.

Les **portraits** restent en filtre `LINEAR` par défaut (haute résolution, pas de filtre NEAREST). Les appels `applyPortraitFilters()` ont été supprimés — inutiles sans `pixelArt: true`.

### Grille isométrique

La grille est le coeur visuel du jeu. Projection isométrique classique (losanges 32×16px world-space, rendu par zoom caméra). Tiles texturées via un tileset custom généré à partir des textures Pokemon Mystery Dungeon (même source que les sprites, plan 050), filtre NEAREST appliqué manuellement via `setFilter(NEAREST)` dans `BattleScene`. La grille flotte sur le fond sombre, ce qui crée naturellement une scène de "plateau de jeu".

**Dénivelés (plan 046)** : `gridToScreen(x, y, height)` décale le point de rendu vers le haut selon `TILE_ELEVATION_STEP`. Les tiles surélevées ont une depth ajustée (`DEPTH_GRID_TILES + y - height * 0.1`) pour le tri de profondeur correct. Les sprites Pokemon sont également décalés verticalement par la hauteur de leur tile.

Les overlays de grille utilisent des couleurs semi-transparentes superposées aux tiles :
- **Bleu** = allié, possibilité, buff (déplacement, zone de buff)
- **Rouge** = danger, attaque, dégâts (zone d'attaque, confirmation)
- **Orange** = menace ennemie (portée de déplacement ennemi au hover)
- **Jaune** = focus, curseur, sélection active

### Langage couleur sémantique

Le jeu utilise une sémantique de couleur cohérente dans tous les contextes (grille, texte, badges, log) :

| Signification | Couleur | Exemples |
|---------------|---------|----------|
| Allié / buff / positif | Bleu (`#4488cc`, `#4488ff`) | Highlight déplacement, stat up, équipe 1 |
| Ennemi / dégât / négatif | Rouge (`#cc4444`, `#ff4444`) | Zone d'attaque, stat down, équipe 2 |
| Menace / portée ennemie | Orange (`#dd6622`) | Overlay portée ennemi |
| Focus / actif / accent | Jaune doré (`#ffdd44`, `#ffcc00`) | Curseur, bordure active, titre |
| Soin / succès / validation | Vert (`#44cc44`, `#44dd44`) | HP haute, soin, bouton valider |
| Neutre / info / secondaire | Gris (`#aaaaaa`, `#cccccc`) | Texte secondaire, miss, info |
| Statut / altération | Violet (`#aa44dd`, `#6a3a8a`) | Confusion, badges volatils |
| Efficacité super | Jaune vif (`#ffcc00`) | "Super efficace" |
| Efficacité extrême | Orange (`#ff6600`) | "Extrêmement efficace" |

### Convention de lecture de l'UI

L'information la plus importante est toujours la plus visible :
- Le **Pokemon actif** a une bordure dorée pulsante dans la timeline et la caméra le suit
- Les **dégâts estimés** apparaissent en texte flottant avec un contour noir épais pour la lisibilité
- Les **stat changes** utilisent des badges colorés (bleu buff, rouge debuff) plutôt que du texte
- Les **statuts** sont représentés par des icônes miniatures (style Pokemon ZA) sur les sprites et dans la timeline

### Ce qui n'est PAS encore défini

- Animations d'attaque : pas de particules, pas d'effets visuels par type
- Son / musique : aucun asset audio
- Scaling des sprites par taille Pokemon : tous les sprites ont la même taille
- Décors / éléments de map : aucun élément décoratif
- Logo : le titre est du texte doré, pas de logo graphique
- Police Pokemon Emerald Pro : `@font-face` déclaré, mais le fichier TTF (`public/assets/fonts/pokemon-emerald-pro.ttf`) n'est pas encore intégré — fallback `monospace` actif

---

## Palette principale

### Fond et ambiance

| Couleur | Hex | Usage | Source |
|---------|-----|-------|--------|
| Bleu nuit | `#1a1a2e` / `0x1a1a2e` | Background canvas + CSS body + timeline BG | `BACKGROUND_COLOR`, `index.html` |
| Bleu sombre | `#111122` / `0x111122` | Panneaux UI (tooltip, action menu, battle log, timeline entries) | `TOOLTIP_BG_COLOR`, `ACTION_MENU_BG_COLOR`, `BATTLE_LOG_BG_COLOR` |

### Grille isométrique

| Couleur | Hex | Usage |
|---------|-----|-------|
| Vert forêt | `#4a7c59` / `0x4a7c59` | Remplissage des tiles |
| Vert foncé | `#2d5a3f` / `0x2d5a3f` | Contour des tiles |

### Highlights de grille

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Bleu allié | `#4488cc` / `0x4488cc` | 0.4 | Portée de déplacement (allié) + buff preview |
| Rouge attaque | `#cc4444` / `0xcc4444` | 0.4 | Zone d'attaque + outline de portée |
| Vert soin | `#44dd44` / `0x44dd44` | 0.5 | Preview AoE soin (`TILE_PREVIEW_HEAL_COLOR`, `HighlightKind.PreviewHeal`) |
| Jaune dash | `#ffdd44` / `0xffdd44` | 0.5 | Traînée de dash (`TILE_PREVIEW_DASH_COLOR`, `HighlightKind.PreviewDash`) — token CSS `--color-preview-dash` réutilise `--color-accent` |
| Orange ennemi | `#dd6622` / `0xdd6622` | 0.35 | Portée de déplacement ennemie (hover) |
| Jaune curseur | `#ffdd44` / `0xffdd44` | pulse 0.7–1.0 | Curseur de sélection tile (stroke 1px, diamant pulsant) |

### Zones de spawn (placement)

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Bleu clair | `#55aaff` / `0x55aaff` | 0.5 | Zone de spawn active |
| Gris bleuté | `#8888aa` / `0x8888aa` | `TILE_SPAWN_ZONE_INACTIVE_ALPHA` | Zone de spawn inactive |
| Bleu sombre | `#335577` / `0x335577` | `TILE_SPAWN_ZONE_OCCUPIED_ALPHA` | Zone de spawn occupée |

Constantes dans `packages/renderer/src/constants.ts` :

| Constante | Rôle |
|-----------|------|
| `TILE_SPAWN_ZONE_INACTIVE_ALPHA` | Alpha des quads de zone de spawn inactive (aucune pose joueur courant) |
| `TILE_SPAWN_ZONE_OCCUPIED_ALPHA` | Alpha des quads de zone de spawn déjà occupée par un Pokemon placé |

Les anciennes constantes `TILE_SPAWN_ZONE_ACTIVE_COLOR` / `TILE_SPAWN_ZONE_OCCUPIED_COLOR` ont été supprimées (code mort — la couleur est celle de l'équipe injectée à l'appel `setSpawnZones`).

### Direction picker (placement)

Le picker de direction (composant DOM `ui/dom/combat/direction-picker.ts`) place 4 flèches autour du Pokemon à poser. Chaque flèche est positionnée par **projection iso-correcte de la tuile voisine** dans la direction correspondante :

1. Pour chaque direction cardinale (N/S/E/O), calculer la coordonnée grille de la tuile voisine.
2. Projeter cette coordonnée via `CombatScene.projectTile(x, y)` → coordonnées écran.
3. Placer la flèche DOM à la position projetée (pas de vecteur fixe en pixels).

Cette approche garantit que les flèches restent alignées quelle que soit la rotation de caméra (snaps 90°). Le picker écoute `ResizeObserver` et recalcule les positions à l'ouverture uniquement (limitation acceptée à l'étape 6 — bug resize mineur reporté). Les flèches ont un état hover (preview de la direction) et confirment la pose au clic. Échap ou clic en dehors annule.

### Preview d'attaque

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Rouge preview | `#cc4444` / `0xcc4444` | 0.5 | Preview AoE attaque (`TILE_PREVIEW_ATTACK_COLOR`, `--color-preview-attack`) |
| Bleu preview | `#4488cc` / `0x4488cc` | 0.5 | Preview AoE buff (`TILE_PREVIEW_BUFF_COLOR`, `--color-preview-buff`) |
| Vert preview | `#44dd44` / `0x44dd44` | 0.5 | Preview AoE soin (`TILE_PREVIEW_HEAL_COLOR`, `--color-preview-heal`) |
| Jaune dash | `#ffdd44` / `0xffdd44` | 0.5 | Traînée de dash (`TILE_PREVIEW_DASH_COLOR`, `--color-preview-dash` = `--color-accent`) |
| Rouge outline | `#cc4444` / `0xcc4444` | 0.6 | Contour périmétrique de portée attaque |

> Les tokens CSS dans `tokens.css` (`--color-preview-attack`, `--color-preview-buff`, `--color-preview-heal`, `--color-preview-dash`) reflètent les constantes renderer (`TILE_PREVIEW_*_COLOR`) pour que la grille du MoveTooltip parle le même langage couleur que les surbrillances au sol. `--color-preview-dash` réutilise `--color-accent` (`#ffdd44`). Les anciennes constantes `TOOLTIP_CELL_COLOR_*` ont été supprimées (code mort).

---

## Équipes

Les couleurs d'équipe sont centralisées dans `TEAM_COLORS` (tableau de 12 valeurs dans `constants.ts`). L'index correspond à `playerIndex` (0 = P1, 1 = P2, etc.). Les composants n'utilisent plus de ternaires `player1 ? BLUE : RED` — ils indexent `TEAM_COLORS`.

| Index | Joueur | Couleur | Hex |
|-------|--------|---------|-----|
| 0 | Joueur 1 | Bleu | `#3B82F6` / `0x3B82F6` |
| 1 | Joueur 2 | Rouge | `#EF4444` / `0xEF4444` |
| 2 | Joueur 3 | Vert | `#22C55E` / `0x22C55E` |
| 3 | Joueur 4 | Jaune | `#EAB308` / `0xEAB308` |
| 4 | Joueur 5 | Violet | `#A855F7` / `0xA855F7` |
| 5 | Joueur 6 | Orange | `#F97316` / `0xF97316` |
| 6 | Joueur 7 | Cyan | `#06B6D4` / `0x06B6D4` |
| 7 | Joueur 8 | Rose | `#EC4899` / `0xEC4899` |
| 8 | Joueur 9 | Lime | `#84CC16` / `0x84CC16` |
| 9 | Joueur 10 | Brun | `#92400E` / `0x92400E` |
| 10 | Joueur 11 | Bleu clair | `#67E8F9` / `0x67E8F9` |
| 11 | Joueur 12 | Gris | `#9CA3AF` / `0x9CA3AF` |

Usage : InfoPanel (fond), TurnTimeline (pastilles), BattleLogPanel (dot d'équipe), zones de spawn (highlight placement), slots TeamSelectScene (bordures).

---

## HP Bars

La couleur de la HP bar est celle de l'équipe du Pokemon (`TEAM_COLORS[playerIndex]`). Le gradient vert/jaune/rouge a été remplacé en plan 042 pour améliorer la lisibilité en combat multi-équipes — décision #216.

Deux constantes de hauteur distinctes depuis le plan 044 :
- **`HP_BAR_HEIGHT = 2`** : barre HP sur les sprites en world-space (sans padding interne, le fill couvre toute la hauteur, contour via stroke)
- **`HP_BAR_PANEL_HEIGHT = 6`** : barre HP dans l'InfoPanel (plus grande pour la lisibilité UI)

| Couleur | Hex | Usage |
|---------|-----|-------|
| Couleur d'équipe | `TEAM_COLORS[playerIndex]` | Barre HP active |
| Gris fond | `#222222` / `0x222222` | Fond de la barre (alpha 0.9) |
| Noir bordure | `#000000` / `0x000000` | Bordure de la barre (stroke extérieur) |

### Estimation de dégâts

La preview de dégâts est affichée en noir semi-transparent depuis le plan 042 — décision #217. L'ancien rouge se confondait avec la couleur de l'équipe 2.

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Noir preview | `#000000` / `0x000000` | 0.5 | Zone HP preview dégâts (garanti + possible) |
| Gris immunité | `#888888` | — | Texte "Immune" |

---

## Types Pokemon

| Type | Hex | Usage |
|------|-----|-------|
| Feu | `#e85d3a` / `0xe85d3a` | Badge type, bordure sprite, tooltip |
| Eau | `#4a90d9` / `0x4a90d9` | idem |
| Plante | `#5dba5d` / `0x5dba5d` | idem |
| Normal | `#a0a0a0` / `0xa0a0a0` | idem (fallback par défaut) |
| Vol | `#9db7f5` / `0x9db7f5` | idem |
| Poison | `#a040a0` / `0xa040a0` | idem |

> Les autres types (17 au total) n'ont pas encore de couleur définie dans `TYPE_COLORS`.

---

## Texte flottant (BattleText)

### Couleurs

| Couleur | Hex | Usage |
|---------|-----|-------|
| Blanc dégâts | `#ffffff` | Dégâts normaux |
| Vert soin | `#44dd44` | Soin / drain |
| Gris miss | `#888888` | Attaque ratée |
| Gris immunité | `#888888` | Immunité de type |
| Orange extrême | `#ff6600` | Extrêmement efficace (x4) |
| Jaune super | `#ffcc00` | Super efficace (x2) |
| Gris clair | `#aaaaaa` | Peu efficace (x0.5) |
| Gris foncé | `#777777` | Très peu efficace (x0.25) |
| Bleu buff | `#4488ff` | Stat augmentée |
| Rouge debuff | `#ff4444` | Stat diminuée |
| Violet confusion | `#aa44dd` | Confusion |
| Orange chute | `#ff8800` | Dégâts de chute ("Fall -XX") |
| Gris info | `#dddddd` | Messages d'info divers |

### Comportement

Constantes dans `packages/renderer/src/constants.ts` :

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BATTLE_TEXT_FONT_SIZE` | `10` | Taille en pixels du texte (police `PokemonEmeraldPro`) |
| `BATTLE_TEXT_DURATION_MS` | `3500` | Durée avant disparition (fade complet) |
| `BATTLE_TEXT_DRIFT_Y` | `-20` | Drift vertical en pixels (le texte monte) |
| `BATTLE_TEXT_STAGGER_Y` | `-10` | Offset Y entre deux textes empilés (ex: dégâts + effectiveness) |
| `BATTLE_TEXT_STROKE_COLOR` | `#000000` | Contour noir pour lisibilité sur fond clair |
| `BATTLE_TEXT_STROKE_WIDTH` | `2` | Épaisseur du contour |
| `DEPTH_BATTLE_TEXT` | `1500` | Au-dessus de tout le combat, sous l'UI modale |
| `FLOATING_TEXT_SECONDARY_LIFT` | `0.38` | Offset vertical world-space appliqué au `baseY` du libellé « secondary » (efficacité de type). Évite le chevauchement entre le libellé secondaire et le chiffre de dégâts primaire émis au même beat. Les deux montent ensemble à partir de positions décalées. Constante dans `packages/view-core/src/constants.ts`, consommée par `packages/render-babylon/src/combat-scene.ts`. Introduit bug fix 2026-06-28 (intention design Phaser non câblée lors de la migration Babylon). |

Ces valeurs ont été retunées après feedback playtest (plan 046) — la police pixel art rendait les anciennes valeurs (`FONT_SIZE = 7`, `DURATION_MS = 2200`) trop petites et trop fugaces pour être lues en combat.

4 constantes Phaser-era retirées lors du même bug fix (code mort, jamais câblées dans Babylon) : les valeurs concernées étaient des offsets et échelles texte secondaire hérités du renderer Phaser, sans équivalent actif dans `combat-scene.ts`.

La clé i18n `battle.fall` (FR "Chute", EN "Fall") est utilisée par le handler `FallDamageDealt` dans `GameController.ts`. Jamais de texte hardcodé côté renderer.

---

## Icônes météo (Weather HUD)

Les 4 icônes météo (Soleil, Pluie, Neige, Tempête de Sable) sont des **SVG vectoriels** (`packages/app/public/assets/ui/weather/weather-{sun,rain,snow,sandstorm}.svg`) — glyphe blanc à contour noir sur un losange coloré, dérivées des pictogrammes officiels. Remplacent les anciennes PNG pixel-art (2026-07-21) — la Tempête de Sable en particulier (symbole tourbillon jugé peu lisible en pixel-art, backlog résolu → `docs/backlog-archive.md`).

| Météo | Couleur du losange | Hex |
|-------|---------------------|-----|
| Soleil | Jaune | `#FAD903` |
| Pluie | Bleu | `#5582A5` |
| Neige | Cyan clair | `#88F2FD` |
| Tempête de Sable | Orange | `#FBA819` |

`getWeatherIconUrl` (`packages/app/src/team/asset-paths.ts`) résout vers `.svg`. Taille `.wh-icon` (`packages/ui-dom/src/styles/weather-hud.css`) : **56u** (`calc(56 * var(--wh-px))`) — augmentée depuis 32u, jugée trop petite en jeu. `image-rendering: pixelated` conservé (sans effet visible sur du SVG net, mais laissé pour cohérence avec le reste du HUD pixel art).

---

## Battle Log

| Couleur | Hex | Usage |
|---------|-----|-------|
| Gris tour | `#aaaaaa` | Numéro de tour |
| Blanc move | `#ffffff` | Nom de l'attaque |
| Rouge dégâts | `#ff6666` | Points de dégâts |
| Jaune efficacité | `#ffdd00` | Efficacité de type |
| Orange statut | `#ffaa44` | Application de statut |
| Bleu stat up | `#4488ff` | Stat augmentée |
| Rouge stat down | `#ff4444` | Stat diminuée |
| Rouge KO | `#ff2222` | Pokemon mis KO |
| Vert défense | `#44cc66` | Attaque défensive (Protect, etc.) |
| Jaune victoire | `#ffee00` | Fin de combat |

---

## UI — Menus et boutons

### Boutons standards (menus)

| État | Fond | Bordure | Texte |
|------|------|---------|-------|
| Normal | `#335577` | `#5577aa` | `#ffffff` |
| Hover | `#446688` | — | — |
| Disabled | `#333344` | `#444455` | `#666666` |

### Boutons spéciaux

| Bouton | Fond | Bordure |
|--------|------|---------|
| Valider (team select) | `#335533` | `#558855` |
| Auto (team select) | `#333355` | `#555577` |
| Vider (team select) | `#443333` | `#775555` |
| Lancer combat | `#225522` | `#44aa44` |
| Toggle ON (settings) | `#44aa44` | `#66cc66` |
| Toggle OFF (settings) | `#774444` | `#996666` |

### Action menu (combat)

| Couleur | Hex | Usage |
|---------|-----|-------|
| Fond | `#111122` | Background (alpha 0.9) |
| Hover | `#334466` | Survol (alpha 0.6) |
| Titre | `#ffdd44` | Nom du menu |
| Texte normal | `#ffffff` | Options actives |
| Texte disabled | `#aaaaaa` | Options désactivées (alpha 0.4) |

### Écran de sélection de carte (plan 067)

| Élément | Hex | Constante |
|---------|-----|-----------|
| Panneau gauche (fond) | `#14142a` | `MAP_SELECT_LEFT_PANEL_BG_COLOR` |
| Item liste (normal) | `#222235` | `MAP_SELECT_LIST_ITEM_COLOR` |
| Item liste (sélectionné) | `#335577` | `MAP_SELECT_LIST_ITEM_SELECTED_COLOR` |
| Item liste (hover) | `#2a2a45` | `MAP_SELECT_LIST_ITEM_HOVER_COLOR` |
| Panneau détails (fond) | `#111122` | `MAP_SELECT_DETAILS_BG_COLOR` (alpha 0.75 via `MAP_SELECT_DETAILS_BG_ALPHA`) |
| Preview iso (fond) | `#0a0a18` | `MAP_SELECT_PREVIEW_BG_COLOR` |

---

## Stat Badges (InfoPanel)

| Couleur | Hex | Usage |
|---------|-----|-------|
| Bleu buff | `#1a4a8a` / `0x1a4a8a` | Badge stat augmentée |
| Rouge debuff | `#8a1a1a` / `0x8a1a1a` | Badge stat diminuée |
| Violet volatile | `#6a3a8a` / `0x6a3a8a` | Badge statut volatil (confusion, piège, etc.) |

---

## Symboles de genre (InfoPanel)

| Couleur | Hex | Usage |
|---------|-----|-------|
| Bleu mâle | `#5fa8ff` (`GENDER_SYMBOL_MALE_COLOR`) | Symbole `♂` à droite du nom |
| Rose femelle | `#ff7fb4` (`GENDER_SYMBOL_FEMALE_COLOR`) | Symbole `♀` à droite du nom |
| Genderless | — | Aucun symbole affiché |

Plan 071. Caractères Unicode `♂` / `♀` rendus dans le panneau info (DOM, `ui-dom`). Couleurs FFTA/PokeRogue-like.

---

## Sprites et KO

| Couleur | Hex | Usage |
|---------|-----|-------|
| Gris KO | `#444444` / `0x444444` | Tint sur sprite KO |
| Gris inactif | `#888888` / `0x888888` | Tint flèche direction inactive |
| Gris placed | `#555555` / `0x555555` | Portrait placement déjà placé |
| Gris unplaced | `#aaaaaa` / `0xaaaaaa` | Portrait placement disponible (fallback) |
| Noir ombre | `#000000` | Ombre ellipse sous sprites (alpha 0.35) |
| Blanc bordure | `#ffffff` | Bordure cercle sprite (alpha 0.6) |

---

## Move Tooltip (grille pattern)

La grille est pilotée par l'**intention** du move via `data-intent` sur `.mt-grid` (valeurs : `attack` / `buff` / `heal`) : tout l'ensemble affecté reçoit la couleur de son intention (rouge attaque / bleu buff / vert soin), exactement comme le sol. Les helpers partagés `moveIntent` / `selfPreviewRadius` dans `packages/view-core/src/move-intent.ts` fournissent l'intention et le rayon de self-preview.

**Cellules `data-cell`** (valeurs possibles) :

| Valeur `data-cell` | Signification | Rendu |
|--------------------|---------------|-------|
| `empty` | Case hors zone | fond neutre (`color-mix`) |
| `target` | Case cible de la zone | colorée selon `data-intent` |
| `dash` | Case sur le chemin de dash (avant l'arrivée) | jaune `#ffdd44` (`--color-accent`) |
| `caster` | Position du lanceur — non affecté par la zone (ex: centre Séisme, lanceur exclus de la AoE) | fond vide + croix ✖ |
| `caster-target` | Position du lanceur — affecté (self buff/soin/champ, ou move Self avec rayon) | colorée selon `data-intent` + croix ✖ |

**Règles** :
- La croix ✖ est le marqueur de la position du lanceur dans la grille. Elle n'apparaît que sur `caster` et `caster-target`.
- AoE Zone/Croix : la tile du lanceur est exclue (`caster` non coloré) — parité avec le sol où le lanceur est exclu des AoE.
- Dash : le chemin est peint en jaune (`dash`), la case d'arrivée reçoit la couleur d'intention de la cible (`target`).
- Move Self avec rayon (soin/cure/champ) : dessine une zone complète (`caster-target` au centre + cellules `target` autour).

| Cellule | Move attaque/statut | Move buff | Move soin | Usage |
|---------|---------------------|-----------|-----------|-------|
| `target` | `#cc4444` (`--color-preview-attack`) | `#4488cc` (`--color-preview-buff`) | `#44dd44` (`--color-preview-heal`) | Case cible |
| `caster` | fond vide + ✖ | fond vide + ✖ | fond vide + ✖ | Lanceur non affecté |
| `caster-target` | `#cc4444` + ✖ | `#4488cc` + ✖ | `#44dd44` + ✖ | Lanceur affecté (self buff/soin/champ) |
| `dash` | `#ffdd44` (`--color-accent`) | `#ffdd44` | `#ffdd44` | Chemin de charge |
| `empty` | `color-mix` fond | idem | idem | Case vide |

---

## Typographie

La police est centralisée dans la constante `FONT_FAMILY = "Pokemon Emerald Pro, monospace"` dans `constants.ts`. Tous les textes rendus dans le moteur (Babylon) utilisent cette constante. Le fichier TTF `public/assets/fonts/pokemon-emerald-pro.ttf` n'est pas encore intégré — la police se rabat sur `monospace` en attendant.

| Usage | Font | Taille | Couleur |
|-------|------|--------|---------|
| Texte UI général | `FONT_FAMILY` | 11–16px | `#ffffff` / `#cccccc` |
| Titre menu | `FONT_FAMILY` | 24px | `#ffcc00` (doré) |
| Sous-titre menu | `FONT_FAMILY` | 10–12px | `#aaaaaa` / `#666666` |
| Battle text | `FONT_FAMILY` | 14px | variable (voir section) |
| Battle log | `FONT_FAMILY` | 12px | variable (voir section) |
| Damage estimate | `FONT_FAMILY` | 13px | `#ffffff` (stroke `#000000` 3px) |

---

## Constantes de grille

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `TILE_WIDTH` | 32 | Largeur d'une tile en world-space (px) |
| `TILE_HEIGHT` | 16 | Hauteur d'une tile en world-space (px) |
| `TILE_ELEVATION_STEP` | 8 | Décalage vertical par niveau de hauteur dans `gridToScreen(x, y, height)` (plan 046) |

## Constantes de depth dynamique (animations)

Sur les cartes avec dénivelés, les frames PMDCollab d'attaque (lunge avant de 2 cases, windup arrière d'1 case) et de déplacement (Walk/Hop) peuvent déborder en dehors de la tile d'origine et se faire clipper par les tiles voisines surélevées. Pour éviter ce z-order incorrect, la depth du container sprite est temporairement élevée au maximum des tiles voisines dans un rayon donné le temps de l'animation, puis restaurée.

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `ATTACK_DEPTH_ENVELOPE_RADIUS` | `3` | Rayon (en tiles) scanné par `maxTileDepthInRadius` pendant une animation d'attaque (`PokemonSprite.playAttackAnimation`) |
| `MOVEMENT_DEPTH_ENVELOPE_RADIUS` | `1` | Rayon (en tiles) scanné pendant une animation de déplacement (`PokemonSprite.animateMoveTo`) |

La depth du container est portée à `max(originalDepth, maxTileDepthInRadius(cx, cy, r))` puis restituée à `originalDepth` à la fin de l'animation (callback `onComplete`). Helper privé `maxTileDepthInRadius(cx, cy, r)` dans `PokemonSprite.ts`.

---

## Curseur de survol (plan 060)

> **Note (chantier Post-Babylon d, 2026-06-17)** : la section ci-dessous décrit l'implémentation Phaser legacy (`packages/renderer`, hors-workspace). Dans le renderer Babylon actuel, le curseur est un **mesh voxel 3D** (voir § "Curseur FFTA hover" dans la section Babylon ci-dessous). La mécanique de switch de variantes (touche H, `HOVER_CURSOR_OPTIONS`, 4 PNG, setting Curseur) est supprimée — décisions #514-515.

Le highlight de tile au survol (`showCursor` dans `IsometricGrid`) reste un simple outline diamant jaune pulsant au sol, sous les sprites. En complément, un **HoverCursor** flotte au-dessus de la tile survolée par la souris (style FFTA) : pokéball avec flèche/cône jaune pointant vers le bas. Il suit le pointeur en même temps que le highlight de tile et disparaît quand la souris quitte la grille.

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `DEPTH_HOVER_CURSOR` | `960` | Depth du curseur flottant (au-dessus des sprites) |
| `HOVER_CURSOR_OPTIONS` | array | Variantes de curseur (key + label + scale). Choix stocké dans `getSettings().hoverCursorKey` (store `pt-settings`). Touche **H** pour cycler, ou paramètre **Curseur** dans `SettingsScene`. |
| `HOVER_CURSOR_GAP_Y` | `15` | Écart vertical en px entre la pointe de la flèche et le sommet de la tile |
| `CURSOR_COLOR` | `0xffdd44` | Jaune doré, réutilisé pour l'outline de tile pulsant |
| `DEPTH_CURSOR_GROUND` | `500` | Depth globale du curseur-outline au sol (au-dessus de tous les overlays iso, sous tous les Pokemon) |

Asset : `packages/renderer/public/assets/ui/cursor/hover-cursor.png` (32×32).
Classe : `packages/renderer/src/ui/HoverCursor.ts`. API : `showAt(gridX, gridY)` / `hide()`. Appelé depuis `BattleScene.setupInput` sur `pointermove`, en parallèle de `isometricGrid.showCursor/hideCursor`. Pas de bobbing (le pulse est porté par le highlight de tile).

Les overlays au sol (highlights move/attack, enemy range, preview AoE) sont iso-sortés par tile avec un offset croissant sur la base `(x+y)*5 + h` : ils passent sous le sprite du Pokemon qui se tient sur leur tile, et sont cachés entre eux selon la distance à la caméra (comme les tiles elles-mêmes). Le curseur-outline au sol, lui, utilise une depth globale `DEPTH_CURSOR_GROUND = 500` : sinon le stroke de la tile survolée passe sous les tiles/highlights des voisines (le stroke déborde visuellement sur les tiles adjacentes).

Layering (bottom → top) : tile (+0) → highlight move/attack (+0.1) → enemy range (+0.15) → preview AoE (+0.2) → cursor outline (500 global) → Pokemon (520+) → hover cursor (960) → UI 1000+.

---

## Décorations et obstacles (plan 064)

### Depth sorting des décorations

Les sprites de décorations s'intègrent dans le même espace de depth que les Pokemon (base `DEPTH_POKEMON_BASE = 520`), triés par Y grille. Des offsets sont ajoutés sur la depth iso `(gridX + gridY) * DEPTH_TILE_MAX_ELEVATION` :

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `DEPTH_DECORATIONS_OBSTACLE_OFFSET` | `0.3` | Obstacles (rochers, arbre) — légèrement au-dessus du Pokemon sur la même tile (un Pokemon ne peut pas s'arrêter dessus) |
| `DEPTH_DECORATIONS_TALL_GRASS_OFFSET` | `0.6` | Herbe haute — au-dessus du Pokemon pour masquer le corps, tête visible |
| `DEPTH_CURSOR_RAISED_TILE_OFFSET` | `0.4` | Curseur sur tile surélevée — au-dessus de l'obstacle (`0.3`) mais sous le Pokemon (`0.5`). FFTA-style (curseur au-dessus du Pokemon) reporté à une refonte dédiée (`project_cursor_ffta`). |

**Picking** : sur une tile avec obstacle, la hauteur de picking (`pickingHeightData`) reste au sol (hauteur de la tile de base), tandis que `heightData` utilise `getTileGroundHeight`. Le curseur est affiché au sommet de l'obstacle (`anchorY + heightUnits`). Ce split évite que le picking iso sélectionne la hauteur de l'obstacle au lieu de la tile sol cliquable.

### Preview mode des décorations

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `DECORATIONS_PREVIEW_MODE_ALPHA` | `0.45` | Alpha appliqué aux sprites de décoration pendant l'aperçu de déplacement ET le ciblage d'attaque — le joueur peut lire les tiles accessibles derrière les obstacles |

### Debug footprint (supprimé, 2026-07-20)

L'ancien toggle des losanges de debug sur les empreintes de décoration (`SandboxConfig.debugDecorationsFootprint` + checkbox SandboxPanel + constantes `DECORATIONS_DEBUG_FOOTPRINT_*` de `constants.ts`) est **entièrement supprimé** — 0 consommateur depuis la migration Phaser → Babylon (décision #686). Config, UI **et** constantes purgées.

### Layering décorations (bottom → top)

```
tile (+0) → highlight (+0.1) → enemy range (+0.15) → preview AoE (+0.2) →
cursor outline ground (500 global) →
Pokemon (520+, triés par Y) →
décoration obstacle (+0.3 sur Y grille) →
curseur sur tile surélevée (+0.4 sur Y grille) →
décoration herbe haute (+0.6 sur Y grille) →
hover cursor (960) → UI (1000+)
```

### Occlusion fade dynamique (plan 065)

Quand un Pokemon se trouve derrière une tile surélevée ou une décoration obstacle, le sprite obstacle voit son alpha abaissé pour laisser lire le Pokemon. Géré par le module `OcclusionFader` (`packages/renderer/src/grid/OcclusionFader.ts`).

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `OCCLUSION_FADE_ALPHA` | `0.4` | Alpha appliqué à l'obstacle qui occulte un Pokemon (valeur tuned pour lire le Pokemon sans effacer la silhouette) |
| `OCCLUSION_DEPTH_EPSILON` | `0.5` | Epsilon sur la comparaison de depth pour éviter le flicker sur la diagonale iso — strictement supérieur à `DEPTH_DECORATIONS_OBSTACLE_OFFSET (0.3)` : un obstacle sur la même tile qu'un Pokemon ne déclenche jamais le fade |
| `POKEMON_OCCLUSION_BBOX_SIZE` | `24` | Côté du AABB screen-space centré sur `container.x/y` pour tester l'overlap Pokemon-obstacle (approxime la silhouette visible PMDCollab, frames 32×80 → corps ~24 px de large) |

Pipeline : chaque frame ou event de déplacement, `OcclusionFader.update(pokemons, obstacles)` remet tous les alphas à 1 (reset), teste les overlaps AABB + comparaison depth, applique `OCCLUSION_FADE_ALPHA` aux obstacles occluseurs (apply). Helper `getPokemonScreenBounds` dans `sprite-bounds.ts` fournit l'AABB centré.

### Alt-click picking (plan 065)

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `COLOR_CURSOR_ALT` | `0xffd54f` | Jaune chaud — variante du curseur quand Alt est maintenu. Légèrement plus clair que `CURSOR_COLOR` pour signifier "sélection alternative" sans perdre l'affordance de sélection |

Quand la touche Alt est maintenue, le picking iso préfère la tile **sous** un pilier multi-niveaux (hauteur terrain, pas hauteur obstacle). Le curseur s'affiche dans la variante `"alt"` (jaune `COLOR_CURSOR_ALT`).

---

## Turn Timeline CT (plan 059)

La TurnTimeline en mode Charge Time affiche une séquence prédictive scrollable. Constantes dans `packages/renderer/src/constants.ts` :

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `TIMELINE_BG_COLOR` | — | Fond de la zone timeline |
| `TIMELINE_HIGHLIGHT_BORDER_COLOR` | teal-vert | Bordure du Pokemon actif au `confirm_attack` |
| `TIMELINE_PREDICTION_SLOTS` | `24` | Nombre de slots simulés par `predictCtTimeline` |
| `TIMELINE_VISIBLE_SLOTS` | `11` | Slots visibles simultanément (scroll à la molette) |

Constantes supprimées depuis plan 059 (remplaçaient le design ghost du plan 058) :
- `TIMELINE_GHOST_ALPHA`
- `TIMELINE_PREVIEW_SEPARATOR_COLOR`
- `TIMELINE_PREVIEW_SEPARATOR_COLOR_CSS`

La clé i18n `timeline.afterAction` (FR "Après action" / EN "After action") a également été supprimée.

---

## Profondeur des layers (depth)

Le layering garantit que les highlights passent **derrière** les sprites Pokemon (qui sont plus proches de la caméra en iso), et que le curseur reste toujours au-dessus des sprites.

| Layer | Depth | Usage |
|-------|-------|-------|
| Tiles plates (`elevation=0`) | `(x+y)*5 + h` (≈ 0–125) | Tiles de terrain au sol (iso-sort, `DEPTH_GRID_TILES = 0`) |
| Highlight move/attack (au sol) | `(x+y)*5 + h + 0.1` | Bleu déplacement, rouge attaque, outline de portée — tile au sol |
| Enemy range (au sol) | `(x+y)*5 + h + 0.15` | Overlay portée ennemie orange — tile au sol |
| Preview AoE (au sol) | `(x+y)*5 + h + 0.2` | Preview d'attaque — tile au sol |
| Curseur outline (au sol) | 500 (global) | Outline jaune pulsant au sol (`DEPTH_CURSOR_GROUND`) |
| **Tiles surélevées (`elevation>0`)** | **`520 + (x+y)*5 + h`** | `DEPTH_RAISED_TILE_BASE` (alias de `DEPTH_POKEMON_BASE`). Plan 065 — partage la même échelle depth que les Pokemon pour qu'un Pokemon derrière un pilier soit correctement occulté. |
| Highlight / preview / curseur sur tile surélevée | `520 + (x+y)*5 + h + offset` | Suit la tile (même base) + offsets habituels (`.1`, `.15`, `.2`) ou `+0.8` pour le curseur. |
| Pokemon (base) | `520 + (x+y)*5 + h + 0.5` | Sprites Pokemon (triés par Y, `DEPTH_POKEMON_BASE`) |
| Hover cursor (pokéball) | 960 | Pokéball + flèche au-dessus de la tile survolée |
| UI base | 1000 | Éléments UI de fond |
| Timeline | 1050 | Turn order |
| Info Panel | 1100 | Panel d'info Pokemon |
| Action Menu | 1200 | Menu d'actions |
| Tooltip | 1250 | Tooltip move |
| Battle Log | 1300 | Panel de log |
| Battle Text | 1500 | Texte flottant (dégâts, miss, etc.) |
| Victory overlay | 2000 | Écran de victoire (fond) |
| Victory content | 2001 | Écran de victoire (texte) |

> Historique : avant le bugfix du 2026-04-14, highlights (100–150) et Pokemon (200+) étaient inversés — les highlights passaient devant les sprites. `DEPTH_POKEMON_BASE` était à 200. Depuis plan 060, les overlays au sol (highlights, enemy range, preview) sont iso-sortés par tile et passent sous le Pokemon qui se tient dessus. Le curseur-outline, lui, est repassé en depth globale (`DEPTH_CURSOR_GROUND = 500`) en fin de plan 060 : son stroke déborde visuellement sur les tiles adjacentes, donc il doit dominer tous les voisins iso-sortés.

> Plan 065 (2026-04-20) — les **tiles surélevées** (`elevation > 0`) ont été promues dans l'espace depth `DEPTH_POKEMON_BASE` (constante alias `DEPTH_RAISED_TILE_BASE`). Avant ce changement, les tiles étaient dans `[0, 205]` et les Pokemon dans `[520+]` ; un Pokemon derrière un pilier était **toujours** affiché devant. Les tiles plates restent à `DEPTH_GRID_TILES = 0` pour ne pas polluer l'espace Pokemon avec les centaines de cellules de fond — elles passent toujours sous tout le reste, zéro ambiguïté. Les highlights, previews et curseurs sur une tile surélevée suivent la même base pour rester visuellement attachés à leur tile.

---

## Overlay Babylon — UI ancrée écran (cat. B)

> Phase 5 Jalon 2b. Source : `packages/renderer/src/styles/info-panel.css` + `tokens.css`.

### Contrat de couche (rappel)

Deux catégories d'UI sous `#game-overlay` (lui-même aligné pixel-près sur le canvas Babylon via `ResizeObserver`) :

| Catégorie | Classe | Ancrage | Scaling |
|-----------|--------|---------|---------|
| Monde (cat. A) | `.ui-world` | `transform: translate()` par frame (projection 3D→écran) | n/a (px directs) |
| Écran (cat. B) | `.ui-screen` | Bords du root overlay (CSS `position: absolute`) | container-query units |

> Ancien nom `.ui-chrome` → renommé `.ui-screen` (décision #468). `chromeLayer` → `screenLayer` dans `game-stage.ts`.

### Scaling container-query (cat. B)

Les panneaux écran (InfoPanel, timeline, menus) utilisent des **container-query units** plutôt que `--ui-scale` JS :

```css
#game-stage { container-type: size; container-name: stage; }

/* 1 px design @ 1920px de largeur stage */
--ip-px: calc(100cqw / 1920);
```

Usage : `padding: calc(8 * var(--ip-px))` = 8 px design → scale proportionnel à la largeur réelle du stage.

- `--ui-scale` (publié par `ResizeObserver` sur `#game-stage`) reste disponible comme fallback JS pour les cas où les container queries ne suffisent pas.
- Compat : Safari 2026 + Chrome + Firefox supportent les container queries (`cqw`/`cqi`).

### Reflow mobile

```css
@container stage (width < 768px) {
  /* barre bas pleine largeur, scale sur ref 768 */
}
```

Panneaux collapsés/stackés sous 768 px (style PokeRogue). Pas de shrink illisible.

### Tokens équipe et badges (tokens.css)

Ajoutés au Jalon 2b — miroir des constantes canvas dans `constants.ts` :

| Token | Valeur de référence | Usage DOM |
|-------|---------------------|-----------|
| `--team-1` … `--team-12` | Miroir `TEAM_COLORS[0..11]` | Fond/bordure panneau équipe, barre HP |
| `--color-badge-buff-bg` | Miroir `STAT_BADGE_BUFF_BG` (`#1a4a8a`) | Badge stat augmentée |
| `--color-badge-debuff-bg` | Miroir `STAT_BADGE_DEBUFF_BG` (`#8a1a1a`) | Badge stat diminuée |
| `--color-badge-volatile-bg` | Miroir `STAT_BADGE_VOLATILE_BG` (`#6a3a8a`) | Badge statut volatil |
| `--color-tempo-light` | `var(--green-500)` | Pastilles tempo CT léger (move bon marché) |
| `--color-tempo-medium` | `var(--yellow-400)` | Pastilles tempo CT modéré |
| `--color-tempo-heavy` | `var(--red-400)` | Pastilles tempo CT lourd (rejoue plus tard) |
| `--color-border-faint` | Semi-transparent blanc feutré | Bordure douce panneaux |

Pastilles « tempo » (`.bc-move-tempo`, `.tb-move-tempo`) : `●`/`○` 1–5 indiquant le poids du coût CT
d'un move (vert léger → ambre → rouge lourd), via `data-tempo`. Remplace l'ancienne colonne PP.

### Police PokemonEmeraldPro — `@font-face` dans tokens.css

Depuis le Jalon 2b, le `@font-face` de PokemonEmeraldPro est déclaré dans `tokens.css`. Cela garantit que tout point d'entrée charge la police sans tomber en fallback `monospace`.

---

## CSS vars — Team Builder DOM

Source canonique : `packages/app/src/styles/tokens.css`. Ces tokens s'appliquent à l'interface DOM du Team Builder. Pour les valeurs du rendu moteur (Babylon), `constants.ts` reste la source.

> La distinction est nette : **`tokens.css` = DOM HTML**, **`constants.ts` = rendu moteur (Babylon)**.

### Couleurs types Pokemon (badges)

Les couleurs de type sont extraites du pixel dominant des icônes `assets/ui/types/*.png` via sharp. Elles sont stockées comme CSS custom properties : `--type-fire`, `--type-water`, `--type-grass`, etc. (18 types). Le badge background = couleur icon → cohérence visuelle garantie.

### Spacing et padding

| Token | Usage |
|-------|-------|
| `--pad-control-*` | Padding des contrôles interactifs (inputs, selects, boutons textuels) |
| `--pad-chip-*` | Padding des chips/badges (badges types, tags items) |
| `--pad-icon-btn` | Padding uniform des boutons icônes (×, close) |
| `--target-min: 24px` | Taille tactile minimale WCAG — appliquée à tous les boutons icônes |

### Couleurs stats (barres stats Team Builder)

| Token | Stat |
|-------|------|
| `--stat-hp` | HP |
| `--stat-atk` | Attaque |
| `--stat-def` | Défense |
| `--stat-spa` | Attaque Spéciale |
| `--stat-spd` | Défense Spéciale |
| `--stat-spe` | Vitesse |

### Feedback

| Token | Usage |
|-------|-------|
| `--color-error` | Texte/bordure erreur (import Showdown invalide) |
| `--color-warn` | Texte/bordure avertissement (item non implémenté) |

### Typographie

| Token | Usage |
|-------|-------|
| `--font-size-xs` | Texte très petit (tags, notes) — anciennement `--font-size-min` |
| `--font-mono` | Pile police monospace (code Showdown, textarea import/export) |

### Variantes boutons

Les variantes de boutons utilisent `color-mix()` plutôt que des hex hardcodés : `--btn-primary-bg`, `--btn-ghost-hover`, `--btn-border`. Conforme `.claude/rules/css.md`.

### Architecture CSS (@layer)

```
@layer reset      ← html, body uniquement (margin 0, box-sizing)
@layer base       ← règles de base typographie, focus visible
@layer components ← composants Team Builder (button, modal, type-badge, topbar...)
@layer utilities  ← classes utilitaires (display, gap, flex...)
```

L'ordre des layers garantit que `components` l'emporte sur `base` sans `!important`. Le bug historique (`* { padding:0; margin:0 }` hors layer dans `index.html`) a été corrigé — wrappé dans `@layer reset`, scope réduit à `html, body`.

### Scrollbars fines (convention globale)

Dans `base.css`, règle globale appliquée à tous les éléments scrollables :

```css
* { scrollbar-width: thin; scrollbar-color: var(--color-border-surface) transparent; }
```

Résultat : scrollbars discrètes cohérentes sur tout l'écran (Firefox/Chrome). Évite les barres scrollbar native épaisses qui cassent les layouts compacts (ex: `.ts-team-row-portraits` en fenêtre étroite).

---

## CSS — Sandbox Studio (plan 091)

Source : `packages/renderer/src/styles/sandbox-studio.css` + tokens `tokens.css`.

### Règles de codage

- **Zéro inline style** dans `SandboxPanel.ts` et `LanguageToggle.ts` : toutes les couleurs et propriétés structurelles passent par classes CSS ou tokens. Hex literals hardcodés (`#222`, `#1a1a2e`, etc.) interdits dans les composants TS — décision #347.
- **Tokens plutôt que valeurs brutes** : les couleurs utilisent les custom properties de `tokens.css` (`--color-bg-elevated`, `--color-bg-surface`, `--color-border-surface`, `--color-text-muted`, `--color-text-secondary`, `--color-btn-*`).
- **Aucun `!important`** : les surcharges locales passent par la spécificité CSS, pas par `!important`.
- **Attributs `data-*` pour les variantes** : ex. `data-control-mode="ai|player"` sur `.sb-section` → CSS cible `.sb-section[data-control-mode="ai"] .sb-moves-grid { display: none }`.

### Classes `.sb-*`

| Classe | Usage |
|--------|-------|
| `.sb-section` | Section de panneau (accordion / groupe de contrôles) |
| `.sb-section-title` | En-tête de section |
| `.sb-grid` | Grid layout de contrôles |
| `.sb-col` | Colonne dans `.sb-grid` |
| `.sb-form-row[data-layout]` | Ligne de formulaire (layout `"inline"`, `"stack"`, etc.) |
| `.sb-form-label[data-width]` | Label avec largeur relative (`"sm"`, `"md"`, `"lg"`) |
| `.sb-form-input[data-size]` | Input avec taille (`"sm"`, `"md"`, `"lg"`) |
| `.sb-form-value` | Valeur affichée en lecture seule |
| `.sb-picker-card` | Carte cliquable (Pokemon picker, move picker) |
| `.sb-stepper` | Composant stepper (−/valeur/+) — généré par `Stepper.ts` |
| `.sb-stat-stages` | Grille des modificateurs de stat |
| `.sb-stat-cell` | Cellule stat dans `.sb-stat-stages` |
| `.sb-radio-group` | Groupe de radio buttons |
| `.sb-radio-option` | Option radio individuelle |
| `.sb-moves-grid` | Grille des 4 moves (partagée via `createMovesList`) |
| `.sb-strip-left` / `.sb-strip-right` | Bandes colorées gauche/droite (couleur équipe) |
| `.sb-language-toggle` | Bouton de bascule FR/EN en mode normal |
| `.lang-toggle-floating` | Variante flottante (position fixe hors sandbox) |

---

## Overlay UI Babylon (Phase 5 — contrat de couche)

> Renderer Babylon en cours (worktree `phase5-babylon`, plan 119). L'UI est 100% DOM/CSS au-dessus du canvas (décision D4, pas de `@babylonjs/gui`).

- **Canvas plein viewport, pas de letterbox** (décision #472) : `#game-stage` remplit 100% du viewport ; la caméra orthographique dimetric « comble » selon le ratio (montre plus/moins de scène). Zéro bande noire, tout ratio (ultrawide, mobile portrait). Révise les décisions 2a/2b #464-468 (qui partaient d'un stage letterboxé 16:9).
- **Structure** : `#game-root > #game-stage (container-type:size, container-name:stage) > (canvas + #game-overlay > .ui-world + .ui-screen)`. `.ui-world` = UI ancrée-monde (barres PV, curseur), reprojetée par frame. `.ui-screen` = panneaux ancrés-écran (InfoPanel, menus, Team Builder).
- **Scaling chrome (cat. B) via container-query units** : chaque métrique = `calc(N * --px)` avec `--px = calc(100cqw / 1920)` (1px design @ ref 1920), résolu contre `#game-stage`. 100% CSS, scale proportionnel à la taille du jeu sans JS. Reflow mobile `@container stage (width < 768px)` → ref 768 (≈2.5× plus gros, style PokeRogue). `--ui-scale` (publié par `ResizeObserver`) reste un fallback.
- **Adapter Team Builder prod-safe** (décisions #470-471) : overrides cqw cloisonnés dans `@container stage`, raw px wrappés `var(--tb-*, <px-original>)` → l'app prod (hors stage) garde son rendu d'origine.
- **Pistes différées best-practices** (validées agent, marché 2026) : plancher font-size `max(calc(N·--px), Xpx)` pour 480-767px ; `--stage-scale` sur `:root` pour les modales `<dialog>` top-layer (qui échappent au container) ; cap ultrawide `min(100cqw/1920, 100cqh/1080)` ; `--ui-scale` barres PV monde pour 4K.

### Constantes Babylon — caméra, depth, silhouette (Jalon 3a)

Source canonique : `packages/renderer/src/babylon/babylon-constants.ts`.

#### Caméra dimetric

| Constante | Rôle |
|-----------|------|
| `BABYLON_VIEW_SIZE` | Taille ortho de la caméra (demi-largeur monde visible) |
| `BABYLON_CAMERA_NEAR` | Plan de clipping near |
| `BABYLON_CAMERA_FAR` | Plan de clipping far |
| `BABYLON_DIMETRIC_ELEVATION` | Angle d'élévation de la caméra (vue dimetric) |
| `BABYLON_AZIMUTH_STEP` | Pas de rotation azimutale pour les snaps 90° (←/→) |
| `BABYLON_ROTATION_LERP` | Facteur d'interpolation (lerp) pour la rotation caméra animée |
| `BABYLON_CAMERA_PAN_LERP` | Facteur d'interpolation (lerp) du recentrage caméra (pan smooth sur le Pokemon actif) |
| `BABYLON_CAMERA_PAN_EPSILON` | Distance monde sous laquelle le pan snap sur sa cible (arrête le lerp) |
| `BABYLON_ZOOM_LEVELS` | Zoom **3 crans discrets** `[0.7, 1.1, 1.8]` (Vue d'ensemble / Moyen / Rapproché), facteurs ortho relatifs à `BABYLON_VIEW_SIZE` — plus haut = plus proche. La molette avance/recule d'1 cran par notch, clampé aux bornes du tableau (pas de zoom continu). |
| `BABYLON_ZOOM_DEFAULT_INDEX` | Index de départ dans `BABYLON_ZOOM_LEVELS` (`1` = Moyen) |
| `BABYLON_ZOOM_LERP` | Facteur d'interpolation (lerp) du zoom courant vers le cran cible sélectionné — même pattern que `BABYLON_ROTATION_LERP`/`BABYLON_CAMERA_PAN_LERP` (easing sur les transitions de cran, pas de saut sec) |
| `BABYLON_ZOOM_LERP_EPSILON` | Distance en-dessous de laquelle le zoom snap sur sa cible (arrête le lerp) |

**Zoom à crans (2026-07-22)** : le zoom caméra est passé d'un scale continu à **3 niveaux fixes**, avec easing entre crans (`IsometricCamera.tick`, `packages/render-babylon/src/isometric-camera.ts`), même pattern que l'azimut/pan (index cible + lerp par frame). `zoomByWheel(deltaY)` avance/recule d'1 index par notch de molette et clamp `[0, ZOOM_LEVELS.length - 1]`. Les anciennes constantes de zoom continu (`ZOOM_MIN`/`ZOOM_MAX`/`ZOOM_STEP`) sont **supprimées** — remplacées par `ZOOM_LEVELS`/`ZOOM_DEFAULT_INDEX`. Constantes sources dans `packages/view-core/src/constants.ts` (`ZOOM_LEVELS`, `ZOOM_DEFAULT_INDEX`, `ZOOM_LERP`, `ZOOM_LERP_EPSILON`), re-exportées côté Babylon sous préfixe `BABYLON_` (`babylon-constants.ts`). Portée réduite vs le besoin initial : le cadrage/bornes **adaptatifs à la taille de la carte** (backlog 2026-06-19) est écarté pour l'instant, voir `docs/backlog.md`.

#### Sprites

| Constante | Rôle |
|-----------|------|
| `BABYLON_SPRITE_PIXELS_PER_UNIT` | Densité sprite en px/unité Babylon (= densité tile = 24 px/u, parité 1:1). Décision #455. |
| `BABYLON_SPRITE_GROUND_OFFSET_PX` | Offset Y pieds → centre du frame (fallback = 5 si `offsets.json` absent). Décision #462. |
| `BABYLON_HUD_ANCHOR_MARGIN_PX` | Marge verticale en px écran entre la tête du sprite et la barre de PV (= 20). Décision #463. |

#### Occlusion & silhouette (Jalon 3a)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_SPRITE_DEPTH_BIAS` | `0.0025` | Biais depth appliqué par `SpriteDepthPlugin` pour positionner le `gl_FragDepth` du sprite légèrement devant sa tile d'ancrage, évitant le z-fighting avec le terrain tout en permettant l'occlusion par le relief plus haut. Décision #473. |
| `BABYLON_SILHOUETTE_ALPHA` | `1` | Opacité de la silhouette X-ray (couleur d'équipe pleine). La silhouette est un 2e plane avec `depthFunction=GREATER` + pas d'écriture depth, rendu en `renderingGroupId 1`. `setRenderingAutoClearDepthStencil(1, false)` préserve le depth buffer du groupe 0. Décision #474. |

#### États sprite intrinsèques (Jalon 3d)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_SEMI_INVULNERABLE_LIFT` | `1.5` | Lift en unités monde appliqué au billboard quand un Pokémon est en état semi-invulnérable de vol (Vol/Bounce/Fly). L'ombre reste au sol. Décision #481. |
| `BABYLON_PULSE_PERIOD_MS` | `900` | Période en millisecondes du pulse de respiration emissive du sprite actif (`setActive`). |
| `BABYLON_DAMAGE_FLASH_DIM_EMISSIVE` | `0.25` | Niveau de gris de la valeur emissive pendant un flash de dégâts (`flashDamage`). Le matériau oscille entre emissive nulle et `(0.25, 0.25, 0.25)` pour signaler le coup. |

#### Décorations — meshes voxel (annule Jalon 3e billboards 2D, décision #690)

Les décorations (arbre, herbe haute, rochers 1×1/2×2) sont passées de billboards 2D face caméra à des **meshes voxel `.glb`**, rendus par `packages/render-babylon/src/babylon-decorations.ts` (pipeline mirroré sur `babylon-entry-hazards.ts`, plan 131). Décision #690, voir `docs/decisions.md` et `docs/references/voxel-tile-placement.md` pour le détail technique complet (pipeline d'export, lift auto-mesuré, axe Z-up Goxel).

Constantes **supprimées** (billboards 2D retirés) : `BABYLON_DECORATION_FOOT_DROP` et `BABYLON_DECORATION_DEPTH_BIAS` — n'existent plus dans `babylon-constants.ts`. `BABYLON_GRASS_ALPHA_INDEX` (alphaIndex du plane ALPHABLEND tall-grass) supprimée également. `BABYLON_SHADOW_ALPHA_INDEX` **reste** (ombre au sol du Pokémon, sans lien avec les décorations).

**Vent (shader)** : `packages/render-babylon/src/shaders/decoration-wind-plugin.ts` — nouveau dossier `shaders/`, convention pour les plugins de matériau (`MaterialPluginBase`) du renderer Babylon. `DecorationWindPlugin` déplace les sommets horizontalement, pondéré par la hauteur du sommet dans le mesh (base figée au sol, seul le haut ondule — tronc/racines/pied d'herbe ne bougent jamais). Constantes de tuning dans `babylon-decorations.ts` :

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `WIND_PERIOD_MS` | `2600` | Période du cycle de vent (ms), horloge partagée par tous les plugins de vent actifs |
| `TREE_WIND_AMPLITUDE` | `0.035` | Débattement horizontal (unités monde) du sommet de l'arbre à pleine amplitude |
| `GRASS_WIND_AMPLITUDE` | `0.07` | Débattement horizontal de l'herbe haute — plus "ressort" que l'arbre |

Herbe haute rendue dans `BABYLON_SPRITE_RENDERING_GROUP` (groupe des sprites, `2`) pour ne jamais déclencher la silhouette X-ray (les unités se tiennent *dans* l'herbe, pas derrière). Rochers et arbre restent en `renderingGroupId 0` (avec le terrain) — occlusion normale, comme les entry hazards.

#### Curseur FFTA hover (chantier Post-Babylon d — révise Jalon 3c)

Le curseur de survol est désormais un **mesh voxel 3D unique** (`cursor.glb`, modélisé à l'origine sur voxigen.io), chargé via GLTF. Il tourne avec la caméra (vrai objet 3D), est opaque (`hasVertexAlpha=false`), et n'est **pas configurable** (aucun switch de variantes — décision #514). La mécanique de switch (touche H, `HOVER_CURSOR_OPTIONS`, 4 PNG) est retirée. Source éditable (pipeline Goxel, décision #681) : `assets-src/voxel/goxel/cursor.gox` — ancienne source Voxigen archivée en `assets-src/voxel/voxigen/cursor.vxb`.

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_HOVER_CURSOR_GAP` | `0.35` | Décalage vertical en unités monde entre la surface de la tuile et la base du curseur quand aucun Pokémon n'est présent. Quand un Pokémon occupe la tuile, le curseur se lève à `spriteTopOffsetY` (fallback `BABYLON_SPRITE_HEAD_LIFT_FALLBACK`). Décision #479 / #515. |

#### Rendering groups (refonte silhouette terrain-only — plan 120)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_SILHOUETTE_RENDERING_GROUP` | `1` | Meshes silhouette X-ray — testent la depth vs terrain seul (group 0). |
| `BABYLON_SPRITE_RENDERING_GROUP` | `2` | Sprites Pokémon — s'occluent normalement et ne réalimentent pas le test silhouette (plus de X-ray entre Pokémon). |
| `BABYLON_HOVER_CURSOR_RENDERING_GROUP` | `3` | Curseur FFTA + flèches direction — toujours visibles, hors test silhouette. (Était `2`.) |

Group 0 = terrain / décor / ombres. `setRenderingAutoClearDepthStencil(2, false)` conserve la depth terrain pour les sprites. Décision #489.

#### Tile highlights & picking (Jalon 3b)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_TILE_HIGHLIGHT_Z_OFFSET` | `-2` | Polygon offset (`material.zOffset`) appliqué aux quads de surbrillance pour les rendre flush sur la face top des tiles extrudées sans lift world-Y (un lift décalait le quad en projection ortho et faisait baver la couleur sur les arêtes des murs). Décision #478. |
| `BABYLON_TILE_OUTLINE_Y_OFFSET` | `0.02` | Micro-lift world-Y appliqué aux `LineSystem` de contour de portée. Les lignes Babylon ne supportant pas le polygon offset, un léger décalage Y évite le z-fighting avec la tile sans artifact géométrique visible. Décision #478. |
| `BABYLON_TILE_HIGHLIGHT_ALPHA` | `0.4` | Alpha des fills de surbrillance (move bleu, attack rouge, retreat cyan, enemy orange). |
| `BABYLON_TILE_CURSOR_WIDTH` | `0.05` | Épaisseur (unités monde) du contour jaune `CURSOR_COLOR` du curseur de survol de tile. Rendu via `GreasedLine` car WebGL n'épaissit pas les lignes 1px (`lineWidth` ignoré). |
| `BABYLON_TILE_RANGE_OUTLINE_WIDTH` | `0.06` | Épaisseur (unités monde) du contour de portée attaque/déplacement. Rendu via `CreateGreasedLine` (remplace `CreateLineSystem`, qui ne donnait qu'un trait 1px). Recette Phase 5 (décision #498 context). |
| `BABYLON_PICK_DRAG_THRESHOLD_PX` | `5` | Seuil en pixels de déplacement de la souris entre `pointerdown` et `pointerup` en-dessous duquel l'événement est interprété comme un **clic** (sélection de tile) et non un **pan** caméra. |
| `BABYLON_TILE_HEIGHT_SCALE` | `0.866` | Aplatissement des faces latérales des tuiles dans `tileBodyHeight` (le diamant du dessus / footprint reste 1×1). Applique le ratio mur:largeur du pipeline 2D (`TILE_ELEVATION_STEP 16 : TILE_WIDTH 32`) à la caméra iso vraie 35.26°. Décision #497. |
| `BABYLON_ATTACK_DEPTH_BIAS` | `0.012` | Biais foot-depth additionnel pendant une animation d'attaque (`setAttacking`). Une tuile coplanaire ne clippe plus le sprite ; les tuiles plus hautes / piliers occludent encore (biais < un pas de hauteur). Décision #499. |

Constantes **supprimées** en recette Phase 5 : `BABYLON_GRASS_ALPHA_INDEX` (herbe migrée groupe terrain → sprite, décision #496) et `BABYLON_MOVE_JUMP_ARC` (arc de saut remplacé par `BABYLON_JUMP_VERTICAL_LEAD`, décision #492).

#### Placement — zones de spawn (Jalon 4a étape 6)

Source canonique : `packages/renderer/src/constants.ts`.

| Constante | Rôle |
|-----------|------|
| `TILE_SPAWN_ZONE_INACTIVE_ALPHA` | Alpha des quads de surbrillance pour une zone de spawn inactive (aucune pose en cours du joueur courant). |
| `TILE_SPAWN_ZONE_OCCUPIED_ALPHA` | Alpha des quads de surbrillance pour une case de zone déjà occupée par un Pokemon placé. |

La couleur des quads est celle de l'équipe (`TEAM_COLORS[playerIndex]`) injectée à l'appel `setSpawnZones(zones, teamColor, inactiveAlpha, occupiedAlpha)` dans `babylon-tile-highlights.ts`. Les constantes `_ACTIVE_COLOR` / `_OCCUPIED_COLOR` ont été supprimées (code mort).

#### Zones de Champ (field terrains) — Jalon 3e

Source canonique : `packages/renderer/src/babylon/babylon-constants.ts`.

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_FIELD_TERRAIN_FILL_ALPHA` | `0.3` | Alpha du fill de zone de Champ. Blend alpha standard retenu (le blend additif 2D était trop agressif sur les textures claires). Décision #483. |
| `BABYLON_FIELD_TERRAIN_ALPHA_INDEX` | `2` | `alphaIndex` des quads ALPHABLEND de fill — au-dessus de l'ombre (`0`), sous les sprites. Convention alphaIndex obligatoire. Décision #483. (NB : l'herbe n'utilise plus d'alphaIndex depuis sa migration en groupe sprite, décision #496.) |
| `BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH` | `0.04` | Largeur du contour `GreasedLine` en world units. Insetté d'une demi-largeur vers l'intérieur de la tile pour anti-clip murs voisins plus hauts. Décision #484. |

#### Liquides — transparence, cuvette, immersion, écume (plan 166)

Source canonique : `packages/render-babylon/src/terrain-extruder.ts`, `babylon-constants.ts`, `shaders/water-foam-material.ts`, `directional-billboard.ts`, `combat-scene.ts` ; ratios `LIQUID_SURFACE_RATIO`/`LIQUID_DEPTH_RATIO` dans `packages/view-core/src/constants.ts` (ré-exportés `BABYLON_LIQUID_SURFACE_RATIO`/`BABYLON_LIQUID_DEPTH_RATIO`).

Chaque tuile liquide **franchissable** rend soit deux boîtes empilées, soit une colonne pleine, selon le groupe :

- **Eau (`water`) et marais (`swamp`)** : un fond opaque `tile_x_y` (0 → 3/6 du corps, pickable, texture sable) et une nappe translucide `liquid_surface_x_y` (3/6 → 5/6, non pickable). La surface commune à **5/6** laisse **1/6** d'air sous le sol solide voisin = l'effet cuvette.
- **Eau profonde (`deep_water`) et lave (`lava`)** : **colonne pleine unique 0 → 5/6**, pas de fond séparé — l'eau profonde se lit "sans fond visible", la lave comme un corps de roche en fusion continu (2026-07-23 : la lave a rejoint cette branche, quittant le groupe fond+nappe initial du plan 166 — supprime le seam demi-bloc visible à 3/6 entre un fond roche et une nappe distincte).

Les faces latérales intérieures entre deux tuiles liquides adjacentes sont cullées (matériau invisible dédié) pour fusionner en un bassin continu, sans « murs sous l'eau ».

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `LIQUID_SURFACE_RATIO` | `5/6` | Sommet de la nappe/colonne liquide — commun à tous les liquides. |
| `LIQUID_DEPTH_RATIO` | `3/6` | Sommet du fond (eau/marais/lave) **et** ancrage des pieds d'un Pokemon au sol sur liquide. |
| `BABYLON_LIQUID_ALPHA_BY_GROUP` | eau `0.6`, eau profonde `0.5`, marais `0.9`, lave `0.99` | Opacité de la nappe/colonne par groupe — marais trouble, eau profonde la plus claire, lave quasi-opaque mais reste dans la passe transparente (jamais de X-ray de la silhouette d'un mon immergé). |
| `BABYLON_LIQUID_WATER_ALPHA` | `0.6` | Fallback si un groupe liquide n'a pas d'entrée dédiée. |
| `BABYLON_LIQUID_SURFACE_ALPHA_INDEX` | `1` | `alphaIndex` de la nappe/colonne — après l'ombre (`0`), avant l'écume/les Champs (`2`). |
| `BABYLON_WATER_FOAM_ALPHA_INDEX` | `2` | `alphaIndex` de l'écume de flottaison — dessinée après la nappe pour lire par-dessus l'eau. |

**Rendering group** : la nappe/colonne translucide est dessinée dans `BABYLON_SPRITE_RENDERING_GROUP` (groupe 2, comme les billboards Pokemon), pas dans le groupe terrain (0) — diverge du draft initial. Conséquence : elle est dessinée **après** les billboards → un Pokemon immergé est vu **à travers** l'eau, tout en restant occulté par le terrain plus haut devant (depth partagée, `disableDepthWrite` sur son matériau). Elle ne déclenche jamais la silhouette X-ray (pas d'écriture depth) — seuls les vrais murs terrain (groupe 0) la déclenchent. Décision #693.

**Immersion des sprites** (`directional-billboard.ts`/`combat-scene.ts`) : un Pokemon **au sol** sur une tuile liquide a ses pieds ancrés à `LIQUID_DEPTH_RATIO` (3/6) au lieu du sommet plein ; Volant/Lévitation restent au sommet (`LIQUID_SURFACE_RATIO`, 5/6), au-dessus de la nappe.

**Écume de flottaison** (`shaders/water-foam-material.ts`, nouveau, ajouté en human-testing — hors périmètre du draft v1) : `ShaderMaterial` pixel-art procédural — une bande d'écume + gouttes éparses à la ligne de flottaison d'un Pokemon immergé. Grille de pixels calée sur la taille monde du quad × pixels-par-unité du jeu (pixels à l'échelle jeu, jamais étirés). Tri par `gl_FragDepth` = foot-depth du sprite immergé (devant lui, derrière un vrai bloc terrain). Teinte par liquide (`BABYLON_LIQUID_FOAM_COLOR_BY_GROUP` : eau `0xeaf7ff`, eau profonde `0xdcefff`, marais `0xd7e2b4`, lave `0xffd98a` ; fallback `BABYLON_LIQUID_FOAM_COLOR_DEFAULT`). Retirée dès qu'un Pokemon quitte le liquide (au premier pas de sortie, pas en fin d'animation).

**Anim de déplacement — mode vertical `flat`/`step`/`jump`** (`view-core/movement-animation.ts`) : un changement de hauteur ≤ `MAX_STEP_HEIGHT_DIFF` (0.5, demi-bloc) non-rampe est désormais un **step** (pose Walk, sans saut) plutôt qu'un `Hop` — évite la fausse glissade diagonale sur un demi-bloc ou à l'immersion/sortie d'un liquide (le dip est forcé en step). Au-delà de 0.5 (falaise), le mode reste `jump` (Hop inchangé). `selectMovementAnimation` ne distingue plus que jump/non-jump ; `movementVerticalMode` pilote l'easing vertical fin (`stepVerticalProgress`, `combat-scene.ts`) côté renderer.

**Hauteur des tuiles liquides** (`tileset.tsj`) : les liquides `full` restent `height=1.0` (rendu 6-tranches à pleine hauteur). Le « demi-bloc » ne concerne que le gameplay — un mon s'enfonce à 3/6 (= `0.5`) via la submersion, lu comme un `step` au déplacement (voir `docs/tileset-mapping.md`, décision #697).

**Animation procédurale des liquides** (2026-07-23, `shaders/liquid-shimmer-plugin.ts`) : `LiquidShimmerPlugin` (`MaterialPluginBase`, mirroré du vent des décorations, `decoration-wind-plugin.ts`) anime la surface **translucide** de chaque liquide par-dessus sa texture statique — le fond (sable/roche en fusion) ne bouge jamais. Ce n'est **ni du palette-cycling ni des frames** : les sheets PMD source n'en contiennent pas (leur animation en jeu est une rotation de palette moteur, absente des rips ; voir `docs/tileset-mapping.md` § Provenance). Approche procédurale choisie délibérément. Piloté par `scene.onBeforeRenderObservable` (temps en secondes, `plugin.time`), 3 effets combinables et tunables par liquide via `BABYLON_LIQUID_SHIMMER_BY_GROUP: Record<string, LiquidShimmerParams>` (`babylon-constants.ts`) :

- **Lueur/assombrissement par zones** (`blob`, signé) : patches localisés d'un champ 2D animé qui éclaircissent (`> 0`, lave = bulles chaudes qui pulsent en place) ou assombrissent (`< 0`, marais = zones sombres). Deux modes via `blobPatternCycle` : `0` = churn en place (bulles qui popent, lave) ; `1` = cycle de **3 patterns fixes** cross-fadés par cosinus lents, zones qui apparaissent/disparaissent sans dériver (marais). `blobScale`/`blobSpeed`/`blobDrift` réglent fréquence spatiale, vitesse de churn, vitesse de glisse le long du flux.
- **Vague de scintillement directionnelle** (`sparkle`) : une bande brillante voyageuse + glints scintillants épars — eau claire Ouest→Est, eau profonde en diagonale (plus calme). `sparkleScale`/`sparkleSpeed` réglent fréquence et vitesse de la vague.
- **Ondulation verticale** (`ripple`) : léger bob vertical de la surface (amplitude en world units, ≈24 px/unité → `0.03` ≈ ¾ px), `rippleSpeed`/`phaseFreq` réglant l'oscillation et le déphasage spatial entre voisins.

`flowX`/`flowZ` fixent l'axe de flux monde-XZ pour `sparkle` et l'advection de `blob` — Est = `+Z`, Ouest = `−Z`, Sud = `+X`, Nord = `−X` (cf. `direction-arrow-layout.ts`) : eau claire `(0, 1)` = Ouest→Est, eau profonde `(1, 1)` = diagonale Nord-Ouest→Sud-Est. **Pixel-perfect** : tout échantillonnage monde-XZ est snappé à la grille de texels de la texture (`BABYLON_LIQUID_SURFACE_PIXELS_PER_UNIT = 24`, 24×24 px/tuile) avant d'être injecté dans les fonctions de bruit — les effets rendent en cellules pixel-art nettes, jamais en dégradé lissé sous-pixel.

Décisions #691–#697, #707.

### Constantes Babylon — chrome combat (Jalon 4b/4c)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_TILE_PREVIEW_ALPHA_INDEX` | `3` | `alphaIndex` (sur le mesh) des quads de preview de ciblage — au-dessus des highlights de portée / herbe (`1`) / Champs (`2`), donc rendus en dernier (focus joueur). Plan 121 4b-5. |
| `BABYLON_FLOATING_TEXT_LIFT` | `1.0` | Lift world-Y (tiles) appliqué à la tuile avant projection écran, pour que le texte flottant de combat monte au-dessus de la tête du sprite. Passé de 1.5 → 1.0 lors du port moteur (phase retours). Plan 122 4c-1 + retours. |
| `BABYLON_JUMP_VERTICAL_LEAD` | `0.45` | Décalage de phase de l'axe vertical d'un arc de saut : le sprite atteint l'apex avant le milieu du pas (≤ 0.5), de sorte que la montée s'effectue entièrement au-dessus de la tile de départ et la descente au-dessus de la tile d'arrivée. Évite la pénétration géométrique du flanc d'une falaise, visible via la silhouette X-ray. Remplace `BABYLON_MOVE_JUMP_ARC`. Phase recette. Décision #492. |
| `BABYLON_ATTACK_ANIMATION_MAX_MS` | `1000` | Cap de sécurité (ms) : resolve la Promise d'attaque même si l'anim est absente ou la scène détruite mid-attaque (anti-hang de la queue). Plan 122 4c-3. |
| `BABYLON_KNOCKBACK_SHAKE_AMPLITUDE` | `0.12` | Amplitude max (tiles, axe world-X) de la secousse « knockback bloqué ». Plan 123 4d-2. |
| `BABYLON_KNOCKBACK_SHAKE_DURATION_MS` | `250` | Durée totale (ms) de la secousse « knockback bloqué ». Plan 123 4d-2. |
| `BABYLON_KNOCKBACK_SHAKE_CYCLES` | `3` | Nombre d'oscillations gauche-droite dans la secousse (sin amorti `× (1 − progress)`). Plan 123 4d-2. |
| `BABYLON_PREVIEW_FLASH_DIM_EMISSIVE` | `0.35` | Gris émissif le plus sombre du pulse de flash confirm-cible (le pulse fait varier l'émissif). Plan 123 4d-3. |
| `BABYLON_PREVIEW_FLASH_PERIOD_MS` | `600` | Période complète (ms) du pulse sinus émissif du flash de prévisualisation (aller-retour yoyo : 2 × durée du flash). Plan 123 4d-3. |
| `BABYLON_CONFUSION_WOBBLE_ANGLE` | `5°` (rad) | Angle de roll max du wobble de confusion. Appliqué sur `rotation.z` du plan sprite (enfant non-billboard d'un pivot billboard). Plan 123 4d-6. |
| `BABYLON_CONFUSION_WOBBLE_PERIOD_MS` | `1200` | Période complète (ms) du sinus de wobble confusion. Plan 123 4d-6. |

### HUD monde moteur — port DOM→moteur (phase retours, commit 9d1f731)

> Décision #487 appliquée : la catégorie A (UI ancrée-monde) est rendue en **moteur Babylon** (quads/DynamicTexture), non plus en DOM-projeté. `babylon-sprite-overlays.ts` (DOM `.ui-world` + `projectAnchors`) remplacé par trois modules moteur + un helper partagé.

#### Modules introduits

| Module | Rôle |
|--------|------|
| `babylon-sprite-hud.ts` | Barre PV + icône statut + preview dégâts par sprite. Billboards parentés au root sprite (`BILLBOARDMODE_ALL`). |
| `babylon-text-plane.ts` | Helper DynamicTexture partagé (texte pixel NEAREST, réutilisé par HUD et texte flottant). |
| `babylon-champ-pill.ts` | Badge compteur de Champ billboardé, remplace le DOM projeté `.field-terrain-pill`. |

Modules **supprimés** : `babylon-sprite-overlays.ts`. CSS **supprimés** : `sprite-overlay.css`, `floating-text.css`.

Texte flottant et pastille Champ également portés en moteur (même approche quad billboard).

#### Constantes HUD monde (source : `babylon-constants.ts`)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_HUD_RENDERING_GROUP` | `3` | Rendering group des éléments HUD monde — toujours au-dessus du terrain et des sprites (avec le curseur/flèches). |
| `BABYLON_HP_BAR_WIDTH` | `0.78` | Largeur de la barre PV en unités monde. |
| `BABYLON_HP_BAR_HEIGHT` | `0.12` | Hauteur de la barre PV en unités monde. |
| `BABYLON_HUD_STATUS_ICON_SIZE` | `0.26` | Côté du quad icône statut (aspect-correct, en unités monde). |
| `BABYLON_HUD_STATUS_GAP` | `0.06` | Espacement entre la barre PV et l'icône statut. |
| `BABYLON_HUD_DAMAGE_TEXT_HEIGHT` | `0.52` | Hauteur du texte de preview dégâts (unités monde). |
| `BABYLON_HUD_DAMAGE_TEXT_GAP` | `0.0` | Décalage vertical entre la barre et le texte dégâts (0 = aligné sous la barre). |
| `BABYLON_FLOATING_TEXT_HEIGHT` | `0.62` | Hauteur du plan texte flottant (unités monde). |
| `BABYLON_FLOATING_TEXT_RISE` | `0.7` | Distance verticale de montée (unités monde) pendant le fade du texte flottant. |
| `BABYLON_FLOATING_TEXT_SECONDARY_SCALE` | `0.8` | Scale du texte secondaire (efficacité de type sous les dégâts). |
| `BABYLON_FLOATING_TEXT_LIFT` | `1.0` | Lift appliqué au-dessus de la tête du sprite pour le texte flottant (passé de 1.5 → 1.0 en phase retours). |
| `BABYLON_CHAMP_PILL_HEIGHT` | `0.5` | Hauteur du badge compteur de Champ (unités monde). |
| `BABYLON_CHAMP_PILL_LIFT` | `0.6` | Lift vertical de la pastille Champ au-dessus de la tile centrale. |
| `BABYLON_HUD_TEXT_FONT_PX` | `32` | Taille de fonte (px) dans la DynamicTexture HUD. |
| `BABYLON_HUD_TEXT_PADDING_PX` | `8` | Padding interne (px) dans la DynamicTexture HUD. |

**Constantes locales module (barre PV, `babylon-sprite-hud.ts`)** — non exportées, valeurs de référence :

| Constante locale | Valeur | Rôle |
|------------------|--------|------|
| `BAR_TEXTURE_HEIGHT` | `40` | Hauteur en px de la DynamicTexture barre PV (résolution interne). |
| `BAR_BORDER_PX` | `6` | Épaisseur de la bordure (px) dans la texture. |
| `BAR_RADIUS_PX` | — | Rayon de coin arrondi (`roundRect`) de la barre (valeur calculée à partir de `BAR_BORDER_PX`). |

Rendu : `roundRect` canvas NEAREST (pixel art), scaling Babylon → dimensions monde. Le filtre NEAREST garantit un rendu pixel-art cohérent avec les sprites PMDCollab.

#### Constantes texte de combat (source : `packages/renderer/src/constants.ts`)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BATTLE_TEXT_DURATION_MS` | `1000` | Durée totale (ms) avant disparition du texte flottant. Réduit de 3500 → 1000 en phase retours (textes trop lents à disparaître). |
| `BATTLE_TEXT_QUEUE_DELAY_FACTOR` | `0.5` | Facteur multiplicateur appliqué à `BATTLE_TEXT_DURATION_MS` pour calculer le délai entre deux textes en file d'attente multi-hit. |
| `BATTLE_TEXT_QUEUE_DELAY_MS` | dérivé | `= BATTLE_TEXT_QUEUE_DELAY_FACTOR × BATTLE_TEXT_DURATION_MS`. N'est plus une constante fixe indépendante. |

#### Multi-hit HP stepping

Le stepping PV multi-hit (décrément progressif des PV à chaque texte flottant d'une séquence multi-hit) est synchronisé sur le tick du texte flottant dans `battle-orchestrator`. Chaque décrément correspond à un `DamageDealt` dans la queue de la séquence.

#### Centrage caméra

La caméra est centrée sur le milieu géométrique de la map (calculé depuis `MapDefinition.width`/`height`) plutôt que sur la tile (0,0). Garantit que les cartes asymétriques (large ou haute) restent lisibles d'emblée.

#### Police pixel globale

La police `PokemonEmeraldPro` est déclarée sur `body` (CSS global), de sorte que les contrôles natifs (boutons `<button>`, `<select>`, etc.) héritent automatiquement de la police pixel art sans surcharge inline.

**`.field-terrain-pill`** — portée en moteur (phase retours) via `babylon-champ-pill.ts` (billboard DynamicTexture, toujours visible). L'ancienne version DOM projetée (`.field-terrain-pill` dans `game-overlay.css`, `--field-terrain-pill-bg/border`, `opacity:0.5`, limitation depth-buffer — décision #485) est **supprimée**.

#### Picker de direction placement — flèche voxel glTF (plan 120)

Source canonique : `packages/renderer/src/babylon/babylon-constants.ts`.

Le picker est rendu en moteur Babylon via un **modèle voxel** `arrow.gltf` (Goxel), un clone par direction voisine, posé à plat à hauteur de tête. Chargé via `@babylonjs/loaders` + `loadAssetContainerAsync`. Échelle 1 voxel = 1 px sprite (`1/BABYLON_SPRITE_PIXELS_PER_UNIT`). Rendering group 3 (toujours visible, hors silhouette). **Détection de direction par position souris** relative au Pokémon (zone généreuse reprojetée, suit la rotation caméra), pas par picking de mesh. Suit caméra/zoom/resize gratuitement (meshes de scène). Décisions #487, #490.

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_DIRECTION_ARROW_Y_OFFSET` | `0.03` | Micro-lift world-Y de la flèche au-dessus de la surface (z-fight guard). |
| `BABYLON_DIRECTION_ARROW_TILE_FRACTION` | `0.6` | Fraction de la distance vers la tuile voisine où la flèche est posée (<1 = rapprochée du Pokémon). |
| `BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE` | `{r,g,b}` | Couleur émissive (glow) de la flèche sélectionnée ; les autres restent sans émissive (le matériau voxel n'a pas d'alpha à atténuer). |
| `BABYLON_SPRITE_HEAD_LIFT_FALLBACK` | `1` | Hauteur tête (unités monde) utilisée pour les flèches **et** le curseur avant que l'atlas du sprite ne résolve son vrai `spriteTopOffsetY`. |

Asset : `packages/app/public/assets/ui/arrow.gltf`. Constantes **supprimées** (plan 120, flèche 2D texture retirée) : `BABYLON_DIRECTION_ARROW_SIZE`, `BABYLON_DIRECTION_ARROW_Z_OFFSET`, `BABYLON_DIRECTION_ARROW_INACTIVE_ALPHA`.

#### Animations sprites PMD — durée par frame (plan 120)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `BABYLON_PMD_TICK_DURATION_MS` | `33` | Durée d'un tick PMD en ms (cadence d'animation des sprites). |
| `BABYLON_PMD_DEFAULT_FRAME_TICKS` | `4` | Durée par défaut (ticks) d'une frame sans durée dans l'atlas. |
| `BABYLON_DEFAULT_FRAME_DURATION_MS` | `140` | Fallback ms si l'atlas ne porte aucune durée PMD. |

Chaque frame est jouée pour sa durée PMD réelle (`atlas.meta.animations[nom].durations[i] × 33ms`, clamp ≥1 tick). Avant : fixe 140ms → idle perçu trop rapide (feedback playtest). Décision #488.

#### Phase recette — hauteur curseur sur décorations

Source canonique : `packages/render-babylon/src/babylon-decorations.ts` + `combat-scene.ts`.

**Mis à jour pour les meshes voxel (décision #690)** : `decorationHeightAt(x, y)` retourne la hauteur d'obstacle en unités **TILE-HEIGHT (block units)**, dérivée automatiquement de la bounding box du mesh chargé (`(bounds.maximum.y − bounds.minimum.y) / BABYLON_TILE_HEIGHT_SCALE`) — plus de `BABYLON_DECORATION_FOOT_DROP` (constante supprimée avec les billboards). Seuls rochers et arbre contribuent (l'herbe haute n'ajoute pas de hauteur, les unités s'y tiennent dedans). `surfaceHeightAt(x, y)` = terrain + déco, utilisé par `tileWorldTop`, highlights et mouvement. Le curseur de survol et les highlights se positionnent sur le dessus de la décoration. Décision #493, révisée #690.

#### Phase recette — auras (Murs) in-engine

Source canonique : `packages/renderer/src/babylon/babylon-sprite-hud.ts` + `babylon-aura-ground-icons.ts`.

| Constante | Rôle |
|-----------|------|
| `BABYLON_HUD_AURA_ICON_SIZE` | Côté (unités monde) d'une icône d'aura dans la barre de vie (`setLeftIndicators`). |
| `BABYLON_HUD_AURA_ICON_GAP` | Espacement entre icônes d'aura consécutives dans la barre de vie. |
| `BABYLON_AURA_HOVER_ICON_SIZE` | Côté (unités monde) d'une icône d'aura au sol (affiché au survol du lanceur). |
| `BABYLON_AURA_HOVER_LIFT` | Lift world-Y appliqué aux icônes au sol pour les décaler légèrement de la surface de la tuile. |
| `BABYLON_AURA_HOVER_ALPHA` | Alpha des icônes d'aura au sol (semi-transparent pour ne pas masquer la carte). |

Les icônes au sol sont rendues via un **groupe sprite** (pivot billboardé par tuile, layout en croix) : les Pokemon les occluent naturellement par le depth-buffer. Les icônes sur les tuiles occupées par un Pokemon sont masquées. Décision #494.

#### Phase recette — Champs dédup + pastille centrée

Source canonique : `packages/renderer/src/babylon/babylon-champ-pill.ts` + `babylon-field-terrains.ts`.

`refreshFieldTerrainVisuals` : chaque tuile est peinte par le Champ le plus récent uniquement (dédup overlap) ; les bordures de périmètre sont recalculées après filtrage → les zones ne se superposent pas visuellement.

`babylon-champ-pill.ts` (pastille compteur de tours) :
- Centrage du chiffre via métriques texte canvas (`measureText`) — corrige le décalage sur les nombres à 2 chiffres.
- Rendue en **groupe sprite** (plan dans la scène) pour l'occlusion par les Pokemon.
- `BABYLON_CHAMP_PILL_LIFT` réduit de `0.6` → `0.25` (pastille centrée sur la tuile, non flottante au-dessus des têtes). Décision #495.

#### Debug terrain

| Constante | Rôle |
|-----------|------|
| `BABYLON_TILE_GRID_COLOR` | Couleur wireframe de la grille debug (touche `g`) |
| `BABYLON_TILE_GRID_Z_OFFSET` | Z-offset pour éviter le z-fighting avec le terrain |

#### Boussole d'orientation caméra — ancrage pixel-fixe (fix 2026-07-20)

Source canonique : `packages/render-babylon/src/babylon-compass.ts`.

La boussole (`compass.glb`, mesh voxel) est repositionnée/redimensionnée chaque frame (`pinToCorner`) pour occuper une **position + taille écran constantes en pixels**, dérivées des spans de la projection ortho (`orthoLeft/Right/Top/Bottom`) et des dimensions de rendu courantes — invariant au resize, au zoom et à la résolution. Calibrée sur une référence 1920×1080, sans capture d'état au boot. Corrige la dérive de l'ancien ancrage en unités monde (backlog 2026-07-02).

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `COMPASS_SIZE_SCALE` | `1` | Taille écran (≈ taille voxel brute à la résolution de référence). Plus haut = boussole plus grande. |
| `COMPASS_LEFT_FRACTION` | `0.05` | Inset gauche, fraction de `COMPASS_REFERENCE_RENDER_WIDTH` (px constant depuis le bord gauche). Plus haut = vers la droite. |
| `COMPASS_TOP_FRACTION` | `0.034` | Inset haut, fraction de `COMPASS_REFERENCE_RENDER_HEIGHT` (px constant depuis le bord haut). Plus haut = vers le bas. |
| `COMPASS_REFERENCE_RENDER_WIDTH` / `COMPASS_REFERENCE_RENDER_HEIGHT` | `1920` / `1080` | Résolution de référence sur laquelle position et taille sont calibrées. |
| `COMPASS_CAMERA_DEPTH` | `20` | Profondeur (unités monde) devant la caméra où la boussole est parquée (entre minZ/maxZ). |
| `COMPASS_NORTH_OFFSET` | `π/2` | Rotation monde fixe alignant l'aiguille Nord du modèle sur le Nord monde réel. |

Décision #688.

---

## Principes de design

1. **Palette sombre** : fond bleu nuit (`#1a1a2e`), panneaux bleu très sombre (`#111122`). Le jeu est dark-mode par défaut.
2. **Accent doré** : le jaune `#ffdd44` est l'accent principal (curseur, titre menu, bordure active, timeline active).
3. **Sémantique rouge/bleu** : rouge = danger/ennemi/attaque, bleu = allié/buff/déplacement. Cohérent dans toute l'UI.
4. **Orange = menace ennemie** : overlay spécifique pour distinguer la portée ennemie des zones d'attaque.
5. **Police `FONT_FAMILY`** : constante centrale, cible Pokemon Emerald Pro avec fallback `monospace`. Cohérent avec l'esthétique pixel/rétro.
6. **Alphas semi-transparents** : les overlays de grille utilisent des alphas 0.3–0.5 pour rester lisibles sans cacher la carte.
7. **Pixel art sélectif** : filtre `NEAREST` appliqué sur le tileset et les sprites Pokemon (pixels nets). Texte et portraits restent en filtre `LINEAR`.
