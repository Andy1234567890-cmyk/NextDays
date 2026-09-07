"use client";

// Das personalisierbare Kachel-Raster der Startseite (Lastenheft §2.1).
//
// 12 Spalten, Größen s/m/l = 4/6/12 Spalten, Höhe je Kachel automatisch (die
// Zeile wird so hoch wie ihre höchste Kachel). Unter `lg` eine Spalte in
// Leserichtung. Drag-and-drop über @dnd-kit/sortable — also über die
// REIHENFOLGE; x/y für den Server rechnet `lib/dashboard-layout-normalisierung`
// aus Reihenfolge und Breite (Fließ-Packung, kollisionsfrei).
//
// Speichern: debounced per PUT, 800 ms nach der letzten Änderung. Der PUT ist
// ein Upsert auf user_id (Wurzel 2): ein Doppelklick, ein Retry oder zwei
// überlappende Debounces schreiben denselben Stand — nichts wird doppelt.
// Fehler werden GESAGT (Toast + Statuszeile), nie verschluckt (Wurzel 5).
//
// Kein Realtime-Abo auf `dashboard_layouts`: 0402 hat die Tabelle bewusst aus
// der Publikation genommen und ihr kein select-Grant gegeben (Wurzel 6). Ein
// Abo wäre eine stumme Attrappe. Ein zweiter Tab zieht beim nächsten Aufruf
// nach — das ist ehrlich benannt statt vorgetäuscht.
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  type KachelDaten,
  KachelInhalt,
  kachelHatDaten,
} from "@/components/dashboard/kachel-inhalt";
import {
  BREITE,
  KATALOG,
  type KachelBereich,
  type KachelDefinition,
  type KachelGroesse,
  type KachelId,
  darfKachelSehen,
  kachelDefinition,
} from "@/lib/dashboard-katalog";
import {
  type Anordnung,
  anordnungAusLayout,
  ausblenden,
  einblenden,
  groesseSetzen,
  layoutAusAnordnung,
  verschieben,
} from "@/lib/dashboard-layout-normalisierung";
import {
  type DashboardLayoutAntwort,
  type LayoutQuelle,
  deleteDashboardLayout,
  putDashboardLayout,
} from "@/lib/dashboard-layout";

// Literale Klassen, damit Tailwind sie im Quelltext findet — ein
// `lg:col-span-${n}` zur Laufzeit würde nie generiert.
const SPANNE: Record<KachelGroesse, string> = {
  s: "lg:col-span-4",
  m: "lg:col-span-6",
  l: "lg:col-span-12",
};

const DEBOUNCE_MS = 800;

/** Statuszeile in der Entwicklung — sichtbar, WOHER das Layout kommt und ob der
 *  letzte PUT ankam. Dieselbe Schaltung wie das RealtimeDebugPanel. */
const DEBUG_SICHTBAR =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1";

type SpeicherStatus =
  | { zustand: "bereit" }
  | { zustand: "laeuft" }
  | { zustand: "ok"; um: number }
  | { zustand: "fehler"; um: number; fehler: string; requestId?: string };

export type MeFuerKacheln = {
  role: string | null;
  capabilities: readonly string[];
  permissions: readonly string[];
};

