"use client";

// Die Passwortabfrage einer geschützten Seite (0442).
//
// Was der Gast hier NICHT bekommt: eine Anmeldung. Es gibt kein Konto, keinen
// Benutzernamen und keine „Passwort vergessen"-Kette — es ist EIN Passwort für
// EINE Seite, das der Betrieb weitergibt. Hostaway schreibt denselben Satz in
// seine Doku, und er ist wichtig: wer hier ein Login-Formular baut, weckt
// Erwartungen, die das Verfahren nicht einlösen kann.
//
// Das Ticket landet in einem Cookie und nicht im localStorage: die Seite wird
// SERVERSEITIG gerendert, und der Server sieht nur Cookies. Mit localStorage
// müsste die Seite im Browser nachgeladen werden — dann stünde der geschützte
// Inhalt für einen Moment nicht im HTML, und ohne JavaScript nie.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { texte } from "@/lib/texte";

export function SeitenSchloss({
  host,
  slug,
  sprache,
}: {
  host: string;
  slug: string;
  sprache: string;
}) {
  const t = texte(sprache);
  const router = useRouter();
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState(false);
  const [pending, start] = useTransition();

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(false);
    const res = await fetch("/api/v1/site/page/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, slug, passwort }),
    });
    if (!res.ok) {
      setFehler(true);
      return;
    }
    const daten = (await res.json()) as { ticket?: string };
    if (!daten.ticket) {
      setFehler(true);
      return;
    }
    // `max-age` ist bewusst kürzer als die Gültigkeit des Tickets (24 h): ein
    // Cookie, das länger lebt als sein Inhalt, führt zu einer Seite, die ohne
    // erkennbaren Grund wieder nach dem Passwort fragt.
    document.cookie = `nd-seite-${slug || "home"}=${encodeURIComponent(
      daten.ticket,
    )}; path=/; max-age=${23 * 60 * 60}; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">{t.schlossTitel}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.schlossHinweis}</p>
      <form onSubmit={absenden} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t.schlossFeld}</span>
          <input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            autoFocus
            maxLength={100}
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        {fehler ? (
          // Eine Meldung, die NICHT verrät, woran es lag. Ob die Seite
          // existiert, ob sie geschützt ist, wie lang das Passwort war — nichts
          // davon gehört in eine Antwort an jemanden, der es nicht kennt.
          <p className="text-sm text-destructive">{t.schlossFalsch}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !passwort}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {t.schlossOeffnen}
        </button>
      </form>
    </main>
  );
}
