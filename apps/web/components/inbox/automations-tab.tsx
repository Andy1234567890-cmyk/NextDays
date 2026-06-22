"use client";

// Automatisierungen-Tab: regelbasierte Auto-Nachrichten (Trigger + Zeitpunkt +
// Vorlage/Text). Anlegen, aktivieren/deaktivieren, löschen.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Automation,
  type MessageTemplate,
  createAutomation,
  deleteAutomation,
  listAutomations,
  listTemplates,
  updateAutomation,
} from "@/lib/inbox";

const TRIGGERS = ["booking_new", "before_checkin", "after_checkout"];

export function AutomationsTab() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("booking_new");
  const [offsetDays, setOffsetDays] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function load() {
    const [a, tpl] = await Promise.all([listAutomations(), listTemplates()]);
    if (a.ok) setItems(a.data.items);
    if (tpl.ok) setTemplates(tpl.data.items);
  }
  useEffect(() => {
    load();
  }, []);

  function create() {
    if (!name.trim()) {
      setError(t("autoNameRequired"));
      return;
    }
    setError(null);
    start(async () => {
      const res = await createAutomation({
        name,
        trigger,
        offset_days: offsetDays,
        template_id: templateId || null,
        message: message || null,
        is_active: true,
      });
      if (res.ok) {
        setName("");
        setMessage("");
        setOffsetDays(0);
        await load();
      } else {
        setError(res.error);
      }
    });
  }

  function toggle(a: Automation) {
    start(async () => {
      await updateAutomation(a.id, {
        name: a.name,
        trigger: a.trigger,
        offset_days: a.offset_days,
        template_id: a.template_id,
        message: a.message,
        is_active: !a.is_active,
      });
      await load();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteAutomation(id);
      await load();
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-y-auto p-6">
      {/* Liste */}
      <div className="col-span-12 lg:col-span-7">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("tabAutomations")}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("autoEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`autoTrigger_${a.trigger}` as never) ?? a.trigger}
                    {a.offset_days ? ` · ${a.offset_days} ${t("autoDays")}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-medium " +
                    (a.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {a.is_active ? t("autoActive") : t("autoPaused")}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(a.id)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Neue Regel */}
      <div className="col-span-12 flex flex-col gap-3 rounded-2xl border border-border p-4 lg:col-span-5">
        <h3 className="font-semibold">{t("autoNew")}</h3>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("autoName")}
        />
        <label className="text-sm font-medium">{t("autoTriggerLabel")}</label>
        <select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className="rounded-(--radius) border border-border bg-background px-3 py-2 text-sm"
        >
          {TRIGGERS.map((x) => (
            <option key={x} value={x}>
              {t(`autoTrigger_${x}` as never) ?? x}
            </option>
          ))}
        </select>
        <label className="text-sm font-medium">{t("autoOffset")}</label>
        <Input
          type="number"
          value={offsetDays}
          onChange={(e) => setOffsetDays(Number(e.target.value))}
        />
        <label className="text-sm font-medium">{t("autoTemplate")}</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-(--radius) border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("autoNoTemplate")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title}
            </option>
          ))}
        </select>
        {!templateId && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("autoMessage")}
            rows={3}
            className="resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="button" onClick={create} disabled={pending}>
            {t("autoCreate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