function SortableKachel({
  eintrag,
  def,
  daten,
  bearbeiten,
  titel,
  onGroesse,
  onAusblenden,
}: {
  eintrag: { id: KachelId; groesse: KachelGroesse };
  def: KachelDefinition;
  daten: KachelDaten;
  bearbeiten: boolean;
  titel: string;
  onGroesse: (g: KachelGroesse) => void;
  onAusblenden: () => void;
}) {
  const t = useTranslations("dashboard.kacheln");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: eintrag.id, disabled: !bearbeiten });

  // Kein @dnd-kit/utilities nur für diese eine Zeile — die Transform-Zeichen-
  // kette ist trivial (Skalierung bewusst nicht übernommen: Kacheln
  // verschiedener Größe sollen beim Ziehen ihre Form behalten).
  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex min-w-0 flex-col ${SPANNE[eintrag.groesse]} ${
        isDragging ? "z-20 opacity-80" : ""
      } ${bearbeiten ? "rounded-2xl outline-2 outline-dashed outline-border outline-offset-2" : ""}`}
    >
      {bearbeiten && (
        <div className="flex items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border bg-secondary/60 px-3 py-1.5">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("verschieben", { kachel: titel })}
            title={t("verschieben", { kachel: titel })}
            className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-full text-left text-xs font-medium text-muted-foreground active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon icon="ph:dots-six-vertical" className="size-4 shrink-0" />
            <span className="truncate">{titel}</span>
          </button>
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-background p-0.5"
            role="group"
            aria-label={t("groesseWaehlen", { kachel: titel })}
          >
            {(["s", "m", "l"] as const)
              .filter((g) => def.groessen.includes(g))
              .map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGroesse(g)}
                  aria-pressed={eintrag.groesse === g}
                  title={t(`groesse_${g}`)}
                  className={`size-6 rounded-full text-xs font-semibold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    eintrag.groesse === g
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {g}
                </button>
              ))}
          </span>
          <button
            type="button"
            onClick={onAusblenden}
            aria-label={t("ausblenden", { kachel: titel })}
            title={t("ausblenden", { kachel: titel })}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon icon="ph:eye-slash" className="size-4" />
          </button>
        </div>
      )}
      {/* `*:h-full`, damit jede Kachel ihre Rasterzelle füllt — die Karten
          selbst wissen nichts vom Raster. */}
      <div className="flex min-h-0 flex-1 flex-col *:h-full">
        <KachelInhalt id={eintrag.id} daten={daten} />
      </div>
    </div>
  );
}

/** Symbol je Bereich für die Abschnitts-Überschrift. Vollständig über
 *  `KachelBereich` — ein neuer Bereich fällt hier als Typfehler auf, nicht als
 *  fehlendes Symbol in der Oberfläche. */
const BEREICH_ICON: Record<KachelBereich, string> = {
  reservierungen: "ph:bookmark-simple",
  kennzahlen: "ph:chart-line-up",
  nachrichten: "ph:chat-circle",
  objekte: "ph:house-line",
};

