"use client";

// Der Ordnerbaum der Mediathek — links, wie bei Hostaways Media Manager.
//
// Selbst-genügsam für Anlegen/Umbenennen/Löschen: die Baumzeile ruft die
// Server-Actions aus `site-medien.ts` direkt auf und meldet dem Aufrufer nur
// „etwas hat sich geändert" (`onGeaendert`). Ein Umweg über den Elternzustand
// für jeden Tastendruck beim Umbenennen wäre unnötige Kopplung.
//
// Verschieben geht ZWEIFACH per Ziehen: ein Ordner auf einen anderen Ordner
// (verschiebt den Ast), und ein Bild aus der Kachelwand auf einen Ordner
// (verschiebt das Bild). Beide Ziele lesen denselben nativen DnD-Kanal, aber
// unterscheiden sich an der MIME-Art des Transfers — kein zweiter Mechanismus.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type MediaOrdner,
  createMediaOrdner,
  deleteMediaOrdner,
  moveMedia,
  previewMediaOrdnerLoeschen,
  updateMediaOrdner,
} from "@/lib/site-medien";

/** Was gerade angezeigt wird. `null` = alle Bilder ungeachtet des Ordners,
 *  `""` = nur Bilder OHNE Ordner (Wurzel), sonst eine Ordner-ID. Drei
 *  unterscheidbare Zustände, weil der Server sie auch dreifach unterscheidet
 *  (`folder_id` vs. `root`). */
export type OrdnerAnsicht = string | null;

/** MIME-Art, unter der die Kachelwand die Auswahl beim Ziehen ablegt. Beide
 *  Seiten (Ordnerbaum, Kachelwand) kennen diese Zeichenkette — kein Import
 *  zwischen den beiden Geschwisterkomponenten nötig. */
export const MEDIEN_DRAG_TYP = "application/x-nextdays-medien";

const MAX_TIEFE = 3;

/** Über welchem Drop-Ziel gerade gezogen wird. `undefined` = über keinem —
 *  eigener Zustand neben `OrdnerAnsicht`, weil „keine Ansicht ausgewählt"
 *  (gibt es hier nicht) etwas anderes ist als „kein Ziehvorgang im Gang". */
type ZielAnsicht = OrdnerAnsicht | undefined;

