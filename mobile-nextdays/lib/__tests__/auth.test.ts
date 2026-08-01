// Tests für die P1-Garantien der Token-Verwaltung (lib/auth.ts):
// - Login speichert access+refresh im Keychain
// - refreshSession ist single-flight (parallele Aufrufe → EIN /auth/refresh)
// - refresh-401 → Tokens gelöscht (fail-closed)
// - Netzfehler beim Refresh → Tokens BLEIBEN (transient ≠ Logout)
// fetch wird gemockt; der Keychain-Mock (jest.setup.js) speichert echt in einer Map.

export {}; // Datei als Modul markieren (sonst globaler Scope-Konflikt mit api.test.ts)

type AuthModule = typeof import("../auth");

const SESSION = {
  access_token: "acc-1",
  refresh_token: "ref-1",
  token_type: "bearer",
  expires_in: 3600,
};

// /auth/login liefert NICHT die Session flach, sondern die LoginResponse-Hülle
// (auth/schemas.py). Der frühere Mock war flach — deshalb fiel nicht auf, dass
// der Client `access_token: undefined` speicherte und /auth/me danach kippte.
// /auth/register und /auth/refresh bleiben flach.
const LOGIN_OK = { mfa_required: false, session: SESSION };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// Frische Modul-Instanz pro Test (auth.ts hält Modul-State: Caches, inFlight).
function loadAuth(): AuthModule {
  let mod: AuthModule;
  jest.isolateModules(() => {
    mod = require("../auth");
  });
  return mod!;
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  const keychain = require("react-native-keychain");
  keychain.__store.clear();
});

test("login speichert access- und refresh-Token im Keychain", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, LOGIN_OK));

  const res = await auth.login("a@b.c", "pw");

  expect(res.ok).toBe(true);
  expect(await auth.getToken()).toBe("acc-1");
  const keychain = require("react-native-keychain");
  const stored = [...keychain.__store.keys()];
  expect(stored).toEqual(
    expect.arrayContaining(["mynextdays.auth.nd_access", "mynextdays.auth.nd_refresh"]),
  );
});

test("refreshSession ist single-flight: zwei parallele Aufrufe → EIN Request", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, LOGIN_OK));
  await auth.login("a@b.c", "pw");
  fetchMock.mockClear();

  // Refresh-Antwort künstlich verzögern, damit beide Aufrufe überlappen.
  let release!: (r: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)));

  const p1 = auth.refreshSession();
  const p2 = auth.refreshSession();
  release(jsonResponse(200, { ...SESSION, access_token: "acc-2", refresh_token: "ref-2" }));

  expect(await p1).toBe(true);
  expect(await p2).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/auth/refresh");
  expect(await auth.getToken()).toBe("acc-2");
});

test("refresh mit 401 → fail-closed: beide Tokens gelöscht", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, LOGIN_OK));
  await auth.login("a@b.c", "pw");

  fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Sitzung abgelaufen." }));
  expect(await auth.refreshSession()).toBe(false);

  expect(await auth.getToken()).toBeNull();
  const keychain = require("react-native-keychain");
  expect(keychain.__store.size).toBe(0);
});

test("Netzfehler beim Refresh → nicht erneuert, aber Tokens bleiben", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, LOGIN_OK));
  await auth.login("a@b.c", "pw");

  fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  expect(await auth.refreshSession()).toBe(false);

  // Transienter Ausfall ist KEIN Logout.
  expect(await auth.getToken()).toBe("acc-1");
});

test("ohne Refresh-Token → false und ausgeloggter Zustand", async () => {
  const auth = loadAuth();
  expect(await auth.refreshSession()).toBe(false);
  expect(await auth.getToken()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("login liefert die LoginResponse-Hülle — Session wird daraus entpackt", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, LOGIN_OK));

  expect((await auth.login("a@b.c", "pw")).ok).toBe(true);
  expect(await auth.getToken()).toBe("acc-1");
});

test("2FA-Konto: mfa_required → fail-closed, KEINE halbe Session", async () => {
  const auth = loadAuth();
  fetchMock.mockResolvedValueOnce(
    jsonResponse(200, { mfa_required: true, session: null, mfa_token: "pending-1" }),
  );

  const res = await auth.login("a@b.c", "pw");

  expect(res.ok).toBe(false);
  expect(await auth.getToken()).toBeNull();
  const keychain = require("react-native-keychain");
  expect(keychain.__store.size).toBe(0);
});
