# Plan 227 — Dépilage du backlog d'octobre

**Statut** : done
**Origine** : relecture du backlog au `/next` du 2026-10-05. L'humain retient dix entrées, écarte
`backlog-6-0-demande-avantage-mecanique` (soldée).

## Ce que tu verras à l'écran

- Un Pokémon qui tient un **Talisman Sain**, ou qui a **Corps Sain**, **Hyper Cutter**, **Attention**,
  **Benêt** ou **Querelleur**, ne perd plus d'Attaque face à **Intimidation** : son talent ou son objet
  s'affiche à la place, comme dans les jeux. Un Pokémon avec **Acharné** ou **Battant** qui subit
  Intimidation gagne +2 en Attaque ou en Attaque Spéciale.
- L'infobulle d'attaque dit **« Modifiée par : Champ Herbu »** au lieu de « ici : Champ Herbu ».
- `pnpm stats` ne compte plus double une partie en ligne commencée juste avant la période lue (plus
  jamais de taux d'abandon négatif), et affiche un tableau **espèce contre espèce**.
- Le reste ne se voit pas : tests, outillage Claude, entrées de backlog soldées.

## Lots

### 1. Intimidation et blocages de stats (core + data)

Cause : `onAuraCheck` d'Intimidation (`packages/data/src/abilities/ability-definitions.ts:239`) baisse
l'Attaque à la main ; il ne passe ni par `onStatChangeBlocked` des talents ni par celui des objets,
parce que `AuraCheckContext` (définie ligne 141-145 de `packages/core/src/types/ability-definition.ts`)
ne porte que `self`, `state` et `pokemonTypesMap`.

- `AuraCheckContext` gagne `abilityRegistry` et `itemRegistry` (fournis par appels aux lignes 1558
  et 1588 de `BattleEngine.ts`).
- Intimidation consulte, dans l'ordre de `handle-stat-change.ts` : talent de la cible
  (`onStatChangeBlocked`, registre direct — Brise Moule ne joue pas : il ne vaut que pendant une
  capacité, et l'Intimidateur ne peut pas l'avoir), objet (`effectiveHeldItem`), puis Brume.
- Canon Gen 8+ (vérifié par `game-designer` sur le cache Showdown) : Attention (`inner-focus`),
  Benêt (`oblivious`), Querelleur (`scrappy`) bloquent Intimidation. Tempo Perso, câblé en dur avec un
  `continue` qui saute le statut Intimidated (Intimidation se redéclenche donc à chaque passe), passe
  dans le même chemin : bloqué = statut posé avec `statChangeApplied: false`, comme Brume.
- Acharné (`defiant`) et Battant (`competitive`) réagissent quand la baisse passe réellement (pas si
  bloquée, pas si déjà à -6) : appel de `onAfterStatLowered`, aujourd'hui jamais atteint par
  Intimidation.
- Hors lot, non implémentés dans le projet : Écran Fumée, Métallo-Garde, Armure Miroir, Chien de
  Garde, Sac Adrénaline. Peureux ne réagit pas à Intimidation ici.
- Tests d'intégration first : un test par bloqueur, Acharné / Battant, retour d'Attaque à la sortie
  d'adjacence inchangé.

### 2. Libellé « ici » (ui)

`moveContext.effective` : FR « Modifiée par », EN « Modified by », ES « Modificado por ». Neutre parce
que la cause peut être un bonus **ou** un malus (pluie sur un move Feu) : « Bonus ici » mentirait.

### 3. Télémétrie, 4 entrées

- **Partie à cheval sur la borne** (`report.ts:540`, lignes 704-717) : une fin dont l'identifiant n'a
  aucun `battle_started` dans la fenêtre lue est ignorée. La logique actuelle (ligne 705 :
  `onlineBattleIds.has(payload.battleId) && countedEnds.has(payload.battleId)`) vérifie que chaque fin
  dédupliquée a bien vu son départ. Corrige le double comptage et le taux d'abandon aberrant sans
  ajouter `mode` à `BattleEndedPayload` (exclus au plan 204). Note : tous les `battle_started` portent
  `battleId` depuis le plan 201 (2026-09-08), donc l'ensemble `onlineBattleIds` ne risque pas d'être
  vide sur des lignes antérieures utiles.
- **battleId vers la télémétrie non prouvé** : `beginBattleTelemetry` reçoit le `setup` et lit
  lui-même les champs optionnels ; le spread de `combat-screen.ts:412` disparaît. Test unitaire.
- **Victoire par affrontement** : tableau espèce × espèce adverse (victoires / n), même seuil de 10
  apparitions que decision-1069. **Dérive constatée en dev** : la télémétrie ne portait pas les
  espèces de l'IA, adversaire de 21 parties sur 22. Arbitrage humain du 2026-10-05 : `battle_ended`
  porte désormais `aiTeams` (camp + espèces de l'IA), qui ne sert QU'À nommer l'adversaire — jamais
  dans un usage, jamais sujet d'un affrontement, jamais dans le `n` de la cohorte de force. Forfaits
  et matchs nuls écartés. Les deux camps d'une partie en ligne sont recollés par `battleId`.
- **Écart télémétrie / itch.io** : Claude sort le nombre de sessions `first: true` sur 7 jours ;
  l'humain lit « Browser Plays » sur le tableau de bord itch. Écart faible → soldée ; sinon on note
  l'écart et la piste du bloqueur de pub.

### 4. Multijoueur, 2 entrées

- **Somme de contrôle après un vrai K.O.** : helper `testing/` qui place deux Pokémon au contact,
  puis test d'intégration qui va jusqu'au K.O. et compare la somme de contrôle des deux moteurs.
- **Échecs intermittents en ligne à froid** : pas de reproduction locale (gel du PC). Lecture de
  l'historique GitHub (`gh run list` sur `e2e.yml`) depuis le plan 213. Aucun échec `online-*` →
  soldée avec le chiffre ; sinon on récupère la trace et on corrige l'assertion nommée.
  **Constaté** : 54 exécutions vertes depuis le 2026-09-16, mais la CI rejoue 2 fois et masque les
  instables. Journaux relus : §11.3 (`online-resilience`) relancé 6 fois sur 54, toujours la même
  assertion — le bandeau passe par « Connexion instable » avant « En attente de reconnexion », et
  ce passage dépasse parfois 5 s. Délai porté à 15 s. §11.11 et §11.7 : 1 fois chacun, lenteur de
  l'annuaire PeerJS au démarrage, laissés ouverts.

### 5. Outillage Claude, 2 entrées

- **Agent commit-message** (`.claude/agents/commit-message.md`) : ne lance plus le lint et ne traite
  plus « Linter process terminated abnormally » comme un gate rouge ; le verdict du gate du tour fait
  foi.
- **Hooks** : ajouter `Bash` au matcher de `block-backlog-write.py` dans `.claude/settings.json`
  (accord de l'humain du 2026-10-05). Balayage des `\b` terminaux dans `.claude/hooks/`, remède
  `(?![-\w])` / `($|[^-[:alnum:]])`. Tester que `--add backlog` est refusé, `--resolve` et `--open`
  passent.

## Hors périmètre

Mode Aventure, éditeur voxel, effets visuels d'attaque, release.
