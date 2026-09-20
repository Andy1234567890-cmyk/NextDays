// Eingeloggter Bereich. Die echte Schranke sitzt HIER (nah an den Daten): getMe()
// ruft /affiliates/me, FastAPI prüft Token UND Partner-Status frisch. Läuft
// das Access-Token ab, wird EINMAL über das Refresh-Cookie erneuert, sonst
// geht es zur Anmeldung.
import { redirect } from "next/navigation";

import { PartnerNav } from "@/components/partner-nav";
import { PortalGesperrt } from "@/components/portal-gesperrt";
import { BedingungenHinweis } from "@/components/bedingungen-hinweis";
import { StatusHinweis } from "@/components/status-hinweis";
import { sitzungErneuern } from "@/lib/auth";
import { getMe } from "@/lib/partner";
import { TERMS_VERSION } from "@/lib/terms";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let me = await getMe();
  if (!me && (await sitzungErneuern())) me = await getMe();
  if (!me) redirect("/anmelden");

  // Plattformweite Sperre (0727): angemeldet bleiben, Hinweis statt Inhalt.
  // Bewusst VOR der Navigation — ein Menü, dessen Punkte alle in einen 403
  // laufen, sieht nach Defekt aus. Die Sperre selbst sitzt serverseitig; das
  // hier ist nur die freundliche Auskunft darüber.
  if (me.portal_gesperrt) {
    return <PortalGesperrt hinweis={me.portal_hinweis ?? null} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <PartnerNav email={me.email} freigegeben={me.status === "approved"} />
      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          {me.status !== "approved" && <StatusHinweis status={me.status} grund={me.status_reason} />}
          <BedingungenHinweis aktuell={TERMS_VERSION} angenommen={me.terms_version} />
          {children}
        </div>
      </main>
    </div>
  );
}