export function DashboardRaster({
  daten,
  me,
  antwort,
  ladefehler,
}: {
  daten: KachelDaten;
  me: MeFuerKacheln;
  /** GET /dashboard-layout — null, wenn der Aufruf fehlschlug. */
  antwort: DashboardLayoutAntwort | null;
  /** Fehlertext des GET, wenn `antwort` null ist. Wird GESAGT (Wurzel 5). */
  ladefehler: string | null;
}) {
  const t = useTranslations("dashboard.kacheln");
  const tRes = useTranslations("reservations");

  // Welche Kacheln für DIESEN Nutzer überhaupt in Frage kommen: Rolle/
  // Berechtigung (Katalog) UND der Server hat Daten geliefert (Kachel-Inhalt).
  const erlaubt = useMemo<KachelId[]>(
    () =>
      KATALOG.filter(
        (k) => darfKachelSehen(k.zugang, me) && kachelHatDaten(k.id, daten),
      ).map((k) => k.id),
    [me, daten],
  );

  const [anordnung, setAnordnung] = useState<Anordnung>(() =>
    anordnungAusLayout(antwort?.layout ?? null, erlaubt),
  );
  const [quelle, setQuelle] = useState<LayoutQuelle | "unbekannt">(
    antwort?.quelle ?? "unbekannt",
  );
  const [bearbeiten, setBearbeiten] = useState(false);
  const [status, setStatus] = useState<SpeicherStatus>({ zustand: "bereit" });
  const [zuruecksetzenLaeuft, setZuruecksetzenLaeuft] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Immer der JÜNGSTE Stand für den (verzögerten) PUT — gepflegt in den
  // Handlern, nicht während des Renders.
  const aktuell = useRef<Anordnung>(anordnung);
  const laeuft = useRef(false);
  const nochmal = useRef(false);

  // Kein Realtime auf `dashboard_layouts` (s. Kopf) — aber die Startseite
  // wird über `RealtimeRefresh` (reservations/properties/availability) ohnehin
  // neu gerendert, und dann kommt `antwort` frisch vom Server. Einen NEUEN
  // Server-Stand übernehmen wir, solange niemand gerade anordnet oder ein PUT
  // unterwegs ist — sonst überschriebe er die eigene, noch nicht gespeicherte
  // Änderung. „Neu" heißt: anders als die zuletzt gesehene Antwort. Ohne diesen
  // Vergleich spielte der Effekt nach „Fertig" den Erst-Render-Stand zurück
  // und machte die eben gespeicherte Anordnung sichtbar rückgängig.
  const bearbeitenRef = useRef(false);
  const letzteAntwort = useRef(JSON.stringify(antwort));
  useEffect(() => {
    const json = JSON.stringify(antwort);
    if (json === letzteAntwort.current) return;
    letzteAntwort.current = json;
    if (bearbeitenRef.current || laeuft.current || timer.current) return;
    const neu = anordnungAusLayout(antwort?.layout ?? null, erlaubt);
    setAnordnung(neu);
    aktuell.current = neu;
    if (antwort) setQuelle(antwort.quelle);
    // `erlaubt` ist je Render ein neues Array — der Vergleich läuft über den
    // Inhalt (`erlaubtSchluessel` unten), nicht über die Identität.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antwort]);

  // Geänderte Kachelmenge (z. B. Posteingang inzwischen erreichbar → neue
  // Kacheln): den aktuellen Stand gegen die neue Menge normalisieren. Beim
  // ersten Lauf idempotent.
  const erlaubtSchluessel = erlaubt.join(",");
  useEffect(() => {
    if (bearbeitenRef.current || laeuft.current || timer.current) return;
    const neu = anordnungAusLayout(layoutAusAnordnung(aktuell.current), erlaubt);
    setAnordnung(neu);
    aktuell.current = neu;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erlaubtSchluessel]);

  // Der GET ist einmal beim Laden fehlgeschlagen → einmal laut sagen. Das
  // Raster zeigt dann den Katalog-Standard, aber niemand soll glauben, das
  // sei seine gespeicherte Anordnung.
  const fehlerGemeldet = useRef(false);
  useEffect(() => {
    if (ladefehler && !fehlerGemeldet.current) {
      fehlerGemeldet.current = true;
      console.error("[dashboard-layout] GET fehlgeschlagen", { fehler: ladefehler });
      toast.error(t("ladefehler", { fehler: ladefehler }));
    }
  }, [ladefehler, t]);

  // --- Speichern (debounced, idempotent) ---------------------------------

  const speichern = useCallback(async () => {
    if (laeuft.current) {
      // Ein PUT ist unterwegs — nach seiner Antwort den NEUEN Stand schicken,
      // nicht parallel einen zweiten (Reihenfolge der Antworten wäre unklar).
      nochmal.current = true;
      return;
    }
    laeuft.current = true;
    setStatus({ zustand: "laeuft" });
    const layout = layoutAusAnordnung(aktuell.current);
    const res = await putDashboardLayout(layout);
    laeuft.current = false;
    if (res.ok) {
      setQuelle(res.data.quelle);
      setStatus({ zustand: "ok", um: Date.now() });
    } else {
      console.error("[dashboard-layout] PUT fehlgeschlagen", {
        fehler: res.error,
        status: res.status,
        requestId: res.requestId,
        kacheln: layout.kacheln.length,
      });
      setStatus({
        zustand: "fehler",
        um: Date.now(),
        fehler: res.error,
        requestId: res.requestId,
      });
      toast.error(t("speicherfehler", { fehler: res.error }));
    }
    if (nochmal.current) {
      nochmal.current = false;
      void speichern();
    }
  }, [t]);

  const planen = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void speichern();
    }, DEBOUNCE_MS);
  }, [speichern]);

  // Beim Verlassen der Seite einen noch wartenden Debounce sofort abschicken —
  // sonst ginge die letzte Änderung verloren.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void speichern();
      }
    },
    [speichern],
  );

  const aendern = useCallback(
    (neu: Anordnung) => {
      setAnordnung(neu);
      aktuell.current = neu;
      planen();
    },
    [planen],
  );

  // --- Zurücksetzen (DELETE → Rollen- bzw. Katalog-Standard) ---------------
  const zuruecksetzen = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setZuruecksetzenLaeuft(true);
    const res = await deleteDashboardLayout();
    setZuruecksetzenLaeuft(false);
    if (!res.ok) {
      console.error("[dashboard-layout] DELETE fehlgeschlagen", {
        fehler: res.error,
        status: res.status,
        requestId: res.requestId,
      });
      toast.error(t("speicherfehler", { fehler: res.error }));
      return;
    }
    const neu = anordnungAusLayout(res.data.layout, erlaubt);
    setAnordnung(neu);
    aktuell.current = neu;
    setQuelle(res.data.quelle);
    setStatus({ zustand: "ok", um: Date.now() });
    toast.success(
      res.data.quelle === "rolle"
        ? t("zurueckgesetztRolle")
        : t("zurueckgesetztStandard"),
    );
  };

  // --- Drag-and-drop ------------------------------------------------------
  const sensors = useSensors(
    // Kleine Distanz, damit ein Klick auf den Griff (Fokus) kein Ziehen ist.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titelVon = useCallback(
    (id: KachelId) => tRes(kachelDefinition(id).titelKey),
    [tRes],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    aendern(verschieben(aktuell.current, active.id as KachelId, over.id as KachelId));
  };

  const ids = anordnung.sichtbar.map((k) => k.id);

  // Die sichtbaren Kacheln in Bereichsgruppen, in der REIHENFOLGE DES NUTZERS:
  // ein Bereich erscheint dort, wo seine erste Kachel steht. Wer eine
  // Umsatz-Kachel nach oben zieht, bekommt „Kennzahlen" oben — die Gliederung
  // folgt seiner Anordnung, sie erzwingt keine eigene.
  const bereichsFolge = useMemo(() => {
    // `Anordnung["sichtbar"]` statt `typeof anordnung.sichtbar`: die zweite
    // Form zieht `anordnung` in die Hook-Dependencies (ESLint sieht den Namen,
    // nicht dass er nur im Typ steht) und hätte die Gruppierung bei jeder
    // Änderung neu gerechnet.
    const gruppen: { bereich: KachelBereich; eintraege: Anordnung["sichtbar"] }[] = [];
    for (const eintrag of anordnung.sichtbar) {
      const bereich = kachelDefinition(eintrag.id).bereich;
      const letzte = gruppen.at(-1);
      if (letzte?.bereich === bereich) {
        letzte.eintraege.push(eintrag);
      } else {
        gruppen.push({ bereich, eintraege: [eintrag] });
      }
    }
    return gruppen;
  }, [anordnung.sichtbar]);
  const zeigeZuruecksetzen = quelle === "benutzer";

  return (
    <div className="flex flex-col gap-4">
      {/* Kopfleiste: Anpassen / Fertig / Zurücksetzen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {bearbeiten ? t("hinweisBearbeiten") : ""}
        </p>
        <div className="flex items-center gap-2">
          {bearbeiten && zeigeZuruecksetzen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={zuruecksetzen}
              disabled={zuruecksetzenLaeuft}
              title={t("zuruecksetzenHinweis")}
            >
              <Icon
                icon={zuruecksetzenLaeuft ? "ph:circle-notch" : "ph:arrow-counter-clockwise"}
                className={`size-4 ${zuruecksetzenLaeuft ? "animate-spin" : ""}`}
              />
              {t("zuruecksetzen")}
            </Button>
          )}
          <Button
            variant={bearbeiten ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (bearbeiten && timer.current) {
                // „Fertig" schickt einen wartenden Debounce sofort — der
                // Nutzer soll nicht raten, ob sein Stand schon gespeichert ist.
                clearTimeout(timer.current);
                timer.current = null;
                void speichern();
              }
              bearbeitenRef.current = !bearbeiten;
              setBearbeiten(!bearbeiten);
            }}
            aria-pressed={bearbeiten}
          >
            <Icon
              icon={bearbeiten ? "ph:check" : "ph:sliders-horizontal"}
              className="size-4"
            />
            {bearbeiten ? t("fertig") : t("anpassen")}
          </Button>
        </div>
      </div>

      {/* Ausgeblendete Kacheln — nur im Anpassen-Modus, sonst wäre die Leiste
          eine Aufforderung ohne Werkzeug. */}
      {bearbeiten && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon icon="ph:eye-slash" className="size-4" />
            {t("ausgeblendete")}
          </span>
          {anordnung.ausgeblendet.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t("keineAusgeblendeten")}</span>
          ) : (
            anordnung.ausgeblendet.map((id) => {
              const titel = titelVon(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => aendern(einblenden(aktuell.current, id))}
                  aria-label={t("einblenden", { kachel: titel })}
                  title={t("einblenden", { kachel: titel })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Icon icon={kachelDefinition(id).icon} className="size-3.5" />
                  {titel}
                  <Icon icon="ph:plus" className="size-3.5 text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
      )}

      {anordnung.sichtbar.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {t("alleAusgeblendet")}
        </p>
      ) : (
        <DndContext
          // FESTE id, gleiche Begründung wie im Abrechnungs-Editor: ohne sie
          // kommt die `aria-describedby`-Kennung aus einem modulglobalen
          // Zähler, dessen Stand auf Server und Client auseinanderläuft
          // (Hydration-Fehler). Der Zähler ist zudem GETEILT — dieser Kontext
          // verschob die Nummern des anderen mit.
          id="dashboard-kacheln"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            // Deutsche Ansagen statt der englischen Vorgabe von dnd-kit.
            announcements: {
              onDragStart: ({ active }) =>
                t("dndStart", { kachel: titelVon(active.id as KachelId) }),
              onDragOver: ({ active, over }) =>
                over
                  ? t("dndOver", {
                      kachel: titelVon(active.id as KachelId),
                      ziel: titelVon(over.id as KachelId),
                    })
                  : t("dndOverNichts", { kachel: titelVon(active.id as KachelId) }),
              onDragEnd: ({ active, over }) =>
                over
                  ? t("dndEnd", {
                      kachel: titelVon(active.id as KachelId),
                      ziel: titelVon(over.id as KachelId),
                    })
                  : t("dndCancel", { kachel: titelVon(active.id as KachelId) }),
              onDragCancel: ({ active }) =>
                t("dndCancel", { kachel: titelVon(active.id as KachelId) }),
            },
            screenReaderInstructions: { draggable: t("dndAnleitung") },
          }}
        >
          {/* EIN SortableContext über ALLE Kacheln, aber sichtbar gruppiert
              nach Bereich: „Reservierungen", „Kennzahlen", „Nachrichten",
              „Objekte" — mit Überschrift und eigenem Container.

              WARUM: Das alte, starre Dashboard hatte diese Abschnitts-
              Kopfzeilen; beim Umbau auf das Kachel-Raster (0402) fielen sie
              weg, und 20 Karten standen als eine Fläche ohne Gliederung
              nebeneinander. Der Bereich stand im Katalog schon bereit, wurde
              beim Rendern aber nicht benutzt.

              Verschoben wird weiterhin ÜBER Bereichsgrenzen hinweg: die
              Reihenfolge ist die des Nutzers, die Gruppierung folgt ihr.
              Deshalb `bereichsFolge` aus der aktuellen Anordnung und nicht
              aus dem Katalog — sonst sprängen Kacheln beim Ziehen in eine
              Gruppe zurück, aus der sie der Nutzer gerade geholt hat. */}
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="flex flex-col gap-8">
              {bereichsFolge.map(({ bereich, eintraege }) => (
                <section key={bereich} className="flex flex-col gap-3">
                  {/* Die Kopfzeile ist ein eigener Kasten mit Rahmen — so sah
                      das starre Dashboard aus, und so bleibt der Abschnitt
                      auch dann als Einheit erkennbar, wenn darunter nur eine
                      schmale Kachel steht. */}
                  <div className="flex items-center gap-3 rounded-2xl border border-border px-5 py-4">
                    <Icon
                      icon={BEREICH_ICON[bereich]}
                      className="size-6 shrink-0 text-muted-foreground"
                    />
                    <h2 className="font-display text-xl font-extrabold">
                      {t(`bereich.${bereich}`)}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {eintraege.map((eintrag) => (
                      <SortableKachel
                        key={eintrag.id}
                        eintrag={eintrag}
                        def={kachelDefinition(eintrag.id)}
                        daten={daten}
                        bearbeiten={bearbeiten}
                        titel={titelVon(eintrag.id)}
                        onGroesse={(g) =>
                          aendern(groesseSetzen(aktuell.current, eintrag.id, g))
                        }
                        onAusblenden={() =>
                          aendern(ausblenden(aktuell.current, eintrag.id))
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {DEBUG_SICHTBAR && (
        <DebugZeile
          quelle={quelle}
          status={status}
          sichtbar={anordnung.sichtbar.length}
          ausgeblendet={anordnung.ausgeblendet.length}
          erlaubt={erlaubt.length}
          spalten={anordnung.sichtbar.reduce((s, k) => s + BREITE[k.groesse], 0)}
        />
      )}
    </div>
  );
}

/** Entwicklungs-Statuszeile: Layout-Quelle, letzter PUT, Kachelzahlen.
 *  Bewusst deutsch fest verdrahtet wie das RealtimeDebugPanel — sie ist ein
 *  Werkzeug für die Entwicklung, kein Oberflächentext. */
function DebugZeile({
  quelle,
  status,
  sichtbar,
  ausgeblendet,
  erlaubt,
  spalten,
}: {
  quelle: LayoutQuelle | "unbekannt";
  status: SpeicherStatus;
  sichtbar: number;
  ausgeblendet: number;
  erlaubt: number;
  spalten: number;
}) {
  const uhr = (ms: number) =>
    new Date(ms).toLocaleTimeString("de-DE", { hour12: false });
  const put =
    status.zustand === "bereit"
      ? "noch keiner"
      : status.zustand === "laeuft"
        ? "läuft …"
        : status.zustand === "ok"
          ? `ok ${uhr(status.um)}`
          : `FEHLER ${uhr(status.um)}: ${status.fehler}${
              status.requestId ? ` (req ${status.requestId})` : ""
            }`;
  const farbe =
    status.zustand === "fehler"
      ? "text-red-600"
      : status.zustand === "ok"
        ? "text-emerald-600"
        : "text-muted-foreground";
  return (
    <p className="font-mono text-[0.6875rem] text-muted-foreground">
      Layout-Quelle: <span className="font-semibold">{quelle}</span> · letzter PUT:{" "}
      <span className={farbe}>{put}</span> · Kacheln {sichtbar} sichtbar /{" "}
      {ausgeblendet} ausgeblendet / {erlaubt} erlaubt · {spalten} Spalten belegt
    </p>
  );
}
