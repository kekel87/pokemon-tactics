# Fabriquer la config d'un scénario sandbox

À lire à l'étape 2 de `/recette`, ou dès qu'il faut une config sandbox (tests, captures).

1. Chercher une fixture proche dans `e2e/fixtures/sandbox-configs.ts` : un export par mécanique, et son
   commentaire décrit le scénario. Partir d'elle plutôt que d'une page blanche.
2. Choisir la forme. Forme `teams` dès qu'il faut des positions, une orientation, plusieurs membres ou une
   parade posée d'avance (`defensiveMove`) ; forme plate (`pokemon`, `dummy*`) pour un simple un contre un.
   Les champs font foi dans `SandboxConfig` et `LegacySandboxConfig`
   (`packages/view-core/src/sandbox-config.ts`) : un champ absent du type est ignoré sans erreur, et le
   scénario a l'air testé alors que le réglage n'a rien fait.
3. Remplir le minimum, le reste prend les défauts :
   - Pokemon du roster jouable seulement (`packages/data/src/playable/playable-pokemon.ts`) ;
   - moves par id kebab-case existant dans `packages/data` ;
   - relief, murs, pentes : `mapUrl` vers une carte de `packages/app/public/assets/maps/dev/`
     (`sandbox-los` : piliers hauteur 3 en (3,3) et (5,3)) ;
   - équipe 2 `passive` : elle ne joue pas son tour ; une cible que l'humain doit piloter passe en
     `control: "player"` (forme plate : `dummyControl: "player"` et `dummyMoves`) ;
   - `seed` dès que le résultat attendu dépend d'un jet ;
   - le niveau se pose par Pokemon et la sandbox ne le ramène pas à 50.
4. Vérifier sans navigateur : `pnpm sandbox:check '<json>'`.
   Critère : `CHARGÉ SANS ERREUR`, chaque Pokemon à la case et dans l'orientation voulues.
