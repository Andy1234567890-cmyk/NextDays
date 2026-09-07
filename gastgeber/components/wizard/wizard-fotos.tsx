"use client";

// Foto-Schritt des Wizards (Airbnb „Photo tour"): je RAUM eine Kachel, jede
// verlangt mindestens ein Foto. Zuvor stand hier eine Attrappe („Foto-Upload
// wird angebunden") mit einem Zaehler, der nie hochzaehlte.
//
// ECHTER Upload, kein Zwischenspeicher: der Entwurf existiert ab Schritt 1 in
// der DB, deshalb geht jedes Bild sofort ueber denselben BFF-Weg wie im Editor
// (lib/property-photos.ts → /api/objekte/[id]/fotos). Bricht der Gastgeber ab,
// sind die Fotos trotzdem gesichert.
//
// Die Raum-Zuordnung ist dieselbe wie im Objekt-Editor: type_attributes
// .roomPhotos[raumId] haelt die URL des Raum-Titelbilds. Kein zweites Schema.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deletePhoto,
  listPhotos,
  uploadPhoto,
  type PropertyPhoto,
} from "@/lib/property-photos";

export type WizardRaum = {
  id: string;
  titel: string;
  // Sammelkachel: nimmt mehrere Bilder auf (bis MAX_WEITERE), nicht nur eines.
  // Einzelraeume zeigen genau ein Titelbild, „Weitere Fotos" eine Galerie.
  mehrere?: boolean;
};

/** Obergrenze der Sammelkachel „Weitere Fotos". Jeder unbegrenzte Bereich
 *  bekommt eine harte Grenze (Wurzel 8) — sonst laedt jemand 300 Bilder hoch. */
export const MAX_WEITERE = 10;

/** Raumliste aus den ANGABEN des Objekts: jedes Schlafzimmer, jedes Bad und der
 *  Aussenbereich bekommen eine eigene Kachel — wer ein Zimmer dazunimmt, sieht
 *  sofort eine weitere offene Kachel. Die Ableitung sitzt HIER und nicht an der
 *  Anzeigestelle, damit Wizard und Editor dieselbe Liste erzeugen.
 *
 *  Geteilte Baeder zaehlen mit: ein Gast, der sich ein Bad teilt, will genau das
 *  vorher sehen. */
export function wizardRaeume(
  anzahlSchlafzimmer: number,
  anzahlBaederPrivat: number,
  anzahlBaederGeteilt: number,
  t: (k: string) => string,
): WizardRaum[] {
  const schlaf = Math.max(1, anzahlSchlafzimmer);
  const baeder = Math.max(0, anzahlBaederPrivat) + Math.max(0, anzahlBaederGeteilt);
  return [
    { id: "titelbild", titel: t("fotos.raumTitelbild") },
    ...Array.from({ length: schlaf }, (_, i) => ({
      id: `sz-${i}`,
      titel:
        schlaf > 1 ? `${t("fotos.raumSchlafzimmer")} ${i + 1}` : t("fotos.raumSchlafzimmer"),
    })),
    ...Array.from({ length: baeder }, (_, i) => ({
      id: `bad-${i}`,
      titel: baeder > 1 ? `${t("fotos.raumBad")} ${i + 1}` : t("fotos.raumBad"),
    })),
    { id: "aussen", titel: t("fotos.raumAussen") },
    { id: "weitere", titel: t("fotos.raumWeitere"), mehrere: true },
  ];
}

