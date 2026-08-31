"use client";

// Regel-Editor als EIGENE Seite — für „Planmäßige Aufgaben" (kind=auto) und
// „Regelmäßige Aufgaben" (kind=recurring).
//
// Vorher war das ein kleines Modal ohne Zeit-Trigger und ohne Vorlagen-Bezug.
// Beides fehlte nicht nur optisch: eine planmäßige Regel OHNE Start-Trigger
// kann gar nichts auslösen, und ohne Vorlagen-Verweis muss man dieselbe
// Checkliste in jeder Regel neu tippen — genau das, wofür es Vorlagen gibt.
//
// Aufbau (Lodgify-Reihenfolge): Kopf (Titel/Beschreibung/Aktiv/Priorität) ·
// Objekte · Zeitpunkt (Trigger bzw. Zeitplan) · Aufgabenvorlage mit Vorschau ·
// Empfänger · Inspektion. Speichern/Löschen als schwebende Knöpfe unten rechts.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { Input } from "@nextdays/ui/input";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { NativeSelect } from "@nextdays/ui/native-select";

import { LOCALES } from "@/i18n/locales";
import { Switch } from "@nextdays/ui/switch";
import { mitarbeiterOptionen } from "@/lib/mitarbeiter-optionen";
import {
  END_TRIGGER,
  FREQUENZEN,
  MINUTEN_PRO_TAG,
  MONATS_POSITIONEN,
  PRIORITAETEN,
  START_TRIGGER,
  TRIGGER_MIT_TAGEN,
  WOCHENTAGE,
} from "@/lib/aufgaben-konstanten";
import { listProperties } from "@/lib/properties";
import {
  type RuleInput,
  type RuleItem,
  type TaskTrigger,
  createRule,
  deleteRule,
  getRule,
  listRules,
  updateRule,
  listTaskAssignees,
} from "@/lib/tasks";

type Opt = { value: string; label: string };
type Kind = "auto" | "recurring";

const LIST: Record<Kind, string> = {
  auto: "/reservierungen/aufgaben/planmaessig",
  recurring: "/reservierungen/aufgaben/regelmaessig",
};

/** Der Name einer Sprache in der Sprache des Lesers („Dansk" heisst im
 *  deutschen Dashboard „Dänisch"). `Intl.DisplayNames` kann das; faellt es aus
 *  (alter Browser), bleibt der Code stehen statt eines leeren Eintrags. */
