"use client";

// Eigene, inhouse Verbinden-Maske (KEIN externer iFrame, kein Provider sichtbar).
// 3-Schritt-Assistent nach Channex-Best-Practice (über unseren Backend-Slice):
//   1) Portal wählen + Zugangsdaten (z. B. Hotel-ID) eingeben
//   2) Zimmer/Raten des Portals den eigenen Preisplänen zuordnen
//   3) Verbinden — Backend legt an + aktiviert (Schritt prepare→connect)
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ChannelMapping,
  type LocalRatePlanOption,
  type OtaRoom,
  type StoredChannelConnection,
  type SupportedPortal,
  beginChannelOAuth,
  connectChannel,
  finalizeOAuthChannel,
  getChannelOAuthStatus,
  listChannelConnections,
  listPortals,
  prepareChannel,
} from "@/lib/channex";
import { listProperties } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

// "oauth" = Airbnb-Verbindung über OAuth-URL (kein Credential): URL öffnen oder
// an den Eigentümer kopieren, dann auf Verbindung warten und Mapping setzen.
type Step = "portal" | "credentials" | "oauth" | "mapping" | "done";

// Eine Zeile in der Zuordnungs-Tabelle: ein OTA-Zimmer+Rate → ein Preisplan.
type MappingRow = {
  room_type_code: number;
  rate_plan_code: number;
  roomLabel: string;
  rateLabel: string;
  pricing_type: string;
  occupancy: number;
  rate_plan_map_id: string; // gewählter lokaler Preisplan
};

