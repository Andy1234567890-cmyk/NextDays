"use client";

// Countdown-Abschnitt (0450).
//
// Die einzige Anzeige des Baukastens, die serverseitig nicht stimmen kann: ein
// vorgerendeter Zähler wäre in der Sekunde falsch, in der die Seite ankommt —
// und bei einer zwischengespeicherten Seite dauerhaft. Deshalb rechnet der
// BROWSER, und der Server liefert nur den Zielzeitpunkt.
//
// Bis der erste Tick läuft, steht bewusst NICHTS an der Stelle des Zählers
// (nicht „00:00:00"). Ein Zähler, der eine Zehntelsekunde lang null zeigt und
// dann springt, sieht aus wie ein abgelaufener Countdown.
import { useEffect, useState } from "react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

type Rest = { tage: number; stunden: number; minuten: number; sekunden: number };

/** Verbleibende Zeit bis `ziel`, oder `null`, wenn es vorbei ist. */
function restZeit(ziel: number): Rest | null {
  const ms = ziel - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    tage: Math.floor(s / 86400),
    stunden: Math.floor((s % 86400) / 3600),
    minuten: Math.floor((s % 3600) / 60),
    sekunden: s % 60,
  };
}

function Feld({ wert, label }: { wert: number; label: string }) {
  return (
    <div className="flex min-w-20 flex-col items-center rounded-2xl bg-secondary/60 px-4 py-4">
      <span className="font-display text-4xl font-extrabold tabular-nums">
        {String(wert).padStart(2, "0")}
      </span>
      <span className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function CountdownBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const ziel =
    typeof content.target === "string" ? Date.parse(content.target) : NaN;
  const gueltig = Number.isFinite(ziel);

  // `null` heißt „noch nicht gerechnet", `false` heißt „abgelaufen". Zwei
  // verschiedene Zustände, die verschieden aussehen müssen — mit einem
  // gemeinsamen `null` hätte der erste Frame wie ein abgelaufener Countdown
  // ausgesehen.
  const [rest, setRest] = useState<Rest | false | null>(null);

  useEffect(() => {
    if (!gueltig) return;
    // Sofort einmal rechnen, damit nach der Hydration keine Sekunde Leere steht.
    setRest(restZeit(ziel) ?? false);
    const timer = setInterval(() => {
      const r = restZeit(ziel);
      setRest(r ?? false);
      // Abgelaufen: den Intervall abräumen. Ein Timer, der jede Sekunde
      // dasselbe Ergebnis liefert, hält die Seite ohne Grund wach.
      if (!r) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [ziel, gueltig]);

  const titel = pickText(content.title, modus.locale).trim();
  const abgelaufenText = pickText(content.expired_text, modus.locale).trim();

  if (!gueltig) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={titel || undefined}
        grund={texte(modus.locale).leerCountdown}
      />
    );
  }

  const t = texte(modus.locale);
  const abgelaufen = rest === false;
  // Nach Ablauf: entweder der Zähler bleibt auf 0000 stehen und die Meldung
  // steht darunter, oder es steht nur die Meldung. Hostaway hat genau diese
  // zwei Möglichkeiten.
  const zeigeZaehler = !abgelaufen || content.on_expired === "counter";
  // `false` (abgelaufen) und `null` (noch nicht gerechnet) fallen beide auf
  // null zurück — angezeigt wird der Zähler in diesen Fällen ohnehin nur, wenn
  // der Kunde „auf null stehen lassen" gewählt hat.
  const werte: Rest = rest || { tage: 0, stunden: 0, minuten: 0, sekunden: 0 };

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 text-center">
      {titel ? (
        <h2
          {...editierbar(modus, "title")}
          className="pb-6 font-display text-3xl font-extrabold tracking-tight"
        >
          {titel}
        </h2>
      ) : null}

      {zeigeZaehler ? (
        <div
          className="flex flex-wrap justify-center gap-3"
          // Ein Zähler, der jede Sekunde vorgelesen wird, macht die Seite
          // unbenutzbar. `aria-hidden` nimmt ihn aus der Ansage; die Aussage
          // („der Countdown läuft") trägt die Überschrift.
          aria-hidden
        >
          {/* Vor dem ersten Tick steht nichts — siehe Kopf der Datei. */}
          {rest === null ? null : (
            <>
              <Feld wert={werte.tage} label={t.countdownTage} />
              <Feld wert={werte.stunden} label={t.countdownStunden} />
              <Feld wert={werte.minuten} label={t.countdownMinuten} />
              <Feld wert={werte.sekunden} label={t.countdownSekunden} />
            </>
          )}
        </div>
      ) : null}

      {abgelaufen && abgelaufenText ? (
        <p className="pt-6 text-lg font-semibold">{abgelaufenText}</p>
      ) : null}
    </section>
  );
}
