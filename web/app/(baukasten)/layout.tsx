// Schale des WEBSITE-BAUKASTENS — bewusst OHNE Dashboard-Rahmen.
//
// Der Baukasten ist ein Editor, kein Dashboard-Bereich. Im Vorbild (Hostaway,
// `docs/UI`) füllt er das Fenster: links nur seine eigene schmale
// Bereichsleiste (Hinzufügen · Seiten · Ebenen · Theme · SEO · Blog), oben
// seine eigene Kopfzeile mit Seitenwahl, Geräteumschalter und „Veröffentlichen".
// Ein zweites Menü daneben gibt es dort nicht.
//
// Bei uns lag `/website` unter `(dashboard)` und erbte damit `AppSidebar`,
// `Topbar` und den Innenabstand des Inhaltsbereichs. Sichtbare Folge: neben dem
// Editor stand die volle Dashboard-Navigation (Dashboard, Kalender, Posteingang
// …), und dem Editor blieben von 1440 px Fenster nur 1134 px — weshalb das
// Blog-Panel gedrängt wirkte und rechts ein toter Streifen stand. Gemessen am
// 25.08.2026 im laufenden Dev-Server.
//
// Die Route-Gruppe ändert KEINE Adresse: `(baukasten)` steht in Klammern und
// geht nicht in den Pfad ein, `/website/seiten/<id>` bleibt exakt wie zuvor.
// Lesezeichen, Links aus Mails und die Sidebar-Einträge des Dashboards
// funktionieren unverändert.
//
// WAS HIER TROTZDEM STEHEN MUSS: das Auth- und Rollen-Gate. Ein Layout ohne
// Dashboard-Rahmen darf kein Layout ohne Schranke sein — sonst wäre das
// Herausnehmen aus `(dashboard)` eine Rechte-Lücke (Wurzel 9): Eigentümer
// gehören in ihr Portal und nicht in den Baukasten des Betriebs. Das Gate ist
// deshalb Zeile für Zeile dasselbe wie in `(dashboard)/layout.tsx`.
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PFAD_HEADER } from "@/lib/demo-cookie";
import { PORTAL_ROLLEN } from "@/lib/rollen-guard";
import { loginMitZiel } from "@/lib/rueckziel";

import { DiagnoseStarter } from "@/components/diagnose-starter";
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function BaukastenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `getSession()` statt `getMe()`: über An-/Abmeldung wird hier ENTSCHIEDEN,
  // und ein technischer Fehler ist keine Abmeldung (Wurzel 5).
  const sitzung = await getSession();
  const me = sitzung.me;
  if (sitzung.fehler) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-sm font-medium">
            Die Sitzung konnte nicht geprüft werden.
          </p>
          <p className="text-sm text-muted-foreground">
            {sitzung.fehler} Du bist weiter angemeldet — lade die Seite neu,
            sobald die Verbindung steht.
          </p>
        </div>
      </div>
    );
  }

  // Rollen-Gate vor jeder weiteren Arbeit: Eigentümer gehören ins Portal.
  if (me?.role && PORTAL_ROLLEN.has(me.role)) redirect("/portal");

  if (!me) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(loginMitZiel((await headers()).get(PFAD_HEADER)));
  }

  return (
    <>
      <DiagnoseStarter />
      {/* Der Editor bekommt das ganze Fenster. `h-svh` statt `min-h`: er
          scrollt INNEN (Panel und Vorschau haben eigene Scrollbereiche), und
          eine Seite, die zusätzlich außen scrollt, verschiebt beim Ziehen eines
          Bausteins den Untergrund. */}
      <div className="h-svh overflow-hidden bg-background">{children}</div>
      {(process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1") && <RealtimeDebugPanel />}
    </>
  );
}
