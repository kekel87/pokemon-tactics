# Plan 180 — Comportement plateforme mobile (plein écran, orientation, survie au rechargement)

- **Statut** : `done` — lots **180-a** et **180-b** livrés et validés sur téléphone réel (2026-08-14, commit WIP `118cd55`). Lot **180-c** livré à part par le [plan 181](./181-reprise-combat-en-cours.md), même jour.
- **Date** : 2026-08-06, arbitrages tranchés et vérification de fraîcheur le 2026-08-14
- **Origine** : retours sur **téléphone réel** (Android, Firefox) pendant la validation du [plan 179](./179-responsive-dette-mobile.md). Le 179 traite le **CSS/layout** ; ces retours-là sont du **comportement plateforme**, hors de son périmètre.
- **Recherche préalable** : agent `best-practices` (A→E), 2026-08-06, avec lecture du code de **PokeRogue** (référence explicite du projet). Conclusions et sources ci-dessous.
- **Comment relancer un test sur le téléphone** : `docs/references/test-sur-telephone.md` (le réseau local ne marche pas sur ce poste, la box isole les appareils Wi-Fi → tunnel obligatoire).

## Retours bruts de l'humain (2026-08-06, téléphone réel)

1. Peut-on masquer la barre d'URL de Firefox ? Un mode plein écran ?
2. Peut-on ne pas perdre l'écran courant quand l'invite « tourne ton écran » s'affiche ?
3. La rotation de l'écran n'est pas automatique.
4. Le téléphone se met en veille et ça recharge le site.

## Conclusions de recherche

### A. Plein écran / masquer la barre d'URL

- `Element.requestFullscreen()` fonctionne sur **Android Chrome ET Firefox Android**, sous geste utilisateur — appel **synchrone dans le handler**, sinon l'activation utilisateur est perdue.
- **Impossible sur iPhone** : Safari iOS n'implémente pas l'API Fullscreen (iPad seulement). Seul levier iOS = **manifeste PWA** (`display: "standalone"`/`"fullscreen"`) + « Ajouter à l'écran d'accueil » **manuel** (pas de `beforeinstallprompt` sur iOS).
- **Le projet n'a aucun manifeste PWA aujourd'hui**, ni `theme-color`, ni service worker (vérifié dans `packages/app/index.html`). Terrain vierge.
- PokeRogue expose un **toggle plein écran dans ses réglages** (via le Scale Manager de Phaser, qui encapsule la même API).
- `apple-mobile-web-app-capable` reste lu par WebKit en 2026 — redondant avec le manifeste mais gratuit.
- `theme-color` est cosmétique, ne masque rien.

