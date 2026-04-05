# Move Pattern Designer — Connaissances acquises

> Lire avant d'analyser des patterns. Evite de re-debattre des decisions deja tranchees.
> Mettre a jour apres chaque session.

## Decisions tranchees (ne pas re-debattre)

Voir `docs/reflexion-patterns-attaques.md` pour le tableau complet et les justifications.
Voir `docs/decisions.md` decisions #108-112 pour les patterns slash/blast et les mecaniques speciales.

## Patterns disponibles dans le code

| Pattern | Comportement | Moves typiques |
|---------|-------------|----------------|
| single | 1 cible a portee | Flammeche, Tonnerre, Psyko |
| self | sur soi-meme | Repos, Danse Lames |
| cone | triangle 3 tiles devant | Rugissement, Hurlement |
| cross | croix 4 directions | Lance-Flammes |
| line | ligne droite | Ultralaser |
| dash | deplacement + frappe | Charge, Vive-Attaque |
| zone | cercle autour du caster | Seisme |
| slash | arc 3 tiles devant | Tranche, Draco-Queue |
| blast | projectile + explosion | Ball'Ombre (pas dans le roster actuel) |

## Heuristique de decision

1. Le nom du move evoque-t-il un mouvement directionnel ? -> dash
2. Le move touche-t-il "autour" du lanceur ? -> zone
3. Le move est-il un balayage/arc ? -> slash
4. Le move est-il un projectile lineaire ? -> line
5. Le move est-il un souffle/cri ? -> cone
6. Par defaut -> single

## Preferences du directeur creatif

(A remplir au fil des sessions)

## Roster actuel et mix de patterns

20 Pokemon jouables + 1 Dummy, 72 moves. Voir `docs/roster-poc.md` pour la liste complete.
