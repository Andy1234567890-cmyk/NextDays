// Layout der oeffentlichen Terminal-Oberflaeche (Vertrag §6/§8).
//
// WARUM EINE EIGENE ROUTE AUSSERHALB VON `(dashboard)`
// ---------------------------------------------------
// `app/(dashboard)/layout.tsx` ist das Auth- UND Rollen-Gate: es holt die
// Sitzung, leitet ohne Sitzung auf /login und rendert Sidebar, Topbar,
// Support-Chat und Debug-Panels. Genau das darf hier NICHT passieren — ein
// Stempel-Terminal haengt an der Wand, hat keinen angemeldeten Nutzer und
// seine Berechtigung IST der Token im Link. Laege die Seite in der Gruppe,
// wuerde jeder Aufruf auf /login umgeleitet.
//
// `app/terminal/...` liegt darum in KEINER Route-Gruppe. Es erbt damit nur das
// Root-Layout (Schriften, Theme, i18n, Toaster) — kein Login, kein Chrome,
// kein `rollen-guard`.
//
// WAS DIESES LAYOUT SELBST TUT
// ----------------------------
// Es setzt den Vollbild-Rahmen und schaltet die Suchmaschinen-Indexierung ab.
// Ein Terminal-Link darf NIE in einem Suchindex landen: er ist ein
// Dauer-Zugang zur Stempeluhr eines Betriebs (Wurzel 6). `robots` sperrt den
// braven Crawler; die eigentliche Sicherheit ist, dass der Token 32 Byte
// urlsafe ist und der Server ihn gehasht vergleicht.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stempel-Terminal",
  robots: { index: false, follow: false, nocache: true },
};

// Kein Vorrendern: die Seite lebt ausschliesslich zur Laufzeit gegen das
// Backend, und der Token steht im Pfad.
export const dynamic = "force-dynamic";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-950 text-neutral-50">{children}</div>;
}
