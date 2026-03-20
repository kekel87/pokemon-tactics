---
name: status
description: Met à jour STATUS.md et vérifie que la documentation est à jour
user-invocable: true
---

Lance l'agent `session-closer` pour mettre à jour l'état du projet.

Il va :
1. Analyser les commits récents et changements en cours
2. Mettre à jour `STATUS.md` avec l'état actuel
3. Vérifier que la doc est cohérente avec le code
4. Signaler les éventuelles incohérences

Utiliser en fin de session de travail ou quand on veut faire le point.
