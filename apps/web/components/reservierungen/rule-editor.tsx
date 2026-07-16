"use client";

// Regel-/Vorlagen-Editor (Modal) für alle drei Arten:
//   template   — Aufgabenvorlage (Name + Checklisten-Items mit Foto-Pflicht)
//   auto       — Planmäßige Aufgabe (buchungs-getriggert, Objekte + Assignee)
//   recurring  — Regelmäßige Aufgabe (Zeitplan: Häufigkeit/Intervall/Muster)
// Foto-Pflicht NUR pro Item (requires_photo). Zeitplan → recurrence-jsonb.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { listTenantUsers } from "@/lib/account";
import { listProperties } from "@/lib/properties";
import {
  type RuleInput,
  type RuleItem,
  type RuleKind,
  createRule,
  getRule,
  updateRule,
} from "@/lib/tasks";

type Opt = { value: string; label: string };

const WEEKDAY_KEYS = [
  "weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu",
  "weekdayFri", "weekdaySat", "weekdaySun",
] as const;

const EMPTY: RuleInput = {
  kind: "template",
  name: "",
  description: "",
  active: true,
  priority: 0,
  assignee_id: null,
  needs_inspection: false,
  remove_on_cancellation: true,
  recurrence: {},
  property_ids: [],
  items: [],
};

