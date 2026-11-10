# Plan 251 : menu principal Stade de Combat / Aventure

**Statut** : done

**Ouvert le** : 2026-11-10, lot 1 du mode Aventure (`docs/aventure.md`, `decision-1227`)
**Bloque la release ?** : non

| Écart au plan | Raison |
|---|---|
| Mode nommé « Stade de Combat », pas « Combat libre » | Choix de l'humain en recette (`decision-1230`) |
| Un replay fini ou quitté revient aussi au Stade, pas seulement un replay illisible | Avis `game-designer` : sinon on refait deux écrans à chaque replay |
| Écran Aventure non restauré au rechargement | Avis `game-designer` : sinon un retour sans `?aventure=1` contournait le verrou |
| Le lien `?aventure=1` marche sur GitHub Pages, pas sur itch.io | L'iframe d'itch.io ne reçoit pas la query string (`decision-1181`, `decision-1231`) |

## Ce que tu verras à l'écran

- Le menu principal ne montre plus que : Reprendre le combat (s'il y en a un), Aventure, Stade de Combat, Paramètres,
  Crédits.
- Aventure est grisé avec la mention « Bientôt » ; avec `?aventure=1` dans l'adresse, il s'ouvre sur un écran
  Aventure : Nouvelle aventure (grisé, « Bientôt ») et Retour.
- Stade de Combat ouvre : Local, En ligne, Revoir un combat, Constructeur d'équipe, Tutoriel (grisé, « Bientôt »),
  Retour.
- Le Constructeur d'équipe et un replay (fini, quitté ou illisible) ramènent à Stade de Combat, plus au menu
  principal.
- Tout marche pareil au clavier, à la manette et au tactile, en français, anglais et espagnol.

## Arrêté avec l'humain (2026-11-10)

- Revoir un combat, Constructeur d'équipe et Tutoriel vont sous Stade de Combat : ils ne servent pas en Aventure, où
  l'équipe vient des captures. Le tutoriel du menu est celui du combat seul ; le début de l'Aventure servira de
  tutoriel au solo (`idee-tutoriel-replay-commente`).
- « Reprendre le combat » reste en tête du menu principal et ne concerne que le Stade de Combat. L'Aventure se
  reprendra par « Continuer » dans son propre écran (lot 3, avec la sauvegarde) : pas au lot 1.
- Nom du mode : « Stade de Combat » (Battle Stadium, Estadio de Combate), le nom officiel du coin compétitif
  d'Épée et Bouclier, Écarlate et Violet ; choisi en recette contre « Combat libre » (Pokémon Stadium 2), plus
  daté. Il pourra accueillir plus tard des combats classés ou amicaux sans changer de nom.
- Verrou : paramètre d'URL `?aventure=1`, valable aussi en production (le « lien caché » de `decision-1227`),
  sans réglage visible. Pas de réglages propres à l'Aventure pour l'instant.

## Étapes

1. **Écran Aventure** : nouvel écran `adventure` (`ScreenId`, `SCREEN_TRANSITIONS`, `babylon-boot.ts`,
   pas dans `RESTORABLE_SCREENS` pour qu'un rechargement sans le paramètre ne contourne pas le verrou), copie de la forme de `battle-mode-screen.ts` : titre « Aventure », Nouvelle aventure
   désactivée avec « Bientôt », Retour vers `main-menu`. Critère : `typecheck` vert.
2. **Verrou** : un module à créer, `packages/app/src/app/adventure-unlock.ts`, lit `?aventure=1` une fois au boot. Bouton Aventure du menu
   principal actif seulement si déverrouillé, sinon désactivé avec « Bientôt ». Critère : le bouton s'ouvre avec
   le paramètre, reste inerte sans.
3. **Menu principal** : retirer Revoir un combat et Constructeur d'équipe ; « Combat » devient « Stade de Combat ».
   Transitions `main-menu` : retirer `my-teams`, ajouter `adventure`. Critère :
   `screen-manager.test.ts` vert sur la nouvelle table, le menu montre les cinq entrées de l'en-tête.
4. **Stade de Combat** (`battle-mode-screen.ts`) : titre « Stade de Combat », entrées Local, En ligne, Revoir un
   combat (code de `main-menu-screen.ts` déplacé, message d'échec compris), Constructeur d'équipe, Tutoriel,
   Retour. Le paramètre `replayFailure` passe de `main-menu` à `battle-mode` ; `combat-screen.ts` y revient sur
   la fin, l'abandon ou l'échec d'un replay. Transitions : `battle-mode → combat` et `→ my-teams`,
   `combat → battle-mode` (sans effet sur la fermeture du salon en ligne : un replay n'est jamais en ligne),
   `my-teams → battle-mode` au lieu de `main-menu`.
   Critère : un code de replay invalide affiche son message sous Stade de Combat ; Retour du Constructeur
   d'équipe ramène à Stade de Combat (scénarios de recette).
5. **Textes** : `menu.battle` et `battleMode.title` → « Stade de Combat » / « Battle Stadium » / « Estadio de Combate » ;
   nouvelles clés « Bientôt » / « Coming soon » / « Próximamente », titre et entrée de l'écran Aventure, dans
   `fr.ts`, `en.ts`, `es.ts` et `types.ts`. Critère : tests de parité i18n verts.
6. **Passe multi-entrée** : navigation clavier, manette et tactile sur les trois écrans, espagnol en 568 × 320
   (entrée la plus longue : « Nueva aventura » + « Próximamente »). Critère : les flèches atteignent chaque
   entrée active jusqu'à Retour en sautant les grisées, sans piège de focus ; Retour (Échap, bouton B) remonte
   d'un écran ; aucun débordement mesuré.
7. `/simplify`. Critère : `typecheck` vert, tests unitaires de l'app touchés (`screen-manager.test.ts`,
   persistance d'écran) verts.

## Hors périmètre

- Continuer, sauvegarde, import / export : lot 3.
- Télémétrie de l'écran Aventure : un écran caché ne compterait que les testeurs.
- Mise à jour des e2e (page objects `MainMenu.ts`, `screens.ts`, specs de navigation, capture d'intro) : au
  menu, après la recette, par `test-writer`.

## Lecture des stats

Le compteur d'écran `battle-mode` change de sens à ce plan : il compte désormais aussi les passages vers
Revoir un combat et le Constructeur d'équipe. Ne pas comparer ses chiffres avant et après le 2026-11-10.
