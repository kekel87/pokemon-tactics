-- Consommation du relais de salons (plan 216, bug 1, étape 1.4).
--
-- 🔴 Ce n'est PAS un compteur de facturation : le compte est sur le plan gratuit, donc Cloudflare
-- ARRÊTE au lieu de facturer. Ce que cette table protège, c'est le registre des salons (`/salon`) :
-- le plafond de 100 000 requêtes/jour est à l'échelle du compte, et s'il tombe, plus personne ne
-- peut créer ni rejoindre une partie — même en direct, même sans relais.
--
-- Une ligne par JOUR UTC, écrite une seule fois par salon à sa fermeture. Surtout pas une écriture
-- par message : le palier gratuit D1 donne 100 000 écritures de ligne par jour, soit le même ordre
-- de grandeur que le budget qu'on surveille.
CREATE TABLE relay_usage (
  -- 'YYYY-MM-DD' en UTC : c'est à minuit UTC que Cloudflare remet ses compteurs à zéro. Un jour
  -- calé sur Paris dériverait d'une à deux heures et se tromperait juste au moment du basculement.
  day      TEXT    PRIMARY KEY,
  -- Estimation par la formule exacte de Cloudflare : connexions + plafond(messages entrants / 20).
  requests INTEGER NOT NULL,
  -- Combien de salons ont eu besoin du relais ce jour-là. C'est le chiffre qui dit si le NAT gagne
  -- souvent ou rarement — donc si ce chemin de secours sert vraiment.
  rooms    INTEGER NOT NULL
);