export function OrdnerBaum({
  ordner,
  rootCount,
  aktiv,
  onWahl,
  onGeaendert,
}: {
  ordner: MediaOrdner[];
  rootCount: number;
  aktiv: OrdnerAnsicht;
  onWahl: (a: OrdnerAnsicht) => void;
  /** Nach jeder Schreibaktion — der Aufrufer lädt Ordner UND Bilder neu, denn
   *  ein verschobenes Bild ändert auch die Zähler der Kachelwand. */
  onGeaendert: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const [neuUnter, setNeuUnter] = useState<string | null | undefined>(
    undefined,
  );
  const [name, setName] = useState("");
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const [loeschAbfrage, setLoeschAbfrage] = useState<MediaOrdner | null>(null);
  const [zielUeber, setZielUeber] = useState<ZielAnsicht>(undefined);

  const kinder = useMemo(() => {
    const m = new Map<string, MediaOrdner[]>();
    for (const o of ordner) {
      const key = o.parent_id ?? "";
      m.set(key, [...(m.get(key) ?? []), o]);
    }
    for (const liste of m.values()) liste.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [ordner]);

  const tiefeVon = useMemo(() => {
    const nachEltern = new Map(ordner.map((o) => [o.id, o.parent_id]));
    return (id: string): number => {
      let t2 = 1;
      let aktuellId: string | null | undefined = id;
      while (aktuellId && t2 <= MAX_TIEFE + 1) {
        t2 += 1;
        aktuellId = nachEltern.get(aktuellId) ?? null;
      }
      return t2;
    };
  }, [ordner]);

  async function anlegen(parentId: string | null) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await createMediaOrdner(trimmed, parentId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNeuUnter(undefined);
    setName("");
    onGeaendert();
  }

  async function umbennenSpeichern(id: string) {
    const trimmed = name.trim();
    setUmbenennen(null);
    if (!trimmed) return;
    const res = await updateMediaOrdner(id, { name: trimmed });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onGeaendert();
  }

  async function verschieben(id: string, neuesEltern: string | null) {
    const res = await updateMediaOrdner(id, { parent_id: neuesEltern });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ordner.verschoben"));
    onGeaendert();
  }

  async function bilderAblegen(zielOrdner: string | null, ids: string[]) {
    if (ids.length === 0) return;
    const res = await moveMedia(ids, zielOrdner);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ordner.bildVerschoben", { anzahl: ids.length }));
    onGeaendert();
  }

  async function loeschenBestaetigt() {
    if (!loeschAbfrage) return;
    const res = await deleteMediaOrdner(loeschAbfrage.id);
    setLoeschAbfrage(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (aktiv === loeschAbfrage.id) onWahl(null);
    onGeaendert();
  }

  function annehmen(e: React.DragEvent): boolean {
    return (
      e.dataTransfer.types.includes(MEDIEN_DRAG_TYP) ||
      e.dataTransfer.types.includes("application/x-nextdays-ordner")
    );
  }

  function abwerfen(e: React.DragEvent, zielOrdner: string | null) {
    e.preventDefault();
    setZielUeber(undefined);
    const ordnerId = e.dataTransfer.getData("application/x-nextdays-ordner");
    if (ordnerId) {
      if (ordnerId === zielOrdner) return;
      void verschieben(ordnerId, zielOrdner);
      return;
    }
    const roh = e.dataTransfer.getData(MEDIEN_DRAG_TYP);
    if (!roh) return;
    try {
      const ids = JSON.parse(roh) as string[];
      void bilderAblegen(zielOrdner, ids);
    } catch {
      // Kein gültiges JSON — kein Ziehvorgang aus der Kachelwand, ignorieren.
    }
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 text-sm">
      <ZeileFest
        label={t("ordner.alle")}
        icon="ph:images"
        aktiv={aktiv === null}
        anzahl={ordner.reduce((s, o) => s + o.media_count, 0) + rootCount}
        onKlick={() => onWahl(null)}
        onDragOver={(e) => {
          if (!annehmen(e)) return;
          e.preventDefault();
        }}
      />
      <ZeileFest
        label={t("ordner.wurzel")}
        icon="ph:folder-dashed"
        aktiv={aktiv === ""}
        anzahl={rootCount}
        onKlick={() => onWahl("")}
        markiert={zielUeber === ""}
        onDragOver={(e) => {
          if (!annehmen(e)) return;
          e.preventDefault();
          setZielUeber("");
        }}
        onDragLeave={() => setZielUeber(undefined)}
        onDrop={(e) => abwerfen(e, null)}
      />

      <div className="mt-1 border-t border-border pt-1">
        {(kinder.get("") ?? []).map((o) => (
          <OrdnerKnoten
            key={o.id}
            ordner={o}
            ebene={0}
            kinder={kinder}
            aktiv={aktiv}
            zielUeber={zielUeber}
            neuUnter={neuUnter}
            umbenennen={umbenennen}
            name={name}
            tiefeVon={tiefeVon}
            onWahl={onWahl}
            setZielUeber={setZielUeber}
            setNeuUnter={setNeuUnter}
            setUmbenennen={setUmbenennen}
            setName={setName}
            onAnlegen={anlegen}
            onUmbenennenSpeichern={umbennenSpeichern}
            onLoeschAbfrage={setLoeschAbfrage}
            annehmen={annehmen}
            abwerfen={abwerfen}
          />
        ))}
      </div>

      {neuUnter === null ? (
        <NeuZeile
          name={name}
          setName={setName}
          onAbbrechen={() => {
            setNeuUnter(undefined);
            setName("");
          }}
          onAnlegen={() => void anlegen(null)}
          platzhalter={t("ordner.neuerName")}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNeuUnter(null);
            setName("");
          }}
          className="mt-1 flex items-center gap-1.5 rounded-(--radius) px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:plus" className="size-3.5" />
          {t("ordner.neu")}
        </button>
      )}

      {loeschAbfrage ? (
        <OrdnerLoeschDialog
          ordner={loeschAbfrage}
          onAbbrechen={() => setLoeschAbfrage(null)}
          onBestaetigen={() => void loeschenBestaetigt()}
        />
      ) : null}
    </div>
  );
}

function ZeileFest({
  label,
  icon,
  aktiv,
  anzahl,
  markiert = false,
  onKlick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  icon: string;
  aktiv: boolean;
  anzahl: number;
  markiert?: boolean;
  onKlick: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onKlick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        "flex items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left transition " +
        (aktiv
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground") +
        (markiert ? " ring-2 ring-(--brand)" : "")
      }
    >
      <Icon icon={icon} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {anzahl}
      </span>
    </button>
  );
}

function NeuZeile({
  name,
  setName,
  onAbbrechen,
  onAnlegen,
  platzhalter,
}: {
  name: string;
  setName: (v: string) => void;
  onAbbrechen: () => void;
  onAnlegen: () => void;
  platzhalter: string;
}) {
  return (
    <div className="mt-1 flex items-center gap-1 px-1">
      <input
        autoFocus
        value={name}
        placeholder={platzhalter}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAnlegen();
          if (e.key === "Escape") onAbbrechen();
        }}
        className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={onAnlegen}
        aria-label="OK"
        className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:check" className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onAbbrechen}
        aria-label="Abbrechen"
        className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:x" className="size-3.5" />
      </button>
    </div>
  );
}

