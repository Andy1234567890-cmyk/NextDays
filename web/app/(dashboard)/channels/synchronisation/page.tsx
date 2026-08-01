// „Was wird synchronisiert?" — die Feld-Kanal-Matrix als Tabelle.
//
// Beantwortet die häufigste Rückfrage im Support, bevor sie gestellt wird:
// „Ich habe es im Portal geändert und es wurde wieder überschrieben" bzw.
// „Warum steht meine Reinigungsgebühr dort nicht?". Die Quelle ist
// lib/kanal-felder.ts — dieselbe, aus der die Badges an den Formularfeldern
// kommen; es gibt kein zweites Wissen daneben.
import { getTranslations } from "next-intl/server";

import { FELD_GRUPPEN, KANAELE, type Kanalstatus } from "@/lib/kanal-felder";

export const dynamic = "force-dynamic";

// Portalnamen sind Eigennamen und werden nicht übersetzt.
const KANAL_NAME: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  mybestdays: "myBestDays",
};

const STATUS_STIL: Record<Kanalstatus, { zeichen: string; klasse: string }> = {
  voll: { zeichen: "✓", klasse: "text-green-600" },
  bedingt: { zeichen: "!", klasse: "text-amber-600" },
  portal: { zeichen: "↗", klasse: "text-muted-foreground" },
  nein: { zeichen: "–", klasse: "text-muted-foreground" },
  unklar: { zeichen: "?", klasse: "text-muted-foreground" },
};

export default async function SynchronisationPage() {
  const t = await getTranslations("kanalFelder");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("seite.titel")}</h1>
        <p className="text-sm text-muted-foreground">{t("seite.sub")}</p>
      </header>

      {/* Legende — ohne sie ist eine Symboltabelle wertlos. */}
      <ul className="flex flex-wrap gap-x-6 gap-y-2 rounded-(--radius) border p-4 text-sm">
        {(Object.keys(STATUS_STIL) as Kanalstatus[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`font-bold ${STATUS_STIL[s].klasse}`}>
              {STATUS_STIL[s].zeichen}
            </span>
            {t(`status.${s}`)}
          </li>
        ))}
      </ul>

      {FELD_GRUPPEN.map((gruppe) => (
        <section key={gruppe.gruppe} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {t(`gruppen.${gruppe.gruppe}`)}
          </h2>
          {/* Breite Tabellen scrollen in sich, nie die Seite. */}
          <div className="overflow-x-auto rounded-(--radius) border">
            <table className="w-full min-w-xl text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">
                    {t("seite.feldSpalte")}
                  </th>
                  {KANAELE.map((k) => (
                    <th key={k} className="p-3 text-left font-medium">
                      {KANAL_NAME[k] ?? k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gruppe.felder.map((f) => (
                  <tr key={f.feld} className="border-t">
                    <td className="p-3">{t(`felder.${f.feld}`)}</td>
                    {KANAELE.map((k) => {
                      const regel = f.kanaele[k];
                      const stil = STATUS_STIL[regel.status];
                      return (
                        <td key={k} className="p-3 align-top">
                          <span className="flex items-baseline gap-2">
                            <span className={`font-bold ${stil.klasse}`}>
                              {stil.zeichen}
                            </span>
                            <span className="flex flex-col">
                              <span>{t(`status.${regel.status}`)}</span>
                              {regel.grund ? (
                                <span className="text-xs text-muted-foreground">
                                  {t(`gruende.${regel.grund}`)}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">{t("seite.hinweis")}</p>
    </div>
  );
}
