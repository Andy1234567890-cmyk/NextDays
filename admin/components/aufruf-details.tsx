// Lesbare Darstellung eines fehlgeschlagenen Aufrufs.
//
// Der rohe context-Dump reicht hier nicht: Bei einem 'aufruf' stehen dort
// Anfrage, Antwort, Request-ID und Backend-Ursache nebeneinander. Der Support
// braucht das getrennt und in der Reihenfolge, in der er danach sucht —
// zuerst WAS abgelehnt wurde, dann WAS gesendet wurde.

interface Ursache {
  typ?: string | null;
  datei?: string | null;
  zeile?: number | null;
}

interface Kontext {
  request_id?: string | null;
  quelle?: string | null;
  gesendet?: unknown;
  antwort?: unknown;
  ursache?: Ursache | null;
  gekuerzt?: boolean;
  grund?: string;
}

/** Validierungsfehler aus einer FastAPI-422-Antwort in Klartext. */
function validierungsFehler(antwort: unknown): { feld: string; grund: string }[] {
  const detail = (antwort as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail)) return [];
  return detail.flatMap((e) => {
    const eintrag = e as { loc?: unknown[]; msg?: string };
    if (!eintrag.msg) return [];
    // 'body' am Anfang weglassen — es steht bei jedem Feld und sagt nichts.
    const pfad = (eintrag.loc ?? [])
      .filter((p) => p !== "body")
      .map(String)
      .join(".");
    return [{ feld: pfad || "(Anfrage)", grund: eintrag.msg }];
  });
}

function Block({ titel, inhalt }: { titel: string; inhalt: unknown }) {
  if (inhalt === undefined || inhalt === null) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titel}
      </p>
      <pre className="mt-1 overflow-x-auto rounded-xl bg-muted/40 p-3 text-xs">
        {typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt, null, 2)}
      </pre>
    </div>
  );
}

export function AufrufDetails({ context }: { context: Record<string, unknown> }) {
  const k = context as Kontext;
  const fehler = validierungsFehler(k.antwort);

  if (k.gekuerzt) {
    return (
      <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        {k.grund ?? "Inhalt zu groß — nicht gespeichert."}
      </p>
    );
  }

  return (
    <div className="mt-3">
      {/* Zuerst die Antwort auf die Frage „warum abgelehnt?" — das ist in den
          meisten Fällen die ganze Diagnose. */}
      {fehler.length > 0 && (
        <div className="rounded-xl border-2 border-destructive/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Abgelehnte Felder
          </p>
          <ul className="mt-2 space-y-1">
            {fehler.map((f) => (
              <li key={f.feld} className="text-sm">
                <span className="font-mono font-semibold">{f.feld}</span>
                <span className="text-muted-foreground"> — {f.grund}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {k.ursache?.typ && (
        <div className="mt-3 rounded-xl border-2 border-destructive/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Backend-Ursache
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{k.ursache.typ}</p>
          {k.ursache.datei && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {k.ursache.datei}
              {k.ursache.zeile ? `:${k.ursache.zeile}` : ""}
            </p>
          )}
        </div>
      )}

      <Block titel="Gesendet" inhalt={k.gesendet} />
      {/* Die Antwort nur zeigen, wenn sie nicht schon oben als Feldliste
          aufbereitet ist — sonst stünde dasselbe zweimal da. */}
      {fehler.length === 0 && <Block titel="Antwort" inhalt={k.antwort} />}

      {(k.request_id || k.quelle) && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {k.request_id ? `Request-ID ${k.request_id}` : ""}
          {k.request_id && k.quelle ? " · " : ""}
          {k.quelle === "server" ? "serverseitiger Aufruf" : ""}
        </p>
      )}
    </div>
  );
}
