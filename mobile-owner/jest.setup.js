// Globales Test-Setup: Mocks für native Module, die im Node-Testlauf keine
// native Seite haben. Der Keychain-Mock ist eine In-Memory-Map pro Service —
// damit testen die auth-Tests echtes Speichern/Löschen statt nur Stub-Aufrufe.
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    __store: store,
    setGenericPassword: jest.fn(async (username, password, opts) => {
      store.set((opts && opts.service) || 'default', { username, password });
      return { service: (opts && opts.service) || 'default', storage: 'mock' };
    }),
    getGenericPassword: jest.fn(async (opts) => {
      const v = store.get((opts && opts.service) || 'default');
      return v ? { username: v.username, password: v.password } : false;
    }),
    resetGenericPassword: jest.fn(async (opts) => {
      store.delete((opts && opts.service) || 'default');
      return true;
    }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// Kein echter Netzwerkverkehr im Testlauf: Screens laden beim Mounten Daten
// (Inserate, Profil). Ohne Mock liefe der Fetch gegen die echte API weiter und
// würde nach dem Testende State setzen. Antwort ist bewusst LEER — die Screens
// müssen den Leerzustand aushalten, ohne Daten zu erfinden.
global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ items: [], total: 0 }),
  text: async () => JSON.stringify({ items: [], total: 0 }),
}));

// react-native-quick-crypto hat eine native Seite (Nitro/TurboModule) und ist
// im Node-Testlauf nicht ladbar — ohne diesen Mock scheitert JEDE Suite, die
// die App rendert, an `TurboModuleRegistry.getEnforcing('QuickBase64')`.
//
// Der Mock rechnet BEWUSST NICHT: er wirft bei jedem Krypto-Aufruf. Ein Mock,
// der plausible Bytes zurückgibt, würde Tests grün färben, die in Wahrheit
// nichts über die Verschlüsselung aussagen — genau die Art Test, die grün ist,
// während die Sache kaputt ist. Die Krypto-Kette wird auf dem GERÄT geprüft
// (ADR-0029), nicht hier.
jest.mock('react-native-quick-crypto', () => {
  const nichtImTest = () => {
    throw new Error(
      'Krypto im Jest-Lauf nicht verfügbar — auf dem Gerät prüfen (ADR-0029).',
    );
  };
  return {
    __esModule: true,
    default: {
      randomBytes: nichtImTest,
      createCipheriv: nichtImTest,
      createDecipheriv: nichtImTest,
      hkdfSync: nichtImTest,
      argon2Sync: nichtImTest,
      Ed: function Ed() {
        nichtImTest();
      },
      KFormatType: { DER: 0 },
      KeyEncoding: { SPKI: 0, PKCS8: 1 },
    },
  };
});
