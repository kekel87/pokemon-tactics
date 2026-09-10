# Plan 206 — Passe tactile : le plancher de 30 px tenu partout

**Statut** : done
**Session** : 4 de `agenda-2026-09-10-file-de-sessions-dediees`
**Solde** : `backlog-segments-de-format-du-salon-sous-le-plancher-tactile-fig`,
`backlog-cases-à-cocher-du-pied-de-lécran-de-sélection-déquipe-so`

## Pourquoi une passe globale et pas deux correctifs

Les deux entrées de backlog nommaient deux écarts (`.ts-segment` à 26 px, les cases du pied de
l'écran de sélection d'équipe à 19 px) et notaient au passage que « Lancer ▶ » était à 27 px, donc
que **le plancher n'était tenu nulle part**. La mesure au chrome-devtools sur Chromium, en
`pointer: coarse`, le confirme et va plus loin : la cause est **une seule**.

`--target-min` vaut **24 px** dans `tokens.css`. Deux endroits seulement le relèvent à 30 px sous
`pointer: coarse` — la barre de combat (`battle-chrome.css`) et la barre de placement
(`placement.css`) — et le commentaire de `battle-chrome.css` dit explicitement pourquoi le relèvement
est resté local :

> Scoped to the combat chrome on purpose — raising `--target-min` in `tokens.css` would also resize
> every Team Builder button on touch.

C'est exactement le changement que cette session assume. **Le plancher devient un seul réglage**, et
tout ce qui n'y était pas câblé y est raccordé.

## Ce qui a été mesuré (avant)

`pointer: coarse`, viewport 568 × 320 sauf mention. Hit-area = la boîte de l'élément tapable (le
`<label>` pour une case à cocher, pas la case).

| Écran | Contrôle | Hauteur | Cause |
|---|---|---|---|
| Écran des contrôles | `.ct-cell` × 81 | 28 px | `clamp(28px, 2.8vmin, 58px)` en dur |
| Écran des contrôles | `.ct-reset` × 5 | 24 px | `.tb-btn` → `--target-min` |
| Choix de la carte | `.ms-list-item` × 9 | **20,8 px** | aucun `min-height` |
| Sélection d'équipe | `.ts-segment` × 9 | 24 px | `--target-min` |
| Sélection d'équipe | `◀ Retour`, `Lancer ▶` | 26,5 px | `.tb-btn` → `--target-min` |
| Sélection d'équipe | `.ts-footer-toggle` × 2 | **19 px** | aucune règle |
| Constructeur d'équipe | `.tb-btn` × 42 | 26,5 px | `--target-min` |
| Éditeur d'équipe | `input[type=range]` × 6 | **16 px** | aucune règle |
| Éditeur d'équipe | `.tb-slot-card-clear` | 22 × 22 px | `--tb-clear-size` |
| Éditeur d'équipe | `.tb-gender-toggle` | 24 × 24 px | `--target-min` |
| Éditeur d'équipe | `.tb-move-row`, `.tb-input-clickable` | 26,5 px | aucun `min-height` |
| Éditeur d'équipe | `.tb-radio-option` | 27,5 px | aucune règle |
| Éditeur d'équipe | `.tb-topbar-name-input` | 24,3 px | aucun `min-height` |
| Sélecteur (modale) | `.tb-filter-chip` × 28 | 24 px | `--target-min` |
| Sélecteur (modale) | `.tb-picker-search` | 24,3 px | `--target-min` |
| Sélecteur (modale) | `.tb-modal-close` | 28 × 28 px | `--tb-*` de l'écran étroit |
| Salon en ligne, Crédits | `Retour` | 24 px | `.tb-btn` écrasé par `flex-shrink` jusqu'à son `min-height` |

À **2560 × 1440**, le défaut « figé en 4K » du backlog est reproduit : `.tb-btn` monte à 40 px
pendant que `.ts-segment` reste à **26 px** et les cases du pied à **23 px**.

Écrans déjà conformes, à ne pas toucher : menu principal, mode de combat, paramètres, salon en ligne
(hors `Retour`), placement, barre de combat, menu de combat, journal de combat.

## Ce qu'on change

### 1. Le levier unique — `tokens.css`

```css
@media (pointer: coarse) {
  :root { --target-min: 30px; }
}
```

### 2. On retire les deux relèvements devenus redondants

