// Firmen-Datenblatt und Kontakt.
//
// Auf keiner der drei Referenzseiten steht, wer der Vertragspartner
// tatsächlich ist — man findet es erst im Kleingedruckten. Für einen
// europäischen Anbieter, der Betriebe an sich binden will, ist das der falsche
// Weg herum: Firma, Register und ein erreichbarer Kontakt gehören auf die
// Über-uns-Seite, nicht nur ins Impressum.
//
// ALLE Werte kommen aus `ANBIETER` (content/legal/anbieter.ts) — dieselbe
// Quelle wie Impressum und Rechtstexte. Übersetzt werden nur die Beschriftungen.
// Die Umsatzsteuer-Zeile erscheint nur, wenn eine Momsregistrierung vorliegt;
// solange `ustId` null ist, fehlt sie ganz statt einer Platzhalternummer.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { ANBIETER } from "@/content/legal/anbieter";

export function UeberUnternehmen() {
  const t = useTranslations("ueberUns.unternehmen");

  const zeilen: readonly { key: string; wert: string }[] = [
    { key: "firma", wert: `${ANBIETER.firma} · ${ANBIETER.rechtsform}` },
    {
      key: "sitz",
      wert: `${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}`,
    },
    { key: "register", wert: `CVR-nr. ${ANBIETER.cvr}` },
    ...(ANBIETER.ustId ? [{ key: "ustId", wert: ANBIETER.ustId }] : []),
    { key: "direktion", wert: ANBIETER.direktion.join(", ") },
  ];

  const kontakte: readonly { icon: IconName; label: string; href: string }[] = [
    {
      icon: "ph:envelope-simple",
      label: ANBIETER.email,
      href: `mailto:${ANBIETER.email}`,
    },
    {
      icon: "ph:phone",
      label: ANBIETER.telefon,
      href: `tel:${ANBIETER.telefonE164}`,
    },
  ];

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-24 lg:grid-cols-[1.4fr_1fr]">
        {/* Datenblatt */}
        <div className="rounded-3xl border border-border p-8 sm:p-10">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("heading")}
          </h2>

          <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {zeilen.map((z) => (
              <div key={z.key}>
                <dt className="text-sm text-muted-foreground">{t(z.key)}</dt>
                <dd className="mt-1 font-medium">{z.wert}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/impressum"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            {t("impressum")}
            <Icon icon="ph:arrow-right" className="size-4" />
          </Link>
        </div>

        {/* Kontakt */}
        <div className="flex flex-col justify-between gap-8 rounded-3xl bg-surface-accent p-8 sm:p-10">
          <div>
            <h3 className="font-display text-2xl font-semibold tracking-tight">
              {t("kontaktTitel")}
            </h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("kontaktText")}
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {kontakte.map((k) => (
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
      </div>
    </section>
  );
}
