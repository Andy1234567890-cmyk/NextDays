"use client";

// „Barrierefreiheit" (Airbnb „Accessibility features") als rechte Sidebar. Drei
// innere Ansichten: (1) Merkmal-Liste nach Kategorie, (2) Merkmal-Detail mit
// Demofoto-Galerie + Foto-Richtlinien-Modal + Ja/Nein-Radio + (bei Ja) Foto-
// Upload, (3) Vollbild-Galerie der Demofotos.
//
// Zwei Arten von Bildern, die NICHT verwechselt werden dürfen:
//   • Demofotos aus dem Katalog — reine Vorlagen („so sieht ein gutes Foto aus"),
//     werden nie hochgeladen oder gespeichert.
//   • Beweisfotos des Gastgebers — echter Upload nach
//     property_accessibility_photos (0201) mit Prüfstatus. Wie bei Airbnb wird
//     ein Merkmal erst mit geprüften Fotos glaubwürdig; die Freigabe erfolgt im
//     Plattform-Backoffice.
//
// Das has-Flag selbst liegt weiterhin in type_attributes.accessibility.
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  type BarriereFoto,
  ladeBarriereFotoHoch,
  ladeBarriereFotos,
  loescheBarriereFoto,
} from "@/lib/barriere-fotos";

import {
  BARRIERE_MERKMALE,
  type BarriereMerkmal,
} from "./barrierefreiheit-katalog";

