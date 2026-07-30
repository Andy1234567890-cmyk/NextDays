// Impressum der Marketing-Site — Pflichtangaben nach § 7 der dänischen
// E-handelslov (Sitz Dänemark, Herkunftslandprinzip). Inhalt/Anbieterdaten
// liegen ausschließlich in content/impressum.ts, diese Datei rendert sie nur.
import Link from "next/link";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import {
  IMPRESSUM_BLOECKE,
  IMPRESSUM_EINLEITUNG,
  IMPRESSUM_STAND,
} from "@/content/impressum";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum — myNextDays",
  description:
    "Anbieterangaben der myNextDays ApS nach § 7 der dänischen E-handelslov: Firma, Anschrift, Direktion, CVR-Nummer und Kontakt.",
};

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 py-16">
          <header className="flex flex-col gap-3">
            <h1 className="text-3xl font-display sm:text-4xl">Impressum</h1>
            <p className="text-sm text-muted-foreground">{IMPRESSUM_STAND}</p>
          </header>

          <div className="mt-8 flex flex-col gap-4">
            {IMPRESSUM_EINLEITUNG.map((absatz) => (
              <p key={absatz} className="text-sm leading-relaxed text-muted-foreground">
                {absatz}
              </p>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-10">
            {IMPRESSUM_BLOECKE.map((block) => (
              <section key={block.heading} className="flex flex-col gap-4">
                <h2 className="text-lg">{block.heading}</h2>

                {block.zeilen && (
                  <dl className="flex flex-col gap-4 border-l-2 border-accent/40 pl-5">
                    {block.zeilen.map((zeile) => (
                      <div key={zeile.label} className="flex flex-col gap-1">
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {zeile.label}
                        </dt>
                        <dd className="flex flex-col text-sm leading-relaxed">
                          {zeile.werte.map((wert, i) =>
                            // Verlinkt wird nur der erste Wert (Mail/Telefon/URL);
                            // Folgezeilen sind Zusatzangaben wie Register oder Land.
                            i === 0 && zeile.href ? (
                              <Link
                                key={wert}
                                href={zeile.href}
                                className="w-fit underline underline-offset-4 transition-colors hover:text-accent"
                              >
                                {wert}
                              </Link>
                            ) : (
                              <span key={wert}>{wert}</span>
                            ),
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {block.paragraphs?.map((absatz) => (
                  <p
                    key={absatz}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {absatz}
                  </p>
                ))}

                {block.links?.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="w-fit text-sm font-medium underline underline-offset-4 transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </section>
            ))}
          </div>

        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
