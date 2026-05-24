# Plan 096 — Visibilité passive itch.io + GitHub topics

> Statut : **done**
> Créé : 2026-05-22
> Validé : 2026-05-23 (humain + best-practices agent)
> Livré : 2026-05-23 (release v2026.5.2 deploy itch CI run `26342405217` OK)
> Auteur : Claude

## Objectif

Donner de la visibilité au projet sans effort récurrent ni interaction sociale. Quatre axes set-and-forget :

1. **Déploiement auto itch.io** via GitHub Action (build web → push butler) déclenché sur publish release GitHub.
2. **Game page design** itch.io (cover, screenshots, banner, description) — setup une fois, jamais retoucher. Lien fixe vers GitHub Releases pour changelog (pattern Mindustry).
3. **Skill `/itch-feedback`** pour review automatique des commentaires sans s'y connecter.
4. **GitHub topics** affinés pour SEO niche correct (vire `roguelike`, ajoute tactical-rpg/turn-based).

But : itch.io = vitrine publique jouable, GitHub topics = discovery passive dev, skill = boucle feedback indolore.

## Pourquoi maintenant

- Build renderer stable (Vite, `pnpm --filter @pokemon-tactic/renderer build`).
- Wiki + changelog déjà auto-générés (`publisher`, `wiki-keeper`).
- GoatCounter analytics déjà branché — manque la vitrine elle-même.
- Humain veut zéro effort de comm, set-and-forget total.

## Hors scope

- Réseaux sociaux (Bluesky/Mastodon bot) — reporté plan séparé si demande.
- Reddit/HN/Discord — pas auto, humain décide post-par-post si jamais.
- Trailer vidéo cinematic / page de presse / kit promo — hors scope (page itch suffisante).
- Build desktop Electron/Tauri — hors scope, html5 only.

## Compatibilité technique itch.io (audit pré-impl)

État actuel build `packages/renderer/dist/` :

| Métrique | Valeur actuelle | Limite itch.io HTML5 | Statut |
|----------|-----------------|----------------------|--------|
| Taille totale extraite | 30 Mo | 500 Mo | ✅ OK |
| Nombre de fichiers | 590 | 1 000 | ⚠️ 59 % budget consommé |
| Plus gros fichier | < 5 Mo (estimé) | 200 Mo | ✅ OK |
| Longueur path max | < 100 chars | 240 chars | ✅ OK |
| Encodage filenames | UTF-8 | UTF-8 | ✅ OK |

