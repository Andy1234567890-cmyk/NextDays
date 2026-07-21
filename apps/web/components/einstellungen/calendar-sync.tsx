"use client";

// Kalender Import/Export-Tool (Lodgify-Layout, verbindliche Referenz):
//   • Import: EINE Tabelle aller synchronisierten Feeds (Standard-iCal · Ziel ·
//     Quelle), darunter „Jetzt synchronisieren" + Auto-Hinweis links und
//     „Kalender hinzufügen" rechts. Hinzufügen öffnet ein Modal „iCalendar
//     Synchronisation" (iCal-URL · Objekt-Dropdown · Quelle).
//   • Export: Objekt-Dropdown + Scope-Dropdown, darunter Tabelle (Zimmer · Link)
//     mit der iCal-Feed-URL des gewählten Objekts.
//   • API: Doku-Links (Buchungs-API · Kalender-API) für Programmierer.
// Realtime auf external_calendar hält die Feed-Status live (Realtime-Pflicht).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  addExternalCalendar,
  ensureExportToken,
  exportFeedUrl,
  removeExternalCalendar,
  rotateExportToken,
  syncExternalCalendar,
  type ExternalCalendar,
  type PropertyCalendars,
} from "@/lib/external-calendar";

// Eigene, öffentliche API-Referenz (eigenständige Doku-Site, KEINE Session/kein
// Login — reiner externer Link). Staging-URL; beim Domain-Cutover auf die echte
// docs-Domain umstellen.
const API_DOCS_URL = "https://docs.65.21.144.136.sslip.io";

