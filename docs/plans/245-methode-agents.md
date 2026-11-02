# Plan 245 : appliquer la méthode agents de l'humain

**Statut** : fait (2026-11-02), sauf le branchement du hook `require-agent-model.py` par l'humain. Validé par l'humain le 2026-11-02.
**Source** : `~/Documents/claude-assistant/docs/methode-agents-2026-11-02.md` (sections 1 à 7).
**Lié** : plan 244 (repli des sous-agents), qui porte la section 4, `/memo` et la revue unique.

## Ce que tu verras à l'écran

- Un `CLAUDE.md` de ~100 lignes au lieu de 269 ; le workflow détaillé vit dans `/next` et `/menu`.
- Un fichier de style chargé à chaque session (ton, questions fermées, « fait » = vérifié sur le vrai résultat).
- Trois nouveaux skills : `/bug`, `/lesson`, `/restate`.
- Les tirets cadratins refusés dans les fichiers d'instructions ; une délégation sans modèle refusée.

## Décisions de l'humain (2026-11-02)

1. Fichiers d'instructions en français, sans tiret cadratin.
2. Workflow « deux arrêts » déplacé de `CLAUDE.md` vers `/next` et `/menu`.
3. `tools:` gardé sur les agents relecteurs (seule limite par agent qui garantit la lecture seule en parallèle).
4. Nouveaux skills : `/bug`, `/lesson`, `/restate` (appelé par `/next`).

## Journal (un commit par changement)

| # | Changement | Pourquoi | Mesure |
|---|---|---|---|
| 1 | `CLAUDE.md` réécrit : règle d'écriture en tête, workflow vers `/next` (jusqu'à l'arrêt 1) et `/menu` (arrêt 2), parallélisme vers `docs/methodology.md`, récits d'incidents retirés | Texte chargé à chaque tour ; le workflow ne sert qu'à `/next` et `/menu` | 269 → 103 lignes, 18 867 → 6 341 car., 40 → 0 tirets cadratins |
| 2 | `.claude/rules/style.md` (sans `paths:`, chargé à chaque session) : ton, questions fermées, « fait » = vérifié, vocabulaire des rapports | Section 2 de la méthode ; ces règles valent partout | 1 fichier, 20 lignes |
| 3 | Skill `/bug` : test rouge sur le symptôme exact avant toute théorie, correctif, test gardé | Remplace l'usage prévu de l'agent `debugger` (0 lancement depuis septembre) | 24 lignes |
| 4 | Skill `/lesson` : erreur vue deux fois → garde-fou (architecture, types, lint, test, hook, règle, doc), prouvé sur l'erreur passée | Formalise ce qui se faisait à la main (hooks noms FR, backlog) | 21 lignes |
| 5 | Skill `/restate` : reformuler le but en 2-4 lignes, une question fermée, attendre le oui ; appelé par `/next` | Décision 4 de l'humain | 13 lignes |
| 6 | Hook : tiret cadratin ajouté refusé dans `CLAUDE*.md`, `.claude/**/*.md`, `docs/**/*.md` (dans `block-friction-commands.py`, déjà branché) | Section 6 : une règle vue deux fois devient un garde-fou ; n'est refusé que l'ajout, pour éditer les anciens fichiers | 6 cas testés, dont l'ancien `CLAUDE.md` (refusé) |
| 7 | Hook `require-agent-model.py` : délégation sans modèle refusée (sauf `model:` dans la définition, ou fork) | Section 4 ; 168 lancements `general-purpose` sans modèle depuis septembre | 6 cas testés. **Branchement dans `settings.json` à faire par l'humain** (fichier interdit en écriture à Claude) |
| 8 | Mémoire : rien à changer, `--invalidate` (« INVALID <date>: raison ») et la relation `remplace` existent déjà. `CLAUDE.local.md` (non versionné) : 1re ligne du résumé de compactage = ce qui n'est pas encore écrit | Section 5, déjà couverte | 0 fichier versionné |
| 9 | Section 4, `/memo`, revue unique : rattachés au plan 244 | Ne pas ouvrir deux chantiers | voir plan 244 |
