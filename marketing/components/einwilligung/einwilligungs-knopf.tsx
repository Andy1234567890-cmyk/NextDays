"use client";

// Das Cookie-Symbol unten links — der dauerhafte Weg zurück zur Einwilligung.
//
// WARUM ES DAS GIBT: Nach Art. 7 Abs. 3 DSGVO muss der Widerruf so einfach sein
// wie die Einwilligung. Die Leiste erteilt sie mit einem Klick, also darf der
// Widerruf auch nur einen kosten. Ein dauerhaft sichtbares Symbol am Seitenrand
// (oder ein Footer-Link) ist die verbreitete Umsetzung — Cookiebot nennt es
// „Privacy trigger", CookieYes „Revisit consent button", beide sitzen
// standardmäßig unten links.
//
// WAS HIER VORHER STAND: ein Bedienfeld mitten in der Cookie-Richtlinie. Das
// war der falsche Ort — eine Rechtsseite ist der Text, nicht die
// Bedienoberfläche, und der Widerruf lag dort zwei Klicks entfernt statt einem.
//
// UNTEN LINKS, nicht rechts: rechts sitzt der Support-Chat. Zwei runde Knöpfe
// übereinander wären beide schlechter erreichbar, und der Chat ist der
// häufigere Griff.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { Icon } from "@/components/ui/icon";
import {
  EINWILLIGUNG_EREIGNIS,
  EINWILLIGUNG_OEFFNEN,
  optionaleDiensteVorhanden,
} from "@/lib/einwilligung";

export function EinwilligungsKnopf() {
  const t = useTranslations("einwilligung");
  const { entscheidung, geladen } = useEinwilligung();
  // Solange die Leiste offen ist, hat der Knopf keine Aufgabe — und er läge
  // hinter ihr. Beim Speichern schickt lib/einwilligung das
  // EINWILLIGUNG_EREIGNIS, damit kommt er von allein wieder.
  const [leisteOffen, setLeisteOffen] = useState(false);

  useEffect(() => {
    const auf = () => setLeisteOffen(true);
    const zu = () => setLeisteOffen(false);
    window.addEventListener(EINWILLIGUNG_OEFFNEN, auf);
    window.addEventListener(EINWILLIGUNG_EREIGNIS, zu);
    return () => {
      window.removeEventListener(EINWILLIGUNG_OEFFNEN, auf);
      window.removeEventListener(EINWILLIGUNG_EREIGNIS, zu);
    };
  }, []);

  // Nichts rendern, solange der Speicher nicht gelesen ist (Hydration), wenn
  // noch keine Entscheidung vorliegt (dann steht die Leiste selbst da) oder
  // wenn es in dieser Umgebung gar keinen optionalen Dienst gibt — ein Knopf,
  // der ein leeres Auswahlfeld öffnet, wäre eine Attrappe.
  if (!geladen || !entscheidung || !optionaleDiensteVorhanden()) return null;
  if (leisteOffen) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EINWILLIGUNG_OEFFNEN))}
      // `title` UND `aria-label`: der Knopf trägt nur ein Symbol. Ohne Label
      // liest ein Screenreader „Schaltfläche" und sonst nichts.
      title={t("knopf")}
      aria-label={t("knopf")}
      // z-40 liegt UNTER Leiste (z-90) und Voranmelde-Popup (z-[100]) und
      // stört damit keine Entscheidung, die gerade getroffen wird.
      className="fixed bottom-5 left-5 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-surface-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon icon="ph:cookie" className="size-5" />
    </button>
  );
}
