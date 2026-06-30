import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

// apps/storybook/ — eigenständiges Design-System-Package (Designer-Werkstatt).
// Komponenten entstehen HIER; fertige werden später ins Web-Projekt übernommen.
const storybookRoot = fileURLToPath(new URL("..", import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-designs",
    // Rendert die globale Toolbar (Theme- + DE/EN-Sprach-Umschalter aus
    // preview.tsx globalTypes). Ohne dieses Addon erscheinen die Schalter nicht.
    // Theme/Sprache werden über einen eigenen Decorator (withThemeAndLang)
    // direkt auf <html> angewendet — wirkt in Canvas UND in MDX-Docs.
    "@storybook/addon-toolbars",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../public"],
  viteFinal: async (cfg) => {
    const tailwind = (await import("@tailwindcss/vite")).default;
    cfg.plugins = cfg.plugins ?? [];
    cfg.plugins.push(tailwind());
    cfg.resolve = cfg.resolve ?? {};
    // "@/..." löst innerhalb dieses Packages auf (Komponenten, lib, styles).
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      "@": storybookRoot.replace(/\/$/, ""),
    };
    // Automatischer JSX-Runtime: JSX wird zu jsx()-Aufrufen, kein globales
    // `React` nötig. Verhindert "React is not defined" im Production-Build,
    // da tsconfig.json bewusst "jsx": "preserve" für Next.js nutzt.
    cfg.esbuild = {
      ...(cfg.esbuild ?? {}),
      jsx: "automatic",
    };
    // "use client"-Direktiven braucht nur Next.js; im Storybook-Build (Vite/Rollup)
    // sind sie bedeutungslos und erzeugen Warnungen. Hier an der Wurzel entfernen:
    // das Plugin strippt die Direktive aus den Komponenten -> komplett sauberer Build.
    cfg.plugins.push({
      name: "strip-use-client",
      enforce: "pre" as const,
      transform(code: string, id: string) {
        if (!/\.(t|j)sx?$/.test(id)) return null;
        if (!/^\s*['"]use client['"]/.test(code)) return null;
        return {
          code: code.replace(/^\s*['"]use client['"];?\s*/, ""),
          map: null,
        };
      },
    });
    return cfg;
  },
};

export default config;
