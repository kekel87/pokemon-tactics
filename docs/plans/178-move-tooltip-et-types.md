# Plan 178 — Tooltip d'attaque enrichi + harmonisation de l'affichage des types

> **Statut** : done (2026-08-03)
> **Créé** : 2026-08-03
> **Phase** : 6.5 « Client jouable », Lot 3 (compléter l'UI). Suite des plans 174 (InfoPanel allié), 177 (panneau de case), 175 (preview de combat).
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` — item Lot 3 « **Info move** : tooltips complets + tooltips type chart ».

## Motivation

Le tooltip d'attaque (`packages/ui-dom/src/move-tooltip.ts`, plan 121) affiche aujourd'hui : icône de catégorie, `Puis: X  Préc: Y`, nom du pattern + portée, ~80 tags mécaniques, mini-grille de ciblage. Il lui manque des **faits mécaniques déterminants**, absents de toute l'UI :

- **Contrecoup, drain et auto-K.O.** : 8 moves ont un `EffectKind.Recoil`, 7 un `EffectKind.Drain`, 6 sont de la famille auto-K.O. — **aucun tag pour aucune des trois**. Bélier ne dit nulle part qu'il reprend 1/4 des dégâts infligés au lanceur, Méga-Sangsue ne dit pas qu'elle en soigne 50 %, Destruction ne dit pas que le lanceur tombe K.O. Le seul garde-fou existant (`fraction >= 999`, ligne 267) est **du code mort** — voir § 1.1.
- **Coût CT chiffré** : seules 4 pastilles de tempo sur la ligne du move (`moveCtTempo`, 5 paliers : ≤500 / ≤600 / ≤700 / ≤800 / au-delà). Deux moves affichant `●●●○○` sont indiscernables alors que le CT **est** notre système d'initiative.
- **Type nommé** : le type n'existe qu'en icône sur la ligne du move, jamais écrit.
- **Chance d'effet secondaire** : « 30 % Brûlure » n'apparaît qu'à la confirmation de cible (preview, plan 175), donc **après** s'être engagé sur un move.

En parallèle, l'audit de l'affichage des types a révélé **trois mécanismes concurrents** et des chaînes non traduites (§ Volet 2).

## Décisions prises avec l'humain (2026-08-03)

| Sujet | Décision |
|---|---|
| **Table de types complète (18×18)** | **Abandonnée.** Mur d'icônes encyclopédique ; la preview (plan 175) donne déjà le multiplicateur **résolu** (STAB, hauteur, terrain, écrans) avec plage de dégâts et verdict K.O. — strictement plus utile qu'une table abstraite. Retire l'item « tooltips type chart » du plan-cadre 173. |
| **Efficacité contextuelle par move** (badge `×2` sur chaque ligne du sous-menu) | **Abandonnée.** Exigeait une « cible de référence collante » (la carte curseur se vide dès que le pointeur quitte l'occupant, `refreshCursorPanel` ligne 436) : nouvel état + ancre visuelle obligatoire, sinon le badge ment silencieusement dès qu'il y a plusieurs ennemis. Trop de design pour un tri grossier (multiplicateur de type seul ≠ létalité réelle). |
| **Descriptions textuelles de moves** | **Abandonnées.** `shortDescription`/`longDescription` FR+EN existent dans `packages/data/reference/moves.json` mais ne sont pas chargées ; la FR est de l'ambiance, l'**EN est mécanique et décrit le canon Gen 8/9** (priorités, cibles) qui diverge de nos règles (CT au lieu de priorité, patterns tactiques maison). Le tooltip reste factuel, dérivé de notre `MoveDefinition`. |
| **Catégorie nommée** (texte à côté de l'icône physique/spécial/statut) | **Écartée**, jugée pas nécessaire. |
| **Coût CT** | Affiché **avec** les pastilles (redondance assumée : les pastilles donnent la lecture instantanée, le chiffre la comparaison fine) **et** le modificateur Pression — voir la nuance § Volet 1.2, le total exact n'est calculable qu'à la confirmation. |
| **Chip de type** | Réutiliser **le chip existant de l'InfoPanel** (`.ip-type`), pas un nouveau style. |
| **Harmonisation des types** | Traitée **dans ce plan**, en second volet. |

## Hors périmètre

- Responsive / mobile du tooltip (le survol n'existe pas au doigt → **Lot 1**, tap-to-inspect).
- Fog-of-war complet (plan 176) : ce plan ne fait que respecter la règle déjà posée au plan 175 (`revealedAbility`).
- Les 3 autres items du Lot 3 (auras, responsive + dette mobile, a11y).

---

## Volet 1 — Tooltip d'attaque enrichi

### 1.1 Tags contrecoup, drain et auto-K.O.

Nouveaux tags dans `tagLines()` (`move-tooltip.ts`), alimentés par des champs **déjà présents** dans `MoveDefinition` — aucune donnée à produire. Inventaire exhaustif vérifié dans `packages/data/src/overrides/tactical.ts` :

**Contrecoup — `EffectKind.Recoil`, 8 moves.** Deux formes selon le champ existant `ofMaxHp` :

| Forme | Moves | Tag |
|---|---|---|
| `ofMaxHp: true`, `fraction: 0.5` | Métalaser | « subit 50 % de ses PV max » |
| `fraction: 1/4` | Bélier, Éclair Fou | « subit 1/4 des dégâts infligés » |
| `fraction: 1/3` | Boutefeu, Damoclès, Rapace, Aquatacle, Martobois | « subit 1/3 des dégâts infligés » |

**Drain — `EffectKind.Drain`, 7 moves.** Vole-Vie, Méga-Sangsue, Giga-Sangsue, Vampirisme, Vampi-Poing, Dévorêve (`fraction: 0.5`) et Vampibaiser (`0.75`) → « soigne 50 % des dégâts infligés ».

**Auto-K.O. — 6 moves, gap découvert en rédigeant ce plan.** Aucun tag n'existe pour cette famille (plan 147) :

| Champ | Moves | Sémantique |
|---|---|---|
| `isExplosion: true` | Destruction, Explosion, Explo-Brume | Le lanceur tombe K.O. ; **annulé par Moiteur** |
| `selfKo: true` | Souvenir, Vœu Soin | Le lanceur tombe K.O., inconditionnellement (Moiteur ne bloque pas) |
| `selfKoOnConnect: true` | Tout ou Rien | Le lanceur tombe K.O. **seulement s'il touche** |

> 🔴 **Code mort à supprimer** (`move-tooltip.ts:267`) : la branche `EffectKind.Recoil && effect.fraction >= 999` → tag `moveTooltip.tag.mistyExplosionSelfKo` **ne peut jamais s'exécuter**. Aucun move du jeu n'a de `Recoil` avec une telle fraction (`999` n'apparaît nulle part dans les données) : Explo-Brume tombe K.O. via `isExplosion: true`, pas via un contrecoup géant. Conséquence actuelle : le tooltip d'Explo-Brume **ne dit rien** de son auto-K.O., alors que la clé i18n existe et décrit exactement ça (« 💥 Le lanceur tombe K.O. · ×1.5 sur Champ Brumeux »). Le tag `isExplosion` ci-dessus le remplace ; la branche morte et sa clé partent (zéro tolérance au code mort, CLAUDE.md). Le bonus ×1.5 sur Champ Brumeux est déjà couvert par ailleurs (`fieldTerrainPowerBonus`), à vérifier à l'implémentation pour ne pas perdre l'info.

> **Décision de vocabulaire — actée (2026-08-03)** : le mot « **recul** » est déjà pris deux fois dans le projet — l'éjection par knockback (« ring-out par recul », Draco-Queue) et le tag existant `moveTooltip.tag.crashOnMiss` = « 💥 Recul si échec ou immunité » (dégâts de chute sur échec). Pour les dégâts de recoil-sur-touche, retenir « **Contrecoup** » afin d'éviter la collision, d'autant que les deux tags peuvent s'afficher sur le même move. Validé par l'humain.

Nouvelles clés i18n (FR+EN) : `moveTooltip.tag.recoilFraction`, `moveTooltip.tag.recoilMaxHp`, `moveTooltip.tag.drain` (paramétrées par la fraction, formatée en pourcentage), `moveTooltip.tag.selfKoExplosion`, `moveTooltip.tag.selfKo`, `moveTooltip.tag.selfKoOnConnect`. La clé `moveTooltip.tag.mistyExplosionSelfKo` est supprimée (`types.ts` + les 2 locales).

### 1.2 Coût CT chiffré + modificateur Pression

**Contrainte découverte** : `computePressureBonus(attackerId, move, targetIds, state, abilityRegistry)` (`packages/core/src/battle/pressure.ts`) somme `ability.targetedCtBonus` **par cible effectivement touchée**, et seulement pour un move offensif (`isOffensiveMove`). Au moment du tooltip (phase `attack_submenu`), **aucune cible n'est choisie** → le total réel est structurellement inconnaissable. Sur une AoE touchant 3 porteurs de Pression, le bonus se cumule.

Découpage retenu, honnête sur ce qui est connu à chaque instant (**validé par l'humain le 2026-08-03**, en écart assumé de la demande initiale « chiffre + modificateur dans le tooltip » — le modificateur n'y est pas calculable) :

| Moment | Affichage |
|---|---|
| **Tooltip** (sous-menu, pas de cible) | Coût de **base** (`computeMoveCost(pp, power, effectTier)`) + les pastilles. Rien sur Pression — voir l'encadré ci-dessous. |
| **Preview de confirmation** (plan 175, cibles connues) | Ligne CT **à elle seule** portant le total exact, la surtaxe Pression affichée **séparément et colorée en danger** (`CT: 750` + `+50`). C'est là que le souhait « chiffre + modificateur » est pleinement satisfaisable. |

> **Tag conditionnel « +N CT par cible sous Pression » au tooltip — ABANDONNÉ (2026-08-03).** Le draft de ce plan le prévoyait (afficher un avertissement quand un porteur de Pression au talent **révélé** est sur le terrain). Écarté à l'implémentation : la règle de fog du plan 175 n'autorise à nommer un talent ennemi que si `revealedAbility` est posé, ce qui n'arrive qu'avec Fouille / Prédiction / Anticipation. Contre un adversaire ordinaire le tag ne s'afficherait donc **jamais** — soit exactement le genre de branche morte que ce plan supprime par ailleurs (§ 1.1, `fraction >= 999`). L'afficher sans gating serait une fuite d'information : on annoncerait un talent que l'InfoPanel cache.

> **Leçon de human-testing (2026-08-03)** : la surtaxe était d'abord fondue dans une seule chaîne (`CT: 750 (+50)`), en 3ᵉ valeur de la ligne `Préc./Crit.` — elle **débordait de 10 px** son conteneur et passait totalement inaperçue. D'où le découpage en deux champs de view-model (`ctText` + `ctSurchargeText`) et la ligne dédiée.

Implémentation :

- **Nouvelle API core publique** `BattleEngine.previewMoveCtCost(moveId: string, targetIds?: readonly string[]): { base: number; pressureBonus: number; total: number }`.
  - `targetIds` absent ou vide → `pressureBonus: 0` et `total === base` (cas du tooltip : pas de cible choisie). Jamais d'estimation inventée.
  - `moveId` inconnu du `moveRegistry` → mêmes valeurs que le repli existant de `computeCurrentMoveCost` (`600`), pour ne pas introduire un second comportement de repli.
  - **Extraction, pas duplication** : `computeCurrentMoveCost()` (privé, ligne 3847) est **rétrospectif** (`turnState.lastMoveId`) et ne peut pas servir directement, mais il doit être **réécrit pour déléguer** à la nouvelle méthode (`previewMoveCtCost(lastMoveId, turnState.lastTargetIds)`). Un seul calcul, deux points d'entrée.
  - **Callsites** : `battle-orchestrator.ts` remplit `ctCost` du view-model du sous-menu (~ligne 569) ; `buildCombatPreviewView` (plan 175) l'appelle avec les cibles focalisées pour la ligne CT de la preview.
- `AttackSubmenuMoveView` (`packages/render-ports/src/view-models.ts`) gagne `ctCost: number` à côté de `costTempo`, rempli dans `battle-orchestrator.ts` (~ligne 569, là où `costTempo` est déjà calculé).
- La ligne CT de la preview réutilise la même API avec les cibles focalisées.

> ⚠️ Les pastilles `costTempo` sont aujourd'hui calculées depuis la seule `definition` — elles **ignorent déjà** Pression. Le chiffre de base affiché à côté sera donc cohérent avec elles. Ne pas faire diverger les deux (leçon plan 175 / `damage-context.ts`).

### 1.3 Type nommé

Chip icône + label (« Roche ») dans le tooltip, en **réutilisant le chip de l'InfoPanel** (`.ip-type`, `info-panel.css:134`) plutôt qu'un style neuf. Implique d'extraire le rendu du chip dans un helper partagé de `ui-dom` — voir Volet 2, dont c'est le premier client.

### 1.4 Chance d'effet secondaire

La preview a déjà `buildEffectChip` (`packages/view-core/src/combat-preview-view.ts:165`, privée) : premier effet `Status` ou `StatChange` avec `chance` strictement entre 0 et 100, rendu « `30 %` + icône de statut » ou « `Vitesse 1↓ · 20 %` ».

**Extraire cette fonction en partagé** (`view-core`, exportée) et la consommer des deux côtés au lieu de la réécrire. Motif : le plan 175 a montré qu'un calcul dupliqué finit par diverger — `estimateDamage` et `handle-damage.ts` avaient dérivé pendant des mois (morph météo de Météore, malus pluie de Lance-Soleil, Coup d'Main…), faussant à la fois le chiffre affiché et ~10 heuristiques IA, d'où `damage-context.ts`.

Conséquence : le tooltip cesse de lire uniquement `MoveDefinition` et consomme un fragment de view-model. À vérifier que ça ne casse pas la vocation « pure view, no state » du composant — l'effet secondaire est dérivable de la seule définition, donc le fragment reste sans état de combat.

---

## Volet 2 — Harmonisation de l'affichage des types

### Constat de l'audit

| Mécanisme | Consommateurs | Problème |
|---|---|---|
| `TYPE_LABEL` : `Record<PokemonType, {fr, en}>` en dur, exporté de `packages/view-core/src/battle-views.ts` | `buildTypeChips` (chips InfoPanel, ligne 211), `typeLabelOf` (immunités du panneau de case + volatile « type changé »), `BattleLogFormatter.ts` | Branche à la main sur `language === "fr"`, **hors du système i18n** |
| Clés i18n `pokemonType.<id>` (18 × FR/EN, `packages/app/src/i18n/locales/{fr,en}.ts:414-431`, ajoutées plan 164) | uniquement le tag `typeEffectivenessOverride` du tooltip | **Doublon exact** de `TYPE_LABEL` : mêmes 18 chaînes, deux sources de vérité |
| Icônes `getTypeIconUrl` | ligne de move (`battle-chrome.ts:135`, `:210`), preview (`combat-preview-view.ts:117`, `:331`), panneau de case (`battle-views.ts:668`, `:682`), Team Builder (`app/src/team/asset-paths.ts`) | Pas de texte associé |

**Chaînes non traduites confirmées** :
- `battle-chrome.ts:132` et `:207` → `icon.alt = move.definition.type` : l'**id anglais brut** (`rock`, `flying`) part dans le nom accessible de l'icône de type.
- `move-tooltip.ts:363` → `category.alt = move.category` : `physical` / `special` / `status` bruts.

Invisible à l'œil nu, mais lu par un lecteur d'écran et affiché si l'image ne charge pas. (Recoupe l'item a11y du Lot 3, qui restera à faire pour le reste.)

Et **trois rendus visuels** pour la même notion : chip texte (`.ip-type`), icône nue, texte joint par virgules (journal de combat, immunités du panneau de case).

### Cible

1. **Source unique** : les clés i18n `pokemonType.*`. Supprimer `TYPE_LABEL` et router ses sites d'appel de `battle-views.ts` (`buildTypeChips`, `typeLabelOf` ×2) vers `context.translate("pokemonType.<id>")` — ils ont déjà un `PresentationContext`. Supprime le branchement manuel `language === "fr"`. **Le journal de combat est traité à part, voir l'encadré ci-dessous.**
2. **Composant unique** : un helper de chip de type dans `ui-dom` (icône + label liés), dérivé du `.ip-type` existant, réutilisé par l'InfoPanel et le tooltip (Volet 1.3).
3. **`alt` corrigés** : nom de type traduit sur les icônes de type (`battle-chrome.ts:132`, `:207`) ; catégorie traduite sur l'icône de catégorie (`move-tooltip.ts:363`). **Les clés `moveCategory.physical` / `.special` / `.status` n'existent pas** — à créer (FR+EN + `types.ts`) dans cette étape.
4. **Panneau de case** aligné sur la même source (il a déjà le contexte, via `battle-views.ts`).

> 🔶 **Journal de combat — sorti du périmètre après vérification, arbitrage humain demandé.** `BattleLogFormatter.ts` ne reçoit **pas** d'`I18nContext`, seulement un `language: Language`, et il embarque **six** familles de libellés FR/EN codées en dur avec le même branchement manuel : `FIELD_TERRAIN_LABELS_{FR,EN}` (ligne 62), `FIELD_GLOBAL_LABELS_*` (78), `DIRECTION_LABELS_*` (96), `ENTRY_HAZARD_LABELS_*` (114), `AURA_LABELS_*` (140), plus les types. Y migrer **uniquement** les types obligerait à threader un contexte i18n dans le formateur tout en laissant les 5 autres familles en dur — une demi-migration incohérente, pour un composant dont le vrai problème n'est pas « les types » mais « il contourne le système i18n en entier ». **Tranché (2026-08-03, humain)** : le journal garde son propre accès à la source unique (import de la table i18n plutôt que `translate`) ; sa migration i18n complète est **hors de ce plan** et reportée dans `docs/next.md` comme chantier dédié.

> **Team Builder — hors périmètre, vérifié** : il n'affiche **aucun texte** de type, seulement des icônes via sa propre fonction locale `getTypeIconUrl` (`packages/app/src/team/asset-paths.ts`), et il ne consomme pas `TYPE_LABEL`. Rien à migrer côté labels. À noter tout de même comme **3ᵉ helper d'URL d'icône** en parallèle de `UiDomConfig.getTypeIconUrl` et `PresentationContext.getTypeIconUrl` — consolidation possible, mais **pas dans ce plan** (ça toucherait l'injection de dépendances du chrome, hors sujet).

> **Garde-fou anti-régression** : test de parité vérifiant que les 18 types ont une clé i18n dans les **deux** locales, sur le modèle de `packages/app/src/styles/tokens-parity.test.ts` (plan 164). Sinon un type ajouté en Gen 2+ affichera son id brut sans que rien n'échoue. **Emplacement** : `packages/app/src/i18n/type-keys-parity.test.ts` — c'est là que vivent les locales, et `view-core` n'y a pas accès. Il lit `PokemonType` (source de vérité des ids, `packages/core`) et croise avec `locales/fr.ts` + `locales/en.ts`. Étendre au même titre aux 3 clés `moveCategory.*`.

---

## Tests

**Unit `packages/ui-dom`** — `move-tooltip` :
- tags de contrecoup aux bonnes fractions et dans la bonne forme (Métalaser en `ofMaxHp` vs Bélier en fraction des dégâts) ;
- tag de drain (Méga-Sangsue 50 %, Vampibaiser 75 %) ;
- les 3 tags d'auto-K.O. (Destruction via `isExplosion`, Souvenir via `selfKo`, Tout ou Rien via `selfKoOnConnect`) — **le tag d'Explo-Brume doit désormais s'afficher**, ce qui est le test de non-régression du code mort supprimé ;
- chip de type nommé, coût CT chiffré.

**Unit `packages/core`** — `previewMoveCtCost` : base seule sans `targetIds` ; base + Pression sur une cible porteuse ; cumul sur AoE multi-porteurs ; `0` de bonus sur move non offensif (`isOffensiveMove`) ; repli `600` sur `moveId` inconnu ; et **parité avec `computeCurrentMoveCost`** après délégation.

**Unit `packages/app`** — parité i18n : 18 clés `pokemonType.*` + 3 clés `moveCategory.*` présentes dans les deux locales (indépendant des autres étapes, peut être écrit en premier).

**e2e** (`e2e/`) : survol d'un move à contrecoup (Bélier) et d'un move à drain (Vampirisme) → tags visibles ; coût CT chiffré présent ; chip de type nommé. Config sandbox minimale, seedée.

**Cahier de recette** : nouvelle section `docs/test-plan.md` (à la suite de §4.14, plan 175) pour le tooltip enrichi, cases 🤖 pour l'observable automatisable.

## Risques

- **Volume du tooltip** : jusqu'à +6 lignes sur un composant qui en affiche déjà ~10 (tags). C'est le risque n°1 du plan — un move comme Boutefeu cumulera contrecoup + effet secondaire + type + CT. À surveiller en human-testing ; si ça déborde, la question du cap/scroll rejoint le volet responsive du Lot 3.
- **Volet 2 transverse** : touche l'InfoPanel, le panneau de case et le journal de combat (le Team Builder est hors périmètre, vérifié). Le journal a une suite de tests fournie (`BattleLogFormatter.test.ts`) qui doit rester verte — c'est le filet.
- **Migration i18n du journal de combat** : identifiée puis **sortie du périmètre** (encadré § Volet 2 / Cible) — le formateur contourne le système i18n pour 6 familles de libellés, pas seulement les types. C'était l'inconnue la plus susceptible de faire déraper l'estimation ; elle est désormais bornée, au prix d'un point d'arbitrage.
- **Suppression de clé i18n** : retirer `moveTooltip.tag.mistyExplosionSelfKo` touche `types.ts` + les 2 locales ; le typecheck est le filet (la clé est typée).

## Étapes d'exécution

Les étapes 2 et 3 sont **indépendantes du Volet 2** et peuvent passer avant si besoin ; seule l'étape 5 dépend réellement de l'étape 1.

1. **Volet 2** (fondation) : source i18n unique, suppression de `TYPE_LABEL`, helper de chip, `alt` corrigés, clés `moveCategory.*`, test de parité. ⚠️ Vérifier d'abord l'accès à `translate` dans `BattleLogFormatter` (§ Risques).
2. **Volet 1.1** — tags contrecoup / drain / auto-K.O. + suppression du code mort `fraction >= 999` (le plus autonome, zéro nouvelle API).
3. **Volet 1.4** — extraction de `buildEffectChip` en partagé, branchement des deux consommateurs.
4. **Volet 1.2** — `previewMoveCtCost` en core (+ délégation de `computeCurrentMoveCost`), `ctCost` au view-model, chiffre au tooltip, ligne CT à la preview.
5. **Volet 1.3** — chip de type au tooltip (**dépend de l'étape 1**).
6. Tests unit + e2e, `docs/test-plan.md`, human-testing, gate CI.
