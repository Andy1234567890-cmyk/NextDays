"use client";

// Seitenleiste des Partner-Dashboards — dieselbe Bauart wie web/ und admin/
// (feste linke Leiste, Konto unten). Eine Kopfzeile war es vorher; mit sieben
// Punkten plus Sprache plus Konto brach sie schon bei 1440 px in drei Zeilen um.
// Ein Bewerber sieht nur Übersicht und Profil — die übrigen Punkte gibt es erst
// nach der Freigabe; der Server erzwingt das zusätzlich.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { abmelden } from "@/lib/auth";

import { Logo } from "./logo";

const PUNKTE: { href: string; key: string; icon: string; nurFreigegeben?: boolean }[] = [
  { href: "/", key: "uebersicht", icon: "ph:squares-four" },
  { href: "/kunden", key: "kunden", icon: "ph:buildings", nurFreigegeben: true },
  { href: "/provisionen", key: "provisionen", icon: "ph:coins", nurFreigegeben: true },
  { href: "/auszahlungen", key: "auszahlungen", icon: "ph:bank", nurFreigegeben: true },
  { href: "/links", key: "links", icon: "ph:link", nurFreigegeben: true },
  { href: "/beitraege", key: "beitraege", icon: "ph:film-strip", nurFreigegeben: true },
  { href: "/team", key: "team", icon: "ph:users-three", nurFreigegeben: true },
  { href: "/nachrichten", key: "nachrichten", icon: "ph:chat-circle-dots", nurFreigegeben: true },
  { href: "/profil", key: "profil", icon: "ph:user-circle" },
];
export function PartnerNav({ email, freigegeben }: { email: string; freigegeben: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const [, starte] = useTransition();
  const [offen, setOffen] = useState(false);

  const punkte = PUNKTE.filter((p) => freigegeben || !p.nurFreigegeben);
  const istAktiv = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const sprachwahl = (
    <select
      aria-label={t("sprache")}
      value={locale}
      onChange={(e) =>
        starte(async () => {
          await setLocale(e.target.value);
          router.refresh();
        })
      }
      className="w-full rounded-xl border border-border bg-transparent pl-3 pr-9 py-2 text-sm"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );

  const liste = (
    <ul className="space-y-1">
      {punkte.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            onClick={() => setOffen(false)}
            aria-current={istAktiv(p.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              istAktiv(p.href)
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Icon icon={p.icon} className="size-5 shrink-0" />
            {t(p.key)}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop: feste Seitenleiste */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="px-6 pt-7">
          <Link href="/" aria-label="myNextDays" className="block">
            <Logo heightRem={1.75} />
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-accent">{t("partner")}</p>
        </div>
        <nav className="mt-8 min-h-0 flex-1 overflow-y-auto px-3">{liste}</nav>
        <div className="shrink-0 space-y-3 border-t border-border px-6 py-5">
          {sprachwahl}
          <p className="truncate text-sm font-medium" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={() => void abmelden()}
            className="text-sm font-semibold underline-offset-4 hover:underline"
          >
            {t("abmelden")}
          </button>
        </div>
      </aside>

      {/* Mobil: Kopfzeile mit aufklappbarem Menü */}
      <header className="sticky top-0 z-20 border-b border-border bg-background md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" aria-label="myNextDays" className="flex items-center gap-2">
            <Logo heightRem={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">{t("partner")}</span>
          </Link>
          <button
            type="button"
            aria-expanded={offen}
            aria-label={t("menue")}
            onClick={() => setOffen((o) => !o)}
            className="rounded-full p-2 hover:bg-muted"
          >
            <Icon icon={offen ? "ph:x" : "ph:list"} className="size-6" />
          </button>
        </div>
        {offen && (
          <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
            {liste}
            <div className="space-y-3 px-3">
              {sprachwahl}
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <button
                type="button"
                onClick={() => void abmelden()}
                className="text-sm font-semibold underline-offset-4 hover:underline"
              >
                {t("abmelden")}
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
