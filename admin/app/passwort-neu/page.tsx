"use client";

// Neues Passwort über den Reset-Link setzen.
//
// Ohne Anmeldung erreichbar (Middleware-Ausnahme). Die Berechtigung ist der
// Einmal-Token im Link; geprüft wird er ausschließlich serverseitig (eine
// Stunde gültig, einmal verwendbar). Fehlermeldungen kommen unverändert vom
// Server und sind absichtlich unspezifisch — ob ein Token existiert, geht
// niemanden etwas an.
//
// Nach dem Wechsel beendet der Server jede Sitzung des Kontos. Deshalb führt
// diese Seite bewusst zur Anmeldung und nicht ins Backoffice.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PasswortFeld } from "@/components/passwort-feld";
import { passwortNeuSetzen } from "@/lib/auth";

const MIN_LAENGE = 12;

function Formular() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [passwort, setPasswort] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (passwort !== wiederholung) {
      setFehler("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    if (passwort.length < MIN_LAENGE) {
      setFehler(`Mindestens ${MIN_LAENGE} Zeichen.`);
      return;
    }
    setLaeuft(true);
    const res = await passwortNeuSetzen(token, passwort);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.fehler);
      return;
    }
    setFertig(true);
    // Kurz stehen lassen, damit die Bestätigung lesbar ist, dann zum Login.
    setTimeout(() => router.push("/anmelden"), 1500);
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          Passwort zurücksetzen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dieser Link ist unvollständig. Bitte den vollständigen Link aus der
          E-Mail verwenden.
        </p>
        <Link
          href="/passwort-vergessen"
          className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  if (fertig) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          Passwort geändert
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Alle bisherigen Sitzungen wurden beendet. Melde dich mit dem neuen
          Passwort an.
        </p>
        <Link
          href="/anmelden"
          className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="w-full max-w-sm">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Neues Passwort
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vergib ein neues Passwort für deinen Zugang. Mindestens {MIN_LAENGE}{" "}
        Zeichen — dieser Zugang sieht die Daten aller Betriebe.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <PasswortFeld
          label="Neues Passwort"
          value={passwort}
          onChange={setPasswort}
          autoComplete="new-password"
          minLength={MIN_LAENGE}
        />
        <PasswortFeld
          label="Neues Passwort wiederholen"
          value={wiederholung}
          onChange={setWiederholung}
          autoComplete="new-password"
          minLength={MIN_LAENGE}
        />
      </div>

      {fehler && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={laeuft}
        className="mt-8 w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {laeuft ? "Wird gespeichert …" : "Passwort setzen"}
      </button>
    </form>
  );
}

export default function PasswortNeuSeite() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <Formular />
      </Suspense>
    </main>
  );
}
