---
name: capture-intro
description: Rejoue la séquence d'intro (menu → constructeur d'équipe → combat 6v6, tout à la manette, en anglais) et en sort la vidéo montée + les captures pour le README, le wiki et itch.io. Plan 194.
argument-hint: "[capture|video|tout]"
user-invocable: true
context: fork
agent: general-purpose
---

Tu produis la bande-annonce et les captures du jeu. Doc de référence : **`docs/capture-sequence.md`**
— lis-la avant d'agir, elle porte les pièges de navigation déjà payés.

## Étape

Argument (défaut `tout`) :

| Argument | Ce que tu lances |
|----------|------------------|
| `capture` | `pnpm capture:intro` seulement (~4 min : la partie se joue vraiment) |
| `montage` | `pnpm capture:trailer` — bande-annonce habillée, réutilise la dernière vidéo brute |
| `livrables` | `pnpm capture:release` — GIF du combat + les 3 captures de publication |
| `tout` | les trois, dans cet ordre |

**Les livrables et leur destination** : `docs/capture-sequence.md` § « Refaire tous les livrables ».
La vidéo va sur YouTube (non répertorié), le GIF et les captures sur itch.io / le wiki / les README.
⚠️ **3 Mo par image sur itch.io, GIF compris** — `capture:release` cherche le réglage qui tient et
annonce ce qu'il a sacrifié.

## Règles d'exécution

- **`pnpm capture:intro` dure plusieurs minutes** (une vingtaine de tours 6v6 se jouent réellement,
  animations comprises). Lance-le en **tâche de fond** pour qu'il reste arrêtable, et annonce-le.
- La séquence démarre son propre serveur Vite sur le **port du checkout + 2000**. Ne tue **aucun**
  serveur existant, ne touche pas au navigateur de l'humain.
- **N'ajoute jamais de clic** dans `e2e/capture/` : le premier clic remet `data-input-source` sur la
  souris et le liseré de focus disparaît de l'image. Idem `clickTile()`.

## En cas d'échec

L'erreur donne la cible de focus manquée. Alors, dans cet ordre :

1. `tail .screenshots/intro/focus-trace.txt` → où le focus s'est arrêté ;
2. la dernière capture numérotée de `.screenshots/intro/` → l'écran au moment du blocage ;
3. **lis la source** de l'écran concerné (`packages/app/src/ui/...`) avant de retoucher la
   chorégraphie. La navigation est spatiale : on ne devine pas un chemin, on le lit ou on le mesure.

Si la cible est ambiguë (une liste, une colonne de cartes), passe par `padMoveUntil` avec un prédicat
sur les **attributs** (`data-slot-index`, `data-team-id`) — jamais sur le texte, qui porte celui de
tous les frères.

## Rapport final

Remonte, en une dizaine de lignes :

- verdict (`passé` / `échoué à tel beat`) et durée ;
- `.captures/intro.mp4` (taille, durée) ;
- le nombre de captures dans `.screenshots/intro/` et l'issue du combat (`outcome` dans
  `beats.json` : combat terminé ou non, Pokemon restants) ;
- ce qu'il faudrait retoucher si un plan est raté.

⚠️ **Ne commite rien** : `.captures/` et `.screenshots/` sont hors versionnement. C'est l'humain qui
téléverse les livrables (YouTube, itch.io, wiki) — aucune de ces publications n'est automatisable ici.