export function BarrierefreiheitPanel({
  werte,
  propertyId,
  onSpeichere,
  onZurueck,
  onDetailOffen,
}: {
  werte: Record<string, { has: boolean }>;
  /** Objekt, zu dem die Beweisfotos gehören. */
  propertyId: string;
  onSpeichere: (key: string, has: boolean, facility: string | null) => Promise<boolean>;
  /** Schließen-X. Entfällt als Hauptabschnitt des Editors — dort gibt es
   *  nichts zu schließen, die linke Abschnittsliste bleibt sichtbar. */
  onZurueck?: () => void;
  /** Meldet dem Editor, ob die Merkmal-Detailansicht offen ist. Der blendet
   *  dann die linke Abschnittsliste aus, damit das Detail die volle Breite
   *  bekommt — wie bei Ausstattung, Lage und Preisen. */
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  // Kompakt = das Panel läuft selbst als schmale Sidebar (Fototour, 30rem).
  // Dort ist für zwei Spalten kein Platz: Das Detail ERSETZT die Liste.
  // Als Hauptabschnitt des Editors (kein onZurueck) steht die Liste dagegen
  // stehen und das Detail fährt rechts daneben aus.
  const kompakt = onZurueck != null;
  // Offenes Merkmal (Detail) oder null (Liste).
  const [offen, setOffenState] = useState<BarriereMerkmal | null>(null);
  function setOffen(m: BarriereMerkmal | null) {
    setOffenState(m);
    onDetailOffen?.(m != null);
  }

  // Schmale Sidebar: kein Platz für zwei Spalten — das Detail ersetzt die Liste.
  if (kompakt && offen) {
    return (
      <MerkmalDetail
        key={offen.key}
        merkmal={offen}
        vorhanden={werte[offen.key]?.has ?? null}
        propertyId={propertyId}
        onSetze={(has) => onSpeichere(offen.key, has, offen.facility)}
        onZurueck={() => setOffen(null)}
        mitZurueck
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Linke Spalte: die Merkmal-Liste. Sie bleibt beim Öffnen eines Merkmals
          STEHEN — kein Ansichtswechsel; das Detail fährt rechts daneben aus
          (dieselbe Mechanik wie Ausstattung/Preise/Lage). */}
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Schließen-X oben rechts (Airbnb-Muster) — nur als Sidebar. */}
          {onZurueck && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={onZurueck}
                aria-label={t("schliessen")}
                className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
              >
                <Icon icon="ph:x" className="size-5" />
              </button>
            </div>
          )}
          {/* Große Überschrift, kein Erklärtext darunter: Die Merkmale sprechen
              für sich, das Detail erklärt jedes einzelne. */}
          <h2 className="font-sans text-[2.5rem] font-semibold leading-tight tracking-tight">
            {t("barriereTitel")}
          </h2>

          {/* Merkmal-Liste: Symbol links, Bezeichnung, Aktion rechts. Bewusst
              OHNE Kategorie-Überschriften und Trennlinien — eine durchgehende,
              luftige Liste (Airbnb-Muster). Ein gesetztes Merkmal zeigt statt
              „+" einen Haken. */}
          <ul className="mt-6">
            {BARRIERE_MERKMALE.map((m) => {
              const v = werte[m.key]?.has;
              const istOffen = offen?.key === m.key;
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => setOffen(istOffen ? null : m)}
                    className={`group flex w-full items-center gap-5 rounded-2xl px-4 py-5 text-start outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                      // Das offene Merkmal hebt sich als Karte ab (Airbnb):
                      // Schatten statt Farbfläche, damit die Liste ruhig bleibt.
                      // outline-none unterdrückt den blauen Browser-Rahmen nach
                      // dem Klick; focus-visible hält die Tastaturbedienung
                      // sichtbar (nur dieselbe Behandlung wie die Abschnitts-
                      // karten links).
                      istOffen ? "bg-background shadow-lg" : ""
                    }`}
                  >
                    <Icon
                      icon={m.icon}
                      className="size-7 shrink-0 text-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.0625rem]">
                        {t(m.labelKey)}
                      </span>
                      {v === false && (
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {t("barriereNein")}
                        </span>
                      )}
                    </span>
                    {/* Rundes Feld rechts: „+" zum Hinzufügen, Haken wenn
                        vorhanden — der Zustand ist so ohne Text ablesbar. */}
                    <span
                      aria-hidden
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                        v
                          ? "bg-foreground text-background"
                          : "text-foreground group-hover:bg-muted"
                      }`}
                    >
                      <Icon icon={v ? "ph:check" : "ph:plus"} className="size-5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Inline-Detail-Sidebar (kein Overlay): fährt aus und schiebt die Liste
          zusammen — exakt wie die Ausstattungs-Auswahl. Nur als Hauptabschnitt:
          In der schmalen Fototour-Sidebar (30rem) wäre für zwei Spalten kein
          Platz, dort ersetzt das Detail die Liste (siehe unten). */}
      <AnimatePresence initial={false}>
        {offen && !kompakt && (
          <motion.aside
            key="barriere-sidebar"
            className="shrink-0 overflow-hidden border-s border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert
                ? { duration: 0 }
                : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              {/* key: Beim Wechsel auf ein anderes Merkmal muss das Detail neu
                  aufgebaut werden. Ohne key behielte es die Ja/Nein-Auswahl und
                  die geladenen Fotos des vorigen Merkmals — der lokale Zustand
                  wird nur beim Mount aus `vorhanden` initialisiert. */}
              <MerkmalDetail
                key={offen.key}
                merkmal={offen}
                vorhanden={werte[offen.key]?.has ?? null}
                propertyId={propertyId}
                onSetze={(has) => onSpeichere(offen.key, has, offen.facility)}
                onZurueck={() => setOffen(null)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// — Ein Demofoto (Beispielbild aus dem Katalog) —
//
// Fehlt die Datei, zeigt der Browser sonst das gebrochene Bildsymbol samt
// alt-Text — das sieht nach Defekt aus. Stattdessen ein ruhiger Platzhalter:
// Die Beispielbilder sind eine Hilfestellung, kein Inhalt des Gastgebers, und
// ihr Fehlen darf die Ansicht nicht beschädigen.
function DemoFoto({
  bild,
  alt,
  onOeffne,
}: {
  bild: { src: string; altKey: string };
  /** Bereits übersetzter alt-Text — das Katalog-Objekt trägt nur den Schlüssel. */
  alt: string;
  onOeffne: () => void;
}) {
  const [fehlt, setFehlt] = useState(false);

  if (fehlt) {
    return (
      <div className="flex aspect-[4/3] w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-muted px-4 text-center">
        <Icon icon="ph:image" className="size-7 text-muted-foreground/60" />
        <span className="text-xs text-muted-foreground">{alt}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOeffne}
      className="aspect-[4/3] w-56 shrink-0 overflow-hidden rounded-2xl bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bild.src}
        alt={alt}
        onError={() => setFehlt(true)}
        className="size-full object-cover"
      />
    </button>
  );
}

// — Merkmal-Detail: Demofoto-Galerie, Richtlinien, Ja/Nein, Upload-Platzhalter —
function MerkmalDetail({
  merkmal,
  vorhanden,
  propertyId,
  onSetze,
  onZurueck,
  mitZurueck = false,
}: {
  merkmal: BarriereMerkmal;
  vorhanden: boolean | null;
  /** Objekt, zu dem die Beweisfotos gehören. */
  propertyId: string;
  onSetze: (has: boolean) => Promise<boolean>;
  onZurueck: () => void;
  /** Zurück-Pfeil im Kopf zeigen. Nötig, wenn das Detail die Liste ERSETZT
   *  (schmale Sidebar) — steht die Liste daneben, führt der Pfeil nirgendwo hin. */
  mitZurueck?: boolean;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<boolean | null>(vorhanden);
  const [speichert, setSpeichert] = useState(false);
  const [richtlinienOffen, setRichtlinienOffen] = useState(false);
  const [galerieIndex, setGalerieIndex] = useState<number | null>(null);

  // --- Beweisfotos dieses Merkmals -----------------------------------------
  const [fotos, setFotos] = useState<BarriereFoto[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fotoFehler, setFotoFehler] = useState<string | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);

  // Fotos laden, sobald das Merkmal als „vorhanden" markiert ist (vorher gibt
  // es nichts zu zeigen). Bei Merkmalwechsel neu laden.
  useEffect(() => {
    if (lokal !== true) {
      setFotos([]);
      return;
    }
    let aktiv = true;
    ladeBarriereFotos(propertyId, merkmal.key)
      .then((liste) => {
        if (aktiv) setFotos(liste);
      })
      .catch(() => {
        /* Ladefehler → leere Liste; der Upload bleibt nutzbar. */
      });
    return () => {
      aktiv = false;
    };
  }, [propertyId, merkmal.key, lokal]);

  async function fotoGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = ""; // dieselbe Datei erneut wählbar machen
    if (!datei) return;
    setLaedt(true);
    setFotoFehler(null);
    try {
      const neu = await ladeBarriereFotoHoch(propertyId, merkmal.key, datei);
      setFotos((f) => [...f, neu]);
    } catch (exc) {
      setFotoFehler(
        exc instanceof Error ? exc.message : t("barriereFotoFehler"),
      );
    } finally {
      setLaedt(false);
    }
  }

  async function fotoLoeschen(fotoId: string) {
    // Optimistisch entfernen; bei Fehler zurückholen (Wurzel 1: Gegenzustand).
    const vorher = fotos;
    setFotos((f) => f.filter((x) => x.id !== fotoId));
    try {
      await loescheBarriereFoto(propertyId, fotoId);
    } catch {
      setFotos(vorher);
      setFotoFehler(t("barriereFotoLoeschFehler"));
    }
  }

  async function speichern() {
    if (lokal == null) return;
    setSpeichert(true);
    const ok = await onSetze(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    // Eigener Flex-Container mit fester Höhe: Ohne ihn hätten die shrink-0-
    // und flex-1-Klassen der drei Bereiche keinen Bezugsrahmen, der mittlere
    // Teil würde über die Sidebar hinauswachsen statt zu scrollen — und Kopf
    // wie Fußzeile würden mitwandern (Muster wie AmenityPanel).
    <div className="flex h-full min-h-0 flex-col">
      {/* Kopf. Der Zurück-Pfeil erscheint nur, wenn das Detail die Liste
          ersetzt — steht die Liste daneben, führt er nirgendwo hin. */}
      <div className="shrink-0 px-8 pt-8 lg:pt-12">
        {mitZurueck && (
          <button
            type="button"
            aria-label={t("zurueck")}
            onClick={onZurueck}
            className="mb-4 flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:arrow-left" className="size-4" />
          </button>
        )}
        <h2 className="font-sans text-[2rem] font-bold tracking-tight">
          {t(merkmal.labelKey)}
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          {t(merkmal.beschreibungKey)}
        </p>
      </div>

      {/* Scrollender Inhalt. pb-8, damit der letzte Eintrag beim Herunterscrollen
          nicht an der Fußzeile klebt. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-6">
        {/* Demofoto-Galerie (Beispiele). Hat ein Merkmal noch keine
            Beispielbilder, entfällt der ganze Block — eine Überschrift ohne
            Inhalt sähe nach einem Ladefehler aus. */}
        {merkmal.bilder.length > 0 && (
          <>
            <p className="mb-3 text-sm font-medium">{t("barriereBeispiele")}</p>
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
              {merkmal.bilder.map((b, i) => (
                <DemoFoto
                  key={b.src}
                  bild={b}
                  alt={t(b.altKey)}
                  onOeffne={() => setGalerieIndex(i)}
                />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setRichtlinienOffen(true)}
          className="mt-3 text-sm font-medium underline underline-offset-4"
        >
          {t("barriereRichtlinien")}
        </button>

        {/* Ja/Nein-Radio */}
        <div className="mt-8 space-y-3">
          {[false, true].map((wert) => {
            const aktiv = lokal === wert;
            return (
              <button
                key={String(wert)}
                type="button"
                onClick={() => setLokal(wert)}
                className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-start transition-colors ${aktiv ? "border-foreground bg-muted/40" : "border-border hover:border-foreground"
                  }`}
              >
                <span className="font-medium">
                  {wert ? t("barriereHabeIch") : t("barriereHabeIchNicht")}
                </span>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${aktiv ? "border-foreground" : "border-border"
                    }`}
                >
                  {aktiv && <span className="size-2.5 rounded-full bg-foreground" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Foto-Bereich — erst mit „vorhanden" (Airbnb-Flow): Anleitung als
            Bullet-Liste, echter Upload und Prüf-Hinweis. Die hochgeladenen
            Fotos gehen als Beweis in die Prüfung (property_accessibility_photos,
            Migration 0201); freigegeben werden sie im Plattform-Backoffice. */}
        {lokal === true && (
          <div className="mt-8">
            <p className="font-medium">{t("barriereFotosTitel")}</p>
            <ul className="mt-3 space-y-2">
              {merkmal.fotoHinweisKeys.map((h) => (
                <li
                  key={h}
                  className="flex gap-2.5 text-sm text-muted-foreground"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  {t(h)}
                </li>
              ))}
            </ul>

            {/* Bereits hochgeladene Fotos mit Prüfstatus. */}
            {fotos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {fotos.map((f) => (
                  <div key={f.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt=""
                      className="size-24 rounded-xl object-cover"
                    />
                    <span
                      className={`absolute inset-x-1 bottom-1 rounded-md px-1.5 py-0.5 text-center text-[0.625rem] font-semibold ${
                        f.status === "approved"
                          ? "bg-foreground text-background"
                          : f.status === "rejected"
                            ? "bg-destructive text-background"
                            : "bg-background/90 text-foreground"
                      }`}
                    >
                      {f.status === "approved"
                        ? t("barriereFotoFreigegeben")
                        : f.status === "rejected"
                          ? t("barriereFotoAbgelehnt")
                          : t("barriereFotoInPruefung")}
                    </span>
                    <button
                      type="button"
                      aria-label={t("barriereFotoLoeschen")}
                      onClick={() => void fotoLoeschen(f.id)}
                      className="absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-background shadow-md transition-opacity hover:opacity-80"
                    >
                      <Icon icon="ph:x" className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={dateiFeld}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={fotoGewaehlt}
            />
            <button
              type="button"
              disabled={laedt}
              onClick={() => dateiFeld.current?.click()}
              className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center transition-colors hover:border-foreground disabled:opacity-60"
            >
              <Icon icon="ph:camera" className="size-7 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {laedt ? t("barriereFotoLaedt") : t("barriereFotosBtn")}
              </span>
            </button>
            {fotoFehler && (
              <p className="mt-3 text-sm text-destructive">{fotoFehler}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("barriereFotosPruefung")}
            </p>
          </div>
        )}
      </div>

      {/* Fußzeile */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-8 py-5">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("abbrechen")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert || lokal == null}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {speichert ? t("speichert") : t("fertig")}
        </button>
      </div>

      {/* Foto-Richtlinien-Modal */}
      <Dialog open={richtlinienOffen} onOpenChange={setRichtlinienOffen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-sans text-2xl font-bold tracking-tight">
            {t("barriereRichtlinienTitel")}
          </DialogTitle>
          <ul className="mt-4 space-y-4">
            {["r1", "r2", "r3"].map((k) => (
              <li key={k} className="text-[0.9375rem] text-muted-foreground">
                {t(`barriereRichtlinie_${k}`)}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-end">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {t("verstanden")}
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vollbild-Galerie der Demofotos */}
      {galerieIndex != null && (
        <VollbildGalerie
          bilder={merkmal.bilder}
          index={galerieIndex}
          onSetze={setGalerieIndex}
          onSchliesse={() => setGalerieIndex(null)}
        />
      )}
    </div>
  );
}

// — Vollbild-Galerie (Demofotos) —
function VollbildGalerie({
  bilder,
  index,
  onSetze,
  onSchliesse,
}: {
  bilder: { src: string; altKey: string }[];
  index: number;
  onSetze: (i: number) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("objektEditor");
  const aktiv = bilder[index];
  const aktivAlt = t(aktiv.altKey);
  const vor = () => onSetze((index - 1 + bilder.length) % bilder.length);
  const zurueck = () => onSetze((index + 1) % bilder.length);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          aria-label={t("schliessen")}
          onClick={onSchliesse}
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
        <span className="text-sm font-semibold tabular-nums">
          {index + 1} / {bilder.length}
        </span>
        <span className="size-9" />
      </div>
      <div className="flex flex-1 items-center gap-6 px-6 pb-10">
        {bilder.length > 1 && (
          <button
            type="button"
            aria-label="Vorheriges"
            onClick={vor}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Icon icon="ph:caret-left" className="size-5" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-10">
          <div className="aspect-[3/2] w-full max-w-3xl overflow-hidden rounded-2xl bg-muted">
            {/* key: Beim Blättern muss das <img> neu aufgebaut werden, sonst
                bliebe ein zuvor gesetzter Fehlerzustand am selben Element
                hängen. onError blendet ein fehlendes Bild aus, statt das
                gebrochene Bildsymbol zu zeigen. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={aktiv.src}
              src={aktiv.src}
              alt={aktivAlt}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              className="size-full object-cover"
            />
          </div>
          <p className="hidden w-64 shrink-0 text-[0.9375rem] leading-relaxed lg:block">
            {aktivAlt}
          </p>
        </div>
        {bilder.length > 1 && (
          <button
            type="button"
            aria-label="Nächstes"
            onClick={zurueck}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Icon icon="ph:caret-right" className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
