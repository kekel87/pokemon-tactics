/**
 * Haché de visiteur — la parité d'audience exigée par la décision #879.
 *
 * `HMAC(secret ⊕ date du jour, IP + agent utilisateur)`. Deux propriétés, et ce sont elles qui
 * rendent la chose acceptable :
 *   1. **Seul le haché est écrit, jamais l'IP** — elle ne sort pas de cette fonction.
 *   2. **Le sel tourne chaque jour** : le même visiteur produit un haché différent le lendemain,
 *      donc aucun suivi inter-jours n'est possible, même pour nous. Corollaire assumé : les
 *      visiteurs uniques se comptent PAR JOUR, pas sur 30 jours — Goatcounter avait la même limite.
 *
 * ⚠️ **C'est la méthode de Plausible, pas celle de Goatcounter** (vérifié le 2026-09-02 ; la
 * décision #879 parlait de « la méthode de Goatcounter », c'était imprécis). Plausible hache
 * `sel du jour + domaine + IP + agent`, ce qui est exactement notre schéma. Goatcounter, lui, mappe
 * `(site, agent, IP)` vers un **UUID aléatoire tenu en mémoire** : le jeton stocké n'a aucune
 * relation mathématique avec l'IP, ce qui le rend insensible à une attaque par confirmation — si
 * notre secret fuitait, on pourrait recalculer si une IP donnée était présente ce jour-là ; chez
 * Goatcounter, jamais. **Écart assumé** : répliquer leur mécanisme demanderait un état partagé
 * entre isolats (un Durable Object), disproportionné à notre échelle. Le modèle Plausible est le
 * bon compromis pour une fonction sans état.
 *
 * Autre écart mineur assumé : Plausible et Goatcounter incluent un identifiant de site dans la
 * clé. Inutile ici — un seul Worker, une seule table, jamais deux sites à distinguer.
 */

const encoder = new TextEncoder();

/** Date du jour en UTC (`2026-09-02`), qui sert de sel tournant. */
export function dayStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Rend un haché hexadécimal tronqué à 32 caractères — 128 bits, largement assez pour compter des
 * uniques sur une journée, et une surface de moins qu'un haché complet.
 *
 * Rend `null` si le secret n'est pas configuré : mieux vaut perdre la colonne `visitor` que faire
 * tomber la collecte entière. Le secret vit dans `wrangler secret put`, jamais dans le dépôt.
 */
export async function visitorHash(input: {
  secret: string | undefined;
  ip: string | null;
  userAgent: string | null;
  day: string;
}): Promise<string | null> {
  if (!input.secret || !input.ip) {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${input.secret}:${input.day}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${input.ip}|${input.userAgent ?? ""}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
