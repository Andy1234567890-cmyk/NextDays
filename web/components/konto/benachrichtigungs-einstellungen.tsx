"use client";

// Konto → Benachrichtigungen. Je Ereignis ein Schalter pro Kanal.
//
// DIESELBE Komponente bedient zwei Seiten, und das ist Absicht: die eigenen
// Einstellungen (/konto/benachrichtigungen) und die eines Mitarbeiters
// (/konto/nutzer/<id>/benachrichtigungen) sind dieselbe Liste mit demselben
// Katalog — nur das Ziel des PATCH unterscheidet sich. Zwei Oberflächen dafür
// liefen beim nächsten Kanal auseinander (Wurzel 4); welcher Weg gilt,
// entscheidet allein `userId`.
//
// Die Kategorien und ihre Kanäle kommen VOM SERVER (NotificationOverview aus
// dem Katalog). Die Oberfläche führt keine eigene Liste — sie sortiert nur
// (`gruppenSortieren`/`kanaeleSortieren`) und übersetzt. Ein Schalter mit
// `aenderbar: false` ist eine vertraglich nötige Mail: er bleibt an und ist
// gesperrt, statt eine Änderung vorzutäuschen, die das Backend zurückdreht.
//
// GRUPPEN KLAPPEN AUF, und zwar alle zugeklappt: 40 Ereignisse in acht Gruppen
// sind aufgeklappt eine Seite, die man scrollen statt lesen muss. Damit der
// zugeklappte Zustand trotzdem etwas sagt, trägt jede Gruppenzeile einen Zähler
// je Kanal („E-Mail 4/6"). Genau das ist die Frage, mit der jemand hierher
// kommt — „woher kommen die vielen Mails" —, und sie ist so ohne einen
// einzigen Klick beantwortet. Eine bloße Überschrift mit Pfeil hätte die
// Antwort hinter acht Klicks versteckt.
//
// Der Zähler zählt aus `zustand`, nicht aus der Server-Antwort: er muss sich
// mit jedem Schalter sofort mitbewegen, sonst widerspricht die eingeklappte
// Zeile dem, was eine Zeile darunter zu sehen ist (Wurzel 1 im Kleinen).
//
// Kein Realtime-Abo: `notification_settings` ist für `authenticated` bewusst
// gesperrt (Wurzel 6), ein Abo darauf wäre eine stumme Attrappe. Es gibt hier
// auch keinen zweiten Schreiber, auf dessen Ereignis man hören müsste.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@nextdays/ui/accordion";
import { Switch } from "@nextdays/ui/switch";
import { setzeEigene, setzeFuerNutzer } from "@/lib/benachrichtigungen";
import {
  KANAL_REIHENFOLGE,
  type KategorieInfo,
  type NotificationOverview,
  gruppenSortieren,
} from "@/lib/benachrichtigungen-typen";

/** Die Tabs des Katalogs. `konto` = Betrieb, `angebote` = Marketing. */
const TAB_BETRIEB = "konto";
const TAB_MARKETING = "angebote";

