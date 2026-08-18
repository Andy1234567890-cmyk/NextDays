// Gemeinsame Hülle der geschützten Gast-Bereiche: Header + Seitennavigation +
// Inhaltsspalte. Server-Component (bettet SiteHeader ein, der die Session liest).
import { serverUnreadCount } from "@/lib/guest-server";

import { KontoMenu } from "./konto-menu";
import { KontoNav } from "./konto-nav";
import { TabLeisteMobil } from "./mobil/tab-leiste-mobil";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export async function KontoShell({
  titel,
  aktion,
  children,
  breit = false,
}: {
  titel: string;
  aktion?: React.ReactNode;
  children: React.ReactNode;
  breit?: boolean;
}) {
  // Unread-Zahl fürs Nav-Badge (best-effort; 0 bei Fehler/keine Session).
  const unread = await serverUnreadCount();
  return (
    <div className="tabbar-abstand flex min-h-screen flex-col">
      <SiteHeader compact kontoSlot={<KontoMenu />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
          {/* Seitennavigation erst ab md. Darunter übernimmt die feste untere
              Tab-Leiste dieselben fünf Ziele — beides gleichzeitig wäre eine
              doppelte Navigation für dieselbe Sache, und die Chip-Reihe hätte
              auf jeder Konto-Seite den ersten Bildschirm angeknabbert. */}
          <aside className="hidden md:block lg:sticky lg:top-28 lg:h-fit">
            <KontoNav unread={unread} />
          </aside>
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6 sm:gap-4">
              <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {titel}
              </h1>
              {aktion}
            </div>
            <div className={breit ? "" : "max-w-4xl"}>{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <TabLeisteMobil />
    </div>
  );
}
