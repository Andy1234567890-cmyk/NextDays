// Konto-Einstieg in der Kopfzeile. Eingeloggt → Avatar + Dropdown (Buchungen,
// Nachrichten inkl. Unread-Badge, Merkzettel, Abmelden). Ausgeloggt → /anmelden.
// Der Login-Status wird serverseitig ermittelt und als Prop übergeben (das
// nd_access-Cookie ist HttpOnly, kein Client-Zugriff).
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { clearGuestSession } from "@/lib/guest-session";

export function KontoButton({
  eingeloggt,
  name,
  unread,
}: {
  eingeloggt: boolean;
  name: string | null;
  unread: number;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function klickAussen(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener("mousedown", klickAussen);
    return () => document.removeEventListener("mousedown", klickAussen);
  }, []);

  // Ausgeloggt: Dropdown-Menü im Airbnb-Stil (Hilfe / Gastgeber-Einstiege /
  // „Anmelden oder registrieren"). Der Login-Zugang liegt HIER im Menü, nicht
  // als separater Button — genau wie bei Airbnb/Booking.
  if (!eingeloggt) {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          aria-label="Menü"
          className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
        >
          <Icon icon="ph:list" className="size-4" />
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon icon="ph:user" className="size-4" />
          </span>
        </button>

        {offen && (
          <div className="absolute right-0 top-full z-[70] mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card py-2 shadow-lg">
            <Link
              href="/anmelden"
              onClick={() => setOffen(false)}
              className="block px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Anmelden oder registrieren
            </Link>
            <div className="my-1 border-t border-border" />
            <Eintrag href="/hilfe" icon="ph:question" label="Hilfe-Center" />
            <a
              href={
                process.env.NEXT_PUBLIC_GASTGEBER_URL ??
                "https://mynextdays.com"
              }
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary"
            >
              <Icon icon="ph:house-line" className="size-5 text-muted-foreground" />
              Gastgeber werden
            </a>
            <Eintrag href="/gutscheine" icon="ph:gift" label="Gutscheine" />
          </div>
        )}
      </div>
    );
  }

  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="relative flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
      >
        <Icon icon="ph:list" className="size-4" />
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {offen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-card py-2 shadow-lg">
          {name && (
            <div className="border-b border-border px-4 pb-2 pt-1">
              <p className="truncate text-sm font-semibold">{name}</p>
            </div>
          )}
          <Eintrag href="/konto" icon="ph:squares-four" label="Übersicht" />
          <Eintrag
            href="/buchungen"
            icon="ph:calendar-check"
            label="Meine Buchungen"
          />
          <Eintrag
            href="/nachrichten"
            icon="ph:chat-circle"
            label="Nachrichten"
            badge={unread}
          />
          <Eintrag href="/merkzettel" icon="ph:heart" label="Merkzettel" />
          <Eintrag href="/bewertungen" icon="ph:star" label="Bewertungen" />
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={async () => {
              await clearGuestSession();
              setOffen(false);
              router.replace("/");
              router.refresh();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:sign-out" className="size-5" />
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}

function Eintrag({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-secondary"
    >
      <span className="flex items-center gap-3">
        <Icon icon={icon} className="size-5 text-muted-foreground" />
        {label}
      </span>
      {badge && badge > 0 ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-accent-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
