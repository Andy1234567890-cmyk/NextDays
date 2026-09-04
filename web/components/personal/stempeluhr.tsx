"use client";

// Stempeluhr im Browser (Vertrag §6): Kommen / Pause / Pause beenden / Gehen
// fuer die EIGENE Person, mit laufender Uhr und der Schicht von heute.
//
// WARUM EIN SEKUNDENZAEHLER UND KEIN POLLING
// ------------------------------------------
// Die Dauer einer laufenden Stempelung ist kein Serverzustand, der sich
// aendert — sie ist `jetzt − start_at`. Ein Nachladen im Sekundentakt waere
// eine Anfrage je Sekunde fuer eine Zahl, die der Browser selbst rechnen kann.
// Nachgeladen wird nur, wenn der Nutzer stempelt (oder Realtime meldet).
//
// GPS (Regel `gps_pflicht`, Vertrag §3.3)
// ---------------------------------------
// Verlangt der Betrieb den Standort, wird er VOR dem Aufruf geholt und als
// `standort` mitgesendet. Lehnt der Nutzer ab oder kennt der Browser keine
// Geolocation, wird NICHT ohne Standort gestempelt (der Server wuerde 422
// `gps_pflicht` werfen) — die Oberflaeche sagt stattdessen klar, was fehlt.
// Kein Ersatzwert, keine Null-Koordinate (Wurzel 4).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { getOffeneZeit, zeitEnde, zeitPause, zeitStart } from "@/lib/personal";
import { laufzeit } from "@/lib/personal-betrieb-typen";
import type { KommendeSchicht, Zeiterfassung } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { uhrzeitInZone } from "@/lib/personal-zeit";

type Standort = { lat: number; lng: number; genauigkeit_m: number | null };

/** Zeitpunkt, ab dem die laufende Uhr zaehlt: Pausenende bzw. Start. */
function ankerZeit(z: Zeiterfassung): string {
  const letzte = z.pausen.at(-1);
  if (z.zustand === "in_pause" && letzte) return letzte.start;
  if (letzte?.end) return letzte.end;
  return z.start_at;
}

