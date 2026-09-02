import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { MyTeamsView } from "../../team/MyTeamsView";
import { bindScreenInput } from "./elements";

/** DOM port of MyTeamsScene (plan 120 step 5) — wraps the shared MyTeamsView. */
export function createMyTeamsScreen(navigate: Navigate): Screen<"my-teams"> {
  let view: MyTeamsView | null = null;
  let unbindScreenInput: (() => void) | null = null;
  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      countScreen(TelemetryScreen.TeamBuilder);
      view = new MyTeamsView({
        onBack: goBack,
        onEditTeam: (teamId) => navigate("team-edit", { teamId }),
      });
      host.append(view.element);
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      view?.destroy();
      view = null;
    },
  };
}
