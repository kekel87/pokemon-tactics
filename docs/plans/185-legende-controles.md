# Plan 185 — Légende de contrôles près de la boussole

> **Statut** : ready (revues plan + design passées le 2026-08-24, corrections intégrées)
> **Créé** : 2026-08-24
> **Phase** : suite directe du Lot 2 (plan 184), hors phase — chantier de découvrabilité
> **Cadre** : `docs/next.md` § Reporté, « Chantier dédié : légende de contrôles près de la boussole » (demandé 2026-08-21 pendant la validation du plan 184)
> **Recherche préalable** : MDN `Keyboard.getLayoutMap()` (2026-08-24) — expérimental, **contexte sécurisé requis**, peut lever `SecurityError` (permission policy), absent de Firefox et Safari ; relevé de la feuille Kenney à l'`magick` (étape A, **déjà fait**, résultats ci-dessous).

## Motivation

À la validation du plan 184, l'humain a relevé un trou net : **aucun raccourci caméra n'est annoncé nulle part**. `A`/`E` (rotation), `1`/`2`/`3` + `R`/`F` (zoom) existent depuis le Lot 2, et rien à l'écran ne les mentionne. Le seul indice d'entrée visible sur le plateau est l'anneau fléché posé à droite de la boussole, qui dit « la boussole se tape » et rien d'autre.

Le problème n'est pas l'entrée : elle marche. C'est la **découvrabilité**. Un joueur qui ne lit pas de manuel ne saura jamais qu'il peut tourner la caméra au clavier.

## Décisions actées (humain, 2026-08-24)

| # | Question | Décision |
|---|---|---|
| 1 | Périmètre | **Légende seule.** L'écran de remapping part dans un plan dédié **après** — contrairement au regroupement noté le 2026-08-21, qui liait les deux. |
| 2 | Où vit le glyphe « ça se clique » | **Tout en DOM.** Le mesh anneau (`COMPASS_ROTATE_GLYPH_*`, `compass_rotate_hint`) est **supprimé** ; la légende DOM porte le glyphe souris/doigt sur sa première ligne. Un seul chemin de rendu de glyphe, zéro plomberie `InputSource` → renderer. |
| 3 | Lettre affichée pour la rotation | **`getLayoutMap()` + repli sur la langue du jeu.** Les bindings sont par position (`KeyQ`), donc la lettre dépend de la disposition : A en AZERTY, Q en QWERTY. |
| 4 | Permanence | **Permanente et discrète** : toujours visible, alpha réduit comme l'ancien glyphe de boussole, `pointer-events: none`. Un réglage on/off a été **écarté** ; la revue design le remet sur la table (§ Revues), il reste réouvrable après test. |
| 5 | Rendu | **Glyphes seuls, aucun libellé** — glyphe d'action + capuchons de touches en pixel-art 1 bit. Une seule chaîne à traduire : « pincer » au doigt. |
| 6 | Zone tapable de la boussole | **Carré, plancher 44 px.** Le proxy de picking perd son extension vers la droite (elle n'existait que pour englober le mesh anneau). La légende DOM reste inerte. |

## Maquette validée

```
CLAVIER / SOURIS            DOIGT                      MANETTE

 [boussole]  🖱              [boussole]  ☝              [boussole]
            ⟲ □A □E                    (masquée)                  ⟲ □LB □RB
            □R + □F −                ☝ pincer                     □LT + □RT −
```

- **Ligne 1** — souris (9,3) ou main-curseur (0,17) : « la boussole se clique / se tape ». Masquée à la manette : aucune boussole à cliquer avec un pad.
- **Ligne 2 — rotation** : anneau fléché (27,19) + les deux capuchons. **Masquée au doigt** : la boussole s'en charge, et il n'y a pas de touche.
- **Ligne 3 — zoom** : la feuille n'a **aucune loupe** (comme elle n'a aucun glyphe tactile). Donc pas de glyphe d'action : chaque capuchon est suivi de son signe `+` / `−` **hors capuchon** — un capuchon `+` se lirait « presse la touche + », qui n'est justement pas un binding (plan 184 a écarté `Minus`/`Equal`, dont la position porte `)` en AZERTY). Au doigt : main + « pincer ».

## État des lieux vérifié dans le code (2026-08-24)

