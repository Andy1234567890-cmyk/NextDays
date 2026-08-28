"use client";

// SEO/AEO → Weiterleitungen (0430).
//
// Wozu: zieht ein Betrieb von Wix, WordPress oder Lodgify zu uns, sind seine
// alten Adressen in Google, in Newslettern und auf Portalseiten verlinkt. Ohne
// Weiterleitung landet jeder dieser Besucher auf einer Fehlerseite, und die
// Platzierung, die über Jahre entstanden ist, verfällt.
//
// Die Oberfläche nimmt dem Kunden die Formfehler ab, an denen es bei Hostaway
// scheitert (deren Fehlersuche listet sieben Ursachen, fünf davon sind
// Formfehler): eine ganze Adresse wird zum Pfad gekürzt, ein Schluss-Schrägstrich
// entfernt, Großschreibung angeglichen. Was NICHT geraten wird, ist eine fremde
// Domain als Quelle — die kann diese Website nicht weiterleiten, und sie
// stillschweigend als Pfad zu deuten wäre falsch.
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type RedirectType,
  type Weiterleitung,
  addWeiterleitung,
  csvZuWeiterleitungen,
  importWeiterleitungen,
  removeWeiterleitung,
  updateWeiterleitung,
} from "@/lib/site-weiterleitungen";

import { BereichsKopf } from "../bereichs-kopf";

/** Höchstgröße einer Importdatei. 200 Zeilen à 200 Zeichen sind 40 KB; 200 KB
 *  ist großzügig und hält gleichzeitig eine versehentlich gewählte Bilddatei
 *  vom Server fern (Wurzel 8 — jeder unbegrenzte Bereich braucht eine Grenze). */
const MAX_CSV_BYTES = 200 * 1024;

/** Was der Kunde tippt → was gespeichert wird.
 *
 *  Dieselbe Normalisierung wie im Backend (`_validate_source_path`). Sie steht
 *  hier ZUSÄTZLICH und nicht STATT dort: der Server ist die Kontrolle, diese
 *  Fassung ist die Rückmeldung. Der Kunde soll sehen, was gespeichert wird,
 *  bevor er klickt — nicht danach eine korrigierte Zeile in der Liste finden
 *  und sich fragen, warum sie anders aussieht. */
function pfadVorschau(eingabe: string): string {
  let v = eingabe.trim();
  if (/^https?:\/\//i.test(v)) {
    // Ganze Adresse eingefügt: den Pfad herausziehen. Das ist der häufigste
    // Fall, weil der Kunde die Adresse aus seinem Browser kopiert.
    try {
      v = new URL(v).pathname;
    } catch {
      return eingabe.trim();
    }
  }
  v = v.split("?")[0]!.split("#")[0]!.trim().toLowerCase();
  if (!v.startsWith("/")) v = `/${v}`;
  if (v.length > 1) v = v.replace(/\/+$/, "") || "/";
  return v;
}

