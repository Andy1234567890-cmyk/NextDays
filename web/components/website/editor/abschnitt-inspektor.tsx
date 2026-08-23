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

/** Feldarten, deren Wert eine Locale-Map ist.
 *
 *  `einfachtext` gehört bewusst NICHT dazu: E-Mail, Telefon und Filterbegriff
 *  sind im Backend flache Strings. Sie hier als Locale-Map zu schreiben ließ das
 *  Speichern der ganzen Seite mit 400 scheitern („Input should be a valid
 *  string") — für den Kunden sah es aus, als sei der Baukasten kaputt. */
const MEHRSPRACHIG = new Set(["text", "textlang", "richtext"]);

type Karte = Record<string, string>;

function alsKarte(v: unknown): Karte {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Karte) : {};
}

export function AbschnittInspektor({
  typ,
  content,
  onChange,
}: {
  typ: BlockType;
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
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

  const hatMehrsprachige = meta.felder.some((f) => MEHRSPRACHIG.has(f.art));

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
