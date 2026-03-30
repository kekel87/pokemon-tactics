---
status: done
created: 2026-03-30
updated: 2026-03-30
---

# Plan 019 — Preview dégâts estimés avec random roll

## Objectif

Afficher une estimation des dégâts infligés à chaque cible pendant la phase de confirmation d'attaque (`confirm_attack`), sous forme de fourchette min–max sur la HP bar et d'un texte flottant, en intégrant le random roll Pokemon (×0.85–1.00) dans le damage calculator.

## Contexte

Le plan 017 a posé le flow `confirm_attack` (verrouillage des cibles + clignotement + texte "Confirmer ?"). Le slot "preview dégâts" y était prévu mais non implémenté. Le `damage-calculator.ts` actuel est entièrement déterministe : pas de random roll, pas de notion de min/max. L'humain a choisi l'option B : ajouter le random roll au core, exposer `estimateDamage`, et afficher la fourchette visuellement côté renderer.

Référence visuelle : FFT n'affiche la preview que sur une seule cible à la fois. On améliore ce comportement en affichant simultanément la preview sur toutes les cibles d'une AoE.

## Étapes

- [x] Étape 1 — Core : ajouter le random roll dans `calculateDamage`
  - Le dégât final est actuellement `Math.max(1, Math.floor(baseDamage * stab * effectiveness))`
  - Ajouter un paramètre optionnel `rollFactor?: number` (défaut : `Math.random() * 0.15 + 0.85`)
  - Appliquer le roll avant le `Math.floor` final : `Math.max(1, Math.floor(baseDamage * stab * effectiveness * rollFactor))`
  - Les appels existants dans `effect-processor.ts` (via `handle-damage.ts`) ne passent pas `rollFactor` → comportement aléatoire conservé

- [x] Étape 2 — Core : créer `estimateDamage` dans `damage-calculator.ts`
  - Signature : `estimateDamage(attacker, defender, move, typeChart, attackerTypes, defenderTypes): DamageEstimate`
  - Type `DamageEstimate` : `{ min: number; max: number; effectiveness: number }` dans `packages/core/src/types/damage-estimate.ts` (1 fichier = 1 type)
  - `min` = `calculateDamage(..., 0.85)` (roll minimum)
  - `max` = `calculateDamage(..., 1.00)` (roll maximum)
  - `effectiveness` = valeur brute de `getTypeEffectiveness` (0 = immunité, 0.5 = résistance, 2 = super efficace, etc.)
  - Cas spéciaux : move Status ou immunité → `{ min: 0, max: 0, effectiveness }`

- [x] Étape 3 — Core : exposer `estimateDamage` via `BattleEngine`
  - Ajouter une méthode publique `BattleEngine.estimateDamage(attackerId, moveId, defenderId): DamageEstimate`
  - Elle récupère les instances, types et type chart depuis l'état interne
  - Elle appelle `estimateDamage` du `damage-calculator.ts`
  - Exporter `DamageEstimate` et `estimateDamage` depuis `packages/core/src/index.ts`

- [x] Étape 4 — Core : tests unitaires
  - Dans `damage-calculator.test.ts` : tests du paramètre `rollFactor` (roll 0.85 donne min, roll 1.00 donne max, appel sans paramètre reste dans la fourchette)
  - Tests `estimateDamage` : cas normal (min < max), immunité (min=max=0, effectiveness=0), STAB + super efficace (fourchette correcte), Status move (min=max=0)
  - Les tests existants ne doivent pas se casser (les appels sans `rollFactor` restent valides)

- [x] Étape 5 — Renderer : preview HP bar avec zone dégradée
  - Dans `PokemonSprite.ts`, ajouter une méthode `showDamageEstimate(estimate: DamageEstimate | null): void`
  - Si `estimate` non null : dessiner sur la HP bar une zone dégradée entre `min` et `max`
    - Calculer `hpAfterMax = (currentHp - estimate.max) / maxHp` et `hpAfterMin = (currentHp - estimate.min) / maxHp` (clampés à 0)
    - Zone rouge foncé `0xcc0000` de `hpAfterMax` à `hpAfterMin` superposée sur la HP bar (représente les dégâts garantis vs possibles)
    - La HP bar existante reste intacte (vie actuelle) sous la zone
  - Si `estimate` null : effacer la zone (appel depuis `clearDamageEstimate()` ou `showDamageEstimate(null)`)
  - Ajouter les constantes dans `constants.ts` : `HP_DAMAGE_ESTIMATE_COLOR_GUARANTEED` (rouge foncé), `HP_DAMAGE_ESTIMATE_COLOR_POSSIBLE` (rouge clair)

