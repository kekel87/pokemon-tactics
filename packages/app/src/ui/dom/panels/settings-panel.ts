import { CombatSpeed, nextCombatSpeed, nextInCycle } from "@pokemon-tactic/view-core";
import { countAction, TelemetryAction } from "../../../analytics/telemetry";
import { getLanguage, nextLanguage, setLanguage, t } from "../../../i18n";
import {
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "../../../platform/fullscreen";
import { shouldOfferIosInstall } from "../../../platform/pwa";
import {
  getSettings,
  MAX_VOLUME,
  TURN_CRIES,
  TurnCries,
  updateSettings,
  VOLUME_STEP,
} from "../../../settings";
import { el, menuButton } from "../screens/elements";
import { EMBEDDED_PANEL_CLASS, type Panel, type PanelOptions } from "./panel";

const COMBAT_SPEED_ACTION: Record<CombatSpeed, TelemetryAction> = {
  [CombatSpeed.Normal]: TelemetryAction.CombatSpeedNormal,
  [CombatSpeed.Instant]: TelemetryAction.CombatSpeedInstant,
};

const TURN_CRIES_ACTION: Record<TurnCries, TelemetryAction> = {
  [TurnCries.None]: TelemetryAction.TurnCriesNone,
  [TurnCries.Mine]: TelemetryAction.TurnCriesMine,
  [TurnCries.All]: TelemetryAction.TurnCriesAll,
};

/** The volume the mute button gives back when the slider sits at zero. */
const UNMUTED_VOLUME = 50;

/**
 * The mute button: a speaker glyph (a text glyph like the chrome's other icon buttons, until the
 * icon pack) named by what a press does.
 */
function refreshMuteToggle(button: HTMLButtonElement): void {
  const settings = getSettings();
  // A volume of zero is silence too: the button says so, and a press brings the sound back.
  const muted = settings.muted || settings.volume === 0;
  button.textContent = muted ? "🔇" : "🔊";
  button.setAttribute("aria-label", t(muted ? "settings.volume.unmute" : "settings.volume.mute"));
}

export interface SettingsPanelOptions extends PanelOptions {
  /** Ouvrir les Contrôles — un écran de la FSM côté Réglages, un niveau de plus côté modale. */
  readonly onOpenControls: () => void;
}

/**
 * Réglages : langue, plein écran, accès aux Contrôles.
 *
 * La prévisualisation de dégâts n'est plus ici (plan 198) : c'est devenu un paramètre de PARTIE,
 * choisi à l'écran de sélection d'équipe à côté de « Placement auto » (décision #893).
 *
 * Extrait de `settings-screen.ts` par le plan 187 sans changement de comportement : le menu de
 * combat monte ce même panneau, de sorte qu'un réglage changé en pleine partie n'a pas à quitter le
 * combat — ce qui, avec la sémantique d'abandon de « Quitter », le perdrait.
 */
export function createSettingsPanel(options: SettingsPanelOptions): Panel {
  const { onBack, onOpenControls, embedded = false } = options;
  /** Remplacée à chaque changement de langue — d'où le `get element()` plus bas. */
  let root: HTMLElement | null = null;
  let unbindFullscreen: (() => void) | null = null;
  let fullscreenToggle: HTMLButtonElement | null = null;

  /**
   * Refresh just the fullscreen label. Leaving fullscreen through Escape or a system gesture has to
   * show through, but rebuilding the panel for one word would drop the keyboard focus (plan 184).
   */
  const refreshFullscreenLabel = (): void => {
    if (fullscreenToggle) {
      fullscreenToggle.textContent = isFullscreen() ? t("settings.on") : t("settings.off");
    }
  };

  const row = (label: string, control: HTMLElement): HTMLElement => {
    const container = el("div", "mn-row");
    const labelElement = el("span", "mn-row-label");
    labelElement.textContent = label;
    container.append(labelElement, control);
    return container;
  };

  const render = (): void => {
    const rebuilt = el("div", "mn-screen");
    if (embedded) {
      rebuilt.classList.add(EMBEDDED_PANEL_CLASS);
    }
    fullscreenToggle = null;

    const title = el("h1", "mn-title");
    title.textContent = t("settings.title");

    const rows = el("div", "mn-rows");
    // Changer la langue retraduit chaque libellé, donc celui-ci reconstruit vraiment le panneau —
    // puis remet le focus où il était, sinon un joueur au clavier perd sa place. Proposée aussi en
    // plein combat depuis le plan 221 : l'écran de combat se réécrit tout entier, journal compris.
    const languageToggle = menuButton(getLanguage().toUpperCase(), () => {
      // Réglages réellement touchés (plan 196).
      countAction(TelemetryAction.LanguageChange);
      setLanguage(nextLanguage(getLanguage()));
      render();
      root?.querySelector<HTMLElement>("[data-testid='setting-language']")?.focus();
    });
    languageToggle.dataset.testid = "setting-language";
    rows.append(row(t("settings.language"), languageToggle));

    // Plein écran (plan 180-a) : masque la barre d'URL du navigateur, qui ampute une bande d'un
    // viewport paysage déjà à l'étroit sur téléphone. La ligne n'apparaît que si l'API existe —
    // sur iPhone elle est absente (Safari ne l'implémente pas), et une bascule inerte serait pire
    // que pas de bascule. Là-bas, c'est la ligne d'installation ci-dessous qui prend le relais.
    if (isFullscreenSupported()) {
      fullscreenToggle = menuButton(isFullscreen() ? t("settings.on") : t("settings.off"), () => {
        // Pas d'`await` avant l'appel : `toggleFullscreen` doit consommer l'activation
        // utilisateur de ce clic, sinon la demande est rejetée. Le rendu suit via
        // `fullscreenchange`, ce qui couvre aussi les sorties non déclenchées par nous
        // (Échap, geste système).
        countAction(TelemetryAction.FullscreenToggle);
        void toggleFullscreen();
      });
      fullscreenToggle.dataset.testid = "setting-fullscreen";
      rows.append(row(t("settings.fullscreen"), fullscreenToggle));
    }

    // iPhone : le plein écran ne s'obtient qu'en installant le site à l'écran d'accueil, et aucune
    // API ne peut le proposer (`beforeinstallprompt` n'existe pas sur iOS) — d'où une simple
    // marche à suivre. Masquée dès que l'app tourne déjà installée.
    if (shouldOfferIosInstall()) {
      const hint = el("span", "mn-row-hint", "setting-install-hint");
      hint.textContent = t("settings.installAppIosHint");
      rows.append(row(t("settings.installApp"), hint));
    }

    // Vitesse des combats (plan 233) : bascule Normale / Instantanée, appliquée en direct — y compris depuis
    // le menu de combat, puisque ce n'est qu'un réglage d'affichage.
    const combatSpeedToggle = menuButton(
      t(`settings.combatSpeed.${getSettings().combatSpeed}`),
      () => {
        const speed = nextCombatSpeed(getSettings().combatSpeed);
        // Réglages réellement touchés (plan 196) : le cran choisi, pour savoir lequel reste.
        countAction(COMBAT_SPEED_ACTION[speed]);
        updateSettings({ combatSpeed: speed });
        combatSpeedToggle.textContent = t(`settings.combatSpeed.${getSettings().combatSpeed}`);
      },
    );
    combatSpeedToggle.dataset.testid = "setting-combat-speed";
    rows.append(row(t("settings.combatSpeed"), combatSpeedToggle));

    // Le son (plan 238) : une sourdine en icône et un curseur de volume, comme une app ordinaire. La
    // sourdine garde le volume ; toucher au curseur réactive le son.
    const volumeControl = el("div", "mn-volume");
    const volumeSlider = el("input", undefined, "setting-volume");
    volumeSlider.type = "range";
    volumeSlider.min = "0";
    volumeSlider.max = String(MAX_VOLUME);
    volumeSlider.step = String(VOLUME_STEP);
    volumeSlider.value = String(getSettings().volume);
    volumeSlider.setAttribute("aria-label", t("settings.volume"));
    const toggleMute = (): void => {
      const settings = getSettings();
      if (!settings.muted && settings.volume === 0) {
        // Le curseur à zéro n'a rien à retrouver : la sourdine rend un volume audible.
        updateSettings({ volume: UNMUTED_VOLUME });
        volumeSlider.value = String(UNMUTED_VOLUME);
      } else {
        if (!settings.muted) {
          countAction(TelemetryAction.VolumeMute);
        }
        updateSettings({ muted: !settings.muted });
      }
      refreshMuteToggle(muteToggle);
    };
    const muteToggle = menuButton("", toggleMute);
    muteToggle.dataset.testid = "setting-mute";
    refreshMuteToggle(muteToggle);
    // Au clavier et à la manette, ↑ ↓ arrivent sur le curseur, qui garde ← → pour lui : valider
    // dessus coupe ou remet le son, sans avoir à rejoindre le bouton. Entrée au clavier ; à la
    // manette, A produit un `click()` synthétique (`detail` nul), qu'un vrai clic de souris n'est pas.
    volumeSlider.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        toggleMute();
      }
    });
    volumeSlider.addEventListener("click", (event) => {
      if (event.detail === 0) {
        toggleMute();
      }
    });
    volumeSlider.addEventListener("input", () => {
      updateSettings({ volume: Number(volumeSlider.value), muted: false });
      refreshMuteToggle(muteToggle);
    });
    // Une fois par ouverture du panneau : au clavier et à la manette, `change` part à chaque cran.
    volumeSlider.addEventListener("change", () => countAction(TelemetryAction.VolumeChange), {
      once: true,
    });
    volumeControl.append(muteToggle, volumeSlider);
    rows.append(row(t("settings.volume"), volumeControl));

    const turnCriesToggle = menuButton(t(`settings.turnCries.${getSettings().turnCries}`), () => {
      const turnCries = nextInCycle(TURN_CRIES, getSettings().turnCries);
      countAction(TURN_CRIES_ACTION[turnCries]);
      updateSettings({ turnCries });
      turnCriesToggle.textContent = t(`settings.turnCries.${turnCries}`);
    });
    turnCriesToggle.dataset.testid = "setting-turn-cries";
    rows.append(row(t("settings.turnCries"), turnCriesToggle));

    const controls = menuButton(t("settings.configure"), onOpenControls);
    controls.dataset.testid = "setting-controls";
    rows.append(row(t("settings.controls"), controls));

    const back = menuButton(t("settings.back"), onBack);

    rebuilt.append(title, rows, back);
    // Reconstruction en place quand le panneau est déjà monté (changement de langue) — l'hôte n'a
    // rien à re-brancher. Premier rendu : personne ne nous a encore accroché, on se contente d'être.
    root?.replaceWith(rebuilt);
    root = rebuilt;
  };

  render();
  // Le plein écran peut être quitté sans passer par la bascule (Échap, geste système) : on relit
  // l'état réel du document plutôt qu'un état local qui dériverait — mais on ne rafraîchit que
  // le libellé concerné, pas tout le panneau (plan 184 : un re-rendu perd le focus clavier).
  unbindFullscreen = onFullscreenChange(refreshFullscreenLabel);

  return {
    get element(): HTMLElement {
      // Un changement de langue reconstruit la racine : l'hôte doit lire l'actuelle, pas celle qu'il
      // a reçue au montage. `render()` a déjà tourné, donc elle existe.
      if (root === null) {
        throw new Error("settings panel used before render");
      }
      return root;
    },
    dispose() {
      unbindFullscreen?.();
      unbindFullscreen = null;
      root?.remove();
      root = null;
    },
  };
}
