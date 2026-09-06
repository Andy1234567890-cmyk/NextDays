"use client";

// Schlösser verwalten (/channels/schloesser) — Verbinden, Geräte, Zuordnung.
//
// ABLAUF DES VERBINDENS (wie bei WhatsApp, aus demselben Grund):
//  1. „Schloss-Konto verbinden" holt vom Server eine Seam-Connect-Webview-URL
//     und öffnet sie in einem EIGENEN Tab.
//  2. Der Betrieb meldet sich dort bei SEINEM Hersteller an (igloohome, Nuki,
//     …). Wir sehen das Passwort nie — deshalb gibt es hier auch kein Feld
//     für Zugangsdaten.
//  3. Seam leitet auf diese Seite zurück, mit `?webview_id=…`.
//  4. Der erste Render tauscht die Kennung gegen das verbundene Konto ein und
//     holt gleich die Geräte.
//
// WAS DIESE OBERFLÄCHE VOR ALLEM LEISTEN MUSS: die Widerrufbarkeit ehrlich
// anzeigen. Ein igloohome-Schloss ohne Bridge kann einen ausgegebenen Code
// NICHT zurückziehen — wer hier „Storno entfernt den Code" suggeriert,
// verkauft Sicherheit, die es nicht gibt. Deshalb trägt jedes Gerät seinen
// Hinweis, und `can_revoke === null` („unbekannt") wird als eigener Zustand
// gezeigt, nicht zu „nein" verdichtet.
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  gleicheGeraeteAb,
  ladeGeraete,
  ladeVerbindungen,
  loeseZuordnung,
  pruefeSchlossdienst,
  starteVerbindung,
  trenneVerbindung,
  uebernehmeVerbindung,
} from "@/lib/schloesser-api";
import type {
  SchlossGeraet,
  SchlossPruefung,
  SchlossVerbindung,
} from "@/lib/schloesser-typen";

import { GeraetZuordnen } from "./geraet-zuordnen";

const VERBUNDEN_KANAL = "schloesser-onboarding";

/** Herstellername für die Anzeige. Seams Kennungen sind klein und mit
 *  Unterstrich; der Betrieb kennt seine Marke anders geschrieben. */
const MARKEN: Record<string, string> = {
  igloohome: "igloohome",
  nuki: "Nuki",
  ttlock: "TTLock",
  salto: "Salto",
  salto_ks: "Salto KS",
  yale: "Yale",
  august: "August",
  schlage: "Schlage",
  kwikset: "Kwikset",
  tedee: "Tedee",
  akiles: "Akiles",
  lockly: "Lockly",
  smartthings: "SmartThings",
  wyze: "Wyze",
  ultraloq: "Ultraloq",
  keynest: "KeyNest",
  dormakaba_oracode: "dormakaba Oracode",
};

function markenName(code: string | null): string {
  if (!code) return "Unbekannter Hersteller";
  return MARKEN[code] ?? code;
}

