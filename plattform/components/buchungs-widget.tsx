"use client";

// Buchungs-Widget der Inserat-Seite — Zeitraum, Reisende, echter Serverpreis und
// der Sprung in den Checkout. Airbnb-Fluss (live abgelesen 11.08.2026):
//
//   Inserat: Zeitraum + Gäste + Gesamtpreis → „Reservieren" → „Du musst noch
//   nichts bezahlen." → Checkout-Seite: bezahlen und bestätigen.
//
// Vorher standen Vorname/Nachname/E-Mail MITTEN im Widget und die Reservierung
// entstand schon hier — der Gast hatte die Buchung, bevor er die Bedingungen
// gesehen hatte. Kontaktdaten und Zahlung gehören in den Checkout; hier wird
// nichts angelegt.
//
// Der Preis wird NICHT im Browser gerechnet: `POST /booking-engine/quote` liefert
// dieselbe Aufschlüsselung, die auch die Buchung verwendet (Reinigung,
// Haustiergebühr, Kurtaxe).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { type Angebot, ladeAngebot, ladeVerfuegbarkeit } from "@/lib/buchung";
import { type Listing, formatCurrency } from "@/lib/listings";

function naechte(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + "T00:00:00Z").getTime();
  const b = new Date(checkOut + "T00:00:00Z").getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 0;
}

