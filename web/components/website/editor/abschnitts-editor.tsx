"use client";

// Der Seiten-Editor: „Bearbeiten"-Leiste links, Live-Vorschau rechts.
//
// Das ist der Ersatz für den alten Framer-Canvas (Kamera, Zoom, Frames mit
// x/y/w/h, Layer-Baum, Breakpoint-Flächen, Effects). Der war für Ferienvermieter
// unbedienbar — und der Großteil davon wurde nie gespeichert, weil eine Seite in
// der DB eine FLACHE, geordnete Liste ist. Was bleibt, ist genau das, was die
// Datenstruktur wirklich hergibt:
//
//   • Abschnitte hinzufügen, sortieren, löschen
//   • die Felder eines Abschnitts füllen
//   • sofort sehen, wie es aussieht
//
// Autospeichern statt Speichern-Knopf: der Kunde füllt ein Feld, sieht rechts
// die Folge und arbeitet weiter. Ein Bestätigungsschritt dazwischen ist eine
// Fehlerquelle ohne Nutzen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AbschnittEingabe,
  type Block,
  type BlockType,
  type Page,
  createDraftToken,
  speichereAbschnitte,
} from "@/lib/site-pages";

import { ABSCHNITTE, MAX_ABSCHNITTE, abschnittFuer } from "../abschnitte";
import {
  BaukastenSchale,
  LeisteTitel,
  LeisteUnterseite,
  SpeicherAnzeige,
  type SpeicherStand,
} from "../schale";
import { type Geraet, VorschauFlaeche } from "../vorschau";
import { AbschnittInspektor } from "./abschnitt-inspektor";
import { AbschnittKatalog } from "./abschnitt-katalog";

/** Ein Abschnitt im Editor. `id: null` = noch nicht gespeichert.
 *  `key` ist stabil über Umsortieren hinweg (React-Identität), die DB-`id`
 *  eignet sich dafür nicht, weil neue Abschnitte noch keine haben. */
type Zeile = {
  key: string;
  id: string | null;
  typ: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

/** Origin des Renderers — Absender-Prüfung für die postMessage-Brücke.
 *  Ist er nicht konfiguriert, gibt es ohnehin keine Vorschau. */
const RENDERER_ORIGIN = (() => {
  const roh = process.env.NEXT_PUBLIC_BUILDER_URL;
  if (!roh) return null;
  try {
    return new URL(roh).origin;
  } catch {
    return null;
  }
})();

/** Locale-Map aus einem Content-Feld (leeres Objekt, wenn es keine ist). */
function alsKarte(v: unknown): Record<string, string> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, string>)
    : {};
}

let laufendeNummer = 0;
function neuerKey(): string {
  laufendeNummer += 1;
  return `neu-${laufendeNummer}`;
}

function zuZeilen(blocks: Block[]): Zeile[] {
  return blocks.map((b) => ({
    key: b.id,
    id: b.id,
    typ: b.type,
    content: b.content,
    settings: b.settings,
  }));
}

const ENTPRELLUNG_MS = 900;
const QUITTUNG_MS = 2500;

