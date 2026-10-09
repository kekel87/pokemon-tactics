# Plan 235 — Sortir l'atelier des attaques et le studio sandbox du bundle de prod

**Statut** : done (2026-10-09, recette humaine validée)
**Origine** : `/next` du 2026-10-09. Question de l'humain : « l'atelier, comme sandbox, n'est pas dans
le bundle de prod, rassure-moi ? ». Vérifié sur un `vite build` réel : **inaccessibles** aux joueurs
(`enabled:!1` figé à la compilation, aucune bascule par URL en prod), mais **leur code est
embarqué** dans `main-*.js` (5,0 Mo) et leur CSS dans `main-*.css`.

## Ce que tu verras à l'écran

- En jeu : **rien ne change**. Menus, combat, multijoueur, tout est identique.
- `pnpm dev:atelier` et `pnpm dev:sandbox` s'ouvrent et marchent exactement comme avant.
- Le build de prod ne contient plus ni l'atelier ni le studio sandbox : `main-*.js` et `main-*.css`
  maigrissent (chiffre avant/après donné à la recette, brut et gzip).

## Cause

`babylon-boot.ts` importe en **statique** `mountMoveWorkshop` (`babylon/move-workshop.ts`) et
`mountSandboxStudio` (`babylon/combat-screen.ts`). La garde est une propriété d'objet exporté
(`atelierBootConfig.enabled`, `sandboxBootConfig.enabled`) : le bundler ne sait pas en déduire que
la branche est morte, donc il garde tout le graphe importé. En plus, `sandbox-boot.ts` importe
`sandbox-studio.css` en tête, et `combat-screen.ts` importe `SandboxPanel` (1050 lignes) en statique.

Règle qui découle de la cause : un `import()` ne disparaît du build que si la condition qui l'entoure
est **littérale** (`import.meta.env.*` directement dans le `if`). Une variable, ou une propriété d'un
objet exporté, le laisse dans le graphe.

## Ce qu'on fait

1. **`sandbox-boot.ts` coupé en deux.** `sandbox-boot.ts` garde `sandboxBootConfig` (et
   `parseSandboxEnvConfig`), sans aucun import de CSS. La partie DOM — `initSandboxStudioDom`,
   `getSandboxStudioDom`, `teardownSandboxStudioDom`, l'interface `SandboxStudioDom`, le cache, et
   `import "./styles/sandbox-studio.css"` — part dans `packages/app/src/sandbox-studio-dom.ts` (nouveau).
   - Consommateurs à rebrancher : `ui/SandboxPanel.ts` l.29 (`getSandboxStudioDom` →
     `../sandbox-studio-dom`) et `babylon/sandbox-studio.ts` (étape 2).
   - 🔴 **`babylon-boot.ts` n'importe PAS `sandbox-studio-dom.ts`.** Son `onExit` appelle aujourd'hui
     `teardownSandboxStudioDom()` (l.205) : cet appel descend dans `dispose()` de `mountSandboxStudio`
     (ordre inchangé : dispose, puis teardown, puis retour au menu). Sinon le CSS et le DOM restent
     statiquement dans `main-*.css` / `main-*.js` et le gain est perdu.

2. **`babylon/sandbox-studio.ts` (nouveau).** Y déménagent, sortis de `combat-screen.ts` :
   `mountSandboxStudio`, `startSandboxBattle`, `resolveSandboxSeed`, `sandboxMapUrl`,
   `SANDBOX_DEFAULT_MAP_URL`, `profileForKey`, `teamPlayerId`, et l'interface `ResolvedSpawn`. Ce sont
   les seuls symboles sans usage hors de la sandbox (vérifié par grep).
   - **Helpers à exporter depuis `combat-screen.ts`** : `runBattle` (déjà exporté, l.497),
     `spawnBillboardsFromState` (déjà, l.1594), `attachPointerSourceForScene` (déjà, l.1828), et
     **`randomSeed` (l.1655), à exporter** : elle n'est pas exportée aujourd'hui et sert aussi au
     placement normal (l.427). L'ancienne liste du plan l'omettait.
   - Il n'existe pas d'export « montage de la scène » ni « sonde d'encarts » : la sonde
     (`createChromeInsetProbe`) et `mountGameStage` viennent directement de `@pokemon-tactic/ui-dom`,
     et `sandbox-studio.ts` les importe de là, comme `combat-screen.ts` le fait déjà.
   - **Cycle** : sens unique `sandbox-studio.ts` → `combat-screen.ts`. `combat-screen.ts` ne doit plus
     importer ni `SandboxPanel`, ni `sandbox-boot`, ni `sandbox-studio-dom`. `babylon/move-workshop.ts`
     importe `combat-screen.ts` et reste inchangé. Aucun cycle.
   - **Imports devenus morts dans `combat-screen.ts`** (à confirmer par `tsc` et Biome, zéro code mort) :
     `DummyAiController`, `createSandboxBattle`, `sandboxInstanceId`, `getSettings`, `Direction`,
     `PlayerId` (valeur), `SandboxPanel`, `initSandboxStudioDom`, et les types `SandboxConfig` et
     `AiProfileKey` s'ils ne servent plus. Restent : `AiTeamController`, `createPrng`, `loadTiledMap`,
     `showLoadingOverlay`, `createChromeInsetProbe`, `mountGameStage` (chemin de combat normal).
   - Commentaire l.493 (« sandbox boot path (`startSandboxBattle`) ») à mettre à jour.

