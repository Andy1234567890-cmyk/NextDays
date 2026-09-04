"use client";

// Abwesenheitskalender als Gantt (Vertrag §6): Zeilen sind Personen mit
// Personalnummer, Spalten sind Tage, Balken sind Abwesenheiten.
//
// WARUM GANTT UND KEIN MONATSRASTER
// ---------------------------------
// Die Frage an diese Ansicht ist nie „was ist am 14. los", sondern „wer fehlt
// wann gleichzeitig". Ein Monatsraster (ein Kasten je Tag, Namen darin) kann
// das nicht zeigen: zwei ueberlappende Urlaube stehen dort in verschiedenen
// Kaesten und man muss sie im Kopf zusammensetzen. Im Gantt liegen sie
// untereinander und die Ueberlappung IST die Grafik.
//
// DREI SICHTEN, EIN RECHENWEG
// ---------------------------
// Woche (7 Spalten = Tage), Monat (28–31 Spalten = Tage), Jahr (12 Spalten =
// Monate). Alle drei rechnen dieselbe Position: Prozent des Fensters. Die
// Jahressicht faellt bewusst auf MONATS-Spalten zurueck statt 365 Tagesspalten
// zu zeichnen — ein Ein-Pixel-Streifen je Tag ist auf keinem Schirm lesbar,
// und der Balken bleibt trotzdem tagesgenau positioniert (er rechnet in
// Prozent, nicht in Spalten).
//
// WAS DIE BALKEN UNTERSCHEIDEN
// ----------------------------
// * Farbe = ART (Urlaub, Krank, Frei, …) — dieselbe Zuordnung wie im Dienstplan.
// * Gestrichelter Rand = Status `beantragt` (noch nicht entschieden).
// * Eigene, kraeftige Randfarbe = Status `vorgenehmigt` (§1.5, zweistufig):
//   das ist NICHT „genehmigt" und darf nicht so aussehen — die Leitung muss
//   noch entscheiden, und wer die Ansicht liest, plant sonst auf einen
//   Zustand, der noch kippen kann.
// * Warnzeichen = `schichten_im_zeitraum > 0`: der Antrag traegt geplante
//   Schichten, die bei Genehmigung abgesagt werden.
// Abgelehnte und stornierte Antraege werden NICHT gezeichnet: sie sind keine
// Abwesenheit, und als blasser Balken wuerden sie als „faellt aus" gelesen.
//
// PERSONALNUMMER
// --------------
// Kommt aus der Mitarbeiterliste (`employee_number`), nicht aus `PlanPerson` —
// die traegt sie nicht. Fehlt sie, steht „—": eine erfundene laufende Nummer
// waere ein Fantasiewert (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Segmented } from "@nextdays/ui/segmented";
import {
  type AbwesenheitPlus,
  type AbwesenheitStatusPlus,
  tageZwischen,
} from "@/lib/personal-betrieb-typen";
import {
  ABWESENHEIT_ARTEN,
  type AbwesenheitArt,
  type PlanPerson,
  heuteIso,
  montagVon,
  tagePlus,
} from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

export type KalenderSicht = "woche" | "monat" | "jahr";

/** Balkenfarbe je Abwesenheitsart — bewusst dieselben Familien wie im
 *  Dienstplan, damit ein Blick zwischen beiden Ansichten nicht umlernt. */
const ART_FARBE: Record<AbwesenheitArt, string> = {
  urlaub: "bg-sky-500/80",
  krank: "bg-rose-500/80",
  kind_krank: "bg-rose-400/80",
  unbezahlt: "bg-neutral-500/80",
  sonderurlaub: "bg-violet-500/80",
  schulung: "bg-amber-500/80",
  frei: "bg-emerald-500/80",
};

/** Randbehandlung je Status. `genehmigt` bekommt keinen eigenen Rand — es ist
 *  der Normalfall und braucht keine Auszeichnung. */
