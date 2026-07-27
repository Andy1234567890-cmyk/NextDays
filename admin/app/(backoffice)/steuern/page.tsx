// Steuer-Compliance aller Betriebe — die Prüfsicht des Betreibers.
//
// Warum es diese Seite gibt: Nach § 23 PStTG muss der Plattformbetreiber die
// Mitwirkung seiner Anbieter durchsetzen. Das Unterlassen ist selbst
// bußgeldbewehrt (§ 25 Abs. 1 Nr. 6, bis 30.000 €). Eine Oberfläche, die nur
// den Gastgeber fragt, erfüllt die Pflicht nicht — der Betreiber muss sehen
// können, wo etwas fehlt und wo eine Frist läuft.
import Link from "next/link";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getSteuern } from "@/lib/backoffice";
import { landName as land } from "@/lib/laender";

function Kennzahl({
  label,
  wert,
  hinweis,
  warnung,
}: {
  label: string;
  wert: number;
  hinweis: string;
  warnung?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        warnung && wert > 0 ? "border-rose-500/40 bg-rose-500/5" : "border-border"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-sans text-2xl font-bold tracking-tight tabular-nums">
        {wert}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hinweis}</p>
    </div>
  );
}

export default async function SteuernSeite({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const nurLuecken = filter === "luecken";
  const s = await getSteuern(nurLuecken);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <RealtimeRefresh table="taxpayer_info" />
      <RealtimeRefresh table="taxpayer_enforcement" />

      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Steuern</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Meldepflichten je Betrieb. Wir sind verpflichtet, die Angaben zu erheben
        und durchzusetzen.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kennzahl
          label="Vollständig"
          wert={s.betriebe_vollstaendig}
          hinweis={`von ${s.betriebe_gesamt} Betrieben`}
        />
        <Kennzahl
          label="Angaben fehlen"
          wert={s.betriebe_mit_luecke}
          hinweis="Selbstauskunft für mindestens ein Land offen"
        />
        <Kennzahl
          label="Auszahlung einbehalten"
          wert={s.zahlungen_einbehalten}
          hinweis="§ 23 Satz 2 Nr. 2 PStTG"
        />
        <Kennzahl
          label="Überfällig"
          wert={s.betriebe_ueberfaellig}
          hinweis="180-Tage-Frist verstrichen — bußgeldbewehrt"
          warnung
        />
      </div>

      {s.betriebe_ueberfaellig > 0 && (
        <p className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-5 text-sm">
          <strong className="text-rose-600 dark:text-rose-400">
            Handlungsbedarf:
          </strong>{" "}
          Bei {s.betriebe_ueberfaellig}{" "}
          {s.betriebe_ueberfaellig === 1 ? "Betrieb" : "Betrieben"} ist die Frist
          aus § 23 Satz 2 PStTG abgelaufen, ohne dass eine Maßnahme griff. Das
          Unterlassen ist mit bis zu 30.000 € bußgeldbewehrt.
        </p>
      )}

      <div className="mt-8 flex gap-2">
        <Link
          href="/steuern"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            nurLuecken
              ? "text-muted-foreground hover:bg-muted"
              : "border border-foreground"
          }`}
        >
          Alle
        </Link>
        <Link
          href="/steuern?filter=luecken"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            nurLuecken
              ? "border border-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Nur mit Lücke
        </Link>
      </div>

      {s.betriebe.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {nurLuecken
            ? "Alle Betriebe sind vollständig."
            : "Noch keine Betriebe."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                <th className="pb-2 pr-4 font-semibold">Pflichtländer</th>
                <th className="pb-2 pr-4 font-semibold">Fehlt</th>
                <th className="pb-2 pr-4 font-semibold">Objekte</th>
                <th className="pb-2 pr-4 font-semibold">Grundbuch offen</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.betriebe.map((b) => {
                const vollstaendig =
                  b.fehlende_laender.length === 0 && b.ueberfaellig.length === 0;
                return (
                  <tr key={b.tenant_id} className="align-top">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/betriebe/${b.tenant_id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {b.tenant_name ?? "—"}
                      </Link>
                      {b.country && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Sitz: {land(b.country)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {b.pflicht_laender.length === 0
                        ? "—"
                        : b.pflicht_laender.map(land).join(", ")}
                    </td>
                    <td className="py-3 pr-4">
                      {b.fehlende_laender.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          {b.fehlende_laender.map(land).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      {b.objekte_gesamt}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      {b.objekte_ohne_angabe > 0
                        ? `${b.objekte_ohne_angabe} von ${b.objekte_gesamt}`
                        : "—"}
                    </td>
                    <td className="py-3">
                      {b.ueberfaellig.length > 0 ? (
                        <span className="inline-block rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                          Überfällig
                        </span>
                      ) : b.zahlungen_einbehalten ? (
                        <span className="inline-block rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          Einbehalt
                        </span>
                      ) : b.mahnungen_offen > 0 ? (
                        <span className="inline-block rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
                          Verifizierung in Bearbeitung
                        </span>
                      ) : vollstaendig ? (
                        <span className="inline-block rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Abgeschlossen
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Handlung erforderlich
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
