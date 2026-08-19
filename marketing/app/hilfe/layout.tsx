// Öffentliches Layout für das Hilfe-Center (Route-Gruppe (public), ohne Auth).
// Gemeinsames Chrome: Hilfe-Kopfzeile + Marketing-Footer.
import type { ReactNode } from "react";

import { HelpHeader } from "@/components/help/help-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="help-light flex min-h-screen flex-col bg-background text-foreground">
      <HelpHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