export function BenachrichtigungsEinstellungen({
  overview,
  error,
  userId = null,
}: {
  overview: NotificationOverview | null;
  error: string | null;
  /**
   * Wessen Einstellungen. `null` = die eigenen (der Server nimmt die ID aus
   * dem Token). Gesetzt = die eines Nutzers des eigenen Betriebs; der Server
   * verlangt dafür MANAGE_STAFF und prüft den Tenant erneut — die Oberfläche
   * ist hier nicht der Schutz, nur der Weg.
   */
  userId?: string | null;
}) {
  const t = useTranslations("account.notifications");

  // Lokaler Zustand je Spalte (`<schluessel>_<kanal>`), damit der Schalter
  // sofort reagiert. Scheitert das PATCH, wird er zurückgedreht — es bleibt
  // kein falscher Zustand stehen (Wurzel 5).
  const [zustand, setZustand] = useState<Record<string, boolean>>(() => {
    const z: Record<string, boolean> = {};
    for (const k of overview?.kategorien ?? []) {
      for (const kanal of k.kanaele) {
        z[`${k.schluessel}_${kanal.kanal}`] = kanal.aktiv;
      }
    }
    return z;
  });
  const [abgemeldet, setAbgemeldet] = useState(
    overview?.marketing_unsubscribed_all ?? false,
  );
  const [speichert, setSpeichert] = useState<string | null>(null);

  const kategorien = overview?.kategorien ?? [];
  // Kategorien ohne Kanal erscheinen nicht: das sind die reinen Glocken-
  // Meldungen (Störungen, Systemwarnungen). Sie haben bewusst keine
  // Präferenzspalte — eine Zeile ohne Schalter wäre eine leere Behauptung.
  const mitKanaelen = kategorien.filter((k) => k.kanaele.length > 0);
  const betrieb = mitKanaelen.filter((k) => k.tab === TAB_BETRIEB);
  const marketing = mitKanaelen.filter((k) => k.tab === TAB_MARKETING);

  /** Ein PATCH auf den richtigen Weg schicken — eigener oder fremder Nutzer. */
  const senden = async (patch: Record<string, boolean>) =>
    userId ? setzeFuerNutzer(userId, patch) : setzeEigene(patch);

  const umschalten = async (spalte: string, neu: boolean) => {
    if (speichert) return;
    const vorher = zustand[spalte];
    setZustand((z) => ({ ...z, [spalte]: neu }));
    setSpeichert(spalte);
    const res = await senden({ [spalte]: neu });
    setSpeichert(null);
    if (!res.ok) {
      setZustand((z) => ({ ...z, [spalte]: vorher }));
      toast.error(res.error || t("saveFailed"));
      return;
    }
    // Der Server ist die Wahrheit: er erzwingt Pflicht-Mails zurück auf „an"
    // und pflegt das Sammel-Opt-out mit. Die ganze Antwort übernehmen, statt
    // dem lokalen Klick zu glauben — sonst zeigte die Liste einen Zustand, den
    // die Datenbank nicht hat (Wurzel 1: der Gegenzustand wandert mit).
    uebernehmen(res.data);
    toast.success(t("saved"));
  };

  /** Die Serverantwort in den lokalen Zustand spiegeln. */
  const uebernehmen = (antwort: Record<string, unknown>) => {
    const neu: Record<string, boolean> = {};
    for (const [feld, wert] of Object.entries(antwort)) {
      if (typeof wert === "boolean" && feld !== "marketing_unsubscribed_all") {
        neu[feld] = wert;
      }
    }
    setZustand((z) => ({ ...z, ...neu }));
    if (typeof antwort.marketing_unsubscribed_all === "boolean") {
      setAbgemeldet(antwort.marketing_unsubscribed_all);
    }
  };

  const sammelOptOut = async (neu: boolean) => {
    if (speichert) return;
    const vorher = abgemeldet;
    setAbgemeldet(neu);
    setSpeichert("marketing_unsubscribed_all");
    const res = await senden({ marketing_unsubscribed_all: neu });
    setSpeichert(null);
    if (!res.ok) {
      setAbgemeldet(vorher);
      toast.error(res.error || t("saveFailed"));
      return;
    }
    uebernehmen(res.data);
    toast.success(t("saved"));
  };

  if (error) {
    return (
      <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (mitKanaelen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-(--radius) border border-dashed border-border py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon icon="ph:bell" className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Bereich
        titel={t("operations")}
        hinweis={t("operationsHint")}
        kategorien={betrieb}
        zustand={zustand}
        speichert={speichert}
        umschalten={umschalten}
      />

      {marketing.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Das Sammel-Opt-out steht ÜBER den Einzelschaltern, weil es sie
              überstimmt: einschalten löscht alle Marketing-Kanäle. Umgekehrt
              schaltet Ausschalten NICHTS wieder an — welche der elf Kategorien
              jemand zurückwill, weiß nur er (Wurzel 4, kein erfundener Zustand).
              Der Text darunter sagt das, damit der leere Zustand nicht wie ein
              Fehler aussieht. */}
          <label className="flex items-start gap-3 rounded-(--radius) border border-border bg-secondary/40 p-4">
            <Switch
              checked={abgemeldet}
              disabled={speichert === "marketing_unsubscribed_all"}
              onCheckedChange={(wert) => {
                void sammelOptOut(wert);
              }}
              aria-label={t("unsubscribeAll")}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("unsubscribeAll")}</span>
              <span className="text-xs text-muted-foreground">
                {t("unsubscribeAllHint")}
              </span>
            </span>
          </label>

          <Bereich
            titel={t("marketing")}
            hinweis={t("marketingHint")}
            kategorien={marketing}
            zustand={zustand}
            speichert={speichert}
            umschalten={umschalten}
          />
        </div>
      )}
    </div>
  );
}

