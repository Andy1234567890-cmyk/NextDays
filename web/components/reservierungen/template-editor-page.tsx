"use client";

// Aufgabenvorlagen-Editor als EIGENE Seite (..): Aufgabenname,
// Aufgabenbeschreibung, Liste von Artikeln (Checklisten-Punkte) mit Foto-
// Pflicht, schwebender Speichern-Button unten rechts. Neu ODER Bearbeiten
// (ruleId gesetzt). Nur kind=template.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import {
  type RuleItem,
  createRule,
  getRule,
  updateRule,
} from "@/lib/tasks";

const LIST = "/reservierungen/aufgaben/vorlagen";

export function TemplateEditorPage({ ruleId }: { ruleId: string | null }) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(!!ruleId);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ruleId) return;
    const res = await getRule(ruleId);
    if (res.ok) {
      setName(res.data.name);
      setDescription(res.data.description ?? "");
      setItems(res.data.items);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }, [ruleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addItem = () =>
    setItems((its) => [
      ...its,
      { label: "", room: null, requires_photo: false, sort_order: its.length },
    ]);

  const updateItem = (idx: number, patch: Partial<RuleItem>) =>
    setItems((its) => its.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((its) => its.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("templateEditorPage.nameRequired"));
      return;
    }
    setSaving(true);
    const payload = {
      kind: "template" as const,
      name,
      description: description || null,
      active: true,
      priority: 0,
      needs_inspection: false,
      remove_on_cancellation: false,
      recurrence: {},
      property_ids: [],
      items,
    };
    const res = ruleId
      ? await updateRule(ruleId, payload)
      : await createRule(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("templateEditorPage.saved"));
    router.push(LIST);
  };

  if (loading) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("templateEditorPage.loading")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("templateEditorPage.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span>{t("templateEditorPage.breadcrumbTasks")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <a href={LIST} className="hover:text-foreground">
          {t("templateEditorPage.breadcrumbTemplates")}
        </a>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">
          {ruleId
            ? t("templateEditorPage.modeEdit")
            : t("templateEditorPage.modeCreate")}
        </span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {ruleId
            ? t("templateEditorPage.modeEdit")
            : t("templateEditorPage.modeCreate")}
        </h1>
        <LearnButton title={t("templateEditorPage.learnTitle")}>
          <p className="text-sm text-muted-foreground">
            {t("templateEditorPage.learnBody")}
          </p>
        </LearnButton>
      </div>

      <div className="rounded-(--radius) border bg-card p-6">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {t("templateEditorPage.taskNameLabel")}
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {t("templateEditorPage.taskDescriptionLabel")}
            </span>
            <textarea
              className="min-h-24 w-full rounded-(--radius) border px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">
              {t("templateEditorPage.itemsLabel")}
            </span>
            {items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-(--radius) border p-4"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Titel + Foto-Toggle */}
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold">
                        {t("templateEditorPage.itemTitleLabel")}
                      </span>
                      <Input
                        value={it.label}
                        onChange={(e) =>
                          updateItem(idx, { label: e.target.value })
                        }
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {t("templateEditorPage.itemPhotoRequiredLabel")}
                      </span>
                      <Switch
                        checked={it.requires_photo}
                        onCheckedChange={(v) =>
                          updateItem(idx, { requires_photo: v })
                        }
                      />
                    </div>
                  </div>

                  {/* Beschreibung */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">
                      {t("templateEditorPage.itemDescriptionLabel")}
                    </span>
                    <textarea
                      className="min-h-24 w-full rounded-(--radius) border px-3 py-2 text-sm"
                      value={it.description ?? ""}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90"
                  >
                    {t("templateEditorPage.removeItem")}
                  </button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-fit"
              onClick={addItem}
              type="button"
            >
              {t("templateEditorPage.addItem")}
            </Button>
          </div>
        </div>
      </div>

      {/* Schwebender Speichern-Button (.., unten rechts). Über Andy-Button. */}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="fixed bottom-24 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105 disabled:opacity-50"
        aria-label={t("templateEditorPage.saveAriaLabel")}
      >
        <Icon icon={saving ? "ph:spinner" : "ph:floppy-disk"} className="size-6" />
      </button>
    </div>
  );
}
