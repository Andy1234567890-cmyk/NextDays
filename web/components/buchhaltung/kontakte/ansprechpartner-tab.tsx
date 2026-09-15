"use client";

// Reiter „Ansprechpartner": Liste + Anlegen/Bearbeiten im Sheet + Löschen.
// Nach jeder Aktion `router.refresh()` — kein Realtime auf dieser Tabelle
// (customer_contacts ist für authenticated gesperrt, Wurzel 6).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createAnsprechpartner,
  deleteAnsprechpartner,
  updateAnsprechpartner,
} from "@/lib/buchhaltung-kontakte";
import type { Ansprechpartner, AnsprechpartnerEingabe } from "@/lib/buchhaltung-kontakte-typen";

type Formular = {
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  notes: string;
};

const LEER: Formular = { name: "", role: "", email: "", phone: "", isPrimary: false, notes: "" };

function ausZeile(k: Ansprechpartner): Formular {
  return {
    name: k.name,
    role: k.role ?? "",
    email: k.email ?? "",
    phone: k.phone ?? "",
    isPrimary: k.isPrimary,
    notes: k.notes ?? "",
  };
}

function alsEingabe(f: Formular): AnsprechpartnerEingabe {
  return {
    name: f.name.trim(),
    role: f.role.trim() || null,
    email: f.email.trim() || null,
    phone: f.phone.trim() || null,
    isPrimary: f.isPrimary,
    notes: f.notes.trim() || null,
  };
}

export function AnsprechpartnerTab({
  customerId,
  kontakte,
}: {
  customerId: string;
  kontakte: Ansprechpartner[];
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<Ansprechpartner | null>(null);
  const [form, setForm] = useState<Formular>(LEER);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschFehler, setLoeschFehler] = useState<string | null>(null);

  const oeffnen = (k: Ansprechpartner | null) => {
    setBearbeitet(k);
    setForm(k ? ausZeile(k) : LEER);
    setFehler(null);
    setOffen(true);
  };

  async function speichern() {
    if (!form.name.trim()) {
      setFehler(t("kontaktePage.ansprechpartner.nameRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const eingabe = alsEingabe(form);
    const res = bearbeitet
      ? await updateAnsprechpartner(customerId, bearbeitet.id, eingabe)
      : await createAnsprechpartner(customerId, eingabe);
    setBusy(false);
    if (res.ok) {
      setOffen(false);
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  async function loeschen(k: Ansprechpartner) {
    if (!window.confirm(t("kontaktePage.ansprechpartner.deleteConfirm", { name: k.name }))) return;
    setLoeschFehler(null);
    const res = await deleteAnsprechpartner(customerId, k.id);
    if (res.ok) router.refresh();
    else setLoeschFehler(res.error);
  }

  async function hauptkontaktSetzen(k: Ansprechpartner) {
    setLoeschFehler(null);
    const res = await updateAnsprechpartner(customerId, k.id, { isPrimary: true });
    if (res.ok) router.refresh();
    else setLoeschFehler(res.error);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => oeffnen(null)} className="gap-2">
          <Icon icon="ph:plus" className="size-4" />
          {t("kontaktePage.ansprechpartner.add")}
        </Button>
      </div>

      {loeschFehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loeschFehler}
        </p>
      )}

      {kontakte.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Icon icon="ph:users-three" className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("kontaktePage.ansprechpartner.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {kontakte.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {k.name}
                    {k.isPrimary && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                        {t("kontaktePage.ansprechpartner.primary")}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[k.role, k.email, k.phone].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!k.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => hauptkontaktSetzen(k)}
                      title={t("kontaktePage.ansprechpartner.makePrimary")}
                    >
                      <Icon icon="ph:star" className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => oeffnen(k)}>
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => loeschen(k)}>
                    <Icon icon="ph:trash" className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <KontaktSheet
        offen={offen}
        setOffen={setOffen}
        bearbeitet={bearbeitet}
        form={form}
        setForm={setForm}
        busy={busy}
        fehler={fehler}
        onSpeichern={speichern}
      />
    </div>
  );
}

/** Das Sheet zum Anlegen und Bearbeiten eines Ansprechpartners. */
function KontaktSheet({
  offen,
  setOffen,
  bearbeitet,
  form,
  setForm,
  busy,
  fehler,
  onSpeichern,
}: {
  offen: boolean;
  setOffen: (v: boolean) => void;
  bearbeitet: Ansprechpartner | null;
  form: Formular;
  setForm: React.Dispatch<React.SetStateAction<Formular>>;
  busy: boolean;
  fehler: string | null;
  onSpeichern: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Sheet open={offen} onOpenChange={setOffen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {bearbeitet
              ? t("kontaktePage.ansprechpartner.editTitle")
              : t("kontaktePage.ansprechpartner.addTitle")}
          </SheetTitle>
          <SheetDescription>{t("kontaktePage.ansprechpartner.sheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-name">
              {t("kontaktePage.ansprechpartner.name")} <span className="text-destructive">*</span>
            </Label>
            <Input id="ap-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-role">{t("kontaktePage.ansprechpartner.role")}</Label>
            <Input id="ap-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-email">{t("kontaktePage.ansprechpartner.email")}</Label>
            <Input id="ap-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-phone">{t("kontaktePage.ansprechpartner.phone")}</Label>
            <Input id="ap-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-notes">{t("kontaktePage.ansprechpartner.notes")}</Label>
            <Textarea id="ap-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isPrimary}
              onCheckedChange={(v) => setForm({ ...form, isPrimary: v === true })}
            />
            {t("kontaktePage.ansprechpartner.primaryCheckbox")}
          </label>
          {fehler && (
            <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fehler}
            </p>
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t">
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => setOffen(false)}>
            {t("kontaktePage.cancel")}
          </Button>
          <Button type="button" className="flex-1" disabled={busy} onClick={onSpeichern}>
            {busy ? t("kontaktePage.saving") : t("kontaktePage.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
