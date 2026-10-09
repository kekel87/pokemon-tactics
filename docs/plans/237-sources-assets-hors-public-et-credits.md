# Plan 237 — Sources des sprites hors de `public/`, et crédits complets à l'écran

**Statut** : done (2026-10-09 — sources déplacées et vérifiées, refonte Crédits livrée ; voir decision-1154)
**Origine** : suite des plans 235-236. L'humain : « on n'avait pas déjà une architecture ? » — oui :
`assets-src/` (décision 516, voxel ; plan 234, `assets-src/effects/`). Les sources des sprites et des
icônes d'objets sont les deux seules à vivre encore dans `public/`, d'où le nettoyage au build
(plan 236). Exigence de l'humain : **tester que tout fonctionne**.

## Ce que tu verras à l'écran

- En jeu : sprites, portraits et icônes d'objets **strictement identiques** (le paquet livré est
  reconstruit à l'octet près sur la même machine, vérifié par sha256 — voir Vérification ; si le
  rebuild baseline diffère du committé, c'est remonté avant de continuer).
- L'écran **Crédits** gagne deux lignes : les effets d'attaque (PMD Origins) et les icônes d'objets
  (Pokémon Showdown), en français, anglais et espagnol — textes validés en chat avant écriture.
- Côté outillage : `pnpm extract-sprites` et `pnpm extract-item-icons` écrivent dans
  `assets-src/sprites/`, `pnpm pack-sprites` y lit. `public/` ne contient plus que ce qui part en prod.

## Ajout en recette (2026-10-09) — refonte de l'écran Crédits

Retour de l'humain au scénario 2 : « super moche, les liens ne sont pas cliquables ». Choix de
l'humain : **liste par rubriques**, dans ce plan (pas de plan séparé).

### Ce que tu verras à l'écran (refonte)

- Un titre « Crédits », puis quatre rubriques titrées (Graphismes, Interface, Police, Code), chacune
  avec un filet doré.
- Une ligne par asset : ce que c'est à gauche, la source à droite en **lien cliquable** (↗, ouvre un
  nouvel onglet), la licence en petite pastille quand il y en a une.
- L'avertissement « projet de fan non commercial… » en petit, en bas, au-dessus de « Retour ».
- Au clavier et à la manette, les flèches passent d'un lien à l'autre puis à « Retour » ; au doigt,
  chaque lien fait au moins 30 px de haut. L'écran défile sur téléphone (déjà corrigé).

### Comment

- `credits-screen.ts` : une table de données typée (rubrique → entrées `{ label, source, url?,
  license? }`). Les **libellés** (rubriques, « Sprites et portraits »…) sont traduits (fr/en/es) ; les
  **noms propres** (PMDCollab, Kenney, Poképédia…), URLs et licences restent en dur, non traduits.
- Les liens sont des `<a href target="_blank" rel="noopener noreferrer">` avec `tabindex="0"` (seul
  moyen d'entrer dans `FOCUSABLE_SELECTOR` sans toucher à la navigation partagée) et un
  `data-testid`. À la manette, `activateFocusedControl()` fait `click()` → ouvre le lien.
- CSS dans `menu-screens.css` (tokens existants : `--color-accent` pour rubriques et liens,
  `--color-text-muted` pour l'avertissement), conforme à `css.md` (préfixe `mn-credits-`, pas de
  style inline). Le filet `safe center` + défilement est conservé.
- Les anciennes clés paragraphes (`credits.sprites`, `credits.tileset`, `credits.moveEffects`,
  `credits.itemIcons`, `credits.uiIcons`, `credits.font`, `credits.inputPrompts`, `credits.cursors`,
  `credits.code`) sont remplacées par les clés de libellés — zéro clé morte.
- Passe multi-entrée **mesurée** (clavier, manette, tactile 30 px, 5 viewports) avant la recette.

### Relecture contre le code (2026-10-09) — état et points à traiter

**État du code** : `credits-screen.ts` est encore dans sa forme d'avant refonte (liste plate de
paragraphes `CREDIT_KEYS`, aucune rubrique, aucun lien). La refonte décrite ci-dessus reste à écrire.

**Vérifié, conforme** :
- `FOCUSABLE_SELECTOR` (`focus-navigation.ts`) contient `[tabindex='0']` sans garde `:disabled` : un
  `<a href tabindex="0">` y entre bien, et `focusableWithin()` ne l'écarte que s'il n'est pas rendu.
