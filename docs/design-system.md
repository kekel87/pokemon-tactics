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

Depuis le plan 044, Phaser est configuré avec `roundPixels: true` pour aligner les sprites sur les pixels entiers sans affecter le rendu du texte. Le filtre `NEAREST` est appliqué **manuellement** sur les textures pixel art uniquement : tileset (dans `BattleScene`) et sprites Pokemon (dans `PokemonSprite`).

`pixelArt: true` a été **écarté** : il applique NEAREST à toutes les textures, y compris les textures de texte (BitmapText), ce qui les rend flous — décision #220.

Les **portraits** restent en filtre `LINEAR` par défaut (haute résolution, pas de filtre NEAREST). Les appels `applyPortraitFilters()` ont été supprimés — inutiles sans `pixelArt: true`.

### Grille isométrique

La grille est le coeur visuel du jeu. Projection isométrique classique (losanges 32×16px world-space, rendu par zoom caméra). Tiles texturées ICON Isometric Pack (Jao), filtre NEAREST appliqué manuellement via `setFilter(NEAREST)` dans `BattleScene`. La grille flotte sur le fond sombre, ce qui crée naturellement une scène de "plateau de jeu".

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
| Orange ennemi | `#dd6622` / `0xdd6622` | 0.35 | Portée de déplacement ennemie (hover) |
| Jaune curseur | `#ffdd44` / `0xffdd44` | pulse 0.7–1.0 | Curseur sur la grille |

### Zones de spawn (placement)

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Bleu clair | `#55aaff` / `0x55aaff` | 0.5 | Zone de spawn active |
| Gris bleuté | `#8888aa` / `0x8888aa` | 0.5 | Zone de spawn inactive |
| Bleu sombre | `#335577` / `0x335577` | 0.5 | Zone de spawn occupée |

### Preview d'attaque

| Couleur | Hex | Alpha | Usage |
|---------|-----|-------|-------|
| Rouge preview | `#cc4444` / `0xcc4444` | 0.5 | Preview AoE attaque |
| Bleu preview | `#4488cc` / `0x4488cc` | 0.5 | Preview AoE buff |
| Rouge outline | `#cc4444` / `0xcc4444` | 0.6 | Contour périmétrique de portée |

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

Ces valeurs ont été retunées après feedback playtest (plan 046) — la police pixel art rendait les anciennes valeurs (`FONT_SIZE = 7`, `DURATION_MS = 2200`) trop petites et trop fugaces pour être lues en combat.

La clé i18n `battle.fall` (FR "Chute", EN "Fall") est utilisée par le handler `FallDamageDealt` dans `GameController.ts`. Jamais de texte hardcodé côté renderer.

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

---

## Stat Badges (InfoPanel)

| Couleur | Hex | Usage |
|---------|-----|-------|
| Bleu buff | `#1a4a8a` / `0x1a4a8a` | Badge stat augmentée |
| Rouge debuff | `#8a1a1a` / `0x8a1a1a` | Badge stat diminuée |
| Violet volatile | `#6a3a8a` / `0x6a3a8a` | Badge statut volatil (confusion, piège, etc.) |

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

| Cellule | Hex | Usage |
|---------|-----|-------|
| Target | `#ff6644` / `0xff6644` | Case cible |
| Dash/Caster | `#ffdd44` / `0xffdd44` | Case dash / caster |
| Empty | `#333333` / `0x333333` | Case vide |

---

## Typographie

La police est centralisée dans la constante `FONT_FAMILY = "Pokemon Emerald Pro, monospace"` dans `constants.ts`. Tous les textes Phaser utilisent cette constante. Le fichier TTF `public/assets/fonts/pokemon-emerald-pro.ttf` n'est pas encore intégré — la police se rabat sur `monospace` en attendant.

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

## Profondeur des layers (depth)

| Layer | Depth | Usage |
|-------|-------|-------|
| Highlights grille | 100 | Bleu déplacement, rouge attaque |
| Enemy range | 110 | Overlay portée ennemie (orange) |
| Preview AoE | 120 | Preview d'attaque |
| Curseur | 150 | Curseur jaune sur la grille |
| Pokemon (base) | 200 | Sprites Pokemon (triés par Y) |
| UI base | 1000 | Éléments UI de fond |
| Timeline | 1050 | Turn order |
| Info Panel | 1100 | Panel d'info Pokemon |
| Action Menu | 1200 | Menu d'actions |
| Battle Log | 1300 | Panel de log |
| Battle Text | 1500 | Texte flottant (dégâts, miss, etc.) |
| Tooltip | 1250 | Tooltip move |
| Victory overlay | 2000 | Écran de victoire (fond) |
| Victory content | 2001 | Écran de victoire (texte) |

---

## Principes de design

1. **Palette sombre** : fond bleu nuit (`#1a1a2e`), panneaux bleu très sombre (`#111122`). Le jeu est dark-mode par défaut.
2. **Accent doré** : le jaune `#ffdd44` est l'accent principal (curseur, titre menu, bordure active, timeline active).
3. **Sémantique rouge/bleu** : rouge = danger/ennemi/attaque, bleu = allié/buff/déplacement. Cohérent dans toute l'UI.
4. **Orange = menace ennemie** : overlay spécifique pour distinguer la portée ennemie des zones d'attaque.
5. **Police `FONT_FAMILY`** : constante centrale, cible Pokemon Emerald Pro avec fallback `monospace`. Cohérent avec l'esthétique pixel/rétro.
6. **Alphas semi-transparents** : les overlays de grille utilisent des alphas 0.3–0.5 pour rester lisibles sans cacher la carte.
7. **Pixel art sélectif** : `roundPixels: true` dans Phaser aligne les sprites sur les pixels entiers. Filtre NEAREST appliqué manuellement sur tileset et sprites Pokemon. Texte et portraits restent en filtre LINEAR.
