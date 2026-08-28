"use client";

// Die Zusammenfassung einer Regel (0440).
//
// Aufbau wörtlich wie bei Duda: „Triggered by" · „The action" · „Display rule",
// jeder Block mit eigenem Bearbeiten-Knopf. Der Grund für diese Dreiteilung ist
// gut: eine Regel besteht aus drei Entscheidungen, die man einzeln ändern will
// — wer die Uhrzeit korrigiert, will nicht durch die Aktion durch.
//
// Was hier NICHT steht: eine Vorschau. Duda hat eine, und sie ist dort auch
// nötig, weil eine Regel bei ihm nicht auf mehrsprachigen und dynamischen
// Seiten läuft — man muss sie im Editor testen. Bei uns läuft sie überall;
// gezeigt wird sie deshalb dort, wo sie hingehört: auf der Website selbst.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Regel, RegelStatus } from "@/lib/site-regeln";

/** Ein Wert-Paar in der Zusammenfassung. */
function Zeile({ titel, wert }: { titel: string; wert: string }) {
  return (
    <div className="py-2">
      <p className="text-sm text-muted-foreground">{titel}</p>
      <p className="text-sm font-medium">{wert}</p>
    </div>
  );
}

export function RegelZusammenfassung({
  regel,
  seiten,
  ortVerfuegbar,
  pending,
  onBearbeiten,
  onStatus,
  onLoeschen,
}: {
  regel: Regel;
  seiten: Array<{ slug: string; title: string }>;
  ortVerfuegbar: boolean;
  pending: boolean;
  onBearbeiten: () => void;
  onStatus: (status: RegelStatus) => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website");
  const a = regel.triggers ?? {};

  /** Die Bedingungen als lesbare Zeilen. Leer = „immer". */
  const bedingungen: Array<{ titel: string; wert: string }> = [];
  if (a.geraet) {
    bedingungen.push({
      titel: t("regeln.ausloeser.geraet"),
      wert: t(`regeln.geraet.${a.geraet}`),
    });
  }
  if (a.zeit) {
    const z = a.zeit;
    const spanne = z.ganztags === false && z.von && z.bis
      ? `${z.von}–${z.bis}`
      : t("regeln.ganztags");
    const zeitraum = [z.start_datum, z.end_datum].filter(Boolean).join(" – ");
    bedingungen.push({
      titel: t("regeln.ausloeser.zeit"),
      wert: [
        spanne,
        zeitraum,
        z.wiederholung && z.wiederholung !== "keine"
          ? t(`regeln.wiederholung.${z.wiederholung}`)
          : "",
        z.zeitzone,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (a.besuche) {
    bedingungen.push({
      titel: t("regeln.ausloeser.besuche"),
      wert:
        a.besuche.modus === "first"
          ? t("regeln.besuche.erst")
          : t("regeln.besuche.ab", { anzahl: a.besuche.anzahl ?? 2 }),
    });
  }
  if (a.ort) {
    bedingungen.push({
      titel: t("regeln.ausloeser.ort"),
      wert: [a.ort.ort, a.ort.land, `${a.ort.radius_km ?? 50} km`]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (a.kampagne) {
    bedingungen.push({
      titel: t("regeln.ausloeser.kampagne"),
      wert: Object.entries(a.kampagne.parameter || {})
        .map(([k, v]) => `${k}=${v}`)
        .join(" & "),
    });
  }

  const zielseiten = regel.seiten.length
    ? regel.seiten
        .map((s) => seiten.find((p) => p.slug === s)?.title || `/${s}`)
        .join(", ")
    : t("regeln.alleSeiten");

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-lg font-semibold">{regel.name}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onBearbeiten}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary disabled:opacity-50"
          >
            {t("regeln.bearbeiten")}
          </button>
          {regel.status === "active" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onStatus("disabled")}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary disabled:opacity-50"
            >
              {t("regeln.abschalten")}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => onStatus("active")}
              className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {t("regeln.scharfschalten")}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onLoeschen}
            aria-label={t("regeln.loeschen")}
            className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-destructive disabled:opacity-50"
          >
            <Icon icon="ph:trash" className="size-4" />
          </button>
        </div>
      </div>

      <section className="mt-4 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">{t("regeln.ausgeloestDurch")}</h3>
        {bedingungen.length === 0 ? (
          <Zeile titel={t("regeln.ausloeser.keiner")} wert={t("regeln.immer")} />
        ) : (
          bedingungen.map((b) => (
            <Zeile key={b.titel} titel={b.titel} wert={b.wert} />
          ))
        )}
        {a.ort && !ortVerfuegbar ? (
          // Kein Geo-Dienst: die Regel RUHT. Das gehört hierher und nicht in
          // eine Fußnote — sonst sucht der Betrieb den Fehler bei sich.
          <p className="mt-2 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            {t("regeln.ortRuht")}
          </p>
        ) : null}
      </section>

      <section className="mt-3 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">{t("regeln.dieAktion")}</h3>
        <Zeile
          titel={t(`regeln.aktion.${regel.action_type}`)}
          wert={aktionsText(regel, t)}
        />
        <Zeile titel={t("regeln.zielseiten")} wert={zielseiten} />
      </section>

      <section className="mt-3 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">{t("regeln.anzeigeregel")}</h3>
        <Zeile
          titel={t("regeln.haeufigkeit")}
          wert={
            regel.wieder_nach_tagen
              ? t("regeln.wiederNach", { tage: regel.wieder_nach_tagen })
              : regel.einmal_je_besucher
                ? t("regeln.einmalBesucher")
                : t("regeln.einmalSitzung")
          }
        />
      </section>
    </div>
  );
}

/** Die Aktion als ein Satz. */
function aktionsText(
  regel: Regel,
  t: ReturnType<typeof useTranslations<"website">>,
): string {
  const a = regel.action as Record<string, unknown>;
  if (regel.action_type === "effect") {
    const dauer = Number(a.dauer_sekunden ?? 15);
    return [
      t(`regeln.effekt.${String(a.effekt ?? "schnee")}`),
      dauer === 0 ? t("regeln.ohneEnde") : t("regeln.sekunden", { n: dauer }),
    ].join(" · ");
  }
  if (regel.action_type === "top_bar") {
    const text = (a.text ?? {}) as Record<string, string>;
    return Object.values(text).find((v) => v) || "—";
  }
  if (regel.action_type === "script") {
    const code = String(a.code ?? "");
    return t("regeln.zeichenCode", { n: code.length });
  }
  const zeitpunkt = String(a.zeitpunkt ?? "sofort");
  const wert = a.wert == null ? "" : String(a.wert);
  return [
    t(`regeln.zeitpunkt.${zeitpunkt}`),
    wert && zeitpunkt === "verzoegert" ? t("regeln.sekunden", { n: Number(wert) }) : "",
    wert && zeitpunkt === "scroll" ? `${wert} %` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
