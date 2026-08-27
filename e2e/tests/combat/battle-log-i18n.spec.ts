import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { BATTLE_LOG_I18N } from "../../fixtures/sandbox-configs";
import { expectLocalizedBattleLog } from "../../pages/combat-queries";

// Cahier §4.9 — GARDE-FOU i18n du journal (plan 190). Le formateur n'embarque plus aucune chaîne :
// il émet 234 clés `battleLog.*` que les locales de `app` résolvent. Une clé manquante ne casse ni le
// typecheck (douze familles de clés sont COMPOSÉES à l'exécution, donc de simples littéraux de
// gabarit) ni les tests de contrat : `t()` retombe sur la clé et le journal affiche littéralement
// « battleLog.pokemonKo ». Seul le journal RENDU peut le voir — d'où ce scénario, qui déclenche en
// un seul boot les familles les plus exposées puis balaye TOUTES les lignes.
//
// Les deux moitiés du filet : les assertions de PHRASE FR ci-dessous attrapent la clé oubliée en FR
// mais présente en EN (`t()` retombe sur l'anglais → phrase anglaise dans un journal français), le
// balayage final attrape la clé absente des DEUX locales (→ clé brute). Vérifié rouge-vert.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§4.9 journal : aucune ligne n'expose une clé `battleLog.*` brute", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BATTLE_LOG_I18N);

  // Attaque typée : usage de move + efficacité (ligne à part) + dégâts. Ronflex est Normal, Mach
  // Punch est Combat → super efficace, et ses 999 PV le font survivre aux trois tours.
  await scene.castMoveNamed("Mach Punch", 3, 4);
  await expect(log(page, /Florizarre utilise Mach Punch/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Super efficace/)).toBeAttached();
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached();
  await scene.endTurn();

  // Statut majeur → clé COMPOSÉE `battleLog.status.asleep.applied` (Spore est à 100 %).
  await scene.castMoveNamed("Spore", 3, 4);
  await expect(log(page, /Ronflex s'est endormi/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();

  // Cran de stat → gabarit `statChanged.raised` dont le nom de stat est lui-même une clé composée
  // (`battleLog.stat.attack`) : la clé manquante y rendrait « battleLog.stat.attack de … augmente ! ».
  await scene.castMoveNamed("Danse Lames", 2, 4);
  await expect(log(page, /Attaque de Florizarre augmente/)).toBeAttached({ timeout: 10_000 });

  await expectLocalizedBattleLog(page, 6);
});
