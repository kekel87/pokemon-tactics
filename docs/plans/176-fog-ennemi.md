# Plan 176 — Fog ennemi (rétention d'information sur les Pokemon adverses)

> **Statut** : done (2026-08-05)
> **Créé** : 2026-08-05
> **Phase** : 6.5 « Client jouable », Lot 3 (compléter l'UI). Suite des plans 174 (InfoPanel allié), 175 (preview de combat), 177 (panneau de case), 178 (tooltip + types).
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` — item Lot 3 « **Panneau ennemi + fog** ».

## Motivation

Le panneau d'un Pokemon **ennemi** affiche aujourd'hui des informations qu'un adversaire ne devrait pas connaître :

- **PV exacts** : `142 / 180 (79%)` — le total de PV max est un fait caché en Pokemon (le canon n'affiche jamais de chiffre adverse).
- **Objet tenu** : icône officielle + nom FR, **toujours visibles** depuis le plan 168. C'est le gap explicitement noté au plan 168 et repris en backlog infra (« masquer l'objet ennemi en multi »).
- **PV du Substitut** : badge « Substitut (45 PV) ».

Le talent est déjà retenu (plan 174 : seul un allié affiche son talent ; côté ennemi il n'apparaît que si `revealedAbility` a été posé par Fouille / Prédiction / Anticipation, plan 163), et le plan 175 a posé le **premier morceau de fog** : le prédicat de visibilité de `combat-preview-view.ts` ne nomme Fermeté (immunité K.O.-en-un-coup, garde-fou « sauf Fermeté ») que si le talent est connu du joueur. Ce plan généralise ce principe au reste du panneau et le rend **activable/désactivable en sandbox**.

## Décisions de cadrage (humain, 2026-08-05)

### 1. Fog côté vue, pas dans `getGameState`

Le cadre 173 évoquait une « perspective `getGameState` ». `BattleEngine.getGameState(_playerId)` est aujourd'hui un **passthrough** : il ignore son argument et rend l'état complet par référence. Le transformer en état filtré/cloné par joueur est un chantier de fond (clonage profond ou proxy de lecture, impact sur l'IA, le replay, les 3600+ tests) qui n'a de valeur qu'avec un **serveur autoritaire** : en local, le client détient l'état de toute façon.

→ Le fog est appliqué dans les **adaptateurs de vue** (`packages/view-core`), là où l'information devient visible. La redaction côté core est renvoyée à la **Phase 7 (multijoueur)**, avec le backend.

**Conséquence assumée** : le journal de combat (« Florizarre perd 42 PV ! ») et les dégâts flottants (`-42`) gardent leurs chiffres absolus. Le fog est donc une **rétention d'affichage**, pas un secret : un joueur motivé peut reconstituer les PV max en additionnant. Hors périmètre — masquer ces deux canaux dégraderait la lisibilité du combat pour un gain nul en local.

### 2. Périmètre exact

| Information ennemie | Sous fog | Justification |
|---|---|---|
| **PV** | `79 %` seul (plus de `142 / 180`) | Demande explicite de l'humain. La barre de vie reste inchangée (elle n'exprime qu'un ratio). |
| **Objet tenu** | **`???` + icône générique** tant qu'il est inconnu | Résout le gap du plan 168 + l'item backlog. Un slot vide aurait fuité « ne tient rien », qui est une information aussi — donc le placeholder est posé **même sur un Pokemon sans objet**. |
| **Talent** | **`???`** tant qu'il est inconnu | Le talent passe du badge de révélation à son **slot normal** (à droite de la ligne de PV, comme un allié), rempli dès qu'il devient connu. |
| **PV du Substitut** | badge « Clone » nu | Même raison que les PV. |
| **Dégâts de la preview (plan 175)** | `23–28 %` au lieu de `42–50 PV` | Afficher les PV absolus **à côté** du « → 51–56 % PV » restant laisse déduire les PV max en une soustraction : le fog serait décoratif. |
| **Ceinture Force** dans le garde-fou « sauf … » | nommée seulement si l'objet est connu | Même règle que Fermeté (plan 175) : ne nommer que ce que le joueur voit déjà. |
| Crans de stats, statuts, volatiles, auras | **visibles** | Ces changements sont annoncés au journal **et** en texte flottant au moment où ils arrivent : les cacher au panneau serait incohérent, pas discret. |
| Nom, niveau, genre, types | **visibles** | Publics (décision plan 174 pour les types). |
| Stats chiffrées | absentes (inchangé) | Le bloc de stats reste réservé aux panneaux en lecture complète. |

### 2 bis. Révélation à l'usage (extension actée en human-testing, 2026-08-05)

Les `revealed*` n'étaient posés que par le scouting du plan 163 (Fouille / Prédiction / Anticipation). Sous fog, ça produisait une aberration : un objet ou un talent qui **agit sous les yeux du joueur** (les Restes qui soignent en fin de tour, Intimidation à l'entrée, Statik qui paralyse) est nommé au journal, mais le panneau continuait de l'afficher `???`. Le fog devenait une amnésie imposée, pas une information cachée.

→ Nouveau module core pur `packages/core/src/battle/reveal-tracking.ts` (`applyRevealsFromEvents(state, events)`) : tout event qui **nomme** un objet ou un talent pose le flag correspondant.

- objet : `HeldItemActivated`, `HeldItemConsumed`, `ItemBurned`, `ItemFlung`, `ItemRecycled`, `ItemKnockedOff`, `BerryEaten` (mangeur), `ItemStolen` (voleur **et** victime), `ItemsSwapped` (les deux) ;
- talent : `AbilityActivated` ;
- exclu : `ItemMoveFailed` (aucun objet nommé, rien n'a été montré).

**Deux points de branchement seulement**, pour ne pas semer le marquage : `submitAction` devient un wrapper mince autour d'un `applyAction` privé (le chemin de résolution a 17 sorties `success: true` — les marquer une par une aurait été une invitation à en oublier une), et `consumeStartupEvents` (talents d'entrée). Le reset au K.O. existait déjà.

**Conséquence sur les badges** : les badges de révélation « Objet : X » et « Talent : X » sont **supprimés** (redondants avec leurs slots, qui n'apparaissent qu'une fois l'info connue) ; clés i18n `infoPanel.reveal.item` / `infoPanel.reveal.ability` purgées. Le badge **« Menace : X »** de Prédiction reste : rien dans le panneau ne liste les attaques d'un ennemi.

### 3. Défauts

- **Jeu normal** : fog **ON**, en dur. Pas de réglage joueur (choix humain : c'est une règle de jeu, comme le canon — pas un confort désactivable qu'un joueur en ligne pourrait couper).
- **Sandbox** : fog **OFF** par défaut (studio de debug : on veut les PV exacts), avec une case à cocher pour l'activer.
- **Fog OFF ⇒ lecture complète** (décision humaine 2026-08-05) : un ennemi se lit alors **exactement comme le Pokemon actif** — PV exacts, bloc de stats, talent, objet réel. Couper le fog sert précisément à tout inspecter. Corollaire : ses crans de stats passent inline dans le bloc au lieu de rester des badges, comme pour un allié. Assouplit la règle « ennemi minimal » du plan 174, qui ne vaut plus que **sous** fog (donc toujours, en partie réelle).

## Implémentation

### A. Contrat de présentation

`packages/render-ports/src/presentation-context.ts` — nouvelle méthode, miroir de `isDamagePreviewEnabled()` :

```ts
/**
 * Whether enemy information is withheld (plan 176): exact HP, unrevealed held item, Substitute HP.
 * Hard-on in a real battle; the sandbox studio can switch it off to inspect exact figures.
 */
isEnemyInfoHidden(): boolean;
```

`packages/render-ports/src/view-models.ts` — `InfoPanelData` gagne :

```ts
/** Fog (plan 176): print the HP percentage alone, never the `current / max` figures. */
readonly hideExactHp?: boolean;
```

`InfoPanelPreview` (déjà existant) gagne :

```ts
/** Fog (plan 176): damage bounds are expressed in % of max HP rather than absolute HP. */
```
— pas de champ neuf : la conversion est faite par l'adaptateur, seul `damageValue`/`damageUnitLabel` (déjà des chaînes prêtes à afficher) changent.

### B. Adaptateur InfoPanel (`packages/view-core/src/battle-views.ts`)

Dans `buildInfoPanelView`, deux prédicats :

```ts
const fogged = !isAlly && context.isEnemyInfoHidden();
const enriched = isAlly || !fogged; // lecture complète : stats + talent + objet réel
```

1. **PV** : `...(fogged ? { hideExactHp: true } : {})`.
2. **Objet tenu** : connu si `!fogged || pokemon.revealedItem === true` → nom + icône officielle ; sinon `heldItem: "???"` + `itemUnknown: true` (posé **même sans objet**).
3. **Talent** : `enriched || pokemon.revealedAbility === true` → `effectiveAbilityId` ; sinon `ability: "???"` + `abilityUnknown: true` (uniquement sous fog).
4. **Stats** + dédoublonnage des crans (`inlineStats`) : pilotés par `enriched`, plus par `isAlly`.
5. **Substitut** : badge sans le chiffre quand `fogged` → nouvelle clé i18n `infoPanel.volatile.substituteHidden`.
6. Placeholder : nouvelle clé `infoPanel.unknown` = `???`.

### C. Panneau DOM (`packages/ui-dom/src/info-panel.ts` + `styles/info-panel.css`)

`update()` : quand `data.hideExactHp` est vrai,
- `hpNumbers` vide, `hpPct` porte le pourcentage **sans parenthèses** (`79 %` — les parenthèses n'ont plus de nombre à qualifier), et `data-hp-only` le fait hériter de la taille/couleur primaires : c'est devenu **le** chiffre, plus un aparté ;
- l'ARIA suit ce qui est visible : `aria-valuemax="100"`, `aria-valuenow=<pct>`. Sinon on annoncerait aux lecteurs d'écran l'information qu'on masque à l'écran.

Placeholders (`itemUnknown` / `abilityUnknown`) : `data-unknown="1"` sur la ligne d'objet et sur le talent → texte grisé/espacé, et un `.ip-item-glyph` (carré pointillé + `?`, dessiné en CSS, **aucun asset requis**) remplace l'icône officielle. Même encombrement que la vraie icône, pour que la ligne ne saute pas au moment de la révélation.

⚠️ Le helper e2e `readHp` (`e2e/pages/combat-queries.ts`) lit `aria-valuenow`. Les fixtures e2e tournent en sandbox, fog **OFF** par défaut → aucune suite existante n'est touchée. Le spec de ce plan lit le texte, pas l'ARIA, quand il vérifie le fog.

### D. Preview de combat (`packages/view-core/src/combat-preview-view.ts`)

`buildCombatPreviewView` : `const fogged = !isAlly && context.isEnemyInfoHidden();`

- `damageValue` : `${hpPercent(min, maxHp)}–${hpPercent(max, maxHp)}` si `fogged`, sinon `${min}–${max}`.
- `damageUnitLabel` : nouvelle clé `combatPreview.damageUnitPercent` (`%`) si `fogged`, sinon `combatPreview.damageUnit` (`PV`).
- Les overlays fantômes de la barre de vie (`preview.damage`) restent en PV absolus : ce sont des **ratios** à l'arrivée (`min / hpMax`), rien n'est affiché.
- Le commentaire de `isGuardKnownToPlayer` (« l'objet est public aujourd'hui — le fog arrive au plan 176 ») est mis à jour : sous fog, **Ceinture Force ne peut plus être nommée** dans le garde-fou « sauf … » si l'objet n'est pas révélé. Cohérence avec Fermeté (plan 175) : le garde-fou ne nomme que ce que le joueur voit déjà.

### E. Câblage app (`packages/app/src/babylon/combat-screen.ts`)

`runBattle(options)` gagne `enemyInfoHidden: boolean` ; le `presentationContext` expose `isEnemyInfoHidden: () => enemyInfoHidden`.

- chemin `startBattleLoop` (jeu réel) → `true` ;
- chemin `startSandboxBattle` → `config.fogOfWar === true`.

Le sandbox **remonte** la scène à chaque changement de config (`remount(config)`), donc la case à cocher est prise en compte sans traitement particulier.

### F. Sandbox

- `packages/view-core/src/sandbox-config.ts` : `SandboxConfig.fogOfWar?: boolean` (absent → `false`), propagé par `normalizeSandboxConfig` (v2 et legacy).
- `packages/app/src/ui/SandboxPanel.ts` : case à cocher « Fog ennemi » dans la bande de combat, à côté des contrôles RNG (`createLabeledCheckbox`), reportée dans `emit()`.

### H. Révélation à l'usage (core)

- `packages/core/src/battle/reveal-tracking.ts` : `applyRevealsFromEvents(state, events)` (module pur, aucune dépendance moteur).
- `BattleEngine.submitAction` → wrapper autour du nouveau `applyAction` privé ; `consumeStartupEvents` → même appel.

### G. Tests

- **unit** `battle-views.test.ts` : fog ON → `hideExactHp`, objet `???` (avec **et sans** objet réel), talent `???`, badge Substitut nu, pas de bloc de stats ; fog ON + `revealedItem` / `revealedAbility` → valeurs réelles, sans badge ; allié jamais foggé ; fog OFF → lecture complète (stats + talent) ; crans en badge uniquement sur un panneau sans bloc de stats.
- **unit** `combat-preview-view.test.ts` : dégâts en `%` + unité `%` sous fog sur cible ennemie ; PV absolus sur allié et fog OFF ; Ceinture Force non nommée sous fog sans révélation.
- **unit** `reveal-tracking.test.ts` : chaque famille d'event révélatrice (objet activé/consommé/brûlé/dégommé/recyclé/dégagé, baie mangée, vol et échange → les deux camps, talent activé), non-révélation sur `ItemMoveFailed`, event pointant un id absent = pas de crash.
- **unit** `sandbox-config.test.ts` : `fogOfWar` porté / défauté.
- **e2e** `combat-fog.spec.ts` : sandbox `fogOfWar: true` → panneau ennemi en `%` sans `/`, `???` sur objet et talent, puis objet révélé après déclenchement des Restes ; `fogOfWar` absent → lecture complète. Section `docs/test-plan.md` §4.15.
- **e2e à réviser** : `info-panel.spec.ts` §4.7 « ennemi minimal (stats + talent masqués) » teste le sandbox **sans** fog → l'attente s'inverse (lecture complète). Le cas « masqué » se reteste avec `fogOfWar: true`.

## Limites connues (audit `game-designer`, 2026-08-05)

1. **Les multiplicateurs silencieux ne se révèlent jamais.** La règle est « révélé si nommé », et un effet purement multiplicatif n'émet aucun event : Bandeau / Mouchoir / Spécs Choix (seul le verrou de move est un signal indirect), Ceinture Pro, objets type-boost, Éviolite, Technicien, Poing de Fer, Voile Sable. À l'inverse, Brasier / Torrent / Engrais et Robustesse **sont** couverts (leur hook émet `AbilityActivated` au premier déclenchement). Hiérarchie non intentionnelle mais assumée : les gros multiplicateurs continus restent scoutables uniquement par Fouille / Anticipation.
2. **Aucun faux positif** — vérifié : chaque event qui déclenche une révélation produit aussi un texte flottant nommant l'objet ou le talent (`floating-text-content.ts`). Le slot ne se débloque jamais sans que le nom ait été montré à l'écran.
3. **L'IA n'est pas soumise au fog** — `getGameState` étant un passthrough, elle lit PV exacts, objet et talent réels. Asymétrie structurelle assumée : la fogger exigerait un état de croyance par contrôleur et un scoring sous incertitude (même chantier que `getGameState` par perspective, Phase 7), et une IA piégée « comme un humain » risque d'être perçue comme moins compétente plutôt que plus juste. À documenter dans `docs/decisions.md`, à revisiter en Phase 7.
4. **Le verdict « K.O. » peut mentir** quand Ceinture Force ou Fermeté est présent mais non révélé (le « sauf … » est gaté sur la connaissance, décision plan 175). Voulu — c'est le bluff canon du Focus Sash, et le contre existe : scouter avant d'engager.

**Non-constat** : l'audit a signalé les talents de scouting comme « portés par personne ». Vérifié — faux : `getPokemonAbilities` (`team-builder-catalog.ts`) expose primaire + secondaire + caché, et le Team Builder propage le talent choisi en combat. Fouille (Grodoudou), Prédiction (Soporifik / Hypnomade / Lippoutou), Anticipation (Évoli) sont équipables. Seul leur **défaut** de roster reste `ability1`, ce qui est le canon.

## Hors périmètre

- Redaction côté core (`getGameState` par perspective) → **Phase 7 / backend**.
- Journal de combat et dégâts flottants (chiffres absolus conservés, cf. décision 1).
- Liste des moves connus de l'ennemi (aucune UI ne montre le moveset adverse aujourd'hui ; `revealedTopMove` de Prédiction reste un badge). Chantier additif, à ouvrir si le besoin apparaît.
- Réglage joueur dans l'écran Réglages (écarté : règle de jeu dure).
- Icône d'objet inconnu en pixel-art : le placeholder est dessiné en CSS. À revoir avec le « point icônes » déjà noté au plan 177 (piste game-icons.net) si un pack cohérent arrive.
