"use client";

// Reiter „Buchungen" — Hostaways `Rental Activity` in voller Tiefe.
//
// ZWEI ANSICHTEN wie dort: „je Buchung" (eine Zeile je Reservierung) und
// „je Objekt" (die Finanzfelder je Objekt summiert). Die Spalten sind die
// Finanzfelder der Portal-Zerlegung (0366): Übernachtung, Reinigung, übrige
// Gebühren, Zusatzleistungen, Gastpreis, Provision, Zahlungsgebühr, Netto.
//
// WAS LEER BLEIBT, BLEIBT LEER: eine Buchung ohne gespeicherte Zerlegung zeigt
// nur den Gesamtpreis. Hostaway lässt den Kunden dafür Formeln bauen
// („Base rate = Total − Fees − Tax"); wir rechnen nichts zurück (Wurzel 4).
// Ein Beleg-Zeichen unterscheidet, ob das Portal die Aufstellung geliefert
// hat oder ob sie aus den Objekt-Gebühren rekonstruiert wurde (Wurzel 5b).
//
// Die Spaltenwahl liegt beim ELTERN (für gespeicherte Ansichten und Export),
// nicht mehr im localStorage dieses Reiters.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { KanalLogo, hatWortlogo } from "@/components/kanal-logo";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Switch } from "@nextdays/ui/switch";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung, BuchungZeile, ObjektFinanzZeile } from "@/lib/auswertung-typen";
import { STATUS_WERTE } from "@/lib/auswertung-typen";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelLabelLoose } from "@/lib/channel-logos";

import { VergleichHinweis } from "./vergleich-delta";

export const BUCHUNG_SPALTEN = [
  "property",
  "guest",
  "channel",
  "stay",
  "nights",
  "guests",
  "status",
  "bookedAt",
  "revenue",
  "accommodation",
  "cleaning",
  "otherFees",
  "addons",
  "gross",
  "commission",
  "paymentFee",
  "net",
] as const;
export type BuchungSpalte = (typeof BUCHUNG_SPALTEN)[number];

export const BUCHUNG_VORGABE: BuchungSpalte[] = [
  "property",
  "channel",
  "stay",
  "nights",
  "status",
  "revenue",
  "accommodation",
  "cleaning",
  "commission",
  "net",
];

const GELD: readonly BuchungSpalte[] = [
  "revenue",
  "accommodation",
  "cleaning",
  "otherFees",
  "addons",
  "gross",
  "commission",
  "paymentFee",
  "net",
];
const RECHTS: readonly BuchungSpalte[] = ["nights", "guests", ...GELD];

export type BuchungOptionen = {
  ansicht: "buchung" | "objekt";
  leereObjekte: boolean;
};

