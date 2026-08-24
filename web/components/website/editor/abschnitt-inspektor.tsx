"use client";

// Felder des gewählten Abschnitts.
//
// Das Formular wird AUS DEM KATALOG gerendert (`../abschnitte`): jeder Abschnitt
// beschreibt seine Felder selbst, der Inspektor kennt nur die Feldarten. Damit
// braucht ein neuer Abschnitt keine zweite Formular-Datei, die man vergessen
// kann — und es gibt keine Stelle, an der Katalog und Formular auseinanderlaufen.
//
// Mehrsprachige Felder: die Inhalte liegen als Locale-Map ({"de": "…"}). Die
// bearbeitete Sprache ist standardmäßig die des Dashboards; wählbar sind die
// Sprachen, die im Inhalt schon vorkommen, plus die eigene. Es wird KEINE
// Sprachliste erfunden — welche Sprachen eine Kunden-Site anbietet, ist eine
// eigene Entscheidung und steht heute nirgends.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import type { BlockType } from "@/lib/site-pages";

import { type Feld, abschnittFuer } from "../abschnitte";
import { Mediathek } from "../mediathek";
import { BildFeld } from "./bild-feld";
import { SymbolFeld } from "./symbol-feld";

/** Feldarten, deren Wert eine Locale-Map ist.
 *
 *  `einfachtext` gehört bewusst NICHT dazu: E-Mail, Telefon und Filterbegriff
 *  sind im Backend flache Strings. Sie hier als Locale-Map zu schreiben ließ das
 *  Speichern der ganzen Seite mit 400 scheitern („Input should be a valid
 *  string") — für den Kunden sah es aus, als sei der Baukasten kaputt. */
const MEHRSPRACHIG = new Set(["text", "textlang", "richtext"]);

/** Feldarten, die eine LISTE von Einträgen halten, und welche Unterfelder darin
 *  mehrsprachig sind.
 *
 *  Nötig für den Sprachwähler: bei diesen Arten liegen die Locale-Maps eine
 *  Ebene tiefer (nicht `content.items` ist die Karte, sondern
 *  `items[i].question`). Ohne diese Tabelle zeigte der Wähler die gepflegten
 *  Sprachen eines solchen Abschnitts nicht an — bei einer zweisprachigen
 *  Website wäre er unbrauchbar.
 *
 *  Einsprachige Unterfelder (`author`, `location`, `icon`) stehen hier
 *  ABSICHTLICH nicht: ein Name wird nicht übersetzt, und ein Symbol-Schlüssel
 *  ist gar kein Text. */
const LISTEN_FELDER: Record<string, string[] | undefined> = {
  fragen: ["question", "answer"],
  stimmen: ["quote"],
  merkmale: ["title", "text"],
  formfelder: ["label", "placeholder"],
};

type Karte = Record<string, string>;

function alsKarte(v: unknown): Karte {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Karte) : {};
}

