---
status: done
created: 2026-04-03
updated: 2026-04-03
---

# Plan 030 — Internationalisation FR/EN

## Objectif

Ajouter un système i18n maison dans le renderer pour supporter FR et EN, avec détection automatique du navigateur, persistance du choix en localStorage, et changement dynamique sans rechargement de page.

## Contexte

La Phase 2 (Démo jouable) cible un public large via un lien partageable. L'UI actuelle est un mélange incohérent de FR et EN. Avant d'ajouter le menu principal et les feedbacks visuels, il faut unifier la langue de l'interface. Aucune lib externe n'est justifiée pour <300 clés et 2 langues — une solution maison de ~50 lignes suffit. Le core reste i18n-free : il émet des events avec des IDs, le renderer traduit.

## Étapes

- [ ] Étape 1 — Créer le système i18n dans `packages/renderer/src/i18n/`
  - Créer `packages/renderer/src/i18n/types.ts` : type `Language = 'fr' | 'en'`, interface `Translations` avec toutes les clés UI typées
  - Créer `packages/renderer/src/i18n/locales/fr.ts` : objet conforme à `Translations` avec tous les textes français
  - Créer `packages/renderer/src/i18n/locales/en.ts` : objet conforme à `Translations` avec tous les textes anglais
  - Créer `packages/renderer/src/i18n/index.ts` : fonctions `t(key)`, `setLanguage(lang)`, `detectLanguage()` (navigator.language → 'fr' si commence par 'fr', sinon 'en'), `getLanguage()`, `onLanguageChange(callback)` + persistance localStorage sous la clé `'pt-lang'`
  - Créer `packages/renderer/src/i18n/index.test.ts` : tester `t()` sur une clé existante et inexistante (fallback EN), `setLanguage()` + `getLanguage()`, `detectLanguage()` avec mocks navigator.language ('fr-FR' → 'fr', 'en-US' → 'en', 'ja-JP' → 'en'), persistance localStorage, callback `onLanguageChange`

- [ ] Étape 2 — Créer `packages/data/src/i18n/moves.en.json` et `pokemon-names.fr.json` / `pokemon-names.en.json`
  - Créer `packages/data/src/i18n/moves.en.json` : map `move-id → nom EN` pour les 72 moves du roster actuel (utiliser les noms du champ `name` dans les fichiers `packages/data/src/moves/*.ts`, qui sont déjà en anglais)
  - Créer `packages/data/src/i18n/pokemon-names.fr.json` : map `pokemon-id → nom FR` pour les 21 Pokemon du roster (Bulbasaur→Bulbizarre, Charmander→Salamèche, Squirtle→Carapuce, Pidgey→Roucool, Pikachu→Pikachu, Machop→Machoc, Abra→Abra, Gastly→Fantominus, Geodude→Racaillou, Growlithe→Caninos, Jigglypuff→Rondoudou, Seel→Otaria, Eevee→Évoli, Tentacool→Tentacool, Nidoran-M→Nidoran♂, Meowth→Miaouss, Magnemite→Magnéti, Sandshrew→Sabelette, Lickitung→Excelangue, Kangaskhan→Kangourex, Dummy→Dummy)
  - Créer `packages/data/src/i18n/pokemon-names.en.json` : map `pokemon-id → nom EN` (même id → nom anglais officiel tel qu'il apparaît dans les données)
  - Exporter ces 4 fichiers depuis `packages/data/src/i18n/index.ts` (créer ce fichier s'il n'existe pas)

- [ ] Étape 3 — Migrer `ActionMenu.ts` et `BattleUI.ts`
  - Dans `ActionMenu.ts` : remplacer les 7 textes hardcodés (Deplacement, Attaque, Objet, Attendre, Status, Annuler, etc.) par des appels `t('action.move')`, `t('action.attack')`, etc.
  - Dans `BattleUI.ts` : remplacer les 4 textes hardcodés (Player 1/2, Round N, wins!, Restart) par des appels `t('battle.player')`, `t('battle.round')`, `t('battle.wins')`, `t('battle.restart')`
  - Dans les deux fichiers : s'abonner à `onLanguageChange()` pour re-rendre les textes (appeler la méthode de mise à jour des textes Phaser)

- [ ] Étape 4 — Migrer `InfoPanel.ts`, `MoveTooltip.ts` et `TurnTimeline.ts`
  - Dans `InfoPanel.ts` : remplacer les 7 labels stats (Atk, Def, SpA, SpD, Spd, Acc, Eva) par `t('stat.atk')` etc. + noms Pokemon via `pokemonNames[lang][id]`
  - Dans `MoveTooltip.ts` : remplacer les 9 noms de patterns FR et les 3 labels (Puis, Préc, Portée) par des clés i18n (`t('pattern.single')`, `t('move.power')`, etc.) + noms de moves via `moves[lang][id]`
  - Dans `TurnTimeline.ts` : remplacer le texte dynamique par un appel `t()`
  - Dans les trois fichiers : s'abonner à `onLanguageChange()`

- [ ] Étape 5 — Migrer `PlacementRosterPanel.ts` et `SandboxPanel.ts`
  - Dans `PlacementRosterPanel.ts` : remplacer "Player N — Place a Pokemon" par `t('placement.instruction', { player: N })`
  - Dans `SandboxPanel.ts` : remplacer les 30+ textes FR (statuts, directions, boutons, labels) par leurs clés i18n correspondantes
  - Dans les deux fichiers : s'abonner à `onLanguageChange()`

- [ ] Étape 6 — Ajouter un bouton bascule FR/EN dans l'UI
  - Ajouter un bouton "FR / EN" en overlay (coin supérieur droit ou dans la toolbar sandbox) dans `packages/renderer/src/ui/LanguageToggle.ts`
  - Le bouton appelle `setLanguage()` en alternant les deux langues
  - Le bouton affiche la langue active (ex : "FR" si actif = FR)
  - Intégrer `LanguageToggle` dans la scène principale et la scène sandbox

## Critères de complétion

- `pnpm test` passe avec les nouveaux tests i18n (min. `t()`, `setLanguage()`, `detectLanguage()`)
- Toute l'UI est en FR par défaut si le navigateur est FR, en EN sinon
- Cliquer sur le bouton bascule change immédiatement tous les textes visibles sans rechargement
- Le choix de langue persiste après un F5 (localStorage)
- Aucun texte hardcodé ne subsiste dans les 7 fichiers renderer migrés
- `moves.fr.json` existant est réutilisé sans modification

## Risques / Questions

- Phaser 4 : les `Text` objects ne se mettent à jour qu'en appelant `.setText()` — chaque composant doit stocker une référence à ses Text objects pour les rafraîchir via le callback `onLanguageChange()`
- `SandboxPanel.ts` contient 30+ textes, dont certains sont construits dynamiquement (ex : listes de statuts, directions) — vérifier que les clés couvrent bien les cas dynamiques avant de commencer l'étape 5
- Les noms de moves EN dans `moves.en.json` doivent correspondre exactement aux IDs dans `moves.fr.json` — utiliser les mêmes IDs (slugs kebab-case) comme clés
- Si un move ou Pokemon est ajouté au roster, il faut penser à mettre à jour les 4 fichiers JSON

## Dépendances

- Plan 029 terminé (IA) — pas de dépendance technique, mais c'est la suite logique Phase 2
- Ce plan débloque : Menu principal + Settings (plan suivant en Phase 2), qui aura besoin du système i18n pour afficher les options de langue
