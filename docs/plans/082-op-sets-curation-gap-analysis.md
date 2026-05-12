# Plan 082 — Curate OP sets + gap analysis — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-12
> Terminé : 2026-05-12

## Objectif

Produire une **base de données d'équipes/sets compétitifs** (`op-sets`) pour les 81 Pokemon du roster, et **identifier les moves/abilities/items prioritaires à implémenter** pour couvrir un maximum de ces sets en mode `full` (100% jouable).

**Pas de runtime intégration ici.** Plan 082 = pure data + script analyse. Le runtime (random team gen + "Apply set" bouton builder) vient plan 084.

**Méta-plan 6 plans (081-086)** — voir `docs/next.md`. 081 done.

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | Format storage : `op-sets.json` (data brute, pas de code) | Aligne avec `reference/*.json`. Éditable hors TS. Loader plan 084. |
| 2 | Path : `packages/data/op-sets/op-sets.json` (hors `src/`) | Data manuelle non générée. Symétrique à `reference/`. |
| 3 | 1-3 sets par Pokemon roster | 1 OP set obligatoire (rôle principal) + 0-2 alt (rôles différents). Total cible : ~120-240 sets pour 81 mons. |
| 4 | Sourcing : Smogon dex + CoupCritique + perso | Smogon = compétitif anglais (gen 4-9 OU/UU selon dispo Gen 1), CoupCritique = communauté FR, perso = fallback créatif |
| 5 | Format set = mirror Showdown text (item, ability, nature, moves, EV→SP) | Réutilise parser plan 081 (`importShowdownTeam`) pour curation initiale. |
| 6 | Pas de filtrage availability dans le data file | Sets référencent IDs Showdown standards même si non implémentés. Plan 084 filtre runtime. |
| 7 | Niveau curation : Gen 1 oriented (formes finales) + adaptation Champions | Bias vers movepools naturels Gen 1 (no Megas, no Gen 9 specific items). |
| 8 | Schema versionné (`schemaVersion: 1`) | Migration future si format change. |

---

## Structure de données

### `op-sets.json`

```json
{
  "schemaVersion": 1,
  "sets": [
    {
      "id": "charizard-mixed-attacker",
      "pokemonId": "charizard",
      "name": "Mixed Attacker",
      "role": "wallbreaker",
      "ability": "blaze",
      "heldItemId": "heavy-duty-boots",
      "nature": "naive",
      "moveIds": ["flamethrower", "aerial-ace", "dragon-claw", "roost"],
      "statSpread": {
        "attack": 16,
        "spAttack": 16,
        "speed": 31
      },
      "gender": null,
      "source": "smogon",
      "sourceUrl": "https://www.smogon.com/dex/sv/pokemon/charizard/ou/",
      "notes": "Speed-tied attacker with STAB Fire + Flying coverage."
    }
  ]
}
```

### TypeScript types (loader plan 084 réutilise)
```ts
// packages/data/src/op-sets/types.ts (créé plan 084, pas 082)
interface OpSetData {
  schemaVersion: 1;
  sets: OpSetEntry[];
}

interface OpSetEntry {
  id: string;
  pokemonId: string;
  name: string;
  role?: "physical-sweeper" | "special-sweeper" | "wallbreaker" | "tank" | "support" | "pivot" | "stallbreaker" | "lead";
  ability: string;
  heldItemId?: string | null;       // string Showdown id (kebab), null = no item
  nature: string;                    // Showdown lowercase
  moveIds: string[];                 // kebab-case
  statSpread: Partial<Record<"hp" | "attack" | "defense" | "spAttack" | "spDefense" | "speed", number>>;
  gender?: "male" | "female" | "genderless" | null;
  source: "smogon" | "coupcritique" | "custom";
  sourceUrl?: string;
  notes?: string;
}
```

**Note** : 082 stocke uniquement le JSON. Pas de TS dans `src/`. Le loader vient en 084.

---

## Architecture fichiers

### `packages/data/op-sets/` (nouveau)
- `op-sets.json` — data principal (~120-240 entries)
- `README.md` — sourcing notes, conventions curation

### `packages/data/scripts/` (existant, ajout)
- `analyze-op-sets.ts` — script analyse gap content
- Sortie console + `docs/op-sets-gap-analysis.md`

### Pas de modif :
- `src/` (loader = plan 084)
- `core/` (rien)
- `renderer/` (rien)

---

## Pré-exécution — Setup

