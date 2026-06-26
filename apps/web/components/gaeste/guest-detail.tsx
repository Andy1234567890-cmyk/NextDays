"use client";

// Gästekarte (Enterprise-Detail), angelehnt an OPERA Cloud „Manage Profile" /
// protel Gästekartei — eigenes myNextDays-Design. Kopf-Karte + Übersichts-Spalte
// + Tab-Sektionen. Felder sind serverseitig maskiert; nicht erlaubte Tabs/
// Aktionen werden ausgeblendet. Sub-Ressourcen werden je Tab nachgeladen.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import { formatCurrency } from "@/lib/currency";
import type { GuestAccess } from "@/lib/guests-access";
import { listProperties } from "@/lib/properties";
import {
  type Guest,
  type GuestAddress,
  type GuestConsent,
  type GuestContact,
  type GuestIdentityDoc,
  type GuestInvoice,
  type GuestNote,
  type GuestReservation,
  type GuestThread,
  addAddress,
  addConsent,
  addContact,
  addIdentityDoc,
  addNote,
  deleteAddress,
  deleteContact,
  deleteIdentityDoc,
  deleteNote,
  getPreferences,
  listAddresses,
  listConsents,
  listContacts,
  listDocuments,
  listGuestInvoices,
  listGuestReservations,
  listGuestThreads,
  listIdentityDocs,
  listNotes,
  savePreferences,
  updateGuest,
} from "@/lib/guests";

type TabKey =
  | "overview"
  | "contact"
  | "identity"
  | "preferences"
  | "reservations"
  | "invoices"
  | "messages"
  | "notes"
  | "documents"
  | "gdpr";

