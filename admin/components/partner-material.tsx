"use client";

// Pflege des Werbematerials: hochladen, aktiv/inaktiv, bearbeiten, löschen.
// Löschen fragt nach — ein Video, das Partner bereits verlinkt haben, ist
// danach für alle weg.
//
// Material ENTSTEHT nur durch Hochladen (0707). Das frühere Formular „Neues
// Material" stand dauerhaft daneben und verlangte eine von Hand getippte
// Adresse — seit es die Ablagefläche gibt, ist das der zweite Weg zum selben
// Ziel, und der umständlichere. Das Formular blieb, aber nur noch als
// BEARBEITEN-Feld: es öffnet sich am Eintrag und schließt sich danach wieder.
// Titel, Beschreibung, Sprache und Sortierung bleiben so änderbar — ohne sie
// trüge jede Datei für immer ihren Dateinamen als Titel.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  MaterialDateiErsetzen,
  PartnerMaterialUpload,
} from "@/components/partner-material-upload";
import {
  PartnerMaterialOrdner,
  type ReiterWahl,
  ZUG_TYP,
} from "@/components/partner-material-ordner";
import { groesseLesbar, type Material, MATERIAL_ART_LABEL, type Ordner } from "@/lib/partner";
import {
  materialAendern,
  type MaterialEingabe,
  materialLoeschen,
} from "@/lib/partner-actions";

const FELD =
  "w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground";

function leerZuNull(v: string): string | null {
  const w = v.trim();
  return w ? w : null;
}

export function PartnerMaterial({
  material,
  ordner,
}: {
  material: Material[];
  ordner: Ordner[];
}) {
  // Welcher Reiter offen ist: null = alle, "" = ohne Ordner, sonst die ID.
  const [reiter, setReiter] = useState<ReiterWahl>(null);
  // `null` heißt: es wird gerade nichts bearbeitet — dann gibt es das Formular
  // nicht. Beide Zustände hängen zusammen und werden nur gemeinsam gesetzt.
  const [form, setForm] = useState<MaterialEingabe | null>(null);
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  // Hat der bearbeitete Eintrag eine EIGENE Datei? Dann gibt es kein
  // Adressfeld: die Adresse gehört zum Bucket-Pfad, und der Server weist ein
  // Umbiegen mit 422 ab (die alte Datei wäre sonst weder erreichbar noch je
  // wieder löschbar).
  const [hatDatei, setHatDatei] = useState(false);
  const [laeuft, starte] = useTransition();

  // Gefiltert im Browser und nicht per Abfrage: die ganze Liste liegt bereits
  // hier, und ein Reiterwechsel soll nichts kosten. `""` ist „ohne Ordner",
  // `null` ist „alle" — deshalb der Vergleich auf `=== null` und nicht auf
  // Wahrheitswert, sonst wären beide dasselbe.
  const sichtbar =
    reiter === null
      ? material
      : material.filter((m) => (m.folder_id ?? "") === reiter);

  const zuruecksetzen = () => {
    setForm(null);
    setBearbeitet(null);
    setHatDatei(false);
  };

  const speichern = () => {
    if (!bearbeitet || !form) return;
    starte(async () => {
      // Bei einer eigenen Datei die Adresse NICHT mitschicken — unverändert
      // wäre sie harmlos, aber sie gehört dem Server, nicht diesem Formular.
      const { url: _url, ...ohneAdresse } = form;
      const res = await materialAendern(bearbeitet, hatDatei ? ohneAdresse : form);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      toast.success("Material geändert.");
      zuruecksetzen();
    });
  };

  const bearbeiten = (m: Material) => {
    setBearbeitet(m.id);
    setHatDatei(m.download_url !== null);
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
    <div
      className={`mt-8 grid gap-8 ${
        // Die zweite Spalte gibt es nur, solange bearbeitet wird — sonst stünde
        // dort dauerhaft eine leere Fläche.
        form ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-1"
      }`}
    >
      <div className="space-y-3">
        <PartnerMaterialOrdner
          ordner={ordner}
          material={material}
          aktiv={reiter}
          aktivSetzen={setReiter}
        />
        {/* Was hier abgelegt wird, landet im OFFENEN Reiter — sonst müsste man
            jede Datei nach dem Hochladen dorthin ziehen, wo man sie gerade
            abgelegt hat. */}
        <PartnerMaterialUpload folderId={reiter || null} />
        <ul className="space-y-3">
        {sichtbar.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {material.length === 0
              ? "Noch kein Material. Dateien oben ablegen — die beiden Videos (10 s, 60–120 s) gehören hierher."
              : "Dieser Ordner ist leer. Einträge aus einem anderen Reiter hierher ziehen oder Dateien oben ablegen."}
          </li>
        )}
        {sichtbar.map((m) => (
          <li
            key={m.id}
            // Ziehbar ist die ganze Karte, nicht ein eigener Griff: sie ist das
            // Objekt, das verschoben wird. Im Zug hängt NUR die ID — der
            // Empfänger holt sich den Rest aus der Liste, die er ohnehin hat.
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(ZUG_TYP, m.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`cursor-grab rounded-2xl border border-border p-5 active:cursor-grabbing ${m.active ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Vorschau nur bei eigenen Bildern: eine fremde Adresse kann auf
                  alles zeigen, und ein <img> darauf wäre ein Aufruf an einen
                  fremden Server bei jedem Öffnen der Seite. */}
              {m.kind === "image" && m.download_url && m.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.url}
                  alt=""
                  className="size-20 shrink-0 rounded-xl border border-border bg-muted object-contain p-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {MATERIAL_ART_LABEL[m.kind]} · {m.language ? m.language.toUpperCase() : "alle Sprachen"} ·
                  Sortierung {m.sort} {m.active ? "" : "· inaktiv"}
                </p>
                <p className="mt-1 font-semibold">{m.title}</p>
                {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                {m.download_url ? (
                  // Eigene Datei: der Bucket-Pfad ist ein Zufallstoken und als
                  // Text unlesbar — gezeigt wird deshalb der Dateiname mit
                  // Größe, nicht die Adresse.
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate font-medium">{m.filename}</span>
                    {groesseLesbar(m.bytes) && (
                      <span className="text-muted-foreground">{groesseLesbar(m.bytes)}</span>
                    )}
                    <a
                      href={m.download_url}
                      className="underline-offset-4 hover:underline"
                    >
                      Herunterladen
                    </a>
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Ansehen
                      </a>
                    )}
                  </p>
                ) : (
                  m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-sm underline-offset-4 hover:underline"
                    >
                      {m.url}
                    </a>
                  )
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
                {m.download_url && (
                  <MaterialDateiErsetzen assetId={m.id} disabled={laeuft} />
                )}
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
      </div>
      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
          className="h-fit space-y-3 rounded-2xl border border-border p-5"
        >
          <p className="text-sm font-semibold">Material bearbeiten</p>
          <p className="text-xs text-muted-foreground">
            {/* Die Art steht als Text und nicht mehr als gesperrtes Auswahlfeld:
                ein Feld, das man nicht bedienen kann, sieht aus wie ein Fehler. */}
            {MATERIAL_ART_LABEL[form.kind]}
          </p>
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
          ) : hatDatei ? (
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              Dieser Eintrag ist eine hochgeladene Datei. Die Adresse gehört zur
              Datei — zum Austauschen in der Liste „Datei ersetzen“ benutzen.
            </p>
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
              Speichern
            </button>
            <button
              type="button"
              onClick={zuruecksetzen}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
