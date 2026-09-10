# Plan 205 — Le retour du navigateur remonte d'un écran

> **Statut** : done — livré le 2026-09-10. Deux revues de code : la première a trouvé un
> **Critical réel** que les mesures avaient manqué (une modale d'écran de menu faisait quitter
> le jeu), corrigé et re-mesuré ; la seconde a validé le delta. 15 unitaires + 9 e2e, tous
> vérifiés rouge-vert. Décisions **#998 à #1004**, entité `plan-205` au graphe.
>
> **Hors phase.** Session 3 de `agenda-2026-09-10-file-de-sessions-dediees`. Solde
> `backlog-retour-navigateur-non-gere`, le dernier vrai défaut **joueur** du backlog.

## Le défaut

Aucune intégration à l'historique du navigateur : ni `pushState`, ni `popstate`, ni hash. Le bouton
précédent **quitte le jeu** au lieu de remonter d'un écran. Sur téléphone le geste de retour est un
réflexe permanent, donc une perte de partie accidentelle — et depuis le plan 202, une partie en
ligne interrompue lance un délai de grâce chez l'adversaire.

## Ce qui a été écarté, et pourquoi

L'humain a demandé (2026-09-10) si capturer le bouton latéral de la souris suffirait, plutôt que de
gérer l'historique. Trois gestes distincts, souvent confondus :

| Geste | Événement DOM | Interceptable |
|---|---|---|
| Bouton latéral de souris (`button === 3`) | `pointerdown` / `mousedown` | Chrome oui (`preventDefault()` annule la navigation) ; Firefox à mesurer ; Safari non |
| Flèche retour de la barre d'outils | **aucun** | non — le seul signal est `popstate` |
| Geste de retour / bouton matériel Android | **aucun** | non — c'est `history.back()` |

Le motif de l'item est **le téléphone**. Ce geste est strictement une navigation d'historique :
sans entrée à dépiler, il n'y a rien à écouter. Capturer des boutons ne peut donc pas le résoudre.

Le **mapping complet** (1 écran = 1 entrée, liens profonds, bouton *suivant*) est écarté aussi : il
demande de sérialiser `mapUrl`, `teamId` et un `CombatSetup` entier dans `history.state` — le mur
que `screen-persistence.ts` a délibérément contourné — pour deux gains que personne ne demande.

## La forme retenue : la sentinelle

**Une seule** entrée d'historique, toujours présente, réarmée après chaque retour consommé.
L'URL ne change jamais. Le bouton de souris devient gratuit : il déclenche `history.back()`, donc
la sentinelle le couvre déjà.

## Le retour EST `Annuler` — mais `cancel` ne suffit pas partout

La découverte qui réduit ce plan à un module : **chaque écran câble déjà son retour**, via
`bindScreenInput(goBack)` (`ui/dom/screens/elements.ts`), et le combat y branche
`orchestrator.onEscape() || combatMenu.open()`. En routant le retour navigateur dans le `cancel` de
l'`InputSystem` — la pile de registrations du plan 184, dont le sommet est l'actif — on hérite de
tout, **sans toucher un seul écran** :

- chaque écran de menu remonte là où son bouton « Retour » remonte ;
- une modale ouverte possède `Annuler` : elle se ferme au lieu de laisser l'écran filer dessous ;
- en combat, une visée en cours s'annule d'abord, puis le menu de combat s'ouvre — avec ses
  confirmations existantes. **Jamais de sortie muette**, ce qui était le vrai sujet de l'item ;
- le **menu principal** est la racine : le geste y sort vraiment du jeu.

### Les deux endroits où emprunter `cancel` ne suffit pas (revue, 2026-09-10)

Le contrat de `cancel` a été écrit pour un producteur — une **touche** — qui a toujours un repli
natif du navigateur derrière lui quand il rend `false`. Un `popstate` n'en a aucun. La première
version en déduisait « personne n'a consommé donc on est à la racine », et **sortait du jeu** dans
deux cas ordinaires. Les deux sont traités **à la frontière**, dans ce module, plutôt que site par
site — corriger les N appels de `cancel` aurait élargi l'API d'entrée, ce que ce plan refuse.

