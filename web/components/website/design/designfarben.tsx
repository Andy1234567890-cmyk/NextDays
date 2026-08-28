"use client";

// Die Designfarben-Palette (0446) — Hostaways „bis zu 30 Designfarben".
//
// Der Unterschied zu den Farbrollen darunter: eine Designfarbe ist ein
// benannter WERT („Nordsee-Blau"), eine Rolle eine benannte STELLE
// („Kopfzeilen-Hintergrund"). Verknüpft man beides, ändert eine Korrektur an
// der Designfarbe alle Stellen mit, die daran hängen — und genau das ist der
// Zweck: sonst sucht der Kunde seine Markenfarbe an neun Reglern zusammen.
//
// Die Verknüpfung ist FELDWEISE. Wer eine Rolle danach von Hand auf einen
// anderen Wert setzt, löst NUR deren Bindung; alle anderen bleiben. Das ist
// dieselbe Regel, die Hostaway für Widgets beschreibt, und sie wird
// serverseitig durchgesetzt (`_farbrollen_aufloesen`) — hier wird sie nur
// gespiegelt, damit die Oberfläche zwischen zwei Speichervorgängen nicht das
// Gegenteil behauptet.
import { Icon } from "@iconify/react";
import { useState } from "react";

import type { ThemeFarbe } from "@/lib/site-config";

import { farbenAusLogo, type LogoFehler } from "./logo-farben";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Hostaways Obergrenze, übernommen. Ein Paletteneintrag ist ein Listenposten
 *  und kostet keine Bedienfläche — anders als eine frei benannte ROLLE, die
 *  ohne Stelle im Renderer nichts täte. */
export const MAX_FARBEN = 30;

export type DesignfarbenTexte = {
  titel: string;
  hinweis: string;
  hinzufuegen: string;
  ausLogo: string;
  ausLogoLaeuft: string;
  umbenennen: string;
  entfernen: string;
  voll: string;
  /** Name, den ein frisch angelegter Eintrag bekommt. */
  neueFarbe: string;
  /** Meldungen, wenn die Auslese aus dem Logo nicht möglich war. */
  fehler: Record<LogoFehler, string>;
  /** Name eines Eintrags, den der Backfill angelegt hat (Rollenschlüssel). */
  rollenName: (schluessel: string) => string;
};

/** Neue, im Satz noch nicht vergebene Kennung.
 *
 *  Durchnummeriert und nicht aus dem Namen abgeleitet: der Name ist frei
 *  änderbar, die Kennung steht in den Verknüpfungen und muss stabil bleiben.
 *  Würde sie dem Namen folgen, bräche jedes Umbenennen alle Bindungen. */
function neueKennung(vorhanden: ThemeFarbe[]): string {
  for (let n = 1; n <= MAX_FARBEN + 1; n += 1) {
    const kandidat = `farbe-${n}`;
    if (!vorhanden.some((f) => f.id === kandidat)) return kandidat;
  }
  // Unerreichbar, solange die Obergrenze vor dem Aufruf geprüft wird.
  return `farbe-${Date.now()}`;
}

