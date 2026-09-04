"use client";

// Kennzahlen-Kopf über dem Dienstplan (Vertrag §5, Gastromatic-Bauform in
// UNSEREM Designsystem).
//
// AUFBAU: eine Zeile je Kennzahl, eine Spalte je Tag — dieselbe Spaltenbreite
// wie das Plan-Raster darunter, damit Kopf und Plan zusammen gelesen werden.
// Die HOTEL-ZEILE (Anreisen · Abreisen · Gäste im Haus · Belegung) sieht jede
// Schichtleitung. Alles Finanzielle liefert der Server nur mit `EXPORT_LOHN`
// (§2.1) und ist sonst `null` — eine Zeile, deren Werte an allen Tagen null
// sind, wird deshalb GAR NICHT gerendert. Kein Ersatzwert, keine erfundene
// Null (Wurzel 4): fehlt eine Zahl an einem einzelnen Tag, steht dort „—".
//
// Produktivität färbt wie Gastromatic gegen die Zielmarke: innerhalb ±5 % grün,
// außerhalb rot. Ohne Ziel bleibt sie neutral — eine Farbe ohne Bezugsgröße
// wäre eine Behauptung.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/currency";
import type { KennzahlTag, Kennzahlen, Wettertag } from "@/lib/personal-planung-typen";
import { wetterIcon, wetterName } from "@/lib/personal-planung-typen";
import { stunden } from "@/lib/personal-typen";

/** Abweichung von der Zielproduktivität in Prozent (null ohne Ziel/Wert). */
function abweichungPct(ist: number | null, ziel: number | null): number | null {
  if (ist === null || ziel === null || ziel === 0) return null;
  return ((ist - ziel) / ziel) * 100;
}

