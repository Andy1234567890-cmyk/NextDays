"use client";

// Lead-Detail als seitliches Sheet: Stammdaten (Adressen getrennt), Status-
// Wechsel entlang des Zustandsgraphen, Notizen-Verlauf (append-only) und die
// Konvertierung zu Eigentümer + Objekt. `lead === null` legt einen neuen Lead an.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Textarea } from "@nextdays/ui/textarea";
import type { TenantUser } from "@/lib/account";
import {
  addLeadNote,
  convertLead,
  createLead,
  deleteLead,
  listLeadNotes,
  updateLead,
} from "@/lib/crm";
import {
  LEAD_SOURCES,
  LEAD_TRANSITIONS,
  type Lead,
  type LeadNote,
  type LeadSource,
  type LeadStatus,
} from "@/lib/crm-meta";
import { usePropertyLabels } from "@/lib/use-property-labels";

import { AdresseFelder } from "./adresse-felder";

type AccommodationType = "vacation_rental" | "hotel";

type Form = {
  name: string;
  email: string;
  phone: string;
  lead_source: LeadSource | "";
  assigned_user_id: string;
  next_action_at: string; // datetime-local
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  object_street: string | null;
  object_house_number: string | null;
  object_postal_code: string | null;
  object_city: string | null;
  object_country: string | null;
  object_sqm: string;
  object_max_guests: string;
};

function zuForm(lead: Lead | null): Form {
  return {
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    lead_source: lead?.lead_source ?? "",
    assigned_user_id: lead?.assigned_user_id ?? "",
    next_action_at: lead?.next_action_at ? lead.next_action_at.slice(0, 16) : "",
    street: lead?.street ?? null,
    house_number: lead?.house_number ?? null,
    postal_code: lead?.postal_code ?? null,
    city: lead?.city ?? null,
    country: lead?.country ?? null,
    object_street: lead?.object_street ?? null,
    object_house_number: lead?.object_house_number ?? null,
    object_postal_code: lead?.object_postal_code ?? null,
    object_city: lead?.object_city ?? null,
    object_country: lead?.object_country ?? null,
    object_sqm: lead?.object_sqm ? String(lead.object_sqm) : "",
    object_max_guests: lead?.object_max_guests ? String(lead.object_max_guests) : "",
  };
}

function leer(v: string): string | null {
  const s = v.trim();
  return s ? s : null;
}

function zuPayload(f: Form): Partial<Lead> {
  return {
    name: f.name.trim(),
    email: leer(f.email),
    phone: leer(f.phone),
    lead_source: f.lead_source || null,
    assigned_user_id: f.assigned_user_id || null,
    next_action_at: f.next_action_at ? new Date(f.next_action_at).toISOString() : null,
    street: f.street ? leer(f.street) : null,
    house_number: f.house_number ? leer(f.house_number) : null,
    postal_code: f.postal_code ? leer(f.postal_code) : null,
    city: f.city ? leer(f.city) : null,
    country: f.country || null,
    object_street: f.object_street ? leer(f.object_street) : null,
    object_house_number: f.object_house_number ? leer(f.object_house_number) : null,
    object_postal_code: f.object_postal_code ? leer(f.object_postal_code) : null,
    object_city: f.object_city ? leer(f.object_city) : null,
    object_country: f.object_country || null,
    object_sqm: f.object_sqm ? Number(f.object_sqm) : null,
    object_max_guests: f.object_max_guests ? Number(f.object_max_guests) : null,
  };
}

