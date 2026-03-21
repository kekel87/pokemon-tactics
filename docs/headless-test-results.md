# Résultats des tests headless IA — Pokemon Tactics

> Date : 2026-03-21
> Objectif : valider que le core fonctionne de bout en bout (boucle de combat, KO, victoire) sans renderer.
> Les scripts de test (`ai-battle.ts` et la version smart) étaient temporaires et ont été supprimés après validation.

---

## Contexte

Deux combats IA ont été lancés en headless (pure logique core, sans Phaser) sur la grille 12x12 avec le roster POC complet.

---

## Combat 1 — IA Random

| Paramètre | Valeur |
|-----------|--------|
| Équipe 1 (P1) | Bulbasaur + Squirtle |
| Équipe 2 (P2) | Charmander + Pidgey |
| Type d'IA | Random (action aléatoire parmi les actions légales) |
| Résultat | **Player 1 gagne** |
| Durée | **58 rounds** |

### Observations

- La boucle tourne sans crash, KO gérés, victoire détectée proprement via `BattleEnded`.
- **Friendly fire fréquent** : Pidgey (Quick Attack dash) attaque Charmander allié, Squirtle (Bubble Beam zone) arrose Bulbasaur allié. Comportement attendu — le friendly fire est une décision de design (#2).
- **Attaques dans le vide** : PP gaspillés quand aucune cible n'est à portée. L'IA random ne filtre pas les attaques vides car elle tire au hasard parmi les `use_move` légaux — une attaque est considérée légale même sans cible dans la zone (le targeting résoud une liste vide, ce qui revient à "rien ne se passe").
- Squirtle termine le combat à **44/44 HP** (intact) — déséquilibre de positions ou de RNG.

---

## Combat 2 — IA Smart (heuristique)

| Paramètre | Valeur |
|-----------|--------|
| Équipe 1 (P1) | Bulbasaur + Pidgey |
| Équipe 2 (P2) | Charmander + Squirtle |
| Type d'IA | Heuristique (score par action : dégâts estimés, distance cible, PP restants) |
| Résultat | **Player 2 gagne** |
| Durée | **67 rounds / ~200 actions** |

### Observations

- **Bug heuristique majeur** : le score des attaques était calculé sans vérifier si une cible était effectivement à portée. Les `use_move` étaient scorés plus haut que les déplacements, donc l'IA choisissait systématiquement une attaque — même sans ennemi dans la zone. Résultat : tous les PP brûlés pendant ~60 rounds avant le premier déplacement.
- **Correction** : utiliser `getLegalActions()` pour filtrer les attaques qui retournent une liste de cibles vide avant de calculer le score. L'API expose déjà l'information.
- **Sludge Bomb trop forte** : Pidgey (40 HP) reçoit **112 dégâts** d'une Sludge Bomb — ratio 2.8x ses PV. Efficacité de type Poison sur Normal (x1), pas de résistance. La puissance de base de Sludge Bomb (90) combinée aux stats Atk Spé de Bulbasaur génère ce ratio. À surveiller : question ouverte déjà documentée (Bombe-Beurk trop forte).

---

## Bilan

### Ce qui est validé
- Boucle de combat complète : `startBattle` → rounds → actions → ticks → KO → `BattleEnded`
- Gestion des KO : retrait du turn order, libération des tiles, rupture des liens
- Condition de victoire : dernière équipe debout gagne, combat verrouillé ensuite
- API `getLegalActions` : cohérente, utilisable par une IA
- Aucun crash, aucune boucle infinie

### Points à traiter avant ou pendant le renderer

| Priorité | Sujet | Action |
|----------|-------|--------|
| Haute | Bug heuristique IA | Filtrer les attaques sans cible via `getLegalActions` avant de scorer |
| Moyenne | Sludge Bomb (Bulbasaur) | Ajuster le balance override — dégâts trop élevés pour le roster POC |
| Basse | Friendly fire IA | Comportement normal, mais à garder en tête pour le tutoriel |

### Prochaine étape recommandée

Renderer Phaser (Phase 0) : le core est prêt. Les observations IA sont des bugs d'heuristique, pas de core.
