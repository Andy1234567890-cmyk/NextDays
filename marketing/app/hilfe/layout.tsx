// Öffentliches Layout für das Hilfe-Center (Route-Gruppe (public), ohne Auth).
// Gemeinsames Chrome: Marketing-Navigation + Hilfe-Suche + Marketing-Footer.
//
// WARUM DIE MARKETING-NAVIGATION (29.08.2026): Das Hilfe-Center trug bis dahin
// eine EIGENE, reduzierte Kopfzeile — nur Logo, „Kontakt" und Sprache. Wer aus
// der Marketing-Seite oder aus dem Produkt hierher kam, verlor damit jeden Weg
// zurück: keine Funktionen, keine Preise, kein Login. Die Hilfe ist Teil des
// öffentlichen Auftritts und trägt deshalb dieselbe Navigation wie er.
//
// Die HILFE-SUCHE bleibt: sie ist der eigentliche Zweck dieser Kopfzeile und
// steht jetzt in einer eigenen Zeile unter der Navigation. `HeaderSearchSlot`
// bringt seinen Rahmen selbst mit und blendet sich auf der Hilfe-Startseite
// komplett aus — dort zeigt der Hero schon eine Suche, und ein Rahmen im
// Layout hätte einen leeren Streifen hinterlassen.
import type { ReactNode } from "react";

import { HeaderSearchSlot } from "@/components/help/header-search-slot";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="help-light flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      <HeaderSearchSlot />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
