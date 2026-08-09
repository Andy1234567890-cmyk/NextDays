"use client";

// Formular einer Ankündigung — anlegen und bearbeiten in einer Komponente.
//
// Speichern ≠ Veröffentlichen: dieses Formular schreibt nur den Inhalt. Der
// Schritt in die Kundendashboards ist ein eigener Knopf mit eigenem Dialog
// (veroeffentlichen-dialog.tsx), damit ein Tippfehler-Speichern niemanden
// erreicht.
import { Icon } from "@iconify/react";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  aendern,
  anlegen,
  loeschen,
  type AnkuendigungEingabe,
} from "@/lib/announcement-actions";
import {
  KATEGORIE_LABEL,
  STATUS_LABEL,
  type Ankuendigung,
  type AnkuendigungKategorie,
} from "@/lib/announcements";

import { VeroeffentlichenDialog } from "./veroeffentlichen-dialog";

const KATEGORIEN: AnkuendigungKategorie[] = [
  "neuerung",
  "wartung",
  "hinweis",
  "wichtig",
];

/**
 * Ist der Editor-Inhalt leer?
 *
 * TipTap liefert für ein leeres Dokument nicht "" sondern "<p></p>" — ohne
 * diese Prüfung ließe sich eine Ankündigung ohne einen einzigen Buchstaben
 * veröffentlichen. Bilder zählen als Inhalt, auch wenn sie keinen Text tragen.
 */
function istLeer(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length === 0;
}

