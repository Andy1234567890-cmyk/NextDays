"use client";

// Linke Kanal-Navigation der Detailfläche (Lodgify-Muster). Prominent stehen die
// drei wichtigsten Kanäle fix: Booking.com, Airbnb und die eigene Plattform
// (Marktplatz). Alle weiteren Kanäle (52 im Channex-Katalog) stecken NICHT als
// ewige Liste in der Sidebar, sondern werden über ein durchsuchbares Dropdown
// „Kanal hinzufügen" ausgewählt — der gewählte Kanal wird gepinnt (gemerkt) und
// erscheint danach als eigene Zeile. Verbundene Kanäle zählen ebenfalls als
// Zeile. Daten aus GET /channel-manager/overview.
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { channelLogo } from "@/lib/channel-logos";
import { Input } from "@nextdays/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nextdays/ui/popover";
import type { ChannelOverview, OtaChannelOverview } from "@/lib/channex";
import { pinChannel } from "@/lib/channex";

// Die prominenten Kanäle, die immer fix in der Sidebar stehen.
const PROMINENT_OTA = new Set(["BookingCom", "AirBNB"]);

function logoFor(c: OtaChannelOverview): { src?: string } {
  const src = channelLogo(c.code);
  return src ? { src } : {};
}

// Echtes Original-Logo ODER nichts (kein generisches Ersatz-Icon, Nutzer-Vorgabe).
function SmallLogo({
  logo,
  alt,
}: {
  logo: { src?: string };
  alt: string;
}) {
  if (!logo.src) return null;
  return (
    <Image
      // Marken-Logos liegen als SVG vor; der Bild-Optimierer lehnt SVG ab
      // (HTTP 400) — deshalb unverändert ausliefern.
      unoptimized
      src={logo.src}
      alt={alt}
      width={28}
      height={28}
      className="size-7 shrink-0 object-contain"
    />
  );
}

function ChannelRow({
  href,
  logo,
  label,
  connected,
  active,
  connectedLabel,
  notConnectedLabel,
  wartetLabel,
}: {
  href: string;
  logo: { src?: string; icon?: string };
  label: string;
  connected: boolean;
  active: boolean;
  connectedLabel: string;
  notConnectedLabel: string;
  // Eigener Marktplatz: gelistet, aber die Freigabe des Betreibers fehlt noch.
  // Nur auswerten, wenn `connected` false ist — „nicht verbunden" wäre hier
  // falsch, der Betrieb hat alles getan.
  wartetLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-3 rounded-(--radius) border p-3 transition-colors " +
        (active
          ? "border-foreground bg-secondary"
          : "border-transparent hover:bg-secondary/60")
      }
    >
      <SmallLogo logo={logo} alt={label} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        {/* „Verbunden" meint die KANAL-Verbindung, nicht die Zuordnung der
            Objekte — so hält es Lodgify auch (dort steht „Verbunden" grün,
            während in der Tabelle daneben jede Zeile „Nicht synchronisiert"
            zeigt). Vorher hing dieser Text an `connected_count` (Objekte mit
            LAUFENDEM Abgleich); ein verbundenes Airbnb-Konto stand deshalb als
            „Nicht verbunden" da, und der Betrieb verband es immer wieder neu. */}
        <span
          className={
            "text-xs " +
            (connected
              ? "text-emerald-600"
              : wartetLabel
                ? "text-amber-600"
                : "text-muted-foreground")
          }
        >
          {connected ? connectedLabel : (wartetLabel ?? notConnectedLabel)}
        </span>
      </div>
    </Link>
  );
}

