# Reflexion — Patterns d'attaque

> Document de travail pour determiner comment attribuer les patterns (targeting) aux attaques.
> Sert de reference au directeur creatif et a l'agent `move-pattern-designer`.

---

## 1. Philosophie generale

Le nom d'une attaque evoque une **image mentale**. Cette image doit se traduire en un **pattern de ciblage** coherent sur la grille tactique.

**Principe** : si un joueur lit le nom de l'attaque, il doit pouvoir deviner intuitivement sa forme sur le terrain.

---

## 2. Patterns disponibles

| Pattern    | Forme            | Parametres          | Quand l'utiliser                          |
| ---------- | ---------------- | ------------------- | ----------------------------------------- |
| **single** | 1 case           | `range: {min, max}` | Projectile cible, coup direct             |
| **line**   | Ligne droite     | `length`            | Rayon, laser, eclair, faisceau            |
| **cone**   | Eventail         | `range, width`      | Souffle, vent, voix, vague                |
| **cross**  | Croix (+)        | `range, size`       | Bombe, explosion, onde de choc a distance |
| **zone**   | Cercle self      | `radius`            | Seisme, onde centree sur soi              |
| **dash**   | Le lanceur fonce | `maxDistance`       | Charge, ruee, plaquage en mouvement       |
| **self**   | Soi-meme         | —                   | Buff, meditation, danse                   |

### Pattern : slash (arc frontal)

Plusieurs attaques evoquent un **mouvement de balayage** qui touche les 3 cases devant le lanceur (face + 2 perpendiculaires adjacentes). Exemples : Tranch'Herbe, Aile d'Acier, Queue de Fer, Coupe.

Pattern `slash` — aucun parametre, toujours 3 cases devant.

---

## 3. Regles d'attribution par mot-cle

### 3.1 Bombes et explosions → cross (portee + AoE)

Les mots **bombe**, **explosion**, **boule** evoquent un projectile qui explose a l'arrivee.

| Attaque             | Nom EN      | Mot-cle | Pattern | Portee | Taille |
| ------------------- | ----------- | ------- | ------- | ------ | ------ |
| Bombe-Beurk         | Sludge Bomb | bombe   | cross   | 2-4    | 3x3    |
| Ball'Ombre          | Shadow Ball | ball    | cross   | 2-4    | 3x3    |
| Bombe Oeuf          | Egg Bomb    | bombe   | cross   | 2-3    | 3x3    |
| Bomb-Beurk (poison) | Sludge Bomb | bombe   | cross   | 2-4    | 3x3    |

**Variantes possibles** :

- Rayon d'AoE 2 (r2 = 5x5 losange) pour les grosses explosions
- Rayon 1 (r1 = 3x3 croix) pour les petites bombes

### 3.2 Rayons et lasers → line

Les mots **rayon**, **laser**, **eclair**, **beam**, **faisceau** evoquent un trait rectiligne.

| Attaque       | Nom EN       | Mot-cle       | Pattern | Longueur |
| ------------- | ------------ | ------------- | ------- | -------- |
| Tonnerre      | Thunderbolt  | bolt (eclair) | line    | 4        |
| Psykoud'boul  | Psybeam      | beam          | line    | 5        |
| Lance-Flammes | Flamethrower | lance/thrower | line    | 3        |
| Laser Glace   | Ice Beam     | laser/beam    | line    | 3        |
| Rayon Aurore  | Aurora Beam  | beam          | line    | 3        |
| Ultralaser    | Hyper Beam   | laser/beam    | line    | 5        |

### 3.3 Souffles, vents et voix → cone

Les mots **souffle**, **vent**, **voix**, **chant**, **cri**, **hurlement** evoquent une dispersion en eventail.

| Attaque      | Nom EN        | Mot-cle            | Pattern   | Portee | Largeur |
| ------------ | ------------- | ------------------ | --------- | ------ | ------- |
| Dracosouffle | Dragon Breath | souffle/breath     | cone      | 1-2    | 3       |
| Vent Glace   | Icy Wind      | vent/wind          | cone      | 1-2    | 3       |
| Blizzard     | Blizzard      | (tempete de neige) | cone      | 1-3    | 3       |
| Berceuse     | Sing          | chant/sing         | cone      | 1-3    | 3       |
| Jet de Sable | Sand Attack   | jet (dispersion)   | cone      | 1-2    | 3       |
| Hurlement    | Roar          | hurlement/roar     | cone      | 1-3    | 3       |
| Brouillard   | Smokescreen   | brouillard         | zone self | —      | r1      |

