# Visual Tester — Connaissances acquises

> Ce fichier est lu par le visual-tester au début de chaque session.
> Il contient les raccourcis, positions, et workflows appris au fil des tests.
> **Mettre à jour ce fichier** après chaque session qui apporte de nouvelles connaissances.

---

## Architecture de la page

- Le **board de combat** (terrain + sprites) est un canvas Babylon WebGL (1280x720, CSS 100vw/100vh)
- **Le reste est du vrai DOM** : menus, team builder, settings, et le HUD/chrome de combat sont des éléments HTML/CSS en overlay → privilégier les sélecteurs `getByRole`/`getByText`/`getByTestId` (cf. `.claude/rules/e2e.md`)
- `browser_snapshot` voit le DOM (menus, HUD) mais pas le contenu du canvas Babylon — pour le board, les screenshots restent la source principale
- Les clics sur les **tiles du board** doivent être en **pixels écran** relatifs au canvas ; les clics sur les menus/HUD passent par les sélecteurs DOM

## IMPORTANT : Viewport et coordonnées

**Toujours redimensionner la fenêtre à 1280x720 avant de naviguer/cliquer.**
Sans ça, le canvas est affiché en CSS plus grand (ex: 1477x831) et les coordonnées ne correspondent pas.
Avec viewport 1280x720, les coordonnées CSS pixel = coordonnées du canvas Babylon directement (utile pour viser une tile du board).

## Flow de navigation (menu → combat)

### Chemin rapide pour atteindre le combat

1. `browser_resize(1280, 720)` — PREMIER REFLEXE avant tout
2. `browser_navigate` vers l'URL (port peut varier : 5173, 5174, 5175...)
3. **Menu principal** : cliquer "Combat" (~x=640, y=349)
4. **Mode de combat** : cliquer "Local" (DOM)
5. **Choix de carte** : liste DOM -> cliquer une carte -> attendre 2s rendu 3D -> `button "Choisir cette carte"`
6. **Sélection d'équipe** : tout DOM (pas de coordonnées)
   - Cliquer une team dans la liste droite pour l'assigner au joueur actif (surligné)
   - Bascule Humain/IA : bouton badge inline dans colonne gauche (`button "Humain"` / `button "IA"`)
   - Pour IA vs IA rapide : `button "🎲 Remplir IA"` (bas de page) assigne Aléatoire aux deux
   - `button "Lancer ▶"` s'active quand les deux joueurs sont configurés
7. **Combat** : démarrage direct ("Placement auto" coché par défaut)

### Sélection d'équipe (DOM-only — maj 2026-06)

- Tous les éléments sont DOM (pas coordonnées)
- Joueur 1 / Joueur 2 : colonne gauche, chacun avec badge Humain/IA cliquable
- Teams disponibles : liste droite (une team sauvegardée + "Aléatoire")
- Clic sur une team dans la liste l'assigne au joueur courant (celui surligné)
- "Remplir IA" (bottom-left) : assigne Aléatoire à tous les joueurs en mode IA d'un coup
- "Placement auto" checkbox (bottom) : coché par défaut, skip la phase placement manuelle

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
5. **Le hover d'une tile du board (canvas Babylon) ne fonctionne pas avec browser_hover** : utiliser `browser_run_code_unsafe` avec `page.mouse.move(x, y)`. Pour le DOM (menus/HUD), `browser_hover` sur le sélecteur marche normalement
6. **favicon.ico 404** : erreur reseau normale, ignorer
7. **Les overlays de grille sont semi-transparents** : couleurs plus ternes sur screenshot
8. **Le menu d'action disparait apres une action** : normal, reapparait au tour suivant
9. **VIEWPORT CRITIQUE** : Sans `browser_resize(1280, 720)`, coordonnees decalees. Toujours resize en premier.
10. **Dev server port variable** : peut etre 5173, 5174, 5175... Verifier avec curl avant de naviguer.
11. **Sélection d'équipe entièrement DOM** : ne plus utiliser coordonnées pour les boutons Joueur/Auto/Valider. Tout passe par DOM selectors (boutons texte, refs snapshot).
12. **Carte sélectionnée avant team selection** : le flow est maintenant Menu->Combat->Mode->Carte->Teams->Battle (pas Teams avant Carte).
13. **page.screenshot({path:...}) dans browser_run_code_unsafe** : fonctionne UNIQUEMENT si le path est relatif au CWD du MCP server (ex: `screenshots/gifframes/frame-000.png`). Les paths absolus vers /home/... ne fonctionnent pas (fichier non créé silencieusement).
14. **ls /tmp** peut sembler vide même si des fichiers existent** : utiliser `find /tmp/ptgif -type f` pour vérifier. C'est un bug de shell dans le contexte sandboxé.
15. **Rejouer** après fin de combat : dialog DOM avec bouton `button "Rejouer"` relance immédiatement le même combat.

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

## Capture GIF (ajout 2026-06)

### Workflow GIF pour marketing/README

**But** : capturer ~50 frames d'un combat IA vs IA sur Forêt Dense avec rotation caméra.

```javascript
// Dans browser_run_code_unsafe — save frames au CWD du MCP
async (page) => {
  const baseDir = 'screenshots/gifframes';  // relatif au CWD MCP (projet)
  for (let i = 0; i < 55; i++) {
    await page.screenshot({
      path: `${baseDir}/frame-${String(i).padStart(3, '0')}.png`,
      scale: 'css',
      type: 'png'
    });
    if (i === 18) await page.keyboard.press('ArrowRight');  // rotation camera
    if (i === 36) await page.keyboard.press('ArrowRight');  // 2eme rotation
    await page.waitForTimeout(130);
  }
  return 'done';
}
```

**Assemblage ffmpeg** (sous ~4MB) :
```bash
ffmpeg -y -framerate 8 -i screenshots/gifframes/frame-%03d.png   -vf "fps=10,scale=580:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=200[p];[s1][p]paletteuse=dither=sierra2_4a"   docs/images/demo.gif
```

**Résultats obtenus** : 55 frames, 580x377px, ~3.8MB.

**Notes** :
- Le battle log toggle est `data-testid="battle-log-toggle"` (bouton ☰ en haut-droite)
- ArrowRight = rotation camera Babylon 90° (feature unique Babylon vs Phaser)
- "Rejouer" après fin de combat relance le même combat (pratique pour re-capturer)
- Forêt Dense (14x14, arbres) = carte la plus visuellement impressionnante pour marketing