/** Ein Tab des Katalogs, nach Gruppen gegliedert. */
function Bereich({
  titel,
  hinweis,
  kategorien,
  zustand,
  speichert,
  umschalten,
}: {
  titel: string;
  hinweis: string;
  kategorien: KategorieInfo[];
  zustand: Record<string, boolean>;
  speichert: string | null;
  umschalten: (spalte: string, neu: boolean) => Promise<void>;
}) {
  const gruppen = gruppenSortieren([
    ...new Set(kategorien.map((k) => k.gruppe)),
  ]);
  // Die Kanäle DIESES Bereichs — und zwar alle, die irgendeine seiner
  // Kategorien anbietet. Sie werden zu festen Spalten: „Betrieb" bekommt
  // E-Mail · Push · SMS, „Angebote und Updates" E-Mail · SMS · Telefon.
  //
  // Das ist der Grund für den ganzen Umbau. Vorher hing jeder Schalter an
  // seinem eigenen Label und rutschte dorthin, wo die Kategorie ihn eben
  // hinschob: `betrieb_chat` (E-Mail, Push) setzte den Push-Schalter genau an
  // die Stelle, an der eine Zeile darüber der SMS-Schalter stand. Auf dem
  // Bildschirm ergab das drei Zickzack-Spalten statt drei Spalten — man konnte
  // nicht mit dem Auge an einer Kante herunterfahren und sehen, wo E-Mail an
  // ist, und genau das will jemand tun, der seine Mails ausdünnt.
  const bereichsKanaele = KANAL_REIHENFOLGE.filter((kanal) =>
    kategorien.some((k) => k.kanaele.some((kn) => kn.kanal === kanal)),
  );
  if (gruppen.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold">{titel}</h2>
        <p className="text-sm text-muted-foreground">{hinweis}</p>
      </header>
      {/* `multiple`, nicht `single`: wer Mails ausdünnt, vergleicht Gruppen —
          eine, die beim Öffnen der nächsten wieder zuklappt, zwingt zum
          Hin-und-Her. Ohne `defaultValue` startet alles zu. */}
      <Accordion
        type="multiple"
        className="rounded-(--radius) border border-border px-4"
      >
        {gruppen.map((gruppe) => (
          <Gruppe
            key={gruppe}
            gruppe={gruppe}
            kategorien={kategorien.filter((k) => k.gruppe === gruppe)}
            bereichsKanaele={bereichsKanaele}
            zustand={zustand}
            speichert={speichert}
            umschalten={umschalten}
          />
        ))}
      </Accordion>
    </section>
  );
}

/**
 * Das Spaltenraster: Beschriftung links, dann je Kanal eine gleich breite
 * Spalte. EINE Funktion für Gruppenzeile, Spaltenkopf und Kategoriezeile —
 * liefe die Breite an drei Stellen auseinander, stünden die Schalter wieder
 * neben ihrer Überschrift statt darunter.
 */
function raster(anzahlKanaele: number) {
  return {
    display: "grid",
    gridTemplateColumns: `minmax(0, 1fr) repeat(${anzahlKanaele}, 5rem)`,
    alignItems: "center",
    columnGap: "0.5rem",
  } as const;
}

/**
 * Wie viele Schalter eines Kanals in dieser Gruppe an sind — „4/6".
 *
 * Gezählt wird nur, wo der Kanal überhaupt angeboten wird: `betrieb_chat` hat
 * kein SMS, darf den Nenner also nicht erhöhen. Sonst stünde bei einer Gruppe
 * „SMS 0/6", obwohl nur zwei der sechs SMS je könnten — eine Zahl, die zum
 * Suchen nach einem Schalter einlädt, den es nicht gibt.
 */
function kanalZaehlen(
  kategorien: KategorieInfo[],
  zustand: Record<string, boolean>,
  kanal: string,
): { an: number; gesamt: number } {
  let an = 0;
  let gesamt = 0;
  for (const k of kategorien) {
    for (const kn of k.kanaele) {
      if (kn.kanal !== kanal) continue;
      gesamt += 1;
      if (zustand[`${k.schluessel}_${kn.kanal}`] ?? kn.aktiv) an += 1;
    }
  }
  return { an, gesamt };
}

