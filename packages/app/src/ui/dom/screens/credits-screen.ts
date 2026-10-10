import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import type { TranslationKey } from "../../../i18n/types";
import { InputSource } from "../../../input/input-source";
import { bindScreenInput, el, menuButton } from "./elements";

interface CreditEntry {
  label: TranslationKey;
  /** Who made it — a proper name, never translated. */
  source: string;
  url?: string;
  license?: string;
}

interface CreditSection {
  title: TranslationKey;
  entries: readonly CreditEntry[];
}

/** Mirror of `CREDITS.md`: every shipped third-party asset, grouped as the screen shows them. */
const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    title: "credits.section.graphics",
    entries: [
      {
        label: "credits.label.sprites",
        source: "PMDCollab",
        url: "https://sprites.pmdcollab.org",
        license: "CC BY-NC 4.0",
      },
      // Custom tiles built from the PMD game textures (`CREDITS.md`): no SpriteCollab license to claim.
      { label: "credits.label.tileset", source: "Pokémon Mystery Dungeon" },
      {
        label: "credits.label.moveEffects",
        source: "PMD Origins",
        url: "https://github.com/PMDCollab/RawAsset",
      },
    ],
  },
  {
    title: "credits.section.interface",
    entries: [
      {
        label: "credits.label.itemIcons",
        source: "Pokémon Showdown",
        url: "https://play.pokemonshowdown.com",
      },
      {
        label: "credits.label.uiIcons",
        source: "Poképédia",
        url: "https://www.pokepedia.fr",
      },
      {
        label: "credits.label.inputPrompts",
        source: "Kenney",
        url: "https://kenney.nl/assets/input-prompts-pixel-1-bit",
        license: "CC0",
      },
      {
        label: "credits.label.cursors",
        source: "Kenney",
        url: "https://kenney.nl/assets/cursor-pixel-pack",
        license: "CC0",
      },
    ],
  },
  {
    title: "credits.section.sound",
    entries: [
      {
        label: "credits.label.moveSounds",
        source: "Pokémon Reborn",
        url: "https://www.rebornevo.com",
      },
      {
        label: "credits.label.hitSounds",
        source: "PokeRogue",
        url: "https://github.com/pagefaultgames/pokerogue-assets",
      },
      {
        label: "credits.label.cries",
        source: "PokeAPI",
        url: "https://github.com/PokeAPI/cries",
      },
    ],
  },
  {
    title: "credits.section.font",
    entries: [
      {
        label: "credits.label.font",
        source: "crystalwalrein",
        url: "https://fontstruct.com/fontstructions/show/832818",
        license: "CC BY-SA 3.0",
      },
    ],
  },
  {
    title: "credits.section.code",
    entries: [{ label: "credits.label.code", source: "Claude (Anthropic)" }],
  },
];

function creditSource(entry: CreditEntry): HTMLElement {
  if (!entry.url) {
    const source = el("span");
    source.textContent = entry.source;
    return source;
  }
  const link = el("a", "mn-credits-link", "credits-link");
  link.href = entry.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  // `tabindex="0"` is how a link enters the arrow-key navigation (`FOCUSABLE_SELECTOR`). The gamepad
  // skips it: a pad press is not a user activation, so the browser would block the new tab.
  link.tabIndex = 0;
  link.dataset.navSkip = InputSource.Gamepad;
  link.textContent = `${entry.source} ↗`;
  return link;
}

function creditRow(entry: CreditEntry): HTMLLIElement {
  const row = el("li", "mn-credits-row");
  const label = el("span", "mn-credits-label");
  label.textContent = t(entry.label);
  row.append(label, creditSource(entry));
  if (entry.license) {
    const license = el("span", "mn-credits-license");
    license.textContent = entry.license;
    row.append(license);
  }
  return row;
}

/** Credits screen: attributions grouped by section, sources as links, legal notice at the bottom. */
export function createCreditsScreen(navigate: Navigate): Screen<"credits"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      // Est-ce que quelqu'un lit les attributions ? (plan 196)
      countScreen(TelemetryScreen.Credits);
      root = el("div", "mn-screen mn-credits-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("credits.title");

      const content = el("div", "mn-credits");
      for (const section of CREDIT_SECTIONS) {
        const heading = el("h2", "mn-credits-section");
        heading.textContent = t(section.title);
        const list = el("ul", "mn-credits-list");
        list.append(...section.entries.map(creditRow));
        content.append(heading, list);
      }

      const disclaimer = el("p", "mn-credits-disclaimer");
      disclaimer.textContent = t("credits.disclaimer");

      const back = menuButton(t("credits.back"), goBack);
      root.append(title, content, disclaimer, back);
      host.append(root);
      unbindScreenInput = bindScreenInput(goBack);
      // The keyboard start point is « Retour », never a link: a stray Enter must not open a source
      // in a new tab.
      if (content.contains(document.activeElement)) {
        back.focus();
      }
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
    },
  };
}
