"use client";

// Objekt-Editor im Airbnb-„Listing editor"-Look, aber mit myNextDays-Farben.
// Zweispaltig: links die Abschnitts-Karten (Vorschauwert je Abschnitt), rechts
// der Detailbereich des gewählten Abschnitts. Typografie im Airbnb-Stil (große,
// fette Sans-Überschriften). Nur echte Property-Daten — fehlende Angaben werden
// ehrlich als „Hinzufügen" gezeigt (kein Fake, Wurzel 4).
import { Icon } from "@iconify/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatCurrency } from "@nextdays/currency";

import type { PreisStand } from "@/lib/preise";
import {
  setBasePrice,
  setLengthDiscount,
  updateSmartPricing,
} from "@/lib/preise-actions";
import type { Property } from "@/lib/properties";
import { updateProperty } from "@/lib/properties-actions";
import { listPhotos, type PropertyPhoto } from "@/lib/property-photos";
import { getTaxonomy } from "@/lib/taxonomie";
import { useRealtime } from "@/lib/use-realtime";

import { ObjektPublish } from "@/components/objekt-publish";

import { AmenityPanel } from "./amenity-panel";
import { AttributPanel } from "./attribut-panel";
import { BarrierefreiheitPanel } from "./barrierefreiheit-panel";
import { KACHEL_SPRING } from "./foto-kacheln";
import { FotoTour } from "./foto-tour";
import { LagePanel } from "./lage-panel";
import { DiscountPanel, PreisPanel } from "./preis-panel";
import { PrivacyPanel } from "./privacy-panel";
import { type RaumKachel, RaumDetail } from "./raum-detail";
import { SchlafPanel } from "./schlaf-panel";
import { SchlafmoeglichkeitenPanel } from "./schlaf-uebersicht";
import { TextPanel } from "./text-panel";
import { TypPanel } from "./typ-panel";
import { WertPanel } from "./wert-panel";

type SectionKey =
  | "fotos" | "titel" | "typ" | "schlafen" | "beschreibung" | "ausstattung"
  | "gaeste" | "lage" | "preise" | "rabatte" | "verfuegbarkeit"
  | "hausregeln" | "storno";

