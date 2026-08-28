"use client";

// „Layouts" — der dritte Menüpunkt des Blog-CMS (`docs/UI`, Foto 19.04.33;
// Hostaway nennt ihn „Post Layouts").
//
// Er beantwortet die Frage „wie sieht die Beitragsübersicht auf meiner Website
// aus" — und er beantwortet sie HIER, mit echten Reglern an den echten
// Bausteinen der Übersichtsseite.
//
// WAS HIER VORHER STAND, und warum es weg ist
// Eine Zeile mit dem Slug `/blog`, ein Knopf „Übersicht bearbeiten", der in den
// Seiten-Editor sprang, und zwei Bausteine als tote Listenzeilen mit dem Text
// „über Hinzufügen". Kein einziger Regler. Der Kommentar darüber begründete das
// damit, eine zweite Maske wäre eine zweite Wahrheit — richtig gedacht, falsch
// ausgeführt: eine Seite, die auf die Arbeit VERWEIST statt sie zu ermöglichen,
// ist genau die Attrappe, die sie vermeiden wollte (Wurzel 4).
//
// Die Auflösung ist nicht „zweite Maske", sondern DIESELBE Maske: die Felder
// kommen aus `ABSCHNITTE` (`abschnitte.ts`) und werden von `FeldEingabe`
// gezeichnet — demselben Bauteil, das der Inspektor benutzt. Gespeichert wird
// über `updateBlock`, denselben Endpunkt. Es gibt also weiterhin genau eine
// Wahrheit über das Aussehen; sie ist nur auch von hier aus erreichbar.
//
// WAS ANORDNUNG BEDEUTET
// Der Marktstandard führt die Anordnung als eigene Wahl, nicht als Summe von
// Schaltern: Squarespace 7.1 hat fünf Blog-Layouts (Basic Grid · Masonry ·
// Single Column · Side by Side · Alternating Side by Side), und die
// Format-Einstellungen hängen an der gewählten Art — „Columns" etwa gibt es nur
// bei den beiden Rastern (recherchiert 27.08.2026). Genau das fehlte uns: wir
// hatten dreizehn Regler und keine Anordnung. Sie steht jetzt im Baustein
// (`PostsContent.layout`) mit vier Arten, und `nurWenn` blendet die Regler aus,
// die zur gewählten Art nicht gehören.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  type Block,
  type BlockType,
  type Page,
  addBlock,
  listBlocks,
  updateBlock,
} from "@/lib/site-pages";

import { abschnittFuer } from "../abschnitte";
import { FeldEingabe, feldSichtbar } from "../editor/abschnitt-inspektor";

/** Die Blog-Übersichtsseite. Sie trägt `system_key = "blog"` (0466) — dieselbe
 *  Kennung, an der auch die Seitenwahl sie erkennt und der Renderer sie
 *  auflöst. Kein Slug-Vergleich auf „blog": ein Betrieb darf seine Übersicht
 *  „aktuelles" nennen. */
function uebersichtsSeite(seiten: Page[]): Page | null {
  return seiten.find((p) => p.system_key === "blog") ?? null;
}

/** Bausteintypen, die eine Beitragsübersicht bilden — in der Reihenfolge, in
 *  der sie auf einer Übersichtsseite Sinn ergeben: erst die Suche, dann die
 *  Liste. Angelegt wird in derselben Reihenfolge. */
const LISTEN_BAUSTEINE: readonly BlockType[] = ["search_posts", "posts"];

/** Wie lange nach der letzten Eingabe gespeichert wird.
 *
 *  Dieselben 900 ms wie im Abschnitts-Editor, mit demselben Grund: ein Request
 *  je Tastendruck wäre eine Flut, und ein „Speichern"-Knopf hier wäre der
 *  einzige im ganzen Baukasten. */
const ENTPRELLUNG_MS = 900;

