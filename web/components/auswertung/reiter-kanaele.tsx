"use client";

// Reiter „Kanäle" — Umsatz je Portal.
//
// Was Hostaway dem Kunden als Formelarbeit überlässt („you should have a
// formula for each channel"), steht hier fertig: unsere Buchungen tragen den
// Kanal, also gruppieren wir selbst.
//
// Die Provisionsspalte bleibt LEER, wo das Portal nichts liefert (Booking.com
// meist nicht). Hostaway empfiehlt dort einen Schätzwert (`Preis × 0,15`) —
// eine erfundene Zahl in einer Finanzansicht (Wurzel 4). Der Strich sagt die
// Wahrheit: wir wissen es nicht.
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung, KanalZeile } from "@/lib/auswertung-typen";
import { zeilenVereinen } from "@/lib/auswertung-vergleich";

import { VergleichDelta, VergleichHinweis, deltaStand } from "./vergleich-delta";

export function ReiterKanaele({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  // Kanalnamen aus `calendar.channel.*` — dem EINEN Katalog, den
  // `scripts/i18n/kanal-enums-pruefen.mjs` über DB-Enum, Pydantic,
  // Frontend-Unions, Kanal-Meta und Mail-Katalog deckungsgleich hält. Ein
  // eigener Namensraum hier wäre die sechste Stelle, an der ein neuer
  // Kanal fehlen kann — genau so entstand „None" in Glocke und Postfach.
  const tk = useTranslations("calendar.channel");

  // Leer ist die Tabelle nur, wenn BEIDE Zeiträume nichts hergeben. Sonst
  // verschwände der Vorjahresvergleich genau dann, wenn er am meisten sagt:
  // „dieses Jahr kein Verkauf über diesen Kanal, letztes Jahr schon".
  if (!a.kanaele.length && !a.vorher?.kanaele.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  const geld = (v: number | null) =>
    v === null || !a.currency ? "—" : formatCurrency(v, a.currency);
  const geldVorher = (v: number | null) =>
    v === null || !a.vorher?.currency
      ? "—"
      : formatCurrency(v, a.vorher.currency);

  const ohneProvision = a.kanaele.some((k) => k.provision === null);

  // Vereinigungsmenge beider Zeiträume: ein Kanal, über den nur FRÜHER
  // verkauft wurde, muss sichtbar bleiben — sein Wegfall ist genau das, was
  // ein Vorjahresvergleich zeigen soll.
  const kanalKey = (k: KanalZeile) => `${k.channel}-${k.ota_name ?? ""}`;
  const zeilen = zeilenVereinen(a.kanaele, a.vorher?.kanaele, kanalKey);
  // `!!a.currency` ist der entscheidende Teil: liegen in BEIDEN Zeiträumen
  // mehrere Währungen vor, ist `currency` beide Male `null` — und `null ===
  // null` wäre `true`. Ohne diese Prüfung liefe ein Delta aus zwei
  // Misch­summen durch, die beide keine gültige Zahl sind, und die Zeile
  // zeigte „— · +14,2 %": ein Prozentwert ohne Bezugswert (Wurzel 4).
  const geldVergleichbar =
    !!a.vorher && !!a.currency && a.vorher.currency === a.currency;

  return (
    <div className="flex flex-col gap-3">
      {a.vorher && (
        <VergleichHinweis
          vergleich={a.vorher.vergleich}
          von={a.vorher.von}
          bis={a.vorher.bis}
        />
      )}
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.channel")}</th>
              <th className="px-4 py-3 text-right font-medium">
                {t("col.bookingsShort")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("col.nights")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("kpi.revenue")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("col.commission")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("col.net")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("col.share")}
              </th>
              {a.vorher && (
                <th className="px-4 py-3 text-right font-medium">
                  {t(`compare.${a.vorher.vergleich}`)}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {zeilen.map(({ key, jetzt, vorher }) => {
              // Eine Zeile OHNE aktuellen Wert gab es nur im Vorzeitraum. Sie
              // wird gezeigt, aber abgesetzt: alle Gegenwartsspalten stehen
              // auf „—", weil dieser Kanal heute nichts beiträgt.
              const k = jetzt ?? vorher;
              if (!k) return null;
              const nurFrueher = jetzt === null;
              // Eigennutzung ist KEIN Vertriebskanal: der Hauseigentümer wohnt
              // im eigenen Objekt. Sie steht in einer eigenen, abgesetzten
              // Zeile ohne Umsatz-, Provisions- und Anteilswerte — dort gibt
              // es nichts zu verkaufen und nichts abzuführen.
              const eigen = k.channel === "owner_stay";
              return (
              <tr
                key={key}
                className={
                  "border-b border-border last:border-0 " +
                  (eigen ? "bg-muted/30 " : "") +
                  (nurFrueher ? "text-muted-foreground" : "")
                }
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {/* Der echte Portalname, wo er vorliegt („Airbnb"), sonst
                      der Kanalcode. NICHT `ChannelBadge`: dessen `channel`
                      meint „ota" gegen „local", nicht unseren
                      Vertriebskanal — das wäre eine andere Aussage. */}
                  {eigen ? (
                    <span className="flex flex-col">
                      <span>{t("ownerStayRow")}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {t("ownerStayRowHint")}
                      </span>
                    </span>
                  ) : (
                    k.ota_name || tk(k.channel)
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {nurFrueher ? "—" : k.buchungen}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {nurFrueher ? "—" : k.naechte}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {eigen || nurFrueher ? "—" : geld(k.umsatz)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {eigen || nurFrueher ? "—" : geld(k.provision)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {eigen || nurFrueher ? "—" : geld(k.netto)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {/* Kein Verkaufsanteil — „0 %" wäre eine Aussage über einen
                      Anteil, den es hier nicht gibt. */}
                  {eigen || nurFrueher ? "—" : `${k.anteil_pct} %`}
                </td>
                {a.vorher && (
                  <td className="px-4 py-3 text-right">
                    {eigen ? (
                      // Eigennutzung trägt keinen Umsatz — es gibt nichts zu
                      // vergleichen.
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="tabular-nums text-muted-foreground">
                          {geldVorher(vorher?.umsatz ?? null)}
                        </span>
                        <VergleichDelta
                          klein
                          stand={deltaStand(
                            jetzt?.umsatz ?? null,
                            vorher?.umsatz ?? null,
                            {
                              waehrungGleich: geldVergleichbar,
                              vorherWaehrung: a.vorher?.currency ?? null,
                            },
                          )}
                          vorherAnzeige={geldVorher(vorher?.umsatz ?? null)}
                        />
                      </span>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ohneProvision && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {t("commissionFootnote")}
        </p>
      )}
    </Card>
    </div>
  );
}
