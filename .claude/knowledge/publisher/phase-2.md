# Publisher, phase 2 : après la publication

À lire par `publisher` à la relance par `SendMessage`, la release publiée. Étapes 4 à 9.

## 4. La release est publiée par l'orchestrateur, pas par toi

🔴 Ne lance **jamais** `gh release create`. La règle « Create Public Surface » du mode auto la
refuse à un sous-agent sur un dépôt public : l'accord de l'humain ne compte que reçu directement,
jamais transmis. L'orchestrateur la lance après validation, avec ton fichier de notes. La phase 2
démarre sur une release existante — publication `release:released` → `itch-deploy.yml` déjà parti.

## 5. Watch workflow `itch-deploy`

```bash
sleep 5  # laisser le run apparaître
RUN_ID=$(gh run list --workflow=itch-deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $RUN_ID --interval 10
```

Si fail : récupérer logs `gh run view --log-failed $RUN_ID`, signaler humain. Pas bloquant pour reste de chaîne (le jeu est sur GitHub Pages quoi qu'il arrive).

## 6. Générer devlog itch (skill `/itch-devlog`)

Suivre la procédure du skill `.claude/skills/itch-devlog/SKILL.md` :
- Classification heuristique (Major Update vs General Update)
- Body = changelog verbatim (Markdown)
- Date = `publishedAt[:10]`

Afficher bloc prêt-à-coller pour dashboard itch (https://itch.io/dashboard/game/4605116/new-devlog).

- **Langue = anglais** (même langue que le changelog GitHub — audience internationale). Jamais de traduction FR de l'artefact.
- Dans ta synthèse de phase 2, inclus le devlog **verbatim dans un bloc de code** (titre + type + date + visibility + body markdown complet) pour que l'orchestrateur puisse le coller tel quel en chat. Ne le résume pas.

**Note** : itch n'a pas d'API publique POST devlog. Humain copie/colle manuellement (~1 min). Skill optionnel auto-fill via Playwright MCP si session active.

## 7. Préparer le brief du wiki

Tu ne peux pas lancer d'agent — l'orchestrateur (`/publish`) met le wiki à jour après ta synthèse. Inclus dans ta synthèse le brief :
- Ajouter entrée `vYYYY.MM.XX` dans `Changelog.md` + `Changelog-FR.md`
- Mettre à jour `Mechanics.md` + `Mécaniques.md` si nouvelles mécaniques
- Mettre à jour `Home.md` + `Accueil.md` si liens distribution changent
- Mettre à jour `Roadmap.md` + `Feuille-de-route.md` depuis `docs/roadmap.md` (« où on en est » à la version publiée) — **à chaque release**, sans sujet interne ni chiffre de télémétrie

Le wiki étant un repo séparé, signaler à humain les fichiers modifiés + commit msg suggéré `wiki: vYYYY.MM.XX content sync — <highlights>`.

## 8. Mettre à jour les références projet

- **Graphe** : `--add historique release-vYYYY.MM.XX "Date : …" "Release publiée : …"` — le fil des releases
- `docs/roadmap.md` : cocher items terminés si applicable
- **Graphe** : les bugs corrigés par la release passent du type `backlog` au type `backlog-résolu`, avec la référence de version en observation (commit). Rien n'est supprimé : le type change, l'entité reste.

## 9. Synthèse finale

Reporter à humain :
- ✅ Release URL
- ✅/❌ itch-deploy workflow (run URL)
- ✅ Brief du wiki (l'orchestrateur le traite ensuite)
- ✅ Devlog itch markdown (paste dashboard URL)
- ✅ Refs projet maj (commit msg `docs: post-release vYYYY.MM.XX cleanup` prêt)

## Recovery — itch.io page reset

Si la page itch perd ses settings (rare mais possible) : voir snapshot l'état de la page itch (graphe de mémoire, entités `procédure`) (tags exacts, classification, theme, external links). Reconstituer via dashboard ou Playwright MCP.