1. **Une modale ouverte sur un écran de menu.** `bindScreenInput` rend `false` hors manette en
   comptant sur la fermeture native du `<dialog>` (décision #822). **Mesuré avant correctif** :
   « Sélection d'équipe » → sélecteur d'équipe → bouton précédent → **le jeu était quitté**, en
   trois gestes, partie en préparation perdue. Le module ferme donc la modale lui-même — mais
   **après** `emit`, jamais avant : le menu de combat est aussi un `<dialog>`, et sa sortie propre
   désenregistre son entrée, dispose son panneau et rend le focus ; un `dialog.close()` sec
   par-dessus laisserait une registration fantôme au sommet de la pile.
2. **La fenêtre de montage asynchrone d'un écran.** `ScreenManager` démonte le sortant puis attend
   `mount`, donc la pile d'entrée est momentanément **vide** — et `team-select` y attend
   `joinAsGuest`, un aller-retour réseau, soit des secondes. L'invité qui trouvait que ça ramait et
   faisait le geste de retour quittait la partie, en lançant le délai de grâce du plan 202 chez son
   adversaire.

D'où la règle : **la racine se LIT** (`isAtRoot`, passé par le boot — « l'écran courant est le menu
principal »), elle ne se déduit jamais d'un `false`. La sentinelle est réarmée **inconditionnellement**,
dans un `finally` pour survivre à un `emit` qui lève.

Un troisième garde ferme la ré-entrance : si le `popstate` nous fait atterrir **sur** la sentinelle,
c'est un pas en *avant* (bouton « suivant »), pas un retour — on ne fait rien.