function sprachName(code: string, anzeigeIn: string): string {
  try {
    return (
      new Intl.DisplayNames([anzeigeIn], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

const LEER: RuleInput = {
  kind: "auto",
  name: "",
  description: "",
  // Wird beim Anlegen auf die Sprache DIESER Oberflaeche gesetzt (0511) — wer
  // hier tippt, tippt in seiner Sprache. Bei einer bestehenden Regel kommt der
  // gespeicherte Wert; ist er leer, muss der Nutzer ihn angeben, weil der Name
  // sonst nicht uebersetzt werden kann (geraten wird er nicht).
  quellsprache: null,
  active: true,
  priority: 3,
  assignee_id: null,
  needs_inspection: false,
  remove_on_cancellation: true,
  recurrence: {},
  property_ids: [],
  items: [],
  template_rule_id: null,
  start_trigger: null,
  end_trigger: null,
  start_offset_minutes: 0,
  end_offset_minutes: 0,
  starts_on: null,
  ends_on: null,
  start_time: null,
  duration_minutes: null,
};

export function RuleEditorPage({
  kind,
  ruleId,
}: {
  kind: Kind;
  ruleId: string | null;
}) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const locale = useLocale();
  const [form, setForm] = useState<RuleInput>({
    ...LEER,
    kind,
    // Neue Regel: die Sprache dieser Oberflaeche. Das ist keine Vermutung,
    // sondern eine Messung — der Nutzer tippt gerade hier.
    quellsprache: locale,
  });
  const [properties, setProperties] = useState<Opt[]>([]);
  const [users, setUsers] = useState<Opt[]>([]);
  const [templates, setTemplates] = useState<Opt[]>([]);
  const [templateItems, setTemplateItems] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setRec = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, recurrence: { ...f.recurrence, [key]: value } }));

  const load = useCallback(async () => {
    const [props, tenantUsers, tpl] = await Promise.all([
      listProperties(),
      listTaskAssignees(),
      listRules("template"),
    ]);
    if (props.ok) {
      setProperties(props.data.items.map((p) => ({ value: p.id, label: p.title })));
    }
    if (tenantUsers.ok) {
      setUsers(mitarbeiterOptionen(tenantUsers.data));
    }
    if (tpl.ok) {
      setTemplates(tpl.data.map((r) => ({ value: r.id, label: r.name })));
    }
    if (ruleId) {
      const res = await getRule(ruleId);
      if (res.ok) {
        const r = res.data;
        setForm({
          kind: r.kind as Kind,
          name: r.name,
          description: r.description ?? "",
          // Bestehende Regel: der GESPEICHERTE Wert, nicht die Sprache der
          // Oberflaeche. Ein Deutscher, der eine daenisch benannte Regel
          // oeffnet, wuerde sie sonst still auf „deutsch" umetikettieren, und
          // die naechste Uebersetzung liefe aus der falschen Ausgangssprache.
          quellsprache: r.quellsprache,
          active: r.active,
          priority: r.priority || 3,
          assignee_id: r.assignee_id,
          needs_inspection: r.needs_inspection,
          remove_on_cancellation: r.remove_on_cancellation,
          recurrence: r.recurrence,
          property_ids: r.property_ids,
          items: r.items,
          template_rule_id: r.template_rule_id,
          start_trigger: r.start_trigger,
          end_trigger: r.end_trigger,
          start_offset_minutes: r.start_offset_minutes,
          end_offset_minutes: r.end_offset_minutes,
          starts_on: r.starts_on,
          ends_on: r.ends_on,
          start_time: r.start_time ? r.start_time.slice(0, 5) : null,
          duration_minutes: r.duration_minutes,
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

  // Vorschau der Punkte der gewählten Vorlage — der Betrieb soll sehen, WAS die
  // Regel später erzeugt, ohne dafür in die Vorlagen wechseln zu müssen.
  useEffect(() => {
    const id = form.template_rule_id;
    if (!id) {
      setTemplateItems([]);
      return;
    }
    void getRule(id).then((res) => {
      if (res.ok) setTemplateItems(res.data.items);
    });
  }, [form.template_rule_id]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("ruleEditorPage.nameRequired"));
      return;
    }
    if (kind === "auto" && !form.start_trigger) {
      // Ohne Start-Trigger löst die Regel NIE aus. Lieber hier hart abweisen,
      // als eine Regel speichern zu lassen, die stumm nichts tut.
      toast.error(t("ruleEditorPage.startTriggerRequired"));
      return;
    }
    if (kind === "recurring" && (!form.starts_on || !form.recurrence.frequency)) {
      toast.error(t("ruleEditorPage.scheduleRequired"));
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
    toast.success(t("ruleEditorPage.saved"));
    router.push(LIST[kind]);
  };

  const remove = async () => {
    if (!ruleId) return;
    const res = await deleteRule(ruleId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ruleEditorPage.deleted"));
    router.push(LIST[kind]);
  };

  if (loading) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("ruleEditorPage.loading")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb kind={kind} isEdit={Boolean(ruleId)} />

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {ruleId
            ? t("ruleEditorPage.modeEdit")
            : t("ruleEditorPage.modeCreate")}
        </h1>
        <LearnButton title={t(`ruleEditorPage.learnTitle.${kind}`)}>
          <p className="text-sm text-muted-foreground">
            {t(`ruleEditorPage.learnBody.${kind}`)}
          </p>
        </LearnButton>
      </div>

      {/* Kopf */}
      <Block>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t("ruleEditorPage.titleLabel")}
          </span>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>

        {/* Sprache des Namens (0511). Sie entscheidet, ob und WORAUS uebersetzt
            wird — ohne sie bleibt der interne Name bei jedem Leser stehen.
            Warum nicht geraten: derselbe Betrieb fuehrt live deutsche UND
            daenische Regelnamen nebeneinander („Endreinigung" neben
            „Vinduer 8-uger"), ein Default haette also die Haelfte falsch
            etikettiert — und eine Uebersetzung aus der falschen Ausgangssprache
            wirft keinen Fehler, sie liefert plausiblen Unsinn. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t("ruleEditorPage.sourceLanguageLabel")}
          </span>
          <NativeSelect
            value={form.quellsprache ?? ""}
            onChange={(e) => set("quellsprache", e.target.value || null)}
          >
            <option value="">{t("ruleEditorPage.sourceLanguageEmpty")}</option>
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {sprachName(code, locale)}
              </option>
            ))}
          </NativeSelect>
          <span className="text-xs text-muted-foreground">
            {form.quellsprache
              ? t("ruleEditorPage.sourceLanguageHint")
              : t("ruleEditorPage.sourceLanguageMissing")}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t("ruleEditorPage.descriptionLabel")}
          </span>
          <textarea
            className="min-h-24 w-full rounded-(--radius) border px-3 py-2 text-sm"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>

        <Zeile label={t("ruleEditorPage.active")}>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => set("active", v)}
          />
        </Zeile>

        {kind === "auto" && (
          <Zeile label={t("ruleEditorPage.removeOnCancellation")}>
            <Switch
              checked={form.remove_on_cancellation}
              onCheckedChange={(v) => set("remove_on_cancellation", v)}
            />
          </Zeile>
        )}

        <Zeile label={t("ruleEditorPage.priority")}>
          <div className="flex items-center gap-3">
            <StepperKnopf
              icon="ph:minus"
              ariaLabel={t("ruleEditorPage.priorityDown")}
              onClick={() => set("priority", Math.max(1, form.priority - 1))}
            />
            <span className="min-w-28 text-center text-sm font-medium">
              {form.priority} {t(`ruleEditorPage.priorityLevel.${form.priority}`)}
            </span>
            <StepperKnopf
              icon="ph:plus"
              ariaLabel={t("ruleEditorPage.priorityUp")}
              onClick={() =>
                set(
                  "priority",
                  Math.min(PRIORITAETEN.length, form.priority + 1),
                )
              }
            />
          </div>
        </Zeile>
      </Block>

      {/* Objekte */}
      <Block>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t(`ruleEditorPage.propertiesLabel.${kind}`)}
          </span>
          <MultiSelect
            options={properties}
            selected={form.property_ids}
            onChange={(v) => set("property_ids", v)}
            placeholder={t("ruleEditorPage.propertiesPlaceholder")}
          />
          <span className="text-xs text-muted-foreground">
            {t("ruleEditorPage.propertiesHint")}
          </span>
        </label>
      </Block>

      {/* Zeitpunkt */}
      {kind === "auto" ? (
        <Block>
          <TriggerFeld
            label={t("ruleEditorPage.startTriggerLabel")}
            options={START_TRIGGER}
            value={form.start_trigger}
            offsetMinutes={form.start_offset_minutes}
            negativ
            onTrigger={(v) => set("start_trigger", v)}
            onOffset={(v) => set("start_offset_minutes", v)}
          />
          <TriggerFeld
            label={t("ruleEditorPage.endTriggerLabel")}
            options={END_TRIGGER}
            value={form.end_trigger}
            offsetMinutes={form.end_offset_minutes}
            onTrigger={(v) => set("end_trigger", v)}
            onOffset={(v) => set("end_offset_minutes", v)}
          />
        </Block>
      ) : (
        <Block>
          <Zeitplan form={form} set={set} setRec={setRec} />
        </Block>
      )}

      {/* Aufgabenvorlage + Vorschau */}
      <Block>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t("ruleEditorPage.templateLabel")}
          </span>
          <NativeSelect
            value={form.template_rule_id ?? ""}
            onChange={(e) => set("template_rule_id", e.target.value || null)}
          >
            <option value="">{t("ruleEditorPage.templateNone")}</option>
            {templates.map((tpl) => (
              <option key={tpl.value} value={tpl.value}>
                {tpl.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        {templateItems.length > 0 && (
          <ul className="list-disc pl-6 text-sm font-medium">
            {templateItems.map((item, idx) => (
              <li key={item.id ?? idx}>{item.label}</li>
            ))}
          </ul>
        )}
      </Block>

      {/* Empfänger + Inspektion */}
      <Block>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {t("ruleEditorPage.assigneeLabel")}
          </span>
          <NativeSelect
            value={form.assignee_id ?? ""}
            onChange={(e) => set("assignee_id", e.target.value || null)}
          >
            <option value="">{t("ruleEditorPage.unassigned")}</option>
            {users.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Zeile label={t("ruleEditorPage.needsInspection")}>
          <Switch
            checked={form.needs_inspection}
            onCheckedChange={(v) => set("needs_inspection", v)}
          />
        </Zeile>
      </Block>

      {/* Schwebende Knöpfe unten rechts (über dem Andy-Button). */}
      <div className="fixed bottom-24 right-6 z-40 flex items-center gap-3">
        {ruleId && (
          <button
            type="button"
            onClick={remove}
            className="flex size-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition hover:scale-105"
            aria-label={t("ruleEditorPage.deleteAria")}
          >
            <Icon icon="ph:trash" className="size-6" />
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105 disabled:opacity-50"
          aria-label={t("ruleEditorPage.saveAria")}
        >
          <Icon
            icon={saving ? "ph:spinner" : "ph:floppy-disk"}
            className={`size-6 ${saving ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}

// --- Bausteine -------------------------------------------------------------

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-(--radius) border bg-card p-6">
      {children}
    </div>
  );
}

function Zeile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

function StepperKnopf({
  icon,
  ariaLabel,
  onClick,
}: {
  icon: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex size-9 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90"
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

function Breadcrumb({ kind, isEdit }: { kind: Kind; isEdit: boolean }) {
  const t = useTranslations("reservations");
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span>{t("ruleEditorPage.breadcrumbHome")}</span>
      <Icon icon="ph:caret-right" className="size-3.5" />
      <span>{t("ruleEditorPage.breadcrumbTasks")}</span>
      <Icon icon="ph:caret-right" className="size-3.5" />
      <a href={LIST[kind]} className="hover:text-foreground">
        {t(`ruleList.kindTitle.${kind}`)}
      </a>
      <Icon icon="ph:caret-right" className="size-3.5" />
      <span className="text-foreground">
        {isEdit ? t("ruleEditorPage.modeEdit") : t("ruleEditorPage.modeCreate")}
      </span>
    </nav>
  );
}

/**
 * Trigger-Auswahl mit Erklärbox — und, wo der Trigger eine Distanz braucht,
 * einem Tages-Feld. Die Erklärbox ist kein Zierrat: „Nach dem Check-in (max. 24
 * Stunden)" ist ohne Erläuterung nicht zu erraten.
 */
function TriggerFeld({
  label,
  options,
  value,
  offsetMinutes,
  negativ,
  onTrigger,
  onOffset,
}: {
  label: string;
  options: TaskTrigger[];
  value: TaskTrigger | null;
  offsetMinutes: number;
  negativ?: boolean;
  onTrigger: (v: TaskTrigger | null) => void;
  onOffset: (v: number) => void;
}) {
  const t = useTranslations("reservations");
  const brauchtTage = value ? TRIGGER_MIT_TAGEN.includes(value) : false;
  const tage = Math.abs(Math.round(offsetMinutes / MINUTEN_PRO_TAG));

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <NativeSelect
          value={value ?? ""}
          onChange={(e) =>
            onTrigger((e.target.value || null) as TaskTrigger | null)
          }
        >
          <option value="">{t("ruleEditorPage.triggerNone")}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`ruleEditorPage.trigger.${option}`)}
            </option>
          ))}
        </NativeSelect>
      </label>

      {brauchtTage && (
        <label className="flex items-center gap-2 text-sm">
          <span>{t("ruleEditorPage.offsetDays")}</span>
          <Input
            type="number"
            min={0}
            className="w-24"
            value={String(tage)}
            onChange={(e) => {
              const days = Math.max(0, Number(e.target.value) || 0);
              onOffset(days * MINUTEN_PRO_TAG * (negativ ? -1 : 1));
            }}
          />
        </label>
      )}

      {value && (
        <p className="rounded-(--radius) bg-info/10 px-3 py-2 text-sm font-medium text-info-foreground">
          {t(`ruleEditorPage.triggerHint.${value}`)}
        </p>
      )}
    </div>
  );
}

/** Zeitplan-Block der wiederkehrenden Regeln. */
function Zeitplan({
  form,
  set,
  setRec,
}: {
  form: RuleInput;
  set: <K extends keyof RuleInput>(key: K, value: RuleInput[K]) => void;
  setRec: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("reservations");
  const frequenz = (form.recurrence.frequency as string) ?? "";
  const mask = Number(form.recurrence.weekday_mask ?? 0);
  // Entweder fester Monatstag ODER Wochentagsmuster — nie beides. Bei Lodgify
  // sind das zwei Radios; getrennte Felder ohne Entweder-oder erzeugten hier
  // widersprüchliche Regeln.
  const monatsModus = form.recurrence.day_of_month != null ? "day" : "pattern";
  const dauerStunden = Math.floor((form.duration_minutes ?? 0) / 60);
  const dauerMinuten = (form.duration_minutes ?? 0) % 60;

  const setDauer = (stunden: number, minuten: number) => {
    const gesamt = stunden * 60 + minuten;
    set("duration_minutes", gesamt > 0 ? gesamt : null);
  };

  return (
    <>
      <span className="text-sm font-semibold">
        {t("ruleEditorPage.periodLabel")}
      </span>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">{t("ruleEditorPage.startsOn")}</span>
          <Input
            type="date"
            value={form.starts_on ?? ""}
            onChange={(e) => set("starts_on", e.target.value || null)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">{t("ruleEditorPage.startTime")}</span>
          <Input
            type="time"
            value={form.start_time ?? ""}
            onChange={(e) => set("start_time", e.target.value || null)}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{t("ruleEditorPage.hasEnd")}</span>
          <Switch
            checked={form.ends_on != null}
            onCheckedChange={(v) =>
              set("ends_on", v ? (form.starts_on ?? "") : null)
            }
          />
        </div>
        {form.ends_on != null && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm">{t("ruleEditorPage.endsOn")}</span>
            <Input
              type="date"
              value={form.ends_on}
              onChange={(e) => set("ends_on", e.target.value || null)}
            />
          </label>
        )}
      </div>

      <span className="text-sm font-semibold">
        {t("ruleEditorPage.repeatLabel")}
      </span>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">{t("ruleEditorPage.frequency")}</span>
          <NativeSelect
            value={frequenz}
            onChange={(e) => setRec("frequency", e.target.value)}
          >
            <option value="">{t("ruleEditorPage.choose")}</option>
            {FREQUENZEN.map((f) => (
              <option key={f} value={f}>
                {t(`ruleEditorPage.frequencyOption.${f}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">{t("ruleEditorPage.interval")}</span>
          <Input
            type="number"
            min={1}
            className="w-24"
            value={String(form.recurrence.interval ?? 1)}
            onChange={(e) => setRec("interval", Number(e.target.value) || 1)}
          />
        </label>
      </div>

      {frequenz === "weekly" && (
        <fieldset className="flex flex-wrap gap-1.5">
          {WOCHENTAGE.map((wk, i) => {
            const on = (mask & (1 << i)) !== 0;
            return (
              <button
                key={wk}
                type="button"
                onClick={() =>
                  setRec("weekday_mask", on ? mask & ~(1 << i) : mask | (1 << i))
                }
                className={`rounded-full border px-3 py-1 text-xs ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {t(`ruleEditorPage.${wk}Short`)}
              </button>
            );
          })}
        </fieldset>
      )}

      {(frequenz === "monthly" || frequenz === "yearly") && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="monatsmodus"
              checked={monatsModus === "day"}
              onChange={() => {
                setRec("weekday_pattern_position", null);
                setRec("weekday_pattern_weekday", null);
                setRec("day_of_month", 1);
              }}
              className="accent-primary"
            />
            {t("ruleEditorPage.onDay")}
            <Input
              type="number"
              min={1}
              max={31}
              className="w-24"
              disabled={monatsModus !== "day"}
              value={String(form.recurrence.day_of_month ?? "")}
              onChange={(e) =>
                setRec("day_of_month", Number(e.target.value) || 1)
              }
            />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="radio"
              name="monatsmodus"
              checked={monatsModus === "pattern"}
              onChange={() => {
                setRec("day_of_month", null);
                setRec("weekday_pattern_position", "first");
                setRec("weekday_pattern_weekday", 0);
              }}
              className="accent-primary"
            />
            {t("ruleEditorPage.onPattern")}
            <NativeSelect
              className="w-36"
              disabled={monatsModus !== "pattern"}
              value={(form.recurrence.weekday_pattern_position as string) ?? ""}
              onChange={(e) =>
                setRec("weekday_pattern_position", e.target.value || null)
              }
            >
              {MONATS_POSITIONEN.map((p) => (
                <option key={p} value={p}>
                  {t(`ruleEditorPage.position.${p}`)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-40"
              disabled={monatsModus !== "pattern"}
              value={String(form.recurrence.weekday_pattern_weekday ?? "")}
              onChange={(e) =>
                setRec("weekday_pattern_weekday", Number(e.target.value))
              }
            >
              {WOCHENTAGE.map((wk, i) => (
                <option key={wk} value={i}>
                  {t(`ruleEditorPage.${wk}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      )}

      <span className="text-sm font-semibold">
        {t("ruleEditorPage.durationLabel")}
      </span>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="number"
            min={0}
            className="w-24"
            value={String(dauerStunden)}
            onChange={(e) =>
              setDauer(Math.max(0, Number(e.target.value) || 0), dauerMinuten)
            }
          />
          {t("ruleEditorPage.hours")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="number"
            min={0}
            max={59}
            className="w-24"
            value={String(dauerMinuten)}
            onChange={(e) =>
              setDauer(
                dauerStunden,
                Math.min(59, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
          {t("ruleEditorPage.minutes")}
        </label>
      </div>
    </>
  );
}
