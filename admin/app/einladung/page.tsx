"use client";

// Einladung annehmen: eigenes Passwort setzen.
//
// Diese Seite ist bewusst OHNE Anmeldung erreichbar (Middleware-Ausnahme) — wer
// eingeladen wurde, hat noch kein Passwort. Die Berechtigung ist der Einmal-
// Token im Link; geprüft wird er ausschließlich serverseitig (72 h gültig,
// einmal verwendbar). Fehlermeldungen kommen unverändert vom Server und sind
// absichtlich unspezifisch: ob ein Token existiert, geht niemanden etwas an.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { einladungAnnehmen } from "@/lib/team-actions";

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
    const res = await einladungAnnehmen(token, passwort);
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
          Einladung
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dieser Link ist unvollständig. Bitte den vollständigen Link aus der
          E-Mail verwenden.
        </p>
      </div>
    );
  }

  if (fertig) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          Passwort gesetzt
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Du kannst dich jetzt anmelden.
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
        Backoffice-Zugang einrichten
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vergib ein Passwort für deinen Zugang. Mindestens {MIN_LAENGE} Zeichen —
        dieser Zugang sieht die Daten aller Betriebe.
      </p>

      <label className="mt-8 block">
        <span className="mb-1.5 block text-sm text-muted-foreground">
          Passwort
        </span>
        <input
          type="password"
          required
          minLength={MIN_LAENGE}
          autoComplete="new-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm text-muted-foreground">
          Passwort wiederholen
        </span>
        <input
          type="password"
          required
          minLength={MIN_LAENGE}
          autoComplete="new-password"
          value={wiederholung}
          onChange={(e) => setWiederholung(e.target.value)}
          className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground"
        />
      </label>

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

export default function EinladungSeite() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <Formular />
      </Suspense>
    </main>
  );
}
