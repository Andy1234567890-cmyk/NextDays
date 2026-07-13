"use client";

// Feld-Primitive für die Objektkartei-Panels. Labels kommen als Props (der
// Stepper reicht i18n-Strings durch — keine hart-kodierten Texte hier). Leere
// Strings werden beim Speichern zu null normalisiert (kein Ersatzwert, Wurzel 4).
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function TextField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const t = e.target.value.trim();
          onChange(t === "" ? null : Number(t));
        }}
      />
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <DatePicker
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(v) => onChange(v === "" ? null : v)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <NativeSelect
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

// Leere Strings → null (kein Ersatzwert).
export function nulled<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out as T;
}