export function ReiterBuchungen({
  a,
  spalten,
  setSpalten,
  optionen,
  setOptionen,
}: {
  a: Auswertung;
  spalten: BuchungSpalte[];
  setSpalten: (s: BuchungSpalte[]) => void;
  optionen: BuchungOptionen;
  setOptionen: (o: BuchungOptionen) => void;
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const { channelLabel } = useCalendarLabels();

  const zeigt = (s: BuchungSpalte) => spalten.includes(s);
  const umschalten = (s: BuchungSpalte) =>
    setSpalten(zeigt(s) ? spalten.filter((x) => x !== s) : [...spalten, s]);

  const geld = (v: number | null | undefined, w: string | null) =>
    v === null || v === undefined || !w ? "—" : formatCurrency(v, w);
  const datum = (iso: string) =>
    iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale) : "—";
  // Statusnamen aus dem eigenen Katalog (`analysis.status.*`, alle neun Werte
  // des DB-Enums). Ein unbekannter Wert steht roh da, statt zu werfen.
  const status = (s: string) =>
    (STATUS_WERTE as readonly string[]).includes(s) ? t(`status.${s}`) : s;

  // Der Leerzustand meldet auch, was der Vorzeitraum hatte — „dieses Jahr
  // keine Buchungen, letztes Jahr 34" ist die Aussage, nicht bloß „leer".
  if (!a.buchungen.length) {
    return (
      <Card className="flex flex-col gap-1 p-8 text-center text-sm text-muted-foreground">
        <span>{t("empty")}</span>
        {a.vorher && (
          <span className="text-xs">
            {t("compareRowCount", {
              label: t(`compare.${a.vorher.vergleich}`),
              count: a.vorher.buchungen_gesamt,
            })}
          </span>
        )}
      </Card>
    );
  }

  const ohneZerlegung = a.buchungen.filter((b) => b.brutto === null && !b.is_owner_stay).length;
  const rekonstruiert = a.buchungen.filter((b) => b.finanz_quelle === "stammdaten").length;

  // Summenzeile über die gültigen (nicht stornierten) Buchungen. Nur in EINER
  // Währung — bei gemischter Währung steht „—" (Wurzel 4).
  const gueltig = a.buchungen.filter(
    (b) => !["cancelled", "canceled", "declined", "expired"].includes(b.status) && !b.is_owner_stay,
  );
  const summe = (f: (b: BuchungZeile) => number | null) => {
    if (!a.currency) return null;
    let s = 0;
    let hat = false;
    for (const b of gueltig) {
      const v = f(b);
      if (v !== null) {
        s += v;
        hat = true;
      }
    }
    return hat ? Math.round(s * 100) / 100 : null;
  };

  const spaltenMenue = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon icon="ph:gear" className="size-4" />
          {t("table.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2">
        {BUCHUNG_SPALTEN.filter((s) =>
          optionen.ansicht === "objekt"
            ? !["guest", "channel", "stay", "status", "bookedAt", "guests"].includes(s)
            : true,
        ).map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox checked={zeigt(s)} onCheckedChange={() => umschalten(s)} />
            {t(`col.${s}`)}
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const th = (s: BuchungSpalte) => (
    <th
      key={s}
      className={
        "px-3 py-3 font-medium whitespace-nowrap " + (RECHTS.includes(s) ? "text-right" : "")
      }
    >
      {t(`col.${s}`)}
    </th>
  );

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
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          {/* Umschalter je Buchung / je Objekt — Hostaways „Per reservation /
              Per listing". */}
          <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
            {(["buchung", "objekt"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setOptionen({ ...optionen, ansicht: v })}
                className={
                  "rounded px-3 py-1 transition-colors " +
                  (optionen.ansicht === v ? "bg-foreground text-background" : "hover:bg-muted")
                }
              >
                {t(`bookings.per.${v}`)}
              </button>
            ))}
          </div>
          <span className="flex min-w-0 flex-col text-sm text-muted-foreground">
            <span className="truncate">
              {optionen.ansicht === "buchung"
                ? t("table.rowCount", { count: a.buchungen.length })
                : t("bookings.propertyCount", { count: a.objekte_finanzen.length })}
            </span>
            {a.vorher && (
              <span className="truncate text-xs">
                {t("compareRowCount", {
                  label: t(`compare.${a.vorher.vergleich}`),
                  count: a.vorher.buchungen_gesamt,
                })}
              </span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {optionen.ansicht === "objekt" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={optionen.leereObjekte}
                  onCheckedChange={(v) => setOptionen({ ...optionen, leereObjekte: v })}
                />
                {t("bookings.showEmpty")}
              </label>
            )}
            {spaltenMenue}
          </div>
        </div>

        {/* Waagerecht scrollbar in EIGENEM Behälter: die Seite selbst darf nie
            waagerecht scrollen. */}
        <div className="overflow-x-auto">
          {optionen.ansicht === "buchung" ? (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>{BUCHUNG_SPALTEN.filter(zeigt).map(th)}</tr>
              </thead>
              <tbody>
                {a.buchungen.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    {zeigt("property") && <td className="px-3 py-2.5">{b.property_title ?? "—"}</td>}
                    {zeigt("guest") && <td className="px-3 py-2.5">{b.guest_name ?? "—"}</td>}
                    {zeigt("channel") && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 align-middle">
                          <KanalLogo name={b.ota_name || b.channel} />
                          {/* Wortlogo ersetzt den Namen; ohne Logo („Direkt")
                              steht der Name dazu. */}
                          {!hatWortlogo(b.ota_name || b.channel) &&
                            (b.ota_name
                              ? channelLabelLoose(b.ota_name)
                              : channelLabel(b.channel as AvailabilitySource))}
                        </span>
                        {b.is_owner_stay && (
                          <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
                            {t("ownerStay")}
                          </span>
                        )}
                      </td>
                    )}
                    {zeigt("stay") && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {datum(b.check_in)} – {datum(b.check_out)}
                      </td>
                    )}
                    {zeigt("nights") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">{b.naechte}</td>
                    )}
                    {zeigt("guests") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">{b.gaeste ?? "—"}</td>
                    )}
                    {zeigt("status") && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {status(b.status)}
                        {b.cancelled_at && (
                          <span className="block text-xs text-muted-foreground">
                            {datum(b.cancelled_at)}
                          </span>
                        )}
                      </td>
                    )}
                    {zeigt("bookedAt") && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                        {/* Leer, wenn die Quelle keinen echten Zeitpunkt liefert —
                            nie unser Eingang als „gebucht am" (Wurzel 5b). */}
                        {b.booked_at ? datum(b.booked_at) : "—"}
                      </td>
                    )}
                    {zeigt("revenue") && (
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {geld(b.umsatz, b.currency)}
                      </td>
                    )}
                    {zeigt("accommodation") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.uebernachtung, b.currency)}
                        {b.finanz_quelle === "stammdaten" && (
                          <span
                            className="ml-1 text-muted-foreground"
                            title={t("bookings.reconstructed")}
                          >
                            *
                          </span>
                        )}
                      </td>
                    )}
                    {zeigt("cleaning") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.reinigung, b.currency)}
                      </td>
                    )}
                    {zeigt("otherFees") && (
                      <td
                        className="px-3 py-2.5 text-right tabular-nums"
                        title={Object.entries(b.gebuehren_je_art)
                          .filter(([art]) => art !== "cleaning_fee")
                          .map(([art, v]) => `${art}: ${geld(v, b.currency)}`)
                          .join("\n")}
                      >
                        {geld(b.sonstige_gebuehren, b.currency)}
                      </td>
                    )}
                    {zeigt("addons") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.zusatzleistungen, b.currency)}
                      </td>
                    )}
                    {zeigt("gross") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.brutto, b.currency)}
                      </td>
                    )}
                    {zeigt("commission") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.provision, b.currency)}
                        {b.provision !== null && b.provision_gemeldet === false && (
                          <span className="ml-1 text-muted-foreground" title={t("bookings.commissionComputed")}>
                            *
                          </span>
                        )}
                      </td>
                    )}
                    {zeigt("paymentFee") && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {geld(b.zahlungsgebuehr, b.currency)}
                      </td>
                    )}
                    {zeigt("net") && (
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {geld(b.netto, b.currency)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-foreground/40 bg-muted/30 font-semibold">
                <tr>
                  {BUCHUNG_SPALTEN.filter(zeigt).map((s, i) => (
                    <td key={s} className={"px-3 py-2.5 tabular-nums " + (RECHTS.includes(s) ? "text-right" : "")}>
                      {i === 0
                        ? t("table.total")
                        : s === "nights"
                          ? gueltig.reduce((n, b) => n + b.naechte, 0)
                          : s === "guests"
                            ? gueltig.reduce((n, b) => n + (b.gaeste ?? 0), 0)
                            : GELD.includes(s)
                              ? geld(
                                  summe((b) =>
                                    s === "revenue" ? b.umsatz
                                    : s === "accommodation" ? b.uebernachtung
                                    : s === "cleaning" ? b.reinigung
                                    : s === "otherFees" ? b.sonstige_gebuehren
                                    : s === "addons" ? b.zusatzleistungen
                                    : s === "gross" ? b.brutto
                                    : s === "commission" ? b.provision
                                    : s === "paymentFee" ? b.zahlungsgebuehr
                                    : b.netto,
                                  ),
                                  a.currency,
                                )
                              : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          ) : (
            <ObjektTabelle
              zeilen={
                optionen.leereObjekte
                  ? a.objekte_finanzen
                  : a.objekte_finanzen.filter((o) => o.buchungen > 0)
              }
              spalten={spalten}
              currency={a.currency}
            />
          )}
        </div>
        {(ohneZerlegung > 0 || rekonstruiert > 0 || !a.currency) && (
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {!a.currency && a.waehrungen.length > 1 && (
              <>{t("mixedCurrency", { list: a.waehrungen.join(", ") })} </>
            )}
            {ohneZerlegung > 0 && <>{t("bookings.withoutBreakdown", { count: ohneZerlegung })} </>}
            {rekonstruiert > 0 && <>{t("bookings.reconstructedCount", { count: rekonstruiert })}</>}
          </p>
        )}
      </Card>
    </div>
  );
}

function ObjektTabelle({
  zeilen,
  spalten,
  currency,
}: {
  zeilen: ObjektFinanzZeile[];
  spalten: BuchungSpalte[];
  currency: string | null;
}) {
  const t = useTranslations("analysis");
  const geld = (v: number | null | undefined) =>
    v === null || v === undefined || !currency ? "—" : formatCurrency(v, currency);
  const sichtbar = BUCHUNG_SPALTEN.filter(
    (s) => spalten.includes(s) && !["guest", "channel", "stay", "status", "bookedAt", "guests"].includes(s),
  );
  const wert = (o: ObjektFinanzZeile, s: BuchungSpalte): string | number => {
    switch (s) {
      case "property":
        return o.title;
      case "nights":
        return o.naechte;
      case "revenue":
        return geld(o.umsatz);
      case "accommodation":
        return geld(o.uebernachtung);
      case "cleaning":
        return geld(o.reinigung);
      case "otherFees":
        return geld(o.sonstige_gebuehren);
      case "addons":
        return geld(o.zusatzleistungen);
      case "gross":
        return geld(o.brutto);
      case "commission":
        return geld(o.provision);
      case "paymentFee":
        return geld(o.zahlungsgebuehr);
      case "net":
        return geld(o.netto);
      default:
        return "";
    }
  };
  const summe = (f: (o: ObjektFinanzZeile) => number | null) => {
    if (!currency) return "—";
    let s = 0;
    let hat = false;
    for (const o of zeilen) {
      const v = f(o);
      if (v !== null) {
        s += v;
        hat = true;
      }
    }
    return hat ? geld(Math.round(s * 100) / 100) : "—";
  };
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/40 text-left">
        <tr>
          {sichtbar.map((s) => (
            <th
              key={s}
              className={"px-3 py-3 font-medium whitespace-nowrap " + (RECHTS.includes(s) ? "text-right" : "")}
            >
              {t(`col.${s}`)}
            </th>
          ))}
          <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("col.bookingsShort")}</th>
        </tr>
      </thead>
      <tbody>
        {zeilen.map((o) => (
          <tr key={o.property_id} className="border-b border-border last:border-0">
            {sichtbar.map((s) => (
              <td
                key={s}
                className={"px-3 py-2.5 tabular-nums " + (RECHTS.includes(s) ? "text-right" : "")}
              >
                {wert(o, s)}
                {s === "property" && o.ohne_zerlegung > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground" title={t("bookings.withoutBreakdown", { count: o.ohne_zerlegung })}>
                    ({o.ohne_zerlegung} *)
                  </span>
                )}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular-nums">{o.buchungen}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-foreground/40 bg-muted/30 font-semibold">
        <tr>
          {sichtbar.map((s, i) => (
            <td key={s} className={"px-3 py-2.5 tabular-nums " + (RECHTS.includes(s) ? "text-right" : "")}>
              {i === 0
                ? t("table.total")
                : s === "nights"
                  ? zeilen.reduce((n, o) => n + o.naechte, 0)
                  : s === "revenue" ? summe((o) => o.umsatz)
                  : s === "accommodation" ? summe((o) => o.uebernachtung)
                  : s === "cleaning" ? summe((o) => o.reinigung)
                  : s === "otherFees" ? summe((o) => o.sonstige_gebuehren)
                  : s === "addons" ? summe((o) => o.zusatzleistungen)
                  : s === "gross" ? summe((o) => o.brutto)
                  : s === "commission" ? summe((o) => o.provision)
                  : s === "paymentFee" ? summe((o) => o.zahlungsgebuehr)
                  : s === "net" ? summe((o) => o.netto)
                  : ""}
            </td>
          ))}
          <td className="px-3 py-2.5 text-right tabular-nums">
            {zeilen.reduce((n, o) => n + o.buchungen, 0)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
