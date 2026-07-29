"use client";

// Abschnitt „Support-Diagnose" der Kontoeinstellungen.
//
// Hier entscheidet der Kunde, ob unser Support seine technischen Fehlerdaten
// einsehen darf. Ohne aktive Freigabe sieht der Support nichts — das ist der
// Unterschied zwischen einem Support-Werkzeug und einer Überwachungsfunktion.
//
// Der Abschnitt ist bewusst ausführlich beschriftet: Eine Freigabe, deren
// Umfang der Kunde nicht versteht, ist keine informierte Einwilligung.
import {
  reportClientInfo,
  setAktivitaetsAufzeichnung,
} from "@nextdays/diagnostics";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { DebugSession } from "@/lib/diagnose";
import { diagnoseFreigeben, diagnoseWiderrufen } from "@/lib/diagnose-actions";

// Auswählbare Dauer. Bewusst kurz gehalten — eine lange Freigabe wäre faktisch
// eine Dauererlaubnis; der Server deckelt zusätzlich bei 24 Stunden.
const DAUERN = [1, 2, 8, 24];

export function SupportDiagnose({ sessions }: { sessions: DebugSession[] }) {
  const t = useTranslations("konto");
  const [laeuft, setLaeuft] = useState(false);
  const [dauer, setDauer] = useState(2);
  const [notiz, setNotiz] = useState("");

  const aktiv = sessions.find((s) => s.aktiv) ?? null;

  async function freigeben() {
    setLaeuft(true);
    const res = await diagnoseFreigeben(dauer, notiz.trim() || undefined);
    setLaeuft(false);
    if (res.ok) {
      await reportClientInfo();
      setAktivitaetsAufzeichnung(true);
      setNotiz("");
      toast.success(t("sdFreigegeben"));
    } else {
      toast.error(res.fehler);
    }
  }

  async function widerrufen() {
    setLaeuft(true);
    const res = await diagnoseWiderrufen();
    setLaeuft(false);
    if (res.ok) {
      setAktivitaetsAufzeichnung(false);
      toast.success(t("sdFreigabeBeendet"));
    }
    else toast.error(res.fehler);
  }

  return (
    <section className="mt-10">
      <h2 className="font-sans text-xl font-bold tracking-tight">
        {t("sdTitel")}
      </h2>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        {t("sdEinleitung")}
      </p>

      {/* Umfang transparent machen — ohne das ist es keine informierte
          Einwilligung. */}
      <div className="mt-5 max-w-2xl rounded-2xl bg-muted/40 p-5">
        <p className="text-sm font-semibold">{t("sdSiehtTitel")}</p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" />
            {t("sdSieht1")}
          </li>
          <li className="flex gap-2.5">
            <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" />
            {t("sdSieht2")}
          </li>
          <li className="flex gap-2.5">
            <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" />
            {t("sdSieht3")}
          </li>
        </ul>
        <p className="mt-4 text-sm font-semibold">{t("sdSiehtNichtTitel")}</p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <Icon icon="ph:x" className="mt-0.5 size-4 shrink-0" />
            {t("sdSiehtNicht1")}
          </li>
          <li className="flex gap-2.5">
            <Icon icon="ph:x" className="mt-0.5 size-4 shrink-0" />
            {t("sdSiehtNicht2")}
          </li>
        </ul>
      </div>

      {aktiv ? (
        <div className="mt-6 max-w-2xl rounded-2xl border-2 border-foreground p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{t("sdLaeuft")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("sdEndetAm", {
                  datum: new Date(aktiv.expires_at).toLocaleString("de-DE"),
                })}
              </p>
              {aktiv.note && (
                <p className="mt-2 text-sm">
                  {t("sdNotiz", { notiz: aktiv.note })}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void widerrufen()}
              className="shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground disabled:opacity-50"
            >
              {t("sdBeenden")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 max-w-2xl rounded-2xl border border-border p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted-foreground">
              {t("sdDauerLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              {DAUERN.map((stunden) => (
                <button
                  key={stunden}
                  type="button"
                  onClick={() => setDauer(stunden)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    dauer === stunden
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  {t("sdDauerStunden", { stunden })}
                </button>
              ))}
            </div>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm text-muted-foreground">
              {t("sdNotizLabel")}
            </span>
            <input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              maxLength={300}
              placeholder={t("sdNotizPlatzhalter")}
              className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground"
            />
          </label>

          <button
            type="button"
            disabled={laeuft}
            onClick={() => void freigeben()}
            className="mt-5 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft ? t("sdFreigebenLaeuft") : t("sdFreigeben")}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("sdJederzeitBeenden")}
          </p>
        </div>
      )}

      {/* Vergangene Freigaben — der Kunde muss nachvollziehen können, wann er
          wem Einblick gegeben hat. */}
      {sessions.filter((s) => !s.aktiv).length > 0 && (
        <div className="mt-6 max-w-2xl">
          <p className="text-sm font-semibold">{t("sdFrueherTitel")}</p>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
            {sessions
              .filter((s) => !s.aktiv)
              .slice(0, 5)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(s.started_at).toLocaleString("de-DE")}
                  </span>
                  <span className="text-muted-foreground">
                    {s.ended_at
                      ? t("sdFrueherVorzeitig")
                      : t("sdFrueherAbgelaufen")}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
