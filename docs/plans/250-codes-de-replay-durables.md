# Plan 250 : codes de replay qui survivent aux mises à jour

**Statut** : done

**Ouvert le** : 2026-11-08, solde `backlog-replay-codes-points-mineurs`
**Bloque la release ?** : non

| Écart au plan | Raison |
|---|---|
| Empreinte cumulée (état après chaque action) au lieu de l'état final seul | Avis `game-designer` : un combat qui diverge en route puis finit pareil passait en silence |
| Empreinte recalculée à la copie par un rejeu neuf, pas lue sur le combat vivant | Les deux empreintes sortent du même calcul (`fastForwardBattle`) |
| Liste blanche vérifiée par le type (le reste de la déstructuration doit être vide) | Avis `game-designer` : un champ oublié ferait diverger tous les codes |
| Textes alignés : ancienne version, version plus récente (« mets le jeu à jour »), action impossible, déroulé différent | Avis `game-designer` |

## Ce que tu verras à l'écran

- Un code de replay copié avant une mise à jour du jeu se rejoue toujours après, tant que la mise à jour n'a
  rien changé au déroulé de ce combat.
- Si la mise à jour a changé le déroulé (un calcul de dégâts, un talent, les statistiques d'une espèce
  présente), le jeu le détecte au chargement et revient au menu avec un message clair : « ce combat se
  déroule autrement dans cette version du jeu ».
- Un code collé entre guillemets ou entre accents graves (copié depuis Discord) est accepté.
- Les codes copiés avant ce plan (`PTR1.`) affichent le message « autre version du jeu », comme aujourd'hui.

## Constat

`replay-code.ts` refuse tout code dont le `buildVersion` diffère. Or `buildVersion` vient de
`git describe` et change à chaque commit, documentation comprise (même raison que `protocol.ts` l'a écarté
pour le réseau). Pourtant, avant de montrer un replay, l'écran de combat rejoue déjà tout le journal sans
rendu (`fastForwardBattle`, plan 246) : on peut y vérifier que le combat aboutit au même état final.

Ce plan remplace la règle de `decision-1180` (« un `buildVersion` différent n'est JAMAIS rejoué ») : le
risque qu'elle couvrait, un vieux code rejoué de travers sans rien dire, est couvert par la somme de
contrôle. Le reste de `decision-1180` tient (setup sans salon, carte validée au registre).

## Ce qu'on fait

1. **Empreinte du déroulé au lieu de la version.** À la copie, le combat est rejoué à neuf depuis ce que
   le code emporte (`replayFingerprint`, `battle-resume.ts`) et l'empreinte cumule la somme de contrôle de
   l'état au départ puis après chaque action et abandon (`state-checksum.ts`). Le décodage ne compare
   plus la version. Le lecteur recalcule l'empreinte avant d'afficher le combat ; un écart renvoie au menu
   avec une nouvelle cause `ReplayFailure.Diverged` (fr, en, es).
2. **Format 2, préfixe `PTR2.`** Le préfixe se lit `PTR<n>.` : `n` = 1 → `OtherVersion` (vieux code,
   message actuel), `n` inconnu → `UnknownFormat` (« mets le jeu à jour »), texte sans ce motif →
   `NotACode`. Le champ `format` du JSON disparaît : le préfixe le porte.
3. **Liste blanche du setup partagé.** `shareableSetup` recopie les champs utiles au replay (`teams`,
   `formatKey`, `autoPlacement`, `damagePreview`, `musicId`, `seeds`, `localSeat`) au lieu de retirer les
   champs privés : un futur champ de `CombatSetup` ne part pas dans les codes sans qu'on l'ajoute.
4. **Code entouré.** Le marqueur se cherche n'importe où dans le texte (bloc de code Discord avec langue
   compris), puis les guillemets et accents graves de fin sont retirés.
5. **Plafond de taille.** Longueur du texte et taille décompressée bornées avant `JSON.parse`, au-delà
   → `Unreadable`. Mesure : un combat 6v6 de 600 actions donne un code de 5 076 caractères, et son rejeu
   avec empreinte prend 268 ms. Bornes : 200 000 caractères, 2 Mo décompressés.

## Hors périmètre

- Rejouer un code dont le déroulé a changé : impossible avec un journal d'actions, il faudrait un export
  par événements (déjà prévu par le format versionné, pas demandé).
- La sauvegarde de reprise (`battle-persistence.ts`) garde sa garde `buildVersion` (décision #748) : une
  reprise ne se partage pas.

## Critères

- `typecheck` vert, tests du core verts.
- `replay-code.test.ts` : un code d'un autre build se décode ; `PTR1.…` → `OtherVersion` ; `PTR9.…` →
  `UnknownFormat` ; code entre guillemets ou accents graves accepté ; texte trop long → `Unreadable` ; un
  champ inconnu du setup n'apparaît pas dans le code.
- Une somme de contrôle fausse dans un code renvoie au menu avec le message « déroulé différent » (vérifié
  en jeu à la recette).