3. **`babylon-boot.ts`** : les deux montages passent par `await import(...)`, derrière des gardes
   **littérales**. Forme attendue (l'ordre compte : la garde `import.meta.env` vient en premier pour
   que Vite replie `false && …` avant tout) :
   ```ts
   if (import.meta.env.VITE_ATELIER) {
     const { mountMoveWorkshop } = await import("./babylon/move-workshop.js");
     mountMoveWorkshop(root, atelierBootConfig.config, backend);
   } else if (
     (import.meta.env.VITE_SANDBOX || import.meta.env.DEV || import.meta.env.VITE_E2E === "true") &&
     sandboxEnabled
   ) {
     const { mountSandboxStudio } = await import("./babylon/sandbox-studio.js");
     // … même corps qu'aujourd'hui, avec dispose() qui fait aussi teardownSandboxStudioDom()
   } else if (query.has("combat")) {
     …
   }
   ```
   - `atelierBootConfig.enabled` disparaît de la condition (même valeur : `Boolean(VITE_ATELIER)`).
     `atelier-boot.ts` reste statique : c'est de la config, quelques lignes.
   - `sandboxBootConfig` (l.132-137) et `resolveSandboxConfig` restent statiques, comme
     `DEFAULT_SANDBOX_CONFIG` et `normalizeSandboxConfig`.
   - **Erreur de chargement** : `void boot(root)` avale une rejection. Un chunk introuvable (déploiement
     pendant une session) doit passer par `reportScreenError` : `.catch(reportScreenError)` sur
     l'`import()`, ou try/catch autour de la branche.
   - Base vérifiée dans la source de Vite (8.2.2, `node_modules/.pnpm/vite@8.2.2_…/dist/node/chunks/node.js`,
     l.25332-25363) : en build, `import.meta.env.*` pour une clé **absente** devient `undefined`
     (règle `define["import.meta.env.*"]`), et les clés présentes (`DEV`, `PROD`, `VITE_E2E` posé par
     Playwright) deviennent leur valeur. Donc `VITE_SANDBOX` non posé → `undefined`, la branche est
     morte et son chunk n'est pas émis. C'est une lecture de source : la mesure de l'étape 4 la confirme
     ou l'infirme.

4. **Mesure** : `vite build` avant/après, en build de prod (sans `VITE_E2E`).
   - Marqueurs **absents** de `dist/` après : `aw-panel`, `atelier-panel`, `atelier.tmj`, `sb-header`,
     `data-sandbox`, `Sandbox Studio`.
   - **Ne pas utiliser `sandbox-flat` comme marqueur** : la chaîne reste dans `DEFAULT_SANDBOX_CONFIG`
     (`packages/view-core/src/sandbox-config.ts` l.110 et l.183), donc dans le bundle de prod.
     Pas non plus `atelier` seul : les clés `atelier.*` restent dans les locales (voir Hors périmètre).
   - Build `VITE_E2E=true` : les chunks sandbox (et atelier si `VITE_ATELIER` est posé) existent.

## Ajout en recette (2026-10-09, demande de l'humain) : cartes de dev hors build

`vite.config.ts` : plugin `stripDevMapsPlugin` (calqué sur `stripPerPokemonSpriteFoldersPlugin`) qui
supprime `assets/maps/dev/` (24 cartes, ~140 Ko) du dossier de sortie d'un build de prod. Le build
e2e (`VITE_E2E=true`) les garde : ses specs les chargent. Le build de prod perd 24 fichiers (~230 au
total, très loin du plafond de 1000 du zip HTML5 itch.io). ⚠️ Un premier chiffre « 1012 → 988 » était
FAUX : mesuré sur un build vers un `--outDir` de travail, où `stripPerPokemonSpriteFoldersPlugin` (qui
vise `process.cwd()/dist` en dur) ne retire pas les 760 fichiers de sprites par Pokémon.

