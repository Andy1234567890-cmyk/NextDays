"use client";

// Zimmer-Detailansicht (Airbnb: Klick auf eine Foto-Kachel → diese Ansicht).
// Links eine schmale Zimmer-Navigation (Thumbnails), rechts die große Upload-Box
// + eine Liste von Detail-Zeilen (Schlafmöglichkeiten / Privatsphäre / Ausstattung
// / Barrierefreiheit). Klick auf „Schlafmöglichkeiten" meldet das Thema nach OBEN
// (an den Editor) — der öffnet dann die rechte Bett-Sidebar (wie Airbnb), diese
// Ansicht bleibt links vollständig sichtbar.
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@nextdays/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { FOTO_ACCEPT } from "@/lib/foto-konvertierung";
import { type PropertyPhoto, uploadPhoto } from "@/lib/property-photos";

import { BETT_TYPEN } from "./bett-typen";
import { KachelThumb } from "./foto-kacheln";
import { WeitereFotos } from "./weitere-fotos";

export type RaumKachel = { id: string; titel: string; bild: string | null };

/** Foto-Menü (oben rechts): Vom Gerät / Aus weiteren Fotos / (Entfernen). */
function FotoMenu({
  gesetzt,
  ausWeiterenMoeglich,
  onVomGeraet,
  onAusWeiteren,
  onEntfernen,
}: {
  gesetzt: boolean;
  ausWeiterenMoeglich: boolean;
  onVomGeraet: () => void;
  onAusWeiteren: () => void;
  onEntfernen: () => void;
}) {
  const t = useTranslations("objektEditor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={gesetzt ? t("fotoWechseln") : t("raumFotoHinzufuegen")}
          className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-muted/70 data-[state=open]:bg-muted/70"
        >
          <Icon icon={gesetzt ? "ph:dots-three" : "ph:plus"} className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-2">
        <DropdownMenuItem
          onSelect={onVomGeraet}
          className="gap-3 rounded-xl px-3 py-2.5 font-medium"
        >
          <Icon icon="ph:upload-simple" className="size-5" />
          {gesetzt ? t("fotoWechseln") : t("fotoVomGeraet")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!ausWeiterenMoeglich}
          onSelect={onAusWeiteren}
          className="gap-3 rounded-xl px-3 py-2.5 font-medium"
        >
          <Icon icon="ph:images" className="size-5" />
          {t("fotoAusWeiteren")}
        </DropdownMenuItem>
        {gesetzt && (
          <DropdownMenuItem
            onSelect={onEntfernen}
            className="gap-3 rounded-xl px-3 py-2.5 font-medium text-destructive focus:text-destructive"
          >
            <Icon icon="ph:trash" className="size-5" />
            {t("fotoEntfernen")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Kurz-Zusammenfassung der Betten eines Zimmers („1 Doppelbett · 1 Einzelbett"). */
function schlafZusammenfassung(werte: Record<string, number>): string {
  return BETT_TYPEN.filter((bt) => (werte[bt.key] ?? 0) > 0)
    .map((bt) => `${werte[bt.key]} ${bt.label}`)
    .join(" · ");
}

export function RaumDetail({
  raeume,
  aktivId,
  propertyId,
  fotos,
  sleeping,
  privacy,
  amenityAnzahl,
  barriereAnzahl,
  aktivesThema,
  onWaehle,
  onZurueck,
  onOeffneThema,
  onFotoHochgeladen,
  onFotoGewaehlt,
  onFotoEntfernt,
}: {
  raeume: RaumKachel[];
  aktivId: string;
  // Objekt-ID (für Foto-Upload über den BFF-Route-Handler).
  propertyId: string;
  // Bereits hochgeladene Objekt-Fotos (id + url) — Galerie „Weitere Fotos" +
  // Picker „Aus weiteren Fotos wählen".
  fotos: PropertyPhoto[];
  // Bett-Zähler je Zimmer-ID (aus type_attributes.sleeping).
  sleeping: Record<string, Record<string, number>>;
  // Privatsphäre (Türschloss) je Zimmer-ID (aus type_attributes.privacy).
  privacy: Record<
    string,
    { hasLock: boolean; lockType: "inside_only" | "inside_outside" | null }
  >;
  // Ausstattung des Objekts (properties.amenities, objektweit) — für die Vorschau.
  amenityAnzahl: number;
  // Anzahl gesetzter Barrierefreiheits-Merkmale (has=true) — für die Vorschau.
  barriereAnzahl: number;
  // Offenes Unterthema (öffnet die rechte Sidebar) oder null.
  aktivesThema: string | null;
  onWaehle: (id: string) => void;
  onZurueck: () => void;
  onOeffneThema: (thema: string | null) => void;
  // Nach erfolgreichem Upload: das neue Foto (id + url) nach oben melden.
  onFotoHochgeladen: (foto: PropertyPhoto) => void;
  // Ein bereits hochgeladenes Foto diesem Zimmer zuordnen (Cover der Kachel).
  onFotoGewaehlt: (raumId: string, url: string) => void;
  // Ein Foto wurde gelöscht (id + url) → Editor entfernt es aus dem State.
  onFotoEntfernt: (fotoId: string, url: string) => void;
}) {
  const t = useTranslations("objektEditor");
  const aktiv = raeume.find((r) => r.id === aktivId) ?? raeume[0];
  const dateiInput = useRef<HTMLInputElement>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pickerOffen, setPickerOffen] = useState(false);

  const istWeitere = aktiv.id === "weitere";

  async function dateiGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? []);
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (dateien.length === 0) return;
    setFehler(null);
    setLaedt(true);
    try {
      // Mehrere Dateien nacheinander hochladen (Backend nimmt eine je Aufruf).
      for (const datei of dateien) {
        const foto = await uploadPhoto(propertyId, datei);
        onFotoHochgeladen(foto);
        // Zimmer-Kachel bekommt ihr Cover; „Weitere Fotos" ist die Sammelgalerie.
        if (!istWeitere) onFotoGewaehlt(aktiv.id, foto.url);
      }
    } catch (exc) {
      setFehler(exc instanceof Error ? exc.message : t("fotoFehler"));
    } finally {
      setLaedt(false);
    }
  }

  const werteAktiv = sleeping[aktiv.id] ?? {};
  const schlafVorschau = schlafZusammenfassung(werteAktiv);

  const priv = privacy[aktiv.id];
  const privacyVorschau = !priv
    ? ""
    : !priv.hasLock
      ? t("lockKeins")
      : priv.lockType === "inside_only"
        ? t("lockInnen")
        : priv.lockType === "inside_outside"
          ? t("lockInnenAussen")
          : t("lockTuer");

  const zeilen: { key: string; label: string; hint: string; thema?: string }[] = [
    {
      key: "schlafen",
      label: t("raumSchlafen"),
      hint: schlafVorschau || t("raumSchlafenHint"),
      thema: "schlafen",
    },
    {
      key: "privacy",
      label: t("raumPrivacy"),
      hint: privacyVorschau || t("raumPrivacyHint"),
      thema: "privacy",
    },
    {
      key: "amenities",
      label: t("raumAmenities"),
      hint:
        amenityAnzahl > 0
          ? t("amenityAnzahl", { n: amenityAnzahl })
          : t("raumAmenitiesHint"),
      thema: "amenities",
    },
    {
      key: "barriere",
      label: t("raumBarriere"),
      hint:
        barriereAnzahl > 0
          ? t("barriereAnzahl", { n: barriereAnzahl })
          : t("raumBarriereHint"),
      thema: "barriere",
    },
  ];

  // Bei offener Sidebar (Thema) blendet Airbnb die Thumbnail-Navigation aus —
  // nur der Zurück-Pfeil bleibt. Erst geschlossen zeigt sie die Zimmer wieder.
  const themaOffen = aktivesThema != null;

  return (
    <div className="flex gap-10">
      {/* Zimmer-Navigation links */}
      <nav className="flex w-28 shrink-0 flex-col items-center gap-5">
        <button
          type="button"
          aria-label="Zurück"
          onClick={themaOffen ? () => onOeffneThema(null) : onZurueck}
          className="flex size-9 items-center justify-center self-start rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:arrow-left" className="size-4" />
        </button>
        {!themaOffen &&
          raeume.map((r) => (
            <KachelThumb
              key={r.id}
              raum={r}
              aktiv={r.id === aktivId}
              onWaehle={() => onWaehle(r.id)}
            />
          ))}
      </nav>

      {/* Detail rechts */}
      <div className="min-w-0 flex-1">
        {istWeitere ? (
          /* „Weitere Fotos" = eigene Sammelgalerie mit Upload-Modal + Lightbox. */
          <WeitereFotos
            propertyId={propertyId}
            fotos={fotos}
            onFotoHochgeladen={onFotoHochgeladen}
            onFotoEntfernt={onFotoEntfernt}
          />
        ) : (
          <>
            <div className="mb-2 flex items-start justify-between gap-4">
              <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                {aktiv.titel}
              </h2>
              <FotoMenu
                gesetzt={!!aktiv.bild}
                ausWeiterenMoeglich={fotos.length > 0}
                onVomGeraet={() => dateiInput.current?.click()}
                onAusWeiteren={() => setPickerOffen(true)}
                onEntfernen={() => onFotoGewaehlt(aktiv.id, "")}
              />
            </div>

            {/* Verstecktes Datei-Feld für „Vom Gerät hochladen". */}
            <input
              ref={dateiInput}
              type="file"
              accept={FOTO_ACCEPT}
              className="hidden"
              onChange={dateiGewaehlt}
            />

            {aktiv.bild ? (
              /* Gesetztes Zimmer-Foto groß mit Wechseln/Entfernen-Overlay. */
              <div className="group relative mt-6 aspect-[3/2] w-full overflow-hidden rounded-2xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aktiv.bild}
                  alt={aktiv.titel}
                  className="size-full object-cover"
                />
                {laedt && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                    <Icon icon="ph:spinner-gap" className="size-10 animate-spin" />
                  </div>
                )}
                <div className="absolute end-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => dateiInput.current?.click()}
                    disabled={laedt}
                    className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-background disabled:opacity-60"
                  >
                    <Icon icon="ph:arrows-clockwise" className="size-4" />
                    {t("fotoWechseln")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("fotoEntfernen")}
                    onClick={() => onFotoGewaehlt(aktiv.id, "")}
                    disabled={laedt}
                    className="flex size-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm transition-colors hover:bg-background disabled:opacity-60"
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Leere Upload-Box (Einzel-Cover je Zimmer). */
              <button
                type="button"
                onClick={() => dateiInput.current?.click()}
                disabled={laedt}
                className="mt-6 flex min-h-[18rem] w-full flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border bg-muted/30 p-8 transition-colors hover:bg-muted/50 disabled:opacity-70"
              >
                {laedt ? (
                  <Icon icon="ph:spinner-gap" className="size-12 animate-spin text-muted-foreground" />
                ) : (
                  <Icon icon="fluent-emoji:bed" className="size-28" />
                )}
                <span className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold">
                  {laedt ? t("fotoLaedt") : t("raumFotoHinzufuegen")}
                </span>
              </button>
            )}
            {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}

            {/* Detail-Zeilen — die aktive (offene) ist hervorgehoben */}
            <div className="mt-6 divide-y divide-border">
              {zeilen.map((z) => {
                const offen = z.thema != null && z.thema === aktivesThema;
                return (
                  <button
                    key={z.key}
                    type="button"
                    onClick={() => z.thema && onOeffneThema(offen ? null : z.thema)}
                    className={`flex w-full items-center gap-4 rounded-xl px-3 py-5 text-start transition-colors ${
                      offen ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{z.label}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {z.hint}
                      </p>
                    </div>
                    <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              <Icon icon="ph:trash" className="size-4" />
              {t("raumLoeschen")}
            </button>
          </>
        )}
      </div>

      {/* „Aus weiteren Fotos wählen" (nur Zimmer) — ordnet ein Foto der Kachel zu. */}
      <Dialog open={pickerOffen} onOpenChange={setPickerOffen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="font-sans text-2xl font-bold tracking-tight">
            {t("fotoAusWeiteren")}
          </DialogTitle>
          <div className="mt-6 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {fotos.map((f) => (
              <DialogClose asChild key={f.id}>
                <button
                  type="button"
                  onClick={() => onFotoGewaehlt(aktiv.id, f.url)}
                  className="aspect-square overflow-hidden rounded-xl bg-muted outline-none ring-foreground/20 transition hover:ring-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="size-full object-cover" />
                </button>
              </DialogClose>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
