# Plan 190 — Migration i18n du journal de combat

- **Statut** : `done` (2026-08-27) — 234 clés migrées. Gate local **full vert** : build, lint (biome natif), typecheck, 3870 unit, 388 intégration, **516 e2e** (2ᵉ passage — le 1er est tombé sur le correctif d'accent, voir §8)
- **Origine** : dette identifiée le 2026-08-03 (plan 178), consignée dans `docs/next.md` § « Migration i18n du journal de combat ». Décision humaine du 2026-08-27 : faire la **migration complète** (« le truc propre »).
- **Périmètre mesuré** (2026-08-27, pas estimé) : `packages/ui-dom/src/BattleLogFormatter.ts`, 1617 lignes.

## 1. Le problème

Le journal de combat **est** bilingue et fonctionne. Le défaut est architectural : ses traductions vivent **dans le fichier de code**, pas dans le système i18n de l'app.

Concrètement, le formateur ne reçoit pas d'`I18nContext` — seulement un `language: Language` — et embarque :

| Forme | Volume mesuré |
|---|---|
| Ternaires `lang === "fr" ? "…" : "…"` (gabarits de phrase inline) | **157** occurrences |
| Tables de libellés `_FR`/`_EN` ou `{ fr, en }` | **10 tables**, **80** entrées |
| **Total de chaînes à router vers des clés** | **~234** |

Conséquences, toutes internes (zéro impact joueur) :

- une 3ᵉ langue = réécrire 157 endroits dans un fichier de 1617 lignes, au lieu d'ajouter un fichier de locale ;
- **aucun test de parité FR/EN** sur ces chaînes, alors que les 699 autres clés de l'app sont verrouillées par le type `Translations` (qui exige les mêmes clés dans les deux locales) ;
- traduire le journal exige de toucher du code.

La demi-migration est exclue par décision humaine du 2026-08-03 (« migrer une seule famille en threadant un contexte laisserait les 5 autres en dur »).

## 2. Contrainte d'architecture — où vont les chaînes

`packages/ui-dom` est un paquet réutilisable qui **ne doit pas** importer l'i18n de l'app : c'est toute la raison d'être de l'injection par `I18nContext` (`packages/render-ports/src/i18n-context.ts`). Et `packages/app` dépend de `ui-dom`, donc l'inverse serait circulaire.

Donc :

- les **clés** (`battleLog.*`) et leurs valeurs FR/EN vont dans `packages/app/src/i18n/` (`types.ts` + `locales/fr.ts` + `locales/en.ts`), avec les 699 autres ;
- le **formateur** ne fait plus qu'émettre `translate("battleLog.x", { … })` — il ne connaît plus aucune chaîne de langue naturelle ;
- **conséquence sur les tests**, voir §5 : le test unitaire de `ui-dom` ne peut plus vérifier le libellé français, seulement la clé + les paramètres. Le filet « la phrase se lit bien » déménage côté `app`, où les vraies locales sont disponibles.

## 3. Invariant directeur

**La sortie doit rester octet pour octet identique**, FR et EN. C'est ce qui rend la migration vérifiable : les chaînes des locales sont recopiées telles quelles depuis le formateur, et les ~419 tests e2e (qui lisent le journal rendu en français) sont le juge de paix.

## 4. Étapes

1. ✅ **Plumbing** — `BattleLogContext` gagne `translate` (même signature que `I18nContext.translate`). `battle-log.ts` le transmet au formateur ; `combat-screen.ts` le passe déjà à `createBattleLog` (`uiConfig.translate`, ligne 444) — il suffit de le router dans le contexte. Les fonctions internes qui reçoivent `lang` (`formatWeatherSet`, `formatWeatherCleared`, `getEffectivenessText`, et les 5 dispatcheurs de libellés) prennent `translate` à la place.
2. ✅ **Clés** — nommage `battleLog.<événement>` pour les 101 contextes à site unique (dérivé du `BattleEventType`), noms explicites pour les 19 contextes multi-sites (50 sites) et les 10 tables.
3. ✅ **Locales** — ~234 entrées ajoutées à `types.ts`, `locales/fr.ts`, `locales/en.ts`, chaînes recopiées à l'identique. Les `${x}` des gabarits deviennent des `{x}` (syntaxe déjà celle de `t()`).
4. ✅ **Formateur** — remplacement des 157 ternaires et des 10 tables. Le helper local `resolve(template, name)` disparaît (l'interpolation est le job de `t()`).
5. ✅ **Tests** — voir §5.
6. ✅ **Gate** — `pnpm build && lint && typecheck && test && test:integration && test:e2e` (e2e **full**, c'est le filet de l'invariant §3).

## 5. Stratégie de test

| Fichier | Avant | Après |
|---|---|---|
| `packages/ui-dom/src/BattleLogFormatter.test.ts` | 502 lignes, assertions sur le **texte** FR/EN exact | assertions sur la **clé + les paramètres** émis (contrat de routage) |
| `packages/app/src/…/battle-log-formatter.integration` (nouveau) | — | reprend les **mêmes chaînes attendues**, avec un `translate` branché sur les **vraies locales** → le filet « la phrase se lit bien » est conservé, et il teste en plus que la clé existe dans les deux locales |

Aucune couverture perdue : le test devient deux tests, un par responsabilité.

## 6. Risques

- **Chaîne oubliée** → le typecheck ne la voit pas (une chaîne littérale reste une chaîne valide). Filet : le script d'inventaire (§1) est rejouable et doit finir à **0 occurrence** de `=== "fr"` dans le formateur.
- **Clé absente d'une locale** → `t()` retombe silencieusement sur l'anglais puis sur la clé brute. Filet : le type `Translations` rend les deux locales obligatoirement complètes (erreur de typecheck). ⚠️ **Cette analyse était incomplète, corrigée le 2026-08-27 après mesure** — voir §10.
- **Dérive de libellé à la recopie** → filet e2e (§3) + le test app-side (§5).

## 7. Clôture (2026-08-27)

### Ce qui a été livré

| Fichier | Changement |
|---|---|
| `packages/ui-dom/src/BattleLogFormatter.ts` | **0** occurrence de `=== "fr"` (157 avant). Les 10 tables de libellés supprimées, le helper `resolve()` supprimé (l'interpolation est le travail de `t()`), 4 imports devenus morts retirés (`PokemonType`, `DefensiveKind`, `StatName`, `TerrainType`) |
| `packages/app/src/i18n/{types.ts, locales/fr.ts, locales/en.ts}` | **+234 clés** `battleLog.*` chacun (699 → 933) |
| `packages/app/src/i18n/index.ts` | `translateIn(language, key, params)` extrait de `t()` — traduire dans une locale explicite sans piloter le singleton `currentLanguage` |
| `packages/ui-dom/src/BattleLogFormatter.test.ts` | réécrit : contrat de clés + paramètres |
| `packages/app/src/i18n/battle-log-formatter.test.ts` | **nouveau** : les mêmes chaînes attendues qu'avant, rendues par les vraies locales |
| `packages/app/src/babylon/combat-screen.ts` | `translate: uiConfig.translate` ajouté au `BattleLogContext` |

### Décisions prises en cours de route

1. **`language` reste dans `BattleLogContext`**, à côté de `translate`. Il ne sert plus aucune chaîne d'UI, mais reste nécessaire aux recherches de **noms de données** (`getTypeName(type, lang)` du paquet `data`) — exactement le partage de rôles que `I18nContext` fait déjà entre `translate` et `getLanguage`.
2. **Clés composées sur la VALEUR d'enum, pas le nom de membre.** Les tables utilisaient des clés calculées (`[StatusType.BadlyPoisoned]`), et les consommateurs interpolent maintenant la valeur (`battleLog.status.${event.status}`). Les valeurs ne sont pas dérivables du nom : `BadlyPoisoned` → `badly_poisoned` (souligné), `AquaRing` → `aqua-ring` (tiret). Les valeurs ont donc été **lues dans les enums du core**, jamais devinées. Verrouillé par un test (« compose la clé de statut sur la VALEUR d'enum »).
3. **Garde-fou de périmètre explicité.** `STATUS_LOG_KEY` / `TERRAIN_STATUS_LOG_KEY` faisaient double emploi : table de libellés **et** filtre « cet événement mérite-t-il une ligne ? » (`if (!statusEntry) return null`). Les libellés sont partis en locales, le filtre est resté sous forme de `LOGGED_STATUSES` / `LOGGED_TERRAIN_STATUSES` (`ReadonlySet`). Sans lui, `translate` retomberait sur la clé brute et le journal afficherait `battleLog.status.roosted.applied`. Ce n'est **pas** de la langue : c'est un périmètre, sa place est dans `ui-dom`. Couvert par un test dédié.
4. **Deux ternaires imbriqués éclatés en deux clés** plutôt qu'en fragment traduit passé en paramètre : `futureSightStruck.{missed,struck}` et `entryHazardTriggered.{poisoned,badlyPoisoned}`. Un fragment de phrase interpolé (« gravement empoisonné ») n'est pas traduisible correctement dans une langue quelconque.
5. **Le test n'a pas été déplacé mais dédoublé par responsabilité** (`git mv` refusé par la politique du dépôt, et de toute façon les deux moitiés du contrat méritent chacune son test). Aucune couverture perdue : les 519 lignes d'assertions sur les phrases FR/EN existent toujours, côté `app`.
6. **Commentaires retirés des deux fichiers de test**, conformément à `.claude/rules/tests.md` (« pas de commentaires dans les tests unitaires ») — le pourquoi vit ici.

### Méthode — pourquoi c'est fiable

Réécrire 157 sites à la main aurait été de la loterie. La migration a été **scriptée** : un extracteur maison (l'API compilateur JS de TypeScript n'existe plus en TS 7, portage Go) a sorti les 157 ternaires avec leurs deux branches et leurs paramètres, puis un générateur a produit les entrées de locale **et** patché le fichier par offsets décroissants. Les chaînes n'ont jamais été retapées — une première tentative de recopie de mémoire avait justement inventé « Terrain Herbu » là où le code disait « Champ Herbu ».

Contrôles automatiques posés pendant le run : parité des paramètres entre branche FR et branche EN (1 divergence trouvée → traitée à la main), détection des clés dupliquées à contenu différent, et assertion finale « 0 occurrence de `=== "fr"` ».

### Un littéral assumé

Un seul gabarit de message subsiste dans le formateur : `` `${moveName} → ${resolvedName}` `` (morphing Force Nature). C'est une **composition de deux noms déjà localisés** par une flèche.

Le critère qui décide, précisé par la revue de code : **la valeur varie-t-elle selon la langue ?** — pas « contient-elle des mots ? ». C'est ce qui explique deux arbitrages qui pourraient sembler contradictoires :

- `typeChanged.typeSeparator` et `statStagesSwapped.statSeparator` sont **devenus des clés** bien qu'ils ne contiennent presque rien : leurs valeurs diffèrent réellement (`" / "` en FR contre `"/"` en EN ; `" et "` contre `" and "`).
- `` `${a} → ${b}` `` **reste un littéral** : sa valeur serait identique dans les deux locales, une clé n'aurait fait qu'ajouter une entrée sans information.

### Ce que ça débloque

Une 3ᵉ langue = **un fichier de locale de plus**, et le type `Translations` échoue au typecheck tant qu'il est incomplet. Le journal n'est plus une exception dans le système i18n.

## 8. Hors périmètre, fait au passage — et son contrecoup

Deux valeurs de `locales/fr.ts` étaient **non accentuées** : `"action.move"` (« Deplacement ») et
`"action.undoMove"` (« Annuler deplacement »). Corrigées — la règle d'orthographe française du projet
ne souffre pas d'exception sur du texte vu par le joueur.

**Ce que ça a coûté, et la leçon.** Ces deux libellés sont des **sélecteurs e2e**
(`getByRole("button", { name: "Deplacement", exact: true })`). Le premier passage du gate e2e est
tombé avec ~30 échecs, précisément dans les specs qui pilotent le menu d'actions — dont plusieurs via
le POM `e2e/pages/CombatScene.ts`, ce qui explique des échecs dans des specs qui ne nomment pas le
libellé (`mechanics-phazing`, par exemple). Répercussion complète : **25 occurrences dans 15 fichiers
e2e**, **12 dans `docs/test-plan.md`**, plus le titre §6.4 de `docs/reflexion-patterns-attaques.md`.

À retenir : un libellé d'action de l'interface de combat n'est pas seulement du texte joueur, c'est un
**contrat de test**. Le changer impose de balayer `e2e/` et le cahier de recette dans le même
mouvement.

**Erreur de ma part à signaler** : j'ai d'abord annoncé « la seule valeur non accentuée des 219 » —
faux, il y en avait deux. Ma première recherche n'avait cherché que la capitale (`Deplacement`), pas
la minuscule. Le second passage a utilisé un balayage par motifs sur les mots français courants.

## 9. Retours de la revue de code (2026-08-27)

Zéro Critical. La revue a **scripté** sa vérification plutôt que de relire 234 clés à l'œil, et rapporte 0 écart sur : les 234 clés × 3 fichiers (aucune doublon/orpheline/manquante), les 154 sites d'appel statiques (params passés contre placeholders FR **et** EN), les 381 paires de gabarits comparées à `HEAD` **ordre des placeholders inclus**, la correspondance segment de clé ↔ `case BattleEventType.X`, les ensembles de garde (identiques à 1:1, mêmes sites, même ordre de repli), et `--tb-*` déclaré/utilisé sur tout `packages/**/*.css` (0/0).

Corrigé à sa suite :

| # | Constat | Correctif |
|---|---|---|
| Major 1 | Le garde-fou avait perdu son lien de compilation avec le core : 22 chaînes tapées à la main là où les anciennes tables étaient indexées par membre calculé (`[StatusType.BadlyPoisoned]`), donc un renommage de valeur dans le core suivait tout seul | `ReadonlySet<StatusType>` / `ReadonlySet<TerrainType>` construits sur les **membres d'enum** |
| Major 2 | Commentaire orphelin — il documentait `MORPH_TYPE_NAME` (supprimée) et se retrouvait au-dessus de `auraKindLabel` | Supprimé (dégât typique du patch scripté) |
| Major 3 | Repli gracieux perdu : `morphType` couvrait 4 des 18 `PokemonType` et `stat` 7 des 8 `StatName`, donc un cas non couvert afficherait `battleLog.stat.hp` | **Mieux que le correctif proposé** : `getTypeName` (paquet `data`) se déclare *source unique* des noms de type pour le journal et couvre les 18 types avec exhaustivité vérifiée par le compilateur — les 4 clés `morphType` étaient une copie partielle redondante, **supprimées**. Côté statistiques, `battleLog.stat.hp` ajoutée. Total : 234 → **231 clés** |
| Major 4 | `docs/next.md` affirmait « passe complète du sous-arbre » alors que trois feuilles stylent des descendants DOM et gardent des valeurs fixes | Phrase resserrée sur `battle-chrome.css`. `move-tooltip.css` corrigée sur décision humaine (police 42px dans 6px de garniture en 4K — le défaut de la pastille d'instruction à trois jetons près). `button.css` (`.tb-btn`, partagé avec le Team Builder) et `turn-timeline.css` **consignés au backlog**, décision humaine de s'arrêter là |
| Minor 5,6,8,9,10,11,12,14 | paramètre `overrides` mort, littéraux `"fr"` au lieu de `Language.French`, `type Translate` redéclaré alors que `I18nContext["translate"]` existe, commentaire faux sur `getMoveName`, `const name` calculé avant une garde qui retourne `null` (3 sites), abréviation `dmgMessage`, en-tête de CSS plus long que le CSS | Tous traités |

**Minor 7 assumé** : `translateIn` est un export public dont le seul appelant hors `t()` est le nouveau test. C'est un export test-only, consciemment — l'alternative (piloter le singleton `currentLanguage` et son `localStorage` depuis le test) était pire.

## 10. Ce que la couverture de tests a révélé (2026-08-27)

Deux constats mesurés par `test-writer`, dont le premier **corrige l'analyse de risque du §6**.

### `t()` retombe d'abord sur l'ANGLAIS, pas sur la clé brute

Vérifié rouge-vert dans les deux sens :

| Cas | Ce que le joueur voit | Ce qui casse |
|---|---|---|
| Clé retirée de `fr.ts` **seule** | « **Attack** de Florizarre augmente ! » — de l'anglais dans une phrase française, **aucune clé brute** | les assertions de phrase FR |
| Clé retirée des **deux** locales | `battleLog.turnStarted` en clair | le balayage « aucune clé brute » |

Donc un garde-fou « la sortie ne rend jamais `battleLog.` » ne couvre que la clé absente **partout**. Le §6 affirmait que le type `Translations` rendait les deux locales obligatoirement complètes : **c'est exact pour les 222 clés littérales, et muet sur les familles composées**, où la clé est construite à l'exécution (`battleLog.status.${status}.applied`) et n'existe donc dans aucun type. `test-writer` en a dénombré **12 familles**, pas les 6 que la note d'origine annonçait.

**Comblé** par `packages/app/src/i18n/battle-log-keys.test.ts` (+72 cas) : il itère **chaque valeur d'enum du core** et exige la clé dans les deux locales — et, pour les valeurs hors journal, exige son **absence** dans les deux. Aucune surface publique nouvelle (pas besoin d'exporter `LOGGED_STATUSES` : le test tient sa propre liste d'exclusion, dont le seul rôle est de **forcer une décision** quand une valeur d'enum apparaît côté core, puisqu'elle ne serait alors dans aucune des deux listes). Le compte total de chaque enum est épinglé, donc un ajout dans le core fait tomber le test au lieu de passer inaperçu.

Erreur commise en l'écrivant, à noter : j'ai **deviné** les membres de `TerrainType` (`Grass`, `Rock`, `Wall`…) au lieu de les lire — le test est tombé, les vraies valeurs sont `normal`, `tall_grass`, `lava`, `snow`… C'est la **deuxième fois** dans ce plan (après « Terrain Herbu » contre « Champ Herbu »). La règle qui s'impose : **toute valeur recopiée depuis le core ou une locale se lit par script, jamais de mémoire.**

### Le match nul n'a aucun chemin d'exécution

`checkVictory` est appelé **à chaque K.O. individuel** (`packages/core/src/battle/BattleEngine.ts:3816`) : le premier combattant à tomber laisse l'autre camp seul vivant, `playersAlive.size === 1`, vainqueur déclaré et `battleOver = true` — le second K.O. arrive trop tard. Mesuré : Explosion sur une cible à 1 PV, où le lanceur s'auto-K.O. dans la même résolution, produit « Joueur 1 gagne ! ».

Donc `winnerId: null` est **inatteignable**, et `battle.draw`, `battle.drawMessage`, `battleLog.battleEnded.draw` ainsi que le `<p class="bc-victory-message">` conservé par `showVictory` sont du **code mort de fait**. Le commentaire du core décrit pourtant ce cas (« une détonation de Requiem balayant les deux camps »). Aucun test du core n'assertait le nul non plus.

`test-writer` a retiré son test plutôt que d'inventer un chemin — bon réflexe. **Question ouverte, tranchée hors de ce plan** : soit `checkVictory` groupe les K.O. d'une même résolution et le nul devient réel, soit les trois clés et la branche de `showVictory` partent. Consigné au backlog.
