"use client";

// Kanal-zentrierte Übersicht der Channel-Manager-Seite: kategorisierte Karten
// (Buchungsportale · eigener Marktplatz · Suchmaschinen · iCal) mit echtem
// Marken-Logo und Status-Badge (verbunden / X Objekte / verbinden). Struktur
// nach dem Channel-Manager-Muster (Lodgify als UX-Referenz), Optik im
// myNextDays-Branding: abgerundete Karten, semantische Tokens, keine Hardcodes.
// Die Zahlen kommen aus GET /channel-manager/overview (tenant-lokal, DB-aggregiert).
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";

import { channelLogo } from "@/lib/channel-logos";
import {
  getWhatsAppOnboardingStatus,
  type WhatsAppOnboardingStatus,
} from "@/lib/whatsapp-api";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nextdays/ui/popover";
import type {
  ChannelOverview,
  OtaChannelOverview,
} from "@/lib/channex";
import { pinChannel } from "@/lib/channex";

// Die zwei prominenten OTAs, die immer als Karte stehen (Marktplatz kommt als
// eigene Sektion). Der Rest erscheint nur, wenn verbunden/gepinnt — sonst im
// „Kanal hinzufügen"-Dropdown.
const PROMINENT_OTA = new Set(["BookingCom", "AirBNB"]);

// Echtes Original-Logo aus der zentralen Map (lib/channel-logos) ODER kein Icon
// (kein generisches Ersatz-Symbol — ausdrückliche Nutzer-Vorgabe).
function otaLogo(c: OtaChannelOverview): { src?: string; icon?: string } {
  const src = channelLogo(c.code);
  return src ? { src } : {};
}

function ChannelLogo({
  src,
  srcDark,
  alt,
}: {
  src?: string;
  // Optionales Dark-Mode-Logo (z.B. helle Wortmarke auf dunklem Grund).
  srcDark?: string;
  alt: string;
}) {
  if (src) {
    return (
      <>
        <Image
          // Marken-Logos liegen als SVG vor; der Bild-Optimierer lehnt SVG ab
          // (HTTP 400) — deshalb unverändert ausliefern.
          unoptimized
          src={src}
          alt={alt}
          width={200}
          height={54}
          style={{ height: "auto", width: "auto" }}
          className={
            "h-[2.75rem] w-auto max-w-[70%] object-contain " +
            (srcDark ? "dark:hidden" : "")
          }
        />
        {srcDark && (
          <Image
            // Marken-Logos liegen als SVG vor; der Bild-Optimierer lehnt SVG ab
            // (HTTP 400) — deshalb unverändert ausliefern.
            unoptimized
            src={srcDark}
            alt={alt}
            width={200}
            height={54}
            style={{ height: "auto", width: "auto" }}
            className="hidden h-[2.75rem] w-auto max-w-[70%] object-contain dark:block"
          />
        )}
      </>
    );
  }
  // Kein echtes Logo → nur der Name (kein generisches Ersatz-Icon, Nutzer-Vorgabe).
  return <span className="font-display text-lg font-bold">{alt}</span>;
}

// Eine Kanal-Karte: Status-Punkt oben, Logo mittig, Badge unten.
function ChannelCard({
  logo,
  alt,
  connected,
  badge,
  href,
  connectLabel,
}: {
  // Nur echte Marken-SVGs. Ohne Logo zeigt die Karte den Namen (siehe
  // ChannelLogo) — ein `icon`-Feld gab es hier einmal, es wurde aber nie
  // gerendert und täuschte an den Aufrufstellen ein Symbol vor, das nie kam.
  logo?: { src?: string; srcDark?: string };
  alt: string;
  connected: boolean;
  badge: string;
  href: string;
  connectLabel: string;
}) {
  return (
    // Ganze Karte klickbar → Kanal-Detailseite (Lodgify-Muster). Ein Link statt
    // nur der Button, damit auch der VERBUNDENE Zustand navigierbar ist.
    <Link href={href} className="group block focus:outline-none">
      <Card className="flex min-h-[13rem] flex-col justify-between gap-4 p-5 transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <span
          className={
            "size-2.5 rounded-full " +
            (connected ? "bg-emerald-500" : "bg-muted-foreground/30")
          }
          aria-hidden
        />
        <div className="flex flex-1 items-center justify-center">
          <ChannelLogo src={logo?.src} srcDark={logo?.srcDark} alt={alt} />
        </div>
        {connected ? (
          <span className="rounded-lg bg-emerald-50 py-2 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {badge}
          </span>
        ) : (
          <span className="rounded-full bg-foreground py-2 text-center text-sm font-medium text-background transition-opacity group-hover:opacity-90">
            {connectLabel}
          </span>
        )}
      </Card>
    </Link>
  );
}

