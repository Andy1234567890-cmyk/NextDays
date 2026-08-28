"use client";

// Die Anfragen aus den Formularen der Website (0436, Etappe F).
//
// Eigener Reiter und kein Unterpunkt: es sind eingehende Nachrichten von
// Gästen, keine Einstellung. Wer sie sucht, sucht sie nicht unter „SEO" und
// nicht unter „Design".
//
// Zwei Dinge, die diese Ansicht bewusst NICHT tut:
//
//   · Kein Realtime-Abo. Die Tabelle hat für `authenticated` kein Grant (0436),
//     weil die Zeilen personenbezogene Daten Dritter enthalten — ein Abo würde
//     den Direktpfad öffnen. Die Liste lädt beim Öffnen; das ist der Preis, und
//     er ist richtig gewählt.
//   · Kein Papierkorb. Löschen löscht. Es sind personenbezogene Daten, und ein
//     Löschbegehren nach Art. 17 DSGVO muss zu einem echten Löschen führen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { zeitpunktLang } from "@/lib/chat-format";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type FormAnlage,
  type FormEinsendung,
  einsendungenAlsCsv,
  listFormAnlagen,
  loescheEinsendung,
  markiereEinsendungGelesen,
} from "@/lib/site-weiterleitungen";

/** Eine Größe in Kilo-/Megabyte. Keine Währung, keine Locale-Formatierung —
 *  „1,4 MB" liest sich in jeder Sprache. */
function groesse(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Die Anlagen einer Einsendung (0445).
 *
 *  Geladen wird ERST beim Aufklappen, und das ist keine Sparmaßnahme: die
 *  Adressen sind signiert und gelten fünf Minuten. Sie beim Laden der Liste zu
 *  holen hieße, für 50 Anfragen 50 Leseschlüssel zu erzeugen, von denen
 *  niemand einen benutzt — und die abgelaufen wären, sobald jemand die erste
 *  Anfrage öffnet.
 *
 *  Aus demselben Grund wird bei JEDEM Aufklappen neu geladen: eine zwischen-
 *  gespeicherte Adresse führt nach fünf Minuten ins Leere, und der Betrieb
 *  läse einen Fehler von Supabase statt seiner Datei. */
function Anlagen({ submissionId }: { submissionId: string }) {
  const t = useTranslations("website");
  const [stand, setStand] = useState<"laedt" | "da" | "fehler">("laedt");
  const [items, setItems] = useState<FormAnlage[]>([]);

  useEffect(() => {
    let abgebrochen = false;
    setStand("laedt");
    void listFormAnlagen(submissionId).then((res) => {
      if (abgebrochen) return;
      if (!res.ok) {
        setStand("fehler");
        return;
      }
      setItems(res.data.items);
      setStand("da");
    });
    return () => {
      abgebrochen = true;
    };
  }, [submissionId]);

  if (stand === "laedt") {
    return (
      <p className="text-xs text-muted-foreground">{t("anfragen.anlagenLaden")}</p>
    );
  }
  if (stand === "fehler") {
    return (
      <p className="text-xs text-destructive">{t("anfragen.anlagenFehler")}</p>
    );
  }
  // Kein „Keine Anlagen"-Satz: die allermeisten Formulare haben gar kein
  // Datei-Feld, und eine Zeile, die bei jeder Anfrage dasselbe Nichts meldet,
  // ist Lärm.
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground">
        {t("anfragen.anlagen")}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <Icon
              icon={a.mime === "application/pdf" ? "ph:file-pdf" : "ph:image"}
              className="size-4 shrink-0 text-muted-foreground"
            />
            {a.url ? (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate underline"
              >
                {a.name}
              </a>
            ) : (
              // Kein Link ins Leere: die Signatur ist fehlgeschlagen, und ein
              // Link, der einen Fehler von Supabase zeigt, ist schlechter als
              // gar keiner (Wurzel 4).
              <span className="truncate" title={t("anfragen.anlageOhneLink")}>
                {a.name}
              </span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {groesse(a.groesse)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnfragenListe({ items }: { items: FormEinsendung[] }) {
  const t = useTranslations("website");
  const locale = useLocale();
  const [offen, setOffen] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  async function exportiere() {
    const csv = await einsendungenAlsCsv(items);
    // Der Download entsteht im Browser aus einem Blob: die Datei existiert nur
    // hier und wandert nicht über einen Server-Endpunkt, den jemand erraten
    // könnte.
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anfragen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <p className="rounded-(--radius) border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("anfragen.keine")}
        </p>
      </div>
    );
  }

  const ungelesen = items.filter((e) => !e.is_read).length;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {t("anfragen.titel")}
          </h1>
          <p className="pt-1 text-sm text-muted-foreground">
            {ungelesen > 0
              ? t("anfragen.ungelesen", { anzahl: ungelesen })
              : t("anfragen.alleGelesen")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportiere()}
          className="rounded-(--radius) border border-border px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
        >
          {t("anfragen.csvExport")}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((e) => {
          const istOffen = offen === e.id;
          // Die erste ausgefüllte Antwort als Vorschau. Welches Feld das ist,
          // hängt am Formular des Betriebs — deshalb der erste nicht-leere Wert
          // und kein festes „Name" oder „E-Mail", das es nicht geben muss.
          const vorschau =
            Object.values(e.daten).find((v) => v.trim()) ?? "";
          return (
            <li
              key={e.id}
              className={
                "rounded-(--radius) border " +
                (e.is_read ? "border-border" : "border-foreground/40 bg-secondary/40")
              }
            >
              <button
                type="button"
                onClick={() => {
                  setOffen(istOffen ? null : e.id);
                  // Beim ÖFFNEN als gelesen markieren, nicht beim Laden der
                  // Liste: sonst wäre alles gelesen, sobald jemand die Seite
                  // aufruft.
                  if (!istOffen && !e.is_read) {
                    starte(async () => {
                      await markiereEinsendungGelesen(e.id);
                    });
                  }
                }}
                aria-expanded={istOffen}
                className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {e.form_name || t("anfragen.ohneName")}
                  </p>
                  <p className="truncate pt-1 text-sm text-muted-foreground">
                    {vorschau}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {/* Über den vorhandenen Helfer und MIT Locale: ohne
                      Argument formatiert Node anders als der Browser, und
                      React verwirft den Teilbaum (Hydration-Fehler, B6). */}
                  {e.created_at ? zeitpunktLang(e.created_at, locale) : ""}
                </span>
              </button>

              {istOffen ? (
                <div className="flex flex-col gap-3 border-t border-border p-4">
                  <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                    {Object.entries(e.daten).map(([k, v]) => (
                      <div key={k} className="contents">
                        {/* Der Feldname als Schlüssel: er steht so im
                            Formular-Editor und im CSV-Export. Ihn hier zu
                            übersetzen wäre unmöglich — der Betrieb hat ihn
                            selbst benannt. */}
                        <dt className="font-mono text-xs text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="whitespace-pre-line text-sm">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Anlagen submissionId={e.id} />
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() =>
                      starte(async () => {
                        const res = await loescheEinsendung(e.id);
                        if (!res.ok) toast.error(res.error);
                        else toast.success(t("anfragen.geloescht"));
                      })
                    }
                    className="flex items-center gap-2 self-start rounded-(--radius) border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-secondary disabled:opacity-40"
                  >
                    <Icon icon="ph:trash" className="size-3.5" />
                    {t("anfragen.loeschen")}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
