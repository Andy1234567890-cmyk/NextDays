// Gemeinsame Hülle der geschützten Gast-Bereiche: Header + Seitennavigation +
// Inhaltsspalte. Server-Component (bettet SiteHeader ein, der die Session liest).
import { serverUnreadCount } from "@/lib/guest-server";

import { KontoMenu } from "./konto-menu";
import { KontoNav } from "./konto-nav";
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
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact kontoSlot={<KontoMenu />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
          <aside className="lg:sticky lg:top-28 lg:h-fit">
            <KontoNav unread={unread} />
          </aside>
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {titel}
              </h1>
              {aktion}
            </div>
            <div className={breit ? "" : "max-w-4xl"}>{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
