// Rahmen des Eigentümer-Reportings: Sub-Navigation links, Inhalt rechts.
//
// Eigenes Layout und keine Tabs auf jeder Seite: die sechs Bereiche sind
// gleichrangige Einstiege, keine Ansichten EINES Gegenstands. Als Tabs
// gerendert müsste jede Unterseite (Bericht-Detail, Zahlung-Detail) sie
// mitschleppen und selbst wissen, welcher Reiter gerade gilt.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportingNav } from "@/components/eigentuemer/reporting/reporting-nav";
import { getMe } from "@/lib/auth";

// Ohne Realtime-Quelle (die Reporting-Tabellen sind für `authenticated`
// bewusst gesperrt, Migration 0365 — ein Abo wäre eine stumme Attrappe) ist
// serverseitiges Neu-Rendern der einzige Weg, frische Zahlen zu bekommen.
export const dynamic = "force-dynamic";

export default async function ReportingLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Dieselbe Regel wie auf /eigentuemer: fehlt die Berechtigung, existiert die
  // Seite für diesen Nutzer nicht — kein 403-Fehlerkasten (Wurzel 3). Der echte
  // Schutz sitzt am OWNER_REPORTING-geschützten Backend-Router.
  //
  // Geprüft wird gegen `permissions` UND `capabilities` plus den
  // Admin-Kurzschluss — exakt die Regel aus `app-sidebar.canSee`. Nur eine der
  // beiden Listen zu lesen, hieße: der Punkt steht in der Navigation, die Seite
  // dahinter ist 404.
  const me = await getMe();
  const darf =
    me?.role === "admin" ||
    me?.permissions.includes("owner_reporting") === true ||
    me?.capabilities.includes("owner_reporting") === true;
  if (!darf) notFound();

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <ReportingNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
