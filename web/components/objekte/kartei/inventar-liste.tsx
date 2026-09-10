"use client";

// Die Inventarliste eines Objekts — nach Räumen gegliedert, mit Soll/Ist und
// Schadensmeldung.
//
// WARUM SOLL UND IST GETRENNT: bei einer Inventur ist genau die Differenz die
// Aussage. „6 Weingläser" allein sagt nichts; „6 sollen, 4 sind da" schon.
//
// DIE LISTE IST NIE FERTIG: ein Betrieb kauft nach, tauscht aus, ergänzt beim
// Rundgang. Deshalb kein einmaliger Import, sondern jederzeit erweiterbar —
// von Hand oder aus einem PDF der digitalen Mappe.
//
// SCHADEN MELDEN GEHT NUR MIT FOTO. Der Server weist eine Meldung ohne Bild
// ab; die Oberfläche macht das vorher sichtbar, statt den Nutzer in einen
// Fehler laufen zu lassen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Textarea } from "@nextdays/ui/textarea";
import {
  bestaetigeSchaden,
  createInventar,
  createInventarRaum,
  deleteInventar,
  listInventar,
  listInventarRaeume,
  leseInventarPdf,
  listSchaeden,
  meldeSchaden,
  referenzfotoUrl,
  setzeReferenzfoto,
  schadenFotoUrl,
  updateInventar,
  verwerfeSchaden,
  type InventarGegenstand,
  type InventarRaum,
  type InventarSchaden,
  type InventarVorschlag,
} from "@/lib/property-dossier";
import { ZAEHL_RHYTHMEN, ZUSTAENDE } from "@/lib/inventar-konstanten";

const ARTEN = ["beschaedigt", "fehlt", "entsorgt"] as const;
const TRAEGER = ["eigentuemer", "gast", "betrieb"] as const;

