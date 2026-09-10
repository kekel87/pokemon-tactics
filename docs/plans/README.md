# Plans d'exécution

## Où sont les plans

**Un plan terminé n'est pas un fichier.** Les 198 plans clos vivent dans le **graphe de mémoire** —
une entité `plan-<numéro>` par plan, reliée par `cite` aux décisions qu'elle mentionne :

```bash
node scripts/memory/query.mjs "mots-clés du sujet"    # quel plan a traité X ?
node scripts/memory/query.mjs --open plan-199         # un plan et ses décisions
node scripts/memory/query.mjs --open index-plans-1    # l'index, par tranches de 40
```

Un plan terminé est de l'**histoire** : ce qu'on a décidé, et ce qu'on a trouvé en le faisant. Il ne
décrit pas le système tel qu'il est — c'est le rôle de `docs/architecture.md` et consorts. Le fichier
d'origine reste dans l'historique git si le détail littéral est nécessaire.

🔴 **Le critère de migration est « travaille-t-on encore dessus ? », pas le statut écrit en en-tête.**
Huit plans portaient `draft` ou `in-progress` avec un dernier commit en avril-juin : un en-tête périmé
n'est pas une raison de garder un fichier.

## Statuts

- **draft** — en cours de rédaction / discussion
- **ready** — validé, prêt à exécuter
- **in-progress** — en cours d'exécution
- **done** / **abandoned** — part au graphe, le fichier est supprimé

## Plans encore sous forme de fichier

Les seuls sur lesquels on travaille.

| # | Plan | Statut |
|---|------|--------|
| 195 | [Plan 195 — Phase 7 « Multijoueur & télémétrie » (plan-cadre)](./195-phase7-multijoueur-telemetrie.md) | done |
| 200 | [Plan 200 — Étape 0 : batterie de restitution (ligne de base)](./200-etape0-restitution.md) | done |
| 200 | [Plan 200 — Méthode de travail et système de mémoire](./200-methode-et-memoire.md) | done |
| 202 | [Plan 202 — Lot B3 : robustesse du multijoueur](./202-lot-b3-robustesse-multijoueur.md) | done |
| 203 | [Plan 203 — Lot B4 : détection de désynchronisation](./203-lot-b4-detection-desync.md) | done |
| 204 | [Plan 204 — Télémétrie : une partie en ligne compte pour une](./204-telemetrie-parties-en-ligne.md) | done |
| 205 | [Plan 205 — Le retour du navigateur remonte d'un écran](./205-retour-navigateur.md) | done |
| 206 | [Plan 206 — Passe tactile : le plancher de 30 px tenu partout](./206-passe-tactile-plancher-30px.md) | done |
