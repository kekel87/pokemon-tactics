# Plan 233 — VFX lot 1 : le coup tombe au bon moment (timing, impact, vitesse, visualiseur)

**Statut** : done (2026-10-08, recette humaine validée)
**Origine** : `/next` du 2026-10-07, chantier « VFX d'attaque » (roadmap, domaine *Donner envie*).
Recherche et cadrage : graphe, `reflexion-2026-10-07-vfx-son-synthese` (+ 4 entités par source),
`decision-1137` (découpage en 3 lots), `decision-1138` (son, licence, limite itch).

**Ce plan est le lot 1** : aucun asset, aucun effet visuel de capacité, aucun son. Il pose la
mécanique de mise en scène sur laquelle les lots 2 (effets) et 3 (son) se brancheront.

**Hypothèses vérifiées contre le code**:
- `hitFrame` et `returnFrame` **existent bien** dans les atlas.json (152/152 espèces + directions) ✓
- `getSettings()` et `updateSettings()` **existent** et sont utilisés au démarrage du combat (plan 198, décision #893) ✓
- Aucun code runtime ne lit `hitFrame` actuellement ✓
- Multi-coups et AoE **sont déjà gérés** par un pré-scan d'événements ✓
- L'ordre d'événements est tel que DamageDealt arrive avant KnockbackApplied/IceSlideApplied ✓

## Résultat

Livré : impact calé sur la HitFrame, micro-pause par efficacité, assombrissement de dégât et pose
Hurt à l'impact, horloge unique `combatClock`, réglage « Vitesse des combats » (+ 3 compteurs
`combat-speed-*`), charges calées sur l'impact, atelier des attaques (`pnpm dev:atelier`). **Retirés
en recette** : flash blanc et secousse d'impact (invisibles) ; flash blanc gardé pour l'attaquant en
*Instantanée*. Décisions : `decision-1139` à `decision-1143` ; mémoire : entité `plan-233`.
Environ 20 retours en recette (visualiseur/atelier, impact).

## Ce que tu verras à l'écran

1. Quand un Pokémon attaque, la cible réagit **au moment où le coup porte** dans l'animation
   (griffe qui touche, tir qui part), plus à la fin de l'animation : flash, barre de PV, chiffre.
2. Au contact, attaquant et cible **se figent une fraction de seconde** (micro-pause), plus longue
   sur un super efficace / extrêmement efficace, quasi nulle sur un peu efficace. **À l'essai** :
   un flash blanc bref avant le rouge et une petite secousse de la cible — on garde ou on retire
   après ta recette.
3. Dans **Réglages**, une ligne **« Vitesse des combats »** : *Normale* / *Rapide* (×2) /
   *Instantanée* (pas d'animation d'attaque, le résultat s'affiche directement).
4. Un **atelier des attaques** (`pnpm dev:atelier`, écran dédié) : une liste d'attaques filtrable
   avec leur fiche (type, catégorie, patron, drapeaux), plusieurs cibles devant l'attaquant, et un
   « Rejouer » instantané sans rechargement.

## Le constat (mesuré le 2026-10-07)

- `battle-orchestrator.ts:2268` : `MoveStarted` → `await playAttack(...)` joue l'animation
  Attack/Shoot/Charge **jusqu'au bout**, puis les événements suivants (`DamageDealt` → `flashDamage`
  + `updateHp`, chiffres flottants via `feedback.report`) sont traités. L'impact est en retard.
- PMDCollab fournit `rushFrame` / `hitFrame` / `returnFrame` par animation (AnimData.xml).
  `scripts/extract-sprites.ts` les extrait et ils **sont dans le bundle livré** (`sprites.bin`,
  `meta.animations.<Anim>.hitFrame`) — mais **aucun code runtime ne les lit**.
- Couverture : **152/152 espèces** ont `hitFrame` sur Attack et Charge, **150/150** sur Shoot
  (les 2 sans Shoot retombent déjà sur Attack).
