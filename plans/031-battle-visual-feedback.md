---
status: done
created: 2026-04-03
updated: 2026-04-03
---

# Plan 031 — Feedbacks visuels de combat et refactor statuts volatils

## Objectif

Rendre le combat lisible : le joueur voit et comprend ce qui se passe à chaque action. Système de textes flottants unifié, animations de knockback/confusion, et refactor du système de liens (ActiveLink) vers des statuts volatils (Seeded, Trapped).

## Contexte

Le core émet 29 types d'events, mais le renderer n'en traite que ~10. Les mécaniques ajoutées en plan 026 (knockback, confusion, bind, multi-hit) n'ont aucun feedback visuel. Le joueur ne voit pas les miss, l'effectiveness, les stat changes, ni les dégâts en nombre. Le système `ActiveLink` (vampigraine + ligotage) est over-engineered (distance, lien bidirectionnel) — les décisions #173-174 le remplacent par des statuts volatils simples.

### Décisions applicables

- **#173** — Vampigraine : statut `Seeded` avec `sourceId`, drain 1/8 HP/tour + heal lanceur, pas de lien distance. Immunité Plante. S'arrête si lanceur meurt. Retiré par Feu/lave/Rapid Spin.
- **#174** — Piège : statut `Trapped`, immobilise + DoT optionnel (1/8 HP/tour, N tours). Sortie par knockback/dash. Rapid Spin futur.
- **#175** — 10 moves piège Pokemon, tous mécaniquement identiques (1/8 HP, 4-5 tours). Visuel générique teinté par type.
- **#177** — Coups critiques : plan dédié séparé.

## Étapes

### Étape 1 — Système de textes flottants (BattleText)

Créer un système réutilisable de textes flottants animés dans le renderer. Un texte apparaît au-dessus du sprite ciblé, monte légèrement et s'estompe (fade out + drift up).

**Fichier** : `packages/renderer/src/ui/BattleText.ts`

- Fonction `showBattleText(scene, x, y, text, options?)` qui crée un `Phaser.GameObjects.Text`, l'anime (tween: y -= 30px, alpha 1→0, durée ~800ms), puis le détruit
- Options : `color` (string), `fontSize` (number), `duration` (ms), `offsetY` (number)
- Constantes dans `constants.ts` : couleurs par type de texte (dégâts blanc, miss gris, super effective jaune, not very effective gris clair, immune gris, heal vert, stat up bleu, stat down rouge)
- Pas de queue — les textes se superposent si multiples (avec un léger décalage vertical pour la lisibilité)

**Intégration dans `GameController.processEvent()`** :

| Event | Texte affiché | Couleur |
|-------|--------------|---------|
| `DamageDealt` | `"-42"` (montant) + `"Super effective!"` / `"Not very effective..."` si effectiveness ≠ 1 | Blanc + Jaune/Gris |
| `MoveMissed` | `"Miss!"` | Gris |
| `StatChanged` | `"Attack +2"` / `"Defense -1"` etc. | Bleu (buff) / Rouge (debuff) |
| `ConfusionTriggered` | `"Confused!"` | Violet |

**Tests** : test unitaire de `showBattleText` (crée un text, vérifie les propriétés). Tests visuels via visual-tester si pertinent.

### Étape 2 — Knockback slide animation

Traiter l'event `KnockbackApplied` dans `GameController.processEvent()`.

- Récupérer le sprite du Pokemon ciblé
- Animer un tween de `from` vers `to` (positions isométriques) sur ~200ms (même durée que `MOVE_TWEEN_DURATION_MS`)
- Jouer l'animation "Hurt" pendant le slide
- Revenir en "Idle" après
- Pour `KnockbackBlocked` : jouer juste "Hurt" + un léger shake horizontal (tween x ±3px, 2 repeats, 50ms) pour montrer que le Pokemon est bloqué

### Étape 3 — Confusion wobble

Traiter l'event `ConfusionTriggered` dans `GameController.processEvent()`.

- Le texte "Confused!" est déjà affiché par l'étape 1
- Ajouter un wobble du sprite : tween rotation (ou x oscillation) ±3-5px, 3 oscillations, durée ~400ms
- Pour `ConfusionRedirected` : afficher un texte additionnel sur la nouvelle cible (optionnel, à évaluer visuellement)
- Pour `ConfusionFailed` : afficher "Confused!" + le wobble, pas d'action exécutée (le core gère déjà le skip)

### Étape 4 — Refactor core : Vampigraine → statut Seeded

Remplacer le traitement `ActiveLink` de Vampigraine par un statut volatil `Seeded`.

**Modifications core** :

1. Ajouter `Seeded: "seeded"` à `StatusType` (enum)
2. Enrichir `VolatileStatus` : ajouter un champ optionnel `sourceId?: string` (pour le heal du lanceur)
3. Créer `packages/core/src/battle/handlers/seeded-tick-handler.ts` :
   - Drain 1/8 HP max de la cible
   - Si `sourceId` et source vivante : heal source du même montant
   - Si source morte : retirer le statut Seeded
   - Émettre `DamageDealt` (sur cible) + `HpRestored` (sur source, nouveau event ou réutiliser un existant)
4. Modifier `handleLink.ts` : ne plus traiter `LinkType.LeechSeed` (ou supprimer si Bind aussi migré)
5. Modifier les données de Vampigraine dans `tactical.ts` : remplacer `EffectKind.Link` par `EffectKind.Status` avec `status: StatusType.Seeded`
6. Ajouter l'immunité type Plante dans le handler de status application (vérifier le type de la cible)
7. Intégrer `seededTickHandler` dans le pipeline EndTurn (à côté de `statusTickHandler`)

