import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import {
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "../../../platform/fullscreen";
import { shouldOfferIosInstall } from "../../../platform/pwa";
import { getSettings, updateSettings } from "../../../settings";
import { el, menuButton } from "../screens/elements";
import { EMBEDDED_PANEL_CLASS, type Panel, type PanelOptions } from "./panel";

export interface SettingsPanelOptions extends PanelOptions {
  /** Ouvrir les Contrôles — un écran de la FSM côté Réglages, un niveau de plus côté modale. */
  readonly onOpenControls: () => void;
}

/**
 * Réglages : langue, prévisualisation de dégâts, plein écran, accès aux Contrôles.
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

    const damagePreviewToggle = menuButton(
      getSettings().damagePreview ? t("settings.on") : t("settings.off"),
      () => {
        updateSettings({ damagePreview: !getSettings().damagePreview });
        // Only this label changes — mutate it in place. Rebuilding the whole subtree used to drop the
        // focus to `<body>` on every toggle, which makes keyboard and gamepad navigation unusable
        // (plan 184, dette rapatriée du Lot 3 / décision #752).
        damagePreviewToggle.textContent = getSettings().damagePreview
          ? t("settings.on")
          : t("settings.off");
      },
    );
    damagePreviewToggle.dataset.testid = "setting-damage-preview";

    const rows = el("div", "mn-rows");
    /*
     * La LANGUE n'est pas proposée en cours de combat (revue de code 2026-08-25).
     *
     * Ce n'est pas un oubli mais un refus : `runBattle` résout les noms via une langue capturée une
     * fois, et surtout les lignes DÉJÀ ÉCRITES du journal sont du texte DOM figé. Basculer en pleine
     * partie donnerait donc un journal mi-français mi-anglais — et rendre la résolution « vivante »
     * ne suffirait pas, il faudrait re-render tout l'historique. C'est précisément le chantier
     * « migration i18n du journal de combat » déjà en attente (`docs/next.md`) : jusque-là, mieux vaut
     * ne pas offrir le bouton que livrer deux langues à l'écran. La langue se règle depuis le menu
     * principal, où aucun combat ne tourne.
     */
    if (!embedded) {
      // Changer la langue retraduit chaque libellé, donc celui-ci reconstruit vraiment le panneau —
      // puis remet le focus où il était, sinon un joueur au clavier perd sa place.
      const languageToggle = menuButton(getLanguage() === Language.French ? "FR" : "EN", () => {
        setLanguage(getLanguage() === Language.French ? Language.English : Language.French);
        render();
        root?.querySelector<HTMLElement>("[data-testid='setting-language']")?.focus();
      });
      languageToggle.dataset.testid = "setting-language";
      rows.append(row(t("settings.language"), languageToggle));
    }
    rows.append(row(t("settings.damagePreview"), damagePreviewToggle));

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
