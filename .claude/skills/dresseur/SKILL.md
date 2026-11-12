---
name: dresseur
description: Fabrique le sprite animé d'un ou plusieurs dresseurs ou champions (SpriteKiln, 9 animations, 8 directions) depuis leur artwork, et sa fiche GIF. À lancer sur `/dresseur <nom>...`, ou quand l'humain demande un nouveau dresseur, champion ou personnage humain pour le jeu.
argument-hint: "<nom> [<nom>...]"
user-invocable: true
---

Méthode validée le 2026-11-12 (Red, Pierre, Ondine, Major Bob, Érika ; graphe :
`idee-sprites-dresseurs-iso-par-generation`). Pas pour les Pokémon : l'humain a écarté SpriteKiln pour eux.
Tout le travail est hors de git (motif `assets-src/references/` du `.gitignore`), sauf les outils de
`assets-src/poc-sprites/`. Dossier de travail : `B = assets-src/references/aventure/sprites-dresseurs`.

## Étapes

1. **Artwork.** Pour chaque nom, télécharger l'artwork officiel en pied sur Poképédia (génération Rouge Feu /
   Vert Feuille par défaut : page `Fichier:<Nom>-RFVF.png`, l'URL de l'original est dans la page) vers
   `B/artworks/`, puis le copier en `B/spritekiln-<id>/splash.png` (`id` en kebab-case, sans accent).
   Le regarder soi-même une fois. Critère : un artwork de face ou de trois quarts, en pied, par personnage ;
   sinon dire lequel manque et proposer une autre génération.
2. **Une proposition à valider par « ok »** (`AskUserQuestion` à une question par personnage, la proposition
   dans l'aperçu, chaque point avec sa valeur par défaut) : pitch en une phrase ; carrure (enfant, ado, adulte : tableau de
   `assets-src/poc-sprites/regles-dresseurs.md`) ; expression des yeux (normaux, ouverts, plissés, colère) ; ce
   qu'il porte pour l'objet (sac, sacoche, rien = poche) ; les 4 gestes de caractère (lancer, K.O., objet,
   célébration) tirés de sa personnalité. Critère : l'humain a répondu ; ses corrections sont reprises telles
   quelles. Écrire ensuite `B/spritekiln-<id>/pitch.txt` (personnalité, gestes, source de l'image).
3. **Passe en un coup.** Un agent `general-purpose`, modèle `sonnet`, par personnage, en parallèle et en
   arrière-plan, avec le brief de [brief-en-un-coup.md](brief-en-un-coup.md) rempli. Ne pas ajouter de
   relecture de directeur artistique : c'est elle qui coûte (mesure du 2026-11-12 : 1,2 M de jetons pour trois
   personnages, contre ~170 000 en un coup). Critère : `validate` OK, QA 0 erreur, fiche
   `B/fiche-<id>-animations.gif` écrite.
4. **Regarder la fiche soi-même** (`magick "<gif>[25]" -resize 50% <scratchpad>/apercu.png`), relever ce qui
   ne ressemble pas à l'artwork ou au pitch, puis montrer à l'humain le lien de la fiche, la durée, les jetons
   et les défauts vus. Critère : l'humain valide ou nomme ce qu'il veut changer.
5. **Itération ciblée**, seulement sur demande : un agent `sonnet` reçoit la spec, la liste exacte des points
   de l'humain et l'interdiction de toucher au reste, avec un budget d'une quinzaine d'actions et de 4 images.
   Retour à l'étape 4.
6. **Mémoire.** Un personnage validé : une observation datée dans `idee-sprites-dresseurs-iso-par-generation`
   (validé, chemin de la spec, coût). Une règle nouvelle découverte en route va dans
   `regles-dresseurs.md`, pas dans ce skill.

## Référence

- Outils : `assets-src/poc-sprites/regles-dresseurs.md` (une page : outils, proportions, expressions des yeux,
  pièges, budget), `spritekiln/dresseur.yaml` (gabarit), `spritekiln/modele-personnage.yaml` (modèle court),
  `spritekiln/yeux-expressions.yaml` (yeux normaux, plissés, ouverts, colère, prêts à copier),
  `spritekiln/adapter_animations.py`, `spritekiln/verifier_yeux.py`, `fiche_animations.py`.
- La fiche : une ligne par animation dans les 8 directions, puis Machopeur et Gallame qui marchent, et à gauche
  le nom, l'artwork et le pitch (`--nom`, `--artwork`, `--pitch`).
- Durée observée en un coup : ~7 min et ~170 000 jetons par personnage. Plusieurs personnages se lancent en
  parallèle ; la limite est la fenêtre de 5 heures de l'humain, pas la machine.
