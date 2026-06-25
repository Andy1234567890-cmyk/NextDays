"use client";

// Zusatzleistungen/Upsells je Objekt verwalten (wie Hostaway/Guesty). Liste +
// Anlegen/Bearbeiten/Löschen mit mehrsprachigem Namen/Beschreibung (de/en),
// Medien-Upload, Preis + Abrechnungsbasis, optional/pflicht, „erscheint in",
// „wann anzeigen", aktiv, Reihenfolge. Echtes Realtime (Supabase WebSocket,
// kein Polling) auf property_addons.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAddon,
  deleteAddon,
  updateAddon,
  uploadAddonMedia,
  type Addon,
  type AddonInput,
  type AddonSurface,
} from "@/lib/addons";
import { useRealtime } from "@/lib/use-realtime";

const BASIS_OPTIONS: { value: Addon["basis"]; label: string }[] = [
  { value: "per_stay", label: "Pro Aufenthalt" },
  { value: "per_night", label: "Pro Nacht" },
  { value: "per_guest", label: "Pro Gast" },
  { value: "per_unit", label: "Pro Einheit" },
];
const SURFACES: { value: AddonSurface; label: string }[] = [
  { value: "booking_engine", label: "Buchungsseite" },
  { value: "guest_portal", label: "Gäste-Portal" },
  { value: "checkin", label: "Check-in" },
];
const AVAILABILITY: { value: Addon["available_until"]; label: string }[] = [
  { value: "anytime", label: "Jederzeit" },
  { value: "before_checkin", label: "Nur vor Anreise" },
];

function emptyDraft(sortOrder: number): AddonInput {
  return {
    name: { de: "", en: "" },
    description: { de: "", en: "" },
    media: [],
    price: 0,
    basis: "per_stay",
    mandatory: false,
    appears_in: ["booking_engine", "guest_portal"],
    available_until: "anytime",
    tax_rate: null,
    active: true,
    sort_order: sortOrder,
  };
}

