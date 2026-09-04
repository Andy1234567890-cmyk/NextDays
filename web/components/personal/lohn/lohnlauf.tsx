"use client";

// Lohnlauf: Jahreswahl, zwölf Monatszeilen mit der Statuskette als Fortschritt
// (Entwurf → Geprüft → Freigegeben → Exportiert) und je Monat genau die
// Aktionen, die der Status erlaubt (Vertrag §4.3).
//
// KEIN STILLER KNOPF (Wurzel 5): solange Fehler offen sind, ist „Freigeben"
// deaktiviert UND sagt daneben, warum. Ein Knopf, der nichts tut, ist
// schlimmer als keiner — der Server antwortet 409 `nicht_geprueft`, und diese
// Antwort kommt als Toast mit dem übersetzten Code.
//
// FREMDE ZEITPUNKTE (Wurzel 5b): geprüft/freigegeben/exportiert stehen mit dem
// Zeitpunkt AUS DER ANTWORT (`geprueft_am`, `freigegeben_am`,
// `exportiert_am`). Nie `new Date()` — unsere Uhr ist nicht der Zeitpunkt
// einer Handlung, die schon passiert ist.
//
// Kein Realtime: `personal_lohnlaeufe` ist eine Finanztabelle ohne Grant
// (Wurzel 6, Vertrag §0). Nach eigener Aktion wird die Antwort in den Zustand
// übernommen bzw. neu geladen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  listLohnlaeufe,
  lohnlaufAnlegen,
  lohnlaufExportieren,
  lohnlaufFreigeben,
  lohnlaufPruefen,
  lohnlaufZuruecksetzen,
} from "@/lib/personal-berichte";
import type { LohnExportFormat, Lohnlauf, LohnlaufStatus } from "@/lib/personal-berichte-typen";
import { LOHNLAUF_KETTE, MONATE } from "@/lib/personal-berichte-typen";
import { formatDateTime } from "@/lib/utils";

import { Pruefliste } from "./pruefliste";

