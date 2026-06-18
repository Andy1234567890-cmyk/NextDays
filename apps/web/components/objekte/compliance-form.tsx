"use client";

// Compliance-Seite eines Objekts (wie Lodgify „Compliance").
//  Website: Registrierungsdetails (Registrierungsnummer(n) für die eigene
//  Website). Bearbeitung über einen Sheet-Editor; gespeichert per
//  updateProperty() in das flexible Feld type_attributes.compliance.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type Compliance,
  REGISTRATION_MAX_LENGTH,
  readCompliance,
  registrationList,
} from "@/lib/compliance-meta";
import { type Property, updateProperty } from "@/lib/properties";

export function ComplianceForm({ initial }: { initial: Property }) {
  const [p, setP] = useState<Property>(initial);
  const [editing, setEditing] = useState(false);
  const comp = readCompliance(p.type_attributes);
  const numbers = registrationList(comp.registrationNumbers);

  async function save(next: Compliance): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, compliance: next },
    });
    if (res.ok) {
      setP(res.data);
      setEditing(false);
      return true;
    }
    return res.error;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-extrabold">Compliance</h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">Website</h2>

        <Card className="flex items-start justify-between gap-4 p-5">
          <div className="flex flex-col gap-3">
            <div className="leading-tight">
              <p className="font-semibold">Registrierungsdetails</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Hinterlege die Registrierungsdaten deines Objekts, um lokale
                Vorschriften zu erfüllen.
              </p>
            </div>
            {numbers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {numbers.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm"
                  >
                    {n}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">
                Noch keine Registrierungsnummer hinterlegt.
              </p>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Registrierungsdetails bearbeiten"
            onClick={() => setEditing(true)}
          >
            <Icon icon="ph:pencil-simple" className="size-4" />
          </Button>
        </Card>
      </section>

      {editing && (
        <RegistrationEditor
          comp={comp}
          onSave={save}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function RegistrationEditor({
  comp,
  onSave,
  onClose,
}: {
  comp: Compliance;
  onSave: (next: Compliance) => Promise<true | string>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(comp.registrationNumbers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const r = await onSave({ registrationNumbers: value.trim() });
    setBusy(false);
    if (r !== true) setError(r);
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl font-extrabold">
            Registrierungsdetails
          </SheetTitle>
          <SheetDescription>
            Füge die Registrierungsnummer dieses Objekts für deine
            NextDays-Website hinzu. Für Airbnb und Booking.com trägst du sie
            direkt in deren Plattform ein.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <p className="text-sm text-muted-foreground">
            Hast du mehr als eine Nummer, trage sie alle in das Feld unten ein –
            durch Kommas getrennt.
          </p>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="registration-number">Registrierungsnummer</Label>
              <span className="text-sm text-muted-foreground">
                {value.length}/{REGISTRATION_MAX_LENGTH}
              </span>
            </div>
            <Input
              id="registration-number"
              value={value}
              maxLength={REGISTRATION_MAX_LENGTH}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Registrierungsnummern durch Komma getrennt eingeben"
            />
          </div>

          {/* Hinweis nach dem Speichern (orange Box wie Lodgify). */}
          <div className="flex items-start gap-2 rounded-(--radius) bg-amber-50 p-3 text-sm text-amber-900">
            <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
            <span>
              Noch ein Schritt nach dem Speichern: Gehe danach zu
              Website-Builder &gt; Veröffentlichen, um deine Website mit den
              Änderungen zu aktualisieren.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t p-4">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
