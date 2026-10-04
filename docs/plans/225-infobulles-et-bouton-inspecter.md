# Plan 225 — Infobulles talents, objets et effets, et le bouton Inspecter

**Statut** : done
**Origine** : retour de Frank (`backlog-infobulles-talents-objets`, 2026-09-30) — il cherche ce que fait
un talent, un objet tenu, et ne trouve pas l'info. Discussion du 2026-10-04 : l'humain craignait la
manette ; on retient le **bouton Inspecter** (modèle Fire Emblem / XCOM) en combat, et la description
**écrite en clair** dans le constructeur (modèle menus Pokémon / Baldur's Gate 3). La fiche détail
complète d'un Pokémon est un autre chantier, déjà prévu par l'humain : hors périmètre.

## Ce que tu verras à l'écran

- **Combat, souris / doigt** : survoler (ou toucher) le talent, l'objet tenu, une pastille d'effet
  (Brûlure, Provoc, Vampigraine…), la météo, ou une zone de la case (champ, piège, Distorsion…) ouvre une bulle qui dit ce que ça fait, dans
  le style de l'infobulle d'attaque. Au doigt, toucher ailleurs la referme.
- **Combat, manette** : panneau d'info affiché, **L3** (clic du stick gauche) entre en mode
  Inspecter. La croix passe talent → objet → chaque effet → météo → zones de la case, la bulle suit. **B** ou
  **L3** pour ressortir. Clavier : **I**. Remappable, et annoncé dans la légende et l'écran de contrôles.
- **Constructeur d'équipe** : la description du talent choisi et de l'objet choisi est écrite sous
  leur sélection — rien à survoler, ça marche pareil aux quatre entrées.
- **Les objets enfin décrits en français et en espagnol** : aujourd'hui les 117 objets jouables
  s'affichent en anglais, partout. Les talents manquants en espagnol (44) sont complétés au passage.
- Ennemi sous brouillard : talent/objet « ??? » → la bulle dit « Inconnu tant qu'il n'est pas révélé ».

## Constat technique (relevé en préparant le plan)

- Talent en constructeur : infobulle **native** (`title` sur le `<label>`, `EditLeftPanel.ts`) —
  délai, aucun style, invisible au doigt et à la manette.
- Talent et objet en combat : nom seul, aucune description (`info-panel.ts`).
- Champs, pièges et zones : **pas** de HUD global comme la météo — ce sont des zones posées sur des
  cases, affichées en lignes dans le panneau de case (`tile-info-panel.ts`, construit par
  `battle-views.ts`), avec un `title` natif.
- Pastilles d'effet (`InfoPanelBadge`, ~40 sortes, `battle-views.ts`) : un libellé, aucune explication.
- **Bug du générateur** : `build-reference.ts` (transformation des objets) lit `flavor_text`, alors
  que PokeAPI range le texte des **objets** sous `text` (vérifié dans `.cache/pokeapi/items/211.json`,
  Restes : FR et ES présents). Résultat : `shortDescription.fr` et `.es` vides pour les 117 objets
  jouables, et `localizedText` retombe sur l'anglais.

## Décisions de conception

1. **Une bulle générique, pas l'infobulle d'attaque tordue.** Nouveau composant `info-tooltip.ts`
   (`packages/ui-dom`) : titre + texte, ancré à l'élément visé, mêmes jetons visuels que
   `move-tooltip.ts`. L'infobulle d'attaque reste telle quelle.
2. **Le panneau reste un rendu bête.** Les descriptions sont résolues dans `view-core`
   (`battle-views.ts`) et voyagent dans les view-models : `InfoPanelData` gagne
   `abilityDescription?` / `heldItemDescription?`, `InfoPanelBadge` gagne `description?`, la météo et
   les lignes de zone du panneau de case (`TileInfoChip`) gagnent la leur. Absent = pas de bulle, l'élément n'est pas une étape d'Inspecter.
3. **Textes des effets écrits pour NOTRE moteur.** Statuts majeurs, effets temporaires, auras,
   météo, champs, pièges d'entrée, zones globales, Distorsion : clés i18n `infoPanel.describe.*` dans `locales/fr.ts`, `en.ts`, `es.ts`, rédigées
   en lisant le core (ex. pas de PP chez nous, durées en tours de CT, portée des auras) — jamais
   recopiées des jeux principaux. Talents et objets : textes officiels des données.
4. **Correctif des données par le générateur, jamais à la main.** `build-reference.ts` lit `text`
   pour les objets, régénération hors ligne depuis le cache, diff relu (`data-diff.ts`) : seules les
   descriptions FR/ES doivent bouger. Talents ES manquants : même voie si PokeAPI les a, sinon
   `description-overrides.ts`. Délégué à `data-miner`.
5. **Inspecter = une action logique de plus.** `LogicalAction.InspectInfo` (`"inspect-info"`),
   défauts : clavier `KeyI`, manette bouton 10 (L3, le seul libre — R3 est le modificateur de
   défilement). Remappable comme les autres, ligne ajoutée à l'écran de contrôles et à la légende.
6. **Parcours en liste, pas spatial.** En mode Inspecter, ↑/← = étape précédente, ↓/→ = suivante, en
   boucle, dans l'ordre talent → objet → effets → météo → zones de la case (si le panneau de case est affiché). Implémenté comme un
   `MenuInputConsumer` enregistré tant que le mode est actif : le curseur du plateau ne bouge plus.
   Sortie : `Cancel`, `InspectInfo` à nouveau, ou disparition / changement du panneau.
7. **Pas une pause.** Comme le menu de combat (plan 187) : le combat continue derrière. Disponible
   dès que le panneau d'info montre un Pokémon et qu'aucun menu ou modale n'est ouvert.
8. **Souris et doigt sans mode.** Survol = bulle ; au doigt, un appui ouvre, un appui ailleurs ou
   sur un autre élément ferme/remplace. Chaque cible porte un `data-testid`.
9. **Constructeur : texte permanent.** Une ligne de description sous le groupe de talents (talent
   choisi) et sous l'objet choisi. Le `title` natif reste sur les options non choisies, pour la
   souris qui compare avant de cliquer.

10. **Texte officiel ≠ notre règle → description écrite à la main.** Revue `game-designer` du
    2026-10-04 : une trentaine de talents et d'objets ont un texte officiel qui promet une règle
    absente de notre moteur (PP, « changer de Pokémon », effet « à l'entrée », portée globale).
    Liste minimale à réécrire FR/EN/ES par surcharge de données (`description-overrides.ts`, étendu
    aux objets) : talents Intimidation, Magnépiège, Piège Sable, Régé-Force, Moiteur, Pression,
    Cœur Soin, Garde-Ami, Gaz Inhibiteur, Tension, Fuite, Ramassage (« sans effet en combat
    tactique ») ; objets Bouton Fuite, Carton Rouge, Mouchoir Choix, Veste de Combat, Métronome, les
    4 graines de champ, les rochers de météo, Lumargile, Champ’Duit, Évoluroc, Herbe Mental, baies à
    seuil. Chaque réécriture vérifiée contre le core, pas contre le rapport.
11. **Règles d'écriture des descriptions d'effets** : unité de durée explicite (« tours du lanceur »
    / « tours du porteur » — jamais « N tours » nu) ; rayons explicites (rayon 3 pour champs, zones
    et auras ; adjacent pour Intimidation, Charmé, pièges de position) ; jamais PP, banc, switch ;
    « Protection » = le mur (`reflect`), à ne pas confondre avec Abri.
12. **Le code fait foi sur les écarts de doc relevés** : Confusion 1 à 4 tours (code) contre « 2-5 »
    dans `game-design.md` §7m ; Roche Chaude = Plein soleil seul (code) contre §8e périmé. Les deux
    passages de `game-design.md` sont corrigés dans ce lot.

## Hors périmètre

Crans de stats (multiplicateur), faiblesses/résistances par type, panneau de case **hors lignes de zone**
(résumé de traversée, bonus et immunités de type : `title` natif inchangé), fiche détail du
Pokémon (chantier prévu à part), natures (le sélecteur affiche déjà ses effets).

## Étapes

1. `data-miner` : correctif `text` vs `flavor_text`, régénération, diff, talents ES.
2. View-models + résolution dans `battle-views.ts` ; clés `infoPanel.describe.*` FR/EN/ES.
3. `info-tooltip.ts` ; branchement souris/doigt dans `info-panel.ts`, `weather-hud.ts` et
   `tile-info-panel.ts` (lignes de zone).
4. Action `InspectInfo` : bindings, légende, écran de contrôles, consommateur dans l'écran de combat.
5. Constructeur : lignes de description talent / objet.
6. `/simplify`, typecheck, passe multi-entrée mesurée (4 axes, 5 viewports — `.claude/rules/multi-input.md`),
   grep des localisateurs e2e génériques après ajout de contrôles.

## Tests (après recette, au menu)

Pas de core touché → pas de test pendant le dev. Au menu : unitaires `view-core` (descriptions
présentes, brouillard), `bindings-store` (nouveau défaut, pas de collision), e2e Inspecter à la
manette synthétique et au clavier, bulle au survol, lignes du constructeur.

## Risques

- **Promesse fausse** (risque n°1 selon `game-designer`) : un texte qui annonce une règle absente du
  moteur. Parade : décisions 10 et 11.
- **Volume de texte** : ~50 descriptions d'effets + ~30 surcharges × 3 langues, traduction ES non relue (même réserve
  qu'au plan 222).
- **L3 peu découvrable** : compensé par la légende ; remappable si l'humain préfère un autre bouton.
- **Bulle au bord de l'écran** (panneau ancré en coin, téléphone 568 × 320) : à mesurer, pas supposer.
