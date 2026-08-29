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
//  - reconcileTenant: Channex-Properties der ÜBRIGEN Portale in die DB spiegeln.
//    Läuft seit 29.08.2026 automatisch im `onDone` des Verbindens; der frühere
//    Knopf „Objekte aus Portal holen" ist weg. Airbnb-Listings holt der
//    Rücksprung selbst (`channel-connect-button.tsx`), sobald der Handshake
//    steht — dort auch der Aufruf von `uebernehmeAirbnbListings`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { NewPropertyButton } from "@/components/objekte/new-property-button";
import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { channelBrand, channelLogo } from "@/lib/channel-logos";
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
} from "@/lib/channex";
import { Input } from "@nextdays/ui/input";
import { getOnboarding, updateOnboarding } from "@/lib/onboarding";
import { useRealtime } from "@/lib/use-realtime";

/** Die Portale der Einstiegsfrage. Bewusst kurz: Airbnb, Booking und Vrbo
 *  decken den Bestand eines Ferienvermieters praktisch ab — eine Liste mit
 *  vierzig Kanälen wäre hier eine Hürde, keine Hilfe. Wer etwas anderes nutzt,
 *  verbindet es im nächsten Schritt trotzdem; die Auswahl ist ein Wegweiser.
 *
 *  Die Logos kommen aus `CHANNEL_LOGO` — nur echte, offiziell beschaffte
 *  Markenlogos, nichts Selbstgezeichnetes. */
const AUSWAHL_PORTALE = [
  { code: "AirBNB", name: "Airbnb", logo: channelLogo("AirBNB") },
  { code: "BookingCom", name: "Booking.com", logo: channelLogo("BookingCom") },
  { code: "Vrbo", name: "Vrbo", logo: channelLogo("Vrbo") },
  { code: "keine", name: "", logo: null },
] as const;