| Brique | Où | Ce qu'on en fait |
|---|---|---|
| Mesure de la 1ʳᵉ case de timeline | `packages/ui-dom/src/chrome-insets.ts` (`CHROME_CLEARANCE_PX = 6`) | **Inchangée** (elle sert au mesh boussole), mais la constante devient **exportée** — la légende doit utiliser le même dégagement. |
| Mesh anneau + son proxy étendu | `packages/render-babylon/src/babylon-compass.ts` | **Supprimés** (décisions 2 + 6). |
| Glyphe de la ligne d'instruction | `packages/ui-dom/src/input-prompt-glyph.ts` + `.bc-input-glyph*` (`styles/battle-chrome.css`) | **Modèle à réutiliser** : `mask-image` sur la feuille partagée, coordonnées en custom properties, `image-rendering: pixelated`, URL injectée par l'hôte. |
| Glyphe de touche d'« Annuler » | `.bc-btn-key` | **Modèle de capuchon** : une tuile, `0.9em`, masqué au doigt. |
| Source d'entrée active | `input-source.ts` → attribut `data-input-source` sur la racine (`input-system.ts`) | **Réutilisé tel quel** : la légende change d'aspect par CSS, sans re-render. |
| Bindings caméra | `keyboard-source.ts` (`KeyQ`/`KeyE`, `Digit1-3`, `KeyR`/`KeyF`), `gamepad-source.ts` (LB/RB, LT/RT) | **Source de vérité** : les codes viennent de là, jamais recopiés. |
| Case active de la timeline | `turn-timeline.ts` — `activeSlot.replaceChildren()` **à chaque tour** | Doit devenir un **hôte stable** ; voir étape C. |

### Ancrage — pourquoi la légende n'a pas besoin de `chrome-insets`

La note de `docs/next.md` prévoyait de réutiliser la mesure de `chrome-insets.ts`. **Inutile** : cette mesure existe parce que la boussole est un *mesh* placé par arithmétique de pixels. La légende est du DOM — elle peut être **fille absolue de l'élément qu'elle longe**.

La boussole est épinglée au **bord droit** de `.tt-active`, à son **top**, avec un côté égal à sa **hauteur**. Donc :

```css
.bc-control-legend {
  position: absolute;
  inset-inline-start: calc(100% + var(--bc-legend-clearance));
  inset-block-start: calc(100% + var(--bc-legend-clearance));
}
```

Exact par construction, sans mesure JS, sans écriture DOM par frame, et ça suit la boussole à toute taille de scène.

⚠️ Trois garde-fous :
- `.tt-active` passe en **`position: relative`** (étape D) — c'est un `display: flex; flex: 0 0 auto`, l'ajout est inoffensif.
- L'enfant reste **hors du flux**. Un enfant statique changerait la boîte de `.tt-active`, que le `ResizeObserver` de `chrome-insets` observe → la boussole se redimensionnerait à cause de sa propre légende.
- Aucun ancêtre ne coupe le débordement : `.tt-timeline` et `.bc-left-col` n'ont pas d'`overflow` (seul `.tt-list`, qui est un **frère**).

### Limite assumée : timeline masquée = légende masquée

`turn-timeline.ts` fait `root.hidden = true` quand il n'y a aucune entrée (avant le premier tour, phase de placement). La légende, fille de la timeline, disparaît alors — et la boussole, elle, retombe sur son ancrage de repli (`COMPASS_LEFT_FRACTION`/`COMPASS_TOP_FRACTION`) puisque `firstCell()` renvoie `null`.

**Assumé** : suivre la boussole dans ce cas voudrait dire répliquer l'arithmétique du renderer côté DOM, exactement ce que l'ancrage évite. La légende apparaît donc avec la timeline, au premier tour. À confirmer au human-testing : est-ce que la phase de placement paraît amputée ?

## Étapes

### A — Relever les tuiles de la feuille — **FAIT (2026-08-24)**

Relevé à l'`magick` par bandes, agrandissement 600-700 % au plus proche voisin. Les capuchons sont rangés **par position physique QWERTY** :

| Ligne | Colonnes | Contenu |
|---|---|---|
| 1 | 17 → 31 | `1 2 3 4 5 6 7 8 9 0 − + = _ !` puis (32-33) retour arrière sur 2 tuiles |
| 2 | 17 → 31 | `Q W E R T Y U I O P [ ] { } \` puis (32-33) Entrée sur 2 tuiles |
| 3 | 17 → 31 | `+ A S D F G H J K L ' " : ; ×` |
| 4 | 17 → 33 | `⎵ ⠿ Z X C V B N M < > ? /` puis capuchons de flèches |

