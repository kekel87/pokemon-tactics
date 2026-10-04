# Plan 224 — Lecture des abandons : rapport honnête et appareil du joueur

**Statut** : done
**Origine** : lecture de `battle_abandoned` du 2026-10-04 (19 jours de production). La moitié des
départs a lieu au **tour 1, après 30 s**, et 37 sur 51 alors que **personne n'a perdu un PV**. Le
rapport le cache : il affiche une moyenne (« tour 8,6 ») tirée par une dizaine de longues parties, et
range ces départs en « au coude à coude ». Impossible par ailleurs de dire s'ils viennent du mobile :
les événements de partie ne portent aucune donnée d'appareil. L'humain retient deux suites (1 et 2) ;
tutoriel et indices viendront plus tard.

## Ce que tu verras à l'écran

- `pnpm stats`, bloc « Abandons » : la **médiane** du tour et de la durée de départ, plus une
  répartition par tranches de tours (≤ 2, 3-10, > 10), au lieu de la seule moyenne.
- « Dans quel état » gagne une ligne **« avant tout dégât »** : les départs où tous les camps sont
  encore à PV pleins ne sont plus comptés « au coude à coude ».
- Nouveau tableau **« Abandons rapides par appareil »** : pour chaque source d'entrée (tactile,
  souris, clavier, manette) et taille d'écran, parties lancées / partis dans les 2 premiers tours.
  Vide au début : il se remplit avec les parties jouées après la prochaine release.
- Rien ne change dans le jeu lui-même.

## Décisions de conception

- **Pas de jointure par visiteur.** Les événements de partie ne portent volontairement aucune donnée
  d'audience (`worker.ts` : « ne pas les renseigner est aussi une façon de ne pas les collecter »).
  On ne rouvre pas ce choix. À la place, le client ajoute au payload de `battle_started` et de
  `battle_abandoned` deux champs **déjà collectés en paliers** par l'événement de session :
  `inputSource` (source d'entrée active) et `screen` (palier de largeur). Aucune nouvelle surface
  d'empreinte, aucun lien entre événements.
- **Pas de redéploiement du Worker** : il n'inspecte pas le contenu métier du payload (décision #868).
  Seuls le client (release) et le script de lecture changent.
- Les deux champs sont **facultatifs** côté lecture : les lignes déjà en base n'en ont pas → rangées
  sous « inconnu », jamais réécrites.
- « Avant tout dégât » = relevé de PV non vide et **tous les camps à 1** (PV pleins). Relevé vide
  (abandon avant montage) → reste sans posture, comme aujourd'hui.
- Seuil « abandon rapide » = **≤ 2 tours**, aligné sur la tranche basse de la répartition.

## Étapes

1. `packages/app/src/analytics/telemetry.ts` : créer un helper pour exposer `inputSource()` et `screen()`
   (réutilisant `activeInputSource()` / `screenBucket()`).
2. `BattleStartedPayload` et `BattleAbandonedPayload` (app) : ajouter champs `inputSource?` et `screen?`.
   Ajouter les mêmes champs à `telemetry-worker/src/report.ts` (Worker littera les payloads).
   Renseigner les champs à l'émission (battle-telemetry.ts : appeler le helper d'étape 1).
3. `report.ts` : ajouter en Report interface :
   - `abandonTurnsMedian` et `abandonDurationMedian` (remplacer/compléter les moyennes)
   - `abandonByTurnsRange` : Tally avec clés "1-2", "3-10", "11+" (ou similaire)
   - `AbandonPosture.Untouched` (vs Losing/Winning/Even) pour tous les camps à 1 (PV pleins)
   - `abandonQuicklyByInputAndScreen` : tableau 2D (dénominateur = battle_started portant les champs)
4. `scripts/telemetry-stats.ts` : afficher médianes, tranches, posture Untouched, tableau appareils.
5. Tests : `report.test.ts` (médiane, tranches, Untouched, tableau par appareil, rétrocompat lignes sans champ),
   `battle-telemetry.test.ts` (champs présents dans les deux payloads).

## Risques / Questions

- **`activeInputSource` null au battle_started** : initTelemetry() précède initInputSystem(), donc le
  premier envoi de part les porteurs avec inputSource=null. C'est documenté (telemetry.ts ligne 409-411)
  et attendu. Les payloads suivants porteront la vraie source.
- **Visibilitychange + Pagehide pour les abandons** : le plan ne les mentionne pas, mais les sources
  d'abandon incluent TabClosed qui voyage par beacon (decision #888, #889). Pas de changement requis.
- **Dénominateur du tableau par appareil** : doit compter les `battle_started` portant inputSource et
  screen. Les lignes anciennes sans ces champs sortent séparées (« inconnu »). Vérifier que le calcul
  du dénominateur ne compte que les lignes **avec** les champs, sinon le taux des appareils sera faux.
- **Seuil « abandon rapide »** : le plan dit ≤ 2 tours. À aligner avec la tranche basse de la
  répartition par tranches (étape 3).
- **Posture Untouched vs Even** : actuellement Even = écart < 10% entre les PV. Untouched doit être un
  cas **antérieur** : tous les camps à ratio = 1.0 (PV pleins). Distinction importante : Untouched ne
  demande rien de la position, juste que personne n'ait perdu de PV. À implémenter dans postureOf().

## Hors périmètre

- Tutoriel, indices de premier tour, infobulles (retour de Frank) : plus tard, choix de l'humain.
- La page live `GET /tableau` : relevé de fréquentation, pas d'usage (décision du 2026-09-02).
- Les 12 abandons non reçus (onglet fermé sans envoi) : connu, non traité ici.
