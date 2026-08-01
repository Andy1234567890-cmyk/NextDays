// Spiegel von auth.test.ts für die ZWEITE Auth-Welt (lib/guestAuth.ts,
// portal_guest). Die Gast-Session dupliziert die Refresh-/Single-Flight-Logik
// der Tenant-Session — bisher ungetestet. Nach der App-Aufteilung (ADR-0019)
// erbt die Marktplatz-App genau diesen Code, deshalb muss er eigene Tests haben.
// Geprüfte Garantien:
// - Login speichert access+refresh im Keychain (EIGENE Service-Namen)
// - refreshGuestSession ist single-flight (parallele Aufrufe → EIN Request)
// - refresh-401 → Tokens gelöscht (fail-closed)
// - Netzfehler beim Refresh → Tokens BLEIBEN (transient ≠ Logout)
// - Token-Listener (Realtime-setAuth) feuert bei Login und Logout

export {}; // Datei als Modul markieren (sonst globaler Scope-Konflikt)

type GuestAuthModule = typeof import("../guestAuth");

const SESSION = {
  access_token: "gacc-1",
  refresh_token: "gref-1",
  token_type: "bearer",
  expires_in: 3600,
};

// guestApi liest Erfolgsantworten über res.text() (nicht res.json()) — der Mock
// muss deshalb BEIDE Wege bedienen, sonst schlägt schon der Login fehl.
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

// Frische Modul-Instanz pro Test (guestAuth.ts hält Modul-State: Caches, inFlight).
function loadGuestAuth(): GuestAuthModule {
  let mod: GuestAuthModule;
  jest.isolateModules(() => {
    mod = require("../guestAuth");
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

test("guestLogin speichert beide Tokens unter den GAST-Service-Namen", async () => {
  const gast = loadGuestAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION));

  const res = await gast.guestLogin("gast@b.c", "pw");

  expect(res.ok).toBe(true);
  expect(await gast.getGuestToken()).toBe("gacc-1");
  const keychain = require("react-native-keychain");
  const stored = [...keychain.__store.keys()];
  // Eigene Service-Namen: die Gast-Session darf die Tenant-Session nie überschreiben.
  expect(stored).toEqual(
    expect.arrayContaining(["mybestdays.guest.ndg_access", "mybestdays.guest.ndg_refresh"]),
  );
  expect(stored).not.toEqual(expect.arrayContaining(["nextdays.auth.nd_access"]));
});

test("refreshGuestSession ist single-flight: zwei parallele Aufrufe → EIN Request", async () => {
  const gast = loadGuestAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION));
  await gast.guestLogin("gast@b.c", "pw");
  fetchMock.mockClear();

  // Refresh-Antwort künstlich verzögern, damit beide Aufrufe überlappen.
  let release!: (r: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)));

  const p1 = gast.refreshGuestSession();
  const p2 = gast.refreshGuestSession();
  release(jsonResponse(200, { ...SESSION, access_token: "gacc-2", refresh_token: "gref-2" }));

  expect(await p1).toBe(true);
  expect(await p2).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/guest-auth/refresh");
  expect(await gast.getGuestToken()).toBe("gacc-2");
});

test("refresh mit 401 → fail-closed: beide Gast-Tokens gelöscht", async () => {
  const gast = loadGuestAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION));
  await gast.guestLogin("gast@b.c", "pw");

  fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Sitzung abgelaufen." }));
  expect(await gast.refreshGuestSession()).toBe(false);

  expect(await gast.getGuestToken()).toBeNull();
  const keychain = require("react-native-keychain");
  expect(keychain.__store.size).toBe(0);
});

test("Netzfehler beim Refresh → nicht erneuert, aber Tokens bleiben", async () => {
  const gast = loadGuestAuth();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION));
  await gast.guestLogin("gast@b.c", "pw");

  fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  expect(await gast.refreshGuestSession()).toBe(false);

  // Transienter Ausfall ist KEIN Logout.
  expect(await gast.getGuestToken()).toBe("gacc-1");
});

test("ohne Refresh-Token → false und ausgeloggter Zustand", async () => {
  const gast = loadGuestAuth();
  expect(await gast.refreshGuestSession()).toBe(false);
  expect(await gast.getGuestToken()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("Token-Listener feuert bei Login und Logout (Realtime-setAuth hängt daran)", async () => {
  const gast = loadGuestAuth();
  const gesehen: (string | null)[] = [];
  gast.onGuestTokenChange((token) => gesehen.push(token));

  fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION));
  await gast.guestLogin("gast@b.c", "pw");
  await gast.guestLogout();

  expect(gesehen).toEqual(["gacc-1", null]);
});
