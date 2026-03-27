---
name: status
description: Met a jour STATUS.md et verifie que la documentation est a jour
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - write_file
  - search_replace
  - bash
  - task
---

Lance le subagent `session-closer` pour mettre a jour l'etat du projet.

Il va :
1. Analyser les commits recents et changements en cours
2. Mettre a jour `STATUS.md` avec l'etat actuel
3. Verifier que la doc est coherente avec le code
4. Signaler les eventuelles incoherences

Utiliser en fin de session de travail ou quand on veut faire le point.
