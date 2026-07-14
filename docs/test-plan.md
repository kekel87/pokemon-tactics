# Cahier de recette — Pokemon Tactics

**Statut : vivant — maintenu par `doc-keeper` à chaque changement de feature.**

## But

Liste de **ce qu'il faut vérifier à l'œil** quand on change un truc important. Orienté
**recette visuelle** : chaque élément a une checklist d'assertions observables fines
(position, occlusion, z-order, stacking, pattern, anti-superposition, couleur, interaction).

Usages :
1. **Après un changement** → ouvrir la(les) section(s) de l'élément touché (index ci-dessous),
   dérouler les cases en jeu (sandbox).
2. **Avant une release** → smoke test (§10).

Ce n'est PAS la liste des tests automatisés (code `*.test.ts`). C'est ce qui **doit** être
couvert. Une case qu'aucun test auto ne couvre = candidat e2e (§11).

### Convention 🤖 / 👁

Chaque case est marquée :

- **🤖 automatisé** — couvert par un test e2e (`e2e/tests/…`) ou unit. À re-vérifier à l'œil
  seulement en cas de doute. Le fichier e2e est indiqué en tête de section.
- **👁 manuel** — vérification œil humain en sandbox (rendu, animation, ressenti, pixels que le
  scene-graph ne juge pas). Non automatisable ou pas encore automatisé.

L'objectif : faire migrer un maximum de 👁 vers 🤖 au fil du temps. L'inventaire e2e actuel et la
stratégie (automatiser le **sens**, pas les **pixels**) sont en §11.

## Maintenance (doc-keeper)

- Nouvel élément visuel / changement de rendu → ajouter/MAJ la checklist.
- Nouvelle mécanique observable → ajouter ses assertions dans §5.
- **Noms FR officiels** partout (moves/talents/Pokemon).
- Garder le grain : une case = une chose vérifiable à l'œil. Pas de détails d'implémentation
  (hex, n° de ligne) — juste l'indice de fichier source par section.

## Index par changement

| Je touche… | Sections à dérouler |
|------------|---------------------|
| Champ / terrain de combat | §3.1, §3.2, §3.3 |
| Barre PV / statut / aura / dégâts estimés | §3.4, §3.5, §5.3, §5.4, §5.9 |
| Sprite / animation Pokemon | §3.6, §5.1, §5.6, §5.8, §5.13 |
| Bundle de sprites / splash de boot / portraits | §6.0, §3.6, §4.7 |
| Highlights / curseur / picker | §3.7, §3.8, §3.9 |
| Décor / hauteur / map / terrain type | §3.10, §3.12, §8 |
| Hauteur en combat (vue/portée/dégâts) | §3.12, §5.17 |
| Chute / repoussé / terrain létal / glace | §5.18, §8.4 |
| Traversée (Spectre / Volant) | §5.19, §8.4 |
| Effets de terrain (coût/statut/DOT/bonus) | §5.20, §8.1 |
| Pattern de ciblage d'un move | §3.7, §4.6, §5.16 |
| Objet tenu / manipulation d'objet (vol/échange/retrait/recyclage) | §5.14, §5.25 |
| Réécriture de type (Détrempage/Conversion/Flamme Ultime…) | §5.27, §4.7 |
| Appeler / copier un move (Métronome/Copie/Mimique…) | §5.28 |
| Copie d'identité (Morphing / Imposteur / Métamorph) | §5.34 |
| Heuristiques de scoring IA (choix de move) | §5.35 (unit ; e2e reporté) |
| Move (effet observable) | §5 (famille concernée) |
| HUD DOM combat (log, timeline, menus, tooltip) | §4 |
| Écran / menu / navigation | §6 |
| Team Builder / sandbox | §7 |
| Placement / zones de spawn | §8.5 |

---

## 1. Couches de test

| Couche | Commande | Rôle |
|--------|----------|------|
| Unitaire / intégration | `pnpm test` / `pnpm test:integration` | Mécanique core/data/view-core. **Test-first.** |
| Gate CI | `/ci-gate` | Bloquant avant commit (build+lint+typecheck+test). |
| **Recette visuelle** | `pnpm dev:sandbox '{…}'` | **Ce document.** Œil humain (cases 👁). |
| Visuel piloté | agent `visual-tester` (Playwright/Chromium) | Capture/diff, ≥2 min, jamais auto. |
| **E2E** | `pnpm test:e2e` | Parcours + DOM + scène (cases 🤖). Inventaire §11. |

Règle : mécanique core → **test unit AVANT** le visuel. Le visuel valide le **rendu**.

## 2. Conventions de rendu (groupes de profondeur)

| Groupe | Contenu | Occlusion |
|--------|---------|-----------|
| 0 — terrain | sol, overlay de champ, highlights, rochers/arbres | sous tout le reste |
| 1 — silhouette | fantôme couleur équipe d'un Pokemon caché par du terrain | visible à travers la roche |
| 2 — sprite | Pokemon, herbe haute, HUD ancré (barre PV, pastille, auras, texte flottant) | **occulté par les Pokemon en avant** |
| 3 — overlay | curseur de survol, flèches de direction | **jamais occulté** |

« Occulté par les Pokemon » = groupe 2, un sprite plus proche caméra le masque.
Échelle : `128 px source = 1 tile`. 1 niveau de hauteur = `+0.866` unité monde.

---

## 3. Recette — scène de combat 3D

