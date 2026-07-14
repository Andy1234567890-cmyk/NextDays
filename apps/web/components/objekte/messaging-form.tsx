"use client";

// Nachrichten-Platzhalter eines Objekts (Messaging placeholders).
//  Mehrsprachige, wiederverwendbare Texte (Check-in/out, Anfahrt, Türzugang,
//  Hausordnung, WLAN, Reiseführer, Notfallkontakt). Jeder Block hat einen
//  Shortcode ({{CheckinInstructions}} …) für automatische Gästenachrichten.
//  Alle Felder werden zusammen über updateProperty() in
//  type_attributes.messaging gespeichert.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
import {
  type Messaging,
  MESSAGING_FIELDS,
  readMessaging,
} from "@/lib/messaging-meta";
import { type LocalizedText } from "@/lib/policy-meta";
import { type Property, updateProperty } from "@/lib/properties";

export function MessagingForm({ initial }: { initial: Property }) {
  const [p, setP] = useState<Property>(initial);
  const [v, setV] = useState<Messaging>(() => readMessaging(initial.type_attributes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField(key: keyof Messaging, next: LocalizedText) {
    setSaved(false);
    setV((prev) => ({ ...prev, [key]: next }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, messaging: v },
    });
    setBusy(false);
    if (res.ok) {
      setP(res.data);
      setSaved(true);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-extrabold">Nachrichten-Platzhalter</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Hier erstellst du die Inhalte deiner Nachrichten-Platzhalter für die
          Objekt-Anweisungen. Diese automatisch eingesetzten Texte sind in jeder
          Benachrichtigung wiederverwendbar, die du deinen Gästen schickst – per
          Shortcode (z. B. <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{{CheckinInstructions}}`}</code>).
        </p>
        <TipsPopover />
      </header>

      <div className="flex flex-col gap-8">
        {MESSAGING_FIELDS.map((f) => (
          <section key={f.key} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-extrabold">{f.title}</h2>
                <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent">
                  {f.shortcode}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{f.hint}</p>
            </div>
            <LocalizedTextEditor
              value={v[f.key]}
              onChange={(next) => setField(f.key, next)}
              placeholder={f.placeholder}
            />
          </section>
        ))}
      </div>

      {/* Fußzeile: Speichern (ein Save für alle Blöcke). */}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon icon="ph:check-circle" className="size-4 text-accent" />
            Gespeichert.
          </p>
        )}
        <Button className="ml-auto" onClick={save} disabled={busy}>
          {busy ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

// „Tipps"-Popover (Tips): erklärt, wie Platzhalter in
// Nachrichten-Vorlagen eingesetzt werden, inkl. Beispiel-Shortcodes.
function TipsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit gap-2">
          <Icon icon="ph:lightbulb" className="size-4" />
          Tipps
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-3">
        <p className="font-semibold">Platzhalter in Benachrichtigungen</p>
        <p className="text-muted-foreground">
          Platzhalter sind praktisch beim Schreiben von Nachrichten – du kannst
          sie in deine Nachrichten-Vorlagen einfügen.
        </p>
        <p className="text-muted-foreground">
          In der Vorlage erscheinen sie zwischen Klammern, zum Beispiel:
        </p>
        <div className="flex flex-col items-start gap-1.5">
          <Shortcode>{`{{CheckinInstructions}}`}</Shortcode>
          <Shortcode>{`{{DoorInstructions}}`}</Shortcode>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Shortcode({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent">
      {children}
    </span>
  );
}
