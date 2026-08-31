// Tests für den Löschweg einer Aufgabe (lib/tasks.ts → DELETE /tasks/{id}).
//
// ANLASS (31.08.2026): In der App war Löschen gar nicht verdrahtet — das
// Backend führte `DELETE /tasks/{task_id}` längst und das Web rief es an zwei
// Stellen auf, `mobile-nextdays/lib/tasks.ts` hatte nur `deleteTaskCost`. Eine
// von Hand angelegte Aufgabe war in der App damit nicht mehr wegzubekommen.
//
// Der erste Test ist kein Formalismus: die AUFGABE und die AUSLAGE unterscheiden
// sich nur im Pfad (`/tasks/<id>` gegen `/tasks/costs/<id>`), und genau diese
// Nachbarschaft hat serverseitig schon einmal Schaden gemacht (23.08.2026: ein
// `DELETE /tasks/costs/<id>` landete im Aufgaben-Löscher, der Aufrufer bekam
// 404 und die Kostenzeile blieb stehen). Ein vertauschter Pfad in der App wäre
// derselbe Fehler von der anderen Seite — und er sieht im Screen genauso
// erfolgreich aus, weil beide 204/200 liefern.
export {};

type TasksModule = typeof import("../tasks");
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

function loadModules(): { tasks: TasksModule; auth: AuthModule } {
  let tasks: TasksModule;
  let auth: AuthModule;
  jest.isolateModules(() => {
    tasks = require("../tasks");
    auth = require("../auth");
  });
  return { tasks: tasks!, auth: auth! };
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  const keychain = require("react-native-keychain");
  keychain.__store.clear();
});

async function angemeldet(auth: AuthModule): Promise<void> {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(200, { mfa_required: false, session: SESSION }),
  );
  await auth.login("a@b.c", "pw");
  fetchMock.mockClear();
}

test("deleteTask trifft /tasks/<id> per DELETE — NICHT den Kosten-Pfad", async () => {
  const { tasks, auth } = loadModules();
  await angemeldet(auth);

  fetchMock.mockResolvedValueOnce(jsonResponse(204, null));

  const res = await tasks.deleteTask("t-1");

  expect(res.ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain("/api/v1/tasks/t-1");
  // Der Kosten-Pfad darf NICHT getroffen werden (Verwechslung 23.08.2026).
  expect(String(url)).not.toContain("/costs/");
  expect((init as RequestInit).method).toBe("DELETE");
});

test("Aufgaben-ID wird kodiert — ein Schrägstrich bricht nicht in einen Fremdpfad aus", async () => {
  const { tasks, auth } = loadModules();
  await angemeldet(auth);

  fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
  await tasks.deleteTask("t-1/costs/c-9");

  const url = String(fetchMock.mock.calls[0][0]);
  // Ohne encodeURIComponent stünde hier ein echter `/costs/`-Pfad und der
  // Aufruf löschte eine AUSLAGE statt der Aufgabe.
  expect(url).toContain("t-1%2Fcosts%2Fc-9");
  expect(url).not.toContain("t-1/costs/c-9");
});

test("403 ohne manage_tasks wird als Fehler durchgereicht, nicht verschluckt", async () => {
  const { tasks, auth } = loadModules();
  await angemeldet(auth);

  fetchMock.mockResolvedValueOnce(
    jsonResponse(403, { detail: "Keine Berechtigung." }),
  );

  const res = await tasks.deleteTask("t-1");

  // Fail-closed und SICHTBAR: der Screen zeigt den Text im Alert (Wurzel 5).
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.error).toContain("Keine Berechtigung");
});

test("404 bei fremdem Objekt-Scope kommt als Fehler zurück", async () => {
  const { tasks, auth } = loadModules();
  await angemeldet(auth);

  // Der Server prüft im Item-Pfad denselben Objekt-Scope wie die Liste
  // (Wurzel 9) und antwortet für eine Aufgabe außerhalb mit 404 — nicht 204.
  fetchMock.mockResolvedValueOnce(
    jsonResponse(404, { detail: "Aufgabe nicht gefunden." }),
  );

  const res = await tasks.deleteTask("fremd-1");

  expect(res.ok).toBe(false);
});
