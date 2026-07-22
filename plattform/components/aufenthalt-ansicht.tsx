// Gastmodul (Client-Insel): Check-in-Infos, WLAN/Hausordnung/Anreise (de
// bevorzugt, en Fallback), Türcode (oder Hinweis warum verborgen), Self-Check-in.
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  type LocalizedText,
  type Stay,
  ladeAufenthalt,
  selfCheckIn,
} from "@/lib/guest-stay";
import { formatDate } from "@/lib/format";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; msg: string }
  | { kind: "ready"; stay: Stay };

// de bevorzugt, en als Fallback (nie erfinden) — null, wenn beides fehlt.
function textOf(t: LocalizedText): string | null {
  if (!t) return null;
  return t.de?.trim() || t.en?.trim() || null;
}

const INFO_BLOECKE: {
  key: keyof Stay["messaging"];
  icon: string;
  titel: string;
}[] = [
  { key: "check_in", icon: "ph:sign-in", titel: "Check-in" },
  { key: "door_instructions", icon: "ph:key", titel: "Zugang" },
  { key: "directions", icon: "ph:map-pin", titel: "Anreise" },
  { key: "wifi", icon: "ph:wifi-high", titel: "WLAN" },
  { key: "rules", icon: "ph:scroll", titel: "Hausordnung" },
  { key: "local_guide", icon: "ph:compass", titel: "Tipps vor Ort" },
  { key: "check_out", icon: "ph:sign-out", titel: "Check-out" },
  { key: "emergency", icon: "ph:first-aid", titel: "Notfall" },
];

export function AufenthaltAnsicht({ reservationId }: { reservationId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinFehler, setCheckinFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      const res = await ladeAufenthalt(reservationId);
      if (!aktiv) return;
      setPhase(
        res.ok
          ? { kind: "ready", stay: res.data }
          : { kind: "error", msg: res.error },
      );
    })();
    return () => {
      aktiv = false;
    };
  }, [reservationId]);

  async function checkIn() {
    setCheckinBusy(true);
    setCheckinFehler(null);
    const res = await selfCheckIn(reservationId);
    setCheckinBusy(false);
    if (res.ok) {
      // Aufenthalt neu laden, damit checked_in_at + evtl. Türcode erscheinen.
      const neu = await ladeAufenthalt(reservationId);
      if (neu.ok) setPhase({ kind: "ready", stay: neu.data });
    } else {
      setCheckinFehler(res.error);
    }
  }

  if (phase.kind === "loading") {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Icon icon="ph:spinner" className="size-5 animate-spin" />
        Aufenthalt wird geladen…
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-6 text-sm text-accent">
        {phase.msg}
      </div>
    );
  }

  const s = phase.stay;
  const eingecheckt = Boolean(s.checked_in_at);

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-48 w-full bg-secondary">
          {s.header_image_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.header_image_path}
              alt={s.property_title}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <Icon icon="ph:image" className="size-10" />
            </span>
          )}
        </div>
        <div className="p-5">
          <h2 className="font-display text-xl font-semibold">
            {s.property_title}
          </h2>
          {s.property_address && (
            <p className="text-sm text-muted-foreground">{s.property_address}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(s.check_in)} – {formatDate(s.check_out)}
          </p>
        </div>
      </div>

      {/* Self-Check-in */}
      {s.self_checkin && (
        <div className="rounded-2xl border border-border bg-card p-5">
          {eingecheckt ? (
            <div className="flex items-center gap-3 text-emerald-700">
              <Icon icon="ph:check-circle-fill" className="size-6" />
              <div>
                <p className="font-medium">Du bist eingecheckt.</p>
                <p className="text-sm text-muted-foreground">
                  Viel Freude bei deinem Aufenthalt.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium">Self-Check-in</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Checke dich selbst ein, um den Zugangscode freizuschalten.
              </p>
              {checkinFehler && (
                <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
                  {checkinFehler}
                </p>
              )}
              <button
                type="button"
                onClick={checkIn}
                disabled={checkinBusy}
                className="mt-4 flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {checkinBusy && (
                  <Icon icon="ph:spinner" className="size-4 animate-spin" />
                )}
                Jetzt einchecken
              </button>
            </>
          )}
        </div>
      )}

      {/* Türcode */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Icon icon="ph:password" className="size-5" />
          <p className="font-medium">Zugangscode</p>
        </div>
        {s.door_code ? (
          <p className="mt-3 font-display text-3xl font-semibold tracking-widest">
            {s.door_code}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {s.door_code_hidden_reason ??
              "Der Zugangscode ist derzeit nicht verfügbar."}
          </p>
        )}
      </div>

      {/* Info-Blöcke */}
      <div className="grid gap-4 sm:grid-cols-2">
        {INFO_BLOECKE.map((blk) => {
          const inhalt = textOf(s.messaging[blk.key]);
          if (!inhalt) return null;
          return (
            <div
              key={blk.key}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2">
                <Icon icon={blk.icon} className="size-5 text-muted-foreground" />
                <p className="font-medium">{blk.titel}</p>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {inhalt}
              </p>
            </div>
          );
        })}
      </div>

      {/* Kontakte */}
      {(s.contact_name || s.contact_phone || s.maintenance_phone) && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">Kontakt</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {s.contact_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon icon="ph:user" className="size-4" />
                {s.contact_name}
              </div>
            )}
            {s.contact_phone && (
              <a
                href={`tel:${s.contact_phone}`}
                className="flex items-center gap-2 hover:text-accent"
              >
                <Icon icon="ph:phone" className="size-4" />
                {s.contact_phone}
              </a>
            )}
            {s.maintenance_phone && (
              <a
                href={`tel:${s.maintenance_phone}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-accent"
              >
                <Icon icon="ph:wrench" className="size-4" />
                Haustechnik: {s.maintenance_phone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
