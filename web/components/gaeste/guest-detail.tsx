"use client";

// Gästekarte (Enterprise-Detail), angelehnt an OPERA Cloud „Manage Profile" /
// protel Gästekartei — eigenes myNextDays-Design. Kopf-Karte + Übersichts-Spalte
// + Tab-Sektionen. Felder sind serverseitig maskiert; nicht erlaubte Tabs/
// Aktionen werden ausgeblendet. Sub-Ressourcen werden je Tab nachgeladen.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";

import { useRealtime } from "@/lib/use-realtime";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { OverflowTabs } from "@nextdays/ui/overflow-tabs";
import { Textarea } from "@nextdays/ui/textarea";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import { STATUS_META } from "@/lib/calendar-status";
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
      {/* Kopf-Banner mit Ordner-Tabs (Layout-Referenz Casona: farbiges Band,
          Kicker + großer Name, Tabs als angesetzte Reiter — der aktive Reiter
          geht nahtlos in den Inhalt über). Farbe = myNextDays-Akzent-Token. */}
      <div className="rounded-2xl bg-accent text-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">
              {initials}
            </div>
            <div>
              <p className="text-sm text-white/70">{t("kicker")}</p>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold">
                  {guest.name ?? "—"}
                </h1>
                {guest.vip_code && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                    {guest.vip_code}
                  </span>
                )}
                {guest.is_blocked && (
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                    <Icon icon="ph:prohibit" className="size-3.5" />
                    {t("blocked")}
                  </span>
                )}
              </div>
              {access.contact && (
                <p className="text-sm text-white/80">
                  {[guest.email, guest.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              )}
              <p className="mt-1 text-xs text-white/60">
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
                size="sm"
                className="bg-card text-foreground hover:bg-card/90"
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
                size="sm"
                className="bg-card text-foreground hover:bg-card/90"
                onClick={openWizard}
                disabled={wizardLoading}
              >
                <Icon icon="ph:calendar-plus" className="size-4" />
                {t("actionNewReservation")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-card text-foreground hover:bg-card/90"
              onClick={() => setTab("messages")}
            >
              <Icon icon="ph:chat-circle" className="size-4" />
              {t("actionMessage")}
            </Button>
          </div>
        </div>

        {/* Einzeilige Tab-Leiste am Band-Unterrand; überzählige Tabs hinter
            „⋯". Aktiv = Inhalts-Hintergrund, inaktiv = aufgehellter Reiter. */}
        <div className="px-4 pb-1">
          <OverflowTabs
            tone="accent"
            active={tab}
            onSelect={(k) => setTab(k as TabKey)}
            tabs={tabs.map((k) => ({ key: k, label: t(`tab.${k}`) }))}
          />
        </div>
      </div>

      {/* Tab-Inhalt (die Übersicht bringt ihre eigene Zwei-Spalten-Struktur
          mit — Hauptspalte + rechte Info-Leiste). */}
      <section>

        {tab === "overview" && (
          <OverviewTab
            guest={guest}
            access={access}
            editing={editing}
            onDone={() => setEditing(false)}
            onEdit={() => setEditing(true)}
            onOpenTab={(k) => setTab(k)}
            onNewReservation={openWizard}
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

// Karte mit Titelzeile + optionaler Aktions-Fußzeile (Layout-Referenz Casona:
// Inhalt oben, Aktion unten abgesetzt) — Farben/Radien = myNextDays-Tokens.
function SectionCard({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-sm">
      <div className="px-5 pt-4">
        <h2 className="font-display text-base font-extrabold">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="border-t border-border bg-secondary/40 px-5 py-3">{footer}</div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// Notizen-Kachel der Info-Leiste: jüngste Notizen als Zettel, Rest im Tab.
function NotesRailCard({ guestId, onOpen }: { guestId: string; onOpen: () => void }) {
  const t = useTranslations("guests");
  const [items, setItems] = useState<GuestNote[] | null>(null);
  const load = useCallback(() => {
    listNotes(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  useEffect(() => load(), [load]);
  useRealtime({ table: "guest_notes", filter: `guest_id=eq.${guestId}`, onChange: load });
  return (
    <SectionCard
      title={t("tab.notes")}
      footer={
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Icon icon="ph:note-pencil" className="size-4" />
          {t("addNote")}
        </button>
      }
    >
      {items === null ? (
        "…"
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t("noNotes")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 3).map((n) => (
            <li
              key={n.id}
              className="rounded-(--radius) border border-warning/30 bg-warning/10 p-2.5 text-sm"
            >
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// Dokumente-Kachel der Info-Leiste (Anzahl + Sprung in den Tab).
function DocumentsRailCard({ guestId, onOpen }: { guestId: string; onOpen: () => void }) {
  const t = useTranslations("guests");
  const [count, setCount] = useState<number | null>(null);
  const load = useCallback(() => {
    listDocuments(guestId).then((r) => r.ok && setCount(r.data.total));
  }, [guestId]);
  useEffect(() => load(), [load]);
  useRealtime({ table: "guest_documents", filter: `guest_id=eq.${guestId}`, onChange: load });
  return (
    <SectionCard
      title={t("tab.documents")}
      footer={
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Icon icon="ph:folder-open" className="size-4" />
          {t("tab.documents")}
        </button>
      }
    >
      <p className="text-muted-foreground">
        {count === null ? "…" : t("documentsCount", { count })}
      </p>
    </SectionCard>
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
  onEdit,
  onOpenTab,
  onNewReservation,
}: {
  guest: Guest;
  access: GuestAccess;
  editing: boolean;
  onDone: () => void;
  onEdit: () => void;
  onOpenTab: (k: TabKey) => void;
  onNewReservation: () => void;
}) {
  const t = useTranslations("guests");
  const locale = useLocale();
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

  // Formular beim EDIT-START vom aktuellen guest initialisieren — der Mount-
  // Stand kann durch Realtime-Refreshes längst veraltet sein; save() difft
  // gegen die frische Prop und würde sonst Fremdänderungen still zurückdrehen.
  useEffect(() => {
    if (editing) {
      setForm(initial());
      setBlocked(guest.is_blocked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Nachname nur editierbar, wenn voller Name sichtbar (sonst maskiert).
  const locked = (f: FieldKey) => f === "last_name" && !access.fullName;
  const set = (f: FieldKey, v: string) => setForm((p) => ({ ...p, [f]: v }));

  // Reservierungen EINMAL laden (Reservierungs-Karte + Statistik teilen sie):
  // die Statistik leitet daraus die Anzeige-Währung ab — guests.currency ist
  // bei automatisch angelegten Gästen leer, die Buchungen tragen die Wahrheit.
  const [resItems, setResItems] = useState<GuestReservation[] | null>(null);
  const reloadRes = useCallback(() => {
    listGuestReservations(guest.id).then((r) => r.ok && setResItems(r.data.items));
  }, [guest.id]);
  useEffect(reloadRes, [reloadRes]);
  useRealtime({
    table: "reservations",
    filter: `guest_id=eq.${guest.id}`,
    onChange: reloadRes,
  });
  const displayCurrency =
    guest.currency ||
    resItems?.find((r) => r.currency)?.currency ||
    null;

  // Einzelfeld-Popup (Layout-Referenz Casona): Klick auf ein Feld öffnet einen
  // kleinen Dialog NUR für dieses Feld — schnelle Korrektur ohne den großen
  // Bearbeiten-Modus. Speichern schickt ein Ein-Feld-PATCH.
  const [fieldEdit, setFieldEdit] = useState<
    { key: FieldKey; label: string; type?: string } | null
  >(null);
  const [fieldValue, setFieldValue] = useState("");
  const [fieldSaving, setFieldSaving] = useState(false);
  const openField = (key: FieldKey, label: string, type?: string) => {
    if (!access.canEdit || locked(key)) return;
    setFieldValue((guest[key] as string | null) ?? "");
    setFieldEdit({ key, label, type });
  };
  const saveField = async () => {
    if (!fieldEdit) return;
    const before = (guest[fieldEdit.key] as string | null) ?? "";
    if (fieldValue === before) {
      setFieldEdit(null);
      return;
    }
    setFieldSaving(true);
    const res = await updateGuest(guest.id, {
      [fieldEdit.key]: fieldValue === "" ? null : fieldValue,
    });
    setFieldSaving(false);
    if (res.ok) {
      toast.success(t("saved"));
      setFieldEdit(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };
  const fmtMoney = (v: number) =>
    displayCurrency ? formatCurrency(v, displayCurrency) : v.toLocaleString(locale);
  const fmtDay = (s: string | null) =>
    s
      ? new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

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
      <div className="grid grid-cols-12 items-start gap-4">
        {/* Hauptspalte: Persönliche Daten + Reservierungen */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          <SectionCard
            title={t("personalData")}
            footer={
              access.canEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                  {t("edit")}
                </button>
              ) : undefined
            }
          >
            {/* 3er-Zeilen mit Trennlinien (Casona-Raster). Klick auf ein Feld
                öffnet das Einzelfeld-Popup (openField). */}
            <div className="flex flex-col divide-y divide-border">
              {(
                [
                  [
                    { key: "first_name", label: t("firstName"), value: guest.first_name },
                    {
                      key: "last_name",
                      label: t("lastName"),
                      value: access.fullName ? guest.last_name : null,
                    },
                    { key: "nationality", label: t("nationality"), value: guest.nationality },
                  ],
                  [
                    { key: "language", label: t("language"), value: guest.language },
                    {
                      key: "birth_date",
                      label: t("birthDate"),
                      value: guest.birth_date ? fmtDay(guest.birth_date) : null,
                      type: "date",
                    },
                    { key: "birth_place", label: t("birthPlace"), value: guest.birth_place },
                  ],
                  [
                    { key: "salutation", label: t("salutation"), value: guest.salutation },
                    { key: "title", label: t("title2"), value: guest.title },
                    {
                      key: "currency",
                      label: t("currency"),
                      value: guest.currency || displayCurrency,
                    },
                  ],
                  [
                    { key: "company", label: t("company"), value: guest.company },
                    { key: "position", label: t("position"), value: guest.position },
                    { key: "vat_id", label: t("vatId"), value: guest.vat_id },
                  ],
                  [
                    { key: "vip_code", label: t("vipCode"), value: guest.vip_code },
                    { key: "segment", label: t("segment"), value: guest.segment },
                    ...(access.source
                      ? [{ key: null, label: t("source"), value: guest.source }]
                      : []),
                  ],
                ] as {
                  key: FieldKey | null;
                  label: string;
                  value: string | null | undefined;
                  type?: string;
                }[][]
              ).map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-x-6 gap-y-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-3"
                >
                  {row.map((f) =>
                    access.canEdit && f.key && !locked(f.key) ? (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => openField(f.key as FieldKey, f.label, f.type)}
                        className="-mx-2 -my-1 rounded-(--radius) px-2 py-1 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Kv label={f.label} value={f.value} />
                      </button>
                    ) : (
                      <Kv key={f.label} label={f.label} value={f.value} />
                    ),
                  )}
                </div>
              ))}
            </div>

            {/* Einzelfeld-Popup */}
            {fieldEdit && (
              <FormDialog
                title={fieldEdit.label}
                onClose={() => setFieldEdit(null)}
                onSubmit={saveField}
                submitLabel={fieldSaving ? "…" : t("save")}
                cancelLabel={t("cancel")}
              >
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{fieldEdit.label}</span>
                  <Input
                    type={fieldEdit.type ?? "text"}
                    value={fieldValue}
                    autoFocus
                    onChange={(e) => setFieldValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveField();
                    }}
                  />
                </label>
              </FormDialog>
            )}
            {guest.is_blocked && guest.block_reason && (
              <div className="mt-4 rounded-(--radius) bg-destructive/10 p-2.5 text-xs text-destructive">
                {t("blockReason")}: {guest.block_reason}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={t("tab.reservations")}
            footer={
              access.canEdit ? (
                <button
                  type="button"
                  onClick={onNewReservation}
                  className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <Icon icon="ph:plus-circle" className="size-4" />
                  {t("actionNewReservation")}
                </button>
              ) : undefined
            }
          >
            <ReservationList
              guestId={guest.id}
              access={access}
              limit={5}
              items={resItems}
              reload={reloadRes}
            />
          </SectionCard>
        </div>

        {/* Rechte Info-Leiste: Notizen, Statistik, Dokumente */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-4">
          <NotesRailCard guestId={guest.id} onOpen={() => onOpenTab("notes")} />
          <SectionCard title={t("statistics")}>
            <dl className="flex flex-col divide-y divide-border text-sm">
              <StatRow label={t("stays")} value={String(guest.stays_count)} />
              <StatRow label={t("colLastStay")} value={fmtDay(guest.last_stay_at)} />
              {access.amounts && guest.total_revenue != null && (
                <>
                  <StatRow
                    label={t("avgRevenue")}
                    value={
                      guest.stays_count > 0
                        ? fmtMoney(guest.total_revenue / guest.stays_count)
                        : "—"
                    }
                  />
                  <StatRow
                    label={t("totalRevenue")}
                    value={fmtMoney(guest.total_revenue)}
                  />
                </>
              )}
            </dl>
          </SectionCard>
          <DocumentsRailCard guestId={guest.id} onOpen={() => onOpenTab("documents")} />
        </div>
      </div>
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
  // Realtime-Pflicht: Adressen/Kontakte anderer Sessions live spiegeln.
  useRealtime({
    table: "guest_addresses",
    filter: `guest_id=eq.${guest.id}`,
    onChange: loadAddr,
    enabled: access.contact,
  });
  useRealtime({
    table: "guest_contacts",
    filter: `guest_id=eq.${guest.id}`,
    onChange: loadCont,
    enabled: access.contact,
  });

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
        render={(c: GuestContact) => {
          const known = ["mobile", "private", "business", "email"];
          const label = known.includes(c.type) ? t(`contactKind.${c.type}`) : c.type;
          return `${label}: ${c.value}`;
        }}
        onDelete={async (id) => {
          const res = await deleteContact(guest.id, id);
          if (res.ok) {
            toast.success(t("deleted"));
            loadCont();
          } else toast.error(res.error);
        }}
        addLabel={t("addContact")}
        fields={[
          {
            key: "type",
            label: t("contactType"),
            // Feste Auswahl statt Freitext (guest_contacts.type, 0046).
            options: [
              { value: "mobile", label: t("contactKind.mobile") },
              { value: "private", label: t("contactKind.private") },
              { value: "business", label: t("contactKind.business") },
              { value: "email", label: t("contactKind.email") },
            ],
          },
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
  // Feld mit options → Auswahlliste statt Freitext (z. B. Kontakt-Typ).
  fields: { key: string; label: string; options?: { value: string; label: string }[] }[];
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
      {canEdit && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>
          <Icon icon="ph:plus" className="size-4" />
          {addLabel}
        </Button>
      )}
      {/* Hinzufügen als Dialog (Layout-Referenz Casona) statt Inline-Zeile —
          beschriftete Felder untereinander, Aktionen unten. */}
      {adding && (
        <FormDialog
          title={addLabel}
          onClose={() => {
            setAdding(false);
            setVals({});
          }}
          onSubmit={submit}
          submitLabel={t("add")}
          cancelLabel={t("cancel")}
        >
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{f.label}</span>
              {f.options ? (
                <NativeSelect
                  value={vals[f.key] ?? f.options[0]?.value ?? ""}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </FormDialog>
      )}
    </Card>
  );
}

// Zentrierter Formular-Dialog: Titel, gestapelte Felder, Abbrechen/Speichern.
function FormDialog({
  title,
  onClose,
  onSubmit,
  submitLabel,
  cancelLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  cancelLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="✕">
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={() => void onSubmit()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
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
  // Realtime-Pflicht: Ausweisdokumente anderer Sessions live spiegeln.
  useRealtime({
    table: "guest_identity_documents",
    filter: `guest_id=eq.${guestId}`,
    onChange: load,
  });

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
      {access.canEdit && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("addIdentityDoc")}
        </Button>
      )}
      {access.canEdit && adding && (
        <FormDialog
          title={t("addIdentityDoc")}
          onClose={() => setAdding(false)}
          onSubmit={add}
          submitLabel={t("add")}
          cancelLabel={t("cancel")}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("docTypeLabel")}</span>
            <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="passport">{t("docType.passport")}</option>
              <option value="id_card">{t("docType.id_card")}</option>
              <option value="driver_license">{t("docType.driver_license")}</option>
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("docNumber")}</span>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("validUntil")}</span>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
        </FormDialog>
      )}
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
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState({
    room_preferences: "",
    dietary: "",
    wishes: "",
  });
  type PrefKey = keyof typeof prefs;
  // Einzelfeld-Popup wie in der Übersicht (Klick auf Feld → kleiner Dialog).
  const [edit, setEdit] = useState<
    { key: PrefKey; label: string; multiline?: boolean } | null
  >(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPreferences(guestId).then((r) => {
      if (r.ok) {
        setPrefs({
          room_preferences: r.data.room_preferences ?? "",
          dietary: r.data.dietary ?? "",
          wishes: r.data.wishes ?? "",
        });
      }
      setLoaded(true);
    });
  }, [guestId]);

  const openEdit = (key: PrefKey, label: string, multiline = false) => {
    if (!access.canEdit) return;
    setValue(prefs[key]);
    setEdit({ key, label, multiline });
  };
  const save = async () => {
    if (!edit) return;
    setSaving(true);
    // Das Backend-PUT ersetzt ALLE Präferenz-Felder (Upsert) — darum immer
    // den kompletten lokalen Stand mitschicken, nie nur das eine Feld.
    const next = { ...prefs, [edit.key]: value };
    const res = await savePreferences(guestId, {
      room_preferences: next.room_preferences || null,
      dietary: next.dietary || null,
      wishes: next.wishes || null,
    });
    setSaving(false);
    if (res.ok) {
      setPrefs(next);
      toast.success(t("saved"));
      setEdit(null);
    } else {
      toast.error(res.error);
    }
  };

  if (!loaded) return <Card>…</Card>;
  const rows: { key: PrefKey; label: string; multiline?: boolean }[] = [
    { key: "room_preferences", label: t("roomPreferences") },
    { key: "dietary", label: t("dietary") },
    { key: "wishes", label: t("wishes"), multiline: true },
  ];
  return (
    <>
      <SectionCard title={t("tab.preferences")}>
        <div className="flex flex-col divide-y divide-border">
          {rows.map((r) =>
            access.canEdit ? (
              <button
                key={r.key}
                type="button"
                onClick={() => openEdit(r.key, r.label, r.multiline)}
                className="-mx-2 rounded-(--radius) px-2 py-3 text-left first:pt-0 last:pb-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Kv label={r.label} value={prefs[r.key]} />
              </button>
            ) : (
              <div key={r.key} className="py-3 first:pt-0 last:pb-0">
                <Kv label={r.label} value={prefs[r.key]} />
              </div>
            ),
          )}
        </div>
      </SectionCard>
      {edit && (
        <FormDialog
          title={edit.label}
          onClose={() => setEdit(null)}
          onSubmit={save}
          submitLabel={saving ? "…" : t("save")}
          cancelLabel={t("cancel")}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{edit.label}</span>
            {edit.multiline ? (
              <Textarea
                rows={4}
                value={value}
                autoFocus
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <Input
                value={value}
                autoFocus
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
              />
            )}
          </label>
        </FormDialog>
      )}
    </>
  );
}

// Reservierungs-Liste des Gastes (Übersicht-Karte UND Tab): Zeile = Status-
// Badge, Zeitraum mit Pfeil, Upsell-Hinweis, Betrag; Klick öffnet den
// Detail-Slider (mit Check-in/out, Zusatzbuchungen, Storno).
function ReservationList({
  guestId,
  access,
  limit,
  items: itemsProp,
  reload: reloadProp,
}: {
  guestId: string;
  access: GuestAccess;
  limit?: number;
  /** Optional vorgeladen (Übersicht teilt die Liste mit der Statistik). */
  items?: GuestReservation[] | null;
  reload?: () => void;
}) {
  const t = useTranslations("guests");
  const locale = useLocale();
  const managed = itemsProp !== undefined;
  const [ownItems, setOwnItems] = useState<GuestReservation[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const ownReload = useCallback(() => {
    listGuestReservations(guestId).then((r) => r.ok && setOwnItems(r.data.items));
  }, [guestId]);
  useEffect(() => {
    if (!managed) ownReload();
  }, [managed, ownReload]);
  // Realtime-Pflicht: neue/geänderte Aufenthalte dieses Gasts live spiegeln
  // (nur wenn die Liste nicht vom Eltern-Layout verwaltet wird).
  useRealtime({
    table: "reservations",
    filter: `guest_id=eq.${guestId}`,
    onChange: ownReload,
    enabled: !managed,
  });
  const items = managed ? (itemsProp ?? null) : ownItems;
  const reload = managed ? (reloadProp ?? (() => {})) : ownReload;

  const todayKey = new Date().toISOString().slice(0, 10);
  const money = (v: number, cur: string | null) =>
    cur ? formatCurrency(v, cur) : v.toLocaleString(locale);
  const fmtDay = (s: string | null) =>
    s
      ? new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  if (items === null) return <p className="text-muted-foreground">…</p>;
  if (items.length === 0)
    return <p className="text-muted-foreground">{t("noReservations")}</p>;
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((r) => {
          const meta = r.status
            ? STATUS_META[r.status as keyof typeof STATUS_META]
            : undefined;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex w-full items-center gap-4 rounded-(--radius) px-2 py-3 text-left hover:bg-muted/60"
              >
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {meta && <span className={`size-2 rounded-full ${meta.dotBg}`} />}
                  {meta?.label ?? r.status ?? "—"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {fmtDay(r.check_in)}
                    <Icon icon="ph:arrow-right" className="size-3.5 text-muted-foreground" />
                    {fmtDay(r.check_out)}
                  </span>
                  {access.amounts && r.addons_total != null && r.addons_total > 0 && (
                    <span className="text-xs text-muted-foreground">
                      + {money(r.addons_total, r.currency)} {t("addons")}
                    </span>
                  )}
                </span>
                {access.amounts && (
                  <span className="shrink-0 font-display font-extrabold">
                    {r.total_amount != null ? money(r.total_amount, r.currency) : "—"}
                  </span>
                )}
                <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      {openId && (
        <ReservationDetailSlider
          reservationId={openId}
          todayKey={todayKey}
          onClose={() => setOpenId(null)}
          onCancelled={() => {
            setOpenId(null);
            reload();
          }}
          onChanged={reload}
        />
      )}
    </>
  );
}

function ReservationsTab({ guestId, access }: { guestId: string; access: GuestAccess }) {
  return (
    <Card>
      <ReservationList guestId={guestId} access={access} />
    </Card>
  );
}

function InvoicesTab({ guestId }: { guestId: string }) {
  const t = useTranslations("guests");
  const locale = useLocale();
  const [items, setItems] = useState<GuestInvoice[] | null>(null);
  const load = useCallback(() => {
    listGuestInvoices(guestId).then((r) => r.ok && setItems(r.data.items));
  }, [guestId]);
  useEffect(() => load(), [load]);
  // Realtime-Pflicht: neue/geänderte Rechnungen live spiegeln.
  useRealtime({ table: "invoices", onChange: load });
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
                ? `${i.gross_amount.toLocaleString(locale)} ${i.currency ?? ""}`
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
  // Realtime-Pflicht: Notizen anderer Sessions live spiegeln.
  useRealtime({
    table: "guest_notes",
    filter: `guest_id=eq.${guestId}`,
    onChange: load,
  });
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
  const load = useCallback(() => {
    listDocuments(guestId).then((r) => r.ok && setCount(r.data.total));
  }, [guestId]);
  useEffect(() => load(), [load]);
  // Realtime-Pflicht: Dokumente anderer Sessions live spiegeln.
  useRealtime({
    table: "guest_documents",
    filter: `guest_id=eq.${guestId}`,
    onChange: load,
  });
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
  // Realtime-Pflicht: Einwilligungen anderer Sessions live spiegeln.
  useRealtime({
    table: "guest_consents",
    filter: `guest_id=eq.${guestId}`,
    onChange: load,
  });
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
