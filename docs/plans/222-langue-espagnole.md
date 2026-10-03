# Plan 222 — Le jeu en espagnol

**Statut** : done
**Origine** : `agenda-etude-langues-proposees-vs-visiteurs` (2026-10-03). Étude menée en session sur la télémétrie
(2026-09-02 → 2026-10-03, 181 journées-visiteur) : 41 % des visites ont un navigateur ni FR ni EN ; portugais 15 %,
espagnol 9 %, allemand 3 %, russe 3 %. **Choix de l'humain : l'espagnol seul**, parce qu'il a des noms officiels
complets (jeux principaux localisés depuis toujours) — le portugais n'en a pas avant Pokémon Vents et Vagues
(annoncés le 2026-02-27), l'allemand et l'italien pèsent ~5 % à eux deux et viendront si les chiffres le justifient.

## Ce que tu verras à l'écran

- Menu principal et Paramètres (y compris en plein combat) : le bouton de langue fait le tour **FR → EN → ES**.
- Navigateur réglé en espagnol, première visite : le jeu s'ouvre directement en espagnol.
- En espagnol : interface, journal de combat, infobulles, constructeur d'équipe, noms et descriptions de cartes,
  types, noms de Pokemon, d'attaques, de talents et d'objets — **noms officiels espagnols**.
- La recherche du constructeur d'équipe trouve aussi une attaque par son nom espagnol.
- Rien ne change en français ni en anglais.

## Contexte et risques connus

- **Traduction non relue** : les ~1 000 clés d'interface (`locales/fr.ts`, 1 004 clés) sont traduites par Claude.
  L'humain ne peut pas juger la qualité ; le retour viendra des joueurs. Les **noms** (Pokemon, attaques, talents,
  objets, types) viennent tous de sources officielles, jamais d'une traduction.
- **11 attaques du roster sans nom espagnol dans PokeAPI** (Gen 8.5/9) : Grand Courroux, Aquatacle, Talon-Marteau,
  Hommage Posthume, Cryo-Pirouette, Taurogne, Chute de Neige, Bond, Désherbaffe, Douche Froide, Poing de Colère.
  Nom officiel à relever à la main (Wikidex / Bulbapedia) → fichier d'override, par `data-miner`. Idem pour les talents
  du roster sans nom espagnol (5 manquants au total dans PokeAPI, à croiser avec le roster).
- **Descriptions** : comme le français, l'espagnol prend le texte PokeAPI brut ; les surcharges Champions ne patchent
  que l'anglais (écart existant, pas aggravé).
- **Poids du bundle** : les JSON de référence sont embarqués. On n'ajoute `es` qu'aux champs consommés (`names`,
  `shortDescription`, `longDescription`) — pas à `genus` ni `pokedexEntries`. Mesurer le bundle avant/après.
- **Police** : `PokemonEmeraldPro` couvre déjà ñ, accents, ¿, ¡ (vérifié `fc-query`).
- **Réseau** : la langue n'est jamais échangée, pas de `NETWORK_VERSION` à monter.

## Travail

### Données (`packages/data`)
1. `build-reference.ts` : extraction générique par langue (`extractName(names, lang)`), `es` ajouté aux noms et
   descriptions des attaques, talents, objets et espèces ; `buildI18nMaps` produit `moves.es.json` et
   `pokemon-names.es.json`. Régénération depuis le cache local (`data:update:skip-fetch`), sans réseau.
2. Override des noms espagnols manquants pour le roster (attaques + talents), sources officielles.
3. Types `{ fr, en }` → `{ fr, en, es }` (structure : `{ fr: string; en: string; es: string }`) :
   `reference-types.ts`, `load-abilities.ts`, `load-items.ts`, `load-data.ts`, `team-builder-catalog.ts`,
   `team-builder-registry.ts`, et les définitions de talent / objet du core (`ability-definition.ts`,
   `held-item-definition.ts` — types purs du core).
4. `i18n/index.ts` : `es` dans les tables ; `type-names.ts` : 18 noms espagnols, lecture par langue au lieu du
   ternaire `=== "fr"`.

### Application (`packages/app`, `ui-dom`)
5. `Language.Spanish = "es"` dans `packages/app/src/i18n/types.ts`, créer `packages/app/src/i18n/locales/es.ts` (1 004 clés, copiées du `fr.ts` puis traduites), importer dans `packages/app/src/i18n/index.ts` et ajouter au LOCALES, mettre à jour `isLanguage()` et `detectLanguage()` pour navigateur `es*` (fallback EN si aucune correspondance).
6. Bouton de langue (menu principal + Paramètres) : cycle FR → EN → ES → FR, une seule fonction partagée.
7. Ternaires silencieux qui retomberaient sur l'anglais : `team-builder-data.ts` (refactoriser `pickLocalized()` pour trois langues, lecture par langue + texte de recherche avec le nom ES), `MovePickerModal.ts` (recherche ES), `team-helpers.ts` (date `es-ES`), `type-names.ts` (remplacer ternaire par switch ou mapping), `BattleLogFormatter.ts` (supprimer le `Language` local dupliqué, importer le vrai).
8. `maps-registry.ts` : ajouter `es: string` aux trois champs `displayName`, `description`, `tags[].es` pour les 9 cartes ; `key-legend.ts` : ajouter `[Language.Spanish]: {}` au FALLBACK (clavier QWERTY = même que EN).
9. Hors i18n à rattraper : `SplashScreen.ts` (deux textes FR en dur, vus par les joueurs) → clés i18n ;
   `document.documentElement.lang` tenu à jour avec la langue courante.

### Tests (core et données — pendant le dev)
10. `i18n-sync.test.ts` : fichiers `es` et parité fr↔en↔es. Tests app de parité (`battle-log-keys`, `loading-tips`,
    `index.test.ts` détection `es`) : au menu de finalisation, avec les e2e qui supposent un aller-retour FR↔EN.

## Hors périmètre

- Allemand, italien, portugais, langues à police CJK.
- Traduction des descriptions Champions (écart existant en FR aussi).
- Tableau de bord de télémétrie (administrateur, français seul).
