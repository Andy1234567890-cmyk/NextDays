"use client";

// Rechtes Panel des Multi-Kalenders für eine ZELLEN-Auswahl (Vorbild: Airbnbs
// „Ausgewählte Reisedaten"): Zeitraum zum Nachjustieren, betroffene Inserate,
// Verfügbarkeit, Preis pro Nacht, Mindestaufenthalt, Saison.
//
// Drei Regeln, die das Vorbild ebenso hält und die hier nicht weich sind:
//   • Liegt in der Auswahl eine BUCHUNG, ist die Verfügbarkeit gesperrt. Eine
//     gebuchte Nacht „freizugeben" hieße, sie doppelt zu verkaufen.
//   • Uneinheitliche Werte stehen als Spanne im Platzhalter („682 – 824"),
//     nicht als ein herausgegriffener Wert — sonst überschriebe ein Speichern
//     ohne Eingabe stillschweigend 30 verschiedene Preise mit einem.
//   • Gespeichert wird nur, was der Gastgeber wirklich geändert hat.
//
// Alles zusammen geht in EINEM Aufruf an `/calendar/bulk-edit` — derselbe
// Endpunkt, den auch der PMS-Kalender benutzt. Damit bleiben Channex-Push und
// Gegenzustände (Wurzel 1) an einer Stelle.
//
// Die Regel-Auswahl entspricht dem Vorbild (am 06.09.2026 gemessen): EIN
// Auswahlfeld mit „Keine", allen Regelsätzen und als letztem Eintrag
// „Regeln hinzufügen …", das den Editor öffnet.
//
// Ein Unterschied im Unterbau, der hier sichtbar wird: dort gehört ein
// Regelsatz dem KONTO, bei uns dem Objekt (`property_seasons.property_id`).
// Damit die Auswahl über mehrere Objekte trotzdem funktioniert, überträgt
// `wendeRegelsatzAn` den Satz zuerst als eigenständige Kopie auf die Objekte,
// die ihn noch nicht haben, und weist ihn dann überall zu. Gleichnamige Sätze
// verschiedener Objekte sind deshalb EIN Eintrag in der Liste.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { currencySymbol, formatCurrency } from "@nextdays/currency";
import { DatePicker } from "@nextdays/ui/date-picker";

import { useFormatierung } from "@/lib/formatierung";
import type { KalenderTag, Saison } from "@/lib/kalender";
import {
  loeseSaison,
  setzeBereich,
  wendeRegelsatzAn,
} from "@/lib/kalender-actions";

import { RegelsatzEditor } from "./regelsatz-editor";
import { alsDatum, tagesReihe, tagPlus } from "@/lib/kalender-datum";
import { PANEL_REM } from "@/lib/kalender-mass";

type Verfuegbarkeit = "offen" | "gesperrt" | "gemischt";

