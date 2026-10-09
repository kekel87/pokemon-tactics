# Plan 236 — Build : un seul nettoyage des assets non livrés, et un garde-fou sur le plafond itch.io

**Statut** : done (2026-10-09)
**Origine** : suite du plan 235. Un chiffre faux (« 1012 fichiers ») est venu d'un build vers un
`--outDir` de travail : `stripPerPokemonSpriteFoldersPlugin` vise `process.cwd()/dist` en dur, donc
hors de `dist/` il ne retire rien. L'humain a demandé de traiter les trois points soulevés.

## Ce que tu verras à l'écran

- En jeu : **rien ne change**.
- `pnpm build` affiche une ligne « N fichiers dans le build (plafond itch.io : 1000) ».
- Si le build approche du plafond (≥ 900 fichiers), un avertissement s'affiche ; s'il le dépasse, le
  build **échoue** avec un message clair — y compris dans le déploiement itch.io, avant l'envoi.
- Un build local ne contient plus les 117 icônes d'objets séparées (déjà absentes du build CI).

## Constat (vérifié le 2026-10-09)

| Dossier dans `public/assets/` | Rôle | Livré par la CI itch.io ? | Livré par un build local ? |
|---|---|---|---|
| `sprites/pokemon/` (760 fichiers) | source gitignorée de `sprites.bin` | non (absent du checkout) | non dans `dist/`, **oui** vers un autre `--outDir` |
| `sprites/item-icons/` (117) | source gitignorée de `item-icons.png` (décision 1138) | non (absent du checkout) | **oui**, aucun plugin ne le retire |
| `maps/dev/` (24) | cartes sandbox / atelier / e2e | retiré depuis le plan 235 | retiré (sauf `VITE_E2E`) |

Le jeu ne lit que `item-icons.png` (`view-core/src/sprite-bundle.ts:150`, via `getItemIconSheetUrl()`,
lu par `app/src/team/item-icon-sheet.ts`) : les icônes séparées ne servent qu'à
`scripts/extract-item-icons.ts` → `pack-sprites` (qui les lit au moment du packaging, pas au runtime).
Aucun code runtime ni e2e ne lit `assets/sprites/item-icons/` (vérifié le 2026-10-09).

Chiffres : le `dist/` local (254 fichiers, périmé) contient encore les 117 icônes et les 24 cartes dev,
donc un build post-plan 235 fait ~230 fichiers (254 − 24). Après ce plan : **~113** (254 − 117 − 24).
Estimation à mesurer, pas une valeur à reproduire à l'identique.

