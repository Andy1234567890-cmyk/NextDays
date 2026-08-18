// Such-Leiste in zwei Erscheinungsformen:
//   ab md  — die breite Drei-Feld-Leiste (Wohin / Wann / Wer) mit Dropdowns.
//   unter md — EINE Pille, die ein Vollbild-Blatt mit denselben drei Schritten
//              öffnet. Der „Suchen"-Knopf sitzt dort in der Blatt-Fußzeile.
//
// Warum nicht einfach die Desktop-Leiste umbrechen: sie ist 502 px breit, wenn
// der Viewport 500 px hat — der rote Suchen-Knopf war live angeschnitten. Ein
// umgebrochener Fünf-Element-Balken hätte daraus vier gequetschte Zeilen
// gemacht; die Pille ist die Form, die auf 360 px noch eine Aussage trägt.
//
// „Wohin" ist ein echtes Textfeld (Freitext → ?q), seine Vorschläge kommen aus
// dem Bestand (lib/reiseziele.ts), nicht aus einer Liste im Code.
"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BlattModal } from "@/components/mobil/blatt-modal";
import { bcp47 } from "@/i18n/locales";
import { type Reiseziel, ladeReiseziele } from "@/lib/reiseziele";

// „In der Nähe" ist der einzige feste Eintrag (Geräte-Standort, kein Ort aus dem
// Bestand). Alle übrigen Vorschläge kommen aus /booking-engine/destinations —
// echte Städte/Länder mit buchbaren Objekten. Eine hartkodierte Städteliste war
// der Bug: sie zeigte Paris/Bangkok/Tokio, wo es kein Objekt gibt, und
// verschwieg jedes real vorhandene Ziel.
const NAHBEI = {
  icon: "ph:navigation-arrow",
  ort: "In der Nähe",
  text: "Finde heraus, was es in deiner Nähe gibt.",
};

// Gäste-Kategorien wie beim Vorbild.
type GaesteKey = "erwachsene" | "kinder" | "kleinkinder" | "haustiere";
const GAESTE_FELDER: { key: GaesteKey; label: string; sub: string }[] = [
  { key: "erwachsene", label: "Erwachsene", sub: "Ab 13 Jahren" },
  { key: "kinder", label: "Kinder", sub: "2–12 Jahre" },
  { key: "kleinkinder", label: "Kleinkinder", sub: "Unter 2" },
  { key: "haustiere", label: "Haustiere", sub: "Bringst du ein Tier mit?" },
];

type Feld = "wohin" | "wann" | "wer" | null;
type Gaeste = Record<GaesteKey, number>;
type KalMonat = { jahr: number; monat: number };

