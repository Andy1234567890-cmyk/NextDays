// Jest-Konfiguration (bare RN). Das RN-Preset transformiert per Default nur
// node_modules/<pkg>; Store-basierte Installer (pnpm, bun) legen Pakete unter
// einem Zwischenpfad ab, deshalb ist der optionale .pnpm-Teil im Ignore-Pattern
// (sonst: "Cannot use import statement outside a module" aus
// @react-native/jest-preset/jest/setup.js).
//
// @react-native-firebase/@firebase muessen ebenfalls transformiert werden: das
// Paket liefert NUR ESM (`main: ./dist/module/index.js`, kein CJS unter dist/).
// Ohne Transformation bricht schon der Import mit "Cannot use import statement
// outside a module" — kein Fehler unseres Codes, sondern die Paketform.
// Genau so haelt es react-native-firebase in seiner EIGENEN jest.config.js
// (`@firebase` steht dort in der Negation des Ignore-Patterns).

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|@react-native-firebase|@firebase|@react-navigation|react-native-.*)/)',
  ],
};
