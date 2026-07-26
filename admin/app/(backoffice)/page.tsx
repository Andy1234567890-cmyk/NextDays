// Backoffice-Übersicht. Zeigt vorerst nur die letzten Vorgänge aus dem
// Protokoll — die Kennzahlen (Betriebe, Objekte, GMV, offene Freigaben) kommen
// mit den jeweiligen Arbeitspaketen dazu. Bewusst KEINE Platzhalter-Zahlen:
// eine erfundene Kennzahl ist schlimmer als keine (Wurzel 4).
import { getAudit } from "@/lib/backoffice";

export default async function UebersichtSeite() {
  const protokoll = await getAudit({ limit: 10 });

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Übersicht
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Plattform-Verwaltung über alle Betriebe.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Letzte Vorgänge
        </h2>
        {protokoll.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Noch keine Vorgänge protokolliert.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {protokoll.items.map((e) => (
              <li key={e.id} className="flex items-baseline gap-4 px-5 py-3.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("de-DE")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{e.action}</span>
                  {e.target_type && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {e.target_type}
                      {e.target_id ? ` ${e.target_id}` : ""}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.actor_email ?? e.actor_user_id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
