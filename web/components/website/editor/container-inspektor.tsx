"use client";

// Der Inspektor eines CONTAINERS — Abschnitt, Spalte, innere Spalte (0479).
//
// WARUM ES IHN GEBEN MUSS
// Bis hierher war ein Container etwas, das man ANLEGEN konnte und danach nie
// wieder anfassen: der Editor kannte nur Bausteine, ein Klick auf einen
// Abschnitt wählte nichts aus („ein Container hat keinen Inspektor"), und die
// Spaltenbreite war mit dem Klick auf das Layout für immer entschieden. Wer
// drei Spalten anlegte und nur zwei füllte, saß auf der dritten fest.
//
// Genau das ist der Unterschied zu einem echten Page Builder: dort ist der
// Rahmen selbst ein Ding mit Eigenschaften (Framer: ein Stack mit Richtung,
// Abstand, Innenabstand, Breite als „Fill"/„Fit"), und alles daran ist
// änderbar, verschiebbar, kopierbar, löschbar.
//
// WAS HIER STEHT und was nicht:
//   · BREITE (nur Spalten) — `span` in Zwölfteln, wie der Renderer sie liest.
//   · SPALTE HINZUFÜGEN (nur Abschnitte) — der Weg aus dem einspaltigen
//     Abschnitt heraus, den es vorher nicht gab.
//   · RANG (hoch/runter), DUPLIZIEREN, LÖSCHEN — die drei Handgriffe, die man
//     beim Bauen ständig braucht.
//   · DESIGN — dieselbe Fläche wie beim Baustein (`AbschnittDesign`): der
//     Renderer wertet `settings` an Containern bereits aus (Hintergrund,
//     Abstände, Sichtbarkeit je Gerät), es fehlte nur die Bedienung.
//
// Der Inhalt eines Containers steht NICHT hier — er hat keinen. Was in ihm
// liegt, sind seine Kinder, und die haben ihre eigenen Inspektoren.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  type Block,
  addContainer,
  duplicateContainer,
  moveContainer,
  removeBlock,
  updateBlock,
} from "@/lib/site-pages";

import {
  FeldZeile,
  InspektorKarte,
  InspektorKopf,
  Schieber,
  Segment,
  Zahlfeld,
} from "../inspektor-rahmen";
import { AbschnittDesign } from "./abschnitt-design";
import { AusrichtungsLeiste } from "./ausrichtungs-leiste";

/** Die gängigen Breiten als Schnellwahl. Zwölftel sind der Maßstab des
 *  Renderers (`flexBasis: span/12*100%`); die sechs Werte hier sind die, die
 *  man wirklich benutzt — der Rest bleibt über das Zahlenfeld erreichbar. */
const BREITEN: readonly { span: number; label: string }[] = [
  { span: 3, label: "1/4" },
  { span: 4, label: "1/3" },
  { span: 6, label: "1/2" },
  { span: 8, label: "2/3" },
  { span: 9, label: "3/4" },
  { span: 12, label: "1/1" },
];



