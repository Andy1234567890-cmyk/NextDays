import { withThemeByClassName } from "@storybook/addon-themes";
import type { Decorator, Preview } from "@storybook/react";
import { useEffect } from "react";

// Lädt die echten Theme-Tokens (gleiche Quelle wie die App).
import "../styles/globals.css";

// Sprach-Umschalter (DE/EN): setzt data-doc-lang am <html>. Die <Lang>-Komponente
// (components/docs/lang) blendet den passenden Block ein. Default: Deutsch.
const withDocLang: Decorator = (Story, context) => {
  const lang = (context.globals.docLang as string) ?? "de";
  useEffect(() => {
    document.documentElement.setAttribute("data-doc-lang", lang);
  }, [lang]);
  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true }, // Hintergrund kommt aus den Tokens
  },
  // Globale Sprachwahl für die Doku-Seiten (DE/EN).
  globalTypes: {
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
  // Light/Dark-Umschalter in der Storybook-Toolbar (.dark auf <html>).
  decorators: [
    withDocLang,
    withThemeByClassName({
      themes: { Light: "", Dark: "dark" },
      defaultTheme: "Light",
    }),
  ],
};

export default preview;
