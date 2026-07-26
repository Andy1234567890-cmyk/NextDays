"use client";

// Anmeldung am Plattform-Backoffice.
//
// Die Berechtigung entsteht NICHT durch den Login, sondern durch den Eintrag in
// public.platform_admins. Die Server Action prüft das direkt nach dem Login
// (/platform/me) und setzt die Cookies nur, wenn die Prüfung durchgeht — ein
// Betriebs-Nutzer mit korrektem Passwort kommt hier also nicht hinein.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { anmelden } from "@/lib/auth";

function Formular() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const res = await anmelden(email, passwort);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.fehler);
      return;
    }
    // „weiter" nur relativ zulassen — ein absolutes Ziel wäre eine offene
    // Weiterleitung (Phishing über die eigene Domain).
    const weiter = params.get("weiter");
    router.push(weiter?.startsWith("/") ? weiter : "/");
  }

  return (
    <form onSubmit={absenden} className="w-full max-w-sm">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Backoffice
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Interner Bereich der Plattform-Verwaltung.
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

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm text-muted-foreground">
          Passwort
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
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
        {laeuft ? "Wird geprüft …" : "Anmelden"}
      </button>
    </form>
  );
}

export default function AnmeldenSeite() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <Formular />
      </Suspense>
    </main>
  );
}