export function SwitcherImport({
  accommodationType,
  /** Rücksprung aus dem Import heraus — der innere Assistent ruft ihn auf
   *  seiner ERSTEN Ansicht, wo es intern nichts mehr zurückzugehen gibt.
   *  Vorher stand dafür ein zweiter Zurück-Knopf des äußeren Assistenten
   *  darunter; zwei gleich beschriftete Knöpfe mit verschiedenem Ziel. */
  onVerlassen,
}: {
  accommodationType?: AccommodationType | null;
  onVerlassen?: () => void;
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

  // Objektzahl laden (Fortschritt: hat der Nutzer schon Objekte importiert?).
  //
  // Das GERÜST wird abgezogen. `/properties` liefert auch „Airbnb-Übernahme
  // läuft" — ein Platzhalter, den `uebernahme_starten` beim KLICK auf „Airbnb
  // verbinden" anlegt, damit Channex ein Ziel für die späteren Anzeigen hat.
  // Kommt die Zustimmung bei Airbnb nie, bleibt er stehen, und die Zeile
  // meldete „1 Objekt übernommen", obwohl nichts übernommen wurde (live am
  // 29.08.2026: genau eine solche Zeile, status=draft, ohne Listing-ID).
  //
  // Gezählt wird deshalb nur, was der Server als ECHTES Objekt sieht
  // (`object_created` aus `/dashboard/onboarding`, das dort denselben Abzug
  // macht). Eine eigene Regel hier wäre die zweite Wahrheit — und die beiden
  // liefen auseinander, sobald sich der Platzhalter ändert (Wurzel 4).
  function refreshCount() {
    void getOnboarding().then((res) => {
      if (res.ok) setPropertyCount(res.data.object_count);
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
  // Laeuft jetzt AUTOMATISCH nach dem Verbinden (`onDone` am
  // ChannelConnectButton) statt auf einen eigenen Knopf zu warten.
  //
  // Airbnb ist hier NICHT mehr dabei: dessen Inserate holt der Ruecksprung
  // selbst (`channel-connect-button.tsx`), direkt nachdem der Handshake steht.
  // Diese Funktion deckt die UEBRIGEN Portale ab, bei denen Channex echte
  // Properties fuehrt, die gespiegelt werden.
  function holeObjekteUebrigerPortale() {
    setReconcileMsg(null);
    startTransition(async () => {
      const reconcile = await reconcileTenant();
      if (!reconcile.ok) {
        setReconcileMsg(reconcile.error);
        return;
      }
      const n = reconcile.data.created + reconcile.data.updated;
      // Bei 0 schweigen: nach einem Airbnb-Connect ist 0 der Normalfall (dessen
      // Objekte kommen ueber den Ruecksprung) — „Keine neuen Objekte gefunden"
      // laese sich dort wie ein Fehlschlag.
      if (n > 0) setReconcileMsg(t("pull.result", { count: n }));
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
      // den Portalen registriert ist). `channels_done` misst der Server aus
      // `ota_account.connected_at` — also daraus, ob das PORTAL bestätigt hat.
      // Bis 29.08.2026 zählte dort eine Zeile in `channex_property_map`, und
      // die legt schon der KLICK auf „Airbnb verbinden" an: das Onboarding ließ
      // sich abschließen, ohne dass je jemand bei Airbnb zugestimmt hatte.
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

  // WIZARD IM WIZARD: ein Schritt je Ansicht statt fünf untereinander.
  //
  // Vorher stand der ganze Import als Scroll-Wurst in einer schmalen Spalte:
  // Warnung, fünf nummerierte Blöcke und der Abschluss-Knopf ganz unten. Wer
  // oben anfing, sah nie, wie weit es noch geht; der Fortschrittsbalken der
  // Schale stand die ganze Zeit auf demselben Wert, weil der Import für sie
  // EIN Schritt ist. Die Blöcke selbst sind unverändert — nur sichtbar ist
  // immer genau einer, und darunter steht, der wievielte von wie vielen.
  // Die Auswahl der heute genutzten Portale. Sie wird NICHT gespeichert: sie
  // ist eine Wegweisung für den Import, kein Datenfeld — was zählt, ist die
  // tatsächliche Verbindung.
  const [gewaehltePortale, setGewaehltePortale] = useState<string[]>([]);

  // Was die Auswahl WIRKLICH steuert — sonst wäre sie eine Attrappe, die
  // behauptet, den Import auszurichten, und nichts tut.
  //
  // Steht VOR `ansichten`: der Filter dort liest beide Werte, und eine
  // `const` weiter unten ist zur Laufzeit noch in der temporalen Todeszone —
  // TypeScript sieht das nicht, der Browser wirft.
  const nurAirbnb =
    gewaehltePortale.length === 1 && gewaehltePortale[0] === "AirBNB";
  const keinPortal = gewaehltePortale.includes("keine");
  // Die gewählten Portale als Knopf-Liste — leer, wenn nichts oder „kein
  // Portal" gewählt wurde.
  const portalKnoepfe = keinPortal
    ? []
    : AUSWAHL_PORTALE.filter(
        (p) => p.code !== "keine" && gewaehltePortale.includes(p.code),
      );

  const ALLE_ANSICHTEN = [
    "auswahl",
    "warnung",
    "objekte",
    "portale",
    "buchungen",
    "csv",
    "lodgify",
  ] as const;
  type Ansicht = (typeof ALLE_ANSICHTEN)[number];

  // Die Auswahl kürzt den Weg:
  //  * nur Airbnb  → „Objekt anlegen" entfällt, Airbnb liefert seine Inserate
  //                  beim Verbinden selbst mit (steht so auch im Hinweis dort).
  //  * kein Portal → die Cutover-Warnung entfällt; sie schützt davor, dass ZWEI
  //                  Systeme auf dasselbe Portal pushen, und ohne Portal gibt es
  //                  nichts zu trennen.
  //  * kein Portal verbunden → „Bestehende Buchungen einlesen" entfällt.
  //                  Der Schritt holt Reservierungen der VERBUNDENEN Portale;
  //                  ohne Verbindung gibt es nichts zu holen, und der Knopf
  //                  antwortete mit „Keine Buchungen gefunden" — eine Auskunft,
  //                  die wie ein leerer Kalender klingt, aber nur heißt, dass
  //                  niemand gefragt wurde. Maßgeblich ist `channelsDone`
  //                  (serverseitig gemessen), nicht die Portal-AUSWAHL am
  //                  Anfang: gewählt ist noch nicht verbunden.
  const ansichten = ALLE_ANSICHTEN.filter(
    (a): a is Ansicht =>
      !(a === "objekte" && nurAirbnb) &&
      !(a === "warnung" && keinPortal) &&
      !(a === "buchungen" && !channelsDone),
  );
  const [ansicht, setAnsicht] = useState<Ansicht>("auswahl");
  // Fällt die aktuelle Ansicht durch eine geänderte Auswahl weg, stünde hier
  // sonst eine leere Karte: `indexOf` gäbe -1, und kein Block träfe zu.
  useEffect(() => {
    if (!ansichten.includes(ansicht)) setAnsicht(ansichten[0]);
    // `ansichten` ist bei jedem Rendern neu — die Kennung des Weges ist, was
    // ihn verkürzt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht, nurAirbnb, keinPortal, channelsDone]);

  const idx = ansichten.indexOf(ansicht);
  const weiter = () =>
    setAnsicht(ansichten[Math.min(idx + 1, ansichten.length - 1)]);
  const zurueckAnsicht = () => setAnsicht(ansichten[Math.max(idx - 1, 0)]);
  const letzte = idx === ansichten.length - 1;

  // Wer schon verbunden ist, hat die Warnung hinter sich. Sie einmal
  // übersprungen zu haben, ist aber kein Zustand, den wir speichern — der
  // Sprung passiert deshalb einmalig beim Laden des Verbindungsstands, nicht
  // bei jedem Rendern (sonst käme man nie mehr zurück auf die Warnung).
  const [sprungGeprueft, setSprungGeprueft] = useState(false);
  useEffect(() => {
    if (sprungGeprueft || !channelsDone) return;
    setSprungGeprueft(true);
    setAnsicht((a) => (a === "auswahl" || a === "warnung" ? "objekte" : a));
  }, [channelsDone, sprungGeprueft]);

  return (
    <div className="flex flex-col gap-5">
      {/* Cutover-Warnung ZUERST — Doppelbuchungsschutz ist der kritische Teil.
          Sie warnt VOR dem Verbinden; ist bereits verbunden, ist sie Rückblick
          und wird eingeklappt. Der Pflicht-Haken entfällt dann, sonst hätte der
          Kunde eine Vorab-Warnung bestätigen müssen, die längst überholt ist. */}
      {ansicht === "warnung" && (
        <>
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
        </>
      )}

            {/* Erste Ansicht: WELCHE Portale nutzt der Betrieb heute?
          Das ist der Einstieg, den Guesty/Hostaway/Lodgify alle so führen — und
          er ist keine Deko: die Antwort entscheidet, welchen Weg der Betrieb
          danach geht (Airbnb holt seine Inserate selbst, Booking verlangt das
          Anlegen vorab) und was in Schritt „Portal verbinden" oben steht.
          Die Auswahl wird NICHT gespeichert: sie ist eine Wegweisung, kein
          Datenfeld — was wirklich zählt, ist die tatsächliche Verbindung. */}
      {ansicht === "auswahl" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("auswahl.title")}</span>
            <span className="text-sm text-muted-foreground">
              {t("auswahl.text")}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {AUSWAHL_PORTALE.map((p) => {
              const gewaehlt = gewaehltePortale.includes(p.code);
              return (
                <label
                  key={p.code}
                  className={
                    gewaehlt
                      ? "flex cursor-pointer items-center gap-3 rounded-(--radius) border-2 border-accent bg-accent/5 px-4 py-3"
                      : "flex cursor-pointer items-center gap-3 rounded-(--radius) border-2 border-border px-4 py-3 hover:bg-secondary/40"
                  }
                >
                  <input
                    type="checkbox"
                    checked={gewaehlt}
                    onChange={() =>
                      setGewaehltePortale((alt) =>
                        alt.includes(p.code)
                          ? alt.filter((c) => c !== p.code)
                          : // „Kein Portal" schließt die anderen aus und
                            // umgekehrt — beides zugleich ist ein Widerspruch.
                            p.code === "keine"
                            ? ["keine"]
                            : [...alt.filter((c) => c !== "keine"), p.code],
                      )
                    }
                  />
                  {p.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo} alt={p.name} className="h-5 w-auto max-w-[6rem] object-contain object-left" />
                  ) : (
                    <span className="text-sm">{t("auswahl.keine")}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Schritt 1: Objekt-Hülle je Bestands-Listing */}
      {ansicht === "objekte" && (
      <ImportStep
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
        {/* Den Hinweis geben, der zur AUSWAHL passt.
            Airbnb liefert seine Inserate beim Verbinden selbst — dort ist der
            Schritt wirklich ueberspringbar. Bei Booking.com & Co. ist er es
            NICHT: dort werden die Portal-Zimmer 1:1 vorhandenen Objekten
            zugeordnet, es muss also schon eines geben. Bis 29.08.2026 stand
            hier in beiden Faellen der Airbnb-Text — wer Booking verbinden
            wollte, las „diesen Schritt ueberspringen", uebersprang ihn und kam
            im naechsten Schritt nicht weiter. */}
        {!channelsDone && (
          <p className="basis-full text-sm text-muted-foreground">
            <Icon icon="ph:info" className="mr-1 inline size-4 align-[-0.15em]" />
            {nurAirbnb ? t("step1.airbnbHint") : t("step1.zuordnenHint")}
          </p>
        )}
      </ImportStep>
      )}

            {/* Schritt 2: Portal verbinden + 1:1 zuordnen (importiert Buchungen/ARI) */}
      {ansicht === "portale" && (
      <ImportStep
        title={t("step2.title")}
        // Der Text nennt die GEWÄHLTEN Portale statt „Booking, Airbnb & Co.".
        // Wer oben nur Airbnb angekreuzt hat, liest sonst eine Aufzählung, in
        // der seine Antwort untergeht.
        text={
          portalKnoepfe.length > 0
            ? t("step2.textNamed", {
                portale: portalKnoepfe.map((p) => p.name).join(", "),
              })
            : t("step2.text")
        }
        done={channelsDone}
      >
        {/* EIN Knopf je gewähltem Portal, mit dessen Logo und Namen — statt
            eines generischen „Portal verbinden".
            Wer oben Airbnb angekreuzt hat, will hier „Airbnb verbinden" lesen
            und nicht erst wieder in einer Portal-Liste suchen, was er gerade
            angegeben hat. `presetPortalCode` überspringt genau diese Liste.
            Ohne Auswahl (oder bei „kein Portal") bleibt der generische Knopf —
            dann ist die Portal-Liste der richtige Einstieg. */}
        {portalKnoepfe.length > 0 ? (
          portalKnoepfe.map((pk) => (
            <ChannelConnectButton
              key={pk.code}
              presetPortalCode={pk.code}
              accommodationType={accommodationType}
              label={t("step2.connectNamed", { portal: pk.name })}
              // KEIN `zeichen` mehr fuer Portale mit hinterlegter Markenfarbe:
              // der Knopf traegt dann selbst die Farbe des Portals und dazu
              // dessen einfarbige Bildmarke (`CHANNEL_BRAND`). Der weisse
              // Traeger war die Notloesung fuer einen SCHWARZEN Knopf — auf
              // Airbnb-Rot waere er ein weisser Fleck.
              //
              // Fuer die uebrigen Portale bleibt er: ihre Logos sind mehrfarbig
              // und wuerden auf dem dunklen Standardknopf untergehen.
              zeichen={
                pk.logo && !channelBrand(pk.code) ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-white p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pk.logo} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                ) : undefined
              }
              onDone={() => {
                refreshCount();
                refreshChannels();
                holeObjekteUebrigerPortale();
              }}
            />
          ))
        ) : (
          <ChannelConnectButton
            label={channelsDone ? t("step2.connectMore") : t("step2.connect")}
            accommodationType={accommodationType}
            onDone={() => {
              refreshCount();
              refreshChannels();
              holeObjekteUebrigerPortale();
            }}
          />
        )}
        {/* KEIN „Objekte aus Portal holen"-Knopf mehr (entfernt 29.08.2026).
            Die Inserate werden direkt nach dem Airbnb-Handshake geholt
            (`channel-connect-button.tsx`, Ruecksprung-Effekt) — der Knopf war
            ein zweiter, verstecketer Pflichtschritt: wer ihn nicht fand, stand
            nach der Rueckkehr von Airbnb vor einem leeren Onboarding.
            `pullFromPortals` bleibt als Funktion bestehen, siehe dort. */}
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
      )}

            {/* Schritt 3: Bestehende Buchungen einlesen (einmalig). */}
      {ansicht === "buchungen" && (
      <ImportStep title={t("bookings.title")} text={t("bookings.text")}>
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
      )}

            {/* Schritt 4: CSV-Import für Alt-/Direkt-/vergangene Buchungen, die NICHT
          über die OTA-API kommen (Vorlage → ausfüllen → hochladen). */}
      {ansicht === "csv" && (
      <ImportStep title={t("csv.title")} text={t("csv.text")}>
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
      )}

            {/* Schritt 5: Buchungen aus dem alten PMS Lodgify per Lese-API-Key holen. */}
      {ansicht === "lodgify" && (
      <ImportStep title={t("lodgify.title")} text={t("lodgify.text")}>
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
      )}

      {/* Navigation des inneren Assistenten.
          Der Abschluss steht NUR auf der letzten Ansicht: er beendet den
          gesamten Import, und ein Knopf, der das auf Schritt 2 anbietet,
          lädt dazu ein, die Hälfte zu überspringen, ohne es zu merken. */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={idx > 0 ? zurueckAnsicht : onVerlassen}
            disabled={pending || (idx === 0 && !onVerlassen)}
          >
            <Icon icon="ph:arrow-left" className="size-4" />
            {t("nav.zurueck")}
          </Button>

          {letzte ? (
            <Button
              onClick={finish}
              // Ist schon verbunden, gibt es die Ankreuzbox nicht mehr — dann
              // darf sie den Abschluss auch nicht sperren.
              disabled={pending || !(cutoverAck || channelsDone) || !hasProperties}
            >
              {t("finishCta")}
            </Button>
          ) : (
            <Button
              onClick={weiter}
              // Nur die Warnung ist eine echte Sperre: sie schützt vor
              // Doppelbuchungen. Die übrigen Schritte sind übersprungbar —
              // ein Betrieb ohne Lodgify soll dort nicht festhängen.
              disabled={ansicht === "warnung" && !cutoverAck && !channelsDone}
            >
              {t("nav.weiter")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Button>
          )}

          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {t("nav.zaehler", { aktuell: idx + 1, gesamt: ansichten.length })}
          </span>
        </div>

        {/* Segmentbalken wie in der äußeren Schale — dieselbe Sprache, damit
            erkennbar bleibt, dass hier ein Assistent IM Assistenten läuft. */}
        <div className="flex gap-1.5" aria-hidden>
          {ansichten.map((a, i) => (
            <span
              key={a}
              className={
                i < idx
                  ? "h-1 flex-1 rounded-full bg-primary"
                  : i === idx
                    ? "h-1 flex-1 rounded-full bg-accent"
                    : "h-1 flex-1 rounded-full bg-secondary"
              }
            />
          ))}
        </div>

        {/* Sagen, WAS fehlt — nicht nur den Knopf ausgrauen.
            Bis 29.08.2026 erschien der Hinweis NUR bei fehlender Bestaetigung.
            Fehlte dagegen das Objekt, blieb „Import abschliessen" stumm grau:
            der Kunde stand auf dem letzten, rein optionalen Schritt
            (Lodgify-Import) und sah keinen Grund, warum es nicht weitergeht. */}
        {letzte && !cutoverAck && !channelsDone && (
          <span className="text-sm text-muted-foreground">{t("finishHint")}</span>
        )}
        {letzte && (cutoverAck || channelsDone) && !hasProperties && (
          <span className="text-sm text-muted-foreground">
            {t("finishHintObjekt")}
          </span>
        )}
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
  title,
  text,
  done,
  children,
}: {
  title: string;
  text: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        {/* Kein Nummernkreis mehr: die Nummern standen fest im Code (1–5) und
            widersprachen dem Zähler unten, sobald die Portal-Auswahl einen
            Schritt überspringt — der Block sagte „2", der Zähler „Schritt 3
            von 6". Der Zähler ist die eine Wahrheit; hier bleibt nur der
            Erledigt-Haken. */}
        <span
          className={
            done
              ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary"
          }
        >
          <Icon
            icon={done ? "ph:check-bold" : "ph:dot-outline"}
            className={done ? "size-4" : "size-4 text-muted-foreground"}
          />
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
