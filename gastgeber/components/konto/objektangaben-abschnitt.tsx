"use client";

// § 14 Abs. 4 Nr. 6 PStTG — Grundbuchnummer je Objekt (Airbnb-Vorbild).
//
// Warum genau ein Feld je Objekt: Die übrigen Angaben des § 14 Abs. 4 stehen
// bereits in den Daten. Die Anschrift (Nr. 1) am Objekt, Vergütung und
// Vermietungstage (Nr. 2/3/5) rechnet der Server aus den Buchungen, die Art
// (Nr. 4) leitet er aus dem Objekttyp ab. Nur die Grundbuchnummer kennt
// ausschließlich der Gastgeber.
//
// Der Ton folgt Airbnb, weil die Rechtslage es hergibt: Die Angabe ist nach
// dem Gesetzeswortlaut nur „sofern vorhanden" zu melden. Ein fehlendes Feld
// wird deshalb NICHT als Mangel dargestellt und blockiert nichts — anders als
// die Steuerangaben je Land, die die Auszahlung sperren können.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";

import { landName } from "@/lib/laender";
import { angabeErledigt, type ObjektAngabeStatus } from "@/lib/steuern";
import { speichereObjektangabe } from "@/lib/steuern-actions";

function Zeile({
  angabe,
  onGespeichert,
}: {
  angabe: ObjektAngabeStatus;
  onGespeichert: (a: ObjektAngabeStatus) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [nummer, setNummer] = useState(angabe.land_registration_number ?? "");
  const [keine, setKeine] = useState(angabe.land_registration_unavailable);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaeuft(true);
    setFehler(null);
    const res = await speichereObjektangabe(angabe.property_id, {
      // Entweder eine Nummer oder die Erklärung — nie beides (DB-CHECK 0228).
      land_registration_number: keine ? null : nummer.trim() || null,
      land_registration_unavailable: keine,
    });
    setLaeuft(false);
    if (res.ok) {
      onGespeichert(res.angabe);
      setOffen(false);
    } else {
      setFehler(res.error);
    }
  }

  const ort = [angabe.city, angabe.country ? landName(angabe.country) : null]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[0.9375rem] font-medium">
            {angabe.title ?? "Objekt ohne Titel"}
          </span>
          <span className="text-sm text-muted-foreground">
            {ort || "Ohne Ortsangabe"}
          </span>
          {angabe.land_registration_number ? (
            <span className="mt-1 flex items-center gap-1.5 text-sm">
              <Icon
                icon="solar:check-circle-line-duotone"
                className="size-4 text-emerald-600"
              />
              {angabe.land_registration_number}
            </span>
          ) : angabe.land_registration_unavailable ? (
            <span className="mt-1 text-sm text-muted-foreground">
              Keine Nummer vorhanden
            </span>
          ) : (
            <span className="mt-1 text-sm text-muted-foreground">
              Noch nicht angegeben
            </span>
          )}
        </div>
        {!offen && (
          <button
            type="button"
            onClick={() => setOffen(true)}
            className="shrink-0 text-sm font-medium underline underline-offset-4"
          >
            {angabeErledigt(angabe) ? "Ändern" : "Hinzufügen"}
          </button>
        )}
      </div>

      {offen && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Grundbuch- oder Katasternummer
            </span>
            <input
              type="text"
              value={nummer}
              disabled={keine || laeuft}
              onChange={(e) => setNummer(e.target.value)}
              placeholder="z. B. 1234/5678"
              className="rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:border-foreground disabled:opacity-50"
            />
          </label>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={keine}
              disabled={laeuft}
              onChange={(e) => setKeine(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span className="text-sm text-muted-foreground">
              Für dieses Objekt gibt es keine Grundbuch- oder Katasternummer.
            </span>
          </label>

          {fehler && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <Icon
                icon="solar:danger-triangle-line-duotone"
                className="size-4"
              />
              {fehler}
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" disabled={laeuft} onClick={() => void speichern()}>
              {laeuft ? "Speichert…" : "Speichern"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={laeuft}
              onClick={() => {
                setNummer(angabe.land_registration_number ?? "");
                setKeine(angabe.land_registration_unavailable);
                setFehler(null);
                setOffen(false);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ObjektangabenAbschnitt({
  angaben,
}: {
  angaben: ObjektAngabeStatus[] | null;
}) {
  const [liste, setListe] = useState(angaben ?? []);

  if (angaben === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Objektangaben konnten nicht geladen werden.
      </p>
    );
  }

  if (liste.length === 0) {
    return (
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h3 className="font-display text-xl font-bold">
          Grundbuchnummern deiner Objekte
        </h3>
        <p className="text-sm text-muted-foreground">
          Sobald du ein Objekt angelegt hast, kannst du hier seine
          Grundbuchnummer hinterlegen.
        </p>
      </section>
    );
  }

  const offen = liste.filter((a) => !angabeErledigt(a)).length;

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl font-bold">
          Grundbuchnummern deiner Objekte
        </h3>
        <p className="text-sm text-muted-foreground">
          Für Objekte in der EU melden wir die Grundbuch- oder Katasternummer
          mit, sobald sie vorliegt. Wenn du keine hast, kannst du deine
          Steuerangaben trotzdem einreichen — auf Buchungen und Auszahlungen
          hat das keine Auswirkung.
        </p>
      </div>

      {offen > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-muted p-4 text-sm">
          <Icon
            icon="solar:info-circle-line-duotone"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            {offen === 1
              ? "Für ein Objekt fehlt die Angabe noch."
              : `Für ${offen} Objekte fehlt die Angabe noch.`}
          </span>
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {liste.map((a) => (
          <Zeile
            key={a.property_id}
            angabe={a}
            onGespeichert={(neu) =>
              setListe((alt) =>
                alt.map((x) =>
                  x.property_id === neu.property_id ? neu : x,
                ),
              )
            }
          />
        ))}
      </ul>
    </section>
  );
}
