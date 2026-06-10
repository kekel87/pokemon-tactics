---
name: itch-feedback
description: Review automatique des commentaires + devlog reactions itch.io. Scrape la page jeu et classe via feedback-triager.
user-invocable: true
---

But : récupérer les retours joueurs itch.io sans connexion humain.

## Procédure

1. **Fetch page jeu** : `https://kekel87.itch.io/pokemon-tactics`
   - Utiliser `WebFetch` avec un prompt qui extrait : commentaires (auteur, date, texte), rating (étoiles + count), ratings recents, devlog posts récents
2. **Fetch devlog RSS** si devlog existe : `https://kekel87.itch.io/pokemon-tactics/devlog.rss`
3. **Croiser avec `docs/backlog.md`** pour détecter doublons (bug déjà signalé, feature déjà en backlog)
4. **Déléguer triage** à l'agent `feedback-triager` (classe bug / feature / feedback / spam / duplicate)
5. **Rapport sortie** :
   - Nb commentaires nouveaux depuis dernière exec (timestamp dans `$(git rev-parse --show-toplevel)/.itch-feedback-last-run` — toujours ancré à la racine repo, gitignored)
   - Tableau par item : type, résumé, action proposée (ignorer / ajouter backlog / fix urgent / répondre)
   - Drafts de réponses optionnelles (humain copie si veut répondre — ne JAMAIS poster auto)
6. **Proposer ajouts `docs/backlog.md`** : `AskUserQuestion` multi-select avec items pertinents

## Limitations

- **Pas d'API officielle itch** : scraping HTML fragile. Si DOM itch change, skill renvoie 0 résultat silencieusement. Mitigation : log "X commentaires trouvés" pour détecter régression.
- **Pas de notification push** : humain doit lancer manuellement (ou `/loop 1d /itch-feedback` pour daily).
- **Pas de réponse auto** : skill génère draft, humain colle dans dashboard itch s'il veut répondre.

## Tests manuels

- Lancer skill quand page itch a 0 commentaire → output "rien à reviewer" propre.
- Après 1 commentaire test (humain en poste un bidon) → skill l'identifie, classe correctement.
- Forcer DOM cassé (URL invalide) → skill log warning explicit, n'envoie pas faux positifs.
