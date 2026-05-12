# Implémentations — Pokemon Tactics

> Document vivant maintenu par `doc-keeper` après chaque plan.
> PMDCollab = animations disponibles dans SpriteCollab pour les animations utilisées :
> Animations requises (tous) : Idle, Walk, Attack, Shoot, Charge, Hop, Hurt, Faint, Sleep.
> Animation requise (type Vol uniquement) : FlapAround → synthèse `FlyingIdle`.

---

## Récapitulatif

> Pool = ce qui est disponible pour Gen 1 dans la référence Champions (Gen 9). Objets = total référence (combat-relevant à évaluer au cas par cas).

| Catégorie | Implémenté | Pool disponible | Commentaire |
|---|---|---|---|
| Pokemon | 81 / 151 | 151 Gen 1 | Contrainte Gen 1 (décision #92) — Gen 2+ en Phase 9. Formes non-finales retirées du roster Batch A. Haunter retiré post-Batch C (sprites conservés). |
| Attaques | 143 | 481 | Moves accessibles aux 151 Gen 1 (level-up + TM + tutor, données Gen 9/Champions) |
| Talents | 52 | 114 | Talents portés par au moins un des 151 Gen 1 |
| Objets tenus | 12 | ~159 heldItems | 173 heldItems − ~14 items Pokemon-spécifiques Gen 2-9 (orbes légendaires, drives Genesect, nectars Oricorio…). Méga-pierres (49) → Phase 9. |

---

## Pokemon (Gen 1 — 151)

> **PMDCollab** (source : SpriteCollab tracker.json, vérifié mai 2026) :
> Animations requises : Idle, Walk, Attack, Shoot, Charge, Hop, Hurt, Faint, Sleep.
> Pour les Pokemon de **type Vol** seulement : FlapAround requis pour synthétiser `FlyingIdle` (animation de vol au sol/eau).
> Fallbacks : Faint → freeze Idle · Shoot → Attack (Clefairy/Clefable) · FlyingIdle absent (type Vol) → Walk.
> `✓` = ok · `⚠️ Faint abs.` = Faint manquant (freeze Idle au KO) · `⚠️ Shoot+Faint abs.` = 7/9 ok · `⚠️ Vol : FlyingIdle abs.` = type Vol sans FlapAround (Walk en fallback vol)

**PMDCollab résumé** : 151/151 utilisables avec fallbacks. Faint absent sur 124. Pour les 19 Pokemon de type Vol : FlyingIdle synthétisable uniquement si FlapAround présent — absent sur 14 d'entre eux (Walk en fallback).

| N° | ID | Nom FR | Types | ✓ | Talent | PMDCollab | Commentaire |
|---|---|---|---|---|---|---|---|
| 001 | bulbasaur | Bulbizarre | Plante/Poison | ✓ | overgrow | ✓ | |
| 002 | ivysaur | Herbizarre | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 003 | venusaur | Florizarre | Plante/Poison | ✓ | overgrow | ⚠️ Faint abs. | Méga disponible |
| 004 | charmander | Salamèche | Feu | ✓ | blaze | ✓ | |
| 005 | charmeleon | Reptincel | Feu | ✗ | | ✓ | |
| 006 | charizard | Dracaufeu | Feu/Vol | ✓ | blaze | ✓ mais FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 007 | squirtle | Carapuce | Eau | ✓ | torrent | ✓ | |
| 008 | wartortle | Carabaffe | Eau | ✗ | | ⚠️ Faint abs. | |
| 009 | blastoise | Tortank | Eau | ✓ | torrent | ⚠️ Faint abs. | Méga disponible |
| 010 | caterpie | Chenipan | Insecte | ✗ | | ⚠️ Faint abs. | |
| 011 | metapod | Chrysacier | Insecte | ✗ | | ⚠️ Faint abs. | |
| 012 | butterfree | Papilusion | Insecte/Vol | ✓ | shield-dust | ⚠️ Faint abs. (FlyingIdle ✓) | |
| 013 | weedle | Aspicot | Insecte/Poison | ✗ | | ⚠️ Faint abs. | |
| 014 | kakuna | Coconfort | Insecte/Poison | ✗ | | ⚠️ Faint abs. | |
| 015 | beedrill | Dardargnan | Insecte/Poison | ✓ | swarm | ⚠️ Faint abs. | Méga disponible |
| 016 | pidgey | Roucool | Normal/Vol | ✓ | keen-eye | ✓✓ complet | |
| 017 | pidgeotto | Roucoups | Normal/Vol | ✗ | | ⚠️ Faint abs. (FlyingIdle ✓) | |
| 018 | pidgeot | Roucarnage | Normal/Vol | ✓ | keen-eye | ⚠️ Faint abs. (FlyingIdle ✓) | Méga disponible |
| 019 | rattata | Rattata | Normal | ✗ | | ⚠️ Faint abs. | |
| 020 | raticate | Rattatac | Normal | ✓ | — | ⚠️ Faint abs. | inner-focus stub |
| 021 | spearow | Piafabec | Normal/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 022 | fearow | Rapasdepic | Normal/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | inner-focus stub |
| 023 | ekans | Abo | Poison | ✗ | | ⚠️ Faint abs. | |
| 024 | arbok | Arbok | Poison | ✓ | intimidate | ⚠️ Faint abs. | |
| 025 | pikachu | Pikachu | Électrique | ✓ | static | ✓ | |
| 026 | raichu | Raichu | Électrique | ✓ | lightning-rod | ✓ | Méga disponible |
| 027 | sandshrew | Sabelette | Sol | ✓ | sand-veil | ✓ | |
| 028 | sandslash | Sablaireau | Sol | ✓ | sand-veil | ✓ | |
| 029 | nidoran-f | Nidoran♀ | Poison | ✗ | | ⚠️ Faint abs. | |
| 030 | nidorina | Nidorina | Poison | ✗ | | ⚠️ Faint abs. | |
| 031 | nidoqueen | Nidoqueen | Poison/Sol | ✓ | poison-point | ⚠️ Faint abs. | |
| 032 | nidoran-m | Nidoran♂ | Poison | ✓ | poison-point | ⚠️ Faint abs. | |
| 033 | nidorino | Nidorino | Poison | ✗ | | ⚠️ Faint abs. | |
| 034 | nidoking | Nidoking | Poison/Sol | ✓ | poison-point | ⚠️ Faint abs. | |
| 035 | clefairy | Mélofée | Fée | ✗ | | ⚠️ Shoot+Faint abs. | |
| 036 | clefable | Mélodelfe | Fée | ✓ | magic-guard | ⚠️ Shoot+Faint abs. | Méga disponible |
| 037 | vulpix | Goupix | Feu | ✗ | | ✓ | |
| 038 | ninetales | Feunard | Feu | ✓ | flash-fire | ✓ | |
| 039 | jigglypuff | Rondoudou | Normal/Fée | ✓ | cute-charm | ✓ | |
| 040 | wigglytuff | Grodoudou | Normal/Fée | ✓ | cute-charm | ⚠️ Faint abs. | |
| 041 | zubat | Nosferapti | Poison/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 042 | golbat | Nosferalto | Poison/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | inner-focus stub |
| 043 | oddish | Mystherbe | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 044 | gloom | Ortide | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 045 | vileplume | Rafflesia | Plante/Poison | ✓ | effect-spore | ⚠️ Faint abs. | |
| 046 | paras | Paras | Insecte/Plante | ✗ | | ⚠️ Faint abs. | |
| 047 | parasect | Parasect | Insecte/Plante | ✓ | effect-spore | ⚠️ Faint abs. | |
| 048 | venonat | Mimitoss | Insecte/Poison | ✗ | | ✓ | |
| 049 | venomoth | Aéromite | Insecte/Poison | ✓ | compound-eyes | ⚠️ Faint abs. | |
| 050 | diglett | Taupiqueur | Sol | ✗ | | ⚠️ Faint abs. | |
| 051 | dugtrio | Triopikeur | Sol | ✓ | sand-veil | ⚠️ Faint abs. | |
| 052 | meowth | Miaouss | Normal | ✓ | technician | ✓ | |
| 053 | persian | Persian | Normal | ✓ | technician | ⚠️ Faint abs. | |
| 054 | psyduck | Psykokwak | Eau | ✗ | | ⚠️ Faint abs. | |
| 055 | golduck | Akwakwak | Eau | ✓ | cloud-nine | ⚠️ Faint abs. | |
| 056 | mankey | Férosinge | Combat | ✗ | | ⚠️ Faint abs. | |
| 057 | primeape | Colossinge | Combat | ✓ | vital-spirit | ⚠️ Faint abs. | |
| 058 | growlithe | Caninos | Feu | ✓ | intimidate | ⚠️ Faint abs. | |
| 059 | arcanine | Arcanin | Feu | ✓ | intimidate | ⚠️ Faint abs. | |
| 060 | poliwag | Ptitard | Eau | ✗ | | ⚠️ Faint abs. | |
| 061 | poliwhirl | Têtarte | Eau | ✗ | | ⚠️ Faint abs. | |
| 062 | poliwrath | Tartard | Eau/Combat | ✓ | water-absorb | ⚠️ Faint abs. | |
| 063 | abra | Abra | Psy | ✓ | synchronize | ✓ | |
| 064 | kadabra | Kadabra | Psy | ✗ | | ⚠️ Faint abs. | |
| 065 | alakazam | Alakazam | Psy | ✓ | magic-guard | ⚠️ Faint abs. | Méga disponible |
| 066 | machop | Machoc | Combat | ✓ | guts | ✓ | |
| 067 | machoke | Machopeur | Combat | ✗ | | ⚠️ Faint abs. | |
| 068 | machamp | Mackogneur | Combat | ✓ | no-guard | ⚠️ Faint abs. | |
| 069 | bellsprout | Chétiflor | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 070 | weepinbell | Boustiflor | Plante/Poison | ✗ | | ⚠️ Faint abs. | |
| 071 | victreebel | Empiflor | Plante/Poison | ✓ | chlorophyll | ⚠️ Faint abs. | Méga disponible. chlorophyll stub Phase 9 (météo). |
| 072 | tentacool | Tentacool | Eau/Poison | ✓ | clear-body | ⚠️ Faint abs. | |
| 073 | tentacruel | Tentacruel | Eau/Poison | ✓ | clear-body | ⚠️ Faint abs. | |
| 074 | geodude | Racaillou | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 075 | graveler | Gravalanch | Roche/Sol | ✗ | | ⚠️ Faint abs. | |
| 076 | golem | Grolem | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 077 | ponyta | Ponyta | Feu | ✗ | | ✓ | |
| 078 | rapidash | Galopa | Feu | ✓ | flash-fire | ⚠️ Faint abs. | |
| 079 | slowpoke | Ramoloss | Eau/Psy | ✗ | | ⚠️ Faint abs. | |
| 080 | slowbro | Flagadoss | Eau/Psy | ✓ | own-tempo | ⚠️ Faint abs. | Méga disponible |
| 081 | magnemite | Magnéti | Électrique/Acier | ✓ | magnet-pull | ⚠️ Faint abs. | |
| 082 | magneton | Magnéton | Électrique/Acier | ✓ | magnet-pull | ⚠️ Faint abs. | |
| 083 | farfetch-d | Canarticho | Normal/Vol | ✓ | — | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | inner-focus stub |
| 084 | doduo | Doduo | Normal/Vol | ✗ | | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 085 | dodrio | Dodrio | Normal/Vol | ✓ | early-bird | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 086 | seel | Otaria | Eau | ✓ | thick-fat | ⚠️ Faint abs. | |
| 087 | dewgong | Lamantine | Eau/Glace | ✓ | thick-fat | ⚠️ Faint abs. | |
| 088 | grimer | Tadmorv | Poison | ✗ | | ⚠️ Faint abs. | |
| 089 | muk | Grotadmorv | Poison | ✓ | poison-touch | ⚠️ Faint abs. | |
| 090 | shellder | Kokiyas | Eau | ✗ | | ⚠️ Faint abs. | |
| 091 | cloyster | Crustabri | Eau/Glace | ✓ | shell-armor | ⚠️ Faint abs. | |
| 092 | gastly | Fantominus | Spectre/Poison | ✓ | levitate | ⚠️ Faint abs. | |
| 093 | haunter | Spectrum | Spectre/Poison | ✗ | | ⚠️ Faint abs. | Retiré du roster post-Batch C (sprites conservés sur disque) |
| 094 | gengar | Ectoplasma | Spectre/Poison | ✓ | cursed-body | ✓ | Méga disponible |
| 095 | onix | Onix | Roche/Sol | ✓ | sturdy | ⚠️ Faint abs. | |
| 096 | drowzee | Soporifik | Psy | ✗ | | ⚠️ Faint abs. | |
| 097 | hypno | Hypnomade | Psy | ✓ | insomnia | ⚠️ Faint abs. | |
| 098 | krabby | Krabby | Eau | ✗ | | ⚠️ Faint abs. | |
| 099 | kingler | Krabboss | Eau | ✓ | hyper-cutter | ⚠️ Faint abs. | |
| 100 | voltorb | Voltorbe | Électrique | ✗ | | ✓ | |
| 101 | electrode | Électrode | Électrique | ✓ | static | ⚠️ Faint abs. | |
| 102 | exeggcute | Noeunoeuf | Plante/Psy | ✗ | | ⚠️ Faint abs. | |
| 103 | exeggutor | Noadkoko | Plante/Psy | ✓ | — | ⚠️ Faint abs. | chlorophyll reporté Phase 9 (météo) |
| 104 | cubone | Osselait | Sol | ✗ | | ✓ | |
| 105 | marowak | Ossatueur | Sol | ✓ | rock-head | ⚠️ Faint abs. | |
| 106 | hitmonlee | Kicklee | Combat | ✓ | limber | ⚠️ Faint abs. | |
| 107 | hitmonchan | Tygnon | Combat | ✓ | iron-fist | ⚠️ Faint abs. | |
| 108 | lickitung | Excelangue | Normal | ✓ | own-tempo | ⚠️ Faint abs. | |
| 109 | koffing | Smogo | Poison | ✗ | | ⚠️ Faint abs. | |
| 110 | weezing | Smogogo | Poison | ✓ | levitate | ⚠️ Faint abs. | |
| 111 | rhyhorn | Rhinocorne | Sol/Roche | ✗ | | ⚠️ Faint abs. | |
| 112 | rhydon | Rhinoféros | Sol/Roche | ✓ | lightning-rod | ⚠️ Faint abs. | |
| 113 | chansey | Leveinard | Normal | ✓ | natural-cure | ⚠️ Faint abs. | |
| 114 | tangela | Saquedeneu | Plante | ✓ | chlorophyll | ⚠️ Faint abs. | chlorophyll stub Phase 9 (météo) |
| 115 | kangaskhan | Kangourex | Normal | ✓ | early-bird | ⚠️ Faint abs. | Méga disponible |
| 116 | horsea | Hypotrempe | Eau | ✗ | | ⚠️ Faint abs. | |
| 117 | seadra | Hypocéan | Eau | ✓ | swift-swim | ⚠️ Faint abs. | swift-swim stub Phase 9 (météo) |
| 118 | goldeen | Poissirène | Eau | ✗ | | ⚠️ Faint abs. | |
| 119 | seaking | Poissoroy | Eau | ✓ | water-veil | ⚠️ Faint abs. | |
| 120 | staryu | Stari | Eau | ✗ | | ⚠️ Faint abs. | |
| 121 | starmie | Staross | Eau/Psy | ✓ | natural-cure | ⚠️ Faint abs. | Méga disponible |
| 122 | mr-mime | M. Mime | Psy/Fée | ✓ | filter | ⚠️ Faint abs. | |
| 123 | scyther | Insécateur | Insecte/Vol | ✓ | technician | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | |
| 124 | jynx | Lippoutou | Glace/Psy | ✓ | oblivious | ⚠️ Faint abs. | |
| 125 | electabuzz | Élektek | Électrique | ✓ | static | ⚠️ Faint abs. | |
| 126 | magmar | Magmar | Feu | ✓ | flame-body | ⚠️ Faint abs. | |
| 127 | pinsir | Scarabrute | Insecte | ✓ | moxie | ⚠️ Faint abs. | Méga disponible |
| 128 | tauros | Tauros | Normal | ✓ | intimidate | ⚠️ Faint abs. | |
| 129 | magikarp | Magicarpe | Eau | ✗ | | ⚠️ Faint abs. | |
| 130 | gyarados | Léviator | Eau/Vol | ✓ | moxie | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 131 | lapras | Lokhlass | Eau/Glace | ✓ | water-absorb | ⚠️ Faint abs. | |
| 132 | ditto | Métamorph | Normal | ✗ | | ⚠️ Faint abs. | |
| 133 | eevee | Évoli | Normal | ✓ | adaptability | ✓ | |
| 134 | vaporeon | Aquali | Eau | ✓ | water-absorb | ⚠️ Faint abs. | |
| 135 | jolteon | Voltali | Électrique | ✓ | volt-absorb | ✓ | |
| 136 | flareon | Pyroli | Feu | ✓ | flash-fire | ✓ | |
| 137 | porygon | Porygon | Normal | ✓ | trace | ⚠️ Faint abs. | |
| 138 | omanyte | Amonita | Roche/Eau | ✗ | | ⚠️ Faint abs. | |
| 139 | omastar | Amonistar | Roche/Eau | ✓ | swift-swim | ⚠️ Faint abs. | |
| 140 | kabuto | Kabuto | Roche/Eau | ✗ | | ✓ | |
| 141 | kabutops | Kabutops | Roche/Eau | ✓ | battle-armor | ⚠️ Faint abs. | |
| 142 | aerodactyl | Ptéra | Roche/Vol | ✓ | rock-head | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 143 | snorlax | Ronflex | Normal | ✓ | thick-fat | ⚠️ Faint abs. | |
| 144 | articuno | Artikodin | Glace/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Légendaire |
| 145 | zapdos | Électhor | Électrique/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Légendaire |
| 146 | moltres | Sulfura | Feu/Vol | ✓ | pressure | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Légendaire |
| 147 | dratini | Minidraco | Dragon | ✗ | | ⚠️ Faint abs. | |
| 148 | dragonair | Draco | Dragon | ✗ | | ⚠️ Faint abs. | |
| 149 | dragonite | Dracolosse | Dragon/Vol | ✓ | multiscale | ⚠️ Faint abs. + FlyingIdle abs. (Walk fallback vol) | Méga disponible |
| 150 | mewtwo | Mewtwo | Psy | ✓ | pressure | ✓ | Méga disponible, Légendaire |
| 151 | mew | Mew | Psy | ✓ | — | ✓ | Mythique. inner-focus stub. |

### Méga-Évolutions Gen 1

> Mégas en reference : 21 formes. Mégas "Champions" (raichu, clefable, victreebel, starmie, dragonite) = format Pokémon Champions uniquement, pas dans les jeux principaux.
> **Conclusion PMDCollab** : aucun Méga n'a de sprites complets. 6 ont des fichiers partiels (pending review). Ne pas planifier de Méga avant que la situation PMDCollab s'améliore.

| ID | Base | Types Méga | Officiel | PMDCollab | Commentaire |
|---|---|---|---|---|---|
| venusaur-mega | Florizarre | Plante/Poison | ✓ | ✗ aucun fichier | |
| charizard-mega-x | Dracaufeu | Feu/Dragon | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| charizard-mega-y | Dracaufeu | Feu/Vol | ✓ | ✗ aucun fichier | |
| blastoise-mega | Tortank | Eau | ✓ | ✗ aucun fichier | |
| beedrill-mega | Dardargnan | Insecte/Poison | ✓ | ✗ aucun fichier | |
| pidgeot-mega | Roucarnage | Normal/Vol | ✓ | ✗ aucun fichier | |
| raichu-mega-x | Raichu | Électrique | ✗ Champions | ✗ aucun fichier | Non-officiel |
| raichu-mega-y | Raichu | Électrique/Psy | ✗ Champions | ✗ aucun fichier | Non-officiel |
| clefable-mega | Mélodelfe | Fée | ✗ Champions | ✗ aucun fichier | Non-officiel |
| alakazam-mega | Alakazam | Psy | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| victreebel-mega | Empiflor | Plante/Poison | ✗ Champions | ✗ n'existe pas dans SpriteCollab | Non-officiel |
| slowbro-mega | Flagadoss | Eau/Psy | ✓ | ⚠️ 6/10 pending | Hurt+Faint+Sleep+FlapAround absents |
| gengar-mega | Ectoplasma | Spectre/Poison | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| kangaskhan-mega | Kangourex | Normal | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| starmie-mega | Staross | Eau/Psy | ✗ Champions | ✗ aucun fichier | Non-officiel |
| pinsir-mega | Scarabrute | Insecte/Vol | ✓ | ✗ aucun fichier | |
| gyarados-mega | Léviator | Eau/Ténèbres | ✓ | ✗ aucun fichier | |
| aerodactyl-mega | Ptéra | Roche/Vol | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |
| dragonite-mega | Dracolosse | Dragon/Vol | ✗ Champions | ✗ aucun fichier | Non-officiel |
| mewtwo-mega-x | Mewtwo | Psy/Combat | ✓ | ✗ aucun fichier | |
| mewtwo-mega-y | Mewtwo | Psy | ✓ | ⚠️ 8/10 pending | Faint+FlapAround absents |

---

## Attaques (143 implémentées)


> Pattern = ciblage tactique dans le jeu (custom, pas le comportement original Pokemon).

| Nom FR | ID | Type | Cat | Puiss | Préc | PP | Pattern | Effets notables |
|---|---|---|---|---|---|---|---|---|
| Acide | acid | Poison | Spé | 40 | 100 | 30 | cône r2 | −1 Déf Spé cibles |
| Hâte | agility | Psy | Statut | — | — | 30 | self | +2 Vit |
| Onde Boréale | aurora-beam | Glace | Spé | 65 | 100 | 20 | ligne r3 | −1 Atk cibles |
| Morsure | bite | Ténèbres | Phys | 60 | 100 | 25 | mêlée | |
| Blizzard | blizzard | Glace | Spé | 110 | 70 | 5 | cône r3 | Gel 10% |
| Plaquage | body-slam | Normal | Phys | 85 | 100 | 15 | mêlée | Para 30% |
| Bulles d'O | bubble-beam | Eau | Spé | 65 | 100 | 20 | cône r2 | |
| Gonflette | bulk-up | Combat | Statut | — | — | 20 | self | +1 Atk, +1 Déf |
| Plénitude | calm-mind | Psy | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé |
| Choc Mental | confusion | Psy | Spé | 50 | 100 | 25 | single r4 | |
| Riposte | counter | Combat | Phys | — | 100 | 20 | self | Défensif : renvoie dégâts physiques ×2 |
| Boul'Armure | defense-curl | Normal | Statut | — | — | 40 | self | +1 Déf |
| Détection | detect | Combat | Statut | — | — | 5 | self | Défensif : immunité dégâts 1 tour |
| Double Pied | double-kick | Combat | Phys | 30×2 | 100 | 30 | mêlée | 2 coups |
| Reflet | double-team | Normal | Statut | — | — | 15 | self | +1 Esquive |
| Draco-Souffle | dragon-breath | Dragon | Spé | 60 | 100 | 20 | cône r2 | Para 30% |
| Draco-Queue | dragon-tail | Dragon | Phys | 60 | 90 | 10 | slash | Knockback 1 |
| Séisme | earthquake | Sol | Phys | 100 | 100 | 10 | zone r2 | Friendly fire |
| Flammèche | ember | Feu | Spé | 40 | 100 | 25 | single r3 | Brûl 10% |
| Ténacité | endure | Normal | Statut | — | — | 10 | self | Défensif : survive à 1 PV min |
| Roue de Feu | flame-wheel | Feu | Phys | 60 | 100 | 25 | dash r3 | Brûl 10% |
| Lance-Flammes | flamethrower | Feu | Spé | 90 | 100 | 15 | ligne r3 | Brûl 10% |
| Flash | flash | Normal | Statut | — | 100 | 20 | zone r2 | −1 Préc cibles |
| Combo-Griffe | fury-swipes | Normal | Phys | 18 | 80 | 15 | mêlée | 2-5 coups |
| Rugissement | growl | Normal | Statut | — | 100 | 40 | cône r3 | −1 Atk cibles |
| Tornade | gust | Vol | Spé | 40 | 100 | 35 | cône r3 | |
| Coup d'Boule | headbutt | Normal | Phys | 70 | 100 | 15 | mêlée | |
| Ultralaser | hyper-beam | Normal | Spé | 150 | 90 | 5 | ligne r5 | Recharge 1 tour |
| Hypnose | hypnosis | Psy | Statut | — | 60 | 20 | single r3 | Sommeil 100% |
| Vent Glace | icy-wind | Glace | Spé | 55 | 95 | 15 | cône r2 | −1 Vit cibles |
| Mur de Fer | iron-defense | Acier | Statut | — | — | 15 | self | +2 Déf |
| Poing Karaté | karate-chop | Combat | Phys | 50 | 100 | 25 | mêlée | Critique élevé |
| Télékinésie | kinesis | Psy | Statut | — | 80 | 15 | single r3 | −1 Préc |
| Vampigraine | leech-seed | Plante | Statut | — | 90 | 10 | single r3 | Drain PV/tour tant que ≤5 tiles |
| Léchouille | lick | Spectre | Phys | 30 | 100 | 30 | mêlée | Para 30% |
| Ampleur | magnitude | Sol | Phys | var | 100 | 30 | zone r2 | Friendly fire, puissance variable |
| Ultimapoing | mega-punch | Normal | Phys | 80 | 85 | 20 | mêlée | |
| Lilliput | minimize | Normal | Statut | — | — | 10 | self | +2 Esquive |
| Ombre Nocturne | night-shade | Spectre | Spé | var | 100 | 15 | croix 3×3 | Dégâts = niveau |
| Dard-Venin | poison-sting | Poison | Phys | 15 | 100 | 35 | mêlée | Poison 30% |
| Écras'Face | pound | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Abri | protect | Normal | Statut | — | — | 5 | self | Défensif : immunité dégâts 1 tour |
| Rafale Psy | psybeam | Psy | Spé | 65 | 100 | 20 | ligne r5 | |
| Vive-Attaque | quick-attack | Normal | Phys | 40 | 100 | 30 | dash r2 | |
| Tranch'Herbe | razor-leaf | Plante | Phys | 55 | 95 | 25 | slash | Critique élevé |
| Hurlement | roar | Normal | Statut | — | — | 20 | cône r3 | −1 Atk cibles |
| Éclate-Roc | rock-smash | Combat | Phys | 40 | 100 | 15 | croix 3×3 | −1 Déf cibles |
| Jet-Pierres | rock-throw | Roche | Phys | 50 | 90 | 15 | single r3 | |
| Roulade | rollout | Roche | Phys | 30 | 90 | 20 | dash r4 | |
| Jet de Sable | sand-attack | Sol | Statut | — | 100 | 15 | cône r2 | −1 Préc |
| Griffe | scratch | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Frappe Atlas | seismic-toss | Combat | Phys | var | 100 | 20 | mêlée | Dégâts = niveau |
| Berceuse | sing | Normal | Statut | — | 55 | 15 | cône r3 | Sommeil 100% |
| Tranche | slash | Normal | Phys | 70 | 100 | 20 | slash | Critique élevé |
| Poudre Dodo | sleep-powder | Plante | Statut | — | 75 | 15 | zone r1 | Sommeil 75% |
| Bombe Beurk | sludge-bomb | Poison | Spé | 90 | 100 | 10 | blast r2-4/r1 | Poison 30% |
| Brouillard | smokescreen | Normal | Statut | — | 100 | 20 | zone r1 | −1 Préc cibles |
| Stockage | stockpile | Normal | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé |
| Ultrason | supersonic | Normal | Statut | — | 55 | 20 | single r3 | Confusion 100% |
| Danse Lames | swords-dance | Normal | Statut | — | — | 20 | self | +2 Atk |
| Charge | tackle | Normal | Phys | 40 | 100 | 35 | mêlée | |
| Cage Éclair | thunder-wave | Électrique | Statut | — | 90 | 20 | single r3 | Para 100% |
| Tonnerre | thunderbolt | Électrique | Spé | 90 | 100 | 15 | ligne r4 | Para 10% |
| Toxik | toxic | Poison | Statut | — | 90 | 10 | single r2 | Poison fort 100% |
| Électacle | volt-tackle | Électrique | Phys | 120 | 100 | 15 | dash r3 | |
| Pistolet à O | water-gun | Eau | Spé | 40 | 100 | 25 | single r3 | |
| Cru-Ailes | wing-attack | Vol | Phys | 60 | 100 | 35 | slash | |
| Repli | withdraw | Eau | Statut | — | — | 40 | self | +1 Déf, +1 DéfSpé |
| Ligotage | wrap | Normal | Phys | 15 | 90 | 20 | mêlée | Piégé + drain PV/tour |
| Armure Acide | acid-armor | Poison | Statut | — | — | 20 | self | +2 Déf |
| Tranche-Air | air-slash | Vol | Spé | 75 | 95 | 15 | slash | Flinch 30% |
| Amnésie | amnesia | Psy | Statut | — | — | 20 | self | +2 DéfSpé |
| Aqua-Queue | aqua-tail | Eau | Phys | 90 | 90 | 10 | mêlée | |
| Casse-Brique | brick-break | Combat | Phys | 75 | 100 | 15 | mêlée | |
| Rayon Chargé | charge-beam | Électrique | Spé | 50 | 90 | 10 | ligne r3 | +1 AtqSpé 70% |
| Close Combat | close-combat | Combat | Phys | 120 | 100 | 5 | mêlée | −1 Déf, −1 DéfSpé attaquant |
| Mâchouille | crunch | Ténèbres | Phys | 80 | 100 | 15 | mêlée | −1 Déf 20% |
| Draco-Griffe | dragon-claw | Dragon | Phys | 80 | 100 | 15 | mêlée | |
| Danse Draco | dragon-dance | Dragon | Statut | — | — | 20 | self | +1 Atk, +1 Vit |
| Dynamopoing | dynamic-punch | Combat | Phys | 100 | 50 | 5 | mêlée | Confusion 100% (acc parfaite avec No-Guard) |
| Vitesse Extrême | extreme-speed | Normal | Phys | 80 | 100 | 5 | dash r2 | |
| Déflagration | fire-blast | Feu | Spé | 110 | 85 | 5 | blast r3/r1 | Brûlure 10% |
| Tunnel de Flammes | flare-blitz | Feu | Phys | 120 | 100 | 15 | dash r3 | Brûlure 10%, recul 1/3 PV |
| Croissance | growth | Plante | Statut | — | — | 20 | self | +1 Atk, +1 AtqSpé |
| Hydrocanon | hydro-pump | Eau | Spé | 110 | 80 | 5 | ligne r4 | |
| Lance-Glace | ice-beam | Glace | Spé | 90 | 100 | 10 | ligne r4 | Gel 10% |
| Queue de Fer | iron-tail | Acier | Phys | 100 | 75 | 15 | mêlée | −1 Déf 30% |
| Éruption | lava-plume | Feu | Spé | 80 | 100 | 15 | zone r1 | Brûlure 30%, friendly fire |
| Colère | outrage | Dragon | Phys | 120 | 100 | 10 | mêlée | Confusion attaquant après (100%) |
| Tempête Florale | petal-blizzard | Plante | Phys | 90 | 100 | 15 | zone r2 | Friendly fire |
| Psyko | psychic | Psy | Spé | 90 | 100 | 10 | single r4 | −1 DéfSpé 10% |
| Soin | recover | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| Repos | rest | Psy | Statut | — | — | 5 | self | Soigne 100% PV max + Sommeil 2 tours |
| Ball'Ombre | shadow-ball | Spectre | Spé | 80 | 100 | 15 | single r4 | −1 DéfSpé 20% |
| Surf | surf | Eau | Spé | 90 | 100 | 15 | zone r2 | Friendly fire |
| Synthèse | synthesis | Normal | Statut | — | — | 5 | self | Soigne 50% PV max |
| Tonnerre Vrai | thunder | Électrique | Spé | 110 | 70 | 10 | single r4 | Para 30% |
| Cascade | waterfall | Eau | Phys | 80 | 100 | 15 | dash r3 | Flinch 20% |
| Coup Croix | cross-chop | Combat | Phys | 100 | 80 | 5 | single r1 | Critique élevé (`critRatio: 1`) |
| Éboulement | rock-slide | Roche | Phys | 75 | 90 | 10 | cône r1–2 | |
| Onde Folie | confuse-ray | Spectre | Statut | — | 100 | 10 | single r1–3 | Confusion 100% |
| Boule Énergie | energy-ball | Plante | Spé | 90 | 100 | 10 | single r1–4 | |
| Osmerang | bonemerang | Sol | Phys | 50 | 90 | 10 | single r1 | 2 hits fixes |
| Flammepied | blaze-kick | Feu | Phys | 85 | 90 | 10 | single r1 | Critique élevé, brûlure 10% |
| Poing Éclair | thunder-punch | Électrique | Phys | 75 | 100 | 15 | single r1 | Paralysie 10%. Flag `punch`. |
| Poing Glace | ice-punch | Glace | Phys | 75 | 100 | 15 | single r1 | Gel 10%. Flag `punch`. |
| Poing de Feu | fire-punch | Feu | Phys | 75 | 100 | 15 | single r1 | Brûlure 10%. Flag `punch`. |
| Damoclès | double-edge | Normal | Phys | 120 | 100 | 15 | single r1 | Recul 1/3 HP max |
| Feu Follet | will-o-wisp | Feu | Statut | — | 85 | 15 | single r1–3 | Brûlure 100% |
| Machination | nasty-plot | Ténèbres | Statut | — | — | 20 | self | +2 AtqSpé |
| Cradovague | sludge-wave | Poison | Spé | 95 | 100 | 10 | zone r2 | Friendly fire, Poison 10% |
| Luminocanon | flash-cannon | Acier | Spé | 80 | 100 | 10 | ligne r3 | −1 DéfSpé cible 10% |
| Coup d'Jus | discharge | Électrique | Spé | 80 | 100 | 15 | zone r2 | Para 30%, friendly fire |
| Grincement | screech | Normal | Statut | — | 85 | 40 | single r1–3 | −2 Déf cible |
| Stalactite | icicle-spear | Glace | Phys | 25 | 100 | 30 | single r1 | 2–5 hits |
| Grobisou | lovely-kiss | Normal | Statut | — | 75 | 10 | single r1–3 | Sommeil 100% |
| Pince-Masse | crabhammer | Eau | Phys | 100 | 95 | 10 | single r1 | STAB, critique élevé (`critRatio: 1`) |
| Destruction | self-destruct | Normal | Phys | 200 | 100 | 5 | zone r2 | Attaquant KO après usage |
| Triplattaque | tri-attack | Normal | Spé | 80 | 100 | 10 | single r1–4 | Para 20% (Phase 4) |
| Verrouillage | lock-on | Normal | Statut | — | — | 5 | single r1–4 | Prochain move garanti (accuracy override 1 tour) |
| Pouvoir Lunaire | moonblast | Fée | Spé | 95 | 100 | 15 | single r1–4 | −1 AtqSpé cible 30% |
| Pouvoir Antique | ancient-power | Roche | Spé | 60 | 100 | 5 | single r1–3 | +1 toutes stats attaquant 10% (indépendant) |
| Exuviation | shell-smash | Normal | Statut | — | — | 15 | self | +2 Atk/AtqSpé/Vit, −1 Déf/DéfSpé |
| Crocs Venin | poison-fang | Poison | Phys | 50 | 100 | 15 | mêlée | Poison fort 50% (BadlyPoisoned) |
| Enroulement | coil | Poison | Statut | — | — | 20 | self | +1 Atk, +1 Déf, +1 Préc |
| Regard Médusant | glare | Normal | Statut | — | 100 | 30 | single r1–3 | Para 100% |
| Force Cosmique | cosmic-power | Psy | Statut | — | — | 20 | self | +1 Déf, +1 DéfSpé |
| Spore | spore | Plante | Statut | — | 100 | 15 | single r1 | Sommeil 100% |
| Lame Feuille | leaf-blade | Plante | Phys | 90 | 100 | 15 | slash | Critique élevé (`critRatio: 1`) |
| Picpic | drill-peck | Vol | Phys | 80 | 100 | 20 | slash | — |
| Barrière | barrier | Psy | Statut | — | — | 20 | self | +2 Déf |
| Vampirisme | leech-life | Insecte | Phys | 80 | 100 | 10 | mêlée | Drain : soigne attaquant = 50% dégâts |
| Méga-Sangsue | mega-drain | Plante | Spé | 40 | 100 | 15 | single r1–3 | Drain : soigne attaquant = 50% dégâts |
| Double Dard | twineedle | Insecte | Phys | 25×2 | 100 | 20 | mêlée | 2 hits, Poison 20% par hit |
| Aéropique | aerial-ace | Vol | Phys | 60 | — | 20 | slash | Touche garantie (`bypassAccuracy`) |
| Danse Plumes | feather-dance | Vol | Statut | — | 100 | 15 | single r1–3 | −2 Atk cible |
| Croc de Mort | hyper-fang | Normal | Phys | 80 | 90 | 15 | mêlée | |
| Papillodanse | quiver-dance | Insecte | Statut | — | — | 20 | self | +1 AtqSpé, +1 DéfSpé, +1 Vit |
| Atterrissage | roost | Vol | Statut | — | — | 5 | self | Soigne 50% PV max |

---

## Talents (52 implémentés)

| Talent | ID | Pokemon (roster) | Effet résumé |
|---|---|---|---|
| Engrais | overgrow | Bulbizarre | ×1.5 attaques Plante si PV ≤ 1/3 |
| Brasier | blaze | Salamèche | ×1.5 attaques Feu si PV ≤ 1/3 |
| Torrent | torrent | Carapuce | ×1.5 attaques Eau si PV ≤ 1/3 |
| Regard Vif | keen-eye | Roucool | Bloque baisses de Précision |
| Statik | static | Pikachu | Contact → Para adversaire 30% |
| Cran | guts | Machoc | ×1.5 attaques Phys si statut majeur |
| Synchro | synchronize | Abra | Renvoie Brûl/Para/Pois/PoisF à la source |
| Lévitation | levitate | Fantominus | Immunité Sol |
| Solidité | sturdy | Racaillou | (placeholder — survie à 1 PV) |
| Intimidation | intimidate | Caninos | Au début : −1 Atk ennemis adjacents (rayon 1) |
| Joli Sourire | cute-charm | Rondoudou | Contact → Attirance adversaire 30% (genre opposé) |
| Isograisse | thick-fat | Otaria | −50% dégâts Feu et Glace reçus |
| Rivalité | adaptability | Évoli | STAB = ×2 au lieu de ×1.5 |
| Corps Sain | clear-body | Tentacool | Bloque toutes les baisses de stats |
| Point Poison | poison-point | Nidoran♂ | Contact → Poison adversaire 30% |
| Technicien | technician | Miaouss | ×1.5 attaques de puissance ≤ 60 |
| Magnétisme | magnet-pull | Magnéti | Piège les Pokemon Acier adjacents |
| Voile Sable | sand-veil | Sabelette | (placeholder — bonus esquive sable) |
| Tempo Perso | own-tempo | Excelangue | Immunité Confusion et Intimidation |
| Matinale | early-bird | Kangourex | Durée Sommeil ÷ 2 |
| Para-Foudre | lightning-rod | Raichu | Immunité Électrique + +1 AtqSpé si Électrique reçu (redirect → plan dédié) |
| Garde Magique | magic-guard | Alakazam | Bloque tous dégâts indirects (brûlure, poison, vampigraine, recul Life Orb…) |
| Aucun Garde | no-guard | Mackogneur | Toutes attaques envoyées ET reçues ont 100% précision |
| Macho | moxie | Léviator | +1 Atk quand le porteur met un ennemi KO |
| Multiécaille | multiscale | Dracolosse | Divise par 2 les dégâts reçus si PV max |
| Absorb'Eau | water-absorb | Aquali | Immunité Eau + soigne +25% PV max si touché par move Eau |
| Torche | flash-fire | Pyroli | Immunité Feu + ×1.5 dégâts Feu après avoir reçu un move Feu |
| Absorb'Volt | volt-absorb | Voltali | Immunité Électrique + soigne +25% PV max si touché par move Électrique |
| Esprit Vital | vital-spirit | Colossinge | Immunité au sommeil |
| Insomnie | insomnia | Hypnomade | Immunité au sommeil |
| Corps Maudit | cursed-body | Ectoplasma | 30% chance confusion sur attaque contact reçue |
| Tête de Roc | rock-head | Ossatueur, Ptéra | Annule les dégâts de recul |
| Souplesse | limber | Kicklee | Immunité à la paralysie |
| Poing de Fer | iron-fist | Tygnon | ×1.2 dégâts moves avec flag `punch` |
| Soin Naturel | natural-cure | Staross | Soigne le statut majeur en fin de tour |
| Armure Dure | battle-armor | Kabutops | Immunité aux coups critiques |
| Pose Spore | effect-spore | Rafflesia | 30% chance sur contact reçu : Sommeil, Poison ou Para (1/3 chacun) |
| Ciel Gris | cloud-nine | Akwakwak | Supprime bonus/malus météo (stub Phase 4) |
| Coque Armure | shell-armor | Crustabri | Immunité aux coups critiques |
| Hyper Cutter | hyper-cutter | Krabboss | Bloque toutes les baisses d'Attaque |
| Flegmatique | oblivious | Lippoutou | Immunité à Attirance (Infatuation) |
| Corps Ardent | flame-body | Magmar | 30% chance Brûlure sur attaque contact reçue (sur l'attaquant) |
| Calque | trace | Porygon | Au combat : copie l'ability de l'ennemi le plus proche |
| Glissade | swift-swim | Amonistar | Double la vitesse sous pluie (stub Phase 4) |
| Contact Poison | poison-touch | Grotadmorv | 30% chance empoisonner ennemi quand move de contact (`onAfterDamageDealt`) |
| Filtre | filter | M. Mime | Réduit de 25% les dégâts reçus super-efficaces (`onDamageModify`) |
| Œil Composé | compound-eyes | Aéromite | ×1.3 précision de tous les moves (`accuracyMultiplier`) |
| Essaim | swarm | Dardargnan | ×1.5 attaques Insecte si PV ≤ 1/3 |
| Ignifu-Voile | water-veil | Poissoroy | Immunité Brûlure |
| Pression | pressure | Artikodin, Électhor, Sulfura, Mewtwo | Cible adverse dépense +50 CT par action utilisée contre le porteur (`targetedCtBonus`) |
| Suintement | shield-dust | Papilusion | Bloque les effets secondaires des moves ennemis (`onSecondaryEffectBlocked`) |
| Attention | inner-focus | Rattatac, Rapasdepic, Nosferalto, Canarticho, Mew | Stub — immunité flinch (pas de mécanique flinch dans le core Phase 4) |

---

## Objets Tenus (12 implémentés)

| Nom | ID | Effet résumé |
|---|---|---|
| Restes | leftovers | +1/16 PV max par tour |
| Orbe Vie | life-orb | ×1.3 dégâts, −1/10 PV max après attaque |
| Ceinture Choix | choice-band | ×1.5 Attaque Phys, verrouille l'attaque |
| Foulard Choix | choice-scarf | ×1.5 CT gain (vitesse), verrouille l'attaque |
| Filet Focus | focus-sash | Survit à 1 coup depuis PV max (1 PV restant) |
| Ceinture Expert | expert-belt | ×1.2 dégâts super-efficaces |
| Casque Gonflé | rocky-helmet | Attaquant au contact perd 1/6 PV max |
| Police Faiblesse | weakness-policy | +2 Atk et AtqSpé si touché super-efficacement (consommé) |
| Lentilles Portée | scope-lens | +1 stage critique |
| Baie Sitrus | sitrus-berry | Soigne 1/4 PV max si PV ≤ 50% (consommée) |
| Bottes Glissantes | heavy-duty-boots | Immunité effets de terrain (pièges, terrain) |
| Ballon Lumineux | light-ball | ×2 dégâts Pikachu uniquement |
