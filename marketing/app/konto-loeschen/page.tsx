"use client";

// Öffentliche Konto-Löschseite (Play-Store-Pflicht, 0413).
//
// WARUM SIE OHNE LOGIN ERREICHBAR IST: Google verlangt ausdrücklich einen Weg
// für Leute, die die App schon deinstalliert haben oder nicht mehr in ihr Konto
// kommen („Some users may have already uninstalled your app"). Ein Login-Zwang
// hier würde die Anforderung verfehlen.
//
// WARUM DAS TROTZDEM SICHER IST: Das Absenden löst NICHTS aus außer einer
// Bestätigungsmail an genau die eingetippte Adresse. Erst der Klick auf den
// Link darin macht den Antrag gültig. Wer eine fremde Adresse einträgt,
// erreicht damit nur, dass der echte Inhaber eine Warnung bekommt. Genau das
// erklärt der Abschnitt „Warum ein Bestätigungslink?" dem Besucher — nicht als
// Beruhigung, sondern damit er den Ablauf versteht und die Mail nicht für
// einen Betrugsversuch hält.
import { useLocale } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { kontoLoeschungTexte } from "@/content/konto-loeschung";
import { loeschantragStellen } from "@/lib/konto-loeschung";

export default function KontoLoeschenSeite() {
  const locale = useLocale();
  const t = kontoLoeschungTexte(locale);

  const [email, setEmail] = useState("");
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(ev: React.FormEvent) {
    ev.preventDefault();
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await loeschantragStellen({ email, locale, grund });
      // Die Antwort der API ist bewusst neutral formuliert (sie verrät nicht,
      // ob es zu der Adresse ein Konto gibt) und wird unverändert angezeigt.
      setMeldung(res.detail);
      setEmail("");
      setGrund("");
    } catch (exc) {
      setFehler(exc instanceof Error ? exc.message : t.fehlerAllgemein);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="mx-auto w-full max-w-[42rem] flex-1 px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t.titel}</h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
          {t.einleitung}
        </p>

        {/* Ablauf in drei Schritten — wer hier landet, will wissen, was passiert. */}
        <section className="mt-10">
          <h2 className="text-lg font-medium">{t.wieTitel}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {[t.schritt1, t.schritt2, t.schritt3].map((schritt, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  {i + 1}
                </span>
                <span>{schritt}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Der Schutz, erklärt. Nicht Beiwerk: ohne diese Erklärung wirkt die
          Bestätigungsmail wie eine Hürde statt wie das, was sie ist. */}
        <section className="mt-8 rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
          <h2 className="text-base font-medium">{t.schutzTitel}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t.schutzText}
          </p>
        </section>

        <form onSubmit={absenden} className="mt-10 space-y-5">
          <div>
            <label htmlFor="loesch-email" className="block text-sm font-medium">
              {t.emailLabel}
            </label>
            <input
              id="loesch-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlatzhalter}
              className="mt-2 w-full rounded-full border border-neutral-300 px-4 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="loesch-grund" className="block text-sm font-medium">
              {t.grundLabel}{" "}
              <span className="font-normal text-neutral-500">
                ({t.grundOptional})
              </span>
            </label>
            <textarea
              id="loesch-grund"
              rows={3}
              // Dieselbe Obergrenze wie im Backend-Schema (GRUND_MAX). Der Server
              // kappt ohnehin; hier steht sie, damit der Besucher es merkt,
              // bevor er 3000 Zeichen tippt.
              maxLength={2000}
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              placeholder={t.grundPlatzhalter}
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-100"
            />
          </div>

          <button
            type="submit"
            disabled={laeuft}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-base font-medium text-white transition-opacity disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {laeuft ? t.laeuft : t.absenden}
          </button>

          {/* aria-live: die Meldung erscheint ohne Seitenwechsel, ein
            Screenreader muss sie mitbekommen. */}
          <div aria-live="polite" className="min-h-[1.5rem]">
            {meldung && (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                {meldung}
              </p>
            )}
            {fehler && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-900 dark:bg-red-950 dark:text-red-100">
                {fehler}
              </p>
            )}
          </div>
        </form>

        <section className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <h2 className="text-base font-medium">{t.hinweisTitel}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t.hinweisText}
          </p>
          <Link
            href="/datenschutz"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            {t.datenschutzLink}
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-medium">{t.appHinweisTitel}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t.appHinweisText}
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