export function ObjektEditor({
  property,
  preisStand,
}: {
  property: Property;
  preisStand: PreisStand;
}) {
  const t = useTranslations("objektEditor");
  const [prop, setProp] = useState<Property>(property);
  // Preis-Stand aus den echten Quellen (rate_plans/dp_settings/property_discounts).
  // Realtime unten hält ihn aktuell; Actions spiegeln optimistisch nach.
  const [preise, setPreise] = useState<PreisStand>(preisStand);
  // Immobilientyp-Label für die „Objekttyp"-Vorschau (Taxonomie).
  const [typLabel, setTypLabel] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<SectionKey>("fotos");
  // Offenes Zimmer (Foto-Tour-Detail). null = normale Editor-Ansicht. Der Wechsel
  // slidet die GANZE Ansicht (wie Airbnb), nicht nur die rechte Spalte.
  const [offenerRaum, setOffenerRaum] = useState<string | null>(null);
  // Offenes Unterthema der Zimmer-Detailansicht (z. B. „schlafen"). Öffnet rechts
  // eine zusätzliche Sidebar (Airbnb-Muster) — die Detailansicht bleibt sichtbar.
  const [raumThema, setRaumThema] = useState<string | null>(null);
  // Zimmer, dessen Bett-Sidebar aus dem „Schlafmöglichkeiten"-Tab offen ist. Öffnet
  // NUR die rechte Bett-Sidebar (nicht die Fototour-Detailansicht mit Cover-Foto,
  // die hat im Schlaf-Kontext nichts verloren). null = zu.
  const [schlafRaum, setSchlafRaum] = useState<string | null>(null);
  // Galerie-Fotos (id + url) für „Weitere Fotos"/Picker. properties.photos ist nur
  // der URL-Spiegel; zum Löschen braucht es die Foto-ID → volle Liste laden.
  const [fotos, setFotos] = useState<PropertyPhoto[]>([]);
  const reduziert = useReducedMotion();

  // Fotoliste einmalig laden (und bei ID-Wechsel). Realtime unten hält sie aktuell.
  useEffect(() => {
    let aktiv = true;
    listPhotos(prop.id)
      .then((liste) => {
        if (aktiv) setFotos(liste);
      })
      .catch(() => {
        /* Galerie leer/Fehler → Grid zeigt nur die Upload-Kachel (kein Crash). */
      });
    return () => {
      aktiv = false;
    };
  }, [prop.id]);

  // Immobilientyp-Label für die „Objekttyp"-Vorschau (Taxonomie).
  useEffect(() => {
    if (!prop.subtype_slug) {
      setTypLabel(null);
      return;
    }
    let aktiv = true;
    getTaxonomy()
      .then((tax) => {
        if (!aktiv) return;
        setTypLabel(
          tax.subtypes.find((s) => s.slug === prop.subtype_slug)?.label_de ?? null,
        );
      })
      .catch(() => {
        /* Katalog-Fehler → Vorschau zeigt „Hinzufügen" (kein Crash). */
      });
    return () => {
      aktiv = false;
    };
  }, [prop.subtype_slug]);

  // Realtime: Änderungen am Objekt (auch aus anderen Tabs) spiegeln.
  useRealtime<Property>({
    table: "properties",
    filter: `id=eq.${prop.id}`,
    onEvent: (evt) => {
      if (evt.new) setProp((p) => ({ ...p, ...evt.new }));
    },
  });

  // Realtime: Galerie-Fotos (property_photos) inkrementell pflegen — nach eigenen
  // Aktionen KEIN Reload, nur die Events (Doppelbalken vermeiden).
  useRealtime<PropertyPhoto>({
    table: "property_photos",
    filter: `property_id=eq.${prop.id}`,
    onEvent: (evt) => {
      const neu = evt.new as PropertyPhoto;
      const alt = evt.old as Partial<PropertyPhoto>;
      if (evt.eventType === "INSERT" && neu?.id) {
        setFotos((f) => (f.some((x) => x.id === neu.id) ? f : [...f, neu]));
      } else if (evt.eventType === "DELETE" && alt.id) {
        setFotos((f) => f.filter((x) => x.id !== alt.id));
      } else if (evt.eventType === "UPDATE" && neu?.id) {
        setFotos((f) => f.map((x) => (x.id === neu.id ? neu : x)));
      }
    },
  });

  async function speichere(fields: Partial<Property>) {
    const res = await updateProperty(prop.id, fields);
    if (res.ok) setProp((p) => ({ ...p, ...res.data }));
    return res.ok;
  }

  // Bett-Zähler eines Zimmers speichern. Der PATCH überschreibt das GANZE
  // type_attributes-jsonb (kein Server-Merge) → wir senden den kompletten
  // aktuellen Stand mit dem geänderten sleeping-Zweig, sonst gingen pricing/
  // availability/… verloren (Wurzel 1: Gegenzustand mitpflegen). 0-Werte werden
  // im Panel schon rausgefiltert; ein leeres Zimmer wird ganz entfernt.
  async function speichereSchlaf(raumId: string, werte: Record<string, number>) {
    const bisher = prop.type_attributes ?? {};
    const sleeping = { ...(bisher.sleeping ?? {}) };
    if (Object.keys(werte).length === 0) delete sleeping[raumId];
    else sleeping[raumId] = werte;
    return speichere({ type_attributes: { ...bisher, sleeping } });
  }

  // Privatsphäre (Türschloss) eines Zimmers speichern — gleiche Merge-Regel wie
  // oben (komplettes type_attributes mit geändertem privacy-Zweig, Wurzel 1).
  async function speicherePrivacy(
    raumId: string,
    wert: { hasLock: boolean; lockType: "inside_only" | "inside_outside" | null },
  ) {
    const bisher = prop.type_attributes ?? {};
    const privacy = { ...(bisher.privacy ?? {}), [raumId]: wert };
    return speichere({ type_attributes: { ...bisher, privacy } });
  }

  // --- Preise: an die ECHTE Preis-Wahrheit schreiben, nicht in den Blob --------
  // Diese Tabellen (rate_plans/dp_settings/property_discounts) sind für den
  // anon-Key gesperrt (Wurzel 6) → KEIN Realtime möglich; stattdessen nach jeder
  // erfolgreichen Action den lokalen preise-State optimistisch nachziehen.

  // Grundpreis → rate_plans.base_price. Braucht die Objektwährung (kein €-Default,
  // Wurzel 4): fehlt sie, klar fehlschlagen statt einen falschen Preis zu setzen.
  async function speichereGrundpreis(basePrice: number) {
    const waehrung = preise.currency ?? prop.currency;
    if (!waehrung) return false; // Datenfehler: Objektwährung fehlt → nicht raten.
    const res = await setBasePrice(prop.id, basePrice, waehrung);
    if (res.ok) {
      setPreise((p) => ({ ...p, basePrice, currency: waehrung }));
    }
    return res.ok;
  }

  // Smart Pricing / Wochenend-Uplift → dp_settings (PATCH-Semantik).
  async function speichereSmart(
    fields: Partial<
      Pick<PreisStand["smart"], "enabled" | "min_price" | "max_price" | "weekend_uplift_pct">
    >,
  ) {
    const res = await updateSmartPricing(prop.id, fields);
    if (res.ok) setPreise((p) => ({ ...p, smart: res.data }));
    return res.ok;
  }

  // Längen-Rabatt (Woche=7 / Monat=28 Nächte) → property_discounts. pct=undefined
  // löscht die Regel (Wurzel 1: Gegenzustand). Nach Erfolg lokal spiegeln.
  async function speichereLosRabatt(minNights: 7 | 28, pct: number | undefined) {
    const bestehend =
      minNights === 7 ? preise.weeklyDiscount : preise.monthlyDiscount;
    const res = await setLengthDiscount(prop.id, minNights, pct, bestehend);
    if (res.ok) {
      setPreise((p) => ({
        ...p,
        ...(minNights === 7
          ? { weeklyDiscount: res.data }
          : { monthlyDiscount: res.data }),
      }));
    }
    return res.ok;
  }

  // Ausstattung speichern — objektweites Feld properties.amenities (string[] der
  // Channex-Slugs), NICHT type_attributes. Das Backend setzt facilities immer neu
  // (auch []), also ist die volle Liste die Wahrheit.
  async function speichereAmenities(neu: string[]) {
    return speichere({ amenities: neu });
  }

  // Ein hochgeladenes/ausgewähltes Foto einer Foto-Tour-Kachel (Zimmer) zuordnen.
  // Die Objekt-Galerie (properties.photos) bleibt die Foto-Wahrheit; die Kachel-
  // Zuordnung ist reine Editor-Darstellung → type_attributes.roomPhotos[raumId].
  // Leere url = Zuordnung ENTFERNEN (Eintrag löschen, Wurzel 1: Gegenzustand).
  async function speichereRaumFoto(raumId: string, url: string) {
    const bisher = prop.type_attributes ?? {};
    const roomPhotos = { ...(bisher.roomPhotos ?? {}) };
    if (url) roomPhotos[raumId] = url;
    else delete roomPhotos[raumId];
    const neu = { ...bisher, roomPhotos };
    // Sofort spiegeln, damit die Zimmer-Kachel das neue Foto ohne Warten auf den
    // Server-Round-Trip zeigt; speichere() bestätigt denselben Stand serverseitig.
    setProp((p) => ({ ...p, type_attributes: neu }));
    return speichere({ type_attributes: neu });
  }


  // Barrierefreiheits-Merkmal setzen. Speichert type_attributes.accessibility[key]
  // UND spiegelt — falls das Merkmal ein Channex-Gegenstück (facility) hat — den
  // Slug in properties.amenities, damit es an die OTAs synct. Wurzel 1: den
  // Gegenzustand mitpflegen (has=false → Facility auch wieder entfernen).
  async function speichereBarriere(
    key: string,
    has: boolean,
    facility: string | null,
  ) {
    const bisher = prop.type_attributes ?? {};
    const accessibility = { ...(bisher.accessibility ?? {}), [key]: { has } };
    const fields: Partial<Property> = {
      type_attributes: { ...bisher, accessibility },
    };
    if (facility) {
      const set = new Set(prop.amenities);
      if (has) set.add(facility);
      else set.delete(facility);
      fields.amenities = [...set];
    }
    return speichere(fields);
  }

  const ort = [prop.city, prop.country].filter(Boolean).join(", ");

  // Detailwerte aus type_attributes (Wizard-Daten).
  const attr = prop.type_attributes ?? {};
  // Preis-Werte aus den ECHTEN Quellen (preise), nicht aus dem Blob.
  const basePrice = preise.basePrice ?? undefined;
  const priceCurrency = preise.currency ?? prop.currency ?? null;
  const baeder = (attr.bathrooms_private ?? 0) + (attr.bathrooms_shared ?? 0);
  const schlafVorschau = [
    attr.bedrooms != null ? `${attr.bedrooms} ${t("schlafzimmer")}` : null,
    attr.beds != null ? `${attr.beds} ${t("betten")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Betten-Info für die Foto-Karte (Airbnb: „1 Schlafzimmer · 1 Bett · 0 Bäder").
  const fotoKartenInfo = [
    attr.bedrooms != null ? `${attr.bedrooms} ${t("schlafzimmer")}` : null,
    attr.beds != null ? `${attr.beds} ${t("betten")}` : null,
    `${baeder} ${t("baeder")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Räume für die Foto-Tour: je Schlafzimmer eine Kachel + „Weitere Fotos".
  // Kachelbild aus type_attributes.roomPhotos (zugeordnetes Foto). WICHTIG: nur
  // gültige Zuordnungen zeigen — eine roomPhotos-URL kann verwaisen (Foto später
  // gelöscht/ersetzt), dann steht sie NICHT mehr in der echten Galerie (fotos).
  // Solche toten URLs werden verworfen (Wurzel 4: kein Ersatzwert/Zombie-Foto).
  const anzahlSchlafzimmer = Math.max(1, attr.bedrooms ?? 1);
  const roomPhotos = attr.roomPhotos ?? {};
  const gueltigeUrls = new Set(fotos.map((f) => f.url));
  // EIN Zimmerfoto je Zimmer (roomPhotos), geteilt zwischen Fototour und
  // Schlafmöglichkeiten (Airbnb: ein Foto pro Zimmer, keine zwei Quellen). Gegen
  // die echte Galerie validiert — verwaiste URL (Foto gelöscht) → null (Wurzel 4).
  const raumBild = (id: string): string | null => {
    const url = roomPhotos[id];
    return url && gueltigeUrls.has(url) ? url : null;
  };
  // Titelbild-Kachel (Airbnb: erste Kachel = Cover des Inserats). Bild aus dem
  // als Cover markierten Galerie-Foto (is_cover), sonst dem ersten Foto.
  const coverFoto = fotos.find((f) => f.is_cover) ?? fotos[0];
  const raeume: RaumKachel[] = [
    {
      id: "titelbild",
      titel: t("fotosTitelbild"),
      bild: raumBild("titelbild") ?? coverFoto?.url ?? null,
    },
    ...Array.from({ length: anzahlSchlafzimmer }, (_, i) => ({
      id: `sz-${i}`,
      titel:
        anzahlSchlafzimmer > 1 ? `${t("fotosZimmer")} ${i + 1}` : t("fotosZimmer"),
      bild: raumBild(`sz-${i}`),
    })),
    {
      id: "weitere",
      // „Weitere Fotos"-Cover: erste echte Galerie-URL (fotos), kein alter
      // properties.photos-Spiegel, der verwaisen kann.
      titel: t("fotosWeitere"),
      bild: raumBild("weitere") ?? fotos[0]?.url ?? null,
    },
  ];
  // Preis-Vorschau als Range (Grundpreis – Wochenendpreis), wie Airbnb
  // („€59 - €60 per night"). Wochenend-Uplift kommt aus dp_settings.
  const weekendPct = preise.smart.weekend_uplift_pct ?? 0;
  const preisVorschau = (() => {
    if (basePrice == null || basePrice <= 0) return t("hinzufuegen");
    const von = formatCurrency(basePrice, priceCurrency, "de-DE", 0);
    if (weekendPct <= 0) return `${von} / ${t("proNacht")}`;
    const bis = formatCurrency(
      Math.round(basePrice * (1 + weekendPct / 100)),
      priceCurrency,
      "de-DE",
      0,
    );
    return `${von} – ${bis} / ${t("proNacht")}`;
  })();
  // Rabatt-Vorschau (Wochen-/Monatsrabatt) aus property_discounts (bps → %).
  const rabattVorschau = [
    preise.weeklyDiscount
      ? t("preisWochenrabattKurz", { pct: preise.weeklyDiscount.discount_bps / 100 })
      : null,
    preise.monthlyDiscount
      ? t("preisMonatsrabattKurz", { pct: preise.monthlyDiscount.discount_bps / 100 })
      : null,
  ].filter(Boolean);
  const verfVorschau =
    attr.availability?.minStay != null
      ? t("naechteEinheit", { n: attr.availability.minStay }) + "+"
      : t("hinzufuegen");

  // Abschnitts-Karten links — jede mit Vorschauwert (oder „Hinzufügen").
  const sections: {
    key: SectionKey;
    titel: string;
    vorschau: string;
    fehlt?: boolean;
  }[] = [
    { key: "fotos", titel: t("secFotos"),
      vorschau: fotoKartenInfo || t("fotosAnzahl", { n: fotos.length }) },
    { key: "titel", titel: t("secTitel"), vorschau: prop.title || t("hinzufuegen"), fehlt: !prop.title },
    { key: "typ", titel: t("secTyp"),
      vorschau: typLabel ?? t("hinzufuegen"),
      fehlt: !prop.subtype_slug },
    { key: "schlafen", titel: t("secSchlafen"),
      vorschau: schlafVorschau || t("hinzufuegen"), fehlt: !schlafVorschau },
    { key: "beschreibung", titel: t("secBeschreibung"),
      vorschau: prop.description || t("hinzufuegen"), fehlt: !prop.description },
    { key: "ausstattung", titel: t("secAusstattung"),
      vorschau: prop.amenities.length ? `${prop.amenities.length}` : t("hinzufuegen"),
      fehlt: prop.amenities.length === 0 },
    { key: "gaeste", titel: t("secGaeste"), vorschau: t("gaesteWert", { n: prop.max_guests }) },
    { key: "lage", titel: t("secLage"), vorschau: ort || t("hinzufuegen"), fehlt: !ort },
    { key: "preise", titel: t("secPreise"), vorschau: preisVorschau,
      fehlt: !(basePrice != null && basePrice > 0) },
    { key: "rabatte", titel: t("secRabatte"),
      vorschau: rabattVorschau.length ? rabattVorschau.join("\n") : t("hinzufuegen"),
      fehlt: rabattVorschau.length === 0 },
    { key: "verfuegbarkeit", titel: t("secVerfuegbarkeit"), vorschau: verfVorschau,
      fehlt: attr.availability?.minStay == null },
    { key: "hausregeln", titel: t("secHausregeln"), vorschau: t("hinzufuegen"), fehlt: true },
    { key: "storno", titel: t("secStorno"), vorschau: t("hinzufuegen"), fehlt: true },
  ];

  const raumOffen = offenerRaum != null;
  // Aktives Zimmer der Detailansicht (Fallback erstes Zimmer) für die Sidebar.
  const aktiveRaumId = offenerRaum ?? raeume[0].id;
  const aktivesRaumTitel =
    (raeume.find((r) => r.id === aktiveRaumId) ?? raeume[0]).titel;

  return (
    // Eine gemeinsame LayoutGroup: die Foto-Kacheln existieren im Übersichts-
    // Grid (FotoTour) UND als Thumbnails im Zimmer-Detail (RaumDetail) mit
    // DERSELBEN layoutId. Beim Umschalten zieht Framer Motion die GLEICHE Kachel
    // weich mit Feder-Trägheit von der Grid- zur Thumbnail-Position — physisches
    // „mit dem Finger verschieben", kein Umblättern zweier Panels. Der restliche
    // Inhalt (linke Spalte, Detailtexte) blendet sanft. Reduced-Motion: sofort.
    <LayoutGroup>
      <div className="relative min-h-[calc(100vh-5rem)]">
        <AnimatePresence mode="popLayout" initial={false}>
          {!raumOffen ? (
            <motion.div
              key="editor"
              className="relative grid min-h-[calc(100vh-5rem)] grid-cols-1 lg:grid-cols-[26rem_1fr]"
              // Der Editor kehrt aus der Detailansicht zurück: er kommt von LINKS
              // (aus Zieh-Richtung) mit derselben Feder herein wie die Kacheln, die
              // vom Thumbnail zurück ins Grid wandern — eine einzige Bewegung.
              initial={reduziert ? false : { opacity: 0, x: "-4%" }}
              animate={{ opacity: 1, x: "0%" }}
              exit={reduziert ? { opacity: 0 } : { opacity: 0, x: "-4%" }}
              transition={reduziert ? { duration: 0 } : KACHEL_SPRING}
            >
      {/* Linke Spalte — feste Viewport-Höhe, damit die Abschnittsliste INTERN
          scrollt (overflow-y-auto unten greift nur mit begrenzter Höhe) statt die
          ganze Seite zu verlängern. */}
      <div className="flex h-[calc(100vh-5rem)] flex-col border-r border-border">
        <div className="flex items-center gap-3 px-6 pt-7">
          <Link
            href="/objekte"
            aria-label="Zurück"
            className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
          >
            <Icon icon="ph:arrow-left" className="size-4" />
          </Link>
          <h1 className="font-sans text-[1.6rem] font-bold tracking-tight">
            {t("titel")}
          </h1>
        </div>

        {/* Tabs „Dein Objekt / Anreise-Guide" + Zahnrad (Airbnb-Muster) */}
        <div className="flex items-center gap-2 px-6 pt-5">
          <div className="flex flex-1 rounded-full bg-muted p-1">
            <button
              type="button"
              className="flex-1 rounded-full bg-background py-2 text-sm font-semibold shadow-sm"
            >
              {t("tabRaum")}
            </button>
            <button
              type="button"
              className="flex-1 rounded-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("tabAnreise")}
            </button>
          </div>
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <Icon icon="ph:gear-six" className="size-[1.15rem]" />
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6">
          {sections.map((s) => {
            const isAktiv = aktiv === s.key;
            const zeigtFoto = s.key === "fotos" && fotos[0];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setAktiv(s.key)}
                className={`block w-full rounded-2xl p-5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                  isAktiv
                    ? "border-2 border-foreground"
                    : "border border-border hover:shadow-md"
                }`}
              >
                <p className="font-semibold">{s.titel}</p>
                {/* Vorschau: mehrzeilig, falls der Wert \n enthält (z. B. Rabatte:
                    „7% Wochenrabatt / 15% Monatsrabatt"), sonst einzeilig gekürzt. */}
                {s.vorschau.includes("\n") ? (
                  <div className="mt-1 space-y-0.5">
                    {s.vorschau.split("\n").map((zeile) => (
                      <p key={zeile} className="truncate text-sm text-muted-foreground">
                        {zeile}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {s.vorschau}
                  </p>
                )}
                {/* Aktive Fotos-Karte: gefächertes Foto-Ensemble (Airbnb-Muster) —
                    das vordere Foto mittig, weitere leicht versetzt dahinter, plus
                    „N Fotos"-Badge. */}
                {zeigtFoto && isAktiv && (
                  <span className="relative mt-4 flex aspect-[16/10] items-center justify-center">
                    {/* Gefächertes 3-Foto-Ensemble (Airbnb): eins links, eins rechts
                        gefächert hinter dem vorderen Foto. Aus der echten Galerie. */}
                    {fotos[1] && (
                      <span className="absolute h-[82%] w-[54%] -translate-x-12 -rotate-6 overflow-hidden rounded-xl bg-muted shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotos[1].url} alt="" className="size-full object-cover" />
                      </span>
                    )}
                    {fotos[2] && (
                      <span className="absolute h-[82%] w-[54%] translate-x-12 rotate-6 overflow-hidden rounded-xl bg-muted shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotos[2].url} alt="" className="size-full object-cover" />
                      </span>
                    )}
                    {/* Vorderes Foto */}
                    <span className="relative z-10 h-[92%] w-[58%] overflow-hidden rounded-xl bg-muted shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fotos[0].url}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </span>
                    {/* „N Fotos"-Badge */}
                    <span className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-background px-3 py-1 text-xs font-semibold shadow-md">
                      {t("fotosAnzahl", { n: fotos.length })}
                    </span>
                  </span>
                )}
                {/* Task-Hinweis in der aktiven Foto-Karte (wenn nicht aktiv/live) */}
                {s.key === "fotos" && isAktiv && prop.status !== "active" && (
                  <span className="mt-4 flex items-center gap-2 text-sm text-foreground">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {t("karteAufgabe")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Schwebender „Ansehen"-Button (Airbnb-Muster) */}
        <div className="pointer-events-none sticky bottom-0 flex justify-center pb-6">
          <span className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg">
            <Icon icon="ph:eye" className="size-4" />
            {t("ansehen")}
          </span>
        </div>
      </div>

      {/* Rechte Spalte — aktiver Abschnitt. flex-col + feste Höhe, damit Panels
          mit h-full (z. B. der zentrierte Titel-Editor) den Raum ausfüllen. */}
      <div className="flex h-[calc(100vh-5rem)] flex-col overflow-y-auto px-8 py-8 lg:px-14 lg:py-12">
        <div className="mb-8 flex shrink-0 justify-end">
          <ObjektPublish id={prop.id} status={prop.status} />
        </div>
        {(aktiv === "titel" || aktiv === "beschreibung") ? (
          <div className="min-h-0 flex-1">
            <TextPanel
              titel={aktiv === "titel" ? t("secTitel") : t("secBeschreibung")}
              wert={aktiv === "titel" ? prop.title : prop.description ?? ""}
              platzhalter={
                aktiv === "titel" ? t("titelPlatzhalter") : t("beschreibungPlatzhalter")
              }
              mehrzeilig={aktiv === "beschreibung"}
              maxLen={aktiv === "titel" ? 50 : 500}
              onSave={(v) =>
                speichere(aktiv === "titel" ? { title: v } : { description: v })
              }
            />
          </div>
        ) : (
        <>
        {aktiv === "fotos" && (
          <FotoTour
            property={prop}
            raeume={raeume}
            fotoAnzahl={fotos.length}
            onOeffneRaum={setOffenerRaum}
          />
        )}
        {aktiv === "typ" && (
          <TypPanel property={prop} onSpeichere={speichere} />
        )}
        {aktiv === "gaeste" && (
          <WertPanel titel={t("secGaeste")} wert={t("gaesteWert", { n: prop.max_guests })} />
        )}
        {aktiv === "ausstattung" && (
          <WertPanel
            titel={t("secAusstattung")}
            wert={prop.amenities.length ? prop.amenities.join(", ") : t("noch")}
          />
        )}
        {aktiv === "lage" && <LagePanel property={prop} onSpeichere={speichere} />}
        {aktiv === "schlafen" && (
          <SchlafmoeglichkeitenPanel
            raeume={raeume
              .filter((r) => r.id !== "weitere" && r.id !== "titelbild")
              .map((r) => ({ id: r.id, titel: r.titel }))}
            sleeping={attr.sleeping ?? {}}
            onOeffne={(raumId) => {
              // Nur die Bett-Sidebar öffnen (NICHT die Fototour-Detailansicht mit
              // Cover-Foto) — Airbnb zeigt links die Übersicht, rechts die Sidebar.
              setSchlafRaum(raumId);
            }}
          />
        )}
        {aktiv === "preise" && (
          <PreisPanel
            preise={preise}
            currency={priceCurrency}
            propertyId={prop.id}
            koords={
              prop.lat != null && prop.lng != null
                ? { lat: prop.lat, lng: prop.lng }
                : null
            }
            guests={prop.max_guests}
            onGrundpreis={speichereGrundpreis}
            onSmart={speichereSmart}
          />
        )}
        {aktiv === "rabatte" && (
          <DiscountPanel preise={preise} onRabatt={speichereLosRabatt} />
        )}
        {aktiv === "verfuegbarkeit" && (
          <AttributPanel
            titel={t("secVerfuegbarkeit")}
            rows={[
              { label: t("minNaechte"),
                wert: attr.availability?.minStay != null
                  ? t("naechteEinheit", { n: attr.availability.minStay }) : null },
              { label: t("maxNaechte"),
                wert: attr.availability?.maxStay != null
                  ? t("naechteEinheit", { n: attr.availability.maxStay }) : null },
            ]}
          />
        )}
        {(aktiv === "hausregeln" || aktiv === "storno") && (
          <WertPanel
            titel={aktiv === "hausregeln" ? t("secHausregeln") : t("secStorno")}
            wert={t("noch")}
          />
        )}
        </>
        )}
          </div>

      {/* Bett-Sidebar aus dem „Schlafmöglichkeiten"-Tab: rechte Overlay-Spalte
          über der Editor-Ansicht (Airbnb — links Übersicht, rechts die Sidebar,
          KEIN Zimmer-Cover-Foto). */}
      <AnimatePresence>
        {schlafRaum != null && (
          <motion.aside
            key="schlaf-sidebar"
            className="absolute inset-y-0 right-0 z-20 w-[30rem] overflow-hidden border-l border-border bg-background shadow-xl"
            initial={reduziert ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduziert ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <SchlafPanel
              zimmerTitel={
                (raeume.find((r) => r.id === schlafRaum) ?? raeume[0]).titel
              }
              werte={attr.sleeping?.[schlafRaum] ?? {}}
              propertyId={prop.id}
              foto={raumBild(schlafRaum)}
              onSpeichere={(neu) => speichereSchlaf(schlafRaum, neu)}
              onFotoHochgeladen={(foto) => {
                setFotos((f) =>
                  f.some((x) => x.id === foto.id) ? f : [...f, foto],
                );
                setProp((p) =>
                  p.photos.includes(foto.url)
                    ? p
                    : { ...p, photos: [...p.photos, foto.url] },
                );
                // Dasselbe Zimmerfoto wie in der Fototour (eine Quelle: roomPhotos).
                void speichereRaumFoto(schlafRaum, foto.url);
              }}
              onZurueck={() => setSchlafRaum(null)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
            </motion.div>
          ) : (
            // Zimmer-Detail — dieselben Kacheln (per layoutId) wandern hierher.
            // Zweispaltig: links die Zimmer-Ansicht, rechts (bedingt) die Bett-
            // Sidebar (Airbnb-Muster) — die linke Ansicht bleibt sichtbar.
            <motion.div
              key="detail"
              // Feste Höhe (nicht min-h): so scrollen die inneren Spalten INTERN
              // (overflow-y-auto) statt die ganze Seite über den 301-Ausstattungs-
              // Katalog hinaus zu strecken.
              className="flex h-[calc(100vh-5rem)]"
              // Detail kommt von RECHTS herein (Zieh-Richtung nach links) mit
              // derselben Feder wie die wandernden Kacheln — synchron, kein
              // separater, schnellerer Fade davor.
              initial={reduziert ? false : { opacity: 0, x: "4%" }}
              animate={{ opacity: 1, x: "0%" }}
              exit={reduziert ? { opacity: 0 } : { opacity: 0, x: "4%" }}
              transition={reduziert ? { duration: 0 } : KACHEL_SPRING}
            >
              <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:px-14 lg:py-12">
                <RaumDetail
                  raeume={raeume}
                  aktivId={offenerRaum ?? raeume[0].id}
                  propertyId={prop.id}
                  fotos={fotos}
                  sleeping={attr.sleeping ?? {}}
                  privacy={attr.privacy ?? {}}
                  amenityAnzahl={prop.amenities.length}
                  barriereAnzahl={
                    Object.values(attr.accessibility ?? {}).filter((a) => a.has)
                      .length
                  }
                  aktivesThema={raumThema}
                  onWaehle={setOffenerRaum}
                  onZurueck={() => {
                    setRaumThema(null);
                    setOffenerRaum(null);
                  }}
                  onOeffneThema={setRaumThema}
                  onFotoHochgeladen={(foto) => {
                    setFotos((f) =>
                      f.some((x) => x.id === foto.id) ? f : [...f, foto],
                    );
                    setProp((p) =>
                      p.photos.includes(foto.url)
                        ? p
                        : { ...p, photos: [...p.photos, foto.url] },
                    );
                  }}
                  onFotoGewaehlt={speichereRaumFoto}
                  onFotoEntfernt={(fotoId, url) => {
                    setFotos((f) => f.filter((x) => x.id !== fotoId));
                    setProp((p) => ({
                      ...p,
                      photos: p.photos.filter((u) => u !== url),
                    }));
                  }}
                />
              </div>

              {/* Rechte Bett-Sidebar. Animiert wird die BREITE (0 → 30rem), nicht
                  nur ein x-Transform — sonst belegt die Sidebar weiter ihren
                  Flex-Platz bis sie aus dem DOM ist und der mittlere Container
                  springt verzögert zurück. Mit width-Animation schrumpft der
                  belegte Platz kontinuierlich, der Mittel-Container wächst synchron
                  mit. overflow-hidden hält den 30rem-Inhalt beim Schrumpfen fest. */}
              <AnimatePresence initial={false}>
                {raumThema != null && (
                  <motion.aside
                    key="raum-sidebar"
                    className="shrink-0 overflow-hidden border-l border-border"
                    initial={reduziert ? false : { width: 0, opacity: 0 }}
                    animate={{ width: "30rem", opacity: 1 }}
                    exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
                    // Weiche Feder ohne Überschwingen (damping = kritisch), damit
                    // die Breite nicht über 30rem hinaus zappelt.
                    transition={
                      reduziert
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 260, damping: 30 }
                    }
                  >
                    <div className="flex h-full w-[30rem] flex-col">
                      {raumThema === "schlafen" && (
                        <SchlafPanel
                          zimmerTitel={aktivesRaumTitel}
                          werte={attr.sleeping?.[aktiveRaumId] ?? {}}
                          propertyId={prop.id}
                          foto={raumBild(aktiveRaumId)}
                          onSpeichere={(neu) => speichereSchlaf(aktiveRaumId, neu)}
                          onFotoHochgeladen={(foto) => {
                            setFotos((f) =>
                              f.some((x) => x.id === foto.id) ? f : [...f, foto],
                            );
                            setProp((p) =>
                              p.photos.includes(foto.url)
                                ? p
                                : { ...p, photos: [...p.photos, foto.url] },
                            );
                            void speichereRaumFoto(aktiveRaumId, foto.url);
                          }}
                          onZurueck={() => setRaumThema(null)}
                        />
                      )}
                      {raumThema === "privacy" && (
                        <PrivacyPanel
                          zimmerTitel={aktivesRaumTitel}
                          wert={
                            attr.privacy?.[aktiveRaumId] ?? {
                              hasLock: false,
                              lockType: null,
                            }
                          }
                          onSpeichere={(neu) => speicherePrivacy(aktiveRaumId, neu)}
                          onZurueck={() => setRaumThema(null)}
                        />
                      )}
                      {raumThema === "amenities" && (
                        <AmenityPanel
                          gewaehlt={prop.amenities}
                          onSpeichere={speichereAmenities}
                          onZurueck={() => setRaumThema(null)}
                        />
                      )}
                      {raumThema === "barriere" && (
                        <BarrierefreiheitPanel
                          werte={attr.accessibility ?? {}}
                          onSpeichere={speichereBarriere}
                          onZurueck={() => setRaumThema(null)}
                        />
                      )}
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
