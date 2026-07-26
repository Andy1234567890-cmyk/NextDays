// Layout des eingeloggten Backoffice-Bereichs.
//
// HIER sitzt die echte Auth-Schranke (nicht in der Middleware, ADR-0015):
// getPlatformMe() ruft /platform/me, und FastAPI prüft die Rolle bei diesem
// Request frisch gegen public.platform_admins. Wer dort nicht (mehr) steht,
// bekommt 403 → Redirect zur Anmeldung. Ein entzogener Zugang wirkt damit
// sofort, nicht erst nach Ablauf des Tokens.
import { redirect } from "next/navigation";

import { getPlatformMe } from "@/lib/backoffice";

import { BackofficeNav } from "@/components/backoffice-nav";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let me;
  try {
    me = await getPlatformMe();
  } catch {
    // 401 (kein/abgelaufenes Token) und 403 (keine Backoffice-Rolle) führen
    // beide zur Anmeldung — ohne Unterscheidung nach außen.
    redirect("/anmelden");
  }

  return (
    <div className="flex min-h-screen">
      <BackofficeNav email={me.email} rolle={me.platform_role} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
