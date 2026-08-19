// Anschrift, Erreichbarkeit und Firmendaten.
//
// Referenz-UX: mews.com/en/contact-us schließt mit „So finden Sie uns" und
// listet je Standort Adresse und Telefonnummer. Genau das gehört hierhin — mit
// dem Unterschied, dass es bei uns EINEN Sitz gibt und wir das auch so sagen,
// statt „Remote location" in eine Länderliste zu schreiben, um größer zu wirken.
//
// ALLE Werte kommen aus `ANBIETER` (content/legal/anbieter.ts) — dieselbe
// Quelle wie Impressum, Rechtstexte und Über-uns-Seite. Übersetzt werden nur die
// Beschriftungen. Die Umsatzsteuer-Zeile erscheint nur, wenn eine
// Momsregistrierung vorliegt; solange `ustId` null ist, fehlt sie ganz statt
// einer Platzhalternummer (Wurzel 4).
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { ANBIETER } from "@/content/legal/anbieter";

export function KontaktAnschrift() {
  const t = useTranslations("kontakt.anschrift");

  const zeilen: readonly { key: string; wert: string }[] = [
    { key: "firma", wert: `${ANBIETER.firma} · ${ANBIETER.rechtsform}` },
    { key: "register", wert: `CVR-nr. ${ANBIETER.cvr}` },
    ...(ANBIETER.ustId ? [{ key: "ustId", wert: ANBIETER.ustId }] : []),
    { key: "direktion", wert: ANBIETER.direktion.join(", ") },
  ];

  const kanaele: readonly { icon: IconName; label: string; href: string }[] = [
    {
      icon: "ph:envelope-simple",
      label: ANBIETER.email,
      href: `mailto:${ANBIETER.email}`,
    },
    {
      icon: "ph:code",
      label: ANBIETER.emailTechnik,
      href: `mailto:${ANBIETER.emailTechnik}`,
    },
    {
      icon: "ph:phone",
      label: ANBIETER.telefon,
      href: `tel:${ANBIETER.telefonE164}`,
    },
  ];

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-24 lg:grid-cols-[1fr_1fr]">
        {/* Anschrift + Kanäle */}
        <div className="flex flex-col gap-8 rounded-3xl bg-surface-accent p-8 sm:p-10">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("heading")}
            </h2>
            <address className="mt-6 not-italic leading-relaxed">
              <span className="font-medium">{ANBIETER.firma}</span>
              <br />
              {ANBIETER.strasse}
              <br />
              {ANBIETER.ort}
              <br />
              {ANBIETER.land}
            </address>
          </div>

          <ul className="flex flex-col gap-4">
            {kanaele.map((k) => (
              <li key={k.href}>
                <a
                  href={k.href}
                  className="inline-flex items-center gap-3 font-medium transition-colors hover:text-accent"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-card text-accent">
                    <Icon icon={k.icon} className="size-5" />
                  </span>
                  {k.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Firmendaten */}
        <div className="rounded-3xl border border-border p-8 sm:p-10">
          <p className="eyebrow">{t("firmaEyebrow")}</p>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("firmaHeading")}
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {t("firmaText")}
          </p>

          <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {zeilen.map((z) => (
              <div key={z.key}>
                <dt className="text-sm text-muted-foreground">{t(z.key)}</dt>
                <dd className="mt-1 font-medium">{z.wert}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
            <Link
              href="/impressum"
              className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
            >
              {t("impressum")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
            <Link
              href="/datenschutz"
              className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
            >
              {t("datenschutz")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