export function RuleEditor({
  kind,
  ruleId,
  onClose,
  onSaved,
}: {
  kind: RuleKind;
  ruleId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("reservations");
  const [form, setForm] = useState<RuleInput>({ ...EMPTY, kind });
  const [properties, setProperties] = useState<Opt[]>([]);
  const [users, setUsers] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [props, tenantUsers] = await Promise.all([
      listProperties(),
      listTenantUsers(),
    ]);
    if (props.ok) {
      setProperties(
        props.data.items.map((p) => ({ value: p.id, label: p.title })),
      );
    }
    if (tenantUsers.ok) {
      setUsers(
        tenantUsers.data.map((u) => ({
          value: u.user_id,
          label: u.full_name ?? u.email ?? u.user_id,
        })),
      );
    }
    if (ruleId) {
      const res = await getRule(ruleId);
      if (res.ok) {
        const r = res.data;
        setForm({
          kind: r.kind,
          name: r.name,
          description: r.description ?? "",
          active: r.active,
          priority: r.priority,
          assignee_id: r.assignee_id,
          needs_inspection: r.needs_inspection,
          remove_on_cancellation: r.remove_on_cancellation,
          recurrence: r.recurrence,
          property_ids: r.property_ids,
          items: r.items,
        });
      } else {
        toast.error(res.error);
      }
    }
    setLoading(false);
  }, [ruleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setRec = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, recurrence: { ...f.recurrence, [key]: value } }));

  const addItem = () =>
    set("items", [
      ...form.items,
      { label: "", room: null, requires_photo: false, sort_order: form.items.length },
    ]);

  const updateItem = (idx: number, patch: Partial<RuleItem>) =>
    set(
      "items",
      form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );

  const removeItem = (idx: number) =>
    set("items", form.items.filter((_, i) => i !== idx));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("ruleEditor.titleRequired"));
      return;
    }
    setSaving(true);
    const res = ruleId
      ? await updateRule(ruleId, form)
      : await createRule(form);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ruleEditor.saved"));
    onSaved();
  };

  const freq = (form.recurrence.frequency as string) ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-(--radius) border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("ruleEditor.loading")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {ruleId ? t("ruleEditor.editTitle") : t("ruleEditor.createTitle")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
                aria-label={t("ruleEditor.close")}
              >
                <Icon icon="ph:x" className="size-4" />
              </button>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("ruleEditor.titleLabel")}</span>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("ruleEditor.titlePlaceholder")}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("ruleEditor.descriptionLabel")}</span>
              <Input
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>

            {kind !== "template" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("ruleEditor.active")}</span>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => set("active", v)}
                  />
                </div>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("ruleEditor.propertiesLabel")}</span>
                  <MultiSelect
                    options={properties}
                    selected={form.property_ids}
                    onChange={(v) => set("property_ids", v)}
                    placeholder={t("ruleEditor.propertiesPlaceholder")}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("ruleEditor.assigneeLabel")}</span>
                  <NativeSelect
                    value={form.assignee_id ?? ""}
                    onChange={(e) =>
                      set("assignee_id", e.target.value || null)
                    }
                  >
                    <option value="">{t("ruleEditor.unassigned")}</option>
                    {users.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              </>
            )}

            {kind === "auto" && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("ruleEditor.removeOnCancellation")}
                </span>
                <Switch
                  checked={form.remove_on_cancellation}
                  onCheckedChange={(v) => set("remove_on_cancellation", v)}
                />
              </div>
            )}

            {kind === "recurring" && (
              <div className="flex flex-col gap-3 rounded-(--radius) border p-3">
                <span className="text-sm font-medium">{t("ruleEditor.schedule")}</span>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t("ruleEditor.frequency")}</span>
                  <NativeSelect
                    value={freq}
                    onChange={(e) => setRec("frequency", e.target.value)}
                  >
                    <option value="">{t("ruleEditor.choose")}</option>
                    <option value="daily">{t("ruleEditor.daily")}</option>
                    <option value="weekly">{t("ruleEditor.weekly")}</option>
                    <option value="monthly">{t("ruleEditor.monthly")}</option>
                  </NativeSelect>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span>{t("ruleEditor.interval")}</span>
                  <Input
                    type="number"
                    min={1}
                    value={String(form.recurrence.interval ?? 1)}
                    onChange={(e) =>
                      setRec("interval", Number(e.target.value) || 1)
                    }
                  />
                </label>

                {freq === "weekly" && (
                  <fieldset className="flex flex-wrap gap-1.5">
                    {WEEKDAY_KEYS.map((wk, i) => {
                      const mask = Number(form.recurrence.weekday_mask ?? 0);
                      const on = (mask & (1 << i)) !== 0;
                      return (
                        <button
                          key={wk}
                          type="button"
                          onClick={() =>
                            setRec(
                              "weekday_mask",
                              on ? mask & ~(1 << i) : mask | (1 << i),
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            on
                              ? "border-primary bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t(`ruleEditor.${wk}Short`)}
                        </button>
                      );
                    })}
                  </fieldset>
                )}

                {freq === "monthly" && (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t("ruleEditor.dayOfMonth")}</span>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={String(form.recurrence.day_of_month ?? "")}
                        onChange={(e) =>
                          setRec(
                            "day_of_month",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t("ruleEditor.position")}</span>
                        <NativeSelect
                          value={
                            (form.recurrence.weekday_pattern_position as string) ??
                            ""
                          }
                          onChange={(e) =>
                            setRec(
                              "weekday_pattern_position",
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">{t("ruleEditor.dash")}</option>
                          <option value="first">{t("ruleEditor.positionFirst")}</option>
                          <option value="second">{t("ruleEditor.positionSecond")}</option>
                          <option value="third">{t("ruleEditor.positionThird")}</option>
                          <option value="fourth">{t("ruleEditor.positionFourth")}</option>
                          <option value="last">{t("ruleEditor.positionLast")}</option>
                        </NativeSelect>
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t("ruleEditor.weekday")}</span>
                        <NativeSelect
                          value={String(
                            form.recurrence.weekday_pattern_weekday ?? "",
                          )}
                          onChange={(e) =>
                            setRec(
                              "weekday_pattern_weekday",
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">{t("ruleEditor.dash")}</option>
                          {WEEKDAY_KEYS.map((wk, i) => (
                            <option key={wk} value={i}>
                              {t(`ruleEditor.${wk}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {kind !== "template" && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("ruleEditor.needsInspection")}
                </span>
                <Switch
                  checked={form.needs_inspection}
                  onCheckedChange={(v) => set("needs_inspection", v)}
                />
              </div>
            )}

            {/* Checklisten-Items (Vorlage/Regel) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("ruleEditor.checklist")}</span>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Icon icon="ph:plus" className="size-4" />
                  {t("ruleEditor.addItem")}
                </Button>
              </div>
              {form.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-(--radius) border p-2"
                >
                  <Input
                    value={it.label}
                    onChange={(e) => updateItem(idx, { label: e.target.value })}
                    placeholder={t("ruleEditor.itemPlaceholder")}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(idx, { requires_photo: !it.requires_photo })
                    }
                    className={`flex size-8 items-center justify-center rounded-full ${
                      it.requires_photo
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                    aria-label={t("ruleEditor.photoRequired")}
                    title={t("ruleEditor.photoRequiredTitle")}
                  >
                    <Icon icon="ph:camera" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="flex size-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label={t("ruleEditor.remove")}
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("ruleEditor.cancel")}
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? t("ruleEditor.saving") : t("ruleEditor.save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