export function BearbeitenPanel({
  objektIds,
  von,
  bis,
  tagesDaten,
  saisons,
  waehrung,
  onZeitraum,
  onSchliessen,
  onGespeichert,
}: {
  objektIds: string[];
  /** Erster ausgewählter Tag. */
  von: string;
  /** Letzter ausgewählter Tag (inklusiv, wie die Auswahl im Raster). */
  bis: string;
  tagesDaten: Map<string, Map<string, KalenderTag>>;
  /** Saisons der gewählten Objekte (leer, solange nicht geladen). */
  saisons: Saison[];
  waehrung: string | null;
  /** Zeitraum aus den Datumsfeldern heraus ändern — das Raster markiert mit. */
  onZeitraum: (von: string, bis: string) => void;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const t = useTranslations("kalender");
  const f = useFormatierung();
  const [preisEingabe, setPreisEingabe] = useState("");
  const [minEingabe, setMinEingabe] = useState("");
  const [wunsch, setWunsch] = useState<"offen" | "gesperrt" | null>(null);
  const [saisonWahl, setSaisonWahl] = useState("");
  const [editorOffen, setEditorOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  const tage = useMemo(() => tagesReihe(von, tagPlus(bis, 1)), [von, bis]);

  // Ist-Zustand der Auswahl: Verfügbarkeit, Preis- und Min-Stay-Spanne,
  // Buchung enthalten?
  const stand = useMemo(() => {
    let offen = 0;
    let gesperrt = 0;
    let gebucht = 0;
    const preise: number[] = [];
    const minStay: number[] = [];
    for (const id of objektIds) {
      const daten = tagesDaten.get(id);
      for (const tag of tage) {
        const d = daten?.get(tag);
        if (!d) continue;
        if (d.status === "booked") gebucht++;
        else if (d.status === "blocked") gesperrt++;
        else offen++;
        if (d.price != null) preise.push(d.price);
        if (d.min_stay != null) minStay.push(d.min_stay);
      }
    }
    const verfuegbarkeit: Verfuegbarkeit =
      gesperrt > 0 && offen === 0
        ? "gesperrt"
        : offen > 0 && gesperrt === 0
          ? "offen"
          : "gemischt";
    return { verfuegbarkeit, gebucht, preise, minStay, naechte: tage.length };
  }, [objektIds, tage, tagesDaten]);

  const gewaehlteVerfuegbarkeit =
    wunsch ?? (stand.verfuegbarkeit === "gemischt" ? null : stand.verfuegbarkeit);

  /** Ein Wert, wenn alle gleich sind, sonst die Spanne — nie ein herausgegriffener. */
  function spanne(werte: number[], zeige: (n: number) => string): string {
    if (werte.length === 0) return "";
    const min = Math.min(...werte);
    const max = Math.max(...werte);
    return min === max ? zeige(min) : `${zeige(min)} – ${zeige(max)}`;
  }

  const preisPlatzhalter =
    spanne(stand.preise, (n) => formatCurrency(n, waehrung)) || t("keinPreis");
  const minPlatzhalter =
    spanne(stand.minStay, (n) => String(n)) || t("keinMindestaufenthalt");

  const preisGeaendert = preisEingabe.trim().length > 0;
  const minGeaendert = minEingabe.trim().length > 0;
  const verfuegbarkeitGeaendert = wunsch !== null && wunsch !== stand.verfuegbarkeit;
  const etwasZuTun = preisGeaendert || minGeaendert || verfuegbarkeitGeaendert;

  // Die wählbaren Regelsätze: je NAME einer. Steht derselbe Name an mehreren
  // Objekten, ist es für den Gastgeber eine Regel — welches Objekt die Vorlage
  // liefert, ist seine Sache nicht. Bevorzugt wird ein Satz eines der gerade
  // gewählten Objekte, damit die Anwendung ohne Kopie auskommt.
  const gewaehlt = useMemo(() => new Set(objektIds), [objektIds]);
  const waehlbareSaisons = useMemo(() => {
    const je = new Map<string, Saison>();
    for (const s of saisons) {
      const bisher = je.get(s.name);
      if (!bisher || (!gewaehlt.has(bisher.property_id) && gewaehlt.has(s.property_id))) {
        je.set(s.name, s);
      }
    }
    return [...je.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [saisons, gewaehlt]);

  async function speichern() {
    setLaeuft(true);
    const res = await setzeBereich(objektIds, von, bis, {
      preis: preisGeaendert
        ? Number(preisEingabe.replace(/\s/g, "").replace(",", "."))
        : null,
      mindestaufenthalt: minGeaendert ? Math.round(Number(minEingabe)) : null,
      gesperrt: verfuegbarkeitGeaendert ? wunsch === "gesperrt" : null,
    });
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success(t("gespeichert"));
    setPreisEingabe("");
    setMinEingabe("");
    setWunsch(null);
    onGespeichert();
  }

  async function saisonSetzen(wert: string) {
    if (wert === "__neu") {
      setEditorOffen(true);
      return;
    }
    setSaisonWahl(wert);
    setLaeuft(true);
    if (wert === "") {
      // Lösen geht je Objekt — der Endpunkt nimmt genau eines. Ein Fehler bei
      // einem Objekt wird gemeldet, die übrigen bleiben gelöst (kein stilles
      // Zurückrollen, das mehr zerstört als der Fehler selbst).
      let fehler: string | null = null;
      for (const id of objektIds) {
        const res = await loeseSaison(id, von, bis);
        if (!res.ok) fehler = res.fehler;
      }
      setLaeuft(false);
      if (fehler) toast.error(fehler);
      else {
        toast.success(t("saisonGeloest"));
        onGespeichert();
      }
      return;
    }
    const satz = waehlbareSaisons.find((s) => s.id === wert);
    if (!satz) {
      setLaeuft(false);
      return;
    }
    const res = await wendeRegelsatzAn(satz, objektIds, von, bis);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    if (res.data.gesetzt.length > 0) toast.success(t("saisonZugewiesen"));
    if (res.data.fehlgeschlagen.length > 0) {
      toast.error(
        t("regelsatzTeilweise", { anzahl: res.data.fehlgeschlagen.length }),
      );
    }
    onGespeichert();
  }

  return (
    <aside style={{ width: `${PANEL_REM}rem` }}
      className="flex shrink-0 flex-col overflow-y-auto border-s border-border">
      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={onSchliessen}
          aria-label={t("schliessen")}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      <div className="px-5 pb-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {t("auswahlTitel")}
        </h2>

        {/* Zeitraum: nachjustierbar wie im Vorbild, nicht nur Anzeige. Das
            Raster markiert die neue Auswahl sofort mit. */}
        {/* UNSER Datepicker, nicht `input type="date"`. Der native öffnet das
            Popup des Betriebssystems — blaue Systemfarbe, fremde Schrift,
            „Löschen/Heute" auf Englisch je nach Gerät. In einem Kalender, der
            bis auf den Punkt nachgebaut ist, war genau das der Fremdkörper. */}
        <div className="mt-4 flex items-center gap-2">
          <DatePicker
            value={von}
            onChange={(wert) => wert && onZeitraum(wert, bis)}
            placeholder={t("startdatum")}
            className="flex-1"
          />
          <Icon
            icon="ph:arrow-right"
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <DatePicker
            value={bis}
            onChange={(wert) => wert && onZeitraum(von, wert)}
            placeholder={t("enddatum")}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onZeitraum(von, von)}
            aria-label={t("zeitraumZuruecksetzen")}
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-3" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {[
            objektIds.length === 1
              ? t("einInserat")
              : t("inserate", { anzahl: objektIds.length }),
            stand.naechte === 1
              ? t("eineNacht")
              : t("naechte", { anzahl: stand.naechte }),
          ].join(" · ")}
        </p>

        {/* Verfügbarkeit */}
        <section className="mt-8">
          <h3 className="font-medium">{t("verfuegbarkeit")}</h3>
          {stand.gebucht > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("gebuchtHinweis")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(
                [
                  ["offen", "verfuegbar"],
                  ["gesperrt", "geblockt"],
                ] as const
              ).map(([wert, label]) => (
                <label
                  key={wert}
                  className="flex cursor-pointer items-center gap-3 text-[0.9375rem]"
                >
                  <input
                    type="radio"
                    name="verfuegbarkeit"
                    checked={gewaehlteVerfuegbarkeit === wert}
                    onChange={() => setWunsch(wert)}
                    disabled={laeuft}
                    className="size-4 accent-foreground"
                  />
                  {t(label)}
                </label>
              ))}
              {stand.verfuegbarkeit === "gemischt" && wunsch === null && (
                <p className="text-sm text-muted-foreground">{t("gemischtHinweis")}</p>
              )}
            </div>
          )}
        </section>

        {/* Preis */}
        <section className="mt-8">
          <h3 className="font-medium">{t("preisProNacht")}</h3>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4">
            <span className="text-sm text-muted-foreground">
              {currencySymbol(waehrung)}
            </span>
            <input
              value={preisEingabe}
              onChange={(e) => setPreisEingabe(e.target.value)}
              inputMode="decimal"
              placeholder={preisPlatzhalter}
              aria-label={t("preisProNacht")}
              disabled={laeuft}
              className="h-11 w-full bg-transparent text-[0.9375rem] tabular-nums outline-none"
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("preisHinweis")}</p>
        </section>

        {/* Mindestaufenthalt */}
        <section className="mt-8">
          <h3 className="font-medium">{t("mindestaufenthalt")}</h3>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4">
            <input
              value={minEingabe}
              onChange={(e) => setMinEingabe(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={minPlatzhalter}
              aria-label={t("mindestaufenthalt")}
              disabled={laeuft}
              className="h-11 w-full bg-transparent text-[0.9375rem] tabular-nums outline-none"
            />
            <span className="text-sm text-muted-foreground">{t("naechteKurz")}</span>
          </div>
          {/* Ehrlich benennen, was der Wert wirklich tut: er hängt am
              Preisplan und gilt damit für das GANZE Objekt, nicht nur für die
              markierten Tage. Ohne diesen Satz verspricht das Feld eine
              Genauigkeit, die die Daten nicht haben. */}
          <p className="mt-2 text-sm text-muted-foreground">
            {t("mindestaufenthaltHinweis")}
          </p>
        </section>

        {/* Regeln — der Regelsatz, der Preis und Aufenthalt dieser Tage
            bestimmt. Im Vorbild heißt der Abschnitt „Regeln". */}
        <section className="mt-8">
          <h3 className="font-medium">{t("regeln")}</h3>
          <select
            value={saisonWahl}
            onChange={(e) => void saisonSetzen(e.target.value)}
            disabled={laeuft}
            aria-label={t("regeln")}
            className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-[0.9375rem] outline-none focus-visible:border-foreground"
          >
            <option value="">{t("saisonKeine2")}</option>
            {waehlbareSaisons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__neu">{t("regelnHinzufuegen")}</option>
          </select>
          {objektIds.length > 1 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("regelnMehrereObjekte", { anzahl: objektIds.length })}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={() => void speichern()}
          disabled={laeuft || !etwasZuTun}
          className="mt-8 w-full rounded-full bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {laeuft ? t("wirdGespeichert") : t("speichern")}
        </button>

        {/* Debug-Angabe für den Support-Fall: welcher Zeitraum und wie viele
            Objekte wirklich gemeint sind — im Fehlerfall die erste Frage. */}
        <p className="mt-4 text-xs text-muted-foreground/70">
          {t("auswahlTechnisch", {
            von: f.datum(alsDatum(von), { day: "2-digit", month: "2-digit" }),
            bis: f.datum(alsDatum(tagPlus(bis, 1)), {
              day: "2-digit",
              month: "2-digit",
            }),
            objekte: objektIds.length,
          })}
        </p>
      </div>

      {/* „Regeln hinzufügen …" — derselbe Editor wie im Regelsatz-Panel. Nach
          dem Speichern wird der frische Satz NICHT automatisch zugewiesen: die
          Liste lädt nach, und der Gastgeber wählt ihn. Ein stilles Zuweisen
          wäre eine Preisänderung, die niemand angeordnet hat. */}
      {editorOffen && (
        <RegelsatzEditor
          offen
          saison={null}
          propertyId={objektIds[0]}
          rabatte={[]}
          onSchliessen={() => setEditorOffen(false)}
          onGespeichert={onGespeichert}
        />
      )}
    </aside>
  );
}
