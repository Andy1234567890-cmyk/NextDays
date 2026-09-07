"use client";

// Bildeditor im Browser: Zuschneiden, Drehen, Spiegeln, Farbregler.
//
// Die Rechnungen stehen in `bild-canvas.ts` — dort auch die Begründung für die
// drei Fallen (EXIF-Orientierung, Safaris stille Canvas-Grenze, JPEG-Neukodieren
// bei jedem Reglerzug). Diese Datei ist die Bedienung darüber.
//
// Warum die Vorschau ein `<img>` mit CSS-Filtern ist und kein Canvas: Filter im
// CSS kosten nichts und laufen flüssig, während man am Regler zieht. Ein Canvas
// müsste bei jedem Zug neu zeichnen — und wer dabei `toBlob` ruft, kodiert ein
// JPEG zwanzigmal neu, bis es sichtbar schlechter ist. Kodiert wird deshalb
// GENAU EINMAL, beim Speichern.
//
// Das Ergebnis wird als NEUES Bild gespeichert, nicht über das alte geschrieben.
// Das Original ist die einzige Fassung, aus der jeder andere Zuschnitt noch
// möglich ist; es zu überschreiben wäre ein Verlust ohne Rückweg (Wurzel 1).
// Wer das bearbeitete Bild überall haben will, benutzt danach „Bild ersetzen".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import type { Medium } from "@/lib/site-pages";
import { uploadMedium } from "@/lib/site-pages";

import {
  type Bearbeitung,
  KEINE_BEARBEITUNG,
  SEITENVERHAELTNISSE,
  type VerhaeltnisId,
  type Vorlage,
  alsBlob,
  filterKette,
  haltVerhaeltnis,
  ladeVorlage,
  zeichne,
} from "./bild-canvas";

type ReglerId = "helligkeit" | "kontrast" | "saettigung" | "graustufen";

const REGLER: { id: ReglerId; min: number; max: number }[] = [
  { id: "helligkeit", min: 0, max: 200 },
  { id: "kontrast", min: 0, max: 200 },
  { id: "saettigung", min: 0, max: 200 },
  { id: "graustufen", min: 0, max: 100 },
];

/** Ein Medium NUR aus einer Adresse — für Aufrufer, die kein Bestandsobjekt
 *  haben (die Füllung im Style-Panel kennt bloß die URL des Bildes).
 *
 *  Der Editor braucht von einem Medium genau vier Dinge: die Adresse zum
 *  Laden, den Typ zum Kodieren, den Dateinamen für den Namen der Kopie und den
 *  Ordner für die Ablage. Alles andere steht hier auf einem ehrlichen Nullwert
 *  — es wird nichts erfunden, und gespeichert wird ohnehin ein NEUES Medium
 *  (das Original bleibt unangetastet, siehe Kopf dieser Datei). */
export function mediumAusUrl(url: string): Medium {
  const name = url.split("?")[0]?.split("/").pop() || "bild";
  const endung = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const mime =
    endung === "png"
      ? "image/png"
      : endung === "webp"
        ? "image/webp"
        : endung === "avif"
          ? "image/avif"
          : "image/jpeg";
  return {
    id: "",
    url,
    filename: name,
    mime,
    bytes: null,
    created_at: null,
    folder_id: null,
    alt_text: null,
    width: null,
    height: null,
    kind: "image",
    // `upload` und nicht geraten: liegt das Bild woanders, scheitert der
    // CORS-Abruf und der Editor sagt genau das (`ladefehler`) — bei
    // „nurEigene" stünde eine Erklärung da, die nicht stimmen muss.
    source: "upload",
    credit_name: null,
    credit_url: null,
  };
}

