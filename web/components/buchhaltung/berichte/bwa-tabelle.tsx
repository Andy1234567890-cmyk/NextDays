// BWA als Tabelle: Erlöse, vier Aufwandsgruppen, Gesamtkosten, Ergebnis —
// jeweils mit gleich langer Vorperiode, Veränderung und Anteil am Umsatz.
import { useLocale, useTranslations } from "next-intl";

import type { BwaResponse, BwaZeile } from "@/lib/buchhaltung-berichte-typen";

import { datum, geld, prozent } from "./format";
import { NachbarHinweis } from "./nachbar-hinweis";

function Zeile({
  z,
  currency,
  fett = false,
  label,
}: {
  z: BwaZeile;
  currency: string;
  fett?: boolean;
  label: string;
}) {
  return (
    <tr className={fett ? "bg-secondary/40 font-semibold" : ""}>
      <td className="px-4 py-2.5">{label}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{geld(z.aktuell, currency)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
        {geld(z.vergleich, currency)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{prozent(z.veraenderungProzent)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
        {z.prozentVomUmsatz === null ? "—" : `${z.prozentVomUmsatz} %`}
      </td>
    </tr>
  );
}

export function BwaTabelle({ daten }: { daten: BwaResponse }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const label = (key: string, fallback: string) => {
    const k = `berichtePage.bwa.${key}`;
    return t.has(k) ? t(k) : fallback;
  };
  return (
    <div className="flex flex-col gap-3">
      <NachbarHinweis ausgaben={daten.ausgabenVerfuegbar} konten={daten.kontenVerfuegbar} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("berichtePage.bwa.position")}</th>
              <th className="px-4 py-3 text-right font-medium">
                {datum(daten.zeitraum.von, locale)} – {datum(daten.zeitraum.bis, locale)}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {datum(daten.vergleichszeitraum.von, locale)} –{" "}
                {datum(daten.vergleichszeitraum.bis, locale)}
              </th>
              <th className="px-4 py-3 text-right font-medium">{t("berichtePage.bwa.veraenderung")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("berichtePage.bwa.vomUmsatz")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Zeile z={daten.erloese} currency={daten.currency} label={label("erloese", daten.erloese.label)} />
            {daten.aufwand.map((z) => (
              <Zeile key={z.key} z={z} currency={daten.currency} label={label(z.key, z.label)} />
            ))}
            <Zeile
              z={daten.aufwandGesamt}
              currency={daten.currency}
              fett
              label={label("aufwand", daten.aufwandGesamt.label)}
            />
            <Zeile
              z={daten.ergebnis}
              currency={daten.currency}
              fett
              label={label("ergebnis", daten.ergebnis.label)}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
