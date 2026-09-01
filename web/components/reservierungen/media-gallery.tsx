"use client";

// Bilder-Modul (.. /pictures): zentrale Foto-Nachweise. Karten je Bild
// mit Objekt-Titel, Typ (Buchungsbild/Objektfoto), Autor, Hochgeladen am,
// Buchungszeitraum. Toggles Buchungsbilder/Objektfotos + Objektfilter.
// Live via useRealtime auf property_photos + checklist_photos.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fehlerMelden } from "@/lib/fehler-melden";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { Switch } from "@nextdays/ui/switch";
import { type MediaItem, deleteMedia, listMedia } from "@/lib/media";
import { useRealtime } from "@/lib/use-realtime";

export function MediaGallery() {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const KIND_LABEL: Record<string, string> = {
    booking: t("mediaGallery.kindBooking"),
    property: t("mediaGallery.kindProperty"),
  };
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(true);
  const [showProperty, setShowProperty] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMedia({ booking: showBooking, property: showProperty });
    if (res.ok) setItems(res.data.items);
    setLoading(false);
  }, [showBooking, showProperty]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "property_photos", onChange: load });
  useRealtime({ table: "checklist_photos", onChange: load });

  const remove = async (m: MediaItem) => {
    const res = await deleteMedia(m.kind, m.id);
    if (!res.ok) fehlerMelden(res);
    else {
      toast.success(t("mediaGallery.deleteSuccess"));
      load();
    }
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
      })
      : "–";

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("mediaGallery.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">{t("mediaGallery.breadcrumbImages")}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">{t("mediaGallery.title")}</h1>
          <LearnButton title={t("mediaGallery.title")}>
            <p className="text-sm text-muted-foreground">
              {t("mediaGallery.learnText")}
            </p>
          </LearnButton>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            {t("mediaGallery.toggleBooking")}
            <Switch checked={showBooking} onCheckedChange={setShowBooking} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            {t("mediaGallery.toggleProperty")}
            <Switch checked={showProperty} onCheckedChange={setShowProperty} />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">{t("mediaGallery.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-(--radius) border p-10 text-center text-sm text-muted-foreground">
          {t("mediaGallery.emptyState")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <div
              key={`${m.kind}-${m.id}`}
              className="overflow-hidden rounded-(--radius) border"
            >
              {/* Bild mit Objekt-Titel-Balken + Typ-Label */}
              <div className="relative aspect-[4/3] bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.property_title ?? ""}
                  className="size-full object-cover"
                />
                <span className="absolute inset-x-0 top-0 truncate bg-black/55 px-3 py-2 text-sm font-semibold text-white">
                  {m.property_title ?? t("mediaGallery.noProperty")}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-1.5 text-xs text-white">
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  className="absolute bottom-9 right-2 flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
                  aria-label={t("mediaGallery.deleteImageAriaLabel")}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </div>

              {/* Metadaten */}
              <div className="flex flex-col gap-0.5 p-3 text-sm">
                {m.author && (
                  <p className="text-muted-foreground">
                    {t("mediaGallery.authorLabel")}{" "}
                    <span className="text-foreground">{m.author}</span>
                  </p>
                )}
                <p className="text-muted-foreground">
                  {t("mediaGallery.uploadedAtLabel")}{" "}
                  <span className="text-foreground">{fmt(m.uploaded_at)}</span>
                </p>
                {m.check_in && m.check_out && (
                  <p className="text-muted-foreground">
                    {t("mediaGallery.bookingRange", {
                      from: fmt(m.check_in),
                      to: fmt(m.check_out),
                    })}
                  </p>
                )}
              </div>

              {/* Aktionen */}
              <div className="flex items-center gap-4 border-t px-3 py-2 text-xs font-medium uppercase">
                {m.property_id && (
                  <Link
                    href={`/objekte/${m.property_id}`}
                    className="text-accent hover:underline"
                  >
                    {t("mediaGallery.viewProperty")}
                  </Link>
                )}
                {m.reservation_id && (
                  <Link
                    href={`/reservierungen/${m.reservation_id}`}
                    className="text-accent hover:underline"
                  >
                    {t("mediaGallery.viewBooking")}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