/** Ein Zähler wie in der Gäste-Auswahl der großen Portale: −/Wert/+. */
function Zaehler({
  titel,
  hinweis,
  wert,
  min,
  max,
  verringern,
  erhoehen,
  onChange,
}: {
  titel: string;
  hinweis?: string;
  wert: number;
  min: number;
  max: number;
  verringern: string;
  erhoehen: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{titel}</p>
        {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={verringern}
          disabled={wert <= min}
          onClick={() => onChange(Math.max(min, wert - 1))}
          className="flex size-11 items-center justify-center rounded-full border border-border text-lg leading-none disabled:opacity-40 md:size-8"
        >
          −
        </button>
        <span className="min-w-6 text-center text-sm tabular-nums">{wert}</span>
        <button
          type="button"
          aria-label={erhoehen}
          disabled={wert >= max}
          onClick={() => onChange(Math.min(max, wert + 1))}
          className="flex size-11 items-center justify-center rounded-full border border-border text-lg leading-none disabled:opacity-40 md:size-8"
        >
          +
        </button>
      </div>
    </div>
  );
}

// Obergrenze der Tierauswahl. Der Server deckelt bei 50; im Widget wäre das
// sinnlos hoch — mehr als vier Tiere ist ein Fall für den Gastgeber-Kontakt.
const MAX_TIERE = 4;

export function BuchungsWidget({
  listing,
  rahmenlos = false,
}: {
  listing: Listing;
  /** Ohne eigenen Kasten/Schatten — für die Nutzung im mobilen Blatt, das den
   *  Rahmen schon mitbringt. */
  rahmenlos?: boolean;
}) {
  const t = useTranslations("widget");
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [gaeste, setGaeste] = useState(1);
  const [tiere, setTiere] = useState(0);
  // Aktionscode des Gastes. `code` ist das Eingabefeld, `codeAktiv` der
  // EINGELÖSTE Code — erst beim Einlösen wird neu gerechnet, sonst schickte
  // jeder Tastendruck eine Anfrage.
  const [code, setCode] = useState("");
  const [codeAktiv, setCodeAktiv] = useState("");
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [rechnet, setRechnet] = useState(false);
  // Belegt/gesperrt? Der Buchungskalender des Servers entscheidet, nicht das
  // Widget. Airbnb zeigt in diesem Fall rote Datumsfelder + „Zeitraum nicht
  // verfügbar" und macht aus „Reservieren" ein „Reisedaten ändern".
  const [belegt, setBelegt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const n = naechte(checkIn, checkOut);
  const preis = listing.preisProNacht; // null = Preis auf Anfrage
  const maxGaeste = Math.max(1, listing.gaeste || 1);

  // Angebot beim Server holen, sobald Zeitraum und Reisende feststehen. Es ist
  // die einzige Preis-Wahrheit im Widget — ohne gültigen Zeitraum gibt es keins.
  useEffect(() => {
    if (n <= 0) {
      setAngebot(null);
      return;
    }
    let abgebrochen = false;
    setRechnet(true);
    void ladeAngebot({
      property_id: listing.id,
      check_in: checkIn,
      check_out: checkOut,
      guests: gaeste,
      pets: tiere,
      promo_code: codeAktiv || undefined,
    }).then((res) => {
      if (abgebrochen) return;
      setRechnet(false);
      // Fehler hier NICHT als Buchungsfehler zeigen: der Gast hat noch nichts
      // ausgelöst. Ohne Angebot bleibt der Preisblock leer.
      setAngebot(res.ok ? res.data : null);
    });
    return () => {
      abgebrochen = true;
    };
  }, [listing.id, checkIn, checkOut, gaeste, tiere, n, codeAktiv]);

  // Verfügbarkeit prüfen, sobald ein Zeitraum steht — nicht erst beim Klick.
  // Sonst füllt der Gast alles aus und erfährt am Ende, dass die Tage weg sind.
  useEffect(() => {
    if (n <= 0) {
      setBelegt(false);
      return;
    }
    let abgebrochen = false;
    void ladeVerfuegbarkeit(listing.id, checkIn, checkOut).then((res) => {
      if (abgebrochen) return;
      setBelegt(res.ok ? res.data.days.some((d) => !d.available) : false);
    });
    return () => {
      abgebrochen = true;
    };
  }, [listing.id, checkIn, checkOut, n]);

  // Tiere zurücksetzen, sobald das Objekt sie nicht (mehr) erlaubt — sonst
  // stünde eine Zahl im Zustand, die der Server mit 422 ablehnt.
  useEffect(() => {
    if (!listing.haustiereErlaubt && tiere !== 0) setTiere(0);
  }, [listing.haustiereErlaubt, tiere]);

  const buchbar = n > 0 && !belegt && angebot != null && !angebot.priceless;
  const waehrung = angebot?.currency || listing.currency;

  function weiterZumCheckout() {
    if (n <= 0) {
      setFehler(t("fehlerZeitraum"));
      return;
    }
    if (!buchbar) {
      setFehler(belegt ? t("nichtVerfuegbar") : t("keinPreis"));
      return;
    }
    setFehler(null);
    const qs = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(gaeste),
      pets: String(tiere),
    });
    if (codeAktiv) qs.set("promo", codeAktiv);
    router.push(`/checkout/${listing.id}?${qs.toString()}`);
  }

  return (
    <div
      className={
        rahmenlos
          ? ""
          : "rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6"
      }
    >
      {/* Kopf: mit gewähltem Zeitraum der GESAMTPREIS (so macht es Airbnb), ohne
          Zeitraum der Nachtpreis als „ab"-Angabe. */}
      <p className="mb-4">
        {angebot && !angebot.priceless ? (
          <>
            <span className="text-xl font-semibold">
              {formatCurrency(angebot.total, waehrung)}
            </span>{" "}
            <span className="text-muted-foreground">{t("gesamtpreis")}</span>
          </>
        ) : preis != null ? (
          <>
            <span className="text-xl font-semibold">
              {formatCurrency(preis, listing.currency)}
            </span>{" "}
            <span className="text-muted-foreground">{t("proNacht")}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{t("preisAufAnfrage")}</span>
        )}
      </p>

      <div
        className={
          "overflow-hidden rounded-xl border " +
          (belegt ? "border-destructive" : "border-border")
        }
      >
        {/* Zwei Spalten bleiben, aber die Zellen dürfen nicht schrumpfen: bei
            360 px passte „tt.mm.jjjj" plus Kalendersymbol sonst nicht mehr und
            der Wert wurde abgeschnitten. */}
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <label className="min-w-0 p-3">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wide">
              {t("checkIn")}
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full bg-transparent text-base text-foreground outline-none sm:text-sm"
            />
          </label>
          <label className="min-w-0 p-3">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wide">
              {t("checkOut")}
            </span>
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-transparent text-base text-foreground outline-none sm:text-sm"
            />
          </label>
        </div>

        <div className="border-b border-border px-3 py-1 last:border-0">
          <span className="block pt-2 text-[0.625rem] font-semibold uppercase tracking-wide">
            {t("reisende")}
          </span>
          <Zaehler
            titel={t("gaeste")}
            hinweis={t("maxGaeste", { count: maxGaeste })}
            wert={gaeste}
            min={1}
            max={maxGaeste}
            verringern={t("verringern")}
            erhoehen={t("erhoehen")}
            onChange={setGaeste}
          />
          {listing.haustiereErlaubt && (
            <Zaehler
              titel={t("haustiere")}
              hinweis={t("haustiereHinweis")}
              wert={tiere}
              min={0}
              max={MAX_TIERE}
              verringern={t("verringern")}
              erhoehen={t("erhoehen")}
              onChange={setTiere}
            />
          )}
        </div>
      </div>

      {/* Belegter Zeitraum wird BENANNT und der Knopf ändert seine Aufgabe —
          „Reservieren" auf gesperrte Tage wäre ein Klick in den 409. */}
      {belegt && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
          {t("nichtVerfuegbar")}
        </p>
      )}

      <button
        type="button"
        onClick={weiterZumCheckout}
        disabled={belegt || rechnet}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {rechnet && <Icon icon="ph:spinner" className="size-4 animate-spin" />}
        {n > 0 ? t("reservieren") : t("zeitraumWaehlen")}
      </button>

      {buchbar && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t("nichtsBezahlen")}
        </p>
      )}

      {fehler && (
        <p className="mt-3 text-center text-sm text-destructive">{fehler}</p>
      )}

      {/* Aufschlüsselung des Servers: Übernachtung, Gebühren, Abgaben — Zeile
          für Zeile so, wie sie auch berechnet werden. */}
      {n > 0 && (
        <div className="mt-6 flex flex-col gap-3 text-sm">
          {rechnet && !angebot && (
            <p className="text-center text-muted-foreground">
              {t("preisWirdBerechnet")}
            </p>
          )}
          {angebot && !angebot.priceless && (
            <>
              {angebot.lines.map((zeile, i) => (
                <div key={`${zeile.label}-${i}`} className="flex justify-between">
                  <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                    {zeile.label}
                  </span>
                  <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                    {formatCurrency(zeile.amount, waehrung)}
                  </span>
                </div>
              ))}
              {/* Aktionscode — Branchenstandard: der Gast löst ihn beim Buchen
                  ein, der Rabatt erscheint als eigene Zeile. Gerechnet wird
                  ausschließlich serverseitig. */}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <label className="flex items-center gap-2">
                  <input
                    value={code}
                    maxLength={15}
                    placeholder={t("aktionscode")}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setCodeAktiv(code.trim());
                      }
                    }}
                    className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!code.trim() || code.trim() === codeAktiv}
                    onClick={() => setCodeAktiv(code.trim())}
                    className="h-10 shrink-0 rounded-full border border-border px-4 text-sm font-medium disabled:opacity-40"
                  >
                    {t("einloesen")}
                  </button>
                </label>
                {/* Nur nach einem Einlöse-Versuch etwas sagen — und zwar die
                    Wahrheit: ein Rabatt in den Zeilen kann auch von einer
                    automatischen Aktion kommen, dann war der Code trotzdem
                    ungültig. */}
                {codeAktiv && (
                  <p
                    className={
                      angebot.promo_code_applied
                        ? "text-sm text-emerald-700"
                        : "text-sm text-destructive"
                    }
                  >
                    {angebot.promo_code_applied
                      ? t("codeAngewendet")
                      : t("codeUngueltig")}
                  </p>
                )}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
                <span>{t("gesamt")}</span>
                <span>{formatCurrency(angebot.total, waehrung)}</span>
              </div>
            </>
          )}
          {angebot?.priceless && (
            <p className="text-center text-muted-foreground">{t("keinPreis")}</p>
          )}
        </div>
      )}
    </div>
  );
}
