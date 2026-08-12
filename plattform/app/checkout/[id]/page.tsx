// Checkout — „Bestätigen und bezahlen". Links die Schritte, rechts die
// Zusammenfassung der Buchung (Airbnb-Aufbau, live abgelesen 11.08.2026).
//
// ALLE Angaben kommen aus dem Aufruf und vom Server: Zeitraum und Gäste stehen in
// der URL (das Widget hängt sie an), Preis, Zahlungsplan, Storno und Kaution
// liefert `POST /booking-engine/quote`.
//
// Vorher stand hier eine Attrappe: `NAECHTE = 2`, „3.–5. Juli 2026", „1 Gast",
// „Kostenlose Stornierung … vor dem 1. Juli" und „Seltenes Fundstück" — alles
// erfunden, unabhängig von der echten Buchung. Genau das ist die Sorte
// Falschaussage, die niemand als Bug erkennt (Wurzel 4).
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { CheckoutAblauf } from "@/components/checkout-ablauf";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ladeAngebotServer } from "@/lib/angebot-server";
import { ladeInserat } from "@/lib/inserate";
import { formatCurrency } from "@/lib/listings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  // Ein Zahlungsvorgang gehört nie in einen Suchindex.
  return { title: t("titel"), robots: { index: false, follow: false } };
}

type Suche = {
  check_in?: string;
  check_out?: string;
  guests?: string;
  pets?: string;
  promo?: string;
};

/** ISO-Datum (YYYY-MM-DD) oder null — der Rest ist Client-Eingabe und wird
 *  verworfen, statt an den Server weitergereicht zu werden (Wurzel 3). */
function isoDatum(wert: string | undefined): string | null {
  if (!wert || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null;
  const d = new Date(`${wert}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : wert;
}

function zahl(wert: string | undefined, min: number, max: number): number {
  const n = Number(wert);
  if (!Number.isInteger(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Suche>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [t, format] = await Promise.all([
    getTranslations("checkout"),
    getFormatter(),
  ]);

  const checkIn = isoDatum(sp.check_in);
  const checkOut = isoDatum(sp.check_out);
  const guests = zahl(sp.guests, 1, 100);
  const pets = zahl(sp.pets, 0, 50);
  const promo = sp.promo?.trim().slice(0, 15) || undefined;

  const listing = await ladeInserat(id, {
    ...(checkIn && checkOut ? { start: checkIn, end: checkOut } : {}),
  });
  if (!listing) notFound();

  const zurueck = `/inserat/${id}`;

  // Ohne Zeitraum gibt es nichts zu bestätigen — zurück zum Inserat, statt eine
  // Zusammenfassung mit erfundenen Nächten zu zeigen.
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return (
      <Rahmen titel={t("titel")} zurueck={zurueck} zurueckLabel={t("zurueck")}>
        <Hinweis text={t("fehlerZeitraum")} link={zurueck} linkText={t("zumInserat")} />
      </Rahmen>
    );
  }

  const angebot = await ladeAngebotServer({
    propertyId: id,
    checkIn,
    checkOut,
    guests,
    pets,
    promoCode: promo,
  });

  if (!angebot || angebot.priceless) {
    return (
      <Rahmen titel={t("titel")} zurueck={zurueck} zurueckLabel={t("zurueck")}>
        <Hinweis text={t("keinPreis")} link={zurueck} linkText={t("zumInserat")} />
      </Rahmen>
    );
  }

  const waehrung = angebot.currency;
  const anreise = new Date(`${checkIn}T00:00:00Z`);
  const abreise = new Date(`${checkOut}T00:00:00Z`);
  const zeitraum = format.dateTimeRange(anreise, abreise, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const foto = listing.fotos[0];

  // Storno-Zusage NUR aus gepflegten Regeln. Die günstigste Stufe (größter
  // Vorlauf mit 100 %) ist die Aussage, die der Gast sucht: „bis wann kostenlos".
  const volleRueckgabe = angebot.cancellation?.rules.find(
    (r) => r.refund_percent >= 100,
  );

  return (
    <Rahmen titel={t("titel")} zurueck={zurueck} zurueckLabel={t("zurueck")}>
      <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
        <CheckoutAblauf
          daten={{
            propertyId: id,
            checkIn,
            checkOut,
            guests,
            pets,
            promoCode: promo,
          }}
          angebot={angebot}
        />

        {/* Rechte Spalte: Zusammenfassung */}
        <div className="lg:relative">
          <div className="lg:sticky lg:top-28">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex gap-4 border-b border-border pb-5">
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto}
                    alt=""
                    className="size-24 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <PhotoPlaceholder
                    hue={listing.hue}
                    className="size-24 shrink-0 rounded-xl"
                  />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium leading-snug">
                    {listing.titel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {listing.ort}
                  </p>
                  {listing.bewertung != null && (
                    <p className="mt-1 flex items-center gap-1 text-sm">
                      <Icon icon="ph:star-fill" className="size-3.5" />
                      {format.number(listing.bewertung, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}
                      {listing.anzahlBewertungen != null &&
                        ` (${listing.anzahlBewertungen})`}
                    </p>
                  )}
                </div>
              </div>

              {/* Stornobedingung — nur wenn der Betrieb eine gepflegt hat. */}
              {volleRueckgabe && (
                <div className="border-b border-border py-5">
                  <p className="text-sm font-semibold">{t("stornoTitel")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("stornoVoll", {
                      tage: volleRueckgabe.days_before_arrival,
                    })}
                  </p>
                </div>
              )}

              <div className="flex items-start justify-between border-b border-border py-5">
                <div>
                  <p className="text-sm font-semibold">{t("datum")}</p>
                  <p className="text-sm text-muted-foreground">{zeitraum}</p>
                </div>
                <Link href={zurueck} className="text-sm font-medium underline">
                  {t("aendern")}
                </Link>
              </div>

              <div className="flex items-start justify-between border-b border-border py-5">
                <div>
                  <p className="text-sm font-semibold">{t("gaeste")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("gaesteZahl", { count: guests })}
                    {pets > 0 && ` · ${t("tiereZahl", { count: pets })}`}
                  </p>
                </div>
                <Link href={zurueck} className="text-sm font-medium underline">
                  {t("aendern")}
                </Link>
              </div>

              <div className="pt-5">
                <p className="text-sm font-semibold">{t("preisDetails")}</p>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  {angebot.lines.map((zeile, i) => (
                    <div
                      key={`${zeile.label}-${i}`}
                      className="flex justify-between gap-4"
                    >
                      <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                        {zeile.label}
                      </span>
                      <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                        {formatCurrency(zeile.amount, waehrung)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
                    <span>{t("gesamt", { waehrung })}</span>
                    <span>{formatCurrency(angebot.total, waehrung)}</span>
                  </div>
                  {angebot.deposit && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("kautionHinweis", {
                        betrag: formatCurrency(
                          angebot.deposit.amount,
                          angebot.deposit.currency || waehrung,
                        ),
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Rahmen>
  );
}

function Rahmen({
  titel,
  zurueck,
  zurueckLabel,
  children,
}: {
  titel: string;
  zurueck: string;
  zurueckLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href={zurueck}
            aria-label={zurueckLabel}
            className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <Icon icon="ph:arrow-left" className="size-5" />
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {titel}
          </h1>
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function Hinweis({
  text,
  link,
  linkText,
}: {
  text: string;
  link: string;
  linkText: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border p-6">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={link} className="text-sm font-medium underline">
        {linkText}
      </Link>
    </div>
  );
}