> **Note** : Brouillard est une exception — ca se repand autour de soi plutot qu'en direction.

### 3.4 Coups physiques et morsures → single melee

Les mots **griffe**, **tranche**, **coup**, **morsure**, **croc**, **poing** evoquent un contact direct.

| Attaque     | Nom EN      | Pattern | Portee |
| ----------- | ----------- | ------- | ------ |
| Griffe      | Scratch     | single  | 1      |
| Morsure     | Bite        | single  | 1      |
| Ecras'Face  | Pound       | single  | 1      |
| Tete de Roc | Headbutt    | single  | 1      |
| Cru-Aile    | Wing Attack | single  | 1      |
| Tranche     | Karate Chop | single  | 1      |
| Plaquage    | Body Slam   | single  | 1      |

### 3.5 Charges et ruees → dash

Les mots **charge**, **ruee**, **course**, **tackle**, **wheel** evoquent le lanceur qui se deplace vers la cible.

| Attaque      | Nom EN       | Pattern            | Distance   |
| ------------ | ------------ | ------------------ | ---------- |
| Vive-Attaque | Quick Attack | dash               | 2          |
| Voltacle     | Volt Tackle  | dash               | 3          |
| Roue de Feu  | Flame Wheel  | dash               | 3          |
| Tunnel       | Rollout/Dig  | dash               | 4          |
| Charge       | Tackle       | single 1 ou dash 1 | a discuter |

> **Discussion** : Charge (Tackle) — actuellement `single range 1`. Pourrait-il etre un `dash 1` pour mieux representer le mouvement ?

### 3.6 Seismes et ondes → zone self

Les mots **seisme**, **magnitude**, **onde**, **vague** (quand centre sur soi).

| Attaque    | Nom EN      | Pattern | Rayon |
| ---------- | ----------- | ------- | ----- |
| Ampleur    | Magnitude   | zone    | r1    |
| Brouillard | Smokescreen | zone    | r1    |
| Seisme     | Earthquake  | zone    | r2    |

### 3.7 Tirs et projectiles → single ranged

Les mots **pistolet**, **tir**, **lancer**, **jet** (quand cible unique).

| Attaque      | Nom EN     | Pattern | Portee |
| ------------ | ---------- | ------- | ------ |
| Pistolet a O | Water Gun  | single  | 1-3    |
| Flammeche    | Ember      | single  | 1-3    |
| Tornade      | Gust       | single  | 1-3    |
| Lancer-Roc   | Rock Throw | single  | 1-3    |
| Choc Mental  | Confusion  | single  | 1-4    |

### 3.8 Buffs et meditations → self

Les mots **danse**, **meditation**, **repos**, **concentration**, **boost**.

| Attaque        | Nom EN       | Pattern |
| -------------- | ------------ | ------- |
| Repli          | Withdraw     | self    |
| Pugilat        | Bulk Up      | self    |
| Zen Absolu     | Calm Mind    | self    |
| Miniminus      | Minimize     | self    |
| Armure         | Defense Curl | self    |
| Tranche Rapide | Agility      | self    |
| Jackpot        | Double Team  | self    |
| Entassement    | Stockpile    | self    |

---

## 4. Decisions validees

### 4.1 Tranch'Herbe → slash (arc 3 cases) ✅

Le nom evoque un mouvement de fauchage. Arc frontal = face + 2 diagonales adjacentes.
**Nouveau pattern necessaire : `slash`.**

### 4.2 Explosions/Bombes → zone a distance (pas cross) ✅

Les bombes explosent en **cercle**, pas en croix. Bombe-Beurk doit etre un **projectile lance a distance** qui explose en zone circulaire.
**Nouveau pattern necessaire : `blast` (zone a distance)** — combine une portee de lancer (`range`) et un rayon d'explosion (`radius`).

> L'actuel `cross` (forme en +) reste pertinent pour d'autres attaques (Eclate-Roc par ex).

### 4.3 Bulles d'O → cone ✅

Les bulles se dispersent en eventail devant le lanceur. Cone plus naturel que croix.

### 4.4 Charge / Plaquage → restent single ✅

Garder simple. Ce sont des coups melee basiques, pas des charges ou le Pokemon se deplace.

### 4.5 Poudres → zone self ✅

Les poudres se repandent autour du lanceur. Zone self, comme Brouillard.

- Poudre Dodo : `zone r1` (sommeil autour de soi)

### 4.6 Ampleur → zone r2 ✅

Un seisme devrait avoir un rayon plus large. Passer de r1 a r2.

---

## 5. Cas tranches

