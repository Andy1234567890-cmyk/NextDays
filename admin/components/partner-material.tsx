"use client";

// Pflege des Werbematerials: anlegen, aktiv/inaktiv, bearbeiten, löschen.
// Löschen fragt nach — ein Video, das Partner bereits verlinkt haben, ist
// danach für alle weg.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { type Material, type MaterialArt, MATERIAL_ART_LABEL } from "@/lib/partner";
import {
  materialAendern,
  materialAnlegen,
  type MaterialEingabe,
  materialLoeschen,
} from "@/lib/partner-actions";

const LEER: MaterialEingabe = {
  kind: "link",
  title: "",
  description: null,
  language: null,
  url: null,
  body: null,
  sort: 0,
  active: true,
};

const FELD =
  "w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground";

function leerZuNull(v: string): string | null {
  const w = v.trim();
  return w ? w : null;
}

export function PartnerMaterial({ material }: { material: Material[] }) {
  const [form, setForm] = useState<MaterialEingabe>(LEER);
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const zuruecksetzen = () => {
    setForm(LEER);
    setBearbeitet(null);
  };

  const speichern = () =>
    starte(async () => {
      const res = bearbeitet
        ? await materialAendern(bearbeitet, form)
        : await materialAnlegen(form);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      toast.success(bearbeitet ? "Material geändert." : "Material angelegt.");
      zuruecksetzen();
    });

  const bearbeiten = (m: Material) => {
    setBearbeitet(m.id);
    setForm({
      kind: m.kind,
      title: m.title,
      description: m.description,
      language: m.language,
      url: m.url,
      body: m.body,
      sort: m.sort,
      active: m.active,
    });
  };

  const umschalten = (m: Material) =>
    starte(async () => {
      const res = await materialAendern(m.id, { active: !m.active });
      if (!res.ok) toast.error(res.fehler);
    });

  const loeschen = (m: Material) => {
    if (!window.confirm(`„${m.title}“ endgültig löschen? Partner sehen es danach nicht mehr.`)) return;
    starte(async () => {
      const res = await materialLoeschen(m.id);
      if (!res.ok) toast.error(res.fehler);
      else toast.success("Material gelöscht.");
    });
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ul className="space-y-3">
        {material.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Noch kein Material. Rechts anlegen — die beiden Videos (10 s, 60–120 s) gehören hierher.
          </li>
        )}
        {material.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border border-border p-5 ${m.active ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {MATERIAL_ART_LABEL[m.kind]} · {m.language ? m.language.toUpperCase() : "alle Sprachen"} ·
                  Sortierung {m.sort} {m.active ? "" : "· inaktiv"}
                </p>
                <p className="mt-1 font-semibold">{m.title}</p>
                {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                {m.url && (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm underline-offset-4 hover:underline"
                  >
                    {m.url}
                  </a>
                )}
                {m.body && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{m.body}</pre>
                )}
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => bearbeiten(m)}
                  className="rounded-full border border-border px-3 py-1.5 font-medium hover:border-foreground"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => umschalten(m)}
                  className="rounded-full border border-border px-3 py-1.5 font-medium hover:border-foreground"
                >
                  {m.active ? "Deaktivieren" : "Aktivieren"}
                </button>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => loeschen(m)}
                  className="rounded-full border border-border px-3 py-1.5 font-medium text-red-600 hover:border-red-600"
                >
                  Löschen
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
        className="h-fit space-y-3 rounded-2xl border border-border p-5"
      >
        <p className="text-sm font-semibold">{bearbeitet ? "Material bearbeiten" : "Neues Material"}</p>
        <label className="block text-sm">
          <span className="text-muted-foreground">Art</span>
          <select
            value={form.kind}
            disabled={bearbeitet !== null}
            onChange={(e) => setForm({ ...form, kind: e.target.value as MaterialArt })}
            className={FELD}
          >
            {(Object.keys(MATERIAL_ART_LABEL) as MaterialArt[]).map((k) => (
              <option key={k} value={k}>
                {MATERIAL_ART_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Titel</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={FELD}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Beschreibung (optional)</span>
          <input
            maxLength={1000}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: leerZuNull(e.target.value) })}
            className={FELD}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Sprache (leer = alle, sonst z. B. de, en)</span>
          <input
            maxLength={10}
            value={form.language ?? ""}
            onChange={(e) => setForm({ ...form, language: leerZuNull(e.target.value) })}
            className={FELD}
          />
        </label>
        {form.kind === "text" ? (
          <label className="block text-sm">
            <span className="text-muted-foreground">Text ({"{link}"} = Partner-Link)</span>
            <textarea
              required
              rows={5}
              maxLength={5000}
              value={form.body ?? ""}
              onChange={(e) => setForm({ ...form, body: leerZuNull(e.target.value) })}
              className={FELD}
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-muted-foreground">Adresse (https://…)</span>
            <input
              required
              type="url"
              maxLength={500}
              value={form.url ?? ""}
              onChange={(e) => setForm({ ...form, url: leerZuNull(e.target.value) })}
              className={FELD}
            />
          </label>
        )}
        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-muted-foreground">Sortierung</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })}
              className={FELD}
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            aktiv
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={laeuft}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {bearbeitet ? "Speichern" : "Anlegen"}
          </button>
          {bearbeitet && (
            <button
              type="button"
              onClick={zuruecksetzen}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
