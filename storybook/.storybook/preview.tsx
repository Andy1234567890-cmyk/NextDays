import { DocsContainer } from "@storybook/blocks";
import type { Decorator, Preview } from "@storybook/react";
import { useEffect } from "react";

// Lädt die echten Theme-Tokens (gleiche Quelle wie die App).
import "../styles/globals.css";

// Theme (.dark) + Doku-Sprache (data-doc-lang) auf <html> anwenden.
function applyGlobals(theme: string, lang: string): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "Dark");
  root.setAttribute("data-doc-lang", lang);
}

// Globals aus der Storybook-URL lesen. Storybook schreibt die Toolbar-Auswahl
// immer als `?globals=theme:Dark;docLang:en` in die URL — das ist die einzige
// Quelle, die SOWOHL im Story-Canvas ALS AUCH in reinen MDX-Doku-Seiten
// verlässlich verfügbar ist (dort laufen keine Story-Decorators).
function readGlobalsFromUrl(): { theme: string; lang: string } {
  let theme = "Light";
  let lang = "de";
  try {
    const raw = new URLSearchParams(window.location.search).get("globals") ?? "";
    for (const pair of raw.split(";")) {
      const [k, v] = pair.split(":");
      if (k === "theme" && v) theme = v;
      if (k === "docLang" && v) lang = v;
    }
  } catch {
    // window/Location nicht verfügbar — Defaults greifen.
  }
  return { theme, lang };
}

// Für Story-Canvas: Decorator wendet die Globals an (context.globals sind hier
// zuverlässig vorhanden).
const withThemeAndLang: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "Light";
  const lang = (context.globals.docLang as string) ?? "de";
  useEffect(() => {
    applyGlobals(theme, lang);
  }, [theme, lang]);
  return <Story />;
};

// Für reine MDX-Doku-Seiten: eigener Docs-Container, der die Globals aus der URL
// liest und auf Änderungen reagiert (Storybook navigiert per pushState, wenn man
// die Toolbar umschaltet → popstate + kurzer Re-Check).
const ThemedDocsContainer = (props: React.ComponentProps<typeof DocsContainer>) => {
  useEffect(() => {
    const sync = () => {
      const { theme, lang } = readGlobalsFromUrl();
      applyGlobals(theme, lang);
    };
    sync();
    window.addEventListener("popstate", sync);
    // pushState löst kein popstate aus → leichtes Polling auf URL-Änderung.
    let last = window.location.search;
    const iv = window.setInterval(() => {
      if (window.location.search !== last) {
        last = window.location.search;
        sync();
      }
    }, 250);
    return () => {
      window.removeEventListener("popstate", sync);
      window.clearInterval(iv);
    };
  }, []);
  return <DocsContainer {...props} />;
};

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true }, // Hintergrund kommt aus den Tokens
    docs: { container: ThemedDocsContainer },
  },
  // Globale Toolbar-Schalter: Theme (Hell/Dunkel) + Doku-Sprache (DE/EN).
  globalTypes: {
    theme: {
      description: "Theme (Hell/Dunkel)",
      defaultValue: "Light",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "Light", title: "Hell", left: "☀️" },
          { value: "Dark", title: "Dunkel", left: "🌙" },
        ],
        dynamicTitle: true,
      },
    },
    docLang: {
      description: "Dokumentationssprache",
      defaultValue: "de",
      toolbar: {
        title: "Sprache",
        icon: "globe",
        items: [
          { value: "de", title: "Deutsch", right: "DE" },
          { value: "en", title: "English", right: "EN" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "Light", docLang: "de" },
  decorators: [withThemeAndLang],
};

export default preview;