**Source** : [itch.io HTML5 docs](https://itch.io/docs/creators/html5).

**Risque** : 502 sprites PNG dans `public/assets/sprites/`. Chaque Pokemon ajouté = ~4 fichiers (idle, walk, attack, hop). Marge ~100 Pokemon avant butée 1 000 files. Mitigation future : sprite atlas (texture packing Phaser) — pas urgent maintenant, à noter pour Phase 9+.

**Vérifications à faire Étape 2** :
- `base: './'` dans `packages/renderer/vite.config.ts` requis pour itch (jeu servi depuis sous-domaine `*.itch.zone`, paths relatifs obligatoires).
- Test local : `pnpm --filter @pokemon-tactic/renderer build && cd packages/renderer/dist && python3 -m http.server` → ouvrir `localhost:8000` et vérifier que le jeu charge sans 404.

## Risque légal — propriété intellectuelle Pokemon

**Risque réel mais pas certain.** Stratégie : visibilité limitée + pas de logo officiel + URL discrète.

### Contexte enforcement Nintendo / The Pokémon Company

- Nintendo cible **régulièrement** fan-games Pokemon : mass DMCA 2021 (379 jeux retirés), Relic Castle fermé mars 2024, Palworld mod janv 2024.
- Cibles prioritaires : projets **visibles** (médias presse, viral), **monétisés** (Patreon/dons), utilisant **assets directement rippés** (sprites Game Freak, ROMs).
- Cibles tolérées en pratique : projets de niche, code open-source sans assets, fan-art individuel, projets non monétisés à faible visibilité.
- Précédents survivants : **PokeRogue** (poke-rogue.net, browser game, énorme audience, toujours en ligne 2026), Pokemon MMO 3D, Pixelmon (Minecraft mod toléré ~10 ans), Pokemon Showdown (toujours debout). Aucune garantie pérenne.

### Analyse risque ce projet

| Facteur | Notre projet | Risque |
|---------|-------------|--------|
| Marque "Pokemon" dans nom | Oui (`pokemon-tactics`) | ⚠️ Moyen |
| Logo Pokemon/Game Freak | Non utilisé | ✅ OK |
| Sprites officiels rippés | Oui (502 PNGs, source Showdown/PokeAPI probable) | ❌ Risque élevé |
| Audio Pokemon officiel | Non (pas de musique/SFX Game Freak) | ✅ OK |
| Monétisation | Non, projet personnel | ✅ OK |
| Visibilité actuelle | Faible (GitHub privé/peu connu) | ✅ OK |

**Verdict** : risque non nul mais gérable tant que projet reste niche, non monétisé, sans presse virale. Sprites rippés = principal vecteur DMCA. itch.io traite DMCA par takedown rapide sans préavis (cf. incident Funko déc 2024 — site entier descendu sur signalement IA bogus). Récupération possible mais perte temporaire.

### Décisions IP (actées 2026-05-23)

1. **Titre page itch.io** : `Pokemon Tactics` (humain assume risque, parité GitHub repo, identité claire).
2. **Description page itch** : réutilise les disclaimers existants de `README.md` (sections "Disclaimers" + "License" + crédits sources). Copier-coller direct, pas reformuler. Inclut explicitement :
   - "non-commercial fan game"
   - "Pokemon and all related properties are trademarks of Nintendo, Game Freak and The Pokemon Company"
   - "not affiliated with, endorsed, or sponsored"
   - "If rights holders request removal, it will be taken down immediately"
   - Crédits sprites PMDCollab CC BY-NC 4.0 + PokeSprite MIT
3. **Zéro monétisation** définitif : pas de dons, pas de tip jar, pas de Patreon lié, pas de "Suggested price". Pricing itch = `No payments`.
4. **Sprites** : risque structurel accepté. Plan B documenté (sprites originaux = gros chantier reporté `docs/backlog.md`).
5. **Repo GitHub** : reste `pokemon-tactics`. Sprites déjà sous CC BY-NC 4.0 (PMDCollab) — vérifier audit Étape 2 que distribution sprites dans build itch respecte clause non-commercial (OK puisque jeu free).
6. **Aucun post manuel** : humain ne poste pas sur réseaux sociaux / forums / Reddit / presse. Visibilité 100 % passive (page itch.io découvrable via search + tags itch + GitHub topics). Si tiers relaie ailleurs : pas notre action, pas notre responsabilité.
7. **Si projet décolle** : profil bas obligatoire. Pas d'interview presse, pas de Kickstarter (même non-Pokemon spinoff), pas de communication "creator" personnelle.


## Décisions actées

1. **Outil deploy = `butler`** (CLI officiel itch.io) via action `Ayowel/butler-to-itch@v1.3.0` (JS pure, pas Docker, init 17s vs 43s, support glob, maintenue 2026). **Pas** `KikimoraGames/itch-publish` (mort 2021) ni `manleydev` (abandonné 2022). Alt acceptable : `yeslayla/butler-publish-itchio-action` (141 ⭐, mars 2026). Choix actuel : `Ayowel/butler-to-itch`.
2. **Trigger workflow** : `on: release: types: [released]` — colle avec le pipeline `release-drafter` existant (humain publish draft → deploy auto). + `workflow_dispatch` manuel. **Pas** sur push `main` (spam build storage itch).
3. **Channel itch** = `html5` (build web Phaser jouable navigateur). Pas de build desktop (Electron) pour l'instant.
4. **Output dir** = `packages/renderer/dist/`. Vérifier `base: './'` dans `packages/renderer/vite.config.ts` — **obligatoire** pour itch (cause #1 des "marche en local pas sur itch", paths absolus = 404). À vérifier Étape 2.
5. **Devlog itch = pas d'automation possible.** API publique itch read-only (pas d'endpoint POST devlog, feature request 2022 sans suite). Pattern Mindustry : description itch contient lien fixe `https://github.com/kekel87/pokemon-tactics/releases`. Sidebar "Development log" itch reste vide ou posts manuels ponctuels milestone. Skill `/itch-devlog` initialement prévu → **drop**, pas de besoin si lien GitHub suffit.
6. **Skill `/itch-feedback`** : scrape page jeu HTML (pas d'API commentaires itch publique). Fragile mais fonctionnel. Délègue triage à agent `feedback-triager`.
7. **Topics GitHub** : remplacer set actuel par : `pokemon`, `tactics-game`, `tactical-rpg`, `turn-based-strategy`, `phaser`, `typescript`, `browser-game`, `html5-game`, `fan-game`, `monorepo`, `pnpm`. Virer `roguelike` (faux, pas de procgen runs).
8. **Service workers : ne pas enregistrer.** Scope SW = origine itch.io, peut casser d'autres jeux user. Vite PWA plugin off (déjà off par défaut chez nous, confirmer).

## Étapes

### Étape 1 — Création + design page itch.io (humain, prérequis manuel)

**Bloquant** : impossible automatiser, demande compte itch + assets visuels.

#### 1.1 — Créer la page (vide, draft)

1. https://itch.io/game/new
   - Title : `Pokemon Tactics` (acté)
   - Project URL : `pokemon-tactics`
   - Kind of project : `HTML`
   - Classification : `Games > Strategy` (sous-catégorie `Tactical`)
   - Visibility : `Draft` jusqu'à fin setup
   - Pricing : `No payments` (acté, pas de dons)
2. Générer API key : https://itch.io/user/settings/api-keys
3. Ajouter secret GitHub `BUTLER_API_KEY` (Settings → Secrets → Actions)

#### 1.2 — Design page (assets visuels + texte)

Specs officielles ([itch.io design docs](https://itch.io/docs/creators/design)) :

| Asset | Dimensions | Format | Notes |
|-------|-----------|--------|-------|
| **Cover image** | 630×500 (ratio 315:250) | PNG/JPG, < 3 Mo | Affiché en miniature listings itch + carte Twitter |
| **Screenshots** | 3 à 5 images | PNG | Largeur libre, scaled à 347px sidebar |
| **Banner** (optionnel) | 960×300 max | PNG | Remplace le titre haut de page |
| **Embed game** | Largeur×hauteur fixées | — | Recommandé : largeur native du canvas Phaser (à confirmer dans `packages/renderer/src/main.ts`) |

**Plan capture assets** :

1. **Cover** : screenshot in-game cadré tactique (sprite Pokemon en duel, grille iso visible, UI minimale). Crop manuel 630×500. Source : sandbox studio (`pnpm dev:sandbox`) avec setup esthétique. **Reuse possible** : `.screenshots/` contient déjà des captures debug — humain pioche celles présentables.
2. **Screenshots** (4 recommandés) :
   - 1× combat 1v1 en cours (mid-action, animation visible)
   - 1× InfoPanel/MoveTooltip ouvert (montre profondeur tactique)
   - 1× scène avec terrain spécial (eau, herbe haute) visible
   - 1× UI de sélection move avec range/targeting highlighté
3. **Banner** : optionnel v1, skipper si effort > temps dispo. Si fait : titre stylé + cover en background blur.
4. **GIF gameplay 10-15s** (recommandé fortement) : itch.io support GIF dans screenshots, énorme boost engagement. Outil : `ffmpeg` depuis enregistrement OBS local ou `peek` Linux.

**Structure page** (inspiration : [Mindustry](https://anuke.itch.io/mindustry), [Vintage Story](https://tyronx.itch.io/vintage-story), [Eco City Builder](https://barlium.itch.io/eco-city-builder)) :

```
┌─────────────────────────────────────────────┐
│ [BANNER 960×300]  Pokemon Tactics           │
├─────────────────────────────────────────────┤
│ [EMBED GAME — Play in browser]              │
│ Canvas Phaser, click to fullscreen          │
├─────────────────────────────────────────────┤
│ ## About / Description                      │
│ Hook 1 ligne + status + features            │
├─────────────────────────────────────────────┤
│ ## Screenshots (3-5, inline dans desc)      │
├─────────────────────────────────────────────┤
│ ## Disclaimers + License + Credits          │
├─────────────────────────────────────────────┤
│ Sidebar droite (auto-itch) :                │
│  - Cover image                              │
│  - Tags, status, platform                   │
│  - Author, links GitHub                     │
│  - Development log (devlog itch)            │
└─────────────────────────────────────────────┘
```

itch.io ajoute auto une section **"Development log"** dans la sidebar si des devlog posts existent (cf. feature [itch.io devlogs](https://itch.io/docs/creators/getting-started#devlog)). RSS auto exposé sur `/devlog.rss`.

**Texte page** (description, markdown supporté) :

Source de vérité = `README.md` du repo. Réutiliser les sections :
- Hook 1 ligne (tactical combat × Pokemon × FFT)
- Status playable demo (chiffres : 81 Pokemon, 147 moves, etc.)
- Features list
- Team Builder
- Disclaimers (clause IP complète, copie verbatim README.md)
- License (MIT code + CC BY-NC 4.0 sprites PMDCollab)
- Lien GitHub

Template à coller (à mettre à jour si README évolue) :

```markdown
> Tactical combat on an isometric grid, fusing **Pokemon** and **Final Fantasy Tactics**.

**Status: Playable demo** — 81 Pokemon (final evolutions + legendaries), 147 moves, AI opponents, hot-seat up to 12 players.

## Features
- Grid-based tactical combat (FFTA-style isometric)
- 81 / 151 Gen 1 Pokemon implemented with canon movesets
- Team Builder (6 Pokemon, ability, item, nature, EVs, Showdown import/export)
- 22 held items, 52 abilities
- Terrain effects + elevation
- AI opponents
- Sandbox mode + replays

Open-source code + changelog : **[GitHub releases](https://github.com/kekel87/pokemon-tactics/releases)** (pattern Mindustry — source de vérité unique).

## Disclaimers

**Intellectual property** — This is a **non-commercial fan game** made for educational and experimental purposes. Pokemon and all related properties are trademarks of **Nintendo, Game Freak and The Pokemon Company**. This project is not affiliated with, endorsed, or sponsored by these companies. If rights holders request removal, it will be taken down immediately.

**Artificial intelligence** — Nearly all code, tests, and documentation in this project were generated by **Claude Code** (Anthropic). The human creator acts as creative director and architect.

## License & Credits

Code MIT. Pokemon sprites from [PMDCollab](https://github.com/PMDCollab/SpriteCollab) under CC BY-NC 4.0. Tileset by [Jao](https://jao-itch.itch.io/icon-isometric-pack). Full credits in repo CREDITS.md.
```

Chiffres dynamiques (81 Pokemon, 147 moves) à actualiser au moment de publier — source `docs/implementations.md`.

Tags itch.io (jusqu'à 10) :
`tactical-rpg`, `turn-based-strategy`, `pokemon`, `isometric`, `creature-collector`, `phaser`, `browser-game`, `fan-game`, `singleplayer`, `pixel-art`.

#### 1.3 — Embed settings (HTML5)

Dans "Embed options" de la page :
- **Viewport dimensions** : largeur×hauteur du canvas Phaser (regarder `packages/renderer/src/scenes/` config — probablement 1920×1080 ou 1280×720 scaled)
- **Frame options** : ☑ Click to launch in fullscreen, ☑ Enable scrollbars (si UI déborde)
- **Mobile friendly** : à tester — probablement non v1 (jeu desktop)
- **Manually set the viewport size** : oui (sinon itch crop)
- **Fullscreen button** : oui

**Sortie Étape 1** : URL page itch (en draft), secret CI configuré, assets visuels prêts en local (`.screenshots/itch/` proposé).

### Étape 2 — Workflow GitHub Actions deploy

Créer `.github/workflows/itch-deploy.yml` :

```yaml
name: Deploy itch.io
on:
  release:
    types: [released]      # déclenché quand humain publie draft release-drafter
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pokemon-tactic/renderer build
      - name: Push to itch.io
        uses: Ayowel/butler-to-itch@v1.3.0
        with:
          butler_key: ${{ secrets.BUTLER_API_KEY }}
          itch_user: kekel87
          itch_game: pokemon-tactics
          version: ${{ github.event.release.tag_name }}
          files: |
            html5:packages/renderer/dist
```

Tests :
- Push tag test `v0.0.0-test` → workflow tourne, build atteint itch en channel html5.
- Vérifier page itch affiche bouton "Play in browser".
- Si erreur taille/CORS/index.html → ajuster `packages/renderer/vite.config.ts` (peut-être `base: './'` requis pour itch).

### Étape 3 — Skill `/itch-feedback`

Créer `.claude/skills/itch-feedback/SKILL.md` :

```markdown
---
name: itch-feedback
description: Review automatique commentaires + devlog réactions itch.io. Scrape page jeu, classe via feedback-triager.
user-invocable: true
---

Récupère feedback itch.io sans connexion humain.

1. Fetch `https://kekel87.itch.io/pokemon-tactics` (WebFetch)
   - Parse section commentaires (DOM `.community_post_list` ou équivalent)
2. Fetch `https://kekel87.itch.io/pokemon-tactics/devlog.rss` si devlog actif
3. Croiser avec `docs/backlog.md` pour détecter doublons
4. Délègue à agent `feedback-triager` (classe bug/feature/feedback/spam)
5. Sortie : tableau résumé + drafts réponses optionnelles (humain copie si veut répondre)
6. Si nouveaux items pertinents, propose ajout à `docs/backlog.md`
```

Tests :
- Lancer skill quand 0 commentaire → sortie "rien à reviewer" propre.
- Lancer après 1 commentaire test (humain poste un commentaire bidon) → skill l'identifie et classe.

**Limitations à documenter dans skill** :
- Pas d'API officielle itch → scraping HTML fragile, peut casser si itch change DOM.
- Pas de notification push : humain doit lancer skill manuellement (ou via `/loop 1d /itch-feedback`).

### Étape 4 — Update topics GitHub

Via `gh` CLI (humain exécute, agent ne push pas) :

```bash
gh repo edit kekel87/pokemon-tactics \
  --remove-topic roguelike \
  --add-topic tactics-game \
  --add-topic tactical-rpg \
  --add-topic turn-based-strategy \
  --add-topic browser-game \
  --add-topic html5-game \
  --add-topic fan-game \
  --add-topic monorepo \
  --add-topic pnpm
```

Topics déjà présents probables (à confirmer) : `pokemon`, `phaser`, `typescript`. Si absents, ajouter.

Vérifier sur https://github.com/kekel87/pokemon-tactics — topics visibles côté droit, indexés par GitHub search.

### Étape 5 — Documentation

- Update `docs/methodology.md` ou `README.md` : section "Releases & Deploy" → mentionner workflow itch + skill feedback.
- `STATUS.md` : noter URL itch publique.
- `docs/decisions.md` : ADR court "Pourquoi itch.io vs Steam vs auto-host" (résumé : gratuit, niche indie, zéro friction).

## Risques

- **DMCA Nintendo** : cf. section "Risque légal IP" dédiée. Plan B documenté.
- **Butler API key fuite** : stockage GitHub Secrets, jamais log. Workflow log doit pas echo la clé.
- **Limite 1 000 fichiers HTML5 itch** : actuel 590 fichiers (59 %). Ajout Pokemon = ~4 fichiers/each. Marge ~100 Pokemon avant atlas obligatoire.
- **Paths Vite cassés sur itch** : oubli `base: './'` → 404 sur assets. Cause #1 connue, test pré-deploy obligatoire.
- **Service workers** : Vite PWA off (déjà off chez nous). Confirmer pas d'enregistrement SW dans build → casse autres jeux user sinon.
- **ZIP racine** : butler gère bien (push directory, pas ZIP manuel). Si jamais ZIP manuel → `index.html` doit être à la racine, pas sous-dossier.
- **Skill scraping cassé** : DOM itch change → skill silencieusement renvoie 0 commentaire. Mitigation : log "X commentaires trouvés" pour détecter régression.
- **Spam commentaires itch** : audience faible v1, pas un problème.
- **Cover/screenshots datés** : ajout features visuelles majeures → cover obsolète. Pas critique, refresh annuel suffit.

## Validation finale

- [ ] Décision IP tranchée : titre page itch + risque assumé
- [ ] Étape 1 humain : page itch créée + designed (cover, 3-5 screenshots, description, tags, embed)
- [ ] Secret CI `BUTLER_API_KEY` configuré
- [ ] `base: './'` ajouté dans `packages/renderer/vite.config.ts` si nécessaire
- [ ] Test local build servi statique : pas de 404, jeu charge
- [ ] Workflow `itch-deploy.yml` push tag v* déploie OK build navigable
- [ ] Vérif sur page itch : "Play in browser" fonctionne, canvas visible, plein écran OK
- [ ] Skill `/itch-feedback` invocable, sort résumé propre
- [ ] Topics GitHub corrigés, vérifiable sur page repo
- [ ] Doc mise à jour (`STATUS.md`, `docs/decisions.md` ADR IP, `docs/backlog.md` dette sprites originaux)
- [ ] Aucun secret loggé dans CI
- [ ] Page itch passée de `Draft` à `Restricted` (URL only, pas listings publics) puis `Public` quand humain prêt

## Suivi post-livraison

- Mois +1 : check stats itch.io (vues, downloads, comments) + GoatCounter analytics.
- Si traction → envisager plan 097 (auto-post Bluesky depuis releases).
- Si zéro traction → laisser tel quel, vitrine reste, coût marginal nul.
