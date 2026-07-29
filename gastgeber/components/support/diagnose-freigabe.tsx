"use client";

// Diagnose-Freigabe direkt in der Support-Anfrage.
//
// Warum hier und nicht nur im Konto: Wer gerade ein Problem meldet, ist genau
// in dem Moment bereit, uns Einblick zu geben. Ihn dafür in einen anderen
// Bereich zu schicken, kostet den Vorgang — die Freigabe muss dort sein, wo
// das Problem beschrieben wird.
//
// Der Umfang wird auch hier benannt: eine Freigabe, deren Reichweite unklar
// ist, wäre keine informierte Einwilligung.
import {
  reportClientInfo,
  setAktivitaetsAufzeichnung,
} from "@nextdays/diagnostics";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { DebugSession } from "@/lib/diagnose";
import { diagnoseFreigeben, diagnoseWiderrufen } from "@/lib/diagnose-actions";
import { useFormatierung } from "@/lib/formatierung";

// 8 Stunden: deckt einen Arbeitstag ab, ohne zur Dauerfreigabe zu werden.
// Als Konstante, damit die angezeigte Dauer nicht vom übergebenen Wert abweichen
// kann.
const FREIGABE_STUNDEN = 8;

export function DiagnoseFreigabe({
  aktiv,
  ticketId,
}: {
  /** Laufende Freigabe, falls vorhanden. */
  aktiv: DebugSession | null;
  ticketId: string;
}) {
  const t = useTranslations("support");
  const f = useFormatierung();
  const [laeuft, setLaeuft] = useState(false);
  const [offen, setOffen] = useState(false);

  async function freigeben() {
    setLaeuft(true);
    const res = await diagnoseFreigeben(
      FREIGABE_STUNDEN,
      t("dfNotiz", { ticket: ticketId.slice(0, 8) }),
    );
    setLaeuft(false);
    if (res.ok) {
      // Umgebung sofort mitschicken, damit der Support nicht auf den nächsten
      // Fehler warten muss und die Liste nie leer wirkt.
      await reportClientInfo();
      setAktivitaetsAufzeichnung(true);
      setOffen(false);
      toast.success(t("dfToastFreigegeben"));
    } else {
      toast.error(res.fehler);
    }
  }

  async function widerrufen() {
    setLaeuft(true);
    const res = await diagnoseWiderrufen();
    setLaeuft(false);
    if (res.ok) {
      setAktivitaetsAufzeichnung(false);
      toast.success(t("dfToastBeendet"));
    }
    else toast.error(res.fehler);
  }

  if (aktiv) {
    return (
      <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border-2 border-foreground p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Icon icon="ph:check-circle" className="size-5 shrink-0" />
            {t("dfAktivTitel")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dfAktivText", {
              zeit: f.zeit(aktiv.expires_at, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </p>
        </div>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void widerrufen()}
          className="shrink-0 text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
        >
          {t("dfBeenden")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Icon icon="ph:activity" className="size-5 shrink-0" />
        {t("dfTitel")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t("dfEinleitung")}</p>

      {offen && (
        <div className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">
          <p className="font-semibold">{t("dfSiehtTitel")}</p>
          <p className="mt-1 text-muted-foreground">{t("dfSiehtText")}</p>
          <p className="mt-3 font-semibold">{t("dfSiehtNichtTitel")}</p>
          <p className="mt-1 text-muted-foreground">{t("dfSiehtNichtText")}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("dfDauerHinweis", { stunden: FREIGABE_STUNDEN })}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void freigeben()}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {laeuft ? t("dfFreigebenLaeuft") : t("dfFreigeben")}
        </button>
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {offen ? t("dfWeniger") : t("dfWasGeteilt")}
        </button>
      </div>
    </div>
  );
}
