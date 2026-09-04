"use client";

// Stempel-Terminal an der Wand (Vertrag §3.2, §6): Vollbild, grosse Schrift,
// Touch-Ziffernblock, kein Menue, keine Navigation.
//
// DER ABLAUF IST ZWEISTUFIG UND ZWINGEND
// --------------------------------------
// Schritt 1  Stempel-ID (vier Ziffern) → `POST /terminal/status` zeigt
//            Anzeigename, laufende Stempelung und Schicht heute.
// Schritt 2  PIN (4–6 Ziffern) + Aktion → `POST /terminal/stempeln`.
// Danach steht das Ergebnis SECHS Sekunden gross auf dem Schirm und die
// Oberflaeche faellt von selbst auf Schritt 1 zurueck. Ohne diesen Ruecksprung
// bliebe der Name des letzten Kollegen sichtbar, bis der naechste kommt — an
// einem Wandgeraet ist das ein Datenleck fuer jeden Vorbeigehenden.
//
// WAS MIT DEM TOKEN PASSIERT — UND WAS NICHT
// ------------------------------------------
// Der Token kommt aus der URL und lebt NUR in dieser Komponente (Prop, kein
// State, kein Cookie, kein localStorage, kein Formularfeld). Er wird nie
// geloggt und nie angezeigt; die Server-Actions in `lib/personal-terminal.ts`
// setzen ihn als `X-Terminal-Token` und loggen ausschliesslich Route + Status.
// Fehlt er, gibt es gar keinen Aufruf (fail-closed, Wurzel 5).
//
// WARUM DER KOPF ALLE SECHS STUNDEN NEU GEHOLT WIRD
// -------------------------------------------------
// Das Geraet laeuft Tage am Stueck. Uhr und Datum rechnet der Browser selbst
// (ein Sekundenintervall, kein Netzverkehr); Wetter und Betriebsname kommen
// aus `GET /terminal/info` und wuerden ohne Nachladen veralten — das Wetter
// des Vortages waere eine Falschaussage. Zusaetzlich holt die Seite den Kopf
// neu, sobald der Kalendertag umschlaegt.
//
// FEHLERFAELLE, DIE HIER GROSS UND UNTERSCHIEDLICH ANGEZEIGT WERDEN
// -----------------------------------------------------------------
// 401 `token_fehlt` · 401 `token_unbekannt` · 401 `terminal_nicht_freigegeben`
// (Terminals sind in den Betriebsregeln aus) · 401 `pin_falsch` ·
// 423 `gesperrt` (fuenf Fehlversuche → 15 Minuten) · 404 `stempel_id_unbekannt`.
// Die drei Token-Fehler sind ZUSTAENDE des Geraets (nicht des Nutzers) und
// sperren die Oberflaeche komplett — wer davor steht, kann nichts richten, und
// eine Eingabemaske vorzutaeuschen waere gelogen. Die drei uebrigen betreffen
// die Eingabe und erscheinen als grosse rote Meldung ueber dem Ziffernblock.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wetterIcon, wetterName } from "@/lib/personal-planung-typen";
import {
  TERMINAL_AKTIONEN,
  type TerminalAktion,
  type TerminalInfo,
  type TerminalStatus,
  type TerminalZeit,
} from "@/lib/personal-terminal-typen";
import { terminalInfo, terminalStatus, terminalStempeln } from "@/lib/personal-terminal";

/** Sekunden, die das Ergebnis stehen bleibt, bevor die Maske zurueckfaellt. */
const ERGEBNIS_SEKUNDEN = 6;

/** Kopfdaten alle sechs Stunden erneuern (dasselbe Fenster wie der
 *  Wetter-Cache im Backend, §1.6 — oefter waere sinnlos). */
const INFO_INTERVALL_MS = 6 * 60 * 60 * 1000;

/** Fehlercodes, die das GERAET betreffen und die Oberflaeche sperren. */
const GERAET_CODES = new Set(["token_fehlt", "token_unbekannt", "terminal_nicht_freigegeben"]);

type Schritt =
  | { art: "id" }
  | { art: "pin"; stempelId: string; status: TerminalStatus }
  | { art: "ergebnis"; name: string; aktion: TerminalAktion; zeit: TerminalZeit };

/** Minuten als „7:30" — dieselbe Form wie `minutenAlsStunden`, hier ohne
 *  Import aus den Betriebs-Typen, weil das Terminal sonst deren ganzen
 *  Typbaum in sein Bundle zieht. */
