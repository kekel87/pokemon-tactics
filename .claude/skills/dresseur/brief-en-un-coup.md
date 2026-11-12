# Brief de la passe en un coup (étape 3)

Remplacer les `<…>` et `<racine>` (le chemin absolu du dépôt de la session, worktree compris) puis donner tout le
bloc à l'agent.

```
Chemins : R = <racine>/assets-src ; B = R/references/aventure/sprites-dresseurs.

Passe « en un coup » : tu crées le dresseur **<Nom>** (<rôle, jeu>) pour un jeu tactique fan-made Pokémon, avec SpriteKiln (modèle 3D en YAML, rendu pixel art 8 directions). Réponds en français. Ne télécharge et n'installe rien.

Règles du test : tu regardes UNE seule image, l'artwork B/spritekiln-<id>/splash.png. Aucun rendu (ni pose, ni planche, ni GIF) : seulement les contrôles en texte (`$SK validate`, la ligne QA de `$SK render`, `verifier_yeux.py`). Vise une vingtaine d'actions, pas d'itération esthétique : un premier jet propre que l'humain jugera.

Lis R/poc-sprites/regles-dresseurs.md, puis copie R/poc-sprites/spritekiln/modele-personnage.yaml en B/spritekiln-<id>/<id>.yaml et remplis-le. N'ouvre pas le gabarit ni d'autres specs en entier (au besoin : `$SK spec outline <spec>` ou `grep`), ni les docs SpriteKiln sauf erreur bloquante.

Le personnage, validé par l'humain :
- Pitch : <pitch>
- Carrure : <enfant | ado | adulte>
- D'après l'artwork : <coiffure, couleurs, vêtements, accessoires>
- Yeux : <normaux | ouverts | plissés | colère> (bloc de spritekiln/yeux-expressions.yaml, x recalculé pour head.scale)
- Objet : <sac | sacoche | poche> ; il <geste de l'objet>
- Gestes : throw = <…> ; faint = <…> ; item = <…> ; celebrate = <…> (garder noms et events : release ; dernière image tenue longue ; rummage puis use ; cheer ; règle des images tenues)

Commandes : `cd ~/.local/share/comfyui/essais-iso/sk-test && SK=../spritekiln/.venv/bin/spritekiln`. Corrige jusqu'à validate OK et QA 0 erreur ; vérifie les yeux : `python3 R/poc-sprites/spritekiln/verifier_yeux.py B/spritekiln-<id>/out/<id>/<id>.json idle s,se,e,sw 0` puis sur les images tenues de command, item, celebrate (`--lignes 18` pour faint).

Fiche : `cd R/poc-sprites && python3 fiche_animations.py B/fiche-<id>-animations.gif B/spritekiln-<id>/out/<id>/<id>.json R/sprites/pokemon/machoke Machopeur B/pmd-gallame Gallame --nom "<Nom>" --artwork B/spritekiln-<id>/splash.png --pitch B/spritekiln-<id>/pitch.txt`

Ne touche à rien hors de B/spritekiln-<id>/ et de la fiche. Rends : nombre d'actions, validate, QA, la sortie texte des yeux (idle s et se), et ce que tu crains d'avoir raté.
```
