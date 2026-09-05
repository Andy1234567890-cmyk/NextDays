"use client";

// Die Bewertungsliste als TABELLE mit aufklappbarer Zeile.
//
// Warum keine Karten mehr: bei 184 Bewertungen war jede Karte so hoch wie ein
// Absatz, und die Übersicht — welcher Kanal, welches Objekt, welche Note, was
// ist offen — verlangte Scrollen statt eines Blicks. Eine Tabelle ist für
// genau diese Frage gebaut.
//
// Warum trotzdem aufklappbar und kein Dialog (so macht es Hostaway): der
// volle Text, die Kategorien, die KI-Deutung und das Antwortfeld gehören zur
// Zeile, nicht in ein Fenster darüber. Ein Dialog verdeckt die Liste, verliert
// den Zusammenhang zur Nachbarzeile und braucht einen zweiten Klick zurück.
//
// Drei Dinge, die die alte Ansicht falsch gemacht hat und die hier bewusst
// anders sind:
//   1. Eine verdeckte Bewertung zeigte „0/10" und fünf leere Sterne. Sie hat
//      keine Note — die Zelle bleibt leer und die Zeile sagt „verdeckt".
//   2. Booking-Texte standen roh da („Headline:" / „Positive:" / „Negative:"),
//      mit leerem Negativ-Teil. Sie werden zerlegt (lib/reviews-text.ts).
//   3. Kategorien standen als 0..10 ohne Bezug neben 1..5-Werten. Sie werden
//      auf dieselbe Skala gebracht wie die Sterne daneben.
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { channelLabel, channelLogo } from "@/lib/channel-logos";
import {
  EXPORT_SPALTEN,
  type ExportSpalte,
  MARKETPLACE_CHANNEL,
  STANDARD_SPALTEN,
} from "@/lib/reviews-kanal";
import { zerlegeBewertungstext } from "@/lib/reviews-text";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  type AiSentiment,
  type ReplyState,
  type ReviewSource,
  type ReviewSummary,
  type UnifiedReview,
  deleteReviewReply,
  exportReviewsCsv,
  listReviews,
  rateGuest,
  replyToReview,
  reviewSummary,
  sendOtaGuestReview,
  syncOtaReviews,
} from "@/lib/reviews";

const SEITE = 25;
const SEITENGROESSEN = [25, 50, 100] as const;

// Welche Spalten überhaupt in der TABELLE stehen können. Der Export kennt
// mehr (lib/reviews-kanal.ts) — Fließtextspalten wie „Antwort" gehören in
// eine Datei, nicht in eine Zeile, die dadurch dreimal so hoch wird.
const TABELLENSPALTEN = [
  "received_at",
  "channel",
  "origin",
  "author",
  "property",
  "text",
  "replied",
  "score_5",
] as const satisfies readonly ExportSpalte[];

const KATEGORIEN = new Set([
  "cleanliness", "communication", "location", "value", "accuracy", "checkin",
  "clean", "comfort", "facilities", "staff", "services",
]);

// Gast bewerten geht nur, wo der Kanal es zulässt: auf dem eigenen Marktplatz
// immer (sofern die Bewertung an einer Reservierung hängt), bei den Portalen
// ausschließlich bei Airbnb. Für andere wird der Knopf NICHT gezeigt, statt
// ihn in einen Fehler laufen zu lassen.
function kannGastBewerten(review: UnifiedReview): boolean {
  if (review.guest_rated) return false;
  if (review.source === "marketplace") return Boolean(review.reservation_id);
  return review.channel_code === "AirBNB";
}

/** Ist die Bewertung noch verdeckt? myBestDays wartet auf die Gegenseite,
 *  Airbnb hält zurück, bis beide abgegeben haben. */
function istVerdeckt(review: UnifiedReview): boolean {
  return (
    review.is_hidden ||
    (review.source === "marketplace" && !review.published_at)
  );
}

type Props = {
  initial: UnifiedReview[];
  initialTotal: number;
  summary: ReviewSummary | null;
  canManage: boolean;
  /** Objekte für den Filter. Ohne sie gäbe es nichts auszuwählen, und ein
   *  leeres Dropdown wäre eine Attrappe. */
  objekte: { id: string; title: string }[];
};

