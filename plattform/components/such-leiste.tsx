// Such-Leiste im Airbnb-Layout: drei Felder (Wohin / Wann / Wer) mit eigenen
// Dropdowns — Reiseziel-Vorschläge, Kalender (Today/Tomorrow/Wochenende +
// Monatsansicht) und Gäste-Zähler (Erwachsene/Kinder/Kleinkinder/Haustiere) —
// plus roter Such-Button. Die gewählten Werte fließen als Query in die Suche.
// „Wohin" ist ein echtes Textfeld (Freitext → ?q), seine Vorschläge kommen aus
// dem Bestand (lib/reiseziele.ts), nicht aus einer Liste im Code.
"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const WOCHENTAGE = ["S", "M", "D", "M", "D", "F", "S"];
const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Gäste-Kategorien wie Airbnb.
type GaesteKey = "erwachsene" | "kinder" | "kleinkinder" | "haustiere";
const GAESTE_FELDER: { key: GaesteKey; label: string; sub: string }[] = [
  { key: "erwachsene", label: "Erwachsene", sub: "Ab 13 Jahren" },
  { key: "kinder", label: "Kinder", sub: "2–12 Jahre" },
  { key: "kleinkinder", label: "Kleinkinder", sub: "Unter 2" },
  { key: "haustiere", label: "Haustiere", sub: "Bringst du ein Tier mit?" },
];

type Feld = "wohin" | "wann" | "wer" | null;

// Datum ohne Zeitzonen-Verschiebung als ISO (YYYY-MM-DD).
function isoDatum(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

function formatKurz(iso: string): string {
  const [, m, t] = iso.split("-").map(Number);
  return `${t}. ${MONATE[m - 1].slice(0, 3)}`;
}

export function SuchLeiste() {
  const router = useRouter();
  const [aktiv, setAktiv] = useState<Feld>(null);
  const [ziel, setZiel] = useState<string | null>(null);
  const [datum, setDatum] = useState<string | null>(null);
  const [gaeste, setGaeste] = useState<Record<GaesteKey, number>>({
    erwachsene: 0,
    kinder: 0,
    kleinkinder: 0,
    haustiere: 0,
  });
  // Angezeigter Kalendermonat (Start = heutiger Monat). Als {jahr, monat}.
  const heute = new Date();
  const [kalMonat, setKalMonat] = useState({
    jahr: heute.getFullYear(),
    monat: heute.getMonth(),
  });
  const ref = useRef<HTMLDivElement>(null);
  const zielInput = useRef<HTMLInputElement>(null);
  const [ziele, setZiele] = useState<Reiseziel[]>([]);
  const [zieleLaden, setZieleLaden] = useState(false);

  const gaesteGesamt =
    gaeste.erwachsene + gaeste.kinder + gaeste.kleinkinder;

  function suchen() {
    const params = new URLSearchParams();
    const q = (ziel ?? "").trim();
    if (q) params.set("q", q);
    if (datum) params.set("start", datum);
    if (gaesteGesamt > 0) params.set("guests", String(gaesteGesamt));
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
    setAktiv(null);
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

  // Kalender-Tage des aktuellen Monats (mit führenden Leerzellen).
  const ersterTag = new Date(kalMonat.jahr, kalMonat.monat, 1).getDay();
  const tageImMonat = new Date(kalMonat.jahr, kalMonat.monat + 1, 0).getDate();
  const heuteIso = isoDatum(heute);

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

  const zielSuche = (ziel ?? "").trim().length > 0;

  const gaesteLabel =
    gaesteGesamt > 0
      ? `${gaesteGesamt} Gäste${gaeste.haustiere > 0 ? ", Haustier" : ""}`
      : "Gäste hinzufügen";

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-4xl">
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
              (gaesteGesamt > 0 ? "font-medium text-foreground" : "text-muted-foreground")
            }
          >
            {gaesteLabel}
          </span>
        </button>

        {/* Such-Button (breit mit Text wie Airbnb) */}
        <button
          type="button"
          onClick={suchen}
          className="ml-1 flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Icon icon="ph:magnifying-glass" className="size-5" />
          <span className="text-sm">Suchen</span>
        </button>
      </div>

      {/* Dropdown: Reiseziele (echte Ziele aus dem Bestand) */}
      {aktiv === "wohin" && (
        <div className="absolute left-0 top-full z-50 mt-3 max-h-[26rem] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card shadow-xl">
          <div className="p-6">
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              {zielSuche ? "Passende Reiseziele" : "Vorgeschlagene Reiseziele"}
            </p>
            <ul className="flex flex-col">
              {!zielSuche && (
                <li>
                  <button
                    type="button"
                    onClick={waehleNahbei}
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
                    onClick={() => waehleZiel(vorschlag)}
                    className="flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-secondary"
                  >
                    <Image
                      src={vorschlag.bild}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-xl border border-border object-cover"
                    />
                    <span>
                      <span className="block font-medium">{vorschlag.label}</span>
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
          </div>
        </div>
      )}

      {/* Dropdown: Kalender (Wann) */}
      {aktiv === "wann" && (
        <div className="absolute left-1/2 top-full z-50 mt-3 flex w-[42rem] max-w-[calc(100vw-3rem)] -translate-x-1/2 gap-6 rounded-3xl border border-border bg-card p-6 shadow-xl">
          {/* Schnellwahl */}
          <div className="flex w-44 shrink-0 flex-col gap-3">
            {[
              { label: "Heute", sub: formatKurz(heuteIso), tage: 0 },
              { label: "Morgen", sub: "", tage: 1 },
              { label: "Dieses Wochenende", sub: "", tage: (6 - heute.getDay() + 7) % 7 || 6 },
            ].map((s) => (
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

          {/* Monatskalender */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                aria-label="Vorheriger Monat"
                onClick={() => monatWechsel(-1)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
              >
                <Icon icon="ph:caret-left" className="size-4" />
              </button>
              <span className="font-semibold">
                {MONATE[kalMonat.monat]} {kalMonat.jahr}
              </span>
              <button
                type="button"
                aria-label="Nächster Monat"
                onClick={() => monatWechsel(1)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
              >
                <Icon icon="ph:caret-right" className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WOCHENTAGE.map((w, i) => (
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
        </div>
      )}

      {/* Dropdown: Gäste (Wer) */}
      {aktiv === "wer" && (
        <div className="absolute right-0 top-full z-50 mt-3 w-96 max-w-[calc(100vw-3rem)] rounded-3xl border border-border bg-card p-6 shadow-xl">
          <ul className="flex flex-col divide-y divide-border">
            {GAESTE_FELDER.map((f) => (
              <li key={f.key} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-sm text-muted-foreground">{f.sub}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`${f.label} verringern`}
                    disabled={gaeste[f.key] === 0}
                    onClick={() => setGast(f.key, -1)}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Icon icon="ph:minus" className="size-4" />
                  </button>
                  <span className="w-4 text-center font-medium tabular-nums">
                    {gaeste[f.key]}
                  </span>
                  <button
                    type="button"
                    aria-label={`${f.label} erhöhen`}
                    onClick={() => setGast(f.key, 1)}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <Icon icon="ph:plus" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
