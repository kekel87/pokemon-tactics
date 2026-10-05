# Plan 226 — Évoluroc selon la règle officielle, et les textes officiels d'abord

**Statut** : done
**Origine** : retour humain du 2026-10-05, à la lecture des trouvailles du plan 225. « Je sais que le
texte de l'Évoluroc ne me plaît pas, tu listes les espèces au lieu de rester général. De manière
générale, tu reprends les textes officiels, sauf si on a modifié le gameplay du move, de l'objet, du
talent, etc. »

## Ce que tu verras à l'écran

- **Évoluroc** renforce désormais tout Pokémon qui peut encore évoluer (Bulbizarre, Carapuce,
  Leveinard…), comme dans les jeux, au lieu de dix espèces seulement.
- Son infobulle et sa ligne du constructeur reprennent le **texte officiel**, sans liste d'espèces.
- Les talents et objets dont seule la formulation avait été réécrite (même règle, autre façon de la
  dire) **retrouvent leur texte officiel**. Ne restent réécrits que ceux dont la règle diffère
  vraiment chez nous.
- Rien d'autre ne change en jeu.

## Décisions de conception

1. **La règle du texte** (humain, 2026-10-05) : texte officiel par défaut ; surcharge seulement quand
   le gameplay diffère. Une différence d'unité de durée seule (« 8 tours » → « 8 tours du lanceur »)
   n'est **pas** un gameplay différent : le texte officiel reste. À consigner comme décision.
2. **Évoluroc** : l'ensemble codé en dur (`EVIOLITE_NFE_POKEMON_IDS`, dix espèces Gen 1 qui évoluent
   dans des générations ultérieures, héritage du plan 083) est remplacé par une dérivation depuis la
   référence : une espèce qui a au moins une évolution (`evolutions` non vide dans
   `reference/pokemon.json`). Calculé **une fois, au chargement de `item-definitions.ts`**, par import
   direct de la référence (même forme que `team/team-builder-catalog.ts`) : le contexte du handler
   n'a pas accès aux définitions, et `ReferencePokemon` ne type pas `evolutions` — on le type
   localement plutôt que d'élargir le loader. Test de la mécanique pendant le dev :
   Bulbizarre bénéficie, Florizarre non, Leveinard toujours.
3. **Audit des 34 surcharges** (12 talents, 22 objets, `scripts/description-overrides.ts`) : pour
   chacune, garder ou retirer selon la décision 1, en vérifiant la règle dans le code. Les 5 objets
   sans texte FR/ES dans PokeAPI (Plume Enchantée, Talisman Sain, Gant de Boxe, Dé Pipé, Cape Obscure)
   gardent leur surcharge, faute de texte officiel. Régénération hors ligne, diff relu.
4. **Deux commentaires périmés** corrigés au passage : Moiteur (`ability-definitions.ts`, « from any
   field position ») et `position-linked-statuses.ts` (« no ability-driven Magnépiège trap »).

## Hors périmètre

Talisman Sain face à Intimidation et le libellé « ici » de l'infobulle d'attaque : au backlog, à la
clôture de session (accord humain du 2026-10-05).

## Étapes

1. Test Évoluroc (data/core), puis dérivation de l'ensemble depuis la référence.
2. Audit des surcharges + régénération + diff.
3. Commentaires.
4. `/simplify`, typecheck.