export function Designfarben({
  farben,
  onFarben,
  logoUrl,
  texte,
}: {
  farben: ThemeFarbe[];
  onFarben: (neu: ThemeFarbe[]) => void;
  /** Quelle für „Farben aus dem Logo". Fehlt sie, bleibt der Knopf aus. */
  logoUrl: string | null;
  texte: DesignfarbenTexte;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  // Halb getippte Hex-Werte je Eintrag. Sie dürfen NICHT nach oben wandern:
  // das Autospeichern schickt den Stand nach jeder Änderung, und „#ab" wäre
  // serverseitig ein 422 — der Kunde sähe nur, dass nichts gespeichert wird.
  const [roh, setRoh] = useState<Record<string, string>>({});
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const [logoLaeuft, setLogoLaeuft] = useState(false);
  const [logoFehler, setLogoFehler] = useState<LogoFehler | null>(null);

  const voll = farben.length >= MAX_FARBEN;

  function setze(id: string, patch: Partial<ThemeFarbe>) {
    onFarben(farben.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  /** Hex-Eingabe: lokal immer übernehmen, nach oben nur, wenn sie vollständig
   *  ist. Ein leeres Feld bleibt lokal leer — eine Designfarbe OHNE Wert gibt
   *  es nicht, wer sie los werden will, entfernt den Eintrag. */
  function tippeHex(id: string, v: string) {
    setRoh((r) => ({ ...r, [id]: v }));
    if (HEX_RE.test(v)) setze(id, { color: v });
  }

  function ergaenze(hexWerte: string[]) {
    const frei = MAX_FARBEN - farben.length;
    const neu: ThemeFarbe[] = [];
    for (const hex of hexWerte.slice(0, frei)) {
      const id = neueKennung([...farben, ...neu]);
      // Der Name ist übersetzt und nicht die Kennung: die Kennung steht in den
      // Verknüpfungen und darf sich nie ändern, der Name gehört dem Kunden.
      neu.push({ id, name: `${texte.neueFarbe} ${farben.length + neu.length + 1}`, color: hex });
    }
    if (neu.length) onFarben([...farben, ...neu]);
  }

  async function ausLogo() {
    setLogoFehler(null);
    setLogoLaeuft(true);
    const res = await farbenAusLogo(logoUrl, 6);
    setLogoLaeuft(false);
    if (!res.ok) {
      setLogoFehler(res.grund);
      return;
    }
    // Farben, die schon in der Palette stehen, kommen nicht ein zweites Mal
    // hinein — sonst wächst die Palette bei jedem Klick um dieselben Werte.
    const bekannt = new Set(farben.map((f) => f.color.toLowerCase()));
    ergaenze(res.farben.map((f) => f.hex).filter((h) => !bekannt.has(h)));
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 pb-2 text-xs text-muted-foreground">{texte.hinweis}</p>

      <ul className="flex flex-col">
        {farben.map((farbe) => (
          <li key={farbe.id}>
            <div className="flex items-center gap-2 px-4 py-1.5">
              <button
                type="button"
                aria-label={farbe.name}
                aria-expanded={offen === farbe.id}
                onClick={() =>
                  setOffen((o) => (o === farbe.id ? null : farbe.id))
                }
                className="size-5 shrink-0 rounded-full border border-foreground/25 transition hover:ring-2 hover:ring-foreground/20"
                style={{ backgroundColor: farbe.color }}
              />
              {umbenennen === farbe.id ? (
                <input
                  autoFocus
                  value={farbe.name}
                  maxLength={40}
                  aria-label={texte.umbenennen}
                  onChange={(e) => setze(farbe.id, { name: e.target.value })}
                  onBlur={() => setUmbenennen(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setUmbenennen(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded-(--radius) border border-border bg-background px-2 py-0.5 text-xs"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm">
                  {texte.rollenName(farbe.name)}
                </span>
              )}
              <button
                type="button"
                aria-label={texte.umbenennen}
                title={texte.umbenennen}
                onClick={() => setUmbenennen(farbe.id)}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:pencil-simple" className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={texte.entfernen}
                title={texte.entfernen}
                onClick={() =>
                  onFarben(farben.filter((f) => f.id !== farbe.id))
                }
                className="rounded p-1 text-muted-foreground transition hover:text-destructive"
              >
                <Icon icon="ph:trash" className="size-3.5" />
              </button>
            </div>

            {offen === farbe.id ? (
              <div className="flex items-center gap-1 border-y border-border bg-secondary/40 px-4 py-2">
                <input
                  type="color"
                  aria-label={farbe.name}
                  value={farbe.color}
                  onChange={(e) => {
                    setRoh((r) => ({ ...r, [farbe.id]: e.target.value }));
                    setze(farbe.id, { color: e.target.value });
                  }}
                  className="h-8 w-16 cursor-pointer rounded-(--radius) border border-border bg-transparent p-0.5"
                />
                <input
                  value={roh[farbe.id] ?? farbe.color}
                  spellCheck={false}
                  aria-label={farbe.name}
                  aria-invalid={!HEX_RE.test(roh[farbe.id] ?? farbe.color)}
                  onChange={(e) => tippeHex(farbe.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-(--radius) border border-border bg-background px-2 py-1 font-mono text-xs aria-invalid:border-destructive"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 px-4 pt-2">
        <button
          type="button"
          disabled={voll}
          onClick={() => ergaenze(["#000000"])}
          className="flex items-center gap-1.5 text-xs font-medium transition hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          <Icon icon="ph:plus" className="size-3.5" />
          {texte.hinzufuegen}
        </button>
        {logoUrl ? (
          <button
            type="button"
            disabled={voll || logoLaeuft}
            onClick={ausLogo}
            className="flex items-center gap-1.5 text-xs font-medium transition hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <Icon icon="ph:eyedropper-sample" className="size-3.5" />
            {logoLaeuft ? texte.ausLogoLaeuft : texte.ausLogo}
          </button>
        ) : null}
        {voll ? (
          <p className="text-xs text-muted-foreground">{texte.voll}</p>
        ) : null}
        {logoFehler ? (
          <p className="flex items-start gap-1.5 text-xs leading-snug text-amber-700 dark:text-amber-400">
            <Icon icon="ph:warning" className="mt-0.5 size-3.5 shrink-0" />
            {texte.fehler[logoFehler]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