export function ChannelConnectButton({
  label = "Kanäle verbinden",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "accent";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("portal");

  const [portals, setPortals] = useState<SupportedPortal[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportedPortal | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  // Bereits gespeicherte Verbindungen des gewählten Objekts (für Vorbefüllung
  // der Hotel-ID + Status-Hinweis pro Portal).
  const [connections, setConnections] = useState<StoredChannelConnection[]>([]);

  const [otaRooms, setOtaRooms] = useState<OtaRoom[]>([]);
  const [ratePlans, setRatePlans] = useState<LocalRatePlanOption[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // OAuth-Flow (Airbnb): erzeugte OAuth-URL, Verbundenheits-Status, Host-ID.
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthHostId, setOauthHostId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const [p, props] = await Promise.all([listPortals(), listProperties()]);
      if (p.ok) setPortals(p.data);
      if (props.ok && props.data.items.length > 0) {
        setPropertyId(props.data.items[0].id);
      }
    });
  }, [open]);

  // Gespeicherte Verbindungen des aktuell gewählten Objekts laden (Vorbefüllung
  // der Hotel-ID + Status-Hinweise je Portal).
  useEffect(() => {
    if (!open || !propertyId) {
      setConnections([]);
      return;
    }
    startTransition(async () => {
      const res = await listChannelConnections(propertyId);
      setConnections(res.ok ? res.data.items : []);
    });
  }, [open, propertyId]);

  function reset() {
    setStep("portal");
    setSelected(null);
    setValues({});
    setOtaRooms([]);
    setRatePlans([]);
    setRows([]);
    setError(null);
    setOauthUrl(null);
    setOauthConnected(false);
    setOauthHostId(null);
    setCopied(false);
  }

  function close() {
    setOpen(false);
    setDone(null);
    reset();
  }

  function choosePortal(portal: SupportedPortal) {
    setSelected(portal);
    setError(null);
    // OAuth-Portale (Airbnb): kein Credential — direkt in den OAuth-Flow.
    if (portal.connection_type === "oauth") {
      setValues({});
      startOAuth(portal);
      return;
    }
    // Hotel-ID aus einer bereits gespeicherten Verbindung vorbefüllen, damit der
    // Vermieter sie beim Re-Connect nicht erneut eingeben muss.
    const stored = connections.find((c) => c.portal_code === portal.code);
    const firstField = portal.fields[0]?.key;
    setValues(
      stored && firstField ? { [firstField]: stored.hotel_id } : {},
    );
    setStep("credentials");
  }

  // OAuth-Start (Airbnb): inaktiven Kanal anlegen + echte OAuth-URL holen.
  function startOAuth(portal: SupportedPortal) {
    if (!propertyId) {
      setError("Bitte zuerst ein Objekt anlegen.");
      return;
    }
    setOauthUrl(null);
    setOauthConnected(false);
    setOauthHostId(null);
    setCopied(false);
    setStep("oauth");
    startTransition(async () => {
      const res = await beginChannelOAuth({
        property_id: propertyId,
        portal_code: portal.code,
      });
      if (res.ok) {
        setOauthUrl(res.data.oauth_url);
      } else {
        setError(res.error);
      }
    });
  }

  // Status prüfen: ist die OAuth-Verbindung inzwischen aktiv (host_id da)?
  const checkOAuthStatus = useCallback(async () => {
    if (!propertyId || !selected) return;
    const res = await getChannelOAuthStatus(propertyId, selected.code);
    if (res.ok) {
      setOauthConnected(res.data.connected);
      setOauthHostId(res.data.host_id);
    }
  }, [propertyId, selected]);

  // OAuth-Link öffnen bzw. in die Zwischenablage kopieren (Self-Connect durch
  // den Eigentümer, wenn der Vermieter keinen Airbnb-Zugang hat).
  function openOAuth() {
    if (oauthUrl) window.open(oauthUrl, "_blank", "noopener,noreferrer");
  }
  async function copyOAuth() {
    if (!oauthUrl) return;
    try {
      await navigator.clipboard.writeText(oauthUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Link konnte nicht kopiert werden.");
    }
  }

  // Nach „verbunden": Mapping laden (bestehender Pfad) und finalisieren.
  function loadOAuthMapping() {
    if (!selected || !propertyId) return;
    setError(null);
    startTransition(async () => {
      const res = await prepareChannel({
        property_id: propertyId,
        portal_code: selected.code,
        settings: {},
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOtaRooms(res.data.ota_rooms);
      setRatePlans(res.data.rate_plans);
      const defaultPlan = res.data.rate_plans[0]?.rate_plan_map_id ?? "";
      const initial: MappingRow[] = [];
      for (const room of res.data.ota_rooms) {
        for (const rate of room.rates ?? []) {
          initial.push({
            room_type_code: Number(room.id),
            rate_plan_code: Number(rate.id),
            roomLabel: room.title ?? `Listing ${room.id}`,
            rateLabel: rate.title ?? `Rate ${rate.id}`,
            pricing_type: rate.pricing === "OBP" ? "OBP" : "Standard",
            occupancy: rate.max_persons ?? 2,
            rate_plan_map_id: defaultPlan,
          });
        }
      }
      setRows(initial);
      setStep("mapping");
    });
  }

  // Realtime-Pflicht: ein Verbindungs-Update (host_id geschrieben durch das
  // Status-Polling, evtl. in einer anderen Session) kommt ohne Reload an.
  const oauthWaiting = step === "oauth" && !!selected && !oauthConnected;
  useRealtime({
    table: "channex_channel_connection",
    filter: propertyId ? `property_id=eq.${propertyId}` : undefined,
    enabled: oauthWaiting,
    onChange: () => void checkOAuthStatus(),
  });

  // Fallback-Poll (Channex liefert keine Channel-Webhooks): solange der Dialog
  // im OAuth-Schritt offen und noch nicht verbunden ist, alle 5 s prüfen.
  useEffect(() => {
    if (!oauthWaiting) return;
    void checkOAuthStatus();
    const t = window.setInterval(() => void checkOAuthStatus(), 5000);
    return () => window.clearInterval(t);
  }, [oauthWaiting, checkOAuthStatus]);

  // Status-Hinweis für ein Portal in der Auswahl-Liste (verbunden/Aktion nötig).
  function connectionFor(code: string): StoredChannelConnection | undefined {
    return connections.find((c) => c.portal_code === code);
  }

  // Schritt 1→2: Zugangsdaten prüfen + Zimmer/Raten laden.
  function loadMapping() {
    if (!selected || !propertyId) {
      setError("Bitte zuerst ein Objekt anlegen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await prepareChannel({
        property_id: propertyId,
        portal_code: selected.code,
        settings: values,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOtaRooms(res.data.ota_rooms);
      setRatePlans(res.data.rate_plans);
      // Vorbelegung: jede OTA-Zimmer/Rate-Zeile, Preisplan = erster lokaler.
      const defaultPlan = res.data.rate_plans[0]?.rate_plan_map_id ?? "";
      const initial: MappingRow[] = [];
      for (const room of res.data.ota_rooms) {
        for (const rate of room.rates ?? []) {
          initial.push({
            room_type_code: Number(room.id),
            rate_plan_code: Number(rate.id),
            roomLabel: room.title ?? `Zimmer ${room.id}`,
            rateLabel: rate.title ?? `Rate ${rate.id}`,
            pricing_type: rate.pricing === "OBP" ? "OBP" : "Standard",
            occupancy: rate.max_persons ?? 2,
            rate_plan_map_id: defaultPlan,
          });
        }
      }
      setRows(initial);
      setStep("mapping");
    });
  }

  // Schritt 2→3: Verbinden + aktivieren.
  function connect() {
    if (!selected || !propertyId) return;
    const mappings: ChannelMapping[] = rows
      .filter((r) => r.rate_plan_map_id)
      .map((r) => ({
        rate_plan_map_id: r.rate_plan_map_id,
        room_type_code: r.room_type_code,
        rate_plan_code: r.rate_plan_code,
        occupancy: r.occupancy,
        pricing_type: r.pricing_type,
        primary_occ: true,
      }));
    if (mappings.length === 0) {
      setError("Bitte mindestens eine Zuordnung treffen.");
      return;
    }
    setError(null);
    const isOAuth = selected.connection_type === "oauth";
    startTransition(async () => {
      const res = isOAuth
        ? await finalizeOAuthChannel({
            property_id: propertyId,
            portal_code: selected.code,
            mappings,
          })
        : await connectChannel({
            property_id: propertyId,
            portal_code: selected.code,
            settings: values,
            mappings,
          });
      if (res.ok) {
        setDone(`${selected.label} verbunden und aktiviert.`);
        setStep("done");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <Icon icon="ph:plugs-connected" className="size-4" />
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">
                Buchungsportal verbinden
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Schließen"
              >
                <Icon icon="ph:x" className="size-5" />
              </button>
            </div>

            {/* Schritt: DONE */}
            {step === "done" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Icon icon="ph:check-bold" className="size-6" />
                </span>
                <p className="font-medium">{done}</p>
                <p className="text-sm text-muted-foreground">
                  Verfügbarkeit und Preise werden ab sofort automatisch
                  abgeglichen.
                </p>
                <div className="flex gap-2">
                  <Button onClick={reset} variant="outline">
                    Weiteres Portal verbinden
                  </Button>
                  <Button onClick={close}>Fertig</Button>
                </div>
              </div>
            ) : step === "portal" ? (
              /* Schritt 1: Portal wählen */
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Wähle das Portal, das du verbinden möchtest:
                </p>
                <div className="grid gap-2">
                  {portals.map((p) => {
                    const conn = connectionFor(p.code);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => choosePortal(p)}
                        className="flex items-center gap-3 rounded-(--radius) border border-border p-3 text-left transition-colors hover:bg-secondary"
                      >
                        <Icon icon={p.icon} className="size-6" />
                        <span className="font-medium">{p.label}</span>
                        {conn &&
                          (conn.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Verbunden
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Aktion nötig
                            </span>
                          ))}
                        <Icon
                          icon="ph:caret-right"
                          className="ml-auto size-4 text-muted-foreground"
                        />
                      </button>
                    );
                  })}
                  {portals.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {pending ? "Lädt …" : "Keine Portale verfügbar."}
                    </p>
                  )}
                </div>
              </div>
            ) : step === "oauth" && selected ? (
              /* Schritt 2 (OAuth): Airbnb-Konto verbinden */
              <div className="flex flex-col gap-4">
                <StepBack onClick={() => setStep("portal")} text="Anderes Portal" />
                <PortalHead portal={selected} />
                <p className="text-sm text-muted-foreground">
                  Verbinde dein {selected.label}-Konto. Öffne den Link selbst –
                  oder schicke ihn dem Eigentümer, falls du keinen Zugang zum
                  Konto hast.
                </p>

                {!oauthUrl && !error && (
                  <p className="text-sm text-muted-foreground">
                    <Spinner text="Verbindung wird vorbereitet …" />
                  </p>
                )}
                {error && <ErrorBox text={error} />}

                {oauthUrl && !oauthConnected && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={openOAuth}>
                        <Icon icon="ph:arrow-square-out" className="size-4" />
                        Jetzt verbinden
                      </Button>
                      <Button onClick={copyOAuth} variant="outline">
                        <Icon
                          icon={copied ? "ph:check" : "ph:copy"}
                          className="size-4"
                        />
                        {copied ? "Link kopiert" : "Link kopieren"}
                      </Button>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon
                        icon="ph:spinner"
                        className="size-4 animate-spin"
                      />
                      Warte auf die Bestätigung über Airbnb …
                    </p>
                  </div>
                )}

                {oauthConnected && (
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <Icon icon="ph:check-circle" className="size-5" />
                      Verbunden{oauthHostId ? ` · Host-ID ${oauthHostId}` : ""}
                    </p>
                    <Button onClick={loadOAuthMapping} disabled={pending}>
                      {pending ? (
                        <Spinner text="Lade Listings …" />
                      ) : (
                        "Weiter zur Zuordnung"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : step === "credentials" && selected ? (
              /* Schritt 2: Zugangsdaten */
              <div className="flex flex-col gap-4">
                <StepBack onClick={() => setStep("portal")} text="Anderes Portal" />
                <PortalHead portal={selected} />
                {selected.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Für dieses Portal sind keine weiteren Angaben nötig.
                  </p>
                ) : (
                  selected.fields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <label htmlFor={f.key} className="text-sm font-medium">
                        {f.label}
                      </label>
                      <Input
                        id={f.key}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    </div>
                  ))
                )}
                {error && <ErrorBox text={error} />}
                <Button onClick={loadMapping} disabled={pending}>
                  {pending ? <Spinner text="Prüfe Zugang …" /> : "Weiter"}
                </Button>
              </div>
            ) : step === "mapping" && selected ? (
              /* Schritt 3: Zimmer/Raten zuordnen */
              <div className="flex flex-col gap-4">
                <StepBack
                  onClick={() => setStep("credentials")}
                  text="Zugangsdaten"
                />
                <PortalHead portal={selected} />
                {ratePlans.length === 0 ? (
                  <ErrorBox text="Für dieses Objekt sind noch keine Preispläne hinterlegt. Lege zuerst einen Preis im Kalender an." />
                ) : rows.length === 0 ? (
                  <ErrorBox text="Das Portal liefert keine Zimmer/Raten. Prüfe die Zugangsdaten." />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Ordne die Zimmer &amp; Raten des Portals deinen Preisplänen
                      zu:
                    </p>
                    <div className="flex flex-col gap-2">
                      {rows.map((r, i) => (
                        <div
                          key={`${r.room_type_code}-${r.rate_plan_code}`}
                          className="flex flex-col gap-2 rounded-(--radius) border border-border p-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{r.roomLabel}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {r.rateLabel}
                            </p>
                          </div>
                          <Icon
                            icon="ph:arrow-right"
                            className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                          />
                          <select
                            value={r.rate_plan_map_id}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((row, j) =>
                                  j === i
                                    ? { ...row, rate_plan_map_id: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded-(--radius) border border-border bg-background px-3 py-2 text-sm sm:w-56"
                          >
                            <option value="">— nicht zuordnen —</option>
                            {ratePlans.map((rp) => (
                              <option
                                key={rp.rate_plan_map_id}
                                value={rp.rate_plan_map_id}
                              >
                                {rp.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {error && <ErrorBox text={error} />}
                    <Button onClick={connect} disabled={pending}>
                      {pending ? (
                        <Spinner text="Verbinde …" />
                      ) : (
                        "Verbinden & aktivieren"
                      )}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function StepBack({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon icon="ph:arrow-left" className="size-4" />
      {text}
    </button>
  );
}

function PortalHead({ portal }: { portal: SupportedPortal }) {
  return (
    <div className="flex items-center gap-3">
      <Icon icon={portal.icon} className="size-7" />
      <span className="font-display text-lg font-bold">{portal.label}</span>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {text}
    </p>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <>
      <Icon icon="ph:spinner" className="size-4 animate-spin" />
      {text}
    </>
  );
}