`emit(action, source)` note la modalité d'entrée. On lui repasse `tracker.current()` — un `note`
sans effet — parce qu'un retour navigateur n'a **pas** de modalité : marquer « pointeur »
effacerait l'anneau de focus d'un joueur au clavier (décision #814).

## Étapes

1. `app/browser-back.ts` — armer la sentinelle, écouter `popstate`, router vers `cancel`, réarmer
   si consommé, laisser filer sinon. Ne pas ré-empiler si `history.state` porte déjà la marque
   (un rechargement retombe sur notre propre entrée).
2. Câbler dans `babylon-boot.ts`, après `initInputSystem()`.
3. Tests unitaires du module (sentinelle armée, consommé → réarmé, non consommé → sortie,
   rechargement → une seule entrée).
4. e2e : retour depuis un écran de menu, retour en combat ouvre le menu de combat.
5. Mesure multi-entrée + iframe.

## Le recensement de la famille (2e revue, 2026-09-10)

La question posée à la revue : « `cancel` qui rend `false` sans repli natif » a-t-elle d'autres
membres que les deux corrigés ? Recensement exhaustif — 6 `register(...)`, 8 handlers `cancel`,
3 `showModal()` :

| Modale | `cancel` du registrant actif | Ce que fait le retour |
|---|---|---|
| `Modal` partagé (sélecteurs équipe / Pokemon / objet / nature, confirmation de suppression) | `false` hors manette | tombe dans le repli — **c'était le trou** |
| Menu de combat | `true`, **inconditionnel, sans lire `tracker.current()`** | consommé, le repli n'est jamais atteint |
| Dialogue de victoire | `true` délibérément avalé | no-op, comme `Échap` |

Le menu de combat n'est donc **pas** exposé au motif #822 qui a créé le trou : l'ordre
`emit` → repli modale → racine n'est pas seulement défendable, il est robuste.

**Un troisième membre existe, de forme différente : la capture de touche.** `onKeyDown` sert le
`captureSink` *avant* le routeur (`input-system.ts`), alors qu'`emit` entre directement dans le
routeur. Pendant un remappage (écran Contrôles), `Échap` renonce à la capture ; le geste de retour,
lui, quitte l'écran. Pas de fuite — `controls-panel.dispose()` annule la capture — donc divergence
assumée et **nommée en commentaire** dans le module, plutôt que corrigée : exposer « une capture
est-elle en cours » élargirait l'API d'entrée, ce que ce plan refuse.

**Bug miroir à surveiller, aujourd'hui inexistant** : `map-select-screen.ts` et `lobby-screen.ts`
ont des registrations dont le `cancel` rend `true` **inconditionnellement**. Si l'un d'eux montait
un jour une modale, le retour naviguerait *sous* elle. Aucun des deux n'en a. À savoir, pas à
corriger.

## Limites assumées

- **Pas de liens profonds, pas de bouton *suivant*.** Hors périmètre, voir plus haut. ⚠️ Le jour où
  le mapping complet serait implémenté, la cascade de ré-entrance redevient possible : l'immunité
  actuelle tient à ce que la sentinelle soit la **seule** entrée same-document de l'app, pas à une
  propriété du module.
- **Fenêtre du splash** : les écouteurs d'armement sont montés après `runSplash`, donc un geste fait
  pendant le chargement n'arme rien. Visible seulement sur une reprise directe d'un écran non-racine.
- **Capture de touche en cours** (écran des contrôles) : `beginCapture` n'intercepte que le chemin
  clavier, pas `emit`. Un retour navigateur pendant une capture navigue au lieu d'annuler la
  capture. Cas minuscule, laissé tel quel plutôt que d'élargir l'API d'entrée.
- **itch.io à mesurer sur itch** : un `pushState` d'iframe entre dans l'historique de session
  commun, donc la sentinelle devrait tenir — mais #895 rappelle que l'iframe ne se comporte pas
  comme une page en propre. Vérifiable en local dans une iframe ; le verdict itch demande un
  déploiement, donc il est lié à la release de la Phase 7, toujours en attente.

## Mesuré, pas supposé (Chromium, 2026-09-10)

Toutes ces lignes sont des relevés au chrome-devtools sur le vrai jeu, pas des attentes.

| Cas | Relevé |
|---|---|
| Avant tout geste du joueur | `history.state === null`, rien d'empilé — l'entrée ne peut donc pas être marquée « manipulation » par Chrome |
| Premier geste | une entrée `{ ptBack: true }`, une seule quels que soient les gestes suivants |
| Retour depuis « Choix de la carte » | → « Mode de combat », `history.length` inchangé (3), sentinelle réarmée |
| Retour depuis « Mode de combat » | → menu principal |
| Retour depuis le menu principal | la page est **quittée** (contexte d'exécution détruit, retour à l'entrée précédente) — le geste fait ce qu'il annonce |
| **Retour en COMBAT** | reste en combat, **le menu de combat s'ouvre** (Reprendre / Paramètres / Recommencer / Abandonner / Quitter). Aucune sortie muette |
| Retour, menu de combat ouvert | le menu se ferme, on reste en combat — la registration du menu possède `Annuler`, comme prévu |
| Rechargement sur la sentinelle | `history.length` inchangé, et **un seul** retour ramène au menu (pas deux) |
| **Iframe cross-origin** (origine hôte 8099, jeu en 5173 — approximation d'itch) | le bouton précédent du navigateur **remonte d'un écran dans le jeu**, la page hôte n'est pas déchargée |

### Après le correctif de revue (mêmes relevés, rejoués)

| Cas | Avant | Après |
|---|---|---|
| Modale du sélecteur d'équipe + retour | 🔴 **le jeu est quitté** (onglet à `about:blank`) | la modale se ferme, on reste sur « Sélection d'équipe », sentinelle réarmée |
| Retour en combat, menu ouvert, puis retour | menu fermé | menu fermé **et `dialog` retiré du DOM** (donc c'est bien la sortie propre du menu qui tourne, pas un `close()` sec) — le menu se rouvre intégralement au retour suivant |
| Chaîne de menus + sortie à la racine | vert | vert, inchangé |

Le bouton latéral de la souris n'a pas eu à être mesuré séparément : il déclenche `history.back()`,
c'est-à-dire exactement le chemin ci-dessus.

**Ce qui reste non mesuré** : itch.io lui-même. L'iframe cross-origin locale en est une
approximation, pas une preuve — #895 rappelle que l'enveloppe d'itch diffère. Le verdict demande un
déploiement, donc il est lié à la release de la Phase 7, toujours en attente.
