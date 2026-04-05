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

## Flow de navigation (menu → combat)

### Chemin rapide pour atteindre le combat

1. `browser_navigate` → `http://localhost:5173`
2. **Menu principal** : cliquer "Combat" (2e bouton, centré, ~y=460 sur écran 1280x720)
3. **Battle Mode** : cliquer "Combat local" (1er bouton actif, ~y=300)
4. **Team Select** :
   - Cliquer "Auto" pour chaque équipe (~y=400-450, côté gauche puis droit)
   - Les toggles Humain/IA sont en haut de chaque colonne
   - Cliquer "Lancer le combat" en bas centre (~y=600)
5. **Placement** : si placement manuel, cliquer les tiles de spawn. Si auto, le combat démarre directement
6. **Combat** : on est sur la grille isométrique

### Positions approximatives des éléments en combat (1280x720)

| Element | Position approx |
|---------|----------------|
| Timeline (turn order) | Haut-gauche, colonne x=16-52, y=20+ |
| Info tour ("Round X — Joueur Y") | Haut-centre, x=640, y=50 |
| Info Panel (Pokemon sélectionné) | Bas-gauche, x=16-236, y=606-700 |
| Action Menu | Droite, x=1054-1264, y varie (monte depuis le bas) |
| Battle Log | Haut-droite, x=980-1280, y=0-200 (pliable) |
| Grille isométrique | Centre, ~x=300-900, ~y=200-550 |
| Curseur (tile hover) | Losange jaune sur la grille |

### Coordonnées utiles sur la grille (carte 10x10 standard)

La grille est en projection isométrique. Le centre de la grille est ~(640, 360).
- Les Pokemon Joueur 1 (bleu) sont généralement en bas-gauche
- Les Pokemon Joueur 2 (rouge) sont généralement en haut-droite
- Pour hover un Pokemon ennemi, viser la moitié droite/haute de la grille

### Sandbox

- URL : lancer via `pnpm dev:sandbox` (pas via le menu)
- Carte 6x6 réduite, 2 Pokemon (1 joueur + 1 dummy)
- Panel config en haut-droite

## Gotchas et pièges connus

1. **Canvas WebGL = pas de sélecteurs DOM** : tout clic doit être par coordonnées (x, y)
2. **browser_snapshot est quasi inutile** : il ne voit que `<canvas>` — utilise les screenshots pour comprendre l'état
3. **Ne pas faire browser_snapshot entre chaque action** : ça ralentit sans rien apporter. Faire screenshot direct.
4. **Les animations bloquent les clics** : après un clic d'action (attaque, déplacement), attendre ~500ms avant le prochain clic
5. **Le hover Phaser ne fonctionne pas avec browser_hover** : utiliser `browser_run_code` avec `page.mouse.move(x, y)` pour simuler un pointermove
6. **favicon.ico 404** : erreur réseau normale, ignorer
7. **Les overlays de grille (bleu, rouge, orange) sont semi-transparents** : sur screenshot, les couleurs apparaissent plus ternes que les valeurs hex
8. **Le menu d'action disparaît après une action** : c'est normal, il réapparaît au tour suivant

## Stratégie d'optimisation

### Faire MOINS de tool calls

- **Ne pas vérifier si le dev server tourne** si l'appelant dit qu'il tourne déjà
- **Ne pas faire de snapshot** : aller direct au screenshot
- **Combiner les vérifications** : screenshot + console en parallèle quand possible
- **Skip le menu si l'URL est déjà sur le bon écran** : vérifier l'URL avant de re-naviguer

### Workflow minimal pour un test visuel

1. Navigate (si pas déjà sur la page)
2. Screenshot (comprendre l'état)
3. Interactions nécessaires (clics, hovers)
4. Screenshot final (preuve)
5. Console errors (vérification)
6. Rapport

### Ce qui est TOUJOURS vrai

- Le jeu est en 1280x720 (FIT scaling)
- Police monospace partout
- Fond bleu nuit `#1a1a2e`
- Les Pokemon ont des sprites PMDCollab pixel art (scale x2)
- Les barres HP changent de couleur : vert > 60%, jaune 30-60%, rouge < 30%
- Les équipes : bleu = Joueur 1 (gauche), rouge = Joueur 2 (droite)
