-- Schéma de la télémétrie de jeu (plan 196, décision #868).
--
-- Le Worker ne comprend pas le contenu qu'il stocke : une ligne = un événement brut, et le JSON
-- reste dans `payload`. C'est ce qui rend l'agrégation à la lecture confortable — ajouter un champ
-- au payload ne demande aucune migration et aucun redéploiement.
--
-- Aucune colonne d'IP, aucun identifiant d'appareil, aucune empreinte (§ RGPD du plan).

CREATE TABLE events (
  -- PAS d'AUTOINCREMENT : il impose une table interne `sqlite_sequence` écrite à chaque insertion,
  -- soit une écriture facturée de plus par ligne. En D1, `INTEGER PRIMARY KEY` suffit et s'auto-incrémente.
  id          INTEGER PRIMARY KEY,
  received_at INTEGER NOT NULL,  -- horloge SERVEUR ; l'horloge client n'est pas fiable
  kind        TEXT    NOT NULL,  -- 'session' | 'battle_started' | 'battle_ended'
  build       TEXT    NOT NULL,  -- buildVersion, pour ne pas mélanger deux versions du jeu (#748)
  platform    TEXT    NOT NULL,  -- 'itch' | 'ghp'

  -- Audience, renseignée par le Worker pour les seules lignes 'session' (décision #879).
  visitor     TEXT,              -- HMAC(secret ⊕ date du jour, IP + agent) ; l'IP n'est JAMAIS stockée
  country     TEXT,              -- request.cf.country — ni base GeoIP ni IP à lire
  browser     TEXT,              -- catégorie, ex. 'Firefox 121' — jamais l'agent brut
  os          TEXT,              -- catégorie, ex. 'Windows'
  lang        TEXT,              -- langue principale d'Accept-Language

  payload     TEXT    NOT NULL   -- JSON brut (dont palier d'écran, référent), non interprété
);

-- Toutes les lectures du § « Ce que ces trois événements permettent de sortir » filtrent par
-- type d'événement puis par fenêtre de temps.
CREATE INDEX idx_events_kind_time ON events (kind, received_at);