export function ContainerInspektor({
  container,
  geschwister,
  kinder,
  onGeaendert,
  onWaehleContainer,
}: {
  container: Block;
  /** Die Container derselben Ebene, nach Rang. Für „hoch/runter" braucht der
   *  Inspektor die Position, und die kennt nur der Baum. */
  geschwister: Block[];
  /** Die direkten Kinder — bei einem Abschnitt seine Spalten. */
  kinder: Block[];
  /** Nach jeder Strukturänderung: der Aufrufer lädt den Baum neu. Der Editor
   *  ist hier NICHT die Wahrheit — Container stehen nicht in seiner
   *  Abschnittsliste, sie leben in der DB (`replace_blocks` fasst sie bewusst
   *  nicht an). */
  onGeaendert: () => void;
  /** Zu einem anderen Container springen (Elternteil, Spalte). */
  onWaehleContainer: (id: string | null) => void;
}) {
  const t = useTranslations("website");
  const [laeuft, setLaeuft] = useState(false);
  const istSpalte =
    container.kind === "column" || container.kind === "inner_column";
  const rang = geschwister.findIndex((g) => g.id === container.id);

  /** Jede Strukturänderung läuft über diesen einen Weg: Sperre setzen,
   *  Fehler zeigen, danach neu laden. Ohne die Sperre löst ein zweiter Klick
   *  denselben Vorgang ein zweites Mal aus, bevor der erste zurück ist
   *  (Wurzel 2) — bei „duplizieren" wären das zwei Kopien. */
  async function fuehreAus(
    aktion: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (laeuft) return;
    setLaeuft(true);
    try {
      const res = await aktion();
      if (!res.ok) {
        toast.error(res.error ?? t("seiten.fehlgeschlagen"));
        return;
      }
      onGeaendert();
    } finally {
      setLaeuft(false);
    }
  }

  // Wie viele Spalten sich der Abschnitt wirklich teilt. `geschwister` sind
  // die Container derselben Ebene — bei einer Spalte also sie selbst.
  const spaltenZahl = geschwister.filter(
    (g) => (g.kind ?? "widget") === "column" || g.kind === "inner_column",
  ).length;
  // EINE Spalte über die volle Breite ist keine Spalte, sondern der
  // Inhaltsbereich des Abschnitts — dieselbe Regel wie im Ebenen-Baum und im
  // Renderer. Erst ab zwei trägt die Nummer eine Information.
  //: Der selbst vergebene Name, wenn es einen gibt. Er steht in `settings`
  //: und nicht in einer eigenen Spalte — eine Anzeige-Eigenschaft wie Abstand
  //: und Hintergrund, mit dem Schreibweg, den es dafür schon gibt.
  const eigenerName =
    typeof container.settings?.name === "string"
      ? container.settings.name
      : "";
  /** EIN Weg, eine Einstellung zu schreiben. `null` LÖSCHT sie — sie dann auf
   *  einem Ersatzwert stehen zu lassen wäre die stille Änderung, die niemand
   *  sucht (Wurzel 4). */
  function setzeSetting(schluessel: string, wert: unknown) {
    const neu = { ...(container.settings ?? {}) } as Record<string, unknown>;
    if (wert === null) delete neu[schluessel];
    else neu[schluessel] = wert;
    void fuehreAus(() => updateBlock(container.id, { settings: neu }));
  }

  /** Der gespeicherte Wert als Zahl, oder `null`. */
  function zahl(schluessel: string): number | null {
    const wert = (container.settings ?? {})[schluessel];
    return typeof wert === "number" ? wert : null;
  }

  /** Der gespeicherte Wert als Zeichenkette, oder `null`. */
  function feld(schluessel: string): string | null {
    const wert = (container.settings ?? {})[schluessel];
    return typeof wert === "string" ? wert : null;
  }

  const titel = !istSpalte
    ? t("container.abschnitt")
    : spaltenZahl <= 1
      ? t("container.inhalt")
      : t("container.spalteNr", { nr: rang + 1 });

  return (
    <div className="flex flex-col pb-8">
      <InspektorKopf
        krumen={
          container.parent_id
            ? [
                {
                  id: container.parent_id,
                  label: t("container.abschnitt"),
                  onKlick: () => onWaehleContainer(container.parent_id ?? null),
                },
                { id: container.id, label: titel },
              ]
            : [{ id: container.id, label: titel }]
        }
        titel={titel}
        unterzeile={
          !istSpalte
            ? t("container.abschnittHinweis")
            : spaltenZahl <= 1
              ? t("container.inhaltHinweis")
              : t("container.spalteHinweis")
        }
      />

      {/* Der eigene NAME der Ebene.
          Der Doppelklick im Ebenen-Baum tut dasselbe, aber niemand ahnt ihn —
          in Framer und Webflow steht der Name deshalb zusätzlich im
          Inspektor. Leeren stellt den Standardnamen wieder her. */}
      {/* Die Ausrichtungsleiste steht ÜBER allen Karten — der Handgriff, den
          man beim Bauen am häufigsten braucht, in Framer an genau dieser
          Stelle. */}
      <AusrichtungsLeiste
        settings={(container.settings ?? {}) as Record<string, unknown>}
        span={istSpalte ? (container.span ?? 12) : null}
        laeuft={laeuft}
        onSetzen={(feld, wert) => setzeSetting(feld, wert)}
        onBreiteFuellen={
          istSpalte
            ? () =>
                void fuehreAus(() =>
                  updateBlock(container.id, { span: 12 }),
                )
            : undefined
        }
      />

      <InspektorKarte titel={t("container.name")} offenAnfangs>
        <div className="px-4 pb-3 pt-1">
          <FeldZeile label={t("container.name")}>
            <input
              key={`${container.id}:${eigenerName}`}
              defaultValue={eigenerName}
              maxLength={60}
              placeholder={titel}
              disabled={laeuft}
              onBlur={(e) => {
                const wert = e.target.value.trim() || null;
                if (wert === (eigenerName || null)) return;
                void fuehreAus(() =>
                  updateBlock(container.id, {
                    settings: { ...(container.settings ?? {}), name: wert },
                  }),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.8125rem] outline-none disabled:opacity-50"
            />
          </FeldZeile>
        </div>
      </InspektorKarte>

      {/* Die Breite gibt es erst, wenn sich zwei Spalten den Abschnitt
          teilen. Bei EINER Spalte ist `span` wirkungslos: der Renderer setzt
          bei `spalten.length <= 1` kein `flexBasis` und zeichnet sie über die
          volle Breite. Der Wähler zeigte trotzdem den gespeicherten Wert an —
          „1/2" markiert an einer Spalte, die 1/1 breit ist. Gemeldet am
          28.08.2026: „es zeigt 1/2 an ist aber ein 1/1". Eine Einstellung, die
          nichts bewirkt, darf nicht dastehen, als hätte sie gewirkt
          (Wurzel 4). */}
      {istSpalte && spaltenZahl > 1 ? (
        <InspektorKarte titel={t("container.breite")} offenAnfangs>
          <div className="flex flex-col gap-1.5 px-4 pb-3 pt-1">
            {/* Sechs Segmente passen nicht in 130 px — sie brachen auf zwei
                Zeilen um. Framer nimmt für so etwas ein Dropdown (dort
                „Fill/Fit/Fixed"), und das ist hier richtig: die Breite wählt
                man einmal, nicht im Vorbeigehen. */}
            <FeldZeile label={t("container.breite")}>
              <select
                value={String(container.span ?? 12)}
                disabled={laeuft}
                onChange={(e) =>
                  void fuehreAus(() =>
                    updateBlock(container.id, { span: Number(e.target.value) }),
                  )
                }
                className="min-w-0 flex-1 rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.8125rem] outline-none disabled:opacity-50"
              >
                {BREITEN.map((b) => (
                  <option key={b.span} value={b.span}>
                    {b.label}
                  </option>
                ))}
              </select>
            </FeldZeile>
            <p className="pl-[5rem] text-[0.6875rem] text-muted-foreground">
              {t("container.breiteHinweis", { span: container.span ?? 12 })}
            </p>
          </div>
        </InspektorKarte>
      ) : null}

      {/* SPALTEN — der Weg aus dem einspaltigen Abschnitt heraus. Nur an
          Abschnitten und inneren Spalten: eine Spalte trägt Bausteine, keine
          weiteren Spalten derselben Ebene. */}
      {!istSpalte ? (
        <InspektorKarte titel={t("container.spalten")} offenAnfangs>
          <div className="flex flex-col gap-1.5 px-4 pb-3 pt-1">
            <FeldZeile label={t("container.spalten")}>
              <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                {t("container.spaltenAnzahl", { anzahl: kinder.length })}
              </span>
            </FeldZeile>
            <button
              type="button"
              disabled={laeuft || kinder.length >= 6}
              onClick={() =>
                void fuehreAus(() =>
                  addContainer(container.page_id, "column", {
                    parentId: container.id,
                    // Gleichmäßig teilen — dieselbe Rechnung, die das
                    // Layout-Menü beim Anlegen macht.
                    span: Math.max(
                      1,
                      Math.floor(12 / Math.max(1, kinder.length + 1)),
                    ),
                  }),
                )
              }
              className="flex items-center justify-center gap-1.5 rounded-(--radius) bg-secondary py-1.5 text-[0.8125rem] font-medium transition hover:bg-secondary/70 disabled:opacity-50"
            >
              <Icon icon="ph:columns-plus-right" className="size-4" />
              {t("container.spalteHinzufuegen")}
            </button>
            {kinder.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {kinder.map((k, i) => (
                  <li key={k.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onWaehleContainer(k.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-(--radius) px-2 py-1 text-left text-[0.8125rem] transition hover:bg-secondary"
                    >
                      <Icon icon="ph:columns" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {kinder.length <= 1
                          ? t("container.inhalt")
                          : t("container.spalteNr", { nr: i + 1 })}
                      </span>
                      {kinder.length > 1 ? (
                        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                          {k.span ?? 12}/12
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() =>
                        void fuehreAus(async () => {
                          const res = await removeBlock(k.id);
                          return res.ok
                            ? { ok: true }
                            : { ok: false, error: res.error };
                        })
                      }
                      aria-label={t("container.loeschen")}
                      title={t("container.loeschen")}
                      className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                    >
                      <Icon icon="ph:trash" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </InspektorKarte>
      ) : null}

      {/* GRÖSSE — Mindesthöhe, und an Abschnitten die Breite der Spur. */}
      {/* LAYOUT — die Karte, die einen Rahmen erst zu einem Rahmen macht:
          Richtung, Verteilung, Ausrichtung, Abstand, Umbruch. In Framer heißt
          sie genauso und steht an derselben Stelle; sie ist der Grund, warum
          man Container überhaupt verschachtelt. */}
      <InspektorKarte titel={t("container.layout")} offenAnfangs>
        <div className="flex flex-col gap-1 px-4 pb-3 pt-0.5">
          <FeldZeile label={t("container.richtung")}>
            <Segment
              wert={feld("layout_richtung")}
              laeuft={laeuft}
              optionen={[
                ["spalte", "ph:rows", t("container.untereinander")],
                ["zeile", "ph:columns", t("container.nebeneinander")],
              ]}
              onWahl={(v) => setzeSetting("layout_richtung", v)}
            />
          </FeldZeile>
          {/* „Verteilen" ist bei Framer ein DROPDOWN und kein Segmentblock
              (live abgelesen 28.08.2026: „Verteilen · Center ▾"). Der Grund
              ist die Zahl der Möglichkeiten: fünf Segmente wären in 130 px
              fünf unlesbare Symbole. */}
          <FeldZeile label={t("container.verteilen")}>
            <select
              value={feld("layout_verteilen") ?? ""}
              disabled={laeuft}
              onChange={(e) =>
                setzeSetting("layout_verteilen", e.target.value || null)
              }
              className="min-w-0 flex-1 rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.8125rem] outline-none disabled:opacity-50"
            >
              <option value="">{t("container.automatisch")}</option>
              <option value="start">{t("container.anfang")}</option>
              <option value="mitte">{t("container.mitte")}</option>
              <option value="ende">{t("container.ende")}</option>
              <option value="zwischen">{t("container.zwischen")}</option>
              <option value="umgeben">{t("container.umgeben")}</option>
            </select>
          </FeldZeile>
          <FeldZeile label={t("container.ausrichten")}>
            <Segment
              wert={feld("layout_ausrichten")}
              laeuft={laeuft}
              optionen={[
                ["start", "ph:align-top-simple", t("container.anfang")],
                ["mitte", "ph:align-center-vertical-simple", t("container.mitte")],
                ["ende", "ph:align-bottom-simple", t("container.ende")],
                ["strecken", "ph:arrows-out-line-vertical", t("container.strecken")],
              ]}
              onWahl={(v) => setzeSetting("layout_ausrichten", v)}
            />
          </FeldZeile>
          <FeldZeile label={t("container.abstand")}>
            <Schieber
              wert={zahl("layout_abstand")}
              min={0}
              max={160}
              standard={16}
              laeuft={laeuft}
              onWert={(v) => setzeSetting("layout_abstand", v)}
            />
          </FeldZeile>
          <FeldZeile label={t("container.umbruch")}>
            <Segment
              wert={
                container.settings?.layout_umbruch === true
                  ? "ja"
                  : container.settings?.layout_umbruch === false
                    ? "nein"
                    : null
              }
              laeuft={laeuft}
              optionen={[
                ["ja", "ph:arrow-elbow-down-left", t("container.ja")],
                ["nein", "ph:arrow-right", t("container.nein")],
              ]}
              onWahl={(v) =>
                setzeSetting("layout_umbruch", v === null ? null : v === "ja")
              }
            />
          </FeldZeile>
        </div>
      </InspektorKarte>

      <InspektorKarte titel={t("container.groesse")}>
        <div className="flex flex-col gap-1.5 px-4 pb-3 pt-1">
          <FeldZeile label={t("container.minHoehe")}>
            <Zahlfeld
              wert={zahl("min_hoehe")}
              min={0}
              max={2000}
              einheit="px"
              laeuft={laeuft}
              onWert={(v) => setzeSetting("min_hoehe", v)}
            />
          </FeldZeile>
          {!istSpalte ? (
            <FeldZeile label={t("container.maxBreite")}>
              <Zahlfeld
                wert={zahl("max_breite")}
                min={320}
                max={2560}
                einheit="px"
                laeuft={laeuft}
                onWert={(v) => setzeSetting("max_breite", v)}
              />
            </FeldZeile>
          ) : null}
        </div>
      </InspektorKarte>

      <InspektorKarte titel={t("container.struktur")} offenAnfangs>
        <div className="grid grid-cols-2 gap-1 px-4 pb-3 pt-0.5">
          <StrukturKnopf
            icon="ph:arrow-up"
            label={t("container.hoch")}
            disabled={laeuft || rang <= 0}
            onClick={() =>
              void fuehreAus(() => moveContainer(container.id, rang - 1))
            }
          />
          <StrukturKnopf
            icon="ph:arrow-down"
            label={t("container.runter")}
            disabled={laeuft || rang < 0 || rang >= geschwister.length - 1}
            onClick={() =>
              void fuehreAus(() => moveContainer(container.id, rang + 1))
            }
          />
          <StrukturKnopf
            icon="ph:copy"
            label={t("container.duplizieren")}
            disabled={laeuft}
            onClick={() =>
              void fuehreAus(() => duplicateContainer(container.id))
            }
          />
          <StrukturKnopf
            icon="ph:trash"
            label={t("container.loeschen")}
            gefahr
            disabled={laeuft}
            onClick={() =>
              void fuehreAus(async () => {
                const res = await removeBlock(container.id);
                // Der gelöschte Container darf nicht ausgewählt bleiben —
                // sonst zeigt der Inspektor eine Zeile, die es nicht mehr
                // gibt (Wurzel 1).
                if (res.ok) onWaehleContainer(null);
                return res;
              })
            }
          />
        </div>
        <p className="px-4 pb-3 text-[0.6875rem] text-muted-foreground">
          {t("container.loeschenHinweis")}
        </p>
      </InspektorKarte>

      <InspektorKarte
        titel={t("arbeitsflaeche.design")}
        geaendert={Object.keys(container.settings ?? {}).length > 0}
      >
        <AbschnittDesign
          settings={container.settings ?? {}}
          onSettings={(st) =>
            void fuehreAus(() => updateBlock(container.id, { settings: st }))
          }
        />
      </InspektorKarte>
    </div>
  );
}

function StrukturKnopf({
  icon,
  label,
  onClick,
  disabled = false,
  gefahr = false,
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
      disabled={disabled}
      onClick={onClick}
      className={
        // Grauer Grund statt Umriss, volle Zellenbreite, 28 px hoch — das
        // Maß, in dem Framer seine Knöpfe setzt. Pillen mit Umriss lesen sich
        // als vier einzelne Dinge; vier gleich große Flächen als eine Gruppe.
        "flex items-center justify-center gap-1.5 rounded-(--radius) px-2 py-1.5 text-[0.75rem] font-medium transition disabled:opacity-40 " +
        (gefahr
          ? "bg-secondary text-destructive hover:bg-destructive/10"
          : "bg-secondary hover:bg-secondary/70")
      }
    >
      <Icon icon={icon} className="size-3.5" />
      {label}
    </button>
  );
}
