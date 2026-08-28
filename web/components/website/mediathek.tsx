"use client";

// Der MEDIA MANAGER: der gesamte Medienbestand des Betriebs in einem Fenster.
//
// Aufbau 1:1 nach dem Vorbild (Foto vom 27.08.2026, dreizehn Punkte):
//
//   ┌──────────────────── MEDIA MANAGER ──────────────────────── ✕ ─┐
//   │ (🔍 suchen)      Bilder · Symbole · Videos · Audio · Dateien   │
//   ├──────────┬────────────────────────────────────┬───────────────┤
//   │ + Hoch-  │ Alle Bilder        ▽ ⇅ ▦▤          │ BILD  abwählen│
//   │   laden  │ ┌────┐ ┌────┐ ┌────┐               │ ┌───────────┐ │
//   │ ⤓ Import │ │Ordn│ │ ▢  │ │ ▢✓ │               │ │  Vorschau │ │
//   │──────────│ └────┘ └────┘ └────┘               │ └───────────┘ │
//   │ KOSTENLOS│  name    name    name              │ Name: …       │
//   │ PREMIUM  │                                    │ Größe: … (?)  │
//   │ EIGENE   │                                    │ [Umbenennen]  │
//   │  Ordner… │                                    │───────────────│
//   │──────────│                                    │ Auswahl (2)   │
//   │ Alt-Texte│                                    │ ‹ ▢ ▢ ›       │
//   └──────────┴────────────────────────────────────┴───────────────┘
//
// ZWEI BETRIEBSARTEN, EIN FENSTER
//   · `auswahl` — aus einem Bildfeld heraus geöffnet. Ein Klick auf
//     „Auswählen" (oder ein Doppelklick) setzt das Medium ein und schließt.
//   · `verwaltung` — die eigene Seite `/website/mediathek`. Dort gibt es kein
//     Bildfeld, also auch keinen „Auswählen"-Knopf: er wäre eine Attrappe.
//
// DREI QUELLEN statt zwei Reiter
// Vorher gab es „Bibliothek" und „Stock" als Reiterpaar. Der Bestand hat aber
// DREI Herkünfte (eigener Bestand, kostenlose Anbieter, bezahlte Anbieter) und
// FÜNF Arten (Bilder, Symbole, Videos, Audio, Dateien) — als ein Reiterpaar
// wären das zehn Zustände in zwei Knöpfen. Deshalb: Art oben, Quelle links.
//
// WAS BEWUSST NICHT DA IST
// „Premium-Bilder" ist bei uns leer, weil kein kostenpflichtiger Anbieter
// angebunden ist (Abo + AGB-Erweiterung, siehe `stock.py`). Der Abschnitt sagt
// genau das, wenn man ihn öffnet — ein Katalog mit erfundenen Preisen wäre eine
// Attrappe, eine benannte Lücke ist eine Auskunft.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type MediaOrdner,
  type MediaSortierung,
  type MediaUebersichtDaten,
  listMediaGefiltert,
  listMediaOrdner,
  loescheMedienMehrfach,
  mediaUebersicht,
  moveMedia,
} from "@/lib/site-medien";
import { type Medium, type MediumArt, removeMedium, uploadMedium } from "@/lib/site-pages";

import { AuswahlLeiste } from "./mediathek/auswahl-leiste";
import { BildEditor } from "./mediathek/bild-editor";
import { DetailsLeiste } from "./mediathek/details-leiste";
import { ErsetzenDialog } from "./mediathek/ersetzen-dialog";
import { IconSuche } from "./mediathek/icon-suche";
import { ImportDialog } from "./mediathek/import-dialog";
import { type AnsichtsModus, KachelWand } from "./mediathek/kachel-wand";
import { MediathekKopf } from "./mediathek/kopf";
import { LoeschenDialog } from "./mediathek/loeschen-dialog";
import { MassenLoeschenDialog } from "./mediathek/massen-loeschen-dialog";
import type { OrdnerAnsicht } from "./mediathek/ordner-baum";
import { type Quelle, QuellenSpalte } from "./mediathek/quellen-spalte";
import { StockSuche } from "./mediathek/stock-suche";
import { Werkzeugleiste } from "./mediathek/werkzeugleiste";

/** Was der Dateidialog annimmt. Die Liste ist der DRITTE Riegel (nach
 *  Magic-Byte-Prüfung im Dienst und MIME-Allowlist des Buckets) und der
 *  freundlichste: sie zeigt dem Kunden gar erst die Dateien, die durchkommen. */