*Les cases ici sont **👁 manuelles** par défaut (rendu/pixels/anim). Quelques **faits** du
scene-graph sont déjà 🤖 (e2e `tests/combat/scene-graph.spec.ts` + `scene-state.spec.ts`) :
présence des sprites (`pokemon_plane`, groupe 2 occultable), curseur de survol (`hover_cursor`,
groupe 3 jamais occulté), tiles de terrain (`tile_*`), icône de statut (`hud_status_icon`) quand
empoisonné. Le scene-graph juge le **sens** (présence, groupe d'occlusion, position) — la couleur,
l'animation et le pixel exact restent 👁.*

### 3.1 Champ de terrain (overlay)
*src : `field-terrains.ts`, `field-terrain-borders.ts`, core `field-terrain-system.ts`*

- 👁 Remplissage semi-transparent sur **toutes** les tiles de la zone (rayon r=3 autour de
  l'ancre), y compris tiles surélevées.
- 👁 **Pas de superposition / z-fighting** : ne clignote pas, ne déborde pas hors zone.
- 👁 **Occulté par les Pokemon** posés dessus.
- 👁 **Bordure** fine continue sur les bords **externes** seulement (zone en « L » → aucune
  ligne sur arêtes internes).
- 👁 Couleur = identité du champ (Herbu vert, Électrifié jaune, Brumeux rose, Psychique violet).

### 3.2 Compteur de tours du champ (pastille)
*src : `champ-pill.ts`, `render-canvas2d/champ-pill-canvas.ts`*

- 👁 Pastille ronde flottant **au centre, au-dessus de la tile ancre** (pas la zone entière),
  face caméra.
- 👁 Affiche les **tours restants**, décrémente (5→4→3…).
- 👁 **Occultée par un Pokemon** placé sur l'ancre.
- 👁 Chiffre lisible, disque net.

### 3.3 Champ Psychique — comportement de mur
*src : core `field-terrain-system.ts`*

- 🤖 *Mur du Champ Psychique (blocage dash + dégâts d'impact + exception Volant/allié) — **sens
  couvert par les unit core** (`field-terrain-system`). Le rendu (arrêt visuel, texte) reste 👁.*
- 👁 Un **ennemi au sol** qui dash **à travers** une tile du Champ Psychique est **bloqué**
  (s'arrête, comme un mur) + texte « bloqué ».
- 👁 Il **prend des dégâts** d'impact.
- 👁 Il peut malgré tout **cibler/viser à travers** (bloque le déplacement, pas la visée).
- 👁 **Volant** ou **allié** du lanceur **non** bloqué.

### 3.4 Barre de vie + icônes
*src : `sprite-hud.ts`, `render-canvas2d/hp-bar-canvas.ts`*

- 🤖 Une **barre PV par Pokemon** montée (`hud_hp_bar_plane` ×2 — `scene-graph.spec`). *La position
  « au-dessus de la tête » qui suit le sprite + la couleur/coins = 👁 (pixel).*
- 👁 Remplissage **proportionnel aux PV**, couleur équipe, coins arrondis.
- 👁 **Icônes empilées à gauche** (auras/écrans/charge : Reflet 🛡️, Mur Lumière ✨, Brume 🌫️,
  Rune Protect 🕊️, charge ⚡) : jusqu'à 6, **la plus récente/fraîche en tête**, alliés
  protégés en semi-transparent.
- 🤖 **Une icône de statut majeur à droite** (`hud_status_icon` présente quand empoisonné —
  `scene-state.spec`). *Le glyphe exact par statut = 👁.*
- 👁 **Estimation de dégâts** (avant confirmation) : bande sur la barre + nombre au-dessus,
  rouge (garanti) / orange (possible) / gris « Immun ». *Peinte dans la texture de la barre PV
  (pas un mesh) → non observable au scene-graph, reste 👁.*

### 3.5 Indicateurs d'aura au sol
*src : `aura-ground-icons.ts`, `view-core/aura-ground-layout.ts`*

*Le hook `hoverTile` existe désormais (cf §4.7) → automatisable si on peut booter un état avec auras
actives (Reflet/Mur Lumière posés). Bloqué tant que `SandboxConfig` n'expose pas d'auras de départ
→ reste 👁 pour l'instant.*
- 👁 S'affichent **au survol du lanceur** uniquement ; disparaissent en quittant le survol.
- 👁 Un symbole **centré sur chaque tile** de la portée (r=3).
- 👁 **Pattern selon le nombre d'auras** (1=centre, 2=côte à côte, 3=triangle, 4=croix,
  5+=grille), **aligné écran** (reste stable quand on tourne la caméra).
- 👁 **Occultés par les Pokemon**, semi-transparents.

### 3.6 Sprite Pokemon (billboard directionnel)
*src : `directional-billboard.ts`, `view-core/pmd-animation-controller.ts`,
`view-core/sprite-bundle.ts` (slicing du bundle plan 135)*

- 🤖 **Source bundle** (plan 135) : les billboards (`pokemon_plane` ×2) sont slicés depuis le bundle
  unique (`sprites.bin`) chargé au boot — atteindre `waitReady` puis les compter prouve que le
  slicing a alimenté la scène ; un **pré-évo** (Pikachu, roster Gen 1 complété) rend aussi son sprite
  (`sprite-bundle.spec`). *La couleur/anim du sprite restent 👁.*
- 👁 **8 directions** cohérentes ; tourner la caméra (←/→) fait pivoter le sprite.
- 👁 Anims : **idle** (respiration légère), **walk** lissé, **attaque** vers la cible, **KO**
  (chute + teinte grise, ombre disparaît).
- 👁 **Volants** : sprite surélevé + **glide** au repos (chaîne FlyingIdle/Hover/Special… sinon
  **Walk**), pas idle statique.
- 👁 **Confusion** : léger balancement (wobble) tant que confus.
- 🤖 **Silhouette X-ray** montée par Pokemon (`pokemon_silhouette` ×2 en groupe 1, sous les sprites
  et visible à travers la roche — `scene-graph.spec`). *La couleur d'équipe exacte = 👁.*
- 👁 **Flash** blanc bref à chaque coup reçu ; **secousse** brève sur impact/knockback.
- 👁 Deux sprites coplanaires ne se découpent pas mutuellement.

### 3.7 Highlights de tile
*src : `tile-highlights.ts`, `render-ports`*

- 🤖 Highlights montés en phase d'input : `highlight_move_x_y` au clic « Deplacement »,
  `highlight*` en ciblage d'attaque (`targeting.spec`). *Les **couleurs** restent 👁.*
- 👁 Couleurs : déplacement **bleu**, attaque **rouge**, repli **vert**, portée ennemie
  **orange** (discret).
- 👁 **Preview AoE/cône** par-dessus les highlights de base.
- 👁 **Contour** épais sur les bords externes (cône bordé, intérieur non).
- 👁 Curseur de tile survolée = carré **jaune** net, inscrit dans la tile.

### 3.8 Curseur de survol
*src : `hover-cursor.ts`*

- 🤖 Curseur monté en **un seul exemplaire** (`hover_cursor`, modèle voxel `cursor.glb`), en
  **groupe 3 = jamais occulté** (`scene-graph.spec`). *Le placement « sommet de la tête/décor », le
  bob et l'aspect voxel opaque = 👁 (pixel/anim).*
- 👁 Modèle voxel unique (non configurable) ; repose sur le **sommet de la tête** du Pokemon
  survolé, ou le **sommet du décor** sinon ; face caméra, léger bob vertical.

### 3.9 Sélecteur de direction (placement)
*src : `direction-picker.ts`, `view-core/direction-arrow-layout.ts`*

- 👁 4 flèches voxel sur les tiles voisines, pointant **vers l'extérieur** (Nord au nord, etc.).
- 👁 Flèche survolée **brille** ; les autres éteintes.
- 👁 **Jamais occultées** ; pas de flèche fantôme si affiché pendant un load (parité à surveiller).

### 3.10 Décorations (rochers / arbres / herbe)
*src : `babylon-decorations.ts`, `view-core/decoration-layout.ts`*

- 👁 **Occlusion** : Pokemon devant un arbre le masque ; derrière, l'arbre le cache.
- 🤖 Herbe haute montée en **groupe 2** (sprite occultable, `decoration_plane_tall_grass*` —
  `scene-graph.spec`). *La semi-transparence + absence de silhouette = 👁.*
- 👁 **Curseur / volant repose sur le sommet** du décor (hauteur réelle), pas le terrain derrière.
- 🤖 Herbe auto-placée présente aux tiles attendues (`scene-graph.spec`) ; *positions exactes
  rochers/arbres = 👁.*

### 3.11 Texte flottant
*src : `view-core/floating-text-spawner.ts`, `floating-text-content.ts`*

- 🤖 Apparaît à la résolution (`hud_text_plane` monté puis disposé ~1 s — `floating-text.spec`).
  *Le placement centré + la montée/estompe = 👁 (anim).*
- 👁 **Couleur par type** : dégâts blanc/rouge, soin vert, raté gris, critique orange, info bleu/
  gris, buff bleu, debuff rouge, talent or, objet vert.
- 👁 Texte secondaire (« Très efficace ! ») empilé **dessous**, plus petit.
- 👁 Un seul texte primaire par Pokemon par beat ; le reste **staggeré** (pas de chevauche).
- 👁 Noms (talents/objets/moves) en **FR officiel** *(table `floating-text-content.ts` — couverte
  par les unit i18n du core ; le rendu flottant reste 👁).*

### 3.12 Hauteur multi-niveaux
*src : `terrain-extruder.ts`, core `height-traversal.ts`*

- 👁 Un Pokemon sur un niveau **haut devant** occulte un Pokemon en contrebas.
- 👁 **Picking par niveau** : clic sélectionne la bonne tile ; curseur sur le sommet composé
  (roche sur falaise = somme des hauteurs).
- 🤖 Traversée : montée bloquée > `MAX_CLIMB=0.5`, descente jusqu'à `MAX_DESCENT=1.0`, dégâts de
  chute au-delà — **sens couvert par les unit core** (`height-traversal`, `fall-damage`). *Le rendu
  iso multi-niveaux reste 👁.*

### 3.13 Caméra / responsive
*src : `combat-scene.ts`, `view-core/constants.ts`*

- 👁 Caméra **orthographique** dimétrique ; `←/→` tournent par 90° (4 vues), transition douce.
- 👁 Zoom molette réactif, recadrage sans débordement.
- 👁 **Écran 4K / redimensionnement** : HUD et sprites à l'échelle, rien de coupé/minuscule.

---

## 4. Recette — HUD / chrome DOM (overlay combat)
*src : `ui-dom/src/` (battle-chrome `.bc-*`, battle-log `.bl-*`, turn-timeline `.tt-*`,
weather-hud, move-tooltip `.mt-*`, info-panel `.ip-*`), `app/babylon/combat-screen.ts`*
*e2e : `tests/combat/driving.spec.ts`, `combat-flow.spec.ts` ; langue : `addInitScript` →
`localStorage.pt-lang = "en"` avant boot pour tester l'anglais*

### 4.1 Bannière de tour
- 🤖 Haut-centre : **nom FR du Pokemon actif** (`.bc-turn` — `hud-menu.spec`), MAJ à chaque tour.
  *Plus de notion de round (Charge Time seul).*

### 4.2 Timeline / ordre des tours (`.tt-timeline`)
- 🤖 Gauche-haut : **portraits** + couleur d'équipe (`data-team`), entrée **active** surlignée
  (`data-active="true"`) — `hud-menu.spec`.
- 👁 Entrées **atténuées** (`data-dimmed`) : passage répété d'un mon déjà listé (tour futur).
- 🤖 **Charge Time** (unique système) : barres de charge (`data-ct="true"`).
- 👁 Barre = **charge actuelle** du mon (`--tt-ct` = ct/seuil) : plus pleine = bientôt son tour.
  L'entrée **active n'a pas de barre** (marqueur d'état distinct, pas une barre pleine).
- 👁 **MAJ temps réel** après chaque action (l'ordre se recalcule).
- 👁 Un Pokemon **K.O.** disparaît de la timeline.
- 👁 Masquée si aucune entrée.

### 4.3 Météo (HUD)
- 🤖 HUD météo « Plein soleil » + tours restants quand une météo est active (`weather.spec`).
  *L'icône exacte + l'absence hors météo = 👁.*

### 4.4 Menu d'action (`.bc-menu`) — états des boutons
- 🤖 Au tour du joueur, les **5 boutons** s'affichent, FR : **Deplacement**, **Attaque**, **Objet**,
  **Attendre**, **Statut** (`hud-menu.spec`) (EN : Move / Attack / Item / Wait / Status — 👁).
- 🤖 **Objet** et **Statut** : toujours désactivés (`disabled`, non implémentés — `hud-menu.spec`).
- 👁 **Deplacement** grisé si le Pokemon a déjà bougé ce tour (ou aucune tile atteignable).
- 👁 **Attaque** grisé si aucune action possible (aucun move avec cible à portée).
- 🤖 Après un déplacement, le 1er bouton devient **« Annuler deplacement »** ; après annulation,
  redevient « Deplacement » (`combat-flow.spec`).
- 👁 Bouton désactivé non cliquable (pas de transition d'état).

### 4.5 Sous-menu d'attaque (`.bc-move-item`) — liste des moves
- 🤖 Clic « Attaque » → liste des moves du Pokemon actif + bouton « Annuler ».
- 🤖 Chaque item : **icône de type** (`img.bc-move-type`) + **nom FR** (`.bc-move-name`) —
  `hud-menu.spec`. *Plus de PP (usage retiré).*
- 👁 **Tempo CT** par move (`.bc-move-tempo`, pastilles ●○ 1–5) : poids du coût CT (lourd = rejoue
  plus tard). Idem picker du constructeur d'équipe (remplace l'ancienne colonne PP).
- 👁 Move **sans cible à portée** → grisé (`data-enabled="false"`, `aria-disabled`).
- 👁 Move **bloqué** (`data-blocked`) → grisé + indice : **Provoc** (taunt), **Entrave** (disable),
  **Bis** (encore).
- 🤖 Clic « Annuler » → revient au menu d'action, sous-menu vidé (`combat-flow.spec`).
- 🤖 Affichage FR **et** EN (noms de moves localisés).

### 4.6 Tooltip de move (`.mt-tooltip`) + preview de pattern (`.mt-grid`)
- 🤖 **Survol** (ou focus) d'un move → la tooltip apparaît ; **quitter** → elle disparaît.
- 👁 Contenu : icône de **catégorie** (Phys/Spé/Statut) + ligne **Puis / Préc** (« — » si nul) +
  ligne **Pattern + Portée** (noms FR).
- 👁 **Grille de pattern** (`.mt-cell` : `target` / `caster` / `caster-target` / `dash` / `empty`)
  cohérente avec le ciblage : Cible (1 cell), Ligne, Cône, Zone (diamant), Bombe (carré), Dash
  (tirets + cible au bout), Croix, Slash, Téléport (cible + aura).
- 🤖 **Couleurs de preview pilotées par l'intention** (`preview-colours.spec`, chantier f) — la
  grille porte `data-intent` et les cellules `data-cell` : **attaque** (Griffe, Séisme, Bélier) →
  `data-intent="attack"` ; **buff** (Danse Lames) → `data-intent="buff"` ; **soin** (Fontaine de
  Vie) → `data-intent="heal"`. Croix lanceur : `caster` (non affecté, ex. centre Séisme = vide) /
  `caster-target` (affecté, ex. centre Fontaine de Vie + Danse Lames). Dash → cellules `dash`
  (traînée) + cible d'arrivée + lanceur. *Les **couleurs exactes** (rouge/bleu/vert/jaune) = 👁.*
- 👁 **Couleurs au sol** (highlights de tiles, `battle-orchestrator`) cohérentes avec la grille
  tooltip : rouge attaque, bleu buff, vert soin, jaune traînée de dash, croix/centre vide pour
  Séisme. Contrôle pixel humain (cf §3.7).
- 🤖 **Tags spéciaux** listés selon le move : « ⏱ 2 tours », « ⏱ 2 tours (Soleil = instant) »,
  « 🛡️ basé sur la Défense », « ⚡ puissance variable », « 🔊 Sonore (ignore Clone) », blocages
  (« Bloqué par Provoc/Entrave/Bis »).
- 👁 Position près du move, **pas de débordement hors écran** (bord droit, bas).
- 👁 Valider l'affichage FR **et** EN.

### 4.7 Panneau d'info (`.ip-panel`)
- 🤖 Au boot, reflète le **Pokemon actif** : nom FR (Florizarre), niveau (Lv.50), PV plein, portrait
  (`info-panel.spec`).
- 🤖 **Portrait croppé du bundle** (plan 135) : le `<img>` du portrait porte un `src` data-URL PNG
  croppé de la feuille `portraits.png` décodée au boot (pas un fichier par-Pokemon, pas le pixel
  transparent de repli) — `sprite-bundle.spec`.
- 🤖 **Survol d'une tile** (via le hook `hoverTile`) → infos du Pokemon survolé : survol adversaire
  → nom FR (Dracaufeu) + `data-team="2"` ; survol tile **vide** → repli sur l'actif (`info-panel.spec`).
- 👁 **Badges** (statut/auras/volatils), preview menace au survol ennemi (§3.7), barre PV qui
  **descend** après dégâts (anim).
- 🤖 **Badges** : statut majeur (Brûlure…), auras (Reflet…), volatils (Provoc 3t, Clone…) —
  `data-variant` distinct par type.
- 👁 Survol d'une **tile vide** → repli sur le **Pokemon actif** (ou masqué).
- 👁 Survol d'un **ennemi** → ses infos + sa portée (preview menace, cf §3.7).
- 👁 Couleur d'équipe (`data-team`) ; se masque quand on quitte le survol.

### 4.8 Ligne d'instruction (`.bc-instruction`)
- 🤖 Guide l'action : « Sélectionne la cible » (ciblage) puis « Confirmer ? » (confirmation) —
  `targeting.spec`. *« Choisis le repli » (hit-and-run) = 👁.*

### 4.9 Journal de combat (`.bl-panel`)
- 🤖 Entrées en **FR** : usage de move (« <X> utilise <Move> ! »), dégâts (« perd N PV ! »),
  K.O. (« est K.O. ! »), fin de combat (« remporte le combat ! ») — `driving.spec` ;
  **multi-hit** (« Touché N fois ! ») — `multi-hit.spec`.
- 🤖 Titre « Journal de combat » + bouton de **repli** (`.bl-burger`) présents (`hud-menu.spec`).
  *Autoscroll, plafond ~50 lignes, pastille couleur = 👁.*

### 4.10 Modale de victoire
- 🤖 Fin de partie : modale vainqueur, bouton retour menu.

### 4.11 Transverse
- 👁 Responsive (mobile/4K) : pas d'élément coupé/chevauché.
- 🤖 i18n combat : `pt-lang=en` au boot sandbox → menu d'action en anglais (Move/Attack/…) —
  `hud.spec`. *La cohérence visuelle de la bascule (mise en page intacte) reste 👁.*

### 4.12 Flux pas-à-pas d'un tour (scénarios pilotables)
*Granularité interaction — chaque étape une case. e2e : `driving.spec`, `combat-flow.spec`,
`targeting.spec`.*

**Déplacement**
- 🤖 Clic « Deplacement » → highlights sur les tiles atteignables (`targeting.spec` ; couleur 👁).
- 👁 Survol d'une tile bleue → curseur jaune dessus.
- 🤖 Clic une tile atteignable → le Pokemon s'y déplace (anim Walk/Hop) ; le menu réapparaît avec
  « Annuler deplacement ».
- 👁 Clic hors zone bleue → rien (pas de déplacement).
- 🤖 « Annuler deplacement » → le Pokemon revient à sa tile d'origine, « Deplacement » réactivé.
- 👁 `Échap` pendant la sélection de destination → retour menu d'action sans bouger.

**Attaque (move single-target)**
- 🤖 Clic « Attaque » → sous-menu des moves.
- 🤖 Clic un move → highlights (portée/pattern) + instruction « Sélectionne la cible »
  (`targeting.spec` ; couleur rouge 👁).
- 👁 Survol d'une tile cible → **preview du pattern** (AoE/cône) + estimation de dégâts sur la barre PV.
- 🤖 Clic une cible valide → phase **confirmation**, instruction « Confirmer ? » (`targeting.spec`).
- 🤖 2ᵉ clic (confirme) → le move se résout : anim d'attaque, texte flottant, journal mis à jour.
- 🤖 Clic une tile **hors portée** en sélection de cible → pas de résolution.
- 🤖 `Échap` en sélection de cible → retour sous-menu ; `Échap` en confirmation → retour ciblage.

**Attendre / fin de tour**
- 👁 Clic « Attendre » → sélection de **direction de face** (4 flèches voisines).
- 👁 Choisir une direction → le Pokemon oriente sa face, le tour passe.
- 👁 `Échap` pendant la direction → retour menu d'action.

**Fin de combat**
- 🤖 Le dernier adversaire K.O. → journal « remporte le combat » (`driving.spec`).
- 👁 Modale de victoire + retour menu.

---

## 5. Recette — feedbacks de mécaniques
*src : `view-core/battle-orchestrator.ts`, `floating-text-content.ts`, core `battle/`*

*Convention §5 : le **SENS de chaque mécanique** (poison qui retire des PV, baisse de stat, dégâts
de chute, blocage Brume…) est **🤖 couvert par les unit/integration du core** (`packages/core`,
des milliers de tests par move + par mécanique). Ce qui reste **👁** ici = le **rendu en moteur**
(texte flottant, couleur, animation) que le scene-graph ne juge pas. Le **journal** DOM est en plus
partiellement **🤖** e2e (`driving.spec` : usage/dégâts/K.O./fin ; `multi-hit.spec` : multi-coups).
Chaque texte flottant doit s'afficher en **FR et EN**. Réf : `floating-text-content.ts`.*

### 5.1 Animation d'attaque (par catégorie)
- 👁 **Physique** → anim contact/coup vers la cible. **Spéciale** → anim charge. **Statut** →
  anim projection. Le lanceur **fait face à la cible**.

### 5.2 Dégâts / efficacité — textes flottants (un cas par type)
- 👁 **Dégâts** → `-N` (rouge) au-dessus de la cible + barre PV qui descend.
- 👁 **Soin** → `+N` (vert) sur la cible/lanceur.
- 👁 **Critique** → « Coup critique ! » (orange) + `-N`.
- 👁 **Super efficace** → « Super efficace ! » ; **Extrêmement efficace** → « Extrêmement
  efficace ! ».
- 👁 **Pas très efficace** → « Pas très efficace… » ; **quasi inefficace** → « Quasi inefficace… ».
- 👁 **Aucun effet** (immunité de type) → gris, pas de barre qui descend.
- 👁 **Raté** → « Raté ! » (gris).
- 🤖 **Multi-coups** → récap journal « Touché N fois ! » (`multi-hit.spec`). *Les `-N` en cascade +
  barre PV par coup en moteur = 👁.*
- 👁 **Recul (recoil)** → `-N` sur le **lanceur**. **Drain** → `+N` vert sur le lanceur.
- 👁 Texte secondaire (efficacité) **empilé AU-DESSUS** du primaire (offset world `+0.38`,
  `FLOATING_TEXT_SECONDARY_LIFT`), plus petit ; un seul primaire par Pokemon par beat, le reste
  **staggeré**. *Reste 👁 (non automatisable en scene-graph) : primaire et secondaire sont deux
  meshes du même nom `hud_text_plane`, le hook `__ptE2e__.meshInfo(name)` ne renvoie que le premier
  → impossible de comparer leurs Y ; de plus les labels sont éphémères (~1 s, montée+fade pilotés
  par la render-loop) → comparaison de Y race le dispose/fade (flaky, banni). Le flag `secondary`
  côté view-core est couvert en unit (`floating-text-content.test.ts`) ; l'offset world `0.38` vit
  uniquement dans le renderer (`combat-scene.spawnFloatingText`).*

### 5.3 Statuts majeurs (un cas par statut)
- 🤖 Interaction : icône montée pour chaque statut majeur + application via cast (Spore endort) — `mechanics-status.spec`. Couleur du flottant 👁.
*Chaque statut : icône à **droite** de la barre PV (`hud_status_icon` 🤖 présence via
`scene-state.spec`) + texte flottant d'application + effet par tour.*
- 👁 **Empoisonné** → « est empoisonné ! » + `-N`/tour (flash).
- 👁 **Gravement empoisonné** → « est gravement empoisonné ! » + dégâts **croissants** chaque tour.
- 👁 **Brûlé** → « est brûlé ! » + `-N`/tour + **Attaque réduite** (dégâts physiques moindres).
- 👁 **Paralysé** → « est paralysé ! » + vitesse réduite + parfois **immobilisé** (« ne peut pas
  bouger »).
- 👁 **Endormi** → « s'est endormi ! » + ne peut agir ; réveil → « se réveille ! ».
- 👁 **Gelé** → « est gelé ! » + ne peut agir ; dégel → « n'est plus gelé ».
- 👁 Guérison/expiration d'un statut → texte de retrait FR ; icône retirée.
- 👁 Immunité (déjà sous statut, type immunisé) → « Ça n'affecte pas <Pokemon>… ».

### 5.4 Changements de stats (un cas par sens)
- 🤖 Interaction : hausse (Danse-Lames, self) / baisse (Rugissement, ennemi) journalisées — `mechanics-status.spec`.
- 🤖 **Grondement** (`howl`, Normal Statut Self, StatChange Attaque +1 `radius: 2`) : buff
  multi-allié (lanceur + alliés vivants du diamant Manhattan r2). Le harness sandbox est un 1v1 →
  seul le **lanceur** (dans son propre rayon) est observable : Arcanin gagne Attaque +1 → journal
  « Attaque de <X> augmente ! » — `mechanics-status.spec`. *Le volet multi-allié (buff des alliés
  dans le rayon, exclusion des ennemis / alliés hors r2) n'est pas exposable en 1v1 → couvert unit
  `battle/moves/howl.test.ts`.*
- 👁 **Magné-Contrôle** (`magnetic-flux`, Électrik Statut Self, Déf/Déf.Spé +1 `radius: 2` +
  `abilityGate: ["plus","minus"]`) : **no-op injouable** en Gen 1 — aucun Pokemon du roster n'a le
  talent Plus/Minus, donc l'effet ne s'applique jamais. Codé par complétude (plan 156), sens couvert
  unit `battle/moves/magnetic-flux.test.ts`. Non automatisé e2e (rien d'observable).
- 👁 **Hausse** → texte **bleu** « <Stat> augmente ! » (ex. « Attaque de <X> augmente ! »).
- 👁 **Baisse** → texte **rouge** « <Stat> baisse ! ».
- 👁 Abréviations/labels stat FR : Attaque, Défense, Atq. Spé., Déf. Spé., Vitesse, Précision,
  Esquive.
- 👁 **Hausse/baisse multi-paliers** (+2 / −2) cohérente avec le palier appliqué.
- 👁 **Bloqué par Brume** → « Brume protège <Pokemon> ! ». **Bloqué par Clone** → « Le Clone protège
  <Pokemon> ! ».

### 5.5 Volatiles & blocages (un cas par volatile)
- 🤖 Interaction : confusion (Onde Folie) + Provoc journalisées — `mechanics-status.spec`. Entrave/Bis (besoin lastMove) 👁.
- 👁 **Confusion** → « <X> est confus ! » à l'application ; **wobble** du sprite tant que confus ;
  auto-dégât → « <X> est confus… » + `-N`.
- 👁 **Provoc** → « <X> est provoqué ! » + moves de statut **grisés** (`data-blocked="taunt"`) ;
  expiration → « La provoc de <X> se dissipe. ».
- 👁 **Entrave (Disable)** → « <Move> de <X> est sous Entrave ! » + ce move grisé.
- 👁 **Bis (Encore)** → « <X> reçoit un Encore ! » + seul le move répété sélectionnable.
- 👁 **Attraction** → texte d'attirance ; parfois immobilisé.
- 👁 **Flinch (Étourdi)** → « <X> a bronché ! » (n'agit pas ce tour).
- 👁 **Vampigraine** → « <X> est infecté par Vampigraine ! » + drain par tour.

### 5.6 Semi-invulnérabilité (un cas par état)
- 🤖 Interaction : Vol charge au tour 1 (journal) — `mechanics-charge.spec`. Sprite caché/atterrissage 👁.
- 👁 **Vol** (Aéroacrobatie…) / **Tunnel** / **Plongée** / **Ténèbres (Vanished)** → tour 1 :
  **sprite caché** + indicateur d'état au-dessus.
- 👁 Une attaque visant la cible **disparue rate** (sauf moves qui touchent en semi-invul).
- 👁 **Atterrissage** (tour 2) : le sprite **réapparaît** au sol à la résolution.

### 5.7 Substitut (Clonage)
- 🤖 Interaction : Clonage crée le Clone (journal) — `mechanics-charge.spec`. Swap poupée/encaisse 👁.
- 👁 Pose → « <X> crée un Clone ! » ; le sprite est **remplacé par la poupée**.
- 👁 Les dégâts ennemis frappent le clone → « Le Clone de <X> encaisse N ! » ; la barre PV affiche
  toujours les **vrais PV** du Pokemon.
- 👁 Statuts/baisses de stats ennemis **bloqués** (« Le Clone protège <X> ! »).
- 👁 Moves **sonores** ignorent le clone (frappent le vrai Pokemon).
- 👁 Clone brisé → « <Y> brise le Clone de <X> ! » + le sprite réel **réapparaît**.

### 5.8 K.O. & corps bloquant
- 👁 Anim de **chute** (Faint) + **teinte grise**, l'ombre disparaît.
- 🤖 Journal « <X> est K.O. ! » (`driving.spec`).
- 👁 Le **corps K.O. reste en place** et **bloque sa tile** (inaccessible aux autres).

### 5.9 Auras (Reflet / Mur Lumière / Brume / Rune Protect) — un cas par aura
- 🤖 Interaction : Reflet / Mur Lumière / Brume / Rune Protect posés (journal) — `mechanics-field.spec`.
- 👁 Pose → « <X> pose <Aura> (N tours) » + **indicateur à gauche** de la barre PV (lanceur opaque,
  alliés protégés semi-transparents ; cf §3.4/3.5).
- 👁 **Reflet** réduit les dégâts **physiques** ; **Mur Lumière** les **spéciaux** (cibles dans le
  rayon).
- 👁 **Brume** bloque les baisses de stats ; **Rune Protect** bloque les statuts.
- 👁 **Brisée** (Casse-Brique sur le lanceur) → « <Y> brise l'aura <Aura> de <X> ! » (rouge).
- 👁 **Expiration** → « L'aura <Aura> de <X> se dissipe » (silencieux, disparition de l'indicateur).

### 5.10 Champs de terrain (Herbu / Électrifié / Brumeux / Psychique) — un cas par champ
- 🤖 Interaction : 4 champs (Herbu/Électrifié/Brumeux/Psychique) déployés (journal) — `mechanics-field.spec`.
- 👁 Pose → « <X> déploie le <Champ> (N tours) » + **overlay couleur** sur la zone + **pastille**
  compteur (cf §3.1/3.2).
- 👁 **Herbu** : soin par tour des Pokemon au sol dans la zone, boost moves Plante.
- 👁 **Électrifié** : empêche le sommeil au sol (« Le Champ Électrifié garde <X> éveillé ! »),
  boost moves Élek.
- 👁 **Brumeux** : protège du statut au sol (« Le Champ Brumeux protège <X> ! »).
- 👁 **Psychique** : bloque le dash à travers (mur) + dégâts d'impact (cf §3.3).
- 👁 **Expiration** → « Le <Champ> se dissipe ».

### 5.11 Charge / multi-tours
- 🤖 Interaction : Lance-Soleil concentre l'énergie au tour 1 (journal) — `mechanics-charge.spec`.
- 👁 Move à charge (tour 1) → « <X> concentre son énergie pour <Move> ! » + **indicateur ⚡** à
  gauche de la barre PV.
- 👁 Tour 2 → le move se résout, l'indicateur disparaît.
- 🤖 **Soleil + `sunSkipsCharge`** : sous Soleil, sélectionner Lance-Soleil ne peint **aucune** preview
  de charge (`highlight_preview_buff_*` = 0) → le tour de charge est sauté, tir immédiat — `mechanics-charge.spec`.
- 🤖 **Hors Soleil (contrôle)** : Lance-Soleil charge normalement → preview de charge peinte sur la
  propre case du lanceur (`highlight_preview_buff_2_3`) — `mechanics-charge.spec`.
- 👁 **Soleil** : moves `sunSkipsCharge` (Lance-Soleil) se résolvent **en un tour** (pas de charge) —
  *l'absence de l'indicateur ⚡ + l'anim de tir reste 👁*. Légalité↔exécution couverte en unit core
  (`solar-beam.test`, `fly.test` : sous Soleil seul `sunSkipsCharge` saute la charge, Vol charge quand même).
- 👁 **Recharge** (Giga Impact…) → « <X> doit se recharger » au tour suivant (ne peut agir).

### 5.12 Météo (un cas par météo)
- 🤖 Interaction : Danse Pluie / Zénith / Tempête de Sable posées (journal) + HUD « Plein soleil » — `weather.spec`.
- 👁 **Pluie** → « Il commence à pleuvoir ! » + boost Eau / baisse Feu ; fin → « La pluie cesse. ».
- 👁 **Soleil** → « Le soleil brille intensément ! » + boost Feu / baisse Eau.
- 👁 **Tempête de sable** → annonce + **dégâts de fin de tour** (« <X> est blessé par la tempête de
  sable ! ») sauf types immunisés.
- 👁 **Neige** → annonce + effet défensif.
- 🤖 **HUD météo** : « Plein soleil » + tours restants (`weather.spec`, cf §4.3). *Les annonces
  flottantes par météo + guerre de météo = 👁.*

### 5.13 Déplacement / retraite / Baton Pass / hit-and-run
- 🤖 Interaction : Téléport + hit-and-run (Demi-Tour) pilotés (journal) — `mechanics-movement.spec`. Baton Pass 👁 (pas d'allié en 1v1).
- 🤖 **Dash directionnel (chantier g)** : un Dash se confirme par **direction** (comme Cône/Ligne/
  Tranche), plus par la tuile d'atterrissage variable — cliquer n'importe quelle tuile de l'axe valide
  la direction, portée auto. Piloté (journal) avec Vive-Attaque (`quick-attack`, Dash 2) : survol + clic
  d'une tuile de l'axe ≠ atterrissage → le dash se résout — `mechanics-movement.spec`. *La traînée jaune
  + l'anim de glissade/saut restent 👁.*
- 👁 **Déplacement** lissé (Walk / Hop selon terrain ; volants en glide).
- 👁 **Repli (Endurance/retreat)** : le Pokemon glisse vers sa tile de repli.
- 👁 **Baton Pass** → « <X> passe le relais à <Y> ! » + transfert des changements de stats.
- 👁 **Hit-and-run** (Demi-Tour…) : attaque **puis** repli (deux mouvements distincts) ; raté →
  pas de repli ; pas de tile dispo → « <X> ne peut pas reculer. ».
- 👁 **Téléportation** → « <X> se téléporte ! ».
- 👁 **Repoussé (knockback)** → « <X> est repoussé ! ».

### 5.14 Talents & objets
- 🤖 Interaction : **Intimidation** (talent, baisse l'Atq adverse à l'entrée) + **Restes** (objet, soin de fin de tour) journalisés — `mechanics-abilities.spec` (config `dummyAbility`/`heldItem`).
- 🤖 **Talents Tier A** (plan 136) — observables pilotés de bout en bout (`mechanics-talents-tier-a.spec`,
  config `playerAbility`), tous déterministes (aucun jet) : **Régé-Force** (`regenerator`, soin passif de
  fin de tour : porteur blessé → « Régé-Force de <X> s'active ! » + « <X> récupère N PV ») ; **Multi-Coups**
  (`skill-link`, Balle Graine 2-5 frappes → toujours le max : « Touché 5 fois ! » quel que soit le seed) ;
  **Querelleur** (`scrappy`, Griffe (Normal) touche un Ectoplasma Spectre normalement immunisé → ligne de
  dégâts « <X> perd N PV » présente et « Ça n'affecte pas… » absente — garde la régression du fix
  handle-damage, efficacité 0 → neutre 1). *Acharné (`defiant`, baisse de stat adverse → Atq +2),
  Battant (`competitive`, → Atq. Spé. +2), Colérique (`anger-point`, coup critique → Atq +6), Sniper,
  Inconscient, Téméraire, Rivalité, Lentiteintée = multiplicateurs/réactions silencieux ou dépendants du
  comportement de l'IA dummy (pas de move adverse abaisseur de stat scriptable de façon fiable en sandbox)
  → couverts unit/integration core (`battle/abilities.integration.test.ts`) → 👁.*

#### 5.15 Talents Tier B (plan 137)
- 🤖 **Sécheresse** (`drought`, météo auto à l'entrée) — porteur Goupix : le Soleil est posé à la création
  du combat (hook `weatherAutoSetter`) sans action → HUD météo « Plein soleil » dès le boot
  (`mechanics-talents-tier-b.spec`, config `playerAbility` + `weather: none` pour prouver l'origine talent).
- 🤖 **Cuvette** (`rain-dish`, soin de fin de tour sous Pluie) — porteur Carapuce blessé (hp 50) sous Pluie :
  fin de tour → « Cuvette de <X> s'active ! » + « <X> récupère N PV » (`mechanics-talents-tier-b.spec`).
- 🤖 **Vaccin** (`immunity`, immunité Poison) — le joueur lance Poudre Toxik (100 % Poison) sur le Ronflex
  adjacent porteur du talent : le statut est bloqué → « Vaccin de Ronflex s'active ! » présent et « est
  empoisonné » absent (`mechanics-talents-tier-b.spec`, `onStatusBlocked`).
- 👁 **Cœur de Coq** (`big-pecks`, bloque baisses de Défense) / **Lumiattirance** (`illuminate`, bloque baisses
  de Précision) — blockers `onStatChangeBlocked` ; aucun move adverse abaisseur de Défense/Précision
  scriptable de façon fiable en sandbox → couverts unit/integration core (`abilities.integration.test`).
- 👁 **Baigne Sable** (`sand-rush`, ×2 Vitesse en Tempête de Sable) / **Rideau Neige** (`snow-cloak`, +1 esquive
  sous Neige) — multiplicateurs CT / boost d'esquive silencieux (`weatherSpeedBoost`/`weatherEvasionBoost`,
  pas d'event) → couverts unit core.
- 👁 **Phobique** (`rattled`, +1 Vitesse si touché Ténèbres/Spectre/Insecte) / **Cœur Noble** (`justified`, +1
  Attaque si touché Ténèbres) — réactions `onAfterDamageReceived` dépendantes d'un coup adverse du bon type
  (pas de move adverse scriptable en sandbox) → couverts unit core.
- 👁 **Mue** (`shed-skin`, 33 % soigne le statut en fin de tour) — soin probabiliste gated `random()` ; le seed
  moteur ne contrôle pas directement ce tirage en sandbox → couvert unit core.
- 👁 **Hydratation** (`hydration`, soigne le statut sous Pluie) — soin de fin de tour conditionnel ; déjà couvert
  unit core, sens identique à Cuvette/Mue (statut majeur + météo) → non dupliqué e2e.
- 👁 **Corps Gel** (`ice-body`, soin de fin de tour sous Neige) — même factory que Cuvette (autre météo) →
  couvert unit core, non dupliqué e2e.
- 👁 **Écaille Spéciale** (`marvel-scale`, dégâts physiques reçus ÷1.5 sous statut majeur) — multiplicateur
  `onDamageModify` silencieux → couvert unit core.
- 👁 **Impassible** (`steadfast`, +1 Vitesse quand le porteur flinch) — réaction `onFlinch` dépendante d'un
  move adverse à flinch joué par l'IA dummy (pas scriptable de façon fiable) → couvert unit core.

#### 5.16 Talents Tier C (plan 138)
- 🤖 **Force Soleil** (`solar-power`, perte 1/8 PV max en fin de tour sous Soleil) — porteur Dracaufeu blessé
  (hp 50) sous Soleil : « Attendre » → fin de tour → « Force Soleil de <X> s'active ! » + « <X> perd N PV ! »
  (`mechanics-talents-tier-c.spec`, `onEndTurn`). Le ×1.5 dégâts spéciaux reste couvert unit/integration core.
- 🤖 **Anti-Bruit** (`soundproof`, immunité moves sonores) — le joueur Dracaufeu lance Mégaphone (sonore, 100 %)
  sur l'Électrode porteur : le move est bloqué avant les dégâts → « Anti-Bruit de <X> s'active ! » présent et
  « perd N PV » absent (`mechanics-talents-tier-c.spec`, `onMoveImmunity` / `flags.sound`).
- 🤖 **Boom Final** (`aftermath`, recul 1/4 PV max à l'attaquant sur K.O. au contact) — le joueur met K.O. le
  Smogogo (1 PV) avec Griffe (contact) → le recul touche l'attaquant : « Boom Final de <X> s'active ! » +
  « Dracaufeu perd N PV ! » (`mechanics-talents-tier-c.spec`, `onAfterDamageReceived`).
- 🤖 **Armurouillée** (`weak-armor`, touché physique → Déf -1 / Vit +2) — le joueur frappe l'Onix endurant
  (hp 999) avec Griffe (physique) → « Armurouillée de <X> s'active ! » + « Défense de <X> baisse ! » +
  « Vitesse de <X> augmente ! » (`mechanics-talents-tier-c.spec`, `onAfterDamageReceived`).
- 👁 **Force Sable** (`sand-force`, ×1.3 Roche/Sol/Acier en Tempête de Sable) — multiplicateur `onDamageModify`
  silencieux (pas d'event) → couvert unit/integration core.
- 👁 **Peau Sèche** (`dry-skin`, soin/perte météo + immunité Eau soignante + ×1.25 Feu) — multiplicateurs et
  absorption silencieux ; sens identique aux autres absorptions de type → couvert unit/integration core.
- 👁 **Feuille Garde** (`leaf-guard`, bloque le statut majeur sous Soleil) — blocage `onStatusBlocked` ; couvert
  unit/integration core (sens identique à Vaccin/Tier B, non dupliqué e2e).
- 👁 **Envelocape** (`overcoat`, immunité moves `flags.powder`) — immunité `onMoveImmunity` (sens identique à
  Anti-Bruit, autre flag) → couvert unit (effect-processor) / integration core.
- 👁 **Pieds Confus** (`tangled-feet`, précision entrante ×0.5 si confus) / **Peau Miracle** (`wonder-skin`,
  précision des moves statut entrants ×0.5) — modificateurs `onEvasionModify` (jet de précision) → couverts
  unit core (`accuracy-check.test`) ; pas d'origine d'event observable.
- 👁 **Pied Véloce** (`quick-feet`, initiative ×1.5 + ignore le malus paralysie sous statut majeur) —
  multiplicateur d'initiative silencieux (`statusSpeedBoost`) → couvert unit core (`initiative-calculator.test`).
- 👁 **Télécharge** (`download`, +1 Atq ou Atq. Spé. à l'entrée selon les défenses adverses) — buff d'entrée
  conditionnel ; couvert integration core (comparaison Déf/Déf. Spé.) → 👁.
- 👁 **Agitation** (`hustle`, ×1.5 dégâts physiques / précision ×0.8) / **Analyste** (`analytic`, ×1.3 si le
  porteur agit après la cible) — multiplicateurs `onDamageModify`/`onAccuracyModify` silencieux → couverts
  integration core.
- 👁 **Puanteur** (`stench`, 10 % flinch sur coup) — réaction probabiliste gated `random()` non contrôlée
  directement par le seed sandbox → couvert integration core.
- 👁 **Suintement** (`liquid-ooze`, le drain blesse le draineur) — réaction `onDrainAttempt` dépendante d'un
  move drain adverse (pas scriptable côté joueur en sandbox sans dummy actif fiable) → couvert unit
  (`handle-drain.test`) / integration core.
- 👁 **Infiltration** (`infiltrator`, bypass substitut/écrans/Voile/Brume) — bypass silencieux (pas d'event
  dédié) → couvert integration core.

#### 5.17 Talents attaquant — effet secondaire (plan 139)
- 🤖 **Sans Limite** (`sheer-force`, supprime l'effet secondaire d'un move offensif et ×1.3 puissance) — le
  Nidoking porteur lance Bombe Beurk (`sludge-bomb`, secondaire 30 % poison) sur le dummy endurant (hp 999) :
  le secondaire est SUPPRIMÉ avant tout tirage → « Sans Limite de <X> s'active ! » présent, dégâts présents,
  « est empoisonné » absent — déterministe à tout seed (suppression inconditionnelle)
  (`mechanics-talents-secondary.spec`, suppression id-check `effect-processor`). Le ×1.3 dégâts reste couvert
  unit/integration core (`abilities.integration.test`).
- 🤖 **Sérénité** (`serene-grace`, double la chance des effets secondaires) — modificateur SILENCIEUX (pas
  d'`AbilityActivated`), prouvé par un FLIP déterministe : Leveinard lance Bombe Beurk (secondaire 30 %
  poison) au seed 1. SANS le talent (témoin) le tirage 30 % échoue → « est empoisonné » absent ; AVEC, le
  30 % doublé en 60 % réussit → « <X> est empoisonné ! » présent. La même graine des deux côtés prouve que
  c'est le doublement (et non le seed) qui pose le poison (`mechanics-talents-secondary.spec`, doublement
  id-check `effect-processor`). Le cap à 100 % et l'exclusion des secondaires Self/100 %/objets-flinch
  restent couverts unit/integration core.

#### 5.24 Talents soutien & couplage objet (plan 141)
- 🤖 **Moiteur** (`damp`, bloque les moves d'explosion) — le joueur Électrode force Destruction
  (`self-destruct`, `isExplosion`) sur le Psykokwak (slot Moiteur) adjacent : le move échoue AVANT les
  dégâts → « Moiteur de <X> s'active ! » présent, « Mais cela échoue (Électrode) ! » présent, « Psykokwak
  perd N PV » absent (la cible n'encaisse rien) (`mechanics-talents-support.spec`, gate `isExplosion` +
  `findFieldDamp` dans `executeUseMove`). Le blocage du recul de Boom Final reste couvert integration core.
- 🤖 **Gloutonnerie** (`gluttony`, baie de pincement déclenchée à 50 % PV au lieu de 25 %) — le Ronflex
  porteur, à 40 % PV avec une Baie Lichii, n'a pas de cible : « Attendre » → fin de tour → le hook baie
  voit le pincement (40 % ≤ 50 %) → « Baie Lichii de <X> s'active ! » + « Attaque de <X> augmente ! »
  (`mechanics-talents-support.spec`, seuil `GLUTTONY_BERRY_THRESHOLD` dans `pinchStatBerry`). Sans le
  talent, 40 % > 25 % → rien (témoin négatif couvert integration core `talents-soutien.integration.test`).
- 👁 **Cœur Soin** (`healer`, 30 % de chance par fin de tour de guérir le statut majeur d'un allié à r2)
  et **Garde-Ami** (`friend-guard`, ÷ dégâts ×0,75 sur un allié à r2) — talents **de soutien d'équipe** :
  ils n'ont d'effet qu'avec un ALLIÉ vivant dans le rayon r2. La sandbox e2e est un 1v1 strict (joueur +
  dummy adverse, pas d'équipe ni d'allié pilotable) → non observables ici. Sens couvert unit
  (`battle/friend-guard-system.test`) + integration core (`talents-soutien.integration.test` : allié
  paralysé soigné à r2 seed fixe / non soigné à r3 ; dégâts ×0,75 sur allié r2).
- 👁 **Tension** (`unnerve`, empêche l'ennemi de manger ses baies tant que le porteur est vivant) —
  talent SILENCIEUX : son effet est l'ABSENCE de déclenchement d'une baie adverse (pas d'`AbilityActivated`,
  pas de ligne de journal). Un e2e « rien ne s'est passé » serait fragile (la baie côté dummy ne se
  déclencherait de toute façon que sur un événement précis) → couvert integration core
  (`talents-soutien.integration.test` : baie non mangée face à un ennemi Tension vivant) + unit
  (`battle/berry-suppression.test`).

#### 5.25 Item interaction — manipulation de l'objet tenu (plan 142)
Les 12 moves pilotés de bout en bout via le journal FR (`BattleLogFormatter`) + la ligne objet de
l'InfoPanel (`info-panel-item`, « 🎒 {nom} »). Tous déterministes (aucun override `Math.random`) :
moves 100 % précision sur cible adjacente (DUEL) → pas de jet ; Éructation (90 %) s'appuie sur le seed
fixe DUEL. On asserte le SENS (ligne de journal / contenu InfoPanel), jamais le pixel
(`mechanics-item-interaction.spec`).
- 🤖 **Sabotage** (`knock-off`, retire l'objet retirable de la cible) — le joueur lance Sabotage sur le
  dummy porteur des Restes (`dummyHeldItem`) adjacent → « <X> perd son Restes ! » + dégâts. Le ×1.5 si la
  cible porte un objet est un multiplicateur SILENCIEUX (valeur couverte unit/integration `damage-calculator`
  + `moves/knock-off.test`) → on prouve le RETRAIT (la ligne de journal), pas le multiplicateur.
- 🤖 **Larcin** (`thief`, vole l'objet si le lanceur a les mains vides — D2) — le joueur SANS objet lance
  Larcin sur le dummy porteur des Restes → « <X> vole le Restes de <Y> ! », puis l'InfoPanel du LANCEUR
  (survol de sa case) affiche « 🎒 Restes ». La condition mains-vides (sinon dégâts seuls) est couverte
  unit (`moves/thief.test`, `moves/covet.test`). Implore (`covet`) partage l'effet `StealItem` → unit, non
  re-piloté e2e → 👁.
- 🤖 **Tour de Magie** (`trick`, échange inconditionnel des objets — D3) — le joueur tient le Bandeau
  Choix, le dummy les Restes ; l'échange journalise « <X> échange son objet avec <Y> ! » et l'InfoPanel du
  lanceur montre désormais « 🎒 Restes ». L'échec si les DEUX sont vides = unit (`moves/trick.test`).
  Passe-Passe (`switcheroo`) partage l'effet `SwapItems` → unit, non re-piloté e2e → 👁.
- 🤖 **Dégommage** (`fling`, lance l'objet tenu — D6) — le joueur tient l'Orbe Flamme (`flame-orb`, fling
  power 30) et lance Dégommage au TOUR 1 (avant que l'Orbe ne brûle son propre porteur en fin de tour) sur
  le dummy endurant (hp 999 → survit, on observe le STATUT) → « <X> dégomme son Orbe Flamme ! » + « <Y> est
  brûlé ! » (table `FLING_EFFECT`). Injouable sans objet flingable (`requiresFlingableItem`) + table de
  puissance/secondaires (baies lancées, Orbe Toxique, flinch…) = unit/integration (`moves/fling.test`).
- 🤖 **Recyclage** (`recycle`, restaure le dernier objet consommé par son effet — D1) — le Ronflex tient
  une Baie Lichii et démarre à 20 % PV : « Attendre » → fin de tour → la baie se mange (`consumedItemId`) →
  « … a utilisé son Baie Lichii ». Au tour suivant, Recyclage (Self) → « <X> recycle son Baie Lichii ! » et
  l'InfoPanel re-montre « 🎒 Baie Lichii ». La non-restauration d'un objet RETIRÉ/volé (vs consommé) = unit
  (`moves/recycle.test`).
- 🤖 **Éructation** (`belch`, injouable tant qu'aucune baie n'a été mangée — D7) — le Ronflex tient une
  Baie Lichii à 20 % PV : « Attendre » → fin de tour → la baie se mange (`ateBerryThisBattle`). Au tour
  suivant, Éructation (seul move) devient légale et résout sur le dummy endurant (hp 999) → « Dummy perd N
  PV ». Prouve le gate par baie : c'est l'action de manger qui débloque le move. Le filtrage `getLegalActions`
  + garde `submitAction` = unit (`moves/belch.test`).
- 🤖 **Talent Glu** (`sticky-hold`, bloque tout retrait/vol/échange — D12) — le joueur lance Sabotage sur
  le dummy Grotadmorv (muk, slot Glu via `dummyAbility`) porteur des Restes → le retrait est bloqué : « Glu
  de <X> s'active ! » présent et « perd son Restes » ABSENT (l'objet reste). Les dégâts frappent
  normalement (hors sens testé). Le blocage du vol/échange/Larcin/Tour de Magie = unit/integration
  (`abilities.integration.test`, `held-item-transfer.test`).
- 👁 **Picore / Piqûre** (`pluck` / `bug-bite`, mange la baie de la cible et applique son effet au lanceur
  — D8) et **Calcination** (`incinerate`, détruit la baie/gemme de la cible sans bénéfice — D9) et **Gaz
  Corrosif** (`corrosive-gas`, retire l'objet de la cible — statut) : pilotables mais redondants avec les
  signaux déjà couverts ci-dessus (manger une baie / retirer un objet) et leur valeur fine (effet de la
  baie transférée au lanceur, destruction sans effet, équivalence du retrait) tient au CONTENU précis que le
  journal n'expose pas distinctement → couverts unit/integration core (`moves/pluck.test`, `moves/bug-bite.test`,
  `moves/incinerate.test`, `moves/corrosive-gas.test`, `held-item-transfer.test`).
- 👁 **Substitut bloque l'item-manip** (D5) — l'effet objet est silencieusement annulé à travers un Clonage
  actif (les dégâts frappent le Clone normalement). « Rien ne se passe » côté objet → e2e fragile → couvert
  integration core (`held-item-manip.integration.test` / `isSubstituteActive`).
- 👁 **Baies Lansat / Frista** (`lansat-berry` / `starf-berry`, débloquées par l'infra — D11) — pincement
  ≤25 % PV → Lansat pose un stage de crit volatile (`critStageBoost += 2`), Frista +2 sur une stat
  aléatoire (PRNG seedé). Le boost de crit n'a pas de ligne de journal distincte (l'effet est statistique
  sur le calcul de dégâts) → couvert unit (`battle/items/lansat-berry.test`, `starf-berry.test`).


  **Grelot Coque** (`shell-bell`, soin post-coup : porteur blessé qui attaque → 1/8 des dégâts rendus,
  « Grelot Coque de <X> s'active ! » + « <X> récupère N PV ») ; **Orbe Toxique** (`toxic-orb`,
  auto-statut : empoisonne gravement le porteur en fin de tour sans statut majeur, « Orbe Toxique de
  <X> s'active ! » + « <X> est gravement empoisonné ! »). *Bandeau Muscle (`muscle-band`, ×1.1 phys) /
  Lunettes Sages (`wise-glasses`, ×1.1 spé) = simples multiplicateurs sans event → couverts unit
  (`battle/items/simple-held-items.test.ts`), non pilotés e2e → 👁.*
- 🤖 **Objets de réaction au coup reçu** — une famille, pilotée de bout en bout
  (`mechanics-abilities.spec`) : **Bulbe** (`absorb-bulb`, touché par un coup Eau → Atq. Spé. +1 puis
  consommé). Le dummy Ronflex (Normal, neutre à l'Eau et endurant → survit au coup, requis car le hook
  ne fire que si la cible est encore en vie) porte le Bulbe (`dummyHeldItem`), le joueur Tortank lance
  Pistolet à O (Eau, 100 %) → « Bulbe de <X> s'active ! » + « Atq. Spé. de <X> augmente ! » (StatChanged) + « <X> a
  utilisé son Bulbe » (HeldItemConsumed). *Pile (`cell-battery`, Élek → Atq +1), Boule de Neige
  (`snowball`, Glace → Atq +1), Lichen Lumineux (`luminous-moss`, Eau → Déf. Spé. +1) partagent la
  même factory (autre type/stat, même hook `onAfterDamageReceived`) → couverts unit
  (`battle/items/type-reaction-items.test.ts`), non dupliqués e2e → 👁.*
- 🤖 **Granules de terrain** — une famille, pilotée de bout en bout (`mechanics-abilities.spec`) :
  **Graine Électrik** (`electric-seed`, sur le Champ Électrifié → Déf +1 en fin de tour puis consommée,
  hook `onEndTurn` + `getFieldTerrainAt`). La sandbox ne pré-pose aucun champ → le porteur Florizarre
  (`heldItem`) lance Champ Électrifié (`electric-terrain`, Self, forcé via `moves`) qui déploie la zone
  (rayon 3) sous lui, puis `endTurn()` fait jouer le hook → « Graine Électrik de <X> s'active ! » + « Défense de
  <X> augmente ! » (StatChanged) + « <X> a utilisé son Graine Électrik » (HeldItemConsumed). *Graine Herbe
  (`grassy-seed`, Champ Herbu → Déf +1), Graine Psychique (`psychic-seed`, Champ Psychique → Déf. Spé. +1),
  Graine Brume (`misty-seed`, Champ Brumeux → Déf. Spé. +1) partagent la même factory (autre champ/stat,
  même hook) → couvertes unit (`battle/items/terrain-seed-items.test.ts`), non dupliquées e2e → 👁.*
- 🤖 **Baies** — une par famille de mécanique, pilotées de bout en bout (`mechanics-abilities.spec`) :
  **Baie Pocpoc** (`passho-berry`, anti-type : ÷2 un coup Eau super-efficace, déclenché par un
  Pistolet à O sur l'Onix porteur) ; **Baie Lichii** (`liechi-berry`, pincement : +1 Atq à ≤25 % PV
  en fin de tour) ; **Baie Fraive** (`rawst-berry`, soin : guérit la brûlure en fin de tour). Chacune
  asserte « <Baie> de <X> s'active ! » + « <X> a utilisé son <Baie> » (consommation). *Les 18/4/7
  baies au complet = couvertes unit/integration core (`battle/items/*-berries.test.ts`) ; la table
  par baie n'est pas re-pilotée e2e (même mécanique, IDs différents) → reste 👁 par baie.*
- 🤖 **Roches de durée météo** — une représentante, pilotée de bout en bout
  (`weather.spec`) : **Roche Humide** (`damp-rock`, Pluie 5→8 tours). Le poseur tenant la roche
  (`heldItem`) lance Danse Pluie (`rain-dance`, forcé via `moves`) → le compteur du HUD
  (`weather-turns`) affiche **8 tours** au lieu de 5. Déterministe : setters météo sans jet de
  précision, timer décrémenté seulement au tick de fin de tour. *Les 3 autres roches — Roche Lisse
  (`smooth-rock`, Tempête de Sable), Roche Glace (`icy-rock`, Neige), Roche Chaude (`heat-rock`,
  Soleil) — partagent la même logique (table `WEATHER_EXTENDER_ITEM` → 8 tours) et sont couvertes
  unit core (`battle/weather-system.test.ts`) ; non re-pilotées e2e (même mécanique, IDs/météos
  différents) → 👁 par roche.*
- 🤖 **Objets de précision** — la modification de précision est SILENCIEUSE (hook `onAccuracyModify`,
  aucun event) → l'unique signal est le RÉSULTAT du jet (touche/rate), piloté par « bande de jet »
  (`mechanics-abilities.spec`) : Raichu lance Élecanon (`zap-cannon`, précision 50 %, Ligne) sur un
  Ronflex inerte aligné (999 PV → survit), seed **6** dont le tirage tombe dans [50 %, 55 %). **Loupe**
  (`wide-lens`, ×1,1 → 55 %) : sans objet le coup RATE (« <X> rate son attaque ! »), AVEC la Loupe il
  TOUCHE (« <Y> perd N PV ! ») — la même graine prouve que le +10 % comble exactement l'écart (un test
  témoin sans objet + un test Loupe). **Lentille Zoom** (`zoom-lens`, ×1,2 si le porteur agit APRÈS la
  cible) : face à un dummy inerte qui n'agit jamais, la condition est toujours fausse → reste à ×1,0 →
  RATE comme sans objet (test asserte le raté). *Le ×1,2 conditionnel n'est pas pilotable en sandbox
  1v1 (cible inerte) → couvert unit (`battle/items/precision-items.test.ts`) → cette facette reste 👁.*
- 🤖 **Objets d'évasion** — miroir DÉFENSEUR des objets de précision : le porteur (la cible) réduit la
  précision des coups entrants de 10 % (×0,9, hook `onEvasionModify`). Modification SILENCIEUSE (aucun
  event) → l'unique signal est le RÉSULTAT du jet, piloté par « bande de jet » (`mechanics-abilities.spec`) :
  Raichu lance Jet-Pierres (`rock-throw`, précision 90 %, Single) sur un Ronflex inerte (999 PV → survit),
  seed **30** dont le tirage tombe dans [81 %, 90 %). Sans objet le coup TOUCHE (« <Y> perd N PV ! »),
  AVEC **Poudre Claire** (`bright-powder`, ×0,9 → 81 %) il RATE (« <X> rate son attaque ! »), et de même
  avec **Encens Doux** (`lax-incense`, même ×0,9) — la même graine prouve que le −10 % bascule exactement
  le résultat (un témoin sans objet + un test par objet ; déterminisme croisé vérifié).
- 🤖 **Objets flinch** — côté ATTAQUANT : le porteur qui touche avec un move offensif (sans flinch
  propre) a +10 % de chance d'APEURER la cible (hook `onFlinchChance`). Le déclenchement est un jet de
  10 % → isolé par « bande de jet » (`mechanics-abilities.spec`) : Raichu tient l'objet (`heldItem`) et
  lance Jet-Pierres (`rock-throw`, précision 90 %, Single) sur un Ronflex inerte (999 PV → survit, donc
  cible toujours éligible au flinch), seed **3** où Jet-Pierres TOUCHE puis le jet de flinch passe.
  Sans objet la cible touche mais n'est jamais apeurée (« est apeuré » absent), AVEC **Roche Royale**
  (`kings-rock`) elle l'est (« <Y> est apeuré ! »), de même avec **Croc Rasoir** (`razor-fang`, même
  +10 %) — un témoin sans objet + un test par objet ; déterminisme croisé vérifié sur 3 passes.
- 🤖 **Herbe Mental** (`mental-herb`) — soigne un volatile restrictif (Provoc/Encore/Entrave/
  Attraction/Anti-Soin) dès qu'il tombe sur le porteur, puis se consomme (helper `tryMentalHerbCure`,
  appelé dans `handle-status`/`handle-encore`/`handle-disable`). Piloté de bout en bout
  (`mechanics-abilities.spec`) : le joueur lance **Provoc** (`taunt`, 100 %, Single) sur le dummy
  porteur (`dummyHeldItem`) → « Herbe Mental de <X> s'active ! » + « <X> a utilisé son Herbe Mental ».
  Les autres volatiles (Encore/Entrave/Attraction/Anti-Soin) partagent le helper → couverts unit
  (`battle/mental-herb.test.ts`), non dupliqués e2e.
- 🤖 **Veste de Combat** (`assault-vest`) — interdit la sélection des moves de catégorie statut
  (`forbidsStatusMoves`, filtre `getLegalActions`). Signal DOM pur (`mechanics-abilities.spec`) : au
  menu Attaque le move statut (Repli) reste affiché mais non sélectionnable (`data-enabled="false"`),
  alors qu'un move offensif (Griffe) reste sélectionnable ; témoin sans objet → Repli sélectionnable.
  La réduction des dégâts spéciaux ×1,5 (hook `onDamageModify` défenseur) est couverte unit
  (`battle/items/assault-vest.test.ts`).
- 👁 **Grosse Racine** (`big-root`, +30 % au soin des moves drain, hook `onDrainHealModify`) — l'écart
  de PV soignés n'est pas exposé proprement par le journal 1v1 (le drain n'émet qu'une ligne de PV
  rendus, non comparable d'une run à l'autre dans l'UI) → couvert unit avec assertion chiffrée
  déterministe (`battle/items/big-root.test.ts` : soin ×1,3, backlash Suintement non affecté,
  Anti-Soin supprime le soin).
- 🤖 **§5.17 nouveaux objets (lot 95→99)** — pilotés de bout en bout (`mechanics-items.spec`) :
  - **Ballon** (`air-balloon`) — éclate (consommé) au PREMIER coup offensif non-Sol reçu
    (hook `onAfterDamageReceived`). Le joueur lance Griffe (contact, 100 %) sur le dummy porteur
    (`dummyHeldItem`) adjacent → « Ballon de <X> s'active ! » + « <X> a utilisé son Ballon ».
    *L'immunité aux moves Sol (0 dégât), le traitement « aérien » (`isEffectivelyFlying` : immunité
    hazards au sol / DoT terrain / repoussé, court-circuité par Racines/Atterrissage) et le retour
    au sol après éclatement sont SILENCIEUX → couverts unit (`battle/items/air-balloon.test.ts` +
    `battle/effective-flying.test.ts`) → 👁.*
  - **Lunettes Filtre** (`safety-goggles`) — immunité aux moves Poudre (hook `onMoveImmunity`). Le
    joueur lance Spore (`spore`, 100 %, Poudre, hors-pool forcé via `moves`) sur le dummy porteur
    adjacent → « Lunettes Filtre de <X> s'active ! », aucun Sommeil (« s'est endormi » absent).
    *L'immunité aux dégâts de météo (Tempête de Sable) est SILENCIEUSE → couverte unit
    (`battle/items/safety-goggles.test.ts`) → 👁.*
  - **Pare-Effet** (`protective-pads`) — les moves contact du PORTEUR ignorent les réactions de
    contact de la cible (recoil Casque Brut, Statik, etc.). Réaction nullifiée = SILENCIEUSE → signal
    = ABSENCE. Le joueur tient le Pare-Effet (`heldItem`) + Griffe (contact) sur un dummy au Casque
    Brut (`dummyHeldItem`) → « Casque Brut … s'active » ABSENT ; témoin sans objet → le Casque Brut
    s'active. *Statik non paralysé, Boom Final non backfire, et le respect des effets offensifs
    PROPRES du porteur → couverts unit (`battle/items/protective-pads.test.ts`).*
  - **Talisman Sain** (`clear-amulet`) — bloque toute baisse de stat infligée par l'adversaire (hook
    `onStatChangeBlocked`). Le joueur tient le Talisman (`heldItem`) ; le dummy IA est armé de
    Groz'Yeux (`dummyMove: "leer"`). Le joueur passe son tour → le dummy lance Groz'Yeux sur lui →
    « Talisman Sain de <X> s'active ! ». *Les baisses AUTO-infligées (Draco-Météore/Surchauffe Sp.Atk
    -2) ne sont PAS bloquées → couvert unit (`battle/items/clear-amulet.test.ts`).*
- 🤖 **§5.18 nouveaux objets (lot 99→101)** — pilotés de bout en bout (`mechanics-items.spec`) :
  - **Gant de Boxe** (`punching-glove`) — les moves Poing du PORTEUR perdent le contact (réactions de
    la cible nullifiées, comme le Pare-Effet mais restreint aux moves Poing) et frappent ×1,1. Réaction
    nullifiée = SILENCIEUSE → signal = ABSENCE. Le joueur tient le Gant (`heldItem`) + Mach Punch
    (`moves`, Poing, contact, 100 %) sur un dummy au Casque Brut (`dummyHeldItem`) → « Casque Brut …
    s'active » ABSENT ; témoin sans Gant → le Casque Brut s'active. *Le boost ×1,1 et le contact
    conservé sur un move NON-Poing (Charge → Casque Brut s'active) → couverts unit
    (`battle/items/punching-glove.test.ts`).*
  - **Spray Gorge** (`throat-spray`) — après que le PORTEUR utilise un move Son (dégât OU statut), +1
    AtqSpé puis consommation (hook `onAfterMoveUse`, déclenché à l'usage, indépendant du toucher). Le
    joueur tient le Spray (`heldItem`) + Aboiement (`snarl`, Son) → « Spray Gorge de <X> s'active ! ».
    *Le +1 AtqSpé, la consommation (HeldItemConsumed), le déclenchement sur move Son STATUT
    (Rugissement) et l'absence d'effet sur un move NON-Son (Charge) → couverts unit
    (`battle/items/throat-spray.test.ts`).*
- 🤖 **§5.19 Métronome (objet)** (`metronome`) — piloté de bout en bout (`mechanics-items.spec`) :
  +10 % de dégâts par usage CONSÉCUTIF du MÊME move (succès au tour précédent), cumulatif, cap +100 %
  (×2.0 au 10e usage). La montée est SILENCIEUSE (aucune ligne « Métronome … s'active »), donc prouvée
  par les valeurs chiffrées des lignes « perd N PV ». Le joueur Florizarre tient le Métronome
  (`heldItem`) et lance Griffe (`scratch`, Normal, 100 %, portée 1) QUATRE fois d'affilée sur un dummy
  Ronflex (snorlax) endurant (`dummyHp: 999`, espèce distincte du lanceur → ses dégâts sont filtrables
  par nom ; `dummyMove: "leer"` inerte → ne pollue pas le journal). Le dégât de chaque Griffe = la perte
  de PV qui suit immédiatement « Florizarre utilise Griffe ! » (les ticks de poison de terrain au
  libellé identique sont ignorés). Assertions INTRA-run (robustes : la présence de l'objet décale l'état
  du PRNG, donc une égalité chiffrée inter-run serait fragile) : AVEC objet le 4e coup (×1.3) dépasse
  strictement le 1er (×1.0) → l'objet fait monter les dégâts ; SANS objet l'amplitude max−min reste dans
  la bande de variance de jet (≈ ±15 %) → aucune montée. *Le compteur 0..10, le cap +100 % et la remise
  à zéro (move différent OU usage précédent raté/bloqué) sont couverts unit
  (`battle/metronome-streak.test.ts`).*
- 🤖 **§5.20 objets « eject » (lot 102→104)** — téléportation forcée vers la zone de spawn quand le
  porteur encaisse un coup de dégâts (`mechanics-items.spec`). « Zone de spawn » = union des cases de
  spawn de l'équipe (estampillées à la création du combat) ; destination = la case d'origine si sûre,
  sinon la case de spawn d'équipe la plus loin de la menace ; « sûre » = passable, libre, non létale,
  hors hazard. Aucune case sûre (hors case courante) → PAS de téléport et objet NON consommé.
  - 🤖 **Carton Rouge** (`red-card`) — quand le porteur encaisse un coup, c'est l'ATTAQUANT qui est
    renvoyé sur sa propre zone de spawn, puis l'objet du porteur est consommé. Piloté de bout en bout
    côté joueur : le Florizarre démarre sur sa case de spawn (2,4), face nord, et dashe en Vive-Attaque
    (`quick-attack`, Dash 2, 100 %) sur le dummy Ronflex (snorlax, `dummyHp: 999`) porteur du Carton
    Rouge en (2,2) ; le dash l'éloigne de son spawn (atterrissage en (2,3)), puis le coup déclenche
    l'objet et téléporte l'attaquant sur sa case de spawn libérée (2,4). Dash confirmé par la DIRECTION
    (axe nord, cf §5.13) → déterministe. Journal : « Carton Rouge de <X> s'active ! » + « <le
    Florizarre> se téléporte ! » + « <X> a utilisé son Carton Rouge ».
  - 👁 **Bouton Fuite** (`eject-button`) — quand le PORTEUR encaisse un coup (et survit), c'est LUI qui
    est renvoyé sur sa zone de spawn, puis l'objet se consomme. Non automatisable côté joueur : en
    sandbox 1v1 le seul attaquant fiable est le joueur, et le porteur (le dummy) ne peut être frappé
    par le joueur QUE depuis sa case de spawn (il n'a pas bougé) → l'eject ramène alors le porteur sur
    sa propre case (no-op, non journalisé) ; le faire bouger d'abord exigerait de piloter le tour du
    dummy sur plusieurs tours (fragile, sans précédent dans la suite). Couvert unit/integration core
    (`battle/forced-teleport.test.ts`, `battle/items/eject-items.test.ts` — le porteur s'éloigne de
    son spawn, est frappé, se téléporte chez lui et l'objet est consommé).
- 🤖 **§5.14 objets légers content-fill (plan 158)** — pilotés de bout en bout
  (`mechanics-items-content-fill.spec`) :
  - **Carapace Mue** (`shed-shell`) — le porteur est IMMUNISÉ au piège (hook `immuneToTrapping`). Le
    joueur lance Étreinte (`bind`, piège partiel, 85 % → forcé 100 % via Aucun Garde `no-guard`) sur le
    dummy Ronflex porteur (`dummyHeldItem`) adjacent → le statut Piégé est bloqué : « L'objet de Ronflex
    le protège ! » (StatusBlocked reason HeldItem) et AUCUNE ligne « Ronflex est piégé ! ». *Le badge
    « Piégé » sur le sprite est un feedback de scène (anim/icône) → 👁.*
  - **Dé Pipé** (`loaded-dice`) — force un move à frappes variables à son MAXIMUM de coups (hook
    `maximizesMultiHit`, comme Multi-Coups mais via l'objet). Le joueur TIENT le Dé Pipé (`heldItem`) +
    Balle Graine (`bullet-seed`, 2-5, 100 %) sur le dummy endurant (`dummyHp: 999`) → récap « Touché 5
    fois ! », seed-indépendant.
  - 👁 Les 9 autres objets du lot sont SILENCIEUX (Pierrallégée/Poudre Vite = marqueurs poids/vitesse,
    Griffe Rasoir/Poing Chance = crit-stage, Poudre Métal = défense Métamorph, Bande Étreinte/Accro
    Griffe = modulateurs de piège chiffrés, Cape Obscure = anti-secondaire déjà §5.14, Bandeau =
    survie 10 %) et les 2 talents no-op (Fuite/Ramassage) n'émettent aucun signal observable → couverts
    unit (`battle/items/content-fill-158.test.ts`, `effective-weight.test.ts`,
    `effective-base-speed.test.ts`).
- 👁 **Talent** déclenché → « <Talent> de <X> s'active ! » (texte or).
- 👁 **Objet tenu** activé → « <Objet> de <X> s'active ! » (vert) ; **consommé** → « <X> a utilisé
  son <Objet> ».
- 👁 Noms de talents/objets en **FR officiel**.

### 5.15 Ratés / dégâts d'environnement
- 👁 **Raté** → « <X> rate son attaque ! » (gris). **Échec** → « Mais cela échoue ! ».
- 👁 **Chute** (descente > seuil) → `-N` de dégâts de chute (table §5.18).
- 👁 **Impact mur** (dash bloqué par Champ Psychique / bord) → `-N`.
- 👁 **Terrain létal** (lave / eau profonde au sol) → K.O. immédiat + texte.

### 5.16 Patterns de ciblage (un cas par pattern)
- 🤖 Interaction : 10 patterns pilotés (Single/Self/Line/Cône/Zone/Blast/Dash/Cross/Slash/Téléport) — `patterns.spec` ; HitAndRun → `mechanics-movement.spec`. Grille/highlights 👁.
*src : core `enums/targeting-kind.ts`, `data/overrides/tactical.ts` ; preview §4.6, highlights §3.7.
Pour chaque move : sélectionner → highlights rouges + grille tooltip cohérents avec les tiles
réellement touchées à la résolution.*
- 🤖 **Single** (cible unique, portée min-max) — piloté de bout en bout (sélection → ciblage →
  confirmation → résolution + journal) par `driving.spec` (Griffe 1-1). *La grille/highlights de
  chaque pattern = 👁 ; la résolution de chaque pattern = unit core.*
- 👁 **Self** (soi-même) — ex. **Soin** (`recover`).
- 👁 **Line** (ligne droite depuis le lanceur).
- 👁 **Cone** (cône vers l'avant) — ex. **Giclédo** (`water-spout`).
- 👁 **Zone** (zone diamant autour d'une tile, rayon) — ex. **Poudre Dodo** (`sleep-powder`).
- 👁 **Blast** (explosion au sol à distance, rayon) — ex. **Bombe Beurk** (`sludge-bomb`).
- 👁 **Dash** (ruée : se déplace jusqu'à la cible, tiles traversées) — ex. **Bélier** (`take-down`).
  *Depuis chantier g le Dash est ciblé par **direction** : la confirmation directionnelle est pilotée
  en e2e (§5.13, `mechanics-movement.spec`) ; la traînée jaune + glissade = 👁.*
- 👁 **Cross** (croix centrée) — ex. **Éclate-Roc** (`rock-smash`).
- 👁 **Slash** (balayage diagonal/large devant) — ex. **Tranche** (`slash`).
- 👁 **Teleport** (déplacement direct vers une tile) — ex. **Téléport** (`teleport`).
- 👁 **HitAndRun** (frappe puis repli) — ex. **Demi-Tour** (`u-turn`) — cf §5.13.

### 5.17 Hauteur en combat (ligne de vue, portée, dégâts)
*src : core `battle/height-modifier.ts`, `grid/line-of-sight.ts`*
- 👁 **Ligne de vue bloquée** : une tile-obstacle dont la hauteur dépasse `hauteur de référence + 1`
  bloque une attaque qui passe au-dessus (attaquant h0 → cible derrière un obstacle h2 = bloqué).
- 👁 Monter d'un niveau « débloque » la vue (attaquant h1 derrière obstacle h2 = passe).
- 🤖 **Mêlée (portée 1)** : bloquée si l'écart de hauteur ≥ 2 (h1→h3 adjacent = aucune résolution ;
  contrôle à plat Δh=0 = résout) — `height.spec` sur `sandbox-melee-block`. *LoS + modificateur de
  dégâts ±10%/niveau = SENS en unit core (`line-of-sight`, `height-modifier`) ; setup e2e ambigu
  (whiff/targeting), reste 👁.*
- 👁 **Distance (portée ≥ 2)** : jamais bloquée par l'écart de hauteur.
- 👁 **Modificateur de dégâts** : attaquant plus **haut** → +10 %/niveau (cap +50 %) ; plus **bas** →
  −10 %/niveau (cap −30 %).
- 👁 Occlusion visuelle entre niveaux (cf §3.12) + curseur sur sommet composé.

### 5.18 Chute / repoussé (knockback) / terrain létal / glace
*src : core `battle/fall-damage.ts`, `handlers/handle-knockback.ts`*
- 👁 **Table de chute** (% PV max selon niveaux descendus) : 0-1 → 0 % ; 2 → 33 % ; 3 → 66 % ;
  ≥4 → **100 % (K.O. certain)**.
- 🤖 **Repoussé (knockback)** → « <X> est repoussé ! » piloté (Draconnerie — `mechanics-movement.spec`).
  *La chute/glissade qui SUIT le repoussé n'est PAS journalisée (dégâts via HP) → SENS unit core
  (`fall-damage`), rendu 👁.*
- 🤖 **chute mortelle** : repoussé par-dessus une falaise de 4 niveaux → K.O. (sur `sandbox-fall-4` — `mechanics-traversal.spec`). *Les dégâts de chute non-létaux ne sont pas journalisés → 👁.*
- 🤖 **Terrain létal au sol** (lave / eau profonde) → **K.O.** en fin de tour, piloté sur `sandbox-flat`
  (`mechanics-terrain.spec`). *Le « poussé DANS » via knockback reste 👁 (combine knockback + fall).*
- 👁 **Poussé sur la glace** → **glissade** automatique dans la direction du knockback jusqu'à
  non-glace / bord / obstacle / Pokemon ; descente en glissant → dégâts de chute cumulés ;
  collision avec un Pokemon → dégâts aux deux.
- 👁 **Immunité knockback** : si la cible est immunisée au terrain d'arrivée (type/Volant) → non
  déplacée.
- 👁 **Recul (recoil)** (Damoclès `double-edge` 1/3, Bélier `take-down` 1/4) peut **K.O. le
  lanceur** ; cumulable avec une chute (le rammeur en Dash repousse la cible **et** se reçoit le
  recul → double K.O. possible).

### 5.19 Traversée spéciale (Spectre / Volant)
*src : core `battle/height-traversal.ts`, `terrain-effects.ts`*
- 🤖 **Spectre (Ghost)** : traverse un mur d'`obstacle` pour atteindre une **poche fermée** (4,2)
  inaccessible au sol — comparaison des tuiles de déplacement Ectoplasma vs Florizarre sur la map
  fixture `sandbox-ghost-pocket.tmj` (`mechanics-traversal.spec`). *Le « ne peut pas s'arrêter sur
  l'obstacle » = vérifié implicitement (s'arrête sur la poche normale).*
- 🤖 **Volant** immunisé aux effets de terrain : Dracaufeu sur le marais → aucun poison
  (`mechanics-traversal.spec`).
- 👁 **Volant (Flying)** : passe **au-dessus** de tout, **peut se poser** sur un obstacle (perch),
  **immunisé** à toutes les pénalités de terrain (eau/sable/neige/marais/lave/eau profonde/glace),
  **aucun dégât de chute**, **pas de glissade** sur glace.
- 👁 Curseur / picking : le volant posé en hauteur → curseur sur son sommet (cf §3.8/§3.10).

### 5.20 Effets de terrain par type (au sol, hors Volant)
*src : core `battle/terrain-effects.ts`*
- 🤖 Interaction (sur `sandbox-flat`, qui a tous les terrains) : **Magma → brûlé**, **Marais →
  empoisonné** (Pokémon non-Poison), **Lave → K.O.** en fin de tour (`mechanics-terrain.spec`).
  L'immunité de type est respectée (Florizarre Plante/Poison immunisé au marais). *Coût de
  déplacement + bonus ×1.15 + glissade glace restent 👁 (SENS unit core).*
- 👁 **Coût de déplacement** : Eau +1 (sauf Eau), Sable +1 (sauf Sol), Neige +1 (sauf Glace),
  Marais +2 (sauf Poison/Acier).
- 👁 **Statut de fin de tour** : **Marais** → empoisonné ; **Magma** → brûlé (sauf types immunisés).
- 👁 **Dégâts de fin de tour** : **Magma** 1/16 PV ; **Lave** et **Eau profonde** → K.O. instantané
  (sauf Feu/Volant resp. Eau/Volant).
- 👁 **Bonus de puissance** : move du même type que le terrain → ×1.15 (ex. move Feu sur Magma).
- 👁 **Glace** : glissade au knockback (cf §5.18).
- 👁 **Table d'immunités** (aucune pénalité/statut/DOT) : Herbe haute→Volant ; Eau/Eau profonde→Eau,
  Volant ; Magma/Lave→Feu, Volant ; Glace/Neige→Glace/Volant ; Sable→Sol, Volant ;
  Marais→Poison, Acier, Volant.

### 5.21 Distorsion (Trick Room) — zone statique + inversion du Charge Time
*src : core `battle/distortion-system.ts`, `BattleEngine.getCtGainForPokemon` ; rendu zone réutilise
les Champs (indigo). e2e : `mechanics-distortion.spec`.*
- 🤖 Interaction : **Distorsion** (`trick-room`, Self) posée → journal « Distorsion ! » + la **zone
  indigo** est peinte au sol (quads `field_terrain_8019199_*`, ancrée sur le lanceur) —
  `mechanics-distortion.spec`. *La couleur indigo, la pastille compteur et la preview r3 = 👁.*
- 🤖 **Inversion du Charge Time** dans la zone : un lanceur **lent** (Flagadoss, Vit 30) joue **avant**
  un foe **rapide** (Électrode, Vit 150) quand les deux sont dans le diamant — vérifié sur l'ordre
  des portraits de la **timeline** (`predictCtTimeline`), l'opposé de l'ordre hors zone —
  `mechanics-distortion.spec`. *La courbe CT exacte (pivot 160, inversion de la vitesse en entrée) =
  SENS unit core (`distortion-system`).*
- 👁 **Zone diamant Manhattan r3** : preview au cast (sol + grille tooltip) comme les Champs ; re-cast
  même case = remplace/rafraîchit, ailleurs = 2ᵉ zone coexiste (pas de toggle, comportement Champs).
- 👁 **Pastille compteur** in-world au-dessus de l'ancre (5 tours du lanceur, **survit au KO** =
  horloge fantôme) ; **expiration** → la zone disparaît (`DistortionExpired`).
- 👁 **Hors zone** = tempo normal : entrer/sortir de la zone est un choix tactique.

### 5.22 Pièges au sol (entry hazards) — pose à distance + déclenchement à l'entrée
*src : core `battle/entry-hazard-system.ts`, `handlers/handle-post-entry-hazard.ts`,
`handlers/handle-remove-entry-hazards.ts` ; rendu `render-babylon/babylon-entry-hazards.ts` ;
journal `ui-dom/BattleLogFormatter.ts`. e2e : `mechanics-hazards.spec.ts`. Plan 131.*

- 🤖 **Pose** (Picots/Pièges de Roc/Pics Toxik/Toile Gluante) : poseur `GroundTarget` (vise **une**
  case au sol ≤4 Manhattan) → journal « Des **Picots** sont posés au sol » + **mesh peint sur la
  case visée seulement** (`hazard_hazards_spikes_1_x_y`, pas de diamant) — `mechanics-hazards.spec`
  (Picots via Cloyster). *La couleur équipe owner, les pips de couches (Picots ×2/×3, Pics Toxik ×2)
  et l'icône par kind (🔻/🪨/☠️/🕸) restent 👁.*
- 🤖 **Déclenchement à l'entrée** (dégâts cumulatifs par case, Pics Toxik idempotent, Toile Gluante
  Vitesse −1 cumulative, Vol immunisé sauf Pièges de Roc, type Poison absorbe Pics Toxik, KO
  mid-path) — **SENS couvert par les unit/integration du core** (`entry-hazard-system`,
  `resolve-hazard-traversal`). *Non pilotable proprement en e2e : le joueur ne déclenche pas SES
  propres pièges (owner-immunity) et le dummy AI ne se déplace jamais → le déclenchement n'est pas
  reproductible via le harness.*
- 👁 **Journal de déclenchement** : « <X> est blessé par les Picots (N) » (dégât), « <X> est
  empoisonné/gravement empoisonné par les Pics Toxik » (statut), « <X> est ralenti par la Toile
  Gluante (Vitesse −1) » (stat), « <X> absorbe les Pics Toxik » (absorption Poison).
- 👁 **Stacking** : re-poser le même piège sur la même case empile une couche (mesh densifié) ;
  au cap (Picots 3, Pics Toxik 2) la pose est un no-op.
- 👁 **Retrait** : **Tour Rapide** (`rapid-spin`, garde ses dégâts) et **Anti-Brume** (`defog`)
  nettoient les pièges ≤ r2 autour de l'utilisateur → journal « Les pièges au sol sont balayés » +
  meshes disparus.
- 👁 **Permanence** : un piège posé reste jusqu'au retrait (pas de compteur de tours).

### 5.23 Moves à puissance conditionnelle (dynamic power)
*src : core `battle/dynamic-power-system.ts`, `enums/dynamic-power-kind.ts`, `data/overrides/tactical.ts` ;
e2e : `mechanics-dynamic-power.spec.ts`. Plan 134. Ces 3 moves sont **hors-pool** (aucun Pokémon Gen 1
ne les apprend) → forcés via `moves` (SandboxSetup écrase `moveIds`).*

- 🤖 **Branchicrok** (`fishious-rend`, Eau Phys 80) / **Prise de Bec** (`bolt-beak`, Électrik Phys 80) :
  ×2 si la cible n'a pas agi depuis la dernière action du lanceur. Au **tour 1** personne n'a agi → la
  condition ×2 est ACTIVE ; le move (hors-pool) est ciblable, résout via l'orchestrateur et descend les
  PV de la cible (journal « perd N PV ») — `mechanics-dynamic-power.spec`. *La VALEUR exacte du ×2 (et
  le cas SANS ×2, où la cible a déjà agi) = SENS unit core (`dynamic-power-system.test.ts`,
  `moves/{fishious-rend,bolt-beak}.test.ts`) : le toggle de tempo dépend de l'horloge d'actions, non
  rejouable proprement à travers le harness 1v1 (le dummy AI n'agit pas de façon déterministe).*
- 👁 **Hommage Posthume** (`last-respects`, Spectre Phys 50, puissance ×(1 + alliés K.O. du lanceur)) :
  le SCALING n'est **pas observable en e2e** — la sandbox est un **1v1** (le lanceur n'a aucun allié) et
  n'expose ni équipe de 2+ ni amorçage d'allié K.O. via `SandboxConfig`, donc le facteur vaut toujours 1
  (puissance de base). De plus le Dummy est **Normal-type** → un move Spectre fait 0 dégât (pas de ligne
  de journal). Le sens (`faintedAllyCount`/`AllyFaintCountScaled`) reste couvert par les unit/integration
  du core (`dynamic-power-system.test.ts`, `moves/last-respects.test.ts`).

### 5.26 Famille Pièges (trapping)
*src : core `data/overrides/tactical.ts` (`bind`, `fire-spin`, `whirlpool`, `sand-tomb`, `block`,
`mean-look`), `battle/handlers/trapped-tick-handler.ts`, `enums/status-type.ts` ; unit
`battle/moves/{bind,fire-spin,whirlpool,sand-tomb,block,mean-look}.test.ts` ;
e2e : `mechanics-trapping.spec.ts`.* Deux variantes : pièges **PARTIELS** (Étreinte/Danse
Flammes/Siphon/Tourbi-Sable : dégâts + statut Piégé 4-5 tours + chip 1/8 PV par tour + immobilisation)
et pièges **PURS** position-linked (Barrage/Regard Noir : verrou sans dégâts, rompu quand le lanceur
sort de l'adjacence chebyshev). Pilotés via le journal FR (`BattleLogFormatter` : « <X> est piégé ! »,
« <X> perd N PV ! », « <X> est libéré du piège »). Déterministes : le dummy Ronflex (espèce ≠ lanceur →
lignes filtrables par nom) est endurant (`dummyHp: 999`) et inerte (`dummyMove: "leer"`).

- 🤖 **Piège partiel** (`fire-spin`, Danse Flammes, portée 1-2, 85 % → forcé 100 % via Aucun Garde
  `no-guard` sur le lanceur) : le joueur lance Danse Flammes sur le Ronflex adjacent → « Ronflex est
  piégé ! », puis une fin de tour applique le chip → « Ronflex perd N PV ! ». *Étreinte (`bind`,
  contact 1-1), Siphon (`whirlpool`) et Tourbi-Sable (`sand-tomb`) partagent exactement le pattern
  (Damage + Trapped damagePerTurn 0.125) → couverts unit (`moves/{bind,whirlpool,sand-tomb}.test.ts`),
  non dupliqués e2e → 👁. La VALEUR exacte du chip et la durée 4-5 tours = unit
  (`trapped-tick-handler`).*
- 🤖 **Piège pur** (`block`, Barrage, portée 1, position-linked) : le joueur lance Barrage sur le
  Ronflex adjacent → « Ronflex est piégé ! » SANS aucun « perd N PV » (pas de dégâts) ; puis le joueur
  se déplace en (2,5) (distance 3) → le verrou se rompt → « Ronflex est libéré du piège ». *Regard Noir
  (`mean-look`) partage le pattern (Status Trapped positionLinked sans dégâts) → couvert unit
  (`moves/mean-look.test.ts`), non dupliqué e2e → 👁.*
- 👁 **Immobilisation** (la cible piégée ne peut plus se déplacer mais peut toujours attaquer) : l'état
  `getLegalActions` (0 action Move, attaques OK) n'a pas de ligne de journal distincte → couvert unit
  (`moves/{wrap,bind,fire-spin,whirlpool,sand-tomb,block,mean-look}.test.ts`).

### 5.27 Famille Type manip (réécriture de type)
*src : core `data/overrides/tactical.ts` (`conversion`, `conversion-2`, `reflect-type`, `soak`,
`burn-up`), `enums/effect-kind.ts` (SoakType/ConvertType/ConvertResistType/CopyTargetType/RemoveType),
`battle/handlers/handle-type-change.ts` ; journal `ui-dom/BattleLogFormatter.ts` (event TypeChanged) ;
badge volatile `view-core/battle-views.ts` (`typeOverride` → « Type {types} ») ; unit
`battle/moves/{conversion,conversion-2,reflect-type,soak,burn-up}.test.ts` ;
e2e : `mechanics-type-manip.spec.ts`.* Cinq moves réécrivent le type d'un Pokemon : Conversion
(`conversion`, self → type du 1er move), Conversion 2 (`conversion-2`, self → type résistant au dernier
move ennemi), Copie-Type (`reflect-type`, self copie les types de la cible), Détrempage (`soak`, cible
ennemie → Eau pur), Flamme Ultime (`burn-up`, Feu Spé 130, dégâts puis le lanceur perd son type Feu).
Le SENS (efficacité/STAB recalculés, fail wholesale, historique de move) est couvert unit/integration
core ; e2e on prouve la résolution via l'orchestrateur + les feedbacks observables (journal + badge).

- 🤖 **Détrempage** (`soak`, portée 1-1, statut 100 % → cast déterministe, hors-pool forcé via `moves`) :
  le joueur Florizarre lance Détrempage sur le dummy Ronflex (snorlax, Normal pur → changement vers Eau
  sans ambiguïté, espèce ≠ lanceur → nom filtrable) endurant et inerte (`dummyHp: 999`,
  `dummyMove: "leer"`). Deux feedbacks convergent : (1) journal FR « Ronflex devient de type Eau ! »
  (event TypeChanged) ; (2) au survol de la case du dummy, l'InfoPanel monte le badge volatile « Type
  Eau » (`typeOverride` → `infoPanel.volatile.typeChanged`) (`mechanics-type-manip.spec`).
- 👁 **Conversion / Conversion 2 / Copie-Type / Flamme Ultime** : dépendent d'un historique de move
  (Conversion = 1er move du lanceur ; Conversion 2 = dernier move ennemi ; Copie-Type = types de la
  cible) ou d'un type de lanceur précis (Flamme Ultime échoue wholesale si le lanceur n'est pas Feu) →
  setup moins net en sandbox 1v1 (le journal FR « X devient de type … » / « X perd son type Feu ! » /
  « X n'a plus de type ! » et le recalcul d'efficacité/STAB sont identiques) → couverts unit/integration
  core (`moves/{conversion,conversion-2,reflect-type,burn-up}.test.ts`), non dupliqués e2e.

### 5.28 Famille Move-copy (appeler / copier un autre move)
*src : core `data/overrides/tactical.ts` (`metronome`, `sleep-talk`, `mirror-move`, `copycat`, `mimic`,
`sketch`), `enums/effect-kind.ts` (`CopyMoveToSlot`), `battle/move-copy/callable-moves.ts`,
`BattleEngine.prepareCalledMove` (état `pendingCalledMove`, `lastMoveUsedGlobally`) ; events
`battle-event.ts` (`MoveCopied`/`MoveCopyFailed`) ; renderer `view-core/battle-orchestrator.ts`
(InputState `select_attack_target` réutilisé via le swap `pendingCalledMove`, nom masqué `???`) ;
journal `ui-dom/BattleLogFormatter.ts` (MoveCopied « apprend », MoveStarted/révélation « Métronome → X ») ;
unit `battle/moves/{metronome,sleep-talk,mirror-move,copycat,mimic,sketch}.test.ts` ;
e2e : `mechanics-move-copy.spec.ts`.* Six moves exécutent ou apprennent un autre move résolu au runtime :
Métronome (`metronome`, move aléatoire − exclusions, 2-temps nom masqué), Blabla Dodo (`sleep-talk`,
aléatoire du moveset propre, gate sommeil), Mimique (`mirror-move`, dernier move de la cible), Photocopie
(`copycat`, dernier move global), Copie (`mimic`) + Gribouille (`sketch`, remplacent leur slot par le
dernier move de la cible). La résolution pure (tirage seedé, exclusions, verrou anti-reroll, PP du slot
fixé à 5, échecs sans dernier move, anti-récursion) est couverte unit/integration core ; e2e on prouve les
deux signaux observables les plus nets et déterministes.

- 🤖 **Copie** (`mimic`, portée 1-3, `CopyMoveToSlot`, statut 100 % → cast déterministe) : l'IA du dummy
  Ronflex (snorlax, espèce ≠ lanceur → nom filtrable) joue Plaquage (`body-slam`, dans son movepool
  d'espèce → l'IA le trouve dans ses actions légales) au tour 1 ; au tour 2 le joueur Alakazam lance Copie
  sur le dummy adjacent. Deux feedbacks convergent : (1) journal FR « Alakazam apprend Plaquage ! » (event
  MoveCopied) ; (2) après une fin de tour, le sous-menu d'attaque liste « Plaquage » à la place de
  « Copie » (slot muté, jouable au tour suivant) (`mechanics-move-copy.spec`). *Gribouille (`sketch`) ≡
  Copie dans notre contexte (pas de switch ni persistance cross-combat) → couvert unit (`moves/sketch.test.ts`),
  non dupliqué e2e → 👁.*
- 🤖 **Métronome** (`metronome`, callMove RandomAll, 2-temps) : le joueur Alakazam lance Métronome → l'engine
  tire un move (PRNG seedé), le renderer entre en ciblage à nom masqué `???`, le joueur place sur le dummy
  adjacent → le move appelé s'exécute. La réentrance est prouvée par la ligne de révélation du journal
  « Métronome → <move tiré> » (MoveStarted avec `resolvedMoveId` du move appelé). On assert le SENS (un move
  a bien été appelé et démarré), pas l'identité exacte du move tiré (dépend du seed + roster)
  (`mechanics-move-copy.spec`).
- 👁 **Masquage `???`** (nom/type/catégorie/puissance masqués, seul le pattern révélé pour Métronome/Blabla
  Dodo) : la valeur exacte des champs masqués dans le chrome relève du rendu/golden → vérification
  visuelle ; le SENS (`SelectedMoveView.masked`) est couvert unit `view-core`.
- 👁 **Blabla Dodo / Mimique / Photocopie** : Blabla Dodo n'est légal qu'endormi (gate `requiresAsleep`) ;
  Mimique/Photocopie échouent au tour 1 (pas de dernier move) et dépendent d'un historique de move précis →
  setup peu net en sandbox 1v1, mêmes events/lignes de journal que Copie/Métronome → couverts
  unit/integration core (`moves/{sleep-talk,mirror-move,copycat}.test.ts`), non dupliqués e2e.

### 5.29 Famille Field global (Gravité / Vent Arrière / Zone Étrange / Zone Magique)
*src : core `data/overrides/tactical.ts` (`gravity`, `wonder-room`, `magic-room`, `tailwind`),
`enums/field-global-kind.ts`, `battle/field-global-system.ts` + `battle/tailwind-system.ts`,
`handlers/handle-post-field-global.ts` + `handle-set-tailwind.ts` + `field-global-tick-handler.ts` +
`tailwind-tick-handler.ts`, `battle/{accuracy-check,damage-calculator}.ts` (précision ×5/3, swap
Déf/DéfSpé, objet neutralisé via `isHeldItemSuppressed`), `BattleEngine` (grounding + ctGain ×1.5
Vent Arrière + garde `submitAction`/`getLegalActions` moves aériens) ; events `battle-event.ts`
(`FieldGlobalPosted`/`Expired`, `TailwindSet`/`Ended`, `GravityMoveBlocked`) ; rendu zone réutilise
les Champs (une couleur par kind), HUD flèche `ui-dom/tailwind-hud.ts` ; journal
`ui-dom/BattleLogFormatter.ts` ; unit `battle/moves/{gravity,wonder-room,magic-room,tailwind}.test.ts`
+ `field-global-system.test.ts` + `tailwind-system.test.ts` ; e2e :
`mechanics-field-global.spec.ts`. Plan 145.* Quatre effets « pleine arène » du canon relocalisés
positionnellement : 3 zones diamant r3 figées au cast (mirror Distorsion) + 1 vent directionnel
global. La résolution numérique (clouage des Volants + immunité Sol perdue, précision ×5/3, swap
Déf↔DéfSpé bases seules, neutralisation d'objet, ctGain ×1.5 des mons alignés, décompte
caster-only/round-based + horloge fantôme) est couverte unit/integration core ; e2e on prouve le
SENS observable et déterministe.

- 🤖 **Zone posée** (Gravité / Zone Étrange / Zone Magique, `TargetingKind.Self` → cast sur la propre
  case (2,3), statut 100 % → déterministe) : journal FR « <lanceur> déploie <Gravité|Zone Étrange|Zone
  Magique> (5 tours) » (event FieldGlobalPosted) + le **quad de la zone** peint au sol l'épicentre
  (`field_terrain_5996464_2_3` Gravité / `_4175782_` Zone Étrange / `_12605055_` Zone Magique, une
  couleur par kind, ancrée sur le lanceur) — `mechanics-field-global.spec`. *La couleur propre à
  chaque kind, la pastille compteur et la preview diamant r3 = 👁.*
- 🤖 **Vent Arrière levé** (`tailwind`, `GroundTarget` portée 1 → la case cardinale ciblée donne la
  direction ; (2,2) au nord de (2,3)) : journal FR « <lanceur> lève le Vent Arrière vers le Nord (5
  tours) » (event TailwindSet) + le **HUD flèche** top-center (`tailwind-hud`) monte avec le libellé
  « Vent Arrière » — `mechanics-field-global.spec`. *La rotation de la flèche selon la direction et
  l'azimut caméra = 👁 (pixel).*
- 🤖 **Move aérien verrouillé sous Gravité** : un lanceur debout dans une zone Gravité ne peut plus
  lancer un move aérien/saut. Après avoir posé Gravité sur sa case, **Pied Voltige** (`high-jump-kick`,
  `disabledUnderGravity`) est filtré des actions légales → sa ligne du menu Attaque porte
  `data-enabled="false"` bien qu'une cible adjacente existe ; le témoin (Gravité non posée) le montre
  `data-enabled="true"` — `mechanics-field-global.spec`. *Vol/Rebond (détectés via leur état
  semi-invulnérable Flying) suivent la même règle ; Tunnel/Plongée restent jouables — SENS couvert
  unit (`field-global-system.test.ts`, `moves/gravity.test.ts`).*
- 👁 **Gravité — clouage des Volants** : un Pokémon Vol/Lévitation dans la zone perd son immunité Sol
  (touché par les attaques Sol + hazards + knockback) et son sprite passe en pose au sol
  (`setGroundedByGravity`, anim only) → SENS numérique couvert unit (`moves/gravity.test.ts`,
  `damage-calculator`/`entry-hazard-system`), la bascule d'animation = 👁 (pixel/anim).
- 👁 **Gravité — précision ×5/3** contre un défenseur dans la zone : modificateur multiplicatif
  d'`accuracy-check` (non déterministement observable sans gymnastique de seed + témoin) → unit
  (`moves/gravity.test.ts`).
- 👁 **Zone Étrange — swap Déf↔DéfSpé** d'un défenseur dans la zone (bases échangées, crans collés au
  slot) : différence de dégâts numérique (nécessite un témoin + positionnement défenseur dans/hors
  zone) → unit (`moves/wonder-room.test.ts`, `damage-calculator`).
- 👁 **Zone Magique — objet neutralisé** d'un porteur dans la zone (objet inerte mais NON consommé,
  redevient actif hors zone) : effet comportemental/numérique (nécessite un témoin) → unit
  (`moves/magic-room.test.ts`, `isHeldItemSuppressed`).
- 👁 **Vent Arrière — ctGain ×1.5** des mons (les 2 camps) dont l'orientation == direction du vent :
  décalage d'ordre dans la timeline `predictCtTimeline` (nécessite un setup d'alignement d'orientation
  + cumul après Distorsion) → unit (`moves/tailwind.test.ts`, `BattleEngine.getCtGainForPokemon`).
- 👁 **Décompte + expiration** : zones = « tours du lanceur » avec horloge fantôme (survit au KO,
  `FieldGlobalExpired`) ; Vent Arrière = décompte round-global (`TailwindEnded`). Re-cast même
  épicentre+kind = remplace, ailleurs/kind ≠ = coexiste. Non pilotable en e2e court → SENS couvert
  unit (`field-global-system.test.ts`, `tailwind-system.test.ts`).

---

### 5.30 Famille K.O. en un coup (OHKO)
*src : core `data/overrides/tactical.ts` (`guillotine`, `fissure`, `horn-drill`, `sheer-cold` +
`isOhko`/`ohkoIceAccuracyRule`/`ohkoIceImmunity`), `battle/ohko.ts` (`ohkoAccuracy`/`ohkoImmunityReason`),
`handlers/handle-damage.ts` (dégâts = PV max, flag `ohko`, event `OneHitKo`), `BattleEngine` (jet de
précision plat + garde d'immunité), Baie Ceinture / Ténacité (survie à 1 PV via `handle-damage`) ;
events `battle-event.ts` (`OneHitKo`, `DamageDealt.ohko`, `AbilityActivated`) ; journal
`ui-dom/BattleLogFormatter.ts` ; tag tooltip `moveTooltip.tag.ohko` ; unit
`battle/moves/{guillotine,fissure,horn-drill,sheer-cold}.test.ts` + `battle/ohko.test.ts` ; e2e :
`mechanics-ohko.spec.ts`. Plan 148.* Quatre moves qui, **sur touche**, infligent des dégâts égaux aux
PV max de la cible → K.O. instantané, à précision **30 % plate**. En sandbox le hasard vient du seed
moteur → `seed: 0` fait toucher (déterministe, jamais d'override `Math.random`). Les 4 moves partagent
la même mécanique (patterns différents : Abîme Ligne 3 Sol, Guillotine Single 1-1 contact, Empal'Korne
Ligne 2 contact, Glaciation Cône 1-2 Glace) → e2e pilote **Guillotine** comme témoin de la famille ;
les autres patterns/immunités de type sont couverts unit/integration core.

- 🤖 **K.O. direct** (`guillotine`, Single 1-1 contact, hors-pool forcé, `seed: 0` → touche) : le
  joueur lance Guillotine sur le dummy Normal adjacent (2,2) → dégâts = PV max → journal FR « C'est un
  K.O. direct ! » (event OneHitKo) puis fin de combat (seul adversaire → modale de victoire « <X>
  gagne ! ») — `mechanics-ohko.spec`. *Le flottant « K.O.! » (couleur, réutilise `battle.ko`) et le tag
  tooltip ☠ (`moveTooltip.tag.ohko`) restent 👁 (pixel).*
- 🤖 **Immunité Fermeté** (`sturdy`) : le dummy porteur de Fermeté, à pleins PV, encaisse la même
  Guillotine seedée à toucher → laissé à 1 PV → journal FR « Fermeté de <dummy> s'active ! » (event
  AbilityActivated), **PAS** « raté » ni « K.O. direct », et le combat reste ouvert (aucune modale de
  victoire) — `mechanics-ohko.spec`.
- 👁 **Immunités de type** : type Glace immunisé vs Glaciation (`ohkoIceImmunity`), Spectre vs Normal
  (Guillotine/Empal'Korne, contact Normal), Vol vs Abîme (Sol) — le coup « ne peut toucher » sans jet →
  SENS couvert unit (`battle/ohko.test.ts`, `moves/{guillotine,fissure,horn-drill,sheer-cold}.test.ts`).
- 👁 **Survie à 1 PV** : Baie Ceinture (`focus-sash`) / Ténacité (`focus-band`) laissent la cible à 1 PV
  au lieu du K.O. (pas d'event OneHitKo, messages de survie normaux) → SENS couvert unit
  (`handle-damage`). *Non dupliqué e2e (déjà pilotable via les specs d'objets).*
- 👁 **Protection** (`protect`/`detect`) bloque l'OHKO comme tout coup → couvert §5.5 / unit.
- 👁 **Règle de précision Glace** : Glaciation gagne en précision quand le lanceur est de type Glace
  (`ohkoIceAccuracyRule`) — modificateur non déterministement observable sans gymnastique de seed →
  unit (`battle/ohko.test.ts`).

### 5.31 Famille Priorité / timing conditionnel
*src : core `data/overrides/tactical.ts` (`fake-out`, `first-impression`, `sucker-punch`, `focus-punch`,
`beak-blast`, `shell-trap` + `firstActionOnly` / `failsUnlessTargetAggressive` / `chargeReaction`),
`battle/charge-reaction.ts` (hook `handle-damage` : focus/beak/shell), `BattleEngine` (gates
`getLegalActions`/`submitAction`, fraîcheur `lastOffensiveActionAtAction`, gate T2 de charge),
`PokemonInstance` (`focusInterrupted`/`shellTrapArmed`/`lastOffensiveActionAtAction`) ; events
`battle-event.ts` (`FocusInterrupted`, `BeakBlastBurn`, `ShellTrapArmed`, `MoveFailed.reason`) ; journal
`ui-dom/BattleLogFormatter.ts` ; tags tooltip `moveTooltip.tag.{firstActionOnly,chargeReaction*}` ; unit
`battle/moves/{fake-out,first-impression,sucker-punch,focus-punch,beak-blast,shell-trap}.test.ts` +
`battle/charge-reaction.test.ts` + `battle/priority-timing.integration.test.ts` ; e2e :
`mechanics-priority-timing.spec.ts`. Plan 150.* Six moves dont l'identité repose sur le **timing** (1ʳᵉ
action du combat, fraîcheur de la dernière action de la cible, charge interruptible), pas sur une
priorité canon (inexistante : le CT ordonne). En sandbox le joueur part des spawns par défaut et
**s'approche** en (1,1) avant de lancer (les Single 1-1 sont omnidirectionnelles) ; une action ne
termine pas le tour → `endTurn()` explicite entre les tours ; les cibles pilotées (Coup Bas réussite,
interruptions/ripostes de charge) sont en **hot-seat** (`dummyControl: "player"` + Charge/`tackle`).
Déterministe (seed moteur, moves 100 % précision, jamais d'override `Math.random`).

- 🤖 **Bluff frappe + apeure** (`fake-out`, firstActionOnly + Flinch 100 %) : à la 1ʳᵉ action → dégâts,
  puis le dummy apeuré passe son tour → « … est apeuré et ne peut pas agir ! » (Flinched) —
  `mechanics-priority-timing.spec`.
- 🤖 **Bluff filtré au 2e tour** : une fois le tour 1 fini, Bluff reste affiché au menu d'attaque mais
  `data-enabled="false"` (déjà agi), Griffe `data-enabled="true"` — `mechanics-priority-timing.spec`.
- 🤖 **Escarmouche** (`first-impression`, firstActionOnly sans flinch) : ouverture puissante (dégâts,
  pas d'apeurement) puis `data-enabled="false"` au menu du tour 2 — `mechanics-priority-timing.spec`.
- 🤖 **Coup Bas touche** (`sucker-punch`) : le dummy (hot-seat) attaque d'abord avec Charge → sa
  dernière action est offensive → Coup Bas touche (« Ronflex perd N PV »), aucun échec —
  `mechanics-priority-timing.spec`.
- 🤖 **Coup Bas échoue** : le dummy n'a pas (encore) attaqué → fizzle « Mais cela échoue … ! » (0 dégât)
  — `mechanics-priority-timing.spec`.
- 🤖 **Mitra-Poing charge** (`focus-punch`) : tour 1 → « … concentre son énergie pour Mitra-Poing ! »
  (MoveCharging) — `mechanics-priority-timing.spec`. *L'indicateur ⚡ reste 👁 (§5.11).*
- 🤖 **Mitra-Poing interrompu** : frappé pendant la charge → « … est frappé pendant sa concentration ! »
  (FocusInterrupted), puis la frappe T2 échoue → « … perd sa concentration ! » (MoveFailed reason focus).
  Lanceur rapide (Alakazam) pour n'intercaler qu'UN tour adverse (lien interruption→échec le plus net) —
  `mechanics-priority-timing.spec`.
- 🤖 **Bec-Canon brûlure de contact** (`beak-blast`, **0 learner Gen 1** → injouable en team builder,
  piloté en mode sandbox) : frappé au CONTACT pendant la charge → l'attaquant se brûle « Ronflex se
  brûle sur le bec brûlant ! » (BeakBlastBurn) — `mechanics-priority-timing.spec`.
- 🤖 **Carapiège armé** (`shell-trap`, **0 learner Gen 1** → piloté en mode sandbox) : frappé par un
  move PHYSIQUE pendant la charge → « Le piège de Dracaufeu s'arme ! » (ShellTrapArmed) —
  `mechanics-priority-timing.spec`.
- 👁 **Coup Bas — fraîcheur fine** (la cible a attaqué PUIS temporisé → échoue) : anti-collant
  `lastUsedMoveId`, couvert unit (`sucker-punch.test`, `priority-timing.integration`).
- 👁 **Mitra-Poing frappe si laissé tranquille** / **un dégât INDIRECT (poison) ne casse pas la
  concentration** : unit (`focus-punch.test`, `charge-reaction.test`).
- 👁 **Bec-Canon frappe quand même au tour 2** ; attaquant NON-contact ou cible Feu **non brûlés** ;
  **Carapiège échoue si non armé** (pas frappé / frappé spécialement) : unit
  (`beak-blast.test`, `shell-trap.test`, `charge-reaction.test`).
- 👁 **Tags tooltip** (`⏱ 1er tour seulement`, `🎯 Échoue si la cible n'attaque pas`, `⏱ 2 tours · …`) +
  flottant/indicateur ⚡ de charge = pixel/unit.

---

### 5.32 Famille manipulation de coups critiques (Misc Batch A)
*src : core `data/overrides/tactical.ts` (`focus-energy`, `laser-focus`, `dragon-cheer`, `storm-throw`,
`darkest-lariat` + `RaiseCritStage` / `ArmGuaranteedCrit` / `alwaysCrit` / `ignoresDefensiveStages`),
`battle/handlers/{handle-raise-crit-stage,handle-arm-guaranteed-crit}.ts`, `battle/damage-calculator.ts`
(bloc crit : crit forcé + crans défensifs ignorés), `BattleEngine` (consommation Affilage post-move,
cleanup KO) ; `PokemonInstance` (`critStageBoost`/`guaranteedCritArmed`) ; events `battle-event.ts`
(`CritStageRaised`, `GuaranteedCritArmed`, `CriticalHit`) ; journal `ui-dom/BattleLogFormatter.ts` ;
badges `view-core/battle-views.ts` (`infoPanel.volatile.{focusEnergy,laserFocus}`) ; tags tooltip
`moveTooltip.tag.{focusEnergy,laserFocus,alwaysCrit}` ; unit `battle/moves/{focus-energy,laser-focus,
dragon-cheer,storm-throw,darkest-lariat}.test.ts` + `battle/crit-manip.integration.test.ts` ; e2e :
`mechanics-crit.spec.ts`. Plan 151.* Cinq moves dont l'identité repose sur les **critiques**. Duel
adjacent standard (Florizarre (2,3) / dummy Normal inerte (2,2)) ; moves 100 % précision → cast
déterministe (seed hérité, aucun override `Math.random`).

- 🤖 **Puissance** (`focus-energy`, Self) : sur sa propre case → journal « … est plus enclin aux coups
  critiques ! » (CritStageRaised) + badge volatile « Puissance +2 » de l'InfoPanel au survol du lanceur
  (`critStageBoost > 0`) — `mechanics-crit.spec`.
- 🤖 **Affilage** (`laser-focus`, Self, **0 learner Gen 1** → piloté en sandbox) : arme le prochain crit
  → journal « … se concentre : son prochain coup sera critique ! » (GuaranteedCritArmed) + badge volatile
  « Affilage » (`guaranteedCritArmed`) — `mechanics-crit.spec`.
- 🤖 **Affilage — coup suivant forcé critique** : armé au tour 1, tour terminé (dummy inerte temporise),
  puis Griffe au tour 2 sur le dummy → « Coup critique sur … ! » (CriticalHit) — `mechanics-crit.spec`.
- 🤖 **Yama Arashi** (`storm-throw`, Combat Phys contact, `alwaysCrit`, **0 learner Gen 1** → sandbox) :
  chaque coup est un critique garanti indépendamment du seed → « Coup critique sur … ! » —
  `mechanics-crit.spec`.
- 👁 **Cri Draconique** (`dragon-cheer`, allié r1, +1 crans, +2 si l'allié est Dragon) : exige un allié
  **JOUEUR**, non supporté par le harness sandbox (joueur + dummy uniquement) → non pilotable e2e ;
  couvert unit (`dragon-cheer.test`, bonus Dragon).
- 👁 **Dark Lariat** (`darkest-lariat`, ignore les crans Déf/Déf.Spé de la cible dans les deux sens) :
  pas de feedback observable propre (annulation d'un cran défensif invisible au journal) ; couvert
  unit/integration (`darkest-lariat.test`, `crit-manip.integration`).
- 👁 **Empilement Puissance→garanti / cleanup KO / Affilage one-shot consommé / `preventsCrit` annule
  `alwaysCrit`** : lifecycle multi-tours = unit/integration (`crit-manip.integration.test`,
  `storm-throw.test`). Flottant « Coup critique ! » (couleur) + tags tooltip ☆/⚔ = pixel → 👁.

### 5.33 Famille dégâts utilitaires (Misc Batch B)
*src : core `data/overrides/tactical.ts` (`false-swipe`+`cannotKo`, `super-fang`+`HalveTargetHp`,
`feint`+`bypassProtect`, `smack-down`+`SmackDown`, `pursuit`+`pursuitBackstab`, `vital-throw`+
`bypassAccuracy`), `battle/handlers/{handle-damage(cap cannotKo),handle-super-fang,handle-smack-down}.ts`,
`battle/field-global-system.ts` (`isEffectivelyGrounded`), `BattleEngine` (facing ×2 Poursuite,
hazards/tick du cloué, cleanup KO `smackedDown`) ; `PokemonInstance.smackedDown` ; events
`battle-event.ts` (`SuperFangApplied`, `SmackedDown`) ; journal `ui-dom/BattleLogFormatter.ts` ;
flottant `view-core/floating-text-content.ts` (`SuperFangApplied` → `-N`) ; badge
`view-core/battle-views.ts` (`infoPanel.volatile.smackedDown` → « Au sol ») ; unit
`battle/moves/{false-swipe,super-fang,feint,smack-down,pursuit,vital-throw}.test.ts` +
`battle/utility-damage.integration.test.ts` ; e2e : `mechanics-utility-damage.spec.ts`. Plan 152.*
Six moves dont l'identité est un **calcul de dégâts** particulier (plafonné, fixe, conditionnel au
positionnement). Duel adjacent (joueur (2,3) / dummy (2,2)) ; moves à 100 % précision hors Croc Fatal
(90 % → `seed: 1` fait toucher) → cast déterministe (seed moteur, aucun override `Math.random`).

- 🤖 **Faux-Chage** (`false-swipe`, `cannotKo`) : sur un dummy à quelques PV, le coup inflige des
  dégâts mais NE met jamais K.O. — la cible reste à EXACTEMENT 1 PV (survol → InfoPanel « 1 / max »),
  aucune modale de victoire — `mechanics-utility-damage.spec`.
- 🤖 **Croc Fatal** (`super-fang`, `HalveTargetHp`) : inflige ⌊PV actuels / 2⌋ → journal « … perd la
  moitié de ses PV (-N) ! » (SuperFangApplied) + flottant `-N` (mesh `hud_text_plane`) —
  `mechanics-utility-damage.spec`.
- 🤖 **Ruse** (`feint`, `bypassProtect`) : le dummy (plus rapide) se protège (Abri) en 1er, puis Ruse
  TOUCHE à travers la protection active (journal dégâts, aucun blocage) — `mechanics-utility-damage.spec`.
- 🤖 **Anti-Air — grounding** (`smack-down`) : cloue le Dracolosse (Vol) au sol → journal « … est
  cloué au sol ! » (SmackedDown) + badge InfoPanel « Au sol » — `mechanics-utility-damage.spec`.
- 🤖 **Anti-Air — immunité Sol levée** : contrôle négatif (Coud'Boue Sol sur Vol NON cloué → zéro
  dégât, immunité de type SILENCIEUSE au journal) vs cas cloué (Coud'Boue ajoute une ligne de dégâts
  sur le Vol cloué) — `mechanics-utility-damage.spec`.
- 🤖 **Poursuite** (`pursuit`, `pursuitBackstab`) : ×2 dans le dos. Deux boots identiques au seed près
  de l'orientation du dummy → les dégâts de dos (×2,3) dominent nettement ceux de face (×0,85) —
  `mechanics-utility-damage.spec`.
- 🤖 **Corps Perdu** (`vital-throw`, `bypassAccuracy`) : ne rate jamais — touche une cible à Esquive
  max (+6) sans jamais « rate son attaque ! ». Le contrôle négatif (un coup normal PEUT rater cette
  cible) reste unit/integration — `mechanics-utility-damage.spec`.
- 👁 **Faux-Chage vs Substitut cassable / Croc Fatal ignore le typechart (touche un Spectre) & K.O.
  possible à 1-2 PV / Poursuite ×0,85 face + ×1,0 flanc exacts / grounding : perte immunité +
  vulnérabilité hazards + atterrissage forcé d'un Vol en cours / cleanup KO `smackedDown`** :
  lifecycle & valeurs fines = unit/integration (`utility-damage.integration.test`, `*.test.ts` par
  move). Flottants (couleur) + tags tooltip = pixel → 👁.

---

### 5.34 Famille Transform (Morphing / Imposteur / Métamorph)
*src : core `data/overrides/tactical.ts` (`transform` : Single r3, `EffectKind.Transform`),
`battle/handlers/transform/{apply-transform,handle-transform}.ts` ; helpers effective
(`effective-combat-stats.ts`, `effective-move-ids.ts`, `effective-weight.ts`, `effective-gender.ts`
+ extensions `effective-ability.ts`/`effective-flying.ts`/`effective-base-speed.ts`) ;
`PokemonInstance.transformState` ; event `battle-event.ts` (`Transformed`) + cleanup KO
`BattleEngine.ts` ; talent `data/abilities/ability-definitions.ts` (`imposter`, `onBattleStart`) ;
roster `data/playable/playable-pokemon.ts` (custom `ditto`) ; journal `ui-dom/BattleLogFormatter.ts`
(« … se transforme ! ») ; port `render-ports/ports.ts` (`setSpecies`) +
`render-babylon/directional-billboard.ts` + `view-core/battle-orchestrator.ts` (`Transformed` →
`board.setSpecies` + `syncBoard`) ; unit `battle/moves/transform.test.ts`,
`battle/handlers/transform/transform.test.ts` + `battle/transform.integration.test.ts` ; e2e :
`mechanics-transform.spec.ts`. Plan 157.*
Le lanceur devient une **copie** de la cible (stats de combat, crans, types, 4 moves, talent, poids,
genre, sprite) mais **garde son niveau et ses PV** (#649). Morphing est un move statut (Single r3,
aucun jet de précision) → cast déterministe (seed moteur, aucun override `Math.random`). Le dummy
Léviator est inerte (`dummyMove: "leer"` hors de son movepool → l'IA termine son tour sans agir,
tandis que ses 4 slots restent intacts pour la copie).

- 🤖 **Morphing — journal** : Mew lance Morphing sur le Léviator adjacent → « Mew se transforme ! »
  (event Transformed) — `mechanics-transform.spec`.
- 🤖 **Morphing — moves copiés** : après le morph, le menu d'attaque liste les moves de Léviator
  (« Cascade ») et plus « Morphing » — tout le moveset est remplacé (`effectiveMoveIds`) —
  `mechanics-transform.spec`.
- 🤖 **Morphing — identité/PV du lanceur préservés** : l'InfoPanel garde le nom « Mew » et une barre
  de PV inchangée après le morph (nom + portrait dérivent du `definitionId` de base, PV non copiés) —
  `mechanics-transform.spec`.
- 🤖 **Morphing — héritage terrain (#659)** : un Mew (Psychic, au sol) morphé en Léviator (Eau/Vol) sur
  le marais LÉVITE → aucun poison de terrain en fin de tour (ligne « marécage » absente). Témoin : un
  Mew non transformé sur le marais EST empoisonné → prouve que l'immunité vient du type Vol copié —
  `mechanics-transform.spec`.
- 🤖 **Imposteur — morph à l'entrée** : Métamorph (ditto, talent `imposter`) se transforme
  automatiquement sur l'ennemi le plus proche dès le boot → « … se transforme ! » sans action, et le
  menu du tour 1 liste déjà les moves de Léviator (« Cascade », plus « Morphing ») —
  `mechanics-transform.spec`.
- 👁 **Swap d'atlas (sprite)** : le sprite affiché devient celui de la cible (Léviator) — fait de
  TEXTURE que le hook scène n'expose pas (`meshInfo` ne rend que position/visibilité/groupe, jamais
  l'atlas lié ; le billboard garde le nom `pokemon_plane`). Interaction Substitut ↔ espèce morphée
  (restaurer l'atlas morphé au break, pas l'atlas d'origine) = visuel pur → 👁, jamais forcé en golden.
- 👁 **Nom d'affichage de Métamorph** : `ditto` n'est pas dans les tables i18n → le nom rendu retombe
  sur l'id `ditto` au lieu du custom « Métamorph » (assertion e2e Imposteur volontairement
  name-agnostic sur « se transforme »). Écart cosmétique à corriger côté data (hors périmètre e2e).
- 👁 **Copie fine (stats/crans/base-speed → tempo CT, poids, genre), gates d'échec (Substitut /
  lanceur ou cible déjà transformé / cible Imposteur), snapshot des crans, cleanup KO, garde-fou IA
  `scoreTransformApplication`, interactions « manip écrase » (Détrempage/Échange/Permuvitesse après
  morph)** : valeurs & lifecycle = unit/integration core (`transform.integration.test`, `moves/
  transform.test.ts`, `handlers/transform/transform.test.ts`) → 👁.

### 5.35 Heuristiques de scoring IA (Phase 1→3, plans 159 / 160 / 161)
*src : core `ai/action-scorer.ts` (scorer pur) + `ai/scored-ai.ts` (`AiTeamController`) ;
unit : `ai/action-scorer.test.ts`, `ai/scored-ai.test.ts`, `ai/scored-ai-smoke.test.ts`.*
Toutes les heuristiques de scoring sont **couvertes en unit** (fonction pure `scoreAction` — dégâts,
efficacité de type, valorisation des buffs/debuffs, Buée Noire, Recyclage, Attraction, Cognobidon,
épinglage de menace, etc. ; plan 161 : +7 tests dans le describe « Phase 3 heuristics »).
- 👁 **e2e des heuristiques IA — BLOQUÉ (reporté), prérequis feature `dummyControl: "scored"`.**
  Le harness sandbox (`bootSandbox` / `SandboxConfig`) n'expose que deux modes de contrôle de la
  cible : `dummyControl: "ai"` câble `DummyAiController` (un unique move défensif scripté + face à une
  direction fixe — **il n'appelle JAMAIS `scoreAction`**) et `dummyControl: "player"` (hot-seat
  humain). Le **vrai scorer** (`AiTeamController`) n'est branché que par `wireScoredAi` sur le chemin
  team-select (`startBattleLoop`), avec équipes construites par le team-builder et un PRNG
  `createPrng(Date.now())` **non seedé** — donc **ni pilotable par URL de config, ni déterministe**.
  Aucune assertion e2e déterministe d'une décision IA n'est possible aujourd'hui sans changement de
  harness. **Prérequis** : ajouter à `SandboxConfig` un mode `dummyControl: "scored"` qui câble
  `AiTeamController` sur la Player2 sandbox, alimenté par `config.seed` (`createPrng(seed)`), de sorte
  qu'un état seedé + un roster fixé rendent le choix de move déterministe et assertable au journal
  (« l'adversaire utilise X »). Tant que ce mode n'existe pas, le sens reste **couvert unit** et l'e2e
  est reporté (cf. `docs/next.md`). *Ne pas écrire de spec IA non-déterministe / factice.*

---

## 6. Recette — écrans DOM (hors combat)
*src : `app/ui/dom/screens/`, `app/app/screen-manager.ts`, `app/ui/SplashScreen.ts`*
*e2e : `tests/smoke/boot.spec.ts`, `tests/smoke/splash.spec.ts`, `tests/dom/navigation.spec.ts`,
`tests/dom/menus.spec.ts`,
`tests/visual/screens.spec.ts` (golden)*

### 6.0 Navigation globale
- 🤖 **Splash de boot** (plan 135) : au démarrage, l'overlay plein écran (`data-testid="splash"`,
  titre « Pokémon Tactics » + barre de progression `role="progressbar"`) télécharge le bundle de
  sprites AVANT tout écran, puis se retire du DOM et le menu monte (`splash.spec`). *Le fade
  d'entrée/sortie = 👁 (pixel/anim).*
- 🤖 Boot → le menu principal s'affiche (`boot.spec`).
- 👁 Transition **instantanée** (dispose → mount, pas d'animation).
- 🤖 `Échap` = retour (sauf menu principal) ; clavier focalise les boutons.
- 👁 Options désactivées **grisées** (Aventure, En ligne, Tutoriel).

### 6.1 Menu principal
*libellés : `menu.*` ; lang `pt-lang` ; version `__APP_VERSION__`*
- 🤖 Le **titre** « POKEMON TACTICS » s'affiche (heading h1).
- 🤖 **5 entrées** dans l'ordre, libellés FR : **Aventure**, **Combat**, **Constructeur d'équipe**,
  **Paramètres**, **Crédits**.
- 🤖 **Aventure** est **désactivée** (`disabled`).
- 🤖 **Numéro de version** visible en bas à gauche (`.mn-version`).
- 🤖 Clic sur le bouton de langue (bas-droite, « FR » → « EN ») : les 5 entrées passent en anglais
  (Adventure / Battle / Team Builder / Settings / Credits) ; choix persisté en `localStorage`
  (`pt-lang`).
- 👁 Re-render propre au switch (pas de doublon, mise en page intacte).

### 6.2 Mode de combat
- 🤖 Local (actif) → écran « Choix de la carte » ; Retour → menu (`navigation.spec`).
- 🤖 En ligne / Tutoriel **désactivés** (`screens.spec`).
- 👁 i18n FR/EN des libellés.

### 6.3 Choix de la carte (map preview)
- 🤖 Carte 0 présélectionnée ; « Choisir cette carte » → Sélection d'équipe (`normal-game.spec`).
- 🤖 « Retour » → Mode de combat (`screens.spec`).
- 🤖 Liste de **9 cartes** ; nom + méta + **description** renseignés ; **sélectionner une autre
  carte met à jour le détail** (`screens.spec`). *L'aperçu Babylon live = 👁.*
- 👁 **Déplacer** la map (pan) et **tourner** la caméra dans l'aperçu.
- 🤖 `↑/↓` navigue la liste (sélection surlignée, `aria-current`).

### 6.4 Sélection d'équipe (team select)
- 🤖 Joueur 1 (Humain) → IA lui assigne une équipe aléatoire ; J2 (IA) en a déjà une → combat
  lançable → scène montée (`normal-game.spec`).
- 🤖 « Lancer ▶ » **désactivé tant que les slots ne sont pas tous assignés** ; bascule Humain→IA
  l'active (`screens.spec`).
- 👁 Format (dropdown) → nb de slots ; chaque slot toggle **Humain/IA**, couleur joueur.
- 👁 Liste des équipes + « 🎲 Aléatoire » ; « 🎲 Remplir IA » ; toggle Placement auto.
  *Plus de sélecteur de système de tours (Charge Time seul).*
- 👁 i18n FR/EN.

### 6.5 Mes équipes (liste — constructeur d'équipe) → détails picker §7.2
*libellés : `teamBuilder.*`*
- 🤖 « + Nouvelle équipe » et « Générer aléatoire » présents ; accès depuis le menu.
- 👁 Liste **triée par récent** ; carte = portraits + nom + date.
- 👁 Actions par carte : **Éditer**, **Exporter**, **Supprimer** (modale de confirmation
  « Supprimer l'équipe » / Annuler / Supprimer).
- 👁 **Générer aléatoire** → nouvelle équipe persistée.
- 🤖 État vide → « Aucune équipe pour l'instant » + indice.
- 🤖 **Persistance localStorage** (`pokemon-tactics:teams`) : créer / supprimer / renommer se
  reflète (assertion via `localStorage`).
- 👁 i18n FR/EN.

### 6.6 Édition d'équipe (Team Builder) → §7.1, picker → §7.2

### 6.7 Paramètres
*libellés : `settings.*` ; storage `pt-lang`, `pt-settings`*
- 🤖 Accès depuis le menu ; titre « Paramètres » ; Retour → menu.
- 🤖 **2 entrées** : **Langue** (FR/EN), **Prévisualisation dégâts** (Oui/Non). Valider chaque
  libellé en FR **et** EN. *(L'option « Curseur » a été retirée : le curseur de survol est désormais
  un modèle voxel unique non configurable — cf §3.8.)*
- 🤖 Changer une option **persiste en localStorage** : langue → `pt-lang` ; prévisualisation →
  `pt-settings` (JSON).

### 6.8 Crédits
*libellés : `credits.*`*
- 🤖 Clic « Crédits » → écran crédits ; titre « Crédits » ; Retour → menu (`menus.spec`).
- 🤖 Contenu présent (disclaimer fan-project, sprites PMDCollab, tileset, police, code).
- 🤖 Valider le titre/contenu en **anglais** (« Credits ») après switch de langue.

---

## 7. Recette — Team Builder & Sandbox

### 7.1 Édition d'équipe (slots)
*src : `app/ui/team/TeamEditView.ts`, `SlotCardsRow.ts`, core `team/team-validator.ts`*

- 🤖 **6 slots** (niveau 50), compteur « N/6 Pokémon », nom d'équipe éditable + indicateur
  « Sauvegardé » qui flashe.
- 🤖 Par slot : Pokemon (picker §7.2), talent, objet, nature, 4 moves (pickers), stats + points de
  stat + presets — **tout en FR**.
- 👁 Slot vide = « Slot N » avec « + » ; slot rempli = portrait + nom FR + badges de type.
- 🤖 Bouton « Vider ce slot » (croix) sur un slot rempli.
- 👁 « **Tout vider** » → **modale de confirmation** « Vider l'équipe » puis vide les slots.
  ⚠️ **RÉGRESSION de migration** : la modale avait été perdue (`clearAll()` vide direct, clés i18n
  `clearAllConfirm*` orphelines) → **backlog**. Test e2e prêt mais **skippé** jusqu'au fix.
- 🤖 **Renommer** l'équipe (input) → persiste en localStorage (`pokemon-tactics:teams`)
  (`team-builder.spec`).
- 👁 **Validation** (au lancement) : équipe vide, > 6, doublon espèce/objet/move, move/talent/
  nature/genre illégal, EV invalides → message d'erreur clair.
- 👁 Export/Import Showdown.
- 👁 Responsive / 4K (overlay scale).

### 7.2 Pokemon Picker (modale)
*src : `app/ui/team/PokemonPickerModal.ts` (`<dialog>`), recherche `pokemon-search`*

- 🤖 Clic sur un **slot vide** → la modale picker s'ouvre (`<dialog>`, titre « Choisir un
  Pokémon ») — `picker.spec`.
- 🤖 **Liste non filtrée** de tous les Pokemon jouables (portrait + nom FR) — `picker.spec`.
  *Le portrait du picker est un `background-image` croppé du bundle (plan 135) via le même seam
  `getPortraitUrl` que l'InfoPanel (couvert 🤖 en §4.7) — la cellule n'a pas de testid propre, donc
  le visuel du portrait dans le picker reste 👁.*
- 🤖 Recherche « **flo** » → filtre vers **Florizarre** (nom FR localisé, **monolingue**) —
  `picker.spec`. *Bilingue souhaité plus tard → `docs/next.md` (cible : move picker).*
- 🤖 Filtre **type Plante** → n'affiche que des Pokemon Plante ; **2e type** → **union** ;
  **re-cliquer** → désactive ; « **Reset** » → vide les filtres — `picker.spec`.
- 🤖 **Choisir** un Pokemon → l'assigne au slot, ferme la modale — `picker.spec`.
- 🤖 Rouvrir sur un **autre slot** → le Pokemon déjà choisi est **grisé**
  (`data-state="disabled"`) — `picker.spec`.
- 🤖 Fermer via la **croix** (« Fermer ») — `picker.spec`. *Échap (`<dialog>`) = 👁.*

### 7.3 Fiche d'un Pokemon (panneau d'édition)
*src : `app/ui/team/EditLeftPanel.ts`, `EditRightPanel.ts`*

- 🤖 En-tête : nom FR (Florizarre), toggle genre (♂/♀), bouton **Build** (`pokemon-edit.spec`).
  *Portrait/badges de type = 👁.*
- 🤖 Sections **Talent / Objet / Nature** présentes (`pokemon-edit.spec`). *Le contenu des pickers
  (radios talent, 4 move-pickers) = 👁.*
- 🤖 **Picker d'objet** (modale « Choisir un objet ») : un objet **boost-de-type** (ex. **Charbon**,
  Feu ×1.2) y est listé, non grisé (implémenté) et **sélectionnable** → le champ « Objet » du slot
  affiche son nom FR (`pokemon-edit.spec`, lignes `item-picker-row` par `data-item-id`).
  *Le **gain numérique** ×1.2 en combat reste 👁 (couvert en unit `type-boost-items.test.ts` ;
  l'effet de dégâts n'est pas un signal DOM/journal déterministe exploitable en e2e).*
- 🤖 Stats en **barres** (≥ 6 lignes) + **Presets** présents (`pokemon-edit.spec`). *Sliders de
  points de stat + total ≤ max = 👁.*
- 🤖 **4 capacités** listées (`.tb-move-row` ×4 — `pokemon-edit.spec`). *« Build » qui applique un
  set OP = 👁.*

### 7.4 Sandbox Studio
*src : `app/babylon/combat-screen.ts` (mountSandboxStudio), `app/ui/SandboxPanel.ts`,
`app/sandbox-boot.ts`*

- 🤖 `pnpm dev:sandbox '{…}'` / URL `?config=` → combat direct piloté par le **JSON** (Pokemon,
  moves, stats, statut, météo, positions) — **chemin de boot de tous les tests combat e2e**
  (fixture `bootSandbox` + `sandbox-configs.ts`). *Le panel Sandbox Studio (UI) reste 👁.*
- 👁 Panel : colonnes joueur/dummy, contrôle dummy **IA** (move défensif) vs **Joueur** (4 moves),
  steppers de stats, HP %, statut/volatile, map, météo.
- 👁 Boutons : Réinitialiser, Exporter JSON (presse-papier), Importer JSON, Rejouer.
- 👁 « Retour au menu » : teardown propre (pas de fuite DOM/canvas).

---

## 8. Recette — maps / terrain / placement
*src : `data/tiled/`, `render-babylon/` (terrain, tileset), core `battle/PlacementPhase*`,
`app/babylon/placement-flow.ts`*

### 8.1 Types de terrain
- 🤖 Les 9 cartes du jeu montent leur scène Babylon avec des tuiles (no crash) — `maps.spec`. Couleurs/tileset/eau profonde 👁.
- 👁 Rendu et couleur distincts : normal (vert), herbe haute, eau (turquoise) vs **eau profonde**
  (bleu foncé, infranchissable au sol), sable, glace, neige, marais, magma (marchable) vs
  **lave** (impassable, létale), obstacle (impassable).
- 👁 Volants traversent eau profonde / lave ; au sol non.

### 8.2 Tileset
- 👁 Tiles correctes (aucune tile **rose/manquante**), orientation iso (diamant), flip horizontal
  (escaliers/rampes E).

### 8.3 Hauteur / layers
- 🤖 « Le Mur » : tuiles à plusieurs élévations distinctes (multi-niveaux) — `maps.spec`. Rendu falaises/occlusion 👁.
- 👁 Falaises/plateaux rendus, occlusion entre niveaux (§3.12), **pas de pente N/O** (contrainte iso).
- 👁 Carte multi-niveaux (ex. « Le Mur ») : empilement correct, curseur sur sommet composé.

### 8.4 Traversée
- 🤖 Montée > 0.5 bloquée, descente ≤ 1.0, dégâts de chute au-delà ; eau profonde/lave/obstacle
  infranchissables au sol — **sens couvert par les unit core** (`height-traversal`,
  `terrain-effects`). *Le rendu reste 👁.*

### 8.5 Phase de placement / zones de spawn
- 🤖 Zones de spawn **par format** (objectgroups `spawns-1v1`, `spawns-3p`…) + **symétrie** —
  **sens couvert par les unit core** (validation Tiled + zones de spawn). *Le highlight visuel
  reste 👁.*
- 👁 Highlight des zones : équipe active opaque (0.5), inactive (0.25), occupée (0.2), hors
  format (gris).
- 👁 Le joueur place ses Pokemon (roster, placés grisés) puis **choisit la direction** (flèches
  §3.9) ; `Échap` annule (uniquement son propre placement).

### 8.6 Aperçu de carte (map-select)
- 👁 Aperçu Babylon de la map avant combat (cf §6.3).

---

## 9. Gate CI (bloquant avant commit)

```
pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration
```

Raccourci `/ci-gate`. Zéro warning Biome toléré.

## 10. Smoke test pré-release

1. Menu + navigation toutes screens (§6) ; bascule FR/EN, **noms FR** partout.
2. Team Builder : créer/éditer une équipe, validation (§7.1).
3. Sélection d'équipe + format + lancement (§6.4).
4. Placement : zones correctes + direction (§8.5).
5. Combat 1v1 : un tour complet (déplacement + move) → dégâts + KO (§5).
6. Un move de chaque catégorie (Phys/Spé/Statut) + texte flottant (§5.1/5.2).
7. Un champ + une météo actifs, HUD à jour (§3.1, §4) ; occlusions correctes (pastille/auras/
   champ, §2).
8. Écran 4K / redimensionnement (§3.13, §4.11) ; console navigateur : **zéro erreur**.

## 11. E2E — Playwright (`pnpm test:e2e`)

Outil : `@playwright/test` + Chromium. Détails de conventions : `.claude/rules/e2e.md`.
**Principe : automatiser le SENS, pas les PIXELS.** 4 couches du moins cher au plus coûteux :
unit `view-core` → DOM (`getByRole`) → scène (hook scene-graph `__ptE2e__`, lecture seule) →
golden screenshots (minimal). Déterminisme par **seed** (`createPrng`), jamais d'override de
`Math.random`. Boot direct par config sandbox URL (dev/e2e only), `waitReady()` sur le signal de
scène. Port e2e dédié (port dev +1000). Un test = un état seedé.

### Inventaire actuel (couvert 🤖)

| Fichier | Couvre |
|---------|--------|
| `smoke/boot.spec.ts` | boot → menu principal |
| `smoke/splash.spec.ts` | §6.0 splash de boot (plan 135) : overlay présent + titre + barre de progression pendant le téléchargement du bundle (requête `sprites.bin` retenue), puis retiré du DOM et le menu monte |
| `dom/navigation.spec.ts` | menu → mode de combat → choix carte → retour |
| `dom/main-menu.spec.ts` | §6.1 — titre, 5 entrées, Aventure disabled, version, switch FR→EN + `pt-lang` |
| `dom/settings.spec.ts` | §6.7 — 2 options (Langue + Prévisualisation dégâts), persistance `pt-lang`/`pt-settings` |
| `dom/credits.spec.ts` | §6.8 — titre + contenu + EN |
| `dom/picker.spec.ts` | §7.2 — ouverture/liste/recherche, filtres type (union/toggle/reset), choisir/grisé/fermer |
| `dom/team-builder.spec.ts` | §6.5 — créer+nommer+persist, générer aléatoire, supprimer (« tout vider » skippé : régression modale, cf backlog) |
| `combat/scene-graph.spec.ts` | boot scène : sprites (groupe 2), curseur (groupe 3), terrain, FOUC retiré ; **barres PV ×2 + ombres + silhouettes (groupe 1)**, **tiles nommées `tile_x_y` (groupe 0) + décor herbe (groupe 2)** |
| `combat/sprite-bundle.spec.ts` | §3.6/§4.7 rendu issu du bundle (plan 135) : billboards `pokemon_plane` ×2 slicés du bundle (scène prête), portrait InfoPanel = data-URL PNG croppé de `portraits.png` (pas le pixel de repli), pré-évo Pikachu rend son sprite |
| `combat/scene-state.spec.ts` | §3.4 icône de statut (empoisonné) |
| `combat/driving.spec.ts` | piloter : attaque + dégâts (journal), K.O. + fin de combat, déplacement |
| `combat/normal-game.spec.ts` | parcours réel menu → carte → équipe → combat monte |
| `combat/targeting.spec.ts` | §3.7/§4.8/§4.12 — highlights `highlight_move_*` au déplacement, instruction « Sélectionne la cible »→« Confirmer ? » en attaque |
| `combat/mechanics-status.spec.ts` | §5.3 icône/statut + Spore, §5.4 stat ± + Grondement (buff self), §5.5 confusion/Provoc (journal) |
| `combat/mechanics-field.spec.ts` | §5.9 auras (Reflet/Mur/Brume/Rune), §5.10 4 champs déployés (journal) |
| `combat/mechanics-distortion.spec.ts` | §5.21 Distorsion : zone posée (journal « Distorsion ! » + quads indigo en scène) + inversion CT dans la timeline (lent avant rapide) |
| `combat/mechanics-hazards.spec.ts` | §5.22 Pièges au sol : Picots posés via le picker GroundTarget (journal « Des Picots sont posés au sol » + mesh `hazard_hazards_spikes_1_x_y` sur la case visée seule). Déclenchement = SENS unit core (non pilotable : owner-immunity + dummy AI immobile) |
| `combat/mechanics-dynamic-power.spec.ts` | §5.23 puissance conditionnelle : Branchicrok & Prise de Bec (hors-pool, ×2 cible fraîche tour 1) résolvent et infligent des dégâts (journal « perd N PV »). Hommage Posthume non couvert (scaling non observable en 1v1 + Dummy Normal immunisé Spectre) → 👁 |
| `combat/mechanics-charge.spec.ts` | §5.6 Vol charge, §5.7 Clonage, §5.11 Lance-Soleil (journal) + preview charge sous/hors Soleil (`sunSkipsCharge`) |
| `combat/mechanics-movement.spec.ts` | §5.13 Téléport + hit-and-run Demi-Tour + dash directionnel (Vive-Attaque, chantier g), §5.18 repoussé (Draconnerie) |
| `combat/mechanics-terrain.spec.ts` | §5.20 Magma brûle / Marais empoisonne / Lave K.O. (sur `sandbox-flat`) |
| `combat/mechanics-abilities.spec.ts` | §5.14 Intimidation (talent) + Restes (objet) + 3 baies (Baie Pocpoc anti-type, Baie Lichii pincement, Baie Fraive soin — une par famille) + 2 objets simples à event (Grelot Coque soin post-coup, Orbe Toxique auto-Poison Grave) + Bulbe (objet de réaction : coup Eau → Atq. Spé. +1 + consommé, une par famille) + Graine Électrik (granule de terrain : pose Champ Électrifié sous soi → fin de tour Déf +1 + consommée, une par famille) journalisés. Bandeau Muscle / Lunettes Sages (×1.1 sans event) = unit ; Pile / Boule de Neige / Lichen Lumineux (même factory) = unit ; Graine Herbe / Graine Psychique / Graine Brume (même factory) = unit + objets de précision (bande de jet seed 6, Élecanon 50 % : témoin sans objet rate / Loupe ×1,1 touche / Lentille Zoom ×1,0 inactive face à dummy inerte rate ; ×1,2 conditionnel = unit) + objets d'évasion (bande de jet seed 30, Jet-Pierres 90 % : témoin sans objet touche / Poudre Claire ×0,9 rate / Encens Doux ×0,9 rate) + §5.15 objets flinch (bande de jet seed 3, Jet-Pierres 90 % côté attaquant porteur : témoin sans objet touche sans apeurer / Roche Royale +10 % apeure / Croc Rasoir +10 % apeure) + §5.16 nouveaux objets (Herbe Mental : le joueur lance Provoc sur le dummy porteur → « Herbe Mental … s'active ! » + « a utilisé son Herbe Mental » ; Veste de Combat : au menu Attaque le move statut Repli reste affiché mais `data-enabled="false"`, Griffe sélectionnable, témoin sans objet → Repli sélectionnable). Grosse Racine (×1,3 soin drain) + Déf. Spé ×1,5 de la Veste + autres volatiles soignés par l'Herbe Mental = unit |
| `combat/mechanics-talents-tier-a.spec.ts` | §5.14 talents Tier A (plan 136) : Régé-Force (soin de fin de tour), Multi-Coups (Balle Graine → « Touché 5 fois ! »), Querelleur (Griffe touche un Ectoplasma Spectre — dégâts présents, « Ça n'affecte pas » absent — garde le fix handle-damage). Autres talents Tier A (silencieux / dépendants de l'IA) = unit |
| `combat/mechanics-talents-tier-b.spec.ts` | §5.15 talents Tier B (plan 137) : Sécheresse (Soleil à l'entrée → HUD « Plein soleil »), Cuvette (soin de fin de tour sous Pluie → « Cuvette … s'active ! » + « récupère N PV »), Vaccin (Poudre Toxik bloquée → « Vaccin … s'active ! », « est empoisonné » absent). 11 autres talents Tier B (blockers/multiplicateurs silencieux, soins miroirs, réactions dépendantes du type de coup ou de l'IA) = unit |
| `combat/mechanics-talents-tier-c.spec.ts` | §5.16 talents Tier C (plan 138) : Force Soleil (perte 1/8 PV en fin de tour sous Soleil → « Force Soleil … s'active ! » + « perd N PV »), Anti-Bruit (Mégaphone sonore bloqué → « Anti-Bruit … s'active ! », « perd N PV » absent), Boom Final (K.O. au contact → recul « Dracaufeu perd N PV »), Armurouillée (coup physique → « Défense … baisse ! » + « Vitesse … augmente ! »). 13 autres talents Tier C (multiplicateurs/immunités/réactions silencieux ou probabilistes) = unit/integration |
| `combat/mechanics-talents-secondary.spec.ts` | §5.17 talents attaquant — effet secondaire (plan 139) : Sans Limite (Nidoking + Bombe Beurk → « Sans Limite … s'active ! », dégâts présents, « est empoisonné » absent — secondaire supprimé, tout seed) ; Sérénité (Leveinard + Bombe Beurk, FLIP au seed 1 : poison absent sans le talent, présent avec — le 30 % doublé en 60 % réussit). Le ×1.3 de Sans Limite, le cap 100 % et les exclusions de Sérénité = unit/integration core |
| `combat/mechanics-talents-support.spec.ts` | §5.24 talents soutien & couplage objet (plan 141) : Moiteur (Électrode + Destruction sur Psykokwak porteur → « Moiteur … s'active ! » + « Mais cela échoue … ! », « Psykokwak perd N PV » absent), Gloutonnerie (Ronflex à 40 % PV + Baie Lichii → fin de tour → « Baie Lichii … s'active ! » + « Attaque … augmente ! » au seuil 50 %). Cœur Soin / Garde-Ami (soutien d'équipe, requièrent un allié à r2 → non pilotables en 1v1) et Tension (silencieux, effet = absence de baie) = unit/integration core → 👁 |
| `combat/mechanics-item-interaction.spec.ts` | §5.25 item interaction (plan 142) : Sabotage (retire l'objet → « perd son Restes »), Larcin (vole l'objet → « vole le … » + InfoPanel du lanceur « 🎒 Restes »), Tour de Magie (échange → « échange son objet … » + InfoPanel « 🎒 Restes »), Dégommage (Orbe Flamme lancée → « dégomme son Orbe Flamme » + « est brûlé »), Recyclage (baie mangée en fin de tour puis restaurée → « recycle son Baie Lichii » + InfoPanel), Éructation (jouable seulement après une baie mangée → dégâts au dummy), Glu (Sabotage bloqué sur Grotadmorv → « Glu … s'active », « perd son Restes » absent). Implore/Passe-Passe (effets partagés), Picore/Piqûre/Calcination/Gaz Corrosif (contenu fin non distinct au journal), Substitut (D5), baies Lansat/Frista (boost silencieux), ×1.5 de Sabotage = unit/integration core → 👁 |
| `combat/mechanics-type-manip.spec.ts` | §5.27 famille Type manip (plan 143) : Détrempage (`soak`, hors-pool forcé) sur le dummy Ronflex (Normal) → journal « Ronflex devient de type Eau ! » (event TypeChanged) + badge volatile « Type Eau » de l'InfoPanel au survol de la cible (`typeOverride`). Conversion/Conversion 2/Copie-Type/Flamme Ultime (historique de move ou type de lanceur requis, mêmes lignes de journal « devient de type … »/« perd son type Feu ! » + recalcul efficacité/STAB) = unit/integration core, non dupliqués e2e → 👁 |
| `combat/mechanics-move-copy.spec.ts` | §5.28 famille Move-copy (plan 144) : Copie (`mimic`) — l'IA du dummy Ronflex joue Plaquage au tour 1, le joueur Alakazam lance Copie sur lui au tour 2 → journal « Alakazam apprend Plaquage ! » (event MoveCopied) ET, après une fin de tour, le sous-menu d'attaque liste « Plaquage » à la place de « Copie » (slot muté) ; Métronome (`metronome`) — le joueur tire un move (PRNG seedé), le place sur le dummy adjacent → ligne de révélation « Métronome → <move tiré> » (réentrance prouvée, identité du move tiré non assertée). Blabla Dodo (gate sommeil `requiresAsleep`), Mimique (`mirror-move`, dernier move cible) / Photocopie (`copycat`, dernier move global) (dépendent d'un historique de move), Gribouille (`sketch` ≡ Copie) = unit/integration core (`moves/{metronome,sleep-talk,mirror-move,copycat,mimic,sketch}.test.ts`), non dupliqués e2e → 👁 |
| `combat/mechanics-field-global.spec.ts` | §5.29 famille Field global (plan 145) : les 3 zones diamant Self (Gravité / Zone Étrange / Zone Magique) posées sur la case du lanceur (2,3) → journal « déploie <label> (5 tours) » + quad de scène par kind (`field_terrain_<couleur>_2_3`, une couleur par kind) ; Vent Arrière (`tailwind`, GroundTarget portée 1) ciblé au nord (2,2) → journal « lève le Vent Arrière vers le Nord » + HUD flèche `tailwind-hud` (libellé « Vent Arrière ») ; Gravité verrouille les moves aériens → Pied Voltige (`disabledUnderGravity`) `data-enabled="false"` au menu Attaque une fois la zone posée, `data-enabled="true"` en témoin. Clouage des Volants + immunité Sol, précision ×5/3, swap Déf/DéfSpé, objet neutralisé, ctGain ×1.5 aligné au vent, décompte/expiration/horloge fantôme = unit/integration core (`moves/{gravity,wonder-room,magic-room,tailwind}.test.ts`, `field-global-system.test.ts`, `tailwind-system.test.ts`) → 👁 |
| `combat/mechanics-ohko.spec.ts` | §5.30 famille K.O. en un coup (OHKO, plan 148) : K.O. direct — Guillotine (`guillotine`, Single 1-1 contact, hors-pool forcé, `seed: 0` → touche) sur le dummy Normal adjacent → journal « C'est un K.O. direct ! » (event OneHitKo) + modale de victoire ; immunité Fermeté — le même coup seedé à toucher, dummy porteur de `sturdy` à pleins PV → « Fermeté de <dummy> s'active ! », « K.O. direct » et modale de victoire absents (survie à 1 PV). Immunités de type (Glace vs Glaciation, Spectre vs Normal, Vol vs Abîme), survie Baie Ceinture/Ténacité, règle précision Glace, les 3 autres patterns (Abîme Ligne 3 / Empal'Korne Ligne 2 / Glaciation Cône) = unit/integration core (`battle/ohko.test.ts`, `moves/{guillotine,fissure,horn-drill,sheer-cold}.test.ts`) → 👁. Le flottant « K.O.! » (couleur) et le tag tooltip ☠ = 👁 (pixel) |
| `combat/mechanics-trapping.spec.ts` | §5.26 famille Pièges (trapping) : piège PARTIEL (Danse Flammes + Aucun Garde forçant 100 % → « Ronflex est piégé ! » puis chip de fin de tour « Ronflex perd N PV ! ») ; piège PUR position-linked (Barrage → « Ronflex est piégé ! » sans dégâts, puis le lanceur s'éloigne en (2,5) → « Ronflex est libéré du piège »). Étreinte/Siphon/Tourbi-Sable (même pattern partiel) et Regard Noir (même pattern pur) = unit (`moves/*.test.ts`), non dupliqués e2e → 👁. Immobilisation (0 action Move, attaque OK) = unit (pas de ligne de journal) → 👁 |
| `combat/mechanics-priority-timing.spec.ts` | §5.31 famille Priorité / timing conditionnel (plan 150) : Bluff (`fake-out`) — 1ʳᵉ action → dégâts + « … est apeuré et ne peut pas agir ! », puis `data-enabled="false"` au tour 2 (firstActionOnly, Griffe restant `true`) ; Escarmouche (`first-impression`) — ouverture (dégâts) puis `data-enabled="false"` au tour 2 ; Coup Bas (`sucker-punch`) — TOUCHE si la dernière action de la cible était offensive (dummy hot-seat attaque avec Charge → « Ronflex perd N PV »), ÉCHOUE sinon (« Mais cela échoue … ! ») ; Mitra-Poing (`focus-punch`) — charge tour 1 (« … concentre son énergie … »), interrompu si frappé pendant la charge (« … est frappé pendant sa concentration ! ») → frappe T2 échoue (« … perd sa concentration ! », lanceur rapide Alakazam pour n'intercaler qu'un tour) ; Bec-Canon (`beak-blast`, 0 learner Gen 1 → sandbox) — brûlure de contact pendant la charge (« Ronflex se brûle sur le bec brûlant ! ») ; Carapiège (`shell-trap`, 0 learner Gen 1 → sandbox) — armé par un coup physique (« Le piège de Dracaufeu s'arme ! »). Fraîcheur fine de Coup Bas (a attaqué PUIS temporisé), « frappe si laissé tranquille » / dégât indirect ne casse pas (Mitra-Poing), frappe T2 de Bec-Canon + immunités, échec Carapiège si non armé, tags tooltip = unit/integration core (`moves/*.test.ts`, `charge-reaction.test.ts`, `priority-timing.integration.test.ts`) → 👁 |
| `combat/mechanics-crit.spec.ts` | §5.32 famille manipulation de coups critiques (Misc Batch A, plan 151) : Puissance (`focus-energy`, Self) → journal « … est plus enclin aux coups critiques ! » + badge InfoPanel « Puissance +2 » (survol du lanceur) ; Affilage (`laser-focus`, Self, 0 learner Gen 1 → sandbox) → journal « … se concentre : son prochain coup sera critique ! » + badge « Affilage », puis le coup SUIVANT (Griffe au tour 2 après un tour terminé) est forcé critique → « Coup critique sur … ! » ; Yama Arashi (`storm-throw`, `alwaysCrit`, 0 learner Gen 1 → sandbox) → « Coup critique sur … ! » à chaque coup, seed-indépendant. Cri Draconique (`dragon-cheer`, exige un allié JOUEUR — non supporté par le harness) et Dark Lariat (`darkest-lariat`, ignore les crans défensifs — pas de feedback observable) + lifecycle multi-tours (empilement, cleanup KO, `preventsCrit` annule `alwaysCrit`) = unit/integration core (`moves/*.test.ts`, `crit-manip.integration.test.ts`) → 👁 |
| `combat/mechanics-utility-damage.spec.ts` | §5.33 famille dégâts utilitaires (Misc Batch B, plan 152) : Faux-Chage (`false-swipe`, `cannotKo`) — dégâts sans K.O., cible à quelques PV reste à EXACTEMENT 1 PV (InfoPanel « 1 / max ») + aucune victoire ; Croc Fatal (`super-fang`, `HalveTargetHp`, 90 % → `seed: 1`) — « … perd la moitié de ses PV (-N) ! » (SuperFangApplied) + flottant `-N` ; Ruse (`feint`, `bypassProtect`) — le dummy (plus rapide, Ronflex lent en face) se protège (Abri) puis Ruse touche à travers (journal dégâts) ; Anti-Air (`smack-down`) — cloue le Dracolosse (Vol) au sol → « … est cloué au sol ! » (SmackedDown) + badge InfoPanel « Au sol », puis contrôle immunité Sol (Coud'Boue sur Vol non cloué = zéro dégât, immunité de type silencieuse) vs cas cloué (Coud'Boue ajoute une ligne de dégâts) ; Poursuite (`pursuit`, `pursuitBackstab`) — deux boots au seul dummyDirection près → dégâts de dos (×2,3) > 2× ceux de face (×0,85) ; Corps Perdu (`vital-throw`, `bypassAccuracy`) — touche une cible à Esquive +6 sans « rate son attaque ! ». Substitut cassable (Faux-Chage), typechart ignoré + K.O. 1-2 PV (Croc Fatal), ×0,85 face/×1,0 flanc exacts (Poursuite), vulnérabilité hazards + atterrissage forcé + cleanup KO (grounding), contrôle négatif du never-miss = unit/integration core (`moves/*.test.ts`, `utility-damage.integration.test.ts`) → 👁. Flottants (couleur) + tags tooltip = 👁 (pixel) |
| `combat/mechanics-transform.spec.ts` | §5.34 famille Transform (plan 157) : Morphing (`transform`) — Mew lance Morphing sur le Léviator adjacent → journal « Mew se transforme ! » (event Transformed), le menu d'attaque liste ensuite les moves copiés de la cible (« Cascade », plus « Morphing »), l'InfoPanel garde l'identité + les PV du lanceur (nom « Mew » inchangé, barre de PV stable — PV non copiés #649), et le type Vol copié fait léviter le morphé sur le marais (aucune ligne « marécage » en fin de tour, témoin non transformé empoisonné) ; Imposteur (`imposter`) — Métamorph (ditto) se transforme à l'entrée sur l'ennemi le plus proche → « … se transforme ! » dès le boot + menu du tour 1 déjà celui de la cible. Swap d'atlas du sprite (texture non exposée par le hook scène) + interaction Substitut + nom d'affichage `ditto`/Métamorph + copie fine (stats/crans/tempo/poids/genre), gates d'échec, cleanup KO, garde-fou IA, « manip écrase » = unit/integration core (`transform.integration.test`, `moves/transform.test.ts`, `handlers/transform/transform.test.ts`) → 👁 |
| `combat/mechanics-traversal.spec.ts` | §5.18 chute mortelle (repoussé/falaise 4) + §5.19 Spectre (poche) + Volant (marais) |
| `combat/height.spec.ts` | §5.17 mêlée bloquée par écart de hauteur ≥2 (`sandbox-melee-block`) |
| `combat/patterns.spec.ts` | §5.16 — 10 patterns pilotés de bout en bout (journal « utilise X ») |
| `combat/weather.spec.ts` | §4.3/§5.12 — HUD météo (config) + pose via cast (Danse Pluie/Zénith/Tempête de Sable) ; §5.14 Roche Humide prolonge la Pluie à 8 tours (HUD `weather-turns`) |
| `combat/mechanics-items.spec.ts` | §5.17 objets tenus du lot 95→99 : Ballon (éclate au 1er coup offensif → « Ballon … s'active ! » + « a utilisé son Ballon »), Lunettes Filtre (Spore bloqué → « Lunettes Filtre … s'active ! », « s'est endormi » absent), Pare-Effet (Griffe contact → Casque Brut adverse muet ; témoin sans objet → Casque Brut s'active), Talisman Sain (Groz'Yeux IA bloqué → « Talisman Sain … s'active ! »). Immunités silencieuses (Sol/poudre/météo, hazards/terrains au sol, baisse auto-infligée) = unit/integration. §5.18 lot 99→101 : Gant de Boxe (Mach Punch Poing → Casque Brut adverse muet ; témoin sans objet → Casque Brut s'active), Spray Gorge (Aboiement Son → « Spray Gorge … s'active ! »). Boost ×1,1, +1 AtqSpé, consommation, move Son statut = unit. §5.19 Métronome (objet) : 4 Griffe d'affilée sur dummy Ronflex endurant → AVEC objet le 4e coup (×1,3) > le 1er (×1,0) ; SANS objet série plate (variance seule). Compteur 0..10, cap +100 %, remise à zéro (move différent/raté) = unit. §5.20 objets « eject » (lot 102→104) : Carton Rouge (Florizarre dashe en Vive-Attaque depuis son spawn sur le dummy Ronflex porteur → l'ATTAQUANT est renvoyé chez lui → « Carton Rouge … s'active ! » + « … se téléporte ! » + « a utilisé son Carton Rouge »). Bouton Fuite (renvoie le PORTEUR : no-op si le dummy n'a pas bougé → non pilotable côté joueur) = unit/integration core (`forced-teleport.test.ts`, `items/eject-items.test.ts`) → 👁 |
| `combat/mechanics-items-content-fill.spec.ts` | §5.14 objets légers content-fill (plan 158) : Carapace Mue (Étreinte + Aucun Garde forçant 100 % sur le dummy Ronflex porteur → « L'objet de Ronflex le protège ! », « Ronflex est piégé ! » absent), Dé Pipé (Balle Graine → « Touché 5 fois ! » via l'objet). 9 autres objets silencieux (marqueurs poids/vitesse, crit-stage, défense Métamorph, modulateurs de piège, anti-secondaire, survie 10 %) + 2 talents no-op (Fuite/Ramassage) = unit (`battle/items/content-fill-158.test.ts`, `effective-weight.test.ts`, `effective-base-speed.test.ts`) → 👁 |
| `dom/maps.spec.ts` | §8.1/§8.3 — les 9 cartes montent (tuiles, no crash) + Le Mur multi-niveaux |
| `combat/hud.spec.ts` | §4 — sous-menu (type/nom), tooltip + grille de pattern (survol), timeline, §4.11 combat EN (`pt-lang=en`) |
| `combat/hud-menu.spec.ts` | §4.1 bannière, §4.2 timeline (active/team), §4.4 menu (5 boutons, Objet/Statut off), §4.5 move-item (type/nom/PP), §4.9 journal (titre + repli) |
| `combat/hud-state.spec.ts` | §4.6 tooltip (apparaît/disparaît + tag 2 tours), §4.2 timeline CT (`data-ct`), §4.7 badge statut, §4.5 nom EN |
| `combat/preview-colours.spec.ts` | §4.6 couleurs de preview pilotées par l'intention : `data-intent` attack/buff/heal (Griffe/Danse Lames/Fontaine de Vie), cellules `data-cell` target/dash/caster/caster-target, croix lanceur, centre Séisme vide |
| `combat/combat-flow.spec.ts` | annuler attaque/déplacement, §4.12 Échap ciblage + clic hors portée, §4.10 modale de victoire |
| `dom/screens.spec.ts` | §6.0 Échap retour, §6.2 modes off, §6.3 carte (8 + détail + ↑/↓ aria-current), §6.4 format + Lancer gating |
| `dom/pokemon-edit.spec.ts` | §7.1 compteur + vider slot, §7.3 fiche (sections, stats, 25 natures, move picker, preset, **picker d'objet** : objet boost-de-type listé/sélectionnable → assigné au slot) |
| `combat/info-panel.spec.ts` | §4.7 panneau d'info : actif (nom FR/niveau/PV/portrait) + **survol** (adversaire Dracaufeu/team, tile vide → repli) via hook `hoverTile` |
| `combat/weather.spec.ts` | §5 météo : HUD « Plein soleil » + tours restants |
| `combat/multi-hit.spec.ts` | §5 multi-hit : Balle Graine → récap « Touché N fois » |
| `combat/floating-text.spec.ts` | §5.2 texte flottant de dégâts (`hud_text_plane`) à la résolution |
| `visual/screens.spec.ts` | golden : menu, mode combat, paramètres, crédits, scène de combat |

Helpers : `e2e/fixtures/` (`bootSandbox(config?)` + catalogue `sandbox-configs.ts` : `DUEL`,
`DUEL_LETHAL`, `POISONED`, `MULTI_HIT`, `CRIT_FOCUS_ENERGY`, `CRIT_LASER_FOCUS`, `CRIT_STORM_THROW`,
`MORPH_MEW`, `MORPH_TERRAIN`, `IMPOSTER_DITTO`…),
`e2e/pages/` (POM : `MainMenu`, `Splash`, `CombatScene`, `screens`, `teamBuilder`, `combatHud`).

### À étendre (👁 → 🤖, par priorité — DOM d'abord, c'est facile)

- [x] **Splash de boot + bundle de sprites** (plan 135) : overlay présent→retiré + menu monte
      (`splash.spec`) ; billboards slicés du bundle + portrait InfoPanel croppé de `portraits.png` +
      pré-évo Pikachu (`sprite-bundle.spec`). *Fade/anim du splash + portrait du picker = 👁.*
- [x] **Menu principal** : 5 entrées, Aventure disabled, version, switch FR→EN (`main-menu.spec`).
- [x] **Paramètres** : 3 options, persistance `pt-lang`/`pt-settings` (`settings.spec`).
- [x] **Crédits** : titre + contenu + EN (`credits.spec`).
- [x] **Pokemon Picker** : ouverture, liste, recherche, filtres type (union/toggle/reset), grisé
      inter-slots, fermeture (`picker.spec`) ; **fiche détaillée §7.3** (`pokemon-edit.spec`).
      *Reste : recherche bilingue (différée → next.md).*
- [x] **Mes équipes** : créer/nommer+localStorage, générer aléatoire, supprimer
      (`team-builder.spec`). *« Tout vider » : test prêt mais **skippé** (régression modale →
      backlog). Reste : exporter, renommer depuis la liste.*
- [x] **Écrans hors combat** : §6.2 modes (En ligne/Tutoriel off), §6.3 carte (9 cartes, détail,
      sélection, retour), §6.4 « Lancer » gating (`screens.spec`).
- [x] **Combat DOM** : sous-menu (type/nom), tooltip + pattern preview (`hud.spec`, `hud-menu`) ;
      **bannière de tour**, **timeline** (active/team), **menu d'action** (5 boutons, Objet/Statut
      off), **journal** (titre + repli) (`hud-menu.spec`) ; **panneau d'info** (`info-panel.spec`) ;
      **météo HUD** (`weather.spec`) ; **multi-hit** (`multi-hit.spec`) ; **texte flottant**
      (`floating-text.spec`).
- [x] **Survol scène — info panel** : hook `hoverTile` ajouté à `__ptE2e__` ; survol adversaire →
      ses infos (Dracaufeu/team), tile vide → repli sur l'actif (`info-panel.spec`).
- [x] **§4 / §6 / §7 (DOM) — couverture poussée au maximum automatisable** : timeline CT, tooltip
      (apparaît/disparaît/tag), badge statut, nom EN (`hud-state`) ; Échap/hors-portée/modale victoire
      (`combat-flow`) ; Échap retour, ↑/↓ aria-current, format (`screens`) ; Paramètres 2 options +
      persistance (`settings`) ; état vide (`team-builder`) ; compteur/vider-slot/natures/move-picker/preset
      (`pokemon-edit`).
- [ ] **Reste 👁 DOM (irréductible — vérifié non reproductible, pas par flemme)** :
      - **§4.5 move grisé** (0 PP / sans cible / bloqué Provoc-Entrave-Bis) : en pratique les moves
        injouables sont **filtrés** de la liste (pas affichés grisés), le 0-PP n'est pas configurable
        en sandbox, et Provoc vient de l'adversaire (IA) → setup non reproductible proprement.
      - **§4.4 Attaque/Deplacement grisé** « si aucune action » : pas reproduit (le bouton reste
        actif même cible hors portée dans nos configs).
      - **Export/Import Showdown, presse-papier** (§7.1, §7.4) : clipboard → 👁.
      - **Pan/rotation aperçu carte, transition d'écran, responsive 4K, re-render visuel** : pixel/
        anim/canvas → 👁.
- [ ] **Reste 👁 (compliqué/impossible en e2e — marqué manuel dans le cahier)** :
      - **Aura ground icons / preview menace au survol** : `hoverTile` dispo, mais besoin d'un état
        avec auras actives au boot (`SandboxConfig` ne l'expose pas) → bloqué, reste 👁.
      - **Heuristiques de scoring IA (§5.35, plans 159→161)** : **reporté** — le harness ne peut pas
        piloter le vrai scorer. `dummyControl: "ai"` câble `DummyAiController` (move scripté, ne passe
        jamais par `scoreAction`) ; le `AiTeamController` réel n'est branché que sur le chemin
        team-select, avec PRNG `createPrng(Date.now())` non seedé et équipes non configurables par URL
        → non déterministe, non pilotable. **Prérequis feature** : `dummyControl: "scored"` dans
        `SandboxConfig` câblant `AiTeamController` sur Player2 avec `createPrng(config.seed)`. Sens
        **couvert unit** (`ai/action-scorer.test.ts`). *Ne pas écrire de spec IA factice.*
      - ~~**EN en combat**~~ : **CORRIGÉ** (`initLanguage()` au boot + locale Playwright `fr-FR`) →
        couvert par `hud.spec` (`pt-lang=en` → menu en anglais).
      - **Tout ce qui est pixel/anim/couleur** : flottants (couleur par type), anims sprite (idle/
        walk/attaque/KO/glide vol/wobble confusion), highlights/curseur (couleur, contour), overlay
        de champ + pastille, occlusion fine, caméra/zoom, responsive 4K, aperçu Babylon des cartes.
      - **Déclenchement des pièges au sol (§5.22)** : non pilotable via le harness — le joueur ne
        déclenche pas SES propres pièges (owner-immunity) et le dummy AI ne se déplace jamais. Le
        **SENS est 🤖 via les unit/integration du core** (`entry-hazard-system`,
        `resolve-hazard-traversal`) ; seule la **pose** est automatisée en e2e (`mechanics-hazards`).
      - **Mécaniques de combat (§5, §3.3, §3.12, §5.17–5.20)** : le **SENS est déjà 🤖 via les unit/
        integration du core** ; seul le **rendu** reste 👁. Les piloter en e2e serait redondant +
        fragile (seed-dépendant à travers le renderer).
- [ ] **Golden** supplémentaires si besoin (plafond ~8) : HUD de combat, écrans restants.

Réf : `.claude/rules/e2e.md`, `docs/methodology.md`, `docs/agent-orchestration.md`,
`docs/isometric-height-rendering.md`, `docs/design-system.md`, `docs/tileset-mapping.md`.
