import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { createEmptyTeam } from "../../../team/team-helpers";
import { saveTeam } from "../../../team/team-storage";
import { TeamEditView } from "../../team/TeamEditView";
import { bindEscape } from "./elements";

/**
 * DOM port of TeamEditScene (plan 120 step 5) — wraps the shared TeamEditView.
 * A null teamId creates (and saves) a fresh empty team before editing it.
 */
export function createTeamEditScreen(navigate: Navigate): Screen<"team-edit"> {
  let view: TeamEditView | null = null;
  let unbindEscape: (() => void) | null = null;
  const goBack = (): void => navigate("my-teams", undefined);

  return {
    mount(host, params) {
      let teamId = params.teamId;
      if (teamId === null) {
        const team = createEmptyTeam(t("teamBuilder.untitledTeam"));
        saveTeam(team);
        teamId = team.id;
      }
      view = new TeamEditView({ teamId, onBack: goBack });
      host.append(view.element);
      unbindEscape = bindEscape(goBack);
    },
    dispose() {
      unbindEscape?.();
      unbindEscape = null;
      view?.destroy();
      view = null;
    },
  };
}
