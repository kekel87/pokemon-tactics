# Plan 114 — Analytics events (funnel engagement, compatible itch.io)

> Statut : **done** (Phase 1 livrée 2026-06-05 ; Phase 2 reportée)
> Créé : 2026-06-05
> Auteur : Claude

## Problème

itch sert le jeu HTML5 dans une **iframe sandboxée** (`html-classic.itch.zone`) qui bloque le `<script>` GoatCounter (`gc.zgo.at/count.js`). Vérifié 2026-06-05 : le dashboard GoatCounter (`kekel87.goatcounter.com`) ne montre **que** les visites GitHub Pages (3 visites, path `/pokemon-tactics`), **zéro** des 15 browser plays itch.

Conséquence : on ne mesure rien du **vrai public (itch)**, et surtout pas le funnel d'engagement (combien lancent un combat, le finissent).

## Objectif

Mesurer le **funnel de parcours** (où les joueurs décrochent), **sur itch ET GitHub Pages**, sans dépendre du script bloqué. Question actionnable tôt : *à quelle étape on perd les gens ?*

```
game-loaded → main-menu → battle-mode → team-builder → map-select → battle-start → battle-end
```
Exemples de signaux : `battle-start / game-loaded` = le jeu accroche ; `battle-end / battle-start` = rétention combat ; un gros drop à `team-builder` = friction de création d'équipe.

**Scope volontairement lean** (Phase 1) : juste le parcours. Les dimensions détaillées (mode, nb joueurs, difficulté…) sont **Phase 2**, reportées tant que le volume est faible (cf. section dédiée) — à ~15 plays elles seraient statistiquement illisibles.

## Solution — endpoint pixel GoatCounter (sans JS)

Méthode **documentée** par GoatCounter (`goatcounter.com/help/pixel`) : un GET sur `/count` enregistre un hit, sans le script.

```
https://kekel87.goatcounter.com/count?p=<path>&e=true&rnd=<cache-buster>
```
| Param | Rôle |
|-------|------|
| `p` | nom de l'event (ex `/itch/battle-start`) |
| `e=true` | marque comme **event** (pas pageview) |
| `rnd` | cache-buster (timestamp/aléatoire) |

Tir via `new Image().src = …` (beacon classique). Les requêtes sortantes **passent l'iframe itch** (les jeux à leaderboard le prouvent). Aucune donnée perso, RGPD-ok, conforme ToS itch (télémétrie de jeu standard).

## Distinction des plateformes

Préfixer le path par la plateforme, détectée au runtime via `location.hostname` :
- contient `itch.zone` → `/itch/...`
- contient `github.io` → `/ghp/...`
- sinon (dev/local) → **ne rien envoyer** (évite de polluer les stats).

→ Dashboard : total combiné + filtrable par plateforme.

## Design

### Découplage core (RÈGLE DURE)

Le **core ne touche jamais au réseau**. Les events naissent dans le core (`BattleEngine`), le **renderer** s'y abonne et tire le beacon.

### Helper renderer — `packages/renderer/src/analytics/analytics.ts`

```ts
// pseudo
const ENDPOINT = "https://kekel87.goatcounter.com/count";
function platformPrefix(): string | null {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return null; // dev → no-op
  if (host.includes("itch.zone")) return "itch";
  if (host.includes("github.io")) return "ghp";
  return null; // staging/tunnel inconnu → no-op (évite bruit)
}
export function trackEvent(name: string): void {
  const prefix = platformPrefix();
  if (!prefix) return; // dev/local : no-op
  const url = `${ENDPOINT}?p=/${prefix}/${name}&e=true&rnd=${Date.now()}`;
  // beacon non bloquant, échecs silencieux
  const img = new Image();
  img.src = url;
}
```
- Aucune dep ; échec réseau silencieux (jamais casser le jeu).
- No-op en dev (hostname localhost) → pas de bruit dans les stats.

### Points d'émission (Phase 1 — funnel parcours)

1 event à l'entrée de chaque scène clé (`create()`), + battle-end via event core.