export function AnkuendigungFormular({
  vorhanden,
  darfSchreiben,
}: {
  /** undefined = neue Ankündigung. */
  vorhanden?: Ankuendigung;
  darfSchreiben: boolean;
}) {
  const router = useRouter();

  const [titel, setTitel] = useState(vorhanden?.titel ?? "");
  const [kurztext, setKurztext] = useState(vorhanden?.kurztext ?? "");
  const [kategorie, setKategorie] = useState<AnkuendigungKategorie>(
    vorhanden?.kategorie ?? "neuerung",
  );
  const [alsPopup, setAlsPopup] = useState(vorhanden?.als_popup ?? false);
  const [gueltigBis, setGueltigBis] = useState(
    vorhanden?.gueltig_bis ? vorhanden.gueltig_bis.slice(0, 10) : "",
  );
  // Der Editor ist UNKONTROLLIERT (value ist nur der Startwert). Deshalb hier
  // nur mitschreiben, was er meldet — nie zurückschreiben, sonst springt der
  // Cursor. Der Remount beim Wechsel der Ankündigung kommt über die eigene
  // Route, nicht über einen key.
  const [inhalt, setInhalt] = useState(vorhanden?.inhalt_html ?? "");

  const [laeuft, setLaeuft] = useState(false);
  const [dialogOffen, setDialogOffen] = useState(false);
  // Die Vorschau zeigt NICHT den Editor-Zustand, sondern das, was der Server
  // nach dem nh3-Lauf zurückgemeldet hat. So sieht der Redakteur genau das
  // Ergebnis, das die Kunden bekommen — inklusive entfernter Fremdbilder —,
  // und die Vorschau ist zugleich kein Rendern seines eigenen Roh-HTMLs.
  const [vorschau, setVorschau] = useState(vorhanden?.inhalt_html ?? "");

  const istEntwurf = !vorhanden || vorhanden.status === "entwurf";

  async function bildHochladen(datei: File): Promise<string> {
    // Bilder hängen an einer Ankündigung (Pfad {id}/…), also braucht es sie
    // vorher. Erst speichern, dann bebildern — der Knopf ist deshalb bis dahin
    // gar nicht sichtbar.
    if (!vorhanden) throw new Error("Erst speichern, dann Bilder einfügen.");
    const form = new FormData();
    form.append("file", datei, datei.name);
    const res = await fetch(`/api/ankuendigungen/${vorhanden.id}/bild`, {
      method: "POST",
      body: form,
    });
    const rohtext = await res.text();
    // FastAPI antwortet im Fehlerfall mit {"detail": "…"}. Die BFF-Route reicht
    // das unverändert durch — also hier auspacken, statt dem Redakteur rohes
    // JSON anzuzeigen.
    let daten: { url?: string; detail?: string } = {};
    try {
      daten = rohtext ? (JSON.parse(rohtext) as typeof daten) : {};
    } catch {
      // Kein JSON (z. B. das nackte „Unauthorized" der BFF-Route) — dann zählt
      // der Rohtext.
      daten = { detail: rohtext };
    }
    if (!res.ok) {
      const meldung = daten.detail || "Bild konnte nicht hochgeladen werden.";
      toast.error(meldung);
      throw new Error(meldung);
    }
    if (!daten.url) {
      toast.error("Das Backend hat keine Bild-URL geliefert.");
      throw new Error("Keine URL");
    }
    return daten.url;
  }

  async function speichern() {
    if (laeuft) return;
    if (!titel.trim()) {
      toast.error("Ohne Titel geht es nicht.");
      return;
    }
    if (istLeer(inhalt)) {
      toast.error("Der Inhalt ist leer.");
      return;
    }

    const eingabe: AnkuendigungEingabe = {
      titel: titel.trim(),
      inhalt_html: inhalt,
      kurztext: kurztext.trim() || null,
      kategorie,
      als_popup: alsPopup,
      // Nur ein Datum, keine Uhrzeit: „gültig bis" begrenzt das Popup tageweise.
      gueltig_bis: gueltigBis || null,
    };

    setLaeuft(true);
    const res = vorhanden
      ? await aendern(vorhanden.id, eingabe)
      : await anlegen(eingabe);
    setLaeuft(false);

    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success("Gespeichert.");
    setVorschau(res.data.inhalt_html);
    if (!vorhanden) {
      // Auf die eigene Route wechseln: ab hier hat die Ankündigung eine ID und
      // damit einen Ort für ihre Bilder.
      router.replace(`/ankuendigungen/${res.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function entwurfLoeschen() {
    if (!vorhanden || laeuft) return;
    setLaeuft(true);
    const res = await loeschen(vorhanden.id);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success("Entwurf gelöscht.");
    router.replace("/ankuendigungen");
  }

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">
            {vorhanden ? "Ankündigung bearbeiten" : "Neue Ankündigung"}
          </h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
            Geht an alle Betriebe. Eigentümer, Mitarbeitende und
            Reinigungskräfte sehen davon nichts.
          </p>
        </div>
        {vorhanden && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {STATUS_LABEL[vorhanden.status]}
          </span>
        )}
      </div>

      {!darfSchreiben && (
        <p className="mt-6 max-w-3xl rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Dein Zugang darf Ankündigungen ansehen, aber nicht ändern.
        </p>
      )}

      <div className="mt-8 max-w-3xl space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Titel
          </span>
          <input
            type="text"
            value={titel}
            maxLength={200}
            disabled={!darfSchreiben}
            onChange={(e) => setTitel(e.target.value)}
            className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground disabled:opacity-60"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Kategorie
            </span>
            <span className="relative flex items-center">
              <select
                value={kategorie}
                disabled={!darfSchreiben}
                onChange={(e) =>
                  setKategorie(e.target.value as AnkuendigungKategorie)
                }
                className="w-full appearance-none rounded-xl border border-border bg-transparent px-3.5 py-2 pr-9 text-sm outline-none focus-visible:border-foreground disabled:opacity-60"
              >
                {KATEGORIEN.map((k) => (
                  <option key={k} value={k}>
                    {KATEGORIE_LABEL[k]}
                  </option>
                ))}
              </select>
              <Icon
                icon="ph:caret-down"
                aria-hidden
                className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground"
              />
            </span>
          </label>

          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Popup nur bis (optional)
            </span>
            <input
              type="date"
              value={gueltigBis}
              disabled={!darfSchreiben}
              onChange={(e) => setGueltigBis(e.target.value)}
              className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground disabled:opacity-60"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Kurztext (optional) — eine Zeile für die Übersicht
          </span>
          <input
            type="text"
            value={kurztext}
            maxLength={300}
            disabled={!darfSchreiben}
            onChange={(e) => setKurztext(e.target.value)}
            placeholder="z. B. Der Kalender zeigt jetzt freie Einheiten je Typ."
            className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground disabled:opacity-60"
          />
          <span className="mt-1.5 block text-xs text-muted-foreground">
            Bewusst kurz und einfach halten: der Inhalt wird nicht übersetzt,
            das Dashboard drumherum schon.
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Inhalt
          </span>
          {darfSchreiben ? (
            <RichTextEditor
              value={vorhanden?.inhalt_html ?? ""}
              onChange={setInhalt}
              placeholder="Was ist neu? Kurz, konkret, ohne Fachjargon."
              // Ohne gespeicherte Ankündigung gibt es keinen Ort für Bilder —
              // dann bleibt der Editor exakt der alte (Prop weggelassen).
              bildUpload={vorhanden ? bildHochladen : undefined}
            />
          ) : (
            <div
              className="tiptap rounded-xl border border-border p-4 text-sm"
              // Der Inhalt kommt bereits nh3-bereinigt vom Server zurück; hier
              // wird nichts vom Redakteur roh gerendert.
              dangerouslySetInnerHTML={{ __html: vorschau }}
            />
          )}
          {darfSchreiben && !vorhanden && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Screenshots (PNG/WebP) lassen sich einfügen, sobald der Entwurf
              einmal gespeichert ist.
            </p>
          )}
        </div>

        {darfSchreiben && vorschau && (
          <div>
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Vorschau — so kommt es beim Betrieb an
            </span>
            <div
              className="tiptap rounded-xl border border-dashed border-border p-4 text-sm"
              // Bewusst der GESPEICHERTE Stand, nicht der Editor-Zustand: er
              // hat den Server-Sanitizer bereits passiert. Fehlt hier ein
              // eingefügtes Fremdbild, dann weil es verworfen wurde — genau das
              // soll der Redakteur sehen, bevor er veröffentlicht.
              dangerouslySetInnerHTML={{ __html: vorschau }}
            />
          </div>
        )}

        <label className="flex max-w-3xl items-start gap-3 rounded-xl border border-border p-4">
          <input
            type="checkbox"
            checked={alsPopup}
            disabled={!darfSchreiben}
            onChange={(e) => setAlsPopup(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-foreground"
          />
          <span>
            <span className="block text-sm font-semibold">
              Als Popup zeigen
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Unterbricht jeden Betrieb beim nächsten Login mit einem Dialog,
              den er aktiv schließen muss. Ohne Haken erscheint die Ankündigung
              nur auf der Seite „Neuerungen".
            </span>
          </span>
        </label>
      </div>

      {darfSchreiben && (
        <div className="mt-8 flex max-w-3xl flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void speichern()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft ? "Wird gespeichert …" : "Speichern"}
          </button>

          {vorhanden && (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => setDialogOffen(true)}
              className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground disabled:opacity-50"
            >
              <Icon
                icon={
                  vorhanden.status === "veroeffentlicht"
                    ? "ph:arrow-u-up-left"
                    : "ph:megaphone"
                }
                className="size-4"
              />
              {vorhanden.status === "veroeffentlicht"
                ? "Zurückziehen"
                : "Veröffentlichen"}
            </button>
          )}

          {vorhanden && istEntwurf && (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void entwurfLoeschen()}
              className="ml-auto text-sm font-semibold text-destructive underline-offset-4 hover:underline disabled:opacity-50"
            >
              Entwurf löschen
            </button>
          )}
        </div>
      )}

      {vorhanden && (
        <VeroeffentlichenDialog
          ankuendigung={vorhanden}
          offen={dialogOffen}
          aufSchliessen={() => setDialogOffen(false)}
        />
      )}
    </div>
  );
}
