# Plan 198 — Prévisualisation de dégâts en paramètre de partie

> **Statut** : done
> **Créé** : 2026-09-03
> **Livré** : 2026-09-04
> **Prérequis du Lot B1** (plan 199) — mais autonome et utile seul, donc livré avant.
> **Périmètre arrêté avec l'humain le 2026-09-03** : la prévisualisation de dégâts quitte l'écran
> des réglages pour devenir un **paramètre de partie**, à côté de « Placement auto » sur l'écran de
> sélection d'équipe. Les deux paramètres sont persistés en `localStorage`.

## Motivation

Deux raisons, l'une immédiate, l'autre structurelle.

**Immédiate** : « Placement auto » n'est **pas** persisté. `team-select-screen.ts:54` fait
`let autoPlacement = true`, donc le choix repart au défaut à chaque entrée sur l'écran. Personne ne
l'avait noté.

**Structurelle** : la prévisualisation de dégâts est aujourd'hui un réglage global lu **en direct**
pendant le combat (`combat-screen.ts:575`, `isDamagePreviewEnabled: () => getSettings().damagePreview`).
Tant qu'on joue seul, c'est sans conséquence. En ligne, un paramètre qui vaut pour la partie doit être
**gelé à l'entrée en combat** et porté par la configuration de partie, sinon l'hôte ne peut rien fixer
et deux joueurs peuvent jouer sous deux règles différentes. Le Lot B1 a besoin de cette forme ; autant
la prendre maintenant, dans un chantier qui se teste seul.

Décision humaine du 2026-09-03 : elle rejoint « Placement auto » au même endroit, **y compris en
solo**. Un joueur qui veut une partie plus exigeante le décide partie par partie, pas dans un menu de
réglages qu'il ouvre une fois par an.

## Périmètre

**Dedans :**
1. `autoPlacement` et `damagePreview` persistés dans le magasin `localStorage` existant.
2. Une deuxième case à cocher « Prévisualisation dégâts » dans le pied de l'écran de sélection
   d'équipe, à côté de « Placement auto ».
