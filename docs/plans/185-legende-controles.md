# Plan 185 — Légende de contrôles près de la boussole

> **Statut** : done (2026-08-24 — livré, **validé à la main** sur desktop puis sur téléphone réel via tunnel)
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
| 5 | Rendu | **Glyphes seuls, aucun libellé** — dessin + capuchon de touche en pixel-art 1 bit. Aucune chaîne à traduire au final (le « pincer » prévu a disparu au profit d'une main, voir § Retours de test). |
| 6 | Zone tapable de la boussole | **Carré, plancher 44 px.** Le proxy de picking perd son extension vers la droite (elle n'existait que pour englober le mesh anneau). La légende DOM reste inerte. |

## Rendu livré

```
SOURIS / CLAVIER              DOIGT                       MANETTE

 [boussole] 🖱                 [boussole] ☝                 [boussole]
   ⟲ □A   ⟳ □E                   (ligne masquée)              ⟲ □LB  ⟳ □RB
   🔍+ □R  🔍− □F                 🔍+ ✋   🔍− 🤏               🔍+ □RT  🔍− □LT
```

- **« Ça se clique »** à DROITE de la boussole, centré verticalement sur elle. Souris au pointeur fin,
  main au pointeur grossier, **rien** à la manette (aucune boussole à cliquer avec un pad).
- **Une entrée par sens**, et le même ordre de lecture partout : `[dessin][touche]`. La rotation est
  masquée au doigt — la boussole tourne déjà la vue au tap, et il n'y a pas de touche à nommer.
- **Zoom** : les loupes `+` / `−` du pack de curseurs portent le sens ; au doigt elles restent, la
  main écartée / pincée remplaçant le capuchon. À la manette, `RT` zoome avant et `LT` arrière —
  l'ordre des bindings, pas l'ordre de lecture.

## État des lieux vérifié dans le code (2026-08-24)

| Brique | Où | Ce qu'on en fait |
|---|---|---|
| Mesure de la 1ʳᵉ case de timeline | `packages/ui-dom/src/chrome-insets.ts` (`CHROME_CLEARANCE_PX = 6`) | **Inchangée** (elle sert au mesh boussole), mais la constante devient **exportée** — la légende doit utiliser le même dégagement. |
| Mesh anneau + son proxy étendu | `packages/render-babylon/src/babylon-compass.ts` | **Supprimés** (décisions 2 + 6). |
| Glyphe de la ligne d'instruction | `packages/ui-dom/src/input-prompt-glyph.ts` + `.bc-input-glyph*` (`styles/battle-chrome.css`) | **Modèle à réutiliser** : `mask-image` sur la feuille partagée, coordonnées en custom properties, `image-rendering: pixelated`, URL injectée par l'hôte. |
| Glyphe de touche d'« Annuler » | `.bc-btn-key` | **Modèle de capuchon** : une tuile, `0.9em`, masqué au doigt. |
| Source d'entrée active | `input-source.ts` → attribut `data-input-source` sur la racine (`input-system.ts`) | **Réutilisé tel quel** : la légende change d'aspect par CSS, sans re-render. |
| Bindings caméra | `keyboard-source.ts` (`KeyQ`/`KeyE`, `Digit1-3`, `KeyR`/`KeyF`), `gamepad-source.ts` (LB/RB, LT/RT) | **Source de vérité** : les codes viennent de là, jamais recopiés. |
| Case active de la timeline | `turn-timeline.ts` — `activeSlot.replaceChildren()` **à chaque tour**, et vidée pendant une prévisualisation | **Laissée telle quelle** : la légende ne s'y accroche pas (voir § Ancrage). |

### Ancrage — la mesure a un seul propriétaire

**Deux approches ont échoué avant celle qui tient**, et elles valent d'être notées : le raisonnement
« la légende est du DOM, donc elle peut s'ancrer sur le DOM » était juste et le résultat faux.

1. **Fille absolue de la case active de la timeline** (`.tt-active`, `left/top: calc(100% + 6px)`).
   Exact au repos : la boussole est épinglée au bord droit de cette case, avec un côté égal à sa
   hauteur. Mais la case **se vide** pendant une prévisualisation de coût en CT — `buildTimelineView`
   ne pin AUCUNE entrée comme active dans ce mode — sa boîte tombe à 0×0 et la légende s'écrase sur
   la boussole. Bug relevé par l'humain en jouant, invisible au repos.
2. **Réserver cette boîte en CSS** (`min-inline-size`/`min-block-size` reconstruits depuis les
   tokens de taille du portrait). La légende tenait, mais **la boussole a bougé de ~1 px** : elle
   mesure exactement cette boîte, donc reconstruire la taille à côté, c'est en changer une deuxième
   — et l'arithmétique n'était juste ni au pixel ni aux points de rupture mobiles.

**Retenu** : `chrome-insets.ts` reste le **propriétaire unique** de la mesure, et les deux
consommateurs la lisent. La sonde gagne un `subscribe(cell)` — ce dont un consommateur DOM a besoin
et que le renderer n'a pas, lui qui relit `firstCell()` à chaque frame rendue. La légende écrit alors
trois pixels (`--cl-compass-left/top/side`) uniquement quand la mesure change, et se place dessus.

Bénéfice inattendu : le cas de la prévisualisation se règle **tout seul**. La sonde garde son dernier
bon relevé quand la boîte mesurée passe à zéro — le même mécanisme qui gardait déjà la boussole en
place — donc légende et boussole restent immobiles ensemble (vérifié : `dx = dy = 0`).

⚠️ Piège de positionnement rencontré : la racine de la légende est une boîte absolue de taille nulle,
donc un `calc(100% + …)` sur ses enfants ne résout **rien** et les parquait dans le coin de la scène.
Tous les offsets partent des trois pixels mesurés, jamais d'un pourcentage.

### Limite assumée : timeline masquée = légende masquée

`turn-timeline.ts` masque la timeline quand elle n'a aucune entrée (avant le premier tour, phase de
placement) : la sonde ne mesure alors rien et la légende reste cachée jusqu'au premier tour. Suivre la
boussole dans ce cas voudrait dire répliquer son arithmétique de repli côté DOM, exactement ce que
l'ancrage sur la mesure évite.

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

- `createControlLegend(config, insets)` → `{ element }`, monté par `battle-chrome.ts` dans la couche
  écran (`host`), qui partage l'origine de la scène (`#game-overlay` est en `inset: 0`). Le chrome
  crée sa propre sonde `createChromeInsetProbe(host)` : `host` contient la timeline et sert de repère,
  donc la légende n'a besoin d'aucun accès au DOM de la timeline.
- `aria-hidden="true"` : décoratif (l'a11y lecteur d'écran est hors périmètre, décision #752).
- Chaque dessin déclare **sa feuille par classe** (`cl-sheet-prompts` 34×24, `cl-sheet-cursors` 20×11)
  et son `data-testid` : la légende n'a ni rôle ni texte, donc c'est le seul accroche-test légitime, et
  la tuile se lit comme une **valeur** (propriétés personnalisées calculées), pas comme une capture.
- Le rôle d'une entrée (`rotate-left`, `zoom-in`…) part en `data-cl-role`, ce qui permet au CSS de
  nommer le capuchon qu'il remplace à la manette. **Pas de `:nth-of-type`** : tous les enfants d'une
  ligne sont des `<span>`, donc l'index comptait aussi le dessin et décalait chaque capuchon d'un
  cran (bug attrapé au self-check).
- `ui-dom` ne peut pas importer `packages/app` : l'hôte passe les étiquettes de touches via un nouveau
  membre `UiDomConfig.getKeyLabel(code)`, câblé sur `keyLabel` (étape B). La lettre devient une tuile
  par la table `CHARACTER_TILE` ; caractère inconnu → capuchon générique (17,4).

### D — Le style (`packages/ui-dom/src/styles/control-legend.css`)

- Positionnement : voir § Ancrage — trois pixels mesurés (`--cl-compass-left/top/side`), zéro
  pourcentage, zéro `aspect-ratio` déduit.
- Capuchons et dessins : patron de `.bc-btn-key` — masque sur la feuille, `background-color:
  currentcolor`, `image-rendering: pixelated`, coordonnées en propriétés personnalisées. La grille de
  la feuille est elle aussi une propriété, puisque les deux packs n'ont pas la même.
- Taille plancher à **16 px**, une tuile source : en dessous, le plus proche voisin *réduit* le dessin
  1 bit et supprime des rangées entières de pixels — mesuré à 14,6 px sur une petite scène, les
  lettres étaient illisibles. Même plancher que l'ancien mesh.
- ⚠️ **Jamais** de `calc(longueur / longueur)` (décision #775 : accepté par Chromium, toute la
  déclaration jetée par Firefox, sans erreur console).
- Visibilité par source — **même ordre de précédence que `.bc-input-glyph`** : la requête média est le
  défaut « rien d'observé encore », `data-input-source` surcharge (c'est ce qui fait qu'une manette
  branchée sur un téléphone rhabille la légende sans re-render).

### E — Retirer le mesh anneau

Dans `babylon-compass.ts` : `createRotateHint`, le champ `rotateHint`, son bloc dans `pinToCorner`,
son `dispose`, les constantes `COMPASS_ROTATE_GLYPH_*` / `INPUT_PROMPT_SHEET_*` et l'import `Texture`
devenu mort. Le proxy de picking redevient un **carré** de côté `max(footprint, 44)` — mais qui croît
toujours **vers la droite seulement** : centré sur l'aiguille, son bord gauche passait ~4 px À
L'INTÉRIEUR du portrait de la timeline (mesuré en e2e), ce qui rendait un tap au bord du portrait
capable de tourner la caméra. C'est la raison qui interdisait déjà la croissance vers la gauche.

La section « Deuxième chemin de rendu : dans la scène Babylon » du doc de référence disparaît avec le
mesh (UV flipées, `NEAREST`, alpha-blend, demi-pas de 8 px) — la contrainte de demi-pas (décision
#774) n'a plus de sujet.

### F — Tests

`compass-rotate-hint.spec.ts` → `compass-and-legend.spec.ts`, **6 tests verts** :

| Test | Ce qu'il tient |
|---|---|
| zone tapable carrée ancrée sur le portrait | côté = `max(hauteur du portrait, 44)`, bord gauche = bord droit du portrait + dégagement (donc pas de croissance vers la gauche) |
| cliquer la boussole fait tourner la vue | vraie pression souris ; **signal = position monde du PROXY**, pas du mesh `compass` : celui-ci est enfant du nœud racine, donc sa `position` est locale et vaut (0,0,0) à jamais — piège qui a fait échouer la première version du test |
| cliquer sous la boussole ne tourne pas | avec contre-épreuve dans le même test |
| légende posée à droite et sous la boussole | comparaison de boîtes contre le **carré de la boussole** reconstruit depuis le portrait, pas contre le proxy (qui peut être plus grand à cause du plancher tactile) |
| la légende suit la source d'entrée | pilotée par une vraie frappe puis un vrai tap (`tapTile` émet un `pointerType: "touch"`) ; vérifie aussi les tuiles des gestes |
| la légende ne bouge pas quand la timeline perd son entrée active | rejoue la prévisualisation de coût en CT — le bug relevé par l'humain |

`input-prompt-glyph.spec.ts` gagne 2 tests (feuille input-prompts en pointeur fin, feuille de curseurs
au doigt) → **12 verts**. Unit : `key-legend.test.ts`, **6 verts**.

Restent 👁 : le dessin des tuiles, le sens perçu des flèches de rotation, la lecture au doigt sur
téléphone réel.

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

## Retours de test (humain, 2026-08-24)

La première version livrée suivait la maquette validée (trois lignes empilées sous la boussole,
capuchon + signe `+`/`−`, mains du pack input-prompts). Six retours l'ont refaite :

1. **le glyphe « ça se clique » part à DROITE de la boussole**, centré verticalement, au lieu d'être
   la première ligne de la pile ;
2. **une entrée par sens de rotation** au lieu d'un anneau partagé ;
3. **intégration du pack Kenney `cursor-pixel-pack`** (CC0) pour ses **loupes `+` / `−`** — la feuille
   input-prompts n'a aucune loupe, ce qui avait forcé le contournement « capuchon + signe » ;
4. **même ordre partout** : `[dessin][touche]` sur les deux lignes ;
5. **zoom tactile aligné sur deux icônes** (le pack a une paire pincement / écartement), ce qui a fait
   disparaître le mot « pincer » — et donc la clé i18n `controls.pinch`, jamais livrée ;
6. **le tap du nouveau pack remplace l'ancien PARTOUT**, ligne d'instruction comprise.

Puis, après un second passage : les loupes doivent **rester** sur la ligne tactile, la main disant le
geste et la loupe le sens — donc `[loupe][main]`, la même forme que `[loupe][touche]`.

### Intégration du pack de curseurs

Le pack dessine des **lignes blanches dans un contour noir opaque**. En masque CSS, seul l'alpha
compte : contour et remplissage étant tous deux opaques, chaque icône devenait un **pâté**. La
variante commitée (`packages/app/public/assets/ui/cursors/tilemap-1bit.png`, 3 Ko) ne garde que les
pixels **non noirs**, peints en blanc — même contrat que la feuille input-prompts, détail préservé
(vérifié à la loupe avant intégration). L'original n'est pas commité.

### Deux bugs trouvés pendant les tests

- **Légende écrasée sur la boussole pendant une prévisualisation de coût en CT** — cause et correctif
  en § Ancrage. Relevé par l'humain en jouant, invisible au repos.
- **Liseré de focus jaune autour de toute la scène de combat** (hors périmètre de ce plan, corrigé au
  passage). Babylon stampe `tabindex="1"` sur le canvas : celui-ci devenait le **premier arrêt de
  tabulation** de la page (un `tabindex` positif passe devant tout, ce que `.claude/rules/html.md`
  interdit) et le liseré `:focus-visible` global — posé au plan 184 — l'entourait dès qu'il prenait le
  focus. Corrigé par `canvas.tabIndex = -1` **après `new Scene(...)`** (c'est le constructeur de
  `Scene` qui attache l'entrée et stampe l'attribut : le poser après `new Engine(...)` est écrasé
  silencieusement, mesuré) + `#game-canvas:focus { outline: none }` en ceinture et bretelles.

## Risques

| Risque | Sort |
|---|---|
| Légende + timeline se lisent comme un fouillis | **Levé** : validé à la main sur desktop puis sur téléphone réel, la légende jugée en place, pas en isolation. Purement additive de toute façon. |
| Débordement sur le plateau en scène étroite (téléphone) | **Levé** au test sur téléphone réel : au doigt il ne reste qu'une ligne, dans le couloir de la timeline. |
| La légende change la boîte que la boussole mesure | **Arrivé**, puis levé : c'est le deuxième échec du § Ancrage. La légende ne touche plus au DOM de la timeline, un test e2e garde la géométrie. |
| `getLayoutMap()` renvoie une lettre hors feuille | Filtre `A-Z0-9` sur un seul caractère + repli langue + repli capuchon générique (17,4), couvert par le test unitaire. |
| Zone tapable de la boussole rétrécie (~125 → 79 px de large en 4K) | Conséquence assumée de la décision 6, plancher 44 px conservé, croissance vers la droite préservée. Validé au doigt sur téléphone réel. |
| Le sens des flèches de rotation se lit à l'envers (déjà arrivé le 2026-08-20) | Paire miroir proposée **en jeu**, jamais depuis la planche : validée telle quelle par l'humain. Permuter les deux colonnes du CSS suffirait si ça se retournait. |

## Hors périmètre

- **Écran de remapping** — plan dédié après celui-ci (décision 1). La table caractère → tuile de l'étape A est justement ce dont il aura besoin.
- Autres bindings (défilement journal/timeline, `Tab` de cycle de cibles, `1`/`2`/`3` absolus, pan au stick droit) : la légende couvre **la caméra**, la maquette validée s'arrête là. Le manque de découvrabilité du **défilement de la timeline** part en § Reporté (revue design).
- Refonte de l'écran de sélection d'équipe (chantier séparé, `docs/next.md`).

## Sources

- MDN — [`Keyboard.getLayoutMap()`](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap) (consulté 2026-08-24) : expérimental, hors Baseline, contexte sécurisé requis, `SecurityError` possible.
- Relevé `magick` de `tilemap-1bit.png` (2026-08-24, étape A) : capuchons rangés par position physique QWERTY, aucune loupe, aucun glyphe tactile.
- Plan 184 § « Bindings par position », `docs/references/kenney-input-prompts-tileset.md`, décisions #752, #773-775, #791.
