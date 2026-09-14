// Tabs je Belegart (Buchhaltung → Belege). Reine Links mit ?type= — die
// Seite ist eine Server Component und lädt die Liste der gewählten Art neu;
// so gibt es keinen zweiten Client-Zustand, der von der URL abweichen könnte.
import Link from "next/link";

import { BELEGARTEN, type Belegart } from "@/lib/buchhaltung-belege-typen";

export function BelegeTabs({
  aktiv,
  labels,
}: {
  aktiv: Belegart;
  labels: Record<Belegart, string>;
}) {
  return (
    <nav aria-label="Belegarten" className="overflow-x-auto">
      <div className="inline-flex rounded-full border bg-secondary p-0.5 text-sm">
        {BELEGARTEN.map((art) => {
          const ist = art === aktiv;
          return (
            <Link
              key={art}
              href={`/buchhaltung/belege?type=${art}`}
              aria-current={ist ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors ${
                ist
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[art]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
