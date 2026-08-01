// ESLint-Flat-Config dieser App — Regeln kommen zentral aus
// packages/eslint-config (eine Basis für alle Next-Frontends, ADR-0016).
// App-eigene Ausnahmen gehören HIERHIN, nicht in die geteilte Basis.
import { nextConfig } from "@nextdays/eslint-config";

export default [
  ...nextConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Story-`render`-Funktionen und Decorators SIND Komponenten — Storybook
    // rendert sie als solche. Die Regel erkennt das an der Kleinschreibung
    // nicht (`render: () => {…}`) und meldet jeden `useState` darin. Bekannter
    // Fehlalarm, kein Hook-Verstoß.
    files: [".storybook/**/*.{ts,tsx}", "**/*.stories.{ts,tsx}"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // next.config.ts steht bewusst in keiner tsconfig (Next lädt sie selbst) —
    // ohne diese Ausnahme bricht der typisierte Parser daran ab.
    files: ["next.config.ts"],
    languageOptions: { parserOptions: { projectService: false, project: false } },
  },
];
