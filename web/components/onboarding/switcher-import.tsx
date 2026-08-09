"use client";

// Wechselkunden-Import ("Switcher"): ein Betrieb, der bereits auf Booking.com/
// Airbnb & Co. verkauft, migriert seine BESTEHENDEN Listings zu myNextDays —
// NICHT neu getippt, sondern über die Portale importiert.
//
// Belegter Branchen-Ablauf (Channex + Guesty/Hostaway/Lodgify/Smoobu/Cloudbeds/
// SiteMinder, recherchiert): es gibt KEINEN Ein-Klick-Struktur-Import. Der Weg
// ist IMMER: PMS-Objekt-Hülle anlegen → Portal verbinden → OTA-Zimmer/Raten 1:1
// dem Objekt zuordnen → Buchungen/Verfügbarkeit ziehen automatisch nach. Genau
// eine Quelle je Kanal (Doppelbuchungsschutz): das alte System VOR dem Verbinden
// vom Kanal trennen bzw. dort die Verfügbarkeit schließen; vergangene Buchungen
// und manuelle Sperren kommen NICHT automatisch mit → manuell nachtragen.
//
// AUSNAHME AIRBNB: Dort muss der Kunde die Hülle NICHT selbst anlegen. Channex
// verlangt für die Airbnb-Autorisierung zwar zwingend ein Objekt
// (`connection_link` ohne Property → 422, live geprüft), aber dieses EINE legt
// der Server an und füllt es aus dem ersten Listing; jedes weitere Listing wird
// ein eigenes Objekt. Schritt 1 ist für Airbnb-Wechsler also optional.
//
// Wiederverwendete Bausteine (nichts neu erfunden):
//  - NewPropertyButton: Objekt-Hülle (erzeugt Room-Type + Rate-Plan zum Mappen)
//  - ChannelConnectButton: Verbinden + 1:1-Mapping (Credential ODER Airbnb-OAuth);
//    triggert im Backend automatisch den historischen Buchungs-/ARI-Import
//  - uebernehmeAirbnbListings: Airbnb-Listings über den Channex-Proxy als Objekte
//    holen (Airbnb führt die Inhalte, nicht Channex)
//  - reconcileTenant: Channex-Properties der ÜBRIGEN Portale in die DB spiegeln
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { NewPropertyButton } from "@/components/objekte/new-property-button";
import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@nextdays/ui/button";
import type { AccommodationType } from "@/lib/api";
import {
  type CsvImportResult,
  type LodgifyPreview,
  getCsvTemplate,
  importBookingsCsv,
  importExistingBookings,
  importLodgifyBookings,
  previewLodgifyImport,
  reconcileTenant,
  uebernehmeAirbnbListings,
} from "@/lib/channex";
import { Input } from "@nextdays/ui/input";
import { getOnboarding, updateOnboarding } from "@/lib/onboarding";
import { listProperties } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

