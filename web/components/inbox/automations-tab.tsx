"use client";

// Automatisierungen-Tab: planbare Auto-Nachrichten (Automails). Pro Regel:
// Trigger + Anker (Anreise/Abreise/Buchung) + Offset (Tage vor/nach) + Uhrzeit,
// Vorlage/Text, sowie Zuweisung nach Unterkünften UND Buchungskanälen (Haken;
// leer = alle). Anlegen, aktivieren/deaktivieren, löschen.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { NativeSelect } from "@/components/ui/native-select";
import {
  type Automation,
  type MessageTemplate,
  createAutomation,
  deleteAutomation,
  listAutomations,
  listTemplates,
  updateAutomation,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";

const TRIGGERS = ["booking_new", "before_checkin", "after_checkout"];
const ANCHORS = ["arrival", "departure", "booking"];
// Kanal-Werte = ota_name-Herkunft (Backend matcht case-insensitive). Die eigene
// Plattform „myNextDays" ist ein eigener Kanal wie die OTAs (booking_engine setzt
// ota_name="myNextDays"), NICHT „Direkt".
const CHANNELS = ["myNextDays", "Booking.com", "Airbnb", "Vrbo", "Expedia"];

type Prop = { id: string; title: string };

export function AutomationsTab() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("booking_new");
  const [anchor, setAnchor] = useState("arrival");
  // direction: "before" → negatives offset, "after" → positiv. days = Betrag.
  const [direction, setDirection] = useState<"before" | "after">("before");
  const [days, setDays] = useState(3);
  const [sendTime, setSendTime] = useState("09:00");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function load() {
    const [a, tpl, p] = await Promise.all([
      listAutomations(),
      listTemplates(),
      listProperties(),
    ]);
    if (a.ok) setItems(a.data.items);
    if (tpl.ok) setTemplates(tpl.data.items);
    if (p.ok) setProps(p.data.items.map((x) => ({ id: x.id, title: x.title })));
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
    const offset = direction === "before" ? -Math.abs(days) : Math.abs(days);
    start(async () => {
      const res = await createAutomation({
        name,
        trigger,
        anchor,
        offset_days: offset,
        send_time: sendTime || null,
        property_ids: propertyIds,
        channels,
        template_id: templateId || null,
        message: message || null,
        is_active: true,
      });
      if (res.ok) {
        setName("");
        setMessage("");
        setDays(3);
        setPropertyIds([]);
        setChannels([]);
        await load();
      } else {
        setError(res.error);
      }
    });
  }

  function toggle(a: Automation) {
    start(async () => {
      await updateAutomation(a.id, { ...a, is_active: !a.is_active });
      await load();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteAutomation(id);
      await load();
    });
  }

  // Lesbare Zeitplan-Zeile: „3 Tage vor Anreise · 07:45".
  function scheduleLabel(a: Automation): string {
    const abs = Math.abs(a.offset_days);
    const dir = a.offset_days < 0 ? t("autoBefore") : t("autoAfter");
    const anchorLabel = t(`autoAnchor_${a.anchor}` as never) ?? a.anchor;
    const time = a.send_time ? ` · ${a.send_time}` : "";
    if (abs === 0) return `${anchorLabel}${time}`;
    return `${abs} ${t("autoDays")} ${dir} ${anchorLabel}${time}`;
  }

  function assignLabel(a: Automation): string {
    const houses =
      a.property_ids.length === 0
        ? t("autoAllHouses")
        : `${a.property_ids.length} ${t("autoHousesCount")}`;
    const chans =
      a.channels.length === 0 ? t("autoAllChannels") : a.channels.join(", ");
    return `${houses} · ${chans}`;
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
                    {t(`autoTrigger_${a.trigger}` as never) ?? a.trigger} ·{" "}
                    {scheduleLabel(a)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {assignLabel(a)}
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
        <NativeSelect value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGERS.map((x) => (
            <option key={x} value={x}>
              {t(`autoTrigger_${x}` as never) ?? x}
            </option>
          ))}
        </NativeSelect>

        {/* Zeitplan: Offset (Tage) · vor/nach · Anker · Uhrzeit */}
        <label className="text-sm font-medium">{t("autoSchedule")}</label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={0}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label={t("autoDays")}
          />
          <NativeSelect
            value={direction}
            onChange={(e) => setDirection(e.target.value as "before" | "after")}
          >
            <option value="before">{t("autoBefore")}</option>
            <option value="after">{t("autoAfter")}</option>
          </NativeSelect>
          <NativeSelect value={anchor} onChange={(e) => setAnchor(e.target.value)}>
            {ANCHORS.map((x) => (
              <option key={x} value={x}>
                {t(`autoAnchor_${x}` as never) ?? x}
              </option>
            ))}
          </NativeSelect>
          <Input
            type="time"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            aria-label={t("autoTime")}
          />
        </div>

        {/* Zuweisung Unterkünfte (durchsuchbar; leer = alle) */}
        <label className="text-sm font-medium">{t("autoHouses")}</label>
        <MultiSelect
          options={props.map((p) => ({ value: p.id, label: p.title }))}
          selected={propertyIds}
          onChange={setPropertyIds}
          placeholder={t("autoAllHouses")}
          searchPlaceholder={t("autoSearchHouses")}
          emptyHint={t("autoNoHouses")}
          allLabel={t("autoAllHouses")}
        />

        {/* Zuweisung Kanäle (durchsuchbar; leer = alle) */}
        <label className="text-sm font-medium">{t("autoChannels")}</label>
        <MultiSelect
          options={CHANNELS.map((c) => ({ value: c, label: c }))}
          selected={channels}
          onChange={setChannels}
          placeholder={t("autoAllChannels")}
          searchPlaceholder={t("autoSearchChannels")}
          allLabel={t("autoAllChannels")}
        />

        <label className="text-sm font-medium">{t("autoTemplate")}</label>
        <NativeSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">{t("autoNoTemplate")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title}
            </option>
          ))}
        </NativeSelect>
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
