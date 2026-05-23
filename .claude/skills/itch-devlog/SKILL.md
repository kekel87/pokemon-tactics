---
name: itch-devlog
description: Génère un post devlog itch.io depuis une release GitHub. Humain colle dans dashboard itch (~1 min/release). Pas d'API itch publique pour automation pure.
user-invocable: true
---

But : éviter de réécrire le markdown release pour itch. Génère bloc prêt-à-coller + checklist champs.

## Usage

```
/itch-devlog vX.Y.Z       # tag spécifique
/itch-devlog              # dernière release
```

## Procédure

1. Fetch release GitHub via `gh release view <tag> --json name,body,publishedAt,isDraft,isPrerelease`
2. Classifier le type (heuristique) :
   - Body contient "Initial release" / >5 sections nouvelles → `Major Update or Launch`
   - Body contient "fix" / "polish" / "small" → `General Update or Announcement`
   - Sinon → demander à humain (`AskUserQuestion`)
3. Extraire date `publishedAt[:10]` (format YYYY-MM-DD)
4. Body : conserver markdown tel quel (itch devlog accepte markdown direct). Pas besoin de conversion HTML.
5. Sortie console :

```
=== Devlog post prêt à coller ===

URL : https://itch.io/dashboard/game/4605116/new-devlog

Title  : vX.Y.Z — [short summary derived from release name]
Type   : Major Update or Launch  (ou General Update)
Date   : 2026-MM-DD  (Original publish date)
Visibility : Published

Body (Markdown) :
---
[body verbatim]
---

Checklist :
- [ ] Coller title
- [ ] Cocher radio type
- [ ] Coller body
- [ ] Set Original publish date
- [ ] Cocher Published
- [ ] Remove attachments auto (si pas pertinents)
- [ ] Save
```

6. Si humain a session Playwright active : proposer auto-fill via tools `mcp__playwright__*` (re-login itch si cookies expirés). Sinon : humain colle manuellement.

## Form fields itch (référence)

| Champ | Sélecteur DOM | Format |
|-------|---------------|--------|
| Title | `input[name="post[title]"]` | text |
| Type | `input[name="post[user_classification]"]` | radio (`major_update` / `general_update`) |
| Body | `textarea[name="post[body]"]` | Markdown |
| Date | `input[name="post[display_published_at]"]` | YYYY-MM-DD |
| Published | `input[name="post[published]"]` | checkbox |

## Limitations

- **Pas d'API itch publique** pour POST devlog. Workaround Playwright headless = cookies expirent (~3 mois), fragile.
- Si automation un jour critique : reverse-engineer endpoint `POST /dashboard/game/{id}/new-devlog` avec CSRF token + session cookie via GitHub Action secret. Maintenance élevée, non recommandé.
- Pattern actuel reste : GitHub Releases = source de vérité, devlog itch = miroir copié.

## Liens

- Dashboard devlogs : https://itch.io/dashboard/game/4605116/devlog
- New devlog : https://itch.io/dashboard/game/4605116/new-devlog
- Public devlog page : https://kekel87.itch.io/pokemon-tactics/devlog
