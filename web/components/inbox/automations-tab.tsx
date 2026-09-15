"use client";

// Automatisierungen-Tab: planbare Auto-Nachrichten (Automails). Pro Regel:
// Auslöser + Versatz (Betrag + Einheit) + Uhrzeit, Vorlage/Text, sowie Zuweisung
// nach Unterkünften UND Buchungskanälen (Haken; leer = alle). Anlegen,
// bearbeiten, aktivieren/deaktivieren, löschen.
//
// Der Auslöser trägt Anker UND Richtung (0307, `lib/automation-phasen`). Vorher
// standen beide als eigene Auswahl daneben — man konnte „Vor Anreise" wählen und
// zugleich „nach Abreise" einstellen; die Regel hieß dann anders, als sie feuerte
// (live so vorgefunden). Die Maske fragt deshalb nur noch nach der ZAHL.
//
// Dasselbe Formular dient beidem: ohne Auswahl legt es an, mit `bearbeitetId`
// speichert es die geladene Regel zurück. Getrennte Masken würden bei jeder
// neuen Option (0303: Einheit, Ortszeit, Fenster) doppelt gepflegt.
//
// Der Auslöser „Nachricht empfangen" (Abwesenheitsantwort) fällt aus diesem
// Raster: er hängt an keinem Datum der Reservierung, sondern am Eingang einer
// Gastnachricht. Deshalb blendet das Formular für ihn den Zeitplan aus.
//
// DAS ZEITFENSTER GILT FÜR JEDEN AUSLÖSER (14.09.2026). Es beschreibt die
// Zeiten, in denen GESENDET werden darf — nicht die Zeiten, in denen der
// Auslöser feuert. Bei „Nachricht empfangen" fällt beides zusammen; bei einem
// datumsgebundenen Auslöser verschiebt es einen Versand, der außerhalb läge,
// auf den nächsten Fensterbeginn. Vorher hing es allein an „Nachricht
// empfangen", und eine Anreise-Automail um 03:00 ließ sich nicht verhindern.
// „Nur erste Nachricht" bleibt dagegen auf „Nachricht empfangen" beschränkt:
// bei einem Datums-Auslöser gibt es keine Gastnachricht, auf die es sich
// beziehen könnte — der Server weist es dort ab.
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { NativeSelect } from "@nextdays/ui/native-select";
import { AutomationProtokollDialog } from "@/components/inbox/automation-protokoll-dialog";
import { type ComposerGriff } from "@/components/inbox/composer-editor";
import {
  AutomationStandChips,
  AutomationStandFehler,
} from "@/components/inbox/automation-stand-chips";
import {
  FassungFelder,
  GRUNDFASSUNG,
  SprachReiter,
  type Fassungen,
} from "@/components/inbox/sprach-fassungen";
import {
  AUSLOESER_REIHENFOLGE,
  istTagesTrigger,
  AUTOMATION_KANAELE,
  ankerVon,
  ausloeserUndZeitplan,
  nichtAbgedeckt,
  richtungVon,
} from "@/lib/automation-phasen";
import {
  type Automation,
  type AutomationOffsetUnit,
  type AutomationStand,
  type AutomationText,
  type AutomationTrigger,
  type MessageLanguage,
  type MessageTemplate,
  createAutomation,
  deleteAutomation,
  getAutomation,
  getAutomationStand,
  listAutomations,
  listAvailableLanguages,
  listMessageLanguages,
  listTemplates,
  updateAutomation,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";
import { formatDateTime } from "@/lib/utils";

const TRIGGERS: AutomationTrigger[] = AUSLOESER_REIHENFOLGE;
// Vorbelegte Uhrzeit fuer „Am Anreisetag"/„Am Abreisetag" (0515). Ueberschreibbar
// — nicht jede Nachricht gehoert in die Fruehe: die Bewertungsbitte des Betriebs
// laeuft um 13:00. Ohne Uhrzeit ginge die Nachricht um Mitternacht hinaus.
const STANDARD_TAGESZEIT = "06:00";
// 0 = Montag … 6 = Sonntag (gleiche Zählung wie im Backend, `window_days`).
const WOCHENTAGE = [0, 1, 2, 3, 4, 5, 6];
// Einheit des Versatzes (0303). Reihenfolge klein → groß, wie man sie liest.
const EINHEITEN: AutomationOffsetUnit[] = ["minutes", "hours", "days"];
// Kanäle: EINE Liste für Tab und Panel (s. `AUTOMATION_KANAELE`).
const CHANNELS = AUTOMATION_KANAELE;

type Prop = { id: string; title: string };

/** Leere Fassung (Betreff + Text) — wie im Vorlagen-Tab. */
const LEER = { subject: "", body: "" };

export function AutomationsTab() {
  const t = useTranslations("inbox");
  const tGemein = useTranslations("common");
  const locale = useLocale();
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("booking_new");
  // Nur der BETRAG — die Richtung steckt im Auslöser (0307).
  const [days, setDays] = useState(3);
  const [einheit, setEinheit] = useState<AutomationOffsetUnit>("days");
  const [sendTime, setSendTime] = useState("09:00");
  // Uhrzeit abschaltbar: ohne feste Uhrzeit bestimmt bei Stunden/Minuten der
  // Versatz selbst die Zeit, bei Tagen gilt Mitternacht des Ankertags.
  const [mitUhrzeit, setMitUhrzeit] = useState(true);
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  // Freitext je Sprache (0363): Grundfassung + je verwalteter Sprache eine
  // Fassung. `body` ist hier KLARTEXT, nicht HTML — die Regel hat keine
  // HTML-Spalte (Begründung am Editor unten).
  const [fassungen, setFassungen] = useState<Fassungen>({ [GRUNDFASSUNG]: LEER });
  const [aktiveSprache, setAktiveSprache] = useState<string>(GRUNDFASSUNG);
  const [sprachen, setSprachen] = useState<MessageLanguage[]>([]);
  const [sprachNamen, setSprachNamen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** Getrennt von `error` (Speichern-Fehler am Formular): ein Ladefehler
   *  gehört über die Liste. */
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Sendezeit in Ortszeit des Objekts statt UTC. Ohne hinterlegte Zeitzone
  // plant der Server für dieses Objekt bewusst NICHT (kein stilles UTC).
  //
  // VORGABE AN: „06:00" meint für einen Betrieb sechs Uhr morgens vor Ort, nicht
  // 06:00 UTC. Mit der alten Vorgabe (aus) ging die Anreise-Automail des
  // dänischen Beta-Betriebs um 08:00 Ortszeit raus, und die Liste zeigte
  // unverändert „06:00" — der Fehler war an der Oberfläche nicht zu sehen.
  // Fehlt am Objekt die Zeitzone, wird nicht geplant; das ist der sichtbare
  // Fehler und damit besser als eine stille Verschiebung um den UTC-Offset.
  // Nur „Nachricht empfangen":
  const [nurErste, setNurErste] = useState(false);
  const [fensterTage, setFensterTage] = useState<number[]>([]);
  const [fensterVon, setFensterVon] = useState("");
  const [fensterBis, setFensterBis] = useState("");
  // null = Formular legt an, sonst wird diese Regel gespeichert.
  const [bearbeitetId, setBearbeitetId] = useState<string | null>(null);
  // Zustand je Regel (Versandprotokoll). `undefined` = noch nicht geladen —
  // die Chips bleiben dann weg, statt vier Nullen zu behaupten.
  const [stand, setStand] = useState<Record<string, AutomationStand>>({});
  // Versandprotokoll-Dialog (Klick auf die Chips einer Regel).
  const [protokollRegel, setProtokollRegel] = useState<Automation | null>(null);
  const [standGekappt, setStandGekappt] = useState(false);
  // Regel, für die die Löschbestätigung offensteht (nie `confirm()`: der
  // Browserdialog lässt sich weder gestalten noch übersetzen).
  const [loeschKandidat, setLoeschKandidat] = useState<Automation | null>(null);
  const editorGriff = useRef<ComposerGriff | null>(null);
  const formularRef = useRef<HTMLDivElement | null>(null);

  const beiNachricht = trigger === "message_received";
  // „Am Anreisetag" / „Am Abreisetag" (0515): der Auslöser IST das Datum, es
  // gibt keinen Abstand dazu. Das Zahlenfeld waere hier nicht nur ueberfluessig,
  // sondern irrefuehrend — eine 3 darin sieht aus, als verschoebe sie etwas,
  // waehrend der Server sie auf null zwingt.
  const amTag = istTagesTrigger(trigger);

  /** LADEFEHLER WERDEN ANGEZEIGT, NICHT VERSCHLUCKT (Wurzel 5) — dieselbe
   *  Lehre wie im Vorlagen-Reiter. Fünf Aufrufe, von denen bis 24.08.2026
   *  keiner seinen Fehlschlag meldete: „Noch keine Automatisierungen." sah
   *  identisch aus, ob der Betrieb keine hat oder der Aufruf scheiterte.
   *  Live liefen fünf Regeln und verschickten Post, während dieser Reiter
   *  behauptete, es gäbe keine. */
  async function load() {
    const [a, tpl, p, spr, kat, st] = await Promise.all([
      listAutomations(),
      listTemplates(),
      listProperties(),
      listMessageLanguages(),
      listAvailableLanguages(),
      getAutomationStand(),
    ]);
    if (a.ok) setItems(a.data.items);
    if (tpl.ok) setTemplates(tpl.data.items);
    if (p.ok) setProps(p.data.items.map((x) => ({ id: x.id, title: x.title })));
    if (spr.ok) setSprachen(spr.data.items);
    if (kat.ok) {
      setSprachNamen(
        Object.fromEntries(kat.data.items.map((o) => [o.code, o.name])),
      );
    }
    if (st.ok) {
      setStand(
        Object.fromEntries(st.data.items.map((s) => [s.automation_id, s])),
      );
      setStandGekappt(st.data.gekappt);
    }
    const fehler = [a, tpl, p, spr, kat, st]
      .filter((r) => !r.ok)
      .map((r) => (r as { error: string }).error);
    setLadefehler(fehler.length ? [...new Set(fehler)].join(" · ") : null);
  }
  useEffect(() => {
    load();
  }, []);
  // KEIN Realtime-Abo mehr auf `message_automation`: die Tabelle ist seit
  // Migration 0337 für `authenticated` gesperrt (Wurzel 6 — eine Regel trägt
  // den Nachrichtentext, der an den Gast hinausgeht). Ohne SELECT-Grant passt
  // keine Policy mehr; das Abo wäre eine stumme Attrappe.
  //
  // Eine erlaubte Ersatzquelle gibt es nicht: eine Regeländerung berührt keine
  // offene Tabelle. `reservations` wäre ein stiller Ersatz und damit falsch.
  //
  // WAS DADURCH ENTFÄLLT: Eine Regel, die im Panel im Posteingang-Kopf oder
  // von einem Kollegen geändert wird, erscheint hier nicht mehr von selbst.
  // Die eigene Änderung lädt über `load()` ohnehin nach; fremde werden beim
  // erneuten Öffnen des Tabs sichtbar.

  /** Formular auf „neue Regel" zurückstellen. */
  function zuruecksetzen() {
    setBearbeitetId(null);
    setName("");
    setTrigger("booking_new");
    setDays(3);
    setEinheit("days");
    setSendTime("09:00");
    setMitUhrzeit(true);
    setPropertyIds([]);
    setChannels([]);
    setTemplateId("");
    setFassungen({ [GRUNDFASSUNG]: LEER });
    setAktiveSprache(GRUNDFASSUNG);
    setNurErste(false);
    setFensterTage([]);
    setFensterVon("");
    setFensterBis("");
    setError(null);
  }

  /** Bestehende Regel ins Formular laden. Vom Versatz bleibt nur der BETRAG —
   *  die Richtung liest man am Auslöser ab; bei einem Server vor 0303 trägt nur
   *  `offset_days` den Wert. */
  function bearbeiten(a: Automation) {
    const versatz = a.offset_value ?? a.offset_days ?? 0;
    setBearbeitetId(a.id);
    setName(a.name);
    setTrigger(a.trigger);
    setDays(Math.abs(versatz));
    setEinheit(a.offset_unit ?? "days");
    setMitUhrzeit(Boolean(a.send_time));
    setSendTime(a.send_time ?? "09:00");
    setPropertyIds(a.property_ids);
    setChannels(a.channels);
    setTemplateId(a.template_id ?? "");
    const geladen: Fassungen = {
      [GRUNDFASSUNG]: { subject: a.subject ?? "", body: a.message ?? "" },
    };
    for (const s of sprachen) {
      const fassung = (a.texts ?? []).find((x) => x.lang === s.code);
      geladen[s.code] = fassung
        ? { subject: fassung.subject, body: fassung.message }
        : LEER;
    }
    setFassungen(geladen);
    setAktiveSprache(GRUNDFASSUNG);
    setNurErste(a.only_first_message);
    setFensterTage(a.window_days);
    setFensterVon(a.window_from ?? "");
    setFensterBis(a.window_to ?? "");
    setError(null);
    formularRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const grundfassung = fassungen[GRUNDFASSUNG] ?? LEER;

  /** ISO-Zeitstempel in der Sprache des Nutzers. Leerer/ungültiger Wert bleibt
   *  leer — „Invalid Date" wäre schlimmer als gar keine Angabe. */
  function zeitpunktText(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : formatDateTime(iso, locale);
  }

  /** Sprachfassungen für die API. Leere Reiter fallen weg — eine leere Fassung
   *  darf die Grundfassung nicht verdrängen (der Server verwirft sie ohnehin). */
  function sprachfassungen(): AutomationText[] {
    return sprachen
      .map((s) => ({ lang: s.code, ...(fassungen[s.code] ?? LEER) }))
      .filter((f) => f.body.trim() || f.subject.trim())
      .map((f) => ({ lang: f.lang, subject: f.subject, message: f.body }));
  }

  function speichern() {
    if (!name.trim()) {
      setError(t("autoNameRequired"));
      return;
    }
    // Das Zeitfenster gilt für JEDEN Auslöser (14.09.2026) — bei den
    // datumsgebundenen verschiebt es den Versand auf den nächsten
    // Fensterbeginn. Die Vollständigkeitsprüfung gilt deshalb ebenfalls für
    // alle, nicht mehr nur für „Nachricht empfangen".
    if (Boolean(fensterVon) !== Boolean(fensterBis)) {
      setError(t("autoWindowIncomplete"));
      return;
    }
    setError(null);
    // Vorzeichen aus dem Auslöser — der Server normiert es ohnehin nach
    // derselben Tabelle (0307); hier steht es, damit die Liste sofort stimmt.
    const offset = richtungVon(trigger) * Math.abs(days);
    // Beim Bearbeiten bleibt der Aktiv-Zustand, wie er in der Liste steht —
    // Speichern darf eine pausierte Regel nicht stillschweigend scharfstellen.
    const bestand = bearbeitetId
      ? items.find((x) => x.id === bearbeitetId)
      : undefined;
    const eingabe = {
      name,
      trigger,
      // Der Server leitet den Anker aus dem Auslöser ab; mitgeschickt wird er
      // nur, weil das Modell ihn als Feld führt.
      anchor: ankerVon(trigger),
      // `offset_days` führt weiter die Tages-Sicht; der Server rechnet mit
      // offset_unit/offset_value (0303).
      offset_days: einheit === "days" ? offset : 0,
      offset_unit: einheit,
      offset_value: offset,
      send_time: mitUhrzeit && sendTime ? sendTime : null,
      property_ids: propertyIds,
      channels,
      template_id: templateId || null,
      message: grundfassung.body || null,
      subject: grundfassung.subject,
      // Vollständiger Sollzustand: was hier fehlt, entfernt der Server (sonst
      // ginge eine gelöschte Fassung weiter an Gäste dieser Sprache raus).
      texts: sprachfassungen(),
      is_active: bestand?.is_active ?? true,
      // Immer Ortszeit des Objekts (14.09.2026) — der Kunde stellt die Uhrzeit ein.
      use_property_timezone: true,
      // „Nur erste Nachricht" gibt es NUR bei „Nachricht empfangen" — bei
      // einem Datums-Auslöser gibt es keine Nachricht, auf die es sich
      // beziehen könnte (der Server weist es dort ab). Ein gespeicherter Rest
      // wanderte sonst still mit, wenn jemand den Auslöser später umstellt.
      only_first_message: beiNachricht ? nurErste : false,
      // Das Fenster dagegen gilt für alle Auslöser.
      window_days: fensterTage,
      window_from: fensterVon || null,
      window_to: fensterBis || null,
    };
    start(async () => {
      const res = bearbeitetId
        ? await updateAutomation(bearbeitetId, eingabe)
        : await createAutomation(eingabe);
      if (res.ok) {
        // ERFOLG WIRD GEMELDET: das Formular leerte sich zwar, aber das sieht
        // aus wie ein Abbruch — der Betrieb speicherte deshalb zweimal.
        toast.success(bearbeitetId ? t("autoSaved") : t("autoCreated"));
        zuruecksetzen();
        await load();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  /** Aktiv/pausiert umschalten. Der Rückgabewert wurde bis zum 14.09.2026
   *  NICHT geprüft: ein 403 („keine Berechtigung") sah aus wie ein Erfolg, der
   *  Schalter sprang beim Neuladen nur wieder zurück (Wurzel 5). */
  function toggle(a: Automation) {
    start(async () => {
      // Regel FRISCH holen: `updateAutomation` schickt den vollen Datensatz,
      // und `a` stammt aus der zuletzt geladenen Liste. Mit der Kopie zu
      // schreiben machte jede zwischenzeitliche Änderung rückgängig — ein
      // Klick auf „pausieren" setzte dann nebenbei den Text zurück.
      const frisch = await getAutomation(a.id);
      if (!frisch.ok) {
        toast.error(frisch.error);
        return;
      }
      const res = await updateAutomation(a.id, {
        ...frisch.data,
        is_active: !frisch.data.is_active,
      });
      if (res.ok) {
        toast.success(frisch.data.is_active ? t("autoPausedDone") : t("autoActivated"));
      } else {
        toast.error(res.error);
      }
      await load();
    });
  }

  function remove(id: string) {
    setLoeschKandidat(null);
    start(async () => {
      const res = await deleteAutomation(id);
      if (res.ok) toast.success(t("autoDeleted"));
      else toast.error(res.error);
      // Sonst zeigte das Formular weiter eine Regel, die es nicht mehr gibt,
      // und „Speichern" liefe in ein 404.
      if (bearbeitetId === id) zuruecksetzen();
      await load();
    });
  }

  // Zeitplan-Zeile und „nicht abgedeckt" kommen aus `lib/automation-phasen` —
  // dieselbe Rechnung wie im Panel. Vorher stand beides zweimal da und war
  // bereits auseinandergelaufen: der Tab zeigte die Wochentage des Fensters,
  // das Panel den Auslösernamen, und keiner beides.

  function assignLabel(a: Automation): string {
    const houses =
      a.property_ids.length === 0
        ? t("autoAllHouses")
        : `${a.property_ids.length} ${t("autoHousesCount")}`;
    const chans =
      a.channels.length === 0 ? t("autoAllChannels") : a.channels.join(", ");
    return `${houses} · ${chans}`;
  }

  /** Name der Vorlage, aus der diese Regel ihren Text nimmt — oder der
   *  Hinweis, dass sie einen eigenen führt. Eine gelöschte Vorlage hinterlässt
   *  `template_id = null` (Fremdschlüssel ON DELETE SET NULL); dann steht dort
   *  „eigener Text", was der Wahrheit entspricht: ab da gilt `message`. */
  function textquelle(a: Automation): string {
    if (!a.template_id) return t("autoNoTemplate");
    const tpl = templates.find((x) => x.id === a.template_id);
    return tpl ? tpl.title : t("autoNoTemplate");
  }

  /** Sprachen des Betriebs ohne Fassung — an der QUELLE gemessen, aus der die
   *  Regel wirklich liest. Bei gewählter Vorlage sind das deren Fassungen,
   *  sonst die der Regel. Diese Unterscheidung ist der ganze Punkt: die eigenen
   *  Fassungen einer Regel mit Vorlage werden nie gelesen, und sie als
   *  „gepflegt" zu zeigen wäre die falsche Entwarnung. */
  function fehlendeSprachen(a: Automation): string[] {
    const quelle = a.template_id
      ? (templates.find((x) => x.id === a.template_id)?.texts ?? [])
      : (a.texts ?? []);
    const da = new Set(quelle.map((x) => x.lang));
    return sprachen.map((s) => s.code).filter((c) => !da.has(c));
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-y-auto p-6">
      {/* Liste */}
      <div className="col-span-12 lg:col-span-7">
        <div className="mb-3 flex items-center gap-1.5">
          <h2 className="font-display text-lg font-extrabold">
            {t("tabAutomations")}
          </h2>
          {/* Zwei Fragen, die die Maske nicht beantwortete und an denen sich
              der Betrieb reihum verlief: woher der Text kommt, wenn eine
              Vorlage gewählt ist (aus der VORLAGE — der eigene Text der Regel
              ist dann tot), und wann eine Änderung wirkt (beim Einplanen wird
              der Wortlaut festgeschrieben). */}
          <InfoHinweis
            titel={t("autoSourceTitle")}
            text={[t("autoSourceText"), t("langChainText")]}
            ariaLabel={tGemein("explain", { label: t("autoSourceTitle") })}
          />
        </div>
        {ladefehler && (
          <p className="mb-3 text-sm text-destructive">{ladefehler}</p>
        )}
        {/* Die Obergrenze hat gegriffen — die Zahlen sind dann ein Ausschnitt.
            Sie stillschweigend als Gesamtzahl zu zeigen wäre eine
            Falschaussage (Wurzel 4). */}
        {standGekappt && (
          <p className="mb-3 text-xs text-muted-foreground">
            {t("autoStandCapped")}
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("autoEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <li
                key={a.id}
                className={
                  "flex flex-wrap items-center gap-3 rounded-2xl border p-3 " +
                  (bearbeitetId === a.id ? "border-accent" : "border-border")
                }
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {ausloeserUndZeitplan(a, t)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {assignLabel(a)}
                  </span>
                  {/* Zustand aus dem Versandprotokoll: was ist geplant,
                      gesendet, fehlgeschlagen? Ohne diese Zeile sah eine Regel,
                      die seit Wochen scheitert, aus wie eine, die zustellt. */}
                  <AutomationStandChips
                    stand={stand[a.id]}
                    zeitpunktText={zeitpunktText}
                    onOeffnen={() => setProtokollRegel(a)}
                  />
                  <AutomationStandFehler
                    stand={stand[a.id]}
                    zeitpunktText={zeitpunktText}
                  />
                  {/* WOHER DER TEXT KOMMT, an der Regel selbst. Die Liste nannte
                      Auslöser, Zeitplan und Zuweisung — nur nicht die Quelle des
                      Wortlauts. Wer eine Sprachfassung sucht, suchte sie
                      deshalb in der Regel, obwohl sie in der Vorlage steht. */}
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {textquelle(a)}
                    </span>
                    {/* Feste Objektliste altert still: ein neu angelegtes Haus
                        fiel aus jeder Regel mit Liste. Dieselbe Rechnung wie
                        im Panel (`nichtAbgedeckt`) — sie gehört an BEIDE
                        Oberflächen, nicht nur an die eine. */}
                    {nichtAbgedeckt(a, props) > 0 && (
                      <span
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                        title={t("autoHousesUncoveredHint")}
                      >
                        {t("autoHousesUncovered", {
                          count: nichtAbgedeckt(a, props),
                        })}
                      </span>
                    )}
                    {fehlendeSprachen(a).map((code) => (
                      <span
                        key={code}
                        className="rounded-full border border-dashed border-destructive/50 px-2 py-0.5 text-xs text-destructive"
                      >
                        {code.toUpperCase()} · {t("tplLangMissing")}
                      </span>
                    ))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-medium " +
                    (a.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {a.is_active ? t("autoActive") : t("autoPaused")}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("autoEdit")}
                  title={t("autoEdit")}
                  onClick={() => bearbeiten(a)}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("autoDelete")}
                  title={t("autoDelete")}
                  onClick={() => setLoeschKandidat(a)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Neue Regel */}
      <div
        ref={formularRef}
        className="col-span-12 flex flex-col gap-3 rounded-2xl border border-border p-4 lg:col-span-5"
      >
        <h3 className="font-semibold">
          {bearbeitetId ? t("autoEditTitle") : t("autoNew")}
        </h3>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("autoName")}
        />

        <label className="text-sm font-medium">{t("autoTriggerLabel")}</label>
        <NativeSelect
          value={trigger}
          onChange={(e) => {
            const neu = e.target.value as AutomationTrigger;
            setTrigger(neu);
            if (istTagesTrigger(neu)) {
              // Ohne Uhrzeit ginge „am Abreisetag" um Mitternacht hinaus —
              // technisch der richtige Tag, praktisch die falsche Nachricht zur
              // falschen Stunde. Deshalb hier erzwungen und mit 06:00
              // vorbelegt; ueberschreibbar, weil nicht jede Nachricht in der
              // Frueh gehoert (die Bewertungsbitte laeuft um 13:00).
              setMitUhrzeit(true);
              setDays(0);
              // NUR bei einer NEUEN Regel vorbelegen. Beim Bearbeiten stünde
              // sonst 06:00 in einer Regel, die seit je um 13:00 läuft
              // („Bewertung in Ruhe") — ein stilles Verstellen des Versands
              // durch bloßes Öffnen des Formulars.
              //
              // Ein `if (!sendTime)` reichte NICHT: das Feld ist mit "09:00"
              // vorbelegt, ist also nie leer. Gemessen im Browser (31.08.2026):
              // die Wahl „Am Anreisetag" ließ 09:00 stehen.
              if (!bearbeitetId) setSendTime(STANDARD_TAGESZEIT);
            }
          }}
        >
          {TRIGGERS.map((x) => (
            <option key={x} value={x}>
              {t(`autoTrigger_${x}` as never) ?? x}
            </option>
          ))}
        </NativeSelect>

        {!beiNachricht && (
          <>
            {/* Zeitplan: Betrag · Einheit. Richtung und Anker stehen im
                Auslöser darüber — hier ein zweites Mal wählbar, konnten sie ihm
                widersprechen. Der Satz darunter liest die Regel vor, damit die
                Zahl allein nicht rätselhaft bleibt. */}
            {!amTag && (
              <>
            <label className="text-sm font-medium">{t("autoSchedule")}</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                aria-label={t("autoAmount")}
              />
              <NativeSelect
                value={einheit}
                onChange={(e) => setEinheit(e.target.value as AutomationOffsetUnit)}
                aria-label={t("autoUnit")}
              >
                {EINHEITEN.map((u) => (
                  <option key={u} value={u}>
                    {t(`autoUnit_${u}` as never)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              {days === 0
                ? t("autoOnDayOf", { anchor: t(`autoAnchor_${ankerVon(trigger)}` as never) })
                : `${days} ${t(`autoUnit_${einheit}` as never)} ${
                    richtungVon(trigger) < 0 ? t("autoBefore") : t("autoAfter")
                  } ${t(`autoAnchor_${ankerVon(trigger)}` as never)}`}
            </p>
              </>
            )}
            {/* Uhrzeit abschaltbar. Bei Stunden/Minuten ist sie nur der Bezug,
                von dem aus gerechnet wird — An-/Abreise tragen beim Portal
                keine Uhrzeit, deshalb steht das als Hinweis dabei. */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mitUhrzeit}
                /* Bei „Am Anreisetag"/„Am Abreisetag" nicht abwaehlbar: ohne
                   Uhrzeit waere der Versand Mitternacht, und der Auslöser
                   verspricht einen TAG, keine Nacht. */
                disabled={amTag}
                onChange={(e) => setMitUhrzeit(e.target.checked)}
                className="size-4 accent-[var(--accent)] disabled:opacity-50"
              />
              {t("autoWithTime")}
            </label>
            {mitUhrzeit ? (
              <Input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                aria-label={t("autoTime")}
              />
            ) : (
              <p className="-mt-1 text-xs text-muted-foreground">
                {t("autoWithoutTimeHint")}
              </p>
            )}
            <p className="-mt-1 text-xs text-muted-foreground">
              {t("autoPropertyTimezoneAlways")}
            </p>
          </>
        )}

        {/* ZEITFENSTER — für JEDEN Auslöser (14.09.2026).
            Es beschreibt die Zeiten, in denen GESENDET werden darf. Bei
            „Nachricht empfangen" entscheidet es, wann die Abwesenheitsantwort
            feuert; bei den datumsgebundenen Auslösern verschiebt es einen
            Versand, der außerhalb läge, auf den nächsten Fensterbeginn.
            Vorher war es allein an „Nachricht empfangen" gebunden — eine
            Anreise-Automail um 03:00 ließ sich damit nicht verhindern. */}
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium">{t("autoWindow")}</label>
          <InfoHinweis
            titel={t("autoWindow")}
            text={t("autoWindowHint")}
            ariaLabel={tGemein("explain", { label: t("autoWindow") })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="time"
            value={fensterVon}
            onChange={(e) => setFensterVon(e.target.value)}
            aria-label={t("autoWindowFrom")}
          />
          <Input
            type="time"
            value={fensterBis}
            onChange={(e) => setFensterBis(e.target.value)}
            aria-label={t("autoWindowTo")}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WOCHENTAGE.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={fensterTage.includes(d)}
              onClick={() =>
                setFensterTage((prev) =>
                  prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                )
              }
              className={
                "rounded-full border px-2.5 py-1 text-xs " +
                (fensterTage.includes(d)
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-accent")
              }
            >
              {t(`autoDay_${d}` as never)}
            </button>
          ))}
        </div>

        {/* „Nur erste Nachricht" gibt es NUR bei „Nachricht empfangen": bei
            einem Datums-Auslöser gibt es keine Gastnachricht, auf die es sich
            beziehen könnte — der Server weist es dort ab. Ein Haken, den der
            Server verwirft, ist eine Zusage, die niemand einhält (Wurzel 4). */}
        {beiNachricht && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={nurErste}
              onChange={(e) => setNurErste(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            {t("autoOnlyFirst")}
          </label>
        )}

        {/* Zuweisung Unterkünfte (durchsuchbar; leer = alle) */}
        <label className="text-sm font-medium">{t("autoHouses")}</label>
        <MultiSelect
          options={props.map((p) => ({ value: p.id, label: p.title }))}
          selected={propertyIds}
          onChange={setPropertyIds}
          placeholder={t("autoAllHouses")}
          searchPlaceholder={t("autoSearchHouses")}
          emptyHint={t("autoNoHouses")}
          allLabel={t("autoAllHouses")}
        />

        {/* Zuweisung Kanäle (durchsuchbar; leer = alle) */}
        <label className="text-sm font-medium">{t("autoChannels")}</label>
        <MultiSelect
          options={CHANNELS.map((c) => ({ value: c, label: c }))}
          selected={channels}
          onChange={setChannels}
          placeholder={t("autoAllChannels")}
          searchPlaceholder={t("autoSearchChannels")}
          allLabel={t("autoAllChannels")}
        />

        <label className="text-sm font-medium">{t("autoTemplate")}</label>
        <NativeSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">{t("autoNoTemplate")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title}
            </option>
          ))}
        </NativeSelect>
        {!templateId && (
          <>
            {/* Derselbe Editor wie in Chat und Vorlagen — eine Automation
                verschickt dieselbe Art Nachricht an denselben Gast.

                BEWUSST `format="text"`. Anders als die Vorlage hat dieser
                Freitext KEINE HTML-Spalte: `message_automation.message` fließt
                in `planung._automation_body` an genau derselben Stelle in den
                Versand wie `message_template.body` — als KLARTEXT. Stellte man
                den Editor hier auf HTML um, stünde das Markup wörtlich in der
                Nachricht beim Gast. Wer das ändern will, braucht zuerst eine
                eigene `message_html`-Spalte samt Ableitung im Backend.

                MIT BETREFF (14.09.2026): Er wird für den E-Mail-Weg gebraucht.
                Eine Regel geht nicht mehr ausschließlich in den Portal-Chat —
                Direkt-, Website- und myBestDays-Buchungen haben keinen
                Portal-Chat, dort ist E-Mail der Versandweg, und eine Mail ohne
                Betreff kommt als leere Zeile an. Die Einschränkung („Portale
                zeigen keinen Betreff") steht am ℹ-Symbol des Feldes. */}
            <SprachReiter
              sprachen={sprachen}
              aktiv={aktiveSprache}
              onAktiv={setAktiveSprache}
              fassungen={fassungen}
              namen={sprachNamen}
              onSpracheHinzugefuegt={(liste, code) => {
                setSprachen(liste);
                setAktiveSprache(code);
              }}
              onSpracheEntfernt={(liste, code) => {
                setSprachen(liste);
                setAktiveSprache((vorher) =>
                  vorher === code ? GRUNDFASSUNG : vorher,
                );
                setFassungen((prev) => {
                  const rest = { ...prev };
                  delete rest[code];
                  return rest;
                });
              }}
            />
            {aktiveSprache === GRUNDFASSUNG && sprachen.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("langBaseHint")}</p>
            )}
            <FassungFelder
              // Neu aufbauen beim Reiterwechsel — sonst zeigte der Editor
              // weiter den Text der vorigen Sprache (TipTap führt sein
              // Dokument selbst; s. Vorlagen-Tab).
              key={aktiveSprache}
              format="text"
              mitBetreff
              betreffHinweis={t("autoSubjectHint")}
              fassung={fassungen[aktiveSprache] ?? LEER}
              onChange={(f) =>
                setFassungen((prev) => ({ ...prev, [aktiveSprache]: f }))
              }
              griff={editorGriff}
              hoeheSchluessel="inbox.automation.hoehe"
              testId="inbox-automation-textarea"
              platzhalter={t("autoMessage")}
              uebersetzenZiel={
                aktiveSprache === GRUNDFASSUNG ? undefined : aktiveSprache
              }
              grundfassung={fassungen[GRUNDFASSUNG]}
            />
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          {bearbeitetId && (
            <Button
              type="button"
              variant="outline"
              onClick={zuruecksetzen}
              disabled={pending}
            >
              {t("autoCancel")}
            </Button>
          )}
          <Button type="button" onClick={speichern} disabled={pending}>
            {bearbeitetId ? t("autoSave") : t("autoCreate")}
          </Button>
        </div>
      </div>

      {/* Löschen ist nicht umkehrbar und nimmt bereits eingeplante Nachrichten
          mit (ON DELETE CASCADE auf `automation_scheduled_message`). Deshalb
          eine Rückfrage — aber KEIN `window.confirm`: der lässt sich weder
          übersetzen noch gestalten und steht in keiner Sprache des Betriebs. */}
      <Dialog
        open={loeschKandidat !== null}
        onOpenChange={(o) => !o && setLoeschKandidat(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{t("autoDeleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("autoDeleteConfirmText", { name: loeschKandidat?.name ?? "" })}
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLoeschKandidat(null)}
            >
              {t("autoCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => loeschKandidat && remove(loeschKandidat.id)}
            >
              {t("autoDelete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AutomationProtokollDialog
        regel={protokollRegel}
        luecken={protokollRegel ? (stand[protokollRegel.id]?.luecken ?? []) : []}
        offen={protokollRegel !== null}
        onClose={() => setProtokollRegel(null)}
        onGeaendert={() => void load()}
        zeitpunktText={zeitpunktText}
      />
    </div>
  );
}
