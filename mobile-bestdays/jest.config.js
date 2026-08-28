// Jest-Konfiguration (bare RN). Das RN-Preset transformiert per Default nur
// node_modules/<pkg>; Store-basierte Installer (pnpm, bun) legen Pakete unter
// einem Zwischenpfad ab, deshalb ist der optionale .pnpm-Teil im Ignore-Pattern
// (sonst: "Cannot use import statement outside a module" aus
// @react-native/jest-preset/jest/setup.js).
module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community|-documents)?|@react-navigation|react-native-.*)/)',
  ],
};
