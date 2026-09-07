"use server";

// Startseiten-Layout: Server-Actions gegen den FastAPI-Slice dashboard_layout
// (/api/v1/dashboard-layout, Migration 0402). Drei Quellen — eigenes Layout,
// Rollen-Standard des Betriebs, Katalog-Standard im Code — der Server sagt,
// welche gilt (`quelle`), das Frontend legt seinen Katalog nur bei `null`
// darüber (Wurzel 4: kein serverseitig erfundenes Layout).
//
// Werte (Katalog, Größen, Normalisierung) stehen in `dashboard-katalog.ts` und
// `dashboard-layout-normalisierung.ts`: eine "use server"-Datei darf NUR async
// functions exportieren — ein const darin bricht den Build in „Collecting page
// data".
import { ApiError, api } from "@/lib/api";
import type { UserRole } from "@/lib/account";
import type { DashboardLayout } from "@/lib/dashboard-layout-normalisierung";
import { currentToken } from "@/lib/session-token";

export type LayoutQuelle = "benutzer" | "rolle" | "standard";

export type DashboardLayoutAntwort = {
  /** null = nichts gespeichert → Katalog-Standard des Frontends. */
  layout: DashboardLayout | null;
  quelle: LayoutQuelle;
  /** Der Rollen-Standard, auch wenn das eigene Layout gewinnt: „Zurücksetzen"
   *  soll zeigen können, worauf es zurückfällt. */
  rollen_standard: DashboardLayout | null;
};

export type RollenStandardAntwort = {
  role: UserRole;
  /** null = kein Standard gesetzt, die Rolle erbt den Katalog-Standard. */
  layout: DashboardLayout | null;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; requestId?: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet.", status: 401 };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) {
      return {
        ok: false,
        error: exc.message,
        status: exc.status,
        requestId: exc.requestId,
      };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

/** Wirksames Layout des eingeloggten Nutzers samt Herkunft. */
export async function getDashboardLayout(): Promise<Result<DashboardLayoutAntwort>> {
  return call("/dashboard-layout");
}

/** Eigenes Layout speichern. Idempotent (Upsert auf user_id): ein Retry oder
 *  ein doppelt ausgelöster Debounce schreibt denselben Stand noch einmal. */
export async function putDashboardLayout(
  layout: DashboardLayout,
): Promise<Result<DashboardLayoutAntwort>> {
  return call("/dashboard-layout", { method: "PUT", body: layout });
}

/** Eigenes Layout verwerfen → Rollen- bzw. Katalog-Standard greift wieder. */
export async function deleteDashboardLayout(): Promise<Result<DashboardLayoutAntwort>> {
  return call("/dashboard-layout", { method: "DELETE" });
}

/** Standard einer Rolle im eigenen Betrieb lesen (MANAGE_TENANT). */
export async function getRollenStandard(
  role: UserRole,
): Promise<Result<RollenStandardAntwort>> {
  return call(`/dashboard-layout/rollen-standard/${encodeURIComponent(role)}`);
}

/** Standard einer Rolle setzen (MANAGE_TENANT). Neue Nutzer der Rolle erben
 *  ihn; „Zurücksetzen" fällt darauf zurück. */
export async function putRollenStandard(
  role: UserRole,
  layout: DashboardLayout,
): Promise<Result<RollenStandardAntwort>> {
  return call(`/dashboard-layout/rollen-standard/${encodeURIComponent(role)}`, {
    method: "PUT",
    body: layout,
  });
}

/** Standard einer Rolle entfernen (MANAGE_TENANT). */
export async function deleteRollenStandard(
  role: UserRole,
): Promise<Result<RollenStandardAntwort>> {
  return call(`/dashboard-layout/rollen-standard/${encodeURIComponent(role)}`, {
    method: "DELETE",
  });
}
