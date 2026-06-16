import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.mdx",
    "../components/**/*.mdx",
    "../components/**/*.stories.@(ts|tsx)",
    "../stories/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-themes",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-designs",
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
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      "@": projectRoot.replace(/\/$/, ""),
    };
    // Automatischer JSX-Runtime: JSX wird zu jsx()-Aufrufen, kein globales
    // `React` nötig. Verhindert "React is not defined" im Production-Build,
    // da tsconfig.json bewusst "jsx": "preserve" für Next.js nutzt.
    cfg.esbuild = {
      ...(cfg.esbuild ?? {}),
      jsx: "automatic",
    };
    // "use client"-Direktiven (Next.js/Radix) sind im Storybook-Bundle bedeutungslos.
    // Rollup-Warnungen dazu unterdrücken, damit der Build-Log sauber bleibt.
    cfg.build = cfg.build ?? {};
    cfg.build.rollupOptions = cfg.build.rollupOptions ?? {};
    const prevOnwarn = cfg.build.rollupOptions.onwarn;
    cfg.build.rollupOptions.onwarn = (warning, warn) => {
      if (
        warning.code === "MODULE_LEVEL_DIRECTIVE" &&
        /use client/.test(warning.message)
      ) {
        return;
      }
      if (typeof prevOnwarn === "function") prevOnwarn(warning, warn);
      else warn(warning);
    };
    return cfg;
  },
};

export default config;
