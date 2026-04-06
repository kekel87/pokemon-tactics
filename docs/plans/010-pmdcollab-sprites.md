# Plan 010 — Sprites PMDCollab : pipeline d'extraction + intégration renderer

> **Statut** : done
> **Date** : 2026-03-24
> **Objectif** : Remplacer les cercles colorés par des vrais sprites Pokemon animés (PMDCollab) + portraits

---

## Contexte

Le renderer POC utilise des cercles colorés comme placeholders. PMDCollab/SpriteCollab fournit des sprites Pokemon animés (Idle, Walk, Attack, Hurt, Faint) en 8 directions + portraits d'émotions, sous licence CC BY-NC 4.0.

**Source** : https://github.com/PMDCollab/SpriteCollab
**Licence** : CC BY-NC 4.0 — attribution obligatoire, non-commercial

---

## Étape 1 — Script d'extraction PMDCollab → atlas Phaser

**But** : Script Node.js extensible qui télécharge et convertit les sprites PMDCollab en atlas Phaser.

**Fichier** : `scripts/extract-sprites.ts`

**Fonctionnement** :
1. Lire un fichier de config `scripts/sprite-config.json` qui liste :
   - Les Pokemon à extraire (par numéro Pokédex + nom kebab-case)
   - Les animations voulues (Idle, Walk, Attack, Hurt, Faint — extensible)
   - Les portraits voulus (Normal — extensible)
2. Pour chaque Pokemon :
   - Télécharger `AnimData.xml` + les `{Anim}-Anim.png` depuis le repo GitHub (raw)
   - Parser `AnimData.xml` (XML → objet JS) : frame sizes, durées, marqueurs combat
   - Pour chaque animation : découper le spritesheet en frames par direction
   - Générer un atlas Phaser unique (1 JSON + 1 PNG) avec toutes les animations
   - Télécharger le portrait sheet, extraire le(s) portrait(s) voulus
   - Télécharger `credits.txt` pour l'attribution
3. Écrire dans `packages/renderer/public/assets/sprites/pokemon/<name>/` :
   - `atlas.json` — Phaser atlas descriptor
   - `atlas.png` — spritesheet combiné
   - `portrait.png` — portrait Normal (40x40)
   - `credits.txt` — attribution artiste

**Config initiale** (`scripts/sprite-config.json`) :
```json
{
  "pokedexEntries": [
    { "number": "0001", "name": "bulbasaur" },
    { "number": "0004", "name": "charmander" },
    { "number": "0007", "name": "squirtle" },
    { "number": "0016", "name": "pidgey" }
  ],
  "animations": ["Idle", "Walk", "Attack", "Hurt", "Faint"],
  "portraits": ["Normal"],
  "directions": ["South", "SouthEast", "East", "NorthEast", "North", "NorthWest", "West", "SouthWest"],
  "outputDir": "packages/renderer/public/assets/sprites/pokemon"
}
```