### 5.1 Tornade → cone ✅

Gust = rafale soufflee devant soi. `cone 1-3 w3`.

### 5.2 Cru-Aile → slash ✅

Coup d'aile = balayage large devant. `slash`.

### 5.3 Cage-Eclair → single 1-3 ✅

Reste single. Line serait trop fort pour un statut paralysie 100%.

### 5.4 Ombre Nuit → cross ✅

Cross reste bien. Ondes sombres qui se repandent en croix.

---

## 6. Nouveaux patterns a implementer

### 6.1 Slash (arc frontal)

**Description** : touche les 3 cases devant (face + 2 perpendiculaires adjacentes a la case en face)
**Parametres** : aucun — toujours 3 cases devant le lanceur
**Candidats roster actuel** : Tranch'Herbe, Cru-Aile
**Candidats futurs** : Aile d'Acier, Queue de Fer, Coupe, Griffe Ombre, Lame de Roc

```
    T T T       (T = case touchee)
      L         (L = lanceur, face vers le haut)
```

### 6.2 Blast / Zone a distance

**Description** : projectile lance a distance qui explose en cercle a l'impact
**Parametres** : `range: {min, max}` (portee de lancer) + `radius` (taille explosion)
**Difference avec cross** : cross = forme en +, blast = cercle plein
**Difference avec zone** : zone = centre sur soi, blast = centre sur la cible
**Candidats** : Bombe-Beurk (r1), Ball'Ombre (r1), Bombe Oeuf, (Tornade ?)

```
  . X .         (r1 : 5 cases)      . X X X .     (r2 : 13 cases)
  X X X                              X X X X X
  . X .                              X X X X X
                                     X X X X X
                                     . X X X .
```

### 6.3 Knockback / Repousser

**Description** : l'attaque repousse la cible de N cases dans la direction de l'impact
**Implementation** : pas un pattern en soi, plutot un **effet** (`EffectKind.Knockback`) avec un parametre `distance`
**Candidats** :

- Cyclone / Whirlwind — repousse de 2-3 cases
- Draco-Queue / Dragon Tail — repousse de 1 case
- Torgnole / Smack Down — repousse de 1 case
- Mawashi Geri / Low Sweep — repousse de 1 case
- Soufflerie / Hurricane — repousse de 2 cases
- Coup d'Boule / Headbutt — repousse de 1 case (optionnel)
- Seisme (Seismic Toss) — pourrait lancer la cible a distance (2-3 cases)

**Interactions tactiques** :

- Repousser dans un mur = degats bonus ?
- Repousser dans un allie = les deux prennent des degats ?
- Repousser dans le vide (bord de falaise) = chute + degats ?
- Repousser hors de portee de Vampigraine = casser le lien

### 6.4 Warp / Deplacement libre + frappe

**Description** : le lanceur se teleporte sur une case adjacente a la cible (ou sur la cible), frappe, et reste a l'arrivee. Ignore tous les obstacles entre depart et arrivee.
**Parametres** : `range: {min, max}` (distance max)
**Difference avec dash** : dash = ligne droite, bloque par obstacles. Warp = libre, traverse tout.
**Le lanceur reste a l'arrivee** dans tous les cas.
**Candidats** :

- Tunnel / Dig — disparait sous terre, reapparait sur la cible
- Vol / Fly — idem mais aerien
- Ombre Portee / Shadow Sneak — traverse les ombres
- Pied Saute / Jump Kick — saut par-dessus les obstacles
- Piqure / Bounce
- Teleport — warp sans degats (repositionnement pur)

**Interactions tactiques** :

