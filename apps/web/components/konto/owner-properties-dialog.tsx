"use client";

// Eigentümer → Objekt-Zuordnung (Lastenheft §4.2). Die Agentur (admin/co_admin)
// wählt per Checkboxen, welche Objekte ein Eigentümer-Login in seinem read-only-
// Portal sieht. Lädt beim Öffnen die Objekte + aktuelle Zuordnung, speichert per
// PUT (Replace-Semantik).
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getOwnerProperties, setOwnerProperties } from "@/lib/account";
import { listProperties, type Property } from "@/lib/properties";

export function OwnerPropertiesDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const [props, setProps] = useState<Property[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listProperties(), getOwnerProperties(userId)]).then(
      ([pr, as]) => {
        if (!active) return;
        if (!pr.ok) {
          setLoadError(pr.error);
          return;
        }
        setProps(pr.data.items);
        setSelected(new Set(as.ok ? as.data.property_ids : []));
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await setOwnerProperties(userId, [...selected]);
    setBusy(false);
    if (res.ok) onClose();
    else setMsg(res.error);
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Objekte zuordnen</SheetTitle>
          <SheetDescription>
            {userName} sieht im Eigentümer-Portal nur die hier gewählten Objekte.
          </SheetDescription>
        </SheetHeader>

        {loadError && (
          <p className="px-4 text-sm text-destructive">{loadError}</p>
        )}
        {!props && !loadError && (
          <p className="px-4 text-sm text-muted-foreground">Lädt…</p>
        )}

        {props && (
          <div className="flex flex-col gap-4 p-4">
            {props.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Objekte im Konto.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {props.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-(--radius) p-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={(c) => toggle(p.id, c === true)}
                      />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-medium">
                          {p.title}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          ID {p.id.slice(0, 8)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={busy}>
                {busy ? "Speichern…" : "Speichern"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {selected.size} ausgewählt
              </span>
              {msg && <p className="text-sm text-destructive">{msg}</p>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