**Dépendances** : `sharp` (manipulation d'images), `fast-xml-parser` (parse AnimData.xml). Dev dependencies du root.

**Tests** : pas de tests unitaires pour le script (outil de build one-shot), mais validation en sortie (vérifier que l'atlas est valide, toutes les frames présentes).

---

## Étape 2 — Crédits et licence

**But** : Respecter CC BY-NC 4.0 avec attribution correcte.

**Fichiers** :
- `CREDITS.md` à la racine du repo — section PMDCollab avec lien, licence, et crédits par Pokemon
- `packages/renderer/public/assets/sprites/pokemon/<name>/credits.txt` — copie du fichier PMDCollab par Pokemon
- Mention dans le README existant (section Sources/Crédits déjà présente)

**Contenu CREDITS.md** :
```markdown
# Crédits

## Sprites Pokemon
Source : [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
Licence : [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)

### Artistes par Pokemon
- Bulbasaur : [artiste depuis credits.txt]
- Charmander : [artiste depuis credits.txt]
- Squirtle : [artiste depuis credits.txt]
- Pidgey : [artiste depuis credits.txt]
```

---

## Étape 3 — Preload des assets dans Phaser

**But** : Charger les atlas et portraits au démarrage du jeu.

**Changements** :
- `BattleScene.preload()` — charger les atlas pour chaque Pokemon du combat
- Le preload doit être dynamique (basé sur les Pokemon présents, pas hardcodé)
- Registre des animations Phaser créé après le chargement

**Nouveau fichier** : `packages/renderer/src/sprites/SpriteLoader.ts`
- `preloadPokemonAssets(scene, pokemonIds[])` — charge atlas + portrait
- `createAnimations(scene, pokemonId)` — crée les animations Phaser depuis les metadata de l'atlas

**Format des clés d'animation** : `{pokemonId}-{anim}-{direction}` (ex: `bulbasaur-idle-south`)

---

## Étape 4 — Refactor PokemonSprite : cercle → sprite animé

**But** : Remplacer le cercle Graphics par un Phaser.Sprite avec animations.

**Changements dans `PokemonSprite.ts`** :
- Le `circle` (Graphics) → `sprite` (Phaser.GameObjects.Sprite)
- Jouer `idle` par défaut, `walk` pendant le déplacement, `attack` sur attaque, `hurt` sur dégâts, `faint` sur KO
- Conserver la barre de PV (Graphics) au-dessus du sprite
- Conserver le container + depth + tweens existants
- Ajouter `setDirection(direction)` pour changer l'orientation du sprite (4→8 directions)
- Fallback : si l'atlas n'est pas chargé, revenir au cercle coloré (robustesse)

**Mapping direction core → PMDCollab** :
- Le core a 4 directions (North, South, East, West)
- PMDCollab a 8 directions — on utilise les 4 cardinales, extensible vers 8 plus tard

---

## Étape 5 — Intégration portraits dans l'UI

**But** : Afficher le portrait dans l'InfoPanel et la TurnTimeline.

**Changements** :
- `InfoPanel` : ajouter le portrait 40x40 à gauche du nom/PV
- `TurnTimeline` : remplacer les cercles colorés par les portraits (scaled down)
- Preload des portraits dans la même passe que les atlas

---

## Étape 6 — Vérification visuelle + polish

**But** : S'assurer que tout s'affiche correctement.

- Lancer `visual-tester` pour vérifier le rendu
- Ajuster taille/ancrage des sprites sur la grille isométrique
- Ajuster depth sorting si nécessaire
- Vérifier les animations dans tous les cas (move, attack, damage, KO)

---

## Résumé des fichiers

| Action | Fichier |
|--------|---------|
| Créer | `scripts/extract-sprites.ts` |
| Créer | `scripts/sprite-config.json` |
| Créer | `CREDITS.md` |
| Créer | `packages/renderer/src/sprites/SpriteLoader.ts` |
| Modifier | `packages/renderer/src/sprites/PokemonSprite.ts` |
| Modifier | `packages/renderer/src/scenes/BattleScene.ts` |
| Modifier | `packages/renderer/src/ui/InfoPanel.ts` |
| Modifier | `packages/renderer/src/ui/TurnTimeline.ts` |
| Modifier | `packages/renderer/src/constants.ts` |
| Généré | `packages/renderer/public/assets/sprites/pokemon/*/atlas.json` |
| Généré | `packages/renderer/public/assets/sprites/pokemon/*/atlas.png` |
| Généré | `packages/renderer/public/assets/sprites/pokemon/*/portrait.png` |
| Généré | `packages/renderer/public/assets/sprites/pokemon/*/credits.txt` |

---

## Risques

- **Phaser 4 RC6** : API atlas/animation peut différer légèrement de Phaser 3. Vérifier la doc.
- **Taille des sprites** : les frames PMDCollab sont petites (32x32 à 72x80). Peut nécessiter un scale up pour être lisible sur la grille iso.
- **8 directions × 5 anims × 4 Pokemon** = ~160 séquences d'animation. L'atlas doit rester < 2048x2048.