- Ignore le blocage par les Pokemon et les obstacles
- Peut cibler par-dessus les murs et les deniveles
- Repositionnement garanti (le lanceur reste a l'arrivee)
- Contre : Teleport = outil de fuite sans cout offensif

### 6.5 Ground / Zone persistante au sol

**Description** : l'attaque pose une zone au sol qui persiste N tours. Tout Pokemon qui entre ou reste dans la zone subit un effet (degats, statut, ralentissement, etc.). Cree des pieges, des murs, du denial de zone.

**Parametres** : `radius` ou forme + `duration` (tours) + effet par tour/a l'entree

**Variantes** :

| Type                 | Comportement                                  | Candidats                                                                |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **Piege**            | Effet a l'entree (1 fois)                     | Picots (Spikes), Piege de Roc (Stealth Rock), Toile Gluante (Sticky Web) |
| **Terrain**          | Effet continu tant qu'on est dedans           | Champ Herbu (Grassy Terrain), Champ Electrifie (Electric Terrain)        |
| **Nuage/Brouillard** | Zone qui bloque la vision ou reduit precision | Brouillard (Smokescreen), Purbrume (Defog inverse)                       |
| **Zone electrifiee** | Degats/paralysie en entrant                   | Cage-Eclair (Thunder Wave) comme zone persistante                        |

**Interactions tactiques** :

- Force le repositionnement — l'adversaire doit contourner
- Cree des couloirs de passage forces → combo avec line ou cone
- Empile avec le terrain de la carte (herbe haute + Champ Herbu ?)
- Friendly fire : les allies aussi sont affectes
- Nettoyable ? (Defog/Rapid Spin enleve les pieges dans Pokemon)
- Duree limitee (N tours) pour eviter que la carte soit saturee

**Exemples concrets** :

- **Picots** : zone 3x3 au sol, dure 5 tours, degats a l'entree (pas d'effet si on reste)
- **Brouillard** : zone r1 self, dure 3 tours, -1 precision a tous ceux dedans
- **Cage-Eclair** : single range 1-3 qui pose une case electrifiee (2 tours), paralyse a l'entree
- **Piege de Roc** : zone 3x3 a distance, dure indefiniment, degats type x faiblesse a l'entree

> C'est un systeme a part entiere — pas juste un pattern, mais une **propriete** de l'attaque ("pose au sol" vs "effet instantane").

### 6.6 Pierce / Traversant

**Description** : variante de `line` qui traverse les cibles au lieu de s'arreter a la premiere
**Note** : `line` traverse deja tout dans l'implementation actuelle. Peut-etre prevoir une variante qui s'arrete au premier impact pour certaines attaques ?

---

## 7. Proprietes d'attaque supplementaires

Au-dela du pattern, certaines attaques ont des **proprietes speciales** qui modifient leur comportement :

