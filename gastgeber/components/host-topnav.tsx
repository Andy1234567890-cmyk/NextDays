"use client";

// Gastgeber-Top-Navigation nach dem Airbnb-Host-Muster:
//   • links das Logo
//   • mittig schlichte Text-Tabs — aktiver Tab dunkel + kurze Unterlinie;
//     „Nachrichten" trägt einen roten Ungelesen-Punkt
//   • rechts „Zum Reisen wechseln" + Avatar-Kreis + Menü-Kreis (3-Strich)
// Der Menü-Kreis öffnet ein großes Slide-Over von rechts (abgerundet) mit
// Menü-Titel, Promo-Karte, Menüliste und Abmelden — wie Airbnbs „Menü".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@nextdays/ui/sheet";

import { Logo } from "@/components/logo";
import { logout } from "@/lib/auth";

// Haupt-Tabs (mittig). `dot` = roter Ungelesen-Punkt (Nachrichten).
const PRIMARY = [
  { key: "dashboard", href: "/", dot: false },
  { key: "kalender", href: "/kalender", dot: false },
  { key: "objekte", href: "/objekte", dot: false },
  { key: "buchungen", href: "/buchungen", dot: false },
  { key: "nachrichten", href: "/nachrichten", dot: true },
] as const;

function isActive(pathname: string, href: string): boolean {
  const p = pathname || "/";
  return href === "/" ? p === "/" : p.startsWith(href);
}

export function HostTopNav({ email }: { email: string | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const initials = (email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center px-8">
        {/* Links: Logo, bündig am Rand */}
        <Link href="/" className="justify-self-start" aria-label="myBestDays">
          <Logo heightRem={2} />
        </Link>

        {/* Mitte: schlichte Text-Tabs, aktiver Tab dunkel + kurze Unterlinie */}
        <nav className="flex items-center gap-9">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative py-1 text-base transition-colors ${
                  active
                    ? "font-semibold text-foreground"
                    : "font-normal text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  {t(item.key)}
                  {item.dot && (
                    <span className="absolute -end-3 top-0 size-2 rounded-full bg-rose-500" />
                  )}
                </span>
                {active && (
                  <span className="absolute -bottom-2 start-0 h-1 w-full rounded-full bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Rechts: „Zum Reisen wechseln" + Avatar + Menü-Kreis */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/anmelden"
            className="text-[0.9375rem] font-semibold text-foreground transition-opacity hover:opacity-70"
          >
            {t("perspektiveWechseln")}
          </Link>

          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-900">
            {initials}
          </span>

          <MenueSheet email={email} />
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Menü-Slide-Over (rechts, abgerundet) — Airbnbs „Menü".
// ---------------------------------------------------------------------------

// Menüpunkte, die auf ECHTE Routen zeigen (keine toten Links). Airbnb-spezifische
// Punkte (Co-Host, Werben) sind weggelassen, bis es sie bei uns gibt.
const MENU = [
  { key: "kontoeinstellungen", href: "/konto", icon: "solar:settings-line-duotone" },
  { key: "spracheWaehrung", href: "/konto?bereich=sprache", icon: "solar:global-line-duotone" },
  { key: "bewertungen", href: "/bewertungen", icon: "solar:star-line-duotone" },
  { key: "finanzen", href: "/finanzen", icon: "solar:wallet-line-duotone" },
  { key: "statistiken", href: "/statistiken", icon: "solar:chart-2-line-duotone" },
  { key: "neuesObjekt", href: "/objekt-einstellen", icon: "solar:add-square-line-duotone" },
  { key: "support", href: "/support", icon: "solar:chat-round-line-duotone" },
] as const;

// Eine schräge, abgerundete Promo-Kachel (Airbnb-Foto-Anmutung, ohne
// Fremd-Fotos): dezenter Farbverlauf + Objekt-Icon, Ringschatten.
function PromoKachel({
  className,
  icon,
  tone,
}: {
  className: string;
  icon: string;
  tone: string;
}) {
  return (
    <div
      className={`flex size-28 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md ring-1 ring-black/5 ${tone} ${className}`}
    >
      <Icon icon={icon} className="size-12" />
    </div>
  );
}

function MenueSheet({ email }: { email: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    await logout();
    setOpen(false);
    router.push("/anmelden");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-foreground">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto rounded-s-3xl border-s-0 p-0 sm:max-w-md"
      >
        {/* Kopf: Glocke + Schließen (rund) */}
        <div className="flex items-center justify-end gap-2 px-6 pt-6">
          <button
            type="button"
            aria-label="Benachrichtigungen"
            className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70"
          >
            <Icon icon="solar:bell-line-duotone" className="size-5" />
          </button>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Schließen"
              className="flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
            >
              <Icon icon="ph:x" className="size-5" />
            </button>
          </SheetTrigger>
        </div>

        {/* Titel */}
        <SheetTitle className="px-6 pt-4 font-display text-4xl font-bold tracking-tight">
          {t("menu.titel")}
        </SheetTitle>

        {/* Promo-Karte mit zwei schräg überlappenden Foto-Kacheln */}
        <div className="px-6 pt-8">
          <div className="rounded-2xl bg-muted/50 px-6 pb-6 pt-8 text-center">
            <div className="relative mx-auto mb-6 h-36 w-56">
              {/* hintere Kachel (leicht nach links gedreht) */}
              <PromoKachel
                className="absolute left-2 top-4 -rotate-6"
                icon="solar:home-2-bold-duotone"
                tone="from-emerald-100 to-emerald-50 text-emerald-700"
              />
              {/* vordere Kachel (leicht nach rechts gedreht) */}
              <PromoKachel
                className="absolute right-2 top-1 rotate-6"
                icon="solar:bed-bold-duotone"
                tone="from-rose-100 to-rose-50 text-rose-600"
              />
            </div>
            <p className="text-lg font-semibold">{t("menu.promoTitel")}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              {t("menu.promoText")}
            </p>
            <Link
              href="/objekt-einstellen"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-background px-6 py-3 text-sm font-semibold shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
            >
              {t("menu.promoCta")}
            </Link>
          </div>
        </div>

        {/* Menüliste */}
        <nav className="mt-6 px-4">
          {MENU.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[0.9375rem] transition-colors hover:bg-muted"
            >
              <Icon icon={item.icon} className="size-6 text-foreground" />
              {t(`menu.${item.key}`)}
            </Link>
          ))}
        </nav>

        {/* Trenner + Abmelden */}
        <div className="mt-2 border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-[0.9375rem] transition-colors hover:bg-muted disabled:opacity-60"
          >
            <Icon icon="solar:logout-2-line-duotone" className="size-6" />
            {t("nav.abmelden")}
          </button>
        </div>

        {email && (
          <p className="truncate px-8 pb-8 pt-2 text-xs text-muted-foreground">
            {email}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
