"use client";

// Versand-Verlauf je Beleg (Buchhaltung → Bereich »versand«): wann ging der
// Beleg an wen, mit welchem Ergebnis. Lädt über die Server-Action; kein
// Realtime — `document_sends` ist server-only (Wurzel 6, Migration 0694).
// Nach einem eigenen Versand ruft der Aufrufer `nachladen` bzw. rendert neu.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { listDocumentSends } from "@/lib/buchhaltung-versand";
import type { DocumentSend, SendStatus } from "@/lib/buchhaltung-versand-typen";

const STATUS_CLASSES: Record<SendStatus, string> = {
  sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  pending: "bg-muted text-muted-foreground",
};

export function VersandVerlauf({
  documentId,
  documentType,
  refreshKey = 0,
}: {
  documentId: string;
  documentType?: string;
  /** Hochzählen, um nach einem eigenen Versand neu zu laden. */
  refreshKey?: number;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const [items, setItems] = useState<DocumentSend[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listDocumentSends(documentId, documentType);
    if (res.ok) setItems(res.data.items);
    else setError(res.error);
    setLoading(false);
  }, [documentId, documentType]);

  useEffect(() => {
    void laden();
  }, [laden, refreshKey]);

  const statusLabel: Record<SendStatus, string> = {
    sent: t("versandVerlauf.statusSent"),
    failed: t("versandVerlauf.statusFailed"),
    pending: t("versandVerlauf.statusPending"),
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(iso),
        )
      : "—";

  return (
    <section className="flex flex-col gap-3" aria-busy={loading}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-base font-extrabold">{t("versandVerlauf.title")}</h3>
          <InfoHinweis
            ariaLabel={t("versandVerlauf.infoAria")}
            text={[t("versandVerlauf.infoText1"), t("versandVerlauf.infoText2")]}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void laden()}
          disabled={loading}
        >
          <Icon
            icon="ph:arrows-clockwise"
            className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`}
          />
          {t("versandVerlauf.reload")}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {t("versandVerlauf.loadError", { error })}
        </p>
      ) : items === null ? (
        <p className="text-sm text-muted-foreground">{t("versandVerlauf.loading")}</p>
      ) : items.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("versandVerlauf.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-(--radius) border">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{s.betreff}</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[s.status]}`}
                >
                  {statusLabel[s.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <Icon icon="ph:paper-plane-tilt" className="mr-1 inline size-3.5" />
                  {s.empfaenger.join(", ")}
                  {s.cc.length > 0 ? ` · CC ${s.cc.join(", ")}` : ""}
                </span>
                <span>
                  <Icon icon="ph:clock" className="mr-1 inline size-3.5" />
                  {fmt(s.sentAt ?? s.createdAt)}
                </span>
                {s.anhaenge.length > 0 && (
                  <span>
                    <Icon icon="ph:paperclip" className="mr-1 inline size-3.5" />
                    {s.anhaenge.map((a) => a.filename).filter(Boolean).join(", ")}
                  </span>
                )}
                {s.messageId && (
                  <span className="truncate" title={s.messageId}>
                    <Icon icon="ph:hash" className="mr-1 inline size-3.5" />
                    {s.messageId}
                  </span>
                )}
              </div>
              {s.status === "failed" && s.fehler && (
                <p className="text-xs text-destructive">{s.fehler}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
