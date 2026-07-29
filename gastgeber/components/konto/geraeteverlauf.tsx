"use client";

// Geräteverlauf (Airbnb „Login & Sicherheit → Geräteverlauf"): Liste der aktiven
// Sitzungen mit Gerät/Browser (aus dem User-Agent), Ort-Hinweis (IP), letztem
// Zugriff und „Abmelden" pro Gerät + „Auf allen anderen Geräten abmelden".
//
// Kein Realtime: auth.sessions liegt bewusst NICHT in der supabase_realtime-
// Publication (Sicherheitsgrenze). Nach eigenen Aktionen wird die Liste
// inkrementell im State gepflegt (kein Reload, kein Polling).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormatierung } from "@/lib/formatierung";
import {
  type GeraetSitzung,
  ladeSitzungen,
  widerrufeAndereSitzungen,
  widerrufeSitzung,
} from "@/lib/konto-actions";

export function Geraeteverlauf() {
  const t = useTranslations("konto");
  const f = useFormatierung();
  const [sitzungen, setSitzungen] = useState<GeraetSitzung[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAlle, setBusyAlle] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void ladeSitzungen().then((res) => {
      if (!aktiv) return;
      if (res.ok) setSitzungen(res.sitzungen);
      else setFehler(res.error);
    });
    return () => {
      aktiv = false;
    };
  }, []);

  async function abmelden(id: string) {
    setBusyId(id);
    setFehler(null);
    const res = await widerrufeSitzung(id);
    setBusyId(null);
    if (res.ok) {
      setSitzungen((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } else {
      setFehler(res.error);
    }
  }

  async function alleAnderen() {
    setBusyAlle(true);
    setFehler(null);
    const res = await widerrufeAndereSitzungen();
    setBusyAlle(false);
    if (res.ok) {
      setSitzungen((prev) => prev?.filter((s) => s.is_current) ?? null);
    } else {
      setFehler(res.error);
    }
  }

  if (sitzungen === null && !fehler) {
    return (
      <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
        {t("geraeteLaedt")}
      </div>
    );
  }

  const andere = sitzungen?.filter((s) => !s.is_current).length ?? 0;

  return (
    <div className="space-y-3">
      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {(sitzungen ?? []).map((s) => (
          <li key={s.id} className="flex items-center gap-4 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon icon={geraetIcon(s.user_agent)} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {geraetName(s.user_agent, t)}
                {s.is_current ? (
                  <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {t("geraeteDieses")}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[ort(s.city, s.country), s.ip, zeit(s.last_seen_at, t, f)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {s.is_current ? null : (
              <button
                type="button"
                onClick={() => void abmelden(s.id)}
                disabled={busyId === s.id}
                className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
              >
                {busyId === s.id ? t("geraeteAbmeldenLaeuft") : t("geraeteAbmelden")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {andere > 0 ? (
        <button
          type="button"
          onClick={() => void alleAnderen()}
          disabled={busyAlle}
          className="text-sm font-medium text-destructive underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
        >
          {busyAlle ? t("geraeteAlleLaeuft") : t("geraeteAlleAbmelden")}
        </button>
      ) : null}
    </div>
  );
}

// --- User-Agent → menschenlesbar (bewusst simpel, keine externe Lib) ---------

function geraetName(
  ua: string | null,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!ua) return t("geraeteUnbekannt");
  const browser = erkenne(ua, [
    ["Edg/", "Edge"],
    ["OPR/", "Opera"],
    ["Chrome/", "Chrome"],
    ["Firefox/", "Firefox"],
    ["Safari/", "Safari"],
  ]);
  const os = erkenne(ua, [
    ["Windows", "Windows"],
    ["Mac OS X", "macOS"],
    ["iPhone", "iPhone"],
    ["iPad", "iPad"],
    ["Android", "Android"],
    ["Linux", "Linux"],
  ]);
  // API-/Skript-Clients (curl, httpx) ehrlich als solche zeigen, nicht raten.
  if (!browser && !os) return ua.split("/")[0] || ua;
  return [browser, os].filter(Boolean).join(" · ") || ua;
}

function geraetIcon(ua: string | null): string {
  if (!ua) return "solar:devices-linear";
  if (/iPhone|Android.*Mobile|iPad/.test(ua)) return "solar:smartphone-linear";
  if (/Windows|Mac OS X|Linux/.test(ua)) return "solar:laptop-linear";
  return "solar:code-square-linear";
}

function erkenne(ua: string, paare: [string, string][]): string | null {
  for (const [nadel, name] of paare) {
    if (ua.includes(nadel)) return name;
  }
  return null;
}

function zeit(
  iso: string | null,
  t: ReturnType<typeof useTranslations>,
  f: ReturnType<typeof useFormatierung>,
): string {
  if (!iso) return "";
  return t("geraeteZuletzt", {
    datum: f.datum(iso, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
}

// Ort aus Stadt/Land — nur zeigen, was da ist (kein Fake-Ort, Wurzel 4).
// "Stadt, Land" / nur "Land" / "" — leer wird beim join weggelassen.
function ort(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(", ");
}
