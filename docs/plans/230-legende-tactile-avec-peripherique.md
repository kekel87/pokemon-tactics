# Plan 230 — Légende des contrôles sur écran tactile avec un périphérique branché

**Statut** : done
**Origine** : constat de la revue du plan 229 (consigné sur `plan-229`), correction demandée par
l'humain le 2026-10-06.

## Ce que tu verras à l'écran

1. Sur téléphone ou tablette **avec une manette**, la légende des contrôles (sous la boussole)
   affiche enfin les petits boutons à côté de chaque contrôle, et la ligne « déplacer la caméra »
   au stick droit.
2. Même chose avec une souris ou un clavier branché : les indices de touches apparaissent.
3. Au doigt seul, rien ne change : indices et ligne caméra restent masqués.

## Constat

`control-legend.css` lignes 219 et 352 : `:where(:not([data-input-source])) .cl-hint` (et
`.cl-row-pan`) sous `@media (pointer: coarse)`. `:not([data-input-source])` matche **n'importe quel
ancêtre** sans l'attribut (ex. `<body>`, `#game-root`), pas seulement `<html>` qui le porte. 
Conséquence : la règle « rien d'observé » ne s'arrête jamais, même quand `data-input-source` 
s'écrit sur la racine — `<body>` restera toujours sans l'attribut, donc le sélecteur reste vrai.

## Étape

Remplacer `:where(:not([data-input-source]))` par `:where(:root:not([data-input-source]))` aux deux
endroits. Spécificité inchangée (`:where` = 0). Aucune autre règle du dépôt n'utilise ce motif.

## Hors périmètre

Les glyphes de la ligne d'instruction (`battle-chrome.css`) : leurs règles sont positives
(`[data-input-source="…"] &`), elles marchent déjà.

## Ajout en recette — anneau du talent en mode Inspecter (retour humain 2026-10-06)

Sur téléphone, l'anneau du mode Inspecter (L3) autour du talent débordait sur la barre de PV et la
ligne du dessous : il entourait la boîte agrandie pour le doigt (`--it-overhang`, plan 225), pas le
texte. `info-tooltip.css` : l'anneau du talent est dessiné par un `::before` qui rend l'agrandissement
vertical, et 3 px de marge intérieure compensée (`--it-ring-room`) évitent qu'il soit rogné par le
`overflow: hidden` de l'ellipse. Un `outline-offset` négatif, essayé d'abord, rétrécissait l'anneau
sur les quatre côtés (tassé au milieu du mot). Mesuré : anneau à 3 px du texte, sous la barre de PV.