- `activateFocusedControl()` fait `active.click()` : sur un `<a>` ça déclenche l'activation native.
- `menu-screens.css` : `.mn-credits-screen` a déjà `justify-content: safe center` + `overflow-y: auto`.
- Tokens : `--color-accent` (tokens.css l.117) et `--color-text-muted` (l.130) existent.
- Le disclaimer (`credits.disclaimer`, fr l.511) contient « projet de fan » : le POM `CreditsScreen`
  le retrouve par `getByText` quelle que soit sa position.
- Le plancher tactile est déjà gardé pour les liens : `e2e/pages/responsive.ts` (`undersizedTouchTargets`)
  mesure `a[href]` et `[tabindex="0"]`, et `touch-targets.spec.ts` l'applique à l'écran Crédits.

**À corriger ou décider avant la recette (non prévu par le plan)** :

1. **Focus initial sur le premier lien, pas sur « Retour »**. `bindScreenInput()` pose le focus sur
   `focusableControls()[0]`, c'est-à-dire le premier élément dans l'ordre du DOM. « Retour » est en
   dernier dans la pile (choix de `css.md`), donc le premier lien recevra le focus à l'arrivée au pad.
   Un A involontaire ouvre alors une source dans un nouvel onglet. Décision à prendre : garder ce
   comportement, ou faire commencer le focus sur « Retour » (ordre DOM ou point d'entrée explicite).
2. **Régression e2e certaine** : `e2e/tests/dom/screen-keyboard.spec.ts` l.66-69 (« Crédits »)
   attend `page.locator("button:focus")` à 1 après un ↓. Avec un lien en premier, le focus tombe sur
   un `<a>` et ce compteur passe à 0. Le test est à adapter (`a:focus, button:focus`) dans le même lot.
3. **Popup bloquée au pad, à mesurer** : un `click()` programmatique sur `<a target="_blank">` sans
   activation utilisateur (un appui de manette n'en produit pas, à la différence du clavier) est
   très probablement bloqué par le bloqueur de popups. Le plan dit « ouvre le lien » : c'est une
   hypothèse à vérifier en navigateur réel (manette synthétique `pages/gamepad.ts`). Si bloqué, il
   faut un repli à décider (ex. afficher l'URL en clair à côté du lien, ou accepter que la manette
   ne puisse pas ouvrir la source).
4. **itch.io (iframe)** : `target="_blank"` ne s'ouvre depuis une iframe que si son attribut
   `sandbox` contient `allow-popups`. Non vérifiable en local (l'iframe locale n'a pas le même
   `sandbox` qu'itch.io) : à mesurer sur la page itch, pas seulement en local. Sans ça, le clic
   souris ne fait rien, sans erreur visible.
5. **Capture de référence** : `e2e/tests/visual/screens.spec.ts` l.43 compare `credits.png`. La
   refonte la rend obsolète : régénération **volontaire** après recette (jamais un
   `--update-snapshots` réflexe, cf. `e2e.md`).
6. **Code mort à supprimer dans le même lot** : `.mn-credits-text` (menu-screens.css l.112) n'a plus
   de consommateur une fois les paragraphes remplacés ; les neuf clés `credits.*` anciennes sont à
   retirer de `types.ts` et des trois locales (le plan le dit, la liste de clés reste à écrire).
7. **Noms des nouvelles clés non fixés** : le plan ne donne ni les clés de rubriques ni celles des
   libellés d'entrées, ni la rubrique de `credits.inputPrompts` et `credits.cursors`. À trancher
   avant d'écrire la table (et attention au conflit avec l'ancienne `credits.code`, à remplacer).
8. **Retour sans `data-testid`** : `menuButton()` (`elements.ts` l.33) ne pose pas de `data-testid`,
   alors que `multi-input.md` impose un testid à tout contrôle interactif. Le POM le trouve par rôle
   et nom, donc rien ne casse ; à corriger si on touche l'helper.
9. **Cible tactile** : le plan écrit « au moins 30 px ». La règle est un token : `min-height:
   var(--target-min)` (24 px par défaut, 30 px sous `pointer: coarse`, `tokens.css` l.207 et l.271).
   Le garde-fou e2e mesure à 30 px (`TARGET_MIN = 30`, `touch-targets.spec.ts` l.35).
10. **Documentation d'`el()` désalignée** : `.claude/rules/html.md` montre `el(tag, attrs)`, alors que
    le code réel est `el(tag, className?, testId?)` (`elements.ts` l.18). Pour un `<a>`, poser
    `href`, `target`, `rel`, `tabIndex` à la main après `el("a", …)`.

## Ce qu'on fait

1. **Chemins** :
   - `scripts/sprite-config.json` : `outputDir` → `assets-src/sprites/pokemon`.
   - `scripts/extract-item-icons.ts` : `OUTPUT_DIR` → `assets-src/sprites/item-icons`.
   - `scripts/pack-sprites.ts` : **découpler la sortie de `outputDir`**. Aujourd'hui
     `bundleDir = resolve(spritesRoot, "..")` (l.91) : changer `outputDir` seul enverrait `sprites.bin`,
     `sprites-manifest.json`, `portraits.png`, `item-icons.png` dans `assets-src/sprites/` et
     laisserait le bundle livré périmé dans `public/`. Il faut donc une constante dédiée
     `BUNDLE_DIR = join(ROOT_DIR, "packages/app/public/assets/sprites")` pour les quatre sorties, et
     `ITEM_ICONS_DIR = join(ROOT_DIR, "assets-src/sprites/item-icons")` pour la lecture des icônes
     (l.151 : remplacer `join(bundleDir, "item-icons")`). `spritesRoot` reste
     `join(ROOT_DIR, config.outputDir)`.
   - Commentaires et docs qui citent les anciens chemins mis à jour. Liste à grep, vérifiée le
     2026-10-09 : `scripts/pack-sprites.ts` (en-tête l.5, l.19 ; commentaire l.14-17 « per-Pokemon
     folders … gitignored » et l.148-149), `scripts/extract-item-icons.ts` (en-tête l.12, l.14-15),
     `packages/app/vite.config.ts` (commentaire l.75-79 « the sprite folders are gitignored »),
     `docs/architecture.md` (l.249-250, 362, 960-975, 987), `.claude/agents/asset-manager.md` l.40
     (chemin déjà obsolète : `packages/renderer/public/...`, à corriger au passage), et
     `docs/plans/234` / `236` (historique : ne pas réécrire, laisser tel quel).
2. **`.gitignore`** : les deux entrées `public/...` (l.43-52, avec leur commentaire « Run once to
   untrack ») remplacées par `assets-src/sprites/`. Vérifié : ni `pokemon/` ni `item-icons/` ne sont
   dans l'index git, donc le `mv` ne produit aucune suppression de fichier suivi.
3. **Cache local** : déplacer (`mv`) les deux dossiers existants vers `assets-src/sprites/` — pas de
   re-téléchargement. Vérifié le 2026-10-09 : `public/assets/sprites/pokemon/` (≈877 fichiers,
   dont `credits.txt`) et `public/assets/sprites/item-icons/` (117 PNG) sont présents. Le mv doit
   être fait **après** avoir figé le sha des quatre fichiers du bundle (étape Vérification).
4. **`vite.config.ts`** : `NON_SHIPPED_ASSET_DIRS` ne garde que `assets/maps/dev` ; les deux entrées
   sprites (l.82-90) et leur commentaire partent. Le garde-fou du plafond reste. Tests du plugin
   (`packages/app/scripts/strip-non-shipped-assets.test.ts`) à ajuster **explicitement** :
   - test 1 (l.80-96) : ne plus écrire ni attendre `assets/sprites/pokemon` et `item-icons/leftovers.png`
     comme « retirés » ; ils deviennent des fichiers livrés, à vérifier en `true` si on les garde.
   - test e2e (l.98-109) : `assets/sprites/pokemon/...` ne doit plus être un cas de retrait.
   - test « does not count the stripped folders » (l.117-124) : **échoue tel quel** — il s'appuie sur
     `assets/sprites/pokemon` comme dossier retiré ; il faut un autre dossier retiré (`assets/maps/dev`)
     pour que le compte « 5 fichiers » reste vrai.
5. **Crédits** : clés `credits.moveEffects` et `credits.itemIcons` (types + fr/en/es), ajoutées à la
   liste de `credits-screen.ts` entre le tileset et la police.

## Vérification — « que tout fonctionne »

- **Paquet identique à l'octet** — ordre impératif :
  1. **Avant toute modification**, sha256 des quatre fichiers de `public/assets/sprites/` (`sprites.bin`,
     `sprites-manifest.json`, `portraits.png`, `item-icons.png`) ; puis `pnpm pack-sprites` sur le code
     **inchangé** et re-sha. Si le résultat diffère du committé, le « identique à l'octet » n'est
     **pas** atteignable tel quel (sharp/libvips ou le mode d'encodage a changé depuis le dernier commit
     du bundle) : c'est une décision à remonter à l'humain, pas à contourner.
  2. Après le changement : `pnpm pack-sprites`, puis sha des quatre fichiers **dans `public/`**. Contrôle
     de non-vacuité : `assets-src/sprites/` ne doit contenir **aucun** `sprites.bin`, `portraits.png`,
     `item-icons.png`, `sprites-manifest.json`, et `public/` doit avoir des mtime postérieurs au lancement.
     Sans ce contrôle, un bundle écrit au mauvais endroit donnerait un diff vide (faux positif).
  3. `git status --porcelain -- packages/app/public/assets/sprites` vide (le diff `--stat` ne dit rien
     sur un binaire : utiliser les sha).
  - Déterminisme (relu dans le code, non exécuté) : l'ordre des entrées est fixé par `sprite-config`
    puis par `Object.values(HeldItemId)` ; le seul `readdirSync` ajoute les dossiers « extra » triés. Pas
    d'horodatage dans le manifest ni dans `Buffer.concat`. Reste la dépendance à sharp/libvips (encodage
    PNG) : reproductible sur la même machine et la même version, non garanti entre deux machines — à
    écrire comme tel dans la recette.
- **Extraction** :
  - `pnpm extract-item-icons` relancé (réseau) → écrit dans `assets-src/sprites/item-icons/` ; contrôle
    du nombre (117) et du sha de quelques icônes avant/après.
  - `extract-sprites` : **ne pas le relancer sur un Pokémon réel** pour la vérification — il retélécharge
    et réécrit `atlas.png`/`offsets.json`, donc le bundle peut changer pour une raison hors périmètre.
    Le CLI accepte un nom (`pnpm extract-sprites bulbasaur`) ; la vérification se limite au chemin
    résolu (`join(ROOT_DIR, config.outputDir, name)`) via une commande de contrôle ou une copie de
    `sprite-config.json` en dossier de test, sans écrire dans `assets-src/`.
- **Build** : `public/` sans les dossiers `pokemon/` et `item-icons/` ; **même liste de fichiers** que
  le build d'avant le changement (`find dist -type f | sort` comparé), pas un nombre recopié. Le « 111 »
  du premier jet n'a pas de source dans les plans 235-236 : à mesurer en baseline.
- **Recette humaine** : un combat (sprites, portraits, objet tenu visible) + l'écran Crédits en FR/EN/ES.
- Tests unitaires du plugin et `/ci-gate full` au menu.

## Risques / Questions

- **Bundle écrit au mauvais endroit** (si `bundleDir` reste dérivé de `outputDir`) : diff vide sur
  `public/` et faux « identique ». Neutralisé par le découplage de l'étape 1 et le contrôle de non-vacuité.
- **Reproductibilité sharp** : à mesurer en baseline (Vérification, point 1). Si non reproductible, ne
  pas recommiter un bundle régénéré sans accord de l'humain (il changerait pour un motif hors périmètre).
- **Tests du plugin** : le test « does not count the stripped folders » casse si on ne change pas son
  dossier de référence (étape 4).
- **Crédits** : les `credits.txt` par Pokémon vivent dans `pokemon/` (ici `assets-src/`, gitignoré) ; ils
  ne sont plus dans `public/` ni dans le build. L'attribution en jeu reste dans l'écran Crédits (étape 5).

## Dépendances

- Après : plan 236 (plugin de retrait) et commit `f0a3388b` (`CREDITS.md`).
- Avant : aucun.

## Hors périmètre

- `CREDITS.md` (fait à part, commit du 2026-10-09).
- Aucune dépendance, aucun changement de tsconfig ni de workflow CI (la CI ne lance pas l'extraction).