**À faire** : manifeste PWA (`display`, `orientation: "landscape"`, `theme_color`, `background_color`, icônes) + `<link rel="manifest">` + `apple-touch-icon` ; **et** un bouton plein écran explicite dans le chrome (jamais d'auto-plein-écran au boot, bloqué partout). Coût : petit + petit.

### B. Verrouillage de l'orientation en paysage

- `screen.orientation.lock("landscape")` **exige un contexte plein écran actif** → vient nécessairement avec A.
- Fonctionne sur **Firefox Android**, à condition d'`await` la promesse de `requestFullscreen()` **avant** d'appeler `lock()` — sinon `SecurityError` (Bugzilla #1610745, problème de séquencement, résolu, pas un défaut de support).
- **Résout le retour n°3** : le lock tourne l'écran même quand la rotation auto est désactivée au niveau système.
- **Impossible sur iPhone** : pas d'API Screen Orientation du tout.
- PokeRogue ne fait **rien** ici (Phaser en `Scale.FIT`, letterbox) — argument pour ne pas sur-investir.

**À faire** : `try/catch`, best-effort, jamais une dépendance. L'overlay CSS d'obstruction (`packages/app/src/ui/OrientationPrompt.ts`) **reste** le filet dans tous les cas (avant plein écran, échec du lock, iPhone). Coût : petit, une fois A posé.

### C. La veille recharge la page ← le vrai sujet, et le plus gros

Trois mécanismes à ne pas confondre :

1. **bfcache** : pas le coupable (concerne la navigation retour/avant, pas l'onglet actif mis en veille).
2. **Page Lifecycle API** (`freeze`/`resume`, `document.wasDiscarded`) : **Chromium uniquement**. Firefox Android ❌, Safari iOS ❌ → **cul-de-sac pour notre cas de test**. Seuls événements universels : `visibilitychange`, `pagehide`, `pageshow`.
3. **Décharge d'onglet sous pression mémoire** : la vraie cause. C'est le tab-unloader de Firefox Android / le low-memory-killer Android. **Aucune API web ne peut l'empêcher** — décision de l'OS/navigateur.

**Screen Wake Lock API** : supportée sur Firefox Android, mais portée étroite — empêche seulement la veille **par inactivité tant que l'onglet est visible**, et **se relâche dès le passage en arrière-plan**. Ne couvre ni le verrouillage manuel, ni le changement d'app, ni la décharge mémoire.

**Ce que fait PokeRogue** (`src/system/game-data.ts`) : `saveSession()`/`saveAll()` sérialise l'état complet du run (équipe, modificateurs, état d'arène/vague) dans `localStorage` (clé `sessionData{slot}_{user}`, chiffrée), synchronisé vers leur API si connecté. Déclenché à des **points de contrôle de gameplay** (fin de vague/combat), pas par timer ni `visibilitychange`. Au rechargement, détection de la clé → proposition de reprendre.

**À faire** : distinguer *empêcher le rechargement* (fragile, API absentes sur Firefox Android) de *survivre au rechargement* (robuste, seule vraie solution).
- Wake Lock : petit gain honnête, avec ré-acquisition sur `visibilitychange`. Dire clairement ses limites à l'humain.
- **Persistance de session** : le vrai remède, **gros chantier** — sérialisation depuis le core, choix des points de contrôle (probablement aux bornes de tour, pas en pleine animation), UI de reprise. Attendre une review `core-guardian`.
- Gain intermédiaire bon marché : persister seulement **l'écran/menu courant** (le pattern existe déjà dans `packages/app/src/team/team-storage.ts` et `last-selection.ts`) — petit, mais ne couvre pas un combat en cours.

### D. « Perdre l'écran courant en tournant » — rien à corriger

- `mountOrientationPrompt` ne pose qu'un `<div>` piloté par `@media` : **aucun démontage**.
- Le chemin de resize (`ResizeObserver` sur `#game-stage` → `applyScale` → `onResize` → resize Babylon) ne fait que recalculer `--ui-scale` et le framebuffer. Opération normale et bon marché.
- Le moteur Babylon est créé **sans** `doNotHandleContextLost` → Babylon **gère déjà** `webglcontextlost`/`webglcontextrestored` et reconstruit ses ressources seul. Acquis existant, pas un trou.
- Une rotation seule ne provoque pas de perte de contexte. Les causes réelles sont la mise en arrière-plan de l'onglet (récupération de VRAM) → **c'est le même phénomène que C**.
- Le piège de la « rafale de resize » est déjà évité : `dvh` a été écarté au plan 179 §G3 au profit de `position: fixed; inset: 0`.

**À faire** : uniquement un `engine.onContextLostObservable` / `onContextRestoredObservable` avec un `console.warn` de diagnostic — pas de logique de récupération à écrire. Coût : trivial. Puis **clore** ce point et rediriger vers C.

### E. Contrôles tactiles — cadrage pour le Lot 1 (pas ici)

- PokeRogue (`src/touch-controls.ts`) : **boutons virtuels DOM superposés** au canvas (D-pad SVG + A/B/menu), et **pas** de traduction du toucher vers un curseur de scène. Écoute `touchstart/end/cancel` **et** `pointerdown/up` avec un flag anti-doublon. Répétition à 250 ms sur D-pad maintenu. `preventDoubleTapZoom()` maison (double-tap < 500 ms) **en plus** de `user-scalable=no, maximum-scale=1.0`. Aucun pinch ni pan 2 doigts (caméra fixe).
- Pour un jeu à curseur porté au doigt, le pattern qui converge est le **tap en deux temps** : 1er tap = inspecter/prévisualiser, 2e tap sur la même cible = agir.
- `touch-action: manipulation` est préférable à `user-scalable=no` (qui dégrade l'accessibilité en tuant le zoom manuel). ⚠️ **Ne pas mettre `touch-action: none` sur tout le chrome** : ça tuerait le défilement de la timeline et des listes.
- Le délai de 300 ms sur `click` est un non-sujet en 2026, mais Pointer Events reste préférable à `click` seul pour capter drag/hold.

## Limites iOS à documenter, pas à rechercher à nouveau

Vérifiées une seconde fois le **2026-08-14** (agent `best-practices`, sources datées). Verdict : **tout est confirmé**, avec deux précisions à connaître (Wake Lock et iOS 26, ci-dessous). Ne pas relancer cette recherche.

- Pas de Fullscreen API sur iPhone (iPad seulement) → pas de masquage de barre par JS. Un essai expérimental existait derrière un drapeau en Safari 17.2/17.4 beta pour les éléments non-vidéo, jamais activé par défaut, apparemment retiré depuis. Le « Partial support » affiché par caniuse correspond au plein écran natif de `<video>` (`webkitEnterFullscreen`), pas à `Element.requestFullscreen()`.
- Pas d'API Screen Orientation → aucun verrouillage d'orientation. **Et le champ `orientation` du manifeste n'est PAS honoré par WebKit, même quand la PWA est installée à l'écran d'accueil** (question explicitement posée le 2026-08-14, réponse nette : non). Sur iPad ça échoue en plus avec « Apps supporting multiple scenes (multitask) cannot lock their orientation ». → sur iPhone, l'overlay d'obstruction est le **seul** levier d'orientation, définitivement.
- Pas de `beforeinstallprompt` → installation à l'écran d'accueil forcément manuelle (Partage → Sur l'écran d'accueil). Côté Android/Chrome l'API reste fonctionnelle et recommandée en 2026, mais toujours hors du standard officiel (incubateur WICG).
- **Wake Lock : bonne nouvelle, pas une limite.** Supportée en onglet Safari depuis **iOS 16.4**, et le bug qui la cassait dans les PWA installées est **corrigé depuis iOS 18.4** (mars 2025) → elle fonctionne dans les deux contextes. Limite universelle et non spécifique à iOS : le verrou ne s'applique plus après un verrouillage **manuel** de l'écran, et il est relâché au passage en arrière-plan.
- **Nuance iOS 26 (postérieure à la rédaction initiale)** : depuis iOS/iPadOS 26, tout site ajouté à l'écran d'accueil s'ouvre **par défaut** comme une web app sans chrome navigateur, même sans manifeste (l'utilisateur peut refuser via « Open as Web App »). L'affirmation « aucun levier sans manifeste » de la §A est donc à nuancer : sur iOS 26+, le plein écran s'obtient par l'installation manuelle seule. L'apport du manifeste devient qualitatif (icônes propres, nom, `theme_color`, splash, et `display: standalone` requis pour un futur Web Push/badging) plutôt que fonctionnel.
- `apple-mobile-web-app-capable` : la doc web.dev actuelle ne le recommande **plus** comme substitut au manifeste (il peut dégrader l'expérience d'installation si le manifeste échoue à charger). Conclusion révisée par rapport à la §A : **ne pas l'ajouter**, le manifeste suffit.

## Arbitrages tranchés (2026-08-14)

Quatre décisions prises par l'humain avant l'implémentation de 180-a/180-b :

| Sujet | Décision | Raison |
|---|---|---|
| **Icônes du manifeste** | Agrandissement **nearest-neighbor** du `favicon.png` existant (Pokéball pixel-art 28×28) vers 192/512 + `apple-touch-icon` 180. Padding centré sur `#1a1a2e` opaque pour atteindre les tailles non multiples de 28. | Rendu net cohérent avec le pixel-art du jeu, aucun asset à créer ni à sourcer. Le dépôt ne contient **aucun** logo ni artwork exploitable, et le favicon 28×28 ne peut pas être upscalé autrement sans bouillie. Padding **opaque** car iOS ne gère pas les icônes *maskable* et remplace la transparence par du noir. |
| **Bouton plein écran** | Une ligne **« Plein écran »** dans l'écran de réglages, à côté de Langue et Prévisualisation dégâts. | Le pattern `row(label, bascule)` y existe déjà, c'est le choix de PokeRogue, et l'écran est joignable à tout moment. Évite d'alourdir un chrome de combat déjà dense sur téléphone. La ligne est **masquée** quand l'API n'est pas disponible (iPhone) plutôt que présentée inerte. |
| **Reprise d'écran (180-b)** | Reprise **silencieuse**, **combat exclu** → retour au menu principal si la session a été perdue en combat. | Aucune UI à concevoir, aucune friction à chaque sortie de veille. Restaurer un combat exige de sérialiser l'état du moteur : c'est précisément 180-c. |
| **Consigne d'installation iOS** | Une ligne **« Installer l'application »** dans les réglages, visible **seulement** sur iPhone et **masquée si déjà installé**. | Découvrable sans jamais interrompre l'entrée en jeu. D'autant moins urgent qu'iOS 26 ouvre déjà en web app par défaut à l'installation. |

## Étapes — Lot 180-a (manifeste, plein écran, orientation, diagnostic WebGL)

### Icônes et manifeste

- [x] Icônes par agrandissement nearest-neighbor du favicon (agent `asset-manager`) : `packages/app/public/{icon-192.png,icon-512.png,apple-touch-icon.png}`.
- [x] Créer `packages/app/public/manifest.json` : `name`, `short_name`, `display: "standalone"`, `orientation: "landscape"`, `theme_color`, `background_color`, `start_url`, `scope`, les 2 icônes.
  - `orientation: "landscape"` est posé pour Android (honoré en PWA installée) en sachant qu'iOS l'ignore — coût nul, gain réel côté Android.
- [x] `packages/app/index.html` : `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`. **Pas** d'`apple-mobile-web-app-capable` (voir Limites iOS).

### Plein écran + verrouillage d'orientation

- [x] Nouveau `packages/app/src/platform/pwa.ts` : `isStandalone()` (teste **les deux** `display-mode: standalone` et `navigator.standalone`, le premier seul étant peu fiable en mode plein écran), `isIosLike()`.
- [x] Nouveau `packages/app/src/platform/fullscreen.ts` : `isFullscreenSupported()`, `isFullscreen()`, `toggleFullscreen()`, `onFullscreenChange()`.
  - `requestFullscreen()` appelé **synchroniquement** dans le gestionnaire de clic (sinon l'activation utilisateur est perdue), puis `await` de sa promesse **avant** `screen.orientation.lock("landscape")` — l'inverse jette un `SecurityError` sur Firefox Android.
  - Le verrouillage est **best-effort** en `try/catch` : jamais une dépendance, jamais une erreur remontée à l'utilisateur.
- [x] `settings-screen.ts` : ligne « Plein écran » (masquée si non supporté) + ligne « Installer l'application » (iPhone non installé seulement).
  - L'état de la bascule est lu depuis `document.fullscreenElement`, **pas** persisté dans `pt-settings` : le plein écran exige un geste utilisateur, il ne peut pas être restauré au boot. C'est un état vivant, pas une préférence.

### Diagnostic de perte de contexte WebGL

- [x] `combat-scene.ts` : `engine.onContextLostObservable` / `onContextRestoredObservable` → un avertissement console. **Aucune** logique de récupération à écrire (Babylon reconstruit déjà seul, cf. §D).

## Étapes — Lot 180-b (Wake Lock, persistance d'écran)

- [x] Nouveau `packages/app/src/platform/wake-lock.ts` : acquisition best-effort, **ré-acquisition sur `visibilitychange`** (le verrou est relâché par le navigateur en arrière-plan et ne revient pas de lui-même), relâchement idempotent.
- [x] Nouveau `packages/app/src/app/screen-persistence.ts` : écrit/lit l'`ScreenId` courant dans `localStorage`.
  - **Seuls les écrans sans paramètre sont persistés** (`main-menu`, `battle-mode`, `map-select`, `my-teams`, `settings`, `credits`). `team-select` exige un `mapUrl`, `team-edit` un `teamId`, `combat` un `setup` : les restaurer sans leurs paramètres est impossible → repli sur `main-menu`. Garde-fou typé, pas seulement une convention.
  - Péremption au-delà d'une heure : reprendre un écran de menu le lendemain n'a pas de sens.
- [x] `screen-manager.ts` : enregistrer l'écran après un montage réussi (point unique, `transitionTo`).
- [x] `babylon-boot.ts` : acquérir le Wake Lock ; au boot du menu, démarrer sur l'écran persisté s'il est valide. **Ne s'applique pas** aux routes sandbox/`?combat=` (entrées de dev explicites, elles doivent rester déterministes).

**Livré et validé sur téléphone réel le 2026-08-14** (commit WIP `118cd55`). Bug attrapé en revue avant publication : les URLs du manifeste étaient absolues, cassant l'installabilité en silence sur GitHub Pages/itch.io — corrigé en relatif (décision #739). Décisions #738–#743, détail `docs/decisions.md`. Dettes/suites non résolues → `docs/next.md`.

## Ce que ces 2 lots ne résolvent PAS

À dire clairement à l'humain au moment du test, pour éviter une attente déçue :

- ~~**Un combat en cours reste perdu** au rechargement. C'est 180-c, et c'est le seul vrai remède au retour n°4.~~ **Résolu le 2026-08-14 par le [plan 181](./181-reprise-combat-en-cours.md)** : le combat est persisté sous forme de journal d'actions et repris depuis une entrée « Reprendre le combat » au menu principal.
- Le Wake Lock **n'empêche pas** la décharge de l'onglet sous pression mémoire (aucune API web ne le peut), ni la veille après un verrouillage manuel de l'écran.
- Sur **iPhone**, aucun verrouillage d'orientation n'est possible, ni par API ni par manifeste.

## Découpage proposé

| Lot | Contenu | Coût |
|---|---|---|
| **180-a** | Manifeste PWA + bouton plein écran + verrouillage paysage enchaîné + diagnostic de perte de contexte WebGL | petit |
| **180-b** | Wake Lock (avec ré-acquisition sur `visibilitychange`) + persistance de l'écran/menu courant | petit |
| **180-c** | Persistance et reprise d'un **combat en cours** | livré par le [plan 181](./181-reprise-combat-en-cours.md) (2026-08-14) — finalement **moyen**, pas gros : l'infra de rejeu (`BattleReplay` + `runReplay`) existait déjà, donc aucun sérialiseur d'état à écrire |

## Sources

Plein écran : [web.dev](https://web.dev/articles/fullscreen) · [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) · [PWA iOS 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [Web Apps in iOS 26](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/)
Orientation : [spec W3C](https://w3c.github.io/screen-orientation/) · [MDN lock()](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) · [Bugzilla #1610745](https://bugzilla.mozilla.org/show_bug.cgi?id=1610745)
Cycle de vie / veille : [caniuse wasDiscarded](https://caniuse.com/mdn-api_document_wasdiscarded) · [Firefox Tab Unloading](https://firefox-source-docs.mozilla.org/browser/tabunloader/) · [Bugzilla #1752594](https://bugzilla.mozilla.org/show_bug.cgi?id=1752594) · [MDN Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · [web.dev Wake Lock](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers)
WebGL : [Babylon Engine](https://doc.babylonjs.com/typedoc/classes/BABYLON.Engine) · [Khronos HandlingContextLost](https://wikis.khronos.org/webgl/HandlingContextLost)
Tactile : [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) · [Chrome 300ms tap delay](https://developer.chrome.com/blog/300ms-tap-delay-gone-away)
PokeRogue : [touch-controls.ts](https://github.com/pagefaultgames/pokerogue/blob/main/src/touch-controls.ts) · [game-data.ts](https://github.com/pagefaultgames/pokerogue/blob/main/src/system/game-data.ts) · [index.html](https://github.com/pagefaultgames/pokerogue/blob/main/index.html) · [wiki Settings](https://wiki.pokerogue.net/gameplay:settings)
