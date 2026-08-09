"use client";

// Wiederherstellungscodes: einmalige Anzeige nach dem Einrichten eines Faktors.
//
// Sicherheitsregel dieser Datei: die Codes verlassen den Bildschirm NUR über
// Kopieren/Herunterladen/Drucken, die der Nutzer selbst auslöst. Kein Logging,
// keine URL, kein History-Eintrag — der Download läuft über einen Blob, der
// direkt danach wieder freigegeben wird.
//
// Recherche: Nutzer dürfen die Einrichtung erst verlassen, wenn sie die Codes
// kopiert, geladen oder gedruckt haben; dazu eine ausdrückliche Bestätigung
// „ich habe sie gesichert" plus die Warnung vor der Aussperrung.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";

type Props = {
  codes: string[];
  /** Wird gerufen, wenn der Nutzer bestätigt hat und abschließen darf. */
  onFertig: () => void;
  /** Überschrift-Variante: frisch eingerichtet vs. neu erzeugt. */
  titel: string;
};

export function Wiederherstellungscodes({ codes, onFertig, titel }: Props) {
  const t = useTranslations("account.security.recovery");
  const [gesichert, setGesichert] = useState(false);
  // Erst nach Kopieren/Laden/Drucken darf bestätigt werden — verhindert das
  // achtlose Wegklicken, das später zur Aussperrung führt.
  const [ausgegeben, setAusgegeben] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const alsText = codes.join("\n");

  async function kopieren() {
    setFehler(null);
    try {
      await navigator.clipboard.writeText(alsText);
      setKopiert(true);
      setAusgegeben(true);
    } catch {
      // Kein stiller Ersatzweg: der Nutzer muss wissen, dass nichts kopiert
      // wurde, sonst verlässt er sich auf eine leere Zwischenablage.
      setFehler(t("copyFailed"));
    }
  }

  function herunterladen() {
    setFehler(null);
    try {
      const blob = new Blob([`${t("fileHeader")}\n\n${alsText}\n`], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mynextdays-wiederherstellungscodes.txt";
      a.click();
      // Objekt-URL sofort wieder freigeben, damit die Codes nicht als
      // erreichbare blob:-Adresse im Dokument weiterleben.
      URL.revokeObjectURL(url);
      setAusgegeben(true);
    } catch {
      setFehler(t("downloadFailed"));
    }
  }

  function drucken() {
    setFehler(null);
    const fenster = window.open("", "_blank", "noopener,noreferrer,width=600,height=700");
    if (!fenster) {
      setFehler(t("printBlocked"));
      return;
    }
    // Nur Text-Knoten schreiben (kein innerHTML mit Fremddaten): die Codes
    // kommen zwar vom eigenen Backend, werden aber trotzdem nicht als Markup
    // interpretiert.
    const doc = fenster.document;
    doc.title = t("printTitle");
    const h1 = doc.createElement("h1");
    h1.textContent = t("printTitle");
    const p = doc.createElement("p");
    p.textContent = t("printHint");
    const pre = doc.createElement("pre");
    pre.style.fontSize = "1rem";
    pre.style.lineHeight = "1.8";
    pre.textContent = alsText;
    doc.body.append(h1, p, pre);
    fenster.print();
    setAusgegeben(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">{titel}</p>

      <div
        className="flex items-start gap-2 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3"
        role="note"
      >
        <Icon
          icon="ph:warning"
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <p className="text-sm text-destructive">{t("lockoutWarning")}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 rounded-(--radius) border border-border p-3 font-mono text-sm tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={kopieren}>
          <Icon
            icon={kopiert ? "ph:check" : "ph:copy"}
            className="size-4"
            aria-hidden
          />
          {kopiert ? t("copied") : t("copy")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={herunterladen}>
          <Icon icon="ph:download-simple" className="size-4" aria-hidden />
          {t("download")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={drucken}>
          <Icon icon="ph:printer" className="size-4" aria-hidden />
          {t("print")}
        </Button>
      </div>

      <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-destructive">
        {fehler ?? ""}
      </p>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={gesichert}
          onCheckedChange={(c) => setGesichert(c === true)}
          disabled={!ausgegeben}
          aria-describedby="codes-bestaetigung-hinweis"
        />
        <span>{t("confirmSaved")}</span>
      </label>
      <p id="codes-bestaetigung-hinweis" className="text-xs text-muted-foreground">
        {ausgegeben ? t("confirmHint") : t("mustExportFirst")}
      </p>

      <Button type="button" onClick={onFertig} disabled={!gesichert}>
        {t("done")}
      </Button>
    </div>
  );
}