export function WizardFotos({
  propertyId,
  raeume,
  zuordnung,
  onZuordnung,
  zuordnungMehrere,
  onMehrere,
  onMehrereEntfernen,
  onAnzahl,
}: {
  propertyId: string | null;
  raeume: WizardRaum[];
  // raumId → URL des zuletzt hochgeladenen Fotos dieses Raums.
  zuordnung: Record<string, string>;
  onZuordnung: (raumId: string, url: string | null) => void;
  // Sammelkachel: raumId → alle URLs dieses Raums.
  zuordnungMehrere: Record<string, string[]>;
  onMehrere: (raumId: string, urls: string[]) => void;
  onMehrereEntfernen: (raumId: string, url: string) => void;
  // Meldet die ECHTE Gesamtzahl nach oben (steuert „Weiter").
  onAnzahl: (n: number) => void;
}) {
  const t = useTranslations("wizard");
  const [fotos, setFotos] = useState<PropertyPhoto[]>([]);
  const [laedt, setLaedt] = useState<string | null>(null);
  const eingaben = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!propertyId) return;
    let aktiv = true;
    listPhotos(propertyId)
      .then((f) => {
        if (!aktiv) return;
        setFotos(f);
        onAnzahl(f.length);
      })
      // Kein stiller Fallback auf eine leere Liste (Wurzel 5): ein Ladefehler
      // wuerde sonst wie „noch keine Fotos" aussehen und den Gastgeber alles
      // erneut hochladen lassen.
      .catch((e: unknown) => toast.error(String(e)));
    return () => {
      aktiv = false;
    };
    // onAnzahl ist beim Elternteil stabil; sonst laedt es bei jedem Tastendruck neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function waehle(raumId: string, dateien: FileList | null) {
    if (!dateien?.length || !propertyId) return;
    const raum = raeume.find((r) => r.id === raumId);
    let auswahl = Array.from(dateien);

    if (raum?.mehrere) {
      // Harte Obergrenze, bevor irgendetwas hochgeladen wird: der Rest wird
      // nicht still verschluckt, sondern benannt (Wurzel 5).
      const frei = MAX_WEITERE - (zuordnungMehrere[raumId]?.length ?? 0);
      if (frei <= 0) {
        toast.error(t("fotos.maxErreicht", { max: MAX_WEITERE }));
        return;
      }
      if (auswahl.length > frei) {
        toast.error(t("fotos.maxGekuerzt", { max: MAX_WEITERE, n: frei }));
        auswahl = auswahl.slice(0, frei);
      }
    } else if (auswahl.length > 1) {
      // Einzelraum: nur das erste Bild, sonst laegen die uebrigen als
      // unzugeordnete Galerie-Fotos herum.
      auswahl = auswahl.slice(0, 1);
    }

    setLaedt(raumId);
    try {
      const neue: PropertyPhoto[] = [];
      for (const datei of auswahl) {
        neue.push(await uploadPhoto(propertyId, datei));
      }
      const frisch = await listPhotos(propertyId);
      setFotos(frisch);
      onAnzahl(frisch.length);
      if (raum?.mehrere) onMehrere(raumId, neue.map((f) => f.url));
      else if (neue.length) onZuordnung(raumId, neue[0].url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLaedt(null);
      const feld = eingaben.current[raumId];
      // Zuruecksetzen, sonst loest dieselbe Datei kein change-Ereignis mehr aus.
      if (feld) feld.value = "";
    }
  }

  async function entferne(raumId: string, url?: string) {
    const ziel = url ?? zuordnung[raumId];
    const foto = fotos.find((f) => f.url === ziel);
    if (!foto || !propertyId) return;
    try {
      await deletePhoto(propertyId, foto.id);
      const frisch = await listPhotos(propertyId);
      setFotos(frisch);
      onAnzahl(frisch.length);
      if (url) onMehrereEntfernen(raumId, url);
      else onZuordnung(raumId, null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      {raeume.map((r) => {
        const galerie = r.mehrere ? (zuordnungMehrere[r.id] ?? []) : [];
        const bild = r.mehrere ? (galerie[0] ?? null) : (zuordnung[r.id] ?? null);
        const belegt = r.mehrere ? galerie.length > 0 : !!bild;
        const beschaeftigt = laedt === r.id;
        return (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-2xl border border-border p-3"
          >
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              {bild ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bild} alt={r.titel} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Icon
                    icon="solar:gallery-add-bold-duotone"
                    className="size-7 text-muted-foreground"
                  />
                </div>
              )}
              {beschaeftigt && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Icon icon="ph:spinner" className="size-6 animate-spin" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.titel}</p>
              <p className="text-sm text-muted-foreground">
                {r.mehrere
                  ? t("fotos.mehrereAnzahl", {
                      n: galerie.length,
                      max: MAX_WEITERE,
                    })
                  : belegt
                    ? t("fotos.raumFertig")
                    : t("fotos.raumOffen")}
              </p>
              {galerie.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {galerie.slice(1).map((u) => (
                    <span key={u} className="relative size-10 overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => void entferne(r.id, u)}
                        aria-label={t("fotos.entfernen")}
                        className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors hover:bg-background/70"
                      >
                        <Icon icon="ph:trash" className="size-3.5 opacity-0 hover:opacity-100" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={(el) => {
                eingaben.current[r.id] = el;
              }}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void waehle(r.id, e.target.files)}
            />
            <div className="flex shrink-0 gap-2">
              {belegt && !r.mehrere && (
                <button
                  type="button"
                  onClick={() => void entferne(r.id)}
                  aria-label={t("fotos.entfernen")}
                  className="flex size-9 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              )}
              <button
                type="button"
                disabled={
                  !propertyId ||
                  beschaeftigt ||
                  (r.mehrere && galerie.length >= MAX_WEITERE)
                }
                onClick={() => eingaben.current[r.id]?.click()}
                className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-foreground disabled:opacity-50"
              >
                {r.mehrere
                  ? t("fotos.hinzufuegen")
                  : belegt
                    ? t("fotos.ersetzen")
                    : t("fotos.hinzufuegen")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
