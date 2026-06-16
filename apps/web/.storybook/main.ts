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
    return cfg;
  },
};

export default config;
