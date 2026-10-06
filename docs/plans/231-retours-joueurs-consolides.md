# Plan 231 — Retours des joueurs consolidés dans un type dédié

**Statut** : done
**Origine** : `/next` du 2026-10-06. Le retour du frère sur les équipes aléatoires déséquilibrées
(2026-09-19, « on le fera la prochaine session ») et celui de Frank sur l'attaque avec déplacement
combiné (2026-09-30) sont restés invisibles : rangés en `feedback` et en `idée`, des types que
`/next` ne lit pas. Le pointeur affirmait « aucun backlog ouvert ». Demande de l'humain : « j'ai pas
envie de perdre des infos quand je consigne des trucs ».

## Ce que tu verras à l'écran

1. `/next` affiche une ligne **« Retours ouverts »** : chaque retour encore non traité, avec qui l'a
   dit et quand (aujourd'hui : équipes aléatoires du frère, attaque + déplacement de Frank).
2. `node scripts/memory/query.mjs "Frank"` (ou « frère ») ramène **tous** ses retours, ouverts et
   traités, au même endroit.
3. Quand tu me relaies un retour (« mon frère trouve que… »), je le consigne en `retour` sans te
   demander où le ranger ; quand un plan le traite, il bascule en `retour-traité`.
4. Aucun changement dans le jeu.

## Décisions

- **Type `retour`** (ouvert) / **`retour-traité`** (soldé) : tout ce qu'une personne qui a **joué**
  dit du jeu — frère, Frank, l'humain en partie libre, issue GitHub, commentaire itch.io.
  Trois lignes obligatoires : `Source : …`, `Date : …`, et à la clôture ce qui l'a soldé
  (plan, commit, ou « écarté par l'humain »).
- **Les retours de recette restent hors du système** (choix de l'humain, 2026-10-06) : ils se
  traitent dans l'itération du plan en cours.
- **`feedback` = règles de travail seulement** (« commit en titre seul »…). Plus aucun retour de jeu.
- Pas de suppression : la migration ne fait que **retyper** et ajouter une ligne `Source :` quand
  elle manque.

## Étapes

1. `scripts/memory/query.mjs` : `TYPE_SOLDE` += `retour → retour-traité` ; aide `--resolve` à jour.
   `fts.mjs` : poids de type pour `retour` (même que `backlog`). 
   `audit.mjs` : ajouter `retour` à `MOTS_GENERIQUES` (comme `backlog`, `agenda`, etc.).
   Test dans `query.test.ts`.
2. Migration du graphe (retype + `Source :`), après vérification une à une :
   - ouverts → `retour` : `feedback-equipes-aleatoires-desequilibrees-2026-09-19`,
     `idee-attaque-avec-deplacement-combine` ;
   - traités → `retour-traité` : les entrées `backlog-résolu` sourcées frère/Frank (carte aléatoire,
     portée invisible au pair distant, journal plafonné à 50 lignes, portées invisibles sur liquide,
     malus du marais, infobulles talents/objets, et toute autre trouvée par le balayage « frère /
     Frank / partie en ligne ») ; `feedback-journal-combat-pas-scrolle-en-bas-2026-09-19` (vérifié
     corrigé dans `ui-dom/src/battle-log.ts`) ; « App trop petite » (traité par le responsive).
   - `--link` entre chaque retour traité et le plan qui l'a soldé quand il est connu.
3. Routage — chaque endroit qui consigne ou lit un retour :
   - `.claude/skills/next/SKILL.md` : section « Reporté » doit lister les entités `retour` ouvertes
     (requête SQL ou `--stats` par type, pas une recherche par mots-clés). La présentation est à
     arbitrer : sous-section distinct ou intégré à « Reporté » existant ? Actuellement « Reporté »
     liste `agenda` et `backlog` — ajouter `retour` au même endroit ou créer « Retours ouverts » ? ;
   - `.claude/agents/doc-keeper.md`, `session-closer.md` : mettre à jour la table des types en usage
     pour ajouter `retour` et `retour-traité`, avec annotation « un retour de joueur → `retour`,
     jamais `feedback` / `idée` / `backlog` » ;
   - `.claude/agents/feedback-triager.md`, `.claude/skills/itch-feedback/SKILL.md` : clarifier que
     un retour de joueur venu d'une issue/itch doit être consigné en `retour`, pas `backlog`
     (Source obligatoire : `Source : issue #n` ou `Source : itch.io`) ;
   - `CLAUDE.md` : ligne « Graphe, entités `retour` » dans la table « Où lire ».
   - Hook `block-backlog-write.py` : **inchangé** (il ne bloque que `backlog` et `agenda` exacts ;
     un retour vient toujours de l'humain).
4. Pour lister les retours ouverts sans deviner de mot-clé : option `--type <type>` dans
   `query.mjs` (liste les entités d'un type avec leur première ligne). Utilisée par `/next`.

## Hors périmètre

- Traiter les retours eux-mêmes (équipes aléatoires : plan suivant).
- Retyper les 70 `feedback` de règles de travail.
- Les vieux retours de playtest de l'humain (2026-05 à 2026-07) déjà en `backlog-résolu`.
