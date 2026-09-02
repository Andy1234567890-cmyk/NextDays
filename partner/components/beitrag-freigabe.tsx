"use client";

// Videofreigabe eines Beitrags (0523) — der Weg zum Link.
//
// Die Reihenfolge ist bewusst umgedreht: Video hochladen → wir prüfen → DANN
// erst gibt es den Link. Deshalb steht dieser Block dort, wo der Partner den
// Link erwartet, und erklärt in jedem der vier Zustände, wer gerade am Zug ist.
//
// Der Upload läuft über die BFF-Route (nicht über eine Server Action): eine
// 200-MB-Datei gehört nicht durch den Flight-Kanal.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { datumZeit } from "@/lib/format";
import type { Beitrag } from "@/lib/reichweite";

const MAX_BYTES = 200 * 1024 * 1024;

export function BeitragFreigabe({ beitrag }: { beitrag: Beitrag }) {
  const t = useTranslations("beitraege.freigabe");
  const locale = useLocale();
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  const stand = beitrag.review_status;

  async function hochladen(datei: File) {
    // Früh und verständlich abweisen: der Server prüft dasselbe noch einmal,
    // aber erst nach 200 MB Übertragung — das wäre eine unnötige Wartezeit.
    if (datei.size > MAX_BYTES) {
      toast.error(t("zuGross", { mb: MAX_BYTES / (1024 * 1024) }));
      return;
    }
    setLaeuft(true);
    try {
      const daten = new FormData();
      daten.append("datei", datei);
      const res = await fetch(`/api/beitraege/${beitrag.id}/video`, {
        method: "POST",
        body: daten,
      });
      if (res.ok) {
        toast.success(t("eingereicht"));
        router.refresh();
      } else {
        const text = await res.text();
        let meldung = t("fehler");
        try {
          const j = JSON.parse(text) as { detail?: string };
          if (j.detail) meldung = j.detail;
        } catch {
          // Keine JSON-Antwort (Proxy-Fehler, HTML-Fehlerseite) — dann bleibt
          // die allgemeine Meldung stehen, statt rohes HTML zu zeigen.
        }
        toast.error(meldung);
      }
    } catch {
      toast.error(t("fehler"));
    } finally {
      setLaeuft(false);
      if (feld.current) feld.current.value = "";
    }
  }

  const auswahl = (
    <>
      <input
        ref={feld}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) void hochladen(datei);
        }}
      />
      <button
        type="button"
        disabled={laeuft}
        onClick={() => feld.current?.click()}
        className="mt-2 flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
      >
        <Icon icon={laeuft ? "ph:spinner" : "ph:upload-simple"} className={`size-4 ${laeuft ? "animate-spin" : ""}`} />
        {laeuft ? t("laeuft") : stand === "rejected" ? t("neuHochladen") : t("hochladen")}
      </button>
    </>
  );

  if (stand === "approved") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon icon="ph:seal-check" className="size-4 shrink-0" />
        {t("freigegeben")}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      {stand === "submitted" ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon icon="ph:hourglass-medium" className="size-4 shrink-0" />
            {t("inPruefung")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {beitrag.video_uploaded_at
              ? t("eingereichtAm", { zeit: datumZeit(beitrag.video_uploaded_at, locale) })
              : t("inPruefungHinweis")}
          </p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon
              icon={stand === "rejected" ? "ph:warning-circle" : "ph:video"}
              className="size-4 shrink-0"
            />
            {stand === "rejected" ? t("abgelehnt") : t("videoNoetig")}
          </p>
          {stand === "rejected" && (beitrag.review_note || beitrag.review_reason_code) && (
            <p className="mt-1 rounded-lg bg-background px-3 py-2 text-xs">
              {beitrag.review_reason_code && (
                <span className="font-medium">{t(`grundKategorie.${beitrag.review_reason_code}`)} · </span>
              )}
              {t("grund")}: {beitrag.review_note}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{t("erklaerung")}</p>
          {auswahl}
        </>
      )}
    </div>
  );
}
