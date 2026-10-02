---
name: recette
description: Mode interactif de recette humaine (human-testing) — passe multi-entrée mesurée, puis un scénario sandbox à la fois, lancé par Claude, validé par l'humain. À invoquer quand l'humain répond `oui` à l'arrêt 1 (« Tu testes ? »).
---

Je ne dump pas tout, je déroule **un scénario à la fois**, je lance, tu regardes, tu valides.

0. **Passe multi-entrée, MESURÉE, avant de te déranger** — quand le diff touche un contrôle
   d'interface (`packages/app/src/ui/**`, `packages/app/src/styles/**`, `packages/ui-dom/**`). Le jeu
   se joue souris, clavier, manette et doigt, du téléphone à la 4K : je vérifie **moi-même**, au
   chrome-devtools sur Chromium, avant de te faire tester. Quatre axes : **clavier** (atteint aux
   flèches, par de vraies pressions depuis un contrôle voisin — jamais `.focus()` sur la cible),
   **manette**, **tactile** (hit-area ≥ 30 px sous `pointer: coarse`), **responsive** (568×320,
   667×375, 1024×768, 1920×1080, 2560×1440 — débordement, chevauchement, hit-areas). 🔴 **Mesurer,
   jamais supposer** : origine plan 198, une media query ajoutée « au cas où » que la mesure a montrée
   inutile. Détail et recette : `.claude/rules/multi-input.md`. Ce que je trouve, je le corrige ou je
   te le remonte **avant** les scénarios — pas la peine de te faire tester un écran cassé au pad.
1. Analyse `git diff HEAD` → scénarios observables (noms FR).
2. Par scénario : construis la config JSON **minimale** (seuls les champs nécessaires au scénario, le reste = défauts), moves/Pokemon validés (`packages/data` ; doute → agent `sandbox-json`). **Jamais coller la commande à l'humain.** Si le scénario demande à l'humain d'agir/déplacer/attaquer **avec la cible (Dummy)** → mettre `"dummyControl": "player"` (+ `dummyMoves`), **jamais laisser le défaut `"ai"`** (l'humain ne pourrait pas la contrôler).
3. **Boucle** : (a) **je lance moi-même** le serveur via `Bash run_in_background` (`pnpm dev:sandbox '{...}'` ; HMR ne suffit pas — config bakée à l'env au boot, donc relancer le process à chaque scénario). Port du checkout : `PT_PORT` env → `.worktree-port` à la racine → sinon `5173` (cf `vite.config.ts`) ; **en worktree c'est PAS 5173**. **Avant chaque relance : j'arrête d'abord MON process sandbox précédent** (`TaskStop` du background task — sûr et indépendant du port) pour **réutiliser le même port — jamais laisser vite incrémenter** (5174, 5175…). Je cible **uniquement mon process sandbox** : jamais un navigateur de l'humain, jamais son serveur dev global. (b) résumé en chat — **URL** (`http://localhost:<port résolu>`) + **quoi tester** (1-2 lignes) + **résultat attendu** (noms FR) ; (c) **pause**, tu testes ; (d) ta réponse `suivant`/`ok` → scénario suivant ; bug/retour → on traite avant de continuer.
4. Tous scénarios validés → arrêt 2, le menu (skill `/menu`).
