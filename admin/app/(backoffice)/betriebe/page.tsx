// Alle Betriebe der Plattform. Die Liste zeigt bewusst nur Kennzahlen —
// die Detailansicht ist der Vorgang, der mit tenant_id protokolliert wird.
import Link from "next/link";

import { getTenants } from "@/lib/backoffice";

const PRO_SEITE = 50;

export default async function BetriebeSeite({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string; suche?: string }>;
}) {
  const { seite, suche } = await searchParams;
  const seiteNr = Math.max(1, Number(seite) || 1);
  const liste = await getTenants({
    limit: PRO_SEITE,
    offset: (seiteNr - 1) * PRO_SEITE,
    suche,
  });
  const seiten = Math.max(1, Math.ceil(liste.total / PRO_SEITE));

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Betriebe</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {liste.total} Betriebe · Seite {seiteNr} von {seiten}
      </p>

      <form className="mt-6" action="/betriebe">
        <input
          type="search"
          name="suche"
          defaultValue={suche ?? ""}
          placeholder="Nach Name suchen"
          className="w-full max-w-sm rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
        />
      </form>

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine Betriebe gefunden.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                <th className="pb-2 pr-4 font-semibold">Land</th>
                <th className="pb-2 pr-4 font-semibold">Objekte</th>
                <th className="pb-2 pr-4 font-semibold">Nutzer</th>
                <th className="pb-2 font-semibold">Angelegt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/betriebe/${t.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {t.name}
                    </Link>
                    {/* Text statt Farbe allein — WCAG 1.4.1, wie beim
                        Quelle-Badge der Detailseite. */}
                    {t.deactivated_at && (
                      <span className="ml-2 rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold text-background">
                        Gesperrt
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t.country ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t.active_property_count} / {t.property_count}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t.user_count}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seiten > 1 && (
        <div className="mt-8 flex items-center gap-3">
          {seiteNr > 1 && (
            <Link
              href={`/betriebe?seite=${seiteNr - 1}${suche ? `&suche=${suche}` : ""}`}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
            >
              Zurück
            </Link>
          )}
          {seiteNr < seiten && (
            <Link
              href={`/betriebe?seite=${seiteNr + 1}${suche ? `&suche=${suche}` : ""}`}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
            >
              Weiter
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
