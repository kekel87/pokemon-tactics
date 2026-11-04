---
name: relire-plan
description: Relit un plan de `docs/plans/` qui vient d'être écrit, avant le dev : en-tête observable, critères testables, fichiers et décisions cités qui existent. À lancer au menu de plan de `/next`, ou quand l'humain demande de relire un plan.
user-invocable: true
---

Le regard neuf sur les mécaniques, c'est `game-designer` ; ce skill vérifie ce qui se vérifie.

## Étapes

1. Lire le plan en entier.
2. En-tête « Ce que tu verras à l'écran » : présent en tête, 3 à 5 lignes, chacune observable par l'humain en
   jouant (pas un nom de fichier ni de fonction), noms FR officiels.
   Critère : chaque ligne dit ce qu'on voit ou fait, pas ce que le code fait.
3. Critères de fin : chacun dit comment on le constate (test nommé, mesure, scénario de recette).
   Critère : aucun critère du type « ça marche bien ».
4. Fichiers cités : ils existent, sauf ceux que le plan annonce comme à créer.
   ```bash
   grep -oE '`[a-zA-Z0-9_./-]+\.(ts|md|mjs|json|tmj|css|py|sh)(:[0-9]+)?`' <plan> | tr -d '`' | cut -d: -f1 | sort -u | while read -r f; do [ -e "$f" ] || git ls-files | grep -q "/$f$" || echo "absent : $f"; done
   ```
   Critère : chaque « absent » est soit corrigé, soit annoncé comme à créer.
5. Décisions et plans cités : `node scripts/memory/query.mjs --open <nom>` pour chacun ; le plan ne
   contredit pas une décision en vigueur sans dire qu'il la remplace.
6. Corriger dans le plan les seuls points relevés, rien d'autre. Rapport : un écart par ligne avec sa ligne
   du plan ; sinon « aucune anomalie détectée par les règles connues, non exhaustif ».