export function SchloesserVerwaltung() {
  const router = useRouter();
  const params = useSearchParams();
  const webviewId = params.get("webview_id");

  const [pruefung, setPruefung] = useState<SchlossPruefung | null>(null);
  const [verbindungen, setVerbindungen] = useState<SchlossVerbindung[]>([]);
  const [geraete, setGeraete] = useState<SchlossGeraet[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [startet, setStartet] = useState(false);
  const [uebernimmt, setUebernimmt] = useState(false);
  // Gegen den doppelten Aufruf im Strict-Mode und gegen Doppelklick (Wurzel 2).
  const uebernommen = useRef<string | null>(null);

  const laden = useCallback(async () => {
    const [p, v, g] = await Promise.all([
      pruefeSchlossdienst(),
      ladeVerbindungen(),
      ladeGeraete(),
    ]);
    setPruefung(p.ok ? p.data : { ok: false, grund: p.error });
    setVerbindungen(v.ok ? v.data : []);
    setGeraete(g.ok ? g.data : []);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  useEffect(() => {
    if (!webviewId || uebernommen.current === webviewId) return;
    uebernommen.current = webviewId;
    setUebernimmt(true);
    void (async () => {
      const res = await uebernehmeVerbindung(webviewId);
      if (!res.ok) {
        toast.error(res.error);
      } else if (res.data.status === "pending") {
        // Kein Fehler: die Anmeldung beim Hersteller ist noch nicht fertig.
        toast.info("Die Anmeldung beim Hersteller ist noch nicht abgeschlossen.");
      } else {
        toast.success("Schloss-Konto verbunden.");
        new BroadcastChannel(VERBUNDEN_KANAL).postMessage("verbunden");
      }
      await laden();
      setUebernimmt(false);
      // Kennung aus der Adressleiste entfernen: ein Reload würde sie sonst
      // erneut einlösen wollen.
      router.replace("/channels/schloesser");
    })();
  }, [webviewId, router, laden]);

  useEffect(() => {
    const kanal = new BroadcastChannel(VERBUNDEN_KANAL);
    kanal.onmessage = () => void laden();
    return () => kanal.close();
  }, [laden]);

  // KEIN Realtime-Abo auf `seam_device`/`seam_connection`: beide Tabellen sind
  // für `authenticated` bewusst gesperrt (0573, Wurzel 6 — dort hängen
  // Geräte-Kennungen und der Türcode). Ein Abo darauf wäre eine stumme
  // Attrappe: die Seite sähe live aus und aktualisierte nie. Zustandswechsel
  // kommen über Seams Webhook in die DB und erscheinen beim nächsten Laden
  // bzw. nach „Geräte neu holen".

  async function verbinden() {
    setStartet(true);
    const rueckkehr = `${window.location.origin}/channels/schloesser`;
    const res = await starteVerbindung(rueckkehr);
    setStartet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Eigener Tab: der Hersteller verlangt einen Login, und der Betrieb soll
    // sein myNextDays-Fenster behalten.
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  async function abgleichen(connectionId: string) {
    const res = await gleicheGeraeteAb(connectionId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.anzahl === 1
        ? "1 Schloss gefunden."
        : `${res.data.anzahl} Schlösser gefunden.`,
    );
    await laden();
  }

  async function trennen(connectionId: string) {
    const res = await trenneVerbindung(connectionId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Verbindung getrennt.");
    await laden();
  }

  if (uebernimmt) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        Verbindung wird abgeschlossen …
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Der Dienst selbst — ist der Schlüssel hinterlegt und welcher? */}
      <DienstZustand pruefung={pruefung} laedt={laedt} />

      {/* Verbundene Konten */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-extrabold">
              Schloss-Konten
            </h2>
            <p className="text-sm text-muted-foreground">
              Der Betrieb verbindet sein eigenes Konto beim Hersteller. Die
              Anmeldung läuft beim Hersteller selbst — Zugangsdaten werden hier
              nicht eingegeben und nicht gespeichert.
            </p>
          </div>
          <Button onClick={() => void verbinden()} disabled={startet}>
            {startet ? (
              <Icon icon="svg-spinners:180-ring" className="size-4" />
            ) : (
              <Icon icon="ph:plugs" className="size-4" />
            )}
            Schloss-Konto verbinden
          </Button>
        </div>

        {laedt ? (
          <p className="mt-4 text-sm text-muted-foreground">Wird geladen …</p>
        ) : verbindungen.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Noch kein Schloss-Konto verbunden. Unterstützt werden unter anderem
            igloohome, Nuki, TTLock, Salto, Yale, Tedee und KeyNest.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {verbindungen.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    icon={
                      v.status === "connected"
                        ? "ph:plugs-connected"
                        : "ph:plugs"
                    }
                    className={`size-5 ${
                      v.status === "connected"
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {v.display_name || markenName(v.provider)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.status === "connected"
                        ? "Verbunden"
                        : v.status === "pending"
                          ? "Anmeldung nicht abgeschlossen"
                          : v.status === "error"
                            ? v.error_code || "Der Hersteller meldet ein Problem"
                            : "Getrennt"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void abgleichen(v.id)}
                  >
                    <Icon icon="ph:arrows-clockwise" className="size-4" />
                    Geräte neu holen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void trennen(v.id)}
                  >
                    Trennen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Geräte samt Zuordnung */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-base font-extrabold">Schlösser</h2>
        <p className="text-sm text-muted-foreground">
          Jedes Schloss gehört entweder zu einer Einheit (die Tür dieser
          Einheit) oder zu einem Gebäude (Gemeinschaftstür, etwa der
          Hauseingang). Ein Gast bekommt EINEN Code für alle Türen, die er
          braucht.
        </p>

        {laedt ? (
          <p className="mt-4 text-sm text-muted-foreground">Wird geladen …</p>
        ) : geraete.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Noch keine Schlösser. Nach dem Verbinden auf „Geräte neu holen"
            klicken.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {geraete.map((g) => (
              <GeraetZeile
                key={g.id}
                geraet={g}
                onGeaendert={() => void laden()}
                onZuordnungLoesen={async (id) => {
                  const res = await loeseZuordnung(id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Zuordnung entfernt.");
                  await laden();
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DienstZustand({
  pruefung,
  laedt,
}: {
  pruefung: SchlossPruefung | null;
  laedt: boolean;
}) {
  if (laedt || !pruefung) return null;

  if (!pruefung.ok) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <Icon
            icon="ph:warning"
            className="mt-0.5 size-5 shrink-0 text-amber-600"
          />
          <div>
            <p className="text-sm font-semibold">
              Der Schloss-Dienst ist nicht einsatzbereit
            </p>
            <p className="text-sm text-muted-foreground">
              {pruefung.grund ||
                "Die Verbindung zum Schloss-Dienst konnte nicht geprüft werden."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Der Testbereich ist der gefährliche Fall: alles sieht aus wie im Betrieb,
  // aber die Codes öffnen keine echte Tür. Deshalb WARNEN, nicht nur anzeigen.
  if (pruefung.istSandbox) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <Icon
            icon="ph:flask"
            className="mt-0.5 size-5 shrink-0 text-amber-600"
          />
          <div>
            <p className="text-sm font-semibold">Testbereich aktiv</p>
            <p className="text-sm text-muted-foreground">
              Dieser Zugang läuft auf einem Testbereich des Schloss-Dienstes.
              Erzeugte Codes öffnen KEINE echten Schlösser — gut zum Ausprobieren,
              nicht für Gäste.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function GeraetZeile({
  geraet,
  onGeaendert,
  onZuordnungLoesen,
}: {
  geraet: SchlossGeraet;
  onGeaendert: () => void;
  onZuordnungLoesen: (zuordnungId: string) => Promise<void>;
}) {
  const [zuordnen, setZuordnen] = useState(false);

  // Die drei Zustände von `can_revoke` getrennt behandeln — `null` ist nicht
  // `false`, und beides ist nicht `true`.
  const widerruf =
    geraet.can_revoke === true
      ? {
          icon: "ph:shield-check",
          farbe: "text-emerald-600",
          text: "Codes können jederzeit zurückgezogen werden.",
        }
      : geraet.can_revoke === false
        ? {
            icon: "ph:shield-warning",
            farbe: "text-amber-600",
            text:
              "Codes können NICHT vorzeitig zurückgezogen werden — bei einer " +
              "Stornierung gilt der Code bis zum Ende des Zeitraums weiter. " +
              "Eine Bridge des Herstellers würde das ändern.",
          }
        : {
            icon: "ph:shield-question",
            farbe: "text-muted-foreground",
            // Typografische Anführungszeichen NICHT im String-Literal: das
            // schließende beendet den String vorzeitig (Projektregel, hier
            // prompt wieder passiert). Im Text stehen deshalb einfache.
            text:
              "Ob Codes zurückgezogen werden können, ist unbekannt. Bis das " +
              "geklärt ist, wird eine Stornierung als ‚läuft weiter‘ geführt.",
          };

  return (
    <li className="rounded-2xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon icon="ph:lock-key" className="mt-0.5 size-5" />
          <div>
            <p className="text-sm font-semibold">
              {geraet.display_name || "Schloss"}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {/* „offline" ist bei Offline-Schlössern der NORMALFALL, kein
                  Fehler — beide Referenz-PMS erklären das in eigenen FAQ, weil
                  es sonst als Störung gemeldet wird. */}
              {geraet.online === false && geraet.is_offline_capable ? (
                <span>Ohne Netz (bei diesem Schloss normal)</span>
              ) : geraet.online === false ? (
                <span className="text-amber-600">Nicht erreichbar</span>
              ) : geraet.online === true ? (
                <span>Erreichbar</span>
              ) : null}
              {typeof geraet.battery_level === "number" && (
                <span>Batterie {Math.round(geraet.battery_level * 100)} %</span>
              )}
              {geraet.capacity_total !== null && (
                <span>Platz für {geraet.capacity_total} Codes</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setZuordnen(true)}>
          <Icon icon="ph:link" className="size-4" />
          Zuordnen
        </Button>
      </div>

      <p
        className={`mt-3 flex items-start gap-2 text-xs ${widerruf.farbe}`}
      >
        <Icon icon={widerruf.icon} className="mt-0.5 size-4 shrink-0" />
        {widerruf.text}
      </p>

      {geraet.zuordnungen.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {geraet.zuordnungen.map((z) => (
            <li
              key={z.id}
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
            >
              <Icon
                icon={z.unit_id ? "ph:door" : "ph:buildings"}
                className="size-3.5"
              />
              {z.unit_id ? "Einheit" : "Gemeinschaftstür"}
              <button
                type="button"
                onClick={() => void onZuordnungLoesen(z.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Zuordnung entfernen"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {zuordnen && (
        <GeraetZuordnen
          deviceId={geraet.id}
          onFertig={() => {
            setZuordnen(false);
            onGeaendert();
          }}
          onAbbrechen={() => setZuordnen(false)}
        />
      )}
    </li>
  );
}
