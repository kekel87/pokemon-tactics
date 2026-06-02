#!/usr/bin/env bash
# Hook UserPromptSubmit : reinjecte a CHAQUE tour la regle des noms FR.
# stdout = contexte ajoute au prompt. Garde la regle en tete malgre les
# sessions longues ou la memoire/CLAUDE.md derivent du contexte actif.
#
# Regle recurrente (rappelee >10 fois par l'humain) : l'humain ne connait
# PAS les noms anglais des moves/talents/Pokemon. Toute communication
# (texte, tableaux, menus AskUserQuestion, listes) DOIT utiliser les noms
# FR officiels. ID anglais entre parentheses uniquement si precision
# technique necessaire.

echo "NOMS FR OBLIGATOIRES : dans toute communication a l'humain (texte, tableaux, menus, listes de moves/talents/Pokemon), utiliser les noms FR officiels (ex: Lame de Roche, Provoc, Florizarre). JAMAIS l'ID anglais seul. ID EN entre parentheses seulement si precision technique requise. Source : packages/data/reference/moves.json (names.fr) ou packages/data/src/i18n/*.fr.json."
