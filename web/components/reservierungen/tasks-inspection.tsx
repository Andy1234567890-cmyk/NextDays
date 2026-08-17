"use client";

// Inspektion (.. /tasks/inspection): QA-Workflow über abgeschlossenen Aufgaben
// mit needs_inspection. Reiter ZU ÜBERPRÜFEN/KOMMEND/ÜBERPRÜFT, Unterkunfts-
// Filter, Freigeben/Zurückweisen. Live via useRealtime.
//
// Die Foto-Nachweise werden als BILD gezeigt (signierte URL aus dem privaten
// Bucket) und lassen sich groß öffnen. Vorher stand hier nur ein Chip
// „Nachweis" — eine Inspektion, bei der man das Foto nicht sieht, prüft nichts.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { listProperties } from "@/lib/properties";
import {
  type InspectionItem,
  inspectTask,
  listInspection,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function TasksInspection() {
  const t = useTranslations("reservations");
  const TABS: { tab: string; label: string }[] = [
    { tab: "to_review", label: t("tasksInspection.tabToReview") },
    { tab: "upcoming", label: t("tasksInspection.tabUpcoming") },
    { tab: "reviewed", label: t("tasksInspection.tabReviewed") },
  ];
  const [tab, setTab] = useState("to_review");
  const [rows, setRows] = useState<InspectionItem[]>([]);
  const [properties, setProperties] = useState<
    { value: string; label: string }[]
  >([]);
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [gross, setGross] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Realtime aktualisiert still (siehe team-tasks): kein Ladezustand über
  // einer Liste, die schon dasteht.
  const load = useCallback(async (stillLaden = false) => {
    if (!stillLaden) setLoading(true);
    const res = await listInspection(tab, propFilter);
    if (res.ok) setRows(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [tab, propFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      if (res.ok) {
        setProperties(
          res.data.items.map((p) => ({ value: p.id, label: p.title })),
        );
      }
    })();
  }, []);

  const stillNachladen = useCallback(() => {
    void load(true);
  }, [load]);

  useRealtime({ table: "tasks", onChange: stillNachladen });

  const decide = async (id: string, approved: boolean) => {
    const res = await inspectTask(id, approved);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(
        approved
          ? t("tasksInspection.toastApproved")
          : t("tasksInspection.toastRejected"),
      );
      stillNachladen();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("tasksInspection.title")}
        </h1>
        <AufgabenFilter
          filters={[
            {
              key: "property",
              caption: t("aufgabenFilter.propertiesCaption"),
              allLabel: t("aufgabenFilter.allProperties"),
              dialogTitle: t("aufgabenFilter.propertiesDialog"),
              searchPlaceholder: t("aufgabenFilter.propertiesSearch"),
              options: properties,
              selected: propFilter,
              onChange: setPropFilter,
            },
          ]}
        />
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.tab}
            type="button"
            onClick={() => setTab(tabItem.tab)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
              tab === tabItem.tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("tasksInspection.loading")}
        </p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("tasksInspection.emptyState")}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.property_title ?? "–"}
                    {item.assignee_name ? ` · ${item.assignee_name}` : ""}
                  </p>
                </div>
                {tab === "reviewed" && (
                  <span className="flex items-center gap-1 text-sm text-success">
                    <Icon icon="ph:check-circle-fill" className="size-4" />
                    {t("tasksInspection.reviewedBadge")}
                  </span>
                )}
              </div>

              {item.photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("tasksInspection.noPhotos")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.photos.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setGross(url)}
                      className="overflow-hidden rounded-(--radius) border transition hover:opacity-80"
                      aria-label={t("tasksInspection.photoProof")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={t("tasksInspection.photoProof")}
                        className="size-24 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {tab === "to_review" && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => decide(item.id, false)}
                  >
                    {t("tasksInspection.reject")}
                  </Button>
                  <Button onClick={() => decide(item.id, true)}>
                    {t("tasksInspection.approve")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {gross && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="presentation"
          onClick={() => setGross(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gross}
            alt={t("tasksInspection.photoProof")}
            className="max-h-full max-w-full rounded-(--radius) object-contain"
          />
        </div>
      )}
    </div>
  );
}