1. Créer `packages/data/op-sets/` + `README.md` (boilerplate : sourcing notes, conventions curation)
2. Créer `op-sets.json` templated vide (`{"schemaVersion": 1, "sets": []}`)
3. Ajouter `pnpm op-sets:analyze` dans `packages/data/package.json` (scripts)

## Étapes d'exécution

### Étape 1 — Sourcing initial (agent `data-miner`)
1. Pour les 81 Pokemon roster (cf. `roster-poc.ts`), agent fetch :
   - Smogon dex : `https://www.smogon.com/dex/sv/pokemon/{id}/` (sets OU/UU/RU/NU selon dispo)
   - Fallback Gen ancien : `https://www.smogon.com/dex/{rb|gs|rs|dp|bw|xy|sm|ss}/pokemon/{id}/`
   - CoupCritique : `https://coupcritique.fr/pokedex/{id}/sets` (FR — conversion noms FR→EN via i18n `data` package)
2. Format brut Showdown text (copie dex `Import to PS!`) → parsé via `importShowdownTeam` (plan 081) → conversion JSON structure `OpSetEntry`
3. Agent produit `op-sets-draft.json` avec 1-3 sets par Pokemon
4. **Si parsing fail pour un Pokemon** : fallback set manuel basé sur movepool actuel `roster-poc.ts`, source = `"custom"`
5. Output garantit : chaque Pokemon roster a ≥1 set, chaque set conserve `source` + `sourceUrl`

### Étape 2 — Validation humaine
Critères validation avant renommage `op-sets-draft.json` → `op-sets.json` :
- (a) Chaque Pokemon roster a ≥1 set
- (b) Tous IDs moves/items/abilities sont normalisés kebab-case Showdown (`toShowdownId` réversible)
- (c) Chaque set `moveIds.length` ∈ [1, 4]
- (d) `statSpread` total ≤66 SP, max 32 par stat (déjà converti EV→SP via `evToSp` plan 081)
- (e) Pas de duplicate `id` (clé naturelle `{pokemonId}-{role}`)
Validateur humain = relit le draft, applique corrections, puis renomme.

### Étape 3 — Script analyse gap
`scripts/analyze-op-sets.ts` :
- Charge `op-sets.json`
- Pour chaque set, calcule `availability` :
  - `full` = tous moves+ability+item implémentés (registres data)
  - `partial` = au moins 1 move/ability/item manquant
  - `unavailable` = Pokemon non implémenté (impossible vu sourcing roster)