export function AbschnittInspektor({
  typ,
  content,
  settings,
  onChange,
  onSettings,
}: {
  typ: BlockType;
  content: Record<string, unknown>;
  /** Darstellungs-Einstellungen des Abschnitts (0432). */
  settings: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const t = useTranslations("website");
  const uiLocale = useLocale();
  const meta = abschnittFuer(typ);
  const [sprache, setSprache] = useState(uiLocale);

  // Sprachen, in denen dieser Abschnitt schon Text trägt — plus die eigene.
  // So sieht der Kunde, was gepflegt ist, ohne eine Liste zu verwalten.
  const sprachen = useMemo(() => {
    const gefunden = new Set<string>([uiLocale]);
    if (!meta) return [...gefunden];
    for (const feld of meta.felder) {
      // Die Frage-Liste trägt ihre Locale-Maps eine Ebene TIEFER: nicht
      // `content.items` ist die Karte, sondern `items[i].question` und
      // `items[i].answer`. Ohne diesen Zweig zeigte der Sprachwähler die
      // gepflegten Sprachen eines FAQ-Abschnitts nicht an — er wäre bei einer
      // zweisprachigen Website unbrauchbar.
      if (LISTEN_FELDER[feld.art]) {
        const liste = Array.isArray(content[feld.key])
          ? (content[feld.key] as Array<Record<string, unknown>>)
          : [];
        for (const eintrag of liste) {
          for (const unterfeld of LISTEN_FELDER[feld.art]!) {
            for (const k of Object.keys(alsKarte(eintrag[unterfeld]))) {
              gefunden.add(k);
            }
          }
        }
        continue;
      }
      if (!MEHRSPRACHIG.has(feld.art)) continue;
      for (const k of Object.keys(alsKarte(content[feld.key]))) {
        gefunden.add(k);
      }
    }
    return [...gefunden].sort();
  }, [content, meta, uiLocale]);

  if (!meta) {
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">
        {t("editor.unbekannterAbschnittHinweis")}
      </p>
    );
  }

  function setzeFeld(key: string, wert: unknown) {
    onChange({ ...content, [key]: wert });
  }

  function setzeText(key: string, wert: string) {
    const karte = { ...alsKarte(content[key]) };
    if (wert) karte[sprache] = wert;
    // Leerer Text: den Eintrag ENTFERNEN statt einen Leerstring zu speichern.
    // Sonst zeigt der Renderer eine leere Überschrift statt gar keine.
    else delete karte[sprache];
    setzeFeld(key, karte);
  }

  const hatMehrsprachige = meta.felder.some(
    (f) => MEHRSPRACHIG.has(f.art) || Boolean(LISTEN_FELDER[f.art]),
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon icon={meta.icon} className="size-4 text-muted-foreground" />
          {t(`abschnitte.${meta.label}`)}
        </h4>
        {hatMehrsprachige && sprachen.length > 1 ? (
          <NativeSelect
            value={sprache}
            onChange={(e) => setSprache(e.target.value)}
            aria-label={t("editor.sprache")}
            className="w-24"
          >
            {sprachen.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>

      {meta.felder.map((feld) => (
        <FeldEingabe
          key={feld.key}
          feld={feld}
          wert={content[feld.key]}
          sprache={sprache}
          onText={(v) => setzeText(feld.key, v)}
          onWert={(v) => setzeFeld(feld.key, v)}
        />
      ))}

      <StilBereich settings={settings} onSettings={onSettings} />
    </div>
  );
}

/** Darstellung eines Abschnitts: Hintergrund und Innenabstand (0432).
 *
 *  Steht bei JEDEM Abschnittstyp unten, weil es für jeden gilt — anders als die
 *  Inhaltsfelder, die aus dem Katalog kommen.
 *
 *  Diese Werte lagen bisher im Backend-Schema (`BlockSettings`) und in der
 *  Datenbank, aber es gab keine Oberfläche dafür: der Renderer las sie, niemand
 *  konnte sie füllen. Eingebaut werden hier nur die, die im Renderer WIRKLICH
 *  etwas tun — `opacity`, `radius` und `rotation` aus dem Schema stammen vom
 *  alten Framer-Canvas und werden nirgends ausgelesen. Sie hier anzubieten
 *  wäre genau die Attrappe, die es zu vermeiden gilt. */
function StilBereich({
  settings,
  onSettings,
}: {
  settings: Record<string, unknown>;
  onSettings: (s: Record<string, unknown>) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);

  function setze(key: string, wert: unknown) {
    const kopie = { ...settings };
    // `null`/leer ENTFERNT den Schlüssel statt ihn als null zu speichern:
    // „nicht gesetzt" ist der wahre Zustand, und der Renderer entscheidet dann.
    if (wert === null || wert === "") delete kopie[key];
    else kopie[key] = wert;
    onSettings(kopie);
  }

  const bild =
    typeof settings.background_image_url === "string"
      ? settings.background_image_url
      : null;
  const farbe =
    typeof settings.background_color === "string"
      ? settings.background_color
      : "";
  const deckung =
    typeof settings.background_overlay === "number"
      ? settings.background_overlay
      : 0;

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center justify-between text-left text-xs font-semibold"
      >
        {t("editor.darstellung")}
        <Icon
          icon={offen ? "ph:caret-up" : "ph:caret-down"}
          className="size-3.5 text-muted-foreground"
        />
      </button>

      {offen ? (
        <div className="flex flex-col gap-3 pt-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs font-medium">
              {t("felder.hintergrundfarbe")}
            </span>
            <span className="flex items-center gap-2">
              {/* Der Farbwähler des Browsers kann „nicht gesetzt" nicht
                  darstellen — er zeigt immer eine Farbe. Deshalb daneben ein
                  Knopf, der sie wieder entfernt. */}
              <input
                type="color"
                value={farbe || "#ffffff"}
                onChange={(e) => setze("background_color", e.target.value)}
                className="size-8 cursor-pointer rounded border border-border bg-transparent"
              />
              {farbe ? (
                <button
                  type="button"
                  onClick={() => setze("background_color", null)}
                  aria-label={t("editor.entfernen")}
                  className="text-muted-foreground transition hover:text-destructive"
                >
                  <Icon icon="ph:x" className="size-3.5" />
                </button>
              ) : null}
            </span>
          </label>

          <BildFeld
            label={t("felder.hintergrundbild")}
            wert={bild}
            onWert={(v) => setze("background_image_url", v)}
          />

          {/* Der Regler erscheint NUR mit Bild: ohne eines verdunkelt er
              nichts, und ein Regler ohne Wirkung ist eine Attrappe. */}
          {bild ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium">
                {t("felder.abdunkeln")}{" "}
                <span className="text-muted-foreground">
                  {Math.round(deckung * 100)}%
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t("felder.abdunkelnHinweis")}
              </span>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={Math.round(deckung * 100)}
                onChange={(e) =>
                  setze("background_overlay", Number(e.target.value) / 100)
                }
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium">{t("felder.abstand")}</span>
            <NativeSelect
              value={
                typeof settings.padding === "string" ? settings.padding : "md"
              }
              onChange={(e) => setze("padding", e.target.value)}
            >
              {(["none", "sm", "md", "lg"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`felder.abstandWert.${v}`)}
                </option>
              ))}
            </NativeSelect>
          </label>

          {/* `full_width` steht ABSICHTLICH nicht hier, obwohl das
              Backend-Schema es führt: jeder Abschnitt setzt seine Breite selbst
              (`mx-auto max-w-6xl` und ähnlich). Ein Schalter, der daran nichts
              ändert, wäre eine Attrappe — und die Breite je Abschnitt
              freizugeben hieße, das Raster der Seite aufzugeben. Dasselbe gilt
              für `opacity`, `radius` und `rotation` aus dem Schema: sie stammen
              vom alten Framer-Canvas und werden im Renderer nirgends gelesen. */}
        </div>
      ) : null}
    </div>
  );
}

