// Konto-Übersicht: personalisierter Akzent-Hero, „nächste Reise"-Karte mit Foto
// + Countdown, farbige Schnellzugriff-Kacheln, Profil. Server-Component lädt
// Profil + kommende Buchungen; Profil-Bearbeitung ist eine Client-Insel.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KontoShell } from "@/components/konto-shell";
import { ProfilForm } from "@/components/profil-form";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/listings";
import { formatRange } from "@/lib/format";
import {
  serverBookings,
  serverGuestMe,
  serverUnreadCount,
} from "@/lib/guest-server";

// Schnellzugriff-Kacheln mit eigener Akzent-Tönung je Bereich (semantische
// Tokens/HSL-Verläufe, keine Arbitrary-Hex-Klassen).
const KACHELN: {
  href: string;
  icon: string;
  titel: string;
  text: string;
  hue: number;
}[] = [
  {
    href: "/buchungen",
    icon: "ph:calendar-check",
    titel: "Meine Buchungen",
    text: "Zeitraum, Zahlungen und Storno verwalten.",
    hue: 352,
  },
  {
    href: "/nachrichten",
    icon: "ph:chat-circle",
    titel: "Nachrichten",
    text: "Direkt mit deinen Gastgebern schreiben.",
    hue: 210,
  },
  {
    href: "/merkzettel",
    icon: "ph:heart",
    titel: "Merkzettel",
    text: "Gemerkte Unterkünfte für später.",
    hue: 320,
  },
  {
    href: "/bewertungen",
    icon: "ph:star",
    titel: "Bewertungen",
    text: "Deine Aufenthalte bewerten.",
    hue: 38,
  },
];

// Ganze Tage bis zum Check-in (nur für einen freundlichen Countdown-Hinweis).
// Kein erfundener Wert: liefert null, wenn das Datum ungültig ist.
function tageBis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ziel = new Date(iso);
  if (Number.isNaN(ziel.getTime())) return null;
  const heute = new Date();
  const t0 = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const t1 = Date.UTC(ziel.getFullYear(), ziel.getMonth(), ziel.getDate());
  return Math.round((t1 - t0) / 86_400_000);
}

function countdownText(tage: number): string {
  if (tage <= 0) return "Es geht los";
  if (tage === 1) return "Noch 1 Tag";
  return `Noch ${tage} Tage`;
}

export default async function KontoPage() {
  const me = await serverGuestMe();
  if (!me) redirect("/anmelden?weiter=/konto");

  const kommende = await serverBookings("upcoming");
  const unread = await serverUnreadCount();
  const naechste = kommende[0] ?? null;
  const vorname = (me.name ?? "").trim().split(" ")[0];
  const tage = naechste ? tageBis(naechste.check_in) : null;

  return (
    <KontoShell titel="Übersicht" breit>
      <div className="flex flex-col gap-8">
        {/* Akzent-Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent via-accent to-primary p-6 sm:p-8">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 mix-blend-soft-light"
            style={{
              background:
                "radial-gradient(40rem 20rem at 10% -20%, rgba(255,255,255,0.4), transparent), radial-gradient(30rem 16rem at 100% 130%, rgba(0,0,0,0.4), transparent)",
            }}
          />
          <div className="relative">
            <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
              {vorname ? `Willkommen zurück, ${vorname}.` : "Willkommen zurück."}
            </p>
            <p className="mt-1 max-w-md text-sm text-white/85">
              Hier verwaltest du deine Reisen, Nachrichten und gemerkten
              Unterkünfte bei myBestDays.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
              >
                <Icon icon="ph:magnifying-glass" className="size-4" />
                Unterkunft finden
              </Link>
              <Link
                href="/buchungen"
                className="inline-flex items-center gap-2 rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <Icon icon="ph:calendar-check" className="size-4" />
                Meine Buchungen
              </Link>
            </div>
          </div>
        </section>

        {/* Nächste Reise */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Deine nächste Reise
          </h2>
          {naechste ? (
            <Link
              href={`/buchungen/${naechste.id}`}
              className="group flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md sm:flex-row"
            >
              <div className="relative h-44 w-full shrink-0 overflow-hidden bg-secondary sm:h-auto sm:w-64">
                {naechste.property.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={naechste.property.photo}
                    alt={naechste.property.title}
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon icon="ph:image" className="size-8" />
                  </span>
                )}
                {tage != null && (
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur">
                    <Icon icon="ph:hourglass-medium" className="size-3.5" />
                    {countdownText(tage)}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={naechste.status} />
                </div>
                <p className="truncate font-display text-lg font-semibold">
                  {naechste.property.title}
                </p>
                {naechste.property.address && (
                  <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    <Icon icon="ph:map-pin" className="size-4 shrink-0" />
                    {naechste.property.address}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon icon="ph:calendar-blank" className="size-4 shrink-0" />
                  {formatRange(naechste.check_in, naechste.check_out)}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  {naechste.total_amount != null ? (
                    <span className="font-semibold">
                      {formatCurrency(
                        naechste.total_amount,
                        naechste.currency ?? naechste.property.currency,
                      )}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  <span className="flex items-center gap-1 text-sm font-medium text-accent">
                    Ansehen
                    <Icon
                      icon="ph:arrow-right"
                      className="size-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Icon icon="ph:suitcase-rolling" className="size-7" />
              </span>
              <p className="text-sm text-muted-foreground">
                Du hast aktuell keine anstehenden Buchungen.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Icon icon="ph:magnifying-glass" className="size-4" />
                Unterkunft finden
              </Link>
            </div>
          )}
        </section>

        {/* Schnellzugriff */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Schnellzugriff
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KACHELN.map((k) => (
              <Link
                key={k.href}
                href={k.href}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span
                  className="flex size-11 items-center justify-center rounded-xl text-white"
                  style={{
                    background: `linear-gradient(140deg, hsl(${k.hue} 60% 52%), hsl(${(k.hue + 22) % 360} 65% 38%))`,
                  }}
                >
                  <Icon icon={k.icon} className="size-6" />
                </span>
                {k.href === "/nachrichten" && unread > 0 && (
                  <span className="absolute right-4 top-4 flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                <div>
                  <p className="font-medium">{k.titel}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{k.text}</p>
                </div>
                <Icon
                  icon="ph:arrow-right"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* Profil */}
        <section className="max-w-4xl">
          <ProfilForm me={me} />
        </section>
      </div>
    </KontoShell>
  );
}
