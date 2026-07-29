"use client";

// Linke Spalte des Posteingangs (Airbnb-Konversationsliste). Kopf: Titel + runde,
// dezente Icon-Buttons (Suche / Vorlagen). Filter im Airbnb-Muster: „Alle" als
// Dropdown-Pill (öffnet Alle/Archiviert), „Ungelesen" als eigene umrandete Pill.
// Darunter die Thread-Einträge; großzügiger Leerzustand mit „Filter zurücksetzen".
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { HostThreadSummary } from "@/lib/posteingang";

import type { Filter } from "./posteingang";

export function ThreadListe({
  threads,
  aktivId,
  filter,
  suche,
  onFilter,
  onSuche,
  onOeffne,
}: {
  threads: HostThreadSummary[];
  aktivId: string | null;
  filter: Filter;
  suche: string;
  onFilter: (f: Filter) => void;
  onSuche: (q: string) => void;
  onOeffne: (id: string) => void;
}) {
  const t = useTranslations("posteingang");
  const locale = useLocale();
  const [sucheOffen, setSucheOffen] = useState(false);
  const [menuOffen, setMenuOffen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dropdown bei Klick außerhalb schließen.
  useEffect(() => {
    if (!menuOffen) return;
    function bei(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOffen(false);
    }
    document.addEventListener("mousedown", bei);
    return () => document.removeEventListener("mousedown", bei);
  }, [menuOffen]);

  const dropdownLabel =
    filter === "archiviert" ? t("filterArchiviert") : t("filterAlle");
  const gefiltert = filter !== "alle" || suche.length > 0;

  return (
    <aside className="flex h-full flex-col border-r border-border bg-background">
      {/* Kopf */}
      <div className="flex items-center justify-between px-6 pb-1 pt-7">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight">
          {t("titel")}
        </h1>
        <div className="flex items-center gap-1.5">
          <IconButton
            label={t("suchen")}
            icon="ph:magnifying-glass"
            aktiv={sucheOffen}
            onClick={() => setSucheOffen((v) => !v)}
          />
          <Link
            href="/nachrichten/vorlagen"
            aria-label={t("vorlagenVerwalten")}
            className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:gear-six" className="size-[1.15rem]" />
          </Link>
        </div>
      </div>

      {sucheOffen && (
        <div className="px-6 pt-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 focus-within:border-foreground/40 focus-within:ring-4 focus-within:ring-muted">
            <Icon
              icon="ph:magnifying-glass"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <input
              type="search"
              value={suche}
              onChange={(e) => onSuche(e.target.value)}
              placeholder={t("suchePlatzhalter")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter (Airbnb-Muster: Dropdown-Pill + Ungelesen-Pill) */}
      <div className="flex items-center gap-2 px-6 py-4">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOffen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter !== "ungelesen"
                ? "bg-foreground text-background"
                : "border border-border text-foreground hover:border-foreground/40"
            }`}
          >
            {dropdownLabel}
            <Icon
              icon={menuOffen ? "ph:caret-up" : "ph:caret-down"}
              className="size-3.5"
            />
          </button>
          {menuOffen && (
            <div className="absolute left-0 top-12 z-20 w-64 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-xl">
              <MenuItem
                icon="ph:chat-circle"
                label={t("filterAlle")}
                aktiv={filter === "alle"}
                onClick={() => {
                  onFilter("alle");
                  setMenuOffen(false);
                }}
              />
              <MenuItem
                icon="ph:archive"
                label={t("filterArchiviert")}
                aktiv={filter === "archiviert"}
                onClick={() => {
                  onFilter("archiviert");
                  setMenuOffen(false);
                }}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onFilter(filter === "ungelesen" ? "alle" : "ungelesen")
          }
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "ungelesen"
              ? "bg-foreground text-background"
              : "border border-border text-foreground hover:border-foreground/40"
          }`}
        >
          {t("filterUngelesen")}
        </button>
      </div>

      {/* Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-16 text-center">
            <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted">
              <Icon
                icon="ph:chat-teardrop-dots"
                className="size-7 text-muted-foreground"
              />
            </span>
            <p className="text-lg font-semibold">
              {gefiltert ? t("leerGefiltertTitel") : t("leerTitel")}
            </p>
            <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
              {gefiltert ? t("leerGefiltertText") : t("leerText")}
            </p>
            {gefiltert && (
              <button
                type="button"
                onClick={() => {
                  onFilter("alle");
                  onSuche("");
                }}
                className="mt-5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
              >
                {t("filterZuruecksetzen")}
              </button>
            )}
          </div>
        ) : (
          <ul className="px-3 py-1">
            {threads.map((thread) => {
              const ungelesen = thread.unread_count > 0;
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onOeffne(thread.id)}
                    className={`flex w-full items-start gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors ${
                      aktivId === thread.id ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/60 text-[0.9375rem] font-semibold text-foreground">
                      {(thread.guest_name ?? thread.guest_email ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}
                      {ungelesen && (
                        <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-bold text-white ring-2 ring-background">
                          {thread.unread_count}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[0.9375rem] ${ungelesen ? "font-semibold text-foreground" : "font-medium text-foreground"}`}
                        >
                          {thread.guest_name ?? thread.guest_email ?? t("gast")}
                        </span>
                        <span
                          className={`shrink-0 text-xs ${ungelesen ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                        >
                          {kurzDatum(thread.last_message_at, locale, t("gestern"))}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-sm ${ungelesen ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {thread.last_message ?? t("nochKeineNachricht")}
                      </p>
                      {(thread.property_title || thread.check_in) && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {[
                            aufenthalt(thread.check_in, thread.check_out, locale),
                            thread.property_title,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function IconButton({
  label,
  icon,
  aktiv,
  onClick,
}: {
  label: string;
  icon: string;
  aktiv?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-full transition-colors ${
        aktiv ? "bg-muted text-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon icon={icon} className="size-[1.15rem]" />
    </button>
  );
}

function MenuItem({
  icon,
  label,
  aktiv,
  onClick,
}: {
  icon: string;
  label: string;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
        aktiv ? "font-semibold" : "font-medium"
      }`}
    >
      <Icon icon={icon} className="size-[1.15rem] text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {aktiv && <Icon icon="ph:check" className="size-4" />}
    </button>
  );
}

// Datum/Uhrzeit in der aktiven UI-Sprache. „Gestern" kommt übersetzt herein,
// weil die Helfer außerhalb der Komponente keinen Übersetzer haben.
function kurzDatum(
  iso: string | null,
  locale: string,
  gesternLabel: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  const heute = new Date();
  const gestern = new Date(heute);
  gestern.setDate(heute.getDate() - 1);
  if (d.toDateString() === heute.toDateString())
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === gestern.toDateString()) return gesternLabel;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function aufenthalt(
  ein: string | null,
  aus: string | null,
  locale: string,
): string {
  if (!ein) return "";
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const e = new Date(ein).toLocaleDateString(locale, opt);
  if (!aus) return e;
  const a = new Date(aus).toLocaleDateString(locale, opt);
  return `${e} – ${a}`;
}