export function BlogLayouts({ seiten }: { seiten: Page[] }) {
  const t = useTranslations("website");
  const router = useRouter();
  const uebersicht = uebersichtsSeite(seiten);
  const seitenId = uebersicht?.id ?? null;

  const [bloecke, setBloecke] = useState<Block[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [legtAn, setLegtAn] = useState<BlockType | null>(null);

  // Die Bausteine der Übersichtsseite laden.
  //
  // `.catch` ist Pflicht, nicht Zierrat: ohne ihn bliebe `bloecke` bei einem
  // Netzfehler `null` und die Seite zeigte für immer „lädt" statt einer
  // Meldung — derselbe verschluckte Fehler, der `/website/vorlagen` minutenlang
  // hängen ließ (Wurzel 5).
  const laden = useCallback(() => {
    if (!seitenId) return;
    setFehler(null);
    listBlocks(seitenId)
      .then((res) => {
        if (res.ok) setBloecke(res.data.items);
        else setFehler(res.error);
      })
      .catch(() => setFehler(t("seiten.fehlgeschlagen")));
  }, [seitenId, t]);

  useEffect(laden, [laden]);

  /** Einen Baustein anlegen, den die Übersicht noch nicht hat. */
  async function anlegen(typ: BlockType) {
    if (!seitenId || legtAn) return;
    setLegtAn(typ);
    const res = await addBlock(seitenId, typ).catch(() => null);
    setLegtAn(null);
    if (!res?.ok) {
      toast.error(res && !res.ok ? res.error : t("seiten.fehlgeschlagen"));
      return;
    }
    // Neu laden statt anhängen: die Position bestimmt der Server, und eine
    // lokal geratene Reihenfolge stimmte beim nächsten Öffnen nicht mehr.
    laden();
    // Die Vorschau rendert serverseitig und erfährt es sonst nicht.
    router.refresh();
  }

  if (!uebersicht) {
    // Die Übersichtsseite entsteht beim ersten Blick in die Seitenliste
    // (`systemseiten.sicherstellen`). Fehlt sie hier trotzdem, ist das ein
    // echter Zustand und keine Vermutung — also wird er benannt und nicht mit
    // einem erfundenen Link überdeckt (Wurzel 4).
    return (
      <div className="h-full overflow-y-auto px-8 py-8">
        <Kopf t={t} />
        <p className="mt-6 rounded-(--radius) border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          {t("blog.keineUebersicht")}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <Kopf t={t} />

      {/* Welche Seite bearbeitet wird, und der Weg in ihren vollen Editor. Der
          Knopf BLEIBT: hier stehen die Listen-Bausteine, dort steht die ganze
          Seite (Kopfbild, Text, Reihenfolge). Er ist jetzt eine Ergänzung und
          nicht mehr der einzige Inhalt. */}
      <div className="mt-6 flex items-center gap-3 rounded-(--radius) border border-border p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
          <Icon icon="ph:layout" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{uebersicht.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            /{uebersicht.slug}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/website/seiten/${uebersicht.id}`)}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary"
        >
          {t("blog.layoutBearbeiten")}
        </button>
      </div>

      {fehler ? (
        <div className="mt-6 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{fehler}</p>
          <button
            type="button"
            onClick={laden}
            className="mt-2 text-sm font-semibold underline"
          >
            {t("blog.nochmalVersuchen")}
          </button>
        </div>
      ) : bloecke === null ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("blog.laedt")}</p>
      ) : (
        <div className="flex flex-col gap-8 pt-8">
          {LISTEN_BAUSTEINE.map((typ) => {
            const block = bloecke.find((b) => b.type === typ) ?? null;
            return (
              <BausteinKarte
                key={typ}
                typ={typ}
                block={block}
                legtAn={legtAn === typ}
                onAnlegen={() => void anlegen(typ)}
                onGespeichert={() => router.refresh()}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kopf({ t }: { t: ReturnType<typeof useTranslations<"website">> }) {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {t("blog.layouts")}
      </h1>
      <p className="pt-2 text-sm text-muted-foreground">
        {t("blog.layoutsHinweis")}
      </p>
    </>
  );
}

/**
 * Ein Listen-Baustein der Übersichtsseite mit seinen echten Feldern.
 *
 * Gibt es ihn auf der Seite nicht, steht hier ein Knopf, der ihn ANLEGT — und
 * nicht der Satz „über Hinzufügen", der vorher hier stand. Ein Hinweis, wo man
 * etwas anderes tun soll, ist kein Bedienelement.
 */
function BausteinKarte({
  typ,
  block,
  legtAn,
  onAnlegen,
  onGespeichert,
}: {
  typ: BlockType;
  block: Block | null;
  legtAn: boolean;
  onAnlegen: () => void;
  onGespeichert: () => void;
}) {
  const t = useTranslations("website");
  const meta = abschnittFuer(typ);

  // Der offene Stand und der bestätigte — wie im Abschnitts-Editor. Ohne die
  // Trennung schickte jeder Render denselben Inhalt erneut.
  const [entwurf, setEntwurf] = useState<Record<string, unknown>>(
    () => block?.content ?? {},
  );
  const [bestaetigt, setBestaetigt] = useState<string>(() =>
    JSON.stringify(block?.content ?? {}),
  );
  const [speichert, setSpeichert] = useState(false);

  // Ein neu angelegter Baustein kommt als neues Prop herein. `useState` nimmt es
  // nur als ANFANGSWERT — ohne diesen Effekt zeigte die Karte nach dem Anlegen
  // weiter ihre leeren Felder (dieselbe Falle wie beim Design-Panel).
  const blockId = block?.id ?? null;
  const fremderStand = JSON.stringify(block?.content ?? {});
  useEffect(() => {
    setEntwurf(JSON.parse(fremderStand) as Record<string, unknown>);
    setBestaetigt(fremderStand);
    // Nur beim Wechsel des BAUSTEINS, nicht bei jeder eigenen Eingabe: sonst
    // überschriebe der Serverstand, was gerade getippt wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  // Autospeichern, entprellt.
  useEffect(() => {
    if (!blockId) return;
    const roh = JSON.stringify(entwurf);
    if (roh === bestaetigt) return;
    const timer = setTimeout(() => {
      setSpeichert(true);
      updateBlock(blockId, { content: entwurf })
        .then((res) => {
          setSpeichert(false);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          setBestaetigt(JSON.stringify(res.data.content));
          onGespeichert();
        })
        .catch(() => {
          setSpeichert(false);
          toast.error(t("seiten.fehlgeschlagen"));
        });
    }, ENTPRELLUNG_MS);
    return () => clearTimeout(timer);
    // `onGespeichert` und `t` sind bei jedem Render neu — der Effekt soll auf
    // die EINGABE reagieren, nicht auf das Neu-Erzeugen eines Rückrufs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entwurf, bestaetigt, blockId]);

  const name = meta ? t(`abschnitte.${meta.label}`) : typ;

  return (
    <section className="rounded-(--radius) border border-border">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Icon
          icon={meta?.icon ?? "ph:squares-four"}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h2>
        {block ? (
          speichert ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("kopf.speichert")}
            </span>
          ) : null
        ) : (
          <button
            type="button"
            onClick={onAnlegen}
            disabled={legtAn}
            className="shrink-0 rounded-full bg-(--brand) px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {legtAn ? t("blog.legtAn") : t("blog.bausteinAnlegen")}
          </button>
        )}
      </header>

      {block ? (
        <div className="flex flex-col gap-4 px-4 py-4">
          {(meta?.felder ?? [])
            // Mehrsprachige Felder gehören NICHT hierher: sie brauchen den
            // Sprachwähler des Inspektors, und ohne ihn bearbeitete man immer
            // dieselbe Fassung und wüsste nicht, welche (genau der Schaden aus
            // Prüfbericht A2). Wer die Überschrift übersetzen will, geht in den
            // Editor der Seite — der Knopf oben führt hin.
            .filter((f) => !MEHRSPRACHIGE_ARTEN.has(f.art))
            .filter((f) => feldSichtbar(f, entwurf, meta?.felder ?? []))
            .map((feld) => (
              <FeldEingabe
                key={feld.key}
                feld={feld}
                wert={entwurf[feld.key]}
                sprache="de"
                sprachen={[]}
                onText={() => {
                  /* mehrsprachige Felder sind hier ausgefiltert */
                }}
                onWert={(v: unknown) =>
                  setEntwurf((e) => ({ ...e, [feld.key]: v }))
                }
                seitenAnzahl={1}
              />
            ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {t("blog.bausteinFehltHinweis")}
        </p>
      )}
    </section>
  );
}

/** Feldarten, die eine Sprachfassung tragen. Sie brauchen den Sprachwähler des
 *  Inspektors — hier gibt es keinen, also stehen sie hier nicht. */
const MEHRSPRACHIGE_ARTEN = new Set(["text", "textlang", "richtext"]);
