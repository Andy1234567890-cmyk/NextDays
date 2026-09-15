"use client";

// Ordner-Reiter über der Materialliste (0709) — zugleich die ABLAGEZIELE für
// Drag-and-drop: ein Eintrag wird auf einen Reiter gezogen und liegt danach
// darin.
//
// Native HTML5-Drag-and-drop und keine Bibliothek: gezogen wird ein ganzer
// Eintrag auf ein Ziel, das ist genau das, wofür `dragstart`/`drop` gebaut
// sind. dnd-kit o. ä. lohnt sich bei sortierbaren Listen mit Tastatur- und
// Touch-Unterstützung — hier wären es 40 KB für ein `onDrop`.
//
// Die Reiter sind KEINE Navigation: sie filtern eine Liste, die schon
// vollständig im Speicher liegt. Deshalb kein Router-Parameter, kein Neuladen,
// und das Umschalten kostet nichts.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Material, Ordner } from "@/lib/partner";
import {
  materialVerschieben,
  ordnerAnlegen,
  ordnerLoeschen,
  ordnerUmbenennen,
} from "@/lib/partner-actions";

/** Welcher Reiter offen ist. `null` = „Alle", `""` = „Ohne Ordner".
 *
 *  Drei Zustände und nicht zwei: „alles zeigen" und „genau die zeigen, die in
 *  keinem Ordner liegen" sind verschiedene Fragen, und das Backoffice braucht
 *  beide — sonst findet man nie wieder, was man gerade ohne Reiter hochgeladen
 *  hat. Mit nur `string | null` wären sie nicht unterscheidbar. */
export type ReiterWahl = string | null;

/** Der MIME-Typ, unter dem die Eintrags-ID im Zug hängt. Ein eigener Typ und
 *  nicht `text/plain`: so nimmt die Fläche keinen Text an, den jemand aus einem
 *  anderen Fenster herüberzieht. */
export const ZUG_TYP = "application/x-nextdays-material";

const REITER =
  "rounded-full border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap";

/** Ein Reiter: Filter-Knopf UND Ablageziel in einem. */
function Reiter({
  beschriftung,
  anzahl,
  aktiv,
  ueber,
  waehlen,
  ablegen,
  ueberSetzen,
}: {
  beschriftung: string;
  anzahl: number;
  aktiv: boolean;
  ueber: boolean;
  waehlen: () => void;
  ablegen: (id: string) => void;
  ueberSetzen: (ueber: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={waehlen}
      onDragOver={(e) => {
        // Ohne `preventDefault` im dragover lehnt der Browser den Drop ab —
        // die Fläche sähe aufnahmebereit aus und täte nichts.
        if (!e.dataTransfer.types.includes(ZUG_TYP)) return;
        e.preventDefault();
        ueberSetzen(true);
      }}
      onDragLeave={() => ueberSetzen(false)}
      onDrop={(e) => {
        e.preventDefault();
        ueberSetzen(false);
        const id = e.dataTransfer.getData(ZUG_TYP);
        if (id) ablegen(id);
      }}
      className={`${REITER} ${
        ueber
          ? "border-foreground bg-muted"
          : aktiv
            ? "border-foreground bg-foreground text-background"
            : "border-border hover:border-foreground"
      }`}
    >
      {beschriftung} <span className="opacity-60">{anzahl}</span>
    </button>
  );
}

/** Umbenennen und Entfernen des OFFENEN Ordners. Steht unter den Reitern und
 *  nicht an jedem einzelnen: zwei zusätzliche Knöpfe je Reiter machen aus einer
 *  Leiste eine Werkzeugkiste. */
function OrdnerAktionen({
  offen,
  laeuft,
  umbenennen,
  loeschen,
}: {
  offen: Ordner;
  laeuft: boolean;
  umbenennen: (o: Ordner) => void;
  loeschen: (o: Ordner) => void;
}) {
  return (
    <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>Einträge auf einen Reiter ziehen, um sie zu verschieben.</span>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => umbenennen(offen)}
        className="underline-offset-4 hover:underline"
      >
        Umbenennen
      </button>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => loeschen(offen)}
        className="text-red-600 underline-offset-4 hover:underline"
      >
        Ordner entfernen
      </button>
    </p>
  );
}

export function PartnerMaterialOrdner({
  ordner,
  material,
  aktiv,
  aktivSetzen,
}: {
  ordner: Ordner[];
  material: Material[];
  aktiv: ReiterWahl;
  aktivSetzen: (wahl: ReiterWahl) => void;
}) {
  const [ueber, setUeber] = useState<ReiterWahl | undefined>(undefined);
  const [neu, setNeu] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const ohneOrdner = material.filter((m) => !m.folder_id).length;
  const offen = ordner.find((o) => o.id === aktiv) ?? null;

  /** `""` (Ohne Ordner) und `null` (Alle) heißen für den Server dasselbe: kein
   *  Ordner. „Alle" als Ziel ist trotzdem sinnvoll — es ist die Geste „raus hier". */
  const verschieben = (ziel: ReiterWahl, id: string) =>
    starte(async () => {
      const res = await materialVerschieben([id], ziel || null);
      if (!res.ok) toast.error(res.fehler);
    });

  const reiterProps = (ziel: ReiterWahl) => ({
    aktiv: aktiv === ziel,
    ueber: ueber === ziel,
    waehlen: () => aktivSetzen(ziel),
    ablegen: (id: string) => verschieben(ziel, id),
    ueberSetzen: (an: boolean) => setUeber(an ? ziel : undefined),
  });

  const anlegen = () => {
    const name = (neu ?? "").trim();
    if (!name) {
      setNeu(null);
      return;
    }
    starte(async () => {
      const res = await ordnerAnlegen(name);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      setNeu(null);
      aktivSetzen(res.data.id);
    });
  };

  const umbenennen = (o: Ordner) => {
    const name = window.prompt("Neuer Name des Ordners", o.name)?.trim();
    if (!name || name === o.name) return;
    starte(async () => {
      const res = await ordnerUmbenennen(o.id, name);
      if (!res.ok) toast.error(res.fehler);
    });
  };

  const loeschen = (o: Ordner) => {
    if (
      !window.confirm(
        `Ordner „${o.name}“ entfernen? Die ${o.anzahl} Einträge darin bleiben ` +
          "erhalten und liegen danach in keinem Ordner.",
      )
    )
      return;
    starte(async () => {
      const res = await ordnerLoeschen(o.id);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      aktivSetzen(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Reiter beschriftung="Alle" anzahl={material.length} {...reiterProps(null)} />
        {ordner.map((o) => (
          <Reiter key={o.id} beschriftung={o.name} anzahl={o.anzahl} {...reiterProps(o.id)} />
        ))}
        {ohneOrdner > 0 && (
          <Reiter beschriftung="Ohne Ordner" anzahl={ohneOrdner} {...reiterProps("")} />
        )}

        {neu === null ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => setNeu("")}
            className={`${REITER} border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground`}
          >
            + Ordner
          </button>
        ) : (
          <input
            autoFocus
            maxLength={60}
            value={neu}
            placeholder="Ordnername"
            onChange={(e) => setNeu(e.target.value)}
            onBlur={anlegen}
            onKeyDown={(e) => {
              if (e.key === "Enter") anlegen();
              if (e.key === "Escape") setNeu(null);
            }}
            className="rounded-full border border-foreground bg-transparent px-4 py-2 text-sm outline-none"
          />
        )}
      </div>

      {offen && (
        <OrdnerAktionen
          offen={offen}
          laeuft={laeuft}
          umbenennen={umbenennen}
          loeschen={loeschen}
        />
      )}
    </div>
  );
}