export function SwitcherImport({
  accommodationType,
}: {
  accommodationType?: AccommodationType | null;
}) {
  const t = useTranslations("onboarding.switch");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [propertyCount, setPropertyCount] = useState<number | null>(null);
  const [channelsDone, setChannelsDone] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const [bookingMsg, setBookingMsg] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  // Lodgify-Import (nur lesend). Der Key bleibt im lokalen State, geht nur im
  // Request mit und wird NICHT gespeichert.
  const [lodgifyKey, setLodgifyKey] = useState("");
  const [lodgifyPreview, setLodgifyPreview] = useState<LodgifyPreview | null>(null);
  const [lodgifyResult, setLodgifyResult] = useState<CsvImportResult | null>(null);
  const [lodgifyError, setLodgifyError] = useState<string | null>(null);
  const [cutoverAck, setCutoverAck] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Objektzahl laden (Fortschritt: hat der Nutzer schon Hüllen angelegt/importiert?).
  function refreshCount() {
    void listProperties().then((res) => {
      if (res.ok) setPropertyCount(res.data.items.length);
    });
  }

  // Ist schon ein Portal verbunden? Serverseitig aus `channex_property_map`
  // gemessen (nicht aus einem Client-Flag). Ohne diese Abfrage stand Schritt 2
  // auch dann noch als offen da, wenn der Kanal längst hing und 18 Objekte
  // registriert waren — der Kunde verband deshalb immer wieder neu.
  function refreshChannels() {
    void getOnboarding().then((res) => {
      if (res.ok) setChannelsDone(res.data.channels_done);
    });
  }

  useEffect(() => {
    refreshCount();
    refreshChannels();
  }, []);

  // Realtime: neu importierte/angelegte Objekte sofort zählen (kein manuelles Reload).
  useRealtime({ table: "properties", onChange: refreshCount });
  // channex_property_map ist für authenticated gesperrt (Wurzel 6, Migration
  // 0337) — die Portal-Kennungen des Betriebs sind Vertriebsdaten (§4.3). Ein
  // Abo darauf liefert kein Event mehr, und keine offene Tabelle bildet die
  // Registrierung eines Objekts bei einem Portal ab: ein Umhängen auf
  // properties wäre ein stiller Ersatz, denn das Objekt existiert dort längst,
  // bevor es übertragen wird. Ersatzlos gestrichen.
  // Entfällt: der Haken an Schritt 2 erscheint nicht mehr von selbst, sobald
  // die Übertragung im Hintergrund durchläuft. Das properties-Abo darüber
  // bleibt und zählt neu importierte Objekte weiterhin live; die Übernahme in
  // dieser Oberfläche ruft refreshChannels() nach ihrer eigenen Aktion.

  // Objekte von den Portalen holen. ZWEI Wege, weil die Portale sich
  // unterscheiden (beide live geprüft, siehe airbnb_uebernahme.py):
  //  - Airbnb: Listings werden bei Channex nur GEMAPPT (`mapping_mode:
  //    "listing"`), es entstehen dort KEINE Properties. Die Übernahme liest sie
  //    über den Channex-Proxy direkt von Airbnb.
  //  - übrige Portale: Channex führt echte Properties, die der Reconcile
  //    spiegelt.
  // Zuerst die Airbnb-Übernahme, dann der Reconcile — so kommt der Kunde mit
  // einem Klick an beides, ohne den Unterschied kennen zu müssen. Ein Fehler im
  // Airbnb-Teil (z.B. „noch nicht verbunden") darf den Reconcile nicht
  // verhindern; gemeldet wird, was zusammen herauskam.
  function pullFromPortals() {
    setReconcileMsg(null);
    startTransition(async () => {
      const uebernahme = await uebernehmeAirbnbListings();
      const reconcile = await reconcileTenant();

      if (!uebernahme.ok && !reconcile.ok) {
        setReconcileMsg(reconcile.error);
        return;
      }
      const n =
        (uebernahme.ok ? uebernahme.data.created + uebernahme.data.updated : 0) +
        (reconcile.ok ? reconcile.data.created + reconcile.data.updated : 0);
      setReconcileMsg(t("pull.result", { count: n }));
      refreshCount();
    });
  }

  // Bestehende OTA-Buchungen der verbundenen Objekte einlesen (einmalig). Ehrlich:
  // includePast holt, was Channex kennt — echte Alt-Buchungen von vor dem Connect
  // sind über Channex ggf. nicht mehr abrufbar (belegt, Channex-Doku).
  function importBookings() {
    setBookingMsg(null);
    startTransition(async () => {
      const res = await importExistingBookings(includePast);
      if (!res.ok) {
        setBookingMsg(res.error);
        return;
      }
      setBookingMsg(t("bookings.result", { count: res.data.saved }));
    });
  }

  // CSV-Vorlage herunterladen (Alt-/Direkt-/vergangene Buchungen).
  function downloadTemplate() {
    setCsvError(null);
    startTransition(async () => {
      const res = await getCsvTemplate();
      if (!res.ok) {
        setCsvError(res.error);
        return;
      }
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "buchungen-vorlage.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Ausgefüllte CSV hochladen: Datei als Text lesen, an den Import schicken.
  function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erneutes Hochladen derselben Datei erlauben
    if (!file) return;
    setCsvError(null);
    setCsvResult(null);
    startTransition(async () => {
      const text = await file.text();
      const res = await importBookingsCsv(text);
      if (!res.ok) {
        setCsvError(res.error);
        return;
      }
      setCsvResult(res.data);
      refreshCount();
    });
  }

  // Lodgify: Vorschau holen (nur lesen). Zeigt, was ankommt, bevor importiert wird.
  function previewLodgify() {
    setLodgifyError(null);
    setLodgifyResult(null);
    startTransition(async () => {
      const res = await previewLodgifyImport({
        apiKey: lodgifyKey,
        includePast: includePast,
      });
      if (!res.ok) {
        setLodgifyError(res.error);
        return;
      }
      setLodgifyPreview(res.data);
    });
  }

  // Lodgify: importieren (schreibt Reservierungen; Dedup lodgify:<id>).
  function importLodgify() {
    setLodgifyError(null);
    startTransition(async () => {
      const res = await importLodgifyBookings({
        apiKey: lodgifyKey,
        includePast: includePast,
      });
      if (!res.ok) {
        setLodgifyError(res.error);
        return;
      }
      setLodgifyResult(res.data);
      refreshCount();
    });
  }

  function finish() {
    setFinishError(null);
    startTransition(async () => {
      // "Fertig" darf NICHT allein aus der Objektzahl kommen (das erzeugte den
      // verbotenen halben Channex-Zustand: abgeschlossen, obwohl kein Objekt bei
      // den Portalen registriert ist). channels_done wird serverseitig aus der
      // echten Registrierung (channex_property_map) abgeleitet — daran gaten.
      const status = await getOnboarding();
      if (!status.ok || !status.data.channels_done) {
        setFinishError(t("finish.notRegistered"));
        return;
      }
      await updateOnboarding({
        imported_from_ota: (propertyCount ?? 0) > 0,
        completed: true,
      });
      router.replace("/objekte");
      router.refresh();
    });
  }

  const hasProperties = (propertyCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Cutover-Warnung ZUERST — Doppelbuchungsschutz ist der kritische Teil.
          Sie warnt VOR dem Verbinden; ist bereits verbunden, ist sie Rückblick
          und wird eingeklappt. Der Pflicht-Haken entfällt dann, sonst hätte der
          Kunde eine Vorab-Warnung bestätigen müssen, die längst überholt ist. */}
      {channelsDone ? (
        <details className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            {t("cutover.doneTitle")}
          </summary>
          <ul className="mt-3 flex flex-col gap-2 pl-1">
            {["a", "b", "c"].map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Icon icon="ph:dot-outline" className="mt-0.5 size-4 shrink-0" />
                <span>{t(`cutover.${k}`)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <Icon icon="ph:warning-circle" className="size-5" />
            {t("cutover.title")}
          </div>
          <ul className="flex flex-col gap-2 pl-1">
            {["a", "b", "c"].map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Icon icon="ph:dot-outline" className="mt-0.5 size-4 shrink-0" />
                <span>{t(`cutover.${k}`)}</span>
              </li>
            ))}
          </ul>
          <label className="mt-1 flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={cutoverAck}
              onChange={(e) => setCutoverAck(e.target.checked)}
            />
            {t("cutover.ack")}
          </label>
        </div>
      )}

      {/* Schritt 1: Objekt-Hülle je Bestands-Listing */}
      <ImportStep
        n={1}
        title={t("step1.title")}
        text={t("step1.text")}
        done={hasProperties}
      >
        <NewPropertyButton accommodationType={accommodationType} />
        {propertyCount !== null && (
          <span className="text-sm text-muted-foreground">
            {t("step1.count", { count: propertyCount })}
          </span>
        )}
        {/* Airbnb-Wechsler müssen hier nichts tun — die Objekte entstehen beim
            Verbinden. Ohne diesen Hinweis liest sich Schritt 1 als Pflicht und
            genau das wollte der Kunde nicht: alles neu anlegen. Ist ein Portal
            schon verbunden, ist der Hinweis erledigt und stand nur noch als
            Aufforderung da, obwohl die Objekte längst da waren. */}
        {!channelsDone && (
          <p className="basis-full text-sm text-muted-foreground">
            <Icon icon="ph:info" className="mr-1 inline size-4 align-[-0.15em]" />
            {t("step1.airbnbHint")}
          </p>
        )}
      </ImportStep>

      {/* Schritt 2: Portal verbinden + 1:1 zuordnen (importiert Buchungen/ARI) */}
      <ImportStep
        n={2}
        title={t("step2.title")}
        text={t("step2.text")}
        done={channelsDone}
      >
        <ChannelConnectButton
          label={channelsDone ? t("step2.connectMore") : t("step2.connect")}
          onDone={() => {
            refreshCount();
            refreshChannels();
          }}
        />
        {/* Airbnb-OAuth: Listings erscheinen automatisch — als Objekte holen. */}
        <Button
          variant="outline"
          onClick={pullFromPortals}
          disabled={pending}
        >
          <Icon
            icon={pending ? "ph:spinner" : "ph:cloud-arrow-down"}
            className={pending ? "size-4 animate-spin" : "size-4"}
          />
          {t("pull.button")}
        </Button>
        {reconcileMsg && (
          <span className="text-sm text-muted-foreground">{reconcileMsg}</span>
        )}
        {/* Sonst liest sich der Schritt wie „noch nichts passiert" und der Kunde
            verbindet dasselbe Portal ein zweites Mal. */}
        {channelsDone && (
          <p className="basis-full text-sm text-muted-foreground">
            <Icon
              icon="ph:check-circle"
              className="mr-1 inline size-4 align-[-0.15em] text-emerald-600"
            />
            {t("step2.alreadyConnected")}
          </p>
        )}
      </ImportStep>

      {/* Schritt 3: Bestehende Buchungen einlesen (einmalig). */}
      <ImportStep n={3} title={t("bookings.title")} text={t("bookings.text")}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
            />
            {t("bookings.includePast")}
          </label>
          {/* Ehrliche Grenze: vergangene Buchungen sind über die Portale nur
              begrenzt abrufbar (Channex kennt i.d.R. nur ab Verbindung). */}
          <p className="text-xs text-muted-foreground">
            {t("bookings.pastHint")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={importBookings} disabled={pending}>
              <Icon
                icon={pending ? "ph:spinner" : "ph:calendar-check"}
                className={pending ? "size-4 animate-spin" : "size-4"}
              />
              {t("bookings.button")}
            </Button>
            {bookingMsg && (
              <span className="text-sm text-muted-foreground">{bookingMsg}</span>
            )}
          </div>
        </div>
      </ImportStep>

      {/* Schritt 4: CSV-Import für Alt-/Direkt-/vergangene Buchungen, die NICHT
          über die OTA-API kommen (Vorlage → ausfüllen → hochladen). */}
      <ImportStep n={4} title={t("csv.title")} text={t("csv.text")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              disabled={pending}
            >
              <Icon icon="ph:download-simple" className="size-4" />
              {t("csv.downloadTemplate")}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/50">
              <Icon icon="ph:upload-simple" className="size-4" />
              {t("csv.upload")}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onCsvFile}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t("csv.hint")}</p>
          {csvError && (
            <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {csvError}
            </p>
          )}
          {csvResult && (
            <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3 text-sm">
              <span className="font-medium">
                {t("csv.result", {
                  imported: csvResult.imported,
                  total: csvResult.total_rows,
                })}
              </span>
              {csvResult.skipped > 0 && (
                <span className="text-muted-foreground">
                  {t("csv.skipped", { count: csvResult.skipped })}
                </span>
              )}
              {csvResult.failed > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-amber-700">
                    {t("csv.failed", { count: csvResult.failed })}
                  </span>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                    {csvResult.errors.slice(0, 50).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </ImportStep>

      {/* Schritt 5: Buchungen aus dem alten PMS Lodgify per Lese-API-Key holen. */}
      <ImportStep n={5} title={t("lodgify.title")} text={t("lodgify.text")}>
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1.5 sm:max-w-md">
            <label className="text-sm font-medium">{t("lodgify.keyLabel")}</label>
            <Input
              type="password"
              value={lodgifyKey}
              onChange={(e) => setLodgifyKey(e.target.value)}
              placeholder={t("lodgify.keyPlaceholder")}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t("lodgify.keyHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={previewLodgify}
              disabled={pending || !lodgifyKey.trim()}
            >
              <Icon
                icon={pending ? "ph:spinner" : "ph:eye"}
                className={pending ? "size-4 animate-spin" : "size-4"}
              />
              {t("lodgify.preview")}
            </Button>
            {lodgifyPreview && (
              <Button onClick={importLodgify} disabled={pending}>
                <Icon icon="ph:download-simple" className="size-4" />
                {t("lodgify.import", { count: lodgifyPreview.importable })}
              </Button>
            )}
          </div>
          {lodgifyError && (
            <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {lodgifyError}
            </p>
          )}
          {lodgifyPreview && !lodgifyResult && (
            <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3 text-sm">
              <span className="font-medium">
                {t("lodgify.previewResult", {
                  importable: lodgifyPreview.importable,
                  total: lodgifyPreview.total,
                })}
              </span>
              {lodgifyPreview.items.length > 0 && (
                <ul className="max-h-48 overflow-y-auto text-xs text-muted-foreground">
                  {lodgifyPreview.items.slice(0, 30).map((it) => (
                    <li
                      key={it.external_id}
                      className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"
                    >
                      <span className="truncate">
                        {it.guest_name || "—"} · {it.arrival} → {it.departure}
                      </span>
                      <span className="shrink-0">{it.source ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {lodgifyResult && (
            <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3 text-sm">
              <span className="font-medium">
                {t("lodgify.result", {
                  imported: lodgifyResult.imported,
                  total: lodgifyResult.total_rows,
                })}
              </span>
              {lodgifyResult.failed > 0 && (
                <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-amber-700">
                  {lodgifyResult.errors.slice(0, 30).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </ImportStep>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          {/* Ist schon verbunden, gibt es die Ankreuzbox nicht mehr — dann darf
              sie den Abschluss auch nicht sperren. */}
          <Button
            onClick={finish}
            disabled={pending || !(cutoverAck || channelsDone) || !hasProperties}
          >
            {t("finishCta")}
          </Button>
          {!cutoverAck && !channelsDone && (
            <span className="self-center text-sm text-muted-foreground">
              {t("finishHint")}
            </span>
          )}
        </div>
        {finishError && (
          <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {finishError}
          </p>
        )}
      </div>
    </div>
  );
}

function ImportStep({
  n,
  title,
  text,
  done,
  children,
}: {
  n: number;
  title: string;
  text: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span
          className={
            done
              ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold"
          }
        >
          {done ? <Icon icon="ph:check-bold" className="size-4" /> : n}
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">{text}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-10">{children}</div>
    </div>
  );
}
