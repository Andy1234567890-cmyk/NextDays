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
    <nav className="flex items-center gap-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.aktiv ? "page" : undefined}
          className={
            // Der aktive Tab trägt eine Unterkante statt einer Füllung: so
            // bleibt die Kopfzeile ruhig, und der Tab liest sich als Reiter.
            "-mb-px border-b-2 px-3 py-3.5 text-sm transition-colors " +
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
