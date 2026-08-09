"use client";

// Sprachstand einer Ankündigung: welche Fassungen es gibt, welche fehlen,
// welche geprüft sind — und der Weg, jede einzelne durchzusehen.
//
// WARUM ES DIESEN BEREICH GIBT: Die Kunden sitzen in Schweden, Dänemark und dem
// übrigen Europa. Ihr Dashboard läuft komplett in ihrer Sprache; nur die
// Ankündigung selbst war deutsch — ausgerechnet der Text, der Preisänderungen
// und Wartungsfenster ankündigt. Übersetzt wird deshalb BEIM VERFASSEN, und
// jede Fassung ist vor dem Veröffentlichen durchsehbar.
//
// DIE ZENTRALE REGEL, die diese Oberfläche sichtbar machen muss: Eine von Hand
// korrigierte Fassung ist GEPRÜFT und wird von keinem automatischen Lauf mehr
// angefasst. Der Text enthält rechtliche Aussagen und Geldbeträge — ein
// überschriebener korrigierter Betrag wäre der teuerste denkbare Fehler.
// Deshalb trägt jede geprüfte Fassung ein Schloss-Symbol, und der
// Übersetzen-Knopf sagt ausdrücklich, dass er sie in Ruhe lässt.
import { Icon } from "@iconify/react";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { fassungSpeichern, uebersetzen } from "@/lib/announcement-actions";
import {
  SPRACH_NAME,
  type AnkuendigungFassung,
  type FassungsUebersicht,
} from "@/lib/announcements";

/** Anzeigename einer Sprache. Unbekannter Code → der Code selbst, statt eines
 *  Absturzes: die verbindliche Liste führt das Backend, nicht diese Map. */
function sprachName(code: string): string {
  return SPRACH_NAME[code] ?? code;
}

