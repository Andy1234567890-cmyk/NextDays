import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)", "../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-themes"],
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
    return cfg;
  },
};

export default config;
