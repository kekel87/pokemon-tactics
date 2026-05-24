---
name: publish
description: Orchestre une release complète — compile changelog, vérifie build, publie GitHub release, watch itch-deploy, génère devlog itch, lance wiki-keeper. Délègue à l'agent `publisher`. L'humain valide tag + changelog avant publish.
user-invocable: true
---

Thin wrapper sur l'agent `publisher` (sonnet). Entrée unique pour toute la chaîne release.

## Usage

```
/publish              # auto-bump version depuis dernier tag
/publish v2026.6.1    # version explicite
```

## Pré-requis

- Working tree clean ou changements stagés volontairement (`git status`)
- Dernier tag existe sur GitHub (`gh release list --limit 1`)
- `BUTLER_API_KEY` configurée dans secrets repo (sinon itch-deploy fail mais release OK)

## Ce qui se passe

L'agent `publisher` :

1. **Compile changelog** depuis `git log <last_tag>..HEAD` + plans associés (format joueur : What's New / Improvements / Bug Fixes / Distribution)
2. **CI gate full** (`bash .claude/skills/ci-gate/run.sh full`) — BLOQUANT
3. **Propose** tag + changelog complet à l'humain → attend validation
4. **Publish** via `gh release create vYYYY.MM.XX --notes-file ...` (trigger workflow `itch-deploy`)
5. **Watch** workflow `itch-deploy` (`gh run watch`) — report ✅/❌
6. **Génère devlog itch** (markdown ready-to-paste pour dashboard itch.io)
7. **Wiki-keeper** lancé en background (sync Changelog/Mechanics/Home EN+FR)
8. **Update refs projet** : `STATUS.md`, `docs/roadmap.md`, `docs/backlog.md`
9. **Synthèse finale** : URLs + commit msgs prêts (humain colle)

## Garanties

- **Jamais** de commit/push automatique. Tous les commits (wiki, refs projet) → msg généré, humain colle.
- **Jamais** de publish sans validation humaine du tag + changelog.
- itch-deploy fail = release reste valide (GitHub Pages OK). Re-run via `gh workflow run itch-deploy.yml -f version=vX.Y.Z`.

## Liens utiles

- Releases : https://github.com/kekel87/pokemon-tactics/releases
- Workflow itch-deploy : https://github.com/kekel87/pokemon-tactics/actions/workflows/itch-deploy.yml
- Dashboard itch devlog : https://itch.io/dashboard/game/4605116/new-devlog
- Wiki repo : https://github.com/kekel87/pokemon-tactics.wiki.git

## Recovery itch.io page

Si page itch perd settings : voir `docs/references/itch-page-state.md` (snapshot à créer post-stabilisation page).