| Event | Déclencheur | Où (renderer) |
|-------|-------------|---------------|
| `game-loaded` | jeu prêt, 1×/session | **fin `LoadingScene.create()` AVANT `scene.start()`**, flag module-level `gameLoadedFired` (pas de re-fire au reload langue) |
| `main-menu` | entrée menu principal | `MainMenuScene.create` |
| `battle-mode` | écran choix de mode | `BattleModeScene.create` |
| `team-builder` | écran équipe | `TeamSelectScene` / `TeamEditScene.create` |
| `map-select` | écran sélection carte | `MapSelectScene.create` |
| `battle-start` | début de combat | création `BattleScene` (1×) |
| `battle-end` | fin de combat | abonnement `BattleEventType.BattleEnded` (existe déjà) |

Chaque scène appelle `trackEvent("<name>")` dans son `create()`. Pas de flag (hors `game-loaded`) : revoir un écran = re-compte, c'est voulu (mesure le passage).

### Garder le `count.js` existant ?

Oui — laisser le plugin Vite injecter `count.js` (utile sur GitHub Pages où il marche, donne les pageviews auto). Les events pixel viennent **en plus**, ils ne se marchent pas dessus (events `e=true` vs pageviews). Sur itch, count.js ne fait rien (bloqué), seuls les events pixel remontent.

## Phase 2 — dimensions (reporté, à activer vers ~100+ plays)

Quand le volume rend les découpages lisibles, enrichir via le **path** (chaque valeur = un compteur GoatCounter), tiré à `battle-start` :

| Dimension | Paths | Source |
|-----------|-------|--------|
| Mode / nb joueurs | `/.../battle/players-2`, `players-4`… | `teamCount` / format de carte |
| Système de tour | `/.../battle/turn-ct`, `turn-round-robin` | `TurnSystemKind` |
| Difficulté IA | `/.../battle/ai-easy|medium|hard` | config IA |
| Team builder | `team-saved`, `showdown-import`, `showdown-export` | `TeamEditScene` |
| Résultat combat | `battle-end/win`, `battle-end/lose` | payload `BattleEnded` |

Non implémenté Phase 1 — juste documenté pour activation rapide le moment venu. Pas de code maintenant (éviter sur-instrumentation + data illisible à bas volume).

## Étapes (Phase 1)

1. Créer `analytics.ts` (helper `trackEvent` + détection plateforme + no-op dev + flag `game-loaded`).
2. Appeler `trackEvent` dans le `create()` de chaque scène du funnel : MainMenu, BattleMode, TeamSelect/TeamEdit, MapSelect, Battle (`battle-start`).
3. `game-loaded` (1×) au boot ; `battle-end` câblé dans **`GameController`** (où les events `BattleEngine` sont déjà routés), sur `BattleEventType.BattleEnded`. Pas dans `BattleScene.create()`.
4. **Validation locale (avant commit)** : build + servir statique sur `localhost` → DevTools Network : **aucune** requête `/count` (no-op dev confirmé), et inspecter l'URL générée (forçage temporaire) bien formée (`/itch/...&e=true`).
5. **Post-déploiement** : visual-tester sur l'URL itch réelle → confirmer que le beacon passe le CSP/sandbox itch (Network : requête `/count?...` 200/GIF). Si bloqué → fallback à étudier (peu probable).

## Risques / limites

- **CSP itch inconnu** : quasi sûr que le GET image passe (jeux réseau OK sur itch), mais **à confirmer en prod** (étape 5). Si `img-src`/`connect-src` itch bloque `goatcounter.com` → revoir (ex : beacon via `fetch` no-cors, ou accepter pas de funnel itch).
- **Pas de session/durée** : on mesure des events discrets, pas le temps passé. Suffisant pour le funnel ; la durée fine serait un autre chantier.
- **Sur-comptage** : un joueur qui relance plusieurs combats compte plusieurs `battle-start`/`end` — c'est voulu (mesure l'activité, pas les uniques).
- **Bloqueurs de pub** : certains bloquent goatcounter → léger sous-comptage. Acceptable.

## Validation finale

- [ ] `analytics.ts` : no-op en dev, path préfixé plateforme, échec silencieux.
- [ ] 3 events câblés (game-loaded 1×, battle-start, battle-end via event core).
- [ ] Core inchangé (zéro réseau, zéro dep UI ajoutée).
- [ ] Détection plateforme robuste (localhost/127.0.0.1 → null, hôte inconnu → null).
- [ ] Build OK, lint/typecheck verts.
- [ ] Post-deploy : hit `/count` visible dans GoatCounter depuis l'itch (path `/itch/...`).