// Datum ohne Zeitzonen-Verschiebung als ISO (YYYY-MM-DD).
function isoDatum(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/** Monats- und Wochentagsnamen aus der Gast-Sprache. Vorher standen hier zwölf
 *  deutsche Monatsnamen im Code — ein griechischer Gast sah „August" im
 *  Kalender, obwohl die restliche Seite übersetzt war. */
function useKalenderNamen(): {
  monat: (index: number) => string;
  monatKurz: (index: number) => string;
  wochentage: string[];
} {
  const locale = useLocale();
  return useMemo(() => {
    const tag = bcp47(locale);
    const lang = new Intl.DateTimeFormat(tag, { month: "long" });
    const kurz = new Intl.DateTimeFormat(tag, { month: "short" });
    const wt = new Intl.DateTimeFormat(tag, { weekday: "narrow" });
    return {
      monat: (i: number) => lang.format(new Date(2000, i, 1)),
      monatKurz: (i: number) => kurz.format(new Date(2000, i, 1)),
      // Index 0 = Sonntag, weil der Kalender unten mit `getDay()` rechnet.
      wochentage: Array.from({ length: 7 }, (_, i) =>
        wt.format(new Date(2000, 0, 2 + i)),
      ),
    };
  }, [locale]);
}

export function SuchLeiste() {
  const router = useRouter();
  const t = useTranslations("mobil");
  const namen = useKalenderNamen();
  const [aktiv, setAktiv] = useState<Feld>(null);
  // Mobil: das Blatt ist offen, und `aktiv` sagt, welcher Abschnitt aufgeklappt ist.
  const [blattOffen, setBlattOffen] = useState(false);
  const [ziel, setZiel] = useState<string | null>(null);
  const [datum, setDatum] = useState<string | null>(null);
  const [gaeste, setGaeste] = useState<Gaeste>({
    erwachsene: 0,
    kinder: 0,
    kleinkinder: 0,
    haustiere: 0,
  });
  // Angezeigter Kalendermonat (Start = heutiger Monat). Als {jahr, monat}.
  const heute = new Date();
  const [kalMonat, setKalMonat] = useState<KalMonat>({
    jahr: heute.getFullYear(),
    monat: heute.getMonth(),
  });
  const ref = useRef<HTMLDivElement>(null);
  const zielInput = useRef<HTMLInputElement>(null);
  const zielInputMobil = useRef<HTMLInputElement>(null);
  const [ziele, setZiele] = useState<Reiseziel[]>([]);
  const [zieleLaden, setZieleLaden] = useState(false);

  const gaesteGesamt = gaeste.erwachsene + gaeste.kinder + gaeste.kleinkinder;
  const heuteIso = isoDatum(heute);

  function formatKurz(iso: string): string {
    const [, m, tag] = iso.split("-").map(Number);
    return `${tag}. ${namen.monatKurz(m - 1)}`;
  }

  function suchen() {
    const params = new URLSearchParams();
    const q = (ziel ?? "").trim();
    if (q) params.set("q", q);
    if (datum) params.set("start", datum);
    if (gaesteGesamt > 0) params.set("guests", String(gaesteGesamt));
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
    setAktiv(null);
    setBlattOffen(false);
  }

  function alleLoeschen() {
    setZiel(null);
    setDatum(null);
    setGaeste({ erwachsene: 0, kinder: 0, kleinkinder: 0, haustiere: 0 });
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAktiv(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Vorschläge serverseitig zur Eingabe holen (entprellt), solange „Wohin"
  // offen ist. Der Server filtert Stadt UND Landesname — die Liste im Client zu
  // filtern war der zweite Teil des Bugs, weil dort nur Fantasie-Orte lagen.
  useEffect(() => {
    if (aktiv !== "wohin") return;
    const begriff = ziel ?? "";
    const abbruch = new AbortController();
    setZieleLaden(true);
    const timer = setTimeout(() => {
      ladeReiseziele(begriff, 8, abbruch.signal)
        .then(setZiele)
        .finally(() => setZieleLaden(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      abbruch.abort();
      setZieleLaden(false);
    };
  }, [aktiv, ziel]);

  function waehleNahbei() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setZiel("In deiner Nähe"),
        () => setZiel("In der Nähe"),
      );
    } else {
      setZiel("In der Nähe");
    }
    setAktiv("wann");
  }

  function waehleZiel(vorschlag: Reiseziel) {
    setZiel(vorschlag.query);
    setAktiv("wann");
  }

  function setGast(key: GaesteKey, delta: number) {
    setGaeste((g) => ({ ...g, [key]: Math.max(0, g[key] + delta) }));
  }

  const zielSuche = (ziel ?? "").trim().length > 0;

  const gaesteLabel =
    gaesteGesamt > 0
      ? `${gaesteGesamt} Gäste${gaeste.haustiere > 0 ? ", Haustier" : ""}`
      : "Gäste hinzufügen";

  // Zusammenfassung für die Mobil-Pille: nur gesetzte Werte, sonst der Aufruf.
  const pilleZeile2 = [
    datum ? formatKurz(datum) : t("sucheDatum"),
    gaesteGesamt > 0 ? `${gaesteGesamt} ${t("sucheGaeste")}` : t("sucheGaeste"),
  ].join(" · ");

  const zielListe = (
    <ZielListe
      ziele={ziele}
      zieleLaden={zieleLaden}
      zielSuche={zielSuche}
      onNahbei={waehleNahbei}
      onZiel={waehleZiel}
    />
  );

  const kalender = (kompakt: boolean) => (
    <Kalender
      kompakt={kompakt}
      namen={namen}
      kalMonat={kalMonat}
      setKalMonat={setKalMonat}
      datum={datum}
      setDatum={setDatum}
      heute={heute}
      heuteIso={heuteIso}
      formatKurz={formatKurz}
    />
  );

  const gaesteListe = <GaesteListe gaeste={gaeste} setGast={setGast} />;

  return (
    <>
      {/* ─────────── ab md: die breite Drei-Feld-Leiste ─────────── */}
      <div ref={ref} className="relative mx-auto hidden w-full max-w-4xl md:block">
        <div
          className={
            "flex items-center rounded-full border bg-card p-2 shadow-md transition-shadow " +
            (aktiv ? "border-accent/40 shadow-lg" : "border-border")
          }
        >
          {/* Wohin — echtes Textfeld: Freitext geht als ?q an die Suche */}
          <div
            role="presentation"
            onClick={() => {
              setAktiv("wohin");
              zielInput.current?.focus();
            }}
            className={
              "min-w-0 flex-1 cursor-text rounded-full px-8 py-[0.9375rem] text-left transition-colors hover:bg-secondary " +
              (aktiv === "wohin" ? "bg-secondary" : "")
            }
          >
            <label
              htmlFor="such-ziel"
              className="block cursor-text pb-0.5 text-xs font-semibold leading-4"
            >
              Wohin
            </label>
            <input
              id="such-ziel"
              ref={zielInput}
              type="text"
              autoComplete="off"
              value={ziel ?? ""}
              onChange={(e) => setZiel(e.target.value)}
              onFocus={() => setAktiv("wohin")}
              onKeyDown={(e) => {
                if (e.key === "Enter") suchen();
                if (e.key === "Escape") setAktiv(null);
              }}
              placeholder="Reiseziele suchen"
              className="block w-full truncate border-0 bg-transparent p-0 text-sm font-medium leading-[1.125rem] text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>
          <span className="h-8 w-px shrink-0 bg-border" />

          {/* Wann */}
          <button
            type="button"
            onClick={() => setAktiv(aktiv === "wann" ? null : "wann")}
            className={
              "flex-1 rounded-full px-6 py-[0.9375rem] text-left transition-colors hover:bg-secondary " +
              (aktiv === "wann" ? "bg-secondary" : "")
            }
          >
            <span className="block pb-0.5 text-xs font-semibold leading-4">Wann</span>
            <span
              className={
                "block text-sm leading-[1.125rem] " +
                (datum ? "font-medium text-foreground" : "text-muted-foreground")
              }
            >
              {datum ? formatKurz(datum) : "Datum hinzufügen"}
            </span>
          </button>
          <span className="h-8 w-px shrink-0 bg-border" />

          {/* Wer */}
          <button
            type="button"
            onClick={() => setAktiv(aktiv === "wer" ? null : "wer")}
            className={
              "flex-1 rounded-full px-6 py-[0.9375rem] text-left transition-colors hover:bg-secondary " +
              (aktiv === "wer" ? "bg-secondary" : "")
            }
          >
            <span className="block pb-0.5 text-xs font-semibold leading-4">Wer</span>
            <span
              className={
                "block truncate text-sm leading-[1.125rem] " +
                (gaesteGesamt > 0
                  ? "font-medium text-foreground"
                  : "text-muted-foreground")
              }
            >
              {gaesteLabel}
            </span>
          </button>

          {/* Such-Button (breit mit Text wie beim Vorbild) */}
          <button
            type="button"
            onClick={suchen}
            className="ml-1 flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Icon icon="ph:magnifying-glass" className="size-5" />
            <span className="text-sm">{t("suchen")}</span>
          </button>
        </div>

        {/* Dropdown: Reiseziele (echte Ziele aus dem Bestand) */}
        {aktiv === "wohin" && (
          <div className="absolute left-0 top-full z-50 mt-3 max-h-[26rem] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card shadow-xl">
            <div className="p-6">{zielListe}</div>
          </div>
        )}

        {/* Dropdown: Kalender (Wann) */}
        {aktiv === "wann" && (
          <div className="absolute left-1/2 top-full z-50 mt-3 flex w-[42rem] max-w-[calc(100vw-3rem)] -translate-x-1/2 gap-6 rounded-3xl border border-border bg-card p-6 shadow-xl">
            {kalender(false)}
          </div>
        )}

        {/* Dropdown: Gäste (Wer) */}
        {aktiv === "wer" && (
          <div className="absolute right-0 top-full z-50 mt-3 w-96 max-w-[calc(100vw-3rem)] rounded-3xl border border-border bg-card p-6 shadow-xl">
            {gaesteListe}
          </div>
        )}
      </div>

      {/* ─────────── unter md: eine Pille + Vollbild-Blatt ─────────── */}
      <button
        type="button"
        onClick={() => {
          setBlattOffen(true);
          setAktiv("wohin");
        }}
        className="flex w-full items-center gap-3 rounded-full border border-border bg-card px-4 py-3 text-left shadow-md md:hidden"
      >
        <Icon icon="ph:magnifying-glass" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {ziel?.trim() ? ziel : t("sucheOeffnen")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {pilleZeile2}
          </span>
        </span>
      </button>

      <BlattModal
        offen={blattOffen}
        onSchliessen={() => setBlattOffen(false)}
        variante="vollbild"
        titel={t("suchen")}
        fussleiste={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={alleLoeschen}
              className="rounded-full px-4 py-3 text-sm font-medium underline"
            >
              {t("loeschen")}
            </button>
            <button
              type="button"
              onClick={suchen}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-accent-foreground"
            >
              <Icon icon="ph:magnifying-glass" className="size-5" />
              <span className="text-sm">{t("suchen")}</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Schritt 1: Wohin */}
          <BlattAbschnitt
            offen={aktiv === "wohin"}
            titel={t("sucheZiel")}
            wert={ziel?.trim() || null}
            onOeffnen={() => {
              setAktiv("wohin");
              // Fokus erst nach dem Aufklappen, sonst gibt es das Feld noch nicht.
              setTimeout(() => zielInputMobil.current?.focus(), 60);
            }}
          >
            <input
              ref={zielInputMobil}
              type="text"
              autoComplete="off"
              value={ziel ?? ""}
              onChange={(e) => setZiel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") suchen();
              }}
              placeholder="Reiseziele suchen"
              // text-base ist Pflicht: unter 16 px zoomt iOS Safari beim Fokus
              // in das Feld hinein und das Blatt sitzt danach schief.
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:border-foreground"
            />
            <div className="mt-3">{zielListe}</div>
          </BlattAbschnitt>

          {/* Schritt 2: Wann */}
          <BlattAbschnitt
            offen={aktiv === "wann"}
            titel={t("sucheDatum")}
            wert={datum ? formatKurz(datum) : null}
            onOeffnen={() => setAktiv("wann")}
          >
            {kalender(true)}
          </BlattAbschnitt>

          {/* Schritt 3: Wer */}
          <BlattAbschnitt
            offen={aktiv === "wer"}
            titel={t("sucheGaeste")}
            wert={gaesteGesamt > 0 ? gaesteLabel : null}
            onOeffnen={() => setAktiv("wer")}
          >
            {gaesteListe}
          </BlattAbschnitt>
        </div>
      </BlattModal>
    </>
  );
}

/** Ein aufklappbarer Abschnitt im Such-Blatt. Zugeklappt zeigt er Titel und
 *  gewählten Wert in einer Zeile — so sieht man auf 360 px alle drei Schritte
 *  gleichzeitig und weiß, was noch fehlt. */
function BlattAbschnitt({
  offen,
  titel,
  wert,
  onOeffnen,
  children,
}: {
  offen: boolean;
  titel: string;
  wert: string | null;
  onOeffnen: () => void;
  children: React.ReactNode;
}) {
  if (!offen) {
    return (
      <button
        type="button"
        onClick={onOeffnen}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm"
      >
        <span className="text-sm font-medium text-muted-foreground">{titel}</span>
        <span className="min-w-0 truncate text-sm font-semibold">
          {wert ?? "—"}
        </span>
      </button>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 font-display text-lg font-semibold">{titel}</p>
      {children}
    </section>
  );
}

/** Reiseziel-Vorschläge (identisch in Dropdown und Blatt). */
function ZielListe({
  ziele,
  zieleLaden,
  zielSuche,
  onNahbei,
  onZiel,
}: {
  ziele: Reiseziel[];
  zieleLaden: boolean;
  zielSuche: boolean;
  onNahbei: () => void;
  onZiel: (z: Reiseziel) => void;
}) {
  return (
    <>
      <p className="mb-4 text-sm font-semibold text-muted-foreground">
        {zielSuche ? "Passende Reiseziele" : "Vorgeschlagene Reiseziele"}
      </p>
      <ul className="flex flex-col">
        {!zielSuche && (
          <li>
            <button
              type="button"
              onClick={onNahbei}
              className="flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-secondary"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent">
                <Icon icon={NAHBEI.icon} className="size-6" />
              </span>
              <span>
                <span className="block font-medium">{NAHBEI.ort}</span>
                <span className="block text-sm text-muted-foreground">
                  {NAHBEI.text}
                </span>
              </span>
            </button>
          </li>
        )}
        {ziele.map((vorschlag) => (
          <li key={`${vorschlag.art}-${vorschlag.label}`}>
            <button
              type="button"
              onClick={() => onZiel(vorschlag)}
              className="flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-secondary"
            >
              <Image
                src={vorschlag.bild}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-xl border border-border object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {vorschlag.label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {vorschlag.count === 1
                    ? "1 Unterkunft"
                    : `${vorschlag.count} Unterkünfte`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Leer-/Ladezustand statt eines stumm leeren Kastens. */}
      {ziele.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {zieleLaden
            ? "Reiseziele werden geladen …"
            : zielSuche
              ? "Kein Reiseziel gefunden. Enter sucht trotzdem im Titel."
              : "Noch keine Reiseziele verfügbar."}
        </p>
      )}
    </>
  );
}

/** Monatskalender mit Schnellwahl. `kompakt` = mobil: Schnellwahl als
 *  Chip-Reihe ÜBER dem Monat statt als 11-rem-Spalte daneben. */
function Kalender({
  kompakt,
  namen,
  kalMonat,
  setKalMonat,
  datum,
  setDatum,
  heute,
  heuteIso,
  formatKurz,
}: {
  kompakt: boolean;
  namen: { monat: (i: number) => string; wochentage: string[] };
  kalMonat: KalMonat;
  setKalMonat: React.Dispatch<React.SetStateAction<KalMonat>>;
  datum: string | null;
  setDatum: (iso: string) => void;
  heute: Date;
  heuteIso: string;
  formatKurz: (iso: string) => string;
}) {
  const ersterTag = new Date(kalMonat.jahr, kalMonat.monat, 1).getDay();
  const tageImMonat = new Date(kalMonat.jahr, kalMonat.monat + 1, 0).getDate();

  function monatWechsel(delta: number) {
    setKalMonat((m) => {
      const d = new Date(m.jahr, m.monat + delta, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  }

  function schnellDatum(offsetTage: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetTage);
    setDatum(isoDatum(d));
    setKalMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
  }

  const schnell = [
    { label: "Heute", sub: formatKurz(heuteIso), tage: 0 },
    { label: "Morgen", sub: "", tage: 1 },
    {
      label: "Dieses Wochenende",
      sub: "",
      tage: (6 - heute.getDay() + 7) % 7 || 6,
    },
  ];

  const schnellwahl = kompakt ? (
    <div className="band-scroll -mx-1 mb-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {schnell.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => schnellDatum(s.tage)}
          className="min-h-11 shrink-0 snap-start rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground"
        >
          {s.label}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex w-44 shrink-0 flex-col gap-3">
      {schnell.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => schnellDatum(s.tage)}
          className="rounded-2xl border border-border px-4 py-4 text-left transition-colors hover:border-foreground"
        >
          <span className="block font-medium">{s.label}</span>
          {s.sub && (
            <span className="block text-sm text-muted-foreground">{s.sub}</span>
          )}
        </button>
      ))}
    </div>
  );

  const monat = (
    <div className="min-w-0 flex-1">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Vorheriger Monat"
          onClick={() => monatWechsel(-1)}
          className="flex size-11 items-center justify-center rounded-full hover:bg-secondary"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
        <span className="font-semibold">
          {namen.monat(kalMonat.monat)} {kalMonat.jahr}
        </span>
        <button
          type="button"
          aria-label="Nächster Monat"
          onClick={() => monatWechsel(1)}
          className="flex size-11 items-center justify-center rounded-full hover:bg-secondary"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {namen.wochentage.map((w, i) => (
          <span key={i} className="py-1 text-xs text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: ersterTag }).map((_, i) => (
          <span key={`leer-${i}`} />
        ))}
        {Array.from({ length: tageImMonat }).map((_, i) => {
          const tag = i + 1;
          const iso = isoDatum(new Date(kalMonat.jahr, kalMonat.monat, tag));
          const vergangen = iso < heuteIso;
          const gewaehlt = iso === datum;
          return (
            <button
              key={tag}
              type="button"
              disabled={vergangen}
              onClick={() => setDatum(iso)}
              className={
                "flex aspect-square items-center justify-center rounded-full text-sm transition-colors " +
                (gewaehlt
                  ? "bg-foreground font-semibold text-background"
                  : vergangen
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "font-medium hover:bg-secondary")
              }
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (kompakt) {
    return (
      <div>
        {schnellwahl}
        {monat}
      </div>
    );
  }
  return (
    <>
      {schnellwahl}
      {monat}
    </>
  );
}

/** Gäste-Zähler (identisch in Dropdown und Blatt). Knöpfe 44 px, weil 32 px
 *  unter der Touch-Mindestgröße liegen. */
function GaesteListe({
  gaeste,
  setGast,
}: {
  gaeste: Gaeste;
  setGast: (key: GaesteKey, delta: number) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {GAESTE_FELDER.map((f) => (
        <li key={f.key} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{f.label}</p>
            <p className="text-sm text-muted-foreground">{f.sub}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={`${f.label} verringern`}
              disabled={gaeste[f.key] === 0}
              onClick={() => setGast(f.key, -1)}
              className="flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon icon="ph:minus" className="size-4" />
            </button>
            <span className="w-5 text-center font-medium tabular-nums">
              {gaeste[f.key]}
            </span>
            <button
              type="button"
              aria-label={`${f.label} erhöhen`}
              onClick={() => setGast(f.key, 1)}
              className="flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Icon icon="ph:plus" className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
