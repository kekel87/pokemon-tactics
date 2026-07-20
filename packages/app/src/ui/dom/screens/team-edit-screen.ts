import type { Navigate, Screen } from "../../../app/screen-manager";
import { TeamEditView } from "../../team/TeamEditView";
import { bindEscape } from "./elements";

/** DOM port of TeamEditScene (plan 120 step 5) — wraps the shared TeamEditView. */
export function createTeamEditScreen(navigate: Navigate): Screen<"team-edit"> {
  let view: TeamEditView | null = null;
  let unbindEscape: (() => void) | null = null;
  const goBack = (): void => navigate("my-teams", undefined);

  return {
    mount(host, params) {
      view = new TeamEditView({ teamId: params.teamId, onBack: goBack });
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
