import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";

// Lädt die echten Theme-Tokens (gleiche Quelle wie die App).
import "../styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true }, // Hintergrund kommt aus den Tokens
  },
  // Light/Dark-Umschalter in der Storybook-Toolbar (.dark auf <html>).
  decorators: [
    withThemeByClassName({
      themes: { Light: "", Dark: "dark" },
      defaultTheme: "Light",
    }),
  ],
};

export default preview;