export function CalendarSync({ overview }: { overview: PropertyCalendars[] }) {
  const t = useTranslations("calendarSync");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Alle synchronisierten Feeds über alle Objekte flach (Import-Tabelle).
  const feeds: (ExternalCalendar & { propertyTitle: string })[] =
    overview.flatMap((p) =>
      p.calendars.map((c) => ({ ...c, propertyTitle: p.title })),
    );

  async function syncAll() {
    setBusy("__all__");
    await Promise.all(feeds.map((f) => syncExternalCalendar(f.id)));
    setBusy(null);
    toast.success(t("syncOk"));
    router.refresh();
  }

  async function removeFeed(id: string) {
    if (!window.confirm(t("removeConfirm"))) return;
    setBusy(id);
    const res = await removeExternalCalendar(id);
    setBusy(null);
    if (res.ok) {
      toast.success(t("removeOk"));
      router.refresh();
    } else {
      toast.error(t("removeErr"));
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <RealtimeRefresh tables={["external_calendar"]} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("toolTitle")}
      </h2>

      {/* --- Import -------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-display text-lg font-extrabold">
            {t("importHeading")}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("importIntro")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[40rem]">
            <div className="grid grid-cols-[2fr_auto_2fr_1fr] items-center gap-4 border-b border-border py-2 text-sm text-muted-foreground">
              <span>{t("colStandardIcal")}</span>
              <Icon icon="ph:link" className="size-4 justify-self-center" />
              <span className="font-display font-extrabold text-foreground">
                myNextDays
              </span>
              <span>{t("colSource")}</span>
            </div>
            {feeds.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                {t("noSyncedCalendars")}
              </p>
            ) : (
              feeds.map((f) => (
                <div
                  key={f.id}
                  className="grid grid-cols-[2fr_auto_2fr_1fr] items-center gap-4 border-b border-border py-3 text-sm"
                >
                  <span className="truncate" title={f.ical_url}>
                    {f.ical_url}
                  </span>
                  <Icon
                    icon={
                      f.last_status === "error"
                        ? "ph:warning-circle"
                        : "ph:check-circle"
                    }
                    className={`size-4 justify-self-center ${
                      f.last_status === "error"
                        ? "text-destructive"
                        : "text-emerald-600"
                    }`}
                  />
                  <span className="truncate">{f.propertyTitle}</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-muted-foreground">
                      {f.name}
                    </span>
                    <button
                      type="button"
                      aria-label={t("remove")}
                      disabled={busy === f.id}
                      onClick={() => void removeFeed(f.id)}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              disabled={busy !== null || feeds.length === 0}
              onClick={() => void syncAll()}
            >
              <Icon icon="ph:arrows-clockwise" className="size-4" />
              {t("syncAll")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("importAutoNote")}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalOpen(true)}
          >
            <Icon icon="ph:calendar-plus" className="size-4" />
            {t("addFeed")}
          </Button>
        </div>
      </section>

      {/* --- Export ------------------------------------------------------- */}
      <ExportSection overview={overview} />

      {/* --- API ---------------------------------------------------------- */}
      <section className="flex flex-col gap-2 border-t border-border pt-6">
        <h3 className="font-display text-lg font-extrabold">
          {t("apiHeading")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("apiIntro")}{" "}
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            {t("apiBookings")}
          </a>{" "}
          ·{" "}
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            {t("apiCalendar")}
          </a>
        </p>
      </section>

      {modalOpen && (
        <AddFeedModal
          overview={overview}
          onClose={() => setModalOpen(false)}
          onAdded={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ExportSection({ overview }: { overview: PropertyCalendars[] }) {
  const t = useTranslations("calendarSync");
  const [propertyId, setPropertyId] = useState(
    overview[0]?.property_id ?? "",
  );
  const [scope, setScope] = useState<"all" | "upcoming">("all");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = overview.find((p) => p.property_id === propertyId);

  // Beim Wechsel von Objekt/Scope die Feed-URL (neu) auflösen.
  useEffect(() => {
    let alive = true;
    if (!propertyId) {
      setUrl(null);
      return;
    }
    setLoading(true);
    void (async () => {
      const res = await ensureExportToken(propertyId);
      if (!alive) return;
      if (res.ok) {
        setUrl(await exportFeedUrl(res.data.token, scope));
      } else {
        setUrl(null);
        toast.error(t("tokenErr"));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [propertyId, scope, t]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success(t("copied"));
  }

  async function rotate() {
    if (!propertyId || !window.confirm(t("rotateConfirm"))) return;
    setLoading(true);
    const res = await rotateExportToken(propertyId);
    if (res.ok) {
      setUrl(await exportFeedUrl(res.data.token, scope));
      toast.success(t("rotateOk"));
    } else {
      toast.error(t("rotateErr"));
    }
    setLoading(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-extrabold">
          {t("exportHeading")}
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("exportIntro")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="sm:w-80"
        >
          {overview.length === 0 && (
            <option value="">{t("noProperties")}</option>
          )}
          {overview.map((p) => (
            <option key={p.property_id} value={p.property_id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "upcoming")}
          className="sm:w-72"
        >
          <option value="all">{t("exportScopeAll")}</option>
          <option value="upcoming">{t("exportScopeUpcoming")}</option>
        </NativeSelect>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="grid grid-cols-[1fr_2fr] gap-4 border-b border-border py-2 text-sm text-muted-foreground">
            <span>{t("colRoom")}</span>
            <span>{t("exportColLink")}</span>
          </div>
          {selected && (
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4 border-b border-border py-3 text-sm">
              <span className="truncate font-medium">{selected.title}</span>
              <div className="flex min-w-0 items-center gap-2">
                {loading ? (
                  <span className="text-muted-foreground">…</span>
                ) : url ? (
                  <>
                    <a
                      href={url}
                      className="min-w-0 flex-1 truncate text-accent underline"
                      title={url}
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      aria-label={t("copyUrl")}
                      onClick={() => void copy()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="ph:copy" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("rotate")}
                      onClick={() => void rotate()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="ph:arrows-clockwise" className="size-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AddFeedModal({
  overview,
  onClose,
  onAdded,
}: {
  overview: PropertyCalendars[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("calendarSync");
  const [icalUrl, setIcalUrl] = useState("");
  const [propertyId, setPropertyId] = useState(
    overview[0]?.property_id ?? "",
  );
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!icalUrl.trim() || !propertyId) return;
    setSaving(true);
    const res = await addExternalCalendar({
      propertyId,
      name: source.trim() || t("feedNamePlaceholder"),
      icalUrl: icalUrl.trim(),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(t("addOk"));
      onAdded();
    } else {
      toast.error(res.error || t("addErr"));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-(--radius) bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">
            {t("modalTitle")}
          </h3>
          <button
            type="button"
            aria-label={t("cancel")}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("feedUrl")}</span>
            <Input
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder={t("feedUrlPlaceholder")}
            />
          </label>
          <div className="flex justify-center text-muted-foreground">
            <Icon icon="ph:arrow-down" className="size-5" />
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm font-extrabold">
              myNextDays
            </span>
            <NativeSelect
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {overview.map((p) => (
                <option key={p.property_id} value={p.property_id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("feedName")}</span>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t("feedNamePlaceholder")}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving || !icalUrl.trim() || !propertyId}
            onClick={() => void confirm()}
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("confirmSync")}
          </Button>
        </div>
      </div>
    </div>
  );
}