export function InventarListe({ pid }: { pid: string }) {
  const t = useTranslations("dossier");
  const [raeume, setRaeume] = useState<InventarRaum[]>([]);
  const [liste, setListe] = useState<InventarGegenstand[]>([]);
  const [schaeden, setSchaeden] = useState<InventarSchaden[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [melden, setMelden] = useState<InventarGegenstand | null>(null);
  // Vorschlaege aus einem PDF. Bewusst NUR im Zustand, nicht gespeichert:
  // eine Zwischentabelle waere ein weiterer Zustand mit eigenem
  // Gegenzustand (Wurzel 1) — verwaiste Zeilen, die niemand aufraeumt.
  const [vorschlaege, setVorschlaege] = useState<InventarVorschlag[] | null>(null);
  const [bild, setBild] = useState<{ name: string; url: string } | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const [r, g, s] = await Promise.all([
        listInventarRaeume(pid),
        listInventar(pid),
        listSchaeden(pid),
      ]);
      // Debugging ist Pflicht: ein haengendes „Wird geladen" waere sonst
      // nicht von einem stillen Fehler zu unterscheiden.
      console.debug("[inventar] geladen", { pid, r: r.ok, g: g.ok, s: s.ok });
      if (r.ok) setRaeume(r.data);
      if (g.ok) setListe(g.data);
      if (s.ok) setSchaeden(s.data);
      const schief = [r, g, s].find((x) => !x.ok);
      setFehler(schief && !schief.ok ? schief.error : null);
    } catch (exc) {
      // Eine Server-Action kann WERFEN statt ein Result zu liefern. Ohne
      // diesen Fang bliebe `setLaedt(false)` aus und die Liste hinge fuer
      // immer auf „Wird geladen".
      console.error("[inventar] laden geworfen", exc);
      setFehler(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLaedt(false);
    }
  }, [pid]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const offeneSchaeden = schaeden.filter(
    (s) => s.status === "gemeldet" || s.status === "bestaetigt",
  );
  // Schaeden je Gegenstand, damit die Zeile zeigt, was an ihr haengt.
  const schadenJeItem = new Map<string, number>();
  for (const s of offeneSchaeden) {
    if (s.item_id) {
      schadenJeItem.set(s.item_id, (schadenJeItem.get(s.item_id) ?? 0) + 1);
    }
  }

  async function bildAnsehen(fotoId: string, name: string) {
    const r = await schadenFotoUrl(pid, fotoId);
    if (!r.ok) {
      setFehler(r.error);
      return;
    }
    setBild({ name, url: r.data.url });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t("inventar.titel")}</h3>
          <p className="text-xs text-muted-foreground">{t("inventar.erklaerung")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfImport pid={pid} t={t} onVorschlaege={setVorschlaege} onFehler={setFehler} />
          <NeueZeile pid={pid} raeume={raeume} t={t} onFertig={laden} onFehler={setFehler} />
        </div>
      </div>

      {fehler && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      {vorschlaege && (
        <VorschlagsListe
          pid={pid}
          t={t}
          raeume={raeume}
          items={vorschlaege}
          onAbbrechen={() => setVorschlaege(null)}
          onFertig={async () => {
            setVorschlaege(null);
            await laden();
          }}
          onFehler={setFehler}
        />
      )}

      {offeneSchaeden.length > 0 && (
        <SchadenBereich
          pid={pid}
          t={t}
          schaeden={offeneSchaeden}
          onFertig={laden}
          onFehler={setFehler}
          onBild={bildAnsehen}
        />
      )}

      {laedt ? (
        <p className="text-sm text-muted-foreground">{t("inventar.laedt")}</p>
      ) : (
        <RaumBereich
          pid={pid}
          t={t}
          raeume={raeume}
          liste={liste}
          schadenJeItem={schadenJeItem}
          onFertig={laden}
          onFehler={setFehler}
          onMelden={setMelden}
        />
      )}

      {melden && (
        <SchadenMelden
          pid={pid}
          t={t}
          gegenstand={melden}
          onSchliessen={() => setMelden(null)}
          onFertig={async () => {
            setMelden(null);
            await laden();
          }}
          onFehler={setFehler}
        />
      )}

      <Dialog open={bild !== null} onOpenChange={(o) => !o && setBild(null)}>
        <DialogContent className="max-w-3xl gap-3">
          <DialogTitle className="pr-8 text-base font-semibold">{bild?.name}</DialogTitle>
          {bild && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild.url} alt={bild.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations<"dossier">>;
type Melder = (f: string | null) => void;

/** Eine Zeile ergänzen. Die Liste ist nie fertig — deshalb steht das Feld
 *  dauerhaft da und nicht hinter einem Modal. */
function NeueZeile({
  pid,
  raeume,
  t,
  onFertig,
  onFehler,
}: {
  pid: string;
  raeume: InventarRaum[];
  t: TFn;
  onFertig: () => Promise<void>;
  onFehler: Melder;
}) {
  const [name, setName] = useState("");
  const [soll, setSoll] = useState("");
  const [raum, setRaum] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function anlegen() {
    const sauber = name.trim();
    if (!sauber || laeuft) return;
    setLaeuft(true);
    const r = await createInventar(pid, {
      eintraege: [
        {
          name: sauber,
          room_id: raum || null,
          soll_menge: soll.trim() ? Number(soll) : null,
        },
      ],
    });
    setLaeuft(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    setName("");
    setSoll("");
    await onFertig();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("inventar.neuName")}
        className="w-48"
        onKeyDown={(e) => {
          if (e.key === "Enter") void anlegen();
        }}
      />
      <Input
        value={soll}
        onChange={(e) => setSoll(e.target.value.replace(/\D/g, ""))}
        placeholder={t("inventar.neuSoll")}
        inputMode="numeric"
        className="w-24"
      />
      {raeume.length > 0 && (
        <select
          value={raum}
          onChange={(e) => setRaum(e.target.value)}
          className="rounded-lg border border-border bg-background py-2 pl-3 pr-9 text-sm"
        >
          <option value="">{t("inventar.ohneRaum")}</option>
          {raeume.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <Button type="button" onClick={() => void anlegen()} disabled={laeuft || !name.trim()}>
        <Icon icon="ph:plus" className="size-4" />
        {t("inventar.hinzufuegen")}
      </Button>
    </div>
  );
}

/** Räume anlegen — die Gliederung des Rundgangs. */
/** Die Reiterleiste: Navigation UND Ablageziel in einem.
 *
 *  Steht getrennt von der Liste darunter, weil sie eine eigene Aufgabe hat —
 *  und weil beides zusammen eine Komponente ergaebe, die niemand mehr am
 *  Stueck liest. */
function Reiterleiste({
  t,
  reiter,
  aktiv,
  ueber,
  zaehler,
  neuerRaum,
  offen,
  onAktiv,
  onUeber,
  onAblegen,
  onNeuerRaum,
  onOffen,
  onAnlegen,
}: {
  t: TFn;
  reiter: { id: string | null; name: string }[];
  aktiv: string | null;
  ueber: string | null | undefined;
  zaehler: (id: string | null) => number;
  neuerRaum: string;
  offen: boolean;
  onAktiv: (id: string | null) => void;
  onUeber: (v: string | null | undefined) => void;
  onAblegen: (e: React.DragEvent, ziel: string | null) => void;
  onNeuerRaum: (v: string) => void;
  onOffen: (v: boolean) => void;
  onAnlegen: () => Promise<void>;
}) {
  return (
    // Reiterleiste mit Unterstrich wie in `reisebueros/agency-detail` — nicht
    // als Pill-Reihe. Raeume sind Ansichten DERSELBEN Liste, und dafuer ist der
    // Reiter die eingefuehrte Form; runde Vollflaechen lesen sich als Filter-
    // Chips, die man mehrfach setzen koennte. Kein `overflow-auto`: die
    // -mb-px-Ueberlappung des Unterstrichs machte den Container sonst
    // scrollbar.
    <div
      className="flex flex-wrap items-center gap-1 border-b border-border"
      role="tablist"
    >
      {reiter.map(({ id, name }) => {
        const an = aktiv === id;
        const zielt = ueber === id;
        return (
          <button
            key={id ?? "ohne"}
            type="button"
            role="tab"
            aria-selected={an}
            onClick={() => onAktiv(id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onUeber(id);
            }}
            onDragLeave={() => onUeber(undefined)}
            onDrop={(e) => onAblegen(e, id)}
            className={
              "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-(--radius) border-b-2 px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              // Ziehen: der Reiter, ueber dem der Gegenstand schwebt, hebt sich
              // FLAECHIG ab. Nur den Unterstrich zu faerben wuerde beim Ablegen
              // nicht auffallen — das Ziel muss waehrend des Ziehens eindeutig
              // sein, auch wenn es nicht der aktive Reiter ist.
              (zielt
                ? "border-primary bg-primary/10 text-foreground"
                : an
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {name}
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs tabular-nums " +
                (an
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground")
              }
            >
              {zaehler(id)}
            </span>
          </button>
        );
      })}
      {/* „Raum hinzufuegen" ist KEIN Reiter (kein role=tab): es waehlt keine
          Ansicht, es legt eine an. Deshalb steht es neben der Leiste und
          traegt bewusst keinen Unterstrich. */}
      {offen ? (
        <span className="-mb-px flex items-center gap-1.5 py-1.5 ps-1">
          <Input
            autoFocus
            value={neuerRaum}
            onChange={(e) => onNeuerRaum(e.target.value)}
            placeholder={t("inventar.raumName")}
            className="h-8 w-36"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAnlegen();
              if (e.key === "Escape") onOffen(false);
            }}
          />
          <Button type="button" size="sm" onClick={() => void onAnlegen()}>
            {t("inventar.speichern")}
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mb-px h-auto px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => onOffen(true)}
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("inventar.raumHinzufuegen")}
        </Button>
      )}
    </div>
  );
}

/** Räume als Reiter, Zuweisung per Ziehen.
 *
 *  Warum Reiter statt einer langen Gliederung: die Liste eines Ferienhauses
 *  hat schnell 200 Zeilen. Wer die Küche zählt, will die Küche sehen — nicht
 *  an neunzehn Gartenposten vorbeirollen. Der Reiter ist zugleich das
 *  Ablageziel: einen Gegenstand auf „Küche" ziehen weist ihn zu.
 *
 *  Ziehen ist NICHT der einzige Weg. Ein Auswahlfeld je Zeile macht dasselbe
 *  — mit Tastatur, auf dem Handy und für alle, die keine Maus führen können.
 *  Eine Bedienung, die nur zieht, schliesst sie aus. */
function RaumBereich({
  pid,
  t,
  raeume,
  liste,
  schadenJeItem,
  onFertig,
  onFehler,
  onMelden,
}: {
  pid: string;
  t: TFn;
  raeume: InventarRaum[];
  liste: InventarGegenstand[];
  schadenJeItem: Map<string, number>;
  onFertig: () => Promise<void>;
  onFehler: Melder;
  onMelden: (g: InventarGegenstand) => void;
}) {
  // `null` = „Ohne Raum". Bewusst ein eigener Reiter und kein Sonderfall:
  // der Rest, den noch niemand zugeordnet hat, ist die Arbeitsliste.
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null | undefined>(undefined);
  const [neuerRaum, setNeuerRaum] = useState("");
  const [offen, setOffen] = useState(false);
  const [schiebt, setSchiebt] = useState(false);

  const zaehler = (id: string | null) =>
    liste.filter((g) => (g.room_id ?? null) === id).length;

  const ohneRaum = zaehler(null);
  // Der erste Reiter mit Inhalt gewinnt, wenn der aktive leer wird — sonst
  // starrt der Nutzer nach dem letzten Verschieben auf eine leere Fläche.
  const aktivGueltig =
    aktiv === null || raeume.some((r) => r.id === aktiv) ? aktiv : null;
  const posten = liste.filter((g) => (g.room_id ?? null) === aktivGueltig);

  async function raumAnlegen() {
    const sauber = neuerRaum.trim();
    if (!sauber) return;
    const r = await createInventarRaum(pid, {
      name: sauber,
      sortierung: raeume.length,
    });
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    setNeuerRaum("");
    setOffen(false);
    await onFertig();
  }

  async function zuweisen(itemId: string, ziel: string | null) {
    if (schiebt) return;
    const g = liste.find((x) => x.id === itemId);
    // Derselbe Raum: kein Aufruf. Ein PATCH, der nichts ändert, ist trotzdem
    // eine Schreiblast und ein Eintrag in der Änderungsspur.
    if (!g || (g.room_id ?? null) === ziel) return;
    setSchiebt(true);
    const r = await updateInventar(pid, itemId, { room_id: ziel });
    setSchiebt(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  function ablegen(e: React.DragEvent, ziel: string | null) {
    e.preventDefault();
    setUeber(undefined);
    const id = e.dataTransfer.getData("text/plain");
    if (id) void zuweisen(id, ziel);
  }

  const reiter: { id: string | null; name: string }[] = [
    ...raeume.map((r) => ({ id: r.id as string | null, name: r.name })),
    ...(ohneRaum > 0 || raeume.length === 0
      ? [{ id: null, name: t("inventar.ohneRaum") }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Reiterleiste
        t={t}
        reiter={reiter}
        aktiv={aktivGueltig}
        ueber={ueber}
        zaehler={zaehler}
        neuerRaum={neuerRaum}
        offen={offen}
        onAktiv={setAktiv}
        onUeber={setUeber}
        onAblegen={ablegen}
        onNeuerRaum={setNeuerRaum}
        onOffen={setOffen}
        onAnlegen={raumAnlegen}
      />

      {raeume.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("inventar.ziehenHinweis")}</p>
      )}

      {posten.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("inventar.raumLeer")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {posten.map((g) => (
            <Zeile
              key={g.id}
              pid={pid}
              t={t}
              g={g}
              raeume={raeume}
              schaeden={schadenJeItem.get(g.id) ?? 0}
              onFertig={onFertig}
              onFehler={onFehler}
              onMelden={onMelden}
              onRaum={(ziel) => zuweisen(g.id, ziel)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Das Bild des INTAKTEN Zustands (0623).
 *
 *  Ohne Vorher-Bild gibt es im Streitfall keinen Vergleich: ein Foto vom
 *  kaputten Sessel beweist nicht, dass er vorher heil war. Ein Bild je
 *  Gegenstand — mehrere Aufnahmen gehören an den Schaden. */
function ReferenzFoto({
  pid,
  g,
  t,
  onFehler,
}: {
  pid: string;
  g: InventarGegenstand;
  t: TFn;
  onFehler: Melder;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  async function hochladen(datei: File) {
    setLaeuft(true);
    const r = await setzeReferenzfoto(pid, g.id, datei);
    setLaeuft(false);
    if (!r.ok) onFehler(r.error);
  }

  async function ansehen() {
    const r = await referenzfotoUrl(pid, g.id);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    window.open(r.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <span className="text-muted-foreground">·</span>
      <input
        ref={feld}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void hochladen(f);
        }}
      />
      <button
        type="button"
        disabled={laeuft}
        title={
          g.hat_referenz_foto
            ? t("inventar.referenzAnsehen")
            : t("inventar.referenzSetzen")
        }
        aria-label={
          g.hat_referenz_foto
            ? t("inventar.referenzAnsehen")
            : t("inventar.referenzSetzen")
        }
        onClick={() => (g.hat_referenz_foto ? void ansehen() : feld.current?.click())}
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-secondary ${
          g.hat_referenz_foto
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground"
        }`}
      >
        <Icon
          icon={
            laeuft
              ? "ph:circle-notch"
              : g.hat_referenz_foto
                ? "ph:image"
                : "ph:image-square"
          }
          className={laeuft ? "size-3 animate-spin" : "size-3"}
        />
      </button>
    </>
  );
}

function Zeile({
  pid,
  t,
  g,
  raeume,
  schaeden,
  onFertig,
  onFehler,
  onMelden,
  onRaum,
}: {
  pid: string;
  t: TFn;
  g: InventarGegenstand;
  raeume: InventarRaum[];
  schaeden: number;
  onFertig: () => Promise<void>;
  onFehler: Melder;
  onMelden: (g: InventarGegenstand) => void;
  onRaum: (ziel: string | null) => void;
}) {
  const [ist, setIst] = useState(String(g.ist_menge));
  const [laeuft, setLaeuft] = useState(false);
  // Fehlbestand ist die eigentliche Aussage einer Inventur: mehr Soll als Ist.
  const fehlt = g.soll_menge !== null && g.ist_menge < g.soll_menge;

  async function speichern(werte: Record<string, unknown>) {
    if (laeuft) return;
    setLaeuft(true);
    const r = await updateInventar(pid, g.id, werte);
    setLaeuft(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  async function entfernen() {
    if (!window.confirm(t("inventar.loeschenFrage", { name: g.name }))) return;
    const r = await deleteInventar(pid, g.id);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", g.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
    >
      <Icon
        icon="ph:dots-six-vertical"
        className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium">
          {g.name}
          {g.quelle === "dokument" && (
            <span
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              title={t("inventar.ausDokumentHint")}
            >
              {t("inventar.ausDokument")}
            </span>
          )}
          {schaeden > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <Icon icon="ph:warning-circle" className="size-3" aria-hidden />
              {t("inventar.offeneSchaeden", { count: schaeden })}
            </span>
          )}
        </p>
        {g.beschreibung && (
          <p className="truncate text-xs text-muted-foreground">{g.beschreibung}</p>
        )}
        {/* Zustand und Rhythmus (0623): erst beides macht aus der Liste eine
            Inventur. Der Zustand steuert die Ersatzplanung, der Rhythmus
            entscheidet, ob die Zeile auf der Abreise-Checkliste landet. */}
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <select
            value={g.zustand}
            onChange={(e) => void speichern({ zustand: e.target.value })}
            aria-label={t("inventar.zustand")}
            className={`rounded-full border-0 bg-transparent py-0 pl-0 pr-5 text-xs ${
              g.zustand === "ersatz_faellig"
                ? "font-medium text-destructive"
                : g.zustand === "abgenutzt"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
            }`}
          >
            {ZUSTAENDE.map((z) => (
              <option key={z} value={z}>
                {t(`inventar.zustandWert.${z}`)}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">·</span>
          <select
            value={g.zaehl_rhythmus}
            onChange={(e) => void speichern({ zaehl_rhythmus: e.target.value })}
            aria-label={t("inventar.rhythmus")}
            className="rounded-full border-0 bg-transparent py-0 pl-0 pr-5 text-xs text-muted-foreground"
          >
            {ZAEHL_RHYTHMEN.map((r) => (
              <option key={r} value={r}>
                {t(`inventar.rhythmusWert.${r}`)}
              </option>
            ))}
          </select>
          {/* Der Meldebestand nur, wo er gepflegt ist — eine 0 saehe aus wie
              „melde nie" und ist etwas anderes als „nicht gepflegt". */}
          {g.meldebestand !== null && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {t("inventar.meldebestandKurz", { n: g.meldebestand })}
              </span>
            </>
          )}
          {/* Derselbe Vorgang wie das Ziehen, nur mit Tastatur und auf dem
              Handy bedienbar. Ohne dieses Feld waere die Zuweisung an eine
              Maus gebunden. */}
          <span className="text-muted-foreground">·</span>
          <select
            value={g.room_id ?? ""}
            onChange={(e) => onRaum(e.target.value || null)}
            aria-label={t("inventar.raumWaehlen")}
            className="rounded-full border-0 bg-transparent py-0 pl-0 pr-5 text-xs text-muted-foreground"
          >
            <option value="">{t("inventar.ohneRaum")}</option>
            {raeume.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <ReferenzFoto pid={pid} g={g} t={t} onFehler={onFehler} />
        </p>
      </div>

      <span className="flex items-center gap-1.5 text-sm">
        <Input
          value={ist}
          onChange={(e) => setIst(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            const n = Number(ist || 0);
            if (n !== g.ist_menge) void speichern({ ist_menge: n });
          }}
          inputMode="numeric"
          aria-label={t("inventar.istMenge")}
          className={`h-8 w-16 text-center ${fehlt ? "border-destructive text-destructive" : ""}`}
        />
        <span className="text-muted-foreground">
          {/* „von 6" nur mit hinterlegtem Soll — sonst stuende dort eine 0,
              die wie ein Fehlbestand aussieht (Wurzel 4). */}
          {g.soll_menge !== null ? t("inventar.vonSoll", { soll: g.soll_menge }) : "—"}
        </span>
      </span>

      <button
        type="button"
        title={t("inventar.geprueft")}
        aria-label={t("inventar.geprueft")}
        onClick={() => void speichern({ geprueft: true })}
        className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-secondary ${
          g.geprueft_am ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        }`}
      >
        <Icon icon="ph:check-circle" className="size-4" />
      </button>
      <button
        type="button"
        title={t("inventar.schadenMelden")}
        aria-label={t("inventar.schadenMelden")}
        onClick={() => onMelden(g)}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Icon icon="ph:hammer" className="size-4" />
      </button>
      <button
        type="button"
        title={t("inventar.loeschen")}
        aria-label={t("inventar.loeschen")}
        onClick={() => void entfernen()}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Icon icon="ph:trash" className="size-4" />
      </button>
    </li>
  );
}

/** Schaden melden. OHNE FOTO GEHT NICHTS — der Knopf bleibt gesperrt, statt
 *  den Nutzer in die Server-Absage laufen zu lassen. */
function SchadenMelden({
  pid,
  t,
  gegenstand,
  onSchliessen,
  onFertig,
  onFehler,
}: {
  pid: string;
  t: TFn;
  gegenstand: InventarGegenstand;
  onSchliessen: () => void;
  onFertig: () => Promise<void>;
  onFehler: Melder;
}) {
  const [art, setArt] = useState<string>("beschaedigt");
  const [traeger, setTraeger] = useState<string>("offen");
  const [text, setText] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  async function senden() {
    if (fotos.length === 0 || laeuft) return;
    setLaeuft(true);
    const r = await meldeSchaden(
      pid,
      {
        item_id: gegenstand.id,
        item_name: gegenstand.name,
        art,
        traeger,
        beschreibung: text.trim() || null,
      },
      fotos,
    );
    setLaeuft(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent className="max-w-lg gap-4">
        <DialogTitle className="pr-8 text-base font-semibold">
          {t("inventar.schadenAn", { name: gegenstand.name })}
        </DialogTitle>

        <label className="flex flex-col gap-1 text-sm">
          {t("inventar.art")}
          <select
            value={art}
            onChange={(e) => setArt(e.target.value)}
            className="rounded-lg border border-border bg-background py-2 pl-2 pr-7"
          >
            {ARTEN.map((a) => (
              <option key={a} value={a}>
                {t(`inventar.artWert.${a}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("inventar.traeger")}
          <select
            value={traeger}
            onChange={(e) => setTraeger(e.target.value)}
            className="rounded-lg border border-border bg-background py-2 pl-2 pr-7"
          >
            {/* `offen` ist erlaubt: wer den Schaden entdeckt, weiss oft noch
                nicht, wer ihn zu tragen hat. Die Entscheidung faellt beim
                Bestaetigen. */}
            <option value="offen">{t("inventar.traegerWert.offen")}</option>
            {TRAEGER.map((x) => (
              <option key={x} value={x}>
                {t(`inventar.traegerWert.${x}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("inventar.beschreibung")}
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="flex flex-col gap-2">
          <input
            ref={feld}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              setFotos([...fotos, ...Array.from(e.target.files ?? [])].slice(0, 8));
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" onClick={() => feld.current?.click()}>
            <Icon icon="ph:camera" className="size-4" />
            {t("inventar.fotoWaehlen")}
          </Button>
          {fotos.length === 0 ? (
            <p className="text-xs text-destructive">{t("inventar.fotoPflicht")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("inventar.fotosGewaehlt", { count: fotos.length })}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onSchliessen}>
            {t("inventar.abbrechen")}
          </Button>
          <Button
            type="button"
            disabled={laeuft || fotos.length === 0}
            onClick={() => void senden()}
          >
            {laeuft ? t("inventar.meldet") : t("inventar.melden")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Offene Schäden: bestätigen (Betrag + Träger) oder verwerfen. */
function SchadenBereich({
  pid,
  t,
  schaeden,
  onFertig,
  onFehler,
  onBild,
}: {
  pid: string;
  t: TFn;
  schaeden: InventarSchaden[];
  onFertig: () => Promise<void>;
  onFehler: Melder;
  onBild: (fotoId: string, name: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold">
        {t("inventar.offeneSchaedenTitel", { count: schaeden.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {schaeden.map((s) => (
          <SchadenZeile
            key={s.id}
            pid={pid}
            t={t}
            s={s}
            onFertig={onFertig}
            onFehler={onFehler}
            onBild={onBild}
          />
        ))}
      </ul>
    </div>
  );
}

function SchadenZeile({
  pid,
  t,
  s,
  onFertig,
  onFehler,
  onBild,
}: {
  pid: string;
  t: TFn;
  s: InventarSchaden;
  onFertig: () => Promise<void>;
  onFehler: Melder;
  onBild: (fotoId: string, name: string) => Promise<void>;
}) {
  const [betrag, setBetrag] = useState(s.betrag !== null ? String(s.betrag) : "");
  const [traeger, setTraeger] = useState(s.traeger === "offen" ? "" : s.traeger);
  const [laeuft, setLaeuft] = useState(false);

  async function bestaetigen() {
    if (!betrag.trim() || !traeger || laeuft) return;
    setLaeuft(true);
    const r = await bestaetigeSchaden(pid, s.id, {
      betrag: Number(betrag),
      traeger,
      aufgabe_anlegen: s.art !== "entsorgt",
    });
    setLaeuft(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  async function verwerfen() {
    if (!window.confirm(t("inventar.verwerfenFrage", { name: s.item_name }))) return;
    const r = await verwerfeSchaden(pid, s.id);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-background p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{s.item_name}</span>
        <span className="text-muted-foreground">· {t(`inventar.artWert.${s.art}`)}</span>
        {s.foto_ids.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => void onBild(id, s.item_name)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/70"
          >
            <Icon icon="ph:image" className="size-3" aria-hidden />
            {t("inventar.bild", { nr: i + 1 })}
          </button>
        ))}
      </div>
      {s.beschreibung && <p className="text-xs text-muted-foreground">{s.beschreibung}</p>}

      {/* Betrag und Traeger erst HIER: die meldende Person kennt den Preis
          nicht, und ein Posten ueber 0,00 waere eine Falschaussage in der
          Abrechnung (Wurzel 4). */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={betrag}
          onChange={(e) => setBetrag(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
          placeholder={t("inventar.betrag")}
          inputMode="decimal"
          className="h-8 w-28"
        />
        <select
          value={traeger}
          onChange={(e) => setTraeger(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background pl-2 pr-7 text-sm"
        >
          <option value="">{t("inventar.werZahlt")}</option>
          {TRAEGER.map((x) => (
            <option key={x} value={x}>
              {t(`inventar.traegerWert.${x}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={laeuft || !betrag.trim() || !traeger}
          onClick={() => void bestaetigen()}
        >
          {t("inventar.bestaetigen")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void verwerfen()}>
          {t("inventar.verwerfen")}
        </Button>
      </div>
    </li>
  );
}

/** PDF wählen und lesen lassen. Legt NICHTS an — die Vorschläge kommen
 *  darunter zur Bestätigung. */
function PdfImport({
  pid,
  t,
  onVorschlaege,
  onFehler,
}: {
  pid: string;
  t: TFn;
  onVorschlaege: (v: InventarVorschlag[]) => void;
  onFehler: Melder;
}) {
  const [liest, setLiest] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  async function lesen(datei: File) {
    setLiest(true);
    const r = await leseInventarPdf(pid, datei);
    setLiest(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    if (r.data.items.length === 0) {
      // Ehrlich sagen, dass nichts gefunden wurde — eine leere
      // Bestaetigungsliste saehe aus wie ein Fehler.
      onFehler(t("inventar.pdfLeer"));
      return;
    }
    onVorschlaege(r.data.items);
  }

  return (
    <>
      <input
        ref={feld}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void lesen(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={liest}
        onClick={() => feld.current?.click()}
      >
        <Icon
          icon={liest ? "ph:circle-notch" : "ph:file-pdf"}
          className={liest ? "size-4 animate-spin" : "size-4"}
        />
        {liest ? t("inventar.pdfLiest") : t("inventar.pdfImport")}
      </Button>
    </>
  );
}

/** Die gelesenen Zeilen zum Abhaken. Jede bleibt editierbar — was das Modell
 *  erkannt hat, ist ein Vorschlag, keine Tatsache. */
function VorschlagsListe({
  pid,
  t,
  raeume,
  items,
  onAbbrechen,
  onFertig,
  onFehler,
}: {
  pid: string;
  t: TFn;
  raeume: InventarRaum[];
  items: InventarVorschlag[];
  onAbbrechen: () => void;
  onFertig: () => Promise<void>;
  onFehler: Melder;
}) {
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(
    () => new Set(items.map((_, i) => i)),
  );
  const [werte, setWerte] = useState(items);
  const [laeuft, setLaeuft] = useState(false);

  // Die Räume aus dem PDF auf vorhandene abbilden: „Küche" im Dokument und
  // „Küche" in der Liste sind derselbe Raum. Was es nicht gibt, bleibt ohne —
  // Räume automatisch anzulegen wäre eine Nebenwirkung, die niemand bestellt
  // hat.
  const raumId = (name: string | null): string | null => {
    if (!name) return null;
    const treffer = raeume.find(
      (r) => r.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return treffer?.id ?? null;
  };

  async function uebernehmen() {
    const gewaehlteZeilen = werte.filter((_, i) => gewaehlt.has(i));
    if (gewaehlteZeilen.length === 0 || laeuft) return;
    setLaeuft(true);
    const r = await createInventar(pid, {
      eintraege: gewaehlteZeilen.map((v) => ({
        name: v.name,
        soll_menge: v.soll_menge,
        room_id: raumId(v.raum),
        beschreibung: v.beschreibung,
      })),
    });
    setLaeuft(false);
    if (!r.ok) {
      onFehler(r.error);
      return;
    }
    await onFertig();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div>
        <p className="text-sm font-semibold">
          {t("inventar.pdfGefunden", { count: items.length })}
        </p>
        <p className="text-xs text-muted-foreground">{t("inventar.pdfHinweis")}</p>
      </div>

      <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
        {werte.map((v, i) => (
          // Der Index als Schlüssel ist hier richtig: die Liste wird nicht
          // umsortiert und nicht gefiltert, nur bearbeitet.
          <li key={i} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5">
            <Checkbox
              checked={gewaehlt.has(i)}
              onCheckedChange={(c) => {
                const neu = new Set(gewaehlt);
                if (c) neu.add(i);
                else neu.delete(i);
                setGewaehlt(neu);
              }}
            />
            <Input
              value={v.name}
              onChange={(e) => {
                const kopie = [...werte];
                kopie[i] = { ...v, name: e.target.value };
                setWerte(kopie);
              }}
              className="h-8 flex-1"
            />
            <Input
              value={v.soll_menge === null ? "" : String(v.soll_menge)}
              onChange={(e) => {
                const roh = e.target.value.replace(/\D/g, "");
                const kopie = [...werte];
                kopie[i] = { ...v, soll_menge: roh ? Number(roh) : null };
                setWerte(kopie);
              }}
              placeholder={t("inventar.neuSoll")}
              inputMode="numeric"
              className="h-8 w-20 text-center"
            />
            <span className="w-28 truncate text-xs text-muted-foreground">
              {v.raum ?? t("inventar.ohneRaum")}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("inventar.ausgewaehlt", { count: gewaehlt.size, gesamt: items.length })}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onAbbrechen}>
            {t("inventar.verwerfen")}
          </Button>
          <Button
            type="button"
            disabled={laeuft || gewaehlt.size === 0}
            onClick={() => void uebernehmen()}
          >
            {laeuft ? t("inventar.uebernimmt") : t("inventar.uebernehmen")}
          </Button>
        </div>
      </div>
    </div>
  );
}
