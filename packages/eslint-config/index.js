// Geteilte ESLint-Flat-Config aller Next-Frontends.
//
// Warum es die überhaupt gibt: bis 01.08.2026 hatte KEINE der sieben Next-Apps
// eine ESLint-Config. Vier trugen zwar ein `lint: next lint`-Skript, das ohne
// Config aber nur interaktiv nachfragt — in CI lief nichts. Geprüft wurde
// deshalb allein `tsc`, und alles, was der Typprüfer nicht sieht (toter Code,
// vergessene Hook-Abhängigkeiten, `<img>` statt `next/image`), fiel durch.
// Belegter Schaden: `RealtimeDebugPanel` war monatelang toter Code — importiert,
// nie gerendert (NOTES.md).
//
// Bewusst schmal gehalten: nur Regeln, deren Verletzung ein ECHTER Fehler ist.
// Stil-Regeln (Anführungszeichen, Zeilenlänge) sind draußen — die erzeugen
// Rauschen und keinen Nutzen.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Pfade, die nie geprüft werden (generiert oder fremd). */
export const IGNORES = [
  "**/.next/**",
  "**/node_modules/**",
  "**/out/**",
  "**/dist/**",
  "**/build/**",
  "**/next-env.d.ts",
  "**/public/**",
  "**/*.min.js",
  // Ein Prüf-Build mit RELATIVEM `--distDir` legt sein Verzeichnis unter der App
  // an statt am absoluten Pfad: aus `--distDir private/tmp/…` wurde
  // `web/private/tmp/…` — 1,6 GB fremder Build-Ausgabe mitten im Quellcode.
  //
  // Warum das das Qualitätsgate zerstört und nicht nur Platz kostet: `bun run
  // lint` meldete damit **57 813 Fehler** aus FREMDEM Code. Jeder echte Befund
  // war darin unsichtbar. Am 12.08.2026 wurden die Fehler zweimal per `grep -v`
  // weggefiltert, statt das kaputte Gate zu melden — genau die Art Pflaster, die
  // hier nicht vorkommen soll.
  //
  // Der `.gitignore`-Eintrag `web/private/` allein half NICHT: er steht in der
  // Wurzel, und diese Config las bis 12.08.2026 nur die `.gitignore` der App
  // (siehe `nextConfig`). Darum steht die Sperre hier — sie gilt für alle sechs
  // Frontends, ohne dass jede ihre eigene Ignore-Datei pflegen muss.
  "**/private/**",
];

/**
 * Regelbasis für eine Next-App.
 *
 * @param {{ tsconfigRootDir?: string }} [opts] — Wurzel für typisierte Regeln;
 *   ohne sie läuft die Prüfung rein syntaktisch (schneller, aber blind für
 *   Typwissen). Die Apps geben `import.meta.dirname` mit.
 */
export function nextConfig(opts = {}) {
  // Was git nicht versioniert, ist Build-Ausgabe und wird nicht geprüft —
  // sonst lintet man fremde Bundles (storybook/protected: 26 000 Befunde aus
  // mermaid, axe & Co.). ESLint 9+ liest .gitignore nicht mehr von selbst.
  //
  // BEIDE Ebenen, und das ist der Punkt: bis 12.08.2026 wurde nur die
  // `.gitignore` der App gelesen. Der Eintrag, der 1,6 GB verirrte Build-Ausgabe
  // ausschloss (`web/private/`), steht aber in der WURZEL — er griff also nie,
  // und `bun run lint` meldete 57 813 Fremdfehler. Eine Ignore-Regel, die git
  // beachtet und der Linter nicht, ist eine Falle: sie versteckt den Ordner in
  // `git status` und lässt ihn gleichzeitig das Qualitätsgate blenden.
  const gitignore = [
    opts.tsconfigRootDir && join(opts.tsconfigRootDir, ".gitignore"),
    // Wurzel des Monorepos — eine Ebene über der App.
    opts.tsconfigRootDir && join(opts.tsconfigRootDir, "..", ".gitignore"),
  ]
    .filter((pfad) => pfad && existsSync(pfad))
    .map((pfad) => includeIgnoreFile(pfad));

  return [
    { ignores: IGNORES },
    ...gitignore,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ["**/*.{ts,tsx,js,jsx,mjs}"],
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: {
          projectService: Boolean(opts.tsconfigRootDir),
          tsconfigRootDir: opts.tsconfigRootDir,
        },
      },
      plugins: {
        "@next/next": nextPlugin,
        "react-hooks": reactHooks,
        // `react` und `jsx-a11y` sind REGISTRIERT, ihre Regelsätze aber nicht
        // aktiviert. Grund: im Bestand stehen `eslint-disable`-Kommentare für
        // Regeln dieser Plugins (aus einer Zeit mit next/core-web-vitals-
        // Config). Ohne die Registrierung ist jeder dieser Kommentare selbst
        // ein Fehler („Definition for rule … was not found"). Einzelne Regeln
        // daraus scharf zu schalten ist ein eigener, bewusster Schritt.
        react: reactPlugin,
        "jsx-a11y": jsxA11y,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs["core-web-vitals"].rules,

        // Toter Code — genau die Klasse, die uns das nie gerenderte
        // Debug-Overlay eingebracht hat. Ein führender Unterstrich markiert
        // bewusst Ungenutztes (destrukturiertes Weglassen, Signatur-Platzhalter).
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            ignoreRestSiblings: true,
          },
        ],

        // Vergessene Abhängigkeit = veralteter State im UI. Als Fehler, nicht
        // als Warnung: Warnungen liest in CI niemand.
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error",

        // `any` schleift die Typprüfung, gegen die wir sonst alles absichern —
        // aber der Bestand trägt es an vielen Stellen. Warnung statt Fehler:
        // sichtbar, ohne die Einführung des Gates zu blockieren.
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
    {
      // Reine JS-Dateien (Konfigurationen, kleine Build-Skripte) stehen in
      // keiner tsconfig. Der Project-Service bricht an ihnen ab, und typisierte
      // Regeln haben dort ohnehin keine Grundlage → Typwissen aus, Node-Globals
      // an. Geprüft wird weiter, nur eben rein syntaktisch.
      files: ["**/*.{js,mjs,cjs}"],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: {
        globals: globals.node,
        parserOptions: { projectService: false, project: false },
      },
    },
  ];
}

export default nextConfig();
