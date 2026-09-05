---
name: e2e-status
description: Donne le verdict de la suite e2e asynchrone qui tourne sur GitHub — verte ou rouge, depuis quand, et quel commit l'a cassée. À lire au démarrage d'une session.
user-invocable: true
---

Tu rapportes l'état de la suite e2e **asynchrone** (`.github/workflows/e2e.yml` : 531 tests,
8 tranches, ~5 min de mur, jamais bloquante).

## Exécution

```bash
pnpm e2e:status
```

## Ce que tu en fais

Le script répond déjà à « depuis quand ? » et « quel commit ? » — ne te contente pas de recopier sa
sortie, agis dessus :

- **Verte** → une ligne, et tu passes à la suite. Pas de cérémonie.
- **Rouge, transition récente** (« elle vient de passer au rouge ») → c'est le commit nommé qu'il
  faut regarder. Lis `gh run view <id> --log-failed`, dis **quel test** casse et **pourquoi**, puis
  propose : corriger maintenant, ou noter et continuer. Ne corrige pas d'autorité si l'humain était
  parti sur autre chose.
- **Rouge depuis plusieurs exécutions** → dis-le franchement, avec l'ancienneté. Une suite
  asynchrone qu'on laisse rouge cesse d'être un filet : c'est le piège documenté n°1 de ce modèle.
  À ce stade la remettre au vert passe avant le reste.
- **Aucune exécution** → le workflow n'a pas encore tourné sur `main` (normal tant que la branche
  n'est pas fusionnée). Dis-le sans en faire un incident.

## Pourquoi ne pas simplement regarder si c'est vert

Parce qu'on s'habitue à répondre « oui, sûrement ». Le script signale les **changements** d'état,
pas chaque exécution — c'est la parade documentée contre la fatigue d'alerte, et c'est ce qui rend
un rouge lisible.

## Garde-fou de publication

**Pas de `/publish` si la dernière exécution est rouge.** C'est la contrepartie d'avoir sorti la
suite complète du chemin bloquant : elle ne retarde plus rien, mais son verdict compte toujours.
