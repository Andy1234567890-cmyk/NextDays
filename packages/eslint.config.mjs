// ESLint für die geteilten Pakete (packages/@nextdays/*).
//
// Wie bei der Typprüfung (packages/tsconfig.json): die Frontends prüfen nur,
// was sie importieren — ungenutzter geteilter Code bliebe sonst ungeprüft.
// Regeln kommen aus packages/eslint-config, damit hier und in den Apps
// dieselben gelten.
import { nextConfig } from "@nextdays/eslint-config";

export default [
  { ignores: ["eslint-config/**"] },
  ...nextConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // `packages/` ist keine Next-App: die Regel sucht ein pages/-Verzeichnis
    // und warnt bei jedem Lauf, dass es keines gibt. In den Apps greift sie.
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
];