const STATUS_RAND: Record<AbwesenheitStatusPlus, string> = {
  beantragt: "border-2 border-dashed border-foreground/60",
  vorgenehmigt: "border-2 border-solid border-fuchsia-500 ring-1 ring-fuchsia-500/40",
  genehmigt: "",
  abgelehnt: "",
  storniert: "",
};

/** Nur diese Zustaende sind eine Abwesenheit im Kalender. */
const SICHTBAR = new Set<AbwesenheitStatusPlus>(["beantragt", "vorgenehmigt", "genehmigt"]);

/** Fenster (von/bis) der gewaehlten Sicht um einen Anker. */
function fenster(sicht: KalenderSicht, anker: string): { von: string; bis: string } {
  if (sicht === "woche") {
    const von = montagVon(anker);
    return { von, bis: tagePlus(von, 6) };
  }
  if (sicht === "monat") {
    const von = `${anker.slice(0, 7)}-01`;
    const jahr = Number(von.slice(0, 4));
    const monat = Number(von.slice(5, 7));
    const letzter = new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10);
    return { von, bis: letzter };
  }
  return { von: `${anker.slice(0, 4)}-01-01`, bis: `${anker.slice(0, 4)}-12-31` };
}

/** Anker um eine Periode verschieben. */
function verschieben(sicht: KalenderSicht, anker: string, richtung: 1 | -1): string {
  if (sicht === "woche") return tagePlus(montagVon(anker), richtung * 7);
  if (sicht === "monat") {
    const jahr = Number(anker.slice(0, 4));
    const monat = Number(anker.slice(5, 7)) - 1 + richtung;
    return new Date(Date.UTC(jahr, monat, 1)).toISOString().slice(0, 10);
  }
  return `${Number(anker.slice(0, 4)) + richtung}-01-01`;
}

/** Position eines Datums im Fenster als Anteil 0…1 (Tagesgenau, auch in der
 *  Jahressicht mit Monatsspalten). */
