"use client";

// Die digitale Mappe eines Objekts: PDFs ablegen, lesen lassen, bestätigen —
// und im Original nachlesen.
//
// WARUM ES DAS GIBT: Was ein Betrieb real hat, ist ein PDF — die Hausordnung
// vom Verwalter, das WLAN-Blatt des Providers. Die Mappe verlangte bisher,
// alles abzutippen. Was niemand abtippt, steht in der Mappe eben nicht, und
// der Gast fragt dann per Nachricht nach dem WLAN-Passwort.
//
// DER ABLAUF IST ZWEISTUFIG, UND DAS IST DER PUNKT:
//
//     hochladen  →  gelesen  →  Liste zum Abhaken  →  MENSCH bestätigt  →  Feld
//
// OCR liest falsch: eine gedrehte Seite, ein Handscan, eine Tabelle mit zwei
// Spalten. Ein falsch erkannter Türcode fällt nicht dem Betrieb auf, sondern
// dem GAST, der vor der Tür steht. Deshalb schreibt hier nichts ohne Klick,
// und Türcode/WLAN-Passwort sind vorab NICHT angehakt.
//
// Das PDF bleibt liegen: der übernommene Text ist eine Zusammenfassung, das
// Dokument die Quelle. Ein Klick auf die Lupe zieht es groß.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { Textarea } from "@nextdays/ui/textarea";
import {
  deleteMappeDokument,
  listMappeDokumente,
  mappeDokumentLesen,
  mappeUebernehmen,
  type MappeDokument,
  type MappeVorschlag,
} from "@/lib/property-dossier";

/** Die Sprachfassungen der Mappe — dieselben drei wie im Editor der Blöcke. */
const SPRACHEN = ["de", "en", "da"] as const;

/** Dieselbe Grenze wie serverseitig (0619). Die Prüfung hier ist eine
 *  Höflichkeit, kein Schutz: verlassen wird sich auf den Server. */
const MAX_BYTES = 20 * 1024 * 1024;