export function LeadSheet({
  lead,
  team,
  accommodationType,
  onClose,
  onSaved,
  onDeleted,
}: {
  lead: Lead | null;
  team: TenantUser[];
  accommodationType: AccommodationType;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const { typeOptionsFor } = usePropertyLabels();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(() => zuForm(lead));
  const [ersteNotiz, setErsteNotiz] = useState("");
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "new");
  const [lostReason, setLostReason] = useState(lead?.lost_reason ?? "");
  const [error, setError] = useState<string | null>(null);

  // Notizen-Verlauf
  const [notes, setNotes] = useState<LeadNote[] | null>(null);
  const [noteText, setNoteText] = useState("");

  // Konvertierung
  const [mitObjekt, setMitObjekt] = useState(false);
  const [propertyTitle, setPropertyTitle] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [commission, setCommission] = useState("");
  const [portalzugang, setPortalzugang] = useState(false);
  const [fehlend, setFehlend] = useState<string[]>([]);

  const typOptionen = typeOptionsFor(accommodationType);

  useEffect(() => {
    if (!lead) return;
    let aktiv = true;
    listLeadNotes(lead.id).then((res) => {
      if (!aktiv) return;
      if (res.ok) setNotes(res.data);
      else setError(res.error);
    });
    return () => {
      aktiv = false;
    };
  }, [lead]);

  const statusOptionen = useMemo(() => {
    if (!lead) return [] as LeadStatus[];
    return [lead.status, ...LEAD_TRANSITIONS[lead.status]];
  }, [lead]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  function speichern() {
    if (!form.name.trim()) {
      setError(t("leads.nameFehlt"));
      return;
    }
    if (lead && status === "lost" && lead.status !== "lost" && !lostReason.trim()) {
      setError(t("leads.lostReasonFehlt"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const body = zuPayload(form);
      if (!lead) {
        const res = await createLead({
          ...(body as Partial<Lead> & { name: string }),
          erste_notiz: leer(ersteNotiz),
        });
        if (res.ok) {
          toast.success(t("leads.angelegt"));
          onSaved(res.data);
        } else setError(res.error);
        return;
      }
      const statusPatch =
        status !== lead.status
          ? { status, lost_reason: status === "lost" ? lostReason.trim() : null }
          : {};
      const res = await updateLead(lead.id, { ...body, ...statusPatch });
      if (res.ok) {
        toast.success(t("leads.gespeichert"));
        onSaved(res.data);
      } else setError(res.error);
    });
  }

  function notizAnlegen() {
    if (!lead || !noteText.trim()) return;
    startTransition(async () => {
      const res = await addLeadNote(lead.id, noteText.trim());
      if (res.ok) {
        setNotes((n) => [res.data, ...(n ?? [])]);
        setNoteText("");
      } else setError(res.error);
    });
  }

  function konvertieren() {
    if (!lead) return;
    setFehlend([]);
    setError(null);
    startTransition(async () => {
      const res = await convertLead(lead.id, {
        mit_objekt: mitObjekt,
        property_title: mitObjekt ? leer(propertyTitle) : null,
        property_type: mitObjekt ? propertyType || null : null,
        default_commission_pct: commission ? Number(commission) : null,
        portalzugang,
      });
      if (res.ok) {
        toast.success(
          res.data.bereits_konvertiert ? t("leads.bereitsKonvertiert") : t("leads.konvertiert"),
        );
        onSaved(res.data.lead);
        return;
      }
      const felder = res.details?.fehlende_felder;
      if (Array.isArray(felder)) setFehlend(felder.map(String));
      setError(res.error);
    });
  }

  function loeschen() {
    if (!lead) return;
    if (!window.confirm(t("leads.loeschenFrage", { name: lead.name }))) return;
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (res.ok) {
        toast.success(t("leads.geloescht"));
        onDeleted(lead.id);
      } else setError(res.error);
    });
  }

  const feld = "flex flex-col gap-1";
  const label = "text-xs font-medium text-muted-foreground";
  const fehlt = (f: string) => fehlend.includes(f);
  const konvertiert = !!lead?.converted_owner_id;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            {lead ? lead.name : t("leads.neu")}
            {lead && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t(`leads.status_${lead.status}`)}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          {/* Stammdaten */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("leads.stammdaten")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={`${feld} col-span-2`}>
                <span className={label}>{t("leads.name")}</span>
                <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label className={feld}>
                <span className={label}>{t("leads.email")}</span>
                <Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
              </label>
              <label className={feld}>
                <span className={label}>{t("leads.telefon")}</span>
                <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </label>
              <label className={feld}>
                <span className={label}>{t("leads.quelle")}</span>
                <NativeSelect
                  value={form.lead_source}
                  onChange={(e) => patch({ lead_source: e.target.value as LeadSource | "" })}
                >
                  <option value="">{t("leads.quelleOffen")}</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {t(`leads.quelle_${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className={feld}>
                <span className={label}>{t("leads.zustaendig")}</span>
                <NativeSelect
                  value={form.assigned_user_id}
                  onChange={(e) => patch({ assigned_user_id: e.target.value })}
                >
                  <option value="">{t("leads.niemand")}</option>
                  {team.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email || u.user_id}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className={`${feld} col-span-2`}>
                <span className={label}>{t("leads.naechsterSchritt")}</span>
                <Input
                  type="datetime-local"
                  value={form.next_action_at}
                  onChange={(e) => patch({ next_action_at: e.target.value })}
                />
              </label>
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("leads.anschrift")}
            </h4>
            <AdresseFelder
              wert={{
                street: form.street,
                house_number: form.house_number,
                postal_code: form.postal_code,
                city: form.city,
                country: form.country,
              }}
              onChange={(p) => patch(p)}
            />
          </section>

          {/* Objekt-Eckdaten */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("leads.objektEckdaten")}</h3>
            <AdresseFelder
              wert={{
                street: form.object_street,
                house_number: form.object_house_number,
                postal_code: form.object_postal_code,
                city: form.object_city,
                country: form.object_country,
              }}
              onChange={(p) =>
                patch({
                  ...(p.street !== undefined ? { object_street: p.street } : {}),
                  ...(p.house_number !== undefined ? { object_house_number: p.house_number } : {}),
                  ...(p.postal_code !== undefined ? { object_postal_code: p.postal_code } : {}),
                  ...(p.city !== undefined ? { object_city: p.city } : {}),
                  ...(p.country !== undefined ? { object_country: p.country } : {}),
                })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <label className={feld}>
                <span className={label}>{t("leads.qm")}</span>
                <Input
                  type="number"
                  min={1}
                  value={form.object_sqm}
                  onChange={(e) => patch({ object_sqm: e.target.value })}
                />
              </label>
              <label className={feld}>
                <span className={`${label} ${fehlt("object_max_guests") ? "text-destructive" : ""}`}>
                  {t("leads.maxPersonen")}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={form.object_max_guests}
                  onChange={(e) => patch({ object_max_guests: e.target.value })}
                />
              </label>
            </div>
          </section>

          {/* Status (nur bestehender Lead) */}
          {lead && !konvertiert && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("leads.status")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className={feld}>
                  <span className={label}>{t("leads.status")}</span>
                  <NativeSelect
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  >
                    {statusOptionen.map((s) => (
                      <option key={s} value={s}>
                        {t(`leads.status_${s}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {status === "lost" && (
                  <label className={feld}>
                    <span className={label}>{t("leads.lostReason")}</span>
                    <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("leads.wonHinweis")}</p>
            </section>
          )}

          {/* Notizen */}
          {lead && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("leads.notizen")}</h3>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={noteText}
                  placeholder={t("leads.notizPlatzhalter")}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={notizAnlegen}
                  disabled={pending || !noteText.trim()}
                >
                  <Icon icon="ph:plus" className="size-4" />
                </Button>
              </div>
              {notes === null ? (
                <p className="text-xs text-muted-foreground">{t("allgemein.laden")}</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("leads.keineNotizen")}</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-(--radius) border border-border bg-card p-3 text-sm">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {n.created_at
                          ? new Date(n.created_at).toLocaleString(locale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                        {" · "}
                        {team.find((u) => u.user_id === n.author_id)?.full_name ??
                          team.find((u) => u.user_id === n.author_id)?.email ??
                          t("leads.unbekannterAutor")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {/* Konvertierung */}
          {lead && (
            <section className="flex flex-col gap-3 rounded-(--radius) border border-border bg-secondary/40 p-4">
              <h3 className="text-sm font-semibold">{t("leads.konvertierung")}</h3>
              {konvertiert ? (
                <div className="flex flex-col gap-1 text-sm">
                  <p>{t("leads.konvertiertText")}</p>
                  <Link className="underline" href={`/eigentuemer/${lead.converted_owner_id}`}>
                    {t("leads.zumEigentuemer")}
                  </Link>
                  {lead.converted_property_id && (
                    <Link className="underline" href={`/objekte/${lead.converted_property_id}`}>
                      {t("leads.zumObjekt")}
                    </Link>
                  )}
                </div>
              ) : lead.status === "lost" ? (
                <p className="text-sm text-muted-foreground">{t("leads.verlorenKeineKonvertierung")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t("leads.konvertierungText")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={feld}>
                      <span className={label}>{t("leads.provision")}</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input
                        type="checkbox"
                        className={`size-4 accent-primary ${fehlt("email") ? "outline outline-destructive" : ""}`}
                        checked={portalzugang}
                        onChange={(e) => setPortalzugang(e.target.checked)}
                      />
                      {t("leads.portalzugang")}
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={mitObjekt}
                        onChange={(e) => setMitObjekt(e.target.checked)}
                      />
                      {t("leads.mitObjekt")}
                    </label>
                    {mitObjekt && (
                      <>
                        <label className={feld}>
                          <span className={`${label} ${fehlt("property_title") ? "text-destructive" : ""}`}>
                            {t("leads.objektTitel")}
                          </span>
                          <Input value={propertyTitle} onChange={(e) => setPropertyTitle(e.target.value)} />
                        </label>
                        <label className={feld}>
                          <span className={`${label} ${fehlt("property_type") ? "text-destructive" : ""}`}>
                            {t("leads.objektTyp")}
                          </span>
                          <NativeSelect value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                            <option value="">{t("leads.typWaehlen")}</option>
                            {typOptionen.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </label>
                      </>
                    )}
                  </div>
                  {fehlend.length > 0 && (
                    <p className="text-xs text-destructive">
                      {t("leads.fehlendeFelder", { felder: fehlend.map((f) => t(`leads.feld_${f}`)).join(", ") })}
                    </p>
                  )}
                  <div>
                    <Button onClick={konvertieren} disabled={pending}>
                      <Icon icon="ph:user-switch" className="size-4" />
                      {t("leads.konvertieren")}
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {!lead && (
            <label className={feld}>
              <span className={label}>{t("leads.ersteNotiz")}</span>
              <Textarea rows={3} value={ersteNotiz} onChange={(e) => setErsteNotiz(e.target.value)} />
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border">
          {lead ? (
            <Button variant="ghost" className="text-destructive" onClick={loeschen} disabled={pending}>
              <Icon icon="ph:trash" className="size-4" />
              {t("allgemein.loeschen")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {t("allgemein.abbrechen")}
            </Button>
            <Button onClick={speichern} disabled={pending}>
              {lead ? t("allgemein.speichern") : t("leads.anlegen")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