- Lettres du plan : `A` = (18,3) · `E` = (19,2) · `Q` = (17,2) · `R` = (20,2) · `F` = (21,3)
- Chiffres : `1` = (17,1) · `2` = (18,1) · `3` = (19,1)
- Gâchettes/bumpers, contour (ligne 16) et plein (ligne 17) : `LT` = col 7 · `RT` = col 8 · `LB` = col 9 · `RB` = col 10. On prend le **contour (ligne 16)**, comme le bouton A déjà en service (4,0) qui est un cercle en contour.
- Déjà en service : souris (9,3), main (0,17), anneau fléché (27,19).
- Variantes de rotation autour de l'anneau : (28,19) → (31,19) — candidates pour une **paire miroir** gauche/droite. Le sens perçu **ne se lit pas sur la planche** (leçon du 2026-08-20 : la première tuile choisie par géométrie se lisait à l'envers en jeu) → une seule tuile d'abord, la paire miroir proposée à l'humain **en jeu**, pas sur maquette.
- Flèches 4 directions (pan) : (33,18) contour / (33,19) plein — **hors périmètre**, noté pour plus tard.
- ⚠️ **Aucune loupe, aucun glyphe de zoom** sur la feuille → décision de maquette ci-dessus.

Reste à faire dans cette étape : **verser ce relevé dans `docs/references/kenney-input-prompts-tileset.md`** — table Markdown `caractère → (colonne, ligne)` dans le style de la section « Tuiles utilisées par le jeu » existante, les 26 lettres + les 10 chiffres + les 4 gâchettes (le futur plan de remapping en aura besoin pour une touche arbitraire).

### B — Étiquette d'une touche (`packages/app/src/input/key-legend.ts`)

```ts
/** Lance la résolution de la disposition. Appelée une fois au boot, à côté de `initInputSystem`. */
export function resolveKeyLabels(language: Language): Promise<void>;
/** Étiquette à dessiner pour un `code`. Synchrone : repli tant que (ou si) la résolution n'a pas eu lieu. */
export function keyLabel(code: string): string;
```

- `navigator.keyboard?.getLayoutMap()` sous `try/catch` : l'API est **absente** de Firefox/Safari (`navigator.keyboard === undefined`) et peut lever `SecurityError` sous permission policy. Elle exige un **contexte sécurisé** — vrai sur `localhost`, GitHub Pages et itch, donc pas un frein.
- Filtre : on ne retient qu'une valeur d'**un seul caractère** dont la majuscule tombe dans `A-Z0-9`. Une disposition cyrillique ou grecque renverrait une lettre absente de la feuille → repli.
- Table de repli **complète** (les seuls codes que la légende dessine) :

| `code` | repli `fr` | repli `en` | identique aux deux dispositions ? |
|---|---|---|---|
| `KeyQ` | `A` | `Q` | **non** — le seul qui diverge |
| `KeyE` | `E` | `E` | oui |
| `KeyR` | `R` | `R` | oui |
| `KeyF` | `F` | `F` | oui |
| `Digit1/2/3` | `1`/`2`/`3` | `1`/`2`/`3` | oui (hors périmètre de la maquette, mais la table les couvre) |

- Test unitaire `key-legend.test.ts` (fonctions pures, pas de DOM — `ui-dom`/`app` n'ont pas d'environnement DOM en unit) : API absente → repli ; API qui lève → repli ; valeur multi-caractères ou non latine → repli ; valeur Chromium normale (`"a"` → `A`) ; langue `en` → `Q` pour `KeyQ`.
- **Course connue et assumée** : la promesse part au boot, la légende est construite à l'entrée en combat (splash → menu → sélection d'équipe avant), donc en pratique elle est résolue. Sinon la légende montre le repli de langue pour ce combat-là. Pas de re-render : ça coûterait un canal `app` → `ui-dom` pour un cas qui ne se produit pas.

### C — Le composant (`packages/ui-dom/src/control-legend.ts`) — *dépend de B*

**Hôte stable, tranché** : aujourd'hui `turn-timeline.ts` appelle `activeSlot.replaceChildren()` à chaque tour, donc une fille de `.tt-active` serait détruite au premier tour. On **découpe la case active en deux** :

