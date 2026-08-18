"use client";

// Sperren, Entsperren und Löschen eines Betriebs (0405).
//
// Zwei Vorgänge mit sehr unterschiedlichem Gewicht in einer Karte: Sperren ist
// reversibel und braucht nur einen Grund; Löschen ist unumkehrbar und verlangt
// den getippten Betriebsnamen. Sie stehen bewusst optisch getrennt — ein
// Fehlgriff zwischen beiden darf nicht passieren.
import { useState, useTransition } from "react";

import {
  betriebEntsperren,
  betriebLoeschen,
  betriebSperren,
  type LoeschErgebnis,
} from "@/lib/betrieb-actions";

type Props = {
  tenantId: string;
  name: string;
  gesperrtSeit: string | null;
  grund: string | null;
  darfEntscheiden: boolean;
};

export function BetriebSperre({
  tenantId,
  name,
  gesperrtSeit,
  grund,
  darfEntscheiden,
}: Props) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [sperrGrund, setSperrGrund] = useState("");
  const [sperrOffen, setSperrOffen] = useState(false);
  const [loeschOffen, setLoeschOffen] = useState(false);
  const [loeschName, setLoeschName] = useState("");
  const [geloescht, setGeloescht] = useState<LoeschErgebnis | null>(null);

  const gesperrt = Boolean(gesperrtSeit);

  function sperren() {
    setFehler(null);
    starte(async () => {
      const res = await betriebSperren(tenantId, sperrGrund.trim());
      if (!res.ok) {
        setFehler(res.fehler);
        return;
      }
      setSperrOffen(false);
      setSperrGrund("");
    });
  }

  function entsperren() {
    setFehler(null);
    starte(async () => {
      const res = await betriebEntsperren(tenantId);
      if (!res.ok) setFehler(res.fehler);
    });
  }

  function loeschen() {
    setFehler(null);
    starte(async () => {
      const res = await betriebLoeschen(tenantId, loeschName.trim());
      if (!res.ok) {
        setFehler(res.fehler);
        return;
      }
      // Kein Redirect: das Ergebnis benennt, was NICHT mitgelöscht werden
      // konnte (Stripe, Portale, Bilder). Das muss lesbar bleiben.
      setGeloescht(res.data);
      setLoeschOffen(false);
    });
  }

  if (geloescht) {
    return (
      <section className="mt-8 rounded-2xl border border-border p-6">
        <h2 className="font-sans text-lg font-semibold">Betrieb gelöscht</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {geloescht.name} wurde entfernt: {geloescht.reservierungen}{" "}
          Reservierungen, {geloescht.objekte} Objekte, {geloescht.nutzer}{" "}
          Anmeldezugänge.
        </p>
        {geloescht.hinweise.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            {geloescht.hinweise.map((h) => (
              <li key={h} className="flex gap-2">
                <span aria-hidden>·</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-sans text-lg font-semibold">Zugang</h2>
          {gesperrt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Gesperrt am{" "}
              {new Date(gesperrtSeit as string).toLocaleString("de-DE")}
              {grund ? ` · ${grund}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Betrieb ist aktiv. Anmeldung und Marktplatz laufen.
            </p>
          )}
        </div>
        {gesperrt && (
          <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
            Gesperrt
          </span>
        )}
      </div>

      {!darfEntscheiden ? (
        <p className="mt-4 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Dein Zugang darf Betriebe ansehen, aber nicht sperren.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {gesperrt ? (
              <button
                type="button"
                disabled={laeuft}
                onClick={entsperren}
                className="rounded-full border border-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              >
                {laeuft ? "…" : "Sperre aufheben"}
              </button>
            ) : (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setSperrOffen((o) => !o)}
                className="rounded-full border border-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              >
                Betrieb sperren
              </button>
            )}
          </div>

          {sperrOffen && !gesperrt && (
            <div className="mt-4 rounded-xl border border-border p-4">
              <label
                htmlFor="sperr-grund"
                className="text-sm font-medium"
              >
                Grund der Sperre
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Wird im Backoffice und im Protokoll festgehalten, dem Betrieb
                aber nicht angezeigt.
              </p>
              <textarea
                id="sperr-grund"
                rows={2}
                value={sperrGrund}
                onChange={(e) => setSperrGrund(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={laeuft || sperrGrund.trim().length < 3}
                  onClick={sperren}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                >
                  {laeuft ? "…" : "Jetzt sperren"}
                </button>
                <button
                  type="button"
                  onClick={() => setSperrOffen(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm"
                >
                  Abbrechen
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Wirkung: keine Anmeldung mehr (myNextDays und myBestDays für
                Gastgeber), alle Objekte verschwinden vom myBestDays-Marktplatz.
                Portale und die eigene Website des Betriebs bleiben unberührt.
              </p>
            </div>
          )}

          {/* Löschen steht abgesetzt und zuletzt — anderer Vorgang, anderes
              Gewicht. */}
          <div className="mt-6 border-t border-border pt-5">
            {!loeschOffen ? (
              <button
                type="button"
                onClick={() => setLoeschOffen(true)}
                className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Betrieb endgültig löschen
              </button>
            ) : (
              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold">
                  Betrieb endgültig löschen
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entfernt Reservierungen, Objekte, Nutzer und alle daran
                  hängenden Daten. Das lässt sich nicht rückgängig machen. Ein
                  Stripe-Abo, Portal-Einträge und Bilder im Speicher gehen
                  dabei NICHT mit und müssen dort getrennt entfernt werden.
                </p>
                <label
                  htmlFor="loesch-name"
                  className="mt-4 block text-sm font-medium"
                >
                  Zum Bestätigen „{name}" eingeben
                </label>
                <input
                  id="loesch-name"
                  type="text"
                  value={loeschName}
                  onChange={(e) => setLoeschName(e.target.value)}
                  autoComplete="off"
                  className="mt-2 w-full max-w-sm rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={laeuft || loeschName.trim() !== name.trim()}
                    onClick={loeschen}
                    className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {laeuft ? "…" : "Unwiderruflich löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoeschOffen(false);
                      setLoeschName("");
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {fehler && (
        <p className="mt-4 text-sm text-muted-foreground">{fehler}</p>
      )}
    </section>
  );
}
