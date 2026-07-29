"use client";

// Quick-Replies-Verwaltung (Airbnb „Manage quick replies"): links die Vorlagen-
// liste, „Erstellen" öffnet ein Formular (Titel + Text mit Platzhalter-Hinweis).
// Platzhalter {{guest_name}} / {{property}} / {{check_in}} / {{check_out}} füllt
// der Server beim Einfügen im Chat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import type { QuickReply } from "@/lib/posteingang";
import { erstelleVorlage, loescheVorlage } from "@/lib/posteingang-actions";

const PLATZHALTER = ["{{guest_name}}", "{{property}}", "{{check_in}}", "{{check_out}}"];

// Die Beispiel-Zeile im Textfeld nennt zwei dieser Platzhalter. Sie werden als
// Variablen in die Übersetzung gereicht: so bleiben sie mit PLATZHALTER in
// Deckung und die geschweiften Klammern kollidieren nicht mit der ICU-Syntax.
const [PLATZHALTER_GAST, PLATZHALTER_OBJEKT] = PLATZHALTER;

export function VorlagenVerwaltung({ initial }: { initial: QuickReply[] }) {
  const t = useTranslations("posteingang");
  // „Speichern"/„Abbrechen" liegen schon im gemeinsamen Bereich — nicht doppeln.
  const tg = useTranslations("gemeinsam");
  const [liste, setListe] = useState<QuickReply[]>(initial);
  const [formOffen, setFormOffen] = useState(false);
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen() {
    if (!titel.trim() || !text.trim()) return;
    setBusy(true);
    setFehler(null);
    const res = await erstelleVorlage(titel.trim(), text.trim());
    setBusy(false);
    if (res.ok) {
      setListe((l) => [res.quickReply, ...l]);
      setTitel("");
      setText("");
      setFormOffen(false);
    } else {
      setFehler(res.error);
    }
  }

  async function loeschen(id: string) {
    const res = await loescheVorlage(id);
    if (res.ok) setListe((l) => l.filter((q) => q.id !== id));
    else setFehler(res.error);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/nachrichten"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon icon="ph:arrow-left" className="size-4" />
        {t("zurueckZumPosteingang")}
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t("vorlagenTitel")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("vorlagenUntertitel")}
          </p>
        </div>
        {!formOffen && (
          <Button type="button" onClick={() => setFormOffen(true)}>
            <Icon icon="ph:plus" className="mr-1.5 size-4" />
            {t("erstellen")}
          </Button>
        )}
      </div>

      {fehler && <p className="mb-4 text-sm text-destructive">{fehler}</p>}

      {formOffen && (
        <div className="mb-8 rounded-2xl border border-border p-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("vorlageTitel")}
              </label>
              <Input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder={t("vorlageTitelPlatzhalter")}
                disabled={busy}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("vorlageNachricht")}
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                disabled={busy}
                placeholder={t("vorlageNachrichtPlatzhalter", {
                  gast: PLATZHALTER_GAST,
                  objekt: PLATZHALTER_OBJEKT,
                })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLATZHALTER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setText((vorher) => `${vorher}${p}`)}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => void anlegen()}
                disabled={busy || !titel.trim() || !text.trim()}
              >
                {tg("speichern")}
              </Button>
              <button
                type="button"
                onClick={() => setFormOffen(false)}
                disabled={busy}
                className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
              >
                {tg("abbrechen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Icon icon="ph:chat-dots" className="mx-auto size-8" />
          <p className="mt-2 font-medium">{t("keineVorlagenTitel")}</p>
          <p className="text-sm">{t("keineVorlagenText")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {liste.map((q) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border p-5"
            >
              <div className="min-w-0">
                <p className="font-semibold">{q.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {q.body}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("loeschen")}
                onClick={() => void loeschen(q.id)}
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Icon icon="ph:trash" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