function FeldEingabe({
  feld,
  wert,
  sprache,
  onText,
  onWert,
}: {
  feld: Feld;
  wert: unknown;
  sprache: string;
  onText: (v: string) => void;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const label = t(`felder.${feld.label}`);
  const text = alsKarte(wert)[sprache] ?? "";

  switch (feld.art) {
    case "text":
      return (
        <Zeile label={label}>
          <Input value={text} onChange={(e) => onText(e.target.value)} />
        </Zeile>
      );

    case "einfachtext":
      return (
        <Zeile label={label}>
          <Input
            value={typeof wert === "string" ? wert : ""}
            onChange={(e) => onWert(e.target.value || null)}
          />
        </Zeile>
      );

    case "textlang":
      return (
        <Zeile label={label}>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => onText(e.target.value)}
          />
        </Zeile>
      );

    case "richtext":
      return (
        <Zeile label={label}>
          {/* Ohne bildUpload lässt der Editor kein <img> zu — das ist Absicht:
              es gibt (noch) keinen Upload-Weg für Bilder im Baukasten, und ein
              eingefügtes data:-URI würde als mehrere MB in der HTML-Spalte
              landen. Bilder gehören in den Bild- oder Galerie-Abschnitt. */}
          <RichTextEditor value={text} onChange={onText} />
        </Zeile>
      );

    case "bild":
      return (
        <BildFeld
          label={label}
          wert={typeof wert === "string" ? wert : null}
          onWert={onWert}
        />
      );

    case "bilder":
      return <BilderFeld label={label} wert={wert} onWert={onWert} />;

    case "link":
      return (
        <Zeile label={label}>
          <Input
            value={typeof wert === "string" ? wert : ""}
            placeholder="/kontakt"
            onChange={(e) => onWert(e.target.value || null)}
          />
        </Zeile>
      );

    case "zahl":
      return (
        <Zeile label={label}>
          <Input
            type="number"
            min={feld.min}
            max={feld.max}
            value={typeof wert === "number" ? wert : ""}
            onChange={(e) =>
              // Leeres Feld = „nicht gesetzt", nicht 0. Eine 0 wäre eine Aussage,
              // die der Kunde nicht getroffen hat (Wurzel 4).
              onWert(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Zeile>
      );

    case "schalter":
      return (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{label}</span>
          <Switch
            checked={wert === true}
            onCheckedChange={(v: boolean) => onWert(v)}
          />
        </label>
      );

    case "auswahl":
      return (
        <Zeile label={label}>
          {/* KEINE leere Option: die schickte `null` in ein Pflichtfeld des
              Backends und ließ das Speichern der ganzen Seite mit 400
              scheitern. Ist nichts gesetzt, zeigt die Auswahl den Standardwert
              des Katalogs — denselben, den das Backend-Schema führt. */}
          <NativeSelect
            value={
              typeof wert === "string" && wert
                ? wert
                : (feld.standard ?? feld.optionen?.[0]?.wert ?? "")
            }
            onChange={(e) => onWert(e.target.value)}
          >
            {(feld.optionen ?? []).map((o) => (
              <option key={o.wert} value={o.wert}>
                {t(`felder.${o.label}`)}
              </option>
            ))}
          </NativeSelect>
        </Zeile>
      );

    case "objekte":
      return <ObjekteFeld label={label} wert={wert} onWert={onWert} />;

    case "fragen":
      return (
        <FragenFeld
          label={label}
          wert={wert}
          sprache={sprache}
          onWert={onWert}
        />
      );

    case "stimmen":
      return (
        <StimmenFeld
          label={label}
          wert={wert}
          sprache={sprache}
          onWert={onWert}
        />
      );

    case "merkmale":
      return (
        <MerkmaleFeld
          label={label}
          wert={wert}
          sprache={sprache}
          onWert={onWert}
        />
      );

    case "symbol":
      return <SymbolFeld label={label} wert={wert} onWert={onWert} />;

    case "formfelder":
      return (
        <FormFelderFeld
          label={label}
          wert={wert}
          sprache={sprache}
          onWert={onWert}
        />
      );

    default:
      return null;
  }
}

function Zeile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

/** Bilderliste (Galerie). Reihenfolge zählt — das erste Bild wird größer
 *  dargestellt, deshalb ist Sortieren hier keine Kosmetik. */
function BilderFeld({
  label,
  wert,
  onWert,
}: {
  label: string;
  wert: unknown;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const [mediathekOffen, setMediathekOffen] = useState(false);
  const bilder = Array.isArray(wert)
    ? (wert as Array<Record<string, unknown>>)
    : [];

  function setze(liste: Array<Record<string, unknown>>) {
    onWert(liste);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {bilder.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {bilder.map((b, i) => (
            <li
              key={`${String(b.url)}-${i}`}
              className="flex items-center gap-2 rounded-(--radius) border border-border p-1"
            >
              {typeof b.url === "string" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.url}
                  alt=""
                  className="size-10 shrink-0 rounded object-cover"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {String(b.url ?? "")}
              </span>
              <button
                type="button"
                aria-label={t("editor.nachOben")}
                disabled={i === 0}
                onClick={() => {
                  const k = [...bilder];
                  [k[i - 1], k[i]] = [k[i]!, k[i - 1]!];
                  setze(k);
                }}
                className="p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
              >
                <Icon icon="ph:caret-up" className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("editor.entfernen")}
                onClick={() => setze(bilder.filter((_, j) => j !== i))}
                className="p-0.5 text-muted-foreground transition hover:text-destructive"
              >
                <Icon icon="ph:trash" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setMediathekOffen(true)}
        className="flex items-center justify-center gap-1.5 rounded-(--radius) border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
      >
        <Icon icon="ph:images" className="size-4" />
        {t("editor.bildHinzufuegen")}
      </button>

      {mediathekOffen ? (
        <Mediathek
          // Der Dialog bleibt OFFEN: eine Galerie hat mehrere Bilder, und für
          // jedes einzeln neu zu öffnen wäre der Weg, den niemand geht.
          // Geschlossen wird über das X oder Escape.
          onWaehle={(url) => setze([...bilder, { url, alt: {} }])}
          onSchliesse={() => setMediathekOffen(false)}
        />
      ) : null}
    </div>
  );
}

/** Objekt-IDs für „ausgewählte Objekte".
 *
 *  Bewusst als Liste von IDs mit Eingabefeld und noch NICHT als Objekt-Auswahl
 *  aus dem eigenen Bestand: eine Auswahlliste bräuchte einen eigenen Endpunkt,
 *  der die Objekte des Kontos für diesen Zweck liefert. Das ist die verbleibende
 *  Schwachstelle dieses Abschnitts und hier bewusst benannt, statt sie mit einer
 *  hübschen Attrappe zu verdecken. */
function ObjekteFeld({
  label,
  wert,
  onWert,
}: {
  label: string;
  wert: unknown;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const [neu, setNeu] = useState("");
  const ids = Array.isArray(wert) ? (wert as string[]) : [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">
        {t("editor.objekteHinweis")}
      </span>
      {ids.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
            >
              <span className="font-mono">{id.slice(0, 8)}</span>
              <button
                type="button"
                aria-label={t("editor.entfernen")}
                onClick={() => onWert(ids.filter((x) => x !== id))}
                className="text-muted-foreground transition hover:text-destructive"
              >
                <Icon icon="ph:x" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={neu}
          placeholder={t("editor.objektIdPlatzhalter")}
          onChange={(e) => setNeu(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!neu.trim() || ids.includes(neu.trim())}
          onClick={() => {
            onWert([...ids, neu.trim()]);
            setNeu("");
          }}
        >
          {t("editor.objektHinzufuegen")}
        </Button>
      </div>
    </div>
  );
}


/** Frage-Antwort-Liste (0431).
 *
 *  Beide Felder sind mehrsprachig, liegen aber eine Ebene tiefer als bei einem
 *  normalen Textfeld: `items[i].question` ist die Locale-Map, nicht `items`.
 *  Deshalb bekommt dieses Feld die bearbeitete Sprache durchgereicht und pflegt
 *  die Karten selbst.
 *
 *  Reihenfolge zählt: die Fragen erscheinen auf der Website und im JSON-LD in
 *  genau dieser Folge, und die wichtigste gehört nach oben. Deshalb gibt es
 *  Sortierknöpfe und nicht nur „hinzufügen/löschen". */
function FragenFeld({
  label,
  wert,
  sprache,
  onWert,
}: {
  label: string;
  wert: unknown;
  sprache: string;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const liste = Array.isArray(wert)
    ? (wert as Array<Record<string, unknown>>)
    : [];

  /** Höchstzahl wie im Backend-Schema (`FaqContent.items`, max_length=30).
   *  Steht hier, damit der Knopf verschwindet, statt dass der Kunde einen 422
   *  bekommt, nachdem er die 31. Frage getippt hat. */
  const MAX = 30;

  function setzeFeldWert(i: number, feld: "question" | "answer", text: string) {
    const kopie = [...liste];
    const karte = { ...alsKarte(kopie[i]?.[feld]) };
    // Leerer Text entfernt die Sprache aus der Karte statt "" zu speichern:
    // „in dieser Sprache nicht gepflegt" ist der wahre Zustand, ein Leerstring
    // wäre eine gepflegte leere Antwort (Wurzel 4).
    if (text) karte[sprache] = text;
    else delete karte[sprache];
    kopie[i] = { ...kopie[i], [feld]: karte };
    onWert(kopie);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {liste.map((eintrag, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-(--radius) border border-border p-2"
        >
          <div className="flex items-center gap-1">
            <span className="flex-1 text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <button
              type="button"
              aria-label={t("editor.nachOben")}
              disabled={i === 0}
              onClick={() => {
                const k = [...liste];
                [k[i - 1], k[i]] = [k[i]!, k[i - 1]!];
                onWert(k);
              }}
              className="p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            >
              <Icon icon="ph:caret-up" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("editor.nachUnten")}
              disabled={i === liste.length - 1}
              onClick={() => {
                const k = [...liste];
                [k[i], k[i + 1]] = [k[i + 1]!, k[i]!];
                onWert(k);
              }}
              className="p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            >
              <Icon icon="ph:caret-down" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("editor.entfernen")}
              onClick={() => onWert(liste.filter((_, j) => j !== i))}
              className="p-0.5 text-muted-foreground transition hover:text-destructive"
            >
              <Icon icon="ph:trash" className="size-3.5" />
            </button>
          </div>
          <Input
            value={alsKarte(eintrag.question)[sprache] ?? ""}
            placeholder={t("felder.frage")}
            onChange={(e) => setzeFeldWert(i, "question", e.target.value)}
          />
          {/* Reiner Text und kein Rich-Text-Editor: derselbe Inhalt geht als
              JSON-LD an Google, und dessen Richtlinie erlaubt im Antwortfeld
              kaum Auszeichnung. Ein Feld, das auf der Seite formatiert und im
              Suchergebnis entstellt erscheint, wäre schlechter als eines ohne
              Formatierung. */}
          <Textarea
            rows={3}
            value={alsKarte(eintrag.answer)[sprache] ?? ""}
            placeholder={t("felder.antwort")}
            onChange={(e) => setzeFeldWert(i, "answer", e.target.value)}
          />
        </div>
      ))}
      {liste.length < MAX ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onWert([...liste, { question: {}, answer: {} }])}
        >
          {t("editor.frageHinzufuegen")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("editor.fragenMax", { max: MAX })}
        </p>
      )}
    </div>
  );
}

/** Ein Listen-Feld mit Sortier- und Löschknöpfen — der Rahmen für Stimmen und
 *  Merkmale (0432).
 *
 *  Ausgelagert, weil beide Listen dieselbe Bedienung brauchen und sich nur in
 *  den Feldern DARIN unterscheiden. Zwei Kopien wären zwei Stellen, an denen
 *  das Sortieren irgendwann anders funktioniert.
 *
 *  Reihenfolge zählt bei beiden: die Einträge erscheinen auf der Website in
 *  genau dieser Folge. */
function ListenRahmen({
  label,
  anzahl,
  max,
  hinzuKnopf,
  maxHinweis,
  onNeu,
  onTauschen,
  onEntfernen,
  children,
}: {
  label: string;
  anzahl: number;
  max: number;
  hinzuKnopf: string;
  maxHinweis: string;
  onNeu: () => void;
  onTauschen: (von: number, nach: number) => void;
  onEntfernen: (i: number) => void;
  /** Die Felder eines Eintrags. */
  children: (i: number) => React.ReactNode;
}) {
  const t = useTranslations("website");
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {Array.from({ length: anzahl }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-(--radius) border border-border p-2"
        >
          <div className="flex items-center gap-1">
            <span className="flex-1 text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <button
              type="button"
              aria-label={t("editor.nachOben")}
              disabled={i === 0}
              onClick={() => onTauschen(i, i - 1)}
              className="p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            >
              <Icon icon="ph:caret-up" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("editor.nachUnten")}
              disabled={i === anzahl - 1}
              onClick={() => onTauschen(i, i + 1)}
              className="p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            >
              <Icon icon="ph:caret-down" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("editor.entfernen")}
              onClick={() => onEntfernen(i)}
              className="p-0.5 text-muted-foreground transition hover:text-destructive"
            >
              <Icon icon="ph:trash" className="size-3.5" />
            </button>
          </div>
          {children(i)}
        </div>
      ))}
      {anzahl < max ? (
        <Button type="button" variant="outline" size="sm" onClick={onNeu}>
          {hinzuKnopf}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{maxHinweis}</p>
      )}
    </div>
  );
}

/** Gästestimmen (0432): Zitat mehrsprachig, Name und Ort einsprachig.
 *
 *  Kein Sterne-Feld — siehe die Begründung im Renderer
 *  (`builder/components/blocks/stimmen.tsx`): eine eingetippte Sternebewertung
 *  wäre eine Zahl ohne Grundlage. Wer Sterne zeigen will, nimmt den Abschnitt
 *  mit den echten Bewertungen. */
function StimmenFeld({
  label,
  wert,
  sprache,
  onWert,
}: {
  label: string;
  wert: unknown;
  sprache: string;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const liste = Array.isArray(wert)
    ? (wert as Array<Record<string, unknown>>)
    : [];
  const MAX = 20;

  function setzeZitat(i: number, text: string) {
    const kopie = [...liste];
    const karte = { ...alsKarte(kopie[i]?.quote) };
    if (text) karte[sprache] = text;
    else delete karte[sprache];
    kopie[i] = { ...kopie[i], quote: karte };
    onWert(kopie);
  }

  function setzeFlach(i: number, feld: "author" | "location", v: string) {
    const kopie = [...liste];
    kopie[i] = { ...kopie[i], [feld]: v || null };
    onWert(kopie);
  }

  return (
    <ListenRahmen
      label={label}
      anzahl={liste.length}
      max={MAX}
      hinzuKnopf={t("editor.stimmeHinzufuegen")}
      maxHinweis={t("editor.stimmenMax", { max: MAX })}
      onNeu={() => onWert([...liste, { quote: {} }])}
      onTauschen={(von, nach) => {
        const k = [...liste];
        [k[von], k[nach]] = [k[nach]!, k[von]!];
        onWert(k);
      }}
      onEntfernen={(i) => onWert(liste.filter((_, j) => j !== i))}
    >
      {(i) => (
        <>
          <Textarea
            rows={3}
            value={alsKarte(liste[i]?.quote)[sprache] ?? ""}
            placeholder={t("felder.zitat")}
            onChange={(e) => setzeZitat(i, e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={
                typeof liste[i]?.author === "string"
                  ? (liste[i]!.author as string)
                  : ""
              }
              placeholder={t("felder.name")}
              onChange={(e) => setzeFlach(i, "author", e.target.value)}
            />
            <Input
              value={
                typeof liste[i]?.location === "string"
                  ? (liste[i]!.location as string)
                  : ""
              }
              placeholder={t("felder.ort")}
              onChange={(e) => setzeFlach(i, "location", e.target.value)}
            />
          </div>
        </>
      )}
    </ListenRahmen>
  );
}

/** Merkmale (0432): Symbol aus der Auswahl + Überschrift + Text. */
function MerkmaleFeld({
  label,
  wert,
  sprache,
  onWert,
}: {
  label: string;
  wert: unknown;
  sprache: string;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const liste = Array.isArray(wert)
    ? (wert as Array<Record<string, unknown>>)
    : [];
  const MAX = 12;

  function setzeText(i: number, feld: "title" | "text", v: string) {
    const kopie = [...liste];
    const karte = { ...alsKarte(kopie[i]?.[feld]) };
    if (v) karte[sprache] = v;
    else delete karte[sprache];
    kopie[i] = { ...kopie[i], [feld]: karte };
    onWert(kopie);
  }

  return (
    <ListenRahmen
      label={label}
      anzahl={liste.length}
      max={MAX}
      hinzuKnopf={t("editor.merkmalHinzufuegen")}
      maxHinweis={t("editor.merkmaleMax", { max: MAX })}
      onNeu={() => onWert([...liste, { title: {}, text: {} }])}
      onTauschen={(von, nach) => {
        const k = [...liste];
        [k[von], k[nach]] = [k[nach]!, k[von]!];
        onWert(k);
      }}
      onEntfernen={(i) => onWert(liste.filter((_, j) => j !== i))}
    >
      {(i) => (
        <>
          <SymbolFeld
            label={t("felder.symbol")}
            wert={liste[i]?.icon}
            onWert={(v) => {
              const kopie = [...liste];
              kopie[i] = { ...kopie[i], icon: v };
              onWert(kopie);
            }}
          />
          <Input
            value={alsKarte(liste[i]?.title)[sprache] ?? ""}
            placeholder={t("felder.ueberschrift")}
            onChange={(e) => setzeText(i, "title", e.target.value)}
          />
          <Textarea
            rows={2}
            value={alsKarte(liste[i]?.text)[sprache] ?? ""}
            placeholder={t("felder.text")}
            onChange={(e) => setzeText(i, "text", e.target.value)}
          />
        </>
      )}
    </ListenRahmen>
  );
}


/** Formularfelder (0436): Name, Art, Beschriftung, Pflicht.
 *
 *  Der `name` ist der Schlüssel, unter dem die Antwort gespeichert wird. Er
 *  wird beim ANLEGEN aus der Beschriftung abgeleitet und danach nicht mehr
 *  angetastet: bestehende Einsendungen liegen unter dem alten Namen, und eine
 *  Umbenennung würde sie unlesbar machen. Deshalb ist das Namensfeld hier nicht
 *  bearbeitbar — es steht nur daneben, damit man es im CSV-Export wiedererkennt.
 *
 *  Bei der Feldart `select` erscheint zusätzlich eine Liste von Optionen; bei
 *  allen anderen wäre sie ein Feld ohne Wirkung. */
function FormFelderFeld({
  label,
  wert,
  sprache,
  onWert,
}: {
  label: string;
  wert: unknown;
  sprache: string;
  onWert: (v: unknown) => void;
}) {
  const t = useTranslations("website");
  const liste = Array.isArray(wert)
    ? (wert as Array<Record<string, unknown>>)
    : [];
  const MAX = 20;

  /** Aus einer Beschriftung einen Feldnamen machen: klein, nur a-z0-9_.
   *  Dieselbe Regel wie im Backend (`FormField._feldname`) — ein Name mit
   *  Leerzeichen macht die CSV-Datei unlesbar, ein Punkt bricht jede
   *  jsonb-Abfrage. */
  function nameAus(text: string, i: number): string {
    const roh = text
      .toLowerCase()
      .replace(/[äöüß]/g, (c) =>
        c === "ä" ? "ae" : c === "ö" ? "oe" : c === "ü" ? "ue" : "ss",
      )
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return roh || `feld_${i + 1}`;
  }

  function setzeText(
    i: number,
    feld: "label" | "placeholder",
    v: string,
  ) {
    const kopie = [...liste];
    const karte = { ...alsKarte(kopie[i]?.[feld]) };
    if (v) karte[sprache] = v;
    else delete karte[sprache];
    kopie[i] = { ...kopie[i], [feld]: karte };
    // Der Name entsteht EINMAL, beim ersten Beschriftungstext. Danach bleibt er
    // — siehe Erklärung oben.
    if (feld === "label" && !kopie[i]?.name && v) {
      kopie[i] = { ...kopie[i], name: nameAus(v, i) };
    }
    onWert(kopie);
  }

  const ARTEN = [
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "date",
    "select",
    "checkbox",
    "consent",
  ];

  return (
    <ListenRahmen
      label={label}
      anzahl={liste.length}
      max={MAX}
      hinzuKnopf={t("editor.feldHinzufuegen")}
      maxHinweis={t("editor.formfelderMax", { max: MAX })}
      onNeu={() =>
        onWert([...liste, { type: "text", label: {}, required: false }])
      }
      onTauschen={(von, nach) => {
        const k = [...liste];
        [k[von], k[nach]] = [k[nach]!, k[von]!];
        onWert(k);
      }}
      onEntfernen={(i) => onWert(liste.filter((_, j) => j !== i))}
    >
      {(i) => {
        const art = typeof liste[i]?.type === "string" ? (liste[i]!.type as string) : "text";
        return (
          <>
            <NativeSelect
              value={art}
              onChange={(e) => {
                const kopie = [...liste];
                kopie[i] = { ...kopie[i], type: e.target.value };
                onWert(kopie);
              }}
              aria-label={t("felder.feldart")}
            >
              {ARTEN.map((a) => (
                <option key={a} value={a}>
                  {t(`felder.feldartName.${a}`)}
                </option>
              ))}
            </NativeSelect>
            <Input
              value={alsKarte(liste[i]?.label)[sprache] ?? ""}
              placeholder={t("felder.beschriftung")}
              onChange={(e) => setzeText(i, "label", e.target.value)}
            />
            {/* Platzhalter und Optionen nur, wo sie etwas tun. Ein
                Platzhalter-Feld an einem Häkchen wäre eine Eingabe ohne
                Wirkung. */}
            {art !== "checkbox" && art !== "consent" ? (
              <Input
                value={alsKarte(liste[i]?.placeholder)[sprache] ?? ""}
                placeholder={t("felder.platzhalter")}
                onChange={(e) => setzeText(i, "placeholder", e.target.value)}
              />
            ) : null}
            {art === "select" ? (
              <Textarea
                rows={3}
                value={(Array.isArray(liste[i]?.options)
                  ? (liste[i]!.options as Array<Record<string, string>>)
                  : []
                )
                  .map((o) => o[sprache] ?? "")
                  .join("\n")}
                placeholder={t("felder.optionenHinweis")}
                onChange={(e) => {
                  const kopie = [...liste];
                  kopie[i] = {
                    ...kopie[i],
                    options: e.target.value
                      .split("\n")
                      .map((z) => z.trim())
                      .filter(Boolean)
                      .map((z) => ({ [sprache]: z })),
                  };
                  onWert(kopie);
                }}
              />
            ) : null}
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={liste[i]?.required === true}
                  onChange={(e) => {
                    const kopie = [...liste];
                    kopie[i] = { ...kopie[i], required: e.target.checked };
                    onWert(kopie);
                  }}
                  className="size-3.5"
                />
                {t("felder.pflichtfeld")}
              </label>
              {/* Der Feldname als Kleingedrucktes: er steht so in der
                  Antwortenliste und im CSV-Export. */}
              {liste[i]?.name ? (
                <span className="font-mono text-muted-foreground">
                  {String(liste[i]!.name)}
                </span>
              ) : null}
            </div>
          </>
        );
      }}
    </ListenRahmen>
  );
}
