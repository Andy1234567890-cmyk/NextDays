"use client";

// Eigene, inhouse Verbinden-Maske (KEIN externer iFrame, kein Provider sichtbar).
// Zeigt einen Dialog: Portal wählen → portal-spezifische Felder → verbinden.
// Ruft im Hintergrund den channel_manager-Slice (lib/channex).
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type SupportedPortal,
  connectChannel,
  listPortals,
} from "@/lib/channex";
import { listProperties } from "@/lib/properties";

export function ChannelConnectButton({
  label = "Kanäle verbinden",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "accent";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [portals, setPortals] = useState<SupportedPortal[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportedPortal | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Portale + erstes Objekt laden, sobald der Dialog geöffnet wird.
  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const [p, props] = await Promise.all([listPortals(), listProperties()]);
      if (p.ok) setPortals(p.data);
      if (props.ok && props.data.items.length > 0) {
        setPropertyId(props.data.items[0].id);
      }
    });
  }, [open]);

  function choosePortal(portal: SupportedPortal) {
    setSelected(portal);
    setValues({});
    setError(null);
  }

  function submit() {
    if (!selected || !propertyId) {
      setError("Bitte zuerst ein Objekt anlegen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await connectChannel({
        property_id: propertyId,
        portal_code: selected.code,
        settings: values,
      });
      if (res.ok) {
        setDone(`${selected.label} verbunden.`);
        setSelected(null);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <Icon icon="ph:plugs-connected" className="size-4" />
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">
                Buchungsportal verbinden
              </h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSelected(null);
                  setDone(null);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Schließen"
              >
                <Icon icon="ph:x" className="size-5" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Icon icon="ph:check-bold" className="size-6" />
                </span>
                <p className="font-medium">{done}</p>
                <p className="text-sm text-muted-foreground">
                  Verfügbarkeit und Preise werden ab sofort automatisch
                  abgeglichen.
                </p>
                <Button onClick={() => setDone(null)} variant="outline">
                  Weiteres Portal verbinden
                </Button>
              </div>
            ) : !selected ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Wähle das Portal, das du verbinden möchtest:
                </p>
                <div className="grid gap-2">
                  {portals.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => choosePortal(p)}
                      className="flex items-center gap-3 rounded-(--radius) border border-border p-3 text-left transition-colors hover:bg-secondary"
                    >
                      <Icon icon={p.icon} className="size-6" />
                      <span className="font-medium">{p.label}</span>
                      <Icon
                        icon="ph:caret-right"
                        className="ml-auto size-4 text-muted-foreground"
                      />
                    </button>
                  ))}
                  {portals.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {pending ? "Lädt …" : "Keine Portale verfügbar."}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="ph:arrow-left" className="size-4" />
                  Anderes Portal
                </button>
                <div className="flex items-center gap-3">
                  <Icon icon={selected.icon} className="size-7" />
                  <span className="font-display text-lg font-bold">
                    {selected.label}
                  </span>
                </div>

                {selected.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Für dieses Portal sind keine weiteren Angaben nötig. Klicke
                    auf „Verbinden", um fortzufahren.
                  </p>
                ) : (
                  selected.fields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <label htmlFor={f.key} className="text-sm font-medium">
                        {f.label}
                      </label>
                      <Input
                        id={f.key}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    </div>
                  ))
                )}

                {error && (
                  <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button onClick={submit} disabled={pending}>
                  {pending ? (
                    <>
                      <Icon icon="ph:spinner" className="size-4 animate-spin" />
                      Verbinde …
                    </>
                  ) : (
                    "Verbinden"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