`battle-chrome.css` et `placement.css` posaient `--target-min: 30px` sous `pointer: coarse` pour leur
sous-arbre. Le token racine le fait maintenant pour tout le monde : code mort, on l'enlève, et on
garde dans le commentaire l'arbitrage du plan 179 (44 px puis 36 px jugés trop hauts sur téléphone
réel, 30 px retenu).

### 3. On raccorde au token ce qui ne l'était pas

`.ts-footer-toggle`, `.ms-list-item`, `.ct-cell`, `.tb-topbar-name-input`, `.tb-input-clickable`,
`.tb-move-row`, `.tb-radio-option`, `.tb-sp-row input[type=range]`, `.tb-slot-card-clear`,
`.tb-modal-close`.

Les deux derniers portent une taille carrée pilotée par une variable que l'écran étroit rapetisse :
on les passe en `max(<taille actuelle>, var(--target-min))`, donc le plancher gagne au doigt et la
taille resserrée gagne à la souris.

**Une exception, relevée en revue** : la croix de slot vaut 22 px sous le seuil étroit
(`--tb-clear-size`, `team-builder-overlay.css`), soit **moins que les 24 px du token même à la
souris**. Sur une fenêtre de bureau étroite elle passe donc de 22 à 24 px. L'effet est nul — la
croix est en `position: absolute`, rien ne reflue autour — mais l'affirmation « le bureau ne bouge
pas » vaut à 1920 × 1080, pas sous le seuil étroit. `.tb-modal-close` n'a pas le cas
(`max(28px, 24px)` reste 28).

## Ce que ça déplace, et qui tranche

Agrandir les hit-areas **rejoue la mise en page** d'écrans déjà serrés en paysage téléphone. C'est la
raison pour laquelle les deux entrées de backlog avaient été laissées non corrigées : l'humain doit
voir le résultat. La passe se termine donc par une re-mesure aux cinq viewports de référence
(568 × 320, 667 × 375, 1024 × 768, 1920 × 1080, 2560 × 1440), en cherchant débordement,
chevauchement et contrôle devenu injoignable, puis par un `human-testing`.

## Recette de vérification

`.claude/rules/multi-input.md`. Sonde de mesure : tout `button`, `input`, `select`, `textarea`,
`a[href]`, `[tabindex="0"]`, `[role=button]`, plus le `<label>` quand il enveloppe un champ ;
on retient ceux dont la hit-area passe sous 30 px dans un sens ou dans l'autre.

## Ce qui a été mesuré (après)

Sonde relancée sur les cinq viewports de référence, `pointer: coarse`, sur 14 écrans et modales
(menu, paramètres, écran des contrôles, mode de combat, salon en ligne, choix de la carte, sélection
d'équipe, liste d'équipes, crédits, constructeur d'équipe, éditeur d'équipe, sélecteurs de Pokémon /
nature / capacité / objet, import-export Showdown), plus le placement et le combat :

| Viewport | Contrôles sous 30 px |
|---|---|
| 568 × 320 | 0 |
| 667 × 375 | 0 |
| 1024 × 768 | 0 |
| 1920 × 1080 | 0 |
| 2560 × 1440 | 0 |

Aucun débordement horizontal du document, aucun contrôle sorti du cadre. À 568 × 320, l'écran de
sélection d'équipe tient toujours : en-tête 46 px, colonne centrale 233 px, pied 41 px pour 320 px de
hauteur, sans défilement horizontal du pied.

Deux familles se sont ajoutées en cours de route, invisibles à la première passe parce qu'elles
vivent dans des modales et derrière un slot rempli :

- `.tb-list-row` — lignes des sélecteurs de nature, d'objet et de capacité, 26,5 px ;
- `.tb-btn` **en largeur** — le « D » de remise à zéro d'une ligne d'EV mesurait 25 × 30 px, donc
  sous le plancher par la largeur. `min-width: var(--target-min)` est monté sur `.tb-btn`, où la
  variante `icon` le portait déjà en double.

### Le bureau ne bouge pas

Vérifié en comparant les mêmes mesures avant / après, **pointeur fin**, 1920 × 1080 : lignes d'EV
40 px, bouton « D » 38 × 40 px, options de talent 37 px, croix de slot 28 px, panneau d'EV 321 px —
identiques. Le seul écart est la **boîte** du curseur d'EV, 16 → 24 px, à l'intérieur d'une ligne qui
faisait déjà 40 px : rien ne se décale. C'est attendu — sur pointeur fin `--target-min` vaut toujours
24 px, et tous les ajouts sont soit `var(--target-min)` soit `max(<taille actuelle>, …)`.

