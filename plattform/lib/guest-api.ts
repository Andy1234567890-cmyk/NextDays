// Gemeinsames Client-Fetch-Muster für alle Gast-Domänen-Module (Result<T>-Union
// wie lib/buchung.ts). Alle Calls gehen an den Same-Origin-Proxy /api/v1/…, der
// das nd_access-Cookie als Bearer anhängt (Portal-Gast). Deutsche Fehlertexte.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type CallOpts = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** 409-Sonderfall-Text (z. B. Buchung nicht mehr verfügbar). */
  conflictMsg?: string;
};

/** Ein Gast-Endpunkt-Call gegen /api/v1/<path>. Liefert ok/data oder ok:false
 *  mit deutschem Fehlertext. 401 → deutliche "nicht angemeldet"-Meldung. */
export async function guestCall<T>(
  path: string,
  opts: CallOpts = {},
): Promise<Result<T>> {
  try {
    const res = await fetch(`/api/v1/${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      let msg: string;
      if (res.status === 401) {
        msg = "Bitte melde dich an.";
      } else if (res.status === 409 && opts.conflictMsg) {
        msg = opts.conflictMsg;
      } else {
        msg =
          (detail && typeof detail.detail === "string" && detail.detail) ||
          `Fehler ${res.status}`;
      }
      return { ok: false, error: String(msg) };
    }
    const text = await res.text();
    return { ok: true, data: (text ? JSON.parse(text) : null) as T };
  } catch {
    return { ok: false, error: "Verbindung fehlgeschlagen." };
  }
}
