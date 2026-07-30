// Rechtsseite — Inhalt liegt ausschließlich in content/legal/impressum.ts,
// gerendert vom gemeinsamen LegalDocument.
import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { impressum } from "@/content/legal";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${impressum.title} — myNextDays`,
  description: impressum.metaDescription,
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <LegalDocument doc={impressum} />
      </main>
      <MarketingFooter />
    </div>
  );
}
