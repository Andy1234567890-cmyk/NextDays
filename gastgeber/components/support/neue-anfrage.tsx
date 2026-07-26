"use client";

// Geführter Kontakt-Flow (Airbnb/Booking/Amazon-Muster): Thema → Selbsthilfe →
// erst dann das Formular. Der Kontakt ist bewusst der letzte Schritt, nicht der
// erste — Amazon formuliert das als „or connect with us when needed".
//
// Der Melder wählt KEINE Priorität; sie folgt serverseitig aus dem Thema.
import {
  reportClientInfo,
  setAktivitaetsAufzeichnung,
} from "@nextdays/diagnostics";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { diagnoseFreigeben } from "@/lib/diagnose-actions";
import { ticketAnlegen } from "@/lib/support-actions";

import { SUPPORT_THEMEN, type SupportThema } from "./themen-katalog";

export function NeueAnfrage({ onAbbruch }: { onAbbruch: () => void }) {
  const router = useRouter();
  const [thema, setThema] = useState<SupportThema | null>(null);
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  // Technische Themen profitieren am meisten von der Diagnose — dort ist
  // das Kästchen vorausgewählt, sonst bewusst nicht (keine stille
  // Einwilligung bei Anliegen, die gar keine Fehlerdaten brauchen).
  const [diagnose, setDiagnose] = useState(false);

  async function senden() {
    if (!thema || betreff.trim().length < 3 || !text.trim()) return;
    setLaeuft(true);
    const res = await ticketAnlegen(betreff.trim(), text.trim(), thema.slug);
    setLaeuft(false);
    if (res.ok) {
      // Freigabe direkt mitgeben, wenn gewünscht — sonst müsste der Kunde sie
      // in einem zweiten Schritt nachholen, was in der Praxis niemand tut.
      if (diagnose) {
        await diagnoseFreigeben(8, `Support-Anfrage ${res.data.id.slice(0, 8)}`);
        // Umgebung sofort mitschicken — sonst wartet der Support auf den
        // nächsten Fehler und sieht bis dahin eine leere Liste.
        await reportClientInfo();
        setAktivitaetsAufzeichnung(true);
      }
      toast.success("Anfrage gesendet.");
      router.push(`/support/${res.data.id}`);
    } else {
      toast.error(res.fehler);
    }
  }

  // Schritt 1 — Thema wählen.
  if (!thema) {
    return (
      <div>
        <h2 className="font-sans text-2xl font-bold tracking-tight">
          Worum geht es?
        </h2>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          Wähle ein Thema, damit wir dein Anliegen schneller bearbeiten können.
        </p>
        <div className="mt-6 space-y-3">
          {SUPPORT_THEMEN.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => {
                setThema(t);
                setDiagnose(t.slug === "technik");
              }}
              className="flex w-full items-center gap-4 rounded-2xl border border-border p-5 text-left transition-all hover:shadow-md"
            >
              <Icon icon={t.icon} className="size-7 shrink-0 text-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t.hinweis}
                </span>
              </span>
              <Icon
                icon="ph:caret-right"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAbbruch}
          className="mt-6 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Abbrechen
        </button>
      </div>
    );
  }

  // Schritt 2 — Selbsthilfe zuerst, Formular darunter.
  return (
    <div>
      <button
        type="button"
        onClick={() => setThema(null)}
        className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Anderes Thema
      </button>
      <h2 className="mt-4 font-sans text-2xl font-bold tracking-tight">
        {thema.label}
      </h2>

      {/* Selbsthilfe VOR dem Formular — viele Anliegen lassen sich hier
          erledigen, ohne dass jemand warten muss. */}
      {thema.selbsthilfe && thema.selbsthilfe.length > 0 && (
        <div className="mt-6 rounded-2xl bg-muted/40 p-5">
          <p className="text-sm font-semibold">Das kannst du direkt erledigen</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {thema.selbsthilfe.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-foreground"
              >
                {s.text}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">
            Betreff
          </span>
          <input
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            maxLength={200}
            placeholder="Kurz in einem Satz"
            className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm text-muted-foreground">
            Was ist passiert?
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={5000}
            placeholder="Beschreibe dein Anliegen. Je konkreter, desto schneller können wir helfen."
            className="w-full resize-none rounded-xl border border-border bg-transparent p-4 text-[0.9375rem] leading-relaxed outline-none focus-visible:border-foreground"
          />
        </label>

        {/* Diagnose-Freigabe direkt hier — im Moment der Meldung ist die
            Bereitschaft am größten, und der Support hat die Daten sofort. */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-muted/40 p-4">
          <input
            type="checkbox"
            checked={diagnose}
            onChange={(e) => setDiagnose(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="text-sm">
            <span className="font-medium">
              Diagnose für 8 Stunden freigeben
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              Der Support sieht dann Fehlermeldungen sowie deine Schritte in
              der Oberfläche (geöffnete Seiten, angeklickte Schaltflächen).
              Nicht sichtbar: deine Eingaben, Nachrichten und Gastdaten.
              Jederzeit widerrufbar.
            </span>
          </span>
        </label>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={laeuft || betreff.trim().length < 3 || !text.trim()}
            onClick={() => void senden()}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft ? "Wird gesendet …" : "Anfrage senden"}
          </button>
          <button
            type="button"
            onClick={onAbbruch}
            className="text-sm font-semibold underline-offset-4 hover:underline"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
