"use client";

// Die zwei Bereichs-Tabs in der Kopfzeile: Leitfaden und Referenz.
//
// Referenz-UX: docs.lodgify.com trennt „Documentation" und „API Reference" als
// zwei Tabs unter dem Logo, jeder mit eigener Sidebar. Das ist die wichtigste
// Ordnungsentscheidung dort — man liest ODER schlägt nach, und eine gemeinsame
// Liste aus Kapiteln und über 40 Endpunkten bedient keines von beiden.
//
// Client-Komponente allein wegen `usePathname`: welcher Tab aktiv ist, hängt an
// der offenen Adresse.
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DokuBereiche({
  leitfaden,
  referenz,
}: {
  leitfaden: string;
  referenz: string;
}) {
  const pfadname = usePathname();
  const inReferenz = pfadname.startsWith("/entwickler/referenz");

  const tabs = [
    { label: leitfaden, href: "/entwickler", aktiv: !inReferenz },
    { label: referenz, href: "/entwickler/referenz", aktiv: inReferenz },
  ];

  return (
    // `min-w-0` + `overflow-x-auto`: die Reiter dürfen SCHMALER werden als
    // ihr Inhalt und scrollen dann in sich, statt die Kopfzeile — und damit
    // die ganze Seite — breiter zu machen. Ohne das hatte diese Leiste bei
    // 390 px 214 px feste Breite und schob die Seite auf 533 px.
    // Die Beschriftungen kommen aus 24 Sprachdateien; eine Breitengrenze, die
    // für „Documentation/API reference" passt, passt für die längste Fassung
    // nicht. Deshalb scrollen statt schätzen.
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.aktiv ? "page" : undefined}
          className={
            // Der aktive Tab trägt eine Unterkante statt einer Füllung: so
            // bleibt die Kopfzeile ruhig, und der Tab liest sich als Reiter.
            // Mobil enger und kleiner, damit BEIDE Reiter ohne Wischen
            // sichtbar sind — ein Reiter, den man erst finden muss, ist auf
            // dem Telefon der einzige Weg vom Leitfaden zur Referenz.
            "-mb-px shrink-0 whitespace-nowrap border-b-2 px-2 py-3.5 text-xs transition-colors sm:px-3 sm:text-sm " +
            (t.aktiv
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