/** Props eines Baumknotens. Eigener Typ statt Inline-Objekt: derselbe Typ
 *  beschreibt sowohl die Wurzel-Aufrufstelle als auch den rekursiven Aufruf am
 *  Ende der Funktion — ohne ihn müssten beide unabhängig synchron gehalten
 *  werden. */
type OrdnerKnotenProps = {
  ordner: MediaOrdner;
  ebene: number;
  kinder: Map<string, MediaOrdner[]>;
  aktiv: OrdnerAnsicht;
  zielUeber: ZielAnsicht;
  neuUnter: string | null | undefined;
  umbenennen: string | null;
  name: string;
  tiefeVon: (id: string) => number;
  onWahl: (a: OrdnerAnsicht) => void;
  setZielUeber: (a: ZielAnsicht) => void;
  setNeuUnter: (id: string | null | undefined) => void;
  setUmbenennen: (id: string | null) => void;
  setName: (v: string) => void;
  onAnlegen: (parentId: string) => void;
  onUmbenennenSpeichern: (id: string) => void;
  onLoeschAbfrage: (o: MediaOrdner) => void;
  annehmen: (e: React.DragEvent) => boolean;
  abwerfen: (e: React.DragEvent, zielOrdner: string | null) => void;
};

function OrdnerKnoten({
  ordner: o,
  ebene,
  kinder,
  aktiv,
  zielUeber,
  neuUnter,
  umbenennen,
  name,
  tiefeVon,
  onWahl,
  setZielUeber,
  setNeuUnter,
  setUmbenennen,
  setName,
  onAnlegen,
  onUmbenennenSpeichern,
  onLoeschAbfrage,
  annehmen,
  abwerfen,
}: OrdnerKnotenProps) {
  const t = useTranslations("website.mediathek");
  const kannUnterordner = tiefeVon(o.id) < MAX_TIEFE;
  const eigeneKinder = kinder.get(o.id) ?? [];

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-nextdays-ordner", o.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!annehmen(e)) return;
          e.preventDefault();
          setZielUeber(o.id);
        }}
        onDragLeave={() => setZielUeber(undefined)}
        onDrop={(e) => abwerfen(e, o.id)}
        style={{ paddingLeft: `${ebene * 0.9 + 0.5}rem` }}
        className={
          "group flex items-center gap-1 rounded-(--radius) py-1 pr-1 transition " +
          (aktiv === o.id
            ? "bg-secondary font-medium text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground") +
          (zielUeber === o.id ? " ring-2 ring-(--brand)" : "")
        }
      >
        {umbenennen === o.id ? (
          <input
            autoFocus
            defaultValue={o.name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => onUmbenennenSpeichern(o.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onUmbenennenSpeichern(o.id);
              if (e.key === "Escape") setUmbenennen(null);
            }}
            className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-1.5 py-0.5 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => onWahl(o.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
          >
            <Icon icon="ph:folder" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{o.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {o.media_count}
            </span>
          </button>
        )}

        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {kannUnterordner ? (
            <button
              type="button"
              title={t("ordner.neu")}
              aria-label={t("ordner.neu")}
              onClick={() => {
                setNeuUnter(o.id);
                setName("");
              }}
              className="rounded-full p-1 hover:bg-secondary"
            >
              <Icon icon="ph:plus" className="size-3" />
            </button>
          ) : null}
          <button
            type="button"
            title={t("ordner.umbenennen")}
            aria-label={t("ordner.umbenennen")}
            onClick={() => {
              setUmbenennen(o.id);
              setName(o.name);
            }}
            className="rounded-full p-1 hover:bg-secondary"
          >
            <Icon icon="ph:pencil-simple" className="size-3" />
          </button>
          <button
            type="button"
            title={t("ordner.loeschen")}
            aria-label={t("ordner.loeschen")}
            onClick={() => onLoeschAbfrage(o)}
            className="rounded-full p-1 hover:bg-secondary hover:text-destructive"
          >
            <Icon icon="ph:trash" className="size-3" />
          </button>
        </div>
      </div>

      {neuUnter === o.id ? (
        <div style={{ paddingLeft: `${(ebene + 1) * 0.9 + 0.5}rem` }}>
          <NeuZeile
            name={name}
            setName={setName}
            onAbbrechen={() => {
              setNeuUnter(undefined);
              setName("");
            }}
            onAnlegen={() => onAnlegen(o.id)}
            platzhalter={t("ordner.neuerName")}
          />
        </div>
      ) : null}

      {eigeneKinder.map((kind) => (
        <OrdnerKnoten
          key={kind.id}
          ordner={kind}
          ebene={ebene + 1}
          kinder={kinder}
          aktiv={aktiv}
          zielUeber={zielUeber}
          neuUnter={neuUnter}
          umbenennen={umbenennen}
          name={name}
          tiefeVon={tiefeVon}
          onWahl={onWahl}
          setZielUeber={setZielUeber}
          setNeuUnter={setNeuUnter}
          setUmbenennen={setUmbenennen}
          setName={setName}
          onAnlegen={onAnlegen}
          onUmbenennenSpeichern={onUmbenennenSpeichern}
          onLoeschAbfrage={onLoeschAbfrage}
          annehmen={annehmen}
          abwerfen={abwerfen}
        />
      ))}
    </div>
  );
}

