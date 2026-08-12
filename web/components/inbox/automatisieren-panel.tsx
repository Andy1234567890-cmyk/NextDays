"use client";

// „Nachrichten automatisieren" — das Panel aus dem Posteingang-Kopf, in der
// Form, die Lodgify dafür gefunden hat (live abgelesen 07.08.2026):
//
//   Stufe 1: Menü mit drei Einstiegen (Geplante Nachrichten · Schnellantworten
//            · Sprachen).
//   Stufe 2: die Regeln, gruppiert nach Lebenszyklus, je Zeile Name, Reichweite
//            und Status; lange Gruppen hinter „Mehr anzeigen (n)".
//   Stufe 3: eine Regel im Detail — aufklappbare Abschnitte statt einer langen
//            Maske.
//
// Warum ein Panel und kein Tab: die Regeln beantworten „was geht automatisch
// raus?", während man einen Verlauf liest. Als eigener Tab reißt es einen aus
// dem Posteingang; als Panel legt es sich darüber und man ist mit einem Klick
// zurück.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import {
  AUTOMATION_KANAELE,
  PHASEN,
  istZeitplanRegel,
  phaseVon,
  zeitachse,
} from "@/lib/automation-phasen";
import { type ComposerGriff } from "@/components/inbox/composer-editor";
import { SchnellantwortenAnsicht } from "@/components/inbox/schnellantworten-panel";
import {
  FassungFelder,
  GRUNDFASSUNG,
  SprachReiter,
  type Fassungen,
} from "@/components/inbox/sprach-fassungen";
import { SprachenAnsicht } from "@/components/inbox/sprachen-panel";
import { channelLogoLoose } from "@/lib/channel-logos";
import {
  type Automation,
  type MessageLanguage,
  type MessageTemplate,
  deleteAutomation,
  listAutomations,
  listAvailableLanguages,
  listMessageLanguages,
  listTemplates,
  updateAutomation,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";

// So viele Regeln zeigt ein Abschnitt sofort; der Rest steckt hinter
// „Mehr anzeigen (n)" — wie bei Lodgify, damit ein Betrieb mit 15 Regeln je
// Phase nicht scrollen muss, um die nächste Überschrift zu sehen.
const SOFORT_SICHTBAR = 4;

/** Objekt für die Zuweisungsliste: Titel + erstes Foto (wie bei Lodgify). */
export type PanelObjekt = { id: string; title: string; photo: string | null };

type Ansicht =
  | "menu"
  | "liste"
  | "schnellantworten"
  | "sprachen"
  | { regel: Automation };

export function AutomatisierenPanel({
  offen,
  onOffenChange,
}: {
  offen: boolean;
  onOffenChange: (o: boolean) => void;
}) {
  const t = useTranslations("inbox");
  const [ansicht, setAnsicht] = useState<Ansicht>("menu");
  // Titel im Panelkopf, wenn eine Unteransicht ihn selbst bestimmt (der Name
  // der geöffneten Schnellantwort). Ohne das stünde dort weiter „Schnell-
  // antworten", während man einen einzelnen Text bearbeitet.
  const [unterTitel, setUnterTitel] = useState<string | null>(null);
  const [items, setItems] = useState<Automation[]>([]);
  const [objekte, setObjekte] = useState<PanelObjekt[]>([]);
  // Vorlagen MIT Text: die meisten Regeln haben keinen eigenen Text, sondern
  // verweisen auf eine Vorlage. Ohne sie stünde im Abschnitt „Inhalt" nur, DASS
  // es eine Vorlage gibt — nicht, was drinsteht. Genau das war der Fall.
  const [vorlagen, setVorlagen] = useState<MessageTemplate[]>([]);
  const [geladen, setGeladen] = useState(false);

  /** Lädt alles neu und gibt die frischen Regeln zurück (für die Detailansicht). */
  async function load(): Promise<Automation[]> {
    const [res, props, tpl] = await Promise.all([
      listAutomations(),
      listProperties(),
      listTemplates(),
    ]);
    const regeln = res.ok ? res.data.items : [];
    if (res.ok) setItems(regeln);
    if (tpl.ok) setVorlagen(tpl.data.items);
    if (props.ok) {
      setObjekte(
        props.data.items.map((p) => ({
          id: p.id,
          title: p.title,
          photo: p.photos?.[0] ?? null,
        })),
      );
    }
    setGeladen(true);
    return regeln;
  }

  useEffect(() => {
    if (offen) load();
    else setAnsicht("menu");
  }, [offen]);
  // KEIN Realtime-Abo mehr auf `message_automation`: die Tabelle ist seit
  // Migration 0337 für `authenticated` gesperrt (Wurzel 6 — eine Regel trägt
  // den Nachrichtentext, der an den Gast hinausgeht). Ohne SELECT-Grant passt
  // keine Policy mehr; das Abo wäre eine stumme Attrappe.
  //
  // Eine erlaubte Ersatzquelle gibt es nicht: eine Regeländerung berührt keine
  // offene Tabelle. `reservations` wäre ein stiller Ersatz und damit falsch.
  //
  // WAS DADURCH ENTFÄLLT: Eine Regel, die zeitgleich im Automatisierungen-Tab
  // geändert wird, erscheint hier nicht mehr von selbst. Das Panel lädt beim
  // Öffnen (siehe Effekt oben) und nach jeder eigenen Änderung frisch — es
  // genügt, es einmal zu schließen und wieder zu öffnen.

  // In der Detailansicht bleibt der Kopf LEER: der Regelname steht dort in der
  // ersten Karte. Beides zugleich wäre derselbe Text zweimal untereinander.
  const titel =
    ansicht === "menu"
      ? t("autoPanelTitle")
      : ansicht === "schnellantworten"
        ? (unterTitel ?? t("autoQuickTitle"))
        : ansicht === "sprachen"
          ? t("autoLanguagesTitle")
          : ansicht === "liste"
        ? t("autoScheduledTitle")
        : "";

  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="flex-row items-center gap-2 border-b border-border p-4">
          {ansicht !== "menu" && (
            <button
              type="button"
              onClick={() => {
                setUnterTitel(null);
                setAnsicht(
                  ansicht === "liste" ||
                    ansicht === "schnellantworten" ||
                    ansicht === "sprachen"
                    ? "menu"
                    : "liste",
                );
              }}
              aria-label={t("autoBack")}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon icon="ph:arrow-left" className="size-5" />
            </button>
          )}
          <SheetTitle className="flex-1 text-center">{titel}</SheetTitle>
        </SheetHeader>

        {ansicht === "menu" ? (
          <MenuAnsicht
            onGeplante={() => setAnsicht("liste")}
            onSchnellantworten={() => setAnsicht("schnellantworten")}
            onSprachen={() => setAnsicht("sprachen")}
          />
        ) : ansicht === "schnellantworten" ? (
          <SchnellantwortenAnsicht onTitel={setUnterTitel} />
        ) : ansicht === "sprachen" ? (
          <SprachenAnsicht />
        ) : ansicht === "liste" ? (
          <ListenAnsicht
            items={items}
            geladen={geladen}
            onOeffnen={(r) => setAnsicht({ regel: r })}
          />
        ) : (
          <DetailAnsicht
            regel={ansicht.regel}
            objekte={objekte}
            vorlagen={vorlagen}
            // Bearbeiten: neu laden und IN der Regel bleiben — wer gerade
            // Kanäle gesetzt hat, will das Ergebnis sehen, nicht in der Liste
            // stehen. Die frisch geladene Fassung ersetzt die angezeigte.
            onGeaendert={async () => {
              const frisch = await load();
              const aktuell = frisch.find((a) => a.id === ansicht.regel.id);
              setAnsicht(aktuell ? { regel: aktuell } : "liste");
            }}
            // Löschen: die Regel gibt es nicht mehr, also zurück zur Liste.
            onGeloescht={async () => {
              await load();
              setAnsicht("liste");
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Stufe 1 — die drei Einstiege. */
function MenuAnsicht({
  onGeplante,
  onSchnellantworten,
  onSprachen,
}: {
  onGeplante: () => void;
  onSchnellantworten: () => void;
  onSprachen: () => void;
}) {
  const t = useTranslations("inbox");
  const eintraege = [
    {
      icon: "ph:calendar-dots",
      titel: t("autoScheduledTitle"),
      text: t("autoScheduledHint"),
      onClick: onGeplante,
    },
    {
      icon: "ph:lightning",
      titel: t("autoQuickTitle"),
      text: t("autoQuickHint"),
      onClick: onSchnellantworten,
    },
    {
      icon: "ph:translate",
      titel: t("autoLanguagesTitle"),
      text: t("autoLanguagesHint"),
      onClick: onSprachen,
    },
  ];
  return (
    <ul className="flex flex-col gap-1 overflow-y-auto p-4">
      {eintraege.map((e) => (
        <li key={e.titel}>
          {/* Alle drei Einstiege führen irgendwohin (seit 0363 auch
              Schnellantworten und Sprachen) — deshalb kein deaktivierter
              Zustand mehr: ein Menüpunkt, der sich anklicken lässt und nichts
              tut, ist schlimmer als keiner. */}
          <button
            type="button"
            onClick={e.onClick}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted"
          >
            <Icon icon={e.icon} className="size-6 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{e.titel}</span>
              <span className="block text-sm text-muted-foreground">{e.text}</span>
            </span>
            <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Stufe 2 — Regeln nach Lebenszyklus gruppiert. */
function ListenAnsicht({
  items,
  geladen,
  onOeffnen,
}: {
  items: Automation[];
  geladen: boolean;
  onOeffnen: (a: Automation) => void;
}) {
  const t = useTranslations("inbox");
  // Aufgeklappte Abschnitte („Mehr anzeigen" gedrückt).
  const [offeneGruppen, setOffeneGruppen] = useState<string[]>([]);

  const gruppen = useMemo(() => {
    const zeitplan = items.filter(istZeitplanRegel);
    const nachEingang = items.filter((a) => !istZeitplanRegel(a));
    const map = new Map<string, Automation[]>();
    for (const p of PHASEN) map.set(p, []);
    for (const a of zeitplan) map.get(phaseVon(a))?.push(a);
    for (const liste of map.values()) liste.sort((x, y) => zeitachse(x) - zeitachse(y));
    if (nachEingang.length > 0) map.set("reply", nachEingang);
    return [...map.entries()].filter(([, liste]) => liste.length > 0);
  }, [items]);

  if (!geladen) {
    return <p className="p-6 text-sm text-muted-foreground">{t("autoLoading")}</p>;
  }
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{t("autoEmpty")}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {gruppen.map(([phase, liste]) => {
          const offen = offeneGruppen.includes(phase);
          const sichtbar = offen ? liste : liste.slice(0, SOFORT_SICHTBAR);
          const rest = liste.length - sichtbar.length;
          return (
            <section key={phase}>
              <h3 className="px-1 pb-2 pt-5 text-sm font-semibold text-muted-foreground">
                {t(`autoPhase_${phase}` as never)}
              </h3>
              <ul className="flex flex-col gap-2">
                {sichtbar.map((a) => (
                  <li key={a.id}>
                    <RegelZeile regel={a} onClick={() => onOeffnen(a)} />
                  </li>
                ))}
              </ul>
              {(rest > 0 || offen) && (
                <button
                  type="button"
                  onClick={() =>
                    setOffeneGruppen((prev) =>
                      offen ? prev.filter((p) => p !== phase) : [...prev, phase],
                    )
                  }
                  className="mt-2 px-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {offen ? t("autoShowLess") : t("autoShowMore", { count: rest })}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Eine Regel als Zeile: Zeitplan-Zeile darüber, darunter Name, Kanal-Logos,
 * Reichweite und Status — die Verdichtung, die Lodgify zeigt.
 */
function RegelZeile({ regel, onClick }: { regel: Automation; onClick: () => void }) {
  const t = useTranslations("inbox");
  return (
    <>
      <p className="px-1 pb-1 text-xs text-muted-foreground">{zeitplanText(regel, t)}</p>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{regel.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <KanalLogos kanaele={regel.channels} />
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {regel.property_ids.length === 0
                ? t("autoAllHouses")
                : `${regel.property_ids.length} ${t("autoHousesCount")}`}
            </span>
            <StatusChip aktiv={regel.is_active} />
          </span>
        </span>
        <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </>
  );
}

/**
 * Kanal-Logos wie im Kanalmanager (echte Marken, `lib/channel-logos`). Eine
 * Regel ohne Kanal-Einschränkung gilt für alle — dann steht hier nichts, statt
 * fünf Logos zu zeigen, die eine Auswahl behaupten, die niemand getroffen hat.
 */
function KanalLogos({ kanaele }: { kanaele: string[] }) {
  if (kanaele.length === 0) return null;
  return (
    <>
      {kanaele.map((k) => {
        const logo = channelLogoLoose(k);
        return logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={logo} alt={k} title={k} className="size-4 rounded-sm object-contain" />
        ) : (
          <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {k}
          </span>
        );
      })}
    </>
  );
}

function StatusChip({ aktiv }: { aktiv: boolean }) {
  const t = useTranslations("inbox");
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " +
        (aktiv
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400")
      }
    >
      {aktiv ? t("autoActive") : t("autoPaused")}
    </span>
  );
}

/** Stufe 3 — eine Regel im Detail, in aufklappbaren Abschnitten. */
function DetailAnsicht({
  regel,
  objekte,
  vorlagen,
  onGeaendert,
  onGeloescht,
}: {
  regel: Automation;
  objekte: PanelObjekt[];
  vorlagen: MessageTemplate[];
  onGeaendert: () => void;
  onGeloescht: () => void;
}) {
  const t = useTranslations("inbox");
  const [pending, start] = useTransition();
  // Welcher Auswahl-Dialog ist offen? (Kanäle bzw. Unterkünfte)
  const [wahl, setWahl] = useState<"channels" | "houses" | null>(null);
  // Inhalt bearbeiten (der Stift am Abschnitt „Inhalt").
  const [inhaltOffen, setInhaltOffen] = useState(false);

  // Der Text, der wirklich rausgeht: eigener Text der Regel, sonst der Text
  // der verknüpften Vorlage. Nur „stammt aus einer Vorlage" anzuzeigen, ohne
  // ihn zu holen, beantwortet die eine Frage nicht, die man hier hat.
  const inhalt =
    regel.message?.trim() ||
    vorlagen.find((v) => v.id === regel.template_id)?.body?.trim() ||
    null;

  function umschalten() {
    start(async () => {
      await updateAutomation(regel.id, { ...regel, is_active: !regel.is_active });
      onGeaendert();
    });
  }

  /** Kanäle oder Objekte der Regel speichern und die Liste neu laden. */
  function speichern(feld: "channels" | "property_ids", werte: string[]) {
    setWahl(null);
    start(async () => {
      await updateAutomation(regel.id, { ...regel, [feld]: werte });
      onGeaendert();
    });
  }

  function loeschen() {
    start(async () => {
      await deleteAutomation(regel.id);
      onGeloescht();
    });
  }

  // Die Regel gilt für ALLE Objekte, wenn keines ausgewählt ist — dann zeigt
  // Lodgify trotzdem die volle Liste. Genauso hier: sonst stünde bei der
  // häufigsten Einstellung nichts, wo die meisten Angaben hingehören.
  const gewaehlte =
    regel.property_ids.length === 0
      ? objekte
      : objekte.filter((o) => regel.property_ids.includes(o.id));

  return (
    // `relative`: der Auswahl-Dialog legt sich mit `absolute inset-0` genau
    // über diesen Bereich, nicht über das ganze Fenster.
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* Titelkarte: der Name der Regel steht IN der Fläche, nicht im
            Panelkopf — dort ist er beim Scrollen sofort weg. */}
        <article className="rounded-2xl border border-border p-4">
          <h2 className="font-semibold">{regel.name}</h2>
        </article>

        <article className="rounded-2xl border border-border">
          <label className="flex cursor-pointer items-center justify-between p-4">
            <span className="text-sm font-medium">{t("autoEnableMessage")}</span>
            <Switch
              checked={regel.is_active}
              onCheckedChange={umschalten}
              disabled={pending}
            />
          </label>
        </article>

        {/* Der Stift erscheint nur bei EIGENEM Text. Hängt die Regel an einer
            Vorlage, gehört der Text dorthin — ihn hier zu ändern hieße, die
            Vorlage aller anderen Regeln mitzuändern, ohne dass das dastünde.
            Dann führt die Karte stattdessen zu den Schnellantworten. */}
        <Abschnitt
          titel={t("autoSectionContent")}
          offenAnfangs
          onBearbeiten={regel.template_id ? undefined : () => setInhaltOffen(true)}
        >
          {inhalt ? (
            <p className="whitespace-pre-wrap break-words text-sm">{inhalt}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("autoNoContent")}</p>
          )}
        </Abschnitt>

        {/* Ohne Stift: der Zeitplan wird über den Auslöser bestimmt, nicht hier
            frei getippt — ein Bearbeiten-Symbol würde etwas versprechen, was
            die Karte nicht kann. */}
        <Abschnitt titel={t("autoSectionSchedule")} offenAnfangs nichtKlappbar>
          <p className="text-sm text-muted-foreground">{zeitplanText(regel, t)}</p>
        </Abschnitt>

        <Abschnitt
          titel={t("autoSectionChannels")}
          offenAnfangs
          onBearbeiten={() => setWahl("channels")}
        >
          {regel.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("autoNoChannels")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {regel.channels.map((k) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <KanalLogos kanaele={[k]} />
                  {k}
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>

        <Abschnitt
          titel={t("autoSectionHouses")}
          offenAnfangs
          nichtKlappbar
          onBearbeiten={() => setWahl("houses")}
        >
          {gewaehlte.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("autoAllHouses")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {gewaehlte.map((o) => (
                <li key={o.id} className="flex items-center gap-3">
                  {o.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.photo}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon icon="ph:house" className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {o.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>
      </div>

      {wahl && (
        <AuswahlDialog
          titel={wahl === "channels" ? t("autoManageChannels") : t("autoManageHouses")}
          optionen={
            wahl === "channels"
              ? AUTOMATION_KANAELE.map((c) => ({
                  id: c,
                  label: c,
                  logo: channelLogoLoose(c),
                }))
              : objekte.map((o) => ({ id: o.id, label: o.title, foto: o.photo }))
          }
          gewaehlt={wahl === "channels" ? regel.channels : regel.property_ids}
          onAbbrechen={() => setWahl(null)}
          onBestaetigen={(werte) =>
            speichern(wahl === "channels" ? "channels" : "property_ids", werte)
          }
        />
      )}

      {inhaltOffen && (
        <InhaltBearbeiten
          regel={regel}
          onFertig={() => {
            setInhaltOffen(false);
            onGeaendert();
          }}
          onAbbrechen={() => setInhaltOffen(false)}
        />
      )}

      <div className="flex justify-between gap-2 border-t border-border p-4">
        <Button type="button" variant="outline" disabled>
          <Icon icon="ph:paper-plane-tilt" className="size-4" />
          {t("autoTestMessage")}
        </Button>
        <Button type="button" variant="outline" onClick={loeschen} disabled={pending}>
          <Icon icon="ph:trash" className="size-4" />
          {t("autoDelete")}
        </Button>
      </div>
    </div>
  );
}

/**
 * „Inhalt bearbeiten" — Betreff/Text je Sprache über der Detailansicht (0363).
 *
 * Legt sich mit `absolute inset-0` über den Detailbereich, wie der Auswahl-
 * Dialog: man bleibt in der Regel, statt in eine andere Maske zu wechseln.
 *
 * GESPEICHERT WIRD DIE GANZE REGEL (`updateAutomation` nimmt den vollen
 * Datensatz), aber verändert werden hier nur Text und Betreff — alle übrigen
 * Felder gehen unverändert mit. Nur den Text zu schicken hieße, Zeitplan,
 * Kanäle und Zuweisung auf die Vorgabewerte zurückzusetzen (Wurzel 1: der
 * Gegenzustand gehört zur Änderung).
 */
function InhaltBearbeiten({
  regel,
  onFertig,
  onAbbrechen,
}: {
  regel: Automation;
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const t = useTranslations("inbox");
  const [sprachen, setSprachen] = useState<MessageLanguage[]>([]);
  const [namen, setNamen] = useState<Record<string, string>>({});
  const [fassungen, setFassungen] = useState<Fassungen>({
    [GRUNDFASSUNG]: { subject: regel.subject ?? "", body: regel.message ?? "" },
  });
  const [aktiv, setAktiv] = useState<string>(GRUNDFASSUNG);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const griff = useRef<ComposerGriff | null>(null);

  useEffect(() => {
    void Promise.all([listMessageLanguages(), listAvailableLanguages()]).then(
      ([spr, kat]) => {
        if (!spr.ok) return;
        setSprachen(spr.data.items);
        if (kat.ok) {
          setNamen(Object.fromEntries(kat.data.items.map((o) => [o.code, o.name])));
        }
        // Fassungen erst hier auffüllen: welche Reiter es gibt, weiß man erst
        // mit den Sprachen. Die Grundfassung steht schon im Anfangszustand,
        // damit sie beim ersten Render nicht leer aussieht.
        setFassungen((prev) => {
          const naechste: Fassungen = { ...prev };
          for (const s of spr.data.items) {
            const f = (regel.texts ?? []).find((x) => x.lang === s.code);
            naechste[s.code] = f
              ? { subject: f.subject, body: f.message }
              : { subject: "", body: "" };
          }
          return naechste;
        });
      },
    );
  }, [regel]);

  function speichern() {
    const grund = fassungen[GRUNDFASSUNG] ?? { subject: "", body: "" };
    if (!grund.body.trim()) {
      setFehler(t("autoTextRequired"));
      return;
    }
    setFehler(null);
    const texts = sprachen
      .map((s) => ({ lang: s.code, ...(fassungen[s.code] ?? { subject: "", body: "" }) }))
      .filter((f) => f.body.trim() || f.subject.trim())
      .map((f) => ({ lang: f.lang, subject: f.subject, message: f.body }));
    start(async () => {
      const res = await updateAutomation(regel.id, {
        ...regel,
        message: grund.body,
        subject: grund.subject,
        texts,
      });
      if (res.ok) onFertig();
      else setFehler(res.error);
    });
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <h2 className="font-semibold">{t("autoEditContent")}</h2>
        <SprachReiter
          sprachen={sprachen}
          aktiv={aktiv}
          onAktiv={setAktiv}
          fassungen={fassungen}
          namen={namen}
        />
        {aktiv === GRUNDFASSUNG && sprachen.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("langBaseHint")}</p>
        )}
        <FassungFelder
          // Neu aufbauen beim Reiterwechsel — TipTap führt sein Dokument selbst
          // und hielte zwei gleich aussehende Fassungen für „unverändert".
          key={aktiv}
          format="text"
          mitBetreff={false}
          fassung={fassungen[aktiv] ?? { subject: "", body: "" }}
          onChange={(f) => setFassungen((prev) => ({ ...prev, [aktiv]: f }))}
          griff={griff}
          hoeheSchluessel="inbox.automation.hoehe"
          testId="inbox-automation-panel-textarea"
          platzhalter={t("autoMessage")}
        />
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" variant="outline" onClick={onAbbrechen} disabled={pending}>
          {t("autoCancel")}
        </Button>
        <Button type="button" onClick={speichern} disabled={pending}>
          {t("autoSave")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Auswahl mit Haken über der Detailansicht — die Form, die Lodgify für
 * „Channels verwalten" nutzt: Liste mit Haken, unten Abbrechen/Bestätigen.
 *
 * Die Auswahl wird LOKAL gehalten und erst beim Bestätigen gespeichert; ein
 * Klick daneben verwirft sie. Sonst wäre jeder Haken sofort eine Änderung an
 * einer Regel, die live Nachrichten verschickt.
 */
function AuswahlDialog({
  titel,
  optionen,
  gewaehlt,
  onAbbrechen,
  onBestaetigen,
}: {
  titel: string;
  optionen: { id: string; label: string; logo?: string | null; foto?: string | null }[];
  gewaehlt: string[];
  onAbbrechen: () => void;
  onBestaetigen: (werte: string[]) => void;
}) {
  const t = useTranslations("inbox");
  const [auswahl, setAuswahl] = useState<string[]>(gewaehlt);
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border p-4">
        <button
          type="button"
          onClick={onAbbrechen}
          aria-label={t("autoBack")}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon icon="ph:arrow-left" className="size-5" />
        </button>
        <h2 className="flex-1 text-center font-semibold">{titel}</h2>
      </header>
      <ul className="flex-1 overflow-y-auto p-4">
        {optionen.map((o) => {
          const an = auswahl.includes(o.id);
          return (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-3 hover:bg-muted">
                {o.foto !== undefined &&
                  (o.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.foto} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon icon="ph:house" className="size-4 text-muted-foreground" />
                    </span>
                  ))}
                {o.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logo} alt="" className="size-5 shrink-0 rounded-sm object-contain" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.label}</span>
                <Checkbox
                  checked={an}
                  onCheckedChange={() =>
                    setAuswahl((p) =>
                      p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id],
                    )
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" variant="outline" onClick={onAbbrechen}>
          {t("autoCancel")}
        </Button>
        <Button type="button" onClick={() => onBestaetigen(auswahl)}>
          {t("autoConfirm")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Abschnittskarte der Detailansicht.
 *
 * `offenAnfangs`: Lodgify zeigt alle Abschnitte offen — man will die Regel
 * lesen, nicht erst vier Karten aufklappen. Zuklappen bleibt möglich, weil der
 * Inhalt (eine ganze Nachrichtenvorlage) sonst alles andere nach unten drückt.
 *
 * `nichtKlappbar`: für Abschnitte, deren Inhalt eine Zeile ist — ein Pfeil
 * daran wäre eine Bedienung ohne Zweck.
 */
function Abschnitt({
  titel,
  children,
  offenAnfangs = false,
  nichtKlappbar = false,
  onBearbeiten,
}: {
  titel: string;
  children: React.ReactNode;
  offenAnfangs?: boolean;
  nichtKlappbar?: boolean;
  onBearbeiten?: () => void;
}) {
  const t = useTranslations("inbox");
  const [offen, setOffen] = useState(offenAnfangs);
  const stift = onBearbeiten ? (
    <button
      type="button"
      onClick={onBearbeiten}
      aria-label={t("autoEditSection", { section: titel })}
      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon icon="ph:pencil-simple" className="size-4" />
    </button>
  ) : null;

  if (nichtKlappbar) {
    return (
      <article className="rounded-2xl border border-border p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="flex-1 font-semibold">{titel}</h2>
          {stift}
        </div>
        {children}
      </article>
    );
  }
  return (
    <article className="rounded-2xl border border-border">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setOffen((v) => !v)}
          aria-expanded={offen}
          className="flex flex-1 items-center gap-2 text-left font-semibold"
        >
          <span className="flex-1">{titel}</span>
          <Icon
            icon={offen ? "ph:caret-up" : "ph:caret-down"}
            className="size-4 text-muted-foreground"
          />
        </button>
        {stift}
      </div>
      {offen && <div className="border-t border-border p-4">{children}</div>}
    </article>
  );
}

/**
 * Der Zeitplan als Satz: „3 Tage vor der Ankunft des Gastes".
 *
 * Dieselbe Regel wie im Automatisierungen-Tab — hier NICHT neu erfunden,
 * sondern aus den vorhandenen Bausteinen zusammengesetzt, damit dieselbe Regel
 * an beiden Stellen gleich heißt.
 */
function zeitplanText(
  a: Automation,
  t: (k: string, v?: Record<string, string | number | Date>) => string,
): string {
  if (!istZeitplanRegel(a)) {
    const fenster =
      a.window_from && a.window_to ? `${a.window_from}–${a.window_to}` : t("autoAlways");
    return `${t("autoTrigger_message_received")} · ${fenster}`;
  }
  // `offset_value`/`offset_unit` kamen mit 0303 dazu. Ein Server, der die
  // Felder noch nicht liefert (laufender Prozess vor dem Neustart), schickt
  // `undefined` — daraus wurde `autoUnit_undefined` und die ganze Liste kippte
  // mit MISSING_MESSAGE. Auf die Tages-Sicht zurückfallen, statt zu zerbrechen.
  const einheit = a.offset_unit ?? "days";
  const versatz = a.offset_value ?? a.offset_days ?? 0;
  const abs = Math.abs(versatz);
  const anker = t(`autoAnchor_${a.anchor}`);
  // Zeitzone dazuschreiben, in BEIDEN Fällen: ohne Haken gilt UTC, und „06:00"
  // ohne Zusatz liest jeder als sechs Uhr vor Ort (für Dänemark sind das zwei
  // Stunden Unterschied). Gleiche Regel wie im Automatisierungen-Tab.
  const zone = a.use_property_timezone ? t("autoLocalTime") : "UTC";
  const zeit = a.send_time ? ` · ${a.send_time} (${zone})` : "";
  if (abs === 0) return `${t("autoOnDayOf", { anchor: anker })}${zeit}`;
  const richtung = versatz < 0 ? t("autoBefore") : t("autoAfter");
  return `${abs} ${t(`autoUnit_${einheit}`)} ${richtung} ${anker}${zeit}`;
}
