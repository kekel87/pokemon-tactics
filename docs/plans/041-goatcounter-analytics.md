---
status: done
created: 2026-04-07
updated: 2026-04-07
---

# Plan 041 — Intégration Goatcounter (analytics)

## Objectif

Ajouter un suivi de fréquentation via Goatcounter sur le site de production (GitHub Pages) sans impacter le développement local.

## Contexte

Goatcounter est un outil analytics open source, léger, sans cookies, conforme RGPD. Un tag `<script>` suffit. L'URL est publique (`https://kekel87.goatcounter.com/count`), donc hardcodée dans un plugin Vite qui ne l'injecte qu'en mode production.

## Étapes

### Étape 1 — Plugin Vite `goatcounter`

- [x] Ajouter un plugin `transformIndexHtml` dans `packages/renderer/vite.config.ts`
- [x] Le plugin injecte le script Goatcounter avant `</body>` uniquement en mode production
- [x] URL hardcodée : `https://kekel87.goatcounter.com/count`

### Étape 2 — Vérifier le build

- [x] `pnpm build` produit un `dist/index.html` contenant le script Goatcounter
- [x] `pnpm dev` ne charge PAS le script

### Étape 3 — Documenter

- [x] Ajouter une note dans `docs/decisions.md` expliquant le choix Goatcounter

## Critères de complétion

- `pnpm build` produit un `dist/index.html` contenant le script Goatcounter
- `pnpm dev` ne charge PAS le script
- Dashboard accessible sur `https://kekel87.goatcounter.com`

## Risques

- **Bloqueurs de pub** : Goatcounter est souvent whitelisté (pas de cookies), mais certains visiteurs ne seront pas comptés — acceptable
- **CSP** : si ajoutée dans le futur, autoriser `gc.zgo.at` dans `script-src`