function stundenKurz(minuten: number): string {
  const abs = Math.abs(Math.round(minuten));
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

export function Terminal({ token }: { token: string }) {
  const t = useTranslations("personal");
  const [info, setInfo] = useState<TerminalInfo | null>(null);
  /** Zustand des Geraets: `null` = noch unbekannt (laedt), sonst Fehlercode. */
  const [geraetFehler, setGeraetFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>({ art: "id" });
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());

  // --- Uhr: EIN Sekundenintervall, keine Anfrage ----------------------------
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // --- Kopfdaten -----------------------------------------------------------
  const infoHolen = useCallback(async () => {
    if (!token) {
      setGeraetFehler("token_fehlt");
      setGeladen(true);
      return;
    }
    const res = await terminalInfo(token);
    setGeladen(true);
    if (res.ok) {
      setInfo(res.data);
      setGeraetFehler(null);
      return;
    }
    // Ein Netzfehler ist KEIN Geraetefehler: das Terminal bleibt bedienbar,
    // sobald das Backend wieder antwortet. Nur echte Token-/Freigabe-Fehler
    // sperren (Wurzel 5 — Signale nicht vermischen).
    if (res.code && GERAET_CODES.has(res.code)) setGeraetFehler(res.code);
    else if (res.status === 401) setGeraetFehler("token_unbekannt");
    else setFehler(res.code ?? "netzwerk");
  }, [token]);

  useEffect(() => {
    void infoHolen();
    const id = window.setInterval(() => void infoHolen(), INFO_INTERVALL_MS);
    return () => window.clearInterval(id);
  }, [infoHolen]);

  // Tageswechsel: der Kopf traegt Datum und Wetter HEUTE — nach Mitternacht
  // ist beides falsch, bis der Sechs-Stunden-Takt zufaellig greift.
  const zone = info?.betrieb.zeitzone ?? "UTC";
  const tag = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", { timeZone: zone, dateStyle: "short" }).format(
        new Date(jetzt),
      ),
    [jetzt, zone],
  );
  const letzterTag = useRef(tag);
  useEffect(() => {
    if (letzterTag.current !== tag) {
      letzterTag.current = tag;
      void infoHolen();
    }
  }, [tag, infoHolen]);

  // --- Ruecksprung nach dem Ergebnis ---------------------------------------
  useEffect(() => {
    if (schritt.art !== "ergebnis") return;
    const id = window.setTimeout(() => {
      setSchritt({ art: "id" });
      setEingabe("");
      setFehler(null);
    }, ERGEBNIS_SEKUNDEN * 1000);
    return () => window.clearTimeout(id);
  }, [schritt]);

  /** Fehlercode als Satz — unbekannte Codes zeigen den Code, statt ihn zu
   *  verschlucken (Wurzel 5). */
  const fehlerText = useCallback(
    (code: string | null, ersatz?: string) => {
      if (!code) return ersatz ?? t("terminal.fehlerAllgemein");
      const schluessel = `fehlercode.${code}`;
      if (t.has(schluessel)) return t(schluessel);
      return ersatz ?? code;
    },
    [t],
  );

  // --- Ziffernblock --------------------------------------------------------
  const maxLaenge = schritt.art === "pin" ? 6 : 4;

  function ziffer(z: string) {
    setFehler(null);
    setEingabe((v) => (v.length >= maxLaenge ? v : v + z));
  }

  function zurueckTaste() {
    setFehler(null);
    setEingabe((v) => v.slice(0, -1));
  }

  function abbrechen() {
    setSchritt({ art: "id" });
    setEingabe("");
    setFehler(null);
  }

  async function idPruefen() {
    if (eingabe.length !== 4) return;
    setBusy(true);
    const res = await terminalStatus(token, eingabe);
    setBusy(false);
    if (!res.ok) {
      if (res.code && GERAET_CODES.has(res.code)) {
        setGeraetFehler(res.code);
        return;
      }
      setFehler(fehlerText(res.code, res.meldung));
      setEingabe("");
      return;
    }
    setSchritt({ art: "pin", stempelId: eingabe, status: res.data });
    setEingabe("");
  }

  async function stempeln(aktion: TerminalAktion) {
    if (schritt.art !== "pin") return;
    if (eingabe.length < 4) {
      setFehler(t("terminal.pinZuKurz"));
      return;
    }
    setBusy(true);
    const res = await terminalStempeln(token, schritt.stempelId, eingabe, aktion);
    setBusy(false);
    if (!res.ok) {
      if (res.code && GERAET_CODES.has(res.code)) {
        setGeraetFehler(res.code);
        return;
      }
      setFehler(fehlerText(res.code, res.meldung));
      // Die PIN wird IMMER geleert — auch bei `gesperrt`. Eine stehende PIN am
      // Wandgeraet ist ein Mitleseziel.
      setEingabe("");
      if (res.code === "stempel_id_unbekannt") setSchritt({ art: "id" });
      return;
    }
    setSchritt({
      art: "ergebnis",
      name: schritt.status.anzeige_name,
      aktion,
      zeit: res.data,
    });
    setEingabe("");
  }

  /** Welche Aktionen der Zustand gerade zulaesst — ein „Kommen" bei laufender
   *  Stempelung waere ein 422, den niemand versteht. Die Auswahl bleibt
   *  vollstaendig sichtbar, nur nicht anklickbar (der Nutzer sieht, WARUM). */
  const erlaubt = useMemo<Set<TerminalAktion>>(() => {
    if (schritt.art !== "pin") return new Set();
    const zustand = schritt.status.offen?.zustand ?? null;
    if (zustand === null) return new Set<TerminalAktion>(["start"]);
    if (zustand === "in_pause") return new Set<TerminalAktion>(["pause_ende", "ende"]);
    return new Set<TerminalAktion>(["pause", "ende"]);
  }, [schritt]);

  // --- Geraet gesperrt oder noch nicht geladen ------------------------------
  if (!geladen) {
    return (
      <Rahmen>
        <p className="text-3xl text-neutral-400">{t("terminal.wartenAufToken")}</p>
      </Rahmen>
    );
  }

  if (geraetFehler) {
    return (
      <Rahmen>
        <Icon icon="ph:warning-circle" className="size-24 text-amber-400" />
        <h1 className="mt-6 max-w-3xl text-center font-display text-4xl font-extrabold">
          {geraetFehler === "token_fehlt"
            ? t("terminal.keinToken")
            : geraetFehler === "terminal_nicht_freigegeben"
              ? t("terminal.nichtBereit")
              : t("terminal.tokenUnbekannt")}
        </h1>
        <p className="mt-4 max-w-2xl text-center text-xl text-neutral-400">
          {t("terminal.geraetHint")}
        </p>
      </Rahmen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Kopf info={info} jetzt={jetzt} zone={zone} />

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {fehler && (
          <p
            role="alert"
            className="w-full max-w-2xl rounded-3xl bg-red-500/15 px-6 py-5 text-center text-3xl font-bold text-red-300"
          >
            {fehler}
          </p>
        )}

        {schritt.art === "ergebnis" ? (
          <Ergebnis schritt={schritt} />
        ) : (
          <>
            {schritt.art === "pin" && <PersonKopf status={schritt.status} zone={zone} />}

            <div className="text-center">
              <p className="text-2xl font-medium text-neutral-400">
                {schritt.art === "id" ? t("terminal.stempelIdHint") : t("terminal.pinHint")}
              </p>
              <p
                aria-label={schritt.art === "id" ? t("terminal.stempelId") : t("terminal.pin")}
                className="mt-3 font-display text-6xl font-extrabold tabular-nums tracking-[0.4em]"
              >
                {schritt.art === "id"
                  ? (eingabe.padEnd(4, "·") as string)
                  : eingabe.replace(/./g, "•").padEnd(4, "·")}
              </p>
            </div>

            <Ziffernblock
              onZiffer={ziffer}
              onZurueck={zurueckTaste}
              busy={busy}
              loeschenLabel={t("terminal.loeschen")}
            />

            {schritt.art === "id" ? (
              <button
                type="button"
                disabled={busy || eingabe.length !== 4}
                onClick={idPruefen}
                className="min-h-24 w-full max-w-2xl rounded-3xl bg-emerald-500 text-3xl font-extrabold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {t("terminal.weiter")}
              </button>
            ) : (
              <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
                {TERMINAL_AKTIONEN.map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy || !erlaubt.has(a) || eingabe.length < 4}
                    onClick={() => void stempeln(a)}
                    className={`min-h-28 rounded-3xl text-3xl font-extrabold transition-colors disabled:bg-neutral-800 disabled:text-neutral-500 ${
                      a === "start"
                        ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                        : a === "ende"
                          ? "bg-red-500 text-neutral-50 hover:bg-red-400"
                          : "bg-amber-400 text-neutral-950 hover:bg-amber-300"
                    }`}
                  >
                    {t(`terminal.aktion.${a}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={abbrechen}
                  className="col-span-2 min-h-20 rounded-3xl border-2 border-neutral-700 text-2xl font-bold text-neutral-300 hover:bg-neutral-900"
                >
                  {t("terminal.abbrechen")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** Vollbild-Mitte fuer die Zustandsseiten (laedt / gesperrt). */
function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">{children}</div>
  );
}

function Kopf({
  info,
  jetzt,
  zone,
}: {
  info: TerminalInfo | null;
  jetzt: number;
  zone: string;
}) {
  const t = useTranslations("personal");
  const uhr = new Intl.DateTimeFormat("de-DE", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(jetzt));
  const datum = new Intl.DateTimeFormat("de-DE", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(jetzt));
  const w = info?.wetter_heute ?? null;
  const lage = w ? wetterName(w.code) : null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-8 py-5">
      <div>
        <p className="font-display text-6xl font-extrabold tabular-nums">{uhr}</p>
        <p className="mt-1 text-xl text-neutral-400">{datum}</p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold">{info?.betrieb.name ?? "—"}</p>
        <p className="text-lg text-neutral-400">
          {info?.terminal.name ?? t("terminal.titel")}
          {info?.terminal.property_title ? ` · ${info.terminal.property_title}` : ""}
        </p>
        {w && (
          <p className="mt-1 flex items-center justify-end gap-2 text-lg text-neutral-300">
            <Icon icon={wetterIcon(w.code)} className="size-6" />
            <span className="tabular-nums">
              {w.temp_min !== null && w.temp_max !== null
                ? t("terminal.wetterWerte", {
                    min: Math.round(w.temp_min),
                    max: Math.round(w.temp_max),
                  })
                : "—"}
            </span>
            {lage && t.has(`terminal.wetterLage.${lage}`) && (
              <span className="text-neutral-400">{t(`terminal.wetterLage.${lage}`)}</span>
            )}
          </p>
        )}
      </div>
    </header>
  );
}

/** Schritt 2: wer da steht, was laeuft, welche Schicht heute ansteht. */
function PersonKopf({ status, zone }: { status: TerminalStatus; zone: string }) {
  const t = useTranslations("personal");
  const uhrzeit = (iso: string) =>
    new Intl.DateTimeFormat("de-DE", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));

  return (
    <div className="w-full max-w-3xl rounded-3xl bg-neutral-900 p-6 text-center">
      <p className="font-display text-5xl font-extrabold">{status.anzeige_name}</p>
      <p className="mt-3 text-2xl text-neutral-300">
        {status.offen
          ? status.offen.zustand === "in_pause"
            ? t("terminal.offenPause", { uhrzeit: uhrzeit(status.offen.start_at) })
            : t("terminal.offen", { uhrzeit: uhrzeit(status.offen.start_at) })
          : t("terminal.nichtGestempelt")}
      </p>
      <p className="mt-1 text-xl text-neutral-400">
        {status.schicht_heute
          ? t("terminal.schichtHeute", {
              von: uhrzeit(status.schicht_heute.start_at),
              bis: uhrzeit(status.schicht_heute.end_at),
            })
          : t("terminal.keineSchichtHeute")}
        {status.schicht_heute?.arbeitsbereich_kurz
          ? ` · ${status.schicht_heute.arbeitsbereich_kurz}`
          : ""}
      </p>
    </div>
  );
}

function Ergebnis({
  schritt,
}: {
  schritt: { art: "ergebnis"; name: string; aktion: TerminalAktion; zeit: TerminalZeit };
}) {
  const t = useTranslations("personal");
  const beendet = schritt.aktion === "ende";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Icon
        icon={beendet ? "ph:hand-waving" : "ph:check-circle"}
        className={`size-28 ${beendet ? "text-amber-400" : "text-emerald-400"}`}
      />
      <p className="font-display text-6xl font-extrabold">
        {t(`terminal.erfolg.${schritt.aktion}`, { name: schritt.name })}
      </p>
      <p className="text-3xl text-neutral-300">
        {t(`terminal.aktion.${schritt.aktion}`)}
        {beendet ? ` · ${t("terminal.erfolgNetto", { stunden: stundenKurz(schritt.zeit.netto_minuten) })}` : ""}
      </p>
      <p className="text-xl text-neutral-500">{t("terminal.zurueckIn", { sekunden: ERGEBNIS_SEKUNDEN })}</p>
    </div>
  );
}

/** Touch-Ziffernblock: 3×4, jede Taste mindestens 6 rem hoch — mit Handschuh
 *  bedienbar, und ohne Tastatur am Wandgeraet die EINZIGE Eingabe. */
function Ziffernblock({
  onZiffer,
  onZurueck,
  busy,
  loeschenLabel,
}: {
  onZiffer: (z: string) => void;
  onZurueck: () => void;
  busy: boolean;
  loeschenLabel: string;
}) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((z) => (
        <Taste key={z} label={z} onClick={() => onZiffer(z)} busy={busy} />
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={onZurueck}
        aria-label={loeschenLabel}
        className="min-h-24 rounded-3xl bg-neutral-800 text-4xl font-bold text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
      >
        <Icon icon="ph:backspace" className="mx-auto size-10" />
      </button>
      <Taste label="0" onClick={() => onZiffer("0")} busy={busy} />
      <span aria-hidden className="min-h-24" />
    </div>
  );
}

function Taste({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="min-h-24 rounded-3xl bg-neutral-800 font-display text-5xl font-extrabold tabular-nums transition-colors hover:bg-neutral-700 active:bg-neutral-600 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
