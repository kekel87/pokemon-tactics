import { AnalyticsEvent, trackEvent } from "../../../analytics/analytics";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { MyTeamsView } from "../../team/MyTeamsView";
import { bindEscape } from "./elements";

/** DOM port of MyTeamsScene (plan 120 step 5) — wraps the shared MyTeamsView. */
export function createMyTeamsScreen(navigate: Navigate): Screen<"my-teams"> {
  let view: MyTeamsView | null = null;
  let unbindEscape: (() => void) | null = null;
  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      trackEvent(AnalyticsEvent.TeamBuilder);
      view = new MyTeamsView({
        onBack: goBack,
        onEditTeam: (teamId) => navigate("team-edit", { teamId }),
      });
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