**Tests** : adapter `leech-seed.test.ts` — mêmes scénarios, nouvelle mécanique :
- Drain 1/8 HP + heal source
- Source morte → statut retiré
- Immunité type Plante
- Multiples Vampigraines sur différentes cibles

### Étape 5 — Refactor core : Ligotage → statut Trapped

Remplacer le traitement `ActiveLink` de Bind par un statut volatil `Trapped`.

**Modifications core** :

1. Ajouter `Trapped: "trapped"` à `StatusType`
2. Enrichir `VolatileStatus` : ajouter champs optionnels `damagePerTurn?: number` (fraction, ex: 0.125), `remainingTurns?: number`
3. Créer `packages/core/src/battle/handlers/trapped-tick-handler.ts` :
   - Si `damagePerTurn` : infliger dégâts (fraction du maxHp)
   - Décrémenter `remainingTurns`, retirer si ≤ 0
   - Émettre `DamageDealt` + `StatusRemoved` si expiré
4. Modifier `BattleEngine.getLegalActions()` : bloquer les actions `Move` si le Pokemon a le statut `Trapped` (remplacer la vérification `activeLinks` actuelle)
5. Ajouter une sortie par knockback : dans le handler knockback, si le Pokemon a `Trapped`, retirer le statut après le déplacement
6. Ajouter une sortie par dash : idem dans le handler dash
7. Modifier les données de Ligotage (Wrap) dans `tactical.ts` : remplacer `EffectKind.Link` par `EffectKind.Status` avec `status: StatusType.Trapped` + propriétés DoT
8. Supprimer `LinkType`, `ActiveLink`, `activeLinks` de `BattleState`, `handle-link.ts`, `link-drain-handler.ts`, `mock-link.ts` — nettoyage complet du système de liens

**Tests** : adapter `wrap.test.ts` + `bind-status.test.ts` :
- Immobilisation (pas de Move, Act autorisé)
- Dégâts par tour
- Expiration après N tours
- Sortie par knockback
- Sortie par dash

### Étape 6 — Feedbacks visuels Seeded et Trapped

**Renderer — Seeded** :
- `StatusApplied` avec `Seeded` : afficher icône statut graine/plante sur le sprite
- Au tick (event `DamageDealt` depuis seeded) : particules vertes montant de la cible (optionnel, Phaser particles si simple, sinon juste le flash dégâts + texte flottant)
- Heal source : texte flottant vert `"+12"` sur la source

**Renderer — Trapped** :
- `StatusApplied` avec `Trapped` : afficher icône statut cadenas/piège sur le sprite
- Au tick : texte flottant dégâts (réutilise le système de l'étape 1)
- `StatusRemoved` avec `Trapped` : retirer l'icône

**Assets** : ajouter les icônes statut Seeded et Trapped dans le sprite sheet des statuts (ou les créer programmatiquement avec des formes Phaser simples si pas d'asset disponible).

### Étape 7 — Events renderer manquants

Traiter les events actuellement ignorés dans `processEvent()` :

| Event | Feedback |
|-------|----------|
| `DefenseActivated` | Texte flottant `"Protect!"` / nom du move défensif |
| `DefenseTriggered` | Flash + texte `"Blocked!"` si blocked=true |
| `MultiHitComplete` | Texte flottant `"N hits!"` |
| `RechargeStarted` | Texte flottant `"Must recharge..."` |
| `LinkBroken` | (supprimé après étape 5, remplacé par StatusRemoved) |

### Étape 8 — i18n des nouveaux textes

Ajouter toutes les nouvelles clés de texte flottant dans les fichiers i18n FR et EN :

- `battle.miss` → "Raté !" / "Miss!"
- `battle.superEffective` → "Super efficace !" / "Super effective!"
- `battle.notVeryEffective` → "Pas très efficace..." / "Not very effective..."
- `battle.immune` → "Immunisé" / "Immune"
- `battle.confused` → "Confus !" / "Confused!"
- `battle.blocked` → "Bloqué !" / "Blocked!"
- `battle.hits` → "{count} coups !" / "{count} hits!"
- `battle.recharge` → "Doit recharger..." / "Must recharge..."
- `status.seeded` → "Vampigraine" / "Seeded"
- `status.trapped` → "Piégé" / "Trapped"
- Stat changes : `stat.attack`, etc. (vérifier si déjà présents)

## Critères de complétion

- `pnpm build` compile sans erreur
- `pnpm test` passe — tous les tests existants adaptés + nouveaux tests
- Le système `ActiveLink` est entièrement supprimé du codebase
- `StatusType.Seeded` et `StatusType.Trapped` sont fonctionnels dans le core avec tests
- Les textes flottants s'affichent pour : dégâts, miss, effectiveness, stat changes, confusion, defense, multi-hit, recharge
- Knockback montre un slide animé
- Confusion montre un wobble
- Seeded et Trapped ont des icônes de statut
- Tous les textes sont traduits FR/EN
- `pnpm biome check` passe (lint + format)

## Risques et points d'attention

- **Ordre des étapes** : le refactor core (étapes 4-5) doit passer avant les visuels (étape 6) car les events changent
- **Suppression ActiveLink** : vérifier que le replay system n'en dépend pas (les replays rejouent des actions, pas des links — devrait être OK)
- **VolatileStatus enrichi** : l'ajout de `sourceId`, `damagePerTurn`, `remainingTurns` sur `VolatileStatus` change l'interface — vérifier tous les consommateurs
- **Tests existants** : `leech-seed.test.ts`, `wrap.test.ts`, `bind-status.test.ts` doivent être réécrits, pas juste adaptés
