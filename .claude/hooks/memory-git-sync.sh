#!/usr/bin/env bash
# SessionStart / Stop : fait voyager le graphe de memoire par un depot PRIVE.
#
# Pourquoi un depot separe et prive : le depot du jeu est PUBLIC, et le graphe
# contient bien du personnel (adresses de courriel, employeur, sous-domaines). La
# contrainte « pas de perso » est donc tenue par la VISIBILITE du depot, pas par un
# tri a refaire a chaque ecriture — elle ne peut pas se degrader avec le temps.
#
# 🔴 HISTOIRE DE CE FICHIER, a lire avant d'y toucher. Il a eu DEUX fois le meme
# bug, sous deux deguisements : une empreinte impossible a calculer rendait la meme
# valeur des deux cotes, donc « aucun changement », donc plus aucune sauvegarde —
# un dispositif qui a l'air de marcher sans rien sauvegarder. Regle qui en decoule :
#
#     UNE EMPREINTE QU'ON NE SAIT PAS CALCULER DOIT PROVOQUER UNE SAUVEGARDE,
#     JAMAIS SON ABANDON.
#
# Et l'empreinte de reference se lit dans GIT (`git show HEAD:memory.db`), pas dans
# le fichier de travail : sinon un `cp` reussi suivi d'un commit ou d'un push rate
# fait croire, la fois suivante, que tout est deja sauvegarde.
set -uo pipefail

CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
GRAPHE="${PT_MEMORY_HOME:-$CONFIG/memory/pokemon-tactics}/.claude/memory.db"
MIROIR="$CONFIG/memory/sync"
VENDOR="${PT_MEMORY_VENDOR:-$CONFIG/.claude/vendor}"
DEPOT="${PT_MEMORY_REMOTE:-}"
EVT="${1:-Stop}"

if [ -z "$DEPOT" ]; then
  echo "⚠️  PT_MEMORY_REMOTE non défini — LE GRAPHE N'EST SAUVEGARDÉ NULLE PART." >&2
  echo "    Définis-le dans les réglages personnels (hors dépôt public)." >&2
  exit 0
fi

# Empreinte du CONTENU du graphe, pas du fichier : SQLite reecrit ses pages et son
# index a chaque session, donc un hachage de fichier commiterait plusieurs Mo de
# bruit par session. Sort 1 si elle ne peut pas etre calculee — l'appelant DOIT
# alors sauvegarder par securite.
empreinte() {
  [ -f "$1" ] || return 1
  node -e '
    const D = require(process.argv[2] + "/node_modules/better-sqlite3");
    const d = new D(process.argv[1], { readonly: true, fileMustExist: true });
    const q = (s) => d.prepare(s).get().c;
    console.log([q("SELECT COUNT(*) c FROM entities"),
                 q("SELECT COUNT(*) c FROM observations"),
                 q("SELECT COUNT(*) c FROM relations"),
                 q("SELECT COALESCE(SUM(LENGTH(content)),0) c FROM observations")].join("-"));
  ' "$1" "$VENDOR" 2>/dev/null || return 1
}

if [ ! -d "$MIROIR/.git" ]; then
  mkdir -p "$(dirname "$MIROIR")"
  if ! git clone --quiet "$DEPOT" "$MIROIR" 2>/dev/null; then
    echo "⚠️  clone impossible ($DEPOT) — synchronisation ignorée." >&2
    exit 0
  fi
  # 🔴 Verification UNE FOIS, au clonage : tout le raisonnement de securite repose
  # sur la visibilite du depot, or personne ne controle la valeur de la variable.
  # Une faute de frappe pousserait six mois de memoire en public, definitivement.
  vis=$(gh repo view "$DEPOT" --json visibility -q .visibility 2>/dev/null || echo INCONNU)
  if [ "$vis" != "PRIVATE" ]; then
    echo "🔴 REFUS : le dépôt de mémoire n'est pas privé (visibilité : $vis)." >&2
    echo "    Le graphe contient des données personnelles. Rien n'a été poussé." >&2
    rm -rf "$MIROIR"
    exit 0
  fi
fi

case "$EVT" in
  SessionStart)
    git -C "$MIROIR" pull --quiet --ff-only 2>/dev/null || true
    # On n'adopte l'instantane distant que si le graphe local est ABSENT : ecraser
    # un graphe vivant par une version distante est une perte silencieuse, un
    # binaire SQLite ne se fusionnant pas.
    if [ ! -f "$GRAPHE" ] && [ -f "$MIROIR/memory.db" ]; then
      mkdir -p "$(dirname "$GRAPHE")"
      cp "$MIROIR/memory.db" "$GRAPHE" && echo "graphe adopté depuis le dépôt privé" >&2
    fi
    ;;
  Stop)
    [ -f "$GRAPHE" ] || exit 0

    if ! node -e '
      const D = require(process.argv[2] + "/node_modules/better-sqlite3");
      new D(process.argv[1]).pragma("wal_checkpoint(TRUNCATE)");
    ' "$GRAPHE" "$VENDOR" 2>/dev/null; then
      echo "⚠️  checkpoint WAL impossible — la copie pourrait manquer les dernières écritures." >&2
    fi

    # Reference lue dans GIT, pas dans le fichier de travail.
    ref=""
    git -C "$MIROIR" show HEAD:memory.db > "$MIROIR/.ref.db" 2>/dev/null \
      && ref=$(empreinte "$MIROIR/.ref.db" || true)
    rm -f "$MIROIR/.ref.db"

    if ! courante=$(empreinte "$GRAPHE"); then
      echo "⚠️  empreinte du graphe illisible — on sauvegarde par sécurité." >&2
      courante="illisible-$$-$RANDOM"      # jamais egal a la reference
    fi
    [ -n "$ref" ] && [ "$ref" = "$courante" ] && exit 0

    cp "$GRAPHE" "$MIROIR/memory.db" || { echo "⚠️  copie du graphe impossible." >&2; exit 0; }
    git -C "$MIROIR" add memory.db || { echo "⚠️  git add a échoué." >&2; exit 0; }
    if ! git -C "$MIROIR" -c user.name="Claude Code" -c user.email="noreply@anthropic.com" \
           commit --quiet -m "mémoire : $(date +%Y-%m-%d\ %H:%M)" 2>/dev/null; then
      echo "⚠️  commit de la mémoire échoué — rien n'est sauvegardé." >&2
      exit 0
    fi
    if ! git -C "$MIROIR" push --quiet origin HEAD 2>/dev/null; then
      echo "⚠️  poussée refusée ou hors ligne — le commit local est fait, la sauvegarde" >&2
      echo "    distante attend la prochaine session." >&2
    fi
    ;;
esac
exit 0
