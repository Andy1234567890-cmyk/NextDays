"use client";

// Kontaktpersonen der Reisebüro-Kartei (OPERA „Contacts"-Panel) als
// Karten-Grid mit Initialen-Monogramm und klickbaren mailto-/tel-Zeilen;
// Formular auf Abruf statt permanent (weniger Rauschen im Lesefluss).
// Initialdaten kommen vom Server (kein Lade-Flackern), null = dort
// fehlgeschlagen → hier selbst laden und Fehler zeigen.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import {
  type AgencyContact,
  addAgencyContact,
  deleteAgencyContact,
  listAgencyContacts,
} from "@/lib/travel-agencies";
import { initialsOf } from "@/lib/initials";
import { useRealtime } from "@/lib/use-realtime";

export function ContactsSection({
  agencyId,
  initialContacts,
}: {
  agencyId: string;
  initialContacts: AgencyContact[] | null;
}) {
  const t = useTranslations("travelAgencies");
  const [contacts, setContacts] = useState<AgencyContact[] | null>(initialContacts);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listAgencyContacts(agencyId);
      if (res.ok) setContacts(res.data);
      else setError(res.error);
    });
  }, [agencyId]);

  // Nur nachladen, wenn der Server nichts liefern konnte.
  useEffect(() => {
    if (initialContacts == null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  // RealtimeRefresh (page-level) liefert frische Props — ohne Sync bliebe
  // die Liste stale, wenn das eigene WebSocket-Event verpasst wurde
  // (Section war unmounted) oder load() fehlschlug.
  useEffect(() => {
    if (initialContacts != null) setContacts(initialContacts);
  }, [initialContacts]);
  // Live: Kontakte dieser Kartei per WebSocket spiegeln.
  useRealtime({ table: "travel_agency_contacts", onChange: load });

  function onAdd() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addAgencyContact(agencyId, {
        name: name.trim(),
        role: role.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        // Nur primär, wenn die Liste GELADEN und leer ist — bei unbekanntem
        // Zustand nie raten (sonst zweiter Primärkontakt).
        is_primary: contacts != null && contacts.length === 0,
      });
      if (res.ok) {
        setName(""); setRole(""); setEmail(""); setPhone("");
        setShowForm(false);
        load();
      } else {
        setError(res.error);
      }
    });
  }

  function onRemove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteAgencyContact(agencyId, id);
      if (res.ok) load();
      else setError(res.error);
    });
  }

  // Primärkontakt zuerst — der wichtigste Ansprechpartner steht vorn.
  const sorted = contacts
    ? [...contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("contactsHint")}</p>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("addContact")}
        </Button>
      </div>

      {showForm && (
        <Card className="grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("name")}</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("role")}</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("email")}</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("phone")}</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <Button onClick={onAdd} disabled={pending || !name.trim()}>
            {t("create")}
          </Button>
        </Card>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {sorted && sorted.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                    {initialsOf(c.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {c.role || "—"}
                    </span>
                  </div>
                  {c.is_primary && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t("primary")}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1 -mt-1 size-8 text-muted-foreground"
                    onClick={() => onRemove(c.id)}
                    aria-label={t("delete")}
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </Button>
                </div>
                {(c.email || c.phone) && (
                  <div className="flex flex-col gap-1.5">
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                      >
                        <Icon icon="ph:envelope-simple" className="size-4 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </a>
                    )}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                      >
                        <Icon icon="ph:phone" className="size-4 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </a>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        sorted && (
          <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("noContacts")}
          </p>
        )
      )}
    </section>
  );
}