export function GuestDetail({
  guest,
  access,
}: {
  guest: Guest;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [editing, setEditing] = useState(false);
  // Reservierungs-Wizard (rechter Slider), vorbefüllt mit diesem Gast.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProps, setWizardProps] = useState<{ id: string; title: string }[] | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);

  const openWizard = async () => {
    setWizardLoading(true);
    // Objektliste erst beim Öffnen laden (im Wizard wählbar).
    const res = await listProperties();
    setWizardLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setWizardProps(res.data.items.map((p) => ({ id: p.id, title: p.title })));
    setWizardOpen(true);
  };

  // Heute + übermorgen als sinnvoller Default-Zeitraum (im Wizard änderbar).
  const today = new Date();
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const defaultCheckIn = isoDay(today);
  const defaultCheckOut = isoDay(new Date(today.getTime() + 2 * 86400000));

  // Tabs je nach Berechtigung. Identität nur mit idDocs; Finanzen nur mit Beträgen.
  const tabs: TabKey[] = [
    "overview",
    "contact",
    ...(access.idDocs ? (["identity"] as TabKey[]) : []),
    "preferences",
    "reservations",
    ...(access.amounts ? (["invoices"] as TabKey[]) : []),
    "messages",
    "notes",
    "documents",
    "gdpr",
  ];

  const initials = (guest.name ?? "—")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf-Karte */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 font-display text-lg font-bold text-accent">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold">{guest.name ?? "—"}</h1>
              {guest.vip_code && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {guest.vip_code}
                </span>
              )}
              {guest.is_blocked && (
                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  <Icon icon="ph:prohibit" className="size-3.5" />
                  {t("blocked")}
                </span>
              )}
            </div>
            {access.contact && (
              <p className="text-sm text-muted-foreground">
                {[guest.email, guest.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("auditLine", {
                created: guest.created_at?.slice(0, 10) ?? "—",
                updated: guest.updated_at?.slice(0, 10) ?? "—",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {access.canEdit && (
            <Button
              type="button"
              variant={editing ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTab("overview");
                setEditing((v) => !v);
              }}
            >
              <Icon icon="ph:pencil-simple" className="size-4" />
              {editing ? t("editingActive") : t("edit")}
            </Button>
          )}
          {access.canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openWizard}
              disabled={wizardLoading}
            >
              <Icon icon="ph:calendar-plus" className="size-4" />
              {t("actionNewReservation")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTab("messages")}
          >
            <Icon icon="ph:chat-circle" className="size-4" />
            {t("actionMessage")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Übersichts-Spalte */}
        <aside className="col-span-12 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-sm lg:col-span-3">
          <Kv label={t("nationality")} value={guest.nationality} />
          <Kv label={t("language")} value={guest.language} />
          <Kv label={t("currency")} value={guest.currency} />
          <Kv label={t("vipCode")} value={guest.vip_code} />
          <Kv label={t("segment")} value={guest.segment} />
          <Kv label={t("stays")} value={String(guest.stays_count)} />
          {access.amounts && guest.total_revenue != null && (
            <Kv
              label={t("totalRevenue")}
              value={
                guest.currency
                  ? formatCurrency(guest.total_revenue, guest.currency)
                  : guest.total_revenue.toLocaleString("de-DE")
              }
            />
          )}
          {guest.is_blocked && guest.block_reason && (
            <div className="mt-2 rounded-(--radius) bg-destructive/10 p-2 text-xs text-destructive">
              {t("blockReason")}: {guest.block_reason}
            </div>
          )}
        </aside>

        {/* Tab-Bereich */}
        <section className="col-span-12 lg:col-span-9">
          <div className="mb-3 flex flex-wrap gap-4 border-b border-border text-sm">
            {tabs.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={
                  k === tab
                    ? "border-b-2 border-accent pb-2 font-semibold text-accent"
                    : "pb-2 text-muted-foreground hover:text-foreground"
                }
              >
                {t(`tab.${k}`)}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <OverviewTab
              guest={guest}
              access={access}
              editing={editing}
              onDone={() => setEditing(false)}
            />
          )}
          {tab === "contact" && <ContactTab guest={guest} access={access} />}
          {tab === "identity" && access.idDocs && (
            <IdentityTab guestId={guest.id} access={access} />
          )}
          {tab === "preferences" && <PreferencesTab guestId={guest.id} access={access} />}
          {tab === "reservations" && <ReservationsTab guestId={guest.id} access={access} />}
          {tab === "invoices" && access.amounts && <InvoicesTab guestId={guest.id} />}
          {tab === "messages" && <MessagesTab guestId={guest.id} />}
          {tab === "notes" && <NotesTab guestId={guest.id} access={access} />}
          {tab === "documents" && <DocumentsTab guestId={guest.id} />}
          {tab === "gdpr" && <GdprTab guestId={guest.id} access={access} />}
        </section>
      </div>

      {/* Neue Reservierung als rechter Slider — vorbefüllt mit diesem Gast,
          Objekt + Zeitraum im Wizard wählbar, fester guest_id (keine Dublette). */}
      {wizardOpen && wizardProps && (
        <ReservationWizard
          open
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            toast.success(t("reservationCreated"));
            router.refresh(); // Kennzahlen + Reservierungs-Tab aktualisieren
            setTab("reservations");
          }}
          properties={wizardProps}
          initialPropertyId={wizardProps[0]?.id ?? ""}
          checkIn={defaultCheckIn}
          checkOut={defaultCheckOut}
          basePrice={0}
          guestId={guest.id}
          initialGuest={{
            first_name: guest.first_name,
            last_name: access.fullName ? guest.last_name : null,
            email: guest.email,
            phone: guest.phone,
            language: guest.language,
          }}
          editableDates
        />
      )}
    </div>
  );
}

// Bekannte Ausweistypen über i18n; unbekannte als Rohwert anzeigen.
function docLabel(t: (k: string) => string, docType: string): string {
  const known = ["id_card", "passport", "driver_license"];
  return known.includes(docType) ? t(`docType.${docType}`) : docType;
}

function Kv({ label, value }: { label: string; value: string | null | undefined }) {
  // Label klein darüber, Wert linksbündig direkt darunter — saubere
  // Definitionsliste; rechtsbündige Werte (justify-between) wirkten im
  // 2-Spalten-Grid zerrissen.
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">{children}</div>
  );
}

