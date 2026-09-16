/**
 * Les durées du jeu en ligne, et **rien d'autre** (plan 213).
 *
 * 🔴 Ce fichier n'a AUCUN import, et c'est sa raison d'être. `protocol.ts`, où cette constante
 * vivait, dépend de `@pokemon-tactic/core` — un spécificateur nu que le harnais e2e ne sait pas
 * résoudre, `e2e/` n'étant pas un paquet de l'espace de travail et n'ayant aucun lien vers eux.
 * Résultat : le chronomètre était **recopié** à la main dans `e2e/pages/online-duel.ts`, et le
 * réglage suivant l'aurait laissé derrière sans que rien ne rougisse.
 *
 * Le même remède que `packages/app/src/analytics/telemetry-contract.ts`, pour la même raison : ce
 * qui doit traverser une frontière de paquet sans en payer les dépendances vit dans un module sans
 * dépendances. Y ajouter un import ferait retomber le harnais dans la recopie.
 *
 * ⚠️ N'importez PAS ce module directement depuis l'application : `protocol.ts` le réexporte, et
 * c'est là que vit le contrat réseau.
 */

/**
 * Durée d'un tour en ligne (plan 202, Lot B3, décision #946).
 *
 * Une valeur que les deux pairs doivent **partager**, au même titre que `NETWORK_VERSION` : un pair
 * qui compterait 45 s là où l'autre en compte 60 verrait des tours expirer sans raison chez lui seul.
 *
 * 60 s et non les 45 s du VGC : là-bas une décision est le choix d'une attaque, ici un tour est
 * déplacement + sous-menu + choix d'attaque + visée + confirmation + orientation, sur une grille
 * isométrique avec hauteurs, à la manette ou au doigt. Une **seule** fenêtre couvre tout ça
 * (décision #946) — elle ne redémarre pas d'une étape à l'autre, sinon annuler en boucle gèlerait la
 * partie pour toujours.
 */
export const ONLINE_TURN_DURATION_MS = 60_000;
