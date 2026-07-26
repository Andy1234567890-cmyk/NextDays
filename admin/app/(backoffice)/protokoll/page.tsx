// Backoffice-Protokoll: wer hat wann welche Mandantendaten gesehen oder
// verändert. Auch LESENDE Zugriffe stehen hier — das Einsehen fremder Daten ist
// der Vorgang, der nachvollziehbar sein muss.
import { getAudit } from "@/lib/backoffice";

const PRO_SEITE = 50;

export default async function ProtokollSeite({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string }>;
}) {
  const { seite } = await searchParams;
  const seiteNr = Math.max(1, Number(seite) || 1);
  const protokoll = await getAudit({
    limit: PRO_SEITE,
    offset: (seiteNr - 1) * PRO_SEITE,
  });
  const seiten = Math.max(1, Math.ceil(protokoll.total / PRO_SEITE));

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Protokoll
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {protokoll.total} Vorgänge · Seite {seiteNr} von {seiten}
      </p>

      {protokoll.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Noch keine Vorgänge protokolliert.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Zeitpunkt</th>
                <th className="pb-2 pr-4 font-semibold">Aktion</th>
                <th className="pb-2 pr-4 font-semibold">Ziel</th>
                <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                <th className="pb-2 pr-4 font-semibold">Bearbeiter</th>
                <th className="pb-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {protokoll.items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("de-DE")}
                  </td>
                  <td className="py-3 pr-4 font-medium">{e.action}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {e.target_type
                      ? `${e.target_type}${e.target_id ? ` · ${e.target_id}` : ""}`
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {e.tenant_id ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {e.actor_email ?? e.actor_user_id}
                  </td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">
                    {e.ip ?? "—"}
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
            <a
              href={`/protokoll?seite=${seiteNr - 1}`}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
            >
              Zurück
            </a>
          )}
          {seiteNr < seiten && (
            <a
              href={`/protokoll?seite=${seiteNr + 1}`}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
            >
              Weiter
            </a>
          )}
        </div>
      )}
    </div>
  );
}