const ACCEPT_JE_ART: Record<MediumArt, string> = {
  image: "image/jpeg,image/png,image/webp",
  // Symbole werden nicht hochgeladen, sondern aus der Bibliothek übernommen —
  // ein SVG im öffentlichen Bucket wäre Stored-XSS. Der Dateidialog nimmt für
  // diesen Reiter deshalb Bilder an (was jemand hier ablegt, ist ein Bild).
  icon: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm",
  audio: "audio/mpeg,audio/mp4,audio/wav,audio/ogg",
  file:
    "application/pdf,application/zip," +
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function Mediathek({
  onWaehle,
  onSchliesse,
  modus = "auswahl",
}: {
  /** Fehlt in der Verwaltungsansicht: dort gibt es kein Bildfeld, in das ein
   *  Medium einsetzbar wäre. Kein Rückruf → kein „Auswählen"-Knopf, statt eines
   *  Knopfes, der ins Leere ruft. */
  onWaehle?: (url: string) => void;
  onSchliesse: () => void;
  /** `verwaltung` = eigene Seite (`/website/mediathek`): der Manager füllt die
   *  Arbeitsfläche statt über ihr zu liegen. */
  modus?: "auswahl" | "verwaltung";
}) {
  const t = useTranslations("website.mediathek");
  const sprache = useLocale();
  const mitVerwenden = modus === "auswahl" && Boolean(onWaehle);

  const [art, setArt] = useState<MediumArt>("image");
  const [quelle, setQuelle] = useState<Quelle>("site");
  const [ansicht, setAnsicht] = useState<OrdnerAnsicht>(null);
  const [ansichtsModus, setAnsichtsModus] = useState<AnsichtsModus>("raster");
  const [ordner, setOrdner] = useState<MediaOrdner[]>([]);
  const [rootCount, setRootCount] = useState(0);
  const [uebersicht, setUebersicht] = useState<MediaUebersichtDaten | null>(null);
  const [medien, setMedien] = useState<Medium[] | null>(null);
  const [gesamt, setGesamt] = useState<number | null>(null);
  const [suche, setSuche] = useState("");
  const [sortierung, setSortierung] = useState<MediaSortierung>("neueste");
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorMedium, setEditorMedium] = useState<Medium | null>(null);
  const [loeschMedium, setLoeschMedium] = useState<Medium | null>(null);
  const [ersetzenMedium, setErsetzenMedium] = useState<Medium | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [massenLoeschen, setMassenLoeschen] = useState(false);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [ueberZiel, setUeberZiel] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);

  const ordnerLaden = useCallback(async () => {
    // MIT der Art: die Zähler am Ordner zeigen, was im offenen Reiter darin
    // liegt. Ohne sie stand „Alle Medien 2" neben einer leeren Symbol-Wand.
    const res = await listMediaOrdner(art);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOrdner(res.data.items);
    setRootCount(res.data.root_media_count);
  }, [art]);

  const uebersichtLaden = useCallback(async () => {
    const res = await mediaUebersicht();
    // Kein Toast: die Zahlen sind Beigabe. Scheitert der Aufruf, stehen
    // Striche statt Zahlen — eine Fehlermeldung über einen Zähler würde vom
    // eigentlichen Fehler ablenken.
    if (res.ok) setUebersicht(res.data);
  }, []);

  const medienLaden = useCallback(async () => {
    const res = await listMediaGefiltert({
      art,
      folderId: ansicht || undefined,
      nurWurzel: ansicht === "",
      suche,
      sortierung,
      limit: 200,
    });
    if (!res.ok) {
      toast.error(res.error);
      setMedien([]);
      setGesamt(null);
      return;
    }
    setMedien(res.data.items);
    setGesamt(res.data.total);
  }, [art, ansicht, suche, sortierung]);

  useEffect(() => {
    void ordnerLaden();
    void uebersichtLaden();
  }, [ordnerLaden, uebersichtLaden]);

  useEffect(() => {
    setMedien(null);
    void medienLaden();
  }, [medienLaden]);

  // Der Wechsel der ART setzt die Quelle zurück, wenn es sie dort nicht gibt:
  // „Premium-Bilder" bei ausgewählten Videos wäre ein Bereich, der zu einem
  // Reiter gehört, den man verlassen hat.
  useEffect(() => {
    if (quelle === "premium" && art !== "image") setQuelle("site");
    if (quelle === "frei" && art !== "image" && art !== "icon") setQuelle("site");
  }, [art, quelle]);

  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Ein Escape schließt IMMER nur die oberste Ebene. Ohne diese Abfrage
      // würde es den ganzen Manager schließen, während man noch im
      // Löschdialog steht — und die Rückfrage wäre stillschweigend verneint.
      if (editorMedium || loeschMedium || ersetzenMedium || importOffen || massenLoeschen) {
        return;
      }
      onSchliesse();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [
    onSchliesse,
    editorMedium,
    loeschMedium,
    ersetzenMedium,
    importOffen,
    massenLoeschen,
  ]);

  const detailMedium = useMemo(
    () => medien?.find((m) => m.id === detailId) ?? null,
    [medien, detailId],
  );

  const ausgewaehlteMedien = useMemo(
    () => (medien ?? []).filter((m) => ausgewaehlt.has(m.id)),
    [medien, ausgewaehlt],
  );

  /** Die Ordner, die als Kachel in der Wand stehen: die Kinder des offenen
   *  Ordners. Beim Suchen keine — ein Suchtreffer ist kein Ort, und ein Ordner
   *  zwischen Suchergebnissen sähe aus wie ein Treffer. */
  const ordnerKacheln = useMemo(() => {
    if (suche.trim()) return [];
    if (ansicht === null || ansicht === "") {
      return ordner.filter((o) => o.parent_id === null);
    }
    return ordner.filter((o) => o.parent_id === ansicht);
  }, [ordner, ansicht, suche]);

  const ortName = useMemo(() => {
    if (ansicht === null) return t("ort.alle");
    if (ansicht === "") return t("ort.wurzel");
    return ordner.find((o) => o.id === ansicht)?.name ?? t("ort.alle");
  }, [ansicht, ordner, t]);

  function aktualisiereMedium(neu: Medium) {
    setMedien((liste) => (liste ?? []).map((m) => (m.id === neu.id ? neu : m)));
  }

  function neuesMediumEinsortieren(neu: Medium) {
    // Nur in die Liste legen, wenn der offene Reiter diese Art zeigt: ein
    // hochgeladenes PDF im Reiter „Bilder" würde dort erscheinen und beim
    // nächsten Laden verschwinden — ein Geist.
    //
    // Und mit der Liste wächst die ZAHL daneben (Wurzel 1: die Anzeige ist der
    // Gegenzustand). Ohne diese Zeile stand über einer Kachel „Alle Symbole 0".
    if (neu.kind === art) {
      setMedien((b) => [neu, ...(b ?? [])]);
      setGesamt((g) => (g ?? 0) + 1);
    }
    void ordnerLaden();
    void uebersichtLaden();
  }

  async function hochladen(dateien: FileList | File[]) {
    const liste = [...dateien];
    if (liste.length === 0) return;
    const zielOrdner = ansicht || null;
    setLaedtHoch(true);
    // Der Reihe nach: das Backend prüft vor JEDEM Upload die Obergrenze —
    // parallel würden mehrere Aufrufe denselben Zählerstand sehen.
    const neue: Medium[] = [];
    for (const datei of liste) {
      const res = await uploadMedium(datei, zielOrdner);
      if (!res.ok) {
        toast.error(`${datei.name}: ${res.error}`);
        continue;
      }
      neue.push(res.data);
    }
    setLaedtHoch(false);
    if (neue.length === 0) return;
    const sichtbare = neue.filter((m) => m.kind === art);
    setMedien((b) => [...sichtbare, ...(b ?? [])]);
    setGesamt((g) => (g ?? 0) + sichtbare.length);
    void ordnerLaden();
    void uebersichtLaden();
    toast.success(t("hochgeladen", { anzahl: neue.length }));
  }

  async function loeschenBestaetigt() {
    if (!loeschMedium) return;
    const res = await removeMedium(loeschMedium.id);
    setLoeschMedium(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMedien((b) => (b ?? []).filter((x) => x.id !== loeschMedium.id));
    setGesamt((g) => Math.max(0, (g ?? 1) - 1));
    setAusgewaehlt((s) => {
      const n = new Set(s);
      n.delete(loeschMedium.id);
      return n;
    });
    if (detailId === loeschMedium.id) setDetailId(null);
    void ordnerLaden();
    void uebersichtLaden();
    toast.success(t("geloescht"));
  }

  async function massenLoeschenBestaetigt() {
    const ids = [...ausgewaehlt];
    setMassenLoeschen(false);
    if (ids.length === 0) return;
    const res = await loescheMedienMehrfach(ids);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMedien((b) => (b ?? []).filter((x) => !ausgewaehlt.has(x.id)));
    setGesamt((g) => Math.max(0, (g ?? 0) - res.data.deleted));
    if (detailId && ausgewaehlt.has(detailId)) setDetailId(null);
    setAusgewaehlt(new Set());
    void ordnerLaden();
    void uebersichtLaden();
    toast.success(t("auswahl.geloescht", { anzahl: res.data.deleted }));
  }

  async function mehrfachVerschieben(zielOrdner: string | null) {
    const ids = [...ausgewaehlt];
    if (ids.length === 0) return;
    const res = await moveMedia(ids, zielOrdner);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAusgewaehlt(new Set());
    void ordnerLaden();
    void medienLaden();
    toast.success(t("ordner.bildVerschoben", { anzahl: ids.length }));
  }

  function mehrfachUmschalten(id: string) {
    setAusgewaehlt((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // `min-w-0 flex-1` um die FREMDEN Bestände: ohne die Hülle nehmen sich Symbol-
  // und Stock-Suche nur ihre Inhaltsbreite und die halbe Fläche bleibt leer —
  // sie sind selbst nur `h-full flex-col` und wissen nichts von der Spalte, in
  // der sie stehen.
  const hauptbereich =
    quelle === "frei" && art === "icon" ? (
      <div className="flex min-w-0 flex-1 flex-col">
        <IconSuche
          aktuellerOrdner={ansicht || ""}
          onUebernommen={(m) => {
            setQuelle("site");
            neuesMediumEinsortieren(m);
          }}
        />
      </div>
    ) : quelle === "frei" ? (
      <div className="flex min-w-0 flex-1 flex-col">
        <StockSuche
          aktuellerOrdner={ansicht || ""}
          onUebernommen={(m) => {
            setQuelle("site");
            neuesMediumEinsortieren(m);
          }}
        />
      </div>
    ) : quelle === "premium" ? (
      <PremiumHinweis />
    ) : (
      <div
        className="flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setUeberZiel(true);
        }}
        onDragLeave={() => setUeberZiel(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setUeberZiel(false);
          void hochladen(e.dataTransfer.files);
        }}
      >
        <Werkzeugleiste
          art={art}
          sortierung={sortierung}
          modus={ansichtsModus}
          ortName={ortName}
          anzahl={gesamt}
          onArt={setArt}
          onSortierung={setSortierung}
          onModus={setAnsichtsModus}
        />

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {ueberZiel ? (
            <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-(--radius) border-2 border-dashed border-foreground bg-background/90 text-sm font-medium">
              {t("ablegen")}
            </div>
          ) : null}
          {medien === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("laedt")}
            </p>
          ) : (
            <KachelWand
              medien={medien}
              ordner={ordnerKacheln}
              modus={ansichtsModus}
              ausgewaehlt={ausgewaehlt}
              aktivesDetail={detailId}
              mitVerwenden={mitVerwenden}
              onOeffneOrdner={(o) => setAnsicht(o.id)}
              onVerwende={(m) => onWaehle?.(m.url)}
              onMehrfachUmschalten={mehrfachUmschalten}
              onDetail={(m) => setDetailId(m.id)}
              onLoeschen={(m) => setLoeschMedium(m)}
            />
          )}
        </div>
      </div>
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("titel")}
      className={
        modus === "verwaltung"
          ? "flex h-full min-h-0 w-full flex-col"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      }
      onClick={modus === "verwaltung" ? undefined : onSchliesse}
    >
      <div
        className={
          "flex min-h-0 flex-col overflow-hidden border border-border bg-background " +
          (modus === "verwaltung"
            ? "h-full w-full"
            : "h-[90vh] w-full max-w-[86rem] rounded-(--radius) shadow-xl")
        }
        onClick={(e) => e.stopPropagation()}
      >
        <MediathekKopf
          art={art}
          suche={suche}
          zaehler={uebersicht?.je_art ?? null}
          onArt={setArt}
          onSuche={setSuche}
          onSchliesse={onSchliesse}
        />

        <div className="flex min-h-0 flex-1">
          <QuellenSpalte
            art={art}
            quelle={quelle}
            uebersicht={uebersicht}
            ordner={ordner}
            rootCount={rootCount}
            ansicht={ansicht}
            laedtHoch={laedtHoch}
            altTextHref="/website/mediathek/alt-texte"
            onQuelle={setQuelle}
            onAnsicht={setAnsicht}
            onOrdnerGeaendert={() => {
              void ordnerLaden();
              void medienLaden();
            }}
            onHochladen={() => dateiFeld.current?.click()}
            onImport={() => setImportOffen(true)}
          />

          {hauptbereich}

          {/* Die rechte Spalte steht NUR, wenn es etwas zu zeigen gibt: ein
              leerer Streifen von 18 rem nimmt der Kachelwand eine Spalte weg,
              ohne etwas zu sagen. */}
          {detailMedium || ausgewaehlteMedien.length > 0 ? (
            <aside className="flex w-72 shrink-0 flex-col border-l border-border">
              {detailMedium ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <DetailsLeiste
                    medium={detailMedium}
                    ordner={ordner}
                    sprache={sprache}
                    mitVerwenden={mitVerwenden}
                    onSchliesse={() => setDetailId(null)}
                    onWaehle={(m) => onWaehle?.(m.url)}
                    onAktualisiert={aktualisiereMedium}
                    onBearbeiten={() => setEditorMedium(detailMedium)}
                    onErsetzenAnfragen={() => setErsetzenMedium(detailMedium)}
                    onLoeschenAnfragen={() => setLoeschMedium(detailMedium)}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1" />
              )}

              {ausgewaehlteMedien.length > 0 ? (
                <AuswahlLeiste
                  medien={ausgewaehlteMedien}
                  ordner={ordner}
                  aktivId={detailId}
                  onDetail={(m) => setDetailId(m.id)}
                  onAlleAbwaehlen={() => setAusgewaehlt(new Set())}
                  onVerschieben={(ziel) => void mehrfachVerschieben(ziel)}
                  onLoeschen={() => setMassenLoeschen(true)}
                />
              ) : null}
            </aside>
          ) : null}
        </div>

        <input
          ref={dateiFeld}
          type="file"
          accept={ACCEPT_JE_ART[art]}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void hochladen(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {editorMedium ? (
        <BildEditor
          medium={editorMedium}
          onSchliesse={() => setEditorMedium(null)}
          onFertig={(neu) => {
            setEditorMedium(null);
            neuesMediumEinsortieren(neu);
          }}
        />
      ) : null}

      {loeschMedium ? (
        <LoeschenDialog
          medium={loeschMedium}
          onAbbrechen={() => setLoeschMedium(null)}
          onBestaetigen={() => void loeschenBestaetigt()}
        />
      ) : null}

      {massenLoeschen ? (
        <MassenLoeschenDialog
          medien={ausgewaehlteMedien}
          onAbbrechen={() => setMassenLoeschen(false)}
          onBestaetigen={() => void massenLoeschenBestaetigt()}
        />
      ) : null}

      {ersetzenMedium ? (
        <ErsetzenDialog
          medium={ersetzenMedium}
          onAbbrechen={() => setErsetzenMedium(null)}
          onFertig={() => {
            setErsetzenMedium(null);
            void medienLaden();
          }}
        />
      ) : null}

      {importOffen ? (
        <ImportDialog
          ordnerId={ansicht || null}
          onAbbrechen={() => setImportOffen(false)}
          onFertig={(m) => {
            setImportOffen(false);
            neuesMediumEinsortieren(m);
          }}
        />
      ) : null}
    </div>
  );
}

/** Der Abschnitt „Premium-Bilder" — und was wirklich dahintersteht.
 *
 *  Kein Katalog, keine Preise, kein Warenkorb: es gibt keinen angebundenen
 *  kostenpflichtigen Anbieter (bezahltes Abo plus AGB-Erweiterung — wir haften
 *  für Lizenzverstöße unserer Kunden, siehe `stock.py`). Was hier steht, ist
 *  die Auskunft darüber, statt einer Fläche, die nach Angebot aussieht und
 *  keines ist. */
function PremiumHinweis() {
  const t = useTranslations("website.mediathek");
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <Icon
          icon="ph:seal-percent"
          className="mx-auto size-8 text-muted-foreground"
        />
        <h3 className="mt-2 font-display text-lg font-extrabold">
          {t("premium.titel")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("premium.text")}</p>
      </div>
    </div>
  );
}
