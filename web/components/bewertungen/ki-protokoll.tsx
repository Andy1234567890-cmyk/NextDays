"use client";

// Protokoll der Bewertungs-KI — was sie getan hat, sichtbar für den Betrieb.
//
// Warum es das gibt: am 05.09.2026 gingen zwölf KI-Antworten öffentlich an
// Booking.com, und niemand konnte in der Oberfläche sehen, dass die KI
// überhaupt gelaufen war, was sie geschrieben hatte und ob es raus war. Die
// Spur lag in `review_ki_protokoll`, ohne Ansicht. Jede Zeile hier ist ein
// Lauf: Richtung, Gast, Kanal, Note, Zustellart samt Grund, Stand in der
// Warteschlange, Zeitpunkt des Versands — aufgeklappt Eingabe, Ergebnis und
// die Katalogfragen, die den Text getragen haben.
//
// Kein Realtime: die Tabelle ist für authenticated bewusst gesperrt
// (Wurzel 6, 0549), ein Abo wäre eine Attrappe. Stattdessen „Aktualisieren".
import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabel } from "@/lib/channel-logos";
import {
  type KiProtokollEintrag,
  type KiRichtung,
  getKiProtokoll,
} from "@/lib/reviews";
import { formatDateTime } from "@/lib/utils";

export function KiProtokoll({ initial }: { initial: KiProtokollEintrag[] }) {
  const t = useTranslations("reviews");
  const [items, setItems] = useState(initial);
  const [richtung, setRichtung] = useState<KiRichtung | "">("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function laden(r: KiRichtung | "" = richtung) {
    setFehler(null);
    start(async () => {
      const res = await getKiProtokoll(r || undefined, 100);
      if (res.ok) setItems(res.data.items);
      else setFehler(res.error);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("kiProtokollTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("kiProtokollHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            value={richtung}
            onChange={(e) => {
              const r = e.target.value as KiRichtung | "";
              setRichtung(r);
              laden(r);
            }}
          >
            <option value="">{t("kiProtokollAll")}</option>
            <option value="antwort">{t("kiDirectionReply")}</option>
            <option value="gast_bewerten">{t("kiDirectionRateGuest")}</option>
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => laden()} disabled={pending}>
            <Icon icon="ph:arrows-clockwise" className="size-4" />
            {t("kiProtokollRefresh")}
          </Button>
        </div>
      </div>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("kiProtokollEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((e) => (
            <Zeile key={e.id} eintrag={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Zeile({ eintrag }: { eintrag: KiProtokollEintrag }) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const test = eintrag.quelle === "test";

  return (
    <li className="flex flex-col gap-2 py-3">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left text-sm"
        aria-expanded={offen}
      >
        <Icon
          icon={offen ? "ph:caret-down" : "ph:caret-right"}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="text-muted-foreground tabular-nums">
          {eintrag.created_at ? formatDateTime(eintrag.created_at, locale) : "–"}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {eintrag.richtung === "antwort"
            ? t("kiDirectionReply")
            : t("kiDirectionRateGuest")}
        </span>
        {test && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {t("kiProtokollSourceTest")}
          </span>
        )}
        {eintrag.kanal && <span className="font-medium">{channelLabel(eintrag.kanal)}</span>}
        {eintrag.gast_name && <span>{eintrag.gast_name}</span>}
        {eintrag.objekt_titel && (
          <span className="text-muted-foreground">· {eintrag.objekt_titel}</span>
        )}
        {eintrag.note != null && (
          <span className="flex items-center gap-0.5 text-amber-500">
            <Icon icon="ph:star-fill" className="size-3.5" />
            <span className="text-xs text-foreground">{eintrag.note}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <Stand eintrag={eintrag} />
        </span>
      </button>

      {eintrag.grund && (
        <p className="pl-7 text-xs text-amber-700">
          {t("kiProtokollReason")}: {eintrag.grund}
        </p>
      )}
      {eintrag.warteschlange_fehler && (
        <p className="pl-7 text-xs text-destructive">{eintrag.warteschlange_fehler}</p>
      )}

      {offen && (
        <div className="flex flex-col gap-3 pl-7">
          {eintrag.eingabe_auszug && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("kiProtokollInput")}
              </p>
              <p className="text-sm whitespace-pre-line">{eintrag.eingabe_auszug}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("kiProtokollOutput")}
            </p>
            <p className="text-sm whitespace-pre-line">{eintrag.ergebnis || "–"}</p>
          </div>
          {eintrag.verwendete_fragen.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("kiProtokollQuestions")}
              </p>
              <p className="text-xs text-muted-foreground">
                {eintrag.verwendete_fragen
                  .map((f) => t.has(`kiQuestion.${f}`) ? t(`kiQuestion.${f}`) : f)
                  .join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Zustellart + Stand: was mit dem Text passiert ist — die eigentliche
 *  Auskunft. „Gesendet" heisst öffentlich beim Portal. */
function Stand({ eintrag }: { eintrag: KiProtokollEintrag }) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  if (eintrag.quelle === "test") return null;
  if (eintrag.gesendet_at) {
    return (
      <span className="flex items-center gap-1 whitespace-nowrap text-xs text-emerald-700">
        <Icon icon="ph:paper-plane-tilt" className="size-3.5" />
        {t("kiProtokollSentAt", { date: formatDateTime(eintrag.gesendet_at, locale) })}
      </span>
    );
  }
  const status = eintrag.warteschlange_status;
  const ton =
    status === "fehler"
      ? "text-destructive"
      : status === "geplant"
        ? "text-amber-600"
        : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1 whitespace-nowrap text-xs ${ton}`}>
      <Icon icon="ph:clock" className="size-3.5" />
      {status
        ? t("kiProtokollQueue", { status: t(`queueState.${status}`) })
        : t("kiProtokollNotQueued")}
      <span className="text-muted-foreground">
        · {eintrag.zustellart === "entwurf" ? t("kiDeliveryDraft") : t("kiDeliveryAuto")}
      </span>
    </span>
  );
}
