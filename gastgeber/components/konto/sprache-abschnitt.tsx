"use client";

// Abschnitt „Sprache & Währung" (Airbnb-Vorbild: drei Zeilen — Sprache,
// Währung, Zeitzone).
//
// Sprache: alle Locales aus LOCALE_LABELS (kein Hardcode). Schreibt
// preferred_language ins Profil und setzt zusätzlich das UI-Locale-Cookie,
// damit die Oberfläche sofort umschaltet.
//
// Währung und Zeitzone kommen aus `Intl` statt aus gepflegten Listen — eine
// Handliste liefe gegen die Laufzeit auseinander. Die Zonenliste ist dieselbe
// Quelle, gegen die der DB-Trigger prüft, damit die Auswahl keinen Wert
// anbieten kann, den der Server ablehnt.
//
// Die Anzeigewährung ersetzt NIE die Objektwährung: Preise werden weiter in
// ihrer echten Währung geführt (Wurzel 4).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";

import { SuchAuswahl } from "@/components/ui/such-auswahl";

import {
  LOCALE_FLAG_EMOJI,
  LOCALE_LABELS,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/locales";
import type { Account } from "@/lib/konto";
import { updateProfile } from "@/lib/konto-actions";
import {
  waehrungLabel,
  waehrungen,
  zeitzoneLabel,
  zeitzonen,
} from "@/lib/waehrungen-zeitzonen";

import { KontoZeile } from "./konto-zeile";

const LOCALES = Object.entries(LOCALE_LABELS) as [Locale, string][];

type Feld = "sprache" | "waehrung" | "zeitzone";

export function SpracheAbschnitt({ account }: { account: Account }) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [offen, setOffen] = useState<Feld | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [sprache, setSprache] = useState(account.preferred_language ?? "de");
  const [waehrung, setWaehrung] = useState(account.preferred_currency ?? "");
  const [zone, setZone] = useState(
    account.preferred_timezone ??
      // Vorauswahl aus dem Browser — ein Vorschlag, kein gespeicherter Wert.
      // Die Zeile zeigt weiter „Nicht angegeben", bis wirklich gespeichert ist.
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // Beide Listen einmal bauen: `zeitzonen()` erzeugt gut 400 Einträge mit je
  // einer Datumsformatierung — pro Render wäre das spürbar.
  const alleWaehrungen = useMemo(() => waehrungen(sprache), [sprache]);
  const alleZonen = useMemo(() => zeitzonen(sprache), [sprache]);

  function schliessen() {
    setOffen(null);
    setFehler(null);
  }

  async function speichern(feld: Feld) {
    setBusy(true);
    setFehler(null);
    const patch =
      feld === "sprache"
        ? { preferred_language: sprache }
        : feld === "waehrung"
          ? { preferred_currency: waehrung }
          : { preferred_timezone: zone };
    const res = await updateProfile(patch);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    // Nur bei der Sprache das UI-Locale mitziehen (1 Jahr).
    if (feld === "sprache") {
      document.cookie = `${LOCALE_COOKIE}=${sprache}; path=/; max-age=31536000`;
    }
    schliessen();
    router.refresh();
  }

  function Fuss({ feld }: { feld: Feld }) {
    return (
      <>
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void speichern(feld)} disabled={busy}>
            {t("speichern")}
          </Button>
          <button
            type="button"
            onClick={schliessen}
            disabled={busy}
            className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
          >
            {t("abbrechen")}
          </button>
        </div>
      </>
    );
  }

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t("spracheTitel")}
      </h1>

      <KontoZeile
        label={t("spracheLabel")}
        value={
          LOCALE_LABELS[(account.preferred_language ?? "") as Locale] ??
          t("nichtAngegeben")
        }
        hasValue={!!account.preferred_language}
        open={offen === "sprache"}
        dimmed={offen !== null && offen !== "sprache"}
        onOpen={() => setOffen("sprache")}
        onClose={schliessen}
      >
        <div className="max-w-lg space-y-4">
          <select
            value={sprache}
            onChange={(e) => setSprache(e.target.value)}
            disabled={busy}
            className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 ps-3 pe-10 text-[0.9375rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Flagge als EMOJI, nicht als Symbol: ein natives <option>
                rendert ausschliesslich Text. Sie steht VOR dem Endonym, nie
                an seiner Stelle — eine Flagge ist ein Land, keine Sprache. */}
            {LOCALES.map(([code, label]) => (
              <option key={code} value={code}>
                {LOCALE_FLAG_EMOJI[code]} {label}
              </option>
            ))}
          </select>
          <Fuss feld="sprache" />
        </div>
      </KontoZeile>

      <KontoZeile
        label={t("waehrungLabel")}
        value={
          waehrungLabel(account.preferred_currency, sprache) ??
          t("nichtAngegeben")
        }
        hasValue={!!account.preferred_currency}
        open={offen === "waehrung"}
        dimmed={offen !== null && offen !== "waehrung"}
        onOpen={() => setOffen("waehrung")}
        onClose={schliessen}
      >
        <div className="max-w-lg space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("waehrungHinweis")}
          </p>
          {/* Suche statt <select>: 45 Währungen sind nativ noch machbar, aber
              die Tastatursuche fände nur Treffer am Zeilenanfang — „Franken"
              fände „Schweizer Franken" nicht. */}
          <SuchAuswahl
            optionen={alleWaehrungen.map((w) => ({
              wert: w.code,
              label: w.label,
              stichworte: w.code,
            }))}
            wert={waehrung}
            onChange={setWaehrung}
            disabled={busy}
            suchPlatzhalter={t("waehrungSuche")}
          />
          <Fuss feld="waehrung" />
        </div>
      </KontoZeile>

      <KontoZeile
        label={t("zeitzoneLabel")}
        value={zeitzoneLabel(account.preferred_timezone) ?? t("nichtAngegeben")}
        hasValue={!!account.preferred_timezone}
        open={offen === "zeitzone"}
        dimmed={offen !== null && offen !== "zeitzone"}
        onOpen={() => setOffen("zeitzone")}
        onClose={schliessen}
      >
        <div className="max-w-lg space-y-4">
          {/* Über 400 Zonen — ohne Suche unbenutzbar. Die IANA-ID kommt als
              Stichwort mit, damit „Berlin" auch „Europe/Berlin" findet und
              nicht nur das Label „(GMT+02:00) Berlin". */}
          <SuchAuswahl
            optionen={alleZonen.map((z) => ({
              wert: z.id,
              label: z.label,
              stichworte: z.id.replace(/[_/]/g, " "),
            }))}
            wert={zone}
            onChange={setZone}
            disabled={busy}
            suchPlatzhalter={t("zeitzoneSuche")}
          />
          <Fuss feld="zeitzone" />
        </div>
      </KontoZeile>
    </section>
  );
}
