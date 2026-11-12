# Règles pour faire un dresseur avec SpriteKiln

Une page à lire à la place des docs SpriteKiln : ce qui a fait la différence sur Red, Pierre, Ondine et Major Bob.
Les docs complètes (`spritekiln/docs/agent/*.md`) ne servent que pour une question précise.

## Outils
- SpriteKiln : `cd ~/.local/share/comfyui/essais-iso/sk-test && SK=../spritekiln/.venv/bin/spritekiln`
  (le style du projet est dans `spritekiln.toml`).
- Gabarit commun : `spritekiln/dresseur.yaml` (enfant de la taille de Red, yeux peints, 9 animations relues).
  Un personnage écrit `extends: <chemin relatif>/dresseur.yaml` et ne donne que ce qui change.
- `spritekiln/adapter_animations.py <gabarit> <perso>` : réécrit les 9 animations pour une autre carrure.
- `spritekiln/verifier_yeux.py <atlas.json> <clip> [dirs] [images] [--lignes 12]` : le visage en texte, sans image (plus de lignes pour une pose basse).
- `fiche_animations.py` : la fiche animée finale (une ligne par animation, 8 directions, Machopeur et Gallame).

## Proportions (même caméra pour tous : `pitch 30`, `scale 0.065`)
| | `torso_rot` y | `head.scale` | épaule | bras IK | jambes IK | `size` | hauteur |
|---|---|---|---|---|---|---|---|
| Enfant (Red, Ondine) | 0.68-0.70 | 1.55 | 0.18, 0.46 | 0.24 + 0.23 | 0.30 + 0.28 | 56 | 28 px |
| Ado (Pierre) | 0.80 | 1.6 | 0.235, 0.54 | 0.28 + 0.27 | 0.36 + 0.342 | 56 | 32 px |
| Adulte (Major Bob) | 1.0 | 1.75 | 0.29, 0.55 | 0.36 + 0.34 | 0.46 + 0.44 | 72 (`center [0, 1.2, 0]`) | 36 px |

Jambes tendues : la somme des longueurs IK des jambes égale la distance hanche → cheville au repos.

## Expressions des yeux
Blocs prêts à copier dans `spritekiln/yeux-expressions.yaml` : normaux (Red), plissés (Pierre, traits de 2 px
sur une part `face` plate), ouverts (Ondine, iris 1×2 et un pixel de reflet émissif au-dessus), colère (Major Bob,
sourcils en V collés à l'œil). Le visage ne fait que 6 à 8 px de large : un œil de 2×2 ou incliné n'y tient pas.
Un sourcil de trois quarts disparaît sous une mèche de tempe.

## Pièges connus
- **Yeux peints** (`parts.head.paint`, matériau `ink`), jamais extrudés. Leur x = 1,5 × `camera.scale` /
  `head.scale` (0.063 pour 1.55, 0.056 pour 1.75) ; profils par `pulse(abs(yaw), 90, 50)`.
  Yeux plissés (Pierre) : une part `face` plate (`line: false`) sous la peinture, sinon les traits disparaissent.
- **Images tenues** : `lean: 0.05`, `head_yaw = -twist`, `head_pitch: -0.08`, aucun `squash`, et
  `snap: [root, torso_rot]` ; sinon les yeux sautent d'un pixel ou disparaissent.
- `render -o` écrit tel quel dans le dossier donné : toujours `-o <dossier>/out/<id>`, sinon on relit l'ancien atlas.
- Contour de peau chaud (`materials.skin.line_color`) et cheveux d'une autre teinte que l'encre des yeux.
- Rien sous ~1 px (`validate` le signale) : un écusson, un camouflage ou une boucle deviennent une tache de couleur
  franche ou disparaissent. Deux vêtements voisins de même teinte se confondent : écarter les couleurs.
- Mains à 1 px : un geste se lit au bras, pas aux doigts. Un geste vers la caméra (s, n) se triche par direction.

## Caractère
Chaque personnage a ses propres variantes de `throw`, `faint`, `item` et `celebrate`, proposées à l'humain avant de
les faire. `item` part de ce que le personnage porte : sac à dos, sacoche, ceinture ou poche.

## Budget (le temps et les jetons viennent des allers-retours et des images regardées, pas du rendu)
- Un personnage neuf se fait en un seul passage : l'artwork est la seule image regardée, tout le reste se contrôle
  en texte (`validate`, ligne QA du rendu, `verifier_yeux.py`). Pas de relecture de directeur artistique.
- L'itération ne se fait que sur demande de l'humain, ciblée sur ses points ; là seulement, quelques gros plans
  (`pose --draft --focus head`) ou planches `out/<id>/preview/contact_<clip>.png` aident à juger une forme.