function OrdnerLoeschDialog({
  ordner,
  onAbbrechen,
  onBestaetigen,
}: {
  ordner: MediaOrdner;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const [vorschau, setVorschau] = useState<
    { subfolder_count: number; media_count: number } | null | "fehler"
  >(null);

  useEffect(() => {
    let lebt = true;
    void previewMediaOrdnerLoeschen(ordner.id).then((res) => {
      if (!lebt) return;
      setVorschau(res.ok ? res.data : "fehler");
    });
    return () => {
      lebt = false;
    };
  }, [ordner.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="w-full max-w-sm rounded-(--radius) border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-extrabold">
          {t("ordner.loeschVorschauTitel", { name: ordner.name })}
        </h3>
        {vorschau === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("ordner.laedt")}</p>
        ) : vorschau === "fehler" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("ordner.loeschVorschauFehler")}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{t("ordner.loeschVorschauUnterordner", { anzahl: vorschau.subfolder_count })}</p>
            <p>{t("ordner.loeschVorschauBilder", { anzahl: vorschau.media_count })}</p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-secondary"
          >
            {t("ordner.abbrechen")}
          </button>
          <button
            type="button"
            onClick={onBestaetigen}
            className="rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
          >
            {t("ordner.loeschenBestaetigen")}
          </button>
        </div>
      </div>
    </div>
  );
}
