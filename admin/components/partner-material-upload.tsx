"use client";

// Ablagefläche für Werbematerial-Dateien (0707): Banner, Logos, Presse-PDFs,
// das Logo-Paket als ZIP. Mehrere Dateien auf einmal — der Partner bekommt sie
// im Dashboard als Download.
//
// Warum nicht über eine Server Action wie der Rest der Seite: admin/ hat kein
// erhöhtes `bodySizeLimit`, eine Action bricht bei 1 MB ab. Der Upload geht
// deshalb per `fetch` an die BFF-Route `app/api/partner/material`, die den
// Bearer aus dem httpOnly-Cookie holt und server-zu-server durchreicht.
//
// Die Liste aktualisiert sich von selbst: die Seite hat ein `RealtimeRefresh`
// auf `affiliate_assets`. `router.refresh()` steht hier trotzdem — ein
// stummes Abo (fehlender Grant, fehlende Publikation) darf nicht dazu führen,
// dass eine gerade hochgeladene Datei unsichtbar bleibt.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

/** Was die Ablagefläche annimmt — dieselbe Liste wie die Allowlist im Backend
 *  (`material_dateien._MAGIC` + Bucket-MIMEs). Sie ist hier reine BEQUEMLICHKEIT
 *  für den Dateidialog, keine Prüfung: entschieden wird serverseitig an den
 *  Magic-Bytes, weil ein Dateidialog-Filter clientseitig ist und umgangen wird. */
const ANNEHMEN =
  ".png,.jpg,.jpeg,.webp,.svg,.mp4,.webm,.pdf,.zip,.docx,.xlsx,.pptx";

/** Titelvorschlag aus dem Dateinamen: Endung weg, Trennzeichen zu Leerzeichen.
 *  Das Backoffice kann ihn danach überschreiben — er ist ein Vorschlag, keine
 *  Festlegung. */
function titelAusDateiname(name: string): string {
  const ohneEndung = name.replace(/\.[^.]+$/, "");
  return ohneEndung.replace(/[_-]+/g, " ").trim().slice(0, 200) || name.slice(0, 200);
}

async function fehlertext(res: Response): Promise<string> {
  const roh = await res.text();
  try {
    const daten = JSON.parse(roh) as { detail?: string };
    return daten.detail || roh || "Upload fehlgeschlagen.";
  } catch {
    // Kein JSON (z. B. das nackte „Unauthorized" der BFF-Route) — dann der Rohtext.
    return roh || "Upload fehlgeschlagen.";
  }
}

/** Die Datei EINES vorhandenen Eintrags austauschen (Backend entfernt die alte).
 *  Eigener Knopf statt eines Feldes im Formular: ein Austausch hat einen
 *  Gegenzustand im Bucket, ein geänderter Titel nicht. */
export function MaterialDateiErsetzen({
  assetId,
  disabled,
}: {
  assetId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const eingabe = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function ersetzen(datei: File) {
    setLaeuft(true);
    const form = new FormData();
    form.append("file", datei, datei.name);
    form.append("assetId", assetId);
    const res = await fetch("/api/partner/material", { method: "POST", body: form });
    setLaeuft(false);
    if (!res.ok) {
      toast.error(await fehlertext(res));
      return;
    }
    toast.success("Datei ersetzt.");
    router.refresh();
  }

  return (
    <>
      <input
        ref={eingabe}
        type="file"
        accept={ANNEHMEN}
        className="hidden"
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) void ersetzen(datei);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || laeuft}
        onClick={() => eingabe.current?.click()}
        className="rounded-full border border-border px-3 py-1.5 font-medium hover:border-foreground disabled:opacity-50"
      >
        {laeuft ? "Lädt …" : "Datei ersetzen"}
      </button>
    </>
  );
}

// Hochgeladene Dateien landen bewusst OHNE Sprache, also für alle Partner. Ein
// Sprachfeld an der Ablagefläche wäre eine zweite Stelle, an der dasselbe
// eingestellt wird — wer eine Datei auf eine Sprache begrenzen will, tut das
// danach am Eintrag, wo auch Titel und Beschreibung stehen.
//
// Der ORDNER ist die Ausnahme und kommt mit (0709): er ist keine Eigenschaft,
// die man nachträglich pflegt, sondern der Ort, an dem man gerade steht.
export function PartnerMaterialUpload({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const eingabe = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ueber, setUeber] = useState(false);

  async function hochladen(dateien: File[]) {
    if (dateien.length === 0 || laeuft) return;
    setLaeuft(true);
    let geschafft = 0;
    // Nacheinander und nicht parallel: bei zehn gleichzeitigen 25-MB-Uploads
    // steht die Oberfläche, und der erste Fehler ginge zwischen neun weiteren
    // Toasts unter.
    for (const datei of dateien) {
      const form = new FormData();
      form.append("file", datei, datei.name);
      form.append("title", titelAusDateiname(datei.name));
      // Der offene Reiter. Gibt es ihn nicht mehr (ein zweites Fenster hat ihn
      // gelöscht), antwortet der Server mit 404 — die Datei landet dann NICHT
      // im Nirgendwo, sondern gar nicht.
      if (folderId) form.append("folder_id", folderId);
      const res = await fetch("/api/partner/material", { method: "POST", body: form });
      if (res.ok) {
        geschafft += 1;
      } else {
        toast.error(`${datei.name}: ${await fehlertext(res)}`);
      }
    }
    setLaeuft(false);
    if (geschafft > 0) {
      toast.success(geschafft === 1 ? "Datei hochgeladen." : `${geschafft} Dateien hochgeladen.`);
      router.refresh();
    }
  }

  return (
    <div
      onDragOver={(e) => {
        // Nur DATEIEN. Ohne diese Bedingung leuchtet die Fläche auch auf,
        // wenn ein Eintrag aus der Liste darüber gezogen wird (0709) — sie
        // nähme ihn an und täte nichts, weil `files` dabei leer ist.
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setUeber(true);
      }}
      onDragLeave={() => setUeber(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setUeber(false);
        void hochladen(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        ueber ? "border-foreground bg-muted" : "border-border"
      }`}
    >
      <input
        ref={eingabe}
        type="file"
        multiple
        accept={ANNEHMEN}
        className="hidden"
        onChange={(e) => {
          void hochladen(Array.from(e.target.files ?? []));
          // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann —
          // ohne das feuert `change` beim zweiten Mal nicht.
          e.target.value = "";
        }}
      />
      <p className="text-sm font-semibold">
        {laeuft ? "Wird hochgeladen …" : "Dateien hierher ziehen"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Bilder (PNG, JPEG, WebP, SVG) bis 10 MB · Videos (MP4, WebM) und Dokumente
        (PDF, ZIP, DOCX, XLSX, PPTX) bis 25 MB. Längere Videos als Link eintragen.
      </p>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => eingabe.current?.click()}
        className="mt-4 rounded-full border border-border px-5 py-2 text-sm font-semibold transition-colors hover:border-foreground disabled:opacity-50"
      >
        Dateien auswählen
      </button>
    </div>
  );
}