export function AddonsManager({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: Addon[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Addon[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddonInput | null>(null);
  const [busy, setBusy] = useState(false);

  // Realtime: bei jeder Änderung an property_addons die Seite neu laden.
  useRealtime({
    table: "property_addons",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => router.refresh(),
  });

  function startCreate() {
    setEditing("new");
    setDraft(emptyDraft(items.length));
  }

  function startEdit(a: Addon) {
    setEditing(a.id);
    setDraft({
      name: { ...a.name },
      description: { ...a.description },
      media: [...a.media],
      price: a.price,
      basis: a.basis,
      mandatory: a.mandatory,
      appears_in: [...a.appears_in],
      available_until: a.available_until,
      tax_rate: a.tax_rate,
      active: a.active,
      sort_order: a.sort_order,
    });
  }

  function cancel() {
    setEditing(null);
    setDraft(null);
  }

  function patch<K extends keyof AddonInput>(key: K, value: AddonInput[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function toggleSurface(s: AddonSurface) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.appears_in ?? [];
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      return { ...d, appears_in: next };
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const res =
      editing === "new"
        ? await createAddon(propertyId, draft)
        : await updateAddon(editing as string, draft);
    setBusy(false);
    if (res.ok) {
      toast.success("Gespeichert.");
      cancel();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Zusatzleistung wirklich löschen?")) return;
    const res = await deleteAddon(id);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast.success("Gelöscht.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onMedia(addonId: string, file: File | undefined) {
    if (!file) return;
    const res = await uploadAddonMedia(addonId, file);
    if (res.ok) {
      patch("media", res.data.media);
      toast.success("Medium hochgeladen.");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">Zusatzleistungen</h1>
          <p className="text-sm text-muted-foreground">
            Optionale Extras, die Gäste auf der Buchungsseite oder im Gäste-Portal
            dazubuchen — z. B. Früh-Check-in, Reinigung, Frühstück, Transfer.
          </p>
        </div>
        {editing === null && (
          <Button onClick={startCreate}>
            <Icon icon="ph:plus" className="size-4" />
            Neu
          </Button>
        )}
      </div>

      {editing !== null && draft && (
        <AddonForm
          draft={draft}
          editingId={editing === "new" ? null : (editing as string)}
          busy={busy}
          onPatch={patch}
          onToggleSurface={toggleSurface}
          onMedia={onMedia}
          onSave={() => void save()}
          onCancel={cancel}
        />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Zusatzleistungen angelegt.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                {a.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.media[0]} alt="" className="size-full object-cover" />
                ) : (
                  <Icon icon="ph:plus-circle" className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="flex min-w-40 flex-1 flex-col">
                <span className="font-medium">
                  {a.name.de || a.name.en || "(ohne Namen)"}
                  {a.mandatory && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      Pflicht
                    </span>
                  )}
                  {!a.active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inaktiv
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {a.price.toFixed(2)} €{" "}
                  {BASIS_OPTIONS.find((b) => b.value === a.basis)?.label}
                  {" · "}
                  {a.appears_in
                    .map((s) => SURFACES.find((x) => x.value === s)?.label)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(a)}>
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(a.id)}
                  aria-label="Löschen"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddonForm({
  draft,
  editingId,
  busy,
  onPatch,
  onToggleSurface,
  onMedia,
  onSave,
  onCancel,
}: {
  draft: AddonInput;
  editingId: string | null;
  busy: boolean;
  onPatch: <K extends keyof AddonInput>(key: K, value: AddonInput[K]) => void;
  onToggleSurface: (s: AddonSurface) => void;
  onMedia: (addonId: string, file: File | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name (Deutsch)">
          <Input
            value={draft.name?.de ?? ""}
            onChange={(e) =>
              onPatch("name", { ...draft.name, de: e.target.value })
            }
          />
        </Field>
        <Field label="Name (Englisch)">
          <Input
            value={draft.name?.en ?? ""}
            onChange={(e) =>
              onPatch("name", { ...draft.name, en: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Beschreibung (Deutsch)">
          <Textarea
            value={draft.description?.de ?? ""}
            onChange={(e) =>
              onPatch("description", { ...draft.description, de: e.target.value })
            }
          />
        </Field>
        <Field label="Beschreibung (Englisch)">
          <Textarea
            value={draft.description?.en ?? ""}
            onChange={(e) =>
              onPatch("description", { ...draft.description, en: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Preis (€)">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={draft.price ?? 0}
            onChange={(e) => onPatch("price", Number(e.target.value))}
          />
        </Field>
        <Field label="Abrechnungsbasis">
          <NativeSelect
            value={draft.basis}
            onChange={(e) => onPatch("basis", e.target.value as Addon["basis"])}
          >
            {BASIS_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Steuersatz (%)">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.tax_rate ?? ""}
            onChange={(e) =>
              onPatch("tax_rate", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Erscheint in</span>
        <div className="flex flex-wrap gap-4">
          {SURFACES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={(draft.appears_in ?? []).includes(s.value)}
                onChange={() => onToggleSurface(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Wann anzeigen">
          <NativeSelect
            value={draft.available_until}
            onChange={(e) =>
              onPatch("available_until", e.target.value as Addon["available_until"])
            }
          >
            {AVAILABILITY.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reihenfolge">
          <Input
            type="number"
            min={0}
            value={draft.sort_order ?? 0}
            onChange={(e) => onPatch("sort_order", Number(e.target.value))}
          />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.mandatory ?? false}
              onChange={(e) => onPatch("mandatory", e.target.checked)}
            />
            Pflicht (immer dazu)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.active ?? true}
              onChange={(e) => onPatch("active", e.target.checked)}
            />
            Aktiv
          </label>
        </div>
      </div>

      {/* Medien: Upload nur möglich, wenn das Add-on schon existiert (braucht ID). */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Medien ({(draft.media ?? []).length}/5)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {(draft.media ?? []).map((url) => (
            <span
              key={url}
              className="size-16 overflow-hidden rounded-(--radius) bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </span>
          ))}
          {editingId ? (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-(--radius) border border-dashed text-muted-foreground hover:text-foreground">
              <Icon icon="ph:plus" className="size-5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onMedia(editingId, e.target.files?.[0])}
              />
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              Medien nach dem ersten Speichern hochladbar.
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
