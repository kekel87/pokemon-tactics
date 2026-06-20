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
| Highlights / curseur / picker | §3.7, §3.8, §3.9 |
| Décor / hauteur / map / terrain type | §3.10, §3.12, §8 |
| Hauteur en combat (vue/portée/dégâts) | §3.12, §5.17 |
| Chute / repoussé / terrain létal / glace | §5.18, §8.4 |
| Traversée (Spectre / Volant) | §5.19, §8.4 |
| Effets de terrain (coût/statut/DOT/bonus) | §5.20, §8.1 |
| Pattern de ciblage d'un move | §3.7, §4.6, §5.16 |
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
*src : `directional-billboard.ts`, `view-core/pmd-animation-controller.ts`*

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
- 👁 Texte secondaire (efficacité) **empilé sous** le primaire, plus petit ; un seul primaire par
  Pokemon par beat, le reste **staggeré**.

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
- 👁 **Soleil** : moves `sunSkipsCharge` (Lance-Soleil) se résolvent **en un tour** (pas de charge).
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
- 🤖 **Objets tenus simples à event** — un par mécanique, pilotés de bout en bout (`mechanics-abilities.spec`) :
  **Grelot Coque** (`shell-bell`, soin post-coup : porteur blessé qui attaque → 1/8 des dégâts rendus,
  « Grelot Coque de <X> s'active ! » + « <X> récupère N PV ») ; **Orbe Toxique** (`toxic-orb`,
  auto-statut : empoisonne gravement le porteur en fin de tour sans statut majeur, « Orbe Toxique de
  <X> s'active ! » + « <X> est gravement empoisonné ! »). *Bandeau Muscle (`muscle-band`, ×1.1 phys) /
  Lunettes Sages (`wise-glasses`, ×1.1 spé) = simples multiplicateurs sans event → couverts unit
  (`battle/items/simple-held-items.test.ts`), non pilotés e2e → 👁.*
- 🤖 **Baies** — une par famille de mécanique, pilotées de bout en bout (`mechanics-abilities.spec`) :
  **Baie Pocpoc** (`passho-berry`, anti-type : ÷2 un coup Eau super-efficace, déclenché par un
  Pistolet à O sur l'Onix porteur) ; **Baie Lichii** (`liechi-berry`, pincement : +1 Atq à ≤25 % PV
  en fin de tour) ; **Baie Fraive** (`rawst-berry`, soin : guérit la brûlure en fin de tour). Chacune
  asserte « <Baie> de <X> s'active ! » + « <X> a utilisé son <Baie> » (consommation). *Les 18/4/7
  baies au complet = couvertes unit/integration core (`battle/items/*-berries.test.ts`) ; la table
  par baie n'est pas re-pilotée e2e (même mécanique, IDs différents) → reste 👁 par baie.*
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

---

## 6. Recette — écrans DOM (hors combat)
*src : `app/ui/dom/screens/`, `app/app/screen-manager.ts`*
*e2e : `tests/smoke/boot.spec.ts`, `tests/dom/navigation.spec.ts`, `tests/dom/menus.spec.ts`,
`tests/visual/screens.spec.ts` (golden)*

### 6.0 Navigation globale
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
- 🤖 Liste de **8 cartes** ; nom + méta + **description** renseignés ; **sélectionner une autre
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
- 🤖 Les 8 cartes du jeu montent leur scène Babylon avec des tuiles (no crash) — `maps.spec`. Couleurs/tileset/eau profonde 👁.
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
| `dom/navigation.spec.ts` | menu → mode de combat → choix carte → retour |
| `dom/main-menu.spec.ts` | §6.1 — titre, 5 entrées, Aventure disabled, version, switch FR→EN + `pt-lang` |
| `dom/settings.spec.ts` | §6.7 — 2 options (Langue + Prévisualisation dégâts), persistance `pt-lang`/`pt-settings` |
| `dom/credits.spec.ts` | §6.8 — titre + contenu + EN |
| `dom/picker.spec.ts` | §7.2 — ouverture/liste/recherche, filtres type (union/toggle/reset), choisir/grisé/fermer |
| `dom/team-builder.spec.ts` | §6.5 — créer+nommer+persist, générer aléatoire, supprimer (« tout vider » skippé : régression modale, cf backlog) |
| `combat/scene-graph.spec.ts` | boot scène : sprites (groupe 2), curseur (groupe 3), terrain, FOUC retiré ; **barres PV ×2 + ombres + silhouettes (groupe 1)**, **tiles nommées `tile_x_y` (groupe 0) + décor herbe (groupe 2)** |
| `combat/scene-state.spec.ts` | §3.4 icône de statut (empoisonné) |
| `combat/driving.spec.ts` | piloter : attaque + dégâts (journal), K.O. + fin de combat, déplacement |
| `combat/normal-game.spec.ts` | parcours réel menu → carte → équipe → combat monte |
| `combat/targeting.spec.ts` | §3.7/§4.8/§4.12 — highlights `highlight_move_*` au déplacement, instruction « Sélectionne la cible »→« Confirmer ? » en attaque |
| `combat/mechanics-status.spec.ts` | §5.3 icône/statut + Spore, §5.4 stat ±, §5.5 confusion/Provoc (journal) |
| `combat/mechanics-field.spec.ts` | §5.9 auras (Reflet/Mur/Brume/Rune), §5.10 4 champs déployés (journal) |
| `combat/mechanics-distortion.spec.ts` | §5.21 Distorsion : zone posée (journal « Distorsion ! » + quads indigo en scène) + inversion CT dans la timeline (lent avant rapide) |
| `combat/mechanics-hazards.spec.ts` | §5.22 Pièges au sol : Picots posés via le picker GroundTarget (journal « Des Picots sont posés au sol » + mesh `hazard_hazards_spikes_1_x_y` sur la case visée seule). Déclenchement = SENS unit core (non pilotable : owner-immunity + dummy AI immobile) |
| `combat/mechanics-dynamic-power.spec.ts` | §5.23 puissance conditionnelle : Branchicrok & Prise de Bec (hors-pool, ×2 cible fraîche tour 1) résolvent et infligent des dégâts (journal « perd N PV »). Hommage Posthume non couvert (scaling non observable en 1v1 + Dummy Normal immunisé Spectre) → 👁 |
| `combat/mechanics-charge.spec.ts` | §5.6 Vol charge, §5.7 Clonage, §5.11 Lance-Soleil (journal) |
| `combat/mechanics-movement.spec.ts` | §5.13 Téléport + hit-and-run Demi-Tour + dash directionnel (Vive-Attaque, chantier g), §5.18 repoussé (Draconnerie) |
| `combat/mechanics-terrain.spec.ts` | §5.20 Magma brûle / Marais empoisonne / Lave K.O. (sur `sandbox-flat`) |
| `combat/mechanics-abilities.spec.ts` | §5.14 Intimidation (talent) + Restes (objet) + 3 baies (Baie Pocpoc anti-type, Baie Lichii pincement, Baie Fraive soin — une par famille) + 2 objets simples à event (Grelot Coque soin post-coup, Orbe Toxique auto-Poison Grave) journalisés. Bandeau Muscle / Lunettes Sages (×1.1 sans event) = unit |
| `combat/mechanics-traversal.spec.ts` | §5.18 chute mortelle (repoussé/falaise 4) + §5.19 Spectre (poche) + Volant (marais) |
| `combat/height.spec.ts` | §5.17 mêlée bloquée par écart de hauteur ≥2 (`sandbox-melee-block`) |
| `combat/patterns.spec.ts` | §5.16 — 10 patterns pilotés de bout en bout (journal « utilise X ») |
| `combat/weather.spec.ts` | §4.3/§5.12 — HUD météo (config) + pose via cast (Danse Pluie/Zénith/Tempête de Sable) |
| `dom/maps.spec.ts` | §8.1/§8.3 — les 8 cartes montent (tuiles, no crash) + Le Mur multi-niveaux |
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
`DUEL_LETHAL`, `POISONED`, `MULTI_HIT`), `e2e/pages/` (POM : `MainMenu`, `CombatScene`, `screens`,
`teamBuilder`, `combatHud`).

### À étendre (👁 → 🤖, par priorité — DOM d'abord, c'est facile)

- [x] **Menu principal** : 5 entrées, Aventure disabled, version, switch FR→EN (`main-menu.spec`).
- [x] **Paramètres** : 3 options, persistance `pt-lang`/`pt-settings` (`settings.spec`).
- [x] **Crédits** : titre + contenu + EN (`credits.spec`).
- [x] **Pokemon Picker** : ouverture, liste, recherche, filtres type (union/toggle/reset), grisé
      inter-slots, fermeture (`picker.spec`) ; **fiche détaillée §7.3** (`pokemon-edit.spec`).
      *Reste : recherche bilingue (différée → next.md).*
- [x] **Mes équipes** : créer/nommer+localStorage, générer aléatoire, supprimer
      (`team-builder.spec`). *« Tout vider » : test prêt mais **skippé** (régression modale →
      backlog). Reste : exporter, renommer depuis la liste.*
- [x] **Écrans hors combat** : §6.2 modes (En ligne/Tutoriel off), §6.3 carte (8 cartes, détail,
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
