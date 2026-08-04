"use client";

// Passwort-Reset anfordern.
//
// Ohne Anmeldung erreichbar (Middleware-Ausnahme) — wer sein Passwort vergessen
// hat, kommt nicht hinein. Die Bestätigung ist bewusst UNSPEZIFISCH: sie sagt
// nicht, ob zu der Adresse ein Backoffice-Zugang gehört. Der Server antwortet
// genauso; diese Seite zeigt nur, was sie bekommt.
import Link from "next/link";
import { useState } from "react";

import { passwortResetAnfordern } from "@/lib/auth";

export default function PasswortVergessenSeite() {
  const [email, setEmail] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const res = await passwortResetAnfordern(email);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.fehler);
      return;
    }
    setMeldung(res.meldung);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {meldung ? (
        <div className="w-full max-w-sm">
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">
            E-Mail unterwegs
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{meldung}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Der Link gilt eine Stunde und lässt sich nur einmal verwenden.
          </p>
          <Link
            href="/anmelden"
            className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
          >
            Zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={absenden} className="w-full max-w-sm">
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">
            Passwort zurücksetzen
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trag die E-Mail-Adresse deines Backoffice-Zugangs ein. Wir schicken
            dir einen Link, mit dem du ein neues Passwort setzt.
          </p>

          <label className="mt-8 block">
            <span className="mb-1.5 block text-sm text-muted-foreground">
              E-Mail
            </span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {laeuft ? "Wird gesendet …" : "Link senden"}
          </button>

          <p className="mt-4 text-sm">
            <Link
              href="/anmelden"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Zurück zur Anmeldung
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
