---
name: debug
description: Diagnostic avancé d'un bug complexe
argument-hint: "[description du bug]"
user-invocable: true
---

Lance l'agent `debugger` (modèle opus) pour diagnostiquer : $ARGUMENTS

Le debugger va :
1. Reproduire le bug avec les conditions minimales
2. Isoler la cause (core ou renderer ? quelle mécanique ?)
3. Tracer l'état pas à pas
4. Proposer un fix minimal
5. Écrire un test qui capture le bug