Attribution : les `credits.txt` par Pokémon vivent dans `sprites/pokemon/`, **gitignoré**
(`.gitignore:47`) : ils ne sont donc PAS dans le dépôt, contrairement à ce que dit le commentaire de
`vite.config.ts` (l. 75-77). L'attribution réelle tient à l'écran Crédits (PMDCollab, `i18n/locales/*.ts`)
et à `CREDITS.md`, dont le chemin `packages/renderer/public/...` est périmé (`packages/app` aujourd'hui).

## Ce qu'on fait (`packages/app/vite.config.ts` seulement)

1. **Un seul plugin `stripNonShippedAssetsPlugin`** remplace `stripPerPokemonSpriteFoldersPlugin` et
   `stripDevMapsPlugin`. Il lit le vrai dossier de sortie (`configResolved` → `config.build.outDir`),
   et retire une liste déclarée :
   - `assets/sprites/pokemon` (toujours) ;
   - `assets/sprites/item-icons` (toujours) — nouveau ;
   - `assets/maps/dev` (sauf build `VITE_E2E=true`).
   Les commentaires des deux anciens plugins (pourquoi chaque dossier ne part pas) sont conservés
   dans la liste, **avec une correction** : le commentaire actuel affirme que `credits.txt` « reste dans
   le dépôt » — faux (dossier gitignoré). Le réécrire pour dire où vit l'attribution réelle.
   Chaque retrait est précédé d'un `existsSync` : un `--outDir` absent ne doit pas faire planter le plugin.
2. **Garde-fou du plafond**, dans le même `closeBundle`, après le nettoyage : compte les fichiers du
   dossier de sortie, affiche le total, avertit à partir de 900, **lève une erreur** au-delà de 1000
   (le build échoue). Constantes nommées (`ITCH_FILE_LIMIT`, `ITCH_FILE_WARNING`). Ignoré en build
   `VITE_E2E` (jamais publié, garde les cartes de dev).
   Mécanisme (lu dans le code, Vite 8.2.2 / rolldown 1.2.7, non exécuté) : `build()` appelle
   `bundle.close()` dans son `finally`, après `bundle.write()` ; une erreur levée dans `closeBundle` fait
   rejeter `build()`, et le CLI fait `process.exit(1)`. Conséquences : la ligne `✓ built` s'affiche AVANT
   l'erreur ; les fichiers sont déjà écrits dans `dist/` au moment de l'échec ; l'étape `butler` du
   workflow itch est sautée (échec de step).
   Le comptage inclut `dist/stats.html` si `BUNDLE_VISUALIZE=1` : le plugin visualizer écrit
   `filename` relativement à `process.cwd()` (donc `packages/app/dist/` par défaut), en `generateBundle`,
   avant `closeBundle`. Voir arbitrage A.

## Hors périmètre

- `pokemon-tactics.tiled-project` (fichier de projet Tiled, 3 Ko) reste livré sauf demande.
- Aucune dépendance, aucun changement de tsconfig ni de workflow CI (le garde-fou vit dans le build,
  que le workflow itch lance déjà).

## Vérification

- `vite build` vers `dist/` **et** vers un `--outDir` de travail : même nombre de fichiers (~113,
  estimation, à mesurer), sans `sprites/pokemon`, `sprites/item-icons`, `maps/dev`.
- Code de sortie : `pnpm --filter @pokemon-tactic/app build; echo $status` (fish) = 0 au nominal.
  Ne pas se fier à la seule ligne affichée.
- Build `VITE_E2E=true` : `maps/dev/` présent, pas de contrôle de plafond.
- Garde-fou : abaisser temporairement la limite en local pour voir l'avertissement puis l'échec.
- Le gate (`/ci-gate full`) au menu de finalisation.
- Builds touchés par le garde-fou (aucun n'est modifié) : `ci-gate` (`pnpm build`, prod),
  `itch-deploy.yml` (`pnpm build`, `ITCH_DEPLOY=true`), `deploy.yml` (GitHub Pages, `pnpm build`),
  e2e (`playwright.config.ts` : `pnpm --filter app build` avec `VITE_E2E=true`, donc garde-fou ignoré).
  `playwright.capture.config.ts` lance `vite dev`, pas de build : hors d'atteinte.
  `pnpm build` racine = `pnpm -r build` : seul `packages/app` a un script `build`.

## Étapes

- [ ] 1. `vite.config.ts` : remplacer les deux plugins par `stripNonShippedAssetsPlugin` (`apply: "build"`,
  `configResolved` → `config.build.outDir`), liste déclarée des trois dossiers, `existsSync` avant retrait,
  commentaires corrigés (voir Constat).
- [ ] 2. Même `closeBundle` : constantes `ITCH_FILE_LIMIT = 1000` et `ITCH_FILE_WARNING = 900`,
  comptage récursif de `outDir` (absent → 0, sans erreur), ligne `N fichiers dans le build (plafond itch.io : 1000)`,
  avertissement à partir de 900, `throw new Error` au-delà de 1000, ignoré si `VITE_E2E === "true"`.
- [ ] 3. Vérifier le build prod vers `dist/` puis vers un `--outDir` de travail (même total, trois dossiers absents,
  code de sortie 0).
- [ ] 4. Vérifier le build `VITE_E2E=true` : `assets/maps/dev/` présent, aucune ligne de plafond.
- [ ] 5. Vérifier le garde-fou : limite abaissée temporairement → avertissement, puis échec avec code ≠ 0 ;
  restaurer 1000 avant commit.
- [ ] 6. Arbitrages A et B tranchés par l'humain (voir ci-dessous) avant l'étape 2.
- [ ] 7. `/ci-gate full` au menu de finalisation (hors dev).

## Arbitrages (à trancher)

- **A. `stats.html`** (`BUNDLE_VISUALIZE=1`) : (a) compté, +1 sur ce build non publié — simple, recommandé ;
  (b) exclu explicitement du décompte.
- **B. Portée du garde-fou** : (a) toutes les prod (`ci-gate`, itch, Pages) — recommandé, la gate le voit tôt ;
  le message doit alors nommer itch.io comme raison ; (b) seulement si `ITCH_DEPLOY` — un échec sur Pages serait
  alors impossible, mais la gate ne le verrait pas.

## Critères de complétion

- Build prod sans `sprites/pokemon`, `sprites/item-icons`, `maps/dev` ; total affiché et cohérent entre `dist/`
  et un `--outDir` de travail.
- Build `VITE_E2E=true` garde `maps/dev/`, sans contrôle de plafond.
- Échec démontré (code ≠ 0) avec une limite abaissée, puis limite restaurée.
- Aucun changement de workflow, de `tsconfig` ni de dépendance.
- En jeu : crédits, écran objets et icônes d'objets inchangés (`item-icons.png` toujours chargé).

## Risques / Questions

- Le plafond compte tout ce qui est dans le dossier de sortie : un fichier ajouté plus tard (ex. `stats.html`) pèse.
- Un échec dans `closeBundle` arrive après l'écriture de `dist/` : le dossier local reste plein, seul le
  déploiement est bloqué. Comportement natif rolldown non vérifié dans le code source : à valider par l'étape 5.
- Hors périmètre, même famille de bug cwd : `build.rollupOptions.input: resolve(process.cwd(), "index.html")`
  (fonctionne car le build part de `packages/app`). À corriger par `config.root` si on veut des builds depuis la racine.
- Tests unitaires `view-core/src/battle-views.test.ts` et `combat-preview-view.test.ts` mockent
  `assets/sprites/item-icons/${itemId}.png` : chemin de fichier individuel qui n'existe plus au runtime. Mock seulement, aucun effet build ; à nettoyer plus tard.
- `CREDITS.md` : chemin `packages/renderer/...` périmé ; la source Showdown des icônes d'objets n'y est pas mentionnée
  (pré-existant, à vérifier avec l'humain). Hors de ce plan, à traiter par `doc-keeper`.

## Dépendances

- Après : plan 235 (sandbox et atelier hors du build prod, `stripDevMapsPlugin`), clos.
- Débloque : le plafond itch.io devient une garde permanente, plus une mesure faite à la main.