- `DamageDealt` porte déjà `effectiveness` (0 / 0,25 / 0,5 / 1 / 2 / 4) ; `CriticalHit` existe.
- Réglages : infrastructure `getSettings()` / `pt-settings` en place, lue à l'entrée en combat
  (décision #893). Studio bac à sable : `SandboxPanel.ts`, `VITE_SANDBOX`, dev seulement.

## Approche

### A. Ligne de temps à marqueurs (le cœur)

- **`playAttack` (port + Babylon)** expose deux Promises séparées :
  - `impact` : résolue quand le contrôleur PMD atteint le `hitFrame` de l'animation jouée
  - `done` : résolue quand l'animation est complète (comportement actuel)
  
  Repli : pas de `hitFrame` → `impact` se résout immédiatement (pas de délai avant les dégâts). Le minuteur de sécurité `BABYLON_ATTACK_ANIMATION_MAX_MS` couvre les deux Promises.

  **Implémentation recommandée** : retourner un objet `{ impact: Promise<void>, done: Promise<void> }` au lieu d'une Promise unique. C'est plus simple que des callbacks (pas de mutations dans les options), et plus lisible (la signature exprime clairement les deux points d'arrêt).

- **`pmd-animation-controller.ts`** gagne le support hitFrame :
  - Stocker le `hitFrame` per-animation quand on lit l'atlas
  - Ajouter un callback `onFrame?: (index: number) => void` à `playOnce()` 
  - Appeler `onFrame(index)` à chaque frame PM D atteinte
  - Le gestionnaire peut alors déclencher la micro-pause (gel de frame pendant N ms) au hitFrame

- **L'orchestrateur, sur `MoveStarted`** :
  1. Lance l'anim avec `await playAttack(...).impact`
  2. Traite les événements du coup (dégâts, statuts, chiffres, barre) **immédiatement**
  3. Puis `await playAttack(...).done` 
  4. Bloque tout événement de déplacement (PokemonMoved, KnockbackApplied, …) **après** done
  
  Multi-coups : le 1er coup à l'impact, les suivants cadencés par les delays de l'orchestrateur (BATTLE_TEXT_QUEUE_DELAY_MS). Attaques sans dégât (statut) : les effets statut apparaissent aussi à l'impact.

- **Ancres du son, muettes** : un point d'émission unique de *repères de présentation*
  (`attack-start`, `impact` avec l'efficacité, `faint`…) vers un récepteur vide côté rendu. Le lot 3
  y branchera l'audio sans retoucher l'orchestrateur ; le lot 2 y branchera les effets.

### B. Sensation d'impact, réglée par l'efficacité

- Table unique (constantes view-core, `docs/design-system.md` à compléter), relue par
  `game-designer` — valeurs de départ, réglées en recette :

  | Efficacité | Micro-pause | Flash blanc | Secousse (cran) |
  |---|---|---|---|
  | ×0 (immunité) | 0 | non | 0 — seul « Aucun effet » |
  | ×0,25 | 0 | non | 0 |
  | ×0,5 | 40 ms | non | 1 |
  | ×1 | 90 ms | 1 frame | 2 |
  | ×2 | 150 ms | 2 frames | 3 |
  | ×4 | 220 ms | 2 frames | 4 |

  ×0,25 et ×0,5 se distinguent par le texte et la couleur du chiffre, pas par la pause.
- **Critique** : pas de cumul — micro-pause = max(efficacité, 150 ms) ; flash blanc 3 frames,
  secousse +1 cran plafonnée à 4.
- **Zone (plusieurs cibles)** : **une seule** micro-pause par attaque, calée sur la plus forte
  efficacité touchée ; flash et secousse individuels par cible (sa propre efficacité).
- **Multi-coups** : micro-pause **au dernier coup** seulement (ou au coup critique) ; coups
  intermédiaires = flash + chiffre sans gel.
- **Plafond** : micro-pause cumulée ≤ 250 ms par action, toutes cibles et tous coups confondus.
- Micro-pause sur attaquant **et** cible (gel de frame).
- 🔴 **Recette du 2026-10-07 : flash blanc et secousse RETIRÉS** (choix de l'humain) — invisibles à
  vitesse normale (1 image, 0,06 case). Les colonnes « Flash blanc » / « Secousse » de la table
  ci-dessus ne s'appliquent plus. Dans la foulée, l'assombrissement de dégât (le « clignotement »
  existant, gris et non rouge) part **dès l'impact** au lieu d'attendre la fin de la micro-pause : la
  pose de dégât est tenue par le gel, le coup se lit d'un bloc.
- 🔴 **Recette du 2026-10-07 : les charges (patron Dash)** partent **au moment de l'impact du geste**
  et courent **sur leur animation d'attaque** (plus de marche) ; le coup porte à l'arrivée. Avant :
  geste complet sur place, puis course en marchant, puis coup (trois temps, ~800 ms de creux). Le
  moteur annonce la course comme un `PokemonMoved` ordinaire (`PokemonDashed` n'est jamais émis) :
  la pose est gardée quand c'est l'attaquant en cours qui se déplace avant ses coups
  (`moveAlongPath({ keepPose })`).

### C. Vitesse des combats (réglage)

- Nouveau réglage `combatSpeed: "normal" | "fast" | "instant"`, persistant dans `GameSettings`, ligne dans
  `settings-panel.ts`, i18n FR/EN/ES.
- **Mise en place progressive** de l'échelle de temps (arbitrage si débordement) :
  - **Phase 1** (garantie ce lot) : orchestrateur seulement (BATTLE_STEP_DELAY_MS, BATTLE_TEXT_QUEUE_DELAY_MS)
  - **Phase 2** (opportuniste) : tweens de déplacement (moveAlongPath, impactGlide)
  - **Phase 3** (si possible) : durées des frames PMD (frameDurationMs)
  
  Si l'unification déborde (regrouper tous les délais dans un facteur global) → coupe-circuit : le réglage *Rapide* se limite aux attaques et délais de l'orchestrateur (phase 1), le reste reste normal.

- *Rapide* = ×2 sur ce qui est unifié ; la micro-pause est réduite de moitié (pas supprimée), pour
  garder le signal d'efficacité.
- *Instantanée* = pas d'animation d'attaque (`impact` et `done` immédiats), ni micro-pause ni
  secousse. **Reste visible**, sinon le joueur perd « qui a frappé qui » : chiffre flottant (≥ 400 ms),
  barre de PV en tween court (~150 ms, pas un saut sec), flash rouge, textes d'efficacité et de
  critique, K.O. et icônes de statut, surbrillance brève de l'attaquant (~200 ms).
- **Les tours de l'IA suivent le même réglage** (pas de réglage séparé dans ce lot).
- Purement présentation : aucun effet sur le core, le déterminisme ni le réseau (pas de `NETWORK_VERSION`).
- Contrôle d'interface ajouté → passe multi-entrée (`.claude/rules/multi-input.md`) : la ligne de
  réglage hérite du panneau existant (clavier, manette, tactile déjà gérés).

### D. Atelier des attaques (dev seulement) — refait après la recette du 2026-10-07

🔴 **Première version écartée en recette** : greffée sur le bac à sable, elle reconstruisait toute la
scène à chaque « Jouer » (écran de chargement → clignotement), sélecteur natif de 850 attaques,
flèches et « distance » incompréhensibles, aucune info sur l'attaque. Cadrage de l'humain : **un
espace dédié, lancé comme le bac à sable (pas d'adresse), avec plusieurs cibles** pour voir les
attaques de zone.

- **Lancement** : `pnpm dev:atelier ['{"move":"flamethrower","attacker":"charizard","target":"venusaur"}']`
  (`VITE_ATELIER` + config JSON, même mécanique que `dev:sandbox`) — je peux ouvrir un cas précis.
- **Scène montée une fois** (arène plate, carte gardée). Rejouer = nouveau moteur + nouvel
  orchestrateur sur la MÊME scène : pas d'écran de chargement, PV remis à plein. Le chrome de combat
  est masqué : l'atelier a son propre panneau.
- **Plusieurs cibles** en formation devant l'attaquant (rang au contact, ligne derrière) : une
  attaque de zone, de cône ou de ligne en touche plusieurs. L'attaquant vise la cible atteignable la
  plus proche dans son axe.
- **Panneau** : recherche par nom FR + filtres (type, catégorie, patron, **style** = drapeaux :
  poing, morsure, tranchant, son…) → liste (nom, type, catégorie, patron) ; **fiche** de l'attaque
  (type, catégorie, puissance, précision, patron, portée, drapeaux, effet visuel « aucun — lot 2 »).
  ↑ / ↓ attaque précédente / suivante de la liste filtrée, Espace rejoue.
- **Séquence** (sous la scène, demandée en recette — modèle : timeline de Blender, pistes de Unity
  Timeline) : règle en ms, tête de lecture, pistes Attaquant (animation + losange d'impact),
  Micro-pause, Coups (×efficacité, regroupés par instant), K.O., Effets (lot 2) et Son (lot 3)
  grisées. Les commandes vivent dans son en-tête : ⏮ depuis le début, ◀| / |▶ image par image,
  ▶/⏸, vitesse, boucle. Piste Attaquant **découpée image par image** (durées PMD réelles), l'image
  d'impact en surbrillance et allongée de la micro-pause.
- **Curseur à traîner (scrub)** — choix de l'humain en recette, préféré au simple ralenti : toute la
  mise en scène d'un combat passe par une **horloge de combat unique** (`combatClock`,
  `view-core/combat-pacing.ts`) — images des sprites, glissades, secousses, textes flottants,
  attentes de l'orchestrateur, filet de sécurité de l'attaque. Elle avance en temps de combat
  (réel × vitesse), se fige en pause et s'avance pas à pas (`CombatScene.stepFrame`). Glisser :
  vers l'avant, on avance l'horloge figée image par image ; vers l'arrière, on rejoue l'attaque
  (déterministe) et on avance jusqu'à l'instant visé. L'ambiance (vent, scintillement, curseur)
  reste en temps réel. C'est aussi ce qui servira à caler les effets du lot 2.
- Les lots 2 et 3 n'y ajouteront rien : il jouera leurs effets et sons d'office, et la fiche dira
  quelle forme d'effet l'attaque reçoit et si elle est générique ou dédiée.

## Hors périmètre

- Tout effet visuel de capacité (lot 2), tout son (lot 3), toute lumière.
- Un bouton « passer » pendant l'animation (le réglage *Instantanée* couvre le besoin).
- Caméra qui bouge à l'impact.

## Fichiers touchés (prévision)

**Ports & contrats** :
- `render-ports/src/combat-scene.ts` — modifier `playAttack()` pour retourner un objet avec `impact` et `done` Promises (ou exposer callbacks)

**Implementers Babylon** :
- `render-babylon/src/combat-scene.ts` — implémenter la résolution `impact` au hitFrame

**View Core** :
- `view-core/src/pmd-animation-controller.ts` — ajouter support hitFrame callback dans `playOnce()`
- `view-core/src/battle-orchestrator.ts` — orchestrer `impact` vs `done`, traiter dégâts à `impact`
- `view-core/src/constants.ts` — table efficacité→durée micro-pause

**UI & settings** :
- `app/src/settings/index.ts` — ajouter `combatSpeed: "normal" | "fast" | "instant"`
- `app/src/ui/dom/panels/settings-panel.ts` — contrôle ligne « Vitesse des combats »
- `app/src/ui/SandboxPanel.ts` — visualiseur d'attaques (section avec liste filtrable, attaquant/cible/distance)
- i18n `app/src/i18n/locales/{fr,en,es}.ts` — libellés vitesse, visualiseur

**Canvas2D adapter** :
- `render-canvas2d` — implémentation triviale : `impact` = `done` (pas d'animation, retour immédiat)

**Docs** :
- `docs/design-system.md` — constantes visuelles (micro-pause par efficacité, amplitudes secousse/flash blanc)

## Tests

**Unitaires view-core** (après recette, menu) :
- `pmd-animation-controller.ts` : `playOnce()` avec `onFrame()` callback, déclenche au bon index
- `playAttack()` retourne bien deux Promises distinctes (ou callbacks) résolues dans l'ordre
- Orchestrateur : dégâts traités entre `impact` et `done`, pas avant `impact`
- Table efficacité→durée micro-pause (constants) : cas normaux et extrêmes

**e2e** (après recette) :
- La barre de PV de la cible **baisse avant la fin** de l'anim d'attaque (golden screenshot peut bouger)
- Réglage *Instantanée* persistant et fonctionnel (pas de délais visuels)
- Multi-entrée de la ligne « Vitesse des combats » (clavier, manette, tactile)

## Risques

- **Ordre des événements** : traiter les dégâts pendant l'anim ne doit pas faire partir un recul
  (`KnockbackApplied`) avant `done` → barrière explicite vérifiée par code (les événements de
  déplacement sont traités après la boucle DamageDealt, dans le même bloc d'orchestrateur).
  
- **hitFrame manquant ou faux** : si une animation n'a pas de hitFrame (atlas ancien), `impact`
  tombe immédiatement, ce qui est le comportement de repli accepté. Vérifier par test que les
  152 espèces l'ont sur Attack/Charge et 150+ sur Shoot.
  
- **Échelle de temps unifiée** : les délais sont dispersés (orchestrateur, tweens PMD, contrôleur).
  Unifier implique un dénominateur commun. **Arbitrage en route** (coupe-circuit) : si déborder
  menace, limiter d'abord aux délais orchestrateur + animations Attack (le cœur du "ressentir").
  Tweens et frames PMD restent normaux. À remonter si blocage.
  
- **Recettes visuelles e2e** : les goldens capturant un instant (HP bar partielle, fin d'anim) peuvent
  changer. Les rafraîchir post-recette humaine ou ignorer les dégâts pour les nouveaux goldens.