// Stammdaten: Ansicht ODER Edit-Formular. Im Edit-Modus wird per PATCH nur das
// Geänderte gesendet (Diff gegen den geladenen Gast). Maskierte Felder (Nachname
// ohne view_guest_name) sind gesperrt und werden nicht vorbelegt.
function OverviewTab({
  guest,
  access,
  editing,
  onDone,
}: {
  guest: Guest;
  access: GuestAccess;
  editing: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("guests");
  const router = useRouter();
  const [pending, start] = useTransition();
  // Editierbare Felder (Strings; null → "").
  const fields = [
    "salutation", "title", "first_name", "last_name", "birth_date",
    "birth_place", "nationality", "language", "currency", "company",
    "position", "vat_id", "vip_code", "segment", "block_reason",
  ] as const;
  type FieldKey = (typeof fields)[number];
  const initial = () => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f] = (guest[f] as string | null) ?? "";
    return o;
  };
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [blocked, setBlocked] = useState(guest.is_blocked);

  // Nachname nur editierbar, wenn voller Name sichtbar (sonst maskiert).
  const locked = (f: FieldKey) => f === "last_name" && !access.fullName;
  const set = (f: FieldKey, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const save = () =>
    start(async () => {
      // Diff: nur tatsächlich geänderte Felder senden.
      const patch: Record<string, unknown> = {};
      for (const f of fields) {
        if (locked(f)) continue;
        const before = (guest[f] as string | null) ?? "";
        if (form[f] !== before) patch[f] = form[f] === "" ? null : form[f];
      }
      if (blocked !== guest.is_blocked) patch.is_blocked = blocked;
      if (Object.keys(patch).length === 0) {
        onDone();
        return;
      }
      const res = await updateGuest(guest.id, patch);
      if (res.ok) {
        toast.success(t("saved"));
        onDone();
        router.refresh(); // Kopf-Karte + Tabs konsistent halten
      } else {
        toast.error(res.error);
      }
    });

  if (!editing) {
    return (
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Kv label={t("salutation")} value={guest.salutation} />
          <Kv label={t("title2")} value={guest.title} />
          <Kv label={t("firstName")} value={guest.first_name} />
          <Kv label={t("lastName")} value={access.fullName ? guest.last_name : null} />
          <Kv label={t("birthDate")} value={guest.birth_date} />
          <Kv label={t("birthPlace")} value={guest.birth_place} />
          <Kv label={t("company")} value={guest.company} />
          <Kv label={t("position")} value={guest.position} />
          <Kv label={t("vatId")} value={guest.vat_id} />
          {access.source && <Kv label={t("source")} value={guest.source} />}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <EditField label={t("salutation")} value={form.salutation} onChange={(v) => set("salutation", v)} />
        <EditField label={t("title2")} value={form.title} onChange={(v) => set("title", v)} />
        <EditField label={t("firstName")} value={form.first_name} onChange={(v) => set("first_name", v)} />
        <EditField
          label={t("lastName")}
          value={form.last_name}
          onChange={(v) => set("last_name", v)}
          disabled={locked("last_name")}
          placeholder={locked("last_name") ? "•••" : undefined}
        />
        <EditField label={t("birthDate")} type="date" value={form.birth_date} onChange={(v) => set("birth_date", v)} />
        <EditField label={t("birthPlace")} value={form.birth_place} onChange={(v) => set("birth_place", v)} />
        <EditField label={t("nationality")} value={form.nationality} onChange={(v) => set("nationality", v)} />
        <EditField label={t("language")} value={form.language} onChange={(v) => set("language", v)} />
        <EditField label={t("currency")} value={form.currency} onChange={(v) => set("currency", v)} />
        <EditField label={t("company")} value={form.company} onChange={(v) => set("company", v)} />
        <EditField label={t("position")} value={form.position} onChange={(v) => set("position", v)} />
        <EditField label={t("vatId")} value={form.vat_id} onChange={(v) => set("vat_id", v)} />
        <EditField label={t("vipCode")} value={form.vip_code} onChange={(v) => set("vip_code", v)} />
        <EditField label={t("segment")} value={form.segment} onChange={(v) => set("segment", v)} />
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("isBlocked")}
        </label>
        {blocked && (
          <EditField
            label={t("blockReason")}
            value={form.block_reason}
            onChange={(v) => set("block_reason", v)}
          />
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ContactTab({ guest, access }: { guest: Guest; access: GuestAccess }) {
  const t = useTranslations("guests");
  const [addresses, setAddresses] = useState<GuestAddress[] | null>(null);
  const [contacts, setContacts] = useState<GuestContact[] | null>(null);
  const loadAddr = useCallback(() => {
    listAddresses(guest.id).then((r) => r.ok && setAddresses(r.data.items));
  }, [guest.id]);
  const loadCont = useCallback(() => {
    listContacts(guest.id).then((r) => r.ok && setContacts(r.data.items));
  }, [guest.id]);
  useEffect(() => {
    if (!access.contact) return;
    loadAddr();
    loadCont();
  }, [access.contact, loadAddr, loadCont]);

  if (!access.contact) {
    return <Card>{t("contactMasked")}</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Kv label={t("email")} value={guest.email} />
          <Kv label={t("phone")} value={guest.phone} />
          <Kv label={t("colName")} value={guest.name} />
        </div>
      </Card>

      {/* Adressen */}
      <SubList
        title={t("addresses")}
        items={addresses}
        canEdit={access.canEdit}
        render={(a: GuestAddress) =>
          [a.street, a.house_no, a.postal_code, a.city, a.country]
            .filter(Boolean)
            .join(" ") || a.type
        }
        onDelete={async (id) => {
          const res = await deleteAddress(guest.id, id);
          if (res.ok) {
            toast.success(t("deleted"));
            loadAddr();
          } else toast.error(res.error);
        }}
        addLabel={t("addAddress")}
        fields={[
          { key: "street", label: t("street") },
          { key: "house_no", label: t("houseNo") },
          { key: "postal_code", label: t("postalCode") },
          { key: "city", label: t("city") },
          { key: "country", label: t("country") },
        ]}
        onAdd={async (vals) => {
          const res = await addAddress(guest.id, { type: "private", ...vals });
          if (res.ok) {
            toast.success(t("added"));
            loadAddr();
            return true;
          }
          toast.error(res.error);
          return false;
        }}
      />

      {/* Kontakte */}
      <SubList
        title={t("contacts")}
        items={contacts}
        canEdit={access.canEdit}
        render={(c: GuestContact) => `${c.type}: ${c.value}`}
        onDelete={async (id) => {
          const res = await deleteContact(guest.id, id);
          if (res.ok) {
            toast.success(t("deleted"));
            loadCont();
          } else toast.error(res.error);
        }}
        addLabel={t("addContact")}
        fields={[
          { key: "type", label: t("contactType") },
          { key: "value", label: t("contactValue") },
        ]}
        onAdd={async (vals) => {
          if (!vals.value?.trim()) return false;
          const res = await addContact(guest.id, {
            type: vals.type || "mobile",
            value: vals.value.trim(),
          });
          if (res.ok) {
            toast.success(t("added"));
            loadCont();
            return true;
          }
          toast.error(res.error);
          return false;
        }}
      />
    </div>
  );
}

// Generische Sub-Liste mit „Hinzufügen"-Inline-Form + Löschen (nur canEdit).
function SubList<T extends { id: string }>({
  title,
  items,
  canEdit,
  render,
  onDelete,
  addLabel,
  fields,
  onAdd,
}: {
  title: string;
  items: T[] | null;
  canEdit: boolean;
  render: (item: T) => string;
  onDelete: (id: string) => void | Promise<void>;
  addLabel: string;
  fields: { key: string; label: string }[];
  onAdd: (vals: Record<string, string>) => Promise<boolean>;
}) {
  const t = useTranslations("guests");
  const [adding, setAdding] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const submit = async () => {
    const ok = await onAdd(vals);
    if (ok) {
      setVals({});
      setAdding(false);
    }
  };
  return (
    <Card>
      <p className="mb-2 font-medium">{title}</p>
      {items === null ? (
        "…"
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 border-b border-border pb-1 last:border-0">
              <span>{render(it)}</span>
              {canEdit && (
                <button type="button" aria-label={t("delete")} onClick={() => onDelete(it.id)}>
                  <Icon icon="ph:trash" className="size-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit &&
        (adding ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <Input
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              </label>
            ))}
            <Button type="button" onClick={submit}>
              {t("add")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {addLabel}
          </Button>
        ))}
    </Card>
  );
}

function IdentityTab({
  guestId,
  access,
}: {
  guestId: string;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const [docs, setDocs] = useState<GuestIdentityDoc[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [docType, setDocType] = useState("passport");
  const [number, setNumber] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const load = useCallback(() => {
    listIdentityDocs(guestId).then((r) => r.ok && setDocs(r.data.items));
  }, [guestId]);
  useEffect(() => load(), [load]);

  const add = async () => {
    if (!number.trim()) return;
    const res = await addIdentityDoc(guestId, {
      doc_type: docType,
      number: number.trim(),
      valid_until: validUntil || undefined,
    });
    if (res.ok) {
      toast.success(t("added"));
      setNumber("");
      setValidUntil("");
      setAdding(false);
      load();
    } else {
      toast.error(res.error);
    }
  };
  const remove = async (id: string) => {
    const res = await deleteIdentityDoc(guestId, id);
    if (res.ok) {
      toast.success(t("deleted"));
      load();
    } else {
      toast.error(res.error);
    }
  };

  if (docs === null) return <Card>…</Card>;
  return (
    <Card>
      {docs.length === 0 ? (
        <p className="text-muted-foreground">{t("noIdentityDocs")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <span className="flex-1">{docLabel(t, d.doc_type)}</span>
              <span className="font-mono">{d.number ?? "—"}</span>
              <span className="text-muted-foreground">{d.valid_until ?? "—"}</span>
              {access.canEdit && (
                <button type="button" aria-label={t("delete")} onClick={() => remove(d.id)}>
                  <Icon icon="ph:trash" className="size-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {access.canEdit &&
        (adding ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("docTypeLabel")}</span>
              <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="passport">{t("docType.passport")}</option>
                <option value="id_card">{t("docType.id_card")}</option>
                <option value="driver_license">{t("docType.driver_license")}</option>
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("docNumber")}</span>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("validUntil")}</span>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
            <Button type="button" onClick={add}>
              {t("add")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("addIdentityDoc")}
          </Button>
        ))}
    </Card>
  );
}

function PreferencesTab({
  guestId,
  access,
}: {
  guestId: string;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [wishes, setWishes] = useState("");
  const [dietary, setDietary] = useState("");
  const [roomPref, setRoomPref] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    getPreferences(guestId).then((r) => {
      if (r.ok) {
        setWishes(r.data.wishes ?? "");
        setDietary(r.data.dietary ?? "");
        setRoomPref(r.data.room_preferences ?? "");
      }
      setLoaded(true);
    });
  }, [guestId]);

  const save = () =>
    start(async () => {
      const res = await savePreferences(guestId, {
        wishes: wishes || null,
        dietary: dietary || null,
        room_preferences: roomPref || null,
      });
      if (res.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  if (!loaded) return <Card>…</Card>;
  if (!access.canEdit) {
    return (
      <Card>
        <p className="mb-1 text-muted-foreground">{t("wishes")}</p>
        <p className="whitespace-pre-wrap">{wishes || "—"}</p>
        <p className="mb-1 mt-3 text-muted-foreground">{t("dietary")}</p>
        <p className="whitespace-pre-wrap">{dietary || "—"}</p>
        <p className="mb-1 mt-3 text-muted-foreground">{t("roomPreferences")}</p>
        <p className="whitespace-pre-wrap">{roomPref || "—"}</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("roomPreferences")}</span>
          <Input value={roomPref} onChange={(e) => setRoomPref(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dietary")}</span>
          <Input value={dietary} onChange={(e) => setDietary(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("wishes")}</span>
          <Textarea value={wishes} onChange={(e) => setWishes(e.target.value)} rows={4} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}

function ReservationsTab({ guestId, access }: { guestId: string; access: GuestAccess }) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestReservation[] | null>(null);
  // Geöffnete Reservierung → Detail-Slider (mit Zusatzbuchungen + Storno).
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(() => {
    listGuestReservations(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  useEffect(reload, [reload]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const money = (v: number, cur: string | null) =>
    cur ? formatCurrency(v, cur) : v.toLocaleString("de-DE");

  if (items === null) return <Card>…</Card>;
  if (items.length === 0) return <Card>{t("noReservations")}</Card>;
  return (
    <>
      <Card>
        <ul className="flex flex-col gap-1">
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex w-full items-center justify-between gap-3 rounded-(--radius) px-2 py-2 text-left hover:bg-muted/60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {r.check_in ?? "—"} – {r.check_out ?? "—"}
                  </span>
                  {access.amounts && r.addons_total != null && r.addons_total > 0 && (
                    <span className="text-xs text-muted-foreground">
                      + {money(r.addons_total, r.currency)} {t("addons")}
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{r.status ?? "—"}</span>
                {access.amounts && (
                  <span className="shrink-0 font-medium">
                    {r.total_amount != null ? money(r.total_amount, r.currency) : "—"}
                  </span>
                )}
                <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {openId && (
        <ReservationDetailSlider
          reservationId={openId}
          todayKey={todayKey}
          onClose={() => setOpenId(null)}
          onCancelled={() => {
            setOpenId(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function InvoicesTab({ guestId }: { guestId: string }) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestInvoice[] | null>(null);
  useEffect(() => {
    listGuestInvoices(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  if (items === null) return <Card>…</Card>;
  if (items.length === 0) return <Card>{t("noInvoices")}</Card>;
  return (
    <Card>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <span>{i.invoice_number ?? "—"}</span>
            <span className="text-muted-foreground">{i.status ?? "—"}</span>
            <span className="font-medium">
              {i.gross_amount != null
                ? `${i.gross_amount.toLocaleString("de-DE")} ${i.currency ?? ""}`
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MessagesTab({ guestId }: { guestId: string }) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestThread[] | null>(null);
  useEffect(() => {
    listGuestThreads(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  if (items === null) return <Card>…</Card>;
  if (items.length === 0) return <Card>{t("noThreads")}</Card>;
  return (
    <Card>
      <ul className="flex flex-col gap-2">
        {items.map((th) => (
          <li key={th.id} className="border-b border-border pb-2 last:border-0">
            <a
              href={`/posteingang?thread=${th.id}`}
              className="flex items-center justify-between gap-2 rounded-(--radius) px-1 py-1 hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                <Icon icon="ph:chat-circle" className="size-4 text-muted-foreground" />
                {th.ota_name ?? "—"}
              </span>
              <span className="text-muted-foreground">{th.ota_reservation_code ?? "—"}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NotesTab({
  guestId,
  access,
}: {
  guestId: string;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestNote[] | null>(null);
  const [body, setBody] = useState("");
  const load = useCallback(() => {
    listNotes(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  useEffect(() => load(), [load]);
  const save = async () => {
    if (!body.trim()) return;
    const res = await addNote(guestId, { body: body.trim() });
    if (res.ok) {
      toast.success(t("added"));
      setBody("");
      load();
    } else {
      toast.error(res.error);
    }
  };
  const remove = async (id: string) => {
    const res = await deleteNote(guestId, id);
    if (res.ok) {
      toast.success(t("deleted"));
      load();
    } else {
      toast.error(res.error);
    }
  };
  return (
    <Card>
      {access.canEdit && (
        <div className="mb-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("notePlaceholder")}
            className="flex-1 rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <Button type="button" onClick={save}>
            {t("addNote")}
          </Button>
        </div>
      )}
      {items === null ? (
        "…"
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t("noNotes")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id} className="rounded-(--radius) bg-muted/40 p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {n.author_name ?? "—"} · {n.created_at.slice(0, 10)}
                </p>
                {access.canEdit && (
                  <button type="button" aria-label={t("delete")} onClick={() => remove(n.id)}>
                    <Icon icon="ph:trash" className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DocumentsTab({ guestId }: { guestId: string }) {
  const t = useTranslations("guests");
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    listDocuments(guestId).then((r) => r.ok && setCount(r.data.total));
  }, [guestId]);
  return <Card>{count === null ? "…" : t("documentsCount", { count })}</Card>;
}

function GdprTab({
  guestId,
  access,
}: {
  guestId: string;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestConsent[] | null>(null);
  const load = useCallback(() => {
    listConsents(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  useEffect(() => load(), [load]);
  const setConsent = async (type: string, status: string) => {
    const res = await addConsent(guestId, { consent_type: type, status });
    if (res.ok) {
      toast.success(t("saved"));
      load();
    } else {
      toast.error(res.error);
    }
  };
  return (
    <Card>
      {access.canEdit && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setConsent("marketing_email", "granted")}>
            {t("consentGrant")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setConsent("marketing_email", "revoked")}>
            {t("consentRevoke")}
          </Button>
        </div>
      )}
      {items === null ? (
        "…"
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t("noConsents")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((c) => (
            <li key={c.id} className="flex justify-between border-b border-border pb-1 last:border-0">
              <span>{c.consent_type}</span>
              <span className={c.status === "granted" ? "text-green-600" : "text-destructive"}>
                {c.status}
              </span>
              <span className="text-muted-foreground">{c.created_at.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