3. `damagePreview` entre dans `CombatSetup` et est **gelée** à l'entrée en combat.
4. La ligne correspondante est **retirée** de l'écran des réglages.
5. Golden visuel des réglages régénéré (une ligne de moins décale l'écran).

**Dehors, et pourquoi :**
- **La faire voyager en télémétrie.** Ce serait intéressant pour l'équilibrage — est-ce que la
  prévisualisation change les résultats ? — mais ça touche le schéma de la base D1 et le tableau de
  bord. Sans rapport avec ce chantier. Noté pour la Phase 8.
- **Un magasin « options de partie » distinct des « réglages ».** Plus pur conceptuellement, pour une
  clé de plus et une migration à écrire. Voir `#894`.
- **L'encart de paramètres en lecture seule et l'hôte qui impose le choix** : c'est le plan 199.

## Ce que l'exploration a établi (2026-09-03) — à ne pas re-chercher

| Fait | Emplacement |
|---|---|
| Magasin `localStorage`, clé `pt-settings`, type `GameSettings { damagePreview, invertRightStick }` | `packages/app/src/settings/index.ts` |
| La lecture fait `{ ...DEFAULT_SETTINGS, ...parsed }` — **une clé absente prend son défaut**, donc ajouter `autoPlacement` ne demande **aucune migration** et les joueurs gardent leur choix existant | `packages/app/src/settings/index.ts` (`loadSettings`) |
| Ligne à retirer des réglages, avec son `data-testid` `setting-damage-preview` | `packages/app/src/ui/dom/panels/settings-panel.ts:62-74` et `:101` |
| Lecture vivante à figer | `packages/app/src/babylon/combat-screen.ts:575` |
| `autoPlacement` non persisté, et le pied d'écran qui l'accueille | `packages/app/src/ui/dom/screens/team-select-screen.ts:54` et `:191-203` |
| `CombatSetup` (à étendre) | `packages/app/src/app/screens.ts:23-25` |
| Clés de traduction à retirer / ajouter | `settings.damagePreview` (`i18n/types.ts:250`, `locales/fr.ts:245`, `locales/en.ts:245`) ; voisine à imiter : `teamSelect.autoPlacement.label` (`types.ts:180`, `fr.ts:175`, `en.ts:175`) |
| Points de contact e2e | `e2e/pages/screens.ts:125` et `:136`, `e2e/tests/dom/settings.spec.ts:44` et `:48`, `e2e/tests/combat/combat-preview.spec.ts:200` |
| Le golden `settings-visual-linux.png` **attendait déjà** une régénération pour la même raison (une ligne de plus décalait titre et boutons) | `docs/next.md:362`, § Reporté — **pas** dans `docs/backlog.md` |

⚠️ **Trois chemins n'ont pas de configuration de partie** : le bac à sable, la route de développement
`?combat=1`, et la reprise d'un combat sauvegardé (plan 181). Ils lisent la préférence persistée. Le
format des sauvegardes ne change pas — la prévisualisation est un confort d'affichage, elle ne
participe ni au journal d'actions ni au déterminisme.

## Étapes

1. **Magasin.** Ajouter `autoPlacement: boolean` (défaut `true`) à `GameSettings`. Corriger le
   commentaire d'en-tête : ce magasin porte désormais des **préférences persistées** — réglages
   d'interface *et* derniers paramètres de partie choisis — et non les seuls réglages.
2. **Configuration de partie.** `CombatSetup` (`packages/app/src/app/screens.ts`) gagne
   `damagePreview: boolean`, à côté de `autoPlacement`. La sauvegarde de reprise porte le setup
   entier, donc une partie reprise retrouve le choix fait à la sélection d'équipe. **Aucune
   migration** : `battle-persistence.ts:80` rejette déjà toute sauvegarde dont le `buildVersion`
   diffère, et celui-ci change à chaque commit — les sauvegardes d'hier sont écartées avant même
   d'être lues.
3. **Écran de sélection d'équipe.** Les deux cases sont initialisées depuis le magasin et **chaque
   changement appelle `updateSettings`** — c'est ce qui corrige l'oubli de persistance de
   « Placement auto », aujourd'hui une simple variable locale (`team-select-screen.ts:54`). Le
   lancement passe les deux valeurs dans le setup. Même forme que la case existante (`label` +
   `input[type=checkbox]` + `span`), avec un `data-testid` chacune :
   `team-select-auto-placement` et `team-select-damage-preview`.
4. **Combat.** `isDamagePreviewEnabled` lit la valeur du setup, avec repli sur la préférence
   persistée quand il n'y a pas de setup (bac à sable, `?combat=1`, reprise).
5. **Réglages.** Retirer la ligne, son `data-testid`, et la clé `settings.damagePreview` des trois
   fichiers de traduction. Ajouter `teamSelect.damagePreview.label` en français et en anglais.
6. **e2e.** Retirer le localisateur de l'objet de page (`e2e/pages/screens.ts:125` et `:136`). Le
   contrôle de persistance de `settings.spec.ts:44-48` ne **disparaît pas**, il **déménage** : même
   vérification (basculer, relire `pt-settings`), depuis l'écran de sélection d'équipe, et sur les
   **deux** cases puisqu'elles y sont désormais toutes les deux. Vérifier enfin que
   `combat-preview.spec.ts:200` passe toujours : il pose la préférence en `localStorage` et emprunte
   le chemin du bac à sable, qui n'a pas de setup — c'est donc le repli de l'étape 4 qui doit le
   couvrir, sans toucher au test. S'il échoue, le repli est faux.
7. **Golden.** Régénérer `settings-visual-linux.png` (projet e2e `visual`, local uniquement).
8. **Agenda.** Marquer l'item du golden comme soldé dans `docs/next.md` § Reporté (ligne 362).

## Vérifications

- Unitaire : la persistance des deux clés, et le défaut d'une clé absente (pas de migration).
- e2e : `settings.spec.ts` et `combat-preview.spec.ts` verts ; nouveau contrôle de la persistance des
  deux cases entre deux entrées sur l'écran de sélection d'équipe.
- Golden visuel des réglages régénéré et relu.
- À la main : couper la prévisualisation, lancer, vérifier qu'elle est absente ; rouvrir l'écran de
  sélection d'équipe et vérifier que le choix a été retenu.
- Gate CI complet.

## Décisions à inscrire dans `docs/decisions.md`

| # | Date | Question | Décision |
|---|---|---|---|
| 893 | 2026-09-03 | La prévisualisation de dégâts est-elle un réglage du joueur ou un paramètre de partie ? | **Paramètre de partie**, gelé à l'entrée en combat, choisi à côté de « Placement auto », y compris en solo. Retirée de l'écran des réglages. Motif : en ligne, l'hôte doit pouvoir le fixer, et deux joueurs ne peuvent pas jouer sous deux règles différentes |
| 894 | 2026-09-03 | Nouveau magasin « options de partie », ou réutilisation de `pt-settings` ? | **Réutilisation.** La lecture fusionne déjà avec les défauts, donc aucune migration et les choix existants sont conservés. Un second magasin coûterait une migration pour une pureté conceptuelle sans effet visible |

## Réalisation (2026-09-04)

Les 8 étapes sont faites. Trois écarts au plan, tous mineurs :

1. **Le golden n'attendait pas de régénération.** La ligne de `docs/next.md` que l'étape 8 devait
   marquer comme soldée décrivait une régénération **déjà faite** (« régénéré », au passé, pour la
   3ᵉ ligne ajoutée à l'époque). Elle est complétée d'une mention de la régénération de ce plan —
   cette fois pour une ligne en **moins**. Rien n'était en attente.
2. **`e2e/pages/screens.ts` visait la case « Placement auto » par `page.getByRole("checkbox")`.** Le
   pied d'écran en portant désormais deux, ce localisateur devenait ambigu et aurait fait tomber
   `placement-menu.spec`. Les deux cases sont visées par leur `data-testid`.
3. **Une media query sur `.ts-footer` ajoutée puis RETIRÉE.** Ajoutée par crainte que l'écart
   `--spacing-xl` ne pousse « Lancer » hors du pied à deux bascules. La mesure l'a démentie : au
   viewport le plus étroit (568 × 320), l'écart calculé vaut déjà **10 px** — les tokens
   d'espacement ont leur propre réduction sous ce seuil — et il restait **240 px** de marge, sans
   aucun débordement. Neutraliser la règle en ligne ne changeait rien. Retirée : c'était du code
   « au cas où ».

4. **Un chemin de repli annoncé de trop.** L'étape 4 et la décision #893 parlaient de « trois
   chemins sans configuration de partie (bac à sable, `?combat=1`, reprise) ». Vérifié en revue :
   il n'y en a qu'**un**. `?combat=1` s'arrête à `mountDemoContent` et ne construit aucun
   `PresentationContext`, donc ne lit ni le setup ni la préférence ; une partie reprise rejoue le
   `setup` sauvegardé, donc elle retrouve la valeur **gelée**, elle ne retombe sur rien. Seul le bac
   à sable lit la préférence persistée. Corrigé dans le code (commentaires) et dans #893.

## Vérification multi-entrée (mesurée, 2026-09-04)

Le contrôle ajouté est une case à cocher, donc il traverse les quatre entrées supportées depuis la
Phase 6.5. Mesuré au chrome-devtools plutôt que supposé — c'est ce chantier qui a fait naître
`.claude/rules/multi-input.md`.

| Axe | Résultat |
|---|---|
| **Clavier** | ↓ depuis le bouton d'équipe atteint « Prévisualisation dégâts », ← revient sur « Placement auto », **Espace** bascule, `pt-settings` s'écrit, le focus reste sur la case. Vérifié par de vraies pressions de touches, pas par `.focus()` |
| **Manette** | `activateFocusedControl()` fait `active.click()` : bascule bien une case et fire `change`. Les deux cases sont dans `FOCUSABLE_SELECTOR` (`input:not(:disabled)`) et ne portent pas `data-nav-skip`. **Vérifié par lecture de code, pas joué au pad synthétique** |
| **Responsive** | 568 × 320, 667 × 375, 1920 × 1080 : aucun débordement (`scrollWidth === clientWidth`), 240 à 1461 px de marge restante, « Lancer » toujours dans le pied |
| **Tactile** | ⚠️ **Sous le plancher** : hit-area du `<label>` de 19 px (667 × 375) à 23 px (1920 × 1080), contre 30 px exigés sous `pointer: coarse`. Écart **pré-existant** que ce plan double. Non corrigé — porté à `docs/backlog.md` avec la mesure, parce que le remède grandit le pied d'écran et que « Lancer ▶ » (27 px) ne tient pas le plancher non plus : ça mérite une passe globale, pas un correctif local |

Le cahier `docs/test-plan.md` suit : §6.4 gagne la case des deux paramètres de partie, §6.7 tombe à
une seule entrée inconditionnelle, §4.14 dit « paramètre » et non « réglage » (et précise que son
test emprunte le chemin bac à sable, donc le repli). Une case de §6.12 passe 🤖 → 👁 : « une bascule
des réglages garde le focus » n'a plus de signal e2e, « Prévisualisation dégâts » étant la seule
bascule de l'écran à muter son libellé en place.

**Effet de bord favorable, non prévu** : les cases portant désormais un `data-testid`,
`renderPreservingFocus` sait les retrouver après un re-rendu (il ne restaure que par famille de
`testid`, le repli par rang global ayant été retiré exprès). « Placement auto » n'en portait aucun :
presser un segment de format pendant que le focus était sur elle l'éjectait vers `<body>`.

Nouveau `packages/app/src/settings/index.test.ts` (5 cas) : défauts, relecture, écriture, **clé
absente complétée sans écraser les autres** (le cas qui prouve l'absence de migration, #894), et
magasin illisible.