export function AbschnittsEditor({
  page,
  pages,
  initialBlocks,
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
}) {
  const t = useTranslations("website");
  // Bearbeitet wird die Sprache des Dashboards. Sie geht an den iframe (der
  // zeigt und bearbeitet dieselbe) und an den Inspektor — sonst tippt der Kunde
  // in der Vorschau auf Deutsch und im Formular auf Englisch.
  const locale = useLocale();

  const [zeilen, setZeilen] = useState<Zeile[]>(() => zuZeilen(initialBlocks));
  const [bestaetigt, setBestaetigt] = useState<string>(() =>
    JSON.stringify(zuZeilen(initialBlocks)),
  );
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [katalogOffen, setKatalogOffen] = useState(false);
  const [geraet, setGeraet] = useState<Geraet>("desktop");
  const [stand, setStand] = useState<SpeicherStand>("ruht");

  // --- Live-Vorschau ------------------------------------------------------
  const [token, setToken] = useState<string | null>(null);
  const [tokenFehler, setTokenFehler] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [neuLaden, setNeuLaden] = useState(0);

  useEffect(() => {
    let lebt = true;
    createDraftToken(page.id).then((res) => {
      if (!lebt) return;
      if (res.ok) setToken(res.data.token);
      else setTokenFehler(true);
    });
    return () => {
      lebt = false;
    };
  }, [page.id]);

  // --- Autospeichern ------------------------------------------------------
  const zeilenRef = useRef(zeilen);
  zeilenRef.current = zeilen;
  const laeuft = useRef(false);

  /** Läuft ein Speichervorgang, während sich etwas ändert? Dann NACHHOLEN,
   *  nicht verwerfen. */
  const nachholen = useRef(false);

  const schreibe = useCallback(async () => {
    // Ein zweiter Lauf während des ersten würde denselben Stand doppelt
    // schreiben. Also vormerken und nach dem Abschluss einmal nachholen —
    // früher wurde er still verworfen, und die letzte Eingabe ging verloren.
    if (laeuft.current) {
      nachholen.current = true;
      return;
    }
    const gesendet = zeilenRef.current;
    laeuft.current = true;
    setStand("speichert");
    const items: AbschnittEingabe[] = gesendet.map((r) => ({
      id: r.id,
      type: r.typ,
      content: r.content,
      settings: r.settings,
    }));
    const res = await speichereAbschnitte(page.id, items);
    laeuft.current = false;

    if (!res.ok) {
      setStand("fehler");
      toast.error(res.error);
      return;
    }

    // Die Antwort trägt die echten DB-IDs — die brauchen wir, sonst legt der
    // nächste Lauf dieselben Abschnitte erneut an.
    //
    // Zwischen Absenden und Antwort kann der Kunde weitergetippt haben. Den
    // Serverstand blind zu übernehmen würde diese Eingabe verschlucken; sie
    // einfach zu behalten würde die IDs verlieren. Also: IDs vom Server,
    // Inhalte vom lokalen Stand, wo er sich seit dem Absenden geändert hat.
    const vomServer = zuZeilen(res.data.items);
    const inzwischen = zeilenRef.current;
    const verschmolzen = vomServer.map((zeile, i) => {
      const lokal = inzwischen[i];
      const gesendetItem = gesendet[i];
      // Nur übernehmen, wenn dieselbe Position noch denselben Typ trägt und der
      // Inhalt sich seit dem Absenden geändert hat.
      const lokalGeaendert =
        lokal &&
        gesendetItem &&
        lokal.typ === zeile.typ &&
        JSON.stringify(lokal.content) !== JSON.stringify(gesendetItem.content);
      return lokalGeaendert ? { ...zeile, content: lokal.content } : zeile;
    });

    // Auswahl über die POSITION retten — die Keys kommen neu vom Server.
    const index = gesendet.findIndex((r) => r.key === aktiv);
    setZeilen(verschmolzen);
    // Der bestätigte Stand ist der SERVERSTAND, nicht der verschmolzene: sonst
    // gilt eine noch nicht gespeicherte Eingabe als gespeichert.
    setBestaetigt(JSON.stringify(vomServer));
    setAktiv(index >= 0 ? (verschmolzen[index]?.key ?? null) : null);
    setStand("gespeichert");
    setNeuLaden((n) => n + 1);

    if (nachholen.current) {
      nachholen.current = false;
      // Kurz warten, damit React den neuen Stand übernommen hat, bevor der
      // nächste Lauf `zeilenRef` liest.
      setTimeout(() => void schreibeRef.current?.(), 0);
    }
  }, [aktiv, page.id]);

  // Selbstbezug über eine Ref, weil `schreibe` sich beim Nachholen selbst
  // aufruft und eine direkte Rekursion die useCallback-Kette bräche.
  const schreibeRef = useRef(schreibe);
  schreibeRef.current = schreibe;

  useEffect(() => {
    if (JSON.stringify(zeilen) === bestaetigt) return;
    const timer = setTimeout(() => void schreibe(), ENTPRELLUNG_MS);
    return () => clearTimeout(timer);
  }, [zeilen, bestaetigt, schreibe]);

  useEffect(() => {
    if (stand !== "gespeichert") return;
    const timer = setTimeout(() => setStand("ruht"), QUITTUNG_MS);
    return () => clearTimeout(timer);
  }, [stand]);

  /** Gibt es ungespeicherte Arbeit? */
  const offen = JSON.stringify(zeilen) !== bestaetigt;

  // Warnen, bevor die Seite verlassen wird. Der Entprellungs-Timer läuft 900 ms
  // — wer direkt nach der letzten Eingabe wegklickt, verliert sie sonst
  // lautlos. Es gab dafür bisher keinen Schutz.
  useEffect(() => {
    if (!offen) return;
    function aufVerlassen(e: BeforeUnloadEvent) {
      // Den Speichervorgang noch anstoßen — vielleicht schafft er es.
      void schreibeRef.current?.();
      // Der Text ist frei erfunden und wird von keinem modernen Browser
      // angezeigt; entscheidend ist preventDefault (so ist die Schnittstelle).
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", aufVerlassen);
    return () => window.removeEventListener("beforeunload", aufVerlassen);
  }, [offen]);

  /**
   * Begrüßung an die Vorschau, bis sie antwortet.
   *
   * Die Brücke im iframe schickt ihre Meldungen nur an einen Origin, der sich
   * vorgestellt hat — sonst müsste sie "*" verwenden und würde ihre Nachrichten
   * an jede beliebige einbettende Seite ausliefern.
   *
   * Eine EINMALIGE Begrüßung im `onLoad` reicht dafür nicht: das Load-Event des
   * iframes feuert, bevor React darin hydratisiert hat und die Brücke ihren
   * `message`-Empfänger installiert. Die Begrüßung landete also im Leeren, und
   * jede spätere Textänderung wurde still verworfen — die Vorschau ließ sich
   * bearbeiten, aber nichts kam an. Deshalb: wiederholen, bis „ready" da ist.
   */
  const begruesst = useRef(false);
  const handschlag = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auch die Aufgabe-Frist braucht ein Handle: sie wurde nie abgeräumt, und
  // weil jeder Speichervorgang die Vorschau neu lädt, stapelten sich die
  // Fristen — eine alte beendete dann den Handschlag eines neuen iframes, und
  // ab da kam keine Textänderung mehr an.
  const frist = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stoppeHandschlag = useCallback(() => {
    if (handschlag.current) {
      clearInterval(handschlag.current);
      handschlag.current = null;
    }
    if (frist.current) {
      clearTimeout(frist.current);
      frist.current = null;
    }
  }, []);

  const iframeBereit = useCallback(() => {
    begruesst.current = false;
    stoppeHandschlag();
    const gruessen = () => {
      if (begruesst.current) {
        stoppeHandschlag();
        return;
      }
      iframeRef.current?.contentWindow?.postMessage(
        { source: "builder-editor", type: "hello" },
        // Zielt auf den Renderer, nicht auf "*": eine Begrüßung an jeden Origin
        // wäre der Anfang, den die Brücke gerade vermeiden soll.
        RENDERER_ORIGIN ?? "*",
      );
    };
    gruessen();
    handschlag.current = setInterval(gruessen, 250);
    // Nach 10 Sekunden aufgeben — dann ist der iframe nicht die Vorschau, und
    // ein Intervall, das ewig weiterläuft, ist ein Leck.
    frist.current = setTimeout(stoppeHandschlag, 10_000);
  }, [stoppeHandschlag]);

  // Intervall beim Verlassen der Seite abräumen.
  useEffect(() => stoppeHandschlag, [stoppeHandschlag]);

  // --- Klick in der Vorschau → Abschnitt auswählen ------------------------
  const aufNachricht = useCallback(
    (e: MessageEvent) => {
      // Nur der Renderer darf hier hineinreden. Origin prüfen, nicht nur das
      // `source`-Feld — das kann jede Seite behaupten (Wurzel 3).
      //
      // Fail-CLOSED: ist der Renderer-Origin nicht konfiguriert, wird NICHTS
      // angenommen. Vorher entfiel die Prüfung in diesem Fall ganz, und jede
      // fremde Seite mit einem Handle auf dieses Fenster hätte Kundeninhalte
      // schreiben können. Ohne Origin gibt es ohnehin keine Vorschau.
      if (!RENDERER_ORIGIN || e.origin !== RENDERER_ORIGIN) return;
      const data = e.data as {
        source?: string;
        type?: string;
        index?: number;
        feld?: string;
        wert?: string;
      };
      if (data?.source !== "builder-canvas") return;

      if (data.type === "ready") {
        begruesst.current = true;
        stoppeHandschlag();
        return;
      }

      if (data.type === "select" && typeof data.index === "number") {
        const zeile = zeilenRef.current[data.index];
        if (zeile) setAktiv(zeile.key);
        return;
      }

      // Text in der Vorschau geändert → in den Stand des betroffenen
      // Abschnitts schreiben. Das Autospeichern greift dann wie bei einer
      // Eingabe im Formular.
      if (
        data.type === "text" &&
        typeof data.index === "number" &&
        typeof data.feld === "string" &&
        typeof data.wert === "string"
      ) {
        const zeile = zeilenRef.current[data.index];
        if (!zeile) return;
        // Nur Felder, die der Katalog für diesen Abschnitt kennt. Sonst könnte
        // eine manipulierte Nachricht beliebige Schlüssel in den Inhalt
        // schreiben, die das Backend anschließend als 422 abweist.
        const meta = abschnittFuer(zeile.typ);
        if (!meta?.felder.some((f) => f.key === data.feld)) return;
        setZeilen((z) =>
          z.map((r) => {
            if (r.key !== zeile.key) return r;
            const karte = { ...(alsKarte(r.content[data.feld!]) as Record<string, string>) };
            // Leerer Text entfernt den Eintrag statt einen Leerstring zu
            // speichern — sonst zeigt der Renderer eine leere Überschrift
            // statt gar keine.
            if (data.wert) karte[locale] = data.wert!;
            else delete karte[locale];
            return { ...r, content: { ...r.content, [data.feld!]: karte } };
          }),
        );
      }
    },
    [locale, stoppeHandschlag],
  );

  useEffect(() => {
    window.addEventListener("message", aufNachricht);
    return () => window.removeEventListener("message", aufNachricht);
  }, [aufNachricht]);


  // --- Bearbeiten ---------------------------------------------------------
  function hinzufuegen(typ: BlockType) {
    if (zeilen.length >= MAX_ABSCHNITTE) {
      toast.error(t("editor.maxAbschnitte", { max: MAX_ABSCHNITTE }));
      return;
    }
    const key = neuerKey();
    setZeilen((z) => [...z, { key, id: null, typ, content: {}, settings: {} }]);
    setAktiv(key);
    setKatalogOffen(false);
  }

  function aendere(key: string, content: Record<string, unknown>) {
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, content } : r)));
  }

  /** Die Darstellungs-Einstellungen eines Abschnitts (0432).
   *
   *  Sie wurden bisher NUR durchgereicht: `background_color`, `padding` und die
   *  Stil-Werte standen im Backend-Schema (`BlockSettings`) und in der
   *  Datenbank, aber es gab keine Oberfläche, sie zu setzen. Damit waren sie
   *  eine Attrappe — der Renderer liest sie, niemand konnte sie füllen. */
  function aendereSettings(key: string, settings: Record<string, unknown>) {
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, settings } : r)));
  }

  function entferne(key: string) {
    setZeilen((z) => z.filter((r) => r.key !== key));
    setAktiv((a) => (a === key ? null : a));
  }

  function verschiebe(key: string, richtung: -1 | 1) {
    setZeilen((z) => {
      const i = z.findIndex((r) => r.key === key);
      const j = i + richtung;
      if (i < 0 || j < 0 || j >= z.length) return z;
      const kopie = [...z];
      [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
      return kopie;
    });
  }

  function dupliziere(key: string) {
    if (zeilen.length >= MAX_ABSCHNITTE) {
      toast.error(t("editor.maxAbschnitte", { max: MAX_ABSCHNITTE }));
      return;
    }
    setZeilen((z) => {
      const i = z.findIndex((r) => r.key === key);
      if (i < 0) return z;
      const quelle = z[i]!;
      const kopie = [...z];
      kopie.splice(i + 1, 0, {
        key: neuerKey(),
        // Bewusst OHNE id: die Kopie ist ein neuer Abschnitt. Mit derselben id
        // wäre es zweimal dieselbe Zeile — das Backend weist das ab.
        id: null,
        typ: quelle.typ,
        content: structuredClone(quelle.content),
        settings: structuredClone(quelle.settings),
      });
      return kopie;
    });
  }

  const aktiveZeile = zeilen.find((r) => r.key === aktiv) ?? null;

  // Der Inspektor ersetzt die Liste, solange ein Abschnitt gewählt ist:
  // beides übereinander wäre in einer Spalte dieser Breite unlesbar, und der
  // Kunde müsste scrollen, um zu sehen, was er gerade bearbeitet.
  const seitenleiste = aktiveZeile ? (
    <LeisteUnterseite titel={t("editor.zurListe")} onZurueck={() => setAktiv(null)}>
      <AbschnittInspektor
        typ={aktiveZeile.typ}
        content={aktiveZeile.content}
        settings={aktiveZeile.settings}
        onChange={(c) => aendere(aktiveZeile.key, c)}
        onSettings={(st) => aendereSettings(aktiveZeile.key, st)}
      />
    </LeisteUnterseite>
  ) : (
    <div className="flex flex-col pb-8">
      <LeisteTitel>{t("editor.abschnitte")}</LeisteTitel>
      {zeilen.length === 0 ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          {t("editor.nochKeineAbschnitte")}
        </p>
      ) : (
        <ul>
          {zeilen.map((r, i) => {
            const meta = abschnittFuer(r.typ);
            return (
              <li key={r.key}>
                <div className="group flex items-center gap-1.5 px-4 py-1.5 transition hover:bg-secondary/60">
                  <Icon
                    icon={meta?.icon ?? "ph:question"}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setAktiv(r.key)}
                    className="min-w-0 flex-1 truncate text-left text-sm"
                  >
                    {meta
                      ? t(`abschnitte.${meta.label}`)
                      : t("editor.unbekannterAbschnitt")}
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconKnopf
                      icon="ph:caret-up"
                      label={t("editor.nachOben")}
                      disabled={i === 0}
                      onClick={() => verschiebe(r.key, -1)}
                    />
                    <IconKnopf
                      icon="ph:caret-down"
                      label={t("editor.nachUnten")}
                      disabled={i === zeilen.length - 1}
                      onClick={() => verschiebe(r.key, 1)}
                    />
                    <IconKnopf
                      icon="ph:copy"
                      label={t("editor.duplizieren")}
                      onClick={() => dupliziere(r.key)}
                    />
                    <IconKnopf
                      icon="ph:trash"
                      label={t("editor.entfernen")}
                      gefahr
                      onClick={() => entferne(r.key)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 pt-3">
        <button
          type="button"
          disabled={zeilen.length >= MAX_ABSCHNITTE}
          onClick={() => setKatalogOffen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-(--radius) bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/70 disabled:opacity-40"
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("editor.hinzufuegen")}
        </button>
        <p className="pt-1.5 text-center text-[0.6875rem] text-muted-foreground">
          {zeilen.length}/{MAX_ABSCHNITTE}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <BaukastenSchale
        // Der Editor zeigt die Seiten der Website als Reiter: so wechselt der
        // Kunde die Seite, ohne über die Liste zurückzugehen.
        reiter={pages.map((p) => ({
          id: p.id,
          label: p.title,
          href: `/website/seiten/${p.id}`,
        }))}
        aktiverReiter={page.id}
        // Erst den offenen Stand wegschreiben, dann wechseln — der Request
        // läuft über die Soft-Navigation hinweg weiter.
        vorNavigation={() => {
          if (offen) void schreibeRef.current?.();
        }}
        kopfAktionen={
          <Link
            href="/website/seiten"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:arrow-left" className="size-4" />
            {t("editor.zurueck")}
          </Link>
        }
        seitenleiste={seitenleiste}
        inhalt={
          <VorschauFlaeche
            geraet={geraet}
            onGeraet={setGeraet}
            pageId={page.id}
            token={token}
            tokenFehler={tokenFehler}
            neuLaden={neuLaden}
            iframeRef={iframeRef}
            onLoad={iframeBereit}
            editierbar
            locale={locale}
            rechts={
              <SpeicherAnzeige
                stand={stand}
                texte={{
                  speichert: t("kopf.speichert"),
                  gespeichert: t("kopf.gespeichert"),
                  fehler: t("kopf.speicherFehler"),
                }}
              />
            }
          />
        }
      />

      {katalogOffen ? (
        <AbschnittKatalog
          eintraege={ABSCHNITTE}
          onWaehle={hinzufuegen}
          onSchliesse={() => setKatalogOffen(false)}
        />
      ) : null}
    </>
  );
}

function IconKnopf({
  icon,
  label,
  onClick,
  disabled,
  gefahr,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  gefahr?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "p-0.5 text-muted-foreground transition disabled:opacity-30 " +
        (gefahr ? "hover:text-destructive" : "hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-3.5" />
    </button>
  );
}
