"use client";

// Der Vorführ-Zugang (0407): holt eine Session für den Demo-Mandanten und
// führt in das echte Dashboard.
//
// Warum diese Seite überhaupt existiert und nicht der Marketing-Knopf direkt
// ins Dashboard zeigt: die Session muss serverseitig geholt und in httpOnly-
// Cookies gelegt werden, bevor irgendeine Dashboard-Seite lädt. Springt der
// Besucher direkt auf `/`, sieht er den Login — die Sitzung existiert ja noch
// nicht.
//
// Warum ein Zwischenschritt mit Text und nicht eine stille Weiterleitung: der
// Besucher soll WISSEN, dass er in einer Vorführung landet, in der nichts
// gespeichert wird. Erfährt er das erst, wenn ein Klick auf „Speichern" nicht
// funktioniert, wirkt die Software defekt statt geschützt.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { fuehrungZuruecksetzen } from "@/components/demo-fuehrung";
import { Logo } from "@/components/logo";
import { demoSitzungHolen } from "@/lib/auth";

export default function DemoSeite() {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  // Gegen den doppelten Aufruf im React-Strict-Mode (Entwicklung rendert
  // Effekte zweimal). Jeder Aufruf kostet einen echten Login gegen GoTrue und
  // zählt im Rate-Limit-Bucket (5/60) mit — zwei Aufrufe je Besuch würden das
  // Kontingent halbieren.
  const gestartet = useRef(false);

  useEffect(() => {
    if (gestartet.current) return;
    gestartet.current = true;
    // Jeder Aufruf dieser Seite ist ein NEUER Besuch — der Knopf „Demo ansehen"
    // auf der Marketing-Seite fuehrt genau hierher. Die Fuehrung soll deshalb
    // wieder von vorn laufen, auch wenn ein frueherer Durchlauf sie im Browser
    // als gesehen markiert hat.
    fuehrungZuruecksetzen();
    void (async () => {
      const res = await demoSitzungHolen();
      if (res.ok) {
        // `replace`, nicht `push`: der Zurück-Button soll auf die
        // Marketing-Seite führen, nicht auf diese Zwischenseite, die dann
        // erneut eine Session holen würde.
        router.replace("/");
        return;
      }
      setFehler(res.error);
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo heightRem={2} />

      {fehler ? (
        <>
          <h1 className="font-display text-2xl font-bold">
            Die Vorführung ist gerade nicht erreichbar
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">{fehler}</p>
          {/* Kein „Erneut versuchen": schlägt der Zugang fehl, liegt es an der
              Konfiguration oder am Dienst — ein zweiter Klick ändert daran
              nichts und verbraucht nur das Rate-Limit. */}
          <a
            href="https://mynextdays.com"
            className="text-sm font-semibold underline underline-offset-4"
          >
            Zurück zur Startseite
          </a>
        </>
      ) : (
        <>
          <Icon
            icon="ph:spinner"
            className="size-8 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <div role="status" aria-live="polite">
            <h1 className="font-display text-2xl font-bold">
              Vorführung wird geöffnet
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Sie sehen einen echten Betrieb mit Beispieldaten. Alles lässt sich
              ansehen — gespeichert wird nichts.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
