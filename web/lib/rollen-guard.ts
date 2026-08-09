import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import type { MeResponse } from "@/lib/api";

// Serverseitiger Rollen-Guard (Wurzel 9).
//
// WARUM IM SERVER-LAYOUT UND NICHT IN DER MIDDLEWARE
// --------------------------------------------------
// Die Middleware (web/middleware.ts) erneuert ausschließlich Tokens und ist
// bewusst KEINE Auth-Schranke — ADR-0015 begründet das mit dem
// Middleware-Bypass (CVE-2025-29927: ein gesetzter `x-middleware-subrequest`-
// Header überspringt die Middleware komplett). Eine Rollen-Weiche allein dort
// wäre also mit einem Header zu umgehen. Der Guard sitzt deshalb in den beiden
// Server-Layouts, direkt am Render der jeweiligen Fläche: er läuft vor jedem
// Server-Component-Render der Route-Gruppe und ist nicht überspringbar.
//
// WARUM ÜBERHAUPT
// ---------------
// `OWNER_ALLOWED_HREFS` in components/app-sidebar.tsx blendet Menüpunkte nur
// aus. Das ist Navigations-Kosmetik: wer /buchhaltung direkt in die Adresszeile
// tippt, landete bisher trotzdem im Agentur-Layout. Fail-CLOSED heißt hier: die
// Rolle entscheidet über die Fläche, nicht das Menü.
//
// ZWEITE VERTEIDIGUNGSLINIE, NICHT DIE EINZIGE
// --------------------------------------------
// FastAPI erzwingt den Datenscope weiterhin selbst (require_permission +
// Owner-Scope im public_portal-Service). Dieser Guard verhindert, dass ein
// Eigentümer überhaupt in einer Fläche landet, die ihm reihenweise 403 liefert
// — er ersetzt die serverseitige Autorisierung an den Daten nicht.
//
// Die Rolle kommt aus `/auth/me`, wird also serverseitig aus der DB gelesen
// (Wurzel 7: nicht nur dem JWT-Claim vertrauen).

/** Rollen, die im Eigentümer-Portal (/portal) zuhause sind. */
export const PORTAL_ROLLEN: ReadonlySet<string> = new Set(["owner"]);

export type PortalSitzung =
  | { art: "ok"; me: MeResponse }
  // Technischer Fehler ≠ abgemeldet (Wurzel 5): die Fläche zeigt einen Hinweis,
  // wirft aber niemanden hinaus.
  | { art: "fehler"; meldung: string };

/**
 * Guard für das Eigentümer-Portal (Route-Gruppe `(portal)`).
 *
 * Nur die Rolle `owner` kommt hier hinein; alle anderen gehen auf das
 * Agentur-Dashboard zurück. Fail-CLOSED: eine unbekannte oder fehlende Rolle
 * ist KEIN Eigentümer (Wurzel 6) und wird ausgeleitet, nicht durchgewinkt.
 *
 * Anders als das Dashboard akzeptiert das Portal KEINE reine
 * Supabase-OAuth-Sitzung ohne FastAPI-Profil: ohne Rolle aus der DB lässt sich
 * die Eigentümer-Eigenschaft nicht belegen, und „im Zweifel hineinlassen" wäre
 * fail-open.
 */
export async function portalGuard(): Promise<PortalSitzung> {
  const sitzung = await getSession();
  if (sitzung.fehler) return { art: "fehler", meldung: sitzung.fehler };
  const me = sitzung.me;
  if (!me) redirect("/login");
  if (!me.role || !PORTAL_ROLLEN.has(me.role)) redirect("/");
  return { art: "ok", me };
}