Mesure finale du bundle (build de prod) : `main-*.js` 5 232 545 → 5 188 197 octets (gzip
1 000 288 → 986 530, −13,8 Ko) ; `main-*.css` 115 616 → 103 060 (gzip 19 582 → 17 692, −1,9 Ko).

## Hors périmètre

- Les clés i18n `atelier.*` / `sandbox.*` restent dans les locales (textes, poids négligeable). Elles
  sont dans `main-*.js` : elles ne servent donc pas de marqueur de sortie.
- `DEFAULT_SANDBOX_CONFIG` et sa map `sandbox-flat` restent dans le bundle (utilisés par le boot).
- Aucun changement de tsconfig ni de dépendance.
- Aucun changement de `SandboxPanel.ts` au-delà de son import (l.29).

## Fichiers touchés (liste complète)

- `packages/app/src/sandbox-boot.ts` : réduit à `sandboxBootConfig`.
- `packages/app/src/sandbox-studio-dom.ts` : nouveau (DOM du studio + CSS).
- `packages/app/src/babylon/sandbox-studio.ts` : nouveau (étape 2).
- `packages/app/src/babylon/combat-screen.ts` : retrait des symboles déplacés, export de `randomSeed`,
  nettoyage des imports, commentaire l.493.
- `packages/app/src/babylon-boot.ts` : imports l.38-40 et l.47, bloc de boot l.191-219, `onExit`.
- `packages/app/src/ui/SandboxPanel.ts` : import l.29 seulement.
- `packages/app/index.html` l.67-69 : commentaire qui cite `sandbox-studio.css` (texte seulement).
- `docs/architecture.md` l.784 : `startSandboxBattle` (dans `combat-screen.ts`) → `sandbox-studio.ts`.
  Doc à faire par `doc-keeper`, après le code.

Pas touchés : `atelier-boot.ts`, `babylon/move-workshop.ts` (il importe `combat-screen.ts`, qui reste
en place ; `move-workshop.css` part avec son chunk), `styles/sandbox-studio.css`, `scripts/*`, `e2e/`
(les e2e ne importent aucun des modules concernés : seuls des commentaires citent `SandboxPanel`).

## Vérification

- `typecheck` ; `tsc`/Biome sans import mort dans `combat-screen.ts`.
- Tests unitaires : **aucun** `*.test.ts` n'importe `combat-screen`, `move-workshop`, `sandbox-boot` ni
  `SandboxPanel` (vérifié). Rien d'unitaire à régresser ; le typecheck est le filet.
- E2E : tout le sandbox passe par `?sandbox=` et `?config=` sur un build `VITE_E2E=true`
  (`playwright.config.ts` l.212). La garde `urlSandboxAllowed` ne change pas : le chunk est émis et
  chargé. Les e2e passent au menu de finalisation.
- **Atelier : aucun spec e2e** (`grep atelier e2e/` vide), avant comme après. La recette manuelle de
  `pnpm dev:atelier` est le seul contrôle.
- Recette : un combat normal depuis le menu, `pnpm dev:sandbox`, `pnpm dev:atelier`, et le chiffre du
  bundle avant/après. Recette visuelle du sandbox (le CSS arrive désormais par chunk, voir Risques).

## Risques / Questions

- **Garde mal écrite** (variable ou `sandboxEnabled` seul dans la condition) : le chunk reste dans la
  prod, sans erreur visible. La mesure de l'étape 4 est le seul détecteur.
- **CSS en chunk** : `sandbox-studio.css` n'arrive plus avec `main-*.css`. Le cascade ne change pas : les
  couches sont déclarées dans `layers.css`, importé en premier, donc l'ordre `@layer` est fixe quel que
  soit le moment de chargement. Le golden visuel du sandbox doit quand même repasser (la règle
  `body[data-sandbox]` vit maintenant dans le chunk, chargé avant `initSandboxStudioDom`).
- **Variables d'env au build** : `config.env` de Vite inclut les `VITE_*` présentes dans le shell. Un
  `VITE_SANDBOX` exporté dans le shell au moment d'un `vite build` de prod embarquerait le studio. Risque
  faible (les scripts `dev:*` posent ces variables sur le processus fils seulement), à garder en tête.
- **Latence** : chaque `await import` ajoute un aller-retour au boot dev et e2e. Hors prod, sans
  conséquence pour le joueur.
- Question ouverte (humain) : aucune à ce stade. Les choix de découpe ci-dessus sont des décisions
  techniques internes au plan.