function groesse(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Farbe und Symbol je Auswertungsstand. */
function standStil(stand: MappeDokument["auswertung"]): {
  icon: string;
  klasse: string;
} {
  switch (stand) {
    case "uebernommen":
      return { icon: "ph:check-circle", klasse: "text-emerald-600 dark:text-emerald-400" };
    case "gelesen":
      return { icon: "ph:eye", klasse: "text-accent" };
    case "ohne_treffer":
      return { icon: "ph:minus-circle", klasse: "text-muted-foreground" };
    case "fehler":
      return { icon: "ph:warning-circle", klasse: "text-destructive" };
    default:
      return { icon: "ph:hourglass-medium", klasse: "text-muted-foreground" };
  }
}

export function MappeDokumente({
  pid,
  mappe,
}: {
  pid: string;
  mappe: "gast" | "haus";
}) {
  const t = useTranslations("dossier");
  const [liste, setListe] = useState<MappeDokument[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Der Lauf: hochladen und lesen lassen.
  const [liest, setLiest] = useState(false);
  const [vorschlaege, setVorschlaege] = useState<MappeVorschlag[] | null>(null);
  const [dokumentId, setDokumentId] = useState<string | null>(null);
  const [sprache, setSprache] = useState<string>("de");
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [ueberschreiben, setUeberschreiben] = useState(false);
  const [uebernimmt, setUebernimmt] = useState(false);
  const [ergebnis, setErgebnis] = useState<string | null>(null);

  // Der Betrachter.
  const [ansicht, setAnsicht] = useState<{ name: string; url: string } | null>(null);
  // Welches Dokument gerade geholt wird — der Knopf zeigt es an, sonst
  // passiert nach dem Klick sekundenlang sichtbar nichts (8 MB dauern).
  const [laedtVorschau, setLaedtVorschau] = useState<string | null>(null);

  const dateiFeld = useRef<HTMLInputElement>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    // Debugging ist Pflicht: ein haengendes „Wird geladen" ist sonst nicht von
    // einem stillen Fehler zu unterscheiden. Deshalb wird JEDER Ausgang
    // sichtbar — auch der geworfene, den ein `Result`-Typ nicht abbildet.
    try {
      const r = await listMappeDokumente(pid, mappe);
      console.debug("[mappe] antwort", { pid, mappe, r });
      if (r.ok) {
        setListe(r.data);
        setFehler(null);
      } else {
        // Laut sagen, statt eine leere Mappe zu zeigen: „keine Dokumente" und
        // „nicht geladen" sind verschiedene Aussagen (Wurzel 4).
        setFehler(r.error);
      }
    } catch (exc) {
      // Eine Server-Action kann WERFEN, statt ein Result zu liefern (Netz,
      // Serialisierung, 500 in der Action selbst). Ohne diesen Fang bliebe
      // `setLaedt(false)` aus und die Kachel haenge fuer immer auf
      // „Wird geladen" — genau der beobachtete Zustand.
      const text = exc instanceof Error ? exc.message : String(exc);
      console.error("[mappe] laden geworfen", exc);
      setFehler(text || "Die Mappe konnte nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, [pid, mappe]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function hochladen(datei: File) {
    setFehler(null);
    setErgebnis(null);
    if (datei.size > MAX_BYTES) {
      setFehler(t("mappe.zuGross", { mb: MAX_BYTES / (1024 * 1024) }));
      return;
    }
    setLiest(true);
    const r = await mappeDokumentLesen(pid, mappe, datei);
    setLiest(false);
    if (!r.ok) {
      setFehler(r.error);
      void laden();
      return;
    }
    setDokumentId(r.data.dokument.id);
    setVorschlaege(r.data.items);
    setSprache(r.data.sprache ?? "de");
    setWerte(Object.fromEntries(r.data.items.map((i) => [i.key, i.wert])));
    // Heikle Felder (Türcode, WLAN-Passwort) sind vorab NICHT angehakt: ein
    // falsch gelesener Code fällt dem Gast auf, nicht dem Betrieb.
    setGewaehlt(new Set(r.data.items.filter((i) => !i.heikel).map((i) => i.key)));
    void laden();
  }

  async function bestaetigen() {
    if (!dokumentId || !vorschlaege) return;
    setUebernimmt(true);
    const r = await mappeUebernehmen(pid, {
      dokument_id: dokumentId,
      sprache,
      ueberschreiben,
      items: vorschlaege
        .filter((v) => gewaehlt.has(v.key))
        .map((v) => ({ ...v, wert: werte[v.key] ?? v.wert })),
    });
    setUebernimmt(false);
    if (!r.ok) {
      setFehler(r.error);
      return;
    }
    // Beides benennen: „3 übernommen" allein liesse offen, warum das
    // WLAN-Feld unverändert blieb.
    const teile = [t("mappe.gesetzt", { count: r.data.gesetzt.length })];
    if (r.data.uebersprungen.length) {
      teile.push(
        t("mappe.uebersprungen", { felder: r.data.uebersprungen.join(", ") }),
      );
    }
    setErgebnis(teile.join(" · "));
    setVorschlaege(null);
    setDokumentId(null);
    void laden();
  }

  async function ansehen(dok: MappeDokument) {
    // Das PDF wird GEHOLT und als Blob angezeigt — nicht als Adresse ins
    // iframe gegeben. Zwei Gruende, beide live gemessen (10.09.2026):
    //
    //  1. Das Sitzungs-Cookie `nd_access` ist `sameSite: lax`. Ein <iframe>
    //     ist eine Sub-Ressourcen-Anfrage, und dabei sendet der Browser ein
    //     lax-Cookie NICHT mit. Der Proxy fand kein Token und antwortete
    //     korrekt mit 401 — im Rahmen stand „Verbindung abgelehnt". `fetch`
    //     mit gleicher Herkunft schickt es dagegen mit.
    //     Das Cookie deshalb auf `none` zu stellen, waere die falsche
    //     Richtung: es wuerde den Loginschutz aller Nutzer schwaechen, um
    //     eine Vorschau zu retten.
    //
    //  2. Die signierte Storage-Adresse (`…/x.pdf?token=…`, fremde Domain)
    //     brachte Chromes PDF-Viewer gar nicht erst zum Starten — gemessen
    //     auch beim direkten Aufruf im eigenen Tab, ganz ohne iframe.
    //
    // Ein `blob:`-Objekt hat weder Herkunftsproblem noch Query-Parameter.
    setFehler(null);
    setLaedtVorschau(dok.id);
    try {
      const res = await fetch(
        `/api/v1/property-dossier/${pid}/mappe/dokument/${dok.id}/datei`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) {
        setFehler(t("mappe.vorschauFehler", { status: res.status }));
        return;
      }
      const blob = await res.blob();
      // Der Typ MUSS stimmen, sonst zeigt der Browser den Viewer nicht. Kommt
      // er nicht mit, wird er gesetzt statt geraten.
      const pdf =
        blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });
      setAnsicht({ name: dok.datei_name, url: URL.createObjectURL(pdf) });
    } catch {
      setFehler(t("mappe.vorschauFehler", { status: 0 }));
    } finally {
      setLaedtVorschau(null);
    }
  }

  async function entfernen(dok: MappeDokument) {
    if (!window.confirm(t("mappe.loeschenFrage", { name: dok.datei_name }))) return;
    const r = await deleteMappeDokument(pid, dok.id);
    if (!r.ok) {
      setFehler(r.error);
      return;
    }
    void laden();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t("mappe.titel")}</h3>
          <p className="text-xs text-muted-foreground">{t("mappe.erklaerung")}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={dateiFeld}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
              e.target.value = "";
              if (f) void hochladen(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={liest}
            onClick={() => dateiFeld.current?.click()}
          >
            <Icon
              icon={liest ? "ph:circle-notch" : "ph:upload-simple"}
              className={liest ? "size-4 animate-spin" : "size-4"}
            />
            {liest ? t("mappe.liest") : t("mappe.hochladen")}
          </Button>
        </div>
      </div>

      {fehler && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}
      {ergebnis && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm">{ergebnis}</p>
      )}

      {/* Die Bestätigungsliste. Sie erscheint nur direkt nach einem Lauf —
          die Vorschläge werden bewusst NICHT gespeichert (Wurzel 1: sonst
          verwaiste Zwischenzustände, die niemand aufräumt). */}
      {vorschlaege && (
        <Vorschlagsliste
          t={t}
          items={vorschlaege}
          gewaehlt={gewaehlt}
          setGewaehlt={setGewaehlt}
          werte={werte}
          setWerte={setWerte}
          sprache={sprache}
          setSprache={setSprache}
          ueberschreiben={ueberschreiben}
          setUeberschreiben={setUeberschreiben}
          uebernimmt={uebernimmt}
          onAbbrechen={() => {
            setVorschlaege(null);
            setDokumentId(null);
          }}
          onBestaetigen={() => void bestaetigen()}
        />
      )}

      {laedt ? (
        <p className="text-sm text-muted-foreground">{t("mappe.laedt")}</p>
      ) : liste.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("mappe.leer")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {liste.map((dok) => {
            const stil = standStil(dok.auswertung);
            return (
              <li key={dok.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon icon="ph:file-pdf" className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{dok.datei_name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{groesse(dok.datei_groesse_bytes)}</span>
                    {/* Seitenzahl nur, wenn sie ermittelt wurde — kein
                        erfundenes „1 Seite" (Wurzel 4). */}
                    {dok.seiten !== null && <span>· {t("mappe.seiten", { count: dok.seiten })}</span>}
                    <span className={`inline-flex items-center gap-1 ${stil.klasse}`}>
                      · <Icon icon={stil.icon} className="size-3" aria-hidden />
                      {t(`mappe.stand.${dok.auswertung}`)}
                    </span>
                  </p>
                  {dok.auswertung_hinweis && (
                    <p className="truncate text-xs text-muted-foreground">
                      {dok.auswertung_hinweis}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t("mappe.ansehen", { name: dok.datei_name })}
                  title={t("mappe.ansehen", { name: dok.datei_name })}
                  onClick={() => void ansehen(dok)}
                  disabled={laedtVorschau !== null}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Icon
                    icon={
                      laedtVorschau === dok.id
                        ? "ph:circle-notch"
                        : "ph:magnifying-glass-plus"
                    }
                    className={
                      laedtVorschau === dok.id
                        ? "size-4 animate-spin"
                        : "size-4"
                    }
                  />
                </button>
                <button
                  type="button"
                  aria-label={t("mappe.loeschen", { name: dok.datei_name })}
                  title={t("mappe.loeschen", { name: dok.datei_name })}
                  onClick={() => void entfernen(dok)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Der Betrachter. Ein <iframe> mit der signierten Adresse: der Bucket
          ist privat, es gibt keinen öffentlichen Pfad, und die Adresse gilt
          zehn Minuten.

          Der Link „In neuem Tab öffnen" steht IMMER daneben, nicht erst wenn
          die Vorschau scheitert: eine eingebettete Ansicht ist zum
          Überfliegen: wer zwölf Seiten Hausmappe wirklich liest, braucht
          Zoom, Suche und Drucken — also den Viewer des Browsers. */}
      <Dialog
        open={ansicht !== null}
        onOpenChange={(o) => {
          if (o) return;
          // Die Blob-Adresse SOFORT ungueltig machen. Sie lebt sonst bis zum
          // Neuladen der Seite weiter und haelt bei einer Hausmappe 8 MB im
          // Speicher fest — bei mehreren Dokumenten summiert sich das. Und
          // ein Dokument, das Tuercodes enthaelt, soll nach dem Schliessen
          // nicht abrufbar bleiben.
          if (ansicht) URL.revokeObjectURL(ansicht.url);
          setAnsicht(null);
        }}
      >
        <DialogContent className="max-w-5xl gap-3">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="min-w-0 truncate text-base font-semibold">
              {ansicht?.name}
            </DialogTitle>
            {/* Immer sichtbar, nicht erst wenn die Vorschau scheitert: eine
                eingebettete PDF-Ansicht ist zum Ueberfliegen da: wer wirklich
                LESEN will (12 Seiten Hausmappe), braucht Zoom, Suche und
                Drucken — also den Viewer des Browsers. */}
            {ansicht && (
              <a
                href={ansicht.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Icon icon="ph:arrow-square-out" className="size-4" />
                {t("mappe.imNeuenTab")}
              </a>
            )}
          </div>
          {ansicht && (
            <iframe
              src={ansicht.url}
              title={ansicht.name}
              className="h-[75vh] w-full rounded-lg border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations<"dossier">>;

/** Die Liste zum Abhaken. Jeder Wert bleibt editierbar — was das Modell
 *  gelesen hat, ist ein Vorschlag, keine Tatsache. */
function Vorschlagsliste({
  t,
  items,
  gewaehlt,
  setGewaehlt,
  werte,
  setWerte,
  sprache,
  setSprache,
  ueberschreiben,
  setUeberschreiben,
  uebernimmt,
  onAbbrechen,
  onBestaetigen,
}: {
  t: TFn;
  items: MappeVorschlag[];
  gewaehlt: Set<string>;
  setGewaehlt: (s: Set<string>) => void;
  werte: Record<string, string>;
  setWerte: (w: Record<string, string>) => void;
  sprache: string;
  setSprache: (s: string) => void;
  ueberschreiben: boolean;
  setUeberschreiben: (b: boolean) => void;
  uebernimmt: boolean;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm">{t("mappe.nichtsGefunden")}</p>
        <Button type="button" variant="ghost" className="mt-2" onClick={onAbbrechen}>
          {t("mappe.schliessen")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div>
        <p className="text-sm font-semibold">{t("mappe.gefunden", { count: items.length })}</p>
        <p className="text-xs text-muted-foreground">{t("mappe.gefundenHinweis")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((v) => {
          const an = gewaehlt.has(v.key);
          return (
            <li key={v.key} className="flex gap-3 rounded-lg bg-background p-3">
              <Checkbox
                id={`mappe-${v.key}`}
                checked={an}
                onCheckedChange={(c) => {
                  const neu = new Set(gewaehlt);
                  if (c) neu.add(v.key);
                  else neu.delete(v.key);
                  setGewaehlt(neu);
                }}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`mappe-${v.key}`}
                  className="flex flex-wrap items-center gap-2 text-sm font-medium"
                >
                  {v.titel}
                  {v.heikel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      <Icon icon="ph:shield-warning" className="size-3" aria-hidden />
                      {t("mappe.heikel")}
                    </span>
                  )}
                  {v.sicher && v.sicher !== "hoch" && (
                    <span className="text-xs text-muted-foreground">
                      {t(`mappe.sicher.${v.sicher}`)}
                    </span>
                  )}
                </label>
                <Textarea
                  rows={v.wert.length > 120 ? 4 : 1}
                  value={werte[v.key] ?? v.wert}
                  onChange={(e) => setWerte({ ...werte, [v.key]: e.target.value })}
                  className="mt-1.5 text-sm"
                />
                {/* Wo es im Dokument steht — damit man nachschlagen kann,
                    statt dem Vorschlag glauben zu müssen. */}
                {v.fundstelle && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("mappe.fundstelle", { ort: v.fundstelle })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          {t("mappe.sprachfassung")}
          <select
            value={sprache}
            onChange={(e) => setSprache(e.target.value)}
            className="rounded-lg border border-border bg-background py-1 pl-2 pr-7 text-sm"
          >
            {SPRACHEN.map((s) => (
              <option key={s} value={s}>
                {t(`mappe.sprache.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {/* Standard: nur LEERE Felder füllen. Ein gepflegter Türcode ist die
            Wahrheit des Betriebs; ihn wegen eines alten PDFs zu ersetzen wäre
            Datenverlust ohne Rückfrage (Wurzel 1). */}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={ueberschreiben}
            onCheckedChange={(c) => setUeberschreiben(Boolean(c))}
          />
          {t("mappe.ueberschreiben")}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("mappe.ausgewaehlt", { count: gewaehlt.size, gesamt: items.length })}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onAbbrechen}>
            {t("mappe.verwerfen")}
          </Button>
          <Button
            type="button"
            disabled={uebernimmt || gewaehlt.size === 0}
            onClick={onBestaetigen}
          >
            {uebernimmt ? t("mappe.uebernimmt") : t("mappe.uebernehmen")}
          </Button>
        </div>
      </div>
    </div>
  );
}
