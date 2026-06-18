module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Inline-Styles sind bewusst genutzt (1:1 aus dem Design-Mockup portiert) —
    // die reine Stil-Regel würde sonst hunderte Hinweise erzeugen.
    'react-native/no-inline-styles': 'off',
    // Tab-Navigatoren definieren tabBarIcon als Render-Funktion (hier ok).
    'react/no-unstable-nested-components': 'off',
  },
};