| Propriete          | Description                                                 | Candidats                                     |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------- |
| **knockback**      | Repousse la cible de N cases                                | Cyclone, Draco-Queue, Torgnole                |
| **ground**         | Pose une zone persistante au sol (N tours)                  | Picots, Piege de Roc, Brouillard, Cage-Eclair |
| **warp**           | Teleporte sur la cible, ignore obstacles, reste a l'arrivee | Tunnel, Vol, Ombre Portee, Teleport           |
| **pierce**         | Traverse les cibles (vs s'arreter au premier)               | Deja le cas pour `line`                       |
| **ignore-protect** | Passe a travers Abri/Detect                                 | Feinte                                        |
| **ignore-height**  | Ignore les bonus/malus de hauteur                           | Seisme, Ampleur                               |
| **self-damage**    | Le lanceur subit des degats (recul)                         | Voltacle, Belier, Damocles                    |

> Ces proprietes sont des **effets** ou **flags** sur le move, pas des patterns de ciblage.

---

## 8. Tableau recapitulatif — roster actuel

| #   | Attaque        | Nom EN        | Pattern actuel | Pattern valide     | Statut  |
| --- | -------------- | ------------- | -------------- | ------------------ | ------- |
| 1   | Tranch'Herbe   | Razor Leaf    | single 1-2     | **slash 1**        | CHANGER |
| 2   | Poudre Dodo    | Sleep Powder  | single 1-2     | **zone r1** (self) | CHANGER |
| 3   | Vampigraine    | Leech Seed    | single 1-3     | single 1-3         | OK      |
| 4   | Bombe-Beurk    | Sludge Bomb   | cross 2-4 s3   | **blast 2-4 r1**   | CHANGER |
| 5   | Flammeche      | Ember         | single 1-3     | single 1-3         | OK      |
| 6   | Griffe         | Scratch       | single 1       | single 1           | OK      |
| 7   | Brouillard     | Smokescreen   | zone r1        | zone r1            | OK      |
| 8   | Dracosouffle   | Dragon Breath | cone 1-2 w3    | cone 1-2 w3        | OK      |
| 9   | Pistolet a O   | Water Gun     | single 1-3     | single 1-3         | OK      |
| 10  | Charge         | Tackle        | single 1       | single 1           | OK      |
| 11  | Repli          | Withdraw      | self           | self               | OK      |
| 12  | Bulles d'O     | Bubble Beam   | cross 1-2 s3   | **cone 1-2 w3**    | CHANGER |
| 13  | Tornade        | Gust          | single 1-3     | **cone 1-3 w3**    | CHANGER |
| 14  | Vive-Attaque   | Quick Attack  | dash 2         | dash 2             | OK      |
| 15  | Jet de Sable   | Sand Attack   | cone 1-2 w3    | cone 1-2 w3        | OK      |
| 16  | Cru-Aile       | Wing Attack   | single 1       | **slash**          | CHANGER |
| 17  | Tonnerre       | Thunderbolt   | line 4         | line 4             | OK      |
| 18  | Cage-Eclair    | Thunder Wave  | single 1-3     | single 1-3         | OK      |
| 19  | Jackpot        | Double Team   | self           | self               | OK      |
| 20  | Voltacle       | Volt Tackle   | dash 3         | dash 3             | OK      |
| 21  | Tranche        | Karate Chop   | single 1       | single 1           | OK      |
| 22  | Seisme         | Seismic Toss  | single 1       | single 1           | OK      |
| 23  | Pugilat        | Bulk Up       | self           | self               | OK      |
| 24  | Eclate-Roc     | Rock Smash    | cross 1-2 s3   | cross 1-2 s3       | OK      |
| 25  | Psykoud'boul   | Psybeam       | line 5         | line 5             | OK      |
| 26  | Choc Mental    | Confusion     | single 1-4     | single 1-4         | OK      |
| 27  | Kinesie        | Kinesis       | single 1-3     | single 1-3         | OK      |
| 28  | Zen Absolu     | Calm Mind     | self           | self               | OK      |
| 29  | Lechouille     | Lick          | single 1       | single 1           | OK      |
| 30  | Hypnose        | Hypnosis      | single 1-3     | single 1-3         | OK      |
| 31  | Ombre Nuit     | Night Shade   | cross 1-2 s3   | cross 1-2 s3       | OK      |
| 32  | Miniminus      | Minimize      | self           | self               | OK      |
| 33  | Lancer-Roc     | Rock Throw    | single 1-3     | single 1-3         | OK      |
| 34  | Ampleur        | Magnitude     | zone r1        | **zone r2**        | CHANGER |
| 35  | Armure         | Defense Curl  | self           | self               | OK      |
| 36  | Tunnel         | Rollout       | dash 4         | dash 4             | OK      |
| 37  | Morsure        | Bite          | single 1       | single 1           | OK      |
| 38  | Lance-Flammes  | Flamethrower  | line 3         | line 3             | OK      |
| 39  | Tranche Rapide | Agility       | self           | self               | OK      |
| 40  | Roue de Feu    | Flame Wheel   | dash 3         | dash 3             | OK      |
| 41  | Ecras'Face     | Pound         | single 1       | single 1           | OK      |
| 42  | Berceuse       | Sing          | cone 1-3 w3    | cone 1-3 w3        | OK      |
| 43  | Plaquage       | Body Slam     | single 1       | single 1           | OK      |
| 44  | Entassement    | Stockpile     | self           | self               | OK      |
| 45  | Laser Glace    | Ice Beam      | line 3         | line 3             | OK      |
| 46  | Blizzard       | Blizzard      | cone 1-3 w3    | cone 1-3 w3        | OK      |
| 47  | Tete de Roc    | Headbutt      | single 1       | single 1           | OK      |
| 48  | Vent Glace     | Icy Wind      | cone 1-2 w3    | cone 1-2 w3        | OK      |

**Resume** : 40 OK, 8 a changer

---

## 9. Heuristique supplementaire : comportement 2v2

En combat Pokemon 2v2, chaque attaque a une cible definie (un adversaire, les deux, tous, soi-meme + allie, etc.). Cette info est disponible sur Showdown (`data/moves.ts` champ `target`) et Pokepedia.

| Target 2v2                            | Interpretation tactique |
| ------------------------------------- | ----------------------- |
| `normal` (1 adversaire)               | single                  |
| `allAdjacentFoes` (les 2 adversaires) | cone, slash, ou line    |
| `allAdjacent` (tous sauf soi)         | zone self ou blast      |
| `self`                                | self                    |
| `all` (tout le terrain)               | zone large              |

Exemple : Tornade (Gust) est `normal` en 2v2 (1 cible), mais le nom evoque un souffle → on passe en cone malgre le target 2v2. Le nom prime, le 2v2 sert d'indice supplementaire.

---

## 10. Prochaines etapes

1. Implementer les nouveaux patterns dans le core : `slash`, `blast`
2. Implementer l'effet `knockback`
3. Mettre a jour `tactical.ts` avec les 8 changements valides
4. Mettre a jour `roster-poc.md` en consequence
5. Considerer `warp` et `ground` (zones persistantes) pour les futurs Pokemon du roster
6. Utiliser le champ `target` de Showdown comme heuristique pour les futurs movesets
