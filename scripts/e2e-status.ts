#!/usr/bin/env tsx
/**
 * e2e-status — dit où en est la suite e2e asynchrone, sans ouvrir un navigateur.
 *
 * La suite complète ne bloque plus personne : elle tourne sur GitHub (`.github/workflows/e2e.yml`,
 * 8 tranches, ~5 min) et on vient lire son verdict après coup. Le risque connu de ce modèle n'est
 * pas technique, il est humain : **une suite asynchrone rouge finit ignorée**. La parade documentée
 * est de ne signaler que les CHANGEMENTS d'état, jamais chaque exécution — d'où la « transition »
 * ci-dessous, qui répond à « depuis quand ? » et « qu'est-ce qui l'a cassée ? » plutôt qu'à « est-ce
 * vert maintenant ? », question à laquelle on s'habitue à répondre « oui, sûrement ».
 *
 * Usage :
 *   pnpm e2e:status            état courant + transition
 *   pnpm e2e:status --json     la même chose en JSON (pour un autre outil)
 */
import { execFileSync } from "node:child_process";

/**
 * Surchargeable pour VÉRIFIER le rendu de ce script contre un workflow qui a déjà de l'historique
 * (`PT_E2E_WORKFLOW=ci.yml pnpm e2e:status`). Sans ça, on ne peut relire son affichage qu'après
 * avoir fusionné le workflow qu'il décrit — donc trop tard pour le corriger.
 */
const WORKFLOW = process.env.PT_E2E_WORKFLOW ?? "e2e.yml";
const BRANCH = "main";
/** Assez de profondeur pour retrouver la bascule d'une suite rouge depuis quelques jours. */
const HISTORY = 25;

interface Run {
  databaseId: number;
  conclusion: string | null;
  status: string;
  displayTitle: string;
  headSha: string;
  createdAt: string;
  url: string;
}

/**
 * `stderr` capturé plutôt que laissé filer : le 404 de « workflow pas encore sur la branche par
 * défaut » est un cas NORMAL qu'on traite plus bas, et le voir passer en rouge dans le terminal
 * juste avant le message qui l'explique donnerait l'impression d'une panne.
 */
function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Rend `null` — et non une erreur — quand GitHub ne connaît pas encore le workflow. C'est l'état
 * NORMAL tant que la branche qui l'apporte n'est pas fusionnée : `gh` répond 404, ce qui n'est pas
 * une panne mais une réponse. La faire remonter en trace d'exception ferait passer « pas encore
 * déployé » pour « quelque chose est cassé ».
 */
function listRuns(): Run[] | null {
  try {
    const raw = gh([
      "run",
      "list",
      "--workflow",
      WORKFLOW,
      "--branch",
      BRANCH,
      "--limit",
      String(HISTORY),
      "--json",
      "databaseId,conclusion,status,displayTitle,headSha,createdAt,url",
    ]);
    return JSON.parse(raw) as Run[];
  } catch (error) {
    if (/not found on the default branch|could not find any workflows/i.test(String(error))) {
      return null;
    }
    throw error;
  }
}

/** Les tranches en échec de l'exécution donnée — c'est ce qu'on veut lire, pas les huit journaux. */
function failedJobs(runId: number): string[] {
  const raw = gh(["run", "view", String(runId), "--json", "jobs"]);
  const { jobs } = JSON.parse(raw) as { jobs: Array<{ name: string; conclusion: string }> };
  return jobs.filter((job) => job.conclusion === "failure").map((job) => job.name);
}

function ageOf(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) {
    return `il y a ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} jours`;
}

function main(): void {
  const wantsJson = process.argv.includes("--json");
  const runs = listRuns();

  if (runs === null) {
    const message = `Suite e2e — le workflow \`${WORKFLOW}\` n'est pas encore sur \`${BRANCH}\`, il n'a donc jamais tourné. Rien d'anormal tant que la branche qui l'apporte n'est pas fusionnée.`;
    process.stdout.write(wantsJson ? `${JSON.stringify({ deployed: false })}\n` : `${message}\n`);
    return;
  }

  const finished = runs.filter((run) => run.status === "completed");
  const running = runs.find((run) => run.status !== "completed");

  if (finished.length === 0) {
    const message =
      running === undefined
        ? "Suite e2e — aucune exécution trouvée, alors que le workflow existe. Déclenche-la : `gh workflow run e2e.yml`."
        : `Suite e2e — aucune exécution terminée ; une est EN COURS (${running.url})`;
    process.stdout.write(`${message}\n`);
    return;
  }

  const latest = finished[0];
  const green = latest.conclusion === "success";

  // La transition : la plus ancienne exécution consécutive à partager le verdict courant. C'est
  // elle qui répond à « depuis quand ? », et son commit à « qu'est-ce qui l'a cassée ? ».
  //
  // ⚠️ Si TOUTE la fenêtre partage le même verdict, on n'a trouvé aucune bascule — seulement le
  // bout de l'historique qu'on a demandé. Le dire « vert depuis ce commit-là » désignerait un
  // commit au hasard, celui qui se trouve être le 25e en arrière.
  let transition = latest;
  let foundTransition = false;
  for (const run of finished) {
    if (run.conclusion !== latest.conclusion) {
      foundTransition = true;
      break;
    }
    transition = run;
  }
  const stableSince = foundTransition && transition.databaseId !== latest.databaseId;
  const justFlipped = foundTransition && transition.databaseId === latest.databaseId;

  if (wantsJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          green,
          latest,
          since: transition,
          running: running ?? null,
          failedJobs: green ? [] : failedJobs(latest.databaseId),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const lines: string[] = [
    "",
    green ? "✅ Suite e2e VERTE" : "❌ Suite e2e ROUGE",
    `   dernière exécution : ${ageOf(latest.createdAt)} — « ${latest.displayTitle} »`,
    `   ${latest.url}`,
  ];

  if (green) {
    if (justFlipped) {
      lines.push("   elle vient de REPASSER au vert — la précédente était rouge.");
    } else if (stableSince) {
      lines.push(
        `   verte sans interruption depuis « ${transition.displayTitle} » (${ageOf(transition.createdAt)})`,
      );
    } else {
      lines.push(`   verte sur les ${finished.length} dernières exécutions, au moins.`);
    }
  } else {
    if (justFlipped) {
      lines.push("   🔴 elle vient de PASSER au rouge — la précédente était verte.");
    } else if (stableSince) {
      lines.push(
        `   🔴 rouge depuis « ${transition.displayTitle} » (${ageOf(transition.createdAt)}), commit ${transition.headSha.slice(0, 7)}`,
        `   c'est donc ${transition.headSha.slice(0, 7)} qu'il faut regarder en premier.`,
      );
    } else {
      lines.push(`   🔴 rouge sur les ${finished.length} dernières exécutions, au moins.`);
    }
    const failures = failedJobs(latest.databaseId);
    if (failures.length > 0) {
      lines.push(`   tranches en échec : ${failures.join(", ")}`);
    }
    lines.push(
      `   détail : gh run view ${latest.databaseId} --log-failed`,
      `   rapport complet : gh run download ${latest.databaseId} -n rapport-e2e`,
    );
  }

  if (running !== undefined) {
    lines.push(`   ⏳ une exécution est en cours : ${running.url}`);
  }
  lines.push("");
  process.stdout.write(lines.join("\n"));
}

main();
