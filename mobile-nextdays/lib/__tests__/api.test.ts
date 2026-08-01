// Tests für die P1-Garantien des API-Clients (lib/api.ts):
// - 401 → GENAU EIN Refresh + EIN Retry (kein Loop)
// - Refresh schlägt fehl → ursprünglicher 401 wird geworfen, kein Retry
// - Auth-Pfade (login/register/refresh) lösen NIE den Refresh-Zyklus aus
// api.ts und auth.ts werden zusammen geladen (echte Verdrahtung), nur fetch
// und Keychain (jest.setup.js) sind gemockt.

export {}; // Datei als Modul markieren (sonst globaler Scope-Konflikt mit auth.test.ts)

type ApiModule = typeof import("../api");
type AuthModule = typeof import("../auth");

const SESSION = {
  access_token: "acc-1",
  refresh_token: "ref-1",
  token_type: "bearer",
  expires_in: 3600,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function loadModules(): { api: ApiModule; auth: AuthModule } {
  let api: ApiModule;
  let auth: AuthModule;
  jest.isolateModules(() => {
    api = require("../api");
    auth = require("../auth");
  });
  return { api: api!, auth: auth! };
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  const keychain = require("react-native-keychain");
  keychain.__store.clear();
});

async function loginWithSession(auth: AuthModule): Promise<void> {
  // /auth/login antwortet mit der LoginResponse-Hülle (auth/schemas.py), nicht
  // flach mit der Session — sonst hätte der Login hier gar kein Token gesetzt.
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { mfa_required: false, session: SESSION }));
  await auth.login("a@b.c", "pw");
  fetchMock.mockClear();
}

test("401 → genau ein Refresh, dann Retry mit neuem Token", async () => {
  const { api, auth } = loadModules();
  await loginWithSession(auth);

  fetchMock
    .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" })) // 1: /properties
    .mockResolvedValueOnce(
      jsonResponse(200, { ...SESSION, access_token: "acc-2", refresh_token: "ref-2" }),
    ) // 2: /auth/refresh
    .mockResolvedValueOnce(jsonResponse(200, [{ id: "p1" }])); // 3: Retry /properties

  const data = await api.api<{ id: string }[]>("/properties");

  expect(data).toEqual([{ id: "p1" }]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(fetchMock.mock.calls[1][0])).toContain("/api/v1/auth/refresh");
  // Retry trägt das NEUE Token.
  const retryHeaders = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<
    string,
    string
  >;
  expect(retryHeaders.Authorization).toBe("Bearer acc-2");
});

test("Refresh schlägt fehl → 401 bleibt, kein zweiter Retry", async () => {
  const { api, auth } = loadModules();
  await loginWithSession(auth);

  fetchMock
    .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" })) // /properties
    .mockResolvedValueOnce(jsonResponse(401, { detail: "revoked" })); // /auth/refresh

  await expect(api.api("/properties")).rejects.toMatchObject({ status: 401 });
  // Genau 2 Calls: Original + Refresh — KEIN Retry, kein Loop.
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // Fail-closed: Session ist weg.
  expect(await auth.getToken()).toBeNull();
});

test.each(["/auth/login", "/auth/register", "/auth/refresh"])(
  "Auth-Pfad %s: 401 löst KEINEN Refresh-Zyklus aus",
  async (path) => {
    const { api, auth } = loadModules();
    await loginWithSession(auth);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "nope" }));

    await expect(api.api(path, { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

test("Netzfehler → ApiError 503 mit deutscher Meldung", async () => {
  const { api } = loadModules();
  fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));

  await expect(api.api("/properties")).rejects.toMatchObject({
    status: 503,
    message: "Backend nicht erreichbar.",
  });
});