export function SeoWeiterleitungenListe({
  weiterleitungen,
}: {
  weiterleitungen: Weiterleitung[];
}) {
  const t = useTranslations("website");
  const [quelle, setQuelle] = useState("");
  const [ziel, setZiel] = useState("");
  const [typ, setTyp] = useState<RedirectType>("301");
  const [laeuft, starte] = useTransition();
  const dateiFeld = useRef<HTMLInputElement>(null);

  const vorschau = quelle.trim() ? pfadVorschau(quelle) : "";
  const abweichend = Boolean(vorschau) && vorschau !== quelle.trim();
  const fremdeDomain = /^https?:\/\//i.test(quelle.trim());

  function anlegen() {
    if (!quelle.trim() || !ziel.trim()) return;
    starte(async () => {
      const res = await addWeiterleitung({
        source_path: pfadVorschau(quelle),
        target: ziel.trim(),
        redirect_type: typ,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setQuelle("");
      setZiel("");
      toast.success(t("seo.weiterleitungen.angelegt"));
    });
  }

  function csvWaehlen(datei: File) {
    if (datei.size > MAX_CSV_BYTES) {
      toast.error(t("seo.weiterleitungen.dateiZuGross"));
      return;
    }
    starte(async () => {
      const text = await datei.text();
      const zeilen = await csvZuWeiterleitungen(text);
      if (zeilen.length === 0) {
        toast.error(t("seo.weiterleitungen.dateiLeer"));
        return;
      }
      const res = await importWeiterleitungen(zeilen);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Das Ergebnis wird nach WIRKUNG gemeldet, nicht als eine Zahl:
      // „12 importiert" verschweigt, dass acht davon nichts geändert haben.
      const { created, updated, skipped, errors } = res.data;
      toast.success(
        t("seo.weiterleitungen.importErgebnis", {
          neu: created,
          geaendert: updated,
          uebersprungen: skipped,
        }),
      );
      // Die Fehlerzeilen einzeln, mit Zeilennummer — sonst weiß niemand,
      // welche Zeile der Datei zu korrigieren ist. Höchstens fünf, damit die
      // Meldungen nicht den Bildschirm füllen; die Zahl steht oben.
      for (const fehler of errors.slice(0, 5)) toast.error(fehler);
      if (errors.length > 5) {
        toast.error(
          t("seo.weiterleitungen.weitereFehler", {
            anzahl: errors.length - 5,
          }),
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <BereichsKopf
        titel={t("seo.weiterleitungen.titel")}
        beschreibung={t("seo.weiterleitungen.hinweis")}
      />

      <section className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
        <h2 className="font-display text-base font-extrabold">
          {t("seo.weiterleitungen.neuTitel")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {t("seo.weiterleitungen.quelle")}
            </span>
            <input
              type="text"
              value={quelle}
              onChange={(e) => setQuelle(e.target.value)}
              placeholder="/alte-seite"
              maxLength={500}
              className="w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {t("seo.weiterleitungen.ziel")}
            </span>
            <input
              type="text"
              value={ziel}
              onChange={(e) => setZiel(e.target.value)}
              placeholder="/neue-seite"
              maxLength={2000}
              className="w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("seo.weiterleitungen.typ")}</span>
            <select
              value={typ}
              onChange={(e) => setTyp(e.target.value as RedirectType)}
              className="rounded-(--radius) border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
            >
              <option value="301">{t("seo.weiterleitungen.typ301")}</option>
              <option value="302">{t("seo.weiterleitungen.typ302")}</option>
            </select>
          </label>
        </div>

        {/* Was WIRKLICH gespeichert wird — bevor geklickt wird. */}
        {abweichend && !fremdeDomain ? (
          <p className="text-xs text-muted-foreground">
            {t("seo.weiterleitungen.wirdGespeichert")}{" "}
            <span className="font-mono">{vorschau}</span>
          </p>
        ) : null}
        {fremdeDomain ? (
          <p className="text-xs text-muted-foreground">
            {t("seo.weiterleitungen.nurPfad")}{" "}
            <span className="font-mono">{vorschau}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!quelle.trim() || !ziel.trim() || laeuft}
            onClick={anlegen}
            className="rounded-(--radius) bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40"
          >
            {t("seo.weiterleitungen.anlegen")}
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => dateiFeld.current?.click()}
            className="rounded-(--radius) border border-border px-4 py-2 text-sm font-semibold transition hover:bg-secondary disabled:opacity-40"
          >
            {t("seo.weiterleitungen.csvImport")}
          </button>
          <input
            ref={dateiFeld}
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0];
              // Das Feld leeren, damit dieselbe Datei ein zweites Mal gewählt
              // werden kann — sonst löst der Browser kein `change` aus, und der
              // Kunde hält den Import für kaputt.
              e.target.value = "";
              if (datei) csvWaehlen(datei);
            }}
          />
          <span className="text-xs text-muted-foreground">
            {t("seo.weiterleitungen.csvFormat")}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("seo.weiterleitungen.listeTitel")}
        </h2>
        {weiterleitungen.length === 0 ? (
          <p className="rounded-(--radius) border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("seo.weiterleitungen.keine")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {weiterleitungen.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border px-4 py-3"
              >
                <div className="min-w-0 font-mono text-sm">
                  <span className={w.is_active ? "" : "line-through opacity-60"}>
                    {w.source_path}
                  </span>
                  <span className="px-2 text-muted-foreground">→</span>
                  <span className="break-all">{w.target}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {w.redirect_type === "301"
                      ? t("seo.weiterleitungen.typ301Kurz")
                      : t("seo.weiterleitungen.typ302Kurz")}
                  </span>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() =>
                      starte(async () => {
                        const res = await updateWeiterleitung(w.id, {
                          is_active: !w.is_active,
                        });
                        if (!res.ok) toast.error(res.error);
                      })
                    }
                    className="rounded-(--radius) border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-secondary disabled:opacity-40"
                  >
                    {w.is_active
                      ? t("seo.weiterleitungen.deaktivieren")
                      : t("seo.weiterleitungen.aktivieren")}
                  </button>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() =>
                      starte(async () => {
                        const res = await removeWeiterleitung(w.id);
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success(t("seo.weiterleitungen.geloescht"));
                      })
                    }
                    className="rounded-(--radius) border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-secondary disabled:opacity-40"
                  >
                    {t("seo.weiterleitungen.loeschen")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Die eine Regel, die man kennen muss. Sie steht unter der Liste, weil
            sie erst zählt, wenn eine Weiterleitung nicht greift — und dann sucht
            man genau hier. */}
        <p className="text-xs text-muted-foreground">
          {t("seo.weiterleitungen.vorrangHinweis")}
        </p>
      </section>
    </div>
  );
}