- `.tt-active` devient un **hôte stable** : plus jamais vidé, `position: relative`, c'est lui que `chrome-insets` continue d'observer (sa boîte est inchangée, il enveloppe toujours le portrait au plus juste) ;
- une fille interne `.tt-active-portrait` reçoit désormais le `replaceChildren()` du portrait actif ;
- `TurnTimeline` expose `readonly anchor: HTMLElement` (l'hôte stable) — `battle-chrome.ts` y insère la légende. Une propriété plutôt qu'un `querySelector` depuis le chrome : la timeline reste propriétaire de sa structure.

Le composant lui-même :

- `createControlLegend(config)` → `{ element }`. Trois lignes, chacune `[glyphe d'action?][capuchon + signe]…`, `aria-hidden="true"` (décoratif ; l'a11y lecteur d'écran est hors périmètre, décision #752).
- `data-testid` (harnais e2e, cf. `.claude/rules/e2e.md`) : `control-legend` sur la racine, `control-legend-tap` / `control-legend-rotate` / `control-legend-zoom` sur les trois lignes.
- `ui-dom` ne peut pas importer `packages/app` : l'hôte passe les étiquettes. Nouveau membre de `UiDomConfig` :
  ```ts
  /** Étiquette de touche à dessiner pour un `KeyboardEvent.code` (dépend de la disposition). */
  getKeyLabel(code: string): string;
  ```
  Câblé dans `combat-screen.ts` sur `keyLabel` de l'étape B, comme les autres accès de config.
- La lettre est traduite en coordonnées de tuile par une table `CHARACTER_TILE` interne au composant (relevé de l'étape A). Caractère inconnu → la ligne se replie sur le capuchon générique déjà en service (17,4).
- « pincer » passe par `config.translate("controls.pinch")` (clés `fr` + `en` + `types.ts`).
- `--bc-legend-clearance` est posée **en JS à la construction**, depuis la constante exportée : `element.style.setProperty("--bc-legend-clearance", \`${CHROME_CLEARANCE_PX}px\`)` — même patron que l'URL de la feuille. Une seule constante pour le dégagement du mesh et celui du DOM, impossible de les faire diverger.

### D — Le style (`packages/ui-dom/src/styles/control-legend.css`)

- `.tt-active { position: relative; }` (dans `turn-timeline.css`) + le positionnement absolu décrit en « Ancrage ».
- Capuchons et glyphes : patron de `.bc-btn-key` — masque sur la feuille, `background-color: currentcolor`, `image-rendering: pixelated`, taille en `em`, coordonnées en custom properties.
- ⚠️ **Jamais** de `calc(longueur / longueur)` (décision #775 : accepté par Chromium, toute la déclaration jetée par Firefox, sans erreur console).
- Alpha `0.72` repris de l'ancien mesh, `pointer-events: none`.
- Visibilité par source — **même ordre de précédence que `.bc-input-glyph`** : la requête média est le défaut « rien d'observé encore », `data-input-source` surcharge.

```css
.bc-control-legend-rotate { /* visible par défaut (souris/clavier) */ }

@media (pointer: coarse) {
  .bc-control-legend-rotate { display: none; }        /* la boussole s'en charge */
}
:where([data-input-source="touch"]) .bc-control-legend-rotate { display: none; }
:where([data-input-source="keyboard"]) .bc-control-legend-rotate { display: flex; }
:where([data-input-source="gamepad"]) .bc-control-legend-tap { display: none; }
```

| | Ligne 1 (clic/tap) | Ligne 2 (rotation) | Ligne 3 (zoom) |
|---|---|---|---|
| souris (défaut fin) | souris (9,3) | ⟲ + `A` `E` | `R` + / `F` − |
| doigt (`pointer: coarse`, `touch`) | main (0,17) | **masquée** | main + « pincer » |
| clavier | souris (9,3) | ⟲ + `A` `E` | `R` + / `F` − |
| manette | **masquée** | ⟲ + `LB` `RB` | `LT` + / `RT` − |

### E — Retirer le mesh anneau

Dans `babylon-compass.ts` : `createRotateHint`, le champ `rotateHint`, son bloc dans `pinToCorner`, son `dispose`, les constantes `COMPASS_ROTATE_GLYPH_*` et `INPUT_PROMPT_SHEET_*`. Le proxy de picking redevient un **carré** : `hitWidthPx = hitHeightPx = max(footprintPx, COMPASS_MIN_HIT_PX)`, sans `proxyOffsetX`. Vérifier les imports devenus morts (`Texture` sûrement ; `StandardMaterial` reste utilisé par le mesh boussole).

Zéro tolérance au code mort : la section **« Deuxième chemin de rendu : dans la scène Babylon »** de `docs/references/kenney-input-prompts-tileset.md` disparaît avec lui (UV flipées, `NEAREST`, alpha-blend, demi-pas de 8 px), remplacée par une ligne d'historique — la contrainte de demi-pas (décision #774) n'a plus de sujet.

### F — Tests

`e2e/tests/combat/compass-rotate-hint.spec.ts` (190 lignes, 4 tests) → renommé `compass-and-legend.spec.ts`. Sort de chaque test existant :

| Test actuel | Sort |
|---|---|
| « glyphe posé à droite de la boussole » (interroge `meshInfo("compass_rotate_hint")`) | **Supprimé** — le mesh n'existe plus. Remplacé par l'assertion DOM « légende posée sous la boussole ». |
| « la zone tapable couvre le glyphe » (`meshViewportBox(HINT)`) | **Réécrit** : la zone tapable est un **carré** — côté = `max(hauteur du portrait, 44)`, et son **bord droit ne dépasse plus** le bord droit de la boussole (contre-épreuve directe de l'étape E). Signaux : `meshScreenBox("compass")` + `meshViewportBox("compass_pick_proxy")`, tous deux déjà exposés par le hook. |
| « cliquer le glyphe fait tourner la vue » | **Réécrit** : le clic tombe au **centre de la boussole** (`meshViewportBox("compass_pick_proxy")`), plus sur le glyphe. Le signal de rotation est inchangé : la position **monde** du mesh boussole, reprojetée à chaque frame, qui ne bouge que quand la caméra tourne. |
| « cliquer juste sous la boussole ne tourne pas » | **Conservé**, la borne devient le bas du carré (la contre-épreuve reste dans le même test). |

Ajouts, en DOM cette fois (locators, plus de projection de mesh) :

- la légende est visible et posée **sous** la boussole : comparaison de boîtes — `boundingBox()` de `[data-testid="control-legend"]` contre `meshViewportBox("compass")` (bord haut de la légende sous le bord bas de la boussole, bords gauches alignés au dégagement près) ;
- les lignes attendues par source, en pilotant `data-input-source` par une **vraie entrée** (une frappe clavier, un tap via `tapTile`) et non en écrivant l'attribut : ligne 1 masquée à la manette, ligne 2 masquée au doigt ;
- **ligne rotation absente** sur le projet mobile ;
- les capuchons portent les bonnes tuiles. Playwright **peut** lire une custom property — `locator.evaluate(el => getComputedStyle(el).getPropertyValue("--bc-glyph-col"))` — donc l'assertion est une valeur, pas une capture d'écran ;
- la boussole **ne change pas de taille** quand la légende est montée (garde-fou de l'ancrage : le test de taille existant face au portrait est conservé).

Restent 👁 : le dessin des tuiles, le sens perçu de l'anneau, la lecture au doigt sur téléphone réel.

Unit : `key-legend.test.ts` (étape B). Rien d'autre — le DOM est couvert par l'e2e.

### G — Docs

- `docs/references/kenney-input-prompts-tileset.md` : table des caractères (étape A), tuiles utilisées mises à jour, second chemin de rendu Babylon retiré (étape E).
- `docs/design-system.md` : la légende rejoint la section des glyphes d'entrée.
- `docs/test-plan.md` §4.18 (l. 726-797) + tableau §11 (~l. 2896-2998) : le spec change de nom et de contenu.
- `docs/decisions.md`, à partir de **#792** : légende en DOM plutôt qu'en mesh (et ce que ça retire) ; `getLayoutMap` + repli langue, avec le piège « la tuile est une position QWERTY, la lettre affichée est une disposition » ; ancrage par enfant absolu plutôt que par mesure JS ; case active de la timeline découpée en hôte stable + fille reconstruite ; zone tapable redevenue carrée ; absence de loupe sur la feuille → signes hors capuchon.
- `docs/next.md`, `STATUS.md`, `docs/roadmap.md` : chantier clos ; le remapping reste ouvert **seul** (le lien « les deux ensemble » est levé par la décision 1). Ajouter en § Reporté le trou relevé par la revue design (défilement de la timeline, ci-dessous).

## Revues du 2026-08-24

**Revue de plan** — deux bloquants et cinq corrections, tous intégrés ci-dessus : hôte stable tranché (étape C), sort de chacun des 4 tests e2e explicité (étape F), `.tt-active { position: relative }` versé dans les étapes, mécanisme de `--bc-legend-clearance` précisé, table de repli complétée, signatures de l'étape B données, `data-testid` nommés. Un point de la revue était inexact et est corrigé en sens inverse : Playwright **sait** lire une custom property via `getComputedStyle`, aucun screenshot n'est nécessaire.

**Revue design** — aucun bloquant. Retenu :
- **Human-testing** : juger la légende **en même temps que la timeline** (le pire cas — 3 lignes — tombe sur souris/clavier, juste sous l'élément le plus dense du HUD), et poser la question à l'aveugle (« à quoi sert cette ligne ? ») avant de révéler : la maquette a été validée par quelqu'un qui sait déjà que la boussole se clique.
- **R/F plutôt que 1/2/3** : cohérent — `+ −` se lit comme un incrément, pas comme un saut à un cran nommé.
- **Exclusions défendables** : pan caméra (aucun binding clavier, la caméra se recentre seule), Annuler et cycle de cibles (déjà enseignés **au moment utile** par le glyphe de la ligne d'instruction — cette légende ne doit pas les dupliquer).
- **Écart au genre assumé** : FFT/FFTA n'annoncent rien, Triangle Strategy montre des prompts **transitoires**, Into the Breach met tout dans un menu. Notre permanence se justifie par un contexte qu'aucun d'eux n'a : navigateur, pas de manuel, et **trois modalités d'entrée coexistant sur le même appareil** (le cas « téléphone + manette » du plan 184). La revue recommande d'exposer le réglage on/off **dès la livraison** ; l'humain a tranché « permanente » le 2026-08-24 → on livre sans réglage, réouvrable après test.
- **Trou hors périmètre à documenter** : rien n'indique que la liste CT défile (`scrollbar-width: none` est délibéré, et `PageUp`/`PageDown` ne sont annoncés nulle part). Ni cette légende ni aucune décision ne le couvrent → à verser en § Reporté de `docs/next.md`, pas à traiter ici.

## Risques

| Risque | Parade |
|---|---|
| Légende + timeline se lisent comme un fouillis | Alpha 0.72, `pointer-events: none`, et un scénario de human-testing qui juge **les deux ensemble** (revue design). Purement additif : rien à défaire si l'humain dit non. |
| Débordement sur le plateau en scène étroite (téléphone) | Au doigt il ne reste **qu'une ligne**, dans le couloir de la timeline. Revalidation 👁 téléphone réel. |
| La légende change la boîte de `.tt-active` → la boussole grossit | Enfant **absolu** obligatoire + hôte stable qui enveloppe toujours le portrait au plus juste, et un test e2e sur la taille de la boussole. |
| `getLayoutMap()` renvoie une lettre hors feuille | Filtre `A-Z0-9` sur un seul caractère + repli langue + repli capuchon générique (17,4). |
| Zone tapable de la boussole rétrécie (~125 → 79 px de large en 4K) | Conséquence assumée de la décision 6, plancher 44 px conservé. **À revalider au doigt.** |
| Le sens de l'anneau se lit à l'envers (déjà arrivé le 2026-08-20) | Une seule tuile d'abord ; la paire miroir n'est proposée qu'**en jeu**, jamais depuis la planche. |

## Hors périmètre

- **Écran de remapping** — plan dédié après celui-ci (décision 1). La table caractère → tuile de l'étape A est justement ce dont il aura besoin.
- Autres bindings (défilement journal/timeline, `Tab` de cycle de cibles, `1`/`2`/`3` absolus, pan au stick droit) : la légende couvre **la caméra**, la maquette validée s'arrête là. Le manque de découvrabilité du **défilement de la timeline** part en § Reporté (revue design).
- Refonte de l'écran de sélection d'équipe (chantier séparé, `docs/next.md`).

## Sources

- MDN — [`Keyboard.getLayoutMap()`](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap) (consulté 2026-08-24) : expérimental, hors Baseline, contexte sécurisé requis, `SecurityError` possible.
- Relevé `magick` de `tilemap-1bit.png` (2026-08-24, étape A) : capuchons rangés par position physique QWERTY, aucune loupe, aucun glyphe tactile.
- Plan 184 § « Bindings par position », `docs/references/kenney-input-prompts-tileset.md`, décisions #752, #773-775, #791.
