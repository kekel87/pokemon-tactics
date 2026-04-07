# Visual Tester — Connaissances acquises

> Ce fichier est lu par le visual-tester au début de chaque session.
> Il contient les raccourcis, positions, et workflows appris au fil des tests.
> **Mettre à jour ce fichier** après chaque session qui apporte de nouvelles connaissances.

---

## Architecture de la page

- Le jeu est un canvas Phaser 4 WebGL plein écran (1280x720, CSS 100vw/100vh)
- **Pas de DOM interactif** : tous les boutons/menus sont dessinés dans le canvas Phaser
- `browser_snapshot` retourne très peu d'info utile (juste un canvas) — les screenshots sont la source principale
- Les coordonnées de clic doivent être en **pixels écran** relatifs au canvas

## IMPORTANT : Viewport et coordonnées

**Toujours redimensionner la fenêtre à 1280x720 avant de naviguer/cliquer.**
Sans ça, le canvas est affiché en CSS plus grand (ex: 1477x831) et les coordonnées ne correspondent pas.
Avec viewport 1280x720, les coordonnées CSS pixel = coordonnées du jeu Phaser directement.

## Flow de navigation (menu → combat)

### Chemin rapide pour atteindre le combat

1. `browser_resize(1280, 720)` — PREMIER REFLEXE avant tout
2. `browser_navigate` vers l'URL (port peut varier : 5173, 5174, 5175...)
3. **Menu principal** : cliquer "Combat" (~x=640, y=349)
4. **Mode de combat** : cliquer "Local" (~x=640, y=299)
5. **Team Select** :
   - Cliquer "Auto" pour Joueur 1 (~x=120, y=210)
   - Cliquer "Auto" pour Joueur 2 (~x=1160, y=210)
   - Cliquer "Valider" pour Joueur 1 (~x=58, y=210)
   - Cliquer "Valider" pour Joueur 2 (~x=1098, y=210)
   - "Lancer le combat" s'active (vert) -> cliquer (~x=1150, y=669)
6. **Placement** : phase de placement des Pokemon sur la grille
7. **Combat** : on est sur la grille isométrique

### Positions des boutons Team Select (1280x720)

| Bouton | Position |
|--------|----------|
| Auto Joueur 1 | x=120, y=210 |
| Valider Joueur 1 | x=58, y=210 |
| Auto Joueur 2 | x=1160, y=210 |
| Valider Joueur 2 | x=1098, y=210 |
| Lancer le combat | x=1150, y=669 (actif seulement apres les deux Valider) |

### Positions approximatives des éléments en combat (1280x720)

| Element | Position approx |
|---------|----------------|
| Timeline (turn order) | Haut-gauche, colonne x=16-52, y=20+ |
| Info tour ("Round X - Joueur Y") | Haut-centre, x=640, y=50 |
| Info Panel (Pokemon selectionne) | Bas-gauche, x=16-236, y=606-700 |
| Action Menu | Droite, x=1054-1264, y varie (monte depuis le bas) |
| Battle Log | Haut-droite, x=980-1280, y=0-200 (pliable) |
| Grille isometrique | Centre, ~x=300-900, ~y=200-550 |
| Curseur (tile hover) | Losange jaune sur la grille |

### Phase de placement (apres Lancer le combat)

- En bas : barre de portraits Pokemon a placer (x ~490-788, y ~680)
- Les tiles valides de spawn sont surlignees en jaune (zone bas-gauche pour J1)
- Workflow placement : clic portrait Pokemon -> clic sur tile surlignee
- Zone spawn J1 (grille iso) : bas-gauche de la grille, screen ~(200-500, 420-550)

### Coordonnées utiles sur la grille (carte 10x10 standard)

La grille est en projection isometrique. Le centre de la grille est ~(640, 360).
- Les Pokemon Joueur 1 (bleu) sont generalement en bas-gauche
- Les Pokemon Joueur 2 (rouge) sont generalement en haut-droite

### Sandbox

- URL : lancer via `pnpm dev:sandbox` (pas via le menu)
- Carte 6x6 reduite, 2 Pokemon (1 joueur + 1 dummy)
- Panel config en haut-droite

## Gotchas et pièges connus

1. **Canvas WebGL = pas de selecteurs DOM** : tout clic doit etre par coordonnees (x, y)
2. **browser_snapshot est quasi inutile** : il ne voit que `<canvas>`
3. **Ne pas faire browser_snapshot entre chaque action** : screenshot direct
4. **Les animations bloquent les clics** : attendre ~500ms apres une action
5. **Le hover Phaser ne fonctionne pas avec browser_hover** : utiliser `browser_run_code` avec `page.mouse.move(x, y)`
6. **favicon.ico 404** : erreur reseau normale, ignorer
7. **Les overlays de grille sont semi-transparents** : couleurs plus ternes sur screenshot
8. **Le menu d'action disparait apres une action** : normal, reapparait au tour suivant
9. **VIEWPORT CRITIQUE** : Sans `browser_resize(1280, 720)`, coordonnees decalees. Toujours resize en premier.
10. **Dev server port variable** : peut etre 5173, 5174, 5175... Verifier avec curl avant de naviguer.
11. **Lancer le combat grise** : necessite "Valider" (pas seulement "Auto") pour chaque equipe.
12. **Phase placement** : clic portrait d'abord, puis clic tile surlignee. Clic direct ne fonctionne pas.

## Stratégie d'optimisation

### Faire MOINS de tool calls

- **TOUJOURS resize a 1280x720 en premier** pour eviter les recalculs de coordonnees
- **Ne pas faire de snapshot** : aller direct au screenshot
- **Combiner les verifications** : screenshot + console en parallele quand possible

### Workflow minimal pour un test visuel

1. `browser_resize(1280, 720)` — avant tout
2. Navigate (si pas deja sur la page)
3. Screenshot (comprendre l'etat)
4. Interactions necessaires (clics, hovers)
5. Screenshot final (preuve)
6. Console errors (verification)
7. Rapport

### Ce qui est TOUJOURS vrai

- Le jeu est en 1280x720 (FIT scaling)
- Police monospace partout
- Fond bleu nuit #1a1a2e
- Les Pokemon ont des sprites PMDCollab pixel art (scale x2)
- Les barres HP changent de couleur : vert > 60%, jaune 30-60%, rouge < 30%
- Les equipes : bleu = Joueur 1 (gauche), rouge = Joueur 2 (droite)

## Tiles texturees (ajout plan 2026-04-07)

Depuis une mise a jour, les tiles de la grille sont texturees :
- **Zone combat centrale** : tiles sable/pierre beige avec texture detaillee
- **Bordures** : tiles gazon vert avec texture herbe (herbes hautes pixel art)
- **Marquages d'arene** : cercles concentriques bleu/gris par-dessus les tiles (style terrain sport Pokemon)
- Les anciennes losanges colores ont ete remplace par ces tiles PNG isometriques
