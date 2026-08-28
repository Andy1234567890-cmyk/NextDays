"use client";

// „Alle Alt-Texte": Bilder und Symbole des Betriebs in einer Tabelle, mit dem
// Alternativtext als bearbeitbares Feld (0479).
//
// GESPEICHERT WIRD BEIM VERLASSEN DES FELDES, nicht per Knopf. Bei sechzig
// Zeilen wäre ein „Alle speichern"-Knopf am Seitenende die Einladung, ihn zu
// vergessen — und eine Zeile, die man getippt und nicht gespeichert hat, sieht
// genauso aus wie eine gespeicherte.
//
// ZWEI ABFRAGEN, NICHT EINE: Bilder und Symbole sind zwei Arten und werden
// serverseitig getrennt gefiltert. Sie hier zusammenzuführen ist billiger als
// eine Sammelabfrage „alles außer Videos, Audio und Dateien", die es nicht
// gibt — und die Reihenfolge (fehlende zuerst) entsteht ohnehin erst hier.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listMediaGefiltert, updateMedium } from "@/lib/site-medien";
import type { CustomDomain } from "@/lib/site-config";
import type { Medium, Page } from "@/lib/site-pages";

import { BaukastenRahmen } from "../rahmen";
import { MedienVorschau } from "./medien-vorschau";

export function AltTexteSeite({
  pages,
  domains,
}: {
  pages: Page[];
  domains: CustomDomain[];
}) {
  const t = useTranslations("website.mediathek");
  const [medien, setMedien] = useState<Medium[] | null>(null);

  const laden = useCallback(async () => {
    const [bilder, symbole] = await Promise.all([
      listMediaGefiltert({ art: "image", limit: 200, sortierung: "neueste" }),
      listMediaGefiltert({ art: "icon", limit: 200, sortierung: "neueste" }),
    ]);
    if (!bilder.ok) {
      toast.error(bilder.error);
      setMedien([]);
      return;
    }
    if (!symbole.ok) {
      toast.error(symbole.error);
      setMedien([]);
      return;
    }
    // Fehlende zuerst: das ist die Arbeitsliste. Wer die Seite öffnet, will
    // nicht durch sechzig ausgefüllte Zeilen scrollen, um die drei leeren zu
    // finden.
    const alle = [...bilder.data.items, ...symbole.data.items];
    alle.sort((a, b) => {
      const aLeer = a.alt_text ? 1 : 0;
      const bLeer = b.alt_text ? 1 : 0;
      return aLeer - bLeer;
    });
    setMedien(alle);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const offen = useMemo(
    () => (medien ?? []).filter((m) => !m.alt_text).length,
    [medien],
  );

  async function speichern(medium: Medium, wert: string) {
    const neu = wert.trim() || null;
    if (neu === (medium.alt_text ?? null)) return;
    const res = await updateMedium(medium.id, { alt_text: neu });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // NUR diese Zeile ersetzen und die Liste NICHT neu sortieren: eine Zeile,
    // die beim Tippen unter dem Zeiger wegspringt, ist der Grund, warum man
    // die nächste nicht mehr ausfüllt.
    setMedien((liste) =>
      (liste ?? []).map((m) => (m.id === medium.id ? res.data : m)),
    );
  }

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={
        <div className="flex h-full min-h-0 flex-col p-4 md:p-6">
          <div className="mb-4 shrink-0">
            <h1 className="font-display text-2xl font-extrabold">
              {t("altTexte.titel")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("altTexte.hinweis")}
            </p>
            {medien !== null ? (
              <p className="mt-2 text-sm font-medium">
                {offen === 0
                  ? t("altTexte.alleGesetzt")
                  : t("altTexte.offen", { anzahl: offen })}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-(--radius) border border-border">
            {medien === null ? (
              <p className="p-6 text-sm text-muted-foreground">{t("laedt")}</p>
            ) : medien.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("leer")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-14 px-3 py-2" />
                    <th className="w-1/3 px-2 py-2 font-medium">
                      {t("liste.name")}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t("details.altText")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medien.map((m) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="px-3 py-2">
                        <span className="flex size-10 items-center justify-center overflow-hidden rounded-(--radius) border border-border">
                          <MedienVorschau medium={m} className="size-10" />
                        </span>
                      </td>
                      <td className="max-w-0 px-2 py-2">
                        <span className="block truncate italic">
                          {m.filename ?? t("liste.ohneNamen")}
                        </span>
                        {!m.alt_text ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Icon icon="ph:warning" className="size-3.5" />
                            {t("details.altTextFehlt")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <AltFeld
                          medium={m}
                          platzhalter={t("details.altTextPlatzhalter")}
                          onSpeichern={(wert) => void speichern(m, wert)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      }
    />
  );
}

/** Ein Alt-Text-Feld mit eigenem Eingabezustand.
 *
 *  Eigene Komponente, weil der getippte Text NICHT im Elternzustand liegen
 *  darf: sonst würde jede Taste die ganze Tabelle neu zeichnen — bei
 *  vierhundert Zeilen sichtbar als Verzögerung beim Schreiben. */
function AltFeld({
  medium,
  platzhalter,
  onSpeichern,
}: {
  medium: Medium;
  platzhalter: string;
  onSpeichern: (wert: string) => void;
}) {
  const [wert, setWert] = useState(medium.alt_text ?? "");

  useEffect(() => {
    setWert(medium.alt_text ?? "");
  }, [medium.id, medium.alt_text]);

  return (
    <input
      value={wert}
      maxLength={300}
      placeholder={platzhalter}
      onChange={(e) => setWert(e.target.value)}
      onBlur={() => onSpeichern(wert)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-sm"
    />
  );
}
