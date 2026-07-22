"use client";

// Generischer 1:n-Listeneditor für die Kartei (Serviceverträge, Handwerker,
// Plattform-Launches). CRUD direkt gegen den Slice; State aus der Server-Antwort
// (kein Reload). Alle Texte kommen als i18n-Props (labels).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export function ListEditor<I extends object, R extends I & { id: string }>({
  heading,
  labels,
  initial,
  empty,
  rowLabel,
  render,
  onAdd,
  onUpdate,
  onDelete,
}: {
  heading: string;
  labels: { add: string; save: string; saving: string; cancel: string; empty: string };
  initial: R[];
  empty: () => I;
  rowLabel: (row: R) => string;
  render: (value: I, set: (v: I) => void) => React.ReactNode;
  onAdd: (value: I) => Promise<Result<R>>;
  onUpdate: (id: string, value: I) => Promise<Result<R>>;
  onDelete: (id: string) => Promise<Result<null>>;
}) {
  const [rows, setRows] = useState<R[]>(initial);
  const [draft, setDraft] = useState<I | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const res = editId ? await onUpdate(editId, draft) : await onAdd(draft);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) =>
      editId ? prev.map((r) => (r.id === editId ? res.data : r)) : [...prev, res.data],
    );
    setDraft(null);
    setEditId(null);
  }

  async function remove(id: string) {
    const res = await onDelete(id);
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    else setError(res.error);
  }

  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">{heading}</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setDraft(empty());
            setEditId(null);
            setError(null);
          }}
        >
          <Icon icon="ph:plus" className="size-4" />
          {labels.add}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3 p-3">
              <span className="truncate text-sm">{rowLabel(r)}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const { id: _id, ...rest } = r;
                    void _id;
                    setDraft(rest as unknown as I);
                    setEditId(r.id);
                    setError(null);
                  }}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Icon icon="ph:trash" className="size-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <Card className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{render(draft, setDraft)}</div>
          <div className="flex items-center justify-end gap-3">
            {error && <span className="mr-auto text-sm text-destructive">{error}</span>}
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setEditId(null);
              }}
            >
              {labels.cancel}
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? labels.saving : labels.save}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}