export function BewertungsTabelle({
  initial,
  initialTotal,
  summary,
  canManage,
  objekte,
}: Props) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);

  const [quelle, setQuelle] = useState<ReviewSource | "">("");
  const [kanal, setKanal] = useState("");
  const [objekt, setObjekt] = useState("");
  const [antwortStand, setAntwortStand] = useState<ReplyState | "">("");
  const [stimmung, setStimmung] = useState<AiSentiment | "">("");
  const [note, setNote] = useState<string>("");
  const [suchfeld, setSuchfeld] = useState("");
  const [suche, setSuche] = useState("");

  const [seite, setSeite] = useState(0);
  const [proSeite, setProSeite] = useState<number>(SEITE);
  const [spalten, setSpalten] = useState<ExportSpalte[]>([...STANDARD_SPALTEN]);
  const [spaltenOffen, setSpaltenOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Tippen soll nicht je Zeichen eine Abfrage auslösen. 400 ms sind lang
  // genug, dass ein normal getipptes Wort EINE Abfrage ergibt, und kurz
  // genug, dass sich die Liste noch wie eine Reaktion anfühlt.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSeite(0);
      setSuche(suchfeld.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [suchfeld]);

  const filter = useMemo(
    () => ({
      source: quelle || undefined,
      channelCode: kanal || undefined,
      propertyId: objekt || undefined,
      replyState: antwortStand || undefined,
      sentiment: stimmung || undefined,
      // „ab 4 Sternen" / „bis 2 Sterne" — zwei Zahlenfelder wären für die
      // häufigste Frage („zeig mir die schlechten") zu umständlich.
      ratingMin: note === "gut" ? 4 : undefined,
      ratingMax: note === "schlecht" ? 3 : undefined,
      suche: suche || undefined,
    }),
    [quelle, kanal, objekt, antwortStand, stimmung, note, suche],
  );

  // Ungefilterte Startansicht = die Server-Wahrheit. Nach einem Realtime-
  // Ereignis lädt RealtimeRefresh die Server Component neu und schickt frische
  // Props — ohne diesen Abgleich behielte `useState` den alten Stand. Nur im
  // Standardzustand übernehmen, sonst würde ein Ereignis eine gefilterte oder
  // geblätterte Ansicht zurücksetzen.
  const standardAnsicht =
    !quelle && !kanal && !objekt && !antwortStand && !stimmung && !note &&
    !suche && seite === 0 && proSeite === SEITE;
  useEffect(() => {
    if (!standardAnsicht) return;
    setItems(initial);
    setTotal(initialTotal);
  }, [initial, initialTotal, standardAnsicht]);

  const [erstLauf, setErstLauf] = useState(true);
  useEffect(() => {
    if (erstLauf) {
      setErstLauf(false);
      return;
    }
    startTransition(async () => {
      const res = await listReviews({
        ...filter,
        limit: proSeite,
        offset: seite * proSeite,
      });
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setFehler(null);
      } else {
        setFehler(res.error);
      }
    });
    // erstLauf ist bewusst nicht in den Abhängigkeiten: der Effekt soll auf
    // Filterwechsel reagieren, nicht auf das eigene Zurücksetzen des Flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, seite, proSeite]);

  // Kennzahlen als Zustand: nach Antwort, Löschen und Abgleich ändern sie
  // sich, kamen aber nur einmal als Prop — „Beantwortet 20/188" blieb bis zum
  // Reload stehen, während die Zeile schon „Beantwortet" zeigte.
  const [kennzahlen, setKennzahlen] = useState(summary);
  useEffect(() => setKennzahlen(summary), [summary]);
  function kennzahlenLaden() {
    startTransition(async () => {
      const res = await reviewSummary();
      if (res.ok) setKennzahlen(res.data);
    });
  }

  const kanaele = useMemo(
    () => (kennzahlen?.by_channel ?? []).map((c) => c.channel_code),
    [kennzahlen],
  );

  function neuLaden() {
    startTransition(async () => {
      const res = await listReviews({
        ...filter,
        limit: proSeite,
        offset: seite * proSeite,
      });
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
      }
    });
    kennzahlenLaden();
  }

  // Der Abgleich zieht alle Portal-Bewertungen bei Channex — das dauert
  // Sekunden. Ohne sichtbares Ergebnis wusste niemand, ob er lief; deshalb
  // Zeit und Anzahl anzeigen und die Liste in JEDEM Fall neu laden.
  const [abgleich, setAbgleich] = useState<{ zeit: string; anzahl: number } | null>(null);
  function abgleichen() {
    setFehler(null);
    startTransition(async () => {
      const res = await syncOtaReviews();
      if (res.ok) {
        setAbgleich({ zeit: new Date().toISOString(), anzahl: res.data.mirrored });
      } else {
        setFehler(res.error);
      }
      neuLaden();
    });
  }

  const aktiveFilter =
    (quelle ? 1 : 0) + (kanal ? 1 : 0) + (objekt ? 1 : 0) +
    (antwortStand ? 1 : 0) + (stimmung ? 1 : 0) + (note ? 1 : 0) + (suche ? 1 : 0);

  function filterLeeren() {
    setQuelle("");
    setKanal("");
    setObjekt("");
    setAntwortStand("");
    setStimmung("");
    setNote("");
    setSuchfeld("");
    setSeite(0);
  }

  const seiten = Math.max(1, Math.ceil(total / proSeite));
  const sichtbar = TABELLENSPALTEN.filter((s) => spalten.includes(s));

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportKnopf filter={filter} spalten={spalten} />
          {canManage && (
            <Button variant="outline" onClick={abgleichen} disabled={pending}>
              <Icon
                icon="ph:arrows-clockwise"
                className={`size-4 ${pending ? "animate-spin" : ""}`}
              />
              {t("sync")}
            </Button>
          )}
        </div>
      </header>
      {abgleich && (
        <p className="text-xs text-muted-foreground">
          {t("syncResult", {
            time: formatDateTime(abgleich.zeit, locale),
            count: abgleich.anzahl,
          })}
        </p>
      )}

      {kennzahlen && <Kennzahlen summary={kennzahlen} />}

      <Filterleiste
        anzahl={aktiveFilter}
        onLeeren={filterLeeren}
        suchfeld={suchfeld}
        setSuchfeld={setSuchfeld}
      >
        <FilterFeld label={t("filterSource")}>
          <NativeSelect
            value={quelle}
            onChange={(e) => {
              setSeite(0);
              setQuelle(e.target.value as ReviewSource | "");
            }}
          >
            <option value="">{t("allSources")}</option>
            <option value="marketplace">{t("sourceMarketplace")}</option>
            <option value="ota">{t("sourceOta")}</option>
          </NativeSelect>
        </FilterFeld>
        <FilterFeld label={t("filterChannel")}>
          <NativeSelect
            value={kanal}
            onChange={(e) => {
              setSeite(0);
              setKanal(e.target.value);
            }}
          >
            <option value="">{t("allChannels")}</option>
            {kanaele.map((code) => (
              <option key={code} value={code}>
                {code === MARKETPLACE_CHANNEL ? code : channelLabel(code)}
              </option>
            ))}
          </NativeSelect>
        </FilterFeld>
        <FilterFeld label={t("filterProperty")}>
          <NativeSelect
            value={objekt}
            onChange={(e) => {
              setSeite(0);
              setObjekt(e.target.value);
            }}
          >
            <option value="">{t("allProperties")}</option>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </FilterFeld>
        <FilterFeld label={t("filterRating")}>
          <NativeSelect
            value={note}
            onChange={(e) => {
              setSeite(0);
              setNote(e.target.value);
            }}
          >
            <option value="">{t("allRatings")}</option>
            <option value="gut">{t("ratingGood")}</option>
            <option value="schlecht">{t("ratingBad")}</option>
          </NativeSelect>
        </FilterFeld>
        <FilterFeld label={t("filterSentiment")}>
          <NativeSelect
            value={stimmung}
            onChange={(e) => {
              setSeite(0);
              setStimmung(e.target.value as AiSentiment | "");
            }}
          >
            <option value="">{t("allSentiments")}</option>
            <option value="positiv">{t("aiPositive")}</option>
            <option value="neutral">{t("aiNeutral")}</option>
            <option value="negativ">{t("aiNegative")}</option>
          </NativeSelect>
        </FilterFeld>
        <FilterFeld label={t("filterReplyState")}>
          <NativeSelect
            value={antwortStand}
            onChange={(e) => {
              setSeite(0);
              setAntwortStand(e.target.value as ReplyState | "");
            }}
          >
            <option value="">{t("replyStateAll")}</option>
            <option value="offen">{t("open")}</option>
            <option value="beantwortet">{t("answered")}</option>
            <option value="verdeckt">{t("replyHidden")}</option>
            <option value="frist_abgelaufen">{t("replyWindowClosed")}</option>
          </NativeSelect>
        </FilterFeld>
      </Filterleiste>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      <Card className="overflow-hidden p-0">
        {/* Die Tabelle scrollt in ihrem EIGENEN Container. Ohne das schiebt
            eine lange Objektbezeichnung die ganze Seite waagerecht. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-8" />
                {sichtbar.map((s) => (
                  <th
                    key={s}
                    className={
                      "px-3 py-2.5 text-xs font-medium text-muted-foreground " +
                      (s === "score_5" ? "text-right " : "") +
                      (s === "text" ? "w-full max-w-0" : "")
                    }
                  >
                    {t(`column.${s}`)}
                  </th>
                ))}
                <th className="w-24 px-3 py-2.5 text-right">
                  <SpaltenWahl
                    offen={spaltenOffen}
                    setOffen={setSpaltenOffen}
                    spalten={spalten}
                    setSpalten={setSpalten}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={sichtbar.length + 2}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    {aktiveFilter > 0 ? t("emptyFiltered") : t("empty")}
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <Zeile
                    key={`${r.source}-${r.id}`}
                    review={r}
                    spalten={sichtbar}
                    canManage={canManage}
                    onChanged={(neu) => {
                      setItems((alt) =>
                        alt.map((x) =>
                          x.source === neu.source && x.id === neu.id ? neu : x,
                        ),
                      );
                      // Antwort gesetzt/entfernt → „Beantwortet x/y" muss mit.
                      kennzahlenLaden();
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("perPage")}
          <NativeSelect
            value={String(proSeite)}
            onChange={(e) => {
              setSeite(0);
              setProSeite(Number(e.target.value));
            }}
            className="w-20"
          >
            {SEITENGROESSEN.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        {seiten > 1 && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={seite === 0 || pending}
              onClick={() => setSeite((s) => Math.max(0, s - 1))}
            >
              {t("prev")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("page", { current: seite + 1, total: seiten })}
            </span>
            <Button
              variant="outline"
              disabled={seite + 1 >= seiten || pending}
              onClick={() => setSeite((s) => s + 1)}
            >
              {t("next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Filterleiste, die zugeklappt bleibt und ihre Anzahl zeigt.
 *
 *  Hostaways Lösung, und sie ist richtig: der Nutzer sieht, DASS gefiltert
 *  wird, ohne dass sieben Felder dauerhaft eine Bildschirmhöhe kosten. Das
 *  Suchfeld bleibt außerhalb — danach greift man am häufigsten. */
function Filterleiste({
  anzahl,
  onLeeren,
  suchfeld,
  setSuchfeld,
  children,
}: {
  anzahl: number;
  onLeeren: () => void;
  suchfeld: string;
  setSuchfeld: (v: string) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("reviews");
  const [offen, setOffen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={suchfeld}
            onChange={(e) => setSuchfeld(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full rounded-full border border-border bg-card py-2 pr-4 pl-9 text-sm outline-none focus:border-foreground/30"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setOffen((o) => !o)}
          aria-expanded={offen}
        >
          <Icon icon="ph:funnel" className="size-4" />
          {t("filters")}
          {anzahl > 0 && (
            <span className="ml-1 grid size-5 place-items-center rounded-full bg-amber-500 text-xs font-medium text-white">
              {anzahl}
            </span>
          )}
        </Button>
        {anzahl > 0 && (
          <button
            type="button"
            onClick={onLeeren}
            className="text-sm text-destructive hover:underline"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>
      {offen && (
        <div className="flex flex-wrap items-end gap-3 rounded-(--radius) border border-border bg-card p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function FilterFeld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Spaltenwahl hinter dem Zahnrad. Dieselbe Auswahl steuert den Export —
 *  ein Mechanismus, zwei Nutzen (von Hostaway übernommen). */
function SpaltenWahl({
  offen,
  setOffen,
  spalten,
  setSpalten,
}: {
  offen: boolean;
  setOffen: (v: boolean) => void;
  spalten: ExportSpalte[];
  setSpalten: (v: ExportSpalte[]) => void;
}) {
  const t = useTranslations("reviews");
  const box = useRef<HTMLDivElement>(null);

  // Klick daneben schließt. Kein Escape-Handler nötig — das Popover hängt an
  // keinem Formular, das dabei verloren ginge.
  useEffect(() => {
    if (!offen) return;
    function zu(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen, setOffen]);

  return (
    <div ref={box} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-label={t("columns")}
        aria-expanded={offen}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:gear" className="size-4" />
      </button>
      {offen && (
        <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col gap-1 rounded-(--radius) border border-border bg-card p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {t("columnsHint")}
          </p>
          {EXPORT_SPALTEN.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <input
                type="checkbox"
                checked={spalten.includes(s)}
                onChange={(e) =>
                  setSpalten(
                    e.target.checked
                      ? [...spalten, s]
                      : spalten.filter((x) => x !== s),
                  )
                }
              />
              {t(`column.${s}`)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** CSV herunterladen. Der Browser darf die Datei nicht selbst holen (er
 *  hätte den Token nicht) — deshalb über die Server-Action und dann als
 *  Blob anbieten. */
function ExportKnopf({
  filter,
  spalten,
}: {
  filter: Record<string, unknown>;
  spalten: ExportSpalte[];
}) {
  const t = useTranslations("reviews");
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  return (
    <>
      <Button
        variant="outline"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const res = await exportReviewsCsv(filter, spalten);
            if (!res.ok) {
              setFehler(res.error);
              return;
            }
            setFehler(null);
            const url = URL.createObjectURL(
              new Blob([res.data], { type: "text/csv;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `bewertungen-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          })
        }
      >
        <Icon icon="ph:download-simple" className="size-4" />
        {laeuft ? t("exporting") : t("export")}
      </Button>
      {fehler && <span className="self-center text-sm text-destructive">{fehler}</span>}
    </>
  );
}

function Kennzahlen({ summary }: { summary: ReviewSummary }) {
  const t = useTranslations("reviews");
  const beantwortet = summary.count - summary.unanswered;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Kachel
        label={t("kpiAverage")}
        wert={summary.average_5 == null ? "–" : summary.average_5.toFixed(2)}
      />
      <Kachel label={t("kpiCount")} wert={String(summary.count)} />
      {/* Als ANTEIL statt als nackte Zahl (Hostaway): „164 unbeantwortet"
          heißt bei 184 Bewertungen etwas völlig anderes als bei 4000. */}
      <Kachel
        label={t("qualityAnswered")}
        wert={String(beantwortet)}
        von={summary.count}
        hinweis={t("kpiOpenHint", {
          offen:
            summary.unanswered - summary.expired_unanswered - summary.hidden_unanswered,
          verdeckt: summary.hidden_unanswered,
          abgelaufen: summary.expired_unanswered,
        })}
        ton={
          summary.unanswered === 0
            ? "gut"
            : summary.unanswered > summary.count / 4
              ? "warnung"
              : undefined
        }
      />
    </div>
  );
}

function Kachel({
  label,
  wert,
  von,
  hinweis,
  ton,
}: {
  label: string;
  wert: string;
  von?: number;
  hinweis?: string;
  ton?: "gut" | "warnung";
}) {
  const farbe =
    ton === "gut" ? "text-emerald-600" : ton === "warnung" ? "text-amber-600" : "";
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${farbe}`}>{wert}</span>
        {von != null && <span className="text-sm text-muted-foreground">/ {von}</span>}
      </span>
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </Card>
  );
}

/** Sterne. Ohne Note KEINE Sterne — eine leere Sternreihe liest sich als
 *  Null-Bewertung, und genau das stand vorher bei jeder verdeckten Airbnb-
 *  Bewertung (Wurzel 4). */
function Sterne({ score }: { score: number | null }) {
  if (score == null) return null;
  const voll = Math.round(score);
  return (
    <span className="flex items-center gap-0.5" aria-label={String(score)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          icon={i <= voll ? "ph:star-fill" : "ph:star"}
          className="size-3.5 text-amber-500"
        />
      ))}
    </span>
  );
}

const STIMMUNGS_TON: Record<AiSentiment, string> = {
  positiv: "bg-emerald-500",
  neutral: "bg-muted-foreground/40",
  negativ: "bg-destructive",
};

function Zeile({
  review,
  spalten,
  canManage,
  onChanged,
}: {
  review: UnifiedReview;
  spalten: readonly ExportSpalte[];
  canManage: boolean;
  onChanged: (neu: UnifiedReview) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [auf, setAuf] = useState(false);
  const logo = channelLogo(review.channel_code);
  const zerlegt = zerlegeBewertungstext(review.text);
  const verdeckt = istVerdeckt(review);

  const vorschau = zerlegt
    ? (zerlegt.titel || zerlegt.positiv || zerlegt.negativ || "").replace(/\s+/g, " ")
    : "";

  function zelle(s: ExportSpalte) {
    switch (s) {
      case "received_at":
        return review.received_at ? formatDate(review.received_at, locale) : "";
      case "channel":
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {logo && (
              <Image
                src={logo}
                alt=""
                width={16}
                height={16}
                className="size-4 shrink-0 object-contain"
              />
            )}
            {review.channel_code === MARKETPLACE_CHANNEL
              ? review.channel_code
              : channelLabel(review.channel_code)}
          </span>
        );
      case "origin":
        // Eigene Spalte statt nur Zeilenfarbe (Hostaway): nach einer Farbe
        // lässt sich nicht filtern, und für farbschwache Nutzer ist sie nichts.
        return <span className="text-muted-foreground">{t("originGuest")}</span>;
      case "author":
        return <span className="whitespace-nowrap">{review.author}</span>;
      case "property":
        return (
          <span className="block max-w-40 truncate" title={review.property_title ?? ""}>
            {review.property_title ?? "–"}
          </span>
        );
      case "text":
        return verdeckt && !vorschau ? (
          <span className="text-muted-foreground italic">{t("hidden")}</span>
        ) : (
          <span className="flex items-center gap-2">
            {review.ai && (
              <span
                className={`size-2 shrink-0 rounded-full ${STIMMUNGS_TON[review.ai.stimmung]}`}
                title={t(`ai${review.ai.stimmung === "positiv" ? "Positive" : review.ai.stimmung === "neutral" ? "Neutral" : "Negative"}`)}
              />
            )}
            <span className="block min-w-0 truncate">{vorschau || "–"}</span>
          </span>
        );
      case "replied":
        return review.is_replied ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
            <Icon icon="ph:check-circle" className="size-4" />
            {t("answered")}
            {review.reply_ki && (
              <span
                className="ml-1 flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-xs"
                title={t("kiReplyBadge")}
              >
                <Icon icon="ph:sparkle" className="size-3" />
                KI
              </span>
            )}
          </span>
        ) : review.can_reply ? (
          <span className="flex flex-col whitespace-nowrap text-amber-600">
            <span className="flex items-center gap-1">
              <Icon icon="ph:clock" className="size-4" />
              {t("open")}
            </span>
            {/* Die Frist des Portals, wenn es sie meldet — kein geratenes Datum. */}
            {review.reply_expires_at && (
              <span className="text-xs text-muted-foreground">
                {t("replyDeadline", { date: formatDate(review.reply_expires_at, locale) })}
              </span>
            )}
          </span>
        ) : review.is_hidden ? (
          // Airbnb hält die Bewertung verdeckt, bis beide Seiten abgegeben
          // haben — noch nichts zu beantworten, also kein „Offen".
          <span className="flex flex-col whitespace-nowrap text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon icon="ph:eye-slash" className="size-4" />
              {t("replyHidden")}
            </span>
            {review.reply_expires_at && (
              <span className="text-xs">
                {t("replyDeadline", { date: formatDate(review.reply_expires_at, locale) })}
              </span>
            )}
          </span>
        ) : (
          // Unbeantwortet, aber das Portal nimmt keine Antwort mehr an: kein
          // „Offen" — das wäre eine Aufforderung zu etwas, das nicht mehr geht.
          <span className="flex flex-col whitespace-nowrap text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon icon="ph:clock-countdown" className="size-4" />
              {t("replyWindowClosed")}
            </span>
            {review.reply_expires_at && (
              <span className="text-xs">
                {formatDate(review.reply_expires_at, locale)}
              </span>
            )}
          </span>
        );
      case "score_5":
        // Keine Note = leer. Eine 0 wäre eine Bewertung mit null Sternen.
        return review.score_5 == null ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <span className="flex items-center justify-end gap-2">
            <Sterne score={review.score_5} />
            <span className="tabular-nums">{review.score_5.toFixed(1)}</span>
          </span>
        );
      default:
        return "";
    }
  }

  return (
    <>
      <tr
        onClick={() => setAuf((o) => !o)}
        className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40"
      >
        <td className="pl-3">
          <Icon
            icon={auf ? "ph:caret-down" : "ph:caret-right"}
            className="size-4 text-muted-foreground"
          />
        </td>
        {spalten.map((s) => (
          <td
            key={s}
            className={
              "px-3 py-2.5 align-middle " +
              (s === "score_5" ? "text-right " : "") +
              // Die Textspalte nimmt den Rest und kürzt — ohne max-w-0 zählt
              // ihre Vorschau als Mindestbreite, und die Tabelle wächst über
              // die Karte hinaus (Sterne und letzte Spalte abgeschnitten).
              (s === "text" ? "w-full max-w-0" : "")
            }
          >
            {zelle(s)}
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs text-muted-foreground">
            {auf ? t("collapse") : t("expand")}
          </span>
        </td>
      </tr>
      {auf && (
        <tr className="border-b border-border bg-secondary/20 last:border-0">
          <td colSpan={spalten.length + 2} className="px-3 py-4">
            <Detail review={review} canManage={canManage} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Der aufgeklappte Inhalt: voller Text, Kategorien, KI-Deutung, Antwort. */
function Detail({
  review,
  canManage,
  onChanged,
}: {
  review: UnifiedReview;
  canManage: boolean;
  onChanged: (neu: UnifiedReview) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [gastOffen, setGastOffen] = useState(false);
  const [gastNote, setGastNote] = useState(5);
  const [gastText, setGastText] = useState("");
  const [text, setText] = useState(review.reply ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const zerlegt = zerlegeBewertungstext(review.text);

  function gastBewerten() {
    setFehler(null);
    startTransition(async () => {
      const res =
        review.source === "marketplace"
          ? await rateGuest({
              reservation_id: review.reservation_id ?? "",
              rating: gastNote,
              text: gastText.trim() || null,
            })
          : await sendOtaGuestReview(review.id, {
              rating: gastNote,
              public_review: gastText.trim() || null,
              recommended: gastNote >= 4,
            });
      if (res.ok) {
        onChanged({ ...review, guest_rated: true });
        setGastOffen(false);
      } else {
        setFehler(res.error);
      }
    });
  }

  function senden() {
    if (!text.trim()) return;
    setFehler(null);
    startTransition(async () => {
      const res = await replyToReview(review.source, review.id, text.trim());
      if (res.ok) {
        onChanged(res.data);
        setOffen(false);
      } else {
        setFehler(res.error);
      }
    });
  }

  function entfernen() {
    setFehler(null);
    startTransition(async () => {
      const res = await deleteReviewReply(review.id);
      if (res.ok) {
        onChanged({ ...review, reply: null, reply_at: null, is_replied: false });
        setText("");
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {istVerdeckt(review) && (
        <p className="text-sm text-muted-foreground italic">{t("hiddenHint")}</p>
      )}

      {/* Der Text zerlegt statt roh: Booking liefert drei benannte Teile in
          EINEM Feld, und ein leerer Negativ-Teil ist keine Information. */}
      {zerlegt && (
        <div className="flex flex-col gap-2">
          {zerlegt.titel && <p className="font-medium">{zerlegt.titel}</p>}
          {zerlegt.aufgeteilt ? (
            <>
              {zerlegt.positiv && (
                <Textteil
                  icon="ph:plus-circle"
                  farbe="text-emerald-600"
                  label={t("textPositive")}
                  text={zerlegt.positiv}
                />
              )}
              {zerlegt.negativ && (
                <Textteil
                  icon="ph:minus-circle"
                  farbe="text-destructive"
                  label={t("textNegative")}
                  text={zerlegt.negativ}
                />
              )}
            </>
          ) : (
            zerlegt.positiv && (
              <p className="text-sm whitespace-pre-line">{zerlegt.positiv}</p>
            )
          )}
        </div>
      )}

      {review.ai && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-card px-2 py-1 ring-1 ring-border">
            <Icon icon="ph:sparkle" className="size-3.5" />
            {t(
              `ai${review.ai.stimmung === "positiv" ? "Positive" : review.ai.stimmung === "neutral" ? "Neutral" : "Negative"}`,
            )}
          </span>
          {review.ai.themen.map((th) => (
            <span
              key={th.thema}
              className="flex items-center gap-1 rounded-full bg-card px-2 py-1 ring-1 ring-border"
            >
              <span
                className={`size-1.5 rounded-full ${STIMMUNGS_TON[th.richtung]}`}
              />
              {t(`aiTheme.${th.thema}`)}
            </span>
          ))}
          {review.ai.kernaussage && (
            <span className="w-full text-muted-foreground">
              {review.ai.kernaussage}
            </span>
          )}
        </div>
      )}

      {review.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.categories.map((c) => {
            // Auf die Skala bringen, die daneben als Sterne steht. Vorher
            // stand „Sauberkeit: 7.5" neben vier Sternen — zwei Skalen ohne
            // Kennzeichnung nebeneinander (Wurzel 4).
            const auf5 = c.scale === "0-10" ? c.score / 2 : c.score;
            return (
              <span
                key={c.key}
                className="rounded-full bg-card px-2 py-0.5 text-xs ring-1 ring-border"
              >
                {KATEGORIEN.has(c.key) ? t(`category.${c.key}`) : c.key}{" "}
                <span className="font-medium tabular-nums">{auf5.toFixed(1)}</span>
              </span>
            );
          })}
        </div>
      )}

      {review.reply && !offen && (
        <div className="rounded-(--radius) border border-border bg-card p-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            {t("yourReply")}
            {review.reply_ki && (
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                <Icon icon="ph:sparkle" className="size-3" />
                {t("kiReplyBadge")}
              </span>
            )}
            {review.reply_at && (
              <span>· {formatDateTime(review.reply_at, locale)}</span>
            )}
          </p>
          <p className="text-sm whitespace-pre-line">{review.reply}</p>
        </div>
      )}

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      {canManage && gastOffen && (
        <div className="flex flex-col gap-2 rounded-(--radius) border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("rateGuestHint")}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{t("autoRating")}</span>
            <NativeSelect
              value={String(gastNote)}
              onChange={(e) => setGastNote(Number(e.target.value))}
              className="w-20"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Textarea
            rows={2}
            value={gastText}
            onChange={(e) => setGastText(e.target.value)}
            placeholder={t("rateGuestPlaceholder")}
          />
          <div className="flex gap-2">
            <Button onClick={gastBewerten} disabled={pending}>
              {t("send")}
            </Button>
            <Button variant="outline" onClick={() => setGastOffen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {canManage && review.can_reply && (
        <div className="flex flex-col gap-2">
          {offen ? (
            <>
              {/* Die Warnung steht AN der Handlung, nicht in einer Hilfe:
                  Portale kennen kein Zurücknehmen einer Antwort. Hostaway
                  sagt es im Antwortdialog, und das ist der richtige Ort. */}
              {review.source === "ota" && (
                <p className="flex items-start gap-1.5 text-xs text-amber-600">
                  <Icon icon="ph:warning" className="mt-0.5 size-3.5 shrink-0" />
                  {t("replyIrreversible")}
                </p>
              )}
              <Textarea
                autoFocus
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("replyPlaceholder")}
              />
              <div className="flex gap-2">
                <Button onClick={senden} disabled={pending || !text.trim()}>
                  {t("send")}
                </Button>
                <Button variant="outline" onClick={() => setOffen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Beim Portal gibt es kein „Antwort ändern" — der Hinweis
                  darüber sagt es, der Knopf widersprach ihm; das Backend
                  weist die zweite Antwort inzwischen mit 409 ab. */}
              {!(review.source === "ota" && review.is_replied) && (
                <Button variant="outline" onClick={() => setOffen(true)}>
                  <Icon icon="ph:chat-circle-text" className="size-4" />
                  {review.reply ? t("editReply") : t("reply")}
                </Button>
              )}
              {review.reply && review.source === "marketplace" && (
                <Button variant="outline" onClick={entfernen} disabled={pending}>
                  {t("deleteReply")}
                </Button>
              )}
              {kannGastBewerten(review) && (
                <Button variant="outline" onClick={() => setGastOffen(true)}>
                  <Icon icon="ph:user-check" className="size-4" />
                  {t("rateGuest")}
                </Button>
              )}
              {review.guest_rated && (
                <span className="self-center text-xs text-muted-foreground">
                  {t("guestRated")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!review.can_reply && (
        <p className="text-xs text-muted-foreground">
          {review.reply_expires_at
            ? t("replyExpiredOn", { date: formatDate(review.reply_expires_at, locale) })
            : t("expired")}
        </p>
      )}
    </div>
  );
}

function Textteil({
  icon,
  farbe,
  label,
  text,
}: {
  icon: string;
  farbe: string;
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-2">
      <Icon icon={icon} className={`mt-0.5 size-4 shrink-0 ${farbe}`} />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <p className="text-sm whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}
