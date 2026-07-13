// Jest-Konfiguration (bare RN + pnpm). Das RN-Preset transformiert per Default
// nur node_modules/<pkg> — pnpm legt Pakete aber unter
// node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg> ab, deshalb braucht das
// Ignore-Pattern den optionalen .pnpm-Zwischenpfad (sonst: "Cannot use import
// statement outside a module" aus @react-native/jest-preset/jest/setup.js).
module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
