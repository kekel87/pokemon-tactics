# Mettre le wiki à jour

À lire à l'étape 7 de `/consigner`, ou après une release depuis `/publish`.

Le wiki (`kekel87/pokemon-tactics.wiki`) est la documentation joueur. `wiki/` à la racine est un clone
ordinaire, ignoré par le dépôt et que rien ne tient à jour.

1. Aligner le clone avant toute écriture :
   ```bash
   git -C wiki fetch origin
   git -C wiki rev-list --left-right --count origin/master...HEAD   # attendu : 0	0
   git -C wiki merge-base HEAD origin/master                        # attendu : un SHA
   ```
   Un écart ou une base vide : s'arrêter et le dire à l'humain. Jamais de push forcé, qui écraserait le
   wiki en ligne ; remettre le clone d'aplomb lui revient.
2. Trouver les pages touchées. Chaque page existe en anglais et en français (`Mechanics.md` /
   `Mécaniques.md`, `How-to-Play.md` / `Comment-jouer.md`, `Controls.md` / `Contrôles.md`,
   `Maps.md` / `Cartes.md`, `Home.md` / `Accueil.md`, `Roadmap.md` / `Feuille-de-route.md`,
   `Changelog.md` / `Changelog-FR.md`). Une release touche toujours Changelog et Roadmap.
3. Écrire pour le joueur, sans détail d'implémentation : la règle telle qu'il la vit, chiffres tirés du code.
   Anglais avec le nom FR officiel entre parenthèses ; page française avec le nom FR. Roadmap alignée sur
   `docs/roadmap.md`, sans sujet interne ni chiffre de télémétrie.
   Critère : la page anglaise et la page française disent la même chose.
4. Après une release, aucune version sans son entrée :
   ```bash
   diff <(gh release list --limit 50 --json tagName --jq '.[].tagName' | sort -V) \
        <(grep -o '^## v[0-9.]*' wiki/Changelog.md | sed 's/^## //' | sort -V)
   diff <(grep -o '^## v[0-9.]*' wiki/Changelog.md) <(grep -o '^## v[0-9.]*' wiki/Changelog-FR.md)
   ```
5. Montrer le diff à l'humain. Commit et push du wiki seulement avec son accord.