### Combat et placement, après retrait des relèvements locaux

`--target-min` résolu à 30 px depuis la racine jusque dans `.pl-roster` et `.bc-root`. Lignes du menu
d'action à 30 px, plein écran / menu / journal à 30 × 30 px, « ✓ Terminer » du placement à 30 px de
plancher calculé. Le garde-fou e2e existant est `e2e/tests/combat/responsive-chrome.spec.ts` §4.16.

### Clavier

Aucun contrôle ajouté, déplacé ni supprimé, et aucun centre d'élément déplacé : la navigation
spatiale est inchangée. Vérifié tout de même sur l'écran dont la mise en page bouge le plus — les
deux cases du pied de l'écran de sélection d'équipe restent atteintes aux flèches, par de vraies
pressions, l'une depuis l'autre.

## Garde-fou e2e

`e2e/tests/dom/touch-targets.spec.ts` (cahier §6.10) — 3 tests sous `hasTouch: true`, chacun
re-sondé à 568 × 320, 1024 × 768 et 2560 × 1440 : menu → paramètres → écran des contrôles → crédits ;
mode de combat → choix de la carte → sélection d'équipe → sélecteur d'équipe ; mes équipes →
édition d'équipe → sélecteur de Pokémon → fiche de Florizarre. La sonde de mesure ci-dessus est
devenue `Responsive.undersizedTouchTargets(30)` dans `e2e/pages/responsive.ts`, à côté de
`elementsOutsideViewport` qui garde l'autre moitié du contrat responsive.

Rouge-puis-vert vérifié en retirant les deux dossiers de styles (`git stash push --
packages/app/src/styles packages/ui-dom/src/styles`) : les trois tests tombent, en nommant 83 cases
de l'écran des contrôles, 9 lignes de cartes et 3 boutons de « Mes équipes » à 568 × 320. La sonde
recadrée sur la seule 4K retrouve aussi les segments à 26 px, les cases du pied à 23,4 px et les
curseurs d'EV à 16 px — donc le balayage 2560 × 1440 mesure vraiment, il n'est pas décoratif.

## Recette humaine

Retour sur la croix de fermeture rouge (`.tb-slot-card-clear`, éditeur d'équipe) : **pas centrée**
dans son carré, et « pourrait être un chouille plus gros ». Deux corrections, mesurées avant
validation finale :

- **Recentrage optique.** Le glyphe « × » de `PokemonEmeraldPro` se pose haut dans son cadratin —
  son encre déborde de 0,0417 em sous le centre de la boîte de ligne (sa « descente » est négative).
  `align-items: center` centre la ligne, pas le dessin : l'écart survit au centrage.
  - **Fausse piste : `translateY`.** Ne corrige pas — il emporte le bouton entier avec son
    contenu, donc l'écart reste, c'est tout le carré qui se décale au lieu du glyphe seul.
  - **Solution retenue : un padding bas.** Il rogne la boîte de contenu, et le contenu centré remonte
    de la **moitié** du padding retiré — d'où le facteur ×2, `--glyph-cross-nudge: 0.083em`. Le
    carré, en `border-box`, ne bouge pas. Dépend d'un `line-height: 1` sur le bouton : le changer
    change le demi-interligne, donc cette valeur.
  - Le même défaut existait **à l'identique** sur `.tb-modal-close` (croix de fermeture des modales
    du sélecteur), non repéré à la première mesure parce qu'il vit dans une modale fermée par
    défaut. Corrigé par le même mécanisme, la même variable.
- **Grossissement au doigt.** `--glyph-cross-size: calc(var(--target-min) * 1.1)`, sous
  `pointer: coarse` uniquement — à la souris ni le carré ni le glyphe ne bougent. Le facteur porte
  sur l'encre, pas sur la boîte : le « × » ne dessine qu'un tiers de son cadratin.

Recette validée après ces deux corrections. Le garde-fou e2e existe
(`e2e/tests/dom/touch-targets.spec.ts`), la recette humaine a eu lieu.

## Constat de passage, hors périmètre

Sur le constructeur d'équipe à 568 × 320, le bloc nom + date d'une carte d'équipe déborde de son
conteneur (160 px de contenu pour 71 px de large). Pré-existant, purement textuel, aucun contrôle
concerné — pas touché ici.