export function LohnlaufSeite({
  jahr: jahrInitial,
  laeufe: laeufeInitial,
  loadError,
}: {
  jahr: number;
  laeufe: Lohnlauf[];
  loadError: string | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [jahr, setJahr] = useState(jahrInitial);
  const [laeufe, setLaeufe] = useState(laeufeInitial);
  const [fehler, setFehler] = useState(loadError);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [format, setFormat] = useState<LohnExportFormat>("datev_lodas");
  const [ruecksetzen, setRuecksetzen] = useState<Lohnlauf | null>(null);

  const jetztJahr = new Date().getFullYear();
  const jahre = [jetztJahr + 1, jetztJahr, jetztJahr - 1, jetztJahr - 2, jetztJahr - 3];

  /** Fehlermeldung: der Vertragscode aus `details.code` schlägt den Servertext,
   *  damit die Meldung in der Sprache des Betrachters steht. */
  function melden(error: string, details?: Record<string, unknown>) {
    const code = typeof details?.code === "string" ? details.code : null;
    toast.error(code && t.has(`fehlercode.${code}`) ? t(`fehlercode.${code}`) : error);
  }

  async function jahrLaden(j: number) {
    setJahr(j);
    setBusy("jahr");
    const res = await listLohnlaeufe(j);
    setBusy(null);
    if (!res.ok) {
      setFehler(res.error);
      setLaeufe([]);
      return melden(res.error, res.details);
    }
    setFehler(null);
    setLaeufe(res.data);
  }

  /** Ersetzt genau den Lauf des Monats — ein Nachladen der ganzen Liste würde
   *  die aufgeklappte Prüfliste eines anderen Monats mitreissen. */
  function uebernehmen(lauf: Lohnlauf) {
    setLaeufe((alt) => {
      const ohne = alt.filter((l) => !(l.jahr === lauf.jahr && l.monat === lauf.monat));
      return [...ohne, lauf].sort((a, b) => a.monat - b.monat);
    });
  }

  async function aktion(
    monat: number,
    schluessel: string,
    fn: () => Promise<
      { ok: true; data: Lohnlauf } | { ok: false; error: string; details?: Record<string, unknown> }
    >,
    erfolg: string,
  ) {
    setBusy(`${monat}-${schluessel}`);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return melden(res.error, res.details);
    uebernehmen(res.data);
    setOffen(monat);
    toast.success(erfolg);
  }

  async function exportieren(lauf: Lohnlauf) {
    setBusy(`${lauf.monat}-export`);
    const res = await lohnlaufExportieren(lauf.id, format);
    setBusy(null);
    if (!res.ok) return melden(res.error, res.details);
    const bytes = Uint8Array.from(atob(res.data.inhalt_base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: res.data.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("lohn.exportiert", { name: res.data.name }));
    // Der Export setzt serverseitig `exportiert` — die Liste des Jahres holt
    // den neuen Status, statt ihn hier zu erraten.
    const neu = await listLohnlaeufe(jahr);
    if (neu.ok) setLaeufe(neu.data);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("lohn.titel")}</h1>
          <p className="text-sm text-muted-foreground">{t("lohn.untertitel")}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("lohn.jahr")}</span>
          <NativeSelect
            value={jahr}
            disabled={busy !== null}
            onChange={(e) => void jahrLaden(Number(e.target.value))}
            className="w-32"
          >
            {jahre.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {fehler && (
        <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {fehler}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {MONATE.map((monat) => {
          const lauf = laeufe.find((l) => l.monat === monat) ?? null;
          return (
            <MonatsZeile
              key={monat}
              jahr={jahr}
              monat={monat}
              lauf={lauf}
              locale={locale}
              busy={busy}
              offen={offen === monat}
              format={format}
              onFormat={setFormat}
              onToggle={() => setOffen((o) => (o === monat ? null : monat))}
              onAnlegen={() =>
                aktion(monat, "anlegen", () => lohnlaufAnlegen(jahr, monat), t("lohn.angelegt"))
              }
              onPruefen={() =>
                lauf &&
                aktion(monat, "pruefen", () => lohnlaufPruefen(lauf.id), t("lohn.geprueft"))
              }
              onFreigeben={() =>
                lauf &&
                aktion(
                  monat,
                  "freigeben",
                  () => lohnlaufFreigeben(lauf.id),
                  t("lohn.freigegeben"),
                )
              }
              onExport={() => lauf && void exportieren(lauf)}
              onZuruecksetzen={() => lauf && setRuecksetzen(lauf)}
            />
          );
        })}
      </ul>

      {ruecksetzen && (
        <ZuruecksetzenDialog
          lauf={ruecksetzen}
          onClose={() => setRuecksetzen(null)}
          onDone={(lauf) => {
            uebernehmen(lauf);
            setRuecksetzen(null);
            toast.success(t("lohn.zurueckgesetzt"));
          }}
          onError={melden}
        />
      )}
    </div>
  );
}

function MonatsZeile({
  jahr,
  monat,
  lauf,
  locale,
  busy,
  offen,
  format,
  onFormat,
  onToggle,
  onAnlegen,
  onPruefen,
  onFreigeben,
  onExport,
  onZuruecksetzen,
}: {
  jahr: number;
  monat: number;
  lauf: Lohnlauf | null;
  locale: string;
  busy: string | null;
  offen: boolean;
  format: LohnExportFormat;
  onFormat: (f: LohnExportFormat) => void;
  onToggle: () => void;
  onAnlegen: () => void;
  onPruefen: () => void;
  onFreigeben: () => void;
  onExport: () => void;
  onZuruecksetzen: () => void;
}) {
  const t = useTranslations("personal");
  const laeuft = (schluessel: string) => busy === `${monat}-${schluessel}`;
  const irgendwas = busy !== null;

  const monatName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(Date.UTC(jahr, monat - 1, 1)),
  );

  const fehlerAnzahl = lauf?.pruefungen?.fehler.length ?? 0;
  const warnAnzahl = lauf?.pruefungen?.warnungen.length ?? 0;
  const status = lauf?.status ?? null;
  // Freigeben verlangt `geprueft` UND keine offenen Fehler — beides prüft der
  // Server, hier steht nur der Grund daneben.
  const freigabeGrund =
    status !== "geprueft"
      ? fehlerAnzahl > 0
        ? t("lohn.freigabeGesperrtFehler", { anzahl: fehlerAnzahl })
        : t("lohn.freigabeGesperrtUngeprueft")
      : null;

  return (
    <li className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span className="w-28 shrink-0 font-medium capitalize">{monatName}</span>
        <Kette status={status} />
        <span className="flex-1 text-xs text-muted-foreground">
          {lauf ? zeitzeile(lauf, locale, t) : t("lohn.keinLauf")}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {!lauf && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={irgendwas}
              onClick={onAnlegen}
            >
              {laeuft("anlegen") && (
                <Icon icon="ph:spinner" aria-hidden className="mr-1 size-4 animate-spin" />
              )}
              {t("lohn.aktion.anlegen")}
            </Button>
          )}

          {lauf && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={irgendwas}
                onClick={onPruefen}
              >
                {laeuft("pruefen") ? (
                  <Icon icon="ph:spinner" aria-hidden className="mr-1 size-4 animate-spin" />
                ) : (
                  <Icon icon="ph:magnifying-glass" aria-hidden className="mr-1 size-4" />
                )}
                {t("lohn.aktion.pruefen")}
              </Button>

              <span className="flex items-center gap-1">
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={irgendwas || status !== "geprueft"}
                  title={freigabeGrund ?? undefined}
                  onClick={onFreigeben}
                >
                  {laeuft("freigeben") && (
                    <Icon icon="ph:spinner" aria-hidden className="mr-1 size-4 animate-spin" />
                  )}
                  {t("lohn.aktion.freigeben")}
                </Button>
                {freigabeGrund && (
                  <span className="max-w-48 text-xs text-amber-800">{freigabeGrund}</span>
                )}
              </span>

              {(status === "freigegeben" || status === "exportiert") && (
                <>
                  <NativeSelect
                    value={format}
                    disabled={irgendwas}
                    onChange={(e) => onFormat(e.target.value as LohnExportFormat)}
                    className="h-9 w-40"
                    aria-label={t("lohn.exportFormat")}
                  >
                    <option value="datev_lodas">{t("lohn.format.datev_lodas")}</option>
                    <option value="csv">{t("lohn.format.csv")}</option>
                  </NativeSelect>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={irgendwas}
                    onClick={onExport}
                  >
                    {laeuft("export") ? (
                      <Icon icon="ph:spinner" aria-hidden className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Icon icon="ph:download-simple" aria-hidden className="mr-1 size-4" />
                    )}
                    {t("lohn.aktion.exportieren")}
                  </Button>
                </>
              )}

              {status !== "entwurf" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  disabled={irgendwas}
                  onClick={onZuruecksetzen}
                >
                  <Icon icon="ph:arrow-counter-clockwise" aria-hidden className="mr-1 size-4" />
                  {t("lohn.aktion.zuruecksetzen")}
                </Button>
              )}

              {lauf.pruefungen && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={onToggle}
                  aria-expanded={offen}
                >
                  <Icon
                    icon={offen ? "ph:caret-up" : "ph:caret-down"}
                    aria-hidden
                    className="mr-1 size-4"
                  />
                  {fehlerAnzahl + warnAnzahl > 0
                    ? t("lohn.befunde", { anzahl: fehlerAnzahl + warnAnzahl })
                    : t("lohn.pruefliste")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {offen && lauf?.pruefungen && (
        <div className="border-t p-3">
          <Pruefliste pruefungen={lauf.pruefungen} />
          {lauf.notiz && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("notiz")}: {lauf.notiz}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Die Statuskette als Fortschritt. Erreichte Stufen sind gefüllt, die
 *  aktuelle ist beschriftet — kein Prozentbalken, weil die Kette diskret ist
 *  (vier Schritte, keine Zwischenwerte). */
function Kette({ status }: { status: LohnlaufStatus | null }) {
  const t = useTranslations("personal");
  const index = status ? LOHNLAUF_KETTE.indexOf(status) : -1;
  return (
    <span className="flex items-center gap-1" aria-label={status ? t(`lohn.status.${status}`) : undefined}>
      {LOHNLAUF_KETTE.map((stufe, i) => {
        const erreicht = i <= index;
        const aktuell = i === index;
        return (
          <span key={stufe} className="flex items-center gap-1">
            {i > 0 && (
              <span
                aria-hidden
                className={`h-0.5 w-3 ${erreicht ? "bg-emerald-500" : "bg-border"}`}
              />
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                aktuell
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                  : erreicht
                    ? "border-emerald-200 bg-emerald-50/50 text-emerald-700"
                    : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {erreicht && <Icon icon="ph:check" aria-hidden className="size-3" />}
              {t(`lohn.status.${stufe}`)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Prüf-/Freigabe-/Export-Zeitpunkte AUS DER ANTWORT (Wurzel 5b). */
function zeitzeile(
  lauf: Lohnlauf,
  locale: string,
  t: ReturnType<typeof useTranslations<"personal">>,
): string {
  const teile: string[] = [];
  if (lauf.geprueft_am)
    teile.push(t("lohn.geprueftAm", { zeit: formatDateTime(lauf.geprueft_am, locale) }));
  if (lauf.freigegeben_am)
    teile.push(t("lohn.freigegebenAm", { zeit: formatDateTime(lauf.freigegeben_am, locale) }));
  if (lauf.exportiert_am)
    teile.push(
      t("lohn.exportiertAm", {
        zeit: formatDateTime(lauf.exportiert_am, locale),
        name: lauf.export_name ?? lauf.export_format ?? "—",
      }),
    );
  return teile.join(" · ") || t("lohn.status.entwurf");
}

function ZuruecksetzenDialog({
  lauf,
  onClose,
  onDone,
  onError,
}: {
  lauf: Lohnlauf;
  onClose: () => void;
  onDone: (lauf: Lohnlauf) => void;
  onError: (error: string, details?: Record<string, unknown>) => void;
}) {
  const t = useTranslations("personal");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);

  async function speichern() {
    setBusy(true);
    const res = await lohnlaufZuruecksetzen(lauf.id, grund.trim());
    setBusy(false);
    if (!res.ok) return onError(res.error, res.details);
    onDone(res.data);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("lohn.zuruecksetzenTitel")}</DialogTitle>
        <DialogDescription>{t("lohn.zuruecksetzenText")}</DialogDescription>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("grund")}</span>
          <Textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={3}
            placeholder={t("lohn.zuruecksetzenGrund")}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
            {t("abbrechen")}
          </Button>
          {/* Pflichtgrund: der Knopf bleibt gesperrt, bis er da ist — der
              Server verlangt ihn ohnehin (§4.3). */}
          <Button
            variant="destructive"
            className="rounded-full"
            disabled={busy || grund.trim().length < 3}
            onClick={speichern}
          >
            {busy && <Icon icon="ph:spinner" aria-hidden className="mr-1 size-4 animate-spin" />}
            {t("lohn.aktion.zuruecksetzen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
