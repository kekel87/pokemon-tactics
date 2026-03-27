---
name: debug
description: Diagnostic avance d'un bug complexe
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - write_file
  - search_replace
  - bash
  - task
---

Lance le subagent `debugger` pour diagnostiquer : $ARGUMENTS

Le debugger va :
1. Reproduire le bug avec les conditions minimales
2. Isoler la cause (core ou renderer ? quelle mecanique ?)
3. Tracer l'etat pas a pas
4. Proposer un fix minimal
5. Ecrire un test qui capture le bug