function CategoryHeading({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

// „Kanal hinzufügen"-Karte: öffnet ein durchsuchbares Dropdown mit den übrigen
// Kanälen. Auswahl pinnt den Kanal (erscheint danach als Karte) und navigiert
// zu seiner Detailseite zum Verbinden.
function AddChannelCard({
  channels,
  addChannel,
  searchChannel,
  noResults,
}: {
  channels: OtaChannelOverview[];
  addChannel: string;
  searchChannel: string;
  noResults: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? channels.filter((c) => c.label.toLowerCase().includes(q))
      : channels;
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [channels, query]);

  function add(code: string) {
    startTransition(async () => {
      await pinChannel(code);
      setOpen(false);
      setQuery("");
      router.push(`/channels/${code}`);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-[13rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-5 text-muted-foreground transition-colors hover:bg-secondary/40"
        >
          <Icon icon="ph:plus-circle" className="size-8" />
          <span className="text-sm font-medium">{addChannel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchChannel}
          className="mb-2"
        />
        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-2 text-sm text-muted-foreground">{noResults}</li>
          ) : (
            filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => add(c.code)}
                  disabled={pending}
                  className="flex w-full items-center gap-3 rounded-(--radius) p-2 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {otaLogo(c).src && (
                    <Image
                      // Marken-Logos liegen als SVG vor; der Bild-Optimierer lehnt SVG ab
                      // (HTTP 400) — deshalb unverändert ausliefern.
                      unoptimized
                      src={otaLogo(c).src as string}
                      alt={c.label}
                      width={24}
                      height={24}
                      className="size-6 shrink-0 object-contain"
                    />
                  )}
                  <span className="truncate">{c.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ChannelGrid({ overview }: { overview: ChannelOverview | null }) {
  const t = useTranslations("channels");

  if (!overview) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">{t("loadError")}</Card>
    );
  }

  // Nur prominente + verbundene + gepinnte OTAs als Karten; der lange Rest liegt
  // im „Kanal hinzufügen"-Dropdown (keine ewige Kachelwand).
  const shownOtas = overview.ota.filter(
    (c) => PROMINENT_OTA.has(c.code) || c.connected_count > 0 || c.pinned,
  );
  const hiddenOtas = overview.ota.filter((c) => !shownOtas.includes(c));

  return (
    <div className="flex flex-col gap-8">
      {/* Buchungsportale */}
      <section className="flex flex-col gap-3">
        <CategoryHeading>{t("categoryOta")}</CategoryHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shownOtas.map((c) => (
            <ChannelCard
              key={c.code}
              // Bekannte OTAs mit echtem Original-Logo (SVG); alle anderen mit
              // dem Icon aus dem Backend-Katalog (kein hartes Default).
              logo={otaLogo(c)}
              alt={c.label}
              connected={c.connected_count > 0}
              badge={t("syncedCount", { count: c.connected_count })}
              href={`/channels/${c.code}`}
              connectLabel={t("connect")}
            />
          ))}
          {hiddenOtas.length > 0 && (
            <AddChannelCard
              channels={hiddenOtas}
              addChannel={t("addChannel")}
              searchChannel={t("searchChannel")}
              noResults={t("noResults")}
            />
          )}
        </div>
      </section>

      {/* Eigener Marktplatz */}
      <section className="flex flex-col gap-3">
        <CategoryHeading>{t("categoryMarketplace")}</CategoryHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChannelCard
            logo={{
              src: "/marketing/brand/mybestdays-logo.png",
              srcDark: "/marketing/brand/mybestdays-logo-light.png",
            }}
            alt={overview.marketplace.label}
            connected={overview.marketplace.listed_count > 0}
            badge={t("listedCount", {
              count: overview.marketplace.listed_count,
            })}
            href="/objekte"
            connectLabel={t("connect")}
          />
        </div>
      </section>

      {/* Direkter Gästekanal — eigene WhatsApp-Nummer des Betriebs. Bewusst
          eigene Kategorie: das ist kein Buchungsportal (es kommen keine
          Buchungen darüber), sondern der Kommunikationsweg zum Gast. */}
      <section className="flex flex-col gap-3">
        <CategoryHeading>{t("categoryMessaging")}</CategoryHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WhatsAppKanalKarte
            connectLabel={t("connect")}
            connectedLabel={t("connected")}
          />
        </div>
      </section>

      {/* iCal-Kalender-Sync */}
      <section className="flex flex-col gap-3">
        <CategoryHeading>{t("categoryIcal")}</CategoryHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChannelCard
            alt={overview.ical.label}
            connected={overview.ical.synced_count > 0}
            badge={t("icalSynced", { count: overview.ical.synced_count })}
            href="/objekte"
            connectLabel={t("connect")}
          />
        </div>
      </section>
    </div>
  );
}


/** WhatsApp-Karte. Holt den Kanal-Zustand des Betriebs selbst (whatsapp-Slice),
 *  damit der Channex-Overview nichts über WhatsApp wissen muss. Solange geladen
 *  wird, zeigt die Karte „nicht verbunden" — das ist der häufigere Fall und
 *  vermeidet ein Aufblitzen des falschen Zustands. */
function WhatsAppKanalKarte({
  connectLabel,
  connectedLabel,
}: {
  connectLabel: string;
  connectedLabel: string;
}) {
  const [status, setStatus] = useState<WhatsAppOnboardingStatus | null>(null);

  useEffect(() => {
    void getWhatsAppOnboardingStatus().then((r) =>
      setStatus(r.ok ? r.data : null),
    );
  }, []);

  const verbunden = Boolean(status?.connected);
  return (
    <ChannelCard
      logo={{
        src: "/channels/whatsapp.svg",
        srcDark: "/channels/whatsapp-light.svg",
      }}
      alt="WhatsApp"
      connected={verbunden}
      badge={status?.display_phone_number || connectedLabel}
      href="/channels/whatsapp"
      connectLabel={connectLabel}
    />
  );
}
