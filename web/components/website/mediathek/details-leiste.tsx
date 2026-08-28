"use client";

// Die Detail-/Pflegeleiste: alles zu EINEM Bild, rechts neben der Kachelwand.
//
// Sie ist der Ort für alles, was das Bild selbst betrifft — Alt-Text,
// Bearbeiten, Ersetzen, Löschen — und trägt die einzige Handlung, die den
// Dialog schließt: „Bild verwenden". Ohne diesen Knopf gäbe es in der
// Detailansicht keinen Weg zurück zum Bildfeld außer dem Doppelklick auf die
// Kachel, den ein Kunde nicht von selbst findet.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import type { Medium } from "@/lib/site-pages";

import { kiAltText, kiAltTextHerkunftSetzen } from "@/lib/site-ki";
import {
  type MediaOrdner,
  type MediaVerwendung,
  mediumVerwendung,
  updateMedium,
} from "@/lib/site-medien";
import { useKi } from "../ki/ki-context";
import { MedienVorschau } from "./medien-vorschau";

export function DetailsLeiste({
  medium,
  ordner,
  sprache,
  onSchliesse,
  onWaehle,
  onAktualisiert,
  onBearbeiten,
  onErsetzenAnfragen,
  onLoeschenAnfragen,
  mitVerwenden,
}: {
  medium: Medium;
  ordner: MediaOrdner[];
  /** Sprache des Dashboards — die Mediathek ist seitenübergreifend, es gibt
   *  keine „Fassungssprache" wie beim Texteditor. */
  sprache: string;
  onSchliesse: () => void;
  onWaehle: (m: Medium) => void;
  onAktualisiert: (m: Medium) => void;
  onBearbeiten: () => void;
  onErsetzenAnfragen: () => void;
  onLoeschenAnfragen: () => void;
  /** `false` in der Verwaltungsansicht: dort gibt es kein Bildfeld, in das
   *  „Verwenden" das Medium einsetzen könnte. */
  mitVerwenden: boolean;
}) {
  const t = useTranslations("website.mediathek");
  const { verfuegbar: kiVerfuegbar } = useKi();
  const [altText, setAltText] = useState(medium.alt_text ?? "");
  const [benenntUm, setBenenntUm] = useState(false);
  const [neuerName, setNeuerName] = useState(medium.filename ?? "");
  const [speichertAlt, setSpeichertAlt] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [verwendung, setVerwendung] = useState<
    MediaVerwendung[] | null | "fehler"
  >(null);

  useEffect(() => {
    setAltText(medium.alt_text ?? "");
  }, [medium.id, medium.alt_text]);

  useEffect(() => {
    let lebt = true;
    setVerwendung(null);
    void mediumVerwendung(medium.id).then((res) => {
      if (!lebt) return;
      setVerwendung(res.ok ? res.data.items : "fehler");
    });
    return () => {
      lebt = false;
    };
  }, [medium.id]);

  async function altTextSpeichern() {
    const wert = altText.trim() || null;
    if (wert === (medium.alt_text ?? null)) return;
    setSpeichertAlt(true);
    const res = await updateMedium(medium.id, { alt_text: wert });
    setSpeichertAlt(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAktualisiert(res.data);
    toast.success(t("details.altTextGespeichert"));
  }

  async function kiVorschlag() {
    setKiLaeuft(true);
    const res = await kiAltText({ medium_id: medium.id, sprache });
    setKiLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAltText(res.data.alt_text);
    const gespeichert = await updateMedium(medium.id, {
      alt_text: res.data.alt_text,
    });
    if (gespeichert.ok) {
      onAktualisiert(gespeichert.data);
      // Herkunft NACH dem erfolgreichen Speichern setzen — sonst könnte eine
      // Zeile „ai_generated" tragen, deren Text nie ankam.
      void kiAltTextHerkunftSetzen({
        medium_id: medium.id,
        herkunft: "ai_generated",
      });
    }
    if (res.data.warnungen.length > 0) {
      res.data.warnungen.forEach((w) => toast.warning(w));
    }
  }

  async function ordnerAendern(neuerOrdner: string) {
    const res = await updateMedium(medium.id, {
      folder_id: neuerOrdner || null,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAktualisiert(res.data);
  }

  async function namenSpeichern() {
    const wert = neuerName.trim() || null;
    setBenenntUm(false);
    if (wert === (medium.filename ?? null)) return;
    const res = await updateMedium(medium.id, { filename: wert });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAktualisiert(res.data);
    toast.success(t("details.umbenannt"));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {/* Kopf wie im Vorbild (Punkt 11): links die ART des Mediums, rechts der
          Ausweg aus der Detailansicht — als Wort und nicht als ✕, weil „✕" im
          Dialog schon „Fenster schließen" bedeutet und hier nur die Auswahl
          aufgehoben wird. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`art.${medium.kind}`)}
        </h3>
        <button
          type="button"
          onClick={onSchliesse}
          className="text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
        >
          {t("details.auswahlAufheben")}
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="overflow-hidden rounded-(--radius) border border-border bg-secondary/40">
          <MedienVorschau medium={medium} gross />
        </div>

        {/* Name und Maße als BESCHRIFTETE Angaben, nicht als nackte Zeile:
            „1920 × 1080" allein ist eine Zahl, über die man rät. */}
        <dl className="flex flex-col gap-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-muted-foreground">
              {t("details.name")}
            </dt>
            <dd className="min-w-0 flex-1">
              <a
                href={medium.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all italic underline underline-offset-2"
              >
                {medium.filename ?? t("liste.ohneNamen")}
              </a>
            </dd>
          </div>
          {medium.width && medium.height ? (
            <div className="flex items-center gap-1.5">
              <dt className="shrink-0 text-muted-foreground">
                {t("details.groesse")}
              </dt>
              <dd className="flex items-center gap-1 italic">
                {t("details.masse", { b: medium.width, h: medium.height })}
                <span
                  title={t("details.masseHinweis")}
                  className="text-muted-foreground"
                >
                  <Icon icon="ph:question" className="size-3.5" />
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Umbenennen betrifft NUR die Anzeige: der Pfad im Speicher ist ein
            Zufallstoken, und die Adresse des Bildes ändert sich nicht. Deshalb
            ist es hier gefahrlos und braucht keine Rückfrage. */}
        {benenntUm ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={neuerName}
              maxLength={200}
              onChange={(e) => setNeuerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void namenSpeichern();
                if (e.key === "Escape") setBenenntUm(false);
              }}
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="button"
              aria-label={t("details.umbenennenSpeichern")}
              onClick={() => void namenSpeichern()}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon icon="ph:check" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("ordner.abbrechen")}
              onClick={() => setBenenntUm(false)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNeuerName(medium.filename ?? "");
              setBenenntUm(true);
            }}
            className="self-start rounded-full border border-border px-3 py-1 text-xs font-medium transition hover:bg-secondary"
          >
            {t("details.umbenennen")}
          </button>
        )}

        {mitVerwenden ? (
          <Button onClick={() => onWaehle(medium)} className="w-full">
            <Icon icon="ph:check-circle" className="mr-1.5 size-4" />
            {t("details.verwenden")}
          </Button>
        ) : null}

        {medium.source !== "upload" && medium.credit_name ? (
          <p className="rounded-(--radius) bg-secondary/60 px-2.5 py-2 text-xs text-muted-foreground">
            {t("details.stockHinweis", {
              anbieter: t(`details.herkunft.${medium.source}`),
              fotograf: medium.credit_name,
            })}
          </p>
        ) : null}

        {/* --- Alt-Text ----------------------------------------------------- */}
        {/* Nur Bilder und Symbole. Ein Video oder eine PDF hat keinen
            Alternativtext — ein leeres Feld dafür wäre eine Aufgabe, die
            niemand erledigen kann. */}
        {medium.kind === "image" || medium.kind === "icon" ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="mediathek-alt-text" className="text-xs font-medium">
              {t("details.altText")}
            </label>
            {kiVerfuegbar ? (
              <button
                type="button"
                disabled={kiLaeuft}
                onClick={() => void kiVorschlag()}
                className="flex items-center gap-1 text-xs font-medium text-(--brand) transition hover:opacity-80 disabled:opacity-50"
              >
                <Icon
                  icon={kiLaeuft ? "svg-spinners:180-ring" : "solar:magic-stick-3-linear"}
                  className="size-3.5"
                />
                {t("details.altTextVorschlag")}
              </button>
            ) : null}
          </div>
          <textarea
            id="mediathek-alt-text"
            value={altText}
            maxLength={300}
            rows={3}
            placeholder={t("details.altTextPlatzhalter")}
            onChange={(e) => setAltText(e.target.value)}
            onBlur={() => void altTextSpeichern()}
            className="w-full resize-none rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-sm"
          />
          {speichertAlt ? (
            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {t("details.speichertAltText")}
            </p>
          ) : null}
        </div>
        ) : null}

        {/* --- Ordner --------------------------------------------------------- */}
        <div>
          <label htmlFor="mediathek-ordner" className="mb-1 block text-xs font-medium">
            {t("details.ordner")}
          </label>
          <select
            id="mediathek-ordner"
            value={medium.folder_id ?? ""}
            onChange={(e) => void ordnerAendern(e.target.value)}
            className="w-full rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-sm"
          >
            <option value="">{t("ordner.wurzel")}</option>
            {ordner.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* --- Handlungen ------------------------------------------------------ */}
        <div className="flex flex-wrap gap-2">
          {medium.source === "upload" && medium.kind === "image" ? (
            <ActionKnopf
              icon="ph:pencil-simple"
              label={t("details.bearbeiten")}
              onClick={onBearbeiten}
            />
          ) : null}
          <ActionKnopf
            icon="ph:arrows-left-right"
            label={t("details.ersetzen")}
            onClick={onErsetzenAnfragen}
          />
          <ActionKnopf
            icon="ph:trash"
            label={t("details.loeschen")}
            destruktiv
            onClick={onLoeschenAnfragen}
          />
        </div>

        {/* --- Verwendung --------------------------------------------------- */}
        <div>
          <p className="mb-1 text-xs font-medium">{t("details.verwendungTitel")}</p>
          {verwendung === null ? (
            <p className="text-xs text-muted-foreground">{t("details.verwendungLaedt")}</p>
          ) : verwendung === "fehler" ? (
            <p className="text-xs text-muted-foreground">{t("details.verwendungFehler")}</p>
          ) : verwendung.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("details.verwendungLeer")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {verwendung.map((v, i) => (
                <li
                  key={`${v.kind}-${v.block_id ?? v.page_id ?? v.field ?? i}`}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <Icon
                    icon={
                      v.kind === "code" ? "ph:warning" : "ph:map-pin-simple-area"
                    }
                    className={
                      "mt-0.5 size-3 shrink-0 " +
                      (v.kind === "code" ? "text-amber-600" : "")
                    }
                  />
                  <span>
                    {v.kind === "block"
                      ? t("details.verwendungBlock", {
                          typ: v.block_type ?? "",
                          seite: v.page_title || t("details.verwendungOhneTitel"),
                        })
                      : v.kind === "page"
                        ? t("details.verwendungSeite", {
                            seite: v.page_title || t("details.verwendungOhneTitel"),
                          })
                        : v.kind === "branding"
                          ? t("details.verwendungBranding", { feld: v.field ?? "" })
                          : t("details.verwendungCode", { feld: v.field ?? "" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionKnopf({
  icon,
  label,
  onClick,
  destruktiv = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  destruktiv?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (destruktiv
          ? "border-border text-destructive hover:bg-destructive/10"
          : "border-border hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-3.5" />
      {label}
    </button>
  );
}