function anteil(datum: string, von: string, tage: number): number {
  const versatz = (Date.parse(`${datum}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000;
  return versatz / tage;
}

export function AbwesenheitenKalender({
  eintraege,
  personen,
  personalnummern,
  zone,
  onOeffnen,
}: {
  /** Alle Antraege des geladenen Zeitraums — der Kalender filtert selbst auf
   *  sein Fenster und laedt NICHT nach: das Fenster der Seite ist mit
   *  −60/+365 Tagen weiter als jede der drei Sichten. */
  eintraege: AbwesenheitPlus[];
  personen: PlanPerson[];
  /** user_id → Personalnummer. Fehlender Eintrag ergibt „—". */
  personalnummern: Record<string, string | null>;
  zone: string;
  /** Klick auf einen Balken oeffnet den Antrag (die Seite entscheidet, wie). */
  onOeffnen?: (a: AbwesenheitPlus) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const heute = heuteIso();
  const [sicht, setSicht] = useState<KalenderSicht>("monat");
  const [anker, setAnker] = useState(heute);

  const { von, bis } = useMemo(() => fenster(sicht, anker), [sicht, anker]);
  const tage = useMemo(() => tageZwischen(von, bis), [von, bis]);

  /** Spaltenkoepfe: Tage (Woche/Monat) bzw. Monate (Jahr). */
  const spalten = useMemo(() => {
    if (sicht === "jahr") {
      const jahr = Number(von.slice(0, 4));
      return Array.from({ length: 12 }, (_, i) => {
        const erster = new Date(Date.UTC(jahr, i, 1)).toISOString().slice(0, 10);
        return {
          key: erster,
          label: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
            new Date(`${erster}T12:00:00Z`),
          ),
          heute: heute.slice(0, 7) === erster.slice(0, 7),
          wochenende: false,
        };
      });
    }
    return Array.from({ length: tage }, (_, i) => {
      const tag = tagePlus(von, i);
      const wt = (new Date(`${tag}T00:00:00Z`).getUTCDay() + 6) % 7;
      return {
        key: tag,
        label:
          sicht === "woche"
            ? `${t(`wochentagKurz.${wt}`)} ${Number(tag.slice(8, 10))}`
            : String(Number(tag.slice(8, 10))),
        heute: tag === heute,
        wochenende: wt >= 5,
      };
    });
  }, [sicht, von, tage, heute, locale, t]);

  /** Nur Personen mit mindestens einem sichtbaren Eintrag im Fenster — eine
   *  Zeile ohne Balken kostet Platz und sagt nichts. Sortiert nach Name. */
  const zeilen = useMemo(() => {
    const imFenster = eintraege.filter(
      (a) => SICHTBAR.has(a.status) && a.von <= bis && a.bis >= von,
    );
    const jePerson = new Map<string, AbwesenheitPlus[]>();
    for (const a of imFenster) {
      const liste = jePerson.get(a.user_id);
      if (liste) liste.push(a);
      else jePerson.set(a.user_id, [a]);
    }
    return [...jePerson.entries()]
      .map(([userId, items]) => ({
        userId,
        name: personen.find((p) => p.user_id === userId)?.full_name ?? userId,
        nummer: personalnummern[userId] ?? null,
        items: items.sort((a, b) => a.von.localeCompare(b.von)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [eintraege, von, bis, personen, personalnummern, locale]);

  const heuteAnteil = heute >= von && heute <= bis ? anteil(heute, von, tage) : null;
  const titel =
    sicht === "jahr"
      ? von.slice(0, 4)
      : sicht === "monat"
        ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${von}T12:00:00Z`),
          )
        : `${formatDate(von, locale)} – ${formatDate(bis, locale)}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("abwesenheit.kalender.zurueck")}
            className="rounded-full border p-2 hover:bg-secondary"
            onClick={() => setAnker((a) => verschieben(sicht, a, -1))}
          >
            <Icon icon="ph:caret-left" className="size-4" />
          </button>
          <span className="min-w-48 text-center font-display text-lg font-extrabold">{titel}</span>
          <button
            type="button"
            aria-label={t("abwesenheit.kalender.vor")}
            className="rounded-full border p-2 hover:bg-secondary"
            onClick={() => setAnker((a) => verschieben(sicht, a, 1))}
          >
            <Icon icon="ph:caret-right" className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-secondary"
            onClick={() => setAnker(heute)}
          >
            {t("abwesenheit.kalender.heute")}
          </button>
        </div>
        <Segmented<KalenderSicht>
          value={sicht}
          onChange={setSicht}
          options={[
            { value: "woche", label: t("abwesenheit.kalender.woche") },
            { value: "monat", label: t("abwesenheit.kalender.monat") },
            { value: "jahr", label: t("abwesenheit.kalender.jahr") },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <div className="min-w-[48rem]">
          {/* Kopfzeile: Name + Nr. links fest, Spalten rechts */}
          <div className="flex border-b bg-secondary/40 text-xs font-medium">
            <div className="flex w-56 shrink-0 gap-2 px-3 py-2">
              <span className="flex-1">{t("dienstplan.person")}</span>
              <span className="w-12 text-right text-muted-foreground">
                {t("abwesenheit.kalender.personalnummer")}
              </span>
            </div>
            <div className="flex flex-1">
              {spalten.map((s) => (
                <div
                  key={s.key}
                  className={`flex-1 border-l px-0.5 py-2 text-center tabular-nums ${
                    s.heute ? "bg-primary/10 font-bold" : s.wochenende ? "bg-secondary/60" : ""
                  }`}
                >
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          {zeilen.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("abwesenheit.kalender.keinePersonen")}
            </p>
          )}

          {zeilen.map((z) => (
            <div key={z.userId} className="flex border-b last:border-b-0">
              <div className="flex w-56 shrink-0 items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{z.name}</span>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {z.nummer ?? "—"}
                </span>
              </div>
              <div className="relative flex-1">
                {/* Rasterlinien: gleiche Spalten wie im Kopf, damit Balken und
                    Datum sichtbar zusammenpassen. */}
                <div className="absolute inset-0 flex">
                  {spalten.map((s) => (
                    <div
                      key={s.key}
                      className={`flex-1 border-l ${
                        s.heute ? "bg-primary/5" : s.wochenende ? "bg-secondary/40" : ""
                      }`}
                    />
                  ))}
                </div>
                {heuteAnteil !== null && (
                  <div
                    aria-hidden
                    className="absolute inset-y-0 z-10 w-0.5 bg-primary"
                    style={{ left: `${heuteAnteil * 100}%` }}
                  />
                )}
                <div className="relative z-20 flex flex-col gap-1 py-2">
                  {z.items.map((a) => (
                    <Balken
                      key={a.id}
                      a={a}
                      von={von}
                      bis={bis}
                      tage={tage}
                      locale={locale}
                      onOeffnen={onOeffnen}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Legende />
      <p className="text-xs text-muted-foreground">
        {t("abwesenheit.kalender.zonenHint", { zone })}
      </p>
    </section>
  );
}

function Balken({
  a,
  von,
  bis,
  tage,
  locale,
  onOeffnen,
}: {
  a: AbwesenheitPlus;
  von: string;
  bis: string;
  tage: number;
  locale: string;
  onOeffnen?: (a: AbwesenheitPlus) => void;
}) {
  const t = useTranslations("personal");
  // Auf das Fenster beschneiden: ein Urlaub, der vor dem Fenster beginnt, ragt
  // sonst mit negativem `left` heraus und die Anzeige rutscht.
  const startTag = a.von < von ? von : a.von;
  const endeTag = a.bis > bis ? bis : a.bis;
  const links = anteil(startTag, von, tage);
  const breite = (tageZwischen(startTag, endeTag) || 1) / tage;
  const titelText = t("abwesenheit.kalender.balkenTitel", {
    art: t(`abwesenheitArt.${a.art}`),
    von: formatDate(a.von, locale),
    bis: formatDate(a.bis, locale),
    status: t(`abwesenheit.status.${a.status}`),
  });

  return (
    <button
      type="button"
      title={titelText}
      aria-label={titelText}
      disabled={!onOeffnen}
      onClick={() => onOeffnen?.(a)}
      style={{ marginLeft: `${links * 100}%`, width: `${Math.max(breite, 1 / tage) * 100}%` }}
      className={`flex h-6 items-center gap-1 overflow-hidden rounded-md px-1 text-left text-xs font-medium text-white ${
        ART_FARBE[a.art]
      } ${STATUS_RAND[a.status]} ${onOeffnen ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
    >
      {a.schichten_im_zeitraum > 0 && (
        <Icon
          icon="ph:warning-fill"
          className="size-3 shrink-0 text-amber-200"
          aria-label={t("abwesenheit.kalender.konflikt")}
        />
      )}
      <span className="truncate">{t(`abwesenheitArt.${a.art}`)}</span>
    </button>
  );
}

function Legende() {
  const t = useTranslations("personal");
  // Quelle der Liste ist die Konstante des Vertrags, keine zweite Kopie hier —
  // eine neue Art erscheint damit von selbst in der Legende.
  const arten = ABWESENHEIT_ARTEN;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="font-medium">{t("abwesenheit.kalender.legende")}:</span>
      {arten.map((a) => (
        <span key={a} className="flex items-center gap-1">
          <span className={`size-3 rounded ${ART_FARBE[a]}`} />
          {t(`abwesenheitArt.${a}`)}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="size-3 rounded border-2 border-dashed border-foreground/60" />
        {t("abwesenheit.kalender.legendeBeantragt")}
      </span>
      <span className="flex items-center gap-1">
        <span className="size-3 rounded border-2 border-fuchsia-500" />
        {t("abwesenheit.kalender.legendeVorgenehmigt")}
      </span>
      <span className="flex items-center gap-1">
        <Icon icon="ph:warning-fill" className="size-3 text-amber-500" />
        {t("abwesenheit.kalender.konflikt")}
      </span>
    </div>
  );
}
