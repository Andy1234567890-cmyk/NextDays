"use client";

// Abschnitt „Sprache & Währung". Bevorzugte Sprache aus den 24 EU-Amtssprachen
// (LOCALE_LABELS, kein Hardcode). Schreibt preferred_language ins Profil und
// setzt zusätzlich das UI-Locale-Cookie, damit die Oberfläche sofort umschaltet.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";

import { LOCALE_LABELS, LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import type { Account } from "@/lib/konto";
import { updateProfile } from "@/lib/konto-actions";

import { KontoZeile } from "./konto-zeile";

const LOCALES = Object.entries(LOCALE_LABELS) as [Locale, string][];

export function SpracheAbschnitt({ account }: { account: Account }) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [wahl, setWahl] = useState<string>(account.preferred_language ?? "de");

  const aktuellLabel =
    LOCALE_LABELS[(account.preferred_language ?? "") as Locale] ??
    t("nichtAngegeben");

  function schliessen() {
    setOffen(false);
    setFehler(null);
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const res = await updateProfile({ preferred_language: wahl });
    setBusy(false);
    if (res.ok) {
      // UI-Locale mitziehen (1 Jahr), dann neu laden.
      document.cookie = `${LOCALE_COOKIE}=${wahl}; path=/; max-age=31536000`;
      schliessen();
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t("spracheTitel")}
      </h1>

      <KontoZeile
        label={t("spracheLabel")}
        value={aktuellLabel}
        hasValue={!!account.preferred_language}
        open={offen}
        dimmed={false}
        onOpen={() => setOffen(true)}
        onClose={schliessen}
      >
        <div className="max-w-lg space-y-4">
          <select
            value={wahl}
            onChange={(e) => setWahl(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.9375rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LOCALES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex items-center gap-3">
            <Button type="button" onClick={speichern} disabled={busy}>
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
        </div>
      </KontoZeile>
    </section>
  );
}
