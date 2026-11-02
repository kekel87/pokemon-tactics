---
name: next
description: Reconstitue l'état du projet depuis le graphe de mémoire, propose 2-3 candidats et une recommandation.
---

**D'abord** : `pnpm e2e:status` — la suite e2e complète tourne en asynchrone sur GitHub et ne
bloque plus rien, donc personne ne voit son verdict si on ne le lit pas. Rouge → tu le dis en
premier, avant l'agenda. Détail dans le skill `/e2e-status`.

**Ensuite** : `git fetch origin`, puis compare `main`, `origin/main` et les branches locales.
Origine de cette règle : une session est repartie sur un `main` en retard de 2 commits, a relu des
docs périmées et a commencé à réimplémenter un plan déjà livré.

## L'état vient du graphe de mémoire, plus de fichiers

`STATUS.md` et `docs/next.md` n'existent plus : leur contenu est dans le graphe (plan 200).

### 🔴 Commence TOUJOURS par le pointeur, jamais par une recherche

```bash
node scripts/memory/query.mjs --open agenda-prochaine-etape-courante
```

**Nom stable, réécrit à chaque fin de session : c'est le seul endroit qui dit où on en est.** Tout
le reste du graphe est de l'histoire.

⚠️ **Ne cherche pas « la prochaine étape » par mots-clés.** Ça ne marche pas, et l'échec est
silencieux : le 2026-09-10, une session neuve a interrogé « à faire maintenant prochaine action »
et est tombée sur `agenda-2026-09-06-prochaine-etape` et `agenda-2026-09-08-prochaine-etape`, tous
deux périmés — le premier réclamait un commit fait depuis quatre jours. La file de sessions écrite
le matin même était, elle, **introuvable** : son nom ne contenait aucun de ces mots. Ce qu'on
cherche — « le plus récent » — n'est pas un mot, donc aucune recherche plein-texte ne le trouvera.
Les entités périmées portent désormais un `⛔ PÉRIMÉ` en tête ; si tu en croises une, ne la suis pas.

### Ensuite seulement, pour creuser un sujet

2 à 4 mots-clés distinctifs, jamais une phrase :

```bash
node scripts/memory/query.mjs --stats
node scripts/memory/query.mjs "reporté backlog technique"
node scripts/memory/query.mjs --open <nom-d-entité>
```

Types d'entités utiles ici : `agenda` (l'agenda persistant), `historique` (le journal de session),
`backlog` (dette ouverte), `retour` (ce que les joueurs ont dit du jeu, encore non traité),
`decision` (les ~930 décisions numérotées), `feedback` (les règles de
travail données par l'humain).

🔴 **Le mode recherche tronque les observations.** Dès qu'une entrée compte, relis-la avec `--open`,
sinon tu perds la fin — c'est comme ça qu'on rate un chiffre.

Lis ensuite, seulement si le sujet l'exige : `docs/roadmap.md` (phases), `docs/plans/README.md`
(index des plans), et le plan en cours s'il y en a un (`in-progress` ou `ready`).

## Présente

**1. À faire maintenant** — **2-3 candidats** tirés de l'agenda, croisés avec la roadmap et le plan
en cours, puis **une recommandation** claire parmi eux. Une ligne par candidat.

**2. Reporté / à refaire** — les entités `agenda` et `backlog` encore ouvertes. Si rien, le dire.
Puis une ligne **« Retours ouverts »** : chaque `retour` avec sa source (qui) et sa date.

🔴 **Lister, ne pas chercher** : `node scripts/memory/query.mjs --type retour` et `--type backlog`
rendent la liste COMPLÈTE. Ne jamais conclure « rien d'ouvert » sur la foi du pointeur ni d'une
recherche par mots-clés — le 2026-10-06, le pointeur disait « aucun backlog ouvert » pendant que
deux retours de joueurs (frère, Frank) attendaient depuis trois semaines, rangés dans des types que
ce skill ne lisait pas (plan 231).

**3. Fait récemment** — 3 à 5 items. Croiser avec `git log -5` pour repérer les incohérences.

**4. Bloquants** — questions à trancher avant de démarrer, si applicable.

Concis : 10-15 lignes au total.

---

## Après le choix : le workflow à deux arrêts

Ce skill est la source de vérité de tout ce qui suit le choix, jusqu'à l'arrêt 1. L'arrêt 2 vit dans `/menu`.
Entre un choix et la recette, Claude ne s'arrête jamais : un arrêt de plus (fin de phase, « je continue ? »,
« je commit le plan ? ») coûte un aller-retour à l'humain, qui fait autre chose en parallèle.

1. **Le choix.** Que l'humain confirme un candidat directement ou qu'un choix sorte d'une discussion, la suite
   est la même. Ne jamais partir coder après une discussion. Si l'intention reste floue, skill `/restate` d'abord.
2. **Le plan.** `docs/plans/xxx-name.md`, avec en tête « Ce que tu verras à l'écran » : 3 à 5 lignes du résultat
   observable. Afficher ces lignes EN CHAT avec un seul `AskUserQuestion` : `plan-reviewer` (toujours coché),
   `game-designer` (coché si mécaniques de jeu). L'humain ne lit jamais le fichier : ces lignes sont son seul
   point de contrôle avant que tout soit codé. Jamais d'option « commiter le plan » : il part avec la feature.
   Critère : l'humain a répondu au menu de plan.
3. **Le dev, d'un trait.** Tout implémenter sans reprendre la parole : pas de phase, pas de point d'étape, pas
   de commit intermédiaire. Pendant le dev : le code, les tests unitaires du core (mécanique pure : dégâts,
   règles, traversée), `typecheck`, la passe multi-entrée mesurée si un contrôle d'interface bouge, puis
   `/simplify` en dernier, avant la recette (ce qu'il réécrit est ainsi couvert par la recette). Pas pendant
   le dev : `/ci-gate`, `pnpm build`, e2e, tests hors core, lint de finition, commits ; ce sont des cases du
   menu. Critère : `typecheck` vert, tests du core verts.
4. **Coupe-circuit de dérive**, seule exception au dev d'un trait : si l'exécution s'écarte sérieusement du
   plan (dépendance nouvelle, fichier hors périmètre, mécanique non prévue, hypothèse démentie par le code),
   s'arrêter et remonter. Une gêne, une idée ou une hésitation de style ne déclenchent rien.
5. **Arrêt 1, la recette.** `git status --porcelain`, résumé court, puis une seule question `AskUserQuestion` :
   « Tu testes ? » (`oui` / `non`), avec le nombre de scénarios prévus, jamais une durée. Rien d'autre à cet
   arrêt. `oui` : skill `/recette`, un scénario à la fois, jusqu'à validation. Ensuite, ou sur `non` : `/menu`.

Trouvailles en route : besoin d'une décision de l'humain (design, arbitrage, priorité) → en discuter tout de
suite ; sinon (bug évident, nettoyage dans le périmètre) → avancer. Aucun reste à faire ajouté de sa propre
initiative : ni TODO, ni « suites possibles », ni backlog ou agenda au graphe sans accord explicite (hook
`block-backlog-write.py` ; seule sortie : la clôture, `PT_CLOTURE=1`).