- Agrège :
  - **Top N moves manquants** (par fréquence d'apparition dans sets)
  - **Top N abilities manquantes** (idem)
  - **Top N items manquants** (idem)
  - Liste Pokemon dont 0 set est `full`
  - Stats globales : %sets `full`, %`partial`, total
- Output console + génère `docs/op-sets-gap-analysis.md`

### Étape 4 — Génération doc
`docs/op-sets-gap-analysis.md` structure obligatoire :
```markdown
# OP Sets Gap Analysis (généré YYYY-MM-DD)

## Stats globales
- Total sets : XXX
- Sets `full` : XX% (Y / XXX)
- Sets `partial` : XX%
- Pokemon sans set `full` : XX / 81

## Top 20 moves manquants (par fréquence)
| Rank | Move | Sets impactés | Pokemon impactés | Urgence |
| 1 | leftovers-recovery | 23 | 18 | 🔥 High |
| ... | ... | ... | ... | ... |

## Top 10 abilities manquantes
| Rank | Ability | Sets impactés | Urgence |
...

## Top 10 items manquants
| Rank | Item | Sets impactés | Urgence |
...

## Pokemon sans set `full`
- charizard : 2 sets partial (manque item heavy-duty-boots + move taunt)
- ...

## Actions recommandées pour plan 083
- **+6 moves** (taunt, knock-off, u-turn, defog, stealth-rock, toxic-spikes) → +95% sets `full`
- **+2 items** (heavy-duty-boots, focus-sash) → +12% sets `full`
- **+3 abilities** (...) → +XX%
- **Total impact** : Y sets passent `partial` → `full` (Z%)
```

Colonne `Urgence` : 🔥 High (>15 sets), 🟡 Medium (5-15), 🟢 Low (<5).
Section "Actions recommandées" calculée par script (combine top moves + abilities + items qui maximisent passage `partial` → `full`).

### Étape 5 — Gate CI
- `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`
- Script `pnpm op-sets:analyze` exit 0 si :
  - JSON valide schema (chaque entry conforme `OpSetEntry`)
  - Chaque move/ability/item ID respecte kebab-case Showdown (`toShowdownId` réversible)
  - Aucun duplicate `id`
- Exit 1 si malformé. Script ne bloque pas sur IDs non implémentés (c'est le but : gap analysis).

---

## Critères d'acceptation (mesurables)

- [ ] `packages/data/op-sets/op-sets.json` créé, ≥81 sets (≥1 par Pokemon roster)
- [ ] Cible atteinte : ≥150 sets total
- [ ] Aucun duplicate `id` dans `op-sets.json`
- [ ] Tous IDs conformes kebab-case Showdown (réversible via `toShowdownId`)
- [ ] Chaque set : `moveIds.length` ∈ [1, 4], `statSpread` total ≤66 SP
- [ ] Script `pnpm op-sets:analyze` exit 0, produit `docs/op-sets-gap-analysis.md`
- [ ] Doc gap-analysis : 5 sections obligatoires (stats, top 20 moves, top 10 abilities, top 10 items, Pokemon sans `full`, actions recommandées plan 083), tables formatées Markdown, 0 warning lint Markdown
- [ ] Schema versionné (`schemaVersion: 1`)
- [ ] `packages/data/op-sets/README.md` documente sourcing et conventions
- [ ] CI gate verte
- [ ] **Décision humain post-082** : valider scope plan 083 (Roster Batch F) basé sur "Actions recommandées" doc

---

## Sourcing détaillé

### Smogon dex (anglais, gen 9 SV)
- URL pattern : `https://www.smogon.com/dex/sv/pokemon/{lowercase-id}/`
- Tiers à considérer : Ubers, OU, UU, RU, NU, PU (priorité Ubers/OU)
- Format text : copier "Showdown" button output

### CoupCritique (FR, communauté)
- URL : `https://coupcritique.fr/dresseur/equipes` (équipes top), `https://coupcritique.fr/pokedex/{id}/sets`
- Sets FR, équipes RMT
- Convention : nature/move/talent FR → conversion EN nécessaire

### Smogon Archives older gens (RBY/BW2/SM)
- URL : `https://www.smogon.com/dex/rb/pokemon/{id}/` (Gen 1)
- Pour mons hors OU SV (ex: Farfetch'd, Parasect), Gen 5/6 PU peut être seule source

### Pas de sourcing
- VGC/Doubles (singles only)
- Random Battles
- Cap meta (hors Pokemon canon)

---

## Risques

- **Sourcing incomplet** : certains Pokemon roster (genre Farfetch'd, Mr. Mime, Parasect) ont peu de sets compétitifs. Fallback : créer 1 set custom basé sur movepool actuel roster.
- **Champions divergence** : sets Smogon référencent items/moves SV (Heavy-Duty Boots, Tera, etc.) qui peuvent ne pas exister Champions. Solution : garder l'ID Showdown même si absent — analyse plan 082 le flagge comme `partial`, c'est le but.
- **Subjectivité curation** : "OP set" est subjectif. Reco : prioriser sets avec usage stats (Smogon OU usage > 5%) sinon CoupCritique top RMT.
- **Volume sourcing** : 81 mons × 3 sets = 243 fetch. Agent `data-miner` bien préparé.

---

## Hors scope (plans ultérieurs)

- **Loader runtime** + `OpSetRegistry` (plan 084)
- **`generateRandomTeam(format)`** (plan 084)
- **Builder UI "Apply set"** (plan 085)
- **Curation continue** post-plan 083 (chaque nouveau move/ability implémenté → re-analyze)

---

## Décisions tranchées (suggestions plan-reviewer validées)

1. **Storage path** : `packages/data/op-sets/op-sets.json` (séparé de `reference/`). Symétrie data brute/data générée.
2. **Délégation curation** : `data-miner` agent fetch automatique → `op-sets-draft.json` → humain review → renomme `op-sets.json`. Chaque set conserve `source` + `sourceUrl` traçabilité.
3. **Champions alignement** : on accepte sets référencant items/moves/abilities Champions ne fournit pas. Plan 082 marque `partial`, plan 084 filtre runtime. Data brute reste fidèle aux sets Smogon réels.
4. **Niveau cible** : 1 set min obligatoire par mon (81 min sécurité) + 0-2 alt. Cible globale **150-200 sets**. Priorité sourcing : Smogon OU usage > 5% → fallback CoupCritique → fallback custom basé movepool actuel.