export function Stempeluhr({
  initial,
  zone,
  objekte,
  schichtHeute,
  gpsPflicht,
  gpsRadiusM,
  onGestempelt,
}: {
  /** Offene Stempelung beim Laden der Seite (`GET /zeiterfassung/offen`). */
  initial: Zeiterfassung | null;
  zone: string;
  objekte: { id: string; title: string }[];
  /** Schicht der eigenen Person heute — aus der Uebersicht, nicht geraten. */
  schichtHeute: KommendeSchicht | null;
  gpsPflicht: boolean;
  gpsRadiusM: number;
  /** Damit der Aufrufer seine Listen nachziehen kann (Zeiten, Summen). */
  onGestempelt?: () => void;
}) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [offen, setOffen] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [objekt, setObjekt] = useState(initial?.property_id ?? "");
  const [notiz, setNotiz] = useState("");
  const [sekunden, setSekunden] = useState(0);
  const [gpsStand, setGpsStand] = useState<"aus" | "laedt" | "ok" | "fehler">("aus");

  // Laufende Uhr: EIN Intervall, das nur den Zaehler hochsetzt.
  const anker = offen ? Date.parse(ankerZeit(offen)) : 0;
  useEffect(() => {
    if (!offen) {
      setSekunden(0);
      return;
    }
    const tick = () => setSekunden(Math.max(0, (Date.now() - anker) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offen, anker]);

  const nachladen = useCallback(async () => {
    const res = await getOffeneZeit();
    if (res.ok) setOffen(res.data);
    onGestempelt?.();
    router.refresh();
  }, [onGestempelt, router]);

  /** Standort holen — nur wenn der Betrieb ihn verlangt. */
  const standortHolen = useCallback(async (): Promise<Standort | null | "abgelehnt"> => {
    if (!gpsPflicht) return null;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStand("fehler");
      toast.error(t("stempeluhr.gpsNichtVerfuegbar"));
      return "abgelehnt";
    }
    setGpsStand("laedt");
    try {
      const pos = await new Promise<GeolocationPosition>((ok, fehler) => {
        navigator.geolocation.getCurrentPosition(ok, fehler, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        });
      });
      setGpsStand("ok");
      const genau = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
      toast.success(t("stempeluhr.gpsOk", { genauigkeit: genau ?? "?" }));
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, genauigkeit_m: genau };
    } catch {
      // Ablehnung, Timeout und „position unavailable" enden hier gleich: es gibt
      // keinen Standort. Fail-CLOSED statt ohne zu stempeln.
      setGpsStand("fehler");
      toast.error(t("stempeluhr.gpsAbgelehnt"));
      return "abgelehnt";
    }
  }, [gpsPflicht, t]);

  function fehlerZeigen(error: string, code: unknown) {
    if (typeof code === "string") {
      // Fehlercodes des Vertrags uebersetzen; unbekannte Codes zeigen die
      // Servermeldung, statt sie zu verschlucken (Wurzel 5).
      const schluessel = `fehlercode.${code}`;
      const text = t.has(schluessel) ? t(schluessel) : error;
      toast.error(text);
      return;
    }
    toast.error(error);
  }

  async function starten() {
    setBusy(true);
    const ort = await standortHolen();
    if (ort === "abgelehnt") {
      setBusy(false);
      return;
    }
    const res = await zeitStart({
      schicht_id: schichtHeute?.id ?? null,
      property_id: objekt || null,
      standort: ort,
      notiz: notiz.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return fehlerZeigen(res.error, res.details?.code);
    setOffen(res.data);
    setNotiz("");
    toast.success(t("stempeluhr.gestartet"));
    void nachladen();
  }

  async function pause(beenden: boolean) {
    setBusy(true);
    const res = await zeitPause(beenden);
    setBusy(false);
    if (!res.ok) return fehlerZeigen(res.error, res.details?.code);
    setOffen(res.data);
    toast.success(beenden ? t("stempeluhr.pauseBeendet") : t("stempeluhr.pauseGestartet"));
    void nachladen();
  }

  async function beenden() {
    setBusy(true);
    const ort = await standortHolen();
    if (ort === "abgelehnt") {
      setBusy(false);
      return;
    }
    const res = await zeitEnde({ standort: ort, notiz: notiz.trim() || null });
    setBusy(false);
    if (!res.ok) return fehlerZeigen(res.error, res.details?.code);
    setOffen(null);
    setNotiz("");
    toast.success(t("stempeluhr.beendet"));
    void nachladen();
  }

  const laeuft = offen?.zustand === "laeuft";
  const inPause = offen?.zustand === "in_pause";

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">{t("stempeluhr.titel")}</h2>
          <p className="text-sm text-muted-foreground">
            {offen
              ? inPause
                ? t("stempeluhr.inPause", { zeit: laufzeit(sekunden) })
                : t("stempeluhr.laeuft", { zeit: laufzeit(sekunden) })
              : t("stempeluhr.nichtGestempelt")}
          </p>
        </div>
        {offen && (
          <div className="text-right text-sm">
            <p className="font-display text-2xl font-extrabold tabular-nums">{laufzeit(sekunden)}</p>
            <p className="text-xs text-muted-foreground">
              {t("stempeluhr.seit", { uhrzeit: uhrzeitInZone(offen.start_at, zone) })}
              {offen.pause_minuten > 0
                ? ` · ${t("stempeluhr.pauseSumme", { minuten: offen.pause_minuten })}`
                : ""}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm">
        {schichtHeute ? (
          <p>
            <Icon icon="ph:calendar-check" className="mr-1 inline size-4" />
            <span className="font-medium">{t("stempeluhr.schichtHeute")}:</span>{" "}
            {uhrzeitInZone(schichtHeute.start_at, zone)}–{uhrzeitInZone(schichtHeute.end_at, zone)}
            {schichtHeute.property_title ? ` · ${schichtHeute.property_title}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("stempeluhr.keineSchichtHeute")}</p>
        )}
      </div>

      {gpsPflicht && (
        <p className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <Icon icon="ph:map-pin" className="size-4" />
          <span>{t("stempeluhr.gpsPflicht")}</span>
          <span>{t("stempeluhr.gpsRadius", { meter: gpsRadiusM })}</span>
          {gpsStand === "laedt" && <span className="font-medium">{t("stempeluhr.gpsHolen")}</span>}
          {gpsStand === "fehler" && (
            <span className="font-medium text-destructive">{t("fehlercode.gps_pflicht")}</span>
          )}
        </p>
      )}

      {!offen && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("stempeluhr.objekt")}</span>
            <NativeSelect value={objekt} onChange={(e) => setObjekt(e.target.value)}>
              <option value="">{t("stempeluhr.objektWaehlen")}</option>
              {objekte.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("stempeluhr.notiz")}</span>
            <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={200} />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!offen && (
          <Button className="rounded-full" size="lg" disabled={busy} onClick={starten}>
            <Icon icon="ph:play" className="mr-1 size-5" />
            {t("stempeluhr.start")}
          </Button>
        )}
        {laeuft && (
          <>
            <Button variant="outline" className="rounded-full" size="lg" disabled={busy} onClick={() => pause(false)}>
              <Icon icon="ph:pause" className="mr-1 size-5" />
              {t("stempeluhr.pause")}
            </Button>
            <Button className="rounded-full" size="lg" disabled={busy} onClick={beenden}>
              <Icon icon="ph:stop" className="mr-1 size-5" />
              {t("stempeluhr.ende")}
            </Button>
          </>
        )}
        {inPause && (
          <>
            <Button className="rounded-full" size="lg" disabled={busy} onClick={() => pause(true)}>
              <Icon icon="ph:play" className="mr-1 size-5" />
              {t("stempeluhr.pauseEnde")}
            </Button>
            <Button variant="outline" className="rounded-full" size="lg" disabled={busy} onClick={beenden}>
              <Icon icon="ph:stop" className="mr-1 size-5" />
              {t("stempeluhr.ende")}
            </Button>
          </>
        )}
      </div>

      {offen?.end_at === null && offen.netto_minuten > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("stempeluhr.netto", { stunden: stunden(offen.netto_minuten) })}
        </p>
      )}
      {offen?.notiz && <p className="mt-1 text-xs text-muted-foreground">{offen.notiz}</p>}
    </section>
  );
}