- [x] Étape 6 — Renderer : texte flottant dégâts sur les cibles
  - Dans `PokemonSprite.ts`, ajouter une méthode `showDamageText(estimate: DamageEstimate | null): void`
  - Afficher un `Phaser.GameObjects.Text` au-dessus du sprite (offset Y : `-64px` au-dessus du centre du container)
  - Format : `"38–45"` si `min !== max`, `"38"` si `min === max`
  - Cas spéciaux : immunité (`estimate.effectiveness === 0`) → afficher `"Immunisé"` en gris ; move Status → pas de texte
  - Style : police blanche, taille 13, ombre noire 1px, depth `DEPTH_POKEMON_BASE + 500` pour rester au-dessus des sprites
  - Si `estimate` null : détruire/cacher le texte

- [x] Étape 7 — Renderer : intégration dans le flow `confirm_attack`
  - Dans `GameController.ts`, lors de l'entrée en phase `confirm_attack` (fonction qui calcule `affectedTiles`) :
    - Pour chaque Pokemon sur une `affectedTile` : appeler `engine.estimateDamage(activePokemonId, moveId, targetId)`
    - Appeler `sprite.showDamageEstimate(estimate)` et `sprite.showDamageText(estimate)` sur le sprite de chaque cible
  - À la sortie de `confirm_attack` (confirmation ou annulation) : appeler `sprite.showDamageEstimate(null)` et `sprite.showDamageText(null)` sur tous les sprites concernés
  - Nettoyer aussi dans la méthode de reset/annulation existante

- [x] Étape 8 — Renderer : cas spéciaux
  - **Move Status** (aucun effet dégâts) : pas de preview HP bar, pas de texte dégâts. Afficher optionnellement l'effet principal (ex : `"ATK +2"`) dans le texte flottant si le move a exactement un `stat_change` effect — sinon rien
  - **Immunité** (`effectiveness === 0`) : texte `"Immunisé"` en gris, pas de zone sur la HP bar
  - **Multi-cibles AoE** : déjà géré par l'étape 7 (boucle sur toutes les `affectedTiles`). Vérifier que l'affichage simultané fonctionne pour les patterns Cone, Cross, Blast, Slash, Zone
  - **Caster = cible** (self, Cross centré) : afficher la preview sur le caster également si le move lui inflige des dégâts

## Critères de complétion

- `calculateDamage` avec `rollFactor=0.85` retourne toujours le minimum, `rollFactor=1.00` retourne toujours le maximum
- `estimateDamage` retourne `{ min, max, effectiveness }` cohérent avec `calculateDamage`
- En phase `confirm_attack`, chaque cible affiche une zone dégradée sur sa HP bar et un texte `"min–max"` (ou `"Immunisé"` si effectiveness=0)
- À la confirmation ou annulation, tous les textes et zones disparaissent proprement
- Sur un move AoE (ex: Cross à 4 cibles), les 4 previews s'affichent simultanément
- Les moves Status n'affichent pas de preview HP bar (et affichent l'effet stat si applicable)
- 100% coverage maintenu sur `packages/core`

## Risques / Questions

- La HP bar actuelle est dessinée avec `Phaser.GameObjects.Graphics` (pas de texture). Il faut s'assurer que superposer un deuxième `Graphics` pour la zone dégradée ne crée pas de z-order imprévu — à gérer dans l'ordre d'ajout au container.
- Le format `"38–45"` utilise un tiret cadratin (`–`, U+2013). Vérifier que la police bitmap Phaser rend ce caractère correctement ; si non, utiliser un tiret simple (`-`).
- Les cibles friendly fire (alliés touchés par AoE) : la preview s'affiche sur eux aussi. C'est le comportement souhaité (décision #128 : pas de warning friendly fire spécifique).
- `estimateDamage` depuis `BattleEngine` nécessite que les `pokemonTypesMap` soient accessibles en lecture — c'est déjà le cas (champ privé, mais on ajoute une méthode publique qui l'utilise en interne).

## Dépendances

- **Avant ce plan** : Plan 017 (flow `confirm_attack` + `affectedTiles` disponibles) — terminé
- **Avant ce plan** : Plan 015 (stats niveau 50, `combatStats` dans `PokemonInstance`) — terminé
- **Ce plan débloque** : future preview de précision (hit%, calculé depuis `accuracy-check.ts`) si décidé en Phase 1