function Category({ children }: { children: string }) {
  return (
    <h3 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function ChannelSidebar({
  overview,
  activeCode,
  labels,
}: {
  overview: ChannelOverview;
  activeCode: string;
  labels: {
    allChannels: string;
    categoryOta: string;
    categoryMarketplace: string;
    marketplaceWaiting: string;
    categoryIcal: string;
    connected: string;
    notConnected: string;
    addChannel: string;
    searchChannel: string;
    noResults: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Prominente + verbundene + gepinnte Kanäle als feste Zeilen; der Rest liegt
  // im „Kanal hinzufügen"-Dropdown.
  const shownOtas = overview.ota.filter(
    (c) =>
      PROMINENT_OTA.has(c.code) ||
      c.connected_count > 0 ||
      // Bestehende Verbindung ohne laufenden Abgleich zählt auch — sonst
      // verschwindet ein verbundenes Konto aus der Leiste.
      c.linked_count > 0 ||
      c.pinned,
  );
  const hiddenOtas = overview.ota.filter((c) => !shownOtas.includes(c));

  const filteredHidden = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? hiddenOtas.filter((c) => c.label.toLowerCase().includes(q))
      : hiddenOtas;
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [hiddenOtas, query]);

  function addChannel(code: string) {
    startTransition(async () => {
      await pinChannel(code);
      setOpen(false);
      setQuery("");
      router.push(`/channels/${code}`);
    });
  }

  return (
    <nav className="flex flex-col gap-2">
      <Link
        href="/channels"
        className="flex items-center gap-2 rounded-(--radius) p-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
      >
        <Icon icon="ph:squares-four" className="size-5" />
        {labels.allChannels}
      </Link>

      <Category>{labels.categoryOta}</Category>
      {shownOtas.map((c) => (
        <ChannelRow
          key={c.code}
          href={`/channels/${c.code}`}
          logo={logoFor(c)}
          label={c.label}
          // Kanal-Verbindung, nicht Zuordnung: `linked_count` zählt, sobald das
          // Konto verbunden ist (Lodgify-Verhalten, siehe ChannelRow).
          connected={c.connected_count > 0 || c.linked_count > 0}
          active={c.code === activeCode}
          connectedLabel={labels.connected}
          notConnectedLabel={labels.notConnected}
        />
      ))}

      {/* „Kanal hinzufügen" — durchsuchbares Dropdown für die übrigen Kanäle */}
      {hiddenOtas.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-(--radius) border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60"
            >
              <Icon icon="ph:plus" className="size-5" />
              {labels.addChannel}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchChannel}
              className="mb-2"
            />
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {filteredHidden.length === 0 ? (
                <li className="p-2 text-sm text-muted-foreground">
                  {labels.noResults}
                </li>
              ) : (
                filteredHidden.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => addChannel(c.code)}
                      disabled={pending}
                      className="flex w-full items-center gap-3 rounded-(--radius) p-2 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      <SmallLogo logo={logoFor(c)} alt={c.label} />
                      <span className="truncate">{c.label}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>
      )}

      {/* Eigene Plattform (Marktplatz) — dritter prominenter Kanal */}
      <Category>{labels.categoryMarketplace}</Category>
      <ChannelRow
        href="/objekte"
        logo={{ src: "/marketing/brand/mybestdays-logo.png" }}
        label={overview.marketplace.label}
        // Grün nur bei WIRKLICH sichtbaren (freigegebenen) Objekten; wartende
        // Freigaben sind ein eigener Zustand, kein „nicht verbunden".
        connected={overview.marketplace.listed_count > 0}
        active={false}
        connectedLabel={labels.connected}
        notConnectedLabel={labels.notConnected}
        wartetLabel={
          overview.marketplace.pending_count > 0
            ? labels.marketplaceWaiting
            : undefined
        }
      />

      {/* iCal-Kalender-Sync */}
      <Category>{labels.categoryIcal}</Category>
      <ChannelRow
        href="/objekte"
        logo={{ icon: "ph:calendar-dots-duotone" }}
        label={overview.ical.label}
        connected={overview.ical.synced_count > 0}
        active={false}
        connectedLabel={labels.connected}
        notConnectedLabel={labels.notConnected}
      />
    </nav>
  );
}
