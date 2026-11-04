# Publisher, phase 1 : changelog, build, proposition

À lire par `publisher` au lancement (phase 1). Étapes 1 à 3, puis stop.

## 1. Compiler le changelog depuis le dernier tag

```bash
LAST_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName')
git log $LAST_TAG..HEAD --pretty='%h %s'
```

Pour chaque commit :
- Lire le commit complet si nécessaire (`git show <sha>`)
- Si plan associé, lire `docs/plans/<NNN>-*.md` section "Objectif" + "Livraison"
- Extraire **changements visibles joueur uniquement**

Rédiger une ligne **orientée joueur** (pas développeur) par changement notable :
- Nouveau Pokemon → "Added Pikachu to the roster with Thunderbolt, Thunder Wave, Double Team, and Volt Tackle"
- Nouvelle mécanique → "Attacks now show a damage preview before confirming"
- Bugfix visible → "Fixed victory screen not appearing in AI vs AI battles"
- Amélioration UX → "Enemy movement range is now visible on hover"

**Ne PAS inclure** :
- Refactors internes, changements de tests, mises à jour de documentation
- Détails techniques (noms de fichiers, classes, fonctions)
- Commits `chore:`, `refactor:`, `test:`, `docs:` sans impact joueur

**Concision (feedback humain 2026-06-12) — RÈGLE** : regrouper par catégorie, ne PAS énumérer chaque move/Pokemon avec sa sous-puce. Un lot de contenu = **une ligne de synthèse chiffrée**, pas N puces.
- ❌ `- Added Roll­out\n- Added Ice Ball\n- Added Thrash\n- Added Petal Dance …` (une puce par move)
- ✅ `- 9 new moves incl. lock-in family (Thrash, Petal Dance, Ice Ball) and Spit Up/Swallow`
- ❌ une sous-puce par Pokemon d'un batch → ✅ `- 12 new Pokemon added to the roster (Gen 1 pre-evolutions)`
- Ne détailler nommément que les **têtes d'affiche** (feature marquante, move emblématique) ; le reste en agrégat. Vise ~5-10 lignes de changelog max, pas 40.

### 🔴 RÈGLE 1 — Le contexte du joueur, c'est la DERNIÈRE RELEASE PUBLIÉE, pas le code

Tu n'écris pas pour quelqu'un qui a suivi les commits. Tu écris pour quelqu'un dont la dernière
expérience du jeu est la version d'avant. **Lis-la avant de rédiger** :

```bash
LAST_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName')
gh release view $LAST_TAG          # ce que le joueur connaît déjà — le point de départ
```

Applique ce test à CHAQUE ligne : *la chose dont je parle existait-elle dans la version publiée ?*

- **Non** → elle ne peut être ni « improved », ni « redesigned », ni « fixed ». Elle fait partie de
  la nouveauté, ou elle n'existe pas. Fonds-la dans la ligne de la fonctionnalité mère.
- **Oui** → la ligne est légitime, et décris le delta par rapport à ce que le joueur avait.

Deux conséquences qui coûtent cher quand on les oublie :

1. 🔴 **Un bug dans du code jamais publié n'est PAS un correctif joueur.** Personne n'a pu le
   rencontrer. Les défauts nés et corrigés à l'intérieur du même cycle sont invisibles : ils ne vont
   pas dans Bug Fixes. Vérifie que la surface touchée était livrée : `git log $LAST_TAG -1 -- <fichier>`,
   ou regarde si le paquet/écran concerné est mentionné dans la release précédente.
2. 🔴 **Pas de « redesigned » sur un écran que personne n'a vu.** Refondre pendant le développement,
   c'est du développement, pas une amélioration.

Origine (2026-09-16, release de la Phase 7) : un changelog annonçait « The Play Online screen was
redesigned » alors que jouer en ligne SORTAIT dans cette release — on vantait la refonte d'un écran
jamais publié — et listait cinq correctifs de multijoueur qu'aucun joueur n'avait pu subir.

### 🔴 RÈGLE 2 — « Orienté joueur » veut dire CE QU'IL PEUT FAIRE, pas comment c'est fait

Une fonctionnalité neuve = **une ligne**, celle de la promesse. Ses rouages internes ne sont pas des
lignes de changelog, même quand ils ont coûté trois plans.

Bannis, sauf si le joueur doit agir en conséquence :
- les **durées, seuils et quantités** de fonctionnement (« a 90-second window », « after 15 seconds ») ;
- les **unités techniques** (« 30-pixel minimum touch target » → au mieux « reachable with a thumb »,
  et le plus souvent : rien) ;
- les **filets de sécurité** que le joueur ne devrait jamais voir (détection de désynchronisation,
  reprise après perte de l'hôte, garde-fous de protocole) ;
- l'**instrumentation interne** (télémétrie, statistiques, compteurs) — hors changelog par nature ;
- les **sous-mécaniques** d'une fonctionnalité qui sort le même jour : placement simultané, mode
  spectateur, migration d'hôte, reconnexion sont *le multijoueur*, pas cinq nouveautés.

Test de la ligne : **est-ce que ça change quelque chose pour quelqu'un qui joue ?** Si la réponse
demande d'expliquer un mécanisme, c'est que la ligne n'en est pas une.

- ❌ `Manual placement works online. All players place at the same time, hidden from each other, with a 90-second window that auto-places whatever is left.`
- ❌ `The game survives a bad connection. Reload, crash or drop out and you can rejoin — and if the host leaves, another player takes over.`
- ✅ Les deux disparaissent dans la ligne « Play online » : c'est ce qu'on attend d'un jeu en ligne.

Origine : feedback humain du 2026-09-16, « c'est trop de détail pour les joueurs », « ça aussi il
s'en foute ». Deux fois de suite sur la même release.

Format final (Markdown) — grouper :

```markdown
## What's New

- Major new features (mechanics, moves, Pokemon, maps, modes) — agrégés, pas une puce par item

## Improvements

- UX/QoL, balance tweaks, visible polish

## Bug Fixes

- Player-visible fixes
```

🔴 **PAS de section « Distribution ».** Bande-annonce, captures, mises à jour itch/Pages, pipeline
de release : c'est de la logistique interne, pas du contenu joueur. Ça ne va NI dans le changelog
GitHub, NI dans le devlog itch. Règle rappelée plusieurs fois par l'humain.

## 2. Vérifier le build

```bash
bash .claude/skills/ci-gate/run.sh full
```

Si fail → signaler à l'humain, **ne pas publier**.

## 3. Proposer la publication — FIN DE PHASE 1

Rapport final de phase 1 :
- Tag proposé (auto-bump)
- Changelog formaté complet
- Résultat CI gate
- Chemin du fichier de notes (le changelog, écrit dans le scratchpad de la session)

**Stop ici.** L'orchestrateur valide avec l'humain, publie lui-même la release, puis te relance pour la phase 2 avec son URL.
