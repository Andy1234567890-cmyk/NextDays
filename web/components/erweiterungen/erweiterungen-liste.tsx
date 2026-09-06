"use client";

// Erweiterungen (/erweiterungen) — Kachel-Raster der buchbaren Zusatzmodule.
// UI-Vorbild ist der Lodgify-Marktplatz: gleich große Kacheln, Logo-/Icon-Fläche
// oben, unten Name mit Preis-Badge rechts und eine Zeile Beschreibung. Klick
// öffnet die Detailseite mit „Aktivieren" — genau wie dort.
//
// Preise kommen aus getPricing() (Stripe bzw. Server-Satz), der gebuchte Zustand
// aus getSubscriptionStatus(). Nichts hier hardcoden (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getMe } from "@/lib/auth";
import { ERWEITERUNGEN, preisAnzeige } from "@/lib/erweiterungen";
import {
  kennungAusModulKey,
  LOGO_BRAUCHT_DUNKEL,
} from "@/lib/schloss-anbieter";
import {
  getPricing,
  getSubscriptionStatus,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { HILFE_URL } from "@/lib/marketing-url";

type Loaded = {
  canManage: boolean;
  pricing: Pricing | null;
  status: SubscriptionStatus | null;
  error: string | null;
};

export function ErweiterungenListe() {
  const locale = useLocale();
  const [state, setState] = useState<Loaded | null>(null);

  const load = useCallback(async () => {
    const me = await getMe();
    const canManage = me?.capabilities.includes("manage_billing") ?? false;
    if (!me || !canManage) {
      setState({
        canManage,
        pricing: null,
        status: null,
        error: null,
      });
      return;
    }
    const [p, s] = await Promise.all([getPricing(), getSubscriptionStatus()]);
    setState({
      canManage: true,
      pricing: p.ok ? p.data : null,
      status: s.ok ? s.data : null,
      // Fehler zeigen, nicht verschlucken (Wurzel 5).
      error: !p.ok ? p.error : !s.ok ? s.error : null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Kein Realtime mehr: `tenant_module_entitlement` und `tenant_subscription`
  // sind für authenticated bewusst gesperrt (Wurzel 6, Migration 0337: revoke +
  // raus aus supabase_realtime), Abos darauf wären stumme Attrappen. Eine
  // offene Tabelle, die dieselben Ereignisse trägt, gibt es nicht. Ehrlich
  // benannt: gebuchte oder gekündigte Module erscheinen in dieser Übersicht
  // erst beim nächsten Laden — auch die, die der Stripe-Webhook serverseitig
  // schreibt. Gebucht/gekündigt wird auf der Detailseite der Erweiterung, der
  // Rückweg hierher lädt die Liste ohnehin neu.
  // Mit den Abos entfällt auch das bisher nur dafür gehaltene tenantId.

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        Erweiterungen werden geladen …
      </div>
    );
  }

  if (!state.canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Zum Buchen von Erweiterungen fehlt dir die Berechtigung.
      </p>
    );
  }

  const aktiv = new Set(
    (state.status?.modules ?? []).filter((m) => m.active).map((m) => m.module_key),
  );

  return (
    <div className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ERWEITERUNGEN.map((e) => {
          const preis = preisAnzeige(
            state.pricing?.modules.find((m) => m.module_key === e.moduleKey),
            state.pricing?.currency ?? "",
            locale,
          );
          return (
            <Link
              key={e.slug}
              href={`/erweiterungen/${e.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20"
            >
              {/* Logo-Fläche. Bei Schloss-Anbietern das Marken-SVG, sonst
                  das Symbol des Moduls. Fehlt die Logodatei, zeigt die Kachel
                  den MARKENNAMEN — bewusst kein selbst gezeichnetes Logo: ein
                  nachgebautes Hersteller-Logo ist kein Original, und die
                  Rechte liegen beim Hersteller. */}
              <div
                className={
                  "flex h-24 items-center justify-center " +
                  (dunkleFlaeche(e.moduleKey) ? "bg-zinc-900" : "bg-muted/50")
                }
              >
                <MarkenFlaeche
                  logo={e.logo}
                  icon={e.icon}
                  name={e.name}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-sm font-extrabold">
                    {e.name}
                  </span>
                  {aktiv.has(e.moduleKey) ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                      Aktiv
                    </span>
                  ) : preis ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {preis.kurz}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{e.untertitel}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Lodgify schließt den Marktplatz mit einem Vorschlagskasten ab — bei uns
          führt er in den Live-Chat, den es hier schon gibt (kein neues Formular). */}
      <div className="rounded-2xl bg-muted/50 p-5">
        <div className="font-display text-base font-extrabold">
          Nicht das, was Sie brauchen?
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Wir bauen laufend weiter. Schreiben Sie uns, was Ihnen fehlt — über den
          Support-Chat im Konto-Menü oder{" "}
          <a href={HILFE_URL} className="underline" target="_blank" rel="noopener noreferrer">
            im Hilfe-Center
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/** Trägt das ORIGINAL-Logo dieser Marke weiße Schrift, braucht die Fläche
 *  einen dunklen Grund — sonst ist das Logo auf der hellen Kachel unsichtbar.
 *  Das Logo selbst bleibt unangetastet; Umfärben wäre ein Eingriff in die
 *  Marke. Betroffen ist nur, wer keine dunkle Fassung veröffentlicht. */
function dunkleFlaeche(moduleKey: string): boolean {
  const kennung = kennungAusModulKey(moduleKey);
  return kennung !== null && LOGO_BRAUCHT_DUNKEL.includes(kennung);
}

function MarkenFlaeche({
  logo,
  icon,
  name,
}: {
  logo?: string | null;
  icon: string;
  name: string;
}) {
  // `fehlt` statt eines serverseitigen Dateichecks: der Katalog soll nicht
  // wissen müssen, welche Dateien im public-Ordner liegen. Der Browser sagt
  // es uns über `onError`, und bis dahin ist die Fläche leer statt falsch.
  const [fehlt, setFehlt] = useState(false);

  if (!logo || fehlt) {
    // Der MARKENNAME steht hier immer, auch wenn es gar keine Logodatei gibt
    // (`logo === null`, weil für diese Marke kein Original beschaffbar war).
    // Vorher hing er an `logo &&` — genau im dokumentierten Fall zeigte die
    // Kachel also nur ein anonymes Schloss-Symbol.
    return (
      <div className="flex flex-col items-center gap-2">
        <Icon icon={icon} className="size-10 text-foreground" />
        <span className="font-display text-sm font-extrabold">{name}</span>
      </div>
    );
  }
  // Lokale Logodatei, keine Remote-URL: `next/image` würde 31 kleine
  // Markendateien durch den Optimizer schicken, ohne etwas zu sparen — und
  // `onError` (der Rückfall auf den Markennamen) braucht das rohe <img>.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      className="max-h-12 max-w-[60%] object-contain"
      onError={() => setFehlt(true)}
    />
  );
}
