"use client";

// Ein Schloss einer Einheit ODER einem Gebäude zuordnen.
//
// WARUM ZWEI EBENEN UND NICHT EINE LISTE: Ein Schloss ist entweder die Tür
// EINER Einheit (nur dieser Gast kommt hinein) oder eine Gemeinschaftstür des
// Gebäudes (jeder Gast im Haus muss sie öffnen können — Hauseingang, Tor,
// Waschküche). Das ist keine Darstellungsfrage, sondern entscheidet, welche
// Gäste einen Code für dieses Schloss bekommen.
//
// Guesty trennt genauso („private unit door" / „common door") und hat damit
// die beste Lösung im Feld. Bei uns passt sie exakt aufs Datenmodell:
// Einheit = `property_units`, Gebäude = `buildings`.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { listBuildings, listProperties, listUnits } from "@/lib/properties";
import { ordneGeraetZu } from "@/lib/schloesser-api";

type Ebene = "einheit" | "gebaeude";

type Auswahl = { id: string; label: string };

export function GeraetZuordnen({
  deviceId,
  onFertig,
  onAbbrechen,
}: {
  deviceId: string;
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const [ebene, setEbene] = useState<Ebene>("einheit");
  const [objekte, setObjekte] = useState<Auswahl[]>([]);
  const [objektId, setObjektId] = useState("");
  const [einheiten, setEinheiten] = useState<Auswahl[]>([]);
  const [zielId, setZielId] = useState("");
  const [gebaeude, setGebaeude] = useState<Auswahl[]>([]);
  const [speichert, setSpeichert] = useState(false);

  // Objekte und Gebäude einmal laden. Beide Listen sind klein (ein Betrieb hat
  // Dutzende Objekte, nicht Tausende) — kein Blättern nötig.
  useEffect(() => {
    void (async () => {
      const [p, b] = await Promise.all([listProperties(), listBuildings()]);
      if (p.ok) {
        setObjekte(
          p.data.items.map((o) => ({
            id: String(o.id),
            label: o.title || "Objekt ohne Namen",
          })),
        );
      }
      if (b.ok) {
        setGebaeude(
          b.data.map((g) => ({
            id: String(g.id),
            label: g.name || "Gebäude ohne Namen",
          })),
        );
      }
    })();
  }, []);

  // Einheiten hängen am gewählten Objekt — erst nachladen, wenn eines gewählt
  // ist. Ein Objekt hat mindestens eine Einheit (0265), meist genau eine.
  useEffect(() => {
    if (!objektId) {
      setEinheiten([]);
      setZielId("");
      return;
    }
    void (async () => {
      const res = await listUnits(objektId);
      if (!res.ok) {
        setEinheiten([]);
        return;
      }
      const liste = res.data.map((u, i) => ({
        id: String(u.id),
        label: u.name || `Einheit ${i + 1}`,
      }));
      setEinheiten(liste);
      // Bei genau einer Einheit gleich vorwählen: der häufigste Fall (eine
      // Ferienwohnung), und ein Pflicht-Klick auf die einzige Option wäre nur
      // Arbeit ohne Entscheidung.
      setZielId(liste.length === 1 ? liste[0].id : "");
    })();
  }, [objektId]);

  async function speichern() {
    if (!zielId) return;
    setSpeichert(true);
    const res = await ordneGeraetZu(
      ebene === "einheit"
        ? { deviceId, unitId: zielId }
        : { deviceId, buildingId: zielId },
    );
    setSpeichert(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Schloss zugeordnet.");
    onFertig();
  }

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
      {/* Ebene wählen — mit dem Unterschied im Klartext, nicht nur als Label */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Welche Tür ist das?
        </span>
        <div className="flex flex-wrap gap-2">
          <EbenenKnopf
            aktiv={ebene === "einheit"}
            icon="ph:door"
            titel="Tür einer Einheit"
            hinweis="Nur der Gast dieser Einheit"
            onClick={() => {
              setEbene("einheit");
              setZielId("");
            }}
          />
          <EbenenKnopf
            aktiv={ebene === "gebaeude"}
            icon="ph:buildings"
            titel="Gemeinschaftstür"
            hinweis="Alle Gäste im Gebäude"
            onClick={() => {
              setEbene("gebaeude");
              setZielId("");
            }}
          />
        </div>
      </div>

      {ebene === "einheit" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Objekt</span>
            <select
              value={objektId}
              onChange={(e) => setObjektId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Bitte wählen …</option>
              {objekte.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Einheit</span>
            <select
              value={zielId}
              onChange={(e) => setZielId(e.target.value)}
              disabled={!objektId || einheiten.length === 0}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {objektId ? "Bitte wählen …" : "Erst Objekt wählen"}
              </option>
              {einheiten.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Gebäude</span>
          <select
            value={zielId}
            onChange={(e) => setZielId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Bitte wählen …</option>
            {gebaeude.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          {gebaeude.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Es sind noch keine Gebäude angelegt. Gemeinschaftstüren brauchen
              ein Gebäude, dem die Objekte zugeordnet sind.
            </span>
          )}
        </label>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => void speichern()}
          disabled={!zielId || speichert}
        >
          {speichert && (
            <Icon icon="svg-spinners:180-ring" className="size-4" />
          )}
          Zuordnen
        </Button>
        <Button variant="ghost" size="sm" onClick={onAbbrechen}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

function EbenenKnopf({
  aktiv,
  icon,
  titel,
  hinweis,
  onClick,
}: {
  aktiv: boolean;
  icon: string;
  titel: string;
  hinweis: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-left ${
        aktiv
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      <Icon icon={icon} className="mt-0.5 size-4 shrink-0" />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{titel}</span>
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      </span>
    </button>
  );
}