function Gruppe({
  gruppe,
  kategorien,
  bereichsKanaele,
  zustand,
  speichert,
  umschalten,
}: {
  gruppe: string;
  kategorien: KategorieInfo[];
  bereichsKanaele: string[];
  zustand: Record<string, boolean>;
  speichert: string | null;
  umschalten: (spalte: string, neu: boolean) => Promise<void>;
}) {
  const t = useTranslations("account.notifications");
  const stil = raster(bereichsKanaele.length);

  return (
    <AccordionItem value={gruppe}>
      {/* `gap-0`, weil das Raster den Abstand führt — der Flex-Abstand des
          Triggers würde die Spalten sonst um seine eigene Lücke verschieben. */}
      <AccordionTrigger className="gap-0">
        <span style={stil} className="min-w-0 flex-1 pr-3">
          {/* Fehlt ein Label, steht der Katalog-Schlüssel da — sichtbar falsch
              statt still leer (Wurzel 4). */}
          <span className="truncate text-left">
            {t.has(`groups.${gruppe}`) ? t(`groups.${gruppe}`) : gruppe}
          </span>
          {bereichsKanaele.map((kanal) => {
            const { an, gesamt } = kanalZaehlen(kategorien, zustand, kanal);
            return (
              <span
                key={kanal}
                className="text-center text-xs font-normal tabular-nums text-muted-foreground"
              >
                {/* Kennt diese Gruppe den Kanal nicht, bleibt die Spalte leer
                    statt „0/0" zu behaupten — aber sie bleibt STEHEN, sonst
                    rutschen die Nachbarspalten wieder. */}
                {gesamt === 0 ? (
                  <span aria-hidden>·</span>
                ) : (
                  <span className={an === 0 ? "opacity-60" : "text-foreground"}>
                    {an}/{gesamt}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      </AccordionTrigger>

      <AccordionContent className="pb-4">
        <div className="rounded-(--radius) border border-border">
          {/* Spaltenkopf: der Kanalname steht EINMAL oben statt neben jedem
              der 40 Schalter. Das war die zweite Hälfte der Unruhe — vierzig
              Wörter „E-Mail", die je nach Textlänge der Zeile woanders
              anfingen. */}
          <div
            style={stil}
            className="border-b border-border px-4 py-2 text-xs text-muted-foreground"
          >
            <span />
            {bereichsKanaele.map((kanal) => (
              <span key={kanal} className="text-center">
                {t.has(`channel.${kanal}`) ? t(`channel.${kanal}`) : kanal}
              </span>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {kategorien.map((k) => (
              <Zeile
                key={k.schluessel}
                kategorie={k}
                bereichsKanaele={bereichsKanaele}
                zustand={zustand}
                speichert={speichert}
                umschalten={umschalten}
              />
            ))}
          </ul>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function Zeile({
  kategorie,
  bereichsKanaele,
  zustand,
  speichert,
  umschalten,
}: {
  kategorie: KategorieInfo;
  bereichsKanaele: string[];
  zustand: Record<string, boolean>;
  speichert: string | null;
  umschalten: (spalte: string, neu: boolean) => Promise<void>;
}) {
  const t = useTranslations("account.notifications");
  const k = kategorie;
  // Nachschlagewerk statt Suche in der Schleife: jede Zelle fragt nach IHREM
  // Kanal, und die Kategorie kennt nur ihre eigenen.
  const nachKanal = new Map(k.kanaele.map((kn) => [kn.kanal, kn]));

  return (
    <li style={raster(bereichsKanaele.length)} className="px-4 py-3">
      <div className="flex min-w-0 flex-col pr-3">
        <span className="text-sm font-medium">
          {t.has(`categories.${k.schluessel}`)
            ? t(`categories.${k.schluessel}`)
            : k.schluessel}
        </span>
        {t.has(`categories.${k.schluessel}Hint`) && (
          <span className="text-xs text-muted-foreground">
            {t(`categories.${k.schluessel}Hint`)}
          </span>
        )}
      </div>

      {bereichsKanaele.map((kanal) => {
        const kn = nachKanal.get(kanal);
        // Diese Kategorie kennt den Kanal nicht. Die Zelle bleibt leer — ein
        // ausgegrauter Schalter würde behaupten, man könne ihn einschalten.
        if (!kn) {
          return (
            <span
              key={kanal}
              className="text-center text-xs text-muted-foreground opacity-40"
              aria-hidden
            >
              –
            </span>
          );
        }
        const spalte = `${k.schluessel}_${kanal}`;
        const an = zustand[spalte] ?? kn.aktiv;
        return (
          <span key={kanal} className="flex items-center justify-center gap-1">
            <Switch
              checked={an}
              disabled={!kn.aenderbar || speichert === spalte}
              onCheckedChange={(wert) => {
                void umschalten(spalte, wert);
              }}
              // Der sichtbare Spaltenkopf trägt den Kanalnamen, die Zeile den
              // Ereignisnamen — beides steht für ein Auge nebeneinander, für
              // einen Screenreader aber nicht. Das Label sagt darum beides.
              aria-label={`${
                t.has(`categories.${k.schluessel}`)
                  ? t(`categories.${k.schluessel}`)
                  : k.schluessel
              } — ${t.has(`channel.${kanal}`) ? t(`channel.${kanal}`) : kanal}`}
              title={kn.aenderbar ? undefined : t("locked")}
            />
            {!kn.aenderbar && (
              // `title` am umschliessenden Element: die Iconify-Komponente
              // nimmt kein `title` entgegen (tsc TS2322), und ohne Hinweis
              // waere das Schloss ein Symbol ohne Erklaerung.
              <span title={t("locked")} className="flex shrink-0">
                <Icon
                  icon="ph:lock-simple"
                  className="size-3.5 text-muted-foreground"
                />
              </span>
            )}
          </span>
        );
      })}
    </li>
  );
}