export function BildEditor({
  medium,
  onFertig,
  onSchliesse,
}: {
  medium: Medium;
  /** Das NEU entstandene Bild. Das Original bleibt unangetastet. */
  onFertig: (neu: Medium) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("website");
  const [vorlage, setVorlage] = useState<Vorlage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(KEINE_BEARBEITUNG);
  const [verhaeltnis, setVerhaeltnis] = useState<VerhaeltnisId>("frei");
  const [speichert, setSpeichert] = useState(false);
  const vorschauUrl = useRef<string | null>(null);
  const [quelleUrl, setQuelleUrl] = useState<string | null>(null);

  // --- Laden ---------------------------------------------------------------
  useEffect(() => {
    let abgebrochen = false;
    async function laden() {
      try {
        // Über `fetch` und nicht über ein `<img crossOrigin>`: nur so kommen wir
        // an die ROHEN Bytes, und nur darin steht das EXIF-Tag. Ein geladenes
        // `<img>` hat die Metadaten schon verloren.
        const antwort = await fetch(medium.url, { mode: "cors" });
        if (!antwort.ok) throw new Error(String(antwort.status));
        const blob = await antwort.blob();
        const v = await ladeVorlage(blob);
        if (abgebrochen) return;
        setVorlage(v);
        // Die Vorschau zeigt die ORIENTIERTE Vorlage, nicht die Originaldatei.
        // Sonst stünde im Editor ein liegendes Handyfoto, das nach dem Speichern
        // plötzlich aufrecht ist — dieselbe Falle, nur andersherum.
        (v.bild as HTMLCanvasElement).toBlob((b) => {
          if (!b || abgebrochen) return;
          const url = URL.createObjectURL(b);
          vorschauUrl.current = url;
          setQuelleUrl(url);
        });
      } catch (exc) {
        if (abgebrochen) return;
        // Der häufigste Grund ist CORS auf dem Bild-Host: Stock-Bilder liegen
        // als Hotlink beim Anbieter. Das wird BENANNT und nicht als „geht
        // gerade nicht" verschluckt — sonst sucht der Kunde den Fehler bei sich.
        setFehler(
          medium.source === "upload"
            ? t("mediathek.editor.ladefehler")
            : t("mediathek.editor.nurEigene"),
        );
        if (process.env.NODE_ENV !== "production") {
          console.warn("Bildeditor: Vorlage nicht ladbar", exc);
        }
      }
    }
    void laden();
    return () => {
      abgebrochen = true;
      if (vorschauUrl.current) URL.revokeObjectURL(vorschauUrl.current);
    };
  }, [medium.url, medium.source, t]);

  // Escape schließt — Tastaturbedienung ohne Mausweg zum X.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliesse();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [onSchliesse]);

  const setzeZuschnitt = useCallback(
    (teil: Partial<Bearbeitung["zuschnitt"]>) => {
      if (!vorlage) return;
      const gewaehlt = SEITENVERHAELTNISSE.find((v) => v.id === verhaeltnis);
      setBearbeitung((b) => ({
        ...b,
        zuschnitt: haltVerhaeltnis(
          { ...b.zuschnitt, ...teil },
          vorlage.breite,
          vorlage.hoehe,
          gewaehlt?.wert ?? null,
        ),
      }));
    },
    [vorlage, verhaeltnis],
  );

  // Verhältnis gewechselt → Zuschnitt sofort daran anpassen. Sonst zeigt die
  // Auswahl „1:1", während der Rahmen noch rechteckig ist.
  useEffect(() => {
    setzeZuschnitt({});
    // setzeZuschnitt hängt bereits an `verhaeltnis`; die Abhängigkeit ist
    // vollständig und die Schleife endet, weil `haltVerhaeltnis` idempotent ist.
  }, [setzeZuschnitt]);

  const veraendert = useMemo(
    () => JSON.stringify(bearbeitung) !== JSON.stringify(KEINE_BEARBEITUNG),
    [bearbeitung],
  );

  const masse = useMemo(() => {
    if (!vorlage) return null;
    const gedreht = bearbeitung.drehung === 90 || bearbeitung.drehung === 270;
    const b = Math.round(vorlage.breite * bearbeitung.zuschnitt.b);
    const h = Math.round(vorlage.hoehe * bearbeitung.zuschnitt.h);
    return gedreht ? { b: h, h: b } : { b, h };
  }, [vorlage, bearbeitung]);

  async function speichern() {
    if (!vorlage) return;
    setSpeichert(true);
    try {
      // HIER, und nur hier, wird kodiert.
      const blob = await alsBlob(zeichne(vorlage, bearbeitung), medium.mime);
      const name = medium.filename ?? "bild";
      const punkt = name.lastIndexOf(".");
      const basis = punkt > 0 ? name.slice(0, punkt) : name;
      const endung = medium.mime === "image/png" ? "png" : medium.mime === "image/webp" ? "webp" : "jpg";
      const datei = new File([blob], `${basis}-${t("mediathek.editor.suffix")}.${endung}`, {
        type: blob.type,
      });
      const res = await uploadMedium(datei, medium.folder_id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("mediathek.editor.gespeichert"));
      onFertig(res.data);
    } catch (exc) {
      toast.error(t("mediathek.editor.speicherfehler"));
      if (process.env.NODE_ENV !== "production") {
        console.warn("Bildeditor: Speichern fehlgeschlagen", exc);
      }
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("mediathek.editor.titel")}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
      onClick={onSchliesse}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="font-display text-lg font-extrabold">
            {t("mediathek.editor.titel")}
          </h2>
          <button
            type="button"
            aria-label={t("editor.schliessen")}
            onClick={onSchliesse}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        {fehler ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {fehler}
          </p>
        ) : !vorlage || !quelleUrl ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t("mediathek.editor.laedt")}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:flex-row">
            {/* --- Vorschau mit Zuschnittrahmen --- */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="relative overflow-hidden rounded-(--radius) bg-secondary/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={quelleUrl}
                  alt={medium.alt_text ?? medium.filename ?? ""}
                  className="mx-auto block max-h-[50vh] w-auto"
                  style={{
                    filter: filterKette(bearbeitung),
                    transform: `rotate(${bearbeitung.drehung}deg) scaleX(${
                      bearbeitung.spiegelH ? -1 : 1
                    }) scaleY(${bearbeitung.spiegelV ? -1 : 1})`,
                  }}
                />
                {/* Der Rahmen liegt ÜBER dem Bild und zeigt an, was bleibt. Er
                    ist bewusst nicht ziehbar: die vier Zahlenregler darunter
                    sind mit Tastatur bedienbar, ein Ziehrahmen wäre es nicht. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  style={{
                    left: `${bearbeitung.zuschnitt.x * 100}%`,
                    top: `${bearbeitung.zuschnitt.y * 100}%`,
                    width: `${bearbeitung.zuschnitt.b * 100}%`,
                    height: `${bearbeitung.zuschnitt.h * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {masse
                  ? t("mediathek.editor.ergebnis", { b: masse.b, h: masse.h })
                  : null}
                {vorlage.verkleinert ? (
                  // Das Herunterrechnen wird BENANNT. Ein stilles Verkleinern
                  // wäre eine Änderung, die niemand angekündigt hat (Wurzel 4).
                  <span className="ml-2 text-amber-600">
                    {t("mediathek.editor.verkleinert", {
                      b: vorlage.originalBreite,
                      h: vorlage.originalHoehe,
                    })}
                  </span>
                ) : null}
              </p>
            </div>

            {/* --- Werkzeuge --- */}
            <div className="flex w-full shrink-0 flex-col gap-4 md:w-72">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("mediathek.editor.zuschnitt")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SEITENVERHAELTNISSE.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVerhaeltnis(v.id)}
                      className={
                        "rounded-full border px-3 py-1 text-xs font-medium transition " +
                        (verhaeltnis === v.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-secondary")
                      }
                    >
                      {t(`mediathek.editor.verhaeltnis.${v.id}`)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["x", 0, 1],
                      ["y", 0, 1],
                      ["b", 0.05, 1],
                      ["h", 0.05, 1],
                    ] as const
                  ).map(([feld, min, max]) => (
                    <label key={feld} className="text-xs text-muted-foreground">
                      {t(`mediathek.editor.zuschnittFeld.${feld}`)}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={bearbeitung.zuschnitt[feld]}
                        onChange={(e) =>
                          setzeZuschnitt({ [feld]: Number(e.target.value) })
                        }
                        // Höhe folgt der Breite, sobald ein festes Verhältnis
                        // gewählt ist — ein Regler, der nichts bewirkt, wäre eine
                        // Attrappe, also wird er deaktiviert.
                        disabled={feld === "h" && verhaeltnis !== "frei"}
                        className="w-full disabled:opacity-40"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("mediathek.editor.ausrichtung")}
                </p>
                <div className="flex gap-1.5">
                  <WerkzeugKnopf
                    icon="ph:arrow-counter-clockwise"
                    titel={t("mediathek.editor.linksDrehen")}
                    onClick={() =>
                      setBearbeitung((b) => ({
                        ...b,
                        drehung: (((b.drehung + 270) % 360) as Bearbeitung["drehung"]),
                      }))
                    }
                  />
                  <WerkzeugKnopf
                    icon="ph:arrow-clockwise"
                    titel={t("mediathek.editor.rechtsDrehen")}
                    onClick={() =>
                      setBearbeitung((b) => ({
                        ...b,
                        drehung: (((b.drehung + 90) % 360) as Bearbeitung["drehung"]),
                      }))
                    }
                  />
                  <WerkzeugKnopf
                    icon="ph:flip-horizontal"
                    titel={t("mediathek.editor.spiegelH")}
                    aktiv={bearbeitung.spiegelH}
                    onClick={() =>
                      setBearbeitung((b) => ({ ...b, spiegelH: !b.spiegelH }))
                    }
                  />
                  <WerkzeugKnopf
                    icon="ph:flip-vertical"
                    titel={t("mediathek.editor.spiegelV")}
                    aktiv={bearbeitung.spiegelV}
                    onClick={() =>
                      setBearbeitung((b) => ({ ...b, spiegelV: !b.spiegelV }))
                    }
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("mediathek.editor.farbe")}
                </p>
                {REGLER.map((r) => (
                  <label
                    key={r.id}
                    className="mb-1.5 block text-xs text-muted-foreground"
                  >
                    <span className="flex justify-between">
                      <span>{t(`mediathek.editor.regler.${r.id}`)}</span>
                      <span className="tabular-nums">{bearbeitung[r.id]}</span>
                    </span>
                    <input
                      type="range"
                      min={r.min}
                      max={r.max}
                      value={bearbeitung[r.id]}
                      onChange={(e) =>
                        setBearbeitung((b) => ({
                          ...b,
                          [r.id]: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {t("mediathek.editor.alsNeuesBild")}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={!veraendert || speichert}
                    onClick={() => setBearbeitung(KEINE_BEARBEITUNG)}
                  >
                    {t("mediathek.editor.zuruecksetzen")}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!veraendert || speichert}
                    onClick={() => void speichern()}
                  >
                    {speichert
                      ? t("mediathek.editor.speichert")
                      : t("mediathek.editor.speichern")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WerkzeugKnopf({
  icon,
  titel,
  aktiv = false,
  onClick,
}: {
  icon: string;
  titel: string;
  aktiv?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      aria-pressed={aktiv}
      onClick={onClick}
      className={
        "rounded-(--radius) border p-2 transition " +
        (aktiv
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