export function DienstplanKopf({
  kennzahlen,
  tage,
  wetter,
  heute,
  wochenende,
  wetterAnzeigen,
}: {
  kennzahlen: Kennzahlen | null;
  tage: string[];
  wetter: Record<string, Wettertag>;
  heute: string;
  /** Index-Prädikat: ist die Spalte ein Wochenendtag? */
  wochenende: (index: number) => boolean;
  wetterAnzeigen: boolean;
}) {
  const t = useTranslations("personal");

  if (!kennzahlen) {
    return (
      <div className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">
        {t("kennzahlen.nichtGeladen")}
      </div>
    );
  }

  const jeTag = new Map(kennzahlen.tage.map((k) => [k.datum, k]));
  const currency = kennzahlen.currency ?? "";
  const geld = (minor: number | null | undefined) =>
    minor === null || minor === undefined ? "—" : formatCurrency(minor / 100, currency);
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${v.toFixed(1)} %`;

  /** Hat mindestens ein Tag für dieses Feld einen Wert? Sonst Zeile weglassen. */
  const hat = (feld: (k: KennzahlTag) => number | null) =>
    kennzahlen.tage.some((k) => feld(k) !== null && feld(k) !== undefined);

  const zellen = (inhalt: (k: KennzahlTag | undefined, tag: string) => React.ReactNode) =>
    tage.map((tag, i) => (
      <td
        key={tag}
        className={`px-2 py-1 text-center tabular-nums ${
          tag === heute ? "bg-primary/5" : wochenende(i) ? "bg-secondary/30" : ""
        }`}
      >
        {inhalt(jeTag.get(tag), tag)}
      </td>
    ));

  const zeile = (
    key: string,
    label: string,
    inhalt: (k: KennzahlTag | undefined, tag: string) => React.ReactNode,
    summe?: React.ReactNode,
  ) => (
    <tr key={key} className="border-t">
      <th scope="row" className="px-2 py-1 text-left font-normal text-muted-foreground">
        {label}
      </th>
      {zellen(inhalt)}
      <td className="px-2 py-1 text-right font-medium tabular-nums">{summe ?? ""}</td>
    </tr>
  );

  const s = kennzahlen.summe;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-48" />
          {tage.map((tag) => (
            <col key={tag} />
          ))}
          <col className="w-24" />
        </colgroup>
        <tbody>
          {/* Spaltenkopf mit Wetter — nur wenn die Regeln es zulassen und Werte da sind. */}
          {wetterAnzeigen && Object.keys(wetter).length > 0 && (
            <tr>
              <th scope="row" className="px-2 py-1 text-left font-normal text-muted-foreground">
                {t("kennzahlen.wetter")}
              </th>
              {tage.map((tag, i) => {
                const w = wetter[tag];
                return (
                  <td
                    key={tag}
                    className={`px-2 py-1 text-center ${
                      tag === heute ? "bg-primary/5" : wochenende(i) ? "bg-secondary/30" : ""
                    }`}
                  >
                    {w ? (
                      <span
                        className="inline-flex items-center gap-1"
                        title={`${t(`terminal.wetterLage.${wetterName(w.code)}`)}${
                          w.niederschlag_mm !== null
                            ? ` · ${t("kennzahlen.niederschlag", { mm: w.niederschlag_mm })}`
                            : ""
                        }`}
                      >
                        <Icon icon={wetterIcon(w.code)} className="size-4 text-muted-foreground" />
                        <span className="tabular-nums">
                          {w.temp_max !== null ? `${Math.round(w.temp_max)}°` : "—"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
              <td />
            </tr>
          )}

          {/* --- Hotel-Zeile: sieht jede Schichtleitung ------------------------ */}
          {zeile(
            "hotel",
            t("kennzahlen.hotel"),
            (k) =>
              k ? (
                <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5">
                  <span title={t("kennzahlen.anreisen")} className="text-emerald-700">
                    <Icon icon="ph:sign-in" className="mr-0.5 inline size-3" />
                    {k.anreisen}
                  </span>
                  <span title={t("kennzahlen.abreisen")} className="text-rose-700">
                    <Icon icon="ph:sign-out" className="mr-0.5 inline size-3" />
                    {k.abreisen}
                  </span>
                  <span title={t("kennzahlen.gaesteImHaus")}>
                    <Icon icon="ph:users" className="mr-0.5 inline size-3" />
                    {k.gaeste_im_haus}
                  </span>
                </span>
              ) : (
                "—"
              ),
            <span title={t("kennzahlen.summeHotel")}>
              {s.anreisen} · {s.abreisen} · {s.gaeste_im_haus}
            </span>,
          )}

          {zeile(
            "belegung",
            t("kennzahlen.belegung"),
            (k) =>
              k ? (
                <span
                  title={t("kennzahlen.belegungTitel", {
                    belegt: k.einheiten_belegt,
                    gesamt: k.einheiten_gesamt,
                  })}
                >
                  {k.einheiten_belegt}/{k.einheiten_gesamt}
                  {k.belegung_pct !== null && (
                    <span className="ml-1 text-muted-foreground">
                      ({Math.round(k.belegung_pct)} %)
                    </span>
                  )}
                </span>
              ) : (
                "—"
              ),
          )}

          {/* --- Personalzeilen (immer sichtbar) ------------------------------- */}
          {zeile(
            "plan",
            t("kennzahlen.planStunden"),
            (k) => (k ? stunden(k.plan_minuten) : "—"),
            `${stunden(s.plan_minuten)} h`,
          )}
          {zeile(
            "einsaetze",
            t("kennzahlen.einsaetze"),
            (k) => (k ? `${k.einsaetze} / ${k.personen}` : "—"),
            String(s.einsaetze),
          )}

          {/* --- Finanzzeilen: nur wenn der Server Werte liefert (Recht) ------- */}
          {hat((k) => k.umsatz_plan_minor ?? k.umsatz_ist_minor) &&
            zeile(
              "umsatz",
              t("kennzahlen.umsatz"),
              (k) => {
                if (!k) return "—";
                const ist = k.umsatz_ist_minor;
                const plan = k.umsatz_plan_minor;
                return (
                  <span
                    title={
                      k.umsatz_quelle ? t(`kennzahlen.quelle.${k.umsatz_quelle}`) : undefined
                    }
                  >
                    {geld(ist ?? plan)}
                    {k.umsatz_quelle && k.umsatz_quelle !== "buchungen" && (
                      <Icon
                        icon={k.umsatz_quelle === "prognose" ? "ph:sparkle" : "ph:pencil-simple"}
                        className="ml-0.5 inline size-3 text-muted-foreground"
                      />
                    )}
                  </span>
                );
              },
              geld(s.umsatz_ist_minor ?? s.umsatz_plan_minor),
            )}

          {hat((k) => k.personalkosten_plan_minor ?? k.personalkosten_ist_minor) &&
            zeile(
              "kosten",
              t("kennzahlen.personalkosten"),
              (k) => (k ? geld(k.personalkosten_ist_minor ?? k.personalkosten_plan_minor) : "—"),
              geld(s.personalkosten_ist_minor ?? s.personalkosten_plan_minor),
            )}

          {hat((k) => k.personalkostenquote_pct) &&
            zeile(
              "quote",
              t("kennzahlen.quote"),
              (k) => (k ? pct(k.personalkostenquote_pct) : "—"),
              pct(s.personalkostenquote_pct),
            )}

          {hat((k) => k.produktivitaet_minor_je_stunde) &&
            zeile(
              "produktivitaet",
              t("kennzahlen.produktivitaet"),
              (k) => {
                if (!k) return "—";
                const ab = abweichungPct(
                  k.produktivitaet_minor_je_stunde,
                  k.ziel_produktivitaet_minor,
                );
                const farbe =
                  ab === null ? "" : Math.abs(ab) <= 5 ? "text-emerald-700" : "text-rose-700";
                return (
                  <span
                    className={farbe}
                    title={
                      k.ziel_produktivitaet_minor !== null
                        ? t("kennzahlen.zielProduktivitaet", {
                            wert: formatCurrency(k.ziel_produktivitaet_minor / 100, currency),
                          })
                        : undefined
                    }
                  >
                    {geld(k.produktivitaet_minor_je_stunde)}
                  </span>
                );
              },
              geld(s.produktivitaet_minor_je_stunde),
            )}

          {hat((k) => k.stundenlimit_minuten) &&
            zeile(
              "stundenlimit",
              t("kennzahlen.stundenlimit"),
              (k) => {
                if (!k || k.stundenlimit_minuten === null) return "—";
                const ueber = k.plan_minuten > k.stundenlimit_minuten;
                return (
                  <span className={ueber ? "text-amber-700" : ""}>
                    {stunden(k.plan_minuten)}/{stunden(k.stundenlimit_minuten)}
                  </span>
                );
              },
              s.stundenlimit_minuten !== null ? stunden(s.stundenlimit_minuten) : "—",
            )}

          {hat((k) => k.budget_minor ?? k.budget_stunden) &&
            zeile(
              "budget",
              t("kennzahlen.budget"),
              (k) => {
                if (!k) return "—";
                const ab = k.abweichung_budget_pct;
                return (
                  <span>
                    {k.budget_minor !== null
                      ? geld(k.budget_minor)
                      : k.budget_stunden !== null
                        ? `${k.budget_stunden} h`
                        : "—"}
                    {ab !== null && (
                      <span className={`ml-1 ${ab > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {ab > 0 ? "+" : ""}
                        {ab.toFixed(0)} %
                      </span>
                    )}
                  </span>
                );
              },
              s.budget_minor !== null
                ? geld(s.budget_minor)
                : s.budget_stunden !== null
                  ? `${s.budget_stunden} h`
                  : "—",
            )}
        </tbody>
      </table>
      {kennzahlen.hinweise.length > 0 && (
        <ul className="border-t px-3 py-2 text-xs text-amber-800">
          {kennzahlen.hinweise.map((h) => (
            <li key={h}>
              <Icon icon="ph:info" className="mr-1 inline size-3" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