export function UebersetzungenPanel({
  announcementId,
  uebersicht,
  darfSchreiben,
}: {
  announcementId: string;
  uebersicht: FassungsUebersicht;
  darfSchreiben: boolean;
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  // Welche Sprache gerade zum Bearbeiten offen ist. Immer nur EINE: der
  // TipTap-Editor ist unkontrolliert und braucht einen Remount je Fassung —
  // deshalb hängt sein `key` an der Sprache.
  const [offen, setOffen] = useState<string | null>(null);

  const [titel, setTitel] = useState("");
  const [kurztext, setKurztext] = useState("");
  const [inhalt, setInhalt] = useState("");

  const vorhanden = uebersicht.items;
  const fehlend = uebersicht.fehlend;
  const geprueftAnzahl = vorhanden.filter((f) => f.geprueft).length;

  function bearbeiten(f: AnkuendigungFassung) {
    setOffen(f.sprache);
    setTitel(f.titel);
    setKurztext(f.kurztext ?? "");
    setInhalt(f.inhalt_html);
  }

  async function alleUebersetzen(sprache?: string) {
    if (laeuft) return;
    setLaeuft(sprache ?? "alle");
    const res = await uebersetzen(announcementId, sprache);
    setLaeuft(null);
    if (!res.ok) {
      // Der Ausfall des Dienstes wird SICHTBAR gemeldet und nicht verschluckt:
      // sonst hielte der Redakteur eine unübersetzte Ankündigung für fertig.
      toast.error(res.fehler);
      return;
    }
    toast.success(
      sprache
        ? `${sprachName(sprache)} neu übersetzt.`
        : "Fehlende Fassungen erzeugt.",
    );
    router.refresh();
  }

  async function speichern(sprache: string) {
    if (laeuft) return;
    if (!titel.trim()) {
      toast.error("Ohne Titel geht es nicht.");
      return;
    }
    setLaeuft(sprache);
    const res = await fassungSpeichern(announcementId, sprache, {
      titel: titel.trim(),
      kurztext: kurztext.trim() || null,
      inhalt_html: inhalt,
    });
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success(`${sprachName(sprache)} gespeichert und als geprüft markiert.`);
    setOffen(null);
    router.refresh();
  }

  return (
    <section className="mt-12 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight">
            Sprachen
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Jeder Betrieb sieht die Ankündigung in seiner eigenen Sprache.
            Fehlt eine Fassung, bekommt er den deutschen Originaltext — nie
            eine leere Seite.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {vorhanden.length} von {vorhanden.length + fehlend.length} Sprachen
          {geprueftAnzahl > 0 && ` · ${geprueftAnzahl} geprüft`}
        </span>
      </div>

      {darfSchreiben && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={laeuft !== null || fehlend.length === 0}
            onClick={() => void alleUebersetzen()}
            className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon icon="ph:translate" className="size-4" />
            {laeuft === "alle"
              ? "Wird übersetzt …"
              : fehlend.length > 0
                ? `${fehlend.length} fehlende Fassungen erzeugen`
                : "Alle Sprachen vorhanden"}
          </button>
          <span className="text-xs text-muted-foreground">
            Geprüfte Fassungen werden dabei nicht angefasst.
          </span>
        </div>
      )}

      {uebersicht.veraltet.length > 0 && (
        <p className="mt-5 rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <Icon
            icon="ph:warning"
            aria-hidden
            className="mr-1.5 inline size-4 align-text-bottom"
          />
          Geprüft, aber der deutsche Text hat sich seither geändert:{" "}
          <strong>
            {uebersicht.veraltet.map(sprachName).join(", ")}
          </strong>
          . Diese Fassungen bleiben unverändert stehen — bitte durchsehen und
          bei Bedarf neu übersetzen lassen.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {vorhanden.map((f) => (
          <li
            key={f.sprache}
            className="rounded-xl border border-border px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">
                {sprachName(f.sprache)}
              </span>

              {f.geprueft ? (
                <span
                  className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                  title="Von Hand geprüft — automatische Läufe lassen sie unverändert."
                >
                  <Icon icon="ph:lock-simple" className="size-3" />
                  geprüft
                </span>
              ) : (
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  maschinell
                </span>
              )}

              {f.veraltet && (
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  Original geändert
                </span>
              )}

              {darfSchreiben && (
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    disabled={laeuft !== null}
                    onClick={() =>
                      offen === f.sprache ? setOffen(null) : bearbeiten(f)
                    }
                    className="text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    {offen === f.sprache ? "Schließen" : "Durchsehen"}
                  </button>
                  {/* Deutsch ist das Original und wird nie „neu übersetzt". */}
                  {f.sprache !== "de" && (
                    <button
                      type="button"
                      disabled={laeuft !== null || f.geprueft}
                      onClick={() => void alleUebersetzen(f.sprache)}
                      title={
                        f.geprueft
                          ? "Geprüfte Fassungen werden nicht überschrieben. Zum Verwerfen bitte von Hand bearbeiten."
                          : undefined
                      }
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-40"
                    >
                      {laeuft === f.sprache ? "…" : "Neu übersetzen"}
                    </button>
                  )}
                </span>
              )}
            </div>

            {offen === f.sprache && (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-muted-foreground">
                    Titel
                  </span>
                  <input
                    type="text"
                    value={titel}
                    maxLength={200}
                    onChange={(e) => setTitel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs text-muted-foreground">
                    Kurztext (optional)
                  </span>
                  <input
                    type="text"
                    value={kurztext}
                    maxLength={300}
                    onChange={(e) => setKurztext(e.target.value)}
                    className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground"
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-xs text-muted-foreground">
                    Inhalt
                  </span>
                  {/* `key` an der Sprache: der Editor ist unkontrolliert und
                      übernimmt `value` nur beim Mounten. Ohne den key zeigte er
                      beim Wechsel der Sprache weiter den alten Text. */}
                  <RichTextEditor
                    key={f.sprache}
                    value={f.inhalt_html}
                    onChange={setInhalt}
                    placeholder="Fassung in dieser Sprache"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={laeuft !== null}
                    onClick={() => void speichern(f.sprache)}
                    className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {laeuft === f.sprache
                      ? "Wird gespeichert …"
                      : "Speichern und als geprüft markieren"}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Danach lässt jeder automatische Lauf diese Fassung
                    unverändert.
                  </span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {fehlend.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Noch ohne Fassung: {fehlend.map(sprachName).join(", ")}.
        </p>
      )}
    </section>
  );
}
